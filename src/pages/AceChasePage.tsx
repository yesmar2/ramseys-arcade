import { useMemo } from 'react'
import { AceChaseGame } from '../games/acechase/AceChaseGame'
import { useRoute } from '../hooks/useHashRoute'
import { dailyDay, todaysHole } from '../lib/dailyHole'

/**
 * Ace Chase's page: Today's Hole, the one hole everyone plays today. With ?hole=day:YYYY-MM-DD, another
 * day's hole: a past one from the archive, whose own board stays open for a player's first result on it
 * (lib/pastHoles.ts), or one ahead of its day, on trial, where nothing is kept (the admin's Hole Book links
 * to those). Today's own day is Today's Hole. (/games/acechase/daily, where Today's Hole was before it was
 * all of Ace Chase, is this page too.)
 */
export function AceChasePage() {
  const route = useRoute()
  const key = route.name === 'gamePlay' ? route.hole : undefined
  const day = key && /^day:\d{4}-\d{2}-\d{2}$/.test(key) ? key.slice(4) : null
  // One hole for the visit: the physics keeps each hole's rails by the hole.
  const hole = useMemo(() => (day ? todaysHole(day) : undefined), [day])
  const today = dailyDay()
  const past = hole && hole.day < today ? hole : undefined
  const ahead = hole && hole.day > today ? hole : undefined
  return (
    <main className="game-page game-page--fullscreen">
      <AceChaseGame key={past ? `past-${past.day}` : ahead ? `ahead-${ahead.day}` : 'today'} ahead={ahead} past={past} />
    </main>
  )
}
