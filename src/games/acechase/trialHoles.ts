import { BANK_JOB } from './bankJob.ts'
import { LONG_WAY_ROUND } from './longWay.ts'
import type { HoleDef } from './physics.ts'
import { SHORT_WAY_ROUND } from './shortWay.ts'

/** Holes to try out before they go in a round: /games/acechase/play?hole=<key>. Nothing links to them. */
export const TEST_HOLES: Record<string, HoleDef> = { long: LONG_WAY_ROUND, short: SHORT_WAY_ROUND, bank: BANK_JOB }
