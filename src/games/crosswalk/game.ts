import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'gameover'
export type LaneKind = 'home' | 'safe' | 'road' | 'river'
export type VehicleKind = 'car' | 'truck'
export type RiderKind = 'log' | 'turtle'
export type DeathKind = 'car' | 'water' | 'time'

export type Vehicle = {
  x: number
  w: number
  hue: number
  kind: VehicleKind
}

export type Rider = {
  x: number
  w: number
  kind: RiderKind
  /** Turtles only: how many shells make up the group. */
  units: number
  diveOffset: number
}

export type Lane = {
  kind: LaneKind
  dir: -1 | 0 | 1
  speed: number
  vehicles: Vehicle[]
  riders: Rider[]
  /** Seconds per dive cycle; 0 means this row never submerges. */
  divePeriod: number
}

export type Bay = {
  col: number
  filled: boolean
  fly: boolean
}

export type Splash = {
  x: number
  y: number
  kind: DeathKind
  t: number
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  lives: number
  level: number
  homes: number
  homesTotal: number
  bays: boolean[]
  timeFrac: number
  timeLow: boolean
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  lives: number
  level: number
  cols: number
  rows: number
  /** Left edge of the frog in cell units — fractional while riding. */
  px: number
  py: number
  hopCooldown: number
  invuln: number
  flash: number
  hopPulse: number
  bump: number
  farthest: number
  clock: number
  timeLeft: number
  timeLimit: number
  lanes: Lane[]
  bays: Bay[]
  splash: Splash | null
  flyTimer: number
  toast: { text: string; t: number } | null
}

export const COLS = 11
export const ROWS = 13
export const START_LIVES = 3
export const MAX_LIVES = 5
export const HOME_ROW = 0
export const RIVER_ROWS = [1, 2, 3, 4, 5] as const
export const MEDIAN_ROW = 6
export const ROAD_ROWS = [7, 8, 9, 10, 11] as const
export const START_ROW = 12
export const BAY_COLS = [1, 3, 5, 7, 9] as const

const HOP_COOLDOWN = 0.13
const RESPAWN_INVULN = 1.1
/** Generous: from a drifting log, almost any column lines up with the nearest bay. */
const BAY_TOLERANCE = 0.85
const SCORE_HOP = 10
const SCORE_BAY = 100
const SCORE_PER_SECOND = 5
const SCORE_FLY = 200
const SCORE_LEVEL = 500
const CAR_HUES = [18, 348, 272, 198, 38, 128]

/** Wrap span: vehicles recycle across this many cells so gaps stay even. */
function wrapSpan(cols: number) {
  return cols + 4
}

function loadBest() {
  return getPersonalBest('crosswalk')
}

export function crosswalkLayout() {
  return { cols: COLS, rows: ROWS, aspectW: 11, aspectH: 13 }
}

/** Speed ramp is deliberately shallow — level 1 should feel like a stroll. */
function speedScale(level: number) {
  return 1 + Math.min(level, 18) * 0.06
}

type RoadPlan = {
  dir: -1 | 1
  speed: number
  count: number
  kind: VehicleKind
  w: number
}

/** Index 0 is the row closest to the start bank, so traffic thickens going up. */
const ROAD_PLAN: RoadPlan[] = [
  { dir: -1, speed: 0.95, count: 2, kind: 'car', w: 1.5 },
  { dir: 1, speed: 1.2, count: 2, kind: 'car', w: 1.5 },
  { dir: -1, speed: 0.8, count: 2, kind: 'truck', w: 2.6 },
  { dir: 1, speed: 1.45, count: 3, kind: 'car', w: 1.4 },
  { dir: -1, speed: 1.05, count: 2, kind: 'truck', w: 2.4 },
]

type RiverPlan = {
  dir: -1 | 1
  speed: number
  kind: RiderKind
  /** Log width, or shells per turtle group. */
  size: number
  count: number
  /** Level at which this row starts submerging; Infinity means never. */
  divesFrom: number
}

/** Index 0 is the row just above the median, index 4 borders the home bays. */
const RIVER_PLAN: RiverPlan[] = [
  { dir: -1, speed: 0.7, kind: 'turtle', size: 3, count: 3, divesFrom: Infinity },
  { dir: 1, speed: 0.6, kind: 'log', size: 4, count: 2, divesFrom: Infinity },
  { dir: 1, speed: 0.95, kind: 'log', size: 3, count: 3, divesFrom: Infinity },
  { dir: -1, speed: 0.8, kind: 'turtle', size: 2, count: 4, divesFrom: 2 },
  // Row bordering the bays: long, slow, densely packed so lining up is unhurried.
  { dir: 1, speed: 0.6, kind: 'log', size: 4, count: 3, divesFrom: Infinity },
]

function spawnVehicles(cols: number, plan: RoadPlan, count: number): Vehicle[] {
  const span = wrapSpan(cols)
  const gap = span / count
  const jitter = Math.max(0, (gap - plan.w) * 0.22)
  const seed = Math.random() * span
  const vehicles: Vehicle[] = []
  for (let i = 0; i < count; i++) {
    const x = (seed + i * gap + (Math.random() - 0.5) * jitter) % span
    vehicles.push({
      x: x - 2,
      w: plan.w,
      hue: CAR_HUES[Math.floor(Math.random() * CAR_HUES.length)],
      kind: plan.kind,
    })
  }
  return vehicles
}

function spawnRiders(cols: number, plan: RiverPlan): Rider[] {
  const span = wrapSpan(cols)
  const gap = span / plan.count
  const jitter = Math.max(0, (gap - plan.size) * 0.2)
  const seed = Math.random() * span
  const riders: Rider[] = []
  for (let i = 0; i < plan.count; i++) {
    const x = (seed + i * gap + (Math.random() - 0.5) * jitter) % span
    riders.push({
      x: x - 2,
      w: plan.size,
      kind: plan.kind,
      units: plan.kind === 'turtle' ? plan.size : 1,
      diveOffset: Math.random() * 8,
    })
  }
  return riders
}

function emptyLane(kind: LaneKind): Lane {
  return { kind, dir: 0, speed: 0, vehicles: [], riders: [], divePeriod: 0 }
}

function makeLanes(cols: number, level: number): Lane[] {
  const scale = speedScale(level)
  const lanes: Lane[] = []
  for (let y = 0; y < ROWS; y++) lanes.push(emptyLane('safe'))

  lanes[HOME_ROW] = emptyLane('home')
  lanes[MEDIAN_ROW] = emptyLane('safe')
  lanes[START_ROW] = emptyLane('safe')

  ROAD_ROWS.forEach((row, i) => {
    const plan = ROAD_PLAN[i]
    const extra = level >= 4 && plan.count < 3 ? 1 : 0
    lanes[row] = {
      kind: 'road',
      dir: plan.dir,
      speed: plan.speed * scale,
      vehicles: spawnVehicles(cols, plan, plan.count + extra),
      riders: [],
      divePeriod: 0,
    }
  })

  RIVER_ROWS.forEach((row, i) => {
    // RIVER_PLAN reads bottom-up; RIVER_ROWS reads top-down.
    const plan = RIVER_PLAN[RIVER_PLAN.length - 1 - i]
    lanes[row] = {
      kind: 'river',
      dir: plan.dir,
      speed: plan.speed * scale,
      vehicles: [],
      riders: spawnRiders(cols, plan),
      divePeriod: level >= plan.divesFrom ? 6.5 : 0,
    }
  })

  return lanes
}

function makeBays(): Bay[] {
  return BAY_COLS.map((col) => ({ col, filled: false, fly: false }))
}

function timeLimitFor(level: number) {
  return Math.max(32, 48 - level * 2)
}

function startCell(cols: number) {
  return { px: Math.floor(cols / 2), py: START_ROW }
}

export function createInitialState(cols = COLS, rows = ROWS): GameState {
  const start = startCell(cols)
  const limit = timeLimitFor(0)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    lives: START_LIVES,
    level: 0,
    cols,
    rows,
    px: start.px,
    py: start.py,
    hopCooldown: 0,
    invuln: 0,
    flash: 0,
    hopPulse: 0,
    bump: 0,
    farthest: start.py,
    clock: 0,
    timeLeft: limit,
    timeLimit: limit,
    lanes: makeLanes(cols, 0),
    bays: makeBays(),
    splash: null,
    flyTimer: 6 + Math.random() * 5,
    toast: null,
  }
}

export function startGame(prev: GameState): GameState {
  const next = createInitialState(prev.cols, prev.rows)
  return {
    ...next,
    best: Math.max(prev.best, loadBest()),
    phase: 'playing',
    invuln: 0.5,
  }
}

/** Send the frog back to the bank without touching lives or traffic. */
function respawn(state: GameState, invuln: number): GameState {
  const start = startCell(state.cols)
  return {
    ...state,
    px: start.px,
    py: start.py,
    farthest: start.py,
    hopCooldown: HOP_COOLDOWN,
    invuln,
    timeLeft: state.timeLimit,
  }
}

function levelUp(state: GameState): GameState {
  sfx('wave')
  const level = state.level + 1
  const limit = timeLimitFor(level)
  const bonus = SCORE_LEVEL + state.level * 100
  return {
    ...respawn(
      {
        ...state,
        score: state.score + bonus,
        level,
        lives: Math.min(MAX_LIVES, state.lives + 1),
        lanes: makeLanes(state.cols, level),
        bays: makeBays(),
        timeLimit: limit,
        flyTimer: 6 + Math.random() * 5,
        flash: 0.2,
        toast: { text: `Level ${level + 1} · +${bonus}`, t: 1.8 },
      },
      0.7,
    ),
  }
}

function fillBay(state: GameState, index: number): GameState {
  const bay = state.bays[index]
  const seconds = Math.max(0, Math.floor(state.timeLeft))
  const timeBonus = seconds * SCORE_PER_SECOND
  const flyBonus = bay.fly ? SCORE_FLY : 0
  sfx(bay.fly ? 'perfect' : 'good')

  const bays = state.bays.map((b, i) => (i === index ? { ...b, filled: true, fly: false } : b))
  const filled = bays.filter((b) => b.filled).length
  const next: GameState = {
    ...state,
    score: state.score + SCORE_BAY + timeBonus + flyBonus,
    bays,
    hopPulse: 0.2,
    flash: 0.14,
    toast: flyBonus
      ? { text: `Fly! +${SCORE_BAY + timeBonus + flyBonus}`, t: 1.4 }
      : { text: `+${SCORE_BAY + timeBonus}`, t: 1 },
  }

  if (filled >= bays.length) return levelUp(next)
  return respawn(next, 0.55)
}

function die(state: GameState, kind: DeathKind): GameState {
  sfx(kind === 'water' ? 'miss' : 'hurt')
  const splash: Splash = { x: state.px, y: state.py, kind, t: 0.5 }
  const lives = state.lives - 1
  if (lives <= 0) {
    sfx('die')
    return {
      ...state,
      phase: 'gameover',
      lives: 0,
      best: Math.max(state.best, state.score),
      flash: 0.35,
      invuln: 0,
      splash,
    }
  }
  return {
    ...respawn({ ...state, lives, flash: 0.28, hopPulse: 0, splash }, RESPAWN_INVULN),
  }
}

/** 0 = fully surfaced, 1 = fully under. Turtles fade out before they vanish. */
export function turtleSink(lane: Lane, rider: Rider, clock: number) {
  if (lane.divePeriod <= 0 || rider.kind !== 'turtle') return 0
  const p = ((clock + rider.diveOffset) % lane.divePeriod) / lane.divePeriod
  if (p < 0.6) return 0
  if (p < 0.72) return (p - 0.6) / 0.12
  if (p < 0.86) return 1
  return Math.max(0, 1 - (p - 0.86) / 0.14)
}

function riderUnder(lane: Lane, px: number, clock: number): Rider | null {
  const cx = px + 0.5
  for (const rider of lane.riders) {
    if (cx < rider.x || cx > rider.x + rider.w) continue
    if (turtleSink(lane, rider, clock) >= 1) return null
    return rider
  }
  return null
}

function overlaps(px: number, vehicle: Vehicle) {
  const left = px + 0.22
  const right = px + 0.78
  return right > vehicle.x && left < vehicle.x + vehicle.w
}

export function bayIndexAt(state: GameState, px: number) {
  for (let i = 0; i < state.bays.length; i++) {
    if (Math.abs(px - state.bays[i].col) <= BAY_TOLERANCE) return i
  }
  return -1
}

function enterHome(state: GameState): GameState {
  const index = bayIndexAt(state, state.px)
  if (index < 0 || state.bays[index].filled) {
    // A bounce off the hedge shouldn't cost a turn — you're on a moving log.
    return { ...state, bump: 0.18 }
  }
  return fillBay(state, index)
}

export function hop(state: GameState, dir: Dir): GameState {
  if (state.phase !== 'playing') return state
  if (state.hopCooldown > 0) return state

  if (dir === 'up' && state.py === RIVER_ROWS[0]) return enterHome(state)

  let nx = state.px
  let ny = state.py
  if (dir === 'up') ny -= 1
  if (dir === 'down') ny += 1
  if (dir === 'left') nx -= 1
  if (dir === 'right') nx += 1

  if (ny < RIVER_ROWS[0] || ny > START_ROW) return state
  if (nx < -0.3 || nx > state.cols - 0.7) return state
  // Solid ground realigns the frog; only the river lets it drift off-grid.
  if (state.lanes[ny]?.kind !== 'river') {
    nx = Math.max(0, Math.min(state.cols - 1, Math.round(nx)))
  }

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

  const lane = moved.lanes[ny]
  if (lane?.kind === 'river' && !riderUnder(lane, moved.px, moved.clock)) {
    return die(moved, 'water')
  }
  if (lane?.kind === 'road') {
    for (const v of lane.vehicles) {
      if (overlaps(moved.px, v)) return die(moved, 'car')
    }
  }
  return moved
}

function advanceLanes(lanes: Lane[], cols: number, dt: number): Lane[] {
  const span = wrapSpan(cols)
  return lanes.map((lane) => {
    if (lane.dir === 0 || lane.speed === 0) return lane
    const step = lane.dir * lane.speed * dt
    const shift = (x: number, w: number) => {
      let next = x + step
      if (next > cols + 2) next -= span
      if (next + w < -2) next += span
      return next
    }
    if (lane.kind === 'road') {
      return { ...lane, vehicles: lane.vehicles.map((v) => ({ ...v, x: shift(v.x, v.w) })) }
    }
    return { ...lane, riders: lane.riders.map((r) => ({ ...r, x: shift(r.x, r.w) })) }
  })
}

function tickFly(state: GameState, dt: number): GameState {
  const open = state.bays.filter((b) => !b.filled)
  if (!open.length) return state
  const showing = state.bays.some((b) => b.fly)
  const flyTimer = state.flyTimer - dt
  if (flyTimer > 0) return { ...state, flyTimer }

  if (showing) {
    return {
      ...state,
      bays: state.bays.map((b) => ({ ...b, fly: false })),
      flyTimer: 8 + Math.random() * 7,
    }
  }
  const pick = open[Math.floor(Math.random() * open.length)]
  return {
    ...state,
    bays: state.bays.map((b) => ({ ...b, fly: b.col === pick.col })),
    flyTimer: 5 + Math.random() * 3,
  }
}

export function tick(state: GameState, dt: number): GameState {
  let s: GameState = {
    ...state,
    clock: state.clock + dt,
    hopCooldown: Math.max(0, state.hopCooldown - dt),
    invuln: Math.max(0, state.invuln - dt),
    flash: Math.max(0, state.flash - dt),
    hopPulse: Math.max(0, state.hopPulse - dt),
    bump: Math.max(0, state.bump - dt),
    lanes: advanceLanes(state.lanes, state.cols, dt),
    splash: state.splash && state.splash.t > dt ? { ...state.splash, t: state.splash.t - dt } : null,
    toast: state.toast && state.toast.t > dt ? { ...state.toast, t: state.toast.t - dt } : null,
  }

  if (s.phase !== 'playing') return s

  s = tickFly(s, dt)

  const lane = s.lanes[s.py]
  if (lane?.kind === 'river') {
    const rider = riderUnder(lane, s.px, s.clock)
    if (!rider) {
      if (s.invuln > 0) return s
      return die(s, 'water')
    }
    // The bank stops the frog rather than killing it; the log slides on and
    // leaves you treading water, which gives a beat to hop off instead.
    const drift = s.px + lane.dir * lane.speed * dt
    s = { ...s, px: Math.max(0, Math.min(s.cols - 1, drift)) }
  }

  s = { ...s, timeLeft: Math.max(0, s.timeLeft - dt) }
  if (s.timeLeft <= 0 && s.invuln <= 0) return die(s, 'time')

  if (s.invuln > 0) return s

  if (lane?.kind === 'road') {
    for (const v of lane.vehicles) {
      if (overlaps(s.px, v)) return die(s, 'car')
    }
  }
  return s
}

export function toSnapshot(s: GameState): Snapshot {
  const bays = s.bays.map((b) => b.filled)
  const homes = bays.filter(Boolean).length
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    lives: s.lives,
    level: s.level,
    homes,
    homesTotal: s.level * bays.length + homes,
    bays,
    timeFrac: s.timeLimit > 0 ? s.timeLeft / s.timeLimit : 0,
    timeLow: s.timeLeft <= 8,
  }
}
