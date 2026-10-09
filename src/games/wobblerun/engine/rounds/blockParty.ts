/**
 * Block Party (design-final R2, T): a 9 m runway, and at its far end a striped arch spitting out translucent jelly
 * walls that slide toward you. Each wall has gold-outlined cut-outs: one door to run through, and on harder days a
 * hurdle to jump (orange: the wall only 0.8 m tall there) and a slot to dive under (violet: the wall starts 1.3 m
 * up). The walls rise out of the floor as they leave the arch and sink into it near the start, so the first 3.2 m is
 * a lead-in nothing reaches. A wall that catches you yeets you up and back over it: about 1.6 s, never a splat.
 *
 * Each wall is the wall minus its cut-outs, as hazard boxes on paths (sim.ts PathSpec): wall k leaves the arch at
 * t₀ + k·P wearing layout k mod n, so layout j's pieces are each a path released every n·P from t₀ + j·P. Their
 * motion sinks them by lowering `o.y` and setting `o.hy`. Doors sit on five lanes, two or three lanes on from the
 * last wall's (2.9 or 4.35 m), and the route is a grid on those lanes: the blue waits in the lead-in or between
 * walls, steps across to the next wall's door and lets it go by. Hurdles and slots are the fast hands' (gold).
 */
import { R, releaseTele, yeet } from '../sim.ts'
import type { Offset, PathSpec, RoundDef, RoundOut, RoundSlot, Rng, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** A wall: 8.9 m across, 2.6 m tall, 1 m thick. A hurdle's top; a slot's underside. */
const WALL_HX = 4.45
const WALL_H = 2.6
const WALL_HZ = 0.5
const HURDLE_TOP = 0.8
const SLOT_BOTTOM = 1.3
/** A hurdle or slot is this wide (narrowed to no less than CUT_LEAST to fit beside the door); posts between cut-outs. */
const CUT_W = 3.0
const CUT_LEAST = 2.6
const POST = 0.25
/** The doors' centres: five lanes 1.45 m apart. */
const LANE = 1.45
const LANES = [-2, -1, 0, 1, 2].map((i) => i * LANE)
/** A wall sinks from its front face at SINK_FROM to nothing at SINK_TO (the lead-in), and rises over RISE m out of the arch. */
const SINK_FROM = 4.0
const SINK_TO = 3.2
const RISE = 0.8
/** The route's rows: the first in the lead-in, the last LAST_BACK before the arch, about ROW apart. */
const ROW0 = 1.6
const ROW = 4.5
const LAST_BACK = 3.0
/**
 * The route's windows guess a bean's way along an edge as a straight line at WAY_V once it's going (WAY_LAG s), and
 * WAY_STOP s more to stop. A spot is worth stepping to only if the next wall's door is there or that wall is
 * MOVE_ON s away; a way is clear unless, give or take WAY_SLACK s, the bean would surely meet a wall outside its
 * door (by more than WAY_TOL m). Both only ever rule out ways that can't work, or that end where a wall is coming.
 */
const MOVE_ON = 1.4
const WAY_V = 6.4
const WAY_LAG = 0.15
const WAY_STOP = 0.15
const WAY_SLACK = 0.2
const WAY_TOL = 0.2

type Cut = { kind: 'door' | 'hurdle' | 'slot'; x0: number; x1: number }
type Piece = { kind: 'full' | 'hurdle' | 'slot'; x0: number; x1: number; y0: number; y1: number }

/** The layouts' door lanes, a cycle: each two or three lanes on from the one before (the last from the first too). */
function doorLanes(rng: Rng, n: number): number[] {
  for (let tries = 0; tries < 400; tries++) {
    const seq = [rng.int(0, 4)]
    for (let i = 1; i < n; i++) {
      const d = seq[i - 1]!
      seq.push(rng.pick([d - 3, d - 2, d + 2, d + 3].filter((x) => x >= 0 && x <= 4)))
    }
    const wrap = Math.abs(seq[n - 1]! - seq[0]!)
    if (wrap >= 2 && wrap <= 3) return seq
  }
  // An even cycle always closes.
  return Array.from({ length: n - (n % 2) }, (_, i) => (i % 2 ? 3 : 1))
}

/** A wall with its door on `lane` and `extras` cut-outs beside it: its pieces (the wall minus its cut-outs). */
function layout(rng: Rng, lane: number, doorW: number, extras: readonly ('hurdle' | 'slot')[]): Piece[] {
  const dx = LANES[lane]!
  const cuts: Cut[] = [{ kind: 'door', x0: dx - doorW / 2, x1: dx + doorW / 2 }]
  let free: [number, number][] = [
    [-WALL_HX, dx - doorW / 2 - POST],
    [dx + doorW / 2 + POST, WALL_HX],
  ]
  for (const kind of extras) {
    const fits = free.filter(([a, b]) => b - a >= CUT_LEAST)
    if (!fits.length) break
    const span = rng.pick(fits)
    const [a, b] = span
    const w = Math.min(CUT_W, b - a)
    let x0 = a + rng.between(0, b - a - w)
    // No sliver of wall left at the runway's edge.
    if (a === -WALL_HX && x0 - a < POST) x0 = a
    if (b === WALL_HX && b - (x0 + w) < POST) x0 = b - w
    cuts.push({ kind, x0, x1: x0 + w })
    free = free.filter((f) => f !== span)
    free.push([a, x0 - POST], [x0 + w + POST, b])
  }
  cuts.sort((p, q) => p.x0 - q.x0)
  const pieces: Piece[] = []
  let at = -WALL_HX
  for (const c of cuts) {
    if (c.x0 - at > 0.01) pieces.push({ kind: 'full', x0: at, x1: c.x0, y0: 0, y1: WALL_H })
    if (c.kind === 'hurdle') pieces.push({ kind: 'hurdle', x0: c.x0, x1: c.x1, y0: 0, y1: HURDLE_TOP })
    if (c.kind === 'slot') pieces.push({ kind: 'slot', x0: c.x0, x1: c.x1, y0: SLOT_BOTTOM, y1: WALL_H })
    at = c.x1
  }
  if (WALL_HX - at > 0.01) pieces.push({ kind: 'full', x0: at, x1: WALL_HX, y0: 0, y1: WALL_H })
  return pieces
}

/**
 * A wall piece's path from y0 to y1 (anchored at its full-height centre, at the arch): it slides toward the start at
 * v, rising out of the floor over its first RISE m and sinking into it between SINK_FROM and SINK_TO (its front
 * face), gone once it's under.
 */
function piecePath(P: number, ph: number, birth: number, v: number, y0: number, y1: number): PathSpec {
  const yc = (y0 + y1) / 2
  return {
    P,
    ph,
    life: (birth - WALL_HZ - SINK_TO) / v,
    at: (tau: number, _k: number, o: Offset) => {
      const front = birth - WALL_HZ - v * tau
      const s = Math.max(0, Math.min(1, (v * tau) / RISE, (front - SINK_TO) / (SINK_FROM - SINK_TO)))
      const drop = WALL_H * (1 - s)
      const top = y1 - drop
      const bottom = Math.max(0, y0 - drop)
      o.z = -v * tau
      if (top - bottom < 0.02) {
        o.on = false
        return
      }
      o.y = (top + bottom) / 2 - yc
      o.hy = (top - bottom) / 2
    },
  }
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  const L = rng.between(48, 60)
  const v = byTier(tier, [4.0, 4.8, 5.5])
  const doorW = byTier(tier, [3.0, 2.4, 2.0])
  // The period: the round's own (2.9–4.4 s) spread over 0.8 s from the least that keeps 1.5 s between meeting walls
  // at a full run (v·P / (7.2 + v)), and never under 3.6 s.
  const least = Math.max(3.6, (1.5 * (7.2 + v)) / v)
  const P = least + (0.8 * (slot.period - 2.9)) / 1.5
  const n = rng.int(6, 8)
  const t0 = rng.between(0, P)
  // Walls are born with their back face at the runway's end, under the arch.
  const birth = L - WALL_HZ

  k.floor(0, L)
  k.walls(0, L)

  // The layouts: a door on a lane two or three on from the last wall's, and the tier's hurdles and slots beside it.
  const lanes = doorLanes(rng, n)
  const count = lanes.length
  let tele = -1
  const has = { hurdle: false, slot: false, full: false }
  lanes.forEach((lane, j) => {
    const extras: ('hurdle' | 'slot')[] =
      tier === 1 ? (rng.chance(0.5) ? ['hurdle'] : []) : tier === 2 ? [rng.pick(['hurdle', 'slot'] as const)] : [rng.pick(['hurdle', 'slot'] as const), rng.pick(['hurdle', 'slot'] as const)]
    for (const p of layout(rng, lane, doorW, extras)) {
      has[p.kind] = true
      const i = k.hazard({
        shape: 'box',
        x: (p.x0 + p.x1) / 2,
        y: (p.y0 + p.y1) / 2,
        z: birth,
        hx: (p.x1 - p.x0) / 2,
        hy: (p.y1 - p.y0) / 2,
        hz: WALL_HZ,
        hit: yeet({ x: 0, y: 10, z: 0 }, 0.6),
        look: 'wall-jelly',
        role: p.kind === 'hurdle' ? 'jump' : p.kind === 'slot' ? 'dive' : 'jelly',
        path: piecePath(count * P, t0 + j * P, birth, v, p.y0, p.y1),
        // The arch's whomp: one piece carries the telegraph for every wall leaving it.
        tele: tele < 0 ? releaseTele(P, t0, 0.8) : undefined,
      })
      if (tele < 0) tele = i
    }
  })
  k.deco({ look: 'arch', x: 0, y: 0, z: L - WALL_HZ, sx: 10, sy: 4, sz: 1.4, params: { stripes: true }, ref: { kind: 'hazard', i: tele } })

  // Wall kk (leaving the arch at t₀ + kk·P, born or not): its centre at τ, and its door's lane.
  const centre = (kk: number, tau: number) => birth - v * (tau - t0 - kk * P)
  const doorOf = (kk: number) => lanes[((kk % count) + count) % count]!
  // A spot is worth getting to if no wall reaches it (the lead-in), the door of the next wall to reach it (the
  // nearest whose back face hasn't passed a bean there) is there, or there's time to move on before that wall comes.
  const worth = (z: number, j: number, tau: number) => {
    if (z < SINK_TO) return true
    const kk = Math.ceil((z - R - WALL_HZ - birth + v * (tau - t0)) / (v * P))
    return doorOf(kk) === j || (centre(kk, tau) - WALL_HZ - z - R) / v >= MOVE_ON
  }
  // Whether a bean setting off at t from (xa, za) along a straight line to (xb, zb) could meet every wall on the way
  // at its door: no only when, give or take WAY_SLACK s, it's surely outside the door as the wall goes by. Walls
  // sinking near the start or rising out of the arch are left to the run.
  const half = doorW / 2 - R + WAY_TOL
  const clear = (xa: number, za: number, xb: number, zb: number, t: number) => {
    const dx = xb - xa
    const dz = zb - za
    const T = Math.hypot(dx, dz) / WAY_V
    const ts = t + WAY_LAG
    const g1 = dz + v * T
    if (g1 <= 1e-6) return true
    const k0 = Math.ceil((Math.min(za, zb) - R - WALL_HZ - birth + v * (ts - t0)) / (v * P))
    const k1 = Math.floor((Math.max(za, zb) + R + WALL_HZ - birth + v * (ts + T - t0)) / (v * P))
    for (let kk = k0; kk <= k1; kk++) {
      // The bean's z less the wall's centre is g0 + g1·f along the way (f from 0 to 1): they meet while it's within reach.
      const g0 = za - centre(kk, ts)
      const slack = (WAY_SLACK * v) / g1
      const f0 = Math.max(0, (-WALL_HZ - R - g0) / g1 - slack)
      const f1 = Math.min(1, (WALL_HZ + R - g0) / g1 + slack)
      if (f0 > f1) continue
      const zm = centre(kk, ts + (T * (f0 + f1)) / 2)
      if (zm < SINK_FROM + WALL_HZ || zm > birth - RISE) continue
      const xd = LANES[doorOf(kk)]!
      const x0 = xa + dx * f0
      const x1 = xa + dx * f1
      if (Math.max(x0, x1) < xd - half || Math.min(x0, x1) > xd + half) return false
    }
    return true
  }

  // The route: a grid on the door lanes, the first row in the lead-in. From each spot: on a row (straight or a lane
  // either side), or across the row to any lane, when the way is clear and where it gets to is worth it (so hands
  // that choose one way at a time never step into a lane a wall is about to fill); hurdles and slots for the fast
  // hands (a jump or a dive on along a lane, which works only when one comes by).
  const rows = Math.max(2, Math.round((L - LAST_BACK - ROW0) / ROW) + 1)
  const dz = (L - LAST_BACK - ROW0) / (rows - 1)
  const id = (r: number, j: number) => `n${r}_${j}`
  const rowZ = (r: number) => ROW0 + r * dz
  const step = (r: number, j: number, r2: number, j2: number) => {
    const [xa, za, xb, zb] = [LANES[j]!, rowZ(r), LANES[j2]!, rowZ(r2)]
    const travel = WAY_LAG + Math.hypot(xb - xa, zb - za) / WAY_V + WAY_STOP
    k.edge(id(r, j), id(r2, j2), 'run', { window: (t) => clear(xa, za, xb, zb, t) && worth(zb, j2, t + travel) })
  }
  k.node('in', 0, -1.5)
  for (let r = 0; r < rows; r++) for (let j = 0; j < LANES.length; j++) k.node(id(r, j), LANES[j]!, rowZ(r))
  k.node('out', 0, L + 1.5)
  for (let j = 0; j < LANES.length; j++) {
    k.edge('in', id(0, j))
    k.edge(id(rows - 1, j), 'out')
  }
  // The ways on come first (straight ahead, then a lane either side): with nothing clean, the live hands take a
  // spot's first way out. Steps across go at most three lanes (doors move two or three).
  for (let r = 0; r < rows; r++) {
    for (let j = 0; j < LANES.length; j++) {
      if (r < rows - 1) for (const j2 of [j, j - 1, j + 1]) if (j2 >= 0 && j2 < LANES.length) step(r, j, r + 1, j2)
      for (let j2 = 0; j2 < LANES.length; j2++) if (j2 !== j && Math.abs(j2 - j) <= 3) step(r, j, r, j2)
      if (r < rows - 1 && has.hurdle) k.edge(id(r, j), id(r + 1, j), 'jump', { tier: 'gold' })
      if (r < rows - 1 && has.slot) k.edge(id(r, j), id(r + 1, j), 'dive', { tier: 'gold' })
    }
  }
  return k.done({ x: 0, y: 0, z: L })
}

export const ROUND: RoundDef = {
  letter: 'b',
  name: 'Wall Rush',
  hint: 'find the gap',
  family: 'T',
  phase: 1,
  build,
}
