import { useEffect, useState } from 'react'
import { isDailyGame } from '../data/games'
import { boardPlayer, youFromBoard, type BoardPlayer, type BoardYou } from '../lib/gameBoard'
import { hubMarks, type BoardSample } from '../lib/gameHub'
import { applyBoardScope, withGroupFallback } from '../lib/groups'
import {
  api,
  fetchGlobalRank,
  getLeaderboard,
  getPlayerBoard,
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import type { RankDay } from '../lib/rankHow'
import { fetchGameRecords, gameHasRecords, type RecordSummary } from '../lib/records'
import { getActiveTournamentsForGame, type TournamentSummary } from '../lib/tournaments'

/*
 * What a game's page reads, each part on its own so each section fills in as
 * its answer lands: the period's board as players, the all-time high score for
 * the screen, the record book, and the events the game is in.
 */

/** One day the viewer played a daily: its board day, how many played it, and the place they took. */
export type HubDay = { day: string; players: number; place: number | null; points: number | null }

/**
 * A daily's viewer beyond today, over the period the header picks (a week, a month or all time): their
 * place on the daily's board for it (its day points, which is what their rank takes from it) and their
 * place across every game. The page says places, never the points.
 */
export type HubBeyond = {
  /** The period it's over: the header's, or a week when the header says today (today is the page's own board). */
  period: LeaderboardPeriod
  loading: boolean
  /** Their place on the daily's board for the period, of how many; null when they aren't on it. */
  place: { place: number; field: number | null } | null
  /** Their place across all games for the period; null when they aren't on it, or it didn't load. */
  rank: { place: number; field: number } | null
}

export type HubBoard = {
  loading: boolean
  error: boolean
  /** The board's first players, best first. */
  top: BoardPlayer[]
  /** Players on the board. */
  field: number
  /** Where the viewer stands, when they're on it. */
  you: BoardYou | null
  /** The viewer and the three players either side of them. */
  around: BoardPlayer[]
  /** What the page reads of the board (gameHub BoardSample): the above, and the places it asked for. */
  sample: BoardSample
  /** The viewer's best over all time, when they are not on this period's board. */
  allTimeBest: number | null
  /** Where a run like that best would land on this period's board. */
  wouldPlace: number | null
  /** An empty period's stand-in: the month's best (or all time's), to aim at. */
  aimAt: { period: LeaderboardPeriod; players: BoardPlayer[] } | null
  /**
   * On a daily, every day the viewer has played it, newest first (today's too, once it's in); null for any
   * other game, with no tag, or when they didn't load.
   */
  days: HubDay[] | null
}

const NO_SAMPLE: BoardSample = { field: 0, top: [], around: [], marks: new Map() }

const BOARD_LOADING: HubBoard = {
  loading: true,
  error: false,
  top: [],
  field: 0,
  you: null,
  around: [],
  sample: NO_SAMPLE,
  allTimeBest: null,
  wouldPlace: null,
  aimAt: null,
  days: null,
}

/**
 * Every day the viewer has played a daily, newest first. Null when they didn't load: the page then can't
 * tell a new player from one back again, and says neither.
 */
async function dailyDays(slug: string, me: string, groupId: string | null): Promise<HubDay[] | null> {
  return withGroupFallback(() => {
    const params = applyBoardScope(new URLSearchParams({ name: me }), groupId)
    return api<{ days?: RankDay[] }>(`/leaderboards/${encodeURIComponent(slug)}/days?${params}`)
  })
    .then((reply) =>
      (reply.days ?? [])
        .filter((d) => d.you != null)
        .map((d) => ({ day: d.day, players: d.players, place: d.you?.place ?? null, points: d.you?.points ?? null }))
        .sort((a, b) => (a.day < b.day ? 1 : -1)),
    )
    .catch(() => null)
}

/** Players a game's page reads from the top of its board: the list it shows is the top five. */
const HUB_TOP = 10

/**
 * The period's board as the page reads it (the API counts every place, so this is a few small asks however
 * big the board): its first players, the viewer's place with three either side, the places the page names
 * (gameHub hubMarks), the viewer's all-time best and where it would land when they are off it, and a
 * stand-in when it is empty.
 */
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
        // A daily's other days were other tracks, holes and scenes: nothing there to measure today by. What
        // they do tell is whether the viewer is new to it; read beside today's board.
        const daily = isDailyGame(slug)
        const [first, days] = await Promise.all([
          getPlayerBoard(slug, period, me || undefined, { limit: HUB_TOP, around: 3 }),
          daily && me ? dailyDays(slug, me, groupId) : Promise.resolve(null),
        ])
        const top = first.entries.map(boardPlayer)
        const around = first.around.map(boardPlayer)
        const you = youFromBoard(first)
        const field = first.total
        let allTimeBest: number | null = null
        if (me && !you && period !== 'all' && !daily) {
          allTimeBest = await getLeaderboard(slug, 'all', me, { limit: 1 })
            .then((b) => b.you?.score ?? null)
            .catch(() => null)
        }
        // The places the page names, and where a best from another period would land: one more small ask.
        const marks = hubMarks(field, you)
        const would = allTimeBest != null && allTimeBest > 0 ? allTimeBest : null
        const asked =
          marks.length || would != null
            ? await getPlayerBoard(slug, period, undefined, { limit: 1, marks, would }).catch(() => null)
            : null
        const sample: BoardSample = {
          field,
          top,
          around,
          marks: new Map((asked?.marked ?? []).map((m) => [m.place, { player: boardPlayer(m), beatPlace: m.beatPlace }])),
        }
        let aimAt: HubBoard['aimAt'] = null
        if (field === 0 && period !== 'all' && !daily) {
          // Nobody on it yet: the month's best to aim at, or all time's when the month is empty too.
          const widths: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'all']
          for (const wider of widths.slice(widths.indexOf(period) + 1)) {
            const board = await getPlayerBoard(slug, wider, undefined, { limit: 3 }).catch(() => null)
            const best = board ? board.entries.map(boardPlayer) : []
            if (best.length) {
              aimAt = { period: wider, players: best }
              break
            }
          }
        }
        if (!cancelled) {
          setData({ loading: false, error: false, top, field, you, around, sample, allTimeBest, wouldPlace: asked?.wouldPlace ?? null, aimAt, days })
        }
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

/**
 * A daily's viewer beyond today over the header's period (HubBeyond), asked apart from today's board so a
 * new period doesn't reload it. The standings read the header's group themselves: `groupId` only asks again
 * when it changes.
 */
export function useDailyBeyond(
  slug: LeaderboardGame | null,
  playerName: string,
  groupId: string | null,
  period: LeaderboardPeriod,
): HubBeyond {
  const over: LeaderboardPeriod = period === 'daily' ? 'weekly' : period
  const me = normalizePlayerName(playerName)
  const daily = Boolean(slug && isDailyGame(slug))
  const [data, setData] = useState<HubBeyond>({ period: over, loading: daily && Boolean(me), place: null, rank: null })

  useEffect(() => {
    if (!slug || !daily || !me) {
      setData({ period: over, loading: false, place: null, rank: null })
      return
    }
    let cancelled = false
    setData({ period: over, loading: true, place: null, rank: null })
    fetchGlobalRank(me, over)
      .then((standings) => {
        if (cancelled) return
        const onGame = standings.byGame[slug]
        setData({
          period: over,
          loading: false,
          place: onGame ? { place: onGame.place, field: onGame.total ?? null } : null,
          rank: standings.rank != null && standings.totalPlayers ? { place: standings.rank, field: standings.totalPlayers } : null,
        })
      })
      .catch(() => {
        if (!cancelled) setData({ period: over, loading: false, place: null, rank: null })
      })
    return () => {
      cancelled = true
    }
  }, [slug, daily, me, over, groupId])

  return data
}

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
