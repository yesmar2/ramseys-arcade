import type { GameState } from './game'
import { BACK_LIMIT, TARGET_VISIBLE_ROWS, easeHop, getRow } from './game'
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
  const hudTop = Math.max(52, Math.min(76, h * 0.11))
  const padBottom = Math.max(14, h * 0.02)
  const availH = h - hudTop - padBottom
  const cell = Math.min(w / cols, availH / TARGET_VISIBLE_ROWS)
  const visibleRows = Math.max(10, Math.floor(availH / cell))
  const gridW = cell * cols
  const gridH = visibleRows * cell
  const ox = (w - gridW) / 2
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
) {
  const scale = 1 + pulse * 0.08
  const r = size * 0.38 * scale
  const body = fill(HOPPER, 62, dark ? 58 : 54, dark ? 0.34 : 0.28)
  const stroke = fill(HOPPER, 62, dark ? 62 : 40, 0.95)
  ctx.beginPath()
  ctx.ellipse(cx, cy + r * 0.12, r * 1.05, r * 0.92, 0, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(2, size * 0.06)
  ctx.stroke()

  ctx.fillStyle = '#1a2b3c'
  ctx.beginPath()
  ctx.arc(cx - r * 0.32, cy - r * 0.08, r * 0.12, 0, Math.PI * 2)
  ctx.arc(cx + r * 0.32, cy - r * 0.08, r * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx - r * 0.28, cy - r * 0.12, r * 0.04, 0, Math.PI * 2)
  ctx.arc(cx + r * 0.36, cy - r * 0.12, r * 0.04, 0, Math.PI * 2)
  ctx.fill()
}

function drawTrain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
) {
  const body = fill(350, 52, dark ? 52 : 48, dark ? 0.38 : 0.3)
  const stroke = fill(350, 52, dark ? 58 : 40, 0.95)
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

function drawSideGutter(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  cell: number,
  ox: number,
  gridW: number,
  dark: boolean,
) {
  const gutter = fill(142, 20, dark ? 42 : 74, dark ? 0.22 : 0.16)
  ctx.fillStyle = gutter
  if (ox > 0) ctx.fillRect(0, y, ox, cell + 0.5)
  if (ox + gridW < w) ctx.fillRect(ox + gridW, y, w - ox - gridW, cell + 0.5)
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
  const grassHue = worldRow % 2 === 0 ? GRASS_A : GRASS_B

  drawSideGutter(ctx, w, y, cell, ox, gridW, dark)

  if (row.kind === 'grass') {
    ctx.fillStyle = fill(grassHue, 42, dark ? 48 : 72, dark ? 0.28 : 0.22)
    ctx.fillRect(ox, y, gridW, cell + 0.5)
    ctx.strokeStyle = fill(grassHue, 30, dark ? 58 : 58, 0.12)
    ctx.lineWidth = 1
    ctx.strokeRect(ox + 0.5, y + 0.5, gridW - 1, cell - 1)
  } else if (row.kind === 'water') {
    ctx.fillStyle = fill(205, 58, dark ? 46 : 62, dark ? 0.42 : 0.28)
    ctx.fillRect(ox, y, gridW, cell + 0.5)
    ctx.strokeStyle = fill(205, 50, dark ? 58 : 48, 0.2)
    ctx.lineWidth = 1
    for (let wave = ox + cell * 0.2; wave < ox + gridW; wave += cell * 0.55) {
      ctx.beginPath()
      ctx.arc(wave, y + cell * 0.55, cell * 0.08, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (row.kind === 'rail') {
    ctx.fillStyle = fill(45, 12, dark ? 36 : 70, dark ? 0.35 : 0.22)
    ctx.fillRect(ox, y, gridW, cell + 0.5)
    ctx.fillStyle = fill(38, 20, dark ? 52 : 38, 0.55)
    const railY = y + cell * 0.34
    ctx.fillRect(ox, railY, gridW, cell * 0.08)
    ctx.fillRect(ox, railY + cell * 0.26, gridW, cell * 0.08)
    for (const v of row.vehicles) {
      const vx = ox + v.x * cell
      const vw = v.w * cell
      const vy = y + cell * 0.18
      const vh = cell * 0.64
      if (vx + vw < ox - cell || vx > ox + gridW + cell) continue
      drawTrain(ctx, vx, vy, vw, vh, dark)
    }
  } else {
    ctx.fillStyle = fill(220, 14, dark ? 34 : 78, dark ? 0.35 : 0.2)
    ctx.fillRect(ox, y, gridW, cell + 0.5)
    ctx.strokeStyle = fill(45, 70, 62, 0.22)
    ctx.setLineDash([cell * 0.12, cell * 0.18])
    ctx.lineWidth = 2
    const midY = y + cell * 0.5
    ctx.beginPath()
    ctx.moveTo(ox, midY)
    ctx.lineTo(ox + gridW, midY)
    ctx.stroke()
    ctx.setLineDash([])

    for (const v of row.vehicles) {
      const vx = ox + v.x * cell
      const vw = v.w * cell
      const vy = y + cell * 0.22
      const vh = cell * 0.56
      if (vx + vw < ox - cell || vx > ox + gridW + cell) continue
      drawVehicle(ctx, vx, vy, vw, vh, v.hue, row.dir, dark)
      const wrappedLeft = vx - wrapSpan(state.cols) * cell
      const wrappedRight = vx + wrapSpan(state.cols) * cell
      if (wrappedLeft + vw > ox && wrappedLeft < ox + gridW) {
        drawVehicle(ctx, wrappedLeft, vy, vw, vh, v.hue, row.dir, dark)
      }
      if (wrappedRight + vw > ox && wrappedRight < ox + gridW) {
        drawVehicle(ctx, wrappedRight, vy, vw, vh, v.hue, row.dir, dark)
      }
    }
  }

  for (const treeCol of row.trees) {
    drawTree(ctx, ox + (treeCol + 0.5) * cell, y + cell * 0.52, cell * 0.88, dark)
  }
}

function wrapSpan(cols: number) {
  return cols + 5
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

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  const topRow = Math.ceil(cameraY + visibleRows + 1)
  const bottomRow = Math.floor(cameraY) - 3
  for (let worldRow = topRow; worldRow >= bottomRow; worldRow--) {
    const y = rowScreenY(worldRow, cameraY, visibleRows, oy, cell)
    if (y > h + cell || y + cell < 0) continue
    drawRow(ctx, state, worldRow, y, w, ox, gridW, cell, dark)
  }

  const px = ox + (pos.c + 0.5) * cell
  const py = rowScreenY(pos.r, cameraY, visibleRows, oy, cell) + cell * 0.52
  if (py > -cell && py < h + cell) {
    drawHopper(ctx, px, py, cell, state.hopPulse, dark)
  }

  if (state.deathFlash > 0) {
    ctx.fillStyle = `rgba(255, 80, 80, ${state.deathFlash * 0.35})`
    ctx.fillRect(0, 0, w, h)
  }

  if (state.phase === 'playing' && state.row < Math.floor(cameraY) + BACK_LIMIT) {
    const dangerY = rowScreenY(Math.floor(cameraY) + BACK_LIMIT, cameraY, visibleRows, oy, cell)
    const bottomY = oy + visibleRows * cell
    const grad = ctx.createLinearGradient(0, dangerY, 0, bottomY)
    grad.addColorStop(0, 'rgba(232, 93, 117, 0)')
    grad.addColorStop(1, 'rgba(232, 93, 117, 0.22)')
    ctx.fillStyle = grad
    ctx.fillRect(ox, dangerY, gridW, bottomY - dangerY)
  }
}
