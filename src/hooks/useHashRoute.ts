import { useEffect, useState } from 'react'
import {
  DEFAULT_PERIOD_EVENT,
  defaultPeriod,
  setDefaultPeriod,
} from '../lib/defaultPeriod'
import {
  coerceVisiblePeriod,
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
  | { name: 'game'; slug: string; board?: 'scores' | 'records'; period?: LeaderboardPeriod }
  | { name: 'gamePlay'; slug: string }
  | { name: 'authVerify'; token: string }
  | { name: 'privacy' }
  | { name: 'terms' }

/** Old URL slugs → current game slugs (name-matching). */
const GAME_SLUG_ALIASES: Record<string, string> = {
  'dead-center': 'centroid',
  whack: 'pop',
  'whack-a-mole': 'pop',
}

export function canonicalGameSlug(slug: string): string {
  return GAME_SLUG_ALIASES[slug] ?? slug
}

function isLeaderboardGame(value: string): value is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(value)
}

function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value)
}

/** Leaderboards overview hub (top scores). */
export function leaderboardHref(period: LeaderboardPeriod = defaultPeriod()) {
  return `#/leaderboards/${period}`
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
  if (cleaned) {
    return `#/rank/${encodeURIComponent(cleaned)}/${period}`
  }
  return `#/rank/${period}`
}

/** Game hub / lobby. Optional records tab: `#/games/{slug}/records`. */
export function gameHref(slug: string, board: 'scores' | 'records' = 'scores') {
  const base = `#/games/${encodeURIComponent(slug)}`
  if (board === 'records') return `${base}/records`
  return base
}

/** Game hub with a selected leaderboard period. */
export function gameHubHref(
  slug: string,
  period: LeaderboardPeriod = defaultPeriod(),
) {
  return `#/games/${encodeURIComponent(slug)}/${period}`
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

/** Record books for one game (`#/records/{game}/{period}`). Individual boards use `recordHref`. */
export function recordsHref(
  game: string,
  period: LeaderboardPeriod = defaultPeriod(),
) {
  return `#/records/${encodeURIComponent(game)}/${period}`
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
      return leaderboardHref(period)
    case 'rank':
      return rankHref(route.player, period)
    case 'records':
      if (route.recordId) return recordHref(route.game, route.recordId, period)
      return recordsHref(route.game, period)
    case 'game':
      if (route.board === 'records') return gameHref(route.slug, 'records')
      return gameHubHref(route.slug, period)
    case 'gamePlay':
      return gamePlayHref(route.slug)
    case 'tournamentPlay':
      return tournamentPlayHref(route.id, route.game, route.invite)
    default:
      return null
  }
}

/** Period encoded in the current route, if any. */
export function periodFromRoute(route: Route): LeaderboardPeriod | undefined {
  switch (route.name) {
    case 'game':
    case 'gameLeaderboard':
    case 'leaderboards':
    case 'rank':
    case 'records':
      return route.period ? coerceVisiblePeriod(route.period) : undefined
    default:
      return undefined
  }
}

export function applySitePeriod(
  period: LeaderboardPeriod,
  route: Route = parseHash(window.location.hash),
) {
  const nextPeriod = coerceVisiblePeriod(period)
  setDefaultPeriod(nextPeriod)
  const next = hrefForRoute(route, nextPeriod)
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
  if (path === 'leaderboards') return { name: 'leaderboards', period: defaultPeriod() }
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
      ? { name: 'rank', player, period: 'all' }
      : { name: 'rank', period: defaultPeriod() }
  }

  const recordBoardMatch = /^records\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(path)
  if (recordBoardMatch) {
    const game = canonicalGameSlug(decodeURIComponent(recordBoardMatch[1]))
    const recordId = decodeURIComponent(recordBoardMatch[2])
    const periodRaw = decodeURIComponent(recordBoardMatch[3])
    return {
      name: 'records',
      game,
      recordId,
      period: isLeaderboardPeriod(periodRaw) ? periodRaw : defaultPeriod(),
    }
  }

  const recordsGameMatch = /^records\/([^/]+)\/([^/]+)$/.exec(path)
  if (recordsGameMatch) {
    const game = canonicalGameSlug(decodeURIComponent(recordsGameMatch[1]))
    const second = decodeURIComponent(recordsGameMatch[2])
    if (isLeaderboardPeriod(second)) {
      return { name: 'records', game, period: second }
    }
    return {
      name: 'records',
      game,
      recordId: second,
      period: defaultPeriod(),
    }
  }

  const recordsMatch = /^records\/([^/]+)$/.exec(path)
  if (recordsMatch) {
    return {
      name: 'records',
      game: canonicalGameSlug(decodeURIComponent(recordsMatch[1])),
      period: defaultPeriod(),
    }
  }

  const boardsMatch = /^leaderboards\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (boardsMatch) {
    const segment = canonicalGameSlug(decodeURIComponent(boardsMatch[1]))
    const periodRaw = boardsMatch[2] ? decodeURIComponent(boardsMatch[2]) : undefined
    if (segment === 'global') {
      const period =
        periodRaw && isLeaderboardPeriod(periodRaw) ? periodRaw : defaultPeriod()
      return { name: 'leaderboards', global: true, period }
    }
    if (isLeaderboardPeriod(segment) && !periodRaw) {
      return { name: 'leaderboards', period: segment }
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
      game: canonicalGameSlug(decodeURIComponent(tournamentPlayMatch[2])),
      invite,
    }
  }

  const tournamentMatch = /^tournaments\/([^/]+)$/.exec(path)
  if (tournamentMatch) {
    return { name: 'tournament', id: decodeURIComponent(tournamentMatch[1]), invite }
  }

  const gamePlayMatch = /^games\/([^/]+)\/play$/.exec(path)
  if (gamePlayMatch) {
    return {
      name: 'gamePlay',
      slug: canonicalGameSlug(decodeURIComponent(gamePlayMatch[1])),
    }
  }

  const gameMatch = /^games\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (gameMatch) {
    const slug = canonicalGameSlug(decodeURIComponent(gameMatch[1]))
    const segment = gameMatch[2] ? decodeURIComponent(gameMatch[2]) : undefined
    if (segment === 'records') {
      return { name: 'game', slug, board: 'records' }
    }
    if (segment && isLeaderboardPeriod(segment)) {
      return { name: 'game', slug, period: segment }
    }
    return { name: 'game', slug }
  }

  return { name: 'home' }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const p = periodFromRoute(parseHash(window.location.hash))
    if (p) setDefaultPeriod(p)
  }, [])

  useEffect(() => {
    const syncRoute = () => {
      const next = parseHash(window.location.hash)
      const p = periodFromRoute(next)
      if (p) setDefaultPeriod(p)
      const canonical = hrefForRoute(next, p ?? defaultPeriod())
      if (canonical && normalizeHash(window.location.hash) !== normalizeHash(canonical)) {
        window.location.replace(canonical)
        return
      }
      setRoute(next)
    }
    window.addEventListener('hashchange', syncRoute)
    syncRoute()
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    const syncPeriodUrl = () => {
      const currentRoute = parseHash(window.location.hash)
      const period = defaultPeriod()
      const next = hrefForRoute(currentRoute, period)
      if (next && normalizeHash(window.location.hash) !== normalizeHash(next)) {
        window.location.hash = next
      }
    }

    window.addEventListener(DEFAULT_PERIOD_EVENT, syncPeriodUrl)
    return () => {
      window.removeEventListener(DEFAULT_PERIOD_EVENT, syncPeriodUrl)
    }
  }, [])

  return route
}
