import { useEffect, useState } from 'react'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { playersFromRuns } from './gameBoard'
import { getLeaderboard, type LeaderboardEntry, type LeaderboardGame, type YouEntry } from './leaderboard'

/*
 * A time-trial daily's board for its Today's card (Hot Lap's Today's Track, Marble Run's Today's Course):
 * how many are on it today, who leads, and where you are, each player at their best run of the day.
 */

export type TodayBoard = {
  /** Players on today's board, at their best runs. */
  count: number
  leader: { name: string; score: number } | null
  you: { place: number; score: number } | null
}

/** Runs per request, and the most read, as the game's page reads a board (useGameHub). */
const PAGE = 500
const RUN_CAP = 2000

/*
 * The day's runs, best first, the whole board up to the cap. A board lists
 * runs, not players (the API's rank for you counts runs), so your place and
 * the count of players are taken from the runs as players (playersFromRuns),
 * the way the game's page takes them. The first read asks for you by name
 * too, so a best past the cap still has its place (the API's you.place).
 */
async function todayRuns(slug: LeaderboardGame, me: string): Promise<{ runs: LeaderboardEntry[]; you: YouEntry | null }> {
  const runs: LeaderboardEntry[] = []
  let you: YouEntry | null = null
  let total = Infinity
  while (runs.length < total && runs.length < RUN_CAP) {
    const first = runs.length === 0
    const next = await getLeaderboard(slug, 'daily', first ? me || undefined : undefined, {
      offset: runs.length,
      limit: PAGE,
    })
    if (first) you = next.you
    total = next.total
    if (!next.entries.length) break
    runs.push(...next.entries)
  }
  return { runs, you }
}

/** Today's board, fetched again when the day turns or your best today changes. */
export function useTodaysBoard(slug: LeaderboardGame, day: string, me: string): TodayBoard | null {
  const [board, setBoard] = useState<TodayBoard | null>(null)
  const best = usePersonalBest(slug)
  useEffect(() => {
    let cancelled = false
    todayRuns(slug, me)
      .then(({ runs, you }) => {
        if (cancelled) return
        const players = playersFromRuns(runs)
        const top = players[0]
        const mine = me ? players.find((p) => p.name === me) : undefined
        setBoard({
          count: players.length,
          leader: top ? { name: top.name, score: top.best.score } : null,
          // Past the read, the API's place for you (never its rank, which counts runs).
          you: mine
            ? { place: mine.place, score: mine.best.score }
            : you?.place
              ? { place: you.place, score: you.score }
              : null,
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
