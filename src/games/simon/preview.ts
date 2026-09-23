import { runPreview, type Sim } from '../previewKit'
import { createInitialState, PAD_COUNT, resizeState, startGame, tapPadId, tick, type GameState } from './game'
import { renderGame } from './render'

/*
 * Simon playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that watches each sequence through and
 * plays it back at a person's pace. Short sequences it always has; from seven
 * notes on it is more and more likely to lose its place in the back half of
 * one, stop for a beat, and press the wrong pad, which ends the run, most
 * often somewhere between half a minute and a minute in.
 */

/** The chance the pilot loses its place somewhere in a sequence this long. */
function slipChance(length: number): number {
  return length < 7 ? 0 : Math.min(0.8, 0.2 + (length - 7) * 0.2)
}

/** Which press of a sequence this long goes wrong, or -1 when the pilot gets through it. */
function pickSlip(length: number): number {
  if (Math.random() >= slipChance(length)) return -1
  // The front of a sequence has been played back every round; it is the back half that goes.
  const from = Math.ceil(length / 2)
  return from + Math.floor(Math.random() * (length - from))
}

/** Seconds between presses: a person's steady beat, never quite a metronome's. */
function beat() {
  return 0.3 + Math.random() * 0.2
}

/** The extra moment a person takes over a press they are no longer sure of. */
function doubt() {
  return 0.25 + Math.random() * 0.3
}

/** Any pad but this one. */
function otherThan(pad: number) {
  return (pad + 1 + Math.floor(Math.random() * (PAD_COUNT - 1))) % PAD_COUNT
}

export function makeSim(): Sim<GameState> {
  // The length of the sequence being played back, the time to the next press, and the press that will go wrong.
  let length = 0
  let wait = 0
  let slip = -1

  const drive = (s: GameState, dt: number): GameState => {
    if (length !== s.sequence.length) {
      length = s.sequence.length
      slip = pickSlip(length)
      wait = 0.35 + Math.random() * 0.25
    }
    wait -= dt
    if (wait > 0) return s
    const right = s.sequence[s.inputIndex]
    const next = tapPadId(s, s.inputIndex === slip ? otherThan(right) : right)
    wait = beat() + (next.inputIndex === slip ? doubt() : 0)
    return next
  }

  return {
    start: (w, h) => {
      length = 0
      return startGame(resizeState(createInitialState(w, h), w, h))
    },
    step: (s, dt) => tick(s.phase === 'input' ? drive(s, dt) : s, dt),
    over: (s) => s.phase === 'gameover',
    // Nothing is written over the board for a player; the round count and the cards are the page's.
    render: (ctx, s, w, h) => renderGame(ctx, s, w, h),
    resize: resizeState,
    // The pads sit in a square in the middle of a screen wider than it is tall. Take in a little less of the
    // field around them, so they fill the screen and a lit pad, which swells, still clears its edge.
    zoom: 1.2,
    // Open as the fourth round's sequence plays, most often with one of its pads lit.
    warmup: 9.1,
    // Hold on the wrong pad, still lit.
    hold: 1.6,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
