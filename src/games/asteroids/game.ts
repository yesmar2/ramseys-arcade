import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Phase = 'menu' | 'playing' | 'waveClear' | 'gameover'

export type Point = { x: number; y: number }

export type RockSize = 'large' | 'medium' | 'small'

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
  particles: Particle[]
  turnLeft: boolean
  turnRight: boolean
  /** -1 left … 1 right. Used when analog stick is active. */
  turn: number
  thrust: boolean
  reverse: boolean
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
  floaters: Floater[]
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
const TURN_SPEED = 4.6
const THRUST = 420
const DRAG = 0.988
const MAX_SPEED = 560
const BULLET_SPEED = 480
const BULLET_LIFE = 0.55
const SHIP_RADIUS = 22
const START_LIVES = 3
const COMBO_WINDOW = 0.75

function comboMultiplier(combo: number) {
  return Math.min(2, 1 + Math.max(0, combo - 1) * 0.25)
}

/** Par time for a wave — beat it for a time bonus. Does not fail the run. */
function waveParFor(wave: number) {
  return Math.max(28, 48 - (wave - 1) * 2)
}

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
  const count = Math.min(4 + wave, 10)
  const speedScale = 1 + (wave - 1) * 0.08
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
    particles: [],
    turnLeft: false,
    turnRight: false,
    turn: 0,
    thrust: false,
    reverse: false,
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
    floaters: [],
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
    waveElapsed: 0,
    wavePause: 0,
    turnLeft: false,
    turnRight: false,
    turn: 0,
    thrust: false,
    reverse: false,
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
  if (state.fireCooldown > 0 || state.bullets.length >= MAX_BULLETS) return state
  if (state.ship.invuln > 1.6) return state
  const { ship } = state
  const r = shipRadius(state.scale)
  const bulletSpeed = BULLET_SPEED * state.scale
  const bx = ship.x + Math.cos(ship.angle) * (r + 4 * state.scale)
  const by = ship.y + Math.sin(ship.angle) * (r + 4 * state.scale)
  return {
    ...state,
    fireCooldown: FIRE_COOLDOWN,
    bullets: [
      ...state.bullets,
      {
        id: uid(),
        x: bx,
        y: by,
        vx: Math.cos(ship.angle) * bulletSpeed + ship.vx * 0.2,
        vy: Math.sin(ship.angle) * bulletSpeed + ship.vy * 0.2,
        life: BULLET_LIFE,
      },
    ],
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
      flash: 0.35,
      thrust: false,
      reverse: false,
      fireHeld: false,
      combo: 0,
      comboTimer: 0,
    }
  }
  sfx('hurt')
  return {
    ...state,
    lives,
    ship: makeShip(state.stageW, state.stageH),
    bullets: [],
    particles,
    flash: 0.28,
    fireCooldown: 0.4,
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
  }
  if (s.comboTimer <= 0 && s.combo > 0) {
    s = { ...s, combo: 0 }
  }

  let ship = { ...s.ship }
  const sc = s.scale
  const hull = shipRadius(sc)
  if (s.turnLeft) ship.angle -= TURN_SPEED * dt
  if (s.turnRight) ship.angle += TURN_SPEED * dt
  if (!s.turnLeft && !s.turnRight && s.turn) {
    ship.angle += TURN_SPEED * dt * Math.max(-1, Math.min(1, s.turn))
  }
  const thrusting = s.thrust && !s.reverse
  const reversing = s.reverse && !s.thrust
  ship.thrusting = thrusting
  if (thrusting) {
    ship.vx += Math.cos(ship.angle) * THRUST * sc * dt
    ship.vy += Math.sin(ship.angle) * THRUST * sc * dt
  } else if (reversing) {
    ship.vx -= Math.cos(ship.angle) * THRUST * sc * 0.7 * dt
    ship.vy -= Math.sin(ship.angle) * THRUST * sc * 0.7 * dt
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
    x: wrap(r.x + r.vx * dt, s.stageW),
    y: wrap(r.y + r.vy * dt, s.stageH),
    angle: r.angle + r.spin * dt,
  }))

  const speedScale = 1 + (s.wave - 1) * 0.08
  let score = s.score
  let combo = s.combo
  let comboTimer = s.comboTimer
  let comboBest = s.comboBest
  let floaters = [...s.floaters]
  const hitBullet = new Set<number>()
  const hitRock = new Set<number>()
  const spawned: Rock[] = []

  for (const b of bullets) {
    for (const r of rocks) {
      if (hitRock.has(r.id) || hitBullet.has(b.id)) continue
      if (dist(b.x, b.y, r.x, r.y) < r.radius + 3 * sc) {
        hitBullet.add(b.id)
        hitRock.add(r.id)
        combo += 1
        comboTimer = COMBO_WINDOW
        comboBest = Math.max(comboBest, combo)
        const gained = Math.round(ROCK_SCORE[r.size] * comboMultiplier(combo))
        score += gained
        burst(particles, r.x, r.y, r.hue, r.size === 'large' ? 14 : 9, 120)
        sfx('hit', combo)
        spawned.push(...splitRock(r, speedScale, sc))
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

  if (hitBullet.size || hitRock.size) {
    bullets = bullets.filter((b) => !hitBullet.has(b.id))
    rocks = [...rocks.filter((r) => !hitRock.has(r.id)), ...spawned]
  }

  s = { ...s, score, bullets, rocks, particles, combo, comboTimer, comboBest, floaters }

  if (ship.invuln <= 0) {
    for (const r of rocks) {
      if (dist(ship.x, ship.y, r.x, r.y) < r.radius + hull * 0.7) {
        return killShip(s)
      }
    }
  }

  if (rocks.length === 0 && s.wavePause <= 0) {
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
      rocks: [],
      bullets: [],
      turnLeft: false,
      turnRight: false,
      turn: 0,
      thrust: false,
      reverse: false,
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
  }
}

export function formatWaveTime(secs: number) {
  const t = Math.max(0, secs)
  return t.toFixed(1)
}

export { SHIP_RADIUS, shipRadius }
