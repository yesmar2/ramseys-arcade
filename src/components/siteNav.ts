import {
  leaderboardHref,
  rankHref,
  recordsIndexHref,
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
  { href: '#/tournaments', label: 'Events', match: 'events' },
] as const

/** Drawer-only: You is also the header chip. */
export const SITE_DRAWER_YOU: SiteNavItem = {
  href: rankHref(),
  label: 'You',
  match: 'you',
}

function currentHash(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  const raw = hash || '#/'
  return raw.startsWith('#') ? raw : `#${raw}`
}

/** Whether a primary nav item should show as the current section. */
export function navActive(
  match: SiteNavItem['match'],
  hash = typeof window !== 'undefined' ? window.location.hash : '',
): boolean {
  const h = currentHash(hash)

  if (match === 'boards') {
    return h === '#/leaderboards' || h.startsWith('#/leaderboards/')
  }
  if (match === 'records') {
    if (h === '#/records' || h.startsWith('#/records/')) return true
    return /^#\/games\/[^/]+\/records(?:\/|$)/.test(h)
  }
  if (match === 'events') {
    return h === '#/tournaments' || h.startsWith('#/tournaments/')
  }
  if (match === 'you') {
    return h === '#/rank' || h.startsWith('#/rank/')
  }
  return false
}
