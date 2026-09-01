import { useEffect, useState } from 'react'
import {
  DEFAULT_PERIOD_EVENT,
  defaultPeriod,
  setDefaultPeriod,
} from '../lib/defaultPeriod'
import {
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

export type Route =
  | { name: 'home' }
  | { name: 'leaderboards'; global?: boolean; period?: LeaderboardPeriod }
  | { name: 'gameLeaderboard'; game: LeaderboardGame; period?: LeaderboardPeriod }
  | { name: 'recordsIndex' }
  | { name: 'records'; game: string; recordId?: string; period?: LeaderboardPeriod }
  | { name: 'rank'; player?: string; period?: LeaderboardPeriod }
  | { name: 'tournaments' }
  | { name: 'tournamentCreate' }
  | { name: 'tournament'; id: string; invite?: string }
  | { name: 'tournamentPlay'; id: string; game: string; invite?: string }
  | { name: 'game'; slug: string; board?: 'scores' | 'records' }
  | { name: 'gamePlay'; slug: string }
  | { name: 'authVerify'; token: string }
  | { name: 'privacy' }
  | { name: 'terms' }

function isLeaderboardGame(value: string): value is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(value)
}

function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value)
}

/** Leaderboards overview hub. */
export function leaderboardHref() {
  return '#/leaderboards'
}

/** Full board for one game. */
export function gameBoardHref(
  game: LeaderboardGame,
  period: LeaderboardPeriod = defaultPeriod(),
) {
  return `#/leaderboards/${encodeURIComponent(game)}/${period}`
}

export function globalRankingsHref(period: LeaderboardPeriod = defaultPeriod()) {
  return `#/leaderboards/global/${period}`
}

export function rankHref(player?: string, period: LeaderboardPeriod = defaultPeriod()) {
  const cleaned = player?.trim().toUpperCase().slice(0, 12)
  if (cleaned && period !== 'all') {
    return `#/rank/${encodeURIComponent(cleaned)}/${period}`
  }
  if (cleaned) return `#/rank/${encodeURIComponent(cleaned)}`
  if (period !== 'all') return `#/rank/${period}`
  return '#/rank'
}

/** Game hub / lobby. Optional records tab: `#/games/{slug}/records`. */
export function gameHref(slug: string, board: 'scores' | 'records' = 'scores') {
  const base = `#/games/${encodeURIComponent(slug)}`
  if (board === 'records') return `${base}/records`
  return base
}

export function gamePlayHref(slug: string) {
  return `#/games/${encodeURIComponent(slug)}/play`
}

/** Site-wide record books catalog. */
export function recordsIndexHref() {
  return '#/records'
}

export function privacyHref() {
  return '#/privacy'
}

export function termsHref() {
  return '#/terms'
}

export function tournamentsHref() {
  return '#/tournaments'
}

export function tournamentCreateHref() {
  return '#/tournaments/create'
}

export function tournamentHref(id: string, invite?: string) {
  const base = `#/tournaments/${encodeURIComponent(id)}`
  if (!invite?.trim()) return base
  return `${base}?invite=${encodeURIComponent(invite.trim().toUpperCase())}`
}

export function tournamentPlayHref(id: string, game: string, invite?: string) {
  const base = `#/tournaments/${encodeURIComponent(id)}/play/${encodeURIComponent(game)}`
  if (!invite?.trim()) return base
  return `${base}?invite=${encodeURIComponent(invite.trim().toUpperCase())}`
}

/** Record books for one game (`#/records/{game}`). Individual boards use `recordHref`. */
export function recordsHref(game: string) {
  return `#/records/${encodeURIComponent(game)}`
}

export function recordHref(
  game: string,
  recordId: string,
  period: LeaderboardPeriod = defaultPeriod(),
) {
  return `#/records/${encodeURIComponent(game)}/${encodeURIComponent(recordId)}/${period}`
}

function gameLeaderboardRoute(
  game: LeaderboardGame,
  period?: LeaderboardPeriod,
): Route {
  return {
    name: 'gameLeaderboard',
    game,
    period: period && isLeaderboardPeriod(period) ? period : undefined,
  }
}

function normalizeHash(hash: string): string {
  return hash.replace(/\/$/, '')
}

/** Canonical hash for period-aware routes; null when route has no period segment. */
export function hrefForRoute(
  route: Route,
  period: LeaderboardPeriod = defaultPeriod(),
): string | null {
  switch (route.name) {
    case 'gameLeaderboard':
      return gameBoardHref(route.game, period)
    case 'leaderboards':
      if (route.global) return globalRankingsHref(period)
      return null
    case 'rank':
      return rankHref(route.player, period)
    case 'records':
      if (route.recordId) return recordHref(route.game, route.recordId, period)
      return null
    default:
      return null
  }
}

export function applySitePeriod(
  period: LeaderboardPeriod,
  route: Route = parseHash(window.location.hash),
) {
  setDefaultPeriod(period)
  const next = hrefForRoute(route, period)
  if (next && normalizeHash(window.location.hash) !== normalizeHash(next)) {
    window.location.hash = next
  }
}

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '').replace(/\/$/, '')
  const [path, queryString] = raw.split('?')
  const invite =
    queryString && queryString.length > 0
      ? new URLSearchParams(queryString).get('invite')?.trim().toUpperCase() || undefined
      : undefined
  if (!path) return { name: 'home' }
  if (path === 'privacy') return { name: 'privacy' }
  if (path === 'terms') return { name: 'terms' }
  if (path === 'leaderboards') return { name: 'leaderboards' }
  if (path === 'rank') return { name: 'rank', period: defaultPeriod() }
  if (path === 'records') return { name: 'recordsIndex' }

  const rankMatch = /^rank\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (rankMatch) {
    const part1 = decodeURIComponent(rankMatch[1]).trim()
    const part2 = rankMatch[2] ? decodeURIComponent(rankMatch[2]).trim() : undefined
    if (part2 && isLeaderboardPeriod(part2)) {
      const player = part1.toUpperCase().slice(0, 12)
      return player
        ? { name: 'rank', player, period: part2 }
        : { name: 'rank', period: part2 }
    }
    if (isLeaderboardPeriod(part1)) {
      return { name: 'rank', period: part1 }
    }
    const player = part1.toUpperCase().slice(0, 12)
    return player
      ? { name: 'rank', player, period: defaultPeriod() }
      : { name: 'rank', period: defaultPeriod() }
  }

  const recordBoardMatch = /^records\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (recordBoardMatch) {
    const game = decodeURIComponent(recordBoardMatch[1])
    const recordId = decodeURIComponent(recordBoardMatch[2])
    const periodRaw = recordBoardMatch[3]
      ? decodeURIComponent(recordBoardMatch[3])
      : undefined
    return {
      name: 'records',
      game,
      recordId,
      period: periodRaw && isLeaderboardPeriod(periodRaw) ? periodRaw : defaultPeriod(),
    }
  }

  const recordsMatch = /^records\/([^/]+)$/.exec(path)
  if (recordsMatch) {
    return {
      name: 'records',
      game: decodeURIComponent(recordsMatch[1]),
    }
  }

  const boardsMatch = /^leaderboards\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (boardsMatch) {
    const segment = decodeURIComponent(boardsMatch[1])
    const periodRaw = boardsMatch[2] ? decodeURIComponent(boardsMatch[2]) : undefined
    if (segment === 'global') {
      const period =
        periodRaw && isLeaderboardPeriod(periodRaw) ? periodRaw : defaultPeriod()
      return { name: 'leaderboards', global: true, period }
    }
    if (isLeaderboardGame(segment)) {
      const period =
        periodRaw && isLeaderboardPeriod(periodRaw) ? periodRaw : defaultPeriod()
      return gameLeaderboardRoute(segment, period)
    }
  }

  if (path === 'tournaments') return { name: 'tournaments' }
  if (path === 'tournaments/create') return { name: 'tournamentCreate' }

  const authVerifyMatch = /^auth\/verify\/([^/]+)$/.exec(path)
  if (authVerifyMatch) {
    return { name: 'authVerify', token: decodeURIComponent(authVerifyMatch[1]) }
  }

  const tournamentPlayMatch = /^tournaments\/([^/]+)\/play\/([^/]+)$/.exec(path)
  if (tournamentPlayMatch) {
    return {
      name: 'tournamentPlay',
      id: decodeURIComponent(tournamentPlayMatch[1]),
      game: decodeURIComponent(tournamentPlayMatch[2]),
      invite,
    }
  }

  const tournamentMatch = /^tournaments\/([^/]+)$/.exec(path)
  if (tournamentMatch) {
    return { name: 'tournament', id: decodeURIComponent(tournamentMatch[1]), invite }
  }

  const gamePlayMatch = /^games\/([^/]+)\/play$/.exec(path)
  if (gamePlayMatch) {
    return { name: 'gamePlay', slug: decodeURIComponent(gamePlayMatch[1]) }
  }

  const gameMatch = /^games\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (gameMatch) {
    const slug = decodeURIComponent(gameMatch[1])
    const segment = gameMatch[2] ? decodeURIComponent(gameMatch[2]) : undefined
    if (segment === 'records') {
      return { name: 'game', slug, board: 'records' }
    }
    if (segment && isLeaderboardPeriod(segment) && isLeaderboardGame(slug)) {
      return gameLeaderboardRoute(slug, segment)
    }
    return { name: 'game', slug, board: 'scores' }
  }

  return { name: 'home' }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const syncPeriodUrl = () => {
      const currentRoute = parseHash(window.location.hash)
      const period = defaultPeriod()
      const next = hrefForRoute(currentRoute, period)
      if (next && normalizeHash(window.location.hash) !== normalizeHash(next)) {
        window.history.replaceState(null, '', next)
        setRoute(parseHash(next))
      }
    }

    const path = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '')
    const gamePeriodMatch = /^games\/([^/]+)\/([^/]+)$/.exec(path)
    if (gamePeriodMatch) {
      const slug = decodeURIComponent(gamePeriodMatch[1])
      const periodRaw = decodeURIComponent(gamePeriodMatch[2])
      if (periodRaw !== 'records' && isLeaderboardGame(slug) && isLeaderboardPeriod(periodRaw)) {
        const canonical = gameBoardHref(slug, periodRaw)
        if (window.location.hash !== canonical) {
          window.history.replaceState(null, '', canonical)
          setRoute(parseHash(canonical))
        }
      }
    }

    syncPeriodUrl()
    window.addEventListener(DEFAULT_PERIOD_EVENT, syncPeriodUrl)
    return () => {
      window.removeEventListener(DEFAULT_PERIOD_EVENT, syncPeriodUrl)
    }
  }, [])

  return route
}
