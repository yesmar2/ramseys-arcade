/** A game running itself for a tile: advance by `dt` seconds (0 just redraws) and draw at `w`×`h` CSS pixels. */
export type GamePreviewRun = {
  paint(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number): void
  /**
   * Play the opening seconds before the first frame a slice at a time, for
   * about `budgetMs` at most, and say whether they are all played. Without
   * it, or if it is never called, the first `paint` plays them in one go.
   */
  warm?(w: number, h: number, budgetMs: number): boolean
  /** Let go of whatever it holds (a WebGL renderer, say) once its tile is gone. */
  dispose?(): void
}

/**
 * Games that can play themselves in a tile, and where their preview lives.
 * Each loads on demand, so the home page carries none of this until a tile
 * that uses it comes into view.
 */
export const GAME_PREVIEWS: Record<string, () => Promise<{ createPreview(): GamePreviewRun }>> = {
  asteroids: () => import('../games/asteroids/preview'),
  barrage: () => import('../games/barrage/preview'),
  bop: () => import('../games/bop/preview'),
  centroid: () => import('../games/dead-center/preview'),
  crosswalk: () => import('../games/crosswalk/preview'),
  crumbtrail: () => import('../games/crumbtrail/preview'),
  findbug: () => import('../games/findbug/preview'),
  fireflies: () => import('../games/fireflies/preview'),
  frenzy: () => import('../games/frenzy/preview'),
  halffull: () => import('../games/halffull/preview'),
  patriot: () => import('../games/patriot/preview'),
  pellets: () => import('../games/pellets/preview'),
  pop: () => import('../games/whack/preview'),
  putt: () => import('../games/putt/preview'),
  snake: () => import('../games/snake/preview'),
  stacker: () => import('../games/stacker/preview'),
}

export function hasGamePreview(slug: string) {
  return slug in GAME_PREVIEWS
}

/**
 * Dailies that can play a given day in a tile, for the home page's Dailies row: the day's track driven, the
 * day's course rolled, the day's cave flown. Kept apart from the games' previews above, which play the same
 * game any day, so a page that shows another day (a past day's board) never plays today's in its place.
 */
export const DAY_PREVIEWS: Record<string, () => Promise<{ createDayPreview(day: string): GamePreviewRun }>> = {
  hotlap: () => import('../games/hotlap/preview'),
  lander: () => import('../games/lander/preview'),
  marblerun: () => import('../games/marblerun/preview'),
}

export function hasDayPreview(slug: string) {
  return slug in DAY_PREVIEWS
}
