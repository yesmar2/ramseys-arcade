import { inkColor, isFlatTheme, playfieldColor, softFillAlpha, strokeOutlined } from '../../lib/theme'
import { FIELD_W, LANE_R, PORTAL_R, SPINNER_T, TARGET_R, type Hole, type Vec } from './course'
import {
  AIM_STUB,
  aimTrace,
  BALL_R,
  COURSE,
  CUP_R,
  cupAt,
  currentHole,
  fieldFrame,
  spinnerWall,
  SWEET,
  toScreen,
  wobbleOf,
  type Frame,
  type GameState,
} from './game'

const GREEN_HUE = 128
const SAND_HUE = 38
const WATER_HUE = 205
const PAD_HUE = 48
const PIPE_HUE = 280
const BUMPER_HUE = 348
const LANE_HUE = 198
const WALL_HUE = 214

/** The theme's ink at an alpha: text, the aim line and the flagpole read on light and dark alike. */
function ink(alpha: number) {
  const hex = inkColor().replace('#', '')
  if (hex.length !== 6) return `rgba(20, 27, 36, ${alpha})`
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** The playfield colour at an alpha, for panels that sit over the field. */
function paper(alpha: number) {
  const hex = playfieldColor().replace('#', '')
  if (hex.length !== 6) return `rgba(237, 247, 244, ${alpha})`
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * The map: the whole hole, small, in the corner of the window nearest the
 * cup. Enough to plan a route by: walls, water, sand, pads, bumpers, the
 * cup, the ball, and the part of the hole the window is showing.
 */
function drawMap(ctx: CanvasRenderingContext2D, state: GameState, hole: Hole, f: Frame, flat: boolean) {
  const len = hole.h
  const short = Math.max(44, Math.min(72, (f.rotated ? f.h : f.w) * 0.2))
  const k = short / FIELD_W
  const long = len * k
  const mw = f.rotated ? long : short
  const mh = f.rotated ? short : long
  const inset = 8
  const mx = f.x + f.w - mw - inset
  const my = f.y + inset
  const M = (x: number, y: number): Vec =>
    f.rotated ? { x: mx + (len - y) * k, y: my + x * k } : { x: mx + x * k, y: my + y * k }
  const R = (x: number, y: number, w: number, h: number) => {
    const a = M(x, y)
    const b = M(x + w, y + h)
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  }
  const line = (a: Vec, b: Vec) => {
    const p = M(a.x, a.y)
    const q = M(b.x, b.y)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }
  const dot = (p: Vec, r: number) => {
    const q = M(p.x, p.y)
    ctx.beginPath()
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  ctx.fillStyle = paper(0.88)
  ctx.strokeStyle = ink(0.22)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(mx - 4, my - 4, mw + 8, mh + 8, 6)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = `hsla(${GREEN_HUE}, 45%, 52%, 0.4)`
  R(0, 0, FIELD_W, len)
  ctx.fillStyle = `hsla(${SAND_HUE}, 60%, 55%, 0.85)`
  for (const r of hole.sand) R(r.x, r.y, r.w, r.h)
  ctx.fillStyle = `hsla(${WATER_HUE}, 70%, 55%, 0.9)`
  for (const r of hole.water) R(r.x, r.y, r.w, r.h)
  ctx.fillStyle = `hsla(${PAD_HUE}, 85%, 55%, 0.8)`
  for (const r of hole.boosts) R(r.x, r.y, r.w, r.h)

  ctx.lineCap = 'round'
  hole.walls.forEach((wall, i) => {
    if (i < 4) return
    ctx.strokeStyle = wall.kick
      ? `hsla(${BUMPER_HUE}, 55%, 50%, 0.95)`
      : `hsla(${WALL_HUE}, 22%, ${flat ? 62 : 38}%, 0.95)`
    ctx.lineWidth = Math.max(1.5, wall.t * 2 * k)
    line(wall.a, wall.b)
  })
  ctx.strokeStyle = `hsla(${WALL_HUE}, 22%, ${flat ? 62 : 38}%, 0.95)`
  ctx.lineWidth = Math.max(1.2, SPINNER_T * 2 * k)
  for (const sp of hole.spinners) {
    const blade = spinnerWall(sp, state.clock)
    line(blade.a, blade.b)
  }
  ctx.fillStyle = `hsla(${BUMPER_HUE}, 55%, 52%, 0.95)`
  for (const b of hole.bumpers) dot(b, Math.max(1.6, b.r * k))
  for (const sp of hole.spinners) dot(sp, 1.6)
  ctx.fillStyle = `hsla(${PIPE_HUE}, 60%, 55%, 0.95)`
  for (const p of hole.portals) {
    dot(p.a, Math.max(1.6, PORTAL_R * k))
    dot(p.b, Math.max(1.6, PORTAL_R * k))
  }
  ctx.fillStyle = `hsla(${PAD_HUE}, 85%, 50%, 0.95)`
  hole.targets.forEach((t, i) => {
    if (!state.targetsDown[i]) dot(t, 1.3)
  })
  ctx.fillStyle = `hsla(${LANE_HUE}, 60%, 55%, 0.9)`
  for (const l of hole.lanes) dot(l, 1.2)

  ctx.fillStyle = 'rgba(20, 27, 36, 0.95)'
  dot(cupAt(hole, state.clock), Math.max(2, CUP_R * k))
  if (state.phase !== 'gameover') {
    ctx.fillStyle = 'rgba(245, 247, 250, 1)'
    dot(state.ball, Math.max(2.2, BALL_R * k * 1.6))
    ctx.strokeStyle = 'rgba(20, 27, 36, 0.8)'
    ctx.lineWidth = 1
    const q = M(state.ball.x, state.ball.y)
    ctx.beginPath()
    ctx.arc(q.x, q.y, Math.max(2.2, BALL_R * k * 1.6), 0, Math.PI * 2)
    ctx.stroke()
  }

  // The part of the hole the window is showing.
  if (f.vis < len) {
    const a = M(0, state.cam)
    const b = M(FIELD_W, state.cam + f.vis)
    ctx.strokeStyle = ink(0.75)
    ctx.lineWidth = 1.2
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  }
  ctx.restore()
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
  const step = 26 * Math.max(0.7, Math.min(w, h) / 540)
  ctx.fillStyle = 'rgba(74, 168, 232, 0.09)'
  for (let py = step * 0.5; py < h; py += step) {
    for (let px = step * 0.5; px < w; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  drawBackground(ctx, w, h)

  const hole = currentHole(state)
  const f = fieldFrame(w, h, hole.h)
  const s = f.s
  const P = (x: number, y: number) => toScreen(f, state.cam, { x, y })
  const flat = isFlatTheme()
  const font = (size: number, weight = 800) => `${weight} ${size}px Outfit, system-ui, sans-serif`
  const textScale = Math.min(w, h)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  /** A rectangle in field units, whichever way the field lies. */
  const fieldRect = (x: number, y: number, rw: number, rh: number, radius: number) => {
    const a = P(x, y)
    const b = P(x + rw, y + rh)
    ctx.beginPath()
    ctx.roundRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y), radius)
  }
  /** A polyline through field points. */
  const fieldPath = (pts: Vec[]) => {
    ctx.beginPath()
    pts.forEach((p, i) => {
      const q = P(p.x, p.y)
      if (i === 0) ctx.moveTo(q.x, q.y)
      else ctx.lineTo(q.x, q.y)
    })
  }

  // ---- the green, seen through the window. Everything on the field is clipped to it.
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(f.x, f.y, f.w, f.h, s * 3)
  ctx.clip()
  ctx.fillStyle = `hsla(${GREEN_HUE}, 45%, 52%, ${softFillAlpha(0.2)})`
  ctx.strokeStyle = `hsla(${GREEN_HUE}, 45%, 42%, 0.9)`
  ctx.lineWidth = Math.max(1.5, s * 0.6)
  fieldRect(0, 0, FIELD_W, hole.h, s * 3)
  ctx.fill()
  strokeOutlined(ctx)

  // ---- sand
  for (const sand of hole.sand) {
    ctx.fillStyle = `hsla(${SAND_HUE}, 60%, 58%, ${softFillAlpha(0.32)})`
    ctx.strokeStyle = `hsla(${SAND_HUE}, 55%, 48%, 0.85)`
    ctx.lineWidth = Math.max(1, s * 0.5)
    fieldRect(sand.x, sand.y, sand.w, sand.h, s * 2.5)
    ctx.fill()
    strokeOutlined(ctx)
  }

  // ---- water, with a couple of ripples drifting across
  for (const pool of hole.water) {
    ctx.fillStyle = `hsla(${WATER_HUE}, 70%, 55%, ${softFillAlpha(0.38)})`
    ctx.strokeStyle = `hsla(${WATER_HUE}, 60%, 42%, 0.85)`
    ctx.lineWidth = Math.max(1, s * 0.5)
    fieldRect(pool.x, pool.y, pool.w, pool.h, s * 2.5)
    ctx.fill()
    strokeOutlined(ctx)
    ctx.save()
    ctx.clip()
    ctx.strokeStyle = `hsla(${WATER_HUE}, 70%, 80%, 0.55)`
    ctx.lineWidth = Math.max(1, s * 0.45)
    ctx.setLineDash([s * 3, s * 2.5])
    ctx.lineDashOffset = -(state.clock * s * 4) % (s * 5.5)
    const rows = Math.max(1, Math.floor(pool.h / 9))
    for (let r = 1; r <= rows; r++) {
      const y = pool.y + (pool.h * r) / (rows + 1)
      fieldPath([
        { x: pool.x + 2, y },
        { x: pool.x + pool.w - 2, y },
      ])
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.restore()
  }

  // ---- pads: chevrons run along the arrow
  for (const pad of hole.boosts) {
    ctx.fillStyle = `hsla(${PAD_HUE}, 85%, 55%, ${softFillAlpha(0.2)})`
    ctx.strokeStyle = `hsla(${PAD_HUE}, 70%, 45%, 0.85)`
    ctx.lineWidth = Math.max(1, s * 0.5)
    fieldRect(pad.x, pad.y, pad.w, pad.h, s * 2)
    ctx.fill()
    strokeOutlined(ctx)
    const dx = Math.cos(pad.dir)
    const dy = Math.sin(pad.dir)
    const px = -dy
    const py = dx
    const cx = pad.x + pad.w / 2
    const cy = pad.y + pad.h / 2
    const along = Math.abs(dx) * pad.w + Math.abs(dy) * pad.h
    const spacing = 8
    const offset = (state.clock * 16) % spacing
    ctx.strokeStyle = `hsla(${PAD_HUE}, 80%, 42%, 0.75)`
    ctx.lineWidth = Math.max(1.5, s * 0.9)
    for (let k = -along / 2 + offset; k < along / 2 - 2; k += spacing) {
      if (k < -along / 2 + 2) continue
      const tx = cx + dx * (k + 2.2)
      const ty = cy + dy * (k + 2.2)
      fieldPath([
        { x: tx - dx * 3 + px * 3.4, y: ty - dy * 3 + py * 3.4 },
        { x: tx, y: ty },
        { x: tx - dx * 3 - px * 3.4, y: ty - dy * 3 - py * 3.4 },
      ])
      ctx.stroke()
    }
  }

  // ---- lanes: a ring that lights up once the ball has rolled over it
  hole.lanes.forEach((l, i) => {
    const c = P(l.x, l.y)
    const lit = state.lanesLit[i]
    ctx.fillStyle = lit
      ? `hsla(${LANE_HUE}, 70%, 60%, ${softFillAlpha(0.7)})`
      : `hsla(${LANE_HUE}, 50%, 55%, ${softFillAlpha(0.12)})`
    ctx.strokeStyle = `hsla(${LANE_HUE}, 60%, ${lit ? 62 : 45}%, ${lit ? 1 : 0.8})`
    ctx.lineWidth = Math.max(1.2, s * 0.55)
    ctx.beginPath()
    ctx.arc(c.x, c.y, LANE_R * s, 0, Math.PI * 2)
    ctx.fill()
    strokeOutlined(ctx)
    if (!lit) {
      ctx.setLineDash([s * 1.2, s * 1.2])
      ctx.beginPath()
      ctx.arc(c.x, c.y, LANE_R * s * 0.55, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })

  // ---- walls (skip the rails; the green's edge is the rail) and kickers
  hole.walls.forEach((wall, i) => {
    if (i < 4) return
    const a = P(wall.a.x, wall.a.y)
    const b = P(wall.b.x, wall.b.y)
    if (wall.kick) {
      const flash = state.wallFlash[i] ?? 0
      ctx.strokeStyle = `hsla(${BUMPER_HUE}, 55%, ${flash > 0 ? 62 : 48}%, 0.95)`
    } else {
      ctx.strokeStyle = `hsla(${WALL_HUE}, 22%, ${flat ? 62 : 38}%, 0.95)`
    }
    ctx.lineWidth = wall.t * 2 * s
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    if (wall.kick) {
      ctx.strokeStyle = `hsla(${BUMPER_HUE}, 60%, 85%, 0.7)`
      ctx.lineWidth = Math.max(1, s * 0.5)
      ctx.setLineDash([s * 1.5, s * 1.5])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })

  // ---- windmills: a blade on a hub
  for (const sp of hole.spinners) {
    const blade = spinnerWall(sp, state.clock)
    const a = P(blade.a.x, blade.a.y)
    const b = P(blade.b.x, blade.b.y)
    const c = P(sp.x, sp.y)
    ctx.strokeStyle = `hsla(${WALL_HUE}, 22%, ${flat ? 62 : 38}%, 0.95)`
    ctx.lineWidth = SPINNER_T * 2 * s
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.fillStyle = `hsla(${BUMPER_HUE}, 55%, 52%, 0.95)`
    ctx.beginPath()
    ctx.arc(c.x, c.y, s * 2.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(245, 247, 250, 0.9)'
    ctx.beginPath()
    ctx.arc(c.x, c.y, s * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- pipes: the way in swirls, the way out points
  for (const pipe of hole.portals) {
    const a = P(pipe.a.x, pipe.a.y)
    ctx.fillStyle = `hsla(${PIPE_HUE}, 60%, 60%, ${softFillAlpha(0.35)})`
    ctx.strokeStyle = `hsla(${PIPE_HUE}, 55%, 50%, 0.95)`
    ctx.lineWidth = Math.max(1.5, s * 0.7)
    ctx.beginPath()
    ctx.arc(a.x, a.y, PORTAL_R * s, 0, Math.PI * 2)
    ctx.fill()
    strokeOutlined(ctx)
    ctx.strokeStyle = `hsla(${PIPE_HUE}, 55%, 40%, 0.9)`
    ctx.lineWidth = Math.max(1, s * 0.5)
    for (let k = 0; k < 3; k++) {
      const start = state.clock * 2.4 + (k * Math.PI * 2) / 3
      ctx.beginPath()
      ctx.arc(a.x, a.y, PORTAL_R * s * 0.55, start, start + 1.1)
      ctx.stroke()
    }
    const b = P(pipe.b.x, pipe.b.y)
    ctx.strokeStyle = `hsla(${PIPE_HUE}, 55%, 50%, 0.95)`
    ctx.lineWidth = Math.max(1.5, s * 0.7)
    ctx.setLineDash([s * 1.6, s * 1.4])
    ctx.beginPath()
    ctx.arc(b.x, b.y, PORTAL_R * s, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    const dx = Math.cos(pipe.out)
    const dy = Math.sin(pipe.out)
    const tipX = pipe.b.x + dx * (PORTAL_R + 3.2)
    const tipY = pipe.b.y + dy * (PORTAL_R + 3.2)
    ctx.fillStyle = `hsla(${PIPE_HUE}, 55%, 50%, 0.95)`
    fieldPath([
      { x: tipX, y: tipY },
      { x: tipX - dx * 2.8 - dy * 2.2, y: tipY - dy * 2.8 + dx * 2.2 },
      { x: tipX - dx * 2.8 + dy * 2.2, y: tipY - dy * 2.8 - dx * 2.2 },
    ])
    ctx.closePath()
    ctx.fill()
  }

  // ---- bumpers: pop when hit
  hole.bumpers.forEach((b, i) => {
    const c = P(b.x, b.y)
    const flash = state.bumperFlash[i] ?? 0
    const punch = flash > 0 ? 1 + 0.18 * (flash / 0.35) : 1
    ctx.fillStyle = `hsla(${BUMPER_HUE}, 55%, 58%, ${softFillAlpha(flash > 0 ? 0.6 : 0.3)})`
    ctx.strokeStyle = `hsla(${BUMPER_HUE}, 55%, 46%, 0.95)`
    ctx.lineWidth = Math.max(1.5, s * 0.7)
    ctx.beginPath()
    ctx.arc(c.x, c.y, b.r * s * punch, 0, Math.PI * 2)
    ctx.fill()
    strokeOutlined(ctx)
    ctx.fillStyle = `hsla(${BUMPER_HUE}, 55%, 46%, ${flash > 0 ? 0.95 : 0.6})`
    ctx.beginPath()
    ctx.arc(c.x, c.y, b.r * s * 0.36, 0, Math.PI * 2)
    ctx.fill()
  })

  // ---- drop targets: up until hit, then a ghost until the bank resets
  hole.targets.forEach((tg, i) => {
    const c = P(tg.x, tg.y)
    const down = state.targetsDown[i]
    const half = TARGET_R * s * 0.95
    ctx.beginPath()
    ctx.roundRect(c.x - half, c.y - half, half * 2, half * 2, half * 0.45)
    if (down) {
      ctx.strokeStyle = `hsla(${PAD_HUE}, 60%, 45%, 0.45)`
      ctx.lineWidth = Math.max(1, s * 0.4)
      ctx.setLineDash([s * 1.2, s * 1.2])
      ctx.stroke()
      ctx.setLineDash([])
      return
    }
    ctx.fillStyle = `hsla(${PAD_HUE}, 85%, 58%, ${softFillAlpha(0.75)})`
    ctx.strokeStyle = `hsla(${PAD_HUE}, 70%, 40%, 0.95)`
    ctx.lineWidth = Math.max(1.2, s * 0.6)
    ctx.fill()
    strokeOutlined(ctx)
    ctx.fillStyle = `hsla(${PAD_HUE}, 70%, 35%, 0.8)`
    ctx.beginPath()
    ctx.arc(c.x, c.y, half * 0.3, 0, Math.PI * 2)
    ctx.fill()
  })

  // ---- cup and flag; a sliding cup shows the slot it runs in
  const cup = cupAt(hole, state.clock)
  if (hole.cupPath) {
    const a = P(hole.cup.x, hole.cup.y)
    const b = P(hole.cupPath.to.x, hole.cupPath.to.y)
    ctx.strokeStyle = `hsla(${GREEN_HUE}, 40%, 30%, 0.35)`
    ctx.lineWidth = CUP_R * 2 * s
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  {
    const c = P(cup.x, cup.y)
    ctx.fillStyle = 'rgba(20, 27, 36, 0.9)'
    ctx.beginPath()
    ctx.arc(c.x, c.y, CUP_R * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `hsla(${GREEN_HUE}, 40%, 30%, 0.8)`
    ctx.lineWidth = Math.max(1, s * 0.4)
    ctx.stroke()
    // The flag stands up the screen whichever way the field lies.
    ctx.strokeStyle = ink(0.85)
    ctx.lineWidth = Math.max(1.2, s * 0.5)
    ctx.beginPath()
    ctx.moveTo(c.x + s * 0.6, c.y - s * 0.4)
    ctx.lineTo(c.x + s * 0.6, c.y - s * 9)
    ctx.stroke()
    ctx.fillStyle = 'hsla(348, 62%, 58%, 0.95)'
    ctx.beginPath()
    ctx.moveTo(c.x + s * 0.6, c.y - s * 9)
    ctx.lineTo(c.x + s * 6.5, c.y - s * 7.4)
    ctx.lineTo(c.x + s * 0.6, c.y - s * 5.8)
    ctx.closePath()
    ctx.fill()
  }

  // ---- aim: a short stub in the direction of the shot. The rest is up to you.
  if (state.phase === 'aim') {
    const wobbling = state.swing === 'accuracy'
    const power = state.swing === 'power' ? state.meter : wobbling ? state.power : 0
    const live = state.aiming || state.swing !== 'idle'
    const b = P(state.ball.x, state.ball.y)
    const stub = (angle: number, color: string, width: number, head: boolean) => {
      const end = aimTrace(state, angle, AIM_STUB)
      const e = P(end.x, end.y)
      ctx.save()
      ctx.setLineDash([s * 1.4, s * 1.6])
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(e.x, e.y)
      ctx.stroke()
      ctx.restore()
      if (!head) return
      // Arrowhead, in screen space so the rotation is right.
      const a = Math.atan2(e.y - b.y, e.x - b.x)
      const dist = Math.hypot(e.x - b.x, e.y - b.y)
      const tipX = b.x + Math.cos(a) * Math.min(dist, s * 8)
      const tipY = b.y + Math.sin(a) * Math.min(dist, s * 8)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(tipX + Math.cos(a) * s * 1.8, tipY + Math.sin(a) * s * 1.8)
      ctx.lineTo(tipX + Math.cos(a + 2.4) * s * 1.5, tipY + Math.sin(a + 2.4) * s * 1.5)
      ctx.lineTo(tipX + Math.cos(a - 2.4) * s * 1.5, tipY + Math.sin(a - 2.4) * s * 1.5)
      ctx.closePath()
      ctx.fill()
    }
    if (wobbling) {
      // The line you chose stays faint underneath; the arrow wanders across it. Tap when they meet.
      stub(state.aim, ink(0.3), Math.max(1.2, s * 0.5), false)
      const off = Math.min(1, Math.abs(state.meter))
      const hue = off <= SWEET ? 128 : 128 - ((off - SWEET) / (1 - SWEET)) * 128
      stub(state.aim + wobbleOf(state), `hsla(${hue}, 70%, 48%, 0.95)`, Math.max(1.6, s * 0.8), true)
    } else {
      const hue = 128 - power * 100
      const color = live ? `hsla(${hue}, 65%, 50%, 0.95)` : ink(0.5)
      stub(state.aim, color, Math.max(1.4, s * (live ? 0.7 : 0.55)), true)
    }
  }

  // ---- ball
  if (state.phase !== 'menu' && state.phase !== 'gameover' && state.drop > 0) {
    const c = P(state.ball.x, state.ball.y)
    const r = BALL_R * s * state.drop
    ctx.fillStyle = state.inSand ? 'rgba(240, 232, 216, 0.98)' : 'rgba(245, 247, 250, 0.98)'
    ctx.strokeStyle = 'rgba(20, 27, 36, 0.55)'
    ctx.lineWidth = Math.max(1, s * 0.45)
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
    ctx.fill()
    strokeOutlined(ctx)
  }

  // ---- floaters: "+50" rising off a bumper or a lane
  for (const fl of state.floaters) {
    const c = P(fl.x, fl.y)
    const rise = (0.9 - fl.life) * s * 6
    const alpha = Math.min(1, fl.life / 0.3)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(11, s * 4.2), 800)
    ctx.fillStyle =
      fl.text === 'SPLASH' ? `hsla(${WATER_HUE}, 70%, 45%, ${alpha})` : `hsla(${LANE_HUE}, 70%, 60%, ${alpha})`
    ctx.fillText(fl.text, c.x, c.y - rise)
  }

  // End of the field: the window's clip comes off, and the map goes in its corner.
  ctx.restore()
  if (state.phase !== 'menu') drawMap(ctx, state, hole, f, flat)

  // ---- the band above: hole, par, strokes, and this hole's pinball so far
  if (state.phase !== 'menu') {
    const holeNo = Math.min(state.holeIndex + 1, COURSE.length)
    const inset = Math.max(w * 0.12, 56)
    const cy = f.top * 0.55
    const hasBonus = state.holeBonus > 0
    // With pinball on the board the right side takes two lines, and the top line lifts to make room.
    const lift = hasBonus ? f.top * 0.17 : 0
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(12, textScale * 0.035), 800)
    ctx.fillStyle = ink(0.92)
    ctx.fillText(`HOLE ${holeNo}`, inset, cy - lift)
    ctx.textAlign = 'right'
    ctx.fillStyle = ink(0.62)
    ctx.font = font(Math.max(11, textScale * 0.03), 750)
    const strokeWord = state.strokes === 1 ? 'STROKE' : 'STROKES'
    ctx.fillText(`PAR ${hole.par}  ·  ${state.strokes} ${strokeWord}`, w - inset, cy - lift)
    if (hasBonus) {
      ctx.font = font(Math.max(10, textScale * 0.026), 800)
      ctx.fillStyle = `hsla(${LANE_HUE}, 60%, 48%, 0.95)`
      ctx.fillText(`PINBALL +${state.holeBonus}`, w - inset, cy + f.top * 0.2)
    }
  }

  // ---- the band below: the swing gauge while it runs, the cue otherwise
  {
    const by = h - f.bottom / 2
    if (state.phase === 'aim' && state.swing !== 'idle') {
      const gw = Math.min(w * 0.6, 380)
      const gh = Math.max(10, Math.min(16, f.bottom * 0.3))
      const gx = (w - gw) / 2
      const gy = by - gh / 2
      const accuracy = state.swing === 'accuracy'
      ctx.fillStyle = ink(0.1)
      ctx.beginPath()
      ctx.roundRect(gx, gy, gw, gh, gh / 2)
      ctx.fill()
      if (accuracy) {
        // The wobble, centred: the sweet spot in the middle, the marker swinging through it.
        const X = (m: number) => gx + ((m + 1) / 2) * gw
        ctx.fillStyle = `hsla(${GREEN_HUE}, 70%, 45%, 0.9)`
        ctx.beginPath()
        ctx.rect(X(-SWEET), gy - 2, X(SWEET) - X(-SWEET), gh + 4)
        ctx.fill()
        ctx.strokeStyle = ink(0.35)
        ctx.lineWidth = 1
        for (const q of [-0.5, 0.5]) {
          ctx.beginPath()
          ctx.moveTo(X(q), gy - 3)
          ctx.lineTo(X(q), gy + gh + 3)
          ctx.stroke()
        }
        const mx = X(Math.max(-1, Math.min(1, state.meter)))
        ctx.strokeStyle = ink(0.95)
        ctx.lineWidth = Math.max(2, gh * 0.22)
        ctx.beginPath()
        ctx.moveTo(mx, gy - 5)
        ctx.lineTo(mx, gy + gh + 5)
        ctx.stroke()
      } else {
        // The gauge filling with power.
        const hue = 128 - state.meter * 100
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.95)`
        ctx.beginPath()
        ctx.roundRect(gx, gy, Math.max(gh, gw * state.meter), gh, gh / 2)
        ctx.fill()
        ctx.strokeStyle = ink(0.35)
        ctx.lineWidth = 1
        for (const q of [0.25, 0.5, 0.75]) {
          ctx.beginPath()
          ctx.moveTo(gx + gw * q, gy - 3)
          ctx.lineTo(gx + gw * q, gy + gh + 3)
          ctx.stroke()
        }
      }
      ctx.strokeStyle = ink(0.5)
      ctx.lineWidth = Math.max(1, gh * 0.12)
      ctx.beginPath()
      ctx.roundRect(gx, gy, gw, gh, gh / 2)
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = font(Math.max(10, textScale * 0.024), 800)
      ctx.fillStyle = ink(0.7)
      const label = accuracy
        ? `${Math.round(state.power * 100)}%  ·  TAP WHEN THE ARROW IS ON YOUR LINE`
        : `${Math.round(state.meter * 100)}%`
      ctx.fillText(label, w / 2, gy - Math.max(8, textScale * 0.02))
    } else {
      let cue = ''
      if (state.phase === 'aim') cue = state.aiming ? 'LET GO, THEN TAP TO SWING' : 'DRAG TO AIM  ·  TAP, TAP FOR POWER, TAP ON YOUR LINE'
      else if (state.phase === 'intro') cue = hole.name.toUpperCase()
      if (cue) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = font(Math.max(11, textScale * 0.027), 750)
        ctx.fillStyle = ink(0.5)
        ctx.fillText(cue, w / 2, by)
      }
    }
  }

  // ---- hole intro, over the field
  if (state.phase === 'intro') {
    const cx = f.x + f.w / 2
    const cy = f.y + f.h * 0.46
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = ink(0.96)
    ctx.font = font(Math.max(22, textScale * 0.085), 800)
    ctx.fillText(`Hole ${state.holeIndex + 1}`, cx, cy)
    ctx.font = font(Math.max(13, textScale * 0.04), 750)
    ctx.fillStyle = ink(0.7)
    ctx.fillText(`Par ${hole.par}  ·  ${hole.name}`, cx, cy + textScale * 0.08)
  }

  // ---- popup: the result of the hole, or a splash
  if (state.popup) {
    const life = state.popup.life
    const rise = (1.7 - life) * s * 5
    const alpha = Math.min(1, life / 0.4)
    const cx = f.x + f.w / 2
    const cy = f.y + f.h * 0.5
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(Math.max(20, textScale * 0.075), 800)
    ctx.fillStyle = ink(0.96 * alpha)
    ctx.fillText(state.popup.text, cx, cy - rise)
    if (state.popup.sub) {
      ctx.font = font(Math.max(13, textScale * 0.04), 800)
      ctx.fillStyle = `hsla(${GREEN_HUE}, 55%, 50%, ${alpha})`
      ctx.fillText(state.popup.sub, cx, cy - rise + textScale * 0.07)
    }
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.25})`
    ctx.fillRect(0, 0, w, h)
  }
}
