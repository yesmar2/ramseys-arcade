import { TomorrowTease } from '../../components/TomorrowTease'
import { dayAfter } from '../../lib/dayBoard'
import { CaveDrawing } from './CaveDrawing'
import { caveDay, dailyCave, msUntilNextCave, untilWords } from './daily'
import { landerDay } from './runs'

/** Tomorrow's cave on a run's report, from the side as its Past card draws it; none once it's out already. */
export function TomorrowCave({ day }: { day: string }) {
  const next = dayAfter(day)
  // A run begun before midnight and finished after it: its tomorrow is today, and open already.
  if (next <= caveDay()) return null
  const cave = dailyCave(next)
  return (
    <TomorrowTease
      noun="cave"
      n={cave.n}
      name={cave.name}
      msLeft={msUntilNextCave}
      words={untilWords}
      picture={<CaveDrawing cave={landerDay(next).cave} />}
    />
  )
}
