/*
 * The course, the same every round, so a score means the same thing to
 * everyone on the board. For now it is one hole, while its look and its
 * length are settled; the rest are built to match it.
 *
 * A hole is a place, not a diagram: a long green laid through a garden,
 * several parts to it, each with something of its own to get past or a way
 * to choose, so a good round is five or six strokes a hole.
 *
 * A hole is painted. Its ground is a soft union of shapes — discs, ribbons
 * through a line of points, capsules, arcs — inside a box 100 units wide and
 * as long as the hole needs, blended where they meet so the green reads as
 * one piece, and its rails are wherever the ground ends. y grows downward:
 * the tee sits near the bottom, the cup near the top, and no cup is within
 * one shot of its tee. Sand drags, water costs a stroke, a bridge is ground
 * over water, a hill pushes the ball downhill, a bowl pulls it to its middle,
 * a repeller pushes it away and a spinning floor carries it round. A
 * windmill's tower has a tunnel through it and its sails shut the doors;
 * windmills without towers turn as bare blades, sliders sweep across, flaps
 * let the ball through one way only, kickers throw it back harder, pads
 * push, ramps launch it over whatever is in the way, pipes take it in one
 * end and out the other, rocks stand where they are, and bumpers and rovers
 * knock it about.
 */

import { arc, capsule, disc, rect, ribbon, spiral, type Shape, type Vec } from './terrain'

export { arc, capsule, disc, rect, ribbon, spiral, type Shape, type Vec }

export const FIELD_W = 100

export type Wall = {
  a: Vec
  b: Vec
  /** Half of the wall's thickness. */
  t: number
  /** A kicker: the ball comes off it faster than it arrived. */
  kick?: boolean
  /** Traced from the edge of the ground, not placed by hand. */
  edge?: boolean
  /** A flap: the ball goes through when it is heading this way (radians), and it is a wall from the other side. */
  pass?: number
  /** Part of something drawn in its own right, a windmill's tower, so not drawn as a bar. */
  hidden?: boolean
}

export type Bumper = { x: number; y: number; r: number }

export type Rect = { x: number; y: number; w: number; h: number }

/** A pad that pushes the ball along `dir` (radians) while it is on it. */
export type Boost = Rect & { dir: number }

/**
 * A slope: ground that pushes the ball along `pull` each second; a bowl that
 * pulls it to the middle; a repeller that pushes it away from the middle; or
 * a floor that spins, carrying the ball round its middle — positive is
 * anticlockwise on screen, up the right side and down the left — and
 * pressing it outward to the bank.
 */
export type Slope = { shape: Shape; pull?: Vec; bowl?: number; repel?: number; spin?: number }

/** A bare windmill blade: a bar `len` long turning about (x, y) at `speed` radians a second. */
export type Spinner = { x: number; y: number; len: number; speed: number; phase: number }

/**
 * A windmill: a round tower `r` across the middle, standing in the fairway,
 * with a tunnel `door` wide either side of its middle running along `dir`,
 * and `sails` sails reaching `reach` from the hub, turning at `speed`
 * radians a second. The sails sweep down past both doors of the tunnel, and
 * a door is shut while a sail is across it: a ball that gets there then
 * comes back.
 */
export type Mill = {
  x: number
  y: number
  r: number
  door: number
  dir: number
  sails: number
  reach: number
  speed: number
  phase: number
}

/** A slider: a bar `t` thick from a to b that slides by (dx, dy) and back, once every `period` seconds. */
export type Slider = { a: Vec; b: Vec; t: number; dx: number; dy: number; period: number; phase?: number }

/** A pipe: a ball that rolls into `a` comes out at `b` heading along `out`. */
export type Portal = { a: Vec; b: Vec; out: number }

/** The cup slides from its spot to `to` and back, once every `period` seconds. */
export type CupPath = { to: Vec; period: number }

/** A drawbridge: ground over the water for the first `down` share of each `period` seconds, gone the rest. */
export type Drawbridge = { shape: Shape; period: number; down: number; phase?: number }

/**
 * A ramp: a ball crossing it along `dir` at least `min` fast (or the usual
 * take-off speed) takes off and flies `len` units over whatever is there.
 */
export type Ramp = Rect & { dir: number; len: number; min?: number }

/**
 * A rover: a loose ball that bounces around its pen at a steady speed, off
 * the pen's edges and anything inside it. Your ball caroms off it, and it
 * caroms off yours.
 */
export type Rover = { x: number; y: number; r: number; speed: number; heading: number; pen: Rect }

/** A mark on the ground: a chevron at (x, y) pointing along `dir`, a hint and nothing more. */
export type Mark = { x: number; y: number; dir: number }

/** What grows or stands around the green: set by hand where it matters, and the rest scattered. */
export type Decor = { kind: 'tree' | 'blossom' | 'pine' | 'bush' | 'flowers' | 'stone' | 'lily' | 'reeds'; x: number; y: number; r: number }

export type Hole = {
  name: string
  par: number
  /** How long the hole is, in field units. */
  h: number
  tee: Vec
  cup: Vec
  cupPath?: CupPath
  /** The ground. Rails are traced along its edge. */
  green: Shape[]
  /** How far apart two pieces of ground can be and still be blended into one where they meet. */
  blend: number
  /** Walls placed by hand, on top of the traced edge: bars, kickers and flaps. */
  walls: Wall[]
  bumpers: Bumper[]
  /** Boulders on the green: they stop the ball like a wall and do not give. */
  rocks: Bumper[]
  sand: Shape[]
  water: Shape[]
  /** Ground laid over water. */
  bridges: Shape[]
  drawbridges: Drawbridge[]
  slopes: Slope[]
  boosts: Boost[]
  ramps: Ramp[]
  spinners: Spinner[]
  mills: Mill[]
  sliders: Slider[]
  portals: Portal[]
  rovers: Rover[]
  marks: Mark[]
  /** Scenery placed by hand; more is scattered round it. */
  decor: Decor[]
}

export const PORTAL_R = 3.6
/** Half of a windmill blade's thickness. */
export const SPINNER_T = 1.5
/** Half of a windmill sail's width: a door is shut while one is across it. */
export const SAIL_T = 1.6
/** Half of a traced edge wall's thickness. */
export const EDGE_T = 0.9

export const UP = -Math.PI / 2
export const DOWN = Math.PI / 2
export const LEFT = Math.PI
export const RIGHT = 0

/** A windmill standing at (x, y) with its tunnel running along `dir`. */
function mill(x: number, y: number, r: number, dir: number, speed: number, phase = 0): Mill {
  return { x, y, r, door: 3.6, dir, sails: 4, reach: r + 8, speed, phase }
}

/** A ramp: cross the box along `dir` at least `min` fast and the ball flies `len` units. */
function ramp(x: number, y: number, w: number, h: number, dir: number, len: number, min?: number): Ramp {
  return { x, y, w, h, dir, len, min }
}

/** A hill: the ball is pushed along (px, py) — downhill — while on the shape. */
function hill(shape: Shape, px: number, py: number): Slope {
  return { shape, pull: { x: px, y: py } }
}

function decor(kind: Decor['kind'], x: number, y: number, r: number): Decor {
  return { kind, x, y, r }
}

type Spec = Pick<Hole, 'name' | 'par' | 'h' | 'tee' | 'cup'> &
  Partial<Omit<Hole, 'name' | 'par' | 'h' | 'tee' | 'cup'>>

/** A hole from its parts. Without `green`, the ground is the whole box. */
function hole(spec: Spec): Hole {
  return {
    ...spec,
    green: spec.green ?? [rect(0, 0, FIELD_W, spec.h)],
    blend: spec.blend ?? 0,
    walls: spec.walls ?? [],
    bumpers: spec.bumpers ?? [],
    rocks: spec.rocks ?? [],
    sand: spec.sand ?? [],
    water: spec.water ?? [],
    bridges: spec.bridges ?? [],
    drawbridges: spec.drawbridges ?? [],
    slopes: spec.slopes ?? [],
    boosts: spec.boosts ?? [],
    ramps: spec.ramps ?? [],
    spinners: spec.spinners ?? [],
    mills: spec.mills ?? [],
    sliders: spec.sliders ?? [],
    portals: spec.portals ?? [],
    rovers: spec.rovers ?? [],
    marks: spec.marks ?? [],
    decor: spec.decor ?? [],
  }
}

export const COURSE: Hole[] = [
  /*
   * Mill Creek. Off the tee straight at a windmill standing across the
   * fairway: the only way on is the tunnel under it, and a sail across a
   * door shuts it, so the run through is timed. Out the far side the
   * fairway bends into a meadow, sand in its middle and a creek along its
   * top. Two ways over. On the right a footbridge, narrow and railed, into
   * the long way round: up the right side and over the top of a horseshoe
   * of green that circles a garden. On the left a ramp at the water's edge:
   * hit it hard and straight and the ball flies the creek and the garden's
   * foot and lands on the horseshoe's other leg, most of the long way saved;
   * hit it soft or crooked and the creek has it. From the top of the
   * horseshoe a neck winds up past two boulders to a two-tier green: the
   * cup is on the upper tier, behind a ridge that sends a timid putt back
   * down, with sand either side.
   */
  hole({
    name: 'Mill Creek',
    par: 7,
    h: 900,
    tee: { x: 50, y: 862 },
    cup: { x: 58, y: 74 },
    blend: 9,
    green: [
      disc(50, 858, 15),
      ribbon(16, [50, 858], [50, 800], [50, 730], [48, 700]),
      ribbon(17, [48, 704], [42, 664], [36, 626], [34, 596]),
      // The meadow, and a pocket up its left side to the ramp.
      ribbon(22, [28, 566], [50, 556], [74, 542]),
      ribbon(10, [24, 566], [24, 528]),
      // The meadow runs on under the creek, so a ball that is not stopped there goes in.
      ribbon(12, [12, 532], [48, 520], [86, 506]),
      // The footbridge.
      capsule(72, 528, 72, 474, 4.6),
      // The horseshoe: its right leg, its crown, and its left leg down to where the ramp lands.
      ribbon(12.5, [72, 478], [78, 420], [78, 360]),
      arc(50, 360, 28, Math.PI, Math.PI * 2, 12.5),
      ribbon(12.5, [22, 360], [22, 424]),
      // The neck, an S up to the green.
      ribbon(12, [50, 336], [46, 304], [37, 270], [37, 236], [50, 206], [60, 176], [56, 148], [52, 130]),
      disc(50, 96, 38),
    ],
    water: [ribbon(7.5, [-12, 526], [16, 522], [48, 511], [80, 498], [112, 492])],
    bridges: [capsule(72, 528, 72, 474, 4.6)],
    mills: [mill(50, 752, 19, UP, 0.8)],
    ramps: [ramp(19, 532, 10, 12, UP, 128, 105)],
    rocks: [
      { x: 44, y: 252, r: 4.2 },
      { x: 55, y: 190, r: 3.6 },
    ],
    sand: [
      ribbon(5, [44, 576], [53, 571], [60, 563]),
      ribbon(4.5, [83, 424], [84, 398]),
      ribbon(4.5, [21, 96], [23, 83], [29, 72]),
      ribbon(4.5, [69, 125], [77, 121], [83, 113]),
    ],
    slopes: [hill(ribbon(7, [12, 110], [50, 104], [88, 110]), 0, 70)],
    decor: [
      decor('blossom', 50, 402, 8.5),
      decor('bush', 43, 440, 3),
      decor('flowers', 57, 436, 3),
      decor('flowers', 44, 372, 2.6),
      decor('stone', 58, 376, 1.8),
    ],
  }),
]

export const COURSE_PAR = COURSE.reduce((sum, h) => sum + h.par, 0)
