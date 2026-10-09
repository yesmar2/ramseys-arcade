/**
 * Every round, by its letter in a gauntlet's code (dailyPlan.ts `k`): g Gate Crash, b Block Party, s Spin Club,
 * h Hit Parade, f Fruit Chute, w See-Saw, x Hex Drop, l Lily Leapers, r Roll On, n Big Fans; the finales C Crown
 * Peak and S Slime Climb. A round still `stub` lays a safe stand-in (stub.ts) so a course with it in still runs.
 */
import type { RoundDef } from '../types.ts'
import { ROUND as bigFans } from './bigFans.ts'
import { ROUND as blockParty } from './blockParty.ts'
import { ROUND as crownPeak } from './crownPeak.ts'
import { ROUND as fruitChute } from './fruitChute.ts'
import { ROUND as gateCrash } from './gateCrash.ts'
import { ROUND as hexDrop } from './hexDrop.ts'
import { ROUND as hitParade } from './hitParade.ts'
import { ROUND as lilyLeapers } from './lilyLeapers.ts'
import { ROUND as rollOn } from './rollOn.ts'
import { ROUND as seeSaw } from './seeSaw.ts'
import { ROUND as slimeClimb } from './slimeClimb.ts'
import { ROUND as spinClub } from './spinClub.ts'

/** The rounds in the order the lab lays them, then the finales. */
export const ROUNDS: readonly RoundDef[] = [gateCrash, blockParty, spinClub, hitParade, fruitChute, seeSaw, hexDrop, lilyLeapers, rollOn, bigFans, crownPeak, slimeClimb]

const BY_LETTER = new Map(ROUNDS.map((r) => [r.letter, r]))

/** The finales' letters (uppercase). */
export const FINALES = 'CS'

/** Round `letter`'s module; throws for a letter that isn't one. */
export function roundDef(letter: string): RoundDef {
  const def = BY_LETTER.get(letter)
  if (!def) throw new Error(`Wobble Run: no round '${letter}'`)
  return def
}

export function isFinale(letter: string): boolean {
  return FINALES.includes(letter)
}
