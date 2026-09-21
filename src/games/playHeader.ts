/**
 * How much room at the top of a stage belongs to the score readout.
 *
 * The readout is a DOM element laid over the canvas, so nothing a renderer
 * draws can see it. Every game that cared worked out its own number for this
 * and they all differed — Pellets reserved 40 to 64px, Crosswalk 52 to 76,
 * Snake something else again — and the games that never worked one out drew
 * their board straight under the score and hoped.
 *
 * So the figure comes from one place, and it is the CSS's own, not a guess:
 * the sizes below mirror `.play-readout__score` and `.play-readout__center` in
 * styles.css, and the two are meant to be changed together.
 *
 * `safe-area-inset-top` is deliberately not in here. A renderer cannot read it,
 * and on the phones that have one the stage is already inset by it, so the
 * clearance below is measured from the top of the stage either way.
 */

/** px per rem, matching the document root. */
const ROOT = 16

/** `.play-readout__score` top offset. */
const SCORE_TOP = 0.55 * ROOT

/** The `clamp()` that rule sets, and the small-screen override at 420px. */
const SCORE_FONT = { min: 1.35 * ROOT, vw: 0.045, max: 1.85 * ROOT, small: 1.25 * ROOT }
const SMALL_SCREEN = 420

/**
 * `.play-stats` — the labelled columns under the score.
 *
 * Sized to this rather than to `.play-readout__center`, the older free-text
 * line a couple of games still use, because the columns are the taller of the
 * two. Room enough for them is room enough for either.
 */
const STATS_DROP = 2.05 * ROOT
const STAT_LABEL = { base: 0.58 * ROOT, small: 0.54 * ROOT }
const STAT_GAP = 0.1 * ROOT
const STAT_VALUE = { base: 1.02 * ROOT, small: 0.95 * ROOT }
/** `.play-stat__value` line-height. */
const STAT_LEADING = 1.05

/** Space between the lowest readout and the top of the playfield. */
const CLEARANCE = 0.5 * ROOT

function fontPx(
  w: number,
  font: { min: number; vw: number; max: number; small: number },
) {
  if (w <= SMALL_SCREEN) return font.small
  return Math.min(font.max, Math.max(font.min, w * font.vw))
}

function fixedPx(w: number, size: { base: number; small: number }) {
  return w <= SMALL_SCREEN ? size.small : size.base
}

/**
 * Top strip to leave clear, in px.
 *
 * Pass `center` for a game that shows a second line under the score — the run
 * state most of them carry. It sits lower than the score, so it needs the room.
 */
export function playHeader(w: number, opts: { center?: boolean } = {}): number {
  if (!opts.center) return Math.round(SCORE_TOP + fontPx(w, SCORE_FONT) + CLEARANCE)
  const stats =
    STATS_DROP + fixedPx(w, STAT_LABEL) + STAT_GAP + fixedPx(w, STAT_VALUE) * STAT_LEADING
  return Math.round(SCORE_TOP + stats + CLEARANCE)
}
