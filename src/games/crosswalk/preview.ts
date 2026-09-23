import { runPreview, type Sim } from '../previewKit'
import {
  BACK_LIMIT,
  TRAIN_COOL,
  TRAIN_PASS,
  TRAIN_WARN,
  createInitialState,
  hop,
  laneSpan,
  pickCols,
  stallLimitAt,
  startGame,
  tick,
  type Dir,
  type GameState,
  type Row,
} from './game'
import { renderGame } from './render'

/*
 * Crosswalk playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that crosses the way a person does. Traffic,
 * logs and trains all run on the engine's own numbers, so it can see where each
 * will be a second or two from now; it hops when the lane ahead will be clear,
 * sidesteps to line up with a gap or a log, waits on the verge when it has to,
 * and takes a coin that is on the way. It pauses to look now and then on safe
 * ground, and once in a while it misreads a road or a river, more often the
 * further it has come, which is how a run ends.
 */

/** Seconds in a slice of play, as the kit steps it, and how many of them a hop and a look take. */
const TICK = 1 / 30
const HOP_TICKS = 4
const WAIT_TICKS = 2
/**
 * How far ahead it plans, in slices, and how far to either side of where it
 * stands. Stuck for a while, it looks further, wider and further back.
 */
const HORIZON = 45
const REACH = 3
const STUCK_HORIZON = 66
/** Seconds without a new row before it counts itself stuck. */
const STUCK = 4

/** Half the hopper's width, as the engine collides it. */
const HALF = 0.26
/** Landing this close to a seat on a log pulls you onto it. */
const LOG_SNAP = 0.7

const ACTIONS: (Dir | null)[] = [null, 'up', 'left', 'right', 'down']

type Pilot = {
  /** Seconds into this run. */
  time: number
  /** When it next looks at the road: after a pause, or when the plan it has comes due. */
  until: number
  /** A row whose traffic it has misread, and for how much longer. */
  blindRow: number
  blindFor: number
  /** In the air, or waiting out the hop's cooldown, as of the last slice. */
  airborne: boolean
}

function freshPilot(): Pilot {
  return { time: 0, until: 0, blindRow: -1, blindFor: 0, airborne: false }
}

function newRun(w: number, h: number): GameState {
  return startGame(createInitialState(pickCols(w, h)))
}

function wrap(x: number, span: number) {
  const m = x % span
  return m < 0 ? m + span : m
}

/** How careful it is being: extra width kept from a bumper, and extra time either side of a gap. */
type Care = { room: number; pad: number }

/** Nothing on this road overlaps the hopper at `col` at any moment from `t0` to `t1`. */
function roadClear(row: Row, span: number, col: number, t0: number, t1: number, care: Care) {
  const v = row.dir * row.speed
  const a = col + 0.5 - HALF - care.room
  const b = col + 0.5 + HALF + care.room
  const from = t0 - care.pad
  const to = t1 + care.pad
  for (const car of row.vehicles) {
    // The car's tail is inside the danger band while it runs from `a - w` to `b`.
    const lo = a - car.w
    for (let k = -2; k <= 1; k++) {
      const x0 = car.x + k * span
      if (v === 0) {
        if (x0 > lo && x0 < b) return false
        continue
      }
      let ta = (lo - x0) / v
      let tb = (b - x0) / v
      if (ta > tb) [ta, tb] = [tb, ta]
      if (ta < to && tb > from) return false
    }
  }
  return true
}

/** No train is passing from `t0` to `t1`, with the lights' lead kept as margin. */
function railClear(row: Row, t0: number, t1: number, care: Care) {
  const warn = row.railWarn ?? TRAIN_WARN
  const pass = row.railPass ?? TRAIN_PASS
  const cycle = warn + pass + (row.railCool ?? TRAIN_COOL)
  const a = (row.railTimer ?? 0) + t0 - care.pad - 0.15
  const b = (row.railTimer ?? 0) + t1 + care.pad + 0.15
  for (let k = Math.floor((a - warn - pass) / cycle); k * cycle + warn < b; k++) {
    const start = k * cycle + warn
    if (start < b && start + pass > a) return false
  }
  return true
}

/** Where a hop toward `col` onto this log row, begun `t` from now, would seat you; null for the river. */
function seatAt(row: Row, span: number, col: number, t: number): number | null {
  const shift = row.dir * row.speed * t
  let best: number | null = null
  let gap = Infinity
  for (const log of row.vehicles) {
    const x = wrap(log.x + shift, span)
    const seats = Math.max(1, Math.round(log.w))
    for (const left of [x, x - span]) {
      for (let i = 0; i < seats; i++) {
        const d = Math.abs(col - (left + i))
        if (d < gap) {
          gap = d
          best = left + i
        }
      }
    }
  }
  return gap <= LOG_SNAP ? best : null
}

function isLogRow(row: Row) {
  return row.kind === 'water' && row.rocks.length === 0
}

/** Seconds a rider at `col` has before the log carries it too near the edge. */
function rideLeft(row: Row, cols: number, col: number) {
  if (row.speed <= 0) return Infinity
  const edge = row.dir > 0 ? cols - 0.6 - 0.2 - col : col + 0.4 - 0.2
  return edge / row.speed
}

type Ctx = { s: GameState; span: number; care: Care; blindRow: number; stuck: boolean }

/** Safe to stand at `col` on row `r` from `t0` to `t1`. */
function standSafe(c: Ctx, r: number, col: number, t0: number, t1: number) {
  const row = c.s.rows.get(r)
  if (!row) return false
  if (r === c.blindRow) return true
  if (row.kind === 'road') return roadClear(row, c.span, col, t0, t1, c.care)
  if (row.kind === 'rail') return railClear(row, t0, t1, c.care)
  if (isLogRow(row)) return rideLeft(row, c.s.cols, col) > t1 - t0
  return true
}

/**
 * A stretch of verge with no way on: trees either side, and nothing to step up
 * onto from anywhere between them. Two lawns in a row can close one off, and the
 * only way out is back down through the traffic.
 */
function pocket(s: GameState, r: number, col: number) {
  const row = s.rows.get(r)
  const next = s.rows.get(r + 1)
  if (!row || row.kind !== 'grass' || !next) return false
  const c = Math.round(col)
  let lo = c
  let hi = c
  while (lo > 0 && !row.trees.includes(lo - 1)) lo -= 1
  while (hi < s.cols - 1 && !row.trees.includes(hi + 1)) hi += 1
  for (let x = lo; x <= hi; x++) {
    if (next.kind === 'grass' ? !next.trees.includes(x) : !(next.kind === 'water' && next.rocks.length && !next.rocks.includes(x))) {
      return false
    }
  }
  return true
}

/**
 * Somewhere it could stop, not just pass through: safe for a while yet, and on
 * a log with time to find a way off before it reaches the edge.
 */
function settles(c: Ctx, r: number, col: number, t: number) {
  const row = c.s.rows.get(r)
  if (row && isLogRow(row)) return rideLeft(row, c.s.cols, col) > 1.6
  return standSafe(c, r, col, t, t + 0.7)
}

/** Where a hop from (`r`, `col`) begun `t` from now lands, as the engine works it out; null if it is blocked or drowns. */
function landing(c: Ctx, r: number, col: number, dir: Dir, t: number) {
  const { s, span } = c
  let nr = r
  let nc = col
  if (dir === 'up') nr += 1
  else if (dir === 'down') nr -= 1
  else if (dir === 'left') nc -= 1
  else nc += 1
  if (nr < 0) return null
  const row = s.rows.get(nr)
  if (!row) return null
  let to = Math.round(nc)
  if (isLogRow(row)) {
    const seat = seatAt(row, span, nc, t)
    // A misread river is one it thinks has a log coming under it.
    if (seat === null && nr !== c.blindRow) return null
    to = seat ?? nc
  }
  if (to < -HALF || to > s.cols - 1 + HALF) return null
  if (row.kind !== 'water' && row.trees.includes(to)) return null
  if (row.kind === 'water' && !isLogRow(row) && !row.rocks.includes(to)) return null
  return { r: nr, col: to }
}

/** The hop's time in the air is safe: the row it leaves for its first half, the row it lands on after. */
function hopSafe(c: Ctx, r: number, col: number, nr: number, ncol: number, t: number) {
  const mid = t + TICK * 1.5
  const end = t + TICK * HOP_TICKS
  const from = c.s.rows.get(r)
  if (from && from.kind === 'road' && r !== c.blindRow) {
    if (!roadClear(from, c.span, col, t, mid, c.care)) return false
    if (ncol !== col && !roadClear(from, c.span, ncol, t, mid, c.care)) return false
  }
  const to = c.s.rows.get(nr)
  if (to && to.kind === 'road' && nr !== c.blindRow) {
    if (!roadClear(to, c.span, ncol, mid, end, c.care)) return false
    if (ncol !== col && nr !== r && !roadClear(to, c.span, col, mid, end, c.care)) return false
  }
  // Landing on the tracks means standing on them next.
  return standSafe(c, nr, drifted(c, nr, ncol, end - t), end, end + TICK)
}

/** Where a rider on row `r` is after `dt` more seconds of drifting. */
function drifted(c: Ctx, r: number, col: number, dt: number) {
  const row = c.s.rows.get(r)
  if (!row || !isLogRow(row)) return col
  return col + row.dir * row.speed * dt
}

/**
 * A place and moment it could be at: how it got there (the node before, the
 * first move from where it stands, the slice the first hop is taken in) and
 * what the way there picked up and cost.
 */
type Node = {
  k: number
  r: number
  col: number
  parent: number
  first: number
  hopAt: number
  coins: number
  cost: number
}

/** What a hop costs beyond its time: a person goes straight on unless something is in the way. */
const DETOUR: Record<Dir, number> = { up: 0, left: 0.7, right: 0.7, down: 1.4 }

/**
 * The first move of the best few seconds it can see: as many new rows as it
 * can safely make, soonest, ending somewhere it could stop and still have a way
 * on from.
 */
function plan(c: Ctx): { first: number; hopAt: number } {
  const { s } = c
  const floor = Math.floor(s.cameraY) - BACK_LIMIT + 1
  const seen = new Set<number>()
  const horizon = c.stuck ? STUCK_HORIZON : HORIZON
  const reach = c.stuck ? s.cols : REACH
  const lowest = c.stuck ? floor : Math.max(floor, s.row - 1)
  const nodes: Node[] = [{ k: 0, r: s.row, col: s.col, parent: -1, first: 0, hopAt: -1, coins: 0, cost: 0 }]
  const buckets: number[][] = Array.from({ length: horizon + 1 }, () => [])
  buckets[0].push(0)
  // One visit to each place at each moment, whichever way it was reached first.
  const keyOf = (k: number, r: number, col: number) => (k * 64 + (r - s.row + 20)) * 256 + Math.round(col * 2) + 64
  const add = (n: Node) => {
    buckets[n.k].push(nodes.length)
    nodes.push(n)
  }

  for (let k = 0; k <= horizon; k++) {
    const t = k * TICK
    for (const i of buckets[k]) {
      const n = nodes[i]
      const wait = k + WAIT_TICKS
      if (wait <= horizon) {
        const col = drifted(c, n.r, n.col, WAIT_TICKS * TICK)
        const key = keyOf(wait, n.r, col)
        if (!seen.has(key) && standSafe(c, n.r, n.col, t, t + WAIT_TICKS * TICK)) {
          seen.add(key)
          add({ ...n, k: wait, col, parent: i })
        }
      }
      const land = k + HOP_TICKS
      if (land > horizon) continue
      for (let a = 1; a < ACTIONS.length; a++) {
        const dir = ACTIONS[a] as Dir
        const to = landing(c, n.r, n.col, dir, t)
        if (!to || to.r < lowest || Math.abs(to.col - s.col) > reach) continue
        const col = drifted(c, to.r, to.col, HOP_TICKS * TICK)
        const key = keyOf(land, to.r, col)
        if (seen.has(key) || !hopSafe(c, n.r, n.col, to.r, to.col, t)) continue
        seen.add(key)
        const row = s.rows.get(to.r)
        const coin = row && row.coins.includes(Math.round(to.col)) && to.r >= s.row ? 1 : 0
        add({
          k: land,
          r: to.r,
          col,
          parent: i,
          first: k === 0 ? a : n.first,
          hopAt: n.hopAt === -1 ? k : n.hopAt,
          coins: n.coins + coin,
          cost: n.cost + DETOUR[dir],
        })
      }
    }
  }

  // Somewhere is only worth making for if something safe can still follow it to
  // the edge of what it can see: a gap in the traffic with a tree in front and a
  // car coming is not a place to stop. Nodes come after the node they grew from,
  // so one pass back from the far edge marks every way that stays alive.
  const alive = new Uint8Array(nodes.length)
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i].k >= horizon - HOP_TICKS) alive[i] = 1
    if (alive[i] && nodes[i].parent >= 0) alive[nodes[i].parent] = 1
  }

  const middle = (s.cols - 1) / 2
  let best = -Infinity
  let choice = { first: 0, hopAt: -1 }
  // With nowhere to settle in sight, whatever keeps it alive longest.
  let longest = -Infinity
  let lastResort = choice
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    const t = n.k * TICK
    // The middle of the road is better than its edge.
    const v = 10 * (n.r - s.row) + 2.5 * n.coins - 1.5 * t - n.cost - 0.35 * Math.abs(n.col - middle)
    if (alive[i] && v > best && settles(c, n.r, n.col, t) && !pocket(s, n.r, n.col)) {
      best = v
      choice = { first: n.first, hopAt: n.hopAt }
    }
    if (n.k + 0.01 * v > longest) {
      longest = n.k + 0.01 * v
      lastResort = { first: n.first, hopAt: n.hopAt }
    }
  }
  return best > -Infinity ? choice : lastResort
}

function drive(s: GameState, m: Pilot, dt: number): GameState {
  const now = m.time
  m.time += dt
  if (m.blindFor > 0) m.blindFor -= dt
  else if (Math.random() < dt * 0.005 * Math.max(0, m.time - 14)) {
    // A misread: the next lane with anything moving in it looks safe for a moment.
    for (let r = s.row + 1; r <= s.row + 3; r++) {
      const row = s.rows.get(r)
      if (row && (row.kind === 'road' || row.kind === 'rail' || isLogRow(row))) {
        m.blindRow = r
        m.blindFor = 0.4 + Math.random() * 0.5
        break
      }
    }
  }
  if (s.hop || s.hopCooldown > 0 || s.queued) {
    m.airborne = true
    return s
  }

  // With the clock nearly out it takes the tighter gaps, and it stops dawdling.
  const late = s.idleTimer > stallLimitAt(s.row) - 2.5
  if (m.airborne) {
    m.airborne = false
    // A beat after landing on ground nothing can reach, and now and then a proper look from it.
    // On a road, a rail or a log the gaps are too short to dawdle in, so there it moves at once.
    const here = s.rows.get(s.row)
    const ground = !here || here.kind === 'grass' || (here.kind === 'water' && !isLogRow(here))
    if (ground && !late) {
      m.until = now + 0.03 + Math.random() * 0.09 + (Math.random() < 0.35 ? 0.15 + Math.random() * 0.45 : 0)
    }
  }
  if (now < m.until) return s

  const best = plan({
    s,
    span: laneSpan(s.cols),
    care: late ? { room: 0.03, pad: 0.01 } : { room: 0.12, pad: 0.04 },
    blindRow: m.blindFor > 0 ? m.blindRow : -1,
    stuck: s.idleTimer > STUCK,
  })
  const dir = ACTIONS[best.first]
  if (dir) return hop(s, dir)
  // Everything it can see moves on fixed lines, so the plan holds until its first hop comes due.
  m.until = now + Math.max(WAIT_TICKS, best.hopAt) * TICK - 0.001
  return s
}

export function makeSim(): Sim<GameState> {
  let m = freshPilot()
  return {
    start: (w, h) => {
      m = freshPilot()
      return newRun(w, h)
    },
    step: (s, dt) => tick(s.phase === 'playing' ? drive(s, m, dt) : s, dt),
    over: (s) => s.phase === 'gameover',
    render: (ctx, s, w, h) =>
      renderGame(
        ctx,
        {
          ...s,
          // The player's own record line and its celebration, and the words and tallies written
          // for a player, stay off the cabinet: this run is nobody's.
          target: 0,
          celebrate: 0,
          closeCall: 0,
          coinPops: [],
          runCoins: 0,
          // Once a run is over the game draws the hopper whole again under its score card; hold
          // on the end of the fall instead.
          ...(s.phase === 'gameover' ? { phase: 'dying' as const, deathAnim: 0 } : null),
        },
        w,
        h,
      ),
    // The renderer lays the board out for any size, so only a change of column count needs a new run.
    resize: (s, w, h) => {
      if (s.cols === pickCols(w, h)) return s
      m = freshPilot()
      return newRun(w, h)
    },
    // The still: a river of logs and stones ahead with a coin on it, a road behind, the hopper between.
    poster: { seed: 3, at: 36 },
    // Its renderer times its twinkles and pulses by the page's clock; the run's own keeps the still the same.
    runClock: true,
    hold: 0.7,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
