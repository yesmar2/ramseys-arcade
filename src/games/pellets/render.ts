import { paintFruit } from '../fruitArt'
import { playHeader } from '../playHeader'
import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'
import {
  CLEAR_FLASH,
  CLEAR_TIME,
  CRUMB_HUE,
  DEATH_TIME,
  GHOST_HUE,
  PLAYER_HUE,
  READY_TIME,
  type Dir,
  type GameState,
  type Ghost,
  type PopTone,
} from './game'

/*
 * Drawn the house way: soft fills inside clean outlines, in the site's own
 * colours, on the site's own ground. Outlines are brighter over the dark
 * theme's ground and deeper over the light one.
 *
 * The maze is the arcade's: walls as rounded tubes with a second line inside,
 * in the site's indigo. The player is the game's orange, the crumbs gold, and
 * each chaser keeps its own colour, with eyes that look the way it is going —
 * which is how you read its next turn before it takes it.
 */

const TAU = Math.PI * 2
const FONT = '"Outfit", system-ui, sans-serif'
const WALL_HUE = 234
/** Frightened chasers: the sky blue, clear of the indigo walls. */
const SCARED_HUE = 212
const DOOR_HUE = 322

const LOOK: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

function hsla(hue: number, sat: number, light: number, alpha = 1) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

/** Outline lightness: bright over the dark theme's ground, deeper over the light one. */
const lineL = (dark: boolean) => (dark ? 66 : 42)

function frac(v: number) {
  return v - Math.floor(v)
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

/**
 * Room kept clear under the maze for the Surge button, which floats over the
 * bottom of the stage: it used to sit on the maze's last corridor.
 */
const SURGE_ROOM = 58

export function computeLayout(w: number, h: number, cols: number, rows: number) {
  const padX = Math.max(6, Math.min(20, w * 0.012))
  // Shared with every other stage, rather than a figure this worked out for
  // itself and got wrong.
  const hud = playHeader(w)
  const availW = w - padX * 2
  const availH = h - hud - SURGE_ROOM
  // Integer cells so adjacent wall edges share a pixel and outlines meet.
  const cell = Math.max(1, Math.floor(Math.min(availW / cols, availH / rows)))
  const gridW = cell * cols
  const gridH = cell * rows
  const ox = Math.round((w - gridW) / 2)
  const oy = Math.round(hud + Math.max(0, (availH - gridH) / 2))
  return { cell, ox, oy, hud, gridW, gridH }
}

type Gfx = {
  ctx: CanvasRenderingContext2D
  s: GameState
  dark: boolean
  cell: number
  ox: number
  oy: number
  gridW: number
  gridH: number
  t: number
  /** Tile coordinates to canvas px. */
  X: (v: number) => number
  Y: (v: number) => number
}

// ———————————————————————————————————————————————————————— walls

type Pt = { x: number; y: number }

function wallAt(state: GameState, x: number, y: number) {
  if (y < 0 || y >= state.rows || x < 0 || x >= state.cols) return false
  return !state.open[y][x]
}

/** Lane or off-board — both get an outline edge. */
function openOrOutside(state: GameState, x: number, y: number) {
  if (y < 0 || y >= state.rows || x < 0 || x >= state.cols) return true
  return state.open[y][x]
}

/**
 * The outline of every wall region as closed loops of corners, walked so the
 * wall is always on the right. Where two regions only touch at a corner, the
 * walk turns right first, which keeps it on the region it started round.
 */
function wallLoops(state: GameState): Pt[][] {
  const W = state.cols + 1
  const key = (x: number, y: number) => y * W + x
  const edges = new Map<number, Pt[]>()
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = key(x0, y0)
    const list = edges.get(k)
    if (list) list.push({ x: x1, y: y1 })
    else edges.set(k, [{ x: x1, y: y1 }])
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

  const loops: Pt[][] = []
  while (edges.size) {
    const [k0, list0] = edges.entries().next().value as [number, Pt[]]
    const x0 = k0 % W
    const y0 = (k0 - x0) / W
    const first = list0.pop()!
    if (!list0.length) edges.delete(k0)
    const loop: Pt[] = [{ x: x0, y: y0 }]
    let px = x0
    let py = y0
    let cx = first.x
    let cy = first.y
    for (let guard = 0; guard < 100000 && !(cx === x0 && cy === y0); guard++) {
      loop.push({ x: cx, y: cy })
      const k = key(cx, cy)
      const list = edges.get(k)
      if (!list?.length) break
      const dx = cx - px
      const dy = cy - py
      let pick = -1
      for (const [ex, ey] of [
        [-dy, dx],
        [dx, dy],
        [dy, -dx],
      ]) {
        pick = list.findIndex((q) => q.x - cx === ex && q.y - cy === ey)
        if (pick >= 0) break
      }
      const nextPt = list.splice(Math.max(0, pick), 1)[0]!
      if (!list.length) edges.delete(k)
      px = cx
      py = cy
      cx = nextPt.x
      cy = nextPt.y
    }
    const corners = loop.filter((v, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length]!
      const b = loop[(i + 1) % loop.length]!
      return (v.x - a.x) * (b.y - v.y) - (v.y - a.y) * (b.x - v.x) !== 0
    })
    if (corners.length >= 4) loops.push(corners)
  }
  return loops
}

/** Pull a loop in toward the wall by `d` tiles: every corner moves along both edges' normals. */
function insetLoop(loop: Pt[], d: number): Pt[] {
  const n = loop.length
  return loop.map((v, i) => {
    const a = loop[(i - 1 + n) % n]!
    const b = loop[(i + 1) % n]!
    const d1x = Math.sign(v.x - a.x)
    const d1y = Math.sign(v.y - a.y)
    const d2x = Math.sign(b.x - v.x)
    const d2y = Math.sign(b.y - v.y)
    return { x: v.x + (-d1y - d2y) * d, y: v.y + (d1x + d2x) * d }
  })
}

function roundedLoop(path: Path2D, pts: Pt[], r: number) {
  const n = pts.length
  const last = pts[n - 1]!
  const first = pts[0]!
  path.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
  for (let i = 0; i < n; i++) {
    const cur = pts[i]!
    const nxt = pts[(i + 1) % n]!
    const prv = pts[(i - 1 + n) % n]!
    const rr = Math.min(
      r,
      Math.hypot(cur.x - prv.x, cur.y - prv.y) / 2,
      Math.hypot(nxt.x - cur.x, nxt.y - cur.y) / 2,
    )
    path.arcTo(cur.x, cur.y, nxt.x, nxt.y, rr)
  }
  path.closePath()
}

type WallPaths = { key: string; open: boolean[][]; outer: Path2D; inner: Path2D }
let wallCache: WallPaths | null = null

/** The walls as two paths — the tube and the line inside it — rebuilt only when the maze or size changes. */
function wallPaths(g: Gfx): WallPaths {
  const { s, cell, ox, oy } = g
  const key = `${cell}:${ox}:${oy}:${s.cols}x${s.rows}`
  if (wallCache && wallCache.open === s.open && wallCache.key === key) return wallCache
  const outer = new Path2D()
  const inner = new Path2D()
  const toPx = (p: Pt) => ({ x: ox + p.x * cell, y: oy + p.y * cell })
  // Corners rounded, but not so far that a one-tile block turns into a ring:
  // a round thing on this board should only ever be something to eat.
  for (const loop of wallLoops(s)) {
    roundedLoop(outer, insetLoop(loop, 0.2).map(toPx), cell * 0.24)
    roundedLoop(inner, insetLoop(loop, 0.34).map(toPx), cell * 0.12)
  }
  wallCache = { key, open: s.open, outer, inner }
  return wallCache
}

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, dark: boolean) {
  const count = Math.round((w * h) / 7000)
  ctx.fillStyle = inkColor()
  for (let i = 1; i <= count; i++) {
    const a = frac(Math.sin(i * 12.9898) * 43758.5453)
    const b = frac(Math.sin(i * 78.233) * 12345.6789)
    const c = frac(Math.sin(i * 3.7137) * 9973.113)
    ctx.globalAlpha = dark ? 0.05 + c * 0.12 : 0.04 + c * 0.07
    ctx.beginPath()
    ctx.arc(a * w, b * h, 0.45 + c, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Offscreen cache for the ground, the panel, the floor marks and the walls. */
let staticLayer: { key: string; open: boolean[][]; canvas: HTMLCanvasElement } | null = null

function paintStatic(g: Gfx, canvas: HTMLCanvasElement, w: number, h: number, dpr: number) {
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const { s, dark, cell, ox, oy, gridW, gridH } = g

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
  drawStars(ctx, w, h, dark)

  const pad = Math.max(6, cell * 0.3)
  ctx.beginPath()
  ctx.roundRect(ox - pad, oy - pad, gridW + pad * 2, gridH + pad * 2, Math.max(12, cell * 0.55))
  ctx.fillStyle = dark ? 'rgba(6, 10, 16, 0.4)' : 'rgba(255, 255, 255, 0.55)'
  ctx.fill()
  ctx.strokeStyle = dark ? 'rgba(231, 238, 243, 0.07)' : 'rgba(26, 43, 60, 0.07)'
  ctx.lineWidth = 1
  ctx.stroke()

  // A faint mark on every lane tile, so picked-clean ground — which breaks a
  // streak — still reads as ground rather than as nothing.
  ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.07)' : 'rgba(26, 43, 60, 0.08)'
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if (!s.open[y][x] || s.door[y][x]) continue
      ctx.beginPath()
      ctx.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, Math.max(0.8, cell * 0.045), 0, TAU)
      ctx.fill()
    }
  }

  const walls = wallPaths(g)
  ctx.fillStyle = hsla(WALL_HUE, 70, 60, dark ? 0.13 : 0.14)
  ctx.fill(walls.outer)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = hsla(WALL_HUE, dark ? 85 : 66, dark ? 70 : 52, 0.95)
  ctx.lineWidth = Math.max(1.5, cell * 0.075)
  ctx.stroke(walls.outer)
  ctx.strokeStyle = hsla(WALL_HUE, dark ? 85 : 66, dark ? 70 : 52, dark ? 0.38 : 0.34)
  ctx.lineWidth = Math.max(1, cell * 0.04)
  ctx.stroke(walls.inner)

  // The den's gate.
  ctx.strokeStyle = hsla(DOOR_HUE, 70, dark ? 70 : 52, 0.95)
  ctx.lineWidth = Math.max(2, cell * 0.12)
  ctx.lineCap = 'round'
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if (!s.door[y][x]) continue
      const cx = ox + (x + 0.5) * cell
      const cy = oy + (y + 0.5) * cell
      const horizontal = !s.open[y]?.[x - 1] || !s.open[y]?.[x + 1]
      ctx.beginPath()
      if (horizontal) {
        ctx.moveTo(cx - cell * 0.42, cy)
        ctx.lineTo(cx + cell * 0.42, cy)
      } else {
        ctx.moveTo(cx, cy - cell * 0.42)
        ctx.lineTo(cx, cy + cell * 0.42)
      }
      ctx.stroke()
    }
  }
  ctx.lineCap = 'butt'
}

function drawStatic(g: Gfx, w: number, h: number, dpr: number) {
  const key = `${w}x${h}@${dpr}:${g.cell}:${g.ox}:${g.oy}:${g.dark}:${playfieldColor()}`
  if (!staticLayer || staticLayer.key !== key || staticLayer.open !== g.s.open) {
    const canvas = staticLayer?.canvas ?? document.createElement('canvas')
    paintStatic(g, canvas, w, h, dpr)
    staticLayer = { key, open: g.s.open, canvas }
  }
  g.ctx.drawImage(staticLayer.canvas, 0, 0, w, h)
}

/** A cleared maze flashes its walls, the way the arcade's does. */
function drawClearFlash(g: Gfx) {
  const { ctx, s, dark, cell } = g
  if (s.phase !== 'clearing') return
  const since = CLEAR_TIME - s.clearAnim
  if (since > CLEAR_FLASH) return
  const on = Math.floor((since / CLEAR_FLASH) * 8) % 2 === 0
  if (!on) return
  const walls = wallPaths(g)
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.95)' : hsla(WALL_HUE, 90, 70, 0.95)
  ctx.lineWidth = Math.max(2, cell * 0.1)
  ctx.lineJoin = 'round'
  ctx.stroke(walls.outer)
}

// ——————————————————————————————————————————————————————— crumbs

function drawCrumbs(g: Gfx) {
  const { ctx, s, dark, cell, X, Y, t } = g
  const r = Math.max(1.4, cell * 0.1)
  ctx.fillStyle = hsla(CRUMB_HUE, 92, dark ? 64 : 50)
  ctx.beginPath()
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if (!s.crumbs[y][x]) continue
      const cx = X(x + 0.5)
      const cy = Y(y + 0.5)
      ctx.moveTo(cx + r, cy)
      ctx.arc(cx, cy, r, 0, TAU)
    }
  }
  ctx.fill()

  const pulse = 0.88 + Math.sin(t * 6) * 0.12
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if (!s.power[y][x]) continue
      const cx = X(x + 0.5)
      const cy = Y(y + 0.5)
      const pr = cell * 0.27 * pulse
      const glow = ctx.createRadialGradient(cx, cy, pr * 0.4, cx, cy, pr * 2.4)
      glow.addColorStop(0, hsla(CRUMB_HUE, 95, 60, dark ? 0.42 : 0.34))
      glow.addColorStop(1, hsla(CRUMB_HUE, 95, 60, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, pr * 2.4, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, pr, 0, TAU)
      ctx.fillStyle = hsla(CRUMB_HUE, 92, dark ? 62 : 56, 0.9)
      ctx.fill()
      ctx.strokeStyle = hsla(CRUMB_HUE, 80, dark ? 78 : 38, 0.95)
      ctx.lineWidth = Math.max(1.2, cell * 0.05)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx - pr * 0.32, cy - pr * 0.34, pr * 0.24, 0, TAU)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.fill()
    }
  }
}

/** A crumb just eaten opens out in a ring where it was — a patter behind the chomp. */
function drawBites(g: Gfx) {
  const { ctx, s, dark, cell, X, Y } = g
  if (!s.bites.length) return
  ctx.lineWidth = Math.max(1, cell * 0.04)
  for (const bite of s.bites) {
    const k = 1 - bite.life
    const r0 = cell * (bite.power ? 0.27 : 0.1)
    ctx.globalAlpha = Math.max(0, bite.life) * 0.75
    ctx.strokeStyle = hsla(CRUMB_HUE, 90, dark ? 68 : 44)
    ctx.beginPath()
    ctx.arc(X(bite.x), Y(bite.y), r0 * (1.2 + k * 1.8), 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ———————————————————————————————————————————————————————— fruit

function drawFruit(g: Gfx) {
  const { ctx, s, dark, cell, X, Y, t } = g
  const fruit = s.fruit
  if (!fruit) return
  if (fruit.life < 2 && Math.floor(t * 7) % 2 === 0) return
  const cx = X(fruit.x)
  const cy = Y(fruit.y)
  const bob = Math.sin(t * 3) * cell * 0.04
  const glow = ctx.createRadialGradient(cx, cy, cell * 0.1, cx, cy, cell * 0.8)
  glow.addColorStop(0, hsla(CRUMB_HUE, 95, 62, dark ? 0.3 : 0.26))
  glow.addColorStop(1, hsla(CRUMB_HUE, 95, 62, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, cell * 0.8, 0, TAU)
  ctx.fill()
  paintFruit(ctx, fruit.kind, cx, cy + bob, cell * 0.42, dark)
  // A ring that empties as its time runs out.
  ctx.beginPath()
  ctx.arc(cx, cy, cell * 0.56, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(fruit.life / fruit.maxLife))
  ctx.strokeStyle = hsla(CRUMB_HUE, 90, dark ? 66 : 44, 0.8)
  ctx.lineWidth = Math.max(1, cell * 0.05)
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.lineCap = 'butt'
}

// ——————————————————————————————————————————————————————— player

function faceLocal(ctx: CanvasRenderingContext2D, dir: Dir) {
  if (dir === 'left') ctx.scale(-1, 1)
  else if (dir === 'up') ctx.rotate(-Math.PI / 2)
  else if (dir === 'down') ctx.rotate(Math.PI / 2)
}

function drawPlayer(g: Gfx) {
  const { ctx, s, dark, cell, X, Y } = g
  const cx = X(s.player.x)
  const cy = Y(s.player.y)
  const surging = s.surgeTime > 0
  const r = cell * (surging ? 0.45 : 0.41)
  const line = hsla(PLAYER_HUE, 85, dark ? 70 : 40, 0.98)
  const fill = hsla(PLAYER_HUE, 92, 60, dark ? 0.42 : 0.5)
  const lw = Math.max(1.3, cell * 0.075)

  if (s.phase === 'dying') {
    // Folds away from the mouth outward, then it is gone.
    const k = clamp01(1 - s.deathAnim / (DEATH_TIME * 0.72))
    if (k >= 1) return
    const open = 0.2 + k * (Math.PI - 0.2)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, r * (1 - k * 0.15), open, TAU - open)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = line
    ctx.lineWidth = lw
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
    return
  }

  for (const dot of s.trail) {
    ctx.beginPath()
    ctx.arc(X(dot.x), Y(dot.y), r * (0.35 + 0.5 * dot.life), 0, TAU)
    ctx.fillStyle = hsla(CRUMB_HUE, 92, 60, 0.2 * dot.life)
    ctx.fill()
  }

  // A lamp on the floor under you, so the eye finds you first on a busy board.
  const lamp = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * (surging ? 3 : 2.4))
  lamp.addColorStop(0, hsla(surging ? CRUMB_HUE : PLAYER_HUE, 90, 60, dark ? 0.24 : 0.2))
  lamp.addColorStop(1, hsla(surging ? CRUMB_HUE : PLAYER_HUE, 90, 60, 0))
  ctx.fillStyle = lamp
  ctx.beginPath()
  ctx.arc(cx, cy, r * 3, 0, TAU)
  ctx.fill()

  if (s.invuln > 0 && s.ready <= 0 && Math.floor(s.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.45

  // The mouth works while you move and rests where it stopped.
  const open = 0.08 + 0.62 * (0.5 - 0.5 * Math.cos(s.mouth * Math.PI))
  ctx.save()
  ctx.translate(cx, cy)
  faceLocal(ctx, s.player.dir)
  ctx.beginPath()
  ctx.moveTo(-r * 0.12, 0)
  ctx.arc(0, 0, r, open, TAU - open)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.stroke()
  // A shine on the crown, and an eye over the mouth.
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.7, Math.PI * 1.12, Math.PI * 1.42)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = Math.max(1, lw * 0.8)
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.ellipse(r * 0.14, -r * 0.5, r * 0.12, r * 0.15, 0, 0, TAU)
  ctx.fillStyle = dark ? '#16202b' : '#1a2b3c'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(r * 0.18, -r * 0.55, Math.max(0.6, r * 0.045), 0, TAU)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()
  ctx.globalAlpha = 1
}

// —————————————————————————————————————————————————————— chasers

function traceGhost(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, step: number) {
  const foot = cy + r * 0.9
  ctx.beginPath()
  ctx.moveTo(cx - r, foot - r * 0.1)
  ctx.lineTo(cx - r, cy - r * 0.05)
  ctx.arc(cx, cy - r * 0.05, r, Math.PI, 0)
  ctx.lineTo(cx + r, foot - r * 0.1)
  // Four feet along the hem that trade places as it goes.
  const feet = 4
  for (let i = 0; i < feet; i++) {
    const x0 = cx + r - (i * 2 * r) / feet
    const x1 = cx + r - ((i + 1) * 2 * r) / feet
    const down = (i + step) % 2 === 0
    ctx.quadraticCurveTo((x0 + x1) / 2, foot + (down ? r * 0.28 : -r * 0.02), x1, foot - r * 0.1)
  }
  ctx.closePath()
}

function drawEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: Dir, dark: boolean, rim: string) {
  const look = LOOK[dir]
  for (const side of [-1, 1]) {
    const ex = cx + side * r * 0.36 + look.x * r * 0.1
    const ey = cy - r * 0.22 + look.y * r * 0.1
    ctx.beginPath()
    ctx.ellipse(ex, ey, r * 0.25, r * 0.31, 0, 0, TAU)
    ctx.fillStyle = dark ? '#eef3f7' : '#ffffff'
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.lineWidth = Math.max(0.8, r * 0.07)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ex + look.x * r * 0.11, ey + look.y * r * 0.13, r * 0.13, 0, TAU)
    ctx.fillStyle = '#23306e'
    ctx.fill()
  }
}

function drawGhost(g: Gfx, ghost: Ghost) {
  const { ctx, s, dark, cell, X, Y, t } = g
  const bob = ghost.mode === 'den' ? Math.sin(ghost.bob) * cell * 0.08 : 0
  const cx = X(ghost.x)
  const cy = Y(ghost.y) + bob
  const r = cell * 0.4
  const lw = Math.max(1.2, cell * 0.07)

  if (ghost.mode === 'eaten') {
    // Only the eyes are left, hurrying home.
    drawEyes(ctx, cx, cy, r, ghost.dir, dark, hsla(GHOST_HUE[ghost.kind], 60, lineL(dark), 0.9))
    return
  }

  const scared = ghost.mode === 'frightened'
  const ending = scared && s.fright < 2
  const flash = ending && Math.floor(t * 8) % 2 === 0
  const hue = scared ? SCARED_HUE : GHOST_HUE[ghost.kind]
  const step = Math.floor(ghost.bob * 1.4) % 2

  if (ghost.hit > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * ghost.hit})`
    ctx.beginPath()
    ctx.arc(cx, cy, r * (1.3 + ghost.hit * 0.5), 0, TAU)
    ctx.fill()
  }

  traceGhost(ctx, cx, cy, r, step)
  // Backed with the ground, so the crumbs underneath do not show through a
  // chaser: the one thing that can kill you must not be the one you see past.
  ctx.fillStyle = playfieldColor()
  ctx.fill()
  if (flash) {
    ctx.fillStyle = dark ? 'rgba(240, 244, 250, 0.85)' : 'rgba(255, 255, 255, 0.95)'
  } else {
    ctx.fillStyle = hsla(hue, scared ? 80 : 72, 60, scared ? (dark ? 0.55 : 0.6) : dark ? 0.34 : 0.4)
  }
  ctx.fill()
  ctx.strokeStyle = flash ? hsla(356, 80, dark ? 66 : 50, 0.95) : hsla(hue, 70, lineL(dark), 0.95)
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.stroke()

  if (scared) {
    // Pin eyes and a wobbling mouth: the face of a chaser that knows it is food.
    const ink = flash ? hsla(356, 80, 50) : '#ffffff'
    ctx.fillStyle = ink
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(cx + side * r * 0.3, cy - r * 0.22, Math.max(1, r * 0.11), 0, TAU)
      ctx.fill()
    }
    ctx.strokeStyle = ink
    ctx.lineWidth = Math.max(1, r * 0.1)
    ctx.lineJoin = 'round'
    ctx.beginPath()
    const my = cy + r * 0.28
    for (let i = 0; i <= 6; i++) {
      const x = cx - r * 0.54 + (i * r * 1.08) / 6
      const y = my + (i % 2 === 0 ? r * 0.08 : -r * 0.08)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    return
  }

  const dir = ghost.mode === 'den' ? (Math.sin(ghost.bob * 0.5) > 0 ? 'up' : 'down') : ghost.dir
  drawEyes(ctx, cx, cy, r, dir, dark, hsla(hue, 70, lineL(dark), 0.95))
}

// ——————————————————————————————————————————————————————— debris

function drawBits(g: Gfx) {
  const { ctx, s, dark, cell, X, Y } = g
  for (const b of s.bits) {
    const a = clamp01(b.life / b.maxLife)
    const x = X(b.x)
    const y = Y(b.y)
    if (b.kind === 'spark') {
      ctx.globalAlpha = a
      ctx.strokeStyle = hsla(b.hue, 92, dark ? 70 : 50)
      ctx.lineWidth = Math.max(1.2, cell * b.size * 0.6)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - b.vx * cell * 0.035, y - b.vy * cell * 0.035)
      ctx.stroke()
      continue
    }
    const sz = cell * b.size
    ctx.globalAlpha = Math.min(1, a * 1.6)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(b.angle)
    ctx.beginPath()
    ctx.moveTo(sz, 0)
    ctx.lineTo(-sz * 0.6, sz * 0.72)
    ctx.lineTo(-sz * 0.42, -sz * 0.62)
    ctx.closePath()
    ctx.fillStyle = hsla(b.hue, 70, 60, dark ? 0.35 : 0.4)
    ctx.fill()
    ctx.strokeStyle = hsla(b.hue, 70, lineL(dark), 0.95)
    ctx.lineWidth = Math.max(1, sz * 0.18)
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
  }
  ctx.globalAlpha = 1
  ctx.lineCap = 'butt'
}

function drawRings(g: Gfx) {
  const { ctx, s, dark, cell, X, Y } = g
  for (const r of s.rings) {
    const k = 1 - r.life / r.maxLife
    const ease = 1 - (1 - k) ** 3
    ctx.globalAlpha = (1 - k) * 0.85
    ctx.strokeStyle = hsla(r.hue, 85, dark ? 70 : 46)
    ctx.lineWidth = Math.max(1, cell * 0.09 * (1 - k) + 0.5)
    ctx.beginPath()
    ctx.arc(X(r.x), Y(r.y), Math.max(0.5, cell * (r.r0 + (r.r1 - r.r0) * ease)), 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ————————————————————————————————————————————————————————— text

/** Text on a halo of the ground behind it, so it reads over crumbs and walls alike. */
function haloText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  colour: string,
  weight = 700,
) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const ground = playfieldColor()
  ctx.strokeStyle = ground
  ctx.lineWidth = Math.max(3, size * 0.26)
  ctx.strokeText(text, x, y)
  ctx.fillStyle = colour
  ctx.fillText(text, x, y)
}

function popColour(tone: PopTone, dark: boolean) {
  switch (tone) {
    case 'streak':
    case 'fruit':
      return hsla(CRUMB_HUE, 92, dark ? 64 : 38)
    case 'lost':
      return hsla(356, 70, dark ? 70 : 46)
    case 'ghost':
      return hsla(188, 80, dark ? 70 : 34)
    default:
      return inkColor()
  }
}

const POP_SCALE: Record<PopTone, number> = { ink: 0.5, streak: 0.62, lost: 0.46, ghost: 0.62, fruit: 0.6 }

function drawPops(g: Gfx) {
  const { ctx, s, dark, cell, X, Y } = g
  for (const pop of s.pops) {
    const k = 1 - pop.life / pop.maxLife
    // Lands big and settles, so the moment reads before the words do.
    const land = k < 0.12 ? 1 + (0.12 - k) * 2.2 : 1
    const size = Math.max(11, cell * POP_SCALE[pop.tone] * land)
    ctx.globalAlpha = Math.min(1, (pop.life / pop.maxLife) * 2.5)
    haloText(ctx, pop.text, X(pop.x), Y(pop.y) - k * cell * 0.8, size, popColour(pop.tone, dark))
  }
  ctx.globalAlpha = 1
}

/** A sign on a plate of the ground, so it reads cleanly over walls, crumbs and the den alike. */
function plate(g: Gfx, x: number, y: number, w: number, h: number) {
  const { ctx, dark } = g
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2)
  ctx.fillStyle = dark ? 'rgba(10, 16, 24, 0.86)' : 'rgba(255, 255, 255, 0.9)'
  ctx.fill()
  ctx.strokeStyle = hsla(CRUMB_HUE, 80, dark ? 60 : 48, 0.55)
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawBanners(g: Gfx) {
  const { ctx, s, dark, cell, ox, oy, gridW, gridH, X, Y } = g
  const mid = ox + gridW / 2
  const midY = oy + gridH / 2
  const big = Math.max(22, cell * 1.05)

  if (s.phase === 'playing' && s.ready > 0) {
    const k = s.ready
    const fadeIn = clamp01((READY_TIME - k) / 0.18)
    ctx.globalAlpha = Math.min(fadeIn, clamp01(k / 0.2))
    // Where the arcade puts it: between the den and the player, clear of both.
    const x = X((s.houseCenter.x + s.start.x) / 2 + 0.5)
    const y = Y((s.houseCenter.y + s.start.y) / 2 + 0.5)
    // A fresh maze says which one it is; a life lost only needs the word.
    const fresh = s.crumbsLeft === s.crumbsTotal
    const size = big * 0.8
    plate(g, x, y, size * 4.4, fresh ? size * 2.3 : size * 1.5)
    if (fresh) haloText(ctx, `Level ${s.level}`, x, y - size * 0.5, size * 0.5, inkColor(), 700)
    haloText(ctx, 'Ready!', x, y + (fresh ? size * 0.28 : 0), size, hsla(CRUMB_HUE, 92, dark ? 64 : 42), 800)
    ctx.globalAlpha = 1
  }

  if (s.phase === 'clearing') {
    const since = CLEAR_TIME - s.clearAnim
    const k = clamp01((since - 0.15) / 0.2)
    ctx.globalAlpha = Math.min(k, clamp01(s.clearAnim / 0.25))
    plate(g, mid, midY, big * 6.2, big * 2.3)
    haloText(ctx, 'Maze clear!', mid, midY - big * 0.3, big, hsla(CRUMB_HUE, 92, dark ? 64 : 42), 800)
    if (since > CLEAR_FLASH * 0.6) {
      haloText(ctx, `Level ${s.level + 1} next`, mid, midY + big * 0.6, big * 0.48, inkColor(), 700)
    }
    ctx.globalAlpha = 1
  }
}

// ——————————————————————————————————————————————————————— render

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
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const dark = isDarkTheme()
  const { cell, ox, oy, gridW, gridH } = computeLayout(w, h, state.cols, state.rows)
  const g: Gfx = {
    ctx,
    s: state,
    dark,
    cell,
    ox,
    oy,
    gridW,
    gridH,
    t: state.time,
    X: (v) => ox + v * cell,
    Y: (v) => oy + v * cell,
  }

  drawStatic(g, w, h, dpr)

  // The board shakes with a big moment; the ground behind it does not.
  ctx.save()
  if (state.shake > 0.01) {
    const m = state.shake * state.shake * cell * 0.35
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
  }

  drawClearFlash(g)
  if (state.phase !== 'clearing' || CLEAR_TIME - state.clearAnim < CLEAR_FLASH) {
    drawCrumbs(g)
  }
  drawBites(g)
  drawFruit(g)

  // Actors are clipped to the maze, so one going through a side tunnel slides
  // out of one edge and into the other rather than across the frame.
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, gridW, gridH)
  ctx.clip()
  const spanX = state.cols * cell
  const spanY = state.rows * cell
  const seams = (x: number, n: number, span: number) =>
    x < 1 ? [0, span] : x > n - 1 ? [0, -span] : [0]
  const drawAt = (x: number, y: number, draw: () => void) => {
    for (const dx of seams(x, state.cols, spanX)) {
      for (const dy of seams(y, state.rows, spanY)) {
        ctx.save()
        ctx.translate(dx, dy)
        draw()
        ctx.restore()
      }
    }
  }
  if (state.phase !== 'clearing') {
    for (const ghost of state.ghosts) drawAt(ghost.x, ghost.y, () => drawGhost(g, ghost))
  }
  if (state.phase !== 'gameover') drawAt(state.player.x, state.player.y, () => drawPlayer(g))
  ctx.restore()

  drawRings(g)
  drawBits(g)
  drawPops(g)
  ctx.restore()

  drawBanners(g)
}
