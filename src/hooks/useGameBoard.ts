import { useEffect, useState } from 'react'
import { bandLine, boardPlayer, youFromBoard, type BoardPlayer, type BoardYou } from '../lib/gameBoard'
import {
  getPlayerBoard,
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type PlayerBoard,
} from '../lib/leaderboard'

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
 * One game's board for a period, as it opens on the game's page: its first players, and the viewer's place
 * with the players either side, all counted by the API (one small ask, however big the board). The rest are
 * asked a page at a time as they're opened.
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
        if (cancelled) return
        setData({ loading: false, error: false, ...openingBoard(first, slug) })
      } catch {
        if (!cancelled) setData({ ...LOADING, loading: false, error: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug, period, playerName, groupId])

  return data
}
