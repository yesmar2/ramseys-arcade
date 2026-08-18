import type { GameState } from './game'
import { BEAD_SPACING, visualSegments } from './game'

const HEAD_HUE = 158
/** Hue the tail drifts per food eaten, and how far it can ever get from the head. */
const HUE_PER_FOOD = 4
const MAX_HUE_SPREAD = 120

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

  // Soft playground wash
  ctx.fillStyle = '#edf7f4'
  ctx.fillRect(0, 0, w, h)

  const sky = ctx.createRadialGradient(w * 0.18, h * -0.05, 20, w * 0.22, 0, w * 0.85)
  sky.addColorStop(0, 'rgba(200, 232, 248, 0.9)')
  sky.addColorStop(1, 'rgba(200, 232, 248, 0)')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const mint = ctx.createRadialGradient(w * 0.95, h * 0.12, 10, w, h * 0.18, w * 0.7)
  mint.addColorStop(0, 'rgba(197, 240, 228, 0.75)')
  mint.addColorStop(1, 'rgba(197, 240, 228, 0)')
  ctx.fillStyle = mint
  ctx.fillRect(0, 0, w, h)

  const sun = ctx.createRadialGradient(w * 0.5, h * 1.05, 20, w * 0.5, h, w * 0.65)
  sun.addColorStop(0, 'rgba(255, 233, 184, 0.5)')
  sun.addColorStop(1, 'rgba(255, 233, 184, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(74, 168, 232, 0.1)'
  for (let py = 14; py < h; py += 28) {
    for (let px = 14; px < w; px += 28) {
      ctx.beginPath()
      ctx.arc(px, py, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const pad = Math.min(w, h) * 0.06
  const boardW = w - pad * 2
  const boardH = h - pad * 2
  const cell = Math.min(boardW / state.cols, boardH / state.rows)
  const gridW = cell * state.cols
  const gridH = cell * state.rows
  const ox = (w - gridW) / 2
  const oy = (h - gridH) / 2 + h * 0.02

  // Board panel
  const radius = Math.max(12, cell * 0.55)
  roundRect(ctx, ox - 10, oy - 10, gridW + 20, gridH + 20, radius)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(26, 43, 60, 0.06)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Soft grid dots
  ctx.fillStyle = 'rgba(46, 184, 160, 0.12)'
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const cx = ox + (x + 0.5) * cell
      const cy = oy + (y + 0.5) * cell
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(1, cell * 0.06), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Food
  {
    const fx = ox + (state.food.x + 0.5) * cell
    const fy = oy + (state.food.y + 0.5) * cell
    const r = cell * 0.32
    const glow = ctx.createRadialGradient(fx, fy, 1, fx, fy, r * 2.2)
    glow.addColorStop(0, 'rgba(245, 185, 66, 0.45)')
    glow.addColorStop(1, 'rgba(245, 185, 66, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(fx, fy, r * 2.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'hsla(38, 58%, 58%, 0.22)'
    ctx.beginPath()
    ctx.arc(fx, fy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'hsla(38, 58%, 42%, 0.95)'
    ctx.lineWidth = Math.max(1.4, cell * 0.08)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.beginPath()
    ctx.arc(fx - r * 0.25, fy - r * 0.28, r * 0.28, 0, Math.PI * 2)
    ctx.fill()
  }

  // Snake — fixed bead size and spacing so they kiss at every length
  const segments = visualSegments(state)
  const lineW = Math.max(1.2, cell * 0.07)
  const sw = cell * BEAD_SPACING - lineW
  const sh = sw
  const gap = (cell - sw) / 2
  const segR = sw / 2

  // Head stays green; the tail drifts further through teal and blue as you grow
  const hueSpread = Math.min(MAX_HUE_SPREAD, (state.segments - 3) * HUE_PER_FOOD)

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const sx = ox + seg.x * cell + gap
    const sy = oy + seg.y * cell + gap
    const t = i / Math.max(1, segments.length - 1)
    const hue = HEAD_HUE + hueSpread * t
    const sat = 58 + hueSpread * 0.06

    roundRect(ctx, sx, sy, sw, sh, segR)
    ctx.fillStyle = `hsla(${hue}, ${sat}%, 58%, 0.22)`
    ctx.fill()
    ctx.strokeStyle = `hsla(${hue}, ${sat}%, 42%, 0.95)`
    ctx.lineWidth = lineW
    ctx.lineJoin = 'round'
    ctx.stroke()

    if (i === 0) {
      const face = state.pendingDir ?? state.dir
      const eye = cell * 0.09
      let ex1 = sx + sw * 0.32
      let ey1 = sy + sh * 0.35
      let ex2 = sx + sw * 0.68
      let ey2 = sy + sh * 0.35
      if (face === 'left') {
        ex1 = sx + sw * 0.28
        ex2 = sx + sw * 0.28
        ey1 = sy + sh * 0.32
        ey2 = sy + sh * 0.68
      } else if (face === 'right') {
        ex1 = sx + sw * 0.72
        ex2 = sx + sw * 0.72
        ey1 = sy + sh * 0.32
        ey2 = sy + sh * 0.68
      } else if (face === 'down') {
        ey1 = sy + sh * 0.68
        ey2 = sy + sh * 0.68
      }
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(ex1, ey1, eye, 0, Math.PI * 2)
      ctx.arc(ex2, ey2, eye, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a2b3c'
      ctx.beginPath()
      ctx.arc(ex1, ey1, eye * 0.45, 0, Math.PI * 2)
      ctx.arc(ex2, ey2, eye * 0.45, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Floaters
  for (const f of state.floaters) {
    const px = ox + f.x * cell
    const py = oy + f.y * cell
    const alpha = Math.min(1, f.life * 2) * Math.min(1, f.life * 1.4)
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = `600 ${Math.max(14, cell * 0.55)}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#c98a12'
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 8
    ctx.fillText(f.text, px, py)
    ctx.restore()
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.3})`
    ctx.fillRect(0, 0, w, h)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
