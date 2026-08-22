import { globalRankingsHref, leaderboardHref } from '../hooks/useHashRoute'

/** Primary nav links — single source for desktop + mobile menus. */
export const SITE_NAV_LINKS = [
  { href: leaderboardHref(), label: 'Leaderboards' },
  { href: globalRankingsHref(), label: 'Global rankings' },
  { href: '#/tournaments', label: 'Tournaments' },
] as const
