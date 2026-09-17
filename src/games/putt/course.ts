/*
 * The course: nine holes on one field, the same every round, so a score
 * means the same thing to everyone on the board.
 *
 * The field is 100 units wide and 200 tall, y growing downward. Tees sit
 * near the bottom, cups near the top. Walls are thick segments, so they
 * can sit at any angle; a kicker is a wall that throws the ball back
 * harder. Windmills turn, pads push the ball along their arrows, pipes
 * take it in one end and out the other, sand drags it to a stop, and
 * water costs a stroke. Then the pinball: bumpers that pop the ball away
 * and pay for every hit, and lanes that light up and pay once.
 */

export const FIELD_W = 100
export const FIELD_H = 200

export type Vec = { x: number; y: number }

export type Wall = {
  a: Vec
  b: Vec
  /** Half of the wall's thickness. */
  t: number
  /** A kicker: the ball comes off it faster than it arrived, and it pays. */
  kick?: boolean
}

export type Bumper = { x: number; y: number; r: number }

/** A rollover: a lit marker the ball has to pass over. */
export type Lane = { x: number; y: number }

export type Rect = { x: number; y: number; w: number; h: number }
export type Sand = Rect
export type Water = Rect

/** A pad that pushes the ball along `dir` (radians) while it is on it. */
export type Boost = Rect & { dir: number }

/** A windmill: a bar `len` long turning about (x, y) at `speed` radians a second. */
export type Spinner = { x: number; y: number; len: number; speed: number; phase: number }

/** A pipe: a ball that rolls into `a` comes out at `b` heading along `out`. */
export type Portal = { a: Vec; b: Vec; out: number }

/** A drop target: stands until the ball hits it. Knock the whole bank down for the bonus. */
export type Target = { x: number; y: number }

/** The cup slides from its spot to `to` and back, once every `period` seconds. */
export type CupPath = { to: Vec; period: number }

export type Hole = {
  name: string
  par: number
  tee: Vec
  cup: Vec
  cupPath?: CupPath
  walls: Wall[]
  bumpers: Bumper[]
  lanes: Lane[]
  targets: Target[]
  sand: Sand[]
  water: Water[]
  boosts: Boost[]
  spinners: Spinner[]
  portals: Portal[]
}

export const LANE_R = 3.2
export const PORTAL_R = 3.6
export const TARGET_R = 2.3
/** Half of a windmill blade's thickness. */
export const SPINNER_T = 1.5

export const UP = -Math.PI / 2
export const LEFT = Math.PI

const EDGE = 1
const BAR = 2.2

/** The rails around the field. Every hole has them. */
function rails(): Wall[] {
  return [
    { a: { x: EDGE, y: EDGE }, b: { x: FIELD_W - EDGE, y: EDGE }, t: EDGE },
    { a: { x: FIELD_W - EDGE, y: EDGE }, b: { x: FIELD_W - EDGE, y: FIELD_H - EDGE }, t: EDGE },
    { a: { x: FIELD_W - EDGE, y: FIELD_H - EDGE }, b: { x: EDGE, y: FIELD_H - EDGE }, t: EDGE },
    { a: { x: EDGE, y: FIELD_H - EDGE }, b: { x: EDGE, y: EDGE }, t: EDGE },
  ]
}

function bar(x1: number, y1: number, x2: number, y2: number, t = BAR): Wall {
  return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, t }
}

function kicker(x1: number, y1: number, x2: number, y2: number): Wall {
  return { ...bar(x1, y1, x2, y2), kick: true }
}

function pop(x: number, y: number, r = 5): Bumper {
  return { x, y, r }
}

function lane(x: number, y: number): Lane {
  return { x, y }
}

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h }
}

function pad(x: number, y: number, w: number, h: number, dir: number): Boost {
  return { x, y, w, h, dir }
}

function mill(x: number, y: number, len: number, speed: number, phase = 0): Spinner {
  return { x, y, len, speed, phase }
}

function pipe(ax: number, ay: number, bx: number, by: number, out: number): Portal {
  return { a: { x: ax, y: ay }, b: { x: bx, y: by }, out }
}

/** A bank of three targets in a line from (x, y), stepping by (dx, dy). */
function bank(x: number, y: number, dx: number, dy: number): Target[] {
  return [0, 1, 2].map((i) => ({ x: x + dx * i, y: y + dy * i }))
}

type Spec = Pick<Hole, 'name' | 'par' | 'tee' | 'cup'> & Partial<Omit<Hole, 'name' | 'par' | 'tee' | 'cup'>>

function hole(spec: Spec): Hole {
  return {
    ...spec,
    walls: [...rails(), ...(spec.walls ?? [])],
    bumpers: spec.bumpers ?? [],
    lanes: spec.lanes ?? [],
    targets: spec.targets ?? [],
    sand: spec.sand ?? [],
    water: spec.water ?? [],
    boosts: spec.boosts ?? [],
    spinners: spec.spinners ?? [],
    portals: spec.portals ?? [],
  }
}

export const COURSE: Hole[] = [
  // A straight run with a belt of sand to judge the power through, and a bank of targets up the left rail.
  hole({
    name: 'Opener',
    par: 3,
    tee: { x: 50, y: 184 },
    cup: { x: 50, y: 26 },
    sand: [rect(0, 104, 100, 14)],
    bumpers: [pop(28, 66), pop(72, 66)],
    lanes: [lane(50, 80)],
    targets: bank(9, 58, 0, 9),
  }),
  // A windmill in the only gap. Time it.
  hole({
    name: 'Windmill',
    par: 3,
    tee: { x: 50, y: 184 },
    cup: { x: 50, y: 24 },
    walls: [bar(0, 100, 28, 100), bar(72, 100, 100, 100)],
    spinners: [mill(50, 100, 40, 1.7)],
    lanes: [lane(50, 64)],
    sand: [rect(6, 8, 26, 34), rect(68, 8, 26, 34)],
  }),
  // Round the wall, then either side of a pool that costs a stroke.
  hole({
    name: 'Splash',
    par: 4,
    tee: { x: 20, y: 184 },
    cup: { x: 22, y: 30 },
    walls: [bar(0, 124, 62, 124)],
    water: [rect(36, 46, 34, 44)],
    bumpers: [pop(88, 60)],
    lanes: [lane(82, 124), lane(50, 32)],
  }),
  // The long way is round the wall. The short way is down the pipe.
  hole({
    name: 'Pipes',
    par: 3,
    tee: { x: 50, y: 184 },
    cup: { x: 16, y: 26 },
    walls: [bar(0, 90, 78, 90)],
    portals: [pipe(86, 150, 16, 66, UP)],
    bumpers: [pop(50, 134)],
    lanes: [lane(89, 90)],
    sand: [rect(30, 8, 44, 26)],
  }),
  // Kickers at the bottom, a wall of bumpers in front of a cup that will not sit still.
  hole({
    name: 'Slings',
    par: 4,
    tee: { x: 50, y: 186 },
    cup: { x: 30, y: 20 },
    cupPath: { to: { x: 70, y: 20 }, period: 6 },
    walls: [kicker(6, 166, 30, 132), kicker(94, 166, 70, 132)],
    bumpers: [pop(50, 104), pop(30, 82), pop(70, 82), pop(50, 58, 4)],
    lanes: [lane(14, 40), lane(86, 40)],
    targets: bank(9, 100, 0, 9),
  }),
  // Two pads carry the ball round the bends, if it gets on them.
  hole({
    name: 'Conveyor',
    par: 4,
    tee: { x: 16, y: 184 },
    cup: { x: 84, y: 24 },
    walls: [bar(0, 144, 70, 144), bar(30, 84, 100, 84)],
    boosts: [pad(72, 92, 24, 48, UP), pad(34, 100, 36, 28, LEFT)],
    bumpers: [pop(84, 52)],
    lanes: [lane(84, 116), lane(16, 64)],
    sand: [rect(4, 8, 30, 30)],
  }),
  // The cup sits on an island. One narrow bridge, and it is dead straight from the tee.
  hole({
    name: 'Island',
    par: 4,
    tee: { x: 50, y: 186 },
    cup: { x: 50, y: 50 },
    water: [rect(20, 20, 60, 15), rect(20, 35, 15, 45), rect(65, 35, 15, 45), rect(35, 65, 11, 15), rect(54, 65, 11, 15)],
    bumpers: [pop(26, 122), pop(74, 122)],
    lanes: [lane(50, 72)],
  }),
  // Two mills turning opposite ways, and water either side of the cup.
  hole({
    name: 'Twin mills',
    par: 4,
    tee: { x: 16, y: 186 },
    cup: { x: 50, y: 24 },
    walls: [bar(0, 144, 64, 144), bar(36, 84, 100, 84)],
    spinners: [mill(82, 144, 30, 1.9), mill(18, 84, 30, -1.9, 1.2)],
    water: [rect(0, 8, 26, 40), rect(74, 8, 26, 40)],
    lanes: [lane(82, 120), lane(18, 60)],
  }),
  // Everything at once.
  hole({
    name: 'Gauntlet',
    par: 5,
    tee: { x: 50, y: 188 },
    cup: { x: 50, y: 20 },
    walls: [kicker(6, 176, 28, 144), kicker(94, 176, 72, 144)],
    boosts: [pad(40, 130, 20, 28, UP)],
    bumpers: [pop(32, 110), pop(68, 110), pop(50, 88)],
    water: [rect(0, 16, 30, 46), rect(70, 16, 30, 46)],
    spinners: [mill(50, 54, 34, 2.3)],
    lanes: [lane(50, 144), lane(18, 90), lane(82, 90)],
    targets: bank(91, 112, 0, 9),
  }),
]

export const COURSE_PAR = COURSE.reduce((sum, h) => sum + h.par, 0)
