import { useEffect, useState } from 'react'
import { useActiveGroup } from '../lib/groups'
import {
  fetchLeaderboardsSummary,
  type GameBoardPreview,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

export type BoardLeader = {
  entry: LeaderboardEntry
  /** Whether this is the period's leader or, with nobody on the period's board yet, the all-time holder. */
  period: LeaderboardPeriod
}

function topOf(games: GameBoardPreview[], period: LeaderboardPeriod, into: Record<string, BoardLeader>) {
  for (const game of games) {
    const entry = game.entries[0]
    if (entry && !into[game.slug]) into[game.slug] = { entry, period }
  }
}

/**
 * Who leads each game's board for a period: the top entry per slug, from the
 * one summary request the boards page also makes. Early in a week or month
 * a board can be empty, so a game nobody has played yet this period falls
 * back to its all-time holder, marked as such. Null until it lands; a game
 * with no scores at all is simply absent. The wall shows it under every
 * cabinet, the way an arcade shows the high score on every machine.
 */
export function useBoardLeaders(period: LeaderboardPeriod): Record<string, BoardLeader> | null {
  const groupId = useActiveGroup()
  const [leaders, setLeaders] = useState<Record<string, BoardLeader> | null>(null)

  useEffect(() => {
    let cancelled = false
    const loads = [fetchLeaderboardsSummary(period, 1)]
    if (period !== 'all') loads.push(fetchLeaderboardsSummary('all', 1))
    Promise.all(loads)
      .then(([current, allTime]) => {
        if (cancelled) return
        const next: Record<string, BoardLeader> = {}
        topOf(current ?? [], period, next)
        if (allTime) topOf(allTime, 'all', next)
        setLeaders(next)
      })
      .catch(() => {
        if (!cancelled) setLeaders(null)
      })
    return () => {
      cancelled = true
    }
  }, [period, groupId])

  return leaders
}
