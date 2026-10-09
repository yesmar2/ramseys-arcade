/**
 * Lily Leapers (design-final R8, A): a goo lagoon with big lily pads zig-zagging across it (some still, some
 * spinning, bobbing or sliding), a big still hub pad halfway with the mid flag, and straight down the middle a row
 * of small gold-rimmed pads with wide gaps, the Lily Line, for late dives.
 *
 * The reference round for moving platforms (sim.ts wave, spin), route nodes riding them (`on`), jumps that take
 * off from wherever the bean is near the edge of what it stands on (`takeoff: 'edge'`), late dives, and a mid flag.
 */
import { spin, wave } from '../sim.ts'
import type { MoveFn, RoundDef, RoundOut, RoundSlot, Rng, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** The zig-zag's x either side of the middle, the hub's radius, the gold pads' radius. */
const ZIG = 2.5
const HUB_R = 3.0
const GOLD_R = 1.2

type Pad = { x: number; z: number; r: number; y: number }

/**
 * A half's main pads from a start (the pad edge at z0, or the hub circle) to the hub (or an end edge): n pads of
 * radii rs at x ±ZIG, all gaps g. Returns the pads and where the half ends (the next circle's centre z, or the end
 * edge's z).
 */
function layHalf(from: { edge: number } | Pad, rs: readonly number[], xs: readonly number[], g: number, to: 'hub' | 'edge'): { pads: Pad[]; end: number } {
  const pads: Pad[] = []
  let prev: Pad | null = 'edge' in from ? null : from
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!
    const x = xs[i]!
    let z: number
    if (!prev) z = (from as { edge: number }).edge + g + r
    else {
      const d = prev.r + g + r
      z = prev.z + Math.sqrt(Math.max(0.01, d * d - (x - prev.x) ** 2))
    }
    const pad = { x, z, r, y: 0 }
    pads.push(pad)
    prev = pad
  }
  const lastPad = prev!
  if (to === 'edge') return { pads, end: lastPad.z + lastPad.r + g }
  const d = lastPad.r + g + HUB_R
  return { pads, end: lastPad.z + Math.sqrt(Math.max(0.01, d * d - lastPad.x * lastPad.x)) }
}

/** The main gap that makes a half `want` m long for the Lily Line (bisection: a half grows with its gaps). */
function gapFor(want: number, measure: (g: number) => number, lo: number, hi: number): number {
  let a = lo
  let b = hi
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2
    if (measure(m) < want) a = m
    else b = m
  }
  return (a + b) / 2
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  const [gLo, gHi] = byTier(tier, [
    [2.0, 2.8],
    [2.4, 3.2],
    [2.8, 3.4],
  ] as const)
  const lily = byTier(tier, [6.4, 7.0, 7.6])
  const still = byTier(tier, [0.7, 0.5, 0.4])
  const slides = tier > 1
  const T = slot.period
  // The Lily Line's three gaps a half, edge to edge, and its two pads: the half's length.
  const want = 3 * lily + 4 * GOLD_R
  const firstX = rng.sign() * ZIG

  // Each half: a count of main pads (3–5) whose gaps, in the tier's range, come nearest the Lily Line's length.
  const half = (fromEdge: boolean, hubZ: number, to: 'hub' | 'edge') => {
    let best: { pads: Pad[]; end: number; miss: number } | null = null
    const counts = rng.shuffle([3, 4, 5])
    for (const n of counts) {
      const rs = Array.from({ length: n }, () => rng.between(2.0, 2.6))
      const xs = rs.map((_, i) => (i % 2 === 0 ? firstX : -firstX) * (fromEdge ? 1 : -1))
      const from = fromEdge ? { edge: 0 } : { x: 0, z: hubZ, r: HUB_R, y: 0 }
      const start = fromEdge ? 0 : hubZ + HUB_R
      const span = (g: number) => {
        const laid = layHalf(from, rs, xs, g, to)
        return (to === 'hub' ? laid.end - HUB_R : laid.end) - start
      }
      const g = Math.min(gHi, Math.max(gLo, gapFor(want, span, gLo, gHi)))
      const laid = layHalf(from, rs, xs, g, to)
      const miss = Math.abs(span(g) - want)
      if (!best || miss < best.miss - 0.3) best = { ...laid, miss }
    }
    return best!
  }

  const h1 = half(true, 0, 'hub')
  const hubZ = h1.end
  const h2 = half(false, hubZ, 'edge')
  const endZ = h2.end
  const main = [...h1.pads, ...h2.pads]
  // Heights: steps of up to 0.6 m, within 0.6 of the base.
  let y = 0
  for (const p of main) {
    y = Math.max(-0.6, Math.min(0.6, y + rng.between(-0.6, 0.6)))
    p.y = y
  }

  // The pads: the first of each half still, the rest still or moving by the tier's mix.
  k.camera('wide')
  const mainIdx: number[] = []
  main.forEach((p, i) => {
    let move: MoveFn | undefined
    const first = i === 0 || i === h1.pads.length
    if (!first && !rng.chance(still)) {
      const kind = rng.pick(slides ? (['spin', 'bob', 'slide'] as const) : (['spin', 'bob'] as const))
      if (kind === 'spin') {
        const w = Math.min(rng.between(0.6, 1.0), 2.6 / p.r) * rng.sign()
        move = spin(w, rng.between(0, Math.PI * 2))
      } else if (kind === 'bob') {
        p.y = Math.min(p.y, 0)
        move = wave('y', 0.5, rng.between(3.2, 4.0), rng.between(0, T))
      } else {
        const Ts = rng.between(3.6, 4.4)
        move = wave('x', rng.between(0.6, (1.6 * Ts) / (2 * Math.PI)), Ts, rng.between(0, Ts))
      }
    }
    mainIdx.push(k.cyl({ x: p.x, z: p.z, r: p.r, top: p.y, hy: 0.5, look: 'pad-lily', move }))
  })
  k.cyl({ x: 0, z: hubZ, r: HUB_R, top: 0, hy: 0.6, look: 'pad-lily' })

  // The Lily Line: two small gold pads a half, evenly between the pad edge, the hub and the end.
  const gold: { x: number; z: number; i: number }[] = []
  const goldPads = (z0: number, z1: number) => {
    const g = (z1 - z0 - 4 * GOLD_R) / 3
    for (let j = 0; j < 2; j++) {
      const z = z0 + g * (j + 1) + GOLD_R * (2 * j + 1)
      const spinning = tier > 1 && j === 1 && rng.chance(0.5)
      const i = k.cyl({ x: 0, z, r: GOLD_R, top: 0, hy: 0.4, look: 'pad-gold', gold: true, move: spinning ? spin(rng.between(0.6, 1.0) * rng.sign()) : undefined })
      gold.push({ x: 0, z, i })
    }
  }
  goldPads(0, hubZ - HUB_R)
  goldPads(hubZ + HUB_R, endZ)
  k.deco({ look: 'gold-flag', x: 0, y: 0, z: -0.6, sy: 1.8 })
  k.gold('Lily Line', 0, endZ, 0)
  k.flag(0, hubZ, 'hub')

  // The route: a node on each pad (riding it), jumps from the edge toward the next; the Lily Line in late dives.
  k.node('in', 0, -1.5)
  main.forEach((p, i) => k.node(`p${i}`, p.x, p.z, { y: p.y, on: mainIdx[i] }))
  k.node('hub', 0, hubZ)
  gold.forEach((g, j) => k.node(`g${j}`, g.x, g.z, { on: g.i }))
  k.node('out', 0, endZ + 1.5)
  const n1 = h1.pads.length
  const chain = ['in', ...main.slice(0, n1).map((_, i) => `p${i}`), 'hub', ...main.slice(n1).map((_, i) => `p${n1 + i}`), 'out']
  for (let i = 0; i < chain.length - 1; i++) k.edge(chain[i]!, chain[i + 1]!, 'jump', { takeoff: 'edge', inset: 0.45 })
  const lineChain = ['in', 'g0', 'g1', 'hub', 'g2', 'g3', 'out']
  for (let i = 0; i < lineChain.length - 1; i++) k.edge(lineChain[i]!, lineChain[i + 1]!, 'lateDive', { tier: 'gold', takeoff: 'edge', inset: 0.3 })
  return k.done({ x: 0, y: 0, z: endZ })
}

export const ROUND: RoundDef = {
  letter: 'l',
  name: 'Pad Hop',
  hint: 'hop the pads',
  family: 'A',
  phase: 1,
  build,
}
