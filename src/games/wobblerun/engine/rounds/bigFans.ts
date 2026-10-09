/**
 * Big Fans (design-final R10, A): floating candy islands over the goo with gaps between them, giant fans on pylons
 * at the sides that spin up and blow across the gaps (neighbours on alternate sides), teal cushion rails on each
 * island's downwind edge so the wind only threatens a jump, and on T2 and up a tail fan behind a long last gap: the
 * Tail Wind gold line. The main way round that gap is a detour by two side islands, three short hops, none of them
 * in the tail wind.
 *
 * The reference round for wind: kit.wind volumes on sim.ts fanDuty / fanTele (OFF, a 0.7 s spin-up with no wind
 * yet, BLOW, a 0.4 s spin-down), `up` for the tail wind's lift, fan decos tied to their volumes, and route windows
 * worked out from a clock thing's cycle (the blue jumps a gap only while its fan stays calm for the whole hop).
 */
import { fanDuty, fanPeriod, fanTele, type FanSpec } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

const SPIN_UP = 0.7
const SPIN_DOWN = 0.4
/** The side fans stand on pylons this far out; their wind reaches this far onto the islands either side of the gap. */
const FAN_X = 5.5
const BAND_ON = 2
/** Every wind volume runs from just under the islands to this high (the bean's middle is what counts). */
const BAND_LO = -1
const BAND_HI = 6
const BAND_HX = 6
/** Cushion rails: 0.6 m tall (the bean steps up 0.5 in its stride), 0.3 m thick, just outside the downwind edge. */
const CUSHION_H = 0.6
const CUSHION_HX = 0.15
/**
 * The tail wind: carry along the course and lift (m/s², the one push that's an acceleration), its band's half
 * width, and how far it runs on over the pad after.
 */
const TAIL_CARRY = 4.5
const TAIL_UP = 8
const TAIL_HX = 1.6
const TAIL_OVER = 3
/** The tail island's half width, the side islands' half width. */
const TAIL_ISLAND_HX = 2.2
const SIDE_HX = 1.7
/** A jump takes off this far from its island's edge. */
const INSET = 0.45
/**
 * The blue's numbers, for its windows and T1's chained fans: up to speed (0.94 of 7.2) from a standstill in about
 * 0.11 s and 0.37 m, a hop's flight, and how near a wait spot counts as there.
 */
const RUN_UP_T = 0.11
const RUN_UP_D = 0.37
const BLUE_SPEED = 6.77
const FLIGHT = 0.75
const THERE = 0.5
/** A hop's window: the fan calm from this long before the take-off for this long. */
const CALM_BEFORE = 0.15
const CALM_FOR = 1.15

type Island = { x: number; y: number; z0: number; z1: number; hx: number }

/** Where fan f is in its cycle at t, s (0 as it switches off). */
function cycleAt(f: FanSpec, t: number): number {
  const T = fanPeriod(f)
  return ((((t + f.ph) / T) % 1) + 1) % 1 * T
}

/** Whether fan f is calm (off or spinning up: no wind) from t for `dur` s. */
function calmFor(f: FanSpec, t: number, dur: number): boolean {
  return cycleAt(f, t) + dur <= f.off + SPIN_UP
}

/**
 * A fan turning over every T s, its off and on split within the spec's ranges (off 1.2–1.8 s, on 1.6–2.2 s), off
 * at least `offLo` and on at least `onLo` where the cycle leaves room.
 */
function fanSpec(rng: Rng, T: number, ph: number, offLo = 1.2, onLo = 1.6): FanSpec {
  const both = T - SPIN_UP - SPIN_DOWN
  const hi = Math.min(1.8, both - onLo)
  const lo = Math.min(Math.max(offLo, both - 2.2), Math.max(hi, both - 2.2))
  const off = hi > lo ? rng.between(lo, hi) : lo
  return { off, on: both - off, ph: ((ph % T) + T) % T }
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('wide')
  const w = byTier(tier, [2.4, 3.0, 3.4])
  const tail = tier >= 2
  // Islands before the tail island (T2 and up) or all of them (T1): 5; 3, the tail island and 2 side; 4, the tail
  // island and 2 side.
  const n = byTier(tier, [5, 3, 4])
  const [gLo, gHi] = byTier(tier, [
    [2.4, 2.8],
    [2.6, 3.2],
    [2.8, 3.4],
  ] as const)
  const [lLo, lHi] = byTier(tier, [
    [5, 7],
    [5, 7],
    [5, 6],
  ] as const)
  // Every fan of the round turns over in the same cycle (off + spin-up + on + spin-down, 3.9–5.1 s), from the
  // round's period, so no two rounds' rhythms match.
  const T = 3.9 + (slot.period - 2.9) * 0.8

  // The detour's side (T2 and up): the side islands are on `sd`, the tail island on the other.
  const sd = rng.sign()
  const gLA = rng.between(2.4, 2.8)
  const tailWidth = 2 * TAIL_ISLAND_HX + gLA + 2 * SIDE_HX
  const tailX = sd * (-tailWidth / 2 + TAIL_ISLAND_HX)
  const sideX = sd * (tailWidth / 2 - SIDE_HX)

  // The main line of islands: zig-zagging up to 1.5 m either side, steps of up to 0.5 m within 0.4 of the base. The
  // last before the tail island leans its way, so the hop onto it is straight ahead.
  const islands: Island[] = []
  const s0 = tail ? -sd * (n % 2 === 0 ? -1 : 1) : rng.sign()
  let z = rng.between(gLo, gHi)
  let y = 0
  for (let i = 0; i < n; i++) {
    const len = rng.between(lLo, lHi)
    y = Math.max(-0.4, Math.min(0.4, y + rng.between(-0.5, 0.5)))
    const x = s0 * (i % 2 === 0 ? 1 : -1) * rng.between(0.5, 1.5)
    islands.push({ x, y, z0: z, z1: z + len, hx: rng.between(2.2, 2.75) })
    z += len + rng.between(gLo, gHi)
  }
  if (tail) islands.push({ x: tailX, y: 0, z0: z, z1: z + rng.between(5.5, 6.5), hx: TAIL_ISLAND_HX })
  for (const I of islands) k.box({ x: I.x, z: (I.z0 + I.z1) / 2, hx: I.hx, hz: (I.z1 - I.z0) / 2, top: I.y, hy: 0.6, look: 'island' })
  const last = islands[islands.length - 1]!

  // Each island's wait spot: clear of the wind at its front (and its back, where the island's long enough). From
  // it, a hop over gap j takes off `takeoff[j]` s after setting off, and gets to the next spot `travel[j]` s after.
  const spot = (I: Island) => Math.max((I.z0 + I.z1) / 2, I.z1 - 2.8)
  const takeoff: number[] = []
  const travel: number[] = []
  for (let j = 0; j < islands.length - 1; j++) {
    const P = islands[j]!
    const Q = islands[j + 1]!
    const dz = spot(Q) - spot(P)
    const run = ((P.z1 - spot(P)) * Math.hypot(Q.x - P.x, dz)) / dz - INSET
    takeoff.push(RUN_UP_T + Math.max(0, run - RUN_UP_D) / BLUE_SPEED)
    const lands = P.z1 - INSET + BLUE_SPEED * FLIGHT
    travel.push(takeoff[j]! + FLIGHT + Math.max(0, spot(Q) - THERE - lands) / BLUE_SPEED + 0.05)
  }

  // The fans: one across each gap between the main islands, neighbours on alternate sides. T1's are chained (the
  // blue, setting off over one as soon as it can, finds the next hop's window just open as it gets there, and has
  // the rest of it to spare for setting off a reaction late), T2's anywhere, T3's out of step with their neighbours
  // (each blows while the last is calm). `calm` is when a fan last went calm.
  const fans: FanSpec[] = []
  const f0 = rng.sign()
  let calm = rng.between(0, T)
  for (let j = 0; j < islands.length - 1; j++) {
    const P = islands[j]!
    const Q = islands[j + 1]!
    if (j > 0) {
      if (tier === 1) calm += travel[j - 1]! - 0.1 + takeoff[j]! - takeoff[j - 1]!
      else if (tier === 2) calm = rng.between(0, T)
      else calm += T / 2 + rng.between(-0.3, 0.3)
    }
    // T1's fans stay off longest, so the chain holds for an arrival a little early or late.
    const spec = fanSpec(rng, T, -calm, tier === 1 ? 1.6 : 1.2)
    fans.push(spec)
    const side = f0 * (j % 2 === 0 ? 1 : -1)
    const za = P.z1 - BAND_ON
    const zb = Q.z0 + BAND_ON
    const vol = k.wind({
      x: 0,
      y: (BAND_LO + BAND_HI) / 2,
      z: (za + zb) / 2,
      hx: BAND_HX,
      hy: (BAND_HI - BAND_LO) / 2,
      hz: (zb - za) / 2,
      carry: { x: -side * w, z: 0 },
      duty: fanDuty(spec),
      tele: fanTele(spec),
    })
    const gz = (P.z1 + Q.z0) / 2
    // The fan (sx its housing's width, sy its pylon's height below it), facing the way it blows.
    k.deco({ look: 'fan', x: side * FAN_X, y: 2.4, z: gz, yaw: (-side * Math.PI) / 2, sx: 3.6, sy: 6, sz: 1.0, ref: { kind: 'volume', i: vol } })
    // Cushions on both islands' downwind edges, inside the wind; arrows painted on the edges, the way it blows
    // (`dir`, yaw sense).
    for (const [I, a, b] of [
      [P, za - 0.3, P.z1 + CUSHION_HX],
      [Q, Q.z0 - CUSHION_HX, zb + 0.3],
    ] as const) {
      const cx = I.x - side * (I.hx + CUSHION_HX)
      k.box({ x: cx, z: (a + b) / 2, hx: CUSHION_HX, hz: (b - a) / 2, top: I.y + CUSHION_H, hy: (CUSHION_H + 0.6) / 2, look: 'cushion', noGround: true, ledge: false })
      k.deco({ look: 'arrow', x: I.x, y: I.y + 0.01, z: I === P ? P.z1 - 1 : Q.z0 + 1, yaw: (-side * Math.PI) / 2, sx: 1.4, sy: 0.02, sz: 1.8, params: { dir: (-side * Math.PI) / 2 } })
    }
  }

  // The route: the wait spots, jumps from the edge toward the next. Over a fan's gap the blue goes only while the fan
  // stays calm for the hop (its run-up to the edge and the flight); an expert jumps through the wind, steering into
  // it (gold).
  k.node('in', 0, -1.5)
  islands.forEach((I, i) => k.node(`i${i}`, I.x, spot(I), { y: I.y }))
  k.edge('in', 'i0', 'jump', { takeoff: 'edge', inset: INSET })
  for (let j = 0; j < islands.length - 1; j++) {
    const f = fans[j]!
    const at = takeoff[j]! - CALM_BEFORE
    k.edge(`i${j}`, `i${j + 1}`, 'jump', { takeoff: 'edge', inset: INSET, window: (t) => calmFor(f, t + at, CALM_FOR) })
    k.edge(`i${j}`, `i${j + 1}`, 'jump', { tier: 'gold', takeoff: 'edge', inset: INSET })
  }

  if (!tail) {
    const exitZ = last.z1 + rng.between(gLo, gHi)
    k.node('out', 0, exitZ + 1.5)
    k.edge(`i${islands.length - 1}`, 'out', 'jump', { takeoff: 'edge', inset: INSET })
    return k.done({ x: 0, y: 0, z: exitZ })
  }

  // The Tail Wind: a 9–10.5 m gap from the tail island straight onto the pad after, a tail fan under the island's
  // front edge blowing along it. During BLOW a running jump off the edge carries 7.2 + 4.5 m/s for about 1.0 s,
  // 11.5 m (the spec's 9–11 m gap left no margin at 11); calm, it carries 5.4 m and splats. The fan keeps the
  // round's cycle, blowing at least 1.6 s of it. Its band runs on over the pad (a landing keeps its lift to the end;
  // a bean down on the pad is only carried on along it) and is clear of the detour's islands.
  const G = byTier(tier, [10, rng.between(9, 10), rng.between(9.5, 10.5)])
  const exitZ = last.z1 + G
  const tailSpec = fanSpec(rng, T, rng.between(0, T), 1.2, 1.8)
  const tailDuty = fanDuty(tailSpec)
  const tailVol = k.wind({
    x: tailX,
    y: 1.5,
    z: (last.z1 + exitZ + TAIL_OVER) / 2,
    hx: TAIL_HX,
    hy: 4.5,
    hz: (exitZ + TAIL_OVER - last.z1) / 2,
    carry: { x: 0, z: TAIL_CARRY },
    up: TAIL_UP,
    duty: tailDuty,
    tele: fanTele(tailSpec),
  })
  k.deco({ look: 'fan', x: tailX, y: -1.4, z: last.z1 + 0.3, sx: 3.4, sy: 4, sz: 1.0, ref: { kind: 'volume', i: tailVol }, params: { tail: true } })
  k.deco({ look: 'gold-edge', x: tailX, y: 0.01, z: last.z1 - 0.1, sx: 2 * TAIL_ISLAND_HX, sy: 0.05, sz: 0.2 })
  k.deco({ look: 'gold-flag', x: tailX - sd * (TAIL_ISLAND_HX - 0.3), y: 0, z: last.z1 - 0.6, sy: 1.8 })
  k.gold('Tail Wind', last.z1, exitZ, tailX)

  // The detour: a side island beside the tail island's front (a hop across), another ahead of it, then a hop onto
  // the pad. None of it is in the tail wind's band.
  const gAB = rng.between(2.4, 2.8)
  const gBP = rng.between(2.4, 2.8)
  const lenB = Math.max(3.0, Math.min(3.6, G - gAB - gBP - 1.0))
  const ext = G - gAB - lenB - gBP
  const lenA = Math.max(3.4, ext + 1.5)
  const A: Island = { x: sideX, y: 0, z0: last.z1 + ext - lenA, z1: last.z1 + ext, hx: SIDE_HX }
  const B: Island = { x: sideX, y: 0, z0: A.z1 + gAB, z1: A.z1 + gAB + lenB, hx: SIDE_HX }
  for (const I of [A, B]) k.box({ x: I.x, z: (I.z0 + I.z1) / 2, hx: I.hx, hz: (I.z1 - I.z0) / 2, top: 0, hy: 0.6, look: 'island' })
  const L = `i${islands.length - 1}`
  k.node('A', A.x, (A.z0 + A.z1) / 2)
  k.node('B', B.x, (B.z0 + B.z1) / 2)
  k.node('tw', tailX, exitZ + 2.2, { wait: 'no' })
  k.node('out', 0, exitZ + 1.5)
  k.edge(L, 'A', 'jump', { takeoff: 'edge', inset: INSET })
  k.edge('A', 'B', 'jump', { takeoff: 'edge', inset: INSET })
  k.edge('B', 'out', 'jump', { takeoff: 'edge', inset: INSET })
  // The gold line: straight off the tail island's front while the tail fan blows (it must still blow mid-flight). A
  // player just jumps; the bots dive late in the jump, since their air steering holds the world speed to a run's.
  k.edge(L, 'tw', 'lateDive', { tier: 'gold', takeoff: 'edge', inset: 0.35, diveAt: 0.4, window: (t) => tailDuty(t + 0.9) > 0 })
  k.edge('tw', 'out', 'run', { tier: 'gold' })
  return k.done({ x: 0, y: 0, z: exitZ })
}

export const ROUND: RoundDef = {
  letter: 'n',
  name: 'Big Fans',
  hint: 'mind the wind',
  family: 'A',
  phase: 1,
  build,
}
