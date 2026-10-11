/**
 * The test lab's courses (`?lab=1`, an admin's, picked on its start card: TestCards.tsx LabStartCard), so Ramsey can
 * try things on his phone and pick what goes in the daily deck (design-final §8.1). None is a day's: no plan, no
 * board, no blue bean. All are laid by the newest rules (course.ts LATEST_GEN), so a round's gen-2 changes show here
 * before any day has them, and from the round registry, so a round shows up as soon as its module drops `stub`.
 *
 * labCourse is every built round at T1, T2 and T3 in a row, a checkpoint pad before each, then the finale.
 * soloCourse lays one round on its own: for the picker's "one round", and for measuring it
 * (scripts/wobblerun-difficulty.mjs and the round engineers' own scripts). testGauntlet is a day-style gauntlet by
 * the newest rules, for the picker's "Test gauntlet". labRounds is the picker's list.
 */
import { assemble, codeOf, courseFromCode, courseName, LATEST_GEN, plannedCourse, THEMES, type RoundSpec } from './course.ts'
import { pickRounds } from './plan.ts'
import { hashString } from './rng.ts'
import { isFinale, ROUNDS } from './rounds/index.ts'
import { stubBuild } from './rounds/stub.ts'
import type { Course, Gen, RoundDef, Run, Tier } from './types.ts'

export type LabOptions = {
  /** Only these rounds (letters, in this order); all the built ones by default. */
  letters?: string
  /** These tiers of each (1, 2 and 3 by default). */
  tiers?: readonly Tier[]
  /** Stand-in rounds too. */
  stubs?: boolean
  /** The finale and its tier (the first built finale, T2, by default). */
  finale?: string
  /** A seed of its own (the same course every time by default). */
  seed?: string | number
  /** The generation to lay it by (the newest, course.ts LATEST_GEN, by default). */
  gen?: Gen
}

/** The lab's round code. */
export function labCode(o: LabOptions = {}): string {
  const tiers = o.tiers ?? ([1, 2, 3] as const)
  const pool = ROUNDS.filter((r) => r.family !== 'finale' && (o.stubs || !r.stub))
  const chosen = o.letters ? [...o.letters].map((l) => pool.find((r) => r.letter === l)).filter((r) => !!r) : pool
  const specs: RoundSpec[] = []
  for (const r of chosen) for (const tier of tiers) specs.push({ letter: r!.letter, tier })
  const finale = o.finale ?? `${(ROUNDS.find((r) => r.family === 'finale' && !r.stub) ?? ROUNDS.find((r) => r.family === 'finale'))!.letter}2`
  return codeOf(specs) + finale
}

/** The lab course. */
export function labCourse(o: LabOptions = {}): Course {
  return courseFromCode(labCode(o), o.seed ?? 'lab', 'Test Course', o.gen ?? LATEST_GEN)
}

/**
 * The rounds the lab's picker offers, in its order (the registry's): every built round, then the finales. Their
 * `name` and `hint` are the ones players see (README "Names players see").
 */
export function labRounds(o: { stubs?: boolean } = {}): RoundDef[] {
  return ROUNDS.filter((r) => o.stubs || !r.stub)
}

/**
 * A test gauntlet (the lab's "Test gauntlet"): day `n`'s rounds picked as the plan picks a day's (plan.ts pickRounds:
 * the slot rules at the weekday's heat, by the generation's own heat table, with no days before it for the variety
 * rules), laid by that generation as the plan's first try at day n would be, theme and name and all. The rounds of
 * our own are in its deck (plan.ts OURS) while they wait for Ramsey's word, so a test gauntlet is what a day could
 * be once they're in. It's checked by nothing (no blue blip, no phone runs): a look at what a day of the new rules
 * comes to. Any n gives one; the lab draws a new one each time.
 */
export function testGauntlet(n: number, gen: Gen = LATEST_GEN): Course {
  const k = pickRounds(n, [], { gen, ours: true })
  return plannedCourse(n, 0, k, courseName(n, 0), gen)
}

/** The rounds the lab has in it, by name, for its start card ("Slam Doors, Pad Hop and Star Peak"). */
export function labRoundNames(o: LabOptions = {}): string[] {
  const code = labCode(o)
  const seen: string[] = []
  for (const m of code.matchAll(/([A-Za-z])[123]/g)) {
    const name = ROUNDS.find((r) => r.letter === m[1])?.name
    if (name && !seen.includes(name)) seen.push(name)
  }
  return seen
}

/**
 * The plain stretches a solo course lays round its round (stub.ts): a finish after it (a short floor, the star on a
 * pedestal, a hop into it), or before a finale a lead-in (a short floor), so the finale has the checkpoint pad its
 * slime starts at. Nothing on either can touch a bean.
 */
const SOLO_FINISH: RoundDef = { letter: 'Z', name: 'Finish', hint: 'grab the star', family: 'finale', phase: 1, stub: true, build: (slot, _rng, tier) => stubBuild(slot, tier, 'Finish') }
const SOLO_LEAD_IN: RoundDef = { letter: 'Y', name: 'Lead-in', hint: 'run on', family: 'connector', phase: 1, stub: true, build: (slot, _rng, tier) => stubBuild(slot, tier, 'Lead-in') }

export type SoloOptions = {
  /** Its seed (as courseFromCode's: the round is laid as `courseFromCode(letter + tier, seed)` lays its first). */
  seed?: string | number
  /** The generation to lay it by (the newest, course.ts LATEST_GEN, by default). */
  gen?: Gen
  /** A round module to lay instead of the registry's (a round before it's registered). */
  def?: RoundDef
}

/**
 * One round on its own, to measure it: the start pad and its slide, the round, a checkpoint pad, and a plain finish
 * (a finale instead gets a plain lead-in and the checkpoint pad before it, and ends at its own star). The round under
 * test is `course.rounds[soloIndex(course)]`: 0, or 1 for a finale. Everything else on the course is flat and
 * safe, so a bot's time between the round's start and leaving it (onto the pad after, or at the star) is the
 * round's alone. A non-finale round is laid exactly as courseFromCode lays the first round of `letter + tier`
 * with the same seed. It has no ups and downs at any generation (course.ts AssembleOpts `ups`): what joins its
 * round to the rest is gen 1's, so a solo course differs between generations only where its round does.
 */
export function soloCourse(letter: string, tier: Tier, o: SoloOptions = {}): Course {
  const seed = o.seed ?? 'lab'
  const finale = o.def ? o.def.family === 'finale' : isFinale(letter)
  const round: RoundSpec = o.def ? { letter, tier, def: o.def } : { letter, tier }
  const specs: RoundSpec[] = finale ? [{ letter: SOLO_LEAD_IN.letter, tier: 1, def: SOLO_LEAD_IN }, round] : [round, { letter: SOLO_FINISH.letter, tier: 1, def: SOLO_FINISH }]
  return assemble(specs, {
    key: codeOf(specs),
    // The name on the start arch, as players know the round (the lab plays solo courses too): "Gust Gaps T3".
    name: `${(o.def ?? ROUNDS.find((r) => r.letter === letter))?.name ?? letter} T${tier}`,
    n: 0,
    attempt: 0,
    theme: THEMES[hashString(String(seed)) % THEMES.length]!,
    seedOf: (i) => (specs[i] === round ? `lab:${seed}:${letter}${tier}:0` : `lab:${seed}:${specs[i]!.letter}:solo`),
    seed: `lab:${seed}`,
    gen: o.gen ?? LATEST_GEN,
    ups: false,
  })
}

/** Which of a solo course's rounds is the one under test (the other is its plain finish or lead-in). */
export function soloIndex(course: Course): number {
  return course.rounds[0]!.letter === SOLO_LEAD_IN.letter && course.rounds.length > 1 ? 1 : 0
}

/** When a run was in a round: `enter` and `exit` (run clock, s), NaN until it happened. */
export type RoundTimer = { enter: number; exit: number; tick(run: Run): void }

/**
 * Times a run through round `i` of its course (a solo course's round under test by default): call `tick(run)` after
 * every step (the bots' `onStep`). `enter` is the first moment the bean was past the round's start, `exit` the first
 * it stood on what comes after the round (the pad or slide after it) or, in a finale, touched the star.
 */
export function roundTimer(course: Course, i = soloIndex(course)): RoundTimer {
  const r = course.rounds[i]!
  const finale = i === course.rounds.length - 1 && course.graph.goal.startsWith(`${i}:`)
  const timer: RoundTimer = {
    enter: NaN,
    exit: NaN,
    tick(run: Run) {
      const b = run.bean
      if (timer.enter !== timer.enter) {
        if (b.dead <= 0 && b.z >= r.z0) timer.enter = run.t
        return
      }
      if (timer.exit === timer.exit) return
      if (finale) {
        if (run.done) timer.exit = run.time
      } else if (b.dead <= 0 && b.ground >= 0 && course.solids[b.ground]!.round > i) timer.exit = run.t
    },
  }
  return timer
}
