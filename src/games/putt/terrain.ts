/*
 * Terrain: a hole is painted, not boxed. The fairway is a union of shapes
 * — discs, capsules, arcs, ribbons, polygons, rectangles — and its walls are
 * wherever the painted ground ends. The outline is traced from the union's
 * signed distance field with marching squares, so a curve is a curve and a
 * fork is just two strokes that overlap. The union can be blended, so where
 * two strokes meet the corner between them is filled in with a curve of its
 * own and the ground reads as one shape. Sand, water, bridges and slopes are
 * painted the same way, and looked up by asking the shapes directly.
 */

export type Vec = { x: number; y: number }

/** A run of a ribbon's segments and the box round them, so a distance can skip the far ones. */
type Run = { i0: number; i1: number; x0: number; y0: number; x1: number; y1: number }

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'disc'; x: number; y: number; r: number }
  /** A stroke from a to b, `r` thick either side of the line. */
  | { kind: 'capsule'; a: Vec; b: Vec; r: number }
  /** A curved stroke: the arc of radius R about (x, y) from angle a0 to a1, `r` thick either side. */
  | { kind: 'arc'; x: number; y: number; R: number; a0: number; a1: number; r: number }
  /**
   * A spiral stroke: the curve about (x, y) whose radius is r0 at angle t0
   * and grows by `pitch` every turn out to angle t1, `r` thick either side.
   * Angles grow clockwise on screen, so a spiral that winds in as the angle
   * falls is walked from t1 down to t0.
   */
  | { kind: 'spiral'; x: number; y: number; r0: number; pitch: number; t0: number; t1: number; r: number }
  | { kind: 'poly'; pts: Vec[] }
  /** A smooth stroke through a line of points, `r` thick either side: `pts` is the curve, sampled finely. */
  | { kind: 'ribbon'; pts: Vec[]; r: number; runs: Run[] }

export const rect = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h })
export const disc = (x: number, y: number, r: number): Shape => ({ kind: 'disc', x, y, r })
export const capsule = (x1: number, y1: number, x2: number, y2: number, r: number): Shape => ({
  kind: 'capsule',
  a: { x: x1, y: y1 },
  b: { x: x2, y: y2 },
  r,
})
export const arc = (x: number, y: number, R: number, a0: number, a1: number, r: number): Shape => ({
  kind: 'arc',
  x,
  y,
  R,
  a0,
  a1,
  r,
})
export const spiral = (x: number, y: number, r0: number, pitch: number, t0: number, t1: number, r: number): Shape => ({
  kind: 'spiral',
  x,
  y,
  r0,
  pitch,
  t0,
  t1,
  r,
})
export const poly = (...pts: [number, number][]): Shape => ({ kind: 'poly', pts: pts.map(([x, y]) => ({ x, y })) })

/** A curve through `ctrl` (Catmull–Rom, so it passes through every point), sampled about every `step` units. */
export function smoothLine(ctrl: readonly Vec[], step = 1.5): Vec[] {
  if (ctrl.length < 2) return ctrl.map((p) => ({ ...p }))
  const out: Vec[] = [{ ...ctrl[0]! }]
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)]!
    const p1 = ctrl[i]!
    const p2 = ctrl[i + 1]!
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]!
    const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const t2 = t * t
      const t3 = t2 * t
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  return out
}

/** A smooth stroke `r` thick either side of the curve through the points given. */
export function ribbon(r: number, ...ctrl: [number, number][]): Shape {
  const pts = smoothLine(
    ctrl.map(([x, y]) => ({ x, y })),
    2.5,
  )
  const runs: Run[] = []
  const RUN = 8
  for (let i0 = 0; i0 < pts.length - 1; i0 += RUN) {
    const i1 = Math.min(pts.length - 1, i0 + RUN)
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = i0; i <= i1; i++) {
      const p = pts[i]!
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
    runs.push({ i0, i1, x0, y0, x1, y1 })
  }
  return { kind: 'ribbon', pts, r, runs }
}

/** Where a spiral's curve is at an angle. */
export function onSpiral(s: Extract<Shape, { kind: 'spiral' }>, th: number): Vec {
  const R = s.r0 + (s.pitch / (Math.PI * 2)) * (th - s.t0)
  return { x: s.x + Math.cos(th) * R, y: s.y + Math.sin(th) * R }
}

/** A point on an arc, for placing things along a curve. */
export function onArc(x: number, y: number, R: number, angle: number): Vec {
  return { x: x + Math.cos(angle) * R, y: y + Math.sin(angle) * R }
}

/** The square of the distance from p to the segment ab. */
function segDist2(p: Vec, a: Vec, b: Vec) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby || 1
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
  const dx = p.x - (a.x + abx * u)
  const dy = p.y - (a.y + aby * u)
  return dx * dx + dy * dy
}

function segDist(p: Vec, a: Vec, b: Vec) {
  return Math.sqrt(segDist2(p, a, b))
}

/** Signed distance to a shape: negative inside, positive outside. */
export function sdf(s: Shape, p: Vec): number {
  switch (s.kind) {
    case 'disc':
      return Math.hypot(p.x - s.x, p.y - s.y) - s.r
    case 'capsule':
      return segDist(p, s.a, s.b) - s.r
    case 'rect': {
      const qx = Math.abs(p.x - (s.x + s.w / 2)) - s.w / 2
      const qy = Math.abs(p.y - (s.y + s.h / 2)) - s.h / 2
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)
    }
    case 'arc': {
      const dx = p.x - s.x
      const dy = p.y - s.y
      const d = Math.hypot(dx, dy)
      const span = s.a1 - s.a0
      let t = Math.atan2(dy, dx) - s.a0
      t = ((t % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      if (t <= span) return Math.abs(d - s.R) - s.r
      const e0 = onArc(s.x, s.y, s.R, s.a0)
      const e1 = onArc(s.x, s.y, s.R, s.a1)
      return Math.min(Math.hypot(p.x - e0.x, p.y - e0.y), Math.hypot(p.x - e1.x, p.y - e1.y)) - s.r
    }
    case 'spiral': {
      // The turns are near enough circles that the distance is radial: the point's own angle,
      // once a turn, wherever that falls within the spiral's span, and the two ends.
      const dx = p.x - s.x
      const dy = p.y - s.y
      const d = Math.hypot(dx, dy)
      const b = s.pitch / (Math.PI * 2)
      const phi = Math.atan2(dy, dx)
      let best = Infinity
      const kLo = Math.ceil((s.t0 - phi) / (Math.PI * 2))
      const kHi = Math.floor((s.t1 - phi) / (Math.PI * 2))
      for (let k = kLo; k <= kHi; k++) {
        const th = phi + k * Math.PI * 2
        best = Math.min(best, Math.abs(d - (s.r0 + b * (th - s.t0))))
      }
      for (const th of [s.t0, s.t1]) {
        const e = onSpiral(s, th)
        best = Math.min(best, Math.hypot(p.x - e.x, p.y - e.y))
      }
      return best - s.r
    }
    case 'poly': {
      const pts = s.pts
      let best = Infinity
      let insideCount = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[j]!
        const b = pts[i]!
        best = Math.min(best, segDist(p, a, b))
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
          insideCount = !insideCount
        }
      }
      return insideCount ? -best : best
    }
    case 'ribbon': {
      // The nearest run of segments first, so the rest can mostly be ruled out by their boxes.
      const pts = s.pts
      const runs = s.runs
      let first = 0
      let firstGap = Infinity
      for (let k = 0; k < runs.length; k++) {
        const run = runs[k]!
        const bx = Math.max(run.x0 - p.x, 0, p.x - run.x1)
        const by = Math.max(run.y0 - p.y, 0, p.y - run.y1)
        const gap = bx * bx + by * by
        if (gap < firstGap) {
          firstGap = gap
          first = k
        }
      }
      let best = Infinity
      for (let n = 0; n < runs.length; n++) {
        const run = runs[(first + n) % runs.length]!
        if (n > 0) {
          const bx = Math.max(run.x0 - p.x, 0, p.x - run.x1)
          const by = Math.max(run.y0 - p.y, 0, p.y - run.y1)
          if (bx * bx + by * by >= best) continue
        }
        for (let i = run.i0; i < run.i1; i++) {
          const d = segDist2(p, pts[i]!, pts[i + 1]!)
          if (d < best) best = d
        }
      }
      return Math.sqrt(best) - s.r
    }
  }
}

export function inside(s: Shape, p: Vec) {
  const b = boxOf(s)
  if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) return false
  return sdf(s, p) <= 0
}

export function inAny(shapes: readonly Shape[], p: Vec) {
  for (const s of shapes) if (inside(s, p)) return true
  return false
}

/** The centre a shape pulls toward, for bowls: discs by their middle, anything else by its box. */
export function centreOf(s: Shape): Vec {
  switch (s.kind) {
    case 'disc':
      return { x: s.x, y: s.y }
    case 'rect':
      return { x: s.x + s.w / 2, y: s.y + s.h / 2 }
    case 'capsule':
      return { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }
    case 'arc':
      return onArc(s.x, s.y, s.R, (s.a0 + s.a1) / 2)
    case 'spiral':
      return { x: s.x, y: s.y }
    case 'poly':
    case 'ribbon': {
      const n = s.pts.length || 1
      return {
        x: s.pts.reduce((sum, q) => sum + q.x, 0) / n,
        y: s.pts.reduce((sum, q) => sum + q.y, 0) / n,
      }
    }
  }
}

type Box = { x0: number; y0: number; x1: number; y1: number }
const boxes = new WeakMap<Shape, Box>()

/** A shape's box, worked out once. */
function boxOf(s: Shape): Box {
  let b = boxes.get(s)
  if (!b) {
    b = boundsOf(s)
    boxes.set(s, b)
  }
  return b
}

/** The box round a shape, in field units. */
export function boundsOf(s: Shape): Box {
  switch (s.kind) {
    case 'rect':
      return { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h }
    case 'disc':
      return { x0: s.x - s.r, y0: s.y - s.r, x1: s.x + s.r, y1: s.y + s.r }
    case 'capsule':
      return {
        x0: Math.min(s.a.x, s.b.x) - s.r,
        y0: Math.min(s.a.y, s.b.y) - s.r,
        x1: Math.max(s.a.x, s.b.x) + s.r,
        y1: Math.max(s.a.y, s.b.y) + s.r,
      }
    case 'arc': {
      const R = s.R + s.r
      return { x0: s.x - R, y0: s.y - R, x1: s.x + R, y1: s.y + R }
    }
    case 'spiral': {
      const R = s.r0 + (s.pitch / (Math.PI * 2)) * (s.t1 - s.t0) + s.r
      return { x0: s.x - R, y0: s.y - R, x1: s.x + R, y1: s.y + R }
    }
    case 'poly':
    case 'ribbon': {
      const pad = s.kind === 'ribbon' ? s.r : 0
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const p of s.pts) {
        x0 = Math.min(x0, p.x)
        y0 = Math.min(y0, p.y)
        x1 = Math.max(x1, p.x)
        y1 = Math.max(y1, p.y)
      }
      return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }
    }
  }
}

/** The point a shape turns or pushes about: a disc or an arc by its centre, anything else by its box. */
export function pivotOf(s: Shape): Vec {
  if (s.kind === 'arc' || s.kind === 'spiral') return { x: s.x, y: s.y }
  return centreOf(s)
}

/**
 * The signed distance to a union of shapes. With `blend`, the union is a
 * soft one: where two shapes come within `blend` of each other the corner
 * between them fills with a curve, so a join reads as one piece of ground.
 */
export function unionSdf(shapes: readonly Shape[], p: Vec, blend = 0) {
  let best = Infinity
  for (const s of shapes) {
    // A shape whose box is further off than the nearest so far, blend and all, cannot change the answer.
    const b = boxOf(s)
    const bx = Math.max(b.x0 - p.x, 0, p.x - b.x1)
    const by = Math.max(b.y0 - p.y, 0, p.y - b.y1)
    const reach = best + blend
    const far = bx * bx + by * by
    if (best < Infinity && (reach > 0 ? far > reach * reach : far > 0)) continue
    const d = sdf(s, p)
    if (blend > 0 && best < Infinity) {
      const h = Math.max(blend - Math.abs(best - d), 0) / blend
      best = Math.min(best, d) - h * h * blend * 0.25
    } else {
      best = Math.min(best, d)
    }
  }
  return best
}

/** Whether a point is on a union of shapes, blended as `unionSdf` blends it. */
export function inUnion(shapes: readonly Shape[], p: Vec, blend = 0) {
  return unionSdf(shapes, p, blend) <= 0
}

/** Douglas–Peucker: the same line with fewer points. */
function simplify(pts: Vec[], tol: number): Vec[] {
  if (pts.length <= 2) return pts
  let worst = 0
  let at = 0
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i]!, a, b)
    if (d > worst) {
      worst = d
      at = i
    }
  }
  if (worst <= tol) return [a, b]
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)]
}

/**
 * The outline of the painted ground: polylines along the zero line of the
 * union's signed distance, sampled every `cell` units over a `w` by `h` box.
 * Anything painted past the box is cut off just outside it, so every line
 * comes back as a closed loop (first point repeated at the end).
 */
export function contours(
  shapes: readonly Shape[],
  w: number,
  h: number,
  cell = 2,
  tol = 0.3,
  blend = 0,
  x0 = 0,
  y0 = 0,
): Vec[][] {
  const nx = Math.ceil(w / cell) + 2
  const ny = Math.ceil(h / cell) + 2
  // The grid sits off the integers, so shapes drawn on round numbers never put a sample exactly on their edge.
  const ox = x0 - cell + 0.37
  const oy = y0 - cell + 0.29
  // Just outside the box on every side: ground that runs off the edge of the hole ends there.
  const pad = cell * 0.5
  const value = (i: number, j: number) => {
    const x = ox + i * cell
    const y = oy + j * cell
    const out = Math.max(x0 - pad - x, x - x0 - w - pad, y0 - pad - y, y - y0 - h - pad)
    const v = Math.max(unionSdf(shapes, { x, y }, blend), out)
    return Math.abs(v) < 1e-6 ? -1e-6 : v
  }
  // Coarse first: a distance never changes faster than the distance moved, so a coarse cell whose
  // corners all sit further from the edge than the cell is wide cannot have the edge in it, and its
  // samples need only the right sign.
  const CO = 4
  const cnx = Math.ceil(nx / CO) + 1
  const cny = Math.ceil(ny / CO) + 1
  const coarse = new Float32Array((cnx + 1) * (cny + 1))
  for (let cj = 0; cj <= cny; cj++) {
    for (let ci = 0; ci <= cnx; ci++) coarse[cj * (cnx + 1) + ci] = value(ci * CO, cj * CO)
  }
  const clear = CO * cell * 1.5
  const f = new Float32Array((nx + 1) * (ny + 1))
  for (let j = 0; j <= ny; j++) {
    const cj = Math.floor(j / CO)
    for (let i = 0; i <= nx; i++) {
      const ci = Math.floor(i / CO)
      const a = coarse[cj * (cnx + 1) + ci]!
      const b = coarse[cj * (cnx + 1) + ci + 1]!
      const c = coarse[(cj + 1) * (cnx + 1) + ci]!
      const d = coarse[(cj + 1) * (cnx + 1) + ci + 1]!
      const far =
        (a > clear && b > clear && c > clear && d > clear) || (a < -clear && b < -clear && c < -clear && d < -clear)
      f[j * (nx + 1) + i] = far ? a : i % CO === 0 && j % CO === 0 ? a : value(i, j)
    }
  }
  const at = (i: number, j: number) => f[j * (nx + 1) + i]!

  // Each cell: corners a (top-left), b (top-right), c (bottom-right), d (bottom-left); edges 0 top, 1 right, 2 bottom, 3 left.
  const segs: [Vec, Vec][] = []
  const lerp = (x0: number, y0: number, x1: number, y1: number, v0: number, v1: number): Vec => {
    const t = v0 === v1 ? 0.5 : v0 / (v0 - v1)
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t }
  }
  const TABLE: Record<number, [number, number][]> = {
    1: [[3, 0]],
    2: [[0, 1]],
    3: [[3, 1]],
    4: [[1, 2]],
    6: [[0, 2]],
    7: [[3, 2]],
    8: [[2, 3]],
    9: [[0, 2]],
    11: [[1, 2]],
    12: [[3, 1]],
    13: [[0, 1]],
    14: [[3, 0]],
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = at(i, j)
      const b = at(i + 1, j)
      const c = at(i + 1, j + 1)
      const d = at(i, j + 1)
      const idx = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (d < 0 ? 8 : 0)
      if (idx === 0 || idx === 15) continue
      const x0 = ox + i * cell
      const y0 = oy + j * cell
      const x1 = x0 + cell
      const y1 = y0 + cell
      const edge = (e: number): Vec =>
        e === 0
          ? lerp(x0, y0, x1, y0, a, b)
          : e === 1
            ? lerp(x1, y0, x1, y1, b, c)
            : e === 2
              ? lerp(x0, y1, x1, y1, d, c)
              : lerp(x0, y0, x0, y1, a, d)
      let pairs: [number, number][]
      if (idx === 5 || idx === 10) {
        const centreInside = (a + b + c + d) / 4 < 0
        pairs =
          (idx === 5) === centreInside
            ? [
                [0, 1],
                [2, 3],
              ]
            : [
                [3, 0],
                [1, 2],
              ]
      } else {
        pairs = TABLE[idx]!
      }
      for (const [e0, e1] of pairs) segs.push([edge(e0), edge(e1)])
    }
  }

  // Chain segments end to end into polylines.
  const key = (p: Vec) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`
  const byEnd = new Map<string, number[]>()
  segs.forEach((sg, n) => {
    for (const p of sg) {
      const k = key(p)
      const list = byEnd.get(k)
      if (list) list.push(n)
      else byEnd.set(k, [n])
    }
  })
  const used = new Uint8Array(segs.length)
  const lines: Vec[][] = []
  const takeFrom = (p: Vec, skip: number): number | null => {
    for (const n of byEnd.get(key(p)) ?? []) {
      if (!used[n] && n !== skip) return n
    }
    return null
  }
  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue
    used[start] = 1
    const line: Vec[] = [segs[start]![0], segs[start]![1]]
    // Forward.
    for (;;) {
      const tail = line[line.length - 1]!
      const n = takeFrom(tail, -1)
      if (n == null) break
      used[n] = 1
      const [p, q] = segs[n]!
      line.push(key(p) === key(tail) ? q : p)
    }
    // Backward.
    for (;;) {
      const head = line[0]!
      const n = takeFrom(head, -1)
      if (n == null) break
      used[n] = 1
      const [p, q] = segs[n]!
      line.unshift(key(p) === key(head) ? q : p)
    }
    const simple = simplify(line, tol).filter((p, i, arr) => i === 0 || Math.hypot(p.x - arr[i - 1]!.x, p.y - arr[i - 1]!.y) > 1e-4)
    // A speck — a loop smaller than a ball — is a sampling artefact, not ground.
    const xs = simple.map((p) => p.x)
    const ys = simple.map((p) => p.y)
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    if (simple.length >= 2 && extent > 1.5) lines.push(simple)
  }
  return lines
}
