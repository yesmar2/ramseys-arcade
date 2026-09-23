import { useEffect, useState } from 'react'
import { playersFromRuns, type BoardPlayer } from '../lib/gameBoard'
import {
  getLeaderboard,
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { fetchGameRecords, gameHasRecords, type RecordSummary } from '../lib/records'
import { getActiveTournamentsForGame, type TournamentSummary } from '../lib/tournaments'

/*
 * What a game's page reads, each part on its own so each section fills in as
 * its answer lands: the period's board as players, the all-time high score for
 * the screen, the record book, and the events the game is in.
 */

export type HubBoard = {
  loading: boolean
  error: boolean
  players: BoardPlayer[]
  /** Every run on the board this period (up to the cap), best first. */
  runs: LeaderboardEntry[]
  /** The viewer's best over all time, when they are not on this period's board. */
  allTimeBest: number | null
  /** An empty period's stand-in: the month's best (or all time's), to aim at. */
  aimAt: { period: LeaderboardPeriod; players: BoardPlayer[] } | null
}

const BOARD_LOADING: HubBoard = { loading: true, error: false, players: [], runs: [], allTimeBest: null, aimAt: null }

/** Runs per request, and the most read: places are counted from every run. */
const PAGE = 500
const RUN_CAP = 2000

async function allRuns(slug: LeaderboardGame, period: LeaderboardPeriod, me: string) {
  const first = await getLeaderboard(slug, period, me || undefined, { limit: PAGE })
  const runs = [...first.entries]
  while (runs.length < first.total && runs.length < RUN_CAP) {
    const next = await getLeaderboard(slug, period, undefined, { offset: runs.length, limit: PAGE })
    if (!next.entries.length) break
    runs.push(...next.entries)
  }
  return { runs, you: first.you }
}

/** The period's board as players, the viewer's all-time best when they are off it, and a stand-in when it is empty. */
export function useHubBoard(
  slug: LeaderboardGame | null,
  period: LeaderboardPeriod,
  playerName: string,
  groupId: string | null,
): HubBoard {
  const [data, setData] = useState<HubBoard>(BOARD_LOADING)

  useEffect(() => {
    if (!slug) {
      setData({ ...BOARD_LOADING, loading: false })
      return
    }
    let cancelled = false
    const me = normalizePlayerName(playerName)
    setData(BOARD_LOADING)
    void (async () => {
      try {
        const { runs, you } = await allRuns(slug, period, me)
        const players = playersFromRuns(runs)
        let allTimeBest: number | null = null
        if (me && !you && period !== 'all') {
          allTimeBest = await getLeaderboard(slug, 'all', me, { limit: 1 })
            .then((b) => b.you?.score ?? null)
            .catch(() => null)
        }
        let aimAt: HubBoard['aimAt'] = null
        if (players.length === 0 && period !== 'all') {
          // Nobody on it yet: the month's best to aim at, or all time's when the month is empty too.
          const widths: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'all']
          for (const wider of widths.slice(widths.indexOf(period) + 1)) {
            const board = await getLeaderboard(slug, wider, undefined, { limit: 60 }).catch(() => null)
            const top = board ? playersFromRuns(board.entries).slice(0, 3) : []
            if (top.length) {
              aimAt = { period: wider, players: top }
              break
            }
          }
        }
        if (!cancelled) setData({ loading: false, error: false, players, runs, allTimeBest, aimAt })
      } catch {
        if (!cancelled) setData({ ...BOARD_LOADING, loading: false, error: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, period, playerName, groupId])

  return data
}

/** The game's all-time best run, for the high score on its screen. */
export function useHubHighScore(slug: LeaderboardGame | null, groupId: string | null): LeaderboardEntry | null {
  const [top, setTop] = useState<LeaderboardEntry | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setTop(null)
    getLeaderboard(slug, 'all', undefined, { limit: 1 })
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

/** The game's record book, with the viewer's standing on each record. Null while it loads, or for a game without one. */
export function useHubRecords(slug: string, playerName: string, groupId: string | null): RecordSummary[] | null {
  const [records, setRecords] = useState<RecordSummary[] | null>(null)
  useEffect(() => {
    if (!gameHasRecords(slug)) {
      setRecords(null)
      return
    }
    let cancelled = false
    setRecords(null)
    const me = normalizePlayerName(playerName)
    fetchGameRecords(slug, 'all', me || undefined)
      .then((book) => {
        if (!cancelled) setRecords(book.records)
      })
      .catch(() => {
        if (!cancelled) setRecords([])
      })
    return () => {
      cancelled = true
    }
  }, [slug, playerName, groupId])
  return records
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
