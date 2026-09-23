import { runPreview, type Sim } from '../previewKit'
import { createInitialState, flySpot, setScale, startGame, tapFly, tick, type GameState } from './game'
import { renderGame } from './render'

/*
 * Fireflies playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that watches each tune through and taps it
 * back at a person's pace. Short tunes it always has; from seven notes on it
 * is more and more likely to lose its place in the back half of one, stop for
 * a beat, and tap the wrong firefly, which ends the night.
 */

/** The chance the pilot loses its place somewhere in a tune this long. */
function slipChance(length: number): number {
  return length < 7 ? 0 : Math.min(0.8, 0.2 + (length - 7) * 0.2)
}

/** Which note of a tune this long goes wrong, or -1 when the pilot gets through it. */
function pickSlip(length: number): number {
  if (Math.random() >= slipChance(length)) return -1
  // The front of a tune has been played back every round; it is the back half that goes.
  const from = Math.ceil(length / 2)
  return from + Math.floor(Math.random() * (length - from))
}

/** Seconds between taps: a person's steady beat, never quite a metronome's. */
function beat() {
  return 0.32 + Math.random() * 0.2
}

/** The extra moment a person takes over a note they are no longer sure of. */
function doubt() {
  return 0.25 + Math.random() * 0.3
}

export function makeSim(): Sim<GameState> {
  // The length of the tune being played back, the time to the next tap, and the note that will go wrong.
  let length = 0
  let wait = 0
  let slip = -1

  const drive = (s: GameState, dt: number): GameState => {
    if (length !== s.seq.length) {
      length = s.seq.length
      slip = pickSlip(length)
      wait = 0.4 + Math.random() * 0.25
    }
    wait -= dt
    if (wait > 0) return s
    const right = s.seq[s.inputIdx]!
    const n = s.flies.length
    const id = s.inputIdx === slip ? (right + 1 + Math.floor(Math.random() * (n - 1))) % n : right
    const fly = s.flies.find((f) => f.id === id)
    const next = tapFly(s, id)
    wait = beat() + (next.inputIdx === slip ? doubt() : 0)
    if (!fly) return next
    // The finger that tapped: a ring where it landed.
    const spot = flySpot(s, fly)
    return { ...next, taps: [...next.taps, { x: spot.x + (Math.random() - 0.5) * 8, y: spot.y + (Math.random() - 0.5) * 8, t: s.time }] }
  }

  return {
    start: (w, h) => {
      length = 0
      return startGame(setScale(createInitialState(w, h), w, h, 0))
    },
    step: (s, dt) => tick(s.phase === 'input' ? drive(s, dt) : s, dt),
    // Over from the slip itself: the hold plays it out, the red, the scatter, the lanterns going dark.
    over: (s) => s.phase === 'fail' || s.phase === 'gameover',
    // Nothing is written over the pond for a player; the score and the cards are the page's.
    render: (ctx, s, w, h) => renderGame(ctx, s, w, h, false),
    resize: (s, w, h) => setScale(s, w, h, 0),
    // The still: a tune playing, a firefly lit over the water, lanterns already burning.
    poster: { seed: 7, at: 30 },
    // Long enough for the slip to play out before the next night starts.
    hold: 2.2,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
