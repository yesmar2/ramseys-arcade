import { runPreview, type Sim } from '../previewKit'
import {
  CLEAR_FLASH,
  CLEAR_TIME,
  createInitialState,
  queueDir,
  startGame,
  surgeReady,
  tick,
  triggerSurge,
  type Dir,
  type GameState,
} from './game'
import { computeLayout, renderGame } from './render'

/*
 * Pellets playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that clears the maze the way a person
 * does. It works along the nearest crumbs, keeps out of lanes a chaser could
 * reach first, turns back when one comes round a corner, makes for a power pip
 * when it is hounded, goes after the chasers while they are blue and after
 * the fruit under the den while it lasts, and fires the surge when a chaser is
 * on top of it. It only glances round every so often, and now and then loses
 * track of a chaser, so sooner or later it is caught, and the third catch
 * ends the run.
 */

const VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DIRS: Dir[] = ['up', 'left', 'down', 'right']

/** A chaser's pace against the player's, near enough: the pilot's sense of how fast they close. */
const PACE = 0.8
/** Tiles to spare it wants between itself and a chaser at every tile it passes through. */
const SLACK = 1.2
/** Tiles away a chaser has to be within to be noticed at all: a person watches round the player, not the whole maze. */
const SIGHT = 7

/**
 * Chance, at each glance, that it stops keeping an eye on a chaser for a
 * second or so, `alive` seconds since it began or last came back from a catch
 * and `played` seconds into the run. It starts each life sharp, and then its
 * attention wanders more and more; a long run wears it down besides, so the
 * three lives seldom make much more than a minute and a half. Sharp at the
 * start matters: every maze opens the same way, and a slip there would catch
 * run after run in the same place.
 */
function lapse(alive: number, played: number) {
  const worn = Math.max(0, alive - 8) / 16
  return Math.min(0.9, 0.03 + 0.7 * worn * worn + Math.max(0, played - 50) * 0.012)
}

/** Safe tiles a way on needs beyond it for it to count as a way out. */
const ROOM = 6
/** Tiles of detour a turn back has to save before it is worth making. */
const TURN_BACK = 2
/** A chaser this many tiles off counts as hounding it, and a power pip this near becomes worth having. */
const HOUNDED = 5

/**
 * Drawn at this many times the screen's size and cropped round the player.
 * The whole maze on a cabinet's screen leaves the player a few pixels across,
 * so the view is closer in, about fifteen tiles by eleven, and follows it; the
 * strip the renderer keeps under the maze for the Surge button stays out of
 * shot. The game stands its maze on end when the window is taller than it is
 * wide, which on a phone it is, so a maze on end is drawn bigger to fill the
 * same screen with the same tiles.
 */
const WIDE_ZOOM = 2
const TALL_ZOOM = 3.4
/** Pixels of the maze's panel left showing at the edge of the view. */
const EDGE = 4
/** Seconds the view takes to catch up with the player. */
const CAMERA_LAG = 0.25

/** The tile under a position, through the side tunnels. */
function tileOf(s: GameState, x: number, y: number) {
  const tx = ((Math.floor(x) % s.cols) + s.cols) % s.cols
  const ty = ((Math.floor(y) % s.rows) + s.rows) % s.rows
  return ty * s.cols + tx
}

/**
 * The tile one step from (x, y), through the side tunnels, or -1 where a wall
 * is in the way. The den's gate stops the player and lets a chaser through on
 * its way out.
 */
function stepFrom(s: GameState, x: number, y: number, dir: Dir, gate: boolean) {
  let nx = x + VEC[dir].x
  let ny = y + VEC[dir].y
  if (nx < 0 || nx >= s.cols) {
    if (!s.open[y]?.[0] || !s.open[y]?.[s.cols - 1]) return -1
    nx = (nx + s.cols) % s.cols
  }
  if (ny < 0 || ny >= s.rows) {
    if (!s.open[0]?.[x] || !s.open[s.rows - 1]?.[x]) return -1
    ny = (ny + s.rows) % s.rows
  }
  if (!s.open[ny][nx] || (s.door[ny][nx] && !gate)) return -1
  return ny * s.cols + nx
}

/** Steps from one tile to every other (-1 where there is no way), for a chaser sizing up the maze. */
function distances(s: GameState, from: number, gate: boolean) {
  const d = new Int16Array(s.cols * s.rows).fill(-1)
  d[from] = 0
  const queue = [from]
  for (let q = 0; q < queue.length; q++) {
    const at = queue[q]
    const x = at % s.cols
    const y = (at - x) / s.cols
    for (const dir of DIRS) {
      const next = stepFrom(s, x, y, dir, gate)
      if (next < 0 || d[next] >= 0) continue
      d[next] = d[at] + 1
      queue.push(next)
    }
  }
  return d
}

/**
 * A glance round: how far each chaser it is watching is from every tile.
 * Only those near the player are noticed, and not those it has lost track of
 * (`unseen`, seconds left of it, by chaser). Blue ones are no threat until
 * their time is nearly up, and eyes on their way home and chasers still
 * penned never are.
 */
function glance(s: GameState, unseen: number[], alive: number): Int16Array[] {
  const here = tileOf(s, s.player.x, s.player.y)
  const seen: Int16Array[] = []
  s.ghosts.forEach((g, i) => {
    if (unseen[i] > 0) return
    if (Math.random() < lapse(alive, s.time)) {
      unseen[i] = 0.5 + Math.random() * 0.8
      return
    }
    if (g.mode === 'den' || g.mode === 'eaten') return
    if (g.mode === 'frightened' && s.fright > 1.2) return
    const d = distances(s, tileOf(s, g.x, g.y), g.mode === 'leaving')
    if (d[here] >= 0 && d[here] <= SIGHT) seen.push(d)
  })
  return seen
}

/** No chaser it has seen could be at this tile when it gets there, `t` tiles of travel from now. */
function safeAt(threats: Int16Array[], at: number, t: number) {
  for (const d of threats) if (d[at] >= 0 && d[at] <= t * PACE + SLACK) return false
  return true
}

/** How much time to spare it has at a tile over the nearest chaser, in tiles. */
function slackAt(threats: Int16Array[], at: number, t: number) {
  let least = Infinity
  for (const d of threats) if (d[at] >= 0) least = Math.min(least, d[at] - t * PACE)
  return least
}

/** The next tile centre along the heading, the one under the player included, and how far off it is. Null in a tunnel mouth. */
type Ahead = { tile: number; x: number; y: number; gap: number }

function ahead(s: GameState): Ahead | null {
  const { x, y, dir } = s.player
  const v = VEC[dir]
  let cx = Math.floor(x) + 0.5
  let cy = Math.floor(y) + 0.5
  if (v.x !== 0) cx = v.x > 0 ? Math.ceil(x - 0.5 - 1e-9) + 0.5 : Math.floor(x - 0.5 + 1e-9) + 0.5
  else cy = v.y > 0 ? Math.ceil(y - 0.5 - 1e-9) + 0.5 : Math.floor(y - 0.5 + 1e-9) + 0.5
  const tx = Math.floor(cx)
  const ty = Math.floor(cy)
  if (tx < 0 || ty < 0 || tx >= s.cols || ty >= s.rows) return null
  return { tile: ty * s.cols + tx, x: tx, y: ty, gap: Math.abs(cx - x) + Math.abs(cy - y) }
}

type Way = { dir: Dir; safe: boolean; room: number; slack: number; score: number }

/**
 * Every way on from the centre ahead, turning straight back included, and
 * what each is worth: how soon it reaches something worth eating through
 * tiles no chaser gets to first, and how much safe maze lies beyond.
 */
function ways(s: GameState, at: Ahead, threats: Int16Array[]): Way[] {
  const heading = s.player.dir
  const here = tileOf(s, s.player.x, s.player.y)
  const hounded = threats.some((d) => d[here] >= 0 && d[here] <= HOUNDED)
  // Chasers turned blue with time enough left to catch them, as targets.
  const prey = new Map<number, number>()
  for (const g of s.ghosts) {
    if (g.mode === 'frightened' && s.fright > 1.8) prey.set(tileOf(s, g.x, g.y), s.fright)
  }
  // The fruit under the den, worth a detour if it will still be there.
  const fruit = s.fruit ? tileOf(s, s.fruit.x, s.fruit.y) : -1
  const fruitLeft = s.fruit ? s.fruit.life : 0
  const aheadSafe = safeAt(threats, at.tile, at.gap)
  const pipAt = (tile: number) => (s.power[(tile - (tile % s.cols)) / s.cols][tile % s.cols] ? 1 : 0)
  const out: Way[] = []
  for (const dir of DIRS) {
    const back = dir === OPPOSITE[heading]
    const first = stepFrom(s, at.x, at.y, dir, false)
    if (first < 0) continue
    // Turning back is instant, so a way back starts from where the player is, not from the centre ahead.
    const t0 = back ? 1 - at.gap : at.gap + 1
    const safe = (back || aheadSafe) && safeAt(threats, first, t0)
    const steps = new Int16Array(s.cols * s.rows).fill(-1)
    // Whether the way to a tile goes over a power pip, which eats it.
    const overPip = new Uint8Array(s.cols * s.rows)
    steps[first] = 0
    overPip[first] = pipAt(first)
    const queue = [first]
    for (let q = 0; q < queue.length; q++) {
      const tile = queue[q]
      const x = tile % s.cols
      const y = (tile - x) / s.cols
      for (const d of DIRS) {
        const next = stepFrom(s, x, y, d, false)
        if (next < 0 || steps[next] >= 0 || !safeAt(threats, next, t0 + steps[tile] + 1)) continue
        steps[next] = steps[tile] + 1
        overPip[next] = overPip[tile] | pipAt(next)
        queue.push(next)
      }
    }
    // A power pip is saved for when it is needed, and then only one close by;
    // until then, crumbs that can only be had by going over one wait.
    const spend = (t: number) => (hounded && t <= HOUNDED + 2 ? t - 4 : t + 12)
    let score = Infinity
    for (const tile of queue) {
      const x = tile % s.cols
      const y = (tile - x) / s.cols
      const t = t0 + steps[tile]
      if (s.crumbs[y][x]) score = Math.min(score, overPip[tile] ? spend(t) : t)
      else if (s.power[y][x]) score = Math.min(score, spend(t))
      const blue = prey.get(tile)
      if (blue !== undefined && t < 9 && t / 3 < blue - 1) score = Math.min(score, t - 6)
      if (tile === fruit && t / 5 < fruitLeft - 0.5) score = Math.min(score, t - 5)
    }
    if (back) score += TURN_BACK
    out.push({ dir, safe, room: queue.length, slack: slackAt(threats, first, t0), score })
  }
  return out
}

/**
 * The way to take: the best-scoring of the safe ways out, failing those the
 * roomiest safe one, failing that whichever keeps furthest from the chasers.
 * Between ways as good as each other it keeps going as it is, and otherwise
 * leans the way this run happens to favour, which on a maze the same both
 * sides is what sends one run left and the next right.
 */
function pick(s: GameState, options: Way[], lean: Dir[]): Way | null {
  const heading = s.player.dir
  // Waiting for "Ready!" to clear, the heading is the game's, not a choice yet.
  const rank = (w: Way) => (w.dir === heading && s.ready <= 0 ? -1 : lean.indexOf(w.dir))
  const safe = options.filter((w) => w.safe)
  const open = safe.filter((w) => w.room >= ROOM)
  let best: Way | null = null
  if (open.length) {
    for (const w of open) {
      if (!best || w.score < best.score || (w.score === best.score && rank(w) < rank(best))) best = w
    }
  } else if (safe.length) {
    for (const w of safe) if (!best || w.room > best.room) best = w
  } else {
    for (const w of options) if (!best || w.slack > best.slack) best = w
  }
  return best
}

/** Where to centre a view `view` wide on a maze from `start` to `start + size`: on `at`, but never off the maze. */
function frame(start: number, size: number, at: number, view: number) {
  const lo = start - EDGE + view / 2
  const hi = start + size + EDGE - view / 2
  return Math.round(lo >= hi ? start + size / 2 : Math.min(Math.max(at, lo), hi))
}

/**
 * The run as the renderer should draw it, minus what it writes over the maze
 * for a player: the "Ready!" plate before each maze and life, the "Maze
 * clear!" plate after one, and the pops that are not points ("×3", "streak
 * lost", "100 in a row!").
 *
 * A cleared maze flashes its walls under the plate, and the flash is worth
 * keeping. The renderer times both from the same clock, so each frame is
 * drawn as one of two moments that carry no plate: a lit frame as the flash's
 * first instant, a dark one as play with the board emptied.
 */
function shown(s: GameState): GameState {
  const pops = s.pops.filter((p) => p.text.startsWith('+'))
  if (s.phase === 'clearing') {
    const since = CLEAR_TIME - s.clearAnim
    const lit = since < CLEAR_FLASH && Math.floor((since / CLEAR_FLASH) * 8) % 2 === 0
    return lit ? { ...s, pops, clearAnim: CLEAR_TIME } : { ...s, pops, phase: 'playing', ghosts: [], ready: 0 }
  }
  // The pause before a maze or a life still happens, only without its plate;
  // the player is drawn steady through it, as the game draws it.
  if (s.ready > 0) return { ...s, pops, ready: 0, invuln: 0 }
  return { ...s, pops }
}

export function makeSim(): Sim<GameState> {
  // What it last saw of the chasers, when it next looks, and how long it has lost track of each.
  let threats: Int16Array[] = []
  let lookIn = 0
  const unseen = [0, 0, 0, 0]
  // Seconds of play since the run began or it last came back from a catch.
  let alive = 0
  // The centre the last choice was made for, so each junction is decided once.
  let decided = -1
  // Which ways this run leans, between ways as good as each other.
  let lean: Dir[] = [...DIRS]
  // Where the player was a step ago, to tell when it has stopped against a wall.
  let lastX = 0
  let lastY = 0
  // The maze the run is on stands on its end.
  let tall = false
  // Where the view is looking, in tiles.
  let camX = 0
  let camY = 0

  const drive = (s: GameState, dt: number): GameState => {
    let next = s
    const p = next.player
    alive += dt
    lookIn -= dt
    for (let i = 0; i < unseen.length; i++) unseen[i] = Math.max(0, unseen[i] - dt)
    const looked = lookIn <= 0
    if (looked) {
      lookIn = 0.22 + Math.random() * 0.25
      threats = glance(next, unseen, alive)
    }
    const stuck = p.x === lastX && p.y === lastY
    lastX = p.x
    lastY = p.y
    const at = ahead(next)
    if (!at) return next
    const junction = at.tile !== decided && at.gap <= 6 * dt + 0.08
    if (!looked && !junction && !stuck) return next
    if (junction) decided = at.tile

    const options = ways(next, at, threats)
    const way = pick(next, options, lean)
    if (way && way.dir !== p.pending) {
      // Between junctions it only turns back, which the engine does at once;
      // a turn at the centre ahead waits until the player is there.
      if (junction || stuck || way.dir === OPPOSITE[p.dir]) next = queueDir(next, way.dir)
    }
    // The surge, as a way out when a chaser is on top of it and it has one.
    if (looked && surgeReady(next)) {
      const here = tileOf(next, p.x, p.y)
      const close = threats.some((d) => d[here] >= 0 && d[here] <= 3)
      if (close && Math.random() < 0.5) next = triggerSurge(next)
    }
    return next
  }

  /** The view follows the player, and cuts rather than sweeps when it comes out the far side of a tunnel or back at the start. */
  const follow = (s: GameState, dt: number | null) => {
    const tx = Math.min(Math.max(s.player.x, 0.5), s.cols - 0.5)
    const ty = Math.min(Math.max(s.player.y, 0.5), s.rows - 0.5)
    const far = Math.abs(tx - camX) > 6 || Math.abs(ty - camY) > 6
    const k = dt === null || far ? 1 : 1 - Math.exp(-dt / CAMERA_LAG)
    camX += (tx - camX) * k
    camY += (ty - camY) * k
  }

  return {
    start: () => {
      threats = []
      lookIn = 0
      unseen.fill(0)
      alive = 0
      decided = -1
      lean = [...DIRS].sort(() => Math.random() - 0.5)
      const s = startGame(createInitialState())
      tall = s.rows > s.cols
      lastX = s.player.x
      lastY = s.player.y
      follow(s, null)
      return s
    },
    step: (s, dt) => {
      const next = tick(s.phase === 'playing' ? drive(s, dt) : s, dt)
      if (s.phase === 'dying' && next.phase === 'playing') alive = 0
      tall = next.rows > next.cols
      follow(next, dt)
      return next
    },
    over: (s) => s.phase === 'gameover',
    render: (ctx, s, w, h) => renderGame(ctx, shown(s), w, h),
    // The maze does not depend on the screen, so a resize keeps the run.
    resize: (s) => s,
    // Past the "Ready!" wait and a few seconds more: the first chasers are out
    // and the maze has been eaten into.
    warmup: 7.5,
    hold: 1.4,
    // Read by the kit at every frame, so it follows the shape of the maze being played.
    get zoom() {
      return tall ? TALL_ZOOM : WIDE_ZOOM
    },
    focus: (s, zw, zh) => {
      const zoom = s.rows > s.cols ? TALL_ZOOM : WIDE_ZOOM
      const v = computeLayout(zw, zh, s.cols, s.rows)
      return {
        x: frame(v.ox, v.gridW, v.ox + camX * v.cell, zw / zoom),
        y: frame(v.oy, v.gridH, v.oy + camY * v.cell, zh / zoom),
      }
    },
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
