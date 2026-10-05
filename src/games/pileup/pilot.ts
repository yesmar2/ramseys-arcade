import {
  COLS,
  HIDDEN,
  PIECE_I,
  SHAPES,
  TOTAL,
  hardDrop,
  holdPiece,
  move,
  rotate,
  shake,
  type GameState,
  type Kind,
} from './game'

/*
 * A player for Pileup, for its cabinet on the home page and for measuring what
 * a run can score. It looks at every way the piece could come down (each turn,
 * each column, held or not) and weighs the pile each one leaves: how high the
 * piece lands, the rows it clears, the holes and wells it leaves, and how
 * ragged the rows and columns are. The weights are El-Ashi's, from his
 * Tetris-playing study, which plays for a long time without looking ahead.
 *
 * `fours` makes it keep the right-hand column open and fill it only with the
 * long piece, four rows at a time: the way a strong player chases points.
 */

export type Plan = {
  /** Swap with the held piece (or the next one) first. */
  hold: boolean
  kind: Kind
  rot: number
  /** The box's column. */
  x: number
  /** The landing row of the box. */
  y: number
  value: number
  rows: number
}

export type Style = { fours?: boolean }

const W = {
  landing: -4.500158825082766,
  eroded: 3.4181268101392694,
  rowFlips: -3.2178882868487753,
  colFlips: -9.348695305445199,
  holes: -7.899265427351652,
  wells: -3.3855972247263626,
}

function fitsIn(grid: Uint8Array, kind: Kind, rot: number, x: number, y: number) {
  for (const [cx, cy] of SHAPES[kind]![rot]!) {
    const gx = x + cx
    const gy = y + cy
    if (gx < 0 || gx >= COLS || gy >= TOTAL) return false
    if (gy >= 0 && grid[gy * COLS + gx]) return false
  }
  return true
}

/** Lay the piece into a copy of the grid and clear its rows: the pile it leaves, and what it took. */
function settle(grid: Uint8Array, kind: Kind, rot: number, x: number, y: number) {
  const g = grid.slice()
  for (const [cx, cy] of SHAPES[kind]![rot]!) {
    const gy = y + cy
    if (gy >= 0) g[gy * COLS + x + cx] = kind + 1
  }
  let rows = 0
  let eroded = 0
  const out = new Uint8Array(COLS * TOTAL)
  let to = TOTAL - 1
  for (let gy = TOTAL - 1; gy >= 0; gy--) {
    let full = true
    for (let gx = 0; gx < COLS; gx++) {
      if (!g[gy * COLS + gx]) {
        full = false
        break
      }
    }
    if (full) {
      rows += 1
      for (const [, cy] of SHAPES[kind]![rot]!) if (y + cy === gy) eroded += 1
      continue
    }
    out.set(g.subarray(gy * COLS, gy * COLS + COLS), to * COLS)
    to--
  }
  return { grid: out, rows, eroded }
}

/** El-Ashi's measures of a pile. */
function measure(g: Uint8Array, wellCol: number) {
  let rowFlips = 0
  let colFlips = 0
  let holes = 0
  let wells = 0
  for (let y = 0; y < TOTAL; y++) {
    let prev = 1
    let any = false
    for (let x = 0; x < COLS; x++) {
      const v = g[y * COLS + x] ? 1 : 0
      if (v) any = true
      if (v !== prev) rowFlips++
      prev = v
    }
    if (!prev) rowFlips++
    // An empty row above the pile has no ragged edges worth counting.
    if (!any) rowFlips -= 2
  }
  for (let x = 0; x < COLS; x++) {
    let prev = 0
    let covered = false
    for (let y = 0; y < TOTAL; y++) {
      const v = g[y * COLS + x] ? 1 : 0
      if (v !== prev) colFlips++
      prev = v
      if (v) covered = true
      else if (covered) holes++
    }
    if (!prev) colFlips++
    if (x === wellCol) continue
    // A well: an empty cell with both sides filled (a wall counts), counted deeper the further down it goes.
    let depth = 0
    for (let y = 0; y < TOTAL; y++) {
      const here = g[y * COLS + x]
      const left = x === 0 || g[y * COLS + x - 1]
      const right = x === COLS - 1 || g[y * COLS + x + 1]
      if (!here && left && right) {
        depth++
        wells += depth
      } else if (here) {
        break
      } else {
        depth = 0
      }
    }
  }
  return { rowFlips: Math.max(0, rowFlips), colFlips, holes, wells }
}

/** Rows from the floor to the top of the tallest column. */
function pileHeight(grid: Uint8Array) {
  for (let i = 0; i < grid.length; i++) if (grid[i]) return TOTAL - Math.floor(i / COLS)
  return 0
}

function evaluate(grid: Uint8Array, kind: Kind, rot: number, x: number, y: number, style: Style) {
  const cells = SHAPES[kind]![rot]!
  const ys = cells.map(([, cy]) => y + cy)
  const landing = TOTAL - (Math.min(...ys) + Math.max(...ys)) / 2
  const after = settle(grid, kind, rot, x, y)
  const wellCol = style.fours ? COLS - 1 : -1
  const m = measure(after.grid, wellCol)
  let value =
    W.landing * landing +
    W.eroded * after.rows * after.eroded +
    W.rowFlips * m.rowFlips +
    W.colFlips * m.colFlips +
    W.holes * m.holes +
    W.wells * m.wells
  // Chasing fours only while the pile is low enough to wait for the long piece; past that, it just survives.
  if (style.fours && pileHeight(grid) < 11) {
    const inWell = cells.filter(([cx]) => x + cx === wellCol).length
    if (inWell && after.rows < 3) value -= 25 + 10 * inWell
    if (after.rows >= 4) value += 60
    else if (after.rows > 0 && !inWell) value -= 6 * after.rows
  }
  return { value, rows: after.rows }
}

/** Every resting place for the piece reachable from where it comes in: turned there, slid across, dropped. */
export function plansFor(grid: Uint8Array, kind: Kind, style: Style = {}): Plan[] {
  const plans: Plan[] = []
  const turns = kind === 1 ? 1 : 4
  for (let rot = 0; rot < turns; rot++) {
    const startX = kind === 1 ? 4 : 3
    if (!fitsIn(grid, kind, rot, startX, HIDDEN) && !fitsIn(grid, kind, rot, startX, HIDDEN - 1)) continue
    const top = fitsIn(grid, kind, rot, startX, HIDDEN) ? HIDDEN : HIDDEN - 1
    for (const dir of [-1, 1]) {
      for (let x = dir === 1 ? startX : startX - 1; ; x += dir) {
        if (!fitsIn(grid, kind, rot, x, top)) break
        let y = top
        while (fitsIn(grid, kind, rot, x, y + 1)) y++
        const { value, rows } = evaluate(grid, kind, rot, x, y, style)
        plans.push({ hold: false, kind, rot, x, y, value, rows })
      }
    }
  }
  return plans.sort((a, b) => b.value - a.value)
}

/** The best plans for this moment, the piece in play and the held one both weighed. */
export function bestPlans(s: GameState, style: Style = {}): Plan[] {
  const p = s.piece
  if (!p) return []
  const plans = plansFor(s.grid, p.kind, style)
  if (!s.held) {
    const other = s.hold ?? s.queue[0]
    if (other !== undefined && other !== p.kind) {
      for (const plan of plansFor(s.grid, other, style)) plans.push({ ...plan, hold: true })
      plans.sort((a, b) => b.value - a.value)
    }
  }
  // The long piece, held back for a well four deep, is worth keeping when chasing fours.
  if (style.fours && p.kind === PIECE_I && !s.held && s.hold !== PIECE_I) {
    const best = plans[0]
    if (best && !best.hold && best.rows < 4) {
      const keep = plans.find((plan) => plan.hold)
      if (keep) return [keep, ...plans.filter((plan) => plan !== keep)]
    }
  }
  return plans
}

/** How many rows the pile could lose to a Shake now: its shortest column, once every gap is filled. */
export function shakeRows(s: GameState): number {
  let least = TOTAL
  for (let x = 0; x < COLS; x++) {
    let n = 0
    for (let y = 0; y < TOTAL; y++) if (s.grid[y * COLS + x]) n++
    least = Math.min(least, n)
  }
  return least
}

function holesIn(s: GameState): number {
  return measure(s.grid, -1).holes
}

/**
 * Plays the piece in play straight to its best resting place: held if that's
 * better, turned, slid and dropped, all at once. For measuring, not watching.
 * Shakes once the pile has holes worth filling.
 */
export function playInstantly(s: GameState, style: Style = {}): boolean {
  if (s.phase !== 'playing' || !s.piece || s.clearing || s.settle) return false
  if (s.shakeReady && (holesIn(s) >= 6 || shakeRows(s) >= 3)) {
    shake(s)
    return true
  }
  const plan = bestPlans(s, style)[0]
  if (!plan) return hardDrop(s)
  if (plan.hold) holdPiece(s)
  const p = s.piece
  if (!p) return true
  for (let i = 0; i < 4 && p.rot !== plan.rot; i++) rotate(s, 1)
  for (let i = 0; i < COLS && p.x !== plan.x; i++) if (!move(s, plan.x > p.x ? 1 : -1)) break
  hardDrop(s)
  return true
}

/**
 * A player you'd believe, for the cabinet: it takes a moment to look, turns and
 * slides the piece a step at a time, and drops it. Now and then it picks a
 * worse place, from the top `pool` of them, more often the higher the level,
 * so its runs end; it shakes once the holes start to tell.
 */
export function makePilot(
  opts: { look?: number; step?: number; slip?: number; pool?: number; fours?: boolean; shakeAt?: number } = {},
) {
  const look = opts.look ?? 0.32
  const step = opts.step ?? 0.085
  const slipAt = opts.slip ?? 0.12
  const pool = opts.pool ?? 0.05
  const shakeAt = opts.shakeAt ?? 5
  const style: Style = { fours: opts.fours }
  let serial = -1
  let plan: Plan | null = null
  let wait = 0
  return (s: GameState, dt: number): GameState => {
    if (s.phase !== 'playing' || s.clearing || s.settle || !s.piece) return s
    if (s.serial !== serial) {
      serial = s.serial
      wait = look * (0.7 + Math.random() * 0.6)
      if (s.shakeReady && holesIn(s) >= shakeAt) {
        shake(s)
        plan = null
        return s
      }
      const plans = bestPlans(s, style)
      const slip = Math.min(0.75, slipAt + (s.level - 1) * 0.05)
      const pick = Math.random() < slip ? 1 + Math.floor(Math.random() * Math.max(1, plans.length * pool)) : 0
      plan = plans[Math.min(plans.length - 1, pick)] ?? null
      if (plan?.hold) {
        holdPiece(s)
        serial = s.serial
      }
      return s
    }
    if (!plan) return s
    wait -= dt
    if (wait > 0) return s
    const p = s.piece
    wait = step
    if (p.rot !== plan.rot) {
      const left = (p.rot - plan.rot + 4) % 4 === 1
      if (!rotate(s, left ? -1 : 1)) plan = { ...plan, rot: p.rot }
      return s
    }
    if (p.x !== plan.x) {
      if (!move(s, plan.x > p.x ? 1 : -1)) plan = { ...plan, x: p.x }
      return s
    }
    hardDrop(s)
    plan = null
    return s
  }
}
