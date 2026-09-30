import { useEffect, useMemo } from 'react'
import { AceChaseGame, AceChasePastGame } from '../games/acechase/AceChaseGame'
import { useAuth } from '../hooks/useAuth'
import { gamePlayHref, navigate, useRoute } from '../hooks/useHashRoute'
import { useAdminState } from '../lib/admin'
import { dailyDay, todaysHole } from '../lib/dailyHole'

/**
 * Ace Chase's page: Today's Hole, the one hole everyone plays today. With ?hole=day:YYYY-MM-DD, another
 * day's hole: a past one from its row on Past holes, whose own board stays open for a player's first result
 * on it (lib/pastHoles.ts), or, for an admin, one ahead of its day, on trial, where nothing is kept (the
 * admin's Hole Book links to those). Anyone else asking for a hole ahead of its day gets Today's Hole, and
 * so does today's own day. (/games/acechase/daily, where Today's Hole was before it was all of Ace Chase,
 * is this page too.)
 */
export function AceChasePage() {
  const route = useRoute()
  const { loading } = useAuth()
  const admin = useAdminState()
  const key = route.name === 'gamePlay' ? route.hole : undefined
  const day = key && /^day:\d{4}-\d{2}-\d{2}$/.test(key) ? key.slice(4) : null
  // One hole for the visit: the physics keeps each hole's rails by the hole.
  const hole = useMemo(() => (day ? todaysHole(day) : undefined), [day])
  const today = dailyDay()
  const past = hole && hole.day < today ? hole : undefined
  const later = hole && hole.day > today ? hole : undefined
  const ahead = later && admin === true ? later : undefined
  // Not an admin, once who's signed in is known and the API has said so: the hole to come stays hidden, and
  // the address says so. Until then (admin undefined) the page shows nothing.
  const turnedAway = Boolean(later && admin === false && !loading)
  useEffect(() => {
    if (turnedAway) navigate(gamePlayHref('acechase'), { replace: true })
  }, [turnedAway])
  return (
    <main className="game-page game-page--fullscreen">
      {past ? (
        <AceChasePastGame key={`past-${past.day}`} hole={past} />
      ) : later && !ahead && !turnedAway ? null : (
        <AceChaseGame key={ahead ? `ahead-${ahead.day}` : 'today'} ahead={ahead} />
      )}
    </main>
  )
}
