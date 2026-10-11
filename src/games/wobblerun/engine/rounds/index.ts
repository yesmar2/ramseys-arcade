/**
 * Every round, by its letter in a gauntlet's code (dailyPlan.ts `k`), its module, and the name players see (its
 * ROUND's `name` and `hint`, display only: nothing that lays or runs a course reads them): g gateCrash Slam Doors,
 * b blockParty Wall Rush, s spinClub Sweeper Spin, h hitParade Bonk Alley, f fruitChute Melon Hill, w seeSaw Tippy
 * Planks, x hexDrop Crumble Tiles, l lilyLeapers Pad Hop, r rollOn Barrel Roll, n bigFans Gust Gaps; the rounds
 * of our own (2026-10-09, phase 2 until Ramsey has played them) v fizzGeysers Fizz Geysers, p pianoSteps Piano
 * Steps, k pinballTable Pinball Table, e candyLifts Candy Lifts, t blipBounce Blip Bounce, d sprinkleDrop Sprinkle
 * Drop; the finales C crownPeak Star Peak and S slimeClimb Tide Tower. The modules keep the names they were built
 * under. A round still `stub` lays a safe stand-in (stub.ts) so a course with it in still runs.
 */
import type { RoundDef } from '../types.ts'
import { ROUND as bigFans } from './bigFans.ts'
import { ROUND as blipBounce } from './blipBounce.ts'
import { ROUND as blockParty } from './blockParty.ts'
import { ROUND as candyLifts } from './candyLifts.ts'
import { ROUND as crownPeak } from './crownPeak.ts'
import { ROUND as fizzGeysers } from './fizzGeysers.ts'
import { ROUND as fruitChute } from './fruitChute.ts'
import { ROUND as gateCrash } from './gateCrash.ts'
import { ROUND as hexDrop } from './hexDrop.ts'
import { ROUND as hitParade } from './hitParade.ts'
import { ROUND as lilyLeapers } from './lilyLeapers.ts'
import { ROUND as pianoSteps } from './pianoSteps.ts'
import { ROUND as pinballTable } from './pinballTable.ts'
import { ROUND as rollOn } from './rollOn.ts'
import { ROUND as seeSaw } from './seeSaw.ts'
import { ROUND as slimeClimb } from './slimeClimb.ts'
import { ROUND as spinClub } from './spinClub.ts'
import { ROUND as sprinkleDrop } from './sprinkleDrop.ts'

/** The rounds in the order the lab lays them, then the finales. */
export const ROUNDS: readonly RoundDef[] = [
  gateCrash, blockParty, spinClub, hitParade, fruitChute, seeSaw, hexDrop, lilyLeapers, rollOn, bigFans,
  fizzGeysers, pianoSteps, pinballTable, candyLifts, blipBounce, sprinkleDrop,
  crownPeak, slimeClimb,
]

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
