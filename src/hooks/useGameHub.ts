import { useEffect, useState } from 'react'
import { isDailyGame } from '../data/games'
import { getLeaderboard, type LeaderboardEntry, type LeaderboardGame } from '../lib/leaderboard'
import { getActiveTournamentsForGame, type TournamentSummary } from '../lib/tournaments'

/*
 * What a game's page reads beside its board and its records (components/GameBoard.tsx GamePageBoard,
 * RecordBookView): the all-time high score for the screen, and the events the game is in.
 */

/** The game's all-time best run, for the high score on its screen. */
export function useHubHighScore(slug: LeaderboardGame | null, groupId: string | null): LeaderboardEntry | null {
  const [top, setTop] = useState<LeaderboardEntry | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setTop(null)
    // A daily's all time is its day points, not a run: its screen shows who's 1st today instead.
    getLeaderboard(slug, isDailyGame(slug) ? 'daily' : 'all', undefined, { limit: 1 })
      .then((board) => {
        if (!cancelled) setTop(board.entries[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setTop(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug, groupId])
  return top
}

/** Events running now that count this game. */
export function useHubEvents(slug: string): TournamentSummary[] {
  const [events, setEvents] = useState<TournamentSummary[]>([])
  useEffect(() => {
    let cancelled = false
    setEvents([])
    getActiveTournamentsForGame(slug)
      .then((list) => {
        if (!cancelled) setEvents(list.filter((t) => t.status !== 'ended'))
      })
      .catch(() => {
        /* no events line, then */
      })
    return () => {
      cancelled = true
    }
  }, [slug])
  return events
}
