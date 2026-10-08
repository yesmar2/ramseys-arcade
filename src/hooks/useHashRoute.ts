import { useEffect, useState } from 'react'
import { isDailyGame } from '../data/games'
import { boardPeriodFor } from '../lib/allTime'
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
  /**
   * One game's own board. `day`: a daily's board on that day, YYYY-MM-DD (dayBoardHref), with `period`
   * 'daily'; the page sends a day that isn't past yet to today's.
   */
  | { name: 'gameLeaderboard'; game: LeaderboardGame; period?: LeaderboardPeriod; day?: string }
  | { name: 'recordsIndex' }
  | { name: 'siteRecords' }
  | { name: 'records'; game: string; recordId?: string; period?: LeaderboardPeriod }
  | { name: 'rank'; player?: string; period?: LeaderboardPeriod }
  /** How a player's rank is worked out, from their own numbers: yours, or `player`'s. */
  | { name: 'rankHow'; player?: string; period?: LeaderboardPeriod }
  | { name: 'groups' }
  | { name: 'group'; id: string; invite?: string }
  | { name: 'tournaments' }
  | { name: 'tournamentCreate' }
  | { name: 'tournament'; id: string; invite?: string }
  | { name: 'tournamentPlay'; id: string; game: string; invite?: string }
  /**
   * A game's page. A daily's page has tabs (lib/dailyWords.ts): today's, the page itself, and `tab`
   * 'past' (its past courses, /games/<slug>/past) or 'records' (its records, /games/<slug>/records).
   */
  | { name: 'game'; slug: string; board?: 'scores' | 'records'; period?: LeaderboardPeriod; tab?: 'past' | 'records' }
  /**
   * `hole`: one of Ace Chase's days played as practice, `?hole=day:YYYY-MM-DD` on the play page, from the
   * archive or the admin's Hole Book. `track`: a test drive of one of Hot Lap's daily tracks,
   * `?track=<number or day>`, from the archive or the admin's Track Book. `day`: a past day of Find the
   * Bug's Today's Wanted, `?day=YYYY-MM-DD`, played again from the archive. `lab`: a racing daily's test
   * course, every new kind of obstacle in one, `?lab=1`, from the admin's Cave Book or Course Book.
   */
  | { name: 'gamePlay'; slug: string; hole?: string; track?: string; day?: string; lab?: boolean }
  | { name: 'authVerify'; token: string }
  /** Where Discord sends a player back after signing in (pages/DiscordReturnPage). */
  | { name: 'authDiscord' }
  | { name: 'about' }
  | { name: 'plus' }
  /** `section`: one of the admin's tabs past the overview: a daily game's book, or the trophies. */
  | { name: 'admin'; section?: AdminSection }
  | { name: 'stats' }
  | { name: 'prizes' }
  /** Your tickets: every one in and out, a day at a time (lib/ticketHistory.ts). */
  | { name: 'tickets' }
  /** The season's page: its pass, levels and rewards (lib/season.ts). */
  | { name: 'season' }
  /** The Dailies page (the Today set's): today's ticket, your days, the streak's rewards and your friends' day; with `day`, a past day's ticket. */
  | { name: 'today'; day?: string }
  | { name: 'notificationSettings' }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'devCelebrate' }
  /**
   * A place the site has never had: a Game Over screen with a coin slot, an easter egg (GameOverPage).
   * `killScreen`: /level/256, the footer's door to it, drawn half broken like Pac-Man's last level.
   */
  | { name: 'notFound'; killScreen?: boolean }

/**
 * The admin's tabs past the overview: Ace Chase's planned holes, Hot Lap's planned tracks, Marble Run's planned
 * courses, Lander's planned caves, Swoop's planned hills, Half Full's days, and every trophy and egg.
 */
export type AdminSection = 'holes' | 'tracks' | 'courses' | 'caves' | 'hills' | 'pours' | 'trophies'
const ADMIN_SECTIONS: readonly AdminSection[] = ['holes', 'tracks', 'courses', 'caves', 'hills', 'pours', 'trophies']

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

/** A real day, as YYYY-MM-DD: not a month 13 or a Feb 30. */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const t = Date.parse(`${value}T12:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value
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

/** Full board for one game. A daily has no board for all time: asked for it, its month's (lib/allTime.ts). */
export function gameBoardHref(
  game: LeaderboardGame,
  period: LeaderboardPeriod = defaultPeriod(),
) {
  return `/leaderboards/${encodeURIComponent(game)}/${boardPeriodFor(game, period)}`
}

/**
 * A daily's board on one past day, in full: how the day finished, the board its places counted from
 * (`/leaderboards/<game>/day/<YYYY-MM-DD>`). Today's is the live one, `gameBoardHref(game, 'daily')`.
 */
export function dayBoardHref(slug: string, day: string) {
  return `/leaderboards/${encodeURIComponent(slug)}/day/${encodeURIComponent(day)}`
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

/**
 * How your rank works: the one page that shows a player's rank worked out, game by game and day by
 * day, so every other page can say places and names. /how-ranks-work is yours, at the header's period;
 * /how-ranks-work/<period> yours at that period; /how-ranks-work/<TAG>/<period> someone else's. Not
 * under /rank/, where a tag like HOW would read as a player.
 */
export function rankHowHref(player?: string, period: LeaderboardPeriod = defaultPeriod()) {
  const cleaned = player?.trim().toUpperCase().slice(0, 12)
  return cleaned
    ? `/${RANK_HOW_PATH}/${encodeURIComponent(cleaned)}/${period}`
    : `/${RANK_HOW_PATH}/${period}`
}

const RANK_HOW_PATH = 'how-ranks-work'

/** Section the current URL asks to be scrolled to, if any. */
export function focusFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('focus')
}

/**
 * The Dailies page, /dailies. Its old address, /today, opens it too, and so does a day's share link,
 * /today/YYYY-MM-DD, which the build gives a page of its own that unfurls into the day's card
 * (scripts/today-cards.mjs). Inbox notes and shares already sent use both.
 */
const TODAY_PATH = /^(?:dailies|today)(?:\/\d{4}-\d{2}-\d{2})?$/

/** A past day on the Dailies page, /dailies/YYYY-MM-DD: that day's ticket as it finished. */
const DAILIES_DAY_PATH = /^dailies\/(\d{4}-\d{2}-\d{2})$/

/** Whether a YYYY-MM-DD names a real day: no month 13, no 31st of September. */
function realDay(day: string): boolean {
  const t = Date.parse(`${day}T12:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day
}

/**
 * Where the home page's `?focus=today` pointed when today's ticket was on it: the Today page now. Inbox
 * notes and pushes already sent still link there.
 */
const TODAY_FOCUS = 'today'

/** The Dailies page: today's ticket, your days, the streak's rewards and your friends' day; with a day, that past day's ticket. */
export function todayHref(day?: string) {
  return day ? `/dailies/${encodeURIComponent(day)}` : '/dailies'
}

/** The link a daily's Share sends: the day's own, so it unfurls into that day's card. It stays under /today. */
export function todayShareHref(day: string) {
  return `/today/${encodeURIComponent(day)}`
}

/**
 * A canonical href that still asks for the section the current URL does.
 * Only the page reads `?focus=`, so the route knows nothing of it, and
 * tidying the URL into its canonical form must not drop it before the page
 * has had a look. The one exception is `?focus=today`: that's the Today
 * page itself, whose address has nothing to keep.
 */
function keepFocus(href: string): string {
  const focus = focusFromUrl()
  if (!focus || focus === TODAY_FOCUS) return href
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

/**
 * A daily game's page at one of its tabs: today's (the page itself), its past courses, or its records.
 * `course` lands on one past course's row: a Hot Lap track's number, an Ace Chase hole's or another
 * daily's day (YYYY-MM-DD).
 */
export function dailyTabHref(slug: string, tab: 'today' | 'past' | 'records' = 'today', course?: string | number) {
  const base = `/games/${encodeURIComponent(slug)}`
  if (tab === 'today') return base
  const anchor = tab === 'past' && course != null ? `#course-${encodeURIComponent(String(course))}` : ''
  return `${base}/${tab}${anchor}`
}

/** A daily game's past courses: its page's Past tab (the old /games/<slug>/archive opens it too). */
export function gameArchiveHref(slug: string) {
  return dailyTabHref(slug, 'past')
}

export function gamePlayHref(slug: string) {
  return `/games/${encodeURIComponent(slug)}/play`
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

/** Site errors, flagged scores and bans, for admins; with `section`, one of the admin's other tabs. */
export function adminHref(section?: AdminSection) {
  return section ? `/admin/${section}` : '/admin'
}

export function statsHref() {
  return '/stats'
}

/** The prize counter, where tickets trade for looks. */
export function prizesHref() {
  return '/prizes'
}

/** Your tickets, every one in and out: the prize counter's history. */
export function ticketsHref() {
  return '/prizes/tickets'
}

/** The season's page: its pass and what's on it. */
export function seasonHref() {
  return '/season'
}

/** What tells you, and how: each kind of notification in the inbox, pushed to your devices, or off. */
export function notificationSettingsHref() {
  return '/settings/notifications'
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

/**
 * An in-app href (path, `#/…`, or absolute same-origin URL) as path + query, and any anchor on it
 * (a past course's row, `#course-3`) that isn't an old `#/…` route.
 */
function resolveInAppHref(href: string): string {
  const url = new URL(href, window.location.href)
  const legacy = legacyHashPath(url.hash)
  if (legacy) return legacy
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Go to an in-app href. Pushes a history entry unless the URL is already
 * there; either way the route listeners re-sync, so leaving a game to the
 * page you are technically already on still closes the game.
 */
export function navigate(href: string, options: { replace?: boolean } = {}) {
  const target = resolveInAppHref(href)
  if (normalizeHref(target) !== normalizeHref(`${currentHref()}${window.location.hash}`)) {
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
      // A past day's board is that day's: the site's period changes nothing on it.
      if (route.day) return appendGroupQuery(dayBoardHref(route.game, route.day))
      return appendGroupQuery(gameBoardHref(route.game, period))
    case 'leaderboards':
      if (route.global) return appendGroupQuery(standingsHref(period))
      return appendGroupQuery(leaderboardHref(period))
    case 'rank':
      return appendGroupQuery(rankHref(route.player, period))
    case 'rankHow':
      return appendGroupQuery(rankHowHref(route.player, period))
    case 'records':
      if (route.recordId) {
        return appendGroupQuery(recordHref(route.game, route.recordId, period))
      }
      return appendGroupQuery(recordsHref(route.game, period))
    case 'game':
      // A daily's page is today's and its tabs: the site's period changes nothing on it.
      if (isDailyGame(route.slug)) return dailyTabHref(route.slug, route.tab ?? 'today')
      if (route.board === 'records') {
        return appendGroupQuery(gameHref(route.slug, 'records'))
      }
      return appendGroupQuery(gameHubHref(route.slug, period))
    case 'gamePlay':
      if (route.track) return `${gamePlayHref(route.slug)}?track=${encodeURIComponent(route.track)}`
      if (route.day) return `${gamePlayHref(route.slug)}?day=${encodeURIComponent(route.day)}`
      if (route.lab) return `${gamePlayHref(route.slug)}?lab=1`
      return route.hole ? `${gamePlayHref(route.slug)}?hole=${encodeURIComponent(route.hole)}` : gamePlayHref(route.slug)
    case 'tournamentPlay':
      return tournamentPlayHref(route.id, route.game, route.invite)
    case 'groups':
      return groupsIndexHref()
    case 'group':
      return groupHref(route.id, route.invite)
    // A day's share link, the old /today and the home page's old ?focus=today all open the Dailies page, and say so.
    case 'today':
      return todayHref(route.day)
    default:
      return null
  }
}

/** Period encoded in the current route, if any. */
export function periodFromRoute(route: Route): LeaderboardPeriod | undefined {
  switch (route.name) {
    case 'gameLeaderboard':
      // A daily's board has a day of its own, today's, beside its day points (leaderboardFormat isDayPointsBoard),
      // and none for all time: an old link to that is its month's (lib/allTime.ts).
      if (route.period === 'daily' && isDailyGame(route.game)) return 'daily'
      return route.period ? boardPeriodFor(route.game, coerceVisiblePeriod(route.period)) : undefined
    case 'game':
    case 'leaderboards':
    case 'rank':
    case 'rankHow':
    case 'records':
      return route.period ? coerceVisiblePeriod(route.period) : undefined
    default:
      return undefined
  }
}

export function applySitePeriod(period: LeaderboardPeriod, route: Route = currentRoute()) {
  const nextPeriod = coerceVisiblePeriod(period)
  setDefaultPeriod(nextPeriod)
  // A past day's board has no period of its own: picking one opens the game's board for it, as the page's own tabs do.
  const next =
    route.name === 'gameLeaderboard' && route.day
      ? appendGroupQuery(gameBoardHref(route.game, nextPeriod))
      : hrefForRoute(route, nextPeriod)
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
  if (!path) return new URLSearchParams(search).get('focus') === TODAY_FOCUS ? { name: 'today' } : { name: 'home' }
  // A past day picked on the Dailies page; a day's share link is the page today, whatever day it was sent on.
  const pastDay = DAILIES_DAY_PATH.exec(path)?.[1]
  if (pastDay && realDay(pastDay)) return { name: 'today', day: pastDay }
  if (TODAY_PATH.test(path)) return { name: 'today' }
  if (path === 'about') return { name: 'about' }
  if (path === 'plus') return { name: 'plus' }
  if (path === 'admin') return { name: 'admin' }
  const adminMatch = /^admin\/([^/]+)$/.exec(path)
  if (adminMatch && (ADMIN_SECTIONS as readonly string[]).includes(adminMatch[1]!)) {
    return { name: 'admin', section: adminMatch[1] as AdminSection }
  }
  if (path === 'stats') return { name: 'stats' }
  if (path === 'prizes') return { name: 'prizes' }
  if (path === 'prizes/tickets') return { name: 'tickets' }
  if (path === 'season') return { name: 'season' }
  // Notifications are all the settings there are so far, so /settings is them too.
  if (path === 'settings' || path === 'settings/notifications') return { name: 'notificationSettings' }
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
  if (path === RANK_HOW_PATH) return { name: 'rankHow', period: defaultPeriod() }
  const rankHowMatch = new RegExp(`^${RANK_HOW_PATH}/([^/]+)(?:/([^/]+))?$`).exec(path)
  if (rankHowMatch) {
    const part1 = decodeURIComponent(rankHowMatch[1]!).trim()
    const part2 = rankHowMatch[2] ? decodeURIComponent(rankHowMatch[2]).trim() : undefined
    if (!part2 && isLeaderboardPeriod(part1)) return { name: 'rankHow', period: part1 }
    const player = part1.toUpperCase().slice(0, 12)
    const period = part2 && isLeaderboardPeriod(part2) ? part2 : defaultPeriod()
    return player ? { name: 'rankHow', player, period } : { name: 'rankHow', period }
  }
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

  // A daily's board on one day. A date that isn't one opens its board today; a game that isn't a daily, its board.
  const dayBoardMatch = /^leaderboards\/([^/]+)\/day\/([^/]+)$/.exec(path)
  if (dayBoardMatch) {
    const game = canonicalGameSlug(decodeURIComponent(dayBoardMatch[1]!))
    const day = decodeURIComponent(dayBoardMatch[2]!)
    if (isLeaderboardGame(game)) {
      if (!isDailyGame(game)) return gameLeaderboardRoute(game, defaultPeriod())
      return isDate(day) ? { name: 'gameLeaderboard', game, period: 'daily', day } : gameLeaderboardRoute(game, 'daily')
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

  if (path === 'auth/discord') return { name: 'authDiscord' }

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
    const params = new URLSearchParams(search)
    const hole = params.get('hole')?.trim()
    const track = params.get('track')?.trim()
    const day = params.get('day')?.trim()
    const lab = params.get('lab') === '1'
    return {
      name: 'gamePlay',
      slug: canonicalGameSlug(decodeURIComponent(gamePlayMatch[1])),
      ...(hole ? { hole } : {}),
      ...(track ? { track } : {}),
      ...(day ? { day } : {}),
      ...(lab ? { lab } : {}),
    }
  }

  const gameMatch = /^games\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (gameMatch) {
    const slug = canonicalGameSlug(decodeURIComponent(gameMatch[1]))
    const segment = gameMatch[2] ? decodeURIComponent(gameMatch[2]) : undefined
    // Where Today's Hole was before it was all of Ace Chase, and shared links still point: the play page.
    if (segment === 'daily') {
      return { name: 'gamePlay', slug }
    }
    // A daily's past courses are its page's Past tab; its old archive address opens that tab. No other game had one.
    if (segment === 'past' || segment === 'archive') {
      return isDailyGame(slug) ? { name: 'game', slug, tab: 'past' } : { name: 'game', slug }
    }
    if (segment === 'records') {
      return isDailyGame(slug) ? { name: 'game', slug, tab: 'records' } : { name: 'game', slug, board: 'records' }
    }
    if (segment && isLeaderboardPeriod(segment)) {
      return { name: 'game', slug, period: segment }
    }
    return { name: 'game', slug }
  }

  // Game Over for a place the site has never had. Anything under one of its own sections still comes
  // home, as it always has, so an old or mistyped link there never dead-ends.
  if (path === LEVEL_256) return { name: 'notFound', killScreen: true }
  if (!SITE_SECTIONS.has(path.split('/')[0]!.toLowerCase())) return { name: 'notFound' }
  return { name: 'home' }
}

/** The first part of every address the site has, or has had, or serves itself. */
const SITE_SECTIONS: ReadonlySet<string> = new Set([
  'about',
  'admin',
  'api',
  'auth',
  'c',
  'dailies',
  'dev',
  'e',
  'games',
  'groups',
  'how-ranks-work',
  'index.html',
  'leaderboards',
  'og',
  'plus',
  'prizes',
  'privacy',
  'rank',
  'season',
  'records',
  'settings',
  'stats',
  'terms',
  'today',
  'tournaments',
])

/** Pac-Man's last level, the footer's door to the Game Over screen. */
const LEVEL_256 = 'level/256'

export function levelHref() {
  return `/${LEVEL_256}`
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

/** Whether a route is a daily's own page (any tab): it ignores the site period. */
function dailyPage(route: Route) {
  return route.name === 'game' && isDailyGame(route.slug)
}

/**
 * Whether landing on a route leaves the site's period as it is. Record books default to `all`, a period of
 * their own; a daily's board for today has a period only a daily's board has; a daily's page has no period
 * at all (its address has none); and a daily's month, shown for the site's all time (lib/allTime.ts), is that
 * period still, so all time stays the site's.
 */
function keepsSitePeriod(route: Route, period: LeaderboardPeriod) {
  // The season is a site period like the others (the header's Season, while a season has standings).
  if (period === 'daily' || route.name === 'records' || dailyPage(route)) return true
  return route.name === 'gameLeaderboard' && !route.day && boardPeriodFor(route.game, defaultPeriod()) === period
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useRoute(): Route {
  const [route, setRoute] = useState(() => currentRoute())

  useEffect(() => {
    const start = currentRoute()
    const p = periodFromRoute(start)
    // Some pages' periods are their own, not the sticky period the rest of the site shares (keepsSitePeriod).
    if (p && !keepsSitePeriod(start, p)) setDefaultPeriod(p)
  }, [])

  useEffect(() => {
    const syncRoute = () => {
      let next = currentRoute()
      const p = periodFromRoute(next)
      // A daily's page setting the period would push /games/<daily> over an old /games/<daily>/weekly entry, and Back would land there again.
      if (p && !keepsSitePeriod(next, p)) setDefaultPeriod(p)
      const groupParams = new URLSearchParams(window.location.search)
      if (groupParams.has('group')) {
        setActiveGroup(parseGroupQuery(window.location.search))
      }
      const href = hrefForRoute(next, p ?? defaultPeriod())
      const canonical = href && keepFocus(href)
      if (canonical && normalizeHref(currentHref()) !== normalizeHref(canonical)) {
        // The anchor stays: a past course's row the page is to land on.
        window.history.replaceState(window.history.state, '', `${canonical}${window.location.hash}`)
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
