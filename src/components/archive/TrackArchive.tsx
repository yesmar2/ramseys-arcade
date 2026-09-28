import { useMemo } from 'react'
import { dailyTrack, FIRST_DAY, trackDay, trackNumber } from '../../games/hotlap/daily'
import { formatLap } from '../../games/hotlap/score'
import { buildTrack, type Piece, type TrackShape } from '../../games/hotlap/sim'
import { trackPlan } from '../../games/hotlap/trackPlan'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { usePlayerName } from '../../hooks/usePlayerName'
import { dayBefore, useArchiveDays } from '../../lib/archive'
import { normalizePlayerName } from '../../lib/leaderboard'
import { useTrackRecords } from '../../lib/trackBoards'
import { ArchiveGrid, type ArchiveItem, type ArchiveResult } from './ArchiveList'
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

/**
 * Hot Lap's archive: every day's track from the first, today's at the top. Today's shows the day's best;
 * a past one shows its record, since its board stays open (lib/trackBoards.ts), and your best and place.
 */
export function TrackArchive() {
  const today = trackDay()
  const me = normalizePlayerName(usePlayerName())
  const days = useArchiveDays(SLUG, me)
  const records = useTrackRecords(me)
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
        ...(day === today ? {} : { empty: 'No laps on its board yet' }),
      })
    }
    return out
  }, [today])
  const results = useMemo(() => {
    const out = new Map<string, ArchiveResult>()
    const now = days?.find((d) => d.day === today)
    if (now) out.set(today, now)
    for (const r of records ?? []) {
      if (r.day === today || !r.record) continue
      out.set(r.day, { top: r.record, players: r.drivers, you: r.you, record: true })
    }
    return out
  }, [days, records, today])
  return <ArchiveGrid slug={SLUG} items={items} results={results} asked={days !== null && records !== null} />
}
