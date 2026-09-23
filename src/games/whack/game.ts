import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Phase = 'menu' | 'playing' | 'gameover'

export type TargetKind = 'normal' | 'gold'

/**
 * A bubble. `rise` is how blown up it is, 0 to 1.
 *
 * Bubbles used to come up on nine fixed pads in a grid. They float now: each
 * one blows up somewhere on the field, drifts upward with a little sway, and
 * bounces off the field's edges. Where it is lives here, as a share of the
 * field, so a resize carries it along; `bubbleSpot` turns that into pixels.
 */
export type Target = {
  kind: TargetKind
  hue: number
  age: number
  life: number
  rise: number
  hit: boolean
  hitAge: number
  /** Where it is, as a share of the field across and down. */
  fx: number
  fy: number
  /** How it drifts, in bubble radii a second. */
  vx: number
  vy: number
  /** Its size against the standard bubble. */
  size: number
  /** Where it is in its sway. */
  sway: number
}

/**
 * A slot a bubble can occupy. There are nine, so no more than nine can ever
 * be up; the slot says nothing about where a bubble is.
 */
export type Pad = {
  id: number
  target: Target | null
}

export type FloaterTone = 'plain' | 'center' | 'gold' | 'lost'

/** A word rising from where a bubble was: what a pop paid, or a streak going. */
export type Floater = {
  id: number
  /** Where, as a share of the stage. */
  u: number
  v: number
  hue: number
  text: string
  tone: FloaterTone
  life: number
  max: number
}

/**
 * What a bubble leaves: a pop, a centre pop, a gold one, a fizzle when it goes
 * unpopped, and the last few bursting when the clock runs out.
 */
export type BurstKind = 'pop' | 'center' | 'gold' | 'fizzle' | 'end'

export type Burst = {
  id: number
  /** Where, as a share of the stage, and how big the bubble was in standard radii. */
  u: number
  v: number
  size: number
  kind: BurstKind
  hue: number
  age: number
  life: number
  /** Scatters the droplets differently every time. */
  seed: number
}

/** A tap that found no bubble, as a share of the stage so a resize keeps it in place. */
export type Tap = {
  u: number
  v: number
  age: number
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  timeLeft: number
  streak: number
  centerStreakBest: number
  hits: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  timeLeft: number
  streak: number
  /** Consecutive perfect-center hits (resets on miss or off-center). */
  centerStreak: number
  /** Peak center streak this run. */
  centerStreakBest: number
  hits: number
  pads: Pad[]
  spawnTimer: number
  floaters: Floater[]
  bursts: Burst[]
  taps: Tap[]
  scale: number
  /** The stage's size, so bubbles can drift in their own radii without being handed it. */
  stageW: number
  stageH: number
  /**
   * Where the page's own score and buttons end, so the field starts below
   * them. Nothing sets it outside the game itself, so anything else drawing
   * this field gets the whole canvas.
   */
  stageTop: number
}

export const DESIGN_W = 540
export const DESIGN_H = 720
/** The field splits three by three for the number keys: 1 top left, 9 bottom right. */
export const PAD_COLS = 3
export const PAD_ROWS = 3
export const PAD_COUNT = PAD_COLS * PAD_ROWS
/** @deprecated use PAD_COUNT */
export const HOLE_COUNT = PAD_COUNT

export const PAD_INNER = 0.42

/** The colours bubbles come in. Gold is its own; nothing plain is near it. */
const BUBBLE_HUES = [198, 172, 348, 272, 128, 236]
const ROUND_SECS = 45
const SCORE_HIT = 10
const SCORE_CENTER = 30
const SCORE_GOLD = 25
const SCORE_GOLD_CENTER = 70
const STREAK_BONUS = 5
const STREAK_BONUS_CAP = 20
const HIT_RISE = 0.16
/** A streak this long is worth telling the player they have lost. */
const STREAK_WORTH = 3

const BURST_LIFE: Record<BurstKind, number> = {
  pop: 0.45,
  center: 0.6,
  gold: 0.65,
  fizzle: 0.35,
  end: 0.5,
}

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
    centerStreak: 0,
    centerStreakBest: 0,
    hits: 0,
    pads: emptyPads(),
    spawnTimer: 0.4,
    floaters: [],
    bursts: [],
    taps: [],
    scale: 1,
    stageW: DESIGN_W,
    stageH: DESIGN_H,
    stageTop: 0,
  }
}

export function startGame(prev: GameState): GameState {
  return {
    ...createInitialState(),
    best: Math.max(prev.best, loadBest()),
    phase: 'playing',
    spawnTimer: 0.18,
    stageW: prev.stageW,
    stageH: prev.stageH,
    stageTop: prev.stageTop,
  }
}

export function setScale(state: GameState, w: number, h: number, top = state.stageTop): GameState {
  const scale = Math.min(w / DESIGN_W, h / DESIGN_H) || 1
  return { ...state, scale, stageW: w, stageH: h, stageTop: top }
}

/* ---- The field. ---- */

/**
 * Where bubbles can be, fitted to the stage.
 *
 * The stage fills the screen, so the field is held to a size of its own: the
 * whole width of a phone below the page's strip, a generous square on a desk.
 * It keeps a tenth of the canvas clear on every side, as the old pad grid did;
 * the home page's cabinets, which draw this same field, count on that.
 */
export function fieldRect(w: number, h: number, top = 0) {
  const availW = w * 0.8
  const availTop = Math.max(top + 8, h * 0.1)
  const availH = Math.max(1, h * 0.92 - availTop)
  const fw = Math.min(availW, 620)
  const fh = Math.min(availH, 600)
  return { x: (w - fw) / 2, y: availTop + (availH - fh) / 2, w: fw, h: fh }
}

/**
 * A standard bubble's radius: what a pad's used to be, about 36px on a phone,
 * so a bubble is no easier to catch than a pad was.
 */
export function bubbleRadius(w: number, h: number, top = 0) {
  const f = fieldRect(w, h, top)
  return Math.max(22, Math.min(56, Math.min(f.w, f.h) * 0.12))
}

/** The middle of one of the nine key zones: 1 top left, 9 bottom right. */
export function padLayout(
  id: number,
  w: number,
  h: number,
  top = 0,
): { x: number; y: number; r: number } {
  const f = fieldRect(w, h, top)
  const col = id % PAD_COLS
  const row = Math.floor(id / PAD_COLS)
  return {
    x: f.x + (f.w / PAD_COLS) * (col + 0.5),
    y: f.y + (f.h / PAD_ROWS) * (row + 0.5),
    r: bubbleRadius(w, h, top),
  }
}

export function holeCenter(id: number, w: number, h: number) {
  return padLayout(id, w, h)
}

export function padDisc(rise: number, r: number) {
  const live = rise > 0.04
  return r * (live ? 0.72 + rise * 0.28 : 0.78)
}

/** How far a bubble sways either side, in its own radii. */
const SWAY = 0.14

/**
 * Where a bubble is on screen and how big it looks right now: its drift, its
 * sway and how far it is blown up. Drawing and hitting both use this, so what
 * you see is exactly what you can hit.
 */
export function bubbleSpot(target: Target, w: number, h: number, top = 0) {
  const f = fieldRect(w, h, top)
  const R = bubbleRadius(w, h, top) * target.size
  return {
    x: f.x + target.fx * f.w + Math.sin(target.age * 3.1 + target.sway) * R * SWAY,
    y: f.y + target.fy * f.h,
    r: padDisc(target.rise, R),
  }
}

function liveTarget(target: Target | null) {
  return target != null && !target.hit && target.rise >= HIT_RISE
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

/** Drift picks up a little as the round goes on. */
function driftSpeed(elapsed: number) {
  const t = Math.min(1, elapsed / ROUND_SECS)
  return 0.9 + t * 0.6
}

/**
 * Somewhere on the field for a new bubble: clear of the edges and clear of
 * every bubble already up. Null when there is no such place right now.
 */
function findRoom(state: GameState, size: number): { fx: number; fy: number } | null {
  const f = fieldRect(state.stageW, state.stageH, state.stageTop)
  const R = bubbleRadius(state.stageW, state.stageH, state.stageTop)
  const mx = Math.min(0.45, (R * size * 1.25) / f.w)
  const my = Math.min(0.45, (R * size * 1.25) / f.h)
  // Where pops just happened, so a new bubble does not come up under a burst or the words rising off it.
  const recent = [...state.bursts, ...state.floaters].map((b) => ({
    x: b.u * state.stageW,
    y: b.v * state.stageH,
  }))
  for (let tries = 0; tries < 14; tries++) {
    const fx = mx + Math.random() * (1 - mx * 2)
    const fy = my + Math.random() * (1 - my * 2)
    const clearOfBubbles = state.pads.every((p) => {
      const t = p.target
      if (!t) return true
      const dx = (t.fx - fx) * f.w
      const dy = (t.fy - fy) * f.h
      return Math.hypot(dx, dy) > R * (t.size + size) * 1.25
    })
    const px = f.x + fx * f.w
    const py = f.y + fy * f.h
    // The words rise above the spot, so the clearance reaches further up than down.
    const clearOfPops = recent.every((p) => Math.hypot(px - p.x, (py - p.y) * (py < p.y ? 0.7 : 1.2)) > R * 2)
    if (clearOfBubbles && (clearOfPops || tries > 9)) return { fx, fy }
  }
  return null
}

function spawnTarget(state: GameState, elapsed: number): GameState {
  const up = state.pads.filter((p) => p.target && !p.target.hit).length
  if (up >= maxUp(elapsed)) return { ...state, spawnTimer: 0.12 }
  const free = state.pads.filter((p) => !p.target)
  if (!free.length) return { ...state, spawnTimer: 0.12 }

  const gold = Math.random() < 0.12
  // Gold comes a touch smaller and quicker, as it always went quicker.
  const size = gold ? 0.88 : 0.88 + Math.random() * 0.24
  const room = findRoom(state, size)
  if (!room) return { ...state, spawnTimer: 0.12 }

  const slot = free[Math.floor(Math.random() * free.length)]!.id
  const speed = driftSpeed(elapsed) * (gold ? 1.25 : 1)
  const heading = -Math.PI / 2 + (Math.random() - 0.5) * 1.4
  const target: Target = {
    kind: gold ? 'gold' : 'normal',
    hue: gold ? 42 : BUBBLE_HUES[Math.floor(Math.random() * BUBBLE_HUES.length)]!,
    age: 0,
    life: targetLife(elapsed) * (gold ? 0.85 : 1),
    rise: 0,
    hit: false,
    hitAge: 0,
    fx: room.fx,
    fy: room.fy,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    size,
    sway: Math.random() * Math.PI * 2,
  }
  const pads = state.pads.map((p) => (p.id === slot ? { ...p, target } : p))
  return { ...state, pads, spawnTimer: spawnInterval(elapsed) }
}

/** Carry a bubble along its drift, turning it back off the field's edges. */
function drift(state: GameState, t: Target, dt: number): Target {
  const f = fieldRect(state.stageW, state.stageH, state.stageTop)
  const R = bubbleRadius(state.stageW, state.stageH, state.stageTop) * t.size
  const mx = Math.min(0.45, R / f.w)
  const my = Math.min(0.45, R / f.h)
  let fx = t.fx + (t.vx * R * dt) / f.w
  let fy = t.fy + (t.vy * R * dt) / f.h
  let { vx, vy } = t
  if (fx < mx || fx > 1 - mx) {
    vx = -vx
    fx = Math.max(mx, Math.min(1 - mx, fx))
  }
  if (fy < my || fy > 1 - my) {
    vy = -vy
    fy = Math.max(my, Math.min(1 - my, fy))
  }
  return { ...t, fx, fy, vx, vy }
}

/* ---- Play. ---- */

export function hitAt(state: GameState, x: number, y: number, w: number, h: number): GameState {
  if (state.phase !== 'playing') return state

  let hitId: number | null = null
  let bestDist = Infinity
  for (const pad of state.pads) {
    if (!liveTarget(pad.target)) continue
    const spot = bubbleSpot(pad.target!, w, h, state.stageTop)
    const d = Math.hypot(x - spot.x, y - spot.y)
    if (d <= spot.r * 1.06 && d < bestDist) {
      bestDist = d
      hitId = pad.id
    }
  }
  if (hitId == null) {
    // Nothing there: no cost, as ever, but the tap is shown landing.
    const taps = [...state.taps, { u: x / Math.max(1, w), v: y / Math.max(1, h), age: 0 }].slice(-4)
    return { ...state, taps }
  }
  return hitPad(state, hitId, w, h, bestDist)
}

/**
 * A number key: pops the bubble nearest the middle of that ninth of the field.
 * Keys cannot aim, so they never score a centre, as they never could.
 */
export function hitHole(state: GameState, zone: number, w: number, h: number): GameState {
  if (state.phase !== 'playing') return state
  const f = fieldRect(w, h, state.stageTop)
  const col = zone % PAD_COLS
  const row = Math.floor(zone / PAD_COLS)
  let best: number | null = null
  let bestD = Infinity
  for (const pad of state.pads) {
    if (!liveTarget(pad.target)) continue
    const spot = bubbleSpot(pad.target!, w, h, state.stageTop)
    const inCol = Math.min(PAD_COLS - 1, Math.floor(((spot.x - f.x) / f.w) * PAD_COLS))
    const inRow = Math.min(PAD_ROWS - 1, Math.floor(((spot.y - f.y) / f.h) * PAD_ROWS))
    if (inCol !== col || inRow !== row) continue
    const zc = padLayout(zone, w, h, state.stageTop)
    const d = Math.hypot(spot.x - zc.x, spot.y - zc.y)
    if (d < bestD) {
      bestD = d
      best = pad.id
    }
  }
  return best == null ? state : hitPad(state, best, w, h)
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
  const spot = bubbleSpot(target, w, h, state.stageTop)
  const center = dist != null && dist <= spot.r * PAD_INNER
  const gold = target.kind === 'gold'
  const base = gold
    ? center
      ? SCORE_GOLD_CENTER
      : SCORE_GOLD
    : center
      ? SCORE_CENTER
      : SCORE_HIT
  sfx(center ? 'perfect' : gold ? 'good' : 'hit')
  const streak = state.streak + 1
  const centerStreak = center ? state.centerStreak + 1 : 0
  const centerStreakBest = Math.max(state.centerStreakBest, centerStreak)
  const bonus = Math.min(STREAK_BONUS_CAP, Math.max(0, (streak - 1) * STREAK_BONUS))
  const points = base + bonus
  const floatLife = center ? 1 : 0.8
  const u = spot.x / Math.max(1, w)
  const v = spot.y / Math.max(1, h)
  const R = bubbleRadius(w, h, state.stageTop)

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
        u,
        v,
        hue: target.hue,
        text: center ? `CENTER +${points}` : `+${points}`,
        tone: center ? 'center' : gold ? 'gold' : 'plain',
        life: floatLife,
        max: floatLife,
      } satisfies Floater,
    ].slice(-8),
    bursts: [
      ...state.bursts,
      burst(u, v, spot.r / R, center ? 'center' : gold ? 'gold' : 'pop', target.hue),
    ].slice(-12),
    score: state.score + points,
    streak,
    centerStreak,
    centerStreakBest,
    hits: state.hits + 1,
  }
}

function burst(u: number, v: number, size: number, kind: BurstKind, hue: number): Burst {
  return { id: uid(), u, v, size, kind, hue, age: 0, life: BURST_LIFE[kind], seed: Math.random() * 1000 }
}

/** A burst where a bubble is now, for the ones that go without a tap. */
function burstFor(state: GameState, t: Target, kind: BurstKind): Burst {
  const w = state.stageW
  const h = state.stageH
  const spot = bubbleSpot(t, w, h, state.stageTop)
  return burst(spot.x / w, spot.y / h, spot.r / bubbleRadius(w, h, state.stageTop), kind, t.hue)
}

export function tick(state: GameState, dt: number): GameState {
  let s = { ...state }
  if (s.floaters.length) {
    s.floaters = s.floaters.map((f) => ({ ...f, life: f.life - dt })).filter((f) => f.life > 0)
  }
  if (s.bursts.length) {
    s.bursts = s.bursts.map((b) => ({ ...b, age: b.age + dt })).filter((b) => b.age < b.life)
  }
  if (s.taps.length) {
    s.taps = s.taps.map((t) => ({ ...t, age: t.age + dt })).filter((t) => t.age < 0.35)
  }

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
    target = drift(s, target, dt)
    if (target.age < target.life * 0.6) {
      target.rise = Math.min(1, target.rise + dt * 9)
    } else {
      target.rise = Math.max(0, target.rise - dt * 4.2)
      if (target.rise <= 0.08) {
        pads.push({ ...pad, target: null })
        // Let go unpopped: it fizzles, and a streak worth having says so.
        const gone = burstFor(s, target, 'fizzle')
        s.bursts = [...s.bursts, gone].slice(-12)
        if (s.streak >= STREAK_WORTH) {
          s.floaters = [
            ...s.floaters,
            {
              id: uid(),
              u: gone.u,
              v: gone.v,
              hue: target.hue,
              text: 'streak lost',
              tone: 'lost',
              life: 0.9,
              max: 0.9,
            } satisfies Floater,
          ].slice(-8)
        }
        s.streak = 0
        s.centerStreak = 0
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
    // Whatever is still up bursts on the bell.
    const last = s.pads.filter((p) => p.target && !p.target.hit).map((p) => burstFor(s, p.target!, 'end'))
    return {
      ...s,
      phase: 'gameover',
      best,
      pads: emptyPads(),
      bursts: [...s.bursts, ...last].slice(-16),
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
    centerStreakBest: s.centerStreakBest,
    hits: s.hits,
  }
}
