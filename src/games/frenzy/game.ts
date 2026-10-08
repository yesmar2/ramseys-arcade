import { sfx } from '../../lib/sound'
import type { SpeciesId } from './species'

/*
 * Frenzy: the food chain in an open ocean (Ramsey, 2026-10-06: picked A from the "Frenzy remix lab", then
 * "do you think we should do levels or just keep growing? i like it to be more open ocean too, and it'd be
 * cool to have the surface where you could actually jump out of water", and "go ahead and build").
 *
 * One run, no levels: eat fish smaller than you to fill the bar, and each time it fills you grow a size and
 * take a new shape (Fry, Minnow, Darter, Hunter, Predator, Brute, Apex, Leviathan), and bigger fish come out
 * to meet you. At the top the bar turns gold, and filling it sets off a frenzy: double points for a while,
 * and again each time it fills (Ramsey, 2026-10-06: "should the fish change when it evolves? why is there a
 * max?"). There are no numbers on the fish: size and colour say who eats whom, and anything that can eat
 * you has a red eye and comes for you when you're near.
 *
 * The ocean is a few screens wide and two deep, with a surface, a sea floor and walls at the sides, and the
 * camera follows you, pulling back as you grow. Most fish live near the top; the deep has the bigger
 * meals and more hunters. Swim up hard through the surface and you leap out: nothing can follow you into
 * the air, flying fish and gulls up there are worth a bonus, and the splash scatters the small fish where
 * you land. Every so often a shark crosses at your depth, after a red "!" at the edge it comes from, and eats
 * whatever is in its lane (unless you're in the air). A fisherman's boat is always on the surface, sailing
 * to a spot near you and casting a worm on a hook below: touch the hook and you're reeled in ("can we add a
 * fisherman with a hook to avoid too?"). Three lives; bites in quick succession chain up to ×5.
 *
 * Everything here is in world units, y down from the surface (above it is negative); the renderer scales.
 */

export type Phase = 'menu' | 'playing' | 'dying' | 'gameover'

/** The ocean: its width, the sea floor's depth, and how high above the surface the view can go. */
export const OCEAN_W = 2400
export const FLOOR = 1300
export const SKY = -260
/** How much water a screen shows, top to bottom, at the smallest size; more as you grow. */
const VIEW_H = 440
const ZOOM_PER_SIZE = 0.11

/** The kinds drawn at each size of fish, smallest first. */
const TIER_SPECIES: readonly (readonly SpeciesId[])[] = [
  ['sardine'],
  ['clownfish'],
  ['lanternfish', 'angelfish'],
  ['tang', 'angelfish'],
  ['puffer', 'tang'],
  ['barracuda', 'puffer'],
  ['barracuda', 'grouper'],
  ['grouper', 'swordfish'],
  ['swordfish', 'anglerfish'],
  ['anglerfish', 'grouper'],
  ['anglerfish'],
]
/**
 * The fish's sizes, smallest first: each a third bigger than the last, the kinds drawn at that size, and
 * points that rise with size.
 */
export const TIERS: readonly { r: number; species: readonly SpeciesId[]; points: number }[] = TIER_SPECIES.map((species, t) => ({
  r: 5 * 1.33 ** t,
  species,
  points: Math.round(5 * 1.4 ** t),
}))
/** What you are at each size. */
export const STAGES = ['Fry', 'Minnow', 'Darter', 'Hunter', 'Predator', 'Brute', 'Apex', 'Leviathan'] as const
export const MAX_SIZE = STAGES.length - 1
/**
 * The player's radius at each size: a little bigger than the fish one size up, so at size s it eats tiers up
 * to s + 1, and tiers from s + 2 eat it.
 */
const PLAYER_R = STAGES.map((_, size) => TIERS[size + 1]!.r * 1.14)
/** How much eating fills the bar to the next size (a fish your size or bigger counts 1, smaller ones a third). */
const GROW_NEED = [10, 12, 14, 17, 20, 24, 28] as const
/** Points for each size reached, times the size. */
const GROW_BONUS = 50
/** At the top: the bar fills toward a frenzy, which doubles points for FRENZY_TIME. */
const FRENZY_NEED = 20
export const FRENZY_TIME = 8

const LIVES = 3
const PLAYER_SPEED = 220
const START_INVULN = 2
const RESPAWN_INVULN = 2.4
const CHAIN_WINDOW = 1.4
const MAX_CHAIN = 5
const DYING_TIME = 1.4
/** Out of the water: gravity, the kick a breach gives, and the fastest climb that breaches at all. */
const GRAVITY = 760
const BREACH_KICK = 1.55
const BREACH_SPEED = 120
/** The splash scatters small fish this far from where you land. */
const SPLASH_R = 110
/** The shark: seconds of warning, its speed, its size. */
const SHARK_WARN = 1.4
const SHARK_SPEED = 360
const SHARK_R = 56
/** The fisherman: how long he waits before his first cast of a run, his speed between spots. */
const BOAT_FIRST = 7
const BOAT_SPEED = 75
const HOOK_R = 8
/**
 * Harder since Ramsey's "i think the fisherman needs to be a little harder" (2026-10-06): he fishes close to
 * you and at your depth, follows you with the boat while he waits (faster as you grow), sways his hook, and
 * rests only a moment between casts.
 */
const BOAT_FOLLOW = 26
const BOAT_FOLLOW_PER_SIZE = 4
/** Points for things caught in the air. */
const FLYER_AIR_POINTS = 25
const GULL_POINTS = 50

export type Fish = {
  id: number
  tier: number
  species: SpeciesId
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  /** -1..1, eased: which way up it is drawn, so a fish turning round rolls over instead of flipping. */
  roll: number
  swim: number
  mouth: number
  seed: number
  /** 0..1: how hard it is hunting you. */
  hunt: number
  /** Fades in as it arrives. */
  fade: number
  /** A flying fish: seconds to its next leap; it's in the air while y < 0. */
  flyer?: number
}

export type Gull = { id: number; x: number; y: number; vx: number; flap: number; dip: number }

export type Player = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  roll: number
  swim: number
  mouth: number
  /** 0 to MAX_SIZE. */
  size: number
  invuln: number
  /** Out of the water, in a leap. */
  air: boolean
}

export type Shark = { stage: 'warn' | 'pass'; t: number; x: number; y: number; dir: 1 | -1; swim: number; left: number; r: number }

/**
 * The fisherman's boat, always on the surface (Ramsey, 2026-10-06: "shouldn't just appear and disappear
 * though, should always be there"). He rests, sails to a spot not far from you, casts a worm on a hook down
 * to `hookY`, waits, reels in, and rests again. Whatever bites is reeled up with it.
 */
export type Boat = {
  x: number
  dir: 1 | -1
  stage: 'rest' | 'sail' | 'cast' | 'wait' | 'reel'
  t: number
  /** How long this rest lasts, and where he's sailing to. */
  rest: number
  to: number
  hookY: number
  depth: number
  /** On the hook, being reeled up: a fish (its species and tier), or you. */
  caught: { species: SpeciesId; tier: number } | 'you' | null
}

export type Particle = { x: number; y: number; vx: number; vy: number; r: number; t: number; life: number; color: string; drop?: boolean }
export type Floater = { x: number; y: number; text: string; t: number; tone: 'plain' | 'hot' | 'grow' | 'bad' }

export type Keys = { up: boolean; down: boolean; left: boolean; right: boolean }

export type GameState = {
  phase: Phase
  phaseTime: number
  /** Seconds played this run. */
  elapsed: number
  /** Seconds, for animation. */
  time: number
  /** The screen, in pixels; the camera's centre in world units; pixels per world unit. */
  screenW: number
  screenH: number
  camX: number
  camY: number
  ppu: number
  /** A tile on the home page draws closer than the game would (preview.ts). */
  minPpu: number
  /** How full the bar to the next size is, 0..GROW_NEED[size]. */
  bar: number
  lives: number
  score: number
  chain: number
  chainTime: number
  player: Player
  fishes: Fish[]
  gulls: Gull[]
  spawnIn: number
  gullIn: number
  shark: Shark | null
  sharkIn: number
  boat: Boat
  /** Seconds of frenzy left (double points), at the top size. */
  frenzy: number
  /** Where the fish is heading, in world units; null to coast to a stop. */
  target: { x: number; y: number } | null
  /** A thumb on the stick: which way, and how hard, each −1 to 1, no longer than 1 all told; null with no thumb down. */
  steer: { x: number; y: number } | null
  keys: Keys
  particles: Particle[]
  floaters: Floater[]
  nextId: number
  deathCause: string
  /** Leaps made this run. */
  leaps: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

const need = (size: number) => (size >= MAX_SIZE ? FRENZY_NEED : GROW_NEED[size]!)
/** The player's radius: its size, and a little more as the bar fills toward the next. */
export const playerRadius = (s: Pick<GameState, 'player' | 'bar'>) => {
  const size = s.player.size
  const base = PLAYER_R[size]!
  if (size >= MAX_SIZE) return base
  return base + clamp(s.bar / need(size), 0, 1) * (PLAYER_R[size + 1]! - base) * 0.35
}
export const fishRadius = (f: Pick<Fish, 'tier'>) => TIERS[f.tier]!.r
/** Can a fish of this tier be eaten by a player of this size? */
export const edible = (tier: number, size: number) => tier <= size + 1
/** How full the bar is, 0..1: toward the next size, or at the top toward a frenzy (and in one, how much is left). */
export const barFill = (s: Pick<GameState, 'bar' | 'player' | 'frenzy'>) =>
  s.frenzy > 0 ? clamp(s.frenzy / FRENZY_TIME, 0, 1) : clamp(s.bar / need(s.player.size), 0, 1)
/** The shark is always far bigger than you. */
export const sharkRadius = (s: Pick<GameState, 'player' | 'bar'>) => Math.max(SHARK_R, playerRadius(s) * 1.7)
/** Where the fisherman's rod tip is, and so where his line hangs from. */
export const rodTip = (b: Pick<Boat, 'x' | 'dir'>) => ({ x: b.x + b.dir * 30, y: -38 })
/** The chain's multiplier. */
export const chainOf = (s: Pick<GameState, 'chain'>) => Math.max(1, Math.min(MAX_CHAIN, s.chain))

/** How much world the screen shows at a size: the view's height, in world units. */
const viewHeight = (size: number) => VIEW_H * (1 + size * ZOOM_PER_SIZE)
/** The view, in world units: its half width and half height. */
export function viewHalf(s: Pick<GameState, 'screenW' | 'screenH' | 'ppu'>) {
  return { w: s.screenW / 2 / s.ppu, h: s.screenH / 2 / s.ppu }
}

/** The boat as a run finds it: resting on the surface just off to one side, in sight from the start. */
function freshBoat(): Boat {
  const x = OCEAN_W / 2 + (Math.random() < 0.5 ? -1 : 1) * rand(90, 150)
  return { x, dir: x > OCEAN_W / 2 ? -1 : 1, stage: 'rest', t: 0, rest: BOAT_FIRST, to: x, hookY: -28, depth: 200, caught: null }
}

function freshPlayer(): Player {
  return { x: OCEAN_W / 2, y: 120, vx: 0, vy: 0, angle: 0, roll: 1, swim: 0, mouth: 0, size: 0, invuln: START_INVULN, air: false }
}

export function createInitialState(w = 960, h = 540): GameState {
  const s: GameState = {
    phase: 'menu',
    phaseTime: 0,
    elapsed: 0,
    time: 0,
    screenW: w,
    screenH: h,
    camX: OCEAN_W / 2,
    camY: 140,
    ppu: 1,
    minPpu: 0,
    bar: 0,
    lives: LIVES,
    score: 0,
    chain: 0,
    chainTime: 0,
    player: freshPlayer(),
    fishes: [],
    gulls: [],
    spawnIn: 0,
    gullIn: 2,
    shark: null,
    sharkIn: 16,
    boat: freshBoat(),
    frenzy: 0,
    target: null,
    steer: null,
    keys: { up: false, down: false, left: false, right: false },
    particles: [],
    floaters: [],
    nextId: 1,
    deathCause: '',
    leaps: 0,
  }
  const sized = resizeState(s, w, h)
  // The start card sits over a few fish already swimming.
  for (let i = 0; i < 12; i++) spawn(sized, true)
  return sized
}

/** The screen is `w` by `h` pixels. */
export function resizeState(s: GameState, w: number, h: number): GameState {
  if (w <= 0 || h <= 0) return s
  const next = { ...s, screenW: w, screenH: h }
  frame(next, 1)
  return next
}

/** A screen point (px, from the canvas's top left) in world units. */
export function toWorld(s: GameState, px: number, py: number) {
  return { x: s.camX + (px - s.screenW / 2) / s.ppu, y: s.camY + (py - s.screenH / 2) / s.ppu }
}

/** Where a world point is on the screen. */
export function toScreen(s: Pick<GameState, 'camX' | 'camY' | 'ppu' | 'screenW' | 'screenH'>, x: number, y: number) {
  return { x: s.screenW / 2 + (x - s.camX) * s.ppu, y: s.screenH / 2 + (y - s.camY) * s.ppu }
}

/** The camera: follows the player, eased, kept inside the ocean and its sky; `k` 1 snaps it. */
function frame(s: GameState, k: number) {
  const vh = viewHeight(s.player.size)
  const want = Math.max(s.minPpu, s.screenH / vh)
  s.ppu += (want - s.ppu) * k
  const half = viewHalf(s)
  const tx = s.player.x
  const ty = s.player.y
  s.camX += (tx - s.camX) * k
  s.camY += (ty - s.camY) * k
  s.camX = half.w * 2 >= OCEAN_W ? OCEAN_W / 2 : clamp(s.camX, half.w, OCEAN_W - half.w)
  s.camY = half.h * 2 >= FLOOR + 40 - SKY ? (SKY + FLOOR + 40) / 2 : clamp(s.camY, SKY + half.h, FLOOR + 40 - half.h)
}

export function startGame(s: GameState): GameState {
  sfx('wave')
  const next: GameState = {
    ...s,
    phase: 'playing',
    phaseTime: 0,
    elapsed: 0,
    bar: 0,
    lives: LIVES,
    score: 0,
    chain: 0,
    chainTime: 0,
    player: freshPlayer(),
    fishes: [],
    gulls: [],
    spawnIn: 0,
    gullIn: 3,
    shark: null,
    sharkIn: 18,
    boat: freshBoat(),
    frenzy: 0,
    target: null,
    steer: null,
    particles: [],
    floaters: [],
    deathCause: '',
    leaps: 0,
  }
  frame(next, 1)
  for (let i = 0; i < 6; i++) spawn(next, true)
  return next
}

/**
 * Straight to a size (1 to 8), for testing: the admin's skip on the pause and start cards (AdminWaveSkip),
 * which marks the run assisted so it never reaches a board. The water around you is cleared, and fills
 * with fish for the new size.
 */
export function jumpToSize(s: GameState, size: number): GameState {
  const to = clamp(Math.round(size) - 1, 0, MAX_SIZE)
  const next: GameState = { ...s, player: { ...s.player, size: to, invuln: 1.5 }, bar: 0, frenzy: 0, fishes: [], spawnIn: 0 }
  next.floaters = [...s.floaters, { x: s.player.x, y: s.player.y - 34, text: `${STAGES[to]}!`, t: 0, tone: 'grow' }]
  frame(next, 1)
  return next
}

export function setTarget(s: GameState, x: number, y: number): GameState {
  return { ...s, target: { x: clamp(x, 0, OCEAN_W), y: clamp(y, SKY, FLOOR) } }
}

export function clearTarget(s: GameState): GameState {
  return s.target ? { ...s, target: null } : s
}

/** A thumb on the stick: swim that way, as hard as it's pushed, for as long as it's held. */
export function setSteer(s: GameState, x: number, y: number): GameState {
  const l = Math.hypot(x, y)
  const k = l > 1 ? 1 / l : 1
  return { ...s, steer: { x: x * k, y: y * k }, target: null }
}

export function clearSteer(s: GameState): GameState {
  return s.steer ? { ...s, steer: null } : s
}

export function setKey(s: GameState, key: keyof Keys, down: boolean): GameState {
  return s.keys[key] === down ? s : { ...s, keys: { ...s.keys, [key]: down } }
}

export function releaseInput(s: GameState): GameState {
  return { ...s, target: null, steer: null, keys: { up: false, down: false, left: false, right: false } }
}

/** What swims in at a depth: mostly food, some your size and up, and more of the big ones deeper down. */
function pickTier(s: GameState, y: number, calm: boolean): number {
  const size = s.player.size
  const deep = clamp(y / FLOOR, 0, 1)
  const roll = Math.random()
  const threat = calm ? 0 : Math.min(0.45, 0.1 + deep * 0.28 + Math.min(0.08, s.elapsed / 900)) * threatShare(s)
  if (roll < threat) return clamp(size + 2 + (Math.random() < 0.15 + deep * 0.35 ? 1 : 0), 0, TIERS.length - 1)
  // Big meals, more of them deeper.
  if (roll < threat + 0.22 + deep * 0.18) return clamp(size + 1, 0, TIERS.length - 1)
  return clamp(size - Math.floor(Math.random() * 3), 0, TIERS.length - 1)
}

/** Somewhere just out of sight (or anywhere in view, for a calm start), at a depth near the player's. */
function spawnPoint(s: GameState, anywhere: boolean) {
  const half = viewHalf(s)
  const y = clamp(s.camY + rand(-half.h, half.h) * 1.1, 24, FLOOR - 30)
  if (anywhere) {
    // In view, but never on top of you.
    let x = clamp(s.camX + rand(-half.w, half.w), 30, OCEAN_W - 30)
    if (Math.hypot(x - s.player.x, y - s.player.y) < 160) x = s.player.x + (x < s.player.x ? -1 : 1) * 160
    return { x: clamp(x, 30, OCEAN_W - 30), y, left: Math.random() < 0.5 }
  }
  const left = Math.random() < 0.5
  const x = left ? s.camX - half.w - 50 : s.camX + half.w + 50
  // Off the ocean's edge: come in from the other side of the view instead.
  if (x < 20 || x > OCEAN_W - 20) return { x: left ? s.camX + half.w + 50 : s.camX - half.w - 50, y, left: !left }
  return { x, y, left }
}

function spawn(s: GameState, anywhere = false) {
  const at = spawnPoint(s, anywhere)
  const shallow = at.y < 120
  // Near the surface, now and then a flying fish.
  if (shallow && Math.random() < 0.18) {
    addFish(s, 1, 'hatchetfish', at.x, clamp(at.y, 30, 80), anywhere, rand(1.5, 4))
    return
  }
  const tier = pickTier(s, at.y, anywhere)
  const t = TIERS[tier]!
  const species = t.species[Math.floor(Math.random() * t.species.length)]!
  // Little fish come in little schools.
  const n = tier <= Math.max(1, s.player.size - 1) ? 2 + Math.floor(Math.random() * 2) : 1
  for (let i = 0; i < n; i++) addFish(s, tier, species, at.x + (at.left ? -1 : 1) * i * (t.r * 2.4), at.y + rand(-t.r * 2, t.r * 2), anywhere)
}

function addFish(s: GameState, tier: number, species: SpeciesId, x: number, y: number, shown: boolean, flyer?: number) {
  const speed = rand(30, 60) * (1 + Math.min(0.5, s.elapsed / 400))
  // Whichever side it comes in from, it swims into view.
  const dir = x < s.camX ? 1 : -1
  const r = TIERS[tier]!.r
  s.fishes.push({
    id: s.nextId++,
    tier,
    species,
    x,
    y: clamp(y, r + 6, FLOOR - r),
    vx: dir * speed,
    vy: 0,
    angle: dir > 0 ? 0 : Math.PI,
    roll: dir,
    swim: rand(0, 6.28),
    mouth: 0,
    seed: Math.random() * 1000,
    hunt: 0,
    fade: shown ? 1 : 0,
    flyer,
  })
}

function burst(s: GameState, x: number, y: number, color: string, n: number, speed = 90, drop = false) {
  for (let i = 0; i < n && s.particles.length < 300; i++) {
    const a = drop ? rand(-Math.PI * 0.95, -Math.PI * 0.05) : rand(0, Math.PI * 2)
    const v = rand(speed * 0.3, speed)
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (drop ? 60 : 20), r: rand(1.4, 3.4), t: 0, life: rand(0.4, 0.8), color, drop })
  }
}

function turnToward(angle: number, want: number, rate: number) {
  let d = want - angle
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return angle + d * Math.min(1, rate)
}

const NAMES: Partial<Record<SpeciesId, string>> = {
  angelfish: 'an angelfish',
  tang: 'a tang',
  puffer: 'a puffer',
  grouper: 'a grouper',
  barracuda: 'a barracuda',
  swordfish: 'a swordfish',
  anglerfish: 'an anglerfish',
  clownfish: 'a clownfish',
  lanternfish: 'a lanternfish',
}

/** One step of the player: the way the keys or the stick say, or toward the target; in the air, a leap's arc. */
function movePlayer(s: GameState, dt: number) {
  const p = s.player
  const r = playerRadius(s)
  if (p.air) {
    // A leap: gravity has it, with a little steer left and right.
    let ax = 0
    const kx = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0)
    if (kx) ax = kx * 260
    else if (s.steer) ax = s.steer.x * 260
    else if (s.target) ax = clamp((s.target.x - p.x) * 3, -260, 260)
    p.vx += ax * dt
    p.vy += GRAVITY * dt
    p.x = clamp(p.x + p.vx * dt, r, OCEAN_W - r)
    p.y += p.vy * dt
    p.angle = Math.atan2(p.vy, p.vx)
    const up = Math.cos(p.angle) >= 0 ? 1 : -1
    p.roll += (up - p.roll) * Math.min(1, 8 * dt)
    p.swim += dt * 3
    if (p.y >= 0) splash(s)
  } else {
    const speed = PLAYER_SPEED + p.size * 12
    let tvx = 0
    let tvy = 0
    const kx = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0)
    const ky = (s.keys.down ? 1 : 0) - (s.keys.up ? 1 : 0)
    if (kx || ky) {
      const l = Math.hypot(kx, ky)
      tvx = (kx / l) * speed
      tvy = (ky / l) * speed
    } else if (s.steer) {
      // The stick: its way, and as fast as it's pushed; held still, the fish keeps swimming.
      tvx = s.steer.x * speed
      tvy = s.steer.y * speed
    } else if (s.target) {
      const dx = s.target.x - p.x
      const dy = s.target.y - p.y
      const d = Math.hypot(dx, dy)
      const want = d > 4 ? Math.min(speed, d * 5) : 0
      if (d > 0) {
        tvx = (dx / d) * want
        tvy = (dy / d) * want
      }
    }
    const k = Math.min(1, 9 * dt)
    p.vx += (tvx - p.vx) * k
    p.vy += (tvy - p.vy) * k
    p.x = clamp(p.x + p.vx * dt, r, OCEAN_W - r)
    p.y = Math.min(FLOOR - r, p.y + p.vy * dt)
    if (p.y < 0) {
      if (p.vy < -BREACH_SPEED) breach(s)
      else p.y = 0
    }
    const sp = Math.hypot(p.vx, p.vy)
    if (sp > 12) {
      p.angle = turnToward(p.angle, Math.atan2(p.vy, p.vx), 14 * dt)
      const up = Math.cos(p.angle) >= 0 ? 1 : -1
      p.roll += (up - p.roll) * Math.min(1, 8 * dt)
    }
    p.swim += dt * (4 + (sp / speed) * 8)
  }
  p.mouth = Math.max(0, p.mouth - dt * 5)
  p.invuln = Math.max(0, p.invuln - dt)
}

/** Up through the surface fast enough: out into the air. */
function breach(s: GameState) {
  const p = s.player
  p.air = true
  p.vy *= BREACH_KICK
  p.vx *= 1.1
  p.y = -0.5
  s.leaps++
  burst(s, p.x, 0, '#ffffff', 14, 120, true)
  sfx('whoosh')
}

/** Back down into the water: a splash that sends the small fish near it darting away. */
function splash(s: GameState) {
  const p = s.player
  p.air = false
  p.y = 1
  p.vy *= 0.35
  burst(s, p.x, 0, '#ffffff', 22, 150, true)
  sfx('hop', 2)
  for (const f of s.fishes) {
    const dx = f.x - p.x
    const dy = f.y - p.y
    const d = Math.hypot(dx, dy)
    if (d < SPLASH_R + fishRadius(f) && edible(f.tier, p.size)) {
      f.vx += (dx / (d || 1)) * 160
      f.vy += (dy / (d || 1)) * 160
    }
  }
}

function eatPoints(s: GameState, x: number, y: number, base: number) {
  s.chain = s.chainTime > 0 ? s.chain + 1 : 1
  s.chainTime = CHAIN_WINDOW
  const mult = chainOf(s)
  const pts = base * mult * (s.frenzy > 0 ? 2 : 1)
  s.score += pts
  s.floaters.push({ x, y: y - 8, text: mult > 1 ? `+${pts} ×${mult}` : `+${pts}`, t: 0, tone: mult > 2 ? 'hot' : 'plain' })
  sfx('eat')
  if (mult > 1) sfx('hop', Math.min(12, (mult - 1) * 3))
}

function eat(s: GameState, f: Fish) {
  const p = s.player
  p.mouth = 1
  const inAir = f.flyer !== undefined && f.y < 0
  eatPoints(s, f.x, f.y, inAir ? FLYER_AIR_POINTS : TIERS[f.tier]!.points)
  burst(s, f.x, f.y, '#ffffff', 7, 70)
  // A fish your size or bigger counts in full toward growing; smaller ones a third.
  grow(s, f.tier >= p.size ? 1 : 0.34)
}

function grow(s: GameState, by: number) {
  const p = s.player
  // In a frenzy the bar is its clock, and fills no further.
  if (s.frenzy > 0) return
  s.bar += by
  if (s.bar < need(p.size)) return
  s.bar = 0
  if (p.size >= MAX_SIZE) {
    s.frenzy = FRENZY_TIME
    s.floaters.push({ x: p.x, y: p.y - 40, text: 'FRENZY! ×2', t: 0, tone: 'grow' })
    burst(s, p.x, p.y, '#f5b942', 26, 170)
    sfx('perfect')
    return
  }
  p.size += 1
  const bonus = GROW_BONUS * p.size
  s.score += bonus
  s.floaters.push({ x: p.x, y: p.y - 34, text: `${STAGES[p.size]}! +${bonus}`, t: 0, tone: 'grow' })
  burst(s, p.x, p.y, '#3ecf8e', 20, 140)
  sfx(p.size >= MAX_SIZE ? 'perfect' : 'good')
}

/** A life lost, to `cause` ("Eaten by a tang", "Caught by the fisherman"). */
function hurt(s: GameState, cause: string) {
  const p = s.player
  s.lives -= 1
  s.chain = 0
  s.chainTime = 0
  burst(s, p.x, p.y, '#ffffff', 20, 140)
  if (s.lives <= 0) {
    s.phase = 'dying'
    s.phaseTime = 0
    s.deathCause = cause
    sfx('die')
    return
  }
  sfx('hurt')
  s.floaters.push({ x: p.x, y: p.y - 26, text: `${s.lives} left`, t: 0, tone: 'bad' })
  // Back near the surface, out of harm's way for a moment.
  Object.assign(p, { y: Math.min(p.y, 140), vx: 0, vy: 0, invuln: RESPAWN_INVULN, air: false })
  s.target = null
}

function moveFishes(s: GameState, dt: number, playing: boolean) {
  const p = s.player
  const pr = playerRadius(s)
  const pace = 1 + Math.min(0.4, s.elapsed / 500)
  const half = viewHalf(s)
  for (const f of s.fishes) {
    const fr = fishRadius(f)
    const dx = p.x - f.x
    const dy = p.y - f.y
    const d = Math.hypot(dx, dy) || 1
    const bigger = !edible(f.tier, p.size)
    const inAir = f.flyer !== undefined && f.y < 0
    if (inAir) {
      f.vy += GRAVITY * dt
    } else if (playing && bigger && !p.air && d < 160 + fr && p.invuln <= 0) {
      // Comes for you, a little slower than you swim, so you can always get away.
      f.hunt = Math.min(1, f.hunt + dt * 2.5)
      const sp = (110 + f.tier * 5) * pace
      f.vx += ((dx / d) * sp - f.vx) * dt * 2.2
      f.vy += ((dy / d) * sp - f.vy) * dt * 2.2
    } else if (playing && !bigger && d < (s.frenzy > 0 ? 150 : 90) + fr) {
      // Runs from you, but not fast enough to get away from a chase.
      f.vx -= (dx / d) * 170 * dt
      f.vy -= (dy / d) * 170 * dt
    } else {
      f.hunt = Math.max(0, f.hunt - dt)
      f.vy += (Math.sin(s.time * 0.9 + f.seed) * 12 - f.vy) * dt
      const dir = f.vx >= 0 ? 1 : -1
      const cruise = (40 + f.tier * 4) * pace
      if (Math.abs(f.vx) < cruise * 0.6) f.vx += dir * cruise * dt
    }
    // A flying fish leaps now and then.
    if (f.flyer !== undefined && !inAir && f.y < 90) {
      f.flyer -= dt
      if (f.flyer <= 0 && !(f.hunt > 0)) {
        f.vy = -rand(330, 420)
        f.vx = (f.vx >= 0 ? 1 : -1) * rand(150, 200)
        f.flyer = rand(2.5, 5)
      }
    }
    if (!inAir) {
      const sp = Math.hypot(f.vx, f.vy)
      const cap = (80 + f.tier * 9) * pace * (f.hunt > 0.5 ? 1.25 : 1)
      if (sp > cap) {
        f.vx *= cap / sp
        f.vy *= cap / sp
      }
    }
    f.x += f.vx * dt
    f.y += f.vy * dt
    // The walls turn it round; the floor and (unless it's flying) the surface keep it in.
    if (f.x < fr && f.vx < 0) f.vx = -f.vx
    if (f.x > OCEAN_W - fr && f.vx > 0) f.vx = -f.vx
    if (f.flyer === undefined || f.y > 0) f.y = clamp(f.y, f.flyer !== undefined ? -400 : fr + 4, FLOOR - fr)
    if (Math.hypot(f.vx, f.vy) > 5) {
      f.angle = turnToward(f.angle, Math.atan2(f.vy, f.vx), (inAir ? 10 : 6) * dt)
      const up = Math.cos(f.angle) >= 0 ? 1 : -1
      f.roll += (up - f.roll) * Math.min(1, 5 * dt)
    }
    f.swim += dt * (3 + Math.hypot(f.vx, f.vy) / 25)
    f.fade = Math.min(1, f.fade + dt * 3)
    f.mouth = f.hunt > 0.6 && d < pr + fr + 40 ? Math.min(1, f.mouth + dt * 5) : Math.max(0, f.mouth - dt * 4)
    // Far out of sight: gone, and something new will swim in.
    if (Math.abs(f.x - s.camX) > half.w * 2.6 + 200 || Math.abs(f.y - s.camY) > half.h * 2.6 + 200) f.tier = -1
    if (!playing || f.tier < 0) continue
    if (d < (pr + fr) * 0.78) {
      if (!bigger) {
        eat(s, f)
        f.tier = -1
        if (s.phase !== 'playing') break
      } else if (p.invuln <= 0 && !p.air) {
        hurt(s, `Eaten by ${NAMES[f.species] ?? 'a bigger fish'}`)
        if (s.phase !== 'playing') break
      }
    }
  }
  s.fishes = s.fishes.filter((f) => f.tier >= 0)
}

/** Gulls over the water, now and then dipping low: only a leap can reach them. */
function moveGulls(s: GameState, dt: number, playing: boolean) {
  const half = viewHalf(s)
  s.gullIn -= dt
  if (s.gullIn <= 0 && s.gulls.length < 2 && s.camY - half.h < 0) {
    const fromLeft = Math.random() < 0.5
    s.gulls.push({ id: s.nextId++, x: fromLeft ? s.camX - half.w - 40 : s.camX + half.w + 40, y: rand(-110, -60), vx: (fromLeft ? 1 : -1) * rand(70, 100), flap: 0, dip: rand(0, 6) })
    s.gullIn = rand(5, 9)
  }
  const p = s.player
  const pr = playerRadius(s)
  for (const g of s.gulls) {
    g.x += g.vx * dt
    g.flap += dt * 9
    g.dip += dt * 0.8
    const target = -70 + Math.sin(g.dip) * 40
    g.y += (target - g.y) * Math.min(1, dt * 1.5)
    if (playing && p.air && Math.hypot(p.x - g.x, p.y - g.y) < pr + 12) {
      g.id = -1
      p.mouth = 1
      eatPoints(s, g.x, g.y, GULL_POINTS)
      burst(s, g.x, g.y, '#ffffff', 12, 110)
      grow(s, 1)
    }
  }
  s.gulls = s.gulls.filter((g) => g.id >= 0 && Math.abs(g.x - s.camX) < half.w * 3 + 200)
}

function moveShark(s: GameState, dt: number, playing: boolean) {
  const half = viewHalf(s)
  const p = s.player
  s.sharkIn -= dt
  if (!s.shark && s.sharkIn <= SHARK_WARN && playing && p.y > 40) {
    // Toward you along your depth, from whichever side has room.
    const dir: 1 | -1 = p.x - half.w - 160 < 0 ? -1 : p.x + half.w + 160 > OCEAN_W ? 1 : Math.random() < 0.5 ? 1 : -1
    const y = clamp(p.y + rand(-30, 30), 60, FLOOR - 80)
    const r = sharkRadius(s)
    s.shark = { stage: 'warn', t: 0, x: dir > 0 ? s.camX - half.w - r * 2 : s.camX + half.w + r * 2, y, dir, swim: 0, left: half.w * 2 + r * 6 + 200, r }
    sfx('whoosh')
  }
  const k = s.shark
  if (!k) return
  k.t += dt
  if (k.stage === 'warn') {
    // It keeps to the edge of the view while it waits.
    k.x = k.dir > 0 ? s.camX - half.w - k.r * 2 : s.camX + half.w + k.r * 2
    if (k.t >= SHARK_WARN) {
      k.stage = 'pass'
      k.t = 0
    }
    return
  }
  const step = SHARK_SPEED * (1 + Math.min(0.3, s.elapsed / 600)) * dt
  k.x += k.dir * step
  k.left -= step
  k.swim += dt * 14
  for (const f of s.fishes) {
    if (Math.abs(f.x - k.x) < k.r && Math.abs(f.y - k.y) < k.r * 0.5) {
      f.tier = -1
      burst(s, f.x, f.y, '#ffffff', 4, 60)
    }
  }
  s.fishes = s.fishes.filter((f) => f.tier >= 0)
  if (playing && p.invuln <= 0 && !p.air && Math.abs(p.x - k.x) < k.r * 0.95 && Math.abs(p.y - k.y) < k.r * 0.45 + playerRadius(s) * 0.5) {
    hurt(s, 'Eaten by the shark')
  }
  if (k.left <= 0) {
    s.shark = null
    s.sharkIn = rand(14, 20) / (1 + Math.min(0.4, s.elapsed / 500))
  }
}

/** The fisherman: rests, sails to a spot not far from you, casts, waits, reels in, rests again. */
function moveBoat(s: GameState, dt: number, playing: boolean) {
  const half = viewHalf(s)
  const p = s.player
  const b = s.boat
  b.t += dt
  const tip = rodTip(b)
  if (b.stage === 'rest') {
    b.hookY = tip.y
    if (b.t >= b.rest) {
      // A spot near you, but never right overhead.
      const side = Math.random() < 0.5 ? -1 : 1
      b.to = clamp(p.x + side * rand(110, Math.max(160, half.w * 0.5)), 120, OCEAN_W - 120)
      b.stage = 'sail'
      b.t = 0
    }
  } else if (b.stage === 'sail') {
    b.hookY = tip.y
    const dx = b.to - b.x
    if (Math.abs(dx) > 1) b.dir = dx > 0 ? 1 : -1
    b.x += Math.sign(dx) * Math.min(Math.abs(dx), BOAT_SPEED * dt)
    if (Math.abs(dx) <= 1) {
      b.stage = 'cast'
      b.t = 0
      // Down to where you are now, give or take.
      b.depth = clamp(p.y + rand(-30, 40), 60, FLOOR - 80)
      b.hookY = 0
    }
  } else if (b.stage === 'cast') {
    b.hookY = Math.min(b.depth, b.hookY + 240 * dt)
    if (b.hookY >= b.depth) {
      b.stage = 'wait'
      b.t = 0
    }
  } else if (b.stage === 'wait') {
    // He follows you along the surface, and lets the hook sink or rise a little toward you.
    if (playing && !p.air) {
      const dx = p.x - tip.x
      const follow = (BOAT_FOLLOW + p.size * BOAT_FOLLOW_PER_SIZE) * dt
      if (Math.abs(dx) > 4) b.x = clamp(b.x + Math.sign(dx) * Math.min(Math.abs(dx), follow), 60, OCEAN_W - 60)
      b.depth = clamp(b.depth + Math.sign(p.y - b.depth) * Math.min(Math.abs(p.y - b.depth), 18 * dt), 60, FLOOR - 80)
    }
    b.hookY = b.depth + Math.sin(b.t * 2.2) * 16
    if (b.t > 8) {
      b.stage = 'reel'
      b.t = 0
    }
  } else {
    b.hookY -= 230 * dt
    if (b.hookY <= tip.y + 10) {
      b.caught = null
      b.hookY = tip.y
      b.stage = 'rest'
      b.rest = rand(0.8, 1.8)
      b.t = 0
    }
  }
  if (b.stage !== 'wait' && b.stage !== 'cast') return
  const hx = rodTip(b).x
  const hy = b.hookY
  // You, on the hook: reeled in.
  if (playing && !p.air && p.invuln <= 0 && Math.hypot(p.x - hx, p.y - hy) < playerRadius(s) * 0.65 + HOOK_R) {
    b.caught = 'you'
    b.stage = 'reel'
    b.t = 0
    hurt(s, 'Caught by the fisherman')
    return
  }
  // A small fish takes the worm now and then, once it's been down a while.
  if (b.stage !== 'wait' || b.t < 4) return
  for (const f of s.fishes) {
    if (f.tier > 2 || f.flyer !== undefined) continue
    if (Math.hypot(f.x - hx, f.y - hy) < fishRadius(f) + HOOK_R) {
      b.caught = { species: f.species, tier: f.tier }
      b.stage = 'reel'
      b.t = 0
      f.tier = -1
      s.fishes = s.fishes.filter((g) => g.tier >= 0)
      return
    }
  }
}

function stepEffects(s: GameState, dt: number) {
  for (const q of s.particles) {
    q.t += dt
    q.x += q.vx * dt
    q.y += q.vy * dt
    if (q.drop) q.vy += GRAVITY * 0.7 * dt
    else {
      q.vx *= 0.92
      q.vy *= 0.92
    }
  }
  s.particles = s.particles.filter((q) => q.t < q.life && !(q.drop && q.y > 4 && q.vy > 0))
  for (const f of s.floaters) f.t += dt
  s.floaters = s.floaters.filter((f) => f.t < (f.tone === 'grow' ? 1.6 : 0.9))
}

/**
 * How many fish swim around you: by the water in view across and down, so a phone's tall, narrow view has
 * as many to chase as a wide screen (Ramsey, 2026-10-08: "we need more fish in the water to catch"). It was
 * by the width alone, which left a phone with three fish to eat in view where a desk had eleven.
 */
function crowd(s: GameState) {
  const half = viewHalf(s)
  return Math.round(clamp(((half.w + half.h) * 2) / 30, 16, 34) + Math.min(6, s.elapsed / 40))
}

/**
 * The share of what swims in that can eat you, scaled down as the count goes up so about as many hunters are in
 * view as when the water held the width's count: the fish added are food, not danger. A square root, as a
 * fuller sea turns over faster: the plain ratio left a phone with a third fewer hunters than before.
 */
function threatShare(s: GameState) {
  const half = viewHalf(s)
  const before = clamp((half.w * 2) / 30, 10, 26) + Math.min(6, s.elapsed / 40)
  return Math.min(1, Math.sqrt(before / crowd(s)))
}

export function tick(state: GameState, dt: number): GameState {
  const s: GameState = { ...state, player: { ...state.player }, time: state.time + dt, phaseTime: state.phaseTime + dt }
  s.fishes = state.fishes.map((f) => ({ ...f }))
  s.gulls = state.gulls.map((g) => ({ ...g }))
  s.particles = state.particles.map((q) => ({ ...q }))
  s.floaters = state.floaters.map((f) => ({ ...f }))
  if (state.shark) s.shark = { ...state.shark }
  const playing = s.phase === 'playing'
  if (playing) s.elapsed += dt
  if (s.phase === 'dying' && s.phaseTime >= DYING_TIME) {
    s.phase = 'gameover'
    s.phaseTime = 0
  }

  if (playing) movePlayer(s, dt)
  s.chainTime = Math.max(0, s.chainTime - dt)
  if (s.chainTime <= 0) s.chain = 0

  s.spawnIn -= dt
  const near = s.fishes.length
  if (s.spawnIn <= 0 && near < (s.phase === 'menu' ? 14 : crowd(s))) {
    spawn(s)
    s.spawnIn = rand(0.25, 0.6)
  }
  moveFishes(s, dt, playing)
  moveGulls(s, dt, playing)
  if (playing || s.shark) moveShark(s, dt, playing)
  moveBoat(s, dt, playing)
  if (s.frenzy > 0) {
    s.frenzy = Math.max(0, s.frenzy - dt)
    if (s.frenzy === 0) s.bar = 0
  }
  stepEffects(s, dt)
  // In the menu the camera drifts along the shallows.
  if (s.phase === 'menu') s.player.x = OCEAN_W / 2 + Math.sin(s.time * 0.05) * 300
  frame(s, Math.min(1, dt * 5))
  return s
}

/** What the page shows over the canvas, a few times a second. */
export type Snapshot = {
  phase: Phase
  score: number
  /** 1 to 8, and what you are at that size. */
  size: number
  stage: string
  lives: number
  deathCause: string
}

export function toSnapshot(s: GameState): Snapshot {
  return { phase: s.phase, score: Math.round(s.score), size: s.player.size + 1, stage: STAGES[s.player.size]!, lives: s.lives, deathCause: s.deathCause }
}
