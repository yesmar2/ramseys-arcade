import { getGame } from '../../data/games'
import { inkColor, playfieldColor, strokeOutlined } from '../../lib/theme'
import { HAZARD_RADIUS, radiusForLevel, type Fish, type GameState, type Hazard } from './game'

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

/**
 * Species reads relative to you, not an absolute level — otherwise once you
 * out-level the early game, everything on screen is a "shark" forever and
 * the variety disappears exactly when the ocean is fullest.
 */
type Species = 'minnow' | 'angel' | 'barracuda' | 'shark'

function speciesForGap(gap: number): Species {
  if (gap > 10) return 'shark'
  if (gap > 0) return 'barracuda'
  if (gap > -6) return 'angel'
  return 'minnow'
}

function tailAnchor(species: Species, r: number) {
  if (species === 'barracuda') return r * 1.2
  if (species === 'shark') return r * 1.0
  return r * 0.92
}

function drawTail(
  ctx: CanvasRenderingContext2D,
  species: Species,
  r: number,
  wag: number,
  color: string,
) {
  ctx.save()
  ctx.translate(-tailAnchor(species, r), 0)
  ctx.rotate(wag * 0.6)
  ctx.fillStyle = `color-mix(in srgb, ${color} 78%, transparent)`
  ctx.beginPath()
  if (species === 'barracuda' || species === 'shark') {
    // Forked tail — two swept prongs instead of a solid wedge.
    ctx.moveTo(0.1 * r, 0)
    ctx.lineTo(-0.95 * r, -0.62 * r)
    ctx.lineTo(-0.62 * r, -0.08 * r)
    ctx.lineTo(-0.95 * r, 0.62 * r)
    ctx.closePath()
  } else {
    ctx.moveTo(0, 0)
    ctx.lineTo(-r * 0.85, -r * 0.55)
    ctx.lineTo(-r * 0.55, 0)
    ctx.lineTo(-r * 0.85, r * 0.55)
    ctx.closePath()
  }
  ctx.fill()
  ctx.restore()
}

function drawFins(ctx: CanvasRenderingContext2D, species: Species, r: number, color: string) {
  const finFill = `color-mix(in srgb, ${color} 70%, transparent)`
  if (species === 'angel') {
    ctx.fillStyle = finFill
    ctx.beginPath()
    ctx.moveTo(-r * 0.12, -r * 0.6)
    ctx.lineTo(r * 0.02, -r * 1.35)
    ctx.lineTo(r * 0.32, -r * 0.58)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-r * 0.12, r * 0.6)
    ctx.lineTo(r * 0.02, r * 1.35)
    ctx.lineTo(r * 0.32, r * 0.58)
    ctx.closePath()
    ctx.fill()
    return
  }
  if (species === 'shark') {
    ctx.fillStyle = finFill
    ctx.beginPath()
    ctx.moveTo(-r * 0.15, -r * 0.55)
    ctx.lineTo(r * 0.05, -r * 1.55)
    ctx.lineTo(r * 0.38, -r * 0.5)
    ctx.closePath()
    ctx.fill()
    return
  }
  if (species === 'barracuda') {
    ctx.fillStyle = finFill
    ctx.beginPath()
    ctx.moveTo(-r * 0.05, -r * 0.32)
    ctx.lineTo(r * 0.15, -r * 0.82)
    ctx.lineTo(r * 0.4, -r * 0.3)
    ctx.closePath()
    ctx.fill()
  }
}

function bodyPath(ctx: CanvasRenderingContext2D, species: Species, r: number) {
  ctx.beginPath()
  if (species === 'angel') {
    ctx.ellipse(0, 0, r * 0.82, r * 0.92, 0, 0, Math.PI * 2)
    return
  }
  if (species === 'barracuda') {
    ctx.ellipse(r * 0.05, 0, r * 1.28, r * 0.42, 0, 0, Math.PI * 2)
    return
  }
  if (species === 'shark') {
    ctx.moveTo(r * 1.15, 0)
    ctx.quadraticCurveTo(r * 0.9, -r * 0.5, r * 0.1, -r * 0.56)
    ctx.quadraticCurveTo(-r * 0.75, -r * 0.5, -r * 0.98, -r * 0.14)
    ctx.quadraticCurveTo(-r * 1.08, 0, -r * 0.98, r * 0.14)
    ctx.quadraticCurveTo(-r * 0.75, r * 0.5, r * 0.1, r * 0.56)
    ctx.quadraticCurveTo(r * 0.9, r * 0.5, r * 1.15, 0)
    ctx.closePath()
    return
  }
  ctx.ellipse(0, 0, r, r * 0.68, 0, 0, Math.PI * 2)
}

function drawFish(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  radius: number,
  species: Species,
  angle: number,
  tail: number,
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

  drawTail(ctx, species, r, wag, color)
  drawFins(ctx, species, r, color)

  bodyPath(ctx, species, r)
  ctx.fillStyle = `color-mix(in srgb, ${color} ${player ? 42 : species === 'shark' ? 24 : 30}%, transparent)`
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, r * 0.09)
  strokeOutlined(ctx)

  const eyeX = species === 'barracuda' || species === 'shark' ? r * 0.85 : r * 0.5
  ctx.beginPath()
  ctx.arc(eyeX, -r * 0.14, Math.max(1.1, r * 0.11), 0, Math.PI * 2)
  ctx.fillStyle = player ? '#fff' : color
  ctx.fill()
  if (player) {
    ctx.beginPath()
    ctx.arc(eyeX + r * 0.04, -r * 0.14, Math.max(0.5, r * 0.05), 0, Math.PI * 2)
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

/** A mine — always a threat, whatever your level. Reads as an obstacle, not a fish. */
function drawHazard(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, radius: number, hz: Hazard) {
  ctx.save()
  ctx.translate(screenX, screenY)
  ctx.rotate(hz.bob * hz.spin)
  const pulse = 1 + Math.sin(hz.bob * 3) * 0.07
  const r = radius * pulse

  ctx.beginPath()
  ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(232, 86, 79, 0.16)'
  ctx.fill()

  const spikes = 9
  ctx.beginPath()
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2
    const outer = r * 1.55
    const inner = r * 0.82
    const ox = Math.cos(a) * outer
    const oy = Math.sin(a) * outer
    const midA = a + Math.PI / spikes
    const ix = Math.cos(midA) * inner
    const iy = Math.sin(midA) * inner
    if (i === 0) ctx.moveTo(ox, oy)
    else ctx.lineTo(ox, oy)
    ctx.lineTo(ix, iy)
  }
  ctx.closePath()
  ctx.fillStyle = '#2a2d33'
  ctx.fill()
  ctx.strokeStyle = '#e8564f'
  ctx.lineWidth = Math.max(1.2, r * 0.1)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2)
  ctx.fillStyle = '#e8564f'
  ctx.fill()
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

  for (const hz of state.hazards) {
    const radius = HAZARD_RADIUS * state.scale * state.zoom
    const p = worldToScreen(state, hz.x, hz.y)
    if (
      p.x < -radius - 40 ||
      p.x > state.stageW + radius + 40 ||
      p.y < -radius - 40 ||
      p.y > state.stageH + radius + 40
    ) {
      continue
    }
    drawHazard(ctx, p.x, p.y, radius, hz)
  }

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
    const species: Species = player ? 'minnow' : speciesForGap(f.level - state.player.level)
    const hue = player ? 0 : threatHue(f.level, state.player.level) + f.hueJitter
    const color = player
      ? ACCENT
      : `hsl(${hue}, ${species === 'shark' ? 32 : 62}%, ${species === 'shark' ? 36 : 54}%)`
    drawFish(ctx, p.x, p.y, radius, species, f.angle, f.tail, color, player, player && state.invuln > 0)
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
    // Hold at full opacity, then fade in the back half — a linear fade from
    // the start reads as "barely there" the whole time.
    const alpha = f.life > 0.5 ? 1 : Math.max(0, f.life * 2)
    const age = 1 - f.life
    const pop = age < 0.18 ? 1 + (0.18 - age) * 3 : 1
    const size = (24 + f.weight * 20) * Math.max(0.85, state.scale) * pop
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = `800 ${size}px var(--font-body, sans-serif)`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = Math.max(3, size * 0.17)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
    ctx.strokeText(f.text, sp.x, sp.y)
    ctx.fillStyle = f.weight > 0.55 ? '#ffd166' : '#ffffff'
    ctx.fillText(f.text, sp.x, sp.y)

    if (f.sub) {
      const subSize = size * 0.72
      const subY = sp.y + size * 0.78
      ctx.font = `800 ${subSize}px var(--font-body, sans-serif)`
      ctx.lineWidth = Math.max(2.5, subSize * 0.2)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
      ctx.strokeText(f.sub, sp.x, subY)
      ctx.fillStyle = '#5eeaa0'
      ctx.fillText(f.sub, sp.x, subY)
    }
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
