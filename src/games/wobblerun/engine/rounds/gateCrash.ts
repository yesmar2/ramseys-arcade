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
  if ((slot.gen ?? 1) >= 2) return build2(slot, rng, tier)
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

/* ------------------------------------------------------------------ gen 2 --- */

/**
 * Gen 2 (README "Generations"): the rows climb and come down again. Between rows the floor steps up (STEP2: in your
 * stride), ramps up or down, and from T2 a row stands at the far lip of a gap (a leap row): its doors flush with the
 * terrace's front edge, so you jump the gap through an open door. A shut one bonks you back into the soda: there's no
 * ledge under it to catch. T3 adds a drop row (the same, onto a lower terrace). The terraces have no rails from T2,
 * and the round runs down a ramp to its exit at the height it started. Gen 1 above is untouched.
 *
 * How a row is reached from the one before: level, a step up, a ramp up or down, a leap up or a drop down a gap.
 */
type Rise = 'flat' | 'step' | 'ramp' | 'down' | 'leap' | 'drop'

/** A step in your stride (the bean steps up 0.5). Ramps rise or fall RAMP_LO–RAMP_HI. */
const STEP2 = 0.45
const RAMP_LO = 0.6
const RAMP_HI = 0.9
/** Ramps run from RAMP_AFTER past a row's doors to RAMP_BEFORE short of the next row's wait spots. */
const RAMP_AFTER = 2.0
const RAMP_BEFORE = 0.6
/** Steps up come this far past a row's doors (just past its exit spots). */
const STEP_AFTER = 2.4
/**
 * A leap or drop row: its doors' front faces LEAP_SET in from the terrace's front edge, the first LIP of the
 * terrace with no ledge, the wait spots LEAP_BACK short of the gap's near edge, jumps taking off LEAP_INSET from it.
 */
const LEAP_SET = 0.15
const LIP = 1.2
const LEAP_BACK = 1.8
const LEAP_INSET = 0.4
/** A running jump's head over its take-off at the top (feet 1.925 m up, the bean 1.46 m tall). */
const LEAP_TOP = 3.39
/** A drop row's header is this much higher again (the blue's margin over a jump's head, coming down through it). */
const DROP_HEAD = 0.6
/** The exit ramp's slope (14°) and the run-out after it. */
const EXIT_SLOPE = 0.25
const EXIT_RUN = 1.5
/** A full-speed runner's speed, and the bean's slope rule (sim.ts: RUN × (1 − 0.6·s), s within −0.25 … 0.4). */
const FULL = 7.2
const slopeSpeed = (rise: number, run: number) => {
  const s = Math.max(-0.25, Math.min(0.4, rise / Math.hypot(rise, run)))
  return FULL * (1 - 0.6 * s)
}

/**
 * The rises into rows 1 … N−1 (index 0 unused): T1 three ways up and a ramp down; T2 a leap (row 2 or 3), a ramp down
 * after it, the rest up or level; T3 a leap (row 2 or 3), a drop at least two rows on, the rest up or level.
 */
function risesFor(rng: Rng, tier: Tier, N: number): Rise[] {
  const out: Rise[] = new Array<Rise>(N).fill('flat')
  if (tier === 1) {
    const ups = rng.shuffle<Rise>(['step', 'ramp', 'step'])
    const downAt = rng.int(3, 4)
    let u = 0
    for (let r = 1; r < N; r++) out[r] = r === downAt ? 'down' : ups[u++]!
    return out
  }
  if (tier === 2) {
    const leapAt = rng.int(2, 3)
    const downAt = rng.int(leapAt + 1, N - 1)
    const ups = rng.shuffle<Rise>(['step', 'ramp', 'flat'])
    let u = 0
    for (let r = 1; r < N; r++) out[r] = r === leapAt ? 'leap' : r === downAt ? 'down' : ups[u++]!
    return out
  }
  const leapAt = rng.int(2, 3)
  const dropAt = rng.int(leapAt + 2, N - 1)
  const ups = rng.shuffle<Rise>(['step', 'ramp', 'step', 'flat'])
  let u = 0
  for (let r = 1; r < N; r++) out[r] = r === leapAt ? 'leap' : r === dropAt ? 'drop' : ups[u++]!
  return out
}

function build2(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  const N = byTier(tier, [5, 6, 7])
  const D = byTier(tier, [3, 3, 4])
  // The doors' open share; a leap row's own (T3 has two of them, each a little kinder).
  const share = byTier(tier, [0.45, 0.52, 0.46])
  const leapShare = byTier(tier, [0.5, 0.5, 0.59])
  const zig = tier === 3
  const railed = tier === 1
  const T = slot.period
  const openOf = (sh: number) => Math.min(Math.max(sh * T - 0.5, 0.9), T - 1.65)
  const w = (9 - (D + 1) * POST) / D
  const doorX = (j: number) => -4.5 + POST + w / 2 + j * (w + POST)

  // The profile: each row's height and how it's reached, its spacing from the row before, a leap's gap.
  const rises = risesFor(rng, tier, N)
  const y: number[] = [0]
  const S: number[] = [0]
  const gap: number[] = [0]
  for (let r = 1; r < N; r++) {
    const kind = rises[r]!
    const prev = y[r - 1]!
    let dy = 0
    if (kind === 'step') dy = STEP2
    else if (kind === 'ramp') dy = rng.between(RAMP_LO, RAMP_HI)
    else if (kind === 'down') dy = -Math.min(prev, rng.between(RAMP_LO, RAMP_HI))
    else if (kind === 'leap') dy = tier === 2 ? rng.between(0.5, 0.8) : rng.between(0.6, 0.9)
    else if (kind === 'drop') dy = -Math.min(prev, rng.between(0.6, 0.9))
    y.push(prev + dy)
    S.push(rng.between(7.4, 8.6))
    gap.push(kind === 'leap' || kind === 'drop' ? (tier === 2 ? rng.between(2.0, 2.5) : rng.between(2.2, 2.7)) : 0)
  }
  const rowZ: number[] = [5]
  for (let r = 1; r < N; r++) rowZ.push(rowZ[r - 1]! + S[r]!)
  const leapy = (r: number) => r > 0 && (rises[r] === 'leap' || rises[r] === 'drop')
  /** A leap row's gap: from its near edge to the terrace it leaps onto. */
  const edgeOf = (r: number) => rowZ[r]! - DOOR_HZ - LEAP_SET - gap[r]!
  /** Row r's header underside over its floor (a drop row's is higher by the drop and DROP_HEAD). */
  const headerLo = (r: number) => (rises[r] === 'drop' ? HEADER_LO + (y[r - 1]! - y[r]!) + DROP_HEAD : HEADER_LO)
  const yTop = y[N - 1]!
  const exitA = rowZ[N - 1]! + RAMP_AFTER
  const exitLen = yTop > 0.01 ? Math.max(3, yTop / EXIT_SLOPE) : 0
  const len = yTop > 0.01 ? exitA + exitLen + EXIT_RUN : rowZ[N - 1]! + 5

  // The floors: each row's stretch at its height, and between rows a step, a ramp or a gap. Rails only on T1 (and
  // nowhere over a gap).
  const lay = (z0: number, z1: number, top: number, o: { ledge?: boolean } = {}) => {
    if (z1 - z0 < 0.01) return
    k.floor(z0, z1, { top, look: top > 0.01 ? 'terrace' : 'floor', hy: 0.6 + Math.max(0, top) / 2, ...(o.ledge === false ? { ledge: false } : {}) })
    if (railed) k.walls(z0, z1, { y: top })
  }
  const slope = (z0: number, z1: number, y0: number, rise: number) => {
    k.ramp(z0, z1, y0, rise, { look: 'terrace', hy: 0.6 + Math.max(0, Math.min(y0, y0 + rise)) / 2 })
    if (railed) k.walls(z0, z1, { y: y0, rise })
  }
  let from = 0
  for (let r = 1; r <= N; r++) {
    const yPrev = y[r - 1]!
    if (r === N) {
      // The way down to the exit.
      if (yTop > 0.01) {
        lay(from, exitA, yPrev)
        slope(exitA, exitA + exitLen, yTop, -yTop)
        lay(exitA + exitLen, len, 0)
      } else lay(from, len, yPrev)
      break
    }
    const kind = rises[r]!
    if (kind === 'flat' || kind === 'step') {
      const cut = kind === 'step' ? rowZ[r - 1]! + STEP_AFTER : rowZ[r - 1]! + S[r]! / 2
      lay(from, cut, yPrev)
      from = cut
    } else if (kind === 'ramp' || kind === 'down') {
      const za = rowZ[r - 1]! + RAMP_AFTER
      const zb = rowZ[r]! - DOOR_HZ - WAIT_BACK - RAMP_BEFORE
      lay(from, za, yPrev)
      slope(za, zb, yPrev, y[r]! - yPrev)
      from = zb
    } else {
      const e = edgeOf(r)
      lay(from, e, yPrev)
      // The lip under the doors has no ledge: a bean a shut door bonks back off it drops into the soda.
      lay(e + gap[r]!, e + gap[r]! + LIP, y[r]!, { ledge: false })
      from = e + gap[r]! + LIP
    }
  }

  // The green wave: a gold column (zig-zagging a door a row on T3) whose doors open as a full-speed runner arrives,
  // timed by the runner's own pace along it (slower up a ramp, quicker down one; a leap keeps its speed).
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
    if (r > 0) {
      const dx = doorX(gold[r]!) - doorX(gold[r - 1]!)
      const dist = Math.hypot(S[r]!, dx)
      let tt = dist / FULL
      if (rises[r] === 'ramp' || rises[r] === 'down') {
        const run = rowZ[r]! - DOOR_HZ - WAIT_BACK - RAMP_BEFORE - (rowZ[r - 1]! + RAMP_AFTER)
        const along = (run * dist) / S[r]!
        tt += along / slopeSpeed(y[r]! - y[r - 1]!, along) - along / FULL
      }
      path += tt
    }
    goldPh.push(phGold - path)
  }

  // The rows: a pattern each (never the same twice running), every row keeping a door open at every moment.
  let last: Pattern | null = null
  const specs: DoorSpec[][] = []
  for (let r = 0; r < N; r++) {
    let doors: DoorSpec[] = []
    const order = rng.shuffle(PATTERNS.filter((p) => p !== last))
    let chosen: Pattern = order[0]!
    let phRow = rng.between(0, T)
    const open = openOf(leapy(r) ? leapShare : share)
    found: for (let tries = 0; tries < 12; tries++) {
      for (const p of order) {
        doors = []
        for (let j = 0; j < D; j++) {
          const ph = j === gold[r] ? goldPh[r]! : phRow + patternPhase(p, j, D, T)
          doors.push({ T, ph, open, lift: headerLo(r) })
        }
        if (leastOpen(doors, T) >= 1) {
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
    const z = rowZ[r]!
    const yr = y[r]!
    const lo = headerLo(r)
    const hi = lo + HEADER_T
    const doorH = lo - DOOR_GAP
    for (let p = 0; p <= D; p++) {
      const x = -4.5 + POST / 2 + p * (w + POST)
      const goldPost = gold[r] === p || gold[r] === p - 1
      k.box({ x, z, hx: POST / 2, hz: 0.25, top: yr + hi, hy: hi / 2, look: 'frame', gold: goldPost, noGround: true })
    }
    k.box({ x: 0, z, hx: 4.5, hz: 0.25, top: yr + hi, hy: HEADER_T / 2, look: 'header', noGround: true })
    for (let j = 0; j < D; j++) {
      const spec = specs[r]![j]!
      const door = k.box({
        x: doorX(j),
        z,
        hx: w / 2,
        hz: DOOR_HZ,
        top: yr + doorH,
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
      k.deco({ look: 'lamp', x: doorX(j), y: yr + lo + HEADER_T / 2, z: z - 0.3, sx: 0.5, sy: 0.3, sz: 0.1, ref: { kind: 'solid', i: door } })
    }
  }
  const wait0 = rowZ[0]! - DOOR_HZ - WAIT_BACK
  k.deco({ look: 'gold-flag', x: doorX(gold[0]!), y: 0, z: rowZ[0]! - 1.6, sy: 1.8 })
  k.gold('Green wave', wait0, rowZ[N - 1]! + EXIT_ON, doorX(gold[0]!))

  // The route: a wait spot in front of each door (a leap row's on the near side of its gap), an exit spot behind it;
  // through a door only while it can be open as you get there (a leap row's by a jump from the gap's edge); across a
  // row between its wait spots.
  k.node('in', 0, -1.5)
  for (let r = 0; r < N; r++) {
    const z = rowZ[r]!
    const wz = leapy(r) ? edgeOf(r) - LEAP_BACK : z - DOOR_HZ - WAIT_BACK
    const wy = leapy(r) ? y[r - 1]! : y[r]!
    for (let j = 0; j < D; j++) {
      k.node(`w${r}_${j}`, doorX(j), wz, { y: wy })
      k.node(`e${r}_${j}`, doorX(j), z + DOOR_HZ + EXIT_ON, { y: y[r]! })
    }
  }
  k.node('out', 0, len + 1.5)
  // T3: a flag on the first leap row's terrace, so a fall at the drop row doesn't send you back to the start.
  if (tier === 3) {
    const r = rises.indexOf('leap')
    const j = Math.floor(D / 2)
    k.flag(doorX(j), rowZ[r]! + DOOR_HZ + EXIT_ON, `e${r}_${j}`, y[r]!)
  }
  for (let r = 0; r < N; r++) {
    // A leap's bean, at its head, is about LEAP_TOP over its take-off: through the door while it can be up past that
    // somewhere in the jump's reach of the clock (lenient: never refusing a way that can work).
    const reach = leapy(r) ? LEAP_TOP - (y[r]! - y[r - 1]!) - 0.4 : 0
    for (let j = 0; j < D; j++) {
      const spec = specs[r]![j]!
      if (leapy(r)) {
        k.edge(`w${r}_${j}`, `e${r}_${j}`, 'jump', {
          takeoff: 'edge',
          inset: LEAP_INSET,
          window: (t) => {
            for (let u = 0.35; u <= 1.35; u += 0.05) if (doorLift(spec, t + u) >= reach) return true
            return false
          },
        })
      } else k.edge(`w${r}_${j}`, `e${r}_${j}`, 'run', { window: (t) => doorLift(spec, t + 0.3) > 1.4 })
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
  name: 'Slam Doors',
  hint: 'time the doors',
  family: 'T',
  phase: 1,
  build,
}
