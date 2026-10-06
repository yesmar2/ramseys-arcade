import { ArchiveGate } from '../components/archive/ArchiveGate'
import { FIRST_DAY, hillsDay, testRunDay } from '../games/swoop/daily'
import { SwoopGame } from '../games/swoop/SwoopGame'
import { useRoute } from '../hooks/useHashRoute'

const isDay = (day: string | undefined): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)

/**
 * Swoop's page: today's hills. With ?day=YYYY-MM-DD, a past day's from the Past tab, flown again onto their
 * All time board; or today's or some still to come, from the admin's Hills Book, as an admin's test run
 * (SwoopGame sends anyone else to today's). A day before the first isn't shown, and one older than a week is
 * Plus's (components/archive/ArchiveGate.tsx).
 */
export function SwoopPage() {
  const route = useRoute()
  const asked = route.name === 'gamePlay' ? route.day : undefined
  const day = isDay(asked) && asked >= FIRST_DAY && asked < hillsDay() ? asked : null
  const test = testRunDay(asked)
  return (
    <main className="game-page game-page--fullscreen">
      <ArchiveGate slug="swoop" day={day}>
        <SwoopGame key={day ?? 'today'} practiceDay={day} testDay={test} />
      </ArchiveGate>
    </main>
  )
}
