/**
 * Ace Chase: holes laid like a road. Rather than one outline with hills on it, a course runs from the
 * tee as a line of pieces, straights, bends and sharp corners, one after another, with a lane of a
 * given width along it. The lane falls and rises as it goes, leans into its bends and can be hollowed
 * like a gutter across, so a ball rides round a bend instead of into its rail.
 *
 * Everything a hole needs comes from the line: the green's outline, the ground (as heights along the
 * line and across it), where a ball is along the way and in which part (for the misses: "in the posts,
 * 21 m short"), and the line itself, for the camera to fly along.
 *
 * Imports only ./physics, so a script can run it with plain Node.
 */
import type { HoleDef, Pt, Where } from './physics.ts'

/** One piece of the line: a straight so long, a bend of a radius through so many degrees (+ right,
 * − left), or a sharp corner turned on the spot. Each can be named, for the misses. */
export type Piece =
  | { line: number; name?: string }
  | { arc: number; turn: number; name?: string }
  | { corner: 90 | -90; name?: string }

type Seg = {
  kind: 'line' | 'arc' | 'corner'
  name?: string
  s0: number
  s1: number
  /** Where it starts, and which way it's heading: radians, 0 straight up the hole (−z), + to the right. */
  x: number
  z: number
  phi: number
  /** A bend: its centre, radius, which way it turns (+1 right, −1 left), and how far, in radians. */
  cx: number
  cz: number
  r: number
  dir: number
  sweep: number
}

type Pose = { x: number; z: number; phi: number }

/** Heading `phi` as a direction, and the direction to its right. */
const ahead = (phi: number): Pt => [Math.sin(phi), -Math.cos(phi)]
const rightOf = (phi: number): Pt => [Math.cos(phi), Math.sin(phi)]
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI))

export type Course = {
  length: number
  /** The line at `s` metres from its start: where, and which way. */
  at(s: number): Pose
  /** Where a point is: `s` along the line and `d` across it, + to the right. */
  local(x: number, z: number): { s: number; d: number }
  /**
   * How sharply the line turns at `s` (1/radius, + right), eased in and out of each bend over `ease` m;
   * each bend weighted by `weight(i)`, the i-th bend counting from the tee, if given.
   */
  curve(s: number, ease?: number, weight?: (i: number) => number): number
  /** The name of the piece at `s`. */
  part(s: number): string | undefined
  /** The green: the lane `half(s)` either side of the line, square at the corners, the ends rounded. */
  outline(half: (s: number) => number, ends?: { tee?: number; far?: number }): Pt[]
  /** A sharp corner's outer point, and the ends of a rubber set across it at 45°, `leg` along each rail. */
  cornerBank(index: number, half: number, leg: number): { outer: Pt; a: Pt; b: Pt }
  /** Points along the line every `step` m, at the height `y(s)`: for the camera. */
  path(y: (s: number) => number, step?: number): [number, number, number][]
}

/** Where a piece is `t` metres along it. */
function poseOn(g: Seg, t: number): Pose {
  const u = Math.max(0, Math.min(g.s1 - g.s0, t))
  if (g.kind === 'arc') {
    const phi = g.phi + (g.dir * u) / g.r
    const [rx, rz] = rightOf(phi)
    return { x: g.cx - rx * g.r * g.dir, z: g.cz - rz * g.r * g.dir, phi }
  }
  const [ux, uz] = ahead(g.phi)
  return { x: g.x + ux * u, z: g.z + uz * u, phi: g.phi }
}

/** Lay a line of pieces from `start`, heading straight up the hole. */
export function course(start: { x: number; z: number }, pieces: readonly Piece[]): Course {
  const segs: Seg[] = []
  let x = start.x
  let z = start.z
  let phi = 0
  let s = 0
  for (const p of pieces) {
    const base = { name: p.name, s0: s, x, z, phi, cx: 0, cz: 0, r: 0, dir: 0, sweep: 0 }
    if ('line' in p) {
      const [ux, uz] = ahead(phi)
      segs.push({ ...base, kind: 'line', s1: s + p.line })
      x += ux * p.line
      z += uz * p.line
      s += p.line
    } else if ('arc' in p) {
      const dir = Math.sign(p.turn)
      const sweep = (Math.abs(p.turn) * Math.PI) / 180
      const [rx, rz] = rightOf(phi)
      // The centre is to the right of a right-hand bend and to the left of a left-hand one.
      const cx = x + rx * p.arc * dir
      const cz = z + rz * p.arc * dir
      segs.push({ ...base, kind: 'arc', s1: s + sweep * p.arc, cx, cz, r: p.arc, dir, sweep })
      phi += dir * sweep
      const [qx, qz] = rightOf(phi)
      x = cx - qx * p.arc * dir
      z = cz - qz * p.arc * dir
      s += sweep * p.arc
    } else {
      segs.push({ ...base, kind: 'corner', s1: s, dir: Math.sign(p.corner), sweep: Math.PI / 2 })
      phi += (Math.sign(p.corner) * Math.PI) / 2
    }
  }
  const length = s
  const runs = segs.filter((g) => g.kind !== 'corner')

  const at = (s: number) => {
    const g = runs.find((q) => s <= q.s1) ?? runs[runs.length - 1]!
    return poseOn(g, s - g.s0)
  }

  /** A point against one piece: along and across it, and how far past either end of it. */
  const against = (g: Seg, x: number, z: number) => {
    if (g.kind === 'line') {
      const [ux, uz] = ahead(g.phi)
      const [rx, rz] = rightOf(g.phi)
      const vx = x - g.x
      const vz = z - g.z
      const along = vx * ux + vz * uz
      const len = g.s1 - g.s0
      return { s: g.s0 + along, d: vx * rx + vz * rz, over: along < 0 ? -along : along > len ? along - len : 0 }
    }
    const vx = x - g.cx
    const vz = z - g.cz
    const dist = Math.hypot(vx, vz) || 1e-9
    // The heading whose point on the bend lies straight out from the centre towards this one.
    const phi = g.dir > 0 ? Math.atan2(-vz, -vx) : Math.atan2(vz, vx)
    const half = g.sweep / 2
    const turned = half + wrap(g.dir * (phi - g.phi) - half)
    const over = turned < 0 ? -turned * g.r : turned > g.sweep ? (turned - g.sweep) * g.r : 0
    return { s: g.s0 + turned * g.r, d: g.dir > 0 ? g.r - dist : dist - g.r, over }
  }

  // A metre grid over the course, listing the pieces worth asking about in each square.
  const pts: { x: number; z: number; i: number }[] = []
  runs.forEach((g, i) => {
    for (let t = 0; t <= g.s1 - g.s0 + 1e-6; t += 0.5) {
      const p = poseOn(g, t)
      pts.push({ x: p.x, z: p.z, i })
    }
  })
  const REACH = 6
  const gx0 = Math.floor(Math.min(...pts.map((p) => p.x)) - REACH)
  const gz0 = Math.floor(Math.min(...pts.map((p) => p.z)) - REACH)
  const gw = Math.ceil(Math.max(...pts.map((p) => p.x)) + REACH) - gx0
  const gh = Math.ceil(Math.max(...pts.map((p) => p.z)) + REACH) - gz0
  const cells: number[][] = Array.from({ length: gw * gh }, () => [])
  for (const p of pts)
    for (let cx = Math.floor(p.x - REACH); cx <= p.x + REACH; cx++)
      for (let cz = Math.floor(p.z - REACH); cz <= p.z + REACH; cz++) {
        const k = (cz - gz0) * gw + (cx - gx0)
        const cell = cells[k]
        if (cell && cx - gx0 < gw && Math.hypot(cx + 0.5 - p.x, cz + 0.5 - p.z) < REACH && !cell.includes(p.i)) cell.push(p.i)
      }
  const every = runs.map((_, i) => i)

  const local = (x: number, z: number) => {
    const cx = Math.floor(x) - gx0
    const cz = Math.floor(z) - gz0
    const near = cx >= 0 && cx < gw && cz >= 0 && cz < gh ? cells[cz * gw + cx]! : every
    let best = { s: 0, d: Infinity }
    let score = Infinity
    for (const i of near.length ? near : every) {
      const q = against(runs[i]!, x, z)
      // Across the piece, and a heavy price for lying past either end of it.
      const sc = Math.abs(q.d) + 4 * q.over
      if (sc < score) {
        score = sc
        best = { s: q.s, d: q.d }
      }
    }
    return best
  }

  const bends = runs.filter((g) => g.kind === 'arc')
  const curve = (s: number, ease = 2, weight?: (i: number) => number) => {
    let k = 0
    bends.forEach((g, i) => {
      const on = (a: number) => {
        const u = Math.max(0, Math.min(1, (s - (a - ease)) / (2 * ease)))
        return u * u * (3 - 2 * u)
      }
      const w = on(g.s0) - on(g.s1)
      if (w) k += (g.dir / g.r) * w * (weight ? weight(i) : 1)
    })
    return k
  }

  const part = (s: number) => (runs.find((g) => s <= g.s1 + 1e-6) ?? runs[runs.length - 1])?.name

  /** A corner's outer and inner points, for a lane `w` either side. */
  const cornerPoints = (g: Seg, w: number) => {
    const [ux, uz] = ahead(g.phi)
    const [rx, rz] = rightOf(g.phi)
    // The outer corner is ahead of the turn and on the side away from it; the inner one short of it.
    const outer: Pt = [g.x + w * (ux - g.dir * rx), g.z + w * (uz - g.dir * rz)]
    const inner: Pt = [g.x - w * (ux - g.dir * rx), g.z - w * (uz - g.dir * rz)]
    return { outer, inner }
  }

  const cornerBank = (index: number, half: number, leg: number) => {
    const g = segs.filter((q) => q.kind === 'corner')[index]
    if (!g) throw new Error(`no corner ${index}`)
    const { outer } = cornerPoints(g, half)
    const [ux, uz] = ahead(g.phi)
    const [vx, vz] = ahead(g.phi + (g.dir * Math.PI) / 2)
    const a: Pt = [outer[0] - ux * leg, outer[1] - uz * leg]
    const b: Pt = [outer[0] + vx * leg, outer[1] + vz * leg]
    return { outer, a, b }
  }

  const outline = (half: (s: number) => number, ends: { tee?: number; far?: number } = {}) => {
    type Mark = { s: number; p: Pt; corner?: boolean }
    const left: Mark[] = []
    const right: Mark[] = []
    const cut: { s: number; w: number; side: Mark[] }[] = []
    for (const g of segs) {
      if (g.kind === 'corner') {
        // Square corners: the outer side meets ahead of the turn; the inner side is cut short of it.
        const w = half(g.s0)
        const { outer, inner } = cornerPoints(g, w)
        const [out, inn] = g.dir > 0 ? [left, right] : [right, left]
        out.push({ s: g.s0, p: outer, corner: true })
        inn.push({ s: g.s0, p: inner, corner: true })
        cut.push({ s: g.s0, w, side: inn })
        continue
      }
      const n = Math.max(1, Math.ceil((g.s1 - g.s0) / 0.5))
      for (let k = 0; k <= n; k++) {
        const t = ((g.s1 - g.s0) * k) / n
        const e = poseOn(g, t)
        const [rx, rz] = rightOf(e.phi)
        const w = half(g.s0 + t)
        left.push({ s: g.s0 + t, p: [e.x - rx * w, e.z - rz * w] })
        right.push({ s: g.s0 + t, p: [e.x + rx * w, e.z + rz * w] })
      }
    }
    const trim = (side: Mark[]) =>
      side.filter((m) => m.corner || !cut.some((c) => c.side === side && Math.abs(m.s - c.s) < c.w - 1e-6))
    const tidy = (side: Mark[]) => {
      const out: Pt[] = []
      for (const { p } of side) {
        const q = out[out.length - 1]
        if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push(p)
      }
      return out
    }
    const L = tidy(trim(left))
    const R = tidy(trim(right))
    // Round the two corners at each end.
    const round = (a: Pt, c: Pt, b: Pt, r: number): Pt[] => {
      if (!r) return [c]
      const l1 = Math.hypot(c[0] - a[0], c[1] - a[1])
      const l2 = Math.hypot(b[0] - c[0], b[1] - c[1])
      const k = Math.min(r, l1 / 2, l2 / 2)
      const p: Pt = [c[0] + ((a[0] - c[0]) * k) / l1, c[1] + ((a[1] - c[1]) * k) / l1]
      const q: Pt = [c[0] + ((b[0] - c[0]) * k) / l2, c[1] + ((b[1] - c[1]) * k) / l2]
      const out: Pt[] = []
      for (let j = 0; j <= 6; j++) {
        const t = j / 6
        const u = 1 - t
        out.push([u * u * p[0] + 2 * u * t * c[0] + t * t * q[0], u * u * p[1] + 2 * u * t * c[1] + t * t * q[1]])
      }
      return out
    }
    const tee = ends.tee ?? 1.2
    const far = ends.far ?? 0.5
    const n = L.length
    const m = R.length
    const ring: Pt[] = [
      // Up the left side from the tee end to the far end, across, and back down the right.
      ...round(R[0]!, L[0]!, L[1]!, tee),
      ...L.slice(1, n - 1),
      ...round(L[n - 2]!, L[n - 1]!, R[m - 1]!, far),
      ...round(L[n - 1]!, R[m - 1]!, R[m - 2]!, far),
      ...R.slice(1, m - 1).reverse(),
      ...round(R[1]!, R[0]!, L[0]!, tee),
    ]
    // Drop points in a straight run: every rail is a wall the ball is tested against.
    const out: Pt[] = []
    for (let i = 0; i < ring.length; i++) {
      const a = out[out.length - 1]
      const b = ring[i]!
      const c = ring[(i + 1) % ring.length]!
      if (a) {
        const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1])
        if (len > 0 && Math.abs(cross) / len < 1e-4) continue
      }
      out.push(b)
    }
    return out
  }

  const path = (y: (s: number) => number, step = 1) => {
    const out: [number, number, number][] = []
    for (let t = 0; t <= length + 1e-6; t += step) {
      const p = at(Math.min(t, length))
      out.push([p.x, y(t), p.z])
    }
    return out
  }

  return { length, at, local, curve, part, outline, cornerBank, path }
}

/**
 * A smooth run of heights through `knots` ([s, height] pairs), never overshooting between them
 * (monotone cubic), level at the first and last and flat beyond them.
 */
export function profile(knots: readonly (readonly [number, number])[]): (s: number) => number {
  const n = knots.length
  const xs = knots.map((k) => k[0])
  const ys = knots.map((k) => k[1])
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!))
  const m: number[] = Array.from({ length: n }, (_, i) =>
    i === 0 || i === n - 1 ? 0 : d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2,
  )
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i]! / d[i]!
    const b = m[i + 1]! / d[i]!
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      m[i] = t * a * d[i]!
      m[i + 1] = t * b * d[i]!
    }
  }
  return (s) => {
    if (s <= xs[0]!) return ys[0]!
    if (s >= xs[n - 1]!) return ys[n - 1]!
    let i = 0
    while (s > xs[i + 1]!) i++
    const h = xs[i + 1]! - xs[i]!
    const t = (s - xs[i]!) / h
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * h * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * h * m[i + 1]!
  }
}

/** For the misses: where a point lies along a course, and in which part. */
export function whereOn(c: Course): NonNullable<HoleDef['where']> {
  return (x: number, z: number): Where => {
    const p = c.local(x, z)
    return { s: p.s, d: p.d, part: c.part(p.s) }
  }
}
