import { lazyPage, type LazyPage } from '../lib/lazyPage'

/**
 * The game pages by route slug, each its own chunk (see lazyPage). One map
 * serves the router and the prefetching: a game's hub page, the home banner
 * and any Play link pointed at warm the game before it is opened, so the tap
 * lands on a game that is already here.
 */
export const GAME_PAGES: Record<string, LazyPage<object>> = {
  asteroids: lazyPage(() => import('./AsteroidsPage').then((m) => m.AsteroidsPage)),
  barrage: lazyPage(() => import('./BarragePage').then((m) => m.BarragePage)),
  bop: lazyPage(() => import('./BopPage').then((m) => m.BopPage)),
  centroid: lazyPage(() => import('./DeadCenterPage').then((m) => m.DeadCenterPage)),
  crosswalk: lazyPage(() => import('./CrosswalkPage').then((m) => m.CrosswalkPage)),
  crumbtrail: lazyPage(() => import('./CrumbtrailPage').then((m) => m.CrumbtrailPage)),
  findbug: lazyPage(() => import('./FindBugPage').then((m) => m.FindBugPage)),
  fireflies: lazyPage(() => import('./FirefliesPage').then((m) => m.FirefliesPage)),
  frenzy: lazyPage(() => import('./FrenzyPage').then((m) => m.FrenzyPage)),
  patriot: lazyPage(() => import('./PatriotPage').then((m) => m.PatriotPage)),
  pellets: lazyPage(() => import('./PelletsPage').then((m) => m.PelletsPage)),
  pop: lazyPage(() => import('./WhackPage').then((m) => m.WhackPage)),
  putt: lazyPage(() => import('./PuttPage').then((m) => m.PuttPage)),
  snake: lazyPage(() => import('./SnakePage').then((m) => m.SnakePage)),
  stacker: lazyPage(() => import('./StackerPage').then((m) => m.StackerPage)),
}

/** Start fetching a game's chunk; nothing happens for a slug that is not a game. */
export function preloadGamePage(slug: string) {
  void GAME_PAGES[slug]?.preload()
}

const PLAY_HREF = /^\/games\/([^/?#]+)\/play(?:[/?#]|$)/
const EVENT_PLAY_HREF = /^\/tournaments\/[^/?#]+\/play\/([^/?#]+)/

/** Warm the game a link leads to, when it is a Play link. */
export function preloadGameFromHref(href: string) {
  const slug = PLAY_HREF.exec(href)?.[1] ?? EVENT_PLAY_HREF.exec(href)?.[1]
  if (slug) preloadGamePage(decodeURIComponent(slug))
}
