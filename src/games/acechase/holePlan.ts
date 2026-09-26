import { hashString, mulberry32 } from '../../lib/seededRandom'
import { RINGS, type HoleDef, type Pt, type Spot, type Style } from './physics'

/*
 * A hole drawn from above, the way a yardage book draws one: the green shaded by its slopes, on the ground
 * round it, with its rails, the target and the tee. Play runs left to right. It's how Today's Hole shows
 * itself off the course, on the Events page and the game's page, before anyone plays it.
 *
 * The colours are the scene's (scene.ts, PLACES), for a picture with no light but its own.
 */

type Palette = {
  /** The ground round the course. */
  off: number
  stripes: readonly [number, number]
  /** Where the green is sheer. */
  steep: number
  /** Where a ball is lost: water, open water through the ice, the crater's floor. */
  lost: number
  rail: number
  cap: number
  cushion: number
  /** The rubber banks and posts: black, the banks with a gold top. */
  rubber: number
  target: { bull: number; ring: number; outer: number; line: number }
  props: 'trees' | 'craters' | 'none'
}

const PALETTES: Record<Style, Palette> = {
  garden: {
    off: 0x4b7d3d,
    stripes: [0x3f9f55, 0x359149],
    steep: 0x857462,
    lost: 0x2f7ea3,
    rail: 0x8a6440,
    cap: 0xf2eee4,
    cushion: 0xffffff,
    rubber: 0x1f2124,
    target: { bull: 0x2eb8a0, ring: 0xf7f5ee, outer: 0x22364a, line: 0x22364a },
    props: 'trees',
  },
  ice: {
    off: 0xd3dee8,
    stripes: [0xe3f0f9, 0xd8e8f4],
    steep: 0xbfd3e3,
    lost: 0x1f4e79,
    rail: 0xf3f6f9,
    cap: 0x2b6cb0,
    cushion: 0xffffff,
    rubber: 0x1f2124,
    target: { bull: 0xd6333a, ring: 0xf8f8f6, outer: 0x2f68c7, line: 0x1a2b3c },
    props: 'none',
  },
  moon: {
    off: 0x57595d,
    stripes: [0x9c9ea2, 0x95979b],
    steep: 0x6f7176,
    lost: 0x2e3034,
    rail: 0x8d96a1,
    cap: 0x2eb8a0,
    cushion: 0x9aa8bf,
    rubber: 0x1f2124,
    target: { bull: 0x2eb8a0, ring: 0xe8edf2, outer: 0x22364a, line: 0x22364a },
    props: 'craters',
  },
}

const GOLD = 0xf5b942

const css = (hex: number, alpha = 1) =>
  `rgba(${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255}, ${alpha})`

/** Samples a metre, for the shading; the edges are drawn sharp at any size. */
const SAMPLES = 12
/** Round the green, in metres, at the least. */
const PAD = 1.4
/** How much steeper than they are the slopes are shaded, so a gentle roll still reads. */
const RELIEF = 2.6
/** The light, from the top left of the picture: from back up the hole and to its left. */
const LIGHT = (() => {
  const v = [-0.55, 0.75, 0.5]
  const n = Math.hypot(v[0]!, v[1]!, v[2]!)
  return [v[0]! / n, v[1]! / n, v[2]! / n] as const
})()

type View = {
  /** Metres to pixels. */
  s: number
  /** The picture's left edge, as a distance down the hole (−z), and its top, across it (x). */
  u0: number
  v0: number
}

/** Down the hole is to the right, the player's right is down the picture. */
const toPx = (view: View, x: number, z: number): [number, number] => [(-z - view.u0) * view.s, (x - view.v0) * view.s]

function boundsOf(green: readonly Pt[]) {
  const xs = green.map((p) => p[0])
  const zs = green.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
}

/** The whole hole, with room round it, fitted to the picture. */
function fit(def: HoleDef, width: number, height: number): View {
  const b = boundsOf(def.green)
  const long = b.z1 - b.z0 + PAD * 2
  const wide = b.x1 - b.x0 + PAD * 2
  const s = Math.min(width / long, height / wide)
  return { s, u0: -b.z1 - (width / s - (b.z1 - b.z0)) / 2, v0: b.x0 - (height / s - (b.x1 - b.x0)) / 2 }
}

function greenPath(ctx: CanvasRenderingContext2D, view: View, green: readonly Pt[]) {
  ctx.beginPath()
  green.forEach(([x, z], i) => {
    const [px, py] = toPx(view, x, z)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
}

function inside(green: readonly Pt[], x: number, z: number): boolean {
  let hit = false
  for (let i = 0, j = green.length - 1; i < green.length; j = i++) {
    const [xi, zi] = green[i]!
    const [xj, zj] = green[j]!
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit
  }
  return hit
}

function distanceToGreen(green: readonly Pt[], x: number, z: number): number {
  if (inside(green, x, z)) return 0
  let best = Infinity
  for (let i = 0, j = green.length - 1; i < green.length; j = i++) {
    const [ax, az] = green[j]!
    const [bx, bz] = green[i]!
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)))
  }
  return best
}

/** Trees round a garden, craters round the Moon: in the same places every time a hole is drawn. */
function drawProps(ctx: CanvasRenderingContext2D, view: View, def: HoleDef, pal: Palette, width: number, height: number) {
  if (pal.props === 'none') return
  const r = mulberry32(hashString(`plan:${def.name}`))
  const count = pal.props === 'trees' ? 70 : 34
  for (let i = 0; i < count; i++) {
    const u = view.u0 + (r() * 1.1 - 0.05) * (width / view.s)
    const v = view.v0 + (r() * 1.1 - 0.05) * (height / view.s)
    const x = v
    const z = -u
    const size = pal.props === 'trees' ? 0.8 + r() * 0.9 : 0.4 + r() ** 2 * 2.2
    if (distanceToGreen(def.green, x, z) < size + 0.7) continue
    const [px, py] = toPx(view, x, z)
    const rad = size * view.s
    if (pal.props === 'trees') {
      ctx.fillStyle = 'rgba(12, 32, 14, 0.32)'
      ctx.beginPath()
      ctx.arc(px + rad * 0.3, py + rad * 0.35, rad, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = css(r() < 0.5 ? 0x2f6b34 : 0x3a7a3a)
      ctx.beginPath()
      ctx.arc(px, py, rad, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(160, 210, 120, 0.22)'
      ctx.beginPath()
      ctx.arc(px - rad * 0.28, py - rad * 0.3, rad * 0.55, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // A crater: its floor in shadow, its far wall in the light, a rim thrown up round it.
      ctx.fillStyle = 'rgba(20, 21, 24, 0.35)'
      ctx.beginPath()
      ctx.arc(px, py, rad, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(190, 193, 198, 0.22)'
      ctx.beginPath()
      ctx.arc(px + rad * 0.22, py + rad * 0.22, rad * 0.78, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(200, 203, 208, 0.3)'
      ctx.lineWidth = Math.max(1, rad * 0.14)
      ctx.beginPath()
      ctx.arc(px, py, rad * 1.05, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

/** The green's ground: mown in stripes, lighter where it's high, shaded by its slopes, sheer in places. */
function shadeGreen(def: HoleDef, spot: Spot, pal: Palette): HTMLCanvasElement {
  const b = boundsOf(def.green)
  const cols = Math.ceil((b.z1 - b.z0) * SAMPLES) + 3
  const rows = Math.ceil((b.x1 - b.x0) * SAMPLES) + 3
  const step = 1 / SAMPLES
  const u0 = -b.z1 - step
  const v0 = b.x0 - step
  const h = new Float32Array(cols * rows)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) h[j * cols + i] = def.height(v0 + j * step, -(u0 + i * step), spot)
  }
  const stripeA = [(pal.stripes[0] >> 16) & 255, (pal.stripes[0] >> 8) & 255, pal.stripes[0] & 255]
  const stripeB = [(pal.stripes[1] >> 16) & 255, (pal.stripes[1] >> 8) & 255, pal.stripes[1] & 255]
  const rock = [(pal.steep >> 16) & 255, (pal.steep >> 8) & 255, pal.steep & 255]
  const lost = [(pal.lost >> 16) & 255, (pal.lost >> 8) & 255, pal.lost & 255]
  const flat = LIGHT[1]
  const out = document.createElement('canvas')
  out.width = cols
  out.height = rows
  const octx = out.getContext('2d')!
  const img = octx.createImageData(cols, rows)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const at = j * cols + i
      const y = h[at]!
      const z = -(u0 + i * step)
      // Slopes along x and z, from the samples either side.
      const gx = (h[Math.min(rows - 1, j + 1) * cols + i]! - h[Math.max(0, j - 1) * cols + i]!) / (2 * step)
      const gz = -(h[j * cols + Math.min(cols - 1, i + 1)]! - h[j * cols + Math.max(0, i - 1)]!) / (2 * step)
      let c: number[]
      if (def.water != null && y < def.water) {
        c = lost.map((v) => v * (1 + Math.max(-0.25, (y - def.water!) * 0.12)))
      } else {
        c = Math.floor((z + 100) / 0.75) % 2 ? stripeA : stripeB
        const steep = Math.hypot(gx, gz)
        const lift = 1 + Math.max(-0.1, Math.min(0.09, y * 0.09))
        c = c.map((v) => v * lift)
        if (steep > 0.9) {
          const t = Math.min(1, (steep - 0.9) / 0.8)
          c = c.map((v, k) => v + (rock[k]! - v) * t)
        }
      }
      // Lit from the top left, the slopes steepened so they read.
      const nx = -gx * RELIEF
      const nz = -gz * RELIEF
      const nl = Math.hypot(nx, 1, nz)
      const lit = (nx * LIGHT[0] + LIGHT[1] + nz * LIGHT[2]) / nl / flat
      const shade = Math.max(0.55, Math.min(1.35, lit))
      img.data[at * 4] = Math.min(255, c[0]! * shade)
      img.data[at * 4 + 1] = Math.min(255, c[1]! * shade)
      img.data[at * 4 + 2] = Math.min(255, c[2]! * shade)
      img.data[at * 4 + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  return out
}

function stroke(ctx: CanvasRenderingContext2D, view: View, ax: number, az: number, bx: number, bz: number) {
  const [x0, y0] = toPx(view, ax, az)
  const [x1, y1] = toPx(view, bx, bz)
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
}

type Rail = { a: Pt; b: Pt; body: string; cap: string; wide: number }

/** Rails seen from above: every body first, then every cap along their tops, so the joins run clean. */
function drawRails(ctx: CanvasRenderingContext2D, view: View, rails: readonly Rail[]) {
  for (const pass of ['body', 'cap'] as const) {
    for (const r of rails) {
      ctx.strokeStyle = pass === 'body' ? r.body : r.cap
      ctx.lineWidth = pass === 'body' ? Math.max(1.5, r.wide * view.s) : Math.max(0.8, r.wide * 0.42 * view.s)
      stroke(ctx, view, r.a[0], r.a[1], r.b[0], r.b[1])
    }
  }
}

/**
 * Draw a hole from above onto a canvas `width` by `height` CSS pixels, at `dpr` device pixels each, its
 * target at `spot`.
 */
export function drawHolePlan(canvas: HTMLCanvasElement, def: HoleDef, spot: Spot, width: number, height: number, dpr = 1) {
  const style: Style = def.style ?? 'garden'
  const pal = PALETTES[style]
  canvas.width = Math.max(1, Math.round(width * dpr))
  canvas.height = Math.max(1, Math.round(height * dpr))
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const view = fit(def, width, height)

  ctx.fillStyle = css(pal.off)
  ctx.fillRect(0, 0, width, height)
  drawProps(ctx, view, def, pal, width, height)

  // The course stands on its banks, a little above the ground round it. (A shadow is in device pixels.)
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = Math.max(2, view.s * 0.5) * dpr
  ctx.shadowOffsetX = view.s * 0.18 * dpr
  ctx.shadowOffsetY = view.s * 0.22 * dpr
  greenPath(ctx, view, def.green)
  ctx.fillStyle = css(pal.stripes[1])
  ctx.fill()
  ctx.restore()

  // The ground, clipped to the green so its edge is sharp.
  const b = boundsOf(def.green)
  const shaded = shadeGreen(def, spot, pal)
  const step = 1 / SAMPLES
  const [left, top] = toPx(view, b.x0 - step, b.z1 + step)
  ctx.save()
  greenPath(ctx, view, def.green)
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(shaded, left, top, shaded.width * step * view.s, shaded.height * step * view.s)
  ctx.restore()

  // The target, painted on the ground: the outer ring, the ring, the bull, and the lines between.
  const [tx, ty] = toPx(view, spot.x, spot.z)
  const rings: [number, number][] = [
    [RINGS[2], pal.target.outer],
    [RINGS[1], pal.target.ring],
    [RINGS[0], pal.target.bull],
  ]
  for (const [r, colour] of rings) {
    ctx.fillStyle = css(colour)
    ctx.beginPath()
    ctx.arc(tx, ty, r * view.s, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = css(pal.target.line, 0.8)
    ctx.lineWidth = Math.max(0.75, 0.05 * view.s)
    ctx.stroke()
  }

  // The rails round the edge, a cushion where one is soft; the rails and posts standing on the green.
  const g = def.green
  const rails: Rail[] = g.map((a, i) => {
    const b = g[(i + 1) % g.length]!
    return def.soft?.((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
      ? { a, b, body: css(pal.cushion), cap: css(pal.cushion), wide: 0.34 }
      : { a, b, body: css(pal.rail), cap: css(pal.cap), wide: 0.24 }
  })
  for (const w of def.walls ?? []) {
    rails.push({
      a: [w.ax, w.az],
      b: [w.bx, w.bz],
      body: css(w.rubber ? pal.rubber : pal.rail),
      cap: css(w.rubber ? GOLD : pal.cap),
      wide: 0.24,
    })
  }
  drawRails(ctx, view, rails)
  for (const p of def.bumpers ?? []) {
    const [px, py] = toPx(view, p.x, p.z)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.beginPath()
    ctx.arc(px + view.s * 0.08, py + view.s * 0.1, p.r * view.s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = css(pal.rubber)
    ctx.beginPath()
    ctx.arc(px, py, p.r * view.s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.beginPath()
    ctx.arc(px - p.r * 0.25 * view.s, py - p.r * 0.25 * view.s, p.r * 0.45 * view.s, 0, Math.PI * 2)
    ctx.fill()
  }

  // The ball on the tee.
  const [bx, by] = toPx(view, def.tee.x, def.tee.z)
  const ball = Math.max(2.5, 0.2 * view.s)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.arc(bx + ball * 0.3, by + ball * 0.35, ball, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(bx, by, ball, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(20, 30, 40, 0.55)'
  ctx.lineWidth = 1
  ctx.stroke()
}
