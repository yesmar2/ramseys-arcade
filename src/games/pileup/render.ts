import { PALETTE } from '../../data/games'
import { mixColor, withAlpha } from '../../lib/color'
import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'
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
 * Where the falling piece will land is a dashed outline of it. The pieces have
 * no faces: Ramsey asked for the eyes off them (2026-10-06).
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

/*
 * Skins (lib/skins.ts) restyle the player's pieces, wherever drawShape draws
 * them: the pile, the falling piece and where it will land, the hold and next
 * boxes, and the bits a Shake knocks loose. Looks only. Each kind keeps its
 * own colour in every skin, as players read a piece by its colour as much as
 * by its shape. Season 2 (Cold Snap):
 *
 * - Ice cubes: clear ice faintly tinted the kind's colour, a frosty outline,
 *   a frosted glint in each block's corner and a bubble or two.
 * - Knitted: the kind's colour in jumper wool, rows of little V stitches, a
 *   darker edge, and a white snowflake stitched on one block of each piece.
 * - Northern lights: night-blue pieces, faintly the kind's colour, outlined
 *   in the aurora (green into cyan into violet), green light rising in each
 *   block and a star here and there.
 *
 * A skin's block (the ice's sheen and glint, the knit, the aurora's light) is
 * a pattern made once per kind and cell size, so a frame costs about what the
 * usual look does. The aurora's glow is a wide faint stroke under the
 * outline, never a shadow blur.
 */
type Look = 'plain' | 'ice' | 'knit' | 'aurora'

const LOOKS: Record<string, Look> = {
  'pileup-ice-cubes': 'ice',
  'pileup-knitted': 'knit',
  'pileup-northern-lights': 'aurora',
}

const AURORA = ['#5cf2b0', '#46e4ff', '#9b7bff'] as const

type Tones = {
  look: Look
  kind: Kind
  dark: boolean
  fill: string
  line: string
  seam: string
  /** The light along a piece's top; empty for none. */
  shine: string
  /** Where the piece will land, and the speed lines of a hard drop. */
  ghost: string
  /** A second, thinner line just inside the outline: the frost on ice in the light theme. */
  rim?: string
  /** Ice's corner glints, the knit's stitches, the aurora's stars. */
  deco?: string
  /** Ice's bubbles, the shade under the knit's stitches, the aurora's light. */
  deco2?: string
}

/** By theme, ground and look: a cabinet's preview in the usual look can run beside a game in a skin. */
const toneCache = new Map<string, Tones[]>()

function tonesFor(dark: boolean, ground: string, look: Look): Tones[] {
  const key = `${dark}:${ground}:${look}`
  const kept = toneCache.get(key)
  if (kept) return kept
  if (toneCache.size > 16) toneCache.clear()
  const tones = HUES.map((hue, i): Tones => {
    const kind = i as Kind
    if (look === 'ice') {
      // Cold clear blue, taking enough of the kind's colour to tell it by.
      const ice = mixColor('#b4e4fb', hue, dark ? 0.58 : 0.5)
      return dark
        ? {
            look,
            kind,
            dark,
            fill: mixColor(ice, ground, 0.24),
            line: mixColor('#f2fbff', hue, 0.15),
            seam: mixColor(ice, '#ffffff', 0.5),
            shine: '',
            ghost: mixColor('#e6f7ff', hue, 0.25),
            deco: 'rgba(255, 255, 255, 0.7)',
            deco2: 'rgba(255, 255, 255, 0.5)',
          }
        : {
            look,
            kind,
            dark,
            fill: mixColor(ice, '#ffffff', 0.35),
            line: mixColor('#4f7f9f', hue, 0.3),
            seam: mixColor('#4f7f9f', '#ffffff', 0.3),
            shine: '',
            ghost: mixColor('#4f7f9f', hue, 0.3),
            rim: 'rgba(255, 255, 255, 0.95)',
            deco: 'rgba(255, 255, 255, 0.95)',
            deco2: mixColor('#4f7f9f', hue, 0.2),
          }
    }
    if (look === 'knit') {
      return {
        look,
        kind,
        dark,
        fill: dark ? mixColor(hue, ground, 0.08) : hue,
        line: mixColor(hue, '#1a1020', 0.42),
        seam: mixColor(hue, '#1a1020', 0.3),
        shine: '',
        ghost: dark ? mixColor(hue, '#ffffff', 0.25) : mixColor(hue, '#1a1020', 0.25),
        deco: mixColor(hue, '#ffffff', 0.4),
        deco2: mixColor(hue, '#1a1020', 0.22),
      }
    }
    if (look === 'aurora') {
      return {
        look,
        kind,
        dark,
        fill: mixColor('#0c1834', hue, 0.12),
        line: AURORA[0],
        seam: 'rgba(92, 242, 176, 0.55)',
        shine: 'rgba(200, 255, 236, 0.22)',
        ghost: dark ? AURORA[1] : '#1aa6c4',
        deco: '#ffffff',
        // The light in the blocks: the kind's colour, drawn a little toward the aurora's green.
        deco2: mixColor(mixColor(hue, AURORA[0], 0.15), '#ffffff', 0.22),
      }
    }
    return dark
      ? {
          look,
          kind,
          dark,
          fill: mixColor(hue, ground, 0.28),
          line: mixColor(hue, '#ffffff', 0.5),
          seam: mixColor(hue, ground, 0.55),
          shine: 'rgba(255, 255, 255, 0.3)',
          ghost: mixColor(hue, '#ffffff', 0.5),
        }
      : {
          look,
          kind,
          dark,
          fill: mixColor(hue, '#ffffff', 0.4),
          line: mixColor(hue, '#1a2b3c', 0.45),
          seam: mixColor(hue, '#1a2b3c', 0.12),
          shine: 'rgba(255, 255, 255, 0.75)',
          ghost: mixColor(hue, '#1a2b3c', 0.45),
        }
  })
  toneCache.set(key, tones)
  return tones
}

/** One block of a skin, `px` device pixels square, made once and kept. */
const tiles = new Map<string, CanvasPattern | null>()

function tileFor(ctx: CanvasRenderingContext2D, tone: Tones, px: number): CanvasPattern | null {
  const id = `${tone.look}:${tone.kind}:${tone.dark}:${px}`
  if (tiles.has(id)) return tiles.get(id)!
  // Sizes come and go as the window does; a handful is all a page uses at once.
  if (tiles.size > 48) tiles.clear()
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const g = canvas.getContext('2d')
  let pattern: CanvasPattern | null = null
  if (g) {
    g.fillStyle = tone.fill
    g.fillRect(0, 0, px, px)
    if (tone.look === 'knit') {
      // Four rows of four Vs, each over a darker one a little lower, so the stitches stand up off the wool.
      const step = px / 4
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.lineWidth = Math.max(1, px * 0.055)
      for (const [colour, drop] of [
        [tone.deco2!, px * 0.035],
        [tone.deco!, 0],
      ] as const) {
        g.strokeStyle = colour
        g.beginPath()
        for (let r = 0; r < 4; r++) {
          for (let k = 0; k < 4; k++) {
            const x = k * step + step * 0.14
            const y = r * step + step * 0.2 + drop
            g.moveTo(x, y)
            g.lineTo(x + step * 0.36, y + step * 0.56)
            g.lineTo(x + step * 0.72, y)
          }
        }
        g.stroke()
      }
    } else if (tone.look === 'ice') {
      // Lighter at the top, as light comes through a cube, and a frosted glint in its corner.
      const sheen = g.createLinearGradient(0, 0, 0, px)
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.34)')
      sheen.addColorStop(0.55, 'rgba(255, 255, 255, 0.06)')
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)')
      g.fillStyle = sheen
      g.fillRect(0, 0, px, px)
      g.fillStyle = tone.deco!
      g.beginPath()
      g.moveTo(px * 0.16, px * 0.16)
      g.lineTo(px * 0.4, px * 0.16)
      g.quadraticCurveTo(px * 0.24, px * 0.24, px * 0.16, px * 0.4)
      g.closePath()
      g.fill()
      g.strokeStyle = tone.deco!
      g.lineCap = 'round'
      g.lineWidth = Math.max(1, px * 0.035)
      g.globalAlpha = 0.6
      g.beginPath()
      g.moveTo(px * 0.5, px * 0.17)
      g.lineTo(px * 0.6, px * 0.17)
      g.moveTo(px * 0.17, px * 0.5)
      g.lineTo(px * 0.17, px * 0.58)
      g.stroke()
    } else {
      // Light rising from the foot of the block, in the kind's own colour of aurora, gone before the top.
      const wash = g.createLinearGradient(0, px, 0, px * 0.1)
      wash.addColorStop(0, withAlpha(tone.deco2!, 0.85))
      wash.addColorStop(0.5, withAlpha(tone.deco2!, 0.34))
      wash.addColorStop(1, withAlpha(tone.deco2!, 0))
      g.fillStyle = wash
      g.fillRect(0, 0, px, px)
    }
    pattern = ctx.createPattern(canvas, 'repeat')
  }
  tiles.set(id, pattern)
  return pattern
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
  const look = tone.look
  // A skin's marks go by where a block sits in its piece, so they hold still while the piece moves.
  let minX = Infinity
  let minY = Infinity
  if (look !== 'plain') {
    for (const cell of cells) {
      minX = Math.min(minX, cell.x)
      minY = Math.min(minY, Math.round(cell.y))
    }
  }
  const deco = look === 'aurora' ? new Path2D() : null
  const bubbles = look === 'ice' ? new Path2D() : null

  for (const cell of cells) {
    const x = cell.x
    const y = Math.round(cell.y)
    const px = ox + cell.x * c + dx
    const py = oy + cell.y * c + dy
    if (bubbles || deco) {
      const rx = x - minX
      const ry = y - minY
      if (bubbles) {
        // A bubble or two, set by the block's place in its piece.
        const flip = (rx + ry + tone.kind) % 2 === 1
        const bx = px + c * (flip ? 0.34 : 0.68)
        const by = py + c * (flip ? 0.7 : 0.64)
        const br = c * 0.07
        bubbles.moveTo(bx + br, by)
        bubbles.arc(bx, by, br, 0, TAU)
        if (!flip) {
          const sx = px + c * 0.5
          const sy = py + c * 0.8
          bubbles.moveTo(sx + br * 0.6, sy)
          bubbles.arc(sx, sy, br * 0.6, 0, TAU)
        }
      } else if (deco && hash(rx, ry, tone.kind + 3) < 0.4) {
        // A star, a tiny four-pointed one.
        const sx = px + c * (0.25 + hash(rx, ry, tone.kind + 5) * 0.45)
        const sy = py + c * (0.2 + hash(rx, ry, tone.kind + 7) * 0.35)
        const a = Math.max(1, c * 0.09)
        const b = a * 0.22
        deco.moveTo(sx, sy - a)
        deco.lineTo(sx + b, sy - b)
        deco.lineTo(sx + a, sy)
        deco.lineTo(sx + b, sy + b)
        deco.lineTo(sx, sy + a)
        deco.lineTo(sx - b, sy + b)
        deco.lineTo(sx - a, sy)
        deco.lineTo(sx - b, sy - b)
        deco.closePath()
      }
    }
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

  // The aurora runs across each piece from green on its left to violet on its right.
  let outline: string | CanvasGradient = tone.line
  if (look === 'aurora') {
    let lo = Infinity
    let hi = -Infinity
    for (const cell of cells) {
      lo = Math.min(lo, cell.x)
      hi = Math.max(hi, cell.x + 1)
    }
    const g = ctx.createLinearGradient(ox + lo * c + dx, 0, ox + hi * c + dx, 0)
    g.addColorStop(0, AURORA[0])
    g.addColorStop(0.5, AURORA[1])
    g.addColorStop(1, AURORA[2])
    outline = g
  }

  ctx.save()
  ctx.globalAlpha *= o.alpha ?? 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (o.ghost) {
    ctx.fillStyle = tone.ghost
    ctx.globalAlpha *= 0.08
    ctx.fill(fill)
    ctx.globalAlpha /= 0.08
    ctx.setLineDash([c * 0.2, c * 0.14])
    ctx.strokeStyle = look === 'aurora' ? outline : tone.ghost
    ctx.lineWidth = lw
    ctx.globalAlpha *= look === 'plain' ? 0.62 : 0.75
    ctx.stroke(line)
    ctx.restore()
    return
  }
  if (look !== 'plain') {
    // The block's tile, laid from the first block's corner so every block of the piece starts a tile.
    const t = ctx.getTransform()
    const px = Math.max(4, Math.round(c * Math.hypot(t.a, t.b)))
    const pattern = tileFor(ctx, tone, px)
    if (pattern) {
      const first = cells[0]!
      pattern.setTransform(new DOMMatrix().translate(ox + first.x * c + dx, oy + first.y * c + dy).scale(c / px))
      ctx.fillStyle = pattern
    } else ctx.fillStyle = tone.fill
  } else ctx.fillStyle = tone.fill
  ctx.fill(fill)
  ctx.strokeStyle = tone.seam
  ctx.lineWidth = Math.max(1, c * 0.035)
  ctx.globalAlpha *= 0.55
  ctx.stroke(seam)
  ctx.globalAlpha /= 0.55
  if (tone.shine) {
    ctx.strokeStyle = tone.shine
    ctx.lineWidth = Math.max(1, c * 0.05)
    ctx.stroke(shine)
  }
  if (deco) {
    ctx.fillStyle = tone.deco!
    ctx.globalAlpha *= 0.85
    ctx.fill(deco)
    ctx.globalAlpha /= 0.85
  }
  if (bubbles) {
    ctx.strokeStyle = tone.deco2!
    ctx.lineWidth = Math.max(0.75, c * 0.032)
    ctx.stroke(bubbles)
  }
  if (look === 'knit' && cells.length > 1) drawFlake(ctx, cells, ox + dx, oy + dy, c)
  if (o.flash) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * clamp01(o.flash)})`
    ctx.fill(fill)
  }
  if (look === 'aurora') {
    // The glow: the outline again, wide and faint, under the line itself.
    ctx.strokeStyle = outline
    ctx.lineWidth = lw * 3.4
    ctx.globalAlpha *= tone.dark ? 0.2 : 0.14
    ctx.stroke(line)
    ctx.globalAlpha /= tone.dark ? 0.2 : 0.14
  }
  ctx.strokeStyle = outline
  ctx.lineWidth = lw
  ctx.stroke(line)
  if (tone.rim) {
    ctx.strokeStyle = tone.rim
    ctx.lineWidth = Math.max(0.75, lw * 0.4)
    ctx.stroke(line)
  }
  ctx.restore()
}

/**
 * The knit's snowflake, white, on the block nearest the middle of the piece
 * (the top one, then the left, of two as near), so it stays on the same block
 * from falling to locked.
 */
function drawFlake(ctx: CanvasRenderingContext2D, cells: readonly CellAt[], ox: number, oy: number, c: number) {
  let mx = 0
  let my = 0
  for (const cell of cells) {
    mx += cell.x
    my += cell.y
  }
  mx /= cells.length
  my /= cells.length
  let best = cells[0]!
  let bestD = Infinity
  for (const cell of cells) {
    const d = (cell.x - mx) ** 2 + (cell.y - my) ** 2
    if (d < bestD - 1e-6 || (Math.abs(d - bestD) < 1e-6 && (cell.y < best.y || (cell.y === best.y && cell.x < best.x)))) {
      best = cell
      bestD = d
    }
  }
  const cx = ox + (best.x + 0.5) * c
  const cy = oy + (best.y + 0.5) * c
  const arm = c * 0.27
  const barb = arm * 0.38
  const path = new Path2D()
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2
    const ex = cx + Math.cos(a) * arm
    const ey = cy + Math.sin(a) * arm
    path.moveTo(cx, cy)
    path.lineTo(ex, ey)
    // A little V near each arm's tip.
    const kx = cx + Math.cos(a) * arm * 0.62
    const ky = cy + Math.sin(a) * arm * 0.62
    for (const side of [-1, 1]) {
      path.moveTo(kx, ky)
      path.lineTo(kx + Math.cos(a + side * 0.75) * barb, ky + Math.sin(a + side * 0.75) * barb)
    }
  }
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(26, 16, 32, 0.28)'
  ctx.lineWidth = Math.max(1.6, c * 0.1)
  ctx.stroke(path)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(1, c * 0.06)
  ctx.stroke(path)
  ctx.restore()
}

function pieceCells(p: Piece, y = p.y): CellAt[] {
  return SHAPES[p.kind]![p.rot]!.map(([cx, cy]) => ({ x: p.x + cx, y: y + cy }))
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
  }
}

// ——————————————————————————————————————————————————————————— the piece

function drawTrails(v: View, shiftX: number) {
  const { ctx, s, c, ox, oy } = v
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1, c * 0.07)
  for (const trail of s.trails) {
    ctx.strokeStyle = v.tones[trail.kind]!.ghost
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

/** A piece in a box, sized to fit it, a little under the box's middle to clear its label. */
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
 * `skin`: the player's chosen skin (lib/skins.ts), for their own game only;
 * previews pass none.
 */
export function renderGame(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  w: number,
  h: number,
  layout?: Layout,
  skin: string | null = null,
) {
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
    tones: tonesFor(dark, ground, (skin && LOOKS[skin]) || 'plain'),
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
