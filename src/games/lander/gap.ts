import type { Ghost } from './runs'
import { GHOST_RATE, GHOST_STRIDE, WRECKED, type Cave } from './sim'

/*
 * The gap to the run you race, all the way down: with Lander's new look (newLook.ts) the heads-up's box shows
 * it ten times a second, not only at a gate, as Swoop's does. A cave has no straight line to measure along,
 * so the gap is in time at the same place: how far down the cave's middle line you are, and when the run you
 * race was first that far.
 */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** The node nearest a place, anywhere in the cave. */
function nearestOfAll(cave: Cave, x: number, y: number): number {
  const N = cave.nodes
  let best = 0
  let bd = Infinity
  for (let i = 0; i < N.length; i++) {
    const d = (x - N[i]!.x) ** 2 + (y - N[i]!.y) ** 2
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

/** The node nearest a place, looking a little either side of the one it was nearest a moment ago. */
function nearestBy(cave: Cave, x: number, y: number, hint: number): number {
  const N = cave.nodes
  let best = hint
  let bd = Infinity
  for (let i = Math.max(0, hint - 12), hi = Math.min(N.length - 1, hint + 12); i <= hi; i++) {
    const d = (x - N[i]!.x) ** 2 + (y - N[i]!.y) ** 2
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

/**
 * How far down the cave a place is: metres along its middle line, from the nearer of the two stretches that
 * meet at the node it's nearest (`hint`, as the ship keeps its own: sim.ts Ship).
 */
export function progressAt(cave: Cave, x: number, y: number, hint: number): number {
  const N = cave.nodes
  const i = clamp(hint, 0, N.length - 1)
  const a = N[i]!
  let best = a.s
  let bd = (x - a.x) ** 2 + (y - a.y) ** 2
  for (const j of [i - 1, i]) {
    if (j < 0 || j + 1 >= N.length) continue
    const p = N[j]!
    const q = N[j + 1]!
    const ex = q.x - p.x
    const ey = q.y - p.y
    const u = clamp(((x - p.x) * ex + (y - p.y) * ey) / (ex * ex + ey * ey || 1), 0, 1)
    const d = (x - (p.x + ex * u)) ** 2 + (y - (p.y + ey * u)) ** 2
    if (d < bd) {
      bd = d
      best = p.s + (q.s - p.s) * u
    }
  }
  return best
}

/** Farther than this between two of a ghost's samples is a crash's ship put back at its gate (runs.ts JUMP). */
const JUMP = 8

/**
 * When a run was first each metre down the cave: its moment at 0 m, 1 m, 2 m and so on to the cave's end. Null
 * for a run with no path to speak of (one that waits on the start pad until its own comes).
 */
export function reachTimes(cave: Cave, ghost: Ghost): Float32Array | null {
  const g = ghost.run.ghost
  const samples = g.length / GHOST_STRIDE
  if (samples < 40) return null
  const end = Math.ceil(cave.length) + 2
  const reach = new Float32Array(end + 1).fill(NaN)
  let hint = nearestOfAll(cave, g[0]!, g[1]!)
  let top = progressAt(cave, g[0]!, g[1]!, hint)
  for (let m = 0; m <= Math.min(end, Math.floor(top)); m++) reach[m] = 0
  let px = g[0]!
  let py = g[1]!
  for (let k = 1; k < samples; k++) {
    const x = g[k * GHOST_STRIDE]!
    const y = g[k * GHOST_STRIDE + 1]!
    if (g[k * GHOST_STRIDE + 3] === WRECKED) continue
    hint = Math.hypot(x - px, y - py) > JUMP ? nearestOfAll(cave, x, y) : nearestBy(cave, x, y, hint)
    px = x
    py = y
    const p = progressAt(cave, x, y, hint)
    if (p <= top) continue
    const t0 = (k - 1) / GHOST_RATE
    const t1 = k / GHOST_RATE
    for (let m = Math.floor(top) + 1; m <= Math.min(end, Math.floor(p)); m++) reach[m] = t0 + ((m - top) / (p - top)) * (t1 - t0)
    top = p
  }
  // Past where it stopped, it was there when it landed.
  for (let m = 0; m <= end; m++) if (Number.isNaN(reach[m]!)) reach[m] = ghost.run.time
  return reach
}

/** How far behind the raced run you are at a place down the cave, in seconds: less than nothing is ahead. */
export function gapAt(reach: Float32Array, progress: number, t: number): number {
  const at = clamp(progress, 0, reach.length - 1)
  const i = Math.floor(at)
  const a = reach[i]!
  const b = reach[Math.min(reach.length - 1, i + 1)]!
  return t - (a + (b - a) * (at - i))
}
