import { useMemo } from 'react'
import { AceChaseGame } from '../games/acechase/AceChaseGame'
import { useRoute } from '../hooks/useHashRoute'
import { todaysHole } from '../lib/dailyHole'

/**
 * Ace Chase's page: Today's Hole, the one hole everyone plays today. With ?hole=day:YYYY-MM-DD, a day's
 * hole played ahead of its day, on trial, where nothing is kept: the admin's Hole Book links to those.
 * (/games/acechase/daily, where Today's Hole was before it was all of Ace Chase, is this page too.)
 */
export function AceChasePage() {
  const route = useRoute()
  const key = route.name === 'gamePlay' ? route.hole : undefined
  const day = key && /^day:\d{4}-\d{2}-\d{2}$/.test(key) ? key.slice(4) : null
  // One hole for the visit: the physics keeps each hole's rails by the hole.
  const ahead = useMemo(() => (day ? todaysHole(day) : undefined), [day])
  return (
    <main className="game-page game-page--fullscreen">
      <AceChaseGame key={ahead ? `ahead-${ahead.day}` : 'today'} ahead={ahead} />
    </main>
  )
}
