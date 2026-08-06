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
}

export type Floater = {
  x: number
  z: number
  y: number
  text: string
  life: number
}

export type GamePhase = 'menu' | 'playing' | 'gameover'

export type StackerSnapshot = {
  score: number
  best: number
  status: GamePhase
  perfectStreak: number
}

export type GameState = {
  phase: GamePhase
  score: number
  best: number
  perfectStreak: number
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
}

const BEST_KEY = 'stacker-best'
export const BASE_SIZE = 132
export const SLAB_H = 16
export const TRAVEL = 200
export const PERFECT_EPS = 2.8

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0
  } catch {
    return 0
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    /* ignore */
  }
}

export function hueFor(index: number): number {
  return (178 + index * 22) % 360
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
    speed: 1.35,
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
    }
    const best = Math.max(state.best, state.score)
    saveBest(best)
    return {
      ...state,
      phase: 'gameover',
      best,
      falling: [...state.falling, fall],
      shake: 1,
      flash: 0.35,
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

  const falling = [...state.falling]
  const y = state.stack.length * SLAB_H

  if (axis === 'x') {
    const cutLeft = left - (mx - mw / 2)
    const cutRight = mx + mw / 2 - right
    if (cutLeft > 0.5) {
      falling.push({
        x: mx - mw / 2 + cutLeft / 2, z: mz, w: cutLeft, d: md,
        hue: state.moving.hue, vx: -1.8 - Math.random(),
        vz: (Math.random() - 0.5) * 0.6, vy: 0.4, y, life: 1.2,
      })
    }
    if (cutRight > 0.5) {
      falling.push({
        x: mx + mw / 2 - cutRight / 2, z: mz, w: cutRight, d: md,
        hue: state.moving.hue, vx: 1.8 + Math.random(),
        vz: (Math.random() - 0.5) * 0.6, vy: 0.4, y, life: 1.2,
      })
    }
  } else {
    const cutFront = front - (mz - md / 2)
    const cutBack = mz + md / 2 - back
    if (cutFront > 0.5) {
      falling.push({
        x: mx, z: mz - md / 2 + cutFront / 2, w: mw, d: cutFront,
        hue: state.moving.hue, vx: (Math.random() - 0.5) * 0.6,
        vz: -1.8 - Math.random(), vy: 0.4, y, life: 1.2,
      })
    }
    if (cutBack > 0.5) {
      falling.push({
        x: mx, z: mz + md / 2 - cutBack / 2, w: mw, d: cutBack,
        hue: state.moving.hue, vx: (Math.random() - 0.5) * 0.6,
        vz: 1.8 + Math.random(), vy: 0.4, y, life: 1.2,
      })
    }
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

  let next: GameState = {
    ...state,
    score: state.score + 1,
    stack: [...state.stack, placed],
    falling,
    cameraY: state.cameraY + SLAB_H,
    speed: Math.min(3.2, state.speed + 0.028),
    shake: positionalPerfect ? 0.35 : 0.18,
    flash: positionalPerfect ? 0.5 : 0,
  }

  if (positionalPerfect) {
    next.perfectStreak += 1
    next.floaters = [
      ...next.floaters,
      {
        x: placed.x,
        z: placed.z,
        y: y + SLAB_H + 18,
        text: next.perfectStreak > 1 ? `PERFECT ×${next.perfectStreak}` : 'PERFECT',
        life: 1.2,
      },
    ]
  } else {
    next.perfectStreak = 0
  }

  if (next.perfectStreak > 0 && next.perfectStreak % 5 === 0) {
    next = expandPlatform(next)
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

  s.shake = Math.max(0, s.shake - dt * 2.2)
  s.flash = Math.max(0, s.flash - dt * 1.6)

  s.falling = s.falling
    .map((f) => ({
      ...f,
      x: f.x + f.vx * dt * 60,
      z: f.z + f.vz * dt * 60,
      y: f.y - f.vy * dt * 60,
      vy: f.vy + dt * 18,
      life: f.life - dt * 0.85,
    }))
    .filter((f) => f.life > 0)

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
