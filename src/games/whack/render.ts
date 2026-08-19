import { PAD_COUNT, PAD_INNER, padDisc, padLayout, type GameState, type Pad } from './game'
import { inkColor, playfieldColor } from '../../lib/theme'

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  const a = ctx.createRadialGradient(w * 0.2, 0, 12, w * 0.28, 0, w * 0.7)
  a.addColorStop(0, 'rgba(200, 232, 248, 0.9)')
  a.addColorStop(1, 'rgba(200, 232, 248, 0)')
  ctx.fillStyle = a
  ctx.fillRect(0, 0, w, h)

  const b = ctx.createRadialGradient(w * 0.85, h * 0.9, 8, w, h, w * 0.55)
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

function washFill(hue: number, sat: number, alpha = 0.22) {
  return `hsla(${hue}, ${sat}%, 58%, ${alpha})`
}

function washStroke(hue: number, sat: number) {
  return `hsla(${hue}, ${sat}%, 42%, 0.95)`
}

function drawPad(ctx: CanvasRenderingContext2D, pad: Pad, w: number, h: number) {
  const { x, y, r } = padLayout(pad.id, w, h)
  const target = pad.target
  const hue = target?.hue ?? 198
  const sat = target?.kind === 'gold' ? 58 : 52
  const rise = target?.rise ?? 0
  const hit = target?.hit ?? false
  const live = rise > 0.04 && target != null
  const size = padDisc(rise, r)
  const fillA = live ? 0.18 + rise * 0.32 : 0.1

  ctx.fillStyle = washFill(hue, sat, fillA)
  ctx.strokeStyle = washStroke(hue, sat)
  ctx.lineWidth = Math.max(1.6, r * 0.07)
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  if (live) {
    ctx.fillStyle = washFill(hue, sat, 0.16 + rise * 0.28)
    ctx.beginPath()
    ctx.arc(x, y, size * PAD_INNER, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = washStroke(hue, sat)
    ctx.lineWidth = Math.max(1.2, r * 0.045)
    ctx.stroke()
  }

  if (hit) {
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.35 - (target?.hitAge ?? 0) * 1.4)})`
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fill()
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

  for (let i = 0; i < PAD_COUNT; i++) {
    drawPad(ctx, state.pads[i], w, h)
  }

  for (const f of state.floaters) {
    const alpha = Math.min(1, f.life * 2)
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = `600 ${Math.round(20 * state.scale)}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = inkColor()
    ctx.shadowColor = 'rgba(255,255,255,0.85)'
    ctx.shadowBlur = 8 * state.scale
    ctx.fillText(f.text, f.x, f.y)
    ctx.restore()
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.28})`
    ctx.fillRect(0, 0, w, h)
  }
}
