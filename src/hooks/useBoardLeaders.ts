import { useEffect, useState } from 'react'
import { useActiveGroup } from '../lib/groups'
import {
  fetchLeaderboardsSummary,
  type GameBoardPreview,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

/** How many of each board's top runs a cabinet shows in its high-score table. */
const TABLE = 3

export type BoardLeader = {
  entry: LeaderboardEntry
  /** The board's top runs, best first, the leader's among them: the cabinet's high-score table. */
  entries: LeaderboardEntry[]
  /** Whether these are the period's or, with nobody on the period's board yet, all time's. */
  period: LeaderboardPeriod
}

function topOf(games: GameBoardPreview[], period: LeaderboardPeriod, into: Record<string, BoardLeader>) {
  for (const game of games) {
    const entry = game.entries[0]
    if (entry && !into[game.slug]) into[game.slug] = { entry, entries: game.entries.slice(0, TABLE), period }
  }
}

/**
 * Who leads each game's board for a period, and the two runs behind: the top
 * entries per slug, from the one summary request the boards page also makes.
 * Early in a week or month a board can be empty, so a game nobody has played
 * yet this period falls back to its all-time table, marked as such. Null
 * until it lands; a game with no scores at all is simply absent. The wall
 * shows the leader on every cabinet and the three as its high-score table,
 * the way an arcade does.
 */
export function useBoardLeaders(period: LeaderboardPeriod): Record<string, BoardLeader> | null {
  const groupId = useActiveGroup()
  const [leaders, setLeaders] = useState<Record<string, BoardLeader> | null>(null)

  useEffect(() => {
    let cancelled = false
    const loads = [fetchLeaderboardsSummary(period, TABLE)]
    if (period !== 'all') loads.push(fetchLeaderboardsSummary('all', TABLE))
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
