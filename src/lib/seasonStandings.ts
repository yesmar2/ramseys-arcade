import { useEffect, useState } from 'react'
import type { StandingsFeed, StandingsLines } from '../components/StandingsList'
import { rankHref } from '../hooks/useHashRoute'
import { applyBoardScope, withGroupFallback } from './groups'
import { api, normalizePlayerName, type GlobalBoardEntry, type GlobalRankResult } from './leaderboard'
import { boardToday, dayLabel, type Standing, type YouStanding } from './scoreboard'
import type { SeasonInfo } from './season'

/*
 * The season's standings (the API's /leaderboards/rank?period=season): the same sums as a week's or a month's
 * standings, over the season's days, counted at most every five minutes. The Standings page's Season tab and
 * the Season page show them in the Standings list (components/StandingsList.tsx), with a line under the places
 * that win its cup and under the ones that win a trophy. The Season tab follows the header's group, as the
 * other tabs do; the Season page is everyone's, as the season's cup is.
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
    key: data.group ? 'season-group' : 'season',
    loading: data.loading,
    standings: data.standings,
    totalPlayers: data.totalPlayers,
    you: data.you,
    more: async (offset, limit) => (await fetchSeasonBoard(limit, offset, data.group)).entries,
    find: (q) => findInSeason(q, data.group),
    rowHref: (name) => rankHref(name),
  }
}

/**
 * The lines under the places that win when the season ends, once enough are playing for each to be given
 * (the API's settleSeasons). A group's standings have none: the cup and the trophies go to everyone's.
 */
export function seasonLines(data: SeasonStandingsData): StandingsLines | null {
  const { prizes, season } = data
  if (!prizes || !season || data.group) return null
  return {
    cup: data.totalPlayers >= prizes.cupField ? prizes.cupPlaces : null,
    trophy: data.totalPlayers >= prizes.trophyField ? prizes.trophyPlaces : null,
    cupLabel: `The top ${prizes.cupPlaces} take the Season ${season.id} cup`,
    trophyLabel: `The top ${prizes.trophyPlaces} take a trophy`,
  }
}

/** Whether a season has standings to show: it's live, or it's over and they're final. */
export function seasonHasStandings(season: SeasonInfo | null): boolean {
  return season?.status === 'live' || season?.status === 'over'
}

/* ---------- the Season tab's words ---------- */

export type SeasonWords = {
  kicker: string
  /** Whether it's running, and so gets the live dot. */
  live: boolean
  /** The headline, with the leader's name apart so it can wear the gold. */
  title: { name: string; rest: string }
  lede: string
  /** When it ends and what it hands out; empty before it starts. */
  closes: string
}

function players(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? 'player' : 'players'}`
}

/**
 * What the Season tab says over its standings: which season, who leads it, and when it ends and what that
 * hands out. Before the first season, `upcoming` (the season to come, from the Season page's feed) says when
 * it starts. Inside a group there's nothing to hand out: the cup and the trophies go to everyone's top places.
 */
export function seasonWords(data: SeasonStandingsData, upcoming: SeasonInfo | null): SeasonWords {
  const { season, standings, totalPlayers } = data
  if (!season) {
    if (upcoming) {
      return {
        kicker: `Season ${upcoming.id} · ${upcoming.name}`,
        live: false,
        title: { name: '', rest: `${upcoming.name} starts ${dayLabel(boardToday(upcoming.startsAt))}.` },
        lede: 'Its standings start with its first day.',
        closes: '',
      }
    }
    return { kicker: 'Seasons', live: false, title: { name: '', rest: 'No season is on right now.' }, lede: '', closes: '' }
  }
  const over = season.status === 'over'
  const lastDay = dayLabel(boardToday(season.endsAt - 1))
  const cup = data.prizes?.cupPlaces ?? 3
  const trophy = data.prizes?.trophyPlaces ?? 10
  const [first, second] = standings
  let title: SeasonWords['title']
  if (totalPlayers < 2 || !first || !second) title = { name: '', rest: over ? `${season.name} is over.` : `${season.name} is wide open.` }
  else if (first.score - second.score <= 0) title = { name: '', rest: `${first.name} and ${second.name} ${over ? 'tied' : 'are tied'} at the top of ${season.name}.` }
  else title = { name: first.name, rest: over ? ` won ${season.name}.` : ` leads ${season.name}.` }
  let lede: string
  if (over) lede = `${players(totalPlayers)} played in it.`
  else if (totalPlayers === 0 || !first) lede = 'Nobody has played this season yet. Your first run puts you on top.'
  else if (totalPlayers === 1) lede = `${first.name}’s the only name up so far.`
  else lede = `${players(totalPlayers)} this season. Play more games and finish higher to climb.`
  const prizes = data.group ? '' : over ? ' Its cups and trophies are on their shelves.' : ` The top ${cup} take the Season ${season.id} cup, the top ${trophy} a trophy.`
  return {
    kicker: over ? `Season ${season.id} · ${season.name} · Final` : `Live · Season ${season.id} · ${season.name}`,
    live: !over,
    title,
    lede,
    closes: over ? `Ended ${lastDay}.${prizes}` : `Ends ${lastDay} at 11:59 pm ET.${prizes}`,
  }
}
