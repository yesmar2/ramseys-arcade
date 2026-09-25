/**
 * Ace Chase: a round of three holes. On each, set a power and an angle and putt from the tee, again and
 * again, until the ball comes to rest on the bull; then the next hole. A hole pays 1000 ÷ the tries it
 * took, so a bull at the first try is 1000, at the second 500, at the fifth 200. There is no limit on
 * tries.
 *
 * Every round the targets move: each hole's bull sits in one of the spots its definition lists, picked
 * afresh, so last round's numbers are only a start. The ball is played out by ./physics, a fixed step
 * at a time, so the same numbers always do the same thing.
 *
 * The state is plain data. The scene (./scene) draws it and flies the camera; the page (AceChaseGame)
 * turns presses into the calls below.
 */
import { sfx } from '../../lib/sound'
import {
  DT,
  HOLE_DEFS,
  MAX_ANGLE,
  RINGS,
  launch,
  makeHole,
  step,
  type Ball,
  type Hole,
  type Spot,
} from './physics'

export type Phase = 'menu' | 'intro' | 'aim' | 'roll' | 'missed' | 'return' | 'holed' | 'gameover'

/** The flyover at the start of each hole, unless it's skipped. */
export const INTRO_TIME = 6
/** A miss is shown this long before the ball goes back to the tee, and the hop back takes this long. */
const MISSED_TIME = 1.4
export const RETURN_TIME = 0.6
/** How long a bullseye is celebrated before the next hole. */
export const HOLED_TIME = 2.8
/** What a hole pays: this, over the tries it took. */
export const HOLE_POINTS = 1000
export const HOLES = HOLE_DEFS.length
/** The dials as a round starts. */
export const START_POWER = 60
export const START_ANGLE = 0

export type PathPoint = readonly [number, number, number]

export type Shot = {
  n: number
  power: number
  angle: number
  /** Where it ended, in words. */
  what: string
  bull: boolean
}

export type HoleResult = { tries: number; points: number }

export type GameState = {
  phase: Phase
  /** Seconds in this phase. */
  phaseTime: number
  holeIndex: number
  /** Where each hole's target is this round. */
  spots: readonly Spot[]
  hole: Hole
  power: number
  angle: number
  /** Tries on this hole so far, the one in play included. */
  tries: number
  results: readonly HoleResult[]
  score: number
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
}

/** A target for each hole, from the spots it offers. */
export function pickSpots(random: () => number = Math.random): Spot[] {
  return HOLE_DEFS.map((def) => def.spots[Math.floor(random() * def.spots.length)] ?? def.spots[0]!)
}

/** A ball sitting on the tee. */
function teeBall(hole: Hole): Ball {
  return launch(hole, 0, 0)
}

let keys = 0

function atHole(state: GameState, index: number): GameState {
  const hole = makeHole(HOLE_DEFS[index]!, state.spots[index]!)
  return {
    ...state,
    holeIndex: index,
    hole,
    tries: 0,
    ball: teeBall(hole),
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

export function createInitialState(random: () => number = Math.random): GameState {
  const spots = pickSpots(random)
  const hole = makeHole(HOLE_DEFS[0]!, spots[0]!)
  return {
    phase: 'menu',
    phaseTime: 0,
    holeIndex: 0,
    spots,
    hole,
    power: START_POWER,
    angle: START_ANGLE,
    tries: 0,
    results: [],
    score: 0,
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
  }
}

/** A new round: fresh targets, the first hole, and its flyover. */
export function startGame(state: GameState, random: () => number = Math.random): GameState {
  const fresh = atHole({ ...state, spots: pickSpots(random), results: [], score: 0, power: START_POWER, angle: START_ANGLE }, 0)
  return { ...fresh, phase: 'intro', phaseTime: 0 }
}

/** The flyover has been seen enough: straight to the tee. */
export function skipIntro(state: GameState): GameState {
  return state.phase === 'intro' ? { ...state, phase: 'aim', phaseTime: 0 } : state
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Power 0 to 100, in halves. */
export function setPower(state: GameState, v: number): GameState {
  const power = clamp(Math.round(v * 2) / 2, 0, 100)
  return power === state.power ? state : { ...state, power }
}

/** The angle off straight up the hole, right positive, in tenths of a degree. */
export function setAngle(state: GameState, v: number): GameState {
  const angle = clamp(Math.round(v * 10) / 10, -MAX_ANGLE, MAX_ANGLE)
  // No negative zero: it would print as "−0.0".
  return angle === state.angle ? state : { ...state, angle: angle === 0 ? 0 : angle }
}

/** Putt with the dials as they are. */
export function putt(state: GameState): GameState {
  if (state.phase !== 'aim') return state
  const ball = launch(state.hole, state.power, state.angle)
  sfx('zip', state.power < 50 ? 1 : 0)
  if (state.power >= 50) sfx('whoosh')
  return {
    ...state,
    phase: 'roll',
    phaseTime: 0,
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

/** Where a miss ended, in words that say which way to adjust. */
export function describe(s: Pick<GameState, 'ball' | 'hole' | 'closest' | 'landed'>): string {
  const b = s.ball
  const h = s.hole
  if (b.done === 'splash') return s.landed ? `rolled back into the water from ${s.closest.toFixed(1)} m short` : 'in the water'
  if (b.done === 'out') return 'off the course'
  const d = Math.hypot(b.x - h.target.x, b.z - h.target.z)
  if (d < RINGS[1]) return `inner ring, ${d.toFixed(2)} m off`
  if (d < RINGS[2]) return `outer ring, ${d.toFixed(1)} m off`
  if (s.closest < RINGS[1]) return `ran over the target, stopped ${d.toFixed(1)} m past`
  if (Math.hypot(b.x - h.tee.x, b.z - h.tee.z) < 1.5) return 'rolled back to the tee'
  return `${d.toFixed(1)} m from the target`
}

/** The shot in play has stopped, or gone: a bullseye, or a try to learn from. */
function finishShot(s: GameState): GameState {
  const b = s.ball
  const path = [...s.path, [b.x, b.y, b.z] as PathPoint]
  const ghosts = [...s.ghosts, path].slice(-3)
  if (b.done === 'bull') {
    const points = Math.round(HOLE_POINTS / s.tries)
    sfx(s.tries === 1 ? 'perfect' : 'good')
    return {
      ...s,
      phase: 'holed',
      phaseTime: 0,
      path,
      ghosts,
      results: [...s.results, { tries: s.tries, points }],
      score: s.score + points,
      shots: [...s.shots, { n: s.tries, power: s.power, angle: s.angle, what: 'Bullseye!', bull: true }],
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
    shots: [...s.shots, { n: s.tries, power: s.power, angle: s.angle, what: describe(s), bull: false }],
  }
}

/** Play the shot in play out at once. */
export function fastForward(state: GameState): GameState {
  if (state.phase !== 'roll') return state
  const s: GameState = { ...state, ball: { ...state.ball }, path: [...state.path] }
  while (!s.ball.done) stepShot(s, false)
  return finishShot(s)
}

/** Admin and testing: a fresh round, or the round in hand, moved to a hole. The caller marks the run assisted. */
export function jumpToHole(state: GameState, index: number): GameState {
  if (index < 0 || index >= HOLES) return state
  // Holes skipped over score nothing, but still count in the round's list.
  const results = [...state.results]
  while (results.length < index) results.push({ tries: 0, points: 0 })
  return { ...atHole({ ...state, results: results.slice(0, index) }, index), phase: 'intro', phaseTime: 0 }
}

export function tick(state: GameState, dt: number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover') return state
  let s: GameState = { ...state, phaseTime: state.phaseTime + dt }
  switch (s.phase) {
    case 'intro':
      if (s.phaseTime >= INTRO_TIME) s = { ...s, phase: 'aim', phaseTime: 0 }
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
      const tee = teeBall(s.hole)
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
      if (s.phaseTime >= HOLED_TIME) {
        s =
          s.holeIndex + 1 < HOLES
            ? { ...atHole(s, s.holeIndex + 1), phase: 'intro', phaseTime: 0 }
            : { ...s, phase: 'gameover', phaseTime: 0 }
      }
      break
  }
  return s
}

/** What the page needs to draw its panels, a few times a second. */
export type Snapshot = {
  phase: Phase
  phaseTime: number
  score: number
  holeIndex: number
  holeName: string
  holeNote: string
  tries: number
  power: number
  angle: number
  shots: readonly Shot[]
  results: readonly HoleResult[]
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    phase: s.phase,
    phaseTime: s.phaseTime,
    score: s.score,
    holeIndex: s.holeIndex,
    holeName: s.hole.name,
    holeNote: s.hole.note,
    tries: s.tries,
    power: s.power,
    angle: s.angle,
    shots: s.shots,
    results: s.results,
  }
}

/** The tries a round took, hole by hole. */
export function totalTries(results: readonly HoleResult[]): number {
  return results.reduce((sum, r) => sum + r.tries, 0)
}
