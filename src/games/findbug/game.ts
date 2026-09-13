import { mulberry32 } from '../../lib/seededRandom'
import { buildScene, SCENE_ORDER, type Scene, type SceneKind } from './scenes'

export type Phase = 'menu' | 'playing' | 'gameover'
export type BugMode = 'idle' | 'scurry'

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
export const STAGE_W = 3
export const STAGE_H = 4

export type RoundConfig = {
  /** Body length as a fraction of stage width. */
  bugSize: number
  /** How far the bug's color sinks toward the scene's. */
  camo: number
  /** Pointer distance that startles it, normalized. */
  scurryRadius: number
  /** Normalized units per second. */
  scurrySpeed: number
  /** Seconds between guaranteed tells. */
  tellEvery: number
  driftCount: number
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function roundConfig(index: number): RoundConfig {
  const t = ROUNDS > 1 ? index / (ROUNDS - 1) : 0
  return {
    bugSize: lerp(0.038, 0.021, t),
    camo: lerp(0.34, 0.78, t),
    scurryRadius: lerp(0.15, 0.24, t),
    scurrySpeed: lerp(0.55, 1.1, t),
    tellEvery: lerp(2.2, 4.6, t),
    driftCount: Math.round(lerp(0, 8, t)),
  }
}

export type RoundState = {
  index: number
  kind: SceneKind
  scene: Scene
  config: RoundConfig
  /** Index into scene.anchors — drives the "eating a semicolon" detail. */
  anchorIndex: number
  x: number
  y: number
  targetX: number
  targetY: number
  angle: number
  mode: BugMode
  legPhase: number
  /** Counts down to the next guaranteed tell. */
  tellIn: number
  /** 0–1 highlight pulse used as the reduced-motion stand-in for a hop. */
  pulse: number
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
  reducedMotion: boolean
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

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function makeRound(index: number, rng: () => number): RoundState {
  const config = roundConfig(index)
  const kind = SCENE_ORDER[index % SCENE_ORDER.length]
  const scene = buildScene(kind, rng, config.driftCount)
  const anchorIndex = Math.floor(rng() * scene.anchors.length) % scene.anchors.length
  const anchor = scene.anchors[anchorIndex] ?? { x: 0.5, y: 0.5 }

  return {
    index,
    kind,
    scene,
    config,
    anchorIndex,
    x: anchor.x,
    y: anchor.y,
    targetX: anchor.x,
    targetY: anchor.y,
    angle: rng() * Math.PI * 2,
    mode: 'idle',
    legPhase: 0,
    tellIn: config.tellEvery * (0.5 + rng() * 0.5),
    pulse: 0,
    elapsedMs: 0,
    found: false,
    foundAge: 0,
    failed: false,
    hintUsed: false,
  }
}

export function createInitialState(): GameState {
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0
  const rng = mulberry32(seed)
  return {
    phase: 'menu',
    round: makeRound(0, rng),
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
    reducedMotion: prefersReducedMotion(),
    seed,
    rng,
  }
}

export function startGame(prev: GameState): GameState {
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0
  const rng = mulberry32(seed)
  return {
    ...prev,
    phase: 'playing',
    round: makeRound(0, rng),
    penaltyMs: 0,
    misses: 0,
    bankedMs: 0,
    missFlash: 0,
    keyboardMode: false,
    reticleX: 0.5,
    reticleY: 0.5,
    reducedMotion: prefersReducedMotion(),
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

/** Pick a fresh perch, biased away from wherever the player is looking. */
function chooseAnchor(state: GameState, round: RoundState): number {
  const anchors = round.scene.anchors
  if (anchors.length === 0) return round.anchorIndex

  const px = state.pointerActive ? state.pointerX : state.reticleX
  const py = state.pointerActive ? state.pointerY : state.reticleY

  let bestIndex = round.anchorIndex
  let bestScore = -Infinity
  // Sample a handful rather than scanning every anchor — keeps it unpredictable.
  for (let i = 0; i < 8; i++) {
    const index = Math.floor(state.rng() * anchors.length) % anchors.length
    if (index === round.anchorIndex) continue
    const a = anchors[index]
    const fromPointer = Math.hypot(a.x - px, a.y - py)
    const fromHere = Math.hypot(a.x - round.x, a.y - round.y)
    // Far from the cursor, but not so far it teleports across the whole stage.
    const score = fromPointer * 2 - Math.abs(fromHere - 0.28)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  return bestIndex
}

function startScurry(state: GameState, round: RoundState) {
  const index = chooseAnchor(state, round)
  const anchor = round.scene.anchors[index]
  if (!anchor) return
  round.anchorIndex = index
  round.targetX = anchor.x
  round.targetY = anchor.y
  round.angle = Math.atan2(anchor.y - round.y, anchor.x - round.x)

  if (state.reducedMotion) {
    // No darting: it simply turns up somewhere else, with a pulse to catch the eye.
    round.x = anchor.x
    round.y = anchor.y
    round.pulse = 1
    round.mode = 'idle'
    return
  }
  round.mode = 'scurry'
}

/** A small shuffle on the spot, so a patient player is always rewarded. */
function doTell(state: GameState, round: RoundState) {
  round.tellIn = round.config.tellEvery * (0.7 + state.rng() * 0.6)
  if (state.reducedMotion) {
    round.pulse = 1
    return
  }
  const hop = 0.012 + state.rng() * 0.02
  const dir = state.rng() * Math.PI * 2
  round.targetX = Math.max(0.04, Math.min(0.96, round.x + Math.cos(dir) * hop))
  round.targetY = Math.max(0.04, Math.min(0.96, round.y + Math.sin(dir) * hop))
  round.angle = dir
  round.mode = 'scurry'
}

function advanceRound(state: GameState): GameState {
  const next = state.round.index + 1
  state.bankedMs += state.round.elapsedMs
  if (next >= ROUNDS) {
    state.phase = 'gameover'
    return state
  }
  state.round = makeRound(next, state.rng)
  return state
}

export function tick(prev: GameState, dt: number): GameState {
  const state = { ...prev, round: { ...prev.round } }
  state.missFlash = Math.max(0, state.missFlash - dt * 2.2)

  if (state.phase !== 'playing') return state

  const round = state.round
  round.pulse = Math.max(0, round.pulse - dt * 1.8)

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

  const { config } = round

  // Startle: close the gap and it bolts.
  if (round.mode === 'idle') {
    const px = state.keyboardMode ? state.reticleX : state.pointerX
    const py = state.keyboardMode ? state.reticleY : state.pointerY
    const active = state.keyboardMode || state.pointerActive
    if (active && Math.hypot(px - round.x, py - round.y) < config.scurryRadius) {
      startScurry(state, round)
    }
  }

  round.tellIn -= dt
  if (round.tellIn <= 0 && round.mode === 'idle') doTell(state, round)

  if (round.mode === 'scurry') {
    const dx = round.targetX - round.x
    const dy = round.targetY - round.y
    const dist = Math.hypot(dx, dy)
    const step = config.scurrySpeed * dt
    if (dist <= step || dist < 0.0005) {
      round.x = round.targetX
      round.y = round.targetY
      round.mode = 'idle'
    } else {
      round.x += (dx / dist) * step
      round.y += (dy / dist) * step
      round.angle = Math.atan2(dy, dx)
      round.legPhase = (round.legPhase + dt * 7) % 1
    }
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
    round.mode = 'idle'
    return state
  }

  state.misses += 1
  state.penaltyMs += MISS_PENALTY_MS
  state.missFlash = 1
  state.missX = x
  state.missY = y
  // A near miss sends it running.
  if (Math.hypot(x - round.x, y - round.y) < round.config.scurryRadius) {
    startScurry(state, round)
  }
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
