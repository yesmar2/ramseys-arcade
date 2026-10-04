import { ArchiveGate } from '../components/archive/ArchiveGate'
import { caveDay, FIRST_DAY, testRunDay } from '../games/lander/daily'
import { LanderGame } from '../games/lander/LanderGame'
import { useRoute } from '../hooks/useHashRoute'

const isDay = (day: string | undefined): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)

/**
 * Lander's page: today's cave. With ?day=YYYY-MM-DD, a past day's from the Past tab, flown again as practice,
 * where nothing is kept; or today's or one still to come, from the admin's Cave Book, as an admin's test flight
 * (LanderGame sends anyone else to today's). A day before the first isn't shown, and one older than a
 * week is Plus's (components/archive/ArchiveGate.tsx).
 */
export function LanderPage() {
  const route = useRoute()
  const asked = route.name === 'gamePlay' ? route.day : undefined
  const day = isDay(asked) && asked >= FIRST_DAY && asked < caveDay() ? asked : null
  const test = testRunDay(asked)
  return (
    <main className="game-page game-page--fullscreen">
      <ArchiveGate slug="lander" day={day}>
        <LanderGame key={day ?? 'today'} practiceDay={day} testDay={test} />
      </ArchiveGate>
    </main>
  )
}
