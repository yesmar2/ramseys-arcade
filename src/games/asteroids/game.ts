import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Phase = 'menu' | 'playing' | 'waveClear' | 'gameover'

export type Point = { x: number; y: number }

export type RockSize = 'large' | 'medium' | 'small'

export type PowerKind = 'rapid' | 'spread' | 'shield' | 'slow' | 'life'

export type SaucerSize = 'large' | 'small'

export type Saucer = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: SaucerSize
  radius: number
  fireCooldown: number
}

export type EnemyBullet = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export type Powerup = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  kind: PowerKind
  life: number
  radius: number
}

export type Rock = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  size: RockSize
  radius: number
  verts: Point[]
  hue: number
  sat: number
}

export type Bullet = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export type Floater = {
  x: number
  y: number
  text: string
  life: number
  maxLife: number
}

export type Particle = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  hue: number
}

export type Ship = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  thrusting: boolean
  invuln: number
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  lives: number
  wave: number
  rocks: number
  time: number
  lastWave: number
  lastWaveTime: number
  timeBonus: number
  combo: number
  comboBest: number
  /** Peak combo across the whole run (survives wave transitions). */
  runComboBest: number
  buffRapid: boolean
  buffSpread: boolean
  buffShield: boolean
  buffSlow: boolean
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  lives: number
  wave: number
  waveElapsed: number
  ship: Ship
  rocks: Rock[]
  bullets: Bullet[]
  enemyBullets: EnemyBullet[]
  saucer: Saucer | null
  /** Seconds until the next saucer may spawn (wave 3+). */
  saucerCooldown: number
  particles: Particle[]
  powerups: Powerup[]
  turnLeft: boolean
  turnRight: boolean
  /** -1 left … 1 right. Used when analog stick is active. */
  turn: number
  thrust: boolean
  /** Held down / S — triggers hyperspace on press edge. */
  reverse: boolean
  hyperspaceCooldown: number
  hyperspaceLatch: boolean
  fireHeld: boolean
  fireCooldown: number
  stageW: number
  stageH: number
  scale: number
  flash: number
  wavePause: number
  timeBonus: number
  lastWave: number
  lastWaveTime: number
  combo: number
  comboTimer: number
  comboBest: number
  lastComboBest: number
  /** Peak combo for the current run (not reset between waves). */
  runComboBest: number
  floaters: Floater[]
  buffRapid: number
  buffSpread: number
  buffShield: number
  buffSlow: number
}

export const DESIGN_LONG = 960
export const DESIGN_SHORT = 540
export const DESIGN_W = DESIGN_LONG
export const DESIGN_H = DESIGN_SHORT

/** Same 16×9 field, rotated so the long side matches the screen. */
export function asteroidsLayout(portrait: boolean) {
  return portrait
    ? { aspectW: 9, aspectH: 16 }
    : { aspectW: 16, aspectH: 9 }
}

function designScale(w: number, h: number) {
  const portrait = h > w
  const dw = portrait ? DESIGN_SHORT : DESIGN_LONG
  const dh = portrait ? DESIGN_LONG : DESIGN_SHORT
  return Math.min(w / dw, h / dh) || 1
}

const MAX_BULLETS = 6
const FIRE_COOLDOWN = 0.22
const TURN_SPEED = 5.9
const THRUST = 420
const DRAG = 0.988
const MAX_SPEED = 560
const BULLET_SPEED = 480
const BULLET_LIFE = 0.55
const SHIP_RADIUS = 22
const START_LIVES = 3
const COMBO_WINDOW = 0.75
const POWER_LIFE = 8
const BUFF_DURATION = 8
const HYPERSPACE_COOLDOWN = 2.6

/** Weighted drop table — life is ~3% of powerups; others share the rest. */
const POWER_WEIGHTS: { kind: PowerKind; weight: number }[] = [
  { kind: 'rapid', weight: 0.2425 },
  { kind: 'spread', weight: 0.2425 },
  { kind: 'shield', weight: 0.2425 },
  { kind: 'slow', weight: 0.2425 },
  { kind: 'life', weight: 0.03 },
]

export const POWER_LABEL: Record<PowerKind, string> = {
  rapid: 'Rapid',
  spread: 'Spread',
  shield: 'Shield',
  slow: 'Slow',
  life: 'Life',
}

export const POWER_HUE: Record<PowerKind, number> = {
  rapid: 38,
  spread: 272,
  shield: 172,
  slow: 198,
  life: 42,
}

function pickPowerKind(): PowerKind {
  const roll = Math.random()
  let acc = 0
  for (const entry of POWER_WEIGHTS) {
    acc += entry.weight
    if (roll < acc) return entry.kind
  }
  return 'rapid'
}

function comboMultiplier(combo: number) {
  return Math.min(2, 1 + Math.max(0, combo - 1) * 0.25)
}

/** Par time for a wave — beat it for a time bonus. Does not fail the run. */
function waveParFor(wave: number) {
  return Math.max(28, 48 - (wave - 1) * 2)
}

/** Rock speed: +10%/wave early, steeper after wave 5. */
function waveSpeedScale(wave: number) {
  if (wave <= 5) return 1 + (wave - 1) * 0.1
  return 1 + 4 * 0.1 + (wave - 5) * 0.2
}

const SAUCER_START_WAVE = 3
const SAUCER_SCORE: Record<SaucerSize, number> = {
  large: 200,
  small: 1000,
}
const ENEMY_BULLET_LIFE = 1.15

const ROCK_RADIUS: Record<RockSize, number> = {
  large: 42,
  medium: 24,
  small: 12,
}

const ROCK_SCORE: Record<RockSize, number> = {
  large: 20,
  medium: 50,
  small: 100,
}

let nextId = 1
function uid() {
  return nextId++
}

function loadBest() {
  return getPersonalBest('asteroids')
}

function saveBest(_score: number) {}

function wrap(v: number, max: number) {
  if (max <= 0) return 0
  return ((v % max) + max) % max
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by)
}

const ROCK_HUES = [198, 172, 38, 348, 272, 18, 128]

function pickRockColor() {
  const hue = ROCK_HUES[Math.floor(Math.random() * ROCK_HUES.length)] + (Math.random() - 0.5) * 18
  const sat = 48 + Math.random() * 22
  return { hue, sat }
}

function rockVerts(radius: number): Point[] {
  const n = 7 + Math.floor(Math.random() * 4)
  const pts: Point[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = radius * (0.72 + Math.random() * 0.28)
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
  }
  return pts
}

function makeRock(
  x: number,
  y: number,
  size: RockSize,
  speedScale = 1,
  worldScale = 1,
  color?: { hue: number; sat: number },
): Rock {
  const radius = ROCK_RADIUS[size] * worldScale
  const speed =
    (size === 'large' ? 35 : size === 'medium' ? 55 : 80) *
    speedScale *
    worldScale *
    (0.75 + Math.random() * 0.5)
  const ang = Math.random() * Math.PI * 2
  const tint = color ?? pickRockColor()
  return {
    id: uid(),
    x,
    y,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.8,
    size,
    radius,
    verts: rockVerts(radius),
    hue: tint.hue,
    sat: tint.sat,
  }
}

function spawnAwayFromShip(
  w: number,
  h: number,
  ship: Ship,
  size: RockSize,
  speedScale: number,
  worldScale: number,
): Rock {
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    if (dist(x, y, ship.x, ship.y) > Math.min(w, h) * 0.28) {
      return makeRock(x, y, size, speedScale, worldScale)
    }
  }
  return makeRock(w * 0.1, h * 0.1, size, speedScale, worldScale)
}

function makeShip(w: number, h: number): Ship {
  return {
    x: w / 2,
    y: h / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    thrusting: false,
    invuln: 2,
  }
}

function spawnWave(state: GameState, wave: number): Rock[] {
  const count = Math.min(4 + wave, 12)
  const speedScale = waveSpeedScale(wave)
  const rocks: Rock[] = []
  for (let i = 0; i < count; i++) {
    rocks.push(
      spawnAwayFromShip(
        state.stageW,
        state.stageH,
        state.ship,
        'large',
        speedScale,
        state.scale,
      ),
    )
  }
  return rocks
}

function firstSaucerCooldown(wave: number) {
  if (wave < SAUCER_START_WAVE) return 999
  return Math.max(5, 9 - (wave - SAUCER_START_WAVE) * 0.6)
}

function nextSaucerCooldown(wave: number) {
  return Math.max(5.5, 14 - wave * 0.7)
}

function pickSaucerSize(wave: number): SaucerSize {
  if (wave < 4) return 'large'
  const smallChance = Math.min(0.2 + (wave - 4) * 0.12, 0.8)
  return Math.random() < smallChance ? 'small' : 'large'
}

function spawnSaucer(state: GameState): Saucer {
  const size = pickSaucerSize(state.wave)
  const fromLeft = Math.random() < 0.5
  const radius = (size === 'large' ? 22 : 12) * state.scale
  const speed =
    (size === 'large' ? 58 : 92) *
    state.scale *
    (0.95 + Math.max(0, state.wave - 3) * 0.035)
  const y = state.stageH * (0.18 + Math.random() * 0.64)
  return {
    id: uid(),
    x: fromLeft ? -radius : state.stageW + radius,
    y,
    vx: fromLeft ? speed : -speed,
    vy: (Math.random() - 0.5) * 36 * state.scale,
    size,
    radius,
    fireCooldown: 0.45 + Math.random() * 0.35,
  }
}

function saucerFireBullet(
  saucer: Saucer,
  ship: Ship,
  wave: number,
  scale: number,
): EnemyBullet {
  let angle: number
  if (saucer.size === 'large') {
    angle = Math.random() * Math.PI * 2
  } else {
    const aim = Math.atan2(ship.y - saucer.y, ship.x - saucer.x)
    const spread = Math.max(0.06, 0.5 - (wave - 3) * 0.045)
    angle = aim + (Math.random() - 0.5) * 2 * spread
  }
  const speed = (saucer.size === 'large' ? 210 : 300) * scale
  return {
    id: uid(),
    x: saucer.x,
    y: saucer.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: ENEMY_BULLET_LIFE,
  }
}

function burst(
  particles: Particle[],
  x: number,
  y: number,
  hue: number,
  n: number,
  speed: number,
) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const s = speed * (0.4 + Math.random())
    const life = 0.25 + Math.random() * 0.45
    particles.push({
      id: uid(),
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life,
      maxLife: life,
      hue,
    })
  }
}

function splitRock(rock: Rock, speedScale: number, worldScale: number): Rock[] {
  if (rock.size === 'small') return []
  const next: RockSize = rock.size === 'large' ? 'medium' : 'small'
  const kids: Rock[] = []
  for (let i = 0; i < 2; i++) {
    const child = makeRock(rock.x, rock.y, next, speedScale, worldScale, {
      hue: rock.hue,
      sat: rock.sat,
    })
    child.vx += rock.vx * 0.25
    child.vy += rock.vy * 0.25
    kids.push(child)
  }
  return kids
}

function dropChance(size: RockSize) {
  if (size === 'large') return 0.34
  if (size === 'medium') return 0.22
  return 0.11
}

function maybeSpawnPowerup(rock: Rock, scale: number): Powerup | null {
  if (Math.random() > dropChance(rock.size)) return null
  const kind = pickPowerKind()
  const drift = 28 * scale
  return {
    id: uid(),
    x: rock.x,
    y: rock.y,
    vx: (Math.random() - 0.5) * drift,
    vy: (Math.random() - 0.5) * drift,
    kind,
    life: POWER_LIFE,
    radius: 20 * scale,
  }
}

function applyPowerup(state: GameState, kind: PowerKind): GameState {
  sfx('good')
  const label = kind === 'life' ? '+1 LIFE' : POWER_LABEL[kind].toUpperCase()
  const floaters = [
    ...state.floaters,
    {
      x: state.ship.x,
      y: state.ship.y - 28 * state.scale,
      text: label,
      life: 0.9,
      maxLife: 0.9,
    },
  ]
  if (kind === 'life') {
    return { ...state, lives: state.lives + 1, floaters }
  }
  if (kind === 'rapid') {
    return { ...state, buffRapid: BUFF_DURATION, floaters }
  }
  if (kind === 'spread') {
    return { ...state, buffSpread: BUFF_DURATION, floaters }
  }
  if (kind === 'shield') {
    return {
      ...state,
      buffShield: BUFF_DURATION,
      floaters,
    }
  }
  return { ...state, buffSlow: BUFF_DURATION, floaters }
}

/** Classic hyperspace: blink to a new spot (prefer clear of rocks). */
function tryHyperspace(state: GameState): GameState {
  if (state.phase !== 'playing') return state
  if ((state.hyperspaceCooldown ?? 0) > 0) return state

  const sc = state.scale
  const hull = shipRadius(sc)
  const margin = hull * 2.4
  let x = state.ship.x
  let y = state.ship.y
  let found = false

  for (let i = 0; i < 18; i++) {
    const cx = Math.random() * state.stageW
    const cy = Math.random() * state.stageH
    const clearRocks = state.rocks.every(
      (r) => dist(cx, cy, r.x, r.y) > r.radius + margin,
    )
    const clearSaucer =
      !state.saucer ||
      dist(cx, cy, state.saucer.x, state.saucer.y) > state.saucer.radius + margin
    const clearShots = (state.enemyBullets ?? []).every(
      (b) => dist(cx, cy, b.x, b.y) > hull * 2.2,
    )
    if (clearRocks && clearSaucer && clearShots) {
      x = cx
      y = cy
      found = true
      break
    }
  }

  if (!found) {
    x = Math.random() * state.stageW
    y = Math.random() * state.stageH
  }

  const particles = [...state.particles]
  burst(particles, state.ship.x, state.ship.y, 210, 14, 130)
  burst(particles, x, y, 172, 12, 110)
  sfx('tap')

  return {
    ...state,
    ship: {
      ...state.ship,
      x,
      y,
      vx: 0,
      vy: 0,
      thrusting: false,
      invuln: Math.max(state.ship.invuln, found ? 0.5 : 0.95),
    },
    particles,
    flash: 0.22,
    hyperspaceCooldown: HYPERSPACE_COOLDOWN,
  }
}

export function createInitialState(w = DESIGN_W, h = DESIGN_H): GameState {
  const scale = designScale(w, h)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    lives: START_LIVES,
    wave: 1,
    waveElapsed: 0,
    ship: makeShip(w, h),
    rocks: [],
    bullets: [],
    enemyBullets: [],
    saucer: null,
    saucerCooldown: 999,
    particles: [],
    powerups: [],
    turnLeft: false,
    turnRight: false,
    turn: 0,
    thrust: false,
    reverse: false,
    hyperspaceCooldown: 0,
    hyperspaceLatch: false,
    fireHeld: false,
    fireCooldown: 0,
    stageW: w,
    stageH: h,
    scale,
    flash: 0,
    wavePause: 0,
    timeBonus: 0,
    lastWave: 0,
    lastWaveTime: 0,
    combo: 0,
    comboTimer: 0,
    comboBest: 0,
    lastComboBest: 0,
    runComboBest: 0,
    floaters: [],
    buffRapid: 0,
    buffSpread: 0,
    buffShield: 0,
    buffSlow: 0,
  }
}

export function resizeState(state: GameState, w: number, h: number): GameState {
  const scale = designScale(w, h)
  if (w <= 0 || h <= 0) return state
  const sx = w / (state.stageW || w)
  const sy = h / (state.stageH || h)
  const k = scale / (state.scale || 1)
  return {
    ...state,
    stageW: w,
    stageH: h,
    scale,
    ship: {
      ...state.ship,
      x: state.ship.x * sx,
      y: state.ship.y * sy,
      vx: state.ship.vx * k,
      vy: state.ship.vy * k,
    },
    rocks: state.rocks.map((r) => ({
      ...r,
      x: r.x * sx,
      y: r.y * sy,
      vx: r.vx * k,
      vy: r.vy * k,
      radius: r.radius * k,
      verts: r.verts.map((v) => ({ x: v.x * k, y: v.y * k })),
    })),
    bullets: state.bullets.map((b) => ({
      ...b,
      x: b.x * sx,
      y: b.y * sy,
      vx: b.vx * k,
      vy: b.vy * k,
    })),
    enemyBullets: (state.enemyBullets ?? []).map((b) => ({
      ...b,
      x: b.x * sx,
      y: b.y * sy,
      vx: b.vx * k,
      vy: b.vy * k,
    })),
    saucer: state.saucer
      ? {
          ...state.saucer,
          x: state.saucer.x * sx,
          y: state.saucer.y * sy,
          vx: state.saucer.vx * k,
          vy: state.saucer.vy * k,
          radius: state.saucer.radius * k,
        }
      : null,
    particles: state.particles.map((p) => ({
      ...p,
      x: p.x * sx,
      y: p.y * sy,
      vx: p.vx * k,
      vy: p.vy * k,
    })),
    floaters: state.floaters.map((f) => ({
      ...f,
      x: f.x * sx,
      y: f.y * sy,
    })),
    powerups: (state.powerups ?? []).map((p) => ({
      ...p,
      x: p.x * sx,
      y: p.y * sy,
      vx: p.vx * k,
      vy: p.vy * k,
      radius: p.radius * k,
    })),
  }
}

export function startGame(prev: GameState): GameState {
  const base = createInitialState(prev.stageW, prev.stageH)
  const ship = makeShip(base.stageW, base.stageH)
  const started: GameState = {
    ...base,
    phase: 'playing',
    best: Math.max(prev.best, loadBest()),
    ship,
    wave: 1,
    waveElapsed: 0,
    wavePause: 0,
    saucer: null,
    enemyBullets: [],
    saucerCooldown: firstSaucerCooldown(1),
  }
  return { ...started, rocks: spawnWave(started, 1) }
}

export function beginNextWave(state: GameState): GameState {
  if (state.phase !== 'waveClear') return state
  const ship = {
    ...state.ship,
    vx: 0,
    vy: 0,
    thrusting: false,
    invuln: 1.4,
  }
  const started: GameState = {
    ...state,
    phase: 'playing',
    ship,
    bullets: [],
    enemyBullets: [],
    saucer: null,
    saucerCooldown: firstSaucerCooldown(state.wave),
    powerups: [],
    waveElapsed: 0,
    wavePause: 0,
    turnLeft: false,
    turnRight: false,
    turn: 0,
    thrust: false,
    reverse: false,
    hyperspaceCooldown: 0,
    hyperspaceLatch: false,
    fireHeld: false,
    fireCooldown: 0.2,
    combo: 0,
    comboTimer: 0,
    comboBest: 0,
  }
  return { ...started, rocks: spawnWave(started, started.wave) }
}

export function setControl(
  state: GameState,
  key: 'turnLeft' | 'turnRight' | 'thrust' | 'reverse' | 'fireHeld',
  value: boolean,
): GameState {
  if (state.phase !== 'playing' && state.phase !== 'menu') return state
  return { ...state, [key]: value }
}

function shipRadius(scale: number) {
  return SHIP_RADIUS * scale
}

function tryFire(state: GameState): GameState {
  const rapid = state.buffRapid > 0
  const spread = state.buffSpread > 0
  const cooldown = rapid ? FIRE_COOLDOWN * 0.42 : FIRE_COOLDOWN
  const maxBullets = rapid || spread ? MAX_BULLETS + 4 : MAX_BULLETS
  if (state.fireCooldown > 0 || state.bullets.length >= maxBullets) return state
  // Brief no-fire only after respawn — shield invuln must still allow shooting
  if ((state.buffShield ?? 0) <= 0 && state.ship.invuln > 1.6) return state
  const { ship } = state
  const r = shipRadius(state.scale)
  const bulletSpeed = BULLET_SPEED * state.scale
  const nose = r + 4 * state.scale
  const angles = spread
    ? [ship.angle - 0.22, ship.angle, ship.angle + 0.22]
    : [ship.angle]
  const nextBullets = angles.map((angle) => ({
    id: uid(),
    x: ship.x + Math.cos(angle) * nose,
    y: ship.y + Math.sin(angle) * nose,
    vx: Math.cos(angle) * bulletSpeed + ship.vx * 0.2,
    vy: Math.sin(angle) * bulletSpeed + ship.vy * 0.2,
    life: BULLET_LIFE,
  }))
  return {
    ...state,
    fireCooldown: cooldown,
    bullets: [...state.bullets, ...nextBullets],
  }
}

function killShip(state: GameState): GameState {
  const particles = [...state.particles]
  burst(particles, state.ship.x, state.ship.y, 200, 18, 160)
  const lives = state.lives - 1
  if (lives <= 0) {
    const best = Math.max(state.best, state.score)
    if (best !== state.best) saveBest(best)
    sfx('die')
    return {
      ...state,
      phase: 'gameover',
      lives: 0,
      best,
      particles,
      bullets: [],
      enemyBullets: [],
      saucer: null,
      powerups: [],
      flash: 0.35,
      thrust: false,
      reverse: false,
      hyperspaceCooldown: 0,
      hyperspaceLatch: false,
      fireHeld: false,
      combo: 0,
      comboTimer: 0,
      buffRapid: 0,
      buffSpread: 0,
      buffShield: 0,
      buffSlow: 0,
    }
  }
  sfx('hurt')
  return {
    ...state,
    lives,
    ship: makeShip(state.stageW, state.stageH),
    bullets: [],
    enemyBullets: [],
    particles,
    flash: 0.28,
    fireCooldown: 0.4,
    hyperspaceCooldown: 0,
    hyperspaceLatch: false,
    combo: 0,
    comboTimer: 0,
  }
}

function tickFloaters(floaters: Floater[], dt: number, scale: number): Floater[] {
  return floaters
    .map((f) => ({
      ...f,
      y: f.y - 38 * scale * dt,
      life: f.life - dt,
    }))
    .filter((f) => f.life > 0)
}

export function tick(state: GameState, dt: number): GameState {
  if (state.phase !== 'playing') {
    return {
      ...state,
      flash: Math.max(0, state.flash - dt * 1.6),
      particles: state.particles
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          life: p.life - dt,
        }))
        .filter((p) => p.life > 0),
      floaters: tickFloaters(state.floaters, dt, state.scale),
    }
  }

  let s: GameState = {
    ...state,
    flash: Math.max(0, state.flash - dt * 1.6),
    fireCooldown: Math.max(0, state.fireCooldown - dt),
    waveElapsed: state.waveElapsed + dt,
    comboTimer: Math.max(0, state.comboTimer - dt),
    floaters: tickFloaters(state.floaters, dt, state.scale),
    buffRapid: Math.max(0, (state.buffRapid ?? 0) - dt),
    buffSpread: Math.max(0, (state.buffSpread ?? 0) - dt),
    buffShield: Math.max(0, (state.buffShield ?? 0) - dt),
    buffSlow: Math.max(0, (state.buffSlow ?? 0) - dt),
    powerups: state.powerups ?? [],
  }
  if (s.comboTimer <= 0 && s.combo > 0) {
    s = { ...s, combo: 0 }
  }

  let hyperspaceCooldown = Math.max(0, (s.hyperspaceCooldown ?? 0) - dt)
  let hyperspaceLatch = s.hyperspaceLatch ?? false
  if (s.reverse && !hyperspaceLatch && hyperspaceCooldown <= 0) {
    s = tryHyperspace({ ...s, hyperspaceCooldown: 0 })
    hyperspaceCooldown = s.hyperspaceCooldown
    hyperspaceLatch = true
  }
  if (!s.reverse) hyperspaceLatch = false
  s = { ...s, hyperspaceCooldown, hyperspaceLatch }

  let ship = { ...s.ship }
  const sc = s.scale
  const hull = shipRadius(sc)
  const rockDt = s.buffSlow > 0 ? dt * 0.42 : dt
  if (s.turnLeft) ship.angle -= TURN_SPEED * dt
  if (s.turnRight) ship.angle += TURN_SPEED * dt
  if (!s.turnLeft && !s.turnRight && s.turn) {
    ship.angle += TURN_SPEED * dt * Math.max(-1, Math.min(1, s.turn))
  }
  const thrusting = s.thrust
  ship.thrusting = thrusting
  if (thrusting) {
    ship.vx += Math.cos(ship.angle) * THRUST * sc * dt
    ship.vy += Math.sin(ship.angle) * THRUST * sc * dt
  }
  ship.vx *= DRAG
  ship.vy *= DRAG
  const maxSpeed = MAX_SPEED * sc
  const spd = Math.hypot(ship.vx, ship.vy)
  if (spd > maxSpeed) {
    ship.vx = (ship.vx / spd) * maxSpeed
    ship.vy = (ship.vy / spd) * maxSpeed
  }
  ship.x = wrap(ship.x + ship.vx * dt, s.stageW)
  ship.y = wrap(ship.y + ship.vy * dt, s.stageH)
  ship.invuln = Math.max(0, ship.invuln - dt)
  s = { ...s, ship }

  // Always auto-fire — holding a fire key + arrows ghosts on many keyboards
  s = tryFire(s)
  ship = s.ship

  let particles = s.particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      life: p.life - dt,
    }))
    .filter((p) => p.life > 0)

  if (ship.thrusting && Math.random() < 0.55) {
    const back = ship.angle + Math.PI
    const life = 0.15 + Math.random() * 0.12
    particles.push({
      id: uid(),
      x: ship.x + Math.cos(back) * (hull * 0.7),
      y: ship.y + Math.sin(back) * (hull * 0.7),
      vx: Math.cos(back) * (40 + Math.random() * 40) * sc + ship.vx * 0.2,
      vy: Math.sin(back) * (40 + Math.random() * 40) * sc + ship.vy * 0.2,
      life,
      maxLife: life,
      hue: 45 + Math.random() * 20,
    })
  }

  let bullets = s.bullets
    .map((b) => ({
      ...b,
      x: wrap(b.x + b.vx * dt, s.stageW),
      y: wrap(b.y + b.vy * dt, s.stageH),
      life: b.life - dt,
    }))
    .filter((b) => b.life > 0)

  let rocks = s.rocks.map((r) => ({
    ...r,
    x: wrap(r.x + r.vx * rockDt, s.stageW),
    y: wrap(r.y + r.vy * rockDt, s.stageH),
    angle: r.angle + r.spin * rockDt,
  }))

  let powerups = (s.powerups ?? [])
    .map((p) => ({
      ...p,
      x: wrap(p.x + p.vx * dt, s.stageW),
      y: wrap(p.y + p.vy * dt, s.stageH),
      life: p.life - dt,
    }))
    .filter((p) => p.life > 0)

  let saucer = s.saucer
  let saucerCooldown = s.saucerCooldown ?? firstSaucerCooldown(s.wave)
  let enemyBullets = [...(s.enemyBullets ?? [])]

  if (!saucer && s.wave >= SAUCER_START_WAVE && rocks.length > 0) {
    saucerCooldown -= dt
    if (saucerCooldown <= 0) {
      saucer = spawnSaucer(s)
      saucerCooldown = nextSaucerCooldown(s.wave)
      sfx('tap')
    }
  }

  if (saucer) {
    const nextX = saucer.x + saucer.vx * rockDt
    const nextY = wrap(saucer.y + saucer.vy * rockDt, s.stageH)
    // Fly off the far edge instead of wrapping horizontally
    if (
      (saucer.vx > 0 && nextX - saucer.radius > s.stageW) ||
      (saucer.vx < 0 && nextX + saucer.radius < 0)
    ) {
      saucer = null
    } else {
      let fireCooldown = saucer.fireCooldown - dt
      const fired: EnemyBullet[] = []
      if (fireCooldown <= 0) {
        fired.push(saucerFireBullet(saucer, ship, s.wave, sc))
        fireCooldown =
          saucer.size === 'large' ? 1.15 + Math.random() * 0.35 : 0.65 + Math.random() * 0.25
        sfx('fire')
      }
      saucer = {
        ...saucer,
        x: nextX,
        y: nextY,
        fireCooldown,
      }
      enemyBullets = [...enemyBullets, ...fired]
    }
  }

  enemyBullets = enemyBullets
    .map((b) => ({
      ...b,
      x: wrap(b.x + b.vx * dt, s.stageW),
      y: wrap(b.y + b.vy * dt, s.stageH),
      life: b.life - dt,
    }))
    .filter((b) => b.life > 0)

  const speedScale = waveSpeedScale(s.wave)
  let score = s.score
  let combo = s.combo
  let comboTimer = s.comboTimer
  let comboBest = s.comboBest
  let runComboBest = s.runComboBest
  let floaters = [...s.floaters]
  const hitBullet = new Set<number>()
  const hitRock = new Set<number>()
  const hitEnemyBullet = new Set<number>()
  const spawned: Rock[] = []
  const dropped: Powerup[] = []

  for (const b of bullets) {
    for (const r of rocks) {
      if (hitRock.has(r.id) || hitBullet.has(b.id)) continue
      if (dist(b.x, b.y, r.x, r.y) < r.radius + 3 * sc) {
        hitBullet.add(b.id)
        hitRock.add(r.id)
        combo += 1
        comboTimer = COMBO_WINDOW
        comboBest = Math.max(comboBest, combo)
        runComboBest = Math.max(runComboBest, combo)
        const gained = Math.round(ROCK_SCORE[r.size] * comboMultiplier(combo))
        score += gained
        burst(particles, r.x, r.y, r.hue, r.size === 'large' ? 14 : 9, 120)
        sfx('hit', combo)
        spawned.push(...splitRock(r, speedScale, sc))
        const drop = maybeSpawnPowerup(r, sc)
        if (drop) dropped.push(drop)
        floaters.push({
          x: r.x,
          y: r.y,
          text: combo > 1 ? `+${gained}  ×${combo}` : `+${gained}`,
          life: 0.7,
          maxLife: 0.7,
        })
      }
    }
  }

  // Player bullets vs saucer
  if (saucer) {
    for (const b of bullets) {
      if (hitBullet.has(b.id)) continue
      if (dist(b.x, b.y, saucer.x, saucer.y) < saucer.radius + 3 * sc) {
        hitBullet.add(b.id)
        const gained = SAUCER_SCORE[saucer.size]
        score += gained
        combo += 1
        comboTimer = COMBO_WINDOW
        comboBest = Math.max(comboBest, combo)
        runComboBest = Math.max(runComboBest, combo)
        burst(particles, saucer.x, saucer.y, 38, saucer.size === 'large' ? 16 : 10, 140)
        sfx('boom')
        floaters.push({
          x: saucer.x,
          y: saucer.y,
          text: `+${gained}`,
          life: 0.85,
          maxLife: 0.85,
        })
        saucer = null
        break
      }
    }
  }

  // Enemy bullets vs rocks
  for (const b of enemyBullets) {
    for (const r of rocks) {
      if (hitRock.has(r.id) || hitEnemyBullet.has(b.id)) continue
      if (dist(b.x, b.y, r.x, r.y) < r.radius + 3 * sc) {
        hitEnemyBullet.add(b.id)
        hitRock.add(r.id)
        burst(particles, r.x, r.y, r.hue, r.size === 'large' ? 10 : 6, 100)
        spawned.push(...splitRock(r, speedScale, sc))
      }
    }
  }

  // Saucer vs rocks
  if (saucer) {
    for (const r of rocks) {
      if (hitRock.has(r.id)) continue
      if (dist(saucer.x, saucer.y, r.x, r.y) < saucer.radius + r.radius * 0.85) {
        hitRock.add(r.id)
        burst(particles, r.x, r.y, r.hue, 8, 90)
        burst(particles, saucer.x, saucer.y, 38, 10, 110)
        spawned.push(...splitRock(r, speedScale, sc))
        saucer = null
        sfx('boom')
        break
      }
    }
  }

  if (hitBullet.size || hitRock.size) {
    bullets = bullets.filter((b) => !hitBullet.has(b.id))
    rocks = [...rocks.filter((r) => !hitRock.has(r.id)), ...spawned]
    powerups = [...powerups, ...dropped]
  }
  if (hitEnemyBullet.size) {
    enemyBullets = enemyBullets.filter((b) => !hitEnemyBullet.has(b.id))
  }

  s = {
    ...s,
    score,
    bullets,
    enemyBullets,
    saucer,
    saucerCooldown,
    rocks,
    particles,
    powerups,
    combo,
    comboTimer,
    comboBest,
    runComboBest,
    floaters,
  }

  const stillPowerups: Powerup[] = []
  for (const p of s.powerups) {
    if (dist(ship.x, ship.y, p.x, p.y) < p.radius + hull * 0.85) {
      s = applyPowerup(s, p.kind)
      ship = s.ship
    } else {
      stillPowerups.push(p)
    }
  }
  s = { ...s, powerups: stillPowerups, ship }

  if (ship.invuln <= 0 && (s.buffShield ?? 0) <= 0) {
    for (const r of rocks) {
      if (dist(ship.x, ship.y, r.x, r.y) < r.radius + hull * 0.7) {
        return killShip(s)
      }
    }
    if (s.saucer && dist(ship.x, ship.y, s.saucer.x, s.saucer.y) < s.saucer.radius + hull * 0.7) {
      return killShip(s)
    }
    for (const b of s.enemyBullets) {
      if (dist(ship.x, ship.y, b.x, b.y) < hull * 0.75 + 3 * sc) {
        return killShip(s)
      }
    }
  }

  // Clear only when rocks and saucer are gone (enemy shots can linger briefly)
  if (rocks.length === 0 && !s.saucer && s.wavePause <= 0) {
    const nextWave = s.wave + 1
    const timeBonus = Math.max(0, Math.round(waveParFor(s.wave) - s.waveElapsed) * 20)
    const bonus = nextWave * 50 + timeBonus
    sfx('wave')
    const withBonus = {
      ...s,
      phase: 'waveClear' as const,
      score: s.score + bonus,
      lastWave: s.wave,
      lastWaveTime: s.waveElapsed,
      wave: nextWave,
      waveElapsed: 0,
      wavePause: 0,
      timeBonus,
      lastComboBest: s.comboBest,
      combo: 0,
      comboTimer: 0,
      comboBest: 0,
      runComboBest: Math.max(s.runComboBest, s.comboBest),
      rocks: [],
      bullets: [],
      enemyBullets: [],
      saucer: null,
      saucerCooldown: firstSaucerCooldown(nextWave),
      powerups: [],
      turnLeft: false,
      turnRight: false,
      turn: 0,
      thrust: false,
      reverse: false,
      hyperspaceCooldown: 0,
      hyperspaceLatch: false,
      fireHeld: false,
      ship: { ...s.ship, vx: 0, vy: 0, thrusting: false },
    }
    return {
      ...withBonus,
      flash: 0.2,
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
    wave: s.wave,
    rocks: s.rocks.length,
    time: s.phase === 'waveClear' ? s.lastWaveTime : s.waveElapsed,
    lastWave: s.lastWave,
    lastWaveTime: s.lastWaveTime,
    timeBonus: s.timeBonus,
    combo: s.combo,
    comboBest: s.phase === 'waveClear' ? s.lastComboBest : s.comboBest,
    runComboBest: s.runComboBest,
    buffRapid: (s.buffRapid ?? 0) > 0,
    buffSpread: (s.buffSpread ?? 0) > 0,
    buffShield: (s.buffShield ?? 0) > 0,
    buffSlow: (s.buffSlow ?? 0) > 0,
  }
}

export function formatWaveTime(secs: number) {
  const t = Math.max(0, secs)
  return t.toFixed(1)
}

export { SHIP_RADIUS, shipRadius }
