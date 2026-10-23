import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'
import { starChime } from './chime'

/*
 * Fireflies: a pond at dusk, and fireflies over it that each glow in a colour
 * and sing a note of their own. A run is a string of nights. Each night hangs
 * five paper lanterns across the sky and every tune got right lights one; with
 * all five lit the lanterns ring out, and the next night brings a newcomer or
 * more trading of places.
 *
 * Every round is a tune: the fireflies sing it and you tap it back. It
 * carries on from night to night, a note longer every time, and a slip in it
 * ends the run. From the second night some of them trade places
 * before a tune, so a note has to be followed by its colour and its sound,
 * not its spot.
 *
 * Now and then a shooting star crosses the sky over the pond, and a tap on it
 * catches it: an easter egg, with nothing in it for the score.
 *
 * Everything positional is kept in the field's own units (0 to 1 across the
 * patch of water the fireflies keep to), so a resize moves nothing, and the
 * renderer, the taps and the home page's pilot all ask `flySpot` where a
 * firefly is.
 */

export type Phase =
  | 'menu'
  /** A beat before a tune, and a new night's name on the pond. */
  | 'intro'
  /** A tune: the fireflies sing it. */
  | 'watch'
  /** A tune: tap it back. */
  | 'input'
  /** A tune got right: its lantern lights. */
  | 'win'
  /** Every lantern lit: they ring out, one by one, and the night ends. */
  | 'chime'
  /** A tune slipped: the run is over. */
  | 'fail'
  | 'gameover'

/** Fireflies at the start of a run. */
export const START_FLIES = 4
export const MAX_FLIES = 6
/** Lanterns on a night's string: one for each tune got right, and a full string ends the night. */
export const LANTERNS = 5
/** Notes in the first tune; every tune after is one longer, night after night. */
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
const WIN_TIME = 1.15
/** The lanterns ring this far apart when a night's string is full. */
export const CHIME_GAP = 0.2
const FAIL_TIME = 2
/** How long after a slip the fireflies scatter and the lanterns start to go out. */
const SCATTER_AFTER = 0.75
const FIRST_REST = 0.9

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
  /** 0 to 1: the red of a wrong tap on it. */
  wrong: number
  /** Set on the one that should have been tapped when a tune slips: it circles itself. */
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
/** A shooting star, in pixels: where it flares up, where it burns out, and when it set off. */
export type Star = { x0: number; y0: number; x1: number; y1: number; t0: number }
/** Where a caught star burst into sparkles, in pixels, and when. */
export type StarBurst = { x: number; y: number; t: number }

export type GameState = {
  phase: Phase
  /** Seconds since the state began, for everything that moves. */
  time: number
  timer: number
  score: number
  best: number
  /** The night, from 1. */
  night: number
  /** Tunes played this night. */
  played: number
  /** Whether the coming tune has been set up: its trades made, its notes dealt. */
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
  /** What the pond is doing, in a word or two. */
  message: string
  ripples: Ripple[]
  sparks: Spark[]
  taps: Tap[]
  /**
   * The easter egg: a shooting star crossing the sky, and the sparkles of the
   * last one caught. The page sends them (`shootStar`) with its own dice; the
   * home page's preview never does, so its seeded runs never see one.
   */
  star: Star | null
  starBurst: StarBurst | null
  /** When the next star is due, by `time`; 0 till a run has asked for one. */
  nextStar: number
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
  /** Tunes got right over the run. */
  tunes: number
  /** Notes in the tune being played, or the next one. */
  tune: number
  /** Notes tapped back so far. */
  entered: number
  /** Lanterns lit tonight. */
  lanterns: number
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

/** How far fireflies drift from their spot, in pixels: a little further as the run goes on, up to DRIFT_MOST units. */
const DRIFT_MOST = 16
function driftAmp(s: GameState, unit: number) {
  return (7 + Math.min(DRIFT_MOST - 7, s.tunes * 0.9)) * unit
}

/** How near a tap has to land to a firefly to reach it, in pixels. */
function flyReach(unit: number) {
  return Math.max(34, 48 * unit)
}

/** Where a firefly is on the screen, and how near a tap has to land to catch it. */
export function flySpot(s: GameState, f: Fly, layout = pondLayout(s.stageW, s.stageH, s.stageTop)) {
  const [u, v] = flyUV(s, f)
  const { field, unit } = layout
  const amp = driftAmp(s, unit)
  const x = field.x + u * field.w + Math.sin(s.time * 0.9 + f.phase) * amp + Math.sin(s.time * 2.3 + f.phase * 2) * 2 * unit
  const y = field.y + v * field.h + Math.sin(s.time * 1.25 + f.phase * 1.7) * amp * 0.75
  return { x, y, r: flyReach(unit) }
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
    night: 1,
    played: 0,
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
    message: '',
    ripples: [],
    sparks: [],
    taps: [],
    star: null,
    starBurst: null,
    nextStar: 0,
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

/**
 * Set up the coming tune and hold a moment before it: a newcomer at the start
 * of a night, trades before a tune, the tune dealt one note longer.
 */
function beginRound(s: GameState): GameState {
  const flies = s.flies.map((f) => ({ ...f, hint: 0 }))
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

  const trades = nightStart ? 0 : tuneTrades(s.night, s.played)
  if (trades > 0) {
    tradePlaces(s, flies, trades, SWAP_TIME)
    intro = SWAP_INTRO
    message = trades === 1 ? 'Two trade places' : 'They trade places'
    sfx('whoosh')
  }
  const len = FIRST_TUNE + s.tunes
  const seq = s.seq.slice()
  while (seq.length < len) seq.push(Math.floor(Math.random() * flies.length))
  // A newcomer sings the new note, so it is heard the night it arrives.
  if (joined >= 0) seq[len - 1] = joined

  return {
    ...s,
    flies,
    seq,
    watchIdx: 0,
    inputIdx: 0,
    phase: 'intro',
    ready: true,
    timer: intro,
    message,
  }
}

/** A tune got right: its lantern lights. */
function lightLantern(s: GameState): GameState {
  sfx('good')
  const lit = Math.min(LANTERNS, s.lit + 1)
  return {
    ...s,
    lit,
    litAt: [...s.litAt, s.time + 0.25],
    phase: 'win',
    timer: WIN_TIME,
    message: lit >= LANTERNS ? 'Every lantern lit' : 'A lantern lights',
  }
}

/** After a tune: the night's next, or with the string full, the lanterns ring. */
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
  return beginRound({ ...s, ready: false })
}

/** A new night: a fresh string of lanterns, and its first tune. */
function nextNight(state: GameState): GameState {
  const night = state.night + 1
  return beginRound({
    ...state,
    night,
    played: 0,
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

/** `pairs` pairs of fireflies trade places at once, none of them in two trades. */
function tradePlaces(s: GameState, flies: Fly[], pairs: number, dur: number) {
  const free = flies.slice()
  const take = () => free.splice(Math.floor(Math.random() * free.length), 1)[0]!
  for (let i = 0; i < pairs && free.length >= 2; i++) tradePair(s, take(), take(), dur)
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
  return lightLantern({ ...s, tunes: s.tunes + 1 })
}

/** A key, 1 to 6 as 0 to 5: each firefly keeps its number wherever it flies. */
export function pressKey(state: GameState, n: number): GameState {
  return tapFly(state, n)
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
  if (s.star && s.time - s.star.t0 > STAR_TIME) s.star = null
  if (s.starBurst && s.time - s.starBurst.t > STAR_BURST_TIME) s.starBurst = null

  if (s.phase === 'menu' || s.phase === 'gameover' || s.phase === 'input') return s
  s.timer -= dt
  switch (s.phase) {
    case 'intro':
      if (s.timer > 0) return s
      return s.ready ? { ...s, phase: 'watch', timer: 0.15, message: 'Watch' } : beginRound(s)
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
    tunes: s.tunes,
    tune: s.seq.length || FIRST_TUNE + s.tunes,
    entered: s.inputIdx,
    lanterns: s.lit,
    message: s.message,
  }
}

/* ---- The shooting star, the easter egg. ---- */

/** How long a shooting star takes to cross, and how long a caught one's sparkles last. */
export const STAR_TIME = 1.2
export const STAR_BURST_TIME = 0.9
/** A tap where the star's head was this long ago still catches it: the eye is always a little behind. */
const STAR_LAG = 0.15

/** Seconds of a run till the next shooting star, for a roll of the dice: 40 to 90, so one is a treat. */
function starGap(roll: number) {
  return 40 + roll * 50
}

/** How near a tap has to land to a shooting star to catch it, in pixels: a fingertip and then some. */
function starReach(L: Layout) {
  return 42 * clamp(L.unit, 0.85, 1.3)
}

/**
 * The band of sky a shooting star's head keeps to, in pixels: under the
 * page's score, over the pines on the far bank (render.ts's treeline stands
 * up to 64 of its lifts), and so far above the fireflies' patch that no tap
 * can reach a star and a firefly both, however far they drift.
 */
function starSky(L: Layout) {
  const pines = L.bank - 66 * (L.unit * 0.9 + 0.1)
  const flies = L.field.y - DRIFT_MOST * L.unit * 0.75 - flyReach(L.unit) - starReach(L) - 6
  return { top: L.top + 8, bottom: Math.min(pines, flies) }
}

/** Where a star's head is, `age` seconds after it set off: it crosses at an even speed. */
export function starHead(star: Star, age: number) {
  const k = clamp(age / STAR_TIME, 0, 1)
  return { x: star.x0 + (star.x1 - star.x0) * k, y: star.y0 + (star.y1 - star.y0) * k }
}

/**
 * Whether a star may set off now. Never so it would cross while the fireflies
 * sing a tune or fly to new places, which are both for watching: so while a
 * tune is tapped back, or in a pause between tunes with time enough left for
 * it to cross.
 */
function skyFree(s: GameState) {
  switch (s.phase) {
    case 'input':
      return true
    case 'intro':
    case 'win':
    case 'chime':
      return s.timer >= STAR_TIME && !s.flies.some((f) => f.trip)
    default:
      return false
  }
}

/**
 * The sky, a frame at a time: once a run is under way a shooting star is due
 * every so often, and when one is and the sky is free, it sets off across it.
 * `rand` is the page's dice; the home page's preview never calls this, so its
 * seeded runs never see these draws. A stage too short to have sky enough
 * lets a star go by unseen.
 */
export function shootStar(state: GameState, rand: () => number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover' || state.phase === 'fail') return state
  if (!state.nextStar) return { ...state, nextStar: state.time + starGap(rand()) }
  if (state.time < state.nextStar || state.star || !skyFree(state)) return state
  const s: GameState = { ...state, nextStar: state.time + starGap(rand()) }
  const L = pondLayout(s.stageW, s.stageH, s.stageTop)
  const sky = starSky(L)
  const room = sky.bottom - sky.top
  if (room < 30) return s
  // Slanting down, 10 to 27 degrees, a short stretch of sky: longer on a bigger pond, never further than the sky goes.
  const slope = 0.18 + rand() * 0.3
  const len = Math.min((190 + rand() * 120) * clamp(L.unit, 0.85, 1.3), L.w * 0.7, room / Math.sin(slope))
  const dx = len * Math.cos(slope)
  const dy = len * Math.sin(slope)
  const x = L.w * 0.1 + rand() * Math.max(0, L.w * 0.8 - dx)
  const y = sky.top + rand() * (room - dy)
  const star: Star =
    rand() < 0.5 ? { x0: x, y0: y, x1: x + dx, y1: y + dy, t0: s.time } : { x0: x + dx, y0: y, x1: x, y1: y + dy, t0: s.time }
  return { ...s, star }
}

/**
 * A tap on the stage, in pixels, that lands on a shooting star, at its head or
 * just behind it where the eye still sees it: the star is caught, and bursts
 * into sparkles with a chime. Null when it's no catch, and the tap goes on to
 * the fireflies. The sky the stars cross is kept out of their reach, but a tap
 * that could reach a firefly is the firefly's all the same. A catch is worth
 * nothing to the score.
 */
export function catchStar(state: GameState, x: number, y: number): GameState | null {
  const star = state.star
  if (!star || state.phase === 'menu' || state.phase === 'gameover' || state.phase === 'fail') return null
  const age = state.time - star.t0
  if (age > STAR_TIME) return null
  const L = pondLayout(state.stageW, state.stageH, state.stageTop)
  const head = starHead(star, age)
  if (toSegment(x, y, starHead(star, age - STAR_LAG), head) > starReach(L)) return null
  for (const f of state.flies) {
    const spot = flySpot(state, f, L)
    if (Math.hypot(spot.x - x, spot.y - y) <= spot.r) return null
  }
  starChime()
  return { ...state, star: null, starBurst: { x: head.x, y: head.y, t: state.time } }
}

/* ---- Helpers. ---- */

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}

/** How far a point is from the line between `a` and `b`. */
function toSegment(x: number, y: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const k = dx || dy ? clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1) : 0
  return Math.hypot(a.x + dx * k - x, a.y + dy * k - y)
}

function easeInOut(t: number) {
  const k = Math.max(0, Math.min(1, t))
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}

export function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
