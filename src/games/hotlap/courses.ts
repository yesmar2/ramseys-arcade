/*
 * Hot Lap's tracks. A track is a line of pieces, turns and straights, in the form sim.ts builds: a start
 * straight ('A'), then corners with straights between them, one of which ('B') is sized along with the
 * start straight so the loop closes on itself. Written out, a turn is `degrees/radius` (left positive), a
 * straight its metres: the classic track is "A 180/18 120 -90/60 B 90/45 140 -45/30 45/30 60 180/110".
 *
 * New tracks come from a seed. What a seed makes is decided with whole numbers only (degrees in steps of
 * 15, radii and straights in whole metres), so it's the same on every device. A track is only used once
 * the checks here pass it (scripts/hotlap-daily.mjs runs them and writes the day's tracks down in
 * dailyPlan.ts). The checks: it closes, a long enough start straight, it keeps clear of itself, and the
 * pace car and a driver on the limit both get round cleanly in a sensible time.
 */
import { hashString, mulberry32 } from '../../lib/seededRandom.ts'
import {
  botDriver,
  botLap,
  buildTrack,
  closure,
  HALF_WIDTH,
  newRun,
  speedPlan,
  stepRun,
  type Hill,
  type Piece,
  type Track,
  type TrackShape,
} from './sim.ts'

/* ---------- writing tracks down ---------- */

export function encodeCourse(pieces: Piece[]): string {
  return pieces.map((p) => ('turn' in p ? `${p.turn}/${p.r}` : String(p.straight))).join(' ')
}

export function decodeCourse(line: string): Piece[] {
  let corner = 0
  return line
    .trim()
    .split(/\s+/)
    .map((token): Piece => {
      if (token === 'A' || token === 'B') return { straight: token }
      const slash = token.indexOf('/')
      if (slash < 0) return { straight: Number(token) }
      corner += 1
      return { turn: Number(token.slice(0, slash)), r: Number(token.slice(slash + 1)), name: `Turn ${corner}` }
    })
}

/**
 * A hilly track's heights, written out as `permille:metres` pairs: how far round the lap from the start
 * line, in thousandths, and how high the road is there above the line. "0:0 250:-12.5 500:4 750:-3".
 * Or, for heights evenly spaced round the lap from the line, just the heights after a tilde: "~0 4 -2 1".
 */
export function decodeHills(line: string): Hill[] {
  const text = line.trim()
  if (text.startsWith('~')) {
    const heights = text.slice(1).trim().split(/\s+/).map(Number)
    return heights.map((up, j): Hill => [j / heights.length, up]).filter(([, up]) => Number.isFinite(up))
  }
  return text
    .split(/\s+/)
    .map((pair): Hill => {
      const [at, up] = pair.split(':')
      return [Number(at) / 1000, Number(up)]
    })
    .filter(([at, up]) => Number.isFinite(at) && Number.isFinite(up))
}

/* ---------- making one from a seed ---------- */

/**
 * A track from a seed, or null if the seed's tries all came out wrong (rare; the caller tries the next).
 *
 * Six to nine corners, up to three of them right-handers, turning one full circle between them. One
 * corner, more often than not, is a hairpin or a long sweeper, and the rest share the turning out fifteen
 * degrees at a time. Tighter turns get tighter radii. Straights of 30 to 220 m come between corners, or
 * none, so some corners run straight into the next. Of the straights crossing the start straight's line
 * steeply enough to be sized with it, the one that gives the start straight a good length becomes 'B'.
 * Only the plan script makes tracks, so this may do its sums in floating point; the plan keeps the result.
 */
export function generateCourse(seed: number): Piece[] | null {
  const rand = mulberry32(seed)
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
  const chance = (p: number) => rand() < p
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!

  for (let tries = 0; tries < 40; tries++) {
    const corners = int(6, 9)
    const rights = Math.min(3, int(0, 2) + (corners >= 8 ? 1 : 0))
    const lefts = corners - rights
    const rightTurns = Array.from({ length: rights }, () => -15 * int(2, 6))
    const total = 360 - rightTurns.reduce((a, b) => a + b, 0)
    if (total < 30 * lefts || total > 180 * lefts) continue
    const leftTurns = Array.from({ length: lefts }, () => 30)
    let left = total - 30 * lefts
    // More often than not, one big corner: a hairpin or a sweeper.
    if (chance(0.65)) {
      const big = Math.min(120 + 15 * int(0, 2), left)
      const i = int(0, lefts - 1)
      leftTurns[i] = (leftTurns[i] ?? 30) + big
      left -= big
    }
    while (left > 0) {
      const i = int(0, lefts - 1)
      const turn = leftTurns[i] ?? 30
      if (turn >= 180) continue
      leftTurns[i] = turn + 15
      left -= 15
    }
    // The right-handers go in among the left, never first.
    const turns = [...leftTurns]
    for (const r of rightTurns) turns.splice(int(1, turns.length), 0, r)

    const pieces: Piece[] = [{ straight: 'A' }]
    let heading = 0
    const straights: { at: number; heading: number }[] = []
    turns.forEach((turn, k) => {
      const a = Math.abs(turn)
      const r =
        a >= 150
          ? chance(0.3)
            ? 20 * int(3, 6)
            : pick([16, 18, 20, 22, 25, 28])
          : a >= 105
            ? 5 * int(4, 14)
            : a >= 60
              ? 5 * int(5, 20)
              : 5 * int(6, 28)
      pieces.push({ turn, r, name: `Turn ${k + 1}` })
      heading += turn
      // After the last corner the road is back on the start straight's line: it just is the start straight.
      if (k === turns.length - 1) return
      if (chance(0.22)) return
      straights.push({ at: pieces.length, heading })
      pieces.push({ straight: 10 * int(3, 22) })
    })
    // 'B' has to cross the start straight's line at 45° or more, or the two can't be sized together well,
    // and both have to come out long enough. Of those that do, the one nearest a 400 m start straight.
    let best: { at: number; score: number } | null = null
    for (const s of straights) {
      const d = ((s.heading % 180) + 180) % 180
      if (d < 45 || d > 135) continue
      const trial = pieces.slice()
      trial[s.at] = { straight: 'B' }
      const { A, B } = closure(trial)
      if (!(A >= 260 && A <= 700 && B >= 30)) continue
      const score = Math.abs(A - 400)
      if (!best || score < best.score) best = { at: s.at, score }
    }
    if (!best) continue
    pieces[best.at] = { straight: 'B' }
    return pieces
  }
  return null
}

/* ---------- hills for a made track ---------- */

export type HillKind = 'rolling' | 'hilly' | 'big'

/** How steep each kind gets at its steepest: rise per metre. */
const STEEPEST: Record<HillKind, number> = { rolling: 0.05, hilly: 0.09, big: 0.13 }

/** A made track's kind of hills from the first draw for its line (hillyCourse), or null for one that stays flat. */
const kindOfDraw = (draw: number): HillKind | null => (draw < 0.15 ? null : draw < 0.45 ? 'rolling' : draw < 0.8 ? 'hilly' : 'big')

/** The kind of hills a made track's line asks for (hillyCourse), without making them: for saying what a track is. */
export function hillKindOf(course: string): HillKind | null {
  return kindOfDraw(mulberry32(hashString(`hills:${course}`))())
}
const KNOTS = 32

/**
 * Hills for a made track, decided by its line alone, so the same line always gets the same hills. About
 * one track in seven stays flat; the rest roll gently (5% at the steepest), are hilly (9%) or big (13%).
 *
 * The land is five waves round the lap, the shorter ones nearly as tall as the long, a new set on each
 * try, set down in 32 heights. Each is then made as big as its kind asks, or as its road allows if that's
 * less: no crest so sharp for the speed the car carries over it that the car goes more than a third light,
 * no dip pressing it down more than a whole g, no more than 20 m from the lowest point to the highest (the
 * Glen, a real hill, has 22), and stretches of road that pass near each other at no more than a gentle
 * bank's difference in height (0.4 m at 30 m apart, a quarter of the gap past that). The try that can be
 * made biggest wins, if it's at least a third of what its kind asks. Then it's driven: the pace car and a
 * driver on the limit must get round cleanly in a sensible time, easing the hills off a step at a time
 * until they do. Null: this track stays flat.
 */
export function hillyCourse(course: string): { hills: string; kind: HillKind; check: CourseCheck & { ok: true } } | null {
  const rand = mulberry32(hashString(`hills:${course}`))
  const kind = kindOfDraw(rand())
  if (!kind) return null
  const pieces = decodeCourse(course)
  const flat = buildTrack(pieces)
  const { n, s, length } = flat
  // What the car carries round, near enough: the pace car's plan, no faster than its top speed.
  const speeds = speedPlan(flat)
  const v2 = Array.from(speeds, (v) => Math.min(v, 52) ** 2)
  // Stretches of road near each other but well apart along the lap.
  const pairs: [number, number, number][] = []
  for (let i = 0; i < n; i += 4) {
    for (let j = i + 4; j < n; j += 4) {
      const along = Math.min(s[j]! - s[i]!, length - (s[j]! - s[i]!))
      if (along < 120) continue
      const d = Math.hypot(flat.x[i]! - flat.x[j]!, flat.y[i]! - flat.y[j]!)
      if (d < 100) pairs.push([i, j, Math.max(0.4, (d - 30) * 0.25)])
    }
  }

  let best: { knots: Hill[]; scale: number; share: number } | null = null
  for (let attempt = 0; attempt < 12; attempt++) {
    const waves = [1, 2, 3, 4, 5].map((k) => ({ k, a: (0.35 + rand()) / k ** 0.8, p: rand() * Math.PI * 2 }))
    const at = (f: number) => waves.reduce((z, w) => z + w.a * Math.sin(Math.PI * 2 * w.k * f + w.p), 0)
    const z0 = at(0)
    const knots: Hill[] = Array.from({ length: KNOTS }, (_, j) => [j / KNOTS, at(j / KNOTS) - z0])
    const unit = buildTrack(pieces, { hills: knots })
    const z = unit.z!
    const grade = unit.grade!
    const crest = unit.crest!
    let steep = 0
    let lightest = 0
    let heaviest = 0
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < n; i++) {
      steep = Math.max(steep, Math.abs(grade[i]!))
      lightest = Math.max(lightest, v2[i]! * -crest[i]!)
      heaviest = Math.max(heaviest, v2[i]! * crest[i]!)
      lo = Math.min(lo, z[i]!)
      hi = Math.max(hi, z[i]!)
    }
    let near = Infinity
    for (const [i, j, allowed] of pairs) {
      const apart = Math.abs(z[i]! - z[j]!)
      if (apart > 1e-6) near = Math.min(near, allowed / apart)
    }
    const byKind = STEEPEST[kind] / steep
    const scale = Math.min(byKind, (0.35 * 9.81) / Math.max(lightest, 1e-9), 9.81 / Math.max(heaviest, 1e-9), 20 / (hi - lo), near)
    const share = scale / byKind
    if (!best || share > best.share) best = { knots, scale, share }
    if (share >= 0.8) break
  }
  if (!best || best.share < 1 / 3) return null
  const { knots, scale } = best
  for (const ease of [1, 0.75, 0.5]) {
    const hills = `~${knots.map(([, h]) => Math.round(h * scale * ease * 10) / 10).join(' ')}`
    const check = checkCourse(pieces, { hills: decodeHills(hills) })
    if (check.ok) return { hills, kind, check }
  }
  return null
}

const PLACES = [
  'Pine',
  'Harbor',
  'Canyon',
  'Meadow',
  'Quarry',
  'Summit',
  'Lakeside',
  'Copper',
  'Willow',
  'Falcon',
  'Sunset',
  'Granite',
  'Coral',
  'Orchard',
  'Glacier',
  'Ember',
  'Juniper',
  'Cedar',
  'Riverside',
  'Maple',
  'Thunder',
  'Silver',
  'Aspen',
  'Mesa',
  'Harvest',
  'Beacon',
  'Driftwood',
  'Kestrel',
  'Bramble',
  'Moonlight',
] as const
const KINDS = ['Ring', 'Circuit', 'Loop', 'Park', 'Raceway', 'Speedway', 'Bends', 'Run'] as const

/** A track's name, from its seed: Pine Circuit, Harbor Bends. */
export function courseName(seed: number): string {
  const rand = mulberry32(hashString(`name:${seed}`))
  return `${PLACES[Math.floor(rand() * PLACES.length)]} ${KINDS[Math.floor(rand() * KINDS.length)]}`
}

/* ---------- checking one ---------- */

/**
 * How near, in metres, the track comes to itself: the nearest two points more than `apart` metres apart
 * along it, looking only at points from `from` to `to` (all of them by default) against the rest.
 */
export function clearance(track: Track, apart = 150, from = 0, to = track.n, every = 4) {
  const { n, x, y } = track
  let least = Infinity
  for (let i = from; i < to; i += every) {
    const k = ((i % n) + n) % n
    for (let j = 0; j < n; j += every) {
      const gap = Math.abs(j - k)
      if (Math.min(gap, n - gap) <= apart) continue
      const d = (x[k]! - x[j]!) ** 2 + (y[k]! - y[j]!) ** 2
      if (d < least) least = d
    }
  }
  return Math.sqrt(least)
}

/**
 * How near, in metres, the rest of the track comes to the outside of the start straight's first 250 m
 * past the line, where the grandstand stands: its right, or its left on a clockwise track.
 */
export function grandstandClearance(track: Track) {
  const { n, x, y, h, startIndex } = track
  const along = Math.cos(h[startIndex]!)
  const across = Math.sin(h[startIndex]!)
  const outside = track.clockwise ? 1 : -1
  let least = Infinity
  for (let i = startIndex - 40; i < startIndex + 250; i += 4) {
    const k = ((i % n) + n) % n
    for (let j = 0; j < n; j += 4) {
      const gap = Math.abs(j - k)
      if (Math.min(gap, n - gap) <= 260) continue
      const dx = x[j]! - x[k]!
      const dy = y[j]! - y[k]!
      // On the outside: the straight's left normal is (−sin, cos).
      if ((dx * -across + dy * along) * outside <= 0) continue
      least = Math.min(least, Math.hypot(dx, dy))
    }
  }
  return least
}

/** How much ground the track covers: its box, and the middle of it. */
export function bounds(track: Track) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < track.n; i++) {
    minX = Math.min(minX, track.x[i]!)
    maxX = Math.max(maxX, track.x[i]!)
    minY = Math.min(minY, track.y[i]!)
    maxY = Math.max(maxY, track.y[i]!)
  }
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY }
}

/** A lap by a driver cornering at `margin` of the grip: whether they got round cleanly, and in what time. */
function driveLap(track: Track, margin: number) {
  const drive = botDriver(track, margin)
  const run = newRun(track)
  let bumps = 0
  while (!run.finished && run.time < 150) {
    const before = run.bumped
    stepRun(run, drive(run), track)
    if (run.bumped > 0 && before === 0) bumps += 1
  }
  return { time: run.lapTime, cut: run.cut, bumps }
}

export type CourseCheck = { ok: true; track: Track; pace: number; limit: number } | { ok: false; why: string }

/**
 * Whether a track is fit to race: see the top of the file. A landmark (a real circuit's layout, see
 * landmarks.ts) may run longer than a made one: up to 2,600 m and a 100-second pace lap.
 */
export function checkCourse(pieces: Piece[], shape: TrackShape = {}, landmark = false): CourseCheck {
  let track: Track
  try {
    track = buildTrack(pieces, shape)
  } catch {
    return { ok: false, why: 'it does not close' }
  }
  const longest = landmark ? 2600 : 2200
  const slowest = landmark ? 100 : 68
  if (track.straights.A < 240) return { ok: false, why: `start straight ${track.straights.A.toFixed(0)} m` }
  if (track.straights.B < 30) return { ok: false, why: `B ${track.straights.B.toFixed(0)} m` }
  if (track.length < 900 || track.length > longest) return { ok: false, why: `length ${track.length.toFixed(0)} m` }
  const box = bounds(track)
  if (box.width > 1100 || box.height > 1100) return { ok: false, why: 'too spread out' }
  // Roads apart, with grass between them: a hairpin's two legs come this close by design (the classic's are 36 m).
  const clear = clearance(track)
  if (clear < 2 * HALF_WIDTH + 14) return { ok: false, why: `comes within ${clear.toFixed(0)} m of itself` }
  // Room for the grandstand, right of the start straight: nothing else within 70 m of it there.
  const stand = grandstandClearance(track)
  if (stand < 70) return { ok: false, why: `passes within ${stand.toFixed(0)} m of the grandstand` }
  const pace = botLap(track)
  if (pace.time == null || pace.run.cut) return { ok: false, why: 'the pace car did not get round' }
  if (pace.bumps > 0 || pace.grass > 0.3) return { ok: false, why: 'the pace car went off' }
  if (pace.time < 40 || pace.time > slowest) return { ok: false, why: `pace lap ${pace.time.toFixed(1)}s` }
  const limit = driveLap(track, 0.97)
  if (limit.time == null || limit.cut || limit.bumps > 0) return { ok: false, why: 'a driver on the limit did not get round' }
  return { ok: true, track, pace: pace.time, limit: limit.time }
}
