import { runPreview, type Sim } from '../previewKit'
import { playHeader } from '../playHeader'
import {
  COLS,
  ROWS,
  VEC,
  bodyLength,
  createInitialState,
  isBoosting,
  queueDir,
  sampleTrail,
  setBoost,
  startGame,
  tick,
  type Dir,
  type GameState,
} from './game'
import { catchable, type Mouse } from './mouse'
import { renderGame } from './render'

/*
 * Snake playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that plays the way a person does. It reads
 * the lawn a cell ahead of the head and goes for the fruit the short way round
 * the stones and its own body, but not into a pocket too small to get back out
 * of. It turns aside for a golden apple or a mouse that comes near, and holds
 * the boost when a ring is closing on it. Now and then a turn comes a beat
 * late, and it grows hastier as a run wears on, until it clips a stone, the
 * hedge or its own tail and a new run starts.
 */

const LEFT_OF: Record<Dir, Dir> = { up: 'left', left: 'down', down: 'right', right: 'up' }
const RIGHT_OF: Record<Dir, Dir> = { up: 'right', right: 'down', down: 'left', left: 'up' }
const DIRS: Dir[] = ['up', 'down', 'left', 'right']

/** Spacing the body is read at, in cells: fine enough that no cell it crosses is missed. */
const BODY_STEP = 0.25
/** How far the tail has to have moved on past a cell before the head goes into it, in cells. */
const TAIL_ROOM = 1
/** Room to spare, in cells beyond its own length, for a way on to count as one it can get back out of. */
const ROOM_SPARE = 5
/** Seconds it will chase one mouse before giving it up. */
const MOUSE_PATIENCE = 6

/** Pixels of hedge left showing round the lawn. */
const EDGE = 5

/** The lawn as the pilot reads it. */
type Lawn = {
  cols: number
  rows: number
  /** 1 where a stone stands, or is sketched for the layout the next bite brings. */
  stone: Uint8Array
  /** For each cell the body lies across, how far back from the head its nearest part is, in cells. */
  body: Float32Array
  /** Head to tail tip, in cells. */
  length: number
}

function readLawn(s: GameState): Lawn {
  const { cols, rows } = s
  const stone = new Uint8Array(cols * rows)
  const mark = (key: string) => {
    const [x, y] = key.split(',').map(Number)
    if (x >= 0 && y >= 0 && x < cols && y < rows) stone[y * cols + x] = 1
  }
  for (const key of s.walls) mark(key)
  // A person reads the dashed outline of the next layout and keeps off it
  // before it lands. Whatever is waiting to be eaten inside it is let through.
  if (s.nextWalls) {
    for (const key of s.nextWalls) if (!s.walls.has(key)) mark(key)
    stone[s.fruit.y * cols + s.fruit.x] = 0
    if (s.golden) stone[s.golden.y * cols + s.golden.x] = 0
  }
  const body = new Float32Array(cols * rows).fill(Infinity)
  const length = bodyLength(s.segments)
  const points = sampleTrail(s.trail, Math.ceil(length / BODY_STEP) + 1, BODY_STEP)
  for (let i = 0; i < points.length; i++) {
    const x = Math.floor(points[i].x)
    const y = Math.floor(points[i].y)
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue
    const at = y * cols + x
    body[at] = Math.min(body[at], i * BODY_STEP)
  }
  return { cols, rows, stone, body, length }
}

/**
 * A cell the head can go into, `t` cells of travel from now: no stone, and
 * whatever of the body lies across it gone by then, since the tail moves on
 * as fast as the head does.
 */
function clearAt(l: Lawn, at: number, t: number) {
  return l.stone[at] === 0 && l.body[at] + t >= l.length + TAIL_ROOM
}

/**
 * Everywhere the head could get to from cell `from`, which it reaches `t0`
 * cells from now: the steps to each cell (-1 where it cannot get), and how
 * many cells that is.
 */
function explore(l: Lawn, from: number, t0: number) {
  const { cols, rows } = l
  const steps = new Int16Array(cols * rows).fill(-1)
  steps[from] = 0
  const queue = [from]
  for (let q = 0; q < queue.length; q++) {
    const at = queue[q]
    const x = at % cols
    const y = (at - x) / cols
    const d = steps[at]
    for (const dir of DIRS) {
      const nx = x + VEC[dir].x
      const ny = y + VEC[dir].y
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      const next = ny * cols + nx
      if (steps[next] >= 0 || !clearAt(l, next, t0 + d + 1)) continue
      steps[next] = d + 1
      queue.push(next)
    }
  }
  return { steps, room: queue.length }
}

/** The next cell centre along the heading, the one under the head included, and how far off it is. */
type Ahead = { x: number; y: number; gap: number }

function ahead(s: GameState): Ahead {
  const v = VEC[s.dir]
  const { x, y } = s.head
  if (v.x !== 0) {
    const c = v.x > 0 ? Math.ceil(x - 0.5 - 1e-9) + 0.5 : Math.floor(x - 0.5 + 1e-9) + 0.5
    return { x: Math.floor(c), y: Math.floor(y), gap: Math.abs(c - x) }
  }
  const c = v.y > 0 ? Math.ceil(y - 0.5 - 1e-9) + 0.5 : Math.floor(y - 0.5 + 1e-9) + 0.5
  return { x: Math.floor(x), y: Math.floor(c), gap: Math.abs(c - y) }
}

/** Where a mouse can be met: the cell it is running into, or the one it is sitting in. */
function mouseCell(m: Mouse, l: Lawn) {
  const still = m.mode === 'sniff' || m.mode === 'trapped' || m.t >= 1
  const x = still ? Math.floor(m.x) : m.to.x
  const y = still ? Math.floor(m.y) : m.to.y
  return x < 0 || y < 0 || x >= l.cols || y >= l.rows ? -1 : y * l.cols + x
}

/** How often a turn it could take or leave comes a cell late: now and then, whatever the hour. */
const SLIP = 0.03

/**
 * How often a turn it has to make, with something straight ahead, comes a
 * cell late: hardly ever in the first stretch of a run, and more and more
 * often as it wears on, so a run seldom ends in its first half minute or
 * lasts much past a minute and a half.
 */
function lateness(s: GameState) {
  const worn = s.elapsed / 45
  return Math.min(0.4, 0.006 + 0.12 * worn * worn)
}

/** How often it takes the short way without checking there is room at the end of it. */
function haste(s: GameState) {
  const worn = s.elapsed / 60
  return Math.min(0.6, 0.03 + 0.5 * worn * worn)
}

/**
 * Where renderGame puts the lawn on a canvas this size. The renderer keeps its
 * layout to itself, so this follows it: the lawn hangs under the play header
 * and its hedge, above the strip the tank sits in, between the side margins.
 */
function lawnLayout(w: number, h: number, cols: number, rows: number) {
  const hedge = 10
  const header = playHeader(w) + hedge
  const footer = Math.max(22, Math.min(w, h) * 0.07)
  const pad = Math.max(hedge + 2, Math.min(w, h) * 0.03)
  const cell = Math.max(1, Math.min((w - pad * 2) / cols, (h - pad - header - footer) / rows))
  return { cell, ox: Math.round((w - cell * cols) / 2), oy: Math.round(header), gridW: cell * cols, gridH: cell * rows }
}

/**
 * How many times the screen's size to draw at, for a screen `w` by `h`.
 *
 * The renderer keeps a strip above the lawn for the score and one below it
 * for the boost tank, both a player's, and at a cabinet's size those strips
 * would leave the lawn a few pixels a cell. Drawn bigger and cropped to the
 * lawn, it fills the screen with the strips out of shot. The strips are sized
 * in pixels, so how much bigger depends on the screen: this is the size at
 * which the whole lawn, and a sliver of its hedge, just fills it.
 */
function lawnZoom(w: number, h: number, cols: number, rows: number) {
  const want = Math.min((w - EDGE * 2) / cols, (h - EDGE * 2) / rows)
  let lo = 1
  let hi = 4
  for (let i = 0; i < 20; i++) {
    const z = (lo + hi) / 2
    if (lawnLayout(w * z, h * z, cols, rows).cell < want) lo = z
    else hi = z
  }
  return hi
}

type Option = { dir: Dir; room: number; steps: number }

/** Reaching what it is after beats not; then the shorter way; failing both, the roomier. Earlier options win ties. */
function better(a: Option, b: Option) {
  const ar = a.steps >= 0
  const br = b.steps >= 0
  if (ar !== br) return ar
  return ar ? a.steps < b.steps : a.room > b.room
}

export function makeSim(): Sim<GameState> {
  // The centre the last choice was made for, so each is made once.
  let decided = ''
  // Whether it means to hold the boost.
  let boost = false
  // The mouse on the lawn, whether it fancies it, and how long it has been after it.
  let mouseSeed = -1
  let wantMouse = false
  let chasing = false
  let chasedFor = 0
  // The screen the kit last drew for, and the zoom that fits the lawn to it.
  let screen = ''
  let zoom = lawnZoom(216, 162, COLS, ROWS)
  const fit = (w: number, h: number) => {
    const key = `${w}x${h}`
    if (key === screen) return
    screen = key
    zoom = lawnZoom(w, h, COLS, ROWS)
  }

  /** What to go for from this centre: the fruit, unless a golden apple or a mouse is worth the detour. */
  const aim = (s: GameState, l: Lawn, from: number, gap: number) => {
    const reach = explore(l, from, gap).steps
    const fruit = s.fruit.y * l.cols + s.fruit.x
    const toFruit = reach[fruit]
    chasing = false
    const m = s.mouse
    // A mouse close by is worth leaving a short chain for, never a long one.
    if (m && wantMouse && catchable(m) && chasedFor < MOUSE_PATIENCE && !(s.fruit.live && s.chain >= 4)) {
      const at = mouseCell(m, l)
      if (at >= 0 && reach[at] >= 0 && reach[at] <= 10) {
        chasing = true
        return at
      }
    }
    // A golden apple, if it can be reached before it goes and it is not the long way round.
    const g = s.golden
    if (g) {
      const at = g.y * l.cols + g.x
      const d = reach[at]
      if (d >= 0 && (gap + d) / s.speed < g.life - g.age - 0.4 && (!s.fruit.live || toFruit < 0 || d <= toFruit + 3)) {
        return at
      }
    }
    return fruit
  }

  /** Nosing into the hedge after a late turn: a snatch at the lane along it, which comes in time more often than not. */
  const scramble = (s: GameState, l: Lawn): Dir | null => {
    if (Math.random() < 0.4) return null
    const hx = Math.min(l.cols - 1, Math.max(0, Math.floor(s.head.x)))
    const hy = Math.min(l.rows - 1, Math.max(0, Math.floor(s.head.y)))
    let best: Dir | null = null
    let room = 0
    for (const dir of [LEFT_OF[s.dir], RIGHT_OF[s.dir]]) {
      const x = hx + VEC[dir].x
      const y = hy + VEC[dir].y
      if (x < 0 || y < 0 || x >= l.cols || y >= l.rows || !clearAt(l, y * l.cols + x, 1)) continue
      const r = explore(l, y * l.cols + x, 1).room
      if (r > room) {
        room = r
        best = dir
      }
    }
    return best
  }

  /** Which way to go at the centre ahead, or null to carry straight on. */
  const choose = (s: GameState, at: Ahead): Dir | null => {
    const l = readLawn(s)
    if (at.x < 0 || at.y < 0 || at.x >= l.cols || at.y >= l.rows) return scramble(s, l)
    const from = at.y * l.cols + at.x
    const goal = aim(s, l, from, at.gap)
    const t = at.gap + 1
    const sides = Math.random() < 0.5 ? [LEFT_OF[s.dir], RIGHT_OF[s.dir]] : [RIGHT_OF[s.dir], LEFT_OF[s.dir]]
    const options: Option[] = []
    for (const dir of [s.dir, ...sides]) {
      const x = at.x + VEC[dir].x
      const y = at.y + VEC[dir].y
      if (x < 0 || y < 0 || x >= l.cols || y >= l.rows) continue
      const next = y * l.cols + x
      if (!clearAt(l, next, t)) continue
      const { steps, room } = explore(l, next, t)
      options.push({ dir, room, steps: steps[goal] })
    }
    boost = false
    if (!options.length) return null

    // Careful, it only goes where there is room to turn round and come back
    // out; in a hurry, it takes the short way and hopes.
    const need = Math.ceil(l.length) + ROOM_SPARE
    const roomy = options.filter((o) => o.room >= need)
    const pool = roomy.length && Math.random() >= haste(s) ? roomy : options
    let best = pool[0]
    for (const o of pool) if (better(o, best)) best = o

    // The boost goes on when the ring would close before the head got there
    // at cruising pace, and for the last dash at a mouse.
    if (s.boostFuel > 0 && best.steps >= 0) {
      const fruit = goal === s.fruit.y * l.cols + s.fruit.x
      const ringLeft = s.fruit.window - s.fruit.age
      boost = (fruit && s.fruit.live && (t + best.steps) / s.speed > ringLeft - 0.15) || (chasing && best.steps <= 4)
    }

    if (best.dir === s.dir) return null
    // A beat late: it carries on past the corner it meant to take, and takes
    // the next if there is one. With stone, hedge or body straight ahead
    // there is not.
    const forced = !options.some((o) => o.dir === s.dir)
    return Math.random() < (forced ? lateness(s) : SLIP) ? null : best.dir
  }

  const drive = (s: GameState, dt: number): GameState => {
    let next = s
    const m = next.mouse
    if (m && m.seed !== mouseSeed) {
      mouseSeed = m.seed
      wantMouse = Math.random() < 0.75
      chasedFor = 0
    }
    if (chasing) chasedFor += dt
    if (next.boostHeld !== boost) next = setBoost(next, boost)
    if (next.pendingDir) return next

    // Each centre is decided once, as the head reaches it: any sooner and
    // the engine's hurry to a queued turn would jerk the head forward.
    const at = ahead(next)
    const key = `${at.x},${at.y}`
    if (key === decided) return next
    const inside = at.x >= 0 && at.y >= 0 && at.x < next.cols && at.y < next.rows
    const reach = next.speed * (isBoosting(next) ? 2 : 1) * dt + 0.05
    if (inside && at.gap > reach) return next
    decided = key
    const dir = choose(next, at)
    return dir ? queueDir(next, dir) : next
  }

  return {
    start: (w, h) => {
      decided = ''
      boost = false
      mouseSeed = -1
      wantMouse = false
      chasing = false
      chasedFor = 0
      fit(w, h)
      return startGame(createInitialState())
    },
    step: (s, dt, w, h) => {
      fit(w, h)
      return tick(s.phase === 'playing' ? drive(s, dt) : s, dt)
    },
    over: (s) => s.phase === 'gameover',
    // The world as the game draws it, minus the words it writes over the lawn
    // for a player: the level and chain banners, the how-to card of a run's
    // first seconds, and the words that go up with the score pops ("Chain 5",
    // "Golden apple", "Chain lost"), which at a cabinet's size would crowd the
    // lawn. The pops' points stay, and the price over a fruit's ring, as part
    // of the play.
    render: (ctx, s, w, h) =>
      renderGame(
        ctx,
        {
          ...s,
          banners: [],
          elapsed: Math.max(s.elapsed, 10),
          floaters: s.floaters.filter((f) => f.text.startsWith('+')).map((f) => (f.sub ? { ...f, sub: '' } : f)),
        },
        w,
        h,
      ),
    // The lawn is the same whatever the screen, so a resize keeps the run,
    // drawn to fit the new screen.
    resize: (s, w, h) => {
      fit(w, h)
      return s
    },
    // The still: a long snake bent round the stones, fruit ringed, a golden apple and a mouse out.
    poster: { seed: 2, at: 40 },
    hold: 1.2,
    // Read by the kit at every frame: the zoom for the screen it is drawing.
    get zoom() {
      return zoom
    },
    // The middle of the lawn, which the zoom has made just fill the screen.
    focus: (s, zw, zh) => {
      const v = lawnLayout(zw, zh, s.cols, s.rows)
      return { x: Math.round(v.ox + v.gridW / 2), y: Math.round(v.oy + v.gridH / 2) }
    },
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
