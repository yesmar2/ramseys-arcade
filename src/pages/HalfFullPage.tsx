import { FIRST_DAY, isDay, pourDay } from '../games/halffull/daily'
import { HalfFullGame } from '../games/halffull/HalfFullGame'
import { useRoute } from '../hooks/useHashRoute'

/**
 * Half Full's page: today's five glasses. With ?day=YYYY-MM-DD, a past day's from the archive, poured
 * again as practice, where nothing is kept. A day still to come isn't shown, nor one before the first.
 */
export function HalfFullPage() {
  const route = useRoute()
  const asked = route.name === 'gamePlay' ? route.day : undefined
  const day = isDay(asked) && asked >= FIRST_DAY && asked < pourDay() ? asked : null
  return (
    <main className="game-page game-page--fullscreen">
      <HalfFullGame key={day ?? 'today'} testDay={day} />
    </main>
  )
}
