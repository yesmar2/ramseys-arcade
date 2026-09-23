import { runPreview, type Sim } from '../previewKit'
import {
  bufferRowOf,
  createInitialState,
  queueDir,
  startGame,
  surgeReady,
  tick,
  triggerSurge,
  worldRowAt,
  type Dir,
  type GameState,
  type Ghost,
} from './game'
import { bufferRows } from './maze'
import { renderGame } from './render'

/*
 * Crumbtrail playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that climbs the way a person does. It reads
 * the maze a few rows ahead, heads up the corridors that keep its crumb streak
 * going, keeps off any tile a chaser could reach before it does, waits at the
 * foot of a corridor while something blocks the top, and takes a bigger risk
 * once the tide is coming. It goes for a charm, a fruit or a power crumb when
 * one is close and spends a full surge when a chaser gets near. Now and then it
 * loses track of a chaser for a moment, more often the longer it has been
 * climbing, and that is how a run ends.
 */

/**
 * Columns on the cabinet's board.
 *
 * The game picks its width from the shape of the screen, and a 4:3 cabinet gets
 * twenty columns, which at 216px wide makes an 11px tile and turns the chomper
 * and the chasers into specks. Twelve is still a real Crumbtrail board, wider
 * than a phone's ten, and it shows nine rows with the climber in the middle.
 */
const COLS = 12

/** Tiles a second: the player's pace, and the chasers' before depth and a narrow board adjust it, as the engine has them. */
const PLAYER_PACE = 5.2
const CHASER_PACE = 3.8

const DIRS: Dir[] = ['up', 'left', 'right', 'down']
const STEP: Record<Dir, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}
const BACK: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

type Pilot = {
  /** Seconds into this run. */
  time: number
  /** The tile it is making for, by world row so it survives the board scrolling. */
  goalX: number
  goalRow: number
  /** A chaser it has lost track of, or all of them at once, and for how much longer. */
  blindId: number
  blindAll: boolean
  blindFor: number
}

function freshPilot(): Pilot {
  return { time: 0, goalX: -1, goalRow: -1, blindId: -1, blindAll: false, blindFor: 0 }
}

function viewFor(w: number, h: number) {
  return { cols: COLS, rows: bufferRows(w, h, COLS) }
}

function newRun(w: number, h: number): GameState {
  const view = viewFor(w, h)
  return startGame(createInitialState(view), view)
}

function wrapX(s: GameState, x: number) {
  return ((x % s.cols) + s.cols) % s.cols
}

function openAt(s: GameState, x: number, y: number) {
  return y >= 0 && y < s.rows && s.open[y][wrapX(s, x)]
}

/** How far past the middle of its tile something is, along the way it is going; negative before it. */
function pastCentre(x: number, y: number, dir: Dir) {
  const [vx, vy] = STEP[dir]
  const along = vx !== 0 ? x : y
  return (along - (Math.floor(along) + 0.5)) * (vx + vy)
}

/**
 * When each tile could first be reached by something that can kill you.
 *
 * Every awake chaser is assumed to come straight for any tile it can get to,
 * which is more than any of them does, except that none turns straight back on
 * itself, which the engine never lets them do. A train only ever runs its row,
 * so it is timed along it. A sleeper counts from when the climb will wake it, a
 * frozen chaser from when the freeze lets go, and nothing counts while a surge
 * or the grace at the start of a run makes it harmless.
 */
function threatTimes(s: GameState, m: Pilot): Float32Array {
  const { cols, rows } = s
  const times = new Float32Array(cols * rows).fill(Infinity)
  const board = Math.max(0, Math.min(1, (cols - 10) / 8))
  const pace = CHASER_PACE * (1 + Math.min(0.22, s.depth * 0.0007)) * (0.93 + board * 0.07)
  const shield = Math.max(s.surgeTime, s.invuln - 0.2, 0)
  const queue = new Int32Array(cols * rows)
  const dist = new Float32Array(cols * rows)

  for (const g of s.ghosts) {
    if (g.mode === 'eaten' || g.id === m.blindId || m.blindAll) continue
    if (g.mode === 'frightened' && s.fright > 1.2) continue
    let delay = Math.max(shield, g.mode === 'asleep' ? 0 : s.freeze)
    if (g.mode === 'asleep') {
      // Out of reach of the climb for now; the engine wakes it five rows ahead of you.
      const rowsAway = s.player.y - g.y
      if (rowsAway > 9 || rowsAway < -2) continue
      delay = Math.max(delay, (rowsAway - 5) / PLAYER_PACE)
    }
    const gy = Math.floor(g.y)
    if (gy < 0 || gy >= rows) continue
    // Where it stands is deadly now, frozen or not: a freeze stops it moving, not biting.
    const here = g.mode === 'asleep' ? delay : shield
    for (const fy of [g.y - 0.45, g.y + 0.45]) {
      for (const fx of [g.x - 0.45, g.x + 0.45]) {
        const ty = Math.floor(fy)
        if (ty < 0 || ty >= rows) continue
        const i = ty * cols + wrapX(s, Math.floor(fx))
        if (here < times[i]) times[i] = here
      }
    }

    const sweeping = g.kind === 'train' && g.mode !== 'frightened' && (g.dir === 'left' || g.dir === 'right')
    if (sweeping) {
      const sign = STEP[g.dir][0]
      for (let x = 0; x < cols; x++) {
        const ahead = ((((x + 0.5 - g.x) * sign) % cols) + cols) % cols
        const t = delay + ahead / pace
        const i = gy * cols + x
        if (t < times[i]) times[i] = t
      }
      continue
    }
    markChaser(s, g, pace, delay, times, queue, dist)
  }
  return times
}

/** A chaser's earliest arrival at every tile it can reach, from the middle of the tile it is heading into. */
function markChaser(
  s: GameState,
  g: Ghost,
  pace: number,
  delay: number,
  times: Float32Array,
  queue: Int32Array,
  dist: Float32Array,
) {
  const { cols } = s
  let rx = Math.floor(g.x)
  let ry = Math.floor(g.y)
  let lead = 0
  const past = pastCentre(g.x, g.y, g.dir)
  if (past > 0) {
    const [vx, vy] = STEP[g.dir]
    if (openAt(s, rx + vx, ry + vy)) {
      rx = wrapX(s, rx + vx)
      ry += vy
      lead = 1 - past
    }
  } else {
    lead = -past
  }
  // One about to switch between chase and scatter, or running scared, may turn round.
  const mayTurn = g.mode === 'frightened' || g.mode === 'asleep' || s.modeTimer < 0.6
  dist.fill(-1)
  let head = 0
  let tail = 0
  const root = ry * cols + rx
  dist[root] = lead
  queue[tail++] = root
  while (head < tail) {
    const i = queue[head++]
    const x = i % cols
    const y = (i - x) / cols
    const t = delay + dist[i] / pace
    if (t < times[i]) times[i] = t
    if (dist[i] > 14) continue
    for (const d of DIRS) {
      if (i === root && !mayTurn && d === BACK[g.dir]) continue
      const [vx, vy] = STEP[d]
      if (!openAt(s, x + vx, y + vy)) continue
      const n = (y + vy) * cols + wrapX(s, x + vx)
      if (dist[n] >= 0) continue
      dist[n] = dist[i] + 1
      queue[tail++] = n
    }
  }
}

/**
 * The tile whose middle the player reaches next, which is where a turn asked
 * for now is taken, and how far off it is. The engine still takes a turn a
 * little way past the middle, so until then it is the tile the player is on.
 */
function decisionTile(s: GameState) {
  const p = s.player
  const x = Math.floor(p.x)
  const y = Math.floor(p.y)
  const past = pastCentre(p.x, p.y, p.dir)
  const [vx, vy] = STEP[p.dir]
  const blocked = !openAt(s, x + vx, y + vy)
  if (past <= 0.2 || blocked) {
    return { x, y, lead: Math.max(0, -past), ahead: false, stopped: blocked && Math.abs(past) < 0.03 }
  }
  return { x: wrapX(s, x + vx), y: y + vy, lead: 1 - past, ahead: true, stopped: false }
}

/**
 * How many tiles each open tile is from the rows ahead, going round walls and
 * ignoring chasers: the shape of the way up. It is what makes the foot of a
 * corridor worth standing at while something blocks the top of it.
 */
function wayUp(s: GameState, horizon: number): Int16Array {
  const { cols, rows } = s
  const dist = new Int16Array(cols * rows).fill(-1)
  const queue = new Int32Array(cols * rows)
  let head = 0
  let tail = 0
  for (let y = 0; y <= horizon && y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!s.open[y][x]) continue
      dist[y * cols + x] = 0
      queue[tail++] = y * cols + x
    }
  }
  while (head < tail) {
    const i = queue[head++]
    const x = i % cols
    const y = (i - x) / cols
    for (const d of DIRS) {
      const [vx, vy] = STEP[d]
      if (!openAt(s, x + vx, y + vy)) continue
      const j = (y + vy) * cols + wrapX(s, x + vx)
      if (dist[j] !== -1) continue
      dist[j] = dist[i] + 1
      queue[tail++] = j
    }
  }
  return dist
}

type Plan = { dir: Dir | null; trapped: boolean; goalX: number; goalY: number }

/**
 * Where to turn next. Every tile it can reach before anything else can is
 * scored by how near it is to the way up, what the way there eats (a fresh
 * crumb keeps the streak, a bare tile breaks it), how far it is and how much
 * room it leaves, plus anything worth having that is sitting on it; the pilot
 * heads for the best and keeps to it unless something better turns up. As the
 * stall clock runs, new ground outweighs everything else.
 */
function plan(s: GameState, m: Pilot): Plan {
  const { cols, rows } = s
  const threat = threatTimes(s, m)
  const root = decisionTile(s)
  const rootIdx = root.y * cols + root.x
  const pace = PLAYER_PACE * (s.surgeTime > 0.2 ? 1.85 : 1)
  // With the tide climbing toward it, a person takes a gap they would otherwise wait out.
  const tideGap = worldRowAt(s, s.player.y - 0.5) - s.tide
  const nerve = Math.max(
    0.8 * Math.max(0, Math.min(1, (4.5 - tideGap) / 3)),
    Math.max(0, Math.min(0.4, (s.stall - 2) * 0.25)),
  )
  const margin = 0.32 - nerve

  // Heading into a tile something will reach first: turn round now.
  if (root.ahead && threat[rootIdx] < root.lead / pace + margin) {
    return { dir: BACK[s.player.dir], trapped: false, goalX: -1, goalY: -1 }
  }

  const n = cols * rows
  const dist = new Int16Array(n).fill(-1)
  const gain = new Float32Array(n)
  const first = new Int8Array(n).fill(-1)
  const queue = new Int32Array(n)
  const tideY = bufferRowOf(s, s.tide)
  let head = 0
  let tail = 0
  dist[rootIdx] = 0
  queue[tail++] = rootIdx

  while (head < tail) {
    const i = queue[head++]
    const x = i % cols
    const y = (i - x) / cols
    if (dist[i] >= 24) continue
    for (let k = 0; k < DIRS.length; k++) {
      const [vx, vy] = STEP[DIRS[k]]
      const ny = y + vy
      if (!openAt(s, x + vx, ny)) continue
      // Nothing under the tide or close enough above it to be taken.
      if (ny >= tideY - 1.2) continue
      const nx = wrapX(s, x + vx)
      const j = ny * cols + nx
      const d = dist[i] + 1
      if (threat[j] < (root.lead + d) / pace + margin) continue
      // Of two equally short ways, the one that eats more.
      const g = gain[i] + (s.crumbs[ny][nx] || s.power[ny][nx] ? 1 : -0.5)
      if (dist[j] === -1) {
        dist[j] = d
        gain[j] = g
        first[j] = i === rootIdx ? k : first[i]
        queue[tail++] = j
      } else if (dist[j] === d && g > gain[j]) {
        gain[j] = g
        first[j] = i === rootIdx ? k : first[i]
      }
    }
  }

  const yMax = Math.round(bufferRowOf(s, s.baseRow + s.depth))
  const up = wayUp(s, Math.max(0, yMax - 5))
  const hurry = Math.max(0, Math.min(1, (s.stall - 0.8) / 1.2))
  const fruit = s.fruit
  const charm = s.charm
  let best = -Infinity
  let bestIdx = -1
  for (let k = 0; k < tail; k++) {
    const i = queue[k]
    // Staying put is only a choice for a player stopped against a wall; one on the move keeps moving.
    if (i === rootIdx && !root.stopped) continue
    const x = i % cols
    const y = (i - x) / cols
    const d = dist[i]
    const t = (root.lead + d) / pace
    const climb = up[i] < 0 ? 40 : up[i]
    let v = -(1 + 2 * hurry) * climb + 0.3 * (1 - hurry) * gain[i] - (0.4 + 0.3 * hurry) * d
    if (y < yMax) v += 1.5 * hurry
    // Rather a tile nothing is close to reaching.
    v += 0.35 * Math.min(2, threat[i] - t)
    if (s.power[y][x]) v += 4
    if (fruit && Math.floor(fruit.x) === x && Math.floor(fruit.y) === y && fruit.life > t + 0.4) v += 3.5
    if (charm && Math.floor(charm.x) === x && Math.floor(charm.y) === y && charm.life > t + 0.4) v += 4.5
    if (x === m.goalX && worldRowAt(s, y) === m.goalRow) v += 1
    if (v > best) {
      best = v
      bestIdx = i
    }
  }
  if (bestIdx === rootIdx) return { dir: null, trapped: false, goalX: root.x, goalY: root.y }

  if (bestIdx === -1) {
    // Nowhere safe to go: whichever way keeps furthest ahead of what is coming.
    let dir: Dir | null = null
    let room = -Infinity
    const cx = Math.floor(s.player.x)
    const cy = Math.floor(s.player.y)
    for (const d of DIRS) {
      const [vx, vy] = STEP[d]
      if (!openAt(s, cx + vx, cy + vy)) continue
      const r = threat[(cy + vy) * cols + wrapX(s, cx + vx)]
      if (r > room) {
        room = r
        dir = d
      }
    }
    return { dir, trapped: true, goalX: -1, goalY: -1 }
  }
  const gx = bestIdx % cols
  return { dir: DIRS[first[bestIdx]], trapped: false, goalX: gx, goalY: (bestIdx - gx) / cols }
}

/** Lapses a second, `time` into a run: none at first, then more and more. */
function lapseRate(time: number) {
  const t = Math.max(0, time - 10)
  return 0.004 * t + 0.0001 * t * t
}

function drive(s: GameState, m: Pilot, dt: number): GameState {
  m.time += dt
  if (m.blindFor > 0) {
    m.blindFor -= dt
    if (m.blindFor <= 0) {
      m.blindId = -1
      m.blindAll = false
    }
  } else if (Math.random() < dt * lapseRate(m.time)) {
    // A lapse: a chaser slips out of mind for a moment, more often the longer the climb has gone
    // on, and most often the one closest, which is the one a person is busy dodging. Deep into a
    // long climb it can be the whole board at once.
    const p = s.player
    const awake = s.ghosts
      .filter((g) => g.mode === 'chase' || g.mode === 'scatter')
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
    if (awake.length) {
      m.blindId = awake[Math.random() < 0.6 ? 0 : Math.floor(Math.random() * awake.length)].id
      m.blindAll = Math.random() < (m.time - 60) / 60
      m.blindFor = 0.5 + Math.random() * 0.8
    }
  }

  const choice = plan(s, m)
  if (choice.goalX >= 0) {
    m.goalX = choice.goalX
    m.goalRow = worldRowAt(s, choice.goalY)
  }
  let next = s
  if (surgeReady(next)) {
    // Spent when a chaser is close or there is nowhere left to go, and now and then just to go faster.
    const p = next.player
    const near = next.ghosts.some(
      (g) => (g.mode === 'chase' || g.mode === 'scatter') && Math.abs(g.x - p.x) + Math.abs(g.y - p.y) < 2.6,
    )
    if (choice.trapped || near || Math.random() < dt * 0.06) next = triggerSurge(next)
  }
  // Asking for the way it is already going clears a turn it no longer wants.
  const dir = choice.dir ?? (next.player.pending ? next.player.dir : null)
  if (dir && dir !== next.player.pending && (dir !== next.player.dir || next.player.pending)) {
    next = queueDir(next, dir)
  }
  return next
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
          // The words that float up for a player (points, the multiplier, a lost streak, the row
          // landmarks) are the readout's job, and at a cabinet's size they only cover the maze.
          pops: [],
          // Once a run is over the game draws the chomper whole again under its score card; hold
          // on the end of the fall instead.
          ...(s.phase === 'gameover' ? { phase: 'dying' as const, deathAnim: 0 } : null),
        },
        w,
        h,
      ),
    // The board's width is fixed and its height follows the shape of the screen, so a new size
    // of the same shape keeps the run going.
    resize: (s, w, h) => {
      const view = viewFor(w, h)
      if (view.rows === s.rows && view.cols === s.cols) return s
      m = freshPilot()
      return newRun(w, h)
    },
    warmup: 6,
    hold: 1,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
