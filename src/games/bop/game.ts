import { getPersonalBest } from '../../lib/personalBest'
import { sfx, type SoundName } from '../../lib/sound'
import { sayCall } from './voice'

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

/**
 * The sound each control makes when it's worked. They used to be one chime at
 * five pitches, which only a trained ear tells apart. The toy says its calls
 * out loud now (voice.ts); a call sounds its control's sound only when the
 * voice can't play.
 */
export const CONTROL_SOUND: Record<Control, SoundName> = {
  bop: 'boing',
  twist: 'ratchet',
  pull: 'zip',
  flick: 'click',
  spin: 'whirr',
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  streak: number
  /** How the last run ended, for the score card title. */
  ended: 'wrong' | 'late' | null
  /** Seconds since the run ended, so the card can wait for the ending to be seen. */
  overFor: number
}

export type PopTone = 'quick' | 'plain' | 'streak'

/** The lever, still held after a Pull it was answered: how long, and how long at the cherry (-1 if it isn't there). */
export type Lever = { held: number; bottom: number }

/** A word that rises off a control: what an answer paid, or a streak landmark. */
export type Pop = {
  control: Control
  text: string
  tone: PopTone
  life: number
  max: number
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
  /** The red flash an ending gets. */
  flash: number
  /** What the last right answer paid, for the screen between calls. */
  lastGain: number
  pops: Pop[]
  /** The toy shakes when a run ends. */
  shake: number
  overFor: number
  /** Running animation angle for the wheel and knob. */
  spinAngle: number
  twistAngle: number
  /** The jackpot's reels on the screen: seconds left, 0 when there are none; and whether this run has had one. */
  reels: number
  jackpotDone: boolean
  /** The lever, if it's still held after a Pull it was answered; the toy waits for it. */
  lever: Lever | null
  scale: number
  stageW: number
  stageH: number
  /** Where the page's own readout and buttons end, so the toy starts below them. */
  stageTop: number
}

/*
 * The window a call gives you: roomy at first, a little less after every
 * right answer, and never below a floor. It was 2.2 s, 4.5% less a call and
 * no less than 0.62 s, and a phone, where reading a call and dragging to it
 * takes half a second or more, met that floor as a wall about 25 calls in,
 * however well it played. Measured on a model of a phone player, this moves
 * the usual run from 36 to about 49 and the best from 44 to about 70, and the
 * floor still ends every run in the end.
 *
 * It was still too hard (Ramsey, 2026-10-01). That model's phone player was
 * quick; a slower one, closer to a grown-up or a child playing for fun (0.45 to
 * 0.85 s to read a call, 0.15 to 0.35 s more to drag), met the 0.75 s floor
 * at about 24 calls, its best about 29. A floor of 1.1 s, reached more slowly,
 * puts its usual run at about 43 and its best near 60, so a good run shows,
 * and the slips and slow moments that come late in a run still end it. A
 * keyboard's usual run goes from about 37 to about 90.
 */
const FIRST_WINDOW = 2.8
const MIN_WINDOW = 1.1
/*
 * The very first call of a run waits longer: a first-timer is still finding
 * the five controls, and at 2.4 s the first call ran out before they'd found
 * the one it named, so the run ended before it began. From the second call on
 * the windows run exactly as before.
 */
const OPENING_WINDOW = 5
const SHRINK = 0.978
const GAP = 0.32
export const PRESS_LIFE = 0.34
/** Answering in this fraction of the window earns the quick point. */
export const QUICK_FRACTION = 0.5
/** Every this many in a row gets its moment. */
export const STREAK_STEP = 10
const POP_LIFE = 0.7
/**
 * The easter egg: the lever pulled all the way down to the cherry at the
 * bottom of its slot, on a Pull it, and held there, spins the screen like a
 * fruit machine and lands on three cherries. The next call waits for it, once
 * a run, so it is a moment's show and no way to rest.
 *
 * Pulling it all the way was enough at first, and Ramsey found the jackpot
 * came up nearly every run ("seems too easy"): a full pull is how plenty of
 * people pull. Holding it down there is something nobody does by accident.
 */
export const JACKPOT_HOLD = 0.7
export const JACKPOT_TIME = 1.2
/**
 * The pause after a right answer is a third of a second, and a slow, careful
 * pull reaches the bottom of the slot after the next call. So the toy waits
 * while the lever is still held, for this long at most, till a run's jackpot.
 */
const LEVER_WAIT = 1.5
/** How long the reels spin before they land. */
export const REELS_SPIN = 0.75
/** Room kept for the score and the page's buttons when nothing has been measured yet. */
const DEFAULT_TOP = 56

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
    window: OPENING_WINDOW,
    gap: 0,
    pressed: null,
    pressLife: 0,
    wrong: null,
    ended: null,
    flash: 0,
    lastGain: 0,
    pops: [],
    shake: 0,
    overFor: 0,
    spinAngle: 0,
    twistAngle: 0,
    reels: 0,
    jackpotDone: false,
    lever: null,
    scale: 1,
    stageW: w,
    stageH: h,
    stageTop: DEFAULT_TOP,
  }
}

export function resizeState(state: GameState, w: number, h: number, top = state.stageTop): GameState {
  const scale = Math.min(w, h) / 540 || 1
  return { ...state, stageW: w, stageH: h, scale, stageTop: top }
}

function nextCall(prev: Control | null): Control {
  // Never the same control twice running: the fun is in switching.
  const options = CONTROLS.filter((c) => c !== prev)
  return options[Math.floor(Math.random() * options.length)]!
}

function makeCall(state: GameState): GameState {
  const call = nextCall(state.call)
  if (!sayCall(call)) sfx(CONTROL_SOUND[call])
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
    ...makeCall({
      ...fresh,
      best: Math.max(prev.best, loadBest()),
      scale: prev.scale,
      stageTop: prev.stageTop,
    }),
    // The first call gets a moment's grace so the run doesn't start on the tap.
    gap: 0,
  }
}

type Box = { x: number; y: number; w: number; h: number; r: number }
type Spot = { x: number; y: number; r: number }

export type ConsoleLayout = {
  /** A hundredth of the toy's shorter side: the unit everything is drawn in. */
  u: number
  portrait: boolean
  /** The toy itself, and the screen the calls come up on. */
  body: Box
  screen: Box
  bop: Spot
  twist: Spot
  pull: Spot
  flick: Spot
  spin: Spot
}

/**
 * The toy, fitted to whatever the stage is.
 *
 * It used to be a square of controls centred in a letterboxed stage, which on a
 * phone left a third of the screen to the page's background. The stage fills
 * the screen now and the toy takes its shape from it: a tall handheld on a
 * phone, a wide pad on a desk. Either way it is the same five controls in the
 * same places relative to each other: the big button in the middle, twist and
 * pull above it, flick and spin below, and the screen with the call on top.
 *
 * `top` is where the page's own score and buttons end, measured from the DOM,
 * so the toy never sits underneath them.
 */
export function consoleLayout(w: number, h: number, top = DEFAULT_TOP): ConsoleLayout {
  const margin = Math.max(12, Math.min(w, h) * 0.035)
  const availW = Math.max(1, w - margin * 2)
  const availH = Math.max(1, h - top - margin)
  const portrait = availH >= availW
  let bw: number
  let bh: number
  if (portrait) {
    bw = Math.min(availW, 470)
    bh = Math.min(availH, bw * 1.85)
    if (bh < bw * 1.3) bw = bh / 1.3
  } else {
    bh = Math.min(availH, 540)
    bw = Math.min(availW, bh * 1.55)
    if (bw < bh * 1.15) bh = bw / 1.15
  }
  const u = Math.min(bw, bh) / 100
  const body: Box = { x: (w - bw) / 2, y: top + (availH - bh) / 2, w: bw, h: bh, r: 9 * u }

  const pad = 6 * u
  const inner = { x: body.x + pad, y: body.y + pad, w: bw - pad * 2, h: bh - pad * 2 }
  const screenH = 17 * u
  const screenW = portrait ? inner.w : inner.w * 0.5
  const screen: Box = { x: body.x + (bw - screenW) / 2, y: inner.y, w: screenW, h: screenH, r: 5 * u }
  const below = screen.y + screenH + 3 * u
  const cx = body.x + bw / 2

  if (portrait) {
    // A handheld: the screen across the top and the controls in the rest.
    const ah = inner.y + inner.h - below
    const cy = below + ah / 2
    const side = Math.min(inner.w, ah)
    const small = side * 0.155
    const dx = inner.w * 0.3
    // The labels hang under the lower pair, so the pairs sit a touch high.
    const dy = ah * 0.31
    const lift = small * 0.2
    return {
      u,
      portrait,
      body,
      screen,
      bop: { x: cx, y: cy, r: side * 0.22 },
      twist: { x: cx - dx, y: cy - dy - lift, r: small },
      pull: { x: cx + dx, y: cy - dy - lift, r: small },
      flick: { x: cx - dx, y: cy + dy - lift, r: small },
      spin: { x: cx + dx, y: cy + dy - lift, r: small },
    }
  }

  /*
   * A pad held in both hands: the screen and the big button down the middle,
   * and a column either side. The screen only spans the middle, so the side
   * columns get the pad's whole height, which is what two controls and their
   * names need to stand one above the other.
   */
  const colW = (inner.w - screenW) / 2
  const small = Math.min(inner.h * 0.125, colW * 0.3)
  const leftX = inner.x + colW / 2
  const rightX = inner.x + inner.w - colW / 2
  const upper = inner.y + inner.h * 0.24
  const lower = inner.y + inner.h * 0.72
  const ah = inner.y + inner.h - below
  return {
    u,
    portrait,
    body,
    screen,
    bop: { x: cx, y: below + ah * 0.46, r: Math.min(screenW, ah) * 0.26 },
    twist: { x: leftX, y: upper, r: small },
    pull: { x: rightX, y: upper, r: small },
    flick: { x: leftX, y: lower, r: small },
    spin: { x: rightX, y: lower, r: small },
  }
}

/**
 * Which control is under a point, if any. Each reaches a little past what is
 * drawn, as it always has: a thumb on the rim of the knob means the knob.
 */
export function controlAt(state: GameState, x: number, y: number): Control | null {
  const l = consoleLayout(state.stageW, state.stageH, state.stageTop)
  let best: Control | null = null
  let bestD = Infinity
  for (const control of CONTROLS) {
    const spot = l[control]
    const reach = spot.r * (control === 'bop' ? 1.2 : 1.45)
    const d = Math.hypot(x - spot.x, y - spot.y)
    if (d <= reach && d / reach < bestD) {
      best = control
      bestD = d / reach
    }
  }
  return best
}

/**
 * The player did something. Right control in time scores; anything else ends the run.
 *
 * Nothing counts in the pause between an answer and the next call. It used to:
 * the answered call was still up, so working the same control again scored it
 * again and started the pause over, and mashing one control scored for ever.
 */
export function act(state: GameState, control: Control): GameState {
  if (state.phase !== 'call' || !state.call || state.gap > 0) return state

  // What you did makes its own sound, right or wrong.
  sfx(CONTROL_SOUND[control], 1)

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
      shake: 0.45,
      overFor: 0,
    }
  }

  const quick = state.timer >= state.window * QUICK_FRACTION
  const gained = quick ? 2 : 1
  const streak = state.streak + 1
  const pops: Pop[] = [
    ...state.pops,
    { control, text: `+${gained}`, tone: quick ? 'quick' : 'plain', life: POP_LIFE, max: POP_LIFE },
  ]
  if (streak % STREAK_STEP === 0) {
    const life = POP_LIFE * 1.8
    pops.push({ control: 'bop', text: `${streak} in a row`, tone: 'streak', life, max: life })
    sfx('perfect')
  } else if (quick) {
    // A bright ping over the control's own sound for the quick point.
    sfx('hit', 5)
  }
  return {
    ...state,
    score: state.score + gained,
    streak,
    call: state.call,
    timer: 0,
    gap: GAP,
    window: Math.max(MIN_WINDOW, Math.min(state.window, FIRST_WINDOW) * SHRINK),
    pressed: control,
    pressLife: PRESS_LIFE,
    lastGain: gained,
    pops: pops.slice(-6),
    spinAngle: control === 'spin' ? state.spinAngle + Math.PI * 2 : state.spinAngle,
    twistAngle: control === 'twist' ? state.twistAngle + Math.PI / 2 : state.twistAngle,
  }
}

/**
 * Where the lever is, just after a Pull it was answered: let go (`off`),
 * still held on its way down (`down`), or down at the cherry (`bottom`).
 * While it's held the toy waits, and held at the cherry for JACKPOT_HOLD the
 * jackpot comes up (in `tick`), once a run. Let go sooner, and the next call
 * comes as it would have.
 */
export function holdLever(state: GameState, at: 'off' | 'down' | 'bottom'): GameState {
  if (at === 'off') return state.lever ? { ...state, lever: null } : state
  const lever = state.lever
  if (!lever && (state.phase !== 'call' || state.call !== 'pull' || state.gap <= 0 || state.jackpotDone)) return state
  const bottom = at === 'bottom' ? Math.max(0, lever?.bottom ?? 0) : -1
  if (lever && lever.bottom === bottom) return state
  return { ...state, lever: { held: lever?.held ?? 0, bottom } }
}

export function tick(state: GameState, dt: number): GameState {
  const s = { ...state }
  if (s.lever && s.phase === 'call') {
    const lever = { held: s.lever.held + dt, bottom: s.lever.bottom < 0 ? -1 : s.lever.bottom + dt }
    s.lever = lever.held >= LEVER_WAIT ? null : lever
    if (lever.bottom >= JACKPOT_HOLD) {
      s.lever = null
      s.reels = JACKPOT_TIME
      s.jackpotDone = true
      s.gap = Math.max(s.gap, JACKPOT_TIME)
    }
  }
  if (s.reels > 0) {
    const before = s.reels
    s.reels = Math.max(0, s.reels - dt)
    const spun = (r: number) => JACKPOT_TIME - r
    // The reels clatter round, then land with a jingle.
    if (spun(s.reels) < REELS_SPIN && Math.floor(spun(s.reels) / 0.09) > Math.floor(spun(before) / 0.09)) sfx('tap')
    if (spun(before) < REELS_SPIN && spun(s.reels) >= REELS_SPIN) {
      sfx('perfect')
      s.pops = [...s.pops, { control: 'pull', text: 'Jackpot!', tone: 'streak', life: POP_LIFE * 1.8, max: POP_LIFE * 1.8 }]
    }
  }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.shake = Math.max(0, s.shake - dt)
  s.pressLife = Math.max(0, s.pressLife - dt)
  if (s.pressLife <= 0 && s.phase !== 'gameover') s.pressed = null
  if (s.pops.length) {
    s.pops = s.pops.map((p) => ({ ...p, life: p.life - dt })).filter((p) => p.life > 0)
  }
  if (s.phase === 'gameover') s.overFor += dt

  if (s.phase !== 'call') return s

  if (s.gap > 0) {
    // The toy waits while the lever is still held.
    if (!s.lever) s.gap -= dt
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
      shake: 0.35,
      overFor: 0,
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
    overFor: s.overFor,
  }
}
