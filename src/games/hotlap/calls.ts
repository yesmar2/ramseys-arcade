/*
 * The pace note: the corner coming, called as a co-driver would call it, on the card under the clock
 * (HotLapGame).
 *
 * Pieces of the track turning the same way with next to no straight between them are one corner, as a
 * driver sees it. Each corner is graded by how fast the pace car could take it for its own bend and hill
 * (sim.ts cornerSpeeds, clear of its ends, where the next piece's bend reaches in): under 45 mph it's
 * sharp, or a hairpin if it turns most of the way round; under 70, medium; faster, fast; and a kink the car
 * could take faster than it can go, flat out, is easy. Then one more thing to know: a corner straight
 * after it ("into sharp right"), one that closes up or opens out partway ("tightens", "opens"), a long one
 * ("long"), or else just its name. And its shape, from the track itself: straight in, the corner,
 * straight out, turned so the way in points up.
 */
import { CAR, cornerSpeeds, type Track } from './sim.ts'

export type Grade = 'hairpin' | 'sharp' | 'medium' | 'fast' | 'easy'

export type PaceCall = {
  /** Where the car turns in and where it's out again: points of the track. */
  from: number
  to: number
  grade: Grade
  /** "Sharp left". */
  word: string
  /** "into medium right", "tightens", "opens", "long", or the corner's name. */
  more: string
  /** Its shape in a 100 × 100 box, the way in pointing up: the line, and the arrowhead at its end. */
  line: string
  arrow: string
}

export type PaceNotes = {
  calls: PaceCall[]
  /** For each point of the track, the call whose turn-in comes next. */
  next: Int16Array
}

/** m of straight at most between two pieces of one corner. */
const JOIN = 8
/** m: a corner this soon after another is called with it. */
const INTO = 30
/** m of corner that make it a long one. */
const LONG = 150
/** Degrees round that make a sharp corner a hairpin. */
const HAIRPIN = 150
/** m/s: 45 and 70 mph. */
const SHARP_UNDER = 20.12
const MEDIUM_UNDER = 31.29
/** The shape's margin in its 100 × 100 box. */
const PAD = 14

const WORDS: Record<Grade, string> = { hairpin: 'Hairpin', sharp: 'Sharp', medium: 'Medium', fast: 'Fast', easy: 'Easy' }

/** m/s: as fast as the car goes, flat out on the level, where its power only just beats the air. */
const TOP_SPEED = (() => {
  let lo = 1
  let hi = 150
  for (let j = 0; j < 40; j++) {
    const v = (lo + hi) / 2
    if (CAR.power / v > CAR.drag * v * v + CAR.rolling) lo = v
    else hi = v
  }
  return lo
})()

type Piece = Track['corners'][number]

const made = new WeakMap<Track, PaceNotes>()

/** The track's calls, worked out once. */
export function paceNotes(track: Track): PaceNotes {
  let notes = made.get(track)
  if (!notes) {
    notes = callTrack(track)
    made.set(track, notes)
  }
  return notes
}

/** How far on from point `a` point `b` is, round the lap. */
function metresOn(track: Track, a: number, b: number) {
  const d = track.s[b % track.n]! - track.s[a % track.n]!
  return d < 0 ? d + track.length : d
}

function callTrack(track: Track): PaceNotes {
  const own = cornerSpeeds(track)
  const { n } = track
  // Pieces turning the same way, close enough, are one corner.
  const groups: Piece[][] = []
  for (const piece of track.corners) {
    const last = groups[groups.length - 1]
    const prev = last?.[last.length - 1]
    if (last && prev && Math.sign(prev.turn) === Math.sign(piece.turn) && metresOn(track, prev.to, piece.from) <= JOIN) last.push(piece)
    else groups.push([piece])
  }

  // A piece's own bend, clear of its ends: cornerSpeeds looks 6 m either way, into the piece beside it.
  const speedOf = (p: Piece) => {
    const len = p.to - p.from
    const a = len > 14 ? p.from + 6 : p.from + (len >> 1)
    const b = len > 14 ? p.to - 7 : a
    let v = Infinity
    for (let i = a; i <= b; i++) v = Math.min(v, own[i % n]!)
    return v
  }
  const grades = groups.map((pieces): Grade => {
    const v = Math.min(...pieces.map(speedOf))
    const round = Math.abs(pieces.reduce((sum, p) => sum + p.turn, 0))
    if (v < SHARP_UNDER) return round >= HAIRPIN ? 'hairpin' : 'sharp'
    return v < MEDIUM_UNDER ? 'medium' : v < TOP_SPEED ? 'fast' : 'easy'
  })
  const wordOf = (k: number) => `${WORDS[grades[k]!]} ${groups[k]![0]!.turn > 0 ? 'left' : 'right'}`

  const calls = groups.map((pieces, k): PaceCall => {
    const first = pieces[0]!
    const last = pieces[pieces.length - 1]!
    const from = first.from
    const to = last.to
    const after = (k + 1) % groups.length
    let more = first.name
    if (metresOn(track, to, groups[after]![0]!.from) <= INTO) more = `into ${wordOf(after).toLowerCase()}`
    else if (pieces.slice(1).some((p) => p.r < first.r * 0.75)) more = 'tightens'
    else if (pieces.length > 1 && last.r > first.r * 1.33) more = 'opens'
    else if (metresOn(track, from, to) >= LONG) more = 'long'
    return { from, to: to % n, grade: grades[k]!, word: wordOf(k), more, ...shapeOf(track, from, to) }
  })

  const next = new Int16Array(n)
  let k = 0
  for (let i = n - 1; i >= 0; i--) {
    // The last call whose turn-in is past this point, counting back: the one after it is next.
    while (k < calls.length && calls[calls.length - 1 - k]!.from > i) k++
    next[i] = k === 0 ? 0 : (calls.length - k) % calls.length
  }
  return { calls, next }
}

const r1 = (v: number) => Math.round(v * 10) / 10

/** The corner from point `from` to `to`, drawn from above with a straight in and out. */
function shapeOf(track: Track, from: number, to: number): { line: string; arrow: string } {
  const { n } = track
  const arc = metresOn(track, from, to)
  const lead = Math.max(12, arc * 0.35)
  const tail = Math.max(10, arc * 0.3)
  const h0 = track.h[from]!
  const fx = Math.cos(h0)
  const fy = Math.sin(h0)
  const x0 = track.x[from]!
  const y0 = track.y[from]!
  // Across is to the right on the screen, along is up it.
  const pts: [number, number][] = [[0, lead]]
  const span = to - from
  const every = Math.max(1, Math.round(span / 40))
  for (let j = 0; j < span; j += every) {
    const i = (from + j) % n
    const dx = track.x[i]! - x0
    const dy = track.y[i]! - y0
    pts.push([dx * fy - dy * fx, -(dx * fx + dy * fy)])
  }
  const end = to % n
  const ex = track.x[end]! - x0
  const ey = track.y[end]! - y0
  pts.push([ex * fy - ey * fx, -(ex * fx + ey * fy)])
  let turned = track.h[end]! - h0
  turned = Math.atan2(Math.sin(turned), Math.cos(turned))
  const ux = -Math.sin(turned)
  const uy = -Math.cos(turned)
  const [lx, ly] = pts[pts.length - 1]!
  pts.push([lx + ux * tail, ly + uy * tail])

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const scale = (100 - PAD * 2) / Math.max(maxX - minX, maxY - minY, 1)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const at = ([x, y]: [number, number]): [number, number] => [r1(50 + (x - cx) * scale), r1(50 + (y - cy) * scale)]
  const line = pts.map((p, j) => `${j ? 'L' : 'M'}${at(p).join(' ')}`).join('')
  const [tx, ty] = at(pts[pts.length - 1]!)
  const wing = (side: number) => `${r1(tx - ux * 13 + uy * 12 * side)} ${r1(ty - uy * 13 - ux * 12 * side)}`
  return { line, arrow: `M${wing(1)}L${r1(tx + ux * 3)} ${r1(ty + uy * 3)}L${wing(-1)}` }
}
