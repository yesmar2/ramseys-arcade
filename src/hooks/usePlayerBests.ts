import { useEffect, useState } from 'react'
import { useActiveGroup } from '../lib/groups'
import { fetchPlayerBests, type LeaderboardPeriod } from '../lib/leaderboard'

/**
 * Your best score on each game for a period, by slug. Null with no tag or
 * while the fetch is on its way; refetched when the active group changes,
 * since the boards are group-scoped on the wire.
 */
export function usePlayerBests(name: string, period: LeaderboardPeriod): Record<string, number> | null {
  const groupId = useActiveGroup()
  const [bests, setBests] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (!name) {
      setBests(null)
      return
    }
    let cancelled = false
    fetchPlayerBests(name, period)
      .then((next) => {
        if (!cancelled) setBests(next)
      })
      .catch(() => {
        if (!cancelled) setBests(null)
      })
    return () => {
      cancelled = true
    }
  }, [name, period, groupId])

  return bests
}
