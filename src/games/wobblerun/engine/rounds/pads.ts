/**
 * The pieces between rounds (design-final §4.2): the start pad with its barrier and the start slide out of the
 * gate, the checkpoint pads (a split at each one's flag line), the slide down after a round that ends high, and
 * the bounce-up onto a higher pad. Each is laid in its own frame, as a round is (z from its start, y from the
 * height it starts at), and the course puts it in place.
 */
import { sinkAt } from '../sim.ts'
import type { Rng, RoundOut, RoundSlot } from '../types.ts'
import { kit } from './kit.ts'

/** The slides' slope, and the start pad's height above the course's base. */
export const SLIDE_ANGLE = (14 * Math.PI) / 180
export const START_Y = 4
/** The start pad's length, where the bean waits on it, and where its barrier stands. */
const START_LEN = 12
export const START_SPAWN_Z = 4
const BARRIER_Z = 10
/** A checkpoint pad's length and half width, and where its flag line is (a split's crossing). */
export const CHECK_LEN = 6
export const CHECK_HX = 4.5
export const CHECK_LINE = 0.5

const pieceSlot = (letter: string): RoundSlot => ({ i: -1, count: 0, letter, tier: 1, period: 3.4, finale: false, seed: letter })

/**
 * The start: a 12 × 10 m pad 4 m up, the bean on it at z 4 behind a jelly barrier at z 10 that sinks into the pad
 * at GO, then the start slide (slick, 14°, a boost hoop on it) down to the course's base and a 2 m run-out into
 * the first round. Its route: `start` (where the bean waits) and `top` (the top of the slide); the course joins
 * `top` to the first round's `in`, running down or (a gold move) belly sliding.
 */
export function startPiece(rng: Rng): RoundOut {
  const k = kit(pieceSlot('start'), 1)
  const len = START_Y / Math.tan(SLIDE_ANGLE)
  k.box({ hx: 5, hz: START_LEN / 2, z: START_LEN / 2, top: START_Y, hy: 1.2, look: 'start-pad', role: 'check', tint: -1 })
  // Walls round the pad but for the way down the slide.
  k.walls(0, START_LEN, { hx: 5, y: START_Y })
  k.box({ x: 0, z: -0.25, hx: 5.5, hz: 0.25, top: START_Y + 1, hy: 0.8, look: 'rail', noGround: true })
  for (const side of [-1, 1]) k.box({ x: side * 4.25, z: START_LEN + 0.25, hx: 0.75, hz: 0.25, top: START_Y + 1, hy: 0.8, look: 'rail', noGround: true })
  k.box({ hx: 5, hz: 0.25, z: BARRIER_Z, top: START_Y + 1.2, hy: 0.6, look: 'barrier', role: 'jelly', noGround: true, ledge: false, move: sinkAt(0, 0.25, 1.25) })
  // The start slide, its walls, and a hoop for the bold.
  k.ramp(START_LEN, START_LEN + len, START_Y, -START_Y, { hx: 3.5, look: 'slide', slick: true, hy: 0.8 })
  k.walls(START_LEN, START_LEN + len, { hx: 3.5, y: START_Y, rise: -START_Y, h: 0.9 })
  const hz = START_LEN + len * 0.62
  k.hoop({ x: rng.between(-1.4, 1.4), z: hz, y: START_Y - (hz - START_LEN) * Math.tan(SLIDE_ANGLE) + 1.0, dir: { x: 0, z: 1 } })
  k.floor(START_LEN + len, START_LEN + len + 2, { hx: 4.5, top: 0 })
  k.walls(START_LEN + len, START_LEN + len + 2, { hx: 4.5 })
  k.node('start', 0, START_SPAWN_Z, { y: START_Y })
  k.node('top', 0, START_LEN - 0.6, { y: START_Y, wait: 'no' })
  k.edge('start', 'top')
  for (const side of [-1, 1]) k.deco({ look: 'flag', x: side * 4.6, y: START_Y, z: START_LEN - 0.2, sy: 2.6, params: { start: true } })
  k.deco({ look: 'arch', x: 0, y: START_Y, z: BARRIER_Z, sx: 10.6, sy: 4.2, sz: 0.6 })
  k.out.camera = 'slide'
  const out = k.out
  out.exit = { x: 0, y: 0, z: START_LEN + len + 2 }
  out.deaths.push({ z0: -10, z1: START_LEN + len * 0.5, y: START_Y - 6 })
  return out
}

/**
 * Checkpoint pad `index` (1 for the first): 6 m × 9 m, white, amber flags that turn green, the split at its flag
 * line (z 0.5) and the spawn at its centre. Its route node `cp` is where a bot stands on it.
 */
export function checkPiece(index: number): RoundOut {
  const k = kit(pieceSlot('check'), 1)
  k.box({ hx: CHECK_HX, hz: CHECK_LEN / 2, z: CHECK_LEN / 2, top: 0, hy: 1.2, look: 'check-pad', role: 'check', tint: -1 })
  for (const side of [-1, 1]) k.deco({ look: 'flag', x: side * (CHECK_HX - 0.25), y: 0, z: CHECK_LINE, sy: 2.6, role: 'check', params: { checkpoint: index } })
  k.deco({ look: 'stripe', x: 0, y: 0.01, z: CHECK_LINE, sx: CHECK_HX * 2, sy: 0.02, sz: 0.35, role: 'check', params: { checkpoint: index } })
  k.node('cp', 0, CHECK_LEN / 2)
  const out = k.out
  out.exit = { x: 0, y: 0, z: CHECK_LEN }
  return out
}

/**
 * The slide down after a round that ends high (design-final §4.2): a 3 m landing, then a slick 14° slide down
 * `drop` m with a hoop on it, straight onto the pad below. The spec's lip and 3 m gap are left out: running off
 * a 0.4 m lip at a walk falls short of 3 m, and a kid holding the stick halfway would splat. Its route node `top`
 * is on the landing; the course joins it to the pad below, running or (gold) belly sliding.
 */
export function slidePiece(drop: number, rng: Rng): RoundOut {
  const k = kit(pieceSlot('slide'), 1)
  const len = drop / Math.tan(SLIDE_ANGLE)
  k.floor(0, 3, { hx: 4.5 })
  k.walls(0, 3, { hx: 4.5 })
  k.ramp(3, 3 + len, 0, -drop, { hx: 3.5, look: 'slide', slick: true, hy: 0.8 })
  k.walls(3, 3 + len, { hx: 3.5, rise: -drop, h: 0.9 })
  for (const side of [-1, 1]) k.box({ x: side * 4.0, z: 3 - 0.25, hx: 0.5, hz: 0.25, top: 1, hy: 0.8, look: 'rail', noGround: true })
  const hz = 3 + len * 0.55
  k.hoop({ x: rng.between(-1.2, 1.2), z: hz, y: -(hz - 3) * Math.tan(SLIDE_ANGLE) + 1.0 })
  k.deco({ look: 'lip', x: 0, y: -drop, z: 3 + len, sx: 7, sy: 0.4, sz: 0.5 })
  k.node('top', 0, 1.5)
  k.out.camera = 'slide'
  const out = k.out
  out.exit = { x: 0, y: -drop, z: 3 + len }
  return out
}

/**
 * A bounce-up (design-final §4.2), for when the next round must start higher: a teal pad on a short floor throws
 * the bean onto a pad 3 m up. Route: `low` on the floor, `high` on the upper pad.
 */
export function bounceUpPiece(): RoundOut {
  const k = kit(pieceSlot('bounce-up'), 1)
  k.floor(0, 4, { hx: 4.5 })
  const aim = { x: 0, y: 3, z: 8.5 }
  const pad = k.cyl({ r: 1.0, z: 2.2, top: 0.04, hy: 0.3, look: 'bounce', bounce: { vy: 15, perfectVy: 15, aim, perfectAim: aim } })
  k.box({ hx: 4.5, hz: 3, z: 8.5, top: 3, hy: 1.8, look: 'pad' })
  k.walls(5.5, 11.5, { hx: 4.5, y: 3 })
  k.node('low', 0, 0.8)
  k.node('high', 0, 8.5, { y: 3 })
  k.edge('low', 'high', 'bounce', { via: [k.at(0, 0, 2.2, pad)] })
  const out = k.out
  out.exit = { x: 0, y: 3, z: 11.5 }
  return out
}
