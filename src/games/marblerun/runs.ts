import { ownKey, ownRun, SIGNED_OUT, type OwnedRuns, type Viewer } from '../../lib/deviceRuns'
import { dailyCourse, laidNumber, type DailyCourse } from './daily'
import { GHOST_RATE, paceRun, plannedCourse, type Course } from './sim'

/*
 * What a run is measured against: the day's course, its pace ball, and your own best run down it, kept on
 * the device with where the marble was all the way down so it can roll again as the ghost.
 */

/** A run as its ghost rolls it: its time, when it crossed each checkpoint and the goal, and where it was. */
export type GhostRun = { time: number; splits: number[]; ghost: number[] }

/*
 * Not a score: the board keeps that. This is only each day's best run and its path, for the ghost, on this
 * device, and only the last few days: a day's run is no use on another day's course.
 *
 * Each player who rolls here has a best run of their own (lib/deviceRuns.ts): a run is kept under whoever
 * was signed in as it started, or signed out, so one player's run is never another's ghost, and never kept
 * over theirs.
 */
const RUNS_KEY = 'skermix-marblerun-runs'
const KEEP_DAYS = 3
/** A run and its path come to some 40 KB: a day keeps the runs of this many players, dropping the oldest. */
const KEEP_OWNERS = 4

type KeptRun = GhostRun & { at: number }

function validRun(raw: Partial<GhostRun> | null | undefined): GhostRun | null {
  if (!raw || typeof raw.time !== 'number' || !(raw.time > 10 && raw.time < 900)) return null
  if (!Array.isArray(raw.splits) || raw.splits.length < 1 || !raw.splits.every(Number.isFinite)) return null
  if (!Array.isArray(raw.ghost) || raw.ghost.length < 30 || raw.ghost.length % 3 !== 0 || !raw.ghost.every(Number.isFinite)) return null
  return { time: raw.time, splits: raw.splits, ghost: raw.ghost }
}

/** Each day's best runs on this device, by whose they are: an account's id, or SIGNED_OUT. */
function readRuns(): Record<string, OwnedRuns<KeptRun>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUNS_KEY) ?? 'null') as { days?: Record<string, Record<string, Partial<KeptRun>> | null> } | null
    const days: Record<string, OwnedRuns<KeptRun>> = {}
    for (const [day, runs] of Object.entries(parsed?.days ?? {})) {
      for (const [owner, raw] of Object.entries(runs ?? {})) {
        const run = validRun(raw)
        if (run) days[day] = { ...days[day], [owner]: { ...run, at: typeof raw.at === 'number' ? raw.at : 0 } }
      }
    }
    return days
  } catch {
    return {}
  }
}

/** A day's runs written back, KEEP_OWNERS of them at most, and only the last KEEP_DAYS days. */
function writeRuns(days: Record<string, OwnedRuns<KeptRun>>, day: string, runs: OwnedRuns<KeptRun>) {
  const newest = Object.entries(runs)
    .filter((entry): entry is [string, KeptRun] => entry[1] != null)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, KEEP_OWNERS)
  const all = { ...days, [day]: Object.fromEntries(newest) }
  const keep = Object.keys(all).sort().slice(-KEEP_DAYS)
  localStorage.setItem(RUNS_KEY, JSON.stringify({ days: Object.fromEntries(keep.map((d) => [d, all[d]])) }))
}

const toKeep = (run: GhostRun): KeptRun => ({
  time: run.time,
  splits: run.splits,
  ghost: run.ghost.map((v) => Math.round(v * 100) / 100),
  at: Date.now(),
})

const sameRun = (kept: GhostRun | null | undefined, run: GhostRun) =>
  kept != null && kept.time === run.time && kept.splits.every((at, k) => at === run.splits[k])

/** Your best run of a day's course on this device: the viewer's own, never another player's. */
export function keptRun(day: string, viewer: Viewer): GhostRun | null {
  return ownRun(readRuns()[day], viewer)
}

/** A run kept as the best of whoever rolled it: `owner`, the account signed in as it started, or SIGNED_OUT. */
export function keepBestRun(day: string, owner: string, run: GhostRun) {
  try {
    const days = readRuns()
    writeRuns(days, day, { ...days[day], [owner]: toKeep(run) })
  } catch {
    /* a private window keeps nothing; the run still counts */
  }
}

/**
 * A run rolled signed out, then put on the board by the account signed in on its card: it's that account's
 * from now on, its best here if it's faster than the one it had, and the signed-out run it was is gone.
 */
export function claimRun(day: string, accountId: string, run: GhostRun) {
  try {
    const days = readRuns()
    const runs = { ...days[day] }
    const mine = runs[accountId]
    if (!mine || run.time < mine.time) runs[accountId] = toKeep(run)
    if (sameRun(runs[SIGNED_OUT], run)) delete runs[SIGNED_OUT]
    writeRuns(days, day, runs)
  } catch {
    /* a private window keeps nothing; the run is on the board */
  }
}

/** A past day's best practice run (from the archive), by whose it is: kept only while the tab is open. */
const practiceRuns = new Map<string, GhostRun>()
const practiceKey = (owner: string, day: string) => `${owner}|${day}`

/** The viewer's best practice run of a past day's course, in this tab. */
export function practiceBest(day: string, viewer: Viewer): GhostRun | null {
  const own = ownKey(viewer)
  return own === undefined ? null : (practiceRuns.get(practiceKey(own, day)) ?? null)
}

export function keepPracticeRun(day: string, owner: string, run: GhostRun) {
  practiceRuns.set(practiceKey(owner, day), run)
}

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
