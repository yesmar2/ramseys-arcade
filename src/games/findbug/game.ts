import { mulberry32 } from '../../lib/seededRandom'
import { buildScene, clampAnchor, SCENE_ORDER, type Scene, type SceneKind } from './scenes'

export type Phase = 'menu' | 'playing' | 'gameover'

export const ROUNDS = SCENE_ORDER.length

/** A wrong swat costs time, the way a Spotter strike does. */
export const MISS_PENALTY_MS = 3000
/** Taking the hint is deliberately expensive. */
export const HINT_PENALTY_MS = 8000
/** The hint only unlocks once a round has genuinely stalled. */
export const HINT_AFTER_MS = 12_000
/** A round always ends, so a run always produces a score. */
export const ROUND_CAP_MS = 45_000
export const ROUND_FAIL_PENALTY_MS = 15_000
/** Pause on the caught bug before the next scene. */
const FOUND_HOLD_S = 0.95

/** Stage ratio — portrait, matching Pop and Stacker. */
/**
 * Two board shapes: upright on a phone, on its side on a desktop. The upright
 * one is tall because phones are — a 3:4 board left a third of the screen
 * empty. The scene grids scale their rows and columns to whichever shape is in
 * play, so both hold roughly the same clutter and the two runs stay comparable
 * on one leaderboard — see `squareGrid` in scenes.ts.
 */
export function stageFor(portrait: boolean) {
  return portrait ? { w: 3, h: 5 } : { w: 4, h: 3 }
}

/** Field height over field width, which is what the scene grids key off. */
export function aspectFor(portrait: boolean) {
  return portrait ? 5 / 3 : 3 / 4
}

/**
 * Where the scene sits inside a canvas that fills the shell. The scene keeps a
 * fixed 3:4 whatever shape the window is — a wider board would mean a different
 * amount of ground to search, and the leaderboard is a shared one.
 */
export function fieldRect(w: number, h: number, aspect: number) {
  const fw = Math.min(w, h / aspect)
  const fh = fw * aspect
  return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh }
}

export type RoundConfig = {
  /** Body length as a fraction of stage width. */
  bugSize: number
  /** How far the bug's color sinks toward the scene's. */
  camo: number
  /** Multiplier on a scene's decoy count — later rounds are grubbier. */
  clutter: number
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * The bug holds still, so size, camouflage and clutter are the whole difficulty
 * curve. They all climb together across the run.
 */
export function roundConfig(index: number): RoundConfig {
  const t = ROUNDS > 1 ? index / (ROUNDS - 1) : 0
  return {
    bugSize: lerp(0.026, 0.017, t),
    camo: lerp(0.74, 0.93, t),
    clutter: lerp(1.2, 2, t),
  }
}

export type RoundState = {
  index: number
  kind: SceneKind
  scene: Scene
  config: RoundConfig
  /** Field shape this scene was laid out for. Held so a rotation mid-round
   *  letterboxes the scene rather than stretching it. */
  aspect: number
  /** Colour of the surface the bug is perched on — what it camouflages against. */
  camoBase: string
  x: number
  y: number
  /** Fixed facing, picked once when the round is built. */
  angle: number
  elapsedMs: number
  found: boolean
  foundAge: number
  failed: boolean
  hintUsed: boolean
}

export type GameState = {
  phase: Phase
  round: RoundState
  penaltyMs: number
  misses: number
  /** Wall-clock ms across finished rounds, so the HUD can show a running total. */
  bankedMs: number
  pointerX: number
  pointerY: number
  pointerActive: boolean
  keyboardMode: boolean
  reticleX: number
  reticleY: number
  missFlash: number
  missX: number
  missY: number
  seed: number
  rng: () => number
}

export type Snapshot = {
  phase: Phase
  roundNumber: number
  sceneKind: SceneKind
  runMs: number
  penaltyMs: number
  misses: number
  roundMs: number
  found: boolean
  failed: boolean
  hintUsed: boolean
  hintReady: boolean
  keyboardMode: boolean
  reticleX: number
  reticleY: number
}

function makeRound(index: number, rng: () => number, aspect: number): RoundState {
  const config = roundConfig(index)
  const kind = SCENE_ORDER[index % SCENE_ORDER.length]
  const scene = buildScene(kind, rng, config.clutter, aspect)
  const picked = scene.anchors[Math.floor(rng() * scene.anchors.length) % scene.anchors.length]
  const anchor = clampAnchor(picked ?? { x: 0.5, y: 0.5, on: '#3a4254' })

  return {
    index,
    kind,
    scene,
    config,
    aspect,
    camoBase: anchor.on,
    x: anchor.x,
    y: anchor.y,
    angle: rng() * Math.PI * 2,
    elapsedMs: 0,
    found: false,
    foundAge: 0,
    failed: false,
    hintUsed: false,
  }
}

export function createInitialState(portrait = true): GameState {
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0
  const rng = mulberry32(seed)
  return {
    phase: 'menu',
    round: makeRound(0, rng, aspectFor(portrait)),
    penaltyMs: 0,
    misses: 0,
    bankedMs: 0,
    pointerX: 0.5,
    pointerY: 0.5,
    pointerActive: false,
    keyboardMode: false,
    reticleX: 0.5,
    reticleY: 0.5,
    missFlash: 0,
    missX: 0,
    missY: 0,
    seed,
    rng,
  }
}

export function startGame(prev: GameState, portrait = true): GameState {
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0
  const rng = mulberry32(seed)
  return {
    ...prev,
    phase: 'playing',
    round: makeRound(0, rng, aspectFor(portrait)),
    penaltyMs: 0,
    misses: 0,
    bankedMs: 0,
    missFlash: 0,
    keyboardMode: false,
    reticleX: 0.5,
    reticleY: 0.5,
    seed,
    rng,
  }
}

/** Total run time including penalties — the number the score inverts. */
export function runMs(state: GameState): number {
  return state.bankedMs + state.round.elapsedMs + state.penaltyMs
}

export function hintReady(state: GameState): boolean {
  const r = state.round
  return state.phase === 'playing' && !r.hintUsed && !r.found && r.elapsedMs >= HINT_AFTER_MS
}

function advanceRound(state: GameState): GameState {
  const next = state.round.index + 1
  state.bankedMs += state.round.elapsedMs
  if (next >= ROUNDS) {
    state.phase = 'gameover'
    return state
  }
  // Later rounds keep the shape the run started in.
  state.round = makeRound(next, state.rng, state.round.aspect)
  return state
}

export function tick(prev: GameState, dt: number): GameState {
  const state = { ...prev, round: { ...prev.round } }
  state.missFlash = Math.max(0, state.missFlash - dt * 2.2)

  if (state.phase !== 'playing') return state

  const round = state.round

  if (round.found) {
    round.foundAge += dt
    if (round.foundAge >= FOUND_HOLD_S) return advanceRound(state)
    return state
  }

  round.elapsedMs += dt * 1000

  if (round.elapsedMs >= ROUND_CAP_MS) {
    round.failed = true
    state.penaltyMs += ROUND_FAIL_PENALTY_MS
    return advanceRound(state)
  }

  return state
}

/** Swat tolerance in normalized units — generous enough for a thumb. */
export function catchRadius(round: RoundState): number {
  return Math.max(round.config.bugSize * 0.95, 0.036)
}

export function hitAt(prev: GameState, x: number, y: number): GameState {
  if (prev.phase !== 'playing' || prev.round.found || prev.round.failed) return prev
  const state = { ...prev, round: { ...prev.round } }
  const round = state.round

  if (Math.hypot(x - round.x, y - round.y) <= catchRadius(round)) {
    round.found = true
    round.foundAge = 0
    return state
  }

  state.misses += 1
  state.penaltyMs += MISS_PENALTY_MS
  state.missFlash = 1
  state.missX = x
  state.missY = y
  return state
}

export function applyHint(prev: GameState): GameState {
  if (!hintReady(prev)) return prev
  const state = { ...prev, round: { ...prev.round } }
  state.round.hintUsed = true
  state.penaltyMs += HINT_PENALTY_MS
  return state
}

export function setPointer(prev: GameState, x: number, y: number): GameState {
  return { ...prev, pointerX: x, pointerY: y, pointerActive: true, keyboardMode: false }
}

export function clearPointer(prev: GameState): GameState {
  return { ...prev, pointerActive: false }
}

/** Arrow-key scanning — the keyboard path to the same swat. */
export function moveReticle(prev: GameState, dx: number, dy: number): GameState {
  const step = 0.022
  return {
    ...prev,
    keyboardMode: true,
    pointerActive: false,
    reticleX: Math.max(0.02, Math.min(0.98, prev.reticleX + dx * step)),
    reticleY: Math.max(0.02, Math.min(0.98, prev.reticleY + dy * step)),
  }
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    phase: s.phase,
    roundNumber: s.round.index + 1,
    sceneKind: s.round.kind,
    runMs: runMs(s),
    penaltyMs: s.penaltyMs,
    misses: s.misses,
    roundMs: s.round.elapsedMs,
    found: s.round.found,
    failed: s.round.failed,
    hintUsed: s.round.hintUsed,
    hintReady: hintReady(s),
    keyboardMode: s.keyboardMode,
    reticleX: s.reticleX,
    reticleY: s.reticleY,
  }
}
