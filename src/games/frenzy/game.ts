import { PALETTE } from '../../data/games'
import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'
import {
  EVOLUTION,
  SPECIES,
  pickWeighted,
  speciesInZone,
  stageFor,
  withArticle,
  type SpeciesId,
} from './species'
import {
  START_X,
  START_Y,
  ZONES,
  clearOfRocks,
  rocksNear,
  zoneAt,
  zoneIndexAt,
  type Rock,
} from './world'

/*
 * Frenzy: every fish carries a number, and you can eat any fish whose number
 * is no bigger than yours. Each catch grows you by about an eighteenth of
 * what you ate, and catches in quick succession build a combo — eight in a row is
 * a frenzy, worth double.
 *
 * The ocean has a surface and no floor. Deeper zones pay more per fish and
 * bring bigger predators, jellyfish that stun and mines that go off, so how
 * deep to swim is the decision a run keeps making. Predators that hunt you
 * say so first — a "!" and a red stare — then lunge, and tire if you keep
 * running. A dash (click, tap, or Space) is the answer to most of it.
 *
 * Everything here is in world units; the renderer turns them into pixels.
 */

export type Phase = 'menu' | 'playing' | 'dying' | 'gameover'

export type FishState = 'cruise' | 'flee' | 'alert' | 'lunge' | 'rest' | 'windup' | 'strike' | 'leave'

export type Fish = {
  id: number
  species: SpeciesId
  level: number
  x: number
  y: number
  /** Where it is facing. */
  angle: number
  /** Where it would like to go when nothing else is on its mind. */
  heading: number
  speed: number
  /** Knockback, decaying. */
  kx: number
  ky: number
  swim: number
  /** -1..1, eased: which way up it is drawn, so a fish turning round rolls over instead of flipping. */
  roll: number
  state: FishState
  stateTime: number
  huntTime: number
  aggressive: boolean
  school: number
  puff: number
  mouth: number
  seed: number
  fade: number
  /** Golden fish: seconds until it gives up and swims off. */
  life: number
  targetX: number
  targetY: number
  /** Patrollers: seconds to the next change of course. */
  nextTurn: number
}

export type Player = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  speed: number
  kx: number
  ky: number
  swim: number
  roll: number
  level: number
  mouth: number
  gulp: number
  dash: number
  dashCd: number
  stun: number
  stingGuard: number
  shield: boolean
  invuln: number
  stage: number
}

export type Jelly = { id: number; x: number; y: number; r: number; phase: number; hue: number; drift: number; fade: number }
export type Mine = { id: number; x: number; y: number; r: number; bob: number; fuse: number; fade: number }
export type Pickup = { id: number; x: number; y: number; r: number; bob: number; life: number }
export type Blast = { id: number; x: number; y: number; r: number; life: number }

export type ParticleKind = 'bubble' | 'spark' | 'bit'
export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  kind: ParticleKind
}

export type Floater = {
  x: number
  y: number
  text: string
  sub: string
  life: number
  maxLife: number
  weight: number
  color: string
}

export type Banner = { text: string; sub: string; color: string; life: number; maxLife: number }

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  level: number
  danger: boolean
  mult: number
  deathCause: string
}

export type GameState = {
  phase: Phase
  seed: number
  score: number
  best: number
  stageW: number
  stageH: number
  /** Pixels per world unit at zoom 1, from the stage size. */
  scale: number
  cameraX: number
  cameraY: number
  zoom: number
  /** Seconds since the page opened — for animation, in every phase. */
  time: number
  /** Seconds into this run. */
  elapsed: number
  player: Player
  fishes: Fish[]
  jellies: Jelly[]
  mines: Mine[]
  pickups: Pickup[]
  blasts: Blast[]
  particles: Particle[]
  floaters: Floater[]
  banners: Banner[]
  pointerDir: { x: number; y: number } | null
  keys: { up: boolean; down: boolean; left: boolean; right: boolean }
  /** A dash waiting for the next tick: an angle to dash along, or NaN for straight ahead. */
  dashQueued: number | null
  combo: number
  comboTimer: number
  bestCombo: number
  frenzy: boolean
  /** 0..1, eased: how much something is coming for you right now. */
  danger: number
  flash: number
  flashColor: string
  shake: number
  zoneIndex: number
  deepestZone: number
  zoneBannerCd: number
  spawnTimer: number
  schoolTimer: number
  hazardTimer: number
  pickupTimer: number
  goldenTimer: number
  growlCd: number
  /** Breathing room after an attack ends before another may begin. */
  attackCd: number
  deathCause: string
  dying: number
  killerId: number
  nextSchool: number
  eaten: number
}

const BASE_RADIUS = 15
const RADIUS_EXP = 0.45
/**
 * How fast the camera pulls back as you grow. Against RADIUS_EXP this leaves
 * your fish growing on screen as about level^0.22: 1.7× by level 10, 2.8× by
 * 100 — visibly bigger, never filling the screen.
 */
const ZOOM_EXP = 0.23
const MIN_ZOOM = 0.16
const BASE_SPEED = 205
const PLAYER_TURN = 7.2
/** Pointer this close to the middle of the screen (px): hold still. */
const POINTER_DEAD_ZONE = 16
/** Pointer this far past the dead zone (px): full speed. */
const POINTER_FULL_SPEED_DIST = 55
const START_INVULN = 2
const DASH_TIME = 0.3
export const DASH_COOLDOWN = 1.6
const DASH_BOOST = 2.6
/** The first instant of a dash slips a bite — time it right and the jaws close on water. */
const DASH_DODGE = 0.12
const STUN_TIME = 0.95
export const COMBO_WINDOW = 2.6
export const FRENZY_AT = 8
/** No predators for the first stretch of a run — learn to swim first. */
const GRACE = 15
const ALERT_TIME = 0.6
/** A patroller that turns to charge you stops and stares this long first. */
const CHARGE_WINDUP = 0.55
const CHARGE_TIME = 1.9
/** Of what it eats, how much you grow: about a twentieth, so size is earned over a run. */
const GROWTH_RATE = 0.055
/**
 * At most this many predators winding up or attacking at once. More than two
 * at a time stopped reading as a threat to dodge and started reading as a
 * pile-on nobody could have got out of.
 */
const MAX_ATTACKERS = 2
const ATTACK_BREATHER = 0.7
const WINDUP_TIME = 0.42
const STRIKE_TIME = 0.45
const MINE_FUSE = 0.85
const MINE_BASE = 17
const JELLY_BASE = 21
const PICKUP_BASE = 17
const DYING_TIME = 1.5
const MAX_PARTICLES = 420

export const DESIGN_W = 960
export const DESIGN_H = 540
const REF_SHORT = 540

let nextId = 1
function uid() {
  return nextId++
}

function rand(a = 0, b = 1) {
  return a + Math.random() * (b - a)
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

function turnToward(current: number, target: number, maxDelta: number) {
  let diff = target - current
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  if (diff > maxDelta) diff = maxDelta
  else if (diff < -maxDelta) diff = -maxDelta
  return current + diff
}

export function radiusForLevel(level: number) {
  return BASE_RADIUS * Math.pow(Math.max(1, level), RADIUS_EXP)
}

export function zoomForLevel(level: number) {
  return Math.max(MIN_ZOOM, Math.min(1, Math.pow(Math.max(1, level), -ZOOM_EXP)))
}

/** Everything's speed grows with you, so the screen never feels slower as you grow. */
function worldScale(level: number) {
  return 1 / zoomForLevel(level)
}

/** Obstacles are dealt at your size, so a mine is never a speck and never a wall. */
function sizeScale(level: number) {
  return radiusForLevel(level) / BASE_RADIUS
}

export function fishRadius(f: Fish) {
  return radiusForLevel(f.level) * (1 + 0.32 * f.puff)
}

export function pixelsPerUnit(s: GameState) {
  return s.scale * s.zoom
}

export function viewHalf(s: GameState) {
  const ppu = pixelsPerUnit(s)
  return { w: s.stageW / 2 / ppu, h: s.stageH / 2 / ppu }
}

function viewDiag(s: GameState) {
  const v = viewHalf(s)
  return Math.hypot(v.w, v.h)
}

export function comboMultiplier(combo: number) {
  return 1 + 0.2 * (Math.min(combo, 11) - 1)
}

function preyLevel(L: number) {
  const f = 0.3 + 0.7 * Math.pow(Math.random(), 0.7)
  return Math.max(1, Math.min(L, Math.round(L * f)))
}

function predatorLevel(L: number, reach: number) {
  const f = 1.12 + (reach - 1.12) * Math.pow(Math.random(), 1.6)
  return Math.max(L + 1, Math.round(L * f))
}

function makePlayer(): Player {
  return {
    x: START_X,
    y: START_Y,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0,
    kx: 0,
    ky: 0,
    swim: 0,
    roll: 1,
    level: 1,
    mouth: 0,
    gulp: 0,
    dash: 0,
    dashCd: 0,
    stun: 0,
    stingGuard: 0,
    shield: false,
    invuln: START_INVULN,
    stage: 0,
  }
}

function makeFish(s: GameState, species: SpeciesId, level: number, x: number, y: number, opts?: Partial<Fish>): Fish {
  const toward = Math.atan2(s.cameraY - y, s.cameraX - x) + rand(-0.7, 0.7)
  return {
    id: uid(),
    species,
    level,
    x,
    y,
    angle: toward,
    heading: toward,
    speed: 0,
    kx: 0,
    ky: 0,
    swim: rand(0, Math.PI * 2),
    roll: Math.cos(toward) >= 0 ? 1 : -1,
    state: 'cruise',
    stateTime: 0,
    huntTime: 0,
    aggressive: false,
    school: 0,
    puff: 0,
    mouth: 0,
    seed: Math.floor(Math.random() * 1e9),
    fade: 0,
    life: 0,
    targetX: 0,
    targetY: 0,
    nextTurn: rand(2, 5),
    ...opts,
  }
}

/** A point just off screen, below the surface and clear of rock. */
function ringPoint(s: GameState, minF: number, maxF: number, clearance = 40) {
  const diag = viewDiag(s)
  for (let tries = 0; tries < 10; tries++) {
    const a = rand(0, Math.PI * 2)
    const d = diag * rand(minF, maxF)
    const x = s.cameraX + Math.cos(a) * d
    const y = s.cameraY + Math.sin(a) * d
    if (y < 90 + clearance) continue
    if (!clearOfRocks(s.seed, x, y, clearance, 30)) continue
    return { x, y }
  }
  return null
}

/** A point on screen, away from the player — only for filling the ocean when a run starts. */
function viewPoint(s: GameState, clearance: number) {
  const v = viewHalf(s)
  for (let tries = 0; tries < 12; tries++) {
    const x = s.cameraX + rand(-v.w, v.w) * 0.95
    const y = s.cameraY + rand(-v.h, v.h) * 0.95
    if (y < 90 + clearance) continue
    if (dist(x, y, s.player.x, s.player.y) < 190 + clearance) continue
    if (!clearOfRocks(s.seed, x, y, clearance, 30)) continue
    return { x, y }
  }
  return null
}

/** Levels are dealt around yours; the start card's ocean just gets a spread of small ones. */
function spawnBase(s: GameState) {
  return s.phase === 'menu' ? 1 + Math.floor(rand(0, 6)) : s.player.level
}

/** Speeds scale with the player; before a run there is no player to scale with. */
function speedScale(s: GameState) {
  return s.phase === 'menu' ? 1 : worldScale(s.player.level)
}

function spawnSolo(s: GameState, where: { x: number; y: number } | null, forcePrey: boolean) {
  if (!where) return
  const zone = zoneAt(where.y)
  const L = spawnBase(s)
  const ramp = Math.min(1, Math.max(0, s.elapsed - GRACE) / 150)
  const graceOver = s.phase !== 'playing' || s.elapsed >= GRACE
  const dangerChance = forcePrey || !graceOver ? 0 : zone.danger + zone.dangerRamp * ramp
  if (Math.random() < dangerChance) {
    const spec = pickWeighted(speciesInZone('predator', zone.id), Math.random())
    if (!spec) return
    const aggressive =
      spec.behavior === 'chaser' && Math.random() < Math.min(0.88, zone.aggressive + 0.12 * ramp)
    s.fishes.push(makeFish(s, spec.id, predatorLevel(L, zone.reach), where.x, where.y, { aggressive }))
    return
  }
  const spec = pickWeighted(speciesInZone('prey', zone.id), Math.random())
  if (!spec) return
  s.fishes.push(makeFish(s, spec.id, preyLevel(L), where.x, where.y))
}

function spawnSchool(s: GameState, where: { x: number; y: number } | null) {
  if (!where) return
  const zone = zoneAt(where.y)
  const spec = speciesInZone('prey', zone.id, 'school')[0]
  if (!spec) return
  const L = s.phase === 'menu' ? 3 : s.player.level
  const level = Math.max(1, Math.round(L * rand(0.35, 0.75)))
  const count = 6 + Math.floor(rand(0, 6))
  const id = ++s.nextSchool
  const heading = Math.atan2(s.cameraY - where.y, s.cameraX - where.x) + rand(-0.6, 0.6)
  const spread = radiusForLevel(level) * 4
  for (let i = 0; i < count; i++) {
    const x = where.x + rand(-spread, spread)
    const y = Math.max(120, where.y + rand(-spread, spread) * 0.6)
    const lv = Math.max(1, Math.min(L, level + Math.round(rand(-1, 1))))
    s.fishes.push(makeFish(s, spec.id, lv, x, y, { school: id, heading, angle: heading }))
  }
}

function spawnGolden(s: GameState) {
  const where = ringPoint(s, 1.0, 1.2)
  if (!where) return
  const level = Math.max(1, Math.round(s.player.level * 0.5))
  s.fishes.push(makeFish(s, 'goldfish', level, where.x, where.y, { life: 16 }))
  banner(s, 'Golden fish!', 'Faster than you — dash to catch it', '#ffcf4a', 2.4)
  sfx('wave')
}

function spawnJelly(s: GameState) {
  const where = ringPoint(s, 1.05, 1.5, 60)
  if (!where) return
  if (zoneAt(where.y).jellies <= 0) return
  const hues = [292, 322, 192, 252]
  s.jellies.push({
    id: uid(),
    x: where.x,
    y: where.y,
    r: JELLY_BASE * sizeScale(s.player.level) * rand(0.8, 1.3),
    phase: rand(0, Math.PI * 2),
    hue: hues[Math.floor(rand(0, hues.length))]!,
    drift: rand(-1, 1),
    fade: 0,
  })
}

function spawnMine(s: GameState) {
  const where = ringPoint(s, 1.05, 1.5, 80)
  if (!where) return
  if (zoneAt(where.y).mines <= 0) return
  const r = MINE_BASE * sizeScale(s.player.level) * rand(0.9, 1.15)
  for (const m of s.mines) if (dist(m.x, m.y, where.x, where.y) < (m.r + r) * 4) return
  s.mines.push({ id: uid(), x: where.x, y: where.y, r, bob: rand(0, Math.PI * 2), fuse: -1, fade: 0 })
}

function spawnPickup(s: GameState) {
  const where = ringPoint(s, 0.75, 1.1, 30)
  if (!where) return
  s.pickups.push({ id: uid(), x: where.x, y: where.y, r: PICKUP_BASE * sizeScale(s.player.level), bob: 0, life: 30 })
}

function banner(s: GameState, text: string, sub: string, color: string, life = 2) {
  if (s.banners.length >= 3) s.banners.shift()
  s.banners.push({ text, sub, color, life, maxLife: life })
}

function emit(
  s: GameState,
  kind: ParticleKind,
  x: number,
  y: number,
  count: number,
  speed: number,
  size: number,
  color: string,
  life = 0.7,
) {
  const ws = speedScale(s)
  const room = MAX_PARTICLES - s.particles.length
  const n = Math.min(count, Math.max(0, room))
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2)
    const v = speed * rand(0.35, 1) * ws
    s.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - (kind === 'bubble' ? 20 * ws : 0),
      life: 1,
      maxLife: life * rand(0.7, 1.3),
      size: size * rand(0.6, 1.3) * sizeScale(s.player.level),
      color,
      kind,
    })
  }
}

export function createInitialState(w = DESIGN_W, h = DESIGN_H): GameState {
  const s: GameState = {
    phase: 'menu',
    seed: Math.floor(Math.random() * 1e9),
    score: 0,
    best: loadBest(),
    stageW: w,
    stageH: h,
    scale: designScale(w, h),
    cameraX: START_X,
    cameraY: START_Y + 120,
    zoom: 1,
    time: 0,
    elapsed: 0,
    player: makePlayer(),
    fishes: [],
    jellies: [],
    mines: [],
    pickups: [],
    blasts: [],
    particles: [],
    floaters: [],
    banners: [],
    pointerDir: null,
    keys: { up: false, down: false, left: false, right: false },
    dashQueued: null,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    frenzy: false,
    danger: 0,
    flash: 0,
    flashColor: '#ff4b3e',
    shake: 0,
    zoneIndex: 0,
    deepestZone: 0,
    zoneBannerCd: 0,
    spawnTimer: 0,
    schoolTimer: 0,
    hazardTimer: 0,
    pickupTimer: rand(26, 38),
    goldenTimer: rand(32, 48),
    growlCd: 0,
    attackCd: 0,
    deathCause: '',
    dying: 0,
    killerId: 0,
    nextSchool: 0,
    eaten: 0,
  }
  for (let i = 0; i < 10; i++) spawnSolo(s, viewPoint(s, 30), false)
  spawnSchool(s, viewPoint(s, 60))
  return s
}

export function resizeState(state: GameState, w: number, h: number): GameState {
  if (w <= 0 || h <= 0) return state
  return { ...state, stageW: w, stageH: h, scale: designScale(w, h) }
}

export function startGame(prev: GameState): GameState {
  const s = createInitialState(prev.stageW, prev.stageH)
  s.fishes = []
  s.best = Math.max(prev.best, loadBest())
  s.phase = 'playing'
  s.cameraX = s.player.x
  s.cameraY = s.player.y
  clampCamera(s)
  for (let i = 0; i < 9; i++) spawnSolo(s, viewPoint(s, 30), true)
  for (let i = 0; i < 6; i++) spawnSolo(s, ringPoint(s, 1.05, 1.4), true)
  spawnSchool(s, viewPoint(s, 60))
  spawnSchool(s, ringPoint(s, 1.1, 1.3))
  return s
}

export function setPointerDir(state: GameState, offsetX: number, offsetY: number): GameState {
  return { ...state, pointerDir: { x: offsetX, y: offsetY } }
}

export function clearPointerDir(state: GameState): GameState {
  return { ...state, pointerDir: null }
}

/** Let go of everything: the window lost focus, so no key-up is coming. */
export function releaseInput(state: GameState): GameState {
  return { ...state, pointerDir: null, keys: { up: false, down: false, left: false, right: false } }
}

export function setKey(state: GameState, key: keyof GameState['keys'], down: boolean): GameState {
  if (state.keys[key] === down) return state
  return { ...state, keys: { ...state.keys, [key]: down } }
}

/** Dash along `angle`, or straight ahead if none is given. */
export function requestDash(state: GameState, angle?: number): GameState {
  if (state.phase !== 'playing') return state
  return { ...state, dashQueued: angle ?? Number.NaN }
}

function playerDesire(s: GameState): { angle: number; frac: number } | null {
  const { keys } = s
  let dx = 0
  let dy = 0
  if (keys.up) dy -= 1
  if (keys.down) dy += 1
  if (keys.left) dx -= 1
  if (keys.right) dx += 1
  if (dx !== 0 || dy !== 0) return { angle: Math.atan2(dy, dx), frac: 1 }
  if (s.pointerDir) {
    const d = Math.hypot(s.pointerDir.x, s.pointerDir.y)
    // A resting fish sits in the middle of the screen, so a pointer on it means stay.
    if (d < POINTER_DEAD_ZONE) return null
    return {
      angle: Math.atan2(s.pointerDir.y, s.pointerDir.x),
      frac: Math.min(1, (d - POINTER_DEAD_ZONE) / POINTER_FULL_SPEED_DIST),
    }
  }
  return null
}

function clampCamera(s: GameState) {
  const v = viewHalf(s)
  // At most about a seventh of the screen is ever sky.
  s.cameraY = Math.max(s.cameraY, v.h * 0.72)
}

/** Steer away from rock, jellyfish, mines and the surface. */
function avoidance(s: GameState, x: number, y: number, r: number, rocks: Rock[], avoidHazards: boolean) {
  let ax = 0
  let ay = 0
  for (const rock of rocks) {
    const d = dist(x, y, rock.x, rock.y)
    const gap = d - rock.r - r
    if (gap < 110 && d > 0.001) {
      const w = Math.min(1.6, 1 - gap / 110) * 2.2
      ax += ((x - rock.x) / d) * w
      ay += ((y - rock.y) / d) * w
    }
  }
  if (avoidHazards) {
    for (const j of s.jellies) {
      const d = dist(x, y, j.x, j.y + j.r * 0.6)
      const gap = d - j.r * 1.6 - r
      if (gap < 70 && d > 0.001) {
        const w = Math.min(1.5, 1 - gap / 70) * 1.6
        ax += ((x - j.x) / d) * w
        ay += ((y - j.y - j.r * 0.6) / d) * w
      }
    }
    for (const m of s.mines) {
      const d = dist(x, y, m.x, m.y)
      const gap = d - m.r * 1.6 - r
      if (gap < 80 && d > 0.001) {
        const w = Math.min(1.5, 1 - gap / 80) * 1.8
        ax += ((x - m.x) / d) * w
        ay += ((y - m.y) / d) * w
      }
    }
  }
  if (y < r + 150) ay += (1 - Math.max(0, y - r) / 150) * 2.4
  return { ax, ay }
}

function pushOutOfRocks(obj: { x: number; y: number }, r: number, rocks: Rock[]) {
  for (const rock of rocks) {
    const d = dist(obj.x, obj.y, rock.x, rock.y)
    const min = rock.r + r
    if (d < min && d > 0.001) {
      obj.x = rock.x + ((obj.x - rock.x) / d) * min
      obj.y = rock.y + ((obj.y - rock.y) / d) * min
    }
  }
}

type SchoolInfo = { cx: number; cy: number; hx: number; hy: number; members: Fish[]; fleeing: boolean }

type AttackSlots = { active: number }

function isAttacking(f: Fish) {
  return f.state === 'alert' || f.state === 'lunge' || f.state === 'windup' || f.state === 'strike'
}

function updateFish(
  s: GameState,
  f: Fish,
  dt: number,
  rocks: Rock[],
  schools: Map<number, SchoolInfo>,
  slots: AttackSlots,
) {
  const spec = SPECIES[f.species]
  const p = s.player
  const alive = s.phase === 'playing'
  const r = fishRadius(f)
  const pr = radiusForLevel(p.level)
  const ws = speedScale(s)
  f.stateTime += dt
  f.fade = Math.min(1, f.fade + dt * 2.2)

  const dx = p.x - f.x
  const dy = p.y - f.y
  const d = Math.hypot(dx, dy)
  const toPlayer = Math.atan2(dy, dx)
  const edible = alive && p.level >= f.level
  const threat = alive && f.level > p.level

  let desired = f.heading
  let frac = 0.5
  let turn = spec.behavior === 'patroller' ? 1.6 : spec.behavior === 'chaser' ? 3.2 : 6
  let mouth = 0
  let avoidWeight = 1
  let puffTarget = 0

  const cruise = () => {
    if (spec.behavior === 'school' && f.school) {
      const info = schools.get(f.school)
      if (info && info.members.length > 1) {
        let vx = info.hx
        let vy = info.hy
        const cd = Math.hypot(info.cx - f.x, info.cy - f.y)
        const reach = r * 7
        if (cd > 0.001) {
          const k = Math.min(1, cd / reach) * 0.9
          vx += ((info.cx - f.x) / cd) * k
          vy += ((info.cy - f.y) / cd) * k
        }
        for (const m of info.members) {
          if (m === f) continue
          const md = dist(f.x, f.y, m.x, m.y)
          const near = r * 2.6
          if (md < near && md > 0.001) {
            const k = (1 - md / near) * 1.7
            vx += ((f.x - m.x) / md) * k
            vy += ((f.y - m.y) / md) * k
          }
        }
        f.heading += rand(-1, 1) * dt * 1.1
        vx += Math.cos(f.heading) * 0.3
        vy += Math.sin(f.heading) * 0.3
        desired = Math.atan2(vy, vx)
        frac = 0.62
        return
      }
    }
    if (spec.behavior === 'patroller') {
      f.nextTurn -= dt
      if (f.nextTurn <= 0) {
        f.nextTurn = rand(2.8, 6)
        f.heading += (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 2)
      }
      desired = f.heading
      frac = 1
      mouth = 0.15
      return
    }
    if (spec.behavior === 'ambusher') {
      f.heading += rand(-1, 1) * dt * 0.6
      desired = f.heading
      frac = 0.14
      return
    }
    f.heading += rand(-1, 1) * dt * 1.6
    desired = f.heading
    frac = spec.behavior === 'golden' ? 0.75 : 0.48
  }

  if (spec.behavior === 'golden') {
    f.life -= dt
    if (f.state !== 'leave' && (f.life <= 0 || !alive)) {
      f.state = 'leave'
      f.stateTime = 0
    }
    if (f.state === 'leave') {
      desired = Math.atan2(f.y - s.cameraY, f.x - s.cameraX)
      frac = 1
    } else if (d < r * 3 + pr + 210) {
      desired = toPlayer + Math.PI
      frac = 1
      turn = 6.5
    } else {
      cruise()
    }
  } else if (edible) {
    // Anything you can eat runs — the bigger it is next to you, the harder.
    const fleeR = r * 2 + pr + 70
    const schoolFleeing = f.school ? schools.get(f.school)?.fleeing : false
    if (d < fleeR || (schoolFleeing && d < fleeR * 1.6)) {
      if (f.state !== 'flee') {
        f.state = 'flee'
        f.stateTime = 0
      }
    }
    if (f.state === 'flee') {
      if (d > fleeR * 1.7 && f.stateTime > 0.6) {
        f.state = 'cruise'
        f.stateTime = 0
        cruise()
      } else {
        desired = toPlayer + Math.PI
        const closeness = Math.min(1, f.level / p.level)
        frac = 0.56 + 0.3 * closeness
        turn = 7
        if (f.species === 'puffer') {
          puffTarget = 1
          frac = 0.5
        }
      }
    } else {
      if (f.state !== 'cruise') {
        f.state = 'cruise'
        f.stateTime = 0
      }
      cruise()
    }
  } else if (threat) {
    const noticeR = r * 2.6 + pr + 130
    const giveUpR = noticeR * 1.9
    const beginAttack = (state: FishState) => {
      f.state = state
      f.stateTime = 0
      slots.active += 1
      if (s.growlCd <= 0) {
        sfx('miss')
        s.growlCd = 1.2
      }
    }
    const endAttack = (state: FishState) => {
      f.state = state
      f.stateTime = 0
      s.attackCd = ATTACK_BREATHER
    }
    const mayAttack = () => slots.active < MAX_ATTACKERS && s.attackCd <= 0
    switch (spec.behavior) {
      case 'chaser': {
        if (f.state === 'cruise' || f.state === 'flee') {
          if (f.state === 'flee') f.state = 'cruise'
          cruise()
          if (f.aggressive && d < noticeR && p.stun <= 0.5 && mayAttack()) beginAttack('alert')
        } else if (f.state === 'alert') {
          desired = toPlayer
          frac = 0.1
          turn = 5
          mouth = 0.45
          if (d > giveUpR) {
            endAttack('cruise')
          } else if (f.stateTime > ALERT_TIME) {
            f.state = 'lunge'
            f.stateTime = 0
            f.huntTime = 0
          }
        } else if (f.state === 'lunge') {
          f.huntTime += dt
          const lead = 0.18
          desired = Math.atan2(p.y + p.vy * lead - f.y, p.x + p.vx * lead - f.x)
          frac = Math.max(0.78, 1.3 - f.huntTime * 0.15)
          turn = 2.7
          mouth = 1
          avoidWeight = 0.6
          if (d > giveUpR || f.huntTime > 3.8) endAttack('rest')
        } else {
          desired = toPlayer + Math.PI * 0.65
          frac = 0.32
          if (f.stateTime > 2.2) {
            f.state = 'cruise'
            f.stateTime = 0
          }
        }
        break
      }
      case 'patroller': {
        // Cruises in long straight runs; now and then turns to charge you,
        // but always stops and stares first, and never steers mid-charge.
        if (f.state === 'alert') {
          desired = toPlayer
          frac = 0.15
          turn = 4.5
          mouth = 0.45
          if (f.stateTime > CHARGE_WINDUP) {
            f.state = 'lunge'
            f.stateTime = 0
            f.heading = toPlayer
          }
        } else if (f.state === 'lunge') {
          desired = f.heading
          frac = 1.42
          turn = 0.45
          mouth = 1
          avoidWeight = 0.5
          if (f.stateTime > CHARGE_TIME) {
            endAttack('cruise')
            f.nextTurn = rand(2.5, 5)
          }
        } else {
          if (f.state !== 'cruise') {
            f.state = 'cruise'
            f.stateTime = 0
          }
          const before = f.nextTurn
          cruise()
          const turned = before > 0 && f.nextTurn > before
          if (turned && d < noticeR * 1.6 && Math.random() < 0.35 && mayAttack()) beginAttack('alert')
        }
        break
      }
      case 'ambusher': {
        const strikeR = r * 2.4 + pr + 70
        if (f.state === 'cruise' || f.state === 'flee') {
          if (f.state === 'flee') f.state = 'cruise'
          cruise()
          if (d < strikeR && mayAttack()) beginAttack('windup')
        } else if (f.state === 'windup') {
          desired = toPlayer
          frac = 0
          turn = 6
          mouth = Math.min(1, f.stateTime / WINDUP_TIME)
          // Its aim is fixed before the lure's last flare, so moving then works.
          if (f.stateTime < WINDUP_TIME * 0.6) {
            f.targetX = p.x
            f.targetY = p.y
          }
          if (f.stateTime > WINDUP_TIME) {
            f.state = 'strike'
            f.stateTime = 0
            f.heading = Math.atan2(f.targetY - f.y, f.targetX - f.x)
            f.angle = f.heading
            f.speed = BASE_SPEED * ws * spec.speed * 2.6
          }
        } else if (f.state === 'strike') {
          desired = f.heading
          frac = 2.6
          turn = 0.15
          mouth = 1
          avoidWeight = 0
          if (f.stateTime > STRIKE_TIME) endAttack('rest')
        } else {
          frac = 0.08
          mouth = 0.3
          if (f.stateTime > 2.4) {
            f.state = 'cruise'
            f.stateTime = 0
          }
        }
        break
      }
      default:
        if (f.state !== 'cruise') {
          f.state = 'cruise'
          f.stateTime = 0
        }
        cruise()
    }
  } else {
    if (f.state !== 'cruise' && f.state !== 'leave') {
      f.state = 'cruise'
      f.stateTime = 0
    }
    cruise()
  }

  if (avoidWeight > 0) {
    let { ax, ay } = avoidance(s, f.x, f.y, r, rocks, spec.behavior !== 'ambusher')
    // A bigger fish that isn't hunting you swims round you rather than
    // through you: touching one is still fatal, but only by your own doing.
    if (threat && !isAttacking(f) && d > 0.001 && d < (r + pr) * 3.2) {
      const ahead = ((p.x - f.x) * Math.cos(f.angle) + (p.y - f.y) * Math.sin(f.angle)) / d
      if (ahead > -0.2) {
        const w = (1 - d / ((r + pr) * 3.2)) * 3
        ax -= (dx / d) * w
        ay -= (dy / d) * w
      }
    }
    if (ax !== 0 || ay !== 0) {
      desired = Math.atan2(Math.sin(desired) + ay * avoidWeight, Math.cos(desired) + ax * avoidWeight)
    }
  }

  const nominal = BASE_SPEED * ws * spec.speed
  const target = nominal * frac
  const rate = f.state === 'lunge' || f.state === 'strike' ? 7 : 3
  f.speed += (target - f.speed) * Math.min(1, dt * rate)
  f.angle = turnToward(f.angle, desired, turn * dt)
  f.x += Math.cos(f.angle) * f.speed * dt + f.kx * dt
  f.y += Math.sin(f.angle) * f.speed * dt + f.ky * dt
  const drag = Math.exp(-dt * 4)
  f.kx *= drag
  f.ky *= drag
  f.swim += dt * spec.swimRate * Math.PI * 2 * (0.35 + 0.65 * Math.min(1.6, f.speed / Math.max(1, nominal)))
  const c = Math.cos(f.angle)
  const rollTarget = c > 0.2 ? 1 : c < -0.2 ? -1 : Math.sign(f.roll) || 1
  f.roll += (rollTarget - f.roll) * Math.min(1, dt * 9)
  f.mouth += (mouth - f.mouth) * Math.min(1, dt * 10)
  f.puff += (puffTarget - f.puff) * Math.min(1, dt * (puffTarget > f.puff ? 6 : 1.2))

  pushOutOfRocks(f, r, rocks)
  if (f.y < r * 0.6) f.y = r * 0.6
}

function gatherSchools(s: GameState) {
  const schools = new Map<number, SchoolInfo>()
  for (const f of s.fishes) {
    if (!f.school) continue
    let info = schools.get(f.school)
    if (!info) {
      info = { cx: 0, cy: 0, hx: 0, hy: 0, members: [], fleeing: false }
      schools.set(f.school, info)
    }
    info.cx += f.x
    info.cy += f.y
    info.hx += Math.cos(f.angle)
    info.hy += Math.sin(f.angle)
    info.members.push(f)
    if (f.state === 'flee') info.fleeing = true
  }
  for (const info of schools.values()) {
    const n = info.members.length
    info.cx /= n
    info.cy /= n
    const hl = Math.hypot(info.hx, info.hy) || 1
    info.hx /= hl
    info.hy /= hl
  }
  return schools
}

function updatePlayer(s: GameState, dt: number, rocks: Rock[]) {
  const p = s.player
  const ws = worldScale(p.level)
  const pr = radiusForLevel(p.level)
  p.invuln = Math.max(0, p.invuln - dt)
  p.stun = Math.max(0, p.stun - dt)
  p.stingGuard = Math.max(0, p.stingGuard - dt)
  p.dash = Math.max(0, p.dash - dt)
  p.dashCd = Math.max(0, p.dashCd - dt)
  p.gulp = Math.max(0, p.gulp - dt * 3.2)

  const input = playerDesire(s)
  if (s.dashQueued !== null) {
    if (p.dashCd <= 0 && p.stun <= 0) {
      if (!Number.isNaN(s.dashQueued)) p.angle = s.dashQueued
      else if (input) p.angle = input.angle
      p.dash = DASH_TIME
      p.dashCd = DASH_COOLDOWN
      sfx('whoosh')
      emit(s, 'bubble', p.x - Math.cos(p.angle) * pr, p.y - Math.sin(p.angle) * pr, 10, 90, 3, 'rgba(255,255,255,0.8)', 0.8)
    }
    s.dashQueued = null
  }

  let target = 0
  let turn = PLAYER_TURN
  if (p.dash > 0) {
    target = BASE_SPEED * ws * DASH_BOOST
    turn = 2.2
    if (input) p.angle = turnToward(p.angle, input.angle, turn * dt)
  } else if (input) {
    target = BASE_SPEED * ws * input.frac * (s.frenzy ? 1.15 : 1)
    if (p.stun > 0) {
      target *= 0.25
      turn *= 0.25
    }
    p.angle = turnToward(p.angle, input.angle, turn * dt)
  }
  p.speed += (target - p.speed) * Math.min(1, dt * (p.dash > 0 ? 18 : 9))

  const ox = p.x
  const oy = p.y
  p.x += Math.cos(p.angle) * p.speed * dt + p.kx * dt
  p.y += Math.sin(p.angle) * p.speed * dt + p.ky * dt
  const drag = Math.exp(-dt * 4.5)
  p.kx *= drag
  p.ky *= drag

  pushOutOfRocks(p, pr, rocks)
  if (p.y < pr * 0.55) {
    if (oy >= pr * 0.55 + 4 && Math.abs(p.speed) > 60 * ws) {
      emit(s, 'bubble', p.x, 4, 14, 110, 3.5, 'rgba(255,255,255,0.85)', 0.7)
    }
    p.y = pr * 0.55
  }
  p.vx = (p.x - ox) / Math.max(dt, 1e-4)
  p.vy = (p.y - oy) / Math.max(dt, 1e-4)

  const nominal = BASE_SPEED * ws
  p.swim += dt * Math.PI * 2 * 3.1 * (0.3 + 0.7 * Math.min(1.8, p.speed / nominal))
  const c = Math.cos(p.angle)
  const rollTarget = c > 0.2 ? 1 : c < -0.2 ? -1 : Math.sign(p.roll) || 1
  p.roll += (rollTarget - p.roll) * Math.min(1, dt * 10)

  // Open wide when something edible is right in front.
  let wantMouth = 0
  const fx = Math.cos(p.angle)
  const fy = Math.sin(p.angle)
  for (const f of s.fishes) {
    if (f.level > p.level) continue
    const ddx = f.x - p.x
    const ddy = f.y - p.y
    const d = Math.hypot(ddx, ddy)
    if (d < (pr + fishRadius(f)) * 2.2 && (ddx * fx + ddy * fy) / Math.max(d, 1e-3) > 0.4) {
      wantMouth = 1
      break
    }
  }
  p.mouth += (wantMouth - p.mouth) * Math.min(1, dt * 12)

  if (p.dash > 0 && Math.random() < dt * 40) {
    emit(s, 'bubble', p.x - fx * pr, p.y - fy * pr, 1, 30, 2.5, 'rgba(255,255,255,0.7)', 0.6)
  }
  if (s.frenzy && Math.random() < dt * 30) {
    emit(s, 'spark', p.x - fx * pr * 0.8, p.y - fy * pr * 0.8, 1, 40, 2.6, '#ff8af0', 0.5)
  }
}

function die(s: GameState, cause: string, killerId: number) {
  if (s.phase !== 'playing') return
  const p = s.player
  s.phase = 'dying'
  s.dying = DYING_TIME
  s.deathCause = cause
  s.killerId = killerId
  s.best = Math.max(s.best, s.score)
  s.flash = 0.7
  s.flashColor = '#ff4b3e'
  s.shake = 1
  s.combo = 0
  s.comboTimer = 0
  s.frenzy = false
  s.pointerDir = null
  emit(s, 'bit', p.x, p.y, 24, 140, 3.2, '#c34ee0', 1)
  emit(s, 'bubble', p.x, p.y, 18, 120, 3.5, 'rgba(255,255,255,0.85)', 1)
  sfx('hurt')
  sfx('die')
}

function popShield(s: GameState, from: { x: number; y: number } | null) {
  const p = s.player
  const pr = radiusForLevel(p.level)
  p.shield = false
  p.invuln = 1.1
  p.stingGuard = 1.1
  if (from) {
    const a = Math.atan2(p.y - from.y, p.x - from.x)
    const k = 420 * worldScale(p.level)
    p.kx += Math.cos(a) * k
    p.ky += Math.sin(a) * k
  }
  emit(s, 'bubble', p.x, p.y, 22, 160, 4, 'rgba(190,240,255,0.9)', 0.9)
  s.floaters.push({ x: p.x, y: p.y - pr * 1.6, text: 'Shield!', sub: '', life: 1, maxLife: 1.2, weight: 0.6, color: '#9ef0ff' })
  s.flash = 0.35
  s.flashColor = '#9ef0ff'
  sfx('hit', 3)
}

function hitByPredator(s: GameState, f: Fish) {
  const p = s.player
  if (p.invuln > 0) return
  if (p.dash > DASH_TIME - DASH_DODGE) return
  if (p.shield) {
    popShield(s, f)
    const a = Math.atan2(f.y - p.y, f.x - p.x)
    const k = 520 * worldScale(p.level)
    f.kx += Math.cos(a) * k
    f.ky += Math.sin(a) * k
    f.state = 'rest'
    f.stateTime = 0
    return
  }
  die(s, `Eaten by ${withArticle(SPECIES[f.species].name)}`, f.id)
}

function comboColor(s: GameState) {
  if (s.frenzy) return '#ff7ae6'
  if (s.combo >= 4) return '#ffd166'
  return '#ffffff'
}

function eat(s: GameState, f: Fish) {
  const p = s.player
  const spec = SPECIES[f.species]
  const zone = zoneAt(p.y)
  const golden = spec.behavior === 'golden'
  s.combo = s.comboTimer > 0 ? s.combo + 1 : 1
  s.comboTimer = COMBO_WINDOW
  s.bestCombo = Math.max(s.bestCombo, s.combo)
  const wasFrenzy = s.frenzy
  s.frenzy = s.combo >= FRENZY_AT
  if (s.frenzy && !wasFrenzy) {
    banner(s, 'FRENZY!', 'Double points while the combo lasts', '#ff7ae6', 1.8)
    sfx('perfect')
  }
  const base = golden ? Math.max(300, p.level * 40) : f.level * 10
  const points = Math.round(base * comboMultiplier(s.combo) * (s.frenzy ? 2 : 1) * zone.mult)
  const growth = golden ? Math.max(3, Math.ceil(p.level * 0.12)) : Math.max(1, Math.round(f.level * GROWTH_RATE))
  const weight = Math.min(1, f.level / p.level)
  s.score += points
  p.level += growth
  p.gulp = 1
  s.eaten += 1
  const fr = fishRadius(f)
  emit(s, 'bit', f.x, f.y, 9, 70, 2.4, PALETTE[spec.art.swatch], 0.8)
  emit(s, 'bubble', f.x, f.y, 6, 60, 2.6, 'rgba(255,255,255,0.8)', 0.8)
  if (s.combo >= 3 || golden) emit(s, 'spark', f.x, f.y, 8, 120, 2.2, golden ? '#ffe27a' : comboColor(s), 0.5)
  s.floaters.push({
    x: f.x,
    y: f.y - fr - 8,
    text: `+${points.toLocaleString()}`,
    sub: `Lv +${growth}`,
    life: 1,
    maxLife: 1.4,
    weight: golden ? 1 : weight,
    color: golden ? '#ffd24a' : comboColor(s),
  })
  sfx('eat')
  if (s.combo >= 2) sfx('hop', Math.min(16, (s.combo - 1) * 2))
  if (golden) {
    banner(s, 'Golden!', `+${points.toLocaleString()} · Lv +${growth}`, '#ffd24a', 1.8)
    sfx('perfect')
  }
  const stage = stageFor(p.level)
  if (stage > p.stage) {
    p.stage = stage
    banner(s, 'Evolved', EVOLUTION[stage]!.name, '#e59cff', 2.2)
    sfx('wave')
    emit(s, 'spark', p.x, p.y, 26, 180, 3, '#f3b6ff', 0.9)
  }
}

function sting(s: GameState, j: Jelly) {
  const p = s.player
  if (p.stingGuard > 0 || p.invuln > 0) return
  if (p.shield) {
    popShield(s, j)
    return
  }
  const a = Math.atan2(p.y - (j.y + j.r * 0.4), p.x - j.x)
  const k = 400 * worldScale(p.level)
  p.kx += Math.cos(a) * k
  p.ky += Math.sin(a) * k
  p.stun = STUN_TIME
  p.stingGuard = STUN_TIME + 0.5
  p.dash = 0
  const lost = s.combo
  s.combo = 0
  s.comboTimer = 0
  s.frenzy = false
  s.flash = 0.45
  s.flashColor = '#c77dff'
  s.shake = Math.max(s.shake, 0.35)
  emit(s, 'spark', p.x, p.y, 14, 150, 2.4, `hsl(${j.hue}, 90%, 75%)`, 0.6)
  s.floaters.push({
    x: p.x,
    y: p.y - radiusForLevel(p.level) * 1.6,
    text: 'Stung!',
    sub: lost >= 2 ? `Combo ×${lost} lost` : '',
    life: 1,
    maxLife: 1.3,
    weight: 0.5,
    color: '#e3b6ff',
  })
  sfx('hurt')
}

function explode(s: GameState, m: Mine) {
  const R = m.r * 5.2
  s.blasts.push({ id: uid(), x: m.x, y: m.y, r: R, life: 1 })
  sfx('boom')
  const p = s.player
  const pd = dist(p.x, p.y, m.x, m.y)
  const v = viewHalf(s)
  s.shake = Math.max(s.shake, Math.max(0.25, 1 - pd / (Math.hypot(v.w, v.h) * 1.2)))
  emit(s, 'spark', m.x, m.y, 26, 260, 3.2, '#ffcf6a', 0.6)
  emit(s, 'spark', m.x, m.y, 14, 200, 2.6, '#ff7a3d', 0.7)
  emit(s, 'bubble', m.x, m.y, 20, 180, 4, 'rgba(255,255,255,0.8)', 1.1)

  if (s.phase === 'playing' && pd < R * 0.9 + radiusForLevel(p.level) * 0.5 && p.invuln <= 0) {
    if (p.shield) popShield(s, m)
    else die(s, 'Caught in a mine blast', 0)
  }

  const zone = zoneAt(m.y)
  const onScreen = (x: number, y: number) => Math.abs(x - s.cameraX) < v.w && Math.abs(y - s.cameraY) < v.h
  s.fishes = s.fishes.filter((f) => {
    if (dist(f.x, f.y, m.x, m.y) > R + fishRadius(f)) return true
    emit(s, 'bit', f.x, f.y, 6, 90, 2.4, PALETTE[SPECIES[f.species].art.swatch], 0.8)
    if (s.phase === 'playing' && onScreen(f.x, f.y)) {
      s.combo = s.comboTimer > 0 ? s.combo + 1 : 1
      s.comboTimer = COMBO_WINDOW
      s.bestCombo = Math.max(s.bestCombo, s.combo)
      const pts = Math.round(f.level * 5 * zone.mult * comboMultiplier(s.combo))
      s.score += pts
      s.floaters.push({ x: f.x, y: f.y, text: `+${pts.toLocaleString()}`, sub: 'Blast', life: 1, maxLife: 1.2, weight: 0.4, color: '#ffcf6a' })
    }
    return false
  })
  s.jellies = s.jellies.filter((j) => {
    if (dist(j.x, j.y, m.x, m.y) > R + j.r) return true
    emit(s, 'spark', j.x, j.y, 8, 90, 2.2, `hsl(${j.hue}, 90%, 75%)`, 0.6)
    return false
  })
  for (const other of s.mines) {
    if (other === m) continue
    if (dist(other.x, other.y, m.x, m.y) < R * 1.1) {
      other.fuse = other.fuse < 0 ? 0.14 : Math.min(other.fuse, 0.14)
    }
  }
}

function updateWorld(s: GameState, dt: number) {
  const alive = s.phase === 'playing'
  const p = s.player
  const pr = radiusForLevel(p.level)
  const ws = speedScale(s)

  for (const j of s.jellies) {
    j.phase += dt * 2.1
    j.fade = Math.min(1, j.fade + dt * 1.5)
    const push = Math.max(0, Math.sin(j.phase)) * 26 * ws
    j.y += (-push + 9 * ws) * dt
    j.x += j.drift * 8 * ws * dt
    if (j.y < j.r * 2) j.y = j.r * 2
    if (alive) {
      const bell = dist(p.x, p.y, j.x, j.y) < pr * 0.85 + j.r * 0.9
      const tendrils = dist(p.x, p.y, j.x, j.y + j.r * 1.4) < pr * 0.8 + j.r * 0.75
      if (bell || tendrils) sting(s, j)
    }
  }

  const exploding: Mine[] = []
  for (const m of s.mines) {
    m.bob += dt
    m.fade = Math.min(1, m.fade + dt * 1.5)
    if (m.fuse < 0) {
      const d = dist(p.x, p.y, m.x, m.y)
      if (alive && d < pr + m.r) m.fuse = 0.06
      else if (alive && d < m.r * 3.3 + pr) {
        m.fuse = MINE_FUSE
        sfx('tap')
      } else {
        for (const f of s.fishes) {
          if (dist(f.x, f.y, m.x, m.y) < fishRadius(f) + m.r) {
            m.fuse = MINE_FUSE
            break
          }
        }
      }
    } else {
      const before = m.fuse
      m.fuse -= dt
      if (before > MINE_FUSE / 2 && m.fuse <= MINE_FUSE / 2) sfx('tap')
      if (m.fuse <= 0) exploding.push(m)
    }
  }
  for (const m of exploding) {
    explode(s, m)
    s.mines = s.mines.filter((x) => x !== m)
  }

  for (const pk of s.pickups) {
    pk.bob += dt
    pk.life -= dt
    if (alive && !p.shield && dist(p.x, p.y, pk.x, pk.y) < pr + pk.r) {
      p.shield = true
      pk.life = 0
      sfx('good')
      banner(s, 'Shield', 'Takes one bite, sting or blast for you', '#9ef0ff', 1.6)
      emit(s, 'spark', pk.x, pk.y, 14, 120, 2.4, '#bff6ff', 0.6)
    }
  }
  s.pickups = s.pickups.filter((pk) => pk.life > 0)

  for (const b of s.blasts) b.life -= dt / 0.55
  s.blasts = s.blasts.filter((b) => b.life > 0)

  for (const pt of s.particles) {
    pt.life -= dt / pt.maxLife
    if (pt.kind === 'bubble') {
      pt.vy -= 70 * ws * dt
      pt.vx *= Math.exp(-dt * 2)
      pt.vx += Math.sin((s.time + pt.size) * 7) * 12 * ws * dt
    } else if (pt.kind === 'bit') {
      pt.vy += 26 * ws * dt
      const k = Math.exp(-dt * 3)
      pt.vx *= k
      pt.vy *= k
    } else {
      const k = Math.exp(-dt * 3.5)
      pt.vx *= k
      pt.vy *= k
    }
    pt.x += pt.vx * dt
    pt.y += pt.vy * dt
    if (pt.kind === 'bubble' && pt.y < 0) pt.life = 0
  }
  s.particles = s.particles.filter((pt) => pt.life > 0)

  for (const fl of s.floaters) {
    fl.life -= dt / fl.maxLife
    fl.y -= dt * 34 * ws
  }
  s.floaters = s.floaters.filter((fl) => fl.life > 0)

  if (s.banners.length) {
    const b = s.banners[0]!
    b.life -= dt
    if (b.life <= 0) s.banners.shift()
  }

  // Ambient bubbles from the fish, so the water never sits still.
  if (Math.random() < dt * 6 && s.fishes.length) {
    const f = s.fishes[Math.floor(rand(0, s.fishes.length))]!
    emit(s, 'bubble', f.x, f.y, 1, 12, 2, 'rgba(255,255,255,0.55)', 1.6)
  }
}

function spawnAndCull(s: GameState) {
  const diag = viewDiag(s)
  const far = diag * 1.9
  const cx = s.cameraX
  const cy = s.cameraY
  s.fishes = s.fishes.filter((f) => {
    const d = dist(f.x, f.y, cx, cy)
    if (f.state === 'leave') return d < diag * 1.2
    return d < far
  })
  s.jellies = s.jellies.filter((j) => dist(j.x, j.y, cx, cy) < far)
  s.mines = s.mines.filter((m) => m.fuse >= 0 || dist(m.x, m.y, cx, cy) < far)
  s.pickups = s.pickups.filter((pk) => dist(pk.x, pk.y, cx, cy) < far)
}

function maintainPopulation(s: GameState, dt: number) {
  const alive = s.phase === 'playing'
  const zone = zoneAt(alive ? s.player.y : s.cameraY)
  const zoomT = (1 - s.zoom) / (1 - MIN_ZOOM)
  const soloTarget = alive ? Math.round(20 + 14 * zoomT) : 14

  let solo = 0
  let edible = 0
  const schoolIds = new Set<number>()
  for (const f of s.fishes) {
    if (f.school) schoolIds.add(f.school)
    else solo += 1
    if (alive && f.level <= s.player.level && f.species !== 'goldfish') edible += 1
  }

  s.spawnTimer -= dt
  if (s.spawnTimer <= 0) {
    s.spawnTimer = 0.2
    if (solo < soloTarget) spawnSolo(s, ringPoint(s, 1.05, 1.5), false)
    if (alive && edible < 8) spawnSolo(s, ringPoint(s, 1.05, 1.4), true)
  }

  s.schoolTimer -= dt
  if (s.schoolTimer <= 0) {
    s.schoolTimer = 1.4
    if (schoolIds.size < Math.max(1, zone.schools)) spawnSchool(s, ringPoint(s, 1.1, 1.45, 60))
  }

  if (!alive) return

  s.hazardTimer -= dt
  if (s.hazardTimer <= 0) {
    s.hazardTimer = 0.6
    if (s.elapsed > GRACE) {
      if (s.jellies.length < zone.jellies) spawnJelly(s)
      if (s.mines.length < zone.mines) spawnMine(s)
    }
  }

  s.pickupTimer -= dt
  if (s.pickupTimer <= 0) {
    s.pickupTimer = rand(28, 42)
    if (!s.player.shield && s.pickups.length === 0) spawnPickup(s)
  }

  s.goldenTimer -= dt
  if (s.goldenTimer <= 0) {
    s.goldenTimer = rand(38, 56)
    if (!s.fishes.some((f) => f.species === 'goldfish')) spawnGolden(s)
  }
}

function updateCamera(s: GameState, dt: number, follow: boolean) {
  const p = s.player
  if (follow) {
    const v = viewHalf(s)
    const leadX = Math.max(-v.w * 0.22, Math.min(v.w * 0.22, p.vx * 0.3))
    const leadY = Math.max(-v.h * 0.22, Math.min(v.h * 0.22, p.vy * 0.3))
    const k = 1 - Math.exp(-dt * 5)
    s.cameraX += (p.x + leadX - s.cameraX) * k
    s.cameraY += (p.y + leadY - s.cameraY) * k
    s.zoom += (zoomForLevel(p.level) - s.zoom) * (1 - Math.exp(-dt * 1.2))
  } else if (s.phase === 'menu') {
    s.cameraX += 16 * dt
  }
  clampCamera(s)
}

function updateDanger(s: GameState, dt: number) {
  let threat = 0
  if (s.phase === 'playing') {
    const p = s.player
    const pr = radiusForLevel(p.level)
    const diag = viewDiag(s)
    for (const f of s.fishes) {
      if (f.level <= p.level) continue
      if (f.state === 'alert' || f.state === 'lunge' || f.state === 'windup' || f.state === 'strike') {
        threat = 1
        break
      }
      if (SPECIES[f.species].behavior === 'patroller') {
        const d = dist(f.x, f.y, p.x, p.y)
        if (d < diag * 0.8) {
          const toward = ((p.x - f.x) * Math.cos(f.angle) + (p.y - f.y) * Math.sin(f.angle)) / Math.max(d, 1e-3)
          if (toward > 0.7) threat = Math.max(threat, 0.55)
        }
      }
    }
    for (const m of s.mines) {
      if (m.fuse >= 0 && dist(m.x, m.y, p.x, p.y) < m.r * 5.2 + pr) threat = 1
    }
  }
  s.danger += (threat - s.danger) * (1 - Math.exp(-dt * 8))
}

export function tick(state: GameState, rawDt: number): GameState {
  const s: GameState = { ...state }
  const realDt = Math.min(0.05, Math.max(0, rawDt))
  s.time += realDt
  s.flash = Math.max(0, s.flash - realDt * 1.8)
  s.shake = Math.max(0, s.shake - realDt * 2.6)
  s.growlCd = Math.max(0, s.growlCd - realDt)
  s.zoneBannerCd = Math.max(0, s.zoneBannerCd - realDt)

  let dt = realDt
  if (s.phase === 'dying') {
    dt = realDt * 0.35
    s.dying -= realDt
    if (s.dying <= 0) s.phase = 'gameover'
  }

  const diag = viewDiag(s)
  const rocks = rocksNear(s.seed, s.cameraX, s.cameraY, diag * 2.2)
  const schools = gatherSchools(s)

  if (s.phase === 'playing') {
    s.elapsed += dt
    s.comboTimer -= dt
    if (s.comboTimer <= 0 && s.combo > 0) {
      s.combo = 0
      s.frenzy = false
    }
    updatePlayer(s, dt, rocks)
  }

  s.attackCd = Math.max(0, s.attackCd - dt)
  const slots: AttackSlots = { active: 0 }
  if (s.phase === 'playing') {
    for (const f of s.fishes) if (f.level > s.player.level && isAttacking(f)) slots.active += 1
  }
  for (const f of s.fishes) updateFish(s, f, dt, rocks, schools, slots)

  if (s.phase === 'playing') {
    const p = s.player
    const pr = radiusForLevel(p.level)
    const mx = p.x + Math.cos(p.angle) * pr * 0.35
    const my = p.y + Math.sin(p.angle) * pr * 0.35
    const eaten = new Set<Fish>()
    for (const f of s.fishes) {
      if (f.level > p.level) continue
      const fr = fishRadius(f)
      if (dist(mx, my, f.x, f.y) < pr * 0.8 + fr * 0.95) {
        eaten.add(f)
        eat(s, f)
      }
    }
    if (eaten.size) s.fishes = s.fishes.filter((f) => !eaten.has(f))
    for (const f of s.fishes) {
      if (f.level <= p.level) continue
      const fr = fishRadius(f)
      const fx = f.x + Math.cos(f.angle) * fr * 0.35
      const fy = f.y + Math.sin(f.angle) * fr * 0.35
      if (dist(fx, fy, p.x, p.y) < (fr + pr) * 0.64) {
        hitByPredator(s, f)
        if (s.phase !== 'playing') break
      }
    }
  }

  updateWorld(s, dt)

  if (s.phase === 'playing') {
    const zi = zoneIndexAt(s.player.y)
    if (zi !== s.zoneIndex) {
      const zone = ZONES[zi]!
      if (zi > s.deepestZone) {
        banner(s, zone.name, `Points ×${zone.mult} · bigger fish, more danger`, '#9fd8ff', 2.4)
        sfx('good')
        s.deepestZone = zi
      } else if (s.zoneBannerCd <= 0) {
        banner(s, zone.name, `Points ×${zone.mult}`, '#9fd8ff', 1.4)
      }
      s.zoneBannerCd = 4
      s.zoneIndex = zi
    }
  }

  updateCamera(s, realDt, s.phase === 'playing')
  spawnAndCull(s)
  maintainPopulation(s, dt)
  updateDanger(s, realDt)
  return s
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    level: s.player.level,
    danger: s.danger > 0.5,
    mult: zoneAt(s.player.y).mult,
    deathCause: s.deathCause,
  }
}
