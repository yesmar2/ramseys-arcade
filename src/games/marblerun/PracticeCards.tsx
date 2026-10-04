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
import { courseDay, courseNumber, dailyCourse, FIRST_DAY } from './daily'
import type { MarbleDay } from './runs'
import { formatMarblerunBoardScore, formatRun } from './score'

/*
 * The cards of a past day's course rolled again from the past tab (/games/marblerun/play?day=YYYY-MM-DD),
 * on the cards every daily's past course shares (components/PastCourseCards.tsx): the one it opens on,
 * and the one after a run. A past course keeps its All time board for good (lib/trackBoards.ts): signed in,
 * your best run goes on it, and never on today's board, your week or your rank. Signed out, a run is
 * practice: nothing is kept, even if you sign in after it.
 */

const SLUG = 'marblerun'

/** A past day's course, by its day. */
const practiceHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`
const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

/** "‹ #2 Pebble Falls": the courses either side of a past day's, while they're past ones. */
function walkFor(day: string): { prev: PastWalkLink | null; next: PastWalkLink | null } {
  const link = (other: string) => ({ label: `#${courseNumber(other)} ${dailyCourse(other).name}`, href: practiceHref(other) })
  const before = shiftDay(day, -1)
  const after = shiftDay(day, 1)
  return { prev: before >= FIRST_DAY ? link(before) : null, next: after < courseDay() ? link(after) : null }
}

/** Today's course, which counts: "Today's course is the one that counts: Pebble Falls ›". */
const todayCourse = (): TodayCourse => ({ name: dailyCourse(courseDay()).name })

/** How far apart two board scores are, in seconds: "1.20s". */
const gapWords = (diff: number) => `${(diff / 1000).toFixed(2)}s`

/**
 * A past course's start card: which course it was and when, that a run here goes on its All time board (or,
 * signed out, is practice), its Ranked and All time boards, the blue ball's run and your best here (`tiles`,
 * as the pause card has them). A tap anywhere starts, as on today's card.
 */
export function PracticeStartCard({
  marble,
  kind,
  facts,
  tiles,
  board,
}: {
  marble: MarbleDay
  kind: PastKind
  facts: readonly PastFact[]
  tiles: ReactNode
  board: TrackBoard | null
}) {
  const note =
    kind === 'practice'
      ? inArchive(marble.day)
        ? archivedWhy(SLUG)
        : `Sign in and your runs here go on its ${BOARD_NAMES.allTime} board.`
      : board?.you?.place === 1
        ? 'You hold its record.'
        : `Taking its record pays ${RECORD_TICKETS} tickets, once.`
  return (
    <PastCourseStart
      slug={SLUG}
      course={marble.day}
      day={marble.day}
      kind={kind}
      title={marble.name}
      kicker={`Past course #${marble.n} · ${archiveDayWords(marble.day)}`}
      labelSub={
        kind === 'board'
          ? `Your best run goes on ${allTimeBoardName(marble.name)}. Today’s board, your week and your rank stay as they are.`
          : undefined
      }
      facts={facts}
      extraMeta={tiles}
      note={note}
      startLabel={board?.you ? 'Roll it again' : 'Roll it'}
      today={todayCourse()}
      walk={walkFor(marble.day)}
    />
  )
}

const fallWords = (falls: number) => (falls === 0 ? 'no falls' : falls === 1 ? '1 fall' : `${falls} falls`)

/** "You beat the blue ball by 1.20s, with no falls." */
function ballWords(time: number, pace: number, falls: number): string {
  const gap = time - pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue ball' : gap < 0 ? `You beat the blue ball by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue ball`
  return `${against}, with ${fallWords(falls)}.`
}

/**
 * After a run down a past course: its time, and where it went: on the course's All time board when it beats
 * your best there (components/PastBoardResult.tsx), or practice, rolled signed out.
 */
export function PastCourseRunResult({
  marble,
  time,
  score,
  falls,
  pace,
  run,
  board,
  owner,
  onSaved,
  onAgain,
}: {
  marble: MarbleDay
  time: number
  /** The run as the board keeps it. */
  score: number
  falls: number
  pace: number
  /** The run id it was rolled in. */
  run: Promise<string | undefined> | null
  board: TrackBoard | null
  /** Whose the run is: an account's id; null rolled signed out, practice and never saved. */
  owner?: string | null
  onSaved: (result: TrackLapResult) => void
  onAgain: () => void
}) {
  return (
    <PastBoardResult
      slug={SLUG}
      n={marble.n}
      day={marble.day}
      name={marble.name}
      kicker={`Past course #${marble.n} · ${marble.name}`}
      figure={formatRun(time)}
      score={score}
      pace={ballWords(time, pace, falls)}
      fmt={formatMarblerunBoardScore}
      gap={gapWords}
      run={run}
      board={board}
      owner={owner}
      today={todayCourse()}
      onSaved={onSaved}
      onAgain={onAgain}
    />
  )
}
