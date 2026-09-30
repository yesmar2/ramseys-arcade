import { isDailyGame } from '../data/games'
import {
  canonicalGameSlug,
  currentPath,
  homeHref,
  leaderboardHref,
  recordsIndexHref,
  tournamentsHref,
} from '../hooks/useHashRoute'
import { groupsIndexHref } from '../lib/groups'

export type SiteNavItem = {
  href: string
  label: string
  /** Match nested routes under this destination. */
  match: 'games' | 'boards' | 'records' | 'events' | 'groups' | 'you'
}

/** Primary destinations — the desktop header's links (Global lives under Boards). Games first: it is the shelf. */
export const SITE_NAV_LINKS: readonly SiteNavItem[] = [
  { href: homeHref(), label: 'Games', match: 'games' },
  { href: leaderboardHref(), label: 'Boards', match: 'boards' },
  { href: tournamentsHref(), label: 'Events', match: 'events' },
  { href: recordsIndexHref(), label: 'Record books', match: 'records' },
  { href: groupsIndexHref(), label: 'Groups', match: 'groups' },
] as const

/**
 * The phone's tab bar, before You: the same places with shorter names. Groups
 * are yours, so on a phone they live in the You menu instead.
 */
export const SITE_TABS: readonly SiteNavItem[] = [
  { href: homeHref(), label: 'Games', match: 'games' },
  { href: leaderboardHref(), label: 'Boards', match: 'boards' },
  { href: tournamentsHref(), label: 'Events', match: 'events' },
  { href: recordsIndexHref(), label: 'Records', match: 'records' },
] as const

/** Fired on window to open the header's menu from anywhere on the page: where signing in lives. */
export const OPEN_MENU_EVENT = 'skermix:open-menu'

export function openSiteMenu() {
  window.dispatchEvent(new Event(OPEN_MENU_EVENT))
}

function under(path: string, section: string) {
  return path === section || path.startsWith(`${section}/`)
}

/**
 * `/games/<slug>/records` is an old link to a game's record book (its page sends it there), except
 * for a daily, where it is its page's Records tab: under Games, like its Today and Past tabs.
 */
function isOldBookLink(p: string): boolean {
  const m = /^\/games\/([^/]+)\/records(?:\/|$)/.exec(p)
  if (!m) return false
  let slug = m[1]!
  try {
    slug = decodeURIComponent(slug)
  } catch {
    // Not a real address; keep it as it is.
  }
  return !isDailyGame(canonicalGameSlug(slug))
}

/** Whether a primary nav item should show as the current section. */
export function navActive(match: SiteNavItem['match'], path = currentPath()): boolean {
  const p = currentPath(path)

  // A game's page (a daily's tabs included) is under Games; an old link to its record book is under Record books.
  const bookLink = isOldBookLink(p)
  if (match === 'games') return p === '/' || (under(p, '/games') && !bookLink)
  if (match === 'boards') return under(p, '/leaderboards')
  if (match === 'records') return under(p, '/records') || bookLink
  if (match === 'events') return under(p, '/tournaments')
  if (match === 'groups') return under(p, '/groups')
  if (match === 'you') return under(p, '/rank')
  return false
}
