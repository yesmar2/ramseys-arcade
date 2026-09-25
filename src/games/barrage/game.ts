import { sfx } from '../../lib/sound'

/**
 * Barrage — a bullet-curtain shooter.
 *
 * The fleet comes in along curves and throws patterns at you: rings, fans,
 * spirals, walls with a gap in them. You fly a small ship anywhere in the lower
 * field and it fires on its own. Only the bright dot at its heart can be hit,
 * so the game is threading that dot through the curtain.
 *
 * A bullet that brushes past the dot without touching it is grazed: it turns
 * gold, it warms the score's multiplier, and it charges your own Barrage; now
 * and then a broken ship lets go of a pip, a gold diamond that charges a third
 * of one, drifting down until the graze circle catches it. Let
 * the Barrage go and a wave rolls out from the ship that turns every bullet it
 * meets into a star for you — the gold ones worth far more — and hammers every
 * ship it passes. So the most dangerous moment to let it go is also the most
 * rewarding one.
 *
 * The ship's power is not picked up. It comes on a schedule, as waves are
 * cleared and flagships brought down, and a lost ship costs a level of it; the
 * fleet toughens wave after wave to keep pace. Every fifth wave a flagship comes
 * in with phases of patterns of its own.
 *
 * The world is one shape everywhere, three wide by four tall, so a run on a
 * phone and a run on a desktop are the same game. Coordinates are in field
 * widths: x runs 0..1, y runs 0..FIELD_H, down being down.
 *
 * For speed, a tick changes the state it is handed and returns it: a run can
 * have hundreds of bullets in flight, and copying them sixty times a second
 * would be most of the work.
 */

export const STAGE = { w: 3, h: 4 } as const
export const FIELD_H = STAGE.h / STAGE.w

// --------------------------------------------------------------------- ship

/** The one part of the ship that can be hit. */
export const CORE_R = 0.0075
/**
 * A bullet passing this close to the core without touching it is grazed: out
 * to about a wing's length past the wingtips, so a player keeping a sensible
 * gap from the curtain still charges a Barrage now and then.
 */
export const GRAZE_R = 0.07
/** How far the ship reaches, for drawing it and for ramming. */
export const SHIP_W = 0.076
const KEY_SPEED = 0.74
const FOCUS_SPEED = 0.34
/** The fastest the ship follows a finger: quick, but never a teleport. */
const DRAG_SPEED = 2.8
/** The ship keeps to the lower field; the fleet has the top. */
export const SHIP_TOP = 0.3
const SHIP_MARGIN = 0.028
const SHIP_START = { x: 0.5, y: FIELD_H - 0.14 }

const FIRE_EVERY = 0.075
const BOLT_SPEED = 2.2
const NEEDLE_EVERY = 0.16
const NEEDLE_SPEED = 1.5

export const START_LIVES = 3
export const MAX_LIVES = 6
/** Seconds the ship can't be hit after it comes back. */
const SHIELD_TIME = 2.6
const DEATH_PAUSE = 1.5

/** The top power level, and the waves cleared that bring each level. */
export const MAX_POWER = 4
const POWER_AT = [0, 2, 5, 9] as const

// ------------------------------------------------------------------ barrage

export const MAX_STOCK = 3
/** Charge a graze adds toward the next Barrage; a whole Barrage is 1. */
const GRAZE_CHARGE = 0.034
/** Rounds of the wave: how fast it spreads and how far it goes. */
const WAVE_SPEED = 1.9
const WAVE_REACH = 1.85
/** Seconds the ship can't be hit while its Barrage is out, and after. */
const WAVE_SHIELD = 1.35
/** What the wave does to a ship it passes, and to a flagship's phase. */
const WAVE_DAMAGE = 28
const WAVE_BOSS_SHARE = 0.08

/**
 * Pips: once in a while a broken ship lets go of a gold diamond worth a third
 * of a Barrage, which drifts down through the curtain for a few seconds until
 * the graze circle catches it or it fades. One comes due every twenty seconds
 * or so of play, and the next ship broken lets it go; the clock waits while
 * three Barrages are already in hand, and a flagship's phase broken always
 * lets one go.
 */
const PIP_CHARGE = 1 / 3
/** Seconds of play before the first pip is due, and between the ones after it. */
const PIP_FIRST = 10
const PIP_EVERY = [16, 24] as const
/** A pip's size to catch and to draw, how fast it falls, and how long it lasts; it blinks for the last of it. */
export const PIP_R = 0.016
const PIP_FALL = 0.19
const PIP_GRAVITY = 0.6
export const PIP_LIFE = 4.8
export const PIP_BLINK = 1.2

// -------------------------------------------------------------------- score

/**
 * Points. The multiplier — heat — rises with every graze and every ship
 * broken, and cools off when you stop doing either; losing a ship puts it back
 * to one.
 */
export const MAX_HEAT = 3
const HEAT_GRAZE = 0.035
const HEAT_IDLE = 1.6
const HEAT_COOL = 0.35
const SCORE_GRAZE = 3
const SCORE_STAR = 1
const SCORE_GOLD_STAR = 5
const SCORE_WAVE = 100
const SCORE_UNTOUCHED = 100
/**
 * A flagship's phase broken in time, and the flagship brought down. They grow
 * with the first three flagships and hold there, and heat does not touch them,
 * so a long run's flagships never pay out faster than the server's check on a
 * run's points a second allows.
 */
const SCORE_PHASE = 1000
const SCORE_FLAGSHIP = 3000
/** The shortest gap between two hit sounds: a steady tick under the guns rather than a buzz. */
const PLINK_GAP = 0.065
/** Seconds of the wave-clear pause, and how long a banner holds. */
const CLEAR_PAUSE = 2.2
export const BANNER_TIME = 2.4

// ------------------------------------------------------------------ bullets

export type BulletKind = 'orb' | 'rice' | 'big' | 'dart'

/** How a bullet looks and how big it is to hit. */
export type Look = { kind: BulletKind; hue: number; r: number }

export type Bullet = {
  x: number
  y: number
  vx: number
  vy: number
  /** Hit radius. */
  r: number
  kind: BulletKind
  hue: number
  /** Seconds before it starts moving: it flashes in where it will leave from. */
  wait: number
  /** Speed gained each second along its heading, until it reaches `until`. */
  accel: number
  until: number
  /** Turn, in radians a second, for `turnFor` more seconds. */
  turn: number
  turnFor: number
  /** Breaks into a ring after `at` seconds. */
  split: { at: number; n: number; speed: number; look: Look } | null
  grazed: boolean
  age: number
}

/** A round of the ship's own. */
export type Bolt = {
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  /** A needle bends toward the nearest ship. */
  needle: boolean
}

/** A star a Barrage made of a bullet, on its way to the ship. */
export type Star = {
  x: number
  y: number
  vx: number
  vy: number
  worth: number
  gold: boolean
  age: number
}

/** A pip a broken ship let go of: a third of a Barrage, falling. */
export type Pip = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  id: number
}

// ------------------------------------------------------------------ enemies

/**
 * The fleet: the small quick ones in front, the broad ones behind, the tall
 * ones at the back, and the flagship. Each keeps the face it had in the old
 * Barrage; they just fly now.
 */
export type Species = 'octo' | 'crab' | 'squid' | 'queen'

export type SpeciesSpec = {
  /** Drawn width and height. */
  w: number
  h: number
  /** Round the body for hits and ramming. */
  body: number
  hp: number
  points: number
  hue: number
  heat: number
}

export const SPECIES: Record<Species, SpeciesSpec> = {
  octo: { w: 0.082, h: 0.063, body: 0.034, hp: 3, points: 7, hue: 236, heat: 0.02 },
  crab: { w: 0.096, h: 0.072, body: 0.041, hp: 16, points: 35, hue: 259, heat: 0.05 },
  squid: { w: 0.116, h: 0.09, body: 0.05, hp: 46, points: 100, hue: 289, heat: 0.1 },
  queen: { w: 0.34, h: 0.25, body: 0.115, hp: 1, points: 0, hue: 289, heat: 0 },
}

type Vec = { x: number; y: number }

/** One leg of a route: a curve over some seconds, or a hold where the last one ended. */
type Leg =
  | { kind: 'curve'; p0: Vec; p1: Vec; p2: Vec; p3: Vec; dur: number; ease: 'in' | 'out' | 'both' | 'none' }
  | { kind: 'hold'; dur: number; sway: number }

/** What an enemy fires, and when: `times` shots, `every` seconds apart, from `at` seconds after it arrives. */
type Fire = {
  at: number
  every: number
  times: number
  pattern: Pattern
  /** Shots so far, and the time of the next. */
  done: number
  next: number
}

type Pattern =
  | { kind: 'aimed'; n: number; spread: number; speed: number; look: Look; accel?: number; until?: number }
  | { kind: 'ring'; n: number; speed: number; rot: number; spin: number; look: Look; accel?: number; until?: number }
  | { kind: 'fan'; n: number; spread: number; dir: number; sweep: number; speed: number; look: Look }
  | { kind: 'spiral'; arms: number; speed: number; rot: number; spin: number; look: Look; turn?: number }
  | { kind: 'bloom'; n: number; speeds: readonly number[]; rot: number; spin: number; looks: readonly Look[] }
  | { kind: 'wall'; gap: number; speed: number; look: Look; spacing: number }
  | { kind: 'stream'; n: number; gap: number; speed: number; look: Look }
  | { kind: 'burst'; n: number; speed: number; look: Look; after: number; ringN: number; ringSpeed: number; ringLook: Look }

export type Enemy = {
  id: number
  species: Species
  x: number
  y: number
  hp: number
  maxHp: number
  plated: boolean
  worth: number
  /** Seconds since it came on. */
  age: number
  route: Leg[]
  fires: Fire[]
  /** 0–1 flash after a hit. */
  hurt: number
  /** 0–1 glow in its nozzle as it fires. */
  flare: number
  /** Where its route has taken it past the end: it has flown off. */
  gone: boolean
  /** Only a flagship: which phase it is in. */
  phase: number
  /** Last Barrage that struck it, so one wave strikes once. */
  struckBy: number
}

/** A flagship's phase: a name for the banner, how much it takes, how long it lasts, what it fires. */
export type BossPhase = {
  name: string
  hp: number
  limit: number
  hue: number
  fires: () => Fire[]
}

export type Boss = {
  id: number
  number: number
  phases: BossPhase[]
  phase: number
  /** Seconds into the phase, and seconds of the lull between phases left. */
  phaseT: number
  lull: number
  /** 0–1 as the phase's name comes up. */
  title: number
}

/** A squadron on the wave's timetable. */
type Spawn = { at: number; make: () => Enemy }

// ------------------------------------------------------------------ effects

export type Bit = {
  kind: 'shard' | 'spark'
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  hue: number
  size: number
  angle: number
  spin: number
}

export type Ring = { x: number; y: number; r0: number; r1: number; life: number; maxLife: number; hue: number; width: number }

export type FloaterTone = 'score' | 'bonus' | 'graze' | 'warn'

export type Floater = { x: number; y: number; text: string; tone: FloaterTone; life: number; maxLife: number }

export type Banner = { text: string; sub: string; t: number; tone: 'wave' | 'boss' | 'clear' | 'phase' }

export type Phase = 'menu' | 'playing' | 'dying' | 'gameover'

export type Input = {
  /** -1..1 each, from the keys. */
  moveX: number
  moveY: number
  /** Holding the slow key. */
  focus: boolean
  /** Where a finger wants the ship, or null. */
  steer: Vec | null
  /** A Barrage asked for since the last tick. */
  barrage: boolean
}

export type GameState = {
  phase: Phase
  time: number
  score: number
  best: number
  lives: number
  wave: number
  waveT: number
  /** Seconds left of the pause after a wave is cleared. */
  clearing: number
  /** The rest of the wave's timetable. */
  spawns: Spawn[]
  /** A flagship still to come this wave. */
  bossDue: boolean
  enemies: Enemy[]
  boss: Boss | null
  bullets: Bullet[]
  bolts: Bolt[]
  stars: Star[]
  pips: Pip[]
  /** Seconds of play until a pip is due; the next ship broken after that lets it go. */
  pipIn: number
  pipsDropped: number
  pipsCaught: number
  ship: {
    x: number
    y: number
    /** -1..1, leaning into its travel. */
    lean: number
    /** 0–1, how focused the shot is: slow movement or the slow key. */
    focus: number
    /** Seconds left that it can't be hit. */
    shield: number
    fireIn: number
    needleIn: number
  }
  /** 1–4, and the level the waves cleared so far have earned. */
  power: number
  powerEarned: number
  /** Barrages in hand, and the charge toward the next. */
  stock: number
  charge: number
  /** The Barrage wave rolling out, if one is, and what it has turned into stars so far. */
  blast: { x: number; y: number; r: number; id: number; worth: number } | null
  blasts: number
  heat: number
  /** Seconds since the last graze or kill. */
  idle: number
  bestHeat: number
  grazes: number
  kills: number
  missesThisWave: number
  /** What last took a ship: a bullet's look, or the ship it rammed. */
  killedBy: string
  dyingFor: number
  input: Input
  nextId: number
  banner: Banner | null
  // Looks only.
  bits: Bit[]
  rings: Ring[]
  floaters: Floater[]
  shake: number
  flash: number
  /** 0–1 flash as a graze lands, for the core. */
  grazeGlow: number
  /** Grazes in quick succession, for the rising tick. */
  grazeRun: number
  grazeRunT: number
  /** Seconds until a hit may make a sound again. */
  plinkIn: number
}

export type Snapshot = {
  phase: Phase
  score: number
  lives: number
  wave: number
  stock: number
  charge: number
  heat: number
  power: number
  grazes: number
  bestHeat: number
  boss: boolean
}

// --------------------------------------------------------------- the ramp

/** How much faster the fleet's bullets fly by wave. */
function speedK(wave: number) {
  return Math.min(1.55, 1 + 0.045 * (wave - 1))
}

/** How many more bullets each pattern throws by wave. */
function densityK(wave: number) {
  return Math.min(2.1, 1 + 0.075 * (wave - 1))
}

/** How much quicker the fleet fires by wave. */
function rateK(wave: number) {
  return Math.min(1.75, 1 + 0.05 * (wave - 1))
}

/** How much more a ship takes to break by wave. */
function hpK(wave: number) {
  return 1 + 0.16 * (wave - 1)
}

/** Plated ships, with a helmet and more to break, from wave seven, more of them each wave. */
function platedShare(wave: number) {
  return wave < 7 ? 0 : Math.min(0.7, 0.15 + (wave - 7) * 0.06)
}

// ------------------------------------------------------------------ helpers

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function bezier(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

function ease(kind: 'in' | 'out' | 'both' | 'none', t: number) {
  if (kind === 'out') return 1 - (1 - t) ** 2
  if (kind === 'in') return t * t
  if (kind === 'both') return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
  return t
}

/** Where a route has an enemy at `age` seconds, or null once it has flown off the end. */
function routeAt(route: Leg[], age: number, seed: number): Vec | null {
  let t = age
  let last: Vec = { x: 0.5, y: -0.2 }
  for (const leg of route) {
    if (leg.kind === 'curve') {
      if (t <= leg.dur) return bezier(leg.p0, leg.p1, leg.p2, leg.p3, ease(leg.ease, t / leg.dur))
      t -= leg.dur
      last = leg.p3
    } else {
      if (t <= leg.dur) {
        const sway = leg.sway
        return { x: last.x + Math.sin(t * 1.3 + seed) * sway, y: last.y + Math.sin(t * 0.9 + seed * 2) * sway * 0.5 }
      }
      t -= leg.dur
    }
  }
  return null
}

function curve(p0: Vec, p1: Vec, p2: Vec, p3: Vec, dur: number, e: 'in' | 'out' | 'both' | 'none' = 'none'): Leg {
  return { kind: 'curve', p0, p1, p2, p3, dur, ease: e }
}

function hold(dur: number, sway = 0.012): Leg {
  return { kind: 'hold', dur, sway }
}

/** Down from above into a spot, a hold there, and away up and to one side. */
function dropIn(x: number, y: number, holdFor: number, away: number): Leg[] {
  return [
    curve({ x, y: -0.1 }, { x, y: y * 0.4 }, { x, y: y * 0.85 }, { x, y }, 0.9, 'out'),
    hold(holdFor),
    curve({ x, y }, { x, y: y - 0.05 }, { x: x + away * 0.3, y: y - 0.2 }, { x: x + away * 0.6, y: -0.15 }, 1.3, 'in'),
  ]
}

function fire(pattern: Pattern, at: number, every = 1, times = 1): Fire {
  return { at, every, times, pattern, done: 0, next: at }
}

function look(kind: BulletKind, hue: number): Look {
  const r = kind === 'big' ? 0.024 : kind === 'rice' ? 0.0092 : kind === 'dart' ? 0.0082 : 0.0115
  return { kind, hue, r }
}

// The fleet's bullet colours: the site's own, clear of the ship's green.
const RED = 3
const PINK = 334
const ORANGE = 23
const AMBER = 40
const SKY = 204
const TEAL = 183
const VIOLET = 262
const MAGENTA = 289

// ---------------------------------------------------------------- the fleet

function makeEnemy(state: GameState, species: Species, route: Leg[], fires: Fire[], wave: number): Enemy {
  const spec = SPECIES[species]
  const plated = species !== 'queen' && Math.random() < platedShare(wave)
  const hp = Math.round(spec.hp * hpK(wave) * (plated ? 1.8 : 1))
  const start = routeAt(route, 0, 0) ?? { x: 0.5, y: -0.2 }
  return {
    id: state.nextId++,
    species,
    x: start.x,
    y: start.y,
    hp,
    maxHp: hp,
    plated,
    worth: Math.round(spec.points * (plated ? 1.5 : 1)),
    age: 0,
    route,
    fires,
    hurt: 0,
    flare: 0,
    gone: false,
    phase: 0,
    struckBy: -1,
  }
}

type Squadron = (state: GameState, wave: number, t0: number, out: Spawn[]) => void

/** A line of octos sweeping across and back up, each taking one shot as it passes over. */
const octoSweep: Squadron = (state, wave, t0, out) => {
  const fromLeft = Math.random() < 0.5
  const count = 5 + Math.min(4, Math.floor(wave / 2))
  const dip = rand(0.32, 0.5)
  const sx = fromLeft ? -0.08 : 1.08
  const ex = fromLeft ? 1.08 : -0.08
  const n = wave >= 4 ? 3 : 1
  for (let i = 0; i < count; i++) {
    out.push({
      at: t0 + i * 0.26,
      make: () =>
        makeEnemy(
          state,
          'octo',
          [curve({ x: sx, y: 0.1 }, { x: 0.35, y: dip + 0.2 }, { x: 0.65, y: dip + 0.2 }, { x: ex, y: 0.12 }, 3.4 - Math.min(0.9, wave * 0.05))],
          [fire({ kind: 'aimed', n, spread: 0.36, speed: 0.4 * speedK(wave), look: look('dart', RED) }, rand(1.1, 1.9))],
          wave,
        ),
    })
  }
}

/**
 * A long flight of octos on an S across the upper sky: most of them are just
 * there to be shot down, and every third takes one shot.
 */
const octoFlight: Squadron = (state, wave, t0, out) => {
  const fromLeft = Math.random() < 0.5
  const count = 8 + Math.min(4, Math.floor(wave / 2))
  const sx = fromLeft ? -0.1 : 1.1
  const y0 = rand(0.08, 0.16)
  const y1 = y0 + rand(0.14, 0.24)
  for (let i = 0; i < count; i++) {
    const shoots = i % 3 === 1
    out.push({
      at: t0 + i * 0.2,
      make: () =>
        makeEnemy(
          state,
          'octo',
          [curve({ x: sx, y: y0 }, { x: fromLeft ? 0.9 : 0.1, y: y0 - 0.02 }, { x: fromLeft ? 0.1 : 0.9, y: y1 + 0.1 }, { x: 1 - sx, y: y1 }, 4.2 - Math.min(1, wave * 0.06))],
          shoots ? [fire({ kind: 'aimed', n: wave >= 5 ? 3 : 1, spread: 0.3, speed: 0.36 * speedK(wave), look: look('dart', RED) }, rand(1.2, 2.4))] : [],
          wave,
        ),
    })
  }
}

/** Octos dropping into a row, two fans each, then away. */
const octoRow: Squadron = (state, wave, t0, out) => {
  const count = 3 + (wave >= 3 ? 1 : 0) + (wave >= 6 ? 1 : 0)
  const y = rand(0.16, 0.3)
  for (let i = 0; i < count; i++) {
    const x = 0.14 + (0.72 * (i + 0.5)) / count
    const n = Math.round(3 * Math.min(1.7, densityK(wave)))
    out.push({
      at: t0 + i * 0.18,
      make: () =>
        makeEnemy(
          state,
          'octo',
          dropIn(x, y, 2.4, x < 0.5 ? -1 : 1),
          [fire({ kind: 'aimed', n, spread: 0.55, speed: 0.36 * speedK(wave), look: look('orb', ORANGE) }, 1.1, 1.1 / rateK(wave), 2)],
          wave,
        ),
    })
  }
}

/** Two crabs either side, throwing turning rings. */
const crabRings: Squadron = (state, wave, t0, out) => {
  for (const [i, x] of [0.24, 0.76].entries()) {
    const n = Math.round(10 * densityK(wave))
    out.push({
      at: t0 + i * 0.4,
      make: () =>
        makeEnemy(
          state,
          'crab',
          dropIn(x, rand(0.24, 0.34), 4.6, x < 0.5 ? -1 : 1),
          [fire({ kind: 'ring', n, speed: 0.3 * speedK(wave), rot: rand(0, 6.28), spin: 0.13, look: look('orb', i ? PINK : VIOLET) }, 1.0, 1.15 / rateK(wave), 4)],
          wave,
        ),
    })
  }
}

/** A crab in the middle sweeping fans back and forth. */
const crabFans: Squadron = (state, wave, t0, out) => {
  const n = Math.round(5 * densityK(wave))
  out.push({
    at: t0,
    make: () =>
      makeEnemy(
        state,
        'crab',
        dropIn(rand(0.4, 0.6), rand(0.2, 0.3), 4.2, Math.random() < 0.5 ? -1 : 1),
        [fire({ kind: 'fan', n, spread: 0.9, dir: Math.PI / 2, sweep: 0.55, speed: 0.34 * speedK(wave), look: look('rice', AMBER) }, 0.9, 0.42 / rateK(wave), 9)],
        wave,
      ),
  })
}

/** A squid holding up top, pouring out a spiral. */
const squidSpiral: Squadron = (state, wave, t0, out) => {
  const arms = wave >= 6 ? 4 : 3
  out.push({
    at: t0,
    make: () =>
      makeEnemy(
        state,
        'squid',
        dropIn(rand(0.38, 0.62), rand(0.2, 0.26), 6.5, Math.random() < 0.5 ? -1 : 1),
        [
          fire(
            { kind: 'spiral', arms, speed: 0.28 * speedK(wave), rot: rand(0, 6.28), spin: 0.21, look: look('rice', MAGENTA) },
            1.0,
            0.12 / rateK(wave),
            Math.round(48 * rateK(wave)),
          ),
        ],
        wave,
      ),
  })
}

/**
 * A squid dropping walls: a row of slow bullets right across the field with one
 * gap in it, for the ship to be in the right place for.
 */
const squidWalls: Squadron = (state, wave, t0, out) => {
  out.push({
    at: t0,
    make: () =>
      makeEnemy(
        state,
        'squid',
        dropIn(0.5, 0.14, 6, Math.random() < 0.5 ? -1 : 1),
        [
          fire({ kind: 'wall', gap: Math.max(0.13, 0.19 - wave * 0.004), speed: 0.2 * speedK(wave), look: look('orb', SKY), spacing: 0.042 }, 1.0, 1.25 / rateK(wave), 5),
          fire({ kind: 'aimed', n: 1, spread: 0, speed: 0.46 * speedK(wave), look: look('big', RED) }, 1.6, 2.4 / rateK(wave), 3),
        ],
        wave,
      ),
  })
}

/** Octos diving at where the ship is, bursting into a ring at the bottom of the dive. */
const octoDive: Squadron = (state, wave, t0, out) => {
  for (let i = 0; i < 3; i++) {
    out.push({
      at: t0 + i * 0.55,
      make: () => {
        const tx = clamp(state.ship.x + rand(-0.12, 0.12), 0.12, 0.88)
        const sx = i % 2 ? 1.06 : -0.06
        const low = rand(0.62, 0.8)
        const n = Math.round(8 * densityK(wave))
        return makeEnemy(
          state,
          'octo',
          [
            curve({ x: sx, y: 0.05 }, { x: sx, y: 0.4 }, { x: tx, y: low - 0.15 }, { x: tx, y: low }, 1.2, 'in'),
            curve({ x: tx, y: low }, { x: tx, y: low + 0.08 }, { x: 1 - sx, y: 0.5 }, { x: 1 - sx, y: -0.12 }, 1.4, 'out'),
          ],
          [fire({ kind: 'ring', n, speed: 0.24 * speedK(wave), rot: rand(0, 6.28), spin: 0, look: look('orb', ORANGE) }, 1.15)],
          wave,
        )
      },
    })
  }
}

/** Crabs crossing the top, firing short aimed streams. */
const crabCross: Squadron = (state, wave, t0, out) => {
  const fromLeft = Math.random() < 0.5
  for (let i = 0; i < 3; i++) {
    const y = 0.14 + i * 0.07
    const sx = fromLeft ? -0.1 : 1.1
    out.push({
      at: t0 + i * 0.5,
      make: () =>
        makeEnemy(
          state,
          'crab',
          [curve({ x: sx, y }, { x: 0.35, y: y + 0.04 }, { x: 0.65, y: y + 0.04 }, { x: 1 - sx, y }, 5.2)],
          [fire({ kind: 'stream', n: 3 + Math.floor(wave / 4), gap: 0.07, speed: 0.5 * speedK(wave), look: look('dart', PINK) }, 0.8, 1.3 / rateK(wave), 3)],
          wave,
        ),
    })
  }
}

/** A squid throwing blooms: rings of two speeds at once, opening like a flower. */
const squidBloom: Squadron = (state, wave, t0, out) => {
  const n = Math.round(12 * densityK(wave))
  out.push({
    at: t0,
    make: () =>
      makeEnemy(
        state,
        'squid',
        dropIn(rand(0.35, 0.65), rand(0.2, 0.28), 5.5, Math.random() < 0.5 ? -1 : 1),
        [
          fire(
            { kind: 'bloom', n, speeds: [0.22 * speedK(wave), 0.32 * speedK(wave)], rot: 0, spin: 0.17, looks: [look('orb', TEAL), look('orb', SKY)] },
            1.0,
            0.95 / rateK(wave),
            6,
          ),
        ],
        wave,
      ),
  })
}

/** A pair of crabs throwing big orbs that break into rings. */
const crabBursts: Squadron = (state, wave, t0, out) => {
  for (const [i, x] of [0.3, 0.7].entries()) {
    out.push({
      at: t0 + i * 0.3,
      make: () =>
        makeEnemy(
          state,
          'crab',
          dropIn(x, rand(0.18, 0.26), 4.4, x < 0.5 ? -1 : 1),
          [
            fire(
              { kind: 'burst', n: 1, speed: 0.3 * speedK(wave), look: look('big', AMBER), after: 0.95, ringN: Math.round(9 * densityK(wave)), ringSpeed: 0.26 * speedK(wave), ringLook: look('orb', ORANGE) },
              1.1,
              1.6 / rateK(wave),
              3,
            ),
          ],
          wave,
        ),
    })
  }
}

type Entry = { make: Squadron; from: number; weight: number }

/** The squadrons a wave can draw on, from the wave they first appear. */
const SQUADRONS: readonly Entry[] = [
  { make: octoFlight, from: 1, weight: 2.5 },
  { make: octoSweep, from: 1, weight: 3 },
  { make: octoRow, from: 1, weight: 2 },
  { make: crabRings, from: 1, weight: 2 },
  { make: crabFans, from: 2, weight: 2 },
  { make: squidSpiral, from: 2, weight: 1.5 },
  { make: octoDive, from: 3, weight: 1.5 },
  { make: squidWalls, from: 3, weight: 1.2 },
  { make: crabCross, from: 4, weight: 1.5 },
  { make: squidBloom, from: 6, weight: 1.3 },
  { make: crabBursts, from: 7, weight: 1.3 },
]

function pickSquadron(wave: number, avoid: Squadron | null): Squadron {
  const pool = SQUADRONS.filter((e) => e.from <= wave && e.make !== avoid)
  // What a wave has just unlocked comes up more often in it.
  const weights = pool.map((e) => e.weight * (e.from === wave ? 2 : 1))
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return pool[i]!.make
  }
  return pool[pool.length - 1]!.make
}

export function isBossWave(wave: number) {
  return wave % 5 === 0
}

/** A wave's timetable: squadrons, one after another and overlapping more as the waves go on. */
function buildWave(state: GameState, wave: number): Spawn[] {
  const out: Spawn[] = []
  if (isBossWave(wave)) {
    // A little company first, then the flagship.
    octoSweep(state, wave, 1.2, out)
    octoRow(state, wave, 4.2, out)
    return out
  }
  const count = Math.min(18, 9 + Math.floor(wave * 0.9))
  const gap = Math.max(1.25, 2.6 - wave * 0.12)
  let t = 0.8
  let last: Squadron | null = null
  for (let i = 0; i < count; i++) {
    const make: Squadron = i === 0 ? octoFlight : i === 1 ? octoSweep : pickSquadron(wave, last)
    make(state, wave, t, out)
    last = make
    t += gap * rand(0.8, 1.2)
  }
  out.sort((a, b) => a.at - b.at)
  return out
}

// ------------------------------------------------------------------ flagship

/**
 * The flagship's phases. The first flagship has three; each after it hits
 * harder and adds another. A phase ends when its share of the hull is gone, or
 * when its time runs out, which ends it without its bonus.
 */
function bossPhases(number: number): BossPhase[] {
  const k = 1 + (number - 1) * 0.3
  const s = Math.min(1.5, 1 + (number - 1) * 0.12)
  const hp = Math.round(420 * (1 + (number - 1) * 0.75))
  const phases: BossPhase[] = [
    {
      name: 'Pinwheel',
      hp,
      limit: 30,
      hue: PINK,
      fires: () => [
        fire({ kind: 'spiral', arms: 4 + Math.min(3, number - 1), speed: 0.26 * s, rot: 0, spin: 0.19, look: look('rice', PINK) }, 0.6, 0.1 / Math.min(1.5, k), Infinity),
        fire({ kind: 'aimed', n: 3, spread: 0.3, speed: 0.44 * s, look: look('big', RED) }, 1.5, 2.2 / k, Infinity),
      ],
    },
    {
      name: 'Bloom',
      hp,
      limit: 30,
      hue: AMBER,
      fires: () => [
        fire(
          { kind: 'bloom', n: Math.round(16 * Math.min(1.8, k)), speeds: [0.2 * s, 0.28 * s, 0.36 * s], rot: 0, spin: 0.11, looks: [look('orb', AMBER), look('orb', ORANGE), look('rice', RED)] },
          0.6,
          1.05 / Math.min(1.5, k),
          Infinity,
        ),
      ],
    },
    {
      name: 'Curtain Call',
      hp,
      limit: 32,
      hue: SKY,
      fires: () => [
        fire({ kind: 'wall', gap: 0.16, speed: 0.22 * s, look: look('orb', SKY), spacing: 0.04 }, 0.6, 1.3 / Math.min(1.4, k), Infinity),
        fire({ kind: 'stream', n: 6, gap: 0.06, speed: 0.55 * s, look: look('dart', TEAL) }, 1.4, 2.1 / k, Infinity),
      ],
    },
  ]
  if (number >= 2) {
    phases.push({
      name: 'Crown',
      hp: Math.round(hp * 1.2),
      limit: 34,
      hue: VIOLET,
      fires: () => [
        fire(
          { kind: 'burst', n: 5, speed: 0.28 * s, look: look('big', VIOLET), after: 1.0, ringN: Math.round(12 * Math.min(1.8, k)), ringSpeed: 0.24 * s, ringLook: look('orb', MAGENTA) },
          0.6,
          1.7 / Math.min(1.5, k),
          Infinity,
        ),
        fire({ kind: 'aimed', n: 5, spread: 0.5, speed: 0.38 * s, look: look('rice', PINK) }, 1.2, 1.4 / k, Infinity),
      ],
    })
  }
  if (number >= 3) {
    phases.push({
      name: 'Tempest',
      hp: Math.round(hp * 1.4),
      limit: 36,
      hue: TEAL,
      fires: () => [
        fire({ kind: 'spiral', arms: 3, speed: 0.3 * s, rot: 0, spin: 0.31, look: look('rice', TEAL), turn: 0.6 }, 0.5, 0.09, Infinity),
        fire({ kind: 'spiral', arms: 3, speed: 0.3 * s, rot: Math.PI / 3, spin: -0.31, look: look('rice', SKY), turn: -0.6 }, 0.55, 0.09, Infinity),
        fire({ kind: 'ring', n: 18, speed: 0.34 * s, rot: 0, spin: 0.1, look: look('big', MAGENTA) }, 1.5, 2.6, Infinity),
      ],
    })
  }
  return phases
}

function spawnBoss(state: GameState) {
  const number = state.wave / 5
  const phases = bossPhases(number)
  const first = phases[0]!
  const route: Leg[] = [
    curve({ x: 0.5, y: -0.25 }, { x: 0.5, y: 0.05 }, { x: 0.5, y: 0.2 }, { x: 0.5, y: 0.25 }, 2.4, 'out'),
    { kind: 'hold', dur: Infinity, sway: 0.09 },
  ]
  const queen = makeEnemy(state, 'queen', route, [], state.wave)
  queen.hp = first.hp
  queen.maxHp = first.hp
  queen.plated = false
  state.enemies.push(queen)
  state.boss = { id: queen.id, number, phases, phase: 0, phaseT: 0, lull: 2.4, title: 0 }
  state.bossDue = false
  state.banner = { text: `Flagship ${number}`, sub: first.name, t: 0, tone: 'boss' }
  sfx('wave')
}

// --------------------------------------------------------------- the state

function freshInput(): Input {
  return { moveX: 0, moveY: 0, focus: false, steer: null, barrage: false }
}

export function createInitialState(): GameState {
  const state: GameState = {
    phase: 'menu',
    time: 0,
    score: 0,
    best: 0,
    lives: START_LIVES,
    wave: 1,
    waveT: 0,
    clearing: 0,
    spawns: [],
    bossDue: false,
    enemies: [],
    boss: null,
    bullets: [],
    bolts: [],
    stars: [],
    pips: [],
    pipIn: PIP_FIRST,
    pipsDropped: 0,
    pipsCaught: 0,
    ship: { ...SHIP_START, lean: 0, focus: 0, shield: 0, fireIn: 0, needleIn: 0 },
    power: 1,
    powerEarned: 1,
    stock: 1,
    charge: 0,
    blast: null,
    blasts: 0,
    heat: 1,
    idle: 0,
    bestHeat: 1,
    grazes: 0,
    kills: 0,
    missesThisWave: 0,
    killedBy: '',
    dyingFor: 0,
    input: freshInput(),
    nextId: 1,
    banner: null,
    bits: [],
    rings: [],
    floaters: [],
    shake: 0,
    flash: 0,
    grazeGlow: 0,
    grazeRun: 0,
    grazeRunT: 0,
    plinkIn: 0,
  }
  menuScene(state)
  return state
}

/**
 * Behind the start card: a few of the fleet hanging in the sky, turning out a
 * slow ring now and then, harmless.
 */
function menuScene(state: GameState) {
  const line: [Species, number, number][] = [
    ['octo', 0.12, 0.4],
    ['crab', 0.3, 0.3],
    ['squid', 0.5, 0.22],
    ['crab', 0.7, 0.3],
    ['octo', 0.88, 0.4],
  ]
  for (const [species, x, y] of line) {
    const e = makeEnemy(state, species, [curve({ x, y }, { x, y }, { x, y }, { x, y }, 0.01), { kind: 'hold', dur: Infinity, sway: 0.01 }], [], 1)
    e.x = x
    e.y = y
    if (species === 'squid') {
      e.fires = [fire({ kind: 'bloom', n: 16, speeds: [0.11, 0.16], rot: 0, spin: 0.2, looks: [look('orb', PINK), look('orb', MAGENTA)] }, 0.2, 1.8, Infinity)]
    }
    state.enemies.push(e)
  }
  // Already under way behind the start card, rather than just beginning.
  for (let i = 0; i < 300; i++) {
    advanceEnemies(state, 1 / 60)
    advanceBullets(state, 1 / 60)
  }
  state.time = 0
}

export function startGame(prev: GameState): GameState {
  const state = createInitialState()
  state.phase = 'playing'
  state.best = prev.best
  state.enemies = []
  state.bullets = []
  state.bits = []
  state.ship.shield = 1.2
  beginWave(state, 1)
  return state
}

function beginWave(state: GameState, wave: number) {
  state.wave = wave
  state.waveT = 0
  state.clearing = 0
  state.missesThisWave = 0
  state.spawns = buildWave(state, wave)
  state.bossDue = isBossWave(wave)
  state.banner = isBossWave(wave)
    ? { text: `Wave ${wave}`, sub: 'A flagship is coming', t: 0, tone: 'wave' }
    : { text: `Wave ${wave}`, sub: waveNote(wave), t: 0, tone: 'wave' }
}

/** What a wave brings that the last one didn't. */
export function waveNote(wave: number) {
  if (wave === 1) return 'Only the dot at your heart can be hit'
  if (wave === 2) return 'Graze bullets to charge your Barrage'
  if (wave === 3) return 'Walls with a gap · diving octos'
  if (wave === 4) return 'Crossfire'
  if (wave === 6) return 'Blooms'
  if (wave === 7) return 'Plated hulls · bursting orbs'
  return ''
}

/** Admin/testing: straight to a wave, power as if every wave before it had been cleared. */
export function jumpToWave(state: GameState, wave: number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover') return state
  const w = Math.max(1, Math.floor(wave) || 1)
  state.enemies = []
  state.bullets = []
  state.bolts = []
  state.stars = []
  state.pips = []
  state.boss = null
  state.blast = null
  state.powerEarned = powerFor(w - 1)
  state.power = state.powerEarned
  beginWave(state, w)
  state.phase = 'playing'
  return state
}

function powerFor(cleared: number) {
  let p = 1
  for (let i = 1; i < POWER_AT.length; i++) if (cleared >= POWER_AT[i]!) p = i + 1
  return Math.min(MAX_POWER, p)
}

// -------------------------------------------------------------------- input

export function setMove(state: GameState, x: number, y: number): GameState {
  state.input.moveX = clamp(x, -1, 1)
  state.input.moveY = clamp(y, -1, 1)
  return state
}

export function setFocus(state: GameState, focus: boolean): GameState {
  state.input.focus = focus
  return state
}

/** Where a finger wants the ship, in field units; null lets go. */
export function setSteer(state: GameState, at: Vec | null): GameState {
  state.input.steer = at ? { x: at.x, y: at.y } : null
  return state
}

export function triggerBarrage(state: GameState): GameState {
  state.input.barrage = true
  return state
}

/** Where the ship can go. */
export function shipBounds() {
  return { x0: SHIP_MARGIN, x1: 1 - SHIP_MARGIN, y0: SHIP_TOP, y1: FIELD_H - SHIP_MARGIN }
}

// ------------------------------------------------------------------ effects

function addRing(state: GameState, x: number, y: number, r0: number, r1: number, life: number, hue: number, width = 0.006) {
  state.rings.push({ x, y, r0, r1, life, maxLife: life, hue, width })
}

function addSparks(state: GameState, x: number, y: number, n: number, hue: number, speed = 0.5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = speed * rand(0.3, 1)
    const life = rand(0.2, 0.45)
    state.bits.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, maxLife: life, hue, size: rand(0.004, 0.008), angle: 0, spin: 0 })
  }
}

function addShards(state: GameState, x: number, y: number, n: number, hue: number, spread: number, size: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = rand(0.06, 0.32)
    const life = rand(0.5, 1)
    state.bits.push({
      kind: 'shard',
      x: x + Math.cos(a) * spread * Math.random(),
      y: y + Math.sin(a) * spread * Math.random(),
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life,
      maxLife: life,
      hue,
      size: size * rand(0.55, 1.15),
      angle: Math.random() * Math.PI * 2,
      spin: rand(-9, 9),
    })
  }
}

function addFloater(state: GameState, x: number, y: number, text: string, tone: FloaterTone, life = 0.9) {
  state.floaters.push({ x, y, text, tone, life, maxLife: life })
  if (state.floaters.length > 16) state.floaters.shift()
}

const MAX_BITS = 500

function tickEffects(state: GameState, dt: number) {
  const bits = state.bits
  let w = 0
  const from = Math.max(0, bits.length - MAX_BITS)
  for (let i = from; i < bits.length; i++) {
    const b = bits[i]!
    b.life -= dt
    if (b.life <= 0) continue
    const drag = Math.pow(b.kind === 'spark' ? 0.05 : 0.35, dt)
    b.vx *= drag
    b.vy = b.vy * drag + (b.kind === 'shard' ? 0.25 : 0.08) * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.angle += b.spin * dt
    bits[w++] = b
  }
  bits.length = w
  state.rings = state.rings.filter((r) => (r.life -= dt) > 0)
  state.floaters = state.floaters.filter((f) => {
    f.life -= dt
    f.y -= dt * 0.05
    return f.life > 0
  })
  state.shake = Math.max(0, state.shake - dt * 2.6)
  state.flash = Math.max(0, state.flash - dt * 2.2)
  state.grazeGlow = Math.max(0, state.grazeGlow - dt * 5)
  state.grazeRunT -= dt
  if (state.grazeRunT <= 0) state.grazeRun = 0
  state.plinkIn -= dt
  if (state.banner) {
    state.banner.t += dt
    if (state.banner.t > BANNER_TIME) state.banner = null
  }
}

// --------------------------------------------------------------- the shooting

/** Where a ship's shots leave it. */
export function nozzleOf(e: Enemy) {
  return { x: e.x, y: e.y + SPECIES[e.species].h * 0.36 }
}

function makeBullet(x: number, y: number, angle: number, speed: number, lk: Look, wait = 0): Bullet {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: lk.r,
    kind: lk.kind,
    hue: lk.hue,
    wait,
    accel: 0,
    until: speed,
    turn: 0,
    turnFor: 0,
    split: null,
    grazed: false,
    age: 0,
  }
}

function aimAt(state: GameState, x: number, y: number) {
  return Math.atan2(state.ship.y - y, state.ship.x - x)
}

/** One shot of a pattern from an enemy. */
function emit(state: GameState, e: Enemy, f: Fire) {
  const p = f.pattern
  const at = nozzleOf(e)
  const out = state.bullets
  e.flare = 1
  const i = f.done
  switch (p.kind) {
    case 'aimed': {
      const a0 = aimAt(state, at.x, at.y)
      for (let k = 0; k < p.n; k++) {
        const a = p.n === 1 ? a0 : a0 - p.spread / 2 + (p.spread * k) / (p.n - 1)
        const b = makeBullet(at.x, at.y, a, p.speed, p.look)
        if (p.accel) {
          b.accel = p.accel
          b.until = p.until ?? p.speed
        }
        out.push(b)
      }
      break
    }
    case 'ring': {
      const rot = p.rot + p.spin * i
      for (let k = 0; k < p.n; k++) {
        const b = makeBullet(at.x, at.y, rot + (Math.PI * 2 * k) / p.n, p.speed, p.look)
        if (p.accel) {
          b.accel = p.accel
          b.until = p.until ?? p.speed
        }
        out.push(b)
      }
      break
    }
    case 'fan': {
      const dir = p.dir + Math.sin(i * 0.7) * p.sweep
      for (let k = 0; k < p.n; k++) {
        const a = p.n === 1 ? dir : dir - p.spread / 2 + (p.spread * k) / (p.n - 1)
        out.push(makeBullet(at.x, at.y, a, p.speed, p.look))
      }
      break
    }
    case 'spiral': {
      const rot = p.rot + p.spin * i
      for (let k = 0; k < p.arms; k++) {
        const b = makeBullet(at.x, at.y, rot + (Math.PI * 2 * k) / p.arms, p.speed, p.look)
        if (p.turn) {
          b.turn = p.turn
          b.turnFor = 1.2
        }
        out.push(b)
      }
      break
    }
    case 'bloom': {
      const rot = p.rot + p.spin * i
      for (let s = 0; s < p.speeds.length; s++) {
        const lk = p.looks[s % p.looks.length]!
        const off = (s * Math.PI) / p.n
        for (let k = 0; k < p.n; k++) out.push(makeBullet(at.x, at.y, rot + off + (Math.PI * 2 * k) / p.n, p.speeds[s]!, lk))
      }
      break
    }
    case 'wall': {
      // Right across the field at the enemy's height, one gap, placed where the ship is not quite.
      const gapX = clamp(state.ship.x + rand(-0.28, 0.28), p.gap, 1 - p.gap)
      for (let x = 0.02; x < 0.99; x += p.spacing) {
        if (Math.abs(x - gapX) < p.gap / 2) continue
        const b = makeBullet(x, at.y + 0.02, Math.PI / 2, p.speed, p.look, Math.abs(x - at.x) * 0.5)
        out.push(b)
      }
      break
    }
    case 'stream': {
      const a = aimAt(state, at.x, at.y)
      for (let k = 0; k < p.n; k++) out.push(makeBullet(at.x, at.y, a, p.speed, p.look, k * p.gap))
      break
    }
    case 'burst': {
      const a0 = p.n === 1 ? aimAt(state, at.x, at.y) : Math.PI / 2
      for (let k = 0; k < p.n; k++) {
        const a = p.n === 1 ? a0 : a0 - 1 + (2 * k) / (p.n - 1)
        const b = makeBullet(at.x, at.y, a, p.speed, p.look)
        b.split = { at: p.after, n: p.ringN, speed: p.ringSpeed, look: p.ringLook }
        b.accel = -p.speed * 0.6
        b.until = p.speed * 0.35
        out.push(b)
      }
      break
    }
  }
}

function fireShip(state: GameState, dt: number) {
  const s = state.ship
  s.fireIn -= dt
  s.needleIn -= dt
  const focused = s.focus > 0.5
  if (s.fireIn <= 0) {
    s.fireIn += FIRE_EVERY
    if (s.fireIn < 0) s.fireIn = FIRE_EVERY
    const p = state.power
    const y = s.y - 0.03
    const push = (dx: number, lean: number, dmg: number) =>
      state.bolts.push({ x: s.x + dx, y, vx: Math.sin(lean) * BOLT_SPEED, vy: -Math.cos(lean) * BOLT_SPEED, dmg, needle: false })
    // The pair down the middle, tighter and harder when focused.
    const d = focused ? 1.25 : 1
    push(-0.012, focused ? 0 : -0.03, d)
    push(0.012, focused ? 0 : 0.03, d)
    if (p >= 2) {
      push(-0.03, focused ? -0.02 : -0.2, d * 0.8)
      push(0.03, focused ? 0.02 : 0.2, d * 0.8)
    }
    if (p >= 4) {
      push(-0.045, focused ? -0.04 : -0.4, d * 0.7)
      push(0.045, focused ? 0.04 : 0.4, d * 0.7)
    }
  }
  if (state.power >= 3 && s.needleIn <= 0) {
    s.needleIn = NEEDLE_EVERY
    for (const side of [-1, 1]) {
      state.bolts.push({ x: s.x + side * 0.05, y: s.y + 0.005, vx: side * 0.2, vy: -NEEDLE_SPEED, dmg: 0.7, needle: true })
    }
  }
}

// ---------------------------------------------------------------- the rules

function gainHeat(state: GameState, amount: number) {
  state.heat = Math.min(MAX_HEAT, state.heat + amount)
  state.bestHeat = Math.max(state.bestHeat, state.heat)
  state.idle = 0
}

function addCharge(state: GameState, amount: number) {
  if (state.stock >= MAX_STOCK) {
    state.charge = 0
    return
  }
  state.charge += amount
  if (state.charge >= 1) {
    state.charge -= 1
    state.stock += 1
    const s = state.ship
    addRing(state, s.x, s.y, 0.02, 0.09, 0.45, AMBER)
    addFloater(state, s.x, s.y - 0.06, 'Barrage ready', 'bonus', 1)
    sfx('good')
    if (state.stock >= MAX_STOCK) state.charge = 0
  }
}

function killEnemy(state: GameState, e: Enemy) {
  const spec = SPECIES[e.species]
  const gained = Math.round(e.worth * state.heat)
  state.score += gained
  state.kills += 1
  gainHeat(state, spec.heat)
  addCharge(state, 0.004 * (spec.hp / 3))
  addShards(state, e.x, e.y, 8 + Math.round(spec.w * 60), spec.hue, spec.w * 0.3, spec.w * 0.12)
  addSparks(state, e.x, e.y, 8, spec.hue, 0.55)
  addRing(state, e.x, e.y, spec.w * 0.2, spec.w * 0.7, 0.35, spec.hue)
  addFloater(state, e.x, e.y - spec.h * 0.4, `+${gained}`, 'score')
  state.shake = Math.min(1, state.shake + (e.species === 'squid' ? 0.2 : e.species === 'crab' ? 0.1 : 0.04))
  sfx('hit', Math.min(5, Math.floor(state.heat)))
  e.gone = true
  // A pip that's due comes out of it.
  if (state.pipIn <= 0 && state.stock < MAX_STOCK) {
    state.pipIn = rand(PIP_EVERY[0], PIP_EVERY[1])
    dropPip(state, e.x, e.y)
  }
}

function damageEnemy(state: GameState, e: Enemy, dmg: number) {
  if (e.gone) return
  e.hp -= dmg
  e.hurt = 1
  if (e.hp > 0) plink(state, e)
  if (e.species === 'queen') {
    if (e.hp <= 0) endBossPhase(state, e, true)
    return
  }
  if (e.hp <= 0) killEnemy(state, e)
}

/**
 * A hit that hasn't broken it: a tick, higher the nearer it is to breaking, so
 * a crab under fire climbs toward the pop. Never more often than PLINK_GAP.
 */
function plink(state: GameState, e: Enemy) {
  if (state.plinkIn > 0) return
  state.plinkIn = PLINK_GAP
  sfx('plink', Math.round((1 - e.hp / e.maxHp) * 8))
}

function endBossPhase(state: GameState, queen: Enemy, broken: boolean) {
  const boss = state.boss
  if (!boss) return
  const phase = boss.phases[boss.phase]!
  if (broken) {
    const gained = SCORE_PHASE * Math.min(3, boss.number)
    state.score += gained
    addFloater(state, queen.x, queen.y + 0.12, `${phase.name} broken +${gained}`, 'bonus', 1.6)
    if (state.stock < MAX_STOCK) dropPip(state, queen.x, queen.y + 0.06)
  } else {
    addFloater(state, queen.x, queen.y + 0.12, `${phase.name} over`, 'warn', 1.4)
  }
  starsFromBullets(state, state.bullets)
  state.bullets = []
  addRing(state, queen.x, queen.y, 0.05, 0.5, 0.7, phase.hue, 0.012)
  state.shake = Math.min(1, state.shake + 0.5)
  sfx('boom')
  boss.phase += 1
  if (boss.phase >= boss.phases.length) {
    killBoss(state, queen)
    return
  }
  const next = boss.phases[boss.phase]!
  queen.hp = next.hp
  queen.maxHp = next.hp
  queen.fires = []
  boss.phaseT = 0
  boss.lull = 1.8
  boss.title = 0
  state.banner = { text: next.name, sub: `Phase ${boss.phase + 1} of ${boss.phases.length}`, t: 0, tone: 'phase' }
}

function killBoss(state: GameState, queen: Enemy) {
  const boss = state.boss!
  const gained = SCORE_FLAGSHIP * Math.min(3, boss.number)
  state.score += gained
  queen.gone = true
  state.boss = null
  for (let i = 0; i < 5; i++) {
    addShards(state, queen.x + rand(-0.1, 0.1), queen.y + rand(-0.06, 0.06), 12, i % 2 ? MAGENTA : PINK, 0.08, 0.03)
  }
  addSparks(state, queen.x, queen.y, 40, AMBER, 0.9)
  addRing(state, queen.x, queen.y, 0.05, 0.9, 1.1, AMBER, 0.016)
  addRing(state, queen.x, queen.y, 0.02, 0.6, 0.8, PINK, 0.01)
  state.flash = 1
  state.shake = 1
  addFloater(state, queen.x, queen.y, `Flagship down +${gained}`, 'bonus', 2)
  // An extra ship for bringing one down.
  if (state.lives < MAX_LIVES) {
    state.lives += 1
    addFloater(state, state.ship.x, state.ship.y - 0.08, 'Extra ship', 'bonus', 1.6)
  }
  sfx('perfect')
  sfx('boom')
}

/**
 * Bullets into stars, flying to the ship: what a Barrage, a phase broken or a
 * wave cleared makes of them. Returns what they will be worth.
 */
function starsFromBullets(state: GameState, bullets: Bullet[]) {
  let total = 0
  for (const b of bullets) {
    if (b.wait > 0) continue
    const worth = Math.round((b.grazed ? SCORE_GOLD_STAR : SCORE_STAR) * state.heat)
    total += worth
    state.stars.push({ x: b.x, y: b.y, vx: b.vx * 0.3 + rand(-0.1, 0.1), vy: b.vy * 0.3 - 0.15, worth, gold: b.grazed, age: 0 })
  }
  return total
}

function loseShip(state: GameState) {
  const s = state.ship
  state.lives -= 1
  state.missesThisWave += 1
  state.phase = 'dying'
  state.dyingFor = DEATH_PAUSE
  state.heat = 1
  state.power = Math.max(1, state.power - 1)
  state.stock = Math.max(state.stock, 1)
  state.bolts = []
  // The shock of it clears the air.
  for (const b of state.bullets) addSparks(state, b.x, b.y, 1, b.hue, 0.2)
  state.bullets = []
  addShards(state, s.x, s.y, 20, 153, 0.03, 0.014)
  addSparks(state, s.x, s.y, 24, RED, 0.8)
  addRing(state, s.x, s.y, 0.01, 0.35, 0.7, RED, 0.012)
  addRing(state, s.x, s.y, 0.01, 0.2, 0.5, 153, 0.008)
  state.shake = 1
  state.flash = 0.8
  sfx(state.lives > 0 ? 'hurt' : 'die')
}

function releaseBarrage(state: GameState) {
  state.input.barrage = false
  if (state.stock < 1 || state.blast || state.phase !== 'playing') return
  state.stock -= 1
  state.blasts += 1
  const s = state.ship
  state.blast = { x: s.x, y: s.y, r: 0, id: state.nextId++, worth: 0 }
  s.shield = Math.max(s.shield, WAVE_SHIELD)
  state.flash = Math.max(state.flash, 0.5)
  state.shake = Math.min(1, state.shake + 0.4)
  addRing(state, s.x, s.y, 0.01, 0.16, 0.4, AMBER, 0.01)
  sfx('whoosh')
  sfx('wave')
}

function advanceBlast(state: GameState, dt: number) {
  const blast = state.blast
  if (!blast) return
  blast.r += WAVE_SPEED * dt
  const r2 = blast.r * blast.r
  const caught: Bullet[] = []
  const kept: Bullet[] = []
  for (const b of state.bullets) {
    const dx = b.x - blast.x
    const dy = b.y - blast.y
    if (dx * dx + dy * dy < r2) caught.push(b)
    else kept.push(b)
  }
  if (caught.length) {
    blast.worth += starsFromBullets(state, caught)
    state.bullets = kept
  }
  for (const e of state.enemies) {
    if (e.gone || e.struckBy === blast.id) continue
    const dx = e.x - blast.x
    const dy = e.y - blast.y
    if (dx * dx + dy * dy > r2) continue
    e.struckBy = blast.id
    if (e.species === 'queen') {
      if (state.boss && state.boss.lull <= 0) damageEnemy(state, e, e.maxHp * WAVE_BOSS_SHARE)
    } else {
      damageEnemy(state, e, WAVE_DAMAGE * hpK(state.wave))
    }
  }
  if (blast.r > WAVE_REACH) {
    if (blast.worth > 0) addFloater(state, state.ship.x, state.ship.y - 0.09, `Barrage +${blast.worth.toLocaleString()}`, 'bonus', 1.6)
    state.blast = null
  }
}

function advanceStars(state: GameState, dt: number) {
  const s = state.ship
  const kept: Star[] = []
  let got = 0
  let gold = 0
  for (const st of state.stars) {
    st.age += dt
    const dx = s.x - st.x
    const dy = s.y - st.y
    const d = Math.hypot(dx, dy) || 1
    if (d < 0.035 || (state.phase !== 'playing' && st.age > 2)) {
      state.score += st.worth
      got += st.worth
      if (st.gold) gold += 1
      continue
    }
    // Drift a moment, then home in hard.
    const pull = st.age < 0.25 ? 0 : Math.min(3.2, 0.6 + (st.age - 0.25) * 6)
    const steer = Math.min(1, dt * (st.age < 0.25 ? 1 : 8))
    st.vx += ((dx / d) * pull - st.vx) * steer
    st.vy += ((dy / d) * pull - st.vy) * steer
    st.x += st.vx * dt
    st.y += st.vy * dt
    kept.push(st)
  }
  state.stars = kept
  if (got > 0 && Math.random() < 0.3) sfx('hop', Math.min(16, 6 + gold))
}

/** A pip pops out of the wreck; the first of a run says what it is. */
function dropPip(state: GameState, x: number, y: number) {
  state.pips.push({ x, y, vx: rand(-0.12, 0.12), vy: -0.2, age: 0, id: state.nextId++ })
  addRing(state, x, y, 0.006, 0.06, 0.35, AMBER, 0.005)
  // Kept in from the walls, so the whole line fits on the field.
  if (state.pipsDropped === 0) addFloater(state, clamp(x, 0.35, 0.65), y + 0.06, 'Catch it to charge your Barrage', 'bonus', 2.2)
  state.pipsDropped += 1
}

/** Pips fall, swaying a little, and the graze circle catches any it reaches while the ship is up. */
function advancePips(state: GameState, dt: number) {
  const s = state.ship
  const up = state.phase === 'playing'
  // The next one's clock runs while there's room in hand for it.
  if (up && state.stock < MAX_STOCK) state.pipIn -= dt
  const reach = GRAZE_R + PIP_R
  const kept: Pip[] = []
  for (const p of state.pips) {
    p.age += dt
    if (p.age >= PIP_LIFE) {
      addSparks(state, p.x, p.y, 5, AMBER, 0.25)
      continue
    }
    p.vy = Math.min(PIP_FALL, p.vy + PIP_GRAVITY * dt)
    p.vx *= Math.pow(0.3, dt)
    p.x = clamp(p.x + (p.vx + Math.sin(p.age * 2.4 + p.id) * 0.025) * dt, 0.03, 0.97)
    p.y += p.vy * dt
    if (up && Math.hypot(p.x - s.x, p.y - s.y) < reach) {
      catchPip(state, p)
      continue
    }
    if (p.y < FIELD_H + 0.04) kept.push(p)
  }
  state.pips = kept
}

function catchPip(state: GameState, p: Pip) {
  state.pipsCaught += 1
  const before = state.stock
  addCharge(state, PIP_CHARGE)
  // Taken in: sparks where it was, and a gold ring out of the ship.
  addSparks(state, p.x, p.y, 10, AMBER, 0.5)
  addRing(state, state.ship.x, state.ship.y, 0.02, 0.1, 0.4, AMBER, 0.006)
  state.grazeGlow = 1
  // A Barrage it completes sounds its own chime.
  if (state.stock === before) sfx('eat')
}

// ------------------------------------------------------------------- moving

function moveShip(state: GameState, dt: number) {
  const s = state.ship
  const inp = state.input
  const b = shipBounds()
  const x0 = s.x
  const y0 = s.y
  if (inp.moveX !== 0 || inp.moveY !== 0) {
    const sp = inp.focus ? FOCUS_SPEED : KEY_SPEED
    const len = Math.hypot(inp.moveX, inp.moveY) || 1
    s.x += (inp.moveX / len) * sp * dt
    s.y += (inp.moveY / len) * sp * dt
  } else if (inp.steer) {
    const dx = inp.steer.x - s.x
    const dy = inp.steer.y - s.y
    const d = Math.hypot(dx, dy)
    const step = DRAG_SPEED * dt
    if (d <= step) {
      s.x = inp.steer.x
      s.y = inp.steer.y
    } else {
      s.x += (dx / d) * step
      s.y += (dy / d) * step
    }
  }
  s.x = clamp(s.x, b.x0, b.x1)
  s.y = clamp(s.y, b.y0, b.y1)
  const vx = dt > 0 ? (s.x - x0) / dt : 0
  const speed = dt > 0 ? Math.hypot(s.x - x0, s.y - y0) / dt : 0
  s.lean += (clamp(vx / 0.8, -1, 1) - s.lean) * Math.min(1, dt * 10)
  // Focused while slow or while the slow key is held: a finger held still focuses the shot.
  const want = inp.focus || speed < 0.25 ? 1 : 0
  s.focus += (want - s.focus) * Math.min(1, dt * 8)
}

function advanceEnemies(state: GameState, dt: number) {
  const s = state.ship
  const menu = state.phase === 'menu'
  for (const e of state.enemies) {
    if (e.gone) continue
    e.age += dt
    e.hurt = Math.max(0, e.hurt - dt * 4)
    e.flare = Math.max(0, e.flare - dt * 3)
    const at = routeAt(e.route, e.age, e.id)
    if (!at) {
      e.gone = true
      continue
    }
    e.x = at.x
    e.y = at.y
    // Nothing fires while the ship is going down, or the air would be full again as it comes back.
    const hold = state.phase === 'dying' || (e.species === 'queen' && state.boss !== null && state.boss.lull > 0)
    if (!hold) {
      for (const f of e.fires) {
        while (f.done < f.times && e.age >= f.next) {
          emit(state, e, f)
          f.done += 1
          f.next += f.every
        }
      }
    }
    if (menu || state.phase !== 'playing' || s.shield > 0) continue
    const spec = SPECIES[e.species]
    if (Math.hypot(e.x - s.x, e.y - s.y) < spec.body * 0.8 + CORE_R) {
      state.killedBy = `ram:${e.species}`
      loseShip(state)
      return
    }
  }
  if (!menu) state.enemies = state.enemies.filter((e) => !e.gone)
}

function advanceBoss(state: GameState, dt: number) {
  const boss = state.boss
  if (!boss) return
  const queen = state.enemies.find((e) => e.id === boss.id)
  if (!queen) {
    state.boss = null
    return
  }
  boss.title = Math.min(1, boss.title + dt * 2)
  if (boss.lull > 0) {
    boss.lull -= dt
    if (boss.lull <= 0) {
      const phase = boss.phases[boss.phase]!
      queen.fires = phase.fires().map((f) => ({ ...f, at: queen.age + f.at, next: queen.age + f.at }))
      boss.phaseT = 0
    }
    return
  }
  boss.phaseT += dt
  const phase = boss.phases[boss.phase]!
  if (boss.phaseT > phase.limit) endBossPhase(state, queen, false)
}

function advanceBolts(state: GameState, dt: number) {
  const kept: Bolt[] = []
  for (const b of state.bolts) {
    if (b.needle) {
      // Bend toward the nearest ship ahead.
      let best: Enemy | null = null
      let bestD = Infinity
      for (const e of state.enemies) {
        if (e.gone || e.y > b.y) continue
        const d = Math.hypot(e.x - b.x, e.y - b.y)
        if (d < bestD) {
          bestD = d
          best = e
        }
      }
      if (best) {
        const a = Math.atan2(best.y - b.y, best.x - b.x)
        const sp = Math.hypot(b.vx, b.vy)
        const cur = Math.atan2(b.vy, b.vx)
        let da = a - cur
        while (da > Math.PI) da -= Math.PI * 2
        while (da < -Math.PI) da += Math.PI * 2
        const na = cur + clamp(da, -4 * dt, 4 * dt)
        b.vx = Math.cos(na) * sp
        b.vy = Math.sin(na) * sp
      }
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.y < -0.05 || b.x < -0.05 || b.x > 1.05 || b.y > FIELD_H + 0.05) continue
    let hit = false
    for (const e of state.enemies) {
      if (e.gone) continue
      const spec = SPECIES[e.species]
      // A flagship between phases, still coming on, takes nothing.
      if (e.species === 'queen' && state.boss && state.boss.lull > 0) continue
      const dx = e.x - b.x
      const dy = e.y - b.y
      const r = spec.body
      if (dx * dx + dy * dy > r * r) continue
      // Off the top of the field, a ship is not there to be hit yet.
      if (e.y < 0) continue
      damageEnemy(state, e, b.dmg)
      hit = true
      addSparks(state, b.x, b.y - 0.01, 1, 153, 0.25)
      break
    }
    if (!hit) kept.push(b)
  }
  state.bolts = kept
}

function advanceBullets(state: GameState, dt: number) {
  const s = state.ship
  const vulnerable = state.phase === 'playing' && s.shield <= 0
  const live = state.phase === 'playing'
  const kept: Bullet[] = []
  const born: Bullet[] = []
  for (const b of state.bullets) {
    if (b.wait > 0) {
      b.wait -= dt
      kept.push(b)
      continue
    }
    b.age += dt
    if (b.accel !== 0) {
      const sp = Math.hypot(b.vx, b.vy) || 1e-6
      const next = b.accel > 0 ? Math.min(b.until, sp + b.accel * dt) : Math.max(b.until, sp + b.accel * dt)
      b.vx *= next / sp
      b.vy *= next / sp
      if (next === b.until) b.accel = 0
    }
    if (b.turnFor > 0) {
      b.turnFor -= dt
      const c = Math.cos(b.turn * dt)
      const sn = Math.sin(b.turn * dt)
      const vx = b.vx * c - b.vy * sn
      b.vy = b.vx * sn + b.vy * c
      b.vx = vx
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.split && b.age >= b.split.at) {
      const sp = b.split
      const rot = Math.random() * Math.PI * 2
      for (let k = 0; k < sp.n; k++) born.push(makeBullet(b.x, b.y, rot + (Math.PI * 2 * k) / sp.n, sp.speed, sp.look))
      addRing(state, b.x, b.y, 0.005, 0.05, 0.25, b.hue, 0.004)
      continue
    }
    if (b.x < -0.08 || b.x > 1.08 || b.y < -0.2 || b.y > FIELD_H + 0.08) continue
    if (live) {
      const dx = b.x - s.x
      const dy = b.y - s.y
      const d2 = dx * dx + dy * dy
      const hitR = CORE_R + b.r * 0.72
      if (vulnerable && d2 < hitR * hitR) {
        state.killedBy = `${b.kind}:${b.hue}`
        loseShip(state)
        return
      }
      const gr = GRAZE_R + b.r
      if (!b.grazed && d2 < gr * gr) {
        b.grazed = true
        graze(state, b)
      }
    }
    kept.push(b)
  }
  for (const b of born) kept.push(b)
  state.bullets = kept
}

function graze(state: GameState, b: Bullet) {
  state.grazes += 1
  gainHeat(state, HEAT_GRAZE)
  addCharge(state, GRAZE_CHARGE)
  const gained = Math.round(SCORE_GRAZE * state.heat)
  state.score += gained
  state.grazeGlow = 1
  state.grazeRun = state.grazeRunT > 0 ? state.grazeRun + 1 : 1
  state.grazeRunT = 0.5
  const s = state.ship
  const a = Math.atan2(b.y - s.y, b.x - s.x)
  addSparks(state, s.x + Math.cos(a) * 0.014, s.y + Math.sin(a) * 0.014, 2, AMBER, 0.35)
  sfx('hop', Math.min(16, state.grazeRun))
}

// --------------------------------------------------------------------- tick

export function tick(state: GameState, dt: number): GameState {
  state.time += dt
  tickEffects(state, dt)

  if (state.phase === 'gameover') return state
  if (state.phase === 'menu') {
    advanceEnemies(state, dt)
    advanceBullets(state, dt)
    return state
  }

  if (state.phase === 'dying') {
    state.dyingFor -= dt
    advanceEnemies(state, dt)
    advanceBullets(state, dt)
    advanceStars(state, dt)
    advancePips(state, dt)
    if (state.dyingFor > 0) return state
    if (state.lives <= 0) {
      state.phase = 'gameover'
      state.best = Math.max(state.best, state.score)
      return state
    }
    state.phase = 'playing'
    state.ship.x = SHIP_START.x
    state.ship.y = SHIP_START.y
    state.ship.shield = SHIELD_TIME
    state.input.steer = null
    return state
  }

  // Playing.
  const s = state.ship
  s.shield = Math.max(0, s.shield - dt)
  if (state.input.barrage) releaseBarrage(state)
  moveShip(state, dt)
  fireShip(state, dt)

  if (state.clearing > 0) {
    state.clearing -= dt
    advanceBolts(state, dt)
    advanceStars(state, dt)
    advancePips(state, dt)
    advanceBlast(state, dt)
    if (state.clearing <= 0) beginWave(state, state.wave + 1)
    return state
  }

  state.waveT += dt
  while (state.spawns.length && state.spawns[0]!.at <= state.waveT) {
    state.enemies.push(state.spawns.shift()!.make())
  }
  // The flagship comes once its company is gone, or after a while regardless.
  if (state.bossDue && state.spawns.length === 0 && state.waveT > 9 && (!state.enemies.length || state.waveT > 13)) spawnBoss(state)

  advanceBoss(state, dt)
  advanceEnemies(state, dt)
  if (state.phase !== 'playing') return state
  advanceBolts(state, dt)
  advanceBullets(state, dt)
  if (state.phase !== 'playing') return state
  advanceBlast(state, dt)
  advanceStars(state, dt)
  advancePips(state, dt)

  state.idle += dt
  if (state.idle > HEAT_IDLE) state.heat = Math.max(1, state.heat - HEAT_COOL * dt)

  // The wave is over when its timetable has run and nothing is left in the sky.
  if (state.spawns.length === 0 && state.enemies.length === 0 && !state.bossDue && !state.boss) clearWave(state)
  return state
}

function clearWave(state: GameState) {
  const clear = SCORE_WAVE * Math.min(state.wave, 20)
  const clean = state.missesThisWave === 0 ? SCORE_UNTOUCHED * Math.min(state.wave, 20) : 0
  state.score += clear + clean
  starsFromBullets(state, state.bullets)
  state.bullets = []
  state.clearing = CLEAR_PAUSE
  const earned = powerFor(state.wave)
  const before = state.power
  state.powerEarned = earned
  // A level back for every wave cleared, up to what the run has earned.
  if (state.power < earned) state.power += 1
  state.banner = {
    text: `Wave ${state.wave} clear`,
    sub: `+${clear}${clean ? `   +${clean} untouched` : ''}${state.power > before ? '   ·   Power up' : ''}`,
    t: 0,
    tone: 'clear',
  }
  sfx('good')
}

export function toSnapshot(state: GameState): Snapshot {
  return {
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    wave: state.wave,
    stock: state.stock,
    charge: state.charge,
    heat: state.heat,
    power: state.power,
    grazes: state.grazes,
    bestHeat: state.bestHeat,
    boss: state.boss !== null,
  }
}

/** The flagship, if one is up: its phase, how much of the phase is left, and its name. */
export function bossReadout(state: GameState) {
  const boss = state.boss
  if (!boss) return null
  const queen = state.enemies.find((e) => e.id === boss.id)
  if (!queen) return null
  const phase = boss.phases[boss.phase]!
  return {
    name: phase.name,
    hue: phase.hue,
    phase: boss.phase,
    phases: boss.phases.length,
    left: boss.lull > 0 ? 1 : Math.max(0, queen.hp / queen.maxHp),
    time: boss.lull > 0 ? phase.limit : Math.max(0, phase.limit - boss.phaseT),
    title: boss.title,
  }
}
