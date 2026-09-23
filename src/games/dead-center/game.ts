import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

/**
 * Centroid — balance the plate on a pin.
 *
 * A clear plate hovers over the table. Tap where you think its balance point
 * is, and a pin springs up there and the plate is lowered onto it. Dead on, it
 * balances: a little wobble and it stays. Off, it tips toward wherever its true
 * balance point was — slowly for a near miss, hard for a wild one — until its
 * edge hits the table, then it slips off the pin and flops flat, knocking the
 * pin over. Tipping shows the miss in any direction, so no miss can hide.
 *
 * A run goes on until the pins run out: three to start, one lost with every
 * plate that falls or isn't pinned in time, one back for every ten balanced in
 * a row. As it goes the plates get trickier, the clock shorter and the margin
 * for a balance tighter.
 *
 * Everything is measured in the table's own units, so a phone and a desktop
 * get the same plates and margins: the plates live in a unit square, and a
 * miss is measured in plate sizes (the square root of a plate's area).
 *
 * The world is 3D: x and y on the table, z up from it. The plate's pose says
 * where one of its points is and how far it has tipped, and which way; the
 * renderer looks down on it at an angle.
 */

export type Phase = 'menu' | 'aiming' | 'settling' | 'gameover'

export type Point = { x: number; y: number }

export type Vec3 = { x: number; y: number; z: number }

export type PlateKind = 'plain' | 'lopsided' | 'notched'

export type Plate = {
  kind: PlateKind
  points: Point[]
  centroid: Point
  /** The square root of its area: what a miss is measured in. */
  size: number
  hue: number
}

/**
 * How the plate sits: its point `anchor` (in its own flat coordinates) is at
 * `at` in the world, and it has turned `tilt` radians down toward `dir`, about
 * the line through `anchor` square to `dir`. `at.z` is its underside there.
 */
export type Pose = { anchor: Point; at: Vec3; dir: Point; tilt: number }

/**
 * What happens once the pin is in: the plate is lowered onto it; balanced, it
 * wobbles; off, it tips until its edge hits the table, leans there a moment,
 * then flops flat and rests. Too slow, and it falls flat with nothing under it.
 */
export type Stage = 'drop' | 'wobble' | 'tip' | 'lean' | 'flop' | 'rest' | 'fall'

export type Outcome = {
  /** Where the pin went in, on the plate, or null when the clock ran out. */
  pin: Point | null
  /** How far off the balance point, in plate sizes. */
  off: number
  balanced: boolean
  /** Close enough to count as dead center. */
  dead: boolean
  points: number
  /** Which way the plate tips: from the pin toward its balance point. */
  dir: Point
}

/** A plate on its way off the table while the next comes on: lifted away if it balanced, faded where it fell if not. */
export type Leaving = {
  plate: Plate
  pose: Pose
  outcome: Outcome | null
  margin: number
  pinH: number
  pinDown: number
  lift: boolean
  t: number
}

export type FloaterTone = 'good' | 'gold' | 'bad'

export type Floater = { at: Vec3; text: string; tone: FloaterTone; life: number; maxLife: number }

export type Spark = { at: Vec3; vx: number; vy: number; vz: number; life: number; maxLife: number; hue: number }

export type GameState = {
  phase: Phase
  time: number
  score: number
  best: number
  pins: number
  /** The plate on the table now, counting from one. */
  plateNo: number
  plate: Plate | null
  pose: Pose
  /** 0–1 as the plate comes onto the table. */
  appear: number
  /** Seconds left to set the pin (it runs once the plate is down), and what it started at. */
  clock: number
  clockMax: number
  /** How far off the pin can be and the plate still balance, in plate sizes. */
  margin: number
  outcome: Outcome | null
  stage: Stage
  /** Seconds into the stage, and since the pin went in. */
  stageT: number
  settleT: number
  tilt: number
  tiltV: number
  /** How far the plate reaches past the pin toward `dir`: where its edge meets the table. */
  edge: number
  /** The tilt at which that edge meets the table, and where on the table it does. */
  leanTilt: number
  hinge: Point
  /** How high the pin stands (it springs up), and how far it has been knocked over (0 standing, 1 flat). */
  pinH: number
  pinDown: number
  /** Height of the plate's underside as the pin goes in or while it falls with nothing under it. */
  z: number
  zV: number
  leaving: Leaving | null
  /** Balanced in a row, the best such run, and the run's totals. */
  streak: number
  bestStreak: number
  balanced: number
  deadCenters: number
  /** Where a keyboard's crosshair is on the table, once one is in use; it stays put from plate to plate. */
  cursor: Point | null
  floaters: Floater[]
  sparks: Spark[]
  /** 0–1 gold flash for a dead center, and a shake for a fall. */
  flash: number
  shake: number
}

export type Snapshot = {
  phase: Phase
  score: number
  best: number
  pins: number
  plateNo: number
  streak: number
  bestStreak: number
  balanced: number
  deadCenters: number
}

// ------------------------------------------------------------------- world

/** The pin's height, where a plate hovers before it, and how thick a plate is: table units. */
export const PIN_H = 0.22
export const HOVER_Z = 0.27
export const THICK = 0.022

// ------------------------------------------------------------------- tuning

export const START_PINS = 3
export const MAX_PINS = 5
/** A pin back for every this many balanced in a row. */
export const PIN_EVERY = 10
/** Seconds the plate takes to come onto the table; the pin can go in once it is half there. */
const APPEAR_TIME = 0.4
/** Seconds to lower the plate onto the pin, and from the pin going in to a balanced plate being lifted away. */
const DROP_TIME = 0.12
const BALANCE_SHOW = 1.25
/** A fallen plate leans on its edge this long, then lies flat this long, before the next comes on. */
const LEAN_TIME = 0.22
const REST_TIME = 0.45
/** How fast a plate falls flat about its edge, and drops with nothing under it: radians and table units a second². */
const FLOP_PULL = 16
const GRAVITY = 2.6
/** How long a plate takes to leave the table. */
export const LEAVE_TIME = 0.26

/** The margin for a balance on the nth plate, in plate sizes: generous at first, tight later. */
export function marginFor(n: number) {
  return Math.max(0.03, 0.085 - 0.0018 * (n - 1))
}

/** Seconds to set the pin on the nth plate. */
export function clockFor(n: number) {
  return Math.max(3, 7 - 0.12 * (n - 1))
}

/**
 * Points, sized to the server's check on a run (a thousand, and 150 a
 * second): the most a plate can pay is 210, and the quickest a balanced plate
 * can come and go is 1.45 seconds, so even a perfect player setting each pin
 * the instant it can go in stays under.
 *
 * Accuracy is paid on one scale for every plate, so a later plate, where only
 * a close pin balances at all, pays more for being balanced.
 */
const SCORE_BASE = 20
const SCORE_ACCURACY = 80
const ACCURACY_SPAN = 0.085
const SCORE_DEAD = 30
const SCORE_QUICK = 20
/** Within this share of the plate's size is dead center, on every plate. */
export const DEAD_OFF = 0.02
/** The streak's multiplier grows this much a plate, to its cap. */
const STREAK_STEP = 0.04
const STREAK_CAP = 10

export function streakMult(streak: number) {
  return 1 + STREAK_STEP * Math.min(STREAK_CAP, streak)
}

// ------------------------------------------------------------------ helpers

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function easeOut(t: number) {
  const u = clamp(t, 0, 1)
  return 1 - (1 - u) * (1 - u)
}

/** Area centroid (shoelace): the balance point of any simple polygon. */
export function polygonCentroid(pts: Point[]): Point {
  const n = pts.length
  let area2 = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    const cross = a.x * b.y - b.x * a.y
    area2 += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  if (Math.abs(area2) < 1e-12) {
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n }
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) }
}

export function polygonArea(pts: Point[]) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

/** Whether a point is on the plate (an even-odd count of crossings). */
export function onPlate(pts: Point[], p: Point): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!
    const b = pts[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function nearestOnEdge(pts: Point[], p: Point) {
  let best = p
  let bestD = Infinity
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const abx = b.x - a.x
    const aby = b.y - a.y
    const u = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1), 0, 1)
    const q = { x: a.x + abx * u, y: a.y + aby * u }
    const d = dist(p, q)
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return { at: best, d: bestD }
}

/** Where a pin aimed at `p` goes in: there, or if that's off the plate, just inside its nearest edge. */
function pinPoint(plate: Plate, p: Point): Point {
  if (onPlate(plate.points, p)) return p
  const { at } = nearestOnEdge(plate.points, p)
  const c = plate.centroid
  const d = dist(at, c) || 1
  return { x: at.x + ((c.x - at.x) / d) * 0.006, y: at.y + ((c.y - at.y) / d) * 0.006 }
}

/** Where a plate point is in the world, posed. */
export function poseWorld(pose: Pose, p: Point): Vec3 {
  const rx = p.x - pose.anchor.x
  const ry = p.y - pose.anchor.y
  const along = rx * pose.dir.x + ry * pose.dir.y
  const c = Math.cos(pose.tilt)
  const s = Math.sin(pose.tilt)
  return {
    x: pose.at.x + rx + pose.dir.x * along * (c - 1),
    y: pose.at.y + ry + pose.dir.y * along * (c - 1),
    z: pose.at.z - along * s,
  }
}

/** How far the plate reaches past `from` toward `dir`. */
function reach(plate: Plate, from: Point, dir: Point) {
  let best = 0
  for (const p of plate.points) best = Math.max(best, (p.x - from.x) * dir.x + (p.y - from.y) * dir.y)
  return best
}

// ------------------------------------------------------------------- plates

/** The site's own colours for the plates, clear of the gold the balance point is marked in and the pin's red. */
const PLATE_HUES = [204, 183, 153, 262, 289, 236, 334, 23] as const

function convexHull(pts: Point[]): Point[] {
  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Point[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/**
 * A convex plate: corners scattered round an ellipse at uneven reach, wrapped.
 * `pull` draws some corners in hard, which moves the balance point away from
 * where the eye puts the middle.
 */
function convexPlate(corners: number, pull: number): Point[] {
  const rx = rand(0.3, 0.42)
  const ry = rand(0.22, 0.36)
  const rot = rand(0, Math.PI)
  const start = rand(0, Math.PI * 2)
  const pts: Point[] = []
  for (let i = 0; i < corners; i++) {
    const a = start + ((i + rand(-0.38, 0.38)) / corners) * Math.PI * 2
    const r = 1 - pull * Math.random() * (i % 2 ? 1 : 0.5)
    const x = Math.cos(a) * rx * r
    const y = Math.sin(a) * ry * r
    pts.push({ x: x * Math.cos(rot) - y * Math.sin(rot), y: x * Math.sin(rot) + y * Math.cos(rot) })
  }
  return convexHull(pts)
}

/** A convex plate with a bite out of one side: the balance point runs away from the bite. */
function notchedPlate(): Point[] {
  const base = convexPlate(Math.floor(rand(4, 7)), 0.2)
  const i = Math.floor(Math.random() * base.length)
  const a = base[i]!
  const b = base[(i + 1) % base.length]!
  const c = polygonCentroid(base)
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const depth = rand(0.4, 0.75)
  const width = rand(0.3, 0.55)
  // The bite's floor is a little wide too, so it reads as a cut, not a crack.
  const inward = { x: (c.x - mid.x) * depth, y: (c.y - mid.y) * depth }
  const p1 = { x: mid.x + (a.x - mid.x) * width, y: mid.y + (a.y - mid.y) * width }
  const p2 = { x: mid.x + (b.x - mid.x) * width, y: mid.y + (b.y - mid.y) * width }
  const q1 = { x: mid.x + (a.x - mid.x) * width * 0.35 + inward.x, y: mid.y + (a.y - mid.y) * width * 0.35 + inward.y }
  const q2 = { x: mid.x + (b.x - mid.x) * width * 0.35 + inward.x, y: mid.y + (b.y - mid.y) * width * 0.35 + inward.y }
  const out: Point[] = []
  for (let k = 0; k < base.length; k++) {
    out.push(base[k]!)
    if (k === i) out.push(p1, q1, q2, p2)
  }
  return out
}

function box(pts: Point[]) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x0, y0, x1, y1 }
}

/** Scaled to the size asked for (or less, to fit) and set in the middle of the table. */
function placeOnTable(pts: Point[], target: number): Point[] {
  const size = Math.sqrt(polygonArea(pts)) || 1
  const b = box(pts)
  const k = Math.min(target / size, 0.84 / Math.max(1e-6, b.x1 - b.x0), 0.8 / Math.max(1e-6, b.y1 - b.y0))
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2
  return pts.map((p) => ({ x: 0.5 + (p.x - cx) * k, y: 0.5 + (p.y - cy) * k }))
}

/**
 * How far the balance point is from the middle of the plate's box, in plate
 * sizes: where an eye that doesn't weigh the plate would put the pin.
 */
export function deception(plate: Plate) {
  const b = box(plate.points)
  return Math.hypot(plate.centroid.x - (b.x0 + b.x1) / 2, plate.centroid.y - (b.y0 + b.y1) / 2) / plate.size
}

/**
 * The nth plate. The first few are plain and fair. From the sixth, some are
 * lopsided enough that a pin in the middle of the plate's box wouldn't
 * balance, more of them as the run goes; from the twelfth, some have a bite
 * taken out.
 */
export function makePlate(n: number): Plate {
  const margin = marginFor(n)
  const deceive = Math.random() < clamp((n - 5) / 16, 0, 0.8)
  const notchShare = n < 12 ? 0 : Math.min(0.45, 0.2 + (n - 12) * 0.015)
  const want = deceive ? margin * 1.15 : 0
  let best: Plate | null = null
  let bestScore = -Infinity
  for (let tries = 0; tries < 40; tries++) {
    const notched = Math.random() < notchShare
    const corners = Math.floor(rand(3, n <= 3 ? 6 : 8))
    const raw = notched ? notchedPlate() : convexPlate(corners, deceive ? rand(0.35, 0.65) : rand(0.05, 0.25))
    if (raw.length < 3) continue
    const points = placeOnTable(raw, rand(0.5, 0.62))
    const area = polygonArea(points)
    if (area < 0.13) continue
    const centroid = polygonCentroid(points)
    // The pin has to be able to go in at the balance point.
    if (!onPlate(points, centroid) || nearestOnEdge(points, centroid).d < 0.07) continue
    const plate: Plate = {
      kind: notched ? 'notched' : deceive ? 'lopsided' : 'plain',
      points,
      centroid,
      size: Math.sqrt(area),
      hue: PLATE_HUES[(n * 3 + Math.floor(Math.random() * 3)) % PLATE_HUES.length]!,
    }
    const d = deception(plate)
    // A plain plate should be plainly fair; a lopsided one should fool a pin in the middle of its box.
    if (deceive ? d >= want : d <= margin * 0.9) return plate
    const score = deceive ? d : -d
    if (score > bestScore) {
      bestScore = score
      best = plate
    }
  }
  if (best) return best
  const points = placeOnTable(convexPlate(4, 0.1), 0.55)
  const centroid = polygonCentroid(points)
  return { kind: 'plain', points, centroid, size: Math.sqrt(polygonArea(points)), hue: PLATE_HUES[0] }
}

// ------------------------------------------------------------------- state

function loadBest() {
  return getPersonalBest('centroid')
}

function restingPose(plate: Plate, z: number): Pose {
  return { anchor: plate.centroid, at: { x: plate.centroid.x, y: plate.centroid.y, z }, dir: { x: 1, y: 0 }, tilt: 0 }
}

export function createInitialState(): GameState {
  // Behind the start card: a plate balanced on its pin, giving a little wobble now and then.
  const plate = makePlate(4)
  const dir = { x: 0.8, y: -0.6 }
  return {
    phase: 'menu',
    time: 0,
    score: 0,
    best: loadBest(),
    pins: START_PINS,
    plateNo: 1,
    plate,
    pose: { ...restingPose(plate, PIN_H), dir },
    appear: 1,
    clock: clockFor(1),
    clockMax: clockFor(1),
    margin: marginFor(1),
    outcome: { pin: plate.centroid, off: 0, balanced: true, dead: true, points: 0, dir },
    stage: 'wobble',
    stageT: 0,
    settleT: 0,
    tilt: 0,
    tiltV: 0,
    edge: 0,
    leanTilt: 0,
    hinge: plate.centroid,
    pinH: PIN_H,
    pinDown: 0,
    z: HOVER_Z,
    zV: 0,
    leaving: null,
    streak: 0,
    bestStreak: 0,
    balanced: 0,
    deadCenters: 0,
    cursor: null,
    floaters: [],
    sparks: [],
    flash: 0,
    shake: 0,
  }
}

export function startGame(prev: GameState): GameState {
  const state = createInitialState()
  state.best = Math.max(prev.best, loadBest())
  state.phase = 'aiming'
  // The plate that was balanced behind the start card is lifted away as the first comes on.
  state.leaving = prev.phase === 'menu' ? leavingOf(prev, true) : null
  bringPlate(state, 1)
  return state
}

function leavingOf(state: GameState, lift: boolean): Leaving | null {
  if (!state.plate) return null
  return {
    plate: state.plate,
    pose: { ...state.pose, at: { ...state.pose.at } },
    outcome: state.outcome,
    margin: state.margin,
    pinH: state.pinH,
    pinDown: state.pinDown,
    lift,
    t: 0,
  }
}

function bringPlate(state: GameState, n: number) {
  state.plateNo = n
  state.plate = makePlate(n)
  state.appear = 0
  state.pose = restingPose(state.plate, hoverZ(state))
  state.clockMax = clockFor(n)
  state.clock = state.clockMax
  state.margin = marginFor(n)
  state.outcome = null
  state.stage = 'drop'
  state.stageT = 0
  state.settleT = 0
  state.tilt = 0
  state.tiltV = 0
  state.pinH = 0
  state.pinDown = 0
  state.z = HOVER_Z
  state.zV = 0
  state.phase = 'aiming'
}

/** For testing: straight on to the nth plate of the run under way. */
export function jumpToPlate(state: GameState, n: number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover') return state
  state.leaving = null
  state.floaters = []
  bringPlate(state, Math.max(1, Math.floor(n)))
  return state
}

/** The height of the plate's underside while it hovers, coming down onto the table as it appears. */
export function hoverZ(state: GameState) {
  const settle = 1 - easeOut(state.appear)
  return HOVER_Z + settle * 0.14 + Math.sin(state.time * 2.2) * 0.004
}

// ------------------------------------------------------------------ playing

/** How far off the plate a tap can land and still be taken as aimed at it: table units. */
const STRAY = 0.06

/**
 * The pin goes in at `at` (a point on the table under the plate). Just off
 * the plate, it goes in just inside the edge; well off it, the tap wasn't
 * aimed at the plate at all and nothing happens.
 */
export function setPin(state: GameState, at: Point): GameState {
  if (state.phase !== 'aiming' || !state.plate || state.appear < 0.5) return state
  const plate = state.plate
  if (!onPlate(plate.points, at) && nearestOnEdge(plate.points, at).d > STRAY) return state
  const pin = pinPoint(plate, at)
  const d = dist(pin, plate.centroid)
  const off = d / plate.size
  const balanced = off <= state.margin
  const dead = off <= DEAD_OFF
  const dir = d > 1e-6 ? { x: (plate.centroid.x - pin.x) / d, y: (plate.centroid.y - pin.y) / d } : { x: 0.8, y: -0.6 }
  let points = 0
  if (balanced) {
    const a = Math.max(0, 1 - off / ACCURACY_SPAN)
    const quick = SCORE_QUICK * (state.clock / state.clockMax)
    points = Math.round((SCORE_BASE + SCORE_ACCURACY * a * a + (dead ? SCORE_DEAD : 0) + quick) * streakMult(state.streak))
  }
  state.outcome = { pin, off, balanced, dead, points, dir }
  state.phase = 'settling'
  state.stage = 'drop'
  state.stageT = 0
  state.settleT = 0
  state.z = state.pose.at.z
  state.pose = { anchor: pin, at: { x: pin.x, y: pin.y, z: state.z }, dir, tilt: 0 }
  state.tilt = 0
  // A wild miss is already going over as it lands.
  state.tiltV = balanced ? 0 : 1.2 * Math.min(off, 0.4)
  state.edge = reach(plate, pin, dir)
  state.leanTilt = Math.asin(clamp(PIN_H / Math.max(state.edge, PIN_H * 1.05), 0, 1))
  sfx('click', 1)
  if (balanced) {
    state.score += points
    state.streak += 1
    state.bestStreak = Math.max(state.bestStreak, state.streak)
    state.balanced += 1
    if (dead) state.deadCenters += 1
    addFloater(state, { x: pin.x, y: pin.y, z: PIN_H + 0.2 }, dead ? `Dead center +${points}` : `+${points}`, dead ? 'gold' : 'good', 1.3)
    if (dead) {
      addSparks(state, { x: pin.x, y: pin.y, z: PIN_H + THICK }, 22, 42)
      state.flash = 1
      sfx('perfect')
    } else {
      sfx('pad', Math.min(5, Math.floor((state.streak - 1) / 2)))
    }
    if (state.streak % PIN_EVERY === 0 && state.pins < MAX_PINS) {
      state.pins += 1
      addFloater(state, { x: pin.x, y: pin.y, z: PIN_H + 0.34 }, 'A pin back', 'gold', 1.6)
      sfx('wave')
    }
  } else {
    state.streak = 0
  }
  return state
}

/** Keyboard play: a crosshair moved by the arrows, and the pin set where it is. */
export function moveCursor(state: GameState, dx: number, dy: number): GameState {
  if (state.phase !== 'aiming') return state
  // It starts low on the table, never on a free answer, and then stays where it was from plate to plate.
  const from = state.cursor ?? { x: 0.5, y: 0.9 }
  state.cursor = { x: clamp(from.x + dx, 0.04, 0.96), y: clamp(from.y + dy, 0.04, 0.96) }
  return state
}

export function pinAtCursor(state: GameState): GameState {
  if (state.phase !== 'aiming' || !state.cursor) return state
  return setPin(state, state.cursor)
}

function addFloater(state: GameState, at: Vec3, text: string, tone: FloaterTone, life = 1) {
  state.floaters.push({ at, text, tone, life, maxLife: life })
  if (state.floaters.length > 6) state.floaters.shift()
}

function addSparks(state: GameState, at: Vec3, n: number, hue: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = rand(0.15, 0.5)
    const life = rand(0.4, 0.8)
    state.sparks.push({ at: { ...at }, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(0.1, 0.5), life, maxLife: life, hue })
  }
}

/**
 * How hard the plate tips at a given miss. A plate on a point turns about it
 * under its own weight: the pull grows with the miss, and so does the plate's
 * resistance to turning, so it is gentle for a near miss and saturates for a
 * wild one — a little extra there so a wild miss plainly crashes. Slowed well
 * below real time, so the tip can be read.
 */
function tipPull(off: number) {
  return (1.5 * off) / (0.084 + off * off) + 3 * off * off
}

function losePin(state: GameState) {
  state.pins -= 1
  state.streak = 0
  state.shake = 0.5
  sfx(state.pins > 0 ? 'miss' : 'die')
}

function toStage(state: GameState, stage: Stage) {
  state.stage = stage
  state.stageT = 0
}

/** The plate's pose as it swings down about its edge on the table. */
function poseOnHinge(state: GameState, pin: Point, dir: Point): Pose {
  const c = Math.cos(state.tilt)
  const s = Math.sin(state.tilt)
  return {
    anchor: pin,
    at: { x: state.hinge.x - dir.x * state.edge * c, y: state.hinge.y - dir.y * state.edge * c, z: state.edge * s },
    dir,
    tilt: state.tilt,
  }
}

function tickSettling(state: GameState, dt: number) {
  const o = state.outcome
  const plate = state.plate
  if (!o || !plate) return
  state.settleT += dt
  state.stageT += dt

  const pin = o.pin
  if (!pin) {
    if (state.stage === 'fall') {
      // Nothing under it: it drops flat.
      state.zV -= GRAVITY * dt
      state.z = Math.max(0, state.z + state.zV * dt)
      state.pose = restingPose(plate, state.z)
      if (state.z <= 0) {
        sfx('chop')
        state.shake = 0.4
        toStage(state, 'rest')
      }
    } else if (state.stageT >= REST_TIME) {
      next(state)
    }
    return
  }
  state.pinH = Math.min(PIN_H, state.pinH + dt * (PIN_H / 0.08))

  switch (state.stage) {
    case 'drop': {
      const u = easeOut(state.stageT / DROP_TIME)
      state.pose = { anchor: pin, at: { x: pin.x, y: pin.y, z: state.z + (PIN_H - state.z) * u }, dir: o.dir, tilt: 0 }
      if (state.stageT >= DROP_TIME) toStage(state, o.balanced ? 'wobble' : 'tip')
      return
    }
    case 'wobble': {
      // A wobble that dies away: bigger the nearer the margin the pin was.
      const amp = 0.035 + 0.16 * (o.off / Math.max(1e-6, state.margin))
      state.tilt = amp * Math.exp(-state.stageT / 0.28) * Math.sin(state.stageT * 15)
      state.pose = { anchor: pin, at: { x: pin.x, y: pin.y, z: PIN_H }, dir: o.dir, tilt: state.tilt }
      if (state.settleT >= BALANCE_SHOW) next(state)
      return
    }
    case 'tip': {
      state.tiltV += tipPull(o.off) * Math.cos(state.tilt) * dt
      state.tilt = Math.min(state.leanTilt, state.tilt + state.tiltV * dt)
      state.pose = { anchor: pin, at: { x: pin.x, y: pin.y, z: PIN_H }, dir: o.dir, tilt: state.tilt }
      if (state.tilt >= state.leanTilt) {
        // Its edge hits the table.
        const c = Math.cos(state.tilt)
        state.hinge = { x: pin.x + o.dir.x * state.edge * c, y: pin.y + o.dir.y * state.edge * c }
        losePin(state)
        const at = { x: plate.centroid.x, y: plate.centroid.y, z: PIN_H + 0.16 }
        addFloater(state, at, `${Math.max(1, Math.round(o.off * 100))}% off`, 'bad', 1.2)
        toStage(state, 'lean')
      }
      return
    }
    case 'lean': {
      // A little bounce off the table, then still.
      const t = state.stageT
      state.tilt = state.leanTilt - 0.05 * Math.exp(-t / 0.06) * Math.abs(Math.sin(t * 30))
      state.pose = { anchor: pin, at: { x: pin.x, y: pin.y, z: PIN_H }, dir: o.dir, tilt: state.tilt }
      if (t >= LEAN_TIME) {
        state.tilt = state.leanTilt
        state.tiltV = 0
        toStage(state, 'flop')
      }
      return
    }
    case 'flop': {
      // It slips off the pin and falls flat about the edge on the table, knocking the pin over.
      state.tiltV -= FLOP_PULL * Math.cos(state.tilt) * dt
      state.tilt = Math.max(0, state.tilt + state.tiltV * dt)
      state.pinDown = Math.min(1, state.pinDown + dt / 0.16)
      state.pose = poseOnHinge(state, pin, o.dir)
      if (state.tilt <= 0) {
        sfx('chop')
        state.shake = Math.max(state.shake, 0.35)
        toStage(state, 'rest')
      }
      return
    }
    case 'rest': {
      state.pinDown = Math.min(1, state.pinDown + dt / 0.16)
      if (state.stageT >= REST_TIME) next(state)
      return
    }
    case 'fall':
      return
  }
}

function next(state: GameState) {
  if (state.pins <= 0) {
    state.phase = 'gameover'
    state.best = Math.max(state.best, state.score)
    return
  }
  state.leaving = leavingOf(state, state.outcome?.balanced ?? false)
  bringPlate(state, state.plateNo + 1)
}

export function tick(state: GameState, dt: number): GameState {
  state.time += dt
  state.flash = Math.max(0, state.flash - dt * 1.6)
  state.shake = Math.max(0, state.shake - dt * 2.5)
  state.floaters = state.floaters.filter((f) => {
    f.life -= dt
    f.at = { ...f.at, z: f.at.z + dt * 0.05 }
    return f.life > 0
  })
  state.sparks = state.sparks.filter((sp) => {
    sp.life -= dt
    const drag = Math.pow(0.08, dt)
    sp.vx *= drag
    sp.vy *= drag
    sp.vz = sp.vz * drag - dt * 0.6
    sp.at = { x: sp.at.x + sp.vx * dt, y: sp.at.y + sp.vy * dt, z: Math.max(0, sp.at.z + sp.vz * dt) }
    return sp.life > 0
  })
  if (state.leaving) {
    state.leaving.t += dt
    if (state.leaving.t >= LEAVE_TIME) state.leaving = null
  }

  if (state.phase === 'menu') {
    // Every few seconds the balanced plate behind the start card gives a little wobble.
    const t = state.time % 4.5
    state.tilt = 0.07 * Math.exp(-t / 0.35) * Math.sin(t * 13)
    state.pose = { ...state.pose, tilt: state.tilt }
    return state
  }
  if (state.phase === 'gameover') return state

  if (state.phase === 'aiming') {
    if (!state.plate) return state
    state.appear = Math.min(1, state.appear + dt / APPEAR_TIME)
    state.pose = restingPose(state.plate, hoverZ(state))
    if (state.appear >= 1) {
      const before = state.clock
      state.clock = Math.max(0, state.clock - dt)
      // The last two seconds tick.
      if ((before > 2 && state.clock <= 2) || (before > 1 && state.clock <= 1)) sfx('tap')
    }
    if (state.clock <= 0) {
      // Too slow: nothing holds it up.
      state.outcome = { pin: null, off: Infinity, balanced: false, dead: false, points: 0, dir: { x: 0, y: 1 } }
      state.phase = 'settling'
      state.stage = 'fall'
      state.stageT = 0
      state.settleT = 0
      state.z = state.pose.at.z
      state.zV = 0
      losePin(state)
      const c = state.plate.centroid
      addFloater(state, { x: c.x, y: c.y, z: HOVER_Z + 0.14 }, 'Too slow', 'bad', 1.2)
    }
    return state
  }

  tickSettling(state, dt)
  return state
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    phase: s.phase,
    score: s.score,
    best: s.best,
    pins: s.pins,
    plateNo: s.plateNo,
    streak: s.streak,
    bestStreak: s.bestStreak,
    balanced: s.balanced,
    deadCenters: s.deadCenters,
  }
}
