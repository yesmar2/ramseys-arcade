import type { Battery, City, GameState } from './game'

function pathRoundRect(
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
  ctx.arcTo(x + w, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fillBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha = 1,
  scale = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  pathRoundRect(ctx, x, y, w, h, 5 * scale)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
  pathRoundRect(
    ctx,
    x + 2 * scale,
    y + 2 * scale,
    Math.max(4 * scale, w - 4 * scale),
    Math.max(4 * scale, h * 0.28),
    3 * scale,
  )
  ctx.fill()
  ctx.restore()
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#edf7f4'
  ctx.fillRect(0, 0, w, h)

  const sky = ctx.createRadialGradient(w * 0.25, 0, 20, w * 0.3, 0, w * 0.85)
  sky.addColorStop(0, 'rgba(200, 232, 248, 0.95)')
  sky.addColorStop(1, 'rgba(200, 232, 248, 0)')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const mint = ctx.createRadialGradient(w * 0.9, h * 0.2, 10, w, h * 0.25, w * 0.7)
  mint.addColorStop(0, 'rgba(197, 240, 228, 0.7)')
  mint.addColorStop(1, 'rgba(197, 240, 228, 0)')
  ctx.fillStyle = mint
  ctx.fillRect(0, 0, w, h)

  const step = 28 * Math.max(0.65, Math.min(w, h) / 540)
  ctx.fillStyle = 'rgba(74, 168, 232, 0.1)'
  for (let py = step * 0.5; py < h; py += step) {
    for (let px = step * 0.5; px < w; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, groundY: number, h: number, scale: number) {
  const g = ctx.createLinearGradient(0, groundY - 8 * scale, 0, h)
  g.addColorStop(0, '#cfe8d8')
  g.addColorStop(1, '#b7dcc8')
  ctx.fillStyle = g
  ctx.fillRect(0, groundY, w, h - groundY)

  ctx.fillStyle = 'rgba(46, 184, 160, 0.45)'
  ctx.fillRect(0, groundY, w, 3 * scale)
}

const CITY_COLORS = ['#4aa8e8', '#2eb8a0', '#f5b942', '#5bc0de', '#3ecf8e', '#e87a4a']

function drawCity(ctx: CanvasRenderingContext2D, city: City, groundY: number, scale: number) {
  const color = CITY_COLORS[city.id % CITY_COLORS.length]
  const w = 44 * scale
  const bodyH = 28 * scale
  const roofH = 16 * scale
  const x = city.x - w / 2
  const bodyY = groundY - bodyH

  if (!city.alive) {
    ctx.globalAlpha = 0.3
    ctx.fillStyle = color
    pathRoundRect(ctx, x + 4 * scale, groundY - 8 * scale, w - 8 * scale, 8 * scale, 4 * scale)
    ctx.fill()
    ctx.globalAlpha = 1
    return
  }

  ctx.fillStyle = color
  pathRoundRect(ctx, x, bodyY, w, bodyH, 6 * scale)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(x - 4 * scale, bodyY + 2 * scale)
  ctx.lineTo(city.x, bodyY - roofH)
  ctx.lineTo(x + w + 4 * scale, bodyY + 2 * scale)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
  pathRoundRect(ctx, x + 4 * scale, bodyY + 4 * scale, w - 8 * scale, 8 * scale, 3 * scale)
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  pathRoundRect(ctx, x + 8 * scale, bodyY + 14 * scale, 10 * scale, 10 * scale, 2 * scale)
  ctx.fill()
  pathRoundRect(ctx, x + w - 18 * scale, bodyY + 14 * scale, 10 * scale, 10 * scale, 2 * scale)
  ctx.fill()
}

function drawBattery(ctx: CanvasRenderingContext2D, bat: Battery, groundY: number, scale: number) {
  if (!bat.alive) {
    fillBlock(ctx, bat.x - 16 * scale, groundY - 8 * scale, 32 * scale, 8 * scale, '#6b8cae', 0.3, scale)
    return
  }

  fillBlock(ctx, bat.x - 18 * scale, groundY - 14 * scale, 36 * scale, 14 * scale, '#4aa8e8', 1, scale)
  fillBlock(ctx, bat.x - 6 * scale, groundY - 30 * scale, 12 * scale, 18 * scale, '#2eb8a0', 1, scale)

  for (let i = 0; i < bat.ammo; i++) {
    const col = i % 5
    const row = Math.floor(i / 5)
    ctx.fillStyle = '#f5b942'
    ctx.beginPath()
    ctx.arc(
      bat.x - 10 * scale + col * 5 * scale,
      groundY + 10 * scale + row * 5 * scale,
      1.6 * scale,
      0,
      Math.PI * 2,
    )
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

  const scale = state.scale

  drawBackground(ctx, w, h)
  drawGround(ctx, w, state.groundY, h, scale)

  for (const city of state.cities) drawCity(ctx, city, state.groundY, scale)
  for (const bat of state.batteries) drawBattery(ctx, bat, state.groundY, scale)

  for (const m of state.incoming) {
    ctx.strokeStyle = 'rgba(232, 93, 117, 0.35)'
    ctx.lineWidth = 2 * scale
    ctx.beginPath()
    ctx.moveTo(m.x0, m.y0)
    ctx.lineTo(m.x, m.y)
    ctx.stroke()

    ctx.fillStyle = '#e85d75'
    ctx.beginPath()
    ctx.arc(m.x, m.y, 3.5 * scale, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const s of state.shots) {
    ctx.strokeStyle = 'rgba(74, 168, 232, 0.45)'
    ctx.lineWidth = 2 * scale
    ctx.beginPath()
    ctx.moveTo(s.x0, s.y0)
    ctx.lineTo(s.x, s.y)
    ctx.stroke()

    ctx.fillStyle = '#4aa8e8'
    ctx.beginPath()
    ctx.arc(s.x, s.y, 3 * scale, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const b of state.blasts) {
    const alpha = b.growing ? 0.28 : 0.16
    ctx.fillStyle = `rgba(245, 185, 66, ${alpha})`
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(46, 184, 160, 0.55)'
    ctx.lineWidth = 2 * scale
    ctx.stroke()
  }

  for (const f of state.floaters) {
    const alpha = Math.min(1, f.life * 2) * Math.min(1, f.life * 1.4)
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = `700 ${18 * scale}px Fredoka, Nunito, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#c98a12'
    ctx.shadowColor = 'rgba(255,255,255,0.85)'
    ctx.shadowBlur = 8 * scale
    ctx.fillText(f.text, f.x, f.y)
    ctx.restore()
  }

  if (state.phase === 'playing' || state.phase === 'menu') {
    const { x, y } = state.cursor
    ctx.strokeStyle = 'rgba(26, 43, 60, 0.45)'
    ctx.lineWidth = 1.5 * scale
    ctx.beginPath()
    ctx.moveTo(x - 10 * scale, y)
    ctx.lineTo(x + 10 * scale, y)
    ctx.moveTo(x, y - 10 * scale)
    ctx.lineTo(x, y + 10 * scale)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 6 * scale, 0, Math.PI * 2)
    ctx.stroke()
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.35})`
    ctx.fillRect(0, 0, w, h)
  }
}
