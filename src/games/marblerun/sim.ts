/**
 * Marble Run without the pictures: the course, the ball, the clock, and a driver who knows the way down.
 *
 * A course is laid like a road: pieces of track one after another, straight or curved, each with its own
 * width, slope, bank and bumps, hanging in the dark. Tilt the world and the ball rolls the way it leans.
 * Roll off an edge and it's gone: you start again at the start of the stretch you fell from (or the last
 * checkpoint, if that's nearer), and the clock keeps running while you do.
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

const TAU = Math.PI * 2
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

export type Feature = 'sweeper' | 'hairpin' | 'esses' | 'narrow' | 'drop' | 'rollers' | 'posts' | 'chute' | 'jump'

/** Rollers across a piece: humps `a` high, a `wave` apart, slanted by `k` metres along for each across. */
export type Rollers = { a: number; wave: number; k: number }

/** What a piece is to be, before it's laid. */
export type Spec = {
  kind?: 'line' | 'arc'
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
}

/** A piece of track, laid. */
export type Piece = Spec & {
  kind: 'line' | 'arc'
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
}

/** Where a point lies on a piece: `u` along it and `v` across it (right of its middle). */
export type Local = { u: number; v: number }
/** Track under a point, and how high it is there. */
export type Surface = { p: Piece; u: number; v: number; y: number }
export type Post = { p: Piece; u: number; v: number; r: number; x: number; z: number; y: number; h: number }
export type Wall = { p: Piece; u: number; dir: 1 | -1 }
/** A checkpoint or the goal: a line across a piece, `u` along it. */
export type Line = { p: Piece; u: number; d: number; spawn?: number; goal?: boolean }
/** Where a ball starts, or starts again: the start, then each checkpoint. */
export type Spawn = { p: Piece; u: number; x: number; z: number; y: number; h: number; d: number; next: number }
/** A place on the track to go back to after a fall. */
export type Safe = Omit<Spawn, 'next'>

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
  /**
   * Where a ball goes back to after a fall: the last of these it rolled past, or its checkpoint if that's
   * further on. There's one near the start of every piece but a jump's run-up, kicker and gap (from a
   * standstill there a jump can't be made), so a fall costs the fall and the stretch it was on, not
   * everything since the checkpoint.
   */
  safe: Safe[]
  minY: number
  maxY: number
  box: [number, number, number, number]
  length: number
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
    const y = heightAt(p, u, l.v)
    if (y > below) continue
    if (!best || y > best.y) best = { p, u: l.u, v: l.v, y }
  }
  return best
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
    const p: Piece = {
      ...spec,
      kind,
      len: kind === 'arc' ? spec.R! * Math.abs(spec.turn!) : spec.len!,
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
    // Where two pieces meet, the track takes the slope between theirs, unless a piece says otherwise.
    const next = specs[i + 1]
    p.m1 = spec.mEnd ?? (next?.gap || next?.m0 !== undefined || !next ? 0 : (slopeOf(spec) + slopeOf(next)) / 2)
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
    safe: [],
    minY: Infinity,
    maxY: -Infinity,
    box: [Infinity, -Infinity, Infinity, -Infinity],
    length: pieces.reduce((s, p) => s + p.len, 0),
  }
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
    if (p.gap) continue
    course.solid.push(p)
    if (p.railL || p.railR) course.railed.push(p)
    for (const k of p.posts ?? []) {
      const [x, z] = point(p, k.u, k.v)
      course.posts.push({ ...k, p, x, z, y: heightAt(p, k.u, k.v), h: 1.3 })
    }
    if (p.wallStart) course.walls.push({ p, u: 0, dir: 1 })
    if (p.wallEnd) course.walls.push({ p, u: p.len, dir: -1 })
  }

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
  for (const p of pieces) {
    if (p.start || p.gap || p.kicker || pieces[p.index + 1]?.kicker) continue
    course.safe.push(spawnAt(p, Math.min(1.8, p.len / 2)))
  }
  return course
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
  /** The last of the course's safe places it rolled past (course.safe), −1 before the first. */
  safe: number
}

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
    safe: -1,
  }
  respawn(course, b, at)
  b.next = course.spawns[at]!.next
  return b
}

/**
 * Back on the track, still, with the clock where it was: at its checkpoint (the start, for a new ball), or
 * at the last safe place it rolled past if that's further on.
 */
export function respawn(course: Course, b: Ball, at = b.cp): Ball {
  const cp = course.spawns[at]!
  const safe = b.safe >= 0 ? course.safe[b.safe] : undefined
  const sp = safe && safe.d > cp.d ? safe : cp
  b.x = sp.x
  b.z = sp.z
  b.y = sp.y + BALL_R
  b.vx = b.vy = b.vz = 0
  b.air = false
  b.lost = false
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

  const s = b.air ? null : surfaceAt(course, b.x, b.z, b.y - BALL_R + 0.5)
  if (s) {
    const [nx, ny, nz] = normalAt(s.p, b.x, b.z)
    // The pull along the track, as a rolling ball feels it, and the drags against the way it's going.
    const gn = gx * nx + gy * ny + gz * nz
    let ax = ROLL * (gx - gn * nx)
    let ay = ROLL * (gy - gn * ny)
    let az = ROLL * (gz - gn * nz)
    const sp = Math.hypot(b.vx, b.vy, b.vz)
    if (sp > 1e-6) {
      const drag = ROLLING * -gn + AIR * sp * sp
      ax -= (drag * b.vx) / sp
      ay -= (drag * b.vy) / sp
      az -= (drag * b.vz) / sp
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
    const s2 = surfaceAt(course, b.x, b.z, b.y - BALL_R + 0.5)
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
      const [mx, my, mz] = normalAt(s2.p, b.x, b.z)
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
    const under = surfaceAt(course, b.x, b.z, bottom + 0.05)
    if (under && b.y - BALL_R <= under.y) {
      b.y = under.y + BALL_R
      b.groundY = under.y
      b.support = under
      const [nx, ny, nz] = normalAt(under.p, b.x, b.z)
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

  // The last safe place it has rolled past, to go back to after a fall.
  if (!b.air && b.support) {
    const d = b.support.p.d0 + b.support.u
    while (b.safe + 1 < course.safe.length && course.safe[b.safe + 1]!.d <= d) b.safe += 1
  }

  collide(course, b)
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
const FEATURES: Record<Feature, (r: () => number, ctx: Turner) => Spec[]> = {
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
function recipe(r: () => number): Feature[] | null {
  const must: Feature[] = ['jump', 'narrow', 'drop', r() < 0.5 ? 'posts' : 'rollers']
  const turns: Feature[] = ['sweeper', 'sweeper', 'esses', 'hairpin']
  const extra: Feature[] = ['sweeper', 'rollers', 'posts', 'chute', 'esses', 'hairpin', 'drop']
  const bag = [...must, ...turns]
  const more = 2 + Math.floor(r() * 2)
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

/** One try at a course from a key: its pieces laid out, or null if it ran into itself. */
export function tryCourse(key: string): Course | null {
  const r = mulberry32(hashString(`marble:${key}`))
  const order = recipe(r)
  if (!order) return null
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
    const part = FEATURES[kind](r, ctx)
    // A checkpoint at the start of every third stretch.
    if (i > 0 && i % 3 === 0) part[0] = { ...part[0], cp: true }
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
  for (const p of pieces) {
    const n = Math.max(2, Math.ceil(p.len / 2))
    for (let i = 0; i <= n; i++) {
      const u = (p.len * i) / n
      const [x, z] = point(p, u, 0)
      pts.push({ d: p.d0 + u, x, z, hw: p.gap ? 1 : halfWidth(p, u) })
    }
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

/** Course `n`'s try `attempt`, as the plan chose it (dailyPlan.ts): laid the same on every device. */
export function plannedCourse(n: number, attempt: number): Course {
  const course = tryCourse(`${n}:${attempt}`)
  if (!course) throw new Error(`Marble Run: course #${n} try ${attempt} doesn't lay`)
  return course
}

/**
 * Course `n` from scratch: the first try at it that lays out and that the pace ball gets all the way down
 * without falling off. The plan script keeps which try that was, and the pace ball's time.
 */
export function firstGoodCourse(n: number): { course: Course; attempt: number; pace: PaceRun } {
  for (let attempt = 0; attempt < 200; attempt++) {
    const course = tryCourse(`${n}:${attempt}`)
    if (!course) continue
    const pace = paceRun(course)
    if (pace.finished) return { course, attempt, pace }
  }
  throw new Error(`Marble Run: no course for #${n}`)
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
      S.push({ p, u, x, z, y: heightAt(p, u, 0), h: headingAt(p, u), d: p.d0 + u, k: p.kind === 'arc' ? 1 / p.R! : 0, off: 0, coast: !!(p.kicker || p.gap) })
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

  const v = S.map((s) => {
    const p = s.p
    let top = 24
    if (s.k) {
      const e = ease(p, s.u)
      const lean = (p.bank ?? 0) * e + (p.pipe ? p.pipe * e * 2.4 : 0)
      top = Math.min(top, Math.sqrt((ROLL * G * (0.5 * TILT_MAX + lean)) / s.k))
    }
    if (2 * halfWidth(p, s.u) < 3.6) top = Math.min(top, 8.5)
    if (p.rollers) top = Math.min(top, 8)
    if (p.posts) top = Math.min(top, 7)
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
    const brake = Math.max(0.4, ROLL * G * (0.6 * TILT_MAX + grade))
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
  const { S, v } = plan
  let idx = 0
  return (b) => {
    let best = idx
    let bd = Infinity
    const bottom = b.y - BALL_R
    for (let j = Math.max(0, idx - 12); j < Math.min(S.length, idx + 80); j++) {
      const s = S[j]!
      const d = (s.x - b.x) ** 2 + (s.z - b.z) ** 2 + 0.25 * (s.y - bottom) ** 2
      if (d < bd) {
        bd = d
        best = j
      }
    }
    idx = best
    const here = S[idx]!
    const sp = Math.hypot(b.vx, b.vz)
    const nx = -Math.sin(here.h)
    const nz = Math.cos(here.h)
    // How far right of its line it is, and how fast it's going that way.
    const off = (b.x - here.x) * nx + (b.z - here.z) * nz - here.off
    const drift = b.vx * nx + b.vz * nz
    const soon = S[Math.min(S.length - 1, idx + Math.round((0.3 + 0.1 * sp) / 0.5))]!
    const dir = soon.h + clamp(-0.32 * off - (0.3 * drift) / Math.max(sp, 2), -0.6, 0.6)
    const want = v[Math.min(S.length - 1, idx + Math.round((1 + 0.35 * sp) / 0.5))]!
    const K = 2.4
    let ax = K * (Math.cos(dir) * want - b.vx)
    let az = K * (Math.sin(dir) * want - b.vz)
    if (here.k) {
      // The curve's own pull toward its middle.
      const c = sp * sp * here.k * here.p.s
      ax += c * nx
      az += c * nz
    }
    const coast = here.coast || b.air
    if (b.air) return split(b, ax / G, az / G, coast)
    // What the track does by itself, which the tilt needn't.
    let gax = 0
    let gaz = 0
    if (b.support) {
      const [mx, my, mz] = normalAt(b.support.p, b.x, b.z)
      gax = ROLL * G * my * mx
      gaz = ROLL * G * my * mz
    }
    return split(b, (ax - gax) / (ROLL * G), (az - gaz) / (ROLL * G), coast)
  }
}

/** A tilt within the limit, turning first: across the way the ball goes, then along it with what's left. */
function split(b: Ball, tx: number, tz: number, coast: boolean): Tilt {
  const sp = Math.hypot(b.vx, b.vz)
  if (sp < 0.5) return clampTilt(tx, tz)
  const ux = b.vx / sp
  const uz = b.vz / sp
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

/** The pace ball's run: its time, its checkpoint splits, and where it was 30 times a second. */
export type PaceRun = { finished: boolean; time: number; splits: number[]; ghost: number[]; plan: RacingPlan | null }

/** The pace ball all the way down. */
export function paceRun(course: Course, maxT = 180): PaceRun {
  const plan = racingPlan(course)
  if (!plan) return { finished: false, time: Infinity, splits: [], ghost: [], plan: null }
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
  return { finished: b.finished, time: b.time ?? Infinity, splits: b.splits, ghost, plan }
}
