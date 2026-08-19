import { PAD_HUES, padLayout, type GameState } from './game'
import { playfieldColor } from '../../lib/theme'

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  const a = ctx.createRadialGradient(w * 0.18, 0, 10, w * 0.25, 0, w * 0.65)
  a.addColorStop(0, 'rgba(200, 232, 248, 0.9)')
  a.addColorStop(1, 'rgba(200, 232, 248, 0)')
  ctx.fillStyle = a
  ctx.fillRect(0, 0, w, h)

  const b = ctx.createRadialGradient(w * 0.9, h * 0.88, 8, w, h, w * 0.55)
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

  drawBackground(ctx, w, h)

  const pads = padLayout(w, h)
  for (const pad of pads) {
    const hue = PAD_HUES[pad.id]
    const watching = state.lit === pad.id
    const pressed = state.pressId === pad.id && state.pressLife > 0
    const on = watching || pressed
    const punch = pressed ? Math.max(0.45, Math.min(1, state.pressLife / 0.18)) : 1
    const alpha = on ? 0.22 + 0.28 * punch : 0.22
    ctx.fillStyle = `hsla(${hue}, 52%, 58%, ${alpha})`
    ctx.strokeStyle = `hsla(${hue}, 52%, 42%, 0.95)`
    ctx.lineWidth = Math.max(2, pad.r * 0.08)
    ctx.beginPath()
    ctx.arc(pad.x, pad.y, pad.r * (on ? 1.03 + 0.05 * punch : 1), 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.28})`
    ctx.fillRect(0, 0, w, h)
  }
}
