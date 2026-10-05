import { useMemo } from 'react'
import { TomorrowTease } from '../../components/TomorrowTease'
import { dayAfter } from '../../lib/dayBoard'
import { dailyTrack, msUntilNextTrack, trackDay, untilWords } from './daily'
import { buildTrack } from './sim'
import { trackPlan } from './trackPlan'
import '../../styles/todaysTrack.css'

/** Tomorrow's track on a lap's report, from above as Today's Track draws it; none once it's out already. */
export function TomorrowTrack({ day }: { day: string }) {
  const next = dayAfter(day)
  const track = useMemo(() => dailyTrack(next), [next])
  const plan = useMemo(() => trackPlan(buildTrack(track.pieces, { heading: track.shape.heading })), [track])
  // A lap begun before midnight and finished after it: its tomorrow is today, and open already.
  if (next <= trackDay()) return null
  return (
    <TomorrowTease
      noun="track"
      n={track.n}
      name={track.name}
      msLeft={msUntilNextTrack}
      words={untilWords}
      picture={
        <svg className="ttc-plan" viewBox={plan.viewBox} preserveAspectRatio="xMidYMid meet">
          <path className="ttc-plan__glow" d={plan.d} strokeWidth={plan.road * 2.4} />
          <path className="ttc-plan__edge" d={plan.d} strokeWidth={plan.road * 1.3} />
          <path className="ttc-plan__road" d={plan.d} strokeWidth={plan.road} />
          <line className="ttc-plan__start" {...plan.start} strokeWidth={plan.road * 0.4} />
        </svg>
      }
    />
  )
}
