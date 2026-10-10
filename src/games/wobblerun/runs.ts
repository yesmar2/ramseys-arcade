import { standIn } from './boardGhost'
import { BLUE_ROUTES } from './blueRoutes'
import { dailyGauntlet, laidNumber, type DailyGauntlet } from './daily'
import { BLUE_HANDS, liveHands, replayBlue } from './engine/bots'
import { plannedCourse } from './engine/course'
import { labCode, labCourse, labRounds, soloCourse, testGauntlet } from './engine/lab'
import { AIRBORNE, GHOST_RATE, GHOST_STRIDE, GROUNDED, newRun, step } from './engine/sim'
import type { Course, Tier } from './engine/types'
import type { GhostRun } from './runStore'

export * from './runStore'

/*
 * What a run is measured against: the day's gauntlet and its blue blip, and the ghost that runs the run to beat.
 * Your own best runs are kept by runStore.ts.
 */

/** A day's gauntlet, laid, with its plan's word on it. */
export type WobbleDay = DailyGauntlet & { course: Course }

const laidDays = new Map<string, WobbleDay>()
const paces = new Map<string, GhostRun>()

/** The test course's day, an admin's (WobbleRunGame `lab`): not a date, so nothing about it goes on a board. */
export const LAB_DAY = 'lab'

/** The day's gauntlet, laid once a day: the same try the plan kept, so the same gauntlet on every device. */
export function wobbleDay(day: string): WobbleDay {
  let found = laidDays.get(day)
  if (!found) {
    const daily = dailyGauntlet(day)
    found = { ...daily, course: plannedCourse(laidNumber(daily), daily.attempt, daily.k, daily.name) }
    if (laidDays.size > 2) laidDays.clear()
    laidDays.set(day, found)
  }
  return found
}

/**
 * What the test course lays (WobbleRunGame's lab, an admin's, picked on its start card): one round at a tier, alone
 * (engine/lab.ts soloCourse: the start pad and its slide, the round, a checkpoint pad and the star); a test gauntlet,
 * a day-style gauntlet by the newest rules whose `seed` is the day number it's picked and laid as (lab.ts
 * testGauntlet); or every round (lab.ts labCourse: each built round at T1, T2 and T3, then the finale).
 */
export type LabPick = { kind: 'round'; letter: string; tier: Tier } | { kind: 'gauntlet'; seed: number } | { kind: 'all' }

/** The device remembers the last pick (a per-device convenience: nothing else reads it). */
const LAB_PICK_KEY = 'skermix-wobblerun-lab-pick'

/** What the picker starts on, with nothing remembered: the round Ramsey found hard, at its spiciest. */
const FIRST_PICK: LabPick = { kind: 'round', letter: 'n', tier: 3 }

const isTier = (t: unknown): t is Tier => t === 1 || t === 2 || t === 3

/** The pick this device last made (FIRST_PICK if none, or if it names a round there isn't any more). */
export function readLabPick(): LabPick {
  try {
    const p = JSON.parse(localStorage.getItem(LAB_PICK_KEY) ?? 'null') as Partial<{ kind: string; letter: string; tier: number; seed: number }> | null
    if (p?.kind === 'all') return { kind: 'all' }
    if (p?.kind === 'gauntlet' && Number.isInteger(p.seed) && p.seed! > 0) return { kind: 'gauntlet', seed: p.seed! }
    if (p?.kind === 'round' && isTier(p.tier) && labRounds().some((r) => r.letter === p.letter)) return { kind: 'round', letter: p.letter!, tier: p.tier }
  } catch {
    /* a private window keeps nothing: the first pick */
  }
  return FIRST_PICK
}

export function keepLabPick(pick: LabPick): void {
  try {
    localStorage.setItem(LAB_PICK_KEY, JSON.stringify(pick))
  } catch {
    /* not kept: the picker starts on the first pick next time */
  }
}

/** A pick as a word, for the course it lays (and the game's key, so a new pick mounts the game afresh). */
export function labPickKey(pick: LabPick): string {
  return pick.kind === 'round' ? `round:${pick.letter}${pick.tier}` : pick.kind === 'gauntlet' ? `gauntlet:${pick.seed}` : 'all'
}

/** A test gauntlet's seed: a day number well past the plan's, new each time (the shell's randomness, not the engine's). */
export function freshGauntletSeed(): number {
  return 1000 + Math.floor(Math.random() * 9000)
}

/** The round before or after a round pick's (`step` −1 or 1), at its tier, round the picker's list. */
export function labRoundAfter(pick: LabPick & { kind: 'round' }, step: 1 | -1): LabPick & { kind: 'round' } {
  const list = labRounds()
  const at = Math.max(0, list.findIndex((r) => r.letter === pick.letter))
  const next = list[(at + step + list.length) % list.length]!
  return { kind: 'round', letter: next.letter, tier: pick.tier }
}

const labDays = new Map<string, WobbleDay>()

/**
 * The test course for a pick, an admin's (WobbleRunGame `lab`), had as a day's gauntlet is but of no day: no plan, no
 * board, no blue blip (its `pace` is 0 and nothing shows it). Every pick is laid by the newest generation's rules
 * (engine/course.ts LATEST_GEN), so the lab shows what's coming before any day has it.
 */
export function labDay(pick: LabPick = { kind: 'all' }): WobbleDay {
  const key = labPickKey(pick)
  let found = labDays.get(key)
  if (!found) {
    if (pick.kind === 'round') {
      const name = labRounds().find((r) => r.letter === pick.letter)?.name ?? pick.letter
      found = { day: LAB_DAY, n: 0, name, attempt: 0, pace: 0, k: `${pick.letter}${pick.tier}`, course: soloCourse(pick.letter, pick.tier) }
    } else if (pick.kind === 'gauntlet') {
      const course = testGauntlet(pick.seed)
      found = { day: LAB_DAY, n: 0, name: course.name, attempt: 0, pace: 0, k: course.key, course }
    } else found = { day: LAB_DAY, n: 0, name: 'Test Course', attempt: 0, pace: 0, k: labCode(), course: labCourse() }
    if (labDays.size > 3) labDays.clear()
    labDays.set(key, found)
  }
  return found
}

/** A run that waits at the start for `time` seconds: the ghost of a run whose path isn't known, before anything is. */
export function waitingRun(course: Course, time: number): GhostRun {
  const sp = course.spawns[0]!
  return { time, splits: [], ghost: [sp.x, sp.y, sp.z, GROUNDED, sp.x, sp.y, sp.z, GROUNDED] }
}

/**
 * The blue blip's own hands run live, for a day the plan keeps no route for (a day past the routes, or a plan made
 * before them): the same careful hands the plan's route was found with (engine/bots.ts BLUE_HANDS), choosing at
 * each safe spot as they go. Slower to work out than a replay, and only ever the fallback.
 */
function liveBlue(course: Course): GhostRun | null {
  const run = newRun(course, { countdown: 0, quiet: true, ghost: true })
  const hands = liveHands(course, BLUE_HANDS)
  while (!run.done && run.t < 300) step(run, hands.input(run))
  return run.done && run.ghost ? { time: run.time, splits: run.splits.slice(), ghost: run.ghost } : null
}

/**
 * The blue blip's run over the day's gauntlet, the ghost until you have a run of your own, and always alongside:
 * worked out once a day, when it's first wanted. The plan keeps the route its careful hands found (blueRoutes.ts),
 * and the engine replays it here in one pass (engine/bots.ts replayBlue); it's raced along that line in the plan's
 * time (standIn, as Swoop's blue bird is), which its medals, tickets and boards go by.
 */
export function paceOf(day: string): GhostRun {
  let pace = paces.get(day)
  if (!pace) {
    const found = wobbleDay(day)
    const { course, pace: planned } = found
    const route = BLUE_ROUTES[laidNumber(found) - 1]
    const replayed = route ? replayBlue(course, route) : null
    const flown = replayed?.finished ? { time: replayed.time, splits: replayed.splits, ghost: replayed.ghost } : liveBlue(course)
    pace = flown && flown.ghost.length >= GHOST_STRIDE * 2 ? standIn(flown, planned) : waitingRun(course, planned)
    if (paces.size > 2) paces.clear()
    paces.set(day, pace)
  }
  return pace
}

/** The blue blip's run over a day's gauntlet if it has been worked out already, without working it out now. */
export function paceIfRun(day: string): GhostRun | null {
  return paces.get(day) ?? null
}

/**
 * Where a ghost is at a moment: where, which way it faces, its state (engine/sim.ts: grounded, in the air or
 * diving, splatted, knocked over), and whether it has reached the crown.
 */
export type GhostPose = { x: number; y: number; z: number; yaw: number; state: number; done: boolean }

/** Moving less than this between samples, a ghost keeps facing the way it was going. */
const STILL = 0.04
/** A jump further than this between two samples is a respawn: the ghost goes there, never streaking or turning. */
const TELEPORT = 3
/** How far back, in samples, a waiting ghost looks for the way it came (two seconds); past that it faces down the course. */
const LOOK_BACK = 40

/** A ghost run made ready to follow: where it is at any moment; once it has the crown, where it touched it. */
export class Ghost {
  readonly run: GhostRun
  private readonly samples: number

  constructor(run: GhostRun) {
    this.run = run
    this.samples = run.ghost.length / GHOST_STRIDE
  }

  /** Which way the ghost faces at sample i: toward where it goes next, or where it came from when it's waiting. */
  private yawAt(i: number): number {
    const g = this.run.ghost
    const S = GHOST_STRIDE
    const last = this.samples - 1
    for (let d = 1; d <= 6 && i + d <= last; d++) {
      const b = i + d
      const dx = g[b * S]! - g[i * S]!
      const dz = g[b * S + 2]! - g[i * S + 2]!
      const l = Math.hypot(dx, dz)
      if (l > TELEPORT) break
      if (l > STILL * d) return Math.atan2(dx, dz)
    }
    for (let j = i; j > 0 && j > i - LOOK_BACK; j--) {
      const dx = g[j * S]! - g[(j - 1) * S]!
      const dz = g[j * S + 2]! - g[(j - 1) * S + 2]!
      const l = Math.hypot(dx, dz)
      if (l > STILL && l < TELEPORT) return Math.atan2(dx, dz)
    }
    return 0
  }

  at(t: number): GhostPose {
    const g = this.run.ghost
    const S = GHOST_STRIDE
    const last = this.samples - 1
    // Sample k is k / GHOST_RATE from GO; the last is the crown's moment, the run's time.
    let at = Math.max(0, t * GHOST_RATE)
    if (last >= 1 && at > last - 1) {
      const from = (last - 1) / GHOST_RATE
      const span = this.run.time - from
      at = span > 0 && t < this.run.time ? last - 1 + (t - from) / span : last
    }
    if (at >= last) return { x: g[last * S]!, y: g[last * S + 1]!, z: g[last * S + 2]!, yaw: this.yawAt(last), state: g[last * S + 3]!, done: true }
    const i = Math.floor(at)
    const k = i * S
    const n = k + S
    // Across a respawn it stays put until the drop, then is there.
    const jump = Math.hypot(g[n]! - g[k]!, g[n + 1]! - g[k + 1]!, g[n + 2]! - g[k + 2]!) > TELEPORT
    const f = jump ? 0 : at - i
    return {
      x: g[k]! + (g[n]! - g[k]!) * f,
      y: g[k + 1]! + (g[n + 1]! - g[k + 1]!) * f,
      z: g[k + 2]! + (g[n + 2]! - g[k + 2]!) * f,
      yaw: this.yawAt(i),
      state: g[k + 3] ?? AIRBORNE,
      done: false,
    }
  }
}
