import { inkColor, playfieldColor, resolveGameAccent, strokeOutlined } from '../../lib/theme'
import { mixColor, withAlpha as alpha } from '../../lib/color'
import {
  bunkerCellSize,
  BUNKER_COLS,
  cannonRect,
  COLS,
  FIELD_H,
  HOLD_LINE,
  shipSize,
  shipX,
  shipY,
  shotSize,
  type GameState,
  type Ship,
} from './game'

/**
 * Everything is in stage-width units, so the whole renderer scales off `w` and
 * the 3:4 stage makes `h` fall out of it. `u(v)` is the one conversion.
 */

const ACCENT = () => resolveGameAccent('barrage', '#e85d75')
const HOT = 'hsl(352, 74%, 58%)'

function fade(t: number): string {
  return mixColor(inkColor(), playfieldColor(), t)
}

/** Two silhouettes, alternating by row, so the formation reads as a fleet. */
function drawShip(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  x: number,
  y: number,
  sw: number,
  sh: number,
  body: string,
  ink: string,
) {
  ctx.fillStyle = body
  if (ship.row % 2 === 0) {
    // Wide hull with swept wings.
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.16, y, sw * 0.68, sh * 0.6, sh * 0.22)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(x, y + sh * 0.34, sw, sh * 0.34, sh * 0.16)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.1, y + sh * 0.68, sw * 0.2, sh * 0.32, sh * 0.12)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.7, y + sh * 0.68, sw * 0.2, sh * 0.32, sh * 0.12)
    ctx.fill()
  } else {
    // Squat hull with a dome.
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.06, y + sh * 0.3, sw * 0.88, sh * 0.52, sh * 0.2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x + sw * 0.5, y + sh * 0.34, sw * 0.26, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.16, y + sh * 0.8, sw * 0.18, sh * 0.2, sh * 0.1)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(x + sw * 0.66, y + sh * 0.8, sw * 0.18, sh * 0.2, sh * 0.1)
    ctx.fill()
  }

  // Eyes, so a charging ship has somewhere to light up.
  const eyeR = sw * 0.06
  ctx.fillStyle = ink
  for (const dx of [0.36, 0.64]) {
    ctx.beginPath()
    ctx.arc(x + sw * dx, y + sh * 0.48, eyeR, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * The tell. A leaning band dropped from every ship that is about to fire, so
 * the safe lanes are legible at a glance instead of memorised.
 */
function drawChargeLanes(ctx: CanvasRenderingContext2D, state: GameState, u: (v: number) => number) {
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
    const half = sw * (0.2 + progress * 0.16)

    const grad = ctx.createLinearGradient(0, u(topY), 0, u(FIELD_H))
    grad.addColorStop(0, alpha(HOT, 0.05 + progress * 0.2))
    grad.addColorStop(0.75, alpha(HOT, 0.03 + progress * 0.12))
    grad.addColorStop(1, alpha(HOT, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(u(topX - half), u(topY))
    ctx.lineTo(u(topX + half), u(topY))
    ctx.lineTo(u(botX + half), u(FIELD_H))
    ctx.lineTo(u(botX - half), u(FIELD_H))
    ctx.closePath()
    ctx.fill()
  }
}

function drawHoldLine(ctx: CanvasRenderingContext2D, state: GameState, u: (v: number) => number, w: number) {
  // Redden as the fleet closes, so the stakes are visible without a HUD label.
  let nearest = 0
  const { h: sh } = shipSize()
  for (const s of state.ships) {
    if (!s.alive) continue
    nearest = Math.max(nearest, shipY(state, s) + sh)
  }
  const room = Math.max(0.0001, HOLD_LINE - 0.1)
  const pressure = Math.max(0, Math.min(1, (nearest - 0.1) / room))

  ctx.save()
  ctx.strokeStyle = alpha(HOT, 0.2 + pressure * 0.6)
  ctx.lineWidth = Math.max(1, w * 0.004)
  ctx.setLineDash([w * 0.022, w * 0.018])
  ctx.beginPath()
  ctx.moveTo(0, u(HOLD_LINE))
  ctx.lineTo(w, u(HOLD_LINE))
  ctx.stroke()
  ctx.restore()
}

function drawBunkers(ctx: CanvasRenderingContext2D, state: GameState, u: (v: number) => number) {
  const cell = bunkerCellSize()
  ctx.fillStyle = fade(0.42)
  for (const bunker of state.bunkers) {
    bunker.cells.forEach((intact, i) => {
      if (!intact) return
      const c = i % BUNKER_COLS
      const r = Math.floor(i / BUNKER_COLS)
      ctx.fillRect(
        u(bunker.x + c * cell.w),
        u(bunker.y + r * cell.h),
        u(cell.w) + 0.6,
        u(cell.h) + 0.6,
      )
    })
  }
}

function drawCannon(ctx: CanvasRenderingContext2D, state: GameState, u: (v: number) => number) {
  const r = cannonRect(state)
  const accent = ACCENT()
  const body = state.hitFlash > 0 ? mixColor(accent, '#ffffff', state.hitFlash * 0.7) : accent

  ctx.fillStyle = body
  ctx.strokeStyle = alpha(inkColor(), 0.25)
  ctx.lineWidth = Math.max(1, u(0.003))

  // Base.
  ctx.beginPath()
  ctx.roundRect(u(r.x), u(r.y + r.h * 0.45), u(r.w), u(r.h * 0.55), u(r.h * 0.18))
  ctx.fill()
  strokeOutlined(ctx)

  // Turret and barrel.
  ctx.beginPath()
  ctx.moveTo(u(r.x + r.w * 0.22), u(r.y + r.h * 0.5))
  ctx.lineTo(u(r.x + r.w * 0.38), u(r.y + r.h * 0.12))
  ctx.lineTo(u(r.x + r.w * 0.62), u(r.y + r.h * 0.12))
  ctx.lineTo(u(r.x + r.w * 0.78), u(r.y + r.h * 0.5))
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.roundRect(u(r.x + r.w * 0.44), u(r.y - r.h * 0.22), u(r.w * 0.12), u(r.h * 0.4), u(r.w * 0.05))
  ctx.fill()
}

function drawShots(ctx: CanvasRenderingContext2D, state: GameState, u: (v: number) => number) {
  for (const shot of state.shots) {
    const size = shotSize(shot.hostile)
    const x = u(shot.x - size.w / 2)
    const y = u(shot.y)
    const sw = u(size.w)
    const sh = u(size.h)

    if (shot.hostile) {
      ctx.fillStyle = HOT
      ctx.beginPath()
      ctx.roundRect(x, y, sw, sh, sw * 0.5)
      ctx.fill()
      continue
    }
    ctx.fillStyle = mixColor(inkColor(), '#ffffff', 0.2)
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
  // One conversion for both axes — the stage aspect guarantees h === w * FIELD_H.
  const u = (v: number) => v * w

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  drawChargeLanes(ctx, state, u)
  drawHoldLine(ctx, state, u, w)
  drawBunkers(ctx, state, u)

  const { w: sw, h: sh } = shipSize()
  const ink = playfieldColor()
  for (const ship of state.ships) {
    const x = u(shipX(state, ship))
    const y = u(shipY(state, ship))

    if (!ship.alive) {
      if (ship.pop <= 0) continue
      // Brief burst where it died, so a hit registers without a particle system.
      const t = ship.pop / 0.32
      ctx.strokeStyle = alpha(ACCENT(), t)
      ctx.lineWidth = Math.max(1, u(0.005))
      ctx.beginPath()
      ctx.arc(x + u(sw / 2), y + u(sh / 2), u(sw * (0.3 + (1 - t) * 0.5)), 0, Math.PI * 2)
      ctx.stroke()
      continue
    }

    const cool = fade(0.3 + (ship.row / COLS) * 0.12)
    const body = ship.charge > 0 ? mixColor(cool, HOT, 0.3 + ship.charge * 0.7) : cool
    drawShip(ctx, ship, x, y, u(sw), u(sh), body, ink)
  }

  drawShots(ctx, state, u)
  drawCannon(ctx, state, u)

  if (state.hitFlash > 0) {
    ctx.fillStyle = alpha(HOT, state.hitFlash * 0.16)
    ctx.fillRect(0, 0, w, h)
  }
}
