/**
 * Wobble Run's bots (design-final §5.1): hands that run a course along its route graph by driving the real
 * step(), never a shortcut through the physics.
 *
 * Each round's builder gives a route graph: nodes a bot may wait at (`safe`) or must pass through (`no`), and
 * edges to run, jump, dive, bounce or slide along. A segment is the way from one safe node to the next through
 * any `no` nodes. The edge executor (Driver) steers by pure pursuit, presses JUMP and DIVE where the edge says, and
 * reports getting there or failing (hit, splat, out of time).
 *
 * The blue bean is careful hands (BLUE_HANDS): main edges only, everything 0.35 m bigger than it is, a 0.4 s look
 * round at every safe spot, and setting off a reaction late (0.35 s) once a way it had to wait for is clear.
 * planRoute finds when to set off from every safe node by trying: depart now, and if the simulated segment is
 * untouched with that margin, go; if not, wait 1/30 s and try again. Over the whole graph that's an earliest-arrival search (waiting at a safe node never hurts, so the
 * first time a node is reached is the time to keep). What the blue chose is kept as a route string (the plan's
 * blueRoutes.ts): the segment it took from each safe node and how long it waited there. replayBlue runs that route
 * through the same executor, so the browser gets the blue's run in one pass, with no search.
 *
 * FAST_HANDS take the gold lines too with a small margin and no reaction time: the floor the medals are checked
 * against. PHONE_HANDS react 0.55 s late, steer ±8° off and press up to 0.08 s late: the fairness check.
 */
import { ACC_GROUND, AIR_DIVE_VY, DIVE, DIVE_ADD, G, newPose, newRun, restore, RUN, snapshot, solidPose, STEP, step, windLift, type Snapshot } from './sim.ts'
import { makeRng } from './rng.ts'
import type { Counts, Course, GraphEdge, GraphNode, Input, Point, Rng, Run } from './types.ts'

/** How a pair of hands plays. */
export type Hands = {
  name: string
  /** Takes gold edges (gold lines and expert moves). */
  gold: boolean
  /** Everything counts as touching this much sooner, m. */
  inflate: number
  /** Once a way opens up after waiting, sets off this much later, s. */
  react: number
  /** How far it pushes the stick (an edge's `stick` overrides it). */
  stick: number
  /** Slows into a safe spot it's going to stop at. */
  brake: boolean
  /** The longest it will wait at a spot, s. */
  maxWait: number
  /** Never sets off in the last this-much of a window: setting off this much later must work too, s. */
  trim?: number
  /** Stands this long at every safe spot past the start before setting off (as long as the spot can be held), s. */
  dwell?: number
  /** Steering this many degrees off, and presses up to this much late, s (the phone check). */
  noise?: number
  late?: number
}

/**
 * The blue bean's hands. It stops at every safe spot anyway (`brake`); it stands there 0.4 s (`dwell`), looking
 * round, before it goes on. That's what makes it a careful bean's pace rather than a good player's: without the
 * look its run was only 1.2–1.4 times the fast hands' (a good player couldn't get a medal past silver), and a
 * slower stick or a longer reaction instead made it miss the green waves and moving pads the rounds are timed to
 * (half the days had no way through). Stretching its run in the game (BLUE_PACE) would put it out of step with
 * every door and pendulum it waited for, so its raced time is its own: BLUE_PACE stays 1.
 */
export const BLUE_HANDS: Hands = { name: 'blue', gold: false, inflate: 0.35, react: 0.35, stick: 0.94, brake: true, maxWait: 6, trim: 0.3, dwell: 0.4 }
export const FAST_HANDS: Hands = { name: 'fast', gold: true, inflate: 0.05, react: 0, stick: 1, brake: false, maxWait: 6 }
export const PHONE_HANDS: Hands = { name: 'phone', gold: false, inflate: 0.25, react: 0.55, stick: 0.9, brake: true, maxWait: 8, noise: 8, late: 0.08 }

/**
 * The blue bean as it's raced: its hands' run along the same route, this much quicker (as Swoop's BLUE_PACE). The
 * plan's pace is hands' time × BLUE_PACE. Keep it 1: the game draws the blue along its route at the plan's pace
 * (runs.ts standIn), and any other rate puts it out of step with the clock things it timed itself to.
 */
export const BLUE_PACE = 1.0

/** Waits are whole 30ths of a second: the route string's unit. */
export const WAIT_TICKS = 4

/* ------------------------------------------------------------------ the graph --- */

/** A way from a safe node to the next one, through any `no` nodes. */
export type Segment = { edges: GraphEdge[]; to: string }

type Index = { nodes: Map<string, GraphNode>; out: Map<string, GraphEdge[]>; segs: Map<string, Segment[]> }

const INDEX = new WeakMap<Course, Index>()

function indexOf(course: Course): Index {
  let ix = INDEX.get(course)
  if (!ix) {
    const nodes = new Map(course.graph.nodes.map((n) => [n.id, n]))
    const out = new Map<string, GraphEdge[]>()
    for (const e of course.graph.edges) {
      if (!out.has(e.from)) out.set(e.from, [])
      out.get(e.from)!.push(e)
    }
    ix = { nodes, out, segs: new Map() }
    INDEX.set(course, ix)
  }
  return ix
}

/** The segments out of safe node `id` (main edges only, or gold too), in a fixed order: a route names them by index. */
export function segmentsFrom(course: Course, id: string, gold: boolean): Segment[] {
  const ix = indexOf(course)
  const key = `${gold ? 'g' : 'm'}|${id}`
  let segs = ix.segs.get(key)
  if (segs) return segs
  segs = []
  const walk = (at: string, path: GraphEdge[], seen: Set<string>) => {
    for (const e of ix.out.get(at) ?? []) {
      if (!gold && e.tier !== 'main') continue
      const n = ix.nodes.get(e.to)
      if (!n || seen.has(e.to)) continue
      const p = [...path, e]
      if (n.wait === 'safe' || e.to === course.graph.goal) segs!.push({ edges: p, to: e.to })
      else if (p.length < 14 && segs!.length < 64) walk(e.to, p, new Set([...seen, e.to]))
    }
  }
  walk(id, [], new Set([id]))
  ix.segs.set(key, segs)
  return segs
}

/* --------------------------------------------------------------- the executor --- */

const POSE = newPose()
let PX = 0
let PY = 0
let PZ = 0
/** Where point p is now (riding its solid, if it has one): PX, PY, PZ. */
function resolve(run: Run, p: Point, t = run.t): void {
  if (p.on === undefined) {
    PX = p.x
    PY = p.y
    PZ = p.z
    return
  }
  const s = run.course.solids[p.on]!
  solidPose(run.course, run.world, p.on, t, POSE)
  const dx = p.x - s.x
  const dz = p.z - s.z
  const c0 = Math.cos(s.yaw)
  const s0 = Math.sin(s.yaw)
  const lx = dx * c0 - dz * s0
  const lz = dx * s0 + dz * c0
  const c = Math.cos(POSE.yaw)
  const sn = Math.sin(POSE.yaw)
  PX = POSE.x + lx * c + lz * sn
  PZ = POSE.z - lx * sn + lz * c
  PY = p.y + (POSE.y - s.y)
}

/** How far the bean can go along (dx, dz) before the edge of what it stands on. */
function edgeLeft(run: Run, dx: number, dz: number): number {
  const b = run.bean
  if (b.ground < 0) return Infinity
  const s = run.course.solids[b.ground]!
  solidPose(run.course, run.world, b.ground, run.t, POSE)
  const c = Math.cos(POSE.yaw)
  const sn = Math.sin(POSE.yaw)
  const ox = b.x - POSE.x
  const oz = b.z - POSE.z
  const lx = ox * c - oz * sn
  const lz = ox * sn + oz * c
  const ux = dx * c - dz * sn
  const uz = dx * sn + dz * c
  if (s.shape === 'box') {
    let t = Infinity
    if (ux > 1e-6) t = Math.min(t, (s.hx - lx) / ux)
    if (ux < -1e-6) t = Math.min(t, (-s.hx - lx) / ux)
    if (uz > 1e-6) t = Math.min(t, (s.hz - lz) / uz)
    if (uz < -1e-6) t = Math.min(t, (-s.hz - lz) / uz)
    return Math.max(0, t)
  }
  const pd = lx * ux + lz * uz
  const disc = pd * pd - (lx * lx + lz * lz - s.r * s.r)
  return disc < 0 ? 0 : Math.max(0, -pd + Math.sqrt(disc))
}

/** Seconds until the bean comes down to height y (from its height and climb, in a lifting wind if it's in one), at least `least`. */
function timeToFall(run: Run, y: number, least = 0.05): number {
  const b = run.bean
  const g = Math.max(0.2 * G, G - windLift(run))
  const disc = b.vy * b.vy + 2 * g * (b.y - y)
  if (disc < 0) return Math.max(least, b.vy / g)
  return Math.max(least, (b.vy + Math.sqrt(disc)) / g)
}

/** The stick that drives the bean's world velocity toward (wx, wz), allowing for what carries it. */
function stickFor(run: Run, wx: number, wz: number, most: number, into: Input): void {
  const b = run.bean
  const vx = wx - (b.ground >= 0 ? b.gcx : 0) - b.acx
  const vz = wz - (b.ground >= 0 ? b.gcz : 0) - b.acz
  let sx = -vx / RUN
  let sy = vz / RUN
  const m = Math.hypot(sx, sy)
  const cap = Math.max(most, Math.min(1, m))
  if (m > cap) {
    sx *= cap / m
    sy *= cap / m
  }
  into.x = sx
  into.y = sy
}

/** A slowly wandering steering error, for the phone check. */
function wobble(rng: Rng | null, h: Hands, d: Driver): number {
  if (!rng || !h.noise) return 0
  if (d.noiseLeft <= 0) {
    d.noiseAng = ((rng() * 2 - 1) * h.noise * Math.PI) / 180
    d.noiseLeft = 0.4 + rng() * 0.4
  }
  d.noiseLeft -= STEP
  return d.noiseAng
}

/** The state of one segment being run. */
export type Driver = {
  seg: Segment
  /** The edge it's on, when that edge began, and its stage: 0 getting to the take-off, 1 in the air, 2 down again. */
  ei: number
  t0: number
  stage: number
  via: number
  jumped: boolean
  dived: boolean
  /** A press waiting to happen (the phone's late hands): which, and when. */
  press: 0 | 1 | 2
  pressAt: number
  noiseAng: number
  noiseLeft: number
}

export function newDriver(seg: Segment, run: Run): Driver {
  return { seg, ei: 0, t0: run.t, stage: 0, via: 0, jumped: false, dived: false, press: 0, pressAt: 0, noiseAng: 0, noiseLeft: 0 }
}

const NODE_R_SAFE = 0.5
const NODE_R_PASS = 1.0
/** A late dive dives when it would land this far short of the spot (the belly slide carries it on). */
const SLIDE_ON = 1.1
const LATE_DIVE_MOST = 0.62

function nodeOf(course: Course, id: string): GraphNode {
  const n = indexOf(course).nodes.get(id)
  if (!n) throw new Error(`Wobble Run: no route node ${id}`)
  return n
}

/** The hands' input for this step of the segment. */
export function drive(run: Run, d: Driver, h: Hands, rng: Rng | null, into: Input): Input {
  const b = run.bean
  const course = run.course
  const e = d.seg.edges[d.ei]!
  const last = d.ei === d.seg.edges.length - 1
  const to = nodeOf(course, e.to)
  into.jump = false
  into.dive = false
  into.x = 0
  into.y = 0
  if (b.dead > 0 || b.ledge > 0) return into
  const most = e.stick ?? h.stick
  const ang = wobble(rng, h, d)
  // A press the phone's hands are late with.
  if (d.press && run.t >= d.pressAt) {
    if (d.press === 1) into.jump = true
    else into.dive = true
    d.press = 0
  }
  const press = (which: 1 | 2) => {
    const late = rng && h.late ? rng() * h.late : 0
    if (late <= 0) {
      if (which === 1) into.jump = true
      else into.dive = true
    } else {
      d.press = which
      d.pressAt = run.t + late
    }
  }
  resolve(run, to)
  let tx = PX
  let ty = PY
  let tz = PZ
  // Spots on the way first.
  if (e.via && d.via < e.via.length && e.move !== 'bounce' && e.move !== 'perfectBounce') {
    resolve(run, e.via[d.via]!)
    if (Math.hypot(PX - b.x, PZ - b.z) < 0.8) d.via++
    else {
      tx = PX
      ty = PY
      tz = PZ
    }
  }
  const ground = (x: number, z: number, arrive: boolean) => {
    let dx = x - b.x
    let dz = z - b.z
    const dist = Math.hypot(dx, dz)
    if (dist < 1e-6) return
    if (ang) {
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      const nx = dx * c - dz * s
      dz = dx * s + dz * c
      dx = nx
    }
    let speed = most * RUN
    if (arrive) speed = Math.min(speed, Math.sqrt(2 * ACC_GROUND * 0.7 * Math.max(0, dist - 0.1)))
    stickFor(run, (dx / dist) * speed, (dz / dist) * speed, most, into)
  }
  const air = (x: number, y: number, z: number) => {
    // The speed over the ground that lands it on the spot; its own part (less what the wind carries) can't be over
    // a run's, but a tail wind on top of that is the wind's, never steered away.
    const tf = timeToFall(run, y)
    let ox = (x - b.x) / tf - b.acx
    let oz = (z - b.z) / tf - b.acz
    const m = Math.hypot(ox, oz)
    if (m > RUN) {
      ox *= RUN / m
      oz *= RUN / m
    }
    stickFor(run, ox + b.acx, oz + b.acz, 1, into)
  }
  const aimDive = (x: number, z: number) => {
    const dx = x - b.x
    const dz = z - b.z
    const dist = Math.hypot(dx, dz) || 1
    into.x = -dx / dist
    into.y = dz / dist
  }

  switch (e.move) {
    case 'run':
      ground(tx, tz, last && h.brake && to.wait === 'safe')
      break
    case 'ride':
      ground(tx, tz, true)
      break
    case 'slide':
      if (d.stage === 0) {
        aimDive(tx, tz)
        if (b.ground >= 0 && b.slide <= 0 && !b.diving) press(2)
        if (b.diving || b.slide > 0) d.stage = 1
      } else if (b.slide > 0 || b.diving) aimDive(tx, tz)
      else ground(tx, tz, last && h.brake && to.wait === 'safe')
      break
    case 'bounce':
    case 'perfectBounce': {
      if (d.stage === 0) {
        if (e.via && e.via.length) {
          resolve(run, e.via[0]!)
          ground(PX, PZ, false)
        } else ground(tx, tz, false)
        if (b.bounceOn >= 0 && b.bounceAge < 0.2 && b.vy > 0) {
          d.stage = 1
          if (e.move === 'perfectBounce' && b.bounceAge < 0.06) press(1)
        }
      } else if (d.stage === 1) {
        if (b.ground >= 0) d.stage = 2
        else air(tx, ty, tz)
      } else ground(tx, tz, last && h.brake && to.wait === 'safe')
      break
    }
    default: {
      // jump, dive, lateDive
      if (d.stage === 0) {
        let go = false
        const tk = e.takeoff
        if (!tk) {
          go = b.ground >= 0 || b.coyote > 0
          ground(tx, tz, false)
        } else if (tk === 'edge') {
          ground(tx, tz, false)
          const dx = tx - b.x
          const dz = tz - b.z
          const dist = Math.hypot(dx, dz) || 1
          go = b.ground >= 0 && edgeLeft(run, dx / dist, dz / dist) <= (e.inset ?? 0.35)
        } else {
          resolve(run, tk)
          const kx = PX
          const kz = PZ
          const dk = Math.hypot(kx - b.x, kz - b.z)
          const fx = tx - kx
          const fz = tz - kz
          const passed = (b.x - kx) * fx + (b.z - kz) * fz >= 0
          if (dk > 0.6 && !passed) ground(kx, kz, false)
          else ground(tx, tz, false)
          go = (dk < 0.35 || passed) && (b.ground >= 0 || b.coyote > 0)
        }
        if (go) {
          if (e.move === 'dive') {
            aimDive(tx, tz)
            press(2)
          } else press(1)
          d.stage = 1
          d.jumped = false
          d.t0 = run.t
        }
      } else if (d.stage === 1) {
        const up = b.ground < 0 || b.diving
        if (up) d.jumped = true
        if (d.jumped && b.ground >= 0 && !b.diving) {
          d.stage = 2
          ground(tx, tz, last && h.brake && to.wait === 'safe')
          break
        }
        if (b.diving || b.slide > 0) {
          aimDive(tx, tz)
          break
        }
        air(tx, ty, tz)
        if (e.move === 'lateDive' && d.jumped && !d.dived && b.ground < 0) {
          const since = run.t - d.t0
          let dive = e.diveAt !== undefined ? since >= e.diveAt : since >= LATE_DIVE_MOST
          if (e.diveAt === undefined && !dive) {
            // Dive once the dive would land it just short of the spot.
            const vy = Math.max(b.vy, AIR_DIVE_VY)
            const hs = Math.max(DIVE, Math.hypot(b.vx, b.vz) + DIVE_ADD)
            const disc = vy * vy + 2 * G * (b.y - ty)
            const tf = disc > 0 ? (vy + Math.sqrt(disc)) / G : vy / G
            dive = hs * tf >= Math.hypot(tx - b.x, tz - b.z) - SLIDE_ON
          }
          if (dive) {
            aimDive(tx, tz)
            press(2)
            d.dived = true
          }
        }
      } else ground(tx, tz, last && h.brake && to.wait === 'safe')
    }
  }
  return into
}

/** After a step: 1 the segment is done, 0 carry on, −1 it failed (in strict mode, any touch fails it). */
export function after(run: Run, d: Driver, strict: boolean): -1 | 0 | 1 {
  const b = run.bean
  const course = run.course
  const e = d.seg.edges[d.ei]!
  if (e.to === course.graph.goal && run.done) return 1
  if (b.dead > 0) return -1
  if (strict && (run.touched || run.near)) return -1
  const to = nodeOf(course, e.to)
  if (run.t - d.t0 > (e.maxT ?? edgeTime(run, e))) return -1
  const last = d.ei === d.seg.edges.length - 1
  if (b.ground < 0 || b.dead > 0) return 0
  // A slide counts once it's down on its belly near the spot (it needn't stop); a jump, once it has landed.
  const sliding = e.move === 'slide' && d.stage === 1 && !b.diving
  if (e.move !== 'run' && e.move !== 'ride' && d.stage < 2 && !sliding) return 0
  if (e.move === 'ride' && run.t - d.t0 < (e.dur ?? 0)) return 0
  if (e.via && d.via < e.via.length && e.move === 'run') return 0
  resolve(run, to)
  const r = Math.max(to.r ?? (last && to.wait === 'safe' ? NODE_R_SAFE : NODE_R_PASS), sliding ? 1.5 : 0)
  if (Math.hypot(PX - b.x, PZ - b.z) > r) return 0
  // Down by the crown without touching it (it bobbed out of reach): a miss, never there.
  if (e.to === course.graph.goal) return -1
  if (last) return 1
  d.ei++
  d.t0 = run.t
  d.stage = 0
  d.via = 0
  d.jumped = false
  d.dived = false
  return 0
}

/** An edge's time limit: 2.5 s and 0.4 s a metre. */
function edgeTime(run: Run, e: GraphEdge): number {
  const a = nodeOf(run.course, e.from)
  const b = nodeOf(run.course, e.to)
  return 2.5 + 0.4 * Math.hypot(a.x - b.x, a.z - b.z)
}

/** Standing at a safe node (riding it if it moves), while waiting. */
export function holdInput(run: Run, id: string, h: Hands, into: Input): Input {
  const b = run.bean
  const n = nodeOf(run.course, id)
  into.jump = false
  into.dive = false
  resolve(run, n, run.t - STEP)
  const px = PX
  const pz = PZ
  resolve(run, n)
  const nvx = (PX - px) / STEP
  const nvz = (PZ - pz) / STEP
  const dx = PX - b.x
  const dz = PZ - b.z
  const d = Math.hypot(dx, dz)
  let wx = nvx
  let wz = nvz
  if (d > 0.25) {
    const sp = Math.min(h.stick * RUN, 3 * d)
    wx += (dx / d) * sp
    wz += (dz / d) * sp
  }
  if (b.dead > 0 || b.ledge > 0) {
    into.x = 0
    into.y = 0
    return into
  }
  stickFor(run, wx, wz, 1, into)
  if (d <= 0.25 && Math.hypot(into.x, into.y) < 0.05) {
    into.x = 0
    into.y = 0
  }
  return into
}

const IN: Input = { x: 0, y: 0, jump: false, dive: false }

/** Runs segment `seg` from the run as it is. Strict: any touch (with the margin) fails it. Returns whether it got there. */
export function runSegment(run: Run, seg: Segment, h: Hands, strict: boolean, rng: Rng | null = null): boolean {
  const d = newDriver(seg, run)
  run.touched = false
  run.near = false
  for (let n = 0; n < 120 * 60; n++) {
    step(run, drive(run, d, h, rng, IN))
    const r = after(run, d, strict)
    if (r !== 0) return r > 0
  }
  return false
}

/** Waits `ticks` steps at node `id`. Returns false if anything touched it meanwhile (with the margin). */
function holdFor(run: Run, id: string, h: Hands, ticks: number): boolean {
  for (let i = 0; i < ticks; i++) {
    step(run, holdInput(run, id, h, IN))
    if (run.bean.dead > 0 || run.touched || run.near) return false
  }
  return true
}

/* ------------------------------------------------------------------ planning --- */

/** One step of a route: the segment taken from a safe node (its index there) and the wait before it, in steps. */
export type RouteStep = { seg: number; wait: number }

/** A route as a string: each step `seg` (base 36), with `:wait` (base 36, in 30ths of a second) if it waited; comma between. */
export function encodeRoute(steps: readonly RouteStep[]): string {
  return steps.map((s) => s.seg.toString(36) + (s.wait > 0 ? ':' + Math.round(s.wait / WAIT_TICKS).toString(36) : '')).join(',')
}

export function decodeRoute(text: string): RouteStep[] {
  if (!text) return []
  return text.split(',').map((part) => {
    const [seg, wait] = part.split(':')
    return { seg: parseInt(seg!, 36), wait: wait ? parseInt(wait, 36) * WAIT_TICKS : 0 }
  })
}

type Found = { wait: number; tick: number; snap: Snapshot }

/**
 * Waiting at a safe node: the state every 30th of a second (states[i] after i × WAIT_TICKS steps), worked out as
 * far as it's asked for, and `ended` once waiting longer would be touched (with the margin).
 */
type Holds = { node: string; states: Snapshot[]; ended: boolean }

function holdAt(run: Run, holds: Holds, i: number, h: Hands): Snapshot | null {
  while (holds.states.length <= i && !holds.ended) {
    restore(run, holds.states[holds.states.length - 1]!)
    run.inflate = h.inflate
    run.touched = false
    run.near = false
    if (holdFor(run, holds.node, h, WAIT_TICKS)) holds.states.push(snapshot(run))
    else holds.ended = true
  }
  return holds.states[i] ?? null
}

/**
 * When the hands set off along `seg` from a safe node and when they get there: after their look round (`dwell`),
 * the first wait whose run is untouched (with the margin), and if it had to wait, the first one a reaction later
 * that still is (else a reaction after the next one that is). Null if no wait they can stand works.
 */
function departure(run: Run, holds: Holds, seg: Segment, h: Hands): Found | null {
  const most = Math.round(h.maxWait / STEP / WAIT_TICKS)
  const react = Math.ceil(h.react / STEP / WAIT_TICKS)
  const trim = Math.round((h.trim ?? 0) / STEP / WAIT_TICKS)
  const win = seg.edges[0]!.window
  // The look round a careful pair of hands takes at a spot first, cut short where the spot can't be held that long.
  let first = holds.node === run.course.graph.start ? 0 : Math.round((h.dwell ?? 0) / STEP / WAIT_TICKS)
  while (first > 0 && !holdAt(run, holds, first, h)) first--
  let need = -1
  for (let i = first; i <= Math.max(most, first); i++) {
    const s = holdAt(run, holds, i, h)
    if (!s) return null
    if (i < need) continue
    // A way that has shut again by the time the hands would go (need = −1 below): they react afresh to the next one.
    if (win && !win(s.rel * STEP)) {
      need = -1
      continue
    }
    restore(run, s)
    run.inflate = h.inflate
    if (runSegment(run, seg, h, true)) {
      if (need < 0 && i > first && react > 0) {
        need = i + react
        continue
      }
      const found = { wait: i * WAIT_TICKS, tick: run.steps, snap: snapshot(run) }
      if (trim > 0) {
        // Setting off `trim` later must work too (unless it can't wait that long anyway).
        const later = holdAt(run, holds, i + trim, h)
        let late = !!later
        if (later && (!win || win(later.rel * STEP))) {
          restore(run, later)
          run.inflate = h.inflate
          late = !runSegment(run, seg, h, true)
        }
        if (late) {
          need = -1
          continue
        }
      }
      return found
    }
    need = -1
  }
  return null
}

/** What a planned run comes to. */
export type BotRun = {
  finished: boolean
  /** The hands' time (the crown's touch), s. */
  time: number
  splits: number[]
  /** The ghost path (GHOST_STRIDE numbers a sample), when asked for. */
  ghost: number[]
  route: string
  steps: RouteStep[]
  touched: boolean
  counts: Counts
}

type Label = { node: string; tick: number; snap: Snapshot | null; prev: Label | null; seg: number; wait: number; canWait: number }

/** A node's arrivals are kept to this many, and each is checked for this long a wait at least. */
const MOST_ARRIVALS = 6
const WAIT_CHECK = Math.round(2 / STEP / WAIT_TICKS)

/**
 * The earliest the hands can get to the crown, setting off from each safe node as soon as it's safe to: an
 * earliest-arrival search over the safe nodes. An arrival at a node is skipped when an earlier one there could
 * have waited until then untouched (so waiting in a boulder's lane, which can't be done for long, doesn't shut a
 * node to later arrivals). Returns the route, or null if the hands can't get there.
 */
export function planRoute(course: Course, h: Hands, log?: (line: string) => void): RouteStep[] | null {
  const run = newRun(course, { countdown: 0, quiet: true })
  run.inflate = h.inflate
  const heap: Label[] = []
  const push = (l: Label) => {
    heap.push(l)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p]!.tick <= heap[i]!.tick) break
      ;[heap[p], heap[i]] = [heap[i]!, heap[p]!]
      i = p
    }
  }
  const pop = (): Label => {
    const top = heap[0]!
    const end = heap.pop()!
    if (heap.length) {
      heap[0] = end
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l]!.tick < heap[m]!.tick) m = l
        if (r < heap.length && heap[r]!.tick < heap[m]!.tick) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i]!, heap[m]!]
        i = m
      }
    }
    return top
  }
  const expanded = new Map<string, Label[]>()
  const covered = (node: string, tick: number) => {
    const seen = expanded.get(node)
    return !!seen && (seen.length >= MOST_ARRIVALS || seen.some((a) => tick >= a.tick && tick - a.tick <= a.canWait))
  }
  push({ node: course.graph.start, tick: 0, snap: snapshot(run), prev: null, seg: -1, wait: 0, canWait: 0 })
  while (heap.length) {
    const l = pop()
    if (covered(l.node, l.tick)) continue
    if (l.node === course.graph.goal) {
      const steps: RouteStep[] = []
      for (let at: Label | null = l; at && at.prev; at = at.prev) steps.push({ seg: at.seg, wait: at.wait })
      return steps.reverse()
    }
    const holds: Holds = { node: l.node, states: [l.snap!], ended: false }
    const segs = segmentsFrom(course, l.node, h.gold)
    log?.(`at ${l.node} t ${(l.tick * STEP).toFixed(2)}: ${segs.length} ways`)
    segs.forEach((seg, si) => {
      const found = departure(run, holds, seg, h)
      log?.(`  → ${seg.to}: ${found ? `wait ${(found.wait * STEP).toFixed(2)}, there at ${(found.tick * STEP).toFixed(2)}` : 'no way'}`)
      if (found && !covered(seg.to, found.tick)) push({ node: seg.to, tick: found.tick, snap: found.snap, prev: l, seg: si, wait: found.wait, canWait: 0 })
    })
    holdAt(run, holds, WAIT_CHECK, h)
    l.canWait = (holds.states.length - 1) * WAIT_TICKS
    l.snap = null
    if (!expanded.has(l.node)) expanded.set(l.node, [])
    expanded.get(l.node)!.push(l)
  }
  return null
}

/** Runs a route from the start, as planned: the same executor, the same waits, so the same run. */
export function runRoute(course: Course, steps: readonly RouteStep[], h: Hands, opts: { ghost?: boolean } = {}): BotRun {
  const run = newRun(course, { countdown: 0, quiet: true, ghost: opts.ghost })
  run.inflate = h.inflate
  let node = course.graph.start
  let touched = false
  let ok = true
  for (const s of steps) {
    const seg = segmentsFrom(course, node, h.gold)[s.seg]
    if (!seg) {
      ok = false
      break
    }
    run.touched = false
    run.near = false
    for (let i = 0; i < s.wait; i++) step(run, holdInput(run, node, h, IN))
    touched ||= run.touched
    if (!runSegment(run, seg, h, false)) {
      ok = false
      touched = true
      break
    }
    touched ||= run.touched
    node = seg.to
  }
  return {
    finished: ok && run.done,
    time: run.done ? run.time : Infinity,
    splits: run.splits.slice(),
    ghost: run.ghost ?? [],
    route: encodeRoute(steps),
    steps: steps.slice(),
    touched,
    counts: { ...run.counts },
  }
}

/** The blue bean's run: planned (Node, the plan script) and replayed, with its ghost. */
export function blueRun(course: Course): BotRun {
  const steps = planRoute(course, BLUE_HANDS)
  if (!steps) return { finished: false, time: Infinity, splits: [], ghost: [], route: '', steps: [], touched: true, counts: newCounts() }
  return runRoute(course, steps, BLUE_HANDS, { ghost: true })
}

/** The blue bean's run from its route string (blueRoutes.ts): what the browser does, in one pass. */
export function replayBlue(course: Course, route: string): BotRun {
  return runRoute(course, decodeRoute(route), BLUE_HANDS, { ghost: true })
}

/** The fast hands' run (gold lines, small margins): the floor for the medals' sanity. */
export function fastRun(course: Course, opts: { ghost?: boolean } = {}): BotRun {
  const steps = planRoute(course, FAST_HANDS)
  if (!steps) return { finished: false, time: Infinity, splits: [], ghost: [], route: '', steps: [], touched: true, counts: newCounts() }
  return runRoute(course, steps, FAST_HANDS, opts)
}

function newCounts(): Counts {
  return { splats: 0, knocks: 0, bonks: 0, yeets: 0, close: 0, ledges: 0, bounces: 0, perfects: 0, hoops: 0 }
}

/* ------------------------------------------------------------- live hands --- */

const TO_GOAL = new WeakMap<Course, Map<string, Map<string, number>>>()

/** Each node's distance to the crown along the route graph, m (main edges only, or gold too): the live hands' compass. */
export function goalDistance(course: Course, gold: boolean): Map<string, number> {
  let byKind = TO_GOAL.get(course)
  if (!byKind) TO_GOAL.set(course, (byKind = new Map()))
  const key = gold ? 'g' : 'm'
  let dist = byKind.get(key)
  if (dist) return dist
  const ix = indexOf(course)
  const into = new Map<string, GraphEdge[]>()
  for (const e of course.graph.edges) {
    if (!gold && e.tier !== 'main') continue
    if (!into.has(e.to)) into.set(e.to, [])
    into.get(e.to)!.push(e)
  }
  dist = new Map([[course.graph.goal, 0]])
  const open = [course.graph.goal]
  while (open.length) {
    open.sort((a, b) => dist!.get(b)! - dist!.get(a)!)
    const at = open.pop()!
    const d = dist.get(at)!
    const n = ix.nodes.get(at)!
    for (const e of into.get(at) ?? []) {
      const m = ix.nodes.get(e.from)!
      const nd = d + Math.hypot(m.x - n.x, m.z - n.z, m.y - n.y)
      if (nd < (dist.get(e.from) ?? Infinity)) {
        dist.set(e.from, nd)
        open.push(e.from)
      }
    }
  }
  byKind.set(key, dist)
  return dist
}

/**
 * Hands that play a live run step by step, choosing at each safe node by trying each way on a copy of the run (the
 * nearest arrival wins), and coming back to the route from wherever a splat drops them. The dev autopilot (with
 * FAST_HANDS or BLUE_HANDS) and the phone check (PHONE_HANDS and a seed: steering noise and late presses).
 */
export function liveHands(course: Course, h: Hands, seed?: number) {
  const shadow = newRun(course, { countdown: 0, quiet: true })
  const rng = seed === undefined ? null : makeRng(seed)
  let node = course.graph.start
  let mode: 'plan' | 'hold' | 'go' | 'down' = 'plan'
  let fresh = true
  let holdLeft = 0
  let driver: Driver | null = null
  const into: Input = { x: 0, y: 0, jump: false, dive: false }
  const nearest = (run: Run) => {
    let best = node
    let bd = Infinity
    for (const n of course.graph.nodes) {
      if (n.wait !== 'safe') continue
      resolve(run, n)
      const d = Math.hypot(PX - run.bean.x, PZ - run.bean.z) + Math.abs(PY - run.bean.y) * 2
      if (d < bd) {
        bd = d
        best = n.id
      }
    }
    return best
  }
  const plan = (run: Run) => {
    const holds: Holds = { node, states: [snapshot(run)], ended: false }
    const left = goalDistance(course, h.gold)
    let pick: { seg: Segment; wait: number; tick: number; score: number } | null = null
    for (const seg of segmentsFrom(course, node, h.gold)) {
      // The nearest arrival, counting what's left to run from there (so a step aside is taken only if it pays).
      const rest = left.get(seg.to) ?? Infinity
      if (!Number.isFinite(rest)) continue
      const found = departure(shadow, holds, seg, h)
      const score = found ? found.tick * STEP + rest / RUN : Infinity
      if (found && (!pick || score < pick.score)) pick = { seg, wait: found.wait, tick: found.tick, score }
    }
    if (!pick) {
      // Nothing clean: go anyway, a little later, along the way that ends nearest the crown (never a step aside
      // and back again for minutes).
      let seg: Segment | null = null
      for (const s of segmentsFrom(course, node, h.gold)) if (!seg || (left.get(s.to) ?? Infinity) < (left.get(seg.to) ?? Infinity)) seg = s
      if (!seg) return false
      pick = { seg, wait: WAIT_TICKS * 6, tick: 0, score: 0 }
    }
    driver = newDriver(pick.seg, run)
    holdLeft = pick.wait
    mode = holdLeft > 0 ? 'hold' : 'go'
    return true
  }
  return {
    /** The input for this step of `run` (call before step(run, input)). */
    input(run: Run): Input {
      const b = run.bean
      if (run.done || run.t < 0) {
        into.x = into.y = 0
        into.jump = into.dive = false
        return into
      }
      if (b.dead > 0) {
        mode = 'down'
        into.x = into.y = 0
        into.jump = into.dive = false
        return into
      }
      if (fresh) {
        // Taking over a run already going: from the nearest safe spot.
        fresh = false
        if (run.t > 0.05) node = nearest(run)
      }
      if (mode === 'down') {
        if (b.ground < 0) return holdInput(run, course.spawns[b.spawn]!.node, h, into)
        node = course.spawns[b.spawn]!.node
        mode = 'plan'
      }
      if (mode === 'go' && driver) {
        const r = after(run, driver, false)
        if (r > 0) {
          node = driver.seg.to
          mode = 'plan'
        } else if (r < 0) {
          node = nearest(run)
          mode = 'plan'
        }
      }
      if (mode === 'plan') {
        if (node === course.graph.goal || !plan(run)) {
          into.x = into.y = 0
          return into
        }
      }
      if (mode === 'hold') {
        holdInput(run, node, h, into)
        if (--holdLeft <= 0) {
          mode = 'go'
          driver!.t0 = run.t + STEP
        }
        return into
      }
      if (!driver) return into
      return drive(run, driver, h, rng, into)
    },
  }
}

/** A live run of the course by these hands, to the crown or `limit` s: what the phone check counts. */
export function liveRun(course: Course, h: Hands, seed?: number, limit = 300): BotRun {
  const run = newRun(course, { countdown: 0, quiet: true })
  const hands = liveHands(course, h, seed)
  while (!run.done && run.t < limit) step(run, hands.input(run))
  return { finished: run.done, time: run.done ? run.time : Infinity, splits: run.splits.slice(), ghost: [], route: '', steps: [], touched: run.touched, counts: { ...run.counts } }
}

/** The phone check: PHONE_HANDS with seeds 1..n. */
export function phoneRuns(course: Course, n = 20): BotRun[] {
  return Array.from({ length: n }, (_, i) => liveRun(course, PHONE_HANDS, i + 1))
}
