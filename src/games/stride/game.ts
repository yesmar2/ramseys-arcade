import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'dying' | 'gameover'

export type Vehicle = {
  x: number
  w: number
  hue: number
  /** Per-vehicle speed multiplier (cars). */
  speedMul?: number
}

export type Row = {
  kind: 'grass' | 'road' | 'water' | 'rail'
  dir: -1 | 1 | 0
  speed: number
  trees: number[]
  vehicles: Vehicle[]
  /** Rail crossing cycle timer (seconds). */
  railTimer?: number
  railWarn?: number
  railPass?: number
  railCool?: number
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
  deathAnim: number
  /** Seconds since last hop forward (row increased). */
  idleTimer: number
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
const PLAYER_HALF = 0.15
/** Die if you don't move forward for this long (seconds). */
export const STALL_LIMIT = 13

export const TRAIN_WARN = 1.55
export const TRAIN_PASS = 0.38
export const TRAIN_COOL = 2.75
export const TRAIN_CYCLE = TRAIN_WARN + TRAIN_PASS + TRAIN_COOL

export type RailPhase = 'warn' | 'pass' | 'cool'

export function getRailCycle(row: Row): { phase: RailPhase; flash: boolean; passT: number } {
  const warn = row.railWarn ?? TRAIN_WARN
  const pass = row.railPass ?? TRAIN_PASS
  const cool = row.railCool ?? TRAIN_COOL
  const total = warn + pass + cool
  const timer = (row.railTimer ?? 0) % total
  if (timer < warn) {
    return { phase: 'warn', flash: Math.floor(timer * 7) % 2 === 0, passT: 0 }
  }
  if (timer < warn + pass) {
    return { phase: 'pass', flash: false, passT: (timer - warn) / pass }
  }
  return { phase: 'cool', flash: false, passT: 0 }
}

/** Column count from viewport — fill screen width, sized from row height. */
export function pickCols(viewWidth: number, viewHeight: number): number {
  const hudTop = Math.max(52, Math.min(76, viewHeight * 0.11))
  const padBottom = Math.max(14, viewHeight * 0.02)
  const availH = viewHeight - hudTop - padBottom
  const zoom = viewWidth >= 900 ? DESKTOP_ZOOM : 1
  const cell = (availH / TARGET_VISIBLE_ROWS) * zoom
  let cols = Math.max(COLS, Math.floor(viewWidth / cell))
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
      speedMul: 0.5 + rand() * 1.2,
    })
  }
  return vehicles
}

function spawnLogs(cols: number, rand: () => number, phaseOffset = 0): Vehicle[] {
  const count = cols < 8 ? 2 : cols < 11 ? 3 : 4
  const gap = 0.65
  const margin = 0.4
  const maxW = (cols - margin * 2 - (count - 1) * gap) / count
  const logW = Math.min(2.4 + rand() * 0.85, maxW)
  const packW = count * logW + (count - 1) * gap
  const start = margin + rand() * Math.max(0.2, cols - packW - margin)
  const logs: Vehicle[] = []
  for (let i = 0; i < count; i++) {
    logs.push({
      x: start + i * (logW + gap) + phaseOffset,
      w: logW,
      hue: LOG_HUE,
    })
  }
  return logs
}

function makeWaterRow(
  row: number,
  cols: number,
  runSeed: number,
  waterChunkStart: number,
): Row {
  const rand = mulberry32(row * 1_048_583 ^ runSeed)
  const chunkRand = mulberry32(waterChunkStart * 1_048_583 ^ runSeed)
  const rowInChunk = row - waterChunkStart

  // Alternate directions so you can hop across rows.
  const dir: -1 | 1 = rowInChunk % 2 === 0 ? 1 : -1
  const baseSpeed = 0.45 + chunkRand() * 0.75
  const speed = baseSpeed * (0.78 + rand() * 0.44)
  const phaseOffset = rowInChunk * (0.4 + chunkRand() * 0.55)

  return {
    kind: 'water',
    dir,
    speed,
    trees: [],
    vehicles: spawnLogs(cols, rand, phaseOffset),
  }
}

function makeRailRow(row: number, cols: number, runSeed: number): Row {
  const rand = mulberry32(row * 1_048_583 ^ runSeed)
  const dir: -1 | 1 = rand() < 0.5 ? -1 : 1
  const trainW = 4.8 + rand() * 1.4
  const railWarn = 1.1 + rand() * 1.4
  const railPass = 0.26 + rand() * 0.22
  const railCool = 1.8 + rand() * 4.2
  const cycle = railWarn + railPass + railCool
  return {
    kind: 'rail',
    dir,
    speed: 0,
    railTimer: rand() * cycle,
    railWarn,
    railPass,
    railCool,
    trees: [],
    vehicles: [{ x: dir > 0 ? -trainW - 6 : cols + 6, w: trainW, hue: 350 }],
  }
}

function chunkLength(startRow: number, runSeed: number, min: number, max: number): number {
  const rand = mulberry32(startRow * 1_048_583 ^ runSeed)
  return min + Math.floor(rand() * (max - min + 1))
}

function chunkStart(row: number, kind: Row['kind'], rows?: Map<number, Row>): number {
  let start = row
  while (rows?.get(start - 1)?.kind === kind) start -= 1
  return start
}

export function generateRow(
  row: number,
  cols: number,
  runSeed: number,
  rows?: Map<number, Row>,
): Row {
  const rand = mulberry32((row + 1) * 1_048_583 ^ runSeed)
  const prev = rows?.get(row - 1)

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

  if (prev?.kind === 'water') {
    const start = chunkStart(row, 'water', rows)
    if (row < start + chunkLength(start, runSeed, 3, 5)) {
      return makeWaterRow(row, cols, runSeed, start)
    }
  }

  if (prev?.kind === 'rail') {
    const start = chunkStart(row, 'rail', rows)
    if (row < start + chunkLength(start, runSeed, 2, 4)) {
      return makeRailRow(row, cols, runSeed)
    }
  }

  if (row > 8 && rand() < 0.16) {
    return makeWaterRow(row, cols, runSeed, row)
  }

  if (row > 10 && rand() < 0.14) {
    return makeRailRow(row, cols, runSeed)
  }

  if (rand() < 0.34) {
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
    speed: tier * (0.4 + rand() * 1.15),
    trees: [],
    vehicles: spawnVehicles(cols, count, w, rand),
  }
}

function ensureRows(state: GameState, minRow: number, maxRow: number) {
  for (let r = minRow; r <= maxRow; r++) {
    if (!state.rows.has(r)) {
      state.rows.set(r, generateRow(r, state.cols, state.runSeed, state.rows))
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

function overlap1D(
  playerLeft: number,
  playerRight: number,
  vLeft: number,
  vRight: number,
  inset: number,
): boolean {
  return playerRight > vLeft + inset && playerLeft < vRight - inset
}

function entityOverlaps(
  col: number,
  vehicle: Vehicle,
  cols: number,
  playerHalf: number,
  entityInset: number,
  allowWrap: boolean,
): boolean {
  const playerLeft = col + 0.5 - playerHalf
  const playerRight = col + 0.5 + playerHalf

  const check = (left: number) =>
    overlap1D(playerLeft, playerRight, left, left + vehicle.w, entityInset)

  if (check(vehicle.x)) return true
  if (!allowWrap) return false

  const span = wrapSpan(cols)
  if (vehicle.x < cols * 0.5 && check(vehicle.x + span)) return true
  if (vehicle.x + vehicle.w > cols * 0.5 && check(vehicle.x - span)) return true
  return false
}

/** Tight hitbox for cars — matches visible sprites. */
function vehicleHit(col: number, vehicle: Vehicle, cols: number): boolean {
  return entityOverlaps(col, vehicle, cols, PLAYER_HALF, 0.05, true)
}

/** Train uses body-only bounds; only during pass phase. */
function trainHit(col: number, train: Vehicle): boolean {
  const playerLeft = col + 0.5 - PLAYER_HALF
  const playerRight = col + 0.5 + PLAYER_HALF
  const bodyLeft = train.x + train.w * 0.08
  const bodyRight = train.x + train.w * 0.92
  return playerRight > bodyLeft && playerLeft < bodyRight
}

/** Log hitbox aligned to visible platform. */
function logHit(col: number, vehicle: Vehicle, cols: number): boolean {
  return entityOverlaps(col, vehicle, cols, PLAYER_HALF, 0.06, true)
}

function clampOnLog(col: number, log: Vehicle): number {
  const minC = log.x + PLAYER_HALF - 0.5
  const maxC = log.x + log.w - PLAYER_HALF - 0.5
  return Math.max(minC, Math.min(maxC, col))
}

function treeAt(rows: Map<number, Row>, row: number, col: number): boolean {
  return rows.get(row)?.trees.includes(col) ?? false
}

function blockedByTree(rows: Map<number, Row>, col: number, row: number): boolean {
  return treeAt(rows, row, Math.round(col))
}

function onLog(col: number, row: Row, cols: number): boolean {
  if (row.kind !== 'water') return false
  return row.vehicles.some((v) => logHit(col, v, cols))
}

function activeTrafficRow(state: GameState): number {
  if (!state.hop) return state.row
  return state.hop.t < 0.5 ? state.hop.fromR : state.hop.toR
}

function moveRowVehicles(row: Row, cols: number, dt: number): Row {
  if (row.kind === 'rail') {
    const warn = row.railWarn ?? TRAIN_WARN
    const pass = row.railPass ?? TRAIN_PASS
    const cool = row.railCool ?? TRAIN_COOL
    const cycle = warn + pass + cool
    const railTimer = ((row.railTimer ?? 0) + dt) % cycle
    const v = row.vehicles[0]
    if (!v) return { ...row, railTimer }

    let x = v.x
    if (railTimer < warn) {
      x = row.dir > 0 ? -v.w - 6 : cols + 6
    } else if (railTimer < warn + pass) {
      const t = (railTimer - warn) / pass
      const travel = cols + v.w + 10
      x = row.dir > 0 ? -v.w - 5 + travel * t : cols + 5 - travel * t
    } else {
      x = row.dir > 0 ? -v.w - 6 : cols + 6
    }

    return {
      ...row,
      railTimer,
      vehicles: [{ ...v, x }],
    }
  }

  if (row.kind !== 'road' && row.kind !== 'water') return row
  const span = wrapSpan(cols)
  const vehicles = row.vehicles.map((v) => {
    const mul = v.speedMul ?? 1
    let x = v.x + row.dir * row.speed * mul * dt
    if (x > span - 2) x -= span
    if (x < -4) x += span
    return { ...v, x }
  })
  return { ...row, vehicles }
}

function hitsRoad(
  col: number,
  rowIndex: number,
  rows: Map<number, Row>,
  cols: number,
): boolean {
  const row = rows.get(rowIndex)
  if (row?.kind !== 'road') return false
  return row.vehicles.some((v) => vehicleHit(col, v, cols))
}

function hitsRail(col: number, row: Row): boolean {
  if (getRailCycle(row).phase !== 'pass') return false
  return row.vehicles.some((v) => trainHit(col, v))
}

function die(state: GameState, kind: 'car' | 'fall'): GameState {
  sfx(kind === 'car' ? 'hurt' : 'miss')
  const best = Math.max(state.best, state.score, loadBest())
  return {
    ...state,
    phase: 'dying',
    best,
    hop: null,
    deathAnim: 0.55,
    deathFlash: 0,
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
    deathAnim: 0,
    idleTimer: 0,
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

  const rowData = state.rows.get(nr) ?? generateRow(nr, state.cols, state.runSeed, state.rows)
  if (rowData.trees.includes(nc)) {
    return { ...state, bump: 0.12 }
  }

  sfx('tap')
  const score = Math.max(state.score, nr)

  const wentForward = nr > state.row
  const next: GameState = {
    ...state,
    col: nc,
    row: nr,
    score,
    idleTimer: wentForward ? 0 : state.idleTimer,
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
  if (state.phase === 'menu' || state.phase === 'gameover') {
    return {
      ...state,
      deathFlash: Math.max(0, state.deathFlash - dt),
      hopPulse: Math.max(0, state.hopPulse - dt),
    }
  }

  if (state.phase === 'dying') {
    let next: GameState = {
      ...state,
      deathAnim: state.deathAnim - dt,
      hopPulse: Math.max(0, state.hopPulse - dt),
      rows: new Map(state.rows),
    }
    ensureRows(next, Math.floor(next.cameraY) - BACK_LIMIT - 2, Math.floor(next.cameraY) + ROW_BUFFER)
    for (const [rowIndex, row] of next.rows) {
      if (row.kind === 'road' || row.kind === 'rail' || row.kind === 'water') {
        next.rows.set(rowIndex, moveRowVehicles(row, next.cols, dt))
      }
    }
    if (next.deathAnim <= 0) {
      return { ...next, phase: 'gameover', deathAnim: 0 }
    }
    return next
  }

  let next: GameState = {
    ...state,
    hopCooldown: Math.max(0, state.hopCooldown - dt),
    invuln: Math.max(0, state.invuln - dt),
    hopPulse: Math.max(0, state.hopPulse - dt),
    bump: Math.max(0, state.bump - dt),
    deathFlash: Math.max(0, state.deathFlash - dt),
    idleTimer: state.idleTimer + dt,
    rows: new Map(state.rows),
  }

  if (next.hop) {
    const t = Math.min(1, next.hop.t + dt / HOP_DURATION)
    const landing = t >= 1
    next = { ...next, hop: landing ? null : { ...next.hop, t } }
    if (!landing) {
      const hopPos = playerCenter(next)
      if (blockedByTree(next.rows, hopPos.c, hopPos.r)) {
        const { fromC, fromR } = next.hop!
        return {
          ...next,
          hop: null,
          col: fromC,
          row: fromR,
          bump: 0.12,
        }
      }
    }
    if (landing) {
      const landRow = next.rows.get(next.row)
      if (landRow?.kind === 'water') {
        for (const log of landRow.vehicles) {
          if (!logHit(next.col, log, next.cols)) continue
          next = { ...next, col: clampOnLog(next.col, log) }
          break
        }
      }
    }
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
        if (!logHit(next.col, log, next.cols)) continue
        next.col += movedRow.dir * movedRow.speed * dt
        next.col = clampOnLog(next.col, log)
        if (next.col < -0.55 || next.col >= next.cols - 0.45) {
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
    if (!next.hop) {
      const row = next.rows.get(next.row)
      if (row?.kind === 'rail' && hitsRail(next.col, row)) {
        return die(next, 'car')
      }
      if (row?.kind === 'road' && hitsRoad(next.col, next.row, next.rows, next.cols)) {
        return die(next, 'car')
      }
    } else {
      const rowIndex = activeTrafficRow(next)
      if (hitsRoad(hitPos.c, rowIndex, next.rows, next.cols)) {
        return die(next, 'car')
      }
    }
  }

  if (next.row < Math.floor(next.cameraY) - BACK_LIMIT) {
    return die(next, 'fall')
  }

  if (next.row > 3 && next.idleTimer >= STALL_LIMIT) {
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
  return state.rows.get(row) ?? generateRow(row, state.cols, state.runSeed, state.rows)
}
