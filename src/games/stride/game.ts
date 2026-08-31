import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'gameover'

export type Vehicle = {
  x: number
  w: number
  hue: number
}

export type Row = {
  kind: 'grass' | 'road' | 'water' | 'rail'
  dir: -1 | 1 | 0
  speed: number
  trees: number[]
  vehicles: Vehicle[]
}

export type HopAnim = {
  fromC: number
  fromR: number
  toC: number
  toR: number
  t: number
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  cols: number
  col: number
  row: number
  /** Smooth camera position (only moves up with the player). */
  cameraY: number
  hop: HopAnim | null
  hopCooldown: number
  invuln: number
  hopPulse: number
  bump: number
  deathFlash: number
  rows: Map<number, Row>
  runSeed: number
}

export const COLS = 7
/** Target rows visible on screen — lower = more zoom. */
export const TARGET_VISIBLE_ROWS = 10
/** Desktop tile scale bump. */
export const DESKTOP_ZOOM = 1.1
/** Player sits this many rows from the bottom of the view once the camera is rolling. */
export const PLAYER_VIEW_ROW = 3
/** Die if you fall this many rows behind the camera. */
export const BACK_LIMIT = 2
/** Rows to keep generated ahead of the camera. */
export const ROW_BUFFER = 18

const HOP_COOLDOWN = 0.11
const HOP_DURATION = 0.14
const RESPAWN_INVULN = 0.55
const CAR_HUES = [18, 348, 272, 198, 38, 128, 168]
const LOG_HUE = 32

/** Column count from viewport — fewer, larger tiles on tall desktop screens. */
export function pickCols(viewWidth: number, viewHeight: number): number {
  const hudTop = Math.max(52, Math.min(76, viewHeight * 0.11))
  const padBottom = Math.max(14, viewHeight * 0.02)
  const availH = viewHeight - hudTop - padBottom
  const zoom = viewWidth >= 900 ? DESKTOP_ZOOM : 1
  const cell = (availH / TARGET_VISIBLE_ROWS) * zoom
  let cols = Math.max(COLS, Math.min(11, Math.round(viewWidth / cell)))
  if (cols % 2 === 0) cols += 1
  return cols
}

function loadBest() {
  return getPersonalBest('stride')
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function wrapSpan(cols: number) {
  return cols + 5
}

function spawnVehicles(
  cols: number,
  count: number,
  w: number,
  rand: () => number,
): Vehicle[] {
  const span = wrapSpan(cols)
  const gap = span / count
  const seed = rand() * span
  const vehicles: Vehicle[] = []
  for (let i = 0; i < count; i++) {
    const x = (seed + i * gap + (rand() - 0.5) * gap * 0.25) % span
    vehicles.push({
      x: x - 2.5,
      w,
      hue: CAR_HUES[Math.floor(rand() * CAR_HUES.length)],
    })
  }
  return vehicles
}

function spawnLogs(
  cols: number,
  count: number,
  w: number,
  rand: () => number,
): Vehicle[] {
  const span = wrapSpan(cols)
  const gap = span / count
  const seed = rand() * span
  const logs: Vehicle[] = []
  for (let i = 0; i < count; i++) {
    const x = (seed + i * gap + (rand() - 0.5) * gap * 0.2) % span
    logs.push({
      x: x - 2.5,
      w,
      hue: LOG_HUE,
    })
  }
  return logs
}

export function generateRow(row: number, cols: number, runSeed: number): Row {
  const rand = mulberry32((row + 1) * 1_048_583 ^ runSeed)

  if (row < 4) {
    const trees: number[] = []
    if (row > 0) {
      for (let c = 0; c < cols; c++) {
        if (c === Math.floor(cols / 2) && row < 2) continue
        if (rand() < 0.22) trees.push(c)
      }
    }
    return { kind: 'grass', dir: 0, speed: 0, trees, vehicles: [] }
  }

  if (row > 10 && rand() < 0.07) {
    const dir: -1 | 1 = rand() < 0.5 ? -1 : 1
    return {
      kind: 'rail',
      dir,
      speed: 5.2 + rand() * 1.4,
      trees: [],
      vehicles: [{ x: dir > 0 ? -cols - 1.5 : cols + 0.5, w: cols + 2.5, hue: 350 }],
    }
  }

  if (row > 8 && rand() < 0.09) {
    const dir: -1 | 1 = rand() < 0.5 ? -1 : 1
    const count = rand() < 0.45 ? 2 : 3
    const logW = rand() < 0.5 ? 2.5 : 3.2
    return {
      kind: 'water',
      dir,
      speed: 0.72 + rand() * 0.38,
      trees: [],
      vehicles: spawnLogs(cols, count, logW, rand),
    }
  }

  if (rand() < 0.38) {
    const trees: number[] = []
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.28) trees.push(c)
    }
    return { kind: 'grass', dir: 0, speed: 0, trees, vehicles: [] }
  }

  const dir: -1 | 1 = rand() < 0.5 ? -1 : 1
  const tier = Math.min(1.8, 0.75 + row * 0.018)
  const count = row < 8 ? 2 : rand() < 0.45 ? 2 : 3
  const w = rand() < 0.28 ? 2.2 : 1.55
  return {
    kind: 'road',
    dir,
    speed: tier * (0.85 + rand() * 0.35),
    trees: [],
    vehicles: spawnVehicles(cols, count, w, rand),
  }
}

function ensureRows(state: GameState, minRow: number, maxRow: number) {
  for (let r = minRow; r <= maxRow; r++) {
    if (!state.rows.has(r)) {
      state.rows.set(r, generateRow(r, state.cols, state.runSeed))
    }
  }
  for (const key of state.rows.keys()) {
    if (key < minRow - 6 || key > maxRow + 8) state.rows.delete(key)
  }
}

function playerCenter(state: GameState) {
  if (!state.hop) return { c: state.col, r: state.row }
  const t = easeHop(state.hop.t)
  return {
    c: state.hop.fromC + (state.hop.toC - state.hop.fromC) * t,
    r: state.hop.fromR + (state.hop.toR - state.hop.fromR) * t,
  }
}

function easeHop(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export { easeHop }

function vehicleHit(col: number, vehicle: Vehicle, cols: number): boolean {
  const playerLeft = col + 0.22
  const playerRight = col + 0.78
  const span = wrapSpan(cols)
  for (const offset of [0, -span, span]) {
    const vLeft = vehicle.x + offset
    const vRight = vLeft + vehicle.w
    if (playerRight > vLeft && playerLeft < vRight) return true
  }
  return false
}

function onLog(col: number, row: Row, cols: number): boolean {
  if (row.kind !== 'water') return false
  return row.vehicles.some((v) => vehicleHit(col, v, cols))
}

function moveRowVehicles(row: Row, cols: number, dt: number): Row {
  if (row.kind !== 'road' && row.kind !== 'rail' && row.kind !== 'water') return row
  const span = wrapSpan(cols)
  const vehicles = row.vehicles.map((v) => {
    let x = v.x + row.dir * row.speed * dt
    if (row.kind === 'rail') {
      if (row.dir > 0 && x > span) x = -cols - 2
      if (row.dir < 0 && x + v.w < -2) x = span
    } else {
      if (x > span - 2) x -= span
      if (x < -4) x += span
    }
    return { ...v, x }
  })
  return { ...row, vehicles }
}

function hitsTraffic(
  col: number,
  rowIndex: number,
  rows: Map<number, Row>,
  cols: number,
): boolean {
  const row = rows.get(rowIndex)
  if (row?.kind !== 'road' && row?.kind !== 'rail') return false
  return row.vehicles.some((v) => vehicleHit(col, v, cols))
}

function die(state: GameState, kind: 'car' | 'fall'): GameState {
  sfx(kind === 'car' ? 'hurt' : 'miss')
  const best = Math.max(state.best, state.score, loadBest())
  return {
    ...state,
    phase: 'gameover',
    best,
    hop: null,
    deathFlash: 0.35,
  }
}

export function createInitialState(cols = COLS): GameState {
  const runSeed = (Math.random() * 0xffffffff) >>> 0
  const state: GameState = {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    cols,
    col: Math.floor(cols / 2),
    row: 0,
    cameraY: 0,
    hop: null,
    hopCooldown: 0,
    invuln: 0,
    hopPulse: 0,
    bump: 0,
    deathFlash: 0,
    rows: new Map(),
    runSeed,
  }
  ensureRows(state, 0, ROW_BUFFER)
  return state
}

export function startGame(prev: GameState): GameState {
  const next = createInitialState(prev.cols)
  return {
    ...next,
    best: Math.max(prev.best, loadBest()),
    phase: 'playing',
    invuln: RESPAWN_INVULN,
  }
}

export function hop(state: GameState, dir: Dir): GameState {
  if (state.phase !== 'playing' || state.hop || state.hopCooldown > 0) return state

  let nc = state.col
  let nr = state.row
  if (dir === 'up') nr += 1
  if (dir === 'down') nr -= 1
  if (dir === 'left') nc -= 1
  if (dir === 'right') nc += 1

  if (nc < 0 || nc >= state.cols) {
    return { ...state, bump: 0.12 }
  }
  if (nr < 0) {
    return { ...state, bump: 0.12 }
  }

  const rowData = state.rows.get(nr) ?? generateRow(nr, state.cols, state.runSeed)
  if (rowData.trees.includes(nc)) {
    return { ...state, bump: 0.12 }
  }

  sfx('tap')
  const score = Math.max(state.score, nr)

  const next: GameState = {
    ...state,
    col: nc,
    row: nr,
    score,
    hop: { fromC: state.col, fromR: state.row, toC: nc, toR: nr, t: 0 },
    hopCooldown: HOP_COOLDOWN,
    hopPulse: 0.2,
    rows: new Map(state.rows),
  }
  if (!next.rows.has(nr)) next.rows.set(nr, rowData)
  const pos = playerCenter(next)
  next.cameraY = Math.max(next.cameraY, pos.r - PLAYER_VIEW_ROW)
  ensureRows(next, Math.floor(next.cameraY) - BACK_LIMIT - 2, Math.floor(next.cameraY) + ROW_BUFFER)
  return next
}

export function tick(state: GameState, dt: number): GameState {
  if (state.phase !== 'playing') {
    return {
      ...state,
      deathFlash: Math.max(0, state.deathFlash - dt),
      hopPulse: Math.max(0, state.hopPulse - dt),
    }
  }

  let next: GameState = {
    ...state,
    hopCooldown: Math.max(0, state.hopCooldown - dt),
    invuln: Math.max(0, state.invuln - dt),
    hopPulse: Math.max(0, state.hopPulse - dt),
    bump: Math.max(0, state.bump - dt),
    deathFlash: Math.max(0, state.deathFlash - dt),
    rows: new Map(state.rows),
  }

  if (next.hop) {
    const t = Math.min(1, next.hop.t + dt / HOP_DURATION)
    next = { ...next, hop: t >= 1 ? null : { ...next.hop, t } }
  }

  const pos = playerCenter(next)
  next.cameraY = Math.max(next.cameraY, pos.r - PLAYER_VIEW_ROW)

  ensureRows(next, Math.floor(next.cameraY) - BACK_LIMIT - 2, Math.floor(next.cameraY) + ROW_BUFFER)

  for (const [rowIndex, row] of next.rows) {
    if (row.kind === 'road' || row.kind === 'rail' || row.kind === 'water') {
      next.rows.set(rowIndex, moveRowVehicles(row, next.cols, dt))
    }
  }

  const standingRow = next.rows.get(next.row)
  if (standingRow?.kind === 'water') {
    const movedRow = next.rows.get(next.row)!
    if (onLog(next.col, movedRow, next.cols)) {
      for (const log of movedRow.vehicles) {
        if (!vehicleHit(next.col, log, next.cols)) continue
        next.col += movedRow.dir * movedRow.speed * dt
        if (next.col < -0.4 || next.col > next.cols - 0.6) {
          return die(next, 'fall')
        }
        break
      }
    } else if (next.invuln <= 0 && !next.hop) {
      return die(next, 'fall')
    }
  }

  if (next.invuln <= 0) {
    const hitPos = playerCenter(next)
    const rowIndexes = new Set([Math.floor(hitPos.r), Math.ceil(hitPos.r)])
    for (const rowIndex of rowIndexes) {
      if (hitsTraffic(hitPos.c, rowIndex, next.rows, next.cols)) {
        return die(next, 'car')
      }
    }
  }

  if (next.row < Math.floor(next.cameraY) - BACK_LIMIT) {
    return die(next, 'fall')
  }

  return next
}

export function toSnapshot(state: GameState): Snapshot {
  return {
    score: state.score,
    best: Math.max(state.best, loadBest()),
    phase: state.phase,
  }
}

export function getRow(state: GameState, row: number): Row {
  return state.rows.get(row) ?? generateRow(row, state.cols, state.runSeed)
}
