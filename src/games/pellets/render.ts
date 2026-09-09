import { isDarkTheme, playfieldColor } from '../../lib/theme'
import {
  COLS,
  ROWS,
  mazeChar,
  type GameState,
  type Ghost,
  type GhostKind,
} from './game'

const ACCENT = 38
const WALL_HUE = 198

function hsla(hue: number, sat: number, light: number, alpha = 1) {
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

export function computeLayout(w: number, h: number) {
  const pad = Math.min(w, h) * 0.05
  const hud = Math.max(48, Math.min(72, h * 0.1))
  const availW = w - pad * 2
  const availH = h - hud - pad * 0.6
  const cell = Math.max(1, Math.min(availW / COLS, availH / ROWS))
  const gridW = cell * COLS
  const gridH = cell * ROWS
  const ox = (w - gridW) / 2
  const oy = hud + Math.max(0, (availH - gridH) / 2)
  return { cell, ox, oy, hud, gridW, gridH }
}

function chaserHue(kind: GhostKind) {
  if (kind === 'blink') return 348
  if (kind === 'pink') return 272
  if (kind === 'inky') return 172
  return 18
}

function drawWalls(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  dark: boolean,
) {
  const lineW = Math.max(1.4, cell * 0.11)
  const inset = cell * 0.18
  const rad = cell * 0.28

  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (state.open[y][x]) continue
      const px = ox + x * cell + inset
      const py = oy + y * cell + inset
      const s = cell - inset * 2
      roundRect(ctx, px, py, s, s, rad)
      ctx.fillStyle = dark ? hsla(WALL_HUE, 42, 58, 0.16) : hsla(WALL_HUE, 48, 52, 0.14)
      ctx.fill()
      ctx.strokeStyle = dark ? hsla(WALL_HUE, 55, 62, 0.9) : hsla(WALL_HUE, 52, 42, 0.92)
      ctx.lineWidth = lineW
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  }

  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (mazeChar(x, y) !== '=') continue
      const px = ox + x * cell
      const py = oy + y * cell
      ctx.strokeStyle = dark ? hsla(ACCENT, 60, 62, 0.85) : hsla(ACCENT, 58, 48, 0.9)
      ctx.lineWidth = Math.max(2, cell * 0.12)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(px + cell * 0.18, py + cell * 0.5)
      ctx.lineTo(px + cell * 0.82, py + cell * 0.5)
      ctx.stroke()
    }
  }
}

function drawCrumbs(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  dark: boolean,
  time: number,
) {
  const pulse = 0.88 + Math.sin(time * 7) * 0.12
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const cx = ox + (x + 0.5) * cell
      const cy = oy + (y + 0.5) * cell
      if (state.pellets[y][x]) {
        const r = Math.max(1.4, cell * 0.11)
        ctx.fillStyle = dark ? hsla(ACCENT, 55, 62, 0.22) : hsla(ACCENT, 58, 58, 0.2)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = dark ? hsla(ACCENT, 58, 58, 0.95) : hsla(ACCENT, 58, 42, 0.95)
        ctx.lineWidth = Math.max(1.1, cell * 0.06)
        ctx.stroke()
      }
      if (state.power[y][x]) {
        const r = cell * 0.28 * pulse
        const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, r * 2.1)
        glow.addColorStop(0, hsla(ACCENT, 70, 58, 0.4))
        glow.addColorStop(1, hsla(ACCENT, 70, 58, 0))
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2)
        ctx.fill()
        roundRect(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.55)
        ctx.fillStyle = dark ? hsla(ACCENT, 58, 58, 0.28) : hsla(ACCENT, 58, 58, 0.24)
        ctx.fill()
        ctx.strokeStyle = dark ? hsla(ACCENT, 60, 62, 0.95) : hsla(ACCENT, 58, 42, 0.95)
        ctx.lineWidth = Math.max(1.4, cell * 0.08)
        ctx.stroke()
      }
    }
  }
}

/** You — a soft rounded bead with a face, in the Snake family. */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  dark: boolean,
) {
  const cx = ox + state.player.x * cell
  const cy = oy + state.player.y * cell
  const lineW = Math.max(1.3, cell * 0.08)
  const size = cell * 0.72
  const x = cx - size / 2
  const y = cy - size / 2
  const rad = size * 0.42

  if (state.phase === 'dying') {
    const t = 1 - Math.max(0, state.deathAnim) / 0.85
    ctx.globalAlpha = Math.max(0, 1 - t)
    roundRect(ctx, x, y, size * (1 - t * 0.35), size * (1 - t * 0.35), rad)
    ctx.fillStyle = hsla(ACCENT, 58, 58, 0.22)
    ctx.fill()
    ctx.strokeStyle = hsla(ACCENT, 58, 42, 0.95)
    ctx.lineWidth = lineW
    ctx.stroke()
    ctx.globalAlpha = 1
    return
  }

  if (state.invuln > 0 && Math.floor(state.invuln * 12) % 2 === 0) {
    ctx.globalAlpha = 0.4
  }

  roundRect(ctx, x, y, size, size, rad)
  ctx.fillStyle = dark ? hsla(ACCENT, 58, 58, 0.26) : hsla(ACCENT, 58, 58, 0.22)
  ctx.fill()
  ctx.strokeStyle = dark ? hsla(ACCENT, 60, 62, 0.95) : hsla(ACCENT, 58, 42, 0.95)
  ctx.lineWidth = lineW
  ctx.lineJoin = 'round'
  ctx.stroke()

  // Eyes look along travel direction.
  const eye = cell * 0.09
  const look =
    state.player.dir === 'left'
      ? { x: -0.12, y: 0 }
      : state.player.dir === 'right'
        ? { x: 0.12, y: 0 }
        : state.player.dir === 'up'
          ? { x: 0, y: -0.12 }
          : { x: 0, y: 0.12 }
  const ey = cy - cell * 0.08
  ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.92)' : 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(cx - cell * 0.14 + look.x * cell, ey + look.y * cell, eye, 0, Math.PI * 2)
  ctx.arc(cx + cell * 0.14 + look.x * cell, ey + look.y * cell, eye, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = dark ? '#0d1720' : '#1a2b3c'
  ctx.beginPath()
  ctx.arc(cx - cell * 0.14 + look.x * cell * 1.4, ey + look.y * cell * 1.4, eye * 0.45, 0, Math.PI * 2)
  ctx.arc(cx + cell * 0.14 + look.x * cell * 1.4, ey + look.y * cell * 1.4, eye * 0.45, 0, Math.PI * 2)
  ctx.fill()

  // Tiny bite notch — reads as hungry without going full wedge.
  ctx.strokeStyle = dark ? hsla(ACCENT, 50, 45, 0.7) : hsla(ACCENT, 50, 38, 0.65)
  ctx.lineWidth = Math.max(1.2, cell * 0.06)
  ctx.lineCap = 'round'
  const mouthOpen = 0.5 + 0.5 * Math.sin(state.mouth)
  ctx.beginPath()
  if (state.player.dir === 'right') {
    ctx.moveTo(cx + size * 0.18, cy + cell * 0.06)
    ctx.quadraticCurveTo(cx + size * 0.32, cy + cell * 0.1 * mouthOpen, cx + size * 0.22, cy + cell * 0.18)
  } else if (state.player.dir === 'left') {
    ctx.moveTo(cx - size * 0.18, cy + cell * 0.06)
    ctx.quadraticCurveTo(cx - size * 0.32, cy + cell * 0.1 * mouthOpen, cx - size * 0.22, cy + cell * 0.18)
  } else if (state.player.dir === 'up') {
    ctx.moveTo(cx - cell * 0.08, cy - size * 0.12)
    ctx.quadraticCurveTo(cx, cy - size * 0.22 - cell * 0.04 * mouthOpen, cx + cell * 0.08, cy - size * 0.12)
  } else {
    ctx.moveTo(cx - cell * 0.08, cy + size * 0.18)
    ctx.quadraticCurveTo(cx, cy + size * 0.28 + cell * 0.04 * mouthOpen, cx + cell * 0.08, cy + size * 0.18)
  }
  ctx.stroke()

  ctx.globalAlpha = 1
}

/** Rival chasers — same bead language as Snake, different hues. */
function drawChaser(
  ctx: CanvasRenderingContext2D,
  ghost: Ghost,
  ox: number,
  oy: number,
  cell: number,
  dark: boolean,
  fright: number,
  time: number,
) {
  const cx = ox + ghost.x * cell
  const cy = oy + ghost.y * cell
  const lineW = Math.max(1.3, cell * 0.08)
  const size = cell * 0.68
  const x = cx - size / 2
  const y = cy - size / 2
  const rad = size * 0.4

  if (ghost.eaten) {
    // Eyes only — hustling back to the den.
    ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.9)' : 'rgba(255, 255, 255, 0.95)'
    ctx.beginPath()
    ctx.arc(cx - cell * 0.14, cy, cell * 0.12, 0, Math.PI * 2)
    ctx.arc(cx + cell * 0.14, cy, cell * 0.12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = dark ? '#0d1720' : '#1a2b3c'
    ctx.beginPath()
    ctx.arc(cx - cell * 0.14, cy, cell * 0.05, 0, Math.PI * 2)
    ctx.arc(cx + cell * 0.14, cy, cell * 0.05, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const scared = ghost.mode === 'frightened'
  const flash = scared && fright < 2 && Math.floor(time * 8) % 2 === 0
  const hue = scared ? (flash ? 210 : 230) : chaserHue(ghost.kind)

  roundRect(ctx, x, y, size, size, rad)
  ctx.fillStyle = dark ? hsla(hue, 56, 58, 0.24) : hsla(hue, 56, 58, 0.2)
  ctx.fill()
  ctx.strokeStyle = dark ? hsla(hue, 55, 62, 0.95) : hsla(hue, 55, 40, 0.95)
  ctx.lineWidth = lineW
  ctx.lineJoin = 'round'
  ctx.stroke()

  const eye = cell * 0.085
  const look =
    ghost.dir === 'left'
      ? -0.1
      : ghost.dir === 'right'
        ? 0.1
        : 0
  const lookY = ghost.dir === 'up' ? -0.08 : ghost.dir === 'down' ? 0.08 : 0
  ctx.fillStyle = scared
    ? dark
      ? 'rgba(180, 210, 230, 0.95)'
      : 'rgba(230, 245, 255, 0.95)'
    : dark
      ? 'rgba(231, 238, 243, 0.92)'
      : 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(cx - cell * 0.13 + look * cell, cy - cell * 0.06 + lookY * cell, eye, 0, Math.PI * 2)
  ctx.arc(cx + cell * 0.13 + look * cell, cy - cell * 0.06 + lookY * cell, eye, 0, Math.PI * 2)
  ctx.fill()
  if (!scared) {
    ctx.fillStyle = dark ? '#0d1720' : '#1a2b3c'
    ctx.beginPath()
    ctx.arc(cx - cell * 0.13 + look * cell * 1.5, cy - cell * 0.06 + lookY * cell * 1.5, eye * 0.45, 0, Math.PI * 2)
    ctx.arc(cx + cell * 0.13 + look * cell * 1.5, cy - cell * 0.06 + lookY * cell * 1.5, eye * 0.45, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.strokeStyle = flash ? hsla(210, 40, 40, 0.9) : hsla(210, 30, 70, 0.9)
    ctx.lineWidth = Math.max(1.2, cell * 0.05)
    ctx.beginPath()
    ctx.moveTo(cx - cell * 0.16, cy + cell * 0.14)
    ctx.quadraticCurveTo(cx, cy + cell * 0.22, cx + cell * 0.16, cy + cell * 0.14)
    ctx.stroke()
  }
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dark = isDarkTheme()
  const { cell, ox, oy, gridW, gridH } = computeLayout(w, h)
  const time = performance.now() / 1000

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  // Soft starfield — same family as Snake / Asteroids.
  const step = 28 * Math.max(0.7, Math.min(w, h) / 540)
  ctx.fillStyle = dark ? 'rgba(74, 168, 232, 0.12)' : 'rgba(74, 168, 232, 0.14)'
  for (let py = step * 0.4; py < h; py += step) {
    for (let px = step * 0.4; px < w; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.15, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const radius = Math.max(12, cell * 0.55)
  roundRect(ctx, ox - 10, oy - 10, gridW + 20, gridH + 20, radius)
  ctx.fillStyle = dark ? 'rgba(8, 14, 20, 0.55)' : 'rgba(255, 255, 255, 0.55)'
  ctx.fill()
  ctx.strokeStyle = dark ? 'rgba(231, 238, 243, 0.08)' : 'rgba(26, 43, 60, 0.06)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Soft corridor dots on open tiles.
  ctx.fillStyle = dark ? 'rgba(46, 184, 160, 0.1)' : 'rgba(46, 184, 160, 0.1)'
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (!state.open[y][x]) continue
      const cx = ox + (x + 0.5) * cell
      const cy = oy + (y + 0.5) * cell
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(1, cell * 0.045), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  drawWalls(ctx, state, ox, oy, cell, dark)
  drawCrumbs(ctx, state, ox, oy, cell, dark, time)

  for (const ghost of state.ghosts) {
    drawChaser(ctx, ghost, ox, oy, cell, dark, state.fright, time)
  }
  drawPlayer(ctx, state, ox, oy, cell, dark)

  if (state.phase === 'clearing') {
    ctx.fillStyle = dark ? 'rgba(8, 14, 20, 0.4)' : 'rgba(255, 255, 255, 0.45)'
    roundRect(ctx, ox, oy, gridW, gridH, Math.max(8, cell * 0.3))
    ctx.fill()
    ctx.fillStyle = dark ? '#e7eef3' : '#1a2b3c'
    ctx.font = `900 ${Math.max(18, Math.round(cell * 1.05))}px "Segoe UI", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Level ${state.level + 1}`, ox + gridW / 2, oy + gridH / 2)
  }
}
