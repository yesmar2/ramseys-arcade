import { useEffect, useState } from 'react'
import { isDailyGame, isRankedGame } from '../data/games'
import { useActiveGroup } from '../lib/groups'
import {
  fetchLeaderboardsSummary,
  type GameBoardPreview,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

/** How many of each board's top runs a cabinet's high-score table shows. */
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
    // A daily's table is today's runs: its week, month and all time are day points, not runs. A daily just
    // for fun has no table: it names nobody (data/games.ts Game.ranked).
    if (isDailyGame(game.slug) !== (period === 'daily') || !isRankedGame(game.slug)) continue
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
 * shows the leader under every cabinet, the way an arcade shows the high
 * score on every machine, and the three as the table over its screen.
 */
export function useBoardLeaders(period: LeaderboardPeriod): Record<string, BoardLeader> | null {
  const groupId = useActiveGroup()
  const [leaders, setLeaders] = useState<Record<string, BoardLeader> | null>(null)

  useEffect(() => {
    let cancelled = false
    // The period's tables, all time's for a board nobody's on yet, and today's for the dailies.
    const loads = [
      fetchLeaderboardsSummary(period, TABLE),
      period !== 'all' ? fetchLeaderboardsSummary('all', TABLE) : Promise.resolve(null),
      period !== 'daily' ? fetchLeaderboardsSummary('daily', TABLE) : Promise.resolve(null),
    ]
    Promise.all(loads)
      .then(([current, allTime, today]) => {
        if (cancelled) return
        const next: Record<string, BoardLeader> = {}
        topOf(current ?? [], period, next)
        if (allTime) topOf(allTime, 'all', next)
        if (today) topOf(today, 'daily', next)
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
