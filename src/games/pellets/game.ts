import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'
import { buildLevelMaze, mazeDims, type Cell, type Maze } from './maze'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'dying' | 'clearing' | 'gameover'
export type GhostMode = 'den' | 'leaving' | 'chase' | 'scatter' | 'frightened' | 'eaten'
export type GhostKind = 'blink' | 'pink' | 'inky' | 'clyde'

export type Ghost = {
  kind: GhostKind
  x: number
  y: number
  dir: Dir
  mode: GhostMode
  /** Home corner for scatter laps. */
  corner: Cell
  /** Seconds left waiting in the den. */
  denTimer: number
  /** Idle bob so penned chasers don't look frozen. */
  bob: number
  /** 0..1 knockback flash after a surge hit. */
  hit: number
}

/** How a pop reads: a score, the streak paying more, a streak lost, a chaser eaten. */
export type PopTone = 'ink' | 'streak' | 'lost' | 'ghost' | 'fruit'

export type Pop = { x: number; y: number; life: number; maxLife: number; text: string; tone: PopTone }
export type TrailDot = { x: number; y: number; life: number }
/** A crumb just eaten: a ring opening out where it was. */
export type Bite = { x: number; y: number; life: number; power: boolean }

/** Debris and light, in tile units. */
export type Bit = {
  kind: 'spark' | 'shard'
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

export type Ring = { x: number; y: number; r0: number; r1: number; life: number; maxLife: number; hue: number }

/**
 * The bonus under the den. Classic Pac-Man puts one there twice a maze, and it
 * is the only reason on the board to go back to the middle on purpose.
 */
export type FruitKind = 'cherry' | 'berry' | 'orange' | 'apple' | 'melon' | 'bell' | 'key'
export type Fruit = { kind: FruitKind; x: number; y: number; life: number; maxLife: number; value: number }

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  lives: number
  level: number
  crumbsLeft: number
  surge: number
  surgeTime: number
  crumbStreak: number
  crumbStreakBest: number
  /** What the streak is paying right now. */
  mult: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  lives: number
  level: number
  cols: number
  rows: number
  open: boolean[][]
  door: boolean[][]
  crumbs: boolean[][]
  power: boolean[][]
  crumbsLeft: number
  /** Crumbs and power pips the maze started with, for when the fruit comes. */
  crumbsTotal: number
  house: Maze['house']
  houseCenter: Cell
  ghostExit: Cell
  start: Cell
  player: { x: number; y: number; dir: Dir; pending: Dir | null; pendingAge: number }
  ghosts: Ghost[]
  /** Seconds of frightened mode remaining. */
  fright: number
  /** Chasers eaten in this fright streak, for the score ladder. */
  frightEaten: number
  mode: 'chase' | 'scatter'
  modeTimer: number
  /** Surge charge, 0..1. */
  surge: number
  /** Seconds of surge remaining. */
  surgeTime: number
  /** Chasers bounced during this surge. */
  surgeHits: number
  /** Fresh crumbs eaten without crossing a picked-clean tile. */
  crumbStreak: number
  /** Longest crumb streak this run — the record book's number. Survives deaths. */
  crumbStreakBest: number
  /** Tile the player was in last frame, so streaks only count new ground. */
  lastTile: Cell
  /** Seconds of "Ready!" left: nothing moves, but a turn can be queued. */
  ready: number
  /** Seconds of the beat after eating a chaser, when the board holds still. */
  freeze: number
  fruit: Fruit | null
  /** Fruit offered on this maze so far. */
  fruitsShown: number
  trail: TrailDot[]
  pops: Pop[]
  bites: Bite[]
  bits: Bit[]
  rings: Ring[]
  shake: number
  deathAnim: number
  clearAnim: number
  invuln: number
  /** Chomp phase. It only runs while the player is actually moving. */
  mouth: number
  time: number
}

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

/** Arcade tie-break order when two routes are the same length. */
const DIRS: Dir[] = ['up', 'left', 'down', 'right']

const SCORE_CRUMB = 10
const SCORE_POWER = 50
const SCORE_GHOST = [200, 400, 800, 1600]
const SCORE_SURGE = [150, 300, 600, 1200]
const START_LIVES = 3
const FRIGHT_TIME = 6.5

const PLAYER_SPEED = 5.2
const GHOST_SPEED = 3.9
const FRIGHT_SPEED = 2.7
const EATEN_SPEED = 9
const SURGE_SPEED = 1.85

export const DEATH_TIME = 1.25
export const CLEAR_TIME = 2.1
/** How long the walls flash when a maze is cleared, inside CLEAR_TIME. */
export const CLEAR_FLASH = 1.3
/** "Ready!" at the start of a maze, and after a life is lost. */
export const READY_TIME = 1.6
const READY_AGAIN = 1.2
/** A short grace once play resumes, in case a chaser is already close. */
const RESPAWN_INVULN = 0.5
/** The beat the board holds when a chaser is eaten, so the moment lands. */
const EAT_FREEZE = 0.32
/** Crumbs needed to fill the surge meter. */
const SURGE_CRUMBS = 26
const SURGE_TIME = 1.7
/** Clean crumbs per multiplier step up to x4. */
const STREAK_STEP = 10
const MAX_MULT = 4
/**
 * Past x4 the steps get longer, but they do not stop, the same as Crumbtrail.
 * A streak of a hundred used to pay exactly what a streak of thirty did, so
 * the route that kept it alive was being walked for nothing.
 */
const LATE_STEP = 30
const MAX_MULT_LATE = 8
/** Every hundred fresh crumbs in a row sends the whole board running. */
const STREAK_LANDMARK = 100
const SCORE_LANDMARK = 1000

/**
 * Fruit: offered when a third, and then two thirds, of the maze is eaten, for
 * a little under ten seconds. Worth more on later mazes, but kept well short of
 * the arcade's thousands, so a deep run cannot outpace what the boards accept.
 */
const FRUIT_AT = [0.3, 0.68] as const
const FRUIT_LIFE = 9
const FRUIT_LADDER: readonly { kind: FruitKind; value: number }[] = [
  { kind: 'cherry', value: 100 },
  { kind: 'berry', value: 200 },
  { kind: 'orange', value: 300 },
  { kind: 'apple', value: 500 },
  { kind: 'melon', value: 700 },
  { kind: 'bell', value: 1000 },
  { kind: 'key', value: 1500 },
]

/** How far past a junction a late turn still counts — the "forgiving" feel. */
const LATE_TURN = 0.34
const CENTER_EPS = 0.001
/** Steering input goes stale so you never get a surprise turn later. */
const PENDING_TTL = 1.1

/** The player's colour, the chasers', and the crumbs', as hues. */
export const PLAYER_HUE = 24
export const CRUMB_HUE = 42
export const GHOST_HUE: Record<GhostKind, number> = {
  blink: 356,
  pink: 322,
  inky: 188,
  // Green, not the arcade's orange: orange is the player here.
  clyde: 146,
}

function loadBest() {
  return getPersonalBest('pellets')
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  return (ax - bx) ** 2 + (ay - by) ** 2
}

export function pelletsViewport() {
  const w = typeof window === 'undefined' ? 900 : window.innerWidth
  const h = typeof window === 'undefined' ? 600 : window.innerHeight
  return mazeDims(w, h)
}

function tileOpen(state: GameState, x: number, y: number, allowDoor: boolean) {
  if (y < 0 || y >= state.rows || x < 0 || x >= state.cols) return false
  if (!state.open[y][x]) return false
  if (state.door[y][x] && !allowDoor) return false
  return true
}

/** Neighbour tile in `dir`, wrapping through side tunnels. Null when blocked. */
function stepTile(state: GameState, x: number, y: number, dir: Dir, allowDoor: boolean) {
  const v = VEC[dir]
  let nx = x + v.x
  let ny = y + v.y
  let wrapped = false
  if (nx < 0 || nx >= state.cols) {
    if (!state.open[y]?.[0] || !state.open[y]?.[state.cols - 1]) return null
    nx = (nx + state.cols) % state.cols
    wrapped = true
  }
  if (ny < 0 || ny >= state.rows) {
    if (!state.open[0]?.[x] || !state.open[state.rows - 1]?.[x]) return null
    ny = (ny + state.rows) % state.rows
    wrapped = true
  }
  if (!tileOpen(state, nx, ny, allowDoor)) return null
  return { x: nx, y: ny, wrapped }
}

/**
 * Breadth-first distance field from `target`. Chasers walk downhill on this,
 * which is why they can't orbit a corner or stall in a pocket the way a
 * greedy straight-line chase does.
 */
function distanceField(state: GameState, target: Cell, allowDoor: boolean) {
  const { cols, rows } = state
  const field = new Int32Array(cols * rows).fill(-1)
  const start = nearestOpen(state, target, allowDoor)
  if (!start) return field
  const queue = new Int32Array(cols * rows)
  let head = 0
  let tail = 0
  const startIdx = start.y * cols + start.x
  field[startIdx] = 0
  queue[tail++] = startIdx

  while (head < tail) {
    const idx = queue[head++]
    const x = idx % cols
    const y = (idx - x) / cols
    const d = field[idx]
    for (const dir of DIRS) {
      const next = stepTile(state, x, y, dir, allowDoor)
      if (!next) continue
      const nIdx = next.y * cols + next.x
      if (field[nIdx] !== -1) continue
      field[nIdx] = d + 1
      queue[tail++] = nIdx
    }
  }
  return field
}

/** Chase targets can land inside a wall — walk out to the closest open tile. */
function nearestOpen(state: GameState, cell: Cell, allowDoor: boolean): Cell | null {
  const cx = Math.max(0, Math.min(state.cols - 1, Math.round(cell.x)))
  const cy = Math.max(0, Math.min(state.rows - 1, Math.round(cell.y)))
  if (tileOpen(state, cx, cy, allowDoor)) return { x: cx, y: cy }
  const span = Math.max(state.cols, state.rows)
  for (let r = 1; r < span; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = cx + dx
        const y = cy + dy
        if (tileOpen(state, x, y, allowDoor)) return { x, y }
      }
    }
  }
  return null
}

function ghostCorners(cols: number, rows: number): Record<GhostKind, Cell> {
  // Outside the maze so scatter chasers never "arrive" and ping-pong on a tile.
  // They keep pathing toward the corner and lap the accessible ring instead.
  return {
    blink: { x: cols + 1, y: -2 },
    pink: { x: -2, y: -2 },
    inky: { x: cols + 1, y: rows + 1 },
    clyde: { x: -2, y: rows + 1 },
  }
}

function denSlots(maze: Maze) {
  const { houseCenter, house } = maze
  const spread = Math.max(1, Math.floor((house.maxX - house.minX) / 2))
  return [
    { x: houseCenter.x, y: houseCenter.y },
    { x: houseCenter.x - spread, y: houseCenter.y },
    { x: houseCenter.x + spread, y: houseCenter.y },
    { x: houseCenter.x, y: Math.min(house.maxY, houseCenter.y + 1) },
  ]
}

function makeGhosts(maze: Maze, level: number): Ghost[] {
  const kinds: GhostKind[] = ['blink', 'pink', 'inky', 'clyde']
  const corners = ghostCorners(maze.cols, maze.rows)
  const slots = denSlots(maze)
  const stagger = Math.max(0.6, 2.4 - (level - 1) * 0.25)
  return kinds.map((kind, i) => ({
    kind,
    x: slots[i].x + 0.5,
    y: slots[i].y + 0.5,
    dir: i % 2 === 0 ? 'up' : 'down',
    // Blink leads the pack; the rest peel out on a stagger.
    mode: i === 0 ? 'leaving' : 'den',
    corner: corners[kind],
    denTimer: i === 0 ? 0 : stagger * i,
    bob: Math.random() * Math.PI * 2,
    hit: 0,
  }))
}

/** Boards differ, so face the player down whichever lane the start tile opens on. */
function startDir(maze: Maze): Dir {
  const { x, y } = maze.start
  const at = (dx: number, dy: number) =>
    maze.open[y + dy]?.[(x + dx + maze.cols) % maze.cols] ?? false
  if (at(-1, 0)) return 'left'
  if (at(1, 0)) return 'right'
  if (at(0, -1)) return 'up'
  return 'down'
}

function applyMaze(state: GameState, maze: Maze) {
  state.cols = maze.cols
  state.rows = maze.rows
  state.open = maze.open
  state.door = maze.door
  state.house = maze.house
  state.houseCenter = maze.houseCenter
  state.ghostExit = maze.ghostExit
  state.start = maze.start
  state.crumbs = Array.from({ length: maze.rows }, () =>
    Array.from({ length: maze.cols }, () => false),
  )
  state.power = Array.from({ length: maze.rows }, () =>
    Array.from({ length: maze.cols }, () => false),
  )
  for (const c of maze.crumbs) state.crumbs[c.y][c.x] = true
  for (const c of maze.power) state.power[c.y][c.x] = true
  state.crumbsLeft = maze.crumbs.length + maze.power.length
  state.crumbsTotal = state.crumbsLeft
  state.fruit = null
  state.fruitsShown = 0
}

function resetActors(state: GameState, maze: Maze, ready: number) {
  state.player.x = maze.start.x + 0.5
  state.player.y = maze.start.y + 0.5
  state.player.dir = startDir(maze)
  state.player.pending = null
  state.player.pendingAge = 0
  state.ghosts = makeGhosts(maze, state.level)
  state.fright = 0
  state.frightEaten = 0
  state.surgeTime = 0
  state.surgeHits = 0
  state.crumbStreak = 0
  state.lastTile = { x: maze.start.x, y: maze.start.y }
  state.trail = []
  state.invuln = RESPAWN_INVULN
  state.ready = ready
  state.freeze = 0
  state.mode = 'scatter'
  state.modeTimer = scatterTime(state.level)
}

function emptyState(maze: Maze): GameState {
  const state = {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    lives: START_LIVES,
    level: 1,
    cols: maze.cols,
    rows: maze.rows,
    open: maze.open,
    door: maze.door,
    crumbs: [],
    power: [],
    crumbsLeft: 0,
    crumbsTotal: 0,
    house: maze.house,
    houseCenter: maze.houseCenter,
    ghostExit: maze.ghostExit,
    start: maze.start,
    player: {
      x: maze.start.x + 0.5,
      y: maze.start.y + 0.5,
      dir: startDir(maze),
      pending: null,
      pendingAge: 0,
    },
    ghosts: makeGhosts(maze, 1),
    fright: 0,
    frightEaten: 0,
    mode: 'scatter',
    modeTimer: scatterTime(1),
    surge: 0,
    surgeTime: 0,
    surgeHits: 0,
    crumbStreak: 0,
    crumbStreakBest: 0,
    lastTile: { x: maze.start.x, y: maze.start.y },
    ready: 0,
    freeze: 0,
    fruit: null,
    fruitsShown: 0,
    trail: [],
    pops: [],
    bites: [],
    bits: [],
    rings: [],
    shake: 0,
    deathAnim: 0,
    clearAnim: 0,
    invuln: 0,
    mouth: 0.6,
    time: 0,
  } as GameState
  applyMaze(state, maze)
  return state
}

export function createInitialState(_view?: { cols?: number; rows?: number }): GameState {
  return emptyState(buildLevelMaze(1))
}

export function startGame(prev: GameState, _view?: { cols?: number; rows?: number }): GameState {
  const next = createInitialState()
  next.best = Math.max(prev.best, loadBest())
  next.phase = 'playing'
  next.ready = READY_TIME
  next.invuln = RESPAWN_INVULN
  return next
}

/** Admin/testing: jump straight into a level without clear bonuses. */
export function jumpToLevel(state: GameState, level: number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover') return state
  const nextLevel = Math.max(1, Math.floor(level) || 1)
  const maze = buildLevelMaze(nextLevel)
  const next: GameState = {
    ...state,
    phase: 'playing',
    level: nextLevel,
    deathAnim: 0,
    clearAnim: 0,
    pops: [],
    bites: [],
    bits: [],
    rings: [],
  }
  applyMaze(next, maze)
  resetActors(next, maze, READY_TIME)
  return next
}

export function queueDir(state: GameState, dir: Dir): GameState {
  if (state.phase !== 'playing') return state
  return { ...state, player: { ...state.player, pending: dir, pendingAge: 0 } }
}

export function surgeReady(state: GameState) {
  return state.phase === 'playing' && state.ready <= 0 && state.surgeTime <= 0 && state.surge >= 1
}

export function triggerSurge(state: GameState): GameState {
  if (!surgeReady(state)) return state
  sfx('whoosh')
  const next = { ...state, surge: 0, surgeTime: SURGE_TIME, surgeHits: 0, rings: state.rings.slice() }
  next.rings.push({ x: state.player.x, y: state.player.y, r0: 0.3, r1: 1.6, life: 0.35, maxLife: 0.35, hue: CRUMB_HUE })
  return next
}

/**
 * Difficulty ramp. Everything here climbs with the level, and the player's own
 * scale climbs slowest — a single shared multiplier left the gap between you
 * and the chasers identical on level 9 and level 1.
 */
function playerSpeedScale(level: number) {
  return 1 + Math.min(0.08, (level - 1) * 0.02)
}

function chaserSpeedScale(level: number) {
  return 1 + Math.min(0.36, (level - 1) * 0.045)
}

/** Frightened chasers keep pace too, so power pips buy less each round. */
function frightSpeedScale(level: number) {
  return 1 + Math.min(0.24, (level - 1) * 0.03)
}

/** Scatter laps shorten and chase laps stretch, so they hound you longer. */
function scatterTime(level: number) {
  return Math.max(3.5, 7 - (level - 1) * 0.45)
}

function chaseTime(level: number) {
  return Math.min(30, 20 + (level - 1) * 1.4)
}

function centerOf(v: number) {
  return Math.floor(v) + 0.5
}

function atCenter(v: number) {
  return Math.abs(v - centerOf(v)) < 0.02
}

/** Distance from `p` to the next tile centre travelling in `delta`'s direction. */
function distToNextCenter(p: number, delta: number) {
  if (delta > 0) return Math.max(CENTER_EPS, Math.floor(p + 0.5) + 0.5 - p)
  if (delta < 0) return Math.max(CENTER_EPS, p - (Math.ceil(p - 0.5) - 0.5))
  return 1
}

function targetFor(state: GameState, ghost: Ghost): { cell: Cell; allowDoor: boolean } {
  if (ghost.mode === 'eaten') return { cell: state.houseCenter, allowDoor: true }
  if (ghost.mode === 'leaving') return { cell: state.ghostExit, allowDoor: true }
  if (ghost.mode === 'scatter') return { cell: ghost.corner, allowDoor: false }

  const px = Math.floor(state.player.x)
  const py = Math.floor(state.player.y)
  const v = VEC[state.player.dir]
  if (ghost.kind === 'blink') return { cell: { x: px, y: py }, allowDoor: false }
  if (ghost.kind === 'pink') {
    return { cell: { x: px + v.x * 4, y: py + v.y * 4 }, allowDoor: false }
  }
  if (ghost.kind === 'inky') {
    const blink = state.ghosts.find((g) => g.kind === 'blink')
    const ax = px + v.x * 2
    const ay = py + v.y * 2
    if (!blink) return { cell: { x: ax, y: ay }, allowDoor: false }
    return {
      cell: { x: ax * 2 - Math.floor(blink.x), y: ay * 2 - Math.floor(blink.y) },
      allowDoor: false,
    }
  }
  // Clyde keeps his distance — shy once he's within eight tiles.
  if (dist2(ghost.x, ghost.y, state.player.x, state.player.y) < 64) {
    return { cell: ghost.corner, allowDoor: false }
  }
  return { cell: { x: px, y: py }, allowDoor: false }
}

type FieldCache = Map<string, Int32Array>

function fieldFor(
  state: GameState,
  cache: FieldCache,
  target: Cell,
  allowDoor: boolean,
) {
  const key = `${Math.round(target.x)}:${Math.round(target.y)}:${allowDoor ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit
  const field = distanceField(state, target, allowDoor)
  cache.set(key, field)
  return field
}

function chooseGhostDir(state: GameState, ghost: Ghost, cache: FieldCache): Dir {
  const gx = Math.floor(ghost.x)
  const gy = Math.floor(ghost.y)
  const { cell } = targetFor(state, ghost)
  const doorOk = ghostDoorOk(state, ghost, gx, gy)

  const options: { dir: Dir; tile: Cell }[] = []
  for (const dir of DIRS) {
    const next = stepTile(state, gx, gy, dir, doorOk)
    if (!next) continue
    options.push({ dir, tile: next })
  }
  if (!options.length) return ghost.dir

  const canReverse =
    ghost.mode === 'frightened' || ghost.mode === 'eaten' || options.length === 1
  const forward = canReverse
    ? options
    : options.filter((o) => o.dir !== OPPOSITE[ghost.dir])
  let pool = forward.length ? forward : options

  if (ghost.mode === 'frightened') {
    return pool[Math.floor(Math.random() * pool.length)].dir
  }

  // Scatter (and Clyde's corner retreat) aim off-board: Euclidean picks keep
  // them lapping the ring instead of distance-field ping-pong on arrival.
  const offBoard =
    cell.x < 0 || cell.y < 0 || cell.x >= state.cols || cell.y >= state.rows
  if (ghost.mode === 'scatter' || offBoard) {
    const PRIORITY: Dir[] = ['up', 'left', 'down', 'right']
    let best = pool[0]
    let bestD = Infinity
    let bestPri = 99
    for (const option of pool) {
      const d =
        (option.tile.x + 0.5 - cell.x) ** 2 + (option.tile.y + 0.5 - cell.y) ** 2
      const pri = PRIORITY.indexOf(option.dir)
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) < 1e-9 && pri >= 0 && pri < bestPri)) {
        bestD = d
        bestPri = pri
        best = option
      }
    }
    return best.dir
  }

  const field = fieldFor(state, cache, cell, doorOk)
  const scoreOf = (option: { dir: Dir; tile: Cell }) => {
    const d = field[option.tile.y * state.cols + option.tile.x]
    return d < 0 ? Infinity : d
  }

  // If the only downhill path is behind us (pocket / bad corner), reverse.
  if (!canReverse) {
    const reverse = options.find((o) => o.dir === OPPOSITE[ghost.dir])
    if (reverse) {
      const bestForward = Math.min(...pool.map(scoreOf))
      if (scoreOf(reverse) < bestForward) pool = [reverse, ...pool]
    }
  }

  const PRIORITY: Dir[] = ['up', 'left', 'down', 'right']
  let best = pool[0]
  let bestD = Infinity
  let bestPri = 99
  for (const option of pool) {
    const score = scoreOf(option)
    const pri = PRIORITY.indexOf(option.dir)
    if (score < bestD || (score === bestD && pri >= 0 && pri < bestPri)) {
      bestD = score
      bestPri = pri
      best = option
    }
  }
  if (bestD === Infinity) {
    // Target is walled off (shouldn't happen) — keep moving rather than stall.
    return pool[Math.floor(Math.random() * pool.length)].dir
  }
  return best.dir
}

function advance(actor: { x: number; y: number }, dir: Dir, step: number) {
  const v = VEC[dir]
  actor.x += v.x * step
  actor.y += v.y * step
}

function insideHouse(state: GameState, x: number, y: number) {
  return (
    x >= state.house.minX &&
    x <= state.house.maxX &&
    y >= state.house.minY &&
    y <= state.house.maxY
  )
}

/** Chasers only pass the gate on their way out of, or back into, the den. */
function ghostDoorOk(state: GameState, ghost: Ghost, x: number, y: number) {
  if (ghost.mode === 'eaten' || ghost.mode === 'leaving') return true
  return insideHouse(state, x, y) || state.door[y]?.[x] === true
}

/** Teleport across a tunnel mouth so the next step lands on the far tile. */
function wrapIfNeeded(state: GameState, actor: { x: number; y: number }, dir: Dir) {
  const v = VEC[dir]
  if (v.x > 0 && actor.x > state.cols - 0.5 + CENTER_EPS) actor.x -= state.cols
  if (v.x < 0 && actor.x < -0.5 - CENTER_EPS) actor.x += state.cols
  if (v.y > 0 && actor.y > state.rows - 0.5 + CENTER_EPS) actor.y -= state.rows
  if (v.y < 0 && actor.y < -0.5 - CENTER_EPS) actor.y += state.rows
}

function moveGhost(state: GameState, ghost: Ghost, speed: number, dt: number, cache: FieldCache) {
  let left = speed * dt
  let guard = 0
  while (left > CENTER_EPS && guard++ < 12) {
    if (atCenter(ghost.x) && atCenter(ghost.y)) {
      ghost.x = centerOf(ghost.x)
      ghost.y = centerOf(ghost.y)
      ghost.dir = chooseGhostDir(state, ghost, cache)
      const gx = Math.floor(ghost.x)
      const gy = Math.floor(ghost.y)
      let ahead = stepTile(state, gx, gy, ghost.dir, ghostDoorOk(state, ghost, gx, gy))
      if (!ahead) {
        // Never idle on a bad heading — pick any open neighbor.
        for (const dir of DIRS) {
          const next = stepTile(state, gx, gy, dir, ghostDoorOk(state, ghost, gx, gy))
          if (!next) continue
          ghost.dir = dir
          ahead = next
          break
        }
        if (!ahead) break
      }
      if (ahead.wrapped) {
        const v = VEC[ghost.dir]
        if (v.x > 0) ghost.x = -0.5
        if (v.x < 0) ghost.x = state.cols - 0.5
        if (v.y > 0) ghost.y = -0.5
        if (v.y < 0) ghost.y = state.rows - 0.5
      }
    }
    const v = VEC[ghost.dir]
    const dist = v.x !== 0 ? distToNextCenter(ghost.x, v.x) : distToNextCenter(ghost.y, v.y)
    const step = Math.min(left, dist)
    advance(ghost, ghost.dir, step)
    wrapIfNeeded(state, ghost, ghost.dir)
    left -= step
  }
}

function canStepFrom(state: GameState, x: number, y: number, dir: Dir) {
  return stepTile(state, x, y, dir, false) !== null
}

/** Moves the player; returns how far it actually went, for the chomp. */
function movePlayer(state: GameState, speed: number, dt: number) {
  const p = state.player
  let left = speed * dt
  let moved = 0
  let guard = 0

  while (left > CENTER_EPS && guard++ < 12) {
    if (p.pending === p.dir) p.pending = null
    if (p.pending && p.pending === OPPOSITE[p.dir]) {
      p.dir = p.pending
      p.pending = null
    }

    const tileX = Math.floor(p.x)
    const tileY = Math.floor(p.y)
    const onBoard =
      tileX >= 0 && tileY >= 0 && tileX < state.cols && tileY < state.rows

    // Late turn: you just cleared the junction, so still take it.
    if (onBoard && p.pending && canStepFrom(state, tileX, tileY, p.pending)) {
      const along = VEC[p.dir].x !== 0 ? p.x : p.y
      const past = (along - centerOf(along)) * (VEC[p.dir].x + VEC[p.dir].y)
      if (past > 0 && past <= LATE_TURN) {
        p.x = tileX + 0.5
        p.y = tileY + 0.5
        p.dir = p.pending
        p.pending = null
        continue
      }
    }

    if (atCenter(p.x) && atCenter(p.y)) {
      p.x = centerOf(p.x)
      p.y = centerOf(p.y)
      if (p.pending && canStepFrom(state, Math.floor(p.x), Math.floor(p.y), p.pending)) {
        p.dir = p.pending
        p.pending = null
      }
      const ahead = stepTile(state, Math.floor(p.x), Math.floor(p.y), p.dir, false)
      if (!ahead) break
      if (ahead.wrapped) {
        const v = VEC[p.dir]
        if (v.x > 0) p.x = -0.5
        if (v.x < 0) p.x = state.cols - 0.5
        if (v.y > 0) p.y = -0.5
        if (v.y < 0) p.y = state.rows - 0.5
      }
    }

    const v = VEC[p.dir]
    const dist = v.x !== 0 ? distToNextCenter(p.x, v.x) : distToNextCenter(p.y, v.y)
    const step = Math.min(left, dist)
    advance(p, p.dir, step)
    wrapIfNeeded(state, p, p.dir)
    left -= step
    moved += step
  }
  return moved
}

// —— Effects ———————————————————————————————————————————————————

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function addPop(state: GameState, x: number, y: number, text: string, tone: PopTone = 'ink', life = 0.9) {
  state.pops.push({ x, y, life, maxLife: life, text, tone })
  if (state.pops.length > 12) state.pops.shift()
}

function addSparks(state: GameState, x: number, y: number, n: number, hue: number, speed = 4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = speed * rand(0.35, 1)
    const life = rand(0.25, 0.5)
    state.bits.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, maxLife: life, hue, size: rand(0.05, 0.09), angle: 0, spin: 0 })
  }
}

function addShards(state: GameState, x: number, y: number, n: number, hue: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = rand(0.8, 2.6)
    const life = rand(0.45, 0.8)
    state.bits.push({ kind: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, maxLife: life, hue, size: rand(0.12, 0.2), angle: Math.random() * Math.PI * 2, spin: rand(-10, 10) })
  }
}

function addRing(state: GameState, x: number, y: number, r0: number, r1: number, life: number, hue: number) {
  state.rings.push({ x, y, r0, r1, life, maxLife: life, hue })
}

const MAX_BITS = 260

function tickEffects(state: GameState, dt: number) {
  const bits: Bit[] = []
  for (let i = Math.max(0, state.bits.length - MAX_BITS); i < state.bits.length; i++) {
    const b = state.bits[i]!
    const life = b.life - dt
    if (life <= 0) continue
    // Per second, not per frame, so a fast screen throws debris no shorter.
    const drag = Math.pow(b.kind === 'spark' ? 0.03 : 0.2, dt)
    const vx = b.vx * drag
    const vy = b.vy * drag
    bits.push({ ...b, life, vx, vy, x: b.x + vx * dt, y: b.y + vy * dt, angle: b.angle + b.spin * dt })
  }
  state.bits = bits
  state.rings = state.rings.filter((r) => r.life > dt).map((r) => ({ ...r, life: r.life - dt }))
  state.pops = state.pops.filter((p) => p.life > dt).map((p) => ({ ...p, life: p.life - dt }))
  state.bites = state.bites.filter((b) => b.life > dt * 4).map((b) => ({ ...b, life: b.life - dt * 4 }))
  state.trail = state.trail.filter((t) => t.life > dt * 2.4).map((t) => ({ ...t, life: t.life - dt * 2.4 }))
  state.shake = Math.max(0, state.shake - dt * 2.6)
  for (const g of state.ghosts) g.hit = Math.max(0, g.hit - dt * 2.5)
}

// —— Scoring ———————————————————————————————————————————————————

export function streakMult(crumbStreak: number) {
  const early = 1 + Math.floor(crumbStreak / STREAK_STEP)
  if (early < MAX_MULT) return early
  const over = crumbStreak - STREAK_STEP * (MAX_MULT - 1)
  return Math.min(MAX_MULT_LATE, MAX_MULT + Math.floor(over / LATE_STEP))
}

function sendHome(state: GameState, ghost: Ghost, points: number) {
  ghost.mode = 'eaten'
  ghost.hit = 1
  state.score += points
  addPop(state, ghost.x, ghost.y - 0.2, `+${points}`, 'ghost', 1)
  addShards(state, ghost.x, ghost.y, 8, GHOST_HUE[ghost.kind])
  addRing(state, ghost.x, ghost.y, 0.25, 1.3, 0.4, GHOST_HUE[ghost.kind])
  state.shake = Math.min(1, state.shake + 0.3)
}

/** Every chaser on the board turns and runs. The power pip's job, and the landmark's. */
function frighten(state: GameState, seconds: number) {
  state.fright = seconds
  state.frightEaten = 0
  for (const g of state.ghosts) {
    if (g.mode === 'eaten' || g.mode === 'den') continue
    g.mode = 'frightened'
    g.dir = OPPOSITE[g.dir]
  }
}

/** A fruit on the tile is not cleared ground, so it must not break a streak. */
function fruitAt(state: GameState, x: number, y: number) {
  const fruit = state.fruit
  return !!fruit && Math.floor(fruit.x) === x && Math.floor(fruit.y) === y
}

function eatAt(state: GameState) {
  const x = Math.floor(state.player.x)
  const y = Math.floor(state.player.y)
  if (y < 0 || y >= state.rows || x < 0 || x >= state.cols) return
  if (state.lastTile.x === x && state.lastTile.y === y) return
  state.lastTile = { x, y }

  if (state.crumbs[y][x]) {
    state.crumbs[y][x] = false
    state.crumbsLeft -= 1
    const multBefore = streakMult(state.crumbStreak)
    state.crumbStreak += 1
    if (state.crumbStreak > state.crumbStreakBest) {
      state.crumbStreakBest = state.crumbStreak
    }
    const mult = streakMult(state.crumbStreak) * (state.surgeTime > 0 ? 2 : 1)
    state.score += SCORE_CRUMB * mult
    if (state.surgeTime <= 0) state.surge = Math.min(1, state.surge + 1 / SURGE_CRUMBS)
    sfx('eat', Math.min(5, Math.floor(state.crumbStreak / 8)))
    state.bites.push({ x: x + 0.5, y: y + 0.5, life: 1, power: false })
    if (state.bites.length > 10) state.bites.shift()

    // The streak starts paying more: say so where you are looking.
    const multAfter = streakMult(state.crumbStreak)
    if (multAfter > multBefore && state.crumbStreak % STREAK_LANDMARK !== 0) {
      addPop(state, state.player.x, state.player.y - 0.8, `×${multAfter}`, 'streak')
      sfx('hop', Math.min(12, multAfter * 2))
    }

    // Every hundredth fresh crumb in a row scatters the board.
    if (state.crumbStreak % STREAK_LANDMARK === 0) {
      state.score += SCORE_LANDMARK
      frighten(state, FRIGHT_TIME)
      addPop(state, x + 0.5, y - 0.3, `${state.crumbStreak} in a row!`, 'streak', 1.5)
      addRing(state, x + 0.5, y + 0.5, 0.3, 3.2, 0.7, CRUMB_HUE)
      sfx('wave')
    }
  } else if (!state.power[y][x] && !fruitAt(state, x, y)) {
    // Retracing picked-clean ground breaks the streak — and says so, once it
    // was worth something, or the rule is only ever found by watching a number.
    if (streakMult(state.crumbStreak) >= 3) {
      addPop(state, state.player.x, state.player.y - 0.8, 'streak lost', 'lost')
      sfx('miss')
    }
    state.crumbStreak = 0
  }

  if (state.power[y][x]) {
    state.power[y][x] = false
    state.crumbsLeft -= 1
    state.score += SCORE_POWER
    state.surge = Math.min(1, state.surge + 0.25)
    frighten(state, Math.max(FRIGHT_TIME * 0.5, FRIGHT_TIME - (state.level - 1) * 0.4))
    state.bites.push({ x: x + 0.5, y: y + 0.5, life: 1, power: true })
    addRing(state, x + 0.5, y + 0.5, 0.3, 2.2, 0.55, CRUMB_HUE)
    addSparks(state, x + 0.5, y + 0.5, 10, CRUMB_HUE, 5)
    sfx('wave')
  }

  const fruit = state.fruit
  if (fruit && Math.floor(fruit.x) === x && Math.floor(fruit.y) === y) {
    state.score += fruit.value
    addPop(state, fruit.x, fruit.y - 0.3, `+${fruit.value}`, 'fruit', 1.2)
    addSparks(state, fruit.x, fruit.y, 12, 350, 4.5)
    addRing(state, fruit.x, fruit.y, 0.3, 1.6, 0.45, CRUMB_HUE)
    state.fruit = null
    sfx('good')
  }
}

/** The fruit for this maze, from the ladder, the top one repeating. */
export function fruitFor(level: number) {
  return FRUIT_LADDER[Math.min(FRUIT_LADDER.length - 1, Math.max(0, level - 1))]!
}

function offerFruit(state: GameState) {
  if (state.fruit || state.fruitsShown >= FRUIT_AT.length) return
  const eaten = 1 - state.crumbsLeft / Math.max(1, state.crumbsTotal)
  if (eaten < FRUIT_AT[state.fruitsShown]!) return
  const { kind, value } = fruitFor(state.level)
  state.fruit = {
    kind,
    value,
    x: state.start.x + 0.5,
    y: state.start.y + 0.5,
    life: FRUIT_LIFE,
    maxLife: FRUIT_LIFE,
  }
  state.fruitsShown += 1
  // Standing on its tile already counts as arriving.
  if (Math.floor(state.player.x) === state.start.x && Math.floor(state.player.y) === state.start.y) {
    state.lastTile = { x: -1, y: -1 }
  }
}

// —— Tick ——————————————————————————————————————————————————————

export function tick(state: GameState, dt: number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover') {
    return { ...state, mouth: state.mouth + dt * 9, time: state.time + dt }
  }

  const next: GameState = {
    ...state,
    crumbs: state.crumbs.map((row) => row.slice()),
    power: state.power.map((row) => row.slice()),
    ghosts: state.ghosts.map((g) => ({ ...g })),
    player: { ...state.player },
    fruit: state.fruit ? { ...state.fruit } : null,
    time: state.time + dt,
  }
  tickEffects(next, dt)

  if (next.phase === 'dying') {
    const before = next.deathAnim
    next.deathAnim -= dt
    // Folded all the way shut: it goes in a puff.
    if (before > DEATH_TIME * 0.28 && next.deathAnim <= DEATH_TIME * 0.28) {
      addSparks(next, next.player.x, next.player.y, 14, PLAYER_HUE, 3.2)
    }
    if (next.deathAnim <= 0) {
      next.lives -= 1
      if (next.lives <= 0) {
        next.phase = 'gameover'
        next.best = Math.max(next.best, next.score, loadBest())
        sfx('die')
      } else {
        resetActors(next, mazeViewOf(next), READY_AGAIN)
        next.phase = 'playing'
        next.deathAnim = 0
      }
    }
    return next
  }

  if (next.phase === 'clearing') {
    next.clearAnim -= dt
    if (next.clearAnim <= 0) {
      next.level += 1
      // Same level layout on every device — portrait is landscape rotated.
      const maze = buildLevelMaze(next.level)
      applyMaze(next, maze)
      resetActors(next, maze, READY_TIME)
      next.phase = 'playing'
      next.clearAnim = 0
      sfx('wave')
    }
    return next
  }

  // "Ready!": the board waits, the chasers bob in place, a turn can be queued.
  if (next.ready > 0) {
    next.ready = Math.max(0, next.ready - dt)
    for (const g of next.ghosts) g.bob += dt * 4
    return next
  }

  // The beat after a chaser is eaten.
  if (next.freeze > 0) {
    next.freeze = Math.max(0, next.freeze - dt)
    return next
  }

  next.invuln = Math.max(0, next.invuln - dt)

  if (next.surgeTime > 0) {
    next.surgeTime = Math.max(0, next.surgeTime - dt)
    next.trail.push({ x: next.player.x, y: next.player.y, life: 1 })
  }

  if (next.player.pending) {
    next.player.pendingAge += dt
    if (next.player.pendingAge > PENDING_TTL) next.player.pending = null
  }

  if (next.fruit) {
    next.fruit.life -= dt
    if (next.fruit.life <= 0) next.fruit = null
  }

  // Chase / scatter cycle.
  if (next.fright <= 0) {
    next.modeTimer -= dt
    if (next.modeTimer <= 0) {
      next.mode = next.mode === 'scatter' ? 'chase' : 'scatter'
      next.modeTimer =
        next.mode === 'scatter' ? scatterTime(next.level) : chaseTime(next.level)
      for (const g of next.ghosts) {
        if (g.mode === 'chase' || g.mode === 'scatter') {
          g.mode = next.mode
          g.dir = OPPOSITE[g.dir]
        }
      }
    }
  } else {
    next.fright -= dt
    if (next.fright <= 0) {
      next.fright = 0
      for (const g of next.ghosts) {
        if (g.mode === 'frightened') g.mode = next.mode
      }
    }
  }

  const surging = next.surgeTime > 0
  const moved = movePlayer(next, PLAYER_SPEED * playerSpeedScale(next.level) * (surging ? SURGE_SPEED : 1), dt)
  // The mouth works while the player moves, and rests half open against a wall.
  if (moved > 0) next.mouth += moved * 2.1
  eatAt(next)
  offerFruit(next)

  if (next.crumbsLeft <= 0) {
    next.phase = 'clearing'
    next.clearAnim = CLEAR_TIME
    next.fruit = null
    next.fright = 0
    sfx('good')
    return next
  }

  const cache: FieldCache = new Map()
  for (const ghost of next.ghosts) {
    if (ghost.mode === 'den') {
      ghost.bob += dt * 4
      ghost.denTimer -= dt
      if (ghost.denTimer <= 0) ghost.mode = 'leaving'
      continue
    }

    const speed =
      ghost.mode === 'eaten'
        ? EATEN_SPEED
        : ghost.mode === 'frightened'
          ? FRIGHT_SPEED * frightSpeedScale(next.level)
          : GHOST_SPEED * chaserSpeedScale(next.level)
    moveGhost(next, ghost, speed, dt, cache)
    ghost.bob += dt * 6

    if (ghost.mode === 'leaving') {
      const gx = Math.floor(ghost.x)
      const gy = Math.floor(ghost.y)
      if (gx === next.ghostExit.x && gy === next.ghostExit.y) {
        ghost.mode = next.fright > 0 ? 'frightened' : next.mode
      }
    } else if (ghost.mode === 'eaten') {
      if (dist2(ghost.x, ghost.y, next.houseCenter.x + 0.5, next.houseCenter.y + 0.5) < 0.4) {
        ghost.mode = 'den'
        ghost.denTimer = 0.7
        ghost.bob = 0
      }
    }
  }

  // Collisions.
  if (next.invuln <= 0 && next.phase === 'playing') {
    for (const ghost of next.ghosts) {
      if (ghost.mode === 'eaten' || ghost.mode === 'den') continue
      if (dist2(ghost.x, ghost.y, next.player.x, next.player.y) > 0.5) continue

      if (surging) {
        const bonus = SCORE_SURGE[Math.min(next.surgeHits, SCORE_SURGE.length - 1)]
        next.surgeHits += 1
        sendHome(next, ghost, bonus)
        sfx('hit')
        continue
      }
      if (ghost.mode === 'frightened') {
        const bonus = SCORE_GHOST[Math.min(next.frightEaten, SCORE_GHOST.length - 1)]
        next.frightEaten += 1
        sendHome(next, ghost, bonus)
        next.freeze = EAT_FREEZE
        sfx('good')
        continue
      }
      next.phase = 'dying'
      next.deathAnim = DEATH_TIME
      if (streakMult(next.crumbStreak) >= 3) {
        addPop(next, next.player.x, next.player.y - 0.8, 'streak lost', 'lost')
      }
      next.crumbStreak = 0
      next.fruit = null
      next.shake = Math.min(1, next.shake + 0.6)
      addRing(next, next.player.x, next.player.y, 0.2, 1.4, 0.45, GHOST_HUE[ghost.kind])
      sfx('hurt')
      break
    }
  }

  return next
}

/** Rebuild a Maze view of the live state so resets reuse the current board. */
function mazeViewOf(state: GameState): Maze {
  return {
    cols: state.cols,
    rows: state.rows,
    open: state.open,
    door: state.door,
    house: state.house,
    houseCenter: state.houseCenter,
    ghostExit: state.ghostExit,
    start: state.start,
    crumbs: [],
    power: [],
  }
}

export function toSnapshot(state: GameState): Snapshot {
  return {
    score: state.score,
    best: Math.max(state.best, loadBest()),
    phase: state.phase,
    lives: state.lives,
    level: state.level,
    crumbsLeft: state.crumbsLeft,
    surge: state.surge,
    surgeTime: state.surgeTime,
    crumbStreak: state.crumbStreak,
    crumbStreakBest: state.crumbStreakBest,
    mult: streakMult(state.crumbStreak),
  }
}
