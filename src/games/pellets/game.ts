import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'dying' | 'clearing' | 'gameover'
export type GhostMode = 'chase' | 'scatter' | 'frightened' | 'eaten'

export type Cell = { x: number; y: number }

export type GhostKind = 'blink' | 'pink' | 'inky' | 'clyde'

export type Ghost = {
  kind: GhostKind
  x: number
  y: number
  dir: Dir
  mode: GhostMode
  /** Home corner for scatter. */
  corner: Cell
  /** Eyes-only return target when eaten. */
  eaten: boolean
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  lives: number
  level: number
  pelletsLeft: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  lives: number
  level: number
  cols: number
  rows: number
  /** Walkable mask — true means open. */
  open: boolean[][]
  pellets: boolean[][]
  power: boolean[][]
  pelletsLeft: number
  player: { x: number; y: number; dir: Dir; pending: Dir | null }
  ghosts: Ghost[]
  /** Seconds of frightened mode remaining. */
  fright: number
  /** Ghosts eaten this fright streak (for score ladder). */
  frightEaten: number
  /** Mode timer for chase/scatter cycle. */
  modeTimer: number
  /** Current global mode when not frightened. */
  mode: 'chase' | 'scatter'
  deathAnim: number
  clearAnim: number
  invuln: number
  mouth: number
  startPos: Cell
  ghostHome: Cell
  /** Tile just outside the den door — chasers path here to leave. */
  ghostExit: Cell
  house: { minX: number; maxX: number; minY: number; maxY: number }
  /** Active maze strings for this orientation. */
  maze: string[]
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

const DIRS: Dir[] = ['up', 'left', 'down', 'right']

/**
 * Maze legend: `#` wall, `.` crumb, `o` power, ` ` empty path,
 * `=` house door, `P` player, `G` chaser spawn.
 * Landscape base — portrait is this rotated 90° CW (taller on phones).
 */
const MAZE_LANDSCAPE = [
  '###########################',
  '#o.......................o#',
  '#..###.###.##.##.###.###..#',
  '#..........##.##..........#',
  '#..###.###.......###.###..#',
  '#..###....##===##....###..#',
  '          # GGG #          ',
  '#..###....#######....###..#',
  '#..###.###.......###.###..#',
  '#..........##.##..........#',
  '#..###.###.##.##.###.###..#',
  '#o...........P...........o#',
  '###########################',
]

/** Rotate maze 90° clockwise so the long side matches a tall phone. */
function rotateMazeCW(rows: string[]): string[] {
  const R = rows.length
  const C = rows[0]?.length ?? 0
  const out: string[] = []
  for (let c = 0; c < C; c++) {
    let line = ''
    for (let r = R - 1; r >= 0; r--) line += rows[r][c] ?? '#'
    out.push(line)
  }
  return out
}

const MAZE_PORTRAIT = rotateMazeCW(MAZE_LANDSCAPE)

export const COLS = MAZE_LANDSCAPE[0].length
export const ROWS = MAZE_LANDSCAPE.length

export function pelletsPortrait(): boolean {
  return typeof window !== 'undefined' && window.innerHeight > window.innerWidth
}

export function pelletsMaze(portrait = pelletsPortrait()): string[] {
  return portrait ? MAZE_PORTRAIT : MAZE_LANDSCAPE
}

const SCORE_PELLET = 10
const SCORE_POWER = 50
const SCORE_GHOST = [200, 400, 800, 1600]
const START_LIVES = 3
const FRIGHT_TIME = 6
const PLAYER_SPEED = 6.2
const GHOST_SPEED = 5.4
const FRIGHT_SPEED = 3.6
const EATEN_SPEED = 9
const DEATH_TIME = 0.85
const CLEAR_TIME = 1.4
const RESPAWN_INVULN = 1.2

function loadBest() {
  return getPersonalBest('pellets')
}

function wrapAxis(v: number, span: number) {
  if (v < -0.5) return span - 0.5
  if (v >= span - 0.5) return -0.5
  return v
}

function cellOf(x: number, y: number): Cell {
  return { x: Math.floor(x), y: Math.floor(y) }
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  return (ax - bx) ** 2 + (ay - by) ** 2
}

function mazeAt(maze: string[], x: number, y: number) {
  return maze[y]?.[x] ?? '#'
}

function parseMaze(maze: string[]) {
  const rows = maze.length
  const cols = maze[0]?.length ?? 0
  const open: boolean[][] = []
  const pellets: boolean[][] = []
  const power: boolean[][] = []
  let pelletsLeft = 0
  let startPos: Cell = { x: Math.floor(cols / 2), y: rows - 2 }
  const ghostSpawns: Cell[] = []
  const doorCells: Cell[] = []
  let ghostHome: Cell = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) }
  let house = { minX: 0, maxX: cols - 1, minY: 0, maxY: rows - 1 }

  for (let y = 0; y < rows; y++) {
    open[y] = []
    pellets[y] = []
    power[y] = []
    const line = maze[y] ?? '#'.repeat(cols)
    for (let x = 0; x < cols; x++) {
      const ch = line[x] ?? '#'
      open[y][x] = ch !== '#'
      pellets[y][x] = false
      power[y][x] = false
      if (ch === '.') {
        pellets[y][x] = true
        pelletsLeft += 1
      } else if (ch === 'o') {
        power[y][x] = true
      }
      if (ch === 'P') startPos = { x, y }
      if (ch === 'G') ghostSpawns.push({ x, y })
      if (ch === '=') doorCells.push({ x, y })
    }
  }

  if (ghostSpawns.length) {
    const sx = Math.round(ghostSpawns.reduce((s, c) => s + c.x, 0) / ghostSpawns.length)
    const sy = Math.round(ghostSpawns.reduce((s, c) => s + c.y, 0) / ghostSpawns.length)
    ghostHome = { x: sx, y: sy }
  }

  const houseCells = [...ghostSpawns, ...doorCells]
  if (houseCells.length) {
    house = {
      minX: Math.min(...houseCells.map((c) => c.x)),
      maxX: Math.max(...houseCells.map((c) => c.x)),
      minY: Math.min(...houseCells.map((c) => c.y)),
      maxY: Math.max(...houseCells.map((c) => c.y)),
    }
  }

  // Exit = open tile adjacent to a door that sits outside the den interior.
  let ghostExit: Cell = { x: ghostHome.x, y: Math.max(1, ghostHome.y - 2) }
  let exitDist = -1
  for (const door of doorCells) {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const ex = door.x + dx
      const ey = door.y + dy
      if (ey < 0 || ey >= rows || ex < 0 || ex >= cols) continue
      if (!open[ey][ex]) continue
      const ch = mazeAt(maze, ex, ey)
      if (ch === 'G' || ch === '=') continue
      const d = dist2(ex, ey, ghostHome.x, ghostHome.y)
      if (d > exitDist) {
        exitDist = d
        ghostExit = { x: ex, y: ey }
      }
    }
  }

  return {
    maze,
    cols,
    rows,
    open,
    pellets,
    power,
    pelletsLeft,
    startPos,
    ghostSpawns,
    ghostHome,
    ghostExit,
    house,
  }
}

function canEnter(state: GameState, x: number, y: number, asGhost: boolean) {
  const c = ((Math.floor(x) % state.cols) + state.cols) % state.cols
  const r = ((Math.floor(y) % state.rows) + state.rows) % state.rows
  // Only wrap through open tunnel edges — otherwise out of bounds is blocked.
  const wrappedX = Math.floor(x) !== c
  const wrappedY = Math.floor(y) !== r
  if (!wrappedX && (Math.floor(x) < 0 || Math.floor(x) >= state.cols)) return false
  if (!wrappedY && (Math.floor(y) < 0 || Math.floor(y) >= state.rows)) return false
  if (wrappedY && Math.floor(y) < 0 && !state.open[0]?.[c]) return false
  if (wrappedY && Math.floor(y) >= state.rows && !state.open[state.rows - 1]?.[c]) return false
  if (!state.open[r][c]) return false
  const ch = mazeAt(state.maze, c, r)
  if (ch === '=' && !asGhost) return false
  return true
}

function atCenter(v: number) {
  // Must be tighter than one frame of travel, or actors snap back and never leave.
  return Math.abs(v - Math.floor(v) - 0.5) < 0.05
}

function snapCenter(v: number) {
  return Math.floor(v) + 0.5
}

/** Distance along `dir` from position `p` to the next tile center. */
function distToNextCenter(p: number, delta: number) {
  if (delta > 0) {
    const target = Math.floor(p + 0.5) + 0.5
    return Math.max(0.0001, target - p)
  }
  if (delta < 0) {
    const target = Math.ceil(p - 0.5) - 0.5
    return Math.max(0.0001, p - target)
  }
  return 1
}

function ghostCorners(cols: number, rows: number): Record<GhostKind, Cell> {
  return {
    blink: { x: cols - 2, y: 1 },
    pink: { x: 1, y: 1 },
    inky: { x: cols - 2, y: rows - 2 },
    clyde: { x: 1, y: rows - 2 },
  }
}

function makeGhosts(spawns: Cell[], cols: number, rows: number): Ghost[] {
  const kinds: GhostKind[] = ['blink', 'pink', 'inky', 'clyde']
  const corners = ghostCorners(cols, rows)
  const dirs: Dir[] = ['left', 'up', 'down', 'right']
  return kinds.map((kind, i) => {
      const spawn = spawns[i] ?? spawns[0] ?? { x: Math.floor(cols / 2), y: Math.floor(rows / 2) }
    return {
      kind,
      x: spawn.x + 0.5,
      y: spawn.y + 0.5,
      dir: dirs[i] ?? 'left',
      mode: 'scatter',
      corner: corners[kind],
      eaten: false,
    }
  })
}

function refillPellets(state: GameState) {
  let left = 0
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const ch = mazeAt(state.maze, x, y)
      state.pellets[y][x] = false
      state.power[y][x] = false
      if (ch === '.') {
        state.pellets[y][x] = true
        left += 1
      } else if (ch === 'o') {
        state.power[y][x] = true
      }
    }
  }
  state.pelletsLeft = left
}

function resetActors(state: GameState) {
  state.player.x = state.startPos.x + 0.5
  state.player.y = state.startPos.y + 0.5
  state.player.dir = 'left'
  state.player.pending = null
  const kinds: GhostKind[] = ['blink', 'pink', 'inky', 'clyde']
  const parsed = parseMaze(state.maze)
  state.ghosts = makeGhosts(parsed.ghostSpawns, state.cols, state.rows).map((g, i) => ({
    ...g,
    kind: kinds[i],
    mode: state.mode,
    eaten: false,
  }))
  state.fright = 0
  state.frightEaten = 0
  state.invuln = RESPAWN_INVULN
}

export function createInitialState(portrait = pelletsPortrait()): GameState {
  const parsed = parseMaze(pelletsMaze(portrait))
  const state: GameState = {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    lives: START_LIVES,
    level: 1,
    cols: parsed.cols,
    rows: parsed.rows,
    maze: parsed.maze,
    open: parsed.open,
    pellets: parsed.pellets,
    power: parsed.power,
    pelletsLeft: parsed.pelletsLeft,
    player: {
      x: parsed.startPos.x + 0.5,
      y: parsed.startPos.y + 0.5,
      dir: 'left',
      pending: null,
    },
    ghosts: makeGhosts(parsed.ghostSpawns, parsed.cols, parsed.rows),
    fright: 0,
    frightEaten: 0,
    modeTimer: 7,
    mode: 'scatter',
    deathAnim: 0,
    clearAnim: 0,
    invuln: 0,
    mouth: 0,
    startPos: parsed.startPos,
    ghostHome: parsed.ghostHome,
    ghostExit: parsed.ghostExit,
    house: parsed.house,
  }
  return state
}

export function startGame(prev: GameState, portrait = pelletsPortrait()): GameState {
  const next = createInitialState(portrait)
  next.best = Math.max(prev.best, loadBest())
  next.phase = 'playing'
  next.invuln = RESPAWN_INVULN
  return next
}

export function queueDir(state: GameState, dir: Dir): GameState {
  if (state.phase === 'menu') return state
  if (state.phase !== 'playing') return state
  return { ...state, player: { ...state.player, pending: dir } }
}

function levelSpeed(level: number) {
  return 1 + Math.min(0.45, (level - 1) * 0.06)
}

function targetFor(ghost: Ghost, state: GameState): Cell {
  if (ghost.eaten || ghost.mode === 'eaten') {
    return { x: state.ghostHome.x, y: state.ghostHome.y }
  }
  if (ghost.mode === 'frightened') {
    // Pick a far random open tile.
    return {
      x: Math.floor(Math.random() * state.cols),
      y: Math.floor(Math.random() * state.rows),
    }
  }
  if (ghost.mode === 'scatter') return ghost.corner

  const px = Math.floor(state.player.x)
  const py = Math.floor(state.player.y)
  const v = VEC[state.player.dir]
  if (ghost.kind === 'blink') return { x: px, y: py }
  if (ghost.kind === 'pink') return { x: px + v.x * 4, y: py + v.y * 4 }
  if (ghost.kind === 'inky') {
    const blink = state.ghosts.find((g) => g.kind === 'blink')
    const ax = px + v.x * 2
    const ay = py + v.y * 2
    if (!blink) return { x: ax, y: ay }
    return { x: ax * 2 - Math.floor(blink.x), y: ay * 2 - Math.floor(blink.y) }
  }
  // Clyde: chase unless close, then scatter.
  if (dist2(ghost.x, ghost.y, state.player.x, state.player.y) < 64) return ghost.corner
  return { x: px, y: py }
}

function ghostChoices(state: GameState, ghost: Ghost): Dir[] {
  const cx = Math.floor(ghost.x)
  const cy = Math.floor(ghost.y)
  const opts: Dir[] = []
  for (const dir of DIRS) {
    if (dir === OPPOSITE[ghost.dir] && ghost.mode !== 'frightened' && !ghost.eaten) continue
    const n = VEC[dir]
    const nx = cx + n.x
    const ny = cy + n.y
    const wx = ((nx % state.cols) + state.cols) % state.cols
    const wy = ((ny % state.rows) + state.rows) % state.rows
    if (ny < 0 || ny >= state.rows) {
      // Vertical tunnel wrap
      if (!state.open[wy]?.[wx]) continue
    } else if (nx < 0 || nx >= state.cols) {
      if (!state.open[wy]?.[wx]) continue
    } else if (!state.open[ny][wx]) {
      continue
    }
    const ch = mazeAt(state.maze, wx, wy)
    if (ch === '=') {
      const { house } = state
      const inBox =
        cx >= house.minX && cx <= house.maxX && cy >= house.minY && cy <= house.maxY
      if (ghost.mode === 'eaten' || ghost.eaten) {
        /* allow enter */
      } else if (inBox) {
        /* allow leave / shuffle */
      } else continue
    }
    opts.push(dir)
  }
  if (opts.length === 0) {
    for (const dir of DIRS) {
      const n = VEC[dir]
      const wx = ((((cx + n.x) % state.cols) + state.cols) % state.cols)
      const wy = ((((cy + n.y) % state.rows) + state.rows) % state.rows)
      const ny = cy + n.y
      const nx = cx + n.x
      if (ny >= 0 && ny < state.rows && nx >= 0 && nx < state.cols) {
        if (state.open[ny][wx]) opts.push(dir)
      } else if (state.open[wy]?.[wx]) {
        opts.push(dir)
      }
    }
  }
  return opts
}

function inHouse(state: GameState, gx: number, gy: number) {
  const { house } = state
  return gx >= house.minX && gx <= house.maxX && gy >= house.minY && gy <= house.maxY
}

function pickGhostDir(state: GameState, ghost: Ghost): Dir {
  const opts = ghostChoices(state, ghost)
  if (opts.length === 0) return ghost.dir

  const gx = Math.floor(ghost.x)
  const gy = Math.floor(ghost.y)

  // Leave the den toward the exit tile.
  if (inHouse(state, gx, gy) && !ghost.eaten && ghost.mode !== 'eaten') {
    let best: Dir = opts[0]
    let bestD = Infinity
    for (const dir of opts) {
      const n = VEC[dir]
      const d = dist2(gx + n.x + 0.5, gy + n.y + 0.5, state.ghostExit.x + 0.5, state.ghostExit.y + 0.5)
      if (d < bestD) {
        bestD = d
        best = dir
      }
    }
    return best
  }

  if (ghost.mode === 'frightened' && !ghost.eaten) {
    return opts[Math.floor(Math.random() * opts.length)]
  }
  const target = targetFor(ghost, state)
  let best = opts[0]
  let bestD = Infinity
  for (const dir of opts) {
    const n = VEC[dir]
    const nx = Math.floor(ghost.x) + n.x + 0.5
    const ny = Math.floor(ghost.y) + n.y + 0.5
    const d = dist2(nx, ny, target.x + 0.5, target.y + 0.5)
    if (d < bestD) {
      bestD = d
      best = dir
    }
  }
  return best
}

function moveActor(
  state: GameState,
  x: number,
  y: number,
  dir: Dir,
  pending: Dir | null,
  speed: number,
  dt: number,
  asGhost: boolean,
): { x: number; y: number; dir: Dir; pending: Dir | null } {
  let px = x
  let py = y
  let d = dir
  let pend = pending
  let left = speed * dt

  // Player may reverse immediately — classic feel, avoids feeling stuck.
  if (!asGhost && pend === OPPOSITE[d]) {
    d = pend
    pend = null
  }

  while (left > 0.0001) {
    if (atCenter(px) && atCenter(py)) {
      px = snapCenter(px)
      py = snapCenter(py)
      if (pend) {
        const n = VEC[pend]
        const tx = Math.floor(px) + n.x
        const ty = Math.floor(py) + n.y
        if (canEnter(state, tx + 0.5, ty + 0.5, asGhost)) {
          d = pend
          pend = null
        }
      }
      {
        const n = VEC[d]
        const tx = Math.floor(px) + n.x
        const ty = Math.floor(py) + n.y
        if (!canEnter(state, tx + 0.5, ty + 0.5, asGhost)) {
          return { x: px, y: py, dir: d, pending: pend }
        }
      }
    }

    const n = VEC[d]
    const distToNext =
      n.x !== 0 ? distToNextCenter(px, n.x) : distToNextCenter(py, n.y)
    const step = Math.min(left, distToNext)
    px += n.x * step
    py += n.y * step
    // Tunnel wrap only when both edges of that lane are open.
    {
      const row = ((Math.floor(py) % state.rows) + state.rows) % state.rows
      if (
        (px < -0.5 || px >= state.cols - 0.5) &&
        state.open[row]?.[0] &&
        state.open[row]?.[state.cols - 1]
      ) {
        px = wrapAxis(px, state.cols)
      }
      const col = ((Math.floor(px) % state.cols) + state.cols) % state.cols
      if (
        (py < -0.5 || py >= state.rows - 0.5) &&
        state.open[0]?.[col] &&
        state.open[state.rows - 1]?.[col]
      ) {
        py = wrapAxis(py, state.rows)
      }
    }
    left -= step

    if (atCenter(px) && atCenter(py)) {
      px = snapCenter(px)
      py = snapCenter(py)
    }
  }

  return { x: px, y: py, dir: d, pending: pend }
}

function eatAt(state: GameState) {
  const c = cellOf(state.player.x, state.player.y)
  const x = ((c.x % state.cols) + state.cols) % state.cols
  const y = c.y
  if (y < 0 || y >= state.rows) return
  if (state.pellets[y][x]) {
    state.pellets[y][x] = false
    state.pelletsLeft -= 1
    state.score += SCORE_PELLET
    sfx('eat')
  }
  if (state.power[y][x]) {
    state.power[y][x] = false
    state.score += SCORE_POWER
    state.fright = Math.max(FRIGHT_TIME * 0.55, FRIGHT_TIME - (state.level - 1) * 0.35)
    state.frightEaten = 0
    for (const g of state.ghosts) {
      if (!g.eaten) {
        g.mode = 'frightened'
        g.dir = OPPOSITE[g.dir]
      }
    }
    sfx('wave')
  }
}

export function tick(state: GameState, dt: number): GameState {
  if (state.phase === 'menu' || state.phase === 'gameover') {
    return { ...state, mouth: state.mouth + dt }
  }

  const next: GameState = {
    ...state,
    pellets: state.pellets.map((row) => row.slice()),
    power: state.power.map((row) => row.slice()),
    ghosts: state.ghosts.map((g) => ({ ...g })),
    player: { ...state.player },
    mouth: state.mouth + dt * 10,
    invuln: Math.max(0, state.invuln - dt),
  }

  if (next.phase === 'dying') {
    next.deathAnim -= dt
    if (next.deathAnim <= 0) {
      next.lives -= 1
      if (next.lives <= 0) {
        next.phase = 'gameover'
        next.best = Math.max(next.best, next.score, loadBest())
        sfx('die')
      } else {
        resetActors(next)
        next.phase = 'playing'
        next.deathAnim = 0
      }
    }
    return next
  }

  if (next.phase === 'clearing') {
    next.clearAnim -= dt
    if (next.clearAnim <= 0) {
      next.level += 1
      refillPellets(next)
      resetActors(next)
      next.phase = 'playing'
      next.clearAnim = 0
      next.mode = 'scatter'
      next.modeTimer = 7
      sfx('wave')
    }
    return next
  }

  // Chase / scatter cycle.
  if (next.fright <= 0) {
    next.modeTimer -= dt
    if (next.modeTimer <= 0) {
      next.mode = next.mode === 'scatter' ? 'chase' : 'scatter'
      next.modeTimer = next.mode === 'scatter' ? 7 : 20
      for (const g of next.ghosts) {
        if (!g.eaten && g.mode !== 'frightened') {
          g.mode = next.mode
          g.dir = OPPOSITE[g.dir]
        }
      }
    }
  } else {
    next.fright -= dt
    if (next.fright <= 0) {
      next.fright = 0
      for (const g of next.ghosts) {
        if (!g.eaten) g.mode = next.mode
      }
    }
  }

  const spd = levelSpeed(next.level)
  const turnBoost = next.player.pending ? 1.4 : 1
  const moved = moveActor(
    next,
    next.player.x,
    next.player.y,
    next.player.dir,
    next.player.pending,
    PLAYER_SPEED * spd * turnBoost,
    dt,
    false,
  )
  next.player.x = moved.x
  next.player.y = moved.y
  next.player.dir = moved.dir
  next.player.pending = moved.pending
  eatAt(next)

  if (next.pelletsLeft <= 0 && !next.power.some((row) => row.some(Boolean))) {
    next.phase = 'clearing'
    next.clearAnim = CLEAR_TIME
    sfx('good')
    return next
  }

  for (const ghost of next.ghosts) {
    if (atCenter(ghost.x) && atCenter(ghost.y)) {
      ghost.x = snapCenter(ghost.x)
      ghost.y = snapCenter(ghost.y)
      ghost.dir = pickGhostDir(next, ghost)
    }
    const gSpeed = ghost.eaten
      ? EATEN_SPEED
      : ghost.mode === 'frightened'
        ? FRIGHT_SPEED
        : GHOST_SPEED * spd
    let gm = moveActor(next, ghost.x, ghost.y, ghost.dir, null, gSpeed, dt, true)
    // If blocked at a center (bad reverse after mode flip), re-pick and nudge.
    if (
      atCenter(gm.x) &&
      atCenter(gm.y) &&
      Math.hypot(gm.x - ghost.x, gm.y - ghost.y) < 0.0001
    ) {
      ghost.dir = pickGhostDir(next, { ...ghost, x: gm.x, y: gm.y, dir: gm.dir })
      gm = moveActor(next, gm.x, gm.y, ghost.dir, null, gSpeed, dt, true)
    }
    ghost.x = gm.x
    ghost.y = gm.y
    ghost.dir = gm.dir

    // Returned home?
    if (ghost.eaten && dist2(ghost.x, ghost.y, next.ghostHome.x + 0.5, next.ghostHome.y + 0.5) < 0.35) {
      ghost.eaten = false
      ghost.mode = next.fright > 0 ? 'frightened' : next.mode
    }
  }

  // Collisions.
  if (next.invuln <= 0) {
    for (const ghost of next.ghosts) {
      if (dist2(ghost.x, ghost.y, next.player.x, next.player.y) > 0.55) continue
      if (ghost.eaten) continue
      if (ghost.mode === 'frightened') {
        ghost.eaten = true
        ghost.mode = 'eaten'
        const bonus = SCORE_GHOST[Math.min(next.frightEaten, SCORE_GHOST.length - 1)]
        next.frightEaten += 1
        next.score += bonus
        sfx('good')
      } else {
        next.phase = 'dying'
        next.deathAnim = DEATH_TIME
        sfx('hurt')
        break
      }
    }
  }

  return next
}

export function toSnapshot(state: GameState): Snapshot {
  return {
    score: state.score,
    best: Math.max(state.best, loadBest()),
    phase: state.phase,
    lives: state.lives,
    level: state.level,
    pelletsLeft: state.pelletsLeft,
  }
}

export function mazeChar(state: GameState, x: number, y: number) {
  return mazeAt(state.maze, x, y)
}
