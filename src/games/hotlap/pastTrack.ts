import { useMemo } from 'react'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { useDailyDays } from '../../lib/archive'
import { BOARD_NAMES } from '../../lib/dailyWords'
import type { Viewer } from '../../lib/deviceRuns'
import { allTimeFact } from '../../lib/pastBoards'
import type { PastFact } from '../../lib/pastPlay'
import { ordinal } from '../../lib/scoreboard'
import type { TrackBoard } from '../../lib/trackBoards'
import { formatHotlapBoardScore } from './score'

/*
 * A past track's figures, for its cards (PastTrackCards.tsx) and its pause card: its Ranked board, the
 * day's board (GET /leaderboards/hotlap/days), and its All time board, every lap since (lib/trackBoards.ts).
 */

const SLUG = 'hotlap'

/** A track's play page by its number: a past one's board, or an admin's test drive of one still to come. */
export function trackDriveHref(n: number) {
  return `${gamePlayHref(SLUG)}?track=${n}`
}

/** "1 driver", "15 drivers". */
export const driversWords = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'driver' : 'drivers'}`

/** What the past track's cards and its pause card say of it: its day, and its board. */
export type PastTrackFigures = {
  facts: PastFact[]
  /** Whether the viewer has raced it: on its day, or on its board since. */
  played: boolean
}

/**
 * A past track's figures, a line each: its Ranked board (who was 1st, and your place that day), and its
 * All time board (its record, and your place on it). Your part only while signed in: signed out, how many
 * raced it instead.
 */
export function usePastTrackFigures(day: string, board: TrackBoard | null, viewer: Viewer, name: string): PastTrackFigures {
  const mine = viewer !== null
  const { days, failed } = useDailyDays(SLUG, mine ? name : '')
  return useMemo(() => {
    const lap = formatHotlapBoardScore
    const entry = days?.find((d) => d.day === day)
    const ranked = BOARD_NAMES.ranked
    let onItsDay: PastFact
    if (!days) onItsDay = { label: ranked, what: failed ? 'Couldn’t load it' : '…' }
    else if (!entry?.top) onItsDay = { label: ranked, what: 'Nobody raced it' }
    else {
      onItsDay = {
        label: ranked,
        who: entry.top.name,
        what: `1st in ${lap(entry.top.score)}`,
        // A day before the game's days counted has your result but no place.
        you:
          mine && entry.you
            ? entry.you.place != null
              ? `You ${ordinal(entry.you.place)} of ${entry.players.toLocaleString()}`
              : 'You raced it'
            : null,
        note: mine ? 'You’re not on it' : `${entry.players.toLocaleString()} raced it`,
      }
    }
    const onBoard = allTimeFact(SLUG, board, mine, lap)
    return { facts: [onItsDay, onBoard], played: mine && Boolean(entry?.you || board?.you) }
  }, [days, failed, day, board, mine])
}
