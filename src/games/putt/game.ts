import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'
import { COURSE, COURSE_PAR, FIELD_H, FIELD_W, type Hole, type Vec, type Wall } from './course'

/*
 * Putt: nine holes, two taps a stroke.
 *
 * The aim sweeps round the ball; a tap stops it. The power bar rises and
 * falls; a tap stops that. Then the ball rolls, and physics does the rest:
 * walls at any angle, bumpers, sand, a cup that pulls a slow ball in and
 * lets a fast one skip across. Fewer strokes score more, hole by hole, and
 * a hole that gets away from you is picked up at par plus three.
 */

export type Phase =
  | 'menu'
  | 'intro' // "Hole 3 · Par 3", for a moment
  | 'aim'
  | 'power'
  | 'roll'
  | 'sunk' // the ball dropping in, before the next hole
  | 'pickup' // over the stroke cap; picked up, before the next hole
  | 'gameover'

export const BALL_R = 1.7
export const CUP_R = 2.6
/** Strokes allowed over par before the ball is picked up. */
export const PICKUP_OVER = 3
/** Points per stroke under par plus two: par is 200, birdie 300, bogey 100. */
export const POINTS_PER = 100
export const ACE_BONUS = 200

const AIM_PERIOD = 2.6
const POWER_PERIOD = 1.5
const MIN_POWER = 0.14
/** Full power sends a ball this far on the green before it stops. */
const FULL_DISTANCE = 128
const FRICTION_GREEN = 1.45
const FRICTION_SAND = 5.2
const STOP_SPEED = 1.5
const WALL_BOUNCE = 0.62
const BUMPER_BOUNCE = 0.95
/** A ball slower than this within the cup drops; faster, it skips across. */
const CUP_CAPTURE_SPEED = 95
const CUP_PULL = 1.7
const INTRO_TIME = 1.1
const SUNK_TIME = 0.95
const PICKUP_TIME = 1.2
const MAX_ROLL = 9
const SUBSTEPS = 6

export type Ball = { x: number; y: number; vx: number; vy: number }

export type HoleResult = { strokes: number; par: number; points: number; label: string }

export type Popup = { text: string; sub: string | null; life: number }

export type GameState = {
  phase: Phase
  score: number
  best: number
  holeIndex: number
  strokes: number
  results: HoleResult[]
  ball: Ball
  /** Seconds the current phase has run, for the sweeps and the timers. */
  t: number
  /** Where the aim sits, in radians, and where it started this stroke. */
  aim: number
  aimStart: number
  /** Locked when the aim is stopped, 0..1 when the power is. */
  power: number
  /** How long the ball has rolled this stroke. */
  rollTime: number
  /** Whether the ball is in sand right now, for the renderer. */
  inSand: boolean
  /** Ball scale while dropping into the cup. */
  drop: number
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
  finished: boolean
}

function loadBest() {
  return getPersonalBest('putt')
}

export function currentHole(state: GameState): Hole {
  return COURSE[Math.min(state.holeIndex, COURSE.length - 1)]!
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
    ball: { x: first.tee.x, y: first.tee.y, vx: 0, vy: 0 },
    t: 0,
    aim: 0,
    aimStart: 0,
    power: 0,
    rollTime: 0,
    inSand: false,
    drop: 1,
    popup: null,
    flash: 0,
    stageW: w,
    stageH: h,
  }
}

export function resizeState(state: GameState, w: number, h: number): GameState {
  return { ...state, stageW: w, stageH: h }
}

export function puttLayout() {
  return { aspectW: 3, aspectH: 4 }
}

/** Where the field sits on the stage: a band above for the hole, one below for the bar. */
export function fieldFrame(w: number, h: number) {
  const top = h * 0.1
  const bottom = h * 0.09
  const availH = h - top - bottom
  const s = Math.min((w * 0.94) / FIELD_W, availH / FIELD_H)
  const fw = FIELD_W * s
  const fh = FIELD_H * s
  return { s, x: (w - fw) / 2, y: top + (availH - fh) / 2, w: fw, h: fh, top, bottom }
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
    aim: angleTo(hole.tee, hole.cup),
    aimStart: angleTo(hole.tee, hole.cup),
    power: 0,
    rollTime: 0,
    inSand: false,
    drop: 1,
  }
}

export function startGame(prev: GameState): GameState {
  const fresh = createInitialState(prev.stageW, prev.stageH)
  return beginHole({ ...fresh, best: Math.max(prev.best, loadBest()) }, 0)
}

/** The aim, for a phase time t: a steady sweep starting where the last one stopped. */
function sweepAngle(start: number, t: number) {
  return start + (t / AIM_PERIOD) * Math.PI * 2
}

/** The power bar, for a phase time t: up and back down, 0..1. */
export function powerAt(t: number) {
  return (1 - Math.cos((t / POWER_PERIOD) * Math.PI * 2)) / 2
}

/** The one input: a tap. What it does depends on where the stroke is. */
export function tap(state: GameState): GameState {
  if (state.phase === 'aim') {
    sfx('tap')
    return { ...state, phase: 'power', aim: sweepAngle(state.aimStart, state.t), t: 0 }
  }
  if (state.phase === 'power') {
    const power = MIN_POWER + (1 - MIN_POWER) * powerAt(state.t)
    const speed = FULL_DISTANCE * FRICTION_GREEN * power
    sfx('whoosh')
    return {
      ...state,
      phase: 'roll',
      power,
      t: 0,
      rollTime: 0,
      strokes: state.strokes + 1,
      ball: {
        ...state.ball,
        vx: Math.cos(state.aim) * speed,
        vy: Math.sin(state.aim) * speed,
      },
    }
  }
  return state
}

function inSandAt(hole: Hole, x: number, y: number) {
  return hole.sand.some((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h)
}

/** Closest point on a wall's centre line to a point. */
function closestOnWall(wall: Wall, p: Vec): Vec {
  const abx = wall.b.x - wall.a.x
  const aby = wall.b.y - wall.a.y
  const len2 = abx * abx + aby * aby || 1
  const u = Math.max(0, Math.min(1, ((p.x - wall.a.x) * abx + (p.y - wall.a.y) * aby) / len2))
  return { x: wall.a.x + abx * u, y: wall.a.y + aby * u }
}

/** Bounce a ball off a round thing at (cx, cy) it has come within `reach` of. Returns whether it hit. */
function bounce(ball: Ball, cx: number, cy: number, reach: number, restitution: number): boolean {
  let nx = ball.x - cx
  let ny = ball.y - cy
  let d = Math.hypot(nx, ny)
  if (d >= reach) return false
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
  if (along < 0) {
    ball.vx -= (1 + restitution) * along * nx
    ball.vy -= (1 + restitution) * along * ny
  }
  return true
}

/** One sub-step of rolling. Mutates the ball; returns what happened. */
function step(ball: Ball, hole: Hole, dt: number): { hit: 'wall' | 'bumper' | null; sand: boolean } {
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  const sand = inSandAt(hole, ball.x, ball.y)
  const k = sand ? FRICTION_SAND : FRICTION_GREEN
  const decay = Math.exp(-k * dt)
  ball.vx *= decay
  ball.vy *= decay

  let hit: 'wall' | 'bumper' | null = null
  for (const wall of hole.walls) {
    const p = closestOnWall(wall, ball)
    if (bounce(ball, p.x, p.y, wall.t + BALL_R, WALL_BOUNCE)) hit = 'wall'
  }
  for (const b of hole.bumpers) {
    if (bounce(ball, b.x, b.y, b.r + BALL_R, BUMPER_BOUNCE)) hit = 'bumper'
  }

  // The cup pulls a slow ball the last little way, and drops it.
  const dx = hole.cup.x - ball.x
  const dy = hole.cup.y - ball.y
  const d = Math.hypot(dx, dy)
  if (d < CUP_R * 1.8 && d > 1e-6) {
    const speed = Math.hypot(ball.vx, ball.vy)
    if (speed < CUP_CAPTURE_SPEED) {
      const pull = (CUP_PULL * 60 * (1 - d / (CUP_R * 1.8))) / d
      ball.vx += dx * pull * dt
      ball.vy += dy * pull * dt
    }
  }
  return { hit, sand }
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

function holePoints(strokes: number, par: number) {
  const base = Math.max(0, par + 2 - strokes) * POINTS_PER
  return base + (strokes === 1 ? ACE_BONUS : 0)
}

function finishHole(state: GameState, strokes: number, pickedUp: boolean): GameState {
  const hole = currentHole(state)
  const points = pickedUp ? 0 : holePoints(strokes, hole.par)
  const label = pickedUp ? 'Picked up' : resultLabel(strokes, hole.par)
  const result: HoleResult = { strokes, par: hole.par, points, label }
  if (pickedUp) sfx('miss')
  else if (strokes === 1 || strokes < hole.par) sfx('perfect')
  else sfx('good')
  return {
    ...state,
    phase: pickedUp ? 'pickup' : 'sunk',
    t: 0,
    score: state.score + points,
    results: [...state.results, result],
    popup: { text: label, sub: points > 0 ? `+${points}` : null, life: 1.6 },
    flash: pickedUp ? 0.12 : 0.22,
    ball: { ...state.ball, vx: 0, vy: 0 },
  }
}

export function tick(state: GameState, dt: number): GameState {
  const s: GameState = { ...state, t: state.t + dt }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  if (s.popup) {
    const life = s.popup.life - dt
    s.popup = life > 0 ? { ...s.popup, life } : null
  }

  switch (s.phase) {
    case 'intro':
      if (s.t >= INTRO_TIME) return { ...s, phase: 'aim', t: 0 }
      return s

    case 'aim':
      s.aim = sweepAngle(s.aimStart, s.t)
      return s

    case 'roll': {
      const hole = currentHole(s)
      const ball = { ...s.ball }
      const sub = dt / SUBSTEPS
      let hitWall = false
      let hitBumper = false
      let sand = false
      for (let i = 0; i < SUBSTEPS; i++) {
        const out = step(ball, hole, sub)
        if (out.hit === 'wall') hitWall = true
        if (out.hit === 'bumper') hitBumper = true
        sand = out.sand
        const d = Math.hypot(hole.cup.x - ball.x, hole.cup.y - ball.y)
        const speed = Math.hypot(ball.vx, ball.vy)
        if (d < CUP_R * 0.75 && speed < CUP_CAPTURE_SPEED) {
          return finishHole({ ...s, ball: { ...ball, x: hole.cup.x, y: hole.cup.y } }, s.strokes, false)
        }
      }
      if (hitBumper) sfx('hit')
      else if (hitWall) sfx('tap', 2)
      s.ball = ball
      s.inSand = sand
      s.rollTime += dt
      const speed = Math.hypot(ball.vx, ball.vy)
      if (speed < STOP_SPEED || s.rollTime > MAX_ROLL) {
        s.ball = { ...ball, vx: 0, vy: 0 }
        if (s.strokes >= hole.par + PICKUP_OVER) return finishHole(s, s.strokes, true)
        // The next sweep starts pointing at the cup again.
        const aim = angleTo(s.ball, hole.cup)
        return { ...s, phase: 'aim', t: 0, aim, aimStart: aim }
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

/** Where a shot from the ball along `angle` first meets something, for the aim line. */
export function aimTrace(state: GameState, angle: number, maxLen = 60): Vec {
  const hole = currentHole(state)
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
    finished: s.results.length >= COURSE.length,
  }
}

export { COURSE, COURSE_PAR, FIELD_H, FIELD_W }
