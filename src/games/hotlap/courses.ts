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
import { botDriver, botLap, buildTrack, closure, HALF_WIDTH, newRun, stepRun, type Hill, type Piece, type Track, type TrackShape } from './sim.ts'

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
 */
export function decodeHills(line: string): Hill[] {
  return line
    .trim()
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
