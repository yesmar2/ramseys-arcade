import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'
import {
  COURSE,
  COURSE_PAR,
  FIELD_H,
  FIELD_W,
  LANE_R,
  PORTAL_R,
  SPINNER_T,
  TARGET_R,
  type Hole,
  type Rect,
  type Spinner,
  type Vec,
  type Wall,
} from './course'

/*
 * Putt: nine holes of mini golf with a pinball streak.
 *
 * Drag to aim; the guide is a short stub, so the line is yours to judge.
 * Then the swing is three taps, the way golf games have always done it:
 * one starts the gauge, one takes the power where the gauge is, and the
 * gauge comes back down for a third that has to land on the line — early
 * hooks the shot, late slices it. The ball rolls on physics: walls at any
 * angle, sand that drags, water that costs a stroke, windmills, pads that
 * push, pipes that take it somewhere else, a cup that will not always sit
 * still, and a cup that pulls a slow ball in and lets a fast one skip
 * across. The pinball is the scoring: bumpers and kickers pop the ball
 * away and pay, lanes light up and pay once a hole, drop targets pay and
 * pay big when the whole bank is down. Par or better on consecutive
 * holes builds a streak bonus. Fewer strokes still score most, and the
 * whole hole is forfeit if the ball is picked up at par plus three.
 */

export type Phase = 'menu' | 'intro' | 'aim' | 'roll' | 'splash' | 'sunk' | 'pickup' | 'gameover'
export type SwingStage = 'idle' | 'power' | 'accuracy'

export const BALL_R = 1.7
export const CUP_R = 2.7
/** Strokes allowed over par before the ball is picked up. */
export const PICKUP_OVER = 3
/** Points per stroke under par plus two: par is 200, birdie 300, bogey 100. */
export const POINTS_PER = 100
export const ACE_BONUS = 200
/** A bumper pays 50 for the first hit in a stroke, 100 for the second, and on. */
export const BUMPER_STEP = 50
export const KICKER_POINTS = 25
export const LANE_POINTS = 100
export const TARGET_POINTS = 50
/** Knocking the whole bank of targets down pays this, and they stand back up. */
export const BANK_POINTS = 300
/** Par or better on consecutive holes: the second pays 100, the third 200, up to the cap. */
export const STREAK_STEP = 100
export const STREAK_MAX = 500

/** The swing gauge runs up and back down over this many seconds. */
export const SWING_PERIOD = 1.8
/** On the way back for the accuracy tap the gauge covers its full length in half a period. */
const METER_SPEED = 2 / SWING_PERIOD
/** The gauge comes back from at least this high, so a soft shot still gives time to tap. */
const ACCURACY_START = 0.4
/** Within this of the line is a pure strike. */
export const SWEET = 0.05
/** The gauge runs this far past the line before the shot goes by itself, at full shank. */
export const SHANK_RANGE = 0.3
/** The most a shot goes off line, in radians. */
const MAX_SHANK = 0.22
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
const TOP_SPEED = 320
/** A ball slower than this within the cup drops; faster, it skips across. */
const CUP_CAPTURE_SPEED = 85
const CUP_PULL = 1.7
const INTRO_TIME = 1.0
const SPLASH_TIME = 1.0
const SUNK_TIME = 0.95
const PICKUP_TIME = 1.2
const MAX_ROLL = 12
const SUBSTEPS = 6
/** Keyboard aim turns this fast, in radians a second. */
const KEY_TURN = 1.9

export type Ball = { x: number; y: number; vx: number; vy: number }

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
  /** The shot being lined up. */
  aim: number
  /** A finger is dragging the aim. */
  aiming: boolean
  /** The swing: which tap is next, how long this stage has run, where the gauge is, the power taken. */
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
    wallFlash: first.walls.map(() => 0),
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
 * Where the field sits on the screen. The field is portrait; on a landscape
 * screen it lies on its side, tee on the left and cup on the right, so it
 * fills the screen either way. A band above carries the hole and strokes,
 * one below carries the swing gauge and the cue.
 */
export function fieldFrame(w: number, h: number) {
  const top = Math.max(40, h * 0.085)
  const bottom = Math.max(44, h * 0.09)
  const side = Math.max(8, w * 0.02)
  const availW = w - side * 2
  const availH = h - top - bottom
  const rotated = availW > availH
  const fw = rotated ? FIELD_H : FIELD_W
  const fh = rotated ? FIELD_W : FIELD_H
  const s = Math.min(availW / fw, availH / fh)
  const pw = fw * s
  const ph = fh * s
  return {
    s,
    rotated,
    x: side + (availW - pw) / 2,
    y: top + (availH - ph) / 2,
    w: pw,
    h: ph,
    top,
    bottom,
  }
}

export type Frame = ReturnType<typeof fieldFrame>

/** Field coordinates to screen. */
export function toScreen(f: Frame, p: Vec): Vec {
  if (f.rotated) return { x: f.x + (FIELD_H - p.y) * f.s, y: f.y + p.x * f.s }
  return { x: f.x + p.x * f.s, y: f.y + p.y * f.s }
}

/** A screen point to field coordinates. */
export function toField(f: Frame, sx: number, sy: number): Vec {
  if (f.rotated) return { x: (sy - f.y) / f.s, y: FIELD_H - (sx - f.x) / f.s }
  return { x: (sx - f.x) / f.s, y: (sy - f.y) / f.s }
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
    aim: angleTo(hole.tee, cupAt(hole, state.clock)),
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
    wallFlash: hole.walls.map(() => 0),
    floaters: [],
  }
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

/** Tap: start the gauge; take the power; then hit, on the line or off it. */
export function swing(state: GameState): GameState {
  if (state.phase !== 'aim') return state
  if (state.swing === 'idle') {
    sfx('tap', -2)
    return { ...state, swing: 'power', swingT: 0, meter: 0, power: 0, aiming: false }
  }
  if (state.swing === 'power') {
    sfx('tap', 0)
    const power = state.meter
    return { ...state, swing: 'accuracy', swingT: 0, power, meter: Math.max(power, ACCURACY_START) }
  }
  return strike(state)
}

/** The third tap: where the gauge is against the line decides how straight the shot goes. */
function strike(state: GameState): GameState {
  const miss = Math.max(-SHANK_RANGE, Math.min(SHANK_RANGE, state.meter))
  const pure = Math.abs(miss) <= SWEET
  // Early (the gauge still above the line) hooks left; late slices right.
  const shank = pure ? 0 : -(miss / SHANK_RANGE) * MAX_SHANK
  const text = pure ? 'PURE' : miss > 0 ? 'HOOK' : 'SLICE'
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
  sand: boolean
  pad: boolean
  water: boolean
  piped: boolean
}

/** One sub-step of rolling. Mutates the ball; returns what it touched. */
function step(ball: Ball, hole: Hole, targetsDown: boolean[], dt: number, clock: number): StepOut {
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  const sand = hole.sand.some((r) => inRect(r, ball.x, ball.y))
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
    sand,
    pad: false,
    water: false,
    piped: false,
  }

  for (const pad of hole.boosts) {
    if (!inRect(pad, ball.x, ball.y)) continue
    ball.vx += Math.cos(pad.dir) * BOOST_ACCEL * dt
    ball.vy += Math.sin(pad.dir) * BOOST_ACCEL * dt
    out.pad = true
  }
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > TOP_SPEED) {
    ball.vx *= TOP_SPEED / speed
    ball.vy *= TOP_SPEED / speed
  }

  hole.walls.forEach((wall, i) => {
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
  if (hole.water.some((r) => inRect(r, ball.x, ball.y))) {
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

function finishHole(state: GameState, pickedUp: boolean): GameState {
  const hole = currentHole(state)
  const golf = pickedUp ? 0 : golfPoints(state.strokes, hole.par)
  const pinball = pickedUp ? 0 : state.holeBonus
  const madePar = !pickedUp && state.strokes <= hole.par
  const streak = madePar ? state.streak + 1 : 0
  const streakBonus = streak >= 2 ? Math.min(STREAK_MAX, (streak - 1) * STREAK_STEP) : 0
  const points = golf + pinball + streakBonus
  const label = pickedUp ? 'Picked up' : resultLabel(state.strokes, hole.par)
  const result: HoleResult = {
    strokes: state.strokes,
    par: hole.par,
    golf,
    pinball,
    streak: streakBonus,
    points,
    label,
  }
  if (pickedUp) sfx('miss')
  else if (state.strokes === 1 || state.strokes < hole.par) sfx('perfect')
  else sfx('good')
  const parts = [`+${golf}`]
  if (pinball > 0) parts.push(`pinball +${pinball}`)
  if (streakBonus > 0) parts.push(`streak ×${streak} +${streakBonus}`)
  const sub = pickedUp ? null : parts.join(' · ')
  return {
    ...state,
    phase: pickedUp ? 'pickup' : 'sunk',
    t: 0,
    score: state.score + points,
    results: [...state.results, result],
    streak,
    popup: { text: label, sub, life: 1.7 },
    flash: pickedUp ? 0.12 : 0.22,
    ball: { ...state.ball, vx: 0, vy: 0 },
    aiming: false,
    swing: 'idle',
    power: 0,
  }
}

/** Into the water: a stroke, and back to where the shot was played from. */
function splash(state: GameState): GameState {
  const hole = currentHole(state)
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
  if (back.strokes >= hole.par + PICKUP_OVER) return finishHole(back, true)
  return {
    ...back,
    phase: 'splash',
    t: 0,
    popup: { text: 'Splash', sub: '+1 stroke · back you go', life: 1.5 },
  }
}

function readyToAim(s: GameState): GameState {
  const hole = currentHole(s)
  return {
    ...s,
    phase: 'aim',
    t: 0,
    aim: angleTo(s.ball, cupAt(hole, s.clock)),
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
        s.meter = Math.max(s.power, ACCURACY_START) - s.swingT * METER_SPEED
        // Left too long, the shot goes by itself, as far off line as it gets.
        if (s.meter <= -SHANK_RANGE) return strike({ ...s, meter: -SHANK_RANGE })
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
      const floaters = [...s.floaters]
      let sand = false
      let pad = false
      let popped = false
      let kicked = false
      let piped = false
      let dropped = false
      let banked = false
      for (let i = 0; i < SUBSTEPS; i++) {
        const now = s.clock + sub * i
        const out = step(ball, hole, targetsDown, sub, now)
        if (out.wall) hitWall = true
        if (out.piped) piped = true
        sand = out.sand
        pad = out.pad
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
          floaters,
        }
        if (out.water) return splash(carried)
        const cup = cupAt(hole, now)
        const d = Math.hypot(cup.x - ball.x, cup.y - ball.y)
        const speed = Math.hypot(ball.vx, ball.vy)
        if (d < CUP_R * 0.75 && speed < CUP_CAPTURE_SPEED) {
          return finishHole({ ...carried, ball: { ...ball, x: cup.x, y: cup.y } }, false)
        }
      }
      if (banked) sfx('perfect', 2)
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
      s.floaters = floaters
      s.rollTime += dt
      const speed = Math.hypot(ball.vx, ball.vy)
      if ((speed < STOP_SPEED && !pad) || s.rollTime > MAX_ROLL) {
        s.ball = { ...ball, vx: 0, vy: 0 }
        if (s.strokes >= hole.par + PICKUP_OVER) return finishHole(s, true)
        return readyToAim(s)
      }
      return s
    }

    case 'sunk': {
      s.drop = Math.max(0, 1 - s.t / (SUNK_TIME * 0.6))
      if (s.t < SUNK_TIME) return s
      return advance(s)
    }

    case 'pickup':
      if (s.t < PICKUP_TIME) return s
      return advance(s)

    default:
      return s
  }
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
    for (const wall of hole.walls) {
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

export { COURSE, COURSE_PAR, FIELD_H, FIELD_W }
