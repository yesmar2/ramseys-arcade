import type { GameState } from './game'
import { BACK_LIMIT, COLS, VISIBLE_ROWS, getRow } from './game'
import { isDarkTheme, playfieldColor } from '../../lib/theme'

const GRASS_A = 142
const GRASS_B = 152
const TREE = 158
const HOPPER = 42

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
  const w = size * 0.22
  roundRect(ctx, cx - w / 2, cy + size * 0.08, w, size * 0.34, w * 0.3)
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

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const dark = isDarkTheme()
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  // Keep the board below the floating HUD (back, pause, score).
  const hudTop = Math.max(52, Math.min(76, h * 0.11))
  const padBottom = Math.max(8, h * 0.015)
  const availH = h - hudTop - padBottom
  const cell = Math.min(w / COLS, availH / VISIBLE_ROWS)
  const gridW = cell * COLS
  const gridH = cell * VISIBLE_ROWS
  const ox = (w - gridW) / 2
  const oy = hudTop + (availH - gridH) / 2

  const pos = state.hop
    ? {
        c:
          state.hop.fromC +
          (state.hop.toC - state.hop.fromC) *
            (state.hop.t < 0.5
              ? 2 * state.hop.t * state.hop.t
              : 1 - Math.pow(-2 * state.hop.t + 2, 2) / 2),
        r:
          state.hop.fromR +
          (state.hop.toR - state.hop.fromR) *
            (state.hop.t < 0.5
              ? 2 * state.hop.t * state.hop.t
              : 1 - Math.pow(-2 * state.hop.t + 2, 2) / 2),
      }
    : { c: state.col, r: state.row }

  for (let screenRow = 0; screenRow < VISIBLE_ROWS; screenRow++) {
    const worldRow = state.cameraRow + (VISIBLE_ROWS - 1 - screenRow)
    const y = oy + screenRow * cell
    const row = getRow(state, worldRow)
    const grassHue = worldRow % 2 === 0 ? GRASS_A : GRASS_B

    if (row.kind === 'grass') {
      ctx.fillStyle = fill(grassHue, 42, dark ? 48 : 72, dark ? 0.28 : 0.22)
      ctx.fillRect(ox, y, w, cell)
      ctx.strokeStyle = fill(grassHue, 30, dark ? 58 : 58, 0.12)
      ctx.lineWidth = 1
      ctx.strokeRect(ox + 0.5, y + 0.5, w - 1, cell - 1)
    } else {
      ctx.fillStyle = fill(220, 14, dark ? 34 : 78, dark ? 0.35 : 0.2)
      ctx.fillRect(ox, y, w, cell)
      ctx.strokeStyle = fill(45, 70, 62, 0.22)
      ctx.setLineDash([cell * 0.12, cell * 0.18])
      ctx.lineWidth = 2
      const midY = y + cell * 0.5
      ctx.beginPath()
      ctx.moveTo(ox, midY)
      ctx.lineTo(ox + w, midY)
      ctx.stroke()
      ctx.setLineDash([])

      for (const v of row.vehicles) {
        const vx = ox + v.x * cell
        const vw = v.w * cell
        const vy = y + cell * 0.22
        const vh = cell * 0.56
        drawVehicle(ctx, vx, vy, vw, vh, v.hue, row.dir, dark)
        if (vx + vw > ox + w) {
          drawVehicle(ctx, vx - wrapSpan(state.cols) * cell, vy, vw, vh, v.hue, row.dir, dark)
        }
        if (vx < ox) {
          drawVehicle(ctx, vx + wrapSpan(state.cols) * cell, vy, vw, vh, v.hue, row.dir, dark)
        }
      }
    }

    for (const treeCol of row.trees) {
      drawTree(ctx, ox + (treeCol + 0.5) * cell, y + cell * 0.52, cell * 0.88, dark)
    }
  }

  const playerScreenRow = VISIBLE_ROWS - 1 - (pos.r - state.cameraRow)
  const px = ox + (pos.c + 0.5) * cell
  const py = oy + (playerScreenRow + 0.52) * cell
  if (playerScreenRow >= 0 && playerScreenRow < VISIBLE_ROWS) {
    drawHopper(ctx, px, py, cell, state.hopPulse, dark)
  }

  if (state.deathFlash > 0) {
    ctx.fillStyle = `rgba(255, 80, 80, ${state.deathFlash * 0.35})`
    ctx.fillRect(0, 0, w, h)
  }

  if (state.phase === 'playing' && state.row < state.cameraRow + BACK_LIMIT) {
    const dangerY = oy + (VISIBLE_ROWS - 1 - BACK_LIMIT) * cell
    const grad = ctx.createLinearGradient(0, dangerY, 0, oy + gridH)
    grad.addColorStop(0, 'rgba(232, 93, 117, 0)')
    grad.addColorStop(1, 'rgba(232, 93, 117, 0.22)')
    ctx.fillStyle = grad
    ctx.fillRect(0, dangerY, w, oy + gridH - dangerY)
  }
}

function wrapSpan(cols: number) {
  return cols + 5
}
