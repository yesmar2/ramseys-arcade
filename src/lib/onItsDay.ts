import { useDailyDays, type ArchiveDay } from './archive'
import { usePastViewer, verbDone } from './dailyPast'
import { BOARD_NAMES } from './dailyWords'
import { formatLeaderboardScore } from './leaderboardFormat'
import type { PastFact } from './pastPlay'
import { ordinal } from './scoreboard'

/*
 * How a past day's Ranked board went, the board of the day it was the daily, for a daily played again as
 * practice (Find the Bug's and Half Full's past days): who was 1st, and you, as the API has the day (GET
 * /leaderboards/:game/days, lib/archive.ts). The past tab says the same about each of its rows.
 */

/** A past day as the API has it: `entry` is undefined while it's asked, null when nobody played it. */
export type ItsDay = {
  entry: ArchiveDay | null | undefined
  failed: boolean
  /** Signed in: the entry's `you` is theirs. Signed out, or not known yet, there's no you to show. */
  signedIn: boolean
}

/** A past day's entry, with the player's own result and place in it. */
export function useItsDay(slug: string, day: string | null): ItsDay {
  const viewer = usePastViewer()
  const { days, failed } = useDailyDays(slug, viewer.name)
  const entry = !day || !days ? undefined : (days.find((d) => d.day === day) ?? null)
  return { entry, failed, signedIn: viewer.state === 'in' }
}

/** "1st in 40.0s", "1st with 99.9%": a day's winning figure, as its game says it. */
function firstWords(slug: string, score: number): string {
  return `1st ${slug === 'halffull' ? 'with' : 'in'} ${formatLeaderboardScore(slug, score)}`
}

/** "Ranked: ODCHKA 1st in 40.0s · You 4th of 17 (49.1s)", for the start and pause cards. */
export function onItsDayFact(slug: string, itsDay: ItsDay): PastFact {
  const label = BOARD_NAMES.ranked
  const { entry } = itsDay
  if (entry === undefined) return { label, what: itsDay.failed ? 'Couldn’t load it' : '…' }
  if (entry === null) return { label, what: `Nobody ${verbDone(slug)} it` }
  const players = entry.players.toLocaleString()
  const you = itsDay.signedIn ? entry.you : null
  return {
    label,
    who: entry.top.name,
    what: firstWords(slug, entry.top.score),
    // A day before the game's days counted has your result but no place.
    you: you
      ? `${you.place != null ? `You ${ordinal(you.place)} of ${players}` : `You ${verbDone(slug)} it`} (${formatLeaderboardScore(slug, you.score)})`
      : null,
    // Signed in without a result that day: said plainly. Signed out: how many played it instead.
    note: itsDay.signedIn ? 'You’re not on it' : `${players} ${verbDone(slug)} it`,
  }
}
