import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

/*
 * Frenzy: one open tank, one rule. Anything smaller is food; anything bigger
 * is not. Steer with the cursor or a finger — the fish swims toward it — and
 * grow by eating until something you can't out-swim finds you.
 */

export type Phase = 'menu' | 'playing' | 'gameover'

export type Fish = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  angle: number
  tail: number
  wander: number
  hueJitter: number
  aggressive: boolean
  shark: boolean
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

export type Floater = {
  x: number
  y: number
  text: string
  life: number
  maxLife: number
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  size: number
  tier: string
  danger: boolean
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  stageW: number
  stageH: number
  scale: number
  player: Fish
  fishes: Fish[]
  particles: Particle[]
  floaters: Floater[]
  pointerTarget: { x: number; y: number } | null
  keys: { up: boolean; down: boolean; left: boolean; right: boolean }
  invuln: number
  danger: boolean
  spawnTimer: number
  elapsed: number
  flash: number
  shake: number
}

export const DESIGN_W = 960
export const DESIGN_H = 540
const REF_SHORT = 540

export const PLAYER_START_RADIUS = 15
const MIN_ENEMY_RADIUS = 8
const SPEED_BASE = 150
const ACCEL_BASE = 520
const EAT_MARGIN = 1.12
const START_INVULN = 2.2
const GROW_FACTOR = 0.55
const SPAWN_INTERVAL = 0.55
const DEADZONE = 6

let nextId = 1
function uid() {
  return nextId++
}

function loadBest() {
  return getPersonalBest('frenzy')
}

function designScale(w: number, h: number) {
  return Math.min(w, h) / REF_SHORT || 1
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by)
}

function makeFish(x: number, y: number, radius: number, opts?: Partial<Fish>): Fish {
  const ang = Math.random() * Math.PI * 2
  return {
    id: uid(),
    x,
    y,
    vx: Math.cos(ang) * 20,
    vy: Math.sin(ang) * 20,
    radius,
    angle: ang,
    tail: Math.random() * Math.PI * 2,
    wander: ang,
    hueJitter: (Math.random() - 0.5) * 16,
    aggressive: false,
    shark: false,
    ...opts,
  }
}

function makePlayer(w: number, h: number, scale: number): Fish {
  return makeFish(w / 2, h / 2, PLAYER_START_RADIUS * scale)
}

export function tierFor(designRadius: number): string {
  if (designRadius < 22) return 'Minnow'
  if (designRadius < 32) return 'Guppy'
  if (designRadius < 46) return 'Snapper'
  if (designRadius < 65) return 'Barracuda'
  if (designRadius < 90) return 'Grouper'
  if (designRadius < 120) return 'Marlin'
  return 'Leviathan'
}

/** How many enemies the tank tries to keep stocked as the run goes on. */
function targetPopulation(elapsed: number) {
  return Math.min(26, 12 + Math.floor(elapsed / 14))
}

/** How likely — and how large — the next spawn's threat is, as the run goes on. */
function pickSizeFactor(elapsed: number, score: number) {
  const threatBias = Math.min(0.5, 0.14 + score / 4500 + elapsed / 900)
  const roll = Math.random()
  if (roll > threatBias) {
    return 0.38 + Math.random() * 0.58
  }
  const maxDanger = 1.35 + Math.min(0.65, score / 5000)
  return 1.08 + Math.random() * (maxDanger - 1.08)
}

function spawnAwayFrom(w: number, h: number, x0: number, y0: number, minDist: number) {
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    if (dist(x, y, x0, y0) > minDist) return { x, y }
  }
  const edge = Math.floor(Math.random() * 4)
  if (edge === 0) return { x: 2, y: Math.random() * h }
  if (edge === 1) return { x: w - 2, y: Math.random() * h }
  if (edge === 2) return { x: Math.random() * w, y: 2 }
  return { x: Math.random() * w, y: h - 2 }
}

function spawnFish(state: GameState): Fish {
  const factor = pickSizeFactor(state.elapsed, state.score)
  const scale = state.scale
  const cap = Math.min(state.stageW, state.stageH) * 0.22
  const radius = Math.min(cap, Math.max(MIN_ENEMY_RADIUS * scale, state.player.radius * factor))
  const spot = spawnAwayFrom(
    state.stageW,
    state.stageH,
    state.player.x,
    state.player.y,
    Math.min(state.stageW, state.stageH) * 0.32,
  )
  const dangerous = radius > state.player.radius * EAT_MARGIN
  return makeFish(spot.x, spot.y, radius, {
    aggressive: dangerous && Math.random() < 0.5,
    shark: dangerous && radius > state.player.radius * 1.55,
  })
}

export function createInitialState(w = DESIGN_W, h = DESIGN_H): GameState {
  const scale = designScale(w, h)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    stageW: w,
    stageH: h,
    scale,
    player: makePlayer(w, h, scale),
    fishes: [],
    particles: [],
    floaters: [],
    pointerTarget: null,
    keys: { up: false, down: false, left: false, right: false },
    invuln: START_INVULN,
    danger: false,
    spawnTimer: 0,
    elapsed: 0,
    flash: 0,
    shake: 0,
  }
}

export function resizeState(state: GameState, w: number, h: number): GameState {
  if (w <= 0 || h <= 0) return state
  const scale = designScale(w, h)
  const sx = w / (state.stageW || w)
  const sy = h / (state.stageH || h)
  const k = scale / (state.scale || 1)
  const rescale = (f: Fish): Fish => ({
    ...f,
    x: f.x * sx,
    y: f.y * sy,
    vx: f.vx * k,
    vy: f.vy * k,
    radius: f.radius * k,
  })
  return {
    ...state,
    stageW: w,
    stageH: h,
    scale,
    player: rescale(state.player),
    fishes: state.fishes.map(rescale),
  }
}

export function startGame(prev: GameState): GameState {
  const fresh = createInitialState(prev.stageW, prev.stageH)
  return {
    ...fresh,
    best: Math.max(prev.best, loadBest()),
    phase: 'playing',
    fishes: Array.from({ length: 10 }, () => spawnFish(fresh)),
  }
}

export function setPointerTarget(state: GameState, x: number, y: number): GameState {
  return { ...state, pointerTarget: { x, y } }
}

export function clearPointerTarget(state: GameState): GameState {
  return { ...state, pointerTarget: null }
}

export function setKey(state: GameState, key: keyof GameState['keys'], down: boolean): GameState {
  if (state.keys[key] === down) return state
  return { ...state, keys: { ...state.keys, [key]: down } }
}

function steerInput(state: GameState): { x: number; y: number } | null {
  const { keys, player } = state
  let dx = 0
  let dy = 0
  if (keys.up) dy -= 1
  if (keys.down) dy += 1
  if (keys.left) dx -= 1
  if (keys.right) dx += 1
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy) || 1
    return { x: player.x + (dx / len) * 1000, y: player.y + (dy / len) * 1000 }
  }
  return state.pointerTarget
}

function maxSpeedFor(radius: number, scale: number) {
  const ratio = (PLAYER_START_RADIUS * scale) / Math.max(1, radius)
  return SPEED_BASE * scale * Math.min(1.4, Math.max(0.45, ratio ** 0.3))
}

function accelFor(radius: number, scale: number) {
  const ratio = (PLAYER_START_RADIUS * scale) / Math.max(1, radius)
  return ACCEL_BASE * scale * Math.min(1.4, Math.max(0.42, ratio ** 0.3))
}

function integrate(
  f: Fish,
  target: { x: number; y: number } | null,
  dt: number,
  scale: number,
  w: number,
  h: number,
) {
  const maxSpeed = maxSpeedFor(f.radius, scale)
  const accel = accelFor(f.radius, scale)

  let dx = 0
  let dy = 0
  if (target) {
    dx = target.x - f.x
    dy = target.y - f.y
    const d = Math.hypot(dx, dy)
    if (d > DEADZONE) {
      dx /= d
      dy /= d
    } else {
      dx = 0
      dy = 0
    }
  }

  // Push toward the interior, growing sharply near an edge — this is a real
  // driving force, not just a clamp on the seek target, so a fish that's
  // wandered or fled into a corner still has somewhere to go instead of
  // just running out of thrust and sitting there.
  const margin = f.radius * 3 + 60
  let wx = 0
  let wy = 0
  if (f.x < margin) wx = (margin - f.x) / margin
  else if (f.x > w - margin) wx = -(f.x - (w - margin)) / margin
  if (f.y < margin) wy = (margin - f.y) / margin
  else if (f.y > h - margin) wy = -(f.y - (h - margin)) / margin

  f.vx += (dx + wx * 2.4) * accel * dt
  f.vy += (dy + wy * 2.4) * accel * dt

  const speed = Math.hypot(f.vx, f.vy)
  if (speed > maxSpeed) {
    f.vx = (f.vx / speed) * maxSpeed
    f.vy = (f.vy / speed) * maxSpeed
  }
  const drag = Math.pow(0.985, dt * 60)
  f.vx *= drag
  f.vy *= drag
  f.x += f.vx * dt
  f.y += f.vy * dt

  const pad = f.radius
  if (f.x < pad) {
    f.x = pad
    f.vx = Math.abs(f.vx) * 0.4
  } else if (f.x > w - pad) {
    f.x = w - pad
    f.vx = -Math.abs(f.vx) * 0.4
  }
  if (f.y < pad) {
    f.y = pad
    f.vy = Math.abs(f.vy) * 0.4
  } else if (f.y > h - pad) {
    f.y = h - pad
    f.vy = -Math.abs(f.vy) * 0.4
  }

  const vs = Math.hypot(f.vx, f.vy)
  if (vs > 4) f.angle = Math.atan2(f.vy, f.vx)
  f.tail += dt * (4 + vs * 0.02)
}

function wanderTarget(f: Fish, dt: number) {
  f.wander += (Math.random() - 0.5) * dt * 2.4
  const reach = f.radius * 5 + 40
  return { x: f.x + Math.cos(f.wander) * reach, y: f.y + Math.sin(f.wander) * reach }
}

function aiTarget(
  f: Fish,
  player: Fish,
  dt: number,
  huntingAllowed: boolean,
): { x: number; y: number } {
  const d = dist(f.x, f.y, player.x, player.y)
  const playerIsFood = player.radius > f.radius * EAT_MARGIN
  const playerIsThreat = f.radius > player.radius * EAT_MARGIN
  if (playerIsFood && d < f.radius * 2.5 + 46) {
    const dx = f.x - player.x
    const dy = f.y - player.y
    const len = Math.hypot(dx, dy) || 1
    return { x: f.x + (dx / len) * 140, y: f.y + (dy / len) * 140 }
  }
  if (huntingAllowed && playerIsThreat && f.aggressive && d < f.radius * 9 + 140) {
    return { x: player.x, y: player.y }
  }
  return wanderTarget(f, dt)
}

function spawnBurst(state: GameState, x: number, y: number, hue: number, count: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const speed = 30 + Math.random() * 90
    state.particles.push({
      id: uid(),
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 1,
      maxLife: 0.4 + Math.random() * 0.35,
      hue,
    })
  }
}

function endRun(state: GameState, x: number, y: number) {
  state.phase = 'gameover'
  state.best = Math.max(state.best, state.score)
  state.flash = 0.35
  state.shake = 1
  spawnBurst(state, x, y, 8, 22)
  sfx('hurt')
  sfx('die')
}

export function tick(state: GameState, dt: number): GameState {
  if (state.phase !== 'playing') return state
  const s: GameState = {
    ...state,
    player: { ...state.player },
    fishes: state.fishes.map((f) => ({ ...f })),
    particles: [...state.particles],
    floaters: [...state.floaters],
  }
  s.elapsed += dt
  s.invuln = Math.max(0, s.invuln - dt)
  s.flash = Math.max(0, s.flash - dt * 1.6)
  s.shake = Math.max(0, s.shake - dt * 3)

  integrate(s.player, steerInput(s), dt, s.scale, s.stageW, s.stageH)

  const huntingAllowed = s.invuln <= 0
  for (const f of s.fishes) {
    integrate(f, aiTarget(f, s.player, dt, huntingAllowed), dt, s.scale, s.stageW, s.stageH)
  }

  const survivors: Fish[] = []
  let ate = false
  for (const f of s.fishes) {
    const d = dist(f.x, f.y, s.player.x, s.player.y)
    if (d < f.radius + s.player.radius) {
      if (f.radius <= s.player.radius / EAT_MARGIN) {
        const designRadius = f.radius / s.scale
        const points = Math.max(1, Math.round(designRadius * 3))
        s.score += points
        s.player.radius = Math.sqrt(s.player.radius ** 2 + f.radius ** 2 * GROW_FACTOR)
        spawnBurst(s, f.x, f.y, 172, 10)
        s.floaters.push({ x: f.x, y: f.y - f.radius - 6, text: `+${points}`, life: 1, maxLife: 0.9 })
        ate = true
        continue
      }
      if (f.radius >= s.player.radius * EAT_MARGIN) {
        if (s.invuln <= 0) {
          endRun(s, s.player.x, s.player.y)
          return s
        }
      } else {
        const dx = s.player.x - f.x
        const dy = s.player.y - f.y
        const len = Math.hypot(dx, dy) || 1
        const push = (f.radius + s.player.radius - len) * 0.5
        s.player.x += (dx / len) * push
        s.player.y += (dy / len) * push
        f.x -= (dx / len) * push
        f.y -= (dy / len) * push
      }
    }
    survivors.push(f)
  }
  if (ate) sfx('eat')
  s.fishes = survivors

  s.spawnTimer -= dt
  const target = targetPopulation(s.elapsed)
  if (s.spawnTimer <= 0 && s.fishes.length < target) {
    s.spawnTimer = SPAWN_INTERVAL
    s.fishes.push(spawnFish(s))
  }

  s.particles = s.particles.filter((p) => {
    p.life -= dt / p.maxLife
    if (p.life <= 0) return false
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.94
    p.vy *= 0.94
    return true
  })
  s.floaters = s.floaters.filter((f) => {
    f.life -= dt / f.maxLife
    f.y -= dt * 24
    return f.life > 0
  })

  s.danger = s.fishes.some(
    (f) =>
      f.radius > s.player.radius * EAT_MARGIN &&
      dist(f.x, f.y, s.player.x, s.player.y) < s.player.radius * 7 + 60,
  )

  return s
}

export function toSnapshot(s: GameState): Snapshot {
  const designRadius = s.player.radius / s.scale
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    size: designRadius,
    tier: tierFor(designRadius),
    danger: s.danger,
  }
}
