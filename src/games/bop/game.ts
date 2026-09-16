import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

/*
 * Bop: five controls on a console, and a voice that calls one at a time.
 * Do what it says before the window closes. Each correct call is a point,
 * and a quick one is two; the wrong control, or too slow, ends the run.
 * The window shrinks as the run goes on, so the game is really about how
 * long you can keep up with it.
 */

export type Phase = 'menu' | 'call' | 'gameover'

export const CONTROLS = ['bop', 'twist', 'pull', 'flick', 'spin'] as const
export type Control = (typeof CONTROLS)[number]

export const CONTROL_LABEL: Record<Control, string> = {
  bop: 'Bop it',
  twist: 'Twist it',
  pull: 'Pull it',
  flick: 'Flick it',
  spin: 'Spin it',
}

/** Hue per control, for the console and the call text. */
export const CONTROL_HUE: Record<Control, number> = {
  bop: 348,
  twist: 198,
  pull: 38,
  flick: 172,
  spin: 268,
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  streak: number
  /** How the last run ended, for the score card title. */
  ended: 'wrong' | 'late' | null
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  streak: number
  /** What is being called for right now. */
  call: Control | null
  /** Seconds left to answer this call, and the window it started with. */
  timer: number
  window: number
  /** Pause between a correct answer and the next call. */
  gap: number
  /** Which control was just used, and how long its press animation has left. */
  pressed: Control | null
  pressLife: number
  /** Which control was called wrong, kept lit at game over. */
  wrong: Control | null
  ended: 'wrong' | 'late' | null
  flash: number
  /** Running animation angle for the wheel and knob. */
  spinAngle: number
  twistAngle: number
  scale: number
  stageW: number
  stageH: number
}

const FIRST_WINDOW = 2.2
const MIN_WINDOW = 0.62
const SHRINK = 0.955
const GAP = 0.32
const PRESS_LIFE = 0.34
/** Answering in this fraction of the window earns the quick point. */
export const QUICK_FRACTION = 0.5

function loadBest() {
  return getPersonalBest('bop')
}

export function createInitialState(w = 540, h = 540): GameState {
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    streak: 0,
    call: null,
    timer: 0,
    window: FIRST_WINDOW,
    gap: 0,
    pressed: null,
    pressLife: 0,
    wrong: null,
    ended: null,
    flash: 0,
    spinAngle: 0,
    twistAngle: 0,
    scale: 1,
    stageW: w,
    stageH: h,
  }
}

export function resizeState(state: GameState, w: number, h: number): GameState {
  const scale = Math.min(w, h) / 540 || 1
  return { ...state, stageW: w, stageH: h, scale }
}

function nextCall(prev: Control | null): Control {
  // Never the same control twice running: the fun is in switching.
  const options = CONTROLS.filter((c) => c !== prev)
  return options[Math.floor(Math.random() * options.length)]!
}

function callIndex(control: Control) {
  return CONTROLS.indexOf(control)
}

function makeCall(state: GameState): GameState {
  const call = nextCall(state.call)
  sfx('pad', callIndex(call))
  return {
    ...state,
    phase: 'call',
    call,
    timer: state.window,
    gap: 0,
  }
}

export function startGame(prev: GameState): GameState {
  const fresh = createInitialState(prev.stageW, prev.stageH)
  return {
    ...makeCall({ ...fresh, best: Math.max(prev.best, loadBest()), scale: prev.scale }),
    // The first call gets a moment's grace so the run doesn't start on the tap.
    gap: 0,
  }
}

/** Where each control sits: a console laid out in a centred square. */
export function consoleLayout(w: number, h: number) {
  const size = Math.min(w, h)
  const ox = (w - size) / 2
  const oy = (h - size) / 2
  const u = size / 100
  return {
    size,
    u,
    bop: { x: ox + 50 * u, y: oy + 46 * u, r: 17 * u },
    twist: { x: ox + 19 * u, y: oy + 30 * u, r: 11 * u },
    pull: { x: ox + 81 * u, y: oy + 30 * u, r: 11 * u, len: 16 * u },
    flick: { x: ox + 19 * u, y: oy + 74 * u, r: 11 * u },
    spin: { x: ox + 81 * u, y: oy + 74 * u, r: 12.5 * u },
  }
}

export function bopLayout(portrait: boolean) {
  return portrait ? { aspectW: 3, aspectH: 4 } : { aspectW: 1, aspectH: 1 }
}

/** Which control is under a point, if any. */
export function controlAt(state: GameState, x: number, y: number): Control | null {
  const l = consoleLayout(state.stageW, state.stageH)
  const hit = (cx: number, cy: number, r: number) => Math.hypot(x - cx, y - cy) <= r * 1.35
  if (hit(l.bop.x, l.bop.y, l.bop.r)) return 'bop'
  if (hit(l.twist.x, l.twist.y, l.twist.r)) return 'twist'
  if (hit(l.pull.x, l.pull.y + l.pull.len * 0.3, l.pull.r + l.pull.len * 0.4)) return 'pull'
  if (hit(l.flick.x, l.flick.y, l.flick.r)) return 'flick'
  if (hit(l.spin.x, l.spin.y, l.spin.r)) return 'spin'
  return null
}

/** The player did something. Right control in time scores; anything else ends the run. */
export function act(state: GameState, control: Control): GameState {
  if (state.phase !== 'call' || !state.call) return state

  if (control !== state.call) {
    sfx('miss')
    return {
      ...state,
      phase: 'gameover',
      best: Math.max(state.best, state.score),
      pressed: control,
      pressLife: PRESS_LIFE,
      wrong: control,
      ended: 'wrong',
      flash: 0.3,
    }
  }

  const quick = state.timer >= state.window * QUICK_FRACTION
  const gained = quick ? 2 : 1
  sfx(quick ? 'good' : 'tap', callIndex(control))
  return {
    ...state,
    score: state.score + gained,
    streak: state.streak + 1,
    call: state.call,
    timer: 0,
    gap: GAP,
    window: Math.max(MIN_WINDOW, state.window * SHRINK),
    pressed: control,
    pressLife: PRESS_LIFE,
    flash: quick ? 0.16 : 0.1,
    spinAngle: control === 'spin' ? state.spinAngle + Math.PI * 2 : state.spinAngle,
    twistAngle: control === 'twist' ? state.twistAngle + Math.PI / 2 : state.twistAngle,
  }
}

export function tick(state: GameState, dt: number): GameState {
  const s = { ...state }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.pressLife = Math.max(0, s.pressLife - dt)
  if (s.pressLife <= 0 && s.phase !== 'gameover') s.pressed = null

  if (s.phase !== 'call') return s

  if (s.gap > 0) {
    s.gap -= dt
    if (s.gap <= 0) return makeCall(s)
    return s
  }

  s.timer -= dt
  if (s.timer <= 0) {
    sfx('miss')
    return {
      ...s,
      phase: 'gameover',
      best: Math.max(s.best, s.score),
      timer: 0,
      ended: 'late',
      flash: 0.3,
    }
  }
  return s
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    streak: s.streak,
    ended: s.ended,
  }
}
