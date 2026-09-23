import { sfx } from '../../lib/sound'

/**
 * Barrage — rows of ships, one cannon, hold the line.
 *
 * The twist the name asks for: the fleet does not drip random shots. It gathers
 * a volley, lights up the ships that are about to fire, and then looses the lot
 * at once. The charge is the whole game — you read which lanes are hot, move to
 * a cold one, and spend the quiet window pushing damage back.
 *
 * The charge is also an opening. Only the front ship of a hot column winds up,
 * and a lit ship destroyed before it fires takes its shot with it — and gives up
 * the charge it was building, which flies down to the cannon as a mirror: the
 * next round that would have hit you goes back up its lane instead. Standing in
 * a hot lane to do that is the bet the game is built on.
 *
 * The cannon grows over a run. Some ships in every fleet carry a capsule you
 * can see, one of them at the front from the moment the wave arrives; shoot it
 * down and catch what falls. Each capsule is a level of one of three powers —
 * a fan of rounds, rounds that punch through hulls, a faster trigger — and the
 * levels stay for the rest of the run, wave after wave. Losing a cannon costs a
 * level of each.
 *
 * There is deliberately no cover. A bunker answers a volley for you, which is
 * the one thing that stops you having to read it.
 *
 * Coordinates are in stage-width units: x runs 0..1, y runs 0..FIELD_H. Both
 * axes scale off width so speeds and sizes stay isotropic at any size.
 */

/**
 * Two board shapes. Upright on a phone; on its side on a desktop, where a 3:4
 * board was a narrow column with the window wasted either side. A landscape
 * field is too short for five rows of ships plus room to descend, so the fleet
 * is squatter and wider there — see `makeLayout`.
 */
export function stageFor(portrait: boolean) {
  return portrait ? { w: 3, h: 4 } : { w: 4, h: 3 }
}

/**
 * Everything about the board that depends on its shape. Coordinates are in
 * stage-width units throughout: x runs 0..1, y runs 0..fieldH.
 */
export type Layout = {
  fieldH: number
  cols: number
  rows: number
  shipW: number
  shipH: number
  colStep: number
  rowStep: number
  formW: number
  formH: number
  /** Ships reaching this line end the run outright. */
  holdLine: number
  cannonY: number
  /** Where the fleet starts on wave one. */
  startY: number
  /** Ground between the fleet's starting edge and the line. */
  descent: number
  /** Gain per turn, derived from the descent so the run to the line takes
   *  about the same number of turns whichever shape is in play. */
  dropPerTurn: number
}

/** Turns from the fleet's starting edge to the line. Fixed across both shapes. */
const TURNS_TO_LAND = 40

export function makeLayout(portrait: boolean): Layout {
  const stage = stageFor(portrait)
  const fieldH = stage.h / stage.w

  // A short field cannot carry five rows, so it trades them for columns —
  // which is the right shape for a wide board anyway.
  const cols = portrait ? 6 : 8
  const rows = portrait ? 5 : 3
  const shipW = portrait ? 0.108 : 0.085
  const shipH = portrait ? 0.072 : 0.062
  const colStep = portrait ? 0.144 : 0.103
  const rowStep = portrait ? 0.104 : 0.09

  const formW = (cols - 1) * colStep + shipW
  const formH = (rows - 1) * rowStep + shipH
  const holdLine = fieldH - 0.155
  const startY = portrait ? 0.14 : 0.1
  const descent = Math.max(0.05, holdLine - startY - formH)

  return {
    fieldH,
    cols,
    rows,
    shipW,
    shipH,
    colStep,
    rowStep,
    formW,
    formH,
    holdLine,
    cannonY: fieldH - 0.085,
    startY,
    descent,
    dropPerTurn: descent / TURNS_TO_LAND,
  }
}

export type Phase = 'menu' | 'playing' | 'dying' | 'clearing' | 'gameover'

/**
 * Three kinds of ship, by rank: the narrow ones at the top are worth the most,
 * the broad ones at the front the least. Which kind a row gets depends only on
 * where it sits in the formation, so the upright and the wide board carry the
 * same three.
 */
export type Species = 'squid' | 'crab' | 'octo'

export function speciesFor(row: number, rows: number): Species {
  if (row === 0) return 'squid'
  return row < rows * 0.6 ? 'crab' : 'octo'
}

/**
 * The three powers a cannon collects. Each has three levels, and each is a
 * different answer to the same fleet: the fan covers the lanes beside you,
 * a piercing round digs out a column, a faster trigger does more of both.
 */
export type PowerKind = 'spread' | 'pierce' | 'rapid'

export const POWER_KINDS: readonly PowerKind[] = ['spread', 'pierce', 'rapid']

export type Ship = {
  /** Column and row in the formation, fixed for the life of the ship. */
  col: number
  row: number
  alive: boolean
  /** 1–3. Higher tiers are plated: armour over the hull, and more rounds to break. */
  tier: number
  /** Rounds left before it breaks. Starts equal to the tier. */
  hp: number
  /** 0–1 flash after a hit that did not finish it. */
  hurt: number
  /** This ship is the front of a hot column, winding up to fire. */
  charging: boolean
  /** 0–1 progress of that wind-up. */
  charge: number
  /** A capsule slung under it, dropped when it breaks. */
  cargo: PowerKind | null
}

export type Shot = {
  x: number
  y: number
  vx: number
  vy: number
  /** Enemy shots are fatter and slower; the player's are thin and quick. */
  hostile: boolean
  /** Player shots only: hulls it can still carry on through after this one. */
  pierce?: number
  /** Player shots only: the trigger pull it came from, for the rounds-in-the-air limit. */
  pull?: number
  /** Player shots only: this round has already found something, for accuracy. */
  hit?: boolean
  /** One of the fleet's own rounds, sent back up by a mirror: it breaks whatever it meets. */
  returned?: boolean
  /** Looks only: which barrel it left — the lance down the middle, or a side barrel of the fan. */
  from?: 'lance' | 'side'
}

/**
 * A capsule shaken loose from a cargo ship. It falls, and the cannon has to be
 * under it to take it: the lane it comes down may be a lane that is about to
 * fire, so every pickup is a bet against the next volley.
 */
export type Drop = {
  x: number
  y: number
  kind: PowerKind
  /** Seconds before it falls past the floor and is gone. */
  life: number
}

/** A lit ship's charge, taken before it fired, on its way down to the cannon to become a mirror. */
export type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
}

/** A column that has fired and is still emptying its burst. */
export type Burst = {
  col: number
  row: number
  left: number
  next: number
}

/** Debris. Shards are hull, plates are armour, sparks are light. */
export type Bit = {
  kind: 'shard' | 'plate' | 'spark'
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  /** Hue, or -1 for the ink colour. */
  hue: number
  size: number
  angle: number
  spin: number
}

/** A shock ring, out fast and fading. */
export type Ring = {
  x: number
  y: number
  r0: number
  r1: number
  life: number
  maxLife: number
  hue: number
}

export type FloaterTone = 'score' | 'defuse' | 'chain' | 'pickup' | 'mirror'

export type Floater = {
  x: number
  y: number
  text: string
  tone: FloaterTone
  life: number
  maxLife: number
  /** Pickups only: the power, so the call wears its colour. */
  kind?: PowerKind
}

/** Where a volley's shot crossed the line — the field flexes where it is passed. */
export type Ripple = {
  x: number
  life: number
}

export type EndCause = 'line' | 'lives'

export type GameState = {
  /** Board shape this run is being played on. */
  layout: Layout
  phase: Phase
  score: number
  best: number
  lives: number
  wave: number
  /** Seconds since this wave began: the fleet flies in over the first of them. */
  waveT: number
  /** Left edge of the leftmost column. */
  formX: number
  /** Top edge of the top row. */
  formY: number
  /** +1 marching right, -1 left. */
  formDir: number
  /** Steps marched, for the fleet's two-frame gait. */
  gait: number
  ships: Ship[]
  shots: Shot[]
  bursts: Burst[]
  drops: Drop[]
  sparks: Spark[]
  /** The cannon's powers, 0–3 each. They last the run; losing a cannon costs a level of each. */
  power: Record<PowerKind, number>
  /** Mirrors ready on the cannon, 0–2: each sends one round that would have hit it back up its lane. */
  mirror: number
  /** Stopped shots gathered toward the next mirror. */
  sparksHeld: number
  /** Trigger pulls so far, to tell one pull's rounds from the next. */
  pulls: number
  /** Kind and countdown of the last pickup, for the HUD flash. */
  tookKind: PowerKind | null
  tookFor: number
  /** 0–1 flash as a mirror takes a round. */
  mirrorFlash: number
  cannonX: number
  /** -1, 0 or +1 from the keys or pads. */
  moveDir: number
  /** Where a finger or pointer on the field wants the cannon, or null. */
  steerX: number | null
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
  /** What the wave just cleared paid, for the banner. */
  clearBonus: { clear: number; clean: number } | null
  /** 0–1 flash when the cannon is hit. */
  hitFlash: number
  /** Ships killed this wave without being hit — drives the clean-wave bonus. */
  cleanWave: boolean
  /** Kills in a row, each inside CHAIN_WINDOW of the last. */
  chain: number
  /** Seconds left to land the next one. */
  chainT: number
  bestChain: number
  /** Lit ships destroyed before they fired. */
  defused: number
  /** Rounds sent back up by a mirror. */
  returned: number
  shotsFired: number
  shotsHit: number
  time: number
  /** How the run ended, once it has. */
  endCause: EndCause | null
  // Presentation only: nothing below changes what happens in a run.
  bits: Bit[]
  rings: Ring[]
  floaters: Floater[]
  ripples: Ripple[]
  /** 0–1 knock on the screen, decaying. */
  shake: number
  /** 0–1 barrel recoil after a shot. */
  kick: number
  /** -1..1, the cannon leaning into its travel. */
  lean: number
  /** 0–1 as the cannon arrives after a respawn. */
  respawn: number
}

export type Snapshot = {
  phase: Phase
  score: number
  lives: number
  wave: number
  shipsLeft: number
  /** Percentage of rounds that found something, for the end-of-run card. */
  accuracy: number
  spread: number
  pierce: number
  rapid: number
  mirror: number
  /** Stopped shots toward the next mirror. */
  sparks: number
  chain: number
  mult: number
  bestChain: number
  endCause: EndCause | null
}

export const MAX_TIER = 3
/** The top level of each power. */
export const MAX_LEVEL = 3
/** Mirrors the cannon can hold at once. */
export const MAX_MIRROR = 2
/** Stopped shots it takes to make one mirror. */
export const SPARKS_PER_MIRROR = 3
const MARGIN = 0.028
const CANNON_W = 0.112
const CANNON_H = 0.066
/** Keeps pace with the wider formation — the gaps to cross got bigger too. */
const CANNON_SPEED = 0.82
/** A steering finger closer than this to the cannon holds it still. */
const STEER_DEAD = 0.004

const PLAYER_SHOT_SPEED = 1.5
const PLAYER_SHOT_W = 0.008
const PLAYER_SHOT_H = 0.038

/**
 * The trigger by rapid level: seconds between pulls, and how many pulls can be
 * in the air at once. A fan is one pull, however many rounds it throws.
 */
const FIRE_COOLDOWN = [0.22, 0.19, 0.16, 0.13] as const
const PULLS_IN_AIR = [4, 5, 5, 6] as const
/** The rounds of one pull, by spread level: each is how far it leans per unit it climbs. */
const FANS: readonly (readonly number[])[] = [
  [0],
  [-0.18, 0, 0.18],
  [-0.24, -0.12, 0, 0.12, 0.24],
  [-0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24],
]
/**
 * Hulls the main barrel's round carries on through after the first, by pierce
 * level. Only that round: the fan's side barrels throw plain rounds, so the
 * powers add up rather than multiply.
 */
const PIERCE_THROUGH = [0, 1, 2, 3] as const

const ENEMY_SHOT_W = 0.015
const ENEMY_SHOT_H = 0.04
/** Seconds between the rounds of one column's burst. */
const BURST_GAP = 0.11
/** How fast a round sent back by a mirror climbs. */
const RETURN_SPEED = 1.25

const DROP_FALL = 0.32
const DROP_R = 0.031
/** A spark's top speed on its way down to the cannon, and how close counts as arrived. */
const SPARK_SPEED = 2.4
const SPARK_CATCH = 0.03

export const POWER_LABEL: Record<PowerKind, string> = {
  spread: 'Spread',
  pierce: 'Pierce',
  rapid: 'Rapid',
}

/**
 * The site's own colours, kept clear of the fleet's purples, the cannon's
 * green and the volley's red: orange, amber and sky, and teal for the mirror.
 */
export const POWER_HUE: Record<PowerKind, number> = {
  spread: 22,
  pierce: 40,
  rapid: 204,
}
export const MIRROR_HUE = 183

const DEATH_PAUSE = 1.3
/** Long enough to watch the line go. */
export const LINE_PAUSE = 1.8
export const CLEAR_PAUSE = 1.7
const RESPAWN_FLASH = 0.9

/** Seconds each ship takes to fly into its slot, and how long a wave's name holds. */
const ENTER_TIME = 0.75
export const WAVE_BANNER = 2

/**
 * Points by rank, the top row most. A powered-up cannon breaks ships far faster
 * than the bare one did, so a ship is worth half what it was and a plate adds
 * a quarter again rather than doubling it; a run still banks much what it used
 * to a second, which is what the boards and the server's check are built round.
 */
const SCORE_ROW = [20, 15, 10, 8, 5] as const
const SCORE_WAVE_CLEAR = 150
const SCORE_CLEAN_WAVE = 150
/** On top of the ship's own points, for taking a lit ship before it fires. */
const SCORE_DEFUSE = 25
/** On top of the ship's own points, for breaking it with its own fleet's round. */
const SCORE_RETURNED = 15
/** A capsule for a power already at the top, or a spark with every mirror already up. */
const SCORE_MAXED = 100
const SCORE_SPARE_SPARK = 25

/**
 * Kills in quick succession. Any hit keeps the chain alive, so grinding through
 * plate does not break it; only kills lengthen it. It holds still while there
 * is nothing to shoot — a wave flying in, a wave cleared — and carries on into
 * the next wave.
 */
export const CHAIN_WINDOW = 1.8
export const CHAIN_STEP = 10
export const MAX_MULT = 3

export function chainMult(chain: number): number {
  return Math.min(MAX_MULT, 1 + Math.floor(chain / CHAIN_STEP))
}

// ------------------------------------------------------------------- tuning

/** How fast the formation steps sideways, in units per second. */
function marchSpeed(wave: number, shipsLeft: number, total: number): number {
  const base = 0.09 + Math.min(0.15, (wave - 1) * 0.02)
  // The classic acceleration: the fewer left, the faster they come.
  const thinning = 1 + (1 - shipsLeft / Math.max(1, total)) * 2.2
  return base * thinning
}

/** Seconds of warning before a volley fires. Shrinking this is the real ramp. */
export function chargeTime(wave: number): number {
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
function volleyWidth(wave: number, cols: number): number {
  // Scaled by column count, not fixed. A wider board has more lanes to dodge
  // into, so holding the *share* of them that goes hot is what keeps a volley
  // as threatening on one board shape as on the other.
  const upright = 2 + Math.floor((wave - 1) / 2)
  const scaled = Math.round((upright * cols) / 6)
  return Math.min(cols - 1, Math.max(2, scaled))
}

function enemyShotSpeed(wave: number): number {
  return 0.44 + Math.min(0.3, (wave - 1) * 0.035)
}

/** Rounds per hot column: a pair at first, three from wave five. */
function burstCount(wave: number): number {
  return wave < 5 ? 2 : 3
}

/** How far the volley's lanes lean, from wave three. */
function leanFor(wave: number): number {
  return wave >= 3 ? 0.16 + Math.min(0.16, (wave - 3) * 0.03) : 0
}

/** Cargo ships in a wave: one at the front, one to dig for. */
function cargoCount(_wave: number): number {
  return 2
}

// --------------------------------------------------------------- formations

/**
 * The shapes a fleet flies in. The first wave is the full block; after that the
 * shapes take turns, each opening the front up a different way — a channel down
 * the middle, a front drawn in at the sides, a gap-toothed front rank — so where
 * the deeper ships can be reached from, and where the lanes are, changes from
 * wave to wave. Every shape keeps a ship in every column.
 */
export type Formation = 'block' | 'channel' | 'wedge' | 'teeth'

const FORMATIONS: readonly Formation[] = ['block', 'channel', 'wedge', 'teeth']

export function formationFor(wave: number): Formation {
  return FORMATIONS[(wave - 1) % FORMATIONS.length]!
}

function inFormation(shape: Formation, row: number, col: number, layout: Layout): boolean {
  const { rows, cols } = layout
  const front = rows - 1
  const mid = (cols - 1) / 2
  if (shape === 'channel') {
    // The middle two columns are empty but for their back rows.
    return !(Math.abs(col - mid) < 1 && row >= Math.max(1, rows - 2))
  }
  if (shape === 'wedge') {
    // An arrowhead: the front rank drawn in to the middle, the rank behind it less so.
    if (row === front) return Math.abs(col - mid) < mid - 1
    if (row === front - 1) return Math.abs(col - mid) < mid
    return true
  }
  if (shape === 'teeth') {
    // Every other ship of the front rank stood down.
    return row !== front || col % 2 === 0
  }
  return true
}

// ------------------------------------------------------------------ helpers

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

/** Seconds from a wave's start until the last of its ships is in its slot. */
export function introTime(layout: Layout): number {
  return (layout.rows - 1) * 0.1 + ((layout.cols - 1) / 2) * 0.045 + ENTER_TIME
}

/**
 * 0 while a ship waits above the field, 1 once it is in its slot. The front row
 * comes in first, the middle of each row before its ends, so nothing flies in
 * through a ship already parked.
 */
export function enterProgress(state: GameState, ship: Ship): number {
  const { rows, cols } = state.layout
  const delay = (rows - 1 - ship.row) * 0.1 + Math.abs(ship.col - (cols - 1) / 2) * 0.045
  return clamp01((state.waveT - delay) / ENTER_TIME)
}

/**
 * Where a ship is, flight in included — hits are taken where it is drawn. Each
 * ship drops straight down its own column into its slot, so nothing overlaps on
 * the way in and a round that meets one early meets it where it will be.
 */
export function shipX(state: GameState, ship: Ship): number {
  return state.formX + ship.col * state.layout.colStep
}

export function shipY(state: GameState, ship: Ship): number {
  const slot = state.formY + ship.row * state.layout.rowStep
  const e = enterProgress(state, ship)
  if (e >= 1) return slot
  const from = -state.layout.shipH - 0.06
  const k = 1 - (1 - e) ** 3
  return from + (slot - from) * k
}

export function shipSize(state: GameState) {
  return { w: state.layout.shipW, h: state.layout.shipH }
}

export function cannonRect(state: GameState) {
  return {
    x: state.cannonX - CANNON_W / 2,
    y: state.layout.cannonY,
    w: CANNON_W,
    h: CANNON_H,
  }
}

/** Top of the ground the cannon runs on. */
export function railY(layout: Layout) {
  return layout.cannonY + CANNON_H
}

export function dropRadius() {
  return DROP_R
}

/** How fast a capsule falls, for anything that wants to meet one. */
export function dropFall() {
  return DROP_FALL
}

export function shotSize(hostile: boolean) {
  return hostile
    ? { w: ENEMY_SHOT_W, h: ENEMY_SHOT_H }
    : { w: PLAYER_SHOT_W, h: PLAYER_SHOT_H }
}

/** How many trigger pulls this cannon can have in the air at once. */
export function pullsAllowed(state: GameState): number {
  return PULLS_IN_AIR[state.power.rapid] ?? PULLS_IN_AIR[0]
}

/** Seconds between trigger pulls for this cannon. */
export function fireCooldown(state: GameState): number {
  return FIRE_COOLDOWN[state.power.rapid] ?? FIRE_COOLDOWN[0]
}

/** The leans of one pull's rounds. */
export function fanFor(state: GameState): readonly number[] {
  return FANS[state.power.spread] ?? FANS[0]!
}

function pullsInAir(state: GameState): number {
  const seen = new Set<number>()
  for (const s of state.shots) if (!s.hostile && !s.returned && s.pull !== undefined) seen.add(s.pull)
  return seen.size
}

/** Trigger pulls the cannon could make right now, for the lights on its base. */
export function roundsReady(state: GameState): number {
  return Math.max(0, pullsAllowed(state) - pullsInAir(state))
}

function aliveShips(state: GameState): Ship[] {
  return state.ships.filter((s) => s.alive)
}

/**
 * Plating spreads down from the front of the fleet as the waves go on, so the
 * top rows are the ones that change first and the ones that take the beating.
 * Row 0 is the top.
 */
export function shipTier(wave: number, row: number): number {
  const plated = Math.floor((wave - 1) / 2)
  const heavy = Math.floor((wave - 1) / 5)
  let tier = 1
  if (row < plated) tier = 2
  if (row < heavy) tier = 3
  return Math.min(MAX_TIER, tier)
}

/** Hue each kind of ship wears: the site's magenta, violet and indigo. */
export const SPECIES_HUE: Record<Species, number> = {
  squid: 289,
  crab: 259,
  octo: 236,
}

export const CANNON_HUE = 153

function makeShips(wave: number, layout: Layout): Ship[] {
  const shape = formationFor(wave)
  const ships: Ship[] = []
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      if (!inFormation(shape, row, col, layout)) continue
      const tier = shipTier(wave, row)
      ships.push({ col, row, alive: true, tier, hp: tier, hurt: 0, charging: false, charge: 0, cargo: null })
    }
  }
  return ships
}

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * Hand out the wave's capsules, two different powers. The first goes to a ship
 * at the front near the middle, reachable the moment the wave is in; the other
 * goes deeper, to be dug out.
 */
function assignCargo(state: GameState) {
  const kinds = shuffled(POWER_KINDS).slice(0, cargoCount(state.wave))
  const { cols } = state.layout
  const front = new Map<number, Ship>()
  for (const ship of state.ships) {
    const f = front.get(ship.col)
    if (!f || ship.row > f.row) front.set(ship.col, ship)
  }
  const fronts = [...front.values()]
  // The middle half of the front, or the whole front if that is empty.
  const central = fronts.filter((s) => Math.abs(s.col - (cols - 1) / 2) <= cols / 4)
  const pool = central.length ? central : fronts
  const lead = pool[Math.floor(Math.random() * pool.length)]
  if (lead) lead.cargo = kinds.shift()!
  const deep = shuffled(state.ships.filter((s) => !s.cargo && !fronts.includes(s)))
  for (const ship of deep) {
    const kind = kinds.shift()
    if (!kind) break
    ship.cargo = kind
  }
}

/**
 * Row the formation starts at. Later waves get a head start, taken as a share
 * of the ground available rather than a fixed distance, so a short board is not
 * simply handing later waves the whole run-up.
 */
function startFormY(wave: number, layout: Layout): number {
  return layout.startY + Math.min(0.36, (wave - 1) * 0.05) * layout.descent
}

function resetWave(state: GameState, wave: number) {
  state.wave = wave
  state.waveT = 0
  state.ships = makeShips(wave, state.layout)
  state.shots = []
  state.bursts = []
  state.formX = (1 - state.layout.formW) / 2
  state.formY = startFormY(wave, state.layout)
  state.formDir = 1
  state.volleyIn = volleyGap(wave) * 0.8
  state.chargeLeft = 0
  state.hotCols = []
  state.volleySpread = 0
  state.cleanWave = true
  state.clearBonus = null
  // Capsules and sparks still on their way down carry on into the new wave.
  assignCargo(state)
}

/**
 * A fresh cannon after losing one. The input stays as it is — a key still held
 * through the pause should drive the new cannon, not wait to be pressed again.
 */
function resetCannon(state: GameState) {
  state.cannonX = 0.5
  state.fireQueued = false
  state.fireCooldown = 0
  state.shots = []
  // The capsules and sparks on their way down go with the old cannon.
  state.drops = []
  state.sparks = []
  state.lean = 0
  state.kick = 0
  state.respawn = 1
}

export function createInitialState(portrait = true): GameState {
  const state: GameState = {
    layout: makeLayout(portrait),
    phase: 'menu',
    score: 0,
    best: 0,
    lives: 3,
    wave: 1,
    waveT: 0,
    formX: 0,
    formY: 0,
    formDir: 1,
    gait: 0,
    ships: [],
    shots: [],
    bursts: [],
    drops: [],
    sparks: [],
    power: { spread: 0, pierce: 0, rapid: 0 },
    mirror: 0,
    sparksHeld: 0,
    pulls: 0,
    tookKind: null,
    tookFor: 0,
    mirrorFlash: 0,
    cannonX: 0.5,
    moveDir: 0,
    steerX: null,
    firing: false,
    fireQueued: false,
    fireCooldown: 0,
    volleyIn: 0,
    chargeLeft: 0,
    hotCols: [],
    volleySpread: 0,
    dyingFor: 0,
    clearingFor: 0,
    clearBonus: null,
    hitFlash: 0,
    cleanWave: true,
    chain: 0,
    chainT: 0,
    bestChain: 0,
    defused: 0,
    returned: 0,
    shotsFired: 0,
    shotsHit: 0,
    time: 0,
    endCause: null,
    bits: [],
    rings: [],
    floaters: [],
    ripples: [],
    shake: 0,
    kick: 0,
    lean: 0,
    respawn: 0,
  }
  resetWave(state, 1)
  // Behind the start card the fleet is already in formation.
  state.waveT = 99
  return state
}

export function startGame(prev: GameState, portrait = true): GameState {
  const state = createInitialState(portrait)
  state.phase = 'playing'
  state.waveT = 0
  state.best = prev.best
  state.respawn = 1
  return state
}

/** Admin/testing: jump straight to a wave without banking its bonuses. */
export function jumpToWave(prev: GameState, wave: number): GameState {
  if (prev.phase === 'menu' || prev.phase === 'gameover') return prev
  const state: GameState = { ...prev, ships: [...prev.ships], shots: [], drops: [], sparks: [] }
  resetWave(state, Math.max(1, Math.floor(wave) || 1))
  resetCannon(state)
  state.phase = 'playing'
  return state
}

// ------------------------------------------------------------------- effects

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function addRing(state: GameState, x: number, y: number, r0: number, r1: number, life: number, hue: number) {
  state.rings.push({ x, y, r0, r1, life, maxLife: life, hue })
}

function addSparks(state: GameState, x: number, y: number, n: number, hue: number, speed = 0.5, up = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = speed * rand(0.35, 1)
    const life = rand(0.22, 0.45)
    state.bits.push({
      kind: 'spark',
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - up,
      life,
      maxLife: life,
      hue,
      size: rand(0.004, 0.008),
      angle: 0,
      spin: 0,
    })
  }
}

function addShards(state: GameState, x: number, y: number, n: number, hue: number, spread: number, size: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = rand(0.08, 0.34)
    const life = rand(0.55, 1.05)
    state.bits.push({
      kind: 'shard',
      x: x + Math.cos(a) * spread * Math.random(),
      y: y + Math.sin(a) * spread * Math.random(),
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 0.06,
      life,
      maxLife: life,
      hue,
      size: size * rand(0.55, 1.15),
      angle: Math.random() * Math.PI * 2,
      spin: rand(-9, 9),
    })
  }
}

function addFloater(
  state: GameState,
  x: number,
  y: number,
  text: string,
  tone: FloaterTone,
  life = 0.9,
  kind?: PowerKind,
) {
  state.floaters.push({ x, y, text, tone, life, maxLife: life, kind })
  if (state.floaters.length > 14) state.floaters.shift()
}

function addShake(state: GameState, amount: number) {
  state.shake = Math.min(1, state.shake + amount)
}

/** Keep the debris bounded however busy a moment gets. */
const MAX_BITS = 420

function tickEffects(state: GameState, dt: number) {
  const bits: Bit[] = []
  const from = Math.max(0, state.bits.length - MAX_BITS)
  for (let i = from; i < state.bits.length; i++) {
    const b = state.bits[i]!
    const life = b.life - dt
    if (life <= 0) continue
    // Per second, not per frame, so a fast screen throws debris no shorter.
    const drag = Math.pow(b.kind === 'spark' ? 0.04 : 0.3, dt)
    const fall = b.kind === 'plate' ? 0.95 : b.kind === 'shard' ? 0.3 : 0.12
    const vx = b.vx * drag
    const vy = b.vy * drag + fall * dt
    bits.push({ ...b, life, vx, vy, x: b.x + vx * dt, y: b.y + vy * dt, angle: b.angle + b.spin * dt })
  }
  state.bits = bits
  state.rings = state.rings.filter((r) => r.life > dt).map((r) => ({ ...r, life: r.life - dt }))
  state.floaters = state.floaters
    .filter((f) => f.life > dt)
    .map((f) => ({ ...f, life: f.life - dt, y: f.y - dt * 0.05 }))
  state.ripples = state.ripples.filter((r) => r.life > dt).map((r) => ({ ...r, life: r.life - dt }))
  state.shake = Math.max(0, state.shake - dt * 2.4)
  state.kick = Math.max(0, state.kick - dt * 7)
  state.respawn = Math.max(0, state.respawn - dt * 2.2)
  state.mirrorFlash = Math.max(0, state.mirrorFlash - dt * 3)
}

/** A ship's centre, for aiming debris at. */
function shipCentre(state: GameState, ship: Ship) {
  return {
    x: shipX(state, ship) + state.layout.shipW / 2,
    y: shipY(state, ship) + state.layout.shipH / 2,
  }
}

/** Where a ship's shots leave it: the nozzle under its middle. */
export function emitterOf(state: GameState, ship: Ship) {
  return {
    x: shipX(state, ship) + state.layout.shipW / 2,
    y: shipY(state, ship) + state.layout.shipH * 0.92,
  }
}

/** Where a spark is headed, and where a mirror sits: over the turret. */
export function mirrorPoint(state: GameState) {
  const c = cannonRect(state)
  return { x: state.cannonX, y: c.y + c.h * 0.1 }
}

// ------------------------------------------------------------------- volleys

/**
 * Pick the columns that will fire, and how far the curtain leans. Only columns
 * that still have a ship in them can go hot, so the tell is never a bluff.
 */
function beginCharge(state: GameState) {
  const live = aliveShips(state)
  if (live.length === 0) return

  const cols = shuffled([...new Set(live.map((s) => s.col))])
  const want = Math.min(cols.length, volleyWidth(state.wave, state.layout.cols))

  // Every hot column is a real threat and a real gap.
  state.hotCols = cols.slice(0, want).sort((a, b) => a - b)
  // The front ship of each hot column is the one that winds up and fires.
  for (const col of state.hotCols) {
    const front = frontShipOfColumn(state, col)
    if (front) {
      front.charging = true
      front.charge = 0
    }
  }

  // From wave 3 the curtain can lean, so a cold column is not automatically safe.
  const lean = leanFor(state.wave)
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
  const lanes = state.ships.filter((s) => s.alive && s.charging)
  for (const s of state.ships) {
    s.charging = false
    s.charge = 0
  }
  state.hotCols = []
  state.chargeLeft = 0
  state.volleyIn = volleyGap(state.wave)
  if (lanes.length === 0) return
  for (const ship of lanes) {
    state.bursts.push({ col: ship.col, row: ship.row, left: burstCount(state.wave), next: 0 })
  }
  sfx('boom')
}

/** Let each fired column empty its burst. A ship that dies mid-burst takes the rest with it. */
function advanceBursts(state: GameState, dt: number) {
  if (state.bursts.length === 0) return
  const speed = enemyShotSpeed(state.wave)
  const kept: Burst[] = []
  for (const burst of state.bursts) {
    const ship = state.ships.find((s) => s.col === burst.col && s.row === burst.row)
    if (!ship || !ship.alive) continue
    burst.next -= dt
    if (burst.next <= 0) {
      const e = emitterOf(state, ship)
      state.shots.push({
        x: e.x,
        y: e.y - ENEMY_SHOT_H * 0.5,
        vx: state.volleySpread * speed,
        vy: speed,
        hostile: true,
      })
      addSparks(state, e.x, e.y, 3, 4, 0.22)
      burst.left -= 1
      burst.next += BURST_GAP
    }
    if (burst.left > 0) kept.push(burst)
  }
  state.bursts = kept
}

// -------------------------------------------------------------------- inputs

export function setMove(state: GameState, dir: number): GameState {
  return { ...state, moveDir: Math.max(-1, Math.min(1, dir)) }
}

/** Steer toward a point on the field, in stage-width units; null lets go. */
export function setSteer(state: GameState, x: number | null): GameState {
  return { ...state, steerX: x === null ? null : Math.max(0, Math.min(1, x)) }
}

export function setFiring(state: GameState, firing: boolean): GameState {
  // Latch the press so a tap shorter than a frame still gets its shot.
  return { ...state, firing, fireQueued: state.fireQueued || firing }
}

function tryFire(state: GameState) {
  if (state.fireCooldown > 0) return
  if (pullsInAir(state) >= pullsAllowed(state)) return

  const pull = ++state.pulls
  const through = PIERCE_THROUGH[state.power.pierce] ?? 0
  const fan = fanFor(state)
  for (const lane of fan) {
    state.shots.push({
      x: state.cannonX + lane * 0.05,
      y: state.layout.cannonY - PLAYER_SHOT_H,
      vx: lane * PLAYER_SHOT_SPEED,
      vy: -PLAYER_SHOT_SPEED,
      hostile: false,
      pierce: lane === 0 ? through : 0,
      pull,
      from: lane !== 0 ? 'side' : through > 0 ? 'lance' : undefined,
    })
  }
  state.fireCooldown = fireCooldown(state)
  state.shotsFired += fan.length
  state.kick = 1
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

/**
 * The cannon's body, as two boxes rather than one: the full-width sled, and
 * the turret on top of it. A shot that only clips the empty air over the sled's
 * shoulders is a miss, as it looks.
 */
function hitsCannon(state: GameState, x: number, y: number, w: number, h: number) {
  const c = cannonRect(state)
  const sledTop = c.y + c.h * 0.5
  if (overlaps(x, y, w, h, c.x, sledTop, c.w, c.h - c.h * 0.5)) return true
  const turretW = c.w * 0.5
  return overlaps(x, y, w, h, state.cannonX - turretW / 2, c.y - c.h * 0.1, turretW, c.h * 0.6)
}

/** Roman numerals for a level: they read at a glance where a number might be taken for a count. */
export function levelMark(level: number): string {
  return ['', 'I', 'II', 'III'][level] ?? ''
}

function takeDrop(state: GameState, kind: PowerKind) {
  const c = cannonRect(state)
  const hue = POWER_HUE[kind]
  state.tookKind = kind
  state.tookFor = 1.1
  if (state.power[kind] >= MAX_LEVEL) {
    // Nothing left to add: it pays instead, so a capsule is never wasted.
    const gained = SCORE_MAXED
    state.score += gained
    addFloater(state, state.cannonX, c.y - 0.03, `${POWER_LABEL[kind]} full +${gained}`, 'pickup', 1.1, kind)
  } else {
    state.power[kind] += 1
    addFloater(state, state.cannonX, c.y - 0.03, `${POWER_LABEL[kind]} ${levelMark(state.power[kind])}`, 'pickup', 1.2, kind)
  }
  addRing(state, state.cannonX, c.y + c.h * 0.4, 0.02, 0.11, 0.5, hue)
  addSparks(state, state.cannonX, c.y + c.h * 0.3, 12, hue, 0.45, 0.12)
  sfx('good')
}

function advanceDrops(state: GameState, dt: number) {
  const kept: Drop[] = []
  for (const drop of state.drops) {
    drop.y += DROP_FALL * dt
    drop.life -= dt
    if (drop.life <= 0 || drop.y - DROP_R > state.layout.fieldH) continue
    if (hitsCannon(state, drop.x - DROP_R, drop.y - DROP_R, DROP_R * 2, DROP_R * 2)) {
      takeDrop(state, drop.kind)
      continue
    }
    kept.push(drop)
  }
  state.drops = kept
}

/**
 * Sparks swing out of the broken ship and home in on the cannon wherever it
 * has gone, so a charge taken is a mirror had — no catching it.
 */
function advanceSparks(state: GameState, dt: number) {
  if (state.sparks.length === 0) return
  const goal = mirrorPoint(state)
  const kept: Spark[] = []
  for (const sp of state.sparks) {
    sp.age += dt
    const dx = goal.x - sp.x
    const dy = goal.y - sp.y
    const d = Math.hypot(dx, dy) || 1
    if (d < SPARK_CATCH) {
      takeSpark(state)
      continue
    }
    const speed = Math.min(SPARK_SPEED, 0.4 + sp.age * 5)
    const steer = Math.min(1, dt * (3 + sp.age * 10))
    sp.vx += ((dx / d) * speed - sp.vx) * steer
    sp.vy += ((dy / d) * speed - sp.vy) * steer
    const step = Math.hypot(sp.vx, sp.vy) * dt
    // Never step past the cannon on a slow frame.
    if (step >= d) {
      takeSpark(state)
      continue
    }
    sp.x += sp.vx * dt
    sp.y += sp.vy * dt
    kept.push(sp)
  }
  state.sparks = kept
}

function takeSpark(state: GameState) {
  const m = mirrorPoint(state)
  if (state.mirror >= MAX_MIRROR) {
    state.score += SCORE_SPARE_SPARK
    addFloater(state, m.x, m.y - 0.05, `+${SCORE_SPARE_SPARK}`, 'score')
  } else {
    state.sparksHeld += 1
    if (state.sparksHeld >= SPARKS_PER_MIRROR) {
      state.sparksHeld = 0
      state.mirror += 1
      addFloater(state, m.x, m.y - 0.05, 'Mirror', 'mirror', 1.1)
      addRing(state, m.x, m.y, 0.02, 0.12, 0.5, MIRROR_HUE)
      sfx('good')
    }
  }
  addRing(state, m.x, m.y, 0.015, 0.075, 0.4, MIRROR_HUE)
  addSparks(state, m.x, m.y, 8, MIRROR_HUE, 0.35, 0.1)
  sfx('pad')
}

/** Which band of the points table a row falls in, spread over however many rows this board has. */
function scoreBand(state: GameState, row: number) {
  return Math.min(
    SCORE_ROW.length - 1,
    Math.floor((row * SCORE_ROW.length) / Math.max(1, state.layout.rows)),
  )
}

/** Armour coming off: the plate itself, a few sparks, a small knock. */
function shedPlate(state: GameState, ship: Ship) {
  const { x, y } = shipCentre(state, ship)
  const { shipW, shipH } = state.layout
  const hue = SPECIES_HUE[speciesFor(ship.row, state.layout.rows)]
  // hp has already dropped: 2 left means the side plates went, 1 the helmet.
  const plates =
    ship.hp >= 2
      ? [
          { dx: -shipW * 0.45, dy: 0 },
          { dx: shipW * 0.45, dy: 0 },
        ]
      : [{ dx: 0, dy: -shipH * 0.42 }]
  for (const p of plates) {
    const life = rand(0.7, 1)
    state.bits.push({
      kind: 'plate',
      x: x + p.dx,
      y: y + p.dy,
      vx: Math.sign(p.dx || rand(-1, 1)) * rand(0.06, 0.16),
      vy: rand(-0.2, -0.08),
      life,
      maxLife: life,
      hue,
      size: shipW * (p.dy ? 0.36 : 0.16),
      angle: 0,
      spin: rand(-7, 7),
    })
  }
  addSparks(state, x, y - shipH * 0.2, 6, -1, 0.42)
  addShake(state, 0.05)
}

function explodeShip(state: GameState, ship: Ship) {
  const { x, y } = shipCentre(state, ship)
  const { shipW } = state.layout
  const hue = SPECIES_HUE[speciesFor(ship.row, state.layout.rows)]
  addShards(state, x, y, 9, hue, shipW * 0.3, shipW * 0.13)
  addSparks(state, x, y, 8, hue, 0.55)
  addRing(state, x, y, shipW * 0.2, shipW * 0.62, 0.34, hue)
  addShake(state, ship.tier >= 2 ? 0.16 : 0.1)
}

/** Returns true when the round finished it off. */
function hitShip(state: GameState, ship: Ship, shot: Shot): boolean {
  if (!shot.hit) {
    shot.hit = true
    if (!shot.returned) state.shotsHit += 1
  }
  // Any hit keeps the chain going; only a kill makes it longer.
  if (state.chain > 0) state.chainT = CHAIN_WINDOW

  // A round of their own breaks any plate.
  ship.hp = shot.returned ? 0 : ship.hp - 1
  if (ship.hp > 0) {
    ship.hurt = 1
    shedPlate(state, ship)
    sfx('tap')
    return false
  }

  ship.alive = false
  const before = chainMult(state.chain)
  state.chain += 1
  state.chainT = CHAIN_WINDOW
  state.bestChain = Math.max(state.bestChain, state.chain)
  const mult = chainMult(state.chain)

  // Plated hulls are worth more for what they cost you to break: a quarter again a plate.
  // Spread the value table across however many rows this board has, so a
  // squat landscape fleet is not worth more per ship than a tall upright one.
  const worth = Math.round(SCORE_ROW[scoreBand(state, ship.row)] * (1 + 0.25 * (ship.tier - 1)))
  let gained = worth * mult
  const { x, y } = shipCentre(state, ship)

  if (ship.charging) {
    // A lit ship taken before it fires takes its shot with it, and its charge
    // comes down to the cannon as a mirror.
    gained += SCORE_DEFUSE * mult
    ship.charging = false
    ship.charge = 0
    state.hotCols = state.hotCols.filter((c) => c !== ship.col)
    state.defused += 1
    state.sparks.push({ x, y: y + state.layout.shipH * 0.45, vx: rand(-0.35, 0.35), vy: -0.25, age: 0 })
    addSparks(state, x, y + state.layout.shipH * 0.4, 10, 4, 0.5)
    addFloater(state, x, y + state.layout.shipH * 0.9, 'Stopped', 'defuse', 1)
    sfx('perfect')
  }
  if (shot.returned) {
    gained += SCORE_RETURNED * mult
    addFloater(state, x, y + state.layout.shipH * 0.9, 'Returned', 'mirror', 1)
  }
  if (ship.cargo) {
    state.drops.push({ x, y: y + state.layout.shipH * 0.2, kind: ship.cargo, life: 12 })
    addRing(state, x, y, 0.02, 0.09, 0.45, POWER_HUE[ship.cargo])
    ship.cargo = null
  }

  state.score += gained
  explodeShip(state, ship)
  addFloater(state, x, y - state.layout.shipH * 0.2, `+${gained}`, 'score')
  if (mult > before) {
    addFloater(state, x, y - state.layout.shipH * 0.75, `×${mult} chain`, 'chain', 1.2)
    sfx('good')
  }
  sfx('hit', Math.min(5, Math.floor(state.chain / 3)))
  return true
}

function breakChain(state: GameState) {
  state.chain = 0
  state.chainT = 0
}

function clearCharge(state: GameState) {
  state.chargeLeft = 0
  state.hotCols = []
  state.bursts = []
  for (const s of state.ships) {
    s.charging = false
    s.charge = 0
  }
}

/** A cannon lost: a level off every power, and the mirrors with it. */
function losePowers(state: GameState) {
  for (const kind of POWER_KINDS) state.power[kind] = Math.max(0, state.power[kind] - 1)
  state.mirror = 0
  state.sparksHeld = 0
}

function loseLife(state: GameState) {
  state.lives -= 1
  state.cleanWave = false
  state.hitFlash = 1
  state.phase = 'dying'
  state.dyingFor = DEATH_PAUSE
  state.shots = []
  state.sparks = []
  clearCharge(state)
  breakChain(state)
  losePowers(state)
  if (state.lives <= 0) state.endCause = 'lives'

  // The cannon goes up in pieces.
  const c = cannonRect(state)
  const cx = state.cannonX
  const cy = c.y + c.h * 0.55
  addShards(state, cx, cy, 18, CANNON_HUE, c.w * 0.4, 0.016)
  addSparks(state, cx, cy, 16, 4, 0.7, 0.2)
  addSparks(state, cx, cy, 10, CANNON_HUE, 0.5, 0.25)
  addRing(state, cx, cy, 0.02, 0.2, 0.55, 4)
  addRing(state, cx, cy, 0.01, 0.12, 0.4, CANNON_HUE)
  addShake(state, 0.9)
  sfx(state.lives > 0 ? 'hurt' : 'die')
}

/** A mirror takes the round: it turns round and climbs its own lane, and the cannon is untouched. */
function returnRound(state: GameState, shot: Shot): Shot {
  state.mirror -= 1
  state.returned += 1
  state.mirrorFlash = 1
  const m = mirrorPoint(state)
  addRing(state, shot.x, m.y, 0.015, 0.09, 0.4, MIRROR_HUE)
  addSparks(state, shot.x, m.y, 10, MIRROR_HUE, 0.45, 0.2)
  addShake(state, 0.18)
  sfx('perfect')
  return {
    x: shot.x,
    y: m.y - ENEMY_SHOT_H,
    vx: -shot.vx * 0.5,
    vy: -RETURN_SPEED,
    hostile: false,
    returned: true,
    pierce: 0,
  }
}

/** Ships on the line end the run outright, however many lives are left. */
function endRun(state: GameState) {
  state.phase = 'dying'
  state.dyingFor = LINE_PAUSE
  state.lives = 0
  state.endCause = 'line'
  state.shots = []
  state.sparks = []
  state.hitFlash = 1
  clearCharge(state)
  breakChain(state)
  // The line gives way along its whole length.
  const y = state.layout.holdLine
  for (let i = 0; i <= 12; i++) {
    const x = i / 12
    addSparks(state, x, y, 3, 4, 0.35, 0.1)
    addShards(state, x, y, 1, 4, 0.01, 0.01)
  }
  addShake(state, 1)
  sfx('die')
}

// ---------------------------------------------------------------------- tick

function advanceFormation(state: GameState, dt: number) {
  const live = aliveShips(state)
  if (live.length === 0) return

  const minCol = Math.min(...live.map((s) => s.col))
  const maxCol = Math.max(...live.map((s) => s.col))
  const { colStep, shipW } = state.layout
  const leftEdge = state.formX + minCol * colStep
  const rightEdge = state.formX + maxCol * colStep + shipW

  const total = state.layout.cols * state.layout.rows
  const speed = marchSpeed(state.wave, live.length, total)
  const step = speed * dt * state.formDir
  const nextLeft = leftEdge + step
  const nextRight = rightEdge + step
  // Legs and claws keep time with the march, faster as the fleet thins.
  state.gait += (speed * dt) / 0.022

  if (nextLeft < MARGIN || nextRight > 1 - MARGIN) {
    // Turn and drop — the pressure that eventually reaches the line.
    state.formDir *= -1
    state.formY += state.layout.dropPerTurn
    sfx('tap')
    return
  }
  state.formX += step
}

function advanceShots(state: GameState, dt: number) {
  const layout = state.layout
  const ships = aliveShips(state)
  const survivors: Shot[] = []
  const floor = railY(layout)

  for (const shot of state.shots) {
    const lastY = shot.y
    shot.x += shot.vx * dt
    shot.y += shot.vy * dt
    const size = shotSize(shot.hostile)
    const left = shot.x - size.w / 2

    if (shot.y < -size.h || shot.y > state.layout.fieldH + size.h) continue
    if (left < -size.w || left > 1 + size.w) continue

    if (shot.hostile) {
      const nose = shot.y + size.h
      if (lastY + size.h < layout.holdLine && nose >= layout.holdLine) {
        state.ripples.push({ x: shot.x, life: 0.45 })
      }
      if (hitsCannon(state, left, shot.y, size.w, size.h)) {
        if (state.mirror > 0) {
          survivors.push(returnRound(state, shot))
          continue
        }
        loseLife(state)
        return
      }
      if (nose >= floor) {
        // Into the ground, in a spit of sparks.
        addSparks(state, shot.x, floor, 4, 8, 0.3, 0.25)
        continue
      }
      survivors.push(shot)
      continue
    }

    let consumed = false
    for (const ship of ships) {
      if (!ship.alive) continue
      const sx = shipX(state, ship)
      const sy = shipY(state, ship)
      if (!overlaps(left, shot.y, size.w, size.h, sx, sy, layout.shipW, layout.shipH)) continue
      const killed = hitShip(state, ship, shot)
      // A piercing round carries on through a hull it breaks, as many as it has left.
      if (killed && (shot.pierce ?? 0) > 0) {
        shot.pierce = (shot.pierce ?? 0) - 1
        continue
      }
      consumed = true
      break
    }
    if (!consumed) survivors.push(shot)
  }

  state.shots = survivors
}

function moveCannon(state: GameState, dt: number) {
  const x0 = state.cannonX
  const lo = CANNON_W / 2 + 0.01
  const hi = 1 - CANNON_W / 2 - 0.01
  let next = x0
  if (state.moveDir !== 0) {
    next = x0 + state.moveDir * CANNON_SPEED * dt
  } else if (state.steerX !== null) {
    const want = Math.max(lo, Math.min(hi, state.steerX))
    const d = want - x0
    if (Math.abs(d) > STEER_DEAD) next = x0 + Math.sign(d) * Math.min(Math.abs(d), CANNON_SPEED * dt)
  }
  state.cannonX = Math.max(lo, Math.min(hi, next))
  const v = dt > 0 ? (state.cannonX - x0) / (CANNON_SPEED * dt) : 0
  state.lean += (v - state.lean) * Math.min(1, dt * 12)
}

export function tick(prev: GameState, dt: number): GameState {
  const state: GameState = {
    ...prev,
    ships: prev.ships.map((s) => ({ ...s })),
    shots: prev.shots.map((s) => ({ ...s })),
    bursts: prev.bursts.map((b) => ({ ...b })),
    drops: prev.drops.map((d) => ({ ...d })),
    sparks: prev.sparks.map((sp) => ({ ...sp })),
    power: { ...prev.power },
    hotCols: [...prev.hotCols],
    bits: prev.bits,
    rings: prev.rings,
    floaters: prev.floaters,
    ripples: prev.ripples,
  }
  state.time += dt
  state.hitFlash = Math.max(0, state.hitFlash - dt * 1.4)
  state.tookFor = Math.max(0, state.tookFor - dt)
  if (state.tookFor <= 0) state.tookKind = null
  for (const s of state.ships) {
    if (s.hurt > 0) s.hurt = Math.max(0, s.hurt - dt * 3)
  }
  // Debris keeps flying through every pause, so a death or a clear plays out.
  tickEffects(state, dt)

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
    // Rounds still climbing carry on off the top; there is nothing left to hit.
    state.shots = state.shots.filter((s) => {
      s.x += s.vx * dt
      s.y += s.vy * dt
      return s.y > -PLAYER_SHOT_H
    })
    // What is still on its way down to the cannon gets there.
    moveCannon(state, dt)
    advanceDrops(state, dt)
    advanceSparks(state, dt)
    if (state.clearingFor > 0) return state
    // The cannon stays where it is, and so do its powers: a wave cleared is
    // not a cannon lost.
    resetWave(state, state.wave + 1)
    state.phase = 'playing'
    return state
  }

  state.waveT += dt
  const entering = state.waveT < introTime(state.layout)

  moveCannon(state, dt)

  state.fireCooldown = Math.max(0, state.fireCooldown - dt)
  if (state.firing || state.fireQueued) tryFire(state)
  state.fireQueued = false

  advanceDrops(state, dt)
  advanceSparks(state, dt)

  // The fleet holds its fire and its march until every ship is in its slot.
  if (!entering) {
    advanceFormation(state, dt)

    // Volley cycle: wait, light up, loose.
    if (state.chargeLeft > 0) {
      state.chargeLeft -= dt
      const total = chargeTime(state.wave)
      const progress = 1 - Math.max(0, state.chargeLeft) / total
      for (const s of state.ships) s.charge = s.alive && s.charging ? progress : 0
      if (state.chargeLeft <= 0) fireVolley(state)
    } else {
      state.volleyIn -= dt
      if (state.volleyIn <= 0) beginCharge(state)
    }
  }

  advanceBursts(state, dt)
  advanceShots(state, dt)
  if (state.phase !== 'playing') return state

  // The chain's clock only runs while there is something to shoot.
  if (!entering && state.chain > 0) {
    state.chainT -= dt
    if (state.chainT <= 0) breakChain(state)
  }

  // Did anything reach the line?
  const live = aliveShips(state)
  for (const ship of live) {
    if (shipY(state, ship) + state.layout.shipH >= state.layout.holdLine) {
      endRun(state)
      return state
    }
  }

  if (live.length === 0) {
    const clear = SCORE_WAVE_CLEAR
    const clean = state.cleanWave ? SCORE_CLEAN_WAVE : 0
    state.score += clear + clean
    state.clearBonus = { clear, clean }
    state.phase = 'clearing'
    state.clearingFor = CLEAR_PAUSE
    // What was still falling fizzles out where it is.
    for (const shot of state.shots) {
      if (shot.hostile) addSparks(state, shot.x, shot.y + ENEMY_SHOT_H / 2, 3, 4, 0.2)
    }
    state.shots = state.shots.filter((s) => !s.hostile)
    state.bursts = []
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
      state.shotsFired > 0 ? Math.min(100, Math.round((state.shotsHit / state.shotsFired) * 100)) : 0,
    spread: state.power.spread,
    pierce: state.power.pierce,
    rapid: state.power.rapid,
    mirror: state.mirror,
    sparks: state.sparksHeld,
    chain: state.chain,
    mult: chainMult(state.chain),
    bestChain: state.bestChain,
    endCause: state.endCause,
  }
}
