import { runPreview, type Sim } from '../previewKit'
import {
  createInitialState,
  onPlate,
  setPin,
  startGame,
  tick,
  type GameState,
  type Plate,
  type Point,
} from './game'
import { renderGame } from './render'

/*
 * Centroid playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that looks each plate over for a second or
 * so and pins it where it judges the balance point to be. Its eye is good, not
 * perfect: most plates balance, now and then one is dead on, and now and then
 * one is off far enough to tip over, which is the game's best moment to see.
 */

/** How far off the balance point the pilot's pin lands, in plate sizes, for a plate with this margin. */
function pickOff(margin: number): number {
  const roll = Math.random()
  if (roll < 0.28) return Math.random() * 0.018
  if (roll < 0.78) return 0.02 + Math.random() * Math.max(0, margin - 0.028)
  return margin + 0.03 + Math.random() * 0.22
}

/** Where the pilot pins this plate: off the balance point by a misjudged distance, in any direction that is on the plate. */
function judge(plate: Plate, margin: number): Point {
  const c = plate.centroid
  let off = pickOff(margin) * plate.size
  for (let tries = 1; tries < 60; tries++) {
    const a = Math.random() * Math.PI * 2
    const at = { x: c.x + Math.cos(a) * off, y: c.y + Math.sin(a) * off }
    if (onPlate(plate.points, at)) return at
    // No room that far out on this plate; come in a little.
    if (tries % 4 === 0) off *= 0.8
  }
  return c
}

export function makeSim(): Sim<GameState> {
  // The plate the pilot is looking at, and how much longer it looks.
  let plateNo = 0
  let look = 0

  const drive = (s: GameState, dt: number): GameState => {
    if (s.phase !== 'aiming' || !s.plate || s.appear < 1) return s
    if (plateNo !== s.plateNo) {
      plateNo = s.plateNo
      look = 0.7 + Math.random() * 1.1
    }
    look -= dt
    return look > 0 ? s : setPin(s, judge(s.plate, s.margin))
  }

  return {
    start: () => {
      plateNo = 0
      return startGame(createInitialState())
    },
    step: (s, dt) => tick(drive(s, dt), dt),
    over: (s) => s.phase === 'gameover',
    // The table as the game draws it, minus the points written over it for a player.
    render: (ctx, s, w, h) => renderGame(ctx, { ...s, floaters: [] }, w, h),
    // The table is measured in its own units, so a new screen only draws it bigger or smaller.
    resize: (s) => s,
    // A cabinet's screen is small: closer in on the plate, leaving the clock under it out of the picture.
    zoom: 1.25,
    // The still: a teal plate set down dead center on its pin, the gold ring going out.
    poster: { seed: 7, at: 8.167 },
    hold: 2,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
