// Types only, for the same reason as levels.ts: game.ts imports this module,
// so a value imported back from it would be a cycle.
import type { Cell } from './game'

/*
 * The mouse: something on the board that runs.
 *
 * Everything else in Snake stands still and waits to be eaten, so the only
 * thing a run ever chases is a spot on the grid. The mouse comes in through the
 * hedge now and then, noses about, and bolts when the head comes near. It is
 * slower than the snake but turns on a sixpence, so running straight at it
 * rarely works — cutting it off does, and the best way to cut it off is with
 * your own body, which it will not cross. Leave it long enough and it goes
 * back the way it came.
 *
 * It lives on the same lanes as the snake: cell to cell, choosing where to go
 * next only when it reaches a centre. Positions are grid units, a cell's centre
 * at +0.5, the same as the head's.
 */

export type MouseMode = 'enter' | 'roam' | 'sniff' | 'flee' | 'trapped' | 'leave' | 'gone'

export type Mouse = {
  x: number
  y: number
  /** Cell it is leaving. Off the board while it comes in. */
  from: Cell
  /** Cell it is heading for. Off the board while it goes. */
  to: Cell
  /** Progress from `from` to `to`, 0 → 1. */
  t: number
  mode: MouseMode
  modeTime: number
  /** How long this stop lasts, for a sniff. */
  hold: number
  age: number
  /** Facing, radians, eased toward the way it is going. */
  angle: number
  /** 0 → 1 as it comes through the hedge, back to 0 as it goes. */
  fade: number
  seed: number
}

export type MouseWorld = {
  cols: number
  rows: number
  /** A wall or the body is in this cell. Out-of-board cells are the caller's to refuse. */
  blocked: (x: number, y: number) => boolean
  head: Cell
  /** Unit vector of the snake's heading, so a mouse runs from where the head is going. */
  heading: Cell
}

/** Seconds on the board before it heads home. */
export const MOUSE_LIFE = 12
/** Closer than this (cells) and it runs. */
export const MOUSE_FLEE_RADIUS = 5

const SPEED = {
  enter: 3.4,
  roam: 2.3,
  flee: 4.3,
  leave: 4.8,
} as const

const STEPS: Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

function onBoard(w: MouseWorld, x: number, y: number) {
  return x >= 0 && y >= 0 && x < w.cols && y < w.rows
}

function free(w: MouseWorld, x: number, y: number) {
  return onBoard(w, x, y) && !w.blocked(x, y)
}

/** A mouse coming in through the hedge at edge cell `at`. */
export function createMouse(at: Cell, cols: number, rows: number, seed: number): Mouse {
  const outside =
    at.x === 0
      ? { x: -1, y: at.y }
      : at.x === cols - 1
        ? { x: cols, y: at.y }
        : at.y === 0
          ? { x: at.x, y: -1 }
          : { x: at.x, y: rows }
  return {
    x: outside.x + 0.5,
    y: outside.y + 0.5,
    from: outside,
    to: { ...at },
    t: 0,
    mode: 'enter',
    modeTime: 0,
    hold: 0,
    age: 0,
    angle: Math.atan2(at.y - outside.y, at.x - outside.x),
    fade: 0,
    seed,
  }
}

/** Where a mouse can come in: an open edge cell well away from the head. */
export function mouseDoor(w: MouseWorld, rand: () => number): Cell | null {
  const doors: Cell[] = []
  for (let x = 0; x < w.cols; x++) {
    doors.push({ x, y: 0 }, { x, y: w.rows - 1 })
  }
  for (let y = 1; y < w.rows - 1; y++) {
    doors.push({ x: 0, y }, { x: w.cols - 1, y })
  }
  const open = doors.filter(
    (d) =>
      free(w, d.x, d.y) &&
      Math.hypot(d.x + 0.5 - w.head.x, d.y + 0.5 - w.head.y) > MOUSE_FLEE_RADIUS + 2.5,
  )
  if (!open.length) return null
  return open[Math.floor(rand() * open.length)]
}

function openness(w: MouseWorld, c: Cell, from: Cell) {
  let n = 0
  for (const d of STEPS) {
    const x = c.x + d.x
    const y = c.y + d.y
    if (x === from.x && y === from.y) continue
    if (free(w, x, y)) n++
  }
  return n
}

/** The first step of the shortest way off the board, or null if it is walled in. */
function stepHome(w: MouseWorld, at: Cell): Cell | null {
  const key = (x: number, y: number) => y * w.cols + x
  const prev = new Map<number, number>()
  const start = key(at.x, at.y)
  prev.set(start, -1)
  const queue: Cell[] = [at]
  while (queue.length) {
    const c = queue.shift() as Cell
    if (c.x === 0 || c.y === 0 || c.x === w.cols - 1 || c.y === w.rows - 1) {
      // Walk back to the step after `at`.
      let k = key(c.x, c.y)
      let before = prev.get(k) as number
      if (before === -1) return c
      while (before !== start) {
        k = before
        before = prev.get(k) as number
      }
      return { x: k % w.cols, y: Math.floor(k / w.cols) }
    }
    for (const d of STEPS) {
      const x = c.x + d.x
      const y = c.y + d.y
      if (!free(w, x, y)) continue
      const k = key(x, y)
      if (prev.has(k)) continue
      prev.set(k, key(c.x, c.y))
      queue.push({ x, y })
    }
  }
  return null
}

/** The way off the board from an edge cell. */
function outward(w: MouseWorld, at: Cell): Cell {
  if (at.x === 0) return { x: -1, y: at.y }
  if (at.x === w.cols - 1) return { x: w.cols, y: at.y }
  if (at.y === 0) return { x: at.x, y: -1 }
  return { x: at.x, y: w.rows }
}

function scared(m: Mouse, w: MouseWorld) {
  return Math.hypot(m.x - w.head.x, m.y - w.head.y) < MOUSE_FLEE_RADIUS
}

/**
 * Pick the next cell from the one it has just reached. Sets `to` and `mode`,
 * or stops it where it is.
 */
function decide(m: Mouse, w: MouseWorld, rand: () => number) {
  const at = m.to
  const back = m.from

  if (m.mode === 'leave') {
    if (at.x === 0 || at.y === 0 || at.x === w.cols - 1 || at.y === w.rows - 1) {
      m.from = at
      m.to = outward(w, at)
      m.t = 0
      return
    }
    const step = stepHome(w, at)
    if (step) {
      m.from = at
      m.to = step
      m.t = 0
      return
    }
    // Walled in by the body with nowhere to go: it digs down instead.
    m.mode = 'gone'
    m.modeTime = 0
    m.from = at
    m.t = 1
    return
  }

  const headCell = { x: Math.floor(w.head.x), y: Math.floor(w.head.y) }
  const options = STEPS.map((d) => ({ x: at.x + d.x, y: at.y + d.y })).filter(
    (c) => free(w, c.x, c.y) && !(c.x === headCell.x && c.y === headCell.y),
  )

  if (!options.length) {
    m.mode = 'trapped'
    m.modeTime = 0
    m.from = at
    m.t = 1
    return
  }

  if (scared(m, w)) {
    // Run from where the head will be, not where it is, so it breaks sideways.
    const tx = w.head.x + w.heading.x * 1.5
    const ty = w.head.y + w.heading.y * 1.5
    let best = options[0]
    let bestScore = -Infinity
    for (const c of options) {
      const reverse = c.x === back.x && c.y === back.y
      const score =
        Math.hypot(c.x + 0.5 - tx, c.y + 0.5 - ty) +
        openness(w, c, at) * 0.45 +
        rand() * 0.35 -
        (reverse ? 0.5 : 0)
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    m.mode = 'flee'
    m.from = at
    m.to = best
    m.t = 0
    return
  }

  // Not chased: it stops to sniff now and then, which is the opening a hunter needs.
  if (m.mode !== 'enter' && m.mode !== 'sniff' && rand() < 0.24) {
    m.mode = 'sniff'
    m.modeTime = 0
    m.hold = 0.45 + rand() * 0.7
    m.from = at
    m.t = 1
    return
  }

  const dx = at.x - back.x
  const dy = at.y - back.y
  const weights = options.map((c) => {
    const reverse = c.x === back.x && c.y === back.y
    const straight = c.x - at.x === dx && c.y - at.y === dy
    return (reverse ? 0.15 : straight ? 2.6 : 1) * (0.4 + openness(w, c, at) * 0.3)
  })
  let pick = rand() * weights.reduce((a, b) => a + b, 0)
  let choice = options[options.length - 1]
  for (let i = 0; i < options.length; i++) {
    pick -= weights[i]
    if (pick <= 0) {
      choice = options[i]
      break
    }
  }
  m.mode = 'roam'
  m.from = at
  m.to = choice
  m.t = 0
}

function speedOf(mode: MouseMode) {
  if (mode === 'enter') return SPEED.enter
  if (mode === 'flee') return SPEED.flee
  if (mode === 'leave') return SPEED.leave
  return SPEED.roam
}

function turnToward(current: number, target: number, maxDelta: number) {
  let d = target - current
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return current + Math.max(-maxDelta, Math.min(maxDelta, d))
}

/** One step of the mouse. Returns a new mouse; the one passed in is untouched. */
export function stepMouse(prev: Mouse, dt: number, w: MouseWorld, rand: () => number): Mouse {
  const m: Mouse = { ...prev, from: { ...prev.from }, to: { ...prev.to } }
  m.age += dt
  m.modeTime += dt

  if (m.mode === 'gone') {
    m.fade = Math.max(0, m.fade - dt * 3.2)
    return m
  }
  m.fade = Math.min(1, m.fade + dt * 3.5)

  // Time's up: head for the hedge, whatever it was doing.
  if (m.age >= MOUSE_LIFE && m.mode !== 'leave' && m.mode !== 'enter') {
    const wasStill = m.mode === 'sniff' || m.mode === 'trapped'
    m.mode = 'leave'
    m.modeTime = 0
    if (wasStill) decide(m, w, rand)
  }

  if (m.mode === 'sniff') {
    if (scared(m, w) || m.modeTime >= m.hold) decide(m, w, rand)
  } else if (m.mode === 'trapped') {
    // Checked a few times a second: the body that boxed it in keeps moving.
    if (m.modeTime >= 0.15) {
      m.modeTime = 0
      m.mode = 'roam'
      decide(m, w, rand)
    }
  }

  if (m.t < 1) {
    // The cell it is heading into was taken by the body or a new wall: turn
    // back rather than walk through it.
    const into = m.to
    if (onBoard(w, into.x, into.y) && w.blocked(into.x, into.y) && m.t < 0.5) {
      const from = m.from
      m.from = into
      m.to = from
      m.t = 1 - m.t
    }
    m.t = Math.min(1, m.t + speedOf(m.mode) * dt)
    if (m.t >= 1) {
      if (!onBoard(w, m.to.x, m.to.y) && m.mode === 'leave') {
        m.mode = 'gone'
        m.modeTime = 0
      } else {
        decide(m, w, rand)
      }
    }
  }

  const t = m.mode === 'sniff' || m.mode === 'trapped' || m.mode === 'gone' ? 1 : m.t
  m.x = m.from.x + 0.5 + (m.to.x - m.from.x) * t
  m.y = m.from.y + 0.5 + (m.to.y - m.from.y) * t
  if (m.t < 1 && (m.to.x !== m.from.x || m.to.y !== m.from.y)) {
    const target = Math.atan2(m.to.y - m.from.y, m.to.x - m.from.x)
    m.angle = turnToward(m.angle, target, dt * 14)
  }
  return m
}

/** The mouse is where a head can catch it (not already slipping away). */
export function catchable(m: Mouse) {
  return m.mode !== 'gone'
}
