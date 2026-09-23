import { useEffect, useState } from 'react'
import {
  fetchGlobalRank,
  fetchLeaderboardsSummary,
  getLeaderboard,
  normalizePlayerName,
  VISIBLE_LEADERBOARD_GAMES,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type YouEntry,
} from '../lib/leaderboard'
import { distinctTop, type BoardTop } from '../lib/scoreboard'

export type OtherBoard = {
  slug: LeaderboardGame
  leader: BoardTop | null
  /** The viewer's place on it this period, if they have one. */
  place: number | null
}

export type GameBoardData = {
  loading: boolean
  error: boolean
  /** Every run on the board this period, best first (up to RUN_CAP). */
  runs: LeaderboardEntry[]
  /** Runs on the board, loaded or not. */
  total: number
  /** The viewer's best run and its place among runs, when they have one. */
  youRun: YouEntry | null
  /** The viewer's best on this game over all time, for a period they have not played. */
  allTimeBest: number | null
  /** The other boards, the viewer's first; arrives after the rest. */
  others: OtherBoard[]
}

const LOADING: GameBoardData = {
  loading: true,
  error: false,
  runs: [],
  total: 0,
  youRun: null,
  allTimeBest: null,
  others: [],
}

/** Runs per request: the most the API sends at once. */
const PAGE = 500

/**
 * How many runs to read at most. Places are counted from every run, so the
 * whole board is read; this only guards the page against a board that has
 * grown past anything it was built for.
 */
const RUN_CAP = 2000

/**
 * One game's board for a period, whole: every run (so places can be counted
 * by player), the viewer's best, and their best over all time when they have
 * not played this period. The other boards' leaders follow separately.
 */
export function useGameBoard(
  slug: LeaderboardGame,
  period: LeaderboardPeriod,
  playerName: string,
  groupId: string | null,
): GameBoardData {
  const [data, setData] = useState<GameBoardData>(LOADING)

  useEffect(() => {
    let cancelled = false
    const me = normalizePlayerName(playerName)
    setData(LOADING)

    void (async () => {
      try {
        const first = await getLeaderboard(slug, period, me || undefined, { limit: PAGE })
        const runs = [...first.entries]
        while (runs.length < first.total && runs.length < RUN_CAP) {
          const next = await getLeaderboard(slug, period, undefined, { offset: runs.length, limit: PAGE })
          if (!next.entries.length) break
          runs.push(...next.entries)
        }
        let allTimeBest: number | null = null
        if (me && !first.you && period !== 'all') {
          try {
            allTimeBest = (await getLeaderboard(slug, 'all', me, { limit: 1 })).you?.score ?? null
          } catch {
            /* the line falls back to how to get on */
          }
        }
        if (cancelled) return
        setData({
          loading: false,
          error: false,
          runs,
          total: first.total,
          youRun: first.you,
          allTimeBest,
          others: [],
        })
      } catch {
        if (!cancelled) setData({ ...LOADING, loading: false, error: true })
        return
      }

      // The way onward: the other boards' leaders, and the viewer's places on them. The board reads fine without it.
      try {
        const [summary, mine] = await Promise.all([
          fetchLeaderboardsSummary(period, 3),
          me ? fetchGlobalRank(me, period).catch(() => null) : Promise.resolve(null),
        ])
        if (cancelled) return
        const leaders = new Map(summary.map((g) => [g.slug, distinctTop(g.entries, 1)[0] ?? null]))
        const places = mine?.byGame ?? {}
        const others = VISIBLE_LEADERBOARD_GAMES.filter((g) => g !== slug).map((g) => ({
          slug: g,
          leader: leaders.get(g) ?? null,
          place: places[g]?.place ?? null,
        }))
        setData((prev) => ({ ...prev, others }))
      } catch {
        /* no list of other boards, then */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug, period, playerName, groupId])

  return data
}
