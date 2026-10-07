import { chosenSkin } from '../../lib/skins'
import { runPreview, type Sim } from '../previewKit'
import { createInitialState, jumpToLevel, startGame, tick, type GameState } from './game'
import { makePilot } from './pilot'
import { renderGame } from './render'

/*
 * Pileup playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that looks, turns and slides each piece a
 * step at a time the way a person does, picking a worse spot now and then,
 * more often as the blocks speed up, until the pile reaches the top.
 */

/** A cabinet's player: quick, chasing fours, careless enough to need the Shake and to top out in a minute or two. */
const pilotFor = () => makePilot({ look: 0.24, step: 0.07, slip: 0.2, pool: 0.08, fours: true, shakeAt: 3 })

export function makeSim(): Sim<GameState> {
  let drive = pilotFor()
  return {
    start: () => {
      drive = pilotFor()
      // A few levels in, so the blocks come down at a lively pace.
      return jumpToLevel(startGame(createInitialState()), 3)
    },
    step: (s, dt) => tick(drive(s, dt), dt),
    over: (s) => s.phase === 'gameover',
    // The blocks are in the player's own skin.
    render: (ctx, s, w, h) => renderGame(ctx, s, w, h, undefined, chosenSkin('pileup')),
    // The pile doesn't depend on the screen's size, only how it's drawn does.
    resize: (s) => s,
    // The still: the long piece over the slot it's about to drop into.
    poster: { seed: 1, at: 40 },
    hold: 1.4,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
