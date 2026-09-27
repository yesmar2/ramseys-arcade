import { BANK_JOB } from './bankJob.ts'
import { BUMPS_AND_BANKS } from './bumpsBanks.ts'
import { LONG_WAY_ROUND } from './longWay.ts'
import type { HoleDef } from './physics.ts'
import { SHORT_WAY_ROUND } from './shortWay.ts'
import { KING_OF_THE_HILL } from './summit.ts'

/** Holes to try out before they go in a round: /games/acechase/play?hole=<key>. Only the admin page links to them. */
export const TEST_HOLES: Record<string, HoleDef> = {
  long: LONG_WAY_ROUND,
  short: SHORT_WAY_ROUND,
  bank: BANK_JOB,
  hill: KING_OF_THE_HILL,
  green: BUMPS_AND_BANKS,
}
