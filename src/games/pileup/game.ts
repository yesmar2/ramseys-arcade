import { sfx } from '../../lib/sound'

/*
 * Pileup: blocks of four drop into a well ten wide and eighteen deep. Fill a
 * row from wall to wall and it clears; let the pile reach the top and the run
 * is over. Every ten rows the blocks fall faster.
 *
 * Its own twist is the Shake. Clearing rows charges it, and when it goes, every
 * block in the well drops straight down into whatever gap is under it: the
 * holes a hurried pile leaves are gone, and any row that comes out full clears.
 * The piece in play waits at the top while the pile settles.
 *
 * The grid counts rows from the top, row 0 first. The top HIDDEN rows sit above
 * the well, where a piece starts out; a pile that reaches them is finished.
 *
 * Only the order the pieces come in draws on Math.random, one shuffled set of
 * seven at a time, so a run replayed from a seed (the home page picks its still
 * that way) drops the same pieces. The sparks and tumbles draw on a generator
 * of their own.
 */

export const COLS = 10
export const ROWS = 18
export const HIDDEN = 2
export const TOTAL = ROWS + HIDDEN

/** Pieces, by number: the long one, the square, then T, S, Z, J and L. */
export type Kind = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const PIECE_I: Kind = 0
export const PIECE_O: Kind = 1
export const KIND_COUNT = 7

/** Rows to the next level. */
export const ROWS_PER_LEVEL = 10
/** Rows cleared to charge a Shake. */
export const SHAKE_ROWS = 12

/*
 * Points for one to four rows at once, times the level. A tenth of what games
 * like this usually pay, as Frenzy scales its own down: the level multiplies
 * everything, so the points compound, and a long run at the usual sizes would
 * pass the million a board takes. Dropping a piece pays nothing.
 */
export const ROW_POINTS = [0, 10, 30, 50, 80] as const
/** Each clear after the first in an unbroken run of clears, times the level. */
export const COMBO_POINTS = 5
/** A row a Shake clears, times the level. */
export const SHAKE_POINTS = 10
/** Four rows straight after four rows. */
export const BACK_TO_BACK = 1.5

/*
 * How long a piece can sit on the pile before it locks: half a second left
 * alone, and a move or a turn buys the half second back, twice. However it's
 * moved, a piece that has touched down locks within a second, unless it drops
 * to a row lower than it has been, which starts it all again. It was six times
 * and two seconds, and Ramsey still found it "too much" (2026-10-06): he
 * wanted a little grace, not a piece he could keep sliding about.
 */
const LOCK_DELAY = 0.5
const MAX_RESETS = 2
const GROUND_LIMIT = 1
/** The flash of a full row before it goes. */
export const CLEAR_TIME = 0.3
/** The well rattling before the pile drops, and how hard it drops, in rows a second a second. */
export const RATTLE_TIME = 0.26
export const SETTLE_PULL = 120
/** The pile tumbling out of the well before the run's card. */
export const TOPOUT_TIME = 1.5

/** Seconds a row at a level: steady to start, a fifth quicker each level. */
export function rowTime(level: number): number {
  return Math.max(0.02, 0.8 * Math.pow(0.8, level - 1))
}

/** Holding down drops twenty times quicker, and never slower than this. */
function softRowTime(level: number): number {
  return Math.min(rowTime(level) / 20, 0.035)
}

// ——————————————————————————————————————————————————————————— shapes

type Cell = readonly [number, number]

/**
 * Each piece as it first appears, in the box it turns in. A turn is a quarter
 * of the box about its middle, so the long one and the square sit in even
 * boxes and the rest in a box of three.
 */
const SPAWN: readonly { size: number; cells: readonly Cell[] }[] = [
  { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
]

/** SHAPES[kind][turn]: the cells, turned clockwise that many quarters. */
export const SHAPES: readonly (readonly (readonly Cell[])[])[] = SPAWN.map(({ size, cells }) => {
  const turns: Cell[][] = [cells.map(([x, y]) => [x, y] as const)]
  for (let r = 1; r < 4; r++) {
    turns.push(turns[r - 1]!.map(([x, y]) => [size - 1 - y, x] as const))
  }
  return turns
})

export const BOX_SIZE: readonly number[] = SPAWN.map((p) => p.size)

/** BOTTOM[kind][turn]: the lowest of its cells in its box, so a turn isn't mistaken for a drop. */
const BOTTOM: readonly (readonly number[])[] = SHAPES.map((turns) => turns.map((cells) => Math.max(...cells.map(([, y]) => y))))

/** The row the piece's lowest block is in. */
function bottomRow(p: Piece): number {
  return p.y + BOTTOM[p.kind]![p.rot]!
}

/**
 * Where a turn tries the piece when it doesn't fit where it is: one step to a
 * side, up a row, down two. Each list is tried in order and the first that fits
 * wins, so a piece against a wall or tucked under a ledge still turns. Written
 * with up as positive, as these tables usually are; `rotate` flips it.
 */
const KICKS: Record<string, readonly Cell[]> = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
}

/** The long piece reaches further: it has more to clear. */
const LONG_KICKS: Record<string, readonly Cell[]> = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
}

/** Where a piece's box starts, across: the middle of the well. */
function spawnX(kind: Kind) {
  return kind === PIECE_O ? 4 : 3
}

// ——————————————————————————————————————————————————————————— state

export type Phase = 'menu' | 'playing' | 'topout' | 'gameover'

export type Piece = {
  kind: Kind
  /** Quarter turns clockwise from how it came in. */
  rot: number
  /** The box's top left, in cells. */
  x: number
  y: number
}

export type FloaterTone = 'rows' | 'big' | 'combo' | 'level' | 'shake'

/** Words rising off the pile: what a clear paid, a level reached. */
export type Floater = {
  /** In cells across and rows down. */
  x: number
  y: number
  text: string
  sub?: string
  tone: FloaterTone
  life: number
}

/** A spark off a cleared row, or a puff where a piece slams down: cells and cells a second. */
export type Bit = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  kind: Kind
  size: number
}

/** A block of the pile on its way down in a Shake, from row `from` to row `to`. */
export type Fall = {
  x: number
  from: number
  to: number
  kind: Kind
}

/** A hard drop's streak: the columns it fell down and how far. */
export type Trail = {
  cells: { x: number; top: number; bottom: number }[]
  kind: Kind
  life: number
}

export type GameState = {
  phase: Phase
  /** Each cell's piece, kind + 1, 0 when empty. */
  grid: Uint8Array
  /** Which piece each block came from, so a piece can be drawn as one shape. */
  ids: Int32Array
  nextId: number
  piece: Piece | null
  /** The pieces to come, a shuffled set of seven at a time. */
  queue: Kind[]
  hold: Kind | null
  /** Held already this piece: one swap a piece. */
  held: boolean
  /** The piece a Shake sent back up, to come in again once the pile has settled. */
  waiting: Kind | null
  score: number
  rows: number
  level: number
  /** Clears in a row, piece after piece; 0 once a piece lands without one. */
  combo: number
  bestCombo: number
  /** The last clear was four rows. */
  backToBack: boolean
  fours: number
  shakes: number
  /** The most rows one Shake has cleared this run. */
  bestShake: number
  /** Rows toward the next Shake. */
  charge: number
  shakeReady: boolean
  /** Seconds toward the next row down. */
  fall: number
  softDrop: boolean
  /** Seconds sitting on the pile since the last move that bought time, toward locking. */
  lockT: number
  resets: number
  /**
   * Seconds since the piece first touched down at its lowest row, lifted by a
   * turn or not: no amount of turning keeps it loose past GROUND_LIMIT.
   */
  groundT: number
  touched: boolean
  /** The lowest row the piece's foot has reached, so reaching lower gives back its moves. */
  lowest: number
  /** Full rows flashing before they go; from a Shake, they pay as one. */
  clearing: { rows: number[]; t: number } | null
  /**
   * A Shake under way: the pile has its new places already, and these blocks
   * are still falling to them. `grid` and `ids` are the pile as it stood, for
   * the rattle before it drops.
   */
  settle: { t: number; falls: Fall[]; dur: number; grid: Uint8Array; ids: Int32Array } | null
  /** Pieces brought in so far, so a drag knows when the one under it has changed. */
  serial: number
  // Presentation only: nothing below changes what happens in a run.
  time: number
  overT: number
  floaters: Floater[]
  bits: Bit[]
  trails: Trail[]
  /** 0–1: the well's dip from a slam. */
  bump: number
  /** The piece just locked and when, for its flash. */
  locked: { id: number; t: number } | null
  lastTap: number
  /** The piece that wouldn't fit, at the end. */
  stuck: Piece | null
}

export type Snapshot = {
  phase: Phase
  score: number
  rows: number
  level: number
  combo: number
  bestCombo: number
  fours: number
  shakes: number
  bestShake: number
  /** 0–1 toward the next Shake. */
  charge: number
  shakeReady: boolean
  canHold: boolean
  serial: number
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    phase: s.phase,
    score: s.score,
    rows: s.rows,
    level: s.level,
    combo: s.combo,
    bestCombo: s.bestCombo,
    fours: s.fours,
    shakes: s.shakes,
    bestShake: s.bestShake,
    charge: s.shakeReady ? 1 : Math.min(1, s.charge / SHAKE_ROWS),
    shakeReady: s.shakeReady,
    canHold: s.phase === 'playing' && !s.held && s.piece !== null,
    serial: s.serial,
  }
}

/**
 * Randomness for the look alone, kept off Math.random: a run replayed from a
 * seed has to drop the same pieces in the same order, and every number the
 * sparks took from the shared stream would change every piece after.
 */
let fxSeed = 0x51ed27a3
export function fxRandom() {
  fxSeed = (fxSeed + 0x6d2b79f5) >>> 0
  let t = fxSeed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function shuffledSet(): Kind[] {
  const set: Kind[] = [0, 1, 2, 3, 4, 5, 6]
  for (let i = set.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = set[i]!
    set[i] = set[j]!
    set[j] = t
  }
  return set
}

/**
 * The well at the start card: two rows down but for a slot at the side, and
 * the long piece over it, so the card stands over something that looks like
 * the game. Laid by hand, not dealt, so it takes nothing from Math.random.
 */
const RESTING: readonly (readonly [Kind, readonly Cell[]])[] = [
  [1, [[0, 18], [1, 18], [0, 19], [1, 19]]],
  [0, [[2, 19], [3, 19], [4, 19], [5, 19]]],
  [5, [[6, 18], [6, 19], [7, 19], [8, 19]]],
  [2, [[3, 17], [2, 18], [3, 18], [4, 18]]],
  [3, [[4, 16], [4, 17], [5, 17], [5, 18]]],
  [5, [[8, 16], [8, 17], [8, 18], [7, 18]]],
]

function emptyState(): GameState {
  return {
    phase: 'menu',
    grid: new Uint8Array(COLS * TOTAL),
    ids: new Int32Array(COLS * TOTAL),
    nextId: 1,
    piece: null,
    queue: [],
    hold: null,
    held: false,
    waiting: null,
    score: 0,
    rows: 0,
    level: 1,
    combo: 0,
    bestCombo: 0,
    backToBack: false,
    fours: 0,
    shakes: 0,
    bestShake: 0,
    charge: 0,
    shakeReady: false,
    fall: 0,
    softDrop: false,
    lockT: 0,
    resets: 0,
    groundT: 0,
    touched: false,
    lowest: 0,
    clearing: null,
    settle: null,
    serial: 0,
    time: 0,
    overT: 0,
    floaters: [],
    bits: [],
    trails: [],
    bump: 0,
    locked: null,
    lastTap: 0,
    stuck: null,
  }
}

export function createInitialState(): GameState {
  const s = emptyState()
  for (const [kind, cells] of RESTING) {
    const id = s.nextId++
    for (const [x, y] of cells) {
      s.grid[y * COLS + x] = kind + 1
      s.ids[y * COLS + x] = id
    }
  }
  // The long one, standing on end over its slot.
  s.piece = { kind: PIECE_I, rot: 1, x: COLS - 3, y: 9 }
  return s
}

export function startGame(prev?: GameState): GameState {
  const s = emptyState()
  s.phase = 'playing'
  s.time = prev?.time ?? 0
  s.queue = [...shuffledSet(), ...shuffledSet()]
  spawn(s)
  return s
}

// ——————————————————————————————————————————————————————————— the well

function at(s: GameState, x: number, y: number) {
  return s.grid[y * COLS + x]!
}

/** Whether a piece could be here: inside the walls and the floor, on nothing. Above the top is open air. */
export function fits(s: GameState, kind: Kind, rot: number, x: number, y: number): boolean {
  for (const [cx, cy] of SHAPES[kind]![rot]!) {
    const gx = x + cx
    const gy = y + cy
    if (gx < 0 || gx >= COLS || gy >= TOTAL) return false
    if (gy >= 0 && at(s, gx, gy)) return false
  }
  return true
}

/** How far the piece would fall from here: the row its box would land at. */
export function landingY(s: GameState, p: Piece): number {
  let y = p.y
  while (fits(s, p.kind, p.rot, p.x, y + 1)) y++
  return y
}

function grounded(s: GameState): boolean {
  const p = s.piece
  return !!p && !fits(s, p.kind, p.rot, p.x, p.y + 1)
}

function fullRows(s: GameState): number[] {
  const rows: number[] = []
  for (let y = 0; y < TOTAL; y++) {
    let full = true
    for (let x = 0; x < COLS; x++) {
      if (!at(s, x, y)) {
        full = false
        break
      }
    }
    if (full) rows.push(y)
  }
  return rows
}

/** Take the rows out and let everything above come down by as many. */
function removeRows(s: GameState, rows: number[]) {
  const gone = new Set(rows)
  const grid = new Uint8Array(COLS * TOTAL)
  const ids = new Int32Array(COLS * TOTAL)
  let to = TOTAL - 1
  for (let y = TOTAL - 1; y >= 0; y--) {
    if (gone.has(y)) continue
    grid.set(s.grid.subarray(y * COLS, y * COLS + COLS), to * COLS)
    ids.set(s.ids.subarray(y * COLS, y * COLS + COLS), to * COLS)
    to--
  }
  s.grid = grid
  s.ids = ids
}

/** The highest row anything is in, TOTAL for an empty well. */
export function pileTop(s: GameState): number {
  for (let i = 0; i < s.grid.length; i++) if (s.grid[i]) return Math.floor(i / COLS)
  return TOTAL
}

// ——————————————————————————————————————————————————————————— pieces

function nextKind(s: GameState): Kind {
  if (s.queue.length <= KIND_COUNT) s.queue.push(...shuffledSet())
  return s.queue.shift()!
}

/** The next piece in at the top; if there's no room for it, the run is over. */
function spawn(s: GameState, kind: Kind = s.waiting ?? nextKind(s)) {
  s.waiting = null
  const p: Piece = { kind, rot: 0, x: spawnX(kind), y: HIDDEN }
  s.serial += 1
  s.fall = 0
  s.lockT = 0
  s.resets = 0
  s.groundT = 0
  s.touched = false
  // A pile up to the brim still lets a piece in higher, over the top and out of sight.
  for (let up = 0; up < HIDDEN && !fits(s, p.kind, p.rot, p.x, p.y); up++) p.y -= 1
  if (!fits(s, p.kind, p.rot, p.x, p.y)) {
    topOut(s, { ...p, y: HIDDEN })
    return
  }
  s.piece = p
  s.lowest = bottomRow(p)
}

function canAct(s: GameState): boolean {
  return s.phase === 'playing' && s.piece !== null && !s.clearing && !s.settle
}

/** A move or a turn on the pile buys the piece its half second back, twice. */
function afterShift(s: GameState) {
  if (s.lockT > 0 || grounded(s)) {
    if (s.resets < MAX_RESETS) {
      s.lockT = 0
      s.resets += 1
    }
  }
}

/** Slide the piece a column; false when something's in the way. */
export function move(s: GameState, dx: -1 | 1): boolean {
  const p = s.piece
  if (!canAct(s) || !p) return false
  if (!fits(s, p.kind, p.rot, p.x + dx, p.y)) return false
  p.x += dx
  afterShift(s)
  if (s.time - s.lastTap > 0.045) {
    s.lastTap = s.time
    sfx('tap')
  }
  return true
}

/** A quarter turn, clockwise for 1; it nudges the piece aside or up a row when it has to. */
export function rotate(s: GameState, dir: 1 | -1): boolean {
  const p = s.piece
  if (!canAct(s) || !p) return false
  if (p.kind === PIECE_O) {
    sfx('click', 1)
    return false
  }
  const to = (p.rot + dir + 4) % 4
  const table = (p.kind === PIECE_I ? LONG_KICKS : KICKS)[`${p.rot}${to}`]!
  for (const [kx, ky] of table) {
    if (fits(s, p.kind, to, p.x + kx, p.y - ky)) {
      p.x += kx
      p.y -= ky
      p.rot = to
      afterShift(s)
      reachedRow(s)
      sfx('click', 1)
      return true
    }
  }
  return false
}

/** Down by up to `rows`; how far it went. */
export function softDropBy(s: GameState, rows: number): number {
  const p = s.piece
  if (!canAct(s) || !p) return 0
  let went = 0
  while (went < rows && fits(s, p.kind, p.rot, p.x, p.y + 1)) {
    p.y += 1
    went += 1
  }
  if (went) {
    s.fall = 0
    reachedRow(s)
  }
  return went
}

/** Held down, the piece falls twenty times as fast. */
export function setSoftDrop(s: GameState, on: boolean) {
  s.softDrop = on
}

/** All the way down and locked at once. */
export function hardDrop(s: GameState): boolean {
  const p = s.piece
  if (!canAct(s) || !p) return false
  const to = landingY(s, p)
  const rows = to - p.y
  if (rows > 0) {
    // The streak it leaves, column by column, from where each column of the piece was to where it lands.
    const cols = new Map<number, { top: number; bottom: number }>()
    for (const [cx, cy] of SHAPES[p.kind]![p.rot]!) {
      const c = cols.get(cx)
      const top = p.y + cy
      const bottom = to + cy
      if (!c) cols.set(cx, { top, bottom })
      else {
        c.top = Math.min(c.top, top)
        c.bottom = Math.max(c.bottom, bottom)
      }
    }
    s.trails.push({
      cells: [...cols].map(([cx, c]) => ({ x: p.x + cx, top: c.top, bottom: c.bottom })),
      kind: p.kind,
      life: 1,
    })
    if (s.trails.length > 4) s.trails.shift()
  }
  p.y = to
  s.bump = Math.max(s.bump, Math.min(1, 0.45 + rows / 24))
  sfx('whoosh')
  // Dust off the foot of each column the piece landed on.
  for (const [cx, cy] of SHAPES[p.kind]![p.rot]!) {
    const below = cy + 1
    if (SHAPES[p.kind]![p.rot]!.some(([ox, oy]) => ox === cx && oy === below)) continue
    puff(s, p.x + cx + 0.5, to + cy + 1, p.kind, 3)
  }
  lock(s)
  return true
}

/** Put the piece aside and take the one set aside, or the next one; once a piece. */
export function holdPiece(s: GameState): boolean {
  const p = s.piece
  if (!canAct(s) || !p || s.held) return false
  const swap = s.hold
  s.hold = p.kind
  s.piece = null
  if (swap === null) spawn(s)
  else spawn(s, swap)
  s.held = true
  sfx('hop', 7)
  return true
}

/** The piece is down: into the pile, then any full rows go. */
function lock(s: GameState) {
  const p = s.piece!
  const id = s.nextId++
  let above = true
  for (const [cx, cy] of SHAPES[p.kind]![p.rot]!) {
    const gx = p.x + cx
    const gy = p.y + cy
    if (gy >= HIDDEN) above = false
    if (gy < 0) continue
    s.grid[gy * COLS + gx] = p.kind + 1
    s.ids[gy * COLS + gx] = id
  }
  s.piece = null
  s.held = false
  s.locked = { id, t: s.time }
  const full = fullRows(s)
  if (full.length) {
    payRows(s, full)
    s.clearing = { rows: full, t: 0 }
    return
  }
  s.combo = 0
  sfx('place')
  // A piece that came to rest wholly over the brim ends it, as one with no room to come in does.
  if (above) topOut(s, null)
  else spawn(s)
}

/** Lower than the piece has been: its time on the pile starts over. */
function reachedRow(s: GameState) {
  const p = s.piece
  if (p && bottomRow(p) > s.lowest) {
    s.lowest = bottomRow(p)
    s.resets = 0
    s.lockT = 0
    s.groundT = 0
    s.touched = false
  }
}

// ——————————————————————————————————————————————————————————— scoring

function floater(s: GameState, f: Omit<Floater, 'life'>) {
  s.floaters.push({ ...f, life: 1 })
  if (s.floaters.length > 6) s.floaters.shift()
}

function levelFor(rows: number) {
  return 1 + Math.floor(rows / ROWS_PER_LEVEL)
}

function addRows(s: GameState, n: number, mid: number) {
  s.rows += n
  const level = levelFor(s.rows)
  if (level > s.level) {
    s.level = level
    floater(s, { x: COLS / 2, y: mid - 1.4, text: `Level ${level}`, tone: 'level' })
    sfx('wave')
  }
}

const ROW_WORDS = ['', '', 'Double', 'Triple', 'Four!'] as const

/** What a clear of these rows pays, said over them; the rows go once their flash is done. */
function payRows(s: GameState, rows: number[]) {
  const n = rows.length
  const level = s.level
  const four = n >= 4
  let pts = ROW_POINTS[Math.min(4, n)]! * level
  let sub: string | undefined
  if (four && s.backToBack) {
    pts = Math.floor(pts * BACK_TO_BACK)
    sub = 'Back to back'
  }
  s.combo += 1
  s.bestCombo = Math.max(s.bestCombo, s.combo)
  if (s.combo >= 2) {
    pts += COMBO_POINTS * (s.combo - 1) * level
    sub = sub ?? `Combo ×${s.combo}`
  }
  s.backToBack = four
  if (four) s.fours += 1
  s.score += pts
  const mid = rows.reduce((a, b) => a + b, 0) / n
  floater(s, {
    x: COLS / 2,
    y: mid + 0.5,
    text: n >= 2 ? `${ROW_WORDS[Math.min(4, n)]} +${pts.toLocaleString()}` : `+${pts.toLocaleString()}`,
    sub,
    tone: four ? 'big' : s.combo >= 2 ? 'combo' : 'rows',
  })
  burst(s, rows)
  if (!s.shakeReady) {
    s.charge += n
    if (s.charge >= SHAKE_ROWS) {
      s.charge = 0
      s.shakeReady = true
    }
  }
  if (four) sfx('perfect')
  else if (s.combo >= 2) sfx('pad', Math.min(5, s.combo - 2))
  else sfx('good')
  addRows(s, n, mid)
}

/** A Shake's rows pay together, and take nothing from the run of clears or a four's back to back. */
function payShake(s: GameState, rows: number[]) {
  const n = rows.length
  const pts = SHAKE_POINTS * n * s.level
  s.score += pts
  s.bestShake = Math.max(s.bestShake, n)
  const mid = rows.reduce((a, b) => a + b, 0) / n
  floater(s, { x: COLS / 2, y: mid + 0.5, text: `Shake +${pts.toLocaleString()}`, sub: n > 1 ? `${n} rows` : undefined, tone: 'shake' })
  burst(s, rows)
  sfx(n >= 4 ? 'perfect' : 'good')
  addRows(s, n, mid)
}

// ——————————————————————————————————————————————————————————— the Shake

/**
 * Every block drops straight down into whatever gap is under it, column by
 * column. The piece in play goes back up top to wait. The pile takes its new
 * places at once; `settle` keeps the falls so they can be drawn.
 */
export function shake(s: GameState): boolean {
  if (s.phase !== 'playing' || !s.shakeReady || s.clearing || s.settle) return false
  s.shakeReady = false
  s.charge = 0
  s.shakes += 1
  s.waiting = s.piece?.kind ?? s.waiting
  s.piece = null
  const grid = new Uint8Array(COLS * TOTAL)
  const ids = new Int32Array(COLS * TOTAL)
  const falls: Fall[] = []
  let longest = 0
  for (let x = 0; x < COLS; x++) {
    let to = TOTAL - 1
    for (let y = TOTAL - 1; y >= 0; y--) {
      const k = at(s, x, y)
      if (!k) continue
      grid[to * COLS + x] = k
      ids[to * COLS + x] = s.ids[y * COLS + x]!
      if (to > y) {
        falls.push({ x, from: y, to, kind: (k - 1) as Kind })
        longest = Math.max(longest, to - y)
      }
      to--
    }
  }
  s.settle = {
    t: 0,
    falls,
    dur: RATTLE_TIME + Math.sqrt((2 * longest) / SETTLE_PULL) + 0.08,
    grid: s.grid,
    ids: s.ids,
  }
  s.grid = grid
  s.ids = ids
  sfx('boom')
  return true
}

/** How far a block in a Shake has fallen, `t` seconds in: nothing during the rattle, then quicker and quicker. */
export function settleDrop(fall: Fall, t: number): number {
  const k = Math.max(0, t - RATTLE_TIME)
  return Math.min(fall.to - fall.from, 0.5 * SETTLE_PULL * k * k)
}

// ——————————————————————————————————————————————————————————— the end

function topOut(s: GameState, stuck: Piece | null) {
  s.phase = 'topout'
  s.overT = 0
  s.piece = null
  s.stuck = stuck
  s.clearing = null
  s.settle = null
  sfx('die')
}

// ——————————————————————————————————————————————————————————— effects

function puff(s: GameState, x: number, y: number, kind: Kind, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.PI + fxRandom() * Math.PI
    const v = 1.2 + fxRandom() * 2.4
    const life = 0.18 + fxRandom() * 0.16
    s.bits.push({
      x: x + (fxRandom() - 0.5) * 0.8,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v * 0.6,
      life,
      max: life,
      kind,
      size: 0.06 + fxRandom() * 0.05,
    })
  }
  if (s.bits.length > 160) s.bits.splice(0, s.bits.length - 160)
}

/** Sparks off every block of a cleared row, in its own colour. */
function burst(s: GameState, rows: number[]) {
  for (const y of rows) {
    for (let x = 0; x < COLS; x++) {
      const k = at(s, x, y)
      if (!k) continue
      for (let i = 0; i < 2; i++) {
        const a = fxRandom() * Math.PI * 2
        const v = 2 + fxRandom() * 5
        const life = 0.4 + fxRandom() * 0.4
        s.bits.push({
          x: x + 0.5,
          y: y + 0.5,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 2.5,
          life,
          max: life,
          kind: (k - 1) as Kind,
          size: 0.12 + fxRandom() * 0.12,
        })
      }
    }
  }
  if (s.bits.length > 160) s.bits.splice(0, s.bits.length - 160)
}

function age(s: GameState, dt: number) {
  s.time += dt
  s.bump = Math.max(0, s.bump - dt * 5)
  for (const f of s.floaters) f.life -= dt * 0.8
  s.floaters = s.floaters.filter((f) => f.life > 0)
  for (const t of s.trails) t.life -= dt * 5
  s.trails = s.trails.filter((t) => t.life > 0)
  for (const b of s.bits) {
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.vy += 14 * dt
    b.vx *= Math.pow(0.4, dt)
    b.life -= dt
  }
  s.bits = s.bits.filter((b) => b.life > 0)
}

// ——————————————————————————————————————————————————————————— time

export function tick(s: GameState, dt: number): GameState {
  age(s, dt)
  if (s.phase === 'topout') {
    s.overT += dt
    if (s.overT >= TOPOUT_TIME) s.phase = 'gameover'
    return s
  }
  if (s.phase !== 'playing') return s

  if (s.clearing) {
    s.clearing.t += dt
    if (s.clearing.t >= CLEAR_TIME) {
      removeRows(s, s.clearing.rows)
      s.clearing = null
      spawn(s)
    }
    return s
  }

  if (s.settle) {
    s.settle.t += dt
    if (s.settle.t >= s.settle.dur) {
      s.settle = null
      const full = fullRows(s)
      if (full.length) {
        payShake(s, full)
        s.clearing = { rows: full, t: 0 }
      } else {
        spawn(s)
      }
    }
    return s
  }

  const p = s.piece
  if (!p) return s

  const step = s.softDrop ? softRowTime(s.level) : rowTime(s.level)
  s.fall += dt
  while (s.fall >= step) {
    s.fall -= step
    if (!fits(s, p.kind, p.rot, p.x, p.y + 1)) {
      s.fall = 0
      break
    }
    p.y += 1
    reachedRow(s)
  }

  // Lifted off the pile by a turn, the clocks don't start over: only a lower row does that (reachedRow).
  const down = grounded(s)
  if (down) s.touched = true
  if (s.touched) s.groundT += dt
  if (down) {
    s.lockT += dt
    if (s.lockT >= LOCK_DELAY || s.groundT >= GROUND_LIMIT) lock(s)
  } else if (s.touched && s.groundT >= GROUND_LIMIT) {
    // Out of time while a turn has it in the air: it settles where it is, unless that's lower than it has been.
    const to = landingY(s, p)
    if (to + BOTTOM[p.kind]![p.rot]! <= s.lowest) {
      p.y = to
      lock(s)
    }
  }
  return s
}

/** Admin and testing: the run carried on from the start of a level, its rows already cleared. */
export function jumpToLevel(s: GameState, level: number): GameState {
  if (s.phase !== 'playing') return s
  const target = Math.max(1, Math.floor(level) || 1)
  s.rows = (target - 1) * ROWS_PER_LEVEL
  s.level = target
  s.fall = 0
  return s
}
