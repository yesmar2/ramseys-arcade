import { useMemo } from 'react'
import { AceChaseGame } from '../games/acechase/AceChaseGame'
import { TEST_HOLES } from '../games/acechase/trialHoles'
import { useRoute } from '../hooks/useHashRoute'
import { todaysHole } from '../lib/dailyHole'

/**
 * Ace Chase's page: a round of its three holes; at /games/acechase/daily, Today's Hole; and with
 * ?hole=<key> on the play page, a hole on trial (see TEST_HOLES), or with ?hole=day:YYYY-MM-DD, any day's
 * Today's Hole played as a trial, to look ahead. Nothing links to either.
 */
export function AceChasePage() {
  const route = useRoute()
  const daily = route.name === 'gamePlay' && route.daily === true
  const key = route.name === 'gamePlay' && !daily ? route.hole : undefined
  // One hole for the visit: the physics keeps each hole's rails by the hole.
  const test = useMemo(() => {
    const day = key && /^day:\d{4}-\d{2}-\d{2}$/.test(key) ? key.slice(4) : null
    return day ? todaysHole(day).def : key ? TEST_HOLES[key] : undefined
  }, [key])
  return (
    <main className="game-page game-page--fullscreen">
      <AceChaseGame key={daily ? 'daily' : test ? `test-${key}` : 'round'} daily={daily} test={test} />
    </main>
  )
}
