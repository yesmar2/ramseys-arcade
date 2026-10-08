/**
 * Hit Parade (design-final R4, D): a causeway over the goo in one or two acts, with a landing between them (the
 * mid flag). Wrecking Row: giant red balls swinging across the path from tall gantries, each group in a green wave
 * (a full-speed runner who passes the first gantry as its head swings away passes every one in the group); a
 * floor stripe under each arc lights as the head comes down. Punch Bridge: boxing-glove blocks punching in from
 * pillars at the bridge's edges after a 0.6 s wind-up you see and hear: red to dodge, orange to hop (T2+), violet
 * to dive under (T3). A glove never reaches more than 3.6 m of the bridge's 6 m, so the far side is always free.
 *
 * Rails keep every knock out of the goo on T1–T2. T3 leaves Wrecking Row's gantries open on alternate sides and
 * 8–12 m of Punch Bridge open on both, and doubles the heads on one gantry (two balls swinging past each other).
 *
 * Wrecking Row is 9 m wide, not the spec's 6: a head sweeping on into a rail pins a knocked bean there and pushes it
 * through (sim.ts pushes a bean out of a hazard after its walls), but by 4.5 m out a head has risen almost clear
 * of a bean, so its 1 m thick rails hold.
 */
import { gloveMove, gloveTele, knock, pendulumMove, pendulumTele, type GloveSpec, type PendulumSpec } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** Wrecking Row's half width (9 m) and rails' thickness, Punch Bridge's (6 m); the rails' height (a knock's pop tops out at 0.64 m). */
const HX_A = 4.5
const RAIL_A = 1.0
const HX_B = 3.0
const RAIL_B = 0.5
const RAIL_H = 1.0
/** The bots' three lanes in each act. */
const LANES_A = [-3, 0, 3] as const
const LANES_B = [-2, 0, 2] as const
/** Wrecking Row: a pivot 7.7 m up, a 6.6 m arm, a 1.1 m head (its centre 1.1 m up at the bottom of the swing). */
const PIVOT_Y = 7.7
const ARM = 6.6
const HEAD_R = 1.1
/** A double gantry's two heads swing this far either side of it, half a period apart (past each other). */
const DOUBLE_DZ = 1.25
/** The first wait row is this far into Wrecking Row, the act ends this far past its last. */
const LEAD_A = 2.5
/** Punch Bridge: wait rows halfway between gloves, from this far in; a 4.4 m glove block resting at the edge. */
const LEAD_B = 2
const GLOVE_HX = 2.2
const PILLAR_X = 3.6
/** The landing between the acts, where the mid flag is. */
const LANDING = 4
/**
 * How far a knock can carry a bean along the track, m (the most measured is 3.1: a pop of 6 is 0.43 s in the air,
 * then a slide): a T2 rail gap stays this far from anything that could throw a bean toward it.
 */
const KNOCK_CARRY = 4.5
/** The bean's radius. */
const BEAN_R = 0.42

type Glove = 'red' | 'low' | 'high'
/** Each glove's block: its centre's height, half height, half depth; RED y 0–1.8, ORANGE 0–0.8, VIOLET 1.3–2.4. */
const GLOVES: Record<Glove, { y: number; hy: number; hz: number; look: string }> = {
  red: { y: 0.9, hy: 0.9, hz: 0.8, look: 'glove' },
  low: { y: 0.4, hy: 0.4, hz: 0.5, look: 'glove-low' },
  high: { y: 1.85, hy: 0.55, hz: 0.8, look: 'glove-high' },
}

/** Something that knocks: where it is along the round, how far either side of that it can hit, and which way it throws (0 either). */
type Knocker = { z: number; reach: number; toward: -1 | 0 | 1 }
/** A stretch of causeway: where, how wide, how thick its rails. */
type Stretch = { z0: number; z1: number; hx: number; thick: number }

/** How far apart two moments are on a clock of period T. */
function apart(a: number, b: number, T: number): number {
  const d = Math.abs(a - b) % T
  return Math.min(d, T - d)
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  const acts: readonly ('A' | 'B')[] = tier === 1 ? [rng.chance(0.5) ? 'A' : 'B'] : rng.chance(0.5) ? ['A', 'B'] : ['B', 'A']
  const knockers: Knocker[] = []
  // Rail gaps by side (index 0 the −x side, 1 the +x side), the stretches they run along, and each act's.
  const gaps: [number, number][][] = [[], []]
  const gapsOn = (side: number) => gaps[side > 0 ? 1 : 0]!
  const stretches: Stretch[] = []
  const actSpans: [number, number][] = []

  // The route: three lanes a row, wait rows between the hazards (safe: nothing reaches them), steps across a row.
  // Each spot's ways out go on first, straight on first (the live hands take the first way when nothing is clean),
  // then across: the steps across are added once every way on is.
  const rowsAll: string[][] = []
  const row = (name: string, z: number, lanes: readonly number[]): string[] => {
    const r = lanes.map((x, l) => k.node(`${name}_${l}`, x, z))
    rowsAll.push(r)
    return r
  }
  const ahead = (a: readonly string[], b: readonly string[], wide: boolean) => {
    for (let l = 0; l < a.length; l++) {
      const order = [l, l - 1, l + 1, l - 2, l + 2].filter((m) => m >= 0 && m < b.length && (wide || Math.abs(l - m) <= 1))
      for (const m of order) k.edge(a[l]!, b[m]!)
    }
  }

  /** Wrecking Row from z0: n gantries, each group's in a green wave. Returns its wait rows and where it ends. */
  const wreckingRow = (z0: number, n: number) => {
    const S = tier === 3 ? rng.between(6.5, 7.0) : rng.between(6.5, 8.0)
    const A = rng.between(0.9, 1.0)
    // T3: two groups (no one wave carries through), and one gantry with two heads.
    const dbl = tier === 3 ? rng.int(0, n - 1) : -1
    const split = tier === 3 ? Math.ceil(n / 2) : n
    const T1 = slot.period
    const T2 = T1 * 1.17 <= 4.4 ? T1 * 1.17 : T1 / 1.17
    // The wait rows, halfway between gantries (a double gantry has room either side for its second head).
    const rz = [z0 + LEAD_A]
    for (let r = 0; r < n; r++) rz.push(rz[r]! + S + (r === dbl ? 2 * DOUBLE_DZ : 0))
    const end = rz[n]! + LEAD_A
    k.floor(z0, end, { hx: HX_A })
    stretches.push({ z0, z1: end, hx: HX_A, thick: RAIL_A })
    let ph0 = 0
    let zg0 = 0
    for (let r = 0; r < n; r++) {
      const z = (rz[r]! + rz[r + 1]!) / 2
      const T = r < split ? T1 : T2
      if (r === 0 || r === split) {
        ph0 = rng.between(0, T)
        zg0 = z
      }
      // The green wave: a gantry's phase is its group's, less the time a full-speed runner takes to get to it.
      const ph = ph0 - (z - zg0) / 7.2 + rng.between(-0.15, 0.15)
      const heads = r === dbl ? [-DOUBLE_DZ, DOUBLE_DZ] : [0]
      heads.forEach((dz, j) => {
        const spec: PendulumSpec = { L: ARM, A, T, ph: ph + (j * T) / 2 }
        const h = k.hazard({ shape: 'sphere', x: 0, y: PIVOT_Y, z: z + dz, r: HEAD_R, hit: knock(6, 0.85, 6), look: 'pendulum', move: pendulumMove(spec), tele: pendulumTele(spec) })
        k.deco({ look: 'stripe', x: 0, y: 0.01, z: z + dz, sx: 2 * HX_A, sy: 0.02, sz: 2 * HEAD_R, role: 'dodge', ref: { kind: 'hazard', i: h }, params: { pendulum: true } })
      })
      k.deco({ look: 'gantry', x: 0, y: 0, z, sx: 2 * (HX_A + RAIL_A) + 0.6, sy: PIVOT_Y + 0.5, sz: r === dbl ? 2 * DOUBLE_DZ + 0.6 : 0.6, params: { heads: heads.length } })
      knockers.push({ z, reach: HEAD_R + BEAN_R + (r === dbl ? DOUBLE_DZ : 0), toward: 0 })
      // T3: each gantry's stretch keeps its rail on one side only, the side alternating.
      if (tier === 3) gapsOn(r % 2 === 0 ? 1 : -1).push([rz[r]!, rz[r + 1]!])
    }
    const rows = rz.map((z, r) => row(`a${r}`, z, LANES_A))
    for (let r = 0; r < n; r++) ahead(rows[r]!, rows[r + 1]!, false)
    actSpans.push([z0, end])
    if (split === n) {
      k.gold('Green wave', z0, end, 0)
      k.deco({ look: 'gold-flag', x: -HX_A + 0.4, y: 0, z: z0 + 0.6, sy: 1.8 })
    }
    return { rows, end }
  }

  /** Punch Bridge from z0: n gloves from alternating-ish sides, never three in a row from one. */
  const punchBridge = (z0: number, n: number) => {
    const S = tier === 1 ? rng.between(4.8, 5.6) : rng.between(4.6, 5.4)
    const T = slot.period <= 3.6 ? slot.period : rng.between(2.8, 3.6)
    const kinds: readonly Glove[] = byTier(tier, [['red'], ['red', 'red', 'low'], ['red', 'low', 'high']] as const)
    const end = z0 + 2 * LEAD_B + n * S
    k.floor(z0, end, { hx: HX_B })
    stretches.push({ z0, z1: end, hx: HX_B, thick: RAIL_B })
    const rz = Array.from({ length: n + 1 }, (_, r) => z0 + LEAD_B + r * S)
    const rows = rz.map((z, r) => row(`b${r}`, z, LANES_B))
    let lastSide = 0
    let run = 0
    let lastFire = NaN
    for (let g = 0; g < n; g++) {
      const z = z0 + LEAD_B + (g + 0.5) * S
      let side: 1 | -1 = rng.sign()
      if (run >= 2 && side === lastSide) side = side > 0 ? -1 : 1
      run = side === lastSide ? run + 1 : 1
      lastSide = side
      const kind = rng.pick(kinds)
      const box = GLOVES[kind]
      const reach = rng.between(3.0, 3.6)
      // Two gloves next to each other never punch within 0.8 s of each other (a punch starts 0.6 s into the cycle).
      let fire = rng.between(0, T)
      for (let tries = 0; tries < 24 && lastFire === lastFire && apart(fire, lastFire, T) < 0.8; tries++) fire = rng.between(0, T)
      lastFire = fire
      const spec: GloveSpec = { T, ph: 0.6 - fire, side, reach }
      const h = k.hazard({
        shape: 'box',
        x: side * (HX_B + GLOVE_HX),
        y: box.y,
        z,
        hx: GLOVE_HX,
        hy: box.hy,
        hz: box.hz,
        hit: knock(6, 0.45, 5.5, 11),
        look: box.look,
        move: gloveMove(spec),
        tele: gloveTele(spec),
      })
      k.deco({ look: 'pillar', x: side * PILLAR_X, y: 0, z, sx: 1.2, sy: 2.8, sz: 2.2, ref: { kind: 'hazard', i: h } })
      gapsOn(side).push([z - box.hz - 0.25, z + box.hz + 0.25])
      knockers.push({ z, reach: box.hz + BEAN_R, toward: side > 0 ? -1 : 1 })
      // Every way past it: the lanes it can't reach any time, the rest while it rests; for experts, a hop over an
      // orange glove or a dive under a violet one in the lanes it reaches.
      ahead(rows[g]!, rows[g + 1]!, true)
      if (kind !== 'red') {
        LANES_B.forEach((x, l) => {
          if (side * x + BEAN_R + 0.35 <= HX_B - reach) return
          k.edge(rows[g]![l]!, rows[g + 1]![l]!, kind === 'low' ? 'jump' : 'dive', { tier: 'gold' })
        })
      }
    }
    // T3: 8–12 m of the bridge with no rails at all.
    if (tier === 3) {
      const w = rng.between(8, 12)
      const a = rng.between(z0 + 1, Math.max(z0 + 1, end - 1 - w))
      gapsOn(1).push([a, a + w])
      gapsOn(-1).push([a, a + w])
    }
    actSpans.push([z0, end])
    return { rows, end }
  }

  // The acts in order, the landing between them (as wide as Wrecking Row).
  k.node('in', 0, -1.5)
  let z = 0
  let prev: string[] | null = null
  for (let i = 0; i < acts.length; i++) {
    if (i > 0) {
      k.floor(z, z + LANDING, { hx: HX_A, look: 'pad' })
      stretches.push({ z0: z, z1: z + LANDING, hx: HX_A, thick: RAIL_A })
      const mid = row('m', z + LANDING / 2, LANES_A)
      ahead(prev!, mid, false)
      k.flag(0, z + LANDING / 2, mid[1]!)
      prev = mid
      z += LANDING
    }
    const act = acts[i] === 'A' ? wreckingRow(z, byTier(tier, [4, 3, 4])) : punchBridge(z, byTier(tier, [6, 5, 6]))
    if (prev) ahead(prev, act.rows[0]!, false)
    else for (const id of act.rows[0]!) k.edge('in', id)
    prev = act.rows[act.rows.length - 1]!
    z = act.end
  }
  const len = z
  k.node('out', 0, len + 1.5)
  for (const id of prev!) k.edge(id, 'out')
  for (const r of rowsAll) {
    for (let l = 0; l < r.length - 1; l++) {
      k.edge(r[l]!, r[l + 1]!)
      k.edge(r[l + 1]!, r[l]!)
    }
  }

  // T2: one 3 m rail gap a side in each act, only where no knock could carry a bean through it (none if there's
  // no such place: the rule that a knock never goes in the goo on T1–T2 comes first). Wrecking Row never has room
  // for one; Punch Bridge often does, on a side whose nearby gloves all punch from it.
  if (tier === 2) {
    for (const [a0, a1] of actSpans) {
      for (const side of [-1, 1] as const) {
        const spots: number[] = []
        for (let c = a0 + 1.8; c <= a1 - 1.8; c += 0.5) spots.push(c)
        const ok = rng.shuffle(spots).find((c) => knockers.every((q) => q.toward === -side || q.z + q.reach + KNOCK_CARRY <= c - 1.5 || q.z - q.reach - KNOCK_CARRY >= c + 1.5))
        if (ok !== undefined) gapsOn(side).push([ok - 1.5, ok + 1.5])
      }
    }
  }
  // The rails, stretch by stretch; where a narrow stretch meets a wide one, a short wall closes the wide one's end.
  for (const s of stretches) {
    for (const side of [-1, 1] as const) k.walls(s.z0, s.z1, { hx: s.hx, h: RAIL_H, thick: s.thick, gaps: gapsOn(side), sides: [side] })
    const next = stretches.find((o) => Math.abs(o.z0 - s.z1) < 1e-6)
    if (!next || next.hx === s.hx) continue
    const narrow = Math.min(s.hx, next.hx)
    const wide = Math.max(s.hx + s.thick, next.hx + next.thick)
    for (const side of [-1, 1] as const) {
      k.box({ x: (side * (narrow + wide)) / 2, z: s.z1, hx: (wide - narrow) / 2, hz: 0.25, top: RAIL_H, hy: (RAIL_H + 0.6) / 2, look: 'rail', noGround: true })
    }
  }
  return k.done({ x: 0, y: 0, z: len })
}

export const ROUND: RoundDef = {
  letter: 'h',
  name: 'Hit Parade',
  hint: 'dodge the swings',
  family: 'D',
  phase: 1,
  build,
}
