import { runPreview, type Sim } from '../previewKit'
import { createInitialState, placeBlock, startGame, tick, type GameState } from './StackerEngine'
import { renderGame } from './render'

/*
 * Stacker playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that drops each slab the way a person
 * does, most often dead on and sometimes a little late or early, getting
 * shakier as the tower climbs until a slab misses and the tower starts again.
 */

/** Where the pilot means to drop the next slab: dead on at first, wider as the tower climbs. */
function pickAim(height: number): number {
  const steady = Math.max(0.25, 0.7 - height * 0.02)
  if (Math.random() < steady) return (Math.random() - 0.5) * 3.5
  const off = 4 + Math.random() * (8 + height * 0.9)
  return Math.random() < 0.5 ? -off : off
}

export function makeSim(): Sim<GameState> {
  // How far off centre the pilot means to drop the slab now moving, and the height it was picked at.
  let aim = 0
  let aimedAt = -1

  const drive = (s: GameState): GameState => {
    const height = s.stack.length
    if (aimedAt !== height) {
      aimedAt = height
      aim = pickAim(height)
    }
    const top = s.stack[height - 1]
    const target = (s.axis === 'x' ? top.x : top.z) + aim
    // Press as the slab reaches the mark on its way across; if it has already passed, wait for it to come back.
    const reached = s.direction === 1 ? s.movingPos >= target : s.movingPos <= target
    return reached && Math.abs(s.movingPos - target) < 14 ? placeBlock(s) : s
  }

  return {
    start: () => {
      aimedAt = -1
      return startGame(createInitialState())
    },
    step: (s, dt) => tick(s.phase === 'playing' ? drive(s) : s, dt),
    over: (s) => s.phase === 'gameover',
    render: (ctx, s, w, h) => renderGame(ctx, s, w, h),
    warmup: 7,
    hold: 1.6,
    // The game draws at fixed sizes, for a canvas the size of a phone's play area.
    stage: 2.5,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
