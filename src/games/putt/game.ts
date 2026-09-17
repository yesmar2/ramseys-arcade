import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'
import {
  COURSE,
  COURSE_PAR,
  FIELD_H,
  FIELD_W,
  LANE_R,
  type Hole,
  type Vec,
  type Wall,
} from './course'

/*
 * Putt: nine holes of mini golf with a pinball streak.
 *
 * Pull back from the ball and let go to shoot — further back, harder. The
 * ball rolls on physics: walls at any angle, sand that drags, a cup that
 * pulls a slow ball in and lets a fast one skip across. The pinball is the
 * scoring: bumpers pop the ball away and pay more for every hit in the
 * same stroke, lanes light up and pay once a hole. Fewer strokes still
 * score most, and the whole hole — bumpers, lanes and all — is forfeit if
 * the ball is picked up at par plus three.
 */

export type Phase = 'menu' | 'intro' | 'aim' | 'roll' | 'sunk' | 'pickup' | 'gameover'

export const BALL_R = 1.7
export const CUP_R = 2.7
/** Strokes allowed over par before the ball is picked up. */
export const PICKUP_OVER = 3
/** Points per stroke under par plus two: par is 200, birdie 300, bogey 100. */
export const POINTS_PER = 100
export const ACE_BONUS = 200
/** A bumper pays 50 for the first hit in a stroke, 100 for the second, and on. */
export const BUMPER_STEP = 50
export const LANE_POINTS = 100

/** Pulling back this far, in field units, is full power. */
export const MAX_DRAG = 46
const MIN_POWER = 0.08
/** Full power sends a ball this far on the green before it stops. */
const FULL_DISTANCE = 215
const FRICTION_GREEN = 1.25
const FRICTION_SAND = 5.2
const STOP_SPEED = 1.6
const WALL_BOUNCE = 0.6
/** A bumper sends the ball away at least this fast, whatever it arrived at. */
const BUMPER_POP = 105
const BUMPER_KEEP = 0.85
/** A ball slower than this within the cup drops; faster, it skips across. */
const CUP_CAPTURE_SPEED = 100
const CUP_PULL = 1.7
const INTRO_TIME = 1.0
const SUNK_TIME = 0.95
const PICKUP_TIME = 1.2
const MAX_ROLL = 10
const SUBSTEPS = 6
/** Keyboard aim turns this fast, and the held-space charge takes this long up and back. */
const KEY_TURN = 1.9
const KEY_CHARGE = 1.3

export type Ball = { x: number; y: number; vx: number; vy: number }

export type HoleResult = {
  strokes: number
  par: number
  golf: number
  pinball: number
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
  ball: Ball
  /** Seconds the current phase has run. */
  t: number
  /** The shot being lined up: direction and power, and whether a drag or the keys are setting it. */
  aim: number
  power: number
  aiming: 'none' | 'drag' | 'key'
  /** Space is held: the power is climbing and falling. */
  charging: boolean
  /** How long the ball has rolled this stroke. */
  rollTime: number
  inSand: boolean
  /** Ball scale while dropping into the cup. */
  drop: number
  /** Pinball, this hole: bumper hits in the current stroke, lit lanes, points banked so far. */
  strokeHits: number
  lanesLit: boolean[]
  holeBonus: number
  /** Flash timers per bumper, for the renderer. */
  bumperFlash: number[]
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
  aiming: GameState['aiming']
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
    power: 0,
    aiming: 'none',
    charging: false,
    rollTime: 0,
    inSand: false,
    drop: 1,
    strokeHits: 0,
    lanesLit: first.lanes.map(() => false),
    holeBonus: 0,
    bumperFlash: first.bumpers.map(() => 0),
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
 * one below carries the cue.
 */
export function fieldFrame(w: number, h: number) {
  const top = Math.max(40, h * 0.085)
  const bottom = Math.max(30, h * 0.07)
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

/** A screen-space movement to field units. */
export function toFieldDelta(f: Frame, dx: number, dy: number): Vec {
  if (f.rotated) return { x: dy / f.s, y: -dx / f.s }
  return { x: dx / f.s, y: dy / f.s }
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
    power: 0,
    aiming: 'none',
    charging: false,
    rollTime: 0,
    inSand: false,
    drop: 1,
    strokeHits: 0,
    lanesLit: hole.lanes.map(() => false),
    holeBonus: 0,
    bumperFlash: hole.bumpers.map(() => 0),
    floaters: [],
  }
}

export function startGame(prev: GameState): GameState {
  const fresh = createInitialState(prev.stageW, prev.stageH)
  return beginHole({ ...fresh, best: Math.max(prev.best, loadBest()) }, 0)
}

/** A drag in progress: the pull-back vector, in field units. */
export function setDragAim(state: GameState, pullX: number, pullY: number): GameState {
  if (state.phase !== 'aim') return state
  const len = Math.hypot(pullX, pullY)
  const power = Math.min(1, len / MAX_DRAG)
  const aim = len > 0.5 ? Math.atan2(-pullY, -pullX) : state.aim
  return { ...state, aiming: 'drag', charging: false, aim, power }
}

export function cancelAim(state: GameState): GameState {
  if (state.phase !== 'aim') return state
  return { ...state, aiming: 'none', charging: false, power: 0 }
}

/**
 * Keyboard, called every frame the keys are doing something: turn the aim by
 * `turn` (−1, 0, 1), and while space is held run the power up and back down.
 * A finger on the field takes precedence.
 */
export function keyAim(state: GameState, turn: number, charging: boolean, dt: number): GameState {
  if (state.phase !== 'aim' || state.aiming === 'drag') return state
  const aim = state.aim + turn * KEY_TURN * dt
  if (!charging) return { ...state, aim, aiming: 'key', charging: false, power: 0 }
  // The charge counts from the press, not from however long the aim sat still.
  const t = state.charging ? state.t : 0
  const cycle = (t % (KEY_CHARGE * 2)) / KEY_CHARGE
  const power = cycle <= 1 ? cycle : 2 - cycle
  return { ...state, aim, aiming: 'key', charging: true, power, t }
}

/** Let go: the shot happens with the aim and power lined up. */
export function shoot(state: GameState): GameState {
  if (state.phase !== 'aim') return state
  if (state.power < MIN_POWER) return cancelAim(state)
  const power = MIN_POWER + (1 - MIN_POWER) * state.power
  const speed = FULL_DISTANCE * FRICTION_GREEN * power
  sfx('whoosh')
  return {
    ...state,
    phase: 'roll',
    aiming: 'none',
    charging: false,
    t: 0,
    rollTime: 0,
    strokes: state.strokes + 1,
    strokeHits: 0,
    ball: {
      ...state.ball,
      vx: Math.cos(state.aim) * speed,
      vy: Math.sin(state.aim) * speed,
    },
  }
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

/** Bounce a ball off a round thing it has come within `reach` of. Returns whether it hit. */
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

/** A bumper is a bounce that adds its own kick. */
function popBumper(ball: Ball, cx: number, cy: number, reach: number): boolean {
  const before = Math.hypot(ball.vx, ball.vy)
  if (!bounce(ball, cx, cy, reach, BUMPER_KEEP)) return false
  const after = Math.hypot(ball.vx, ball.vy) || 1
  const want = Math.max(BUMPER_POP, before * BUMPER_KEEP)
  ball.vx *= want / after
  ball.vy *= want / after
  return true
}

type StepOut = { wall: boolean; bumpers: number[]; lanes: number[]; sand: boolean }

/** One sub-step of rolling. Mutates the ball; returns what it touched. */
function step(ball: Ball, hole: Hole, dt: number): StepOut {
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  const sand = inSandAt(hole, ball.x, ball.y)
  const k = sand ? FRICTION_SAND : FRICTION_GREEN
  const decay = Math.exp(-k * dt)
  ball.vx *= decay
  ball.vy *= decay

  const out: StepOut = { wall: false, bumpers: [], lanes: [], sand }
  for (const wall of hole.walls) {
    const p = closestOnWall(wall, ball)
    if (bounce(ball, p.x, p.y, wall.t + BALL_R, WALL_BOUNCE)) out.wall = true
  }
  hole.bumpers.forEach((b, i) => {
    if (popBumper(ball, b.x, b.y, b.r + BALL_R)) out.bumpers.push(i)
  })
  hole.lanes.forEach((l, i) => {
    if (Math.hypot(ball.x - l.x, ball.y - l.y) < LANE_R) out.lanes.push(i)
  })

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
  const points = golf + pinball
  const label = pickedUp ? 'Picked up' : resultLabel(state.strokes, hole.par)
  const result: HoleResult = { strokes: state.strokes, par: hole.par, golf, pinball, points, label }
  if (pickedUp) sfx('miss')
  else if (state.strokes === 1 || state.strokes < hole.par) sfx('perfect')
  else sfx('good')
  const sub = pickedUp ? null : pinball > 0 ? `+${golf} · pinball +${pinball}` : `+${golf}`
  return {
    ...state,
    phase: pickedUp ? 'pickup' : 'sunk',
    t: 0,
    score: state.score + points,
    results: [...state.results, result],
    popup: { text: label, sub, life: 1.7 },
    flash: pickedUp ? 0.12 : 0.22,
    ball: { ...state.ball, vx: 0, vy: 0 },
    aiming: 'none',
    charging: false,
    power: 0,
  }
}

export function tick(state: GameState, dt: number): GameState {
  const s: GameState = { ...state, t: state.t + dt }
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

  switch (s.phase) {
    case 'intro':
      if (s.t >= INTRO_TIME) return { ...s, phase: 'aim', t: 0 }
      return s

    case 'roll': {
      const hole = currentHole(s)
      const ball = { ...s.ball }
      const sub = dt / SUBSTEPS
      let hitWall = false
      let hits = s.strokeHits
      let bonus = s.holeBonus
      const lanesLit = [...s.lanesLit]
      const bumperFlash = [...s.bumperFlash]
      const floaters = [...s.floaters]
      let sand = false
      let popped = false
      for (let i = 0; i < SUBSTEPS; i++) {
        const out = step(ball, hole, sub)
        if (out.wall) hitWall = true
        sand = out.sand
        for (const bi of out.bumpers) {
          hits += 1
          const pts = BUMPER_STEP * hits
          bonus += pts
          bumperFlash[bi] = 0.35
          popped = true
          const b = hole.bumpers[bi]!
          floaters.push({ x: b.x, y: b.y - b.r - 2, text: `+${pts}`, life: 0.9 })
        }
        for (const li of out.lanes) {
          if (lanesLit[li]) continue
          lanesLit[li] = true
          bonus += LANE_POINTS
          const l = hole.lanes[li]!
          floaters.push({ x: l.x, y: l.y - 4, text: `+${LANE_POINTS}`, life: 0.9 })
          sfx('place')
        }
        const d = Math.hypot(hole.cup.x - ball.x, hole.cup.y - ball.y)
        const speed = Math.hypot(ball.vx, ball.vy)
        if (d < CUP_R * 0.75 && speed < CUP_CAPTURE_SPEED) {
          return finishHole(
            {
              ...s,
              ball: { ...ball, x: hole.cup.x, y: hole.cup.y },
              strokeHits: hits,
              holeBonus: bonus,
              lanesLit,
              bumperFlash,
              floaters,
            },
            false,
          )
        }
      }
      if (popped) sfx('hit')
      else if (hitWall) sfx('tap', 2)
      s.ball = ball
      s.inSand = sand
      s.strokeHits = hits
      s.holeBonus = bonus
      s.lanesLit = lanesLit
      s.bumperFlash = bumperFlash
      s.floaters = floaters
      s.rollTime += dt
      const speed = Math.hypot(ball.vx, ball.vy)
      if (speed < STOP_SPEED || s.rollTime > MAX_ROLL) {
        s.ball = { ...ball, vx: 0, vy: 0 }
        if (s.strokes >= hole.par + PICKUP_OVER) return finishHole(s, true)
        return { ...s, phase: 'aim', t: 0, aim: angleTo(s.ball, hole.cup), power: 0, aiming: 'none', charging: false }
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
export function aimTrace(state: GameState, angle: number, maxLen: number): Vec {
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
    aiming: s.aiming,
  }
}

export { COURSE, COURSE_PAR, FIELD_H, FIELD_W }
