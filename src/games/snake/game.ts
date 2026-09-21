import { getPersonalBest } from '../../lib/personalBest'
import { haptic } from '../../lib/haptics'
import { sfx } from '../../lib/sound'
import {
  assertLevelsAreOpen,
  levelFor,
  wallKey,
  wallsForLevel,
} from './levels'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'gameover'

export type Cell = { x: number; y: number }

export type Floater = {
  x: number
  y: number
  text: string
  life: number
}

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
  /** Number of body segments (grows with score). */
  segments: number
  food: Cell
  /** Seconds since the current food appeared — drives the freshness bonus. */
  foodAge: number
  /** Cells per second. */
  speed: number
  /** Boost control held. Whether it is actually paying out is {@link isBoosting}. */
  boostHeld: boolean
  /** Seconds of boost left in the tank. Filled by eating, drained by holding. */
  boostFuel: number
  /** Rises every ten food, and brings the next barrier layout with it. */
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
   * The layout the next food will bring, once there is only one to go.
   *
   * Drawn ahead of itself so a level is something you steer around rather than
   * something that happens to you.
   */
  nextWalls: Set<string> | null
  flash: number
  floaters: Floater[]
}

function loadBest() {
  return getPersonalBest('snake')
}

function saveBest(_score: number) {}

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
const SCORE_FOOD = 10

/**
 * Food is worth more the sooner you reach it.
 *
 * Without this the score is a straight function of survival time, so the board
 * ranks patience rather than play. With it every pickup is a choice — the safe
 * loop or the tight line past your own tail — and the choice sharpens as the
 * body grows, which is exactly where a long run used to go flat.
 */
const HUNGER_MAX = 20
/** Seconds from a food appearing to its bonus reaching zero. */
const HUNGER_WINDOW = 3.6
/** Bonus granularity, so the floater reads +30 / +25 / +20, never +27. */
const HUNGER_STEP = 5

/**
 * Bonus still on the current food, in points.
 *
 * Banded upward, not downward: you are always travelling when you arrive, so a
 * band measured from the top would leave the full bonus reachable only at the
 * instant the food appeared — a number on the board that nobody could ever
 * score. Each band is a real quarter of the window instead.
 */
export function foodBonus(foodAge: number): number {
  const left = foodBonusLeft(foodAge)
  if (left <= 0) return 0
  const bands = HUNGER_MAX / HUNGER_STEP
  return Math.ceil(left * bands) * HUNGER_STEP
}

/** How much of the bonus window is left, 1 → 0. Drawn as the ring on the food. */
export function foodBonusLeft(foodAge: number): number {
  return Math.max(0, Math.min(1, 1 - foodAge / HUNGER_WINDOW))
}


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
 * two cells of gained ground — enough to change which band of the ring you
 * reach the next one in, and not enough to hold the boost open. Refilling
 * faster than this made boost a thing you always had, and a thing you always
 * have is a speed setting, not a decision.
 */
const BOOST_FUEL_PER_FOOD = 0.5

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
  return { ...state, boostHeld: held }
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

const VEC: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
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
function sampleTrail(trail: Cell[], count: number, spacing: number): Cell[] {
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

function bodyLength(segments: number) {
  return (segments - 1) * SEG_SPACING
}

/**
 * The layout one more food would bring, or null while that is further off.
 *
 * The level a run is about to reach is knowable — it is the next mouthful — so
 * there is no reason to spring it. Shown from the moment only one food stands
 * between, which is the whole time it takes to go and get that food.
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

function randomFood(
  state: Pick<GameState, 'cols' | 'rows' | 'trail' | 'segments' | 'walls'>,
): Cell {
  const body = sampleTrail(state.trail, state.segments * 2, SEG_SPACING * 0.5)

  const pick = (clearance: number) => {
    const free: Cell[] = []
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        if (state.walls.has(wallKey(x, y))) continue
        const center = { x: x + 0.5, y: y + 0.5 }
        if (body.every((seg) => dist(seg, center) > clearance)) free.push({ x, y })
      }
    }
    return free
  }

  const free = pick(1.1).length ? pick(1.1) : pick(0.75)
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
    food: { x: 0, y: 0 },
    foodAge: 0,
    speed: START_SPEED,
    boostHeld: false,
    boostFuel: BOOST_FUEL_MAX,
    // A run always opens on the empty board, so the first screen is never a
    // shape the player has to read before they have moved.
    level: 1,
    walls: wallsForLevel(1, cols, rows),
    dormant: new Set<string>(),
    nextWalls: null,
    flash: 0,
    floaters: [],
  }

  return { ...base, food: randomFood(base) }
}

export function startGame(prev: GameState): GameState {
  const next = createInitialState(prev.cols, prev.rows)
  return {
    ...next,
    best: Math.max(prev.best, loadBest()),
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
    score: Math.max(0, (segments - START_SEGMENTS) * SCORE_FOOD),
    speed: speedFor(segments),
    pendingDir: null,
    bufferedDir: null,
    boostHeld: false,
    boostFuel: BOOST_FUEL_MAX,
    level: levelFor(segments, START_SEGMENTS),
    floaters: [],
  }
  // Jumping drops the snake straight into a later level's shape, so it gets
  // the same grace a live level change gives: whole layout, and whatever the
  // head landed inside stays quiet until it leaves.
  next.walls = wallsForLevel(next.level, next.cols, next.rows)
  next.dormant = dormantAtHead(next)
  next.nextWalls = nextLevelPreview(next)
  next.food = randomFood(next)
  next.foodAge = 0
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

function die(state: GameState): GameState {
  const best = Math.max(state.best, state.score)
  saveBest(best)
  sfx('die')
  haptic('crash')
  return {
    ...state,
    phase: 'gameover',
    best,
    pendingDir: null,
    bufferedDir: null,
    boostHeld: false,
    boostFuel: BOOST_FUEL_MAX,
    flash: 0.4,
  }
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

function tryEat(s: GameState, previousBest: number) {
  const foodCenter = { x: s.food.x + 0.5, y: s.food.y + 0.5 }
  if (dist(s.head, foodCenter) >= EAT_DIST) return

  const bonus = foodBonus(s.foodAge)
  const gained = SCORE_FOOD + bonus

  sfx('eat')
  s.segments += 1
  s.score += gained
  s.best = Math.max(s.best, s.score)
  if (s.best !== previousBest) saveBest(s.best)
  s.speed = speedFor(s.segments)
  // The loop pays for itself: eating buys the speed that catches the next one
  // while its ring is still full. Capped, so a hoarded tank is wasted fuel.
  s.boostFuel = Math.min(BOOST_FUEL_MAX, s.boostFuel + BOOST_FUEL_PER_FOOD)

  const level = levelFor(s.segments, START_SEGMENTS)
  if (level !== s.level) {
    s.level = level
    // The whole shape, every time. Only the blocks the head is standing in
    // when they land are held back, and only until it has moved off them.
    s.walls = wallsForLevel(level, s.cols, s.rows)
    s.dormant = dormantAtHead(s)
    s.flash = 0.5
    s.floaters = [
      ...s.floaters,
      { x: s.head.x, y: s.head.y - 1.2, text: `LEVEL ${level}`, life: 1.4 },
    ]
  }
  s.nextWalls = nextLevelPreview(s)

  // After the walls, so a new level never drops food inside one.
  s.food = randomFood(s)
  s.foodAge = 0
  // A clean full-bonus grab flashes harder, so the good line is felt, not read.
  s.flash = bonus === HUNGER_MAX ? 0.42 : 0.28
  s.floaters = [
    ...s.floaters,
    { x: s.head.x, y: s.head.y - 0.3, text: `+${gained}`, life: 0.9 },
  ]
}

export function tick(state: GameState, dt: number): GameState {
  const s = { ...state }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.floaters = s.floaters
    .map((f) => ({ ...f, y: f.y - 0.7 * dt, life: f.life - dt * 1.2 }))
    .filter((f) => f.life > 0)

  if (s.phase !== 'playing') return s

  s.foodAge += dt
  burnBoost(s, dt)

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

    if (pastHardWall(s)) return die(s)
    wakeBlocks(s)
    const block = barrierHit(s)
    if (block) {
      restAgainst(s, block)
      return die(s)
    }
    if (hitsBody(s)) return die(s)
    tryEat(s, state.best)
  }

  return s
}

/** Segment top-left corners in grid units, head first. */
export function visualSegments(state: GameState): Cell[] {
  const points = sampleTrail(state.trail, state.segments, BEAD_SPACING)
  return points.map((p) => ({ x: p.x - 0.5, y: p.y - 0.5 }))
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
  }
}
