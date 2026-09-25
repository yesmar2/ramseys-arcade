/*
 * The course, the same every round, so a score means the same thing to
 * everyone on the board: two short holes to start, then five long ones, each
 * somewhere of its own.
 *
 * A long hole is a place, not a diagram: a green laid through a garden, a
 * castle, a beach or a mountain, several parts to it, each with something of
 * its own to get past or a way to choose, so a good round is five or six
 * strokes a hole. The short ones fit on one screen, one thing to play past.
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

import { arc, capsule, disc, poly, rect, ribbon, spiral, type Shape, type Vec } from './terrain'

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
export type Slope = {
  shape: Shape
  pull?: Vec
  bowl?: number
  /** Like a bowl, but without the drag that settles the ball: a floor that dishes toward its middle. */
  dish?: number
  repel?: number
  spin?: number
  /** A hill no ball settles on, however gentle: it runs on down rather than coming to rest partway. */
  slick?: boolean
  /**
   * How a hill is drawn: a slope, a flight of steps, open ground a wind blows
   * across, or a ramp, one even tilt that fades out where it meets the flat.
   */
  look?: 'hill' | 'steps' | 'wind' | 'ramp'
}

/** A bare windmill blade: a bar `len` long turning about (x, y) at `speed` radians a second. */
export type Spinner = { x: number; y: number; len: number; speed: number; phase: number }

/**
 * A gate: a wall from a to b, `t` half-thick, that is open for the first
 * `open` share of every `period` seconds and shut the rest. Give it a
 * drawbridge's period, phase and share and it opens as the bridge comes down.
 */
export type Gate = { a: Vec; b: Vec; t: number; period: number; open: number; phase?: number }

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

/**
 * A pipe: a ball that rolls into `a` drops in, runs along it and comes out at
 * `b` heading along `out`, as fast as it went in and never slower than a good
 * roll, or at `speed` when a pipe only lets it drop out. `r` is how wide its
 * mouth is, and `fastest` the fastest a ball can be rolling and still drop in:
 * any faster and it runs over the mouth. With a `path` the pipe is laid
 * across the ground through those points, and the ball can be seen running
 * along it; without one it runs out of sight. A `tint` paints the pipe one
 * colour end to end, so where there are several you can see which comes out
 * where.
 */
export type Portal = {
  a: Vec
  b: Vec
  out: number
  look?: 'pipe' | 'cave' | 'drain'
  tint?: string
  speed?: number
  r?: number
  fastest?: number
  path?: Vec[]
}

/** The cup slides from its spot to `to` and back, once every `period` seconds. */
export type CupPath = { to: Vec; period: number }

/**
 * A drawbridge: ground over the water for the first `down` share of each
 * `period` seconds, gone the rest. A sandbar is the same thing drawn as the
 * tide going out and coming back in.
 */
export type Drawbridge = { shape: Shape; period: number; down: number; phase?: number; look?: 'bridge' | 'sandbar' }

/**
 * A ramp: a ball crossing it along `dir` at least `min` fast (or the usual
 * take-off speed) takes off and flies over whatever is there, `len` units at
 * a quarter over the take-off speed and further the faster it went, keeping a
 * little of the angle it came in at. `longest` is how many times `len` the
 * hardest take-off can fly, where a ramp wants a full-blooded hit to overshoot;
 * `keep` is the share of its speed the ball keeps coming down, less where it
 * lands on soft ground and checks up.
 */
export type Ramp = Rect & { dir: number; len: number; min?: number; longest?: number; keep?: number }

/**
 * A rover: a loose ball that bounces around its pen at a steady speed, off
 * the pen's edges and anything inside it. Your ball caroms off it, and it
 * caroms off yours.
 */
export type Rover = { x: number; y: number; r: number; speed: number; heading: number; pen: Rect; look?: 'ball' | 'crab' }

/** A mark on the ground: a chevron at (x, y) pointing along `dir`, a hint and nothing more. */
export type Mark = { x: number; y: number; dir: number }

/** A boulder on the green, or something else round that stands there and stops the ball the same way. */
export type Rock = Bumper & { look?: 'boulder' | 'planter' | 'sandcastle' | 'turret' }

/** Where a hole is: what its rails are made of, the ground round it, and what grows there. */
export type Theme = 'garden' | 'formal' | 'castle' | 'coast' | 'summit'

/** What a hole's water looks like: a stream, a moat between stone walls, or the sea. */
export type WaterLook = 'creek' | 'moat' | 'sea'

/**
 * What grows or stands around the green: set by hand where it matters, and
 * the rest scattered. Most things are round, `r` across the middle; a wall
 * or a bed also runs `len` along `angle`.
 */
export type Decor = {
  kind:
    | 'tree'
    | 'blossom'
    | 'pine'
    | 'bush'
    | 'flowers'
    | 'stone'
    | 'lily'
    | 'reeds'
    | 'topiary'
    | 'cone'
    | 'urn'
    | 'bed'
    | 'fountain'
    | 'tower'
    | 'keep'
    | 'wall'
    | 'palm'
    | 'umbrella'
    | 'shell'
    | 'boat'
    | 'lighthouse'
    | 'snow'
    | 'waterfall'
  x: number
  y: number
  r: number
  angle?: number
  len?: number
}

export type Hole = {
  name: string
  par: number
  theme: Theme
  waterLook: WaterLook
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
  rocks: Rock[]
  sand: Shape[]
  water: Shape[]
  /** Ground that falls away: a ball that rolls in is over the edge, a stroke and back. */
  pits: Shape[]
  /** Paving laid on the green: the same to roll on, only the look is stone. */
  paving: Shape[]
  /** Ground laid over water. */
  bridges: Shape[]
  drawbridges: Drawbridge[]
  slopes: Slope[]
  boosts: Boost[]
  ramps: Ramp[]
  spinners: Spinner[]
  mills: Mill[]
  gates: Gate[]
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

const BAR = 2.2

export const UP = -Math.PI / 2
export const DOWN = Math.PI / 2
export const LEFT = Math.PI
export const RIGHT = 0

/** A windmill standing at (x, y) with its tunnel running along `dir`. */
function mill(x: number, y: number, r: number, dir: number, speed: number, phase = 0): Mill {
  return { x, y, r, door: 3.6, dir, sails: 4, reach: r + 8, speed, phase }
}

/** A ramp: cross the box along `dir` at least `min` fast and the ball flies about `len` units, further the faster. */
function ramp(
  x: number,
  y: number,
  w: number,
  h: number,
  dir: number,
  len: number,
  min?: number,
  longest?: number,
  keep?: number,
): Ramp {
  return { x, y, w, h, dir, len, min, longest, keep }
}

/** A hill: the ball is pushed along (px, py) — downhill — while on the shape. */
function hill(shape: Shape, px: number, py: number, look?: Slope['look']): Slope {
  return { shape, pull: { x: px, y: py }, look }
}

/**
 * A hilltop round (x, y): flat for `top` out from the middle, then a slope
 * falling away all round out to `foot`, pushing a ball this hard downhill.
 * Short, a ball rolls back down; long, it runs over the top and off the far
 * side; only one that arrives just so stays on the top.
 */
function hilltop(x: number, y: number, top: number, foot: number, strength: number): Slope {
  return { shape: arc(x, y, (top + foot) / 2, 0, Math.PI * 2, (foot - top) / 2), repel: strength }
}

/** A floor that dishes toward its middle this hard, with nothing to stop a ball sliding all the way in. */
function dish(shape: Shape, strength: number): Slope {
  return { shape, dish: strength }
}

function decor(kind: Decor['kind'], x: number, y: number, r: number, angle?: number, len?: number): Decor {
  return { kind, x, y, r, angle, len }
}

function rock(x: number, y: number, r: number, look?: Rock['look']): Rock {
  return { x, y, r, look }
}

/** A plain bar of wall from (x1, y1) to (x2, y2), `t` half-thick. */
function bar(x1: number, y1: number, x2: number, y2: number, t = BAR): Wall {
  return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, t }
}

/**
 * A ring of wall round (x, y), radius R, `t` half-thick, open where `gaps`
 * say: each an angle and how wide the opening is, in units.
 */
function ring(x: number, y: number, R: number, t: number, gaps: [number, number][]): Wall[] {
  // An even count, so openings across from each other come out the same width, and fine enough that an
  // opening comes out close to the width asked for.
  const n = Math.max(24, Math.round(R) * 4)
  const open = (a: number) =>
    gaps.some(([g, w]) => {
      const d = Math.abs((((a - g) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI)
      return d < w / 2 / R
    })
  const walls: Wall[] = []
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    if (open((a0 + a1) / 2)) continue
    walls.push(bar(x + Math.cos(a0) * R, y + Math.sin(a0) * R, x + Math.cos(a1) * R, y + Math.sin(a1) * R, t))
  }
  return walls
}

/** A gate across from (x1, y1) to (x2, y2): open for the first `open` share of every `period` seconds. */
function gate(x1: number, y1: number, x2: number, y2: number, period: number, open: number, phase = 0): Gate {
  return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, t: 1, period, open, phase }
}

/** A drawbridge over the water, hinged at its far end: down for the first `down` share of every `period` seconds. */
function drawbridge(shape: Shape, period: number, down: number, look?: Drawbridge['look']): Drawbridge {
  return { shape, period, down, look }
}

/** A pipe: in at (ax, ay), out at (bx, by) heading along `out`; its colour, mouth, run and so on in `more`. */
function pipe(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  out: number,
  look?: Portal['look'],
  more: Pick<Portal, 'tint' | 'speed' | 'r' | 'fastest' | 'path'> = {},
): Portal {
  return { a: { x: ax, y: ay }, b: { x: bx, y: by }, out, look, ...more }
}

/** Points for a pipe's run, from pairs. */
function run(...pts: [number, number][]): Vec[] {
  return pts.map(([x, y]) => ({ x, y }))
}

/** A crab, scuttling side to side across its strip of beach at `speed`. */
function crab(x: number, y: number, speed: number, heading: number, pen: Rect): Rover {
  return { x, y, r: 2.3, speed, heading, pen, look: 'crab' }
}

/** A beam turning on a post at (x, y), `len` long, at `speed` radians a second. */
function beam(x: number, y: number, len: number, speed: number, phase = 0): Spinner {
  return { x, y, len, speed, phase }
}

function box(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h }
}

type Spec = Pick<Hole, 'name' | 'par' | 'h' | 'tee' | 'cup'> &
  Partial<Omit<Hole, 'name' | 'par' | 'h' | 'tee' | 'cup'>>

/** A hole from its parts. Without `green`, the ground is the whole box. */
function hole(spec: Spec): Hole {
  return {
    ...spec,
    theme: spec.theme ?? 'garden',
    waterLook: spec.waterLook ?? 'creek',
    green: spec.green ?? [rect(0, 0, FIELD_W, spec.h)],
    blend: spec.blend ?? 0,
    walls: spec.walls ?? [],
    bumpers: spec.bumpers ?? [],
    rocks: spec.rocks ?? [],
    sand: spec.sand ?? [],
    water: spec.water ?? [],
    pits: spec.pits ?? [],
    paving: spec.paving ?? [],
    bridges: spec.bridges ?? [],
    drawbridges: spec.drawbridges ?? [],
    slopes: spec.slopes ?? [],
    boosts: spec.boosts ?? [],
    ramps: spec.ramps ?? [],
    spinners: spec.spinners ?? [],
    mills: spec.mills ?? [],
    gates: spec.gates ?? [],
    sliders: spec.sliders ?? [],
    portals: spec.portals ?? [],
    rovers: spec.rovers ?? [],
    marks: spec.marks ?? [],
    decor: spec.decor ?? [],
  }
}

export const COURSE: Hole[] = [
  /*
   * Lily Pond, a short one to start: the whole hole on one screen, the cup
   * in sight from the tee. A long pond lies across the middle, lilies on it,
   * and a ramp at its near edge: the jump has to be judged. Too soft and the
   * ball rolls up the ramp into the water, or takes off and comes down in
   * it; right, and it lands on the green, most times a putt from the cup and
   * now and then rolling in; firm, and it runs on into the bunker behind the
   * flag; a full pull flies the whole hole and is out of bounds. Or go round
   * the pond either side, the safe way, and putt from there.
   */
  hole({
    name: 'Lily Pond',
    par: 2,
    h: 190,
    tee: { x: 50, y: 172 },
    cup: { x: 54, y: 38 },
    blend: 9,
    green: [
      disc(50, 168, 13),
      ribbon(14, [50, 168], [50, 146]),
      // Round the pond: the ground runs on under it, so a ball that comes down short is in.
      capsule(50, 94, 50, 116, 30),
      disc(52, 40, 26),
    ],
    water: [capsule(50, 94, 50, 112, 12)],
    ramps: [ramp(44, 128, 12, 8, UP, 48, 90, 4, 0.15)],
    // Deep enough that a jump that lands running doesn't come back off the rail and all the way down into the pond.
    sand: [ribbon(7.5, [30, 25], [52, 20], [74, 25])],
    decor: [
      decor('lily', 45, 100, 2.4),
      decor('lily', 55, 110, 2),
      decor('lily', 47, 88, 1.8),
      decor('reeds', 61, 92, 2.2),
      decor('flowers', 22, 154, 3),
      decor('flowers', 79, 150, 2.6),
      decor('bush', 16, 64, 3.2),
      decor('blossom', 87, 62, 5.5),
    ],
  }),
  /*
   * Three Pipes, another short one, and a bank shot twice over, in an old
   * garden's waterworks. The tee sits at the foot of a lane up the
   * right-hand side; the lane's head is cut across by a wall at a slant,
   * which turns the ball left along a gallery, and in the paved floor at the
   * gallery's far end three pipes open, evenly one above another, small
   * enough to miss, and a ball going too fast runs over them. Which one the
   * ball finds depends on how it came off the wall. Blue, in the middle, is
   * where a shot straight up the lane goes: its pipe climbs to the foot of
   * the terrace above and lets the ball out there, as far from the cup as
   * the terrace goes. The terrace is an L, up the left side and across the
   * top to a round green where the cup is, with its corner cut across at a
   * slant like the one below: the corner stands between the ball and the
   * cup, so from blue it is a bank shot off that wall to hole out in two.
   * Gold, the bottom one, takes a shot a touch right of straight and little
   * else: its pipe crosses the garden and comes up in the round green beside
   * the cup, pointing at it, and the ball drops. Red, the top one, catches a
   * shot pulled left and much of the ceiling's bounce; its pipe runs down the
   * garden and round to the tee. The gallery runs downhill, so a ball that
   * finds none of them rolls back out of it to the lane. The pipes are the
   * only way up to the terrace.
   */
  hole({
    name: 'Three Pipes',
    par: 2,
    h: 300,
    tee: { x: 74, y: 276 },
    cup: { x: 78, y: 25 },
    blend: 9,
    green: [
      // The terrace, up top, on its own: down the left side and across the top, the corner between cut across
      // at a slant, and a round green at the far end for the cup.
      poly([44, 9], [76, 9], [76, 41], [54.4, 41], [44, 51.4], [44, 138], [14, 138], [14, 39]),
      disc(76, 25, 20),
      // The lane and the gallery, one channel with its corner cut across at a slant: the wall there, the
      // gallery's ceiling and the square end wall run dead straight, so a ball comes off them true.
      poly([12, 165], [56.6, 165], [87, 195.4], [87, 276], [61, 276], [61, 214.6], [43.4, 197], [12, 197]),
      // The tee.
      disc(74, 276, 15),
    ],
    paving: [rect(12, 165, 12, 32)],
    // The gallery runs gently downhill to the lane, and no ball settles on it: one that finds no pipe, or stops
    // short of them, rolls back out, and the next shot is off the wall again.
    slopes: [{ ...hill(rect(12, 165, 44.6, 32), 18, 0, 'ramp'), slick: true }],
    // Behind the cup, for a bank shot that comes in too hard.
    sand: [ribbon(3, [87, 16], [90.5, 25], [87, 34])],
    // Off the wall, a shot from 5° left of straight up to 5° right arrives at the far end about 180 + 2.4
    // a degree down it; further left, the ball meets the ceiling first and comes back down. Faster than 70,
    // a ball runs over a pipe's mouth, and may drop in coming back off the end wall.
    portals: [
      // Red only lets the ball drop out, by the tee, so it is back where it started however hard it went in.
      pipe(17, 171, 66, 280, -1.22, 'pipe', {
        tint: '#d9534f',
        speed: 22,
        r: 2.6,
        fastest: 70,
        path: run([13, 184], [8, 196], [6, 210], [6, 276], [11, 288], [24, 292], [50, 292], [60, 287]),
      }),
      // Blue only lets the ball drop out too, at the foot of the terrace's long side.
      pipe(17, 181, 29, 131, UP, 'pipe', {
        tint: '#3f8fd8',
        speed: 14,
        r: 2.6,
        fastest: 70,
        path: run([22, 170], [26, 158], [28, 146]),
      }),
      pipe(17, 191, 71, 38, Math.atan2(25 - 38, 78 - 71), 'pipe', {
        tint: '#e8b53a',
        r: 2.6,
        fastest: 70,
        path: run([30, 172], [46, 160], [56, 140], [62, 110], [66, 80], [69, 58]),
      }),
    ],
    // The fountain's basin, off the course: nothing rolls in it.
    water: [disc(86, 110, 6.5)],
    decor: [
      decor('fountain', 86, 110, 6.5),
      decor('bed', 34, 246, 3, DOWN, 36),
      decor('blossom', 92, 64, 5),
      decor('flowers', 54, 96, 2.6),
      decor('flowers', 92, 140, 2.4),
      decor('bush', 48, 216, 3.2),
      decor('flowers', 52, 278, 2.8),
    ],
  }),
  /*
   * Mill Creek. Off the tee straight at a windmill standing across the
   * fairway: the only way on is the tunnel under it, and a sail across a
   * door shuts it, so the run through is timed. Out the far side the
   * fairway bends into a meadow, sand in its middle and a creek along its
   * top. Two ways over. On the right a footbridge, narrow and railed, into
   * the long way round: up the right side and over the top of a horseshoe
   * of green that circles a garden. On the left a ramp at the water's edge,
   * at the head of a pocket up the meadow's side: hit straight up it from the
   * pocket, hard enough and no harder, and the ball flies the creek and the
   * garden's foot and lands on the horseshoe's other leg, most of the long way
   * saved. Not quite hard enough and it lands in the bunker at the foot of the
   * leg; too hard and it flies off the top; crooked, off the side; too soft
   * and the creek has it. From the top of the
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
      // Where a jump that isn't quite right comes down.
      ribbon(8, [22, 396], [22, 420]),
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
  /*
   * Fountain Court. A formal garden laid out on one line. Off the tee up an
   * avenue with three stone planters set across it in turn, so there is no
   * straight way through. At its head a paved plaza that dishes down into
   * a fountain: a ball crossing it bends toward the basin, and one that
   * slows on it slides all the way in. Out of the plaza's far corners two
   * walks run either side of a long pool: the west walk has a rill down
   * part of its middle, a lane either side of it; the east walk has two more
   * planters to get round. They meet at the top of the pool, and a flight
   * of steps climbs to a terrace where the cup sits in the middle of a knot
   * garden, two rings of clipped hedge with their gaps lined up, toward the
   * steps and side to side: putt straight up through both from the head of
   * the steps, or across from either side. Inside the inner ring the ground
   * dishes gently down to the cup.
   */
  hole({
    name: 'Fountain Court',
    par: 7,
    theme: 'formal',
    h: 900,
    tee: { x: 50, y: 866 },
    cup: { x: 50, y: 150 },
    blend: 8,
    green: [
      disc(50, 862, 14),
      ribbon(15, [50, 862], [50, 760], [50, 596]),
      disc(50, 560, 38),
      ribbon(11, [27, 534], [18, 488], [18, 400], [24, 344]),
      ribbon(11, [73, 534], [82, 488], [82, 400], [76, 344]),
      ribbon(10, [24, 344], [50, 318], [76, 344]),
      ribbon(11, [50, 318], [50, 196]),
      disc(50, 150, 40),
    ],
    paving: [disc(50, 560, 38)],
    water: [disc(50, 560, 9), ribbon(1.6, [18, 462], [18, 430]), rect(37, 370, 26, 118)],
    slopes: [dish(disc(50, 560, 31), 38), hill(ribbon(11, [50, 300], [50, 214]), 0, 55, 'steps'), dish(disc(50, 150, 10), 24)],
    rocks: [
      rock(45, 790, 4.2, 'planter'),
      rock(56, 748, 4.2, 'planter'),
      rock(45, 706, 4.2, 'planter'),
      rock(77, 472, 3.8, 'planter'),
      rock(87, 424, 3.8, 'planter'),
    ],
    walls: [
      ...ring(50, 150, 22, 1.1, [
        [Math.PI, 13],
        [0, 13],
        [DOWN, 16],
      ]),
      ...ring(50, 150, 11.5, 1.1, [
        [Math.PI, 12],
        [0, 12],
        [DOWN, 10],
      ]),
    ],
    decor: [
      decor('fountain', 50, 560, 9),
      decor('bed', 22, 770, 3.4, DOWN, 70),
      decor('bed', 78, 770, 3.4, DOWN, 70),
      decor('urn', 33, 876, 1.9),
      decor('urn', 67, 876, 1.9),
      decor('urn', 36, 296, 1.9),
      decor('urn', 64, 296, 1.9),
      decor('bed', 50, 356, 2.6, 0, 20),
    ],
  }),
  /*
   * Castle Keep. Up a winding road to the moat, and over it by the
   * drawbridge, which is down a little more than half the time: roll onto
   * it while it is up and the moat has you. The portcullis in the gate
   * behind it is up while the bridge is down. Or, at the far left of the
   * bank and behind a boulder, a drain with a grate over it takes a ball
   * under the walls, no waiting, and lets it out at the foot of the bailey
   * rolling toward the quintain's side. Inside, the keep
   * stands in the middle and the way on is round it, past the well on the
   * left or past the quintain on the right, a beam that swings round on its
   * post. They meet behind the keep, and a lane runs up through the inner
   * wall, where a second portcullis keeps a time of its own, to the keep's
   * garden, where a turret stands between the way in and the cup. Past the
   * well, before the paths meet, a narrow postern runs up the inside of the
   * curtain wall, through the inner wall without a gate, and into the garden
   * off to the turret's side, with nothing between it and the cup.
   */
  hole({
    name: 'Castle Keep',
    par: 7,
    theme: 'castle',
    waterLook: 'moat',
    h: 920,
    tee: { x: 50, y: 888 },
    cup: { x: 50, y: 136 },
    blend: 9,
    green: [
      disc(50, 884, 14),
      ribbon(13, [50, 884], [46, 836], [32, 796], [30, 752], [42, 716], [50, 690]),
      ribbon(20, [18, 678], [50, 674], [82, 678]),
      ribbon(10, [10, 656], [90, 656]),
      capsule(50, 666, 50, 596, 5.2),
      ribbon(22, [28, 570], [50, 578], [72, 570]),
      ribbon(11, [26, 556], [19, 490], [21, 410], [30, 356]),
      ribbon(11, [74, 556], [81, 490], [79, 410], [70, 356]),
      ribbon(11, [30, 356], [50, 336], [70, 356]),
      ribbon(11, [50, 336], [50, 250], [50, 196]),
      // The postern.
      ribbon(6, [21, 410], [14, 362], [12, 300], [16, 236], [29, 190]),
      disc(50, 156, 34),
    ],
    water: [ribbon(8, [-12, 652], [30, 650], [70, 650], [112, 652]), disc(20, 470, 5.4)],
    drawbridges: [drawbridge(capsule(50, 666, 50, 636, 5.2), 6, 0.55)],
    gates: [gate(44.8, 608, 55.2, 608, 6, 0.55), gate(39.2, 300, 60.8, 300, 5, 0.5, 2.5)],
    portals: [pipe(12, 670, 18, 574, RIGHT, 'drain')],
    spinners: [beam(80, 470, 17, 1.5)],
    rocks: [rock(50, 166, 7, 'turret'), rock(22, 667, 4.2)],
    sand: [ribbon(4.5, [41, 804], [36, 776])],
    decor: [
      decor('keep', 50, 452, 13),
      decor('wall', -2, 608, 4, 0, 36),
      decor('wall', 66, 608, 4, 0, 36),
      decor('tower', 37, 608, 6.2),
      decor('tower', 63, 608, 6.2),
      decor('wall', -1, 604, 3, UP, 500),
      decor('wall', 101, 604, 3, UP, 500),
      // The inner wall, with the postern's opening in it on the left.
      decor('wall', -2, 294, 3, 0, 7),
      decor('wall', 19, 294, 3, 0, 21),
      decor('tower', 4, 294, 2.4),
      decor('tower', 20, 294, 2.4),
      decor('wall', 62, 294, 3, 0, 40),
      decor('tower', 39, 294, 4.6),
      decor('tower', 61, 294, 4.6),
      decor('wall', -2, 104, 4, 0, 104),
      decor('tower', 2, 104, 7),
      decor('tower', 98, 104, 7),
      decor('tower', 2, 608, 7),
      decor('tower', 98, 608, 7),
    ],
  }),
  /*
   * Lighthouse Point. Along a boardwalk by the sea, past a boulder and
   * where the sea washes in, to a lagoon, and over it by the sandbar, which
   * is dry while the tide is out and under when it comes back in, or by the
   * pier out on the right, narrow and always there, which runs on as a
   * boardwalk up the right of the beach, past everything on it, to the point.
   * Up the beach past two crabs scuttling back and forth across it and a
   * sandcastle in the middle, then out along the point, with a wind off the
   * sea that leans a rolling ball toward a cove biting into its side, to a
   * green at the foot of the lighthouse with a cove biting into it downwind.
   */
  hole({
    name: 'Lighthouse Point',
    par: 7,
    theme: 'coast',
    waterLook: 'sea',
    h: 920,
    tee: { x: 60, y: 886 },
    cup: { x: 60, y: 116 },
    blend: 9,
    green: [
      disc(60, 882, 14),
      ribbon(13, [60, 882], [62, 820], [58, 760], [52, 716]),
      ribbon(18, [30, 700], [56, 696], [84, 700]),
      ribbon(10, [22, 670], [88, 670]),
      capsule(46, 692, 46, 628, 6),
      capsule(82, 696, 82, 626, 4.2),
      ribbon(24, [44, 616], [60, 606], [82, 614]),
      ribbon(24, [52, 600], [50, 520], [50, 452]),
      // The boardwalk, on from the pier, far enough off the beach to stay its own way.
      ribbon(5, [82, 624], [90, 590], [92, 530], [90, 484], [80, 454], [64, 438]),
      ribbon(13, [50, 452], [64, 410], [68, 360], [54, 312], [46, 262], [56, 214], [62, 170], [60, 136]),
      disc(60, 124, 30),
    ],
    water: [
      ribbon(22, [-16, 940], [0, 850], [6, 770], [-4, 700], [-6, 600], [0, 480], [6, 380], [10, 300], [4, 200], [-8, 120], [-16, 60]),
      ribbon(9, [-12, 660], [20, 658], [50, 660], [80, 662], [112, 658]),
      ribbon(20, [118, 470], [108, 380], [104, 300], [110, 200], [118, 120]),
      ribbon(22, [-16, 28], [50, 12], [116, 28]),
      // The sea washing into the boardwalk.
      disc(44, 792, 7),
      // Coves off the point downwind, one biting into it, and one biting into the green.
      disc(47, 366, 8.5),
      disc(29, 262, 7),
      disc(31, 112, 6),
    ],
    drawbridges: [drawbridge(capsule(46, 692, 46, 628, 6), 7, 0.55, 'sandbar')],
    bridges: [capsule(82, 696, 82, 626, 4.2)],
    rovers: [crab(40, 560, 24, 0, box(27, 552, 48, 16)), crab(64, 494, 30, Math.PI, box(27, 486, 48, 16))],
    rocks: [rock(50, 527, 5, 'sandcastle'), rock(66, 752, 3.4)],
    slopes: [hill(ribbon(17, [58, 430], [68, 360], [54, 312], [46, 262], [56, 214]), -36, 0, 'wind'), hill(disc(60, 124, 31), -12, 0, 'wind')],
    decor: [
      decor('lighthouse', 24, 78, 9),
      decor('boat', 8, 300, 5, -0.6),
      decor('boat', 94, 250, 4.5, 2.3),
      decor('boat', 30, 22, 5, 0.2),
      decor('umbrella', 80, 566, 3.2),
      decor('umbrella', 80, 506, 3),
      decor('umbrella', 84, 780, 3.4),
    ],
  }),
  /*
   * The Summit. Up the mountainside by three switchbacks on a slope that
   * leans every roll toward the valley, so each leg is aimed uphill of
   * where it needs to go. At the top of them a ledge, and a drop right
   * across the mountain. Two ways over, both of them skill: the ramp in the
   * middle of the ledge, hit hard enough and straight, or the cave at its far
   * left end, a small mouth to find, which comes out on the far side heading
   * up the path. Up beside the falls, past two boulders, and a flight of steps
   * to the summit, a broad flat top with a mound in the middle, and the cup
   * on the mound's own flat top: short, and the ball rolls back down; long,
   * and it runs over the top and down the far side. Only a ball that arrives
   * just so stays up there.
   */
  hole({
    name: 'The Summit',
    par: 7,
    theme: 'summit',
    h: 960,
    tee: { x: 46, y: 928 },
    cup: { x: 50, y: 120 },
    blend: 9,
    green: [
      disc(46, 924, 14),
      ribbon(
        12.5,
        [46, 924],
        [60, 902],
        [76, 870],
        [80, 842],
        [66, 822],
        [40, 806],
        [22, 782],
        [20, 754],
        [34, 734],
        [62, 716],
        [78, 692],
        [76, 662],
        [62, 640],
        [58, 614],
      ),
      ribbon(14, [22, 612], [50, 606], [80, 612]),
      // The ledge and the far side both run on over the edge, so a ball that is not stopped goes down.
      ribbon(8, [18, 589], [30, 588], [70, 592], [84, 589]),
      ribbon(18, [26, 550], [50, 544], [74, 550]),
      ribbon(8, [18, 566], [30, 565], [70, 569], [84, 566]),
      ribbon(12, [50, 540], [42, 480], [34, 424], [40, 372], [54, 332]),
      ribbon(12, [54, 332], [58, 270], [50, 210], [50, 170]),
      // The summit: nearly the width of the mountain, flat round a mound in its middle.
      disc(50, 124, 47),
    ],
    pits: [ribbon(9, [-12, 580], [30, 576], [70, 580], [112, 574])],
    water: [ribbon(4, [112, 300], [94, 340], [92, 420], [93, 500], [92, 552], [88, 572]), ribbon(12, [-16, 960], [4, 930], [10, 890])],
    ramps: [ramp(44, 600, 12, 10, UP, 58, 115)],
    portals: [pipe(14, 604, 34, 538, -Math.PI / 3, 'cave')],
    slopes: [hill(rect(0, 630, 100, 310), 0, 16), hill(ribbon(12, [58, 300], [50, 214]), 0, 50, 'steps'), hilltop(50, 120, 15, 32, 50)],
    rocks: [rock(40, 452, 4), rock(46, 396, 3.6)],
    decor: [decor('waterfall', 88, 566, 4, DOWN)],
  }),
]

export const COURSE_PAR = COURSE.reduce((sum, h) => sum + h.par, 0)
