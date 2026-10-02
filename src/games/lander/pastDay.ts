import type { ArchiveDay } from '../../lib/archive'
import { verbDone } from '../../lib/dailyPast'
import { BOARD_NAMES } from '../../lib/dailyWords'
import type { PastFact } from '../../lib/pastPlay'
import { ordinal } from '../../lib/scoreboard'
import { formatLanderBoardScore } from './score'

/*
 * How a past cave's Ranked board went, the board of its day, for its cards and the play screen
 * (PracticeCards.tsx): who was 1st and in what time, and where you finished, as the API has the day (GET
 * /leaderboards/lander/days). Its All time board is the cave's own (lib/trackBoards.ts).
 */

const SLUG = 'lander'

/** A game's days as the API has them (lib/archive.ts), and whose results to pick out: none signed out. */
export type ItsDay = { days: ArchiveDay[] | null; failed: boolean; me: string | null }

/** "Ranked": who was 1st and in what, and you, as the API has the day (signed out, how many flew it). */
export function onItsDayFact(day: string, itsDay: ItsDay): PastFact {
  const label = BOARD_NAMES.ranked
  if (itsDay.days) {
    const entry = itsDay.days.find((d) => d.day === day)
    if (!entry?.top) return { label, what: `Nobody ${verbDone(SLUG)} it` }
    const you = itsDay.me ? entry.you : null
    return {
      label,
      who: entry.top.name,
      what: `1st in ${formatLanderBoardScore(entry.top.score)}`,
      // A day before the game's days counted has your result but no place.
      you: you
        ? `${you.place != null ? `You ${ordinal(you.place)} of ${entry.players.toLocaleString()}` : `You ${verbDone(SLUG)} it`} (${formatLanderBoardScore(you.score)})`
        : null,
      // Signed out there's no "you" to speak of: how many flew it says what the 1st was of (as the other dailies do).
      note: itsDay.me ? (you ? null : 'You’re not on it') : `${entry.players.toLocaleString()} ${verbDone(SLUG)} it`,
    }
  }
  return { label, what: itsDay.failed ? 'Couldn’t load it' : '…' }
}
