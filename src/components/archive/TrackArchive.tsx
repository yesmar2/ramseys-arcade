import { useMemo } from 'react'
import { dailyTrack, FIRST_DAY, trackDay, trackNumber } from '../../games/hotlap/daily'
import { formatLap } from '../../games/hotlap/score'
import { buildTrack, type Piece, type TrackShape } from '../../games/hotlap/sim'
import { trackPlan } from '../../games/hotlap/trackPlan'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { dayBefore } from '../../lib/archive'
import { ArchiveList, type ArchiveItem } from './ArchiveList'
import '../../styles/todaysTrack.css'

const SLUG = 'hotlap'

/** A track from above, as Today's Track draws it: grass, the road with its white edges, and the start. */
function TrackThumb({ pieces, shape }: { pieces: Piece[]; shape: TrackShape }) {
  const plan = useMemo(() => trackPlan(buildTrack(pieces, { heading: shape.heading })), [pieces, shape.heading])
  return (
    <svg className="ttc-plan" viewBox={plan.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path className="ttc-plan__edge" d={plan.d} strokeWidth={plan.road * 1.3} />
      <path className="ttc-plan__road" d={plan.d} strokeWidth={plan.road} />
      <line className="ttc-plan__start" {...plan.start} strokeWidth={plan.road * 0.4} />
      <circle className="ttc-plan__car" cx={plan.car.x} cy={plan.car.y} r={plan.car.r} />
    </svg>
  )
}

/** Hot Lap's archive: every day's track from the first, today's at the top. A past one is a test drive. */
export function TrackArchive() {
  const today = trackDay()
  const items = useMemo(() => {
    const out: ArchiveItem[] = []
    for (let day = today; day >= FIRST_DAY; day = dayBefore(day)) {
      const n = trackNumber(day)
      out.push({
        day,
        n,
        today: day === today,
        href: day === today ? gamePlayHref(SLUG) : `${gamePlayHref(SLUG)}?track=${n}`,
        build: () => {
          const track = dailyTrack(day)
          return { title: track.name, sub: `Blue car ${formatLap(track.pace)}`, art: <TrackThumb pieces={track.pieces} shape={track.shape} /> }
        },
      })
    }
    return out
  }, [today])
  return <ArchiveList slug={SLUG} items={items} />
}
