/*
 * The course: five holes, the same every round, so a score means the same
 * thing to everyone on the board. Every hole is a journey of several parts,
 * each with something of its own to get past or a way to choose, so a good
 * round is five or six strokes a hole and par sits around seven.
 *
 * A hole is painted. Its ground is a union of shapes — discs, capsules,
 * arcs, spirals, polygons — inside a box 100 units wide and as long as the
 * hole needs, and its walls are wherever the ground ends, so a curve is a
 * curve and a fork is two strokes that overlap. y grows downward: tees sit
 * near the bottom, cups near the top, and no cup is within one shot of its
 * tee. Sand drags, water costs a stroke, a bridge is ground over water and
 * a drawbridge is one that is only there part of the time, a hill pushes
 * the ball downhill, a bowl pulls it to its middle, a repeller pushes it
 * away, and a spinning floor carries it round. Windmills turn, sliders
 * sweep across, flaps let the ball through one way only, kickers throw it
 * back harder, pads push, ramps launch it over whatever is in the way,
 * pipes take it in one end and out the other, and bumpers and rovers knock
 * it about.
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

/** A kicker: a bar the ball comes off faster than it arrived. */
function kicker(x1: number, y1: number, x2: number, y2: number): Wall {
  return { ...bar(x1, y1, x2, y2), kick: true }
}

/** A flap across the ground from (x1, y1) to (x2, y2): the ball passes heading along `pass`, and never back. */
function flap(x1: number, y1: number, x2: number, y2: number, pass: number): Wall {
  return { ...bar(x1, y1, x2, y2), pass }
}

function pop(x: number, y: number, r = 5): Bumper {
  return { x, y, r }
}

/** A pad that pushes the ball along `dir` while it is on it. */
function pad(x: number, y: number, w: number, h: number, dir: number): Boost {
  return { x, y, w, h, dir }
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
   * Orbit. Up the left leg into a plaza with three bumpers to thread,
   * through an S of two bends with sand inside the first, and up the right
   * leg: first between two kickers angled in from the walls, a slingshot
   * that throws a ball off line back across the corridor, then past a
   * rover roaming its pen. Then a ring whose floor spins: the leg feeds the
   * outer bank, and the floor carries the ball round like a pinball orbit
   * and presses it to the bank. Off the top of the ring a spur runs up past
   * a windmill to the green; stay on the ring and it carries you round to a
   * pipe at its foot that lifts you onto the green, low on its left. The
   * green is a plaza with a pond in the middle and a narrow bridge straight
   * over it, a bumper either side, and a cup that slides across the line
   * the bridge lands on.
   */
  hole({
    name: 'Orbit',
    par: 7,
    h: 716,
    tee: { x: 26, y: 700 },
    cup: { x: 46, y: 40 },
    cupPath: { to: { x: 66, y: 40 }, period: 6 },
    green: [
      disc(26, 700, 15),
      capsule(26, 700, 26, 620, 13),
      disc(38, 586, 30),
      arc(56, 560, 30, Math.PI, Math.PI * 1.5, 13),
      arc(56, 500, 30, 0, Math.PI / 2, 13),
      capsule(86, 500, 86, 225, 13),
      arc(56, 225, 30, 0, Math.PI * 2, 13),
      capsule(56, 195, 56, 78, 13),
      disc(56, 46, 32),
    ],
    water: [disc(56, 56, 9)],
    bridges: [capsule(56, 68, 56, 44, 4)],
    portals: [pipe(56, 264, 32, 60, UP)],
    spinners: [mill(56, 150, 22, 2.0)],
    slopes: [spin(arc(56, 225, 30, 0, Math.PI * 2, 13), 35)],
    walls: [kicker(73, 482, 80, 462), kicker(99, 482, 92, 462)],
    sand: [disc(40, 544, 6), disc(56, 202, 5)],
    bumpers: [pop(22, 580, 4), pop(40, 570, 4), pop(36, 598, 4), pop(44, 68, 4), pop(68, 68, 4)],
    rovers: [rover(86, 320, 2.8, 60, 1.0, box(73, 260, 26, 120))],
    marks: [mark(56, 180, UP)],
  }),
  /*
   * Crater. Out of the tee into a pocket of three bumpers, then the ground
   * splits round an island: the left lane has sand across it, the right
   * lane two bumpers. Both open onto a round plaza with a crater in its
   * middle, a bowl that bends any ball crossing it toward the centre and
   * swallows a slow one, which then has to climb back out. Two ways off
   * the plaza. Right is a narrow straight with a pothole halfway and a
   * windmill across its top, and it comes out beside the cup: short, but
   * the line has to be true and the timing right. Left is a wide, plain
   * corridor that bends round into the far side of the green: long, safe,
   * and a long putt past a bumper to finish. The cup sits on a hilltop
   * either way.
   */
  hole({
    name: 'Crater',
    par: 7,
    h: 562,
    tee: { x: 50, y: 546 },
    cup: { x: 78, y: 66 },
    green: [
      disc(50, 548, 12),
      capsule(50, 548, 50, 500, 10),
      disc(50, 470, 30),
      capsule(50, 405, 50, 430, 22),
      capsule(38, 300, 38, 405, 8),
      capsule(62, 300, 62, 405, 8),
      capsule(50, 280, 50, 300, 22),
      disc(50, 250, 36),
      capsule(85, 250, 85, 85, 6),
      capsule(18, 250, 18, 120, 11),
      arc(42, 120, 24, Math.PI, Math.PI * 1.5, 11),
      capsule(42, 96, 50, 96, 11),
      disc(58, 74, 30),
    ],
    slopes: [bowl(disc(50, 250, 24), 100), bowl(disc(85, 170, 5), 80), repel(disc(78, 66, 10), 30)],
    spinners: [mill(85, 118, 12, 2.4)],
    bumpers: [pop(38, 462, 4), pop(62, 462, 4), pop(50, 484, 4), pop(62, 340, 3), pop(62, 375, 3), pop(58, 82, 4)],
    sand: [disc(38, 352, 6)],
    marks: [mark(85, 200, UP), mark(18, 200, UP)],
  }),
  /*
   * The Climb. Three hills, each a straight that pushes the ball back
   * down. The approach first: a pad tight against the left wall that throws
   * the ball up the first hill for free if you hug the wall over it, sand
   * on the right if you drift wide, and a plain full pull up the middle
   * gets neither. At the top of the first hill a spur runs off to the right
   * to a pipe that drops the ball onto the traverse near the top — but just
   * past the spur's mouth is a flap that lets a ball through going up and
   * never back. Crest the hill gently and the spur is yours; crest it hard
   * and you are through the flap and committed to the long way: two
   * elbows, the second hill with its bumper, and round onto the traverse,
   * a corridor across the top with two windmills in it, timed or squeezed
   * past at the very edge. The traverse ends on a landing, and from the
   * landing the third hill climbs to the summit green.
   */
  hole({
    name: 'The Climb',
    par: 7,
    h: 640,
    tee: { x: 20, y: 622 },
    cup: { x: 32, y: 86 },
    green: [
      disc(20, 624, 14),
      capsule(20, 624, 20, 400, 12),
      capsule(20, 408, 52, 408, 6),
      arc(44, 400, 24, Math.PI, Math.PI * 1.5, 12),
      capsule(44, 376, 56, 376, 12),
      arc(56, 352, 24, 0, Math.PI / 2, 12),
      capsule(80, 352, 80, 270, 12),
      arc(56, 270, 24, -Math.PI / 2, 0, 12),
      capsule(56, 246, 30, 246, 12),
      disc(24, 246, 18),
      capsule(24, 246, 24, 118, 12),
      disc(30, 96, 22),
    ],
    slopes: [
      hill(capsule(20, 500, 20, 420, 12), 0, 100),
      hill(capsule(80, 336, 80, 284, 12), 0, 65),
      hill(capsule(24, 226, 24, 130, 12), 0, 90),
    ],
    walls: [flap(9, 399, 31, 399, UP)],
    portals: [pipe(50, 408, 58, 246, LEFT)],
    boosts: [pad(8, 560, 9, 16, UP)],
    sand: [disc(26, 542, 5)],
    bumpers: [pop(74, 316, 3)],
    spinners: [mill(50, 246, 14, 2.0), mill(36, 246, 14, -1.8, 1.2)],
    marks: [mark(30, 408, RIGHT)],
  }),
  /*
   * The Lake. A wide green with water across it and three ways over. In
   * the middle a drawbridge that is down six seconds in ten; on the left a
   * ramp that flies the ball over if it is going fast and straight, and
   * drops it in if it is not, and lands it in sand; on the right a dry
   * channel with a bar that slides across it. Before the water a field of
   * five bumpers, and after it three more guarding the mouth of a channel
   * that runs on up the middle, past five ponds set in it left and right,
   * a slalom that a clipped edge turns into a splash. At the top an island
   * green with a moat round it: a drawbridge across the moat, or a ramp to
   * jump it, and the island a bowl that gathers what lands on it to the
   * cup in the middle.
   */
  hole({
    name: 'The Lake',
    par: 6,
    h: 620,
    tee: { x: 50, y: 598 },
    cup: { x: 50, y: 86 },
    green: [capsule(50, 330, 50, 570, 46), capsule(50, 290, 50, 136, 14), disc(50, 90, 40)],
    water: [
      rect(4, 360, 72, 60),
      disc(40, 262, 9),
      disc(60, 232, 9),
      disc(40, 202, 9),
      disc(60, 172, 9),
      disc(50, 150, 6),
      arc(50, 90, 24, 0, Math.PI * 2, 5),
    ],
    drawbridges: [drawbridge(capsule(40, 424, 40, 356, 7), 4, 0.6), drawbridge(capsule(50, 124, 50, 104, 5), 5, 0.5)],
    ramps: [ramp(8, 426, 22, 8, UP, 82), ramp(40, 128, 20, 8, UP, 42)],
    slopes: [bowl(disc(50, 90, 18), 50)],
    sliders: [slider(76, 390, 88, 390, 8, 0, 2.6)],
    bumpers: [
      pop(34, 506, 4),
      pop(66, 506, 4),
      pop(50, 532, 4),
      pop(18, 532, 4),
      pop(82, 532, 4),
      pop(30, 332, 4),
      pop(50, 336, 4),
      pop(70, 332, 4),
    ],
    sand: [disc(19, 346, 9)],
    marks: [mark(19, 448, UP), mark(40, 448, UP), mark(86, 434, UP)],
  }),
  /*
   * Figure Eight. Out of the tee three lanes round two islands: sand in
   * the left one, a windmill in the middle one, two bumpers in the right.
   * They meet on a round plaza whose middle is a turntable that carries a
   * crossing ball sideways, so the shot up the stem is aimed off to come
   * out straight, or skirts the edge. Then two rings, one on top of the
   * other, sharing a waist: round either side of the lower ring, through
   * the waist, where a bar slides across, closing one side and then the
   * other, and round the upper ring — a bumper on the outside of each ring
   * and sand on the inside — to a neck with a second bar across it. The
   * green at the top is a turntable too, the cup at its centre: the floor
   * carries a putt round and presses it out to the rim, so the last stroke
   * is aimed against the spin.
   */
  hole({
    name: 'Figure Eight',
    par: 7,
    h: 576,
    tee: { x: 50, y: 560 },
    cup: { x: 50, y: 60 },
    green: [
      disc(50, 562, 12),
      capsule(50, 562, 50, 500, 10),
      capsule(50, 480, 50, 500, 24),
      capsule(30, 376, 30, 480, 7),
      capsule(50, 376, 50, 480, 7),
      capsule(70, 376, 70, 480, 7),
      capsule(50, 356, 50, 376, 24),
      disc(50, 330, 30),
      capsule(50, 262, 50, 300, 12),
      arc(50, 220, 30, 0, Math.PI * 2, 12),
      arc(50, 160, 30, 0, Math.PI * 2, 12),
      capsule(50, 90, 50, 130, 12),
      disc(50, 60, 30),
    ],
    slopes: [spin(disc(50, 330, 20), 40), spin(disc(50, 60, 26), 35)],
    sliders: [slider(25, 190, 55, 190, 20, 0, 3.0), slider(38, 106, 54, 106, 12, 0, 2.2)],
    spinners: [mill(50, 428, 12, 2.2)],
    bumpers: [pop(84, 220, 4), pop(16, 160, 4), pop(70, 415, 3), pop(70, 445, 3)],
    sand: [disc(70, 160, 5), disc(30, 220, 5), disc(30, 430, 5)],
    marks: [mark(50, 486, UP), mark(50, 190, UP)],
  }),
]

export const COURSE_PAR = COURSE.reduce((sum, h) => sum + h.par, 0)
