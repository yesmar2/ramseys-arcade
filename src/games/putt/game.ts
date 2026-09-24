import { getPersonalBest } from '../../lib/personalBest'
import { isRunAssisted } from '../../lib/runAchievements'
import { sfx } from '../../lib/sound'
import {
  COURSE,
  COURSE_PAR,
  EDGE_T,
  FIELD_W,
  PORTAL_R,
  SAIL_T,
  SPINNER_T,
  UP,
  type Drawbridge,
  type Gate,
  type Hole,
  type Mill,
  type Rect,
  type Slider,
  type Spinner,
  type Vec,
  type Wall,
} from './course'
import { loadHoleBests, recordHoleBest } from './holeBests'
import { centreOf, contours, inAny, inside, inUnion, pivotOf } from './terrain'

/*
 * Putt: mini golf on long holes, none of them the usual kind.
 *
 * A slingshot: take hold of the ball (or press anywhere) and pull back, and
 * the ball comes back with the finger on its bands while dots run ahead the
 * way it will go; let go and it snaps forward. The further the pull, the
 * harder the shot, and the last of a full pull carries much further. The
 * ball rolls on physics — it sheds a share of its speed every
 * frame, so it leaves fast and settles softly — off rails at any angle,
 * through sand that drags and water that costs a stroke, under windmills
 * whose sails shut their doors, past sliders and one-way flaps, up hills and
 * down into bowls, round a floor that spins, off ramps that fly it over
 * whatever is there, into pipes that take it somewhere else, and off rocks,
 * bumpers and rovers. A cup pulls a slow ball in and lets a fast one skip
 * across. The score is golf: strokes against par, and nothing else. A hole
 * is played until the ball drops, however long that takes.
 */

export type Phase = 'menu' | 'intro' | 'aim' | 'roll' | 'splash' | 'sunk' | 'gameover'

export const BALL_R = 1.7
export const CUP_R = 2.7
/** Points per stroke under par plus two: par is 200, birdie 300, bogey 100, and never below 0. */
export const POINTS_PER = 100
export const ACE_BONUS = 200

/** Pulling back this far, in field units, is full power: under a third of the width, so a flick is a real shot. */
export const MAX_DRAG = 30
/** The aim guide reaches this far at full pull. It shows the power, not where the ball will stop. */
export const GUIDE_REACH = MAX_DRAG * 1.6
/** A pull shorter than this share of full is a change of mind, not a shot. */
export const MIN_POWER = 0.08
/** Holding space runs the charge up and back down over this many seconds. */
const KEY_CHARGE = 1.4
/** How far the aim guide reaches, in field units. */
export const AIM_STUB = 14
/** Full power sends a ball about this far on the green before it stops: most of a screen's length and more. */
export const FULL_DISTANCE = 420
/**
 * Up most of the pull a shot carries in straight proportion to it, the way
 * it always has, about this far a whole pull's worth; the last of the pull
 * carries a good deal further, up to FULL_DISTANCE. So a putt, a nudge off a
 * rail or a layup short of water feels as it did, and a big pull really goes.
 */
const EVEN_DISTANCE = 290
/**
 * A rolling ball keeps this share of its speed each frame, at sixty a
 * second: it leaves fast and eases out in a long soft tail instead of
 * slowing on a steady count. Sand keeps far less and swallows a shot in a
 * moment.
 */
const FRICTION_GREEN = 0.985
const FRICTION_SAND = 0.89
/** A shot played out of sand leaves at this share of the speed the pull would give it on the green. */
export const SAND_LIE = 0.65
/** The rate the green bleeds speed, per second, for working out distances. */
const FADE_GREEN = -Math.log(FRICTION_GREEN) * 60
/** The release speed at full pull: what carries FULL_DISTANCE against the fade. */
const MAX_SPEED = FULL_DISTANCE * FADE_GREEN
/** Below this the ball is at rest. */
const STOP_SPEED = 1.2
/** A ball slower than that for this long is at rest whatever is pushing it: pinned to a wall on a hill, say. */
const REST_TIME = 0.4
const WALL_BOUNCE = 0.82
/** A shut windmill door is timber, not a rail: the ball thuds off it and does not fly back to the tee. */
const DOOR_BOUNCE = 0.35
/** A bumper sends the ball away at least this fast, whatever it arrived at. */
const BUMPER_POP = 110
const BUMPER_KEEP = 0.85
/** A kicker adds this much speed straight off its face. */
const KICK_SPEED = 55
/** A pad pushes the ball along its arrow this hard. */
const BOOST_ACCEL = 240
/** Extra drag in a bowl, per second, so the ball settles instead of circling. */
const BOWL_DRAG = 2.5
/** A spinning floor presses the ball outward this share as hard as it carries it round. */
const SPIN_OUT = 0.7
/**
 * A gentle slope holds a slow ball: under this pull, a ball slower than
 * STICK_SPEED stays put rather than creeping to the nearest rail, so a hole
 * can lean without every ball ending at the bottom of it. It lets go of a
 * ball gradually, from STICK_FULL down, so a slowing ball comes to rest
 * rather than being carried along a rail at a crawl. A steeper slope sends
 * it back down whatever its speed.
 */
const STICK_PULL = 40
const STICK_SPEED = 7
const STICK_FULL = 20
/** A ball has to be going this fast to take off from a ramp, unless the ramp asks for more; slower, it rolls over it. */
const RAMP_MIN = 60
/** And it has to be heading up the ramp: within this much of straight (the cosine of about 35°). */
const RAMP_SQUARE = 0.82
/**
 * A ramp flies the ball its `len` at a quarter over its take-off speed, and
 * further or shorter in proportion, within these shares of it; so a soft
 * take-off falls short and a hard one flies long.
 */
const RAMP_REF = 1.25
const RAMP_SHORTEST = 0.75
const RAMP_LONGEST = 1.7
/** The share of the angle it came in at, off straight up the ramp, that a ball keeps in the air. */
const RAMP_KEEP_ANGLE = 0.25
/** Landing keeps this share of the speed. */
const LAND_KEEP = 0.85
/** A drawbridge takes this long to come down or go up. */
export const BRIDGE_SWING = 0.35
/** Nothing rolls faster than this, however it was sped up: a fifth over the hardest shot. */
const TOP_SPEED = MAX_SPEED * 1.2
/** A ball slower than this within the cup drops; faster, it skips across. */
const CUP_CAPTURE_SPEED = 65
const CUP_PULL = 1.7
/** The intro flies the length of the hole, cup to tee, in this long. */
const INTRO_TIME = 2.6
/** Lining up a shot, the ball sits this share of the window below the middle, so more of the way ahead shows. */
const AIM_LEAD = 0.16
/** How fast the camera closes on where it wants to be, per second. */
const CAM_EASE = 5
const SPLASH_TIME = 1.0
const SUNK_TIME = 0.95
const MAX_ROLL = 12
/** A rover hit throws the ball back this hard, plus half the rover's own motion. */
const ROVER_BOUNCE = 0.9
const ROVER_CARRY = 0.5
const SUBSTEPS = 6
/** Keyboard aim turns this fast, in radians a second. */
const KEY_TURN = 1.9

export type Ball = { x: number; y: number; vx: number; vy: number }

/** A rover on the move, and how long until its flash can go again. */
export type RoverState = { x: number; y: number; vx: number; vy: number; cool: number }

export type HoleResult = {
  strokes: number
  par: number
  points: number
  label: string
  /** The fewest strokes this player has ever taken here. */
  best: boolean
}

export type Popup = { text: string; sub: string | null; life: number }

/** A word rising from where it happened, in field coordinates: a splash, or out of bounds. */
export type Floater = { x: number; y: number; text: string; life: number }

export type GameState = {
  phase: Phase
  score: number
  best: number
  holeIndex: number
  strokes: number
  results: HoleResult[]
  /** The fewest strokes ever taken on each hole, by name: what there is to beat. */
  holeBests: Record<string, number>
  ball: Ball
  /** Seconds the current phase has run. */
  t: number
  /** Runs the whole round; the windmills turn, the sliders slide and the cups slide on it. */
  clock: number
  /** The camera: the field y at the cup end of the window on screen. */
  cam: number
  /** Where the camera is headed while aiming: the ball, until the player looks along the hole. */
  look: number
  /** Which corner the map is in, chosen at each address so it is not over the ball. */
  mapSide: MapSide
  /** The shot being lined up. */
  aim: number
  /** The shot being set: a finger pulling back, or space held down; and how hard, 0 to 1. */
  aiming: 'none' | 'drag' | 'key'
  /** Seconds space has been held, for the charge. */
  chargeT: number
  power: number
  /** Where this stroke started, for a splash to send the ball back to. */
  strokeStart: Vec
  /** How long the ball has rolled this stroke. */
  rollTime: number
  /** How long the ball has been all but still this stroke. */
  restT: number
  inSand: boolean
  onPad: boolean
  /** Off a ramp: how far the ball still has to fly, and how far the flight was. Zero on the ground. */
  air: number
  airMax: number
  /** Ball scale while dropping into the cup. */
  drop: number
  /** Flash timers per bumper and per wall (kickers), for the renderer. */
  bumperFlash: number[]
  wallFlash: number[]
  /** The rovers, where they are and where they are going. */
  rovers: RoverState[]
  roverFlash: number[]
  floaters: Floater[]
  popup: Popup | null
  flash: number
  stageW: number
  stageH: number
}

export type Snapshot = {
  phase: Phase
  score: number
  best: number
  holeIndex: number
  strokes: number
  par: number
  toPar: number
  /** Holes this round played in fewer strokes than ever before. */
  bests: number
  aiming: 'none' | 'drag' | 'key'
}

function loadBest() {
  return getPersonalBest('putt')
}

export function currentHole(state: GameState): Hole {
  return COURSE[Math.min(state.holeIndex, COURSE.length - 1)]!
}

/*
 * The walls of a hole are the traced edge of its ground, then whatever was
 * placed by hand, then the towers of its windmills. The trace samples every
 * unit and keeps the line within an eighth of one, so a curve reads as a
 * curve. It costs a few tens of milliseconds, so it is done once per hole
 * and kept.
 */
const TRACE_CELL = 1
const TRACE_TOL = 0.12
/** The walls are filed by the square of the ground they could touch a ball in, this many units a side. */
const WALL_CELL = 6
/** How far from a wall's line its square reaches: a ball, or a rover up to this big, less half a unit. */
const FILE_REACH = 3.2
const WALL_MARGIN = 10
type Traced = { edges: Vec[][]; walls: Wall[]; cols: number; cells: Wall[][] }
const traced = new WeakMap<Hole, Traced>()

function trace(hole: Hole): Traced {
  let t = traced.get(hole)
  if (t) return t
  const edges = contours(hole.green, FIELD_W, hole.h, TRACE_CELL, TRACE_TOL, hole.blend)
  const edgeWalls: Wall[] = []
  for (const line of edges) {
    for (let i = 1; i < line.length; i++) {
      edgeWalls.push({ a: line[i - 1]!, b: line[i]!, t: EDGE_T, edge: true })
    }
  }
  const walls = [...edgeWalls, ...hole.walls, ...hole.mills.flatMap(towerWalls)]
  // Each wall goes in every square within a ball's reach of it, in order, so a ball need only ask its own square.
  const cols = Math.ceil((FIELD_W + WALL_MARGIN * 2) / WALL_CELL)
  const rows = Math.ceil((hole.h + WALL_MARGIN * 2) / WALL_CELL)
  const cells: Wall[][] = Array.from({ length: cols * rows }, () => [])
  for (const wall of walls) {
    const reach = wall.t + FILE_REACH
    const c0 = Math.max(0, Math.floor((Math.min(wall.a.x, wall.b.x) - reach + WALL_MARGIN) / WALL_CELL))
    const c1 = Math.min(cols - 1, Math.floor((Math.max(wall.a.x, wall.b.x) + reach + WALL_MARGIN) / WALL_CELL))
    const r0 = Math.max(0, Math.floor((Math.min(wall.a.y, wall.b.y) - reach + WALL_MARGIN) / WALL_CELL))
    const r1 = Math.min(rows - 1, Math.floor((Math.max(wall.a.y, wall.b.y) + reach + WALL_MARGIN) / WALL_CELL))
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells[r * cols + c]!.push(wall)
  }
  t = { edges, walls, cols, cells }
  traced.set(hole, t)
  return t
}

/** Every wall on a hole: the traced edge first, then the placed ones, then the windmills' towers. */
export function wallsOf(hole: Hole): Wall[] {
  return trace(hole).walls
}

const NO_WALLS: Wall[] = []

/** The walls a ball at `p` could be touching: those filed under its square. */
function wallsNear(hole: Hole, p: Vec): Wall[] {
  const t = trace(hole)
  const c = Math.floor((p.x + WALL_MARGIN) / WALL_CELL)
  const r = Math.floor((p.y + WALL_MARGIN) / WALL_CELL)
  if (c < 0 || c >= t.cols || r < 0) return NO_WALLS
  return t.cells[r * t.cols + c] ?? NO_WALLS
}

/** The traced edge of a hole's ground, as closed loops, for drawing. */
export function edgesOf(hole: Hole): Vec[][] {
  return trace(hole).edges
}

/** Whether a point is on the ground: the green, blended as it is traced. */
export function onGround(hole: Hole, p: Vec) {
  return inUnion(hole.green, p, hole.blend)
}

/**
 * A windmill's tower as walls: its round face, open at the two doors, and
 * the two sides of the tunnel between them. Hidden, because the tower is
 * drawn as itself.
 */
function towerWalls(m: Mill): Wall[] {
  const t = 1
  // The face's centre line, so its outside is at r; and the tunnel's sides, so it is `door` clear either side.
  const R = m.r - t
  const half = m.door + t
  const ux = Math.cos(m.dir)
  const uy = Math.sin(m.dir)
  const gap = Math.asin(Math.min(1, half / R))
  const along = Math.sqrt(Math.max(0, R * R - half * half))
  const at = (a: number): Vec => ({ x: m.x + Math.cos(a) * R, y: m.y + Math.sin(a) * R })
  const walls: Wall[] = []
  for (const side of [1, -1]) {
    const a0 = m.dir + side * gap
    const a1 = m.dir + side * (Math.PI - gap)
    const n = 12
    for (let i = 0; i < n; i++) {
      walls.push({ a: at(a0 + ((a1 - a0) * i) / n), b: at(a0 + ((a1 - a0) * (i + 1)) / n), t, hidden: true })
    }
    const ox = -uy * half * side
    const oy = ux * half * side
    walls.push({
      a: { x: m.x + ox - ux * along, y: m.y + oy - uy * along },
      b: { x: m.x + ox + ux * along, y: m.y + oy + uy * along },
      t,
      hidden: true,
    })
  }
  return walls
}

/**
 * Whether a sail is over a windmill's door at a moment: the sails sweep
 * down past both doors, and a door is shut while one of them is across it.
 */
function doorShut(m: Mill, doorAngle: number, clock: number) {
  const half = Math.atan2(m.door + SAIL_T * 1.25, m.r)
  const base = m.phase + m.speed * clock
  for (let k = 0; k < m.sails; k++) {
    let d = (base + (k * Math.PI * 2) / m.sails - doorAngle) % (Math.PI * 2)
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    if (Math.abs(d) < half) return true
  }
  return false
}

/**
 * A windmill's shut doors at a moment, as walls across the ends of its
 * tunnel. A ball meets one square on and comes back off it; one caught in the
 * doorway as it shuts is put out of the way, in or out, never into the stone.
 */
export function millGates(m: Mill, clock: number): Wall[] {
  const R = m.r - 1
  const half = m.door + 1
  const along = Math.sqrt(Math.max(0, R * R - half * half))
  const out: Wall[] = []
  for (const turn of [0, Math.PI]) {
    const a = m.dir + turn
    if (!doorShut(m, a, clock)) continue
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const cx = m.x + ux * along
    const cy = m.y + uy * along
    out.push({ a: { x: cx - uy * half, y: cy + ux * half }, b: { x: cx + uy * half, y: cy - ux * half }, t: 1 })
  }
  return out
}

/** The windmill whose roof is over a point, if any: a ball in the tunnel is out of sight. */
export function millOver(hole: Hole, p: Vec): Mill | null {
  for (const m of hole.mills) if (Math.hypot(p.x - m.x, p.y - m.y) < m.r) return m
  return null
}

/** Where the cup is right now: most sit still, one slides. */
export function cupAt(hole: Hole, clock: number): Vec {
  const path = hole.cupPath
  if (!path) return hole.cup
  const u = (clock % path.period) / path.period
  const k = u < 0.5 ? u * 2 : 2 - u * 2
  const e = k * k * (3 - 2 * k)
  return { x: hole.cup.x + (path.to.x - hole.cup.x) * e, y: hole.cup.y + (path.to.y - hole.cup.y) * e }
}

/**
 * How far down a drawbridge is, 0 up to 1 down: it comes down at the start
 * of each period, stays for its `down` share, and goes up again, each swing
 * taking BRIDGE_SWING. The ball can cross above a half.
 */
export function bridgeLevel(db: Drawbridge, clock: number) {
  return swing(db.period, db.down, db.phase ?? 0, clock)
}

/** How open a gate is, 0 shut to 1 open, on the same swing as a drawbridge: it is open above a half. */
export function gateLevel(g: Gate, clock: number) {
  return swing(g.period, g.open, g.phase ?? 0, clock)
}

/** Something that comes and goes on a cycle: in over BRIDGE_SWING at the start, out again after its share. */
function swing(period: number, share: number, phase: number, clock: number) {
  const t = clock + phase
  const u = ((t % period) + period) % period
  const inFor = period * share
  const coming = Math.min(1, u / BRIDGE_SWING)
  const going = Math.min(1, Math.max(0, (u - inFor) / BRIDGE_SWING))
  return Math.max(0, coming - going)
}

/** The gates that are shut at a moment, as walls. */
export function shutGates(hole: Hole, clock: number): Wall[] {
  const out: Wall[] = []
  for (const g of hole.gates) if (gateLevel(g, clock) < 0.5) out.push({ a: g.a, b: g.b, t: g.t })
  return out
}

/** Where a slider is along its run, 0 to 1, and how fast it is going. */
export function sliderAt(sl: Slider, clock: number) {
  const w = (Math.PI * 2) / sl.period
  const t = clock + (sl.phase ?? 0)
  const u = 0.5 - 0.5 * Math.cos(w * t)
  const du = 0.5 * w * Math.sin(w * t)
  return { u, vx: sl.dx * du, vy: sl.dy * du }
}

/** A slider's bar, as a wall, at a moment. */
export function sliderWall(sl: Slider, clock: number): Wall {
  const { u } = sliderAt(sl, clock)
  const ox = sl.dx * u
  const oy = sl.dy * u
  return { a: { x: sl.a.x + ox, y: sl.a.y + oy }, b: { x: sl.b.x + ox, y: sl.b.y + oy }, t: sl.t }
}

export function createInitialState(w = 540, h = 720): GameState {
  const first = COURSE[0]!
  const startCam = aimCam(fieldFrame(w, h, first.h), first.tee.y)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    holeIndex: 0,
    strokes: 0,
    results: [],
    holeBests: loadHoleBests(),
    ball: { x: first.tee.x, y: first.tee.y, vx: 0, vy: 0 },
    t: 0,
    clock: 0,
    cam: startCam,
    look: startCam,
    mapSide: 'near',
    aim: 0,
    aiming: 'none',
    chargeT: 0,
    power: 0,
    strokeStart: { x: first.tee.x, y: first.tee.y },
    rollTime: 0,
    restT: 0,
    inSand: false,
    onPad: false,
    air: 0,
    airMax: 0,
    drop: 1,
    bumperFlash: first.bumpers.map(() => 0),
    wallFlash: wallsOf(first).map(() => 0),
    rovers: roversAtStart(first),
    roverFlash: first.rovers.map(() => 0),
    floaters: [],
    popup: null,
    flash: 0,
    stageW: w,
    stageH: h,
  }
}

export function resizeState(state: GameState, w: number, h: number): GameState {
  return { ...state, stageW: w, stageH: h }
}

/**
 * Where the view of the field sits on the screen. The hole is 100 wide and
 * longer than the screen: the width fills the screen's short side, and a
 * window `vis` units long shows part of the length. On a landscape screen
 * the hole lies on its side, tee on the left and cup on the right. A band
 * above carries the hole and strokes, one below the cue.
 */
export function fieldFrame(w: number, h: number, len: number) {
  const top = Math.max(40, h * 0.085)
  const bottom = Math.max(44, h * 0.09)
  const side = Math.max(8, w * 0.02)
  const availW = w - side * 2
  const availH = h - top - bottom
  const rotated = availW > availH
  const short = rotated ? availH : availW
  const long = rotated ? availW : availH
  const s = short / FIELD_W
  const vis = Math.min(len, long / s)
  const pw = rotated ? vis * s : FIELD_W * s
  const ph = rotated ? FIELD_W * s : vis * s
  return {
    s,
    rotated,
    x: side + (availW - pw) / 2,
    y: top + (availH - ph) / 2,
    w: pw,
    h: ph,
    top,
    bottom,
    vis,
    len,
  }
}

export type Frame = ReturnType<typeof fieldFrame>

/** The camera that shows the window centred on `centreY`, kept within the hole. */
export function camFor(f: Frame, centreY: number) {
  return Math.max(0, Math.min(f.len - f.vis, centreY - f.vis / 2))
}

/** The camera for lining up a shot from field y `ballY`: the ball a little below the middle, more of the hole ahead. */
export function aimCam(f: Frame, ballY: number) {
  return camFor(f, ballY - f.vis * AIM_LEAD)
}

/** Field coordinates to screen, with the camera at `cam` (the field y at the cup end of the window). */
export function toScreen(f: Frame, cam: number, p: Vec): Vec {
  if (f.rotated) return { x: f.x + (cam + f.vis - p.y) * f.s, y: f.y + p.x * f.s }
  return { x: f.x + p.x * f.s, y: f.y + (p.y - cam) * f.s }
}

/** A screen point to field coordinates. */
export function toField(f: Frame, cam: number, sx: number, sy: number): Vec {
  if (f.rotated) return { x: (sy - f.y) / f.s, y: cam + f.vis - (sx - f.x) / f.s }
  return { x: (sx - f.x) / f.s, y: cam + (sy - f.y) / f.s }
}

function beginHole(state: GameState, index: number): GameState {
  const hole = COURSE[index]!
  return {
    ...state,
    phase: 'intro',
    holeIndex: index,
    strokes: 0,
    ball: { x: hole.tee.x, y: hole.tee.y, vx: 0, vy: 0 },
    t: 0,
    // The intro flies the hole from the cup back to the tee.
    cam: 0,
    look: 0,
    // Straight up the hole, not at the cup: the line is the player's to find.
    aim: UP,
    aiming: 'none',
    chargeT: 0,
    power: 0,
    strokeStart: { x: hole.tee.x, y: hole.tee.y },
    rollTime: 0,
    restT: 0,
    inSand: false,
    onPad: false,
    air: 0,
    airMax: 0,
    drop: 1,
    bumperFlash: hole.bumpers.map(() => 0),
    wallFlash: wallsOf(hole).map(() => 0),
    rovers: roversAtStart(hole),
    roverFlash: hole.rovers.map(() => 0),
    floaters: [],
  }
}

function roversAtStart(hole: Hole): RoverState[] {
  return hole.rovers.map((r) => ({
    x: r.x,
    y: r.y,
    vx: Math.cos(r.heading) * r.speed,
    vy: Math.sin(r.heading) * r.speed,
    cool: 0,
  }))
}

export function startGame(prev: GameState): GameState {
  const fresh = createInitialState(prev.stageW, prev.stageH)
  return beginHole({ ...fresh, best: Math.max(prev.best, loadBest()) }, 0)
}

/** Admin and dev: skip to a hole. The round is marked assisted by the caller, so its score stays off the boards. */
export function jumpToHole(state: GameState, index: number): GameState {
  return beginHole(state, Math.max(0, Math.min(COURSE.length - 1, index)))
}

/** Holding space: the charge runs up over half the time and back down over the other half. */
export function chargeAt(t: number) {
  const cycle = (t % (KEY_CHARGE * 2)) / KEY_CHARGE
  return cycle <= 1 ? cycle : 2 - cycle
}

/** A screen-space movement to field units. */
export function toFieldDelta(f: Frame, dx: number, dy: number): Vec {
  if (f.rotated) return { x: dy / f.s, y: -dx / f.s }
  return { x: dx / f.s, y: dy / f.s }
}

/** A finger pulling back from the ball: the shot goes the other way, harder the further the pull. */
export function setDragAim(state: GameState, pullX: number, pullY: number): GameState {
  if (state.phase !== 'aim' || state.aiming === 'key') return state
  const len = Math.hypot(pullX, pullY)
  const power = Math.min(1, len / MAX_DRAG)
  const aim = len > 0.5 ? Math.atan2(-pullY, -pullX) : state.aim
  // Setting a shot brings the view back to the ball, wherever the player was looking.
  const look = state.aiming === 'drag' ? state.look : lookAtBall(state)
  return { ...state, aiming: 'drag', aim, power, look }
}

/** The finger lifts short of a shot, or space is let go early: nothing spent. */
export function cancelAim(state: GameState): GameState {
  if (state.phase !== 'aim') return state
  return { ...state, aiming: 'none', power: 0, chargeT: 0 }
}

/** Keyboard, each frame: turn the aim, and while space is held run the charge up and down. */
export function keyAim(state: GameState, turn: number, charging: boolean, dt: number): GameState {
  if (state.phase !== 'aim' || state.aiming === 'drag') return state
  const aim = state.aim + turn * KEY_TURN * dt
  if (!charging) return { ...state, aim, aiming: 'none', power: 0, chargeT: 0 }
  const starting = state.aiming !== 'key'
  const chargeT = starting ? 0 : state.chargeT + dt
  const look = starting ? lookAtBall(state) : state.look
  return { ...state, aim, aiming: 'key', chargeT, power: chargeAt(chargeT), look }
}

/** How far a pull of `power` carries on the flat green before it stops. */
export function shotDistance(power: number) {
  const p = Math.max(0, Math.min(1, power))
  return EVEN_DISTANCE * p + (FULL_DISTANCE - EVEN_DISTANCE) * p * p * p * p
}

/** The pull that carries `distance` on the flat green: for a pilot that knows where it wants the ball. */
export function powerForDistance(distance: number) {
  if (distance <= 0) return 0
  if (distance >= FULL_DISTANCE) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (shotDistance(mid) < distance) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** The pull that sends the ball off at `speed`: for a ramp that wants it going that fast. */
export function powerForSpeed(speed: number) {
  return powerForDistance(speed / FADE_GREEN)
}

/** The release speed for a pull of `power`. */
function launchSpeed(power: number) {
  return shotDistance(power) * FADE_GREEN
}

/** The window start for lining up a shot: the ball a little below the middle of the view. */
function lookAtBall(state: GameState) {
  const f = fieldFrame(state.stageW, state.stageH, currentHole(state).h)
  return aimCam(f, state.ball.y)
}

/** Looking along the hole before the shot: move the view by `dy` field units. */
export function panLook(state: GameState, dy: number): GameState {
  if (state.phase !== 'aim' || state.aiming !== 'none' || dy === 0) return state
  const f = fieldFrame(state.stageW, state.stageH, currentHole(state).h)
  return { ...state, look: Math.max(0, Math.min(f.len - f.vis, state.look + dy)) }
}

/** Looking along the hole before the shot: centre the view on field `y`. */
export function lookAt(state: GameState, y: number): GameState {
  if (state.phase !== 'aim' || state.aiming !== 'none') return state
  const f = fieldFrame(state.stageW, state.stageH, currentHole(state).h)
  return { ...state, look: camFor(f, y) }
}

/** Which corner at the cup end the map takes: the usual one, or the other when the ball is under it. */
export type MapSide = 'near' | 'far'

/**
 * Where the map sits on screen: a corner of the window at the cup end, a
 * fifth of the window's short side wide, as long as the hole is. Upright,
 * the corners are top-right and top-left; on its side, top-right and
 * bottom-right.
 */
export function mapLayout(f: Frame, len: number, side: MapSide = 'near') {
  // A fifth of the short side wide, but never more than half the window long: a long hole on a
  // phone would otherwise run the map down most of the screen.
  const shortWanted = Math.max(44, Math.min(72, (f.rotated ? f.h : f.w) * 0.2))
  const k = Math.min(shortWanted / FIELD_W, ((f.rotated ? f.w : f.h) * 0.48) / len)
  const short = FIELD_W * k
  const long = len * k
  const w = f.rotated ? long : short
  const h = f.rotated ? short : long
  const inset = 8
  const right = f.x + f.w - w - inset
  const top = f.y + inset
  const x = f.rotated || side === 'near' ? right : f.x + inset
  const y = !f.rotated || side === 'near' ? top : f.y + f.h - h - inset
  return { x, y, w, h, k, len }
}

export type MapLayout = ReturnType<typeof mapLayout>

/** Whether a screen point sits under the map, with a little room around it. */
export function underMap(m: MapLayout, sx: number, sy: number, room = 14) {
  return sx > m.x - room && sx < m.x + m.w + room && sy > m.y - room && sy < m.y + m.h + room
}

/** The corner for the next shot: away from wherever the ball has come to rest. */
function mapSideFor(s: GameState): MapSide {
  const hole = currentHole(s)
  const f = fieldFrame(s.stageW, s.stageH, hole.h)
  const p = toScreen(f, aimCam(f, s.ball.y), s.ball)
  return underMap(mapLayout(f, hole.h, 'near'), p.x, p.y) ? 'far' : 'near'
}

/** Whether a screen point is on the map, with a little grace around it. */
export function onMap(m: MapLayout, sx: number, sy: number) {
  const grace = 8
  return sx >= m.x - grace && sx <= m.x + m.w + grace && sy >= m.y - grace && sy <= m.y + m.h + grace
}

/** The field y a screen point on the map stands for. */
export function mapFieldY(m: MapLayout, f: Frame, sx: number, sy: number) {
  return f.rotated ? m.len - (sx - m.x) / m.k : (sy - m.y) / m.k
}

/** Let go: the shot happens with the aim and power lined up. Too little pull is a change of mind. */
export function shoot(state: GameState, shank = 0): GameState {
  if (state.phase !== 'aim') return state
  if (state.power < MIN_POWER) return cancelAim(state)
  // Out of sand the ball comes away heavy.
  const lie = inAny(currentHole(state).sand, state.ball) ? SAND_LIE : 1
  const speed = launchSpeed(Math.min(1, state.power)) * lie
  const angle = state.aim + shank
  // The band snaps, and a hard shot whooshes off it.
  sfx('zip', state.power < 0.5 ? 1 : 0)
  if (state.power >= 0.5) sfx('whoosh')
  return {
    ...state,
    phase: 'roll',
    aiming: 'none',
    t: 0,
    rollTime: 0,
    restT: 0,
    strokes: state.strokes + 1,
    strokeStart: { x: state.ball.x, y: state.ball.y },
    ball: {
      ...state.ball,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    },
  }
}

function inRect(r: Rect, x: number, y: number) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

/** Closest point on a wall's centre line to a point. */
function closestOnWall(wall: Wall, p: Vec): Vec {
  const abx = wall.b.x - wall.a.x
  const aby = wall.b.y - wall.a.y
  const len2 = abx * abx + aby * aby || 1
  const u = Math.max(0, Math.min(1, ((p.x - wall.a.x) * abx + (p.y - wall.a.y) * aby) / len2))
  return { x: wall.a.x + abx * u, y: wall.a.y + aby * u }
}

/** A windmill's blade, as a wall, at a moment. */
export function spinnerWall(sp: Spinner, clock: number): Wall {
  const angle = sp.phase + sp.speed * clock
  const dx = Math.cos(angle) * sp.len * 0.5
  const dy = Math.sin(angle) * sp.len * 0.5
  return { a: { x: sp.x - dx, y: sp.y - dy }, b: { x: sp.x + dx, y: sp.y + dy }, t: SPINNER_T }
}

/** Whether a ball heading (vx, vy) goes through a flap rather than meeting it. */
function passesFlap(wall: Wall, vx: number, vy: number) {
  return wall.pass !== undefined && vx * Math.cos(wall.pass) + vy * Math.sin(wall.pass) > 0
}

type Contact = { nx: number; ny: number; reflected: boolean }

/**
 * Keep a ball out of a round thing it has come within `reach` of, and bounce
 * it if it was heading in. Returns the contact normal, or null if clear.
 */
function bounce(ball: Ball, cx: number, cy: number, reach: number, restitution: number): Contact | null {
  let nx = ball.x - cx
  let ny = ball.y - cy
  let d = Math.hypot(nx, ny)
  if (d >= reach) return null
  if (d < 1e-6) {
    nx = 1
    ny = 0
    d = 1
  }
  nx /= d
  ny /= d
  ball.x = cx + nx * reach
  ball.y = cy + ny * reach
  const along = ball.vx * nx + ball.vy * ny
  const reflected = along < -0.01
  if (reflected) {
    ball.vx -= (1 + restitution) * along * nx
    ball.vy -= (1 + restitution) * along * ny
  }
  return { nx, ny, reflected }
}

/** A bumper is a bounce that adds its own kick. */
function popBumper(ball: Ball, cx: number, cy: number, reach: number): boolean {
  const before = Math.hypot(ball.vx, ball.vy)
  const c = bounce(ball, cx, cy, reach, BUMPER_KEEP)
  if (!c || !c.reflected) return false
  const after = Math.hypot(ball.vx, ball.vy) || 1
  const want = Math.max(BUMPER_POP, before * BUMPER_KEEP)
  ball.vx *= want / after
  ball.vy *= want / after
  return true
}

/** A wall that moves: the ball bounces relative to the wall's own motion at the contact. */
function bounceMoving(ball: Ball, w: Wall, wvx: number, wvy: number, restitution: number): boolean {
  const p = closestOnWall(w, ball)
  ball.vx -= wvx
  ball.vy -= wvy
  const c = bounce(ball, p.x, p.y, w.t + BALL_R, restitution)
  ball.vx += wvx
  ball.vy += wvy
  return !!c
}

/** A blade is a wall that turns: its speed at the contact is across the radius. */
function bounceSpinner(ball: Ball, sp: Spinner, clock: number, restitution: number): boolean {
  const w = spinnerWall(sp, clock)
  const p = closestOnWall(w, ball)
  return bounceMoving(ball, w, -sp.speed * (p.y - sp.y), sp.speed * (p.x - sp.x), restitution)
}

/** A slider is a wall that slides: the whole bar shares one speed. */
function bounceSlider(ball: Ball, sl: Slider, clock: number, restitution: number): boolean {
  const { vx, vy } = sliderAt(sl, clock)
  return bounceMoving(ball, sliderWall(sl, clock), vx, vy, restitution)
}

/** A flight off a ramp: how far is left, and how far it was. */
type Flight = { air: number; max: number }

type StepOut = {
  wall: boolean
  kicked: boolean
  bumpers: number[]
  rovers: number[]
  sand: boolean
  pad: boolean
  slope: boolean
  spin: boolean
  water: boolean
  piped: boolean
  launched: boolean
  landed: boolean
  /** Landed off the ground altogether. */
  oob: boolean
  /** Rolled over the edge into a drop. */
  pit: boolean
}

/**
 * The ball meets a rover: it comes off like a bumper, carrying some of the
 * rover's motion, and the rover caroms away at its steady speed. Mutates both.
 */
function strikeRover(ball: Ball, rv: RoverState, r: number, speed: number): boolean {
  const dx = ball.x - rv.x
  const dy = ball.y - rv.y
  const d = Math.hypot(dx, dy)
  const reach = BALL_R + r
  if (d >= reach || d < 1e-6) return false
  const nx = dx / d
  const ny = dy / d
  const push = reach - d
  ball.x += nx * push * 0.5
  ball.y += ny * push * 0.5
  rv.x -= nx * push * 0.5
  rv.y -= ny * push * 0.5
  const along = ball.vx * nx + ball.vy * ny
  const rAlong = rv.vx * nx + rv.vy * ny
  if (rAlong > 0) {
    rv.vx -= 2 * rAlong * nx
    rv.vy -= 2 * rAlong * ny
    const sp = Math.hypot(rv.vx, rv.vy) || 1
    rv.vx = (rv.vx / sp) * speed
    rv.vy = (rv.vy / sp) * speed
  }
  if (along - rAlong >= 0) return false
  ball.vx -= (1 + ROVER_BOUNCE) * along * nx
  ball.vy -= (1 + ROVER_BOUNCE) * along * ny
  ball.vx += rv.vx * ROVER_CARRY
  ball.vy += rv.vy * ROVER_CARRY
  return true
}

/** Whether a point is dry: on a bridge, on a drawbridge that is down, or not over water at all. */
function dryAt(hole: Hole, p: Vec, clock: number) {
  if (!inAny(hole.water, p)) return true
  if (inAny(hole.bridges, p)) return true
  return hole.drawbridges.some((db) => bridgeLevel(db, clock) > 0.5 && inside(db.shape, p))
}

/** One sub-step of rolling. Mutates the ball, the rovers and the flight; returns what it touched. */
function step(ball: Ball, hole: Hole, rovers: RoverState[], flight: Flight, dt: number, clock: number): StepOut {
  const out: StepOut = {
    wall: false,
    kicked: false,
    bumpers: [],
    rovers: [],
    sand: false,
    pad: false,
    slope: false,
    spin: false,
    water: false,
    piped: false,
    launched: false,
    landed: false,
    oob: false,
    pit: false,
  }

  // In the air: a straight line at a steady speed over whatever is below, until the flight runs out.
  if (flight.air > 0) {
    const dist = Math.hypot(ball.vx, ball.vy) * dt
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
    flight.air -= dist
    if (flight.air > 0 && dist > 0) return out
    flight.air = 0
    ball.vx *= LAND_KEEP
    ball.vy *= LAND_KEEP
    out.landed = true
    if (!onGround(hole, ball)) out.oob = true
    return out
  }

  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  const sand = inAny(hole.sand, ball)
  out.sand = sand
  // The share is set per sixtieth, so the fade is the same whatever the frame rate.
  const keep = Math.pow(sand ? FRICTION_SAND : FRICTION_GREEN, dt * 60)
  ball.vx *= keep
  ball.vy *= keep

  for (const pad of hole.boosts) {
    if (!inRect(pad, ball.x, ball.y)) continue
    ball.vx += Math.cos(pad.dir) * BOOST_ACCEL * dt
    ball.vy += Math.sin(pad.dir) * BOOST_ACCEL * dt
    out.pad = true
  }
  // Hills push downhill, bowls pull to the middle, repellers push away from it, and a spinning floor
  // carries the ball round it. A ball on any of them does not settle the way it does on the flat.
  for (const sl of hole.slopes) {
    if (!inside(sl.shape, ball)) continue
    out.slope = true
    if (sl.pull) {
      const speed = Math.hypot(ball.vx, ball.vy)
      const share =
        Math.hypot(sl.pull.x, sl.pull.y) > STICK_PULL
          ? 1
          : Math.min(1, Math.max(0, (speed - STICK_SPEED) / (STICK_FULL - STICK_SPEED)))
      ball.vx += sl.pull.x * share * dt
      ball.vy += sl.pull.y * share * dt
    }
    if (sl.dish) {
      const c = pivotOf(sl.shape)
      const dx = c.x - ball.x
      const dy = c.y - ball.y
      const d = Math.hypot(dx, dy) || 1
      ball.vx += (dx / d) * sl.dish * dt
      ball.vy += (dy / d) * sl.dish * dt
    }
    if (sl.bowl) {
      const c = centreOf(sl.shape)
      const dx = c.x - ball.x
      const dy = c.y - ball.y
      const d = Math.hypot(dx, dy) || 1
      ball.vx += (dx / d) * sl.bowl * dt
      ball.vy += (dy / d) * sl.bowl * dt
      // A bowl drains: the ball loses its swirl and settles to the middle rather than orbiting.
      const drag = Math.exp(-BOWL_DRAG * dt)
      ball.vx *= drag
      ball.vy *= drag
    }
    if (sl.repel) {
      const c = pivotOf(sl.shape)
      const dx = ball.x - c.x
      const dy = ball.y - c.y
      const d = Math.hypot(dx, dy) || 1
      ball.vx += (dx / d) * sl.repel * dt
      ball.vy += (dy / d) * sl.repel * dt
    }
    if (sl.spin) {
      out.spin = true
      const c = pivotOf(sl.shape)
      const dx = ball.x - c.x
      const dy = ball.y - c.y
      const d = Math.hypot(dx, dy) || 1
      // Round: anticlockwise on screen is up the right side, over the top, down the left.
      ball.vx += (dy / d) * sl.spin * dt
      ball.vy += (-dx / d) * sl.spin * dt
      // And outward, to the bank.
      const press = Math.abs(sl.spin) * SPIN_OUT
      ball.vx += (dx / d) * press * dt
      ball.vy += (dy / d) * press * dt
    }
  }
  // A ramp: crossed the right way fast enough, the ball takes off and this step is over.
  for (const rp of hole.ramps) {
    if (!inRect(rp, ball.x, ball.y)) continue
    const along = ball.vx * Math.cos(rp.dir) + ball.vy * Math.sin(rp.dir)
    const sp = Math.hypot(ball.vx, ball.vy)
    if (sp < (rp.min ?? RAMP_MIN) || along < sp * RAMP_SQUARE) continue
    // The ramp throws the ball up its own way, keeping a little of the angle it came in at, at the speed it
    // arrived, and as far as that speed carries it: hit just right, and it lands where it was meant to.
    let off = Math.atan2(ball.vy, ball.vx) - rp.dir
    off = Math.atan2(Math.sin(off), Math.cos(off))
    const heading = rp.dir + off * RAMP_KEEP_ANGLE
    ball.vx = Math.cos(heading) * sp
    ball.vy = Math.sin(heading) * sp
    const stretch = Math.min(RAMP_LONGEST, Math.max(RAMP_SHORTEST, sp / ((rp.min ?? RAMP_MIN) * RAMP_REF)))
    flight.air = rp.len * stretch
    flight.max = flight.air
    out.launched = true
    return out
  }
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > TOP_SPEED) {
    ball.vx *= TOP_SPEED / speed
    ball.vy *= TOP_SPEED / speed
  }

  for (const wall of wallsNear(hole, ball)) {
    // A flap is open from one side.
    if (passesFlap(wall, ball.vx, ball.vy)) continue
    const p = closestOnWall(wall, ball)
    const c = bounce(ball, p.x, p.y, wall.t + BALL_R, wall.kick ? 1 : WALL_BOUNCE)
    if (!c || !c.reflected) continue
    if (wall.kick) {
      ball.vx += c.nx * KICK_SPEED
      ball.vy += c.ny * KICK_SPEED
      out.kicked = true
    } else {
      out.wall = true
    }
  }
  for (const sp of hole.spinners) {
    if (bounceSpinner(ball, sp, clock, WALL_BOUNCE)) out.wall = true
  }
  for (const gate of [...hole.mills.flatMap((m) => millGates(m, clock)), ...shutGates(hole, clock)]) {
    const p = closestOnWall(gate, ball)
    if (bounce(ball, p.x, p.y, gate.t + BALL_R, DOOR_BOUNCE)?.reflected) out.wall = true
  }
  for (const sl of hole.sliders) {
    if (bounceSlider(ball, sl, clock, WALL_BOUNCE)) out.wall = true
  }
  for (const rk of hole.rocks) {
    if (bounce(ball, rk.x, rk.y, rk.r + BALL_R, WALL_BOUNCE)?.reflected) out.wall = true
  }
  hole.bumpers.forEach((b, i) => {
    if (popBumper(ball, b.x, b.y, b.r + BALL_R)) out.bumpers.push(i)
  })
  hole.rovers.forEach((spec, i) => {
    const rv = rovers[i]!
    if (!strikeRover(ball, rv, spec.r, spec.speed)) return
    if (rv.cool > 0) return
    rv.cool = 0.35
    out.rovers.push(i)
  })
  for (const pipe of hole.portals) {
    if (Math.hypot(ball.x - pipe.a.x, ball.y - pipe.a.y) >= PORTAL_R) continue
    const v = Math.max(70, Math.hypot(ball.vx, ball.vy))
    ball.x = pipe.b.x + Math.cos(pipe.out) * (PORTAL_R + BALL_R)
    ball.y = pipe.b.y + Math.sin(pipe.out) * (PORTAL_R + BALL_R)
    ball.vx = Math.cos(pipe.out) * v
    ball.vy = Math.sin(pipe.out) * v
    out.piped = true
    break
  }
  // The rails have the last word: nothing that moves, not a blade, a bar, a door or a rover, pushes a
  // ball through one. A ball caught between them stays on its side and the thing passes over it.
  for (const wall of wallsNear(hole, ball)) {
    if (passesFlap(wall, ball.vx, ball.vy)) continue
    const p = closestOnWall(wall, ball)
    bounce(ball, p.x, p.y, wall.t + BALL_R, WALL_BOUNCE)
  }
  if (!dryAt(hole, ball, clock)) {
    out.water = true
    return out
  }
  if (hole.pits.length && inAny(hole.pits, ball) && !inAny(hole.bridges, ball)) {
    out.pit = true
    return out
  }

  // The cup pulls a slow ball the last little way, and drops it.
  const cup = cupAt(hole, clock)
  const dx = cup.x - ball.x
  const dy = cup.y - ball.y
  const d = Math.hypot(dx, dy)
  if (d < CUP_R * 1.8 && d > 1e-6) {
    const sp = Math.hypot(ball.vx, ball.vy)
    if (sp < CUP_CAPTURE_SPEED) {
      const pull = (CUP_PULL * 60 * (1 - d / (CUP_R * 1.8))) / d
      ball.vx += dx * pull * dt
      ball.vy += dy * pull * dt
    }
  }
  return out
}

function resultLabel(strokes: number, par: number) {
  if (strokes === 1) return 'Ace'
  const diff = strokes - par
  if (diff <= -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  if (diff === 2) return 'Double'
  return `+${diff}`
}

function golfPoints(strokes: number, par: number) {
  const base = Math.max(0, par + 2 - strokes) * POINTS_PER
  return base + (strokes === 1 ? ACE_BONUS : 0)
}

/** The ball is down. Points for the strokes against par, and nothing else; and a best on the hole is kept. */
function finishHole(state: GameState): GameState {
  const hole = currentHole(state)
  const points = golfPoints(state.strokes, hole.par)
  const label = resultLabel(state.strokes, hole.par)
  // A round that skipped ahead did not earn a best.
  const best = !isRunAssisted() && recordHoleBest(hole.name, state.strokes)
  const holeBests = best ? { ...state.holeBests, [hole.name]: state.strokes } : state.holeBests
  const result: HoleResult = { strokes: state.strokes, par: hole.par, points, label, best }
  if (state.strokes === 1 || state.strokes < hole.par) sfx('perfect')
  else sfx('good')
  const sub = [points > 0 ? `+${points}` : `${state.strokes} strokes`]
  if (best) sub.push(state.holeBests[hole.name] === undefined ? 'first time down' : 'new best')
  return {
    ...state,
    phase: 'sunk',
    t: 0,
    score: state.score + points,
    results: [...state.results, result],
    holeBests,
    popup: { text: label, sub: sub.join(' · '), life: 1.7 },
    flash: 0.22,
    ball: { ...state.ball, vx: 0, vy: 0 },
    air: 0,
    aiming: 'none',
    power: 0,
  }
}

/** Into the water, or off the ground: a stroke, and back to where the shot was played from. */
function penalty(state: GameState, title: string, word: string): GameState {
  sfx('hurt')
  return {
    ...state,
    phase: 'splash',
    t: 0,
    strokes: state.strokes + 1,
    ball: { x: state.strokeStart.x, y: state.strokeStart.y, vx: 0, vy: 0 },
    air: 0,
    aiming: 'none',
    power: 0,
    inSand: false,
    onPad: false,
    flash: 0.14,
    floaters: [...state.floaters, { x: state.ball.x, y: state.ball.y - 3, text: word, life: 1.0 }],
    popup: { text: title, sub: '+1 stroke · back you go', life: 1.5 },
  }
}

function readyToAim(s: GameState): GameState {
  return {
    ...s,
    phase: 'aim',
    t: 0,
    look: lookAtBall(s),
    mapSide: mapSideFor(s),
    aim: UP,
    aiming: 'none',
    chargeT: 0,
    power: 0,
    restT: 0,
    air: 0,
  }
}

export function tick(state: GameState, dt: number): GameState {
  const s: GameState = { ...state, t: state.t + dt, clock: state.clock + dt }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  if (s.popup) {
    const life = s.popup.life - dt
    s.popup = life > 0 ? { ...s.popup, life } : null
  }
  if (s.floaters.length) {
    s.floaters = s.floaters.map((f) => ({ ...f, life: f.life - dt })).filter((f) => f.life > 0)
  }
  if (s.bumperFlash.some((v) => v > 0)) {
    s.bumperFlash = s.bumperFlash.map((v) => Math.max(0, v - dt))
  }
  if (s.wallFlash.some((v) => v > 0)) {
    s.wallFlash = s.wallFlash.map((v) => Math.max(0, v - dt))
  }
  if (s.roverFlash.some((v) => v > 0)) {
    s.roverFlash = s.roverFlash.map((v) => Math.max(0, v - dt))
  }
  // The rovers keep bouncing whatever the ball is doing; while it rolls, the roll's own steps move them.
  if (s.phase !== 'roll' && s.rovers.length) s.rovers = moveRovers(s, dt)
  s.cam = moveCamera(s, dt)

  switch (s.phase) {
    case 'intro':
      if (s.t >= INTRO_TIME) return readyToAim(s)
      return s

    case 'splash':
      if (s.t >= SPLASH_TIME) return readyToAim(s)
      return s

    case 'aim': {
      // A blade or a bar sweeping through a resting ball, or a door shutting on it, nudges it along.
      const hole = currentHole(s)
      if (!hole.spinners.length && !hole.sliders.length && !hole.mills.length && !hole.gates.length) return s
      const ball = { ...s.ball }
      let moved = false
      const movers = [
        ...hole.spinners.map((sp) => spinnerWall(sp, s.clock)),
        ...hole.mills.flatMap((m) => millGates(m, s.clock)),
        ...shutGates(hole, s.clock),
      ]
      for (const w of movers) {
        const p = closestOnWall(w, ball)
        if (bounce(ball, p.x, p.y, w.t + BALL_R + 0.2, 0)) moved = true
      }
      for (const sl of hole.sliders) {
        const w = sliderWall(sl, s.clock)
        const p = closestOnWall(w, ball)
        if (bounce(ball, p.x, p.y, w.t + BALL_R + 0.2, 0)) moved = true
      }
      if (!moved) return s
      // And the rails have the last word here too.
      for (const wall of wallsNear(hole, ball)) {
        const p = closestOnWall(wall, ball)
        bounce(ball, p.x, p.y, wall.t + BALL_R, 0)
      }
      ball.vx = 0
      ball.vy = 0
      return { ...s, ball }
    }

    case 'roll': {
      const hole = currentHole(s)
      const ball = { ...s.ball }
      const flight: Flight = { air: s.air, max: s.airMax }
      const sub = dt / SUBSTEPS
      const bumperFlash = [...s.bumperFlash]
      const wallFlash = [...s.wallFlash]
      const roverFlash = [...s.roverFlash]
      let rovers = s.rovers
      let hitWall = false
      let sand = false
      let pad = false
      let slope = false
      let spin = false
      let popped = false
      let kicked = false
      let piped = false
      let struck = false
      let launched = false
      let landed = false
      for (let i = 0; i < SUBSTEPS; i++) {
        const now = s.clock + sub * i
        rovers = moveRovers({ ...s, rovers, ball }, sub)
        const out = step(ball, hole, rovers, flight, sub, now)
        for (const ri of out.rovers) {
          roverFlash[ri] = 0.4
          struck = true
        }
        for (const bi of out.bumpers) {
          bumperFlash[bi] = 0.35
          popped = true
        }
        if (out.wall) hitWall = true
        if (out.kicked) kicked = true
        if (out.piped) piped = true
        if (out.launched) launched = true
        if (out.landed) landed = true
        sand = out.sand
        pad = out.pad
        slope = out.slope
        spin = out.spin
        const carried: GameState = {
          ...s,
          ball,
          air: flight.air,
          airMax: flight.max,
          bumperFlash,
          wallFlash,
          rovers,
          roverFlash,
        }
        if (out.oob) return penalty(carried, 'Out of bounds', 'OUT')
        if (out.water) return penalty(carried, 'Splash', 'SPLASH')
        if (out.pit) return penalty(carried, 'Over the edge', 'DROP')
        if (flight.air > 0) continue
        const cup = cupAt(hole, now)
        const d = Math.hypot(cup.x - ball.x, cup.y - ball.y)
        const speed = Math.hypot(ball.vx, ball.vy)
        if (d < CUP_R * 0.75 && speed < CUP_CAPTURE_SPEED) {
          return finishHole({ ...carried, ball: { ...ball, x: cup.x, y: cup.y } })
        }
      }
      if (struck) sfx('hit', 4)
      else if (popped) sfx('hit')
      else if (launched) sfx('whoosh', 3)
      else if (kicked) sfx('pad', 3)
      else if (piped) sfx('whoosh', 5)
      else if (landed) sfx('tap', 1)
      else if (hitWall) sfx('tap', 2)
      s.ball = ball
      s.air = flight.air
      s.airMax = flight.max
      s.inSand = sand
      s.onPad = pad
      s.bumperFlash = bumperFlash
      s.wallFlash = wallFlash
      s.rovers = rovers
      s.roverFlash = roverFlash
      s.rollTime += dt
      const speed = Math.hypot(ball.vx, ball.vy)
      const still = speed < STOP_SPEED && flight.air === 0
      s.restT = still ? s.restT + dt : 0
      // At rest: still on the flat, or still for a while against whatever is pushing it, or out of time.
      if ((still && !pad && !slope) || (still && s.restT > REST_TIME && !spin) || s.rollTime > MAX_ROLL) {
        s.ball = { ...ball, vx: 0, vy: 0 }
        return readyToAim(s)
      }
      return s
    }

    case 'sunk': {
      s.drop = Math.max(0, 1 - s.t / (SUNK_TIME * 0.6))
      if (s.t < SUNK_TIME) return s
      return advance(s)
    }

    default:
      return s
  }
}

/**
 * The rovers, moved on by `dt`: straight lines at a steady speed, bouncing
 * off the edges of their pens and off anything in them — walls, bumpers,
 * and a ball that is sitting still. A rolling ball is handled in the roll.
 */
function moveRovers(s: GameState, dt: number): RoverState[] {
  const hole = currentHole(s)
  return s.rovers.map((rv, i) => {
    const spec = hole.rovers[i]!
    const b: Ball = { x: rv.x + rv.vx * dt, y: rv.y + rv.vy * dt, vx: rv.vx, vy: rv.vy }
    const pen = spec.pen
    if (b.x - spec.r < pen.x) {
      b.x = pen.x + spec.r
      b.vx = Math.abs(b.vx)
    } else if (b.x + spec.r > pen.x + pen.w) {
      b.x = pen.x + pen.w - spec.r
      b.vx = -Math.abs(b.vx)
    }
    if (b.y - spec.r < pen.y) {
      b.y = pen.y + spec.r
      b.vy = Math.abs(b.vy)
    } else if (b.y + spec.r > pen.y + pen.h) {
      b.y = pen.y + pen.h - spec.r
      b.vy = -Math.abs(b.vy)
    }
    for (const wall of spec.r <= FILE_REACH - 0.5 ? wallsNear(hole, b) : wallsOf(hole)) {
      const p = closestOnWall(wall, b)
      bounce(b, p.x, p.y, wall.t + spec.r, 1)
    }
    for (const bp of [...hole.bumpers, ...hole.rocks]) bounce(b, bp.x, bp.y, bp.r + spec.r, 1)
    if (s.phase !== 'roll' || s.air > 0) bounce(b, s.ball.x, s.ball.y, BALL_R + spec.r, 1)
    const sp = Math.hypot(b.vx, b.vy) || 1
    return { x: b.x, y: b.y, vx: (b.vx / sp) * spec.speed, vy: (b.vy / sp) * spec.speed, cool: Math.max(0, rv.cool - dt) }
  })
}

/**
 * Where the camera goes this frame. The intro flies from the cup end to the
 * tee. Aiming holds still on wherever the player is looking — the ball,
 * unless they have looked along the hole — so the view never shifts under a
 * finger that is lining up a shot. Rolling follows the ball with a little
 * lead. Everything else eases in.
 */
function moveCamera(s: GameState, dt: number): number {
  if (s.phase === 'menu' || s.phase === 'gameover') return s.cam
  const hole = currentHole(s)
  const f = fieldFrame(s.stageW, s.stageH, hole.h)
  if (s.phase === 'intro') {
    // A beat on the green, then the flight down to the tee.
    const u = Math.max(0, Math.min(1, (s.t - 0.35) / (INTRO_TIME - 0.35)))
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
    return aimCam(f, hole.tee.y) * e
  }
  let target: number
  if (s.phase === 'aim') target = Math.max(0, Math.min(f.len - f.vis, s.look))
  else target = camFor(f, s.ball.y + (s.phase === 'roll' ? s.ball.vy * 0.12 : 0))
  const k = Math.min(1, dt * CAM_EASE)
  return s.cam + (target - s.cam) * k
}

function advance(s: GameState): GameState {
  if (s.holeIndex + 1 >= COURSE.length) {
    const best = Math.max(s.best, s.score)
    return { ...s, phase: 'gameover', best, t: 0 }
  }
  return beginHole(s, s.holeIndex + 1)
}

/** Where a shot from the ball along `angle` first meets something within `maxLen`, for the aim guide. */
export function aimTrace(state: GameState, angle: number, maxLen: number): Vec {
  const hole = currentHole(state)
  const moving = [
    ...hole.spinners.map((sp) => spinnerWall(sp, state.clock)),
    ...hole.mills.flatMap((m) => millGates(m, state.clock)),
    ...shutGates(hole, state.clock),
    ...hole.sliders.map((sl) => sliderWall(sl, state.clock)),
  ]
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const stepLen = 0.6
  let x = state.ball.x
  let y = state.ball.y
  for (let len = 0; len < maxLen; len += stepLen) {
    const nx = x + dx * stepLen
    const ny = y + dy * stepLen
    for (const wall of wallsNear(hole, { x: nx, y: ny })) {
      if (passesFlap(wall, dx, dy)) continue
      const p = closestOnWall(wall, { x: nx, y: ny })
      if (Math.hypot(nx - p.x, ny - p.y) < wall.t + BALL_R) return { x, y }
    }
    for (const wall of moving) {
      const p = closestOnWall(wall, { x: nx, y: ny })
      if (Math.hypot(nx - p.x, ny - p.y) < wall.t + BALL_R) return { x, y }
    }
    for (const b of [...hole.bumpers, ...hole.rocks]) {
      if (Math.hypot(nx - b.x, ny - b.y) < b.r + BALL_R) return { x, y }
    }
    x = nx
    y = ny
  }
  return { x, y }
}

export function toSnapshot(s: GameState): Snapshot {
  const hole = currentHole(s)
  const played = s.results.reduce((sum, r) => sum + r.strokes, 0)
  const parPlayed = s.results.reduce((sum, r) => sum + r.par, 0)
  return {
    phase: s.phase,
    score: s.score,
    best: s.best,
    holeIndex: s.holeIndex,
    strokes: s.strokes,
    par: hole.par,
    toPar: played - parPlayed,
    bests: s.results.filter((r) => r.best).length,
    aiming: s.aiming,
  }
}

export { COURSE, COURSE_PAR, FIELD_W }
