import { FindBugGame } from '../games/findbug/FindBugGame'
import { useRoute } from '../hooks/useHashRoute'

/**
 * Find the Bug's page: Today's Wanted, the day's five scenes. With ?day=YYYY-MM-DD, a past day's, played
 * again from the game page's Past days, where nothing is kept.
 */
export function FindBugPage() {
  const route = useRoute()
  const day = route.name === 'gamePlay' ? route.day : undefined
  return (
    <main className="game-page game-page--fullscreen">
      <FindBugGame key={day ?? 'today'} day={day} />
    </main>
  )
}
