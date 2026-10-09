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

export const ROUND: RoundDef = {
  letter: 'w',
  name: 'Tippy Planks',
  hint: 'stay on the stripe',
  family: 'F',
  phase: 1,
  build,
}
