import { useCallback, useState } from 'react'
import { useDailyDays, type ArchiveDay } from '../../lib/archive'
import type { DailySolved, TodaysHole } from '../../lib/dailyHole'
import { pastKindFor } from '../../lib/dailyPast'
import type { PastKind } from '../../lib/dailyWords'
import { useHoleBoard, useHoleRecordsAsked, type HoleBoard, type HoleRecordRow, type PastProgress } from '../../lib/pastHoles'
import type { PastFact } from '../../lib/pastPlay'
import { ordinal } from '../../lib/scoreboard'
import { acechaseTriesFromBoardScore } from './score'

/*
 * A past hole's figures, as its start card, the pause card and its result card show them: how its day
 * went (the days' list, GET /leaderboards/acechase/days) and its own board (lib/pastHoles.ts). Asked by
 * the tag the past tab asks by, so what a row there has just shown is here at once. A hole's board takes
 * only a player's first result on it, so the same figures say what a run here does: goes on its board, or
 * practice.
 */

const SLUG = 'acechase'

export const triesWords = (n: number) => `${n} ${n === 1 ? 'try' : 'tries'}`
export const playersWords = (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`

/** What the API says about a past hole: how its day went, and its board. */
export type PastHoleFigures = {
  /** Its day from the days' list: undefined while it's asked, null if nobody got it on its day. */
  onItsDay: ArchiveDay | null | undefined
  /** The days' list couldn't be had: its day's line is left out. */
  dayUnknown: boolean
  /** Its board, with the player's place on it; null until it comes. */
  board: HoleBoard | null
  /** Its row in the list of every hole's board: there at once when the past tab has just asked for it. */
  row: HoleRecordRow | null | undefined
  /** Ask for the board again: after a result has gone on it. */
  refresh: () => void
}

/** A past hole's figures, with `name`'s results (none for no name). */
export function usePastHoleFigures(hole: TodaysHole, name: string): PastHoleFigures {
  const [version, setVersion] = useState(0)
  const board = useHoleBoard(hole.day, name, version)
  const { rows } = useHoleRecordsAsked(name)
  const { days, failed } = useDailyDays(SLUG, name)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return {
    onItsDay: days ? (days.find((d) => d.day === hole.day) ?? null) : failed ? null : undefined,
    dayUnknown: !days && failed,
    board,
    row: rows ? (rows.find((r) => r.day === hole.day) ?? null) : undefined,
    refresh,
  }
}

/** The board as far as it's known: the hole's own, or else its row from the list. */
function boardSoFar(figures: PastHoleFigures): { players: number; record: { name: string; tries: number } | null; you: HoleBoard['you'] } | null {
  if (figures.board) return { players: figures.board.players, record: figures.board.entries[0] ?? null, you: figures.board.you }
  if (figures.row) return { players: figures.row.players, record: figures.row.record, you: figures.row.you }
  return null
}

/**
 * Whether the player has a result on the hole: on its board (from its day or since), on its day's list,
 * or a bullseye this device has kept and not sent yet. With one, playing it again is practice.
 */
export function hasHoleResult(figures: PastHoleFigures | undefined, solved: DailySolved | null): boolean {
  return Boolean(solved || figures?.onItsDay?.you || figures?.board?.you || figures?.row?.you)
}

/** What the next run on a past hole does: goes on its board, for a player signed in with no result there yet; else practice. */
export function nextHoleKind(signedIn: boolean, hadResult: boolean): PastKind {
  return pastKindFor(SLUG, signedIn, true, hadResult)
}

/**
 * The hole's figures a line each, for its start card and the pause card: how its day went, and its board.
 * "On its day: ODCHKA 1st in 2 tries · You 13th of 42 (3 tries)", "Hole board: SECRETCHK 1 try · You 11th of 40 (3 tries)".
 */
export function pastHoleFacts({
  figures,
  signedIn,
  solved,
  progress,
}: {
  figures: PastHoleFigures
  signedIn: boolean
  /** The player's own bullseye on it, kept on this device. */
  solved: DailySolved | null
  /** The player's tries at it so far, when the next run carries them on. */
  progress: PastProgress | null
}): PastFact[] {
  const facts: PastFact[] = []
  const day = figures.onItsDay
  if (day === undefined && !figures.dayUnknown) facts.push({ label: 'On its day', what: '…' })
  else if (day === null && !figures.dayUnknown) facts.push({ label: 'On its day', what: 'Nobody got it on its day' })
  else if (day) {
    const you = day.you
    facts.push({
      label: 'On its day',
      who: day.top.name,
      what: `1st in ${triesWords(acechaseTriesFromBoardScore(day.top.score))}`,
      // Holes #1 and #2 came before the days counted: a result there has no place.
      you: you
        ? `${you.place != null ? `You ${ordinal(you.place)} of ${day.players}` : 'You played it'} (${triesWords(acechaseTriesFromBoardScore(you.score))})`
        : null,
      // Signed out there's no "you" to speak of: how many played it says what the 1st was of.
      note: signedIn ? 'You didn’t play it on its day' : playersWords(day.players),
    })
  }
  const board = boardSoFar(figures)
  if (!board) facts.push({ label: 'Hole board', what: '…' })
  else if (!board.record) facts.push({ label: 'Hole board', what: 'Nobody has got it yet' })
  else {
    const you = board.you
    const tries = progress?.tries ?? 0
    facts.push({
      label: 'Hole board',
      who: board.record.name,
      what: triesWords(board.record.tries),
      you: you ? `You ${ordinal(you.place)} of ${board.players} (${triesWords(you.tries)})` : null,
      note: !signedIn
        ? playersWords(board.players)
        : solved
          ? `Your bullseye in ${solved.tries} isn’t on it yet`
          : tries > 0
            ? `You’re ${triesWords(tries)} in`
            : `${playersWords(board.players)}, not you yet`,
    })
  }
  return facts
}
