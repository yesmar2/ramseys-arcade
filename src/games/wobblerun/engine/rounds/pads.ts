/**
 * The pieces between rounds (design-final §4.2): the start pad with its barrier and the start slide out of the
 * gate, the checkpoint pads (a split at each one's flag line), the slide down after a round that ends high, and
 * the bounce-up onto a higher pad. Each is laid in its own frame, as a round is (z from its start, y from the
 * height it starts at), and the course puts it in place.
 *
 * Each takes the course's generation (types.ts Gen, 1 if left out), carried in its kit (`k.gen`) as a round's is:
 * a piece that changes with a later generation gates the change on it and lays gen 1 exactly as it always has.
 *
 * Gen 2's ups and downs (course.ts lays them between rounds, a gauntlet climbing toward its finale with a big way
 * down in the middle) are pieces of their own, below the gen-1 ones: the ramp, the stairs, gen 2's slide down, the
 * drop, the twin lifts, and gen 2's bounce-up with a lead and a height of its own. None of them can be fallen off or
 * missed: walls the whole way, no gap anywhere, and at worst a wait. Each has its own splat height under its lower
 * end, so the course's 6 m under a piece's start never sits above a floor it lays.
 */
import { DEATH_DROP, sinkAt } from '../sim.ts'
import type { Gen, MoveFn, Rng, RoundOut, RoundSlot, TeleFn } from '../types.ts'
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

const pieceSlot = (letter: string, gen: Gen): RoundSlot => ({ i: -1, count: 0, letter, tier: 1, period: 3.4, finale: false, seed: letter, gen })

/**
 * The start: a 12 × 10 m pad 4 m up, the bean on it at z 4 behind a jelly barrier at z 10 that sinks into the pad
 * at GO, then the start slide (slick, 14°, a boost hoop on it) down to the course's base and a 2 m run-out into
 * the first round. Its route: `start` (where the bean waits) and `top` (the top of the slide); the course joins
 * `top` to the first round's `in`, running down or (a gold move) belly sliding.
 */
export function startPiece(rng: Rng, gen: Gen = 1): RoundOut {
  const k = kit(pieceSlot('start', gen), 1)
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
export function checkPiece(index: number, gen: Gen = 1): RoundOut {
  const k = kit(pieceSlot('check', gen), 1)
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
export function slidePiece(drop: number, rng: Rng, gen: Gen = 1): RoundOut {
  const k = kit(pieceSlot('slide', gen), 1)
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
export function bounceUpPiece(gen: Gen = 1): RoundOut {
  const k = kit(pieceSlot('bounce-up', gen), 1)
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

/* ---------------------------------------------------------- gen 2: ups and downs --- */

/**
 * The flat every gen-2 connector starts with: a round's `out` node stands 1.5 m into whatever comes after the round,
 * and a bot stops there, so it must be level floor. A climb ends with a short landing, the checkpoint pad after it
 * being 6 m more of the same height (and the next round's pad before).
 */
export const CONNECT_LEAD = 2
const CONNECT_LAND = 0.6

/** A stair's step at most, going up (within the bean's 0.5 m step-up) and coming down (within the 0.3 m it keeps to the floor by, so it runs down them, never hopping). */
export const STAIR_UP = 0.42
export const STAIR_DOWN = 0.3

const deg = (d: number) => (d * Math.PI) / 180

/**
 * A ramp (gen 2): a TILT floor up `rise` m (or down, rise < 0) at 14–16°, so 6–12 m long for the 1.6–3.4 m it's
 * laid for, between a 2 m lead and a short landing, walled the whole way. White lines at its foot and its brow say
 * where the slope starts and ends. A long one going up (8 m or more) has a boost hoop off to one side half way up,
 * for the bold: out of the way up the middle, so the main way runs straight past it and the gold one goes through.
 * Route: `a` on the lead (where the round's `out` stands) and `b` on the brow, both passed through.
 */
export function rampPiece(rise: number, rng: Rng, gen: Gen = 2): RoundOut {
  const k = kit(pieceSlot('ramp', gen), 1)
  const angle = deg(rng.between(14, 16))
  const len = Math.abs(rise) / Math.tan(angle)
  const z1 = CONNECT_LEAD + len
  const end = z1 + CONNECT_LAND
  k.floor(0, CONNECT_LEAD, { hx: 4.5 })
  k.ramp(CONNECT_LEAD, z1, 0, rise, { hx: 4.5, hy: 0.8 })
  k.floor(z1, end, { hx: 4.5, top: rise, look: 'pad' })
  k.walls(0, CONNECT_LEAD)
  k.walls(CONNECT_LEAD, z1, { rise })
  k.walls(z1, end, { y: rise })
  k.deco({ look: 'stripe', x: 0, y: 0, z: CONNECT_LEAD - 0.2, sx: 9, sy: 0.02, sz: 0.25 })
  k.deco({ look: 'stripe', x: 0, y: rise, z: z1 + 0.2, sx: 9, sy: 0.02, sz: 0.25 })
  k.death(z1, end, rise - DEATH_DROP)
  k.node('a', 0, 1.5, { wait: 'no' })
  k.node('b', 0, z1 + 0.3, { y: rise, wait: 'no' })
  k.edge('a', 'b')
  if (rise > 0 && len >= 8) {
    const hx = rng.sign() * 2.4
    const hz = CONNECT_LEAD + len * 0.45
    const hy = (hz - CONNECT_LEAD) * Math.tan(angle)
    k.hoop({ x: hx, z: hz, y: hy + 1.0 })
    k.edge('a', 'b', 'run', { tier: 'gold', via: [k.at(hx, hy, hz)] })
  }
  const out = k.out
  out.exit = { x: 0, y: rise, z: end }
  return out
}

/**
 * Stairs (gen 2): up `rise` m in steps of at most STAIR_UP (or down, rise < 0, in steps of at most STAIR_DOWN), each
 * 0.8–1.0 m deep, between a 2 m lead and a short landing, walled the whole way. Every step reaches down below the
 * lowest floor, so there's nothing to fall into under one. Like the ramp, a bot just runs up them.
 */
export function stairsPiece(rise: number, rng: Rng, gen: Gen = 2): RoundOut {
  const k = kit(pieceSlot('stairs', gen), 1)
  const most = rise > 0 ? STAIR_UP : STAIR_DOWN
  const n = Math.max(1, Math.ceil(Math.abs(rise) / most - 1e-9))
  const h = rise / n
  const tread = rng.between(0.8, 1.0)
  const bottom = Math.min(0, rise) - 0.6
  k.floor(0, CONNECT_LEAD, { hx: 4.5 })
  // Steps 1 … n − 1; the landing is the last.
  for (let j = 1; j < n; j++) {
    const top = j * h
    k.box({ x: 0, z: CONNECT_LEAD + (j - 0.5) * tread, hx: 4.5, hz: tread / 2, top, hy: (top - bottom) / 2 })
  }
  const z1 = CONNECT_LEAD + (n - 1) * tread
  const end = z1 + Math.max(CONNECT_LAND, tread)
  k.box({ x: 0, z: (z1 + end) / 2, hx: 4.5, hz: (end - z1) / 2, top: rise, hy: (rise - bottom) / 2, look: 'pad' })
  k.walls(0, CONNECT_LEAD)
  if (z1 > CONNECT_LEAD) k.walls(CONNECT_LEAD, z1, { rise: rise - h, h: 1.3 })
  k.walls(z1, end, { y: rise })
  k.death(z1, end, rise - DEATH_DROP)
  const out = k.out
  out.exit = { x: 0, y: rise, z: end }
  return out
}

/**
 * Gen 2's bounce-up: gen 1's teal pad (vy 15, aimed), throwing the bean `rise` m (2.5–3.5) up onto a 3.5 m pad, after
 * a 2 m lead (so a round's `out` node stands on floor, not on the pad). Floor runs on up to the upper pad's face
 * (gen 1's leaves a gap there to splat in, past the pad): walk past the pad and you meet a wall, nothing worse. Route:
 * `low` and `high`, both passed through (a bot doesn't stop either side of a throw it can't miss).
 */
export function bouncePiece(rise: number, gen: Gen = 2): RoundOut {
  const k = kit(pieceSlot('bounce-up', gen), 1)
  const lead = CONNECT_LEAD
  const face = lead + 3.8
  const end = face + 3.5
  k.floor(0, face, { hx: 4.5 })
  const aim = { x: 0, y: rise, z: face + 1.9 }
  const pad = k.cyl({ r: 1.0, z: lead + 1.4, top: 0.04, hy: 0.3, look: 'bounce', bounce: { vy: 15, perfectVy: 15, aim, perfectAim: aim } })
  k.box({ hx: 4.5, hz: (end - face) / 2, z: (face + end) / 2, top: rise, hy: (rise + 0.6) / 2, look: 'pad' })
  k.walls(0, face)
  k.walls(face, end, { y: rise })
  k.node('low', 0, lead - 0.3, { wait: 'no' })
  k.node('high', 0, aim.z, { y: rise, wait: 'no' })
  k.edge('low', 'high', 'bounce', { via: [k.at(0, 0, lead + 1.4, pad)] })
  k.death(face, end, rise - DEATH_DROP)
  const out = k.out
  out.exit = { x: 0, y: rise, z: end }
  return out
}

/**
 * Gen 2's slide down (design-final §C): gen 1's slick chute, steeper the further it drops (15° to 18°: a 6 m drop is
 * 18.5 m of slide, not 24), with a hoop on it, or two on a long one. A 2 m landing at the top, then straight onto the
 * pad below, as gen 1's. Route: `top` on the landing, passed through (a bot stopped at the round's `out`, on the same
 * spot); the course joins it to the pad below, running or (gold) belly sliding.
 */
export function slideDownPiece(drop: number, rng: Rng, gen: Gen = 2): RoundOut {
  const k = kit(pieceSlot('slide', gen), 1)
  const top = CONNECT_LEAD
  const angle = deg(Math.min(18, Math.max(15, 15 + (drop - 3) * 1.2 + rng.between(-0.5, 0.5))))
  const len = drop / Math.tan(angle)
  const slope = Math.tan(angle)
  k.floor(0, top, { hx: 4.5 })
  k.walls(0, top, { hx: 4.5 })
  k.ramp(top, top + len, 0, -drop, { hx: 3.5, look: 'slide', slick: true, hy: 0.8 })
  k.walls(top, top + len, { hx: 3.5, rise: -drop, h: 0.9 })
  for (const side of [-1, 1]) k.box({ x: side * 4.0, z: top - 0.25, hx: 0.5, hz: 0.25, top: 1, hy: 0.8, look: 'rail', noGround: true })
  const hoops = len > 15 ? [0.35, 0.72] : [0.55]
  for (const f of hoops) {
    const hz = top + len * f
    k.hoop({ x: rng.between(-1.2, 1.2), z: hz, y: -(hz - top) * slope + 1.0 })
  }
  k.deco({ look: 'stripe', x: 0, y: 0, z: top - 0.2, sx: 7, sy: 0.02, sz: 0.25 })
  // Its own splat height, 6 m under its foot: the piece's own (6 m under its top) would be above the foot of a drop
  // of 6 m (the gen-1 slide's trouble after a round ending that high, gen-2 requests #1).
  k.death(top, top + len, -drop - DEATH_DROP)
  k.node('top', 0, 1.5, { wait: 'no' })
  k.camera('slide')
  const out = k.out
  out.exit = { x: 0, y: -drop, z: top + len }
  return out
}

/**
 * A drop (gen 2): a 2.5 m deck ending in a cliff, and a wide pad `drop` m (1.5–3) below it, 5 m long before the
 * checkpoint pad's 6 more at the same height: a run off the edge lands 2–3 m out, a jump off it 6–7 m, a dive about 6.
 * The deck is a block down to the pad (a face, not an overhang), with a white line at its edge; the pad below is the
 * full 9 m and walled, so whatever you do off the edge you come down on it, and from the deck you see its far end and
 * the checkpoint's flags beyond (the camera can't see over the edge to its foot). No route of its own.
 */
export function dropPiece(drop: number, gen: Gen = 2): RoundOut {
  const k = kit(pieceSlot('drop', gen), 1)
  const deck = 2.5
  const end = deck + 5
  k.box({ x: 0, z: deck / 2, hx: 4.5, hz: deck / 2, top: 0, hy: (drop + 0.6) / 2 })
  k.floor(deck, end, { hx: 4.5, top: -drop, look: 'pad' })
  k.walls(0, deck)
  k.walls(deck, end, { y: -drop })
  k.deco({ look: 'stripe', x: 0, y: 0, z: deck - 0.25, sx: 9, sy: 0.02, sz: 0.3 })
  k.death(deck, end, -drop - DEATH_DROP)
  const out = k.out
  out.exit = { x: 0, y: -drop, z: end }
  return out
}

/**
 * A lift's motion (closed form, the clock's): it waits `low` s at the bottom, rises over `up` s, waits `high` s at
 * the top and comes down over `down` s, from phase `ph`; eased at both ends of each move, so it starts and stops
 * gently and never throws what's on it. Arithmetic only, so it's the same in every browser.
 */
export type LiftSpec = { low: number; up: number; high: number; down: number; ph: number }

/** How far up a lift is at t, 0 (the bottom) to 1 (the top). */
export function liftAt(l: LiftSpec, t: number): number {
  const T = l.low + l.up + l.high + l.down
  let u = (((t + l.ph) % T) + T) % T
  const ease = (x: number) => x * x * (3 - 2 * x)
  if (u < l.low) return 0
  u -= l.low
  if (u < l.up) return ease(u / l.up)
  u -= l.up
  if (u < l.high) return 1
  u -= l.high
  return 1 - ease(u / l.down)
}

export function liftMove(l: LiftSpec, rise: number): MoveFn {
  return (t, o) => void (o.y = rise * liftAt(l, t))
}

/** A lift's warning before it moves off, at the bottom or the top, s. */
const LIFT_WARN = 0.6

/**
 * A lift's telegraph: `warn` for LIFT_WARN before it sets off up or down (the scene blinks its poles' lamps amber),
 * `act` going up, `hold` at the top, `back` coming down, `rest` at the bottom.
 */
export function liftTele(l: LiftSpec): TeleFn {
  const T = l.low + l.up + l.high + l.down
  return (t) => {
    let u = (((t + l.ph) % T) + T) % T
    if (u < l.low) return u >= l.low - LIFT_WARN ? { state: 'warn', u: (u - l.low + LIFT_WARN) / LIFT_WARN } : { state: 'rest', u: u / l.low }
    u -= l.low
    if (u < l.up) return { state: 'act', u: u / l.up }
    u -= l.up
    if (u < l.high) return u >= l.high - LIFT_WARN ? { state: 'warn', u: (u - l.high + LIFT_WARN) / LIFT_WARN } : { state: 'hold', u: u / l.high }
    return { state: 'back', u: (u - l.high) / l.down }
  }
}

/**
 * Twin lifts (gen 2): a 2.5 m lead, then two platforms side by side, each 4.25 m wide and 3.4 m deep with a tall rail
 * between them, rising `rise` m (2.8–3.5) and coming down again on the clock half a turn apart, so while one is up
 * the other is down or on its way: a short wait at most, whichever you take. Then a landing at the top. Each platform
 * is a column whose body always reaches below the floor, so there's never anything under one to fall into: while it's
 * up it's a wall. Each waits 1 s at the bottom and 1.2 s at the top, round again every 5.6 s, and moves at 2.9 m/s at
 * most (its ledge is off, as anything that quick has it). Tall rails up the shaft keep you on it. They're drawn as
 * Candy Lifts' lifts (look `lift`: candy stripes, up-and-down chevrons, guide poles whose lamps blink amber in the
 * 0.6 s before one moves off).
 *
 * Route: `low` on the lead, where the round's `out` stands (passed through: a bot waits at `out`), `left` and
 * `right` on the platforms (riding them: a bot waits there for the top), and `top` on the landing. Stepping on is
 * the main way, and a jump onto one while it's still low the gold one; at the top you step off, or (gold) jump off a
 * little early.
 */
export function liftPiece(rise: number, rng: Rng, gen: Gen = 2): RoundOut {
  const k = kit(pieceSlot('lift', gen), 1)
  const shaft0 = CONNECT_LEAD + 0.5
  const shaft1 = shaft0 + 3.4
  const end = shaft1 + 1.5
  const T = 1.0 + 1.8 + 1.2 + 1.6
  const ph = rng.between(0, T)
  const mid = (shaft0 + shaft1) / 2
  k.floor(0, shaft0, { hx: 4.5 })
  k.box({ x: 0, z: (shaft1 + end) / 2, hx: 4.5, hz: (end - shaft1) / 2, top: rise, hy: (rise + 1.2) / 2, look: 'pad' })
  k.walls(0, shaft0)
  k.walls(shaft0, shaft1, { h: rise + 1 })
  k.walls(shaft1, end, { y: rise })
  // The rail between the two shafts.
  k.box({ x: 0, z: mid, hx: 0.25, hz: (shaft1 - shaft0) / 2, top: rise + 1, hy: (rise + 1.6) / 2, look: 'rail', noGround: true })
  k.node('low', 0, 1.5, { wait: 'no' })
  k.node('top', 0, shaft1 + 1.0, { y: rise, wait: 'no' })
  for (const [side, id, half] of [
    [-1, 'left', 0],
    [1, 'right', 0.5],
  ] as const) {
    const spec: LiftSpec = { low: 1.0, up: 1.8, high: 1.2, down: 1.6, ph: ph + half * T }
    const x = side * 2.375
    const lift = k.box({
      x,
      z: mid,
      hx: 2.125,
      hz: (shaft1 - shaft0) / 2,
      top: 0,
      hy: (rise + 1.2) / 2,
      look: 'lift',
      role: 'floor',
      ledge: false,
      move: liftMove(spec, rise),
      tele: liftTele(spec),
    })
    k.node(id, x, mid, { on: lift })
    k.edge('low', id)
    // A take-off spot rather than 'edge': a bean already past it presses at once (bots.ts drive, the Wall Rush
    // engineer's note in the gen-2 requests).
    k.edge('low', id, 'jump', { tier: 'gold', takeoff: k.at(x * 0.6, 0, shaft0 - 0.45) })
    k.edge(id, 'top')
    k.edge(id, 'top', 'jump', { tier: 'gold' })
  }
  k.death(shaft1, end, rise - DEATH_DROP)
  k.camera('climb')
  const out = k.out
  out.exit = { x: 0, y: rise, z: end }
  return out
}
