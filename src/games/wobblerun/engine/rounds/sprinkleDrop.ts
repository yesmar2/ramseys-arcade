/**
 * Sprinkle Drop (d, D: a round of our own, gen 2): a candy deck in three levels (down, then up), giant sprinkles
 * raining onto it. Each sprinkle falls straight down on the clock, and the scene draws a red ring on the deck under
 * every sprinkle still in the air, growing as it comes down (1.5 / 1.3 / 1.15 s of warning by tier): where a ring
 * is, a sprinkle lands. Landing on Blip it knocks it flying; then it bounces once and lies there a moment (a soft
 * bonk if you walk into it) and is gone.
 *
 * The sprinkles come in waves that repeat (the round's own rhythm, never chance). The first deck: rows across it,
 * landing one after another, each with one gap to find. Down to the middle deck (a step on T1, a gap to jump from
 * T2): on T1 sweeps of sprinkles land across it one after another; from T2 it's narrow and open-edged, and a march
 * comes down each of its two lanes, sprinkles laid along the lane landing one after another toward you, the lanes
 * half a cycle apart: step into the quiet one, or be knocked out over the edge into the soda sea. Up a ramp to the
 * last deck: a ring lands round a spot (stand inside it), then one more row. T1 is railed all round, T2 all but the
 * middle deck and its ramp, T3 nowhere; on T3 sprinkles landing on the ramp roll down it, and the last row cracks
 * the deck where it lands: those tiles drop away for a couple of seconds, then come back.
 *
 * Main route: the decks' lanes, between the waves. No gold line: reading the rings is the round.
 */
import { bonk, knock } from '../sim.ts'
import type { Hit, MoveFn, RoundDef, RoundOut, RoundSlot, Rng, TeleFn, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** The decks: the first and last 9 m wide, the middle one narrower from T2; heights; rails. */
const HX = 4.5
const MID_HX = [4.5, 3.8, 3.2] as const
const Y_A = 0
const Y_B = -1.2
const Y_C = 0.6
const RAIL_H = 1.0
/** The gap down to the middle deck (T2+), and the ramp up from it. */
const GAP = [0, 1.6, 2.0] as const
const RAMP = 6.0
/** A sprinkle: a capsule LEN each way of its middle, R thick (2.3 m long, 0.64 m through). */
const LEN = 0.85
const R = 0.32
/** It falls from HIGH above the deck over the tier's FALL s (the ring's warning), spinning until SETTLE of the way down. */
const HIGH = 12
const FALL = [1.5, 1.3, 1.15] as const
const SETTLE = 0.75
const SPIN = 2.2
/** Down, it hops HOP m once over HOP_T s and lies there until LIE s after landing. */
const HOP = 0.35
const HOP_T = 0.3
const LIE = [0.9, 0.8, 0.75] as const
/** Landing on you: a knock (it comes straight down, so it knocks whether it's moving across or not), harder by tier. */
const FALL_KN = [6, 7, 7.5] as const
/** Lying there: a soft bonk. Rolling down the ramp (T3): a knock when it rolls into you. */
const LIE_HIT: Hit = bonk(4, 1.5)
const ROLL_HIT: Hit = knock(5.5, 0.4, 4.5)
const ROLL_V = 4.5
/** A march (T2+): this many sprinkles down a lane, STEP apart, landing DT apart; a lane's at least LEAST s apart. */
const MARCH = [0, 4, 4] as const
const MARCH_STEP = 2.4
const MARCH_DT = 0.35
const MARCH_LEAST = 4.0
const MARCH_IN = 0.6
/** A row's four places across a 9 m deck (one left out: the gap). */
const ROW_X = [-3.4, -1.13, 1.13, 3.4] as const
/** A cracked tile (T3): cracks as its sprinkle lands, drops CRACK s later for GONE s, rises back over BACK s. */
const CRACK = 0.45
const GONE = 1.8
const BACK = 0.4

const frac = (v: number) => v - Math.floor(v)

/**
 * One sprinkle a cycle: where it lands (x, z on the deck at height y), which way it lies (yaw: 0 across the deck,
 * π/2 along it), when in its zone's cycle it lands (`at`), the cycle (P, phase), and what it does down: roll (T3's
 * ramp: along z by `dz` for `dur` s, on the surface), or go down with the tile it cracks.
 */
type Drop = { x: number; z: number; y: number; yaw: number; at: number; P: number; ph: number; roll?: { dz: number; dur: number }; crack?: boolean }

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('wide')
  const fall = byTier(tier, FALL)
  const fallHit: Hit = { ...knock(byTier(tier, FALL_KN), 0, 5.5), always: true }
  const lie = byTier(tier, LIE)
  const midHx = byTier(tier, MID_HX)
  const gap = byTier(tier, GAP)
  const drops: Drop[] = []

  // The decks along the way.
  const a0 = 0
  const a1 = a0 + rng.between(12.4, 13.0)
  const b0 = a1 + gap
  // The middle deck: T1 two sweeps across it; from T2 (narrow, open edges) a march down each lane, MARCH drops long.
  const nMarch = byTier(tier, MARCH)
  const marchZ0 = b0 + 3.2
  const b1 = nMarch > 0 ? marchZ0 + MARCH_STEP * (nMarch - 1) + 3.7 + rng.between(0, 0.6) : b0 + rng.between(11.8, 12.4)
  const r1 = b1 + RAMP
  const c0 = r1
  const c1 = c0 + rng.between(11.0, 11.6)
  const rampA = Math.atan2(Y_C - Y_B, RAMP)
  const surf = (z: number) => (z < a1 ? Y_A : z < b1 ? Y_B : z < r1 ? Y_B + (z - b1) * Math.tan(rampA) : Y_C)

  k.floor(a0, a1, { hx: HX, top: Y_A })
  if (gap > 0) k.box({ x: 0, z: (b0 + b1) / 2, hx: midHx, hz: (b1 - b0) / 2, top: Y_B, hy: 0.6 })
  else k.floor(a1, b1, { hx: midHx, top: Y_B })
  k.ramp(b1, r1, Y_B, Y_C - Y_B, { hx: midHx, hy: 0.8 })
  // The last deck: whole, or on T3 a band of tiles where its row lands (each can crack).
  const rowC = c0 + rng.between(7.6, 8.0)
  const tileZ0 = rowC - 1.2
  const tileZ1 = rowC + 1.2
  if (tier < 3) k.floor(c0, c1, { hx: HX, top: Y_C })
  else {
    k.floor(c0, tileZ0, { hx: HX, top: Y_C })
    k.floor(tileZ1, c1, { hx: HX, top: Y_C })
  }

  // Rails: T1 all round; T2 the first and last decks (the middle one and its ramp open); T3 none.
  if (tier === 1) {
    k.walls(a0, a1, { hx: HX })
    k.walls(a1, b1, { hx: midHx, y: Y_B, h: RAIL_H + (Y_A - Y_B) })
    k.walls(b1, r1, { hx: midHx, y: Y_B, rise: Y_C - Y_B })
    k.walls(c0, c1, { hx: HX, y: Y_C })
  } else if (tier === 2) {
    k.walls(a0, a1, { hx: HX })
    k.walls(c0, c1, { hx: HX, y: Y_C })
  }
  for (let z = 0; z < c1; z += 2) k.death(z, Math.min(z + 2, c1), Math.min(surf(z), surf(Math.min(z + 2, c1))) - 4.5)

  // Deck A: three rows across it, landing one after another down the deck toward you, each with its gap (no two
  // gaps in a row in the same place).
  const PA = slot.period * byTier(tier, [1.25, 1.1, 1.0])
  const phA = rng.between(0, PA)
  const rowsA = [a0 + 2.8, a0 + 6.4, a0 + 10.0]
  let lastGap = -1
  rowsA.forEach((z, j) => {
    let g = rng.int(0, 3)
    if (g === lastGap) g = (g + rng.int(1, 3)) % 4
    lastGap = g
    const at = ((rowsA.length - 1 - j) * PA) / (rowsA.length + 0.5)
    ROW_X.forEach((x, s) => {
      if (s !== g) drops.push({ x, z, y: Y_A, yaw: 0, at, P: PA, ph: phA })
    })
  })

  // Deck B. T1: two sweeps of sprinkles laid along the way, landing across the deck one after another (alternate
  // ways). From T2: a march down each lane, sprinkles laid along it landing one after another toward you, the two
  // lanes half a cycle apart: step into the quiet lane. Each lies a little inside its lane, so landing on you it
  // knocks you out over the edge.
  const PB = nMarch > 0 ? Math.max(MARCH_LEAST, slot.period * 1.3) : slot.period * 1.25
  const phB = rng.between(0, PB)
  const laneB = nMarch > 0 ? [-1.25, 1.25] : [-2.6, 0, 2.6]
  const sweepsB = [b0 + 3.2, b0 + 8.0]
  if (nMarch > 0) {
    const first = rng.int(0, 1)
    laneB.forEach((x, l) => {
      const at0 = l === first ? 0 : PB / 2
      const xm = x - Math.sign(x) * MARCH_IN
      for (let n = 0; n < nMarch; n++) drops.push({ x: xm, z: marchZ0 + MARCH_STEP * (nMarch - 1 - n), y: Y_B, yaw: Math.PI / 2, at: at0 + n * MARCH_DT, P: PB, ph: phB })
    })
  } else {
    const sweepDir = rng.sign()
    sweepsB.forEach((z, j) => {
      const dir = j % 2 === 0 ? sweepDir : -sweepDir
      const order = dir > 0 ? laneB : [...laneB].reverse()
      order.forEach((x, n) => drops.push({ x: x - Math.sign(x) * 0.25, z, y: Y_B, yaw: Math.PI / 2, at: (j * PB) / 2 + n * 0.3, P: PB, ph: phB }))
    })
  }

  // The ramp (T3): sprinkles landing near its top roll down it to its foot, one side then the other, each side
  // clear for most of the cycle.
  if (tier === 3) {
    const PR = slot.period * 1.2
    const phR = rng.between(0, PR)
    const zr = b1 + RAMP * 0.75
    const s0 = rng.sign()
    const dur = HOP_T * 0.5 + (zr - b1 - 0.3) / ROLL_V
    ;[0, 1].forEach((n) => {
      const x = (n === 0 ? s0 : -s0) * 1.4
      drops.push({ x, z: zr, y: surf(zr), yaw: 0, at: (n * PR) / 2, P: PR, ph: phR, roll: { dz: -1, dur } })
    })
  }

  // Deck C: a ring round a spot left or right of its middle, then a row across (T3: on tiles it cracks).
  const PC = slot.period * byTier(tier, [1.25, 1.1, 1.05])
  const phC = rng.between(0, PC)
  const ringX = rng.sign() * 1.4
  const ringZ = c0 + 3.6
  const RING = 2.1
  for (let n = 0; n < 6; n++) {
    const a = (n * Math.PI) / 3 + Math.PI / 6
    drops.push({ x: ringX + RING * Math.sin(a), z: ringZ - RING * Math.cos(a), y: Y_C, yaw: -a, at: 0, P: PC, ph: phC })
  }
  const gapC = rng.int(0, 3)
  // T3: the row's band of tiles, one under each place: each but the gap's cracks as its sprinkle lands.
  if (tier === 3) {
    const hxT = HX / 4
    const t0 = phC + PC / 2
    for (let s = 0; s < 4; s++) {
      const cx = -HX + hxT * (2 * s + 1)
      if (s === gapC) k.box({ x: cx, z: rowC, hx: hxT, hz: (tileZ1 - tileZ0) / 2, top: Y_C })
      else k.box({ x: cx, z: rowC, hx: hxT, hz: (tileZ1 - tileZ0) / 2, top: Y_C, look: 'deck-tile', role: 'floor', ledge: false, move: crackMove(PC, t0), tele: crackTele(PC, t0) })
    }
  }
  ROW_X.forEach((x, s) => {
    if (s !== gapC) drops.push({ x, z: rowC, y: Y_C, yaw: 0, at: PC / 2, P: PC, ph: phC, crack: tier === 3 })
  })

  // Every sprinkle: falling (it lands on the clock; the ring under it is the scene's), then lying, hopping or rolling.
  for (const d of drops) {
    const tDown = d.ph + d.at
    k.hazard({
      shape: 'bar',
      x: d.x,
      y: d.y,
      z: d.z,
      yaw: d.yaw,
      r: R,
      len: LEN,
      hit: fallHit,
      look: 'sprinkle',
      role: 'dodge',
      path: {
        P: d.P,
        ph: tDown - fall,
        life: fall,
        at: (tau, _k, o) => {
          const u = tau / fall
          o.y = R + HIGH * (1 - u * u)
          o.yaw = SPIN * Math.max(0, fall * SETTLE - tau)
        },
      },
    })
    const roll = d.roll
    const cracks = !!d.crack
    k.hazard({
      shape: 'bar',
      x: d.x,
      y: d.y,
      z: d.z,
      yaw: d.yaw,
      r: R,
      len: LEN,
      hit: roll ? ROLL_HIT : LIE_HIT,
      look: 'sprinkle',
      role: 'dodge',
      path: {
        P: d.P,
        ph: tDown,
        life: roll ? roll.dur : lie,
        at: (tau, _k, o) => {
          o.y = R + (tau < HOP_T ? HOP * Math.sin((Math.PI * tau) / HOP_T) : 0)
          if (roll) {
            // Down the ramp and off its foot, on the surface under it.
            o.z = roll.dz * Math.max(0, tau - HOP_T * 0.5) * ROLL_V
            o.y += surf(d.z + o.z) - d.y
          }
          // On a cracking tile it goes down with it.
          if (cracks && tau > CRACK) o.y -= 14 * (tau - CRACK) ** 2
        },
      },
    })
  }

  // The route: each deck's lanes in rows between the waves; over the gap (or down the step), up the ramp. Every
  // spot is a wait spot: the waves leave each one clear between landings.
  k.node('in', 0, -1.5)
  const rowOf = (name: string, xs: readonly number[], z: number) => xs.map((x, l) => k.node(`${name}${l}`, x, z, { y: surf(z) }))
  const link = (from: string[], to: string[], fx: readonly number[], tx: readonly number[], move: 'run' | 'jump' = 'run') => {
    from.forEach((f, i) => {
      // Ahead to the nearest lane on, and the ones either side of it.
      const near = tx.map((x, j) => ({ j, d: Math.abs(x - fx[i]!) })).sort((p, q) => p.d - q.d)
      for (const { j, d } of near) if (d < 2.6) k.edge(f, to[j]!, move, move === 'jump' ? { takeoff: 'edge', inset: 0.4 } : {})
    })
  }
  const lateral = (row: string[]) => {
    for (let l = 0; l + 1 < row.length; l++) {
      k.edge(row[l]!, row[l + 1]!)
      k.edge(row[l + 1]!, row[l]!)
    }
  }
  const laneA = [-3.4, -1.13, 1.13, 3.4]
  const nodeRowsA = [rowsA[0]! + 1.8, rowsA[1]! + 1.8, a1 - 0.7]
  const rowsN: string[][] = nodeRowsA.map((z, j) => rowOf(`a${j}`, laneA, z))
  laneA.forEach((_, l) => k.edge('in', rowsN[0]![l]!))
  for (let j = 0; j + 1 < rowsN.length; j++) link(rowsN[j]!, rowsN[j + 1]!, laneA, laneA)
  // Steps aside in every row but the last before the gap (or the ramp): from there the way on is slower than its
  // length says (a jump, a climb), and the live hands would step aside and back for ever.
  rowsN.slice(0, -1).forEach(lateral)
  // A march's middle row: halfway down it, where you can step across into the quiet lane.
  const nodeRowsB = nMarch > 0 ? [b0 + 0.8, marchZ0 + (MARCH_STEP * (nMarch - 1)) / 2, b1 - 1.3] : [b0 + 0.8, (sweepsB[0]! + sweepsB[1]!) / 2, b1 - 1.3]
  const rowsB = nodeRowsB.map((z, j) => rowOf(`b${j}`, laneB, z))
  link(rowsN[rowsN.length - 1]!, rowsB[0]!, laneA, laneB, gap > 0 ? 'jump' : 'run')
  for (let j = 0; j + 1 < rowsB.length; j++) link(rowsB[j]!, rowsB[j + 1]!, laneB, laneB)
  rowsB.slice(0, -1).forEach(lateral)
  const laneC = [-3.4, -1.13, 1.13, 3.4]
  const ringNode = k.node('ring', ringX, ringZ, { y: Y_C })
  const rowsC = [rowOf('c0', laneC, c0 + 0.9), rowOf('c1', laneC, rowC - 1.8), rowOf('c2', laneC, c1 - 0.8)]
  link(rowsB[rowsB.length - 1]!, rowsC[0]!, laneB, laneC)
  link(rowsC[0]!, rowsC[1]!, laneC, laneC)
  link(rowsC[1]!, rowsC[2]!, laneC, laneC)
  rowsC.forEach(lateral)
  rowsC[0]!.forEach((id, l) => {
    if (Math.abs(laneC[l]! - ringX) < 2.6) k.edge(id, ringNode)
  })
  rowsC[1]!.forEach((id, l) => {
    if (Math.abs(laneC[l]! - ringX) < 2.6) k.edge(ringNode, id)
  })
  k.node('out', 0, c1 + 1.5, { y: Y_C })
  rowsC[2]!.forEach((id) => k.edge(id, 'out'))
  return k.done({ x: 0, y: Y_C, z: c1 })
}

/** A cracked tile's motion: whole, cracked (CRACK s), dropped and gone (GONE s), rising back (BACK s), from t0 every P. */
function crackMove(P: number, t0: number): MoveFn {
  return (t, o) => {
    const s = frac((t - t0) / P) * P
    if (s < CRACK) return
    if (s < CRACK + GONE) {
      const f = s - CRACK
      o.y = -Math.min(6, 14 * f * f)
      o.on = false
    } else if (s < CRACK + GONE + BACK) {
      const u = (s - CRACK - GONE) / BACK
      o.y = -1.5 * (1 - u) * (1 - u)
      o.on = false
    }
  }
}

/** Its telegraph: `warn` while it's cracked, `hold` while it's gone, `back` as it rises, `rest` whole. */
function crackTele(P: number, t0: number): TeleFn {
  return (t) => {
    const s = frac((t - t0) / P) * P
    if (s < CRACK) return { state: 'warn', u: s / CRACK }
    if (s < CRACK + GONE) return { state: 'hold', u: (s - CRACK) / GONE }
    if (s < CRACK + GONE + BACK) return { state: 'back', u: (s - CRACK - GONE) / BACK }
    return { state: 'rest', u: (s - CRACK - GONE - BACK) / Math.max(1e-6, P - CRACK - GONE - BACK) }
  }
}

export const ROUND: RoundDef = {
  letter: 'd',
  name: 'Sprinkle Drop',
  hint: 'watch for the rings',
  family: 'D',
  phase: 2,
  build,
}
