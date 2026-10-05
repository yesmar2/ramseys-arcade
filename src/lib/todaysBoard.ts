import { useEffect, useState } from 'react'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { getPlayerBoard, type LeaderboardGame } from './leaderboard'

/*
 * A time-trial daily's board for its Today's card (Hot Lap's Today's Track, Marble Run's Today's Course):
 * how many are on it today, who leads, and where you are, each player at their best run of the day. The
 * API counts the players and places (getPlayerBoard), so it's one small ask however busy the day.
 */

export type TodayBoard = {
  /** Players on today's board, at their best runs. */
  count: number
  leader: { name: string; score: number } | null
  you: { place: number; score: number } | null
}

/** Today's board, fetched again when the day turns or your best today changes. */
export function useTodaysBoard(slug: LeaderboardGame, day: string, me: string): TodayBoard | null {
  const [board, setBoard] = useState<TodayBoard | null>(null)
  const best = usePersonalBest(slug)
  useEffect(() => {
    let cancelled = false
    getPlayerBoard(slug, 'daily', me || undefined, { limit: 1, around: 0 })
      .then((b) => {
        if (cancelled) return
        const top = b.entries[0]
        setBoard({
          count: b.total,
          leader: top ? { name: top.name, score: top.score } : null,
          you: b.you ? { place: b.you.place, score: b.you.score } : null,
        })
      })
      .catch(() => {
        if (!cancelled) setBoard(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug, day, me, best])
  return board
}
