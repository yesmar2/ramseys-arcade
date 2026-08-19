import {
  ROUND_SECS,
  type GameState,
  type Point,
  type Shape,
} from './game'

import { inkColor, playfieldColor } from '../../lib/theme'

const ACCENT = '#2eb8a0'
const ACCENT_SKY = '#4aa8e8'
const ACCENT_GOLD = '#f5b942'

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  const a = ctx.createRadialGradient(w * 0.2, 0, 12, w * 0.28, 0, w * 0.7)
  a.addColorStop(0, 'rgba(200, 232, 248, 0.9)')
  a.addColorStop(1, 'rgba(200, 232, 248, 0)')
  ctx.fillStyle = a
  ctx.fillRect(0, 0, w, h)

  const b = ctx.createRadialGradient(w * 0.9, h * 0.85, 8, w, h, w * 0.6)
  b.addColorStop(0, 'rgba(197, 240, 228, 0.65)')
  b.addColorStop(1, 'rgba(197, 240, 228, 0)')
  ctx.fillStyle = b
  ctx.fillRect(0, 0, w, h)

  const step = 26 * Math.max(0.7, Math.min(w, h) / 540)
  ctx.fillStyle = 'rgba(74, 168, 232, 0.09)'
  for (let py = step * 0.5; py < h; py += step) {
    for (let px = step * 0.5; px < w; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, scale: number) {
  const pts = shape.points
  if (pts.length < 3) return

  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  const sat = shape.sat ?? 50
  ctx.fillStyle = `hsla(${shape.hue}, ${sat}%, 58%, 0.22)`
  ctx.fill()
  ctx.strokeStyle = `hsla(${shape.hue}, ${sat}%, 42%, 0.95)`
  ctx.lineWidth = Math.max(1.5, 2 * scale)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
}

function mark(
  ctx: CanvasRenderingContext2D,
  p: Point,
  color: string,
  glow: string,
  scale: number,
  halo: number,
) {
  const r = halo * scale
  const glowFill = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
  glowFill.addColorStop(0, glow)
  glowFill.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glowFill
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, 1.15 * scale)
  ctx.beginPath()
  ctx.arc(p.x, p.y, r * 0.62, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(p.x, p.y, Math.max(1.6, 2 * scale), 0, Math.PI * 2)
  ctx.fill()
}

function drawTimer(
  ctx: CanvasRenderingContext2D,
  timeLeft: number,
  w: number,
  scale: number,
) {
  const x = w / 2
  const y = 28 * scale
  const barW = Math.min(220, w * 0.42) * scale
  const barH = 8 * scale
  const t = Math.max(0, Math.min(1, timeLeft / ROUND_SECS))

  ctx.fillStyle = 'rgba(26, 43, 60, 0.1)'
  ctx.fillRect(x - barW / 2, y - barH / 2, barW, barH)

  const urgent = t < 0.35
  ctx.fillStyle = urgent ? ACCENT_GOLD : ACCENT
  ctx.fillRect(x - barW / 2, y - barH / 2, Math.max(0, barW * t), barH)
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const scale = state.scale
  drawBackground(ctx, w, h)

  if (state.shape && (state.phase === 'playing' || state.phase === 'reveal')) {
    drawShape(ctx, state.shape, scale)
  }

  if (state.phase === 'playing') {
    drawTimer(ctx, state.timeLeft, w, scale)
  }

  if (state.phase === 'reveal' && state.result) {
    const { guess, center, timedOut } = state.result
    if (guess) {
      // Your tap — sky; true center — teal (site accents)
      mark(ctx, guess, ACCENT_SKY, 'rgba(74, 168, 232, 0.35)', scale, 14)
    }

    mark(ctx, center, ACCENT, 'rgba(46, 184, 160, 0.38)', scale, 16)

    if (timedOut) {
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `600 ${Math.round(15 * scale)}px Outfit, system-ui, sans-serif`
      ctx.shadowColor = 'rgba(255,255,255,0.92)'
      ctx.shadowBlur = 8 * scale
      ctx.fillStyle = inkColor()
      ctx.fillText('Too slow', center.x, center.y + 28 * scale)
      ctx.restore()
    }
  }

  for (const f of state.floaters) {
    const alpha = Math.min(1, f.life * 2)
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = `600 ${Math.round(18 * scale)}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#c98a12'
    ctx.shadowColor = 'rgba(255,255,255,0.85)'
    ctx.shadowBlur = 8 * scale
    ctx.fillText(f.text, f.x, f.y)
    ctx.restore()
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.32})`
    ctx.fillRect(0, 0, w, h)
  }
}
