import { AceChaseGame } from '../games/acechase/AceChaseGame'
import { TEST_HOLES } from '../games/acechase/trialHoles'
import { useRoute } from '../hooks/useHashRoute'

/**
 * Ace Chase's page: a round of its three holes; at /games/acechase/daily, Today's Hole; and with
 * ?hole=<key> on the play page, a hole on trial (see TEST_HOLES), which nothing links to.
 */
export function AceChasePage() {
  const route = useRoute()
  const daily = route.name === 'gamePlay' && route.daily === true
  const key = route.name === 'gamePlay' && !daily ? route.hole : undefined
  const test = key ? TEST_HOLES[key] : undefined
  return (
    <main className="game-page game-page--fullscreen">
      <AceChaseGame key={daily ? 'daily' : test ? `test-${key}` : 'round'} daily={daily} test={test} />
    </main>
  )
}
