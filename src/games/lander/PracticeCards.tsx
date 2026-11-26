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
import { caveDay, caveNumber, dailyCave, FIRST_DAY } from './daily'
import type { LanderDay } from './runs'
import { crashWords, formatLanderBoardScore } from './score'

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
      ? inArchive(lander.day)
        ? archivedWhy(SLUG)
        : `Sign in and your flights here go on its ${BOARD_NAMES.allTime} board.`
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

/** How many of a cave's lanterns a run lit and brought home, and how many the cave has (lanterns.ts). */
type Lanterns = { lit: number; of: number }

/** "no lanterns", "2 of 3 lanterns", "all three lanterns". */
const lanternWords = ({ lit, of }: Lanterns) =>
  lit <= 0 ? 'no lanterns' : lit < of ? `${lit} of ${of} lanterns` : of === 3 ? 'all three lanterns' : of === 1 ? 'the lantern' : `all ${of} lanterns`

/**
 * "You beat the blue ship by 1.20s, with no crashes and 2 of 3 lanterns." The lanterns are said for a cave that
 * has them, one flown in the new look on its day (newLook.ts): on a past cave they're for the lighting alone,
 * since only today's pay.
 */
function shipWords(time: number, pace: number, crashes: number, lanterns: Lanterns | null): string {
  const gap = time - pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue ship' : gap < 0 ? `You beat the blue ship by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue ship`
  return `${against}, with ${crashWords(crashes)}${lanterns ? ` and ${lanternWords(lanterns)}` : ''}.`
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
  lanterns = null,
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
  /** The lanterns it lit and brought home, in a cave that has them. */
  lanterns?: Lanterns | null
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
      medals={{ paceMs: paceMsOf(lander.pace) }}
      walk={walkFor(lander.day)}
      kicker={`Past cave #${lander.n} · ${lander.name}`}
      figure={boardTime(SLUG, time)}
      score={score}
      pace={shipWords(time, pace, crashes, lanterns)}
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
