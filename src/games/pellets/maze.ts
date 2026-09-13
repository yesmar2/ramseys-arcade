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
 * Legend: `#` wall, `.` crumb, `o` power, `=` house door, `P` player,
 * `G` chaser spawn.
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

/** Left half + center (14 chars). Mirrored to 27 so every board is LR + TB symmetric. */
function mirrorLR(half: string) {
  if (half.length !== 14) {
    throw new Error(`Pellets half-row must be 14 chars, got ${half.length} (${half})`)
  }
  return half.slice(0, 13) + half[13] + [...half.slice(0, 13)].reverse().join('')
}

function placeCenter(row: string, ch: string) {
  return row.slice(0, 13) + ch + row.slice(14)
}

/**
 * A board is authored as five left-half rows (y = 1..5). Row 0 is the top
 * border, rows 6..8 are the den block, and rows 9..13 mirror 5..1, so one
 * spec fixes the whole 27x15 grid and every board stays LR + TB symmetric.
 */
type LevelSpec = {
  name: string
  /** Half-rows for y = 1..5, 14 chars each. */
  top: readonly [string, string, string, string, string]
  /** Last open column of the side tunnel on the den row. Bigger = longer run. */
  tunnel: number
  /** Columns that link the ring row to the tunnel row past the den wall. */
  links: readonly number[]
}

/**
 * Den block (y = 6..8): a three-tile pen behind a gate, flanked by the side
 * tunnel. `tunnel` sets how far the tunnel mouth reaches and `links` which
 * columns cut through it — fewer links means fewer ways off the tunnel.
 */
function denRows(tunnel: number, links: readonly number[]): [string, string, string] {
  const bar = (center: string) => {
    let s = '#'
    for (let x = 1; x <= 12; x++) s += links.includes(x) ? '.' : '#'
    return s + center
  }
  let lane = ''
  for (let x = 0; x <= 11; x++) lane += x <= tunnel ? '.' : '#'
  return [bar('='), `${lane}GG`, bar('#')]
}

function makeLevel(spec: LevelSpec) {
  const halves = [
    '##############',
    ...spec.top,
    ...denRows(spec.tunnel, spec.links),
    ...[...spec.top].reverse(),
    '##############',
  ]
  const rows = halves.map(mirrorLR)
  rows[11] = placeCenter(rows[11], 'P')
  return rows
}

/**
 * Nine hand-drawn boards, roughly ordered from loopy to mean. Early ones give
 * you parallel lanes and short blocks to dodge around; later ones trade those
 * for long committed runs, fewer ways off the tunnel, and — from `gauntlet` on
 * — a single pair of power pips on the centre line instead of four in the
 * corners. Levels past the ninth keep cycling the back half, so the board
 * still changes every round while the chasers keep gaining speed.
 */
const LEVELS: readonly LevelSpec[] = [
  {
    // 1 — short blocks and T-junctions everywhere: the most ways out of trouble.
    name: 'pinch',
    top: ['#o...........#', '#.####.#.###..', '#.##.....###..', '#.##.###.###..', '#.............'],
    tunnel: 5,
    links: [1, 3, 5],
  },
  {
    // 2 — lattice of two-wide blocks: plenty of turns, no straightaways.
    name: 'lattice',
    top: ['#o............', '#.##.##.##.##.', '#.##....##....', '#.##.##.##.##.', '#.............'],
    tunnel: 5,
    links: [1, 3, 5],
  },
  {
    // 3 — staggered blocks, three ways across every row.
    name: 'orchard',
    top: ['#o............', '#.####.###.##.', '#.#...........', '#.#.####.###.#', '#.............'],
    tunnel: 5,
    links: [1, 3, 5],
  },
  {
    // 4 — the top corridor is cut at the centre, so there is no free lap over
    // the top; the tunnel runs long to make up for it.
    name: 'spine',
    top: ['#o...........#', '#.#.#####.##.#', '#.......#.....', '#.##.##.###.#.', '#.............'],
    tunnel: 7,
    links: [1, 4, 7],
  },
  {
    // 5 — chambers, with the pips out on the ring instead of the top corridor,
    // and only two cuts off the tunnel from here on.
    name: 'chambers',
    top: ['#.............', '#.####.#.####.', '#.#....#....#.', '#.#.##.#.##.#.', '#o............'],
    tunnel: 7,
    links: [4, 7],
  },
  {
    // 6 — rungs: three open corridors stitched by four wide lanes and nothing
    // in between to duck behind.
    name: 'ladder',
    top: ['#o............', '#.##.#####.##.', '#.............', '#.##.#####.##.', '#.............'],
    tunnel: 5,
    links: [2, 5],
  },
  {
    // 7 — courtyards: three-row slabs, so the ring rows are the only ways
    // across. One cut off the tunnel, and two pips from here on.
    name: 'courtyard',
    top: ['#............o', '#.####.###.##.', '#.####.###.##.', '#.####.###.##.', '#.............'],
    tunnel: 5,
    links: [5],
  },
  {
    // 8 — vice: four verticals, seven-wide slabs, one narrow tunnel cut.
    name: 'vice',
    top: ['#............o', '#.#.#######.#.', '#.#.........#.', '#.#.#######.#.', '#.............'],
    tunnel: 3,
    links: [3],
  },
  {
    // 9 — four slabs and three full-width runs: commit and you ride it out.
    name: 'gauntlet',
    top: ['#............o', '#.#####.#####.', '#.............', '#.#####.#####.', '#.............'],
    tunnel: 5,
    links: [5],
  },
]

const LEVEL_MAZES: string[][] = LEVELS.map(makeLevel)

function grid(cols: number, rows: number, value: boolean) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value))
}

function mazeAt(rows: string[], x: number, y: number) {
  return rows[y]?.[x] ?? '#'
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

  // Every open lane tile carries a crumb except pads, spawns and the gate.
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      if (!open[y][x] || door[y][x]) continue
      const ch = mazeAt(rows, x, y)
      if (ch === 'o' || ch === 'G' || ch === 'P') continue
      crumbs.push({ x, y })
    }
  }

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

/**
 * Board for a level. The first pass walks the whole set in order; after that it
 * keeps cycling the back half so no two rounds in a row share a layout.
 */
function levelLayout(level: number) {
  const i = Math.max(0, (Math.floor(level) || 1) - 1)
  if (i < LEVEL_MAZES.length) return LEVEL_MAZES[i]
  // Past the tour, rotate the three tightest boards so the layout still
  // changes every round without handing back an early, roomy one.
  const hard = LEVEL_MAZES.slice(-3)
  return hard[(i - LEVEL_MAZES.length) % hard.length]
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
