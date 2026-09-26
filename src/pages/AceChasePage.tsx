import { AceChaseGame } from '../games/acechase/AceChaseGame'
import { useRoute } from '../hooks/useHashRoute'

/** Ace Chase's page: a round of its three holes, or at /games/acechase/daily, Today's Hole. */
export function AceChasePage() {
  const route = useRoute()
  const daily = route.name === 'gamePlay' && route.daily === true
  return (
    <main className="game-page game-page--fullscreen">
      <AceChaseGame key={daily ? 'daily' : 'round'} daily={daily} />
    </main>
  )
}
