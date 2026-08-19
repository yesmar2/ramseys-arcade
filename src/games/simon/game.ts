import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Phase = 'menu' | 'watch' | 'input' | 'gameover'

export const PAD_COUNT = 4
export const PAD_HUES = [198, 172, 38, 348] as const

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  round: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  sequence: number[]
  inputIndex: number
  watchIndex: number
  watchTimer: number
  lit: number | null
  pressId: number | null
  pressLife: number
  flash: number
  scale: number
  stageW: number
  stageH: number
}

const NOTE_GAP = 0.16
const PRESS_LIFE = 0.34

function loadBest() {
  return getPersonalBest('simon')
}

function saveBest(_score: number) {}

function noteLen(round: number) {
  return Math.max(0.28, 0.52 - round * 0.018)
}

function introGap(round: number) {
  return round <= 1 ? 0.55 : 0.72
}

export function createInitialState(w = 540, h = 540): GameState {
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    sequence: [],
    inputIndex: 0,
    watchIndex: 0,
    watchTimer: 0,
    lit: null,
    pressId: null,
    pressLife: 0,
    flash: 0,
    scale: 1,
    stageW: w,
    stageH: h,
  }
}

export function resizeState(state: GameState, w: number, h: number): GameState {
  const scale = Math.min(w, h) / 540 || 1
  return { ...state, stageW: w, stageH: h, scale }
}

function beginRound(state: GameState): GameState {
  const next = Math.floor(Math.random() * PAD_COUNT)
  return {
    ...state,
    phase: 'watch',
    sequence: [...state.sequence, next],
    inputIndex: 0,
    watchIndex: 0,
    watchTimer: introGap(state.sequence.length + 1),
    lit: null,
  }
}

export function startGame(prev: GameState): GameState {
  return beginRound({
    ...createInitialState(prev.stageW, prev.stageH),
    best: Math.max(prev.best, loadBest()),
    scale: prev.scale,
  })
}

export function padLayout(w: number, h: number) {
  const size = Math.min(w, h)
  const pad = size * 0.08
  const gap = size * 0.06
  const inner = size - pad * 2
  const cell = (inner - gap) / 2
  const r = cell * 0.42
  const ox = (w - size) / 2 + pad
  const oy = (h - size) / 2 + pad
  return [0, 1, 2, 3].map((id) => {
    const col = id % 2
    const row = Math.floor(id / 2)
    return {
      id,
      x: ox + col * (cell + gap) + cell / 2,
      y: oy + row * (cell + gap) + cell / 2,
      r,
    }
  })
}

export function tapPadId(state: GameState, hit: number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover') return state
  if (state.phase !== 'input') return state
  if (hit < 0 || hit >= PAD_COUNT) return state

  const expect = state.sequence[state.inputIndex]
  if (hit !== expect) {
    const bestScore = Math.max(state.best, state.score)
    if (bestScore !== state.best) saveBest(bestScore)
    sfx('miss')
    return {
      ...state,
      phase: 'gameover',
      best: bestScore,
      lit: hit,
      pressId: hit,
      pressLife: PRESS_LIFE,
      flash: 0.28,
    }
  }

  sfx('pad', hit)
  const inputIndex = state.inputIndex + 1
  if (inputIndex >= state.sequence.length) {
    return beginRound({
      ...state,
      score: state.score + 1,
      lit: hit,
      pressId: hit,
      pressLife: PRESS_LIFE,
      flash: 0.18,
    })
  }

  return {
    ...state,
    inputIndex,
    lit: hit,
    pressId: hit,
    pressLife: PRESS_LIFE,
    flash: 0.12,
  }
}

export function tapPad(state: GameState, x: number, y: number): GameState {
  if (state.phase !== 'input') return state

  const pads = padLayout(state.stageW, state.stageH)
  let hit: number | null = null
  let best = Infinity
  for (const p of pads) {
    const d = Math.hypot(x - p.x, y - p.y)
    if (d <= p.r * 1.2 && d < best) {
      best = d
      hit = p.id
    }
  }
  if (hit == null) return state
  return tapPadId(state, hit)
}

export function tick(state: GameState, dt: number): GameState {
  let s = { ...state }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.pressLife = Math.max(0, s.pressLife - dt)
  if (s.pressLife <= 0) s.pressId = null
  if (s.phase === 'input' && s.lit != null && s.pressId !== s.lit) {
    if (s.flash <= 0.02) s.lit = null
  }

  if (s.phase !== 'watch') return s

  s.watchTimer -= dt
  if (s.watchTimer > 0) return s

  const len = noteLen(s.sequence.length)
  if (s.lit != null) {
    s.lit = null
    s.watchIndex += 1
    if (s.watchIndex >= s.sequence.length) {
      s.phase = 'input'
      s.watchTimer = 0
      return s
    }
    s.watchTimer = NOTE_GAP
    return s
  }

  const note = s.sequence[s.watchIndex]
  s.lit = note
  s.watchTimer = len
  sfx('pad', note)
  return s
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    round: s.sequence.length,
  }
}
