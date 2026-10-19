import { BLUE_ROUTES } from './blueRoutes'
import { standIn } from './boardGhost'
import { dailyTower, laidNumber, type DailyTower } from './daily'
import type { GhostRun } from './runStore'
import { climbWith, FLOATING, FLYING, GHOST_RATE, GHOST_STRIDE, labTower, paceRun, plannedTower, replayHands, type Tower } from './sim'

export * from './runStore'

/*
 * What a run is measured against: the day's tower and its blue blip, and the ghost that climbs the run to beat.
 * Your own best runs are kept by runStore.ts.
 */

/** A day's tower, laid, with its plan's word on it. */
export type SlingDay = DailyTower & { tower: Tower }

const laidDays = new Map<string, SlingDay>()
const paces = new Map<string, GhostRun>()

/** The test tower's day, an admin's (SlingGame `lab`): not a date, so nothing about it goes on a board. */
export const LAB_DAY = 'lab'

/** The test tower: every section once, on a new tower each time the page loads (sim.ts labTower). */
function labDay(): SlingDay {
  const tower = labTower(1 + Math.floor(Math.random() * 1_000_000))
  return { day: LAB_DAY, n: 0, name: 'Test tower', attempt: 0, pace: 0, tower }
}

/** The day's tower, laid once a day: the same try the plan kept, so the same tower on every device. */
export function slingDay(day: string): SlingDay {
  let found = laidDays.get(day)
  if (!found && day === LAB_DAY) {
    found = labDay()
    laidDays.set(day, found)
  }
  if (!found) {
    const daily = dailyTower(day)
    found = { ...daily, tower: plannedTower(laidNumber(daily), daily.attempt) }
    if (laidDays.size > 2) laidDays.clear()
    laidDays.set(day, found)
  }
  return found
}

/**
 * The blue blip's climb up the day's tower, the ghost until you have a run of your own. The plan keeps its
 * flings (blueRoutes.ts), so it's flown again here in a moment; on the test tower it's worked out (a few
 * seconds, the first time it's wanted). Its medals, tickets and boards go by the plan's time.
 */
export function paceOf(day: string): GhostRun {
  let pace = paces.get(day)
  if (!pace) {
    const sling = slingDay(day)
    const route = day === LAB_DAY ? null : BLUE_ROUTES[laidNumber(sling) - 1]
    const run = route ? climbWith(sling.tower, replayHands(route)) : paceRun(sling.tower)
    const flown = { time: run.time, splits: run.splits, ghost: run.ghost }
    if (day === LAB_DAY) sling.pace = run.finished ? run.time : 60
    pace = run.finished ? (day === LAB_DAY ? flown : standIn(flown, sling.pace)) : { ...flown, time: sling.pace }
    if (paces.size > 2) paces.clear()
    paces.set(day, pace)
  }
  return pace
}

/** The blue blip's climb if it's been flown already, without flying it now. */
export function paceIfFlown(day: string): GhostRun | null {
  return paces.get(day) ?? null
}

/** Where a ghost is at a moment: where, whether it's in the air or floating back, and whether it's at the top. */
export type GhostPose = { x: number; y: number; flying: boolean; floating: boolean; done: boolean }

/** A ghost run made ready to follow: where it is at any moment; once it's at the top, where it finished. */
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
    if (last < 0) return { x: 180, y: 0, flying: false, floating: false, done: true }
    if (at >= last) return { x: g[last * S]!, y: g[last * S + 1]!, flying: false, floating: false, done: true }
    const i = Math.floor(at)
    const k = i * S
    const f = at - i
    return {
      x: g[k]! + (g[k + S]! - g[k]!) * f,
      y: g[k + 1]! + (g[k + S + 1]! - g[k + 1]!) * f,
      flying: g[k + 2] === FLYING,
      floating: g[k + 2] === FLOATING,
      done: false,
    }
  }
}
