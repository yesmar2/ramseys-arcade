import { LANTERN_PLAN } from './lanternPlan.ts'
import { inAir, mulberry32, type Cave } from './sim.ts'

/*
 * Lander's lanterns, with the new look on test (newLook.ts): three a day, each hanging in the cave beside the
 * blue ship's line and out of its reach, on a chain from the roof over it or, down a shaft, on a rope from the
 * wall. Fly your ship into a lantern's gold ring and it's lit, and stays lit for the run, crashes and all; the
 * run's count of them is what it brings home when it lands. They are Swoop's kites, for a cave
 * (swoop/golden.ts): Ramsey, 2026-11-25, asked for "the same redesign ideas" for Lander, and to "Build the
 * three lanterns a day next?": "yes, lanterns".
 *
 * They're lit, not gathered: when he asked for new things to put in the caves (2026-10-06) it was "not gems".
 *
 * Where they hang is worked out once, by scripts/lander-lanterns.mjs, and written down (lanternPlan.ts), so
 * every device has them in the same three places. A cave the plan doesn't know as it is now (the test cave, or
 * a day laid again since the script last ran) gets them worked out on the device, the same way.
 *
 * No imports but the cave's own, and with their endings, so the script can run this with plain Node.
 */

/** A lantern: where it hangs (x, y), and where on the rock its chain is made fast (ax, ay). */
export type Lantern = { x: number; y: number; ax: number; ay: number }

/** How near a lantern the ship's middle has to come to light it, in metres: the gold ring round it. */
export const LIGHT_REACH = 1.7
/** How far off the blue ship's line a lantern hangs: more than the ring's reach, so the line itself lights none. */
const OFF_LINE = 2.6
/** How far outside the ring the blue ship's line has to pass, at its nearest. */
const LINE_CLEAR = 0.45
/** Its chain from a roof: no shorter and no longer than this. From a wall, the rock is this near, or this far. */
const CHAIN_MIN = 1.2
const CHAIN_MAX = 6.5
const WALL_MIN = 2
const WALL_MAX = 5.5
/** One in each of these shares of the way down the cave. */
const THIRDS = [
  [0.1, 0.38],
  [0.38, 0.66],
  [0.66, 0.93],
] as const

const r2 = (v: number) => Math.round(v * 100) / 100

/** How far a point is from a line between two others. */
function fromLine(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax
  const ey = by - ay
  const u = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)))
  return Math.hypot(x - (ax + ex * u), y - (ay + ey * u))
}

/** The main cave's nodes a shortcut goes round, as a span of indices, or null with no shortcut. */
function roundTheFork(cave: Cave): [number, number] | null {
  const branches = cave.lab?.branches ?? []
  let lo = Infinity
  let hi = -Infinity
  for (const B of branches) {
    for (const end of [B[0], B[B.length - 1]]) {
      if (!end) continue
      let best = 0
      let bd = Infinity
      cave.nodes.forEach((p, i) => {
        const d = (p.x - end.x) ** 2 + (p.y - end.y) ** 2
        if (d < bd) {
          bd = d
          best = i
        }
      })
      lo = Math.min(lo, best)
      hi = Math.max(hi, best)
    }
  }
  return hi >= lo ? [lo - 3, hi + 3] : null
}

type Place = Lantern & { s: number; roof: boolean }

/** Whether a lantern could hang at a place: air all round it, the line out of its ring, and nothing of the cave's by it. */
function fits(cave: Cave, x: number, y: number, i: number, line: number): boolean {
  const R = cave.route
  const lab = cave.lab
  // The line itself must stay well out of the ring, either side of its nearest: flying it lights nothing.
  let gap = Infinity
  for (let q = Math.max(0, line - 14); q <= Math.min(R.n - 1, line + 14); q++) gap = Math.min(gap, Math.hypot(R.X[q]! - x, R.Y[q]! - y))
  if (gap < LIGHT_REACH + LINE_CLEAR) return false
  const clear = [
    [0, 0],
    [1.9, 0],
    [-1.9, 0],
    [0, 1.2],
    [1.3, -1.3],
    [-1.3, -1.3],
    [1.3, 1.3],
    [-1.3, 1.3],
    [0, -1.8],
  ].every(([dx, dy]) => inAir(cave, x + dx!, y + dy!, i))
  if (!clear) return false
  // Not at a gate, by a pad or in a room; nor in, over or beside any of the cave's things.
  if (cave.gates.some((g) => Math.abs(g.i - i) < 5)) return false
  if (cave.rooms.some((m) => x > m.x0 - 4 && x < m.x1 + 4 && y > m.y0 - 4 && y < m.y1 + 4)) return false
  if (cave.pillars.some((c) => Math.hypot(x - c.x, y - c.y) < c.r + 2.6)) return false
  if (lab) {
    if (lab.pools.some((w) => x > w.x0 - 1 && x < w.x1 + 1 && y < w.y + 2.4)) return false
    if (lab.lava.some((l) => x > l.x0 - 2 && x < l.x1 + 2 && y > l.y0 && y < l.y1 + 8)) return false
    if (lab.spinners.some((sp) => Math.hypot(x - sp.x, y - sp.y) < sp.half + 3)) return false
    if (lab.crushers.some((c) => fromLine(x, y, c.ax, c.ay, c.bx, c.by) < Math.max(c.hw, c.hh) + 3.5)) return false
    if (lab.vents.some((v) => fromLine(x, y, v.x, v.y, v.x + Math.cos(v.dir) * (v.reach + 2), v.y + Math.sin(v.dir) * (v.reach + 2)) < v.wide / 2 + 2.2)) return false
    if (lab.bubbles.some((u) => Math.hypot(x - u.x, y - u.y) < u.r + 1)) return false
  }
  return true
}

/** Every place in a cave a lantern could hang, with how far down the cave it is. */
function places(cave: Cave): Place[] {
  const N = cave.nodes
  const R = cave.route
  const fork = roundTheFork(cave)
  const found: Place[] = []
  for (let i = 6; i < N.length - 8; i++) {
    if (fork && i >= fork[0] && i <= fork[1]) continue
    const a = N[i - 1]!
    const b = N[i + 1]!
    const p = N[i]!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const tx = (b.x - a.x) / len
    const ty = (b.y - a.y) / len
    // The blue ship's line here: the point of it nearest this node.
    let near = 0
    let nd = Infinity
    for (let q = 0; q < R.n; q++) {
      const d = (R.X[q]! - p.x) ** 2 + (R.Y[q]! - p.y) ** 2
      if (d < nd) {
        nd = d
        near = q
      }
    }
    if (Math.abs(tx) >= 0.62) {
      // A roof over the tunnel, near enough level: on a chain straight down from it, over the line.
      const x = r2(p.x + -ty * (tx < 0 ? -1 : 1) * p.r)
      const roof = r2(p.y + Math.abs(tx) * p.r)
      let under = near
      for (let q = Math.max(0, near - 8); q <= Math.min(R.n - 1, near + 8); q++) {
        if (Math.abs(R.X[q]! - x) < Math.abs(R.X[under]! - x)) under = q
      }
      if (Math.abs(R.X[under]! - x) > 1) continue
      const y = r2(R.Y[under]! + OFF_LINE)
      if (roof - y < CHAIN_MIN || roof - y > CHAIN_MAX) continue
      if (!inAir(cave, x, y - OFF_LINE, i) || !fits(cave, x, y, i, under)) continue
      found.push({ x, y, ax: x, ay: roof, s: p.s, roof: true })
    } else {
      // Down a shaft there's no roof: beside the line, on a rope from the wall on that side, made fast a little higher.
      for (const side of [-1, 1]) {
        const x = r2(R.X[near]! + side * OFF_LINE)
        const y = r2(R.Y[near]!)
        if (!fits(cave, x, y, i, near)) continue
        const up = y + 1.6
        let out = 0
        while (out <= WALL_MAX && inAir(cave, x + side * out, up, i)) out += 0.1
        if (out < WALL_MIN || out > WALL_MAX) continue
        found.push({ x, y, ax: r2(x + side * out), ay: r2(up), s: p.s, roof: false })
      }
    }
  }
  return found
}

/**
 * A cave's three lanterns, worked out from its shape: one in each third of the way down, picked by the cave's
 * own number from the places one could hang, a roof's before a wall's. Fewer than three only in a cave with
 * nowhere to hang one.
 */
export function layLanterns(cave: Cave): Lantern[] {
  const all = places(cave)
  const length = cave.length || 1
  const rnd = mulberry32((cave.n + 1) * 104729 + cave.attempt * 31)
  const picked: Place[] = []
  const apart = (c: Place) => picked.every((p) => Math.abs(p.s - c.s) > 45)
  for (const [from, to] of THIRDS) {
    const here = all.filter((c) => c.s >= from * length && c.s < to * length && apart(c))
    const roofs = here.filter((c) => c.roof)
    const pool = roofs.length ? roofs : here
    const pick = rnd()
    if (pool.length) picked.push(pool[Math.floor(pick * pool.length)]!)
  }
  // A third with nowhere to hang one: anywhere else that's well away from the others.
  while (picked.length < THIRDS.length) {
    const rest = all.filter(apart)
    if (!rest.length) break
    picked.push(rest[Math.floor(rnd() * rest.length)]!)
  }
  return picked.sort((a, b) => a.s - b.s).map(({ x, y, ax, ay }) => ({ x, y, ax, ay }))
}

/** A cave's lanterns: as the plan has them, if it knows the cave as it is; else worked out here. */
export function lanternsOf(cave: Cave): Lantern[] {
  // The test cave is no day's (its number is 0): it isn't in the plan.
  const line = cave.n < 1 ? undefined : LANTERN_PLAN[cave.n - 1]
  if (line && line[0] === cave.nodes.length && (line.length - 1) % 4 === 0) {
    const out: Lantern[] = []
    for (let i = 1; i + 3 < line.length; i += 4) out.push({ x: line[i]!, y: line[i + 1]!, ax: line[i + 2]!, ay: line[i + 3]! })
    return out
  }
  return layLanterns(cave)
}

/* ---------------------------------------------------------------- what a device keeps --- */

const BEST_KEY = 'skermix-lander-lanterns'
const KNOWN_KEY = 'skermix-lander-lantern-known'

/** The most lanterns a run has brought home on a day, on this device: for the start card. */
export function lanternBest(day: string): number {
  try {
    const kept = JSON.parse(localStorage.getItem(BEST_KEY) ?? 'null') as { day?: string; n?: number } | null
    return kept && kept.day === day && typeof kept.n === 'number' ? Math.max(0, Math.min(3, Math.floor(kept.n))) : 0
  } catch {
    return 0
  }
}

export function keepLanternBest(day: string, n: number) {
  try {
    if (n > lanternBest(day)) localStorage.setItem(BEST_KEY, JSON.stringify({ day, n }))
  } catch {
    /* nothing kept: the card shows none */
  }
}

/** Whether this device has ever lit one: until it has, a run says how. */
export function lanternKnown(): boolean {
  try {
    return localStorage.getItem(KNOWN_KEY) === '1'
  } catch {
    return false
  }
}

export function noteLanternLit() {
  try {
    localStorage.setItem(KNOWN_KEY, '1')
  } catch {
    /* told again next time */
  }
}
