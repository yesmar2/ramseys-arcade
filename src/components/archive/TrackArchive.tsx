import { useMemo } from 'react'
import { dailyTrack, FIRST_DAY, trackDay, trackNumber } from '../../games/hotlap/daily'
import { buildTrack, type Piece, type TrackShape } from '../../games/hotlap/sim'
import { trackPlan } from '../../games/hotlap/trackPlan'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { usePastViewer, type PastSource } from '../../lib/dailyPast'
import { usePastBoards } from './pastBoards'
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

/** The day's blue car, for your medal that day. */
const pace = (day: string) => dailyTrack(day).pace

function art(day: string) {
  const track = dailyTrack(day)
  return <TrackThumb pieces={track.pieces} shape={track.shape} />
}

/**
 * Hot Lap's past tracks: every track before today's, newest first. Each keeps an All time board of its own
 * for good (lib/trackBoards.ts): any lap on it, on its day or since, each driver's best.
 */
export function TrackArchive() {
  const today = trackDay()
  const viewer = usePastViewer()
  const boards = usePastBoards(SLUG, viewer.name, today, trackNumber)
  const source = useMemo<PastSource>(
    () => ({
      slug: SLUG,
      today,
      first: FIRST_DAY,
      anchor,
      playHref,
      title,
      art,
      boards,
      pace,
    }),
    [today, boards],
  )
  return <PastCourses source={source} />
}
