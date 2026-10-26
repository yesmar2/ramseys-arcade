import type { ReactNode } from 'react'
import { PastBoardResult } from '../../components/PastBoardResult'
import { PastCourseStart, type PastWalkLink, type TodayCourse } from '../../components/PastCourseCards'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { archiveDayWords, inArchive } from '../../lib/archive'
import { archivedWhy } from '../../lib/dailyPast'
import { BOARD_NAMES, type PastKind } from '../../lib/dailyWords'
import { allTimeBoardName, RECORD_TICKETS } from '../../lib/pastBoards'
import type { PastFact } from '../../lib/pastPlay'
import { boardTime, paceMsOf } from '../../lib/raceMedals'
import type { TrackBoard, TrackLapResult } from '../../lib/trackBoards'
import { dailyTower, FIRST_DAY, towerDay, towerNumber } from './daily'
import type { SlingDay } from './runs'
import { missWords, formatSlingBoardScore } from './score'

/*
 * The cards of a past day's tower flown again from the past tab (/games/sling/play?day=YYYY-MM-DD), on the
 * cards every daily's past course shares (components/PastCourseCards.tsx): the one it opens on, and the one
 * after a run. Past tower keep their All time board for good (lib/trackBoards.ts): signed in, your best run
 * goes on it, and never on today's board, your week or your rank. Signed out, a run is practice: nothing is
 * kept, even if you sign in after it.
 */

const SLUG = 'sling'

/** A past day's tower, by their day. */
const practiceHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`
const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

/** "‹ #2 Fern Dales": the tower either side of a past day's, while they're past ones. */
function walkFor(day: string): { prev: PastWalkLink | null; next: PastWalkLink | null } {
  const link = (other: string) => ({ label: `#${towerNumber(other)} ${dailyTower(other).name}`, href: practiceHref(other) })
  const before = shiftDay(day, -1)
  const after = shiftDay(day, 1)
  return { prev: before >= FIRST_DAY ? link(before) : null, next: after < towerDay() ? link(after) : null }
}

/** Today's tower, which count: "Today's tower are the ones that count: Fern Dales ›". */
const todayTower = (): TodayCourse => ({ name: dailyTower(towerDay()).name })

/** How far apart two board scores are, in seconds: "1.20s". */
const gapWords = (diff: number) => `${(diff / 1000).toFixed(2)}s`

/**
 * Past tower' start card: which tower they were and when, that a run here goes on their All time board (or,
 * signed out, is practice), their Ranked and All time boards, the blue blip's run and your best here (`tiles`,
 * as the pause card has them). A tap anywhere starts, as on today's card.
 */
export function PracticeStartCard({
  sling,
  kind,
  facts,
  tiles,
  board,
}: {
  sling: SlingDay
  kind: PastKind
  facts: readonly PastFact[]
  tiles: ReactNode
  board: TrackBoard | null
}) {
  const note =
    kind === 'practice'
      ? inArchive(sling.day)
        ? archivedWhy(SLUG)
        : `Sign in and your runs here go on their ${BOARD_NAMES.allTime} board.`
      : board?.you?.place === 1
        ? 'You hold their record.'
        : `Taking their record pays ${RECORD_TICKETS} tickets, once.`
  return (
    <PastCourseStart
      slug={SLUG}
      course={sling.day}
      day={sling.day}
      kind={kind}
      title={sling.name}
      kicker={`Past tower #${sling.n} · ${archiveDayWords(sling.day)}`}
      labelSub={
        kind === 'board'
          ? `Your best run goes on ${allTimeBoardName(sling.name)}. Today’s board, your week and your rank stay as they are.`
          : undefined
      }
      facts={facts}
      extraMeta={tiles}
      note={note}
      startLabel={board?.you ? 'Sling it again' : 'Sling it'}
      today={todayTower()}
      walk={walkFor(sling.day)}
    />
  )
}

/** "You beat the blue blip by 1.20s, with 6 clean landings." */
function blipWords(time: number, pace: number, misses: number): string {
  const gap = time - pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue blip' : gap < 0 ? `You beat the blue blip by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue blip`
  return `${against}, with ${missWords(misses)}.`
}

/**
 * After a run over past tower: its time, and where it went: on the tower' All time board when it beats your
 * best there (components/PastBoardResult.tsx), or practice, flown signed out.
 */
export function PastTowerResult({
  sling,
  time,
  score,
  misses,
  pace,
  run,
  board,
  owner,
  onSaved,
  onAgain,
}: {
  sling: SlingDay
  time: number
  /** The run as the board keeps it. */
  score: number
  misses: number
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
      n={sling.n}
      day={sling.day}
      name={sling.name}
      medals={{ paceMs: paceMsOf(sling.pace) }}
      walk={walkFor(sling.day)}
      kicker={`Past tower #${sling.n} · ${sling.name}`}
      figure={boardTime(SLUG, time)}
      score={score}
      pace={blipWords(time, pace, misses)}
      fmt={formatSlingBoardScore}
      gap={gapWords}
      run={run}
      board={board}
      owner={owner}
      today={todayTower()}
      onSaved={onSaved}
      onAgain={onAgain}
    />
  )
}
