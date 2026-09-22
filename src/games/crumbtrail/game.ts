/**
 * Crumbtrail — Pellets with the exit removed.
 *
 * Same chomp, same crumbs, same chasers. The difference is that there is no
 * board to finish: the maze is generated forever above you, and the run is as
 * long as you can keep climbing it.
 *
 * Three rules carry the whole thing.
 *
 * The camera is yours. It rises to follow you up and never moves on its own,
 * so the pace of the run is set by you and not by a timer. Reading a junction
 * before you commit to it is allowed to take as long as it takes.
 *
 * What is not allowed is settling in. Stand still — or circle the same few
 * rows farming crumbs — and the tide below the board starts climbing, and it
 * does not stop until you have made ground again. Progress is the only thing
 * that answers it, so a crumb detour is a bet rather than free money.
 *
 * And the chasers are already on the board. They are seeded into the maze as
 * it generates, asleep, far enough ahead that they scroll into view long
 * before you reach them, and they wake when you get close. You can see what is
 * waiting and pick your corridor around it; nothing arrives from off screen.
 *
 * The board under all of this is a rolling window, so the grid work — the
 * chaser distance field especially — stays on a small fixed array, and the
 * movement code is Pellets' with the den taken out.
 */
import { getPersonalBest } from '../../lib/personalBest'
import { haptic } from '../../lib/haptics'
import { sfx } from '../../lib/sound'
import {
  BELOW_VIEW,
  bufferRows,
  makeBand,
  makeOpeningBand,
  pickCols,
  type GenRow,
  type RowKind,
} from './maze'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'dying' | 'gameover'
export type GhostMode = 'asleep' | 'chase' | 'scatter' | 'frightened' | 'eaten'
export type GhostKind = 'blink' | 'pink' | 'herd' | 'inky' | 'clyde'
export type DeathCause = 'caught' | 'drowned'

export type Cell = { x: number; y: number }

export type Ghost = {
  id: number
  kind: GhostKind
  x: number
  y: number
  dir: Dir
  mode: GhostMode
  /** Off-board corner this one laps toward while scattering. */
  corner: Cell
  bob: number
  /** 0..1 flash after a surge hit. */
  hit: number
  /** 0..1 stir as it wakes, so the moment it comes alive is legible. */
  arrive: number
}

/**
 * The detour. One appears a few rows up and off your line, keeps for a few
 * seconds, then goes — a standing offer to spend time you may not have.
 */
export type Fruit = {
  x: number
  y: number
  /** Seconds left before it goes. */
  life: number
  maxLife: number
  value: number
  tier: number
}

export type Pop = { x: number; y: number; life: number; text: string }
export type TrailDot = { x: number; y: number; life: number }

export type Snapshot = {
  phase: Phase
  score: number
  best: number
  lives: number
  /** Rows climbed — the run's distance. */
  depth: number
  surge: number
  surgeTime: number
  crumbStreak: number
  crumbStreakBest: number
  /** Blue chasers eaten this run. */
  ghostsEaten: number
  /** 0..1 — how awake the tide is, for the HUD warning. */
  tide: number
  cause: DeathCause | null
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  lives: number
  cols: number
  /** Buffer height, including the strips above and below the view. */
  rows: number
  open: boolean[][]
  crumbs: boolean[][]
  power: boolean[][]
  kind: RowKind[]
  /** World row sitting in buffer row `rows - 1`. */
  originRow: number
  /** Next world row the generator will hand out. */
  genRow: number
  /** World row the next sleeping chaser is due on. */
  nextSeedRow: number
  genQueue: GenRow[]
  seed: number
  /** World row drawn along the bottom of the view. Never goes down. */
  camera: number
  /** World row of the tide's surface. */
  tide: number
  /** Seconds since the run last reached a new high row. */
  stall: number
  /** World row the player started on, so distance reads from zero. */
  baseRow: number
  /** Rows climbed. */
  depth: number
  player: {
    x: number
    y: number
    dir: Dir
    pending: Dir | null
    pendingAge: number
  }
  ghosts: Ghost[]
  nextGhostId: number
  fright: number
  frightEaten: number
  /**
   * Blue chasers eaten this run, for the record book.
   *
   * Only the frightened ones. A surge bounces a chaser off rather than eating
   * it, and the two are different acts with different ladders — folding them
   * together would make the board read as "chasers removed", which is not what
   * it says.
   */
  ghostsEaten: number
  mode: 'chase' | 'scatter'
  modeTimer: number
  surge: number
  surgeTime: number
  surgeHits: number
  crumbStreak: number
  crumbStreakBest: number
  fruit: Fruit | null
  /** Seconds until the next one is offered. */
  fruitTimer: number
  lastTile: Cell
  trail: TrailDot[]
  pops: Pop[]
  deathAnim: number
  cause: DeathCause | null
  invuln: number
  mouth: number
  time: number
}

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

const VEC: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Arcade tie-break order when two routes are the same length. */
const DIRS: Dir[] = ['up', 'left', 'down', 'right']

const SCORE_CRUMB = 10
const SCORE_POWER = 50
const SCORE_ROW = 5
const SCORE_GHOST = [200, 400, 800, 1600]
const SCORE_SURGE = [150, 300, 600, 1200]
/**
 * One life.
 *
 * An endless climber with three of them is really three short runs stapled
 * together: the respawn had to clear the board and shove the tide back to be
 * survivable at all, which handed you a fresh start rather than a consequence.
 * One life makes the whole distance one unbroken decision.
 */
const START_LIVES = 1
const FRIGHT_TIME = 6.5

const PLAYER_SPEED = 5.2
const GHOST_SPEED = 3.8
const FRIGHT_SPEED = 2.7
const EATEN_SPEED = 9
const SURGE_SPEED = 1.85

const DEATH_TIME = 0.85
const RESPAWN_INVULN = 1.6
/**
 * Crumbs to fill the surge meter.
 *
 * Pellets charges it over 26, which is about five seconds of an open lane
 * here — the lanes are wall-to-wall crumbs and you are always moving, so it
 * was refilling faster than you could find a use for it. At eighty it is
 * something you spend deliberately.
 */
const SURGE_CRUMBS = 80
const SURGE_TIME = 1.7
const STREAK_STEP = 10
const MAX_MULT = 4
/**
 * Past x4 the steps get longer, but they never stop.
 *
 * The multiplier used to stop dead at a streak of thirty, which you clear in
 * the first twenty seconds — so a streak of two hundred paid exactly what a
 * streak of thirty did, and the mechanic the game is named after quietly
 * stopped being worth holding. Everything a long streak costs you (the route
 * round the bare corridors, the crumb you double back for) was being spent for
 * nothing.
 */
const LATE_STEP = 30
const MAX_MULT_LATE = 8

/**
 * Fresh crumbs in a row that summon the flock.
 *
 * Pac-Man 256 hangs its whole identity on a streak number big enough to be
 * worth telling someone about. This is that: every hundred sends every chaser
 * on the board fleeing at once, which is the power crumb's payoff earned by
 * route-reading rather than found on the floor. It repeats, so a deep run keeps
 * a target in front of it.
 */
const STREAK_LANDMARK = 100
const SCORE_LANDMARK = 1000

const LATE_TURN = 0.34
const CENTER_EPS = 0.001
const PENDING_TTL = 1.1

/**
 * Where you sit on screen once the camera is following: this far up from the
 * bottom, as a fraction of the view. Low enough that most of the screen is the
 * maze ahead, high enough that the tide has somewhere to appear from.
 */
const FOLLOW_FRAC = 0.36

/**
 * Seconds without reaching a new high row before the tide starts climbing.
 *
 * Long enough to read a junction, double back a lane for a crumb, or wait out
 * a chaser; short enough that parking in a cleared pocket is not a plan.
 */
const STALL_LIMIT = 2.6
/** Where the tide sits when it is not chasing you: just under the view. */
const TIDE_REST_GAP = 1.5
/** How fast it falls back once you have made ground. */
const TIDE_EBB = 3.2

/** Rows below a sleeping chaser you have to get before it stirs. */
const WAKE_RANGE = 5

/**
 * Rows ahead of the player the herder aims for.
 *
 * Every chaser borrowed from Pac-Man converges on where the player *is* — even
 * Pinky's ambush is four tiles along the same idea. This game's verb is
 * climbing, so this one aims at where the player is going and tries to be
 * standing in it. It is the one chaser you go around rather than away from.
 *
 * Buffer rows count downward as the world goes up, so ahead is a smaller y.
 */
const HERD_LEAD = 6

/**
 * Fruit. Worth more the deeper you are, so the offer keeps pace with a run
 * where crumbs are already paying a multiplier.
 */
const FRUIT_VALUES = [300, 500, 800, 1200, 2000]
const FRUIT_LIFE = 8
/** Seconds between offers — jittered, and only ever one on the board. */
const FRUIT_GAP_MIN = 14
const FRUIT_GAP_MAX = 24
/** Rows above you it can land, and how far off your column it has to be. */
const FRUIT_ROWS_AHEAD = [3, 8] as const
const FRUIT_MIN_OFFSET = 2

function loadBest() {
  return getPersonalBest('crumbtrail')
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  return (ax - bx) ** 2 + (ay - by) ** 2
}

/**
 * Grid for a playfield of this size.
 *
 * Takes the field rather than the window, because the header band eats a real
 * slice of the screen — sizing the buffer off `innerHeight` would quietly hand
 * the run a couple of rows it can never see.
 */
export function crumbtrailViewportFor(w: number, h: number) {
  const cols = pickCols(w, h)
  return { cols, rows: bufferRows(w, h, cols) }
}

export function crumbtrailViewport() {
  const w = typeof window === 'undefined' ? 900 : window.innerWidth
  const h = typeof window === 'undefined' ? 600 : window.innerHeight
  return crumbtrailViewportFor(w, h)
}

export function streakMult(crumbStreak: number) {
  const early = 1 + Math.floor(crumbStreak / STREAK_STEP)
  if (early < MAX_MULT) return early
  const over = crumbStreak - STREAK_STEP * (MAX_MULT - 1)
  return Math.min(MAX_MULT_LATE, MAX_MULT + Math.floor(over / LATE_STEP))
}

/** World row currently sitting in buffer row `y`. */
export function worldRowAt(state: GameState, y: number) {
  return state.originRow + (state.rows - 1 - y)
}

/** Buffer row holding world row `row` — the inverse, and floats are fine. */
export function bufferRowOf(state: GameState, row: number) {
  return state.rows - 1 - (row - state.originRow)
}

/** How far up the view the camera tries to keep you. */
function followGap(state: GameState) {
  const visible = state.rows - BELOW_VIEW
  return Math.max(4, Math.round(visible * FOLLOW_FRAC))
}

/**
 * How fast the tide climbs once it is awake, in rows per second.
 *
 * It eases in over a couple of seconds rather than starting at full speed, so
 * the first thing you notice is that it has started, not that it has arrived.
 */
function tideSpeed(state: GameState) {
  const over = state.stall - STALL_LIMIT
  if (over <= 0) return 0
  const ramp = Math.min(1, over / 1.2)
  const top = 1.7 + Math.min(1.3, state.depth * 0.003)
  return top * (0.35 + 0.65 * ramp)
}

/**
 * Chasers gain on you as the run goes, but never much: at the ceiling they are
 * still a fifth slower than you are, so depth makes the board harder to read
 * rather than making you unable to outrun anything on it.
 */
function chaserSpeedScale(depth: number) {
  return 1 + Math.min(0.22, depth * 0.0007)
}

function frightSpeedScale(depth: number) {
  return 1 + Math.min(0.22, depth * 0.0006)
}

function scatterTime(depth: number) {
  return Math.max(3.5, 7 - depth * 0.008)
}

function chaseTime(depth: number) {
  return Math.min(30, 20 + depth * 0.02)
}

/**
 * Chasers on the board at this depth, asleep and awake together.
 *
 * Opening on one, and taking until row 165 to reach four, left the early run
 * too quiet — a single chaser is one corridor to avoid, which is a puzzle
 * rather than a chase. Starting on two means there is always a second thing to
 * account for, and the full four now arrive by row 90.
 */
function wantGhosts(depth: number) {
  return Math.min(4, 2 + Math.floor(depth / 45))
}

/**
 * Rows between one sleeper and the next.
 *
 * Seeding used to be a coin flip on every row, which is a lousy way to pace
 * anything: independent rolls clump, and because rows only arrive when you
 * climb, a fast stretch bought several rolls in a couple of seconds. You got
 * nothing for ages and then a knot of them at once. Scheduling the next one a
 * set distance ahead instead makes the spacing the thing that varies, within a
 * range that tightens as you go.
 */
function seedGap(depth: number) {
  const tight = Math.min(1, depth / 300)
  const base = 10 - tight * 4
  return Math.max(4, Math.round(base * (0.75 + Math.random() * 0.5)))
}

function centerOf(v: number) {
  return Math.floor(v) + 0.5
}

function atCenter(v: number) {
  return Math.abs(v - centerOf(v)) < 0.02
}

function distToNextCenter(p: number, delta: number) {
  if (delta > 0) return Math.max(CENTER_EPS, Math.floor(p + 0.5) + 0.5 - p)
  if (delta < 0) return Math.max(CENTER_EPS, p - (Math.ceil(p - 0.5) - 0.5))
  return 1
}

function tileOpen(state: GameState, x: number, y: number) {
  if (y < 0 || y >= state.rows || x < 0 || x >= state.cols) return false
  return state.open[y][x]
}

/**
 * Neighbour tile in `dir`. Sides wrap the way Pellets' tunnels do; top and
 * bottom never do — the strip has real ends.
 */
function stepTile(state: GameState, x: number, y: number, dir: Dir) {
  const v = VEC[dir]
  let nx = x + v.x
  const ny = y + v.y
  if (ny < 0 || ny >= state.rows) return null
  if (nx < 0 || nx >= state.cols) nx = (nx + state.cols) % state.cols
  if (!tileOpen(state, nx, ny)) return null
  return { x: nx, y: ny }
}

/** Breadth-first distance field from `target`; chasers walk downhill on it. */
function distanceField(state: GameState, target: Cell) {
  const { cols, rows } = state
  const field = new Int32Array(cols * rows).fill(-1)
  const start = nearestOpen(state, target)
  if (!start) return field
  const queue = new Int32Array(cols * rows)
  let head = 0
  let tail = 0
  const startIdx = start.y * cols + start.x
  field[startIdx] = 0
  queue[tail++] = startIdx

  while (head < tail) {
    const idx = queue[head++]
    const x = idx % cols
    const y = (idx - x) / cols
    const d = field[idx]
    for (const dir of DIRS) {
      const next = stepTile(state, x, y, dir)
      if (!next) continue
      const nIdx = next.y * cols + next.x
      if (field[nIdx] !== -1) continue
      field[nIdx] = d + 1
      queue[tail++] = nIdx
    }
  }
  return field
}

function nearestOpen(state: GameState, cell: Cell): Cell | null {
  const cx = Math.max(0, Math.min(state.cols - 1, Math.round(cell.x)))
  const cy = Math.max(0, Math.min(state.rows - 1, Math.round(cell.y)))
  if (tileOpen(state, cx, cy)) return { x: cx, y: cy }
  const span = Math.max(state.cols, state.rows)
  for (let r = 1; r < span; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = cx + dx
        const y = cy + dy
        if (tileOpen(state, x, y)) return { x, y }
      }
    }
  }
  return null
}

/**
 * Scatter corners sit outside the strip so a scattering chaser never "arrives"
 * and ping-pongs on a tile — it keeps pathing at the corner and laps instead.
 */
function cornerFor(kind: GhostKind, cols: number, rows: number): Cell {
  if (kind === 'blink') return { x: cols + 3, y: -3 }
  if (kind === 'pink') return { x: -3, y: -3 }
  // The herder laps toward the middle of the way out, not a corner, because
  // sitting in the middle of the climb is the whole of what it does.
  if (kind === 'herd') return { x: Math.floor(cols / 2), y: -3 }
  if (kind === 'inky') return { x: cols + 3, y: rows + 3 }
  return { x: -3, y: rows + 3 }
}

// —— Generation ————————————————————————————————————————————————

/** Next world row from the generator, filling the band queue as needed. */
function pullRow(state: GameState): GenRow {
  while (!state.genQueue.length) {
    const band =
      state.genRow === 0
        ? makeOpeningBand(state.cols)
        : makeBand(state.seed, state.genRow, state.cols, state.depth)
    state.genQueue.push(...band)
    state.genRow += band.length
  }
  return state.genQueue.shift() as GenRow
}

function fillBuffer(state: GameState) {
  state.open = new Array(state.rows)
  state.crumbs = new Array(state.rows)
  state.power = new Array(state.rows)
  state.kind = new Array(state.rows)
  // Bottom row is world row 0, so fill upward and the queue order lines up.
  for (let y = state.rows - 1; y >= 0; y--) {
    const row = pullRow(state)
    state.open[y] = row.open
    state.crumbs[y] = row.crumbs
    state.power[y] = row.power
    state.kind[y] = row.kind
  }
}

/**
 * The order sleepers are laid down in, and so the order they are met.
 *
 * It used to be indexed by `nextGhostId`, which starts at 1, so the run opened
 * on pink and inky — and inky's whole trick is a vector drawn from blink, who
 * did not arrive until the fourth slot. With no blink awake it falls back to
 * aiming two tiles ahead, which is pinky's four tiles with a shorter arm. The
 * first two chasers of every run were near enough the same thing.
 *
 * Blink leads now: the one that simply comes straight at you is the one worth
 * learning first, and by the time inky arrives there is a blink to draw from.
 */
const GHOST_ORDER: GhostKind[] = ['blink', 'pink', 'herd', 'inky', 'clyde']

/**
 * Lay a sleeping chaser on a freshly built row.
 *
 * This is the whole answer to chasers arriving out of nowhere: they go onto
 * the board while the row is still above the view, so by the time one matters
 * you have been looking at it for a dozen rows and have had every chance to
 * pick a different corridor.
 */
function seedGhost(state: GameState, y: number): boolean {
  if (state.kind[y] !== 'lane') return false
  if (state.ghosts.length >= wantGhosts(state.depth)) return false
  const spots: number[] = []
  for (let x = 0; x < state.cols; x++) if (state.open[y][x]) spots.push(x)
  if (!spots.length) return false

  /*
   * Sleepers guard the crumbs.
   *
   * Bare corridors were a pure tax without this: bots that only ever climbed
   * through crumbed gaps outscored the ones that took the nearest way up more
   * than three to one, and outlived them too, so there was no choice being
   * made — just a worse option and a better one. The band above this lane is
   * still in the queue, so we can see which of its corridors keep their crumbs
   * and put the sleeper under one. Now the route that holds your streak is the
   * route with something waiting on it, and the bare one is what you take when
   * you would rather be alive than on a run.
   */
  const above = state.genQueue[0]
  const guarded =
    above && above.kind === 'wall'
      ? spots.filter((x) => above.open[x] && above.crumbs[x])
      : []
  const pool = guarded.length && Math.random() < 0.72 ? guarded : spots

  const kind = GHOST_ORDER[(state.nextGhostId - 1) % GHOST_ORDER.length]
  state.ghosts.push({
    id: state.nextGhostId++,
    kind,
    x: pool[Math.floor(Math.random() * pool.length)] + 0.5,
    y: y + 0.5,
    dir: 'down',
    mode: 'asleep',
    corner: cornerFor(kind, state.cols, state.rows),
    bob: Math.random() * Math.PI * 2,
    hit: 0,
    arrive: 0,
  })
  return true
}

/**
 * Offer a fruit, if there is somewhere worth putting one.
 *
 * It goes a few rows up and deliberately off your column: a prize on your
 * current line is not a decision, it is a pickup. Everything about it — the
 * distance, the countdown, the tide underneath — is there to make you weigh
 * the detour rather than take it for free.
 */
function placeFruit(state: GameState): boolean {
  const playerY = Math.floor(state.player.y)
  const playerX = Math.floor(state.player.x)
  const tier = Math.min(FRUIT_VALUES.length - 1, Math.floor(state.depth / 60))

  for (let up = FRUIT_ROWS_AHEAD[0]; up <= FRUIT_ROWS_AHEAD[1]; up++) {
    const y = playerY - up
    if (y < 1 || y >= state.rows) continue
    if (state.kind[y] !== 'lane') continue
    const spots: number[] = []
    for (let x = 0; x < state.cols; x++) {
      if (!state.open[y][x] || state.power[y][x]) continue
      // Wrap-aware: the far side of the board is not actually far away.
      const gap = Math.abs(x - playerX)
      if (Math.min(gap, state.cols - gap) < FRUIT_MIN_OFFSET) continue
      spots.push(x)
    }
    if (!spots.length) continue
    state.fruit = {
      x: spots[Math.floor(Math.random() * spots.length)] + 0.5,
      y: y + 0.5,
      life: FRUIT_LIFE,
      maxLife: FRUIT_LIFE,
      value: FRUIT_VALUES[tier],
      tier,
    }
    return true
  }
  return false
}

function fruitGap() {
  return FRUIT_GAP_MIN + Math.random() * (FRUIT_GAP_MAX - FRUIT_GAP_MIN)
}

/**
 * Slide the world down one row: a fresh row at the top, the bottom one gone,
 * and everything standing on the board moves down with it.
 */
function shiftDown(state: GameState) {
  const row = pullRow(state)
  state.open.pop()
  state.crumbs.pop()
  state.power.pop()
  state.kind.pop()
  state.open.unshift(row.open)
  state.crumbs.unshift(row.crumbs)
  state.power.unshift(row.power)
  state.kind.unshift(row.kind)
  state.originRow += 1

  state.player.y += 1
  state.lastTile = { x: state.lastTile.x, y: state.lastTile.y + 1 }
  for (const ghost of state.ghosts) ghost.y += 1
  for (const dot of state.trail) dot.y += 1
  for (const pop of state.pops) pop.y += 1
  if (state.fruit) state.fruit.y += 1

  /*
   * Only move the schedule on when one actually lands. A row at the cap, or a
   * wall row with nowhere to stand, should leave the next one still due rather
   * than skipping a whole interval — and because the cap only ever frees one
   * slot at a time, a backlog can't discharge as a burst.
   */
  if (row.row >= state.nextSeedRow && seedGhost(state, 0)) {
    state.nextSeedRow = row.row + seedGap(state.depth)
  }
}

/** Lowest lane row at or above `fromY` — somewhere you can actually stand. */
function laneRowNear(state: GameState, fromY: number): number {
  const lowest = Math.max(1, Math.min(state.rows - 2, Math.floor(fromY)))
  for (let y = lowest; y >= 1; y--) if (state.kind[y] === 'lane') return y
  for (let y = lowest + 1; y < state.rows - 1; y++) {
    if (state.kind[y] === 'lane') return y
  }
  return lowest
}

// —— Lifecycle ————————————————————————————————————————————————

function emptyState(view: { cols: number; rows: number }): GameState {
  const state: GameState = {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    lives: START_LIVES,
    cols: view.cols,
    rows: view.rows,
    open: [],
    crumbs: [],
    power: [],
    kind: [],
    originRow: 0,
    genRow: 0,
    nextSeedRow: 0,
    genQueue: [],
    seed: (Math.random() * 0xffffffff) >>> 0,
    camera: BELOW_VIEW,
    tide: BELOW_VIEW - TIDE_REST_GAP,
    stall: 0,
    baseRow: BELOW_VIEW,
    depth: 0,
    player: { x: 0, y: 0, dir: 'up', pending: null, pendingAge: 0 },
    ghosts: [],
    nextGhostId: 1,
    fright: 0,
    frightEaten: 0,
    ghostsEaten: 0,
    mode: 'scatter',
    modeTimer: scatterTime(0),
    surge: 0,
    surgeTime: 0,
    surgeHits: 0,
    crumbStreak: 0,
    crumbStreakBest: 0,
    fruit: null,
    fruitTimer: FRUIT_GAP_MIN,
    lastTile: { x: 0, y: 0 },
    trail: [],
    pops: [],
    deathAnim: 0,
    cause: null,
    invuln: 0,
    mouth: 0,
    time: 0,
  }
  fillBuffer(state)
  /*
   * Start where the camera will keep you rather than down on the bottom edge.
   * Opening against the edge meant the tide's proximity warning fired on frame
   * one of every run, before anything had happened — and it made the first
   * screen the only one in the game with no maze above it.
   */
  placePlayer(state, bufferRowOf(state, state.camera) - followGap(state))
  state.baseRow = worldRowAt(state, Math.floor(state.player.y))
  /*
   * Sleepers already up the board, so the opening screen says what kind of game
   * this is before the first row has even scrolled.
   *
   * The scan used to start a full wake range plus three above the player, which
   * on a 22-row buffer with the player at row 9 left exactly one row to look
   * at — so the opening laid nought or one chaser however high the cap went.
   * Starting four rows up gives it the lanes it needs. The nearer ones stir
   * almost at once, which is the point: they are still several rows ahead and
   * in plain sight, not on top of you.
   */
  const playerY = Math.floor(state.player.y)
  for (let y = playerY - 4; y >= 1; y--) {
    if (state.ghosts.length >= wantGhosts(0)) break
    seedGhost(state, y)
  }
  state.nextSeedRow = worldRowAt(state, 0) + seedGap(0)
  return state
}

function placePlayer(state: GameState, aroundY: number) {
  const y = laneRowNear(state, aroundY)
  const x = Math.floor(state.cols / 2)
  state.player = {
    x: x + 0.5,
    y: y + 0.5,
    dir: 'up',
    pending: null,
    pendingAge: 0,
  }
  state.lastTile = { x, y }
  state.trail = []
}

export function createInitialState(view = crumbtrailViewport()): GameState {
  return emptyState(view)
}

export function startGame(prev: GameState, view = crumbtrailViewport()): GameState {
  const next = emptyState(view)
  next.best = Math.max(prev.best, loadBest())
  next.phase = 'playing'
  next.invuln = RESPAWN_INVULN
  return next
}

/** Admin/testing: skip up the board without crediting the distance. */
export function jumpToDepth(state: GameState, depth: number): GameState {
  if (state.phase !== 'playing') return state
  const target = Math.max(0, Math.floor(depth) || 0)
  const next: GameState = { ...state, ghosts: [], player: { ...state.player } }
  let guard = 0
  while (next.depth < target && guard++ < 4000) {
    shiftDown(next)
    next.camera += 1
    next.depth += 1
  }
  placePlayer(next, bufferRowOf(next, next.camera) - followGap(next))
  next.baseRow = worldRowAt(next, Math.floor(next.player.y)) - next.depth
  next.tide = next.camera - TIDE_REST_GAP
  next.stall = 0
  next.ghosts = []
  next.invuln = RESPAWN_INVULN
  return next
}

export function queueDir(state: GameState, dir: Dir): GameState {
  if (state.phase !== 'playing') return state
  return { ...state, player: { ...state.player, pending: dir, pendingAge: 0 } }
}

export function surgeReady(state: GameState) {
  return state.phase === 'playing' && state.surgeTime <= 0 && state.surge >= 1
}

export function triggerSurge(state: GameState): GameState {
  if (!surgeReady(state)) return state
  sfx('whoosh')
  haptic('boost')
  return { ...state, surge: 0, surgeTime: SURGE_TIME, surgeHits: 0 }
}

// —— Chasers ——————————————————————————————————————————————————

function targetFor(state: GameState, ghost: Ghost): Cell {
  if (ghost.mode === 'eaten') return { x: Math.floor(ghost.x), y: -4 }
  if (ghost.mode === 'scatter') return ghost.corner

  const px = Math.floor(state.player.x)
  const py = Math.floor(state.player.y)
  const v = VEC[state.player.dir]
  if (ghost.kind === 'blink') return { x: px, y: py }
  if (ghost.kind === 'pink') return { x: px + v.x * 4, y: py + v.y * 4 }
  if (ghost.kind === 'herd') return { x: px, y: py - HERD_LEAD }
  if (ghost.kind === 'inky') {
    const blink = state.ghosts.find((g) => g.kind === 'blink' && g.mode !== 'asleep')
    const ax = px + v.x * 2
    const ay = py + v.y * 2
    if (!blink) return { x: ax, y: ay }
    return { x: ax * 2 - Math.floor(blink.x), y: ay * 2 - Math.floor(blink.y) }
  }
  // Clyde keeps his distance — shy once he's within eight tiles.
  if (dist2(ghost.x, ghost.y, state.player.x, state.player.y) < 64) return ghost.corner
  return { x: px, y: py }
}

type FieldCache = Map<string, Int32Array>

function fieldFor(state: GameState, cache: FieldCache, target: Cell) {
  const key = `${Math.round(target.x)}:${Math.round(target.y)}`
  const hit = cache.get(key)
  if (hit) return hit
  const field = distanceField(state, target)
  cache.set(key, field)
  return field
}

function chooseGhostDir(state: GameState, ghost: Ghost, cache: FieldCache): Dir {
  const gx = Math.floor(ghost.x)
  const gy = Math.floor(ghost.y)
  const cell = targetFor(state, ghost)

  const options: { dir: Dir; tile: Cell }[] = []
  for (const dir of DIRS) {
    const next = stepTile(state, gx, gy, dir)
    if (!next) continue
    options.push({ dir, tile: next })
  }
  if (!options.length) return ghost.dir

  const canReverse =
    ghost.mode === 'frightened' || ghost.mode === 'eaten' || options.length === 1
  const forward = canReverse
    ? options
    : options.filter((o) => o.dir !== OPPOSITE[ghost.dir])
  let pool = forward.length ? forward : options

  if (ghost.mode === 'frightened') {
    return pool[Math.floor(Math.random() * pool.length)].dir
  }

  const offBoard =
    cell.x < 0 || cell.y < 0 || cell.x >= state.cols || cell.y >= state.rows
  if (ghost.mode === 'scatter' || ghost.mode === 'eaten' || offBoard) {
    const PRIORITY: Dir[] = ['up', 'left', 'down', 'right']
    let best = pool[0]
    let bestD = Infinity
    let bestPri = 99
    for (const option of pool) {
      const d = (option.tile.x + 0.5 - cell.x) ** 2 + (option.tile.y + 0.5 - cell.y) ** 2
      const pri = PRIORITY.indexOf(option.dir)
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) < 1e-9 && pri >= 0 && pri < bestPri)) {
        bestD = d
        bestPri = pri
        best = option
      }
    }
    return best.dir
  }

  const field = fieldFor(state, cache, cell)
  const scoreOf = (option: { dir: Dir; tile: Cell }) => {
    const d = field[option.tile.y * state.cols + option.tile.x]
    return d < 0 ? Infinity : d
  }

  if (!canReverse) {
    const reverse = options.find((o) => o.dir === OPPOSITE[ghost.dir])
    if (reverse) {
      const bestForward = Math.min(...pool.map(scoreOf))
      if (scoreOf(reverse) < bestForward) pool = [reverse, ...pool]
    }
  }

  const PRIORITY: Dir[] = ['up', 'left', 'down', 'right']
  let best = pool[0]
  let bestD = Infinity
  let bestPri = 99
  for (const option of pool) {
    const score = scoreOf(option)
    const pri = PRIORITY.indexOf(option.dir)
    if (score < bestD || (score === bestD && pri >= 0 && pri < bestPri)) {
      bestD = score
      bestPri = pri
      best = option
    }
  }
  if (bestD === Infinity) {
    return pool[Math.floor(Math.random() * pool.length)].dir
  }
  return best.dir
}

function advance(actor: { x: number; y: number }, dir: Dir, step: number) {
  const v = VEC[dir]
  actor.x += v.x * step
  actor.y += v.y * step
}

/**
 * Keep x on the torus, in [0, cols).
 *
 * Pellets stages a wrapping actor just off the board at x = -0.5 and relies on
 * the very next step inside the same frame to carry it back on. If the frame's
 * travel budget happens to run out on that staging tile the actor is parked at
 * a column index of -1, where every step up or down resolves to nothing and it
 * can never move again. Since the columns genuinely wrap, -0.5 and cols - 0.5
 * are the same point, so normalising into range costs nothing and the parked
 * state stops existing.
 */
function normalizeX(state: GameState, actor: { x: number }) {
  const span = state.cols
  if (actor.x < 0 || actor.x >= span) {
    actor.x = ((actor.x % span) + span) % span
  }
}

function moveGhost(
  state: GameState,
  ghost: Ghost,
  speed: number,
  dt: number,
  cache: FieldCache,
) {
  let left = speed * dt
  let guard = 0
  while (left > CENTER_EPS && guard++ < 12) {
    if (atCenter(ghost.x) && atCenter(ghost.y)) {
      ghost.x = centerOf(ghost.x)
      ghost.y = centerOf(ghost.y)
      ghost.dir = chooseGhostDir(state, ghost, cache)
      const gx = Math.floor(ghost.x)
      const gy = Math.floor(ghost.y)
      let ahead = stepTile(state, gx, gy, ghost.dir)
      if (!ahead) {
        for (const dir of DIRS) {
          const next = stepTile(state, gx, gy, dir)
          if (!next) continue
          ghost.dir = dir
          ahead = next
          break
        }
        if (!ahead) break
      }
    }
    const v = VEC[ghost.dir]
    const dist = v.x !== 0 ? distToNextCenter(ghost.x, v.x) : distToNextCenter(ghost.y, v.y)
    const step = Math.min(left, dist)
    advance(ghost, ghost.dir, step)
    normalizeX(state, ghost)
    left -= step
  }
}

// —— Player ———————————————————————————————————————————————————

function canStepFrom(state: GameState, x: number, y: number, dir: Dir) {
  return stepTile(state, x, y, dir) !== null
}

function movePlayer(state: GameState, speed: number, dt: number) {
  const p = state.player
  let left = speed * dt
  let guard = 0

  while (left > CENTER_EPS && guard++ < 12) {
    if (p.pending === p.dir) p.pending = null
    if (p.pending && p.pending === OPPOSITE[p.dir]) {
      p.dir = p.pending
      p.pending = null
    }

    const tileX = Math.floor(p.x)
    const tileY = Math.floor(p.y)
    const onBoard = tileX >= 0 && tileY >= 0 && tileX < state.cols && tileY < state.rows

    // Late turn: you just cleared the junction, so still take it.
    if (onBoard && p.pending && canStepFrom(state, tileX, tileY, p.pending)) {
      const along = VEC[p.dir].x !== 0 ? p.x : p.y
      const past = (along - centerOf(along)) * (VEC[p.dir].x + VEC[p.dir].y)
      if (past > 0 && past <= LATE_TURN) {
        p.x = tileX + 0.5
        p.y = tileY + 0.5
        p.dir = p.pending
        p.pending = null
        continue
      }
    }

    if (atCenter(p.x) && atCenter(p.y)) {
      p.x = centerOf(p.x)
      p.y = centerOf(p.y)
      if (p.pending && canStepFrom(state, Math.floor(p.x), Math.floor(p.y), p.pending)) {
        p.dir = p.pending
        p.pending = null
      }
      if (!stepTile(state, Math.floor(p.x), Math.floor(p.y), p.dir)) break
    }

    const v = VEC[p.dir]
    const dist = v.x !== 0 ? distToNextCenter(p.x, v.x) : distToNextCenter(p.y, v.y)
    const step = Math.min(left, dist)
    advance(p, p.dir, step)
    normalizeX(state, p)
    left -= step
  }
}

function addPop(state: GameState, x: number, y: number, text: string) {
  state.pops.push({ x, y, life: 0.9, text })
  if (state.pops.length > 12) state.pops.shift()
}

/** A fruit sitting here is not cleared ground, so it must not break a streak. */
function fruitAt(state: GameState, x: number, y: number) {
  const fruit = state.fruit
  if (!fruit) return false
  return Math.floor(fruit.x) === x && Math.floor(fruit.y) === y
}

function eatAt(state: GameState) {
  const x = Math.floor(state.player.x)
  const y = Math.floor(state.player.y)
  if (y < 0 || y >= state.rows || x < 0 || x >= state.cols) return
  if (state.lastTile.x === x && state.lastTile.y === y) return
  state.lastTile = { x, y }

  if (state.crumbs[y][x]) {
    state.crumbs[y][x] = false
    state.crumbStreak += 1
    if (state.crumbStreak > state.crumbStreakBest) {
      state.crumbStreakBest = state.crumbStreak
    }
    const mult = streakMult(state.crumbStreak) * (state.surgeTime > 0 ? 2 : 1)
    state.score += SCORE_CRUMB * mult
    if (state.surgeTime <= 0) state.surge = Math.min(1, state.surge + 1 / SURGE_CRUMBS)
    sfx('eat', Math.min(5, Math.floor(state.crumbStreak / 8)))

    // Every hundredth fresh crumb scatters the board.
    if (state.crumbStreak % STREAK_LANDMARK === 0) {
      state.score += SCORE_LANDMARK
      state.fright = FRIGHT_TIME
      state.frightEaten = 0
      addPop(state, x + 0.5, y + 0.5, `${state.crumbStreak} IN A ROW!`)
      sfx('wave')
      haptic('boost')
    }
  } else if (!state.power[y][x] && !fruitAt(state, x, y)) {
    /*
     * Crumbless ground breaks the streak. That covers tiles you have already
     * picked clean, the way Pellets does, and now also the corridors the maze
     * generates bare — which is what makes a bare route a real cost rather
     * than just a plain-looking one.
     */
    state.crumbStreak = 0
  }

  if (state.power[y][x]) {
    state.power[y][x] = false
    state.score += SCORE_POWER
    state.surge = Math.min(1, state.surge + 0.15)
    state.fright = FRIGHT_TIME
    state.frightEaten = 0
    for (const ghost of state.ghosts) {
      if (ghost.mode === 'eaten' || ghost.mode === 'asleep') continue
      ghost.mode = 'frightened'
      ghost.dir = OPPOSITE[ghost.dir]
    }
    sfx('wave')
  }
}

function loseLife(state: GameState, cause: DeathCause) {
  state.phase = 'dying'
  state.deathAnim = DEATH_TIME
  state.cause = cause
  state.crumbStreak = 0
  state.lives -= 1
  sfx('hurt')
  haptic('crash')
}

// —— Tick —————————————————————————————————————————————————————

export function tick(state: GameState, dt: number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover') {
    return { ...state, time: state.time + dt }
  }

  const next: GameState = {
    ...state,
    ghosts: state.ghosts.map((g) => ({ ...g })),
    player: { ...state.player },
    trail: state.trail.map((d) => ({ ...d, life: d.life - dt * 2.6 })).filter((d) => d.life > 0),
    pops: state.pops.map((p) => ({ ...p, life: p.life - dt })).filter((p) => p.life > 0),
    time: state.time + dt,
    mouth: state.mouth + dt * 13,
    invuln: Math.max(0, state.invuln - dt),
  }

  if (next.phase === 'dying') {
    next.deathAnim -= dt
    if (next.deathAnim <= 0) {
      next.phase = 'gameover'
      next.deathAnim = 0
    }
    return next
  }

  // —— you ——
  if (next.player.pending) {
    next.player.pendingAge += dt
    if (next.player.pendingAge > PENDING_TTL) {
      next.player.pending = null
      next.player.pendingAge = 0
    }
  }
  const surging = next.surgeTime > 0
  movePlayer(next, PLAYER_SPEED * (surging ? SURGE_SPEED : 1), dt)
  eatAt(next)

  const climbed = worldRowAt(next, Math.floor(next.player.y)) - next.baseRow
  if (climbed > next.depth) {
    next.score += (climbed - next.depth) * SCORE_ROW
    next.depth = climbed
    next.stall = 0
  } else {
    next.stall += dt
  }

  // —— the camera follows, it never leads ——
  const want = worldRowAt(next, next.player.y - 0.5) - followGap(next)
  if (want > next.camera) next.camera = want
  let shifts = 0
  while (Math.floor(next.camera) - BELOW_VIEW > next.originRow && shifts++ < 16) {
    shiftDown(next)
  }

  // —— the tide answers standing still ——
  const rest = next.camera - TIDE_REST_GAP
  const rise = tideSpeed(next)
  if (rise > 0) next.tide += rise * dt
  else next.tide = Math.max(rest, next.tide - TIDE_EBB * dt)

  if (next.invuln <= 0 && worldRowAt(next, next.player.y - 0.5) <= next.tide + 0.3) {
    loseLife(next, 'drowned')
    return next
  }

  // —— the offer ——
  if (next.fruit) {
    next.fruit = { ...next.fruit, life: next.fruit.life - dt }
    const tideY = bufferRowOf(next, next.tide)
    if (next.fruit.life <= 0 || next.fruit.y > tideY) {
      next.fruit = null
      next.fruitTimer = fruitGap()
    } else if (dist2(next.fruit.x, next.fruit.y, next.player.x, next.player.y) <= 0.45 * 0.45) {
      next.score += next.fruit.value
      addPop(next, next.fruit.x, next.fruit.y, `+${next.fruit.value}`)
      sfx('good')
      next.fruit = null
      next.fruitTimer = fruitGap()
    }
  } else {
    next.fruitTimer -= dt
    if (next.fruitTimer <= 0) {
      if (placeFruit(next)) sfx('wave')
      else next.fruitTimer = 1.5
    }
  }

  // —— chase / scatter ——
  if (next.fright > 0) {
    next.fright = Math.max(0, next.fright - dt)
    if (next.fright === 0) {
      for (const ghost of next.ghosts) {
        if (ghost.mode === 'frightened') ghost.mode = next.mode
      }
    }
  } else {
    next.modeTimer -= dt
    if (next.modeTimer <= 0) {
      next.mode = next.mode === 'chase' ? 'scatter' : 'chase'
      next.modeTimer = next.mode === 'chase' ? chaseTime(next.depth) : scatterTime(next.depth)
      for (const ghost of next.ghosts) {
        if (ghost.mode === 'chase' || ghost.mode === 'scatter') {
          ghost.mode = next.mode
          ghost.dir = OPPOSITE[ghost.dir]
        }
      }
    }
  }

  // —— chasers ——
  const cache: FieldCache = new Map()
  for (const ghost of next.ghosts) {
    ghost.bob += dt * 4
    ghost.hit = Math.max(0, ghost.hit - dt * 3)

    if (ghost.mode === 'asleep') {
      // Stirs once you are within reach of it, or already past it.
      if (next.player.y - ghost.y <= WAKE_RANGE) {
        ghost.mode = next.mode
        ghost.arrive = 0
      }
      continue
    }

    ghost.arrive = Math.min(1, ghost.arrive + dt * 2)
    const speed =
      ghost.mode === 'eaten'
        ? EATEN_SPEED
        : ghost.mode === 'frightened'
          ? FRIGHT_SPEED * frightSpeedScale(next.depth)
          : GHOST_SPEED * chaserSpeedScale(next.depth)
    moveGhost(next, ghost, speed, dt, cache)
  }
  // Eyes that made it out the top, and anything the tide took, are gone.
  const tideY = bufferRowOf(next, next.tide)
  next.ghosts = next.ghosts.filter((g) => {
    if (g.mode === 'eaten' && g.y < 0.6) return false
    return g.y < tideY + 0.5
  })

  // —— contact ——
  for (const ghost of next.ghosts) {
    if (ghost.mode === 'eaten' || ghost.mode === 'asleep') continue
    if (dist2(ghost.x, ghost.y, next.player.x, next.player.y) > 0.42 * 0.42) continue

    if (ghost.mode === 'frightened') {
      const bonus = SCORE_GHOST[Math.min(next.frightEaten, SCORE_GHOST.length - 1)]
      next.frightEaten += 1
      next.ghostsEaten += 1
      ghost.mode = 'eaten'
      ghost.hit = 1
      next.score += bonus
      addPop(next, ghost.x, ghost.y, `+${bonus}`)
      sfx('good')
      haptic('hit')
      continue
    }

    if (surging) {
      const bonus = SCORE_SURGE[Math.min(next.surgeHits, SCORE_SURGE.length - 1)]
      next.surgeHits += 1
      ghost.mode = 'eaten'
      ghost.hit = 1
      next.score += bonus
      addPop(next, ghost.x, ghost.y, `+${bonus}`)
      sfx('good')
      continue
    }

    if (next.invuln > 0) continue

    loseLife(next, 'caught')
    return next
  }

  if (surging) {
    next.surgeTime = Math.max(0, next.surgeTime - dt)
    next.trail = [{ x: next.player.x, y: next.player.y, life: 1 }, ...next.trail].slice(0, 18)
  }

  return next
}

/** 0..1 — how awake the tide is, for the HUD and the warning glow. */
export function tidePressure(state: GameState): number {
  const gap = worldRowAt(state, state.player.y - 0.5) - state.tide
  const near = Math.max(0, Math.min(1, 1 - (gap - 1) / 5))
  const warn = Math.max(0, Math.min(1, (state.stall - STALL_LIMIT + 1.5) / 2))
  return Math.max(near, warn)
}

export function toSnapshot(state: GameState): Snapshot {
  return {
    phase: state.phase,
    score: state.score,
    best: Math.max(state.best, loadBest()),
    lives: Math.max(0, state.lives),
    depth: state.depth,
    surge: state.surge,
    surgeTime: state.surgeTime,
    crumbStreak: state.crumbStreak,
    crumbStreakBest: state.crumbStreakBest,
    ghostsEaten: state.ghostsEaten,
    tide: tidePressure(state),
    cause: state.cause,
  }
}
