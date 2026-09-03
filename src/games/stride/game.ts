import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'dying' | 'gameover'
export type DeathCause = 'car' | 'train' | 'water' | 'edge' | 'hawk'

export type Vehicle = {
  /** Lane position of the left edge, always normalised to [0, laneSpan). */
  x: number
  w: number
  hue: number
}

export type Row = {
  kind: 'grass' | 'road' | 'water' | 'rail'
  dir: -1 | 1 | 0
  speed: number
  trees: number[]
  /** Static stepping stones on a water row. A row has stones or logs, never both. */
  rocks: number[]
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
  /** Best to beat, captured when the run started. */
  target: number
  beatBest: boolean
  cause: DeathCause | null
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  cols: number
  /** Fractional while riding a log, otherwise a whole column. */
  col: number
  row: number
  /** Smooth camera position (only moves up with the player). */
  cameraY: number
  hop: HopAnim | null
  hopCooldown: number
  /** Buffered input so fast swipes during a hop aren't dropped. */
  queued: Dir | null
  queuedAge: number
  invuln: number
  hopPulse: number
  bump: number
  deathFlash: number
  deathAnim: number
  cause: DeathCause | null
  /** Seconds since last hop up or down. */
  idleTimer: number
  /** Consecutive quick forward hops — drives the rising hop pitch. */
  streak: number
  streakTimer: number
  /** Row of the record this run is chasing (0 when there isn't one). */
  target: number
  beatBest: boolean
  celebrate: number
  milestone: number
  milestoneRow: number
  nearMiss: number
  nearMissCooldown: number
  rows: Map<number, Row>
  runSeed: number
}

export const COLS = 7
/** Target rows visible on screen — lower = more zoom. */
export const TARGET_VISIBLE_ROWS = 11
/** Desktop tile scale bump. */
export const DESKTOP_ZOOM = 1.1
/** Player sits this many rows from the bottom of the view once the camera is rolling. */
export const PLAYER_VIEW_ROW = 3
/** Die if you fall this many rows behind the camera. */
export const BACK_LIMIT = 2
/** Rows to keep generated ahead of the camera. */
export const ROW_BUFFER = 22
/** Lane width beyond the visible columns — traffic wraps across this span. */
export const LANE_PAD = 5
/** Distance markers every this many rows. */
export const MILESTONE_STEP = 25
/** Die if you don't hop up or down for this long (seconds). */
export const STALL_LIMIT = 9

const HOP_COOLDOWN = 0.05
const HOP_DURATION = 0.12
const INPUT_BUFFER = 0.18
const RESPAWN_INVULN = 0.5
const CAR_HUES = [18, 348, 272, 198, 38, 128, 168]
const LOG_HUE = 32
/**
 * Matched to the drawn hopper (its visual half-width is ~0.4 tiles) so a car
 * can't visibly bury itself in you before the hit registers. The small gap that
 * remains is deliberate forgiveness, not slop.
 */
const PLAYER_HALF = 0.32
/** Cars collide on their drawn bounds; just a sliver of mercy. */
const CAR_INSET = 0.02
const BUMP = 0.12
/** Forward hops closer together than this keep the streak alive. */
const STREAK_WINDOW = 0.9
const NEAR_MISS_GAP = 0.22

/**
 * Every car in a lane shares one speed (that's what keeps them from bunching),
 * so variety has to come from lane to lane. Discrete tiers read better than a
 * narrow random spread: a crawler can sit right next to a sprinter.
 */
const ROAD_TIERS = [0.58, 0.8, 1.0, 1.24] as const
const LOG_TIERS = [0.55, 0.78, 1.0, 1.22] as const

/** Weighted tier pick — the roll skews toward the faster tiers as difficulty climbs. */
function pickTier(tiers: readonly number[], d: number, rand: () => number): number {
  const biased = Math.pow(rand(), 1 - d * 0.55)
  return tiers[Math.min(tiers.length - 1, Math.floor(biased * tiers.length))]
}

export const TRAIN_WARN = 1.9
export const TRAIN_PASS = 0.5
export const TRAIN_COOL = 2.6
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

/** 0 at the start of a run, 1 once the difficulty ramp has topped out. */
export function difficultyAt(row: number): number {
  return Math.max(0, Math.min(1, (row - 6) / 110))
}

/** Tile size that fits both the row budget and the minimum column count. */
export function cellMetrics(viewWidth: number, viewHeight: number) {
  const hudTop = Math.max(52, Math.min(76, viewHeight * 0.11))
  const padBottom = Math.max(14, viewHeight * 0.02)
  const availH = viewHeight - hudTop - padBottom
  const zoom = viewWidth >= 900 ? DESKTOP_ZOOM : 1
  const byHeight = (availH / TARGET_VISIBLE_ROWS) * zoom
  const byWidth = viewWidth / COLS
  return { cell: Math.max(1, Math.min(byHeight, byWidth)), availH, hudTop }
}

/** Column count from viewport — fill screen width, sized from row height. */
export function pickCols(viewWidth: number, viewHeight: number): number {
  const { cell } = cellMetrics(viewWidth, viewHeight)
  return Math.max(COLS, Math.floor(viewWidth / cell))
}

/** Traffic wraps around this many tiles, so lanes tile seamlessly. */
export function laneSpan(cols: number): number {
  return cols + LANE_PAD
}

function wrapX(x: number, span: number): number {
  const m = x % span
  return m < 0 ? m + span : m
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

/**
 * Lay `count` entities around the lane at an exact `span / count` pitch so the
 * pattern tiles perfectly across the wrap seam. Jitter is capped at the spare
 * room in each slot, which keeps every gap at or above `minGap` forever.
 */
function spawnLane(
  span: number,
  count: number,
  w: number,
  minGap: number,
  hue: (rand: () => number) => number,
  rand: () => number,
  phase = 0,
): Vehicle[] {
  const step = span / count
  const slack = Math.max(0, step - w - minGap)
  const start = rand() * span + phase
  const out: Vehicle[] = []
  for (let i = 0; i < count; i++) {
    const jitter = (rand() - 0.5) * slack
    out.push({ x: wrapX(start + i * step + jitter, span), w, hue: hue(rand) })
  }
  return out
}

/** Most entities that fit while still leaving `minGap` between them. */
function laneCount(span: number, w: number, minGap: number, want: number): number {
  const max = Math.max(1, Math.floor(span / (w + minGap)))
  return Math.max(1, Math.min(max, want))
}

function makeGrassRow(cols: number, rand: () => number, d: number): Row {
  // Always leave a healthy number of open columns so a row can never wall you in.
  const openMin = Math.max(2, Math.round(cols * 0.4))
  const maxTrees = Math.max(0, cols - openMin)
  const want = Math.min(maxTrees, Math.round(cols * (0.14 + d * 0.18) * (0.5 + rand())))
  const pool = Array.from({ length: cols }, (_, i) => i)
  const trees: number[] = []
  for (let i = 0; i < want && pool.length; i++) {
    trees.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  }
  return { kind: 'grass', dir: 0, speed: 0, trees, rocks: [], vehicles: [] }
}

function makeRoadRow(row: number, cols: number, rand: () => number): Row {
  const d = difficultyAt(row)
  const dir: -1 | 1 = rand() < 0.5 ? -1 : 1
  // Capped near 2.2 tiles/sec: roughly half a second to clear a tile, which is
  // still about four times a hop, so even the quickest lane stays readable.
  const speed = (1.05 + d * 0.57) * pickTier(ROAD_TIERS, d, rand) * (0.92 + rand() * 0.16)
  const w = rand() < 0.28 ? 2.0 : 1.4
  const span = laneSpan(cols)
  // Faster lanes need wider gaps to keep the crossing window fair.
  const minGap = (1.25 + speed * 0.6) * (1 - d * 0.16)
  const want = 1 + Math.round(d * 2.4 + rand() * 2.2)
  const count = laneCount(span, w, minGap, want)
  return {
    kind: 'road',
    dir,
    speed,
    trees: [],
    rocks: [],
    vehicles: spawnLane(
      span,
      count,
      w,
      minGap,
      (r) => CAR_HUES[Math.floor(r() * CAR_HUES.length)],
      rand,
    ),
  }
}

/**
 * Static stepping stones. Placed in short clusters rather than scattered singly
 * so you can shuffle sideways instead of being pinned to one tile.
 */
function makeStoneRow(cols: number, rand: () => number, d: number): Row {
  const target = Math.max(2, Math.round(cols * (0.72 - d * 0.2)))
  const rocks = new Set<number>()
  for (let guard = 0; rocks.size < target && guard < 40; guard++) {
    const start = Math.floor(rand() * cols)
    const len = 2 + Math.floor(rand() * 2)
    for (let i = 0; i < len && rocks.size < target; i++) {
      if (start + i < cols) rocks.add(start + i)
    }
  }
  for (let c = 0; c < cols && rocks.size < target; c++) rocks.add(c)
  return {
    kind: 'water',
    dir: 0,
    speed: 0,
    trees: [],
    rocks: [...rocks].sort((a, b) => a - b),
    vehicles: [],
  }
}

function makeWaterRow(
  row: number,
  cols: number,
  runSeed: number,
  chunkStart: number,
  prevIsStone: boolean,
): Row {
  const rand = mulberry32(row * 1_048_583 ^ runSeed)
  const chunkRand = mulberry32(chunkStart * 1_048_583 ^ runSeed)
  const rowInChunk = row - chunkStart
  const d = difficultyAt(row)

  // Never stack two stone rows: from a stone you can only hop straight on, so a
  // second static row could strand you with nowhere legal to land.
  if (!prevIsStone && rand() < 0.32) return makeStoneRow(cols, rand, d)

  // Alternate directions so there's always a way to work across a chunk.
  const dir: -1 | 1 = rowInChunk % 2 === 0 ? 1 : -1
  const speed = (0.62 + d * 0.42) * pickTier(LOG_TIERS, d, rand) * (0.92 + rand() * 0.16)
  const span = laneSpan(cols)
  const tiles = cols < 9 ? 2 : rand() < 0.58 ? 2 : 3
  const logW = tiles - 0.1
  const gap = (0.95 + rand() * 0.55) * (1 - d * 0.15)
  const count = laneCount(span, logW, gap, 99)
  // Stagger neighbouring rows so log gaps don't line up into a dead end.
  const phase = rowInChunk * (0.8 + chunkRand() * 0.9)

  return {
    kind: 'water',
    dir,
    speed,
    trees: [],
    rocks: [],
    vehicles: spawnLane(span, count, logW, gap, () => LOG_HUE, rand, phase),
  }
}

function makeRailRow(row: number, cols: number, runSeed: number): Row {
  const rand = mulberry32(row * 1_048_583 ^ runSeed)
  const d = difficultyAt(row)
  const dir: -1 | 1 = rand() < 0.5 ? -1 : 1
  const trainW = 5 + rand() * 1.6
  // Warning never drops below ~1.5s so the crossing is always telegraphed.
  const railWarn = 1.9 - d * 0.35 + rand() * 0.9
  const railPass = 0.44 + rand() * 0.16
  const railCool = 2.4 - d * 0.7 + rand() * 2.4
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
    rocks: [],
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

/** How many hazard rows sit directly behind this one. */
function hazardRun(row: number, rows?: Map<number, Row>): number {
  let n = 0
  for (let r = row - 1; n < 10; r--) {
    const kind = rows?.get(r)?.kind
    if (!kind || kind === 'grass') break
    n += 1
  }
  return n
}

export function generateRow(
  row: number,
  cols: number,
  runSeed: number,
  rows?: Map<number, Row>,
): Row {
  const rand = mulberry32((row + 1) * 1_048_583 ^ runSeed)
  const prev = rows?.get(row - 1)
  const d = difficultyAt(row)

  if (row < 4) {
    const trees: number[] = []
    if (row > 0) {
      for (let c = 0; c < cols; c++) {
        if (c === Math.floor(cols / 2) && row < 2) continue
        if (rand() < 0.2) trees.push(c)
      }
    }
    return { kind: 'grass', dir: 0, speed: 0, trees, rocks: [], vehicles: [] }
  }

  // Guarantee a breather after a stretch of hazards; the stretch grows with
  // difficulty. This runs before chunk continuation so a long water or rail
  // chunk can't stack on top of an already-long run.
  if (hazardRun(row, rows) >= 3 + Math.round(d * 3)) {
    return makeGrassRow(cols, rand, d)
  }

  const prevIsStone = prev?.kind === 'water' && prev.rocks.length > 0

  if (prev?.kind === 'water') {
    const start = chunkStart(row, 'water', rows)
    if (row < start + chunkLength(start, runSeed, 2, d > 0.5 ? 4 : 3)) {
      return makeWaterRow(row, cols, runSeed, start, prevIsStone)
    }
  }

  if (prev?.kind === 'rail') {
    const start = chunkStart(row, 'rail', rows)
    if (row < start + chunkLength(start, runSeed, 1, 2)) {
      return makeRailRow(row, cols, runSeed)
    }
  }

  // Each water/rail pick spawns a multi-row chunk, so their odds stay low to
  // keep roads the headline hazard.
  const grassChance = Math.max(0.16, 0.3 - d * 0.12)
  const waterChance = row > 8 ? 0.06 + d * 0.03 : 0
  const railChance = row > 12 ? 0.05 + d * 0.03 : 0
  const roll = rand()

  if (roll < grassChance) return makeGrassRow(cols, rand, d)
  if (roll < grassChance + waterChance) {
    return makeWaterRow(row, cols, runSeed, row, prevIsStone)
  }
  if (roll < grassChance + waterChance + railChance) return makeRailRow(row, cols, runSeed)
  return makeRoadRow(row, cols, rand)
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

function easeHop(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export { easeHop }

function playerCenter(state: GameState) {
  if (!state.hop) return { c: state.col, r: state.row }
  const t = easeHop(state.hop.t)
  return {
    c: state.hop.fromC + (state.hop.toC - state.hop.fromC) * t,
    r: state.hop.fromR + (state.hop.toR - state.hop.fromR) * t,
  }
}

function playerBox(col: number) {
  const c = col + 0.5
  return { left: c - PLAYER_HALF, right: c + PLAYER_HALF }
}

/**
 * Lane entities exist at `x` and `x - span`; checking both covers the wrap seam
 * without any of the old "is it near an edge" guesswork.
 */
function laneHit(col: number, v: Vehicle, span: number, inset: number): boolean {
  const { left, right } = playerBox(col)
  const hit = (l: number) => right > l + inset && left < l + v.w - inset
  return hit(v.x) || hit(v.x - span)
}

/** Horizontal clearance between the player and an entity, across the seam. */
function laneClearance(col: number, v: Vehicle, span: number): number {
  const { left, right } = playerBox(col)
  const gap = (l: number) => {
    if (right < l) return l - right
    if (left > l + v.w) return left - (l + v.w)
    return 0
  }
  return Math.min(gap(v.x), gap(v.x - span))
}

/** You ride a log when your centre is over its body. */
function onLog(col: number, v: Vehicle, span: number): boolean {
  const c = col + 0.5
  const inside = (l: number) => c > l + 0.1 && c < l + v.w - 0.1
  return inside(v.x) || inside(v.x - span)
}

/** Stones are static and snap you to their tile, so a whole-column test is exact. */
function onRock(col: number, row: Row): boolean {
  return row.rocks.includes(Math.round(col))
}

/** Train uses body-only bounds and never wraps. */
function trainHit(col: number, train: Vehicle): boolean {
  const { left, right } = playerBox(col)
  return right > train.x + train.w * 0.08 && left < train.x + train.w * 0.92
}

function moveLaneVehicles(row: Row, cols: number, dt: number): Row {
  const span = laneSpan(cols)
  const delta = row.dir * row.speed * dt
  return {
    ...row,
    vehicles: row.vehicles.map((v) => ({ ...v, x: wrapX(v.x + delta, span) })),
  }
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

    const parked = row.dir > 0 ? -v.w - 6 : cols + 6
    let x = parked
    if (railTimer >= warn && railTimer < warn + pass) {
      const t = (railTimer - warn) / pass
      const travel = cols + v.w + 10
      x = row.dir > 0 ? -v.w - 5 + travel * t : cols + 5 - travel * t
    }

    return { ...row, railTimer, vehicles: [{ ...v, x }] }
  }

  if (row.kind === 'road' || row.kind === 'water') return moveLaneVehicles(row, cols, dt)
  return row
}

function activeTrafficRow(state: GameState): number {
  if (!state.hop) return state.row
  return state.hop.t < 0.5 ? state.hop.fromR : state.hop.toR
}

function hitsRoad(col: number, rowIndex: number, rows: Map<number, Row>, cols: number): boolean {
  const row = rows.get(rowIndex)
  if (row?.kind !== 'road') return false
  const span = laneSpan(cols)
  return row.vehicles.some((v) => laneHit(col, v, span, CAR_INSET))
}

function hitsRail(col: number, row: Row): boolean {
  if (getRailCycle(row).phase !== 'pass') return false
  return row.vehicles.some((v) => trainHit(col, v))
}

function die(state: GameState, cause: DeathCause): GameState {
  sfx(cause === 'car' || cause === 'train' ? 'hurt' : 'miss')
  const best = Math.max(state.best, state.score, loadBest())
  return {
    ...state,
    phase: 'dying',
    best,
    cause,
    hop: null,
    queued: null,
    streak: 0,
    deathAnim: 0.55,
    deathFlash: 0.45,
  }
}

export function createInitialState(cols = COLS): GameState {
  const runSeed = (Math.random() * 0xffffffff) >>> 0
  const best = loadBest()
  const state: GameState = {
    phase: 'menu',
    score: 0,
    best,
    cols,
    col: Math.floor(cols / 2),
    row: 0,
    cameraY: 0,
    hop: null,
    hopCooldown: 0,
    queued: null,
    queuedAge: 0,
    invuln: 0,
    hopPulse: 0,
    bump: 0,
    deathFlash: 0,
    deathAnim: 0,
    cause: null,
    idleTimer: 0,
    streak: 0,
    streakTimer: 99,
    target: best,
    beatBest: false,
    celebrate: 0,
    milestone: 0,
    milestoneRow: 0,
    nearMiss: 0,
    nearMissCooldown: 0,
    rows: new Map(),
    runSeed,
  }
  ensureRows(state, 0, ROW_BUFFER)
  return state
}

export function startGame(prev: GameState): GameState {
  const next = createInitialState(prev.cols)
  const best = Math.max(prev.best, loadBest())
  return {
    ...next,
    best,
    target: best,
    phase: 'playing',
    invuln: RESPAWN_INVULN,
  }
}

export function hop(state: GameState, dir: Dir): GameState {
  if (state.phase !== 'playing') return state
  if (state.hop || state.hopCooldown > 0) {
    // Buffer the input instead of dropping it — fast swipes should always land.
    return { ...state, queued: dir, queuedAge: 0 }
  }

  const fromC = state.col
  const fromR = state.row
  let nr = fromR
  let nc = fromC
  if (dir === 'up') nr += 1
  else if (dir === 'down') nr -= 1
  else if (dir === 'left') nc -= 1
  else nc += 1

  const blocked = (): GameState => ({ ...state, queued: null, bump: BUMP })
  if (nr < 0) return blocked()

  const rowData = state.rows.get(nr) ?? generateRow(nr, state.cols, state.runSeed, state.rows)
  // Only drifting logs preserve a sub-tile offset. Land and stones re-grid, so
  // stepping onto a stone always plants you squarely on it.
  const driftingWater = rowData.kind === 'water' && rowData.rocks.length === 0
  const target = driftingWater ? nc : Math.round(nc)
  if (target < -0.001 || target > state.cols - 1 + 0.001) return blocked()
  if (rowData.kind !== 'water' && rowData.trees.includes(target)) return blocked()

  const forward = nr > fromR
  const streak = forward && state.streakTimer <= STREAK_WINDOW ? state.streak + 1 : 0
  sfx('hop', forward ? Math.min(streak, 14) : 0)

  const next: GameState = {
    ...state,
    col: target,
    row: nr,
    score: Math.max(state.score, nr),
    idleTimer: nr !== fromR ? 0 : state.idleTimer,
    streak: forward ? streak : 0,
    streakTimer: forward ? 0 : state.streakTimer,
    hop: { fromC, fromR, toC: target, toR: nr, t: 0 },
    hopCooldown: HOP_COOLDOWN,
    hopPulse: 0.2,
    queued: null,
    queuedAge: 0,
    rows: new Map(state.rows),
  }
  if (!next.rows.has(nr)) next.rows.set(nr, rowData)

  if (state.target > 0 && !state.beatBest && nr > state.target) {
    next.beatBest = true
    next.celebrate = 1.35
    sfx('wave')
  } else if (nr > 0 && nr % MILESTONE_STEP === 0 && nr > state.milestoneRow) {
    next.milestoneRow = nr
    next.milestone = 0.9
    sfx('good')
  }

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
    const next: GameState = {
      ...state,
      deathAnim: state.deathAnim - dt,
      deathFlash: Math.max(0, state.deathFlash - dt),
      hopPulse: Math.max(0, state.hopPulse - dt),
      rows: new Map(state.rows),
    }
    ensureRows(next, Math.floor(next.cameraY) - BACK_LIMIT - 2, Math.floor(next.cameraY) + ROW_BUFFER)
    for (const [rowIndex, row] of next.rows) {
      next.rows.set(rowIndex, moveRowVehicles(row, next.cols, dt))
    }
    if (next.deathAnim <= 0) return { ...next, phase: 'gameover', deathAnim: 0 }
    return next
  }

  let next: GameState = {
    ...state,
    hopCooldown: Math.max(0, state.hopCooldown - dt),
    invuln: Math.max(0, state.invuln - dt),
    hopPulse: Math.max(0, state.hopPulse - dt),
    bump: Math.max(0, state.bump - dt),
    deathFlash: Math.max(0, state.deathFlash - dt),
    celebrate: Math.max(0, state.celebrate - dt),
    milestone: Math.max(0, state.milestone - dt),
    nearMiss: Math.max(0, state.nearMiss - dt),
    nearMissCooldown: Math.max(0, state.nearMissCooldown - dt),
    idleTimer: state.idleTimer + dt,
    streakTimer: state.streakTimer + dt,
    queuedAge: state.queued ? state.queuedAge + dt : 0,
    rows: new Map(state.rows),
  }

  if (next.hop) {
    const t = Math.min(1, next.hop.t + dt / HOP_DURATION)
    next.hop = t >= 1 ? null : { ...next.hop, t }
  }

  if (next.queued && next.queuedAge > INPUT_BUFFER) {
    next = { ...next, queued: null, queuedAge: 0 }
  }
  if (next.queued && !next.hop && next.hopCooldown <= 0) {
    const dir = next.queued
    next = hop({ ...next, queued: null, queuedAge: 0 }, dir)
    if (next.phase !== 'playing') return next
  }

  const pos = playerCenter(next)
  next.cameraY = Math.max(next.cameraY, pos.r - PLAYER_VIEW_ROW)
  ensureRows(next, Math.floor(next.cameraY) - BACK_LIMIT - 2, Math.floor(next.cameraY) + ROW_BUFFER)

  for (const [rowIndex, row] of next.rows) {
    next.rows.set(rowIndex, moveRowVehicles(row, next.cols, dt))
  }

  const span = laneSpan(next.cols)
  const standing = next.rows.get(next.row)

  if (standing?.kind === 'water' && !next.hop) {
    if (standing.rocks.length) {
      // Stones don't move, so there's nothing to carry you — just stand or sink.
      if (!onRock(next.col, standing) && next.invuln <= 0) return die(next, 'water')
    } else if (standing.vehicles.some((v) => onLog(next.col, v, span))) {
      // Drift with the log; the column stays fractional until you reach solid ground.
      next.col += standing.dir * standing.speed * dt
      if (next.col < -0.4 || next.col > next.cols - 0.6) return die(next, 'edge')
    } else if (next.invuln <= 0) {
      return die(next, 'water')
    }
  }

  if (next.invuln <= 0) {
    const hitPos = playerCenter(next)
    if (!next.hop) {
      if (standing?.kind === 'rail' && hitsRail(next.col, standing)) return die(next, 'train')
      if (standing?.kind === 'road' && hitsRoad(next.col, next.row, next.rows, next.cols)) {
        return die(next, 'car')
      }
    } else if (hitsRoad(hitPos.c, activeTrafficRow(next), next.rows, next.cols)) {
      return die(next, 'car')
    }

    if (next.nearMissCooldown <= 0) {
      const trafficRow = next.rows.get(activeTrafficRow(next))
      if (trafficRow?.kind === 'road') {
        const close = trafficRow.vehicles.some(
          (v) => laneClearance(hitPos.c, v, span) < NEAR_MISS_GAP,
        )
        if (close) {
          next.nearMiss = 0.28
          next.nearMissCooldown = 0.7
          sfx('whoosh')
        }
      }
    }
  }

  if (next.row < Math.floor(next.cameraY) - BACK_LIMIT) return die(next, 'edge')
  if (next.row > 2 && next.idleTimer >= STALL_LIMIT) return die(next, 'hawk')

  return next
}

export function toSnapshot(state: GameState): Snapshot {
  return {
    score: state.score,
    best: Math.max(state.best, loadBest()),
    phase: state.phase,
    target: state.target,
    beatBest: state.beatBest,
    cause: state.cause,
  }
}

export function getRow(state: GameState, row: number): Row {
  return state.rows.get(row) ?? generateRow(row, state.cols, state.runSeed, state.rows)
}
