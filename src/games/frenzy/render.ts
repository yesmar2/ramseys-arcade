import { getGame } from '../../data/games'
import { inkColor, playfieldColor, strokeOutlined } from '../../lib/theme'
import type { Fish, GameState } from './game'

const ACCENT = getGame('frenzy')?.accent ?? '#c65bd9'
const SAFE_HUE = 172
const NEUTRAL_HUE = 206
const DANGER_HUE = 6
const EAT_MARGIN = 1.12

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number) {
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = inkColor()
  ctx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const x = ((i * 190 + elapsed * 14) % (w + 160)) - 80
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x - 60, h)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.fillStyle = inkColor()
  for (let i = 0; i < 14; i++) {
    const seed = i * 137.5
    const bx = (seed * 1.9) % w
    const t = (elapsed * (10 + (i % 5) * 4) + seed) % (h + 60)
    const by = h - t
    const r = 1.4 + (i % 3) * 0.9
    ctx.globalAlpha = 0.08 + 0.05 * Math.sin(elapsed + i)
    ctx.beginPath()
    ctx.arc(bx, by, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function threatHue(radius: number, playerRadius: number) {
  if (radius > playerRadius * EAT_MARGIN) return DANGER_HUE
  if (radius < playerRadius / EAT_MARGIN) return SAFE_HUE
  return NEUTRAL_HUE
}

function drawFish(
  ctx: CanvasRenderingContext2D,
  f: Fish,
  color: string,
  player: boolean,
  invuln: boolean,
) {
  ctx.save()
  ctx.translate(f.x, f.y)
  ctx.rotate(f.angle)
  if (invuln) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(f.tail * 6)

  const r = f.radius
  const wag = Math.sin(f.tail) * 0.55

  // Tail
  ctx.save()
  ctx.translate(-r * 0.92, 0)
  ctx.rotate(wag * 0.6)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-r * 0.85, -r * 0.55)
  ctx.lineTo(-r * 0.55, 0)
  ctx.lineTo(-r * 0.85, r * 0.55)
  ctx.closePath()
  ctx.fillStyle = `color-mix(in srgb, ${color} 78%, transparent)`
  ctx.fill()
  ctx.restore()

  if (f.shark) {
    ctx.beginPath()
    ctx.moveTo(-r * 0.1, -r * 0.9)
    ctx.lineTo(r * 0.2, -r * 1.5)
    ctx.lineTo(r * 0.45, -r * 0.85)
    ctx.closePath()
    ctx.fillStyle = `color-mix(in srgb, ${color} 70%, transparent)`
    ctx.fill()
  }

  // Body
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.68, 0, 0, Math.PI * 2)
  ctx.fillStyle = `color-mix(in srgb, ${color} ${player ? 42 : 30}%, transparent)`
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, r * 0.09)
  strokeOutlined(ctx)

  // Eye
  ctx.beginPath()
  ctx.arc(r * 0.5, -r * 0.14, Math.max(1.1, r * 0.11), 0, Math.PI * 2)
  ctx.fillStyle = player ? '#fff' : color
  ctx.fill()
  if (player) {
    ctx.beginPath()
    ctx.arc(r * 0.54, -r * 0.14, Math.max(0.5, r * 0.05), 0, Math.PI * 2)
    ctx.fillStyle = inkColor()
    ctx.fill()
  }

  ctx.restore()
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  ctx.save()
  if (state.shake > 0) {
    const k = state.shake * 6
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k)
  }

  drawBackground(ctx, w, h, state.elapsed)

  for (const f of state.fishes) {
    const hue = threatHue(f.radius, state.player.radius) + f.hueJitter
    const sat = f.shark ? 30 : 62
    const light = f.shark ? 34 : 54
    drawFish(ctx, f, `hsl(${hue}, ${sat}%, ${light}%)`, false, false)
  }

  drawFish(ctx, state.player, ACCENT, true, state.invuln > 0)

  for (const p of state.particles) {
    const a = Math.max(0, p.life)
    ctx.beginPath()
    ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${a})`
    ctx.arc(p.x, p.y, Math.max(1, 3 * a), 0, Math.PI * 2)
    ctx.fill()
  }

  for (const f of state.floaters) {
    const a = Math.max(0, f.life)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = inkColor()
    ctx.font = `700 ${Math.max(12, 14 * state.scale)}px var(--font-body, sans-serif)`
    ctx.textAlign = 'center'
    ctx.fillText(f.text, f.x, f.y)
    ctx.restore()
  }

  if (state.danger && state.phase === 'playing') {
    ctx.save()
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(state.elapsed * 10)
    ctx.fillStyle = `hsl(${DANGER_HUE}, 70%, 45%)`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  if (state.flash > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.5, state.flash)
    ctx.fillStyle = `hsl(${DANGER_HUE}, 80%, 55%)`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  ctx.restore()
}
