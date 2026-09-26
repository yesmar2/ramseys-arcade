import { botLap, buildTrack, GHOST_RATE, lapDistance, nearest, type GhostPath, type Track } from './sim'

/*
 * What a lap is measured against: the medal times, the pace car, and your own best lap, kept on the
 * device with where the car was all the way round so it can be driven again as the ghost.
 */

/*
 * Gold beats a driver cornering at the very limit down the middle of the road (51.1s), which takes
 * using the whole road; silver is about the pace car (53.4s); bronze is a tidy lap with a mistake in it.
 */
export const MEDALS = [
  { name: 'Gold', time: 50 },
  { name: 'Silver', time: 53.5 },
  { name: 'Bronze', time: 58 },
] as const
export type Medal = (typeof MEDALS)[number]

export function medalFor(time: number | null | undefined): Medal | null {
  return MEDALS.find((m) => time != null && time <= m.time) ?? null
}

/** A lap as the ghost drives it: its time, where each sector ended, and where the car was. */
export type GhostLap = { time: number; splits: number[]; ghost: GhostPath }

/* Not a score: the board keeps that. This is only the best lap's path, for its ghost, on this device. */
const LAP_KEY = 'skermix-hotlap-lap'

export function keptLap(): GhostLap | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LAP_KEY) ?? 'null') as Partial<GhostLap> | null
    if (!raw || typeof raw.time !== 'number' || !(raw.time > 20 && raw.time < 600)) return null
    if (!Array.isArray(raw.splits) || raw.splits.length !== 3 || !raw.splits.every(Number.isFinite)) return null
    if (!Array.isArray(raw.ghost) || raw.ghost.length < 30 || raw.ghost.length % 3 !== 0 || !raw.ghost.every(Number.isFinite)) return null
    return { time: raw.time, splits: raw.splits, ghost: raw.ghost }
  } catch {
    return null
  }
}

export function keepLap(lap: GhostLap) {
  try {
    const ghost = lap.ghost.map((v) => Math.round(v * 100) / 100)
    localStorage.setItem(LAP_KEY, JSON.stringify({ time: lap.time, splits: lap.splits, ghost }))
  } catch {
    /* a private window keeps nothing; the lap still counts */
  }
}

let course: { track: Track; pace: GhostLap } | null = null

/**
 * The track, and the pace car's lap: a driver that keeps to the middle of the road. Its lap is the
 * ghost until you have one of your own. Worked out once, the first time the game opens.
 */
export function hotlapCourse() {
  if (!course) {
    const track = buildTrack()
    const bot = botLap(track)
    course = { track, pace: { time: bot.time ?? 60, splits: bot.splits, ghost: bot.ghost } }
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
