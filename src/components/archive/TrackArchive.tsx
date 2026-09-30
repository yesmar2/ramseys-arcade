import { useMemo } from 'react'
import { dailyTrack, FIRST_DAY, trackDay, trackNumber } from '../../games/hotlap/daily'
import { buildTrack, type Piece, type TrackShape } from '../../games/hotlap/sim'
import { trackPlan } from '../../games/hotlap/trackPlan'
import { gamePlayHref } from '../../hooks/useHashRoute'
import type { CourseBoard, CourseTop, PastSource } from '../../lib/dailyPast'
import { BOARD_TOP, usePastViewer } from '../../lib/dailyPast'
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

function art(day: string) {
  const track = dailyTrack(day)
  return <TrackThumb pieces={track.pieces} shape={track.shape} />
}

async function fetchTop(day: string, name: string): Promise<CourseTop> {
  const board = await fetchTrackBoard(trackNumber(day), name, { limit: BOARD_TOP })
  return { top: board.entries, players: board.drivers, you: board.you }
}

/**
 * Hot Lap's past tracks: every track before today's, newest first. Each keeps an All time board of its own
 * for good (lib/trackBoards.ts): any lap on it, on its day or since, each driver's best.
 */
export function TrackArchive() {
  const today = trackDay()
  const viewer = usePastViewer()
  const { rows: records, failed, retry } = useTrackRecordsAsked(viewer.name)
  const rows = useMemo(() => {
    if (!records) return null
    const out = new Map<string, CourseBoard>()
    for (const r of records) {
      if (r.day < today) out.set(r.day, { record: r.record, players: r.drivers, you: r.you })
    }
    return out
  }, [records, today])
  const source = useMemo<PastSource>(
    () => ({
      slug: SLUG,
      today,
      first: FIRST_DAY,
      anchor,
      playHref,
      title,
      art,
      boards: { rows, failed, retry, fetchTop },
    }),
    [today, rows, failed, retry],
  )
  return <PastCourses source={source} />
}
