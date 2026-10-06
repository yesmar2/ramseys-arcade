import { sfx } from '../../lib/sound'
import type { SpeciesId } from './species'

/*
 * Frenzy: the food chain (Ramsey, 2026-10-06, picking A from the "Frenzy remix lab": "let's go with A").
 *
 * One screen of water and short levels. Eat fish smaller than you to fill the bar: twice along it you grow
 * a size, and at its end the level is clear, and the next starts you small again with faster water. There
 * are no numbers on the fish: size and colour say who eats whom, and anything that can eat you has a red
 * eye and comes for you when you're near. Every so often a shark crosses the whole screen, after a warning
 * at the edge it comes from, and eats whatever is in its way. Three lives.
 *
 * Bites in quick succession build a chain, up to ×5. Everything here is in world units: the water is
 * WORLD_H tall and as wide as the screen's shape makes it (see resizeState); the renderer scales it to fit.
 */

export type Phase = 'menu' | 'playing' | 'clear' | 'dying' | 'gameover'

/** How tall the water is, in world units; its width follows the screen. */
export const WORLD_H = 500
const MIN_W = 280
const MAX_W = 1000

/** The sizes of fish, smallest first: their radius, and the kinds drawn at that size. */
export const TIERS: readonly { r: number; species: readonly SpeciesId[]; points: number }[] = [
  { r: 6, species: ['sardine', 'clownfish'], points: 10 },
  { r: 11, species: ['angelfish', 'tang'], points: 20 },
  { r: 18, species: ['puffer', 'grouper'], points: 40 },
  { r: 27, species: ['barracuda', 'swordfish'], points: 80 },
  { r: 38, species: ['anglerfish', 'grouper'], points: 160 },
]
/** The player's radius at each of its three sizes in a level (plus up to GROW_R as the bar fills toward the next). */
const PLAYER_R = [9, 14.5, 22] as const
const GROW_R = 3
/** Bites (weighted by size) to fill each third of the bar. */
const PER_SIZE = 10
const BAR = PER_SIZE * 3

const LIVES = 3
const PLAYER_SPEED = 215
const START_INVULN = 2
const RESPAWN_INVULN = 2.2
const CHAIN_WINDOW = 1.4
const MAX_CHAIN = 5
const CLEAR_TIME = 2.2
const DYING_TIME = 1.4
/** The shark: seconds of warning, its speed, its size. */
const SHARK_WARN = 1.4
const SHARK_SPEED = 330
const SHARK_R = 52

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
}

export type Player = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  roll: number
  swim: number
  mouth: number
  /** 0, 1 or 2: its size in this level. */
  size: number
  invuln: number
}

export type Shark = { stage: 'warn' | 'pass'; t: number; x: number; y: number; dir: 1 | -1; swim: number }

export type Particle = { x: number; y: number; vx: number; vy: number; r: number; t: number; life: number; color: string }
export type Floater = { x: number; y: number; text: string; t: number; tone: 'plain' | 'hot' | 'grow' | 'bad' }

export type Keys = { up: boolean; down: boolean; left: boolean; right: boolean }

export type GameState = {
  phase: Phase
  phaseTime: number
  /** Seconds since the run began (never paused time). */
  elapsed: number
  /** Seconds, for animation. */
  time: number
  /** The water's width in world units, and the screen's pixels per unit and where the water sits on it. */
  W: number
  ppu: number
  offX: number
  offY: number
  level: number
  /** How full the level's bar is, 0..BAR. */
  bar: number
  lives: number
  score: number
  chain: number
  chainTime: number
  player: Player
  fishes: Fish[]
  spawnIn: number
  shark: Shark | null
  sharkIn: number
  /** Where the fish is heading, in world units; null to coast to a stop. */
  target: { x: number; y: number } | null
  keys: Keys
  particles: Particle[]
  floaters: Floater[]
  nextId: number
  deathCause: string
  /** Bumped when the player grows, for the renderer's flash. */
  grew: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** The player's radius: its size, and a little more as the bar fills toward the next. */
export const playerRadius = (s: Pick<GameState, 'player' | 'bar'>) =>
  PLAYER_R[s.player.size]! + clamp((s.bar - s.player.size * PER_SIZE) / PER_SIZE, 0, 1) * GROW_R
export const fishRadius = (f: Pick<Fish, 'tier'>) => TIERS[f.tier]!.r
/** How full the bar is, 0..1, and where its two grow marks are. */
export const barFill = (s: Pick<GameState, 'bar'>) => clamp(s.bar / BAR, 0, 1)
export const GROW_MARKS = [1 / 3, 2 / 3] as const
/** The chain's multiplier. */
export const chainOf = (s: Pick<GameState, 'chain'>) => Math.max(1, Math.min(MAX_CHAIN, s.chain))
/** Points for a level cleared. */
export const clearBonus = (level: number) => 250 * level
export const SHARK_RADIUS = SHARK_R

function freshPlayer(W: number): Player {
  return { x: W / 2, y: WORLD_H / 2, vx: 0, vy: 0, angle: 0, roll: 1, swim: 0, mouth: 0, size: 0, invuln: START_INVULN }
}

export function createInitialState(w = 960, h = 540): GameState {
  const s: GameState = {
    phase: 'menu',
    phaseTime: 0,
    elapsed: 0,
    time: 0,
    W: 900,
    ppu: 1,
    offX: 0,
    offY: 0,
    level: 1,
    bar: 0,
    lives: LIVES,
    score: 0,
    chain: 0,
    chainTime: 0,
    player: freshPlayer(900),
    fishes: [],
    spawnIn: 0,
    shark: null,
    sharkIn: 14,
    target: null,
    keys: { up: false, down: false, left: false, right: false },
    particles: [],
    floaters: [],
    nextId: 1,
    deathCause: '',
    grew: 0,
  }
  const sized = resizeState(s, w, h)
  // The start card sits over a few fish already swimming.
  for (let i = 0; i < 9; i++) spawn(sized, true)
  return sized
}

/** Fit the water to a screen `w` by `h` pixels: always WORLD_H tall, as wide as the shape allows. */
export function resizeState(s: GameState, w: number, h: number): GameState {
  if (w <= 0 || h <= 0) return s
  const W = clamp((WORLD_H * w) / h, MIN_W, MAX_W)
  const ppu = Math.min(h / WORLD_H, w / W)
  const next = { ...s, W, ppu, offX: (w - W * ppu) / 2, offY: (h - WORLD_H * ppu) / 2 }
  if (W !== s.W) next.player = { ...s.player, x: clamp(s.player.x * (W / s.W), 12, W - 12) }
  return next
}

/** A screen point (px, from the canvas's top left) in world units. */
export function toWorld(s: GameState, px: number, py: number) {
  return { x: (px - s.offX) / s.ppu, y: (py - s.offY) / s.ppu }
}

export function startGame(s: GameState): GameState {
  sfx('wave')
  return {
    ...s,
    phase: 'playing',
    phaseTime: 0,
    elapsed: 0,
    level: 1,
    bar: 0,
    lives: LIVES,
    score: 0,
    chain: 0,
    chainTime: 0,
    player: freshPlayer(s.W),
    fishes: [],
    spawnIn: 0.3,
    shark: null,
    sharkIn: 16,
    target: null,
    particles: [],
    floaters: [{ x: s.W / 2, y: WORLD_H / 2 - 60, text: 'Level 1', t: 0, tone: 'grow' }],
    deathCause: '',
    grew: 0,
  }
}

export function setTarget(s: GameState, x: number, y: number): GameState {
  return { ...s, target: { x: clamp(x, 0, s.W), y: clamp(y, 0, WORLD_H) } }
}

export function clearTarget(s: GameState): GameState {
  return s.target ? { ...s, target: null } : s
}

export function setKey(s: GameState, key: keyof Keys, down: boolean): GameState {
  return s.keys[key] === down ? s : { ...s, keys: { ...s.keys, [key]: down } }
}

export function releaseInput(s: GameState): GameState {
  return { ...s, target: null, keys: { up: false, down: false, left: false, right: false } }
}

/** The mix of sizes that swim in: mostly ones you can eat, some your size and up. */
function pickTier(s: GameState, calm: boolean): number {
  const size = s.player.size
  const roll = Math.random()
  const threat = calm ? 0 : Math.min(0.42, 0.1 + s.level * 0.06)
  if (roll < threat) return clamp(size + 1 + (Math.random() < 0.22 + s.level * 0.03 ? 1 : 0), 0, TIERS.length - 1)
  if (roll < threat + 0.3) return size
  return size === 0 ? 0 : Math.floor(Math.random() * size)
}

function spawn(s: GameState, anywhere = false) {
  const tier = pickTier(s, anywhere)
  const t = TIERS[tier]!
  const left = Math.random() < 0.5
  const pace = 1 + (s.level - 1) * 0.12
  const speed = rand(28, 60) * pace * (tier > s.player.size ? 1.1 : 1)
  const species = t.species[Math.floor(Math.random() * t.species.length)]!
  // Little fish come in twos and threes.
  const n = tier === 0 && !anywhere ? 1 + Math.floor(Math.random() * 3) : 1
  const y = rand(40, WORLD_H - 30)
  for (let i = 0; i < n; i++) {
    s.fishes.push({
      id: s.nextId++,
      tier,
      species,
      x: anywhere ? rand(40, s.W - 40) : left ? -30 - i * 16 : s.W + 30 + i * 16,
      y: clamp(y + rand(-14, 14), 30, WORLD_H - 20),
      vx: left ? speed : -speed,
      vy: 0,
      angle: left ? 0 : Math.PI,
      roll: left ? 1 : -1,
      swim: rand(0, 6.28),
      mouth: 0,
      seed: Math.random() * 1000,
      hunt: 0,
      fade: anywhere ? 1 : 0,
    })
  }
}

function burst(s: GameState, x: number, y: number, color: string, n: number, speed = 90) {
  for (let i = 0; i < n && s.particles.length < 260; i++) {
    const a = rand(0, Math.PI * 2)
    const v = rand(speed * 0.3, speed)
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, r: rand(1.4, 3.4), t: 0, life: rand(0.35, 0.75), color })
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
}

/** One step of the player: toward the target, or the way the keys say, quick to turn and quick to stop. */
function movePlayer(s: GameState, dt: number) {
  const p = s.player
  const speed = PLAYER_SPEED + p.size * 10
  let tvx = 0
  let tvy = 0
  const kx = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0)
  const ky = (s.keys.down ? 1 : 0) - (s.keys.up ? 1 : 0)
  if (kx || ky) {
    const l = Math.hypot(kx, ky)
    tvx = (kx / l) * speed
    tvy = (ky / l) * speed
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
  const r = playerRadius(s)
  p.x = clamp(p.x + p.vx * dt, r, s.W - r)
  p.y = clamp(p.y + p.vy * dt, r, WORLD_H - r)
  const sp = Math.hypot(p.vx, p.vy)
  if (sp > 12) {
    p.angle = turnToward(p.angle, Math.atan2(p.vy, p.vx), 14 * dt)
    const up = Math.cos(p.angle) >= 0 ? 1 : -1
    p.roll += (up - p.roll) * Math.min(1, 8 * dt)
  }
  p.swim += dt * (4 + (sp / speed) * 8)
  p.mouth = Math.max(0, p.mouth - dt * 5)
  p.invuln = Math.max(0, p.invuln - dt)
}

function eat(s: GameState, f: Fish) {
  const p = s.player
  p.mouth = 1
  s.chain = s.chainTime > 0 ? s.chain + 1 : 1
  s.chainTime = CHAIN_WINDOW
  const mult = chainOf(s)
  const pts = TIERS[f.tier]!.points * mult
  s.score += pts
  s.floaters.push({ x: f.x, y: f.y - 8, text: mult > 1 ? `+${pts} ×${mult}` : `+${pts}`, t: 0, tone: mult > 2 ? 'hot' : 'plain' })
  burst(s, f.x, f.y, '#ffffff', 7, 70)
  sfx('eat')
  if (mult > 1) sfx('hop', Math.min(12, (mult - 1) * 3))
  // A bigger bite fills more of the bar; a fish two sizes down, less.
  const before = s.bar
  s.bar = Math.min(BAR, s.bar + (f.tier + 1) / (p.size + 1))
  const sizeNow = Math.min(2, Math.floor(s.bar / PER_SIZE))
  if (sizeNow > p.size && Math.floor(before / PER_SIZE) < sizeNow) {
    p.size = sizeNow
    s.grew++
    s.floaters.push({ x: p.x, y: p.y - 30, text: 'Grow!', t: 0, tone: 'grow' })
    burst(s, p.x, p.y, '#3ecf8e', 18, 120)
    sfx('good')
  }
  if (s.bar >= BAR) {
    const bonus = clearBonus(s.level)
    s.score += bonus
    s.phase = 'clear'
    s.phaseTime = 0
    s.floaters.push({ x: s.W / 2, y: WORLD_H / 2 - 40, text: `+${bonus}`, t: 0, tone: 'hot' })
    sfx('perfect')
  }
}

function hurt(s: GameState, by: string) {
  const p = s.player
  s.lives -= 1
  s.chain = 0
  s.chainTime = 0
  burst(s, p.x, p.y, '#ffffff', 20, 140)
  if (s.lives <= 0) {
    s.phase = 'dying'
    s.phaseTime = 0
    s.deathCause = `Eaten by ${by}`
    sfx('die')
    return
  }
  sfx('hurt')
  s.floaters.push({ x: p.x, y: p.y - 26, text: `${s.lives} left`, t: 0, tone: 'bad' })
  Object.assign(p, { x: s.W / 2, y: WORLD_H / 2, vx: 0, vy: 0, invuln: RESPAWN_INVULN })
  s.target = null
}

function moveFishes(s: GameState, dt: number, playing: boolean) {
  const p = s.player
  const pr = playerRadius(s)
  const pace = 1 + (s.level - 1) * 0.1
  for (const f of s.fishes) {
    const fr = fishRadius(f)
    const dx = p.x - f.x
    const dy = p.y - f.y
    const d = Math.hypot(dx, dy)
    const bigger = f.tier > p.size
    if (playing && bigger && d < 150 + fr && p.invuln <= 0) {
      // Comes for you, a little slower than you swim, so you can always get away.
      f.hunt = Math.min(1, f.hunt + dt * 2.5)
      const sp = (100 + f.tier * 6) * pace
      f.vx += ((dx / d) * sp - f.vx) * dt * 2.2
      f.vy += ((dy / d) * sp - f.vy) * dt * 2.2
    } else if (playing && !bigger && d < 80 + fr) {
      // Runs from you, but not fast enough to get away from a chase.
      f.vx -= (dx / (d || 1)) * 170 * dt
      f.vy -= (dy / (d || 1)) * 170 * dt
    } else {
      f.hunt = Math.max(0, f.hunt - dt)
      f.vy += (Math.sin(s.time * 0.9 + f.seed) * 12 - f.vy) * dt
      // Back to cruising the way it was going.
      const dir = f.vx >= 0 ? 1 : -1
      const cruise = (40 + f.tier * 4) * pace
      if (Math.abs(f.vx) < cruise * 0.6) f.vx += dir * cruise * dt
    }
    const sp = Math.hypot(f.vx, f.vy)
    const cap = (78 + f.tier * 10) * pace * (f.hunt > 0.5 ? 1.25 : 1)
    if (sp > cap) {
      f.vx *= cap / sp
      f.vy *= cap / sp
    }
    f.x += f.vx * dt
    f.y = clamp(f.y + f.vy * dt, fr, WORLD_H - fr)
    if (Math.hypot(f.vx, f.vy) > 5) {
      f.angle = turnToward(f.angle, Math.atan2(f.vy, f.vx), 6 * dt)
      const up = Math.cos(f.angle) >= 0 ? 1 : -1
      f.roll += (up - f.roll) * Math.min(1, 5 * dt)
    }
    f.swim += dt * (3 + Math.hypot(f.vx, f.vy) / 25)
    f.fade = Math.min(1, f.fade + dt * 3)
    f.mouth = f.hunt > 0.6 && d < pr + fr + 40 ? Math.min(1, f.mouth + dt * 5) : Math.max(0, f.mouth - dt * 4)
    if (!playing) continue
    if (d < (pr + fr) * 0.78) {
      if (!bigger) {
        eat(s, f)
        f.tier = -1
        if (s.phase !== 'playing') break
      } else if (p.invuln <= 0) {
        hurt(s, NAMES[f.species] ?? 'a bigger fish')
        if (s.phase !== 'playing') break
      }
    }
  }
  s.fishes = s.fishes.filter((f) => f.tier >= 0 && f.x > -80 && f.x < s.W + 80)
}

function moveShark(s: GameState, dt: number, playing: boolean) {
  s.sharkIn -= dt
  if (!s.shark && s.sharkIn <= SHARK_WARN && playing) {
    const dir = Math.random() < 0.5 ? 1 : -1
    s.shark = { stage: 'warn', t: 0, x: dir > 0 ? -SHARK_R * 2 : s.W + SHARK_R * 2, y: rand(80, WORLD_H - 70), dir, swim: 0 }
    sfx('whoosh')
  }
  const k = s.shark
  if (!k) return
  k.t += dt
  if (k.stage === 'warn') {
    if (k.t >= SHARK_WARN) {
      k.stage = 'pass'
      k.t = 0
    }
    return
  }
  k.x += k.dir * SHARK_SPEED * (1 + (s.level - 1) * 0.06) * dt
  k.swim += dt * 14
  for (const f of s.fishes) {
    if (Math.abs(f.x - k.x) < SHARK_R && Math.abs(f.y - k.y) < SHARK_R * 0.5) {
      f.tier = -1
      burst(s, f.x, f.y, '#ffffff', 4, 60)
    }
  }
  s.fishes = s.fishes.filter((f) => f.tier >= 0)
  const p = s.player
  if (playing && p.invuln <= 0 && Math.abs(p.x - k.x) < SHARK_R * 0.95 && Math.abs(p.y - k.y) < SHARK_R * 0.45 + playerRadius(s) * 0.5) {
    hurt(s, 'the shark')
  }
  if (k.x < -SHARK_R * 3 || k.x > s.W + SHARK_R * 3) {
    s.shark = null
    s.sharkIn = rand(13, 19) / (1 + (s.level - 1) * 0.08)
  }
}

function stepEffects(s: GameState, dt: number) {
  for (const q of s.particles) {
    q.t += dt
    q.x += q.vx * dt
    q.y += q.vy * dt
    q.vx *= 0.92
    q.vy *= 0.92
  }
  s.particles = s.particles.filter((q) => q.t < q.life)
  for (const f of s.floaters) f.t += dt
  s.floaters = s.floaters.filter((f) => f.t < (f.tone === 'grow' ? 1.3 : 0.9))
}

/** How many fish the water holds: more with width and with each level, never a crowd. */
const crowd = (s: GameState) => Math.round((10 + s.level * 1.5) * Math.min(2.2, Math.max(1, s.W / 360)))

export function tick(state: GameState, dt: number): GameState {
  const s: GameState = { ...state, player: { ...state.player }, time: state.time + dt, phaseTime: state.phaseTime + dt }
  s.fishes = state.fishes.map((f) => ({ ...f }))
  s.particles = state.particles.map((q) => ({ ...q }))
  s.floaters = state.floaters.map((f) => ({ ...f }))
  if (state.shark) s.shark = { ...state.shark }
  const playing = s.phase === 'playing'
  if (playing) s.elapsed += dt

  if (s.phase === 'clear' && s.phaseTime >= CLEAR_TIME) {
    // The next level: small again, in faster water.
    s.level += 1
    s.bar = 0
    s.phase = 'playing'
    s.phaseTime = 0
    s.player = { ...s.player, size: 0, invuln: 1.5 }
    s.fishes = []
    s.spawnIn = 0.2
    s.floaters.push({ x: s.W / 2, y: WORLD_H / 2 - 60, text: `Level ${s.level}`, t: 0, tone: 'grow' })
    sfx('wave')
  }
  if (s.phase === 'dying' && s.phaseTime >= DYING_TIME) {
    s.phase = 'gameover'
    s.phaseTime = 0
  }

  if (playing) movePlayer(s, dt)
  s.chainTime = Math.max(0, s.chainTime - dt)
  if (s.chainTime <= 0) s.chain = 0

  // In the menu and between levels the water keeps a few fish swimming.
  s.spawnIn -= dt
  const room = s.phase === 'menu' ? 9 : s.phase === 'clear' ? 0 : crowd(s)
  if (s.spawnIn <= 0 && s.fishes.length < room) {
    spawn(s)
    s.spawnIn = rand(0.35, 0.8) / (1 + (s.level - 1) * 0.1)
  }
  moveFishes(s, dt, playing)
  if (s.phase === 'playing' || s.shark) moveShark(s, dt, s.phase === 'playing')
  stepEffects(s, dt)
  return s
}

/** What the page shows over the canvas, a few times a second. */
export type Snapshot = {
  phase: Phase
  score: number
  level: number
  lives: number
  deathCause: string
}

export function toSnapshot(s: GameState): Snapshot {
  return { phase: s.phase, score: Math.round(s.score), level: s.level, lives: s.lives, deathCause: s.deathCause }
}
