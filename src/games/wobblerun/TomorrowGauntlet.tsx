import { TomorrowTease } from '../../components/TomorrowTease'
import { dayAfter } from '../../lib/dayBoard'
import { GauntletDrawing } from './GauntletDrawing'
import { dailyGauntlet, gauntletDay, msUntilNextGauntlet, untilWords } from './daily'

/**
 * Tomorrow's gauntlet on a run's report, its rounds to the crown as its Past card draws them; none once it's out
 * already. Knowing tomorrow's rounds tells nobody how to run them.
 */
export function TomorrowGauntlet({ day }: { day: string }) {
  const next = dayAfter(day)
  // A run begun before midnight and finished after it: its tomorrow is today, and open already.
  if (next <= gauntletDay()) return null
  const gauntlet = dailyGauntlet(next)
  return (
    <TomorrowTease
      noun="gauntlet"
      n={gauntlet.n}
      name={gauntlet.name}
      msLeft={msUntilNextGauntlet}
      words={untilWords}
      picture={<GauntletDrawing gauntlet={gauntlet} name={gauntlet.name} w={640} h={360} />}
    />
  )
}
