import { useEffect, useState } from 'react'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  getLeaderboard,
  VISIBLE_LEADERBOARD_PERIODS,
  type GlobalGamePlace,
  type GlobalRankNearby,
  type GlobalRankResult,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

/*
 * What a player's card is drawn from, beyond the rank the header already has:
 * every period's rank, the scores sitting on the share lines above them, their
 * best run on each game with where it stands among every run, and the runs
 * around their best. Each loads on its own, so the card fills in as they land.
 */

/** A neighbour on the arcade's board. The API sends the places behind their points too. */
export type Neighbour = GlobalRankNearby & {
  games?: number
  byGame?: Partial<Record<string, GlobalGamePlace>>
}

export type PeriodRanks = Partial<Record<LeaderboardPeriod, GlobalRankResult>>

export const EMPTY_RANK: GlobalRankResult = { rank: null, score: 0, totalPlayers: 0, byGame: {}, nearby: [] }

/** The neighbours of a rank result, typed with the places the API sends for them. */
export function neighboursOf(result: GlobalRankResult): Neighbour[] {
  return (result.nearby ?? []) as Neighbour[]
}

/** The neighbour directly above a rank or, on top, the one directly below: who the card measures the player against. */
export function rivalOf(result: GlobalRankResult): Neighbour | null {
  const rank = result.rank
  if (rank == null) return null
  return neighboursOf(result).find((n) => n.rank === (rank === 1 ? 2 : rank - 1)) ?? null
}

/** Every visible period's rank for one player, fetched together since the card shows them all. */
export function usePeriodRanks(name: string, groupId: string | null): PeriodRanks {
  const key = `${groupId ?? ''}|${name}`
  const [state, setState] = useState<{ key: string; ranks: PeriodRanks }>({ key: '', ranks: {} })

  useEffect(() => {
    if (!name) return
    let cancelled = false
    void Promise.all(
      VISIBLE_LEADERBOARD_PERIODS.map((p) =>
        fetchGlobalRank(name, p)
          .then((data) => [p, data] as const)
          .catch(() => [p, EMPTY_RANK] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setState({ key, ranks: Object.fromEntries(pairs) as PeriodRanks })
    })
    return () => {
      cancelled = true
    }
  }, [key, name])

  return state.key === key ? state.ranks : {}
}

/** One player's rank for one period, or null until it lands. */
export function useRankFor(name: string, period: LeaderboardPeriod, groupId: string | null): GlobalRankResult | null {
  const key = `${groupId ?? ''}|${name}|${period}`
  const [state, setState] = useState<{ key: string; result: GlobalRankResult | null }>({ key: '', result: null })

  useEffect(() => {
    if (!name) return
    let cancelled = false
    fetchGlobalRank(name, period)
      .catch(() => EMPTY_RANK)
      .then((result) => {
        if (!cancelled) setState({ key, result })
      })
    return () => {
      cancelled = true
    }
  }, [key, name, period])

  return state.key === key ? state.result : null
}

/**
 * The points of whoever sits at each of these places on the arcade's board
 * for the period: what it takes to reach each share line. Keyed by place;
 * a place the board doesn't reach is left out.
 */
export function useScoresAt(
  period: LeaderboardPeriod,
  places: number[],
  groupId: string | null,
): { scores: Record<number, number>; ready: boolean } {
  const wanted = [...new Set(places.filter((p) => p >= 1))].sort((a, b) => a - b).join(',')
  const key = `${groupId ?? ''}|${period}|${wanted}`
  const [state, setState] = useState<{ key: string; scores: Record<number, number> }>({ key: '', scores: {} })

  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    void Promise.all(
      wanted.split(',').map(Number).map((place) =>
        fetchGlobalBoard(1, period, place - 1)
          .then(({ entries }) => [place, entries[0]?.score] as const)
          .catch(() => [place, undefined] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return
      const scores: Record<number, number> = {}
      for (const [place, score] of pairs) if (typeof score === 'number') scores[place] = score
      setState({ key, scores })
    })
    return () => {
      cancelled = true
    }
  }, [key, period, wanted])

  if (!wanted) return { scores: {}, ready: true }
  return state.key === key ? { scores: state.scores, ready: true } : { scores: {}, ready: false }
}

/** A player's best run on one game, all time, and where it stands among every run on the board. */
export type GameBest = {
  slug: string
  score: number
  rank: number
  /** Runs on the board. */
  total: number
  at: number
  /** The board's top run: the record. */
  record: LeaderboardEntry | null
}

/** How many boards are asked at once. */
const AT_ONCE = 4

/**
 * A player's best on each of these games, all time: one board request per
 * game, a few at a time. Null until they have all landed; a game the player
 * has no run on is left out.
 */
export function useGameBests(name: string, slugs: string[], groupId: string | null): Record<string, GameBest> | null {
  const games = [...slugs].sort().join(',')
  const key = `${groupId ?? ''}|${name}|${games}`
  const [state, setState] = useState<{ key: string; bests: Record<string, GameBest> }>({ key: '', bests: {} })

  useEffect(() => {
    if (!name || !games) return
    let cancelled = false
    const bests: Record<string, GameBest> = {}
    const queue = games.split(',')
    const worker = async () => {
      for (let slug = queue.shift(); slug; slug = queue.shift()) {
        try {
          const { you, total, entries } = await getLeaderboard(slug, 'all', name, { limit: 1 })
          if (you) {
            bests[slug] = { slug, score: you.score, rank: you.rank, total, at: you.at, record: entries[0] ?? null }
          }
        } catch {
          /* a board that fails is left out */
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker)).then(() => {
      if (!cancelled) setState({ key, bests })
    })
    return () => {
      cancelled = true
    }
  }, [key, name, games])

  if (!name || !games) return {}
  return state.key === key ? state.bests : null
}

export type BoardRow = { rank: number; entry: LeaderboardEntry }

/**
 * The runs around one on a game's all-time board: the top five when the run
 * is among them, otherwise the two runs either side of it; and the run
 * sitting on the line the player is chasing, when that is outside the window.
 */
export function useRunsAround(
  slug: string | null,
  rank: number,
  lineRank: number | null,
  groupId: string | null,
): { rows: BoardRow[]; line: BoardRow | null } | null {
  const key = slug ? `${groupId ?? ''}|${slug}|${rank}|${lineRank ?? ''}` : ''
  const [state, setState] = useState<{ key: string; rows: BoardRow[]; line: BoardRow | null }>({
    key: '',
    rows: [],
    line: null,
  })

  useEffect(() => {
    if (!slug || rank < 1) return
    let cancelled = false
    const from = rank <= 5 ? 0 : rank - 3
    const inWindow = lineRank != null && lineRank >= from + 1 && lineRank <= from + 5
    void Promise.all([
      getLeaderboard(slug, 'all', undefined, { offset: from, limit: 5 }).catch(() => ({ entries: [] as LeaderboardEntry[] })),
      lineRank != null && !inWindow
        ? getLeaderboard(slug, 'all', undefined, { offset: lineRank - 1, limit: 1 }).catch(() => ({
            entries: [] as LeaderboardEntry[],
          }))
        : Promise.resolve({ entries: [] as LeaderboardEntry[] }),
    ]).then(([around, atLine]) => {
      if (cancelled) return
      const rows = around.entries.map((entry, i) => ({ rank: from + 1 + i, entry }))
      const line =
        lineRank == null
          ? null
          : (rows.find((r) => r.rank === lineRank) ??
            (atLine.entries[0] ? { rank: lineRank, entry: atLine.entries[0] } : null))
      setState({ key, rows, line })
    })
    return () => {
      cancelled = true
    }
  }, [key, slug, rank, lineRank])

  if (!slug) return null
  return state.key === key ? { rows: state.rows, line: state.line } : null
}
