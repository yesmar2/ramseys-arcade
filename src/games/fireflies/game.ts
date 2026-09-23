import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

/*
 * Fireflies: a pond at dusk, and fireflies over it that each glow in a colour
 * and sing a note of their own. They play a tune; you tap it back. Every tune
 * you get right lights the next lantern on the string across the sky, and the
 * next tune is one note longer.
 *
 * What makes it more than a row of pads: the fireflies drift, a fifth and a
 * sixth fly in as the night goes on, and from the fourth tune two of them
 * trade places every so often, so what you remember has to be which firefly
 * sang, not where it was.
 *
 * Everything positional is kept in the field's own units (0 to 1 across the
 * patch of water the fireflies keep to), so a resize moves nothing, and the
 * renderer, the taps and the home page's pilot all ask `flySpot` where a
 * firefly is.
 */

export type Phase = 'menu' | 'intro' | 'watch' | 'input' | 'win' | 'fail' | 'gameover'

/** Fireflies at the start of a night. */
export const START_FLIES = 4
export const MAX_FLIES = 6
/** Lanterns on the string: one lights for each tune you get right. */
export const LANTERNS = 11
/** Notes in the first tune; every tune after is one longer. */
export const FIRST_TUNE = 3

/*
 * Each firefly keeps its colour and its note wherever it flies: the six notes
 * of the pentatonic scale the sound packs already play for a pad, so any tune
 * sounds like one. `light` is its glow, `line` its outline, in the house
 * palette.
 */
export const FLY_COLORS = [
  { line: '#f5b942', light: '#ffd66e' },
  { line: '#3ecf8e', light: '#7ef2bf' },
  { line: '#4aa8e8', light: '#8fd2ff' },
  { line: '#e85d9a', light: '#ff9ccb' },
  { line: '#8a6ad4', light: '#c5adff' },
  { line: '#3ec8cf', light: '#8af3f7' },
] as const

/*
 * Where fireflies hover, in field units. The first four keep to the corners;
 * the fifth and sixth, who join later, take the middle.
 */
const SLOTS: readonly (readonly [number, number])[] = [
  [0.15, 0.09],
  [0.85, 0.06],
  [0.19, 0.66],
  [0.82, 0.68],
  [0.5, 0.36],
  [0.5, 0.93],
]

/** The tunes after which a new firefly flies in. */
const JOIN_AFTER = [2, 5]

/** How long a tune's notes last, shorter as the tune grows. */
export function noteLength(len: number) {
  return Math.max(0.24, 0.46 - len * 0.018)
}
const NOTE_GAP = 0.13
const INTRO = 0.55
const JOIN_INTRO = 1.8
const SWAP_INTRO = 1.5
const SWAP_TIME = 1.25
const JOIN_TIME = 1.5
const WIN_TIME = 1.15
const FAIL_TIME = 2
/** How long after a slip the fireflies scatter and the lanterns start to go out. */
const SCATTER_AFTER = 0.75
const FIRST_REST = 0.9

type Trip = { u: number; v: number; t0: number; dur: number; bend: number }

export type Fly = {
  /** 0 to 5: its colour, its note and its key. */
  id: number
  /** Which of SLOTS it hovers at; two that trade places trade slots. */
  slot: number
  /** 0 to 1: how brightly it is lit. */
  flare: number
  /** Seconds its light holds at full before fading. */
  hold: number
  /** 0 to 1: the red of a wrong tap on it. */
  wrong: number
  /** Set on the one that should have been tapped, when a tune slips: it circles itself. */
  hint: number
  /** When it arrived, for fading in. */
  born: number
  /** Its own offset in the drift, so no two drift together. */
  phase: number
  /** Flying from somewhere to its slot. */
  trip: Trip | null
  /** When it scattered at the end of a night; 0 until then. */
  gone: number
  du: number
  dv: number
}

/** A ring on the water under a firefly that sang, in field units. */
export type Ripple = { id: number; u: number; v: number; t: number }
/** A mote of light thrown off a firefly that sang, in field units. */
export type Spark = { id: number; u: number; v: number; du: number; dv: number; t: number; life: number }
/** Where a tap landed, in pixels, for its ring. */
export type Tap = { x: number; y: number; t: number }

export type GameState = {
  phase: Phase
  /** Seconds since the state began, for everything that moves. */
  time: number
  timer: number
  score: number
  best: number
  /** Tunes got right this night. */
  round: number
  /** The tune: firefly ids, in order. */
  seq: number[]
  watchIdx: number
  inputIdx: number
  flies: Fly[]
  /** Lanterns lit, and when each lit. */
  lit: number
  litAt: number[]
  /** When the lanterns begin to go out after a slip; 0 until then. */
  dimAt: number
  scattered: boolean
  /** What the pond is doing, in a word or two. */
  message: string
  ripples: Ripple[]
  sparks: Spark[]
  taps: Tap[]
  stageW: number
  stageH: number
  /** Where the page's own score and buttons end, so the scene hangs below them. */
  stageTop: number
}

export type Snapshot = {
  phase: Phase
  score: number
  best: number
  round: number
  /** Notes in the tune being played. */
  tune: number
  /** Notes tapped back so far. */
  entered: number
  message: string
  lanterns: number
}

/* ---- Where things are. ---- */

export type Layout = {
  w: number
  h: number
  top: number
  /** The far bank: sky above, pond below. */
  bank: number
  /** The patch of water the fireflies keep to. */
  field: { x: number; y: number; w: number; h: number }
  /** How big the pond's things are drawn, 1 on a phone. */
  unit: number
  /** The lantern string: a curve from one side to the other. */
  string: { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number }
}

/**
 * The pond fitted to a stage. The sky takes the top, under the page's own
 * score; the fireflies keep to a patch of the water no wider than it is deep
 * and a half, so on a desk they gather in the middle of a wide pond instead of
 * spreading to its ends.
 */
export function pondLayout(w: number, h: number, top = 0): Layout {
  const bank = Math.round(Math.max(top + h * 0.2, h * 0.43))
  const water = Math.max(1, h - bank)
  const fh = water * 0.62
  const fw = Math.min(w * 0.72, fh * 1.5)
  const unit = Math.max(0.5, Math.min(1.5, Math.min(fw, fh * 1.1) / 290))
  const y0 = top + 18
  const sag = Math.max(24, Math.min(80, h * 0.075))
  return {
    w,
    h,
    top,
    bank,
    field: { x: (w - fw) / 2, y: bank + water * 0.06, w: fw, h: fh },
    unit,
    string: { x0: -12, y0: y0 + 4, cx: w / 2, cy: y0 + sag * 2, x1: w + 12, y1: y0 },
  }
}

/** Where a firefly is hovering: its slot, or where it is on its way. */
function flyUV(s: GameState, f: Fly): [number, number] {
  const slot = SLOTS[f.slot] ?? SLOTS[0]!
  let u = slot[0]
  let v = slot[1]
  if (f.trip) {
    const t = easeInOut((s.time - f.trip.t0) / f.trip.dur)
    const du = u - f.trip.u
    const dv = v - f.trip.v
    const d = Math.hypot(du, dv) || 1
    const cu = (f.trip.u + u) / 2 - (dv / d) * f.trip.bend
    const cv = (f.trip.v + v) / 2 + (du / d) * f.trip.bend
    const k = 1 - t
    u = k * k * f.trip.u + 2 * k * t * cu + t * t * u
    v = k * k * f.trip.v + 2 * k * t * cv + t * t * v
  }
  if (f.gone) {
    const g = s.time - f.gone
    u += f.du * g
    v += f.dv * g - 0.22 * g * g
  }
  return [u, v]
}

/** How far fireflies drift from their spot, in pixels: a little further as the night goes on. */
function driftAmp(s: GameState, unit: number) {
  return (7 + Math.min(9, s.round * 0.9)) * unit
}

/** Where a firefly is on the screen, and how near a tap has to land to catch it. */
export function flySpot(s: GameState, f: Fly, layout = pondLayout(s.stageW, s.stageH, s.stageTop)) {
  const [u, v] = flyUV(s, f)
  const { field, unit } = layout
  const amp = driftAmp(s, unit)
  const x = field.x + u * field.w + Math.sin(s.time * 0.9 + f.phase) * amp + Math.sin(s.time * 2.3 + f.phase * 2) * 2 * unit
  const y = field.y + v * field.h + Math.sin(s.time * 1.25 + f.phase * 1.7) * amp * 0.75
  return { x, y, r: Math.max(34, 48 * unit) }
}

/** How far below a firefly its light shows in the water. */
export function reflectionDrop(unit: number) {
  return 60 * unit
}

/* ---- The night. ---- */

function loadBest() {
  return getPersonalBest('fireflies')
}

function newFly(id: number, time: number): Fly {
  return {
    id,
    slot: id,
    flare: 0,
    hold: 0,
    wrong: 0,
    hint: 0,
    born: time,
    phase: hash(id * 7 + 3) * Math.PI * 2,
    trip: null,
    gone: 0,
    du: 0,
    dv: 0,
  }
}

export function createInitialState(w = 390, h = 700): GameState {
  const flies: Fly[] = []
  for (let i = 0; i < START_FLIES; i++) flies.push(newFly(i, -1))
  return {
    phase: 'menu',
    time: 0,
    timer: 0,
    score: 0,
    best: loadBest(),
    round: 0,
    seq: [],
    watchIdx: 0,
    inputIdx: 0,
    flies,
    lit: 0,
    litAt: [],
    dimAt: 0,
    scattered: false,
    message: '',
    ripples: [],
    sparks: [],
    taps: [],
    stageW: w,
    stageH: h,
    stageTop: 0,
  }
}

export function setScale(state: GameState, w: number, h: number, top = state.stageTop): GameState {
  return { ...state, stageW: w, stageH: h, stageTop: top }
}

/** A fresh night, the pond already set, the first tune on its way. */
export function startGame(prev: GameState): GameState {
  const s = createInitialState(prev.stageW, prev.stageH)
  const flies = s.flies.map((f) => ({ ...f, born: prev.time }))
  return {
    ...s,
    time: prev.time,
    best: Math.max(prev.best, loadBest()),
    stageTop: prev.stageTop,
    flies,
    phase: 'intro',
    timer: FIRST_REST,
    message: 'Get ready',
  }
}

function beginRound(s: GameState): GameState {
  const r = s.round
  const flies = s.flies.map((f) => ({ ...f }))
  let intro = INTRO
  let message = 'Watch'
  let joined = -1
  if (JOIN_AFTER.includes(r) && flies.length < MAX_FLIES) {
    joined = flies.length
    const fly = newFly(joined, s.time)
    // In from over the far bank, on the right.
    const L = pondLayout(s.stageW, s.stageH, s.stageTop)
    fly.trip = {
      u: (L.w + 40 - L.field.x) / L.field.w,
      v: (L.bank - 60 * L.unit - L.field.y) / L.field.h,
      t0: s.time,
      dur: JOIN_TIME,
      bend: -0.25,
    }
    flies.push(fly)
    intro = JOIN_INTRO
    message = 'A firefly joins'
    sfx('whoosh')
  } else if (r === 3 || (r >= 6 && r % 2 === 0) || r >= 10) {
    swap(s, flies)
    intro = SWAP_INTRO
    message = 'Two trade places'
    sfx('whoosh')
  }
  const len = FIRST_TUNE + r
  const seq = s.seq.slice()
  while (seq.length < len) seq.push(Math.floor(Math.random() * flies.length))
  // A newcomer sings the new note, so it is heard the night it arrives.
  if (joined >= 0) seq[len - 1] = joined
  return { ...s, flies, seq, watchIdx: 0, inputIdx: 0, phase: 'intro', timer: intro, message }
}

/** Two fireflies fly to each other's places, round each other rather than through. */
function swap(s: GameState, flies: Fly[]) {
  const n = flies.length
  const a = Math.floor(Math.random() * n)
  const b = (a + 1 + Math.floor(Math.random() * (n - 1))) % n
  const fa = flies[a]!
  const fb = flies[b]!
  const [ua, va] = flyUV(s, fa)
  const [ub, vb] = flyUV(s, fb)
  fa.trip = { u: ua, v: va, t0: s.time, dur: SWAP_TIME, bend: 0.28 }
  fb.trip = { u: ub, v: vb, t0: s.time, dur: SWAP_TIME, bend: 0.28 }
  const slot = fa.slot
  fa.slot = fb.slot
  fb.slot = slot
}

/** A firefly lights up and sings its note. */
function sing(s: GameState, flies: Fly[], id: number, hold: number) {
  const fly = flies.find((f) => f.id === id)
  if (!fly) return
  fly.flare = 1
  fly.hold = hold
  sfx('pad', fly.id)
  const [u, v] = flyUV(s, fly)
  s.ripples = [...s.ripples, { id, u, v, t: s.time }]
  const sparks = s.sparks.slice()
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = 0.06 + Math.random() * 0.13
    sparks.push({ id, u, v, du: Math.cos(a) * sp, dv: Math.sin(a) * sp - 0.08, t: s.time, life: 0.7 + Math.random() * 0.5 })
  }
  s.sparks = sparks
}

/** A firefly tapped (or its key pressed) while it's your turn. */
export function tapFly(state: GameState, id: number): GameState {
  if (state.phase !== 'input') return state
  if (!state.flies.some((f) => f.id === id)) return state
  const s: GameState = { ...state }
  const flies = s.flies.map((f) => ({ ...f }))
  s.flies = flies
  const want = s.seq[s.inputIdx]
  if (id !== want) {
    // The wrong one goes red, not its own colour, so there's no mistaking what happened.
    const fly = flies.find((f) => f.id === id)!
    fly.flare = 0
    fly.hold = 0
    fly.wrong = 1
    const right = flies.find((f) => f.id === want)
    if (right) right.hint = 1
    sfx('miss')
    s.best = Math.max(s.best, s.score)
    s.phase = 'fail'
    s.timer = FAIL_TIME
    s.dimAt = s.time + SCATTER_AFTER
    s.message = 'The tune slipped'
    return s
  }
  sing(s, flies, id, 0.2)
  s.inputIdx += 1
  s.score += 1
  if (s.inputIdx >= s.seq.length) {
    s.round += 1
    if (s.lit < LANTERNS) {
      s.litAt = [...s.litAt, s.time + 0.25]
      s.lit += 1
    }
    sfx('good')
    s.phase = 'win'
    s.timer = WIN_TIME
    s.message = s.round === 1 ? 'A lantern lights' : 'Another lantern'
  }
  return s
}

/** A tap on the pond, in the stage's pixels: the nearest firefly within reach, if any. */
export function tapAt(state: GameState, x: number, y: number): GameState {
  const taps = [...state.taps, { x, y, t: state.time }]
  if (state.phase !== 'input') return { ...state, taps }
  const layout = pondLayout(state.stageW, state.stageH, state.stageTop)
  let best: Fly | null = null
  let bestD = Infinity
  for (const f of state.flies) {
    const spot = flySpot(state, f, layout)
    const d = Math.hypot(spot.x - x, spot.y - y)
    if (d <= spot.r && d < bestD) {
      bestD = d
      best = f
    }
  }
  const s = { ...state, taps }
  return best ? tapFly(s, best.id) : s
}

function scatter(s: GameState) {
  s.scattered = true
  s.flies = s.flies.map((f) => {
    const [u, v] = flyUV(s, f)
    const a = Math.atan2(v - 0.45, u - 0.5) + (Math.random() - 0.5) * 0.6
    const sp = 0.5 + Math.random() * 0.3
    return { ...f, du: Math.cos(a) * sp, dv: Math.sin(a) * sp - 0.2, gone: s.time }
  })
}

export function tick(state: GameState, dt: number): GameState {
  const s: GameState = { ...state, time: state.time + dt }
  let changed = false
  for (const f of s.flies) {
    if (f.flare > 0 || f.hold > 0 || f.wrong > 0 || (f.trip && s.time - f.trip.t0 >= f.trip.dur)) {
      changed = true
      break
    }
  }
  if (changed) {
    s.flies = s.flies.map((f) => {
      const next = { ...f }
      if (next.hold > 0) next.hold = Math.max(0, next.hold - dt)
      else next.flare = Math.max(0, next.flare - dt * 2.6)
      next.wrong = Math.max(0, next.wrong - dt * 0.9)
      if (next.trip && s.time - next.trip.t0 >= next.trip.dur) next.trip = null
      return next
    })
  }
  if (s.ripples.length && s.time - s.ripples[0]!.t > 1.4) s.ripples = s.ripples.filter((r) => s.time - r.t <= 1.4)
  if (s.sparks.length) s.sparks = s.sparks.filter((p) => s.time - p.t <= p.life)
  if (s.taps.length && s.time - s.taps[0]!.t > 0.5) s.taps = s.taps.filter((t) => s.time - t.t <= 0.5)

  if (s.phase === 'menu' || s.phase === 'gameover' || s.phase === 'input') return s
  s.timer -= dt
  switch (s.phase) {
    case 'intro':
      if (s.timer > 0) return s
      // The night's first tune is set here; later ones were set as their round began.
      if (s.seq.length < FIRST_TUNE + s.round) return beginRound(s)
      return { ...s, phase: 'watch', timer: 0.15, message: 'Watch' }
    case 'watch': {
      if (s.timer > 0) return s
      const len = s.seq.length
      if (s.watchIdx >= len) return { ...s, phase: 'input', inputIdx: 0, message: 'Your turn' }
      const flies = s.flies.map((f) => ({ ...f }))
      s.flies = flies
      sing(s, flies, s.seq[s.watchIdx]!, noteLength(len))
      s.watchIdx += 1
      s.timer = noteLength(len) + NOTE_GAP
      return s
    }
    case 'win':
      return s.timer > 0 ? s : beginRound(s)
    case 'fail':
      if (!s.scattered && s.time >= s.dimAt) scatter(s)
      if (s.timer <= 0) {
        s.phase = 'gameover'
        s.message = ''
      }
      return s
    default:
      return s
  }
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    phase: s.phase,
    score: s.score,
    best: s.best,
    round: s.round,
    tune: s.seq.length,
    entered: s.inputIdx,
    message: s.message,
    lanterns: s.lit,
  }
}

/* ---- Helpers. ---- */

function easeInOut(t: number) {
  const k = Math.max(0, Math.min(1, t))
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}

export function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
