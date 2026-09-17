/*
 * Terrain: a hole is painted, not boxed. The fairway is a union of shapes
 * — discs, capsules, arcs, polygons, rectangles — and its walls are wherever
 * the painted ground ends. The outline is traced from the union's signed
 * distance field with marching squares, so a curve is a curve and a fork
 * is just two strokes that overlap. Sand, water, bridges and slopes are
 * painted the same way, and looked up by asking the shapes directly.
 */

export type Vec = { x: number; y: number }

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'disc'; x: number; y: number; r: number }
  /** A stroke from a to b, `r` thick either side of the line. */
  | { kind: 'capsule'; a: Vec; b: Vec; r: number }
  /** A curved stroke: the arc of radius R about (x, y) from angle a0 to a1, `r` thick either side. */
  | { kind: 'arc'; x: number; y: number; R: number; a0: number; a1: number; r: number }
  | { kind: 'poly'; pts: Vec[] }

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
export const poly = (...pts: [number, number][]): Shape => ({ kind: 'poly', pts: pts.map(([x, y]) => ({ x, y })) })

/** A point on an arc, for placing things along a curve. */
export function onArc(x: number, y: number, R: number, angle: number): Vec {
  return { x: x + Math.cos(angle) * R, y: y + Math.sin(angle) * R }
}

function segDist(p: Vec, a: Vec, b: Vec) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby || 1
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
  return Math.hypot(p.x - (a.x + abx * u), p.y - (a.y + aby * u))
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
  }
}

export function inside(s: Shape, p: Vec) {
  return sdf(s, p) <= 0
}

export function inAny(shapes: readonly Shape[], p: Vec) {
  for (const s of shapes) if (sdf(s, p) <= 0) return true
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
    case 'poly': {
      const n = s.pts.length || 1
      return {
        x: s.pts.reduce((sum, q) => sum + q.x, 0) / n,
        y: s.pts.reduce((sum, q) => sum + q.y, 0) / n,
      }
    }
  }
}

function unionSdf(shapes: readonly Shape[], p: Vec) {
  let best = Infinity
  for (const s of shapes) best = Math.min(best, sdf(s, p))
  return best
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
 * Closed loops come back closed (first point repeated at the end).
 */
export function contours(shapes: readonly Shape[], w: number, h: number, cell = 2, tol = 0.3): Vec[][] {
  const nx = Math.ceil(w / cell) + 2
  const ny = Math.ceil(h / cell) + 2
  // The grid sits off the integers, so shapes drawn on round numbers never put a sample exactly on their edge.
  const ox = -cell + 0.37
  const oy = -cell + 0.29
  const f = new Float32Array((nx + 1) * (ny + 1))
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const v = unionSdf(shapes, { x: ox + i * cell, y: oy + j * cell })
      f[j * (nx + 1) + i] = Math.abs(v) < 1e-6 ? -1e-6 : v
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
