/*
 * The course: five holes, the same every round, so a score means the same
 * thing to everyone on the board.
 *
 * A hole is painted. Its ground is a union of shapes — discs, capsules,
 * arcs, polygons — inside a box 100 units wide and as long as the hole
 * needs, and its walls are wherever the ground ends, so a curve is a curve
 * and a fork is two strokes that overlap. y grows downward: tees sit near
 * the bottom, cups near the top, and no cup is within one shot of its tee.
 * Sand drags, water costs a stroke, a bridge is ground over water and a
 * drawbridge is one that is only there part of the time, a hill pushes the
 * ball downhill, a bowl pulls it to its middle, a repeller pushes it away,
 * and a spinning floor carries it round. Windmills turn, sliders sweep
 * across, flaps let the ball through one way only, pads push, ramps launch
 * it over whatever is in the way, pipes take it in one end and out the
 * other, and bumpers and rovers knock it about.
 */

import { arc, capsule, disc, rect, spiral, type Shape, type Vec } from './terrain'

export { arc, capsule, disc, rect, spiral, type Shape, type Vec }

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

/** A windmill: a bar `len` long turning about (x, y) at `speed` radians a second. */
export type Spinner = { x: number; y: number; len: number; speed: number; phase: number }

/** A slider: a bar `t` thick from a to b that slides by (dx, dy) and back, once every `period` seconds. */
export type Slider = { a: Vec; b: Vec; t: number; dx: number; dy: number; period: number; phase?: number }

/** A pipe: a ball that rolls into `a` comes out at `b` heading along `out`. */
export type Portal = { a: Vec; b: Vec; out: number }

/** The cup slides from its spot to `to` and back, once every `period` seconds. */
export type CupPath = { to: Vec; period: number }

/** A drawbridge: ground over the water for the first `down` share of each `period` seconds, gone the rest. */
export type Drawbridge = { shape: Shape; period: number; down: number; phase?: number }

/** A ramp: a ball crossing it along `dir` fast enough takes off and flies `len` units over whatever is there. */
export type Ramp = Rect & { dir: number; len: number }

/**
 * A rover: a loose ball that bounces around its pen at a steady speed, off
 * the pen's edges and anything inside it. Your ball caroms off it, and it
 * caroms off yours.
 */
export type Rover = { x: number; y: number; r: number; speed: number; heading: number; pen: Rect }

/** A mark on the ground: a chevron at (x, y) pointing along `dir`, a hint and nothing more. */
export type Mark = { x: number; y: number; dir: number }

export type Hole = {
  name: string
  par: number
  /** How long the hole is, in field units. */
  h: number
  tee: Vec
  cup: Vec
  cupPath?: CupPath
  /** The ground. Walls are traced along its edge. */
  green: Shape[]
  /** Walls placed by hand, on top of the traced edge: bars, kickers and flaps. */
  walls: Wall[]
  bumpers: Bumper[]
  sand: Shape[]
  water: Shape[]
  /** Ground laid over water. */
  bridges: Shape[]
  drawbridges: Drawbridge[]
  slopes: Slope[]
  boosts: Boost[]
  ramps: Ramp[]
  spinners: Spinner[]
  sliders: Slider[]
  portals: Portal[]
  rovers: Rover[]
  marks: Mark[]
}

export const PORTAL_R = 3.6
/** Half of a windmill blade's thickness. */
export const SPINNER_T = 1.5
/** Half of a traced edge wall's thickness. */
export const EDGE_T = 0.9

export const UP = -Math.PI / 2
export const DOWN = Math.PI / 2
export const LEFT = Math.PI
export const RIGHT = 0

const BAR = 2.2

function bar(x1: number, y1: number, x2: number, y2: number, t = BAR): Wall {
  return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, t }
}

/** A flap across the ground from (x1, y1) to (x2, y2): the ball passes heading along `pass`, and never back. */
function flap(x1: number, y1: number, x2: number, y2: number, pass: number): Wall {
  return { ...bar(x1, y1, x2, y2), pass }
}

function pop(x: number, y: number, r = 5): Bumper {
  return { x, y, r }
}

/** A hill: the ball is pushed along (px, py) — downhill — while on the shape. */
function hill(shape: Shape, px: number, py: number): Slope {
  return { shape, pull: { x: px, y: py } }
}

/** A bowl: the ball is pulled toward the shape's middle this hard. */
function bowl(shape: Shape, strength: number): Slope {
  return { shape, bowl: strength }
}

/** A repeller: the ball is pushed away from the shape's middle this hard. */
function repel(shape: Shape, strength: number): Slope {
  return { shape, repel: strength }
}

/** A spinning floor: the ball is carried round the shape's middle this hard, anticlockwise on screen. */
function spin(shape: Shape, strength: number): Slope {
  return { shape, spin: strength }
}

function mill(x: number, y: number, len: number, speed: number, phase = 0): Spinner {
  return { x, y, len, speed, phase }
}

/** A slider: a bar from (x1, y1) to (x2, y2) that slides by (dx, dy) and back every `period` seconds. */
function slider(x1: number, y1: number, x2: number, y2: number, dx: number, dy: number, period: number): Slider {
  return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, t: BAR, dx, dy, period }
}

function pipe(ax: number, ay: number, bx: number, by: number, out: number): Portal {
  return { a: { x: ax, y: ay }, b: { x: bx, y: by }, out }
}

/** A drawbridge over the water: down for the first `down` share of every `period` seconds. */
function drawbridge(shape: Shape, period: number, down: number): Drawbridge {
  return { shape, period, down }
}

/** A ramp: cross the box along `dir` fast enough and the ball flies `len` units. */
function ramp(x: number, y: number, w: number, h: number, dir: number, len: number): Ramp {
  return { x, y, w, h, dir, len }
}

/** A plain box, for pens, as distinct from painted ground. */
function box(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h }
}

function mark(x: number, y: number, dir: number): Mark {
  return { x, y, dir }
}

function rover(x: number, y: number, r: number, speed: number, heading: number, pen: Rect): Rover {
  return { x, y, r, speed, heading, pen }
}

type Spec = Pick<Hole, 'name' | 'par' | 'h' | 'tee' | 'cup'> &
  Partial<Omit<Hole, 'name' | 'par' | 'h' | 'tee' | 'cup'>>

/** A hole from its parts. Without `green`, the ground is the whole box. */
function hole(spec: Spec): Hole {
  return {
    ...spec,
    green: spec.green ?? [rect(0, 0, FIELD_W, spec.h)],
    walls: spec.walls ?? [],
    bumpers: spec.bumpers ?? [],
    sand: spec.sand ?? [],
    water: spec.water ?? [],
    bridges: spec.bridges ?? [],
    drawbridges: spec.drawbridges ?? [],
    slopes: spec.slopes ?? [],
    boosts: spec.boosts ?? [],
    ramps: spec.ramps ?? [],
    spinners: spec.spinners ?? [],
    sliders: spec.sliders ?? [],
    portals: spec.portals ?? [],
    rovers: spec.rovers ?? [],
    marks: spec.marks ?? [],
  }
}

export const COURSE: Hole[] = [
  /*
   * Orbit. Long, and not the usual mini golf. Up the left leg into a plaza
   * with three bumpers to thread, through an S of two bends with sand
   * inside the first, and up the right leg, where
   * a rover roams the corridor. Then a ring whose floor spins: the leg
   * feeds the outer bank, and the floor carries the ball round like a
   * pinball orbit and presses it to the bank. Off the top of the ring a
   * spur runs up past a windmill to the green; stay on the ring and it
   * carries you round to a pipe at its foot that lifts you onto the green,
   * low on its left. The green is a plaza with a pond in the middle and a
   * narrow bridge straight over it, a bumper either side, and a cup that
   * slides across the line the bridge lands on.
   */
  hole({
    name: 'Orbit',
    par: 6,
    h: 616,
    tee: { x: 26, y: 600 },
    cup: { x: 46, y: 40 },
    cupPath: { to: { x: 66, y: 40 }, period: 6 },
    green: [
      disc(26, 600, 15),
      capsule(26, 600, 26, 520, 13),
      disc(38, 486, 30),
      arc(56, 460, 30, Math.PI, Math.PI * 1.5, 13),
      arc(56, 400, 30, 0, Math.PI / 2, 13),
      capsule(86, 400, 86, 225, 13),
      arc(56, 225, 30, 0, Math.PI * 2, 13),
      capsule(56, 195, 56, 78, 13),
      disc(56, 46, 32),
    ],
    water: [disc(56, 56, 9)],
    bridges: [capsule(56, 68, 56, 44, 4)],
    portals: [pipe(56, 264, 32, 60, UP)],
    spinners: [mill(56, 150, 22, 2.0)],
    slopes: [spin(arc(56, 225, 30, 0, Math.PI * 2, 13), 35)],
    sand: [disc(40, 444, 6), disc(56, 202, 5)],
    bumpers: [pop(22, 480, 4), pop(40, 470, 4), pop(36, 498, 4), pop(44, 68, 4), pop(68, 68, 4)],
    rovers: [rover(86, 320, 2.8, 60, 1.0, box(73, 260, 26, 120))],
    marks: [mark(56, 180, UP)],
  }),
  /*
   * Crater. Out of the tee into a round plaza with a crater in its middle:
   * a bowl that bends any ball crossing it toward the centre and swallows
   * a slow one, which then has to climb back out. Two ways off the plaza.
   * Right is a narrow straight with a windmill across its top, and it comes
   * out beside the cup: short, but the line has to be true and the timing
   * right. Left is a wide, plain corridor that bends round into the far
   * side of the green: long, safe, and a long putt past a bumper to
   * finish. The cup sits on a hilltop either way.
   */
  hole({
    name: 'Crater',
    par: 5,
    h: 332,
    tee: { x: 16, y: 318 },
    cup: { x: 78, y: 66 },
    green: [
      disc(16, 318, 11),
      capsule(16, 318, 28, 280, 7.5),
      disc(50, 250, 36),
      capsule(85, 250, 85, 85, 6),
      capsule(18, 250, 18, 120, 11),
      arc(42, 120, 24, Math.PI, Math.PI * 1.5, 11),
      capsule(42, 96, 50, 96, 11),
      disc(58, 74, 30),
    ],
    slopes: [bowl(disc(50, 250, 24), 100), repel(disc(78, 66, 10), 30)],
    spinners: [mill(85, 118, 12, 2.4)],
    bumpers: [pop(58, 82, 4)],
    marks: [mark(85, 200, UP), mark(18, 200, UP)],
  }),
  /*
   * The Climb. Two hills, each a straight that pushes the ball back down,
   * joined by round elbows to a summit green. At the top of the first hill
   * a spur runs off to the right to a pipe that drops the ball onto the
   * summit — but just past the spur's mouth is a flap that lets a ball
   * through going up and never back. Crest the hill gently and the spur
   * is yours; crest it hard and you are through the flap and committed to
   * the long way: the elbows, the second hill with its bumper, and the
   * summit from the far side.
   */
  hole({
    name: 'The Climb',
    par: 4,
    h: 300,
    tee: { x: 20, y: 282 },
    cup: { x: 30, y: 54 },
    green: [
      disc(20, 284, 14),
      capsule(20, 284, 20, 190, 12),
      capsule(20, 198, 52, 198, 6),
      arc(44, 190, 24, Math.PI, Math.PI * 1.5, 12),
      capsule(44, 166, 56, 166, 12),
      arc(56, 142, 24, 0, Math.PI / 2, 12),
      capsule(80, 142, 80, 70, 12),
      arc(56, 70, 24, -Math.PI / 2, 0, 12),
      disc(40, 44, 20),
    ],
    slopes: [hill(capsule(20, 272, 20, 214, 12), 0, 100), hill(capsule(80, 128, 80, 84, 12), 0, 65)],
    walls: [flap(9, 189, 31, 189, UP)],
    portals: [pipe(50, 198, 40, 62, UP)],
    bumpers: [pop(74, 110, 3)],
    marks: [mark(30, 198, RIGHT)],
  }),
  /*
   * The Lake. A wide green with water across the middle and three ways
   * over. In the middle a drawbridge that is down half the time; on the
   * left a ramp that flies the ball over if it is going fast enough, and
   * drops it in if it is not, and lands it in sand; on the right a dry
   * channel with a bar that slides across it. Three bumpers guard the far
   * shore, and the cup sits off every crossing's line, so each needs an
   * angled approach.
   */
  hole({
    name: 'The Lake',
    par: 3,
    h: 250,
    tee: { x: 50, y: 228 },
    cup: { x: 60, y: 40 },
    green: [capsule(50, 60, 50, 200, 46)],
    water: [rect(4, 90, 72, 60)],
    drawbridges: [drawbridge(capsule(40, 154, 40, 86, 7), 4, 0.6)],
    ramps: [ramp(8, 156, 22, 8, UP, 82)],
    sliders: [slider(76, 120, 88, 120, 8, 0, 2.6)],
    bumpers: [pop(30, 62, 4), pop(50, 66, 4), pop(70, 62, 4)],
    sand: [disc(19, 76, 9)],
    marks: [mark(19, 178, UP), mark(40, 178, UP), mark(86, 164, UP)],
  }),
  /*
   * Figure Eight. Two rings, one on top of the other, sharing a waist. Up
   * the stem into the lower ring and round either side, through the waist
   * — where a bar slides across, closing one side and then the other — and
   * round the upper ring to a green at the top, with a second bar across
   * its neck. A bumper on the outside of each ring and sand on the inside
   * keep the line honest.
   */
  hole({
    name: 'Figure Eight',
    par: 4,
    h: 308,
    tee: { x: 50, y: 290 },
    cup: { x: 50, y: 100 },
    green: [
      disc(50, 292, 14),
      capsule(50, 292, 50, 246, 12),
      arc(50, 200, 30, 0, Math.PI * 2, 12),
      arc(50, 140, 30, 0, Math.PI * 2, 12),
      disc(50, 102, 14),
    ],
    sliders: [slider(25, 170, 55, 170, 20, 0, 3.0), slider(36, 110, 52, 110, 12, 0, 2.2)],
    bumpers: [pop(84, 200, 4), pop(16, 140, 4)],
    sand: [disc(70, 140, 5), disc(30, 200, 5)],
    marks: [mark(50, 176, UP)],
  }),
]

export const COURSE_PAR = COURSE.reduce((sum, h) => sum + h.par, 0)
