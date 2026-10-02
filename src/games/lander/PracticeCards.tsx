import type { ReactNode } from 'react'
import { PastBoardResult } from '../../components/PastBoardResult'
import { PastCourseStart, type PastWalkLink, type TodayCourse } from '../../components/PastCourseCards'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { archiveDayWords } from '../../lib/archive'
import { BOARD_NAMES, type PastKind } from '../../lib/dailyWords'
import { allTimeBoardName, RECORD_TICKETS } from '../../lib/pastBoards'
import type { PastFact } from '../../lib/pastPlay'
import type { TrackBoard, TrackLapResult } from '../../lib/trackBoards'
import { caveDay, caveNumber, dailyCave, FIRST_DAY } from './daily'
import type { LanderDay } from './runs'
import { crashWords, formatLanderBoardScore, formatRun } from './score'

/*
 * The cards of a past day's cave flown again from the past tab (/games/lander/play?day=YYYY-MM-DD), on the
 * cards every daily's past course shares (components/PastCourseCards.tsx): the one it opens on, and the one
 * after a run. A past cave keeps its All time board for good (lib/trackBoards.ts): signed in, your best
 * flight goes on it, and never on today's board, your week or your rank. Signed out, a flight is practice:
 * nothing is kept, even if you sign in after it.
 */

const SLUG = 'lander'

/** A past day's cave, by its day. */
const practiceHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`
const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

/** "‹ #2 Amber Well": the caves either side of a past day's, while they're past ones. */
function walkFor(day: string): { prev: PastWalkLink | null; next: PastWalkLink | null } {
  const link = (other: string) => ({ label: `#${caveNumber(other)} ${dailyCave(other).name}`, href: practiceHref(other) })
  const before = shiftDay(day, -1)
  const after = shiftDay(day, 1)
  return { prev: before >= FIRST_DAY ? link(before) : null, next: after < caveDay() ? link(after) : null }
}

/** Today's cave, which counts: "Today's cave is the one that counts: Amber Well ›". */
const todayCave = (): TodayCourse => ({ name: dailyCave(caveDay()).name })

/** How far apart two board scores are, in seconds: "1.20s". */
const gapWords = (diff: number) => `${(diff / 1000).toFixed(2)}s`

/**
 * A past cave's start card: which cave it was and when, that a flight here goes on its All time board (or,
 * signed out, is practice), its Ranked and All time boards, the blue ship's run and your best here (`tiles`,
 * as the pause card has them). A tap anywhere starts, as on today's card.
 */
export function PracticeStartCard({
  lander,
  kind,
  facts,
  tiles,
  board,
}: {
  lander: LanderDay
  kind: PastKind
  facts: readonly PastFact[]
  tiles: ReactNode
  board: TrackBoard | null
}) {
  const note =
    kind === 'practice'
      ? `Sign in and your flights here go on its ${BOARD_NAMES.allTime} board.`
      : board?.you?.place === 1
        ? 'You hold its record.'
        : `Taking its record pays ${RECORD_TICKETS} tickets, once.`
  return (
    <PastCourseStart
      slug={SLUG}
      course={lander.day}
      day={lander.day}
      kind={kind}
      title={lander.name}
      kicker={`Past cave #${lander.n} · ${archiveDayWords(lander.day)}`}
      labelSub={
        kind === 'board'
          ? `Your best flight goes on ${allTimeBoardName(lander.name)}. Today’s board, your week and your rank stay as they are.`
          : undefined
      }
      facts={facts}
      extraMeta={tiles}
      note={note}
      startLabel={board?.you ? 'Fly it again' : 'Fly it'}
      today={todayCave()}
      walk={walkFor(lander.day)}
    />
  )
}

/** "You beat the blue ship by 1.20s, with no crashes." */
function shipWords(time: number, pace: number, crashes: number): string {
  const gap = time - pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue ship' : gap < 0 ? `You beat the blue ship by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue ship`
  return `${against}, with ${crashWords(crashes)}.`
}

/**
 * After a flight down a past cave: its time, and where it went: on the cave's All time board when it beats
 * your best there (components/PastBoardResult.tsx), or practice, flown signed out.
 */
export function PastCaveResult({
  lander,
  time,
  score,
  crashes,
  pace,
  run,
  board,
  owner,
  onSaved,
  onAgain,
}: {
  lander: LanderDay
  time: number
  /** The flight as the board keeps it. */
  score: number
  crashes: number
  pace: number
  /** The run it was flown in. */
  run: Promise<string | undefined> | null
  board: TrackBoard | null
  /** Whose the flight is: an account's id; null flown signed out, practice and never saved. */
  owner?: string | null
  onSaved: (result: TrackLapResult) => void
  onAgain: () => void
}) {
  return (
    <PastBoardResult
      slug={SLUG}
      n={lander.n}
      day={lander.day}
      name={lander.name}
      kicker={`Past cave #${lander.n} · ${lander.name}`}
      figure={formatRun(time)}
      score={score}
      pace={shipWords(time, pace, crashes)}
      fmt={formatLanderBoardScore}
      gap={gapWords}
      run={run}
      board={board}
      owner={owner}
      today={todayCave()}
      onSaved={onSaved}
      onAgain={onAgain}
    />
  )
}
