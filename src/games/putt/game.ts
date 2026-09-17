import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'
import {
  COURSE,
  COURSE_PAR,
  EDGE_T,
  FIELD_W,
  LANE_R,
  PORTAL_R,
  SPINNER_T,
  TARGET_R,
  UP,
  type Hole,
  type Rect,
  type Spinner,
  type Vec,
  type Wall,
} from './course'
import { centreOf, contours, inAny, inside } from './terrain'

/*
 * Putt: nine holes of mini golf with a pinball streak.
 *
 * Drag to aim; the guide is a short stub, so the line is yours to judge.
 * Then the swing is three taps, the way golf games have always done it:
 * one starts the gauge, one takes the power where the gauge is, and then
 * the arrow wobbles either side of the line until a third tap strikes —
 * on the line is pure, off it hooks or slices. The ball rolls on physics: walls at any
 * angle, sand that drags, water that costs a stroke, windmills, pads that
 * push, pipes that take it somewhere else, a cup that will not always sit
 * still, and a cup that pulls a slow ball in and lets a fast one skip
 * across. The pinball is the scoring: bumpers and kickers pop the ball
 * away and pay, lanes light up and pay once a hole, drop targets pay and
 * pay big when the whole bank is down, and rovers roam their pens and pay
 * for a strike. Par or better on consecutive holes builds a streak bonus.
 * Fewer strokes still score most; a hole is played until the ball drops,
 * however long that takes.
 */

export type Phase = 'menu' | 'intro' | 'aim' | 'roll' | 'splash' | 'sunk' | 'gameover'
export type SwingStage = 'idle' | 'power' | 'accuracy'

export const BALL_R = 1.7
export const CUP_R = 2.7
/** Points per stroke under par plus two: par is 200, birdie 300, bogey 100, and never below 0. */
export const POINTS_PER = 100
export const ACE_BONUS = 200
/** A bumper pays 50 for the first hit in a stroke, 100 for the second, and on. */
export const BUMPER_STEP = 50
export const KICKER_POINTS = 25
export const LANE_POINTS = 100
export const TARGET_POINTS = 50
/** Knocking the whole bank of targets down pays this, and they stand back up. */
export const BANK_POINTS = 300
/** Striking a rover pays this. */
export const ROVER_POINTS = 150
/** Par or better on consecutive holes: the second pays 100, the third 200, up to the cap. */
export const STREAK_STEP = 100
export const STREAK_MAX = 500

/** The swing gauge runs up and back down over this many seconds. */
export const SWING_PERIOD = 1.8
/**
 * After the power is taken the arrow wobbles left and right of the line, one
 * full swing every this many seconds, until the strike. It never stops, so a
 * shot can wait for a windmill, and the window is the same at any power.
 */
export const WOBBLE_PERIOD = 1.6
/** The wobble runs from -1 to 1; within this of the line is a pure strike: about 65 ms either side. */
export const SWEET = 0.26
/** The most a shot goes off line, in radians, at the ends of the wobble. */
export const MAX_SHANK = 0.16
/** How far the aim guide reaches, in field units. */
export const AIM_STUB = 14
/** A swing at the bottom of the gauge still hits this hard. */
const MIN_POWER = 0.08
/** Full power sends a ball this far on the green before it stops. */
const FULL_DISTANCE = 235
const FRICTION_GREEN = 1.25
const FRICTION_SAND = 5.2
const STOP_SPEED = 1.6
const WALL_BOUNCE = 0.6
const TARGET_BOUNCE = 0.5
/** A bumper sends the ball away at least this fast, whatever it arrived at. */
const BUMPER_POP = 110
const BUMPER_KEEP = 0.85
/** A kicker adds this much speed straight off its face. */
const KICK_SPEED = 55
/** A pad pushes the ball along its arrow this hard. */
const BOOST_ACCEL = 240
/** Extra drag in a bowl, per second, so the ball settles instead of circling. */
const BOWL_DRAG = 2.5
const TOP_SPEED = 320
/** A ball slower than this within the cup drops; faster, it skips across. */
const CUP_CAPTURE_SPEED = 85
const CUP_PULL = 1.7
/** The intro flies the length of the hole, cup to tee, in this long. */
const INTRO_TIME = 2.2
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

/** A rover on the move, and how long until it can pay again. */
export type RoverState = { x: number; y: number; vx: number; vy: number; cool: number }

export type HoleResult = {
  strokes: number
  par: number
  golf: number
  pinball: number
  streak: number
  points: number
  label: string
}

export type Popup = { text: string; sub: string | null; life: number }

/** A little "+50" rising from where it happened, in field coordinates. */
export type Floater = { x: number; y: number; text: string; life: number }

export type GameState = {
  phase: Phase
  score: number
  best: number
  holeIndex: number
  strokes: number
  results: HoleResult[]
  /** Holes in a row at par or better, so far. */
  streak: number
  ball: Ball
  /** Seconds the current phase has run. */
  t: number
  /** Runs the whole round; the windmills turn and the cups slide on it. */
  clock: number
  /** The camera: the field y at the cup end of the window on screen. */
  cam: number
  /** Where the camera is headed while aiming: the ball, until the player looks along the hole. */
  look: number
  /** The shot being lined up. */
  aim: number
  /** A finger is dragging the aim. */
  aiming: boolean
  /**
   * The swing: which tap is next, how long this stage has run, the power
   * taken, and the meter: the gauge while taking power, the wobble (-1 to 1)
   * while lining up the strike.
   */
  swing: SwingStage
  swingT: number
  meter: number
  power: number
  /** Where this stroke started, for a splash to send the ball back to. */
  strokeStart: Vec
  /** How long the ball has rolled this stroke. */
  rollTime: number
  inSand: boolean
  onPad: boolean
  /** Ball scale while dropping into the cup. */
  drop: number
  /** Pinball, this hole: bumper hits in the current stroke, lit lanes, targets down, points banked so far. */
  strokeHits: number
  lanesLit: boolean[]
  targetsDown: boolean[]
  holeBonus: number
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
  swing: SwingStage
}

function loadBest() {
  return getPersonalBest('putt')
}

export function currentHole(state: GameState): Hole {
  return COURSE[Math.min(state.holeIndex, COURSE.length - 1)]!
}

/*
 * The walls of a hole are the traced edge of its ground plus whatever was
 * placed by hand. Tracing costs a few milliseconds, so it is done once per
 * hole and kept.
 */
const traced = new WeakMap<Hole, { edges: Vec[][]; walls: Wall[] }>()

function trace(hole: Hole) {
  let t = traced.get(hole)
  if (t) return t
  const edges = contours(hole.green, FIELD_W, hole.h)
  const walls: Wall[] = []
  for (const line of edges) {
    for (let i = 1; i < line.length; i++) {
      walls.push({ a: line[i - 1]!, b: line[i]!, t: EDGE_T, edge: true })
    }
  }
  t = { edges, walls: [...walls, ...hole.walls] }
  traced.set(hole, t)
  return t
}

/** Every wall on a hole: the traced edge first, then the placed ones. */
export function wallsOf(hole: Hole): Wall[] {
  return trace(hole).walls
}

/** The traced edge of a hole's ground, as polylines, for drawing. */
export function edgesOf(hole: Hole): Vec[][] {
  return trace(hole).edges
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

export function createInitialState(w = 540, h = 720): GameState {
  const first = COURSE[0]!
  const startCam = camFor(fieldFrame(w, h, first.h), first.tee.y)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    holeIndex: 0,
    strokes: 0,
    results: [],
    streak: 0,
    ball: { x: first.tee.x, y: first.tee.y, vx: 0, vy: 0 },
    t: 0,
    clock: 0,
    cam: startCam,
    look: startCam,
    aim: 0,
    aiming: false,
    swing: 'idle',
    swingT: 0,
    meter: 0,
    power: 0,
    strokeStart: { x: first.tee.x, y: first.tee.y },
    rollTime: 0,
    inSand: false,
    onPad: false,
    drop: 1,
    strokeHits: 0,
    lanesLit: first.lanes.map(() => false),
    targetsDown: first.targets.map(() => false),
    holeBonus: 0,
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
 * above carries the hole and strokes, one below the swing gauge and cue.
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

function angleTo(from: Vec, to: Vec) {
  return Math.atan2(to.y - from.y, to.x - from.x)
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
    aiming: false,
    swing: 'idle',
    swingT: 0,
    meter: 0,
    power: 0,
    strokeStart: { x: hole.tee.x, y: hole.tee.y },
    rollTime: 0,
    inSand: false,
    onPad: false,
    drop: 1,
    strokeHits: 0,
    lanesLit: hole.lanes.map(() => false),
    targetsDown: hole.targets.map(() => false),
    holeBonus: 0,
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

/** Dev only: skip to a hole. */
export function jumpToHole(state: GameState, index: number): GameState {
  return beginHole(state, Math.max(0, Math.min(COURSE.length - 1, index)))
}

/** The gauge: up over half the period, back down over the other half. */
export function powerAt(swingT: number) {
  const cycle = (swingT % SWING_PERIOD) / (SWING_PERIOD / 2)
  return cycle <= 1 ? cycle : 2 - cycle
}

/** The wobble at a moment: starts at the far end and swings through the line. */
export function wobbleAt(swingT: number) {
  return Math.cos((Math.PI * 2 * swingT) / WOBBLE_PERIOD)
}

/**
 * The meter as of a moment between frames. A tap lands between two frames;
 * this moves the gauge or the wobble on by that much first, so the strike
 * is taken where the player saw it, not where the last frame left it.
 */
export function catchUp(state: GameState, dt: number): GameState {
  if (state.phase !== 'aim' || dt <= 0) return state
  const swingT = state.swingT + dt
  if (state.swing === 'power') return { ...state, swingT, meter: powerAt(swingT) }
  if (state.swing === 'accuracy') return { ...state, swingT, meter: wobbleAt(swingT) }
  return state
}

/** A finger on the field: the aim points from the ball to it. Not once the swing has started. */
export function aimAt(state: GameState, p: Vec): GameState {
  if (state.phase !== 'aim' || state.swing !== 'idle') return state
  const d = Math.hypot(p.x - state.ball.x, p.y - state.ball.y)
  if (d < 3) return { ...state, aiming: true }
  return { ...state, aiming: true, aim: angleTo(state.ball, p) }
}

export function endAim(state: GameState): GameState {
  return state.aiming ? { ...state, aiming: false } : state
}

/** Keyboard: turn the aim, not once the swing has started. */
export function turnAim(state: GameState, turn: number, dt: number): GameState {
  if (state.phase !== 'aim' || state.swing !== 'idle' || turn === 0) return state
  return { ...state, aim: state.aim + turn * KEY_TURN * dt }
}

/** The window start that puts the ball in the middle of the view. */
function lookAtBall(state: GameState) {
  const f = fieldFrame(state.stageW, state.stageH, currentHole(state).h)
  return camFor(f, state.ball.y)
}

/** Looking along the hole before the swing: move the view by `dy` field units. */
export function panLook(state: GameState, dy: number): GameState {
  if (state.phase !== 'aim' || state.swing !== 'idle' || dy === 0) return state
  const f = fieldFrame(state.stageW, state.stageH, currentHole(state).h)
  return { ...state, look: Math.max(0, Math.min(f.len - f.vis, state.look + dy)) }
}

/** Looking along the hole before the swing: centre the view on field `y`. */
export function lookAt(state: GameState, y: number): GameState {
  if (state.phase !== 'aim' || state.swing !== 'idle') return state
  const f = fieldFrame(state.stageW, state.stageH, currentHole(state).h)
  return { ...state, look: camFor(f, y) }
}

/**
 * Where the map sits on screen: the corner of the window nearest the cup,
 * a fifth of the window's short side wide, as long as the hole is.
 */
export function mapLayout(f: Frame, len: number) {
  const short = Math.max(44, Math.min(72, (f.rotated ? f.h : f.w) * 0.2))
  const k = short / FIELD_W
  const long = len * k
  const w = f.rotated ? long : short
  const h = f.rotated ? short : long
  const inset = 8
  return { x: f.x + f.w - w - inset, y: f.y + inset, w, h, k, len }
}

export type MapLayout = ReturnType<typeof mapLayout>

/** Whether a screen point is on the map, with a little grace around it. */
export function onMap(m: MapLayout, sx: number, sy: number) {
  const grace = 8
  return sx >= m.x - grace && sx <= m.x + m.w + grace && sy >= m.y - grace && sy <= m.y + m.h + grace
}

/** The field y a screen point on the map stands for. */
export function mapFieldY(m: MapLayout, f: Frame, sx: number, sy: number) {
  return f.rotated ? m.len - (sx - m.x) / m.k : (sy - m.y) / m.k
}

/** Tap: start the gauge; take the power; then hit, on the line or off it. */
export function swing(state: GameState): GameState {
  if (state.phase !== 'aim') return state
  if (state.swing === 'idle') {
    sfx('tap', -2)
    // The swing brings the view back to the ball, wherever the player was looking.
    return { ...state, swing: 'power', swingT: 0, meter: 0, power: 0, aiming: false, look: lookAtBall(state) }
  }
  if (state.swing === 'power') {
    sfx('tap', 0)
    // The wobble starts at the far end, so a quick double tap is no free pure strike.
    return { ...state, swing: 'accuracy', swingT: 0, power: state.meter, meter: 1 }
  }
  return strike(state)
}

/** Changed your mind mid-swing: back to aiming, nothing spent. */
export function cancelSwing(state: GameState): GameState {
  if (state.phase !== 'aim' || state.swing === 'idle') return state
  sfx('tap', -5)
  return { ...state, swing: 'idle', swingT: 0, meter: 0, power: 0 }
}

/** The wobble, as an angle off the line, for the arrow and the strike. */
export function wobbleOf(state: GameState) {
  return state.swing === 'accuracy' ? state.meter * MAX_SHANK : 0
}

/** The third tap: where the arrow is against the line decides how straight the shot goes. */
function strike(state: GameState): GameState {
  const pure = Math.abs(state.meter) <= SWEET
  const shank = pure ? 0 : wobbleOf(state)
  const text = pure ? 'PURE' : shank < 0 ? 'HOOK' : 'SLICE'
  if (pure) sfx('good', 4)
  const floaters = [...state.floaters, { x: state.ball.x, y: state.ball.y - 4, text, life: 0.9 }]
  return shoot({ ...state, floaters }, shank)
}

/** The shot happens with the aim and power lined up, plus whatever the strike put on it. */
export function shoot(state: GameState, shank = 0): GameState {
  if (state.phase !== 'aim') return state
  const power = MIN_POWER + (1 - MIN_POWER) * Math.max(0, Math.min(1, state.power))
  const speed = FULL_DISTANCE * FRICTION_GREEN * power
  const angle = state.aim + shank
  sfx('whoosh')
  return {
    ...state,
    phase: 'roll',
    aiming: false,
    swing: 'idle',
    t: 0,
    rollTime: 0,
    strokes: state.strokes + 1,
    strokeHits: 0,
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

/** A blade is a wall that moves: the ball bounces relative to the blade's own speed at the contact. */
function bounceSpinner(ball: Ball, sp: Spinner, clock: number, restitution: number): boolean {
  const w = spinnerWall(sp, clock)
  const p = closestOnWall(w, ball)
  const svx = -sp.speed * (p.y - sp.y)
  const svy = sp.speed * (p.x - sp.x)
  ball.vx -= svx
  ball.vy -= svy
  const c = bounce(ball, p.x, p.y, w.t + BALL_R, restitution)
  ball.vx += svx
  ball.vy += svy
  return !!c
}

type StepOut = {
  wall: boolean
  kickers: number[]
  bumpers: number[]
  lanes: number[]
  targets: number[]
  rovers: number[]
  sand: boolean
  pad: boolean
  slope: boolean
  water: boolean
  piped: boolean
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

/** One sub-step of rolling. Mutates the ball and the rovers; returns what it touched. */
function step(
  ball: Ball,
  hole: Hole,
  targetsDown: boolean[],
  rovers: RoverState[],
  dt: number,
  clock: number,
): StepOut {
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  const sand = inAny(hole.sand, ball)
  const k = sand ? FRICTION_SAND : FRICTION_GREEN
  const decay = Math.exp(-k * dt)
  ball.vx *= decay
  ball.vy *= decay

  const out: StepOut = {
    wall: false,
    kickers: [],
    bumpers: [],
    lanes: [],
    targets: [],
    rovers: [],
    sand,
    pad: false,
    slope: false,
    water: false,
    piped: false,
  }

  for (const pad of hole.boosts) {
    if (!inRect(pad, ball.x, ball.y)) continue
    ball.vx += Math.cos(pad.dir) * BOOST_ACCEL * dt
    ball.vy += Math.sin(pad.dir) * BOOST_ACCEL * dt
    out.pad = true
  }
  // Hills push downhill; bowls pull to the middle. A ball on either never quite comes to rest.
  for (const sl of hole.slopes) {
    if (!inside(sl.shape, ball)) continue
    if (sl.pull) {
      ball.vx += sl.pull.x * dt
      ball.vy += sl.pull.y * dt
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
    out.slope = true
  }
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > TOP_SPEED) {
    ball.vx *= TOP_SPEED / speed
    ball.vy *= TOP_SPEED / speed
  }

  wallsOf(hole).forEach((wall, i) => {
    const p = closestOnWall(wall, ball)
    const c = bounce(ball, p.x, p.y, wall.t + BALL_R, wall.kick ? 1 : WALL_BOUNCE)
    if (!c || !c.reflected) return
    if (wall.kick) {
      ball.vx += c.nx * KICK_SPEED
      ball.vy += c.ny * KICK_SPEED
      out.kickers.push(i)
    } else {
      out.wall = true
    }
  })
  for (const sp of hole.spinners) {
    if (bounceSpinner(ball, sp, clock, WALL_BOUNCE)) out.wall = true
  }
  hole.bumpers.forEach((b, i) => {
    if (popBumper(ball, b.x, b.y, b.r + BALL_R)) out.bumpers.push(i)
  })
  hole.targets.forEach((tg, i) => {
    if (targetsDown[i]) return
    const c = bounce(ball, tg.x, tg.y, TARGET_R + BALL_R, TARGET_BOUNCE)
    if (c && c.reflected) out.targets.push(i)
  })
  hole.rovers.forEach((spec, i) => {
    const rv = rovers[i]!
    if (!strikeRover(ball, rv, spec.r, spec.speed)) return
    if (rv.cool > 0) return
    rv.cool = 0.35
    out.rovers.push(i)
  })
  hole.lanes.forEach((l, i) => {
    if (Math.hypot(ball.x - l.x, ball.y - l.y) < LANE_R) out.lanes.push(i)
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
  if (!inAny(hole.bridges, ball) && inAny(hole.water, ball)) {
    out.water = true
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

/** The ball is down. Golf points for the strokes, the pinball banked on the hole, and any streak. */
function finishHole(state: GameState): GameState {
  const hole = currentHole(state)
  const golf = golfPoints(state.strokes, hole.par)
  const pinball = state.holeBonus
  const madePar = state.strokes <= hole.par
  const streak = madePar ? state.streak + 1 : 0
  const streakBonus = streak >= 2 ? Math.min(STREAK_MAX, (streak - 1) * STREAK_STEP) : 0
  const points = golf + pinball + streakBonus
  const label = resultLabel(state.strokes, hole.par)
  const result: HoleResult = {
    strokes: state.strokes,
    par: hole.par,
    golf,
    pinball,
    streak: streakBonus,
    points,
    label,
  }
  if (state.strokes === 1 || state.strokes < hole.par) sfx('perfect')
  else sfx('good')
  const parts = [`+${golf}`]
  if (pinball > 0) parts.push(`pinball +${pinball}`)
  if (streakBonus > 0) parts.push(`streak ×${streak} +${streakBonus}`)
  return {
    ...state,
    phase: 'sunk',
    t: 0,
    score: state.score + points,
    results: [...state.results, result],
    streak,
    popup: { text: label, sub: parts.join(' · '), life: 1.7 },
    flash: 0.22,
    ball: { ...state.ball, vx: 0, vy: 0 },
    aiming: false,
    swing: 'idle',
    power: 0,
  }
}

/** Into the water: a stroke, and back to where the shot was played from. */
function splash(state: GameState): GameState {
  sfx('hurt')
  const back: GameState = {
    ...state,
    strokes: state.strokes + 1,
    ball: { x: state.strokeStart.x, y: state.strokeStart.y, vx: 0, vy: 0 },
    aiming: false,
    swing: 'idle',
    power: 0,
    inSand: false,
    onPad: false,
    flash: 0.14,
    floaters: [...state.floaters, { x: state.ball.x, y: state.ball.y - 3, text: 'SPLASH', life: 1.0 }],
  }
  return {
    ...back,
    phase: 'splash',
    t: 0,
    popup: { text: 'Splash', sub: '+1 stroke · back you go', life: 1.5 },
  }
}

function readyToAim(s: GameState): GameState {
  return {
    ...s,
    phase: 'aim',
    t: 0,
    look: lookAtBall(s),
    aim: UP,
    aiming: false,
    swing: 'idle',
    swingT: 0,
    meter: 0,
    power: 0,
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
      if (s.swing === 'power') {
        s.swingT += dt
        s.meter = powerAt(s.swingT)
      } else if (s.swing === 'accuracy') {
        s.swingT += dt
        s.meter = wobbleAt(s.swingT)
      }
      // A windmill blade sweeping through a resting ball nudges it along.
      const hole = currentHole(s)
      if (!hole.spinners.length) return s
      const ball = { ...s.ball }
      let moved = false
      for (const sp of hole.spinners) {
        const w = spinnerWall(sp, s.clock)
        const p = closestOnWall(w, ball)
        if (bounce(ball, p.x, p.y, w.t + BALL_R + 0.2, 0)) moved = true
      }
      if (!moved) return s
      ball.vx = 0
      ball.vy = 0
      return { ...s, ball }
    }

    case 'roll': {
      const hole = currentHole(s)
      const ball = { ...s.ball }
      const sub = dt / SUBSTEPS
      let hitWall = false
      let hits = s.strokeHits
      let bonus = s.holeBonus
      const lanesLit = [...s.lanesLit]
      const targetsDown = [...s.targetsDown]
      const bumperFlash = [...s.bumperFlash]
      const wallFlash = [...s.wallFlash]
      const roverFlash = [...s.roverFlash]
      const floaters = [...s.floaters]
      let rovers = s.rovers
      let sand = false
      let pad = false
      let slope = false
      let popped = false
      let kicked = false
      let piped = false
      let dropped = false
      let banked = false
      let struck = false
      for (let i = 0; i < SUBSTEPS; i++) {
        const now = s.clock + sub * i
        rovers = moveRovers({ ...s, rovers, ball }, sub)
        const out = step(ball, hole, targetsDown, rovers, sub, now)
        for (const ri of out.rovers) {
          bonus += ROVER_POINTS
          roverFlash[ri] = 0.4
          struck = true
          const rv = rovers[ri]!
          floaters.push({ x: rv.x, y: rv.y - 6, text: `STRIKE +${ROVER_POINTS}`, life: 1.1 })
        }
        if (out.wall) hitWall = true
        if (out.piped) piped = true
        sand = out.sand
        pad = out.pad
        slope = out.slope
        for (const bi of out.bumpers) {
          hits += 1
          const pts = BUMPER_STEP * hits
          bonus += pts
          bumperFlash[bi] = 0.35
          popped = true
          const b = hole.bumpers[bi]!
          floaters.push({ x: b.x, y: b.y - b.r - 2, text: `+${pts}`, life: 0.9 })
        }
        for (const wi of out.kickers) {
          bonus += KICKER_POINTS
          wallFlash[wi] = 0.3
          kicked = true
          floaters.push({ x: ball.x, y: ball.y - 4, text: `+${KICKER_POINTS}`, life: 0.8 })
        }
        for (const ti of out.targets) {
          if (targetsDown[ti]) continue
          targetsDown[ti] = true
          bonus += TARGET_POINTS
          dropped = true
          const tg = hole.targets[ti]!
          floaters.push({ x: tg.x, y: tg.y - 4, text: `+${TARGET_POINTS}`, life: 0.9 })
          if (targetsDown.every(Boolean)) {
            bonus += BANK_POINTS
            banked = true
            const cx = hole.targets.reduce((sum, t) => sum + t.x, 0) / hole.targets.length
            const cy = hole.targets.reduce((sum, t) => sum + t.y, 0) / hole.targets.length
            floaters.push({ x: cx, y: cy - 9, text: `BANK +${BANK_POINTS}`, life: 1.4 })
            targetsDown.fill(false)
          }
        }
        for (const li of out.lanes) {
          if (lanesLit[li]) continue
          lanesLit[li] = true
          bonus += LANE_POINTS
          const l = hole.lanes[li]!
          floaters.push({ x: l.x, y: l.y - 4, text: `+${LANE_POINTS}`, life: 0.9 })
          sfx('place')
        }
        const carried: GameState = {
          ...s,
          ball,
          strokeHits: hits,
          holeBonus: bonus,
          lanesLit,
          targetsDown,
          bumperFlash,
          wallFlash,
          rovers,
          roverFlash,
          floaters,
        }
        if (out.water) return splash(carried)
        const cup = cupAt(hole, now)
        const d = Math.hypot(cup.x - ball.x, cup.y - ball.y)
        const speed = Math.hypot(ball.vx, ball.vy)
        if (d < CUP_R * 0.75 && speed < CUP_CAPTURE_SPEED) {
          return finishHole({ ...carried, ball: { ...ball, x: cup.x, y: cup.y } })
        }
      }
      if (struck) sfx('hit', 4)
      else if (banked) sfx('perfect', 2)
      else if (popped) sfx('hit')
      else if (dropped) sfx('pad', 6)
      else if (kicked) sfx('pad', 3)
      else if (piped) sfx('whoosh', 5)
      else if (hitWall) sfx('tap', 2)
      s.ball = ball
      s.inSand = sand
      s.onPad = pad
      s.strokeHits = hits
      s.holeBonus = bonus
      s.lanesLit = lanesLit
      s.targetsDown = targetsDown
      s.bumperFlash = bumperFlash
      s.wallFlash = wallFlash
      s.rovers = rovers
      s.roverFlash = roverFlash
      s.floaters = floaters
      s.rollTime += dt
      const speed = Math.hypot(ball.vx, ball.vy)
      if ((speed < STOP_SPEED && !pad && !slope) || s.rollTime > MAX_ROLL) {
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
    for (const wall of wallsOf(hole)) {
      const p = closestOnWall(wall, b)
      bounce(b, p.x, p.y, wall.t + spec.r, 1)
    }
    for (const bp of hole.bumpers) bounce(b, bp.x, bp.y, bp.r + spec.r, 1)
    if (s.phase !== 'roll') bounce(b, s.ball.x, s.ball.y, BALL_R + spec.r, 1)
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
    const u = Math.min(1, s.t / INTRO_TIME)
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
    return camFor(f, hole.tee.y) * e
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
  const blades = hole.spinners.map((sp) => spinnerWall(sp, state.clock))
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const stepLen = 0.6
  let x = state.ball.x
  let y = state.ball.y
  for (let len = 0; len < maxLen; len += stepLen) {
    const nx = x + dx * stepLen
    const ny = y + dy * stepLen
    for (const wall of wallsOf(hole)) {
      const p = closestOnWall(wall, { x: nx, y: ny })
      if (Math.hypot(nx - p.x, ny - p.y) < wall.t + BALL_R) return { x, y }
    }
    for (const wall of blades) {
      const p = closestOnWall(wall, { x: nx, y: ny })
      if (Math.hypot(nx - p.x, ny - p.y) < wall.t + BALL_R) return { x, y }
    }
    for (const b of hole.bumpers) {
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
    swing: s.swing,
  }
}

export { COURSE, COURSE_PAR, FIELD_W }
