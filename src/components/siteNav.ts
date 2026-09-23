import {
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

function under(path: string, section: string) {
  return path === section || path.startsWith(`${section}/`)
}

/** Whether a primary nav item should show as the current section. */
export function navActive(match: SiteNavItem['match'], path = currentPath()): boolean {
  const p = currentPath(path)

  // A game's page is under Games; its record book is under Record books.
  if (match === 'games') return p === '/' || (under(p, '/games') && !/\/records(?:\/|$)/.test(p))
  if (match === 'boards') return under(p, '/leaderboards')
  if (match === 'records') {
    if (under(p, '/records')) return true
    return /^\/games\/[^/]+\/records(?:\/|$)/.test(p)
  }
  if (match === 'events') return under(p, '/tournaments')
  if (match === 'groups') return under(p, '/groups')
  if (match === 'you') return under(p, '/rank')
  return false
}
