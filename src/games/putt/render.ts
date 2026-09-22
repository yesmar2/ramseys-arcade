import { mulberry32 } from '../../lib/seededRandom'
import { EDGE_T, FIELD_W, PORTAL_R, SAIL_T, SPINNER_T, type Hole, type Mill, type Ramp, type Shape, type Slope, type Vec } from './course'
import {
  AIM_STUB,
  aimTrace,
  BALL_R,
  bridgeLevel,
  COURSE,
  CUP_R,
  cupAt,
  currentHole,
  edgesOf,
  fieldFrame,
  GUIDE_REACH,
  mapLayout,
  MAX_DRAG,
  millOver,
  sliderWall,
  spinnerWall,
  underMap,
  type Frame,
  type GameState,
} from './game'
import { css, gardenOf, isTree, mix, skin, type Prop, type Skin } from './paint'
import { boundsOf, contours, inAny } from './terrain'

/*
 * Putt, drawn. The hole is a green laid through a garden: timber rails round
 * it that cast a shadow on the grass outside and on the green inside, the
 * green mown in stripes, trees and flowers round it, water that glints and
 * sand that is raked, and a windmill whose roof the ball runs under.
 *
 * Everything that holds still is painted once into strips along the hole,
 * at the screen's own resolution, and laid down each frame where the camera
 * says; only what moves is drawn every frame. The field is drawn in field
 * units through the canvas's transform, so a hole lying on its side on a
 * wide screen is the same drawing turned.
 */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type Layer = HTMLCanvasElement | OffscreenCanvas

/** The painted strips: this long each, drawn with this much overlap so no seam shows. */
const TILE = 64
const BLEED = 3
/** How many device pixels of painted strips to keep before dropping the furthest. */
const TILE_BUDGET = 26_000_000
/** How far the rail stands out past the edge of the green; it also covers the green's last EDGE_T. */
const RAIL_W = 2.3
/** The way shadows fall, per unit of height: away from a light up and to the left. */
const LIGHT = { x: 0.62, y: 0.85 }

function ink(sk: Skin, alpha: number) {
  return css(sk.ink, alpha)
}

/* ---------- paths ---------- */

/** One path through closed loops, for filling with 'evenodd' so a hole in the ground stays a hole. */
function loopsPath(g: Ctx, loops: readonly Vec[][]) {
  g.beginPath()
  for (const line of loops) {
    line.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
    g.closePath()
  }
}

const listLines = new WeakMap<readonly Shape[], Vec[][]>()
const shapeLines = new WeakMap<Shape, Vec[][]>()

/** The outline of a union of shapes, traced over just the box round them and kept. */
function traceShapes(shapes: readonly Shape[], len: number): Vec[][] {
  if (!shapes.length) return []
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const s of shapes) {
    const b = boundsOf(s)
    x0 = Math.min(x0, b.x0)
    y0 = Math.min(y0, b.y0)
    x1 = Math.max(x1, b.x1)
    y1 = Math.max(y1, b.y1)
  }
  x0 = Math.max(-3, x0 - 2)
  y0 = Math.max(-3, y0 - 2)
  x1 = Math.min(FIELD_W + 3, x1 + 2)
  y1 = Math.min(len + 3, y1 + 2)
  if (x1 <= x0 || y1 <= y0) return []
  return contours(shapes, x1 - x0, y1 - y0, 0.75, 0.08, 0, x0, y0)
}

function outlineOf(shapes: readonly Shape[], len: number) {
  let lines = listLines.get(shapes)
  if (!lines) {
    lines = traceShapes(shapes, len)
    listLines.set(shapes, lines)
  }
  return lines
}

function outlineOfShape(shape: Shape, len: number) {
  let lines = shapeLines.get(shape)
  if (!lines) {
    lines = traceShapes([shape], len)
    shapeLines.set(shape, lines)
  }
  return lines
}

/**
 * Paint only the shadow of what `draw` paints: cast `h` units high, away from
 * the light, softened by `blur` units. The shape itself is drawn far off to
 * the side and only its shadow is brought back.
 */
function castShadow(g: Ctx, h: number, blur: number, color: string, draw: () => void) {
  const m = g.getTransform()
  const FAR = 3000
  const sx = LIGHT.x * h
  const sy = LIGHT.y * h
  g.save()
  g.shadowColor = color
  g.shadowBlur = blur * Math.hypot(m.a, m.b)
  g.shadowOffsetX = m.a * (FAR + sx) + m.c * sy
  g.shadowOffsetY = m.b * (FAR + sx) + m.d * sy
  g.translate(-FAR, 0)
  draw()
  g.restore()
}

/** A random stream that is the same for a spot on the ground every time it is asked. */
function spotRandom(i: number, j: number, salt: number) {
  return mulberry32(((Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ salt) >>> 0) + 1)
}

/* ---------- the ground, painted once ---------- */

/** Tufts in the garden's grass: short strokes in two shades, scattered on a grid so each strip agrees with the next. */
function paintTufts(g: Ctx, sk: Skin, ya: number, yb: number) {
  const step = 2.8
  const hi = new Path2D()
  const lo = new Path2D()
  for (let j = Math.floor(ya / step) - 1; j * step < yb + 1; j++) {
    for (let i = -2; i * step < FIELD_W + 3; i++) {
      const rnd = spotRandom(i, j, 11)
      if (rnd() > 0.6) continue
      const x = (i + rnd()) * step
      const y = (j + rnd()) * step
      const path = rnd() < 0.5 ? hi : lo
      const n = 2 + Math.floor(rnd() * 2)
      const len = 0.75 + rnd() * 0.6
      for (let b = 0; b < n; b++) {
        const a = -Math.PI / 2 + (b - (n - 1) / 2) * 0.5 + (rnd() - 0.5) * 0.3
        path.moveTo(x, y)
        path.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
      }
    }
  }
  g.lineCap = 'round'
  g.lineWidth = 0.24
  g.strokeStyle = css(sk.roughHi, 0.6)
  g.stroke(hi)
  g.strokeStyle = css(sk.roughLo, 0.6)
  g.stroke(lo)
}

/** The green's own grain: finer, closer blades, barely there, so it reads as turf and not paint. */
function paintBlades(g: Ctx, sk: Skin, ya: number, yb: number) {
  const step = 1.45
  const hi = new Path2D()
  const lo = new Path2D()
  for (let j = Math.floor(ya / step) - 1; j * step < yb + 1; j++) {
    for (let i = -1; i * step < FIELD_W + 1; i++) {
      const rnd = spotRandom(i, j, 29)
      if (rnd() > 0.7) continue
      const x = (i + rnd()) * step
      const y = (j + rnd()) * step
      const a = -Math.PI / 2 + (rnd() - 0.5) * 1.1
      const len = 0.45 + rnd() * 0.3
      const path = rnd() < 0.5 ? hi : lo
      path.moveTo(x, y)
      path.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    }
  }
  g.lineCap = 'round'
  g.lineWidth = 0.17
  g.strokeStyle = css(sk.greenHi, 0.45)
  g.stroke(hi)
  g.strokeStyle = css(sk.greenLo, 0.4)
  g.stroke(lo)
}

/** A round crown with scalloped edges, the way a tree or a bush looks from above. */
function crownPath(g: Ctx, x: number, y: number, r: number, seed: number, lumps: number, depth: number) {
  const phase = seed * Math.PI * 2 * 7
  const n = Math.max(24, Math.round(r * 6))
  g.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (1 - depth + depth * 2 * Math.abs(Math.sin((lumps * a + phase) / 2)))
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}

/** A pine from above: a star of needles, a lighter star inside it. */
function starPath(g: Ctx, x: number, y: number, r: number, points: number, inner: number, spin: number) {
  g.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const a = spin + (i / (points * 2)) * Math.PI * 2
    const rr = i % 2 === 0 ? r : r * inner
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}

function propHeight(p: Prop) {
  if (isTree(p)) return 2.2 + p.r * 0.32
  if (p.kind === 'bush') return 1.1
  if (p.kind === 'stone') return 0.7
  return 0
}

/** A prop's shadow on the ground under it. */
function paintPropShadow(g: Ctx, sk: Skin, p: Prop) {
  const h = propHeight(p)
  if (h <= 0) return
  g.fillStyle = sk.shadow
  const x = p.x + LIGHT.x * h
  const y = p.y + LIGHT.y * h
  if (p.kind === 'pine') starPath(g, x, y, p.r, 10, 0.72, p.seed * 6)
  else crownPath(g, x, y, p.r * (p.kind === 'stone' ? 0.95 : 1), p.seed, 8, 0.07)
  g.fill()
}

function paintProp(g: Ctx, sk: Skin, p: Prop) {
  const rnd = mulberry32(Math.floor(p.seed * 4294967295) + 7)
  switch (p.kind) {
    case 'tree':
    case 'blossom':
    case 'bush': {
      const blossom = p.kind === 'blossom'
      const fill = blossom ? sk.blossom : sk.leaf
      const lit = blossom ? sk.blossomLit : sk.leafLit
      const line = blossom ? sk.blossomLine : sk.leafLine
      const lumps = p.kind === 'bush' ? 6 : 8 + Math.floor(rnd() * 3)
      crownPath(g, p.x, p.y, p.r, p.seed, lumps, 0.075)
      g.fillStyle = css(fill)
      g.fill()
      g.save()
      g.clip()
      // The side toward the light: the same crown, smaller and lighter, drawn up and to the left.
      crownPath(g, p.x - p.r * 0.2, p.y - p.r * 0.26, p.r * 0.7, p.seed + 0.37, lumps - 1, 0.09)
      g.fillStyle = css(lit)
      g.fill()
      g.restore()
      crownPath(g, p.x, p.y, p.r, p.seed, lumps, 0.075)
      g.strokeStyle = line
      g.lineWidth = 0.3
      g.stroke()
      if (p.kind !== 'bush') {
        // Clumps of leaves inside the crown: short arcs of the line colour.
        g.lineWidth = 0.22
        g.strokeStyle = blossom ? sk.blossomLine : sk.leafLine
        g.globalAlpha = 0.5
        const clumps = 3 + Math.floor(rnd() * 3)
        for (let i = 0; i < clumps; i++) {
          const a = rnd() * Math.PI * 2
          const d = p.r * (0.25 + rnd() * 0.4)
          const cr = p.r * (0.22 + rnd() * 0.14)
          const cx = p.x + Math.cos(a) * d
          const cy = p.y + Math.sin(a) * d
          g.beginPath()
          g.arc(cx, cy, cr, Math.PI * 0.15, Math.PI * 0.95)
          g.stroke()
        }
        g.globalAlpha = 1
      }
      if (blossom) {
        g.fillStyle = css(mix(sk.blossomLit, [255, 255, 255], sk.dark ? 0.35 : 0.6), 0.95)
        const n = Math.round(p.r * 1.6)
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2
          const d = Math.sqrt(rnd()) * p.r * 0.85
          g.beginPath()
          g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.32 + rnd() * 0.25, 0, Math.PI * 2)
          g.fill()
        }
      }
      return
    }
    case 'pine': {
      const spin = p.seed * 6
      const points = 10 + Math.floor(rnd() * 3)
      starPath(g, p.x, p.y, p.r, points, 0.74, spin)
      g.fillStyle = css(sk.pine)
      g.fill()
      g.strokeStyle = sk.pineLine
      g.lineWidth = 0.3
      g.lineJoin = 'round'
      g.stroke()
      starPath(g, p.x - p.r * 0.08, p.y - p.r * 0.1, p.r * 0.62, points, 0.7, spin + 0.2)
      g.fillStyle = css(sk.pineLit)
      g.fill()
      starPath(g, p.x - p.r * 0.1, p.y - p.r * 0.12, p.r * 0.3, points - 3, 0.66, spin + 0.5)
      g.fillStyle = css(mix(sk.pineLit, [255, 255, 255], sk.dark ? 0.12 : 0.3))
      g.fill()
      return
    }
    case 'flowers': {
      const n = 3 + Math.floor(rnd() * 4)
      const color = sk.petals[Math.floor(rnd() * sk.petals.length)]!
      // Leaves first, then the heads over them.
      g.fillStyle = css(sk.leafLit, 0.9)
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2
        const d = rnd() * p.r
        g.beginPath()
        g.ellipse(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.75, 0.42, a, 0, Math.PI * 2)
        g.fill()
      }
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2
        const d = Math.sqrt(rnd()) * p.r
        const fx = p.x + Math.cos(a) * d
        const fy = p.y + Math.sin(a) * d
        const size = 0.5 + rnd() * 0.25
        const turn = rnd() * Math.PI
        g.fillStyle = rnd() < 0.8 ? color : sk.petals[Math.floor(rnd() * sk.petals.length)]!
        for (let k = 0; k < 5; k++) {
          const pa = turn + (k / 5) * Math.PI * 2
          g.beginPath()
          g.arc(fx + Math.cos(pa) * size, fy + Math.sin(pa) * size, size * 0.72, 0, Math.PI * 2)
          g.fill()
        }
        g.fillStyle = sk.dark ? 'rgba(255, 236, 170, 0.95)' : 'rgba(255, 244, 200, 1)'
        g.beginPath()
        g.arc(fx, fy, size * 0.5, 0, Math.PI * 2)
        g.fill()
      }
      return
    }
    case 'stone': {
      paintStone(g, sk, p.x, p.y, p.r, p.seed)
      return
    }
    case 'lily': {
      const notch = rnd() * Math.PI * 2
      g.beginPath()
      g.moveTo(p.x, p.y)
      g.arc(p.x, p.y, p.r, notch + 0.32, notch - 0.32 + Math.PI * 2)
      g.closePath()
      g.fillStyle = css(sk.leafLit, 0.95)
      g.fill()
      g.strokeStyle = sk.leafLine
      g.lineWidth = 0.2
      g.stroke()
      if (rnd() < 0.35) {
        g.fillStyle = sk.petals[0]!
        for (let k = 0; k < 6; k++) {
          const pa = (k / 6) * Math.PI * 2
          g.beginPath()
          g.arc(p.x + Math.cos(pa) * 0.45, p.y + Math.sin(pa) * 0.45, 0.36, 0, Math.PI * 2)
          g.fill()
        }
        g.fillStyle = 'rgba(255, 240, 180, 1)'
        g.beginPath()
        g.arc(p.x, p.y, 0.26, 0, Math.PI * 2)
        g.fill()
      }
      return
    }
    case 'reeds': {
      const n = 4 + Math.floor(rnd() * 3)
      g.lineCap = 'round'
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 1.3
        const len = p.r * (0.7 + rnd() * 0.5)
        const bx = p.x + (rnd() - 0.5) * 1.2
        const by = p.y + (rnd() - 0.5) * 0.8
        g.strokeStyle = sk.leafLine
        g.lineWidth = 0.22
        g.beginPath()
        g.moveTo(bx, by)
        g.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len)
        g.stroke()
        if (rnd() < 0.5) {
          g.fillStyle = css(mix(sk.rail, [0, 0, 0], 0.15))
          g.beginPath()
          g.ellipse(bx + Math.cos(a) * len * 0.85, by + Math.sin(a) * len * 0.85, 0.22, 0.55, a + Math.PI / 2, 0, Math.PI * 2)
          g.fill()
        }
      }
      return
    }
  }
}

/** A rounded stone: grey from the palette's sky, a lit face and a clean line. */
function paintStone(g: Ctx, sk: Skin, x: number, y: number, r: number, seed: number) {
  const rnd = mulberry32(Math.floor(seed * 4294967295) + 3)
  const n = 7
  const pts: Vec[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4
    const rr = r * (0.82 + rnd() * 0.22)
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.86 })
  }
  const smooth = () => {
    g.beginPath()
    for (let i = 0; i < n; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % n]!
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      if (i === 0) g.moveTo(mx, my)
      else g.quadraticCurveTo(a.x, a.y, mx, my)
    }
    const a = pts[0]!
    const b = pts[1]!
    g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
    g.closePath()
  }
  smooth()
  g.fillStyle = css(sk.stone)
  g.fill()
  g.save()
  g.clip()
  g.fillStyle = css(sk.stoneLit)
  g.beginPath()
  g.ellipse(x - r * 0.3, y - r * 0.32, r * 0.62, r * 0.48, -0.5, 0, Math.PI * 2)
  g.fill()
  g.restore()
  smooth()
  g.strokeStyle = sk.stoneLine
  g.lineWidth = 0.28
  g.stroke()
}

/** Water: the pool, its lighter shallows along the banks, the bank's shadow on it, and its line. */
function paintWater(g: Ctx, sk: Skin, loops: Vec[][]) {
  if (!loops.length) return
  loopsPath(g, loops)
  g.fillStyle = css(sk.water)
  g.fill('evenodd')
  g.save()
  loopsPath(g, loops)
  g.clip('evenodd')
  loopsPath(g, loops)
  g.strokeStyle = css(sk.waterEdge, 0.75)
  g.lineWidth = 3.4
  g.stroke()
  // The bank stands above the water, and throws its shadow on the side away from the light.
  castShadow(g, 1.4, 0.8, sk.shadow, () => {
    loopsPath(g, loops)
    g.lineWidth = 1.2
    g.stroke()
  })
  g.restore()
  loopsPath(g, loops)
  g.strokeStyle = sk.waterLine
  g.lineWidth = 0.34
  g.stroke()
}

/** Sand: sunk into the green, raked, with its rim's shadow along the side under the light. */
function paintSand(g: Ctx, sk: Skin, loops: Vec[][]) {
  if (!loops.length) return
  loopsPath(g, loops)
  g.fillStyle = css(sk.sand)
  g.fill('evenodd')
  g.save()
  loopsPath(g, loops)
  g.clip('evenodd')
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const line of loops) {
    for (const p of line) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
  }
  // Rake lines: gentle waves across the bunker.
  g.strokeStyle = sk.sandMark
  g.lineWidth = 0.2
  for (let y = y0 - 2; y < y1 + 2; y += 1.3) {
    g.beginPath()
    for (let x = x0 - 2; x <= x1 + 2; x += 0.8) {
      const yy = y + Math.sin(x * 0.45 + y * 0.3) * 0.35 + (x - x0) * 0.18
      if (x === x0 - 2) g.moveTo(x, yy)
      else g.lineTo(x, yy)
    }
    g.stroke()
  }
  castShadow(g, 1.2, 0.6, sk.shadow, () => {
    loopsPath(g, loops)
    g.lineWidth = 1
    g.stroke()
  })
  g.restore()
  loopsPath(g, loops)
  g.strokeStyle = sk.sandLine
  g.lineWidth = 0.34
  g.stroke()
}

/** A hill: shaded dark toward the foot and light toward the top, with faint chevrons running downhill. */
function paintSlope(g: Ctx, sk: Skin, sl: Slope, loops: Vec[][]) {
  if (!loops.length) return
  const b = boundsOf(sl.shape)
  g.save()
  loopsPath(g, loops)
  g.clip('evenodd')
  if (sl.pull) {
    const mag = Math.hypot(sl.pull.x, sl.pull.y) || 1
    const dx = sl.pull.x / mag
    const dy = sl.pull.y / mag
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const along = Math.abs(dx) * (b.x1 - b.x0) + Math.abs(dy) * (b.y1 - b.y0)
    const grad = g.createLinearGradient(cx - dx * along * 0.5, cy - dy * along * 0.5, cx + dx * along * 0.5, cy + dy * along * 0.5)
    grad.addColorStop(0, css(sk.greenHi, 0.34))
    grad.addColorStop(0.5, css(sk.greenHi, 0))
    grad.addColorStop(1, css(sk.greenLo, 0.42))
    g.fillStyle = grad
    g.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2)
    // Chevrons pointing downhill, in rows across the slope.
    const px = -dy
    const py = dx
    const across = Math.abs(dx) * (b.y1 - b.y0) + Math.abs(dy) * (b.x1 - b.x0)
    g.strokeStyle = ink(sk, sk.dark ? 0.16 : 0.14)
    g.lineWidth = 0.4
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (let m = -across / 2 + 6; m < across / 2 - 3; m += 11) {
      for (let k = -along / 2 + 3; k < along / 2 - 1; k += 6) {
        const x = cx + px * m + dx * k
        const y = cy + py * m + dy * k
        g.beginPath()
        g.moveTo(x - dx * 1.6 + px * 1.8, y - dy * 1.6 + py * 1.8)
        g.lineTo(x, y)
        g.lineTo(x - dx * 1.6 - px * 1.8, y - dy * 1.6 - py * 1.8)
        g.stroke()
      }
    }
  } else {
    g.fillStyle = css(sk.greenLo, 0.14)
    g.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2)
  }
  g.restore()
}

/** A footbridge over the water: planks across, a railing either side, and its shadow on the water. */
function paintBridge(g: Ctx, sk: Skin, sh: Shape) {
  if (sh.kind !== 'capsule') return
  const len = Math.hypot(sh.b.x - sh.a.x, sh.b.y - sh.a.y) || 1
  const ux = (sh.b.x - sh.a.x) / len
  const uy = (sh.b.y - sh.a.y) / len
  const nx = -uy
  const ny = ux
  // The deck is as wide as a ball can go, and the railings stand where the traced walls stop it.
  const deck = sh.r - EDGE_T
  const rail = 1.7
  const quad = (from: number, to: number, w0: number, w1: number) => {
    g.beginPath()
    g.moveTo(sh.a.x + ux * from + nx * w0, sh.a.y + uy * from + ny * w0)
    g.lineTo(sh.a.x + ux * to + nx * w0, sh.a.y + uy * to + ny * w0)
    g.lineTo(sh.a.x + ux * to + nx * w1, sh.a.y + uy * to + ny * w1)
    g.lineTo(sh.a.x + ux * from + nx * w1, sh.a.y + uy * from + ny * w1)
    g.closePath()
  }
  castShadow(g, 1.6, 0.7, sk.shadow, () => {
    quad(-1, len + 1, -deck - rail, deck + rail)
    g.fill()
  })
  quad(-1, len + 1, -deck, deck)
  g.fillStyle = css(sk.wood)
  g.fill()
  g.strokeStyle = sk.woodLine
  g.lineWidth = 0.16
  g.globalAlpha = 0.55
  for (let k = 0; k < len + 1; k += 1.5) {
    g.beginPath()
    g.moveTo(sh.a.x + ux * k + nx * deck, sh.a.y + uy * k + ny * deck)
    g.lineTo(sh.a.x + ux * k - nx * deck, sh.a.y + uy * k - ny * deck)
    g.stroke()
  }
  g.globalAlpha = 1
  for (const side of [1, -1]) {
    quad(-1.5, len + 1.5, side * deck, side * (deck + rail))
    g.fillStyle = css(sk.woodLit)
    g.fill()
    g.strokeStyle = sk.woodLine
    g.lineWidth = 0.26
    g.stroke()
    g.fillStyle = css(mix(sk.wood, [0, 0, 0], 0.25))
    for (let k = -1; k <= len + 1; k += (len + 2) / Math.max(2, Math.round((len + 2) / 6))) {
      const cx = sh.a.x + ux * k + nx * side * (deck + rail / 2)
      const cy = sh.a.y + uy * k + ny * side * (deck + rail / 2)
      g.beginPath()
      g.arc(cx, cy, rail * 0.55, 0, Math.PI * 2)
      g.fill()
    }
  }
}

/** The tee: a mat of darker turf with a marker either side. */
function paintTee(g: Ctx, sk: Skin, tee: Vec) {
  g.beginPath()
  g.roundRect(tee.x - 6.5, tee.y - 4.2, 13, 8.4, 1.6)
  g.fillStyle = css(sk.mat)
  g.fill()
  g.strokeStyle = sk.matLine
  g.lineWidth = 0.28
  g.stroke()
  for (const side of [-1, 1]) {
    const x = tee.x + side * 4.6
    const y = tee.y - 2.3
    g.fillStyle = 'rgba(0, 0, 0, 0.25)'
    g.beginPath()
    g.arc(x + 0.25, y + 0.35, 0.8, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = sk.dark ? 'rgba(236, 242, 248, 0.95)' : 'rgba(255, 255, 255, 1)'
    g.strokeStyle = ink(sk, 0.45)
    g.lineWidth = 0.18
    g.beginPath()
    g.arc(x, y, 0.8, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }
}

/** A ramp: timber that rises to a lip, planked across, darker at the foot, and the lip's shadow past it. */
function paintRamp(g: Ctx, sk: Skin, rp: Ramp) {
  const dx = Math.cos(rp.dir)
  const dy = Math.sin(rp.dir)
  const cx = rp.x + rp.w / 2
  const cy = rp.y + rp.h / 2
  const half = (Math.abs(dx) * rp.w + Math.abs(dy) * rp.h) / 2
  const across = (Math.abs(dx) * rp.h + Math.abs(dy) * rp.w) / 2
  const px = -dy
  const py = dx
  const at = (k: number, m: number): Vec => ({ x: cx + dx * k + px * m, y: cy + dy * k + py * m })
  const box = (k0: number, k1: number, m0: number, m1: number) => {
    const a = at(k0, m0)
    const b = at(k1, m0)
    const c = at(k1, m1)
    const d = at(k0, m1)
    g.beginPath()
    g.moveTo(a.x, a.y)
    g.lineTo(b.x, b.y)
    g.lineTo(c.x, c.y)
    g.lineTo(d.x, d.y)
    g.closePath()
  }
  // The lip stands up: its shadow falls on whatever is past it.
  castShadow(g, 2.2, 0.8, sk.shadow, () => {
    box(half - 1.2, half, -across, across)
    g.fill()
  })
  box(-half, half, -across, across)
  const foot = at(-half, 0)
  const lip = at(half, 0)
  const grad = g.createLinearGradient(foot.x, foot.y, lip.x, lip.y)
  grad.addColorStop(0, css(mix(sk.wood, sk.green, 0.35)))
  grad.addColorStop(1, css(sk.woodLit))
  g.fillStyle = grad
  g.fill()
  g.strokeStyle = sk.woodLine
  g.lineWidth = 0.3
  g.stroke()
  g.globalAlpha = 0.5
  g.lineWidth = 0.16
  for (let k = -half + 1.6; k < half; k += 1.6) {
    const a = at(k, -across)
    const b = at(k, across)
    g.beginPath()
    g.moveTo(a.x, a.y)
    g.lineTo(b.x, b.y)
    g.stroke()
  }
  g.globalAlpha = 1
  // The lip itself, and arrows up the ramp.
  box(half - 0.9, half, -across, across)
  g.fillStyle = css(mix(sk.woodLit, [255, 255, 255], sk.dark ? 0.1 : 0.3))
  g.fill()
  g.stroke()
  g.strokeStyle = sk.woodLine
  g.lineWidth = 0.5
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const k of [-half * 0.45, half * 0.15]) {
    const tip = at(k + 1.4, 0)
    const l = at(k - 1.2, -2.4)
    const r = at(k - 1.2, 2.4)
    g.beginPath()
    g.moveTo(l.x, l.y)
    g.lineTo(tip.x, tip.y)
    g.lineTo(r.x, r.y)
    g.stroke()
  }
}

/**
 * A windmill's tower where it meets the ground: a stone ring with its two
 * doors, and the tunnel's floor running through it under the roof. The roof
 * and sails go over the ball, so they are drawn each frame.
 */
function paintTower(g: Ctx, sk: Skin, m: Mill) {
  const ux = Math.cos(m.dir)
  const uy = Math.sin(m.dir)
  const nx = -uy
  const ny = ux
  castShadow(g, 7, 1.6, sk.shadow, () => {
    g.beginPath()
    g.arc(m.x, m.y, m.r - 0.5, 0, Math.PI * 2)
    g.fill()
  })
  g.beginPath()
  g.arc(m.x, m.y, m.r, 0, Math.PI * 2)
  g.fillStyle = css(sk.stone)
  g.fill()
  g.strokeStyle = sk.stoneLine
  g.lineWidth = 0.34
  g.stroke()
  // Courses of stone round the ring.
  g.save()
  g.beginPath()
  g.arc(m.x, m.y, m.r, 0, Math.PI * 2)
  g.clip()
  g.strokeStyle = sk.stoneLine
  g.globalAlpha = 0.4
  g.lineWidth = 0.18
  for (const rr of [m.r - 0.9, m.r - 1.8]) {
    g.beginPath()
    g.arc(m.x, m.y, rr, 0, Math.PI * 2)
    g.stroke()
  }
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + (i % 2) * 0.06
    g.beginPath()
    g.moveTo(m.x + Math.cos(a) * (m.r - (i % 2 ? 0.9 : 0)), m.y + Math.sin(a) * (m.r - (i % 2 ? 0.9 : 0)))
    g.lineTo(m.x + Math.cos(a) * (m.r - (i % 2 ? 1.8 : 0.9)), m.y + Math.sin(a) * (m.r - (i % 2 ? 1.8 : 0.9)))
    g.stroke()
  }
  g.globalAlpha = 1
  g.restore()
  // The tunnel's floor, and its walls.
  const reach = m.r + 0.6
  const quad = (k0: number, k1: number, w0: number, w1: number) => {
    g.beginPath()
    g.moveTo(m.x + ux * k0 + nx * w0, m.y + uy * k0 + ny * w0)
    g.lineTo(m.x + ux * k1 + nx * w0, m.y + uy * k1 + ny * w0)
    g.lineTo(m.x + ux * k1 + nx * w1, m.y + uy * k1 + ny * w1)
    g.lineTo(m.x + ux * k0 + nx * w1, m.y + uy * k0 + ny * w1)
    g.closePath()
  }
  quad(-reach, reach, -m.door, m.door)
  g.fillStyle = css(mix(sk.green, [0, 0, 0], 0.28))
  g.fill()
  // A shadowed step into each door, and a post either side of it.
  for (const end of [-1, 1]) {
    const k0 = end * (m.r - 2.2)
    const k1 = end * (m.r + 0.4)
    quad(Math.min(k0, k1), Math.max(k0, k1), -m.door, m.door)
    g.fillStyle = css(mix(sk.green, [0, 0, 0], 0.45))
    g.fill()
    for (const side of [-1, 1]) {
      const p0 = end * (m.r - 2.6)
      const p1 = end * (m.r + 0.9)
      quad(Math.min(p0, p1), Math.max(p0, p1), side * m.door, side * (m.door + 1.5))
      g.fillStyle = css(sk.stoneLit)
      g.fill()
      g.strokeStyle = sk.stoneLine
      g.lineWidth = 0.26
      g.stroke()
    }
  }
}

/** The cup: a lip of lighter turf, the hole, and the white of its liner just inside the rim. */
function paintCup(g: Ctx, sk: Skin, c: Vec) {
  g.beginPath()
  g.arc(c.x, c.y, CUP_R * 1.5, 0, Math.PI * 2)
  g.fillStyle = css(sk.greenHi, 0.55)
  g.fill()
  const grad = g.createRadialGradient(c.x - CUP_R * 0.3, c.y - CUP_R * 0.35, 0, c.x, c.y, CUP_R)
  grad.addColorStop(0, 'rgba(8, 12, 16, 0.98)')
  grad.addColorStop(1, 'rgba(26, 34, 44, 0.98)')
  g.beginPath()
  g.arc(c.x, c.y, CUP_R, 0, Math.PI * 2)
  g.fillStyle = grad
  g.fill()
  // The liner catches the light on the far side of the hole.
  g.strokeStyle = 'rgba(245, 248, 252, 0.8)'
  g.lineWidth = 0.34
  g.beginPath()
  g.arc(c.x, c.y, CUP_R - 0.35, Math.PI * 0.05, Math.PI * 0.95)
  g.stroke()
  g.strokeStyle = css(sk.greenLo, 0.9)
  g.lineWidth = 0.3
  g.beginPath()
  g.arc(c.x, c.y, CUP_R, 0, Math.PI * 2)
  g.stroke()
}

/** A boulder standing on the green: as round as the ball finds it, lit from above, with its shadow. */
function paintRock(g: Ctx, sk: Skin, x: number, y: number, r: number) {
  const rnd = mulberry32(Math.round(x * 131 + y * 17))
  const p1 = rnd() * Math.PI * 2
  const p2 = rnd() * Math.PI * 2
  const outline = () => {
    g.beginPath()
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2
      const rr = r * (1 + 0.045 * Math.sin(3 * a + p1) + 0.03 * Math.sin(5 * a + p2))
      if (i === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
    g.closePath()
  }
  castShadow(g, r * 0.6, 0.8, sk.shadow, () => {
    outline()
    g.fill()
  })
  outline()
  g.fillStyle = css(sk.stone)
  g.fill()
  g.save()
  g.clip()
  g.fillStyle = css(mix(sk.stone, [0, 0, 0], 0.22))
  g.beginPath()
  g.arc(x + r * 0.35, y + r * 0.42, r * 0.95, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(sk.stone)
  g.beginPath()
  g.arc(x - r * 0.05, y - r * 0.05, r * 0.86, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(sk.stoneLit)
  g.beginPath()
  g.ellipse(x - r * 0.3, y - r * 0.34, r * 0.5, r * 0.36, -0.6, 0, Math.PI * 2)
  g.fill()
  g.restore()
  outline()
  g.strokeStyle = sk.stoneLine
  g.lineWidth = 0.3
  g.stroke()
  // A crack or two.
  g.lineWidth = 0.2
  g.globalAlpha = 0.6
  const a = rnd() * Math.PI * 2
  g.beginPath()
  g.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2)
  g.lineTo(x + Math.cos(a + 0.3) * r * 0.55, y + Math.sin(a + 0.3) * r * 0.55)
  g.lineTo(x + Math.cos(a + 0.1) * r * 0.85, y + Math.sin(a + 0.1) * r * 0.85)
  g.stroke()
  g.globalAlpha = 1
}

/** Everything that holds still, for the stretch of the hole from ya to yb. */
function paintGround(g: Ctx, hole: Hole, sk: Skin, ya: number, yb: number) {
  const len = hole.h
  const edges = edgesOf(hole)
  const garden = gardenOf(hole)
  const near = (y0: number, y1: number) => y1 > ya - 1 && y0 < yb + 1
  const nearShape = (sh: Shape) => {
    const b = boundsOf(sh)
    return near(b.y0 - 4, b.y1 + 4)
  }
  g.lineCap = 'round'
  g.lineJoin = 'round'

  // The garden's grass.
  g.fillStyle = css(sk.rough)
  g.fillRect(-4, ya - 1, FIELD_W + 8, yb - ya + 2)
  paintTufts(g, sk, ya, yb)
  for (const p of garden) if (near(p.y - p.r - 8, p.y + p.r + 8)) paintPropShadow(g, sk, p)

  // The course stands on the grass: its shadow, then its rail outside the edge, lit on the side facing the light.
  const green = () => loopsPath(g, edges)
  castShadow(g, 1.7, 1.4, sk.shadow, () => {
    green()
    g.fill('evenodd')
    g.lineWidth = RAIL_W * 2
    g.stroke()
  })
  green()
  g.strokeStyle = sk.railLine
  g.lineWidth = (RAIL_W + 0.34) * 2
  g.stroke()
  g.strokeStyle = css(sk.rail)
  g.lineWidth = RAIL_W * 2
  g.stroke()
  g.save()
  g.translate(-LIGHT.x * 0.55, -LIGHT.y * 0.55)
  green()
  g.strokeStyle = css(sk.railLit)
  g.lineWidth = RAIL_W * 1.05
  g.stroke()
  g.restore()

  // The green, mown in stripes, with its grain; the rail's shadow falls on it, and the rail covers its edge.
  g.save()
  green()
  g.clip('evenodd')
  g.fillStyle = css(sk.green)
  g.fillRect(-4, ya - 1, FIELD_W + 8, yb - ya + 2)
  g.fillStyle = css(sk.stripe)
  const band = 9
  for (let y = Math.floor(ya / (band * 2)) * band * 2; y < yb; y += band * 2) g.fillRect(-4, y, FIELD_W + 8, band)
  paintBlades(g, sk, ya, yb)
  for (const sl of hole.slopes) if (nearShape(sl.shape)) paintSlope(g, sk, sl, outlineOfShape(sl.shape, len))
  castShadow(g, 1.3, 1, sk.shadow, () => {
    green()
    g.lineWidth = EDGE_T * 2
    g.stroke()
  })
  green()
  g.strokeStyle = sk.railLine
  g.lineWidth = (EDGE_T + 0.34) * 2
  g.stroke()
  g.strokeStyle = css(sk.rail)
  g.lineWidth = EDGE_T * 2
  g.stroke()
  g.restore()

  if (hole.sand.some(nearShape)) paintSand(g, sk, outlineOf(hole.sand, len))
  if (hole.water.some(nearShape)) paintWater(g, sk, outlineOf(hole.water, len))
  for (const p of garden) {
    if ((p.kind === 'lily' || p.kind === 'reeds') && near(p.y - p.r - 2, p.y + p.r + 2)) paintProp(g, sk, p)
  }
  for (const sh of hole.bridges) if (nearShape(sh)) paintBridge(g, sk, sh)
  if (near(hole.tee.y - 6, hole.tee.y + 6)) paintTee(g, sk, hole.tee)
  for (const rp of hole.ramps) if (near(rp.y - 4, rp.y + rp.h + 4)) paintRamp(g, sk, rp)
  for (const rk of hole.rocks) if (near(rk.y - rk.r - 4, rk.y + rk.r + 4)) paintRock(g, sk, rk.x, rk.y, rk.r)
  for (const m of hole.mills) if (near(m.y - m.r - 12, m.y + m.r + 12)) paintTower(g, sk, m)
  if (!hole.cupPath && near(hole.cup.y - 5, hole.cup.y + 5)) paintCup(g, sk, hole.cup)

  // Placed walls: timber bars like the rail, kickers in red, flaps in teal.
  for (const wall of hole.walls) {
    if (wall.hidden || !near(Math.min(wall.a.y, wall.b.y) - 3, Math.max(wall.a.y, wall.b.y) + 3)) continue
    g.beginPath()
    g.moveTo(wall.a.x, wall.a.y)
    g.lineTo(wall.b.x, wall.b.y)
    g.strokeStyle = wall.kick ? sk.line('red') : wall.pass !== undefined ? sk.line('teal') : sk.railLine
    g.lineWidth = wall.t * 2 + 0.6
    g.stroke()
    g.strokeStyle = wall.kick ? css(mix(sk.field, [232, 86, 79], 0.45)) : wall.pass !== undefined ? css(mix(sk.field, [62, 200, 207], 0.4)) : css(sk.rail)
    g.lineWidth = wall.t * 2
    g.stroke()
  }

  // The garden over everything else: bushes, flowers, stones and the trees.
  for (const p of garden) {
    if (p.kind === 'lily' || p.kind === 'reeds') continue
    if (near(p.y - p.r - 1, p.y + p.r + 1)) paintProp(g, sk, p)
  }
}

/* ---------- the strips ---------- */

type Strip = { canvas: Layer; r0: number; px: number }
let strips: { key: string; map: Map<number, Strip> } = { key: '', map: new Map() }

function makeLayer(w: number, h: number): Layer | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** The painted strip `i` of a hole at `k` device pixels a unit, painting it if it is not already. */
function stripFor(hole: Hole, sk: Skin, i: number, k: number): Strip | null {
  const key = `${hole.name}|${sk.key}|${k.toFixed(4)}`
  if (strips.key !== key) strips = { key, map: new Map() }
  const known = strips.map.get(i)
  if (known) return known
  const r0 = Math.floor((i * TILE - BLEED) * k)
  const r1 = Math.ceil(((i + 1) * TILE + BLEED) * k)
  const W = Math.ceil(FIELD_W * k)
  const canvas = makeLayer(W, r1 - r0)
  const g = canvas?.getContext('2d') as Ctx | null | undefined
  if (!canvas || !g) return null
  g.setTransform(k, 0, 0, k, 0, -r0)
  paintGround(g, hole, sk, r0 / k, r1 / k)
  const strip: Strip = { canvas, r0, px: W * (r1 - r0) }
  strips.map.set(i, strip)
  let total = 0
  for (const s of strips.map.values()) total += s.px
  while (total > TILE_BUDGET && strips.map.size > 1) {
    let far = i
    for (const j of strips.map.keys()) if (Math.abs(j - i) > Math.abs(far - i)) far = j
    if (far === i) break
    total -= strips.map.get(far)!.px
    strips.map.delete(far)
  }
  return strip
}

/* ---------- what moves ---------- */

type Flow = { pts: Vec[]; at: number[]; total: number }
const flows = new WeakMap<Shape, Flow>()

function flowOf(sh: Extract<Shape, { kind: 'ribbon' }>): Flow {
  let f = flows.get(sh)
  if (f) return f
  const at = [0]
  for (let i = 1; i < sh.pts.length; i++) {
    at.push(at[i - 1]! + Math.hypot(sh.pts[i]!.x - sh.pts[i - 1]!.x, sh.pts[i]!.y - sh.pts[i - 1]!.y))
  }
  f = { pts: sh.pts, at, total: at[at.length - 1]! }
  flows.set(sh, f)
  return f
}

/** Glints on the water, running with a stream the way it was drawn, drifting on a pond. */
function drawGlints(g: Ctx, sk: Skin, hole: Hole, clock: number, ya: number, yb: number) {
  const inView = hole.water.filter((sh) => {
    const b = boundsOf(sh)
    return b.y1 > ya && b.y0 < yb
  })
  if (!inView.length) return
  g.save()
  loopsPath(g, outlineOf(hole.water, hole.h))
  g.clip('evenodd')
  g.strokeStyle = sk.waterGlint
  g.lineCap = 'round'
  g.lineWidth = 0.32
  for (const sh of inView) {
    if (sh.kind === 'ribbon') {
      const flow = flowOf(sh)
      const n = Math.floor(flow.total / 3.2)
      let seg = 0
      for (let j = 0; j < n; j++) {
        const u = (j * 3.2 + clock * 6 + (j % 3) * 1.1) % flow.total
        while (seg > 0 && flow.at[seg]! > u) seg--
        while (seg < flow.at.length - 2 && flow.at[seg + 1]! < u) seg++
        const a = flow.pts[seg]!
        const b = flow.pts[seg + 1]!
        const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const tx = (b.x - a.x) / l
        const ty = (b.y - a.y) / l
        const t = (u - flow.at[seg]!) / l
        const side = ((((j * 0.618) % 1) + 1) % 1) * 2 - 1
        const x = a.x + (b.x - a.x) * t - ty * side * sh.r * 0.72
        const y = a.y + (b.y - a.y) * t + tx * side * sh.r * 0.72
        if (y < ya - 2 || y > yb + 2) continue
        // Not on a bridge's deck: the water runs under it.
        if (hole.bridges.length && inAny(hole.bridges, { x, y })) continue
        const pulse = 0.5 + 0.5 * Math.sin(clock * 2.1 + j * 1.7)
        const dash = 0.9 + (j % 3) * 0.7
        g.globalAlpha = 0.25 + 0.65 * pulse
        g.beginPath()
        g.moveTo(x - tx * dash, y - ty * dash)
        g.lineTo(x + tx * dash, y + ty * dash)
        g.stroke()
      }
      seg = 0
    } else {
      const b = boundsOf(sh)
      for (let y = b.y0 + 2; y < b.y1; y += 2.6) {
        for (let x = b.x0 + ((y * 3.1) % 5); x < b.x1; x += 6) {
          const pulse = 0.5 + 0.5 * Math.sin(clock * 1.7 + x * 0.7 + y)
          g.globalAlpha = 0.2 + 0.6 * pulse
          const dx = x + Math.sin(clock * 0.6 + y) * 1.2
          g.beginPath()
          g.moveTo(dx - 1, y)
          g.lineTo(dx + 1, y)
          g.stroke()
        }
      }
    }
  }
  g.globalAlpha = 1
  g.restore()
}

/** A windmill's sail as a shape: a lattice frame on a spar, from near the hub out to the tip. */
function sailShape(g: Ctx, m: Mill, a: number, from: number, width: number) {
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  const nx = -uy
  const ny = ux
  g.beginPath()
  g.moveTo(m.x + ux * from + nx * width * 0.2, m.y + uy * from + ny * width * 0.2)
  g.lineTo(m.x + ux * m.reach + nx * width * 0.2, m.y + uy * m.reach + ny * width * 0.2)
  g.lineTo(m.x + ux * m.reach - nx * width, m.y + uy * m.reach - ny * width)
  g.lineTo(m.x + ux * from - nx * width, m.y + uy * from - ny * width)
  g.closePath()
}

function sailAngles(m: Mill, clock: number) {
  const base = m.phase + m.speed * clock
  return Array.from({ length: m.sails }, (_, k) => base + (k * Math.PI * 2) / m.sails)
}

/** The sails' shadows on the ground: they are high up, so they fall well off to the side. */
function drawSailShadows(g: Ctx, sk: Skin, m: Mill, clock: number) {
  g.save()
  g.translate(LIGHT.x * 5, LIGHT.y * 5)
  g.fillStyle = sk.shadow
  g.globalAlpha = 0.7
  for (const a of sailAngles(m, clock)) {
    sailShape(g, m, a, 3, SAIL_T * 1.25)
    g.fill()
  }
  g.restore()
}

/** The roof over the tower, and the sails turning on it. A ball in the tunnel shows through the roof. */
function drawMillTop(g: Ctx, sk: Skin, m: Mill, clock: number, ballUnder: boolean) {
  const R = m.r - 1.9
  g.save()
  if (ballUnder) g.globalAlpha = 0.42
  const grad = g.createLinearGradient(m.x - R, m.y - R, m.x + R, m.y + R)
  grad.addColorStop(0, css(sk.roofLit))
  grad.addColorStop(0.55, css(sk.roof))
  grad.addColorStop(1, css(sk.roofShade))
  g.beginPath()
  g.arc(m.x, m.y, R, 0, Math.PI * 2)
  g.fillStyle = grad
  g.fill()
  g.strokeStyle = sk.roofLine
  g.lineWidth = 0.34
  g.stroke()
  // Shingles: seams running to the peak, and rings round it.
  g.globalAlpha *= 0.5
  g.lineWidth = 0.2
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    g.beginPath()
    g.moveTo(m.x + Math.cos(a) * 2, m.y + Math.sin(a) * 2)
    g.lineTo(m.x + Math.cos(a) * R, m.y + Math.sin(a) * R)
    g.stroke()
  }
  for (const k of [0.4, 0.7]) {
    g.beginPath()
    g.arc(m.x, m.y, R * k, 0, Math.PI * 2)
    g.stroke()
  }
  g.restore()

  // The sails, then the hub they turn on.
  for (const a of sailAngles(m, clock)) {
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const nx = -uy
    const ny = ux
    sailShape(g, m, a, 4.5, SAIL_T * 1.25)
    g.fillStyle = css(sk.sail, 0.92)
    g.fill()
    g.strokeStyle = sk.sailLine
    g.lineWidth = 0.26
    g.lineJoin = 'round'
    g.stroke()
    // The lattice across the sail.
    g.lineWidth = 0.16
    for (let k = 4.5 + 2.6; k < m.reach - 0.5; k += 2.6) {
      g.beginPath()
      g.moveTo(m.x + ux * k + nx * SAIL_T * 0.25, m.y + uy * k + ny * SAIL_T * 0.25)
      g.lineTo(m.x + ux * k - nx * SAIL_T * 1.25, m.y + uy * k - ny * SAIL_T * 1.25)
      g.stroke()
    }
    // The spar.
    g.strokeStyle = css(mix(sk.wood, [0, 0, 0], sk.dark ? 0.1 : 0.3))
    g.lineWidth = 0.55
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(m.x, m.y)
    g.lineTo(m.x + ux * (m.reach + 0.3), m.y + uy * (m.reach + 0.3))
    g.stroke()
  }
  g.beginPath()
  g.arc(m.x, m.y, 1.6, 0, Math.PI * 2)
  g.fillStyle = css(sk.wood)
  g.fill()
  g.strokeStyle = sk.woodLine
  g.lineWidth = 0.3
  g.stroke()
}

/** The ball's recent path, for the streak behind a fast one. Kept here: it is only for looking at. */
let trail: Vec[] = []

/** Everything left over from older holes' pieces that move: pads, bare blades, sliders, pipes, bumpers, rovers. */
function drawMovingPieces(g: Ctx, sk: Skin, state: GameState, hole: Hole) {
  const clock = state.clock
  for (const pad of hole.boosts) {
    g.beginPath()
    g.roundRect(pad.x, pad.y, pad.w, pad.h, 1.5)
    g.fillStyle = css(mix(sk.field, [245, 185, 66], 0.35), 0.9)
    g.fill()
    g.strokeStyle = sk.line('amber')
    g.lineWidth = 0.3
    g.stroke()
    const dx = Math.cos(pad.dir)
    const dy = Math.sin(pad.dir)
    const cx = pad.x + pad.w / 2
    const cy = pad.y + pad.h / 2
    const along = Math.abs(dx) * pad.w + Math.abs(dy) * pad.h
    const off = (clock * 12) % 6
    g.lineWidth = 0.6
    for (let k = -along / 2 + off; k < along / 2 - 2; k += 6) {
      const x = cx + dx * (k + 2)
      const y = cy + dy * (k + 2)
      g.beginPath()
      g.moveTo(x - dx * 2 - dy * 2, y - dy * 2 + dx * 2)
      g.lineTo(x, y)
      g.lineTo(x - dx * 2 + dy * 2, y - dy * 2 - dx * 2)
      g.stroke()
    }
  }
  for (const db of hole.drawbridges) {
    const level = bridgeLevel(db, clock)
    const loops = outlineOfShape(db.shape, hole.h)
    loopsPath(g, loops)
    g.fillStyle = css(sk.wood, 0.25 + 0.7 * level)
    g.fill('evenodd')
    g.strokeStyle = sk.woodLine
    g.lineWidth = 0.3
    if (level < 1) g.setLineDash([1.2, 1.2])
    g.stroke()
    g.setLineDash([])
  }
  for (const sl of hole.sliders) {
    const bar = sliderWall(sl, clock)
    g.lineCap = 'round'
    g.strokeStyle = sk.railLine
    g.lineWidth = sl.t * 2 + 0.6
    g.beginPath()
    g.moveTo(bar.a.x, bar.a.y)
    g.lineTo(bar.b.x, bar.b.y)
    g.stroke()
    g.strokeStyle = css(sk.rail)
    g.lineWidth = sl.t * 2
    g.stroke()
  }
  for (const sp of hole.spinners) {
    const blade = spinnerWall(sp, clock)
    g.lineCap = 'round'
    g.strokeStyle = sk.woodLine
    g.lineWidth = SPINNER_T * 2 + 0.5
    g.beginPath()
    g.moveTo(blade.a.x, blade.a.y)
    g.lineTo(blade.b.x, blade.b.y)
    g.stroke()
    g.strokeStyle = css(sk.wood)
    g.lineWidth = SPINNER_T * 2
    g.stroke()
    g.fillStyle = css(sk.roof)
    g.beginPath()
    g.arc(sp.x, sp.y, 2.2, 0, Math.PI * 2)
    g.fill()
  }
  for (const pipe of hole.portals) {
    for (const [p, out] of [
      [pipe.a, false],
      [pipe.b, true],
    ] as const) {
      g.beginPath()
      g.arc(p.x, p.y, PORTAL_R, 0, Math.PI * 2)
      g.fillStyle = out ? css(sk.stone) : 'rgba(10, 14, 20, 0.9)'
      g.fill()
      g.strokeStyle = sk.line('violet')
      g.lineWidth = 0.5
      g.stroke()
    }
  }
  hole.bumpers.forEach((b, i) => {
    const flash = state.bumperFlash[i] ?? 0
    const r = b.r * (flash > 0 ? 1 + 0.18 * (flash / 0.35) : 1)
    g.beginPath()
    g.arc(b.x, b.y, r, 0, Math.PI * 2)
    g.fillStyle = css(mix(sk.field, [232, 86, 79], flash > 0 ? 0.7 : 0.45))
    g.fill()
    g.strokeStyle = sk.line('red')
    g.lineWidth = 0.4
    g.stroke()
  })
  hole.rovers.forEach((spec, i) => {
    const rv = state.rovers[i]
    if (!rv) return
    g.beginPath()
    g.arc(rv.x, rv.y, spec.r, 0, Math.PI * 2)
    g.fillStyle = css(mix(sk.field, [242, 129, 58], 0.7))
    g.fill()
    g.strokeStyle = sk.line('orange')
    g.lineWidth = 0.35
    g.stroke()
  })
}

/** Rings and drops where the ball went in. */
function drawSplashes(g: Ctx, sk: Skin, state: GameState) {
  for (const fl of state.floaters) {
    if (fl.text !== 'SPLASH') continue
    const u = 1 - fl.life
    const x = fl.x
    const y = fl.y + 3
    g.strokeStyle = sk.waterGlint
    for (let i = 0; i < 3; i++) {
      const k = u - i * 0.14
      if (k <= 0) continue
      g.globalAlpha = Math.max(0, 1 - k) * 0.9
      g.lineWidth = 0.4
      g.beginPath()
      g.arc(x, y, 1 + k * 9, 0, Math.PI * 2)
      g.stroke()
    }
    g.fillStyle = sk.waterGlint
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4
      const d = 1.5 + u * 6
      g.globalAlpha = Math.max(0, 1 - u * 1.4)
      g.beginPath()
      g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d - Math.sin(u * Math.PI) * 3, 0.45, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
  }
}

const CONFETTI = ['#f5b942', '#e8564f', '#e85d9a', '#8a6ad4', '#4aa8e8', '#3ecf8e', '#3ec8cf', '#f2813a']

/** A burst of the palette over the cup as the ball drops. */
function drawConfetti(g: Ctx, cup: Vec, t: number) {
  if (t > 1.6) return
  const rnd = mulberry32(99)
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2
    const v = 10 + rnd() * 16
    const d = v * (1 - Math.exp(-t * 3)) / 1.3
    const x = cup.x + Math.cos(a) * d
    const y = cup.y + Math.sin(a) * d
    const spin = t * (4 + rnd() * 6) + rnd() * 6
    g.save()
    g.globalAlpha = Math.max(0, 1 - t / 1.6)
    g.translate(x, y)
    g.rotate(spin)
    g.fillStyle = CONFETTI[i % CONFETTI.length]!
    g.fillRect(-0.55, -0.3 * Math.abs(Math.cos(spin * 1.3)) - 0.1, 1.1, 0.6 * Math.abs(Math.cos(spin * 1.3)) + 0.2)
    g.restore()
  }
}

/* ---------- the map ---------- */

/**
 * The map: the whole hole, small, in the corner of the window nearest the
 * cup. Enough to plan a route by: the green, water, sand, bridges, ramps,
 * windmills, the cup, the ball, and the part of the hole the window shows.
 */
function drawMap(ctx: CanvasRenderingContext2D, state: GameState, hole: Hole, f: Frame, sk: Skin, dpr: number, cam: number) {
  const len = hole.h
  const layout = mapLayout(f, len, state.mapSide)
  const { x: mx, y: my, w: mw, h: mh, k } = layout
  const ballOnScreen = f.rotated
    ? { x: f.x + (cam + f.vis - state.ball.y) * f.s, y: f.y + state.ball.x * f.s }
    : { x: f.x + state.ball.x * f.s, y: f.y + (state.ball.y - cam) * f.s }
  const faded = state.phase !== 'gameover' && underMap(layout, ballOnScreen.x, ballOnScreen.y)

  ctx.save()
  if (faded) ctx.globalAlpha = 0.3
  ctx.fillStyle = css(sk.field, 0.9)
  ctx.strokeStyle = ink(sk, 0.22)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(mx - 4, my - 4, mw + 8, mh + 8, 6)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(mx - 2, my - 2, mw + 4, mh + 4, 4)
  ctx.clip()
  if (f.rotated) ctx.setTransform(0, k * dpr, -k * dpr, 0, (mx + len * k) * dpr, my * dpr)
  else ctx.setTransform(k * dpr, 0, 0, k * dpr, mx * dpr, my * dpr)
  const px = 1 / k

  ctx.fillStyle = css(sk.rough)
  ctx.fillRect(-2, -2, FIELD_W + 4, len + 4)
  loopsPath(ctx, edgesOf(hole))
  ctx.fillStyle = css(mix(sk.green, sk.stripe, 0.5))
  ctx.fill('evenodd')
  ctx.strokeStyle = sk.railLine
  ctx.lineWidth = 1.1 * px
  ctx.stroke()
  if (hole.sand.length) {
    loopsPath(ctx, outlineOf(hole.sand, len))
    ctx.fillStyle = css(sk.sand)
    ctx.fill('evenodd')
  }
  if (hole.water.length) {
    loopsPath(ctx, outlineOf(hole.water, len))
    ctx.fillStyle = css(mix(sk.water, sk.waterEdge, 0.4))
    ctx.fill('evenodd')
  }
  ctx.fillStyle = css(sk.woodLit)
  for (const sh of hole.bridges) {
    loopsPath(ctx, outlineOfShape(sh, len))
    ctx.fill('evenodd')
  }
  for (const rp of hole.ramps) ctx.fillRect(rp.x, rp.y, rp.w, rp.h)
  for (const m of hole.mills) {
    ctx.beginPath()
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
    ctx.fillStyle = css(sk.roof)
    ctx.fill()
    ctx.strokeStyle = css(sk.sail)
    ctx.lineWidth = 1.4 * px
    for (const a of sailAngles(m, state.clock)) {
      ctx.beginPath()
      ctx.moveTo(m.x, m.y)
      ctx.lineTo(m.x + Math.cos(a) * m.reach, m.y + Math.sin(a) * m.reach)
      ctx.stroke()
    }
  }
  ctx.fillStyle = css(sk.stone)
  for (const rk of hole.rocks) {
    ctx.beginPath()
    ctx.arc(rk.x, rk.y, rk.r, 0, Math.PI * 2)
    ctx.fill()
  }
  const dot = (p: Vec, r: number) => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  }
  dot(cupAt(hole, state.clock), Math.max(2 * px, CUP_R))
  ctx.fillStyle = 'rgba(12, 16, 22, 0.95)'
  ctx.fill()
  if (state.phase !== 'gameover') {
    dot(state.ball, Math.max(2.4 * px, BALL_R * 1.6))
    ctx.fillStyle = 'rgba(248, 250, 252, 1)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(12, 16, 22, 0.8)'
    ctx.lineWidth = px
    ctx.stroke()
  }
  if (f.vis < len) {
    ctx.strokeStyle = ink(sk, 0.8)
    ctx.lineWidth = 1.3 * px
    ctx.strokeRect(0, cam, FIELD_W, f.vis)
  }
  ctx.restore()
}

/* ---------- the frame ---------- */

function drawBackground(ctx: CanvasRenderingContext2D, sk: Skin, w: number, h: number) {
  ctx.fillStyle = css(sk.field)
  ctx.fillRect(0, 0, w, h)
  const step = 26 * Math.max(0.7, Math.min(w, h) / 540)
  // The dots as one path, filled once: one fill each was most of a frame.
  ctx.fillStyle = 'rgba(74, 168, 232, 0.09)'
  ctx.beginPath()
  for (let py = step * 0.5; py < h; py += step) {
    for (let px = step * 0.5; px < w; px += step) {
      ctx.moveTo(px + 1.1, py)
      ctx.arc(px, py, 1.1, 0, Math.PI * 2)
    }
  }
  ctx.fill()
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const sk = skin()
  drawBackground(ctx, sk, w, h)

  const hole = currentHole(state)
  const f = fieldFrame(w, h, hole.h)
  const k = f.s * dpr
  // The camera, snapped to whole device pixels, so the painted strips land square on the screen.
  const camPx = Math.round(state.cam * k)
  const cam = camPx / k
  const M = f.rotated
    ? { a: 0, b: k, c: -k, d: 0, e: Math.round(f.x * dpr + (cam + f.vis) * k), f: Math.round(f.y * dpr) }
    : { a: k, b: 0, c: 0, d: k, e: Math.round(f.x * dpr), f: Math.round(f.y * dpr) - camPx }
  const toScr = (p: Vec): Vec => ({ x: (M.a * p.x + M.c * p.y + M.e) / dpr, y: (M.b * p.x + M.d * p.y + M.f) / dpr })
  const ya = cam - 2
  const yb = cam + f.vis + 2
  const font = (size: number, weight = 800) => `${weight} ${size}px Outfit, system-ui, sans-serif`
  const textScale = Math.min(w, h)

  // ---- the field, through its window
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(f.x, f.y, f.w, f.h, Math.min(18, f.s * 3))
  ctx.clip()
  ctx.setTransform(M.a, M.b, M.c, M.d, M.e, M.f)
  const last = Math.floor((hole.h - 0.001) / TILE)
  for (let i = Math.max(0, Math.floor(ya / TILE)); i <= Math.min(last, Math.floor(yb / TILE)); i++) {
    const strip = stripFor(hole, sk, i, k)
    if (strip) ctx.drawImage(strip.canvas, 0, strip.r0 / k, strip.canvas.width / k, strip.canvas.height / k)
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  drawGlints(ctx, sk, hole, state.clock, ya, yb)
  drawMovingPieces(ctx, sk, state, hole)
  if (hole.cupPath) paintCup(ctx, sk, cupAt(hole, state.clock))
  const millsInView = hole.mills.filter((m) => m.y + m.reach + 8 > ya && m.y - m.reach - 8 < yb)
  for (const m of millsInView) drawSailShadows(ctx, sk, m, state.clock)

  // ---- aim: dots the way the shot will go, longer and redder the harder the pull, and the pull behind the ball.
  if (state.phase === 'aim') {
    const live = state.aiming !== 'none'
    const power = live ? state.power : 0
    const reach = live ? Math.max(AIM_STUB, power * GUIDE_REACH) : AIM_STUB
    const end = aimTrace(state, state.aim, reach)
    const b = state.ball
    const dx = end.x - b.x
    const dy = end.y - b.y
    const dist = Math.hypot(dx, dy)
    ctx.save()
    if (live) {
      const grad = ctx.createLinearGradient(b.x, b.y, end.x, end.y)
      grad.addColorStop(0, 'hsla(48, 92%, 60%, 0.95)')
      grad.addColorStop(1, 'hsla(4, 82%, 58%, 0.98)')
      ctx.fillStyle = grad
      for (let d = 3.2; d < dist - 0.5; d += 2.2) {
        const t = d / Math.max(1, dist)
        ctx.beginPath()
        ctx.arc(b.x + (dx / dist) * d, b.y + (dy / dist) * d, 0.42 + 0.3 * t, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(end.x, end.y, 1.15, 0, Math.PI * 2)
      ctx.fillStyle = 'hsla(4, 82%, 58%, 0.98)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.lineWidth = 0.3
      ctx.stroke()
      const back = Math.atan2(dy, dx) + Math.PI
      const pull = power * MAX_DRAG * 0.5
      ctx.strokeStyle = `hsla(${48 - power * 44}, 85%, 58%, 0.4)`
      ctx.lineWidth = 1.3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(b.x + Math.cos(back) * (BALL_R + 0.6), b.y + Math.sin(back) * (BALL_R + 0.6))
      ctx.lineTo(b.x + Math.cos(back) * (BALL_R + 0.6 + pull), b.y + Math.sin(back) * (BALL_R + 0.6 + pull))
      ctx.stroke()
    } else if (dist > 0.5) {
      ctx.fillStyle = ink(sk, 0.55)
      for (let d = 3.2; d < dist - 2.5; d += 2.2) {
        ctx.beginPath()
        ctx.arc(b.x + (dx / dist) * d, b.y + (dy / dist) * d, 0.36, 0, Math.PI * 2)
        ctx.fill()
      }
      const a = Math.atan2(dy, dx)
      const tip = { x: b.x + Math.cos(a) * Math.min(dist, 8), y: b.y + Math.sin(a) * Math.min(dist, 8) }
      ctx.beginPath()
      ctx.moveTo(tip.x + Math.cos(a) * 1.8, tip.y + Math.sin(a) * 1.8)
      ctx.lineTo(tip.x + Math.cos(a + 2.4) * 1.5, tip.y + Math.sin(a + 2.4) * 1.5)
      ctx.lineTo(tip.x + Math.cos(a - 2.4) * 1.5, tip.y + Math.sin(a - 2.4) * 1.5)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  // ---- the ball. A fast one leaves a streak; in the air it rises off its shadow.
  const inPlay = state.phase !== 'menu' && state.phase !== 'gameover' && state.drop > 0
  const speed = Math.hypot(state.ball.vx, state.ball.vy)
  if (state.phase === 'roll' && state.air === 0) {
    const lastPt = trail[trail.length - 1]
    if (!lastPt || Math.hypot(lastPt.x - state.ball.x, lastPt.y - state.ball.y) > 0.6) trail.push({ x: state.ball.x, y: state.ball.y })
    if (trail.length > 9) trail = trail.slice(-9)
  } else {
    trail = []
  }
  const under = millOver(hole, state.ball)
  if (inPlay) {
    const b = state.ball
    if (trail.length > 1 && speed > 45) {
      const strength = Math.min(1, (speed - 45) / 120)
      for (let i = 1; i < trail.length; i++) {
        const t = i / trail.length
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 * t * strength})`
        ctx.lineWidth = BALL_R * 1.6 * t
        ctx.beginPath()
        ctx.moveTo(trail[i - 1]!.x, trail[i - 1]!.y)
        ctx.lineTo(trail[i]!.x, trail[i]!.y)
        ctx.stroke()
      }
    }
    const flying = state.air > 0 && state.airMax > 0
    const lift = flying ? Math.sin(Math.PI * (1 - state.air / state.airMax)) : 0
    const r = BALL_R * state.drop * (1 + 0.5 * lift)
    // The shadow falls away from the light, further the higher the ball.
    const sx = b.x + LIGHT.x * (0.6 + lift * 7)
    const sy = b.y + LIGHT.y * (0.6 + lift * 7)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.3 - lift * 0.12})`
    ctx.beginPath()
    ctx.ellipse(sx, sy, BALL_R * state.drop * (1 - lift * 0.2), BALL_R * state.drop * 0.85 * (1 - lift * 0.2), 0, 0, Math.PI * 2)
    ctx.fill()
    const grad = ctx.createRadialGradient(b.x - r * 0.38, b.y - r * 0.42, r * 0.08, b.x, b.y, r)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.62, state.inSand ? 'rgba(240, 232, 216, 1)' : 'rgba(238, 242, 246, 1)')
    grad.addColorStop(1, state.inSand ? 'rgba(190, 178, 158, 1)' : 'rgba(178, 188, 200, 1)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(16, 24, 32, 0.55)'
    ctx.lineWidth = 0.28
    ctx.stroke()
  }

  // ---- windmills over the ball: the roof it runs under, and the sails
  for (const m of millsInView) drawMillTop(ctx, sk, m, state.clock, inPlay && under === m)

  drawSplashes(ctx, sk, state)
  const cupNow = cupAt(hole, state.clock)
  if (state.phase === 'sunk') drawConfetti(ctx, cupNow, state.t)

  // ---- the flag, standing up the screen whichever way the field lies; its pole's shadow on the green
  const flagShows = cupNow.y > ya - 12 && cupNow.y < yb + 12
  if (flagShows) {
    ctx.strokeStyle = sk.shadow
    ctx.lineWidth = 0.45
    ctx.beginPath()
    ctx.moveTo(cupNow.x, cupNow.y)
    ctx.lineTo(cupNow.x + LIGHT.x * 8, cupNow.y + LIGHT.y * 8)
    ctx.stroke()
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (flagShows) {
    const c = toScr(cupNow)
    const s = f.s
    const top = c.y - s * 10
    ctx.strokeStyle = sk.dark ? 'rgba(236, 240, 245, 0.95)' : 'rgba(40, 52, 64, 0.9)'
    ctx.lineWidth = Math.max(1.2, s * 0.45)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(c.x, c.y)
    ctx.lineTo(c.x, top)
    ctx.stroke()
    // The cloth, rippling.
    const flagW = s * 6
    const flagH = s * 3.4
    ctx.beginPath()
    ctx.moveTo(c.x, top)
    const steps = 8
    for (let i = 1; i <= steps; i++) {
      const u = i / steps
      ctx.lineTo(c.x + flagW * u, top + Math.sin(state.clock * 5 - u * 4) * s * 0.45 * u)
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps
      ctx.lineTo(c.x + flagW * u, top + flagH * (1 - u * 0.12) + Math.sin(state.clock * 5 - u * 4) * s * 0.45 * u)
    }
    ctx.closePath()
    ctx.fillStyle = sk.dark ? 'hsla(4, 70%, 60%, 0.96)' : 'hsla(4, 72%, 56%, 0.96)'
    ctx.fill()
    ctx.strokeStyle = sk.line('red', 0.9)
    ctx.lineWidth = Math.max(1, s * 0.25)
    ctx.stroke()
  }

  // ---- the ball off the edge of the view: a marker on the window's edge says which way it is
  const ballScr = toScr(state.ball)
  const ballOff = ballScr.x < f.x || ballScr.x > f.x + f.w || ballScr.y < f.y || ballScr.y > f.y + f.h
  if (inPlay && ballOff) {
    const r = BALL_R * f.s
    const m = r + 8
    const ex = Math.max(f.x + m, Math.min(f.x + f.w - m, ballScr.x))
    const ey = Math.max(f.y + m, Math.min(f.y + f.h - m, ballScr.y))
    ctx.fillStyle = 'rgba(245, 247, 250, 0.98)'
    ctx.strokeStyle = ink(sk, 0.7)
    ctx.lineWidth = Math.max(1.2, f.s * 0.5)
    ctx.beginPath()
    ctx.arc(ex, ey, r * 1.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const a = Math.atan2(ballScr.y - ey, ballScr.x - ex)
    ctx.fillStyle = ink(sk, 0.8)
    ctx.beginPath()
    ctx.moveTo(ex + Math.cos(a) * (r * 1.2 + 6), ey + Math.sin(a) * (r * 1.2 + 6))
    ctx.lineTo(ex + Math.cos(a + 2.3) * (r * 1.2 + 2), ey + Math.sin(a + 2.3) * (r * 1.2 + 2))
    ctx.lineTo(ex + Math.cos(a - 2.3) * (r * 1.2 + 2), ey + Math.sin(a - 2.3) * (r * 1.2 + 2))
    ctx.closePath()
    ctx.fill()
  }

  // ---- words rising from where something happened: a splash, or out of bounds
  for (const fl of state.floaters) {
    const c = toScr(fl)
    const rise = (0.9 - fl.life) * f.s * 6
    const alpha = Math.min(1, fl.life / 0.3)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(11, f.s * 4.2), 800)
    ctx.fillStyle = fl.text === 'SPLASH' ? sk.line('sky', alpha) : ink(sk, 0.85 * alpha)
    ctx.fillText(fl.text, c.x, c.y - rise)
  }
  ctx.restore()

  // ---- the map, in its corner
  if (state.phase !== 'menu') drawMap(ctx, state, hole, f, sk, dpr, cam)

  // ---- the band above: hole, par and strokes
  if (state.phase !== 'menu') {
    const holeNo = Math.min(state.holeIndex + 1, COURSE.length)
    const inset = Math.max(w * 0.12, 56)
    const cy = f.top * 0.55
    const left = `HOLE ${holeNo}`
    const strokeWord = state.strokes === 1 ? 'STROKE' : 'STROKES'
    const best = state.holeBests[hole.name]
    const withBest = best !== undefined ? `PAR ${hole.par}  ·  BEST ${best}  ·  ${state.strokes} ${strokeWord}` : null
    const plain = `PAR ${hole.par}  ·  ${state.strokes} ${strokeWord}`
    // The two labels share one line: a size that fits both, and the best only if there is room for it.
    let leftSize = Math.max(12, textScale * 0.035)
    let rightSize = Math.max(11, textScale * 0.03)
    let right = withBest ?? plain
    const room = w - inset * 2 - 12
    const fits = () => {
      ctx.font = font(leftSize, 800)
      const a = ctx.measureText(left).width
      ctx.font = font(rightSize, 750)
      return a + ctx.measureText(right).width <= room
    }
    if (!fits() && withBest) right = plain
    for (let i = 0; i < 3 && !fits(); i++) {
      leftSize *= 0.85
      rightSize *= 0.85
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = font(leftSize, 800)
    ctx.fillStyle = ink(sk, 0.92)
    ctx.fillText(left, inset, cy)
    ctx.textAlign = 'right'
    ctx.fillStyle = ink(sk, 0.62)
    ctx.font = font(rightSize, 750)
    ctx.fillText(right, w - inset, cy)
  }

  // ---- the band below: the cue, and how hard the pull is
  {
    const by = h - f.bottom / 2
    let cue = ''
    if (state.phase === 'aim') {
      if (state.aiming !== 'none') {
        cue = `${Math.round(state.power * 100)}%  ·  ${state.aiming === 'key' ? 'RELEASE TO SHOOT' : 'LET GO TO SHOOT'}`
      } else if (ballOff) {
        cue = 'LOOKING AHEAD  ·  PULL BACK FROM THE BALL AND THE VIEW COMES BACK'
      } else {
        cue = 'PULL BACK FROM THE BALL, LET GO TO SHOOT  ·  MAP OR SCROLL TO LOOK'
      }
    } else if (state.phase === 'intro') {
      cue = hole.name.toUpperCase()
    }
    if (cue) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // As large as it can be and still fit across the screen.
      let size = Math.max(11, textScale * 0.027)
      ctx.font = font(size, 750)
      const room = w - 24
      const wide = ctx.measureText(cue).width
      if (wide > room) {
        size = Math.max(8, (size * room) / wide)
        ctx.font = font(size, 750)
      }
      ctx.fillStyle = ink(sk, 0.5)
      ctx.fillText(cue, w / 2, by)
    }
  }

  // ---- hole intro, over the field, on a soft card so it reads over the garden
  if (state.phase === 'intro') {
    const cx = f.x + f.w / 2
    const cy = f.y + f.h * 0.46
    const fade = Math.min(1, state.t / 0.3, Math.max(0, (2.6 - state.t) / 0.4))
    const best = state.holeBests[hole.name]
    const sub = `Par ${hole.par}  ·  ${hole.name}${best !== undefined ? `  ·  Your best ${best}` : ''}`
    ctx.font = font(Math.max(13, textScale * 0.04), 750)
    const cardW = Math.max(ctx.measureText(sub).width + 48, textScale * 0.5)
    const cardH = textScale * 0.2
    ctx.globalAlpha = fade
    ctx.fillStyle = css(sk.field, 0.82)
    ctx.beginPath()
    ctx.roundRect(cx - cardW / 2, cy - cardH * 0.52, cardW, cardH, 14)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = ink(sk, 0.96)
    ctx.font = font(Math.max(22, textScale * 0.085), 800)
    ctx.fillText(`Hole ${state.holeIndex + 1}`, cx, cy - cardH * 0.08)
    ctx.font = font(Math.max(13, textScale * 0.04), 750)
    ctx.fillStyle = ink(sk, 0.7)
    ctx.fillText(sub, cx, cy + cardH * 0.28)
    ctx.globalAlpha = 1
  }

  // ---- popup: the result of the hole, or a splash
  if (state.popup) {
    const life = state.popup.life
    const rise = (1.7 - life) * f.s * 5
    const alpha = Math.min(1, life / 0.4)
    const cx = f.x + f.w / 2
    const cy = f.y + f.h * 0.5
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(20, textScale * 0.075), 800)
    ctx.lineWidth = Math.max(3, textScale * 0.008)
    ctx.strokeStyle = css(sk.field, 0.7 * alpha)
    ctx.strokeText(state.popup.text, cx, cy - rise)
    ctx.fillStyle = ink(sk, 0.96 * alpha)
    ctx.fillText(state.popup.text, cx, cy - rise)
    if (state.popup.sub) {
      ctx.font = font(Math.max(13, textScale * 0.04), 800)
      ctx.strokeText(state.popup.sub, cx, cy - rise + textScale * 0.07)
      ctx.fillStyle = sk.line('green', alpha)
      ctx.fillText(state.popup.sub, cx, cy - rise + textScale * 0.07)
    }
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.25})`
    ctx.fillRect(0, 0, w, h)
  }
}

/** The painted strips for a hole, dropped: for a test that wants to time the painting, or a theme change mid-hole. */
export function forgetPaint() {
  strips = { key: '', map: new Map() }
}
