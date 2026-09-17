/*
 * The course: nine holes, the same every round, so a score means the same
 * thing to everyone on the board.
 *
 * Every hole is 100 units wide and as long as it needs to be — longer than
 * the screen, so the view follows the ball and a map in the corner shows
 * the rest. y grows downward: tees sit near the bottom, cups near the top,
 * and no cup is within one shot of its tee. Walls are thick segments, so
 * they can sit at any angle; a kicker is a wall that throws the ball back
 * harder. Windmills turn, pads push the ball along their arrows, pipes take
 * it in one end and out the other, sand drags it to a stop, and water costs
 * a stroke. Then the pinball: bumpers that pop the ball away and pay for
 * every hit, lanes that light up and pay once, and drop targets that pay
 * big when the whole bank is down.
 */

export const FIELD_W = 100

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
  /** How long the hole is, in field units. */
  h: number
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
export const DOWN = Math.PI / 2
export const LEFT = Math.PI
export const RIGHT = 0

const EDGE = 1
const BAR = 2.2

/** The rails around a hole. Every hole has them. */
function rails(h: number): Wall[] {
  return [
    { a: { x: EDGE, y: EDGE }, b: { x: FIELD_W - EDGE, y: EDGE }, t: EDGE },
    { a: { x: FIELD_W - EDGE, y: EDGE }, b: { x: FIELD_W - EDGE, y: h - EDGE }, t: EDGE },
    { a: { x: FIELD_W - EDGE, y: h - EDGE }, b: { x: EDGE, y: h - EDGE }, t: EDGE },
    { a: { x: EDGE, y: h - EDGE }, b: { x: EDGE, y: EDGE }, t: EDGE },
  ]
}

function bar(x1: number, y1: number, x2: number, y2: number, t = BAR): Wall {
  return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, t }
}

function kicker(x1: number, y1: number, x2: number, y2: number): Wall {
  return { ...bar(x1, y1, x2, y2), kick: true }
}

/** A gate: a wall across the hole at `y` with a gap from `from` to `to`. */
function gate(y: number, from: number, to: number): Wall[] {
  const walls: Wall[] = []
  if (from > 0) walls.push(bar(0, y, from, y))
  if (to < FIELD_W) walls.push(bar(to, y, FIELD_W, y))
  return walls
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

type Spec = Pick<Hole, 'name' | 'par' | 'h' | 'tee' | 'cup'> &
  Partial<Omit<Hole, 'name' | 'par' | 'h' | 'tee' | 'cup'>>

function hole(spec: Spec): Hole {
  return {
    ...spec,
    walls: [...rails(spec.h), ...(spec.walls ?? [])],
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
  // A long straight run: a belt of sand, then a gate with a bumper square behind it, so the
  // second shot has to come through on an angle.
  hole({
    name: 'Long drive',
    par: 4,
    h: 330,
    tee: { x: 50, y: 314 },
    cup: { x: 50, y: 26 },
    sand: [rect(0, 230, 100, 14)],
    walls: gate(150, 36, 64),
    bumpers: [pop(50, 118)],
    lanes: [lane(50, 150), lane(50, 60)],
    targets: bank(9, 60, 0, 9),
  }),
  // Four levels, the gap swapping sides each time. A windmill in the second, water in the fourth.
  hole({
    name: 'Switchback',
    par: 5,
    h: 380,
    tee: { x: 16, y: 364 },
    cup: { x: 84, y: 24 },
    walls: [...gate(300, 68, 100), ...gate(220, 0, 32), ...gate(140, 68, 100), ...gate(60, 0, 32)],
    sand: [rect(72, 340, 24, 22)],
    spinners: [mill(16, 220, 28, 1.8)],
    bumpers: [pop(50, 180)],
    water: [rect(34, 72, 32, 24)],
    lanes: [lane(84, 140), lane(16, 60)],
  }),
  // A wall down the middle. Left is water and precision; right is windmills and timing.
  hole({
    name: 'Two roads',
    par: 5,
    h: 400,
    tee: { x: 50, y: 384 },
    cup: { x: 50, y: 26 },
    walls: [bar(50, 80, 50, 300)],
    sand: [rect(0, 320, 100, 12)],
    water: [rect(4, 120, 26, 40), rect(20, 200, 26, 40)],
    spinners: [mill(75, 150, 40, 2.0), mill(75, 250, 40, -2.0, 1.1)],
    bumpers: [pop(30, 50), pop(70, 50)],
    lanes: [lane(25, 160), lane(25, 260), lane(75, 200)],
  }),
  // Three locks: a windmill in each gate, sand pockets either side to catch the misses.
  hole({
    name: 'Locks',
    par: 5,
    h: 360,
    tee: { x: 50, y: 344 },
    cup: { x: 50, y: 24 },
    walls: [...gate(270, 28, 72), ...gate(180, 28, 72), ...gate(90, 28, 72)],
    spinners: [mill(50, 270, 40, 1.6), mill(50, 180, 40, -2.0, 1), mill(50, 90, 40, 2.4, 2)],
    sand: [rect(4, 276, 22, 18), rect(74, 276, 22, 18), rect(4, 186, 22, 18), rect(74, 186, 22, 18)],
    lanes: [lane(50, 225), lane(50, 135)],
  }),
  // Kickers, a field of bumpers, two banks of targets, and a cup that will not sit still.
  hole({
    name: 'Pinball alley',
    par: 5,
    h: 400,
    tee: { x: 50, y: 386 },
    cup: { x: 30, y: 22 },
    cupPath: { to: { x: 70, y: 22 }, period: 6 },
    walls: [kicker(6, 370, 30, 330), kicker(94, 370, 70, 330), ...gate(80, 34, 66)],
    bumpers: [pop(50, 300), pop(30, 270), pop(70, 270), pop(50, 240), pop(30, 210), pop(70, 210), pop(50, 180)],
    targets: [...bank(9, 150, 0, 9), ...bank(91, 150, 0, 9)],
    lanes: [lane(20, 120), lane(80, 120), lane(50, 150)],
  }),
  // A canal down the middle with three bridges. The tee is on the left bank, under the windmill;
  // the right bank has sand and a bumper. Pads on the bridges carry you across. The cup sits at
  // the head of the water, so the last shot comes in from a side.
  hole({
    name: 'The canal',
    par: 6,
    h: 440,
    tee: { x: 20, y: 424 },
    cup: { x: 50, y: 30 },
    water: [rect(38, 316, 24, 84), rect(38, 206, 24, 94), rect(38, 106, 24, 84), rect(38, 60, 24, 30)],
    boosts: [pad(38, 300, 24, 16, LEFT), pad(38, 190, 24, 16, RIGHT)],
    spinners: [mill(19, 250, 30, 2.0)],
    sand: [rect(62, 200, 38, 16), rect(62, 300, 38, 16)],
    bumpers: [pop(81, 150)],
    lanes: [lane(19, 350), lane(81, 350), lane(50, 98)],
  }),
  // Two walls make an S. One pipe skips the first bend; the other sends you back to the start.
  hole({
    name: 'Pipes',
    par: 5,
    h: 380,
    tee: { x: 50, y: 364 },
    cup: { x: 16, y: 24 },
    walls: [...gate(260, 0, 22), ...gate(120, 78, 100)],
    portals: [pipe(86, 300, 50, 200, UP), pipe(12, 200, 84, 330, DOWN)],
    bumpers: [pop(66, 170)],
    sand: [rect(30, 8, 44, 26)],
    lanes: [lane(11, 260), lane(89, 120)],
  }),
  // Four gates, the gap swapping sides, a windmill in every one. Water past the cup.
  hole({
    name: 'Windmill row',
    par: 5,
    h: 400,
    tee: { x: 50, y: 384 },
    cup: { x: 50, y: 26 },
    walls: [...gate(310, 60, 100), ...gate(230, 0, 40), ...gate(150, 60, 100), ...gate(70, 0, 40)],
    spinners: [mill(80, 310, 36, 1.8), mill(20, 230, 36, -1.8, 1), mill(80, 150, 36, 2.2, 2), mill(20, 70, 36, -2.2, 3)],
    water: [rect(70, 4, 30, 56)],
    lanes: [lane(80, 270), lane(20, 190), lane(80, 110)],
  }),
  // Everything at once.
  hole({
    name: 'The gauntlet',
    par: 6,
    h: 440,
    tee: { x: 50, y: 426 },
    cup: { x: 50, y: 24 },
    walls: [kicker(6, 410, 28, 376), kicker(94, 410, 72, 376), ...gate(180, 36, 64), ...gate(90, 28, 72)],
    boosts: [pad(40, 360, 20, 30, UP)],
    bumpers: [pop(32, 330), pop(68, 330), pop(50, 300)],
    water: [rect(0, 240, 30, 50), rect(70, 240, 30, 50)],
    spinners: [mill(50, 265, 34, 2.3), mill(50, 90, 40, -2.0, 1)],
    sand: [rect(36, 150, 28, 14)],
    targets: bank(91, 120, 0, 9),
    lanes: [lane(50, 375), lane(18, 300), lane(82, 300), lane(50, 180)],
  }),
]

export const COURSE_PAR = COURSE.reduce((sum, h) => sum + h.par, 0)
