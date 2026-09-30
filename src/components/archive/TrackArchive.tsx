import { useMemo } from 'react'
import { dailyTrack, FIRST_DAY, trackDay, trackNumber } from '../../games/hotlap/daily'
import { formatLap, formatLapMs } from '../../games/hotlap/score'
import { buildTrack, type Piece, type TrackShape } from '../../games/hotlap/sim'
import { trackPlan } from '../../games/hotlap/trackPlan'
import { gamePlayHref } from '../../hooks/useHashRoute'
import type { CourseBoard, CourseTop, HintFacts, PastSource } from '../../lib/dailyPast'
import { recordSetOn, usePastViewer } from '../../lib/dailyPast'
import { formatLeaderboardScore } from '../../lib/leaderboardFormat'
import { fetchTrackBoard, useTrackRecordsAsked } from '../../lib/trackBoards'
import { PastCourses } from './PastCourses'
import '../../styles/todaysTrack.css'

const SLUG = 'hotlap'

/** A track from above, as Today's Track draws it: on the dark ground, the road between edges of light, and the start. */
function TrackThumb({ pieces, shape }: { pieces: Piece[]; shape: TrackShape }) {
  const plan = useMemo(() => trackPlan(buildTrack(pieces, { heading: shape.heading })), [pieces, shape.heading])
  return (
    <span className="ttc-art">
      <svg className="ttc-plan" viewBox={plan.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path className="ttc-plan__glow" d={plan.d} strokeWidth={plan.road * 2.4} />
        <path className="ttc-plan__edge" d={plan.d} strokeWidth={plan.road * 1.3} />
        <path className="ttc-plan__road" d={plan.d} strokeWidth={plan.road} />
        <line className="ttc-plan__start" {...plan.start} strokeWidth={plan.road * 0.4} />
        <circle className="ttc-plan__car" cx={plan.car.x} cy={plan.car.y} r={plan.car.r} />
      </svg>
    </span>
  )
}

const anchor = (day: string) => String(trackNumber(day))

const playHref = (day: string) => `${gamePlayHref(SLUG)}?track=${trackNumber(day)}`

const title = (day: string) => `#${trackNumber(day)} ${dailyTrack(day).name}`

const sub = (day: string) => `Blue car ${formatLap(dailyTrack(day).pace)}`

function art(day: string) {
  const track = dailyTrack(day)
  return <TrackThumb pieces={track.pieces} shape={track.shape} />
}

async function fetchTop(day: string, name: string): Promise<CourseTop> {
  const board = await fetchTrackBoard(trackNumber(day), name)
  return { top: board.entries, players: board.drivers, you: board.you }
}

function hint({ signedIn, board }: HintFacts): string | null {
  if (!signedIn) return 'Sign in and your laps here go on its board.'
  const you = board?.you
  if (!you) return 'Your first lap puts you on its board.'
  if (you.place === 1) return 'You hold its record.'
  if (you.place === 2 && board.record) return `Beat ${formatLeaderboardScore(SLUG, board.record.score)} to take its record.`
  return `Beat your ${formatLeaderboardScore(SLUG, you.score)} to move up its board.`
}

/** A lap's time off the record, from their board scores (a million less the lap in milliseconds). */
const gap = (you: number, record: number) => formatLapMs(Math.max(0, record - you))

/**
 * Hot Lap's past tracks: every track before today's, newest first. Each keeps a board of its own for good
 * (lib/trackBoards.ts): any lap on it, on its day or since, each driver's best.
 */
export function TrackArchive() {
  const today = trackDay()
  const viewer = usePastViewer()
  const { rows: records, failed, retry } = useTrackRecordsAsked(viewer.name)
  const rows = useMemo(() => {
    if (!records) return null
    const out = new Map<string, CourseBoard>()
    for (const r of records) {
      if (r.day < today) out.set(r.day, { record: r.record, setOn: recordSetOn(r.record, trackDay), players: r.drivers, you: r.you })
    }
    return out
  }, [records, today])
  const source = useMemo<PastSource>(
    () => ({
      slug: SLUG,
      today,
      first: FIRST_DAY,
      number: trackNumber,
      anchor,
      playHref,
      title,
      sub,
      art,
      boards: {
        rows,
        failed,
        retry,
        fetchTop,
        rule: 'race one and your best lap goes on it.',
        legend: 'everyone’s best lap, from its day and since',
        player: 'driver',
        gap,
      },
      hint,
    }),
    [today, rows, failed, retry],
  )
  return <PastCourses source={source} />
}
