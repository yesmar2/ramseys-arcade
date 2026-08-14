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
  /** Cells per second. */
  speed: number
  flash: number
  floaters: Floater[]
}

const BEST_KEY = 'snake-best'
export const COLS = 21
export const ROWS = 15
const START_SEGMENTS = 3
const SCORE_FOOD = 10

/** Distance between body segment centers. */
const SEG_SPACING = 1
/** Extra samples drawn per segment so the body reads as one tube around corners. */
const RENDER_STEPS = 2
/** Body length near the head that can't kill you. */
const NECK_SKIP = 1.5
const HIT_DIST = 0.68
const EAT_DIST = 0.55

/** Speed multiplier while a turn is queued, to shorten the wait for the next center. */
const TURN_BOOST = 2
/** Longest movement resolved between collision checks, so nothing is skipped over. */
const MAX_SUBSTEP = 0.35
/** Edge cell center — past this the head is in the wall buffer. */
const WALL_SOFT = 0.5
/**
 * Hard crash line past the soft edge. Travel between soft and hard (~0.28 cells)
 * is the reaction window, with no freeze.
 */
const WALL_HARD = 0.22

const START_SPEED = 7
const MAX_SPEED = 14.3
const SPEED_PER_FOOD = 0.16

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

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0
  } catch {
    return 0
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    /* ignore */
  }
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

function randomFood(state: Pick<GameState, 'cols' | 'rows' | 'trail' | 'segments'>): Cell {
  const body = sampleTrail(state.trail, state.segments * 2, SEG_SPACING * 0.5)

  const pick = (clearance: number) => {
    const free: Cell[] = []
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const center = { x: x + 0.5, y: y + 0.5 }
        if (body.every((seg) => dist(seg, center) > clearance)) free.push({ x, y })
      }
    }
    return free
  }

  const free = pick(1.1).length ? pick(1.1) : pick(0.75)
  if (free.length === 0) return { x: 0, y: 0 }
  return free[Math.floor(Math.random() * free.length)]
}

export function createInitialState(cols = COLS, rows = ROWS): GameState {
  const head = { x: Math.floor(cols / 2) + 0.5, y: Math.floor(rows / 2) + 0.5 }
  const trail = [
    { ...head },
    { x: head.x - (bodyLength(START_SEGMENTS) + 2), y: head.y },
  ]

  const base: GameState = {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    cols,
    rows,
    head,
    trail,
    dir: 'right',
    pendingDir: null,
    bufferedDir: null,
    lineBreak: false,
    segments: START_SEGMENTS,
    food: { x: 0, y: 0 },
    speed: START_SPEED,
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

function die(state: GameState): GameState {
  const best = Math.max(state.best, state.score)
  saveBest(best)
  return {
    ...state,
    phase: 'gameover',
    best,
    pendingDir: null,
    bufferedDir: null,
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
  return s.pendingDir ? s.speed * TURN_BOOST : s.speed
}

function pastHardWall(s: GameState) {
  return (
    s.head.x < WALL_HARD ||
    s.head.y < WALL_HARD ||
    s.head.x > s.cols - WALL_HARD ||
    s.head.y > s.rows - WALL_HARD
  )
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

  s.segments += 1
  s.score += SCORE_FOOD
  s.best = Math.max(s.best, s.score)
  if (s.best !== previousBest) saveBest(s.best)
  s.speed = Math.min(MAX_SPEED, START_SPEED + (s.segments - START_SEGMENTS) * SPEED_PER_FOOD)
  s.food = randomFood(s)
  s.flash = 0.28
  s.floaters = [
    ...s.floaters,
    { x: s.head.x, y: s.head.y - 0.3, text: `+${SCORE_FOOD}`, life: 0.9 },
  ]
}

export function tick(state: GameState, dt: number): GameState {
  const s = { ...state }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.floaters = s.floaters
    .map((f) => ({ ...f, y: f.y - 0.7 * dt, life: f.life - dt * 1.2 }))
    .filter((f) => f.life > 0)

  if (s.phase !== 'playing') return s

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
    if (hitsBody(s)) return die(s)
    tryEat(s, state.best)
  }

  return s
}

/** Segment top-left corners in grid units, head first. */
export function visualSegments(state: GameState): Cell[] {
  const count = (state.segments - 1) * RENDER_STEPS + 1
  const points = sampleTrail(state.trail, count, SEG_SPACING / RENDER_STEPS)
  return points.map((p) => ({ x: p.x - 0.5, y: p.y - 0.5 }))
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    length: s.segments,
  }
}
