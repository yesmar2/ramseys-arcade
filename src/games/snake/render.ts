import { PALETTE, type Swatch } from '../../data/games'
import { isDarkTheme, playfieldColor } from '../../lib/theme'
import { playHeader } from '../playHeader'
import {
  css,
  drawFruit,
  drawGoldenApple,
  drawMouse,
  hexToRgb,
  hsla,
  hslToRgb,
  hueOf,
  line,
  mixRgb,
  sparkle,
  type Paint,
  type RGB,
} from './art'
import {
  CHAIN_TOP,
  DYING_TIME,
  bodyLength,
  boostFuelLeft,
  fruitValue,
  isBoosting,
  ringLeft,
  type Cell,
  type GameState,
  type Tint,
} from './game'

/*
 * The lawn, drawn back to front: the board in its hedge, the next level's
 * outline, the stone, the fruit and whatever else is out, the snake, then the
 * sparks and the words, and last the tank under the board.
 *
 * The snake is one shape: a tube along the path the head has taken, fat at
 * the neck and tapering to a point, drawn twice — once in its outline colour a
 * little wider, then in its fill — so however it coils, there is one clean
 * edge round the outside and none inside. A swallowed bite rides down it as a
 * lump. The head is drawn into the same two passes, so it grows out of the
 * body rather than sitting on it.
 */

/** How far the board panel is drawn outside the grid, on every side. */
const PANEL_PAD = 10
const FONT = '"Outfit", system-ui, sans-serif'

/** Body width as a share of a cell, before the taper and the lumps. */
const BODY_W = 0.6
/** Spacing of the points the body is drawn through, cells. */
const BODY_STEP = 0.1
/** The ten colours in wheel order, for the scales of a snake on a top chain. */
const WHEEL: Swatch[] = ['red', 'orange', 'amber', 'green', 'teal', 'sky', 'indigo', 'violet', 'magenta', 'pink']

type Skin = Paint & {
  key: string
  field: RGB
  /** Lawn, and the other square of its check. */
  lawn: RGB
  lawnAlt: RGB
  /** The hedge around the lawn. */
  hedge: RGB
  /** Stone. */
  stoneFill: string
  stoneLine: string
  stoneMark: string
  inkCss: string
  /** Snake. */
  bodyFill: RGB
  bodyLine: RGB
  scale: RGB
  /** What a drained, dead snake is drawn in. */
  deadFill: RGB
  deadLine: RGB
}

let cachedSkin: Skin | null = null

function skin(): Skin {
  const field = playfieldColor()
  const dark = isDarkTheme()
  const key = `${field}|${dark}`
  if (cachedSkin && cachedSkin.key === key) return cachedSkin

  const f = field.startsWith('#') ? hexToRgb(field) : ([18, 28, 36] as RGB)
  const ink: RGB = dark ? [231, 238, 243] : [26, 43, 60]
  const greenHue = hueOf('green')
  const green = hslToRgb(greenHue, 0.64, 0.58)
  const lawn = dark
    ? mixRgb(mixRgb(f, [6, 12, 17], 0.42), green, 0.035)
    : mixRgb(mixRgb(f, [255, 255, 255], 0.35), green, 0.05)
  const lawnAlt = dark ? mixRgb(lawn, green, 0.045) : mixRgb(lawn, green, 0.085)
  const hedge = dark ? mixRgb(mixRgb(f, [0, 0, 0], 0.25), green, 0.1) : mixRgb(f, green, 0.2)
  const stoneHue = hueOf('sky')
  const stone = hslToRgb(stoneHue, 0.2, dark ? 0.62 : 0.5)
  const lineL = dark ? 64 : 42

  cachedSkin = {
    key,
    ground: lawn,
    dark,
    ink,
    field: f,
    lawn,
    lawnAlt,
    hedge,
    stoneFill: css(mixRgb(lawn, stone, dark ? 0.3 : 0.32)),
    stoneLine: hsla(stoneHue, 22, lineL, 0.9),
    stoneMark: hsla(stoneHue, 22, dark ? 80 : 34, 0.34),
    inkCss: css(ink),
    bodyFill: mixRgb(lawn, green, dark ? 0.46 : 0.5),
    bodyLine: hslToRgb(greenHue, 0.64, lineL / 100),
    scale: dark
      ? mixRgb(mixRgb(lawn, green, 0.46), hslToRgb(greenHue, 0.7, 0.8), 0.5)
      : mixRgb(mixRgb(lawn, green, 0.5), hslToRgb(greenHue, 0.64, 0.3), 0.45),
    deadFill: mixRgb(lawn, dark ? [150, 160, 170] : [140, 150, 160], 0.35),
    deadLine: dark ? [150, 162, 172] : [110, 122, 134],
  }
  return cachedSkin
}

function tintColor(sk: Skin, tint: Tint, alpha = 1) {
  if (tint === 'ink') return css(sk.ink, alpha)
  if (tint === 'white') return sk.dark ? `rgba(255, 255, 255, ${alpha})` : css(sk.ink, alpha)
  return hsla(hueOf(tint), 70, sk.dark ? 64 : 46, alpha)
}

type View = {
  cell: number
  ox: number
  oy: number
  gridW: number
  gridH: number
}

function px(v: View, gx: number) {
  return v.ox + gx * v.cell
}

function py(v: View, gy: number) {
  return v.oy + gy * v.cell
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t))
}

function easeOutBack(t: number) {
  const c = 1.9
  const u = t - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}

// Board ----------------------------------------------------------------------

type BoardLayer = { key: string; canvas: HTMLCanvasElement | OffscreenCanvas | null }
const boardLayer: BoardLayer = { key: '', canvas: null }

/** Hedge, lawn and its check: the same every frame, so painted once and reused. */
function paintBoard(ctx: CanvasRenderingContext2D, sk: Skin, v: View, cols: number, rows: number, w: number, h: number, dpr: number) {
  const key = `${sk.key}|${w}|${h}|${dpr}|${cols}|${rows}|${v.cell}|${v.ox}|${v.oy}`
  if (boardLayer.key !== key || !boardLayer.canvas) {
    const cw = Math.max(1, Math.floor(w * dpr))
    const ch = Math.max(1, Math.floor(h * dpr))
    const layer =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(cw, ch)
        : Object.assign(document.createElement('canvas'), { width: cw, height: ch })
    const g = layer.getContext('2d') as CanvasRenderingContext2D | null
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)

    const radius = Math.max(12, v.cell * 0.55)
    // The hedge: a rim of deeper green around the lawn, where the wall is.
    roundRect(g, v.ox - PANEL_PAD, v.oy - PANEL_PAD, v.gridW + PANEL_PAD * 2, v.gridH + PANEL_PAD * 2, radius)
    g.fillStyle = css(sk.hedge)
    g.fill()
    g.strokeStyle = line(sk, 'green', sk.dark ? 0.32 : 0.4)
    g.lineWidth = 1.2
    g.stroke()

    // The lawn, checked like a mown field so the lanes can be read.
    const inner = Math.max(4, v.cell * 0.2)
    g.save()
    roundRect(g, v.ox, v.oy, v.gridW, v.gridH, inner)
    g.clip()
    g.fillStyle = css(sk.lawn)
    g.fillRect(v.ox, v.oy, v.gridW, v.gridH)
    g.fillStyle = css(sk.lawnAlt)
    for (let y = 0; y < rows; y++) {
      for (let x = (y % 2); x < cols; x += 2) {
        g.fillRect(v.ox + x * v.cell, v.oy + y * v.cell, v.cell, v.cell)
      }
    }
    g.restore()
    roundRect(g, v.ox, v.oy, v.gridW, v.gridH, inner)
    g.strokeStyle = line(sk, 'green', sk.dark ? 0.22 : 0.3)
    g.lineWidth = 1
    g.stroke()

    boardLayer.key = key
    boardLayer.canvas = layer as HTMLCanvasElement | OffscreenCanvas
  }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(boardLayer.canvas as CanvasImageSource, 0, 0)
  ctx.restore()
}

// Stone ------------------------------------------------------------------------

type Rect = { x: number; y: number; w: number; h: number }

const mergedCache = new WeakMap<Set<string>, Map<string, Rect[]>>()

/**
 * Walled cells gathered into as few blocks as possible, so a post is one post
 * and not five squares stood in a line.
 */
function mergeCells(cells: Set<string>, cols: number, rows: number, skip: Set<string> | null): Rect[] {
  const tag = `${cols}x${rows}|${skip ? [...skip].join(';') : ''}`
  let byTag = mergedCache.get(cells)
  const hit = byTag?.get(tag)
  if (hit) return hit
  const on = (x: number, y: number) => cells.has(`${x},${y}`) && !skip?.has(`${x},${y}`)
  const runs: Rect[] = []
  for (let y = 0; y < rows; y++) {
    let x = 0
    while (x < cols) {
      if (!on(x, y)) {
        x++
        continue
      }
      const start = x
      while (x < cols && on(x, y)) x++
      runs.push({ x: start, y, w: x - start, h: 1 })
    }
  }
  // Stack runs of the same span into taller blocks.
  const out: Rect[] = []
  for (const r of runs) {
    const above = out.find((o) => o.x === r.x && o.w === r.w && o.y + o.h === r.y)
    if (above) above.h += 1
    else out.push({ ...r })
  }
  if (!byTag) {
    byTag = new Map()
    mergedCache.set(cells, byTag)
  }
  byTag.set(tag, out)
  return out
}

function drawStone(ctx: CanvasRenderingContext2D, sk: Skin, v: View, r: Rect, grow: number, alpha: number) {
  const c = v.cell
  const inset = c * 0.08
  let x = px(v, r.x) + inset
  let y = py(v, r.y) + inset
  let w = r.w * c - inset * 2
  let h = r.h * c - inset * 2
  if (grow < 1) {
    const cx = x + w / 2
    const cy = y + h / 2
    w *= grow
    h *= grow
    x = cx - w / 2
    y = cy - h / 2
  }
  if (w <= 1 || h <= 1) return
  const lw = Math.min(2.6, Math.max(1.2, c * 0.06))
  ctx.save()
  ctx.globalAlpha *= alpha
  roundRect(ctx, x, y, w, h, c * 0.22 * Math.min(1, grow))
  ctx.fillStyle = sk.stoneFill
  ctx.fill()
  ctx.strokeStyle = sk.stoneLine
  ctx.lineWidth = lw
  ctx.stroke()

  // Seams between the stones of a long block, and a lit top edge.
  ctx.strokeStyle = sk.stoneMark
  ctx.lineWidth = Math.max(1, lw * 0.6)
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (grow >= 1) {
    for (let i = 1; i < r.w; i++) {
      const sx = px(v, r.x + i)
      ctx.moveTo(sx, y + c * 0.2)
      ctx.lineTo(sx, y + h - c * 0.2)
    }
    for (let i = 1; i < r.h; i++) {
      const sy = py(v, r.y + i)
      ctx.moveTo(x + c * 0.2, sy)
      ctx.lineTo(x + w - c * 0.2, sy)
    }
  }
  const top = y + Math.max(2.5, c * 0.13)
  ctx.moveTo(x + c * 0.2, top)
  ctx.lineTo(x + w - c * 0.2, top)
  ctx.stroke()
  ctx.restore()
}

function drawWalls(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState) {
  const skip = s.dormant.size ? s.dormant : null
  const rects = mergeCells(s.walls, s.cols, s.rows, skip)
  for (let i = 0; i < rects.length; i++) {
    const t = clamp01((s.levelAge - i * 0.05) / 0.42)
    if (t <= 0) continue
    drawStone(ctx, sk, v, rects[i]!, t >= 1 ? 1 : easeOutBack(t), 1)
  }
  // A block that landed under the head is drawn faint until the head leaves it,
  // which is exactly as long as it will not kill you.
  if (skip) {
    for (const key of skip) {
      const [x, y] = key.split(',').map(Number)
      drawStone(ctx, sk, v, { x, y, w: 1, h: 1 }, 1, 0.35)
    }
  }
}

/** The shape the next bite brings, sketched where it will stand. */
function drawNextWalls(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState) {
  if (!s.nextWalls) return
  const rects = mergeCells(s.nextWalls, s.cols, s.rows, s.walls)
  const c = v.cell
  const inset = c * 0.08
  const pulse = 0.55 + 0.45 * Math.sin(s.time * 4)
  ctx.save()
  ctx.setLineDash([Math.max(3, c * 0.16), Math.max(3, c * 0.13)])
  ctx.lineDashOffset = -s.time * c * 0.6
  ctx.strokeStyle = sk.dark ? `rgba(170, 196, 214, ${0.3 + 0.2 * pulse})` : `rgba(26, 43, 60, ${0.22 + 0.14 * pulse})`
  ctx.fillStyle = sk.dark ? 'rgba(170, 196, 214, 0.05)' : 'rgba(26, 43, 60, 0.04)'
  ctx.lineWidth = Math.max(1, c * 0.05)
  for (const r of rects) {
    roundRect(ctx, px(v, r.x) + inset, py(v, r.y) + inset, r.w * c - inset * 2, r.h * c - inset * 2, c * 0.22)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

// Fruit and friends ------------------------------------------------------------

function drawFruitAndRing(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState) {
  const f = s.fruit
  const c = v.cell
  const X = px(v, f.x + 0.5)
  const Y = py(v, f.y + 0.5)
  const pop = f.age < 0.3 ? easeOutBack(clamp01(f.age / 0.3)) : 1
  const bob = Math.sin(s.time * 2.6 + f.x * 1.7 + f.y) * c * 0.025
  const left = ringLeft(f)

  if (left > 0 && s.phase !== 'dying' && s.phase !== 'gameover') {
    const R = c * 0.68
    const urgent = left < 0.3
    const beat = urgent ? 0.5 + 0.5 * Math.sin(s.time * 18) : 0
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(1.6, c * 0.085)
    ctx.strokeStyle = css(sk.ink, sk.dark ? 0.1 : 0.09)
    ctx.beginPath()
    ctx.arc(X, Y, R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = Math.max(1.8, c * (0.1 + beat * 0.03))
    ctx.strokeStyle = urgent
      ? hsla(hueOf('red'), 78, sk.dark ? 64 : 50, 0.95)
      : hsla(hueOf('amber'), 84, sk.dark ? 60 : 46, 0.95)
    ctx.beginPath()
    ctx.arc(X, Y, R, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // What it is worth if you make it, so the ring has a price on it.
    const worth = `+${fruitValue(s.chain + 1)}`
    const size = Math.round(Math.max(10, Math.min(15, c * 0.36)))
    ctx.save()
    ctx.font = `600 ${size}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    halo(ctx, sk, size)
    ctx.fillStyle = urgent ? hsla(hueOf('red'), 78, sk.dark ? 70 : 42) : hsla(hueOf('amber'), 84, sk.dark ? 66 : 38)
    const ty = Y - R - size * 0.7
    ctx.strokeText(worth, X, ty)
    ctx.fillText(worth, X, ty)
    ctx.restore()
  }

  if (pop <= 0) return
  drawFruit(ctx, sk, f.kind, X, Y + bob, c * 0.4 * pop)
}

function drawGolden(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState) {
  const g = s.golden
  if (!g) return
  const c = v.cell
  const X = px(v, g.x + 0.5)
  const Y = py(v, g.y + 0.5)
  const left = 1 - g.age / g.life
  const pop = g.age < 0.35 ? easeOutBack(clamp01(g.age / 0.35)) : 1
  // It flickers in its last second and a half, the way anything about to go does.
  const blink = g.life - g.age < 1.6 ? 0.55 + 0.45 * Math.sign(Math.sin(g.age * 22)) : 1
  ctx.save()
  ctx.globalAlpha = blink
  if (sk.dark) {
    const glow = ctx.createRadialGradient(X, Y, 0, X, Y, c * 0.95)
    glow.addColorStop(0, 'rgba(245, 185, 66, 0.32)')
    glow.addColorStop(1, 'rgba(245, 185, 66, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(X - c, Y - c, c * 2, c * 2)
  }
  ctx.setLineDash([Math.max(2, c * 0.08), Math.max(2, c * 0.07)])
  ctx.strokeStyle = hsla(hueOf('amber'), 84, sk.dark ? 60 : 46, 0.85)
  ctx.lineWidth = Math.max(1.4, c * 0.06)
  ctx.beginPath()
  ctx.arc(X, Y, c * 0.62, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  drawGoldenApple(ctx, sk, X, Y + Math.sin(s.time * 3.4) * c * 0.03, c * 0.4 * pop, s.time)
  ctx.restore()
}

// The snake -----------------------------------------------------------------------

type BodyPt = { x: number; y: number; s: number }

/**
 * The body's centre line from the head back to the tail tip, every
 * BODY_STEP cells plus every corner, with each point's distance from the head.
 */
function bodyPoints(trail: Cell[], length: number): BodyPt[] {
  const out: BodyPt[] = [{ x: trail[0]!.x, y: trail[0]!.y, s: 0 }]
  let acc = 0
  let target = BODY_STEP
  for (let i = 1; i < trail.length && acc < length; i++) {
    const a = trail[i - 1]!
    const b = trail[i]!
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (seg === 0) continue
    while (target < acc + seg && target < length) {
      const t = (target - acc) / seg
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: target })
      target += BODY_STEP
    }
    if (acc + seg <= length) {
      out.push({ x: b.x, y: b.y, s: acc + seg })
    } else {
      const t = (length - acc) / seg
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: length })
    }
    acc += seg
  }
  return out
}

/** Point and unit direction (toward the head) at distance `s` down the body. */
function along(pts: BodyPt[], s: number, hint: { i: number }) {
  let i = Math.max(1, hint.i)
  while (i < pts.length - 1 && pts[i]!.s < s) i++
  while (i > 1 && pts[i - 1]!.s > s) i--
  hint.i = i
  const a = pts[i - 1]!
  const b = pts[i]!
  const span = b.s - a.s || 1
  const t = clamp01((s - a.s) / span)
  const dx = a.x - b.x
  const dy = a.y - b.y
  const len = Math.hypot(dx, dy) || 1
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: dx / len, dy: dy / len }
}

function bodyWidth(s: number, length: number, bulges: number[]) {
  let w = BODY_W
  const taper = Math.min(length * 0.6, 2.6)
  const fromTail = length - s
  if (fromTail < taper) {
    const t = fromTail / taper
    w *= 0.3 + 0.7 * (1 - (1 - t) * (1 - t))
  }
  for (const b of bulges) {
    const d = (s - b) / 0.4
    if (d > -2.6 && d < 2.6) w += BODY_W * 0.4 * (1 - 0.45 * clamp01(b / Math.max(1, length))) * Math.exp(-d * d)
  }
  return w
}

type Look = { x: number; y: number } | null

/** What the eyes are on: a mouse nearby, else whichever bite is nearer. */
function lookTarget(s: GameState): Look {
  const h = s.head
  let best: Look = { x: s.fruit.x + 0.5, y: s.fruit.y + 0.5 }
  let bestD = Math.hypot(best.x - h.x, best.y - h.y)
  if (s.golden) {
    const g = { x: s.golden.x + 0.5, y: s.golden.y + 0.5 }
    const d = Math.hypot(g.x - h.x, g.y - h.y)
    if (d < bestD) {
      best = g
      bestD = d
    }
  }
  if (s.mouse && s.mouse.mode !== 'gone') {
    const d = Math.hypot(s.mouse.x - h.x, s.mouse.y - h.y)
    if (d < Math.max(6, bestD)) best = { x: s.mouse.x, y: s.mouse.y }
  }
  return best
}

/** Head outline in local space, nose along +x. */
/**
 * Head outline in local space, nose along +x: broadest across the eyes and
 * narrowing to a rounded snout, so it reads as a head and not the end of a
 * tube.
 */
function headPath(ctx: CanvasRenderingContext2D, c: number) {
  const front = c * 0.54
  const back = c * 0.4
  const half = c * 0.43
  ctx.beginPath()
  ctx.moveTo(-back, 0)
  ctx.bezierCurveTo(-back, -half * 0.78, -back * 0.55, -half, -c * 0.02, -half)
  ctx.bezierCurveTo(front * 0.55, -half, front, -half * 0.52, front, 0)
  ctx.bezierCurveTo(front, half * 0.52, front * 0.55, half, -c * 0.02, half)
  ctx.bezierCurveTo(-back * 0.55, half, -back, half * 0.78, -back, 0)
  ctx.closePath()
}

function drawTongue(ctx: CanvasRenderingContext2D, sk: Skin, c: number, out: number, time: number) {
  if (out <= 0.02) return
  const base = c * 0.46
  const len = c * 0.36 * out
  const wig = Math.sin(time * 40) * c * 0.03 * out
  const fork = c * 0.09 * out
  ctx.save()
  ctx.strokeStyle = line(sk, 'red')
  ctx.lineWidth = Math.max(1.2, c * 0.05)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(base, 0)
  ctx.quadraticCurveTo(base + len * 0.5, wig, base + len, wig * 0.4)
  ctx.moveTo(base + len, wig * 0.4)
  ctx.lineTo(base + len + fork, wig * 0.4 - fork * 0.8)
  ctx.moveTo(base + len, wig * 0.4)
  ctx.lineTo(base + len + fork, wig * 0.4 + fork * 0.8)
  ctx.stroke()
  ctx.restore()
}

/** How far the tongue is out, 0 → 1: a flick every couple of seconds, more often near food. */
function tongueOut(time: number, near: boolean) {
  const period = near ? 0.9 : 2.6
  const t = time % period
  const flick = 0.34
  if (t > flick) return 0
  return Math.sin((t / flick) * Math.PI)
}

function blinking(time: number) {
  const period = 3.7
  const t = time % period
  return t > period - 0.13
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  c: number,
  look: { x: number; y: number } | null,
  closed: boolean,
  dead: boolean,
  sk: Skin,
) {
  const r = c * 0.145
  for (const side of [-1, 1]) {
    const ex = c * 0.02
    const ey = side * c * 0.215
    if (dead) {
      ctx.strokeStyle = css(sk.ink, 0.9)
      ctx.lineWidth = Math.max(1.4, r * 0.42)
      ctx.lineCap = 'round'
      const k = r * 0.72
      ctx.beginPath()
      ctx.moveTo(ex - k, ey - k)
      ctx.lineTo(ex + k, ey + k)
      ctx.moveTo(ex + k, ey - k)
      ctx.lineTo(ex - k, ey + k)
      ctx.stroke()
      continue
    }
    ctx.beginPath()
    ctx.arc(ex, ey, r, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = css(sk.bodyLine)
    ctx.lineWidth = Math.max(1, r * 0.22)
    ctx.stroke()
    if (closed) {
      // An eyelid: the white covered, a line where it closes.
      ctx.beginPath()
      ctx.arc(ex, ey, r, 0, Math.PI * 2)
      ctx.fillStyle = css(sk.bodyFill)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(ex - r * 0.8, ey)
      ctx.lineTo(ex + r * 0.8, ey)
      ctx.strokeStyle = css(sk.bodyLine)
      ctx.lineWidth = Math.max(1, r * 0.3)
      ctx.lineCap = 'round'
      ctx.stroke()
      continue
    }
    let lx = 0
    let ly = 0
    if (look) {
      const dx = look.x - ex
      const dy = look.y - ey
      const d = Math.hypot(dx, dy) || 1
      lx = (dx / d) * r * 0.36
      ly = (dy / d) * r * 0.36
    }
    ctx.beginPath()
    ctx.arc(ex + lx, ey + ly, r * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = '#1a2b3c'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(ex + lx - r * 0.16, ey + ly - r * 0.18, r * 0.16, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }
}

function drawSnake(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState) {
  const c = v.cell
  const length = bodyLength(s.segments)
  const pts = bodyPoints(s.trail, length)
  if (pts.length < 2) return
  const P = pts.map((p) => ({ X: px(v, p.x), Y: py(v, p.y), s: p.s }))

  const dying = s.phase === 'dying' || s.phase === 'gameover'
  // The colour drains from head to tail over the crash.
  const drainT = s.phase === 'gameover' ? 1 : s.phase === 'dying' ? clamp01((1 - s.dying / DYING_TIME - 0.12) / 0.7) : 0
  const drainAt = drainT * (length + 1.2)
  const drainOf = (at: number) => (dying ? clamp01((drainAt - at) / 1.2) : 0)
  const bodyLineAt = (d: number) => css(mixRgb(sk.bodyLine, sk.deadLine, d), 0.95)
  const bodyFillAt = (d: number) => css(mixRgb(sk.bodyFill, sk.deadFill, d))
  const q = (d: number) => Math.round(d * 6) / 6

  const lw = Math.min(3, Math.max(1.3, c * 0.075))
  const widths = new Float32Array(P.length)
  for (let i = 1; i < P.length; i++) {
    const mid = (P[i - 1]!.s + P[i]!.s) / 2
    widths[i] = Math.round(bodyWidth(mid, length, s.bulges) * c * 4) / 4
  }

  // Head placement: the nose points from a little way back along the body, so
  // it swings through a corner instead of snapping round it.
  const hint = { i: 1 }
  const neck = along(pts, Math.min(0.45, length), hint)
  const angle = Math.atan2(neck.dy, neck.dx)
  const HX = P[0]!.X
  const HY = P[0]!.Y
  const boosting = isBoosting(s)
  const hot = s.chain >= CHAIN_TOP && !dying

  const strokeRuns = (extra: number, colorAt: (d: number) => string) => {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    let runW = -1
    let runC = ''
    for (let i = 1; i < P.length; i++) {
      const w = widths[i]! + extra
      const col = colorAt(q(drainOf(P[i]!.s)))
      if (w !== runW || col !== runC) {
        if (runW > 0) ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(P[i - 1]!.X, P[i - 1]!.Y)
        ctx.lineWidth = w
        ctx.strokeStyle = col
        runW = w
        runC = col
      }
      ctx.lineTo(P[i]!.X, P[i]!.Y)
    }
    if (runW > 0) ctx.stroke()
  }

  // Boost: wind streaming back past the neck.
  if (boosting) {
    ctx.save()
    ctx.strokeStyle = hsla(hueOf('amber'), 84, sk.dark ? 64 : 46, 0.55)
    ctx.lineWidth = Math.max(1.2, c * 0.05)
    ctx.lineCap = 'round'
    const nx = -neck.dy
    const ny = neck.dx
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const phase = (s.time * 3 + k * 0.5) % 1
        const a = along(pts, Math.min(length, 0.3 + phase * 1.6), { i: 1 })
        const b = along(pts, Math.min(length, 0.3 + phase * 1.6 + 0.5), { i: 1 })
        const off = (BODY_W / 2 + 0.16 + k * 0.1) * side
        ctx.globalAlpha = 1 - phase
        ctx.beginPath()
        ctx.moveTo(px(v, a.x + nx * off), py(v, a.y + ny * off))
        ctx.lineTo(px(v, b.x + nx * off), py(v, b.y + ny * off))
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  const near =
    Math.hypot(s.fruit.x + 0.5 - s.head.x, s.fruit.y + 0.5 - s.head.y) < 3 ||
    (s.mouse != null && Math.hypot(s.mouse.x - s.head.x, s.mouse.y - s.head.y) < 3)
  const headDrain = drainOf(0)

  // The tongue goes under the head, so the head covers where it comes from.
  ctx.save()
  ctx.translate(HX, HY)
  ctx.rotate(angle)
  if (!dying) drawTongue(ctx, sk, c, tongueOut(s.time, near), s.time)
  ctx.restore()

  // Pass one: everything in its outline colour, a line's width wider all round.
  strokeRuns(lw * 2, bodyLineAt)
  ctx.save()
  ctx.translate(HX, HY)
  ctx.rotate(angle)
  headPath(ctx, c)
  ctx.fillStyle = bodyLineAt(q(headDrain))
  ctx.fill()
  ctx.lineWidth = lw * 2
  ctx.strokeStyle = bodyLineAt(q(headDrain))
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()

  // Pass two: the fill, which leaves only the outer edge showing.
  strokeRuns(0, bodyFillAt)
  ctx.save()
  ctx.translate(HX, HY)
  ctx.rotate(angle)
  headPath(ctx, c)
  ctx.fillStyle = bodyFillAt(q(headDrain))
  ctx.fill()
  ctx.restore()

  // Scales: a row of diamonds down the back, riding with the body. On a top
  // chain they run through all ten colours.
  {
    const spacing = 0.58
    const hint2 = { i: 1 }
    const scaleCss = css(sk.scale)
    const groups = new Map<string, number[]>()
    const glowing = boosting && !dying
    for (let k = 0, at = 0.78; at < length - 0.3; k++, at += spacing) {
      const d = drainOf(at)
      const col = hot
        ? hsla(hueOf(WHEEL[(k + Math.floor(s.time * 9)) % WHEEL.length]!), 72, sk.dark ? 62 : 48, 0.95)
        : glowing
          ? hsla(hueOf('amber'), 84, sk.dark ? 62 : 48, 0.9)
          : d > 0
            ? css(mixRgb(sk.scale, sk.deadLine, q(d)))
            : scaleCss
      let list = groups.get(col)
      if (!list) {
        list = []
        groups.set(col, list)
      }
      list.push(at)
    }
    for (const [col, list] of groups) {
      ctx.beginPath()
      for (const at of list) {
        const p = along(pts, at, hint2)
        const k = bodyWidth(at, length, s.bulges) / BODY_W
        const a = 0.17 * k
        const b = 0.13 * k
        const nx = -p.dy
        const ny = p.dx
        ctx.moveTo(px(v, p.x + p.dx * a), py(v, p.y + p.dy * a))
        ctx.lineTo(px(v, p.x + nx * b), py(v, p.y + ny * b))
        ctx.lineTo(px(v, p.x - p.dx * a), py(v, p.y - p.dy * a))
        ctx.lineTo(px(v, p.x - nx * b), py(v, p.y - ny * b))
        ctx.closePath()
      }
      ctx.fillStyle = col
      ctx.fill()
    }
  }

  // Face.
  ctx.save()
  ctx.translate(HX, HY)
  ctx.rotate(angle)
  // The first scale of the back, on the crown, pointing the way the head goes.
  ctx.beginPath()
  ctx.moveTo(-c * 0.08, 0)
  ctx.lineTo(-c * 0.22, -c * 0.085)
  ctx.lineTo(-c * 0.33, 0)
  ctx.lineTo(-c * 0.22, c * 0.085)
  ctx.closePath()
  ctx.fillStyle = dying ? css(mixRgb(sk.scale, sk.deadLine, q(headDrain))) : hot ? hsla(hueOf('amber'), 84, sk.dark ? 62 : 48, 0.95) : css(sk.scale)
  ctx.fill()
  // Nostrils.
  ctx.fillStyle = css(sk.dark ? [10, 20, 16] : [20, 50, 36], 0.7)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(c * 0.42, side * c * 0.09, Math.max(0.8, c * 0.026), 0, Math.PI * 2)
    ctx.fill()
  }
  const target = lookTarget(s)
  let look: { x: number; y: number } | null = null
  if (target) {
    const dx = (target.x - s.head.x) * c
    const dy = (target.y - s.head.y) * c
    const cos = Math.cos(-angle)
    const sin = Math.sin(-angle)
    look = { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
  }
  drawEyes(ctx, c, look, !dying && blinking(s.time), dying, sk)
  ctx.restore()

  if (hot || boosting) {
    // Warmth round the head: a top chain glows gold, a boost burns amber.
    ctx.save()
    ctx.globalCompositeOperation = sk.dark ? 'lighter' : 'source-over'
    const glow = ctx.createRadialGradient(HX, HY, c * 0.2, HX, HY, c * 1.1)
    const a = sk.dark ? 0.22 : 0.12
    glow.addColorStop(0, `rgba(245, 185, 66, ${a})`)
    glow.addColorStop(1, 'rgba(245, 185, 66, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(HX - c * 1.2, HY - c * 1.2, c * 2.4, c * 2.4)
    ctx.restore()
  }
}

// Effects -----------------------------------------------------------------------

/**
 * Text stands on a halo, as the other games' floaters do: darker than the
 * lawn when it is dark, paler when it is light, so it reads where it crosses
 * the snake.
 */
function halo(ctx: CanvasRenderingContext2D, sk: Skin, size: number) {
  const color = css(mixRgb(sk.lawn, sk.dark ? [0, 0, 0] : [255, 255, 255], 0.5), 0.92)
  ctx.shadowColor = color
  ctx.shadowBlur = Math.max(5, size * 0.35)
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(3, size * 0.2)
  ctx.lineJoin = 'round'
}

function drawParticles(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState) {
  const c = v.cell
  for (const p of s.particles) {
    const X = px(v, p.x)
    const Y = py(v, p.y)
    const a = clamp01(p.life * 1.3)
    if (p.kind === 'ring') {
      const R = c * (p.size + (1 - p.life) * 0.55)
      ctx.globalAlpha = a * 0.8
      ctx.strokeStyle = tintColor(sk, p.tint)
      ctx.lineWidth = Math.max(1, c * 0.07 * p.life)
      ctx.beginPath()
      ctx.arc(X, Y, R, 0, Math.PI * 2)
      ctx.stroke()
    } else if (p.kind === 'puff') {
      ctx.globalAlpha = a * (sk.dark ? 0.22 : 0.16)
      ctx.fillStyle = tintColor(sk, p.tint)
      ctx.beginPath()
      ctx.arc(X, Y, c * p.size * (1.4 - p.life * 0.6), 0, Math.PI * 2)
      ctx.fill()
    } else if (p.kind === 'spark') {
      ctx.globalAlpha = a
      sparkle(ctx, X, Y, c * p.size * (0.6 + p.life * 0.8), tintColor(sk, p.tint))
    } else {
      ctx.globalAlpha = a
      ctx.fillStyle = tintColor(sk, p.tint)
      ctx.beginPath()
      ctx.arc(X, Y, Math.max(0.8, c * p.size * (0.5 + p.life * 0.5)), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

function drawFloaters(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState) {
  const c = v.cell
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of s.floaters) {
    const X = px(v, f.x)
    const Y = py(v, f.y)
    const age = 1 - f.life
    const pop = age < 0.12 ? 1 + (0.12 - age) * 2.5 : 1
    const size = Math.round(Math.max(13, Math.min(30, c * (0.5 + 0.28 * f.weight))) * pop)
    ctx.globalAlpha = f.life > 0.4 ? 1 : f.life / 0.4
    ctx.font = `600 ${size}px ${FONT}`
    halo(ctx, sk, size)
    ctx.fillStyle = tintColor(sk, f.tint)
    ctx.strokeText(f.text, X, Y)
    ctx.fillText(f.text, X, Y)
    if (f.sub) {
      const sub = Math.round(Math.max(10, size * 0.52))
      ctx.font = `600 ${sub}px ${FONT}`
      halo(ctx, sk, sub)
      ctx.fillStyle = css(sk.ink, 0.88)
      ctx.strokeText(f.sub, X, Y + size * 0.78)
      ctx.fillText(f.sub, X, Y + size * 0.78)
    }
  }
  ctx.restore()
}

function drawBanner(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState) {
  const b = s.banners[0]
  if (!b) return
  const t = 1 - b.life / b.maxLife
  const alpha = t < 0.1 ? t / 0.1 : t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1
  const pop = 1 + Math.max(0, 0.12 - t) * 2
  const size = Math.round(Math.max(22, Math.min(44, v.gridW * 0.075)) * pop)
  const X = v.ox + v.gridW / 2
  const Y = v.oy + v.gridH * 0.3
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${size}px ${FONT}`
  halo(ctx, sk, size)
  ctx.fillStyle = tintColor(sk, b.tint)
  ctx.strokeText(b.text, X, Y)
  ctx.fillText(b.text, X, Y)
  if (b.sub) {
    const sub = Math.round(Math.max(13, size * 0.42))
    ctx.font = `600 ${sub}px ${FONT}`
    halo(ctx, sk, sub)
    ctx.fillStyle = css(sk.ink, 0.92)
    ctx.strokeText(b.sub, X, Y + size * 0.8)
    ctx.fillText(b.sub, X, Y + size * 0.8)
  }
  ctx.restore()
}

let coarse: boolean | null = null
function isTouch() {
  if (coarse === null) {
    coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
  }
  return coarse
}

/** The first seconds of a run: how to steer, and what the ring means. */
function drawHint(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState) {
  if (s.phase !== 'playing' || s.eaten >= 3 || s.elapsed > 9) return
  const fadeIn = clamp01(s.elapsed / 0.4)
  const fadeOut = s.eaten >= 2 || s.elapsed > 8 ? 0.6 : 1
  const lines = [
    isTouch() ? 'Swipe or tap the turn buttons · hold ⚡ to boost' : 'Arrow keys to turn · hold Space to boost',
    'Reach each fruit before its ring closes to build a chain',
  ]
  const big = Math.round(Math.max(12, Math.min(15, v.gridW * 0.034)))
  const small = Math.round(big * 0.86)
  ctx.save()
  ctx.globalAlpha = fadeIn * fadeOut
  ctx.font = `600 ${big}px ${FONT}`
  const w1 = ctx.measureText(lines[0]!).width
  ctx.font = `600 ${small}px ${FONT}`
  const w2 = ctx.measureText(lines[1]!).width
  const w = Math.min(v.gridW - 16, Math.max(w1, w2) + 32)
  const h = big * 3.4
  const x = v.ox + v.gridW / 2 - w / 2
  const y = v.oy + v.gridH - h - Math.max(10, v.cell * 0.4)
  ctx.fillStyle = sk.dark ? 'rgba(24, 36, 46, 0.86)' : 'rgba(255, 255, 255, 0.9)'
  roundRect(ctx, x, y, w, h, 14)
  ctx.fill()
  ctx.strokeStyle = css(sk.ink, 0.1)
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = sk.inkCss
  ctx.font = `600 ${big}px ${FONT}`
  ctx.fillText(lines[0]!, v.ox + v.gridW / 2, y + h * 0.34, w - 16)
  ctx.fillStyle = css(sk.ink, 0.72)
  ctx.font = `600 ${small}px ${FONT}`
  ctx.fillText(lines[1]!, v.ox + v.gridW / 2, y + h * 0.7, w - 16)
  ctx.restore()
}

/** Under the board: the boost tank, with a mark for every bite's worth. */
function drawTank(ctx: CanvasRenderingContext2D, sk: Skin, v: View, s: GameState, h: number, footer: number) {
  const midY = h - footer / 2
  const boosting = isBoosting(s)
  const muted = css(sk.ink, sk.dark ? 0.55 : 0.5)
  const label = Math.max(11, Math.min(footer * 0.52, v.cell * 0.42))
  const fuel = boostFuelLeft(s)
  const barW = Math.min(v.gridW * 0.42, label * 12)
  const barH = Math.max(5, label * 0.42)
  const barX = v.ox + (v.gridW - barW) / 2 + label * 0.5
  const barY = midY - barH / 2
  const amber = hsla(hueOf('amber'), 84, sk.dark ? 60 : 50, 0.98)

  // A bolt ahead of the bar, so the strip says what it is measuring.
  const boltH = label * 0.95
  const boltX = barX - boltH * 0.85
  ctx.save()
  ctx.fillStyle = boosting ? amber : muted
  ctx.beginPath()
  ctx.moveTo(boltX + boltH * 0.34, midY - boltH / 2)
  ctx.lineTo(boltX, midY + boltH * 0.08)
  ctx.lineTo(boltX + boltH * 0.22, midY + boltH * 0.08)
  ctx.lineTo(boltX + boltH * 0.08, midY + boltH / 2)
  ctx.lineTo(boltX + boltH * 0.42, midY - boltH * 0.06)
  ctx.lineTo(boltX + boltH * 0.2, midY - boltH * 0.06)
  ctx.closePath()
  ctx.fill()

  roundRect(ctx, barX, barY, barW, barH, barH / 2)
  ctx.fillStyle = css(sk.ink, sk.dark ? 0.12 : 0.1)
  ctx.fill()
  if (fuel > 0) {
    roundRect(ctx, barX, barY, Math.max(barH, barW * fuel), barH, barH / 2)
    ctx.fillStyle = boosting ? amber : hsla(hueOf('amber'), 84, sk.dark ? 60 : 50, 0.62)
    ctx.fill()
  }
  // Eight notches: a bite's worth of fuel each.
  ctx.fillStyle = css(sk.field, 0.55)
  for (let i = 1; i < 8; i++) {
    ctx.fillRect(barX + (barW * i) / 8 - 0.5, barY, 1, barH)
  }
  ctx.restore()
}

// Frame -------------------------------------------------------------------------

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const sk = skin()
  const s = state

  // The board gets what is left after both strips, not the whole canvas: the
  // header is the room the score readout needs, the footer the room the tank
  // needs.
  //
  // The panel is drawn PANEL_PAD outside the grid on every side, so the header
  // has to cover that too — clearing the grid alone still leaves the panel's
  // top border reaching up into the score.
  const header = playHeader(w) + PANEL_PAD
  const footer = Math.max(22, Math.min(w, h) * 0.07)
  // On a phone the board is limited by width — fifteen columns across 375px —
  // so every pixel of side margin comes straight off the cell. Trimmed to the
  // panel's own thickness plus a hair, which is as tight as it can be drawn
  // without the panel border running off the edge. Landscape is limited by
  // height instead, so this costs it nothing.
  const pad = Math.max(PANEL_PAD + 2, Math.min(w, h) * 0.03)
  const boardW = w - pad * 2
  const boardH = h - pad - header - footer
  const cell = Math.max(1, Math.min(boardW / s.cols, boardH / s.rows))
  const gridW = cell * s.cols
  const gridH = cell * s.rows
  const ox = Math.round((w - gridW) / 2)
  /*
   * Board straight under the header, not floated in the middle of what is
   * left. Centring it split the spare height in two and put half of it above
   * the board, which on a phone is a lot — the strip over the board came out
   * twice the height it needed and the readout swam in it. All of it belongs
   * at the bottom, next to the thumbs.
   */
  const oy = Math.round(header)

  /*
   * Tell the page where the board starts, so the strip above it — score,
   * figures, and the controls at either end — can share its middle. Nothing
   * in the DOM can see the canvas, so without this they each guess.
   *
   * Written only when it changes, so this costs nothing per frame.
   */
  const host = ctx.canvas.parentElement
  if (host) {
    const middle = Math.round((oy - PANEL_PAD) / 2)
    if (host.dataset.readoutMiddle !== String(middle)) {
      host.dataset.readoutMiddle = String(middle)
      host.style.setProperty('--readout-middle', `${middle}px`)
    }
  }

  const v: View = { cell, ox, oy, gridW, gridH }

  ctx.fillStyle = css(sk.field)
  ctx.fillRect(0, 0, w, h)

  const shake = s.shake > 0 ? s.shake * s.shake * Math.min(8, cell * 0.25) : 0
  ctx.save()
  if (shake) ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2)

  paintBoard(ctx, sk, v, s.cols, s.rows, w, h, dpr)

  // Everything that belongs to the playfield is confined to it. A trail can
  // reach past the board — the admin jump lays out a body longer than the board
  // is tall — and without this the beads are drawn up over the score.
  ctx.save()
  roundRect(ctx, ox - PANEL_PAD, oy - PANEL_PAD, gridW + PANEL_PAD * 2, gridH + PANEL_PAD * 2, Math.max(12, cell * 0.55))
  ctx.clip()

  drawNextWalls(ctx, sk, v, s)
  drawWalls(ctx, sk, v, s)
  drawFruitAndRing(ctx, sk, v, s)
  drawGolden(ctx, sk, v, s)
  if (s.mouse) drawMouse(ctx, sk, s.mouse, px(v, s.mouse.x), py(v, s.mouse.y), cell * 1.2, s.time)
  drawSnake(ctx, sk, v, s)
  drawParticles(ctx, sk, v, s)
  drawFloaters(ctx, sk, v, s)
  drawBanner(ctx, sk, v, s)
  drawHint(ctx, sk, v, s)

  ctx.restore()
  ctx.restore()

  drawTank(ctx, sk, v, s, h, footer)

  if (s.flash > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.4, s.flash * 0.45)
    ctx.fillStyle =
      s.flashTint === 'white' || s.flashTint === 'ink'
        ? sk.dark
          ? '#ffffff'
          : '#ffffff'
        : PALETTE[s.flashTint as Swatch]
    ctx.globalAlpha *= sk.dark ? 0.5 : 0.4
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }
}
