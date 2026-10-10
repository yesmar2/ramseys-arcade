/**
 * Candy Lifts (e, F; a round of our own, gen 2): a cliff climbed on candy lifts. Each lift rises and sinks on its own
 * beat, about the round's period (a pause at the bottom, up, a pause at the top, down: eased, so it starts and stops
 * gently; its arrows blink for the last 0.6 s of each pause), and the lifts stand in a staircase up the cliff, each
 * reaching higher than the last, a hop apart over the soda sea. Most of the time the next lift is a hop away; when
 * it's up at the top of its travel and yours is down, it's out of reach: ride yours until they pass each other (a
 * missed hop drops you in the sea). Jumping off a rising lift goes higher. On T3 the last lift of each flight slides
 * side to side as well. At the top of the first flight a drop takes you down to a lower ledge (T2 and T3 climb a
 * second flight after it), so it's up and down; the round ends at most EXIT_MOST up and the course slides down from
 * there.
 *
 * T1: two lifts, the top ledge, a drop. T2: three lifts, a drop, one more. T3: three lifts, a drop, two more. The
 * gold line, **Skip Lift** (T2, T3): from the gold-edged first lift, a bold late dive right over the next lift onto
 * the one after.
 *
 * The bots: a node rides each lift (`on`), a spot on each ledge; every hop is a jump from the edge. The main way hops
 * only onto what stands at most RISE_OK over what it leaves when it lands (a careful hop: it rides until the lifts
 * pass each other); the gold copy of each hop has no such window (the fast hands climb on, on time).
 */
import { G, JUMP, RUN } from '../sim.ts'
import type { MoveFn, RoundDef, RoundOut, RoundSlot, Rng, TeleFn, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** A lift's beat: `low` s at the bottom, `up` rising, `high` at the top, `down` sinking, from phase ph. */
type Beat = { low: number; up: number; high: number; down: number; ph: number }
type Lift = { x: number; z: number; y0: number; rise: number; beat: Beat; slide: number; slideT: number; slidePh: number }
type Ledge = { x: number; hx: number; z0: number; z1: number; y: number }
type Piece = { kind: 'flight'; n: number } | { kind: 'drop' }

const ease = (u: number) => u * u * (3 - 2 * u)
const periodOf = (b: Beat) => b.low + b.up + b.high + b.down
const frac = (v: number) => v - Math.floor(v)

/** Lifts: at most this fast (peak, m/s: slow enough to keep their ledges), this big, this thick, the blink's length. */
const LIFT_V = 1.6
const LIFT_HX = 1.7
const LIFT_HZ = 1.6
const LIFT_HY = 0.45
const LIFT_WARN = 0.6
/** Jumps take off this far from the edge; a running jump off the drop lands at least DROP_SPARE short of the ledge's end. */
const INSET = 0.45
const DROP_SPARE = 0.6
/**
 * The main way hops onto what's at most this much above it as it lands (a clean landing from a run: a running jump's
 * feet cross a near edge 1.3–1.7 m off at 1.5–1.8 m up); an expert climbs onto a lift that's higher, on time (gold).
 */
const RISE_OK = 1.5
/** The blue's guesses: up to speed from a stand in about 0.11 s and 0.37 m, then 6.77 m/s; a hop's flight. */
const RUN_UP_T = 0.11
const RUN_UP_D = 0.37
const BLUE_SPEED = 6.77
const HOP_T = 0.45
/**
 * The highest the round ends: gen 1's joins (a solo course's, at any generation) slide down from there, and gen 1's
 * slide down 6 m or more splats you at its foot (scratchpad gen2/requests.md #1, #14).
 */
const EXIT_MOST = 5.0

/** How far up a lift is at t, 0 (bottom) to 1 (top). Arithmetic only. */
function liftU(b: Beat, t: number): number {
  const T = periodOf(b)
  let s = frac((t + b.ph) / T) * T
  if (s < b.low) return 0
  s -= b.low
  if (s < b.up) return ease(s / b.up)
  s -= b.up
  if (s < b.high) return 1
  s -= b.high
  return 1 - ease(s / b.down)
}

/** Up and down by its beat; a sliding lift (T3) side to side as well, on a beat of its own. */
function liftMove(L: Lift): MoveFn {
  if (L.slide > 0) {
    const w = (2 * Math.PI) / L.slideT
    return (t, o) => {
      o.y = L.rise * liftU(L.beat, t)
      o.x = L.slide * Math.sin(w * (t + L.slidePh))
    }
  }
  return (t, o) => void (o.y = L.rise * liftU(L.beat, t))
}

/** Its blink: `warn` for the last LIFT_WARN s of each pause, `act` rising, `back` sinking, `rest` otherwise. */
function liftTele(b: Beat): TeleFn {
  return (t) => {
    const T = periodOf(b)
    let s = frac((t + b.ph) / T) * T
    if (s < b.low) return s > b.low - LIFT_WARN ? { state: 'warn', u: (s - (b.low - LIFT_WARN)) / LIFT_WARN } : { state: 'rest', u: s / b.low }
    s -= b.low
    if (s < b.up) return { state: 'act', u: s / b.up }
    s -= b.up
    if (s < b.high) return s > b.high - LIFT_WARN ? { state: 'warn', u: (s - (b.high - LIFT_WARN)) / LIFT_WARN } : { state: 'rest', u: s / b.high }
    s -= b.high
    return { state: 'back', u: s / b.down }
  }
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('climb')
  const P = slot.period
  const pieces: Piece[] = byTier<Piece[]>(tier, [
    [{ kind: 'flight', n: 2 }, { kind: 'drop' }],
    [{ kind: 'flight', n: 3 }, { kind: 'drop' }, { kind: 'flight', n: 1 }],
    [{ kind: 'flight', n: 3 }, { kind: 'drop' }, { kind: 'flight', n: 2 }],
  ])
  // Each lift's travel, and how much higher each one stands than the last.
  const h = byTier(tier, [1.6, 2.1, 2.5])
  const step = byTier(tier, [0.9, 1.4, 1.15])
  const T = P * 1.6

  const ledges: Ledge[] = [{ x: 0, hx: 4.5, z0: 0, z1: rng.between(4.0, 5.0), y: 0 }]
  const lifts: Lift[] = []
  /** The route in order: ledges `l<i>` and lifts `f<j>`. */
  const chain: string[] = ['l0']
  const flights: number[][] = []
  let z = ledges[0]!.z1
  let y = 0
  let dropAt = -1
  let dropLift = 0
  pieces.forEach((pc, pi) => {
    const last = pi === pieces.length - 1
    if (pc.kind === 'flight') {
      const ids: number[] = []
      // The first lift's bottom: a little under the ledge it's hopped onto from.
      let b = y - rng.between(0.2, 0.6)
      const sway = rng.sign()
      for (let j = 0; j < pc.n; j++) {
        const gap = rng.between(1.3, 1.7)
        const x = (j % 2 === 0 ? sway : -sway) * rng.between(0.6, 1.4)
        const zc = z + gap + LIFT_HZ
        // Its own beat, about the round's: moves no quicker than LIFT_V, the rest of the beat pauses.
        const Ti = T * rng.between(0.88, 1.12)
        const move = Math.max((1.5 * h) / LIFT_V, 0.22 * Ti)
        const pause = Math.max(0.6, (Ti - 2 * move) / 2)
        const beat: Beat = { low: pause, up: move, high: pause, down: move, ph: 0 }
        beat.ph = rng.between(0, periodOf(beat))
        const sliding = tier === 3 && j === pc.n - 1
        const slide = rng.between(0.9, 1.3)
        const slideT = Math.max(P * rng.between(1.1, 1.3), (2 * Math.PI * slide) / LIFT_V)
        const slidePh = rng.between(0, slideT)
        lifts.push({ x, z: zc, y0: b, rise: h, beat, slide: sliding ? slide : 0, slideT, slidePh })
        ids.push(lifts.length - 1)
        chain.push(`f${lifts.length - 1}`)
        z = zc + LIFT_HZ
        b += step
      }
      flights.push(ids)
      // The ledge at the top of the flight, level with its last lift's top.
      const top = lifts[lifts.length - 1]!
      const gap = rng.between(1.2, 1.6)
      const len = last ? rng.between(4.5, 5.5) : rng.between(4.0, 5.0)
      y = top.y0 + top.rise
      ledges.push({ x: last ? 0 : top.x * 0.5, hx: last ? 4.5 : 3.6, z0: z + gap, z1: z + gap + len, y })
      z += gap + len
    } else {
      // The way down: a drop off the ledge's end onto a lower one.
      dropAt = ledges.length
      dropLift = lifts.length
      const drop = rng.between(1.6, 2.2)
      const gap = rng.between(1.2, 1.6)
      const len = last ? rng.between(4.5, 5.5) : rng.between(4.0, 5.0)
      y -= drop
      ledges.push({ x: 0, hx: last ? 4.5 : 3.8, z0: z + gap, z1: z + gap + len, y })
      z += gap + len
    }
    chain.push(`l${ledges.length - 1}`)
  })
  // Too high at the end: the drop goes deeper (everything after it comes down with it).
  const over = ledges[ledges.length - 1]!.y - EXIT_MOST
  if (over > 0 && dropAt >= 0) {
    for (let i = dropAt; i < ledges.length; i++) ledges[i]!.y -= over
    for (let j = dropLift; j < lifts.length; j++) lifts[j]!.y0 -= over
  }
  // The ledge below the drop is long enough to land a running jump off its edge (a jump down goes further than it
  // looks): what comes after it moves on to make room.
  if (dropAt >= 0) {
    const A = ledges[dropAt - 1]!
    const D = ledges[dropAt]!
    const need = (RUN * (JUMP + Math.sqrt(JUMP * JUMP + 2 * G * (A.y - D.y)))) / G + DROP_SPARE - (D.z1 - A.z1)
    if (need > 0) {
      D.z1 += need
      for (let i = dropAt + 1; i < ledges.length; i++) {
        ledges[i]!.z0 += need
        ledges[i]!.z1 += need
      }
      for (let j = dropLift; j < lifts.length; j++) lifts[j]!.z += need
    }
  }
  const end = ledges[ledges.length - 1]!

  // Lay it: ledges as cliffs reaching down past the lowest lift, lifts as candy slabs on their poles.
  const lowest = Math.min(...ledges.map((L) => L.y), ...lifts.map((L) => L.y0))
  const deep = lowest - 4
  for (const L of ledges) k.box({ x: L.x, z: (L.z0 + L.z1) / 2, hx: L.hx, hz: (L.z1 - L.z0) / 2, top: L.y, hy: (L.y - deep) / 2, look: 'terrace' })
  const goldFrom = tier >= 2 ? flights[0]![0]! : -1
  // A sliding lift can move quicker than LIFT_V all told: no ledge to catch on it (README: none past 1.6 m/s).
  const liftIdx = lifts.map((L, j) => k.box({ x: L.x, z: L.z, hx: LIFT_HX, hz: LIFT_HZ, top: L.y0, hy: LIFT_HY, look: 'lift', role: 'floor', gold: j === goldFrom, ledge: L.slide === 0, move: liftMove(L), tele: liftTele(L.beat) }))
  // (The scene stands each lift's guide poles from its motion: no dressing needed.)
  k.death(-1, end.z1 + 1, lowest - 3)

  // The route: a spot on each ledge, a node riding each lift.
  const spotZ = (i: number) => {
    const L = ledges[i]!
    return i === 0 ? Math.max(L.z0 + 1, L.z1 - 1.9) : Math.min(L.z1 - 1.5, (L.z0 + L.z1) / 2)
  }
  k.node('in', 0, -1.5)
  ledges.forEach((L, i) => k.node(`l${i}`, L.x, spotZ(i), { y: L.y }))
  lifts.forEach((L, j) => k.node(`f${j}`, L.x, L.z, { y: L.y0, on: liftIdx[j] }))
  k.edge('in', 'l0')
  // How high a node's floor is at t; how soon a jump from it takes off.
  const yOf = (id: string, t: number) => {
    if (id[0] === 'l') return ledges[Number(id.slice(1))]!.y
    const L = lifts[Number(id.slice(1))]!
    return L.y0 + L.rise * liftU(L.beat, t)
  }
  const leaveAfter = (id: string) => {
    const run = id[0] === 'l' ? ledges[Number(id.slice(1))]!.z1 - spotZ(Number(id.slice(1))) - INSET : LIFT_HZ - INSET
    return RUN_UP_T + Math.max(0, run - RUN_UP_D) / BLUE_SPEED
  }
  for (let c = 0; c + 1 < chain.length; c++) {
    const a = chain[c]!
    const b = chain[c + 1]!
    const tk = leaveAfter(a)
    // Leniently: some take-off near when it would go has what it lands on no more than RISE_OK up as it gets there.
    k.edge(a, b, 'jump', {
      takeoff: 'edge',
      inset: INSET,
      window: (t) => {
        for (let u = tk - 0.1; u <= tk + 0.3; u += 0.05) if (yOf(b, t + u + HOP_T) - yOf(a, t + u) <= RISE_OK) return true
        return false
      },
    })
    k.edge(a, b, 'jump', { tier: 'gold', takeoff: 'edge', inset: INSET })
  }
  // T2, T3: a flag on the first flight's top ledge, so a fall later on doesn't send you back to the bottom.
  if (tier >= 2) {
    const id = chain[chain.indexOf(`f${flights[0]![flights[0]!.length - 1]}`) + 1]!
    const i = Number(id.slice(1))
    k.flag(ledges[i]!.x, spotZ(i), id, ledges[i]!.y)
  }
  // Skip Lift (gold): from the gold-edged first lift, a late dive over the next onto the one after.
  if (goldFrom >= 0) {
    const ids = flights[0]!
    k.edge(`f${ids[0]}`, `f${ids[2]}`, 'lateDive', { tier: 'gold', takeoff: 'edge', inset: 0.3 })
    const A = lifts[ids[0]!]!
    const C = lifts[ids[2]!]!
    k.gold('Skip Lift', A.z + LIFT_HZ, C.z - LIFT_HZ, (A.x + C.x) / 2)
  }
  k.node('out', end.x, end.z1 + 1.5, { y: end.y })
  k.edge(chain[chain.length - 1]!, 'out')
  return k.done({ x: end.x, y: end.y, z: end.z1 })
}

export const ROUND: RoundDef = {
  letter: 'e',
  name: 'Candy Lifts',
  hint: 'hop lift to lift',
  family: 'F',
  phase: 2,
  build,
}
