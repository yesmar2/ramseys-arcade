import type { Battery, City, GameState } from './game'

/** Plain rectangles only — scales cleanly on any stage size. */
function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha = 1,
) {
  if (w <= 0 || h <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
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

function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  groundY: number,
  h: number,
  scale: number,
) {
  const g = ctx.createLinearGradient(0, groundY - 8 * scale, 0, h)
  g.addColorStop(0, '#cfe8d8')
  g.addColorStop(1, '#b7dcc8')
  ctx.fillStyle = g
  ctx.fillRect(0, groundY, w, h - groundY)

  ctx.fillStyle = 'rgba(46, 184, 160, 0.45)'
  ctx.fillRect(0, groundY, w, Math.max(2, 3 * scale))
}

const CITY_COLORS = ['#4aa8e8', '#2eb8a0', '#f5b942', '#5bc0de', '#3ecf8e', '#e87a4a']

/** Each city = a few axis-aligned rectangles (classic Missile Command vibe). */
function drawCity(ctx: CanvasRenderingContext2D, city: City, groundY: number, scale: number) {
  const color = CITY_COLORS[city.id % CITY_COLORS.length]
  const s = scale

  const layouts = [
    [
      { x: -16, w: 10, h: 20 },
      { x: -4, w: 12, h: 32 },
      { x: 10, w: 8, h: 16 },
    ],
    [
      { x: -14, w: 12, h: 26 },
      { x: 0, w: 14, h: 36 },
    ],
    [
      { x: -18, w: 8, h: 16 },
      { x: -8, w: 10, h: 28 },
      { x: 4, w: 12, h: 22 },
    ],
    [
      { x: -12, w: 24, h: 22 },
      { x: -4, w: 10, h: 34 },
    ],
    [
      { x: -16, w: 9, h: 18 },
      { x: -5, w: 9, h: 30 },
      { x: 6, w: 11, h: 20 },
    ],
    [
      { x: -14, w: 11, h: 24 },
      { x: -1, w: 9, h: 34 },
      { x: 10, w: 10, h: 18 },
    ],
  ]
  const blocks = layouts[city.id % layouts.length]

  if (!city.alive) {
    fillRect(ctx, city.x - 16 * s, groundY - 5 * s, 32 * s, 5 * s, color, 0.35)
    return
  }

  for (const b of blocks) {
    const bw = b.w * s
    const bh = b.h * s
    const bx = city.x + b.x * s
    const by = groundY - bh

    fillRect(ctx, bx, by, bw, bh, color)

    // Simple top highlight strip
    fillRect(ctx, bx, by, bw, Math.max(2, 3 * s), 'rgba(255, 255, 255, 0.3)')

    // Window squares
    if (bh > 20 * s && bw > 8 * s) {
      const win = Math.max(2, 2.5 * s)
      const gap = Math.max(4, 5 * s)
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const wx = bx + 2.5 * s + col * gap
          const wy = by + 6 * s + row * gap
          if (wx + win < bx + bw - s && wy + win < groundY - 3 * s) {
            fillRect(ctx, wx, wy, win, win, 'rgba(255, 255, 255, 0.5)')
          }
        }
      }
    }
  }
}

function drawBattery(ctx: CanvasRenderingContext2D, bat: Battery, groundY: number, scale: number) {
  const s = scale
  if (!bat.alive) {
    fillRect(ctx, bat.x - 16 * s, groundY - 6 * s, 32 * s, 6 * s, '#6b8cae', 0.35)
    return
  }

  // Base
  fillRect(ctx, bat.x - 18 * s, groundY - 10 * s, 36 * s, 10 * s, '#4aa8e8')
  fillRect(ctx, bat.x - 18 * s, groundY - 10 * s, 36 * s, 3 * s, 'rgba(255, 255, 255, 0.28)')
  // Turret
  fillRect(ctx, bat.x - 5 * s, groundY - 26 * s, 10 * s, 16 * s, '#2eb8a0')
  // Barrel
  fillRect(ctx, bat.x - 2.5 * s, groundY - 34 * s, 5 * s, 10 * s, '#1a8f7a')

  for (let i = 0; i < bat.ammo; i++) {
    const col = i % 5
    const row = Math.floor(i / 5)
    ctx.fillStyle = '#f5b942'
    ctx.beginPath()
    ctx.arc(
      bat.x - 10 * s + col * 5 * s,
      groundY + 9 * s + row * 5 * s,
      1.6 * s,
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
