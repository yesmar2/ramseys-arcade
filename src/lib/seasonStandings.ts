import { useEffect, useState } from 'react'
import type { StandingsFeed, StandingsLines } from '../components/StandingsList'
import { rankHref } from '../hooks/useHashRoute'
import { applyBoardScope, withGroupFallback } from './groups'
import { api, normalizePlayerName, type GlobalBoardEntry, type GlobalRankResult, type LeaderboardPeriod } from './leaderboard'
import type { Standing, YouStanding } from './scoreboard'
import type { SeasonInfo } from './season'

/*
 * The season's standings: the `season` period (the API's store.ts PERIODS), the same sums as a week's or a
 * month's over the season's days. The Standings page, a game's board and How your rank works each have a
 * Season tab while a season has standings, following the header's group as their other tabs do; the Season
 * page lists them too, always everyone's, as the season's cup is. Either way the list draws a line under the
 * places that win its cup and under the ones that win a trophy.
 */

/** The season a page of its standings is about. */
export type StandingsSeason = {
  id: number
  slug: string
  name: string
  status: 'live' | 'over'
  startsAt: number
  endsAt: number
}

/** What its places win when it ends, and the field each needs before it's given (the API's seasons.ts SEASON_PRIZES). */
export type SeasonPrizes = { cupPlaces: number; trophyPlaces: number; cupField: number; trophyField: number }

export type SeasonBoardResult = {
  totalPlayers: number
  entries: GlobalBoardEntry[]
  /** Null before the first season starts. */
  season: StandingsSeason | null
  prizes: SeasonPrizes | null
}

/** Whether a season has standings to show: it's live, or it's over and they're final. */
export function seasonHasStandings(season: SeasonInfo | null | undefined): boolean {
  return season?.status === 'live' || season?.status === 'over'
}

/** A page's period tabs: its own, and the Season tab after them while a season has standings. */
export function periodTabs(periods: readonly LeaderboardPeriod[], season: boolean): LeaderboardPeriod[] {
  const own = periods.filter((p) => p !== 'season')
  return season ? [...own, 'season'] : own
}

/**
 * The lines under the places that win when the season ends, once enough are playing for each to be given
 * (the API's settleSeasons). A group's standings have none: the cup and the trophies go to everyone's.
 */
export function prizeLines(
  prizes: SeasonPrizes | null | undefined,
  totalPlayers: number,
  seasonId: number | null,
  group: boolean,
): StandingsLines | null {
  if (!prizes || seasonId == null || group) return null
  return {
    cup: totalPlayers >= prizes.cupField ? prizes.cupPlaces : null,
    trophy: totalPlayers >= prizes.trophyField ? prizes.trophyPlaces : null,
    cupLabel: `The top ${prizes.cupPlaces} take the Season ${seasonId} cup`,
    trophyLabel: `The top ${prizes.trophyPlaces} take a trophy`,
  }
}

/* ---------- the Season page's list: everyone's ---------- */

/** A page of the season's standings from place `offset + 1`: inside `group`, or everyone's. */
export async function fetchSeasonBoard(limit: number, offset: number, group: string | null): Promise<SeasonBoardResult> {
  return withGroupFallback(async () => {
    const qs = applyBoardScope(new URLSearchParams({ period: 'season', limit: String(Math.min(500, Math.max(1, Math.floor(limit)))) }), group)
    if (offset > 0) qs.set('offset', String(Math.floor(offset)))
    const data = await api<Partial<SeasonBoardResult>>(`/leaderboards/rank?${qs}`)
    return {
      totalPlayers: data.totalPlayers ?? 0,
      entries: data.entries ?? [],
      season: data.season ?? null,
      prizes: data.prizes ?? null,
    }
  })
}

/** One player's line in the season's standings, with the two either side of them. */
export async function fetchSeasonRank(name: string, group: string | null): Promise<GlobalRankResult> {
  return withGroupFallback(async () => {
    const qs = applyBoardScope(new URLSearchParams({ period: 'season', name: normalizePlayerName(name) }), group)
    return api<GlobalRankResult>(`/leaderboards/rank?${qs}`)
  })
}

/** Up to ten players in the season's standings whose tag holds `find`, each with its place. */
export async function findInSeason(find: string, group: string | null): Promise<GlobalBoardEntry[]> {
  return withGroupFallback(async () => {
    const qs = applyBoardScope(new URLSearchParams({ period: 'season', find: find.trim().slice(0, 12) }), group)
    const data = await api<{ found?: GlobalBoardEntry[] }>(`/leaderboards/rank?${qs}`)
    return data.found ?? []
  })
}

export type SeasonStandingsData = {
  loading: boolean
  error: boolean
  /** The top ten. */
  standings: Standing[]
  totalPlayers: number
  /** The viewer, when they have a name; `rank` is null until they're on the season's standings. */
  you: YouStanding | null
  season: StandingsSeason | null
  prizes: SeasonPrizes | null
  /** The group they're counted in, or null for everyone. */
  group: string | null
}

const LOADING: Omit<SeasonStandingsData, 'group'> = {
  loading: true,
  error: false,
  standings: [],
  totalPlayers: 0,
  you: null,
  season: null,
  prizes: null,
}

/** The season's top ten and the viewer's line: inside `group`, or everyone's. */
export function useSeasonStandings(playerName: string, group: string | null): SeasonStandingsData {
  const [data, setData] = useState<SeasonStandingsData>({ ...LOADING, group })

  useEffect(() => {
    let cancelled = false
    const me = normalizePlayerName(playerName)
    setData((prev) => ({ ...prev, loading: true, error: false, group }))
    void Promise.all([fetchSeasonBoard(10, 0, group), me ? fetchSeasonRank(me, group) : Promise.resolve(null)])
      .then(([board, mine]) => {
        if (cancelled) return
        setData({
          loading: false,
          error: false,
          standings: board.entries,
          totalPlayers: board.totalPlayers,
          you:
            me && mine
              ? {
                  name: me,
                  rank: mine.rank,
                  score: mine.score,
                  totalPlayers: mine.totalPlayers,
                  byGame: mine.byGame ?? {},
                  nearby: mine.nearby ?? [],
                  avatarId: mine.avatarId,
                }
              : null,
          season: board.season,
          prizes: board.prizes,
          group,
        })
      })
      .catch(() => {
        if (!cancelled) setData({ ...LOADING, loading: false, error: true, group })
      })
    return () => {
      cancelled = true
    }
  }, [playerName, group])

  return data
}

/** The Standings list's feed of the season's standings. */
export function seasonFeed(data: SeasonStandingsData): StandingsFeed {
  return {
    key: data.group ? 'season-group' : 'season-everyone',
    loading: data.loading,
    standings: data.standings,
    totalPlayers: data.totalPlayers,
    you: data.you,
    more: async (offset, limit) => (await fetchSeasonBoard(limit, offset, data.group)).entries,
    find: (q) => findInSeason(q, data.group),
    rowHref: (name) => rankHref(name),
  }
}

/** The lines under the season's places that win, for its standings as useSeasonStandings has them. */
export function seasonLines(data: SeasonStandingsData): StandingsLines | null {
  return prizeLines(data.prizes, data.totalPlayers, data.season?.id ?? null, Boolean(data.group))
}
