import type { ReactNode } from 'react'
import { PastBoardResult } from '../../components/PastBoardResult'
import { PastCourseStart, type PastWalkLink, type TodayCourse } from '../../components/PastCourseCards'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { archiveDayWords, inArchive } from '../../lib/archive'
import { archivedWhy } from '../../lib/dailyPast'
import { BOARD_NAMES, type PastKind } from '../../lib/dailyWords'
import { allTimeBoardName, RECORD_TICKETS } from '../../lib/pastBoards'
import type { PastFact } from '../../lib/pastPlay'
import type { TrackBoard, TrackLapResult } from '../../lib/trackBoards'
import { dailyHills, FIRST_DAY, hillsDay, hillsNumber } from './daily'
import type { SwoopDay } from './runs'
import { cleanWords, formatRun, formatSwoopBoardScore } from './score'

/*
 * The cards of a past day's hills flown again from the past tab (/games/swoop/play?day=YYYY-MM-DD), on the
 * cards every daily's past course shares (components/PastCourseCards.tsx): the one it opens on, and the one
 * after a run. Past hills keep their All time board for good (lib/trackBoards.ts): signed in, your best run
 * goes on it, and never on today's board, your week or your rank. Signed out, a run is practice: nothing is
 * kept, even if you sign in after it.
 */

const SLUG = 'swoop'

/** A past day's hills, by their day. */
const practiceHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`
const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

/** "‹ #2 Fern Dales": the hills either side of a past day's, while they're past ones. */
function walkFor(day: string): { prev: PastWalkLink | null; next: PastWalkLink | null } {
  const link = (other: string) => ({ label: `#${hillsNumber(other)} ${dailyHills(other).name}`, href: practiceHref(other) })
  const before = shiftDay(day, -1)
  const after = shiftDay(day, 1)
  return { prev: before >= FIRST_DAY ? link(before) : null, next: after < hillsDay() ? link(after) : null }
}

/** Today's hills, which count: "Today's hills are the ones that count: Fern Dales ›". */
const todayHills = (): TodayCourse => ({ name: dailyHills(hillsDay()).name })

/** How far apart two board scores are, in seconds: "1.20s". */
const gapWords = (diff: number) => `${(diff / 1000).toFixed(2)}s`

/**
 * Past hills' start card: which hills they were and when, that a run here goes on their All time board (or,
 * signed out, is practice), their Ranked and All time boards, the blue bird's run and your best here (`tiles`,
 * as the pause card has them). A tap anywhere starts, as on today's card.
 */
export function PracticeStartCard({
  swoop,
  kind,
  facts,
  tiles,
  board,
}: {
  swoop: SwoopDay
  kind: PastKind
  facts: readonly PastFact[]
  tiles: ReactNode
  board: TrackBoard | null
}) {
  const note =
    kind === 'practice'
      ? inArchive(swoop.day)
        ? archivedWhy(SLUG)
        : `Sign in and your runs here go on their ${BOARD_NAMES.allTime} board.`
      : board?.you?.place === 1
        ? 'You hold their record.'
        : `Taking their record pays ${RECORD_TICKETS} tickets, once.`
  return (
    <PastCourseStart
      slug={SLUG}
      course={swoop.day}
      day={swoop.day}
      kind={kind}
      title={swoop.name}
      kicker={`Past hills #${swoop.n} · ${archiveDayWords(swoop.day)}`}
      labelSub={
        kind === 'board'
          ? `Your best run goes on ${allTimeBoardName(swoop.name)}. Today’s board, your week and your rank stay as they are.`
          : undefined
      }
      facts={facts}
      extraMeta={tiles}
      note={note}
      startLabel={board?.you ? 'Swoop it again' : 'Swoop it'}
      today={todayHills()}
      walk={walkFor(swoop.day)}
    />
  )
}

/** "You beat the blue bird by 1.20s, with 6 clean landings." */
function birdWords(time: number, pace: number, clean: number): string {
  const gap = time - pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue bird' : gap < 0 ? `You beat the blue bird by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue bird`
  return `${against}, with ${cleanWords(clean)}.`
}

/**
 * After a run over past hills: its time, and where it went: on the hills' All time board when it beats your
 * best there (components/PastBoardResult.tsx), or practice, flown signed out.
 */
export function PastHillsResult({
  swoop,
  time,
  score,
  clean,
  pace,
  run,
  board,
  owner,
  onSaved,
  onAgain,
}: {
  swoop: SwoopDay
  time: number
  /** The run as the board keeps it. */
  score: number
  clean: number
  pace: number
  /** The run it was flown in. */
  run: Promise<string | undefined> | null
  board: TrackBoard | null
  /** Whose the run is: an account's id; null flown signed out, practice and never saved. */
  owner?: string | null
  onSaved: (result: TrackLapResult) => void
  onAgain: () => void
}) {
  return (
    <PastBoardResult
      slug={SLUG}
      n={swoop.n}
      day={swoop.day}
      name={swoop.name}
      kicker={`Past hills #${swoop.n} · ${swoop.name}`}
      figure={formatRun(time)}
      score={score}
      pace={birdWords(time, pace, clean)}
      fmt={formatSwoopBoardScore}
      gap={gapWords}
      run={run}
      board={board}
      owner={owner}
      today={todayHills()}
      onSaved={onSaved}
      onAgain={onAgain}
    />
  )
}
