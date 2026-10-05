/**
 * Lander without the pictures: the cave of the day, the ship's physics, and the blue ship, which flies every
 * cave first to prove it can be flown and to set the time to beat.
 *
 * Metres and seconds, y up. A cave is a chain of nodes down its middle, each with a half-width: the air is
 * every point inside a node's circle or between two neighbouring nodes' sides, plus a room at each end, less
 * its pillars. Everything else is rock. Met gently, rock is a bump: the ship is knocked back off it and flies
 * on. Hit hard, it's a crash: the ship is back at the last gate it passed, with the clock still running. The
 * run ends set down on the landing pad at the bottom, gently and near level.
 *
 * Ramsey found the first caves "extremely hard" (2026-10-01) and kept the landing as it was: the ship slows
 * itself (DRAG), turns a little slower and comes upright with hands off, the caves are a quarter roomier, and
 * only a hard hit crashes (BUMP_SPEED).
 *
 * No imports, so a script can run this with plain Node (scripts/lander-daily.mjs plans the days with it).
 * The caves a day is dug from depend on everything here: once a day is planned, changing the digger or the
 * physics changes that day's cave, so don't, for days people have played.
 */

export const DT = 1 / 120
/** Gravity, m/s². */
export const G = 4
/** The engine's push along the nose, m/s²: nearly three times gravity. */
export const THRUST = 11
/** How fast the ship turns, rad/s. */
export const TURN = 3
/** Air that slows the ship by itself: falling, it tops out near 14 m/s. */
export const DRAG = 0.25
export const DRAG2 = 0.003
/** Hands off both controls, the nose eases back upright this fast, rad/s. */
export const LEVEL_RATE = 1.4
/** Rock met slower than this, m/s, straight into it, is a bump: the ship is knocked back off it. Faster is a crash. */
export const BUMP_SPEED = 6
/** A bump gives back this much of the speed it came into the rock with. */
const BOUNCE = 0.35
/** Sliding along rock loses speed this fast, a share a second. */
const SCRAPE = 1.5
/** A landing is a touch on the pad no faster than this, m/s, and no more tilted than this, rad (19°). */
export const LAND_SPEED = 3.2
export const LAND_ANGLE = 0.33
/** A ghost keeps where the ship was every this many steps: 20 times a second. */
export const GHOST_EVERY = 6
/** Ghost samples a second. */
export const GHOST_RATE = 1 / (DT * GHOST_EVERY)
/** A ghost sample's numbers: x, y, the ship's angle, and its engine (ENGINE_OFF, ENGINE_ON or WRECKED). */
export const GHOST_STRIDE = 4
export const ENGINE_OFF = 0
export const ENGINE_ON = 1
/** Between a crash and the ship back at its gate: nothing to draw. */
export const WRECKED = 2
/** After a crash, how long the wreck is watched before the ship is back at its gate, in seconds. */
export const CRASH_FOR = 0.9

/** The ship, nose up: Asteroids' arrow, 2.5 m from nose to tail. The wing tips are its feet. */
export const SHIP = { nose: [0, 1.35], wing: [0.925, -0.925], notch: [0, -0.375] } as const
export const FOOT = 0.925
const HULL: readonly (readonly [number, number])[] = [
  [0, 1.35],
  [0.46, 0.21],
  [0.925, -0.925],
  [0, -0.375],
  [-0.925, -0.925],
  [-0.46, 0.21],
]

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const smooth = (t: number) => t * t * (3 - 2 * t)
const r2 = (v: number) => Math.round(v * 100) / 100

/* ------------------------------------------------------------------ random --- */

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

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** An angle brought into (−π, π]. */
export function wrap(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a <= -Math.PI) a += 2 * Math.PI
  return a
}

/* ------------------------------------------------------------------ a cave --- */

/** A point down the middle of the cave, its half-width, and how far along the cave it is. */
export type CaveNode = { x: number; y: number; r: number; s: number }
export type Pillar = { x: number; y: number; r: number }
/** A room at either end: the start's, and the landing room. */
export type Room = { x0: number; x1: number; y0: number; y1: number }
/** A pad's top: the start pad, and the landing pad (`end`). */
export type Pad = { x0: number; x1: number; y: number; end: boolean }
/** A checkpoint across the cave at node `i`, from one wall to the other. */
export type Gate = { i: number; x: number; y: number; x0: number; y0: number; x1: number; y1: number }

/** The kinds of stretch a cave is dug from. */
export type Stretch = 'shaft' | 'corridor' | 'climb' | 'zigzag' | 'squeeze' | 'chamber' | 'hairpin' | 'slant'

/** The blue ship's line: a point every metre, with the speed it may carry there. */
export type Route = { X: number[]; Y: number[]; R: number[]; V: number[]; n: number }

export type Cave = {
  /** Its number: the day's, 1 on the first day. */
  n: number
  /** The try at its number that was dug (the plan keeps which). */
  attempt: number
  name: string
  /** Its stretches, in order from the top. */
  kinds: Stretch[]
  nodes: CaveNode[]
  /** The start room, then the landing room. */
  rooms: [Room, Room]
  pillars: Pillar[]
  /** The start pad, then the landing pad. */
  pads: [Pad, Pad]
  /** Its checkpoints in order, the last at the landing room's door. */
  gates: Gate[]
  spawn: { x: number; y: number }
  /** How long the tunnel is, in metres. */
  length: number
  /** Everything there is to see: x0, x1, y0, y1. */
  box: [number, number, number, number]
  route: Route
}

/** Whether a point is in the cave's air, looking at the nodes either side of `hint`. */
export function inAir(cave: Cave, x: number, y: number, hint: number): boolean {
  for (const p of cave.pillars) if ((x - p.x) ** 2 + (y - p.y) ** 2 < p.r * p.r) return false
  for (const m of cave.rooms) if (x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1) return true
  const N = cave.nodes
  const lo = Math.max(0, hint - 26)
  const hi = Math.min(N.length - 1, hint + 26)
  for (let i = lo; i <= hi; i++) {
    const a = N[i]!
    const dx = x - a.x
    const dy = y - a.y
    if (dx * dx + dy * dy <= a.r * a.r) return true
    if (i === hi) break
    const b = N[i + 1]!
    const ex = b.x - a.x
    const ey = b.y - a.y
    const L2 = ex * ex + ey * ey
    const t = (dx * ex + dy * ey) / L2
    if (t >= 0 && t <= 1 && Math.abs(dx * ey - dy * ex) / Math.sqrt(L2) <= a.r + (b.r - a.r) * t) return true
  }
  return false
}

/** The node nearest a point, looking either side of `hint`. */
export function nearestNode(cave: Cave, x: number, y: number, hint: number): number {
  const N = cave.nodes
  let best = hint
  let bd = Infinity
  for (let i = Math.max(0, hint - 30), hi = Math.min(N.length - 1, hint + 30); i <= hi; i++) {
    const d = (x - N[i]!.x) ** 2 + (y - N[i]!.y) ** 2
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

/** Whether the whole ship, at a place and angle, is in the air. */
function hullInAir(cave: Cave, x: number, y: number, a: number, hint: number): boolean {
  for (const [hx, hy] of HULL) {
    const [wx, wy] = toWorld({ x, y, a }, hx, hy)
    if (!inAir(cave, wx, wy, hint)) return false
  }
  return true
}

/**
 * Which way is out of the rock at a point just inside it: the unit step toward the nearest air, from a
 * pillar's middle outward, toward the tunnel's middle line, or into a room.
 */
export function outOfRock(cave: Cave, x: number, y: number, hint: number): [number, number] {
  const unit = (dx: number, dy: number): [number, number] => {
    const l = Math.hypot(dx, dy) || 1
    return [dx / l, dy / l]
  }
  for (const p of cave.pillars) if ((x - p.x) ** 2 + (y - p.y) ** 2 < p.r * p.r) return unit(x - p.x, y - p.y)
  // The air nearest the point: a node's circle (how far outside its edge), or a room (how far outside it).
  let best: [number, number] = [0, 1]
  let gap = Infinity
  const N = cave.nodes
  for (let i = Math.max(0, hint - 30), hi = Math.min(N.length - 1, hint + 30); i <= hi; i++) {
    const a = N[i]!
    const d = Math.hypot(a.x - x, a.y - y) - a.r
    if (d < gap) {
      gap = d
      best = unit(a.x - x, a.y - y)
    }
  }
  for (const m of cave.rooms) {
    const cx = clamp(x, m.x0, m.x1)
    const cy = clamp(y, m.y0, m.y1)
    const d = Math.hypot(cx - x, cy - y)
    if (d > 0 && d < gap) {
      gap = d
      best = unit(cx - x, cy - y)
    }
  }
  return best
}

function crosses(ax: number, ay: number, bx: number, by: number, g: Gate): boolean {
  const d1 = (g.x1 - g.x0) * (ay - g.y0) - (g.y1 - g.y0) * (ax - g.x0)
  const d2 = (g.x1 - g.x0) * (by - g.y0) - (g.y1 - g.y0) * (bx - g.x0)
  if (d1 * d2 > 0) return false
  const e1 = (bx - ax) * (g.y0 - ay) - (by - ay) * (g.x0 - ax)
  const e2 = (bx - ax) * (g.y1 - ay) - (by - ay) * (g.x1 - ax)
  return e1 * e2 <= 0
}

/* ---------------------------------------------------------------- the ship --- */

export type Ship = {
  x: number
  y: number
  vx: number
  vy: number
  /** Its angle from nose-up, right (clockwise) positive. */
  a: number
  /** Down on the start pad, waiting for enough engine to lift off. */
  rest: boolean
  /** Back at a gate after a crash: seconds left hanging still, unless a control is touched first. */
  hold: number
  /** The node it's nearest, where the cave is looked at. */
  hint: number
  /** The last gate passed, −1 before the first. */
  gate: number
  /**
   * On a landing, how far through its step the foot met the pad, 0…1: the run's time is taken from that
   * moment, not the step's end, so landings a few milliseconds apart don't all count as the same tick.
   */
  landFrac?: number
}

/** The hands on the ship: turn −1…1 (right is +), and the engine 0…1. */
export type Hands = { turn: number; thrust: number }

/** A step's news: a crash, a bump off the rock, down on the landing pad, down gently on the start pad, or a gate passed. */
export type StepEvent = 'crash' | 'bump' | 'landed' | 'rest' | { gate: number } | null

/** A point on the ship, in the world: +y is the nose, +x the right wing. */
export function toWorld(s: { x: number; y: number; a: number }, px: number, py: number): [number, number] {
  const c = Math.cos(s.a)
  const n = Math.sin(s.a)
  return [s.x + px * c + py * n, s.y - px * n + py * c]
}

/** The ship at rest on the start pad. */
export function newShip(cave: Cave): Ship {
  return { x: cave.spawn.x, y: cave.spawn.y, vx: 0, vy: 0, a: 0, rest: true, hold: 0, hint: 0, gate: -1 }
}

/** Back at the last gate after a crash: hanging still, nose up, until the pilot touches the controls. */
export function respawn(cave: Cave, s: Ship) {
  if (s.gate < 0) {
    Object.assign(s, newShip(cave))
    return
  }
  const g = cave.gates[s.gate]!
  Object.assign(s, { x: g.x, y: g.y, vx: 0, vy: 0, a: 0, rest: false, hold: 1.2, hint: g.i })
}

/** Whether the engine is firing this step, for the flame and the ghost. */
export function engineOn(s: Ship, hands: Hands): boolean {
  return !s.rest && s.hold <= 0 && hands.thrust > 0.05
}

/** One step of DT. */
export function step(cave: Cave, s: Ship, hands: Hands, dt = DT): StepEvent {
  if (s.hold > 0) {
    if (hands.thrust > 0.02 || Math.abs(hands.turn) > 0.02) s.hold = 0
    else {
      s.hold -= dt
      return null
    }
  }
  const pa = s.a
  if (s.rest) {
    if (hands.thrust * THRUST * Math.cos(s.a) <= G + 0.05) return null
    s.rest = false
  } else {
    s.a = wrap(s.a + clamp(hands.turn, -1, 1) * TURN * dt)
    // Hands off both controls: the nose comes back upright, so letting go is a way to steady the ship.
    if (Math.abs(hands.turn) < 0.02 && hands.thrust < 0.02) s.a -= clamp(s.a, -LEVEL_RATE * dt, LEVEL_RATE * dt)
  }
  const push = clamp(hands.thrust, 0, 1) * THRUST
  const speed = Math.hypot(s.vx, s.vy)
  const drag = DRAG + DRAG2 * speed
  s.vx += (Math.sin(s.a) * push - s.vx * drag) * dt
  s.vy += (Math.cos(s.a) * push - G - s.vy * drag) * dt
  const px = s.x
  const py = s.y
  s.x += s.vx * dt
  s.y += s.vy * dt
  s.hint = nearestNode(cave, s.x, s.y, s.hint)

  // A foot on a pad, coming down onto it: a landing if it's gentle and near level, else a crash. Going up (lifting
  // off and turning as it goes), a foot that dips onto the pad only stands on it: the ship pivots on that foot.
  for (const pad of cave.pads) {
    if (py < pad.y + 0.3) continue
    for (const side of [1, -1]) {
      const [fx, fy] = toWorld(s, side * FOOT, -FOOT)
      if (fy > pad.y || fx < pad.x0 || fx > pad.x1) continue
      if (s.vy > 0) {
        // A hair above the pad, so the foot is never a rounding error into the rock under it.
        s.y += pad.y - fy + 1e-6
        continue
      }
      if (Math.hypot(s.vx, s.vy) > LAND_SPEED || Math.abs(s.a) > LAND_ANGLE) return 'crash'
      // Where the foot was as the step began (a step's turn is too small to count), so where it met the pad.
      const was = fy - (s.y - py)
      s.landFrac = was > fy ? clamp((was - pad.y) / (was - fy), 0, 1) : 1
      Object.assign(s, { y: pad.y + FOOT, vx: 0, vy: 0, a: 0 })
      if (pad.end) return 'landed'
      s.rest = true
      return 'rest'
    }
  }
  for (const [hx, hy] of HULL) {
    const [wx, wy] = toWorld(s, hx, hy)
    if (inAir(cave, wx, wy, s.hint)) continue
    // Rock. How fast the ship came straight into it says which: hard is a crash; gently, a bump, the ship back
    // where it was, its speed into the rock turned round and mostly spent, a little of its speed along it lost.
    const [nx, ny] = outOfRock(cave, wx, wy, s.hint)
    const into = -(s.vx * nx + s.vy * ny)
    if (into > BUMP_SPEED) return 'crash'
    const vn = -into
    const keep = Math.max(0, 1 - SCRAPE * dt)
    const back = vn < 0 ? -vn * BOUNCE : vn
    s.vx = (s.vx - vn * nx) * keep + back * nx
    s.vy = (s.vy - vn * ny) * keep + back * ny
    // From where it was, on along the rock with what's left: it slides, rather than sticking, where that's air.
    const sx = px + s.vx * dt
    const sy = py + s.vy * dt
    if (hullInAir(cave, sx, sy, pa, s.hint)) Object.assign(s, { x: sx, y: sy, a: pa })
    else Object.assign(s, { x: px, y: py, a: pa })
    s.hint = nearestNode(cave, s.x, s.y, s.hint)
    return 'bump'
  }
  const next = cave.gates[s.gate + 1]
  if (next && crosses(px, py, s.x, s.y, next)) {
    s.gate += 1
    return { gate: s.gate }
  }
  return null
}

/* ----------------------------------------------------------------- digging --- */

const STEP = 1.5
/** Rock left between two parts of a cave, at least, in metres. */
const WALL = 4.5
/** How far a cave may wander from the middle, either way. */
const SIDE = 92
const DOWN = -Math.PI / 2
const RIGHT = 0
const LEFT = Math.PI

type Mark = { n: number; x: number; y: number; dir: number; r: number; s: number; p: number }

/** The cave's middle, dug on from wherever it got to: a line, a bend, a turn to a heading. */
class Digger {
  x: number
  y: number
  dir: number
  r: number
  s = 0
  nodes: CaveNode[]
  pillars: Pillar[] = []

  constructor(x: number, y: number, dir: number, r: number) {
    this.x = x
    this.y = y
    this.dir = dir
    this.r = r
    this.nodes = [{ x, y, r, s: 0 }]
  }
  save(): Mark {
    return { n: this.nodes.length, x: this.x, y: this.y, dir: this.dir, r: this.r, s: this.s, p: this.pillars.length }
  }
  load(k: Mark) {
    this.nodes.length = k.n
    this.pillars.length = k.p
    this.x = k.x
    this.y = k.y
    this.dir = k.dir
    this.r = k.r
    this.s = k.s
  }
  put() {
    this.nodes.push({ x: this.x, y: this.y, r: this.r, s: this.s })
  }
  line(len: number, rTo = this.r) {
    const n = Math.max(1, Math.round(len / STEP))
    const r0 = this.r
    const d = len / n
    for (let k = 1; k <= n; k++) {
      this.x += Math.cos(this.dir) * d
      this.y += Math.sin(this.dir) * d
      this.s += d
      this.r = r0 + (rTo - r0) * smooth(k / n)
      this.put()
    }
  }
  /** Round a bend of `radius`, turning by `turn` (left is +). */
  bend(radius: number, turn: number, rTo = this.r) {
    const len = Math.abs(turn) * radius
    const n = Math.max(2, Math.round(len / STEP))
    const r0 = this.r
    const da = turn / n
    const chord = 2 * radius * Math.sin(Math.abs(da) / 2)
    for (let k = 1; k <= n; k++) {
      const mid = this.dir + da / 2
      this.x += Math.cos(mid) * chord
      this.y += Math.sin(mid) * chord
      this.dir += da
      this.s += len / n
      this.r = r0 + (rTo - r0) * smooth(k / n)
      this.put()
    }
    this.dir = wrap(this.dir)
  }
  turnTo(dir: number, radius: number, rTo = this.r) {
    const t = wrap(dir - this.dir)
    if (Math.abs(t) > 0.01) this.bend(Math.max(radius, Math.max(this.r, rTo) + 1.6), t, rTo)
  }
  get level() {
    return Math.abs(Math.sin(this.dir)) < 0.2
  }
}

const within = (rng: () => number, a: number, b: number) => a + (b - a) * rng()

/** Which way a sideways stretch runs: back toward the middle when the cave has wandered far out. */
function sideways(d: Digger, rng: () => number) {
  if (d.x > 40) return LEFT
  if (d.x < -40) return RIGHT
  return rng() < 0.5 ? LEFT : RIGHT
}

function pillarAt(d: Digger, i: number, lateral: number, r: number) {
  const N = d.nodes
  const a = N[Math.max(0, i - 2)]!
  const b = N[Math.min(N.length - 1, i + 2)]!
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = -(b.y - a.y) / L
  const ny = (b.x - a.x) / L
  d.pillars.push({ x: N[i]!.x + nx * lateral, y: N[i]!.y + ny * lateral, r })
}

/** Each kind of stretch digs on from where the last left off; false if it can't from here. */
const STRETCHES: Record<Stretch, (d: Digger, rng: () => number) => false | void> = {
  /** Straight down: fall, then brake before the bottom. */
  shaft(d, rng) {
    const r = within(rng, 5.8, 7)
    d.turnTo(DOWN, d.r + within(rng, 2, 4), r)
    d.line(within(rng, 22, 38), r)
  },
  /** Level, left or right, sometimes over a hump. */
  corridor(d, rng) {
    const side = sideways(d, rng)
    const r = within(rng, 5.3, 6.3)
    d.turnTo(side, d.r + within(rng, 2, 4), r)
    d.line(within(rng, 8, 14))
    if (rng() < 0.6) {
      const up = side === RIGHT ? 1 : -1
      const k = within(rng, 0.3, 0.5)
      const R = within(rng, 10, 16)
      d.bend(R, up * k)
      d.bend(R, -2 * up * k)
      d.bend(R, up * k)
    }
    d.line(within(rng, 8, 14))
  },
  /** Up a chimney and on the same way: the engine against gravity. */
  climb(d, rng) {
    if (!d.level) return false
    const right = Math.cos(d.dir) > 0
    const R = d.r + within(rng, 2, 3.5)
    d.bend(R, right ? Math.PI / 2 : -Math.PI / 2)
    d.line(within(rng, 10, 18), within(rng, 6, 7))
    d.bend(d.r + within(rng, 2, 3.5), right ? -Math.PI / 2 : Math.PI / 2)
    d.line(within(rng, 5, 9))
  },
  /** Down in switchbacks, left and right. */
  zigzag(d, rng) {
    const r = within(rng, 5.3, 5.9)
    d.turnTo(DOWN, d.r + 3, r)
    const legs = 3 + Math.floor(rng() * 2)
    let side = rng() < 0.5 ? 1 : -1
    for (let k = 0; k < legs; k++) {
      d.turnTo(DOWN + side * within(rng, 0.75, 0.95), r + within(rng, 1.8, 2.6))
      d.line(within(rng, 12, 17))
      side = -side
    }
    d.turnTo(DOWN, r + 2.2)
  },
  /** A narrow pass: the cave's tightest, still a ship and a half either side of the middle. */
  squeeze(d, rng) {
    const r = within(rng, 4.3, 4.7)
    d.line(6, r)
    d.line(within(rng, 10, 16), r)
    d.line(6, within(rng, 5.5, 6.2))
  },
  /** A wide hall with pillars in the way. */
  chamber(d, rng) {
    const R = within(rng, 9.5, 11)
    d.line(9, R)
    const i0 = d.nodes.length
    d.line(within(rng, 18, 26), R)
    const i1 = d.nodes.length - 1
    if (rng() < 0.5) pillarAt(d, Math.round((i0 + i1) / 2), within(rng, -1.2, 1.2), within(rng, 2.6, 3.4))
    else {
      const side = rng() < 0.5 ? 1 : -1
      pillarAt(d, Math.round(i0 + (i1 - i0) * 0.28), side * within(rng, 3, 4), within(rng, 2, 2.6))
      pillarAt(d, Math.round(i0 + (i1 - i0) * 0.74), -side * within(rng, 3, 4), within(rng, 2, 2.6))
    }
    d.line(9, within(rng, 5.5, 6.2))
  },
  /** Round a U-bend underneath and back the other way. */
  hairpin(d, rng) {
    if (!d.level) return false
    const right = Math.cos(d.dir) > 0
    d.line(within(rng, 4, 8))
    d.bend(d.r + within(rng, 4, 5.5), right ? -Math.PI : Math.PI)
    d.line(within(rng, 6, 12))
  },
  /** A long slant down. */
  slant(d, rng) {
    const r = within(rng, 5.4, 6.4)
    const lean = within(rng, 0.65, 0.85)
    const dir = d.x > 38 ? DOWN - lean : d.x < -38 ? DOWN + lean : DOWN + (rng() < 0.5 ? lean : -lean)
    d.turnTo(dir, d.r + within(rng, 2, 4), r)
    d.line(within(rng, 18, 28))
  },
}

// Climbs and squeezes the least: a chimney against gravity, and the tightest pass.
const WEIGHTS: Record<Stretch, number> = { shaft: 3, corridor: 3, climb: 0.6, zigzag: 2, squeeze: 1, chamber: 1.3, hairpin: 1.5, slant: 2.2 }

function pickKind(rng: () => number, kinds: Stretch[], d: Digger, tried: Set<Stretch>): Stretch | null {
  const last = kinds[kinds.length - 1]
  const count = (k: Stretch) => kinds.filter((x) => x === k).length
  const options = (Object.entries(WEIGHTS) as [Stretch, number][]).filter(
    ([k]) =>
      k !== last &&
      !tried.has(k) &&
      !((k === 'climb' || k === 'hairpin') && (count(k) >= 2 || !d.level)) &&
      !((k === 'chamber' || k === 'squeeze') && count(k) >= 2),
  )
  if (!options.length) return null
  let x = rng() * options.reduce((a, [, w]) => a + w, 0)
  for (const [k, w] of options) {
    x -= w
    if (x <= 0) return k
  }
  return options[options.length - 1]![0]
}

function rectGap(m: Room, x: number, y: number) {
  const dx = Math.max(m.x0 - x, 0, x - m.x1)
  const dy = Math.max(m.y0 - y, 0, y - m.y1)
  return Math.hypot(dx, dy)
}

/** The nodes from `from` on stay inside the cave's bounds and keep rock between them and the rest of it. */
function clear(d: Digger, from: number, start: Room) {
  const N = d.nodes
  for (let j = from; j < N.length; j++) {
    const p = N[j]!
    if (Math.abs(p.x) > SIDE) return false
    if (p.s > 30 && (p.y > -6 || rectGap(start, p.x, p.y) < p.r + WALL)) return false
    for (let i = 0; i < j; i++) {
      const q = N[i]!
      if (p.s - q.s < 28) continue
      if (Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r + WALL) return false
    }
  }
  return true
}

const FIRST = ['Amber', 'Velvet', 'Static', 'Ember', 'Nova', 'Echo', 'Cobalt', 'Midnight', 'Lantern', 'Copper', 'Signal', 'Silent', 'Ultra', 'Violet', 'Neon', 'Hollow']
const SECOND = ['Well', 'Grotto', 'Chasm', 'Vault', 'Burrow', 'Shaft', 'Crevice', 'Drift', 'Warren', 'Rift', 'Deep', 'Mine', 'Throat', 'Cellar', 'Hollow', 'Sink']

/** Cave `n`'s name: the same for every try at its number. */
export function caveName(n: number): string {
  const rng = mulberry32(hashString(`lander-name:${n}`))
  const a = FIRST[Math.floor(rng() * FIRST.length)]!
  let b = SECOND[Math.floor(rng() * SECOND.length)]!
  if (b === a) b = 'Deep'
  return `${a} ${b}`
}

/** Dig cave `n`'s try `attempt`; null when it dug itself into a corner. */
export function dig(n: number, attempt = 0): Cave | null {
  const rng = mulberry32(hashString(`lander:${n}:${attempt}`))
  const start: Room = { x0: -11, x1: 11, y0: 0, y1: 13 }
  const d = new Digger(5.5, 2.5, DOWN, 5.8)
  const target = within(rng, 370, 450)
  const kinds: Stretch[] = ['shaft']
  const ends: number[] = []
  STRETCHES.shaft(d, rng)
  ends.push(d.nodes.length - 1)
  let stuck = 0
  while (d.s < target) {
    const tried = new Set<Stretch>()
    let done = false
    while (!done) {
      const kind = pickKind(rng, kinds, d, tried)
      if (!kind) break
      tried.add(kind)
      const k = d.save()
      if (STRETCHES[kind](d, rng) !== false && clear(d, k.n, start)) {
        kinds.push(kind)
        ends.push(d.nodes.length - 1)
        done = true
      } else d.load(k)
    }
    if (!done && ++stuck > 3) return null
  }

  // Down into the landing room, with the pad off to one side of where the cave comes in.
  const k = d.save()
  d.turnTo(DOWN, d.r + 3, 5.8)
  d.line(10, 5.8)
  if (!clear(d, k.n, start)) return null
  const last = d.nodes[d.nodes.length - 1]!
  const side = last.x > 20 ? -1 : last.x < -20 ? 1 : rng() < 0.5 ? -1 : 1
  const padX = last.x + side * within(rng, 5, 8)
  const cx = (last.x + padX) / 2
  const end: Room = { x0: cx - 12.5, x1: cx + 12.5, y0: last.y - 13.5, y1: last.y - 1.5 }
  for (const q of d.nodes) if (q.s < last.s - 24 && rectGap(end, q.x, q.y) < q.r + WALL) return null

  const nodes = d.nodes
  // A checkpoint after every third stretch, and one at the landing room's door.
  const gates: Gate[] = []
  for (let k2 = 2; k2 < ends.length - 1; k2 += 3) gates.push(gateAt(nodes, ends[k2]!))
  gates.push(gateAt(nodes, nodes.length - 1))

  const spawn = { x: -5.5, y: FOOT }
  const pads: [Pad, Pad] = [
    { x0: -9.2, x1: -1.8, y: 0, end: false },
    { x0: padX - 3.6, x1: padX + 3.6, y: end.y0, end: true },
  ]
  const rooms: [Room, Room] = [start, end]
  const box = boxOf(nodes, rooms)
  return {
    n,
    attempt,
    name: caveName(n),
    kinds,
    nodes,
    rooms,
    pillars: d.pillars,
    pads,
    gates,
    spawn,
    length: d.s,
    box,
    route: planRoute(nodes, d.pillars, spawn, end, padX),
  }
}

function gateAt(nodes: CaveNode[], i: number): Gate {
  const a = nodes[Math.max(0, i - 1)]!
  const b = nodes[Math.min(nodes.length - 1, i + 1)]!
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = -(b.y - a.y) / L
  const ny = (b.x - a.x) / L
  const p = nodes[i]!
  const w = p.r + 0.6
  return { i, x: p.x, y: p.y, x0: p.x + nx * w, y0: p.y + ny * w, x1: p.x - nx * w, y1: p.y - ny * w }
}

function boxOf(nodes: CaveNode[], rooms: readonly Room[]): [number, number, number, number] {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of nodes) {
    x0 = Math.min(x0, p.x - p.r)
    x1 = Math.max(x1, p.x + p.r)
    y0 = Math.min(y0, p.y - p.r)
    y1 = Math.max(y1, p.y + p.r)
  }
  for (const m of rooms) {
    x0 = Math.min(x0, m.x0)
    x1 = Math.max(x1, m.x1)
    y0 = Math.min(y0, m.y0)
    y1 = Math.max(y1, m.y1)
  }
  return [x0, x1, y0, y1]
}

/* --------------------------------------------------------------- the pilot --- */

const A_LAT = 7
const A_BRAKE = 4.5
const A_GO = 5
const V_TOP = 16

/**
 * The blue ship's line: off the start pad, over to the hole, down the middle of the cave, across the landing
 * room and down onto the pad; a point every metre, each with the speed it may carry there.
 */
function planRoute(nodes: CaveNode[], pillars: Pillar[], spawn: { x: number; y: number }, end: Room, padX: number): Route {
  const pts = [
    { x: spawn.x, y: spawn.y, r: 6 },
    { x: spawn.x, y: 5.5, r: 6 },
    { x: 0, y: 7, r: 6 },
    { x: 5.5, y: 6, r: 6 },
    ...nodes,
    { x: padX, y: end.y0 + 4.5, r: 6 },
    { x: padX, y: end.y0 + FOOT, r: 6 },
  ]
  const X: number[] = []
  const Y: number[] = []
  const R: number[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const L = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.round(L))
    for (let k = 0; k < n; k++) {
      const f = k / n
      X.push(a.x + (b.x - a.x) * f)
      Y.push(a.y + (b.y - a.y) * f)
      R.push(a.r + (b.r - a.r) * f)
    }
  }
  const tail = pts[pts.length - 1]!
  X.push(tail.x)
  Y.push(tail.y)
  R.push(tail.r)
  const n = X.length
  aroundPillars(pillars, X, Y, R)
  // How sharply the line turns at each point, over three metres either side so the nodes' kinks don't count.
  const bendAt = new Array<number>(n).fill(0)
  for (let i = 3; i < n - 3; i++) {
    const a1 = Math.atan2(Y[i]! - Y[i - 3]!, X[i]! - X[i - 3]!)
    const a2 = Math.atan2(Y[i + 3]! - Y[i]!, X[i + 3]! - X[i]!)
    bendAt[i] = Math.abs(wrap(a2 - a1)) / 3
  }
  const V = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    let k = 0
    for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) k = Math.max(k, bendAt[j]!)
    V[i] = Math.min(V_TOP, Math.sqrt(A_LAT / Math.max(k, 0.002)), 2.1 * R[i]! + 2)
  }
  V[n - 1] = 1
  V[0] = 0
  for (let i = n - 2; i >= 0; i--) V[i] = Math.min(V[i]!, Math.sqrt(V[i + 1]! ** 2 + 2 * A_BRAKE))
  for (let i = 1; i < n; i++) V[i] = Math.min(V[i]!, Math.sqrt(V[i - 1]! ** 2 + 2 * A_GO))
  return { X, Y, R, V, n }
}

/**
 * The line swings round each pillar on its roomier side, clearing it by a ship and a half: moved sideways only,
 * as far as the pillar needs, then eased so the swing has no corners.
 */
function aroundPillars(pillars: Pillar[], X: number[], Y: number[], R: number[]) {
  if (!pillars.length) return
  const n = X.length
  const nx = new Array<number>(n)
  const ny = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2)
    const b = Math.min(n - 1, i + 2)
    const L = Math.hypot(X[b]! - X[a]!, Y[b]! - Y[a]!) || 1
    nx[i] = -(Y[b]! - Y[a]!) / L
    ny[i] = (X[b]! - X[a]!) / L
  }
  const lat = new Array<number>(n).fill(0)
  const rules = pillars.map((p) => {
    let k = 0
    let bd = Infinity
    for (let i = 0; i < n; i++) {
      const d = (X[i]! - p.x) ** 2 + (Y[i]! - p.y) ** 2
      if (d < bd) {
        bd = d
        k = i
      }
    }
    const o = (p.x - X[k]!) * nx[k]! + (p.y - Y[k]!) * ny[k]!
    return { k, o, side: o > 0.05 ? -1 : o < -0.05 ? 1 : -1, need: p.r + 2.8 }
  })
  const hold = () => {
    for (const q of rules)
      for (let i = Math.max(0, q.k - 12); i <= Math.min(n - 1, q.k + 12); i++) {
        const u = i - q.k
        if (Math.abs(u) >= q.need) continue
        const w = Math.sqrt(q.need * q.need - u * u)
        lat[i] = q.side < 0 ? Math.min(lat[i]!, q.o - w) : Math.max(lat[i]!, q.o + w)
      }
  }
  for (let pass = 0; pass < 24; pass++) {
    hold()
    const eased = lat.slice()
    for (let i = 1; i < n - 1; i++) {
      let sum = 0
      let c = 0
      for (let j = Math.max(0, i - 6); j <= Math.min(n - 1, i + 6); j++) {
        sum += lat[j]!
        c++
      }
      eased[i] = sum / c
    }
    for (let i = 0; i < n; i++) lat[i] = eased[i]!
  }
  hold()
  for (let i = 0; i < n; i++) {
    const room = Math.max(0, R[i]! - 2.2)
    const l = clamp(lat[i]!, -room, room)
    X[i] = X[i]! + nx[i]! * l
    Y[i] = Y[i]! + ny[i]! * l
  }
}

export type PilotStyle = { grip?: number; look?: number; lookSpeed?: number; turnGrip?: number }

/** The blue ship's hands: steer for a point along the line ahead, at the line's speed. */
export function makePilot(cave: Cave, { grip = 2.6, look = 2.5, lookSpeed = 0.3, turnGrip = 7 }: PilotStyle = {}): (s: Ship) => Hands {
  const P = cave.route
  let i = 0
  return (s) => {
    let best = i
    let bd = Infinity
    for (let k = Math.max(0, i - 4), hi = Math.min(P.n - 1, i + 40); k <= hi; k++) {
      const d = (P.X[k]! - s.x) ** 2 + (P.Y[k]! - s.y) ** 2
      if (d < bd) {
        bd = d
        best = k
      }
    }
    i = best
    const speed = Math.hypot(s.vx, s.vy)
    const la = Math.min(P.n - 1, i + Math.round(look + lookSpeed * speed))
    const tx = P.X[la]! - s.x
    const ty = P.Y[la]! - s.y
    const tl = Math.hypot(tx, ty) || 1
    const vt = P.V[Math.min(P.n - 1, i + 1)]!
    let ax = grip * ((tx / tl) * vt - s.vx)
    let ay = grip * ((ty / tl) * vt - s.vy)
    const am = Math.hypot(ax, ay)
    if (am > 9) {
      ax *= 9 / am
      ay *= 9 / am
    }
    // Down is gravity's job: never turn the nose down to push that way.
    ay = Math.max(ay, -0.85 * G)
    const drag = DRAG + DRAG2 * speed
    const fx = ax + s.vx * drag
    const fy = ay + G + s.vy * drag
    const err = wrap(Math.atan2(fx, fy) - s.a)
    const turn = clamp(err * turnGrip, -1, 1)
    const thrust = Math.abs(err) < 1.3 ? clamp((Math.hypot(fx, fy) / THRUST) * Math.cos(err) ** 2, 0, 1) : 0
    return { turn, thrust }
  }
}

/* ----------------------------------------------------------------- flights --- */

/** A run as its ghost flies it: its time, when it passed each gate and landed, and where it was. */
export type Flight = {
  landed: boolean
  time: number
  /** Each gate's moment, then the landing's: the last is the run's time. */
  splits: number[]
  /** GHOST_STRIDE numbers a sample (GHOST_RATE a second from the go), and the landing's moment last. */
  ghost: number[]
  crashes: number
}

/**
 * A ship flown down the cave by `hands` until it lands or `limit` seconds go by: crashes and all, back at
 * the last gate after each. The blue ship's run is this with its pilot's hands (paceRun).
 */
export function flyWith(cave: Cave, hands: (s: Ship) => Hands, limit = 150, crashLimit = Infinity): Flight {
  const s = newShip(cave)
  const ghost: number[] = []
  const splits: number[] = []
  let crashes = 0
  let wreck = 0
  let steps = 0
  while (steps * DT < limit) {
    if (wreck > 0) {
      if (steps % GHOST_EVERY === 0) ghost.push(r2(s.x), r2(s.y), r2(s.a), WRECKED)
      steps++
      wreck -= DT
      if (wreck <= 0) respawn(cave, s)
      continue
    }
    const input = hands(s)
    if (steps % GHOST_EVERY === 0) ghost.push(r2(s.x), r2(s.y), r2(s.a), engineOn(s, input) ? ENGINE_ON : ENGINE_OFF)
    const ev = step(cave, s, input)
    steps++
    // The blue ship's run (crashLimit 0) never touches rock: for it a bump is a crash.
    if (ev === 'crash' || (ev === 'bump' && crashLimit === 0)) {
      crashes++
      if (crashes > crashLimit) break
      wreck = CRASH_FOR
    } else if (ev === 'landed') {
      const time = steps * DT
      splits.push(time)
      ghost.push(r2(s.x), r2(s.y), 0, ENGINE_OFF)
      return { landed: true, time, splits, ghost, crashes }
    } else if (ev && typeof ev === 'object') splits.push(steps * DT)
  }
  return { landed: false, time: Infinity, splits, ghost, crashes }
}

/** The blue ship down the cave, never crashing: its first touch of rock ends its run. */
export function paceRun(cave: Cave): Flight {
  return flyWith(cave, makePilot(cave), 150, 0)
}

/** A blue ship landing in this many seconds makes a cave fair: not a sprint, not a slog. */
export const PACE_FROM = 42
export const PACE_TO = 80

/** Cave `n`'s try `attempt`, as the plan chose it (dailyPlan.ts): dug the same on every device. */
export function plannedCave(n: number, attempt: number): Cave {
  const cave = dig(n, attempt)
  if (!cave) throw new Error(`Lander: cave #${n} try ${attempt} doesn't dig`)
  return cave
}

/**
 * Cave `n` from scratch: the first try that digs through and that the blue ship flies and lands in a fair
 * time without touching rock. The plan script keeps which try that was, and the blue ship's time.
 */
export function firstGoodCave(n: number): { cave: Cave; attempt: number; pace: Flight } {
  for (let attempt = 0; attempt < 60; attempt++) {
    const cave = dig(n, attempt)
    if (!cave) continue
    const pace = paceRun(cave)
    if (pace.landed && pace.time >= PACE_FROM && pace.time <= PACE_TO) return { cave, attempt, pace }
  }
  throw new Error(`Lander: no cave for #${n}`)
}

/** How deep a cave goes, from the start pad to the landing pad, in metres. */
export function caveDepth(cave: Cave): number {
  return cave.pads[0].y - cave.pads[1].y
}
