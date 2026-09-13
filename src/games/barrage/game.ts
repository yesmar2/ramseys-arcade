import { sfx } from '../../lib/sound'

/**
 * Barrage — rows of ships, one cannon, hold the line.
 *
 * The twist the name asks for: the fleet does not drip random shots. It gathers
 * a volley, lights up the ships that are about to fire, and then looses the lot
 * at once. The charge is the whole game — you read which columns are hot, move
 * to a cold one, and spend the quiet window pushing damage back.
 *
 * Coordinates are in stage-width units: x runs 0..1, y runs 0..FIELD_H. Both
 * axes scale off width so speeds and sizes stay isotropic at any size.
 */

export const STAGE_W = 3
export const STAGE_H = 4
/** Height of the playfield in width units — the stage aspect, unrolled. */
export const FIELD_H = STAGE_H / STAGE_W

export type Phase = 'menu' | 'playing' | 'dying' | 'clearing' | 'gameover'

export type Ship = {
  /** Column and row in the formation, fixed for the life of the ship. */
  col: number
  row: number
  alive: boolean
  /** 0–1 charge glow while this ship is winding up to fire. */
  charge: number
  /** Counts down a death flash before the ship is cleared away. */
  pop: number
}

export type Shot = {
  x: number
  y: number
  vx: number
  vy: number
  /** Enemy shots are fatter and slower; the player's are thin and quick. */
  hostile: boolean
}

export type Bunker = {
  x: number
  y: number
  /** Cell grid, row-major. False once shot away. */
  cells: boolean[]
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  lives: number
  wave: number
  /** Left edge of the leftmost column. */
  formX: number
  /** Top edge of the top row. */
  formY: number
  /** +1 marching right, -1 left. */
  formDir: number
  ships: Ship[]
  shots: Shot[]
  bunkers: Bunker[]
  cannonX: number
  /** -1, 0 or +1 from the current input. */
  moveDir: number
  firing: boolean
  /**
   * A tap that began and ended inside one frame. Held fire is sampled in the
   * tick, but a quick press/release would never be seen without this.
   */
  fireQueued: boolean
  fireCooldown: number
  /** Seconds until the next volley starts charging. */
  volleyIn: number
  /** Seconds left in the current charge, 0 when not charging. */
  chargeLeft: number
  /** Columns lit up for the volley being charged. */
  hotCols: number[]
  /** Horizontal drift applied to the volley's shots, for angled curtains. */
  volleySpread: number
  /** Counts down the death pause, then respawns. */
  dyingFor: number
  /** Counts down the wave-clear pause. */
  clearingFor: number
  /** 0–1 flash when the cannon is hit. */
  hitFlash: number
  /** Ships killed this wave without being hit — drives the clean-wave bonus. */
  cleanWave: boolean
  shotsFired: number
  shotsHit: number
  time: number
}

export type Snapshot = {
  phase: Phase
  score: number
  lives: number
  wave: number
  shipsLeft: number
  /** Percentage of shots that found a hull, for the end-of-run card. */
  accuracy: number
}

export const COLS = 6
export const ROWS = 5
const SHIP_W = 0.082
const SHIP_H = 0.055
const COL_STEP = 0.115
const ROW_STEP = 0.082
const FORM_W = (COLS - 1) * COL_STEP + SHIP_W
const MARGIN = 0.035
/**
 * Ships reaching this line end the run outright — that is the line you hold. It
 * sits just above the bunkers, so cover is for stopping shots, never ships.
 */
export const HOLD_LINE = FIELD_H - 0.28

const CANNON_W = 0.085
const CANNON_H = 0.05
const CANNON_Y = FIELD_H - 0.075
const CANNON_SPEED = 0.72

const PLAYER_SHOT_SPEED = 1.5
const PLAYER_SHOT_W = 0.007
const PLAYER_SHOT_H = 0.032
const MAX_PLAYER_SHOTS = 3
const FIRE_COOLDOWN = 0.28

const ENEMY_SHOT_W = 0.013
const ENEMY_SHOT_H = 0.034

const BUNKER_COUNT = 4
export const BUNKER_COLS = 7
const BUNKER_ROWS = 4
export const BUNKER_W = 0.135
const BUNKER_H = 0.062
const BUNKER_Y = FIELD_H - 0.235

/**
 * How far the fleet gains on each turn. The run to the line is the backstop for
 * playing too slowly, not the main threat — that is what the volleys are for —
 * so this is gentle enough to leave a wave winnable on skill.
 */
const DROP_PER_TURN = 0.03

const DEATH_PAUSE = 1.1
const CLEAR_PAUSE = 1.3
const RESPAWN_FLASH = 0.9

const SCORE_ROW = [40, 30, 20, 15, 10] as const
const SCORE_WAVE_CLEAR = 250
const SCORE_CLEAN_WAVE = 500

// ------------------------------------------------------------------- tuning

/** How fast the formation steps sideways, in units per second. */
function marchSpeed(wave: number, shipsLeft: number): number {
  const base = 0.09 + Math.min(0.15, (wave - 1) * 0.02)
  // The classic acceleration: the fewer left, the faster they come.
  const thinning = 1 + (1 - shipsLeft / (COLS * ROWS)) * 2.2
  return base * thinning
}

/** Seconds of warning before a volley fires. Shrinking this is the real ramp. */
function chargeTime(wave: number): number {
  return Math.max(0.62, 1.25 - (wave - 1) * 0.07)
}

/** Quiet seconds between volleys — the window you push damage in. */
function volleyGap(wave: number): number {
  return Math.max(1.1, 2.6 - (wave - 1) * 0.14)
}

/**
 * How many columns open up at once. Two from the off, or the first wave would
 * not be a barrage at all; never every column, so there is always a cold lane.
 */
function volleyWidth(wave: number): number {
  return Math.min(COLS - 1, 2 + Math.floor((wave - 1) / 2))
}

function enemyShotSpeed(wave: number): number {
  return 0.44 + Math.min(0.3, (wave - 1) * 0.035)
}

// ------------------------------------------------------------------ helpers

export function shipX(state: GameState, ship: Ship): number {
  return state.formX + ship.col * COL_STEP
}

export function shipY(state: GameState, ship: Ship): number {
  return state.formY + ship.row * ROW_STEP
}

export function shipSize() {
  return { w: SHIP_W, h: SHIP_H }
}

export function cannonRect(state: GameState) {
  return { x: state.cannonX - CANNON_W / 2, y: CANNON_Y, w: CANNON_W, h: CANNON_H }
}

export function bunkerCellSize() {
  return { w: BUNKER_W / BUNKER_COLS, h: BUNKER_H / BUNKER_ROWS }
}

export function shotSize(hostile: boolean) {
  return hostile
    ? { w: ENEMY_SHOT_W, h: ENEMY_SHOT_H }
    : { w: PLAYER_SHOT_W, h: PLAYER_SHOT_H }
}

function aliveShips(state: GameState): Ship[] {
  return state.ships.filter((s) => s.alive)
}

function makeShips(): Ship[] {
  const ships: Ship[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ships.push({ col, row, alive: true, charge: 0, pop: 0 })
    }
  }
  return ships
}

function makeBunkers(): Bunker[] {
  const bunkers: Bunker[] = []
  const span = 1 / BUNKER_COUNT
  for (let i = 0; i < BUNKER_COUNT; i++) {
    const cells: boolean[] = []
    for (let r = 0; r < BUNKER_ROWS; r++) {
      for (let c = 0; c < BUNKER_COLS; c++) {
        // Notch the underside out so it reads as a shield, not a brick.
        const underArch = r >= BUNKER_ROWS - 2 && c >= 2 && c <= BUNKER_COLS - 3
        cells.push(!underArch)
      }
    }
    bunkers.push({ x: span * (i + 0.5) - BUNKER_W / 2, y: BUNKER_Y, cells })
  }
  return bunkers
}

/** Row the formation starts at — later waves get a head start down the board. */
function startFormY(wave: number): number {
  return 0.1 + Math.min(0.26, (wave - 1) * 0.032)
}

function resetWave(state: GameState, wave: number) {
  state.wave = wave
  state.ships = makeShips()
  state.shots = []
  state.formX = (1 - FORM_W) / 2
  state.formY = startFormY(wave)
  state.formDir = 1
  state.volleyIn = volleyGap(wave) * 0.8
  state.chargeLeft = 0
  state.hotCols = []
  state.volleySpread = 0
  state.cleanWave = true
}

function resetCannon(state: GameState) {
  state.cannonX = 0.5
  state.moveDir = 0
  state.firing = false
  state.fireQueued = false
  state.fireCooldown = 0
  state.shots = []
}

export function createInitialState(): GameState {
  const state: GameState = {
    phase: 'menu',
    score: 0,
    best: 0,
    lives: 3,
    wave: 1,
    formX: 0,
    formY: 0,
    formDir: 1,
    ships: [],
    shots: [],
    bunkers: makeBunkers(),
    cannonX: 0.5,
    moveDir: 0,
    firing: false,
    fireQueued: false,
    fireCooldown: 0,
    volleyIn: 0,
    chargeLeft: 0,
    hotCols: [],
    volleySpread: 0,
    dyingFor: 0,
    clearingFor: 0,
    hitFlash: 0,
    cleanWave: true,
    shotsFired: 0,
    shotsHit: 0,
    time: 0,
  }
  resetWave(state, 1)
  return state
}

export function startGame(prev: GameState): GameState {
  const state = createInitialState()
  state.phase = 'playing'
  state.best = prev.best
  return state
}

/** Admin/testing: jump straight to a wave without banking its bonuses. */
export function jumpToWave(prev: GameState, wave: number): GameState {
  if (prev.phase === 'menu' || prev.phase === 'gameover') return prev
  const state: GameState = { ...prev, ships: [...prev.ships], shots: [] }
  resetWave(state, Math.max(1, Math.floor(wave) || 1))
  state.bunkers = makeBunkers()
  resetCannon(state)
  state.phase = 'playing'
  return state
}

// ------------------------------------------------------------------- volleys

/**
 * Pick the columns that will fire, and how far the curtain leans. Only columns
 * that still have a ship in them can go hot, so the tell is never a bluff.
 */
function beginCharge(state: GameState) {
  const live = aliveShips(state)
  if (live.length === 0) return

  const cols = [...new Set(live.map((s) => s.col))]
  const want = Math.min(cols.length, volleyWidth(state.wave))

  // Shuffle, then take — every hot column is a real threat and a real gap.
  for (let i = cols.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cols[i], cols[j]] = [cols[j], cols[i]]
  }
  state.hotCols = cols.slice(0, want).sort((a, b) => a - b)

  // From wave 3 the curtain can lean, so a cold column is not automatically safe.
  const lean = state.wave >= 3 ? 0.16 + Math.min(0.16, (state.wave - 3) * 0.03) : 0
  state.volleySpread = lean === 0 ? 0 : (Math.random() * 2 - 1) * lean

  state.chargeLeft = chargeTime(state.wave)
  sfx('wave')
}

/** The bottom ship of a column is the one that actually shoots. */
function frontShipOfColumn(state: GameState, col: number): Ship | null {
  let best: Ship | null = null
  for (const s of state.ships) {
    if (!s.alive || s.col !== col) continue
    if (!best || s.row > best.row) best = s
  }
  return best
}

function fireVolley(state: GameState) {
  const speed = enemyShotSpeed(state.wave)
  let fired = 0
  for (const col of state.hotCols) {
    const ship = frontShipOfColumn(state, col)
    if (!ship) continue
    state.shots.push({
      x: shipX(state, ship) + SHIP_W / 2,
      y: shipY(state, ship) + SHIP_H,
      vx: state.volleySpread * speed,
      vy: speed,
      hostile: true,
    })
    fired += 1
  }
  for (const s of state.ships) s.charge = 0
  state.hotCols = []
  state.chargeLeft = 0
  state.volleyIn = volleyGap(state.wave)
  if (fired > 0) sfx('boom')
}

// -------------------------------------------------------------------- inputs

export function setMove(state: GameState, dir: number): GameState {
  return { ...state, moveDir: Math.max(-1, Math.min(1, dir)) }
}

export function setFiring(state: GameState, firing: boolean): GameState {
  // Latch the press so a tap shorter than a frame still gets its shot.
  return { ...state, firing, fireQueued: state.fireQueued || firing }
}

function tryFire(state: GameState) {
  if (state.fireCooldown > 0) return
  if (state.shots.filter((s) => !s.hostile).length >= MAX_PLAYER_SHOTS) return
  state.shots.push({
    x: state.cannonX,
    y: CANNON_Y - PLAYER_SHOT_H,
    vx: 0,
    vy: -PLAYER_SHOT_SPEED,
    hostile: false,
  })
  state.fireCooldown = FIRE_COOLDOWN
  state.shotsFired += 1
  sfx('fire')
}

// ----------------------------------------------------------------- collision

function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

/** Chip a hole in whichever bunker the shot met. Returns true if it was stopped. */
function hitBunkers(state: GameState, shot: Shot): boolean {
  const size = shotSize(shot.hostile)
  const cell = bunkerCellSize()
  const sx = shot.x - size.w / 2
  const sy = shot.y

  for (const bunker of state.bunkers) {
    if (!overlaps(sx, sy, size.w, size.h, bunker.x, bunker.y, BUNKER_W, BUNKER_H)) continue

    // Eat the first intact cell the shot touches, plus its immediate neighbours,
    // so cover crumbles into a ragged hole instead of a neat pinprick.
    for (let r = 0; r < BUNKER_ROWS; r++) {
      // Hostile shots eat downward, the player's eat upward.
      const row = shot.hostile ? r : BUNKER_ROWS - 1 - r
      for (let c = 0; c < BUNKER_COLS; c++) {
        const i = row * BUNKER_COLS + c
        if (!bunker.cells[i]) continue
        const cx = bunker.x + c * cell.w
        const cy = bunker.y + row * cell.h
        if (!overlaps(sx, sy, size.w, size.h, cx, cy, cell.w, cell.h)) continue

        bunker.cells[i] = false
        // A hostile round blows a ragged hole; your own thin shot only nicks
        // the roof, so clearing a lane through your cover stays a choice.
        const splash = shot.hostile
          ? ([
              [-1, 0],
              [1, 0],
              [0, 1],
            ] as const)
          : ([[0, -1]] as const)
        for (const [dc, dr] of splash) {
          const nc = c + dc
          const nr = row + dr
          if (nc < 0 || nc >= BUNKER_COLS || nr < 0 || nr >= BUNKER_ROWS) continue
          bunker.cells[nr * BUNKER_COLS + nc] = false
        }
        sfx('chop')
        return true
      }
    }
  }
  return false
}

function killShip(state: GameState, ship: Ship) {
  ship.alive = false
  ship.pop = 0.32
  state.score += SCORE_ROW[Math.min(ship.row, SCORE_ROW.length - 1)]
  state.shotsHit += 1
  sfx('hit')
}

function loseLife(state: GameState) {
  state.lives -= 1
  state.cleanWave = false
  state.hitFlash = 1
  state.phase = 'dying'
  state.dyingFor = DEATH_PAUSE
  state.shots = []
  state.chargeLeft = 0
  state.hotCols = []
  for (const s of state.ships) s.charge = 0
  sfx(state.lives > 0 ? 'hurt' : 'die')
}

/** Ships on the line end the run outright, however many lives are left. */
function endRun(state: GameState) {
  state.phase = 'gameover'
  state.lives = 0
  state.shots = []
  state.best = Math.max(state.best, state.score)
  sfx('die')
}

// ---------------------------------------------------------------------- tick

function advanceFormation(state: GameState, dt: number) {
  const live = aliveShips(state)
  if (live.length === 0) return

  const minCol = Math.min(...live.map((s) => s.col))
  const maxCol = Math.max(...live.map((s) => s.col))
  const leftEdge = state.formX + minCol * COL_STEP
  const rightEdge = state.formX + maxCol * COL_STEP + SHIP_W

  const step = marchSpeed(state.wave, live.length) * dt * state.formDir
  const nextLeft = leftEdge + step
  const nextRight = rightEdge + step

  if (nextLeft < MARGIN || nextRight > 1 - MARGIN) {
    // Turn and drop — the pressure that eventually reaches the line.
    state.formDir *= -1
    state.formY += DROP_PER_TURN
    sfx('tap')
    return
  }
  state.formX += step
}

function advanceShots(state: GameState, dt: number) {
  const ships = aliveShips(state)
  const cannon = cannonRect(state)
  const survivors: Shot[] = []

  for (const shot of state.shots) {
    shot.x += shot.vx * dt
    shot.y += shot.vy * dt
    const size = shotSize(shot.hostile)
    const left = shot.x - size.w / 2

    if (shot.y < -size.h || shot.y > FIELD_H + size.h) continue
    if (left < -size.w || left > 1 + size.w) continue
    if (hitBunkers(state, shot)) continue

    if (shot.hostile) {
      if (overlaps(left, shot.y, size.w, size.h, cannon.x, cannon.y, cannon.w, cannon.h)) {
        loseLife(state)
        return
      }
      survivors.push(shot)
      continue
    }

    let consumed = false
    for (const ship of ships) {
      const sx = shipX(state, ship)
      const sy = shipY(state, ship)
      if (!overlaps(left, shot.y, size.w, size.h, sx, sy, SHIP_W, SHIP_H)) continue
      killShip(state, ship)
      consumed = true
      break
    }
    if (!consumed) survivors.push(shot)
  }

  state.shots = survivors
}

export function tick(prev: GameState, dt: number): GameState {
  const state: GameState = {
    ...prev,
    ships: prev.ships.map((s) => ({ ...s })),
    shots: prev.shots.map((s) => ({ ...s })),
    bunkers: prev.bunkers.map((b) => ({ ...b, cells: [...b.cells] })),
    hotCols: [...prev.hotCols],
  }
  state.time += dt
  state.hitFlash = Math.max(0, state.hitFlash - dt * 1.4)
  for (const s of state.ships) if (s.pop > 0) s.pop = Math.max(0, s.pop - dt)

  if (state.phase === 'menu' || state.phase === 'gameover') return state

  if (state.phase === 'dying') {
    state.dyingFor -= dt
    if (state.dyingFor > 0) return state
    if (state.lives <= 0) {
      state.phase = 'gameover'
      state.best = Math.max(state.best, state.score)
      return state
    }
    resetCannon(state)
    state.phase = 'playing'
    state.volleyIn = Math.max(state.volleyIn, RESPAWN_FLASH)
    return state
  }

  if (state.phase === 'clearing') {
    state.clearingFor -= dt
    if (state.clearingFor > 0) return state
    resetWave(state, state.wave + 1)
    // Cover comes back between waves, or a long run is decided by wave three.
    state.bunkers = makeBunkers()
    resetCannon(state)
    state.phase = 'playing'
    return state
  }

  // Cannon.
  state.cannonX = Math.max(
    CANNON_W / 2 + 0.01,
    Math.min(1 - CANNON_W / 2 - 0.01, state.cannonX + state.moveDir * CANNON_SPEED * dt),
  )
  state.fireCooldown = Math.max(0, state.fireCooldown - dt)
  if (state.firing || state.fireQueued) tryFire(state)
  state.fireQueued = false

  advanceFormation(state, dt)

  // Volley cycle: wait, light up, loose.
  if (state.chargeLeft > 0) {
    state.chargeLeft -= dt
    const total = chargeTime(state.wave)
    const progress = 1 - Math.max(0, state.chargeLeft) / total
    for (const s of state.ships) {
      s.charge = s.alive && state.hotCols.includes(s.col) ? progress : 0
    }
    if (state.chargeLeft <= 0) fireVolley(state)
  } else {
    state.volleyIn -= dt
    if (state.volleyIn <= 0) beginCharge(state)
  }

  advanceShots(state, dt)
  if (state.phase !== 'playing') return state

  // Did anything reach the line?
  const live = aliveShips(state)
  for (const ship of live) {
    if (shipY(state, ship) + SHIP_H >= HOLD_LINE) {
      endRun(state)
      return state
    }
  }

  if (live.length === 0) {
    state.score += SCORE_WAVE_CLEAR
    if (state.cleanWave) state.score += SCORE_CLEAN_WAVE
    state.phase = 'clearing'
    state.clearingFor = CLEAR_PAUSE
    state.shots = []
    sfx('good')
  }

  return state
}

export function toSnapshot(state: GameState): Snapshot {
  return {
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    wave: state.wave,
    shipsLeft: state.ships.filter((s) => s.alive).length,
    accuracy:
      state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0,
  }
}
