import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'gameover'
export type LaneKind = 'safe' | 'road'

export type Vehicle = {
  x: number
  w: number
  hue: number
}

export type Lane = {
  kind: LaneKind
  dir: -1 | 0 | 1
  speed: number
  vehicles: Vehicle[]
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  lives: number
  crossings: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  lives: number
  crossings: number
  cols: number
  rows: number
  px: number
  py: number
  hopCooldown: number
  invuln: number
  flash: number
  hopPulse: number
  farthest: number
  lanes: Lane[]
}

export const COLS = 11
export const ROWS = 13
export const START_LIVES = 3

const HOP_COOLDOWN = 0.14
const INVULN = 1.05
const SCORE_HOP = 10
const SCORE_CROSS = 50
const CAR_HUES = [18, 38, 348, 198, 272, 128]

function loadBest() {
  return getPersonalBest('crosswalk')
}

export function crosswalkLayout() {
  return { cols: COLS, rows: ROWS, aspectW: 11, aspectH: 13 }
}

function spawnVehicles(cols: number, count: number): Vehicle[] {
  const gap = (cols + 3) / count
  const vehicles: Vehicle[] = []
  for (let i = 0; i < count; i++) {
    const w = 1.45 + Math.random() * 0.85
    const x = i * gap + Math.random() * 0.6 - 1.2
    vehicles.push({
      x,
      w,
      hue: CAR_HUES[(i + Math.floor(Math.random() * 3)) % CAR_HUES.length],
    })
  }
  return vehicles
}

function makeLanes(cols: number, rows: number, crossing: number): Lane[] {
  const speedScale = 1 + crossing * 0.11
  const median = Math.floor(rows / 2)
  const lanes: Lane[] = []
  for (let y = 0; y < rows; y++) {
    const safe = y === 0 || y === rows - 1 || y === median
    if (safe) {
      lanes.push({ kind: 'safe', dir: 0, speed: 0, vehicles: [] })
      continue
    }
    const dir: -1 | 1 = y % 2 === 0 ? 1 : -1
    const towardGoal = (rows - 1 - y) / rows
    const speed = (1.05 + towardGoal * 1.35 + Math.random() * 0.28) * speedScale
    const extra = crossing >= 4 && Math.random() < 0.45 ? 1 : 0
    const count = 2 + extra + (speed > 2.1 ? 1 : 0)
    lanes.push({
      kind: 'road',
      dir,
      speed,
      vehicles: spawnVehicles(cols, Math.min(4, count)),
    })
  }
  return lanes
}

function startCell(cols: number, rows: number) {
  return { px: Math.floor(cols / 2), py: rows - 1 }
}

export function createInitialState(
  cols = COLS,
  rows = ROWS,
): GameState {
  const start = startCell(cols, rows)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    lives: START_LIVES,
    crossings: 0,
    cols,
    rows,
    px: start.px,
    py: start.py,
    hopCooldown: 0,
    invuln: 0,
    flash: 0,
    hopPulse: 0,
    farthest: start.py,
    lanes: makeLanes(cols, rows, 0),
  }
}

export function startGame(prev: GameState): GameState {
  const next = createInitialState(prev.cols, prev.rows)
  return {
    ...next,
    best: Math.max(prev.best, loadBest()),
    phase: 'playing',
    invuln: 0.45,
  }
}

function completeCrossing(state: GameState): GameState {
  sfx('good')
  const crossings = state.crossings + 1
  const bonus = SCORE_CROSS + (crossings - 1) * 15
  const start = startCell(state.cols, state.rows)
  return {
    ...state,
    score: state.score + bonus,
    crossings,
    px: start.px,
    py: start.py,
    farthest: start.py,
    hopCooldown: HOP_COOLDOWN,
    invuln: 0.55,
    hopPulse: 0.22,
    flash: 0.18,
    lanes: makeLanes(state.cols, state.rows, crossings),
  }
}

function squash(state: GameState): GameState {
  sfx('hurt')
  const lives = state.lives - 1
  if (lives <= 0) {
    sfx('die')
    const best = Math.max(state.best, state.score)
    return {
      ...state,
      phase: 'gameover',
      lives: 0,
      best,
      flash: 0.35,
      invuln: 0,
    }
  }
  const start = startCell(state.cols, state.rows)
  return {
    ...state,
    lives,
    px: start.px,
    py: start.py,
    farthest: start.py,
    invuln: INVULN,
    flash: 0.28,
    hopPulse: 0,
  }
}

export function hop(state: GameState, dir: Dir): GameState {
  if (state.phase !== 'playing') return state
  if (state.hopCooldown > 0) return state

  let nx = state.px
  let ny = state.py
  if (dir === 'up') ny -= 1
  if (dir === 'down') ny += 1
  if (dir === 'left') nx -= 1
  if (dir === 'right') nx += 1

  if (nx < 0 || nx >= state.cols || ny < 0 || ny >= state.rows) return state

  sfx('tap')
  let score = state.score
  let farthest = state.farthest
  if (ny < farthest) {
    score += SCORE_HOP
    farthest = ny
  }

  const moved: GameState = {
    ...state,
    px: nx,
    py: ny,
    score,
    farthest,
    hopCooldown: HOP_COOLDOWN,
    hopPulse: 0.16,
  }

  if (ny === 0) return completeCrossing(moved)
  return moved
}

function overlaps(px: number, vehicle: Vehicle) {
  const left = px + 0.18
  const right = px + 0.82
  return right > vehicle.x && left < vehicle.x + vehicle.w
}

function advanceLanes(lanes: Lane[], cols: number, dt: number): Lane[] {
  const span = cols + 4
  return lanes.map((lane) => {
    if (lane.kind !== 'road' || lane.dir === 0) return lane
    return {
      ...lane,
      vehicles: lane.vehicles.map((v) => {
        let x = v.x + lane.dir * lane.speed * dt
        if (x > cols + 2) x -= span
        if (x + v.w < -2) x += span
        return { ...v, x }
      }),
    }
  })
}

export function tick(state: GameState, dt: number): GameState {
  let s: GameState = {
    ...state,
    hopCooldown: Math.max(0, state.hopCooldown - dt),
    invuln: Math.max(0, state.invuln - dt),
    flash: Math.max(0, state.flash - dt),
    hopPulse: Math.max(0, state.hopPulse - dt),
    lanes: advanceLanes(state.lanes, state.cols, dt),
  }

  if (s.phase !== 'playing') return s
  if (s.invuln > 0) return s

  const lane = s.lanes[s.py]
  if (lane?.kind === 'road') {
    for (const v of lane.vehicles) {
      if (overlaps(s.px, v)) return squash(s)
    }
  }
  return s
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    lives: s.lives,
    crossings: s.crossings,
  }
}
