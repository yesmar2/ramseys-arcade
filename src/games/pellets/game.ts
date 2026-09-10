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

export type Pop = { x: number; y: number; life: number; text: string }
export type TrailDot = { x: number; y: number; life: number }

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  lives: number
  level: number
  crumbsLeft: number
  surge: number
  surgeTime: number
  combo: number
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
  combo: number
  /** Tile the player was in last frame, so streaks only count new ground. */
  lastTile: Cell
  trail: TrailDot[]
  pops: Pop[]
  deathAnim: number
  clearAnim: number
  invuln: number
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

const PLAYER_SPEED = 7.1
const GHOST_SPEED = 5.3
const FRIGHT_SPEED = 3.7
const EATEN_SPEED = 12
const SURGE_SPEED = 1.85

const DEATH_TIME = 0.85
const CLEAR_TIME = 1.4
const RESPAWN_INVULN = 1.2
/** Crumbs needed to fill the surge meter. */
const SURGE_CRUMBS = 26
const SURGE_TIME = 1.7
/** Clean crumbs per multiplier step, and the cap. */
const COMBO_STEP = 10
const MAX_MULT = 4

/** How far past a junction a late turn still counts — the "forgiving" feel. */
const LATE_TURN = 0.34
const CENTER_EPS = 0.001
/** Steering input goes stale so you never get a surprise turn later. */
const PENDING_TTL = 1.1

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
  return {
    blink: { x: cols - 2, y: 1 },
    pink: { x: 1, y: 1 },
    inky: { x: cols - 2, y: rows - 2 },
    clyde: { x: 1, y: rows - 2 },
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
}

function resetActors(state: GameState, maze: Maze) {
  state.player.x = maze.start.x + 0.5
  state.player.y = maze.start.y + 0.5
  state.player.dir = 'left'
  state.player.pending = null
  state.player.pendingAge = 0
  state.ghosts = makeGhosts(maze, state.level)
  state.fright = 0
  state.frightEaten = 0
  state.surgeTime = 0
  state.surgeHits = 0
  state.combo = 0
  state.lastTile = { x: maze.start.x, y: maze.start.y }
  state.trail = []
  state.invuln = RESPAWN_INVULN
  state.mode = 'scatter'
  state.modeTimer = 7
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
    house: maze.house,
    houseCenter: maze.houseCenter,
    ghostExit: maze.ghostExit,
    start: maze.start,
    player: {
      x: maze.start.x + 0.5,
      y: maze.start.y + 0.5,
      dir: 'left' as Dir,
      pending: null,
      pendingAge: 0,
    },
    ghosts: makeGhosts(maze, 1),
    fright: 0,
    frightEaten: 0,
    mode: 'scatter',
    modeTimer: 7,
    surge: 0,
    surgeTime: 0,
    surgeHits: 0,
    combo: 0,
    lastTile: { x: maze.start.x, y: maze.start.y },
    trail: [],
    pops: [],
    deathAnim: 0,
    clearAnim: 0,
    invuln: 0,
    mouth: 0,
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
  next.invuln = RESPAWN_INVULN
  return next
}

export function queueDir(state: GameState, dir: Dir): GameState {
  if (state.phase !== 'playing') return state
  return { ...state, player: { ...state.player, pending: dir, pendingAge: 0 } }
}

export function surgeReady(state: GameState) {
  return state.phase === 'playing' && state.surgeTime <= 0 && state.surge >= 1
}

export function triggerSurge(state: GameState): GameState {
  if (!surgeReady(state)) return state
  sfx('whoosh')
  return { ...state, surge: 0, surgeTime: SURGE_TIME, surgeHits: 0 }
}

function levelSpeed(level: number) {
  return 1 + Math.min(0.5, (level - 1) * 0.06)
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
  const pool = forward.length ? forward : options

  if (ghost.mode === 'frightened') {
    return pool[Math.floor(Math.random() * pool.length)].dir
  }

  const field = fieldFor(state, cache, cell, doorOk)
  let best = pool[0]
  let bestD = Infinity
  for (const option of pool) {
    const d = field[option.tile.y * state.cols + option.tile.x]
    const score = d < 0 ? Infinity : d
    if (score < bestD) {
      bestD = score
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
      const ahead = stepTile(state, gx, gy, ghost.dir, ghostDoorOk(state, ghost, gx, gy))
      if (!ahead) break
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

function movePlayer(state: GameState, speed: number, dt: number) {
  const p = state.player
  let left = speed * dt
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
  }
}

function addPop(state: GameState, x: number, y: number, text: string) {
  state.pops.push({ x, y, life: 0.9, text })
  if (state.pops.length > 12) state.pops.shift()
}

function sendHome(state: GameState, ghost: Ghost, points: number) {
  ghost.mode = 'eaten'
  ghost.hit = 1
  state.score += points
  addPop(state, ghost.x, ghost.y, `+${points}`)
}

export function comboMult(combo: number) {
  return Math.min(MAX_MULT, 1 + Math.floor(combo / COMBO_STEP))
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
    state.combo += 1
    const mult = comboMult(state.combo) * (state.surgeTime > 0 ? 2 : 1)
    state.score += SCORE_CRUMB * mult
    if (state.surgeTime <= 0) state.surge = Math.min(1, state.surge + 1 / SURGE_CRUMBS)
    sfx('eat', Math.min(5, Math.floor(state.combo / 8)))
  } else if (!state.power[y][x]) {
    // Retracing picked-clean ground breaks the streak.
    state.combo = 0
  }

  if (state.power[y][x]) {
    state.power[y][x] = false
    state.crumbsLeft -= 1
    state.score += SCORE_POWER
    state.surge = Math.min(1, state.surge + 0.25)
    state.fright = Math.max(FRIGHT_TIME * 0.5, FRIGHT_TIME - (state.level - 1) * 0.4)
    state.frightEaten = 0
    for (const g of state.ghosts) {
      if (g.mode === 'eaten' || g.mode === 'den') continue
      g.mode = 'frightened'
      g.dir = OPPOSITE[g.dir]
    }
    sfx('wave')
  }
}

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
    trail: state.trail.slice(),
    pops: state.pops.slice(),
    mouth: state.mouth + dt * 11,
    time: state.time + dt,
    invuln: Math.max(0, state.invuln - dt),
  }

  next.pops = next.pops
    .map((p) => ({ ...p, life: p.life - dt }))
    .filter((p) => p.life > 0)
  next.trail = next.trail
    .map((t) => ({ ...t, life: t.life - dt * 2.4 }))
    .filter((t) => t.life > 0)
  for (const g of next.ghosts) g.hit = Math.max(0, g.hit - dt * 2.5)

  if (next.phase === 'dying') {
    next.deathAnim -= dt
    if (next.deathAnim <= 0) {
      next.lives -= 1
      if (next.lives <= 0) {
        next.phase = 'gameover'
        next.best = Math.max(next.best, next.score, loadBest())
        sfx('die')
      } else {
        resetActors(next, mazeViewOf(next))
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
      resetActors(next, maze)
      next.phase = 'playing'
      next.clearAnim = 0
      sfx('wave')
    }
    return next
  }

  if (next.surgeTime > 0) {
    next.surgeTime = Math.max(0, next.surgeTime - dt)
    next.trail.push({ x: next.player.x, y: next.player.y, life: 1 })
  }

  if (next.player.pending) {
    next.player.pendingAge += dt
    if (next.player.pendingAge > PENDING_TTL) next.player.pending = null
  }

  // Chase / scatter cycle.
  if (next.fright <= 0) {
    next.modeTimer -= dt
    if (next.modeTimer <= 0) {
      next.mode = next.mode === 'scatter' ? 'chase' : 'scatter'
      next.modeTimer = next.mode === 'scatter' ? 7 : 20
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

  const spd = levelSpeed(next.level)
  const surging = next.surgeTime > 0
  movePlayer(next, PLAYER_SPEED * spd * (surging ? SURGE_SPEED : 1), dt)
  eatAt(next)

  if (next.crumbsLeft <= 0) {
    next.phase = 'clearing'
    next.clearAnim = CLEAR_TIME
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
          ? FRIGHT_SPEED
          : GHOST_SPEED * spd
    moveGhost(next, ghost, speed, dt, cache)

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
        sfx('good')
        continue
      }
      next.phase = 'dying'
      next.deathAnim = DEATH_TIME
      next.combo = 0
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
    combo: state.combo,
  }
}
