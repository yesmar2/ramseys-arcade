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

/** `.play-readout__score` / `.play-readout__center` top offsets. */
const SCORE_TOP = 0.55 * ROOT
const CENTER_DROP = 1.65 * ROOT

/** The `clamp()`s those two rules set, and the small-screen override at 420px. */
const SCORE_FONT = { min: 1.35 * ROOT, vw: 0.045, max: 1.85 * ROOT, small: 1.25 * ROOT }
const CENTER_FONT = { min: 1.05 * ROOT, vw: 0.036, max: 1.35 * ROOT, small: 1 * ROOT }
const SMALL_SCREEN = 420

/** Space between the lowest readout and the top of the playfield. */
const CLEARANCE = 0.5 * ROOT

function fontPx(
  w: number,
  font: { min: number; vw: number; max: number; small: number },
) {
  if (w <= SMALL_SCREEN) return font.small
  return Math.min(font.max, Math.max(font.min, w * font.vw))
}

/**
 * Top strip to leave clear, in px.
 *
 * Pass `center` for a game that also renders a {@link PlayReadoutCenter} — the
 * second line sits lower than the first, so it needs the extra room.
 */
export function playHeader(w: number, opts: { center?: boolean } = {}): number {
  const bottom = opts.center
    ? SCORE_TOP + CENTER_DROP + fontPx(w, CENTER_FONT)
    : SCORE_TOP + fontPx(w, SCORE_FONT)
  return Math.round(bottom + CLEARANCE)
}
