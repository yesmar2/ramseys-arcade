import { ownKey, ownRun, SIGNED_OUT, type OwnedRuns, type Viewer } from '../../lib/deviceRuns'
import { dailyTrack, type DailyTrack } from './daily'
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
 *
 * Each player who drives here has a best lap of their own (lib/deviceRuns.ts): a lap is kept under whoever
 * was signed in as it started, or signed out, so one player's lap is never another's ghost, nor on their
 * ticket, and never kept over theirs.
 */
const LAPS_KEY = 'skermix-hotlap-owned-laps'
const KEEP_DAYS = 3
/** A lap and its path come to some 50 KB: a day keeps the laps of this many players, dropping the one kept longest ago. */
const KEEP_OWNERS = 4

/** A lap as the device keeps it, with when it was kept: a day with too many drops the one kept longest ago. */
type KeptLap = GhostLap & { at: number }

function validLap(raw: Partial<GhostLap> | null | undefined): GhostLap | null {
  if (!raw || typeof raw.time !== 'number' || !(raw.time > 20 && raw.time < 600)) return null
  if (!Array.isArray(raw.splits) || raw.splits.length !== 3 || !raw.splits.every(Number.isFinite)) return null
  if (!Array.isArray(raw.ghost) || raw.ghost.length < 30 || raw.ghost.length % 3 !== 0 || !raw.ghost.every(Number.isFinite)) return null
  return { time: raw.time, splits: raw.splits, ghost: raw.ghost }
}

/** Each day's best laps on this device, by whose they are: an account's id, or SIGNED_OUT. */
function readLaps(): Record<string, OwnedRuns<KeptLap>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAPS_KEY) ?? 'null') as {
      days?: Record<string, Record<string, Partial<KeptLap>> | null>
    } | null
    const days: Record<string, OwnedRuns<KeptLap>> = {}
    for (const [day, laps] of Object.entries(parsed?.days ?? {})) {
      for (const [owner, raw] of Object.entries(laps ?? {})) {
        const lap = validLap(raw)
        if (lap) days[day] = { ...days[day], [owner]: { ...lap, at: typeof raw.at === 'number' ? raw.at : 0 } }
      }
    }
    return days
  } catch {
    return {}
  }
}

/** A day's laps written back, KEEP_OWNERS of them at most, and only the last KEEP_DAYS days. */
function writeLaps(days: Record<string, OwnedRuns<KeptLap>>, day: string, laps: OwnedRuns<KeptLap>) {
  const newest = Object.entries(laps)
    .filter((entry): entry is [string, KeptLap] => entry[1] != null)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, KEEP_OWNERS)
  const all = { ...days, [day]: Object.fromEntries(newest) }
  const keep = Object.keys(all).sort().slice(-KEEP_DAYS)
  localStorage.setItem(LAPS_KEY, JSON.stringify({ days: Object.fromEntries(keep.map((d) => [d, all[d]])) }))
}

const toKeep = (lap: GhostLap): KeptLap => ({
  time: lap.time,
  splits: lap.splits,
  ghost: lap.ghost.map((v) => Math.round(v * 100) / 100),
  at: Date.now(),
})

/** Whether a kept lap is this lap: the same time to the sector. */
const sameLap = (kept: GhostLap | null | undefined, lap: GhostLap) =>
  kept != null && kept.time === lap.time && kept.splits.every((at, k) => at === lap.splits[k])

/**
 * Your best lap of a day's track on this device, if you've driven it: the viewer's own (lib/deviceRuns.ts),
 * never another player's. Nothing while the account signed in isn't known yet.
 */
export function keptLap(day: string, viewer: Viewer): GhostLap | null {
  // Laps kept before laps had owners are nobody's: nobody can say whose they were.
  return ownRun(readLaps()[day], viewer)
}

/** A lap kept as `owner`'s best of the day (an account's id, or SIGNED_OUT), over theirs alone. */
function keepLap(day: string, owner: string, lap: GhostLap) {
  try {
    const days = readLaps()
    writeLaps(days, day, { ...days[day], [owner]: toKeep(lap) })
  } catch {
    /* a private window keeps nothing; the lap still counts */
  }
}

/** A test drive's best lap of each track, by whose it is, kept only while the tab is open: a track driven off its day. */
const testLaps = new Map<string, GhostLap>()
const testKey = (owner: string, day: string) => `${owner}|${day}`

/** The viewer's best lap of a day's track: on this device, or in a test drive, in this tab. */
export function bestLapOf(day: string, test: boolean, viewer: Viewer): GhostLap | null {
  if (!test) return keptLap(day, viewer)
  const own = ownKey(viewer)
  return own === undefined ? null : (testLaps.get(testKey(own, day)) ?? null)
}

/** A lap kept as the best of whoever drove it: `owner`, the account signed in as it started, or SIGNED_OUT. */
export function keepBestLap(day: string, test: boolean, owner: string, lap: GhostLap) {
  if (test) testLaps.set(testKey(owner, day), lap)
  else keepLap(day, owner, lap)
}

/**
 * A lap driven signed out, then put on the board by the account signed in on its card: it's that
 * account's from now on. It's their best here if it's faster than the one they had, and the signed-out
 * lap it was is theirs no longer.
 */
export function claimLap(day: string, test: boolean, accountId: string, lap: GhostLap) {
  if (test) {
    const mine = testLaps.get(testKey(accountId, day))
    if (!mine || lap.time < mine.time) testLaps.set(testKey(accountId, day), lap)
    if (sameLap(testLaps.get(testKey(SIGNED_OUT, day)), lap)) testLaps.delete(testKey(SIGNED_OUT, day))
    return
  }
  try {
    const days = readLaps()
    const laps = { ...days[day] }
    const mine = laps[accountId]
    if (!mine || lap.time < mine.time) laps[accountId] = toKeep(lap)
    if (sameLap(laps[SIGNED_OUT], lap)) delete laps[SIGNED_OUT]
    writeLaps(days, day, laps)
  } catch {
    /* a private window keeps nothing; the lap is on the board */
  }
}

/** A day's track, built, and its pace car's lap: a driver that keeps to the middle of the road. */
export type Course = DailyTrack & { track: Track; paceLap: GhostLap }

const courses = new Map<string, Course>()

/** The day's track, worked out once a day: its pace car's lap is the ghost until you have one of your own. */
export function hotlapCourse(day: string): Course {
  let course = courses.get(day)
  if (!course) {
    const daily = dailyTrack(day)
    const track = buildTrack(daily.pieces, daily.shape)
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
