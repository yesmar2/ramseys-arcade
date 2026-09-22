/**
 * Find the Bug: a timed Where's Waldo.
 *
 * Five scenes, one Bug hidden in each. A scene gets a minute; find him and the
 * clock stops, run out and he is shown and the whole minute counts. The score
 * is the total, fastest wins.
 *
 * Every millisecond in the total is one that really passed. A wrong tap costs
 * time by leaving the player dazed — the scene dims and ignores taps for a
 * moment while the clock keeps going — rather than by adding seconds nobody
 * spent. The leaderboard checks a claimed time against its own clock, and a
 * total padded with penalty seconds could claim more time than the run took.
 */

import { hashString, mulberry32 } from '../../lib/seededRandom'
import { faceCentre } from './critters'
import { buildScene, SCENE_NAMES, SCENE_ORDER, tapFindsTarget, type Scene, type SceneKind } from './scenes'

export type Phase = 'menu' | 'intro' | 'playing' | 'found' | 'timeout' | 'gameover'

export const ROUNDS = SCENE_ORDER.length

/** How long a scene lasts before he is shown and the next one starts. */
export const SCENE_LIMIT_MS = 60_000
/** A wide circle round where he is, once a scene has dragged on. */
export const HINT_WIDE_MS = 25_000
/** A tighter one later still. */
export const HINT_NARROW_MS = 42_000
/** How long a wrong tap leaves the scene dimmed and deaf. */
export const DAZE_MS = 1_500
/** Time on the scene card before the clock starts. The first one shows him for longer. */
const INTRO_FIRST_MS = 2_600
const INTRO_MS = 1_700
/** The pause on a find, and on being shown where he was. */
const FOUND_HOLD_MS = 1_350
const TIMEOUT_HOLD_MS = 2_400
const MISS_MARK_MS = 900

export type Hint = { x: number; y: number; r: number }

export type MissMark = { x: number; y: number; ageMs: number }

export type GameState = {
  phase: Phase
  seed: number
  /** Field height over width the next scene is built for. */
  aspect: number
  index: number
  scene: Scene
  /**
   * The scene has been painted and can be shown. It is painted a little at a
   * time behind the scene card, and the clock waits for it: nobody should be
   * timed on a picture that is still arriving.
   */
  ready: boolean
  /** Clock for the scene in play. Stops on a find. */
  sceneMs: number
  /** Scenes already finished, in real milliseconds. */
  bankedMs: number
  /** Time in the current card or pause between scenes. */
  phaseMs: number
  found: number
  misses: number
  dazeMs: number
  marks: MissMark[]
  hints: [Hint, Hint]
  times: number[]
}

export type Snapshot = {
  phase: Phase
  index: number
  sceneKind: SceneKind
  sceneName: string
  runMs: number
  sceneMs: number
  sceneLeftMs: number
  found: number
  misses: number
  dazed: boolean
  hintLevel: 0 | 1 | 2
  lastTimeMs: number | null
  ready: boolean
}

function sceneSeed(seed: number, index: number): number {
  return hashString(`${seed}:${index}`)
}

/**
 * Two circles that contain him, off centre so the middle of a circle is not
 * an answer in itself. The narrow one sits inside the wide one.
 */
function makeHints(scene: Scene, seed: number): [Hint, Hint] {
  const rng = mulberry32(seed ^ 0x9e3779b9)
  const f = faceCentre(scene.target)
  const span = Math.min(scene.w, scene.h)
  const wideR = span * 0.3
  const narrowR = span * 0.15
  const off = (r: number, share: number) => {
    const a = rng() * Math.PI * 2
    const d = r * share * (0.4 + rng() * 0.6)
    return { x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d }
  }
  const wide = off(wideR, 0.55)
  const narrow = off(narrowR, 0.5)
  return [
    { ...wide, r: wideR },
    { ...narrow, r: narrowR },
  ]
}

function enterScene(state: GameState, index: number): GameState {
  const seed = sceneSeed(state.seed, index)
  const scene = buildScene(SCENE_ORDER[index], index, seed, state.aspect)
  return {
    ...state,
    phase: 'intro',
    index,
    scene,
    ready: false,
    sceneMs: 0,
    phaseMs: 0,
    dazeMs: 0,
    marks: [],
    hints: makeHints(scene, seed),
  }
}

function newSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

export function createInitialState(aspect: number): GameState {
  const seed = newSeed()
  const scene = buildScene(SCENE_ORDER[0], 0, sceneSeed(seed, 0), aspect)
  return {
    phase: 'menu',
    seed,
    aspect,
    index: 0,
    scene,
    ready: false,
    sceneMs: 0,
    bankedMs: 0,
    phaseMs: 0,
    found: 0,
    misses: 0,
    dazeMs: 0,
    marks: [],
    hints: makeHints(scene, seed),
    times: [],
  }
}

export function startGame(prev: GameState, aspect: number): GameState {
  const fresh: GameState = {
    ...prev,
    seed: newSeed(),
    aspect,
    bankedMs: 0,
    found: 0,
    misses: 0,
    times: [],
  }
  return enterScene(fresh, 0)
}

/** Shape the canvas is now, for whichever scene gets built next. */
export function setAspect(prev: GameState, aspect: number): GameState {
  return Math.abs(prev.aspect - aspect) < 0.01 ? prev : { ...prev, aspect }
}

/** Total run time, in real milliseconds — the number the score inverts. */
export function runMs(state: GameState): number {
  const live = state.phase === 'playing' || state.phase === 'found' || state.phase === 'timeout'
  return state.bankedMs + (live ? state.sceneMs : 0)
}

export function hintLevel(state: GameState): 0 | 1 | 2 {
  if (state.phase !== 'playing') return 0
  if (state.sceneMs >= HINT_NARROW_MS) return 2
  if (state.sceneMs >= HINT_WIDE_MS) return 1
  return 0
}

function finishScene(state: GameState): GameState {
  const next = state.index + 1
  const banked = state.bankedMs + state.sceneMs
  if (next >= ROUNDS) {
    return { ...state, phase: 'gameover', bankedMs: banked, sceneMs: 0, phaseMs: 0 }
  }
  return enterScene({ ...state, bankedMs: banked }, next)
}

export function tick(prev: GameState, dtMs: number): GameState {
  if (prev.phase === 'menu' || prev.phase === 'gameover') return prev
  const state = { ...prev }
  if (state.marks.length) {
    state.marks = state.marks.map((m) => ({ ...m, ageMs: m.ageMs + dtMs })).filter((m) => m.ageMs < MISS_MARK_MS)
  }

  switch (state.phase) {
    case 'intro': {
      state.phaseMs += dtMs
      const hold = state.index === 0 ? INTRO_FIRST_MS : INTRO_MS
      if (state.phaseMs >= hold && state.ready) {
        state.phase = 'playing'
        state.phaseMs = 0
      }
      return state
    }
    case 'playing': {
      state.sceneMs = Math.min(SCENE_LIMIT_MS, state.sceneMs + dtMs)
      state.dazeMs = Math.max(0, state.dazeMs - dtMs)
      if (state.sceneMs >= SCENE_LIMIT_MS) {
        state.phase = 'timeout'
        state.phaseMs = 0
        state.dazeMs = 0
        state.times = [...state.times, SCENE_LIMIT_MS]
      }
      return state
    }
    case 'found':
    case 'timeout': {
      state.phaseMs += dtMs
      const hold = state.phase === 'found' ? FOUND_HOLD_MS : TIMEOUT_HOLD_MS
      if (state.phaseMs >= hold) return finishScene(state)
      return state
    }
    default:
      return state
  }
}

/** Skip the rest of the scene card. The clock has not started, so nothing is lost. */
export function skipIntro(prev: GameState): GameState {
  if (prev.phase !== 'intro' || !prev.ready) return prev
  return { ...prev, phase: 'playing', phaseMs: 0 }
}

/** The scene is painted and can be shown. */
export function markReady(prev: GameState): GameState {
  return prev.ready ? prev : { ...prev, ready: true }
}

export type TapResult = 'found' | 'miss' | 'ignored'

/** A tap on the scene, in world units. */
export function tapAt(prev: GameState, x: number, y: number): { state: GameState; result: TapResult } {
  if (prev.phase !== 'playing' || prev.dazeMs > 0) return { state: prev, result: 'ignored' }
  if (tapFindsTarget(prev.scene, x, y)) {
    return {
      state: {
        ...prev,
        phase: 'found',
        phaseMs: 0,
        found: prev.found + 1,
        times: [...prev.times, prev.sceneMs],
      },
      result: 'found',
    }
  }
  return {
    state: {
      ...prev,
      misses: prev.misses + 1,
      dazeMs: DAZE_MS,
      marks: [...prev.marks, { x, y, ageMs: 0 }],
    },
    result: 'miss',
  }
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    phase: s.phase,
    index: s.index,
    sceneKind: s.scene.kind,
    sceneName: SCENE_NAMES[s.scene.kind],
    runMs: runMs(s),
    sceneMs: s.sceneMs,
    sceneLeftMs: Math.max(0, SCENE_LIMIT_MS - s.sceneMs),
    found: s.found,
    misses: s.misses,
    dazed: s.dazeMs > 0,
    hintLevel: hintLevel(s),
    lastTimeMs: s.times.length ? s.times[s.times.length - 1] : null,
    ready: s.ready,
  }
}

export { MISS_MARK_MS }
