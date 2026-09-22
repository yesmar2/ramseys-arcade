/** A game running itself for a tile: advance by `dt` seconds (0 just redraws) and draw at `w`×`h` CSS pixels. */
export type GamePreviewRun = {
  paint(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number): void
}

/**
 * Games that can play themselves in a tile, and where their preview lives.
 * Each loads on demand, so the home page carries none of this until a tile
 * that uses it comes into view.
 */
export const GAME_PREVIEWS: Record<string, () => Promise<{ createPreview(): GamePreviewRun }>> = {
  frenzy: () => import('../games/frenzy/preview'),
}

export function hasGamePreview(slug: string) {
  return slug in GAME_PREVIEWS
}
