/*
 * The course, the same every round, so a score means the same thing to
 * everyone on the board: five short holes, each somewhere of its own and each
 * with one thing to play past, a jump, pipes, a windmill, a loop and a
 * volcano. Every hole has a shot that holes out in one, and a surer way
 * round that takes two or three.
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
   * A bank is a ramp's even tilt with no arrows on it, for a rise too short to
   * need them. A hilltop can be a volcano's cone, rock falling away all round
   * from the rim of its crater.
   */
  look?: 'hill' | 'steps' | 'wind' | 'ramp' | 'bank' | 'cone'
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

/**
 * A loop-the-loop: a ring of track standing beside the lane, meeting it at
 * (x, y). A ball rolling up the lane along `dir` at least `min` fast runs
 * off into the ring there, round it, and back onto the lane `span` further
 * on, heading the way it was and keeping `keep` of its speed. Any slower and
 * it runs part way round, comes back, and rolls back down the lane. `r` is
 * the ring's radius to the middle of its track, `side` which side of the
 * lane it stands (1 on the right going along `dir`, -1 on the left), and `w`
 * how wide the track is: where the ring meets it, the lane is that wide.
 */
export type Loop = { x: number; y: number; dir: number; r: number; side: 1 | -1; min: number; keep: number; span: number; w: number }

/** A mark on the ground: a chevron at (x, y) pointing along `dir`, a hint and nothing more. */
export type Mark = { x: number; y: number; dir: number }

/** A boulder on the green, or something else round that stands there and stops the ball the same way. */
export type Rock = Bumper & { look?: 'boulder' | 'planter' | 'sandcastle' | 'turret' }

/** Where a hole is: what its rails are made of, the ground round it, and what grows there. */
export type Theme = 'garden' | 'formal' | 'castle' | 'coast' | 'summit' | 'volcano'

/**
 * What a hole's water looks like: a stream, a moat between stone walls, the
 * sea, or lava, which costs a stroke the same.
 */
export type WaterLook = 'creek' | 'moat' | 'sea' | 'lava'

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
  loops: Loop[]
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

function decor(kind: Decor['kind'], x: number, y: number, r: number, angle?: number, len?: number): Decor {
  return { kind, x, y, r, angle, len }
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
    loops: spec.loops ?? [],
    rovers: spec.rovers ?? [],
    marks: spec.marks ?? [],
    decor: spec.decor ?? [],
  }
}

/** A loop-the-loop beside the lane, meeting it at (x, y): see Loop. */
function loop(x: number, y: number, dir: number, r: number, side: 1 | -1, min: number, keep: number, span = 6, w = 9): Loop {
  return { x, y, dir, r, side, min, keep, span, w }
}

export const COURSE: Hole[] = [
  /*
   * Over the Wall. A round garden inside a clipped hedge, the cup in it
   * inside a ring of sand, and a ramp on the lawn in front of the hedge: jump
   * the hedge. The tee is off to the right, so the ball comes to the ramp at a
   * slant and flies on a little to the left of where it crossed it: to come
   * down on the turf round the cup, it has to cross the ramp just so. Only
   * just hard enough to take off, and it drops on the turf and runs in; a
   * touch harder, or off line, and it comes down in the sand; much harder,
   * it flies the garden and is out of bounds; too soft and it never leaves
   * the ramp, and the hedge sends it back. Or go round by the path up the
   * left, the long way to the gate in the hedge's back corner, where the sand
   * opens, and putt in through it: sure, and a stroke more.
   */
  hole({
    name: 'Over the Wall',
    par: 2,
    theme: 'formal',
    h: 200,
    tee: { x: 76, y: 184 },
    cup: { x: 54, y: 56 },
    blend: 9,
    green: [
      disc(76, 182, 12),
      // The lawn, bending up from the tee to its hedge.
      ribbon(14, [76, 182], [70, 160], [62, 140], [57, 122], [56, 104]),
      // The garden in its own hedge, a gravel walk between it and the lawn's.
      disc(54, 56, 22),
      // The path round the left, clear of the garden's hedge until it comes in at the gate.
      ribbon(9, [46, 126], [28, 104], [17, 76], [19, 50], [28, 35]),
      capsule(28, 36, 37, 43, 5),
    ],
    ramps: [ramp(51, 116, 10, 8, UP, 76, 60, 2.2, 0.3)],
    // The lawn rises to its hedge, and nothing rests on the rise: a ball that never took off, or came back
    // off the hedge, rolls back down past the ramp for another run at it.
    slopes: [{ ...hill(rect(45, 92, 23, 24), 0, 24, 'bank'), slick: true }],
    // Round the cup, a ring of sand, open only toward the gate: a jump that comes down short of the cup or
    // past it, or off to the side, stops in it.
    sand: [arc(54, 56, 11, -1.75, 3.25, 5.5)],
    decor: [
      decor('bed', 88, 150, 3, DOWN, 30),
      decor('bed', 40, 166, 3, DOWN, 26),
    ],
  }),
  /*
   * Three Pipes, a bank shot twice over, in an old garden's waterworks. The
   * tee sits at the foot of a lane up the right-hand side; the lane's head is
   * cut across by a wall at a slant, which turns the ball left along a
   * gallery, and in the paved floor at the gallery's far end three pipes
   * open, evenly one above another, small enough to miss, and a ball going
   * too fast runs over them. Which one the ball finds depends on how it came
   * off the wall. Blue, in the middle, is where a shot straight up the lane
   * goes: its pipe climbs to the foot of the terrace above and lets the ball
   * out there, as far from the cup as the terrace goes. The terrace is an L,
   * up the left side and across the top to a round green where the cup is,
   * with its corner cut across at a slant like the one below: the corner
   * stands between the ball and the cup, so from blue it is a bank shot off
   * that wall to hole out in two. Gold, the bottom one, takes a shot a touch
   * right of straight and little else: its pipe crosses the garden and comes
   * up in the round green beside the cup, pointing at it, and the ball drops.
   * Red, the top one, catches a shot pulled left and much of the ceiling's
   * bounce; its pipe runs down the garden and round to the tee. The gallery
   * runs downhill, so a ball that finds none of them rolls back out of it to
   * the lane. The pipes are the only way up to the terrace.
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
   * The Windmill. It stands across the lawn, and the way straight to the cup
   * is the tunnel through its tower, which runs at a slant, on the line from
   * the tee off to the right to the cup off to the left: in one door and out
   * the other, the line has to be just right, or the ball catches the
   * tunnel's side. The sails sweep down past both doors, and a door is shut
   * while a sail is across it, so the putt is timed as well; one that gets
   * there as a sail comes down thuds off it and comes back. Too hard and it
   * runs past the cup into the bunker. Or go round the tower, either side, by
   * the narrow way between it and the rail: no sails to wait for, and a
   * longer way to the cup.
   */
  hole({
    name: 'The Windmill',
    par: 2,
    h: 220,
    tee: { x: 74, y: 203 },
    cup: { x: 39, y: 72 },
    blend: 9,
    green: [
      disc(74, 201, 12),
      ribbon(14, [74, 201], [66, 170], [59, 146]),
      // The mill's yard, the tower in its middle and a narrow way round it either side.
      disc(52, 120, 25),
      // The green beyond, off up the tunnel's line.
      disc(40, 70, 27),
    ],
    // The tunnel runs at a slant, on the line from the tee to the cup.
    mills: [mill(52, 120, 17, UP - 0.26, 1.2)],
    // Behind the cup, deep enough that a putt out of the tunnel with too much on it stays there.
    sand: [arc(40, 70, 21, -2.75, -0.85, 6)],
    decor: [
      decor('flowers', 50, 190, 3),
      decor('flowers', 90, 168, 2.8),
      decor('bush', 28, 150, 3.2),
      decor('blossom', 84, 110, 5.5),
      decor('flowers', 76, 60, 2.6),
    ],
  }),
  /*
   * Loop-the-Loop. The whole hole runs on a slant, up and to the right from a
   * tee in the corner: a lane that narrows to a single track, and on it a
   * loop. A ball rolling up the track fast enough runs off round the ring on
   * the right and back onto the track past where it went in, heading the way
   * it came in with half of any angle taken out, into the green with the cup
   * ahead: on the line, it's in. Not fast enough and it runs part way round,
   * comes back, and rolls back down the lane; too fast and it comes out of
   * the loop with plenty left, past the cup and into the bunker behind it.
   * Or take the path round the left, the long way up, without the loop.
   */
  hole({
    name: 'Loop-the-Loop',
    par: 2,
    h: 230,
    tee: { x: 32, y: 212 },
    cup: { x: 63.7, y: 63.3 },
    blend: 9,
    green: [
      disc(32, 210, 12),
      ribbon(12, [32, 210], [42.8, 161.1]),
      // The track, one ball wide and a little more, through the loop and on to the green, all on the slant.
      capsule(41.6, 167.0, 58.3, 88.8, 4.5),
      disc(62.9, 67.3, 25),
      // The path round the left.
      ribbon(8, [34.3, 172.9], [18, 150], [14, 116], [20, 86], [40.9, 73.3]),
    ],
    loops: [loop(51.2, 122.0, UP + 0.21, 14, 1, 110, 0.85)],
    // Behind the cup, deep enough that a ball out of the loop with too much on it stays there, and doesn't
    // come back off the rail to the cup.
    sand: [arc(62.9, 67.3, 19.5, UP + 0.21 - 0.95, UP + 0.21 + 0.95, 5.5)],
    decor: [
      decor('flowers', 62, 196, 3),
      decor('bush', 76, 176, 3.2),
      decor('blossom', 90, 150, 5.5),
      decor('flowers', 8, 196, 2.6),
    ],
  }),
  /*
   * Volcano. The cup is in its crater, on the flat floor at the top of the
   * cone, and the tee is off to the left, so the putt goes up the lawn and
   * the cone at a slant. Too soft and the ball runs up and rolls back down;
   * just right and it comes over the rim onto the floor of the crater and
   * stops there, or in the cup, if it was dead on line: the cone turns away
   * anything that isn't. Firm, and it crosses the crater and runs down the
   * far side into the ash, or on into the lava if it is really moving.
   */
  hole({
    name: 'Volcano',
    par: 2,
    theme: 'volcano',
    waterLook: 'lava',
    h: 230,
    tee: { x: 22, y: 208 },
    cup: { x: 50, y: 80 },
    blend: 9,
    green: [
      disc(22, 206, 12),
      // The lawn, up from the tee off to one side toward the foot of the cone.
      ribbon(14, [22, 206], [29, 172], [39, 128]),
      // The volcano, with the ash and the lava behind it on the same ground.
      disc(50, 80, 49),
    ],
    // The cone, and the crater's floor falling gently to its middle, where the cup is.
    slopes: [{ ...hilltop(50, 80, 11, 30, 46), look: 'cone' }],
    water: [
      // Behind, past the ash, up to the rail: only a ball that crossed the crater really moving gets there.
      arc(50, 80, 46.8, -Math.PI + 0.45, -0.45, 2.4),
      // Round the island, off the course.
      ribbon(9, [-12, 150], [-4, 110], [-6, 70], [0, 30], [26, -4], [74, -4], [100, 30], [106, 70], [104, 110], [112, 150]),
    ],
    // At the cone's foot behind, where a ball over the crater comes down: deep enough to stop most of them.
    sand: [arc(50, 80, 38.5, -Math.PI + 0.3, -0.3, 6)],
    decor: [
      decor('palm', 52, 186, 7),
      decor('palm', 84, 176, 6.5),
      decor('palm', 80, 140, 6),
      decor('palm', 6, 150, 6.5),
    ],
  }),
]

export const COURSE_PAR = COURSE.reduce((sum, h) => sum + h.par, 0)
