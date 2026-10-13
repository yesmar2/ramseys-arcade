import { useEffect, useState } from 'react'
import { isDailyGame } from '../data/games'
import { getLeaderboard, type LeaderboardEntry, type LeaderboardGame } from '../lib/leaderboard'
import { getActiveTournamentsForGame, type TournamentSummary } from '../lib/tournaments'

/*
 * What a game's page reads beside its board and its records (components/GameBoard.tsx GamePageBoard,
 * RecordBookView): the all-time high score for the screen, and the events the game is in.
 */

/**
 * The game's all-time best run, for the high score on its screen: null when nobody has a run on it, undefined
 * while it's on its way or when it couldn't be read, which never says the board is empty. A new `asks` asks again
 * (the board's Try again).
 */
export function useHubHighScore(slug: LeaderboardGame | null, groupId: string | null, asks = 0): LeaderboardEntry | null | undefined {
  const [top, setTop] = useState<LeaderboardEntry | null | undefined>(undefined)
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setTop(undefined)
    // A daily's all time is its day points, not a run: its screen shows who's 1st today instead.
    getLeaderboard(slug, isDailyGame(slug) ? 'daily' : 'all', undefined, { limit: 1 })
      .then((board) => {
        if (!cancelled) setTop(board.entries[0] ?? null)
      })
      .catch(() => {
        /* left unknown: a board that couldn't be read isn't an empty one */
      })
    return () => {
      cancelled = true
    }
  }, [slug, groupId, asks])
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
