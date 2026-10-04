import { useMemo } from 'react'
import { PastBoardResult } from '../../components/PastBoardResult'
import { PastCourseStart } from '../../components/PastCourseCards'
import { useIsAdmin } from '../../lib/admin'
import { inArchive } from '../../lib/archive'
import { archivedWhy } from '../../lib/dailyPast'
import { BOARD_NAMES, type PastKind } from '../../lib/dailyWords'
import { allTimeBoardName, RECORD_TICKETS } from '../../lib/pastBoards'
import type { TrackBoard, TrackLapResult } from '../../lib/trackBoards'
import { dailyTrack, dayOfTrack, PLANNED_TRACKS, trackDay, trackNumber, trackState } from './daily'
import type { Course } from './lap'
import { trackDriveHref, type PastTrackFigures } from './pastTrack'
import { formatHotlapBoardScore, formatLap, formatLapMs } from './score'

/*
 * A past track's cards (/games/hotlap/play?track=<n>, from the Past tracks tab): the one it opens on, and
 * the one after a lap. A past track keeps its All time board for good (lib/trackBoards.ts): signed in, your
 * best lap goes on it, and never on today's board, your week or your rank. Signed out, a lap is practice:
 * nothing is kept, even if you sign in after it; signing in puts your next laps on its board. The cards
 * themselves are every daily's (components/PastCourseCards.tsx); Hot Lap fills them in.
 */

const SLUG = 'hotlap'

/** A lap on a board, as a time. */
const lapOf = formatHotlapBoardScore

/** A track's name by its number. */
const trackName = (n: number) => dailyTrack(dayOfTrack(n)).name

/** "Seneca Glen’s All time board": the track's own board, every lap on it since its day, named in a sentence. */
const allTimeBoard = allTimeBoardName

const weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })
const monthDayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

/** When a past track was the day's, from today: "yesterday", "on Monday" in the last week, "on Sep 20" before that. */
function whenItWas(day: string): string {
  const ago = trackNumber(trackDay()) - trackNumber(day)
  const at = new Date(`${day}T12:00:00Z`)
  if (ago === 1) return 'yesterday'
  return ago < 7 ? `on ${weekdayFormat.format(at)}` : `on ${monthDayFormat.format(at)}`
}

/** A lap against the blue car, said as a sentence. */
function paceWords(time: number, pace: number): string {
  const gap = Math.abs(time - pace)
  if (gap < 0.005) return 'You tied with the blue car.'
  return time < pace ? `You beat the blue car by ${gap.toFixed(2)}s.` : `The blue car was ${gap.toFixed(2)}s quicker.`
}

/**
 * A past track's start card: what it is, that a lap here goes on its All time board and not your rank (or,
 * signed out, is practice), its Ranked and All time boards' figures, and the way back to its row. Like
 * the game's own, a tap anywhere but its links starts the lap. The tracks either side are a walk away:
 * the next only while it's a past one too, unless you're an admin, who may test-drive what's to come.
 */
export function PastTrackStart({
  course,
  kind,
  figures,
  board,
}: {
  course: Course
  kind: PastKind
  figures: PastTrackFigures
  board: TrackBoard | null
}) {
  const admin = useIsAdmin()
  const { n, name } = course
  const today = useMemo(() => dailyTrack(trackDay()).name, [])
  const walk = useMemo(
    () => ({
      prev: n > 1 ? { label: `#${n - 1} ${trackName(n - 1)}`, href: trackDriveHref(n - 1) } : null,
      next:
        n < PLANNED_TRACKS && (admin || trackState(n + 1) === 'past')
          ? { label: `#${n + 1} ${trackName(n + 1)}`, href: trackDriveHref(n + 1) }
          : null,
    }),
    [n, admin],
  )
  const pace = `Blue car: ${formatLap(course.paceLap.time)}.`
  const note =
    kind === 'practice'
      ? pace
      : board?.you?.place === 1
        ? `You hold its record. ${pace}`
        : `Taking its record pays ${RECORD_TICKETS} tickets, once. ${pace}`
  return (
    <PastCourseStart
      slug={SLUG}
      course={n}
      day={course.day}
      kind={kind}
      title={name}
      blurb={`Hot Lap track #${n}. It was the day’s track ${whenItWas(course.day)}.`}
      labelSub={
        kind === 'board'
          ? `Your best lap goes on ${allTimeBoard(name)}. Today’s board, your week and your rank stay as they are.`
          : undefined
      }
      facts={figures.facts}
      note={note}
      startLabel={figures.played ? 'Race it again' : 'Race it'}
      today={{ name: today }}
      walk={walk}
    >
      {kind === 'practice' ? (
        <p className="hotlap-past__line">
          {inArchive(course.day) ? archivedWhy(SLUG) : `Sign in and your laps here go on its ${BOARD_NAMES.allTime} board.`}
        </p>
      ) : null}
    </PastCourseStart>
  )
}

/**
 * After a lap of a past track: its time, and where it went. Signed in, it goes on the track's board when it
 * beats your best there (components/PastBoardResult.tsx). Driven signed out it was practice and stays so.
 */
export function PastTrackResult({
  course,
  time,
  score,
  run,
  board,
  owner,
  onSaved,
  onAgain,
}: {
  course: Course
  time: number
  /** The lap as the board keeps it. */
  score: number
  /** The run the lap was driven in. */
  run: Promise<string | undefined> | null
  board: TrackBoard | null
  /** Whose the lap is: an account's id, saved only while it's signed in; null driven signed out, practice and never saved. */
  owner?: string | null
  onSaved: (result: TrackLapResult) => void
  onAgain: () => void
}) {
  const today = useMemo(() => dailyTrack(trackDay()).name, [])
  return (
    <PastBoardResult
      slug={SLUG}
      n={course.n}
      day={course.day}
      name={course.name}
      figure={formatLap(time)}
      score={score}
      pace={paceWords(time, course.paceLap.time)}
      fmt={lapOf}
      gap={formatLapMs}
      run={run}
      board={board}
      owner={owner}
      today={{ name: today }}
      onSaved={onSaved}
      onAgain={onAgain}
    />
  )
}
