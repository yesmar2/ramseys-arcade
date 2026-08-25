import {
  POWER_HUE,
  shipRadius,
  type EnemyBullet,
  type GameState,
  type Point,
  type Powerup,
  type Rock,
  type Saucer,
} from './game'
import { inkColor, playfieldColor } from '../../lib/theme'

const ACCENT = '#2eb87a'
const ACCENT_SKY = '#4aa8e8'
const ACCENT_GOLD = '#f5b942'
const SAUCER = '#c45c5c'

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
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

function drawPowerupGlyph(
  ctx: CanvasRenderingContext2D,
  kind: Powerup['kind'],
  r: number,
  scale: number,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(2.2, 2.6 * scale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (kind === 'rapid') {
    // Lightning bolt
    const s = r * 0.55
    ctx.beginPath()
    ctx.moveTo(s * 0.15, -s)
    ctx.lineTo(-s * 0.25, s * 0.05)
    ctx.lineTo(s * 0.05, s * 0.05)
    ctx.lineTo(-s * 0.15, s)
    ctx.lineTo(s * 0.35, -s * 0.05)
    ctx.lineTo(s * 0.05, -s * 0.05)
    ctx.closePath()
    ctx.fill()
    return
  }

  if (kind === 'spread') {
    // Triple fan shots — offset so the fan sits on the ring center
    const s = r * 0.48
    const oy = s * 0.42
    for (const ang of [-0.55, 0, 0.55]) {
      const tx = Math.cos(ang - Math.PI / 2) * s
      const ty = Math.sin(ang - Math.PI / 2) * s + oy
      ctx.beginPath()
      ctx.moveTo(0, oy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(tx * 0.92, oy + (ty - oy) * 0.92, Math.max(1.6, 2.1 * scale), 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }

  if (kind === 'shield') {
    // Hex shield
    const s = r * 0.48
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2
      const x = Math.cos(a) * s
      const y = Math.sin(a) * s
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  // Slow — clock
  const s = r * 0.48
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -s * 0.55)
  ctx.moveTo(0, 0)
  ctx.lineTo(s * 0.42, s * 0.1)
  ctx.stroke()
}

function drawPowerup(ctx: CanvasRenderingContext2D, p: Powerup, scale: number) {
  const hue = POWER_HUE[p.kind]
  const fade = p.life < 2 ? Math.max(0.25, p.life / 2) : 1
  const pulse = 0.92 + Math.sin(performance.now() / 180 + p.id) * 0.08
  const r = p.radius * pulse
  ctx.save()
  ctx.globalAlpha = fade
  ctx.translate(p.x, p.y)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, 62%, 58%, 0.48)`
  ctx.fill()
  const ring = `hsla(${hue}, 58%, 42%, 0.98)`
  ctx.strokeStyle = ring
  ctx.lineWidth = Math.max(2.4, 2.8 * scale)
  ctx.stroke()
  drawPowerupGlyph(ctx, p.kind, r, scale, ring)
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
  const shielded = (state.buffShield ?? 0) > 0
  // Blink only after respawn — shield stays solid
  if (!shielded && ship.invuln > 0 && Math.floor(ship.invuln * 12) % 2 === 0) return

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

  if (shielded) {
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(${POWER_HUE.shield}, 55%, 45%, 0.85)`
    ctx.lineWidth = Math.max(1.6, 2 * scale)
    ctx.stroke()
  }

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
  }
  ctx.restore()
}

function drawSaucer(ctx: CanvasRenderingContext2D, saucer: Saucer, scale: number) {
  const r = saucer.radius
  ctx.save()
  ctx.translate(saucer.x, saucer.y)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = SAUCER
  ctx.fillStyle = 'rgba(196, 92, 92, 0.2)'
  ctx.lineWidth = Math.max(1.8, 2.2 * scale)

  // Dome
  ctx.beginPath()
  ctx.ellipse(0, -r * 0.15, r * 0.55, r * 0.38, 0, Math.PI, 0)
  ctx.fill()
  ctx.stroke()

  // Hull
  ctx.beginPath()
  ctx.moveTo(-r, 0)
  ctx.quadraticCurveTo(-r * 0.2, r * 0.55, r, 0)
  ctx.quadraticCurveTo(r * 0.2, -r * 0.2, -r, 0)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Cabin lights
  ctx.fillStyle = SAUCER
  const lights = saucer.size === 'large' ? [-0.45, 0, 0.45] : [-0.28, 0.28]
  for (const lx of lights) {
    ctx.beginPath()
    ctx.arc(r * lx, r * 0.12, Math.max(1.4, 1.8 * scale), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawMissile(ctx: CanvasRenderingContext2D, b: EnemyBullet, scale: number) {
  const ang = Math.atan2(b.vy, b.vx)
  const len = Math.max(11, 14 * scale)
  const half = Math.max(3.2, 4.2 * scale)
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(ang)
  // Exhaust
  ctx.beginPath()
  ctx.moveTo(-len * 0.55, 0)
  ctx.lineTo(-len * 0.95, half * 0.55)
  ctx.lineTo(-len * 0.95, -half * 0.55)
  ctx.closePath()
  ctx.fillStyle = 'hsla(28, 90%, 58%, 0.75)'
  ctx.fill()
  // Body
  ctx.beginPath()
  ctx.moveTo(len * 0.55, 0)
  ctx.lineTo(-len * 0.4, half)
  ctx.lineTo(-len * 0.4, -half)
  ctx.closePath()
  ctx.fillStyle = '#e07050'
  ctx.fill()
  ctx.strokeStyle = '#8f2f22'
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  ctx.lineJoin = 'round'
  ctx.stroke()
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

  for (const p of state.powerups ?? []) drawPowerup(ctx, p, scale)

  if (state.saucer) drawSaucer(ctx, state.saucer, scale)

  for (const b of state.bullets) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, Math.max(2, 2.4 * scale), 0, Math.PI * 2)
    ctx.fillStyle = ACCENT_SKY
    ctx.fill()
  }

  for (const b of state.enemyBullets ?? []) {
    if (b.kind === 'missile') drawMissile(ctx, b, scale)
    else {
      ctx.beginPath()
      ctx.arc(b.x, b.y, Math.max(2.2, b.radius || 2.6 * scale), 0, Math.PI * 2)
      ctx.fillStyle = SAUCER
      ctx.fill()
    }
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
    ctx.fillStyle = f.text.includes('×') ? ACCENT_GOLD : inkColor()
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
