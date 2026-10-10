/**
 * Lily Leapers (design-final R8, A): a goo lagoon with big lily pads zig-zagging across it (some still, some
 * spinning, bobbing or sliding), a big still hub pad halfway with the mid flag, and straight down the middle a row
 * of small gold-rimmed pads with wide gaps, the Lily Line, for late dives.
 *
 * The reference round for moving platforms (sim.ts wave, spin), route nodes riding them (`on`), jumps that take
 * off from wherever the bean is near the edge of what it stands on (`takeoff: 'edge'`), late dives, and a mid flag.
 *
 * Generation 2 (build2, below) makes the lagoon go up and down, with pads you can only cross on their beat: lifts,
 * ferries and leaves.
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
  if (k.gen >= 2) return build2(slot, rng, tier)
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

/* ------------------------------------------------------------------ generation 2 --- */

/*
 * Generation 2: the lagoon goes up and down, 3–4 m of it. Each half climbs and then drops back to the base, and the
 * climb has the pads you can only cross on their beat (a player who waits a moment on the pad before gets across; one
 * who just runs falls in a fair share of the time):
 *
 * - a LIFT: a pad bobbing ±0.75–0.85 m with the next pad 1.8 m over its middle, a 1.0 m step from the top of its
 *   bob and out of reach from the bottom (jump off it as it rises: the rise carries into the jump);
 * - a FERRY (T2 and up): a pad sliding up and down the course, a short hop from the pad before at one end of its
 *   slide and from the pad after at the other: hop on as it comes, ride it, hop off as it gets there;
 * - a LEAF (T2 and up): a long narrow pad turning slowly, low in the lagoon under the Lily Line, whose tip reaches the
 *   next pad only while it points that way: stand in its middle and go as it swings round.
 *
 * Drops are free (a longer fall reaches further). T1 has one gentle lift; T2 a lift, a leaf and a ferry; T3 a ferry,
 * a lift and a leaf on smaller pads (r 1.4–1.8; T2 1.6–2.0, T1 2.0–2.4) with longer gaps. The hub (the mid flag) and
 * the pad after stay at the base, and the Lily Line runs flat down the middle as before, under the climbs: the expert's
 * way skips them. The main lane keeps out of the Lily Line's lane (LANE_CLEAR), and the gold pads go where no main pad
 * meets them, with gaps a hop or a late dive can take.
 */
/** How far the main lane's pads keep their inner edge from the middle (the Lily Line's lane); the hub's radius. */
const LANE_CLEAR = 0.65
const HUB2_R = 2.6
/** The main lane's pads are 0.6 m deep (gen 1's are 1.0), so a high one's underside clears a gold pad. */
const PAD_HY = 0.3
/** A leaf's half length and half width, how near its tip comes to the pad before it, and how high it lies. */
const LEAF_HX = 3.0
const LEAF_HZ = 0.75
const LEAF_CLEAR = 0.7
const LEAF_Y = -0.35
/**
 * The Lily Line's gaps, edge to edge. Onto a gold pad a gap is a hop (up to GOLD_HOP) or a late dive (GOLD_DIVE: a
 * dive across a shorter gap overshoots a gold pad), never between. Off the pad before the round, the first gap also
 * keeps out of GOLD_LEDGE: a belly hop off the start's slide would come down on the gold pad's edge (a ledge catch keeps
 * the air dive used, and the next late dive fails). Onto the hub or the pad after, anything up to GOLD_ONTO (big
 * enough to land on long or short). GOLD_AIM is the gap the line prefers. How far a gold pad keeps from a main pad in
 * plan, unless the main pad's underside stays over the gold pad's top.
 */
const GOLD_HOP = 5.2
const GOLD_DIVE: readonly [number, number] = [6.0, 7.8]
const GOLD_LEDGE: readonly [number, number] = [5.3, 6.6]
const GOLD_ONTO = 8.2
const GOLD_LEAST = 4.0
const GOLD_AIM = 7.0
const GOLD_CLEAR = 0.15
const GOLD_OVER = 0.05

/** Whether a gap onto a gold pad can be taken (a hop or a late dive), and off the pad before the round. */
const goldGap = (gap: number) => (gap >= GOLD_LEAST && gap <= GOLD_HOP) || (gap >= GOLD_DIVE[0] && gap <= GOLD_DIVE[1])
const goldFirst = (gap: number) => goldGap(gap) && !(gap > GOLD_LEDGE[0] && gap < GOLD_LEDGE[1])

/**
 * Where a half's gold pads go, between the pad edge (or the hub's) at z0 and the one at z1: as few as the gaps allow
 * (two to four), each where `clear` says, every gap one that can be taken (`first` says for the first), the gaps as
 * near GOLD_AIM as the clear places allow (a search over a 0.1 m grid). With no such places, evenly, as gen 1 lays them.
 */
function goldSpots(z0: number, z1: number, clear: (z: number) => boolean, first: (gap: number) => boolean): number[] {
  for (const n of [2, 3, 4]) {
    if ((z1 - z0 - 2 * n * GOLD_R) / (n + 1) > GOLD_DIVE[1]) continue
    const pts: number[] = []
    for (let z = z0 + GOLD_R + GOLD_LEAST; z <= z1 - GOLD_R - GOLD_LEAST + 1e-9; z += 0.1) if (clear(z)) pts.push(z)
    const m = pts.length
    let cost = pts.map((z) => (first(z - GOLD_R - z0) ? (z - GOLD_R - z0 - GOLD_AIM) ** 2 : Infinity))
    const back: number[][] = []
    for (let j = 1; j < n; j++) {
      const next: number[] = new Array<number>(m).fill(Infinity)
      const from: number[] = new Array<number>(m).fill(-1)
      for (let p = 0; p < m; p++) {
        for (let q = 0; q < p; q++) {
          const gap = pts[p]! - pts[q]! - 2 * GOLD_R
          if (cost[q] === Infinity || !goldGap(gap)) continue
          const c = cost[q]! + (gap - GOLD_AIM) ** 2
          if (c < next[p]!) {
            next[p] = c
            from[p] = q
          }
        }
      }
      back.push(from)
      cost = next
    }
    let best = -1
    let least = Infinity
    for (let p = 0; p < m; p++) {
      const gap = z1 - pts[p]! - GOLD_R
      if (cost[p] === Infinity || gap < GOLD_LEAST || gap > GOLD_ONTO) continue
      const c = cost[p]! + (gap - GOLD_AIM) ** 2
      if (c < least) {
        least = c
        best = p
      }
    }
    if (best < 0) continue
    const at = [best]
    for (let j = n - 2; j >= 0; j--) at.unshift(back[j]![at[0]!]!)
    return at.map((p) => pts[p]!)
  }
  const n = (z1 - z0 - 4 * GOLD_R) / 3 <= GOLD_DIVE[1] ? 2 : 3
  const even = (z1 - z0 - 2 * n * GOLD_R) / (n + 1)
  return Array.from({ length: n }, (_, j) => z0 + even * (j + 1) + GOLD_R * (2 * j + 1))
}

type Kind = 'still' | 'spin' | 'lift' | 'ferry' | 'leaf'
/**
 * One pad of a half as planned: its kind, its height over the pad before (a lift's: its middle's), the gap before it
 * (the half's own by default), and `line`: on the same side as the pad before, straight on from it (else across).
 */
type Step = { kind: Kind; dy: number; gap?: number; line?: boolean }
type Pad2 = {
  kind: Kind
  x: number
  /** Its centre's z at its static pose (a ferry's middle); its top's height (a lift's middle). */
  z: number
  y: number
  r: number
  /** Lift and ferry: amplitude, period and phase; leaf and spin: turn rate and phase. */
  a: number
  T: number
  ph: number
  w: number
  gap: number
}

function build2(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('wide')
  const [rLo, rHi] = byTier(tier, [
    [2.0, 2.4],
    [1.6, 2.0],
    [1.4, 1.8],
  ] as const)
  const [gLo, gHi] = byTier(tier, [
    [2.0, 2.6],
    [2.4, 3.0],
    [2.6, 3.1],
  ] as const)
  const g = rng.between(gLo, gHi)
  // The timed pads: the lift's bob, its high pad (over its middle) and the gap to it; the ferry's slide and the gaps at
  // its ends; the leaf's gap from its tip and its turn. Each tuned so a player who never waits falls there about one
  // run in eight to six (nearer one in five for T3's ferry and leaf); the leaf's gap varies a little by the day.
  const liftA = byTier(tier, [0.75, 0.8, 0.85])
  const liftUp = 1.8
  const liftGap = byTier(tier, [rng.between(2.9, 3.0), rng.between(3.1, 3.25), rng.between(3.1, 3.3)])
  const ferryA = byTier(tier, [0, 1.3, 1.25])
  const ferryGap = byTier(tier, [0, 2.6, 2.65])
  const leafGap = byTier(tier, [0, rng.between(2.8, 2.9), rng.between(2.86, 2.96)])
  const leafW = byTier(tier, [0, 0.75, 0.9])
  const up = () => rng.between(0.35, 0.5)
  /** The rise to the pad before a lift: high enough that the lift's lowest clears the Lily Line's pads. */
  const toLift = (from: number, a: number) => Math.max(0.35, a + 0.65 - from)

  // The halves, as heights over the pad before (the first: over the base; a lift's: its middle's; the pad after a lift
  // is liftUp over that). Half 1 climbs to its lift and the high pad and drops to the hub; half 2 (T2 and up) starts on
  // the leaf, low in the lagoon, and climbs to the drop onto the pad after.
  const p0 = rng.between(0.65, 0.75)
  const h1: Step[] = byTier(tier, [
    [{ kind: 'still', dy: p0 }, { kind: 'still', dy: toLift(p0, liftA) }, { kind: 'lift', dy: rng.between(0, 0.1) }, { kind: 'still', dy: liftUp, gap: liftGap }, { kind: 'still', dy: -rng.between(1.0, 1.3) }],
    [{ kind: 'still', dy: p0 }, { kind: 'spin', dy: toLift(p0, liftA) }, { kind: 'lift', dy: rng.between(0, 0.1) }, { kind: 'still', dy: liftUp, gap: liftGap }, { kind: 'still', dy: -rng.between(1.0, 1.3) }],
    [{ kind: 'still', dy: p0 }, { kind: 'ferry', dy: up(), gap: ferryGap, line: true }, { kind: 'still', dy: up(), gap: ferryGap, line: true }, { kind: 'lift', dy: rng.between(0, 0.1) }, { kind: 'still', dy: liftUp, gap: liftGap }],
  ] as [Step[], Step[], Step[]])
  const h2: Step[] = byTier(tier, [
    [{ kind: 'still', dy: p0 }, { kind: 'spin', dy: up() }, { kind: 'still', dy: up() }, { kind: 'still', dy: up() }],
    [{ kind: 'leaf', dy: LEAF_Y }, { kind: 'still', dy: 1.0, gap: leafGap, line: true }, { kind: 'ferry', dy: up(), gap: ferryGap, line: true }, { kind: 'still', dy: up(), gap: ferryGap, line: true }],
    [{ kind: 'leaf', dy: LEAF_Y }, { kind: 'still', dy: 1.0, gap: leafGap, line: true }, { kind: 'still', dy: up() }, { kind: 'spin', dy: up() }],
  ] as [Step[], Step[], Step[]])

  // The pads' sides (zig-zagging across the Lily Line, or straight on), sizes and motions.
  const side0 = rng.sign()
  const makePads = (steps: Step[], s0: number): Pad2[] => {
    let y = 0
    let s = -s0
    return steps.map((st) => {
      y += st.dy
      if (!st.line) s = -s
      const leaf = st.kind === 'leaf'
      const r = leaf ? LEAF_HZ : rng.between(rLo, rHi)
      const p: Pad2 = { kind: st.kind, x: s * (leaf ? 2.6 : r + LANE_CLEAR), z: 0, y, r, a: 0, T: 0, ph: 0, w: 0, gap: st.gap ?? g }
      if (st.kind === 'lift') {
        p.a = liftA
        p.T = rng.between(3.2, 4.0)
        p.ph = rng.between(0, p.T)
      } else if (st.kind === 'ferry') {
        p.a = ferryA
        p.T = rng.between(3.6, 4.4)
        p.ph = rng.between(0, p.T)
      } else if (leaf) {
        p.w = leafW * rng.sign()
        p.ph = rng.between(0, Math.PI)
      } else if (st.kind === 'spin') {
        p.w = Math.min(rng.between(0.6, 1.0), 2.6 / r) * rng.sign()
        p.ph = rng.between(0, Math.PI * 2)
      }
      return p
    })
  }
  const pads1 = makePads(h1, side0)
  const pads2 = makePads(h2, -side0 * (pads1.length % 2 === 0 ? -1 : 1))

  // A pad's reach toward the one before (a leaf's tip and clearance) and the one after (its tip), and a ferry's ends.
  const back = (p: Pad2) => (p.kind === 'leaf' ? LEAF_HX + LEAF_CLEAR : p.r)
  const fwd = (p: Pad2) => (p.kind === 'leaf' ? LEAF_HX : p.r)
  const near = (p: Pad2) => (p.kind === 'ferry' ? -p.a : 0)
  const far = (p: Pad2) => (p.kind === 'ferry' ? p.a : 0)

  /** Lays a half's pads from the pad edge (or the hub's circle); returns where it ends: the edge, or the hub's centre. */
  const lay = (pads: Pad2[], from: { edge: number } | { x: number; z: number; r: number }, endGap: number, to: 'hub' | 'edge'): number => {
    let edge = 'edge' in from
    let px = 'edge' in from ? 0 : from.x
    let pz = 'edge' in from ? from.edge : from.z
    let pr = 'edge' in from ? 0 : from.r
    for (const p of pads) {
      const gap = p.kind === 'leaf' ? 0 : p.gap
      if (edge) p.z = pz + gap + back(p) - near(p)
      else {
        const d = pr + gap + back(p)
        p.z = pz + Math.sqrt(Math.max(0.01, d * d - (p.x - px) ** 2)) - near(p)
      }
      edge = false
      px = p.x
      pr = fwd(p)
      pz = p.z + far(p)
    }
    if (to === 'edge') return pz + pr + endGap
    const d = pr + endGap + HUB2_R
    return pz + Math.sqrt(Math.max(0.01, d * d - px * px))
  }
  const hubZ = lay(pads1, { edge: 0 }, g, 'hub')
  const endZ = lay(pads2, { x: 0, z: hubZ, r: HUB2_R }, g, 'edge')
  const main = [...pads1, ...pads2]

  // The pads. Anything moving faster than 1.6 m/s has no ledge to catch.
  const mainIdx: number[] = []
  for (const p of main) {
    if (p.kind === 'leaf') {
      mainIdx.push(k.box({ x: p.x, z: p.z, hx: LEAF_HX, hz: LEAF_HZ, top: p.y, hy: 0.45, look: 'pad-lily', ledge: false, move: spin(p.w, p.ph) }))
      continue
    }
    let move: MoveFn | undefined
    if (p.kind === 'lift') move = wave('y', p.a, p.T, p.ph)
    else if (p.kind === 'ferry') move = wave('z', p.a, p.T, p.ph)
    else if (p.kind === 'spin') move = spin(p.w, p.ph)
    const speed = p.kind === 'spin' ? Math.abs(p.w) * p.r : (p.a * 2 * Math.PI) / (p.T || 1)
    mainIdx.push(k.cyl({ x: p.x, z: p.z, r: p.r, top: p.y, hy: PAD_HY, look: 'pad-lily', move, ledge: speed > 1.6 ? false : undefined }))
  }
  k.cyl({ x: 0, z: hubZ, r: HUB2_R, top: 0, hy: 0.6, look: 'pad-lily' })

  // The Lily Line: gold pads down each half, as evenly as the main lane allows, never where one would meet a main pad
  // as it moves. A main pad whose underside stays over the gold pads' tops is clear of them (the main lane keeps out of
  // the line's lane, so a bean on a gold pad never has one overhead); the leaf keeps clear of them by its whole sweep
  // and a bean's width.
  const clearAt = (z: number) =>
    main.every((p) => {
      if (p.kind !== 'leaf' && p.y - (p.kind === 'lift' ? p.a : 0) - 2 * PAD_HY >= GOLD_OVER) return true
      const reach = p.kind === 'leaf' ? LEAF_HX + GOLD_R + 0.55 : p.r + GOLD_R + GOLD_CLEAR
      const dz = Math.max(0, Math.abs(z - p.z) - far(p))
      return Math.hypot(p.x, dz) >= reach
    })
  const gold: { x: number; z: number; i: number }[] = []
  const goldPads = (z0: number, z1: number, first: (gap: number) => boolean) => {
    const zs = goldSpots(z0, z1, clearAt, first)
    zs.forEach((z, j) => {
      const spinning = tier > 1 && j === zs.length - 1 && rng.chance(0.5)
      const i = k.cyl({ x: 0, z, r: GOLD_R, top: 0, hy: 0.4, look: 'pad-gold', gold: true, move: spinning ? spin(rng.between(0.6, 1.0) * rng.sign()) : undefined })
      gold.push({ x: 0, z, i })
    })
    return zs.length
  }
  const n1g = goldPads(0, hubZ - HUB2_R, goldFirst)
  const n2g = goldPads(hubZ + HUB2_R, endZ, goldGap)
  k.deco({ look: 'gold-flag', x: 0, y: 0, z: -0.6, sy: 1.8 })
  k.gold('Lily Line', 0, endZ, 0)
  k.flag(0, hubZ, 'hub')

  // The route: a node on each pad (riding it), jumps from the edge toward the next; the Lily Line in late dives, or hops
  // where a gap is a hop's.
  k.node('in', 0, -1.5)
  main.forEach((p, i) => k.node(`p${i}`, p.x, p.z, { y: p.y, on: mainIdx[i] }))
  k.node('hub', 0, hubZ)
  gold.forEach((gp, j) => k.node(`g${j}`, gp.x, gp.z, { on: gp.i }))
  k.node('out', 0, endZ + 1.5)
  const n1 = pads1.length
  const chain = ['in', ...pads1.map((_, i) => `p${i}`), 'hub', ...pads2.map((_, i) => `p${n1 + i}`), 'out']
  for (let i = 0; i < chain.length - 1; i++) k.edge(chain[i]!, chain[i + 1]!, 'jump', { takeoff: 'edge', inset: 0.45 })
  const lineChain = ['in', ...gold.slice(0, n1g).map((_, j) => `g${j}`), 'hub', ...gold.slice(n1g, n1g + n2g).map((_, j) => `g${n1g + j}`), 'out']
  // Each link's gap, edge to edge, along the line (the pad edge before the round, the gold pads, the hub, the pad after).
  const stops = [
    { z: 0, r: 0 },
    ...gold.slice(0, n1g).map((gp) => ({ z: gp.z, r: GOLD_R })),
    { z: hubZ, r: HUB2_R },
    ...gold.slice(n1g, n1g + n2g).map((gp) => ({ z: gp.z, r: GOLD_R })),
    { z: endZ, r: 0 },
  ]
  for (let i = 0; i < lineChain.length - 1; i++) {
    const gap = stops[i + 1]!.z - stops[i + 1]!.r - (stops[i]!.z + stops[i]!.r)
    k.edge(lineChain[i]!, lineChain[i + 1]!, gap <= GOLD_HOP ? 'jump' : 'lateDive', { tier: 'gold', takeoff: 'edge', inset: 0.3 })
  }
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
