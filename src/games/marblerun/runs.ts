import { dailyCourse, laidNumber, type DailyCourse } from './daily'
import type { GhostRun } from './runStore'
import { GHOST_RATE, labCourse, paceRun, plannedCourse, type Course } from './sim'

export * from './runStore'

/*
 * What a run is measured against: the day's course and its pace ball, and the ghost that rolls the run to
 * beat. Your own best runs are kept by runStore.ts.
 */

/** A day's course, laid, with its plan's word on it. */
export type MarbleDay = DailyCourse & { course: Course }

const laidDays = new Map<string, MarbleDay>()
const paces = new Map<string, GhostRun>()

/** The day's course, laid once a day: the same try the plan kept, so the same course on every device. */
export function marbleDay(day: string): MarbleDay {
  let found = laidDays.get(day)
  if (!found) {
    const daily = dailyCourse(day)
    found = { ...daily, course: plannedCourse(laidNumber(daily), daily.attempt) }
    if (laidDays.size > 2) laidDays.clear()
    laidDays.set(day, found)
  }
  return found
}

let lab: MarbleDay | null = null

/**
 * The test track of new pieces (sim.ts labCourse), an admin's (MarbleRunGame `lab`), as a day's course is had
 * but of no day: no plan, no board, no blue ball (its `pace` is 0 and nothing shows it).
 */
export function labDay(): MarbleDay {
  return (lab ??= { day: 'lab', n: 0, name: 'Test Track', attempt: 0, pace: 0, course: labCourse() })
}

/**
 * The pace ball's run down the day's course, the ghost until you have a run of your own: rolled once a day,
 * when it's first wanted (it takes a moment on a phone).
 */
export function paceOf(day: string): GhostRun {
  let pace = paces.get(day)
  if (!pace) {
    const { course, pace: planned } = marbleDay(day)
    const run = paceRun(course)
    pace = { time: run.finished ? run.time : planned, splits: run.splits, ghost: run.ghost }
    if (paces.size > 2) paces.clear()
    paces.set(day, pace)
  }
  return pace
}

/** A ghost run made ready to follow: where it is at any moment; once it's done, where it finished. */
export class Ghost {
  readonly run: GhostRun
  private readonly samples: number

  constructor(run: GhostRun) {
    this.run = run
    this.samples = run.ghost.length / 3
  }

  at(t: number): { x: number; y: number; z: number; done: boolean } {
    const g = this.run.ghost
    const at = Math.max(0, t * GHOST_RATE)
    const last = this.samples - 1
    if (at >= last) return { x: g[last * 3]!, y: g[last * 3 + 1]!, z: g[last * 3 + 2]!, done: true }
    const i = Math.floor(at)
    const f = at - i
    const k = i * 3
    return {
      x: g[k]! + (g[k + 3]! - g[k]!) * f,
      y: g[k + 1]! + (g[k + 4]! - g[k + 1]!) * f,
      z: g[k + 2]! + (g[k + 5]! - g[k + 2]!) * f,
      done: false,
    }
  }
}
