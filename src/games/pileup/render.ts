import { PALETTE } from '../../data/games'
import { mixColor } from '../../lib/color'
import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'
import { drawEyes } from '../eyes'
import {
  CLEAR_TIME,
  COLS,
  HIDDEN,
  RATTLE_TIME,
  ROWS,
  SHAPES,
  TOPOUT_TIME,
  TOTAL,
  landingY,
  pileTop,
  settleDrop,
  type FloaterTone,
  type GameState,
  type Kind,
  type Piece,
} from './game'
import { pileLayout, type Box, type Layout } from './layout'

/*
 * The well, drawn the arcade's way: every piece one rounded shape in a soft
 * wash of its own colour, outlined round the outside, with faint seams so its
 * blocks can still be counted. A row that clears splits as it goes, and a
 * piece keeps its shape until a clear or a Shake breaks it up.
 *
 * The falling piece has eyes. It watches where it's going to land, glances the
 * way it was pushed, blinks now and then; the ones waiting their turn in the
 * boxes are asleep. Where it will land is a dashed outline of it.
 *
 * Seven colours of the arcade's ten: the long one pink, the square amber, T
 * violet, S green, Z orange, J sky and L red. The well is the page's own
 * ground, a step darker in the dark theme and a step lighter in the light.
 */

const TAU = Math.PI * 2
const FONT = 'Outfit, system-ui, sans-serif'

/** By kind: the long one, the square, T, S, Z, J, L. */
const HUES: readonly string[] = [
  PALETTE.pink,
  PALETTE.amber,
  PALETTE.violet,
  PALETTE.green,
  PALETTE.orange,
  PALETTE.sky,
  PALETTE.red,
]

type Tones = {
  fill: string
  line: string
  seam: string
  shine: string
}

let toneCache: { key: string; tones: Tones[] } | null = null

function tonesFor(dark: boolean, ground: string): Tones[] {
  const key = `${dark}:${ground}`
  if (toneCache?.key === key) return toneCache.tones
  const tones = HUES.map((hue) =>
    dark
      ? {
          fill: mixColor(hue, ground, 0.28),
          line: mixColor(hue, '#ffffff', 0.5),
          seam: mixColor(hue, ground, 0.55),
          shine: 'rgba(255, 255, 255, 0.3)',
        }
      : {
          fill: mixColor(hue, '#ffffff', 0.4),
          line: mixColor(hue, '#1a2b3c', 0.45),
          seam: mixColor(hue, '#1a2b3c', 0.12),
          shine: 'rgba(255, 255, 255, 0.75)',
        },
  )
  toneCache = { key, tones }
  return tones
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function ease(t: number) {
  const k = clamp01(t)
  return k * k * (3 - 2 * k)
}

/** A steady number from a cell, for anything that should look random but hold still from frame to frame. */
function hash(x: number, y: number, salt = 0) {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
  return v - Math.floor(v)
}

type View = {
  ctx: CanvasRenderingContext2D
  s: GameState
  dark: boolean
  ground: string
  ink: string
  tones: Tones[]
  L: Layout
  /** Pixels a cell. */
  c: number
  /** Where row 0, column 0 is drawn: HIDDEN rows over the well's top. */
  ox: number
  oy: number
}

type CellAt = { x: number; y: number }

type ShapeOpts = {
  alpha?: number
  /** 0–1 of white over it: a piece just locked, a row about to go. */
  flash?: number
  /** Only the outline, dashed: where the piece will land. */
  ghost?: boolean
  /** The whole shape moved by this many pixels. */
  dx?: number
  dy?: number
}

const key = (x: number, y: number) => (y + 8) * 64 + x

/**
 * Cells as one piece, at `c` pixels a cell from (ox, oy): rounded where it
 * turns outward, an outline round the outside a hair in from the edge, so two
 * pieces side by side keep a line of the well between them, and seams inside.
 */
function drawShape(
  ctx: CanvasRenderingContext2D,
  cells: readonly CellAt[],
  tone: Tones,
  ox: number,
  oy: number,
  c: number,
  o: ShapeOpts = {},
) {
  if (!cells.length) return
  const set = new Set<number>()
  for (const cell of cells) set.add(key(cell.x, Math.round(cell.y)))
  const has = (x: number, y: number) => set.has(key(x, y))
  const ins = Math.max(0.75, c * 0.035)
  const r = c * 0.24
  const lw = Math.max(1, c * 0.07)
  const fill = new Path2D()
  const line = new Path2D()
  const seam = new Path2D()
  const shine = new Path2D()
  const dx = o.dx ?? 0
  const dy = o.dy ?? 0

  for (const cell of cells) {
    const x = cell.x
    const y = Math.round(cell.y)
    const px = ox + cell.x * c + dx
    const py = oy + cell.y * c + dy
    const T = !has(x, y - 1)
    const B = !has(x, y + 1)
    const Lf = !has(x - 1, y)
    const R = !has(x + 1, y)
    const x0 = px + (Lf ? ins : 0)
    const x1 = px + c - (R ? ins : 0)
    const y0 = py + (T ? ins : 0)
    const y1 = py + c - (B ? ins : 0)
    const tl = T && Lf ? r : 0
    const tr = T && R ? r : 0
    const br = B && R ? r : 0
    const bl = B && Lf ? r : 0

    fill.moveTo(x0 + tl, y0)
    fill.lineTo(x1 - tr, y0)
    if (tr) fill.arcTo(x1, y0, x1, y0 + tr, tr)
    fill.lineTo(x1, y1 - br)
    if (br) fill.arcTo(x1, y1, x1 - br, y1, br)
    fill.lineTo(x0 + bl, y1)
    if (bl) fill.arcTo(x0, y1, x0, y1 - bl, bl)
    fill.lineTo(x0, y0 + tl)
    if (tl) fill.arcTo(x0, y0, x0 + tl, y0, tl)
    fill.closePath()

    // Each open side, run on into a corner where the piece turns inward so the outline meets itself.
    if (T) {
      const a = Lf ? x0 + tl : has(x - 1, y - 1) ? px - ins : px
      const b = R ? x1 - tr : has(x + 1, y - 1) ? px + c + ins : px + c
      line.moveTo(a, y0)
      line.lineTo(b, y0)
      shine.moveTo(Lf ? x0 + r * 0.9 : px, y0 + lw * 1.5)
      shine.lineTo(R ? x1 - r * 0.9 : px + c, y0 + lw * 1.5)
    }
    if (R) {
      const a = T ? y0 + tr : has(x + 1, y - 1) ? py - ins : py
      const b = B ? y1 - br : has(x + 1, y + 1) ? py + c + ins : py + c
      line.moveTo(x1, a)
      line.lineTo(x1, b)
    } else {
      seam.moveTo(px + c, py + c * 0.22)
      seam.lineTo(px + c, py + c * 0.78)
    }
    if (B) {
      const a = Lf ? x0 + bl : has(x - 1, y + 1) ? px - ins : px
      const b = R ? x1 - br : has(x + 1, y + 1) ? px + c + ins : px + c
      line.moveTo(a, y1)
      line.lineTo(b, y1)
    } else {
      seam.moveTo(px + c * 0.22, py + c)
      seam.lineTo(px + c * 0.78, py + c)
    }
    if (Lf) {
      const a = T ? y0 + tl : has(x - 1, y - 1) ? py - ins : py
      const b = B ? y1 - bl : has(x - 1, y + 1) ? py + c + ins : py + c
      line.moveTo(x0, a)
      line.lineTo(x0, b)
    }
    if (tl) {
      line.moveTo(x0, y0 + tl)
      line.arcTo(x0, y0, x0 + tl, y0, tl)
    }
    if (tr) {
      line.moveTo(x1 - tr, y0)
      line.arcTo(x1, y0, x1, y0 + tr, tr)
    }
    if (br) {
      line.moveTo(x1, y1 - br)
      line.arcTo(x1, y1, x1 - br, y1, br)
    }
    if (bl) {
      line.moveTo(x0 + bl, y1)
      line.arcTo(x0, y1, x0, y1 - bl, bl)
    }
  }

  ctx.save()
  ctx.globalAlpha *= o.alpha ?? 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (o.ghost) {
    ctx.fillStyle = tone.line
    ctx.globalAlpha *= 0.08
    ctx.fill(fill)
    ctx.globalAlpha /= 0.08
    ctx.setLineDash([c * 0.2, c * 0.14])
    ctx.strokeStyle = tone.line
    ctx.lineWidth = lw
    ctx.globalAlpha *= 0.62
    ctx.stroke(line)
    ctx.restore()
    return
  }
  ctx.fillStyle = tone.fill
  ctx.fill(fill)
  ctx.strokeStyle = tone.seam
  ctx.lineWidth = Math.max(1, c * 0.035)
  ctx.globalAlpha *= 0.55
  ctx.stroke(seam)
  ctx.globalAlpha /= 0.55
  ctx.strokeStyle = tone.shine
  ctx.lineWidth = Math.max(1, c * 0.05)
  ctx.stroke(shine)
  if (o.flash) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * clamp01(o.flash)})`
    ctx.fill(fill)
  }
  ctx.strokeStyle = tone.line
  ctx.lineWidth = lw
  ctx.stroke(line)
  ctx.restore()
}

function pieceCells(p: Piece, y = p.y): CellAt[] {
  return SHAPES[p.kind]![p.rot]!.map(([cx, cy]) => ({ x: p.x + cx, y: y + cy }))
}

/** The middle of a piece's blocks, in cells: where its eyes go. */
function middleOf(cells: readonly CellAt[]) {
  let x = 0
  let y = 0
  for (const c of cells) {
    x += c.x + 0.5
    y += c.y + 0.5
  }
  return { x: x / cells.length, y: y / cells.length }
}

type EyeLook = { look?: { x: number; y: number }; closed?: boolean; dead?: string }

function eyesOn(v: View, cells: readonly CellAt[], ox: number, oy: number, c: number, tone: Tones, e: EyeLook) {
  const m = middleOf(cells)
  // drawEyes sits a face looking down a little under its middle; this puts the pair on the piece's.
  const span = c * 0.56
  drawEyes(v.ctx, {
    x: ox + m.x * c,
    y: oy + m.y * c - span * 0.36 - c * 0.04,
    rx: span,
    ry: span,
    radius: c * 0.15,
    facing: 'down',
    look: e.look,
    line: tone.line,
    closed: e.closed,
    dead: e.dead,
  })
}

// ——————————————————————————————————————————————————————————— the room

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/**
 * Big faint outlines of the pieces drifting up behind everything, so the room
 * round the well is the game's and not a blank page.
 */
function drawBackdrop(v: View, w: number, h: number) {
  const { ctx, s, dark, ground } = v
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, w, h)
  // A soft fall of light from the top, in flat bands: a gradient over the whole canvas costs more than the game.
  const glow = dark ? mixColor(ground, '#3b4a8a', 0.5) : mixColor(ground, '#ffffff', 0.9)
  const bands = 24
  const reach = h * 0.6
  for (let i = 0; i < bands; i++) {
    const t = 1 - i / bands
    ctx.fillStyle = mixColor(ground, glow, (dark ? 0.35 : 0.6) * t * t)
    ctx.fillRect(0, Math.floor((i * reach) / bands), w, Math.ceil(reach / bands) + 1)
  }
  // Tilted and soft, so they read as the room's and never as a box waiting for a piece.
  const big = Math.max(18, Math.min(w, h) * 0.07)
  for (let i = 0; i < 9; i++) {
    const kind = (i % 7) as Kind
    const speed = 6 + hash(i, 3) * 8
    const span = h + big * 6
    const x = hash(i, 1) * w
    const y = h + big * 2 - ((hash(i, 2) * span + s.time * speed) % span)
    const turn = Math.floor(hash(i, 4) * 4)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((hash(i, 5) - 0.5) * 0.9 + s.time * 0.05 * (hash(i, 6) - 0.5))
    ctx.globalAlpha = dark ? 0.06 : 0.09
    ctx.fillStyle = HUES[kind]!
    ctx.beginPath()
    for (const [cx, cy] of SHAPES[kind]![turn]!) {
      ctx.roundRect((cx - 1.5) * big, (cy - 1) * big, big * 0.94, big * 0.94, big * 0.24)
    }
    ctx.fill()
    ctx.restore()
  }
}

/** The well: a panel a step off the ground, dots where the cells meet, and a red glow at the brim when the pile is near it. */
function drawWell(v: View, well: Box, shiftX: number) {
  const { ctx, dark, ground, ink, s, c } = v
  const x = well.x + shiftX
  const pad = Math.max(3, c * 0.12)
  ctx.save()
  roundRect(ctx, x - pad, well.y - pad, well.w + pad * 2, well.h + pad * 2, c * 0.32)
  ctx.fillStyle = dark ? mixColor(ground, '#000000', 0.32) : mixColor(ground, '#ffffff', 0.7)
  ctx.fill()
  ctx.strokeStyle = ink
  ctx.globalAlpha = dark ? 0.16 : 0.14
  ctx.lineWidth = Math.max(1.2, c * 0.05)
  ctx.stroke()
  ctx.globalAlpha = dark ? 0.14 : 0.16
  ctx.fillStyle = ink
  ctx.beginPath()
  const dot = Math.max(0.8, c * 0.045)
  for (let gx = 1; gx < COLS; gx++) {
    for (let gy = 1; gy < ROWS; gy++) {
      ctx.moveTo(x + gx * c + dot, well.y + gy * c)
      ctx.arc(x + gx * c, well.y + gy * c, dot, 0, TAU)
    }
  }
  ctx.fill()
  ctx.restore()

  if (s.phase === 'playing' && pileTop(s) <= HIDDEN + 3) {
    const pulse = 0.55 + 0.45 * Math.sin(s.time * 7)
    ctx.save()
    roundRect(ctx, x, well.y, well.w, well.h, c * 0.2)
    ctx.clip()
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(232, 86, 79, ${(0.1 - i * 0.015) * pulse})`
      ctx.fillRect(x, well.y, well.w, c * (0.5 + i * 0.45))
    }
    ctx.restore()
  }
}

// ——————————————————————————————————————————————————————————— the pile

/** Cells by the piece they came from. */
function groups(grid: Uint8Array, ids: Int32Array, skip?: (x: number, y: number) => boolean) {
  const out = new Map<number, { kind: Kind; cells: CellAt[] }>()
  for (let y = 0; y < TOTAL; y++) {
    for (let x = 0; x < COLS; x++) {
      const k = grid[y * COLS + x]!
      if (!k || skip?.(x, y)) continue
      const id = ids[y * COLS + x]!
      let g = out.get(id)
      if (!g) {
        g = { kind: (k - 1) as Kind, cells: [] }
        out.set(id, g)
      }
      g.cells.push({ x, y })
    }
  }
  return out
}

function drawPile(v: View, shiftX: number) {
  const { ctx, s, c, ox, oy } = v
  const settle = s.settle
  if (settle && settle.t < RATTLE_TIME) {
    // The rattle: the pile as it stood, shaking in its well before it drops.
    const k = settle.t / RATTLE_TIME
    const jx = Math.sin(settle.t * 90) * c * 0.08 * (1 - k * 0.4)
    const jy = Math.cos(settle.t * 70) * c * 0.03
    for (const g of groups(settle.grid, settle.ids).values()) {
      drawShape(ctx, g.cells, v.tones[g.kind]!, ox + shiftX, oy, c, { dx: jx, dy: jy })
    }
    return
  }
  if (settle) {
    const falling = new Set<number>()
    for (const f of settle.falls) {
      if (settleDrop(f, settle.t) < f.to - f.from) falling.add(key(f.x, f.to))
    }
    for (const g of groups(s.grid, s.ids, (x, y) => falling.has(key(x, y))).values()) {
      drawShape(ctx, g.cells, v.tones[g.kind]!, ox + shiftX, oy, c)
    }
    for (const f of settle.falls) {
      const d = settleDrop(f, settle.t)
      if (d >= f.to - f.from) continue
      drawShape(ctx, [{ x: f.x, y: f.from + d }], v.tones[f.kind]!, ox + shiftX, oy, c)
    }
    return
  }

  const clearing = s.clearing
  const k = clearing ? clearing.t / CLEAR_TIME : 0
  const gone = clearing && k >= 0.45 ? new Set(clearing.rows) : null
  const flashId = s.locked && s.time - s.locked.t < 0.16 ? s.locked.id : -1
  const flashK = flashId >= 0 ? 1 - (s.time - s.locked!.t) / 0.16 : 0
  for (const [id, g] of groups(s.grid, s.ids, gone ? (_x, y) => gone.has(y) : undefined)) {
    drawShape(ctx, g.cells, v.tones[g.kind]!, ox + shiftX, oy, c, { flash: id === flashId ? flashK : 0 })
  }

  if (clearing) {
    // Full rows go white, then close up to a line and are gone.
    for (const row of clearing.rows) {
      const top = oy + row * c
      if (k < 0.45) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * ease(k / 0.45)})`
        ctx.fillRect(ox + shiftX, top, COLS * c, c)
      } else {
        const t = (k - 0.45) / 0.55
        const hgt = c * (1 - ease(t))
        ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - t * 0.6)})`
        roundRect(ctx, ox + shiftX - c * 0.1 * t, top + (c - hgt) / 2, COLS * c + c * 0.2 * t, Math.max(1, hgt), hgt / 2)
        ctx.fill()
      }
    }
  }
}

/** The end: the piece that wouldn't fit crossed out, a beat, then the whole pile drops out of the bottom of the well. */
function drawTopOut(v: View, shiftX: number) {
  const { ctx, s, c, ox, oy } = v
  const t = s.phase === 'gameover' ? TOPOUT_TIME : s.overT
  const beat = 0.45
  const red = t < beat ? 0.5 + 0.5 * Math.sin(t * 22) : 0
  if (t < beat) {
    for (const g of groups(s.grid, s.ids).values()) {
      drawShape(ctx, g.cells, v.tones[g.kind]!, ox + shiftX, oy, c, { flash: red * 0.35 })
    }
  } else {
    for (let y = 0; y < TOTAL; y++) {
      for (let x = 0; x < COLS; x++) {
        const k = s.grid[y * COLS + x]!
        if (!k) continue
        const delay = beat + (TOTAL - 1 - y) * 0.03 + hash(x, y) * 0.06
        const f = Math.max(0, t - delay)
        const drop = 0.5 * 60 * f * f
        if (drop > TOTAL) continue
        const spin = (hash(x, y, 2) - 0.5) * 3 * f
        const cx = ox + shiftX + (x + 0.5) * c
        const cy = oy + (y + 0.5 + drop) * c
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(spin)
        drawShape(ctx, [{ x: 0, y: 0 }], v.tones[k - 1]!, -c / 2, -c / 2, c)
        ctx.restore()
      }
    }
  }
  const stuck = s.stuck
  if (stuck && t < beat + 0.5) {
    const cells = pieceCells(stuck)
    const tone = v.tones[stuck.kind]!
    const lift = t < beat ? 0 : (t - beat) * c * 6
    drawShape(ctx, cells, tone, ox + shiftX, oy - lift, c, { alpha: 1 - clamp01((t - beat) / 0.5), flash: red * 0.4 })
    eyesOn(v, cells, ox + shiftX, oy - lift, c, tone, { dead: v.dark ? '#ffffff' : '#1a2b3c' })
  }
}

// ——————————————————————————————————————————————————————————— the piece

function drawTrails(v: View, shiftX: number) {
  const { ctx, s, c, ox, oy } = v
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1, c * 0.07)
  for (const trail of s.trails) {
    ctx.strokeStyle = v.tones[trail.kind]!.line
    for (const col of trail.cells) {
      // Two speed lines down each column it fell, brightest just over where it landed, gone towards the top.
      const top = oy + col.top * c
      const bottom = oy + col.bottom * c - c * 0.15
      const span = bottom - top
      if (span <= 0) continue
      for (const across of [0.32, 0.68]) {
        const x = ox + shiftX + (col.x + across) * c
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = trail.life * (0.08 + i * 0.12)
          ctx.beginPath()
          ctx.moveTo(x, top + (span * i) / 4)
          ctx.lineTo(x, top + (span * (i + 1)) / 4)
          ctx.stroke()
        }
      }
    }
  }
  ctx.restore()
}

/** The piece a Shake sent back up, hovering where it came in while the pile settles under it. */
function drawWaiting(v: View, shiftX: number) {
  const { ctx, s, c, ox, oy } = v
  if (s.waiting === null || s.phase !== 'playing') return
  const p: Piece = { kind: s.waiting, rot: 0, x: s.waiting === 1 ? 4 : 3, y: HIDDEN }
  const bob = Math.sin(s.time * 5) * 0.08
  const cells = pieceCells(p, p.y + bob)
  const tone = v.tones[p.kind]!
  drawShape(ctx, cells, tone, ox + shiftX, oy, c, { alpha: 0.85 })
  eyesOn(v, cells, ox + shiftX, oy, c, tone, { look: { x: 0, y: 1 } })
}

function drawPiece(v: View, shiftX: number) {
  const { ctx, s, c, ox, oy, L } = v
  const p = s.piece
  if (!p || s.clearing || s.settle) {
    drawWaiting(v, shiftX)
    return
  }
  const tone = v.tones[p.kind]!
  const menu = s.phase === 'menu'
  const bob = menu ? Math.sin(s.time * 2.2) * 0.12 : 0
  ctx.save()
  // A piece coming in shows below the brim only, as if it came from behind it.
  ctx.beginPath()
  ctx.rect(L.well.x + shiftX - c, L.well.y, L.well.w + c * 2, L.well.h + c)
  ctx.clip()
  if (!menu) {
    const ghostY = landingY(s, p)
    if (ghostY > p.y) drawShape(ctx, pieceCells(p, ghostY), tone, ox + shiftX, oy, c, { ghost: true })
  }
  const cells = pieceCells(p, p.y + bob)
  drawShape(ctx, cells, tone, ox + shiftX, oy, c)
  const glance = s.time - s.lookT < 0.4
  const blink = (s.time % 3.6) < 0.12
  eyesOn(v, cells, ox + shiftX, oy, c, tone, {
    look: glance ? { x: s.lookX, y: 0.35 } : { x: 0, y: 1 },
    closed: blink,
  })
  ctx.restore()
}

// ——————————————————————————————————————————————————————————— the boxes

function drawPanel(v: View, box: Box, label: string) {
  const { ctx, dark, ground, ink, c } = v
  ctx.save()
  roundRect(ctx, box.x, box.y, box.w, box.h, Math.min(box.h * 0.22, c * 0.4))
  ctx.fillStyle = dark ? mixColor(ground, '#ffffff', 0.05) : mixColor(ground, '#ffffff', 0.65)
  ctx.fill()
  ctx.strokeStyle = ink
  ctx.globalAlpha = dark ? 0.14 : 0.12
  ctx.lineWidth = Math.max(1, c * 0.04)
  ctx.stroke()
  if (label) {
    ctx.globalAlpha = dark ? 0.55 : 0.5
    ctx.fillStyle = ink
    ctx.font = `800 ${Math.round(Math.max(8, Math.min(11, box.h * 0.15)))}px ${FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(label, box.x + Math.max(5, box.w * 0.08), box.y + Math.max(4, box.h * 0.08))
  }
  ctx.restore()
}

/** A piece asleep in a box, sized to fit it, a little under the box's middle to clear its label. */
function drawBoxed(v: View, box: Box, kind: Kind, dim: boolean, labelled: boolean) {
  const shape = SHAPES[kind]![0]!
  const xs = shape.map(([x]) => x)
  const ys = shape.map(([, y]) => y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const bw = Math.max(...xs) - minX + 1
  const bh = Math.max(...ys) - minY + 1
  const room = labelled ? box.h * 0.16 : 0
  const mini = Math.min((box.w * 0.78) / 4, ((box.h - room) * 0.74) / 2, v.c * 0.9)
  const ox = box.x + (box.w - bw * mini) / 2 - minX * mini
  const oy = box.y + room + (box.h - room - bh * mini) / 2 - minY * mini
  const cells = shape.map(([x, y]) => ({ x, y }))
  const tone = v.tones[kind]!
  const alpha = dim ? 0.4 : 1
  drawShape(v.ctx, cells, tone, ox, oy, mini, { alpha })
  v.ctx.save()
  v.ctx.globalAlpha = alpha
  eyesOn(v, cells, ox, oy, mini, tone, { closed: true })
  v.ctx.restore()
}

function drawBoxes(v: View) {
  const { s, L } = v
  const playing = s.phase === 'playing' || s.phase === 'topout'
  drawPanel(v, L.hold, 'HOLD')
  if (s.hold !== null && playing) drawBoxed(v, L.hold, s.hold, s.held, true)
  L.next.forEach((box, i) => {
    drawPanel(v, box, i === 0 ? 'NEXT' : '')
    const kind = s.queue[i]
    if (kind !== undefined && playing) drawBoxed(v, box, kind, false, i === 0)
  })
}

// ——————————————————————————————————————————————————————————— words and sparks

const TONE_COLOUR: Record<FloaterTone, readonly [string, string]> = {
  // [dark theme, light theme]
  rows: ['#e7eef3', '#1a2b3c'],
  combo: ['#5fdde3', '#16848a'],
  big: ['#ffd36b', '#b07a10'],
  level: ['#5fe0a6', '#178a57'],
  shake: ['#ff8fbe', '#c23a76'],
}

function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, colour: string, ground: string) {
  ctx.font = `800 ${Math.round(size)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = ground
  ctx.lineWidth = Math.max(3, size * 0.28)
  ctx.strokeText(text, x, y)
  ctx.fillStyle = colour
  ctx.fillText(text, x, y)
}

function drawFloaters(v: View, shiftX: number) {
  const { ctx, s, c, ox, oy, dark, ground } = v
  for (const f of s.floaters) {
    const t = 1 - f.life
    const x = ox + shiftX + f.x * c
    const y = oy + f.y * c - t * c * 0.9
    const pop = t < 0.12 ? 0.7 + (t / 0.12) * 0.3 : 1
    ctx.globalAlpha = clamp01(f.life * 2.2)
    const colour = TONE_COLOUR[f.tone][dark ? 0 : 1]
    const big = f.tone === 'big' || f.tone === 'shake'
    haloText(ctx, f.text, x, y, c * (big ? 0.72 : 0.56) * pop, colour, ground)
    if (f.sub) haloText(ctx, f.sub, x, y + c * 0.62, c * 0.38 * pop, colour, ground)
  }
  ctx.globalAlpha = 1
}

function drawBits(v: View, shiftX: number) {
  const { ctx, s, c, ox, oy } = v
  for (const b of s.bits) {
    const tone = v.tones[b.kind]!
    const size = b.size * c
    ctx.globalAlpha = clamp01(b.life / b.max)
    ctx.fillStyle = tone.fill
    ctx.strokeStyle = tone.line
    ctx.lineWidth = Math.max(1, c * 0.03)
    roundRect(ctx, ox + shiftX + b.x * c - size / 2, oy + b.y * c - size / 2, size, size, size * 0.3)
    ctx.fill()
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ——————————————————————————————————————————————————————————— render

/**
 * One frame, into a context already set to CSS pixels. Without a layout it
 * lays itself out for a canvas with nothing over it (a cabinet's preview).
 */
export function renderGame(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number, layout?: Layout) {
  const L = layout ?? pileLayout(w, h, 8, 8)
  const dark = isDarkTheme()
  const ground = playfieldColor()
  const c = L.cell
  const bump = s.bump * c * 0.08
  const v: View = {
    ctx,
    s,
    dark,
    ground,
    ink: inkColor(),
    tones: tonesFor(dark, ground),
    L,
    c,
    ox: L.well.x,
    oy: L.well.y - HIDDEN * c + bump,
  }

  drawBackdrop(v, w, h)
  // The whole well jumps with the rattle of a Shake.
  const rattle = s.settle && s.settle.t < RATTLE_TIME ? Math.sin(s.settle.t * 90) * c * 0.06 : 0
  drawWell(v, { ...L.well, y: L.well.y + bump }, rattle)
  drawBoxes(v)

  ctx.save()
  ctx.beginPath()
  ctx.rect(L.well.x - c * 0.5, L.well.y + bump, L.well.w + c, L.well.h + c * 0.5)
  ctx.clip()
  if (s.phase === 'topout' || s.phase === 'gameover') drawTopOut(v, 0)
  else drawPile(v, 0)
  drawTrails(v, 0)
  ctx.restore()

  drawPiece(v, 0)
  // Sparks keep to the well and a little over its brim: loose ones round the panels read as litter.
  ctx.save()
  ctx.beginPath()
  ctx.rect(L.well.x - c * 0.3, L.well.y - c * 1.5, L.well.w + c * 0.6, L.well.h + c * 1.5)
  ctx.clip()
  drawBits(v, 0)
  ctx.restore()
  drawFloaters(v, 0)
}
