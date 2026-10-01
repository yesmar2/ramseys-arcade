import { useDailyDays, type ArchiveDay } from '../../lib/archive'
import type { DailySolved, TodaysHole } from '../../lib/dailyHole'
import { pastKindFor } from '../../lib/dailyPast'
import type { PastKind } from '../../lib/dailyWords'
import type { HoleBoard, HoleRecordRow, PastProgress } from '../../lib/pastHoles'
import type { PastFact } from '../../lib/pastPlay'
import { acechaseTriesFromBoardScore } from './score'

/*
 * A past hole's figures, as its start card, the pause card and its result card show them: how its day went
 * for you (the days' list, GET /leaderboards/acechase/days), asked by the tag the past tab asks by, so what a
 * row there has just shown is here at once. Ace Chase is just for fun (data/games.ts Game.ranked), so a past
 * hole keeps no board and a run on it is practice: its board and its row are always none.
 */

const SLUG = 'acechase'

export const triesWords = (n: number) => `${n} ${n === 1 ? 'try' : 'tries'}`
export const playersWords = (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`

/** What the API says about a past hole: how its day went. */
export type PastHoleFigures = {
  /** Its day from the days' list: undefined while it's asked, null if nobody got it on its day. */
  onItsDay: ArchiveDay | null | undefined
  /** The days' list couldn't be had: its day's line is left out. */
  dayUnknown: boolean
  /** Its board, which a past hole no longer keeps: always null. */
  board: HoleBoard | null
  /** Its row in the list of every hole's board, which there no longer is: always null. */
  row: HoleRecordRow | null | undefined
  /** Ask again: nothing to ask, since a past hole keeps no board. */
  refresh: () => void
}

const NOTHING = () => {}

/** A past hole's figures, with `name`'s results (none for no name). */
export function usePastHoleFigures(hole: TodaysHole, name: string): PastHoleFigures {
  const { days, failed } = useDailyDays(SLUG, name)
  return {
    onItsDay: days ? (days.find((d) => d.day === hole.day) ?? null) : failed ? null : undefined,
    dayUnknown: !days && failed,
    board: null,
    row: null,
    refresh: NOTHING,
  }
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
 * The hole's figures a line each, for its start card and the pause card: your result on its day ("Your
 * result: 3 tries on its day"), and your bullseye here since, if this device has one.
 */
export function pastHoleFacts({
  figures,
  signedIn,
  solved,
}: {
  figures: PastHoleFigures
  signedIn: boolean
  /** The player's own bullseye on it, kept on this device. */
  solved: DailySolved | null
  /** The player's tries at it so far: unused, a past hole being practice. */
  progress?: PastProgress | null
}): PastFact[] {
  const facts: PastFact[] = []
  const day = figures.onItsDay
  const label = 'Your result'
  if (day === undefined && !figures.dayUnknown) facts.push({ label, what: '…' })
  else if (!figures.dayUnknown) {
    const you = signedIn ? (day?.you ?? null) : null
    if (you) facts.push({ label, what: `${triesWords(acechaseTriesFromBoardScore(you.score))} on its day` })
    else if (signedIn) facts.push({ label, what: 'You didn’t play it on its day' })
    else facts.push({ label: 'That day', what: day ? `${playersWords(day.players)} got it` : 'Nobody got it' })
  }
  if (solved) facts.push({ label: 'Here since', what: `Your bullseye in ${triesWords(solved.tries)}` })
  return facts
}
