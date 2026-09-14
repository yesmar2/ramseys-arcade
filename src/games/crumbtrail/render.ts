import { isDarkTheme, isFlatTheme, playfieldColor, softFillAlpha } from '../../lib/theme'
import {
  bufferRowOf,
  tidePressure,
  worldRowAt,
  type GameState,
  type Ghost,
  type GhostKind,
} from './game'

/** Gold crumbs — same family as Pellets and Snake food. */
const ACCENT = 38
/** Distance markers every this many rows. */
const MILESTONE_STEP = 50

type Skin = {
  dark: boolean
  wallFill: string
  wallStroke: string
  crumbFill: string
  crumbStroke: string
  ink: string
  edge: string
}

function hsla(hue: number, sat: number, light: number, alpha = 1) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

function skinFor(dark: boolean): Skin {
  const flat = isFlatTheme()
  const crumbA = softFillAlpha(dark ? 0.22 : 0.2)
  return dark
    ? {
        dark,
        wallFill: '#152033',
        wallStroke: '#6b8cff',
        crumbFill: hsla(ACCENT, 58, 58, crumbA),
        crumbStroke: flat ? 'transparent' : hsla(ACCENT, 58, 58, 0.9),
        ink: '#e7eef3',
        edge: 'rgba(232, 93, 117, 0.9)',
      }
    : {
        dark,
        wallFill: '#d9e4fb',
        wallStroke: '#3d63e8',
        crumbFill: hsla(ACCENT, 58, 58, crumbA),
        crumbStroke: flat ? 'transparent' : hsla(ACCENT, 58, 42, 0.9),
        ink: '#1a2b3c',
        edge: 'rgba(200, 50, 80, 0.85)',
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

function chaserHue(kind: GhostKind) {
  if (kind === 'blink') return 355
  if (kind === 'pink') return 320
  if (kind === 'inky') return 190
  return 28
}

export type Layout = {
  cell: number
  /** Screen y of the top edge of buffer row `y`. */
  rowY: (y: number) => number
}

/**
 * Everything hangs off the camera, which is a world row rather than a buffer
 * index: the row it names is drawn along the bottom of the view, and the rest
 * of the strip stacks up from there. Because the camera is a float that tracks
 * the player continuously, the climb is smooth even though the buffer itself
 * only ever shifts in whole rows.
 */
export function computeLayout(w: number, h: number, state: GameState): Layout {
  const cell = w / state.cols
  const cameraBuf = bufferRowOf(state, state.camera)
  return {
    cell,
    rowY: (y: number) => h - (cameraBuf - y + 1) * cell,
  }
}

type Rect = { x: number; y: number; w: number; h: number }

/**
 * Wall tiles merged into as few rectangles as possible.
 *
 * Bands share their gap columns, so a two-row band is the same run of walls
 * twice over; merging them vertically is what turns a pair of thin bars into
 * one chunky block, which is the whole reason the maze reads as a maze.
 */
function wallRects(state: GameState): Rect[] {
  const { cols, rows } = state
  const used: boolean[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(false),
  )
  const out: Rect[] = []

  for (let y = 0; y < rows; y++) {
    let x = 0
    while (x < cols) {
      if (state.open[y][x] || used[y][x]) {
        x += 1
        continue
      }
      let x1 = x
      while (x1 + 1 < cols && !state.open[y][x1 + 1] && !used[y][x1 + 1]) x1 += 1

      let y1 = y
      while (y1 + 1 < rows) {
        let same = true
        for (let c = x; c <= x1; c++) {
          if (state.open[y1 + 1][c] || used[y1 + 1][c]) {
            same = false
            break
          }
        }
        // Only merge a full-width match, or the block would grow teeth.
        if (same && x > 0 && !state.open[y1 + 1][x - 1]) same = false
        if (same && x1 < cols - 1 && !state.open[y1 + 1][x1 + 1]) same = false
        if (!same) break
        y1 += 1
      }

      for (let r = y; r <= y1; r++) {
        for (let c = x; c <= x1; c++) used[r][c] = true
      }
      out.push({ x, y, w: x1 - x + 1, h: y1 - y + 1 })
      x = x1 + 1
    }
  }
  return out
}

function drawWalls(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
  skin: Skin,
) {
  const { cell, rowY } = layout
  const inset = cell * 0.12
  const radius = cell * 0.36
  const flat = isFlatTheme()
  ctx.lineWidth = Math.max(1.2, cell * 0.07)
  ctx.strokeStyle = skin.wallStroke
  ctx.fillStyle = skin.wallFill

  for (const rect of wallRects(state)) {
    const x = rect.x * cell + inset
    const y = rowY(rect.y) + inset
    const w = rect.w * cell - inset * 2
    const h = rect.h * cell - inset * 2
    if (y > ctx.canvas.height || y + h < -cell) continue
    roundRect(ctx, x, y, w, h, radius)
    ctx.fill()
    if (!flat) ctx.stroke()
  }
}

function drawCrumbs(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
  skin: Skin,
) {
  const { cell, rowY } = layout
  const crumbR = Math.max(1.5, cell * 0.12)
  const crumbLine = Math.max(1, cell * 0.045)
  const flat = isFlatTheme()

  ctx.fillStyle = skin.crumbFill
  ctx.strokeStyle = skin.crumbStroke
  ctx.lineWidth = crumbLine
  for (let y = 0; y < state.rows; y++) {
    const cy = rowY(y) + cell * 0.5
    if (cy < -cell || cy > ctx.canvas.height + cell) continue
    for (let x = 0; x < state.cols; x++) {
      if (!state.crumbs[y][x]) continue
      const cx = (x + 0.5) * cell
      ctx.beginPath()
      ctx.arc(cx, cy, crumbR, 0, Math.PI * 2)
      ctx.fill()
      if (!flat) ctx.stroke()
    }
  }

  const pulse = 0.88 + Math.sin(state.time * 6) * 0.12
  for (let y = 0; y < state.rows; y++) {
    const cy = rowY(y) + cell * 0.5
    if (cy < -cell || cy > ctx.canvas.height + cell) continue
    for (let x = 0; x < state.cols; x++) {
      if (!state.power[y][x]) continue
      const cx = (x + 0.5) * cell
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
      if (!flat) {
        ctx.strokeStyle = skin.crumbStroke
        ctx.lineWidth = Math.max(1.1, cell * 0.055)
        ctx.stroke()
      }
    }
  }
}

/**
 * The fruit.
 *
 * Deliberately not in the crumb family: crumbs are small gold dots you take by
 * the dozen without thinking, and this is one thing worth going out of your way
 * for, so it is bigger, rose rather than gold, and it breathes. The last two
 * seconds blink, because an offer you cannot see expiring is not an offer — it
 * is a prize that was taken away from you.
 */
function drawFruit(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
  skin: Skin,
) {
  const fruit = state.fruit
  if (!fruit) return
  const { cell, rowY } = layout
  const cx = fruit.x * cell
  const cy = rowY(fruit.y)
  const going = fruit.life < 2
  if (going && Math.floor(state.time * 7) % 2 === 0) return

  const pulse = 0.9 + Math.sin(state.time * 4.5) * 0.1
  const r = cell * 0.3 * pulse
  const hue = 348 - fruit.tier * 14
  const flat = isFlatTheme()

  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4)
  glow.addColorStop(0, hsla(hue, 68, 60, 0.38))
  glow.addColorStop(1, hsla(hue, 68, 60, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2)
  ctx.fill()

  // Stem, so it reads as fruit rather than as an oversized crumb.
  ctx.strokeStyle = hsla(118, 42, skin.dark ? 58 : 38, 0.95)
  ctx.lineWidth = Math.max(1.2, cell * 0.055)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy - r * 0.75)
  ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 1.5, cx + r * 0.95, cy - r * 1.25)
  ctx.stroke()
  ctx.lineCap = 'butt'

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = hsla(hue, 68, 58, softFillAlpha(0.3))
  ctx.fill()
  if (!flat) {
    ctx.strokeStyle = hsla(hue, 68, skin.dark ? 62 : 44, 0.95)
    ctx.lineWidth = Math.max(1.2, cell * 0.06)
    ctx.stroke()
  }

  // A ring that empties as the clock runs down.
  const left = Math.max(0, fruit.life / fruit.maxLife)
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
  ctx.strokeStyle = hsla(hue, 68, skin.dark ? 66 : 46, 0.75)
  ctx.lineWidth = Math.max(1, cell * 0.05)
  ctx.stroke()
}

/** Faint row numbers every 50 rows, so the climb has landmarks. */
function drawMilestones(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
  skin: Skin,
) {
  const { cell, rowY } = layout
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${Math.max(14, Math.round(cell * 1.5))}px "Segoe UI", system-ui, sans-serif`
  ctx.fillStyle = skin.dark ? 'rgba(231, 238, 243, 0.07)' : 'rgba(26, 43, 60, 0.07)'
  for (let y = 0; y < state.rows; y++) {
    const world = worldRowAt(state, y) - state.baseRow
    if (world <= 0 || world % MILESTONE_STEP !== 0) continue
    const cy = rowY(y) + cell * 0.5
    if (cy < -cell || cy > ctx.canvas.height + cell) continue
    ctx.fillText(String(world), (state.cols * cell) / 2, cy)
  }
  ctx.restore()
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
  skin: Skin,
) {
  const { cell, rowY } = layout
  const cx = state.player.x * cell
  const cy = rowY(state.player.y)
  const surging = state.surgeTime > 0
  const lineW = Math.max(1.2, cell * 0.07)
  const r = cell * (surging ? 0.42 : 0.38)
  const fill = hsla(ACCENT, 58, 58, softFillAlpha(surging ? 0.34 : 0.22))
  const stroke = hsla(ACCENT, 58, skin.dark ? 58 : 42, 0.95)
  const flat = isFlatTheme()

  const faceLocal = (c: CanvasRenderingContext2D) => {
    if (state.player.dir === 'left') c.scale(-1, 1)
    else if (state.player.dir === 'up') c.rotate(-Math.PI / 2)
    else if (state.player.dir === 'down') c.rotate(Math.PI / 2)
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
    if (!flat) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineW
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
    return
  }

  for (const dot of state.trail) {
    ctx.beginPath()
    ctx.arc(dot.x * cell, rowY(dot.y), r * (0.4 + 0.45 * dot.life), 0, Math.PI * 2)
    ctx.fillStyle = hsla(ACCENT, 58, 58, softFillAlpha(0.18) * dot.life)
    ctx.fill()
    if (!flat) {
      ctx.strokeStyle = hsla(ACCENT, 58, 48, 0.55 * dot.life)
      ctx.lineWidth = Math.max(1, lineW * 0.7)
      ctx.stroke()
    }
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
  if (!flat) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lineW
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawChaser(
  ctx: CanvasRenderingContext2D,
  ghost: Ghost,
  layout: Layout,
  skin: Skin,
  fright: number,
  time: number,
) {
  const { cell, rowY } = layout
  const cx = ghost.x * cell
  const cy = rowY(ghost.y) + (ghost.mode === 'asleep' ? Math.sin(ghost.bob * 0.5) * cell * 0.05 : 0)
  const lineW = Math.max(1.15, cell * 0.065)
  const r = cell * 0.34
  const scared = ghost.mode === 'frightened'
  const eaten = ghost.mode === 'eaten'
  const asleep = ghost.mode === 'asleep'
  const flash = scared && fright < 2 && Math.floor(time * 8) % 2 === 0

  /*
   * A sleeper is drawn faint and still. It has to be unmistakably there —
   * seeing it coming is the entire point of seeding them ahead — while never
   * reading as something already chasing you.
   */
  ctx.globalAlpha = asleep ? 0.42 : 0.35 + 0.65 * ghost.arrive

  if (eaten) {
    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.2, 0, Math.PI * 2)
    if (isFlatTheme()) {
      ctx.fillStyle = hsla(chaserHue(ghost.kind), 50, skin.dark ? 62 : 42, 0.45)
      ctx.fill()
    } else {
      ctx.strokeStyle = hsla(chaserHue(ghost.kind), 50, skin.dark ? 62 : 42, 0.7)
      ctx.lineWidth = Math.max(1.2, cell * 0.06)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    return
  }

  const hue = scared ? (flash ? 8 : 224) : chaserHue(ghost.kind)
  const sat = scared ? (flash ? 70 : 55) : 56
  const flat = isFlatTheme()

  if (ghost.hit > 0) {
    ctx.fillStyle = `hsla(0, 0%, 100%, ${0.35 * ghost.hit})`
    ctx.beginPath()
    ctx.arc(cx, cy, r * (1.25 + ghost.hit * 0.4), 0, Math.PI * 2)
    ctx.fill()
  }

  const wave = asleep ? 0 : Math.sin(time * 5.5 + ghost.bob) * cell * 0.04
  const foot = cy + r * 0.92
  ctx.beginPath()
  ctx.arc(cx, cy - r * 0.06, r, Math.PI, 0)
  ctx.lineTo(cx + r, foot - r * 0.1)
  for (let i = 0; i < 3; i++) {
    const x0 = cx + r - ((i * 2 + 1) * r) / 3
    const x1 = cx + r - ((i * 2 + 2) * r) / 3
    ctx.quadraticCurveTo(x0, foot + (i % 2 === 0 ? 0.22 : -0.08) * r + wave, x1, foot - r * 0.1)
  }
  ctx.closePath()
  ctx.fillStyle = hsla(hue, sat, 58, softFillAlpha(0.22))
  ctx.fill()
  if (!flat) {
    ctx.strokeStyle = hsla(hue, sat, skin.dark ? 62 : 40, 0.95)
    ctx.lineWidth = lineW
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  if (scared) {
    ctx.strokeStyle = flash ? hsla(8, 60, 30, 0.9) : hsla(210, 30, 70, 0.9)
    ctx.lineWidth = Math.max(1, cell * 0.045)
    ctx.beginPath()
    ctx.moveTo(cx - cell * 0.16, cy + cell * 0.1)
    ctx.quadraticCurveTo(cx, cy + cell * 0.2, cx + cell * 0.16, cy + cell * 0.1)
    ctx.stroke()
  }

  if (asleep) {
    // Shut eyes — the one mark that says "not yet" at a glance.
    ctx.strokeStyle = hsla(hue, sat, skin.dark ? 70 : 34, 0.85)
    ctx.lineWidth = Math.max(1, cell * 0.05)
    ctx.lineCap = 'round'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx + side * cell * 0.13 - cell * 0.06, cy - cell * 0.03)
      ctx.quadraticCurveTo(
        cx + side * cell * 0.13,
        cy + cell * 0.03,
        cx + side * cell * 0.13 + cell * 0.06,
        cy - cell * 0.03,
      )
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
  }
  ctx.globalAlpha = 1
}

/**
 * The tide.
 *
 * It lives just under the view while you are making ground, so most runs only
 * ever see the glow that warns it is about to move. Once it is climbing it has
 * to be unambiguous — a surface with a waterline, not a vignette — because the
 * only correct response to seeing it is to stop what you are doing and climb.
 */
function drawTide(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
  w: number,
  h: number,
  skin: Skin,
) {
  const { cell, rowY } = layout
  const surface = rowY(bufferRowOf(state, state.tide))
  const heat = tidePressure(state)

  if (surface > h + cell && heat <= 0.01) return

  const top = Math.min(surface, h + cell)
  const glow = ctx.createLinearGradient(0, top - cell * 3, 0, top)
  glow.addColorStop(0, 'rgba(232, 93, 117, 0)')
  glow.addColorStop(1, `rgba(232, 93, 117, ${0.1 + heat * 0.3})`)
  ctx.fillStyle = glow
  ctx.fillRect(0, top - cell * 3, w, cell * 3)

  if (top >= h) return

  ctx.fillStyle = skin.dark ? 'rgba(12, 6, 12, 0.88)' : 'rgba(60, 12, 24, 0.58)'
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(0, top)
  const teeth = Math.max(8, Math.round(state.cols * 1.5))
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * w
    const swell = Math.sin(i * 1.1 + state.time * 2.6) * cell * 0.1
    ctx.lineTo(x, top + swell)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = skin.edge
  ctx.globalAlpha = 0.5 + heat * 0.5
  ctx.lineWidth = Math.max(1.5, cell * 0.06)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawPops(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
  skin: Skin,
) {
  if (!state.pops.length) return
  const { cell, rowY } = layout
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${Math.max(11, Math.round(cell * 0.52))}px "Segoe UI", system-ui, sans-serif`
  for (const pop of state.pops) {
    const t = 1 - pop.life / 0.9
    ctx.globalAlpha = Math.max(0, pop.life / 0.9)
    ctx.fillStyle = skin.ink
    ctx.fillText(pop.text, pop.x * cell, rowY(pop.y) - t * cell * 0.9)
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
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.canvas.style.width = `${w}px`
    ctx.canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const skin = skinFor(isDarkTheme())
  const layout = computeLayout(w, h, state)

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  drawMilestones(ctx, state, layout, skin)
  drawWalls(ctx, state, layout, skin)
  drawCrumbs(ctx, state, layout, skin)
  drawFruit(ctx, state, layout, skin)

  /*
   * Anything straddling the side seam is drawn twice, once on each edge.
   * Positions live on a torus, so an actor halfway through the wrap is
   * genuinely half off one side and half onto the other — one draw would
   * show it sliding off the board and reappearing a frame later.
   */
  const span = state.cols * layout.cell
  const seams = (x: number) => (x < 1 ? [0, span] : x > state.cols - 1 ? [0, -span] : [0])

  for (const ghost of state.ghosts) {
    for (const dx of seams(ghost.x)) {
      ctx.save()
      ctx.translate(dx, 0)
      drawChaser(ctx, ghost, layout, skin, state.fright, state.time)
      ctx.restore()
    }
  }
  for (const dx of seams(state.player.x)) {
    ctx.save()
    ctx.translate(dx, 0)
    drawPlayer(ctx, state, layout, skin)
    ctx.restore()
  }
  drawPops(ctx, state, layout, skin)
  drawTide(ctx, state, layout, w, h, skin)

}
