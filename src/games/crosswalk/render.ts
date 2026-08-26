import type { GameState, Lane, Rider, Vehicle } from './game'
import { HOME_ROW, turtleSink } from './game'
import { isDarkTheme, playfieldColor } from '../../lib/theme'

const GRASS = 148
const WATER = 198
const HEDGE = 158
const LOG = 28
const TURTLE = 128
const FROG = 158

/** Site look: airy pastel fill, confident stroke. */
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

function paintRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  body: string,
  stroke: string,
  lineWidth: number,
) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  x: number,
  y: number,
  w: number,
  h: number,
  dir: number,
  dark: boolean,
) {
  const sat = 58
  const body = fill(v.hue, sat, dark ? 60 : 58, dark ? 0.3 : 0.24)
  const stroke = fill(v.hue, sat, dark ? 62 : 42, 0.95)
  const line = Math.max(1.3, h * 0.09)
  paintRound(ctx, x, y, w, h, Math.min(h * 0.36, 9), body, stroke, line)

  if (v.kind === 'truck') {
    const cabW = w * 0.3
    const cabX = dir > 0 ? x + w - cabW - h * 0.12 : x + h * 0.12
    paintRound(
      ctx,
      cabX,
      y + h * 0.16,
      cabW,
      h * 0.68,
      h * 0.22,
      fill(v.hue, sat, dark ? 66 : 66, 0.26),
      stroke,
      line * 0.8,
    )
    ctx.strokeStyle = fill(v.hue, sat, dark ? 62 : 42, 0.5)
    ctx.lineWidth = line * 0.7
    const seamX = dir > 0 ? cabX - h * 0.14 : cabX + cabW + h * 0.14
    ctx.beginPath()
    ctx.moveTo(seamX, y + h * 0.18)
    ctx.lineTo(seamX, y + h * 0.82)
    ctx.stroke()
    return
  }

  const glassW = w * 0.34
  const glassX = dir > 0 ? x + w * 0.36 : x + w * 0.3
  paintRound(
    ctx,
    glassX,
    y + h * 0.2,
    glassW,
    h * 0.6,
    h * 0.2,
    dark ? 'rgba(180, 222, 255, 0.22)' : 'rgba(255, 255, 255, 0.5)',
    fill(v.hue, sat, dark ? 62 : 42, 0.55),
    line * 0.7,
  )

  ctx.fillStyle = 'hsla(45, 92%, 66%, 0.9)'
  const lampW = Math.max(2.4, w * 0.06)
  const lampX = dir > 0 ? x + w - lampW - line : x + line
  roundRect(ctx, lampX, y + h * 0.24, lampW, h * 0.2, 1.6)
  ctx.fill()
  roundRect(ctx, lampX, y + h * 0.56, lampW, h * 0.2, 1.6)
  ctx.fill()
}

function drawLog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
) {
  const body = fill(LOG, 44, dark ? 52 : 54, dark ? 0.34 : 0.28)
  const stroke = fill(LOG, 44, dark ? 60 : 38, 0.95)
  const line = Math.max(1.4, h * 0.1)
  paintRound(ctx, x, y, w, h, h * 0.44, body, stroke, line)

  ctx.strokeStyle = fill(LOG, 40, dark ? 62 : 40, 0.4)
  ctx.lineWidth = line * 0.7
  for (let i = 1; i <= 2; i++) {
    const gy = y + (h * i) / 3
    ctx.beginPath()
    ctx.moveTo(x + h * 0.5, gy)
    ctx.lineTo(x + w - h * 0.5, gy)
    ctx.stroke()
  }

  const capR = h * 0.26
  ctx.beginPath()
  ctx.ellipse(x + h * 0.42, y + h / 2, capR * 0.55, capR, 0, 0, Math.PI * 2)
  ctx.fillStyle = fill(LOG, 38, dark ? 60 : 62, 0.38)
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = line * 0.7
  ctx.stroke()
}

function drawTurtles(
  ctx: CanvasRenderingContext2D,
  rider: Rider,
  lane: Lane,
  ox: number,
  ly: number,
  cell: number,
  clock: number,
  dark: boolean,
) {
  const sink = turtleSink(lane, rider, clock)
  if (sink >= 1) return
  const alpha = 1 - sink * 0.85
  const scale = 1 - sink * 0.3

  for (let i = 0; i < rider.units; i++) {
    const cx = ox + (rider.x + i + 0.5) * cell
    const cy = ly + cell * 0.5
    const r = cell * 0.34 * scale

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = fill(TURTLE, 48, dark ? 56 : 52, dark ? 0.34 : 0.28)
    ctx.fill()
    ctx.strokeStyle = fill(TURTLE, 46, dark ? 62 : 34, 0.95)
    ctx.lineWidth = Math.max(1.3, cell * 0.06)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.48, 0, Math.PI * 2)
    ctx.strokeStyle = fill(TURTLE, 46, dark ? 62 : 34, 0.55)
    ctx.lineWidth = Math.max(1, cell * 0.04)
    ctx.stroke()

    const headX = cx + (lane.dir > 0 ? r * 1.05 : -r * 1.05)
    ctx.beginPath()
    ctx.arc(headX, cy, r * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = fill(TURTLE, 46, dark ? 60 : 46, 0.5)
    ctx.fill()
    ctx.strokeStyle = fill(TURTLE, 46, dark ? 62 : 34, 0.9)
    ctx.lineWidth = Math.max(1, cell * 0.04)
    ctx.stroke()
    ctx.restore()
  }
}

function drawFrog(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  pulse: number,
  facing: number,
  dark: boolean,
) {
  const squash = 1 - pulse * 0.2
  const stretch = 1 + pulse * 0.16
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(stretch, squash)

  const rx = size * 0.34
  const ry = size * 0.3
  const line = Math.max(1.4, size * 0.07)

  ctx.fillStyle = fill(FROG, 52, 40, 0.16)
  ctx.beginPath()
  ctx.ellipse(0, ry * 0.62, rx * 0.92, ry * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()

  // Back legs
  ctx.strokeStyle = fill(FROG, 54, dark ? 62 : 34, 0.95)
  ctx.lineWidth = line
  ctx.lineCap = 'round'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(sx * rx * 0.5, ry * 0.2)
    ctx.lineTo(sx * rx * 1.05, ry * 0.75)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = fill(FROG, 56, dark ? 58 : 54, dark ? 0.42 : 0.32)
  ctx.fill()
  ctx.strokeStyle = fill(FROG, 54, dark ? 64 : 32, 0.95)
  ctx.lineWidth = line
  ctx.stroke()

  const eyeY = -ry * 0.52 * facing
  for (const sx of [-1, 1]) {
    const ex = sx * rx * 0.42
    ctx.beginPath()
    ctx.arc(ex, eyeY, size * 0.1, 0, Math.PI * 2)
    ctx.fillStyle = dark ? 'rgba(232, 246, 240, 0.95)' : 'rgba(255, 255, 255, 0.95)'
    ctx.fill()
    ctx.strokeStyle = fill(FROG, 54, dark ? 64 : 32, 0.9)
    ctx.lineWidth = line * 0.7
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ex, eyeY, size * 0.045, 0, Math.PI * 2)
    ctx.fillStyle = dark ? '#0d1720' : '#1a2b3c'
    ctx.fill()
  }

  ctx.restore()
}

function drawFly(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const r = size * 0.18
  ctx.save()
  ctx.fillStyle = 'hsla(38, 82%, 62%, 0.45)'
  ctx.beginPath()
  ctx.ellipse(cx - r * 1.1, cy - r * 0.5, r * 0.85, r * 0.5, -0.5, 0, Math.PI * 2)
  ctx.ellipse(cx + r * 1.1, cy - r * 0.5, r * 0.85, r * 0.5, 0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(cx, cy, r * 0.8, r, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'hsla(38, 78%, 56%, 0.5)'
  ctx.fill()
  ctx.strokeStyle = 'hsla(38, 70%, 34%, 0.95)'
  ctx.lineWidth = Math.max(1.2, size * 0.05)
  ctx.stroke()
  ctx.restore()
}

function laneBand(
  ctx: CanvasRenderingContext2D,
  lane: Lane,
  ox: number,
  ly: number,
  gridW: number,
  cell: number,
  dark: boolean,
) {
  if (lane.kind === 'river') {
    ctx.fillStyle = fill(WATER, dark ? 55 : 62, dark ? 34 : 62, dark ? 0.4 : 0.3)
    ctx.fillRect(ox, ly, gridW, cell + 0.5)
    ctx.strokeStyle = fill(WATER, 60, dark ? 72 : 40, dark ? 0.22 : 0.2)
    ctx.lineWidth = Math.max(1, cell * 0.045)
    for (let i = 0; i < 3; i++) {
      const wy = ly + cell * (0.28 + i * 0.24)
      const offset = (i % 2) * cell * 0.55
      let wx = ox + offset
      while (wx < ox + gridW - cell * 0.3) {
        ctx.beginPath()
        ctx.moveTo(wx, wy)
        ctx.quadraticCurveTo(wx + cell * 0.16, wy - cell * 0.09, wx + cell * 0.32, wy)
        ctx.stroke()
        wx += cell * 1.1
      }
    }
    return
  }

  if (lane.kind === 'road') {
    ctx.fillStyle = dark ? 'hsla(212, 16%, 20%, 0.85)' : 'hsla(212, 12%, 46%, 0.2)'
    ctx.fillRect(ox, ly, gridW, cell + 0.5)
    ctx.fillStyle = dark ? 'rgba(233, 243, 250, 0.16)' : 'rgba(255, 255, 255, 0.55)'
    const dash = cell * 0.42
    const gap = cell * 0.36
    const lineH = Math.max(1.6, cell * 0.05)
    let dx = ox + cell * 0.18
    while (dx < ox + gridW - dash * 0.5) {
      ctx.fillRect(dx, ly - lineH / 2, Math.min(dash, ox + gridW - dx), lineH)
      dx += dash + gap
    }
    return
  }

  ctx.fillStyle = fill(GRASS, dark ? 32 : 46, dark ? 26 : 60, dark ? 0.42 : 0.26)
  ctx.fillRect(ox, ly, gridW, cell + 0.5)
}

function drawHomeRow(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  ly: number,
  gridW: number,
  cell: number,
  dark: boolean,
) {
  ctx.fillStyle = fill(HEDGE, dark ? 38 : 42, dark ? 22 : 40, dark ? 0.78 : 0.55)
  ctx.fillRect(ox, ly, gridW, cell + 0.5)

  // Scalloped hedge tops so the row reads as shrubbery, not a flat band.
  ctx.fillStyle = fill(HEDGE, dark ? 40 : 44, dark ? 28 : 48, dark ? 0.7 : 0.5)
  const bump = cell * 0.16
  for (let bx = ox; bx < ox + gridW; bx += bump * 2) {
    ctx.beginPath()
    ctx.arc(bx + bump, ly + bump * 0.6, bump, Math.PI, 0)
    ctx.fill()
  }

  for (const bay of state.bays) {
    const bx = ox + bay.col * cell
    const inset = cell * 0.08
    paintRound(
      ctx,
      bx + inset,
      ly + inset,
      cell - inset * 2,
      cell - inset * 2,
      cell * 0.28,
      bay.filled
        ? fill(FROG, 50, dark ? 44 : 62, dark ? 0.4 : 0.28)
        : fill(WATER, 58, dark ? 40 : 70, dark ? 0.4 : 0.32),
      bay.filled
        ? fill(FROG, 52, dark ? 64 : 34, 0.9)
        : fill(WATER, 55, dark ? 66 : 42, 0.6),
      Math.max(1.2, cell * 0.05),
    )

    const cx = bx + cell * 0.5
    const cy = ly + cell * 0.5
    if (bay.filled) drawFrog(ctx, cx, cy, cell * 0.78, 0, 1, dark)
    else if (bay.fly) drawFly(ctx, cx, cy, cell)
  }
}

function drawSplash(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
) {
  const splash = state.splash
  if (!splash) return
  const p = 1 - splash.t / 0.5
  const cx = ox + (splash.x + 0.5) * cell
  const cy = oy + (splash.y + 0.5) * cell
  const hue = splash.kind === 'water' ? WATER : 348
  ctx.save()
  ctx.globalAlpha = 1 - p
  ctx.strokeStyle = fill(hue, 62, 52, 0.9)
  ctx.lineWidth = Math.max(1.6, cell * 0.08)
  ctx.beginPath()
  ctx.arc(cx, cy, cell * (0.2 + p * 0.5), 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + p
    const d = cell * (0.25 + p * 0.55)
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cell * 0.07, 0, Math.PI * 2)
    ctx.fillStyle = fill(hue, 62, 56, 0.85)
    ctx.fill()
  }
  ctx.restore()
}

function drawTimer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  y: number,
  gridW: number,
  cell: number,
  dark: boolean,
) {
  const h = Math.max(6, cell * 0.2)
  const frac = state.timeLimit > 0 ? Math.max(0, state.timeLeft / state.timeLimit) : 0
  roundRect(ctx, ox, y, gridW, h, h / 2)
  ctx.fillStyle = dark ? 'rgba(233, 243, 250, 0.1)' : 'rgba(26, 43, 60, 0.09)'
  ctx.fill()

  if (frac <= 0) return
  const low = state.timeLeft <= 8
  const hue = low ? 8 : 172
  const pulse = low ? 0.75 + Math.abs(Math.sin(state.clock * 5)) * 0.25 : 1
  roundRect(ctx, ox, y, Math.max(h, gridW * frac), h, h / 2)
  ctx.fillStyle = fill(hue, 62, dark ? 56 : 48, 0.85 * pulse)
  ctx.fill()
}

function drawToast(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  gridW: number,
  cell: number,
  dark: boolean,
) {
  const toast = state.toast
  if (!toast) return
  const alpha = Math.min(1, toast.t * 2.5)
  const cx = ox + gridW / 2
  const cy = oy + cell * 1.6
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `700 ${Math.max(13, cell * 0.42)}px Outfit, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(toast.text).width + cell * 0.7
  paintRound(
    ctx,
    cx - w / 2,
    cy - cell * 0.34,
    w,
    cell * 0.68,
    cell * 0.34,
    dark ? 'rgba(12, 20, 28, 0.82)' : 'rgba(255, 255, 255, 0.86)',
    fill(FROG, 50, dark ? 60 : 38, 0.5),
    1.2,
  )
  ctx.fillStyle = dark ? '#e7f4ee' : '#1a2b3c'
  ctx.fillText(toast.text, cx, cy)
  ctx.restore()
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const dark = isDarkTheme()
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = dark ? 'rgba(74, 168, 232, 0.08)' : 'rgba(74, 168, 232, 0.1)'
  for (let py = 14; py < h; py += 28) {
    for (let px = 14; px < w; px += 28) {
      ctx.beginPath()
      ctx.arc(px, py, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const pad = Math.min(w, h) * 0.05
  // Headroom for the score and level readouts, which float above the board.
  const hudGap = Math.max(46, Math.min(66, h * 0.11))
  // One extra part-row of height keeps the timer strip inside the board panel.
  const timerRows = 0.75
  const availH = h - hudGap - pad * 2
  const cell = Math.min((w - pad * 2) / state.cols, availH / (state.rows + timerRows))
  const gridW = cell * state.cols
  const gridH = cell * state.rows
  const totalH = gridH + cell * timerRows
  const ox = (w - gridW) / 2
  const oy = hudGap + pad + Math.max(0, (availH - totalH) / 2)

  const panelPad = Math.max(8, cell * 0.34)
  const radius = Math.max(12, cell * 0.55)
  roundRect(
    ctx,
    ox - panelPad,
    oy - panelPad,
    gridW + panelPad * 2,
    totalH + panelPad * 2,
    radius,
  )
  ctx.fillStyle = dark ? 'rgba(8, 14, 20, 0.55)' : 'rgba(255, 255, 255, 0.55)'
  ctx.fill()
  ctx.strokeStyle = dark ? 'rgba(231, 238, 243, 0.08)' : 'rgba(26, 43, 60, 0.06)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.save()
  roundRect(ctx, ox, oy, gridW, gridH, Math.max(8, cell * 0.3))
  ctx.clip()

  for (let y = 0; y < state.rows; y++) {
    const lane = state.lanes[y]
    if (!lane) continue
    const ly = oy + y * cell
    if (y === HOME_ROW) drawHomeRow(ctx, state, ox, ly, gridW, cell, dark)
    else laneBand(ctx, lane, ox, ly, gridW, cell, dark)
  }

  for (let y = 0; y < state.rows; y++) {
    const lane = state.lanes[y]
    if (!lane || lane.kind !== 'river') continue
    const ly = oy + y * cell
    for (const rider of lane.riders) {
      if (rider.kind === 'log') {
        const logH = cell * 0.7
        drawLog(ctx, ox + rider.x * cell, ly + (cell - logH) / 2, rider.w * cell, logH, dark)
      } else {
        drawTurtles(ctx, rider, lane, ox, ly, cell, state.clock, dark)
      }
    }
  }

  for (let y = 0; y < state.rows; y++) {
    const lane = state.lanes[y]
    if (!lane || lane.kind !== 'road') continue
    const ly = oy + y * cell
    for (const v of lane.vehicles) {
      const vh = cell * (v.kind === 'truck' ? 0.7 : 0.62)
      drawVehicle(ctx, v, ox + v.x * cell, ly + (cell - vh) / 2, v.w * cell, vh, lane.dir, dark)
    }
  }

  drawSplash(ctx, state, ox, oy, cell)

  const blink = state.invuln > 0 && Math.floor(state.invuln * 12) % 2 === 0
  if (!blink && state.phase !== 'gameover') {
    const bumpShift = state.bump > 0 ? -cell * 0.12 * (state.bump / 0.18) : 0
    drawFrog(
      ctx,
      ox + (state.px + 0.5) * cell,
      oy + (state.py + 0.5) * cell + bumpShift,
      cell,
      Math.min(1, state.hopPulse / 0.16),
      1,
      dark,
    )
  }

  drawToast(ctx, state, ox, oy, gridW, cell, dark)
  ctx.restore()

  drawTimer(ctx, state, ox, oy + gridH + cell * 0.22, gridW, cell, dark)

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(232, 93, 117, ${state.flash * 0.26})`
    ctx.fillRect(0, 0, w, h)
  }
}
