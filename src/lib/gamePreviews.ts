/** A game running itself for a tile: advance by `dt` seconds (0 just redraws) and draw at `w`×`h` CSS pixels. */
export type GamePreviewRun = {
  paint(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number): void
  /**
   * Play the opening seconds before the first frame a slice at a time, for
   * about `budgetMs` at most, and say whether they are all played. Without
   * it, or if it is never called, the first `paint` plays them in one go.
   */
  warm?(w: number, h: number, budgetMs: number): boolean
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
  frenzy: () => import('../games/frenzy/preview'),
  patriot: () => import('../games/patriot/preview'),
  pellets: () => import('../games/pellets/preview'),
  pop: () => import('../games/whack/preview'),
  putt: () => import('../games/putt/preview'),
  simon: () => import('../games/simon/preview'),
  snake: () => import('../games/snake/preview'),
  stacker: () => import('../games/stacker/preview'),
}

export function hasGamePreview(slug: string) {
  return slug in GAME_PREVIEWS
}
