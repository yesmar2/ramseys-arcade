import { isDarkTheme, playfieldColor } from '../../lib/theme'
import { comboMult, type GameState, type Ghost, type GhostKind } from './game'

/** Gold crumbs — same family as Snake food. */
const ACCENT = 38

type Skin = {
  dark: boolean
  wallFill: string
  wallStroke: string
  floorDot: string
  crumbFill: string
  crumbStroke: string
  panel: string
  panelEdge: string
  star: string
}

function hsla(hue: number, sat: number, light: number, alpha = 1) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

function skinFor(dark: boolean): Skin {
  return dark
    ? {
        dark,
        // Palette mint — same family as Snake beads / --accent.
        wallFill: '#122820',
        wallStroke: '#2eb8a0',
        floorDot: 'rgba(74, 168, 232, 0.12)',
        crumbFill: hsla(ACCENT, 58, 58, 0.22),
        crumbStroke: hsla(ACCENT, 58, 58, 0.9),
        panel: 'rgba(8, 14, 20, 0.55)',
        panelEdge: 'rgba(231, 238, 243, 0.08)',
        star: 'rgba(74, 168, 232, 0.12)',
      }
    : {
        dark,
        wallFill: '#c5f0e4',
        wallStroke: '#2eb8a0',
        floorDot: 'rgba(74, 168, 232, 0.14)',
        crumbFill: hsla(ACCENT, 58, 58, 0.2),
        crumbStroke: hsla(ACCENT, 58, 42, 0.9),
        panel: 'rgba(255, 255, 255, 0.55)',
        panelEdge: 'rgba(26, 43, 60, 0.06)',
        star: 'rgba(74, 168, 232, 0.14)',
      }
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

export function computeLayout(w: number, h: number, cols: number, rows: number) {
  const padX = Math.max(6, Math.min(20, w * 0.012))
  const hud = Math.max(40, Math.min(64, h * 0.075))
  const padBottom = Math.max(8, Math.min(28, h * 0.02))
  const availW = w - padX * 2
  const availH = h - hud - padBottom
  // Integer cells so adjacent wall edges share a pixel and outlines meet.
  const cell = Math.max(1, Math.floor(Math.min(availW / cols, availH / rows)))
  const gridW = cell * cols
  const gridH = cell * rows
  const ox = Math.round((w - gridW) / 2)
  const oy = Math.round(hud + Math.max(0, (availH - gridH) / 2))
  return { cell, ox, oy, hud, gridW, gridH }
}

function chaserHue(kind: GhostKind) {
  if (kind === 'blink') return 352
  if (kind === 'pink') return 288
  if (kind === 'inky') return 186
  return 26
}

function wallAt(state: GameState, x: number, y: number) {
  if (y < 0 || y >= state.rows || x < 0 || x >= state.cols) return false
  return !state.open[y][x]
}

/** Lane or off-board — both get an outline edge. */
function openOrOutside(state: GameState, x: number, y: number) {
  if (y < 0 || y >= state.rows || x < 0 || x >= state.cols) return true
  return state.open[y][x]
}

/** Clockwise outline loops around wall regions, in grid-vertex units. */
function wallOutlineLoops(state: GameState) {
  const vertexKey = (x: number, y: number) => `${x},${y}`
  const outgoing = new Map<string, { x: number; y: number }[]>()

  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const key = vertexKey(x0, y0)
    const list = outgoing.get(key) ?? []
    list.push({ x: x1, y: y1 })
    outgoing.set(key, list)
  }

  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (!wallAt(state, x, y)) continue
      if (openOrOutside(state, x, y - 1)) add(x, y, x + 1, y)
      if (openOrOutside(state, x + 1, y)) add(x + 1, y, x + 1, y + 1)
      if (openOrOutside(state, x, y + 1)) add(x + 1, y + 1, x, y + 1)
      if (openOrOutside(state, x - 1, y)) add(x, y + 1, x, y)
    }
  }

  const loops: { x: number; y: number }[][] = []
  while (outgoing.size) {
    const startKey = outgoing.keys().next().value
    if (!startKey) break
    const [sx, sy] = startKey.split(',').map(Number)
    const loop = [{ x: sx, y: sy }]
    let cx = sx
    let cy = sy
    for (let guard = 0; guard < state.cols * state.rows * 4; guard++) {
      const opts = outgoing.get(vertexKey(cx, cy))
      if (!opts?.length) break
      const next = opts.pop()!
      if (!opts.length) outgoing.delete(vertexKey(cx, cy))
      loop.push(next)
      cx = next.x
      cy = next.y
      if (cx === sx && cy === sy) break
    }
    if (loop.length > 2) loops.push(loop)
  }
  return loops
}

/**
 * Solid full-cell walls so corridors and walls are the same thickness.
 * Outlines are one continuous loop per wall region so every corner meets.
 */
function drawWalls(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  skin: Skin,
) {
  ctx.save()

  ctx.beginPath()
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (!wallAt(state, x, y)) continue
      ctx.rect(ox + x * cell, oy + y * cell, cell, cell)
    }
  }
  ctx.clip()

  ctx.fillStyle = skin.wallFill
  ctx.fillRect(ox, oy, state.cols * cell, state.rows * cell)

  ctx.strokeStyle = skin.wallStroke
  ctx.lineWidth = Math.max(2, cell * 0.1) * 2
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'
  ctx.miterLimit = 2
  ctx.beginPath()
  for (const loop of wallOutlineLoops(state)) {
    const start = loop[0]
    if (!start) continue
    ctx.moveTo(ox + start.x * cell, oy + start.y * cell)
    for (let i = 1; i < loop.length; i++) {
      const p = loop[i]
      if (!p) continue
      ctx.lineTo(ox + p.x * cell, oy + p.y * cell)
    }
  }
  ctx.stroke()
  ctx.restore()

  // Den gate — gold stroke, same family as crumbs.
  ctx.strokeStyle = skin.crumbStroke
  ctx.lineWidth = Math.max(1.3, cell * 0.07)
  ctx.lineCap = 'round'
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (!state.door[y][x]) continue
      const cx = ox + (x + 0.5) * cell
      const cy = oy + (y + 0.5) * cell
      ctx.beginPath()
      ctx.moveTo(cx - cell * 0.32, cy)
      ctx.lineTo(cx + cell * 0.32, cy)
      ctx.stroke()
    }
  }
}

/** Offscreen cache for playfield + panel + walls + empty floor dots. */
let staticLayer: {
  open: boolean[][]
  door: boolean[][]
  cell: number
  ox: number
  oy: number
  w: number
  h: number
  dark: boolean
  playfield: string
  canvas: HTMLCanvasElement
  dpr: number
} | null = null

function paintStatic(
  canvas: HTMLCanvasElement,
  dpr: number,
  state: GameState,
  w: number,
  h: number,
  cell: number,
  ox: number,
  oy: number,
  gridW: number,
  gridH: number,
  skin: Skin,
) {
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  const step = 28 * Math.max(0.7, Math.min(w, h) / 540)
  ctx.fillStyle = skin.star
  for (let py = step * 0.4; py < h; py += step) {
    for (let px = step * 0.4; px < w; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.15, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const pad = Math.max(6, cell * 0.3)
  roundRect(ctx, ox - pad, oy - pad, gridW + pad * 2, gridH + pad * 2, Math.max(12, cell * 0.55))
  ctx.fillStyle = skin.panel
  ctx.fill()
  ctx.strokeStyle = skin.panelEdge
  ctx.lineWidth = 1
  ctx.stroke()

  // Soft corridor dots — same mint language as Snake.
  ctx.fillStyle = skin.floorDot
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (!state.open[y][x]) continue
      ctx.beginPath()
      ctx.arc(
        ox + (x + 0.5) * cell,
        oy + (y + 0.5) * cell,
        Math.max(1, cell * 0.055),
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  drawWalls(ctx, state, ox, oy, cell, skin)
}

function drawStaticLayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
  cell: number,
  ox: number,
  oy: number,
  gridW: number,
  gridH: number,
  skin: Skin,
  dpr: number,
) {
  const playfield = playfieldColor()
  const hit =
    staticLayer &&
    staticLayer.open === state.open &&
    staticLayer.door === state.door &&
    staticLayer.cell === cell &&
    staticLayer.ox === ox &&
    staticLayer.oy === oy &&
    staticLayer.w === w &&
    staticLayer.h === h &&
    staticLayer.dark === skin.dark &&
    staticLayer.playfield === playfield &&
    staticLayer.dpr === dpr

  if (!hit) {
    const canvas = staticLayer?.canvas ?? document.createElement('canvas')
    paintStatic(canvas, dpr, state, w, h, cell, ox, oy, gridW, gridH, skin)
    staticLayer = {
      open: state.open,
      door: state.door,
      cell,
      ox,
      oy,
      w,
      h,
      dark: skin.dark,
      playfield,
      canvas,
      dpr,
    }
  }

  ctx.drawImage(staticLayer!.canvas, 0, 0, w, h)
}

function drawCrumbs(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  skin: Skin,
  time: number,
) {
  const crumbR = Math.max(1.5, cell * 0.12)
  const crumbLine = Math.max(1, cell * 0.045)
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (!state.crumbs[y][x]) continue
      const cx = ox + (x + 0.5) * cell
      const cy = oy + (y + 0.5) * cell
      ctx.beginPath()
      ctx.arc(cx, cy, crumbR, 0, Math.PI * 2)
      ctx.fillStyle = skin.crumbFill
      ctx.fill()
      ctx.strokeStyle = skin.crumbStroke
      ctx.lineWidth = crumbLine
      ctx.stroke()
    }
  }

  const pulse = 0.88 + Math.sin(time * 6) * 0.12
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (!state.power[y][x]) continue
      const cx = ox + (x + 0.5) * cell
      const cy = oy + (y + 0.5) * cell
      const r = cell * 0.28 * pulse
      const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, r * 2.1)
      glow.addColorStop(0, 'rgba(245, 185, 66, 0.4)')
      glow.addColorStop(1, 'rgba(245, 185, 66, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = skin.crumbFill
      ctx.fill()
      ctx.strokeStyle = skin.crumbStroke
      ctx.lineWidth = Math.max(1.1, cell * 0.055)
      ctx.stroke()
    }
  }
}

/** You: Pac-Man wedge in Snake bead language — soft gold fill + stroke. */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  skin: Skin,
) {
  const cx = ox + state.player.x * cell
  const cy = oy + state.player.y * cell
  const surging = state.surgeTime > 0
  const lineW = Math.max(1.2, cell * 0.07)
  const r = cell * (surging ? 0.42 : 0.38)
  const fill = hsla(ACCENT, 58, 58, surging ? 0.34 : 0.22)
  const stroke = hsla(ACCENT, 58, skin.dark ? 58 : 42, 0.95)

  /**
   * Face right in local space, then flip/rotate. scale(-1) for left keeps the
   * chomp upright instead of rotate(π).
   */
  const faceLocal = (ctx: CanvasRenderingContext2D) => {
    if (state.player.dir === 'left') ctx.scale(-1, 1)
    else if (state.player.dir === 'up') ctx.rotate(-Math.PI / 2)
    else if (state.player.dir === 'down') ctx.rotate(Math.PI / 2)
  }

  if (state.phase === 'dying') {
    const t = 1 - Math.max(0, state.deathAnim) / 0.85
    const open = Math.min(Math.PI - 0.05, t * Math.PI)
    ctx.save()
    ctx.translate(cx, cy)
    faceLocal(ctx)
    ctx.globalAlpha = Math.max(0, 1 - t * 0.85)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, r * (1 - t * 0.2), open, Math.PI * 2 - open)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = lineW
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
    ctx.globalAlpha = 1
    return
  }

  for (const dot of state.trail) {
    const tx = ox + dot.x * cell
    const ty = oy + dot.y * cell
    ctx.beginPath()
    ctx.arc(tx, ty, r * (0.4 + 0.45 * dot.life), 0, Math.PI * 2)
    ctx.fillStyle = hsla(ACCENT, 58, 58, 0.18 * dot.life)
    ctx.fill()
    ctx.strokeStyle = hsla(ACCENT, 58, 48, 0.55 * dot.life)
    ctx.lineWidth = Math.max(1, lineW * 0.7)
    ctx.stroke()
  }

  if (state.invuln > 0 && Math.floor(state.invuln * 12) % 2 === 0) {
    ctx.globalAlpha = 0.4
  }

  if (surging) {
    const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2)
    glow.addColorStop(0, 'rgba(245, 185, 66, 0.35)')
    glow.addColorStop(1, 'rgba(245, 185, 66, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, r * 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Classic chomp: mouth opens and closes, always facing travel.
  const chomp = 0.4 + 0.45 * (0.5 + 0.5 * Math.sin(state.mouth))

  ctx.save()
  ctx.translate(cx, cy)
  faceLocal(ctx)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, r, chomp, Math.PI * 2 - chomp)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineW
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()

  ctx.globalAlpha = 1
}

/** Rival chasers — Snake bead body with a soft skirt, no faces. */
function drawChaser(
  ctx: CanvasRenderingContext2D,
  ghost: Ghost,
  ox: number,
  oy: number,
  cell: number,
  skin: Skin,
  fright: number,
  time: number,
) {
  const bob = ghost.mode === 'den' ? Math.sin(ghost.bob) * cell * 0.08 : 0
  const cx = ox + ghost.x * cell
  const cy = oy + ghost.y * cell + bob
  const lineW = Math.max(1.15, cell * 0.065)
  const r = cell * 0.34
  const scared = ghost.mode === 'frightened'
  const eaten = ghost.mode === 'eaten'
  const flash = scared && fright < 2 && Math.floor(time * 8) % 2 === 0

  if (eaten) {
    // Hollow bead hustling home — readable without eyes.
    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.2, 0, Math.PI * 2)
    ctx.strokeStyle = hsla(chaserHue(ghost.kind), 50, skin.dark ? 62 : 42, 0.7)
    ctx.lineWidth = Math.max(1.2, cell * 0.06)
    ctx.stroke()
    return
  }

  const hue = scared ? (flash ? 8 : 224) : chaserHue(ghost.kind)
  const sat = scared ? (flash ? 70 : 55) : 56
  const light = 58

  if (ghost.hit > 0) {
    ctx.fillStyle = `hsla(0, 0%, 100%, ${0.35 * ghost.hit})`
    ctx.beginPath()
    ctx.arc(cx, cy, r * (1.25 + ghost.hit * 0.4), 0, Math.PI * 2)
    ctx.fill()
  }

  // Dome + soft wavy skirt, filled/stroked like a Snake bead.
  const wave = Math.sin(time * 5.5 + ghost.bob) * cell * 0.04
  const foot = cy + r * 0.92
  ctx.beginPath()
  ctx.arc(cx, cy - r * 0.06, r, Math.PI, 0)
  ctx.lineTo(cx + r, foot - r * 0.1)
  for (let i = 0; i < 3; i++) {
    const x0 = cx + r - ((i * 2 + 1) * r) / 3
    const x1 = cx + r - ((i * 2 + 2) * r) / 3
    ctx.quadraticCurveTo(
      x0,
      foot + (i % 2 === 0 ? 0.22 : -0.08) * r + wave,
      x1,
      foot - r * 0.1,
    )
  }
  ctx.closePath()
  ctx.fillStyle = hsla(hue, sat, light, 0.22)
  ctx.fill()
  ctx.strokeStyle = hsla(hue, sat, skin.dark ? 62 : 40, 0.95)
  ctx.lineWidth = lineW
  ctx.lineJoin = 'round'
  ctx.stroke()

  if (scared) {
    ctx.strokeStyle = flash ? hsla(8, 60, 30, 0.9) : hsla(210, 30, 70, 0.9)
    ctx.lineWidth = Math.max(1, cell * 0.045)
    ctx.beginPath()
    ctx.moveTo(cx - cell * 0.16, cy + cell * 0.1)
    ctx.quadraticCurveTo(cx, cy + cell * 0.2, cx + cell * 0.16, cy + cell * 0.1)
    ctx.stroke()
  }
}

function drawPops(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  cell: number,
  skin: Skin,
) {
  if (!state.pops.length) return
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${Math.max(11, Math.round(cell * 0.52))}px "Segoe UI", system-ui, sans-serif`
  for (const pop of state.pops) {
    const t = 1 - pop.life / 0.9
    ctx.globalAlpha = Math.max(0, pop.life / 0.9)
    ctx.fillStyle = skin.dark ? '#e7eef3' : '#1a2b3c'
    ctx.fillText(pop.text, ox + pop.x * cell, oy + pop.y * cell - t * cell * 0.9)
  }
  ctx.globalAlpha = 1
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  // Only realloc when the board size changes — resetting width every frame
  // is what made Pellets feel choppy next to Snake.
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.canvas.style.width = `${w}px`
    ctx.canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const skin = skinFor(isDarkTheme())
  const { cell, ox, oy, gridW, gridH } = computeLayout(w, h, state.cols, state.rows)
  const pad = Math.max(6, cell * 0.3)

  drawStaticLayer(ctx, state, w, h, cell, ox, oy, gridW, gridH, skin, dpr)
  drawCrumbs(ctx, state, ox, oy, cell, skin, state.time)

  for (const ghost of state.ghosts) {
    drawChaser(ctx, ghost, ox, oy, cell, skin, state.fright, state.time)
  }
  drawPlayer(ctx, state, ox, oy, cell, skin)
  drawPops(ctx, state, ox, oy, cell, skin)

  if (state.phase === 'clearing') {
    ctx.fillStyle = skin.dark ? 'rgba(8, 14, 20, 0.45)' : 'rgba(255, 255, 255, 0.5)'
    roundRect(ctx, ox, oy, gridW, gridH, Math.max(8, cell * 0.3))
    ctx.fill()
    ctx.fillStyle = skin.dark ? '#e7eef3' : '#1a2b3c'
    ctx.font = `900 ${Math.max(18, Math.round(cell * 1.05))}px "Segoe UI", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Level ${state.level + 1}`, ox + gridW / 2, oy + gridH / 2 - cell * 0.5)
    ctx.font = `700 ${Math.max(11, Math.round(cell * 0.5))}px "Segoe UI", system-ui, sans-serif`
    ctx.fillText('New maze', ox + gridW / 2, oy + gridH / 2 + cell * 0.6)
  }

  if (state.combo >= 10 && state.phase === 'playing') {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = `900 ${Math.max(12, Math.round(cell * 0.55))}px "Segoe UI", system-ui, sans-serif`
    ctx.fillStyle = hsla(ACCENT, 70, skin.dark ? 64 : 42, 0.9)
    ctx.fillText(`×${comboMult(state.combo)} streak`, ox + gridW / 2, oy + gridH + pad * 0.35)
  }
}
