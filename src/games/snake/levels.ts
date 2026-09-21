// Types only, deliberately. `game.ts` imports this module for its walls, so a
// value imported back the other way would be a cycle — and reading one while
// the modules were still initialising is exactly how this file first broke.
import type { Cell, Dir } from './game'

/** Food eaten between levels. */
export const LEVEL_FOOD = 10

export type Rect = { x: number; y: number; w: number; h: number }

/**
 * Barrier layouts, authored on the long board (21x15) and transposed when the
 * screen is portrait, so a level is the same shape whichever way it is held.
 *
 * Curated rather than generated, like the Pellets mazes. Random walls in Snake
 * read as noise, and the whole point of a level is that you learn its shape and
 * come back knowing it.
 *
 * Two rules every layout keeps. Nothing touches the board edge in a way that
 * closes a pocket, because food placed inside one a body has sealed off is a
 * run that cannot be continued or lost, only abandoned; and the open cells stay
 * one connected region, which `assertLevelsAreOpen` checks rather than trusts.
 */
const LAYOUTS: Rect[][] = [
  // 1 — nothing. The game teaches itself before it asks for anything.
  [],
  // 2 — a pair of posts either side of the middle.
  [
    { x: 6, y: 5, w: 1, h: 5 },
    { x: 14, y: 5, w: 1, h: 5 },
  ],
  // 3 — a wall across the waist with a door in it.
  [
    { x: 3, y: 7, w: 6, h: 1 },
    { x: 12, y: 7, w: 6, h: 1 },
  ],
  // 4 — four corner blocks, pulled in off the edges.
  [
    { x: 4, y: 3, w: 2, h: 2 },
    { x: 15, y: 3, w: 2, h: 2 },
    { x: 4, y: 10, w: 2, h: 2 },
    { x: 15, y: 10, w: 2, h: 2 },
  ],
  // 5 — the corners, and something in the middle to route around.
  [
    { x: 4, y: 3, w: 2, h: 2 },
    { x: 15, y: 3, w: 2, h: 2 },
    { x: 4, y: 10, w: 2, h: 2 },
    { x: 15, y: 10, w: 2, h: 2 },
    { x: 10, y: 6, w: 1, h: 3 },
  ],
  // 6 — the densest shape. Past here the walls stop growing and start taking
  // turns: more of them would make a maze, and a maze is a different game.
  [
    { x: 4, y: 3, w: 2, h: 2 },
    { x: 15, y: 3, w: 2, h: 2 },
    { x: 4, y: 10, w: 2, h: 2 },
    { x: 15, y: 10, w: 2, h: 2 },
    { x: 10, y: 6, w: 1, h: 3 },
    { x: 3, y: 7, w: 1, h: 1 },
    { x: 17, y: 7, w: 1, h: 1 },
    { x: 10, y: 2, w: 1, h: 1 },
    { x: 10, y: 12, w: 1, h: 1 },
  ],
]

/** Levels with a layout of their own. Past this the shapes come round again. */
export const AUTHORED_LEVELS = LAYOUTS.length

/**
 * Where the repeat starts. A record run eats well past a hundred food, so
 * freezing the board at the last layout would leave most of it on one shape —
 * the flat stretch these levels exist to remove. The density has nowhere
 * sensible left to climb, so what keeps changing is the shape: the level count
 * carries on and the three hardest layouts come round in turn.
 */
const CYCLE_FROM = 4

export function wallKey(x: number, y: number) {
  return `${x},${y}`
}

/** Level for a body this long. Keeps climbing for as long as the run does. */
export function levelFor(segments: number, startSegments: number) {
  const eaten = Math.max(0, segments - startSegments)
  return 1 + Math.floor(eaten / LEVEL_FOOD)
}

function layoutFor(level: number): Rect[] {
  const at = Math.max(1, level)
  if (at <= AUTHORED_LEVELS) return LAYOUTS[at - 1]
  const span = AUTHORED_LEVELS - CYCLE_FROM + 1
  return LAYOUTS[CYCLE_FROM - 1 + ((at - AUTHORED_LEVELS - 1) % span)]
}

/** Cells walled off at this level, for a board of this shape. */
export function wallsForLevel(level: number, cols: number, rows: number): Set<string> {
  const layout = layoutFor(level)
  // Authored long-side-first; a taller board is the same design on its side.
  const portrait = rows > cols
  const walls = new Set<string>()

  for (const rect of layout) {
    for (let dy = 0; dy < rect.h; dy++) {
      for (let dx = 0; dx < rect.w; dx++) {
        const ax = rect.x + dx
        const ay = rect.y + dy
        const x = portrait ? ay : ax
        const y = portrait ? ax : ay
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue
        walls.add(wallKey(x, y))
      }
    }
  }
  return walls
}

/**
 * The walls of a level, minus any the snake is standing on or could be killed
 * by before it could possibly answer.
 *
 * Levels arrive mid-run, wherever the snake happens to be, so three things have
 * to be kept clear. The body, or a block is drawn straight through the snake.
 * The lane ahead, because at full speed with the boost open the head covers
 * ground faster than anyone reads it. And a ring around the head — which is the
 * one that was missing: guarding only the direction of travel left blocks free
 * to appear hard against the head's flank, where the turn the player had
 * already asked for drove into them inside a tenth of a second.
 *
 * Those cells sit the level out. The shape loses a piece rather than the run
 * losing its fairness, and what is drawn is always exactly what can kill you.
 */
export function clearOfSnake(
  walls: Set<string>,
  body: Cell[],
  head: Cell,
  dir: Dir,
  // Six cells is about a third of a second at full speed with the boost held,
  // which is the least warning a new block can fairly give head-on.
  lookAhead = 6,
  // Sideways there is a turn to make first, so the same warning needs less
  // room — but it needs more than none.
  headClear = 3,
): Set<string> {
  const spared = new Set<string>()

  for (const seg of body) {
    spared.add(wallKey(Math.floor(seg.x), Math.floor(seg.y)))
  }

  const hx = Math.floor(head.x)
  const hy = Math.floor(head.y)
  for (let dx = -headClear; dx <= headClear; dx++) {
    for (let dy = -headClear; dy <= headClear; dy++) {
      spared.add(wallKey(hx + dx, hy + dy))
    }
  }

  const step: Cell =
    dir === 'up'
      ? { x: 0, y: -1 }
      : dir === 'down'
        ? { x: 0, y: 1 }
        : dir === 'left'
          ? { x: -1, y: 0 }
          : { x: 1, y: 0 }

  for (let i = 0; i <= lookAhead; i++) {
    spared.add(wallKey(Math.floor(head.x + step.x * i), Math.floor(head.y + step.y * i)))
  }

  const safe = new Set<string>()
  for (const cell of walls) if (!spared.has(cell)) safe.add(cell)
  return safe
}

/**
 * Every open cell reachable from every other, for each level and both board
 * orientations. A layout that fails this can strand food behind a wall.
 *
 * Called on load in dev from `game.ts`, which owns the board dimensions and by
 * then has this module in hand, rather than left as a function nobody calls:
 * the fault it catches is invisible until some run happens to place food in the
 * wrong cell, which is exactly the kind that reaches players. Anyone editing a
 * layout hears about it on the next reload.
 */
export function assertLevelsAreOpen(long: number, short: number): string[] {
  const problems: string[] = []

  for (let level = 1; level <= AUTHORED_LEVELS; level++) {
    for (const [cols, rows] of [
      [long, short],
      [short, long],
    ]) {
      const walls = wallsForLevel(level, cols, rows)
      let start: Cell | null = null
      let open = 0
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (walls.has(wallKey(x, y))) continue
          open++
          if (!start) start = { x, y }
        }
      }
      if (!start) {
        problems.push(`level ${level} ${cols}x${rows}: no open cells`)
        continue
      }

      const seen = new Set<string>([wallKey(start.x, start.y)])
      const queue: Cell[] = [start]
      while (queue.length) {
        const at = queue.pop() as Cell
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = at.x + dx
          const ny = at.y + dy
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          const key = wallKey(nx, ny)
          if (seen.has(key) || walls.has(key)) continue
          seen.add(key)
          queue.push({ x: nx, y: ny })
        }
      }

      if (seen.size !== open) {
        problems.push(
          `level ${level} ${cols}x${rows}: ${open - seen.size} open cell(s) walled off`,
        )
      }
    }
  }

  return problems
}
