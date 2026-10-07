import { dailyCave, laidNumber, type DailyCave } from './daily'
import type { GhostRun } from './runStore'
import { ENGINE_OFF, ENGINE_ON, GHOST_RATE, GHOST_STRIDE, labCave, paceRun, plannedCave, WRECKED, wrap, type Cave } from './sim'

export * from './runStore'

/*
 * What a run is measured against: the day's cave and its blue ship, and the ghost that flies the run to beat.
 * Your own best runs are kept by runStore.ts.
 */

/** A day's cave, dug, with its plan's word on it. */
export type LanderDay = DailyCave & { cave: Cave }

const dugDays = new Map<string, LanderDay>()
const paces = new Map<string, GhostRun>()

/**
 * The test cave's day: not a date. The test cave (sim.ts labCave) has every new kind of thing in it, for an
 * admin to fly at /games/lander/play?lab=1; its runs are saved nowhere, and there's no blue ship to race.
 */
export const LAB_DAY = 'lab'

/** The day's cave, dug once a day: the same try the plan kept, so the same cave on every device. */
export function landerDay(day: string): LanderDay {
  let found = dugDays.get(day)
  if (!found) {
    const daily = day === LAB_DAY ? { day, n: 0, name: 'Test Cave', attempt: 0, pace: 0 } : dailyCave(day)
    found = { ...daily, cave: day === LAB_DAY ? labCave() : plannedCave(laidNumber(daily), daily.attempt) }
    if (dugDays.size > 2) dugDays.clear()
    dugDays.set(day, found)
  }
  return found
}

/**
 * The blue ship's run down the day's cave, the ghost until you have a run of your own: flown once a day, when
 * it's first wanted (it takes a moment on a phone).
 */
export function paceOf(day: string): GhostRun {
  let pace = paces.get(day)
  if (!pace && day === LAB_DAY) {
    // No blue ship flies the test cave: a run that sits on the start pad stands in for one.
    const { x, y } = landerDay(day).cave.spawn
    pace = { time: 0, splits: [], ghost: [x, y, 0, ENGINE_OFF, x, y, 0, ENGINE_OFF] }
    paces.set(day, pace)
  }
  if (!pace) {
    const { cave, pace: planned } = landerDay(day)
    const run = paceRun(cave)
    pace = { time: run.landed ? run.time : planned, splits: run.splits, ghost: run.ghost }
    if (paces.size > 2) paces.clear()
    paces.set(day, pace)
  }
  return pace
}

/** The blue ship's run down a day's cave if it has flown already, without flying it now. */
export function paceIfFlown(day: string): GhostRun | null {
  return paces.get(day) ?? null
}

/** Where a ghost is at a moment: its pose, whether its engine is lit, whether it's a wreck, and whether it's down. */
export type GhostPose = { x: number; y: number; a: number; engine: boolean; wrecked: boolean; done: boolean }

/** Farther than this between two samples is a crash's ship put back at its gate: it jumps, never glides. */
const JUMP = 8

/** A ghost run made ready to follow: where it is at any moment; once it's down, where it landed. */
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
    if (at >= last) return { x: g[last * S]!, y: g[last * S + 1]!, a: 0, engine: false, wrecked: false, done: true }
    const i = Math.floor(at)
    const k = i * S
    const f = at - i
    const wrecked = g[k + 3] === WRECKED
    const jump = Math.hypot(g[k + S]! - g[k]!, g[k + S + 1]! - g[k + 1]!) > JUMP
    const u = jump ? 0 : f
    return {
      x: g[k]! + (g[k + S]! - g[k]!) * u,
      y: g[k + 1]! + (g[k + S + 1]! - g[k + 1]!) * u,
      a: g[k + 2]! + wrap(g[k + S + 2]! - g[k + 2]!) * u,
      engine: g[k + 3] === ENGINE_ON,
      wrecked,
      done: false,
    }
  }
}
