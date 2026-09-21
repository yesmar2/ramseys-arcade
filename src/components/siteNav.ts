import {
  currentPath,
  homeHref,
  leaderboardHref,
  rankHref,
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

/** Primary destinations — desktop links + drawer (Global lives under Boards). Games first: it is the shelf. */
export const SITE_NAV_LINKS: readonly SiteNavItem[] = [
  { href: homeHref(), label: 'Games', match: 'games' },
  { href: leaderboardHref(), label: 'Boards', match: 'boards' },
  { href: tournamentsHref(), label: 'Events', match: 'events' },
  { href: recordsIndexHref(), label: 'Record books', match: 'records' },
  { href: groupsIndexHref(), label: 'Groups', match: 'groups' },
] as const

/** Drawer Profile link — header chip opens the account drawer instead. */
export const SITE_DRAWER_YOU: SiteNavItem = {
  href: rankHref(),
  label: 'Profile',
  match: 'you',
}

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
