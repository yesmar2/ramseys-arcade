import { mulberry32 } from '../../lib/seededRandom'
import { castShadow, LIGHT, loopsPath, spotRandom, type Ctx } from './brush'
import {
  EDGE_T,
  FIELD_W,
  PORTAL_R,
  SAIL_T,
  SPINNER_T,
  type Drawbridge,
  type Gate,
  type Hole,
  type Mill,
  type Ramp,
  type Rock,
  type Shape,
  type Slope,
  type Vec,
  type WaterLook,
} from './course'
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
  gateLevel,
  GUIDE_REACH,
  mapLayout,
  MAX_DRAG,
  millOver,
  onGround,
  SAND_LIE,
  showsMap,
  sliderWall,
  spinnerWall,
  underMap,
  type Frame,
  type GameState,
  type RoverState,
} from './game'
import { css, gardenOf, isFlat, mix, placeOf, skin, type Place, type RGB, type Skin } from './paint'
import { drawLiveProp, isLive, paintProp, paintPropShadow } from './scenery'
import { boundsOf, contours, inAny } from './terrain'

/*
 * Putt, drawn. Each hole is a green laid through a place — a garden, a
 * formal garden, a castle, a beach, a mountain — with rails of whatever the
 * place is made of: timber, clipped hedge, stone, a boardwalk's planks,
 * rough rock. The rails cast a shadow on the ground outside and on the green
 * inside, the green is mown in stripes, and round it all grows whatever
 * grows there. Water glints, the sea washes in, sand is raked, drops fall
 * away into the dark, and a windmill's roof hides the ball as it runs under.
 *
 * Everything that holds still is painted once into strips along the hole,
 * at the screen's own resolution, and laid down each frame where the camera
 * says; only what moves is drawn every frame. The field is drawn in field
 * units through the canvas's transform, so a hole lying on its side on a
 * wide screen is the same drawing turned.
 */

type Layer = HTMLCanvasElement | OffscreenCanvas

/** The painted strips: this long each, drawn with this much overlap so no seam shows. */
const TILE = 64
const BLEED = 3
/** How many device pixels of painted strips to keep before dropping the furthest. */
const TILE_BUDGET = 26_000_000
const BLACK: RGB = [0, 0, 0]
const WHITE: RGB = [255, 255, 255]

function ink(sk: Skin, alpha: number) {
  return css(sk.ink, alpha)
}

/* ---------- outlines ---------- */

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

/** A point along the green's edge, every so often, with the way along it and the way out from the green. */
type EdgeMark = { x: number; y: number; tx: number; ty: number; nx: number; ny: number }
const markCache = new WeakMap<Hole, Map<number, EdgeMark[]>>()

/** Points every `step` units along the green's traced edge, for setting a rail's details along it. */
function marksAlong(hole: Hole, step: number): EdgeMark[] {
  let byStep = markCache.get(hole)
  if (!byStep) {
    byStep = new Map()
    markCache.set(hole, byStep)
  }
  const known = byStep.get(step)
  if (known) return known
  const marks: EdgeMark[] = []
  for (const line of edgesOf(hole)) {
    let run = 0
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!
      const b = line[i]!
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      if (seg < 1e-6) continue
      const tx = (b.x - a.x) / seg
      const ty = (b.y - a.y) / seg
      for (let u = (step - run) % step; u < seg; u += step) {
        const x = a.x + tx * u
        const y = a.y + ty * u
        let nx = -ty
        let ny = tx
        if (onGround(hole, { x: x + nx * 1.2, y: y + ny * 1.2 })) {
          nx = -nx
          ny = -ny
        }
        marks.push({ x, y, tx, ty, nx, ny })
      }
      run = (run + seg) % step
    }
  }
  byStep.set(step, marks)
  return marks
}

/* ---------- the ground, painted once ---------- */

/** Tufts in grass: short strokes in two shades, scattered on a grid so each strip agrees with the next. */
function paintTufts(g: Ctx, place: Place, ya: number, yb: number, share: number) {
  const step = 2.8
  const hi = new Path2D()
  const lo = new Path2D()
  for (let j = Math.floor(ya / step) - 1; j * step < yb + 1; j++) {
    for (let i = -2; i * step < FIELD_W + 3; i++) {
      const rnd = spotRandom(i, j, 11)
      if (rnd() > share) continue
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
  g.strokeStyle = css(place.roughHi, 0.6)
  g.stroke(hi)
  g.strokeStyle = css(place.roughLo, 0.6)
  g.stroke(lo)
}

/** Raked gravel: pebbles in two shades, and the faint lines of the rake. */
function paintGravel(g: Ctx, place: Place, ya: number, yb: number) {
  g.strokeStyle = css(place.roughLo, 0.35)
  g.lineWidth = 0.14
  for (let y = Math.floor(ya / 1.5) * 1.5; y < yb + 1; y += 1.5) {
    g.beginPath()
    g.moveTo(-4, y)
    g.lineTo(FIELD_W + 4, y)
    g.stroke()
  }
  const step = 1.25
  const hi = new Path2D()
  const lo = new Path2D()
  for (let j = Math.floor(ya / step) - 1; j * step < yb + 1; j++) {
    for (let i = -2; i * step < FIELD_W + 3; i++) {
      const rnd = spotRandom(i, j, 17)
      if (rnd() > 0.55) continue
      const x = (i + rnd()) * step
      const y = (j + rnd()) * step
      const r = 0.14 + rnd() * 0.18
      const path = rnd() < 0.5 ? hi : lo
      path.moveTo(x + r, y)
      path.arc(x, y, r, 0, Math.PI * 2)
    }
  }
  g.fillStyle = css(place.roughHi, 0.75)
  g.fill(hi)
  g.fillStyle = css(place.roughLo, 0.6)
  g.fill(lo)
}

/** Sand: fine specks and the ripples the wind leaves in it. */
function paintSandGrain(g: Ctx, place: Place, ya: number, yb: number) {
  g.strokeStyle = css(place.roughLo, 0.4)
  g.lineWidth = 0.18
  for (let y = Math.floor(ya / 3.4) * 3.4 - 3.4; y < yb + 3; y += 3.4) {
    g.beginPath()
    for (let x = -4; x <= FIELD_W + 4; x += 1) {
      const yy = y + Math.sin(x * 0.32 + y * 0.9) * 0.6 + Math.sin(x * 0.11 + y) * 0.9
      if (x === -4) g.moveTo(x, yy)
      else g.lineTo(x, yy)
    }
    g.stroke()
  }
  const step = 1.6
  const hi = new Path2D()
  const lo = new Path2D()
  for (let j = Math.floor(ya / step) - 1; j * step < yb + 1; j++) {
    for (let i = -2; i * step < FIELD_W + 3; i++) {
      const rnd = spotRandom(i, j, 23)
      if (rnd() > 0.45) continue
      const x = (i + rnd()) * step
      const y = (j + rnd()) * step
      const path = rnd() < 0.5 ? hi : lo
      path.moveTo(x + 0.13, y)
      path.arc(x, y, 0.13, 0, Math.PI * 2)
    }
  }
  g.fillStyle = css(place.roughHi, 0.8)
  g.fill(hi)
  g.fillStyle = css(place.roughLo, 0.55)
  g.fill(lo)
}

/** The ground round the course, by what it is. */
function paintGrain(g: Ctx, place: Place, ya: number, yb: number) {
  if (place.grain === 'gravel') paintGravel(g, place, ya, yb)
  else if (place.grain === 'sand') paintSandGrain(g, place, ya, yb)
  else paintTufts(g, place, ya, yb, place.grain === 'alpine' ? 0.45 : 0.6)
}

/**
 * The course stands on the ground: its shadow, then the rail outside its
 * edge, lit along the side facing the light, in whatever the place is made
 * of. A hedge and a rock rail have a bumpy outer edge; stone is laid in
 * blocks, a boardwalk in planks between posts.
 */
function paintRails(g: Ctx, sk: Skin, place: Place, hole: Hole, edges: Vec[][], ya: number, yb: number) {
  const W = place.railW
  const green = () => loopsPath(g, edges)
  const inView = (m: EdgeMark) => m.y > ya - 5 && m.y < yb + 5
  castShadow(g, 1.7, 1.4, sk.shadow, () => {
    green()
    g.fill('evenodd')
    g.lineWidth = W * 2
    g.stroke()
  })
  green()
  g.strokeStyle = place.railLine
  g.lineWidth = (W + 0.34) * 2
  g.stroke()
  if (place.railStyle === 'hedge' || place.railStyle === 'rock') {
    // A bumpy outer edge: rounds of leaf or stone along it, outlined as one with the band.
    const hedge = place.railStyle === 'hedge'
    const bumps = marksAlong(hole, hedge ? 2.1 : 1.7)
      .filter(inView)
      .map((m) => {
        const rnd = spotRandom(Math.round(m.x * 10), Math.round(m.y * 10), 5)
        const r = hedge ? 1.25 + rnd() * 0.2 : 0.75 + rnd() * 0.85
        return { x: m.x + m.nx * (W - r * 0.6), y: m.y + m.ny * (W - r * 0.6), r }
      })
    g.fillStyle = place.railLine
    for (const b of bumps) {
      g.beginPath()
      g.arc(b.x, b.y, b.r + 0.34, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = css(place.rail)
    for (const b of bumps) {
      g.beginPath()
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      g.fill()
    }
  }
  green()
  g.strokeStyle = css(place.rail)
  g.lineWidth = W * 2
  g.stroke()
  g.save()
  g.translate(-LIGHT.x * 0.55, -LIGHT.y * 0.55)
  green()
  g.strokeStyle = css(place.railLit)
  g.lineWidth = W * 1.05
  g.stroke()
  g.restore()
  switch (place.railStyle) {
    case 'hedge': {
      // Leaves: flecks of the lit colour and of shade all over the top.
      for (const m of marksAlong(hole, 0.8).filter(inView)) {
        const rnd = spotRandom(Math.round(m.x * 10), Math.round(m.y * 10), 9)
        const d = rnd() * W
        g.fillStyle = rnd() < 0.5 ? css(mix(place.railLit, WHITE, sk.dark ? 0.08 : 0.25), 0.8) : css(mix(place.rail, BLACK, 0.25), 0.6)
        g.beginPath()
        g.arc(m.x + m.nx * d, m.y + m.ny * d, 0.22 + rnd() * 0.12, 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'stone': {
      // Blocks: a joint across the top every so often.
      g.strokeStyle = place.railLine
      g.lineWidth = 0.16
      g.globalAlpha = 0.6
      marksAlong(hole, 3.2)
        .filter(inView)
        .forEach((m, i) => {
          const from = i % 2 ? 0 : W * 0.5
          g.beginPath()
          g.moveTo(m.x + m.nx * from, m.y + m.ny * from)
          g.lineTo(m.x + m.nx * (from + W * 0.5), m.y + m.ny * (from + W * 0.5))
          g.stroke()
        })
      g.globalAlpha = 1
      break
    }
    case 'boardwalk': {
      // Planks across, and a post every so often.
      g.strokeStyle = place.railLine
      g.lineWidth = 0.12
      g.globalAlpha = 0.45
      for (const m of marksAlong(hole, 1.1).filter(inView)) {
        g.beginPath()
        g.moveTo(m.x, m.y)
        g.lineTo(m.x + m.nx * W, m.y + m.ny * W)
        g.stroke()
      }
      g.globalAlpha = 1
      for (const m of marksAlong(hole, 7.5).filter(inView)) {
        const cx = m.x + m.nx * W * 0.6
        const cy = m.y + m.ny * W * 0.6
        g.fillStyle = css(mix(place.rail, BLACK, 0.25))
        g.beginPath()
        g.arc(cx, cy, 0.9, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = place.railLine
        g.lineWidth = 0.18
        g.stroke()
        g.fillStyle = css(place.railLit)
        g.beginPath()
        g.arc(cx - 0.2, cy - 0.25, 0.4, 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'rock': {
      // Cracks and a few darker faces in the stone.
      g.strokeStyle = place.railLine
      g.lineWidth = 0.15
      g.globalAlpha = 0.5
      for (const m of marksAlong(hole, 4.3).filter(inView)) {
        const rnd = spotRandom(Math.round(m.x * 10), Math.round(m.y * 10), 13)
        const d0 = rnd() * W * 0.4
        g.beginPath()
        g.moveTo(m.x + m.nx * d0, m.y + m.ny * d0)
        g.lineTo(m.x + m.nx * (d0 + 0.9) + m.tx * (rnd() - 0.5) * 1.2, m.y + m.ny * (d0 + 0.9) + m.ty * (rnd() - 0.5) * 1.2)
        g.stroke()
      }
      g.globalAlpha = 1
      break
    }
    default:
      break
  }
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

/**
 * Water: the pool, its lighter shallows along the banks, the bank's shadow
 * on it, and its line. A moat is lined with stone and darker; the sea has
 * wide sandy shallows and a line of surf along the shore.
 */
function paintWater(g: Ctx, sk: Skin, place: Place, loops: Vec[][], look: WaterLook) {
  if (!loops.length) return
  if (look === 'moat') {
    // The masonry lining, laid first so the water covers its inner half.
    loopsPath(g, loops)
    g.strokeStyle = sk.stoneLine
    g.lineWidth = 4.8
    g.stroke()
    g.strokeStyle = css(sk.stone)
    g.lineWidth = 4.1
    g.stroke()
  }
  const body = look === 'moat' ? mix(sk.water, BLACK, sk.dark ? 0.25 : 0.1) : look === 'sea' ? mix(sk.water, [30, 80, 140], 0.1) : sk.water
  loopsPath(g, loops)
  g.fillStyle = css(body)
  g.fill('evenodd')
  g.save()
  loopsPath(g, loops)
  g.clip('evenodd')
  loopsPath(g, loops)
  if (look === 'sea') {
    g.strokeStyle = css(mix(sk.waterEdge, place.rough, 0.3), 0.75)
    g.lineWidth = 8
    g.stroke()
    g.strokeStyle = css(sk.waterEdge, 0.7)
    g.lineWidth = 3.6
    g.stroke()
  } else {
    g.strokeStyle = css(sk.waterEdge, look === 'moat' ? 0.4 : 0.75)
    g.lineWidth = look === 'moat' ? 2.2 : 3.4
    g.stroke()
  }
  // The bank stands above the water, and throws its shadow on the side away from the light.
  castShadow(g, look === 'moat' ? 2.4 : 1.4, 0.8, sk.shadow, () => {
    loopsPath(g, loops)
    g.lineWidth = 1.2
    g.stroke()
  })
  g.restore()
  loopsPath(g, loops)
  g.strokeStyle = look === 'sea' ? (sk.dark ? 'rgba(220, 238, 255, 0.7)' : 'rgba(255, 255, 255, 0.95)') : sk.waterLine
  g.lineWidth = look === 'sea' ? 0.7 : 0.34
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

/** A hill bigger than this, in square units, is shaded without chevrons. */
const BANK_AREA = 6000

/**
 * A slope, drawn by what it is. A hill is shaded dark toward its foot, and a
 * small one has faint chevrons running downhill; steps are treads with their risers'
 * shadows; open ground a wind crosses is only tinted, its streaks are live.
 * A dish darkens toward its middle, a crown is lit on top and falls away
 * all round, a bowl is ringed toward its middle.
 */
function paintSlope(g: Ctx, sk: Skin, sl: Slope, loops: Vec[][]) {
  if (!loops.length) return
  const b = boundsOf(sl.shape)
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2
  const R = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2
  g.save()
  loopsPath(g, loops)
  g.clip('evenodd')
  if (sl.pull) {
    const mag = Math.hypot(sl.pull.x, sl.pull.y) || 1
    const dx = sl.pull.x / mag
    const dy = sl.pull.y / mag
    const px = -dy
    const py = dx
    const along = Math.abs(dx) * (b.x1 - b.x0) + Math.abs(dy) * (b.y1 - b.y0)
    const across = Math.abs(dx) * (b.y1 - b.y0) + Math.abs(dy) * (b.x1 - b.x0)
    const look = sl.look ?? 'hill'
    if (look === 'steps') {
      // Treads across the slope, each with the shadow of the riser below it.
      const tread = 2.6
      for (let k = -along / 2; k < along / 2; k += tread) {
        const a0 = { x: cx + dx * k + px * across, y: cy + dy * k + py * across }
        const a1 = { x: cx + dx * k - px * across, y: cy + dy * k - py * across }
        g.beginPath()
        g.moveTo(a0.x, a0.y)
        g.lineTo(a1.x, a1.y)
        g.lineTo(a1.x + dx * tread * 0.32, a1.y + dy * tread * 0.32)
        g.lineTo(a0.x + dx * tread * 0.32, a0.y + dy * tread * 0.32)
        g.closePath()
        g.fillStyle = css(sk.greenLo, 0.4)
        g.fill()
        g.strokeStyle = css(sk.greenHi, 0.7)
        g.lineWidth = 0.22
        g.beginPath()
        g.moveTo(a0.x - dx * 0.1, a0.y - dy * 0.1)
        g.lineTo(a1.x - dx * 0.1, a1.y - dy * 0.1)
        g.stroke()
      }
    } else if (look === 'wind') {
      g.fillStyle = css(sk.greenHi, 0.07)
      g.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2)
    } else {
      const grad = g.createLinearGradient(cx - dx * along * 0.5, cy - dy * along * 0.5, cx + dx * along * 0.5, cy + dy * along * 0.5)
      grad.addColorStop(0, css(sk.greenHi, 0.34))
      grad.addColorStop(0.5, css(sk.greenHi, 0))
      grad.addColorStop(1, css(sk.greenLo, 0.42))
      g.fillStyle = grad
      g.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2)
      // Chevrons pointing downhill, in rows across the slope, on a slope small enough to be a feature: a
      // ridge, a bank. A whole mountainside is its shading alone, or it would be nothing but arrows.
      g.strokeStyle = ink(sk, sk.dark ? 0.22 : 0.2)
      g.lineWidth = 0.45
      g.lineCap = 'round'
      g.lineJoin = 'round'
      for (let m = -across / 2 + 6; along * across < BANK_AREA && m < across / 2 - 3; m += 11) {
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
    }
  } else if (sl.repel && sl.shape.kind === 'arc') {
    // A hilltop: the slope darker the further down it, ringed like a contour map.
    const sh = sl.shape
    const top = sh.R - sh.r
    const foot = sh.R + sh.r
    const grad = g.createRadialGradient(sh.x, sh.y, top, sh.x, sh.y, foot)
    grad.addColorStop(0, css(sk.greenHi, sk.dark ? 0.32 : 0.42))
    grad.addColorStop(0.45, css(sk.greenHi, 0))
    grad.addColorStop(1, css(sk.greenLo, sk.dark ? 0.62 : 0.5))
    g.fillStyle = grad
    g.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2)
    g.strokeStyle = ink(sk, sk.dark ? 0.16 : 0.13)
    g.lineWidth = 0.3
    g.setLineDash([1.4, 1.4])
    for (const k of [0.33, 0.66]) {
      g.beginPath()
      g.arc(sh.x, sh.y, top + (foot - top) * k, 0, Math.PI * 2)
      g.stroke()
    }
    g.setLineDash([])
  } else if (sl.dish || sl.bowl || sl.repel) {
    const crown = !!sl.repel
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, R)
    if (crown) {
      grad.addColorStop(0, css(sk.greenHi, 0.5))
      grad.addColorStop(0.6, css(sk.greenHi, 0.08))
      grad.addColorStop(1, css(sk.greenLo, 0.3))
    } else {
      grad.addColorStop(0, css(sk.greenLo, sl.dish ? 0.5 : 0.35))
      grad.addColorStop(1, css(sk.greenLo, 0))
    }
    g.fillStyle = grad
    g.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2)
    // Contour rings.
    g.strokeStyle = ink(sk, sk.dark ? 0.14 : 0.12)
    g.lineWidth = 0.3
    g.setLineDash([1.4, 1.4])
    for (const k of [0.3, 0.55, 0.8]) {
      g.beginPath()
      g.arc(cx, cy, R * k, 0, Math.PI * 2)
      g.stroke()
    }
    g.setLineDash([])
  } else {
    g.fillStyle = css(sk.greenLo, 0.14)
    g.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2)
  }
  g.restore()
  // A hilltop's flat top, lit, with its lip drawn so the edge of it can be read from below.
  if (sl.repel && sl.shape.kind === 'arc') {
    const sh = sl.shape
    const top = sh.R - sh.r
    g.fillStyle = css(sk.greenHi, sk.dark ? 0.16 : 0.24)
    g.beginPath()
    g.arc(sh.x, sh.y, top, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = css(sk.greenLo, 0.55)
    g.lineWidth = 0.9
    g.beginPath()
    g.arc(sh.x, sh.y, top + 0.55, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = css(sk.greenHi, 0.85)
    g.lineWidth = 0.45
    g.beginPath()
    g.arc(sh.x, sh.y, top, 0, Math.PI * 2)
    g.stroke()
  }
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

/** Something round standing on the green, as round as the ball finds it: a boulder, a planter, a sandcastle. */
function paintRock(g: Ctx, sk: Skin, rk: Rock) {
  const { x, y, r } = rk
  const rnd = mulberry32(Math.round(x * 131 + y * 17))
  if (rk.look === 'planter') {
    // A stone planter: its rim, the soil, and a clipped ball of box in it.
    castShadow(g, 1.6, 0.8, sk.shadow, () => {
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
    })
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fillStyle = css(sk.stone)
    g.fill()
    g.save()
    g.clip()
    g.beginPath()
    g.arc(x - r * 0.25, y - r * 0.3, r * 0.8, 0, Math.PI * 2)
    g.fillStyle = css(sk.stoneLit)
    g.fill()
    g.restore()
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.strokeStyle = sk.stoneLine
    g.lineWidth = 0.3
    g.stroke()
    g.beginPath()
    g.arc(x, y, r * 0.74, 0, Math.PI * 2)
    g.fillStyle = css(mix(sk.wood, BLACK, 0.45))
    g.fill()
    g.stroke()
    g.beginPath()
    g.arc(x - r * 0.06, y - r * 0.08, r * 0.58, 0, Math.PI * 2)
    g.fillStyle = css(sk.leaf)
    g.fill()
    g.save()
    g.clip()
    g.beginPath()
    g.arc(x - r * 0.24, y - r * 0.28, r * 0.42, 0, Math.PI * 2)
    g.fillStyle = css(sk.leafLit)
    g.fill()
    g.restore()
    g.beginPath()
    g.arc(x - r * 0.06, y - r * 0.08, r * 0.58, 0, Math.PI * 2)
    g.strokeStyle = sk.leafLine
    g.lineWidth = 0.24
    g.stroke()
    return
  }
  if (rk.look === 'turret') {
    // A round turret standing on the green: its parapet, the teeth along it, and the floor inside.
    castShadow(g, r * 1.3, 1.2, sk.shadow, () => {
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
    })
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fillStyle = css(sk.stone)
    g.fill()
    g.save()
    g.clip()
    g.beginPath()
    g.arc(x - r * 0.28, y - r * 0.32, r * 0.75, 0, Math.PI * 2)
    g.fillStyle = css(sk.stoneLit)
    g.fill()
    g.restore()
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.strokeStyle = sk.stoneLine
    g.lineWidth = 0.3
    g.stroke()
    g.beginPath()
    g.arc(x, y, r - 1.2, 0, Math.PI * 2)
    g.fillStyle = css(mix(sk.stone, BLACK, 0.22))
    g.fill()
    g.stroke()
    const n = Math.max(8, Math.round(r * 2.2))
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      g.save()
      g.translate(x + Math.cos(a) * (r - 0.55), y + Math.sin(a) * (r - 0.55))
      g.rotate(a)
      g.beginPath()
      g.rect(-0.5, -0.55, 1, 1.1)
      g.fillStyle = css(sk.stoneLit)
      g.fill()
      g.lineWidth = 0.12
      g.stroke()
      g.restore()
    }
    return
  }
  if (rk.look === 'sandcastle') {
    // A sandcastle: a heap of sand, a keep on it, a turret at each corner and a flag.
    castShadow(g, 1.8, 0.8, sk.shadow, () => {
      g.beginPath()
      g.arc(x, y, r * 0.95, 0, Math.PI * 2)
      g.fill()
    })
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fillStyle = css(sk.sand)
    g.fill()
    g.strokeStyle = sk.sandLine
    g.lineWidth = 0.26
    g.stroke()
    const s = r * 0.5
    g.beginPath()
    g.rect(x - s, y - s, s * 2, s * 2)
    g.fillStyle = css(mix(sk.sand, WHITE, sk.dark ? 0.1 : 0.3))
    g.fill()
    g.stroke()
    for (const [ox, oy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      g.beginPath()
      g.arc(x + ox * s, y + oy * s, r * 0.3, 0, Math.PI * 2)
      g.fillStyle = css(mix(sk.sand, WHITE, sk.dark ? 0.16 : 0.4))
      g.fill()
      g.stroke()
    }
    g.strokeStyle = css(sk.ink, 0.6)
    g.lineWidth = 0.14
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x, y - s * 0.2)
    g.stroke()
    g.fillStyle = sk.petals[3]!
    g.beginPath()
    g.moveTo(x, y - s * 0.2)
    g.lineTo(x + s * 0.9, y - s * 0.45)
    g.lineTo(x, y - s * 0.7)
    g.closePath()
    g.fill()
    return
  }
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
  g.fillStyle = css(mix(sk.stone, BLACK, 0.22))
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

/** A drop: dark at the bottom, rock faces going down its sides, lit at the lip and shadowed under the near edge. */
function paintPits(g: Ctx, sk: Skin, place: Place, loops: Vec[][]) {
  if (!loops.length) return
  loopsPath(g, loops)
  g.fillStyle = css(sk.dark ? [5, 8, 12] : mix(sk.field, [34, 44, 56], 0.82))
  g.fill('evenodd')
  g.save()
  loopsPath(g, loops)
  g.clip('evenodd')
  const rock = place.railStyle === 'rock' ? place.rail : sk.stone
  const lit = place.railStyle === 'rock' ? place.railLit : sk.stoneLit
  loopsPath(g, loops)
  g.strokeStyle = css(mix(rock, BLACK, 0.55), 0.9)
  g.lineWidth = 13
  g.stroke()
  g.strokeStyle = css(mix(rock, BLACK, 0.25))
  g.lineWidth = 7
  g.stroke()
  g.strokeStyle = css(rock)
  g.lineWidth = 3.4
  g.stroke()
  g.strokeStyle = css(lit)
  g.lineWidth = 1.2
  g.stroke()
  castShadow(g, 5, 2.2, sk.dark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(10, 20, 30, 0.5)', () => {
    loopsPath(g, loops)
    g.lineWidth = 2
    g.stroke()
  })
  g.restore()
  loopsPath(g, loops)
  g.strokeStyle = place.railStyle === 'rock' ? place.railLine : sk.stoneLine
  g.lineWidth = 0.34
  g.stroke()
}

/** Paving laid on the green: rings round the middle of a round plaza, courses of setts anywhere else. */
function paintPaving(g: Ctx, sk: Skin, hole: Hole, ya: number, yb: number) {
  for (const sh of hole.paving) {
    const b = boundsOf(sh)
    if (b.y1 < ya - 2 || b.y0 > yb + 2) continue
    const loops = outlineOfShape(sh, hole.h)
    g.save()
    loopsPath(g, loops)
    g.clip('evenodd')
    g.fillStyle = css(mix(sk.stoneLit, sk.stone, 0.45))
    g.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2)
    g.strokeStyle = sk.stoneLine
    g.lineWidth = 0.14
    g.globalAlpha = 0.5
    if (sh.kind === 'disc') {
      let ring = 0
      for (let rr = 2.6; rr < sh.r + 2.6; rr += 2.6, ring++) {
        g.beginPath()
        g.arc(sh.x, sh.y, rr, 0, Math.PI * 2)
        g.stroke()
        const n = Math.max(6, Math.round((Math.PI * 2 * rr) / 3.2))
        for (let i = 0; i < n; i++) {
          const a = ((i + (ring % 2) * 0.5) / n) * Math.PI * 2
          g.beginPath()
          g.moveTo(sh.x + Math.cos(a) * (rr - 2.6), sh.y + Math.sin(a) * (rr - 2.6))
          g.lineTo(sh.x + Math.cos(a) * rr, sh.y + Math.sin(a) * rr)
          g.stroke()
        }
      }
    } else {
      let row = 0
      for (let y = Math.floor(b.y0 / 2.4) * 2.4; y < b.y1 + 2.4; y += 2.4, row++) {
        g.beginPath()
        g.moveTo(b.x0 - 1, y)
        g.lineTo(b.x1 + 1, y)
        g.stroke()
        for (let x = b.x0 - 1 + (row % 2) * 1.8; x < b.x1 + 1; x += 3.6) {
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x, y + 2.4)
          g.stroke()
        }
      }
    }
    g.globalAlpha = 1
    g.restore()
    loopsPath(g, loops)
    g.strokeStyle = sk.stoneLine
    g.lineWidth = 0.3
    g.stroke()
  }
}

/** The ends of the pipes: a drain's grate, a cave's mouth or a pipe's rim going in; the same with an arrow coming out. */
function paintPortals(g: Ctx, sk: Skin, place: Place, hole: Hole) {
  for (const pipe of hole.portals) {
    const look = pipe.look ?? 'pipe'
    for (const [p, out] of [
      [pipe.a, false],
      [pipe.b, true],
    ] as const) {
      const r = PORTAL_R
      if (look === 'cave') {
        // A mouth in the rock: stones round a dark hole.
        const rnd = mulberry32(Math.round(p.x * 7 + p.y * 3))
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + rnd() * 0.3
          const sr = 1.1 + rnd() * 0.7
          const cx = p.x + Math.cos(a) * (r + sr * 0.5)
          const cy = p.y + Math.sin(a) * (r + sr * 0.5)
          g.beginPath()
          g.arc(cx, cy, sr, 0, Math.PI * 2)
          g.fillStyle = css(i % 2 ? place.rail : place.railLit)
          g.fill()
          g.strokeStyle = place.railLine
          g.lineWidth = 0.18
          g.stroke()
        }
      } else {
        // A pipe's rim: stone, or painted when there are pipes to tell apart.
        g.beginPath()
        g.arc(p.x, p.y, r + (pipe.tint ? 1.4 : 1), 0, Math.PI * 2)
        g.fillStyle = pipe.tint ?? css(sk.stone)
        g.fill()
        g.strokeStyle = pipe.tint ? 'rgba(0, 0, 0, 0.35)' : sk.stoneLine
        g.lineWidth = 0.26
        g.stroke()
      }
      const grad = g.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, 0, p.x, p.y, r)
      grad.addColorStop(0, 'rgba(4, 6, 10, 0.98)')
      grad.addColorStop(1, 'rgba(28, 36, 46, 0.98)')
      g.beginPath()
      g.arc(p.x, p.y, r, 0, Math.PI * 2)
      g.fillStyle = grad
      g.fill()
      if (look === 'drain' && !out) {
        // The grate over the drain.
        g.save()
        g.beginPath()
        g.arc(p.x, p.y, r, 0, Math.PI * 2)
        g.clip()
        g.strokeStyle = sk.dark ? 'rgba(150, 160, 172, 0.9)' : 'rgba(80, 88, 100, 0.95)'
        g.lineWidth = 0.4
        for (let k = -r; k <= r; k += 1.2) {
          g.beginPath()
          g.moveTo(p.x + k, p.y - r)
          g.lineTo(p.x + k, p.y + r)
          g.stroke()
        }
        g.restore()
        g.beginPath()
        g.arc(p.x, p.y, r, 0, Math.PI * 2)
        g.stroke()
      }
      if (out) {
        // Which way it comes out.
        const dx = Math.cos(pipe.out)
        const dy = Math.sin(pipe.out)
        const tx = p.x + dx * (r + 3.4)
        const ty = p.y + dy * (r + 3.4)
        g.fillStyle = pipe.tint ?? ink(sk, 0.5)
        g.beginPath()
        g.moveTo(tx, ty)
        g.lineTo(tx - dx * 2.2 - dy * 1.7, ty - dy * 2.2 + dx * 1.7)
        g.lineTo(tx - dx * 2.2 + dy * 1.7, ty - dy * 2.2 - dx * 1.7)
        g.closePath()
        g.fill()
      }
    }
  }
}

/** Walls placed by hand, in whatever the rails are made of: a hedge in a formal garden, stone in a castle. */
function paintPlacedWalls(g: Ctx, sk: Skin, place: Place, hole: Hole, near: (y0: number, y1: number) => boolean) {
  const walls = hole.walls.filter((w) => !w.hidden && near(Math.min(w.a.y, w.b.y) - 4, Math.max(w.a.y, w.b.y) + 4))
  if (!walls.length) return
  g.lineCap = 'round'
  castShadow(g, 1.4, 1, sk.shadow, () => {
    for (const w of walls) {
      g.lineWidth = w.t * 2
      g.beginPath()
      g.moveTo(w.a.x, w.a.y)
      g.lineTo(w.b.x, w.b.y)
      g.stroke()
    }
  })
  for (const [color, grow] of [
    [place.railLine, 0.34],
    [css(place.rail), 0],
  ] as const) {
    g.strokeStyle = color
    for (const w of walls) {
      g.lineWidth = w.t * 2 + grow * 2
      g.beginPath()
      g.moveTo(w.a.x, w.a.y)
      g.lineTo(w.b.x, w.b.y)
      g.stroke()
    }
  }
  g.save()
  g.translate(-LIGHT.x * 0.3, -LIGHT.y * 0.3)
  g.strokeStyle = css(place.railLit)
  for (const w of walls) {
    g.lineWidth = w.t
    g.beginPath()
    g.moveTo(w.a.x, w.a.y)
    g.lineTo(w.b.x, w.b.y)
    g.stroke()
  }
  g.restore()
  // Kickers and flaps keep their colours, so they read as what they are.
  for (const w of walls) {
    if (!w.kick && w.pass === undefined) continue
    g.strokeStyle = w.kick ? sk.line('red') : sk.line('teal')
    g.lineWidth = w.t * 2 + 0.6
    g.beginPath()
    g.moveTo(w.a.x, w.a.y)
    g.lineTo(w.b.x, w.b.y)
    g.stroke()
    g.strokeStyle = w.kick ? css(mix(sk.field, [232, 86, 79], 0.45)) : css(mix(sk.field, [62, 200, 207], 0.4))
    g.lineWidth = w.t * 2
    g.stroke()
  }
}

/** Everything that holds still, for the stretch of the hole from ya to yb. */
function paintGround(g: Ctx, hole: Hole, sk: Skin, ya: number, yb: number) {
  const len = hole.h
  const place = placeOf(sk, hole.theme)
  const edges = edgesOf(hole)
  const garden = gardenOf(hole, edges)
  const near = (y0: number, y1: number) => y1 > ya - 1 && y0 < yb + 1
  const nearShape = (sh: Shape) => {
    const b = boundsOf(sh)
    return near(b.y0 - 4, b.y1 + 4)
  }
  const reach = (p: { y: number; r: number; len?: number }) => p.r + (p.len ?? 0) + 8
  g.lineCap = 'round'
  g.lineJoin = 'round'

  // The ground round the course, what lies flat on it, and everything's shadows.
  g.fillStyle = css(place.rough)
  g.fillRect(-4, ya - 1, FIELD_W + 8, yb - ya + 2)
  paintGrain(g, place, ya, yb)
  for (const p of garden) {
    if (isFlat(p) && p.kind !== 'lily' && p.kind !== 'reeds' && near(p.y - reach(p), p.y + reach(p))) paintProp(g, sk, p)
  }
  for (const p of garden) if (near(p.y - reach(p) - 10, p.y + reach(p) + 10)) paintPropShadow(g, sk, p)

  paintRails(g, sk, place, hole, edges, ya, yb)

  // The green, mown in stripes, with its grain; paving where it is paved; the rail's shadow falls on it, and
  // the rail covers its edge.
  const green = () => loopsPath(g, edges)
  g.save()
  green()
  g.clip('evenodd')
  g.fillStyle = css(sk.green)
  g.fillRect(-4, ya - 1, FIELD_W + 8, yb - ya + 2)
  g.fillStyle = css(sk.stripe)
  const band = 9
  for (let y = Math.floor(ya / (band * 2)) * band * 2; y < yb; y += band * 2) g.fillRect(-4, y, FIELD_W + 8, band)
  paintBlades(g, sk, ya, yb)
  paintPaving(g, sk, hole, ya, yb)
  for (const sl of hole.slopes) if (nearShape(sl.shape)) paintSlope(g, sk, sl, outlineOfShape(sl.shape, len))
  castShadow(g, 1.3, 1, sk.shadow, () => {
    green()
    g.lineWidth = EDGE_T * 2
    g.stroke()
  })
  green()
  g.strokeStyle = place.railLine
  g.lineWidth = (EDGE_T + 0.34) * 2
  g.stroke()
  g.strokeStyle = css(place.rail)
  g.lineWidth = EDGE_T * 2
  g.stroke()
  g.restore()

  if (hole.sand.some(nearShape)) paintSand(g, sk, outlineOf(hole.sand, len))
  if (hole.pits.some(nearShape)) paintPits(g, sk, place, outlineOf(hole.pits, len))
  if (hole.water.some(nearShape)) paintWater(g, sk, place, outlineOf(hole.water, len), hole.waterLook)
  for (const p of garden) {
    if ((p.kind === 'lily' || p.kind === 'reeds') && near(p.y - p.r - 2, p.y + p.r + 2)) paintProp(g, sk, p)
  }
  for (const sh of hole.bridges) if (nearShape(sh)) paintBridge(g, sk, sh)
  if (near(hole.tee.y - 6, hole.tee.y + 6)) paintTee(g, sk, hole.tee)
  for (const rp of hole.ramps) if (near(rp.y - 4, rp.y + rp.h + 4)) paintRamp(g, sk, rp)
  for (const rk of hole.rocks) if (near(rk.y - rk.r - 4, rk.y + rk.r + 4)) paintRock(g, sk, rk)
  for (const m of hole.mills) if (near(m.y - m.r - 12, m.y + m.r + 12)) paintTower(g, sk, m)
  paintPortals(g, sk, place, hole)
  if (!hole.cupPath && near(hole.cup.y - 5, hole.cup.y + 5)) paintCup(g, sk, hole.cup)
  paintPlacedWalls(g, sk, place, hole, near)

  // What stands round the course, over everything else.
  for (const p of garden) {
    if (isFlat(p)) continue
    if (near(p.y - reach(p), p.y + reach(p))) paintProp(g, sk, p)
  }
}

/* ---------- the strips ---------- */

type Strip = { canvas: Layer; r0: number; px: number }
type StripSet = { key: string; map: Map<number, Strip> }
/**
 * The strips painted for the last two holes, skins or scales drawn, the one
 * drawn most lately first: a hole on a home page cabinet and the same hole on
 * the banner above it are drawn at two scales, frame after frame, and one set
 * would have each paint the other's away. They share TILE_BUDGET.
 */
let strips: StripSet[] = []
const STRIP_SETS = 2

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
  if (strips[0]?.key !== key) {
    const kept = strips.findIndex((s) => s.key === key)
    const set = kept >= 0 ? strips.splice(kept, 1)[0]! : { key, map: new Map<number, Strip>() }
    strips = [set, ...strips].slice(0, STRIP_SETS)
  }
  const set = strips[0]!
  const known = set.map.get(i)
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
  set.map.set(i, strip)
  let total = 0
  for (const each of strips) for (const s of each.map.values()) total += s.px
  // Over budget, the other set goes first, then this one's strips furthest from this one.
  while (total > TILE_BUDGET && strips.length > 1) {
    for (const s of strips.pop()!.map.values()) total -= s.px
  }
  while (total > TILE_BUDGET && set.map.size > 1) {
    let far = i
    for (const j of set.map.keys()) if (Math.abs(j - i) > Math.abs(far - i)) far = j
    if (far === i) break
    total -= set.map.get(far)!.px
    set.map.delete(far)
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
    // A stream runs the way it was drawn; the sea and a pond only shimmer where they lie.
    if (sh.kind === 'ribbon' && hole.waterLook !== 'sea') {
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
/** Where the ball was drawn back to as the last shot was let go, for the streak as it snaps through. */
let pulledFrom: Vec | null = null
/** How long that streak shows. */
const SNAP_TIME = 0.12

/**
 * A drawbridge, as far down as it is: planks out from its hinge at the far
 * end over the water, chains back to the posts, and the raised part drawn
 * short and dark as it lifts toward the hinge. A sandbar is sand while the
 * tide is out, and goes under as it comes back in.
 */
function drawDrawbridge(g: Ctx, sk: Skin, place: Place, db: Drawbridge, level: number, len: number, water: readonly Shape[]) {
  if (db.look === 'sandbar') {
    // Only where it crosses the water: the rest of it is under the grass either side.
    g.save()
    loopsPath(g, outlineOf(water, len))
    g.clip('evenodd')
    const loops = outlineOfShape(db.shape, len)
    loopsPath(g, loops)
    g.fillStyle = css(mix(sk.sand, WHITE, sk.dark ? 0.08 : 0.25), level)
    g.fill('evenodd')
    g.save()
    loopsPath(g, loops)
    g.clip('evenodd')
    const b = boundsOf(db.shape)
    g.strokeStyle = css(place.roughLo, 0.35 * level)
    g.lineWidth = 0.18
    for (let y = b.y0; y < b.y1; y += 2.2) {
      g.beginPath()
      for (let x = b.x0; x <= b.x1; x += 1) {
        const yy = y + Math.sin(x * 0.5 + y) * 0.4
        if (x === b.x0) g.moveTo(x, yy)
        else g.lineTo(x, yy)
      }
      g.stroke()
    }
    g.restore()
    // The water coming over it, and the line of foam at its edge.
    loopsPath(g, loops)
    g.fillStyle = css(sk.water, (1 - level) * 0.85)
    g.fill('evenodd')
    g.strokeStyle = sk.dark ? `rgba(220, 238, 255, ${0.25 + 0.5 * (1 - level)})` : `rgba(255, 255, 255, ${0.4 + 0.5 * (1 - level)})`
    g.lineWidth = 0.4
    g.stroke()
    g.restore()
    return
  }
  const sh = db.shape
  if (sh.kind !== 'capsule') return
  const full = Math.hypot(sh.b.x - sh.a.x, sh.b.y - sh.a.y) || 1
  const ux = (sh.a.x - sh.b.x) / full
  const uy = (sh.a.y - sh.b.y) / full
  const nx = -uy
  const ny = ux
  const deck = sh.r - EDGE_T
  const reachOut = (full + 2) * Math.max(0.12, level)
  const hx = sh.b.x - ux
  const hy = sh.b.y - uy
  const quad = (k0: number, k1: number, w: number) => {
    g.beginPath()
    g.moveTo(hx + ux * k0 + nx * w, hy + uy * k0 + ny * w)
    g.lineTo(hx + ux * k1 + nx * w, hy + uy * k1 + ny * w)
    g.lineTo(hx + ux * k1 - nx * w, hy + uy * k1 - ny * w)
    g.lineTo(hx + ux * k0 - nx * w, hy + uy * k0 - ny * w)
    g.closePath()
  }
  if (level > 0.02) {
    castShadow(g, 1.2 + (1 - level) * 5, 0.8, sk.shadow, () => {
      quad(0, reachOut, deck + 0.8)
      g.fill()
    })
  }
  quad(0, reachOut, deck + 0.8)
  g.fillStyle = css(level < 0.5 ? mix(sk.wood, BLACK, 0.3) : sk.wood)
  g.fill()
  g.strokeStyle = sk.woodLine
  g.lineWidth = 0.26
  g.stroke()
  g.globalAlpha = 0.5
  g.lineWidth = 0.14
  for (let k = 1.3; k < reachOut; k += 1.3) {
    g.beginPath()
    g.moveTo(hx + ux * k + nx * (deck + 0.8), hy + uy * k + ny * (deck + 0.8))
    g.lineTo(hx + ux * k - nx * (deck + 0.8), hy + uy * k - ny * (deck + 0.8))
    g.stroke()
  }
  g.globalAlpha = 1
  // Iron bands across the deck, and the chains up to the posts at the hinge.
  g.strokeStyle = css(mix(sk.stone, BLACK, 0.35))
  g.lineWidth = 0.4
  for (const k of [reachOut * 0.3, reachOut * 0.72]) {
    g.beginPath()
    g.moveTo(hx + ux * k + nx * (deck + 0.8), hy + uy * k + ny * (deck + 0.8))
    g.lineTo(hx + ux * k - nx * (deck + 0.8), hy + uy * k - ny * (deck + 0.8))
    g.stroke()
  }
  g.setLineDash([0.5, 0.35])
  g.lineWidth = 0.3
  for (const side of [1, -1]) {
    g.beginPath()
    g.moveTo(hx + ux * reachOut + nx * side * deck, hy + uy * reachOut + ny * side * deck)
    g.lineTo(hx - ux * 1.5 + nx * side * (deck + 1.6), hy - uy * 1.5 + ny * side * (deck + 1.6))
    g.stroke()
  }
  g.setLineDash([])
}

/** A portcullis across a gate: an iron grid when it is down, only its slot when it is up. */
function drawGate(g: Ctx, sk: Skin, gate: Gate, level: number) {
  const len = Math.hypot(gate.b.x - gate.a.x, gate.b.y - gate.a.y) || 1
  const ux = (gate.b.x - gate.a.x) / len
  const uy = (gate.b.y - gate.a.y) / len
  const nx = -uy
  const ny = ux
  g.lineCap = 'butt'
  g.strokeStyle = css(mix(sk.stone, BLACK, 0.45), 0.8)
  g.lineWidth = gate.t * 2 + 0.3
  g.beginPath()
  g.moveTo(gate.a.x, gate.a.y)
  g.lineTo(gate.b.x, gate.b.y)
  g.stroke()
  const down = 1 - level
  if (down > 0.02) {
    const iron = sk.dark ? 'rgba(168, 178, 190, 0.95)' : 'rgba(62, 70, 82, 0.95)'
    castShadow(g, 2.5 * down, 0.6, sk.shadow, () => {
      g.lineWidth = gate.t * 2
      g.beginPath()
      g.moveTo(gate.a.x, gate.a.y)
      g.lineTo(gate.b.x, gate.b.y)
      g.stroke()
    })
    g.globalAlpha = Math.min(1, down * 1.4)
    g.strokeStyle = iron
    g.lineWidth = 0.34
    for (const m of [-gate.t * 0.6, gate.t * 0.6]) {
      g.beginPath()
      g.moveTo(gate.a.x + nx * m, gate.a.y + ny * m)
      g.lineTo(gate.b.x + nx * m, gate.b.y + ny * m)
      g.stroke()
    }
    g.lineWidth = 0.42
    for (let k = 0.7; k < len - 0.4; k += 1.2) {
      g.beginPath()
      g.moveTo(gate.a.x + ux * k + nx * gate.t, gate.a.y + uy * k + ny * gate.t)
      g.lineTo(gate.a.x + ux * k - nx * gate.t, gate.a.y + uy * k - ny * gate.t)
      g.stroke()
    }
    g.globalAlpha = 1
  }
  g.lineCap = 'round'
}

/** A crab, scuttling sideways the way it is going: its shell, its legs working, its claws up and its eyes out. */
function drawCrab(g: Ctx, sk: Skin, rv: RoverState, r: number, clock: number, flash: number) {
  const heading = Math.atan2(rv.vy, rv.vx)
  g.save()
  g.translate(rv.x, rv.y)
  g.rotate(heading)
  const shell = mix(sk.field, [232, 86, 79], sk.dark ? 0.62 : 0.7)
  const line = sk.line('red', 0.95)
  // Legs: three a side, working in turn.
  g.strokeStyle = line
  g.lineWidth = 0.34
  g.lineCap = 'round'
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const kick = Math.sin(clock * 18 + i * 2.1 + (side > 0 ? 0 : Math.PI)) * 0.35
      const baseY = (i - 1) * r * 0.42
      const x0 = side * r * 0.7
      const x1 = side * (r * 1.35 + kick * 0.5)
      const y1 = baseY + r * 0.35 + kick
      g.beginPath()
      g.moveTo(x0, baseY)
      g.lineTo((x0 + x1) / 2, baseY - r * 0.1)
      g.lineTo(x1, y1)
      g.stroke()
    }
  }
  // Claws out in front.
  for (const side of [-1, 1]) {
    const snap = Math.sin(clock * 6 + side) * 0.15
    g.beginPath()
    g.moveTo(side * r * 0.45, -r * 0.55)
    g.lineTo(side * r * 0.7, -r * 1.05)
    g.stroke()
    g.beginPath()
    g.ellipse(side * r * 0.72, -r * 1.2, r * 0.3, r * 0.22, side * (0.5 + snap), 0, Math.PI * 2)
    g.fillStyle = css(shell)
    g.fill()
    g.stroke()
  }
  g.beginPath()
  g.ellipse(0, 0, r * (flash > 0 ? 1.12 : 1), r * 0.72, 0, 0, Math.PI * 2)
  g.fillStyle = css(shell)
  g.fill()
  g.strokeStyle = line
  g.lineWidth = 0.3
  g.stroke()
  g.beginPath()
  g.ellipse(-r * 0.25, -r * 0.2, r * 0.5, r * 0.3, 0, 0, Math.PI * 2)
  g.fillStyle = css(mix(shell, WHITE, 0.25))
  g.fill()
  for (const side of [-1, 1]) {
    g.beginPath()
    g.arc(side * r * 0.3, -r * 0.78, r * 0.17, 0, Math.PI * 2)
    g.fillStyle = 'rgba(255, 255, 255, 0.95)'
    g.fill()
    g.beginPath()
    g.arc(side * r * 0.3, -r * 0.82, r * 0.08, 0, Math.PI * 2)
    g.fillStyle = 'rgba(10, 14, 20, 0.95)'
    g.fill()
  }
  g.restore()
}

/** Everything else that moves: pads, drawbridges and sandbars, gates, sliders, bare blades, bumpers and rovers. */
function drawMovingPieces(g: Ctx, sk: Skin, place: Place, state: GameState, hole: Hole) {
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
  for (const db of hole.drawbridges) drawDrawbridge(g, sk, place, db, bridgeLevel(db, clock), hole.h, hole.water)
  for (const gate of hole.gates) drawGate(g, sk, gate, gateLevel(gate, clock))
  for (const sl of hole.sliders) {
    const bar = sliderWall(sl, clock)
    g.lineCap = 'round'
    g.strokeStyle = place.railLine
    g.lineWidth = sl.t * 2 + 0.6
    g.beginPath()
    g.moveTo(bar.a.x, bar.a.y)
    g.lineTo(bar.b.x, bar.b.y)
    g.stroke()
    g.strokeStyle = css(place.rail)
    g.lineWidth = sl.t * 2
    g.stroke()
  }
  for (const sp of hole.spinners) {
    // A beam of oak with iron bands, turning on a post.
    const blade = spinnerWall(sp, clock)
    castShadow(g, 2, 0.6, sk.shadow, () => {
      g.lineWidth = SPINNER_T * 2
      g.beginPath()
      g.moveTo(blade.a.x, blade.a.y)
      g.lineTo(blade.b.x, blade.b.y)
      g.stroke()
    })
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
    g.strokeStyle = css(sk.woodLit)
    g.lineWidth = SPINNER_T * 0.8
    g.stroke()
    const len = Math.hypot(blade.b.x - blade.a.x, blade.b.y - blade.a.y) || 1
    const ux = (blade.b.x - blade.a.x) / len
    const uy = (blade.b.y - blade.a.y) / len
    g.strokeStyle = css(mix(sk.stone, BLACK, 0.4))
    g.lineWidth = 0.5
    g.lineCap = 'butt'
    for (const k of [0.12, 0.36, 0.64, 0.88]) {
      const x = blade.a.x + ux * len * k
      const y = blade.a.y + uy * len * k
      g.beginPath()
      g.moveTo(x - uy * SPINNER_T, y + ux * SPINNER_T)
      g.lineTo(x + uy * SPINNER_T, y - ux * SPINNER_T)
      g.stroke()
    }
    g.lineCap = 'round'
    g.beginPath()
    g.arc(sp.x, sp.y, 2, 0, Math.PI * 2)
    g.fillStyle = css(sk.stone)
    g.fill()
    g.strokeStyle = sk.stoneLine
    g.lineWidth = 0.28
    g.stroke()
    g.beginPath()
    g.arc(sp.x, sp.y, 0.8, 0, Math.PI * 2)
    g.fillStyle = css(mix(sk.stone, BLACK, 0.4))
    g.fill()
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
    const flash = state.roverFlash[i] ?? 0
    g.fillStyle = sk.shadow
    g.beginPath()
    g.ellipse(rv.x + LIGHT.x * 0.8, rv.y + LIGHT.y * 0.8, spec.r * 1.1, spec.r * 0.8, 0, 0, Math.PI * 2)
    g.fill()
    if (spec.look === 'crab') {
      drawCrab(g, sk, rv, spec.r, clock, flash)
      return
    }
    g.beginPath()
    g.arc(rv.x, rv.y, spec.r, 0, Math.PI * 2)
    g.fillStyle = css(mix(sk.field, [242, 129, 58], 0.7))
    g.fill()
    g.strokeStyle = sk.line('orange')
    g.lineWidth = 0.35
    g.stroke()
  })
}

/** The sea washing in over its shallows and drawing back, two waves at a time. */
function drawSurf(g: Ctx, sk: Skin, hole: Hole, clock: number) {
  if (hole.waterLook !== 'sea' || !hole.water.length) return
  const loops = outlineOf(hole.water, hole.h)
  g.save()
  loopsPath(g, loops)
  g.clip('evenodd')
  for (const k of [0, 0.5]) {
    const u = (clock * 0.2 + k) % 1
    const w = 1 + Math.sin(u * Math.PI) * 6
    loopsPath(g, loops)
    g.strokeStyle = sk.dark ? `rgba(210, 232, 250, ${0.16 * (1 - u)})` : `rgba(255, 255, 255, ${0.3 * (1 - u)})`
    g.lineWidth = w * 2
    g.stroke()
  }
  g.restore()
}

/** Streaks blowing across open ground that a wind crosses. */
function drawWind(g: Ctx, sk: Skin, hole: Hole, clock: number, ya: number, yb: number) {
  for (const sl of hole.slopes) {
    if (sl.look !== 'wind' || !sl.pull) continue
    const b = boundsOf(sl.shape)
    if (b.y1 < ya || b.y0 > yb) continue
    const mag = Math.hypot(sl.pull.x, sl.pull.y) || 1
    const dx = sl.pull.x / mag
    const dy = sl.pull.y / mag
    const w = b.x1 - b.x0
    const h = b.y1 - b.y0
    g.save()
    loopsPath(g, outlineOfShape(sl.shape, hole.h))
    g.clip('evenodd')
    g.lineCap = 'round'
    g.lineWidth = 0.28
    const n = Math.round((w * h) / 45)
    const rnd = mulberry32(7)
    for (let i = 0; i < n; i++) {
      const bx = rnd() * w
      const by = rnd() * h
      const speed = 16 + rnd() * 10
      const t = clock * speed + rnd() * 100
      const x = b.x0 + ((((bx + dx * t) % w) + w) % w)
      const y = b.y0 + ((((by + dy * t) % h) + h) % h)
      const life = (Math.sin(clock * 1.3 + i) + 1) / 2
      g.strokeStyle = sk.dark ? `rgba(220, 236, 250, ${0.35 * life})` : `rgba(255, 255, 255, ${0.7 * life})`
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x - dx * 3.4, y - dy * 3.4)
      g.stroke()
    }
    g.restore()
  }
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

  const place = placeOf(sk, hole.theme)
  ctx.fillStyle = css(place.rough)
  ctx.fillRect(-2, -2, FIELD_W + 4, len + 4)
  loopsPath(ctx, edgesOf(hole))
  ctx.fillStyle = css(mix(sk.green, sk.stripe, 0.5))
  ctx.fill('evenodd')
  ctx.strokeStyle = place.railLine
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
  if (hole.pits.length) {
    loopsPath(ctx, outlineOf(hole.pits, len))
    ctx.fillStyle = css(sk.dark ? [5, 8, 12] : [52, 62, 74])
    ctx.fill('evenodd')
  }
  for (const db of hole.drawbridges) {
    if (bridgeLevel(db, state.clock) < 0.5) continue
    loopsPath(ctx, outlineOfShape(db.shape, len))
    ctx.fillStyle = css(db.look === 'sandbar' ? place.rough : sk.woodLit)
    ctx.fill('evenodd')
  }
  ctx.strokeStyle = ink(sk, 0.85)
  ctx.lineWidth = 1.6 * px
  for (const gate of hole.gates) {
    if (gateLevel(gate, state.clock) >= 0.5) continue
    ctx.beginPath()
    ctx.moveTo(gate.a.x, gate.a.y)
    ctx.lineTo(gate.b.x, gate.b.y)
    ctx.stroke()
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
  const place = placeOf(sk, hole.theme)
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
  drawSurf(ctx, sk, hole, state.clock)
  drawWind(ctx, sk, hole, state.clock, ya, yb)
  drawMovingPieces(ctx, sk, place, state, hole)
  if (hole.cupPath) paintCup(ctx, sk, cupAt(hole, state.clock))
  const millsInView = hole.mills.filter((m) => m.y + m.reach + 8 > ya && m.y - m.reach - 8 < yb)
  for (const m of millsInView) drawSailShadows(ctx, sk, m, state.clock)

  // ---- aim: a slingshot. Pulled back, the ball rides the pull on two bands from pegs either side of
  // where it sits, and dots run ahead the way it will go, longer and redder the harder the pull, through
  // anything in the way, fainter past it. Out of sand they run shorter, as the shot will. At rest, a
  // ring breathes round the ball: take hold here.
  let shown: Vec = state.ball
  if (state.phase === 'aim') {
    const live = state.aiming !== 'none'
    const power = live ? state.power : 0
    const b = state.ball
    const lie = inAny(hole.sand, b) ? SAND_LIE : 1
    const reach = live ? Math.max(AIM_STUB, power * GUIDE_REACH * lie) : AIM_STUB
    const ux = Math.cos(state.aim)
    const uy = Math.sin(state.aim)
    const end = { x: b.x + ux * reach, y: b.y + uy * reach }
    const dx = end.x - b.x
    const dy = end.y - b.y
    const dist = reach
    // How far the way is clear: past there the dots go on, fainter.
    const stop = aimTrace(state, state.aim, reach)
    const clear = Math.hypot(stop.x - b.x, stop.y - b.y) + 0.3
    const faint = 0.4
    ctx.save()
    if (live) {
      const hue = 48 - power * 44
      const grad = ctx.createLinearGradient(b.x, b.y, end.x, end.y)
      grad.addColorStop(0, 'hsla(48, 92%, 60%, 0.95)')
      grad.addColorStop(1, `hsla(${hue}, 84%, 58%, 0.98)`)
      ctx.fillStyle = grad
      for (let d = BALL_R + 1.6; d < dist - 2.2; d += 2.2) {
        const t = d / Math.max(1, dist)
        ctx.globalAlpha = d > clear ? faint : 1
        ctx.beginPath()
        ctx.arc(b.x + ux * d, b.y + uy * d, 0.42 + 0.3 * t, 0, Math.PI * 2)
        ctx.fill()
      }
      if (dist > BALL_R + 3) {
        ctx.globalAlpha = dist > clear ? faint : 1
        ctx.beginPath()
        ctx.moveTo(end.x + ux * 1.3, end.y + uy * 1.3)
        ctx.lineTo(end.x - ux * 1.5 - uy * 1.5, end.y - uy * 1.5 + ux * 1.5)
        ctx.lineTo(end.x - ux * 1.5 + uy * 1.5, end.y - uy * 1.5 - ux * 1.5)
        ctx.closePath()
        ctx.fillStyle = `hsla(${hue}, 84%, 58%, 0.98)`
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.lineWidth = 0.25
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      // The ball comes back with the pull, as far as the finger has gone, to the full draw.
      const pull = power * MAX_DRAG
      shown = { x: b.x - ux * pull, y: b.y - uy * pull }
      pulledFrom = shown
      // Where it sits, and will fly from: a ring between the pegs.
      ctx.strokeStyle = ink(sk, 0.35)
      ctx.lineWidth = 0.25
      ctx.beginPath()
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
      ctx.stroke()
      // The bands, thinner and redder the further they stretch, and the pouch round the back of the ball.
      const px = -uy
      const py = ux
      const fork = BALL_R + 1.5
      const cup = BALL_R + 0.45
      ctx.strokeStyle = `hsla(${8 - power * 6}, ${62 + power * 20}%, ${sk.dark ? 54 : 42}%, 0.95)`
      ctx.lineWidth = Math.max(0.35, 0.95 - power * 0.5)
      for (const side of [1, -1]) {
        ctx.beginPath()
        ctx.moveTo(b.x + px * fork * side, b.y + py * fork * side)
        ctx.lineTo(shown.x + px * cup * side, shown.y + py * cup * side)
        ctx.stroke()
      }
      ctx.lineWidth = Math.max(0.5, 1.1 - power * 0.4)
      const back = state.aim + Math.PI
      ctx.beginPath()
      ctx.arc(shown.x, shown.y, cup, back - Math.PI / 2, back + Math.PI / 2)
      ctx.stroke()
      // The pegs: the fork the bands are tied to.
      for (const side of [1, -1]) {
        ctx.beginPath()
        ctx.arc(b.x + px * fork * side, b.y + py * fork * side, 0.8, 0, Math.PI * 2)
        ctx.fillStyle = sk.dark ? 'rgba(214, 184, 140, 0.95)' : 'rgba(120, 84, 48, 0.95)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.lineWidth = 0.2
        ctx.stroke()
      }
    } else {
      pulledFrom = null
      if (dist > 0.5) {
        ctx.fillStyle = ink(sk, 0.55)
        for (let d = 3.2; d < dist - 2.5; d += 2.2) {
          ctx.globalAlpha = d > clear ? faint : 1
          ctx.beginPath()
          ctx.arc(b.x + (dx / dist) * d, b.y + (dy / dist) * d, 0.36, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        const a = Math.atan2(dy, dx)
        const tip = { x: b.x + Math.cos(a) * Math.min(dist, 8), y: b.y + Math.sin(a) * Math.min(dist, 8) }
        ctx.beginPath()
        ctx.moveTo(tip.x + Math.cos(a) * 1.8, tip.y + Math.sin(a) * 1.8)
        ctx.lineTo(tip.x + Math.cos(a + 2.4) * 1.5, tip.y + Math.sin(a + 2.4) * 1.5)
        ctx.lineTo(tip.x + Math.cos(a - 2.4) * 1.5, tip.y + Math.sin(a - 2.4) * 1.5)
        ctx.closePath()
        ctx.fill()
      }
      // A ring breathing round the ball: take hold here.
      const breathe = 0.5 + 0.5 * Math.sin(state.clock * 3.2)
      ctx.strokeStyle = ink(sk, 0.2 + 0.25 * breathe)
      ctx.lineWidth = 0.3
      ctx.beginPath()
      ctx.arc(b.x, b.y, BALL_R + 1.5 + breathe * 0.9, 0, Math.PI * 2)
      ctx.stroke()
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
    const b = shown
    // Let go: for a moment, a streak from where the ball was drawn back to where it has got to.
    if (state.phase === 'roll' && pulledFrom && state.t < SNAP_TIME) {
      const a = 1 - state.t / SNAP_TIME
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * a})`
      ctx.lineWidth = BALL_R * 1.5 * a
      ctx.beginPath()
      ctx.moveTo(pulledFrom.x, pulledFrom.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    } else if (state.phase !== 'aim') {
      pulledFrom = null
    }
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

  // ---- what moves round the course: a fountain's jets, a lighthouse's beam, falling water, flags
  for (const p of gardenOf(hole, edgesOf(hole))) {
    if (!isLive(p)) continue
    const reach = p.kind === 'lighthouse' ? 80 : p.r + 12
    if (p.y + reach < ya || p.y - reach > yb) continue
    drawLiveProp(ctx, sk, p, state.clock)
  }

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
  if (state.phase !== 'menu' && showsMap(f)) drawMap(ctx, state, hole, f, sk, dpr, cam)

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
      const sandy = inAny(hole.sand, state.ball)
      if (state.aiming !== 'none') {
        const go = state.aiming === 'key' ? 'RELEASE TO SHOOT' : 'LET GO TO SHOOT'
        cue = `${Math.round(state.power * 100)}%  ·  ${sandy ? 'IN THE SAND, IT COMES OUT SHORT' : go}`
      } else if (sandy && !ballOff) {
        cue = 'IN THE SAND  ·  A SHOT OUT OF IT COMES OUT SHORT'
      } else if (ballOff) {
        cue = 'LOOKING AHEAD  ·  PULL BACK FROM THE BALL AND THE VIEW COMES BACK'
      } else {
        cue = showsMap(f) ? 'PULL BACK FROM THE BALL, LET GO TO SHOOT  ·  MAP OR SCROLL TO LOOK' : 'PULL BACK FROM THE BALL, LET GO TO SHOOT'
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
  strips = []
}

/** The steps along the edge that each kind of rail sets its details at. */
const RAIL_MARKS: Record<Hole['theme'], number[]> = {
  garden: [],
  formal: [2.1, 0.8],
  castle: [3.2],
  coast: [1.1, 7.5],
  summit: [1.7, 4.3],
}

/**
 * Work out everything a hole needs before it is first drawn — its traced
 * edge, its garden, the outlines of its water, sand, drops and bridges, and
 * where its rail's details go — so the first frame of it does not stall.
 */
export function warmHole(hole: Hole) {
  const edges = edgesOf(hole)
  gardenOf(hole, edges)
  outlineOf(hole.water, hole.h)
  outlineOf(hole.sand, hole.h)
  outlineOf(hole.pits, hole.h)
  for (const sh of [...hole.bridges, ...hole.drawbridges.map((db) => db.shape), ...hole.slopes.map((sl) => sl.shape), ...hole.paving]) {
    outlineOfShape(sh, hole.h)
  }
  for (const step of RAIL_MARKS[hole.theme]) marksAlong(hole, step)
}
