/**
 * Fizz Geysers (v, A; a round of our own, gen 2): a climb up candy-rock ledges out of the soda sea, carried up by
 * soda geysers. Each geyser keeps its own beat on the run clock, about the round's period: it bubbles (the warn, at
 * least 0.6 s, with a rumble), erupts, sputters for its last 0.6 s (`hold`: about to stop), dies down, rests.
 *
 * - A **vent** in a pool at the front of a ledge throws you up onto the ledge above (2.65–3.0 m up, a gap away: no
 *   jump reaches) if you're on it while it erupts. Get there early and you stand on a dead vent until it goes. A
 *   bounce pad lit while erupting, aimed at the landing spot above (the summit pad's throw).
 * - A **fizz column** rises out of the sea in the gap in front of a cliff (2.65–2.9 m up): jump into it while it
 *   erupts and its lift carries you up past the cliff top, steering on. Jump in as it stops and you fall short into
 *   the sea. A wind volume with `up` lift (34 m/s², over gravity's 28) and no push, from just under the take-off to
 *   just over the cliff top.
 * - A **spray** erupts under a level gap between a ledge and a rock, leaning across it: jump through it while it
 *   blows and it throws you up and off line, off the rock into the sea. Wait for it to settle. A wind volume with a
 *   gentler lift and a sideways `carry`, over the gap and the rock's first metre.
 * - A **way down** (a drop onto a lower ledge), so it's up and down; the round ends at most EXIT_MOST up and the
 *   course slides down from there.
 *
 * T1: spray, vent, drop, column (a gentle spray, a column that's nearly always up). T2: spray, column, vent, drop,
 * hop. T3: the same, then a second spray and a column after the drop. The gold line, **Big Fizz** (T2, T3): a gold
 * vent on a small rock out in the sea beside the first spray, a long hop off the runway's corner; its quick
 * eruptions throw you right over the spray, the rock and the column.
 *
 * The bots: vents are `bounce` edges (the bot stands on the vent until it goes); a column is a jump whose window
 * wants the column erupting as you go in; a spray is a jump whose window wants it calm for the hop (the gold copy
 * has none: the fast hands may steer through). Wait spots are clear of every pool and spray.
 */
import { G, JUMP, RUN } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, TeleFn, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** A geyser's beat: every T s from phase ph it erupts for `erupt` s, dies down over `down`, rests, then warns for `warn`. */
type Geyser = { T: number; ph: number; erupt: number; down: number; warn: number }

const frac = (v: number) => v - Math.floor(v)
/** Seconds into geyser g's cycle at t, 0 as an eruption starts. */
const cycleOf = (g: Geyser, t: number) => frac((t + g.ph) / g.T) * g.T
const erupting = (g: Geyser, t: number) => cycleOf(g, t) < g.erupt

/** Full while erupting, fading over the die-down, nothing at rest. */
function geyserDuty(g: Geyser): (t: number) => number {
  return (t) => {
    const s = cycleOf(g, t)
    if (s < g.erupt) return 1
    if (s < g.erupt + g.down) return 1 - (s - g.erupt) / g.down
    return 0
  }
}

/** A geyser sputters this long before it stops (its `hold`). */
const SPUTTER = 0.6

/**
 * A geyser's telegraph: `warn` (bubbling, the rumble) for its last `warn` s before an eruption, `act` erupting,
 * `hold` its last SPUTTER s (sputtering: about to stop), `back` dying down, `rest` calm.
 */
function geyserTele(g: Geyser): TeleFn {
  const sputter = Math.min(SPUTTER, g.erupt / 2)
  return (t) => {
    const s = cycleOf(g, t)
    if (s < g.erupt - sputter) return { state: 'act', u: s / (g.erupt - sputter) }
    if (s < g.erupt) return { state: 'hold', u: (s - (g.erupt - sputter)) / sputter }
    if (s < g.erupt + g.down) return { state: 'back', u: (s - g.erupt) / g.down }
    const restEnd = g.T - g.warn
    if (s < restEnd) return { state: 'rest', u: (s - g.erupt - g.down) / Math.max(1e-6, restEnd - g.erupt - g.down) }
    return { state: 'warn', u: Math.min(1, (s - restEnd) / g.warn) }
  }
}

/** Whether geyser g is calm (no lift, no push) for all of [t, t + dur]. */
function calmFor(g: Geyser, t: number, dur: number): boolean {
  const s = cycleOf(g, t)
  return s >= g.erupt + g.down && s + dur <= g.T
}

type Ledge = { x: number; hx: number; z0: number; z1: number; y: number; rock: boolean }
type Kind = 'vent' | 'column' | 'spray' | 'hop' | 'drop'

/** A vent: its pool's r, its centre this far in from its ledge's front edge, its throw, landing this far past the face. */
const VENT_R = 1.1
const VENT_BACK = 1.45
const VENT_VY = 15
const LAND_PAST = 2.3
/** A fizz column: its lift, how far over the upper ledge its top reaches, how far under the take-off it starts, its half width. */
const COLUMN_UP = 34
const COLUMN_OVER = 0.5
const COLUMN_UNDER = 1.0
const COLUMN_HX = 1.8
/** A spray: its lift, how high it reaches over the higher side, how far it reaches onto the rock it lands on. */
const SPRAY_UP = 14
const SPRAY_TALL = 4.5
const SPRAY_ON = 1.0
/** How far a spray reaches across its lane: a little to the side it comes from, well out to the side it pushes to. */
const SPRAY_BACK = 1.2
const SPRAY_REACH = 3.8
/** The calm a spray keeps between eruptions at least: a hop after a careful look, and a phone's late start. */
const SPRAY_CALM = 2.3
/** Big Fizz: the gold rock, its gold vent's pool, the throw. */
const GOLD_ROCK_R = 1.2
const GOLD_VENT_R = 0.9
const GOLD_VY = 19
/** Wait spots this far back from a ledge's front edge; jumps take off this far from it. */
const WAIT_BACK = 1.9
const INSET = 0.45
/** A running jump off a drop's edge lands at least this far short of the end of the ledge below. */
const DROP_SPARE = 0.6
/** The blue's guesses: up to speed from a stand in about 0.11 s and 0.37 m, then 6.77 m/s. */
const RUN_UP_T = 0.11
const RUN_UP_D = 0.37
const BLUE_SPEED = 6.77
/**
 * The highest the round ends: gen 1's joins (a solo course's, at any generation) slide down from there, and gen 1's
 * slide down 6 m or more splats you at its foot (scratchpad gen2/requests.md #1, #14).
 */
const EXIT_MOST = 5.0

/**
 * The steps up the climb, by tier (see the top). From T2 the column comes before the vent: a vent sets everyone off
 * together as it goes, so the column after one would be timed the same for everyone who just runs on.
 */
function stepsFor(tier: Tier): Kind[] {
  if (tier === 1) return ['spray', 'vent', 'drop', 'column']
  if (tier === 2) return ['spray', 'column', 'vent', 'drop', 'hop']
  return ['spray', 'column', 'vent', 'drop', 'spray', 'column']
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('climb')
  const P = slot.period
  const kinds = stepsFor(tier)
  const n = kinds.length
  // Big Fizz (T2, T3) stands beside the first spray, on a side of its own; that spray's rock keeps to the other.
  const gold = tier >= 2
  const goldSide = rng.sign()

  // The ledges: the runway, then one ledge (or rock) after each step. A spray lands on a rock; the last ledge is the
  // full width, ending where the pad after starts.
  const ledges: Ledge[] = [{ x: 0, hx: 4.5, z0: 0, z1: rng.between(5.0, 6.0), y: 0, rock: false }]
  for (let i = 0; i < n; i++) {
    const kind = kinds[i]!
    const L = ledges[i]!
    const last = i === n - 1
    const next = kinds[i + 1]
    let gap: number
    let y: number
    if (kind === 'vent') {
      gap = rng.between(1.4, 1.9)
      y = L.y + rng.between(2.65, 3.0)
    } else if (kind === 'column') {
      gap = rng.between(2.4, 2.8)
      y = L.y + rng.between(2.65, 2.9)
    } else if (kind === 'drop') {
      gap = rng.between(1.2, 1.8)
      y = L.y - (tier === 3 ? rng.between(2.3, 2.8) : rng.between(1.3, 1.8))
    } else {
      gap = kind === 'spray' ? byTier(tier, [rng.between(2.0, 2.4), rng.between(2.3, 2.8), rng.between(2.5, 3.0)]) : rng.between(1.8, 2.4)
      y = L.y + rng.between(-0.6, 0.3)
    }
    const rock = kind === 'spray' && !last
    const z0 = L.z1 + gap
    // Long enough to land a vent's throw and wait clear of the next vent's pool; a rock before a jump is short.
    const len = next === 'vent' ? rng.between(6.4, 7.2) : rock ? rng.between(4.0, 4.8) : last ? rng.between(5.0, 6.0) : rng.between(5.5, 6.5)
    const hxRock = tier === 1 ? rng.between(2.2, 2.6) : rng.between(1.7, 2.1)
    const hxLedge = rng.between(3.2, 4.5)
    const shift = rng.between(-1.5, 1.5)
    const hx = last ? 4.5 : rock ? hxRock : hxLedge
    let x = last ? 0 : Math.max(-4.5 + hx, Math.min(4.5 - hx, L.x + shift))
    // The first spray's rock, beside Big Fizz: over to the other side, well clear of the gold rock.
    if (gold && i === 0) x = -goldSide * (1.2 + Math.abs(shift) * 0.4)
    ledges.push({ x, hx, z0, z1: z0 + len, y, rock })
  }
  // Too high at the end: the way down drops further.
  const over = ledges[n]!.y - EXIT_MOST
  const di = kinds.indexOf('drop')
  if (over > 0 && di >= 0) for (let j = di + 1; j <= n; j++) ledges[j]!.y -= over
  // The ledge below a drop is long enough to land a running jump off its edge (a jump down goes further than it
  // looks): what comes after it moves on to make room.
  if (di >= 0) {
    const A = ledges[di]!
    const D = ledges[di + 1]!
    const fall = A.y - D.y
    const need = (RUN * (JUMP + Math.sqrt(JUMP * JUMP + 2 * G * fall))) / G + DROP_SPARE - (D.z1 - A.z1)
    if (need > 0) {
      D.z1 += need
      for (let j = di + 2; j <= n; j++) {
        ledges[j]!.z0 += need
        ledges[j]!.z1 += need
      }
    }
  }
  const lowest = Math.min(...ledges.map((L) => L.y))
  const deep = lowest - 4
  // Candy rocks standing up out of the sea: each body reaches down past the lowest ledge.
  for (const L of ledges) k.box({ x: L.x, z: (L.z0 + L.z1) / 2, hx: L.hx, hz: (L.z1 - L.z0) / 2, top: L.y, hy: (L.y - deep) / 2, look: L.rock ? 'island' : 'terrace' })
  const end = ledges[n]!

  // Splat heights: 5 m under the lower of each stretch's two floors.
  for (let i = 0; i <= n; i++) {
    const L = ledges[i]!
    const N = ledges[i + 1]
    k.death(L.z0, N ? N.z0 : L.z1, Math.min(L.y, N ? N.y : L.y) - 5)
  }

  // Each ledge's wait spot: before a vent, clear of its pool; before a jump, WAIT_BACK from the front edge (or the
  // middle of a short rock); on the last, a few metres in.
  const spot = (i: number) => {
    const L = ledges[i]!
    if (kinds[i] === 'vent') return { x: L.x, z: Math.max(L.z0 + 0.8, L.z1 - VENT_BACK - VENT_R - 1.0) }
    if (i === n) return { x: L.x, z: Math.min(L.z1 - 1.5, L.z0 + 3.0) }
    return { x: L.x, z: Math.max((L.z0 + L.z1) / 2, L.z1 - WAIT_BACK) }
  }
  const node = (i: number) => `l${i}`
  k.node('in', 0, -1.5)
  ledges.forEach((L, i) => {
    const s = spot(i)
    k.node(node(i), s.x, s.z, { y: L.y })
  })
  k.edge('in', node(0))
  // A flag on the first ledge up (T2, T3): a fall higher up doesn't send you back to the bottom.
  if (tier >= 2) {
    const f = kinds.findIndex((kd) => kd === 'vent' || kd === 'column') + 1
    const s = spot(f)
    k.flag(s.x, s.z, node(f), ledges[f]!.y)
  }

  // The geysers' beats: each its own, about the round's period.
  const beat = (erupt: number, down: number, warn: number, scale = 1): Geyser => {
    const T = P * scale * rng.between(0.95, 1.1)
    return { T, ph: rng.between(0, T), erupt, down, warn }
  }
  /** When a jump from ledge i's spot takes off, after setting off. */
  const takeoffAfter = (i: number) => {
    const L = ledges[i]!
    const s = spot(i)
    return RUN_UP_T + Math.max(0, L.z1 - s.z - INSET - RUN_UP_D) / BLUE_SPEED
  }

  for (let i = 0; i < n; i++) {
    const kind = kinds[i]!
    const L = ledges[i]!
    const N = ledges[i + 1]!
    const s0 = spot(i)
    const sN = spot(i + 1)
    if (kind === 'vent') {
      // The vent, on the line to the landing spot above; the bot stands on it until it goes.
      const g = beat(byTier(tier, [1.3, 1.1, 1.0]), 0.35, 0.8)
      const vx = Math.max(L.x - L.hx + VENT_R + 0.2, Math.min(L.x + L.hx - VENT_R - 0.2, sN.x))
      const vz = L.z1 - VENT_BACK
      const aim = { x: sN.x, y: N.y, z: N.z0 + LAND_PAST }
      const vent = k.cyl({ x: vx, z: vz, r: VENT_R, top: L.y + 0.04, hy: 0.3, look: 'geyser-vent', role: 'helps', ledge: false, bounce: { vy: VENT_VY, aim, lit: (t) => erupting(g, t) }, tele: geyserTele(g) })
      k.deco({ look: 'geyser', x: vx, y: L.y, z: vz, sx: VENT_R * 2, sy: 4, sz: VENT_R * 2, ref: { kind: 'solid', i: vent }, params: { h: 4, r: VENT_R * 0.8 } })
      // The main way waits beside the vent and steps on as it erupts (erupting as it gets there, give or take); the gold
      // copy goes straight on and stands on the dead vent until it goes. Either way a bot that's on it when it's dead
      // stands there for the next eruption (maxT allows a whole beat).
      const reach = RUN_UP_T + Math.max(0, Math.hypot(vx - s0.x, vz - s0.z) - VENT_R * 0.5 - RUN_UP_D) / BLUE_SPEED
      const via = [k.at(vx, L.y + 0.04, vz)]
      const maxT = 2.5 + g.T + 1.5
      k.edge(node(i), node(i + 1), 'bounce', {
        via,
        maxT,
        window: (t) => {
          for (let u = reach - 0.1; u <= reach + 0.2; u += 0.05) if (erupting(g, t + u)) return true
          return false
        },
      })
      k.edge(node(i), node(i + 1), 'bounce', { tier: 'gold', via, maxT })
    } else if (kind === 'column') {
      // Off (no lift: a jump in drops you in the sea) for a share of its cycle, at least its warn; up the rest.
      const g = beat(0, 0.3, 0.8, tier === 1 ? 1.4 : 1)
      g.erupt = Math.max(1.4, g.T - 0.3 - Math.max(0.65, g.T * byTier(tier, [0.15, 0.38, 0.25])))
      g.warn = Math.min(0.8, g.T - 0.3 - g.erupt)
      const top = N.y + COLUMN_OVER + 0.7
      const bottom = L.y - COLUMN_UNDER
      const cx = (s0.x + sN.x) / 2
      k.wind({ x: cx, y: (top + bottom) / 2, z: (L.z1 + N.z0) / 2, hx: COLUMN_HX, hy: (top - bottom) / 2, hz: (N.z0 - L.z1) / 2, carry: { x: 0, z: 0 }, up: COLUMN_UP, duty: geyserDuty(g), tele: geyserTele(g), look: 'geyser' })
      // Setting off can work only if the column erupts as you go in: leniently, any lift in [take-off − 0.3, + 0.5].
      const tk = takeoffAfter(i)
      k.edge(node(i), node(i + 1), 'jump', {
        takeoff: 'edge',
        inset: INSET,
        window: (t) => {
          for (let u = tk - 0.3; u <= tk + 0.5; u += 0.05) if (erupting(g, t + u)) return true
          return false
        },
      })
    } else if (kind === 'spray') {
      const erupt = byTier(tier, [0.5, 0.9, 0.85])
      const g = beat(erupt, 0.3, 0.8)
      g.T = Math.max(g.T, erupt + 0.3 + SPRAY_CALM)
      g.ph = rng.between(0, g.T)
      const drawn = rng.sign()
      const side = gold && i === 0 ? -goldSide : drawn
      const w = byTier(tier, [2.6, 3.4, 3.4])
      const top = Math.max(L.y, N.y) + SPRAY_TALL
      const bottom = Math.min(L.y, N.y) - COLUMN_UNDER
      const cx = (s0.x + sN.x) / 2
      // It leans over the rock it lands on: it pushes you all the way down, and on along the rock's first metre.
      const za = L.z1 - 0.3
      const zb = N.z0 + SPRAY_ON
      const xa = cx - side * SPRAY_BACK
      const xb = cx + side * SPRAY_REACH
      k.wind({ x: (xa + xb) / 2, y: (top + bottom) / 2, z: (za + zb) / 2, hx: (SPRAY_BACK + SPRAY_REACH) / 2, hy: (top - bottom) / 2, hz: (zb - za) / 2, carry: { x: side * w, z: 0 }, up: SPRAY_UP, duty: geyserDuty(g), tele: geyserTele(g), look: 'geyser' })
      const tk = takeoffAfter(i)
      k.edge(node(i), node(i + 1), 'jump', { takeoff: 'edge', inset: INSET, window: (t) => calmFor(g, t + tk - 0.15, 1.15) })
      k.edge(node(i), node(i + 1), 'jump', { tier: 'gold', takeoff: 'edge', inset: INSET })
    } else {
      // A hop or a drop: just jump it.
      k.edge(node(i), node(i + 1), 'jump', { takeoff: 'edge', inset: INSET })
    }
  }

  // Big Fizz (T2, T3): beside the first spray, a small rock out in the sea a long hop (2.4–2.8 m) off the runway's
  // corner, with a gold vent on it. Its quick eruptions throw you right over the spray, the rock and the column, onto
  // the ledge above.
  if (gold) {
    const L = ledges[0]!
    const U = ledges[2]!
    const rx = goldSide * (4.5 - GOLD_ROCK_R)
    const rz = L.z1 + GOLD_ROCK_R + rng.between(2.4, 2.8)
    k.cyl({ x: rx, z: rz, r: GOLD_ROCK_R, top: L.y, hy: (L.y - deep) / 2, look: 'island', gold: true })
    const g = beat(0.7, 0.3, 0.65, 0.5)
    g.T = Math.max(g.T, 0.7 + 0.3 + 0.65 + 0.2)
    g.ph = rng.between(0, g.T)
    const sU = spot(2)
    const land = { x: Math.max(U.x - U.hx + 1.2, Math.min(U.x + U.hx - 1.2, (goldSide * 2.2 + sU.x) / 2)), y: U.y, z: U.z0 + 2.4 }
    const vent = k.cyl({ x: rx, z: rz, r: GOLD_VENT_R, top: L.y + 0.04, hy: 0.3, look: 'geyser-vent', role: 'helps', gold: true, ledge: false, bounce: { vy: GOLD_VY, aim: land, lit: (t) => erupting(g, t) }, tele: geyserTele(g) })
    k.deco({ look: 'geyser', x: rx, y: L.y, z: rz, sx: GOLD_VENT_R * 2, sy: 7, sz: GOLD_VENT_R * 2, ref: { kind: 'solid', i: vent }, params: { h: 7, r: GOLD_VENT_R * 0.8, gold: true } })
    k.deco({ look: 'gold-flag', x: goldSide * (L.hx - 0.4), y: L.y, z: L.z1 - 0.6, sy: 1.8 })
    k.deco({ look: 'gold-edge', x: goldSide * (L.hx - 1.2), y: L.y + 0.01, z: L.z1 - 0.1, sx: 2.4, sy: 0.05, sz: 0.2 })
    k.gold('Big Fizz', L.z1, U.z0 + 2.4, rx)
    k.node('gr', rx, rz, { y: L.y })
    k.edge(node(0), 'gr', 'jump', { tier: 'gold', takeoff: 'edge', inset: 0.35 })
    k.edge('gr', node(2), 'bounce', { tier: 'gold', via: [k.at(rx, L.y + 0.04, rz)], maxT: 2.5 + g.T + 1.5 })
  }

  k.node('out', end.x, end.z1 + 1.5, { y: end.y })
  k.edge(node(n), 'out')
  return k.done({ x: end.x, y: end.y, z: end.z1 })
}

export const ROUND: RoundDef = {
  letter: 'v',
  name: 'Fizz Geysers',
  hint: 'ride the fizz up',
  family: 'A',
  phase: 2,
  build,
}
