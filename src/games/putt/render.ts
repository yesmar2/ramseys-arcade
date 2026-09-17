import { inkColor, isFlatTheme, playfieldColor, softFillAlpha, strokeOutlined } from '../../lib/theme'
import { LANE_R } from './course'
import {
  aimTrace,
  BALL_R,
  COURSE,
  CUP_R,
  currentHole,
  fieldFrame,
  toScreen,
  type GameState,
} from './game'

const GREEN_HUE = 128
const SAND_HUE = 38
const BUMPER_HUE = 348
const LANE_HUE = 198
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
  const P = (x: number, y: number) => toScreen(f, { x, y })
  const flat = isFlatTheme()
  const font = (size: number, weight = 800) => `${weight} ${size}px Outfit, system-ui, sans-serif`
  const textScale = Math.min(w, h)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

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
    const a = P(sand.x, sand.y)
    const b = P(sand.x + sand.w, sand.y + sand.h)
    ctx.fillStyle = `hsla(${SAND_HUE}, 60%, 58%, ${softFillAlpha(0.32)})`
    ctx.strokeStyle = `hsla(${SAND_HUE}, 55%, 48%, 0.85)`
    ctx.lineWidth = Math.max(1, s * 0.5)
    ctx.beginPath()
    ctx.roundRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y), s * 2.5)
    ctx.fill()
    strokeOutlined(ctx)
  }

  // ---- lanes: a ring that lights up once the ball has rolled over it
  hole.lanes.forEach((l, i) => {
    const c = P(l.x, l.y)
    const lit = state.lanesLit[i]
    ctx.fillStyle = lit
      ? `hsla(${LANE_HUE}, 70%, 60%, ${softFillAlpha(0.7)})`
      : `hsla(${LANE_HUE}, 50%, 55%, ${softFillAlpha(0.12)})`
    ctx.strokeStyle = `hsla(${LANE_HUE}, 60%, ${lit ? 62 : 45}%, ${lit ? 1 : 0.8})`
    ctx.lineWidth = Math.max(1.2, s * 0.55)
    ctx.beginPath()
    ctx.arc(c.x, c.y, LANE_R * s, 0, Math.PI * 2)
    ctx.fill()
    strokeOutlined(ctx)
    if (!lit) {
      ctx.setLineDash([s * 1.2, s * 1.2])
      ctx.beginPath()
      ctx.arc(c.x, c.y, LANE_R * s * 0.55, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })

  // ---- walls (skip the rails; the green's edge is the rail)
  ctx.strokeStyle = `hsla(${WALL_HUE}, 22%, ${flat ? 62 : 38}%, 0.95)`
  for (const wall of hole.walls.slice(4)) {
    const a = P(wall.a.x, wall.a.y)
    const b = P(wall.b.x, wall.b.y)
    ctx.lineWidth = wall.t * 2 * s
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  // ---- bumpers: pop when hit
  hole.bumpers.forEach((b, i) => {
    const c = P(b.x, b.y)
    const flash = state.bumperFlash[i] ?? 0
    const punch = flash > 0 ? 1 + 0.18 * (flash / 0.35) : 1
    ctx.fillStyle = `hsla(${BUMPER_HUE}, 55%, 58%, ${softFillAlpha(flash > 0 ? 0.6 : 0.3)})`
    ctx.strokeStyle = `hsla(${BUMPER_HUE}, 55%, 46%, 0.95)`
    ctx.lineWidth = Math.max(1.5, s * 0.7)
    ctx.beginPath()
    ctx.arc(c.x, c.y, b.r * s * punch, 0, Math.PI * 2)
    ctx.fill()
    strokeOutlined(ctx)
    ctx.fillStyle = `hsla(${BUMPER_HUE}, 55%, 46%, ${flash > 0 ? 0.95 : 0.6})`
    ctx.beginPath()
    ctx.arc(c.x, c.y, b.r * s * 0.36, 0, Math.PI * 2)
    ctx.fill()
  })

  // ---- cup and flag
  {
    const c = P(hole.cup.x, hole.cup.y)
    ctx.fillStyle = 'rgba(20, 27, 36, 0.9)'
    ctx.beginPath()
    ctx.arc(c.x, c.y, CUP_R * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `hsla(${GREEN_HUE}, 40%, 30%, 0.8)`
    ctx.lineWidth = Math.max(1, s * 0.4)
    ctx.stroke()
    // The flag stands up the screen whichever way the field lies.
    ctx.strokeStyle = ink(0.85)
    ctx.lineWidth = Math.max(1.2, s * 0.5)
    ctx.beginPath()
    ctx.moveTo(c.x + s * 0.6, c.y - s * 0.4)
    ctx.lineTo(c.x + s * 0.6, c.y - s * 9)
    ctx.stroke()
    ctx.fillStyle = 'hsla(348, 62%, 58%, 0.95)'
    ctx.beginPath()
    ctx.moveTo(c.x + s * 0.6, c.y - s * 9)
    ctx.lineTo(c.x + s * 6.5, c.y - s * 7.4)
    ctx.lineTo(c.x + s * 0.6, c.y - s * 5.8)
    ctx.closePath()
    ctx.fill()
  }

  // ---- aim: a dotted line to what the shot would hit, weighted by power
  if (state.phase === 'aim') {
    const live = state.aiming !== 'none'
    const power = live ? state.power : 0
    const reach = live ? 14 + power * 70 : 16
    const end = aimTrace(state, state.aim, reach)
    const b = P(state.ball.x, state.ball.y)
    const e = P(end.x, end.y)
    const hue = 128 - power * 100
    ctx.save()
    ctx.setLineDash([s * 1.4, s * 1.6])
    ctx.strokeStyle = live ? `hsla(${hue}, 65%, 52%, 0.95)` : ink(0.4)
    ctx.lineWidth = Math.max(1.4, s * (live ? 0.7 : 0.5))
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(e.x, e.y)
    ctx.stroke()
    ctx.restore()
    // Arrowhead, in screen space so the rotation is right.
    const a = Math.atan2(e.y - b.y, e.x - b.x)
    const dist = Math.hypot(e.x - b.x, e.y - b.y)
    const tipX = b.x + Math.cos(a) * Math.min(dist, s * 7)
    const tipY = b.y + Math.sin(a) * Math.min(dist, s * 7)
    ctx.fillStyle = live ? `hsla(${hue}, 65%, 52%, 0.95)` : ink(0.5)
    ctx.beginPath()
    ctx.moveTo(tipX + Math.cos(a) * s * 1.8, tipY + Math.sin(a) * s * 1.8)
    ctx.lineTo(tipX + Math.cos(a + 2.4) * s * 1.5, tipY + Math.sin(a + 2.4) * s * 1.5)
    ctx.lineTo(tipX + Math.cos(a - 2.4) * s * 1.5, tipY + Math.sin(a - 2.4) * s * 1.5)
    ctx.closePath()
    ctx.fill()
    // The pull-back, behind the ball: how hard it will go.
    if (live && power > 0) {
      const back = a + Math.PI
      const len = power * s * 18
      ctx.strokeStyle = `hsla(${hue}, 65%, 52%, 0.35)`
      ctx.lineWidth = Math.max(2, s * 1.2)
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x + Math.cos(back) * len, b.y + Math.sin(back) * len)
      ctx.stroke()
    }
  }

  // ---- ball
  if (state.phase !== 'menu' && state.phase !== 'gameover' && state.drop > 0) {
    const c = P(state.ball.x, state.ball.y)
    const r = BALL_R * s * state.drop
    ctx.fillStyle = state.inSand ? 'rgba(240, 232, 216, 0.98)' : 'rgba(245, 247, 250, 0.98)'
    ctx.strokeStyle = 'rgba(20, 27, 36, 0.55)'
    ctx.lineWidth = Math.max(1, s * 0.45)
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
    ctx.fill()
    strokeOutlined(ctx)
  }

  // ---- floaters: "+50" rising off a bumper or a lane
  for (const fl of state.floaters) {
    const c = P(fl.x, fl.y)
    const rise = (0.9 - fl.life) * s * 6
    const alpha = Math.min(1, fl.life / 0.3)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(11, s * 4.2), 800)
    ctx.fillStyle = `hsla(${LANE_HUE}, 70%, 60%, ${alpha})`
    ctx.fillText(fl.text, c.x, c.y - rise)
  }

  // ---- the band above: hole, par, strokes, and this hole's pinball so far
  if (state.phase !== 'menu') {
    const holeNo = Math.min(state.holeIndex + 1, COURSE.length)
    const inset = Math.max(w * 0.12, 56)
    const cy = f.top * 0.55
    const hasBonus = state.holeBonus > 0
    // With pinball on the board the right side takes two lines, and the top line lifts to make room.
    const lift = hasBonus ? f.top * 0.17 : 0
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(12, textScale * 0.035), 800)
    ctx.fillStyle = ink(0.92)
    ctx.fillText(`HOLE ${holeNo}`, inset, cy - lift)
    ctx.textAlign = 'right'
    ctx.fillStyle = ink(0.62)
    ctx.font = font(Math.max(11, textScale * 0.03), 750)
    const strokeWord = state.strokes === 1 ? 'STROKE' : 'STROKES'
    ctx.fillText(`PAR ${hole.par}  ·  ${state.strokes} ${strokeWord}`, w - inset, cy - lift)
    if (hasBonus) {
      ctx.font = font(Math.max(10, textScale * 0.026), 800)
      ctx.fillStyle = `hsla(${LANE_HUE}, 60%, 48%, 0.95)`
      ctx.fillText(`PINBALL +${state.holeBonus}`, w - inset, cy + f.top * 0.2)
    }
  }

  // ---- the band below: the cue
  {
    const by = h - f.bottom / 2
    let cue = ''
    if (state.phase === 'aim') {
      cue =
        state.aiming === 'drag'
          ? 'LET GO TO SHOOT'
          : state.aiming === 'key'
            ? state.charging
              ? 'RELEASE SPACE TO SHOOT'
              : 'HOLD SPACE TO CHARGE, LET GO TO SHOOT'
            : 'PULL BACK FROM THE BALL, LET GO TO SHOOT'
    } else if (state.phase === 'intro') {
      cue = hole.name.toUpperCase()
    }
    if (cue) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = font(Math.max(11, textScale * 0.027), 750)
      ctx.fillStyle = ink(0.5)
      ctx.fillText(cue, w / 2, by)
    }
  }

  // ---- hole intro, over the field
  if (state.phase === 'intro') {
    const cx = f.x + f.w / 2
    const cy = f.y + f.h * 0.46
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = ink(0.96)
    ctx.font = font(Math.max(22, textScale * 0.085), 800)
    ctx.fillText(`Hole ${state.holeIndex + 1}`, cx, cy)
    ctx.font = font(Math.max(13, textScale * 0.04), 750)
    ctx.fillStyle = ink(0.7)
    ctx.fillText(`Par ${hole.par}  ·  ${hole.name}`, cx, cy + textScale * 0.08)
  }

  // ---- popup: the result of the hole
  if (state.popup) {
    const life = state.popup.life
    const rise = (1.7 - life) * s * 5
    const alpha = Math.min(1, life / 0.4)
    const cx = f.x + f.w / 2
    const cy = f.y + f.h * 0.5
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(20, textScale * 0.075), 800)
    ctx.fillStyle = ink(0.96 * alpha)
    ctx.fillText(state.popup.text, cx, cy - rise)
    if (state.popup.sub) {
      ctx.font = font(Math.max(13, textScale * 0.04), 800)
      ctx.fillStyle = `hsla(${GREEN_HUE}, 55%, 50%, ${alpha})`
      ctx.fillText(state.popup.sub, cx, cy - rise + textScale * 0.07)
    }
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.25})`
    ctx.fillRect(0, 0, w, h)
  }
}
