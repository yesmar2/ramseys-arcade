import { useEffect, useMemo, useState } from 'react'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  getLeaderboard,
  getPlayerBoard,
  isPlayerTag,
  VISIBLE_LEADERBOARD_PERIODS,
  type GlobalGamePlace,
  type GlobalRankNearby,
  type GlobalRankResult,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { useSeason } from '../lib/season'
import { seasonHasStandings } from '../lib/seasonStandings'

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
  // The season's rank too while a season has standings: its row on the card, and the card itself when the
  // site's period is the season. Asked on its own, so the season's arriving later doesn't ask the rest again.
  const withSeason = seasonHasStandings(useSeason().season)
  const [season, setSeason] = useState<{ key: string; rank: GlobalRankResult | null }>({ key: '', rank: null })

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

  useEffect(() => {
    if (!name || !withSeason) return
    let cancelled = false
    fetchGlobalRank(name, 'season')
      .catch(() => EMPTY_RANK)
      .then((rank) => {
        if (!cancelled) setSeason({ key, rank })
      })
    return () => {
      cancelled = true
    }
  }, [key, name, withSeason])

  const base = state.key === key ? state.ranks : EMPTY_RANKS
  const seasonRank = withSeason && season.key === key ? season.rank : null
  return useMemo(() => (seasonRank ? { ...base, season: seasonRank } : base), [base, seasonRank])
}

const EMPTY_RANKS: PeriodRanks = {}

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
 * Whether a tag is a player's, or null while that's asked (lib/leaderboard.ts isPlayerTag): someone else's
 * card, for a tag that's nobody's, says so rather than drawing a player. Runs the page already has of theirs
 * (`played`) settle it without the ask. No name asks nothing. A check that fails counts as a player, so a real
 * one is never shown as missing.
 */
export function useIsPlayer(name: string, played: boolean): boolean | null {
  const [state, setState] = useState<{ name: string; player: boolean }>({ name: '', player: true })

  useEffect(() => {
    if (!name || played) return
    let cancelled = false
    isPlayerTag(name)
      .catch(() => true)
      .then((player) => {
        if (!cancelled) setState({ name, player })
      })
    return () => {
      cancelled = true
    }
  }, [name, played])

  if (!name || played) return true
  return state.name === name ? state.player : null
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
  /** `groupId` when it's the page's own, not the site's (useScoreboard). */
  pageGroup?: string,
): { scores: Record<number, number>; ready: boolean } {
  const wanted = [...new Set(places.filter((p) => p >= 1))].sort((a, b) => a - b).join(',')
  const key = `${groupId ?? ''}|${period}|${wanted}`
  const [state, setState] = useState<{ key: string; scores: Record<number, number> }>({ key: '', scores: {} })

  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    void Promise.all(
      wanted.split(',').map(Number).map((place) =>
        fetchGlobalBoard(1, period, place - 1, pageGroup)
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
  }, [key, period, wanted, pageGroup])

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
 * The players around one on a game's all-time board, a row each (its players mode): the top five when the
 * player is among them, otherwise the two either side; and the player on the line being chased, with the place
 * a run just better than theirs takes (`beatPlace`, past any tied with them).
 */
export function usePlayersAround(
  slug: string | null,
  place: number,
  lineRank: number | null,
  groupId: string | null,
): { rows: BoardRow[]; line: (BoardRow & { beatPlace: number }) | null } | null {
  const key = slug ? `${groupId ?? ''}|${slug}|${place}|${lineRank ?? ''}` : ''
  const [state, setState] = useState<{ key: string; rows: BoardRow[]; line: (BoardRow & { beatPlace: number }) | null }>({
    key: '',
    rows: [],
    line: null,
  })

  useEffect(() => {
    if (!slug || place < 1) return
    let cancelled = false
    const from = place <= 5 ? 0 : place - 3
    getPlayerBoard(slug, 'all', undefined, { offset: from, limit: 5, marks: lineRank != null ? [lineRank] : undefined })
      .catch(() => null)
      .then((board) => {
        if (cancelled) return
        const rows = (board?.entries ?? []).map((entry) => ({ rank: entry.place, entry }))
        const mark = board?.marked[0]
        setState({ key, rows, line: mark ? { rank: mark.place, entry: mark, beatPlace: mark.beatPlace } : null })
      })
    return () => {
      cancelled = true
    }
  }, [key, slug, place, lineRank])

  if (!slug) return null
  return state.key === key ? { rows: state.rows, line: state.line } : null
}
