import type { ReactNode } from 'react'
import { PastBoardResult } from '../../components/PastBoardResult'
import { PastCourseStart, type PastWalkLink, type TodayCourse } from '../../components/PastCourseCards'
import { archiveDayWords, inArchive } from '../../lib/archive'
import { archivedWhy } from '../../lib/dailyPast'
import { BOARD_NAMES, type PastKind } from '../../lib/dailyWords'
import { allTimeBoardName, RECORD_TICKETS } from '../../lib/pastBoards'
import type { PastFact } from '../../lib/pastPlay'
import type { TrackBoard, TrackLapResult } from '../../lib/trackBoards'
import { dailyGauntlet, FIRST_DAY, gauntletDay, gauntletNumber } from './daily'
import { gauntletDayHref } from './links'
import type { WobbleDay } from './runs'
import { formatRun, formatWobblerunBoardScore, splashWords } from './score'

/*
 * The cards of a past day's gauntlet run again from the past tab (/games/wobblerun/play?day=YYYY-MM-DD), on the
 * cards every daily's past course shares (components/PastCourseCards.tsx): the one it opens on, and the one after
 * a run. Past gauntlets keep their All time board for good (lib/trackBoards.ts): signed in, your best run goes on
 * it, and never on today's board, your week or your rank. Signed out, a run is practice: nothing is kept, even if
 * you sign in after it.
 */

const SLUG = 'wobblerun'

const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

/** "‹ #2 Gummy Getaway": the gauntlets either side of a past day's, while they're past ones. */
function walkFor(day: string): { prev: PastWalkLink | null; next: PastWalkLink | null } {
  const link = (other: string) => ({ label: `#${gauntletNumber(other)} ${dailyGauntlet(other).name}`, href: gauntletDayHref(other) })
  const before = shiftDay(day, -1)
  const after = shiftDay(day, 1)
  return { prev: before >= FIRST_DAY ? link(before) : null, next: after < gauntletDay() ? link(after) : null }
}

/** Today's gauntlet, which counts: "Today's gauntlet is the one that counts: Gummy Getaway ›". */
const todayGauntlet = (): TodayCourse => ({ name: dailyGauntlet(gauntletDay()).name })

/** How far apart two board scores are, in seconds: "1.20s". */
const gapWords = (diff: number) => `${(diff / 1000).toFixed(2)}s`

/**
 * A past gauntlet's start card: which gauntlet it was and when, that a run here goes on its All time board (or,
 * signed out, is practice), its Ranked and All time boards, the blue blip's run and your best here (`tiles`, as
 * the pause card has them). A tap anywhere starts, as on today's card.
 */
export function PracticeStartCard({
  wobble,
  kind,
  facts,
  tiles,
  board,
}: {
  wobble: WobbleDay
  kind: PastKind
  facts: readonly PastFact[]
  tiles: ReactNode
  board: TrackBoard | null
}) {
  const note =
    kind === 'practice'
      ? inArchive(wobble.day)
        ? archivedWhy(SLUG)
        : `Sign in and your runs here go on its ${BOARD_NAMES.allTime} board.`
      : board?.you?.place === 1
        ? 'You hold its record.'
        : `Taking its record pays ${RECORD_TICKETS} tickets, once.`
  return (
    <PastCourseStart
      slug={SLUG}
      course={wobble.day}
      day={wobble.day}
      kind={kind}
      title={wobble.name}
      kicker={`Past gauntlet #${wobble.n} · ${archiveDayWords(wobble.day)}`}
      labelSub={
        kind === 'board'
          ? `Your best run goes on ${allTimeBoardName(wobble.name)}. Today’s board, your week and your rank stay as they are.`
          : undefined
      }
      facts={facts}
      extraMeta={tiles}
      note={note}
      startLabel={board?.you ? 'Run it again' : 'Run it'}
      today={todayGauntlet()}
      walk={walkFor(wobble.day)}
    />
  )
}

/** "You beat the blue blip by 1.20s, with no splashes." */
function blipWords(time: number, pace: number, splats: number): string {
  const gap = time - pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue blip' : gap < 0 ? `You beat the blue blip by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue blip`
  return `${against}, with ${splashWords(splats)}.`
}

/**
 * After a run of a past gauntlet: its time, and where it went: on the gauntlet's All time board when it beats your
 * best there (components/PastBoardResult.tsx), or practice, run signed out.
 */
export function PastGauntletResult({
  wobble,
  time,
  score,
  splats,
  pace,
  run,
  board,
  owner,
  onSaved,
  onAgain,
}: {
  wobble: WobbleDay
  time: number
  /** The run as the board keeps it. */
  score: number
  splats: number
  pace: number
  /** The run it was made in. */
  run: Promise<string | undefined> | null
  board: TrackBoard | null
  /** Whose the run is: an account's id; null run signed out, practice and never saved. */
  owner?: string | null
  onSaved: (result: TrackLapResult) => void
  onAgain: () => void
}) {
  return (
    <PastBoardResult
      slug={SLUG}
      n={wobble.n}
      day={wobble.day}
      name={wobble.name}
      kicker={`Past gauntlet #${wobble.n} · ${wobble.name}`}
      figure={formatRun(time)}
      score={score}
      pace={blipWords(time, pace, splats)}
      fmt={formatWobblerunBoardScore}
      gap={gapWords}
      run={run}
      board={board}
      owner={owner}
      today={todayGauntlet()}
      onSaved={onSaved}
      onAgain={onAgain}
    />
  )
}
