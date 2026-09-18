import {
  currentPath,
  leaderboardHref,
  rankHref,
  recordsIndexHref,
  tournamentsHref,
} from '../hooks/useHashRoute'

export type SiteNavItem = {
  href: string
  label: string
  /** Match nested routes under this destination. */
  match: 'boards' | 'records' | 'events' | 'you'
}

/** Primary destinations — desktop links + drawer (Global lives under Boards). */
export const SITE_NAV_LINKS: readonly SiteNavItem[] = [
  { href: leaderboardHref(), label: 'Boards', match: 'boards' },
  { href: recordsIndexHref(), label: 'Record books', match: 'records' },
  { href: tournamentsHref(), label: 'Events', match: 'events' },
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

  if (match === 'boards') return under(p, '/leaderboards')
  if (match === 'records') {
    if (under(p, '/records')) return true
    return /^\/games\/[^/]+\/records(?:\/|$)/.test(p)
  }
  if (match === 'events') return under(p, '/tournaments')
  if (match === 'you') return under(p, '/rank')
  return false
}
