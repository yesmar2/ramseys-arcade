import type { GameState, Vehicle } from './game'
import {
  BACK_LIMIT,
  MILESTONE_STEP,
  STALL_LIMIT,
  STALL_WARN,
  TARGET_VISIBLE_ROWS,
  cellMetrics,
  easeHop,
  getRailCycle,
  getRow,
  laneSpan,
} from './game'
import { isDarkTheme, playfieldColor } from '../../lib/theme'

const GRASS_A = 142
const GRASS_B = 152
const TREE = 158
const HOPPER = 42

export type StrideLayout = {
  cell: number
  visibleRows: number
  cols: number
  ox: number
  oy: number
  hudTop: number
  gridW: number
}

export function computeLayout(w: number, h: number, cols: number): StrideLayout {
  const { cell, availH, hudTop } = cellMetrics(w, h)
  const visibleRows = Math.max(7, Math.min(TARGET_VISIBLE_ROWS + 1, Math.floor(availH / cell)))
  const gridW = cell * cols
  const gridH = visibleRows * cell
  const ox = Math.max(0, (w - gridW) / 2)
  const oy = hudTop + Math.max(0, (availH - gridH) * 0.5)
  return { cell, visibleRows, cols, ox, oy, hudTop, gridW }
}

function fill(hue: number, sat: number, light: number, alpha: number) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Lane entities live at `x` and `x - span`; drawing both keeps the wrap seam
 * seamless without any pop-in at the screen edges.
 */
function eachLaneCopy(
  v: Vehicle,
  span: number,
  ox: number,
  cell: number,
  w: number,
  draw: (screenX: number) => void,
) {
  const vw = v.w * cell
  for (const laneX of [v.x, v.x - span]) {
    const sx = ox + laneX * cell
    if (sx + vw < -cell || sx > w + cell) continue
    draw(sx)
  }
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hue: number,
  dir: number,
  dark: boolean,
) {
  const body = fill(hue, 58, dark ? 60 : 58, dark ? 0.32 : 0.26)
  const stroke = fill(hue, 58, dark ? 62 : 42, 0.95)
  const line = Math.max(1.8, h * 0.08)
  roundRect(ctx, x, y, w, h, h * 0.28)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = line
  ctx.stroke()

  const glassW = w * 0.34
  const glassX = dir > 0 ? x + w * 0.34 : x + w * 0.32
  roundRect(ctx, glassX, y + h * 0.18, glassW, h * 0.58, h * 0.18)
  ctx.fillStyle = dark ? 'rgba(180, 222, 255, 0.22)' : 'rgba(255, 255, 255, 0.48)'
  ctx.fill()
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dark: boolean,
) {
  const trunk = fill(TREE, 38, dark ? 38 : 34, 0.9)
  const leaf = fill(TREE, 48, dark ? 52 : 48, dark ? 0.34 : 0.28)
  const stroke = fill(TREE, 48, dark ? 58 : 36, 0.9)
  const tw = size * 0.22
  roundRect(ctx, cx - tw / 2, cy + size * 0.08, tw, size * 0.34, tw * 0.3)
  ctx.fillStyle = trunk
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy - size * 0.02, size * 0.34, 0, Math.PI * 2)
  ctx.fillStyle = leaf
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1.5, size * 0.05)
  ctx.stroke()
}

function drawHopper(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  pulse: number,
  dark: boolean,
  dying = false,
  deathT = 0,
  /** Forward-hop squeeze: 0 = round, 1 = max skinny. */
  squeeze = 0,
  cause: GameState['cause'] = null,
) {
  let drawX = cx
  let drawY = cy
  let deathScale = 1
  let squashX = 1
  let squashY = 1

  if (dying) {
    if (cause === 'hawk') {
      drawY -= deathT * size * 3.2
      deathScale = 1 - deathT * 0.25
      squashX = 1 - deathT * 0.15
      squashY = 1 + deathT * 0.35
    } else if (cause === 'water' || cause === 'edge') {
      drawY += deathT * size * 0.85
      deathScale = 1 - deathT * 0.55
      squashX = 1 + deathT * 0.35
      squashY = 1 - deathT * 0.55
    } else {
      // Car / train — flatten hard.
      deathScale = 1 - deathT * 0.2
      squashX = 1 + deathT * 1.1
      squashY = Math.max(0.12, 1 - deathT * 0.92)
      drawY += deathT * size * 0.2
    }
  }

  const scale = (1 + pulse * 0.06) * deathScale
  // Land thud: briefly fat and short when hopPulse is high and we're not mid-squeeze.
  const land = !dying && pulse > 0.08 ? Math.min(1, pulse / 0.32) : 0
  const r = size * 0.3 * scale
  const rx = r * (1 - squeeze * 0.32) * squashX * (1 + land * 0.22)
  const ry = r * (1 + squeeze * 0.18) * squashY * (1 - land * 0.28)
  const bodyHue = dying ? 4 : HOPPER
  const body = fill(bodyHue, dying ? 72 : 62, dark ? 58 : 54, dying ? 1 - deathT * 0.35 : 1)
  const stroke = fill(bodyHue, dying ? 72 : 62, dark ? 48 : 36, dying ? 1 - deathT * 0.35 : 1)

  ctx.beginPath()
  ctx.ellipse(drawX, drawY, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(2, size * 0.06)
  ctx.stroke()

  if (dying) {
    if (cause === 'car' || cause === 'train') {
      ctx.strokeStyle = `rgba(180, 20, 20, ${0.9 - deathT * 0.4})`
      ctx.lineWidth = Math.max(2.5, size * 0.07)
      ctx.beginPath()
      ctx.moveTo(drawX - rx * 0.7, drawY - ry * 0.2)
      ctx.lineTo(drawX + rx * 0.7, drawY + ry * 0.15)
      ctx.moveTo(drawX + rx * 0.7, drawY - ry * 0.2)
      ctx.lineTo(drawX - rx * 0.7, drawY + ry * 0.15)
      ctx.stroke()
    }
    return
  }

  ctx.fillStyle = '#1a2b3c'
  ctx.beginPath()
  ctx.arc(drawX - rx * 0.28, drawY - ry * 0.1, r * 0.14, 0, Math.PI * 2)
  ctx.arc(drawX + rx * 0.28, drawY - ry * 0.1, r * 0.14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(drawX - rx * 0.24, drawY - ry * 0.14, r * 0.05, 0, Math.PI * 2)
  ctx.arc(drawX + rx * 0.32, drawY - ry * 0.14, r * 0.05, 0, Math.PI * 2)
  ctx.fill()
}

function drawCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dark: boolean,
  bob = 0,
) {
  const r = size * 0.22
  const y = cy - bob
  ctx.beginPath()
  ctx.arc(cx, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill(48, 92, dark ? 58 : 54, 1)
  ctx.fill()
  ctx.strokeStyle = fill(42, 90, dark ? 42 : 38, 1)
  ctx.lineWidth = Math.max(1.6, size * 0.05)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx - r * 0.25, y - r * 0.28, r * 0.28, 0, Math.PI * 2)
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.55)'
  ctx.fill()
}

/** Brief shadow, then a fast Crossy-style snatch. */
function drawHawkThreat(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cell: number,
  w: number,
  oy: number,
  idleTimer: number,
  time: number,
) {
  const warnStart = STALL_LIMIT - STALL_WARN
  if (idleTimer <= warnStart) return

  const urgency = Math.min(1, (idleTimer - warnStart) / STALL_WARN)
  // Ease in hard so most of the dive happens in the last blink.
  const dive = Math.pow(urgency, 0.55)

  const shadowW = cell * (0.35 + dive * 0.7)
  const shadowH = cell * (0.12 + dive * 0.14)
  ctx.fillStyle = `rgba(20, 12, 28, ${0.2 + dive * 0.5})`
  ctx.beginPath()
  ctx.ellipse(px, py + cell * 0.34, shadowW, shadowH, 0, 0, Math.PI * 2)
  ctx.fill()

  const startX = px + cell * 3.2
  const startY = oy - cell * 1.8
  const hx = startX + (px - startX) * dive
  const hy = startY + (py - cell * 0.4 - startY) * dive
  const wing = cell * (0.85 + dive * 0.35)
  const flap = Math.sin(time * 40) * cell * 0.1 * (1 - dive * 0.5)
  const tilt = -0.55 + dive * 0.85

  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(tilt)
  ctx.scale(1 + dive * 0.25, 1 + dive * 0.25)

  ctx.fillStyle = `rgba(28, 22, 36, ${0.85 + dive * 0.15})`
  ctx.beginPath()
  ctx.ellipse(0, 0, cell * 0.24, cell * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cell * 0.2, -cell * 0.08, cell * 0.11, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255, 120, 48, ${0.9})`
  ctx.beginPath()
  ctx.moveTo(cell * 0.28, -cell * 0.08)
  ctx.lineTo(cell * 0.48, -cell * 0.02)
  ctx.lineTo(cell * 0.28, cell * 0.04)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = `rgba(42, 34, 52, ${0.9})`
  ctx.beginPath()
  ctx.moveTo(-cell * 0.05, -cell * 0.02 + flap)
  ctx.quadraticCurveTo(-wing * 0.55, -cell * 0.5 + flap, -wing, -cell * 0.04 + flap)
  ctx.quadraticCurveTo(-wing * 0.45, cell * 0.1 + flap, -cell * 0.05, cell * 0.08 + flap)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cell * 0.05, -cell * 0.02 - flap)
  ctx.quadraticCurveTo(wing * 0.55, -cell * 0.5 - flap, wing, -cell * 0.04 - flap)
  ctx.quadraticCurveTo(wing * 0.45, cell * 0.1 - flap, cell * 0.05, cell * 0.08 - flap)
  ctx.closePath()
  ctx.fill()

  if (dive > 0.4) {
    const reach = (dive - 0.4) / 0.6
    ctx.strokeStyle = `rgba(255, 210, 72, ${0.55 + reach * 0.45})`
    ctx.lineWidth = Math.max(2, cell * 0.055)
    ctx.lineCap = 'round'
    for (const ox of [-cell * 0.1, 0, cell * 0.1]) {
      ctx.beginPath()
      ctx.moveTo(ox, cell * 0.1)
      ctx.lineTo(ox - cell * 0.08 * reach, cell * (0.3 + reach * 0.28))
      ctx.moveTo(ox, cell * 0.1)
      ctx.lineTo(ox + cell * 0.08 * reach, cell * (0.3 + reach * 0.28))
      ctx.stroke()
    }
  }

  ctx.restore()

  if (dive > 0.25) {
    const heat = (dive - 0.25) / 0.75
    const grad = ctx.createRadialGradient(px, py, cell * 0.15, px, py, cell * 3.5)
    grad.addColorStop(0, `rgba(255, 60, 60, ${heat * 0.28})`)
    grad.addColorStop(1, 'rgba(255, 60, 60, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, oy + cell * 20)
  }
}

function drawCrossingLights(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  flash: boolean,
  dark: boolean,
) {
  const postW = cell * 0.14
  const postH = cell * 0.62
  const postY = y + cell * 0.2
  ctx.fillStyle = fill(45, 10, dark ? 42 : 32, 1)
  roundRect(ctx, x - postW / 2, postY, postW, postH, postW * 0.2)
  ctx.fill()

  const lampR = cell * 0.09
  const lampY = postY + cell * 0.14
  const on = flash
  ctx.beginPath()
  ctx.arc(x, lampY, lampR, 0, Math.PI * 2)
  ctx.fillStyle = on ? 'rgba(255, 220, 60, 1)' : 'rgba(80, 60, 20, 0.7)'
  ctx.fill()
  ctx.strokeStyle = on ? 'rgba(255, 180, 0, 0.9)' : 'rgba(60, 50, 30, 0.6)'
  ctx.lineWidth = Math.max(1.5, cell * 0.03)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, lampY + lampR * 2.1, lampR * 0.85, 0, Math.PI * 2)
  ctx.fillStyle = on ? 'rgba(255, 50, 40, 1)' : 'rgba(60, 20, 20, 0.7)'
  ctx.fill()
  ctx.strokeStyle = on ? 'rgba(220, 30, 20, 0.95)' : 'rgba(50, 20, 20, 0.6)'
  ctx.stroke()

  if (on) {
    ctx.fillStyle = 'rgba(255, 200, 80, 0.18)'
    ctx.beginPath()
    ctx.arc(x, lampY, lampR * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawTrain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
) {
  const body = fill(350, 52, dark ? 52 : 48, 1)
  const stroke = fill(350, 52, dark ? 58 : 40, 1)
  roundRect(ctx, x, y, w, h, h * 0.18)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(2, h * 0.07)
  ctx.stroke()
  const carW = w / 4
  for (let i = 0; i < 4; i++) {
    roundRect(ctx, x + i * carW + carW * 0.12, y + h * 0.16, carW * 0.76, h * 0.68, h * 0.12)
    ctx.fillStyle = dark ? 'rgba(255, 220, 220, 0.18)' : 'rgba(255, 255, 255, 0.35)'
    ctx.fill()
  }
}

function drawLog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
) {
  const body = fill(32, 42, dark ? 40 : 36, dark ? 0.42 : 0.34)
  const stroke = fill(32, 42, dark ? 48 : 30, 0.9)
  roundRect(ctx, x, y, w, h, h * 0.22)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1.8, h * 0.07)
  ctx.stroke()
  ctx.strokeStyle = fill(32, 30, dark ? 52 : 28, 0.35)
  ctx.beginPath()
  ctx.moveTo(x + w * 0.2, y + h * 0.5)
  ctx.lineTo(x + w * 0.8, y + h * 0.5)
  ctx.stroke()
}

/** Static stepping stone — reads as solid ground, unlike the drifting logs. */
function drawRock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dark: boolean,
) {
  const body = fill(210, 10, dark ? 46 : 62, 1)
  const stroke = fill(210, 12, dark ? 30 : 38, 0.95)
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.42, cy + size * 0.24)
  ctx.lineTo(cx - size * 0.3, cy - size * 0.16)
  ctx.lineTo(cx - size * 0.06, cy - size * 0.3)
  ctx.lineTo(cx + size * 0.24, cy - size * 0.22)
  ctx.lineTo(cx + size * 0.42, cy + size * 0.1)
  ctx.lineTo(cx + size * 0.28, cy + size * 0.28)
  ctx.closePath()
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1.6, size * 0.06)
  ctx.stroke()

  // Top highlight sells it as a raised surface you can land on.
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.22, cy - size * 0.12)
  ctx.lineTo(cx - size * 0.04, cy - size * 0.22)
  ctx.lineTo(cx + size * 0.16, cy - size * 0.14)
  ctx.lineTo(cx - size * 0.02, cy - size * 0.02)
  ctx.closePath()
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.42)'
  ctx.fill()
}

function drawLaneBand(
  ctx: CanvasRenderingContext2D,
  y: number,
  w: number,
  cell: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(0, y, w, cell + 0.5)
}

function playerPos(state: GameState) {
  if (!state.hop) return { c: state.col, r: state.row }
  const t = easeHop(state.hop.t)
  return {
    c: state.hop.fromC + (state.hop.toC - state.hop.fromC) * t,
    r: state.hop.fromR + (state.hop.toR - state.hop.fromR) * t,
  }
}

function rowScreenY(
  worldRow: number,
  cameraY: number,
  visibleRows: number,
  oy: number,
  cell: number,
) {
  return oy + (visibleRows - 1 - (worldRow - cameraY)) * cell
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  worldRow: number,
  y: number,
  w: number,
  ox: number,
  gridW: number,
  cell: number,
  dark: boolean,
) {
  const row = getRow(state, worldRow)
  const span = laneSpan(state.cols)
  const grassHue = worldRow % 2 === 0 ? GRASS_A : GRASS_B

  if (row.kind === 'grass') {
    drawLaneBand(ctx, y, w, cell, fill(grassHue, 42, dark ? 48 : 72, dark ? 0.28 : 0.22))
    ctx.strokeStyle = fill(grassHue, 30, dark ? 58 : 58, 0.12)
    ctx.lineWidth = 1
    ctx.strokeRect(ox + 0.5, y + 0.5, gridW - 1, cell - 1)
  } else if (row.kind === 'water') {
    drawLaneBand(ctx, y, w, cell, fill(205, 58, dark ? 46 : 62, dark ? 0.42 : 0.28))
    ctx.strokeStyle = fill(205, 50, dark ? 58 : 48, 0.2)
    ctx.lineWidth = 1
    for (let wave = cell * 0.2; wave < w; wave += cell * 0.55) {
      ctx.beginPath()
      ctx.arc(wave, y + cell * 0.55, cell * 0.08, 0, Math.PI * 2)
      ctx.stroke()
    }
    const vy = y + cell * 0.28
    const vh = cell * 0.44
    for (const log of row.vehicles) {
      eachLaneCopy(log, span, ox, cell, w, (sx) => {
        drawLog(ctx, sx, vy, log.w * cell, vh, dark)
      })
    }
    for (const rockCol of row.rocks) {
      drawRock(ctx, ox + (rockCol + 0.5) * cell, y + cell * 0.52, cell * 0.86, dark)
    }
  } else if (row.kind === 'rail') {
    const cycle = getRailCycle(row)
    const warnGlow = cycle.phase === 'warn' && cycle.flash
    drawLaneBand(
      ctx,
      y,
      w,
      cell,
      fill(45, 12, dark ? 36 : 70, warnGlow ? (dark ? 0.42 : 0.28) : dark ? 0.35 : 0.22),
    )
    ctx.fillStyle = fill(38, 20, dark ? 52 : 38, 0.55)
    const railY = y + cell * 0.34
    ctx.fillRect(0, railY, w, cell * 0.08)
    ctx.fillRect(0, railY + cell * 0.26, w, cell * 0.08)

    if (cycle.phase === 'warn') {
      drawCrossingLights(ctx, ox + cell * 0.35, y, cell, cycle.flash, dark)
      drawCrossingLights(ctx, ox + gridW - cell * 0.35, y, cell, cycle.flash, dark)
    }

    for (const v of row.vehicles) {
      const vx = ox + v.x * cell
      const vw = v.w * cell
      const vy = y + cell * 0.18
      const vh = cell * 0.64
      if (vx + vw < -cell || vx > w + cell) continue
      if (cycle.phase === 'pass') {
        const streak = row.dir * cell * 0.55
        ctx.globalAlpha = 0.35
        drawTrain(ctx, vx - streak, vy, vw, vh, dark)
        ctx.globalAlpha = 0.6
        drawTrain(ctx, vx - streak * 0.5, vy, vw, vh, dark)
        ctx.globalAlpha = 1
      }
      drawTrain(ctx, vx, vy, vw, vh, dark)
    }
  } else {
    drawLaneBand(ctx, y, w, cell, fill(220, 14, dark ? 34 : 78, dark ? 0.35 : 0.2))
    ctx.strokeStyle = fill(45, 70, 62, 0.22)
    ctx.setLineDash([cell * 0.12, cell * 0.18])
    ctx.lineWidth = 2
    const midY = y + cell * 0.5
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(w, midY)
    ctx.stroke()
    ctx.setLineDash([])

    const vy = y + cell * 0.22
    const vh = cell * 0.56
    for (const v of row.vehicles) {
      eachLaneCopy(v, span, ox, cell, w, (sx) => {
        drawVehicle(ctx, sx, vy, v.w * cell, vh, v.hue, row.dir, dark)
      })
    }
  }

  for (const treeCol of row.trees) {
    drawTree(ctx, ox + (treeCol + 0.5) * cell, y + cell * 0.52, cell * 0.88, dark)
  }

  const bob = Math.sin(performance.now() / 220 + worldRow) * cell * 0.04
  for (const coinCol of row.coins) {
    drawCoin(ctx, ox + (coinCol + 0.5) * cell, y + cell * 0.52, cell, dark, bob)
  }
}

/** Faint distance ticks so progress feels measurable mid-run. */
function drawMilestone(
  ctx: CanvasRenderingContext2D,
  y: number,
  w: number,
  cell: number,
  label: number,
  dark: boolean,
) {
  ctx.save()
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(30, 40, 60, 0.14)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([cell * 0.16, cell * 0.16])
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(w, y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.font = `700 ${Math.max(9, Math.round(cell * 0.24))}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.34)' : 'rgba(30, 40, 60, 0.32)'
  ctx.fillText(String(label), cell * 0.18, y - cell * 0.06)
  ctx.restore()
}

/** The record line — the whole point of the next run. */
function drawBestLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  w: number,
  cell: number,
  best: number,
  passed: boolean,
) {
  ctx.save()
  const alpha = passed ? 0.35 : 0.95
  ctx.strokeStyle = `rgba(245, 185, 66, ${alpha})`
  ctx.lineWidth = Math.max(2, cell * 0.05)
  ctx.setLineDash([cell * 0.3, cell * 0.2])
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(w, y)
  ctx.stroke()
  ctx.setLineDash([])

  const text = passed ? `BEAT ${best}` : `BEST ${best}`
  ctx.font = `800 ${Math.max(10, Math.round(cell * 0.26))}px system-ui, sans-serif`
  const padX = cell * 0.22
  const tw = ctx.measureText(text).width + padX * 2
  const th = Math.max(16, cell * 0.42)
  const bx = w - tw - cell * 0.18
  const by = y - th - cell * 0.08
  roundRect(ctx, bx, by, tw, th, th * 0.35)
  ctx.fillStyle = `rgba(245, 185, 66, ${passed ? 0.28 : 0.92})`
  ctx.fill()
  ctx.fillStyle = passed ? 'rgba(255, 255, 255, 0.85)' : '#2a1c00'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + tw / 2, by + th / 2 + 0.5)
  ctx.restore()
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const dark = isDarkTheme()
  const layout = computeLayout(w, h, state.cols)
  const { cell, visibleRows, ox, oy, gridW } = layout
  const cameraY = state.cameraY
  const pos = playerPos(state)
  const shake =
    state.shake > 0
      ? {
          x: (Math.random() - 0.5) * cell * 0.22 * state.shake,
          y: (Math.random() - 0.5) * cell * 0.18 * state.shake,
        }
      : { x: 0, y: 0 }

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(shake.x, shake.y)
  const dying = state.phase === 'dying'
  // Soft camera settle after a land — tiny downward nudge that eases out with hopPulse.
  if (!dying && state.hopPulse > 0) {
    ctx.translate(0, state.hopPulse * cell * 0.35)
  }

  const topRow = Math.ceil(cameraY + visibleRows + 2)
  const bottomRow = Math.floor(cameraY) - 4
  for (let worldRow = topRow; worldRow >= bottomRow; worldRow--) {
    const y = rowScreenY(worldRow, cameraY, visibleRows, oy, cell)
    if (y > h + cell || y + cell < 0) continue
    drawRow(ctx, state, worldRow, y, w, ox, gridW, cell, dark)
  }

  for (let worldRow = bottomRow; worldRow <= topRow; worldRow++) {
    if (worldRow <= 0 || worldRow % MILESTONE_STEP !== 0) continue
    if (state.target > 0 && worldRow === state.target) continue
    const y = rowScreenY(worldRow, cameraY, visibleRows, oy, cell)
    if (y < -cell || y > h + cell) continue
    drawMilestone(ctx, y, w, cell, worldRow, dark)
  }

  if (state.target > 0 && state.phase !== 'menu') {
    const y = rowScreenY(state.target, cameraY, visibleRows, oy, cell)
    if (y > -cell * 2 && y < h + cell) {
      drawBestLine(ctx, y, w, cell, state.target, state.beatBest)
    }
  }

  const px = ox + (pos.c + 0.5) * cell
  const py = rowScreenY(pos.r, cameraY, visibleRows, oy, cell) + cell * 0.52
  const deathT = dying ? 1 - state.deathAnim / 0.95 : 0
  const hop = state.hop
  const hopT = hop ? easeHop(Math.min(1, hop.t)) : 0
  const air = hop ? Math.sin(hopT * Math.PI) : 0
  const squeeze =
    hop && hop.toR > hop.fromR ? Math.sin(Math.min(1, hop.t) * Math.PI) : 0

  // Ground shadow shrinks while airborne so the hop reads as a real lift.
  if (!dying && py > -cell && py < h + cell) {
    const shadowScale = 1 - air * 0.45
    ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(30, 40, 60, 0.16)'
    ctx.beginPath()
    ctx.ellipse(
      px,
      py + cell * 0.28,
      cell * 0.22 * shadowScale,
      cell * 0.08 * shadowScale,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  if (py > -cell * 4 && py < h + cell) {
    drawHopper(
      ctx,
      px,
      py - air * cell * 0.28,
      cell,
      state.hopPulse,
      dark,
      dying,
      deathT,
      squeeze,
      state.cause,
    )
  }

  for (const pop of state.coinPops) {
    const t = Math.max(0, pop.t / 0.42)
    const cx = ox + (pop.c + 0.5) * cell
    const cy = rowScreenY(pop.r, cameraY, visibleRows, oy, cell) + cell * 0.2 - (1 - t) * cell * 0.8
    ctx.save()
    ctx.globalAlpha = t
    ctx.font = `800 ${Math.max(12, Math.round(cell * 0.32))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = fill(48, 90, dark ? 62 : 48, 1)
    ctx.fillText('+1', cx, cy)
    ctx.restore()
  }

  for (const bit of state.deathBits) {
    const a = Math.max(0, bit.life / bit.max)
    const bx = ox + bit.x * cell
    const by = rowScreenY(bit.y, cameraY, visibleRows, oy, cell) + cell * 0.5
    ctx.beginPath()
    ctx.arc(bx, by, bit.size * cell, 0, Math.PI * 2)
    ctx.fillStyle = fill(bit.hue, 70, dark ? 58 : 52, a)
    ctx.fill()
  }

  if (state.nearMiss > 0) {
    const heat = state.nearMiss / 0.28
    ctx.strokeStyle = `rgba(255, 255, 255, ${heat * 0.35})`
    ctx.lineWidth = Math.max(2, cell * 0.06)
    ctx.beginPath()
    ctx.arc(px, py, cell * (0.5 + (1 - heat) * 0.5), 0, Math.PI * 2)
    ctx.stroke()
  }

  if (state.celebrate > 0) {
    const t = state.celebrate / 1.35
    ctx.fillStyle = `rgba(245, 185, 66, ${t * 0.16})`
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.font = `900 ${Math.max(18, Math.round(cell * 0.52))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const ty = oy + visibleRows * cell * 0.32 - (1 - t) * cell * 0.8
    ctx.fillStyle = `rgba(245, 185, 66, ${Math.min(1, t * 1.6)})`
    ctx.fillText('NEW BEST', w / 2, ty)
    ctx.restore()
  }

  if (dying && state.cause) {
    const labels: Record<NonNullable<GameState['cause']>, string> = {
      car: 'SPLAT!',
      train: 'SMOOSHED!',
      water: 'SPLASH!',
      edge: 'YEETED!',
      hawk: 'SNATCHED!',
    }
    const t = Math.min(1, deathT * 1.4)
    ctx.save()
    ctx.font = `900 ${Math.max(22, Math.round(cell * 0.58))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * Math.min(1, 2 - deathT * 1.2)})`
    ctx.fillText(labels[state.cause], w / 2, oy + visibleRows * cell * 0.28 - t * cell * 0.4)
    if (state.runCoins > 0) {
      ctx.font = `800 ${Math.max(14, Math.round(cell * 0.32))}px system-ui, sans-serif`
      ctx.fillStyle = `rgba(245, 185, 66, ${0.95 * Math.min(1, 2 - deathT * 1.2)})`
      ctx.fillText(`+${state.runCoins} coins`, w / 2, oy + visibleRows * cell * 0.28 + cell * 0.45)
    }
    ctx.restore()
  }

  ctx.restore()

  if (state.deathFlash > 0) {
    const heat = state.deathFlash / 0.7
    ctx.fillStyle = `rgba(255, 60, 60, ${heat * 0.42})`
    ctx.fillRect(0, 0, w, h)
  }

  if (state.phase === 'playing' && state.row < Math.floor(cameraY) + BACK_LIMIT) {
    const dangerY = rowScreenY(Math.floor(cameraY) + BACK_LIMIT, cameraY, visibleRows, oy, cell)
    const bottomY = oy + visibleRows * cell
    const grad = ctx.createLinearGradient(0, dangerY, 0, bottomY)
    grad.addColorStop(0, 'rgba(232, 93, 117, 0)')
    grad.addColorStop(1, 'rgba(232, 93, 117, 0.22)')
    ctx.fillStyle = grad
    ctx.fillRect(0, dangerY, w, bottomY - dangerY)
  }

  if (state.phase === 'playing' && state.idleTimer > STALL_LIMIT - STALL_WARN) {
    drawHawkThreat(ctx, px, py, cell, w, oy, state.idleTimer, performance.now() / 1000)
  }
}
