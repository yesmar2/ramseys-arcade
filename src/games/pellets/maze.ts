export type Cell = { x: number; y: number }

export type Maze = {
  cols: number
  rows: number
  /** Walkable mask — true means open. */
  open: boolean[][]
  /** Den gate tiles: open to chasers, solid to the player. */
  door: boolean[][]
  house: { minX: number; maxX: number; minY: number; maxY: number }
  houseCenter: Cell
  /** Tile just outside the gate — chasers path here on their way out. */
  ghostExit: Cell
  start: Cell
  crumbs: Cell[]
  power: Cell[]
}

const MIN_COLS = 13
const MAX_COLS = 39
const MIN_ROWS = 13
const MAX_ROWS = 31
/** Roughly how many tiles should fill the board at any aspect. */
const TARGET_TILES = 540

const STEP: Record<'up' | 'down' | 'left' | 'right', Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

function toOdd(n: number) {
  const r = Math.round(n)
  return r % 2 === 0 ? r + 1 : r
}

function clampOdd(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, toOdd(n)))
}

/** Maze size that fills the given play area without stretching tiles. */
export function mazeDims(width: number, height: number) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const aspect = Math.max(0.3, Math.min(3.4, w / h))
  const rows = clampOdd(Math.sqrt(TARGET_TILES / aspect), MIN_ROWS, MAX_ROWS)
  const cols = clampOdd(rows * aspect, MIN_COLS, MAX_COLS)
  return { cols, rows }
}

function grid(cols: number, rows: number, value: boolean) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value))
}

type Rng = () => number

/** Deterministic PRNG so the same level always rebuilds the same maze. */
function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable seed for a given level on a given board size. */
export function mazeSeed(level: number, cols: number, rows: number) {
  return (
    (Math.imul(level | 0, 2654435761) ^
      Math.imul(cols | 0, 1597334677) ^
      Math.imul(rows | 0, 3812015801)) >>>
    0
  )
}

function shuffle<T>(list: T[], rng: Rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** Randomised DFS over odd tiles, knocking out the wall between visited pairs. */
function carve(open: boolean[][], cols: number, rows: number, rng: Rng) {
  const seen = grid(cols, rows, false)
  const stack: Cell[] = [{ x: 1, y: 1 }]
  seen[1][1] = true
  open[1][1] = true

  while (stack.length) {
    const cur = stack[stack.length - 1]
    const options = shuffle(
      (['up', 'down', 'left', 'right'] as const)
        .map((dir) => ({ x: cur.x + STEP[dir].x * 2, y: cur.y + STEP[dir].y * 2 }))
        .filter((n) => n.x > 0 && n.y > 0 && n.x < cols - 1 && n.y < rows - 1 && !seen[n.y][n.x]),
      rng,
    )
    const next = options[0]
    if (!next) {
      stack.pop()
      continue
    }
    seen[next.y][next.x] = true
    open[next.y][next.x] = true
    open[(cur.y + next.y) / 2][(cur.x + next.x) / 2] = true
    stack.push(next)
  }
}

/** Mirror the left half onto the right so the board reads as a designed maze. */
function mirror(open: boolean[][], cols: number, rows: number, rng: Rng) {
  const mid = (cols - 1) / 2
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < mid; x++) {
      open[y][cols - 1 - x] = open[y][x]
    }
  }
  // Stitch the halves together on a few lanes so the seam isn't a wall.
  const lanes: number[] = []
  for (let y = 1; y < rows - 1; y += 2) lanes.push(y)
  for (const y of shuffle(lanes, rng).slice(0, Math.max(2, Math.floor(lanes.length / 3)))) {
    open[y][mid] = true
  }
}

function openNeighbours(open: boolean[][], cols: number, rows: number, x: number, y: number) {
  let count = 0
  for (const dir of ['up', 'down', 'left', 'right'] as const) {
    const nx = x + STEP[dir].x
    const ny = y + STEP[dir].y
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
    if (open[ny][nx]) count += 1
  }
  return count
}

/**
 * Loop the maze by opening one wall at every dead end. Chasers and the player
 * both flow better with no cul-de-sacs, and it keeps runs from feeling grindy.
 */
function braid(open: boolean[][], cols: number, rows: number, rng: Rng) {
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (!open[y][x]) continue
      if (openNeighbours(open, cols, rows, x, y) > 1) continue
      const options = shuffle(
        (['up', 'down', 'left', 'right'] as const)
          .map((dir) => ({ w: { x: x + STEP[dir].x, y: y + STEP[dir].y }, dir }))
          .filter(({ w, dir }) => {
            if (w.x < 1 || w.y < 1 || w.x > cols - 2 || w.y > rows - 2) return false
            if (open[w.y][w.x]) return false
            const beyond = { x: w.x + STEP[dir].x, y: w.y + STEP[dir].y }
            if (beyond.x < 0 || beyond.y < 0 || beyond.x >= cols || beyond.y >= rows) return false
            return open[beyond.y][beyond.x]
          }),
        rng,
      )
      if (options[0]) open[options[0].w.y][options[0].w.x] = true
    }
  }
}

/** Label every walkable tile with the index of the pocket it belongs to. */
function regionsOf(
  cols: number,
  rows: number,
  walkable: (x: number, y: number) => boolean,
) {
  const label: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => -1),
  )
  const sizes: number[] = []
  for (let sy = 0; sy < rows; sy++) {
    for (let sx = 0; sx < cols; sx++) {
      if (label[sy][sx] !== -1 || !walkable(sx, sy)) continue
      const id = sizes.length
      let size = 0
      const queue: Cell[] = [{ x: sx, y: sy }]
      label[sy][sx] = id
      for (let head = 0; head < queue.length; head++) {
        const cur = queue[head]
        size += 1
        for (const dir of ['up', 'down', 'left', 'right'] as const) {
          const nx = cur.x + STEP[dir].x
          const ny = cur.y + STEP[dir].y
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          if (label[ny][nx] !== -1 || !walkable(nx, ny)) continue
          label[ny][nx] = id
          queue.push({ x: nx, y: ny })
        }
      }
      sizes.push(size)
    }
  }
  return { label, sizes }
}

/**
 * Fuse the maze into one walkable pocket *without* routing through the den, by
 * knocking out single walls that touch two pockets. Anything that still can't
 * be joined gets walled off so no crumb is ever stranded.
 */
function connect(
  open: boolean[][],
  door: boolean[][],
  house: Maze['house'],
  cols: number,
  rows: number,
) {
  const penned = (x: number, y: number) =>
    door[y][x] ||
    (x >= house.minX && x <= house.maxX && y >= house.minY && y <= house.maxY)
  const walkable = (x: number, y: number) => open[y][x] && !penned(x, y)

  for (let pass = 0; pass < 120; pass++) {
    const { label, sizes } = regionsOf(cols, rows, walkable)
    if (sizes.length <= 1) return

    // Any interior wall touching two pockets is a one-tile fix.
    let bridge: Cell | null = null
    for (let y = 1; y < rows - 1 && !bridge; y++) {
      for (let x = 1; x < cols - 1 && !bridge; x++) {
        if (open[y][x] || penned(x, y)) continue
        const touching = new Set<number>()
        for (const dir of ['up', 'down', 'left', 'right'] as const) {
          const nx = x + STEP[dir].x
          const ny = y + STEP[dir].y
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          if (label[ny][nx] >= 0) touching.add(label[ny][nx])
        }
        if (touching.size >= 2) bridge = { x, y }
      }
    }
    if (bridge) {
      open[bridge.y][bridge.x] = true
      continue
    }

    // Nothing left to fuse — keep the biggest pocket, wall off the rest.
    let main = 0
    for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (label[y][x] >= 0 && label[y][x] !== main) open[y][x] = false
      }
    }
    return
  }
}

/** Carve the den, wall it in, and hang a gate on the top edge. */
function buildHouse(open: boolean[][], door: boolean[][], cols: number, rows: number) {
  const cx = (cols - 1) / 2
  const cy = (rows - 1) / 2
  const halfW = cols >= 21 ? 2 : 1
  const house = { minX: cx - halfW, maxX: cx + halfW, minY: cy - 1, maxY: cy + 1 }

  for (let y = house.minY - 1; y <= house.maxY + 1; y++) {
    for (let x = house.minX - 1; x <= house.maxX + 1; x++) {
      if (y < 0 || x < 0 || y >= rows || x >= cols) continue
      const inside =
        x >= house.minX && x <= house.maxX && y >= house.minY && y <= house.maxY
      open[y][x] = inside
    }
  }

  const gateY = house.minY - 1
  for (let x = cx - Math.min(1, halfW); x <= cx + Math.min(1, halfW); x++) {
    if (gateY < 0 || x < 0 || x >= cols) continue
    open[gateY][x] = true
    door[gateY][x] = true
  }

  // Run a lane up from the gate so the exit tile is never a one-tile island.
  const exit = { x: cx, y: Math.max(1, gateY - 1) }
  for (let y = exit.y; y >= 1; y--) {
    const wasOpen = open[y][cx]
    open[y][cx] = true
    if (wasOpen) break
  }

  return { house, houseCenter: { x: cx, y: cy }, ghostExit: exit }
}

/** Wrap-around side tunnels on a lane clear of the den. */
function cutTunnels(
  open: boolean[][],
  cols: number,
  rows: number,
  house: Maze['house'],
  rng: Rng,
) {
  const lanes: number[] = []
  for (let y = 1; y < rows - 1; y += 2) {
    if (y >= house.minY - 2 && y <= house.maxY + 2) continue
    lanes.push(y)
  }
  if (!lanes.length) return
  const picks = shuffle(lanes, rng).slice(0, rows > 21 ? 2 : 1)
  for (const y of picks) {
    open[y][0] = true
    open[y][1] = true
    open[y][cols - 1] = true
    open[y][cols - 2] = true
  }
}

/** Closest usable tile to `toward`, skipping anything `blocked` rejects. */
function nearestOpenTo(
  open: boolean[][],
  cols: number,
  rows: number,
  blocked: (x: number, y: number) => boolean,
  toward: Cell,
) {
  let best: Cell | null = null
  let bestD = Infinity
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (!open[y][x] || blocked(x, y)) continue
      const d = (x - toward.x) ** 2 + (y - toward.y) ** 2
      if (d < bestD) {
        bestD = d
        best = { x, y }
      }
    }
  }
  return best
}

/** Build a symmetric maze for this board. Same seed → same layout every time. */
export function buildMaze(cols: number, rows: number, seed = 1): Maze {
  const rng = makeRng(seed)
  const open = grid(cols, rows, false)
  const door = grid(cols, rows, false)

  carve(open, cols, rows, rng)
  mirror(open, cols, rows, rng)
  braid(open, cols, rows, rng)

  const { house, houseCenter, ghostExit } = buildHouse(open, door, cols, rows)
  cutTunnels(open, cols, rows, house, rng)
  connect(open, door, house, cols, rows)

  const inHouse = (x: number, y: number) =>
    (x >= house.minX && x <= house.maxX && y >= house.minY && y <= house.maxY) ||
    door[y][x]

  const start =
    nearestOpenTo(open, cols, rows, inHouse, { x: houseCenter.x, y: rows - 2 }) ??
    ghostExit

  const corners: Cell[] = [
    { x: 1, y: 1 },
    { x: cols - 2, y: 1 },
    { x: 1, y: rows - 2 },
    { x: cols - 2, y: rows - 2 },
  ]
  const power: Cell[] = []
  for (const corner of corners) {
    const pick = nearestOpenTo(
      open,
      cols,
      rows,
      (x, y) => inHouse(x, y) || power.some((p) => p.x === x && p.y === y),
      corner,
    )
    if (pick) power.push(pick)
  }

  const crumbs: Cell[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!open[y][x] || inHouse(x, y)) continue
      if (x === start.x && y === start.y) continue
      if (power.some((p) => p.x === x && p.y === y)) continue
      crumbs.push({ x, y })
    }
  }

  return { cols, rows, open, door, house, houseCenter, ghostExit, start, crumbs, power }
}
