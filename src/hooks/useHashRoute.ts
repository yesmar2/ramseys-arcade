import { useEffect, useState } from 'react'
import {
  DEFAULT_PERIOD_EVENT,
  defaultPeriod,
  setDefaultPeriod,
} from '../lib/defaultPeriod'
import {
  ACTIVE_GROUP_EVENT,
  appendGroupQuery,
  groupHref,
  groupsIndexHref,
  parseGroupQuery,
  setActiveGroup,
} from '../lib/groups'
import {
  coerceVisiblePeriod,
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

/*
 * Routing.
 *
 * URLs are real paths (`/games/snake`, `/leaderboards/week`) pushed with the
 * History API, so crawlers and link unfurlers see one page per route. The
 * file keeps its old name because it is imported from everywhere; the hash
 * router it replaced lives on only as `migrateLegacyHash`, which turns the
 * `#/…` links still out there (shared boards, sign-in emails, push payloads)
 * into the path they mean.
 */

export type Route =
  | { name: 'home' }
  /** `global` is an old /leaderboards/global link; its URL becomes the standings' own (`standingsHref`). */
  | { name: 'leaderboards'; global?: boolean; period?: LeaderboardPeriod }
  | { name: 'gameLeaderboard'; game: LeaderboardGame; period?: LeaderboardPeriod }
  | { name: 'recordsIndex' }
  | { name: 'siteRecords' }
  | { name: 'records'; game: string; recordId?: string; period?: LeaderboardPeriod }
  | { name: 'rank'; player?: string; period?: LeaderboardPeriod }
  | { name: 'groups' }
  | { name: 'group'; id: string; invite?: string }
  | { name: 'tournaments' }
  | { name: 'tournamentCreate' }
  | { name: 'tournament'; id: string; invite?: string }
  | { name: 'tournamentPlay'; id: string; game: string; invite?: string }
  | { name: 'game'; slug: string; board?: 'scores' | 'records'; period?: LeaderboardPeriod }
  /**
   * `daily`: the game's hole of the day, where it has one (Ace Chase's Today's Hole). `hole`: a hole on
   * trial, `?hole=<key>` on the play page (Ace Chase's), which nothing links to.
   */
  | { name: 'gamePlay'; slug: string; daily?: boolean; hole?: string }
  | { name: 'authVerify'; token: string }
  | { name: 'about' }
  | { name: 'plus' }
  | { name: 'admin' }
  | { name: 'stats' }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'devCelebrate' }

/** Fired after in-app navigation has changed the URL. */
export const ROUTE_EVENT = 'skermix:route'

/** Old URL slugs → current game slugs (name-matching). */
const GAME_SLUG_ALIASES: Record<string, string> = {
  'dead-center': 'centroid',
  whack: 'pop',
  'whack-a-mole': 'pop',
  stride: 'crosswalk',
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

/* ------------------------------------------------------------------ */
/* Hrefs                                                               */
/* ------------------------------------------------------------------ */

export function homeHref() {
  return '/'
}

/** Leaderboards overview hub (top scores). */
export function leaderboardHref(period: LeaderboardPeriod = defaultPeriod()) {
  return `/leaderboards/${period}`
}

/** Full board for one game. */
export function gameBoardHref(
  game: LeaderboardGame,
  period: LeaderboardPeriod = defaultPeriod(),
) {
  return `/leaderboards/${encodeURIComponent(game)}/${period}`
}

/** The Boards page, scrolled to its standings: every player, ranked across all games. */
export function standingsHref(period: LeaderboardPeriod = defaultPeriod()) {
  return `${leaderboardHref(period)}?focus=standings`
}

export function rankHref(
  player?: string,
  period: LeaderboardPeriod = defaultPeriod(),
  /** Land on a section rather than the top — the profile is a long page. */
  focus?: 'friends' | 'trophies',
) {
  const cleaned = player?.trim().toUpperCase().slice(0, 12)
  const base = cleaned
    ? `/rank/${encodeURIComponent(cleaned)}/${period}`
    : `/rank/${period}`
  return focus ? `${base}?focus=${focus}` : base
}

/** Section the current URL asks to be scrolled to, if any. */
export function focusFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('focus')
}

/**
 * A canonical href that still asks for the section the current URL does.
 * Only the page reads `?focus=`, so the route knows nothing of it, and
 * tidying the URL into its canonical form must not drop it before the page
 * has had a look.
 */
function keepFocus(href: string): string {
  const focus = focusFromUrl()
  if (!focus) return href
  const [path, qs] = href.split('?')
  const params = new URLSearchParams(qs)
  params.delete('focus')
  return `${path}?${new URLSearchParams([['focus', focus], ...params])}`
}

/** Game hub / lobby. Optional records tab: `/games/{slug}/records`. */
export function gameHref(slug: string, board: 'scores' | 'records' = 'scores') {
  const base = `/games/${encodeURIComponent(slug)}`
  if (board === 'records') return `${base}/records`
  return base
}

/** Game hub with a selected leaderboard period. */
export function gameHubHref(
  slug: string,
  period: LeaderboardPeriod = defaultPeriod(),
) {
  return `/games/${encodeURIComponent(slug)}/${period}`
}

export function gamePlayHref(slug: string) {
  return `/games/${encodeURIComponent(slug)}/play`
}

/** A game's hole of the day: Ace Chase's Today's Hole. */
export function gameDailyHref(slug: string) {
  return `/games/${encodeURIComponent(slug)}/daily`
}

/** Site-wide record books catalog. */
export function recordsIndexHref() {
  return '/records'
}

/** The one book that is about the whole arcade rather than a cabinet. */
export function siteRecordsHref() {
  return '/records/site'
}

export function privacyHref() {
  return '/privacy'
}

export function termsHref() {
  return '/terms'
}

export function aboutHref() {
  return '/about'
}

export function plusHref() {
  return '/plus'
}

/** Site errors, flagged scores and bans, for admins. */
export function adminHref() {
  return '/admin'
}

export function statsHref() {
  return '/stats'
}

export function tournamentsHref() {
  return '/tournaments'
}

/** Making an event; for a group, its members are invited once it is made. */
export function tournamentCreateHref(groupId?: string) {
  return groupId ? `/tournaments/create?group=${encodeURIComponent(groupId)}` : '/tournaments/create'
}

export function tournamentHref(id: string, invite?: string) {
  const base = `/tournaments/${encodeURIComponent(id)}`
  if (!invite?.trim()) return base
  return `${base}?invite=${encodeURIComponent(invite.trim().toUpperCase())}`
}

export function tournamentPlayHref(id: string, game: string, invite?: string) {
  const base = `/tournaments/${encodeURIComponent(id)}/play/${encodeURIComponent(game)}`
  if (!invite?.trim()) return base
  return `${base}?invite=${encodeURIComponent(invite.trim().toUpperCase())}`
}

/**
 * Record books for one game (`/records/{game}/{period}`). Individual boards
 * use `recordHref`.
 *
 * Records are lifetime achievements, not the rotating weekly competition —
 * a book win is judged against the all-time holder, so the book itself
 * defaults to `all` rather than the site's general leaderboard period.
 */
export function recordsHref(game: string, period: LeaderboardPeriod = 'all') {
  return `/records/${encodeURIComponent(game)}/${period}`
}

export function recordHref(
  game: string,
  recordId: string,
  period: LeaderboardPeriod = 'all',
) {
  return `/records/${encodeURIComponent(game)}/${encodeURIComponent(recordId)}/${period}`
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

/* ------------------------------------------------------------------ */
/* The current URL                                                     */
/* ------------------------------------------------------------------ */

/** A trailing slash means the same page. */
function normalizeHref(href: string): string {
  return href.replace(/\/(?=\?|$)/, '')
}

/** Path plus query of the current URL — what an in-app href looks like. */
export function currentHref(): string {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}`
}

/** The current path, without a trailing slash; `/` for the home page. */
export function currentPath(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

/** `#/games/snake` and friends: the path an old hash URL stands for, else null. */
function legacyHashPath(hash: string): string | null {
  if (!hash.startsWith('#/')) return null
  return hash.slice(1)
}

/**
 * Rewrite an old `#/…` URL into its path in place, without a navigation.
 * Returns whether there was one.
 */
export function migrateLegacyHash(): boolean {
  if (typeof window === 'undefined') return false
  const path = legacyHashPath(window.location.hash)
  if (!path) return false
  window.history.replaceState(window.history.state, '', path)
  return true
}

/** An in-app href (path, `#/…`, or absolute same-origin URL) as path + query. */
function resolveInAppHref(href: string): string {
  const url = new URL(href, window.location.href)
  const legacy = legacyHashPath(url.hash)
  if (legacy) return legacy
  return `${url.pathname}${url.search}`
}

/**
 * Go to an in-app href. Pushes a history entry unless the URL is already
 * there; either way the route listeners re-sync, so leaving a game to the
 * page you are technically already on still closes the game.
 */
export function navigate(href: string, options: { replace?: boolean } = {}) {
  const target = resolveInAppHref(href)
  if (normalizeHref(target) !== normalizeHref(currentHref())) {
    if (options.replace) window.history.replaceState(null, '', target)
    else window.history.pushState(null, '', target)
  }
  window.dispatchEvent(new Event(ROUTE_EVENT))
}

/**
 * Plain `<a href="/games/snake">` links navigate in-app. Anything that is
 * not a left click on a same-origin link (new tab, download, mailto, an
 * in-page `#section`) is left to the browser.
 */
function onDocumentClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest('a[href]')
  if (!(anchor instanceof HTMLAnchorElement)) return
  if (anchor.target && anchor.target !== '_self') return
  if (anchor.hasAttribute('download')) return
  const raw = anchor.getAttribute('href') ?? ''
  if (raw.startsWith('#') && !raw.startsWith('#/')) return
  let url: URL
  try {
    url = new URL(anchor.href)
  } catch {
    return
  }
  if (url.origin !== window.location.origin) return
  event.preventDefault()
  navigate(resolveInAppHref(url.href))
}

let routerBooted = false

/** Call once before the first render: fix up legacy URLs and take over link clicks. */
export function bootRouter() {
  if (routerBooted || typeof window === 'undefined') return
  routerBooted = true
  migrateLegacyHash()
  document.addEventListener('click', onDocumentClick)
}

/* ------------------------------------------------------------------ */
/* Routes ⇄ hrefs                                                      */
/* ------------------------------------------------------------------ */

/** Canonical href for period-aware routes; null when route has no period segment. */
export function hrefForRoute(
  route: Route,
  period: LeaderboardPeriod = defaultPeriod(),
): string | null {
  switch (route.name) {
    case 'gameLeaderboard':
      return appendGroupQuery(gameBoardHref(route.game, period))
    case 'leaderboards':
      if (route.global) return appendGroupQuery(standingsHref(period))
      return appendGroupQuery(leaderboardHref(period))
    case 'rank':
      return appendGroupQuery(rankHref(route.player, period))
    case 'records':
      if (route.recordId) {
        return appendGroupQuery(recordHref(route.game, route.recordId, period))
      }
      return appendGroupQuery(recordsHref(route.game, period))
    case 'game':
      if (route.board === 'records') {
        return appendGroupQuery(gameHref(route.slug, 'records'))
      }
      return appendGroupQuery(gameHubHref(route.slug, period))
    case 'gamePlay':
      if (route.daily) return gameDailyHref(route.slug)
      return route.hole ? `${gamePlayHref(route.slug)}?hole=${encodeURIComponent(route.hole)}` : gamePlayHref(route.slug)
    case 'tournamentPlay':
      return tournamentPlayHref(route.id, route.game, route.invite)
    case 'groups':
      return groupsIndexHref()
    case 'group':
      return groupHref(route.id, route.invite)
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

export function applySitePeriod(period: LeaderboardPeriod, route: Route = currentRoute()) {
  const nextPeriod = coerceVisiblePeriod(period)
  setDefaultPeriod(nextPeriod)
  const next = hrefForRoute(route, nextPeriod)
  if (next && normalizeHref(currentHref()) !== normalizeHref(next)) {
    navigate(next)
  }
}

export function applySiteGroup(groupId: string | null, route: Route = currentRoute()) {
  setActiveGroup(groupId)
  const next = hrefForRoute(route, periodFromRoute(route) ?? defaultPeriod())
  if (next && normalizeHref(currentHref()) !== normalizeHref(next)) {
    navigate(next)
  }
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export function parseUrl(pathname: string, search: string): Route {
  const path = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  const invite = new URLSearchParams(search).get('invite')?.trim().toUpperCase() || undefined
  if (!path) return { name: 'home' }
  if (path === 'about') return { name: 'about' }
  if (path === 'plus') return { name: 'plus' }
  if (path === 'admin') return { name: 'admin' }
  if (path === 'stats') return { name: 'stats' }
  if (path === 'privacy') return { name: 'privacy' }
  if (path === 'terms') return { name: 'terms' }
  if (path === 'dev/celebrate' && import.meta.env.DEV) return { name: 'devCelebrate' }
  if (path === 'groups') return { name: 'groups' }
  const groupMatch = /^groups\/([^/]+)$/.exec(path)
  if (groupMatch) {
    return {
      name: 'group',
      id: decodeURIComponent(groupMatch[1]),
      invite,
    }
  }
  if (path === 'leaderboards') return { name: 'leaderboards', period: defaultPeriod() }
  if (path === 'rank') return { name: 'rank', period: defaultPeriod() }
  if (path === 'records') return { name: 'recordsIndex' }
  // Before the game-record patterns below, which would read "site" as a slug.
  if (path === 'records/site') return { name: 'siteRecords' }

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
      period: isLeaderboardPeriod(periodRaw) ? periodRaw : 'all',
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
      period: 'all',
    }
  }

  const recordsMatch = /^records\/([^/]+)$/.exec(path)
  if (recordsMatch) {
    return {
      name: 'records',
      game: canonicalGameSlug(decodeURIComponent(recordsMatch[1])),
      period: 'all',
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
    const hole = new URLSearchParams(search).get('hole')?.trim()
    return {
      name: 'gamePlay',
      slug: canonicalGameSlug(decodeURIComponent(gamePlayMatch[1])),
      ...(hole ? { hole } : {}),
    }
  }

  const gameMatch = /^games\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (gameMatch) {
    const slug = canonicalGameSlug(decodeURIComponent(gameMatch[1]))
    const segment = gameMatch[2] ? decodeURIComponent(gameMatch[2]) : undefined
    if (segment === 'daily') {
      return { name: 'gamePlay', slug, daily: true }
    }
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

/** The route the current URL means (after any legacy `#/…` fix-up). */
export function currentRoute(): Route {
  if (typeof window === 'undefined') return { name: 'home' }
  migrateLegacyHash()
  return parseUrl(window.location.pathname, window.location.search)
}

function sameRoute(a: Route, b: Route) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useRoute(): Route {
  const [route, setRoute] = useState(() => currentRoute())

  useEffect(() => {
    const start = currentRoute()
    const p = periodFromRoute(start)
    // Record books default to `all`, a period of their own — landing on one
    // must not overwrite the sticky period the rest of the site shares.
    if (p && start.name !== 'records') setDefaultPeriod(p)
  }, [])

  useEffect(() => {
    const syncRoute = () => {
      let next = currentRoute()
      const p = periodFromRoute(next)
      if (p && next.name !== 'records') setDefaultPeriod(p)
      const groupParams = new URLSearchParams(window.location.search)
      if (groupParams.has('group')) {
        setActiveGroup(parseGroupQuery(window.location.search))
      }
      const href = hrefForRoute(next, p ?? defaultPeriod())
      const canonical = href && keepFocus(href)
      if (canonical && normalizeHref(currentHref()) !== normalizeHref(canonical)) {
        window.history.replaceState(window.history.state, '', canonical)
        next = currentRoute()
      }
      setRoute((prev) => (sameRoute(prev, next) ? prev : next))
    }
    window.addEventListener('popstate', syncRoute)
    window.addEventListener(ROUTE_EVENT, syncRoute)
    // Old `#/…` links set the hash rather than the path; fold them in too.
    window.addEventListener('hashchange', syncRoute)
    syncRoute()
    return () => {
      window.removeEventListener('popstate', syncRoute)
      window.removeEventListener(ROUTE_EVENT, syncRoute)
      window.removeEventListener('hashchange', syncRoute)
    }
  }, [])

  useEffect(() => {
    // The period is set on every route change, changed or not. Only a real
    // change moves the URL, and that leaves any section it asked for behind.
    const syncPeriodUrl = () => {
      const period = defaultPeriod()
      const next = hrefForRoute(currentRoute(), period)
      if (next && normalizeHref(currentHref()) !== normalizeHref(keepFocus(next))) {
        navigate(next)
      }
    }

    window.addEventListener(DEFAULT_PERIOD_EVENT, syncPeriodUrl)
    window.addEventListener(ACTIVE_GROUP_EVENT, syncPeriodUrl)
    return () => {
      window.removeEventListener(DEFAULT_PERIOD_EVENT, syncPeriodUrl)
      window.removeEventListener(ACTIVE_GROUP_EVENT, syncPeriodUrl)
    }
  }, [])

  return route
}

/** @deprecated The router is not hash-based any more; call `useRoute`. */
export const useHashRoute = useRoute
