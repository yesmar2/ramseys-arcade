import type { GameState, Lane } from './game'
import { isDarkTheme, playfieldColor } from '../../lib/theme'

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hue: number,
  dir: number,
  dark: boolean,
) {
  const body = `hsla(${hue}, 62%, ${dark ? 52 : 58}%, 0.92)`
  const stroke = `hsla(${hue}, 58%, ${dark ? 38 : 42}%, 0.95)`
  roundRect(ctx, x, y, w, h, Math.min(h * 0.32, 6))
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1.2, h * 0.08)
  ctx.stroke()

  ctx.fillStyle = dark ? 'rgba(180, 220, 255, 0.28)' : 'rgba(255, 255, 255, 0.38)'
  const cabinW = w * 0.38
  const cabinX = dir > 0 ? x + w * 0.42 : x + w * 0.2
  roundRect(ctx, cabinX, y + h * 0.18, cabinW, h * 0.64, h * 0.12)
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 230, 140, 0.85)'
  const lightW = Math.max(3, w * 0.08)
  const lightX = dir > 0 ? x + w - lightW - 2 : x + 2
  roundRect(ctx, lightX, y + h * 0.22, lightW, h * 0.22, 1.5)
  ctx.fill()
  roundRect(ctx, lightX, y + h * 0.56, lightW, h * 0.22, 1.5)
  ctx.fill()
}

function drawHopper(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cell: number,
  pulse: number,
  blink: boolean,
) {
  if (blink) return
  const squash = 1 - pulse * 0.22
  const stretch = 1 + pulse * 0.18
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(stretch, squash)

  const rx = cell * 0.32
  const ry = cell * 0.28
  ctx.fillStyle = 'hsla(128, 58%, 48%, 0.22)'
  ctx.beginPath()
  ctx.ellipse(0, ry * 0.55, rx * 0.9, ry * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'hsla(128, 62%, 52%, 0.95)'
  ctx.strokeStyle = 'hsla(128, 55%, 32%, 0.95)'
  ctx.lineWidth = Math.max(1.4, cell * 0.06)
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#1a2b3c'
  ctx.beginPath()
  ctx.arc(-rx * 0.32, -ry * 0.18, Math.max(1.4, cell * 0.055), 0, Math.PI * 2)
  ctx.arc(rx * 0.32, -ry * 0.18, Math.max(1.4, cell * 0.055), 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'hsla(128, 55%, 28%, 0.9)'
  ctx.lineWidth = Math.max(1.2, cell * 0.05)
  ctx.beginPath()
  ctx.arc(0, ry * 0.12, rx * 0.42, 0.25, Math.PI - 0.25)
  ctx.stroke()
  ctx.restore()
}

function laneFill(lane: Lane, dark: boolean) {
  if (lane.kind === 'safe') {
    return dark ? 'hsla(128, 28%, 22%, 0.72)' : 'hsla(128, 42%, 72%, 0.55)'
  }
  return dark ? 'hsla(210, 12%, 16%, 0.88)' : 'hsla(210, 10%, 32%, 0.78)'
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

  const dark = isDarkTheme()
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  const pad = Math.min(w, h) * 0.045
  const cell = Math.min((w - pad * 2) / state.cols, (h - pad * 2) / state.rows)
  const gridW = cell * state.cols
  const gridH = cell * state.rows
  const ox = (w - gridW) / 2
  const oy = (h - gridH) / 2

  roundRect(ctx, ox - 8, oy - 8, gridW + 16, gridH + 16, Math.max(10, cell * 0.4))
  ctx.fillStyle = dark ? 'rgba(8, 14, 20, 0.55)' : 'rgba(255, 255, 255, 0.5)'
  ctx.fill()

  for (let y = 0; y < state.rows; y++) {
    const lane = state.lanes[y]
    const ly = oy + y * cell
    ctx.fillStyle = laneFill(lane, dark)
    ctx.fillRect(ox, ly, gridW, cell + 0.5)

    if (lane.kind === 'road') {
      ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.28)'
      const dash = cell * 0.55
      const gap = cell * 0.4
      let dx = ox + cell * 0.2
      const midY = ly + cell * 0.5 - 1
      while (dx < ox + gridW - 4) {
        ctx.fillRect(dx, midY, dash, 2)
        dx += dash + gap
      }
    }

    if (y === 0) {
      ctx.fillStyle = dark ? 'hsla(38, 60%, 48%, 0.35)' : 'hsla(38, 62%, 58%, 0.32)'
      ctx.fillRect(ox, ly, gridW, cell)
      ctx.fillStyle = dark ? 'hsla(38, 70%, 62%, 0.85)' : 'hsla(38, 62%, 48%, 0.9)'
      ctx.font = `700 ${Math.max(10, cell * 0.32)}px Outfit, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('HOME', ox + gridW / 2, ly + cell * 0.52)
    }
  }

  for (let y = 0; y < state.rows; y++) {
    const lane = state.lanes[y]
    if (lane.kind !== 'road') continue
    const ly = oy + y * cell
    const carH = cell * 0.62
    const carY = ly + (cell - carH) / 2
    for (const v of lane.vehicles) {
      drawCar(ctx, ox + v.x * cell, carY, v.w * cell, carH, v.hue, lane.dir, dark)
    }
  }

  const blink = state.invuln > 0 && Math.floor(state.invuln * 12) % 2 === 0
  drawHopper(
    ctx,
    ox + (state.px + 0.5) * cell,
    oy + (state.py + 0.5) * cell,
    cell,
    state.hopPulse / 0.16,
    blink,
  )

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(232, 93, 117, ${state.flash * 0.28})`
    ctx.fillRect(0, 0, w, h)
  }
}
