import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Axis = 'x' | 'z'

export type Slab = {
  x: number
  z: number
  w: number
  d: number
  hue: number
  perfect: boolean
}

export type FallingPiece = {
  x: number
  z: number
  w: number
  d: number
  hue: number
  vx: number
  vz: number
  vy: number
  y: number
  life: number
  /** Tumble, in radians and radians a second, as it drops away. */
  angle?: number
  spin?: number
}

export type FloaterTone = 'perfect' | 'grow'

export type Floater = {
  x: number
  z: number
  y: number
  text: string
  life: number
  tone?: FloaterTone
}

/** A square ring spreading out from a slab laid dead on. */
export type Ripple = {
  x: number
  z: number
  w: number
  d: number
  y: number
  life: number
  /** Seconds before it starts, so a streak sends its rings out one after another. */
  delay: number
}

/** A puff of dust off a cut edge, in the stack's own units. */
export type Dust = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  hue: number
}

export type GamePhase = 'menu' | 'playing' | 'gameover'

export type StackerSnapshot = {
  score: number
  best: number
  status: GamePhase
  perfectStreak: number
  perfectStreakBest: number
}

export type GameState = {
  phase: GamePhase
  score: number
  best: number
  perfectStreak: number
  /** Peak perfect streak this run. */
  perfectStreakBest: number
  speed: number
  axis: Axis
  stack: Slab[]
  moving: Slab
  movingPos: number
  direction: 1 | -1
  cameraY: number
  shake: number
  falling: FallingPiece[]
  floaters: Floater[]
  flash: number
  // Presentation only: nothing below changes what happens in a run.
  ripples: Ripple[]
  dust: Dust[]
  /** 0–1 light on the slab just laid, brightest for a perfect. */
  topFlash: number
  /** 0–1 pulse as the platform grows back. */
  grow: number
  /** Seconds since the run ended, for the camera pulling back to show the tower. */
  overT: number
  /** Seconds of play, for anything that breathes. */
  time: number
}

function loadBest(): number {
  return getPersonalBest('stacker')
}

function saveBest(_score: number) {}

export const BASE_SIZE = 132
export const SLAB_H = 16
export const TRAVEL = 200
export const PERFECT_EPS = 2.8

/**
 * Each slab a few degrees round the wheel from the one below, so the tower
 * climbs through the colours as one band rather than flicking between seven:
 * a full turn is about fifty slabs.
 */
const START_HUE = 188
const HUE_STEP = 7

export function hueFor(index: number): number {
  return (START_HUE + index * HUE_STEP) % 360
}

export function createInitialState(): GameState {
  const base: Slab = {
    x: 0,
    z: 0,
    w: BASE_SIZE,
    d: BASE_SIZE,
    hue: hueFor(0),
    perfect: true,
  }

  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    perfectStreak: 0,
    perfectStreakBest: 0,
    speed: 1.58,
    axis: 'x',
    stack: [base],
    moving: {
      x: -TRAVEL,
      z: 0,
      w: BASE_SIZE,
      d: BASE_SIZE,
      hue: hueFor(1),
      perfect: false,
    },
    movingPos: -TRAVEL,
    direction: 1,
    cameraY: 0,
    shake: 0,
    falling: [],
    floaters: [],
    flash: 0,
    ripples: [],
    dust: [],
    topFlash: 0,
    grow: 0,
    overT: 0,
    time: 0,
  }
}

export function startGame(prev: GameState): GameState {
  const next = createInitialState()
  return {
    ...next,
    best: Math.max(prev.best, loadBest()),
    phase: 'playing',
  }
}

/** Admin/testing: build a stack of the given height without awarding streak bonuses. */
export function jumpToHeight(state: GameState, height: number): GameState {
  if (state.phase !== 'playing') return state
  const score = Math.max(0, Math.floor(height) || 0)
  const stack: Slab[] = []
  for (let i = 0; i <= score; i++) {
    stack.push({
      x: 0,
      z: 0,
      w: BASE_SIZE,
      d: BASE_SIZE,
      hue: hueFor(i),
      perfect: i === 0,
    })
  }
  const top = stack[stack.length - 1]!
  const axis: Axis = score % 2 === 0 ? 'x' : 'z'
  const startPos = -TRAVEL
  return {
    ...state,
    score,
    perfectStreak: 0,
    speed: Math.min(3.2, 1.58 + score * 0.028),
    axis,
    stack,
    moving: {
      x: axis === 'x' ? startPos : top.x,
      z: axis === 'z' ? startPos : top.z,
      w: top.w,
      d: top.d,
      hue: hueFor(score + 1),
      perfect: false,
    },
    movingPos: startPos,
    direction: 1,
    cameraY: score * 0.55,
    falling: [],
    floaters: [],
    flash: 0.2,
    shake: 0,
    ripples: [],
    dust: [],
  }
}

/**
 * Randomness for the look alone — dust, and how a cut piece tumbles — kept off
 * Math.random. A run replayed from a seed (the home page picks its still that
 * way) has to play out the same drop for drop, and every number the effects
 * took from the shared stream would shift every number the game takes after.
 */
let fxSeed = 0x2545f491
function fxRandom() {
  fxSeed = (fxSeed + 0x6d2b79f5) >>> 0
  let t = fxSeed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** A puff off a cut edge: a handful of dust in the slab's colour. */
function puff(dust: Dust[], x: number, y: number, z: number, hue: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = fxRandom() * Math.PI * 2
    const v = 0.6 + fxRandom() * 1.6
    const life = 0.35 + fxRandom() * 0.35
    dust.push({
      x: x + (fxRandom() - 0.5) * 6,
      y: y + fxRandom() * SLAB_H,
      z: z + (fxRandom() - 0.5) * 6,
      vx: Math.cos(a) * v,
      vy: 0.6 + fxRandom() * 1.2,
      vz: Math.sin(a) * v,
      life,
      maxLife: life,
      hue,
    })
  }
  if (dust.length > 60) dust.splice(0, dust.length - 60)
}

function expandPlatform(state: GameState): GameState {
  const top = state.stack[state.stack.length - 1]
  const grow = 10
  const max = BASE_SIZE + 24
  const nextTop: Slab = {
    ...top,
    w: Math.min(max, top.w + grow),
    d: Math.min(max, top.d + grow),
  }
  const stack = [...state.stack.slice(0, -1), nextTop]
  return {
    ...state,
    stack,
    moving: {
      ...state.moving,
      w: nextTop.w,
      d: nextTop.d,
      x: state.axis === 'x' ? state.movingPos : nextTop.x,
      z: state.axis === 'z' ? state.movingPos : nextTop.z,
    },
    shake: Math.max(state.shake, 0.55),
    flash: 0.55,
    grow: 1,
    floaters: [
      ...state.floaters,
      // Clear above the "Perfect ×5" that lands in the same moment.
      { x: nextTop.x, z: nextTop.z, y: state.stack.length * SLAB_H + 62, text: 'Wider!', life: 1.3, tone: 'grow' },
    ],
  }
}

export function placeBlock(state: GameState): GameState {
  if (state.phase !== 'playing') return state

  const top = state.stack[state.stack.length - 1]
  const axis = state.axis

  let mx = top.x
  let mz = top.z
  let mw = top.w
  let md = top.d

  if (axis === 'x') {
    mx = state.movingPos
    mz = top.z
    mw = top.w
    md = top.d
  } else {
    mz = state.movingPos
    mx = top.x
    mw = top.w
    md = top.d
  }

  const left = Math.max(mx - mw / 2, top.x - top.w / 2)
  const right = Math.min(mx + mw / 2, top.x + top.w / 2)
  const front = Math.max(mz - md / 2, top.z - top.d / 2)
  const back = Math.min(mz + md / 2, top.z + top.d / 2)

  const overlapW = right - left
  const overlapD = back - front

  if (overlapW <= 0 || overlapD <= 0) {
    const fall: FallingPiece = {
      x: mx, z: mz, w: mw, d: md,
      hue: state.moving.hue,
      vx: (Math.random() - 0.5) * 2,
      vz: (Math.random() - 0.5) * 2,
      vy: 0.6,
      y: state.stack.length * SLAB_H,
      life: 1.4,
      angle: 0,
      spin: (fxRandom() < 0.5 ? -1 : 1) * (0.25 + fxRandom() * 0.3),
    }
    const best = Math.max(state.best, state.score)
    saveBest(best)
    sfx('chop')
    return {
      ...state,
      phase: 'gameover',
      best,
      falling: [...state.falling, fall],
      shake: 1,
      flash: 0.35,
      overT: 0,
    }
  }

  const placed: Slab = {
    x: (left + right) / 2,
    z: (front + back) / 2,
    w: overlapW,
    d: overlapD,
    hue: state.moving.hue,
    perfect: false,
  }

  const posErr = axis === 'x' ? Math.abs(mx - top.x) : Math.abs(mz - top.z)
  const sizeErr = axis === 'x'
    ? Math.abs(mw - top.w) + Math.abs(overlapW - Math.min(mw, top.w))
    : Math.abs(md - top.d) + Math.abs(overlapD - Math.min(md, top.d))

  const positionalPerfect = posErr <= PERFECT_EPS && sizeErr <= PERFECT_EPS * 2
  if (positionalPerfect) {
    placed.x = top.x
    placed.z = top.z
    placed.w = top.w
    placed.d = top.d
    placed.perfect = true
  }

  const falling = [...state.falling]
  const dust = [...state.dust]
  const y = state.stack.length * SLAB_H
  const hue = state.moving.hue
  // A wobble as it drops, not a spin: a flat piece turned too far reads as a stick.
  const tumble = () => (fxRandom() < 0.5 ? -1 : 1) * (0.25 + fxRandom() * 0.35)

  if (!positionalPerfect) {
    // What hangs over the edge is cut off and tumbles away, in a puff from the cut.
    if (axis === 'x') {
      const cutLeft = left - (mx - mw / 2)
      const cutRight = mx + mw / 2 - right
      if (cutLeft > 0.5) {
        falling.push({
          x: mx - mw / 2 + cutLeft / 2, z: mz, w: cutLeft, d: md,
          hue, vx: -1.8 - Math.random(),
          vz: (Math.random() - 0.5) * 0.6, vy: 0.4, y, life: 1.2, angle: 0, spin: tumble(),
        })
        puff(dust, left, y, mz, hue, 7)
      }
      if (cutRight > 0.5) {
        falling.push({
          x: mx + mw / 2 - cutRight / 2, z: mz, w: cutRight, d: md,
          hue, vx: 1.8 + Math.random(),
          vz: (Math.random() - 0.5) * 0.6, vy: 0.4, y, life: 1.2, angle: 0, spin: tumble(),
        })
        puff(dust, right, y, mz, hue, 7)
      }
    } else {
      const cutFront = front - (mz - md / 2)
      const cutBack = mz + md / 2 - back
      if (cutFront > 0.5) {
        falling.push({
          x: mx, z: mz - md / 2 + cutFront / 2, w: mw, d: cutFront,
          hue, vx: (Math.random() - 0.5) * 0.6,
          vz: -1.8 - Math.random(), vy: 0.4, y, life: 1.2, angle: 0, spin: tumble(),
        })
        puff(dust, mx, y, front, hue, 7)
      }
      if (cutBack > 0.5) {
        falling.push({
          x: mx, z: mz + md / 2 - cutBack / 2, w: mw, d: cutBack,
          hue, vx: (Math.random() - 0.5) * 0.6,
          vz: 1.8 + Math.random(), vy: 0.4, y, life: 1.2, angle: 0, spin: tumble(),
        })
        puff(dust, mx, y, back, hue, 7)
      }
    }
  }

  let next: GameState = {
    ...state,
    score: state.score + 1,
    stack: [...state.stack, placed],
    falling,
    dust,
    cameraY: state.cameraY + SLAB_H,
    speed: Math.min(3.2, state.speed + 0.028),
    shake: positionalPerfect ? 0.35 : 0.18,
    flash: positionalPerfect ? 0.5 : 0,
    topFlash: positionalPerfect ? 1 : 0.4,
  }

  if (positionalPerfect) {
    next.perfectStreak += 1
    next.perfectStreakBest = Math.max(next.perfectStreakBest, next.perfectStreak)
    next.floaters = [
      ...next.floaters,
      {
        x: placed.x,
        z: placed.z,
        y: y + SLAB_H + 18,
        text: next.perfectStreak > 1 ? `Perfect ×${next.perfectStreak}` : 'Perfect',
        life: 1.2,
        tone: 'perfect',
      },
    ]
    // A ring off the slab for a perfect, and one more for each in the streak, up to three.
    const rings = Math.min(3, next.perfectStreak)
    next.ripples = [
      ...state.ripples,
      ...Array.from({ length: rings }, (_, i) => ({
        x: placed.x,
        z: placed.z,
        w: placed.w,
        d: placed.d,
        y: y + SLAB_H,
        life: 1,
        delay: i * 0.12,
      })),
    ].slice(-9)
    // The chime climbs the scale as the streak does.
    sfx('pad', Math.min(5, next.perfectStreak - 1))
  } else {
    next.perfectStreak = 0
    sfx('place')
  }

  if (next.perfectStreak > 0 && next.perfectStreak % 5 === 0) {
    next = expandPlatform(next)
    sfx('perfect')
  }

  const topNow = next.stack[next.stack.length - 1]
  const nextAxis: Axis = axis === 'x' ? 'z' : 'x'
  const startPos = -TRAVEL * (Math.random() > 0.5 ? 1 : -1)

  next.axis = nextAxis
  next.movingPos = startPos
  next.direction = startPos < 0 ? 1 : -1
  next.moving = {
    x: nextAxis === 'x' ? startPos : topNow.x,
    z: nextAxis === 'z' ? startPos : topNow.z,
    w: topNow.w,
    d: topNow.d,
    hue: hueFor(next.stack.length),
    perfect: false,
  }

  const best = Math.max(next.best, next.score)
  if (best !== next.best) {
    next.best = best
    saveBest(best)
  }

  return next
}

export function tick(state: GameState, dt: number): GameState {
  let s = { ...state }

  s.time = (s.time ?? 0) + dt
  s.shake = Math.max(0, s.shake - dt * 2.2)
  s.flash = Math.max(0, s.flash - dt * 1.6)
  s.topFlash = Math.max(0, (s.topFlash ?? 0) - dt * 2.4)
  s.grow = Math.max(0, (s.grow ?? 0) - dt * 1.8)
  if (s.phase === 'gameover') s.overT = (s.overT ?? 0) + dt

  s.falling = s.falling
    .map((f) => ({
      ...f,
      x: f.x + f.vx * dt * 60,
      z: f.z + f.vz * dt * 60,
      y: f.y - f.vy * dt * 60,
      vy: f.vy + dt * 18,
      life: f.life - dt * 0.85,
      angle: (f.angle ?? 0) + (f.spin ?? 0) * dt,
    }))
    .filter((f) => f.life > 0)

  s.ripples = (s.ripples ?? [])
    .map((r) => (r.delay > 0 ? { ...r, delay: r.delay - dt } : { ...r, life: r.life - dt * 1.6 }))
    .filter((r) => r.life > 0)

  s.dust = (s.dust ?? [])
    .map((d) => ({
      ...d,
      x: d.x + d.vx * dt * 60,
      y: d.y + d.vy * dt * 60,
      z: d.z + d.vz * dt * 60,
      vx: d.vx * Math.pow(0.1, dt),
      vz: d.vz * Math.pow(0.1, dt),
      vy: d.vy * Math.pow(0.1, dt) - dt * 0.4,
      life: d.life - dt,
    }))
    .filter((d) => d.life > 0)

  s.floaters = s.floaters
    .map((f) => ({
      ...f,
      y: f.y + 36 * dt,
      life: f.life - dt * 1.05,
    }))
    .filter((f) => f.life > 0)

  if (s.phase === 'playing' || s.phase === 'menu') {
    const speed = s.phase === 'menu' ? 1.1 : s.speed
    s.movingPos += s.direction * speed * dt * 60

    if (s.movingPos > TRAVEL) {
      s.movingPos = TRAVEL
      s.direction = -1
    } else if (s.movingPos < -TRAVEL) {
      s.movingPos = -TRAVEL
      s.direction = 1
    }

    const top = s.stack[s.stack.length - 1]
    if (s.axis === 'x') {
      s.moving = { ...s.moving, x: s.movingPos, z: top.z, w: top.w, d: top.d }
    } else {
      s.moving = { ...s.moving, z: s.movingPos, x: top.x, w: top.w, d: top.d }
    }
  }

  if (s.phase === 'playing') {
    const targetCam = Math.max(0, (s.stack.length - 5) * SLAB_H)
    s.cameraY += (targetCam - s.cameraY) * Math.min(1, dt * 5)
  }

  return s
}
