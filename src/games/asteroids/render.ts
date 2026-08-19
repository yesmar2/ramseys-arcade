import { shipRadius, type GameState, type Point, type Rock } from './game'

const INK = '#1a2b3c'
const ACCENT = '#2eb8a0'
const ACCENT_SKY = '#4aa8e8'
const ACCENT_GOLD = '#f5b942'

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#edf7f4'
  ctx.fillRect(0, 0, w, h)

  const a = ctx.createRadialGradient(w * 0.15, 0, 10, w * 0.25, 0, w * 0.65)
  a.addColorStop(0, 'rgba(200, 232, 248, 0.95)')
  a.addColorStop(1, 'rgba(200, 232, 248, 0)')
  ctx.fillStyle = a
  ctx.fillRect(0, 0, w, h)

  const b = ctx.createRadialGradient(w * 0.92, h * 0.9, 8, w, h, w * 0.55)
  b.addColorStop(0, 'rgba(197, 240, 228, 0.7)')
  b.addColorStop(1, 'rgba(197, 240, 228, 0)')
  ctx.fillStyle = b
  ctx.fillRect(0, 0, w, h)

  const step = 28 * Math.max(0.7, Math.min(w, h) / 540)
  ctx.fillStyle = 'rgba(74, 168, 232, 0.14)'
  for (let py = step * 0.4; py < h; py += step) {
    for (let px = step * 0.4; px < w; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.15, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawRock(ctx: CanvasRenderingContext2D, rock: Rock, scale: number) {
  ctx.save()
  ctx.translate(rock.x, rock.y)
  ctx.rotate(rock.angle)
  ctx.beginPath()
  const v = rock.verts
  ctx.moveTo(v[0].x, v[0].y)
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y)
  ctx.closePath()
  const sat = rock.sat ?? 50
  ctx.fillStyle = `hsla(${rock.hue}, ${sat}%, 58%, 0.22)`
  ctx.fill()
  ctx.strokeStyle = `hsla(${rock.hue}, ${sat}%, 42%, 0.95)`
  ctx.lineWidth = Math.max(1.4, 1.8 * scale)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
}

function shipPoints(angle: number, r: number): Point[] {
  const nose = { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
  const left = {
    x: Math.cos(angle + 2.5) * r * 0.85,
    y: Math.sin(angle + 2.5) * r * 0.85,
  }
  const right = {
    x: Math.cos(angle - 2.5) * r * 0.85,
    y: Math.sin(angle - 2.5) * r * 0.85,
  }
  return [nose, left, right]
}

function drawShip(ctx: CanvasRenderingContext2D, state: GameState, scale: number) {
  const { ship } = state
  if (ship.invuln > 0 && Math.floor(ship.invuln * 12) % 2 === 0) return

  const r = shipRadius(scale)
  const pts = shipPoints(ship.angle, r)
  ctx.save()
  ctx.translate(ship.x, ship.y)
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  ctx.lineTo(pts[1].x, pts[1].y)
  ctx.lineTo(pts[2].x, pts[2].y)
  ctx.closePath()
  ctx.fillStyle = 'rgba(46, 184, 160, 0.18)'
  ctx.fill()
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = Math.max(2.5, 3.2 * scale)
  ctx.lineJoin = 'round'
  ctx.stroke()

  if (ship.thrusting) {
    const flicker = 0.7 + Math.random() * 0.5
    const back = ship.angle + Math.PI
    const wing = r * 0.55
    const tail = r * 0.95 * flicker
    ctx.beginPath()
    ctx.moveTo(Math.cos(ship.angle + 2.3) * wing, Math.sin(ship.angle + 2.3) * wing)
    ctx.lineTo(Math.cos(back) * tail, Math.sin(back) * tail)
    ctx.lineTo(Math.cos(ship.angle - 2.3) * wing, Math.sin(ship.angle - 2.3) * wing)
    ctx.strokeStyle = ACCENT_GOLD
    ctx.lineWidth = Math.max(2, 2.4 * scale)
    ctx.stroke()
  } else if (state.reverse) {
    const flicker = 0.55 + Math.random() * 0.35
    const nose = r * 1.05 * flicker
    ctx.beginPath()
    ctx.moveTo(Math.cos(ship.angle + 0.45) * r * 0.35, Math.sin(ship.angle + 0.45) * r * 0.35)
    ctx.lineTo(Math.cos(ship.angle) * nose, Math.sin(ship.angle) * nose)
    ctx.lineTo(Math.cos(ship.angle - 0.45) * r * 0.35, Math.sin(ship.angle - 0.45) * r * 0.35)
    ctx.strokeStyle = ACCENT_SKY
    ctx.lineWidth = Math.max(2, 2.2 * scale)
    ctx.stroke()
  }
  ctx.restore()
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

  for (const rock of state.rocks) drawRock(ctx, rock, scale)

  for (const b of state.bullets) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, Math.max(2, 2.4 * scale), 0, Math.PI * 2)
    ctx.fillStyle = ACCENT_SKY
    ctx.fill()
  }

  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife)
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(1.2, 2 * scale * a), 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue}, 70%, 55%, 1)`
    ctx.fill()
    ctx.globalAlpha = 1
  }

  if (state.phase === 'playing' || state.phase === 'gameover' || state.phase === 'waveClear') {
    drawShip(ctx, state, scale)
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.35})`
    ctx.fillRect(0, 0, w, h)
  }

  for (const f of state.floaters) {
    const a = Math.max(0, Math.min(1, f.life / f.maxLife))
    ctx.save()
    ctx.globalAlpha = a * a
    ctx.font = `600 ${Math.round((f.text.includes('×') ? 16 : 14) * scale)}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = f.text.includes('×') ? ACCENT_GOLD : INK
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 8 * scale
    ctx.fillText(f.text, f.x, f.y)
    ctx.restore()
  }

  if (state.phase === 'playing' && state.combo > 1) {
    const size = Math.round(26 * scale)
    ctx.save()
    ctx.font = `700 ${size}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = ACCENT_GOLD
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 10 * scale
    ctx.fillText(`×${state.combo}`, w / 2, h - 18 * scale)
    ctx.restore()
  }
}
