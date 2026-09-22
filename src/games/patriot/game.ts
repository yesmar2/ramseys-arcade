import type { Swatch } from '../../data/games'
import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

/**
 * `dying` is the last city going down: the sky plays on in slow motion for a
 * moment, with nothing left to score, before the card.
 */
export type Phase = 'menu' | 'playing' | 'waveClear' | 'dying' | 'gameover'

export type City = {
  id: number
  x: number
  alive: boolean
  /** One-hit dome; cleared when a missile hits this city. */
  shielded: boolean
}

export type Battery = {
  id: number
  x: number
  ammo: number
  alive: boolean
  /** 1 → 0 after a shot: the barrel's kick and the muzzle flash. */
  kick?: number
}

/** A colour an effect is drawn in; the renderer turns it into the theme's shade. */
export type Tone = 'gold' | 'red' | 'teal' | 'sky' | 'violet' | 'ink' | 'orange' | 'green' | 'pink' | 'hot'

export type ParticleKind = 'spark' | 'debris' | 'smoke' | 'ember'

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  /** 1 → 0. */
  life: number
  maxLife: number
  /** Radius in stage pixels. */
  size: number
  kind: ParticleKind
  tone: Tone
  /** Hue override, for the Seeker's coloured charges. */
  hue?: number
}

export type Banner = { text: string; sub: string; tone: Tone; life: number; maxLife: number }

export type Incoming = {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
  x: number
  y: number
  speed: number
  aim: Aim
  /** Violet MIRVs fork at mid-descent. */
  kind: 'normal' | 'split'
}

export type PowerKind = 'ammo' | 'shield' | 'slow' | 'burst'

export type PowerPack = Record<PowerKind, number>

export type Drone = {
  id: number
  kind: PowerKind
  x: number
  y: number
  vx: number
}

export type Aim =
  | { type: 'city'; id: number }
  | { type: 'battery'; id: number }
  | { type: 'ground'; x: number }

export type Plane = {
  id: number
  x: number
  y: number
  vx: number
  dropsLeft: number
  dropTimer: number
}

/** Heavy bomber that patrols on-screen until shot down. */
export type Bomber = {
  id: number
  x: number
  y: number
  vx: number
  hp: number
  maxHp: number
  dropTimer: number
  /** Blast ids that already dealt damage (one hit per blast). */
  hitBy: number[]
}

export type Shot = {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
  x: number
  y: number
  speed: number
  burst: boolean
}

export type Blast = {
  id: number
  x: number
  y: number
  r: number
  maxR: number
  growing: boolean
  burst: boolean
  /** Seconds before the blast starts growing. */
  wait: number
  /** Radius growth per second, before scale. */
  growRate: number
  /**
   * True after a direct/perfect hit (or chain from one).
   * Splash kills on these blasts do not break the direct streak.
   */
  fromPerfect?: boolean
  /**
   * Where a shot the player fired went off. Only these can score a direct.
   *
   * Every other blast is centred on a point nobody chose — a missile's grave,
   * a Seeker ring, a bomber coming apart — so a missile drifting through the
   * middle of one was collecting +100 and a streak for a shot that was never
   * aimed at it.
   */
  aimed?: boolean
  /** Overrides the drawn colour. The Seeker ring sets one per blast. */
  hue?: number
  /**
   * The chain this blast belongs to: the shot that started it, and every
   * blast its kills set off. Each kill in a chain pays more than the last.
   */
  chain?: number
}

export type Floater = {
  id: number
  x: number
  y: number
  text: string
  life: number
  /** A smaller line under the text. */
  sub?: string
  tone?: Tone
  /** Drawn larger, for the kills that matter. */
  big?: boolean
}

export type Snapshot = {
  score: number
  best: number
  wave: number
  phase: Phase
  ammoLeft: number
  citiesLeft: number
  clearBonus: WaveClearBonus | null
  pack: PowerPack
  shieldT: number
  slowT: number
  burstArmed: boolean
  /** Peak consecutive direct hits this run. */
  directStreakBest: number
}

export type WaveClearBonus = {
  perfect: boolean
  rebuilt: boolean
  cities: number
  cityBonus: number
  ammoBonus: number
  cleanStreak: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  wave: number
  cities: City[]
  batteries: Battery[]
  incoming: Incoming[]
  planes: Plane[]
  bombers: Bomber[]
  drones: Drone[]
  shots: Shot[]
  blasts: Blast[]
  floaters: Floater[]
  cursor: { x: number; y: number }
  spawnTimer: number
  toSpawn: number
  droneTimer: number
  droneQueue: PowerKind[]
  dronePass: number
  pack: PowerPack
  shieldT: number
  slowT: number
  burstArmed: boolean
  wavePause: number
  flash: number
  groundY: number
  /** Stage the pixels in this state were laid out against. */
  stageW: number
  stageH: number
  /** Scale vs design 16:9 stage (960×540). */
  scale: number
  clearBonus: WaveClearBonus | null
  /** Cities still standing when the current wave began. */
  citiesAtWaveStart: number
  /** Consecutive waves cleared without losing a city. */
  cleanStreak: number
  /** Current consecutive direct (perfect) hits. */
  directStreak: number
  /** Best consecutive direct hits this run. */
  directStreakBest: number
  /** Kills so far in each chain still on screen, by chain id. */
  chains: Record<number, number>
  /** Longest chain this run. */
  chainBest: number
  particles: Particle[]
  banner: Banner | null
  /** 1 → 0, how hard the screen is shaking. */
  shake: number
  /** Seconds since this state was made, menus included. Drives idle motion. */
  time: number
  /** Seconds of the fall left, before the card. */
  dying: number
  /** Powers just taken from a shot-down carrier, on their way to the column. */
  pickups: Pickup[]
  /** Seconds since the domes last went up, for the rise. */
  shieldAge: number
  /** 1 → 0 after an ammo power: the racks glow while they fill. */
  reloadT: number
}

export type Pickup = { id: number; kind: PowerKind; x: number; y: number; age: number }

/** How long a taken power takes to fly to the column. */
export const PICKUP_FLIGHT = 0.7

/** Design reference for the fixed 16:9 playfield. */
export const DESIGN_W = 960
export const DESIGN_H = 540
/**
 * Draw smaller than the stage so the field feels zoomed out. Everything that
 * moves divides this back out again, so the zoom sets how big the world looks
 * without touching how fast it plays.
 */
const VIEW_ZOOM = 0.9

export function worldScale(w: number, h: number) {
  return (Math.min(w / DESIGN_W, h / DESIGN_H) || 1) * VIEW_ZOOM
}

function loadBest() {
  return getPersonalBest('patriot')
}

const BATTERY_AMMO = 10
const AMMO_PACK = 10
const BLAST_MAX = 82
const BLAST_BURST = 152
/** Extra radius a perfect hit adds when the blast regrows. */
const BLAST_REGROW = 52
const DIRECT_HIT_RADIUS = 16
const SCORE_SPLASH = 25
const SCORE_DIRECT = 100
const SCORE_CITY = 100
const SCORE_AMMO = 5
const SCORE_PLANE = 200
const SCORE_BOMBER = 400
/** Horizontal distance at which a ground hit kills a city / turret. */
const CITY_HIT_RANGE = 38
const BATTERY_HIT_RANGE = 52
const SPLIT_FROM_WAVE = 3
const SPLIT_AT = 0.5
const CLEAN_WAVES_TO_REBUILD = 1
const PLANE_FROM_WAVE = 5
const BOMBER_FROM_WAVE = 6
const DRONE_FROM_WAVE = 2
/**
 * The Seeker's ring goes off in colour, one per charge, in the order they
 * bloom — it is the one thing in the game that fires itself, and six identical
 * violet circles gave the most expensive power the plainest explosion.
 */
const SEEKER_HUES = [272, 320, 12, 48, 140, 190]
const POWER_MAX = 3
export const SLOW_TIME = 5
const SLOW_RATE = 0.32
const CITY_DRAW = 1.85
/** How long the fall plays before the card. */
const DYING_TIME = 1.8

export function shieldRadius(scale: number) {
  return 38 * CITY_DRAW * scale
}

export const POWER_ORDER: PowerKind[] = ['ammo', 'shield', 'slow', 'burst']
export const POWER_LABEL: Record<PowerKind, string> = {
  ammo: 'Ammo',
  shield: 'Shield',
  slow: 'Slow',
  burst: 'Seeker',
}
export const POWER_TONE: Record<PowerKind, Tone> = {
  ammo: 'gold',
  shield: 'teal',
  slow: 'sky',
  burst: 'violet',
}
/** Each power's palette colour, shared by its blimp, its badge and its button. */
export const POWER_SWATCH: Record<PowerKind, Swatch> = {
  ammo: 'amber',
  shield: 'teal',
  slow: 'sky',
  burst: 'violet',
}

function emptyPack(): PowerPack {
  return { ammo: 0, shield: 0, slow: 0, burst: 0 }
}

let nextId = 1
function uid() {
  return nextId++
}

function layoutWorld(w: number, h: number) {
  // Leaves room under the turrets for the ammo rack now the art draws bigger.
  const groundY = h * 0.9
  const scale = worldScale(w, h)
  const edge = Math.max(w * 0.06, 22 * scale * 1.85)
  const left = edge
  const right = w - edge
  // Turret, city, city, city, turret, city, city, city, turret
  const slots = 9
  const step = (right - left) / (slots - 1)
  const xAt = (i: number) => left + i * step

  const batteries: Battery[] = [0, 4, 8].map((slot, i) => ({
    id: i,
    x: xAt(slot),
    ammo: BATTERY_AMMO,
    alive: true,
    kick: 0,
  }))

  const cities: City[] = [1, 2, 3, 5, 6, 7].map((slot, i) => ({
    id: i,
    x: xAt(slot),
    alive: true,
    shielded: false,
  }))

  return { groundY, cities, batteries, scale }
}

export function createInitialState(w = DESIGN_W, h = DESIGN_H): GameState {
  const { groundY, cities, batteries, scale } = layoutWorld(w, h)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    wave: 1,
    cities,
    batteries,
    incoming: [],
    planes: [],
    bombers: [],
    drones: [],
    shots: [],
    blasts: [],
    floaters: [],
    cursor: { x: w / 2, y: h * 0.4 },
    spawnTimer: 0,
    toSpawn: 0,
    droneTimer: 0,
    droneQueue: [],
    dronePass: 0,
    pack: emptyPack(),
    shieldT: 0,
    slowT: 0,
    burstArmed: false,
    wavePause: 0,
    flash: 0,
    groundY,
    stageW: w,
    stageH: h,
    scale,
    clearBonus: null,
    citiesAtWaveStart: cities.length,
    cleanStreak: 0,
    directStreak: 0,
    directStreakBest: 0,
    chains: {},
    chainBest: 0,
    particles: [],
    banner: null,
    shake: 0,
    time: 0,
    dying: 0,
    pickups: [],
    shieldAge: 99,
    reloadT: 0,
  }
}

/**
 * Move the world onto a new stage. Everything in flight is stored in stage
 * pixels — including the point a missile is already aimed at — so it all has
 * to come along. Leave it behind and a missile keeps flying at a ground line
 * and a city that have both moved, detonates in open sky, and takes out
 * whichever city now happens to sit near its stale target x.
 */
export function resizeState(state: GameState, w: number, h: number): GameState {
  if (w <= 0 || h <= 0) return state
  const { groundY, cities, batteries, scale } = layoutWorld(w, h)
  const sx = w / (state.stageW || w)
  const sy = h / (state.stageH || h)
  /** Lengths and speeds, which are all laid down as multiples of scale. */
  const k = scale / (state.scale || scale)
  const moveAim = (aim: Aim): Aim =>
    aim.type === 'ground' ? { ...aim, x: aim.x * sx } : aim

  return {
    ...state,
    groundY,
    stageW: w,
    stageH: h,
    scale,
    cities: cities.map((c, i) => ({
      ...c,
      alive: state.cities[i]?.alive ?? true,
      shielded: state.cities[i]?.shielded ?? false,
    })),
    batteries: batteries.map((b, i) => ({
      ...b,
      ammo: state.batteries[i]?.ammo ?? BATTERY_AMMO,
      alive: state.batteries[i]?.alive ?? true,
    })),
    incoming: state.incoming.map((m) => ({
      ...m,
      x0: m.x0 * sx,
      y0: m.y0 * sy,
      x1: m.x1 * sx,
      y1: m.y1 * sy,
      x: m.x * sx,
      y: m.y * sy,
      speed: m.speed * k,
      aim: moveAim(m.aim),
    })),
    shots: state.shots.map((s) => ({
      ...s,
      x0: s.x0 * sx,
      y0: s.y0 * sy,
      x1: s.x1 * sx,
      y1: s.y1 * sy,
      x: s.x * sx,
      y: s.y * sy,
      speed: s.speed * k,
    })),
    // growRate stays put: it is multiplied by the live scale on every tick.
    blasts: state.blasts.map((b) => ({
      ...b,
      x: b.x * sx,
      y: b.y * sy,
      r: b.r * k,
      maxR: b.maxR * k,
    })),
    planes: state.planes.map((p) => ({
      ...p,
      x: p.x * sx,
      y: p.y * sy,
      vx: p.vx * k,
    })),
    bombers: (state.bombers ?? []).map((b) => ({
      ...b,
      x: b.x * sx,
      y: b.y * sy,
      vx: b.vx * k,
    })),
    drones: (state.drones ?? []).map((d) => ({
      ...d,
      x: d.x * sx,
      y: d.y * sy,
      vx: d.vx * k,
    })),
    floaters: state.floaters.map((f) => ({ ...f, x: f.x * sx, y: f.y * sy })),
    particles: (state.particles ?? []).map((p) => ({
      ...p,
      x: p.x * sx,
      y: p.y * sy,
      vx: p.vx * k,
      vy: p.vy * k,
      size: p.size * k,
    })),
    pickups: (state.pickups ?? []).map((p) => ({ ...p, x: p.x * sx, y: p.y * sy })),
    cursor: { x: state.cursor.x * sx, y: state.cursor.y * sy },
  }
}

// Effects ------------------------------------------------------------------------

const MAX_PARTICLES = 420

/** Scatter `count` particles from a point. Speeds and sizes are in design pixels. */
function emit(
  s: GameState,
  kind: ParticleKind,
  x: number,
  y: number,
  count: number,
  speed: number,
  size: number,
  tone: Tone,
  life: number,
  opts: { up?: number; spread?: number; angle?: number; hue?: number } = {},
) {
  const scale = s.scale
  const list = s.particles
  for (let i = 0; i < count; i++) {
    if (list.length >= MAX_PARTICLES) list.shift()
    const a =
      opts.angle != null
        ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? 0.8)
        : Math.random() * Math.PI * 2
    const v = speed * (0.35 + Math.random() * 0.65) * scale
    list.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - (opts.up ?? 0) * scale,
      life: 1,
      maxLife: life * (0.6 + Math.random() * 0.7),
      size: size * (0.6 + Math.random() * 0.8) * scale,
      kind,
      tone,
      hue: opts.hue,
    })
  }
}

function banner(s: GameState, text: string, sub: string, tone: Tone, life = 2) {
  s.banner = { text, sub, tone, life, maxLife: life }
}

/** Particles fall, drift and fade; the shake settles; barrels come back from their kick. */
function updateEffects(s: GameState, dt: number) {
  const particles: Particle[] = []
  const g = 260 * s.scale
  for (const p of s.particles ?? []) {
    const life = p.life - dt / p.maxLife
    if (life <= 0) continue
    let { vx, vy } = p
    if (p.kind === 'debris') {
      vy += g * dt
      vx *= Math.exp(-dt * 0.8)
    } else if (p.kind === 'smoke') {
      // Smoke slows, then rises and spreads.
      vx *= Math.exp(-dt * 2.2)
      vy = vy * Math.exp(-dt * 2.2) - 16 * s.scale * dt
    } else if (p.kind === 'ember') {
      vy -= 22 * s.scale * dt
      vx += Math.sin((s.time + p.maxLife) * 5) * 10 * s.scale * dt
    } else {
      const drag = Math.exp(-dt * 3.2)
      vx *= drag
      vy = vy * drag + g * 0.25 * dt
    }
    let y = p.y + vy * dt
    // Debris lands on the ground and stays put while it fades.
    if (p.kind === 'debris' && y > s.groundY) {
      y = s.groundY
      vy = 0
      vx *= 0.5
    }
    particles.push({ ...p, life, x: p.x + vx * dt, y, vx, vy })
  }
  s.particles = particles
  s.shake = Math.max(0, (s.shake ?? 0) - dt * 2.4)
  s.shieldAge = (s.shieldAge ?? 99) + dt
  s.reloadT = Math.max(0, (s.reloadT ?? 0) - dt * 1.4)
  if (s.pickups?.length) {
    s.pickups = s.pickups
      .map((p) => ({ ...p, age: p.age + dt }))
      .filter((p) => p.age < PICKUP_FLIGHT)
  }
  if (s.banner) {
    const life = s.banner.life - dt
    s.banner = life > 0 ? { ...s.banner, life } : null
  }
  if (s.batteries.some((b) => (b.kick ?? 0) > 0)) {
    s.batteries = s.batteries.map((b) =>
      (b.kick ?? 0) > 0 ? { ...b, kick: Math.max(0, (b.kick ?? 0) - dt * 4) } : b,
    )
  }
}

/** A missile coming apart: sparks in the blast's colour and a puff of smoke. */
function killBurst(s: GameState, x: number, y: number, hue: number | undefined, big: boolean) {
  emit(s, 'spark', x, y, big ? 14 : 8, big ? 230 : 170, 1.6, 'hot', 0.5, { hue })
  emit(s, 'smoke', x, y, big ? 3 : 2, 30, 7, 'ink', 1.4)
}

/** A city or battery hit: a column of fire, debris, and smoke that stays a while. */
function groundBurst(s: GameState, x: number, heavy: boolean) {
  const y = s.groundY - 6 * s.scale
  emit(s, 'debris', x, y, heavy ? 22 : 14, 170, 2.2, 'ink', 1.6, { angle: -Math.PI / 2, spread: 1.9, up: 60 })
  emit(s, 'spark', x, y, heavy ? 20 : 12, 220, 1.8, 'hot', 0.6, { angle: -Math.PI / 2, spread: 2.4 })
  emit(s, 'smoke', x, y - 8 * s.scale, heavy ? 8 : 5, 40, 11, 'ink', 2.4, { angle: -Math.PI / 2, spread: 1.4 })
  emit(s, 'ember', x, y, heavy ? 10 : 6, 60, 1.3, 'orange', 2.2, { angle: -Math.PI / 2, spread: 1.6 })
}

const CHAIN_BANNER_AT = 5
/** A chain's n-th kill is worth n times the first, up to this many times. */
const CHAIN_MULT_MAX = 8

function waveNote(wave: number) {
  if (wave === 1) return 'Aim ahead of them — a blast has to be there when they arrive'
  if (wave === DRONE_FROM_WAVE) return 'Shoot a drone to take what it carries'
  if (wave === SPLIT_FROM_WAVE) return 'Violet missiles split halfway down'
  if (wave === PLANE_FROM_WAVE) return 'Planes cross the sky, dropping more'
  if (waveHasBomber(wave) && wave === BOMBER_FROM_WAVE) return 'A bomber: it takes several blasts'
  if (waveHasBomber(wave)) return 'Bomber inbound'
  return `${waveIncomingCount(wave)} incoming`
}

function splitterChance(wave: number) {
  if (wave < SPLIT_FROM_WAVE) return 0
  return Math.min(0.22, 0.1 + (wave - SPLIT_FROM_WAVE) * 0.022)
}

function waveHasBomber(wave: number) {
  return wave >= BOMBER_FROM_WAVE && wave % 3 === 0
}

function waveHasPlane(wave: number) {
  if (waveHasBomber(wave)) return false
  return wave >= PLANE_FROM_WAVE && wave % 3 !== 1
}

function waveIncomingCount(wave: number) {
  // Was 5 + wave for the first three, which opened on six missiles and thirty
  // shells. The two branches after it both worked out to wave + 7, so the
  // whole curve is that line now and the opening simply starts on it.
  let n = 7 + wave
  // Bomber drops replace some sky traffic so overall pressure stays similar.
  if (waveHasBomber(wave)) n = Math.max(5, n - 3)
  return n
}

function bomberMaxHp(wave: number) {
  return Math.min(7, 4 + Math.floor((wave - BOMBER_FROM_WAVE) / 3))
}

function waveSpeed(wave: number, scale: number) {
  // Starts about a tenth quicker and climbs more gently to meet the old line
  // exactly at wave 6, so only the opening changes.
  const n = wave <= 6 ? 52 + wave * 4 : 76 + (wave - 6) * 3.5
  // Same VIEW_ZOOM correction every other moving thing gets — without it the
  // sky falls at a fraction of the speed the turrets shoot at.
  return n * (scale / VIEW_ZOOM)
}

export function startGame(prev: GameState, w: number, h: number): GameState {
  const base = createInitialState(w, h)
  return beginWave(
    {
      ...base,
      best: Math.max(prev.best, loadBest()),
      phase: 'playing',
      wave: 1,
    },
    1,
    w,
  )
}

function makePlane(state: GameState, w: number, wave: number): Plane {
  const fromLeft = Math.random() < 0.5
  const speed = (70 + wave * 3) * (state.scale / VIEW_ZOOM)
  return {
    id: uid(),
    x: fromLeft ? -48 : w + 48,
    y: state.groundY * (0.18 + Math.random() * 0.1),
    vx: fromLeft ? speed : -speed,
    dropsLeft: 2,
    dropTimer: 0.45,
  }
}

function makeBomber(state: GameState, w: number, wave: number): Bomber {
  const fromLeft = Math.random() < 0.5
  const speed = (38 + wave * 1.6) * (state.scale / VIEW_ZOOM)
  const hp = bomberMaxHp(wave)
  const margin = Math.max(48, w * 0.1)
  return {
    id: uid(),
    x: fromLeft ? margin : w - margin,
    y: state.groundY * (0.16 + Math.random() * 0.06),
    vx: fromLeft ? speed : -speed,
    hp,
    maxHp: hp,
    dropTimer: 1.1,
    hitBy: [],
  }
}

function scheduledDrones(wave: number): PowerKind[] {
  if (wave < DRONE_FROM_WAVE) return []
  const pattern: PowerKind[][] = [
    ['ammo'],
    ['shield'],
    ['burst'],
    [],
    ['ammo', 'slow'],
    [],
    ['ammo', 'burst'],
    [],
    ['ammo', 'shield'],
    [],
    ['slow', 'burst'],
    [],
  ]
  return pattern[(wave - DRONE_FROM_WAVE) % pattern.length]
}

function makeDrone(state: GameState, w: number, kind: PowerKind, pass: number): Drone {
  const fromLeft = pass === 0 ? state.wave % 4 === 2 : state.wave % 4 !== 2
  const speed = (108 + state.wave * 8) * (state.scale / VIEW_ZOOM)
  return {
    id: uid(),
    kind,
    x: fromLeft ? -40 : w + 40,
    y: state.groundY * (pass === 0 ? 0.4 : 0.26),
    vx: fromLeft ? speed : -speed,
  }
}

function beginWave(state: GameState, wave: number, w: number): GameState {
  const droneQueue = scheduledDrones(wave)
  return {
    ...state,
    phase: 'playing',
    wave,
    banner: { text: `Wave ${wave}`, sub: waveNote(wave), tone: 'gold', life: 2.2, maxLife: 2.2 },
    chains: {},
    cities: state.cities.map((c) => ({ ...c, shielded: false })),
    batteries: state.batteries.map((b) => ({
      ...b,
      alive: true,
      ammo: BATTERY_AMMO,
      kick: 0,
    })),
    incoming: [],
    planes: waveHasPlane(wave) ? [makePlane(state, w, wave)] : [],
    bombers: waveHasBomber(wave) ? [makeBomber(state, w, wave)] : [],
    drones: [],
    shots: [],
    blasts: [],
    floaters: [],
    toSpawn: waveIncomingCount(wave),
    spawnTimer: 0.55,
    droneTimer: droneQueue.length > 0 ? 2.2 : 0,
    droneQueue,
    dronePass: 0,
    shieldT: 0,
    slowT: 0,
    wavePause: 0,
    clearBonus: null,
    citiesAtWaveStart: state.cities.filter((c) => c.alive).length,
  }
}

/** Admin/testing: jump straight into a wave without clear bonuses. */
export function jumpToWave(state: GameState, wave: number, w: number): GameState {
  if (state.phase !== 'playing' && state.phase !== 'waveClear') return state
  const next = Math.max(1, Math.floor(wave) || 1)
  return beginWave(state, next, w)
}

export function setCursor(state: GameState, x: number, y: number): GameState {
  const pad = 24 * state.scale
  return {
    ...state,
    cursor: { x, y: Math.min(y, state.groundY - pad) },
  }
}

const DRY_TEXT = 'NO AMMO'

/**
 * Say so when there is nothing left to fire.
 *
 * A dry click used to return the state untouched: no sound, no mark, nothing
 * to tell the difference between an empty battery and a dead control. One
 * notice at a time, since a held finger asks about ten times a second.
 */
function dryFire(state: GameState, at: { x: number; y: number }): GameState {
  if (state.floaters.some((f) => f.text === DRY_TEXT && f.life > 0.55)) {
    return state
  }
  sfx('miss')
  return {
    ...state,
    floaters: [
      ...state.floaters,
      { id: uid(), x: at.x, y: at.y, text: DRY_TEXT, life: 1.1 },
    ],
  }
}

export function fire(
  state: GameState,
  aim?: { x: number; y: number },
): GameState {
  if (state.phase !== 'playing') return state

  const alive = state.batteries.filter((b) => b.alive && b.ammo > 0)
  if (alive.length === 0) return dryFire(state, aim ?? state.cursor)

  const target = aim ?? state.cursor
  let best = alive[0]
  let bestDist = Math.abs(best.x - target.x)
  for (const b of alive) {
    const d = Math.abs(b.x - target.x)
    if (d < bestDist) {
      best = b
      bestDist = d
    }
  }

  const batteries = state.batteries.map((b) =>
    b.id === best.id ? { ...b, ammo: b.ammo - 1, kick: 1 } : b,
  )

  const burst = state.burstArmed
  const muzzleY = state.groundY - 18 * state.scale
  // Smoke off the rail where it launched, blown back along the barrel.
  const launch = Math.atan2(target.y - muzzleY, target.x - best.x)
  const particles = [...(state.particles ?? [])]
  emit(
    { ...state, particles },
    'smoke',
    best.x,
    muzzleY,
    3,
    38,
    5,
    'ink',
    0.9,
    { angle: launch + Math.PI, spread: 1.2 },
  )
  const shot: Shot = {
    id: uid(),
    x0: best.x,
    y0: muzzleY,
    x1: target.x,
    y1: target.y,
    x: best.x,
    y: muzzleY,
    speed: 400 * (state.scale / VIEW_ZOOM),
    burst,
  }

  sfx('fire')
  return {
    ...state,
    batteries,
    burstArmed: false,
    shots: [...state.shots, shot],
    particles,
  }
}

function closestMissile(state: GameState): Incoming | null {
  const list = state.incoming
  if (!list.length) return null

  const marks = [
    ...state.cities.filter((c) => c.alive).map((c) => ({ x: c.x, y: state.groundY })),
    ...state.batteries.filter((b) => b.alive).map((b) => ({ x: b.x, y: state.groundY })),
  ]
  if (!marks.length) {
    marks.push({ x: state.cursor.x, y: state.groundY })
  }

  let best = list[0]
  let bestDist = Infinity
  for (const m of list) {
    let d = Infinity
    for (const mark of marks) {
      d = Math.min(d, dist(m.x, m.y, mark.x, mark.y))
    }
    if (d < bestDist) {
      best = m
      bestDist = d
    }
  }
  return best
}

/** Aim slightly ahead of a falling missile so the Seeker meets it. */
function leadMissile(
  m: Incoming,
  fromX: number,
  fromY: number,
  shotSpeed: number,
): { x: number; y: number } {
  let x = m.x
  let y = m.y
  for (let i = 0; i < 3; i++) {
    const travel = dist(fromX, fromY, x, y) / Math.max(1, shotSpeed)
    const step = advanceAlong(m.x0, m.y0, m.x1, m.y1, m.x, m.y, m.speed, travel)
    x = step.x
    y = step.y
  }
  return { x, y }
}

export function activatePower(state: GameState, kind: PowerKind): GameState {
  if (state.phase !== 'playing') return state
  if (state.pack[kind] <= 0) return state

  const midX =
    state.cities.reduce((n, c) => n + c.x, 0) / Math.max(1, state.cities.length)
  // Powers used back to back stack their names rather than printing over each other.
  const stacked = state.floaters.filter(
    (f) => f.life > 0.6 && Math.abs(f.x - midX) < 4 && f.y > state.groundY * 0.2,
  ).length
  const floater = (text: string): Floater => ({
    id: uid(),
    x: midX,
    y: state.groundY * 0.42 + stacked * 26 * state.scale,
    text,
    life: 1.2,
  })

  if (kind === 'burst') {
    const missile = closestMissile(state)
    if (!missile) {
      return {
        ...state,
        floaters: [...state.floaters, floater('NO TARGET')],
      }
    }

    const alive = state.batteries.filter((b) => b.alive && b.ammo > 0)
    if (alive.length === 0) {
      return {
        ...state,
        floaters: [...state.floaters, floater(DRY_TEXT)],
      }
    }

    let best = alive[0]
    let bestDist = Math.abs(best.x - missile.x)
    for (const b of alive) {
      const d = Math.abs(b.x - missile.x)
      if (d < bestDist) {
        best = b
        bestDist = d
      }
    }
    const muzzleY = state.groundY - 18 * state.scale
    const shotSpeed = 400 * (state.scale / VIEW_ZOOM)
    const aim = leadMissile(missile, best.x, muzzleY, shotSpeed)
    const fired = fire({ ...state, burstArmed: true }, aim)
    if (fired.shots.length === state.shots.length) {
      return {
        ...state,
        floaters: [...state.floaters, floater(DRY_TEXT)],
      }
    }

    sfx('good')
    return {
      ...fired,
      pack: { ...state.pack, burst: state.pack.burst - 1 },
      floaters: [...fired.floaters, { ...floater('SEEKER'), tone: 'violet' as const }],
    }
  }

  const pack = { ...state.pack, [kind]: state.pack[kind] - 1 }
  sfx('good')
  if (kind === 'ammo') {
    const next: GameState = {
      ...state,
      pack,
      batteries: restockBatteries(state.batteries, AMMO_PACK),
      floaters: [...state.floaters, { ...floater(`AMMO +${AMMO_PACK}`), tone: 'gold' as const }],
      reloadT: 1,
      particles: [...(state.particles ?? [])],
    }
    // Sparks off every rack as it fills.
    for (const b of next.batteries) {
      if (b.alive) emit(next, 'spark', b.x, state.groundY + 16 * state.scale, 8, 110, 1.3, 'gold', 0.5, { angle: -Math.PI / 2, spread: 2.2 })
    }
    return next
  }
  if (kind === 'shield') {
    const next: GameState = {
      ...state,
      pack,
      cities: state.cities.map((c) =>
        c.alive ? { ...c, shielded: true } : c,
      ),
      shieldT: 1,
      shieldAge: 0,
      floaters: [...state.floaters, { ...floater('SHIELD'), tone: 'teal' as const }],
      particles: [...(state.particles ?? [])],
    }
    for (const c of next.cities) {
      if (c.alive) emit(next, 'spark', c.x, state.groundY - 30 * state.scale, 7, 120, 1.3, 'teal', 0.55, { angle: -Math.PI / 2, spread: 2.6 })
    }
    return next
  }
  return {
    ...state,
    pack,
    slowT: SLOW_TIME,
    floaters: [...state.floaters, { ...floater('SLOW'), tone: 'sky' as const }],
  }
}

function aimX(aim: Aim, cities: City[], batteries: Battery[], w: number) {
  if (aim.type === 'ground') return aim.x
  if (aim.type === 'city') return cities.find((c) => c.id === aim.id)?.x ?? w * 0.5
  return batteries.find((b) => b.id === aim.id)?.x ?? w * 0.5
}

function pickMissX(w: number, cities: City[], batteries: Battery[]) {
  const marks = [
    ...cities.filter((c) => c.alive).map((c) => c.x),
    ...batteries.filter((b) => b.alive).map((b) => b.x),
  ]
  for (let i = 0; i < 8; i++) {
    const x = w * (0.12 + Math.random() * 0.76)
    if (marks.every((m) => Math.abs(m - x) > w * 0.06)) return x
  }
  return w * (0.15 + Math.random() * 0.7)
}

function pickAim(cities: City[], batteries: Battery[], w: number): Aim {
  const liveCities = cities.filter((c) => c.alive)
  const liveBats = batteries.filter((b) => b.alive)
  const wrecks = cities.filter((c) => !c.alive)
  const roll = Math.random()

  if (roll < 0.22) {
    if (wrecks.length && Math.random() < 0.45) {
      return { type: 'city', id: wrecks[Math.floor(Math.random() * wrecks.length)].id }
    }
    return { type: 'ground', x: pickMissX(w, cities, batteries) }
  }
  if (roll < 0.44 && liveBats.length) {
    return { type: 'battery', id: liveBats[Math.floor(Math.random() * liveBats.length)].id }
  }
  if (liveCities.length) {
    return { type: 'city', id: liveCities[Math.floor(Math.random() * liveCities.length)].id }
  }
  if (liveBats.length) {
    return { type: 'battery', id: liveBats[Math.floor(Math.random() * liveBats.length)].id }
  }
  return { type: 'ground', x: pickMissX(w, cities, batteries) }
}

function makeMissile(
  x0: number,
  y0: number,
  aim: Aim,
  speed: number,
  kind: Incoming['kind'],
  cities: City[],
  batteries: Battery[],
  w: number,
  groundY: number,
  scale: number,
): Incoming {
  const x1 = aimX(aim, cities, batteries, w)
  return {
    id: uid(),
    x0,
    y0,
    x1,
    y1: groundY - 8 * scale,
    x: x0,
    y: y0,
    speed,
    aim,
    kind,
  }
}

function restockBatteries(batteries: Battery[], add: number): Battery[] {
  return batteries.map((b) => {
    if (!b.alive) return b
    return { ...b, ammo: Math.min(BATTERY_AMMO, b.ammo + add) }
  })
}

function spawnOneIncoming(state: GameState, w: number): GameState {
  if (state.toSpawn <= 0) return state

  const aim = pickAim(state.cities, state.batteries, w)
  const x0 = w * (0.05 + Math.random() * 0.9)
  const speed = waveSpeed(state.wave, state.scale) * (0.85 + Math.random() * 0.3)
  const kind: Incoming['kind'] =
    Math.random() < splitterChance(state.wave) ? 'split' : 'normal'

  return {
    ...state,
    incoming: [
      ...state.incoming,
      makeMissile(
        x0,
        -36,
        aim,
        speed,
        kind,
        state.cities,
        state.batteries,
        w,
        state.groundY,
        state.scale,
      ),
    ],
    toSpawn: state.toSpawn - 1,
  }
}

/** Drop a small group at once, then pause before the next group. */
function spawnBurst(state: GameState, w: number): GameState {
  if (state.toSpawn <= 0) return state

  /*
   * Group size is where the opening actually felt slack: a wave that arrives
   * one missile at a time, three seconds apart, is a queue rather than a wave,
   * however many are coming. The first two used to average 1.35 a group. Wave
   * 5 and on is untouched — the early groups just climb to meet it sooner.
   */
  let size: number
  if (state.wave <= 2) {
    size = Math.random() < 0.6 ? 2 : 3
  } else if (state.wave <= 4) {
    size = Math.random() < 0.6 ? 3 : 4
  } else {
    size = Math.random() < 0.4 ? 4 : 3
  }
  size = Math.min(size, state.toSpawn)

  let s = state
  for (let i = 0; i < size; i++) {
    s = spawnOneIncoming(s, w)
  }

  const gap =
    Math.max(1.55, 2.55 - state.wave * 0.08) + Math.random() * 0.55
  return { ...s, spawnTimer: gap }
}

function applyImpact(
  x: number,
  cities: City[],
  batteries: Battery[],
  cityRange: number,
  batRange: number,
) {
  let hit = false
  let shielded = false
  for (const c of cities) {
    if (c.alive && Math.abs(c.x - x) < cityRange) {
      if (c.shielded) {
        c.shielded = false
        shielded = true
      } else {
        c.alive = false
        hit = true
      }
    }
  }
  if (shielded) return 'shield'
  for (const b of batteries) {
    if (b.alive && Math.abs(b.x - x) < batRange) {
      b.alive = false
      b.ammo = 0
      hit = true
    }
  }
  return hit ? 'hit' : 'miss'
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx
  const dy = ay - by
  return Math.hypot(dx, dy)
}

/** First point where the segment meets a city shield dome, or null. */
function segmentHitsDome(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const fx = ax - cx
  const fy = ay - cy
  const a = dx * dx + dy * dy
  if (a < 0.0001) {
    return fx * fx + fy * fy <= r * r && ay <= cy + 1 ? { x: ax, y: ay } : null
  }
  const b = 2 * (fx * dx + fy * dy)
  const c = fx * fx + fy * fy - r * r
  const disc = b * b - 4 * a * c
  const insideStart = fx * fx + fy * fy <= r * r + 0.5
  if (insideStart && ay <= cy + 1) return { x: ax, y: ay }
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  const candidates = [(-b - s) / (2 * a), (-b + s) / (2 * a)]
    .filter((t) => t >= 0 && t <= 1)
    .sort((p, q) => p - q)
  for (const t of candidates) {
    const x = ax + dx * t
    const y = ay + dy * t
    if (y <= cy + 1) return { x, y }
  }
  return null
}

function firstShieldHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cities: City[],
  groundY: number,
  r: number,
) {
  let best: { x: number; y: number; cityId: number } | null = null
  let bestD = Infinity
  for (const city of cities) {
    if (!city.alive || !city.shielded) continue
    const hit = segmentHitsDome(ax, ay, bx, by, city.x, groundY, r)
    if (!hit) continue
    const d = dist(ax, ay, hit.x, hit.y)
    if (d < bestD) {
      best = { ...hit, cityId: city.id }
      bestD = d
    }
  }
  return best
}

/**
 * A shot leaves the turret at three quarters speed and arrives at 1.3×.
 *
 * The pair is not arbitrary. Flight time over a ramp is the integral of ds/v,
 * which for a straight ramp from a to b comes to ln(b/a) / (b - a) times the
 * flat-speed time; at 0.75 and 1.3 that is 0.5500 / 0.55, or 1.0000. So the
 * shot visibly gathers pace and still lands on exactly the frame it used to —
 * no interception the player could make before is out of reach now, and the
 * Seeker's lead, which is worked out against the flat speed, stays true.
 */
const SHOT_LAUNCH = 0.75
const SHOT_ARRIVE = 1.3

function shotSpeedAt(shot: Shot) {
  const total = dist(shot.x0, shot.y0, shot.x1, shot.y1) || 1
  const gone = Math.min(1, dist(shot.x0, shot.y0, shot.x, shot.y) / total)
  return shot.speed * (SHOT_LAUNCH + (SHOT_ARRIVE - SHOT_LAUNCH) * gone)
}

function advanceAlong(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number,
  y: number,
  speed: number,
  dt: number,
) {
  const total = dist(x0, y0, x1, y1) || 1
  const traveled = dist(x0, y0, x, y)
  const next = Math.min(total, traveled + speed * dt)
  const t = next / total
  return {
    x: x0 + (x1 - x0) * t,
    y: y0 + (y1 - y0) * t,
    done: next >= total - 0.5,
  }
}

/**
 * The last city is gone. The sky plays on at a crawl — what was falling
 * still falls, what was burning still burns — and nothing scores.
 */
function tickDying(state: GameState, dt: number): GameState {
  const s = { ...state }
  const scale = s.scale
  s.dying = Math.max(0, s.dying - dt)
  const slow = dt * 0.35
  const incoming: Incoming[] = []
  const blasts = [...s.blasts]
  for (const m of s.incoming) {
    const step = advanceAlong(m.x0, m.y0, m.x1, m.y1, m.x, m.y, m.speed, slow)
    if (step.done) {
      groundBurst(s, m.x1, false)
      blasts.push({
        id: uid(),
        x: m.x1,
        y: s.groundY - 6 * scale,
        r: 4 * scale,
        maxR: 34 * scale,
        growing: true,
        burst: false,
        wait: 0,
        growRate: 110,
      })
      continue
    }
    incoming.push({ ...m, x: step.x, y: step.y })
  }
  s.incoming = incoming
  s.blasts = blasts
    .map((b) => {
      if ((b.wait ?? 0) > 0) return { ...b, wait: Math.max(0, (b.wait ?? 0) - slow) }
      if (b.growing) {
        const r = Math.max(b.r, 6 * scale) + (b.growRate ?? 120) * scale * slow
        return r >= b.maxR ? { ...b, r: b.maxR, growing: false } : { ...b, r }
      }
      return { ...b, r: b.r - 70 * scale * slow }
    })
    .filter((b) => b.r > 2 * scale || (b.wait ?? 0) > 0)
  s.planes = s.planes.map((p) => ({ ...p, x: p.x + p.vx * slow }))
  s.bombers = s.bombers.map((b) => ({ ...b, x: b.x + b.vx * slow }))
  s.drones = s.drones.map((d) => ({ ...d, x: d.x + d.vx * slow }))
  if (s.dying <= 0) s.phase = 'gameover'
  return s
}

export function tick(state: GameState, dt: number, w: number): GameState {
  const scale = state.scale
  let s = { ...state }
  s.time = (s.time ?? 0) + dt
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.floaters = s.floaters
    .map((f) => ({
      ...f,
      y: f.y - 28 * scale * dt,
      life: f.life - dt * 1.15,
    }))
    .filter((f) => f.life > 0)
  s.particles ??= []
  s.chains ??= {}
  updateEffects(s, s.phase === 'dying' ? dt * 0.5 : dt)

  if (s.phase === 'menu') return s

  if (s.phase === 'waveClear') {
    s.wavePause -= dt
    if (s.wavePause <= 0) {
      s = beginWave(s, s.wave + 1, w)
    }
    return s
  }

  if (s.phase === 'dying') return tickDying(s, dt)

  if (s.phase === 'gameover') return s

  if (!s.drones) s.drones = []
  if (!s.bombers) s.bombers = []
  if (!s.pack) s.pack = emptyPack()
  s.droneQueue ??= []
  s.droneTimer ??= 0
  s.dronePass ??= 0
  s.shieldT ??= 0
  s.slowT ??= 0

  s.slowT = Math.max(0, s.slowT - dt)
  const worldDt = dt * (s.slowT > 0 ? SLOW_RATE : 1)

  if (s.toSpawn > 0) {
    s.spawnTimer -= dt
    if (s.spawnTimer <= 0) {
      s = spawnBurst(s, w)
    }
  }

  if (s.droneQueue.length > 0) {
    s.droneTimer -= dt
    if (s.droneTimer <= 0) {
      const kind = s.droneQueue[0]
      s.drones = [...s.drones, makeDrone(s, w, kind, s.dronePass)]
      s.droneQueue = s.droneQueue.slice(1)
      s.dronePass += 1
      s.droneTimer = 1.8
    }
  }

  const planeDrops: Incoming[] = []
  const livePlanes: Plane[] = []
  for (const plane of s.planes) {
    const x = plane.x + plane.vx * worldDt
    const off = plane.vx > 0 ? x > w + 60 : x < -60
    if (off) continue

    let dropsLeft = plane.dropsLeft
    let dropTimer = plane.dropTimer - worldDt
    const onField = x > 40 && x < w - 40
    if (dropsLeft > 0 && onField && dropTimer <= 0) {
      planeDrops.push(
        makeMissile(
          x,
          plane.y + 8 * scale,
          pickAim(s.cities, s.batteries, w),
          waveSpeed(s.wave, scale) * (0.9 + Math.random() * 0.2),
          'normal',
          s.cities,
          s.batteries,
          w,
          s.groundY,
          scale,
        ),
      )
      dropsLeft -= 1
      dropTimer = 0.55 + Math.random() * 0.35
    }
    livePlanes.push({ ...plane, x, dropsLeft, dropTimer })
  }
  s.planes = livePlanes

  const bomberDrops: Incoming[] = []
  const liveBombers: Bomber[] = []
  const margin = Math.max(48 * scale, w * 0.08)
  for (const bomber of s.bombers) {
    let x = bomber.x + bomber.vx * worldDt
    let vx = bomber.vx
    if (x < margin) {
      x = margin
      vx = Math.abs(vx)
    } else if (x > w - margin) {
      x = w - margin
      vx = -Math.abs(vx)
    }

    let dropTimer = bomber.dropTimer - worldDt
    if (dropTimer <= 0) {
      bomberDrops.push(
        makeMissile(
          x,
          bomber.y + 10 * scale,
          pickAim(s.cities, s.batteries, w),
          waveSpeed(s.wave, scale) * (0.88 + Math.random() * 0.22),
          Math.random() < splitterChance(s.wave) * 0.55 ? 'split' : 'normal',
          s.cities,
          s.batteries,
          w,
          s.groundY,
          scale,
        ),
      )
      dropTimer = 1.85 + Math.random() * 0.55
    }
    liveBombers.push({
      ...bomber,
      x,
      vx,
      dropTimer,
      hitBy: [...bomber.hitBy],
    })
  }
  s.bombers = liveBombers
  if (planeDrops.length || bomberDrops.length) {
    s.incoming = [...s.incoming, ...planeDrops, ...bomberDrops]
  }

  const liveDrones: Drone[] = []
  for (const drone of s.drones) {
    const x = drone.x + drone.vx * worldDt
    const off = drone.vx > 0 ? x > w + 50 : x < -50
    if (!off) liveDrones.push({ ...drone, x })
  }
  s.drones = liveDrones

  const newShots: Shot[] = []
  const newBlasts = [...s.blasts]
  for (const shot of s.shots) {
    const step = advanceAlong(
      shot.x0, shot.y0, shot.x1, shot.y1, shot.x, shot.y, shotSpeedAt(shot), dt,
    )
    if (step.done) {
      newBlasts.push({
        id: uid(),
        x: shot.x1,
        y: shot.y1,
        r: 6 * scale,
        maxR: (shot.burst ? BLAST_BURST : BLAST_MAX) * scale,
        growing: true,
        burst: shot.burst,
        wait: 0,
        growRate: 120,
        aimed: true,
        // Every shot starts a chain of its own.
        chain: uid(),
      })
      emit(s, 'spark', shot.x1, shot.y1, 6, 140, 1.4, shot.burst ? 'violet' : 'gold', 0.35)
    } else {
      newShots.push({ ...shot, x: step.x, y: step.y })
    }
  }
  s.shots = newShots

  const liveBlasts: Blast[] = []
  for (const b of newBlasts) {
    const wait = Math.max(0, (b.wait ?? 0) - dt)
    if (wait > 0) {
      liveBlasts.push({ ...b, wait })
      continue
    }
    const grow = (b.growRate ?? 120) * scale * dt
    if (b.growing) {
      const r = Math.max(b.r, 6 * scale) + grow
      if (r >= b.maxR) {
        liveBlasts.push({ ...b, wait: 0, r: b.maxR, growing: false })
      } else {
        liveBlasts.push({ ...b, wait: 0, r })
      }
    } else {
      const r = b.r - 70 * scale * dt
      if (r > 2 * scale) liveBlasts.push({ ...b, wait: 0, r })
    }
  }
  s.blasts = liveBlasts

  const liveIncoming: Incoming[] = []
  const newFloaters = [...s.floaters]
  const extraBlasts: Blast[] = []
  let cities = s.cities.map((c) => ({ ...c }))
  let batteries = s.batteries.map((b) => ({ ...b }))
  let scoreAdd = 0
  let flash = s.flash
  let directStreak = s.directStreak ?? 0
  let directStreakBest = s.directStreakBest ?? 0
  const chains: Record<number, number> = { ...(s.chains ?? {}) }
  let chainBest = s.chainBest ?? 0
  const hitPad = 4 * scale
  const directR = DIRECT_HIT_RADIUS * scale

  for (const m of s.incoming) {
    let hitBlast: Blast | null = null
    for (const b of s.blasts) {
      if ((b.wait ?? 0) > 0) continue
      if (dist(m.x, m.y, b.x, b.y) <= b.r + hitPad) {
        hitBlast = b
        break
      }
    }

    if (hitBlast) {
      // Dead centre of a shot the player aimed, and nothing else.
      const direct =
        hitBlast.aimed === true &&
        dist(m.x, m.y, hitBlast.x, hitBlast.y) <= directR
      // Where this kill falls in its chain: the n-th is worth n times the first.
      const family = hitBlast.chain ?? (hitBlast.chain = uid())
      const n = (chains[family] ?? 0) + 1
      chains[family] = n
      chainBest = Math.max(chainBest, n)
      const mult = Math.min(CHAIN_MULT_MAX, n)
      sfx('hit', Math.min(5, direct ? 2 + n - 1 : n - 1))
      if (n >= 3) sfx('hop', Math.min(16, (n - 2) * 2))
      killBurst(s, m.x, m.y, hitBlast.hue, direct || n >= 3)
      if (n === CHAIN_BANNER_AT || (n > CHAIN_BANNER_AT && n % 5 === 0)) {
        banner(s, 'Chain reaction', `${n} in one chain`, 'hot', 1.6)
        sfx('perfect')
        flash = Math.max(flash, 0.3)
        s.shake = Math.max(s.shake ?? 0, 0.3)
      }
      if (direct) {
        directStreak += 1
        directStreakBest = Math.max(directStreakBest, directStreak)
        const points = SCORE_DIRECT + SCORE_SPLASH * (mult - 1)
        scoreAdd += points
        newFloaters.push({
          id: uid(),
          x: m.x,
          y: m.y - 10 * scale,
          text: `DIRECT +${points}`,
          sub:
            directStreak > 1
              ? `${directStreak} in a row`
              : n > 1
                ? `chain ×${n}`
                : undefined,
          tone: 'gold',
          big: true,
          life: 1.15,
        })
        flash = Math.max(flash, 0.35)
        // Perfect hit pumps the blast back into growth.
        hitBlast.fromPerfect = true
        hitBlast.growing = true
        hitBlast.wait = 0
        hitBlast.maxR =
          Math.max(hitBlast.maxR, hitBlast.r) + BLAST_REGROW * scale
        hitBlast.growRate = Math.max(hitBlast.growRate ?? 120, 130)
      } else {
        // Only splash from a perfect-linked blast keeps the streak.
        if (!hitBlast.fromPerfect) directStreak = 0
        const points = SCORE_SPLASH * mult
        scoreAdd += points
        newFloaters.push({
          id: uid(),
          x: m.x,
          y: m.y - 8 * scale,
          text: `+${points}`,
          sub: n > 1 ? `chain ×${n}` : undefined,
          tone: n >= 3 ? 'hot' : 'gold',
          big: n >= 3,
          life: 0.95,
        })
      }

      const chainPerfect = Boolean(direct || hitBlast.fromPerfect)

      // Missile body always detonates on kill.
      extraBlasts.push({
        id: uid(),
        x: m.x,
        y: m.y,
        r: 0,
        maxR: (hitBlast.burst ? BLAST_MAX * 0.95 : BLAST_MAX * 0.72) * scale,
        growing: true,
        burst: hitBlast.burst,
        wait: 0.05,
        growRate: 110,
        fromPerfect: chainPerfect,
        // A kill keeps the colour of whatever set it off, so a chain that
        // starts on the green charge stays green the whole way down.
        hue: hitBlast.hue,
        chain: family,
      })

      if (hitBlast.burst) {
        const ring = 118 * scale
        const spots = [
          { x: m.x + ring, y: m.y },
          { x: m.x - ring, y: m.y },
          { x: m.x + ring * 0.5, y: m.y - ring * 0.866 },
          { x: m.x - ring * 0.5, y: m.y - ring * 0.866 },
          { x: m.x + ring * 0.5, y: m.y + ring * 0.866 },
          { x: m.x - ring * 0.5, y: m.y + ring * 0.866 },
        ]
        for (const [i, p] of spots.entries()) {
          extraBlasts.push({
            id: uid(),
            x: p.x,
            y: p.y,
            r: 0,
            maxR: BLAST_MAX * 1.05 * scale,
            growing: true,
            burst: true,
            wait: 0.14 + i * 0.08,
            growRate: 78,
            fromPerfect: chainPerfect,
            hue: SEEKER_HUES[i % SEEKER_HUES.length],
            chain: family,
          })
        }
      }
      continue
    }

    const step = advanceAlong(
      m.x0, m.y0, m.x1, m.y1, m.x, m.y, m.speed, worldDt,
    )

    if (cities.some((c) => c.alive && c.shielded)) {
      const hit = firstShieldHit(
        m.x,
        m.y,
        step.x,
        step.y,
        cities,
        s.groundY,
        shieldRadius(scale),
      )
      if (hit) {
        const city = cities.find((c) => c.id === hit.cityId)
        if (city) city.shielded = false
        sfx('hit')
        scoreAdd += SCORE_SPLASH
        newFloaters.push({
          id: uid(),
          x: hit.x,
          y: hit.y - 8 * scale,
          text: 'BLOCKED',
          tone: 'teal',
          life: 0.9,
        })
        emit(s, 'spark', hit.x, hit.y, 10, 160, 1.4, 'teal', 0.5)
        extraBlasts.push({
          id: uid(),
          x: hit.x,
          y: hit.y,
          r: 6 * scale,
          maxR: 22 * scale,
          growing: true,
          burst: false,
          wait: 0,
          growRate: 120,
        })
        continue
      }
    }

    if (step.done) {
      directStreak = 0
      const impact = applyImpact(
        m.x1,
        cities,
        batteries,
        CITY_HIT_RANGE * scale,
        BATTERY_HIT_RANGE * scale,
      )
      if (impact === 'shield') {
        scoreAdd += SCORE_SPLASH
        newFloaters.push({
          id: uid(),
          x: m.x1,
          y: s.groundY - 28 * scale,
          text: 'BLOCKED',
          tone: 'teal',
          life: 0.9,
        })
        emit(s, 'spark', m.x1, s.groundY - 20 * scale, 10, 160, 1.4, 'teal', 0.5)
      } else if (impact === 'hit') {
        sfx('hurt')
        sfx('boom')
        flash = 0.55
        groundBurst(s, m.x1, true)
        s.shake = Math.max(s.shake ?? 0, 0.85)
      } else {
        // Open ground: a thump and a little dirt.
        groundBurst(s, m.x1, false)
        s.shake = Math.max(s.shake ?? 0, 0.18)
      }
      continue
    }

    const drop = (step.y - m.y0) / Math.max(8, m.y1 - m.y0)
    const moved = { ...m, x: step.x, y: step.y }
    if (m.kind === 'split' && drop >= SPLIT_AT) {
      liveIncoming.push(
        makeMissile(
          moved.x,
          moved.y,
          pickAim(cities, batteries, w),
          moved.speed * 1.08,
          'normal',
          cities,
          batteries,
          w,
          s.groundY,
          scale,
        ),
        makeMissile(
          moved.x,
          moved.y,
          pickAim(cities, batteries, w),
          moved.speed * 1.08,
          'normal',
          cities,
          batteries,
          w,
          s.groundY,
          scale,
        ),
      )
      flash = Math.max(flash, 0.18)
      emit(s, 'spark', moved.x, moved.y, 10, 150, 1.4, 'violet', 0.5)
      continue
    }

    liveIncoming.push(moved)
  }

  s.incoming = liveIncoming
  if (extraBlasts.length) s.blasts = [...s.blasts, ...extraBlasts]

  const survivingPlanes: Plane[] = []
  // Matched to the jet as drawn side on: longer than it is tall, so a little
  // more than half its height and a little less than half its length.
  const planeHitR = 19 * scale
  for (const plane of s.planes) {
    let down = false
    for (const b of s.blasts) {
      if ((b.wait ?? 0) > 0) continue
      if (dist(plane.x, plane.y, b.x, b.y) <= b.r + planeHitR) {
        down = true
        sfx('boom')
        scoreAdd += SCORE_PLANE
        newFloaters.push({
          id: uid(),
          x: plane.x,
          y: plane.y - 12 * scale,
          text: `+${SCORE_PLANE}`,
          sub: 'plane down',
          tone: 'sky',
          big: true,
          life: 1.2,
        })
        killBurst(s, plane.x, plane.y, b.hue, true)
        emit(s, 'debris', plane.x, plane.y, 10, 90, 2, 'ink', 1.8, { angle: Math.PI / 2, spread: 2 })
        flash = Math.max(flash, 0.4)
        s.shake = Math.max(s.shake ?? 0, 0.3)
        break
      }
    }
    if (!down) survivingPlanes.push(plane)
  }
  s.planes = survivingPlanes

  const survivingBombers: Bomber[] = []
  const bomberHitR = 32 * scale
  for (const bomber of s.bombers) {
    let hp = bomber.hp
    const hitBy = [...bomber.hitBy]
    let struck = false
    for (const b of s.blasts) {
      if ((b.wait ?? 0) > 0) continue
      if (hitBy.includes(b.id)) continue
      if (dist(bomber.x, bomber.y, b.x, b.y) <= b.r + bomberHitR) {
        hitBy.push(b.id)
        hp -= 1
        struck = true
        // One blast, one chip — keep scanning other blasts.
      }
    }
    if (hp <= 0) {
      sfx('boom')
      sfx('perfect')
      scoreAdd += SCORE_BOMBER
      newFloaters.push({
        id: uid(),
        x: bomber.x,
        y: bomber.y - 14 * scale,
        text: `+${SCORE_BOMBER}`,
        sub: 'bomber down',
        tone: 'orange',
        big: true,
        life: 1.3,
      })
      killBurst(s, bomber.x, bomber.y, undefined, true)
      emit(s, 'debris', bomber.x, bomber.y, 18, 120, 2.6, 'ink', 2, { angle: Math.PI / 2, spread: 2.2 })
      emit(s, 'smoke', bomber.x, bomber.y, 6, 50, 12, 'ink', 2)
      s.shake = Math.max(s.shake ?? 0, 0.55)
      s.blasts = [
        ...s.blasts,
        {
          id: uid(),
          x: bomber.x,
          y: bomber.y,
          r: 8 * scale,
          maxR: BLAST_MAX * 1.1 * scale,
          growing: true,
          burst: false,
          wait: 0,
          growRate: 140,
        },
      ]
      flash = Math.max(flash, 0.5)
      continue
    }
    if (struck) {
      sfx('hit')
      flash = Math.max(flash, 0.22)
      emit(s, 'spark', bomber.x, bomber.y, 10, 180, 1.6, 'hot', 0.45)
      emit(s, 'smoke', bomber.x, bomber.y, 2, 30, 8, 'ink', 1.6)
    }
    const liveIds = new Set(s.blasts.map((b) => b.id))
    survivingBombers.push({
      ...bomber,
      hp,
      hitBy: hitBy.filter((id) => liveIds.has(id)),
    })
  }
  s.bombers = survivingBombers

  // The blimp is drawn larger than the pod it replaced; a blast that visibly
  // touches its envelope should take it.
  const droneHitR = 19 * scale
  const liveDronesHit: Drone[] = []
  for (const drone of s.drones) {
    let caught = false
    for (const b of s.blasts) {
      if ((b.wait ?? 0) > 0) continue
      if (dist(drone.x, drone.y, b.x, b.y) <= b.r + droneHitR) {
        caught = true
        sfx('good')
        const held = s.pack[drone.kind]
        s.pack = { ...s.pack, [drone.kind]: Math.min(POWER_MAX, held + 1) }
        newFloaters.push({
          id: uid(),
          x: drone.x,
          y: drone.y - 12 * scale,
          text: held >= POWER_MAX ? 'FULL' : POWER_LABEL[drone.kind].toUpperCase(),
          tone: POWER_TONE[drone.kind],
          big: true,
          life: 1.15,
        })
        emit(s, 'spark', drone.x, drone.y, 12, 160, 1.5, POWER_TONE[drone.kind], 0.55)
        emit(s, 'debris', drone.x, drone.y + 6 * scale, 6, 70, 1.8, 'ink', 1.4, { angle: Math.PI / 2, spread: 1.6 })
        // What it carried flies off to the column, so you see where it went.
        if (held < POWER_MAX) {
          s.pickups = [...(s.pickups ?? []), { id: uid(), kind: drone.kind, x: drone.x, y: drone.y, age: 0 }]
        }
        flash = Math.max(flash, 0.28)
        break
      }
    }
    if (!caught) liveDronesHit.push(drone)
  }
  s.drones = liveDronesHit
  s.cities = cities
  s.batteries = batteries
  s.floaters = newFloaters
  s.score += scoreAdd
  s.flash = Math.max(s.flash, flash)
  s.shieldT = cities.some((c) => c.alive && c.shielded) ? 1 : 0
  s.directStreak = directStreak
  s.directStreakBest = directStreakBest
  s.chainBest = chainBest
  // Forget chains whose blasts have all burnt out.
  const liveChains = new Set(s.blasts.map((b) => b.chain))
  for (const id of Object.keys(chains)) {
    if (!liveChains.has(Number(id))) delete chains[Number(id)]
  }
  s.chains = chains

  const citiesLeft = s.cities.filter((c) => c.alive).length
  if (citiesLeft === 0) {
    const best = Math.max(s.best, s.score)
    sfx('die')
    return {
      ...s,
      phase: 'dying',
      dying: DYING_TIME,
      best,
      flash: 0.7,
      shake: 1,
      banner: { text: 'The last city is down', sub: `Wave ${s.wave}`, tone: 'red', life: DYING_TIME + 0.4, maxLife: DYING_TIME + 0.4 },
    }
  }

  if (
    s.toSpawn <= 0 &&
    (s.droneQueue?.length ?? 0) === 0 &&
    s.incoming.length === 0 &&
    s.planes.length === 0 &&
    (s.bombers?.length ?? 0) === 0 &&
    s.drones.length === 0 &&
    s.shots.length === 0 &&
    s.blasts.length === 0
  ) {
    const survived = citiesLeft
    const started = s.citiesAtWaveStart
    const perfect = survived === s.cities.length
    const clean = survived === started
    const cleanStreak = clean ? s.cleanStreak + 1 : 0
    const wreck =
      !perfect && cleanStreak >= CLEAN_WAVES_TO_REBUILD
        ? (s.cities.find((c) => !c.alive) ?? null)
        : null
    const rebuilt = wreck != null
    if (wreck) {
      wreck.alive = true
      wreck.shielded = false
    }
    const nextStreak = rebuilt ? 0 : cleanStreak

    const cityBonus = survived * SCORE_CITY
    const ammoBonus = s.batteries.reduce(
      (n, b) => n + (b.alive ? b.ammo * SCORE_AMMO : 0),
      0,
    )
    const score = s.score + cityBonus + ammoBonus
    const best = Math.max(s.best, score)

    const bonusFloaters: Floater[] = s.cities
      .filter((c) => c.alive)
      .map((c) => ({
        id: uid(),
        x: c.x,
        y: s.groundY - 48 * scale,
        text: wreck && c.id === wreck.id ? 'REBUILT' : `+${SCORE_CITY}`,
        life: 1.5,
      }))

    sfx('wave')
    return {
      ...s,
      score,
      best,
      phase: 'waveClear',
      wavePause: perfect || rebuilt ? 2.2 : 1.7,
      flash: Math.max(s.flash, perfect || rebuilt ? 0.5 : 0.28),
      floaters: [...s.floaters, ...bonusFloaters],
      cleanStreak: nextStreak,
      clearBonus: {
        perfect,
        rebuilt,
        cities: survived,
        cityBonus,
        ammoBonus,
        cleanStreak: nextStreak,
      },
    }
  }

  return s
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    wave: s.wave,
    phase: s.phase,
    ammoLeft: s.batteries.reduce((n, b) => n + (b.alive ? b.ammo : 0), 0),
    citiesLeft: s.cities.filter((c) => c.alive).length,
    clearBonus: s.phase === 'waveClear' ? s.clearBonus : null,
    pack: s.pack ?? emptyPack(),
    shieldT: s.cities.some((c) => c.alive && c.shielded) ? 1 : 0,
    slowT: s.slowT ?? 0,
    burstArmed: s.burstArmed ?? false,
    directStreakBest: s.directStreakBest ?? 0,
  }
}
