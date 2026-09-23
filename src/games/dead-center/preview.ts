import { runPreview, type Sim } from '../previewKit'
import {
  aim,
  createInitialState,
  nextRound,
  resizeState,
  shapeCentroid,
  startGame,
  tick,
  TOTAL_ROUNDS,
  type GameState,
  type Point,
  type Shape,
} from './game'
import { renderGame } from './render'

/*
 * Centroid playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that looks each shape over for a second or
 * two and taps where it judges the balance point to be. Its eye is good, not
 * perfect: most taps land close, now and then one is dead on, and now and then
 * one is well off, though always somewhere on the shape, as a person's would
 * be. It takes in each reveal, goes on to the next shape, and after the tenth
 * the run is over.
 */

/**
 * The marks for the tap and the true centre are drawn to the game's scale,
 * and a cabinet's screen is far smaller than any the game is played on. Draw
 * them at the scale the game has on a 390px phone instead, so the two marks
 * stay big enough to tell apart.
 */
const PHONE_SCALE = 390 / 540

/** How far off the balance point a tap lands, as a share of the shape's size. */
function pickMiss(): number {
  const roll = Math.random()
  if (roll < 0.12) return Math.random() * 0.03
  if (roll < 0.52) return 0.05 + Math.random() * 0.11
  if (roll < 0.85) return 0.17 + Math.random() * 0.15
  return 0.34 + Math.random() * 0.2
}

/** Whether a point is on the shape (an even-odd crossing count along a ray from it). */
function onShape(shape: Shape, p: Point): boolean {
  const pts = shape.points
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/**
 * Where the pilot taps for this shape's balance point: off it by a misjudged
 * distance in any direction that stays on the shape. On a thin shape a big
 * misjudgement can only run along its length, which is where a person's goes.
 */
function judge(shape: Shape): Point {
  const c = shapeCentroid(shape)
  let off = shape.size * pickMiss()
  for (let tries = 1; ; tries++) {
    const angle = Math.random() * Math.PI * 2
    const at = { x: c.x + Math.cos(angle) * off, y: c.y + Math.sin(angle) * off }
    if (off < 1 || onShape(shape, at)) return at
    // No room that far out on this shape; come in a little.
    if (tries % 4 === 0) off *= 0.8
  }
}

export function makeSim(): Sim<GameState> {
  // The round the pilot is on, how much longer it looks before it taps, and how long it takes in the reveal.
  let round = 0
  let look = 0
  let linger = 0

  const drive = (s: GameState, dt: number): GameState => {
    if (s.phase === 'playing' && s.shape) {
      if (round !== s.round) {
        round = s.round
        // A look of 0.9 to 2 seconds is well inside the round's five, so the pilot is never too slow. With at least
        // 1.3 seconds on the reveal after it, the first reveal is always up at 2.1 seconds, where the still is taken.
        look = 0.9 + Math.random() * 1.1
        linger = 1.3 + Math.random() * 0.6
      }
      look -= dt
      if (look > 0) return s
      const at = judge(s.shape)
      return aim(s, at.x, at.y)
    }
    // Where the page waits for Next, the pilot presses it once it has seen the marks.
    if (s.phase === 'reveal' && s.round < TOTAL_ROUNDS) {
      linger -= dt
      if (linger <= 0) return nextRound(s)
    }
    return s
  }

  return {
    // The shapes are laid out in the screen's own pixels, so a new size means a new run rather than a resize.
    start: (w, h) => {
      round = 0
      return startGame(resizeState(createInitialState(w, h), w, h))
    },
    step: (s, dt) => tick(drive(s, dt), dt),
    // The tenth reveal is the end of the run: past it the page clears the field for its score card.
    over: (s) => s.phase === 'gameover' || (s.phase === 'reveal' && s.round >= TOTAL_ROUNDS),
    // The field as the game draws it, minus any score floaters written over it for a player.
    render: (ctx, s, w, h) => renderGame(ctx, { ...s, scale: Math.max(s.scale, PHONE_SCALE), floaters: [] }, w, h),
    // Open on the first shape's reveal, with the tap and the true centre both marked (see the look, above).
    warmup: 2.1,
    hold: 2,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
