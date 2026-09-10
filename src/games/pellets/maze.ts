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

/**
 * Canonical landscape size. Portrait is this rotated 90° CW so phone and
 * desktop share the same maze — just flipped.
 *
 * Legend: `#` wall, `.` crumb, `o` power, ` ` path (auto crumb),
 * `=` house door, `P` player, `G` chaser spawn.
 */
const LAND_COLS = 27
const LAND_ROWS = 15

/** Display size for the current orientation. */
export function mazeDims(width: number, height: number) {
  if (height > width) return { cols: LAND_ROWS, rows: LAND_COLS }
  return { cols: LAND_COLS, rows: LAND_ROWS }
}

export function landscapeMazeSize() {
  return { cols: LAND_COLS, rows: LAND_ROWS }
}

/**
 * Shared mid band — den + the ring around it. Built as loops so chasers and
 * the player always have a way through (no one-dot stubs).
 */
const MID = [
  '#.####.#...........#.####.#',
  '#.#....#...........#....#.#',
  '#.#.##......#=#......##.#.#',
  '#.#.##.#####GGG#####.##.#.#',
  '#.#....#....###....#....#.#',
  '#.####.#...........#.####.#',
] as const

/**
 * Hand-picked landscape mazes. Each level adds a little more structure while
 * keeping corridors on loops — dead-end stubs are sealed after parse.
 */
const LEVEL_MAZES: string[][] = [
  // 1 — open ring, easy read
  [
    '###########################',
    '#o.......................o#',
    '#.##.######.#.#.######.##.#',
    '#.##.#......#.#......#.##.#',
    '#....#.######.######.#....#',
    ...MID,
    '#............P............#',
    '#.##.######.#.#.######.##.#',
    '#o.......................o#',
    '###########################',
  ],
  // 2 — side pockets that still reconnect
  [
    '###########################',
    '#o....#.............#....o#',
    '#.###.#.#####.#####.#.###.#',
    '#.#.....................#.#',
    '#.#.##.######.######.##.#.#',
    ...MID,
    '#.#..........P..........#.#',
    '#.###.#.#####.#####.#.###.#',
    '#o....#.............#....o#',
    '###########################',
  ],
  // 3 — longer side runs
  [
    '###########################',
    '#o.......................o#',
    '#.###.#####.###.#####.###.#',
    '#.#.#...............#.#.#.#',
    '#.#.#.######.######.#.#.#.#',
    ...MID,
    '#............P............#',
    '#.###.#####.###.#####.###.#',
    '#o.......................o#',
    '###########################',
  ],
  // 4 — tighter top/bottom cages
  [
    '###########################',
    '#o.......................o#',
    '#.##.#####.#####.#####.##.#',
    '#.##...................##.#',
    '#.####.#####.#####.####.#.#',
    ...MID,
    '#............P............#',
    '#.##.#####.#####.#####.##.#',
    '#o.......................o#',
    '###########################',
  ],
  // 5 — more interior walls
  [
    '###########################',
    '#o......#.........#......o#',
    '#.#####.#.#######.#.#####.#',
    '#.#...................#.#.#',
    '#.#.###.######.######.#.#.#',
    ...MID,
    '#.#..........P..........#.#',
    '#.#####.#.#######.#.#####.#',
    '#o......#.........#......o#',
    '###########################',
  ],
  // 6+ — densest, still looped
  [
    '###########################',
    '#o..##.............##....o#',
    '#.#.##.##.#####.##.##.#.#.#',
    '#.#....##.......##....#.#.#',
    '#.#####.##.....##.#####.#.#',
    ...MID,
    '#.#....##...P...##....#.#.#',
    '#.#.##.##.#####.##.##.#.#.#',
    '#o..##.............##....o#',
    '###########################',
  ],
]

function grid(cols: number, rows: number, value: boolean) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value))
}

function mazeAt(rows: string[], x: number, y: number) {
  return rows[y]?.[x] ?? '#'
}

function neighbors(open: boolean[][], cols: number, rows: number, x: number, y: number) {
  const out: Cell[] = []
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ] as const) {
    let nx = x + dx
    let ny = y + dy
    if (nx < 0 || nx >= cols) {
      if (!open[y]?.[0] || !open[y]?.[cols - 1]) continue
      nx = (nx + cols) % cols
    }
    if (ny < 0 || ny >= rows) continue
    if (!open[ny][nx]) continue
    out.push({ x: nx, y: ny })
  }
  return out
}

/**
 * Fill one-tile dead ends so corridors stay on loops. Protected tiles (start,
 * power, den) are kept — a neighboring wall is opened instead when needed.
 */
function sealDeadEnds(
  open: boolean[][],
  door: boolean[][],
  cols: number,
  rows: number,
  keep: Set<string>,
) {
  const key = (x: number, y: number) => `${x},${y}`

  // If a keep tile is a stub, punch toward the board center.
  for (const token of keep) {
    const [xs, ys] = token.split(',')
    const x = Number(xs)
    const y = Number(ys)
    if (!open[y]?.[x] || door[y][x]) continue
    if (neighbors(open, cols, rows, x, y).length > 1) continue
    const ox = Math.floor(cols / 2)
    const oy = Math.floor(rows / 2)
    const dirs = [
      [Math.sign(ox - x) || 1, 0],
      [0, Math.sign(oy - y) || 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const
    for (const [dx, dy] of dirs) {
      const nx = x + dx
      const ny = y + dy
      if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue
      if (door[ny][nx]) continue
      if (!open[ny][nx]) {
        open[ny][nx] = true
        break
      }
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!open[y][x] || door[y][x]) continue
        if (keep.has(key(x, y))) continue
        const next = neighbors(open, cols, rows, x, y)
        if (next.length > 1) continue
        // Don't carve away the only approach into a power / start / den tile.
        if (next.some((n) => keep.has(key(n.x, n.y)))) continue
        open[y][x] = false
        changed = true
      }
    }
  }

  // Second pass: if a keep tile is still a stub, open toward center.
  for (const token of keep) {
    const [xs, ys] = token.split(',')
    const x = Number(xs)
    const y = Number(ys)
    if (!open[y]?.[x] || door[y][x]) continue
    if (neighbors(open, cols, rows, x, y).length > 1) continue
    const ox = Math.floor(cols / 2)
    const oy = Math.floor(rows / 2)
    const dirs = [
      [Math.sign(ox - x) || 1, 0],
      [0, Math.sign(oy - y) || 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const
    for (const [dx, dy] of dirs) {
      const nx = x + dx
      const ny = y + dy
      if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue
      if (door[ny][nx]) continue
      if (!open[ny][nx]) {
        open[ny][nx] = true
        break
      }
    }
  }
}

function parseMaze(rows: string[]): Maze {
  const R = rows.length
  const C = rows[0]?.length ?? 0
  if (C !== LAND_COLS || R !== LAND_ROWS) {
    throw new Error(`Pellets maze must be ${LAND_COLS}x${LAND_ROWS}, got ${C}x${R}`)
  }

  for (let y = 0; y < R; y++) {
    if ((rows[y]?.length ?? 0) !== C) {
      throw new Error(`Pellets maze row ${y} length ${(rows[y] ?? '').length}, expected ${C}`)
    }
  }

  const open = grid(C, R, false)
  const door = grid(C, R, false)
  const crumbs: Cell[] = []
  const power: Cell[] = []
  const ghostSpawns: Cell[] = []
  const doorCells: Cell[] = []
  let start: Cell = { x: Math.floor(C / 2), y: R - 2 }

  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const ch = mazeAt(rows, x, y)
      open[y][x] = ch !== '#'
      if (ch === 'o') power.push({ x, y })
      else if (ch === 'P') start = { x, y }
      else if (ch === 'G') ghostSpawns.push({ x, y })
      else if (ch === '=') {
        door[y][x] = true
        doorCells.push({ x, y })
      }
    }
  }

  const keep = new Set<string>([
    `${start.x},${start.y}`,
    ...power.map((c) => `${c.x},${c.y}`),
    ...ghostSpawns.map((c) => `${c.x},${c.y}`),
    ...doorCells.map((c) => `${c.x},${c.y}`),
  ])
  sealDeadEnds(open, door, C, R, keep)

  // Every remaining open path tile gets a crumb.
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      if (!open[y][x] || door[y][x]) continue
      const ch = mazeAt(rows, x, y)
      if (ch === 'o' || ch === 'G' || ch === 'P') continue
      // Skip tiles we sealed that were never walkable in the authored string? already open.
      crumbs.push({ x, y })
    }
  }

  // Drop crumbs that were authored on cells we sealed into walls.
  // (crumbs only added for open cells above — fine.)

  const houseCells = [...ghostSpawns, ...doorCells]
  const house = houseCells.length
    ? {
        minX: Math.min(...houseCells.map((c) => c.x)),
        maxX: Math.max(...houseCells.map((c) => c.x)),
        minY: Math.min(...houseCells.map((c) => c.y)),
        maxY: Math.max(...houseCells.map((c) => c.y)),
      }
    : { minX: 0, maxX: C - 1, minY: 0, maxY: R - 1 }

  const houseCenter = ghostSpawns.length
    ? {
        x: Math.round(ghostSpawns.reduce((s, c) => s + c.x, 0) / ghostSpawns.length),
        y: Math.round(ghostSpawns.reduce((s, c) => s + c.y, 0) / ghostSpawns.length),
      }
    : { x: Math.floor(C / 2), y: Math.floor(R / 2) }

  let ghostExit: Cell = { x: houseCenter.x, y: Math.max(1, house.minY - 1) }
  let exitDist = -1
  for (const d of doorCells) {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const ex = d.x + dx
      const ey = d.y + dy
      if (ey < 0 || ey >= R || ex < 0 || ex >= C) continue
      if (!open[ey][ex]) continue
      const ch = mazeAt(rows, ex, ey)
      if (ch === 'G' || ch === '=') continue
      const dist = (ex - houseCenter.x) ** 2 + (ey - houseCenter.y) ** 2
      if (dist > exitDist) {
        exitDist = dist
        ghostExit = { x: ex, y: ey }
      }
    }
  }

  return {
    cols: C,
    rows: R,
    open,
    door,
    house,
    houseCenter,
    ghostExit,
    start,
    crumbs,
    power,
  }
}

function rotCell(cell: Cell, rows: number): Cell {
  return { x: rows - 1 - cell.y, y: cell.x }
}

/** Rotate a maze 90° clockwise so portrait matches landscape flipped. */
export function rotateMazeCW(maze: Maze): Maze {
  const { cols, rows } = maze
  const open = grid(rows, cols, false)
  const door = grid(rows, cols, false)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = rows - 1 - y
      const ny = x
      open[ny][nx] = maze.open[y][x]
      door[ny][nx] = maze.door[y][x]
    }
  }

  const corners = [
    { x: maze.house.minX, y: maze.house.minY },
    { x: maze.house.maxX, y: maze.house.minY },
    { x: maze.house.minX, y: maze.house.maxY },
    { x: maze.house.maxX, y: maze.house.maxY },
  ].map((c) => rotCell(c, rows))

  return {
    cols: rows,
    rows: cols,
    open,
    door,
    house: {
      minX: Math.min(...corners.map((c) => c.x)),
      maxX: Math.max(...corners.map((c) => c.x)),
      minY: Math.min(...corners.map((c) => c.y)),
      maxY: Math.max(...corners.map((c) => c.y)),
    },
    houseCenter: rotCell(maze.houseCenter, rows),
    ghostExit: rotCell(maze.ghostExit, rows),
    start: rotCell(maze.start, rows),
    crumbs: maze.crumbs.map((c) => rotCell(c, rows)),
    power: maze.power.map((c) => rotCell(c, rows)),
  }
}

function levelLayout(level: number) {
  const idx = Math.min(LEVEL_MAZES.length - 1, Math.max(0, level - 1))
  return LEVEL_MAZES[idx]
}

/**
 * Curated maze for this level. Always authored in landscape, then rotated for
 * portrait so phone and desktop share the same board.
 */
export function buildLevelMaze(
  level: number,
  width = typeof window === 'undefined' ? 1280 : window.innerWidth,
  height = typeof window === 'undefined' ? 720 : window.innerHeight,
): Maze {
  const maze = parseMaze(levelLayout(level))
  return height > width ? rotateMazeCW(maze) : maze
}

/** @deprecated prefer buildLevelMaze. */
export function buildMaze(_cols: number, _rows: number, _seed = 1): Maze {
  return parseMaze(LEVEL_MAZES[0])
}

export function mazeSeed(level: number) {
  return level | 0
}
