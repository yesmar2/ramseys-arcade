import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Phase = 'menu' | 'playing' | 'gameover'

export type TargetKind = 'normal' | 'gold'

export type Target = {
  kind: TargetKind
  hue: number
  age: number
  life: number
  rise: number
  hit: boolean
  hitAge: number
}

export type Pad = {
  id: number
  target: Target | null
}

export type Floater = {
  id: number
  x: number
  y: number
  text: string
  life: number
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  timeLeft: number
  streak: number
  hits: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  timeLeft: number
  streak: number
  hits: number
  pads: Pad[]
  spawnTimer: number
  floaters: Floater[]
  flash: number
  scale: number
}

export const DESIGN_W = 540
export const DESIGN_H = 720
export const PAD_COLS = 3
export const PAD_ROWS = 3
export const PAD_COUNT = PAD_COLS * PAD_ROWS
/** @deprecated use PAD_COUNT */
export const HOLE_COUNT = PAD_COUNT

export const PAD_INNER = 0.42

const PAD_HUES = [198, 172, 348, 272, 128, 18, 198, 172, 348]
const ROUND_SECS = 45
const SCORE_HIT = 10
const SCORE_CENTER = 30
const SCORE_GOLD = 25
const SCORE_GOLD_CENTER = 70
const STREAK_BONUS = 5
const STREAK_BONUS_CAP = 20
const HIT_RISE = 0.16

let nextId = 1
function uid() {
  return nextId++
}

function loadBest() {
  return getPersonalBest('pop')
}

function saveBest(_score: number) {}

function emptyPads(): Pad[] {
  return Array.from({ length: PAD_COUNT }, (_, id) => ({ id, target: null }))
}

export function createInitialState(): GameState {
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    timeLeft: ROUND_SECS,
    streak: 0,
    hits: 0,
    pads: emptyPads(),
    spawnTimer: 0.4,
    floaters: [],
    flash: 0,
    scale: 1,
  }
}

export function startGame(prev: GameState): GameState {
  return {
    ...createInitialState(),
    best: Math.max(prev.best, loadBest()),
    phase: 'playing',
    spawnTimer: 0.18,
  }
}

export function setScale(state: GameState, w: number, h: number): GameState {
  const scale = Math.min(w / DESIGN_W, h / DESIGN_H) || 1
  return { ...state, scale }
}

function spawnInterval(elapsed: number) {
  const t = Math.min(1, elapsed / ROUND_SECS)
  return Math.max(0.2, 0.58 - t * 0.3)
}

function targetLife(elapsed: number) {
  const t = Math.min(1, elapsed / ROUND_SECS)
  return Math.max(0.44, 0.88 - t * 0.34)
}

function maxUp(elapsed: number) {
  const t = Math.min(1, elapsed / ROUND_SECS)
  if (t > 0.65) return 4
  if (t > 0.3) return 3
  return 2
}

function pickPad(pads: Pad[]): number | null {
  const free = pads.filter((p) => !p.target).map((p) => p.id)
  if (!free.length) return null
  return free[Math.floor(Math.random() * free.length)]
}

function spawnTarget(state: GameState, elapsed: number): GameState {
  const up = state.pads.filter((p) => p.target && !p.target.hit).length
  if (up >= maxUp(elapsed)) {
    return { ...state, spawnTimer: 0.12 }
  }
  const id = pickPad(state.pads)
  if (id == null) return { ...state, spawnTimer: 0.12 }

  const gold = Math.random() < 0.12
  const pads = state.pads.map((p) =>
    p.id !== id
      ? p
      : {
          ...p,
          target: {
            kind: gold ? 'gold' : 'normal',
            hue: gold ? 38 : PAD_HUES[id],
            age: 0,
            life: targetLife(elapsed) * (gold ? 0.85 : 1),
            rise: 0,
            hit: false,
            hitAge: 0,
          },
        },
  )
  return { ...state, pads, spawnTimer: spawnInterval(elapsed) }
}

export function padLayout(
  id: number,
  w: number,
  h: number,
): { x: number; y: number; r: number } {
  const col = id % PAD_COLS
  const row = Math.floor(id / PAD_COLS)
  const padX = w * 0.1
  const padTop = h * 0.1
  const padBot = h * 0.1
  const usableW = w - padX * 2
  const usableH = h - padTop - padBot
  const cellW = usableW / PAD_COLS
  const cellH = usableH / PAD_ROWS
  const r = Math.min(cellW, cellH) * 0.36
  return {
    x: padX + cellW * (col + 0.5),
    y: padTop + cellH * (row + 0.5),
    r,
  }
}

export function holeCenter(id: number, w: number, h: number) {
  return padLayout(id, w, h)
}

function liveTarget(target: Target | null) {
  return target != null && !target.hit && target.rise >= HIT_RISE
}

export function padDisc(rise: number, r: number) {
  const live = rise > 0.04
  return r * (live ? 0.72 + rise * 0.28 : 0.78)
}

export function hitAt(state: GameState, x: number, y: number, w: number, h: number): GameState {
  if (state.phase !== 'playing') return state

  let hitId: number | null = null
  let bestDist = Infinity
  for (const pad of state.pads) {
    if (!liveTarget(pad.target)) continue
    const c = padLayout(pad.id, w, h)
    const size = padDisc(pad.target!.rise, c.r)
    const d = Math.hypot(x - c.x, y - c.y)
    if (d <= size * 1.06 && d < bestDist) {
      bestDist = d
      hitId = pad.id
    }
  }
  if (hitId == null) return state
  return hitPad(state, hitId, w, h, bestDist)
}

export function hitHole(state: GameState, holeId: number, w: number, h: number): GameState {
  return hitPad(state, holeId, w, h)
}

export function hitPad(
  state: GameState,
  padId: number,
  w: number,
  h: number,
  dist?: number,
): GameState {
  if (state.phase !== 'playing') return state
  const pad = state.pads.find((p) => p.id === padId)
  if (!liveTarget(pad?.target ?? null)) return state

  const target = pad!.target!
  const c = padLayout(padId, w, h)
  const size = padDisc(target.rise, c.r)
  const center = dist != null && dist <= size * PAD_INNER
  const base = target.kind === 'gold'
    ? center
      ? SCORE_GOLD_CENTER
      : SCORE_GOLD
    : center
      ? SCORE_CENTER
      : SCORE_HIT
  sfx(center ? 'perfect' : target.kind === 'gold' ? 'good' : 'hit')
  const streak = state.streak + 1
  const bonus = Math.min(STREAK_BONUS_CAP, Math.max(0, (streak - 1) * STREAK_BONUS))
  const points = base + bonus

  return {
    ...state,
    pads: state.pads.map((p) =>
      p.id !== padId || !p.target
        ? p
        : { ...p, target: { ...p.target, hit: true, hitAge: 0 } },
    ),
    floaters: [
      ...state.floaters,
      {
        id: uid(),
        x: c.x,
        y: c.y - c.r * 0.55,
        text: center ? `CENTER +${points}` : `+${points}`,
        life: center ? 1 : 0.85,
      },
    ],
    score: state.score + points,
    streak,
    hits: state.hits + 1,
    flash: center ? 0.28 : target.kind === 'gold' ? 0.2 : 0.12,
  }
}

export function tick(state: GameState, dt: number): GameState {
  let s = { ...state }
  s.flash = Math.max(0, s.flash - dt * 2.2)
  s.floaters = s.floaters
    .map((f) => ({
      ...f,
      y: f.y - 36 * s.scale * dt,
      life: f.life - dt * 1.2,
    }))
    .filter((f) => f.life > 0)

  if (s.phase !== 'playing') return s

  const elapsed = ROUND_SECS - s.timeLeft
  s.timeLeft = Math.max(0, s.timeLeft - dt)

  const pads: Pad[] = []
  for (const pad of s.pads) {
    if (!pad.target) {
      pads.push(pad)
      continue
    }
    let target = { ...pad.target }
    if (target.hit) {
      target.hitAge += dt
      target.rise = Math.max(0, target.rise - dt * 5)
      if (target.hitAge > 0.22) {
        pads.push({ ...pad, target: null })
        continue
      }
      pads.push({ ...pad, target })
      continue
    }

    target.age += dt
    if (target.age < target.life * 0.6) {
      target.rise = Math.min(1, target.rise + dt * 9)
    } else {
      target.rise = Math.max(0, target.rise - dt * 4.2)
      if (target.rise <= 0.08) {
        pads.push({ ...pad, target: null })
        s.streak = 0
        continue
      }
    }
    pads.push({ ...pad, target })
  }
  s.pads = pads

  s.spawnTimer -= dt
  if (s.spawnTimer <= 0) {
    s = spawnTarget(s, elapsed)
  }

  if (s.timeLeft <= 0) {
    const best = Math.max(s.best, s.score)
    if (best !== s.best) saveBest(best)
    sfx('die')
    return {
      ...s,
      phase: 'gameover',
      best,
      pads: emptyPads(),
      spawnTimer: 1,
    }
  }

  return s
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    timeLeft: Math.ceil(s.timeLeft),
    streak: s.streak,
    hits: s.hits,
  }
}
