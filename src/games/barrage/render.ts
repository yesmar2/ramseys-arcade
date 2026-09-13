import { mixColor, withAlpha } from '../../lib/color'
import {
  inkColor,
  isFlatTheme,
  playfieldColor,
  softFillAlpha,
  strokeOutlined,
} from '../../lib/theme'
import {
  cannonRect,
  dropRadius,
  FIELD_H,
  HOLD_LINE,
  POWER_HUE,
  shipSize,
  shipX,
  shipY,
  shotSize,
  STAGE_H,
  STAGE_W,
  type GameState,
  type Ship,
} from './game'

/**
 * The canvas fills the shell, but the playfield stays a fixed 3:4 so a run on a
 * phone and a run on a desktop are the same game — the shared leaderboard
 * depends on that. The surround is painted rather than left as bars, so the
 * whole thing reads as one scene instead of a letterboxed box.
 *
 * `Place` converts the game's width-normalised units into that centred field.
 */

/** Hues lifted from the tile art, so the game and its thumbnail are one fleet. */
const HUE_UPPER = 272
const HUE_LOWER = 198
const HUE_HOT = 348

type Place = {
  /** Lengths in game units -> canvas px. */
  u: (v: number) => number
  x: (v: number) => number
  y: (v: number) => number
  ox: number
  oy: number
  fw: number
  fh: number
}

function placement(w: number, h: number): Place {
  const scale = Math.min(w / STAGE_W, h / STAGE_H)
  const fw = scale * STAGE_W
  const fh = scale * STAGE_H
  const ox = (w - fw) / 2
  const oy = (h - fh) / 2
  return { u: (v) => v * fw, x: (v) => ox + v * fw, y: (v) => oy + v * fw, ox, oy, fw, fh }
}

/** House style: soft translucent fill over a darker outline; flat theme drops the outline. */
function pastelFill(hue: number, alpha = 0.22, sat = 58) {
  return `hsla(${hue}, ${sat}%, 58%, ${softFillAlpha(alpha)})`
}

function pastelStroke(hue: number, sat = 58) {
  return `hsla(${hue}, ${sat}%, 42%, 0.95)`
}

/**
 * A quiet starfield over the whole canvas. Positions are hashed from the index
 * so it never shifts between frames — the only thing that should catch the eye
 * is a ship winding up.
 */
function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const count = Math.round((w * h) / 14000)
  ctx.fillStyle = withAlpha(inkColor(), 0.07)
  for (let i = 1; i <= count; i++) {
    const a = Math.sin(i * 12.9898) * 43758.5453
    const b = Math.sin(i * 78.233) * 12345.6789
    const x = (a - Math.floor(a)) * w
    const y = (b - Math.floor(b)) * h
    const r = ((i % 3) + 1) * 0.45
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * Settle the surround back rather than boxing the field in. A flat tint over
 * the play area draws a hard rectangle across the screen, which is the exact
 * letterboxed look this is meant to avoid; fading the margins inward reads as
 * depth instead of a border.
 */
function drawSurround(ctx: CanvasRenderingContext2D, p: Place, w: number, h: number) {
  if (isFlatTheme()) return
  const shade = withAlpha(playfieldColor(), 0.82)
  const clear = withAlpha(playfieldColor(), 0)

  /** Fade from the canvas edge (`from`) in to the field edge (`to`). */
  const band = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ) => {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    grad.addColorStop(0, shade)
    grad.addColorStop(1, clear)
    ctx.fillStyle = grad
    ctx.fillRect(rx, ry, rw, rh)
  }

  // Landscape shells leave side margins, portrait ones leave top and bottom.
  if (p.ox > 0) {
    band(0, 0, p.ox, 0, 0, 0, p.ox, h)
    band(w, 0, w - p.ox, 0, p.ox + p.fw, 0, p.ox, h)
  }
  if (p.oy > 0) {
    band(0, 0, 0, p.oy, 0, 0, w, p.oy)
    band(0, h, 0, h - p.oy, 0, p.oy + p.fh, w, p.oy)
  }
}

/** Two silhouettes, alternating by row, so the formation reads as a fleet. */
function drawShip(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  x: number,
  y: number,
  sw: number,
  sh: number,
  hue: number,
) {
  const charge = ship.charge
  ctx.fillStyle = pastelFill(hue, charge > 0 ? 0.22 + charge * 0.5 : 0.22)
  ctx.strokeStyle = pastelStroke(hue)
  ctx.lineWidth = Math.max(1, sw * 0.05)

  const paint = () => {
    ctx.fill()
    strokeOutlined(ctx)
  }

  if (ship.row % 2 === 0) {
    // Wide hull with swept wings.
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.16, y, sw * 0.68, sh * 0.62, sh * 0.24)
    paint()
    ctx.beginPath()
    ctx.roundRect(x, y + sh * 0.36, sw, sh * 0.34, sh * 0.16)
    paint()
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.1, y + sh * 0.7, sw * 0.2, sh * 0.3, sh * 0.12)
    paint()
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.7, y + sh * 0.7, sw * 0.2, sh * 0.3, sh * 0.12)
    paint()
  } else {
    // Squat hull with a dome.
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.06, y + sh * 0.32, sw * 0.88, sh * 0.5, sh * 0.2)
    paint()
    ctx.beginPath()
    ctx.arc(x + sw * 0.5, y + sh * 0.36, sw * 0.26, Math.PI, Math.PI * 2)
    paint()
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.16, y + sh * 0.8, sw * 0.18, sh * 0.2, sh * 0.1)
    paint()
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.66, y + sh * 0.8, sw * 0.18, sh * 0.2, sh * 0.1)
    paint()
  }

  // Eyes — they light as the ship winds up, which is the tell at close range.
  ctx.fillStyle =
    charge > 0 ? `hsla(${HUE_HOT}, 74%, 62%, ${0.55 + charge * 0.45})` : pastelStroke(hue)
  for (const dx of [0.36, 0.64]) {
    ctx.beginPath()
    ctx.arc(x + sw * dx, y + sh * 0.5, sw * 0.07, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * The tell. A leaning band dropped from every ship about to fire, so the safe
 * lanes are legible at a glance instead of memorised.
 */
function drawChargeLanes(ctx: CanvasRenderingContext2D, state: GameState, p: Place) {
  if (state.chargeLeft <= 0 || state.hotCols.length === 0) return
  const { w: sw, h: sh } = shipSize()

  for (const col of state.hotCols) {
    let front: Ship | null = null
    for (const s of state.ships) {
      if (!s.alive || s.col !== col) continue
      if (!front || s.row > front.row) front = s
    }
    if (!front) continue

    const progress = front.charge
    const topX = shipX(state, front) + sw / 2
    const topY = shipY(state, front) + sh
    const drop = FIELD_H - topY
    // Lean the band the way the shots will actually drift.
    const botX = topX + state.volleySpread * drop
    const half = sw * (0.22 + progress * 0.16)

    const grad = ctx.createLinearGradient(0, p.y(topY), 0, p.y(FIELD_H))
    grad.addColorStop(0, `hsla(${HUE_HOT}, 74%, 58%, ${0.06 + progress * 0.22})`)
    grad.addColorStop(0.75, `hsla(${HUE_HOT}, 74%, 58%, ${0.03 + progress * 0.12})`)
    grad.addColorStop(1, `hsla(${HUE_HOT}, 74%, 58%, 0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(p.x(topX - half), p.y(topY))
    ctx.lineTo(p.x(topX + half), p.y(topY))
    ctx.lineTo(p.x(botX + half), p.y(FIELD_H))
    ctx.lineTo(p.x(botX - half), p.y(FIELD_H))
    ctx.closePath()
    ctx.fill()
  }
}

function drawHoldLine(ctx: CanvasRenderingContext2D, state: GameState, p: Place) {
  // Redden as the fleet closes, so the stakes show without a HUD label.
  let nearest = 0
  const { h: sh } = shipSize()
  for (const s of state.ships) {
    if (!s.alive) continue
    nearest = Math.max(nearest, shipY(state, s) + sh)
  }
  const room = Math.max(0.0001, HOLD_LINE - 0.1)
  const pressure = Math.max(0, Math.min(1, (nearest - 0.1) / room))

  ctx.save()
  ctx.strokeStyle = `hsla(${HUE_HOT}, 70%, 56%, ${0.22 + pressure * 0.55})`
  ctx.lineWidth = Math.max(1, p.u(0.004))
  ctx.setLineDash([p.u(0.022), p.u(0.018)])
  ctx.beginPath()
  ctx.moveTo(p.x(0), p.y(HOLD_LINE))
  ctx.lineTo(p.x(1), p.y(HOLD_LINE))
  ctx.stroke()
  ctx.restore()
}

function drawCannon(ctx: CanvasRenderingContext2D, state: GameState, p: Place) {
  const r = cannonRect(state)
  const hit = state.hitFlash
  // The cannon reads brighter than the fleet — it is the one thing you steer.
  ctx.fillStyle = hit > 0 ? `hsla(0, 0%, 100%, ${0.35 + hit * 0.5})` : pastelFill(HUE_HOT, 0.62)
  ctx.strokeStyle = pastelStroke(HUE_HOT)
  ctx.lineWidth = Math.max(1, p.u(0.004))

  const paint = () => {
    ctx.fill()
    strokeOutlined(ctx)
  }

  ctx.beginPath()
  ctx.roundRect(p.x(r.x), p.y(r.y + r.h * 0.45), p.u(r.w), p.u(r.h * 0.55), p.u(r.h * 0.2))
  paint()

  ctx.beginPath()
  ctx.moveTo(p.x(r.x + r.w * 0.24), p.y(r.y + r.h * 0.52))
  ctx.lineTo(p.x(r.x + r.w * 0.38), p.y(r.y + r.h * 0.14))
  ctx.lineTo(p.x(r.x + r.w * 0.62), p.y(r.y + r.h * 0.14))
  ctx.lineTo(p.x(r.x + r.w * 0.76), p.y(r.y + r.h * 0.52))
  ctx.closePath()
  paint()

  ctx.beginPath()
  ctx.roundRect(
    p.x(r.x + r.w * 0.44),
    p.y(r.y - r.h * 0.2),
    p.u(r.w * 0.12),
    p.u(r.h * 0.38),
    p.u(r.w * 0.05),
  )
  paint()
}

/**
 * Falling capsules. Each carries a mark as well as a hue, so they are still
 * tellable apart without relying on colour.
 */
function drawDrops(ctx: CanvasRenderingContext2D, state: GameState, p: Place) {
  const r = dropRadius()
  for (const drop of state.drops) {
    const cx = p.x(drop.x)
    const cy = p.y(drop.y)
    const rr = p.u(r)
    const hue = POWER_HUE[drop.kind]
    // Blink out over the last second and a half rather than vanishing.
    const fading = drop.life < 1.5 ? 0.35 + 0.65 * Math.abs(Math.sin(drop.life * 9)) : 1

    ctx.globalAlpha = fading
    ctx.fillStyle = pastelFill(hue, 0.5)
    ctx.strokeStyle = pastelStroke(hue)
    ctx.lineWidth = Math.max(1, rr * 0.16)
    ctx.beginPath()
    ctx.roundRect(cx - rr, cy - rr, rr * 2, rr * 2, rr * 0.5)
    ctx.fill()
    strokeOutlined(ctx)

    ctx.strokeStyle = `hsla(${hue}, 62%, 74%, 0.95)`
    ctx.lineWidth = Math.max(1, rr * 0.18)
    ctx.lineCap = 'round'
    ctx.beginPath()
    if (drop.kind === 'pierce') {
      // An arrow driving up through the mark.
      ctx.moveTo(cx, cy + rr * 0.5)
      ctx.lineTo(cx, cy - rr * 0.52)
      ctx.moveTo(cx - rr * 0.34, cy - rr * 0.18)
      ctx.lineTo(cx, cy - rr * 0.54)
      ctx.lineTo(cx + rr * 0.34, cy - rr * 0.18)
    } else if (drop.kind === 'spread') {
      // Three diverging lines.
      for (const lean of [-0.42, 0, 0.42]) {
        ctx.moveTo(cx, cy + rr * 0.5)
        ctx.lineTo(cx + rr * lean, cy - rr * 0.5)
      }
    } else if (drop.kind === 'slow') {
      // A bar being held down.
      ctx.moveTo(cx - rr * 0.45, cy - rr * 0.18)
      ctx.lineTo(cx + rr * 0.45, cy - rr * 0.18)
      ctx.moveTo(cx - rr * 0.28, cy + rr * 0.28)
      ctx.lineTo(cx + rr * 0.28, cy + rr * 0.28)
    } else {
      // A struck-through volley.
      ctx.moveTo(cx - rr * 0.42, cy - rr * 0.42)
      ctx.lineTo(cx + rr * 0.42, cy + rr * 0.42)
      ctx.moveTo(cx + rr * 0.42, cy - rr * 0.42)
      ctx.lineTo(cx - rr * 0.42, cy + rr * 0.42)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

function drawShots(ctx: CanvasRenderingContext2D, state: GameState, p: Place) {
  for (const shot of state.shots) {
    const size = shotSize(shot.hostile)
    const x = p.x(shot.x - size.w / 2)
    const y = p.y(shot.y)
    const sw = p.u(size.w)
    const sh = p.u(size.h)

    ctx.fillStyle = shot.hostile
      ? `hsla(${HUE_HOT}, 74%, 58%, 0.95)`
      : shot.pierce
        ? `hsla(${POWER_HUE.pierce}, 80%, 64%, 0.98)`
        : withAlpha(mixColor(inkColor(), '#ffffff', 0.35), 0.95)
    ctx.beginPath()
    ctx.roundRect(x, y, Math.max(1.5, sw), sh, sw * 0.5)
    ctx.fill()
  }
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const p = placement(w, h)

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
  drawStars(ctx, w, h)

  drawSurround(ctx, p, w, h)

  drawChargeLanes(ctx, state, p)
  drawHoldLine(ctx, state, p)

  const { w: sw, h: sh } = shipSize()
  for (const ship of state.ships) {
    const x = p.x(shipX(state, ship))
    const y = p.y(shipY(state, ship))
    const hue = ship.row % 2 === 0 ? HUE_UPPER : HUE_LOWER

    if (!ship.alive) {
      if (ship.pop <= 0) continue
      // Brief burst where it died, so a hit registers without a particle system.
      const t = ship.pop / 0.32
      ctx.strokeStyle = `hsla(${hue}, 62%, 58%, ${t})`
      ctx.lineWidth = Math.max(1, p.u(0.005))
      ctx.beginPath()
      ctx.arc(x + p.u(sw / 2), y + p.u(sh / 2), p.u(sw * (0.3 + (1 - t) * 0.5)), 0, Math.PI * 2)
      ctx.stroke()
      continue
    }

    drawShip(ctx, ship, x, y, p.u(sw), p.u(sh), hue)
  }

  drawDrops(ctx, state, p)
  drawShots(ctx, state, p)
  drawCannon(ctx, state, p)

  if (state.hitFlash > 0) {
    ctx.fillStyle = `hsla(${HUE_HOT}, 74%, 58%, ${state.hitFlash * 0.16})`
    ctx.fillRect(0, 0, w, h)
  }
}
