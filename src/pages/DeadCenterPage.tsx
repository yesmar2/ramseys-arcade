import { ArchiveGate } from '../components/archive/ArchiveGate'
import { DeadCenterGame } from '../games/dead-center/DeadCenterGame'
import { FIRST_DAY, isDay, plateDay } from '../games/dead-center/daily'
import { useRoute } from '../hooks/useHashRoute'

/**
 * Centroid's page: today's six plates. With ?day=YYYY-MM-DD, a past day's from the game page's Past days,
 * played again as practice, where nothing is kept. A day still to come isn't shown, nor one before the first.
 * One older than a week is Plus's (components/archive/ArchiveGate.tsx), as Half Full's are.
 */
export function DeadCenterPage() {
  const route = useRoute()
  const asked = route.name === 'gamePlay' ? route.day : undefined
  const day = isDay(asked) && asked >= FIRST_DAY && asked < plateDay() ? asked : null
  return (
    <main className="game-page game-page--fullscreen">
      <ArchiveGate slug="centroid" day={day}>
        <DeadCenterGame key={day ?? 'today'} pastDay={day} />
      </ArchiveGate>
    </main>
  )
}
