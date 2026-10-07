import { TomorrowTease } from '../../components/TomorrowTease'
import { dayAfter } from '../../lib/dayBoard'
import { HillsPostcard } from './HillsPostcard'
import { dailyHills, hillsDay, msUntilNextHills, untilWords } from './daily'
import { swoopDay } from './runs'

/** Tomorrow's hills on a run's report, from the side as their Past card draws them; none once they're out already. */
export function TomorrowHills({ day }: { day: string }) {
  const next = dayAfter(day)
  // A run begun before midnight and finished after it: its tomorrow is today, and open already.
  if (next <= hillsDay()) return null
  const hills = dailyHills(next)
  return (
    <TomorrowTease
      noun="hills"
      n={hills.n}
      name={hills.name}
      msLeft={msUntilNextHills}
      words={untilWords}
      picture={<HillsPostcard hills={swoopDay(next).hills} w={640} h={360} />}
    />
  )
}
