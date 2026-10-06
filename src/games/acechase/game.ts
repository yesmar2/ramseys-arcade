/**
 * Ace Chase: Today's Hole (./daily), one hole a day, the same for everyone. Set the ball on the tee line,
 * point the line, and swing, again and again, until the ball comes to rest on the bull. There is no limit on
 * tries; they carry on from where the player left them, and the first bullseye is the day's result.
 *
 * The ball is played out by ./physics, a fixed step at a time, so the same strike always does the same
 * thing. A day's hole can also be played ahead of its day, on trial, when nothing is kept.
 *
 * The state is plain data. The scene (./scene) draws it and flies the camera; the page (AceChaseGame)
 * turns presses into the calls below.
 */
import { sfx } from '../../lib/sound'
import {
  DT,
  MAX_ANGLE,
  RINGS,
  TEE_HALF,
  launch,
  makeHole,
  step,
  type Ball,
  type Hole,
  type HoleDef,
  type Lost,
  type Spot,
} from './physics'

export type Phase = 'menu' | 'intro' | 'aim' | 'swing' | 'snap' | 'roll' | 'missed' | 'return' | 'holed' | 'gameover'

/** The flyover at the start of each hole, unless it's skipped. */
export const INTRO_TIME = 6
/** A laid hole's flyover follows its line, and takes longer. */
export const LAID_INTRO_TIME = 9
export const introTime = (hole: Hole) => (hole.def.path ? LAID_INTRO_TIME : INTRO_TIME)
/** A miss is shown this long before the ball goes back to the tee, and the hop back takes this long. */
const MISSED_TIME = 1.4
export const RETURN_TIME = 0.6
/** How long a bullseye is celebrated before the day's result. */
export const HOLED_TIME = 2.8
/**
 * The swing, a golf meter (Ramsey, 2026-10-06: "make the swing the power and direction ... we don't ever
 * have the number options", then "lets try A"). There are no dials: the line is pointed on the green, and
 * the meter does the rest in three presses.
 *
 * - Swing: the needle sets off from the mark and climbs, taking RISE to reach full power, and falls back
 *   again if it isn't stopped (then nothing is struck, and it's back to aiming).
 * - The second press sets the power where the needle is.
 * - The needle then runs back down towards the mark, the full meter in BACK, and the third press strikes.
 *   On the mark, the ball goes straight down the line; early pushes it right, late pulls it left, HOOK
 *   degrees for every full meter off. Not pressed by LATE past the mark, it strikes there, pulled.
 *
 * Even a careful press is a twentieth of a second either way, a power or two and under a degree, which the
 * wider rings allow for (./physics RINGS).
 */
export const RISE = 2.6
export const BACK = 1.4
export const HOOK = 20
export const LATE = 0.16

/** Where the needle is on the way up, 0 (the mark) to 1 (full power), this far into the swing. */
export function riseAt(phaseTime: number): number {
  const u = phaseTime / RISE
  return u <= 1 ? u : Math.max(0, 2 - u)
}

/** Where the needle is on the way back: from the power set, down to the mark (0) and past it (below 0). */
export function snapAt(state: Pick<GameState, 'power' | 'phaseTime'>): number {
  return state.power / 100 - state.phaseTime / BACK
}

/** The way the ball sets off, for a press with the needle at `u` on the way back: early right, late left. */
export function hookAngle(aim: number, u: number): number {
  return clamp(Math.round((aim + u * HOOK) * 100) / 100, -90, 90)
}

/** A try that stopped this near the target (metres), off the rings, is "near": the share's warmer squares. */
export const NEAR = 3

/** The meter and the line as a hole starts: straight up the hole. */
export const START_POWER = 60
export const START_ANGLE = 0

export type PathPoint = readonly [number, number, number]

/** Where a try ended: on the bull, in the rings, near them, further off, or lost. */
export type ShotEnd = 'bull' | 'inner' | 'outer' | 'near' | 'off' | 'lost'

export type Shot = {
  n: number
  /** The power the ball was struck with, and the way it set off (degrees, right positive). */
  power: number
  angle: number
  /** The way the line was pointed, and where on the tee line the ball sat (metres right of its middle). */
  aim?: number
  place?: number
  /** Where the ball came to rest; absent when it was lost, or on tries from before. */
  at?: PathPoint
  /** How far from the middle of the target it stopped, in metres; absent when lost. */
  dist?: number
  /** Where it ended, in words. */
  what: string
  bull: boolean
  end: ShotEnd
}

/** Today's Hole, or a day's hole played ahead of its day, on trial (nothing kept). */
export type Mode = 'daily' | 'test'

export type GameState = {
  mode: Mode
  /** The hole in play. */
  def: HoleDef
  /** Today's Hole played again once it's done: nothing it does counts. */
  practice: boolean
  phase: Phase
  /** Seconds in this phase. */
  phaseTime: number
  /** Where its target is. */
  spot: Spot
  hole: Hole
  /** The power set on the meter (the swing's second press). */
  power: number
  /** The line, pointed on the green: degrees off straight up the hole, right positive. */
  angle: number
  /** Where the ball sits on the tee line, metres right of its middle (left negative). */
  place: number
  /** Tries so far, the one in play included. */
  tries: number
  ball: Ball
  /** The shot in play, as it goes; and the last three on this hole, oldest first. */
  path: PathPoint[]
  ghosts: readonly (readonly PathPoint[])[]
  shots: readonly Shot[]
  /** The nearest the shot in play has rolled to the middle of the target. */
  closest: number
  /** The shot in play made a real jump (not a hop over a hump) and came down again. */
  landed: boolean
  inAir: boolean
  takeoff: readonly [number, number]
  /** Physics time owed. */
  acc: number
  /** Where the ball lay when it set off back to the tee. */
  from: PathPoint | null
  /** Bumped whenever the hole or its target changes, so the scene knows to lay the new ground. */
  holeKey: number
  /** Bumped at each bullseye, so the scene can light the target up. */
  bulls: number
  /** The power and the way the shot in play was struck with. */
  struck: number
  struckAngle: number
}

/** A target for a hole, from the spots it offers. */
const pickOne = (def: HoleDef, random: () => number) => def.spots[Math.floor(random() * def.spots.length)] ?? def.spots[0]!

/** A ball sitting on the tee line, `place` metres right of its middle. */
function teeBall(hole: Hole, place = 0): Ball {
  return launch(hole, 0, 0, place)
}

let keys = 0

function atHole(state: GameState): GameState {
  const hole = makeHole(state.def, state.spot)
  return {
    ...state,
    hole,
    tries: 0,
    ball: teeBall(hole, state.place),
    path: [],
    ghosts: [],
    shots: [],
    closest: Infinity,
    landed: false,
    inAir: false,
    acc: 0,
    from: null,
    holeKey: ++keys,
  }
}

/** A hole waiting at its start card: today's, or one on trial. */
export function createInitialState(def: HoleDef, mode: Mode = 'daily', random: () => number = Math.random): GameState {
  const spot = mode === 'test' ? pickOne(def, random) : def.spots[0]!
  const hole = makeHole(def, spot)
  return {
    mode,
    def,
    practice: false,
    phase: 'menu',
    phaseTime: 0,
    spot,
    hole,
    power: START_POWER,
    angle: START_ANGLE,
    place: 0,
    tries: 0,
    ball: teeBall(hole),
    path: [],
    ghosts: [],
    shots: [],
    closest: Infinity,
    landed: false,
    inAir: false,
    takeoff: [0, 0],
    acc: 0,
    from: null,
    holeKey: ++keys,
    bulls: 0,
    struck: START_POWER,
    struckAngle: START_ANGLE,
  }
}

/** Where a day's play left off, to carry on from. */
export type Resume = { tries: number; shots: readonly Shot[]; ghosts: readonly (readonly PathPoint[])[]; power: number; angle: number; place?: number }

/**
 * Off to the tee, after the flyover. A hole on trial picks a fresh target each time; Today's Hole keeps
 * its one target, and carries on from `resume`: the tries already spent, the log and the last paths, and
 * the line and the ball's place on the tee as left.
 */
export function startGame(state: GameState, random: () => number = Math.random, resume?: Resume | null, practice = false): GameState {
  const spot = state.mode === 'test' ? pickOne(state.def, random) : state.spot
  const place = resume && !practice ? clamp(resume.place ?? 0, -TEE_HALF, TEE_HALF) : 0
  const fresh = atHole({ ...state, spot, power: START_POWER, angle: START_ANGLE, place, practice })
  const carried = resume && !practice ? { tries: resume.tries, shots: resume.shots, ghosts: resume.ghosts, power: resume.power, angle: resume.angle } : {}
  return { ...fresh, ...carried, phase: 'intro', phaseTime: 0 }
}

/** The flyover has been seen enough: straight to the tee. */
export function skipIntro(state: GameState): GameState {
  return state.phase === 'intro' ? { ...state, phase: 'aim', phaseTime: 0 } : state
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Power 0 to 100, to the tenth (a script's play-test; the player sets it with the swing). */
export function setPower(state: GameState, v: number): GameState {
  const power = clamp(Math.round(v * 10) / 10, 0, 100)
  return power === state.power ? state : { ...state, power }
}

/** Point the line: degrees off straight up the hole, right positive, to the hundredth. */
export function setAngle(state: GameState, v: number): GameState {
  const angle = clamp(Math.round(v * 100) / 100, -MAX_ANGLE, MAX_ANGLE)
  // No negative zero.
  return angle === state.angle ? state : { ...state, angle: angle === 0 ? 0 : angle }
}

/** Set the ball on the tee line, metres right of its middle, while aiming. */
export function setPlace(state: GameState, v: number): GameState {
  if (state.phase !== 'aim') return state
  const place = clamp(Math.round(v * 100) / 100, -TEE_HALF, TEE_HALF)
  if (place === state.place) return state
  return { ...state, place: place === 0 ? 0 : place, ball: teeBall(state.hole, place) }
}

/** The first press: the needle sets off up the meter. */
export function putt(state: GameState): GameState {
  if (state.phase !== 'aim') return state
  sfx('tap', 1)
  return { ...state, phase: 'swing', phaseTime: 0 }
}

/**
 * The next press: on the way up it sets the power where the needle is, and the needle heads back; on the
 * way back it strikes, the way the needle's place off the mark sends it.
 */
export function strike(state: GameState): GameState {
  if (state.phase === 'swing') {
    sfx('tap', 2)
    return { ...state, phase: 'snap', phaseTime: 0, power: Math.round(riseAt(state.phaseTime) * 1000) / 10 }
  }
  if (state.phase === 'snap') return strikeWith(state, state.power, hookAngle(state.angle, snapAt(state)))
  return state
}

/** Strike the ball at a given power and way, the meter's and the line's if none (a script's play-test). */
export function strikeWith(state: GameState, power = state.power, angle = state.angle): GameState {
  if (state.phase !== 'aim' && state.phase !== 'swing' && state.phase !== 'snap') return state
  const ball = launch(state.hole, power, angle, state.place)
  sfx('zip', power < 50 ? 1 : 0)
  if (power >= 50) sfx('whoosh')
  return {
    ...state,
    phase: 'roll',
    phaseTime: 0,
    struck: power,
    struckAngle: angle,
    tries: state.tries + 1,
    ball,
    path: [[ball.x, ball.y, ball.z]],
    closest: Infinity,
    landed: false,
    inAir: false,
    acc: 0,
  }
}

/** One physics step of the shot in play, noting what the words at the end need. Mutates `s` (a copy the caller made). */
function stepShot(s: GameState, loud: boolean) {
  const b = s.ball
  const hits = b.hits
  step(s.hole, b)
  if (!b.air) s.closest = Math.min(s.closest, Math.hypot(b.x - s.hole.target.x, b.z - s.hole.target.z))
  if (b.air && !s.inAir) {
    s.inAir = true
    s.takeoff = [b.x, b.z]
  } else if (!b.air && s.inAir) {
    s.inAir = false
    // A real jump, not a hop over a hump: it flew a good way before it came down.
    if (Math.hypot(b.x - s.takeoff[0], b.z - s.takeoff[1]) > 1.5) {
      s.landed = true
      if (loud) sfx('tap', 1)
    }
  }
  if (loud && b.hits > hits) sfx('tap', 2)
  if (Math.round(b.t / DT) % 6 === 0) s.path.push([b.x, b.y, b.z])
}

const LOST_IN: Record<Lost, string> = { water: 'the water', ice: 'the open water', crater: 'the crater' }

/**
 * Which way a ball lies from the target: short or past, `along` the way the hole is played to it, and
 * left or right, `side`ways as the ball was travelling there. Nothing said for under a quarter metre.
 */
function which(side: number, along: number): string {
  const a = along < -0.25 ? 'short' : along > 0.25 ? 'past' : ''
  const b = Math.abs(side) < 0.25 ? '' : `${Math.abs(side) < 0.8 ? 'a little ' : ''}${side < 0 ? 'left' : 'right'}`
  return [a, b].filter(Boolean).join(', ')
}

/**
 * Where a miss ended, in words that say which way to adjust; and first, if it struck a post or a named
 * wall, that it did, since then it's the angle to change rather than the power.
 */
export function describe(s: Pick<GameState, 'ball' | 'hole' | 'closest' | 'landed'> & { place?: number }): string {
  const where = placeOf(s)
  if (s.ball.done === 'rest' && s.hole.def.sand?.(s.ball.x, s.ball.z)) return `in the sand: ${where}`
  if (s.ball.posts) return `off a post: ${where}`
  if (s.ball.struck) return `off ${s.ball.struck}: ${where}`
  return where
}

function placeOf(s: Pick<GameState, 'ball' | 'hole' | 'closest' | 'landed'> & { place?: number }): string {
  const b = s.ball
  const h = s.hole
  const lost = LOST_IN[h.lost]
  if (b.done === 'splash') {
    // On a laid hole, into the water past the target is too hard, and it says so.
    const at = h.def.where?.(b.x, b.z)
    const goal = h.def.where?.(h.target.x, h.target.z)
    if (at && goal && at.s > goal.s) return `ran past the target, into ${lost}`
    return s.landed ? `rolled back into ${lost} from ${s.closest.toFixed(1)} m short` : `into ${lost}`
  }
  if (b.done === 'out') return 'flew off the course'
  const dx = b.x - h.target.x
  const dz = b.z - h.target.z
  const d = Math.hypot(dx, dz)
  // Every other hole ends in a lane running away from the tee; a laid one winds, so it goes by its line.
  const at = h.def.where?.(b.x, b.z)
  const goal = h.def.where?.(h.target.x, h.target.z)
  const line = at && goal ? { along: at.s - goal.s, side: at.d - goal.d, part: at.part } : null
  const way = line ? which(line.side, line.along) : which(dx, -dz)
  if (d < RINGS[1]) return `inner ring, ${d.toFixed(2)} m ${way || 'off'}`
  if (d < RINGS[2]) return `outer ring, ${d.toFixed(1)} m ${way || 'off'}`
  if (s.closest < RINGS[1]) return `ran over the target, stopped ${d.toFixed(1)} m ${way || 'past'}`
  if (Math.hypot(b.x - h.tee.x - (s.place ?? 0), b.z - h.tee.z) < 1.5) return 'rolled back to the tee'
  if (line && Math.abs(line.along) > 3) {
    // In a part ("in the posts"), unless its name says how ("on the climb").
    const part = line.part ? `${/^(in|on|at) /.test(line.part) ? line.part : `in ${line.part}`}, ` : ''
    return `stopped ${part}${Math.abs(line.along).toFixed(0)} m ${line.along < 0 ? 'short' : 'past'}`
  }
  return `${d.toFixed(1)} m ${way || 'from the target'}`
}

/** Where a try ended, for the day's pattern: on the bull, in the rings, off them, or lost. */
function endOf(s: Pick<GameState, 'ball' | 'hole'>): ShotEnd {
  const b = s.ball
  if (b.done === 'bull') return 'bull'
  if (b.done === 'splash' || b.done === 'out') return 'lost'
  const d = Math.hypot(b.x - s.hole.target.x, b.z - s.hole.target.z)
  return d < RINGS[1] ? 'inner' : d < RINGS[2] ? 'outer' : d < NEAR ? 'near' : 'off'
}

/** Where the ball came to rest, and how far that is from the target: nothing for a ball that was lost. */
function restOf(s: Pick<GameState, 'ball' | 'hole'>): { at?: PathPoint; dist?: number } {
  const b = s.ball
  if (b.done === 'splash' || b.done === 'out') return {}
  return { at: [b.x, b.y, b.z], dist: Math.round(Math.hypot(b.x - s.hole.target.x, b.z - s.hole.target.z) * 100) / 100 }
}

/** The shot in play has stopped, or gone: a bullseye, or a try to learn from. */
function finishShot(s: GameState): GameState {
  const b = s.ball
  const path = [...s.path, [b.x, b.y, b.z] as PathPoint]
  const ghosts = [...s.ghosts, path].slice(-3)
  if (b.done === 'bull') {
    sfx(s.tries === 1 ? 'perfect' : 'good')
    return {
      ...s,
      phase: 'holed',
      phaseTime: 0,
      path,
      ghosts,
      shots: [...s.shots, { n: s.tries, power: s.struck, angle: s.struckAngle, aim: s.angle, place: s.place, ...restOf(s), what: 'Bullseye!', bull: true, end: 'bull' }],
      bulls: s.bulls + 1,
    }
  }
  sfx(b.done === 'splash' || b.done === 'out' ? 'hurt' : 'miss')
  return {
    ...s,
    phase: 'missed',
    phaseTime: 0,
    path,
    ghosts,
    shots: [...s.shots, { n: s.tries, power: s.struck, angle: s.struckAngle, aim: s.angle, place: s.place, ...restOf(s), what: describe(s), bull: false, end: endOf(s) }],
  }
}

/** Play the shot in play out at once. */
export function fastForward(state: GameState): GameState {
  if (state.phase !== 'roll') return state
  const s: GameState = { ...state, ball: { ...state.ball }, path: [...state.path] }
  while (!s.ball.done) stepShot(s, false)
  return finishShot(s)
}

export function tick(state: GameState, dt: number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover') return state
  let s: GameState = { ...state, phaseTime: state.phaseTime + dt }
  switch (s.phase) {
    case 'intro':
      if (s.phaseTime >= introTime(s.hole)) s = { ...s, phase: 'aim', phaseTime: 0 }
      break
    case 'swing':
      // Up and back down without a press: no shot, back to aiming.
      if (s.phaseTime >= RISE * 2) s = { ...s, phase: 'aim', phaseTime: 0 }
      break
    case 'snap':
      // Not pressed by LATE past the mark: it strikes there, pulled.
      if (snapAt(s) <= -LATE) s = strikeWith(s, s.power, hookAngle(s.angle, -LATE))
      break
    case 'roll': {
      s.ball = { ...s.ball }
      s.path = [...s.path]
      s.acc += dt
      while (s.acc >= DT && !s.ball.done) {
        stepShot(s, true)
        s.acc -= DT
      }
      if (s.ball.done) s = finishShot({ ...s, acc: 0 })
      break
    }
    case 'missed':
      if (s.phaseTime >= MISSED_TIME) s = { ...s, phase: 'return', phaseTime: 0, from: [s.ball.x, s.ball.y, s.ball.z] }
      break
    case 'return': {
      const tee = teeBall(s.hole, s.place)
      const from = s.from ?? [tee.x, tee.y, tee.z]
      const k = Math.min(1, s.phaseTime / RETURN_TIME)
      const e = k * k * (3 - 2 * k)
      // A hop back to the tee, high enough to clear the rails.
      const ball: Ball = {
        ...tee,
        x: from[0] + (tee.x - from[0]) * e,
        y: from[1] + (tee.y - from[1]) * e + Math.sin(Math.PI * k) * 1.2,
        z: from[2] + (tee.z - from[2]) * e,
      }
      s = k >= 1 ? { ...s, phase: 'aim', phaseTime: 0, ball: tee, from: null } : { ...s, ball }
      break
    }
    case 'holed':
      if (s.phaseTime >= HOLED_TIME) s = { ...s, phase: 'gameover', phaseTime: 0 }
      break
  }
  return s
}

/** What the page needs to draw its panels, a few times a second. */
export type Snapshot = {
  mode: Mode
  practice: boolean
  phase: Phase
  phaseTime: number
  holeName: string
  holeNote: string
  tries: number
  power: number
  angle: number
  place: number
  shots: readonly Shot[]
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    mode: s.mode,
    practice: s.practice,
    phase: s.phase,
    phaseTime: s.phaseTime,
    holeName: s.hole.name,
    holeNote: s.hole.note,
    tries: s.tries,
    power: s.power,
    angle: s.angle,
    place: s.place,
    shots: s.shots,
  }
}
