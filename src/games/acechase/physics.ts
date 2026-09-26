/**
 * Ace Chase: the course and the ball. Metres and seconds; x runs right, z runs toward the tee, y is up.
 *
 * A hole is a green outlined by a polygon and walled round; a height map for its hills, ramps and
 * ravines; water filling anything below its level; a tee; and a target, a bullseye the ball has to come
 * to rest on. The target moves from round to round: each hole has a list of spots, all checked to be
 * makeable (see scripts/acechase-spots.mjs), and the ground round the target (the low rise it sits on,
 * the dish in the middle, the trough behind) goes with it.
 *
 * The ball rolls on the height map, taking 5/7 of gravity down the slope with a steady rolling drag,
 * leaves the ground wherever the ground falls away faster than the ball would fall, flies, lands with a
 * small bounce, and banks off rails it is low enough to hit. The same numbers always play out the same
 * way: the step is fixed and nothing in here is random.
 *
 * No imports, so a script can run this file with plain Node.
 */

export const G = 9.81
export const ROLL = 5 / 7
export const FRICTION = 0.07
export const BALL_R = 0.1
/** The target: a bullseye the ball has to come to rest on, its rings at these radii, the bull the first. */
export const RINGS = [0.45, 1.0, 1.6] as const
export const BULL_R = RINGS[0]
/** Each target sits in a shallow dish, deep enough that a ball that settles in it settles in the bull. */
export const DISH_D = 0.13
export const DISH_S = 0.75
/** Full power, in metres a second. */
export const MAX_SPEED = 10.5
export const WALL_E = 0.62
/** A cushion: the padded back stop behind some targets, which takes nearly all the pace off a ball. */
export const SOFT_E = 0.12
export const WALL_H = 0.26
export const WALL_T = 0.08
export const LAND_E = 0.32
export const DT = 1 / 240
export const MAX_TIME = 70
/** Off the green altogether, the ground is this far down: a ball that goes over the edge is gone. */
export const DROP = -6
/** The dials: power 0 to 100 in halves, the angle in tenths of a degree either way of straight up the hole. */
export const POWER_STEP = 0.5
export const ANGLE_STEP = 0.1
export const MAX_ANGLE = 60

export type Pt = readonly [number, number]
/** Where a target sits; on some holes the ground it sits on is raised or lowered by `lift` as well. */
export type Spot = { readonly x: number; readonly z: number; readonly lift?: number }

/** Where a hole is: a garden on a summer's day, an ice rink, or the Moon. It sets the look and the feel. */
export type Style = 'garden' | 'ice' | 'moon'
/** What losing the ball is: into the water, through a hole in the ice, or down into a crater. */
export type Lost = 'water' | 'ice' | 'crater'

export type Wall = {
  ax: number
  az: number
  bx: number
  bz: number
  /** How much of its speed across the wall a ball keeps. */
  e?: number
  /** A rail round the edge of the green, rather than one standing on it. */
  edge?: boolean
  rubber?: boolean
  soft?: boolean
  x0: number
  x1: number
  z0: number
  z1: number
}

export type Bumper = { x: number; z: number; r: number; e?: number }

export type WallDef = Omit<Wall, 'x0' | 'x1' | 'z0' | 'z1'>

/** Where a point lies on a course (see ./course): `s` metres along it, `d` across it (+ right), and the part it's in. */
export type Where = { s: number; d: number; part?: string }

export type HoleDef = {
  name: string
  note: string
  green: readonly Pt[]
  tee: Spot
  /** The ground, for a target at `t`. */
  height: (x: number, z: number, t: Spot) => number
  /** Where the target may be. Every one has been checked to have a way in. */
  spots: readonly Spot[]
  water?: number
  /** Which rails round the edge are cushions, by where their middle is. */
  soft?: (x: number, z: number) => boolean
  /** Rails standing on the green, as well as the ones round its edge. */
  walls?: readonly WallDef[]
  bumpers?: readonly Bumper[]
  style?: Style
  lost?: Lost
  /** How hard the ball is pulled down (m/s², the Earth's unless said) and how much the ground drags on it. */
  gravity?: number
  friction?: number
  /**
   * A hole laid like a road (./course), which plays a little differently: its rails are ones a ball
   * glides along, a glancing touch turning it without slowing it, as round a bend (elsewhere every touch
   * takes a little off, which stops a ball pressed along a rail within a second); a ball that comes to a
   * stop leaning on a post or a rail, on ground too steep to rest on, has stopped; and the faint creases
   * where its pieces meet don't throw the ball in the air.
   */
  laid?: boolean
  /** A laid hole's line, for the camera, and where a ball is along it, for the misses. */
  path?: readonly (readonly [number, number, number])[]
  where?: (x: number, z: number) => Where
}

export type Hole = {
  def: HoleDef
  name: string
  note: string
  green: readonly Pt[]
  tee: Spot
  target: Spot
  water?: number
  walls: readonly Wall[]
  bumpers: readonly Bumper[]
  /** Every edge is a rail, so a rolling ball can never leave the green. */
  walled: boolean
  height: (x: number, z: number) => number
  style: Style
  lost: Lost
  /** Gravity and the rolling drag, resolved. */
  g: number
  mu: number
  laid: boolean
}

export type Ball = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  air: boolean
  t: number
  done: null | 'bull' | 'rest' | 'splash' | 'out'
  /** Rails and posts it has struck hard. */
  hits: number
  /** Steps spent in the air. */
  flew: number
  /** Seconds it has sat all but still (counted on laid holes, see `step`). */
  still?: number
}

export const gauss = (x: number, z: number, x0: number, z0: number, s: number) =>
  Math.exp(-((x - x0) ** 2 + (z - z0) ** 2) / (2 * s * s))
export const band = (v: number, v0: number, s: number) => Math.exp(-((v - v0) ** 2) / (2 * s * s))
export const dish = (x: number, z: number, t: Spot) => DISH_D * gauss(x, z, t.x, t.z, DISH_S)
export const smooth = (e0: number, e1: number, v: number) => {
  const k = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)))
  return k * k * (3 - 2 * k)
}

/** Round the corners of a polygon: `r` along each edge from each corner, in `n` steps. */
export function rounded(pts: readonly Pt[], r: number, n = 6): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[(i + pts.length - 1) % pts.length]!
    const c = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    const l1 = Math.hypot(c[0] - p[0], c[1] - p[1])
    const l2 = Math.hypot(q[0] - c[0], q[1] - c[1])
    const k = Math.min(r, l1 / 2, l2 / 2)
    const a = [c[0] + ((p[0] - c[0]) * k) / l1, c[1] + ((p[1] - c[1]) * k) / l1]
    const b = [c[0] + ((q[0] - c[0]) * k) / l2, c[1] + ((q[1] - c[1]) * k) / l2]
    for (let j = 0; j <= n; j++) {
      const t = j / n
      const u = 1 - t
      out.push([u * u * a[0]! + 2 * u * t * c[0] + t * t * b[0]!, u * u * a[1]! + 2 * u * t * c[1] + t * t * b[1]!])
    }
  }
  return out
}

/** A lane: the outline of a stroke `w` wide either side of the line through `pts`. */
function lane(pts: readonly Pt[], w: number, ends = 1.2): Pt[] {
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!
    const b = pts[Math.min(pts.length - 1, i + 1)]!
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const l = Math.hypot(dx, dz) || 1
    const nx = -dz / l
    const nz = dx / l
    const p = pts[i]!
    left.push([p[0] + nx * w, p[1] + nz * w])
    right.push([p[0] - nx * w, p[1] - nz * w])
  }
  return rounded([...left, ...right.reverse()], ends)
}

/** A smooth line through points, sampled every `step` metres (Catmull-Rom). */
function curve(pts: readonly Pt[], step = 0.8): Pt[] {
  const out: Pt[] = [pts[0]!]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const t2 = t * t
      const t3 = t2 * t
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  return out
}

const thunderLine = curve([
  [0, 16],
  [0, 10],
  [2.2, 3],
  [2.2, -3],
  [-0.4, -10],
  [-0.4, -16],
])

/** Canyon Leap: how far the green climbs from the landing to the target's plateau, and where. */
const CLIMB = 2
const CLIMB_FROM = -8
const CLIMB_TO = -12
/** Canyon Leap: where the green ends. */
const END = -20.5

export const HOLE_DEFS: readonly HoleDef[] = [
  {
    name: 'Rolling Thunder',
    note: 'Three humps down a long S. Enough to get over all three, not so much it runs through the target at the end.',
    green: lane(thunderLine, 2.3, 1.6),
    tee: { x: 0, z: 14.6 },
    height: (x, z, t) =>
      0.22 * band(z, 8.5, 1.1) +
      0.34 * band(z, 0.5, 1.2) +
      0.28 * band(z, -6.5, 1.1) +
      // The target on a low rise, the ground falling away behind it into a trough at the end.
      0.16 * band(z, t.z, 1.3) -
      0.1 * smooth(t.z - 1, t.z - 2.8, z) -
      dish(x, z, t) +
      0.12 * smooth(10, 16, z),
    // Checked with scripts/acechase-spots.mjs: each has one window a player can find, 40 to 80 settings
    // across (the five near the middle of the far end gave away three times that, and are left out).
    spots: [
      { x: -1.3, z: -11.6 },
      { x: -0.85, z: -11.6 },
      { x: -1.3, z: -12.2 },
      { x: -0.85, z: -12.2 },
      { x: 0.5, z: -12.2 },
      { x: -1.3, z: -12.8 },
      { x: -0.4, z: -12.8 },
      { x: -0.85, z: -13.4 },
    ],
    // The far end is a cushion, so a shot hit too hard stays in the trough.
    soft: (_x, z) => z < -15,
  },
  {
    name: 'Canyon Leap',
    note: 'Up the ramp and over the canyon, then up the slope to the target. Too soft and it swims; too hard and it runs on into the trough.',
    green: rounded(
      [
        [-2.2, 14.2],
        [2.2, 14.2],
        [2.2, END],
        [-2.2, END],
      ],
      1.4,
    ),
    tee: { x: 0, z: 12.8 },
    water: -0.95,
    height: (x, z, t) => {
      // The run-up, then the ramp rising to its lip at z = 0.6.
      if (z > 0.6) return 0.62 * smooth(3.4, 0.6, z) ** 1.6
      // The canyon, sheer on both sides.
      if (z > -2.7) return -1.35
      // The green beyond: a flat landing longer than any jump, so every ball comes down on the level; then
      // a long climb to the target on the top, and a trough behind it.
      return -0.3 + (CLIMB + (t.lift ?? 0)) * smooth(CLIMB_FROM, CLIMB_TO, z) - 0.3 * smooth(t.z - 1.2, t.z - 2.6, z) - dish(x, z, t)
    },
    // How far along the plateau matters little once over the top, so the plateau rises or falls a little
    // with the target as well: 0.35 either way moves the power it takes from the low 80s to the mid 90s.
    spots: [
      { x: -1.4, z: -13, lift: -0.35 },
      { x: 1.4, z: -14.5, lift: -0.35 },
      { x: 0, z: -16, lift: -0.35 },
      { x: 0, z: -13, lift: 0 },
      { x: -1.4, z: -16, lift: 0 },
      { x: 1.4, z: -13, lift: 0.35 },
      { x: 0, z: -14.5, lift: 0.35 },
      { x: -1.4, z: -16, lift: 0.35 },
    ],
    soft: (_x, z) => z < END + 0.6,
  },
  {
    name: 'Switchback',
    note: 'Two corners, two rubber banks. Up the first lane, across the middle over the hump, and up the last lane to the target.',
    green: [
      [-4.2, 14.4],
      [-1.6, 14.4],
      [-1.6, -2],
      [4.2, -2],
      [4.2, -16.5],
      [1.6, -16.5],
      [1.6, -4.6],
      [-2.8, -4.6],
      [-4.2, -3.2],
    ],
    tee: { x: -2.9, z: 13 },
    height: (x, z, t) =>
      // The first lane climbs to the corner; the middle runs downhill over a hump; the last lane has a
      // saddle across it, and the target at the top.
      0.3 * smooth(13, -2, z) * smooth(-1.6, -3, x) +
      0.3 * smooth(-4.2, 1.6, x) * smooth(-2, -4.6, z) * (1 - smooth(-3, 3, x)) +
      0.2 * band(x, 0.3, 0.55) * smooth(-1.6, -2.4, z) * smooth(-4.6, -3.8, z) +
      0.24 * band(z, -9, 0.9) * smooth(1.6, 2.2, x) +
      // The target on a low rise, the ground falling away behind it into a trough at the end.
      0.15 * band(z, t.z, 1.2) -
      0.1 * smooth(t.z - 0.9, t.z - 2.1, z) -
      dish(x, z, t),
    // Further up the last lane takes more power, from about 69 to 80; across it matters little.
    spots: [
      { x: 2.5, z: -12.2 },
      { x: 3.3, z: -12.2 },
      { x: 2.9, z: -12.8 },
      { x: 2.5, z: -13.4 },
      { x: 3.3, z: -13.4 },
      { x: 2.9, z: -14 },
      { x: 2.5, z: -14.6 },
      { x: 3.3, z: -14.6 },
    ],
    // The end behind the target is a cushion: a hard shot dies in the trough instead of bouncing back.
    soft: (_x, z) => z < -16.4,
    // The corners are springy rubber, set across at 45 degrees.
    walls: [
      { ax: -4.2, az: -3.2, bx: -2.8, bz: -4.6, e: 0.9, rubber: true },
      { ax: 2.6, az: -2, bx: 4.2, bz: -3.6, e: 0.9, rubber: true },
    ],
  },
]

/** Every rail on a hole: its own, and one along every edge of the green, each with its box for a quick miss. */
function railsFor(def: HoleDef): Wall[] {
  const g = def.green
  const defs: WallDef[] = [...(def.walls ?? [])]
  for (let i = 0; i < g.length; i++) {
    const a = g[i]!
    const b = g[(i + 1) % g.length]!
    const soft = def.soft?.((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    defs.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], edge: true, ...(soft ? { soft: true, e: SOFT_E } : {}) })
  }
  const reach = BALL_R + WALL_T + 0.02
  return defs.map((w) => ({
    ...w,
    x0: Math.min(w.ax, w.bx) - reach,
    x1: Math.max(w.ax, w.bx) + reach,
    z0: Math.min(w.az, w.bz) - reach,
    z1: Math.max(w.az, w.bz) + reach,
  }))
}

const RAILS = new Map<HoleDef, Wall[]>()

/** A hole ready to play, with its target at `target`. */
export function makeHole(def: HoleDef, target: Spot): Hole {
  let walls = RAILS.get(def)
  if (!walls) {
    walls = railsFor(def)
    RAILS.set(def, walls)
  }
  return {
    def,
    name: def.name,
    note: def.note,
    green: def.green,
    tee: def.tee,
    target,
    water: def.water,
    walls,
    bumpers: def.bumpers ?? [],
    walled: true,
    height: (x, z) => def.height(x, z, target),
    style: def.style ?? 'garden',
    lost: def.lost ?? 'water',
    g: def.gravity ?? G,
    mu: def.friction ?? FRICTION,
    laid: def.laid ?? false,
  }
}

/** Whether a point is on the green: inside its outline. */
export function onGreen(hole: { green: readonly Pt[] }, x: number, z: number): boolean {
  const g = hole.green
  let inside = false
  for (let i = 0, j = g.length - 1; i < g.length; j = i++) {
    const xi = g[i]![0]
    const zi = g[i]![1]
    const xj = g[j]![0]
    const zj = g[j]![1]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** The ground: the height map on the green, far down off it. A walled green holds a rolling ball. */
export function ground(hole: Hole, x: number, z: number, rolling = false): number {
  if (rolling && hole.walled) return hole.height(x, z)
  return onGreen(hole, x, z) ? hole.height(x, z) : DROP
}

export function slope(hole: Pick<Hole, 'height'>, x: number, z: number): [number, number] {
  const e = 0.01
  return [
    (hole.height(x + e, z) - hole.height(x - e, z)) / (2 * e),
    (hole.height(x, z + e) - hole.height(x, z - e)) / (2 * e),
  ]
}

function nearestOnSegment(px: number, pz: number, w: Wall): [number, number] {
  const dx = w.bx - w.ax
  const dz = w.bz - w.az
  const l2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((px - w.ax) * dx + (pz - w.az) * dz) / l2))
  return [w.ax + dx * t, w.az + dz * t]
}

/** A new shot: `power` 0–100, `angle` in degrees off straight up the hole, right positive. */
export function launch(hole: Hole, power: number, angle: number): Ball {
  const a = (angle * Math.PI) / 180
  const speed = (MAX_SPEED * power) / 100
  const y = hole.height(hole.tee.x, hole.tee.z) + BALL_R
  return {
    x: hole.tee.x,
    y,
    z: hole.tee.z,
    vx: Math.sin(a) * speed,
    vy: 0,
    vz: -Math.cos(a) * speed,
    air: false,
    t: 0,
    done: null,
    hits: 0,
    flew: 0,
  }
}

function normalAt(hole: Hole, x: number, z: number): [number, number, number] {
  const [gx, gz] = slope(hole, x, z)
  const inv = 1 / Math.hypot(gx, 1, gz)
  return [-gx * inv, inv, -gz * inv]
}

/**
 * One step of the ball, in place. Sets `done` to 'bull' when it stops on the bull, 'rest' when it stops
 * anywhere else, 'splash' or 'out' when it is lost.
 */
export function step(hole: Hole, b: Ball): Ball {
  if (b.done) return b
  const G = hole.g
  const drag = hole.mu * G
  if (!b.air) {
    const [nx, ny, nz] = normalAt(hole, b.x, b.z)
    // Gravity along the ground, as a rolling ball feels it, and the rolling drag.
    const tx = ROLL * G * ny * nx
    const ty = ROLL * (-G + G * ny * ny)
    const tz = ROLL * G * ny * nz
    const pull = Math.hypot(tx, ty, tz)
    const hold = drag * ny
    const sp = Math.hypot(b.vx, b.vy, b.vz)
    if (sp < hold * DT * 1.5 && pull <= hold) {
      b.vx = b.vy = b.vz = 0
    } else if (sp < 1e-6) {
      b.vx += (tx - (hold * tx) / pull) * DT
      b.vy += (ty - (hold * ty) / pull) * DT
      b.vz += (tz - (hold * tz) / pull) * DT
    } else {
      b.vx += (tx - (hold * b.vx) / sp) * DT
      b.vy += (ty - (hold * b.vy) / sp) * DT
      b.vz += (tz - (hold * b.vz) / sp) * DT
    }
    // Keep it along the ground.
    const vn = b.vx * nx + b.vy * ny + b.vz * nz
    b.vx -= vn * nx
    b.vy -= vn * ny
    b.vz -= vn * nz
    b.x += b.vx * DT
    b.z += b.vz * DT
    const floor = ground(hole, b.x, b.z, true) + BALL_R
    // Where the ground falls away faster than the ball would fall, it leaves it.
    const fly = b.y + b.vy * DT - 0.5 * G * DT * DT
    if (fly > floor + (hole.laid ? 0.002 : 1e-4)) {
      b.air = true
      b.y = fly
      b.vy -= G * DT
      b.flew++
    } else {
      b.y = floor
      // Along the new ground at the same speed.
      const [hx, hz] = slope(hole, b.x, b.z)
      const s = Math.hypot(b.vx, b.vy, b.vz)
      const vy = hx * b.vx + hz * b.vz
      const s2 = Math.hypot(b.vx, vy, b.vz) || 1
      b.vx *= s / s2
      b.vz *= s / s2
      b.vy = (vy * s) / s2
    }
  } else {
    b.vy -= G * DT
    b.x += b.vx * DT
    b.y += b.vy * DT
    b.z += b.vz * DT
    if (hole.water !== undefined && b.y < hole.water + BALL_R * 0.4) {
      b.done = 'splash'
      return b
    }
    const floor = ground(hole, b.x, b.z) + BALL_R
    if (b.y <= floor) {
      if (!onGreen(hole, b.x, b.z)) {
        b.done = 'out'
        return b
      }
      b.y = floor
      const [nx, ny, nz] = normalAt(hole, b.x, b.z)
      const vn = b.vx * nx + b.vy * ny + b.vz * nz
      const hard = -vn > 1.4
      if (vn < 0) {
        const e = hard ? LAND_E : 0
        b.vx -= (1 + e) * vn * nx
        b.vy -= (1 + e) * vn * ny
        b.vz -= (1 + e) * vn * nz
        b.vx *= 0.94
        b.vz *= 0.94
      }
      if (!hard) {
        // Settled onto the ground: rolling from here.
        b.air = false
        const v2 = b.vx * nx + b.vy * ny + b.vz * nz
        b.vx -= v2 * nx
        b.vy -= v2 * ny
        b.vz -= v2 * nz
      }
    }
  }
  b.t += DT
  // Rails and posts, for a ball low enough to meet them.
  for (const w of hole.walls) {
    if (b.x < w.x0 || b.x > w.x1 || b.z < w.z0 || b.z > w.z1) continue
    const [cx, cz] = nearestOnSegment(b.x, b.z, w)
    const dx = b.x - cx
    const dz = b.z - cz
    const d = Math.hypot(dx, dz)
    const reach = BALL_R + WALL_T
    if (d >= reach || d < 1e-9) continue
    if (b.y - BALL_R > hole.height(cx, cz) + WALL_H) continue
    const nx = dx / d
    const nz = dz / d
    b.x = cx + nx * reach
    b.z = cz + nz * reach
    const vn = b.vx * nx + b.vz * nz
    if (vn < 0) {
      const e = w.e ?? WALL_E
      b.vx -= (1 + e) * vn * nx
      b.vz -= (1 + e) * vn * nz
      if (!hole.laid || -vn > 0.3) {
        b.vx *= 0.97
        b.vz *= 0.97
      }
      if (-vn > 0.3) b.hits++
    }
  }
  for (const k of hole.bumpers) {
    const dx = b.x - k.x
    const dz = b.z - k.z
    const d = Math.hypot(dx, dz)
    const reach = BALL_R + k.r
    if (d >= reach || d < 1e-9) continue
    if (b.y - BALL_R > hole.height(k.x, k.z) + WALL_H) continue
    const nx = dx / d
    const nz = dz / d
    b.x = k.x + nx * reach
    b.z = k.z + nz * reach
    const vn = b.vx * nx + b.vz * nz
    if (vn < 0) {
      b.vx -= (1 + (k.e ?? WALL_E)) * vn * nx
      b.vz -= (1 + (k.e ?? WALL_E)) * vn * nz
      if (-vn > 0.3) b.hits++
    }
  }
  if (b.air) {
    if (b.t > MAX_TIME) b.done = 'rest'
    return b
  }
  const sp = Math.hypot(b.vx, b.vy, b.vz)
  const [gx, gz] = slope(hole, b.x, b.z)
  const pull = ROLL * G * Math.hypot(gx, gz)
  // A course runs downhill steeper than a ball can rest on, so a ball can come to a stop against a post
  // or a rail it's leaning on: sat there half a second, it has stopped.
  if (hole.laid) b.still = sp < 0.012 ? (b.still ?? 0) + DT : 0
  if ((sp < 0.012 && pull <= drag) || (b.still ?? 0) > 0.5 || b.t > MAX_TIME) {
    // At rest: on the bull, that's the hole done.
    b.done = Math.hypot(b.x - hole.target.x, b.z - hole.target.z) < BULL_R ? 'bull' : 'rest'
  }
  return b
}

/** Play a shot out at once, and say how it ended. */
export function simulate(hole: Hole, power: number, angle: number) {
  const b = launch(hole, power, angle)
  let near = Infinity
  while (!b.done) {
    step(hole, b)
    const dc = Math.hypot(b.x - hole.target.x, b.z - hole.target.z)
    if (!b.air && dc < near) near = dc
  }
  return { done: b.done, x: b.x, z: b.z, t: b.t, hits: b.hits, flew: b.flew, near, miss: Math.hypot(b.x - hole.target.x, b.z - hole.target.z) }
}
