/**
 * Slime Climb (design-final F2, finale, phase 2): a candy tower climbing straight ahead in tiers and ramps, a beat
 * on each tier (a low sweeper, a pair of punching gloves, a swinging hammer, gumballs rolling down the ramp below it,
 * or a gap to hop), pink slime rising behind you, a gold chimney up one side, and the crown on the summit.
 *
 * The slime starts as the bean crosses the finale's checkpoint, 2.5–3.5 m under it, and rises once it has been
 * going 3 s; a bean whose feet go under it splats back to the last flag (one on every tier), the slime starting
 * again under that flag. The blue climbs well clear of it; it catches stuck or twice-knocked runs.
 *
 * The chimney (the gold line): a teal pad in an alcove off the first tier. A perfect bounce flings you up the
 * outside of the tower onto a ledge 5 m up beside the second tier's far end, and a catwalk runs on from it past the
 * third tier's beat onto the summit ramp. A plain bounce falls short, back into the tower.
 *
 * Where it differs from design-final: the chimney's throw is aimed and long (like Crown Peak's summit pad), and its
 * "short bridge" is a 20-odd m catwalk: a ledge straight over the first tier is 40 m short of the summit ramp, too
 * far to save anything. The punch pair is always the second tier's (the alcove is beside the first, and the
 * catwalk is level with the third, where a glove at rest would stand in its way); the hammer swings no further out
 * than the tower's edge (so it never reaches the ledge or the catwalk).
 */
import { bonk, gloveMove, gloveTele, knock, pendulumMove, pendulumTele, releaseTele, spin, type GloveSpec, type PendulumSpec } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, TeleFn, Tier } from '../types.ts'
import { byTier, kit, type Kit } from './kit.ts'

/** The tower: 7 m wide with 1 m rails; an entry tier, three 12 m ramps and 8 m tiers, an 8 m summit ramp, the summit. */
const HX = 3.5
const RAIL_H = 1.0
const ENTRY = 6
const RAMP = 12
const TIER = 8
const SUMMIT_RAMP = 8
const SUMMIT = 8
const SUMMIT_A = (12 * Math.PI) / 180
const SUMMIT_WALL = 1.2
/** Sweep: a low bar 3.4 m each way round a hub (axis 0.40 up: hop it, or wait for it). */
const SWEEP_LEN = 3.4
const SWEEP_R = 0.25
const SWEEP_Y = 0.4
const HUB_R = 0.8
/** Punch pair: red gloves (Hit Parade's) 3 m apart from opposite sides, resting just off the tier, reaching 3 m in. */
const GLOVE_HX = 2.2
const GLOVE_HY = 0.9
const GLOVE_HZ = 0.8
const GLOVE_REACH = 3.0
const GLOVE_APART = 3.0
/** Hammer: a 1 m head on a 6 m arm, swinging across the tier, its pivot 7.1 m up; no further out than the edge. */
const HAMMER_R = 1.0
const HAMMER_L = 6
const HAMMER_PIVOT = 7.1
const HAMMER_A = Math.asin(HX / HAMMER_L)
/** Gumballs: r 0.9 at 5.5 m/s down two lanes of the ramp, from 1 m below its top to 2.4 m before its foot. */
const GUM_R = 0.9
const GUM_V = 5.5
const GUM_X = 1.9
const GUM_CHUTE = 1.0
const GUM_FOOT = 2.4
/** Hop gap: 2.4 m across the tier's middle. */
const GAP = 2.4
/**
 * The chimney: an alcove off the first tier's far end with the pad; the ledge 5 m over it, beside the second tier's
 * far end; the catwalk 1.2 m wide along the outside of the tower to the summit ramp. WALK_X is how far out the pad,
 * ledge and catwalk are.
 */
const ALCOVE = 2.5
const PAD_R = 1.0
const LEDGE = 2.5
const LEDGE_UP = 5.0
const CATWALK_HX = 0.6
const WALK_X = HX + 0.5 + ALCOVE / 2
/** The lanes the bots take across a beat; the sweep's, out by its corners. */
const LANES = [-2, 0, 2] as const
const SWEEP_LANE = 2.9

/**
 * The sweeper's telegraph (as Spin Club's): `warn` through the quarter turn before an arm points back down the tower
 * at you (yaw π/2 or 3π/2: an arm along −z), `act` while it's there, `rest` otherwise.
 */
function sweepTele(w: number, ph: number): TeleFn {
  const dir = Math.sign(w) || 1
  const ACT = 0.2
  return (t) => {
    const ahead = ((((Math.PI / 2 - (w * t + ph)) * dir) % Math.PI) + Math.PI) % Math.PI
    if (ahead < ACT) return { state: 'act', u: 0.5 - ahead / (2 * ACT) }
    if (ahead > Math.PI - ACT) return { state: 'act', u: 0.5 + (Math.PI - ahead) / (2 * ACT) }
    if (ahead < Math.PI / 2) return { state: 'warn', u: 1 - (ahead - ACT) / (Math.PI / 2 - ACT) }
    return { state: 'rest', u: (Math.PI - ACT - ahead) / (Math.PI / 2 - ACT) }
  }
}

type Beat = 'sweep' | 'punch' | 'hammer' | 'gumball' | 'gap'
/** Each beat's letter in its route nodes' names (t1p…: the second tier's punch pair). */
const LETTER: Record<Beat, string> = { sweep: 's', punch: 'p', hammer: 'h', gumball: 'g', gap: 'x' }
type Spot = { id: string; x: number; y: number; z: number }
type Step = { a: number; b: number; h: number; ramp0: number; rampA: number; below: number }

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('climb')

  // The beats, three different, one a tier: no punch pair on T1; T3 always has it; it's always the second tier's.
  const pool: Beat[] = tier === 1 ? ['sweep', 'hammer', 'gumball', 'gap'] : ['sweep', 'punch', 'hammer', 'gumball', 'gap']
  const beats = rng.shuffle(pool).slice(0, 3)
  if (tier === 3 && !beats.includes('punch')) beats[1] = 'punch'
  const pi = beats.indexOf('punch')
  if (pi >= 0 && pi !== 1) [beats[1], beats[pi]] = [beats[pi]!, beats[1]!]

  // The tower, along: the entry tier, then a ramp (10–12°) and a tier three times, the summit ramp, the summit.
  const tiers: Step[] = []
  let z = ENTRY
  let h = 0
  for (let i = 0; i < 3; i++) {
    const a = (rng.between(10, 12) * Math.PI) / 180
    const rise = RAMP * Math.tan(a)
    tiers.push({ a: z + RAMP, b: z + RAMP + TIER, h: h + rise, ramp0: z, rampA: a, below: h })
    z += RAMP + TIER
    h += rise
  }
  const [t1, , t3] = tiers as [Step, Step, Step]
  const sr0 = z
  const hs = h + SUMMIT_RAMP * Math.tan(SUMMIT_A)
  const s0 = sr0 + SUMMIT_RAMP
  const s1 = s0 + SUMMIT

  // The chimney's side, and where its catwalk comes in: level from the ledge (at least 5 m over the pad, at least as
  // high as the third tier) to where the summit ramp comes up to it. The alcove and the way in leave rail gaps.
  const side = rng.sign()
  const H = Math.max(t1.h + LEDGE_UP, t3.h + 0.05)
  const zJ = sr0 + (H - t3.h) / Math.tan(SUMMIT_A)
  const gapsOn: Record<number, [number, number][]> = { [-1]: [], [1]: [[t1.b - ALCOVE, t1.b], [zJ - 0.8, zJ + 0.8]] }
  if (side < 0) [gapsOn[-1], gapsOn[1]] = [gapsOn[1]!, gapsOn[-1]!]

  // Floors and rails: the punch tier has none; the gap tier's stop at the gap.
  k.floor(0, ENTRY, { hx: HX })
  k.walls(0, ENTRY, { hx: HX, h: RAIL_H })
  tiers.forEach((T, i) => {
    const rise = T.h - T.below
    const beat = beats[i]!
    const c = (T.a + T.b) / 2
    k.ramp(T.ramp0, T.a, T.below, rise, { hx: HX, hy: 0.6 + rise / 2 })
    for (const s of [-1, 1] as const) k.walls(T.ramp0, T.a, { hx: HX, y: T.below, rise, h: RAIL_H, sides: [s], gaps: gapsOn[s] })
    const body = { hx: HX, top: T.h, look: 'terrace', hy: 0.6 + T.h / 2 }
    if (beat === 'gap') {
      k.floor(T.a, c - GAP / 2, body)
      k.floor(c + GAP / 2, T.b, body)
    } else k.floor(T.a, T.b, body)
    if (beat === 'punch') return
    const gaps: [number, number][] = beat === 'gap' ? [[c - GAP / 2, c + GAP / 2]] : []
    for (const s of [-1, 1] as const) k.walls(T.a, T.b, { hx: HX, y: T.h, h: RAIL_H, sides: [s], gaps: [...gapsOn[s]!, ...gaps] })
  })
  k.ramp(sr0, s0, t3.h, hs - t3.h, { hx: HX, hy: 0.6 + (hs - t3.h) / 2 })
  for (const s of [-1, 1] as const) k.walls(sr0, s0, { hx: HX, y: t3.h, rise: hs - t3.h, h: RAIL_H, sides: [s], gaps: gapsOn[s] })
  k.floor(s0, s1, { hx: HX, top: hs, look: 'summit', hy: 0.6 + hs / 2 })
  k.walls(s0, s1, { hx: HX, y: hs, h: SUMMIT_WALL })
  k.box({ x: 0, z: s1 + 0.25, hx: HX + 0.5, hz: 0.25, top: hs + SUMMIT_WALL, hy: (SUMMIT_WALL + 0.6) / 2, look: 'rail', noGround: true })

  // The slime: 2.5–3.5 m under the checkpoint, rising at the tier's rate.
  k.slime({ z0: -6, z1: s1, hx: HX + 1.5, depth: rng.between(2.5, 3.5), rate: byTier(tier, [0.35, 0.42, 0.5]) })

  // The route, row by row of wait spots: in from the pad, onto the entry tier, then each beat, then the summit. Every
  // spot of a row goes on to every spot of the next (the nearest across first).
  k.node('in', 0, -1.5)
  k.node('e', 0, ENTRY / 2)
  k.edge('in', 'e')
  let row: Spot[] = [{ id: 'e', x: 0, y: 0, z: ENTRY / 2 }]
  const rampY = (T: Step, at: number) => T.below + (at - T.ramp0) * Math.tan(T.rampA)
  const spots = (name: string, xs: readonly number[], at: number, y: number): Spot[] => xs.map((x, l) => ({ id: k.node(`${name}${l}`, x, at, { y }), x, y, z: at }))
  const join = (from: readonly Spot[], to: readonly Spot[]) => {
    for (const f of from) for (const t of [...to].sort((p, q) => Math.abs(p.x - f.x) - Math.abs(q.x - f.x))) k.edge(f.id, t.id)
  }
  const across = (r: readonly Spot[]) => {
    for (let l = 0; l < r.length - 1; l++) {
      k.edge(r[l]!.id, r[l + 1]!.id)
      k.edge(r[l + 1]!.id, r[l]!.id)
    }
  }
  let firstFar: Spot[] = []
  tiers.forEach((T, i) => {
    const beat = beats[i]!
    const c = (T.a + T.b) / 2
    const name = `t${i}${LETTER[beat]}`
    let near: Spot[]
    let far: Spot[]
    let flag: Spot
    if (beat === 'sweep') {
      // The bar sweeps all but the tier's corners: wait at the top of the ramp below (a bot stopping there overshoots
      // toward the bar, not away) and at the far corners; across up either side.
      const w = rng.between(1.0, 1.2) * rng.sign()
      const ph = rng.between(0, Math.PI * 2)
      k.hazard({ shape: 'bar', x: 0, y: T.h + SWEEP_Y, z: c, r: SWEEP_R, len: SWEEP_LEN, hit: knock(5, 0.8, 6), look: 'bar-low', move: spin(w, ph), tele: sweepTele(w, ph) })
      k.hazard({ shape: 'post', x: 0, y: T.h, z: c, r: HUB_R, h: 1.5, hit: bonk(6), look: 'hub' })
      near = spots(`${name}n`, [-SWEEP_LANE, SWEEP_LANE], T.a - 0.8, rampY(T, T.a - 0.8))
      far = spots(`${name}f`, [-SWEEP_LANE, SWEEP_LANE], T.b - 0.6, T.h)
      join(row, near)
      across(near)
      near.forEach((n, l) => k.edge(n.id, far[l]!.id))
      // The flag at the near spot on the side where the bar's arm comes round your way.
      flag = near[w > 0 ? 0 : 1]!
    } else if (beat === 'punch') {
      // Two gloves from opposite sides, half a cycle apart: each lane past them is free of one, timed to the other.
      const P = rng.between(3.0, 3.4)
      const s = rng.sign()
      const fire = rng.between(0, P)
      for (const g of [0, 1] as const) {
        const gs: 1 | -1 = g === 0 ? s : s > 0 ? -1 : 1
        const spec: GloveSpec = { T: P, ph: 0.6 - fire - (g * P) / 2 + rng.between(-0.15, 0.15), side: gs, reach: GLOVE_REACH }
        const gz = c + (g === 0 ? -1 : 1) * (GLOVE_APART / 2)
        const glove = k.hazard({ shape: 'box', x: gs * (HX + GLOVE_HX), y: T.h + GLOVE_HY, z: gz, hx: GLOVE_HX, hy: GLOVE_HY, hz: GLOVE_HZ, hit: knock(6, 0.45, 5.5, 11), look: 'glove', move: gloveMove(spec), tele: gloveTele(spec) })
        k.deco({ look: 'pillar', x: gs * (HX + 0.6), y: T.h, z: gz, sx: 1.2, sy: 1.6, sz: 2.2, ref: { kind: 'hazard', i: glove } })
      }
      near = spots(`${name}n`, LANES, T.a - 0.4, rampY(T, T.a - 0.4))
      far = spots(`${name}f`, LANES, T.b - 0.6, T.h)
      join(row, near)
      across(near)
      near.forEach((n, l) => k.edge(n.id, far[l]!.id))
      flag = near[1]!
    } else if (beat === 'hammer') {
      const spec: PendulumSpec = { L: HAMMER_L, A: HAMMER_A, T: slot.period, ph: rng.between(0, slot.period) }
      const head = k.hazard({ shape: 'sphere', x: 0, y: T.h + HAMMER_PIVOT, z: c, r: HAMMER_R, hit: knock(6, 0.85, 6), look: 'pendulum', move: pendulumMove(spec), tele: pendulumTele(spec) })
      k.deco({ look: 'stripe', x: 0, y: T.h + 0.01, z: c, sx: 2 * HX, sy: 0.02, sz: 2 * HAMMER_R, role: 'dodge', ref: { kind: 'hazard', i: head }, params: { pendulum: true } })
      k.deco({ look: 'gantry', x: 0, y: T.h, z: c, sx: 2 * HX + 1.6, sy: HAMMER_PIVOT + 0.5, sz: 0.6, params: { heads: 1 } })
      near = spots(`${name}n`, LANES, c - 2.5, T.h)
      far = spots(`${name}f`, LANES, c + 2.5, T.h)
      join(row, near)
      across(near)
      near.forEach((n, l) => k.edge(n.id, far[l]!.id))
      flag = near[1]!
    } else if (beat === 'gumball') {
      // Down the ramp below the tier: two lanes from chutes just under its top, half a release apart; the ramp's
      // middle stays clear of both, so this one is about keeping to it.
      const P = tier === 3 ? 2.6 : rng.between(2.6, 3.2)
      const ph0 = rng.between(0, P)
      const cs = Math.cos(T.rampA)
      const sn = Math.sin(T.rampA)
      const life = (RAMP - GUM_CHUTE - GUM_FOOT) / cs / GUM_V
      for (const l of [0, 1] as const) {
        const x = l === 0 ? -GUM_X : GUM_X
        const ph = ph0 + (l * P) / 2
        const gum = k.hazard({
          shape: 'sphere',
          x,
          y: T.h - GUM_CHUTE * Math.tan(T.rampA) + GUM_R / cs,
          z: T.a - GUM_CHUTE,
          r: GUM_R,
          hit: knock(6, 0.5, 5),
          look: 'gumball',
          tele: releaseTele(P, ph, 0.8),
          path: {
            P,
            ph,
            life,
            at: (tau, _k, o) => {
              const s = GUM_V * tau
              o.z = -s * cs
              o.y = -s * sn
              o.yaw = s / GUM_R
            },
          },
        })
        k.deco({ look: 'chute', x, y: T.h, z: T.a - GUM_CHUTE + 0.4, sx: 2.2, sy: 2.2, sz: 1.4, ref: { kind: 'hazard', i: gum } })
      }
      // Into the middle at the ramp's foot (below where the gumballs run), then straight up it.
      const fz = T.ramp0 + 1.0
      const foot = k.node(`${name}o`, 0, fz, { y: rampY(T, fz), wait: 'no' })
      const mz = (T.ramp0 + T.a) / 2
      const mid = k.node(`${name}m`, 0, mz, { y: rampY(T, mz), wait: 'no' })
      for (const f of row) k.edge(f.id, foot)
      k.edge(foot, mid)
      near = spots(`${name}n`, [0], T.a + 1.2, T.h)
      k.edge(mid, near[0]!.id)
      far = near
      flag = near[0]!
    } else {
      near = spots(`${name}n`, [0], c - GAP / 2 - 1.4, T.h)
      far = spots(`${name}f`, [0], c + GAP / 2 + 2.0, T.h)
      join(row, near)
      k.edge(near[0]!.id, far[0]!.id, 'jump', { takeoff: k.at(0, T.h, c - GAP / 2 - 0.5) })
      flag = near[0]!
    }
    k.flag(flag.x, flag.z, flag.id, flag.y)
    if (i === 0) firstFar = far
    row = far
  })

  // The summit: up the summit ramp to a spot on the summit, then into the crown (walk into its low half, or jump).
  const crownZ = s0 + 4.2
  const bobPh = rng.between(0, 2.2)
  k.deco({ look: 'pedestal', x: 0, y: hs, z: crownZ, sx: 1.4, sy: 0.5, sz: 1.4 })
  k.crown({ x: 0, y: hs + 2.2, z: crownZ, bob: (t) => 0.5 * Math.sin((2 * Math.PI * (t + bobPh)) / 2.2) })
  k.node('top', 0, s0 + 1.4, { y: hs })
  for (const f of row) k.edge(f.id, 'top')
  k.node('crown', 0, crownZ, { y: hs })
  k.edge('top', 'crown', 'jump', { takeoff: k.at(0, hs, crownZ - 2.0) })

  chimney(k, side, t1, tiers[1]!, H, zJ, firstFar)
  return k.done({ x: 0, y: hs, z: s1 })
}

/**
 * The chimney (gold): the alcove off the first tier's far end with the pad in it; the ledge 5 m up beside the second
 * tier's far end; the catwalk on to the summit ramp and its cross piece in; and the gold line's route, from the
 * first tier's far spots.
 */
function chimney(k: Kit, side: number, t1: Step, t2: Step, H: number, zJ: number, from: readonly Spot[]): void {
  const zc = t1.b - ALCOVE / 2
  const ax0 = HX - 0.1
  const ax1 = WALK_X + ALCOVE / 2
  k.box({ x: (side * (ax0 + ax1)) / 2, z: zc, hx: (ax1 - ax0) / 2, hz: ALCOVE / 2, top: t1.h, hy: 0.6, look: 'terrace' })
  // Its own rails round the outside, so it's no way off the tower.
  k.box({ x: side * (ax1 + 0.25), z: zc, hx: 0.25, hz: ALCOVE / 2 + 0.5, top: t1.h + RAIL_H, hy: (RAIL_H + 0.6) / 2, look: 'rail', noGround: true })
  for (const dz of [-1, 1]) k.box({ x: (side * (HX + ax1 + 0.5)) / 2, z: zc + dz * (ALCOVE / 2 + 0.25), hx: (ax1 + 0.5 - HX) / 2, hz: 0.25, top: t1.h + RAIL_H, hy: (RAIL_H + 0.6) / 2, look: 'rail', noGround: true })
  // The pad: a perfect bounce (18 m/s up, about 0.9 s to come down on the ledge, flung 20 m on) lands on the
  // ledge; a plain one comes down on the ramp just past the tier.
  const ledgeZ = t2.b - LEDGE / 2
  const ledgeAim = { x: side * WALK_X, y: H, z: ledgeZ }
  const shortAim = { x: side * 1.5, y: t1.h + 2.4 * Math.tan((11 * Math.PI) / 180), z: t1.b + 2.4 }
  k.cyl({ x: side * WALK_X, z: zc, r: PAD_R, top: t1.h + 0.04, hy: 0.3, look: 'bounce', gold: true, bounce: { vy: 15, aim: shortAim, perfectVy: 18, perfectAim: ledgeAim } })
  k.deco({ look: 'gold-flag', x: side * (HX + 0.3), y: t1.h, z: zc - 1.0, sy: 1.8 })
  // The ledge, the catwalk on from it, and the cross piece onto the summit ramp through its rail gap.
  k.box({ x: side * WALK_X, z: ledgeZ, hx: LEDGE / 2, hz: LEDGE / 2, top: H, hy: 0.4, look: 'pad', gold: true })
  const w0 = ledgeZ + LEDGE / 2
  const w1 = zJ + 0.8
  k.box({ x: side * WALK_X, z: (w0 + w1) / 2, hx: CATWALK_HX, hz: (w1 - w0) / 2, top: H, hy: 0.4, look: 'pad', gold: true })
  const xin = HX - 0.2
  const xout = WALK_X - CATWALK_HX
  k.box({ x: (side * (xin + xout)) / 2, z: zJ, hx: (xout - xin) / 2 + 0.05, hz: 0.8, top: H, hy: 0.4, look: 'pad', gold: true })
  k.gold('Chimney', t1.b - ALCOVE, zJ, side * WALK_X)

  k.node('alcove', side * (HX + 0.25), zc, { y: t1.h })
  for (const f of from) k.edge(f.id, 'alcove', 'run', { tier: 'gold' })
  k.node('ledge', side * WALK_X, ledgeZ, { y: H })
  k.edge('alcove', 'ledge', 'perfectBounce', { tier: 'gold', via: [k.at(side * WALK_X, t1.h + 0.04, zc)] })
  k.node('walkEnd', side * WALK_X, zJ, { y: H, wait: 'no' })
  k.node('walkIn', side * (HX - 1.0), zJ + 0.3, { y: H, wait: 'no' })
  k.edge('ledge', 'walkEnd', 'run', { tier: 'gold' })
  k.edge('walkEnd', 'walkIn', 'run', { tier: 'gold' })
  k.edge('walkIn', 'top', 'run', { tier: 'gold' })
}

export const ROUND: RoundDef = {
  letter: 'S',
  name: 'Tide Tower',
  hint: 'beat the rising sea',
  family: 'finale',
  phase: 2,
  build,
}
