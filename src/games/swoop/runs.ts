import { standIn } from './boardGhost'
import { dailyHills, laidNumber, type DailyHills } from './daily'
import type { GhostRun } from './runStore'
import { GHOST_RATE, GHOST_STRIDE, HOLD, paceRun, plannedHills, type Hills } from './sim'

export * from './runStore'

/*
 * What a run is measured against: the day's hills and their blue bird, and the ghost that flies the run to
 * beat. Your own best runs are kept by runStore.ts.
 */

/** A day's hills, laid, with their plan's word on them. */
export type SwoopDay = DailyHills & { hills: Hills }

const laidDays = new Map<string, SwoopDay>()
const paces = new Map<string, GhostRun>()

/** The day's hills, laid once a day: the same try the plan kept, so the same hills on every device. */
export function swoopDay(day: string): SwoopDay {
  let found = laidDays.get(day)
  if (!found) {
    const daily = dailyHills(day)
    found = { ...daily, hills: plannedHills(laidNumber(daily), daily.attempt) }
    if (laidDays.size > 2) laidDays.clear()
    laidDays.set(day, found)
  }
  return found
}

/**
 * The blue bird's run over the day's hills, the ghost until you have a run of your own: flown once a day,
 * when it's first wanted (it takes a moment on a phone). Its hands fly the line, and it's raced along that
 * line in the plan's time, 10% quicker (sim.ts BLUE_PACE), which its medals, tickets and boards go by.
 */
export function paceOf(day: string): GhostRun {
  let pace = paces.get(day)
  if (!pace) {
    const { hills, pace: planned } = swoopDay(day)
    const run = paceRun(hills)
    const flown = { time: run.time, splits: run.splits, ghost: run.ghost }
    pace = run.finished ? standIn(flown, planned) : { ...flown, time: planned }
    if (paces.size > 2) paces.clear()
    paces.set(day, pace)
  }
  return pace
}

/** The blue bird's run over a day's hills if it has flown already, without flying it now. */
export function paceIfFlown(day: string): GhostRun | null {
  return paces.get(day) ?? null
}

/** Where a ghost is at a moment: where, which way it's headed, whether it's diving, and whether it's over the line. */
export type GhostPose = { x: number; y: number; a: number; dive: boolean; done: boolean }

/** A ghost run made ready to follow: where it is at any moment; once it's over the line, where it crossed. */
export class Ghost {
  readonly run: GhostRun
  private readonly samples: number

  constructor(run: GhostRun) {
    this.run = run
    this.samples = run.ghost.length / GHOST_STRIDE
  }

  at(t: number): GhostPose {
    const g = this.run.ghost
    const S = GHOST_STRIDE
    const at = Math.max(0, t * GHOST_RATE)
    const last = this.samples - 1
    if (at >= last) return { x: g[last * S]!, y: g[last * S + 1]!, a: 0, dive: false, done: true }
    const i = Math.floor(at)
    const k = i * S
    const f = at - i
    const x = g[k]! + (g[k + S]! - g[k]!) * f
    const y = g[k + 1]! + (g[k + S + 1]! - g[k + 1]!) * f
    // Headed where the next sample is, so on the hill it leans with the slope, in the air with its flight.
    const n = Math.min(last, i + 2) * S
    return { x, y, a: Math.atan2(g[n + 1]! - y, Math.max(0.01, g[n]! - x)), dive: g[k + 2] === HOLD, done: false }
  }
}
