/**
 * Ace Chase: the course and the ball. Metres and seconds; x runs right, z runs toward the tee, y is up.
 *
 * A hole is a green outlined by a polygon and walled round; a height map for its hills, ramps and
 * ravines; water filling anything below its level; a tee; and a target, a bullseye the ball has to come
 * to rest on. Each day's hole (./daily) has its target where the day's plan put it, checked to be
 * makeable (see scripts/acechase-daily.mjs), and the ground round the target (the low rise it sits on,
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
/** How many times harder sand drags on a ball than the green does. */
export const SAND = 4
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
  /** A wall with a name ("the wall") is named in the misses when a ball strikes it: "off the wall". */
  name?: string
  x0: number
  x1: number
  z0: number
  z1: number
}

export type Bumper = {
  x: number
  z: number
  r: number
  e?: number
  /** A boulder rather than a post: drawn as one, and named in the misses ("off a rock"). */
  rock?: boolean
}

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
  /** Which rails round the edge are rubber, by where their middle is, and how springy (see Wall.e). */
  rubber?: (x: number, z: number) => number | undefined
  /**
   * A name for the plain rails round the edge ("the rail"), on a hole where a ball only meets one if its
   * aim is out: then the misses say so, as they do for a post or a named wall.
   */
  rail?: string
  /** Rails standing on the green, as well as the ones round its edge. */
  walls?: readonly WallDef[]
  bumpers?: readonly Bumper[]
  style?: Style
  /** How plainly the green's colour shows its heights, lighter up and darker down: 1 unless said. */
  relief?: number
  /** Where the green is sand, a bunker, which drags on a ball SAND times as hard. */
  sand?: (x: number, z: number) => boolean
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
  sand?: (x: number, z: number) => boolean
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
  /** Posts it has struck hard: counted for the misses ("off a post"), not played with. */
  posts?: number
  /** The last named wall, or rock, it struck, for the misses. */
  struck?: string
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

/** Every rail on a hole: its own, and one along every edge of the green, each with its box for a quick miss. */
function railsFor(def: HoleDef): Wall[] {
  const g = def.green
  const defs: WallDef[] = [...(def.walls ?? [])]
  for (let i = 0; i < g.length; i++) {
    const a = g[i]!
    const b = g[(i + 1) % g.length]!
    const mx = (a[0] + b[0]) / 2
    const mz = (a[1] + b[1]) / 2
    const soft = def.soft?.(mx, mz)
    const rubber = soft ? undefined : def.rubber?.(mx, mz)
    defs.push({
      ax: a[0],
      az: a[1],
      bx: b[0],
      bz: b[1],
      edge: true,
      ...(soft ? { soft: true, e: SOFT_E } : rubber !== undefined ? { rubber: true, e: rubber } : def.rail ? { name: def.rail } : {}),
    })
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
    sand: def.sand,
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
  const drag = hole.mu * G * (hole.sand?.(b.x, b.z) ? SAND : 1)
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
    // On a laid hole a ball can roll into water down a bank, not only drop into it: it's lost either way.
    if (hole.laid && hole.water !== undefined && hole.height(b.x, b.z) + BALL_R < hole.water + BALL_R * 0.4) {
      b.t += DT
      b.done = 'splash'
      return b
    }
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
      // Named for the misses however softly it came at it: a slow ball drifting on to a rail was aimed
      // out just as a fast one was.
      if (w.name && -vn > 0.05) b.struck = w.name
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
      if (k.rock) {
        if (-vn > 0.3) b.hits++
        if (-vn > 0.05) b.struck = 'a rock'
      } else if (-vn > 0.3) {
        b.hits++
        b.posts = (b.posts ?? 0) + 1
      }
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
  return { done: b.done, x: b.x, z: b.z, t: b.t, hits: b.hits, posts: b.posts ?? 0, struck: b.struck, flew: b.flew, near, miss: Math.hypot(b.x - hole.target.x, b.z - hole.target.z) }
}
