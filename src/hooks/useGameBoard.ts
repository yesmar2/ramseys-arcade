import { useEffect, useState } from 'react'
import { isDailyGame } from '../data/games'
import { bandLine, boardPlayer, youFromBoard, type BoardPlayer, type BoardYou } from '../lib/gameBoard'
import {
  fetchGlobalRank,
  fetchLeaderboardsSummary,
  getLeaderboard,
  getPlayerBoard,
  normalizePlayerName,
  RANKED_LEADERBOARD_GAMES,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type PlayerBoard,
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
  /** The board's first players, best first (FIRST_PLAYERS of them): the rest are asked a page at a time. */
  top: BoardPlayer[]
  /** Players on the board. */
  field: number
  /** Runs on the board. */
  runCount: number
  /** Where the viewer stands, when they're on it: their row, the ones either side, their runs. */
  you: BoardYou | null
  /** The viewer and the players either side of them, by place. */
  around: BoardPlayer[]
  /** "Beat 4,890 to reach the top half", for a viewer below the top ten. */
  bandLine: string | null
  /** The viewer's best run, with their avatar, when they have one. */
  youRun: LeaderboardEntry | null
  /** The viewer's best on this game over all time, for a period they have not played. */
  allTimeBest: number | null
  /** The other boards, the viewer's first; arrives after the rest. */
  others: OtherBoard[]
}

const LOADING: GameBoardData = {
  loading: true,
  error: false,
  top: [],
  field: 0,
  runCount: 0,
  you: null,
  around: [],
  bandLine: null,
  youRun: null,
  allTimeBest: null,
  others: [],
}

/** Players a board opens on. */
export const FIRST_PLAYERS = 10

/** The board as it opens, from the API's players board. */
export function openingBoard(board: PlayerBoard, slug: string) {
  return {
    top: board.entries.map(boardPlayer),
    field: board.total,
    runCount: board.runs,
    you: youFromBoard(board),
    around: board.around.map(boardPlayer),
    bandLine: bandLine(slug, board.band),
    youRun: board.you,
  }
}

/**
 * One game's board for a period, as it opens: its first players, the viewer's place with the players either
 * side, and their best over all time when they have not played this period, all counted by the API (one
 * small ask, however big the board). The rest are asked a page at a time as they're opened. The other
 * boards' leaders follow separately.
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
        const first = await getPlayerBoard(slug, period, me || undefined, { limit: FIRST_PLAYERS, around: 2 })
        let allTimeBest: number | null = null
        // A daily's run on another day was on another track, hole or scenes: nothing to measure today's board by.
        if (me && !first.you && period !== 'all' && !isDailyGame(slug)) {
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
          ...openingBoard(first, slug),
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
        // Only a daily has a board for today, so today's way onward is the other dailies.
        const others = RANKED_LEADERBOARD_GAMES.filter((g) => g !== slug && (period !== 'daily' || isDailyGame(g))).map((g) => ({
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
