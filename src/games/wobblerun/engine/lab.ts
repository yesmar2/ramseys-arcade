/**
 * The test course (`?lab=1`, an admin's): every round that's built, at T1, T2 and T3 in a row, a checkpoint pad
 * before each, then the finale, so Ramsey can play them all on his phone and pick what goes in the daily deck
 * (design-final §8.1). It's laid from the round registry, so a round shows up here as soon as its module drops
 * `stub`. It's no day's: no plan, no board, no blue bean.
 */
import { codeOf, courseFromCode, type RoundSpec } from './course.ts'
import { ROUNDS } from './rounds/index.ts'
import type { Course, Tier } from './types.ts'

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
  return courseFromCode(labCode(o), o.seed ?? 'lab', 'Test Course')
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
