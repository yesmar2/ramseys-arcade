import { BOARD_NAMES } from './dailyWords'
import type { PastFact } from './pastPlay'
import { ordinal } from './scoreboard'
import type { TrackBoard } from './trackBoards'

/*
 * The words a ranked daily's past course's All time board (lib/trackBoards.ts) is said in, on its start, pause
 * and result cards (components/PastBoardResult.tsx and each game's own).
 */

/** What taking a past course's record pays, once a course: the API's tickets.ts RECORD_TICKETS. */
export const RECORD_TICKETS = 15

/** "1 driver", "15 pilots", "3 players": who are on a course's board. */
export function playersWords(slug: string, n: number): string {
  const one = slug === 'hotlap' ? 'driver' : slug === 'lander' ? 'pilot' : 'player'
  return `${n.toLocaleString()} ${n === 1 ? one : `${one}s`}`
}

/** "Seneca Glen’s All time board": a course's own board, named in a sentence. */
export function allTimeBoardName(name: string): string {
  return `${name}’s ${BOARD_NAMES.allTime} board`
}

/**
 * A past course's All time line for its start and pause cards: its record, and your place on it while signed
 * in (signed out, how many are on it).
 */
export function allTimeFact(slug: string, board: TrackBoard | null, mine: boolean, fmt: (score: number) => string): PastFact {
  const label = BOARD_NAMES.allTime
  const record = board?.entries[0]
  if (!board) return { label, what: '…' }
  if (!record) return { label, what: 'Nobody on it yet' }
  return {
    label,
    who: record.name,
    what: fmt(record.score),
    you: mine && board.you ? `You ${ordinal(board.you.place)} of ${board.drivers.toLocaleString()}` : null,
    note: mine ? 'You’re not on it yet' : playersWords(slug, board.drivers),
  }
}
