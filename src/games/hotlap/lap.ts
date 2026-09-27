import { dailyTrack, FIRST_DAY, type DailyTrack } from './daily'
import { botLap, buildTrack, GHOST_RATE, lapDistance, nearest, type GhostPath, type Track } from './sim'

/*
 * What a lap is measured against: the day's track, its pace car, and your own best lap on it, kept on
 * the device with where the car was all the way round so it can be driven again as the ghost.
 */

/** A lap as the ghost drives it: its time, where each sector ended, and where the car was. */
export type GhostLap = { time: number; splits: number[]; ghost: GhostPath }

/*
 * Not a score: the board keeps that. This is only each day's best lap and its path, for the ghost, on
 * this device, and only the last few days: a day's lap is no use on another day's track.
 */
const LAPS_KEY = 'skermix-hotlap-laps'
/** From before the tracks were daily: a lap of the classic track, which is the first day's. */
const OLD_LAP_KEY = 'skermix-hotlap-lap'
const KEEP_DAYS = 3

function validLap(raw: Partial<GhostLap> | null | undefined): GhostLap | null {
  if (!raw || typeof raw.time !== 'number' || !(raw.time > 20 && raw.time < 600)) return null
  if (!Array.isArray(raw.splits) || raw.splits.length !== 3 || !raw.splits.every(Number.isFinite)) return null
  if (!Array.isArray(raw.ghost) || raw.ghost.length < 30 || raw.ghost.length % 3 !== 0 || !raw.ghost.every(Number.isFinite)) return null
  return { time: raw.time, splits: raw.splits, ghost: raw.ghost }
}

function readLaps(): Record<string, GhostLap> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAPS_KEY) ?? 'null') as { days?: Record<string, Partial<GhostLap>> } | null
    const days: Record<string, GhostLap> = {}
    for (const [day, raw] of Object.entries(parsed?.days ?? {})) {
      const lap = validLap(raw)
      if (lap) days[day] = lap
    }
    // The classic track's lap, kept before the tracks were daily, is the first day's.
    const old = validLap(JSON.parse(localStorage.getItem(OLD_LAP_KEY) ?? 'null') as Partial<GhostLap> | null)
    if (old && !days[FIRST_DAY]) days[FIRST_DAY] = old
    return days
  } catch {
    return {}
  }
}

/** Your best lap of a day's track on this device, if you've driven it. */
export function keptLap(day: string): GhostLap | null {
  return readLaps()[day] ?? null
}

export function keepLap(day: string, lap: GhostLap) {
  try {
    const days = { ...readLaps(), [day]: { time: lap.time, splits: lap.splits, ghost: lap.ghost.map((v) => Math.round(v * 100) / 100) } }
    const keep = Object.keys(days).sort().slice(-KEEP_DAYS)
    localStorage.setItem(LAPS_KEY, JSON.stringify({ days: Object.fromEntries(keep.map((d) => [d, days[d]])) }))
    localStorage.removeItem(OLD_LAP_KEY)
  } catch {
    /* a private window keeps nothing; the lap still counts */
  }
}

/** A test drive's best lap of each track, kept only while the tab is open: a track driven ahead of its day. */
const testLaps = new Map<string, GhostLap>()

/** Your best lap of a day's track: on this device, or in a test drive, in this tab. */
export function bestLapOf(day: string, test: boolean): GhostLap | null {
  return test ? (testLaps.get(day) ?? null) : keptLap(day)
}

export function keepBestLap(day: string, test: boolean, lap: GhostLap) {
  if (test) testLaps.set(day, lap)
  else keepLap(day, lap)
}

/** A day's track, built, and its pace car's lap: a driver that keeps to the middle of the road. */
export type Course = DailyTrack & { track: Track; paceLap: GhostLap }

const courses = new Map<string, Course>()

/** The day's track, worked out once a day: its pace car's lap is the ghost until you have one of your own. */
export function hotlapCourse(day: string): Course {
  let course = courses.get(day)
  if (!course) {
    const daily = dailyTrack(day)
    const track = buildTrack(daily.pieces)
    const bot = botLap(track)
    course = { ...daily, track, paceLap: { time: bot.time ?? daily.pace, splits: bot.splits, ghost: bot.ghost } }
    if (courses.size > 2) courses.clear()
    courses.set(day, course)
  }
  return course
}

/** How far round the lap a car is, in metres from the line: negative before it first crosses it. */
export function progressOf(track: Track, dist: number, crossed: boolean) {
  return !crossed && dist > track.length / 2 ? dist - track.length : dist
}

export type GhostPose = { x: number; y: number; h: number; done: boolean }

/** A ghost lap made ready to follow: where it is at any moment, and when it got to any point. */
export class Ghost {
  readonly lap: GhostLap
  private readonly samples: number
  /** How far round the lap each sample is, never going back. */
  private readonly reach: Float64Array

  constructor(track: Track, lap: GhostLap) {
    this.lap = lap
    const g = lap.ghost
    this.samples = g.length / 3
    this.reach = new Float64Array(this.samples)
    let hint = -1
    let most = -Infinity
    let crossed = false
    let before = 0
    for (let j = 0; j < this.samples; j++) {
      const near = nearest(track, g[j * 3]!, g[j * 3 + 1]!, hint)
      hint = near.index
      const d = lapDistance(track, near.index)
      // It starts just behind the line; the distance wraps back to nothing as it crosses.
      if (j === 0) crossed = d < track.length / 2
      else if (!crossed && before - d > track.length / 2) crossed = true
      before = d
      most = Math.max(most, progressOf(track, d, crossed))
      this.reach[j] = most
    }
  }

  /** Where it is `t` seconds into its lap; once its lap is done, it waits where it finished. */
  at(t: number): GhostPose {
    const g = this.lap.ghost
    const at = Math.max(0, t * GHOST_RATE)
    const last = this.samples - 1
    if (at >= last) return { x: g[last * 3]!, y: g[last * 3 + 1]!, h: g[last * 3 + 2]!, done: true }
    const i = Math.floor(at)
    const f = at - i
    const k = i * 3
    let dh = g[k + 5]! - g[k + 2]!
    dh = Math.atan2(Math.sin(dh), Math.cos(dh))
    return {
      x: g[k]! + (g[k + 3]! - g[k]!) * f,
      y: g[k + 1]! + (g[k + 4]! - g[k + 1]!) * f,
      h: g[k + 2]! + dh * f,
      done: false,
    }
  }

  /** Seconds into its lap it reached `progress` metres round. */
  timeAt(progress: number): number {
    const reach = this.reach
    if (progress >= reach[reach.length - 1]!) return this.lap.time
    let lo = 0
    let hi = reach.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (reach[mid]! < progress) lo = mid + 1
      else hi = mid
    }
    if (lo === 0) return 0
    const a = reach[lo - 1]!
    const b = reach[lo]!
    const f = b > a ? (progress - a) / (b - a) : 1
    return (lo - 1 + f) / GHOST_RATE
  }
}
