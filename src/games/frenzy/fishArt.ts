import type { FishArt, FinKind, TailKind } from './species'

/*
 * One renderer draws every fish from its species' parameters. The body is
 * sampled along a spine that carries a travelling wave — the head steady,
 * the tail whipping — so every fish actually swims instead of sliding a
 * stiff shape around. It is drawn the arcade's way, a soft fill inside a
 * clean outline in one palette colour; a pattern, fins that flutter, an eye
 * that looks where it means to go and a mouth that opens when it is about to
 * bite do the rest.
 *
 * Drawn in the fish's own frame: +x is forward, the caller has already
 * translated to the fish, rotated to its heading and flipped it upright.
 */

export type Glow = { x: number; y: number; r: number; color: string; strength: number }

export type FishPose = {
  /** On-screen body length, px. */
  length: number
  /** Swim phase, radians. */
  swim: number
  /** Swim amplitude: ~0.35 drifting, 1 cruising, 1.4 sprinting. */
  amp: number
  /** 0 closed … 1 wide open. */
  mouth: number
  /** Where the eye looks, in the fish's own frame. */
  lookX: number
  lookY: number
  /** 0..1: the red stare of a predator that has seen you. */
  alarm: number
  /** 0..1 puffer inflation. */
  puff: number
  /** Seconds, for lures and shimmer. */
  time: number
}

/**
 * Every colour a fish is drawn in, handed over by the renderer: the fish's
 * palette colour mixed over the water it is swimming in.
 */
export type FishPaint = {
  body: string
  fin: string
  tail: string
  line: string
  /** A tail in a second colour is outlined in it too, or it reads as grey. */
  tailLine: string
  pattern: string
  eye: string
  pupil: string
  mouth: string
  teeth: string
}

const U = [0, 0.1, 0.3, 0.55, 0.8, 1] as const
const ROUND = [0.62, 0.96, 1, 1, 0.86, 0.46] as const

function thickness(profile: FishArt['profile'], u: number, puff: number) {
  for (let i = 0; i < 5; i++) {
    const u0 = U[i]!
    const u1 = U[i + 1]!
    if (u <= u1) {
      const t = (u - u0) / (u1 - u0)
      const s = (1 - Math.cos(t * Math.PI)) / 2
      let p = profile[i]! + (profile[i + 1]! - profile[i]!) * s
      if (puff > 0) {
        const q = ROUND[i]! + (ROUND[i + 1]! - ROUND[i]!) * s
        p += (q - p) * puff
      }
      return p
    }
  }
  return profile[5]
}

const S = 10
const topX = new Float64Array(S + 1)
const topY = new Float64Array(S + 1)
const botX = new Float64Array(S + 1)
const botY = new Float64Array(S + 1)
const spineY = new Float64Array(S + 1)

let curL = 0
let curH = 0
let curA = 0
let curSwim = 0
let curPuff = 0
let curProfile: FishArt['profile'] = [0, 0, 0, 0, 0, 0]

function spineAt(u: number) {
  return curA * Math.pow(u, 1.5) * Math.sin(curSwim - u * 2.5)
}

function edgeAt(u: number, side: -1 | 1) {
  const x = curL / 2 - u * curL
  const t = (thickness(curProfile, u, curPuff) * curH) / 2
  return { x, y: spineAt(u) + side * t }
}

function buildBody(art: FishArt, L: number, H: number, pose: FishPose) {
  const stiff = art.tail === 'lunate' ? 0.55 : art.tail === 'fork' ? 0.85 : 1
  curL = L
  curH = H
  curA = H * 0.17 * pose.amp * stiff
  curSwim = pose.swim
  curPuff = pose.puff
  curProfile = art.profile
  for (let i = 0; i <= S; i++) {
    const u = i / S
    const x = L / 2 - u * L
    const ys = spineAt(u)
    const t = (thickness(art.profile, u, pose.puff) * H) / 2
    topX[i] = x
    topY[i] = ys - t
    botX[i] = x
    botY[i] = ys + t
    spineY[i] = ys
  }
}

function bodyPath(ctx: CanvasRenderingContext2D, H: number) {
  const noseX = topX[0]! + H * 0.07
  const noseY = spineY[0]!
  ctx.beginPath()
  ctx.moveTo(noseX, noseY)
  ctx.quadraticCurveTo(topX[0]! + H * 0.03, topY[0]!, (topX[0]! + topX[1]!) / 2, (topY[0]! + topY[1]!) / 2)
  for (let i = 1; i < S; i++) {
    ctx.quadraticCurveTo(topX[i]!, topY[i]!, (topX[i]! + topX[i + 1]!) / 2, (topY[i]! + topY[i + 1]!) / 2)
  }
  ctx.lineTo(topX[S]!, topY[S]!)
  ctx.lineTo(botX[S]!, botY[S]!)
  for (let i = S - 1; i >= 1; i--) {
    ctx.quadraticCurveTo(botX[i]!, botY[i]!, (botX[i]! + botX[i - 1]!) / 2, (botY[i]! + botY[i - 1]!) / 2)
  }
  ctx.quadraticCurveTo(botX[0]! + H * 0.03, botY[0]!, noseX, noseY)
  ctx.closePath()
}

function tailPath(ctx: CanvasRenderingContext2D, kind: TailKind, T: number, h1: number, flow: number) {
  ctx.beginPath()
  ctx.moveTo(-1, -h1)
  if (kind === 'fork') {
    ctx.quadraticCurveTo(T * 0.45, -h1 - T * 0.18, T, -T * 0.74)
    ctx.quadraticCurveTo(T * 0.62, -T * 0.16, T * 0.55, 0)
    ctx.quadraticCurveTo(T * 0.62, T * 0.16, T, T * 0.74)
    ctx.quadraticCurveTo(T * 0.45, h1 + T * 0.18, -1, h1)
  } else if (kind === 'lunate') {
    ctx.quadraticCurveTo(T * 0.3, -h1 - T * 0.3, T * 0.95, -T)
    ctx.quadraticCurveTo(T * 0.55, -T * 0.28, T * 0.4, 0)
    ctx.quadraticCurveTo(T * 0.55, T * 0.28, T * 0.95, T)
    ctx.quadraticCurveTo(T * 0.3, h1 + T * 0.3, -1, h1)
  } else if (kind === 'round') {
    ctx.bezierCurveTo(T * 0.35, -h1 - T * 0.55, T * 1.05, -T * 0.62, T * 1.05, 0)
    ctx.bezierCurveTo(T * 1.05, T * 0.62, T * 0.35, h1 + T * 0.55, -1, h1)
  } else {
    // A veil: two soft lobes with a notch between them, rippling.
    ctx.bezierCurveTo(T * 0.3, -h1 - T * 0.3, T * 0.8, -T * 0.62, T * 1.1, -T * (0.5 - flow * 0.08))
    ctx.quadraticCurveTo(T * 0.86, -T * 0.1, T * 0.72, flow * T * 0.05)
    ctx.quadraticCurveTo(T * 0.86, T * 0.1, T * 1.1, T * (0.5 + flow * 0.08))
    ctx.bezierCurveTo(T * 0.8, T * 0.62, T * 0.3, h1 + T * 0.3, -1, h1)
  }
  ctx.closePath()
}

type FinShape = { a: number; b: number; height: (t: number) => number; sweep: number }

function finShapes(kind: FinKind, size: number, side: -1 | 1, H: number, time: number): FinShape[] {
  const flutter = (t: number) => 1 + 0.07 * Math.sin(time * 6 + t * 4)
  const h = H * size
  switch (kind) {
    case 'none':
      return []
    case 'small':
      return [{ a: 0.36, b: 0.62, sweep: 0.3, height: (t) => h * Math.pow(Math.sin(Math.PI * t), 1.1) * flutter(t) }]
    case 'triangle':
      return [
        {
          a: 0.3,
          b: 0.52,
          sweep: 0.6,
          height: (t) => h * (t < 0.3 ? t / 0.3 : Math.pow((1 - t) / 0.7, 1.4)),
        },
      ]
    case 'sail':
      return [
        {
          a: 0.1,
          b: 0.58,
          sweep: 0.22,
          height: (t) =>
            h * (t < 0.12 ? t / 0.12 : 1 - ((t - 0.12) / 0.88) * 0.82) * (1 - 0.06 * Math.sin(t * 20)) * flutter(t),
        },
      ]
    case 'long': {
      // Rises fast, then sweeps back to a trailing point past the tail.
      const shape = (t: number) => (t < 0.28 ? t / 0.28 : 1 - ((t - 0.28) / 0.72) * 0.45) * flutter(t)
      return side < 0
        ? [{ a: 0.18, b: 1, sweep: 1.3, height: (t) => h * shape(t) }]
        : [{ a: 0.42, b: 1, sweep: 1.3, height: (t) => h * 0.85 * shape(t) }]
    }
    case 'spiky':
      return [
        {
          a: 0.18,
          b: 0.76,
          sweep: 0.2,
          height: (t) => h * (0.45 + 0.55 * Math.sin(Math.PI * t)) * (0.62 + 0.38 * Math.abs(Math.sin(t * Math.PI * 5.5))),
        },
      ]
    case 'double':
      return [
        { a: 0.22, b: 0.44, sweep: 0.3, height: (t) => h * Math.pow(Math.sin(Math.PI * t), 1.1) * flutter(t) },
        { a: 0.5, b: 0.74, sweep: 0.3, height: (t) => h * 0.78 * Math.pow(Math.sin(Math.PI * t), 1.1) * flutter(t) },
      ]
  }
}

function drawFin(ctx: CanvasRenderingContext2D, fin: FinShape, side: -1 | 1) {
  const M = 9
  const baseX: number[] = []
  const baseY: number[] = []
  for (let k = 0; k <= M; k++) {
    const u = fin.a + ((fin.b - fin.a) * k) / M
    const p = edgeAt(u, side)
    // Rooted a little inside the body so the join is hidden under it.
    const inset = ((thickness(curProfile, u, curPuff) * curH) / 2) * 0.25
    baseX.push(p.x)
    baseY.push(p.y - side * inset)
  }
  ctx.beginPath()
  ctx.moveTo(baseX[0]!, baseY[0]!)
  for (let k = 1; k <= M; k++) ctx.lineTo(baseX[k]!, baseY[k]!)
  for (let k = M; k >= 0; k--) {
    const t = k / M
    const h = fin.height(t)
    ctx.lineTo(baseX[k]! - fin.sweep * h * (0.3 + t), baseY[k]! + side * h)
  }
  ctx.closePath()
}

function seeded(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  art: FishArt,
  paint: FishPaint,
  L: number,
  H: number,
  seed: number,
  glows: Glow[] | null,
) {
  const color = paint.pattern
  const outline = paint.line
  const xAt = (u: number) => L / 2 - u * L
  switch (art.pattern) {
    case 'none':
      return
    case 'bands': {
      const bands: [number, number][] = [
        [0.19, 0.1],
        [0.5, 0.12],
        [0.81, 0.08],
      ]
      for (const [u, w] of bands) {
        const x = xAt(u)
        ctx.fillStyle = color
        ctx.fillRect(x - (w * L) / 2, spineAt(u) - H, w * L, H * 2)
        ctx.strokeStyle = outline
        ctx.lineWidth = Math.max(1, L * 0.014)
        ctx.beginPath()
        ctx.moveTo(x - (w * L) / 2, spineAt(u) - H)
        ctx.lineTo(x - (w * L) / 2, spineAt(u) + H)
        ctx.moveTo(x + (w * L) / 2, spineAt(u) - H)
        ctx.lineTo(x + (w * L) / 2, spineAt(u) + H)
        ctx.stroke()
      }
      return
    }
    case 'bars': {
      const tall = art.height > 0.5
      const us = tall ? [0.3, 0.55, 0.8] : [0.28, 0.4, 0.52, 0.64, 0.76, 0.88]
      const w = tall ? 0.075 : 0.035
      ctx.fillStyle = color
      ctx.globalAlpha *= 0.55
      for (const u of us) {
        const x = xAt(u)
        const top = spineAt(u) - H
        ctx.fillRect(x - (w * L) / 2, top, w * L, tall ? H * 2 : H * 1.05)
      }
      ctx.globalAlpha /= 0.55
      return
    }
    case 'spots':
    case 'mottled': {
      const rand = seeded(seed)
      const count = art.pattern === 'spots' ? 14 : 9
      ctx.fillStyle = color
      const alpha = art.pattern === 'spots' ? 0.7 : 0.42
      ctx.globalAlpha *= alpha
      for (let i = 0; i < count; i++) {
        const u = 0.12 + rand() * 0.8
        const half = (thickness(art.profile, u, 0) * H) / 2
        const v = -0.85 + rand() * 1.5
        const x = xAt(u)
        const y = spineAt(u) + v * half
        ctx.beginPath()
        if (art.pattern === 'spots') {
          ctx.arc(x, y, H * (0.035 + rand() * 0.035), 0, Math.PI * 2)
        } else {
          ctx.ellipse(x, y, H * (0.1 + rand() * 0.08), H * (0.06 + rand() * 0.05), rand() * Math.PI, 0, Math.PI * 2)
        }
        ctx.fill()
      }
      ctx.globalAlpha /= alpha
      return
    }
    case 'lateral': {
      ctx.lineCap = 'round'
      ctx.strokeStyle = color
      ctx.globalAlpha *= 0.55
      ctx.lineWidth = Math.max(1, H * 0.08)
      ctx.beginPath()
      for (let i = 1; i <= 9; i++) {
        const u = 0.1 + (i / 9) * 0.82
        const y = spineAt(u) - H * 0.1
        if (i === 1) ctx.moveTo(xAt(u), y)
        else ctx.lineTo(xAt(u), y)
      }
      ctx.stroke()
      ctx.globalAlpha /= 0.55
      ctx.strokeStyle = outline
      ctx.globalAlpha *= 0.3
      ctx.lineWidth = Math.max(0.8, H * 0.035)
      ctx.beginPath()
      for (let i = 1; i <= 9; i++) {
        const u = 0.14 + (i / 9) * 0.8
        const y = spineAt(u) + H * 0.02
        if (i === 1) ctx.moveTo(xAt(u), y)
        else ctx.lineTo(xAt(u), y)
      }
      ctx.stroke()
      ctx.globalAlpha /= 0.3
      return
    }
    case 'swoosh': {
      ctx.strokeStyle = color
      ctx.lineCap = 'round'
      ctx.globalAlpha *= 0.88
      ctx.lineWidth = H * 0.17
      ctx.beginPath()
      ctx.moveTo(xAt(0.26), spineAt(0.26) - H * 0.12)
      ctx.quadraticCurveTo(xAt(0.52), spineAt(0.52) + H * 0.45, xAt(0.9), spineAt(0.9) - H * 0.05)
      ctx.stroke()
      ctx.lineWidth = H * 0.08
      ctx.beginPath()
      ctx.moveTo(xAt(0.3), spineAt(0.3) - H * 0.3)
      ctx.quadraticCurveTo(xAt(0.55), spineAt(0.55) - H * 0.42, xAt(0.8), spineAt(0.8) - H * 0.18)
      ctx.stroke()
      ctx.globalAlpha /= 0.88
      return
    }
    case 'photophores': {
      const glowColor = art.glow ?? color
      ctx.fillStyle = glowColor
      for (let i = 0; i < 9; i++) {
        const u = 0.14 + (i / 8) * 0.74
        const half = (thickness(art.profile, u, 0) * H) / 2
        const x = xAt(u)
        const y = spineAt(u) + half * 0.55
        const r = Math.max(0.9, H * 0.045)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        if (glows && i % 2 === 0) glows.push({ x, y, r: r * 5, color: glowColor, strength: 0.5 })
      }
      return
    }
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, art: FishArt, paint: FishPaint, L: number, H: number, open: number) {
  const nx = topX[0]! + H * 0.07
  const ny = spineY[0]!
  const inner = paint.mouth
  const line = paint.line
  const teeth = paint.teeth
  ctx.lineWidth = Math.max(1, L * 0.018)
  ctx.strokeStyle = line
  if (art.mouth === 'jaws') {
    const o = 0.35 + 0.65 * open
    ctx.fillStyle = inner
    ctx.beginPath()
    ctx.moveTo(nx + H * 0.04, ny - H * 0.1)
    ctx.lineTo(nx - L * 0.3, ny + H * 0.06)
    ctx.lineTo(nx + H * 0.02, ny + H * (0.1 + 0.4 * o))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = teeth
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5
      const ux = nx + H * 0.04 + (nx - L * 0.3 - (nx + H * 0.04)) * t
      const uy = ny - H * 0.1 + (H * 0.16) * t
      ctx.beginPath()
      ctx.moveTo(ux - H * 0.025, uy)
      ctx.lineTo(ux + H * 0.025, uy)
      ctx.lineTo(ux, uy + H * 0.13 * (1 - t * 0.4))
      ctx.fill()
      const lx = nx + H * 0.02 + (nx - L * 0.3 - (nx + H * 0.02)) * t
      const ly = ny + H * (0.1 + 0.4 * o) + (H * 0.06 - H * (0.1 + 0.4 * o)) * t
      ctx.beginPath()
      ctx.moveTo(lx - H * 0.025, ly)
      ctx.lineTo(lx + H * 0.025, ly)
      ctx.lineTo(lx, ly - H * 0.12 * (1 - t * 0.4))
      ctx.fill()
    }
    return
  }
  if (art.mouth === 'under') {
    if (open < 0.06) {
      ctx.globalAlpha *= 0.6
      ctx.beginPath()
      ctx.moveTo(nx - L * 0.03, ny + H * 0.2)
      ctx.quadraticCurveTo(nx - L * 0.1, ny + H * 0.26, nx - L * 0.17, ny + H * 0.2)
      ctx.stroke()
      ctx.globalAlpha /= 0.6
      return
    }
    ctx.fillStyle = inner
    ctx.beginPath()
    ctx.moveTo(nx - L * 0.02, ny + H * 0.08)
    ctx.lineTo(nx - L * 0.19, ny + H * 0.16)
    ctx.lineTo(nx - L * 0.05, ny + H * (0.16 + 0.36 * open))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = teeth
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4
      const x = nx - L * 0.02 + (-L * 0.15) * t
      const y = ny + H * 0.08 + H * 0.08 * t
      ctx.beginPath()
      ctx.moveTo(x - H * 0.02, y)
      ctx.lineTo(x + H * 0.02, y)
      ctx.lineTo(x, y + H * 0.08)
      ctx.fill()
    }
    return
  }
  const wide = art.mouth === 'wide'
  if (open < 0.08) {
    ctx.globalAlpha *= 0.55
    ctx.beginPath()
    ctx.moveTo(nx - H * 0.01, ny + H * 0.04)
    ctx.lineTo(nx - L * (wide ? 0.14 : 0.07), ny + H * (wide ? 0.1 : 0.06))
    ctx.stroke()
    ctx.globalAlpha /= 0.55
    return
  }
  ctx.fillStyle = inner
  ctx.beginPath()
  ctx.moveTo(nx + H * 0.01, ny - H * (wide ? 0.16 : 0.12) * open)
  ctx.lineTo(nx - L * (wide ? 0.16 : 0.1), ny + H * 0.03)
  ctx.lineTo(nx, ny + H * (wide ? 0.22 : 0.14) * open)
  ctx.closePath()
  ctx.fill()
}

function drawEye(ctx: CanvasRenderingContext2D, art: FishArt, paint: FishPaint, L: number, H: number, pose: FishPose) {
  const eu = art.mouth === 'jaws' ? 0.21 : 0.14
  const ex = L / 2 - eu * L
  const ey = spineAt(eu) - H * (art.mouth === 'jaws' ? 0.22 : 0.1)
  const er = Math.max(1.3, H * art.eye)
  ctx.fillStyle = paint.eye
  ctx.beginPath()
  ctx.arc(ex, ey, er, 0, Math.PI * 2)
  ctx.fill()
  if (pose.alarm > 0.02) {
    ctx.fillStyle = `rgba(255, 52, 40, ${Math.min(1, pose.alarm)})`
    ctx.beginPath()
    ctx.arc(ex, ey, er * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }
  const len = Math.hypot(pose.lookX, pose.lookY) || 1
  const px = ex + (pose.lookX / len) * er * 0.32
  const py = ey + (pose.lookY / len) * er * 0.32
  ctx.fillStyle = paint.pupil
  ctx.beginPath()
  ctx.arc(px, py, er * 0.56, 0, Math.PI * 2)
  ctx.fill()
  if (er > 2.2) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.beginPath()
    ctx.arc(px - er * 0.2, py - er * 0.22, er * 0.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.lineWidth = Math.max(0.8, L * 0.012)
  ctx.strokeStyle = paint.line
  ctx.beginPath()
  ctx.arc(ex, ey, er, 0, Math.PI * 2)
  ctx.stroke()
}

/** A few pixels long: a lozenge and a tail, nothing that would only read as noise. */
function drawTiny(ctx: CanvasRenderingContext2D, art: FishArt, paint: FishPaint, L: number, H: number, pose: FishPose, glows: Glow[] | null) {
  const wag = Math.sin(pose.swim) * H * 0.25
  ctx.fillStyle = paint.tail
  ctx.beginPath()
  ctx.moveTo(-L / 2 + 1, 0)
  ctx.lineTo(-L / 2 - H * 0.7, -H * 0.5 + wag)
  ctx.lineTo(-L / 2 - H * 0.7, H * 0.5 + wag)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = paint.line
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.fillStyle = paint.body
  ctx.beginPath()
  ctx.ellipse(0, 0, L / 2, Math.max(1, H / 2), 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  if (glows && art.lure) glows.push({ x: L * 0.55, y: -H * 0.9, r: H * 1.4, color: art.lure, strength: 0.8 })
}

/** Draw one fish; bioluminescent bits are pushed to `glows` in the fish's own frame. */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  art: FishArt,
  pose: FishPose,
  seed: number,
  glows: Glow[] | null,
  paint: FishPaint,
) {
  const L = pose.length
  const H = L * art.height * (1 + 0.45 * pose.puff)
  if (L < 15) {
    drawTiny(ctx, art, paint, L, H, pose, glows)
    return
  }
  const fin = paint.fin
  const outline = paint.line
  // The outline is the shape: heavy, but capped so a leviathan isn't drawn in marker pen.
  const lineW = Math.min(3.4, Math.max(1.3, L * 0.03))
  ctx.lineJoin = 'round'

  buildBody(art, L, H, pose)

  // The bill goes under the body so the head covers its root.
  if (art.bill) {
    const nx = topX[0]! + H * 0.05
    const ny = spineY[0]!
    ctx.fillStyle = outline
    ctx.beginPath()
    ctx.moveTo(nx - H * 0.2, ny - H * 0.07)
    ctx.lineTo(nx + L * art.bill, ny + H * 0.02)
    ctx.lineTo(nx - H * 0.2, ny + H * 0.08)
    ctx.closePath()
    ctx.fill()
  }

  // Tail.
  const bx = topX[S]!
  const by = spineY[S]!
  const dx = bx - topX[S - 2]!
  const dy = by - spineY[S - 2]!
  const tailAngle = Math.atan2(dy, dx) + 0.24 * pose.amp * Math.sin(pose.swim - 2.9)
  const T = H * art.tailSize
  const h1 = (thickness(art.profile, 1, pose.puff) * H) / 2
  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(tailAngle)
  tailPath(ctx, art.tail, T, h1, Math.sin(pose.swim * 0.7))
  ctx.fillStyle = paint.tail
  ctx.fill()
  ctx.lineWidth = lineW * 0.85
  ctx.strokeStyle = paint.tailLine
  ctx.stroke()
  if (T > 10) {
    ctx.globalAlpha *= 0.22
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = -0.55 + (i / 4) * 1.1
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * T * 0.8, Math.sin(a) * T * 0.8)
    }
    ctx.stroke()
    ctx.globalAlpha /= 0.22
  }
  ctx.restore()

  // Fins behind the body, their outlines softer, so the body's outline
  // carries the silhouette instead of a tangle of fins.
  const finLineAlpha = 0.55
  const paintFin = () => {
    ctx.fill()
    ctx.globalAlpha *= finLineAlpha
    ctx.stroke()
    ctx.globalAlpha /= finLineAlpha
  }
  ctx.fillStyle = fin
  ctx.strokeStyle = outline
  ctx.lineWidth = lineW * 0.75
  for (const shape of finShapes(art.dorsal, art.dorsalSize, -1, H, pose.time)) {
    drawFin(ctx, shape, -1)
    paintFin()
  }
  if (art.anal) {
    const kind: FinKind = art.dorsal === 'long' ? 'long' : 'small'
    for (const shape of finShapes(kind, art.dorsalSize * 0.8, 1, H, pose.time)) {
      if (kind === 'small') {
        shape.a = 0.56
        shape.b = 0.8
      }
      drawFin(ctx, shape, 1)
      paintFin()
    }
  }

  // Body, one flat fill with the pattern inside it.
  bodyPath(ctx, H)
  ctx.fillStyle = paint.body
  ctx.fill()

  ctx.save()
  ctx.clip()
  drawPattern(ctx, art, paint, L, H, seed, glows)
  ctx.restore()

  bodyPath(ctx, H)
  ctx.lineWidth = lineW
  ctx.strokeStyle = outline
  ctx.stroke()

  if (pose.puff > 0.3) {
    ctx.beginPath()
    for (let i = 1; i < S; i++) {
      const spike = H * 0.1 * pose.puff
      ctx.moveTo(topX[i]!, topY[i]!)
      ctx.lineTo(topX[i]! - spike * 0.3, topY[i]! - spike)
      ctx.moveTo(botX[i]!, botY[i]!)
      ctx.lineTo(botX[i]! - spike * 0.3, botY[i]! + spike)
    }
    ctx.stroke()
  }

  // Pectoral fin, flapping, over the body.
  const pu = 0.3
  const px = L / 2 - pu * L
  const py = spineAt(pu) + H * 0.1
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(2.35 + 0.35 * Math.sin(pose.swim * 1.2))
  ctx.fillStyle = fin
  ctx.globalAlpha *= 0.78
  ctx.beginPath()
  ctx.ellipse(H * 0.2, 0, H * 0.22, H * 0.085, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha /= 0.78
  ctx.lineWidth = lineW * 0.6
  ctx.globalAlpha *= finLineAlpha
  ctx.stroke()
  ctx.globalAlpha /= finLineAlpha
  ctx.restore()

  if (art.gills) {
    ctx.strokeStyle = outline
    ctx.globalAlpha *= 0.45
    ctx.lineWidth = Math.max(0.8, L * 0.009)
    ctx.beginPath()
    for (const u of [0.2, 0.235, 0.27]) {
      const x = L / 2 - u * L
      const ys = spineAt(u)
      ctx.moveTo(x, ys - H * 0.15)
      ctx.quadraticCurveTo(x - H * 0.05, ys, x, ys + H * 0.12)
    }
    ctx.stroke()
    ctx.globalAlpha /= 0.45
  }

  drawMouth(ctx, art, paint, L, H, pose.mouth)
  drawEye(ctx, art, paint, L, H, pose)

  if (art.lure) {
    const sway = Math.sin(pose.time * 2.2 + seed) * H * 0.08
    const sx = L * 0.26
    const sy = spineAt(0.24) - H * 0.4
    const ex = L * 0.74 + sway
    const ey = spineAt(0.1) - H * 0.72
    ctx.strokeStyle = outline
    ctx.lineWidth = Math.max(1, H * 0.045)
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.quadraticCurveTo(L * 0.5, spineAt(0.2) - H * 1.18, ex, ey)
    ctx.stroke()
    const pulse = 0.5 + 0.5 * Math.sin(pose.time * 5 + seed)
    ctx.fillStyle = art.lure
    ctx.beginPath()
    ctx.arc(ex, ey, Math.max(2, H * 0.085 * (1 + 0.18 * pulse)), 0, Math.PI * 2)
    ctx.fill()
    if (glows) glows.push({ x: ex, y: ey, r: H * (0.8 + 0.25 * pulse), color: art.lure, strength: 0.75 + 0.25 * pulse })
  }

  if (art.glow && glows && art.pattern !== 'photophores') {
    glows.push({ x: 0, y: 0, r: L * 0.62, color: art.glow, strength: 0.3 })
  }
}
