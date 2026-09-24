import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

/*
 * Fireflies: a pond at dusk, and fireflies over it that each glow in a colour
 * and sing a note of their own. A run is a string of nights. Each night hangs
 * five paper lanterns across the sky and every round you win lights one; with
 * all five lit the lanterns ring out, and the next night brings a newcomer or
 * a new trick.
 *
 * A night is made of three kinds of round:
 * - A tune: the fireflies sing it and you tap it back. It carries on from
 *   night to night, a note longer every time, and a slip in it ends the run.
 * - Catch: for eight seconds they blink on at random; tap each one while it's
 *   lit. Enough catches light the lantern.
 * - Follow: one glows gold, then they all go pale and trade places; tap the
 *   one you followed.
 * A Catch or a Follow that goes wrong costs only its lantern, and the night
 * plays on until the string is full.
 *
 * Everything positional is kept in the field's own units (0 to 1 across the
 * patch of water the fireflies keep to), so a resize moves nothing, and the
 * renderer, the taps and the home page's pilot all ask `flySpot` where a
 * firefly is.
 */

export type Phase =
  | 'menu'
  /** A beat before a round, its name on the pond: a tune, a Catch, a Follow, a new night. */
  | 'intro'
  /** A tune: the fireflies sing it. */
  | 'watch'
  /** A tune: tap it back. */
  | 'input'
  /** Catch: tap them while they're lit. */
  | 'catch'
  /** Follow: the one to follow glows gold. */
  | 'show'
  /** Follow: they go pale and trade places. */
  | 'swirl'
  /** Follow: tap the one you followed. */
  | 'pick'
  /** A round won: its lantern lights. */
  | 'win'
  /** A Catch or a Follow that went wrong: no lantern, and on to the next round. */
  | 'lost'
  /** Every lantern lit: they ring out, one by one, and the night ends. */
  | 'chime'
  /** A tune slipped: the run is over. */
  | 'fail'
  | 'gameover'

/** What a round asks of you. */
export type Kind = 'tune' | 'catch' | 'follow'

/** Fireflies at the start of a run. */
export const START_FLIES = 4
export const MAX_FLIES = 6
/** Lanterns on a night's string: one for each round won, and a full string ends the night. */
export const LANTERNS = 5
/** Notes in the first tune; every tune after is one longer, night after night. */
export const FIRST_TUNE = 3
/** How long a Catch lasts, and the catches that light its lantern. */
export const CATCH_TIME = 8
export const CATCH_GOAL = 8
/** Taps on a dark firefly that end a Catch early, so it can't be won by tapping everything. */
export const CATCH_MISSES = 3
/** What finding the firefly you followed is worth. */
export const FOLLOW_POINTS = 3

/*
 * The order of a night's rounds: three tunes, a Catch and a Follow, dealt out
 * differently from one night to the next. A lost Catch or Follow leaves its
 * lantern dark, and the night goes on round its plan until all five are lit.
 */
const PLANS: readonly (readonly Kind[])[] = [
  ['tune', 'tune', 'catch', 'tune', 'follow'],
  ['tune', 'catch', 'tune', 'follow', 'tune'],
  ['tune', 'follow', 'tune', 'catch', 'tune'],
]

/** The round a night plays after `played` rounds of it. */
export function kindOf(night: number, played: number): Kind {
  const plan = PLANS[(night - 1) % PLANS.length]!
  return plan[played % plan.length]!
}

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
 * the fifth and sixth, who join later, take the middle. In a Follow the keys
 * go by these places, not by firefly.
 */
const SLOTS: readonly (readonly [number, number])[] = [
  [0.15, 0.09],
  [0.85, 0.06],
  [0.19, 0.66],
  [0.82, 0.68],
  [0.5, 0.36],
  [0.5, 0.93],
]

/** How long a tune's notes last, shorter as the tune grows. */
export function noteLength(len: number) {
  return Math.max(0.24, 0.46 - len * 0.018)
}
const NOTE_GAP = 0.13
const INTRO = 0.55
const NIGHT_INTRO = 1.9
const JOIN_INTRO = 1.8
const SWAP_INTRO = 1.5
const SWAP_TIME = 1.25
const JOIN_TIME = 1.5
const CATCH_INTRO = 1.6
const FOLLOW_INTRO = 1.3
/** How long the one to follow glows gold. */
const SHOW_TIME = 1.4
/** The fade to pale before the first trade. */
const PALE_TIME = 0.45
const WIN_TIME = 1.15
const LOST_TIME = 1.5
/** The lanterns ring this far apart when a night's string is full. */
export const CHIME_GAP = 0.2
const FAIL_TIME = 2
/** How long after a slip the fireflies scatter and the lanterns start to go out. */
const SCATTER_AFTER = 0.75
const FIRST_REST = 0.9

/** How long a firefly stays lit in a Catch: shorter every night. */
export function catchWindow(night: number) {
  return Math.max(0.5, 0.95 - 0.11 * (night - 1))
}

/** How many trades a Follow makes, and how quick each is: more and quicker every night. */
function followTrades(night: number) {
  return Math.min(7, 2 + night)
}
function followTradeTime(night: number) {
  return Math.max(0.55, 1.05 - 0.1 * (night - 1))
}

/** Pairs that trade places before a tune: none the first night, one a tune after, two from the fourth. */
function tuneTrades(night: number, tuneOfNight: number) {
  if (night <= 1) return 0
  if (night === 2) return tuneOfNight === 0 ? 0 : 1
  return night === 3 ? 1 : 2
}

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
  /** Catch: seconds it stays lit and catchable; 0 when it's dark. */
  open: number
  /** How long its catch window was when it opened, for the ring that closes on it. */
  window: number
  /** 0 to 1: the red of a wrong tap on it. */
  wrong: number
  /** Set on the one that should have been tapped, when a tune slips or a Follow is lost: it circles itself. */
  hint: number
  /** When it arrived, for fading in. */
  born: number
  /** Its own offset in the drift, so no two drift together. */
  phase: number
  /** Flying from somewhere to its slot. */
  trip: Trip | null
  /** When it scattered at the end of a run; 0 until then. */
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
  /** The night, from 1. */
  night: number
  /** Rounds played this night, won or lost. */
  played: number
  /** The round under way, or the one about to start. */
  kind: Kind
  /** Whether the coming round has been set up: its trades made, its tune dealt. */
  ready: boolean
  /** Tunes got right over the whole run. */
  tunes: number
  /** The tune: firefly ids, in order. It only ever grows. */
  seq: number[]
  watchIdx: number
  inputIdx: number
  flies: Fly[]
  /** This night's lanterns lit, and when each lit. */
  lit: number
  litAt: number[]
  /** When a full string began to ring, and how many have rung. */
  chimeAt: number
  chimed: number
  /** When the lanterns begin to go out after a slip; 0 until then. */
  dimAt: number
  scattered: boolean
  /** Catch: when it ends, when the next firefly lights, the last to light, catches and misses. */
  catchEnd: number
  nextFlash: number
  lastFlash: number
  caught: number
  misses: number
  /** Follow: the firefly to follow, the trades still to come, and the one tapped. */
  target: number
  trades: number
  picked: number
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
  night: number
  kind: Kind
  /** Tunes got right over the run. */
  tunes: number
  /** Notes in the tune being played, or the next one. */
  tune: number
  /** Notes tapped back so far. */
  entered: number
  /** Lanterns lit tonight. */
  lanterns: number
  caught: number
  message: string
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

/** How far fireflies drift from their spot, in pixels: a little further as the run goes on. */
function driftAmp(s: GameState, unit: number) {
  return (7 + Math.min(9, s.tunes * 0.9)) * unit
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

/** Whether the fireflies are pale, all alike, so the one being followed has to be kept track of by eye. */
export function isPale(s: GameState) {
  return s.phase === 'swirl' || s.phase === 'pick'
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
    open: 0,
    window: 0,
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
    night: 1,
    played: 0,
    kind: kindOf(1, 0),
    ready: false,
    tunes: 0,
    seq: [],
    watchIdx: 0,
    inputIdx: 0,
    flies,
    lit: 0,
    litAt: [],
    chimeAt: 0,
    chimed: 0,
    dimAt: 0,
    scattered: false,
    catchEnd: 0,
    nextFlash: 0,
    lastFlash: -1,
    caught: 0,
    misses: 0,
    target: -1,
    trades: 0,
    picked: -1,
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

/** A fresh run, the pond already set, the first night about to begin. */
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
    message: 'Night 1',
  }
}

/** Tunes already played tonight, which is every tune before this round: a slipped one ends the run. */
function tunesTonight(s: GameState) {
  let n = 0
  for (let i = 0; i < s.played; i++) if (kindOf(s.night, i) === 'tune') n++
  return n
}

/**
 * Set up the coming round and hold on its name for a moment: a newcomer at the
 * start of a night, trades before a tune, a tune dealt one note longer.
 */
function beginRound(s: GameState): GameState {
  const flies = s.flies.map((f) => ({ ...f, hint: 0, open: 0 }))
  let intro = INTRO
  let message = 'Watch'
  let joined = -1
  const nightStart = s.played === 0 && s.night > 1

  if (nightStart) {
    intro = NIGHT_INTRO
    message = `Night ${s.night}`
    if (flies.length < MAX_FLIES) {
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
      intro = Math.max(NIGHT_INTRO, JOIN_INTRO)
      message = `Night ${s.night} · a firefly joins`
      sfx('whoosh')
    }
  }

  let seq = s.seq
  if (s.kind === 'tune') {
    const trades = nightStart ? 0 : tuneTrades(s.night, tunesTonight(s))
    if (trades > 0) {
      tradePlaces(s, flies, trades, SWAP_TIME)
      intro = SWAP_INTRO
      message = 'Two trade places'
      sfx('whoosh')
    }
    const len = FIRST_TUNE + s.tunes
    seq = s.seq.slice()
    while (seq.length < len) seq.push(Math.floor(Math.random() * flies.length))
    // A newcomer sings the new note, so it is heard the night it arrives.
    if (joined >= 0) seq[len - 1] = joined
  } else if (s.kind === 'catch') {
    intro = Math.max(intro, CATCH_INTRO)
    message = nightStart ? `${message} · Catch` : 'Catch them while they’re lit'
  } else {
    intro = Math.max(intro, FOLLOW_INTRO)
    message = nightStart ? `${message} · Follow` : 'Follow the gold one'
  }

  return {
    ...s,
    flies,
    seq,
    watchIdx: 0,
    inputIdx: 0,
    caught: 0,
    misses: 0,
    picked: -1,
    phase: 'intro',
    ready: true,
    timer: intro,
    message,
  }
}

/** The round begins in earnest once its name has shown. */
function startRound(s: GameState): GameState {
  if (s.kind === 'tune') return { ...s, phase: 'watch', timer: 0.15, message: 'Watch' }
  if (s.kind === 'catch') {
    return { ...s, phase: 'catch', catchEnd: s.time + CATCH_TIME, nextFlash: s.time + 0.35, lastFlash: -1, message: '' }
  }
  // Follow: one firefly lights gold, the rest wait dim.
  const flies = s.flies.map((f) => ({ ...f }))
  const target = flies[Math.floor(Math.random() * flies.length)]!
  target.flare = 1
  target.hold = SHOW_TIME
  sfx('pad', target.id)
  return { ...s, flies, target: target.id, phase: 'show', timer: SHOW_TIME, message: 'Follow the gold one' }
}

/** A round done: its lantern lights, or doesn't. */
function finishRound(s: GameState, won: boolean, message: string): GameState {
  if (!won) {
    sfx('miss')
    return { ...s, phase: 'lost', timer: LOST_TIME, message }
  }
  sfx('good')
  const lit = Math.min(LANTERNS, s.lit + 1)
  return {
    ...s,
    lit,
    litAt: [...s.litAt, s.time + 0.25],
    phase: 'win',
    timer: WIN_TIME,
    message: lit >= LANTERNS ? 'Every lantern lit' : message,
  }
}

/** After a round: the night's next, or with the string full, the lanterns ring. */
function nextRound(state: GameState): GameState {
  const s = { ...state, played: state.played + 1 }
  if (s.lit >= LANTERNS) {
    return {
      ...s,
      phase: 'chime',
      chimeAt: s.time + 0.2,
      chimed: 0,
      timer: 0.2 + LANTERNS * CHIME_GAP + 1,
      message: `Night ${s.night} · the lanterns ring`,
    }
  }
  return beginRound({ ...s, kind: kindOf(s.night, s.played), ready: false })
}

/** A new night: a fresh string of lanterns, and the first round of its plan. */
function nextNight(state: GameState): GameState {
  const night = state.night + 1
  return beginRound({
    ...state,
    night,
    played: 0,
    kind: kindOf(night, 0),
    ready: false,
    lit: 0,
    litAt: [],
    chimeAt: 0,
    chimed: 0,
  })
}

/** Two fireflies fly to each other's places, round each other rather than through. */
function tradePair(s: GameState, a: Fly, b: Fly, dur: number) {
  const [ua, va] = flyUV(s, a)
  const [ub, vb] = flyUV(s, b)
  a.trip = { u: ua, v: va, t0: s.time, dur, bend: 0.28 }
  b.trip = { u: ub, v: vb, t0: s.time, dur, bend: 0.28 }
  const slot = a.slot
  a.slot = b.slot
  b.slot = slot
}

/**
 * `pairs` pairs of fireflies trade places at once, none of them in two
 * trades. `keep`, when given, is a firefly that is in the first pair more
 * often than not, so the one being followed doesn't just sit still.
 */
function tradePlaces(s: GameState, flies: Fly[], pairs: number, dur: number, keep = -1) {
  const free = flies.slice()
  const take = (prefer = -1) => {
    const at = prefer >= 0 && free.some((f) => f.id === prefer) ? free.findIndex((f) => f.id === prefer) : Math.floor(Math.random() * free.length)
    return free.splice(at, 1)[0]!
  }
  for (let i = 0; i < pairs && free.length >= 2; i++) {
    const a = take(i === 0 && keep >= 0 && Math.random() < 0.65 ? keep : -1)
    const b = take()
    tradePair(s, a, b, dur)
  }
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

/** A firefly tapped (or its key pressed) while a tune is being tapped back. */
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
  if (s.inputIdx < s.seq.length) return s
  return finishRound({ ...s, tunes: s.tunes + 1 }, true, 'A lantern lights')
}

/** A firefly tapped in a Catch: caught while it's lit, a miss while it's dark. */
export function catchFly(state: GameState, id: number): GameState {
  if (state.phase !== 'catch') return state
  const s: GameState = { ...state }
  const flies = s.flies.map((f) => ({ ...f }))
  s.flies = flies
  const fly = flies.find((f) => f.id === id)
  if (!fly) return state
  if (fly.open > 0) {
    fly.open = 0
    sing(s, flies, id, 0.12)
    s.caught += 1
    s.score += 1
    return s
  }
  fly.wrong = 1
  s.misses += 1
  if (s.misses >= CATCH_MISSES) {
    for (const f of flies) f.open = 0
    return finishRound(s, false, 'Too many misses · no lantern')
  }
  sfx('tap')
  return s
}

/** The firefly tapped at the end of a Follow. */
export function pickFly(state: GameState, id: number): GameState {
  if (state.phase !== 'pick') return state
  const s: GameState = { ...state, picked: id }
  const flies = s.flies.map((f) => ({ ...f }))
  s.flies = flies
  if (id === s.target) {
    sing(s, flies, id, 0.5)
    s.score += FOLLOW_POINTS
    return finishRound(s, true, 'Found it · a lantern lights')
  }
  const fly = flies.find((f) => f.id === id)
  if (fly) fly.wrong = 1
  const right = flies.find((f) => f.id === s.target)
  if (right) {
    right.hint = 1
    right.flare = 1
    right.hold = 0.6
  }
  return finishRound(s, false, 'Lost it · no lantern')
}

/**
 * A key, 1 to 6 as 0 to 5. In a tune or a Catch each firefly keeps its
 * number wherever it flies; at the end of a Follow, when the fireflies are
 * pale and alike, the numbers go by place instead.
 */
export function pressKey(state: GameState, n: number): GameState {
  if (state.phase === 'input') return tapFly(state, n)
  if (state.phase === 'catch') return catchFly(state, n)
  if (state.phase === 'pick') {
    const fly = state.flies.find((f) => f.slot === n)
    return fly ? pickFly(state, fly.id) : state
  }
  return state
}

/** A tap on the pond, in the stage's pixels: the nearest firefly within reach, if any. */
export function tapAt(state: GameState, x: number, y: number): GameState {
  const taps = [...state.taps, { x, y, t: state.time }]
  if (state.phase !== 'input' && state.phase !== 'catch' && state.phase !== 'pick') return { ...state, taps }
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
  if (!best) return s
  if (s.phase === 'input') return tapFly(s, best.id)
  if (s.phase === 'catch') return catchFly(s, best.id)
  return pickFly(s, best.id)
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

/** The Catch's clock: fireflies light up at random, one or two at a time, until time's up. */
function tickCatch(s: GameState): GameState {
  if (s.time >= s.catchEnd) {
    s.flies = s.flies.map((f) => ({ ...f, open: 0 }))
    const won = s.caught >= CATCH_GOAL
    return finishRound(s, won, won ? `Caught ${s.caught} · a lantern lights` : `Caught ${s.caught} of ${CATCH_GOAL} · no lantern`)
  }
  const lit = s.flies.filter((f) => f.open > 0).length
  if (s.time < s.nextFlash || lit >= 2 || s.time > s.catchEnd - 0.35) return s
  const dark = s.flies.filter((f) => f.open <= 0 && !f.trip)
  const fresh = dark.filter((f) => f.id !== s.lastFlash)
  const pool = fresh.length ? fresh : dark
  if (!pool.length) return s
  const pick = pool[Math.floor(Math.random() * pool.length)]!
  const window = catchWindow(s.night)
  s.flies = s.flies.map((f) => (f.id === pick.id ? { ...f, open: window, window, flare: 1, hold: window } : f))
  s.lastFlash = pick.id
  s.nextFlash = s.time + 0.42 + Math.random() * 0.3
  return s
}

export function tick(state: GameState, dt: number): GameState {
  const s: GameState = { ...state, time: state.time + dt }
  let changed = false
  for (const f of s.flies) {
    if (f.flare > 0 || f.hold > 0 || f.open > 0 || f.wrong > 0 || (f.trip && s.time - f.trip.t0 >= f.trip.dur)) {
      changed = true
      break
    }
  }
  if (changed) {
    s.flies = s.flies.map((f) => {
      const next = { ...f }
      if (next.hold > 0) next.hold = Math.max(0, next.hold - dt)
      else next.flare = Math.max(0, next.flare - dt * 2.6)
      if (next.open > 0) next.open = Math.max(0, next.open - dt)
      next.wrong = Math.max(0, next.wrong - dt * 0.9)
      if (next.trip && s.time - next.trip.t0 >= next.trip.dur) next.trip = null
      return next
    })
  }
  if (s.ripples.length && s.time - s.ripples[0]!.t > 1.4) s.ripples = s.ripples.filter((r) => s.time - r.t <= 1.4)
  if (s.sparks.length) s.sparks = s.sparks.filter((p) => s.time - p.t <= p.life)
  if (s.taps.length && s.time - s.taps[0]!.t > 0.5) s.taps = s.taps.filter((t) => s.time - t.t <= 0.5)

  if (s.phase === 'menu' || s.phase === 'gameover' || s.phase === 'input' || s.phase === 'pick') return s
  if (s.phase === 'catch') return tickCatch(s)
  s.timer -= dt
  switch (s.phase) {
    case 'intro':
      if (s.timer > 0) return s
      return s.ready ? startRound(s) : beginRound(s)
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
    case 'show':
      if (s.timer > 0) return s
      return { ...s, phase: 'swirl', timer: PALE_TIME, trades: followTrades(s.night), message: 'Keep your eye on it' }
    case 'swirl': {
      if (s.timer > 0) return s
      if (s.trades <= 0) return { ...s, phase: 'pick', message: 'Which one was it?' }
      const flies = s.flies.map((f) => ({ ...f }))
      const dur = followTradeTime(s.night)
      // From the third night, now and then two pairs trade at once.
      const pairs = s.night >= 3 && flies.length >= 4 && Math.random() < 0.5 ? 2 : 1
      tradePlaces(s, flies, pairs, dur, s.target)
      if (s.trades === followTrades(s.night)) sfx('whoosh')
      return { ...s, flies, trades: s.trades - 1, timer: dur + 0.06 }
    }
    case 'win':
    case 'lost':
      return s.timer > 0 ? s : nextRound(s)
    case 'chime': {
      // The lanterns ring along the string, a note and a point each.
      while (s.chimed < LANTERNS && s.time >= s.chimeAt + s.chimed * CHIME_GAP) {
        sfx('pad', s.chimed)
        s.chimed += 1
        s.score += 1
      }
      return s.timer > 0 ? s : nextNight(s)
    }
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
    night: s.night,
    kind: s.kind,
    tunes: s.tunes,
    tune: s.seq.length || FIRST_TUNE + s.tunes,
    entered: s.inputIdx,
    lanterns: s.lit,
    caught: s.caught,
    message: s.message,
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
