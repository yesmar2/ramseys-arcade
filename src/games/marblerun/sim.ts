/**
 * Marble Run without the pictures: the course, the ball, the clock, and a driver who knows the way down.
 *
 * A course is laid like a road: pieces of track one after another, straight or curved, each with its own
 * width, slope, bank and bumps, hanging in the dark. Tilt the world and the ball rolls the way it leans.
 * Roll off an edge and it's gone: you start again from the last checkpoint, and the clock keeps running
 * while you do.
 *
 * x and z run across the ground and y is up. A heading h points along (cos h, sin h) in (x, z); across a
 * piece, v is measured to the right of that, along (−sin h, cos h).
 *
 * No imports, so a script can run this with plain Node (scripts/marblerun-daily.mjs plans the days with it).
 * The courses a day is laid from depend on everything here: once a day is planned, changing the generator
 * or the physics changes that day's course, so don't, for days people have played.
 */

export const G = 9.81
/** A rolling ball feels 5/7 of any pull along the ground; the rest goes into spinning it. */
export const ROLL = 5 / 7
export const BALL_R = 0.5
export const DT = 1 / 240
/** The steepest the world tilts, as the sine of the angle: about 21°. */
export const TILT_MAX = 0.36
/** Rolling drag, as a share of the ball's weight on the track, and the air's, × speed². */
export const ROLLING = 0.012
export const AIR = 0.0021
/** Rails stand this high and this thick; a ball keeps this much of its speed into one. */
export const RAIL_H = 0.55
export const RAIL_T = 0.06
export const RAIL_E = 0.4
export const POST_E = 0.55
/** Landing faster than this (m/s into the track), the ball bounces, keeping this much of it. */
export const HARD_LANDING = 1.8
export const LAND_E = 0.3
/** A ghost keeps where the ball was every this many steps: 30 times a second. */
export const GHOST_EVERY = 8
/** Ghost samples a second. */
export const GHOST_RATE = 1 / (DT * GHOST_EVERY)

/* The new pieces' figures (labCourse). */
/** A boost pad pushes the ball down the track this hard, in m/s², easing off over BOOST_EASE m/s below BOOST_TOP. */
export const BOOST_PUSH = 18
export const BOOST_TOP = 21
const BOOST_EASE = 5
/** Mud's rolling drag (the track's is ROLLING), and how much more it holds a faster ball, × its speed. */
export const MUD_ROLLING = 0.15
export const MUD_STICK = 0.4
/** On ice the tilt moves the ball this share as much, its rolling drag is this, and the turning isn't helped. */
export const ICE_GRIP = 1 / 3
export const ICE_ROLLING = 0.004
/**
 * A bumper sends the ball away this many times as fast as it came, and never slower than BUMPER_KICK m/s; but
 * never faster than BUMPER_BACK back up the track, the rest of the kick going across instead.
 */
export const BUMPER_E = 1.3
export const BUMPER_KICK = 7
export const BUMPER_BACK = 2.5
export const BUMPER_H = 0.9
/**
 * Off a hammer or an arm the ball keeps this much of its speed into it, with the mover's own speed on top; one
 * swinging into it knocks it at least KNOCK m/s away.
 */
export const MOVER_E = 0.5
export const KNOCK = 5
/** A hammer's head: its radius, and half its length, which lies along the track; at the bottom of its swing it clears the track by HAMMER_CLEAR. */
export const HAMMER_R = 0.5
export const HAMMER_HALF = 0.8
export const HAMMER_CLEAR = 0.12
/** An arm's bar: its radius and its height over the track; and its post's radius and height. */
export const ARM_R = 0.28
export const ARM_Y = 0.5
export const HUB_R = 0.4
export const HUB_H = 1.3

const TAU = Math.PI * 2
/** Which way is up off a level slab. */
const LEVEL = [0, 1, 0] as const
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const smooth01 = (t: number) => {
  const k = clamp(t, 0, 1)
  return k * k * (3 - 2 * k)
}

/* ------------------------------------------------------------------ random --- */

export function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ pieces --- */

export type Feature = 'sweeper' | 'hairpin' | 'esses' | 'narrow' | 'drop' | 'rollers' | 'posts' | 'chute' | 'jump' | PieceKind

/**
 * The test track's pieces as stretches of a day's course (PIECES), from PIECES_FROM on: boost pads and mud,
 * bumpers, hammers, a windmill, a moving platform, an iced turn, a fork and a loop.
 */
export type PieceKind = 'pads' | 'bumpers' | 'hammers' | 'windmill' | 'platform' | 'ice' | 'fork' | 'loop'

/** The stretches every course is made of (FEATURES). */
type BaseFeature = Exclude<Feature, PieceKind>

/** Rollers across a piece: humps `a` high, a `wave` apart, slanted by `k` metres along for each across. */
export type Rollers = { a: number; wave: number; k: number }

/*
 * The new pieces (2026-10-06, on the test track first, labCourse; in the day's courses from PIECES_FROM on). A
 * piece or a course without their fields rolls exactly as before, so the courses planned before them lay and
 * roll the same to the bit.
 */

/** A patch of track that rolls differently: `u0`..`u1` along its piece and `v0`..`v1` across it (all of it, unsaid). */
export type Zone = { kind: 'boost' | 'mud' | 'ice'; u0: number; u1: number; v0?: number; v1?: number }

/**
 * Something that moves on the run's own clock (Ball `t`, which a fall doesn't stop). A hammer hangs from an axle
 * over the middle of the track `u` along, on an arm `arm` long, and swings across it, `swing` radians either way
 * of straight down, there and back every `period` seconds. An arm is a bar turning round a post at `u`, `v`,
 * `reach` out one way and `back` the other (0: from the post), a turn every `period` seconds (less than 0, the
 * other way round). `phase` is where it is at the start, in radians of its cycle.
 */
export type MoverSpec =
  | { kind: 'hammer'; u: number; arm: number; swing: number; period: number; phase?: number }
  | { kind: 'arm'; u: number; v: number; reach: number; back?: number; period: number; phase?: number }

/**
 * A slab moving to and fro in a gap, to ride over it: its middle at `u`, `v` goes `du`, `dv` either way of there,
 * there and back every `period` seconds, resting at each end for `rest` of that and easing between. It's `len`
 * long and `w` wide, level with the gap's start. `phase` is where in its cycle it starts, in radians (0: just
 * come to rest at the near end).
 */
export type PlatformSpec = { u: number; v?: number; du?: number; dv?: number; len: number; w: number; period: number; rest?: number; phase?: number }

/** No track over a band of a piece, `v0`..`v1` across and `u0`..`u1` along; a rail along either edge, on the track's side. */
export type Hole = { u0: number; u1: number; v0: number; v1: number; railV0?: boolean; railV1?: boolean }

/** What a piece is to be, before it's laid. */
export type Spec = {
  /** A loop goes up and round, `R` its radius, coming out `shift` to the right of where it went in. */
  kind?: 'line' | 'arc' | 'loop'
  /** A line's length. */
  len?: number
  /** An arc's radius, and how far it turns, in radians, right positive. */
  R?: number
  turn?: number
  /** The width at its end, and at its start (the last piece's end, unless said). */
  w?: number
  w0?: number
  /** How far it falls or climbs, the slope it starts on (after a gap) and the slope it ends on. */
  dy?: number
  m0?: number
  mEnd?: number
  /** A banked curve's rise across it, per metre, on the outside. */
  bank?: number
  /** A bowl or a chute: raised on both sides, by this × the distance from the middle, squared. */
  pipe?: number
  rollers?: Rollers
  posts?: readonly { u: number; v: number; r: number }[]
  railL?: boolean
  railR?: boolean
  /** No track at all: a jump's gap. */
  gap?: boolean
  kicker?: boolean
  landing?: boolean
  narrow?: boolean
  /** A checkpoint at its start. */
  cp?: boolean
  /** The goal, `goalU` along it. */
  goal?: boolean
  goalU?: number
  wallStart?: boolean
  wallEnd?: boolean
  start?: boolean
  feature?: Feature
  /** Boost pads, mud and ice on it. */
  zones?: readonly Zone[]
  /** Pinball bumpers: posts that kick the ball away harder than it came. */
  bumpers?: readonly { u: number; v: number; r: number }[]
  /** Hammers and arms, moving on the run's clock. */
  movers?: readonly MoverSpec[]
  /** A gap's moving slabs, to ride over it. */
  platforms?: readonly PlatformSpec[]
  /** A void through it, between a fork's two lanes. */
  hole?: Hole
  /** A loop's way out, this far to the right of its way in. */
  shift?: number
  /** The line across it the pace ball keeps to (racingPlan), clear of its bumpers or wide of a windmill's post. */
  lane?: number
}

/** A piece of track, laid. */
export type Piece = Spec & {
  kind: 'line' | 'arc' | 'loop'
  len: number
  index: number
  /** Where it starts, the way it heads there, its height and slope there, and how far along the course. */
  x0: number
  z0: number
  h0: number
  y0: number
  m0: number
  d0: number
  /** Its height and slope at its end, and its widths. */
  y1: number
  m1: number
  w0: number
  w1: number
  dy: number
  /** An arc's turn (1 right, −1 left), its middle, and the angle its start is at round that. */
  s: number
  cx: number
  cz: number
  phi0: number
  /** Where it lies on the ground, give or take a ball: [x0, x1, z0, z1]. */
  box: [number, number, number, number]
  /** A loop's way round: how far the ball has rolled at each of LOOP_STEPS even steps of its turn. */
  round?: Float64Array
}

/** Where a point lies on a piece: `u` along it and `v` across it (right of its middle). */
export type Local = { u: number; v: number }
/** Track under a point, and how high it is there; or a moving slab (`plat`) in a gap, the gap's piece as `p`. */
export type Surface = { p: Piece; u: number; v: number; y: number; plat?: Platform }
export type Post = { p: Piece; u: number; v: number; r: number; x: number; z: number; y: number; h: number }
/** A bumper, laid: a post that kicks. */
export type Bumper = Post
/** A hammer or an arm, laid: its pivot on the ground and in height, the track's heading there, and its MoverSpec's figures. */
export type Mover = {
  kind: 'hammer' | 'arm'
  p: Piece
  /** How far along its piece it is. */
  u: number
  x: number
  y: number
  z: number
  /** The track's height under the pivot. */
  ground: number
  h: number
  arm: number
  swing: number
  reach: number
  back: number
  period: number
  phase: number
}
/** A moving slab, laid: its middle at rest, how far it goes either way, the way it lies, its half length and width, and its top. */
export type Platform = {
  p: Piece
  x: number
  z: number
  dx: number
  dz: number
  h: number
  hl: number
  hw: number
  y: number
  period: number
  rest: number
  phase: number
}
/** The new pieces' lookups, on a course that has any (labCourse): every other course has none. */
export type Extras = { bumpers: Bumper[]; movers: Mover[]; platforms: Platform[]; loops: Piece[]; holes: Piece[] }
export type Wall = { p: Piece; u: number; dir: 1 | -1 }
/** A checkpoint or the goal: a line across a piece, `u` along it. */
export type Line = { p: Piece; u: number; d: number; spawn?: number; goal?: boolean }
/** Where a ball starts, or starts again: the start, then each checkpoint. */
export type Spawn = { p: Piece; u: number; x: number; z: number; y: number; h: number; d: number; next: number }

export type Course = {
  key: string
  name: string
  order: readonly Feature[]
  pieces: Piece[]
  solid: Piece[]
  railed: Piece[]
  posts: Post[]
  walls: Wall[]
  lines: Line[]
  spawns: Spawn[]
  minY: number
  maxY: number
  box: [number, number, number, number]
  length: number
  /** Bumpers, hammers and arms, slabs, loops and forks: only a course with any has these. */
  extras?: Extras
}

/** Where a piece's middle heads, `u` metres along it. */
export function headingAt(p: Piece, u: number): number {
  return p.kind === 'arc' ? p.h0 + (p.s * u) / p.R! : p.h0
}

/** The ground-plane point `u` along a piece and `v` to the right of its middle. */
export function point(p: Piece, u: number, v: number): [number, number] {
  if (p.kind === 'arc') {
    const phi = p.phi0 + (p.s * u) / p.R!
    const h = p.h0 + (p.s * u) / p.R!
    return [p.cx + p.R! * Math.cos(phi) - v * Math.sin(h), p.cz + p.R! * Math.sin(phi) + v * Math.cos(h)]
  }
  if (p.kind === 'loop') {
    // Under the loop's track `u` round it: ahead of its mouth and back, drifting right as it goes round.
    const th = loopTheta(p, u)
    const ahead = p.R! * Math.sin(th)
    const side = loopSide(p, th)[0] + v
    const c = Math.cos(p.h0)
    const s = Math.sin(p.h0)
    return [p.x0 + ahead * c - side * s, p.z0 + ahead * s + side * c]
  }
  const c = Math.cos(p.h0)
  const s = Math.sin(p.h0)
  return [p.x0 + u * c - v * s, p.z0 + u * s + v * c]
}

/** How far along a piece a ground-plane point is, and how far to the right of its middle. */
export function local(p: Piece, x: number, z: number): Local {
  if (p.kind === 'arc') {
    const dx = x - p.cx
    const dz = z - p.cz
    let a = p.s * (Math.atan2(dz, dx) - p.phi0)
    a = ((a % TAU) + TAU) % TAU
    const span = p.len / p.R!
    // The part of the circle the arc doesn't cover belongs half to before it and half to after.
    if (a > span + (TAU - span) / 2) a -= TAU
    return { u: a * p.R!, v: p.s * (p.R! - Math.hypot(dx, dz)) }
  }
  const c = Math.cos(p.h0)
  const s = Math.sin(p.h0)
  const dx = x - p.x0
  const dz = z - p.z0
  return { u: dx * c + dz * s, v: -dx * s + dz * c }
}

export function halfWidth(p: Piece, u: number): number {
  return (p.w0 + (p.w1 - p.w0) * smooth01(u / p.len)) / 2
}

/** 0 at a piece's ends, 1 through its middle: banks, bowls and bumps fade in and out so pieces meet flat. */
export function ease(p: Piece, u: number): number {
  const a = Math.min(p.len / 3, 5)
  return smooth01(u / a) * smooth01((p.len - u) / a)
}

function hermite(y0: number, d0: number, y1: number, d1: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * d0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * d1
}

/** The track's height at `u` along a piece and `v` across it. Past the ends it carries on at the end's slope. */
export function heightAt(p: Piece, u: number, v: number): number {
  // A loop's track, `u` round it, all the way up and over.
  if (p.kind === 'loop') return p.y0 + p.R! * (1 - Math.cos(loopTheta(p, u)))
  let y: number
  if (u <= 0) y = p.y0 + p.m0 * u
  else if (u >= p.len) y = p.y1 + p.m1 * (u - p.len)
  else y = hermite(p.y0, p.m0 * p.len, p.y1, p.m1 * p.len, u / p.len)
  if (p.bank || p.pipe || p.rollers) {
    const e = ease(p, clamp(u, 0, p.len))
    // A banked curve is raised on its outside.
    if (p.bank) y -= p.s * p.bank * e * v
    // A bowl or a chute is raised on both sides.
    if (p.pipe) y += p.pipe * e * v * v
    if (p.rollers) {
      const r = p.rollers
      const q = Math.sin((Math.PI * (u + r.k * v)) / r.wave)
      y += r.a * e * q * q
    }
  }
  return y
}

/** Which way is up off a piece's track at a ground-plane point. */
export function normalAt(p: Piece, x: number, z: number): [number, number, number] {
  const e = 0.02
  const h = (xx: number, zz: number) => {
    const l = local(p, xx, zz)
    return heightAt(p, l.u, l.v)
  }
  const gx = (h(x + e, z) - h(x - e, z)) / (2 * e)
  const gz = (h(x, z + e) - h(x, z - e)) / (2 * e)
  const inv = 1 / Math.hypot(gx, 1, gz)
  return [-gx * inv, inv, -gz * inv]
}

/** The highest track under a ground-plane point that isn't above `below`, or null over the void. */
export function surfaceAt(course: Course, x: number, z: number, below = Infinity): Surface | null {
  let best: Surface | null = null
  for (const p of course.solid) {
    const b = p.box
    if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue
    const l = local(p, x, z)
    if (l.u < -0.02 || l.u > p.len + 0.02) continue
    const u = clamp(l.u, 0, p.len)
    if (Math.abs(l.v) > halfWidth(p, u)) continue
    // A fork's hole is the void, as off the edge.
    if (p.hole && inHole(p.hole, l.u, l.v)) continue
    const y = heightAt(p, u, l.v)
    if (y > below) continue
    if (!best || y > best.y) best = { p, u: l.u, v: l.v, y }
  }
  return best
}

/** Whether a point `u` along a piece and `v` across it is over its hole. */
function inHole(h: Hole, u: number, v: number): boolean {
  return u > h.u0 && u < h.u1 && v > h.v0 && v < h.v1
}

/* ------------------------------------------------------------------- loops --- */

/** A loop's way round is kept at this many even steps of its turn. */
const LOOP_STEPS = 512
/** A loop's mouth, either end, is as wide as the track it meets, narrowing to the loop's own width over this far. */
const LOOP_MOUTH = 3.5
/** A ball that came into a loop off its middle eases into the middle over this far. */
const LOOP_SETTLE = 6

/** How far a ball's middle has rolled round a loop of radius `R` coming out `shift` to the right, at each step of its turn. */
function loopRound(R: number, shift: number): Float64Array {
  const r = R - BALL_R
  const k = shift / TAU
  const rate = (th: number) => Math.hypot(r, k * (1 - Math.cos(th)))
  const d = TAU / LOOP_STEPS
  const out = new Float64Array(LOOP_STEPS + 1)
  // Simpson's rule over each step.
  for (let i = 1; i <= LOOP_STEPS; i++) out[i] = out[i - 1]! + (d / 6) * (rate((i - 1) * d) + 4 * rate((i - 0.5) * d) + rate(i * d))
  return out
}

/** How far round its turn a loop is `u` in, in radians: 0 at the bottom going in, 2π coming out. */
export function loopTheta(p: Piece, u: number): number {
  const t = p.round!
  if (u <= 0) return 0
  if (u >= p.len) return TAU
  let lo = 0
  let hi = LOOP_STEPS
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (t[mid]! <= u) lo = mid
    else hi = mid
  }
  return ((lo + (u - t[lo]!) / (t[hi]! - t[lo]!)) * TAU) / LOOP_STEPS
}

/** A loop's drift to the right `th` round it, and how fast that grows with the turn: none at either end, so it meets its track square. */
function loopSide(p: Piece, th: number): [number, number] {
  const k = (p.shift ?? 0) / TAU
  return [k * (th - Math.sin(th)), k * (1 - Math.cos(th))]
}

/** A loop's half width `u` round it: its mouth's at either end, its own between. */
export function loopHalfWidth(p: Piece, u: number): number {
  const k = smooth01(Math.min(u, p.len - u) / LOOP_MOUTH)
  return (p.w0 + (p.w1 - p.w0) * k) / 2
}

/** The ball's middle `u` round a loop and `v` across it, the way round there (a unit vector), and the turn there in radians. */
function loopBall(p: Piece, u: number, v: number) {
  const r = p.R! - BALL_R
  const th = loopTheta(p, u)
  const [side, drift] = loopSide(p, th)
  const ct = Math.cos(th)
  const st = Math.sin(th)
  const c = Math.cos(p.h0)
  const s = Math.sin(p.h0)
  const ahead = r * st
  const across = side + v
  const m = Math.hypot(r, drift)
  return {
    x: p.x0 + ahead * c - across * s,
    y: p.y0 + p.R! - r * ct,
    z: p.z0 + ahead * s + across * c,
    tx: (r * ct * c - drift * s) / m,
    ty: (r * st) / m,
    tz: (r * ct * s + drift * c) / m,
    th,
  }
}

/* ------------------------------------------------------------ laying a course --- */

const specLen = (s: Spec) => (s.kind === 'arc' ? s.R! * Math.abs(s.turn!) : s.len!)

/**
 * Lay pieces one after another from their specs. Each piece starts where the last one ended, heading the
 * same way, at the same height and slope, so the track is one smooth ribbon.
 */
export function layPieces(specs: readonly Spec[], start = { x: 0, z: 0, h: -Math.PI / 2, y: 0 }): Piece[] {
  const pieces: Piece[] = []
  let { x, z, h, y } = start
  let m = 0
  let d = 0
  let w = specs[0]?.w0 ?? specs[0]?.w ?? 6
  const slopeOf = (s: Spec | undefined) => (s && !s.gap ? (s.dy ?? 0) / specLen(s) : 0)
  specs.forEach((spec, i) => {
    if (spec.m0 !== undefined) m = spec.m0
    const kind = spec.kind ?? 'line'
    // A loop is as long as the way round it, which it keeps.
    const round = kind === 'loop' ? loopRound(spec.R!, spec.shift ?? 0) : null
    const p: Piece = {
      ...spec,
      kind,
      len: kind === 'arc' ? spec.R! * Math.abs(spec.turn!) : round ? round[LOOP_STEPS]! : spec.len!,
      index: i,
      x0: x,
      z0: z,
      h0: h,
      y0: y,
      m0: m,
      d0: d,
      dy: spec.dy ?? 0,
      y1: y + (spec.dy ?? 0),
      m1: 0,
      w0: spec.w0 ?? w,
      w1: spec.w ?? spec.w0 ?? w,
      s: 0,
      cx: 0,
      cz: 0,
      phi0: 0,
      box: [0, 0, 0, 0],
    }
    if (kind === 'arc') {
      p.s = Math.sign(spec.turn!)
      p.cx = x - p.s * spec.R! * Math.sin(h)
      p.cz = z + p.s * spec.R! * Math.cos(h)
      p.phi0 = Math.atan2(z - p.cz, x - p.cx)
    }
    if (round) p.round = round
    // Where two pieces meet, the track takes the slope between theirs, unless a piece says otherwise. A loop
    // meets its track level at both ends.
    const next = specs[i + 1]
    p.m1 = spec.mEnd ?? (next?.gap || next?.m0 !== undefined || !next || round || next.kind === 'loop' ? 0 : (slopeOf(spec) + slopeOf(next)) / 2)
    const [ex, ez] = point(p, p.len, 0)
    x = ex
    z = ez
    h = headingAt(p, p.len)
    y = p.y1
    m = p.m1
    d += p.len
    w = p.w1
    pieces.push(p)
  })
  return pieces
}

/** A course from its pieces: the lookups the ball needs, the checkpoints, the start and the goal. */
export function makeCourse(pieces: Piece[], meta: { key: string; name: string; order: readonly Feature[] }): Course {
  const course: Course = {
    ...meta,
    pieces,
    solid: [],
    railed: [],
    posts: [],
    walls: [],
    lines: [],
    spawns: [],
    minY: Infinity,
    maxY: -Infinity,
    box: [Infinity, -Infinity, Infinity, -Infinity],
    length: pieces.reduce((s, p) => s + p.len, 0),
  }
  // The new pieces' lookups, made only for a course that has any of them.
  let extras: Extras | undefined
  const more = () => (extras ??= { bumpers: [], movers: [], platforms: [], loops: [], holes: [] })
  for (const p of pieces) {
    const box: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity]
    const n = Math.max(2, Math.ceil(p.len))
    for (let i = 0; i <= n; i++) {
      const u = (p.len * i) / n
      const hw = p.gap ? 0.5 : halfWidth(p, u)
      for (const v of [-hw, 0, hw]) {
        const [x, z] = point(p, u, v)
        box[0] = Math.min(box[0], x)
        box[1] = Math.max(box[1], x)
        box[2] = Math.min(box[2], z)
        box[3] = Math.max(box[3], z)
        if (!p.gap) {
          const y = heightAt(p, u, v)
          course.minY = Math.min(course.minY, y)
          course.maxY = Math.max(course.maxY, y)
        }
      }
    }
    const pad = BALL_R + 0.4
    p.box = [box[0] - pad, box[1] + pad, box[2] - pad, box[3] + pad]
    for (let k = 0; k < 4; k++) course.box[k] = k % 2 ? Math.max(course.box[k]!, p.box[k]!) : Math.min(course.box[k]!, p.box[k]!)
    for (const s of p.platforms ?? []) more().platforms.push(layPlatform(p, s))
    if (p.gap) continue
    // A loop is ridden round (rideLoop), never rolled on as track.
    if (p.kind === 'loop') {
      more().loops.push(p)
      continue
    }
    course.solid.push(p)
    if (p.railL || p.railR) course.railed.push(p)
    for (const k of p.posts ?? []) {
      const [x, z] = point(p, k.u, k.v)
      course.posts.push({ ...k, p, x, z, y: heightAt(p, k.u, k.v), h: 1.3 })
    }
    for (const k of p.bumpers ?? []) {
      const [x, z] = point(p, k.u, k.v)
      more().bumpers.push({ ...k, p, x, z, y: heightAt(p, k.u, k.v), h: BUMPER_H })
    }
    for (const m of p.movers ?? []) more().movers.push(layMover(p, m))
    if (p.hole?.railV0 || p.hole?.railV1) more().holes.push(p)
    if (p.zones || p.hole) more()
    if (p.wallStart) course.walls.push({ p, u: 0, dir: 1 })
    if (p.wallEnd) course.walls.push({ p, u: p.len, dir: -1 })
  }
  if (extras) course.extras = extras

  // The start, then a checkpoint wherever a piece has one, then the goal.
  const spawnAt = (p: Piece, u: number) => {
    const [x, z] = point(p, u, 0)
    return { p, u, x, z, y: heightAt(p, u, 0), h: headingAt(p, u), d: p.d0 + u }
  }
  const first = pieces[0]!
  course.spawns.push({ ...spawnAt(first, Math.min(3, first.len / 2)), next: 0 })
  for (const p of pieces) {
    if (p.cp) {
      course.lines.push({ p, u: 1, d: p.d0 + 1, spawn: course.spawns.length })
      course.spawns.push({ ...spawnAt(p, 1.8), next: course.lines.length })
    }
    if (p.goal) course.lines.push({ p, u: p.goalU!, d: p.d0 + p.goalU!, goal: true })
  }
  return course
}

/* ------------------------------------------------------- the new pieces, laid --- */

function layMover(p: Piece, m: MoverSpec): Mover {
  const hammer = m.kind === 'hammer'
  const v = hammer ? 0 : m.v
  const [x, z] = point(p, m.u, v)
  const ground = heightAt(p, m.u, v)
  return {
    kind: m.kind,
    p,
    u: m.u,
    x,
    z,
    ground,
    // A hammer's axle is over the track, its head just clear of it at the bottom; an arm's bar is at ARM_Y.
    y: hammer ? ground + HAMMER_CLEAR + HAMMER_R + m.arm : ground + ARM_Y,
    h: headingAt(p, m.u),
    arm: hammer ? m.arm : 0,
    swing: hammer ? m.swing : 0,
    reach: hammer ? 0 : m.reach,
    back: hammer ? 0 : (m.back ?? 0),
    period: m.period,
    phase: m.phase ?? 0,
  }
}

function layPlatform(p: Piece, s: PlatformSpec): Platform {
  const v = s.v ?? 0
  const [x, z] = point(p, s.u, v)
  const [x1, z1] = point(p, s.u + (s.du ?? 0), v + (s.dv ?? 0))
  return {
    p,
    x,
    z,
    dx: x1 - x,
    dz: z1 - z,
    h: headingAt(p, s.u),
    hl: s.len / 2,
    hw: s.w / 2,
    y: p.y0,
    period: s.period,
    rest: clamp(s.rest ?? 0.2, 0, 0.45),
    phase: s.phase ?? 0,
  }
}

/**
 * Where a slab's middle is `t` seconds into the run, and how fast it's going. Each cycle it rests at the near end
 * (−du), eases over to the far end (+du), rests there, and eases back.
 */
export function platformPose(pl: Platform, t: number): { x: number; z: number; vx: number; vz: number } {
  const turns = t / pl.period + pl.phase / TAU
  const c = turns - Math.floor(turns)
  const go = 0.5 - pl.rest
  let m = -1
  let dm = 0
  if (c >= 0.5 + pl.rest) {
    const k = (c - 0.5 - pl.rest) / go
    m = 1 - 2 * smooth01(k)
    dm = -(12 * k * (1 - k)) / (go * pl.period)
  } else if (c >= 0.5) m = 1
  else if (c >= pl.rest) {
    const k = (c - pl.rest) / go
    m = -1 + 2 * smooth01(k)
    dm = (12 * k * (1 - k)) / (go * pl.period)
  }
  return { x: pl.x + pl.dx * m, z: pl.z + pl.dz * m, vx: pl.dx * dm, vz: pl.dz * dm }
}

/**
 * A mover's angle `t` seconds into the run, and how fast it's turning, in radians a second: a hammer's swing from
 * straight down (to the right of the track positive), an arm's turn from along the track.
 */
export function moverAngle(m: Mover, t: number): [number, number] {
  const k = TAU / m.period
  if (m.kind === 'hammer') {
    const a = k * t + m.phase
    return [m.swing * Math.sin(a), m.swing * k * Math.cos(a)]
  }
  return [k * t + m.phase, k]
}

/** A hammer's head, swung `a` from straight down: its middle. It lies along the track, HAMMER_HALF either way. */
function hammerHead(m: Mover, a: number): [number, number, number] {
  const out = m.arm * Math.sin(a)
  return [m.x - out * Math.sin(m.h), m.y - m.arm * Math.cos(a), m.z + out * Math.cos(m.h)]
}

/** The patch of a piece `u` along it and `v` across it: boost, mud or ice, if any. */
function zoneAt(p: Piece, u: number, v: number): Zone | null {
  for (const z of p.zones ?? []) if (u >= z.u0 && u <= z.u1 && v >= (z.v0 ?? -Infinity) && v <= (z.v1 ?? Infinity)) return z
  return null
}

/** The patch the ball is rolling on, if it's on one. */
export function zoneUnder(s: Surface | null): Zone | null {
  return s && s.p.zones && !s.plat ? zoneAt(s.p, s.u, s.v) : null
}

/** The highest slab under a ground-plane point, `t` seconds into the run, that isn't above `below`. */
function slabAt(course: Course, x: number, z: number, below: number, t: number): Surface | null {
  let best: Surface | null = null
  for (const pl of course.extras!.platforms) {
    if (pl.y > below || (best && best.y >= pl.y)) continue
    const at = platformPose(pl, t)
    const dx = x - at.x
    const dz = z - at.z
    const c = Math.cos(pl.h)
    const s = Math.sin(pl.h)
    if (Math.abs(dx * c + dz * s) > pl.hl || Math.abs(-dx * s + dz * c) > pl.hw) continue
    const l = local(pl.p, x, z)
    best = { p: pl.p, u: l.u, v: l.v, y: pl.y, plat: pl }
  }
  return best
}

/** surfaceAt on a course with slabs: the track, or a slab if one is higher, where they are `t` seconds into the run. */
export function supportAt(course: Course, x: number, z: number, below: number, t: number): Surface | null {
  const s = surfaceAt(course, x, z, below)
  const q = slabAt(course, x, z, below, t)
  return q && (!s || q.y > s.y) ? q : s
}

/* ---------------------------------------------------------------- the ball --- */

export type Tilt = { x: number; z: number }

export type Ball = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  air: boolean
  /** Seconds since the run began: it keeps running through falls. */
  t: number
  /** The next checkpoint line (or the goal) to cross, and the spawn it would go back to. */
  next: number
  cp: number
  /** When it crossed each checkpoint, and the goal. */
  splits: number[]
  finished: boolean
  time: number | null
  lost: boolean
  falls: number
  /** This step: how hard it landed, how hard it met a rail or a post, and which line it crossed. */
  landed: number
  hit: number
  crossed: number
  /** The height of the last track it was on, and how long it's been in the air. */
  groundY: number
  flight: number
  support: Surface | null
  /** This step, on a course with them: the bumper it hit (its index, or −1), and how hard a hammer or an arm knocked it, in m/s. */
  bumped: number
  knocked: number
  /** Whether it has met a bumper, a hammer or an arm at all this run: the pace ball never may (timeThings). */
  touched: boolean
  /** Riding a loop, round it rather than on the track. */
  loop: LoopRide | null
}

/**
 * A ball riding a loop: `u` round it, `v` across it, and its speed round it (back the way it came, less than 0). It
 * came in `v0` across at `from` (0, its mouth, or its end, backwards), and eases into the middle from there.
 */
export type LoopRide = { p: Piece; u: number; v: number; v0: number; from: number; speed: number }

export function newBall(course: Course, at = 0): Ball {
  const b: Ball = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    air: false,
    t: 0,
    next: 0,
    cp: at,
    splits: [],
    finished: false,
    time: null,
    lost: false,
    falls: 0,
    landed: 0,
    hit: 0,
    crossed: -1,
    groundY: 0,
    flight: 0,
    support: null,
    bumped: -1,
    knocked: 0,
    touched: false,
    loop: null,
  }
  respawn(course, b, at)
  b.next = course.spawns[at]!.next
  return b
}

/** Back to a spawn, still, with the clock where it was. */
export function respawn(course: Course, b: Ball, at = b.cp): Ball {
  const sp = course.spawns[at]!
  b.x = sp.x
  b.z = sp.z
  b.y = sp.y + BALL_R
  b.vx = b.vy = b.vz = 0
  b.air = false
  b.lost = false
  b.loop = null
  b.groundY = sp.y
  b.flight = 0
  // On the track there, so the camera looks along it at once.
  b.support = { p: sp.p, u: sp.u, v: 0, y: sp.y }
  b.cp = at
  return b
}

/**
 * One step of the ball, in place, with the world tilted by `tilt`: the way down, in (x, z), as the sine of
 * the angle. On the track the ball rolls; off it, it flies, and lands, and bounces if it came down hard;
 * over the void it's lost. Past the goal it rolls on to the end, with its time kept.
 *
 * On a course with the new pieces (Course `extras`) it also rides slabs and loops, and meets bumpers, hammers
 * and arms where they are this moment of the run; on any course, boost pads, mud and ice change how it rolls.
 * A course without them steps exactly as it always has.
 */
export function step(course: Course, b: Ball, tilt: Tilt): Ball {
  if (b.lost) return b
  let tx = tilt.x
  let tz = tilt.z
  const tl = Math.hypot(tx, tz)
  if (tl > TILT_MAX) {
    tx *= TILT_MAX / tl
    tz *= TILT_MAX / tl
  }
  const gx = G * tx
  const gz = G * tz
  const gy = -G * Math.sqrt(1 - tx * tx - tz * tz)
  const px = b.x
  const pz = b.z
  const t0 = b.t
  b.landed = 0
  b.hit = 0
  b.crossed = -1
  const x = course.extras
  const slabs = x !== undefined && x.platforms.length > 0
  if (x) {
    b.bumped = -1
    b.knocked = 0
    // Round a loop the ball goes only one way, the loop's (rideLoop), and the tilt does nothing.
    if (b.loop) {
      rideLoop(course, b)
      b.t = t0 + DT
      if (!b.finished) crossLines(course, b, px, pz, t0)
      return b
    }
  }

  const s = b.air ? null : slabs ? supportAt(course, b.x, b.z, b.y - BALL_R + 0.5, t0) : surfaceAt(course, b.x, b.z, b.y - BALL_R + 0.5)
  if (s) {
    // On a slab the ball rolls as on level track, its speed on the slab, and goes where the slab takes it.
    const slab = s.plat
    const was = slab ? platformPose(slab, t0) : null
    if (was) {
      b.vx -= was.vx
      b.vz -= was.vz
    }
    const [nx, ny, nz] = slab ? LEVEL : normalAt(s.p, b.x, b.z)
    // Ice and mud change the tilt's pull and the drag where they are; a boost pad pushes (below).
    const zone = s.p.zones ? zoneAt(s.p, s.u, s.v) : null
    let ex = gx
    let ey = gy
    let ez = gz
    let rolling = ROLLING
    if (zone?.kind === 'ice') {
      ex = gx * ICE_GRIP
      ez = gz * ICE_GRIP
      ey = -Math.sqrt(G * G - ex * ex - ez * ez)
      rolling = ICE_ROLLING
    } else if (zone?.kind === 'mud') rolling = MUD_ROLLING
    // The pull along the track, as a rolling ball feels it, and the drags against the way it's going.
    const gn = ex * nx + ey * ny + ez * nz
    let ax = ROLL * (ex - gn * nx)
    let ay = ROLL * (ey - gn * ny)
    let az = ROLL * (ez - gn * nz)
    const sp = Math.hypot(b.vx, b.vy, b.vz)
    if (sp > 1e-6) {
      let drag = rolling * -gn + AIR * sp * sp
      if (zone?.kind === 'mud') drag += MUD_STICK * sp
      ax -= (drag * b.vx) / sp
      ay -= (drag * b.vy) / sp
      az -= (drag * b.vz) / sp
    }
    if (zone?.kind === 'boost') {
      // Pushed down the track, along its surface, easing off as it nears BOOST_TOP that way.
      const h = headingAt(s.p, clamp(s.u, 0, s.p.len))
      const fx = Math.cos(h)
      const fz = Math.sin(h)
      const fy = -(fx * nx + fz * nz) / ny
      const fl = Math.hypot(fx, fy, fz)
      const ahead = (b.vx * fx + b.vy * fy + b.vz * fz) / fl
      const push = (BOOST_PUSH * clamp((BOOST_TOP - ahead) / BOOST_EASE, 0, 1)) / fl
      ax += push * fx
      ay += push * fy
      az += push * fz
    }
    b.vx += ax * DT
    b.vy += ay * DT
    b.vz += az * DT
    const vn = b.vx * nx + b.vy * ny + b.vz * nz
    b.vx -= vn * nx
    b.vy -= vn * ny
    b.vz -= vn * nz
    b.x += b.vx * DT
    b.z += b.vz * DT
    if (was) {
      // Carried: as far as the slab went this step, and with its speed now on top of its own on it.
      const now = platformPose(slab!, t0 + DT)
      b.x += now.x - was.x
      b.z += now.z - was.z
      b.vx += now.vx
      b.vz += now.vz
    }
    const s2 = slabs ? supportAt(course, b.x, b.z, b.y - BALL_R + 0.5, t0 + DT) : surfaceAt(course, b.x, b.z, b.y - BALL_R + 0.5)
    // Where the track falls away faster than the ball would fall, or ends, it leaves it.
    const fly = b.y + b.vy * DT + 0.5 * gy * DT * DT
    if (!s2 || fly > s2.y + BALL_R + 0.003) {
      b.air = true
      b.y = fly
      b.vy += gy * DT
      b.flight = 0
    } else {
      b.y = s2.y + BALL_R
      b.groundY = s2.y
      b.support = s2
      // Along the new stretch of track at the same speed.
      const [mx, my, mz] = s2.plat ? LEVEL : normalAt(s2.p, b.x, b.z)
      const sp0 = Math.hypot(b.vx, b.vy, b.vz)
      const vm = b.vx * mx + b.vy * my + b.vz * mz
      b.vx -= vm * mx
      b.vy -= vm * my
      b.vz -= vm * mz
      const sp1 = Math.hypot(b.vx, b.vy, b.vz)
      if (sp1 > 1e-9) {
        const k = sp0 / sp1
        b.vx *= k
        b.vy *= k
        b.vz *= k
      }
    }
  } else {
    b.air = true
    const bottom = b.y - BALL_R
    b.vx += gx * DT
    b.vy += gy * DT
    b.vz += gz * DT
    const sp = Math.hypot(b.vx, b.vy, b.vz)
    if (sp > 1e-6) {
      const k = 1 - AIR * sp * DT
      b.vx *= k
      b.vy *= k
      b.vz *= k
    }
    b.x += b.vx * DT
    b.y += b.vy * DT
    b.z += b.vz * DT
    b.flight += DT
    const under = slabs ? supportAt(course, b.x, b.z, bottom + 0.05, t0 + DT) : surfaceAt(course, b.x, b.z, bottom + 0.05)
    if (under && b.y - BALL_R <= under.y) {
      b.y = under.y + BALL_R
      b.groundY = under.y
      b.support = under
      const [nx, ny, nz] = under.plat ? LEVEL : normalAt(under.p, b.x, b.z)
      const vn = b.vx * nx + b.vy * ny + b.vz * nz
      const hard = -vn > HARD_LANDING
      if (vn < 0) {
        const e = hard ? LAND_E : 0
        b.vx -= (1 + e) * vn * nx
        b.vy -= (1 + e) * vn * ny
        b.vz -= (1 + e) * vn * nz
        b.landed = -vn
      }
      if (!hard) {
        b.air = false
        b.flight = 0
      }
    } else if (b.y < course.minY - 12 || b.flight > 6 || (b.y < b.groundY - 5 && !surfaceAt(course, b.x, b.z, b.y - BALL_R))) {
      // Nothing under it but the dark.
      b.lost = true
      b.falls += 1
    }
  }

  collide(course, b)
  if (x) {
    collideExtras(x, b, t0 + DT)
    if (x.loops.length && !b.lost) enterLoop(course, x, b, px, pz)
  }
  b.t = t0 + DT
  if (!b.finished) crossLines(course, b, px, pz, t0)
  return b
}

function collide(course: Course, b: Ball) {
  const reach = BALL_R + RAIL_T
  for (const p of course.railed) {
    const bx = p.box
    if (b.x < bx[0] || b.x > bx[1] || b.z < bx[2] || b.z > bx[3]) continue
    const l = local(p, b.x, b.z)
    if (l.u < 0 || l.u > p.len) continue
    const side = l.v >= 0 ? 1 : -1
    if (!(side > 0 ? p.railR : p.railL)) continue
    const hw = halfWidth(p, l.u)
    const over = Math.abs(l.v) - (hw - reach)
    if (over <= 0 || Math.abs(l.v) > hw + 0.25) continue
    if (b.y - BALL_R > heightAt(p, l.u, side * hw) + RAIL_H) continue
    const h = headingAt(p, l.u)
    const nx = -Math.sin(h) * side
    const nz = Math.cos(h) * side
    b.x -= nx * over
    b.z -= nz * over
    const vo = b.vx * nx + b.vz * nz
    if (vo > 0) {
      b.vx -= (1 + RAIL_E) * vo * nx
      b.vz -= (1 + RAIL_E) * vo * nz
      b.hit = Math.max(b.hit, vo)
    }
  }
  for (const w of course.walls) {
    const p = w.p
    const bx = p.box
    if (b.x < bx[0] || b.x > bx[1] || b.z < bx[2] || b.z > bx[3]) continue
    const l = local(p, b.x, b.z)
    if (Math.abs(l.v) > halfWidth(p, clamp(l.u, 0, p.len)) + 0.3) continue
    const gap = (l.u - w.u) * w.dir
    if (gap >= reach || gap < -1.5) continue
    if (b.y - BALL_R > heightAt(p, w.u, l.v) + RAIL_H) continue
    const h = headingAt(p, w.u)
    const fx = Math.cos(h) * w.dir
    const fz = Math.sin(h) * w.dir
    b.x += fx * (reach - gap)
    b.z += fz * (reach - gap)
    const vi = b.vx * fx + b.vz * fz
    if (vi < 0) {
      b.vx -= (1 + RAIL_E) * vi * fx
      b.vz -= (1 + RAIL_E) * vi * fz
      b.hit = Math.max(b.hit, -vi)
    }
  }
  for (const k of course.posts) {
    const dx = b.x - k.x
    const dz = b.z - k.z
    const r = BALL_R + k.r
    if (Math.abs(dx) > r || Math.abs(dz) > r) continue
    const d = Math.hypot(dx, dz)
    if (d >= r || d < 1e-9) continue
    if (b.y - BALL_R > k.y + k.h) continue
    const nx = dx / d
    const nz = dz / d
    b.x = k.x + nx * r
    b.z = k.z + nz * r
    const vn = b.vx * nx + b.vz * nz
    if (vn < 0) {
      b.vx -= (1 + POST_E) * vn * nx
      b.vz -= (1 + POST_E) * vn * nz
      b.hit = Math.max(b.hit, -vn)
    }
  }
}

/** Bumpers, hammers and arms where they are at `t` seconds into the run, and the rails along a fork's hole. */
function collideExtras(x: Extras, b: Ball, t: number) {
  // A bumper is a post that kicks: the ball leaves faster than it came, and never slower than BUMPER_KICK.
  for (let i = 0; i < x.bumpers.length; i++) {
    const k = x.bumpers[i]!
    const dx = b.x - k.x
    const dz = b.z - k.z
    const r = BALL_R + k.r
    if (Math.abs(dx) > r || Math.abs(dz) > r) continue
    const d = Math.hypot(dx, dz)
    if (d >= r || d < 1e-9) continue
    if (b.y - BALL_R > k.y + k.h) continue
    b.touched = true
    const nx = dx / d
    const nz = dz / d
    b.x = k.x + nx * r
    b.z = k.z + nz * r
    const vn = b.vx * nx + b.vz * nz
    const out = Math.max(BUMPER_KICK, -vn * BUMPER_E)
    if (vn < out) {
      b.vx += (out - vn) * nx
      b.vz += (out - vn) * nz
      b.bumped = i
      // A kick back up the track goes mostly across it instead, as fast: a bumper costs time, but doesn't throw
      // the ball back up the course.
      const h = headingAt(k.p, k.u)
      const fx = Math.cos(h)
      const fz = Math.sin(h)
      if (b.vx * fx + b.vz * fz < -BUMPER_BACK) {
        const across = -b.vx * fz + b.vz * fx
        const side = across !== 0 ? Math.sign(across) : -nx * fz + nz * fx >= 0 ? 1 : -1
        const sp = Math.hypot(b.vx, b.vz)
        const keep = side * Math.sqrt(Math.max(0, sp * sp - BUMPER_BACK * BUMPER_BACK))
        b.vx = -BUMPER_BACK * fx - keep * fz
        b.vz = -BUMPER_BACK * fz + keep * fx
      }
    }
  }
  for (const m of x.movers) {
    const span = (m.kind === 'hammer' ? m.arm + HAMMER_HALF + HAMMER_R : Math.max(m.reach, m.back, HUB_R) + ARM_R) + BALL_R
    if (Math.abs(b.x - m.x) > span || Math.abs(b.z - m.z) > span) continue
    const [a, w] = moverAngle(m, t)
    if (m.kind === 'hammer') {
      // The head lies along the track: the nearest point of its middle line, and every point of it swings at the
      // same speed, across the track and up as the arm goes.
      const [hx, hy, hz] = hammerHead(m, a)
      const fx = Math.cos(m.h)
      const fz = Math.sin(m.h)
      const along = clamp((b.x - hx) * fx + (b.z - hz) * fz, -HAMMER_HALF, HAMMER_HALF)
      const sp = w * m.arm
      const across = sp * Math.cos(a)
      knock(b, hx + fx * along, hy, hz + fz * along, HAMMER_R, -across * Math.sin(m.h), sp * Math.sin(a), across * Math.cos(m.h))
      continue
    }
    // An arm's post stands still, as a post does.
    const dx = b.x - m.x
    const dz = b.z - m.z
    const d = Math.hypot(dx, dz)
    const r = HUB_R + BALL_R
    if (d < r && d > 1e-9 && b.y - BALL_R < m.ground + HUB_H) {
      b.touched = true
      const nx = dx / d
      const nz = dz / d
      b.x = m.x + nx * r
      b.z = m.z + nz * r
      const vn = b.vx * nx + b.vz * nz
      if (vn < 0) {
        b.vx -= (1 + POST_E) * vn * nx
        b.vz -= (1 + POST_E) * vn * nz
        b.hit = Math.max(b.hit, -vn)
      }
    }
    // Its bar, from `back` behind the post to `reach` ahead: a point of it `along` out goes round at w × along.
    const dir = m.h + a
    const ux = Math.cos(dir)
    const uz = Math.sin(dir)
    const along = clamp((b.x - m.x) * ux + (b.z - m.z) * uz, -m.back, m.reach)
    knock(b, m.x + ux * along, m.y, m.z + uz * along, ARM_R, -w * along * uz, 0, w * along * ux)
  }
  // A fork's outer lane is railed along the hole, on its own side.
  const reach = BALL_R + RAIL_T
  for (const p of x.holes) {
    const bx = p.box
    if (b.x < bx[0] || b.x > bx[1] || b.z < bx[2] || b.z > bx[3]) continue
    const hole = p.hole!
    const l = local(p, b.x, b.z)
    if (l.u < hole.u0 || l.u > hole.u1) continue
    const h = headingAt(p, l.u)
    for (const edge of [-1, 1] as const) {
      if (!(edge < 0 ? hole.railV0 : hole.railV1)) continue
      // The track is below v0 and above v1; into the hole is +v from v0's edge, −v from v1's.
      const at = edge < 0 ? hole.v0 : hole.v1
      const over = edge < 0 ? l.v - (at - reach) : at + reach - l.v
      if (over <= 0 || over > reach + 0.25) continue
      if (b.y - BALL_R > heightAt(p, l.u, at) + RAIL_H) continue
      const nx = Math.sin(h) * edge
      const nz = -Math.cos(h) * edge
      b.x -= nx * over
      b.z -= nz * over
      const vo = b.vx * nx + b.vz * nz
      if (vo > 0) {
        b.vx -= (1 + RAIL_E) * vo * nx
        b.vz -= (1 + RAIL_E) * vo * nz
        b.hit = Math.max(b.hit, vo)
      }
    }
  }
}

/**
 * The ball against a moving rod, at the rod's nearest point to it (cx, cy, cz), `r` thick, where the rod moves at
 * (mx, my, mz). Off it as off a rail, but the rod's own speed goes on top, and one swinging into the ball knocks it
 * at least KNOCK m/s away: enough, unrailed, to knock it off the track.
 */
function knock(b: Ball, cx: number, cy: number, cz: number, r: number, mx: number, my: number, mz: number) {
  let nx = b.x - cx
  let ny = b.y - cy
  let nz = b.z - cz
  const reach = r + BALL_R
  const d = Math.hypot(nx, ny, nz)
  if (d >= reach) return
  b.touched = true
  if (d < 1e-9) {
    nx = 0
    ny = 1
    nz = 0
  } else {
    nx /= d
    ny /= d
    nz /= d
  }
  b.x = cx + nx * reach
  b.y = cy + ny * reach
  b.z = cz + nz * reach
  const own = mx * nx + my * ny + mz * nz
  const rel = b.vx * nx + b.vy * ny + b.vz * nz - own
  if (rel >= 0) return
  let out = own - MOVER_E * rel
  if (own > 0.3) out = Math.max(out, KNOCK)
  const dv = out - (rel + own)
  b.vx += dv * nx
  b.vy += dv * ny
  b.vz += dv * nz
  b.knocked = Math.max(b.knocked, dv)
}

/** Into a loop: over its mouth from the piece before it, or back in from the piece after it, rolling backwards. */
function enterLoop(course: Course, x: Extras, b: Ball, px: number, pz: number) {
  if (b.loop) return
  const near = (p: Piece) => b.x >= p.box[0] && b.x <= p.box[1] && b.z >= p.box[2] && b.z <= p.box[3]
  for (const q of x.loops) {
    const before = course.pieces[q.index - 1]
    if (before && near(before)) {
      const a = local(before, px, pz)
      const c = local(before, b.x, b.z)
      if (a.u < before.len && c.u >= before.len && Math.abs(c.v) <= halfWidth(before, before.len) + 0.3 && Math.abs(b.y - BALL_R - before.y1) < 0.6) {
        const speed = b.vx * Math.cos(q.h0) + b.vz * Math.sin(q.h0)
        if (speed > 0) return rideFrom(b, q, c.u - before.len, c.v, speed)
      }
    }
    const after = course.pieces[q.index + 1]
    if (after && near(after)) {
      const a = local(after, px, pz)
      const c = local(after, b.x, b.z)
      if (a.u > 0 && c.u <= 0 && Math.abs(c.v) <= halfWidth(after, 0) + 0.3 && Math.abs(b.y - BALL_R - after.y0) < 0.6) {
        const speed = b.vx * Math.cos(q.h0) + b.vz * Math.sin(q.h0)
        if (speed < 0) return rideFrom(b, q, q.len + c.u, c.v, speed)
      }
    }
  }
}

function rideFrom(b: Ball, q: Piece, u: number, v: number, speed: number) {
  b.loop = { p: q, u: clamp(u, 0, q.len), v, v0: v, from: speed > 0 ? 0 : q.len, speed }
  b.air = false
  b.flight = 0
  onLoop(b, b.loop)
}

/** The ball where its ride round a loop has it, going the way round at its speed. */
function onLoop(b: Ball, L: LoopRide) {
  const at = loopBall(L.p, L.u, L.v)
  b.x = at.x
  b.y = at.y
  b.z = at.z
  b.vx = at.tx * L.speed
  b.vy = at.ty * L.speed
  b.vz = at.tz * L.speed
  b.groundY = L.p.y0
  b.support = { p: L.p, u: L.u, v: L.v, y: heightAt(L.p, L.u, 0) }
}

/**
 * Round a loop, one step: its speed changes as a rolling ball's does with the climb (ROLL of the pull along the
 * way), less the rolling drag on how hard the track presses and the air's. Too slow over the top, the track
 * stops pressing (the ball's speed², over the radius, is less than gravity's pull off the track) and it falls
 * away: it's lost, as off an edge. Out of either end it rolls on along the track there.
 */
function rideLoop(course: Course, b: Ball) {
  const L = b.loop!
  const q = L.p
  const r = q.R! - BALL_R
  const th = loopTheta(q, L.u)
  const press = (L.speed * L.speed) / r + G * Math.cos(th)
  if (press < 0) {
    b.loop = null
    b.support = null
    b.air = true
    b.lost = true
    b.falls += 1
    return
  }
  const drift = loopSide(q, th)[1]
  const along = (-G * r * Math.sin(th)) / Math.hypot(r, drift)
  const drag = ROLLING * press + AIR * L.speed * L.speed
  L.speed += (ROLL * along - Math.sign(L.speed) * drag) * DT
  L.u += L.speed * DT
  L.v = L.v0 * (1 - smooth01(Math.abs(L.u - L.from) / LOOP_SETTLE))
  if (L.u >= q.len) offLoop(course, b, L, 1)
  else if (L.u <= 0) offLoop(course, b, L, -1)
  else onLoop(b, L)
}

/** Out of a loop onto the track at its end (`dir` 1) or back onto the track before it (−1), level, at its speed. */
function offLoop(course: Course, b: Ball, L: LoopRide, dir: 1 | -1) {
  const q = L.p
  const p = course.pieces[q.index + dir]!
  const u = dir > 0 ? L.u - q.len : p.len + L.u
  const [x, z] = point(p, u, L.v)
  const y = heightAt(p, u, L.v)
  const h = headingAt(p, clamp(u, 0, p.len))
  b.x = x
  b.y = y + BALL_R
  b.z = z
  b.vx = Math.cos(h) * L.speed
  b.vy = 0
  b.vz = Math.sin(h) * L.speed
  b.loop = null
  b.air = false
  b.groundY = y
  b.support = { p, u, v: L.v, y }
}

/** Checkpoints and the goal: a line across the track, timed to the moment the ball crossed it. */
function crossLines(course: Course, b: Ball, px: number, pz: number, t0: number) {
  for (let i = b.next; i < course.lines.length; i++) {
    const L = course.lines[i]!
    const p = L.p
    const bx = p.box
    if (b.x < bx[0] || b.x > bx[1] || b.z < bx[2] || b.z > bx[3]) continue
    const a = local(p, px, pz)
    const c = local(p, b.x, b.z)
    if (!(a.u < L.u && c.u >= L.u)) continue
    if (Math.abs(c.v) > halfWidth(p, clamp(L.u, 0, p.len)) + 0.5) continue
    const y = heightAt(p, L.u, c.v)
    if (b.y - BALL_R > y + 4 || b.y < y - 1) continue
    const at = t0 + ((L.u - a.u) / (c.u - a.u)) * DT
    while (b.next <= i) {
      b.splits.push(at)
      b.next += 1
    }
    if (L.spawn != null) b.cp = L.spawn
    if (L.goal) {
      b.finished = true
      b.time = at
    }
    b.crossed = i
    return
  }
}

/** A ball set down on a piece, rolling along it at `speed`. */
export function placeBall(course: Course, p: Piece, u: number, speed: number, v = 0): Ball {
  const b = newBall(course, 0)
  const [x, z] = point(p, u, v)
  const h = headingAt(p, u)
  b.x = x
  b.z = z
  b.y = heightAt(p, u, v) + BALL_R
  const [nx, ny, nz] = normalAt(p, x, z)
  const vx = Math.cos(h)
  const vz = Math.sin(h)
  const vy = -(vx * nx + vz * nz) / ny
  const k = speed / Math.hypot(vx, vy, vz)
  b.vx = vx * k
  b.vy = vy * k
  b.vz = vz * k
  b.groundY = b.y - BALL_R
  return b
}

/* ---------------------------------------------------------- making courses --- */

const PLACE = ['Violet', 'Neon', 'Glass', 'Midnight', 'Comet', 'Ultra', 'Nova', 'Echo', 'Prism', 'Static', 'Velvet', 'Orbit']
const THING = ['Run', 'Drop', 'Spiral', 'Descent', 'Chute', 'Switchback', 'Cascade', 'Circuit', 'Line', 'Gauntlet', 'Slide', 'Rush']

type Turner = { side: (r: () => number, amount: number) => number }

function outerRail(turn: number, on: boolean): Spec {
  if (!on) return {}
  // Turning right, the outside of the curve is on the left.
  return turn > 0 ? { railL: true } : { railR: true }
}

/**
 * The kinds of stretch a course is made of. Each returns the specs of its pieces; the turner knows how
 * far the course has turned so far, so turns bring it back round and it winds down the hill instead of
 * curling up on itself.
 */
const FEATURES: Record<BaseFeature, (r: () => number, ctx: Turner) => Spec[]> = {
  sweeper(r, ctx) {
    const R = 13 + r() * 9
    const turn = ctx.side(r, (55 + r() * 55) * (Math.PI / 180))
    const len = R * Math.abs(turn)
    return [{ kind: 'arc', R, turn, w: 5.5 + r() * 1, dy: -len * (0.02 + r() * 0.04), bank: 0.12 + r() * 0.14, ...outerRail(turn, r() < 0.35) }]
  },
  hairpin(r, ctx) {
    const R = 7.5 + r() * 2.5
    const turn = ctx.side(r, (150 + r() * 30) * (Math.PI / 180))
    const bowl = r() < 0.7
    return [
      {
        kind: 'arc',
        R,
        turn,
        w: 6.5,
        dy: -(0.6 + r() * 0.8),
        ...(bowl ? { pipe: 0.08 + r() * 0.03 } : { bank: 0.28, ...outerRail(turn, true) }),
      },
    ]
  },
  esses(r, ctx) {
    const R = 10 + r() * 4
    const a = ctx.side(r, (45 + r() * 35) * (Math.PI / 180))
    const b = -Math.sign(a) * (45 + r() * 35) * (Math.PI / 180)
    const w = 5.5 + r() * 0.5
    return [
      { kind: 'arc', R, turn: a, w, dy: -(0.8 + r() * 0.8), bank: 0.12 + r() * 0.08 },
      { kind: 'arc', R: R * (0.9 + r() * 0.2), turn: b, w, dy: -(0.8 + r() * 0.8), bank: 0.12 + r() * 0.08 },
    ]
  },
  narrow(r) {
    const w = 2.8 + r() * 0.4
    return [
      { len: 7, w, dy: -0.4 },
      { len: 10 + r() * 6, w, dy: -(0.4 + r() * 0.8), narrow: true },
      { len: 7, w: 5.5, dy: -0.4 },
    ]
  },
  drop(r) {
    const len = 14 + r() * 6
    return [{ len, w: 5.5 + r() * 1, dy: -Math.min(len * 0.28, 3 + r() * 2.5) }]
  },
  rollers(r) {
    const k = [0, 0.3, -0.3][Math.floor(r() * 3)]!
    return [{ len: 18 + r() * 8, w: 6, dy: -(0.6 + r() * 0.8), rollers: { a: 0.3 + r() * 0.2, wave: 4.5 + r() * 1.5, k } }]
  },
  posts(r) {
    const len = 20 + r() * 8
    const n = 3 + Math.floor(r() * 3)
    const w = 7.5
    const first = r() < 0.5 ? 1 : -1
    const posts: { u: number; v: number; r: number }[] = []
    for (let i = 0; i < n; i++) posts.push({ u: 5 + ((len - 10) * i) / (n - 1), v: (i % 2 ? -first : first) * (w / 2 - 2), r: 0.45 })
    // Railed: a post costs you time, not the run.
    return [{ len, w, dy: -(0.8 + r() * 0.8), posts, railL: true, railR: true }]
  },
  chute(r) {
    return [{ len: 18 + r() * 8, w: 5, dy: -(1.5 + r() * 1.5), pipe: 0.12 }]
  },
  jump(r) {
    return [
      { len: 14 + r() * 4, w: 6, dy: -(1 + r() * 0.8) },
      { len: 6, w: 6, dy: 0.45 + r() * 0.25, mEnd: 0.24 + r() * 0.08, kicker: true },
      { len: 3.5 + r() * 2, w: 6, dy: -(1.2 + r() * 1.2), gap: true },
      { len: 20, w: 7, m0: -0.12, dy: -(0.8 + r() * 0.4), mEnd: 0, landing: true },
    ]
  },
}

/** The order of stretches for a course: every course has a jump, a narrow, turns and a drop. */
/**
 * The first course laid longer, with two more stretches (2026-10-01; Ramsey: "make them a little longer"). The
 * days before it keep the courses they were played on: a course is laid from its number the same way for good.
 */
export const LONGER_FROM = 3

function recipe(r: () => number, longer: boolean, fewer = 0, sweepersOut = 0): BaseFeature[] | null {
  const must: BaseFeature[] = ['jump', 'narrow', 'drop', r() < 0.5 ? 'posts' : 'rollers']
  // An iced turn or a fork stands in for a sweeper (tryCourse).
  const turns = (['sweeper', 'sweeper', 'esses', 'hairpin'] as BaseFeature[]).slice(sweepersOut)
  const extra: BaseFeature[] = ['sweeper', 'rollers', 'posts', 'chute', 'esses', 'hairpin', 'drop']
  const bag = [...must, ...turns]
  // A course with new pieces has `fewer` of these, two at least, so it isn't much longer for them (tryCourse).
  const more = Math.max(2, (longer ? 4 : 2) + Math.floor(r() * 2) - fewer)
  for (let i = 0; i < more; i++) bag.push(extra[Math.floor(r() * extra.length)]!)
  for (let tries = 0; tries < 200; tries++) {
    const order = [...bag]
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[order[i], order[j]] = [order[j]!, order[i]!]
    }
    const bad = order.some(
      (k, i) =>
        (i > 0 && order[i - 1] === k) ||
        // A jump needs room to get going, and somewhere calm after it.
        (k === 'jump' && (i < 2 || order[i + 1] === 'hairpin' || order[i + 1] === 'narrow')) ||
        (k === 'narrow' && i === 0),
    )
    if (!bad) return order
  }
  return null
}

/* -------------------------------------------- the new pieces in a day's course --- */

/**
 * From this course on (2026-10-07), each day's course has two to four of the test track's pieces among its
 * stretches, chosen and laid from its number (Ramsey, 2026-10-06, after rolling them: "i like all the stuff in
 * marble run too"). The courses before are laid as they were, bit for bit.
 */
export const PIECES_FROM = 9

/** How likely each piece is in a day's course; then a course has PIECES_LEAST at least and PIECES_MOST at most. */
const PIECE_CHANCE: [PieceKind, number][] = [
  ['pads', 0.4],
  ['bumpers', 0.4],
  ['hammers', 0.35],
  ['windmill', 0.35],
  ['platform', 0.3],
  ['ice', 0.35],
  ['fork', 0.35],
  ['loop', 0.4],
]
const PIECES_LEAST = 2
const PIECES_MOST = 4

/** What each piece is called, as the Course Book and the test track's cards say. */
export const PIECE_WORDS: Record<PieceKind, string> = {
  pads: 'boost pads and mud',
  bumpers: 'bumpers',
  hammers: 'hammers',
  windmill: 'a windmill',
  platform: 'a moving platform',
  ice: 'ice',
  fork: 'a fork',
  loop: 'a loop',
}

/** A bumper's radius, on the test track and in a day's course. */
const BUMPER_R = 0.65
/** The pace ball's speed over a moving slab's gap, on the slab (racingPlan), and the share of the slab's cycle that crossing takes. */
const SLAB_PACE = 2
const SLAB_CROSSING = 0.62

const isPiece = (f: Feature): f is PieceKind => f in PIECE_WORDS

/** A course's pieces, in the order they come down it. */
export function coursePieces(course: Course): PieceKind[] {
  return course.order.filter(isPiece)
}

function shuffle<T>(list: T[], r: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[list[i], list[j]] = [list[j]!, list[i]!]
  }
  return list
}

/** A day's course's pieces: each by its chance, two at least and four at most, in the order they'll come. */
function piecesFor(rp: () => number): PieceKind[] {
  const picks = PIECE_CHANCE.filter(([, p]) => rp() < p).map(([k]) => k)
  const spare = shuffle(
    PIECE_CHANCE.map(([k]) => k).filter((k) => !picks.includes(k)),
    rp,
  )
  while (picks.length < PIECES_LEAST && spare.length) picks.push(spare.pop()!)
  while (picks.length > PIECES_MOST) picks.splice(Math.floor(rp() * picks.length), 1)
  return shuffle(picks, rp)
}

/** A course's stretches with its pieces among them, each in a gap of its own (never first), so no two come together. */
function withPieces(base: BaseFeature[], kinds: PieceKind[], rp: () => number): Feature[] {
  const gaps = shuffle(
    base.map((_, i) => i + 1),
    rp,
  )
  const at = gaps.slice(0, kinds.length).sort((a, b) => a - b)
  const out: Feature[] = []
  let k = 0
  for (let i = 0; i <= base.length; i++) {
    if (at[k] === i) out.push(kinds[k++]!)
    if (i < base.length) out.push(base[i]!)
  }
  return out
}

/**
 * The test track's pieces as stretches of a day's course, each with calm track before it (where its checkpoint
 * goes) and after it. The pace ball has a way through every one: over a pad and through the mud, down a line
 * clear of the bumpers (Spec lane), past the hammers and the windmill and over a gap as they're timed for it
 * (timeThings), round the outside of a fork, and over a loop at the speed its boost pad gives.
 */
const PIECES: Record<PieceKind, (r: () => number, ctx: Turner) => Spec[]> = {
  pads(r) {
    // A boost pad down the middle, then mud over all but a lane along one edge: the mud brakes you for what
    // comes next, and the lane keeps your speed, if you can keep the marble in it.
    const w = 7
    const len = 36 + r() * 6
    const b0 = 4 + r() * 2
    const b1 = b0 + 6 + r() * 2
    const m0 = b1 + 7 + r() * 3
    const m1 = Math.min(len - 4, m0 + 9 + r() * 3)
    const mud: Zone = r() < 0.5 ? { kind: 'mud', u0: m0, u1: m1, v0: -w / 2, v1: 1.6 } : { kind: 'mud', u0: m0, u1: m1, v0: -1.6, v1: w / 2 }
    return [
      { len: 10, w, dy: -0.4 },
      { len, w, dy: -(1.2 + r() * 0.5), zones: [{ kind: 'boost', u0: b0, u1: b1, v0: -1.3, v1: 1.3 }, mud] },
    ]
  },
  bumpers(r) {
    // A wide railed table of them in rows, one in each just clear of a line through it (`lane`), on either side
    // by turns, and some further out.
    const w = 9
    const len = 24 + r() * 6
    const lane = (r() < 0.5 ? -1 : 1) * (1.1 + r() * 0.4)
    const room = w / 2 - BUMPER_R - 0.25
    const bumpers: { u: number; v: number; r: number }[] = []
    let side = r() < 0.5 ? -1 : 1
    for (let u = 6; u <= len - 5; u += 4.5 + r()) {
      const near = lane + side * (1.5 + r() * 0.3)
      if (Math.abs(near) <= room) bumpers.push({ u, v: near, r: BUMPER_R })
      const far = near + side * (2.3 + r() * 0.5)
      if (Math.abs(far) <= room && r() < 0.6) bumpers.push({ u: u + r() - 0.5, v: far, r: BUMPER_R })
      side = -side
    }
    return [
      { len: 12, w, dy: -0.5, railL: true, railR: true },
      { len, w, dy: -(1.2 + r() * 0.6), railL: true, railR: true, bumpers, lane },
    ]
  },
  hammers(r) {
    // Two or three swinging across a straight with no rails, each to a beat of its own.
    const len = 26 + r() * 8
    const n = len >= 30 ? 3 : 2
    const period = 2.4 + r() * 0.5
    const movers: MoverSpec[] = []
    for (let i = 0; i < n; i++) movers.push({ kind: 'hammer', u: 6 + ((len - 12) * i) / (n - 1), arm: 3.6, swing: 1, period: period + (r() - 0.5) * 0.3 })
    return [
      { len: 12, w: 5, dy: -0.4 },
      { len, w: 5, dy: -(0.7 + r() * 0.4), movers },
      { len: 10, w: 7, dy: -0.3 },
    ]
  },
  windmill(r) {
    // A bar turning round a post in the middle of a wide straight with no rails, a little room outside its ends.
    // The pace ball passes the post on the side where it goes round it the way the bar turns (the bar turning
    // right, a positive period: on the left): there it can slip by between the bar's two ends, where on the other
    // side the bar sweeps across its line whenever it comes.
    const len = 20 + r() * 4
    const reach = 2.5 + r() * 0.3
    const period = (r() < 0.5 ? -1 : 1) * (3.6 + r() * 0.8)
    return [
      { len: 10, w: 8, dy: -0.3 },
      { len, w: 8, dy: -0.5, movers: [{ kind: 'arm', u: len / 2, v: 0, reach, back: reach, period }], lane: -Math.sign(period) * 1.8 },
      { len: 8, w: 6.5, dy: -0.3 },
    ]
  },
  platform(r) {
    // A gap too long to jump and a slab shuttling over it, resting at either end: roll on while it rests at your
    // end and keep rolling gently, and it rests at the far end as you get there.
    const gap = 8 + r() * 2
    const slab = 5 + r()
    const period = slab / SLAB_PACE / SLAB_CROSSING + (r() - 0.5) * 0.3
    return [
      { len: 10, w: 4.4, dy: -0.5, mEnd: 0 },
      { len: 6, w: 4.4, dy: 0, mEnd: 0 },
      { len: gap, w: 4.4, gap: true, platforms: [{ u: gap / 2, du: (gap - slab) / 2, len: slab, w: 4.4, period, rest: 0.3 }] },
      { len: 8, w: 4.4, m0: 0, dy: 0, mEnd: 0 },
      { len: 6, w: 6.5, dy: -0.4 },
    ]
  },
  ice(r, ctx) {
    // A banked turn iced over from just after it starts: you can't steer through it, only into it, so slow down first.
    const R = 18 + r() * 4
    const turn = ctx.side(r, (50 + r() * 20) * (Math.PI / 180))
    const len = R * Math.abs(turn)
    return [
      { len: 10, w: 7.5, dy: -0.4 },
      { kind: 'arc', R, turn, w: 7.5, dy: -0.5, bank: 0.16, zones: [{ kind: 'ice', u0: 1.5, u1: len - 1.5 }] },
      { len: 8, w: 8, dy: -0.4 },
    ]
  },
  fork(r, ctx) {
    // A wide railed turn with a hole through its inside: round the outside, or along a plank 2 m wide across the
    // inside, much shorter. The inside is on the right turning right (v > 0), on the left turning left.
    const R = 13 + r() * 2
    const turn = ctx.side(r, (95 + r() * 20) * (Math.PI / 180))
    const len = R * Math.abs(turn)
    const hole: Hole = turn > 0 ? { u0: 5, u1: len - 4, v0: 1.5, v1: 4, railV0: true } : { u0: 5, u1: len - 4, v0: -4, v1: -1.5, railV1: true }
    return [
      { len: 10, w: 12, dy: -0.4 },
      { kind: 'arc', R, turn, w: 12, dy: -0.8, bank: 0.12, ...outerRail(turn, true), hole },
      { len: 8, w: 6, dy: -0.4 },
    ]
  },
  loop(r) {
    // A loop, with a boost pad down the middle of the way in: miss it and you're too slow to get over the top.
    const R = 4.4 + r() * 0.4
    const shift = (r() < 0.5 ? -1 : 1) * (3.8 + r() * 0.6)
    return [
      { len: 12, w: 5, dy: -0.5 },
      { len: 22, w: 4.2, dy: -0.6, zones: [{ kind: 'boost', u0: 9, u1: 19, v0: -1, v1: 1 }] },
      { kind: 'loop', R, shift, w0: 4.2, w: 2.4 },
      { len: 24, w0: 4.2, w: 6, dy: -0.4, railL: true, railR: true },
      { len: 10, w: 6.5, dy: -0.5 },
    ]
  },
}

/**
 * One try at a course from a key: its pieces laid out, or null if it ran into itself. A longer one has two
 * more stretches, with a checkpoint every third stretch as always. With `addPieces` (PIECES_FROM), two to four of
 * the test track's pieces come among its stretches too, from a random stream of their own, each with a
 * checkpoint before it. Each stands in for one of the other stretches, an iced turn or a fork for a sweeper,
 * so the course isn't much longer for them.
 */
export function tryCourse(key: string, longer = false, addPieces = false): Course | null {
  const r = mulberry32(hashString(`marble:${key}`))
  const rp = addPieces ? mulberry32(hashString(`marble-pieces:${key}`)) : null
  const kinds = rp ? piecesFor(rp) : []
  const turning = kinds.filter((k) => k === 'ice' || k === 'fork').length
  const base = recipe(r, longer, kinds.length - turning, turning)
  if (!base) return null
  const order: Feature[] = rp ? withPieces(base, kinds, rp) : base
  let net = 0
  const ctx: Turner = {
    side(rr, amount) {
      // Turn back toward the way down once the course has wandered, otherwise either way.
      let s = rr() < 0.5 ? -1 : 1
      if (Math.abs(net) > 0.5) s = -Math.sign(net)
      if (Math.abs(net + s * amount) > Math.PI + 0.35) s = -s
      net += s * amount
      return s * amount
    },
  }
  const specs: Spec[] = [
    { len: 9, w0: 6, w: 6, dy: 0, mEnd: 0, railL: true, railR: true, wallStart: true, start: true },
    { len: 14 + r() * 4, w: 6, dy: -(0.8 + r() * 0.6) },
  ]
  order.forEach((kind, i) => {
    const piece = isPiece(kind)
    const part = isPiece(kind) ? PIECES[kind](rp!, ctx) : FEATURES[kind](r, ctx)
    // A checkpoint at the start of every third stretch, and of every piece.
    if ((i > 0 && i % 3 === 0) || piece) part[0] = { ...part[0], cp: true }
    part[0] = { ...part[0], feature: kind }
    specs.push(...part)
  })
  specs.push({ len: 10, w: 6.5, dy: -0.5 })
  specs.push({ len: 16, w: 6.5, dy: 0, mEnd: 0, railL: true, railR: true, goal: true, goalU: 6, wallEnd: true })
  const pieces = layPieces(specs)
  if (crosses(pieces)) return null
  const name = `${PLACE[Math.floor(r() * PLACE.length)]} ${THING[Math.floor(r() * THING.length)]}`
  return makeCourse(pieces, { key, name, order })
}

/** Whether a course runs into or too near itself anywhere it doesn't simply carry on from itself. */
function crosses(pieces: readonly Piece[]): boolean {
  const pts: { d: number; x: number; z: number; hw: number }[] = []
  // Round a loop the track comes back over itself, as it's meant to: along the course a loop counts for nothing.
  let looped = 0
  for (const p of pieces) {
    const loop = p.kind === 'loop'
    const n = Math.max(2, Math.ceil(p.len / 2))
    for (let i = 0; i <= n; i++) {
      const u = (p.len * i) / n
      const [x, z] = point(p, u, 0)
      pts.push({ d: loop ? p.d0 - looped : p.d0 + u - looped, x, z, hw: p.gap ? 1 : halfWidth(p, u) })
    }
    if (loop) looped += p.len
  }
  for (let a = 0; a < pts.length; a++)
    for (let b = a + 1; b < pts.length; b++) {
      const A = pts[a]!
      const B = pts[b]!
      // Points near each other along the track are near each other on the ground: that's the track.
      if (B.d - A.d < 30) continue
      if (Math.hypot(A.x - B.x, A.z - B.z) < A.hw + B.hw + 5) return true
    }
  return false
}

/**
 * Course `n`'s try `attempt`, as the plan chose it (dailyPlan.ts): laid the same on every device, its hammers,
 * arms and slabs set to the plan's moments (`timing`, timeThings).
 */
export function plannedCourse(n: number, attempt: number, timing?: readonly number[]): Course {
  const course = tryCourse(`${n}:${attempt}`, n >= LONGER_FROM, n >= PIECES_FROM)
  if (!course) throw new Error(`Marble Run: course #${n} try ${attempt} doesn't lay`)
  if (timing?.length) applyTiming(course, timing)
  return course
}

/**
 * Course `n` from scratch: the first try at it that lays out and that the pace ball gets all the way down
 * without falling off or touching a bumper, a hammer or an arm, its moving pieces timed for it. The plan
 * script keeps which try that was, the pace ball's time, and the moments its pieces are set to.
 */
export function firstGoodCourse(n: number): { course: Course; attempt: number; pace: PaceRun; timing: number[] } {
  for (let attempt = 0; attempt < 200; attempt++) {
    const course = tryCourse(`${n}:${attempt}`, n >= LONGER_FROM, n >= PIECES_FROM)
    if (!course) continue
    const timing = timeThings(course)
    if (timing === null) continue
    applyTiming(course, timing)
    const pace = paceRun(course)
    if (pace.finished && !pace.touched) return { course, attempt, pace, timing }
  }
  throw new Error(`Marble Run: no course for #${n}`)
}

/* ------------------------------------------------ timing the moving pieces --- */

/** A hammer, an arm or a slab: from where along the course it can reach a ball to where it can't, and its phase. */
type Timed = { from: number; to: number; set: (phase: number) => void }

/** A course's hammers, arms and slabs, in the order they come down it. */
function timedThings(course: Course): Timed[] {
  const x = course.extras
  if (!x) return []
  const out: Timed[] = []
  for (const m of x.movers) {
    const d = m.p.d0 + m.u
    const r = (m.kind === 'hammer' ? HAMMER_HALF + HAMMER_R : Math.max(m.reach, m.back) + ARM_R) + BALL_R
    out.push({ from: d - r, to: d + r, set: (phase) => (m.phase = phase) })
  }
  for (const pl of x.platforms) out.push({ from: pl.p.d0 - 1, to: pl.p.d0 + pl.p.len + 1, set: (phase) => (pl.phase = phase) })
  return out.sort((a, b) => a.from - b.from)
}

/** Phases each moving piece is tried at, round its cycle, as the pace ball comes to it. */
const PHASES = 48
/** The fewest of them in a row that must let the pace ball by for a piece to be timed (in the middle of them). */
const PHASES_CLEAR = 4

/**
 * The moments a course's hammers, arms and slabs keep, for the plan (dailyPlan.ts `t`), in the order they come:
 * each one's phase, the middle of the phases that let the pace ball by untouched (onto a slab and off it), as it
 * comes to that one with the ones before it set. [] for a course with none; null if one lets it by at no phase.
 */
export function timeThings(course: Course): number[] | null {
  const things = timedThings(course)
  if (!things.length) return []
  const plan = racingPlan(course)
  if (!plan) return null
  const S = plan.S
  const at = { idx: 0 }
  const drive = steerer(plan, at)
  const b = newBall(course, 0)
  const out: number[] = []
  for (const th of things) {
    // Rolled on to a little short of it, where it can't reach the ball yet whatever its phase.
    while (S[at.idx]!.d < th.from - 6) {
      step(course, b, drive(b))
      if (b.lost || b.touched || b.finished || b.t > 180) return null
    }
    const clear: boolean[] = []
    for (let j = 0; j < PHASES; j++) {
      th.set((TAU * j) / PHASES)
      const c = cloneBall(b)
      const ca = { idx: at.idx }
      const cd = steerer(plan, ca)
      let by = false
      for (let n = 0; n < 240 * 30 && !c.lost && !c.touched && !c.finished; n++) {
        step(course, c, cd(c))
        if (!c.lost && !c.touched && !c.air && S[ca.idx]!.d > th.to + 2) {
          by = true
          break
        }
      }
      clear.push(by)
    }
    const phase = middleOfClear(clear)
    if (phase === null) return null
    const kept = Math.round(phase * 1000) / 1000
    th.set(kept)
    out.push(kept)
  }
  return out
}

/** The phase in the middle of the longest run of clear ones, round the cycle, or null if none is PHASES_CLEAR long. */
function middleOfClear(clear: boolean[]): number | null {
  const n = clear.length
  if (clear.every(Boolean)) return 0
  let best = 0
  let bestAt = 0
  for (let i = 0; i < n; i++) {
    // Each run counted from its start, the phase after one that isn't clear.
    if (!clear[i] || clear[(i + n - 1) % n]) continue
    let len = 0
    while (len < n && clear[(i + len) % n]) len++
    if (len > best) {
      best = len
      bestAt = i
    }
  }
  if (best < PHASES_CLEAR) return null
  return ((TAU * ((bestAt + (best - 1) / 2) % n)) / n) % TAU
}

/** A course's hammers, arms and slabs set to the plan's moments (timeThings), in the order they come down it. */
export function applyTiming(course: Course, t: readonly number[]) {
  timedThings(course).forEach((th, k) => {
    if (t[k] !== undefined) th.set(t[k]!)
  })
}

/** A ball to roll on from where another is, apart from it. */
function cloneBall(b: Ball): Ball {
  return { ...b, splits: [...b.splits], support: b.support ? { ...b.support } : null, loop: b.loop ? { ...b.loop } : null }
}

/* --------------------------------------------------------------- the test track --- */

/** The new pieces, in the order the test track has them, for its cards. */
export const LAB_PIECES = ['boost pads and mud', 'bumpers', 'hammers', 'a windmill', 'a moving platform', 'ice', 'a fork', 'a loop'] as const
/** "boost pads and mud, bumpers, …, a fork and a loop". */
export const LAB_PIECES_IN_WORDS = `${LAB_PIECES.slice(0, -1).join(', ')} and ${LAB_PIECES[LAB_PIECES.length - 1]}`

/**
 * The test track (Ramsey, 2026-10-06: try all the new pieces on one track): each in turn, calm track between
 * them and a checkpoint before each, so a fall costs only the piece it was on. It's laid by hand, the same every
 * time. From PIECES_FROM on, the day's courses have its pieces too, a few each (PIECES).
 */
export function labCourse(): Course {
  // Three hammers in step for a ball at about 7 m/s: each one 8 m on swings as the one before did 8/7 s earlier.
  const hammer = (u: number, phase: number): MoverSpec => ({ kind: 'hammer', u, arm: 3.6, swing: 1, period: 2.6, phase })
  const wave = (-TAU / 2.6) * (8 / 7)
  const bumper = (u: number, v: number) => ({ u, v, r: 0.65 })
  const specs: Spec[] = [
    { len: 9, w0: 6, w: 6, dy: 0, mEnd: 0, railL: true, railR: true, wallStart: true, start: true },
    { len: 14, w: 6, dy: -1 },
    // Boost pads and mud: a pad down the middle, then mud over all but a lane along the right edge.
    {
      len: 40,
      w: 7,
      dy: -1.4,
      zones: [
        { kind: 'boost', u0: 4, u1: 11, v0: -1.3, v1: 1.3 },
        { kind: 'mud', u0: 20, u1: 30, v0: -3.5, v1: 1.6 },
      ],
    },
    { kind: 'arc', R: 18, turn: 1.2, w: 7, dy: -0.8, bank: 0.14 },
    // Bumpers: a wide railed table of six, to be kicked about on.
    { len: 12, w: 9, dy: -0.5, cp: true, railL: true, railR: true },
    {
      len: 28,
      w: 9,
      dy: -1.6,
      railL: true,
      railR: true,
      bumpers: [bumper(6, 0), bumper(11, -2.6), bumper(11, 2.6), bumper(16, 0), bumper(21, -2.6), bumper(21, 2.6)],
    },
    { kind: 'arc', R: 16, turn: -1.3, w: 6, dy: -0.8, bank: 0.14 },
    // Hammers swinging across a straight with no rails.
    { len: 12, w: 5, dy: -0.4, cp: true },
    { len: 30, w: 5, dy: -0.9, movers: [hammer(7, 0), hammer(15, wave), hammer(23, 2 * wave)] },
    { len: 10, w: 8, dy: -0.3 },
    // A windmill: a bar through a post in the middle, turning; a ball can just pass outside its ends, unrailed.
    { len: 10, w: 8, dy: -0.3, cp: true },
    { len: 22, w: 8, dy: -0.5, movers: [{ kind: 'arm', u: 11, v: 0, reach: 2.6, back: 2.6, period: 4 }] },
    { kind: 'arc', R: 16, turn: 1.4, w: 6, dy: -0.8, bank: 0.14 },
    // A moving platform: a gap too long to jump, and a slab shuttling over it, resting 1.5 s at each end. Roll on
    // while it rests at your end and keep rolling gently, and it rests at the far end as you get there.
    { len: 12, w: 4.4, dy: -0.5, mEnd: 0, cp: true },
    { len: 8, w: 4.4, dy: 0, mEnd: 0 },
    { len: 9, w: 4.4, gap: true, platforms: [{ u: 4.5, du: 1.75, len: 5.5, w: 4.4, period: 5, rest: 0.3 }] },
    { len: 10, w: 4.4, m0: 0, dy: 0, mEnd: 0 },
    { len: 8, w: 6.5, dy: -0.4 },
    { kind: 'arc', R: 18, turn: -1.1, w: 7, dy: -0.6, bank: 0.12 },
    // Ice: a turn you can't steer through, only into, so slow down before it.
    { len: 14, w: 7.5, dy: -0.4, cp: true },
    { kind: 'arc', R: 18, turn: 1.3, w: 7.5, dy: -0.5, bank: 0.12, zones: [{ kind: 'ice', u0: 1.5, u1: 22 }] },
    { len: 10, w: 10, dy: -0.4 },
    // A fork: the wide railed lane round the outside, or a plank 2 m wide across the inside, much shorter.
    { len: 12, w: 12, dy: -0.4, cp: true },
    {
      kind: 'arc',
      R: 14,
      turn: -2.1,
      w: 12,
      dy: -0.8,
      bank: 0.12,
      railR: true,
      hole: { u0: 5, u1: 25.4, v0: -4, v1: -1.5, railV1: true },
    },
    { len: 10, w: 6, dy: -0.4 },
    // A loop, with a boost pad down the middle of the way in: miss it and you're too slow to get over the top.
    { len: 12, w: 5, dy: -0.5, cp: true },
    { len: 22, w: 4.2, dy: -0.6, zones: [{ kind: 'boost', u0: 9, u1: 19, v0: -1, v1: 1 }] },
    { kind: 'loop', R: 4.6, shift: 4.2, w0: 4.2, w: 2.4 },
    { len: 24, w0: 4.2, w: 6, dy: -0.4, railL: true, railR: true },
    { len: 10, w: 6.5, dy: -0.5 },
    { len: 16, w: 6.5, dy: 0, mEnd: 0, railL: true, railR: true, goal: true, goalU: 6, wallEnd: true },
  ]
  return makeCourse(layPieces(specs), { key: 'lab', name: 'Test Track', order: [] })
}

/* ------------------------------------------------------- a driver who knows --- */

/** A point on the middle of the track, every half metre, as the pace ball sees it. */
export type Sample = { p: Piece; u: number; x: number; z: number; y: number; h: number; d: number; k: number; off: number; coast: boolean }
export type Jump = { kick: Piece; lo: number; hi: number; aim: number }
export type RacingPlan = { S: Sample[]; v: number[]; jumps: Jump[] }

/** The middle of the track every half metre, with the speed a careful ball can take there. */
export function racingPlan(course: Course): RacingPlan | null {
  const S: Sample[] = []
  for (const p of course.pieces) {
    const n = Math.max(1, Math.round(p.len / 0.5))
    for (let i = 0; i < n; i++) {
      const u = (p.len * i) / n
      const [x, z] = point(p, u, 0)
      // Over a kicker and a jump's gap it lets the ball fly, and round a loop the tilt does nothing; over a slab's
      // gap it rolls gently on the slab.
      const coast = !!(p.kicker || (p.gap && !p.platforms) || p.kind === 'loop')
      S.push({ p, u, x, z, y: heightAt(p, u, 0), h: headingAt(p, u), d: p.d0 + u, k: p.kind === 'arc' ? 1 / p.R! : 0, off: 0, coast })
    }
  }
  const last = course.pieces[course.pieces.length - 1]!
  const [ex, ez] = point(last, last.len, 0)
  S.push({ p: last, u: last.len, x: ex, z: ez, y: heightAt(last, last.len, 0), h: headingAt(last, last.len), d: last.d0 + last.len, k: 0, off: 0, coast: false })

  // Round the posts: pass each on the side away from it.
  for (const post of course.posts) {
    for (const s of S) {
      if (s.p !== post.p) continue
      const g = Math.exp(-(((s.u - post.u) / 3.2) ** 2))
      s.off += -Math.sign(post.v) * 1.1 * g
    }
  }

  // Through a piece's bumpers or past a windmill's post, on its line (Spec lane): eased over to it before the
  // piece and back after it.
  for (const p of course.pieces) {
    if (p.lane === undefined) continue
    const a = p.d0
    const z = p.d0 + p.len
    for (const s of S) {
      const w = s.d < a + 4 ? smooth01((s.d - a + 14) / 18) : s.d > z - 3 ? smooth01((z + 9 - s.d) / 12) : 1
      if (w > 0) s.off += p.lane * w
    }
  }
  // Ice under the middle of the track: the tilt turns and brakes the ball a third as well there (ICE_GRIP).
  const icy = S.map((s) => !!s.p.zones && zoneAt(s.p, s.u, 0)?.kind === 'ice')

  const v = S.map((s, i) => {
    const p = s.p
    // Round a loop as fast as it comes; over a slab's gap, gently.
    if (p.kind === 'loop') return 24
    if (p.platforms) return SLAB_PACE
    let top = 24
    if (s.k) {
      const e = ease(p, s.u)
      const lean = (p.bank ?? 0) * e + (p.pipe ? p.pipe * e * 2.4 : 0)
      const tilt = icy[i] ? 0.5 * TILT_MAX * ICE_GRIP : 0.5 * TILT_MAX
      top = Math.min(top, Math.sqrt((ROLL * G * (tilt + lean)) / s.k))
    }
    if (2 * halfWidth(p, s.u) < 3.6) top = Math.min(top, 8.5)
    if (p.rollers) top = Math.min(top, 8)
    if (p.posts) top = Math.min(top, 7)
    if (p.bumpers || p.lane !== undefined) top = Math.min(top, 8)
    return top
  })

  // Each jump: the speeds onto its kicker that clear the gap and land on the landing, and the middle of them.
  const jumps: Jump[] = []
  for (const kick of course.pieces.filter((p) => p.kicker)) {
    const land = course.pieces[kick.index + 2]!
    const good: number[] = []
    for (let speed = 3; speed <= 18; speed += 0.25) {
      const b = placeBall(course, kick, 0.05, speed)
      let where: number | null = null
      for (let n = 0; n < 240 * 4 && !b.lost; n++) {
        step(course, b, { x: 0, z: 0 })
        if (!b.air && b.support && b.support.p !== kick && b.support.p.index !== kick.index + 1) {
          where = b.support.p === land ? b.support.u : null
          break
        }
        if (!b.air && b.support?.p === kick && b.vx * Math.cos(kick.h0) + b.vz * Math.sin(kick.h0) < 0) break
      }
      if (where != null && where > 1 && where < land.len - 6) good.push(speed)
    }
    if (good.length < 5) return null
    const lo = good[0]!
    const hi = good[good.length - 1]!
    const aim = lo + 0.45 * (hi - lo)
    jumps.push({ kick, lo, hi, aim })
    const i0 = S.findIndex((s) => s.p === kick)
    v[i0] = Math.min(v[i0]!, aim)
    // Onto the kicker at that speed and no faster; up it and over, let it fly.
    for (let i = i0 + 1; i < S.length && (S[i]!.p === kick || S[i]!.p.index === kick.index + 1); i++) v[i] = 24
  }

  // Brake in time for what's coming: most of a full tilt back, less whatever the slope takes away.
  for (let i = S.length - 2; i >= 0; i--) {
    if (S[i]!.coast) continue
    const ds = Math.max(0.1, S[i + 1]!.d - S[i]!.d)
    const grade = (S[i + 1]!.y - S[i]!.y) / ds
    const brake = icy[i] ? Math.max(0.15, ROLL * G * (0.6 * TILT_MAX * ICE_GRIP + grade)) : Math.max(0.4, ROLL * G * (0.6 * TILT_MAX + grade))
    v[i] = Math.min(v[i]!, Math.sqrt(v[i + 1]! ** 2 + 2 * brake * ds))
  }
  return { S, v, jumps }
}

/**
 * The pace ball's hands. It heads the way the track goes, turned back toward its line when it's off it,
 * at the planned speed; leans into each curve as much as the curve asks; and keeps the tilt for turning
 * first, braking with what's left, as a careful player would.
 */
export function makeDriver(plan: RacingPlan): (b: Ball) => Tilt {
  return steerer(plan, { idx: 0 })
}

/**
 * makeDriver's hands, keeping how far along the plan the ball is in `at`, so a run can be taken up from the
 * middle (timeThings). On a moving slab they go by the ball's speed on the slab, which carries it the rest; on
 * ice they lean three times as hard for the same pull (ICE_GRIP).
 */
function steerer(plan: RacingPlan, at: { idx: number }): (b: Ball) => Tilt {
  const { S, v } = plan
  return (b) => {
    let best = at.idx
    let bd = Infinity
    const bottom = b.y - BALL_R
    for (let j = Math.max(0, at.idx - 12); j < Math.min(S.length, at.idx + 80); j++) {
      const s = S[j]!
      const d = (s.x - b.x) ** 2 + (s.z - b.z) ** 2 + 0.25 * (s.y - bottom) ** 2
      if (d < bd) {
        bd = d
        best = j
      }
    }
    at.idx = best
    const here = S[at.idx]!
    const slab = !b.air && b.support?.plat ? platformPose(b.support.plat, b.t) : null
    const bvx = slab ? b.vx - slab.vx : b.vx
    const bvz = slab ? b.vz - slab.vz : b.vz
    const sp = Math.hypot(bvx, bvz)
    const nx = -Math.sin(here.h)
    const nz = Math.cos(here.h)
    // How far right of its line it is, and how fast it's going that way.
    const off = (b.x - here.x) * nx + (b.z - here.z) * nz - here.off
    const drift = bvx * nx + bvz * nz
    const soon = S[Math.min(S.length - 1, at.idx + Math.round((0.3 + 0.1 * sp) / 0.5))]!
    const dir = soon.h + clamp(-0.32 * off - (0.3 * drift) / Math.max(sp, 2), -0.6, 0.6)
    const want = v[Math.min(S.length - 1, at.idx + Math.round((1 + 0.35 * sp) / 0.5))]!
    const K = 2.4
    let ax = K * (Math.cos(dir) * want - bvx)
    let az = K * (Math.sin(dir) * want - bvz)
    if (here.k) {
      // The curve's own pull toward its middle.
      const c = sp * sp * here.k * here.p.s
      ax += c * nx
      az += c * nz
    }
    const coast = here.coast || b.air
    if (b.air) return split(bvx, bvz, ax / G, az / G, coast)
    // What the track does by itself, which the tilt needn't. A slab is level.
    let gax = 0
    let gaz = 0
    if (b.support && !slab) {
      const [mx, my, mz] = normalAt(b.support.p, b.x, b.z)
      gax = ROLL * G * my * mx
      gaz = ROLL * G * my * mz
    }
    const pull = zoneUnder(b.support)?.kind === 'ice' ? ROLL * G * ICE_GRIP : ROLL * G
    return split(bvx, bvz, (ax - gax) / pull, (az - gaz) / pull, coast)
  }
}

/** A tilt within the limit, turning first: across the way the ball goes (vx, vz), then along it with what's left. */
function split(vx: number, vz: number, tx: number, tz: number, coast: boolean): Tilt {
  const sp = Math.hypot(vx, vz)
  if (sp < 0.5) return clampTilt(tx, tz)
  const ux = vx / sp
  const uz = vz / sp
  const across = clamp(-tx * uz + tz * ux, -TILT_MAX, TILT_MAX)
  const room = Math.sqrt(TILT_MAX * TILT_MAX - across * across)
  // Over a kicker and through the air it only keeps straight.
  const along = coast ? 0 : clamp(tx * ux + tz * uz, -room, room)
  return { x: along * ux - across * uz, z: along * uz + across * ux }
}

function clampTilt(x: number, z: number): Tilt {
  const l = Math.hypot(x, z)
  return l > TILT_MAX ? { x: (x * TILT_MAX) / l, z: (z * TILT_MAX) / l } : { x, z }
}

/* ------------------------------------------------------------ a player's hands --- */

/** How much of a curve's pull toward its middle a player's marble gets by itself: the rest is theirs. */
export const TURN_HELP = 0.5

/**
 * The steadying a thumb on the stick gets (handsTilt `steady`), as Ramsey found the marble "kinda hard on a
 * phone" (2026-10-07). A stand-in phone player, a moment late and a little unsteady, mostly fell weaving off the
 * narrows: with this it fell 2.6 times a run instead of 6.3, and never on a narrow, while a quick one's times were
 * the same. The keys keep none.
 */
export const PHONE_STEADY = 1

/** The piece `d` metres down the course, and how far along it: the last piece's end, past the course's. */
export function pieceAt(course: Course, d: number): { p: Piece; u: number } {
  for (const p of course.pieces) if (d < p.d0 + p.len) return { p, u: Math.max(0, d - p.d0) }
  const last = course.pieces[course.pieces.length - 1]!
  return { p: last, u: last.len }
}

/**
 * A player's hands (x right, y forward, each −1 to 1) as a tilt, with the turning helped (Ramsey: "the
 * turning and stuff should be a little easier"). Forward is the way the track goes just ahead of the marble,
 * so holding it follows a bend, where it used to head off where the camera looked a moment before. And
 * `help` of a curve's pull toward its middle, less what its bank already gives, comes by itself, before any
 * push along it, as the pace ball's own hands turn first. The player still sets the speed, the braking and
 * the line, and can lean against the help. `camera` is the way forward while there's no track under the
 * marble yet. The blue ball never uses this: its runs, and the plan's times, are as they were.
 */
export function handsTilt(course: Course, b: Ball, hands: { x: number; y: number }, camera: number, help = TURN_HELP, steady = 0): Tilt {
  const s = b.support
  const sp = Math.hypot(b.vx, b.vz)
  let h = camera
  if (s) {
    const ahead = pieceAt(course, s.p.d0 + clamp(s.u, 0, s.p.len) + 1 + 0.25 * sp)
    h = headingAt(ahead.p, ahead.u)
  }
  const fx = Math.cos(h)
  const fz = Math.sin(h)
  const rx = -fz
  const rz = fx
  // The curve's pull where the marble is, toward its middle, less what the track's own slope gives that way.
  // On ice there's no help: it slides wide.
  let hx = 0
  let hz = 0
  if (help > 0 && s && !b.air && s.p.kind === 'arc' && zoneUnder(s)?.kind !== 'ice') {
    const c = headingAt(s.p, clamp(s.u, 0, s.p.len))
    const nx = -Math.sin(c)
    const nz = Math.cos(c)
    const pull = (sp * sp * s.p.s) / s.p.R!
    const [mx, my, mz] = normalAt(s.p, b.x, b.z)
    const own = ROLL * G * my * (mx * nx + mz * nz)
    const k = (help * (pull - own)) / (ROLL * G)
    hx = k * nx
    hz = k * nz
  }
  // Steadying (`steady`, per second): that share of the marble's slide across the track taken off by itself, as a
  // thumb a moment late can't. It keeps the line the marble is on rather than steering it anywhere; not on ice, a
  // slab, or in the air.
  if (steady > 0 && s && !b.air && !s.plat && zoneUnder(s)?.kind !== 'ice') {
    const c = headingAt(s.p, clamp(s.u, 0, s.p.len))
    const nx = -Math.sin(c)
    const nz = Math.cos(c)
    const k = -(steady * (b.vx * nx + b.vz * nz)) / (ROLL * G)
    hx += k * nx
    hz += k * nz
  }
  // Across first, the hands' and the help's; then along, with what's left.
  const across = clamp(hands.x * TILT_MAX + hx * rx + hz * rz, -TILT_MAX, TILT_MAX)
  const room = Math.sqrt(TILT_MAX * TILT_MAX - across * across)
  const along = clamp(hands.y * TILT_MAX + hx * fx + hz * fz, -room, room)
  return { x: along * fx + across * rx, z: along * fz + across * rz }
}

/**
 * The pace ball's run: its time, its checkpoint splits, and where it was 30 times a second; and whether it met a
 * bumper, a hammer or an arm on the way (a planned course's never does: firstGoodCourse).
 */
export type PaceRun = { finished: boolean; time: number; splits: number[]; ghost: number[]; plan: RacingPlan | null; touched: boolean }

/** The pace ball all the way down. */
export function paceRun(course: Course, maxT = 180): PaceRun {
  const plan = racingPlan(course)
  if (!plan) return { finished: false, time: Infinity, splits: [], ghost: [], plan: null, touched: false }
  const drive = makeDriver(plan)
  const b = newBall(course, 0)
  const ghost: number[] = []
  let n = 0
  while (!b.finished && !b.lost && b.t < maxT) {
    if (n % GHOST_EVERY === 0) ghost.push(b.x, b.y, b.z)
    step(course, b, drive(b))
    n += 1
  }
  ghost.push(b.x, b.y, b.z)
  return { finished: b.finished, time: b.time ?? Infinity, splits: b.splits, ghost, plan, touched: b.touched }
}
