/*
 * The course: nine holes on one field, the same every round, so a score
 * means the same thing to everyone on the board.
 *
 * The field is 100 units wide and 134 tall (a 3:4 portrait), y growing
 * downward. Tees sit near the bottom, cups near the top. Walls are thick
 * segments, so they can sit at any angle; bumpers are circles that kick
 * the ball back; sand is a rectangle that drags it to a stop.
 */

export const FIELD_W = 100
export const FIELD_H = 134

export type Vec = { x: number; y: number }

export type Wall = {
  a: Vec
  b: Vec
  /** Half of the wall's thickness. */
  t: number
}

export type Bumper = { x: number; y: number; r: number }

export type Sand = { x: number; y: number; w: number; h: number }

export type Hole = {
  name: string
  par: number
  tee: Vec
  cup: Vec
  walls: Wall[]
  bumpers: Bumper[]
  sand: Sand[]
}

const EDGE = 1
const BAR = 2

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

function hole(spec: Omit<Hole, 'walls'> & { walls?: Wall[] }): Hole {
  return { ...spec, walls: [...rails(), ...(spec.walls ?? [])] }
}

export const COURSE: Hole[] = [
  hole({
    name: 'Straight',
    par: 2,
    tee: { x: 50, y: 116 },
    cup: { x: 50, y: 22 },
    bumpers: [],
    sand: [],
  }),
  hole({
    name: 'Dogleg',
    par: 3,
    tee: { x: 22, y: 116 },
    cup: { x: 78, y: 22 },
    walls: [bar(0, 70, 62, 70, 3)],
    bumpers: [],
    sand: [],
  }),
  hole({
    name: 'Gate',
    par: 3,
    tee: { x: 50, y: 116 },
    cup: { x: 50, y: 22 },
    walls: [bar(0, 66, 40, 66), bar(60, 66, 100, 66)],
    bumpers: [],
    sand: [],
  }),
  hole({
    name: 'Island',
    par: 3,
    tee: { x: 50, y: 116 },
    cup: { x: 50, y: 25 },
    bumpers: [],
    sand: [{ x: 30, y: 8, w: 40, h: 34 }],
  }),
  hole({
    name: 'Pinball',
    par: 3,
    tee: { x: 50, y: 118 },
    cup: { x: 50, y: 20 },
    bumpers: [
      { x: 35, y: 62, r: 5 },
      { x: 65, y: 62, r: 5 },
      { x: 50, y: 42, r: 4 },
    ],
    sand: [],
  }),
  hole({
    name: 'Zigzag',
    par: 4,
    tee: { x: 16, y: 118 },
    cup: { x: 20, y: 22 },
    walls: [bar(0, 92, 68, 92), bar(32, 56, 100, 56)],
    bumpers: [],
    sand: [],
  }),
  hole({
    name: 'Pocket',
    par: 4,
    tee: { x: 20, y: 118 },
    cup: { x: 82, y: 24 },
    walls: [bar(66, 8, 66, 48)],
    bumpers: [],
    sand: [{ x: 6, y: 30, w: 30, h: 22 }],
  }),
  hole({
    name: 'Funnel',
    par: 3,
    tee: { x: 50, y: 118 },
    cup: { x: 50, y: 22 },
    walls: [bar(8, 92, 42, 56), bar(92, 92, 58, 56)],
    bumpers: [],
    sand: [],
  }),
  hole({
    name: 'Gauntlet',
    par: 4,
    tee: { x: 50, y: 120 },
    cup: { x: 50, y: 20 },
    walls: [bar(0, 100, 35, 100), bar(65, 100, 100, 100)],
    bumpers: [
      { x: 35, y: 70, r: 4 },
      { x: 65, y: 70, r: 4 },
    ],
    sand: [{ x: 35, y: 34, w: 30, h: 20 }],
  }),
]

export const COURSE_PAR = COURSE.reduce((sum, h) => sum + h.par, 0)
