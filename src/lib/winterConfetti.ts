/*
 * Season 2's confetti (Cold Snap), for the run report's burst (components/RunReport.tsx ReportConfetti):
 * Snowfall drifts down over the whole screen, Snowballs are thrown in from the sides trailing powder, its
 * Pass+'s Icicles drop and glint, and Flurry whirls snow across the screen on the wind. Each piece is the
 * report's own shape of piece, so the report keeps one list and one clock.
 */

type Piece = { x: number; y: number; vx: number; vy: number; spin: number; angle: number; w: number; h: number; color: string; delay: number }

export const WINTER_CONFETTI: Record<string, string[]> = {
  'cf-snowfall': ['#ffffff', '#eaf6ff', '#cfe8fb', '#ffffff', '#bfe6ff'],
  'cf-snowballs': ['#ffffff', '#f4faff', '#eaf4fc'],
  'cf-icicles': ['#dff4ff', '#bfe6ff', '#9fd8ff', '#ffffff'],
  'cf-flurry': ['#ffffff', '#dff2ff', '#bfe6ff', '#9fd4f7'],
}

export function isWinterConfetti(style: string | null | undefined): boolean {
  return !!style && style in WINTER_CONFETTI
}

/** The pieces a winter confetti starts with: spread over the top, or thrown in from the sides. */
export function winterPieces(style: string, w: number, h: number): Piece[] {
  const colors = WINTER_CONFETTI[style]!
  const pieces: Piece[] = []
  const small = w < 640
  const color = (i: number) => colors[i % colors.length]!
  if (style === 'cf-snowfall') {
    for (let i = 0, n = small ? 80 : 140; i < n; i++) {
      pieces.push({ x: Math.random() * w, y: -h * 0.25 + Math.random() * h * 0.85, vx: 0, vy: 2.4 + Math.random() * 2.6, spin: (Math.random() - 0.5) * 0.04, angle: Math.random() * Math.PI, w: 4 + Math.random() * 8, h: 1, color: color(i), delay: Math.random() * 700 })
    }
  } else if (style === 'cf-flurry') {
    for (let i = 0, n = small ? 90 : 150; i < n; i++) {
      pieces.push({ x: -30 - Math.random() * w * 0.5, y: Math.random() * h * 0.9, vx: 7 + Math.random() * 6, vy: (Math.random() - 0.5) * 1.5, spin: 0.02 + Math.random() * 0.05, angle: Math.random() * Math.PI * 2, w: 3.5 + Math.random() * 6, h: 1, color: color(i), delay: Math.random() * 900 })
    }
  } else if (style === 'cf-icicles') {
    for (let i = 0, n = small ? 22 : 36; i < n; i++) {
      pieces.push({ x: w * 0.04 + Math.random() * w * 0.92, y: -40 - Math.random() * 60, vx: 0, vy: 2 + Math.random() * 3, spin: (Math.random() - 0.5) * 0.02, angle: (Math.random() - 0.5) * 0.2, w: 9 + Math.random() * 6, h: 36 + Math.random() * 34, color: color(i), delay: Math.random() * 1200 })
    }
  } else {
    // Snowballs, thrown in from either side and falling in arcs.
    for (let i = 0, n = small ? 16 : 26; i < n; i++) {
      const side = i % 2 ? 1 : -1
      pieces.push({ x: side > 0 ? -20 : w + 20, y: h * (0.35 + Math.random() * 0.4), vx: side * (6 + Math.random() * 6), vy: -(6 + Math.random() * 5), spin: (Math.random() - 0.5) * 0.2, angle: 0, w: 10 + Math.random() * 9, h: 1, color: color(i), delay: Math.random() * 1100 })
    }
  }
  return pieces
}

function flake(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    const ex = Math.cos(a) * r
    const ey = Math.sin(a) * r
    ctx.moveTo(0, 0)
    ctx.lineTo(ex, ey)
    const bx = ex * 0.55
    const by = ey * 0.55
    for (const s of [-1, 1]) {
      const b = a + (s * Math.PI) / 4
      ctx.moveTo(bx, by)
      ctx.lineTo(bx + Math.cos(b) * r * 0.32, by + Math.sin(b) * r * 0.32)
    }
  }
  ctx.stroke()
}

/** Moves one piece on and draws it. */
export function drawWinterPiece(ctx: CanvasRenderingContext2D, style: string, p: Piece, t: number, dt: number, fade: number) {
  ctx.save()
  ctx.globalAlpha = fade
  if (style === 'cf-snowfall' || style === 'cf-flurry') {
    if (style === 'cf-flurry') {
      // The wind swirls it: across, and round in loops as it goes.
      p.vy += Math.sin((t + p.delay * 3) / 260) * 0.12 * dt
      p.vy *= 0.97
      p.vx *= 0.995
    } else {
      p.vx = Math.sin((t + p.delay * 4) / 420) * 0.9
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.angle += p.spin * dt
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle)
    ctx.strokeStyle = p.color
    ctx.fillStyle = p.color
    if (p.w > 5) {
      ctx.lineWidth = Math.max(1, p.w * 0.16)
      ctx.lineCap = 'round'
      flake(ctx, p.w)
    } else {
      ctx.beginPath()
      ctx.arc(0, 0, p.w * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (style === 'cf-icicles') {
    p.vy += 0.16 * dt
    p.y += p.vy * dt
    p.angle += p.spin * dt
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle)
    const g = ctx.createLinearGradient(0, -p.h, 0, 0)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(1, p.color)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(-p.w / 2, -p.h)
    ctx.lineTo(p.w / 2, -p.h)
    ctx.lineTo(0, 0)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(74,168,232,0.6)'
    ctx.lineWidth = 1
    ctx.stroke()
    // A glint running down it.
    const k = ((t + p.delay * 9) % 900) / 900
    ctx.globalAlpha = fade * (1 - k)
    ctx.fillStyle = '#ffffff'
    const gy = -p.h + p.h * k
    const s = 3.5
    ctx.beginPath()
    ctx.moveTo(0, gy - s)
    ctx.quadraticCurveTo(0, gy, s, gy)
    ctx.quadraticCurveTo(0, gy, 0, gy + s)
    ctx.quadraticCurveTo(0, gy, -s, gy)
    ctx.quadraticCurveTo(0, gy, 0, gy - s)
    ctx.fill()
  } else {
    // A snowball: a ball of snow, shaded on its underside, a puff of powder behind it.
    p.vy += 0.24 * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.angle += p.spin * dt
    ctx.fillStyle = 'rgba(234,244,252,0.45)'
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath()
      ctx.arc(p.x - p.vx * i * 2.2, p.y - p.vy * i * 2.2, p.w * (0.5 - i * 0.1), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.translate(p.x, p.y)
    const g = ctx.createRadialGradient(-p.w * 0.35, -p.w * 0.35, p.w * 0.1, 0, 0, p.w)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.7, p.color)
    g.addColorStop(1, '#a9c8e4')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, p.w, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
