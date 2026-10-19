import { TomorrowTease } from '../../components/TomorrowTease'
import { dayAfter } from '../../lib/dayBoard'
import { TowerPostcard } from './TowerPostcard'
import { dailyTower, towerDay, msUntilNextTower, untilWords } from './daily'
import { slingDay } from './runs'

/** Tomorrow's tower on a run's report, from the side as their Past card draws them; none once they're out already. */
export function TomorrowTower({ day }: { day: string }) {
  const next = dayAfter(day)
  // A run begun before midnight and finished after it: its tomorrow is today, and open already.
  if (next <= towerDay()) return null
  const tower = dailyTower(next)
  return (
    <TomorrowTease
      noun="tower"
      n={tower.n}
      name={tower.name}
      msLeft={msUntilNextTower}
      words={untilWords}
      picture={<TowerPostcard tower={slingDay(next).tower} w={640} h={360} />}
    />
  )
}
