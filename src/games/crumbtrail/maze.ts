/**
 * The endless maze.
 *
 * Pellets hands you a finished board, so it can afford hand-drawn levels. Here
 * the board is never finished, and a generator that only *usually* behaves is
 * no good when the floor is climbing behind you: a single dead end that the
 * run is forced into is an unearned death.
 *
 * So the guarantee comes from the shape rather than from a check. Rows arrive
 * in bands — one fully open lane row, then one or two wall rows that share the
 * same gap columns. The open lane means you can always slide sideways to any
 * gap; the shared gaps mean every wall band is a straight vertical corridor.
 * Between them, there is always a way up from anywhere, and nothing generated
 * is ever walled off from the rest.
 *
 * The wall rows are what you actually see. One reads as a slim block, two as a
 * chunky one, and that variation is the whole look of the maze.
 */
import { mulberry32 } from '../../lib/seededRandom'

export type RowKind = 'lane' | 'wall'

export type GenRow = {
  /** World row index, counting up from 0 at the start of a run. */
  row: number
  kind: RowKind
  open: boolean[]
  crumbs: boolean[]
  power: boolean[]
}

/**
 * Ten, not nine.
 *
 * A tall screen clamps to this floor, so the phone plays the narrowest board
 * there is: nine columns against a desktop's twenty-one, which is five open
 * cells in a row to run through against nearly twelve. One more column is not
 * parity — it cannot be, the screen is the shape it is — but it is the most
 * that can be added before the cell gets too small to read, and it comes with
 * a matching easing of chaser pace in game.ts rather than carrying the whole
 * correction on its own.
 */
export const MIN_COLS = 10
export const MAX_COLS = 21
/** Rows we want on screen; the column count is chosen to land near it. */
export const TARGET_VISIBLE_ROWS = 15
/**
 * Buffer rows kept above the top of the view. Chasers are seeded here, so it
 * only has to cover the row or two being built before they scroll into sight.
 */
export const HIDDEN_TOP = 2
/**
 * Buffer rows kept below the bottom of the view. This is the room the hazard
 * rests in while it is not chasing you, and the short dip back down the board
 * still allows before it catches you.
 */
export const BELOW_VIEW = 3

/**
 * Columns for this viewport.
 *
 * A vertical scroller can't rotate its board the way Pellets does, so instead
 * the grid gets wider on wide screens to keep roughly the same number of rows
 * in view. A phone plays a 9-wide maze, a desktop a 20-wide one, and both see
 * about the same distance ahead.
 */
export function pickCols(viewW: number, viewH: number): number {
  if (!(viewW > 0) || !(viewH > 0)) return MIN_COLS
  const want = Math.round((TARGET_VISIBLE_ROWS * viewW) / viewH)
  return Math.max(MIN_COLS, Math.min(MAX_COLS, want))
}

/** Rows of maze actually on screen. */
export function visibleRows(viewW: number, viewH: number, cols: number): number {
  const cell = viewW / cols
  const visible =
    cell > 0 && Number.isFinite(cell)
      ? Math.ceil(viewH / cell) + 1
      : TARGET_VISIBLE_ROWS
  return Math.max(10, visible)
}

/** Buffer height: the view, plus the strips kept above and below it. */
export function bufferRows(viewW: number, viewH: number, cols: number): number {
  return visibleRows(viewW, viewH, cols) + HIDDEN_TOP + BELOW_VIEW
}

/** 0 at the start of a run, 1 once the maze has tightened as far as it goes. */
export function mazeDifficulty(depth: number): number {
  return Math.max(0, Math.min(1, depth / 320))
}

/**
 * One band, lane row first, then the wall rows stacked above it.
 *
 * Gap count scales with the column count — a fixed three doors is a fair maze
 * at 9 wide and a wall at 21 — and tightens as the run goes on.
 */
export function makeBand(
  seed: number,
  startRow: number,
  cols: number,
  depth: number,
): GenRow[] {
  const rand = mulberry32((startRow * 1_048_583) ^ seed)
  const d = mazeDifficulty(depth)

  const span = Math.max(3, Math.round(cols / 3.2))
  const gapCount = Math.max(2, span - Math.round(d * 1.6))
  const gaps = new Set<number>()
  let guard = 0
  while (gaps.size < gapCount && guard++ < 80) {
    gaps.add(Math.floor(rand() * cols))
  }

  const lane: GenRow = {
    row: startRow,
    kind: 'lane',
    open: new Array(cols).fill(true),
    crumbs: new Array(cols).fill(true),
    power: new Array(cols).fill(false),
  }

  /*
   * Power crumbs only go on open lanes. On a wall row they'd sit in a corridor
   * one tile wide, which is exactly where you can't afford to commit to a
   * detour — the only pip that turns a chase around has to be reachable.
   */
  if (startRow > 6 && rand() < 0.1) {
    const at = Math.floor(rand() * cols)
    lane.power[at] = true
    lane.crumbs[at] = false
  }

  /*
   * Some corridors through the band are swept bare.
   *
   * Walking a crumbless tile resets the streak — the rule that stops you
   * farming ground you have already cleared — so a bare corridor is passage
   * that costs you your run of crumbs. That turns every band into the choice
   * the game was missing: the nearest way up is often the empty one, and the
   * one that keeps your streak alive is further along the lane, which is time
   * you are handing to the tide.
   *
   * At least one crumbed route always survives, so the streak is never simply
   * taken from you, and bare ones only start appearing once there are two to
   * choose between.
   */
  const gapList = [...gaps].sort((a, b) => a - b)
  const bare = new Set<number>()
  if (gapList.length >= 2) {
    const want = Math.min(
      gapList.length - 1,
      Math.max(1, Math.round(gapList.length * (0.3 + d * 0.2))),
    )
    const pool = [...gapList]
    for (let i = 0; i < want && pool.length > 1; i++) {
      bare.add(pool.splice(Math.floor(rand() * pool.length), 1)[0])
    }
  }

  const rows: GenRow[] = [lane]
  const tall = rand() < 0.36 + d * 0.2
  for (let i = 0; i < (tall ? 2 : 1); i++) {
    const open = new Array(cols).fill(false)
    for (const g of gaps) open[g] = true
    rows.push({
      row: startRow + 1 + i,
      kind: 'wall',
      open,
      crumbs: open.map((isOpen, x) => isOpen && !bare.has(x)),
      power: new Array(cols).fill(false),
    })
  }
  return rows
}

/** Opening stretch: open lanes to start on, and no wall band right away. */
export function makeOpeningBand(cols: number): GenRow[] {
  return [0, 1, 2, 3].map((row) => ({
    row,
    kind: 'lane' as const,
    open: new Array(cols).fill(true),
    crumbs: new Array(cols).fill(row > 0),
    power: new Array(cols).fill(false),
  }))
}
