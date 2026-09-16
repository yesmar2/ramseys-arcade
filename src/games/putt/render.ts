import { inkColor, isFlatTheme, playfieldColor, softFillAlpha, strokeOutlined } from '../../lib/theme'
import {
  aimTrace,
  BALL_R,
  COURSE,
  CUP_R,
  currentHole,
  fieldFrame,
  powerAt,
  type GameState,
} from './game'

const GREEN_HUE = 128
const SAND_HUE = 38
const BUMPER_HUE = 348
const WALL_HUE = 214

/** The theme's ink at an alpha: text, the aim line and the flagpole read on light and dark alike. */
function ink(alpha: number) {
  const hex = inkColor().replace('#', '')
  if (hex.length !== 6) return `rgba(20, 27, 36, ${alpha})`
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
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

function capsule(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, width: number) {
  ctx.lineCap = 'round'
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  drawBackground(ctx, w, h)

  const hole = currentHole(state)
  const f = fieldFrame(w, h)
  const s = f.s
  const X = (x: number) => f.x + x * s
  const Y = (y: number) => f.y + y * s
  const flat = isFlatTheme()
  const font = (size: number, weight = 800) => `${weight} ${size}px Outfit, system-ui, sans-serif`

  // ---- the green
  ctx.fillStyle = `hsla(${GREEN_HUE}, 45%, 52%, ${softFillAlpha(0.2)})`
  ctx.strokeStyle = `hsla(${GREEN_HUE}, 45%, 42%, 0.9)`
  ctx.lineWidth = Math.max(1.5, s * 0.6)
  ctx.beginPath()
  ctx.roundRect(f.x, f.y, f.w, f.h, s * 3)
  ctx.fill()
  strokeOutlined(ctx)

  // ---- sand
  for (const sand of hole.sand) {
    ctx.fillStyle = `hsla(${SAND_HUE}, 60%, 58%, ${softFillAlpha(0.32)})`
    ctx.strokeStyle = `hsla(${SAND_HUE}, 55%, 48%, 0.85)`
    ctx.lineWidth = Math.max(1, s * 0.5)
    ctx.beginPath()
    ctx.roundRect(X(sand.x), Y(sand.y), sand.w * s, sand.h * s, s * 2.5)
    ctx.fill()
    strokeOutlined(ctx)
  }

  // ---- walls (skip the rails; the green's edge is the rail)
  ctx.strokeStyle = `hsla(${WALL_HUE}, 22%, ${flat ? 62 : 38}%, 0.95)`
  for (const wall of hole.walls.slice(4)) {
    capsule(ctx, X(wall.a.x), Y(wall.a.y), X(wall.b.x), Y(wall.b.y), wall.t * 2 * s)
  }

  // ---- bumpers
  for (const b of hole.bumpers) {
    ctx.fillStyle = `hsla(${BUMPER_HUE}, 52%, 58%, ${softFillAlpha(0.3)})`
    ctx.strokeStyle = `hsla(${BUMPER_HUE}, 52%, 45%, 0.95)`
    ctx.lineWidth = Math.max(1.5, s * 0.7)
    ctx.beginPath()
    ctx.arc(X(b.x), Y(b.y), b.r * s, 0, Math.PI * 2)
    ctx.fill()
    strokeOutlined(ctx)
    ctx.fillStyle = `hsla(${BUMPER_HUE}, 52%, 45%, 0.6)`
    ctx.beginPath()
    ctx.arc(X(b.x), Y(b.y), b.r * s * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- cup and flag
  {
    const cx = X(hole.cup.x)
    const cy = Y(hole.cup.y)
    ctx.fillStyle = 'rgba(20, 27, 36, 0.9)'
    ctx.beginPath()
    ctx.arc(cx, cy, CUP_R * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `hsla(${GREEN_HUE}, 40%, 30%, 0.8)`
    ctx.lineWidth = Math.max(1, s * 0.4)
    ctx.stroke()
    // A flag leans away, so it never hides the cup.
    ctx.strokeStyle = ink(0.85)
    ctx.lineWidth = Math.max(1.2, s * 0.5)
    ctx.beginPath()
    ctx.moveTo(cx + s * 0.6, cy - s * 0.4)
    ctx.lineTo(cx + s * 0.6, cy - s * 9)
    ctx.stroke()
    ctx.fillStyle = 'hsla(348, 62%, 58%, 0.95)'
    ctx.beginPath()
    ctx.moveTo(cx + s * 0.6, cy - s * 9)
    ctx.lineTo(cx + s * 6.5, cy - s * 7.4)
    ctx.lineTo(cx + s * 0.6, cy - s * 5.8)
    ctx.closePath()
    ctx.fill()
  }

  // ---- aim line
  if (state.phase === 'aim' || state.phase === 'power') {
    const end = aimTrace(state, state.aim)
    const bx = X(state.ball.x)
    const by = Y(state.ball.y)
    const ex = X(end.x)
    const ey = Y(end.y)
    ctx.save()
    ctx.setLineDash([s * 1.4, s * 1.6])
    ctx.strokeStyle = state.phase === 'power' ? ink(0.9) : ink(0.55)
    ctx.lineWidth = Math.max(1.2, s * 0.55)
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.restore()
    const a = state.aim
    const tipX = bx + Math.cos(a) * s * 7
    const tipY = by + Math.sin(a) * s * 7
    ctx.fillStyle = ink(0.9)
    ctx.beginPath()
    ctx.moveTo(tipX + Math.cos(a) * s * 1.8, tipY + Math.sin(a) * s * 1.8)
    ctx.lineTo(tipX + Math.cos(a + 2.4) * s * 1.5, tipY + Math.sin(a + 2.4) * s * 1.5)
    ctx.lineTo(tipX + Math.cos(a - 2.4) * s * 1.5, tipY + Math.sin(a - 2.4) * s * 1.5)
    ctx.closePath()
    ctx.fill()
  }

  // ---- ball
  if (state.phase !== 'menu' && state.phase !== 'gameover' && state.drop > 0) {
    const r = BALL_R * s * state.drop
    ctx.fillStyle = state.inSand ? 'rgba(240, 232, 216, 0.98)' : 'rgba(245, 247, 250, 0.98)'
    ctx.strokeStyle = 'rgba(20, 27, 36, 0.55)'
    ctx.lineWidth = Math.max(1, s * 0.45)
    ctx.beginPath()
    ctx.arc(X(state.ball.x), Y(state.ball.y), r, 0, Math.PI * 2)
    ctx.fill()
    strokeOutlined(ctx)
  }

  // ---- the band above: hole, par, strokes
  if (state.phase !== 'menu') {
    const holeNo = Math.min(state.holeIndex + 1, COURSE.length)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(12, w * 0.035), 800)
    ctx.fillStyle = ink(0.92)
    // Inset past the back and fullscreen buttons that sit in the band's corners.
    const inset = w * 0.12
    ctx.fillText(`HOLE ${holeNo}`, inset, f.top * 0.55)
    ctx.textAlign = 'right'
    ctx.fillStyle = ink(0.62)
    ctx.font = font(Math.max(11, w * 0.03), 750)
    const strokeWord = state.strokes === 1 ? 'STROKE' : 'STROKES'
    ctx.fillText(`PAR ${hole.par}  ·  ${state.strokes} ${strokeWord}`, w - inset, f.top * 0.55)
  }

  // ---- the band below: the power bar, or a cue
  {
    const by = h - f.bottom / 2
    const bw = f.w * 0.62
    const bx = w / 2 - bw / 2
    const bh = Math.max(8, f.bottom * 0.3)
    if (state.phase === 'power') {
      const p = powerAt(state.t)
      ctx.fillStyle = ink(0.12)
      ctx.beginPath()
      ctx.roundRect(bx, by - bh / 2, bw, bh, bh / 2)
      ctx.fill()
      const hue = 128 - p * 90
      ctx.fillStyle = `hsla(${hue}, 60%, 55%, 0.95)`
      ctx.beginPath()
      ctx.roundRect(bx, by - bh / 2, Math.max(bh, bw * p), bh, bh / 2)
      ctx.fill()
    } else if (state.phase === 'aim' || state.phase === 'intro') {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = font(Math.max(11, w * 0.028), 750)
      ctx.fillStyle = ink(0.55)
      ctx.fillText(state.phase === 'aim' ? 'TAP TO STOP THE AIM' : `${hole.name.toUpperCase()}`, w / 2, by)
    }
  }

  // ---- hole intro, over the field
  if (state.phase === 'intro') {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = ink(0.96)
    ctx.font = font(Math.max(22, w * 0.085), 800)
    ctx.fillText(`Hole ${state.holeIndex + 1}`, w / 2, f.y + f.h * 0.46)
    ctx.font = font(Math.max(13, w * 0.04), 750)
    ctx.fillStyle = ink(0.7)
    ctx.fillText(`Par ${hole.par}  ·  ${hole.name}`, w / 2, f.y + f.h * 0.46 + w * 0.08)
  }

  // ---- popup: the result of the hole
  if (state.popup) {
    const life = state.popup.life
    const rise = (1.6 - life) * s * 6
    const alpha = Math.min(1, life / 0.4)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(20, w * 0.075), 800)
    ctx.fillStyle = ink(0.96 * alpha)
    ctx.fillText(state.popup.text, w / 2, f.y + f.h * 0.5 - rise)
    if (state.popup.sub) {
      ctx.font = font(Math.max(14, w * 0.045), 800)
      ctx.fillStyle = `hsla(${GREEN_HUE}, 55%, 62%, ${alpha})`
      ctx.fillText(state.popup.sub, w / 2, f.y + f.h * 0.5 - rise + w * 0.075)
    }
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.25})`
    ctx.fillRect(0, 0, w, h)
  }
}
