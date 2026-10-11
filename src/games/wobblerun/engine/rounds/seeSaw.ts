/**
 * See-Saw (design-final R6, F): a zig-zag of long candy planks over the goo, each on a ridge pivot along its middle
 * with a bright stripe on the pivot line. A plank tips toward whichever side your bean stands on (a touch thing:
 * sim.ts stepTouch), and tipped past 8° it slides you toward its low side. The planks sit alternately left and right
 * of the middle, so reaching the next one means stepping off your stripe, which tips yours. Steadiness is the skill:
 * there's no gold line and nothing on the planks that hits.
 *
 * The tilt is rate-limited (35°/s), so a full-speed runner crosses before a plank tips much: the blue walks each
 * stripe at 0.75 stick and jumps diagonally for the next one; an expert (the gold edges, full stick) runs it.
 */
import { wave } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** Half a plank's thickness (0.5 m); how far the route's nodes on its stripe sit in from its ends. */
const PLANK_HY = 0.25
const STRIPE_IN = 1.5
const STRIPE_OUT = 1.2
/** The blue's jump for the next plank leaves this far before the end, this far off the stripe toward it. */
const TAKEOFF_BACK = 0.45
const TAKEOFF_SIDE = 0.4
/** The blue walks the planks at this stick (design-final §5.1); the gold edges leave it to the hands. */
const BLUE_STICK = 0.75

type Plank = { x: number; y: number; z0: number; z1: number; hx: number }

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  if ((slot.gen ?? 1) >= 2) return build2(slot, rng, tier)
  const k = kit(slot, tier)
  const n = byTier(tier, [3, 4, 5])
  const gain = byTier(tier, [8, 10, 12])
  const most = byTier(tier, [14, 18, 22])

  // The planks: 10–12 m long, 4–5 m wide, alternately 1.2–1.6 m either side of the middle, 1.6–2.2 m apart, each
  // 0–0.3 m up from the base. The pad before and the pad after are the same gap away.
  const planks: Plank[] = []
  let side = rng.sign()
  let z = 0
  for (let i = 0; i < n; i++) {
    z += rng.between(1.6, 2.2)
    const len = rng.between(10, 12)
    planks.push({ x: side * rng.between(1.2, 1.6), y: rng.between(0, 0.3), z0: z, z1: z + len, hx: rng.between(4.0, 5.0) / 2 })
    side = side > 0 ? -1 : 1
    z += len
  }
  const exitZ = z + rng.between(1.6, 2.2)

  // Each plank tips about its stripe (k °/m past the 0.35 m dead zone, up to the tier's most) and slides you off
  // its low side past 8°. A ridge under it is its pivot.
  const idx = planks.map((p) => {
    const len = p.z1 - p.z0
    const mid = (p.z0 + p.z1) / 2
    const i = k.box({ x: p.x, z: mid, hx: p.hx, hz: len / 2, top: p.y, hy: PLANK_HY, look: 'plank', touch: { kind: 'plank', k: gain, max: most }, slip: true })
    k.deco({ look: 'pivot', x: p.x, y: p.y - 2 * PLANK_HY - 0.9, z: mid, sx: 0.5, sy: 0.9, sz: len - 1 })
    return i
  })

  // The route. Nodes on a plank are never waited at (it tips under a bean that stands off its stripe): one at
  // each end of its stripe. The blue (main) jumps from the pad's edge, walks each stripe at 0.75 stick, steps a
  // little off it toward the next plank near the end and jumps diagonally, and jumps from the last onto the pad.
  // The expert (gold) takes the same planks at full stick, leaping from wherever its diagonal meets the end.
  k.node('in', 0, -1.5)
  k.node('out', 0, exitZ + 1.5)
  for (const tierName of ['main', 'gold'] as const) {
    const g = tierName === 'gold' ? 'g' : ''
    const stick = tierName === 'gold' ? undefined : BLUE_STICK
    planks.forEach((p, i) => {
      k.node(`${g}s${i}`, p.x, p.z0 + STRIPE_IN, { y: p.y, wait: 'no' })
      k.node(`${g}e${i}`, p.x, p.z1 - STRIPE_OUT, { y: p.y, wait: 'no' })
    })
    const first = planks[0]!
    const last = planks[n - 1]!
    if (tierName === 'main') k.edge('in', 's0', 'jump', { stick, takeoff: k.at(first.x * 0.3, 0, -TAKEOFF_BACK) })
    else k.edge('in', 'gs0', 'jump', { tier: 'gold', takeoff: 'edge', inset: 0.35 })
    planks.forEach((p, i) => {
      k.edge(`${g}s${i}`, `${g}e${i}`, 'run', { tier: tierName, stick })
      const next = planks[i + 1]
      if (!next) return
      if (tierName === 'main') {
        const toward = Math.sign(next.x - p.x) * TAKEOFF_SIDE
        k.edge(`e${i}`, `s${i + 1}`, 'jump', { stick, takeoff: k.at(p.x + toward, p.y, p.z1 - TAKEOFF_BACK, idx[i]) })
      } else k.edge(`ge${i}`, `gs${i + 1}`, 'jump', { tier: 'gold', takeoff: 'edge', inset: 0.4 })
    })
    if (tierName === 'main') k.edge(`e${n - 1}`, 'out', 'jump', { stick, takeoff: k.at(last.x * 0.8, last.y, last.z1 - TAKEOFF_BACK, idx[n - 1]) })
    else k.edge(`ge${n - 1}`, 'out', 'jump', { tier: 'gold', takeoff: 'edge', inset: 0.4 })
  }
  return k.done({ x: 0, y: 0, z: exitZ })
}

/* ------------------------------------------------------------------ generation 2 --- */

/** A gen-2 plank: as gen 1's, and a ferry's slide along z (amplitude A, period T, phase ph), if it's one. */
type Plank2 = Plank & { ferry?: { A: number; T: number; ph: number } }

/**
 * Generation 2 (README "Generations"): narrower planks that tip faster and further, each a step up or down from the
 * last (the hop between needs judging), and ferries: planks that slide back and forth along the course on the
 * clock (tipping like the rest), so the gaps either side of one open and close. A careful bean stands on the stripe
 * at the end of a plank (it doesn't tip there) until the ferry comes near, hops on, walks its stripe as it carries
 * it on, and hops off as it nears the next plank; a bean that just runs and jumps finds the ferry out of reach.
 */
function build2(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  const n = byTier(tier, [4, 5, 5])
  const ferryAt = byTier(tier, [[2], [2], [1, 3]] as const)
  const tilt = byTier(tier, [
    { k: 12, max: 16, rate: 40, back: 14, dead: 0.35 },
    { k: 15, max: 20, rate: 48, back: 16, dead: 0.32 },
    { k: 18, max: 24, rate: 55, back: 18, dead: 0.3 },
  ] as const)
  const [wLo, wHi] = byTier(tier, [
    [3.6, 4.2],
    [3.2, 3.8],
    [3.0, 3.6],
  ] as const)
  const [gLo, gHi] = byTier(tier, [
    [1.6, 2.2],
    [1.8, 2.5],
    [2.0, 2.8],
  ] as const)
  const [sLo, sHi] = byTier(tier, [
    [0.3, 0.6],
    [0.5, 0.9],
    [0.6, 1.0],
  ] as const)
  // The ferries: a mean gap either side, swinging A either way over T (from the round's period), at most 2.6 m/s.
  const fGap = byTier(tier, [3.0, 3.25, 3.25])
  const fT = 3.8 + (slot.period - 2.9)
  const fA = Math.min(byTier(tier, [1.5, 1.75, 1.65]), (2.6 * fT) / (2 * Math.PI))

  // The planks: 8–10 m long (ferries 8–9), alternately 0.9–1.4 m either side of the middle, each a step up or down
  // from the one before (within −1.2 … +1.6 of the base, the last within 0.9 of the pad after).
  const planks: Plank2[] = []
  const isFerry = (i: number) => (ferryAt as readonly number[]).includes(i)
  let side = rng.sign()
  let z = 0
  let y = 0
  for (let i = 0; i < n; i++) {
    const ferry = isFerry(i)
    z += ferry || isFerry(i - 1) ? fGap : rng.between(gLo, gHi)
    const len = ferry ? rng.between(8, 9) : rng.between(8, 10)
    const step = rng.between(sLo, sHi)
    const lo = i === n - 1 ? -0.9 : -1.2
    const hi = i === n - 1 ? 0.9 : 1.6
    const ways = [y + step, y - step].filter((v) => v >= lo && v <= hi)
    y = ways.length === 2 ? (rng.chance(0.5) ? ways[0]! : ways[1]!) : ways.length === 1 ? ways[0]! : Math.max(lo, Math.min(hi, y > 0 ? y - step : y + step))
    const p: Plank2 = { x: side * rng.between(0.9, 1.4), y, z0: z, z1: z + len, hx: rng.between(wLo, wHi) / 2 }
    if (ferry) p.ferry = { A: fA, T: fT, ph: rng.between(0, fT) }
    planks.push(p)
    side = side > 0 ? -1 : 1
    z += len
  }
  const exitZ = z + rng.between(gLo, gHi)

  const touch = { kind: 'plank' as const, ...tilt }
  const idx = planks.map((p) => {
    const len = p.z1 - p.z0
    const mid = (p.z0 + p.z1) / 2
    const i = k.box({ x: p.x, z: mid, hx: p.hx, hz: len / 2, top: p.y, hy: PLANK_HY, look: 'plank', touch, slip: true, move: p.ferry ? wave('z', p.ferry.A, p.ferry.T, p.ferry.ph) : undefined, ledge: !p.ferry })
    if (!p.ferry) k.deco({ look: 'pivot', x: p.x, y: p.y - 2 * PLANK_HY - 0.9, z: mid, sx: 0.5, sy: 0.9, sz: len - 1 })
    return i
  })

  // The route: on each plank a spot where its stripe starts (passed through) and one near its end (a careful bean
  // may stand there: on the stripe it doesn't tip), riding a ferry. The blue walks the stripes at 0.75 stick and hops
  // diagonally for the next plank from a little off its stripe; the same ways at full stick are gold (an expert's).
  k.node('in', 0, -1.5)
  k.node('out', 0, exitZ + 1.5)
  planks.forEach((p, i) => {
    const on = p.ferry ? idx[i] : undefined
    k.node(`s${i}`, p.x, p.z0 + STRIPE_IN, { y: p.y, wait: 'no', on })
    k.node(`e${i}`, p.x, p.z1 - STRIPE_OUT, { y: p.y, on })
  })
  const first = planks[0]!
  const last = planks[n - 1]!
  for (const tierName of ['main', 'gold'] as const) {
    const stick = tierName === 'gold' ? undefined : BLUE_STICK
    k.edge('in', 's0', 'jump', { tier: tierName, stick, takeoff: k.at(first.x * 0.3, 0, -TAKEOFF_BACK) })
    planks.forEach((p, i) => {
      k.edge(`s${i}`, `e${i}`, 'run', { tier: tierName, stick })
      const next = planks[i + 1]
      if (!next) return
      const toward = Math.sign(next.x - p.x) * TAKEOFF_SIDE
      k.edge(`e${i}`, `s${i + 1}`, 'jump', { tier: tierName, stick, takeoff: k.at(p.x + toward, p.y, p.z1 - TAKEOFF_BACK, idx[i]) })
    })
    k.edge(`e${n - 1}`, 'out', 'jump', { tier: tierName, stick, takeoff: k.at(last.x * 0.8, last.y, last.z1 - TAKEOFF_BACK, idx[n - 1]) })
  }
  return k.done({ x: 0, y: 0, z: exitZ })
}

export const ROUND: RoundDef = {
  letter: 'w',
  name: 'Tippy Planks',
  hint: 'stay on the stripe',
  family: 'F',
  phase: 1,
  build,
}
