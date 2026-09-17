/*
 * The course: nine holes on one field, the same every round, so a score
 * means the same thing to everyone on the board.
 *
 * The field is 100 units wide and 170 tall, y growing downward. Tees sit
 * near the bottom, cups near the top. Walls are thick segments, so they
 * can sit at any angle. Then the pinball: bumpers that pop the ball away
 * and pay for every hit, and lanes that light up and pay once when the
 * ball rolls over them. Sand drags the ball to a stop.
 */

export const FIELD_W = 100
export const FIELD_H = 170

export type Vec = { x: number; y: number }

export type Wall = {
  a: Vec
  b: Vec
  /** Half of the wall's thickness. */
  t: number
}

export type Bumper = { x: number; y: number; r: number }

/** A rollover: a lit marker the ball has to pass over. */
export type Lane = { x: number; y: number }

export type Sand = { x: number; y: number; w: number; h: number }

export type Hole = {
  name: string
  par: number
  tee: Vec
  cup: Vec
  walls: Wall[]
  bumpers: Bumper[]
  lanes: Lane[]
  sand: Sand[]
}

export const LANE_R = 3.2

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

function pop(x: number, y: number, r = 5): Bumper {
  return { x, y, r }
}

function lane(x: number, y: number): Lane {
  return { x, y }
}

function hole(spec: Omit<Hole, 'walls'> & { walls?: Wall[] }): Hole {
  return { ...spec, walls: [...rails(), ...(spec.walls ?? [])] }
}

export const COURSE: Hole[] = [
  hole({
    name: 'Warm-up',
    par: 2,
    tee: { x: 50, y: 152 },
    cup: { x: 50, y: 24 },
    bumpers: [],
    lanes: [lane(50, 88)],
    sand: [],
  }),
  hole({
    name: 'Dogleg',
    par: 3,
    tee: { x: 22, y: 152 },
    cup: { x: 78, y: 24 },
    walls: [bar(0, 100, 62, 100, 3)],
    bumpers: [pop(82, 66)],
    lanes: [lane(82, 118)],
    sand: [],
  }),
  hole({
    name: 'Gate',
    par: 3,
    tee: { x: 50, y: 152 },
    cup: { x: 50, y: 24 },
    walls: [bar(0, 104, 40, 104), bar(60, 104, 100, 104)],
    bumpers: [pop(28, 72), pop(72, 72)],
    lanes: [lane(50, 104)],
    sand: [],
  }),
  hole({
    name: 'Island',
    par: 3,
    tee: { x: 50, y: 152 },
    cup: { x: 50, y: 28 },
    bumpers: [pop(20, 60), pop(80, 60)],
    lanes: [lane(50, 118)],
    sand: [{ x: 28, y: 8, w: 44, h: 40 }],
  }),
  hole({
    name: 'Pinball',
    par: 3,
    tee: { x: 50, y: 154 },
    cup: { x: 50, y: 20 },
    bumpers: [pop(50, 86), pop(32, 66), pop(68, 66), pop(32, 106), pop(68, 106)],
    lanes: [lane(18, 40), lane(82, 40)],
    sand: [],
  }),
  hole({
    name: 'Zigzag',
    par: 4,
    tee: { x: 16, y: 152 },
    cup: { x: 20, y: 24 },
    walls: [bar(0, 118, 68, 118), bar(32, 72, 100, 72)],
    bumpers: [pop(50, 95)],
    lanes: [lane(84, 118), lane(16, 72)],
    sand: [],
  }),
  hole({
    name: 'Pocket',
    par: 4,
    tee: { x: 20, y: 152 },
    cup: { x: 82, y: 26 },
    walls: [bar(66, 8, 66, 54)],
    bumpers: [pop(50, 70)],
    lanes: [lane(82, 58)],
    sand: [{ x: 6, y: 30, w: 30, h: 24 }],
  }),
  hole({
    name: 'Funnel',
    par: 3,
    tee: { x: 50, y: 154 },
    cup: { x: 50, y: 22 },
    walls: [bar(8, 120, 42, 70), bar(92, 120, 58, 70)],
    bumpers: [pop(50, 50, 4)],
    lanes: [lane(50, 70)],
    sand: [],
  }),
  hole({
    name: 'Gauntlet',
    par: 4,
    tee: { x: 50, y: 156 },
    cup: { x: 50, y: 20 },
    walls: [bar(0, 126, 35, 126), bar(65, 126, 100, 126)],
    bumpers: [pop(35, 92, 4.5), pop(65, 92, 4.5), pop(50, 60, 4.5)],
    lanes: [lane(50, 126), lane(20, 60), lane(80, 60)],
    sand: [{ x: 35, y: 34, w: 30, h: 18 }],
  }),
]

export const COURSE_PAR = COURSE.reduce((sum, h) => sum + h.par, 0)
