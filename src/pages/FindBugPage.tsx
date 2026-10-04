import { ArchiveGate } from '../components/archive/ArchiveGate'
import { FindBugGame } from '../games/findbug/FindBugGame'
import { useRoute } from '../hooks/useHashRoute'

/**
 * Find the Bug's page: Today's Wanted, the day's five scenes. With ?day=YYYY-MM-DD, a past day's, played
 * again from the game page's Past days, where nothing is kept. One older than a week is Plus's
 * (components/archive/ArchiveGate.tsx).
 */
export function FindBugPage() {
  const route = useRoute()
  const day = route.name === 'gamePlay' ? route.day : undefined
  const past = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
  return (
    <main className="game-page game-page--fullscreen">
      <ArchiveGate slug="findbug" day={past}>
        <FindBugGame key={day ?? 'today'} day={day} />
      </ArchiveGate>
    </main>
  )
}
