/**
 * Roll On (design-final R9, F, phase 2): giant striped drums lying end to end along the track, each turning the
 * other way from the last, with short rest plates between them. Ring fences wrap round each drum, their gaps rolling
 * over the top: orange hurdles to hop on easier days, and on T3 tall jelly fences on alternate rings, crossed only
 * through a gap.
 *
 * Faked cheaply, as the spec says: a drum is no cylinder to the engine but three strips along its top, a flat crown
 * band and two facets tipped 18° (slippery: `slip`), all carrying the bean sideways at the drum's surface speed
 * (`belt`); off them is the goo. A fence's teeth are small box solids whose motion wraps them round the drum and
 * turns them `on` only while they're over the top. In the drum's turning frame the fences stand still, so the job
 * is being on the crown band where a gap is when you reach its ring.
 *
 * The reference round for belts and slip on tipped strips, solids that come and go (`o.on`), and a window worked
 * out from where a pattern of teeth will be when the bean gets there.
 */
import type { MoveFn, RoundDef, RoundOut, RoundSlot, Rng, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** A drum's radius and circumference; its round is 48 tooth slots. */
const DRUM_R = 4
const CIRC = 2 * Math.PI * DRUM_R
const SLOTS = 48
const SLOT = CIRC / SLOTS
/**
 * Each ring's teeth ride on 12 solids, each taking every 12th slot: slots 6.3 m apart round the drum, so never two
 * of one solid's over the top (5.6 m of it) at once.
 */
const CARRIERS = 12
/** The crown band's half width, where the facets end, their tip, and how far out a tooth is still over the top. */
const CROWN_HX = 1.2
const FACET_OUT = 2.6
const FACET_ROLL = (18 * Math.PI) / 180
const SHOWN = 2.8
/** A tooth: 0.5 m across, 0.3 m deep; a hurdle's 0.9 m tall, a tall one 2.4 m. */
const TOOTH_HX = 0.25
const TOOTH_HZ = 0.15
const HURDLE_H = 0.9
const TALL_H = 2.4
/** Rest plates: 2 m long, 6 m wide. */
const PLATE_LEN = 2
const PLATE_HX = 3
/**
 * Two ways over a drum. The careful way (the blue's) hops each hurdle from 2.3 m before it and comes down just past
 * it, centring again before the next; the expert's (gold) hops from 2.0 m before and lands 3.1 m past, never
 * breaking stride. Feet stay over the 0.9 m teeth both ways (a running jump is above 0.9 m for 0.55 s).
 */
const HOP = { main: { from: 2.3, to: 1.4, speed: 6.5 }, gold: { from: 2.0, to: 3.1, speed: 6.95 } } as const
/** A tall ring's spot after it; how near counts as passing a spot on a drum. */
const PAST_TALL = 1.2
const PASS_R = 1.5
/** A hop's flight; setting off from a standstill costs about this much time over running at speed. */
const FLIGHT = 0.75
const SET_OFF_LOSS = 0.06
/** A tall ring's gap must clear the bean and this much each side, for this long either side of its middle crossing. */
const R_BEAN = 0.42
const CLEAR = 0.1
const CROSS_FOR = 0.1

/** The top's height at x across a drum (the crown band, then the facets falling away). */
function surfaceAt(x: number): number {
  const a = Math.abs(x)
  return a <= CROWN_HX ? 0 : -(a - CROWN_HX) * Math.tan(FACET_ROLL)
}

/** Arc position a, rolled on by `roll` m, as an x on the top (−CIRC/2 to CIRC/2: 0 is the top's middle). */
function overTop(a: number, roll: number): number {
  return ((((a + roll + CIRC / 2) % CIRC) + CIRC) % CIRC) - CIRC / 2
}

/** One of a ring's tooth solids: its teeth's arc positions, the drum turning its top toward +x at `vx` m/s. */
function toothMove(arcs: readonly number[], vx: number): MoveFn {
  return (t, o) => {
    o.on = false
    for (const a of arcs) {
      const x = overTop(a, vx * t)
      if (Math.abs(x) < SHOWN) {
        o.x = x
        o.y = surfaceAt(x)
        o.on = true
        return
      }
    }
  }
}

type Gap = { mid: number; half: number }
type Ring = { z: number; tall: boolean; gaps: Gap[] }
type Drum = { z0: number; z1: number; vx: number; rings: Ring[] }

/** A ring's teeth: `n` gaps of `w` slots spread round it from phase ph (a slot's width either way), teeth elsewhere. */
function layRing(rng: Rng, n: number, w: readonly [number, number], ph: number): { teeth: number[]; gaps: Gap[] } {
  const gapAt = new Set<number>()
  const gaps: Gap[] = []
  for (let g = 0; g < n; g++) {
    const width = rng.int(w[0], w[1])
    const start = Math.round((g * SLOTS) / n) + rng.int(-1, 1)
    for (let s = 0; s < width; s++) gapAt.add((((start + s) % SLOTS) + SLOTS) % SLOTS)
    gaps.push({ mid: ph + (start + (width - 1) / 2) * SLOT, half: ((width + 1) * SLOT) / 2 - TOOTH_HX })
  }
  const teeth: number[] = []
  for (let s = 0; s < SLOTS; s++) if (!gapAt.has(s)) teeth.push(s)
  return { teeth, gaps }
}

/**
 * When a bean setting off from a standstill at z `from` crosses z `to` along a drum's rings, hopping the hurdles on
 * the way the `way` way: running at its speed, each hop a flight from its take-off to its landing.
 */
function crossAt(rings: readonly Ring[], from: number, to: number, way: (typeof HOP)['main' | 'gold']): number {
  let t = SET_OFF_LOSS
  let z = from
  for (const r of rings) {
    if (r.z >= to) break
    if (r.tall) continue
    t += Math.max(0, r.z - way.from - z) / way.speed + FLIGHT
    z = Math.max(z, r.z + way.to)
  }
  return t + Math.max(0, to - z) / way.speed
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  const nDrums = byTier(tier, [2, 3, 4])
  const v = byTier(tier, [1.6, 1.9, 2.2])
  const nRings = byTier(tier, [2, 3, 3])
  const dir0 = rng.sign()

  // The stretch: an entry plate (but on T3, whose four drums are long enough without it: there the pad before is the
  // first rest), drums with a rest plate after each, the last plate onto the pad after.
  const entry = tier < 3
  const drums: Drum[] = []
  let z = entry ? PLATE_LEN : 0
  const plates: number[] = entry ? [PLATE_LEN / 2] : []
  for (let d = 0; d < nDrums; d++) {
    const len = tier === 3 ? rng.between(12.8, 13.4) : rng.between(13, 14)
    const vx = v * dir0 * (d % 2 === 0 ? 1 : -1)
    // Rings: two at the thirds, or three 1.8 m in from the ends and evenly between (4.6–5.2 m apart, so a hop over
    // one comes down in good time to hop the next). On T3 the middle one is a tall fence.
    const zs = nRings === 2 ? [len / 3, (2 * len) / 3] : [1.8, len / 2, len - 1.8]
    const rings: Ring[] = zs.map((rz, r) => ({ z: z + rz, tall: tier === 3 && r % 2 === 1, gaps: [] }))
    drums.push({ z0: z, z1: z + len, vx, rings })
    z += len
    plates.push(z + PLATE_LEN / 2)
    z += PLATE_LEN
  }
  const exitZ = z

  // Plates, with an arrow painted the way the next drum will pull.
  plates.forEach((pz, i) => {
    k.box({ x: 0, z: pz, hx: PLATE_HX, hz: PLATE_LEN / 2, top: 0, hy: 0.6, look: 'pad' })
    const next = drums[entry ? i : i + 1]
    if (next) k.deco({ look: 'arrow', x: 0, y: 0.01, z: pz, yaw: Math.sign(next.vx) * (Math.PI / 2), sx: 1.4, sy: 0.02, sz: 1.6, params: { dir: Math.sign(next.vx) * (Math.PI / 2) } })
  })

  // The drums: the body for the scene (a cylinder of radius params.r along z, its axis params.axis above the
  // deco's y so its top is level with the crown band, turning its top toward +x at params.v m/s; sx × sy × sz is a
  // stand-in block under the strips for a scene that doesn't draw it yet), then the crown band and the facets, all
  // carrying sideways.
  for (const D of drums) {
    const len = D.z1 - D.z0
    const zc = (D.z0 + D.z1) / 2
    k.deco({ look: 'drum-body', x: 0, y: -2 * DRUM_R, z: zc, sx: 2 * FACET_OUT, sy: 2 * DRUM_R - 0.5, sz: len, params: { r: DRUM_R, axis: DRUM_R, v: D.vx } })
    const belt = { x: D.vx, z: 0 }
    k.box({ x: 0, z: zc, hx: CROWN_HX, hz: len / 2, top: 0, hy: 0.6, look: 'drum', belt })
    const fhx = (FACET_OUT - CROWN_HX) / 2
    for (const side of [-1, 1]) {
      k.box({ x: side * (CROWN_HX + fhx), z: zc, hx: fhx, hz: len / 2, top: -fhx * Math.tan(FACET_ROLL), roll: -side * FACET_ROLL, hy: 0.6, look: 'drum', belt, slip: true })
    }
    // The fences: teeth on 12 solids a ring, the gaps rolling over the top. Hurdle rings have 2–3 gaps of 5–6
    // slots; tall rings 3 gaps of 6 slots (3.1 m), so one is over the top every 3.8 s or so.
    for (const ring of D.rings) {
      const ph = rng.between(0, CIRC)
      const laid = ring.tall ? layRing(rng, 3, [6, 6], ph) : layRing(rng, rng.int(2, 3), [5, 6], ph)
      ring.gaps = laid.gaps
      const h = ring.tall ? TALL_H : HURDLE_H
      for (let c = 0; c < CARRIERS; c++) {
        const arcs = laid.teeth.filter((s) => s % CARRIERS === c).map((s) => ph + s * SLOT)
        if (!arcs.length) continue
        k.box({ x: 0, z: ring.z, hx: TOOTH_HX, hz: TOOTH_HZ, top: h, hy: (h + 0.6) / 2, look: ring.tall ? 'tooth-tall' : 'tooth', noGround: true, ledge: false, move: toothMove(arcs, D.vx) })
      }
    }
  }

  // The route: a wait spot on each plate; over a drum, a spot after each ring (passed, not waited at), hopping the
  // hurdles and running the tall rings' gaps, the careful way (main) or the expert's (gold). Either sets off from a
  // plate only when every tall ring of the drum ahead will have a gap clear of it as it gets there.
  k.node('in', 0, -1.5)
  // The wait spot before each drum, and the one after the last.
  const rests = [...(entry ? [] : [{ id: 'in', z: -1.5 }]), ...plates.map((pz, i) => ({ id: k.node(`p${i}`, 0, pz), z: pz }))]
  k.node('out', 0, exitZ + 1.5)
  if (entry) k.edge('in', 'p0')
  drums.forEach((D, d) => {
    const tall = D.rings.filter((r) => r.tall)
    for (const tier of ['main', 'gold'] as const) {
      const way = HOP[tier]
      const at = tall.map((r) => crossAt(D.rings, rests[d]!.z, r.z, way))
      const window = tall.length
        ? (t: number) =>
            tall.every((r, i) =>
              r.gaps.some((g) => {
                const room = g.half - R_BEAN - CLEAR
                return Math.abs(overTop(g.mid, D.vx * (t + at[i]! - CROSS_FOR))) <= room && Math.abs(overTop(g.mid, D.vx * (t + at[i]! + CROSS_FOR))) <= room
              }),
            )
        : undefined
      let from = rests[d]!.id
      D.rings.forEach((r, i) => {
        const id = k.node(`${tier === 'main' ? 'm' : 'g'}${d}_${i}`, 0, r.z + (r.tall ? PAST_TALL : way.to), { wait: 'no', r: PASS_R })
        const o = { tier, ...(i === 0 && window ? { window } : {}) }
        if (r.tall) k.edge(from, id, 'run', o)
        else k.edge(from, id, 'jump', { ...o, takeoff: k.at(0, 0, r.z - way.from) })
        from = id
      })
      k.edge(from, rests[d + 1]!.id, 'run', { tier })
    }
  })
  k.edge(rests[rests.length - 1]!.id, 'out')
  return k.done({ x: 0, y: 0, z: exitZ })
}

export const ROUND: RoundDef = {
  letter: 'r',
  name: 'Roll On',
  hint: 'ride the drums',
  family: 'F',
  phase: 2,
  build,
}
