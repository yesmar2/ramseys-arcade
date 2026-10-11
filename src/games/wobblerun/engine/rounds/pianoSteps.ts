/**
 * Piano Steps (p, gen 2): a giant keyboard climbing uphill over the soda sea. The white keys are the steps, each a hop
 * higher than the last; the black keys stand higher and narrower in notches over the seams at the back. The keyboard
 * plays a tune of its own (seeded, on the run clock, the same for everyone): on its beats a white key blinks amber, then
 * sinks deep into the sea and comes back up, and a key going down takes whoever is on it down too unless they hop off
 * in time. So the way up is hopping the keys that are up.
 *
 * The keys come in phrases the way a piano's come in groups: C D E (a black key over each of its two seams) and
 * F G A B (three), with a rest, a flat landing where nothing sinks, at each place the black keys skip (E–F, B–C). The
 * second rest is the top; from it the round runs down the scale, white keys stepping down, onto the pad after, still
 * well above where it started. Every key carries its note (`params.note`, semitones up from the round's lowest C) for
 * the game to play as Blip lands on it (the `land` event's solid) and as the tune presses it (its telegraph's `act`).
 * A white key in a phrase is two boxes (`params.key` the same): its front, the whole tread, and its back, notched where
 * the black keys stand.
 *
 * The tune: a loop of whole half periods of the round's (so it keeps the round's rhythm), the fewest that make 4 s
 * (4.1–5.6 s; at T1 the fewest that make 7 s), in beats of about 0.75 s, the time a hop takes. Each phrase has a little
 * figure in it, a note or a run of notes stepping along its keys on consecutive beats, so its keys go down one after
 * another and come back up; the figures move up the keyboard through the loop. A white key's press: blinking 0.6–0.8 s
 * (warn), sinking (act, eased in), sunk (hold), rising (back). The sharps answer each figure on the half beats: a black
 * key blinks, dips into its notch and springs back up. It never takes you into the sea, but a JUMP while it springs
 * adds its speed (the engine's jump off a rising mover) and flies you over the rest of the phrase.
 *
 * The route: the main way hops the white keys along the front (a key the tune presses is never waited on; one it
 * never presses is a safe spot), resting on the rests. The gold way, the Sharps line: from the back of a phrase's first
 * white key up onto its black keys, along them, and from any of them onto the rest after, a spring's launch away. A
 * white key sinks past the splat height under it (DEATH_UNDER m below the lowest top near it), so riding one all the
 * way down is a fall.
 */
import type { MoveFn, RoundDef, RoundOut, RoundSlot, Rng, Solid, Tele, TeleFn, Tier } from '../types.ts'
import { byTier, kit, type Kit } from './kit.ts'

/** White keys: 7 m across, a thin dark gap between them, bodies 1.8 m deep. */
const KEY_HX = 3.5
const GAP = 0.1
const KEY_HY = 0.9
/**
 * Black keys: centred over a seam, BLACK_D deep along the course, from the back edge to BLACK_IN past the middle,
 * standing BLACK_UP over the higher of the white keys either side. A press dips one DIP into its notch.
 */
const BLACK_D = 1.3
const BLACK_IN = 0.6
const BLACK_UP = 0.35
const DIP = 1.5
/** The main way runs this far toward the front of the middle (the black keys are at the back). */
const LANE_X = 1.4
/** The Sharps line's spot on a phrase's first white key: this far toward the back, this far along it. */
const BACK_X = 2.0
const BACK_IN = 0.35
/** A rest's depth along the course. */
const REST_D = 3.0
/** The splat height: this far under the lowest top near a key (a hop between keys never comes near it). A white key sinks this much past it, so riding one down is a fall. */
const DEATH_UNDER = 2.4
const SINK_PAST = 1.0
/** Hops take off this far before the edge (so they rise clear of the next key's face); onto a black key, this far before its face. */
const HOP_INSET = 0.9
const UP_INSET = 1.25
/** The tune's beat, about: a hop's time. Its loop is at least this long, by tier (whole half periods of the round's). */
const BEAT = 0.75
const LOOP_LEAST = [7, 4, 4] as const
/** The white notes of the scale, in semitones from C; a black key is the white note below it + 1 (C# D# F# G# A#). */
const WHITE = [0, 2, 4, 5, 7, 9, 11] as const
/** The two phrases, by the scale degrees of their white keys: C D E and F G A B (a black key over every seam of each). */
const PHRASES = [
  [0, 1, 2],
  [3, 4, 5, 6],
] as const

/** A press's shape: blinking `warn` s, going down over `sink` s, down `hold` s, coming back over `back` s. */
type Press = { warn: number; sink: number; hold: number; back: number }
/** A black key's: a quick dip, a beat down, a spring back up (smoothstep: about 9 m/s at its fastest). */
const SPRING: Press = { warn: 0.6, sink: 0.3, hold: 0.3, back: 0.25 }

/**
 * A key's part in the tune: the moments its presses start (when it starts down), in a loop of `L` s, and the press's
 * shape. A white key sinks eased in (slow, then away); a black key (`spring`) dips eased out and springs back.
 */
type Song = { times: number[]; L: number; p: Press; spring: boolean }

const REST: Tele = { state: 'rest', u: 0 }

/** Seconds since the last press started at clock time t, its loop folded. */
function since(song: Song, t: number): number {
  const s = t - Math.floor(t / song.L) * song.L
  let best = Infinity
  for (const q of song.times) {
    let u = s - q
    if (u < 0) u += song.L
    if (u < best) best = u
  }
  return best
}

/** How far down the key is at t: 0 up, 1 all the way down. Arithmetic only, so it's the same in every browser. */
function downAt(song: Song, t: number): number {
  const u = since(song, t)
  const { sink, hold, back } = song.p
  if (u < sink) {
    const k = u / sink
    return song.spring ? k * (2 - k) : k * k
  }
  if (u < sink + hold) return 1
  if (u < sink + hold + back) {
    const k = (u - sink - hold) / back
    return 1 - k * k * (3 - 2 * k)
  }
  return 0
}

function keyMove(song: Song, depth: number): MoveFn {
  return (t, o) => void (o.y = -depth * downAt(song, t))
}

/** The key's telegraph: `warn` while it blinks before going down, `act` going down, `hold` down, `back` coming up. */
function keyTele(song: Song): TeleFn {
  const { warn, sink, hold, back } = song.p
  return (t) => {
    const u = since(song, t)
    if (u < sink) return { state: 'act', u: u / sink }
    if (u < sink + hold) return { state: 'hold', u: (u - sink) / hold }
    if (u < sink + hold + back) return { state: 'back', u: (u - sink - hold) / back }
    const s = t - Math.floor(t / song.L) * song.L
    for (const q of song.times) {
      let until = q - s
      if (until <= 0) until += song.L
      if (until <= warn) return { state: 'warn', u: 1 - until / warn }
    }
    return REST
  }
}

/** When a jump off a black key can get its spring: from a little before its spring to the end of it (the bots' window). */
function springWindow(song: Song): (t: number) => boolean {
  const { sink, hold, back } = song.p
  return (t) => {
    const u = since(song, t)
    return u >= sink + hold - 0.1 && u < sink + hold + back
  }
}

/** Until the solids' type carries `params` (gen2/requests.md): a key's note, on the solid as the looks contract has it. */
type WithParams = Solid & { params?: Record<string, number | string | boolean> }
function setParams(k: Kit, i: number, params: Record<string, number | string | boolean>): void {
  ;(k.out.solids[i] as WithParams).params = params
}

/** A key as laid: where it runs along the course, its top at rest, its note, its solids (front first), its part in the tune. */
type Key = { z0: number; z1: number; top: number; note: number; solids: number[]; song: Song | null }

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('climb')
  const side = rng.sign()
  const laneX = -side * LANE_X
  const backX = side * BACK_X
  const blackX = (side * (BLACK_IN + KEY_HX)) / 2
  const blackHx = (KEY_HX - BLACK_IN) / 2

  // The tune's clock: its loop, the fewest half periods that make LOOP_LEAST s or more, in whole beats of about a
  // hop's time.
  const L = (slot.period * Math.ceil((2 * byTier(tier, LOOP_LEAST)) / slot.period)) / 2
  const beats = Math.max(4, Math.round(L / BEAT))
  const beat = L / beats
  const p: Press = byTier(tier, [
    { warn: 0.8, sink: 0.55, hold: 0.15, back: 0.5 },
    { warn: 0.7, sink: 0.45, hold: 0.4, back: 0.5 },
    { warn: 0.6, sink: 0.4, hold: 0.45, back: 0.45 },
  ])

  // The climb: two phrases of white keys (C D E and F G A B, either first), a rest after each, then down the scale.
  const first = rng.int(0, 1)
  const [riseLo, riseHi] = byTier(tier, [
    [0.5, 0.6],
    [0.55, 0.7],
    [0.55, 0.7],
  ] as const)
  const downN = byTier(tier, [2, 3, 4])
  const rise = () => rng.between(riseLo, riseHi)
  const tread = () => rng.between(2.3, 2.7)

  const phrases: Key[][] = []
  const blacks: Key[][] = []
  const rests: { z0: number; z1: number; top: number }[] = []
  const down: Key[] = []
  let z = GAP
  let y = 0
  let octave = 0
  for (let j = 0; j < 2; j++) {
    const degrees = PHRASES[(first + j) % 2]!
    const keys: Key[] = []
    for (const d of degrees) {
      y += rise()
      const len = tread()
      keys.push({ z0: z, z1: z + len, top: y, note: WHITE[d]! + 12 * octave, solids: [], song: null })
      z += len + GAP
    }
    phrases.push(keys)
    // A black key over each seam of the phrase, standing over the higher of its two white keys.
    const bk: Key[] = []
    for (let s = 0; s + 1 < keys.length; s++) {
      const a = keys[s]!
      const b = keys[s + 1]!
      const mid = (a.z1 + b.z0) / 2
      bk.push({ z0: mid - BLACK_D / 2, z1: mid + BLACK_D / 2, top: Math.max(a.top, b.top) + BLACK_UP, note: a.note + 1, solids: [], song: null })
    }
    blacks.push(bk)
    if (degrees[degrees.length - 1] === 6) octave++
    y += rise()
    rests.push({ z0: z, z1: z + REST_D, top: y })
    z += REST_D + GAP
  }
  // Down the scale from the top: white keys stepping down, a note lower each, onto the pad after.
  const top = phrases[1]![phrases[1]!.length - 1]!
  let deg = WHITE.indexOf((top.note % 12) as (typeof WHITE)[number])
  let oct = Math.floor(top.note / 12)
  for (let n = 0; n < downN; n++) {
    deg--
    if (deg < 0) {
      deg = 6
      oct--
    }
    y -= rng.between(0.5, 0.6)
    const len = tread()
    down.push({ z0: z, z1: z + len, top: y, note: WHITE[deg]! + 12 * oct, solids: [], song: null })
    z += len + GAP
  }
  const exitY = y - rng.between(0.5, 0.6)
  const exitZ = z

  // The tune: a figure for each phrase (and the run down), stepping along its keys on consecutive beats, the figures
  // moving up the keyboard through the loop; each phrase's sharps spring in a run on the half beats after its figure.
  const [figShort, figLong, figDown] = byTier(tier, [
    [1, 1, 0],
    [1, 2, 1],
    [2, 3, 2],
  ] as const)
  const press = (key: Key, b: number, spring: boolean) => {
    const at = (((b % beats) + beats) % beats) * beat
    if (!key.song) key.song = { times: [], L, p: spring ? SPRING : p, spring }
    key.song.times.push(at)
  }
  let b0 = rng.int(0, beats - 1)
  const groups = [...phrases, down]
  groups.forEach((keys, j) => {
    const m = Math.min(keys.length, j === phrases.length ? figDown : keys.length > 3 ? figLong : figShort)
    if (j < phrases.length) blacks[j]!.forEach((key, n) => press(key, b0 + n + 0.5, true))
    if (m <= 0) return
    const dir = rng.sign()
    const a = dir > 0 ? rng.int(0, keys.length - m) : rng.int(m - 1, keys.length - 1)
    for (let q = 0; q < m; q++) press(keys[a + dir * q]!, b0 + q, false)
    b0 += m + rng.int(1, 2)
  })

  // The splat heights: under each white key and rest, DEATH_UNDER below the lowest top of it and its neighbours.
  const slabs: { z0: number; z1: number; top: number }[] = []
  phrases.forEach((keys, j) => {
    for (const key of keys) slabs.push(key)
    slabs.push(rests[j]!)
  })
  slabs.push(...down)
  const deathOf = slabs.map((s, n) => Math.min(s.top, slabs[n - 1]?.top ?? 0, slabs[n + 1]?.top ?? exitY) - DEATH_UNDER)
  slabs.forEach((s, n) => k.death(n === 0 ? 0 : s.z0 - GAP / 2, n === slabs.length - 1 ? exitZ : s.z1 + GAP / 2, deathOf[n]!))
  const deathAt = (zz: number) => {
    let best = Infinity
    slabs.forEach((s, n) => {
      if (zz >= s.z0 - GAP && zz <= s.z1 + GAP) best = Math.min(best, deathOf[n]!)
    })
    return best
  }

  // The keys and the rests. A white key with black keys beside it is a front box (the whole tread, up to the black
  // keys' inner edge) and a back box notched short where a black key stands at either end.
  let keyId = 0
  const layWhite = (key: Key, notchBefore: boolean, notchAfter: boolean, whole: boolean) => {
    const depth = key.top - deathAt((key.z0 + key.z1) / 2) + SINK_PAST
    const move = key.song ? keyMove(key.song, depth) : undefined
    const tele = key.song ? keyTele(key.song) : undefined
    const params = { note: key.note, key: keyId++ }
    const lay = (x0: number, x1: number, z0: number, z1: number) => {
      const i = k.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, top: key.top, hy: KEY_HY, look: 'key-white', role: 'floor', tint: -1, move, tele })
      setParams(k, i, params)
      key.solids.push(i)
    }
    if (whole) return lay(-KEY_HX, KEY_HX, key.z0, key.z1)
    const inner = side * BLACK_IN
    lay(Math.min(-side * KEY_HX, inner), Math.max(-side * KEY_HX, inner), key.z0, key.z1)
    const notch = BLACK_D / 2 - GAP / 2
    lay(Math.min(inner, side * KEY_HX), Math.max(inner, side * KEY_HX), key.z0 + (notchBefore ? notch : 0), key.z1 - (notchAfter ? notch : 0))
  }
  const layBlack = (key: Key) => {
    const move = key.song ? keyMove(key.song, DIP) : undefined
    const tele = key.song ? keyTele(key.song) : undefined
    const i = k.box({ x: blackX, z: (key.z0 + key.z1) / 2, hx: blackHx, hz: BLACK_D / 2, top: key.top, hy: KEY_HY, look: 'key-black', role: 'floor', tint: -1, move, tele })
    setParams(k, i, { note: key.note, key: keyId++ })
    key.solids.push(i)
  }
  phrases.forEach((keys, j) => {
    keys.forEach((key, n) => layWhite(key, n > 0, n < keys.length - 1, false))
    blacks[j]!.forEach(layBlack)
    const r = rests[j]!
    k.box({ x: 0, z: (r.z0 + r.z1) / 2, hx: KEY_HX, hz: REST_D / 2, top: r.top, hy: KEY_HY, look: 'terrace' })
  })
  for (const key of down) layWhite(key, false, false, true)

  // The route. The main way: hop the white keys along the front, resting on the rests, then run down the scale.
  k.node('in', 0, -1.5)
  // A key the tune never presses never moves: a bot may stop on it. A white key it presses, never.
  const keyNode = (id: string, key: Key, x: number, z = (key.z0 + key.z1) / 2, on = key.solids[0]!) => k.node(id, x, z, { y: key.top, wait: key.song && !key.song.spring ? 'no' : 'safe', on })
  const hop = (from: string, to: string, tier: 'main' | 'gold' = 'main') => k.edge(from, to, 'jump', { tier, takeoff: 'edge', inset: HOP_INSET })
  let from = 'in'
  phrases.forEach((keys, j) => {
    const r = rests[j]!
    const restId = k.node(`r${j}`, laneX, (r.z0 + r.z1) / 2, { y: r.top })
    let prev = from
    keys.forEach((key, n) => {
      const id = keyNode(`w${j}_${n}`, key, laneX)
      hop(prev, id)
      prev = id
    })
    hop(prev, restId)
    // The Sharps line: onto the back of the phrase's first white key, up onto its first black key (from just short of
    // its face), along them, and from any of them onto the rest after (a spring's launch from all but the last).
    const k0 = keys[0]!
    const g = keyNode(`g${j}`, k0, backX, k0.z0 + BACK_IN, k0.solids[1]!)
    hop(from, g, 'gold')
    const bs = blacks[j]!.map((key, n) => keyNode(`b${j}_${n}`, key, blackX, undefined, key.solids[0]!))
    k.edge(g, bs[0]!, 'jump', { tier: 'gold', takeoff: k.at(backX, k0.top, blacks[j]![0]!.z0 - UP_INSET, k0.solids[1]!) })
    bs.forEach((id, n) => {
      if (n + 1 < bs.length) hop(id, bs[n + 1]!, 'gold')
      // The last black key is a hop from the rest; any other is too far for a hop (over 6 m, up), so its launch can
      // only work as the key springs: from just before its spring to the end of it.
      const song = blacks[j]![n]!.song
      const window = n + 1 < bs.length && song ? springWindow(song) : undefined
      k.edge(id, restId, 'jump', { tier: 'gold', window })
    })
    k.deco({ look: 'gold-flag', x: backX, y: k0.top, z: k0.z0 + 0.15, sy: 1.8 })
    from = restId
  })
  k.gold('Sharps line', phrases[0]![0]!.z0, rests[1]!.z0, blackX)
  down.forEach((key, n) => {
    const id = keyNode(`d${n}`, key, laneX)
    k.edge(from, id)
    from = id
  })
  k.node('out', 0, exitZ + 1.5, { y: exitY })
  k.edge(from, 'out')
  const fr = rests[0]!
  k.flag(laneX, (fr.z0 + fr.z1) / 2, 'r0', fr.top)
  return k.done({ x: 0, y: exitY, z: exitZ })
}

export const ROUND: RoundDef = {
  letter: 'p',
  name: 'Piano Steps',
  hint: 'hop the keys that are up',
  family: 'T',
  phase: 2,
  build,
}
