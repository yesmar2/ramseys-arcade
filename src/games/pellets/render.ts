import { isDarkTheme, playfieldColor } from '../../lib/theme'
import {
  COLS,
  ROWS,
  mazeChar,
  type GameState,
  type Ghost,
} from './game'

function fill(hue: number, sat: number, light: number, alpha = 1) {
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
  const pad = Math.max(10, Math.min(w, h) * 0.03)
  const hud = Math.max(48, Math.min(72, h * 0.1))
  const availW = w - pad * 2
  const availH = h - hud - pad
  const cell = Math.max(1, Math.min(availW / COLS, availH / ROWS))
  const gridW = cell * COLS
  const gridH = cell * ROWS
  const ox = (w - gridW) / 2
  const oy = hud + Math.max(0, (availH - gridH) / 2)
  return { cell, ox, oy, hud, gridW, gridH }
}

function drawWalls(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  dark: boolean,
) {
  const wall = dark ? fill(210, 70, 62) : fill(220, 72, 48)
  const glow = dark ? fill(210, 80, 70, 0.35) : fill(220, 70, 58, 0.25)
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (state.open[y][x]) continue
      const px = ox + x * cell
      const py = oy + y * cell
      ctx.fillStyle = glow
      roundRect(ctx, px + cell * 0.08, py + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.2)
      ctx.fill()
      ctx.fillStyle = wall
      roundRect(ctx, px + cell * 0.14, py + cell * 0.14, cell * 0.72, cell * 0.72, cell * 0.16)
      ctx.fill()
    }
  }

  // House door
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (mazeChar(x, y) !== '=') continue
      ctx.fillStyle = fill(45, 80, dark ? 62 : 55)
      ctx.fillRect(ox + x * cell + cell * 0.1, oy + y * cell + cell * 0.4, cell * 0.8, cell * 0.2)
    }
  }
}

function drawPellets(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  dark: boolean,
  time: number,
) {
  const pellet = dark ? fill(48, 70, 70) : fill(42, 75, 48)
  const power = dark ? fill(48, 85, 72) : fill(42, 90, 52)
  const pulse = 0.85 + Math.sin(time * 8) * 0.15
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const cx = ox + (x + 0.5) * cell
      const cy = oy + (y + 0.5) * cell
      if (state.pellets[y][x]) {
        ctx.fillStyle = pellet
        ctx.beginPath()
        ctx.arc(cx, cy, cell * 0.1, 0, Math.PI * 2)
        ctx.fill()
      }
      if (state.power[y][x]) {
        ctx.fillStyle = power
        ctx.beginPath()
        ctx.arc(cx, cy, cell * 0.28 * pulse, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function drawMuncher(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  dark: boolean,
) {
  if (state.phase === 'dying') {
    const t = 1 - Math.max(0, state.deathAnim) / 0.85
    const cx = ox + state.player.x * cell
    const cy = oy + state.player.y * cell
    ctx.fillStyle = fill(42, 90, dark ? 60 : 52, 1 - t)
    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.42 * (1 - t * 0.4), 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const cx = ox + state.player.x * cell
  const cy = oy + state.player.y * cell
  const mouth = 0.15 + (0.5 + 0.5 * Math.sin(state.mouth)) * 0.35
  const rot =
    state.player.dir === 'right'
      ? 0
      : state.player.dir === 'down'
        ? Math.PI / 2
        : state.player.dir === 'left'
          ? Math.PI
          : -Math.PI / 2

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  if (state.invuln > 0 && Math.floor(state.invuln * 12) % 2 === 0) {
    ctx.globalAlpha = 0.45
  }
  ctx.fillStyle = fill(42, 92, dark ? 58 : 52)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, cell * 0.42, mouth, Math.PI * 2 - mouth)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#1a2b3c'
  ctx.beginPath()
  ctx.arc(cell * 0.08, -cell * 0.16, cell * 0.07, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function ghostColor(kind: Ghost['kind'], dark: boolean) {
  if (kind === 'blink') return fill(0, 78, dark ? 58 : 52)
  if (kind === 'pink') return fill(330, 70, dark ? 68 : 62)
  if (kind === 'inky') return fill(190, 70, dark ? 58 : 50)
  return fill(28, 85, dark ? 58 : 50)
}

function drawGhost(
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
  const r = cell * 0.4

  if (ghost.eaten) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(cx - r * 0.28, cy - r * 0.1, r * 0.28, 0, Math.PI * 2)
    ctx.arc(cx + r * 0.28, cy - r * 0.1, r * 0.28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a2b3c'
    ctx.beginPath()
    ctx.arc(cx - r * 0.28, cy - r * 0.1, r * 0.12, 0, Math.PI * 2)
    ctx.arc(cx + r * 0.28, cy - r * 0.1, r * 0.12, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const scared = ghost.mode === 'frightened'
  const flash = scared && fright < 2 && Math.floor(time * 8) % 2 === 0
  ctx.fillStyle = scared
    ? flash
      ? fill(220, 40, dark ? 80 : 88)
      : fill(230, 70, dark ? 55 : 45)
    : ghostColor(ghost.kind, dark)

  ctx.beginPath()
  ctx.arc(cx, cy - r * 0.15, r * 0.85, Math.PI, 0)
  ctx.lineTo(cx + r * 0.85, cy + r * 0.7)
  const waves = 4
  for (let i = waves; i >= 0; i--) {
    const wx = cx + r * 0.85 - (i / waves) * r * 1.7
    const wy = cy + r * 0.7 + (i % 2 === 0 ? r * 0.18 : -r * 0.05)
    ctx.lineTo(wx, wy)
  }
  ctx.closePath()
  ctx.fill()

  const eyeY = cy - r * 0.2
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx - r * 0.3, eyeY, r * 0.28, 0, Math.PI * 2)
  ctx.arc(cx + r * 0.3, eyeY, r * 0.28, 0, Math.PI * 2)
  ctx.fill()
  if (!scared) {
    const look =
      ghost.dir === 'left'
        ? -0.1
        : ghost.dir === 'right'
          ? 0.1
          : ghost.dir === 'up'
            ? -0.05
            : 0.05
    ctx.fillStyle = '#1a2b3c'
    ctx.beginPath()
    ctx.arc(cx - r * 0.3 + look * cell, eyeY + (ghost.dir === 'down' ? 0.06 : ghost.dir === 'up' ? -0.06 : 0) * cell, r * 0.12, 0, Math.PI * 2)
    ctx.arc(cx + r * 0.3 + look * cell, eyeY + (ghost.dir === 'down' ? 0.06 : ghost.dir === 'up' ? -0.06 : 0) * cell, r * 0.12, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.strokeStyle = flash ? '#1a2b3c' : '#fff'
    ctx.lineWidth = Math.max(1.5, cell * 0.06)
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.45, cy + r * 0.25)
    ctx.quadraticCurveTo(cx - r * 0.2, cy + r * 0.4, cx, cy + r * 0.25)
    ctx.quadraticCurveTo(cx + r * 0.2, cy + r * 0.1, cx + r * 0.45, cy + r * 0.25)
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

  // Board well
  ctx.fillStyle = dark ? 'rgba(8, 14, 22, 0.55)' : 'rgba(255, 255, 255, 0.55)'
  roundRect(ctx, ox - cell * 0.15, oy - cell * 0.15, gridW + cell * 0.3, gridH + cell * 0.3, cell * 0.35)
  ctx.fill()

  drawWalls(ctx, state, ox, oy, cell, dark)
  drawPellets(ctx, state, ox, oy, cell, dark, time)

  for (const ghost of state.ghosts) {
    drawGhost(ctx, ghost, ox, oy, cell, dark, state.fright, time)
  }
  drawMuncher(ctx, state, ox, oy, cell, dark)

  if (state.phase === 'clearing') {
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.4)'
    ctx.fillRect(ox, oy, gridW, gridH)
    ctx.fillStyle = dark ? '#fff' : '#1a2b3c'
    ctx.font = `900 ${Math.max(18, Math.round(cell * 1.1))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`LEVEL ${state.level + 1}`, ox + gridW / 2, oy + gridH / 2)
  }
}
