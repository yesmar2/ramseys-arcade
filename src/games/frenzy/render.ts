import { getGame } from '../../data/games'
import { inkColor, playfieldColor, strokeOutlined } from '../../lib/theme'
import { radiusForLevel, type Fish, type GameState } from './game'

const ACCENT = getGame('frenzy')?.accent ?? '#c65bd9'
const SAFE_HUE = 172
const DANGER_HUE = 6

function worldToScreen(state: GameState, x: number, y: number) {
  return {
    x: (x - state.cameraX) * state.zoom + state.stageW / 2,
    y: (y - state.cameraY) * state.zoom + state.stageH / 2,
  }
}

function hashCell(ix: number, iy: number) {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState) {
  const { stageW: w, stageH: h, zoom, cameraX, cameraY, elapsed } = state
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  const halfW = w / 2 / zoom
  const halfH = h / 2 / zoom
  const grid = 130
  const x0 = Math.floor((cameraX - halfW) / grid) - 1
  const x1 = Math.ceil((cameraX + halfW) / grid) + 1
  const y0 = Math.floor((cameraY - halfH) / grid) - 1
  const y1 = Math.ceil((cameraY + halfH) / grid) + 1

  ctx.save()
  ctx.fillStyle = inkColor()
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      const jitterX = (hashCell(ix, iy) - 0.5) * grid * 0.7
      const jitterY = (hashCell(ix + 91, iy - 47) - 0.5) * grid * 0.7
      const wx = ix * grid + grid / 2 + jitterX
      const wy = iy * grid + grid / 2 + jitterY
      const p = worldToScreen(state, wx, wy)
      const drift = Math.sin(elapsed * 0.6 + ix * 1.7 + iy) * 6
      const r = 1.1 + hashCell(ix * 3, iy * 5) * 1.6
      ctx.globalAlpha = 0.06 + 0.05 * hashCell(ix * 7, iy * 11)
      ctx.beginPath()
      ctx.arc(p.x, p.y + drift * zoom, Math.max(0.6, r * zoom), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function threatHue(level: number, playerLevel: number) {
  return level > playerLevel ? DANGER_HUE : SAFE_HUE
}

function drawFish(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  radius: number,
  angle: number,
  tail: number,
  shark: boolean,
  color: string,
  player: boolean,
  invuln: boolean,
) {
  ctx.save()
  ctx.translate(screenX, screenY)
  ctx.rotate(angle)
  if (invuln) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(tail * 6)

  const r = radius
  const wag = Math.sin(tail) * 0.55

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

  if (shark) {
    ctx.beginPath()
    ctx.moveTo(-r * 0.1, -r * 0.9)
    ctx.lineTo(r * 0.2, -r * 1.5)
    ctx.lineTo(r * 0.45, -r * 0.85)
    ctx.closePath()
    ctx.fillStyle = `color-mix(in srgb, ${color} 70%, transparent)`
    ctx.fill()
  }

  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.68, 0, 0, Math.PI * 2)
  ctx.fillStyle = `color-mix(in srgb, ${color} ${player ? 42 : 30}%, transparent)`
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, r * 0.09)
  strokeOutlined(ctx)

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

function drawLevelBadge(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, level: number) {
  const fontSize = Math.min(26, Math.max(10, radius * 0.62))
  ctx.save()
  ctx.font = `800 ${fontSize}px var(--font-body, sans-serif)`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, fontSize * 0.22)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.strokeText(String(level), x, y)
  ctx.fillStyle = '#fff'
  ctx.fillText(String(level), x, y)
  ctx.restore()
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.save()
  if (state.shake > 0) {
    const k = state.shake * 6
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k)
  }

  drawBackground(ctx, state)

  const badges: { x: number; y: number; radius: number; level: number }[] = []

  const drawOne = (f: Fish, player: boolean) => {
    const radius = radiusForLevel(f.level, state.scale) * state.zoom
    const p = worldToScreen(state, f.x, f.y)
    if (
      p.x < -radius - 40 ||
      p.x > state.stageW + radius + 40 ||
      p.y < -radius - 40 ||
      p.y > state.stageH + radius + 40
    ) {
      return
    }
    const hue = player ? 0 : threatHue(f.level, state.player.level) + f.hueJitter
    const color = player ? ACCENT : `hsl(${hue}, ${f.shark ? 30 : 62}%, ${f.shark ? 34 : 54}%)`
    drawFish(ctx, p.x, p.y, radius, f.angle, f.tail, f.shark, color, player, player && state.invuln > 0)
    badges.push({ x: p.x, y: p.y, radius, level: f.level })
  }

  for (const f of state.fishes) drawOne(f, false)
  drawOne(state.player, true)

  for (const p of state.particles) {
    const sp = worldToScreen(state, p.x, p.y)
    const a = Math.max(0, p.life)
    ctx.beginPath()
    ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${a})`
    ctx.arc(sp.x, sp.y, Math.max(1, 3 * a * state.zoom), 0, Math.PI * 2)
    ctx.fill()
  }

  for (const badge of badges) drawLevelBadge(ctx, badge.x, badge.y, badge.radius, badge.level)

  for (const f of state.floaters) {
    const sp = worldToScreen(state, f.x, f.y)
    const a = Math.max(0, f.life)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = inkColor()
    ctx.font = `700 ${Math.max(12, 15 * state.scale)}px var(--font-body, sans-serif)`
    ctx.textAlign = 'center'
    ctx.fillText(f.text, sp.x, sp.y)
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
