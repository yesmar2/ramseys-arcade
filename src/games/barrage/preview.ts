import { runPreview, type Sim } from '../previewKit'
import { createInitialState, jumpToWave, startGame, tick, type GameState } from './game'
import { makePilot } from './pilot'
import { renderGame } from './render'

/*
 * Barrage playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, flown by the pilot that reads the bullets the way a
 * person does and now and then doesn't see one coming (see pilot.ts). A run
 * on the cabinet opens a couple of waves in, where the patterns have filled
 * out, and ends the way a person's does.
 */

/** The wave a cabinet run opens on. */
const OPENING_WAVE = 3

export function makeSim(): Sim<GameState> {
  const pilot = makePilot({ skill: 0.72 })

  const begin = (): GameState => {
    pilot.reset()
    return jumpToWave(startGame(createInitialState()), OPENING_WAVE)
  }

  return {
    start: begin,
    step: (s, dt) => {
      pilot.drive(s, dt)
      return tick(s, dt)
    },
    over: (s) => s.phase === 'gameover',
    render: (ctx, s, w, h) => renderGame(ctx, screen(s), w, h),
    // The world is one shape at any size, so a new size changes nothing.
    resize: (s) => s,
    // The still: walls with a gap in each and an octo's orbs among them, the ship threading through with a bullet in its graze ring.
    poster: { seed: 21, at: 18.7 },
    // The engine has already played the last ship going up.
    hold: 1.2,
  }
}

/** The field as the game draws it, minus the words written over it for a player. */
function screen(s: GameState): GameState {
  return { ...s, banner: null, floaters: [] }
}

export function createPreview() {
  return runPreview(makeSim())
}
