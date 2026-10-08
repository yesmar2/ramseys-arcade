/**
 * Gate Crash (design-final R1, T): a 9 m candy boulevard crossed by rows of jelly doors in white frames. Each
 * door slides up into its header to open and slams down to close; a lamp over it shows green (open), blinking
 * amber (closing soon) or red (shut). One column of doors has gold frames: the green wave, timed so a runner who
 * goes through its first door as it opens passes every row without breaking stride. Nothing here is lethal: a
 * slamming door bonks you back the way you came.
 *
 * The reference round for the others: it shows the kit, closed-form motion with a telegraph (sim.ts doorMove,
 * doorTele), lamps tied to their doors, a gold line, and a route graph with wait spots and windows.
 */
import { doorLift, doorMove, doorTele, type DoorSpec } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/**
 * The frames' posts and a 0.6 m header, its underside HEADER_LO over the row's floor: over a jumping bean's head (its
 * top peaks at 3.43 m), so a hop through an open door never meets the header. After a terrace it's higher by the step
 * down (a hop off the terrace comes in that much higher).
 */
const POST = 0.25
const HEADER_LO = 3.5
const HEADER_T = 0.6
/** A door: jelly up to DOOR_GAP under the header, 0.4 m thick, lifted up to the header's underside when open. */
const DOOR_GAP = 0.2
const DOOR_HZ = 0.2
/** A door's wait spot is this far in front of it (its bonk reaches 0.62 m; a stopping bean overshoots ~0.4 m). */
const WAIT_BACK = 2.0
const EXIT_ON = 1.2
/** The terrace step under odd rows (T2+). */
const TERRACE = 0.45

type Pattern = 'waveR' | 'waveL' | 'ping' | 'oddEven'
const PATTERNS: readonly Pattern[] = ['waveR', 'waveL', 'ping', 'oddEven']

/** Door j's phase in a row of D on pattern p (u = frac((t + φ)/T) opens at u = 0). */
function patternPhase(p: Pattern, j: number, D: number, T: number): number {
  if (p === 'waveR') return (j * T) / D
  if (p === 'waveL') return ((D - 1 - j) * T) / D
  if (p === 'ping') return (Math.abs(2 * j - (D - 1)) * T) / (2 * D)
  return (j % 2) * (T / 2)
}

/** The fewest doors of a row open or warning at any moment (sampled over a period). */
function leastOpen(doors: readonly DoorSpec[], T: number): number {
  let least = Infinity
  for (let s = 0; s < 240; s++) {
    const t = (s / 240) * T
    let open = 0
    for (const d of doors) if (doorLift(d, t) > 2.0) open++
    least = Math.min(least, open)
  }
  return least
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  const N = byTier(tier, [5, 6, 7])
  const D = byTier(tier, [3, 3, 4])
  const share = byTier(tier, [0.62, 0.55, 0.48])
  const zig = tier === 3
  const terraces = tier >= 2
  const need = tier === 1 ? 2 : 1
  const S = rng.between(7.0, 8.5)
  const T = slot.period
  // Open for long enough to be fair on a phone (open + warn ≥ 1.4 s), shut long enough to matter.
  const open = Math.min(Math.max(share * T - 0.5, 0.9), T - 1.65)
  const w = (9 - (D + 1) * POST) / D
  const doorX = (j: number) => -4.5 + POST + w / 2 + j * (w + POST)
  const rowZ = (r: number) => 5 + r * S
  const len = rowZ(N - 1) + 5
  const rowY = (r: number) => (terraces && r % 2 === 1 && r < N - 1 ? TERRACE : 0)
  /** Row r's header underside (and open door's lift) over its floor. */
  const headerLo = (r: number) => HEADER_LO + (r > 0 ? Math.max(0, rowY(r - 1) - rowY(r)) : 0)

  // The floor, in stretches: odd rows (but the last) stand on a terrace step on T2 and up.
  const cuts = [0]
  for (let r = 0; r < N - 1; r++) cuts.push(rowZ(r) + S / 2)
  cuts.push(len)
  for (let c = 0; c < cuts.length - 1; c++) {
    const y = rowY(c)
    k.floor(cuts[c]!, cuts[c + 1]!, { top: y, look: y > 0 ? 'terrace' : 'floor', hy: 0.6 + y / 2 })
    k.walls(cuts[c]!, cuts[c + 1]!, { y })
  }

  // The green wave: a gold column (zig-zagging a door a row on T3) whose doors open as a full-speed runner arrives.
  const gold: number[] = []
  let g = rng.int(0, D - 1)
  for (let r = 0; r < N; r++) {
    gold.push(g)
    if (zig) g = g === 0 ? 1 : g === D - 1 ? D - 2 : g + rng.sign()
  }
  const phGold = rng.between(0, T)
  const goldPh: number[] = []
  let path = 0
  for (let r = 0; r < N; r++) {
    if (r > 0) path += Math.hypot(S, doorX(gold[r]!) - doorX(gold[r - 1]!))
    goldPh.push(phGold - path / 7.2)
  }

  // The rows: a pattern each (never the same twice running), every row keeping a door open at every moment.
  let last: Pattern | null = null
  const specs: DoorSpec[][] = []
  for (let r = 0; r < N; r++) {
    let doors: DoorSpec[] = []
    const order = rng.shuffle(PATTERNS.filter((p) => p !== last))
    let chosen: Pattern = order[0]!
    let phRow = rng.between(0, T)
    found: for (let tries = 0; tries < 12; tries++) {
      for (const p of order) {
        doors = []
        for (let j = 0; j < D; j++) {
          const ph = j === gold[r] ? goldPh[r]! : phRow + patternPhase(p, j, D, T)
          doors.push({ T, ph, open, lift: headerLo(r) })
        }
        if (leastOpen(doors, T) >= need) {
          chosen = p
          break found
        }
      }
      phRow = rng.between(0, T)
    }
    last = chosen
    specs.push(doors)
  }

  // Frames, doors, lamps.
  for (let r = 0; r < N; r++) {
    const z = rowZ(r)
    const y = rowY(r)
    const lo = headerLo(r)
    const hi = lo + HEADER_T
    const doorH = lo - DOOR_GAP
    for (let p = 0; p <= D; p++) {
      const x = -4.5 + POST / 2 + p * (w + POST)
      const goldPost = gold[r] === p || gold[r] === p - 1
      k.box({ x, z, hx: POST / 2, hz: 0.25, top: y + hi, hy: hi / 2, look: 'frame', gold: goldPost, noGround: true })
    }
    k.box({ x: 0, z, hx: 4.5, hz: 0.25, top: y + hi, hy: HEADER_T / 2, look: 'header', noGround: true })
    for (let j = 0; j < D; j++) {
      const spec = specs[r]![j]!
      const door = k.box({
        x: doorX(j),
        z,
        hx: w / 2,
        hz: DOOR_HZ,
        top: y + doorH,
        hy: doorH / 2,
        look: 'door',
        role: 'jelly',
        gold: gold[r] === j,
        door: true,
        duck: true,
        noGround: true,
        ledge: false,
        move: doorMove(spec),
        tele: doorTele(spec),
      })
      k.deco({ look: 'lamp', x: doorX(j), y: y + lo + HEADER_T / 2, z: z - 0.3, sx: 0.5, sy: 0.3, sz: 0.1, ref: { kind: 'solid', i: door } })
    }
  }
  k.deco({ look: 'gold-flag', x: doorX(gold[0]!), y: 0, z: rowZ(0) - 1.6, sy: 1.8 })
  k.gold('Green wave', rowZ(0) - WAIT_BACK, rowZ(N - 1) + EXIT_ON, doorX(gold[0]!))

  // The route: a wait spot in front of each door (safe: its bonk doesn't reach), an exit spot behind it; through a
  // door only while it can be open as you get there; across a row between its wait spots.
  k.node('in', 0, -1.5)
  for (let r = 0; r < N; r++) {
    const z = rowZ(r)
    const y = rowY(r)
    for (let j = 0; j < D; j++) {
      k.node(`w${r}_${j}`, doorX(j), z - DOOR_HZ - WAIT_BACK, { y })
      k.node(`e${r}_${j}`, doorX(j), z + DOOR_HZ + EXIT_ON, { y })
    }
  }
  k.node('out', 0, len + 1.5)
  for (let r = 0; r < N; r++) {
    for (let j = 0; j < D; j++) {
      const spec = specs[r]![j]!
      k.edge(`w${r}_${j}`, `e${r}_${j}`, 'run', { window: (t) => doorLift(spec, t + 0.3) > 1.4 })
      if (j > 0) {
        k.edge(`w${r}_${j}`, `w${r}_${j - 1}`)
        k.edge(`w${r}_${j - 1}`, `w${r}_${j}`)
      }
      if (r === 0) k.edge('in', `w0_${j}`)
      else for (let j2 = 0; j2 < D; j2++) k.edge(`e${r - 1}_${j2}`, `w${r}_${j}`)
    }
  }
  for (let j = 0; j < D; j++) k.edge(`e${N - 1}_${j}`, 'out')
  return k.done({ x: 0, y: 0, z: len })
}

export const ROUND: RoundDef = {
  letter: 'g',
  name: 'Gate Crash',
  hint: 'beat the doors',
  family: 'T',
  phase: 1,
  build,
}
