// Types only, deliberately. `game.ts` imports this module for its walls, so a
// value imported back the other way would be a cycle — and reading one while
// the modules were still initialising is exactly how this file first broke.
import type { Cell } from './game'

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
  // 6 — full density, and the shape the climb arrives at. Corners and a spine.
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
  // 7 — gates. Two broken columns you thread rather than round, same count.
  [
    { x: 6, y: 2, w: 1, h: 4 },
    { x: 6, y: 9, w: 1, h: 4 },
    { x: 14, y: 2, w: 1, h: 4 },
    { x: 14, y: 9, w: 1, h: 4 },
    { x: 10, y: 6, w: 1, h: 3 },
    { x: 3, y: 7, w: 1, h: 1 },
    { x: 17, y: 7, w: 1, h: 1 },
    { x: 10, y: 2, w: 1, h: 1 },
    { x: 10, y: 12, w: 1, h: 1 },
  ],
  // 8 — a room with a door top and bottom. The only shape you can be inside.
  [
    { x: 7, y: 5, w: 3, h: 1 },
    { x: 11, y: 5, w: 3, h: 1 },
    { x: 7, y: 9, w: 3, h: 1 },
    { x: 11, y: 9, w: 3, h: 1 },
    { x: 7, y: 6, w: 1, h: 3 },
    { x: 13, y: 6, w: 1, h: 3 },
    { x: 3, y: 7, w: 1, h: 1 },
    { x: 17, y: 7, w: 1, h: 1 },
    { x: 10, y: 1, w: 1, h: 1 },
    { x: 10, y: 13, w: 1, h: 1 },
    { x: 10, y: 7, w: 1, h: 1 },
  ],
]

/** What each layout is called when it lands, in the same order. */
const NAMES = [
  'The Lawn',
  'Two Posts',
  'The Gate',
  'Four Beds',
  'The Fountain',
  'The Garden',
  'The Gates',
  'The Room',
]

/** Levels with a layout of their own. Past this the shapes come round again. */
export const AUTHORED_LEVELS = LAYOUTS.length

/**
 * Where the repeat starts, and it must be the level the climb tops out at.
 *
 * A record run eats well past a hundred food, so holding the last layout for
 * all of it would leave most of a run on one shape — the flat stretch these
 * levels exist to remove. The density has nowhere sensible left to climb, so
 * what keeps changing past the top is the shape.
 *
 * This pointed at 4 to begin with, on the reasoning that the three hardest
 * layouts taking turns would hold the difficulty. They do not: 4, 5 and 6 are
 * 16, 19 and 23 cells, so every lap began by dropping a third of the walls and
 * level 7 played easier than level 6 — a level that goes backwards is worse
 * than one that repeats. The layouts from here on are all the same count, and
 * a new one has to be too.
 */
const CYCLE_FROM = 6

export function wallKey(x: number, y: number) {
  return `${x},${y}`
}

/** Level for a body this long. Keeps climbing for as long as the run does. */
export function levelFor(segments: number, startSegments: number) {
  const eaten = Math.max(0, segments - startSegments)
  return 1 + Math.floor(eaten / LEVEL_FOOD)
}

function layoutIndex(level: number): number {
  const at = Math.max(1, level)
  if (at <= AUTHORED_LEVELS) return at - 1
  const span = AUTHORED_LEVELS - CYCLE_FROM + 1
  return CYCLE_FROM - 1 + ((at - AUTHORED_LEVELS - 1) % span)
}

function layoutFor(level: number): Rect[] {
  return LAYOUTS[layoutIndex(level)]
}

/** The name the level's banner carries. A shape that comes round again keeps its name. */
export function levelName(level: number): string {
  return NAMES[layoutIndex(level)] ?? ''
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
