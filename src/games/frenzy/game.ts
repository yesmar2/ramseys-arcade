import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

/*
 * Frenzy: a scrolling ocean, camera locked to your fish. Every fish carries
 * its level. Eat anything at your level or below — that's the whole rule —
 * and the fish's own number is what it's worth: a 1 is always a nibble, a
 * big number is always a real meal, whatever level you happen to be.
 * Anything above your level eats you, and mines don't care about your level
 * at all. Steering is direct: point a direction, the fish turns and swims,
 * no drift to fight.
 */

export type Phase = 'menu' | 'playing' | 'gameover'

export type Fish = {
  id: number
  x: number
  y: number
  level: number
  angle: number
  tail: number
  wander: number
  hueJitter: number
  aggressive: boolean
  /** Seconds spent actively hunting the player — a chase tires a fish out. */
  huntTime: number
}

/** A mine — an obstacle, not a fish. No level, no fleeing: touch it and the run ends. */
export type Hazard = {
  id: number
  x: number
  y: number
  bob: number
  spin: number
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
  /** Smaller second line — how many levels that catch was worth. */
  sub: string
  life: number
  maxLife: number
  /** How big a catch this was, 0..1 — a bigger fish makes a bigger splash of text. */
  weight: number
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  level: number
  danger: boolean
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  stageW: number
  stageH: number
  scale: number
  cameraX: number
  cameraY: number
  zoom: number
  player: Fish
  fishes: Fish[]
  hazards: Hazard[]
  particles: Particle[]
  floaters: Floater[]
  pointerDir: { x: number; y: number } | null
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

const BASE_RADIUS = 15
const BASE_SPEED = 210
const BASE_TURN_RATE = 7.5
const POINTER_FULL_SPEED_DIST = 55
const START_INVULN = 2.2
const SPAWN_INTERVAL = 0.22
const MIN_SPAWN_GAP = 80

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

/** 1 for a fish right at your own level, fading to 0 by 7 levels below — how "big" a catch it is. */
function catchCloseness(playerLevel: number, preyLevel: number) {
  return Math.max(0, Math.min(1, 1 - (playerLevel - preyLevel) / 7))
}

export function radiusForLevel(level: number, scale: number) {
  return BASE_RADIUS * scale * Math.pow(Math.max(1, level), 0.46)
}

/** A gentle curve — level matters far more for the eat rule than for a foot race. */
function speedForLevel(level: number, scale: number) {
  return BASE_SPEED * scale * Math.min(1.06, Math.max(0.78, Math.pow(Math.max(1, level), -0.06)))
}


function turnRateForLevel(level: number) {
  return BASE_TURN_RATE * Math.min(1.15, Math.max(0.42, Math.pow(Math.max(1, level), -0.22)))
}

export function zoomForLevel(level: number) {
  return Math.min(1, Math.max(0.3, 1 / Math.pow(Math.max(1, level), 0.16)))
}

function viewHalfDiagonal(state: GameState) {
  const halfW = state.stageW / 2 / state.zoom
  const halfH = state.stageH / 2 / state.zoom
  return Math.hypot(halfW, halfH)
}

function makeFish(x: number, y: number, level: number, opts?: Partial<Fish>): Fish {
  const ang = Math.random() * Math.PI * 2
  return {
    id: uid(),
    x,
    y,
    level,
    angle: ang,
    tail: Math.random() * Math.PI * 2,
    wander: ang,
    hueJitter: (Math.random() - 0.5) * 16,
    aggressive: false,
    huntTime: 0,
    ...opts,
  }
}

/**
 * How many levels above/below the player the next spawn should be.
 * Danger is common and gets more so over time — this is the challenge.
 * Below the player, small fry and big near-level fish are both common —
 * small fry stay easy filler, a near-level catch is the one worth chasing.
 */
function pickSpawnLevel(playerLevel: number, elapsed: number) {
  const dangerChance = Math.min(0.62, 0.34 + elapsed / 220)
  if (Math.random() < dangerChance) {
    // Most danger is a manageable step above you, but a real and growing
    // share of it is a shark-tier monster — not a rare fluke.
    const sharkChance = Math.min(0.4, 0.1 + elapsed / 240)
    if (Math.random() < sharkChance) {
      return playerLevel + 11 + Math.floor(Math.random() * 12)
    }
    const spread = Math.min(9, 3 + Math.floor(elapsed / 20))
    const magnitude = 1 + Math.floor(Math.random() * spread)
    return playerLevel + magnitude
  }
  const spread = Math.min(7, 2 + Math.floor(elapsed / 25))
  // Skewed low: most food spawns land close to the player's level (a "big"
  // catch), with a long tail out to trivial small fry.
  const magnitude = 1 + Math.floor(Math.random() ** 1.7 * spread)
  return Math.max(1, playerLevel - magnitude)
}

function spawnFish(state: GameState): Fish {
  const level = pickSpawnLevel(state.player.level, state.elapsed)
  const radius = viewHalfDiagonal(state)
  const ringMin = radius * 0.95
  const ringMax = radius * 1.7
  const ring = ringMin + Math.random() * (ringMax - ringMin)
  const angle = Math.random() * Math.PI * 2
  const x = state.player.x + Math.cos(angle) * ring
  const y = state.player.y + Math.sin(angle) * ring
  const dangerous = level > state.player.level
  return makeFish(x, y, level, {
    aggressive: dangerous && Math.random() < 0.65,
  })
}

/** How many enemies the ocean tries to keep stocked — more once there's more to see. */
function targetPopulation(state: GameState) {
  const area = (1 / state.zoom - 1) * 16
  return Math.min(64, 24 + Math.floor(state.elapsed / 7) + Math.floor(area))
}

export const HAZARD_RADIUS = 13

function spawnHazard(state: GameState): Hazard {
  const radius = viewHalfDiagonal(state)
  const ringMin = radius * 0.9
  const ringMax = radius * 1.75
  const ring = ringMin + Math.random() * (ringMax - ringMin)
  const angle = Math.random() * Math.PI * 2
  return {
    id: uid(),
    x: state.player.x + Math.cos(angle) * ring,
    y: state.player.y + Math.sin(angle) * ring,
    bob: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.6,
  }
}

/** Mines are a constant, low-density hazard — not a threat that scales with level. */
function targetHazards(state: GameState) {
  const area = (1 / state.zoom - 1) * 5
  return Math.min(20, 8 + Math.floor(area))
}

function makePlayer(w: number, h: number): Fish {
  return makeFish(w / 2, h / 2, 1)
}

export function createInitialState(w = DESIGN_W, h = DESIGN_H): GameState {
  const scale = designScale(w, h)
  const player = makePlayer(0, 0)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    stageW: w,
    stageH: h,
    scale,
    cameraX: player.x,
    cameraY: player.y,
    zoom: zoomForLevel(player.level),
    player,
    fishes: [],
    hazards: [],
    particles: [],
    floaters: [],
    pointerDir: null,
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
  return { ...state, stageW: w, stageH: h, scale: designScale(w, h) }
}

export function startGame(prev: GameState): GameState {
  const fresh = createInitialState(prev.stageW, prev.stageH)
  fresh.best = Math.max(prev.best, loadBest())
  fresh.phase = 'playing'
  fresh.fishes = Array.from({ length: 22 }, () => spawnFish(fresh))
  fresh.hazards = Array.from({ length: 8 }, () => spawnHazard(fresh))
  return fresh
}

export function setPointerDir(state: GameState, offsetX: number, offsetY: number): GameState {
  return { ...state, pointerDir: { x: offsetX, y: offsetY } }
}

export function clearPointerDir(state: GameState): GameState {
  return { ...state, pointerDir: null }
}

export function setKey(state: GameState, key: keyof GameState['keys'], down: boolean): GameState {
  if (state.keys[key] === down) return state
  return { ...state, keys: { ...state.keys, [key]: down } }
}

/** What the player wants to do this tick: a heading and how hard to swim it. */
function playerDesire(state: GameState): { angle: number; speedFrac: number } | null {
  const { keys } = state
  let dx = 0
  let dy = 0
  if (keys.up) dy -= 1
  if (keys.down) dy += 1
  if (keys.left) dx -= 1
  if (keys.right) dx += 1
  if (dx !== 0 || dy !== 0) {
    return { angle: Math.atan2(dy, dx), speedFrac: 1 }
  }
  if (state.pointerDir) {
    const d = Math.hypot(state.pointerDir.x, state.pointerDir.y)
    if (d < 4) return null
    return {
      angle: Math.atan2(state.pointerDir.y, state.pointerDir.x),
      speedFrac: Math.min(1, d / POINTER_FULL_SPEED_DIST),
    }
  }
  return null
}

function turnToward(current: number, target: number, maxDelta: number) {
  let diff = target - current
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  if (diff > maxDelta) diff = maxDelta
  else if (diff < -maxDelta) diff = -maxDelta
  return current + diff
}

function integrate(
  f: Fish,
  desire: { angle: number; speedFrac: number } | null,
  dt: number,
  scale: number,
  speedMult = 1,
) {
  const speed = speedForLevel(f.level, scale) * speedMult
  const turnRate = turnRateForLevel(f.level)
  const speedFrac = desire?.speedFrac ?? 0

  if (desire && speedFrac > 0.02) {
    f.angle = turnToward(f.angle, desire.angle, turnRate * dt)
    const vx = Math.cos(f.angle) * speed * speedFrac
    const vy = Math.sin(f.angle) * speed * speedFrac
    f.x += vx * dt
    f.y += vy * dt
    f.tail += dt * (4 + speed * speedFrac * 0.02)
  } else {
    f.tail += dt * 2
  }
}

function wanderDesire(f: Fish, dt: number): { angle: number; speedFrac: number } {
  f.wander += (Math.random() - 0.5) * dt * 2.2
  return { angle: f.wander, speedFrac: 0.55 }
}

function aiDesire(
  f: Fish,
  player: Fish,
  dt: number,
  scale: number,
  huntingAllowed: boolean,
): { angle: number; speedFrac: number } {
  const d = dist(f.x, f.y, player.x, player.y)
  const r = radiusForLevel(f.level, scale)
  const playerIsFood = player.level >= f.level
  const playerIsThreat = f.level > player.level
  if (playerIsFood && d < r * 2 + 34) {
    const angle = Math.atan2(f.y - player.y, f.x - player.x)
    // A fish near your own level is worth more and fights harder for it —
    // small fry barely bother fleeing, a near-equal catch is a real chase.
    // Always capped under 1: you have no blanket speed edge any more, so a
    // fleeing fish must never out-run its own predator's top speed.
    const speedFrac = 0.55 + catchCloseness(player.level, f.level) * 0.33
    return { angle, speedFrac }
  }
  if (huntingAllowed && playerIsThreat && f.aggressive && d < r * 11 + 190) {
    const angle = Math.atan2(player.y - f.y, player.x - f.x)
    // A real lunge at first — an aggressive hunter should be a genuine
    // threat — but it tires: run for a few seconds and it drops below your
    // own speed, so a chase is always survivable if you react and commit.
    f.huntTime += dt
    const speedFrac = Math.max(0.82, 1.22 - f.huntTime * 0.075)
    return { angle, speedFrac }
  }
  f.huntTime = Math.max(0, f.huntTime - dt * 2)
  return wanderDesire(f, dt)
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
    hazards: [...state.hazards],
    particles: [...state.particles],
    floaters: [...state.floaters],
  }
  s.elapsed += dt
  s.invuln = Math.max(0, s.invuln - dt)
  s.flash = Math.max(0, s.flash - dt * 1.6)
  s.shake = Math.max(0, s.shake - dt * 3)

  integrate(s.player, playerDesire(s), dt, s.scale)

  const huntingAllowed = s.invuln <= 0
  for (const f of s.fishes) {
    integrate(f, aiDesire(f, s.player, dt, s.scale, huntingAllowed), dt, s.scale)
  }

  // Camera: tight follow, with zoom easing out as the player levels up.
  s.cameraX += (s.player.x - s.cameraX) * Math.min(1, dt * 10)
  s.cameraY += (s.player.y - s.cameraY) * Math.min(1, dt * 10)
  const targetZoom = zoomForLevel(s.player.level)
  s.zoom += (targetZoom - s.zoom) * Math.min(1, dt * 1.6)

  const playerRadius = radiusForLevel(s.player.level, s.scale)
  const survivors: Fish[] = []
  let ate = false
  for (const f of s.fishes) {
    const d = dist(f.x, f.y, s.player.x, s.player.y)
    const fRadius = radiusForLevel(f.level, s.scale)
    if (d < fRadius + playerRadius) {
      if (s.player.level >= f.level) {
        const points = f.level * 10
        const weight = catchCloseness(s.player.level, f.level)
        // Growth tracks the fish's own number, not yours — a "1" is always
        // a nibble and a "30" is always a real meal, whatever level you're
        // at. (A flat +1 regardless of size read as broken: eating a fish
        // labeled 1 could jump you several levels just because you were
        // also low-level yourself.)
        const growth = Math.max(1, Math.round(Math.log2(f.level + 1)))
        s.score += points
        s.player.level += growth
        spawnBurst(s, f.x, f.y, 172, 10 + Math.round(weight * 10))
        s.floaters.push({
          x: f.x,
          y: f.y - fRadius - 10,
          text: `+${points}`,
          sub: `Level +${growth}`,
          life: 1,
          maxLife: 1.6,
          weight,
        })
        ate = true
        continue
      }
      if (s.invuln <= 0) {
        endRun(s, s.player.x, s.player.y)
        return s
      }
    }
    survivors.push(f)
  }
  if (ate) sfx('eat')
  s.fishes = survivors

  // Mines don't care about your level — touch one and the run ends.
  for (const hz of s.hazards) {
    hz.bob += dt
    hz.x += Math.cos(hz.bob * 0.6) * 4 * dt
    hz.y += Math.sin(hz.bob * 0.5) * 4 * dt
    if (s.invuln <= 0 && dist(hz.x, hz.y, s.player.x, s.player.y) < HAZARD_RADIUS * s.scale + playerRadius) {
      endRun(s, s.player.x, s.player.y)
      return s
    }
  }

  // Keep the ocean stocked near the camera, and let stragglers drift out of memory.
  const despawnRadius = viewHalfDiagonal(s) * 2.2
  s.fishes = s.fishes.filter((f) => dist(f.x, f.y, s.player.x, s.player.y) < despawnRadius)
  s.hazards = s.hazards.filter((hz) => dist(hz.x, hz.y, s.player.x, s.player.y) < despawnRadius)
  if (s.hazards.length < targetHazards(s) && Math.random() < dt * 0.6) {
    const spot = spawnHazard(s)
    const tooClose =
      s.hazards.some((hz) => dist(hz.x, hz.y, spot.x, spot.y) < HAZARD_RADIUS * s.scale * 6) ||
      dist(spot.x, spot.y, s.player.x, s.player.y) < 220 * s.scale
    if (!tooClose) s.hazards.push(spot)
  }

  s.spawnTimer -= dt
  const target = targetPopulation(s)
  if (s.spawnTimer <= 0 && s.fishes.length < target) {
    s.spawnTimer = SPAWN_INTERVAL
    // Catch up in batches when well under target, and retry a crowded ring
    // spot a few times instead of just giving up on the whole interval.
    const needed = Math.min(4, target - s.fishes.length)
    for (let n = 0; n < needed; n++) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const spot = spawnFish(s)
        const tooClose = s.fishes.some((f) => dist(f.x, f.y, spot.x, spot.y) < MIN_SPAWN_GAP)
        if (!tooClose) {
          s.fishes.push(spot)
          break
        }
      }
    }
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

  // Matches (and slightly exceeds) the aggressive hunt trigger range, so the
  // warning always lands before a hunter actually commits to the chase.
  s.danger = s.fishes.some(
    (f) =>
      f.level > s.player.level &&
      dist(f.x, f.y, s.player.x, s.player.y) < radiusForLevel(f.level, s.scale) * 12 + 210,
  )

  return s
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    level: s.player.level,
    danger: s.danger,
  }
}
