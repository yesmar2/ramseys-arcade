import type { ArchiveDay } from '../../lib/archive'
import { verbDone } from '../../lib/dailyPast'
import { BOARD_NAMES } from '../../lib/dailyWords'
import type { PastFact } from '../../lib/pastPlay'
import { ordinal } from '../../lib/scoreboard'
import { formatMarblerunBoardScore, formatRun, marblerunMsFromBoardScore } from './score'

/*
 * How a past course's Ranked board went, the board of its day, for its cards and the play screen
 * (PracticeCards.tsx): who was 1st and in what time, and where you finished, as the API has the day (GET
 * /leaderboards/marblerun/days).
 */

const SLUG = 'marblerun'

/** A game's days as the API has them (lib/archive.ts), and whose results to pick out: none signed out. */
export type ItsDay = { days: ArchiveDay[] | null; failed: boolean; me: string | null }

/** The #1 a past course's day closed with, whose ghost rolls it (boardGhost.ts): their tag and time. */
export type DayTop = { name: string; time: number } | null

/**
 * "Ranked": who was 1st and in what, and you, as the API has the day (signed out, how many rolled it);
 * while it's asked, the ghost's #1 stands in.
 */
export function onItsDayFact(day: string, itsDay: ItsDay, top: DayTop): PastFact {
  const label = BOARD_NAMES.ranked
  if (itsDay.days) {
    const entry = itsDay.days.find((d) => d.day === day)
    if (!entry) return { label, what: `Nobody ${verbDone(SLUG)} it` }
    const you = itsDay.me ? entry.you : null
    return {
      label,
      who: entry.top.name,
      what: `1st in ${formatMarblerunBoardScore(entry.top.score)}`,
      // A day before the game's days counted has your result but no place.
      you: you
        ? `${you.place != null ? `You ${ordinal(you.place)} of ${entry.players.toLocaleString()}` : `You ${verbDone(SLUG)} it`} (${formatMarblerunBoardScore(you.score)})`
        : null,
      // Signed out there's no "you" to speak of: how many rolled it says what the 1st was of (as the other dailies do).
      note: itsDay.me ? (you ? null : 'You’re not on it') : `${entry.players.toLocaleString()} ${verbDone(SLUG)} it`,
    }
  }
  if (top) return { label, who: top.name, what: `1st in ${formatRun(top.time)}` }
  return { label, what: itsDay.failed ? 'Couldn’t load it' : '…' }
}

/** Who was 1st on the course's day and in what time, and whether it was you. */
export function dayFirst(day: string, itsDay: ItsDay, top: DayTop): { name: string; time: number; mine: boolean } | null {
  const entry = itsDay.days?.find((d) => d.day === day)
  const first = entry ? { name: entry.top.name, time: marblerunMsFromBoardScore(entry.top.score) / 1000 } : itsDay.days ? null : top
  return first ? { ...first, mine: first.name === itsDay.me } : null
}
