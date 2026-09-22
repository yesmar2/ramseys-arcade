import type { Swatch } from '../../data/games'
import { getPersonalBest } from '../../lib/personalBest'
import { haptic } from '../../lib/haptics'
import { sfx } from '../../lib/sound'
import {
  assertLevelsAreOpen,
  levelFor,
  levelName,
  wallKey,
  wallsForLevel,
} from './levels'
import { catchable, createMouse, mouseDoor, stepMouse, type Mouse, type MouseWorld } from './mouse'

/*
 * Snake: eat, grow, don't hit anything.
 *
 * What a run is judged on is the chain. Every fruit that appears while a chain
 * is going carries a ring, and the ring is how long you have to reach it: get
 * there first and the chain grows and the next fruit is worth more, let it
 * close and the chain is gone. The ring is sized to the trip — how far the
 * fruit really is, around walls and your own body — so a chain is lost to a
 * slow line, never to where a fruit happened to fall. It tightens as the chain
 * grows, and that is what the boost tank is for.
 *
 * Two things turn up now and then besides fruit: a golden apple that does not
 * wait long, and a mouse that runs. Neither touches the chain, so each is a
 * choice between a big bite and the rhythm you are keeping.
 */

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'dying' | 'gameover'

export type Cell = { x: number; y: number }

/** A colour an effect is drawn in: a palette swatch, the site's ink, or white. */
export type Tint = Swatch | 'ink' | 'white'

export type FruitKind = 'apple' | 'cherry' | 'grape' | 'orange' | 'lemon' | 'berry' | 'plum'

export const FRUIT_KINDS: readonly FruitKind[] = [
  'apple',
  'cherry',
  'grape',
  'orange',
  'lemon',
  'berry',
  'plum',
]

/** The palette colour each fruit is known by, for its bits when it is eaten. */
export const FRUIT_TINT: Record<FruitKind, Swatch> = {
  apple: 'red',
  cherry: 'pink',
  grape: 'violet',
  orange: 'orange',
  lemon: 'amber',
  berry: 'indigo',
  plum: 'magenta',
}

export type Fruit = {
  /** Cell. */
  x: number
  y: number
  kind: FruitKind
  /** Seconds since it appeared. */
  age: number
  /** Seconds its ring runs for. 0 when there was no chain to keep, so no ring. */
  window: number
  /** The ring is still running: eating this now keeps the chain. */
  live: boolean
}

export type Golden = { x: number; y: number; age: number; life: number }

export type ParticleKind = 'bit' | 'spark' | 'puff' | 'ring'

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  /** 1 → 0. */
  life: number
  maxLife: number
  /** Radius, in cells. */
  size: number
  tint: Tint
  kind: ParticleKind
}

export type Floater = {
  x: number
  y: number
  text: string
  sub: string
  /** 1 → 0. */
  life: number
  maxLife: number
  tint: Tint
  /** 0 → 1, how big it is drawn. */
  weight: number
}

export type Banner = { text: string; sub: string; tint: Tint; life: number; maxLife: number }

export type DeathCause = 'wall' | 'block' | 'self'

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  length: number
  /** Boost actually paying out, not just held — drives the control's lit state. */
  boosting: boolean
  level: number
  /** Fuel left in the tank, so the control is worth offering. */
  canBoost: boolean
  /** Tank level 1 → 0, for the control's own meter. */
  fuel: number
  chain: number
  deathCause: DeathCause | null
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  cols: number
  rows: number
  /** Head center, in grid units (cell c spans c..c+1, center c+0.5). */
  head: Cell
  /** Corner points of the path the head has travelled, newest first. */
  trail: Cell[]
  dir: Dir
  /** Turn to take at the next cell center. */
  pendingDir: Dir | null
  /** One extra turn queued behind pendingDir. */
  bufferedDir: Dir | null
  /** The next move starts a new straight line, so the trail needs a vertex. */
  lineBreak: boolean
  /** Number of body segments (grows with every bite). */
  segments: number
  fruit: Fruit
  golden: Golden | null
  /** Seconds until the next golden apple is due. */
  goldenTimer: number
  mouse: Mouse | null
  /** Seconds until the next mouse is due. */
  mouseTimer: number
  /** Fruits eaten back to back, each before its ring closed. */
  chain: number
  bestChain: number
  /** Cells per second. */
  speed: number
  /** Boost control held. Whether it is actually paying out is {@link isBoosting}. */
  boostHeld: boolean
  /** Seconds of boost left in the tank. Filled by eating, drained by holding. */
  boostFuel: number
  /** Rises every ten bites, and brings the next barrier layout with it. */
  level: number
  /** Walled cells, keyed "x,y". Replaced on a level change, never mutated. */
  walls: Set<string>
  /**
   * Walls the head was already standing in when they arrived.
   *
   * A level lands wherever the snake happens to be, and dropping the cells it
   * overlapped meant the shape turned up with pieces missing for the whole
   * level. Better to build it whole and let the few blocks the head is inside
   * hold their fire until it has left them — the block is there, drawn and
   * plain, it simply does not kill you for being where it was put.
   */
  dormant: Set<string>
  /**
   * The layout the next bite will bring, once there is only one to go.
   *
   * Drawn ahead of itself so a level is something you steer around rather than
   * something that happens to you.
   */
  nextWalls: Set<string> | null
  /** Seconds since the current layout landed, for the blocks growing in. */
  levelAge: number
  /** Seconds since the page opened this state, menus included. Drives idle motion. */
  time: number
  /** Seconds of the run so far. */
  elapsed: number
  /** Fruit eaten this run. */
  eaten: number
  flash: number
  flashTint: Tint
  shake: number
  /** Swallowed bites on their way down, as distance from the head in cells. */
  bulges: number[]
  particles: Particle[]
  floaters: Floater[]
  banners: Banner[]
  /** Seconds left of the crash, before the card. */
  dying: number
  deathCause: DeathCause | null
}

function loadBest() {
  return getPersonalBest('snake')
}

export const GRID_LONG = 21
export const GRID_SHORT = 15
export const COLS = GRID_LONG
export const ROWS = GRID_SHORT

// Layouts are checked here rather than in levels.ts: the board's dimensions
// live in this file, and by the time this runs the other module is loaded.
if (import.meta.env.DEV) {
  const problems = assertLevelsAreOpen(GRID_LONG, GRID_SHORT)
  if (problems.length) {
    console.error('[snake] barrier layout strands open cells:\n  ' + problems.join('\n  '))
  }
}

/** Same 21×15 board, rotated so the long side matches the screen. */
export function snakeLayout(portrait: boolean) {
  return portrait
    ? { cols: GRID_SHORT, rows: GRID_LONG, dir: 'down' as Dir, aspectW: 5, aspectH: 7 }
    : { cols: GRID_LONG, rows: GRID_SHORT, dir: 'right' as Dir, aspectW: 7, aspectH: 5 }
}
const START_SEGMENTS = 3

/**
 * What a fruit is worth: ten, and two more for every link of the chain it
 * extends, up to thirty.
 *
 * Thirty is where the old freshness bonus topped out, deliberately. The board,
 * the record of strong runs and the server's check on how fast a score can
 * grow were all set against that ceiling, so the chain changes who reaches it
 * and how often — not how high the numbers go.
 */
const FRUIT_POINTS = 10
const CHAIN_STEP = 2
const CHAIN_STEPS = 10
/** The chain at which a fruit is worth all it can be. */
export const CHAIN_TOP = CHAIN_STEPS + 1

export function fruitValue(chain: number) {
  return FRUIT_POINTS + CHAIN_STEP * Math.min(CHAIN_STEPS, Math.max(0, chain - 1))
}

/**
 * How long a fruit's ring runs.
 *
 * The trip is the real one — walls and the body in the way — at the pace the
 * snake is going without boost, then given slack: generous while the chain is
 * short, tight once it is long. At the top a straight line at cruising speed
 * still makes it, with most of a second to spare, but a detour does not
 * without the boost, and that is the tank's job.
 */
function chainWindow(pathCells: number, speed: number, chain: number) {
  const slack = 1.08 + 0.42 * Math.exp(-chain / 8)
  const base = 0.6 + 0.6 * Math.exp(-chain / 10)
  return base + (slack * pathCells) / speed
}

const GOLDEN_POINTS = 50
const MOUSE_POINTS = 50
/** Seconds a golden apple waits. */
const GOLDEN_LIFE = 7
/** Run time before the first golden apple, then the gap between them. */
const GOLDEN_FIRST = 14
const GOLDEN_GAP: [number, number] = [18, 28]
/** Run time before the first mouse, then the gap between them. */
const MOUSE_FIRST = 26
const MOUSE_GAP: [number, number] = [32, 46]
/** How close the head has to get to the mouse, cells. */
const MOUSE_EAT = 0.62

/** How long the crash plays before the card. */
export const DYING_TIME = 1.15
const MAX_PARTICLES = 320

/** Distance between body / visual bead centers in grid cells. */
export const BEAD_SPACING = 0.7
const SEG_SPACING = BEAD_SPACING
/** Body length near the head that can't kill you. */
const NECK_SKIP = 1.5 * SEG_SPACING
const HIT_DIST = 0.68
const EAT_DIST = 0.55

/** Speed multiplier while a turn is queued, to shorten the wait for the next center. */
const TURN_BOOST = 2

/**
 * Boost: free, and limited by a tank that food fills.
 *
 * Two prices were tried and both were wrong. Length is a reward here, not a
 * cost — a shorter snake has less of itself to hit and more open board — and
 * charging the score taxed the one thing a player would obviously reach for
 * boost to do, which is catch food before its ring runs down. A mechanic whose
 * obvious use is a trap gets used once and written off.
 *
 * Nothing is charged. The price is already in the speed: 1.75× is less time to
 * read what is coming, and a long body threading a gap at that pace is a
 * genuine risk. What the tank adds is a reason to choose a moment — it fills
 * only by eating, so the loop pays for itself, and it caps, so fuel left in
 * the tank is fuel wasted.
 */
const BOOST_MULT = 1.75
/** Seconds of boost the tank holds. */
const BOOST_FUEL_MAX = 4
/**
 * Seconds of boost each food is worth.
 *
 * Half a second, so a full tank is eight foods of saving. One food buys about
 * two cells of gained ground — enough to save a ring that is running out, and
 * not enough to hold the boost open. Refilling faster than this made boost a
 * thing you always had, and a thing you always have is a speed setting, not a
 * decision.
 */
const BOOST_FUEL_PER_FOOD = 0.5
/** A golden apple is worth two seconds; a mouse fills the tank. */
const BOOST_FUEL_GOLDEN = 1
/**
 * What a run opens with.
 *
 * A full tank meant four seconds of boost before eating anything, which is most
 * of the early game handed over before the player has done a thing to earn it.
 * Half is enough to find the control and feel what it does, and leaves the rest
 * to be filled a food at a time.
 */
const BOOST_FUEL_START = BOOST_FUEL_MAX / 2

/** Boost runs on the tank, so it stops when that is dry. */
export function isBoosting(s: Pick<GameState, 'boostHeld' | 'phase' | 'boostFuel'>) {
  return s.boostHeld && s.phase === 'playing' && s.boostFuel > 0
}

/** How full the tank is, 1 → 0. Drawn as the boost meter. */
export function boostFuelLeft(s: Pick<GameState, 'boostFuel'>) {
  return Math.max(0, Math.min(1, s.boostFuel / BOOST_FUEL_MAX))
}

/** Hold or release the boost control. */
export function setBoost(state: GameState, held: boolean): GameState {
  if (state.boostHeld === held) return state
  const next = { ...state, boostHeld: held }
  if (held && isBoosting(next)) sfx('whoosh')
  return next
}
/** Longest movement resolved between collision checks, so nothing is skipped over. */
const MAX_SUBSTEP = 0.35
/** Edge cell center — past this the head is in the wall buffer. */
const WALL_SOFT = 0.5
/**
 * Hard crash line past the soft edge. Travel between soft and hard (~0.28 cells)
 * is the reaction window, with no freeze.
 */
const WALL_HARD = 0.22

const START_SPEED = 6.2
/**
 * Pace, and how quickly it climbs.
 *
 * The ceiling is what a long body can still be steered at, not the fastest the
 * engine will run: boost multiplies this, so a 10 here meant 17.5 cells a
 * second with the tank open, which is past reading the board and into hoping.
 * The climb is gentle enough that the first twenty food barely feel it — the
 * difficulty in that stretch is meant to be the barriers and your own length.
 */
const MAX_SPEED = 8.5
const SPEED_PER_FOOD = 0.035

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

export const VEC: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

function rand(a = 0, b = 1) {
  return a + Math.random() * (b - a)
}

function dist(a: Cell, b: Cell) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Distance from p to the line segment ab. */
function distToSegment(p: Cell, a: Cell, b: Cell) {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const len2 = vx * vx + vy * vy
  if (len2 === 0) return dist(p, a)
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t))
}

function lerp(a: Cell, b: Cell, t: number): Cell {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Points every `spacing` cells back along the trail, starting at the head. */
export function sampleTrail(trail: Cell[], count: number, spacing: number): Cell[] {
  const out: Cell[] = []
  if (trail.length === 0 || count <= 0) return out

  out.push({ ...trail[0] })
  let acc = 0
  let target = spacing

  for (let i = 1; i < trail.length && out.length < count; i++) {
    const a = trail[i - 1]
    const b = trail[i]
    const segLen = dist(a, b)
    if (segLen === 0) continue
    while (acc + segLen >= target && out.length < count) {
      out.push(lerp(a, b, (target - acc) / segLen))
      target += spacing
    }
    acc += segLen
  }

  // Trail shorter than the body (just ate) — hold the tail until it catches up
  const last = out[out.length - 1] ?? trail[trail.length - 1]
  while (out.length < count) out.push({ ...last })
  return out
}

/** Drop trail past what the body can reach. */
function pruneTrail(trail: Cell[], keep: number) {
  let acc = 0
  for (let i = 1; i < trail.length; i++) {
    const segLen = dist(trail[i - 1], trail[i])
    if (segLen === 0) continue
    acc += segLen
    if (acc >= keep) {
      trail.length = i + 1
      return
    }
  }
}

/** How long the body is, head to tail tip, in cells. */
export function bodyLength(segments: number) {
  return (segments - 1) * SEG_SPACING
}

/**
 * The layout one more bite would bring, or null while that is further off.
 *
 * The level a run is about to reach is knowable — it is the next mouthful — so
 * there is no reason to spring it. Shown from the moment only one bite stands
 * between, which is the whole time it takes to go and get it.
 */
function nextLevelPreview(
  s: Pick<GameState, 'segments' | 'level' | 'cols' | 'rows'>,
): Set<string> | null {
  const next = levelFor(s.segments + 1, START_SEGMENTS)
  if (next === s.level) return null
  return wallsForLevel(next, s.cols, s.rows)
}

/** Pace for a body this long. Boost is applied on top, per frame. */
function speedFor(segments: number) {
  return Math.min(MAX_SPEED, START_SPEED + (segments - START_SEGMENTS) * SPEED_PER_FOOD)
}

/** True once the head overlaps its own body, ignoring the neck. */
function hitsBody(state: GameState) {
  const { trail, head } = state
  const maxDist = bodyLength(state.segments)
  if (maxDist <= NECK_SKIP) return false

  let acc = 0
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1]
    const b = trail[i]
    const segLen = dist(a, b)
    if (segLen === 0) continue

    const start = acc
    const end = acc + segLen
    acc = end
    if (end <= NECK_SKIP) continue
    if (start >= maxDist) break

    const from = start < NECK_SKIP ? lerp(a, b, (NECK_SKIP - start) / segLen) : a
    const to = end > maxDist ? lerp(a, b, (maxDist - start) / segLen) : b
    if (distToSegment(head, from, to) < HIT_DIST) return true
  }
  return false
}

type Grid = {
  cols: number
  rows: number
  /** 1 where a wall or the body is. The head's own cell is left open. */
  cells: Uint8Array
}

/** Walls and body as a grid, for anything that has to find its way around them. */
function occupancy(s: GameState): Grid {
  const cells = new Uint8Array(s.cols * s.rows)
  for (const key of s.walls) {
    const [x, y] = key.split(',').map(Number)
    cells[y * s.cols + x] = 1
  }
  const body = sampleTrail(s.trail, Math.ceil(bodyLength(s.segments) / 0.45) + 1, 0.45)
  for (const p of body) {
    const x = Math.floor(p.x)
    const y = Math.floor(p.y)
    if (x >= 0 && y >= 0 && x < s.cols && y < s.rows) cells[y * s.cols + x] = 1
  }
  const hx = Math.floor(s.head.x)
  const hy = Math.floor(s.head.y)
  if (hx >= 0 && hy >= 0 && hx < s.cols && hy < s.rows) cells[hy * s.cols + hx] = 0
  return { cols: s.cols, rows: s.rows, cells }
}

/** Steps from one cell to another around whatever is in the way, or null. */
function pathCells(grid: Grid, from: Cell, to: Cell): number | null {
  const { cols, rows, cells } = grid
  if (from.x === to.x && from.y === to.y) return 0
  const seen = new Int16Array(cols * rows).fill(-1)
  const start = from.y * cols + from.x
  if (start < 0 || start >= seen.length) return null
  seen[start] = 0
  const queue = [start]
  const goal = to.y * cols + to.x
  for (let q = 0; q < queue.length; q++) {
    const at = queue[q]
    const x = at % cols
    const y = (at - x) / cols
    const d = seen[at]
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      const k = ny * cols + nx
      if (seen[k] >= 0) continue
      if (k === goal) return d + 1
      if (cells[k]) continue
      seen[k] = d + 1
      queue.push(k)
    }
  }
  return null
}

function headCell(s: Pick<GameState, 'head'>): Cell {
  return { x: Math.floor(s.head.x), y: Math.floor(s.head.y) }
}

function randomFood(
  state: Pick<GameState, 'cols' | 'rows' | 'trail' | 'segments' | 'walls'> &
    Partial<Pick<GameState, 'golden' | 'mouse'>>,
): Cell {
  const body = sampleTrail(state.trail, state.segments * 2, SEG_SPACING * 0.5)
  const golden = state.golden
  const mouse = state.mouse

  const taken = (x: number, y: number) =>
    state.walls.has(wallKey(x, y)) ||
    (golden != null && golden.x === x && golden.y === y) ||
    (mouse != null && Math.hypot(mouse.x - (x + 0.5), mouse.y - (y + 0.5)) < 1.2)

  const pick = (clearance: number) => {
    const free: Cell[] = []
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        if (taken(x, y)) continue
        const center = { x: x + 0.5, y: y + 0.5 }
        if (body.every((seg) => dist(seg, center) > clearance)) free.push({ x, y })
      }
    }
    return free
  }

  // Scanned once and kept. Written as `pick(1.1).length ? pick(1.1) : …` it ran
  // the whole board twice on the path it takes nearly every time — a few
  // hundred cells against every bead of the body, at the moment of eating,
  // which is the worst moment to spend anything.
  const roomy = pick(1.1)
  const free = roomy.length ? roomy : pick(0.75)
  if (free.length) return free[Math.floor(Math.random() * free.length)]

  // Board this full: take any open cell at all, but never a walled one —
  // food inside a barrier is food that can never be eaten.
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (!state.walls.has(wallKey(x, y))) return { x, y }
    }
  }
  return { x: 0, y: 0 }
}

function pickKind(previous: FruitKind | null): FruitKind {
  const options = FRUIT_KINDS.filter((k) => k !== previous)
  return options[Math.floor(Math.random() * options.length)]
}

/** A new fruit, with a ring if there is a chain for it to carry on. */
function placeFruit(s: GameState, previous: FruitKind | null) {
  const cell = randomFood(s)
  let window = 0
  if (s.chain > 0) {
    const path = pathCells(occupancy(s), headCell(s), cell)
    const trip =
      path ?? (Math.abs(cell.x - Math.floor(s.head.x)) + Math.abs(cell.y - Math.floor(s.head.y))) * 1.6 + 3
    window = chainWindow(trip, s.speed, s.chain)
  }
  s.fruit = { x: cell.x, y: cell.y, kind: pickKind(previous), age: 0, window, live: window > 0 }
}

export function createInitialState(
  cols = COLS,
  rows = ROWS,
  dir: Dir = rows > cols ? 'down' : 'right',
): GameState {
  const head = { x: Math.floor(cols / 2) + 0.5, y: Math.floor(rows / 2) + 0.5 }
  const back = bodyLength(START_SEGMENTS) + 2
  const tail =
    dir === 'down'
      ? { x: head.x, y: head.y - back }
      : dir === 'up'
        ? { x: head.x, y: head.y + back }
        : dir === 'left'
          ? { x: head.x + back, y: head.y }
          : { x: head.x - back, y: head.y }
  const trail = [{ ...head }, tail]

  const base: GameState = {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    cols,
    rows,
    head,
    trail,
    dir,
    pendingDir: null,
    bufferedDir: null,
    lineBreak: false,
    segments: START_SEGMENTS,
    fruit: { x: 0, y: 0, kind: 'apple', age: 0, window: 0, live: false },
    golden: null,
    goldenTimer: GOLDEN_FIRST + rand(0, 4),
    mouse: null,
    mouseTimer: MOUSE_FIRST + rand(0, 6),
    chain: 0,
    bestChain: 0,
    speed: START_SPEED,
    boostHeld: false,
    boostFuel: BOOST_FUEL_START,
    // A run always opens on the empty board, so the first screen is never a
    // shape the player has to read before they have moved.
    level: 1,
    walls: wallsForLevel(1, cols, rows),
    dormant: new Set<string>(),
    nextWalls: null,
    levelAge: 99,
    time: 0,
    elapsed: 0,
    eaten: 0,
    flash: 0,
    flashTint: 'white',
    shake: 0,
    bulges: [],
    particles: [],
    floaters: [],
    banners: [],
    dying: 0,
    deathCause: null,
  }

  placeFruit(base, null)
  // The first fruit of a run is an apple: the one everybody knows a snake eats.
  base.fruit.kind = 'apple'
  return base
}

export function startGame(prev: GameState): GameState {
  const next = createInitialState(prev.cols, prev.rows)
  return {
    ...next,
    best: Math.max(prev.best, loadBest()),
    time: prev.time,
    phase: 'playing',
  }
}

/** Admin/testing: grow to a target length without placing food. */
export function jumpToLength(state: GameState, length: number): GameState {
  if (state.phase !== 'playing' && state.phase !== 'menu') return state
  const segments = Math.max(START_SEGMENTS, Math.floor(length) || START_SEGMENTS)
  const head = { ...state.head }
  const back = bodyLength(segments) + 2
  const dir = state.dir
  const tail =
    dir === 'down'
      ? { x: head.x, y: head.y - back }
      : dir === 'up'
        ? { x: head.x, y: head.y + back }
        : dir === 'left'
          ? { x: head.x + back, y: head.y }
          : { x: head.x - back, y: head.y }
  const next: GameState = {
    ...state,
    phase: 'playing',
    head,
    trail: [{ ...head }, tail],
    segments,
    score: Math.max(0, (segments - START_SEGMENTS) * FRUIT_POINTS),
    speed: speedFor(segments),
    pendingDir: null,
    bufferedDir: null,
    boostHeld: false,
    boostFuel: BOOST_FUEL_MAX,
    level: levelFor(segments, START_SEGMENTS),
    chain: 0,
    golden: null,
    mouse: null,
    bulges: [],
    floaters: [],
    banners: [],
  }
  // Jumping drops the snake straight into a later level's shape, so it gets
  // the same grace a live level change gives: whole layout, and whatever the
  // head landed inside stays quiet until it leaves.
  next.walls = wallsForLevel(next.level, next.cols, next.rows)
  next.dormant = dormantAtHead(next)
  next.nextWalls = nextLevelPreview(next)
  next.levelAge = 0
  placeFruit(next, state.fruit.kind)
  return next
}

function canTurn(from: Dir, next: Dir) {
  return next !== from && next !== OPPOSITE[from]
}

/**
 * Turns are taken at the next cell center so the snake always travels along
 * grid lanes. Two turns can be held, so quick inputs are never dropped.
 */
export function queueDir(state: GameState, next: Dir): GameState {
  if (state.phase !== 'playing' && state.phase !== 'menu') return state

  if (!state.pendingDir) {
    if (!canTurn(state.dir, next)) return state
    return { ...state, pendingDir: next }
  }

  if (!canTurn(state.pendingDir, next)) return state
  if (next === state.bufferedDir) return state
  return { ...state, bufferedDir: next }
}

const LEFT_OF: Record<Dir, Dir> = {
  up: 'left',
  left: 'down',
  down: 'right',
  right: 'up',
}

const RIGHT_OF: Record<Dir, Dir> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
}

/** Turn relative to the latest queued heading (left = counterclockwise). */
export function queueTurn(state: GameState, side: 'left' | 'right'): GameState {
  const from = state.bufferedDir ?? state.pendingDir ?? state.dir
  return queueDir(state, side === 'left' ? LEFT_OF[from] : RIGHT_OF[from])
}

// Effects --------------------------------------------------------------------

function emit(
  s: GameState,
  kind: ParticleKind,
  x: number,
  y: number,
  count: number,
  speed: number,
  size: number,
  tint: Tint,
  life: number,
) {
  for (let i = 0; i < count; i++) {
    if (s.particles.length >= MAX_PARTICLES) s.particles.shift()
    const a = Math.random() * Math.PI * 2
    const v = speed * (0.35 + Math.random() * 0.65)
    const maxLife = life * (0.6 + Math.random() * 0.6)
    s.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 1,
      maxLife,
      size: size * (0.6 + Math.random() * 0.7),
      tint,
      kind,
    })
  }
}

function floater(
  s: GameState,
  x: number,
  y: number,
  text: string,
  sub: string,
  tint: Tint,
  weight: number,
  maxLife = 1.05,
) {
  s.floaters.push({ x, y, text, sub, life: 1, maxLife, tint, weight })
}

function banner(s: GameState, text: string, sub: string, tint: Tint, life = 1.9) {
  // One at a time: a level and a chain landing together would talk over each other.
  if (s.banners.length >= 2) s.banners.shift()
  s.banners.push({ text, sub, tint, life, maxLife: life })
}

/** Always fresh arrays, so nothing pushed this frame lands in the state before it. */
function updateEffects(s: GameState, dt: number) {
  const particles: Particle[] = []
  for (const p of s.particles) {
    const life = p.life - dt / p.maxLife
    if (life <= 0) continue
    const drag = Math.exp(-dt * (p.kind === 'puff' ? 2.2 : 3.4))
    particles.push({
      ...p,
      life,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vx: p.vx * drag,
      vy: p.vy * drag,
    })
  }
  s.particles = particles
  s.floaters = s.floaters
    .map((f) => ({ ...f, y: f.y - dt * 0.9, life: f.life - dt / f.maxLife }))
    .filter((f) => f.life > 0)
  if (s.banners.length) {
    const [first, ...rest] = s.banners
    const life = first.life - dt
    s.banners = life > 0 ? [{ ...first, life }, ...rest] : rest
  } else {
    s.banners = []
  }
}

/** Notes of a major scale, in semitones: each link of a chain sings one higher. */
const CHAIN_NOTES = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16]

// Dying -------------------------------------------------------------------------

function die(state: GameState, cause: DeathCause): GameState {
  const best = Math.max(state.best, state.score)
  sfx('hurt')
  sfx('die')
  haptic('crash')
  const s: GameState = {
    ...state,
    phase: 'dying',
    best,
    pendingDir: null,
    bufferedDir: null,
    boostHeld: false,
    boostFuel: BOOST_FUEL_MAX,
    flash: 0.55,
    flashTint: 'red',
    shake: 1,
    dying: DYING_TIME,
    deathCause: cause,
    particles: [...state.particles],
  }
  emit(s, 'bit', s.head.x, s.head.y, 14, 4.2, 0.1, 'green', 0.7)
  emit(s, 'puff', s.head.x, s.head.y, 6, 1.6, 0.28, 'ink', 0.8)
  return s
}

/**
 * Move the head. While travelling a straight line the tip of the trail is just
 * dragged along; a direction change leaves the old tip behind as a vertex.
 */
function pushHead(s: GameState, head: Cell) {
  if (s.lineBreak) {
    s.trail.unshift(head)
    s.lineBreak = false
  } else {
    s.trail[0] = head
  }
  s.head = head
}

/** Distance along the current heading to the next cell center (0 if already on one). */
function toNextCenter(s: GameState) {
  const v = VEC[s.dir]
  const pos = v.x !== 0 ? s.head.x : s.head.y
  const ahead = v.x > 0 || v.y > 0
  const center = ahead
    ? Math.ceil(pos - 0.5 - 1e-9) + 0.5
    : Math.floor(pos - 0.5 + 1e-9) + 0.5
  return Math.abs(center - pos)
}

function stepForward(s: GameState, distance: number, landOnCenter: boolean) {
  const v = VEC[s.dir]
  const head = { x: s.head.x + v.x * distance, y: s.head.y + v.y * distance }
  if (landOnCenter) {
    // Set the exact value rather than accumulating, so lanes never drift
    if (v.x !== 0) head.x = Math.round(head.x - 0.5) + 0.5
    else head.y = Math.round(head.y - 0.5) + 0.5
  }
  pushHead(s, head)
}

function move(s: GameState, travel: number) {
  // A turn already sitting on a center fires right away; after that, the next
  // one has to wait for the following center so the snake can't fold in place.
  let turnHere = true

  for (let guard = 0; travel > 1e-12 && guard < 8; guard++) {
    if (s.pendingDir) {
      let gap = toNextCenter(s)
      if (gap < 1e-9 && !turnHere) gap = SEG_SPACING

      if (gap <= travel) {
        if (gap > 0) stepForward(s, gap, true)
        travel -= gap

        const next = s.pendingDir
        if (canTurn(s.dir, next)) {
          s.dir = next
          s.lineBreak = true
        }
        s.pendingDir = s.bufferedDir
        s.bufferedDir = null
        turnHere = false
        continue
      }
    }

    stepForward(s, travel, false)
    travel = 0
  }

  pruneTrail(s.trail, bodyLength(s.segments) + SEG_SPACING)
}

/**
 * The wait for a turn is just the travel time to the next cell center, so hurry
 * there while one is queued. The rate is constant for the whole approach —
 * scaling it to the remaining distance would decay and never arrive on time.
 */
function turnSpeed(s: GameState) {
  // Not multiplied together: the turn hurry is already a sprint to the next
  // centre, and stacking it on a boost would fling the head across the board
  // faster than anyone could read it.
  const hurry = Math.max(s.pendingDir ? TURN_BOOST : 1, isBoosting(s) ? BOOST_MULT : 1)
  return s.speed * hurry
}

/** Run the tank down for the speed being used. Score and body are untouched. */
function burnBoost(s: GameState, dt: number) {
  if (!isBoosting(s)) return
  s.boostFuel = Math.max(0, s.boostFuel - dt)
}

function pastHardWall(s: GameState) {
  return (
    s.head.x < WALL_HARD ||
    s.head.y < WALL_HARD ||
    s.head.x > s.cols - WALL_HARD ||
    s.head.y > s.rows - WALL_HARD
  )
}

/**
 * How far into a block the head gets before it counts as a crash.
 *
 * This is give, and it is the same quarter-cell the outer walls allow. It was
 * briefly taken away in the name of appearances — the head used to end up
 * buried three quarters deep, which looked like driving into a block rather
 * than hitting one — but that cost about fifty milliseconds of reaction, which
 * is most of a turn, to fix something the eye could have been told instead.
 *
 * So the two are separate now: this decides when you die, {@link BARRIER_REST}
 * decides where the snake is left lying.
 */
const BARRIER_GIVE = 0.24

/**
 * Where the head is put down once a block has killed it.
 *
 * Against the block's drawn edge rather than inside it. A bead is
 * {@link BEAD_SPACING} across and a block is drawn inset a little from its
 * cell, so resting the centre just outside leaves them touching. The step back
 * from wherever the frame landed happens under the crash flash, and reads as
 * the recoil of hitting something.
 */
const BARRIER_REST = BEAD_SPACING / 2 - 0.06 - 0.1

/**
 * The walled cell the head is standing in, if any.
 *
 * Deliberately the cell the head's centre falls in and nothing wider. The give
 * is measured inside that cell, so no neighbour can register — which is also
 * why running the lane alongside a block is never a crash.
 */
function wallUnderHead(s: GameState): string | null {
  if (s.walls.size === 0) return null
  const key = wallKey(Math.floor(s.head.x), Math.floor(s.head.y))
  return s.walls.has(key) ? key : null
}

/** The block the head is standing in when a layout lands, if there is one. */
function dormantAtHead(s: GameState): Set<string> {
  const key = wallUnderHead(s)
  return key ? new Set([key]) : new Set()
}

/**
 * Let a block go once the head has left its cell, so it can kill like the rest.
 *
 * Dormancy is per cell rather than per hit, or a block that arrived under a
 * head only barely inside it would wake while the head was still there and
 * kill it for moving deeper into where it was already standing.
 *
 * Done before the hit test, or a block would stay harmless for the one step in
 * which the head came back.
 */
function wakeBlocks(s: GameState) {
  if (s.dormant.size === 0) return
  const under = wallUnderHead(s)
  if (under && s.dormant.has(under) && s.dormant.size === 1) return
  s.dormant = under && s.dormant.has(under) ? new Set([under]) : new Set()
}

/** The block the head has run into, rather than merely reached, or null. */
function barrierHit(s: GameState): Cell | null {
  const key = wallUnderHead(s)
  if (!key || s.dormant.has(key)) return null
  const [cx, cy] = key.split(',').map(Number)
  if (
    s.head.x > cx + BARRIER_GIVE &&
    s.head.x < cx + 1 - BARRIER_GIVE &&
    s.head.y > cy + BARRIER_GIVE &&
    s.head.y < cy + 1 - BARRIER_GIVE
  ) {
    return { x: cx, y: cy }
  }
  return null
}

/**
 * Come to rest against the block instead of wherever the frame happened to
 * land. A step covers real ground, and the faster the snake the further past
 * the contact point it ends up — at boost speed that was half the head buried.
 * The step back is a few pixels and happens under the crash flash.
 */
function restAgainst(s: GameState, block: Cell) {
  const head = { ...s.head }
  if (s.dir === 'right') head.x = Math.min(head.x, block.x - BARRIER_REST)
  else if (s.dir === 'left') head.x = Math.max(head.x, block.x + 1 + BARRIER_REST)
  else if (s.dir === 'down') head.y = Math.min(head.y, block.y - BARRIER_REST)
  else head.y = Math.max(head.y, block.y + 1 + BARRIER_REST)
  s.head = head
  s.trail[0] = head
}

/** True while the head is nosing past the edge lane, before the hard crash. */
function inWallBuffer(s: GameState) {
  return (
    s.head.x < WALL_SOFT ||
    s.head.y < WALL_SOFT ||
    s.head.x > s.cols - WALL_SOFT ||
    s.head.y > s.rows - WALL_SOFT
  )
}

/**
 * A turn pressed in the wall buffer snaps back to the edge lane center so the
 * escape stays on-grid — no freeze, just a short overshoot.
 */
function escapeWall(s: GameState) {
  if (!s.pendingDir || !canTurn(s.dir, s.pendingDir)) return false
  s.head = {
    x: Math.min(Math.max(s.head.x, WALL_SOFT), s.cols - WALL_SOFT),
    y: Math.min(Math.max(s.head.y, WALL_SOFT), s.rows - WALL_SOFT),
  }
  s.trail[0] = s.head
  s.dir = s.pendingDir
  s.pendingDir = s.bufferedDir
  s.bufferedDir = null
  s.lineBreak = true
  return true
}

// Eating ------------------------------------------------------------------------

/** One more bead: pace, tank and the swallow on its way down. */
function grow(s: GameState, fuel: number) {
  s.segments += 1
  s.best = Math.max(s.best, s.score)
  s.speed = speedFor(s.segments)
  s.boostFuel = Math.min(BOOST_FUEL_MAX, s.boostFuel + fuel)
  s.bulges = [0, ...s.bulges]
}

/**
 * A new layout, whole, wherever the snake is. Only the blocks the head is
 * standing in hold their fire, and only until it has moved off them.
 */
function landLevel(s: GameState, level: number) {
  s.level = level
  s.walls = wallsForLevel(level, s.cols, s.rows)
  s.dormant = dormantAtHead(s)
  s.levelAge = 0
  s.flash = Math.max(s.flash, 0.3)
  s.flashTint = 'green'
  sfx('wave')
  banner(s, `Level ${level}`, levelName(level), 'green', 2.1)
  for (const key of s.walls) {
    const [x, y] = key.split(',').map(Number)
    emit(s, 'puff', x + 0.5, y + 0.5, 1, 0.9, 0.3, 'ink', 0.7)
  }
  // Anything standing where a block just came down is moved on.
  if (s.golden && s.walls.has(wallKey(s.golden.x, s.golden.y))) {
    emit(s, 'spark', s.golden.x + 0.5, s.golden.y + 0.5, 6, 2.4, 0.1, 'amber', 0.5)
    s.golden = null
    s.goldenTimer = rand(...GOLDEN_GAP) * 0.5
  }
  if (s.mouse) {
    const at = s.mouse.t < 0.5 ? s.mouse.from : s.mouse.to
    if (s.walls.has(wallKey(at.x, at.y))) {
      emit(s, 'puff', s.mouse.x, s.mouse.y, 5, 1.4, 0.26, 'ink', 0.6)
      s.mouse = null
      s.mouseTimer = rand(...MOUSE_GAP) * 0.5
    }
  }
  // A golden apple or a mouse can bring a level while a fruit is out.
  if (s.walls.has(wallKey(s.fruit.x, s.fruit.y))) placeFruit(s, s.fruit.kind)
}

function levelUp(s: GameState) {
  const level = levelFor(s.segments, START_SEGMENTS)
  if (level !== s.level) landLevel(s, level)
  s.nextWalls = nextLevelPreview(s)
}

function tryEat(s: GameState): boolean {
  const f = s.fruit
  const at = { x: f.x + 0.5, y: f.y + 0.5 }
  if (dist(s.head, at) >= EAT_DIST) return false

  const kept = f.live && f.window > 0
  s.chain = kept ? s.chain + 1 : 1
  s.bestChain = Math.max(s.bestChain, s.chain)
  const gained = fruitValue(s.chain)
  s.score += gained
  s.eaten += 1
  grow(s, BOOST_FUEL_PER_FOOD)

  const tint = FRUIT_TINT[f.kind]
  emit(s, 'bit', at.x, at.y, 9, 3, 0.085, tint, 0.55)
  emit(s, 'ring', at.x, at.y, 1, 0, 0.42, tint, 0.32)
  floater(
    s,
    at.x,
    at.y - 0.55,
    `+${gained}`,
    s.chain >= 2 ? `Chain ${s.chain}` : '',
    s.chain >= CHAIN_TOP ? 'amber' : 'ink',
    Math.min(1, 0.3 + s.chain / CHAIN_TOP),
  )
  sfx('eat')
  if (s.chain >= 2) sfx('hop', CHAIN_NOTES[Math.min(CHAIN_NOTES.length - 1, s.chain - 2)])

  if (s.chain === CHAIN_TOP) {
    banner(s, 'Top chain', `Every fruit +${fruitValue(CHAIN_TOP)} while it lasts`, 'amber', 1.9)
    sfx('perfect')
    s.flash = Math.max(s.flash, 0.3)
    s.flashTint = 'amber'
    emit(s, 'spark', s.head.x, s.head.y, 14, 4, 0.1, 'amber', 0.7)
  } else if (s.chain > CHAIN_TOP && s.chain % 10 === 0) {
    banner(s, `Chain ${s.chain}`, 'Still going', 'amber', 1.5)
    sfx('perfect')
    emit(s, 'spark', s.head.x, s.head.y, 12, 4, 0.1, 'amber', 0.7)
  }

  levelUp(s)
  // After the walls, so a new level never drops a fruit inside one.
  placeFruit(s, f.kind)
  return true
}

function tryEatGolden(s: GameState) {
  const g = s.golden
  if (!g) return
  const at = { x: g.x + 0.5, y: g.y + 0.5 }
  if (dist(s.head, at) >= EAT_DIST) return
  s.golden = null
  s.goldenTimer = rand(...GOLDEN_GAP)
  s.score += GOLDEN_POINTS
  grow(s, BOOST_FUEL_GOLDEN)
  emit(s, 'spark', at.x, at.y, 16, 4.4, 0.11, 'amber', 0.75)
  emit(s, 'ring', at.x, at.y, 1, 0, 0.6, 'amber', 0.4)
  floater(s, at.x, at.y - 0.6, `+${GOLDEN_POINTS}`, 'Golden apple', 'amber', 1, 1.3)
  s.flash = Math.max(s.flash, 0.28)
  s.flashTint = 'amber'
  sfx('good')
  levelUp(s)
}

function tryCatchMouse(s: GameState) {
  const m = s.mouse
  if (!m || !catchable(m)) return
  if (Math.hypot(s.head.x - m.x, s.head.y - m.y) >= MOUSE_EAT) return
  s.mouse = null
  s.mouseTimer = rand(...MOUSE_GAP)
  s.score += MOUSE_POINTS
  grow(s, BOOST_FUEL_MAX)
  // A mouse is a mouthful: it goes down as a bigger lump.
  s.bulges = [0, 0.18, ...s.bulges.slice(1)]
  emit(s, 'puff', m.x, m.y, 7, 2, 0.26, 'ink', 0.6)
  emit(s, 'spark', m.x, m.y, 12, 3.8, 0.1, 'pink', 0.6)
  emit(s, 'ring', m.x, m.y, 1, 0, 0.6, 'pink', 0.4)
  floater(s, m.x, m.y - 0.6, `+${MOUSE_POINTS}`, 'Caught! Tank full', 'pink', 1, 1.35)
  s.flash = Math.max(s.flash, 0.3)
  s.flashTint = 'pink'
  s.shake = Math.max(s.shake, 0.25)
  sfx('good')
  sfx('hop', 16)
  levelUp(s)
}

function breakChain(s: GameState) {
  const lost = s.chain
  s.chain = 0
  const f = s.fruit
  const at = { x: f.x + 0.5, y: f.y + 0.5 }
  // The ring comes apart where it was.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    s.particles.push({
      x: at.x + Math.cos(a) * 0.62,
      y: at.y + Math.sin(a) * 0.62,
      vx: Math.cos(a) * 1.4,
      vy: Math.sin(a) * 1.4,
      life: 1,
      maxLife: 0.45,
      size: 0.06,
      tint: 'amber',
      kind: 'bit',
    })
  }
  if (lost >= 2) {
    floater(s, at.x, at.y - 0.7, 'Chain lost', `×${lost}`, 'red', 0.45, 1.2)
    sfx('miss')
  }
}

// Golden apple and mouse ----------------------------------------------------------

function spawnGolden(s: GameState, grid: Grid) {
  const from = headCell(s)
  const mouse = s.mouse
  const spots: Cell[] = []
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if (grid.cells[y * s.cols + x]) continue
      if (Math.abs(x - s.fruit.x) + Math.abs(y - s.fruit.y) < 2) continue
      if (mouse && Math.hypot(mouse.x - (x + 0.5), mouse.y - (y + 0.5)) < 1.5) continue
      const far = Math.abs(x - from.x) + Math.abs(y - from.y)
      if (far < 5 || far > 17) continue
      spots.push({ x, y })
    }
  }
  if (!spots.length) {
    s.goldenTimer = 3
    return
  }
  const at = spots[Math.floor(Math.random() * spots.length)]
  s.golden = { x: at.x, y: at.y, age: 0, life: GOLDEN_LIFE }
  emit(s, 'spark', at.x + 0.5, at.y + 0.5, 8, 2.4, 0.09, 'amber', 0.5)
  sfx('tap')
}

function mouseWorld(s: GameState, grid: Grid): MouseWorld {
  const v = VEC[s.dir]
  return {
    cols: s.cols,
    rows: s.rows,
    blocked: (x, y) => grid.cells[y * s.cols + x] === 1,
    head: s.head,
    heading: v,
  }
}

function updateBonuses(s: GameState, dt: number) {
  // Built only when something needs to find its way around the board.
  let grid: Grid | null = null
  const occ = () => (grid ??= occupancy(s))

  if (s.golden) {
    const g = { ...s.golden, age: s.golden.age + dt }
    if (g.age >= g.life) {
      emit(s, 'spark', g.x + 0.5, g.y + 0.5, 6, 1.6, 0.08, 'amber', 0.45)
      s.golden = null
      s.goldenTimer = rand(...GOLDEN_GAP)
    } else {
      s.golden = g
    }
  } else {
    s.goldenTimer -= dt
    if (s.goldenTimer <= 0) spawnGolden(s, occ())
  }

  if (s.mouse) {
    const m = stepMouse(s.mouse, dt, mouseWorld(s, occ()), Math.random)
    if (m.mode === 'gone' && m.fade <= 0) {
      s.mouse = null
      s.mouseTimer = rand(...MOUSE_GAP)
    } else {
      s.mouse = m
    }
  } else {
    s.mouseTimer -= dt
    if (s.mouseTimer <= 0) {
      const world = mouseWorld(s, occ())
      const door = mouseDoor(world, Math.random)
      if (door) {
        s.mouse = createMouse(door, s.cols, s.rows, Math.floor(Math.random() * 1e6))
        sfx('hop', 14)
      } else {
        s.mouseTimer = 3
      }
    }
  }
}

// Tick --------------------------------------------------------------------------

export function tick(state: GameState, dt: number): GameState {
  const s = { ...state }
  s.time += dt
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.shake = Math.max(0, s.shake - dt * 2.8)
  updateEffects(s, dt)

  if (s.phase === 'dying') {
    s.dying = Math.max(0, s.dying - dt)
    if (s.dying <= 0) s.phase = 'gameover'
    return s
  }
  if (s.phase !== 'playing') return s

  s.elapsed += dt
  s.levelAge += dt

  // The ring runs down; let it close and the chain goes with it.
  const f = s.fruit
  s.fruit = { ...f, age: f.age + dt }
  if (s.fruit.live && s.fruit.age >= s.fruit.window) {
    s.fruit = { ...s.fruit, live: false }
    if (s.chain > 0) breakChain(s)
  }

  burnBoost(s, dt)
  updateBonuses(s, dt)

  // Swallowed bites travel to the tail in about a second and a half, however long it is.
  if (s.bulges.length) {
    const len = bodyLength(s.segments)
    const rate = Math.max(6, len / 1.5)
    s.bulges = s.bulges.map((b) => b + rate * dt).filter((b) => b < len + 0.5)
  }

  // Walk the frame in short hops so nothing can be passed over between checks,
  // however fast the snake is going or however long the frame took.
  let remaining = turnSpeed(s) * dt
  for (let guard = 0; remaining > 1e-9 && guard < 16; guard++) {
    const hop = Math.min(remaining, MAX_SUBSTEP)
    remaining -= hop

    // Turn out of the wall buffer before moving, so we never aim at a center
    // past the board edge.
    if (inWallBuffer(s)) escapeWall(s)

    move(s, hop)

    if (pastHardWall(s)) return die(s, 'wall')
    wakeBlocks(s)
    const block = barrierHit(s)
    if (block) {
      restAgainst(s, block)
      return die(s, 'block')
    }
    if (hitsBody(s)) return die(s, 'self')
    tryEat(s)
    tryEatGolden(s)
    tryCatchMouse(s)
  }

  return s
}

/** Segment top-left corners in grid units, head first. */
export function visualSegments(state: GameState): Cell[] {
  const points = sampleTrail(state.trail, state.segments, BEAD_SPACING)
  return points.map((p) => ({ x: p.x - 0.5, y: p.y - 0.5 }))
}

/** How much of the fruit's ring is left, 1 → 0; 0 when it has none. */
export function ringLeft(f: Fruit) {
  if (!f.live || f.window <= 0) return 0
  return Math.max(0, Math.min(1, 1 - f.age / f.window))
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    length: s.segments,
    boosting: isBoosting(s),
    level: s.level,
    canBoost: s.phase === 'playing' && s.boostFuel > 0,
    fuel: boostFuelLeft(s),
    chain: s.chain,
    deathCause: s.deathCause,
  }
}
