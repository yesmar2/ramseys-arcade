import type { Battery, City, GameState, Plane } from './game'

/** Plain rectangles only — scales cleanly on any stage size. */
function washBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hue: number,
  scale: number,
  sat = 52,
) {
  if (w <= 0 || h <= 0) return
  ctx.fillStyle = `hsla(${hue}, ${sat}%, 58%, 0.22)`
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, 42%, 0.95)`
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  ctx.lineJoin = 'round'
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1))
}

function washCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  hue: number,
  scale: number,
  sat = 52,
) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, ${sat}%, 58%, 0.22)`
  ctx.fill()
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, 42%, 0.95)`
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  ctx.stroke()
}

function washPoly(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  hue: number,
  scale: number,
  sat = 52,
) {
  if (pts.length < 3) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  ctx.fillStyle = `hsla(${hue}, ${sat}%, 58%, 0.22)`
  ctx.fill()
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, 42%, 0.95)`
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#edf7f4'
  ctx.fillRect(0, 0, w, h)

  const sky = ctx.createRadialGradient(w * 0.25, 0, 20, w * 0.3, 0, w * 0.85)
  sky.addColorStop(0, 'rgba(200, 232, 248, 0.95)')
  sky.addColorStop(1, 'rgba(200, 232, 248, 0)')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const mint = ctx.createRadialGradient(w * 0.9, h * 0.2, 10, w, h * 0.25, w * 0.7)
  mint.addColorStop(0, 'rgba(197, 240, 228, 0.7)')
  mint.addColorStop(1, 'rgba(197, 240, 228, 0)')
  ctx.fillStyle = mint
  ctx.fillRect(0, 0, w, h)

  const step = 28 * Math.max(0.65, Math.min(w, h) / 540)
  ctx.fillStyle = 'rgba(74, 168, 232, 0.1)'
  for (let py = step * 0.5; py < h; py += step) {
    for (let px = step * 0.5; px < w; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  groundY: number,
  h: number,
  scale: number,
) {
  const g = ctx.createLinearGradient(0, groundY - 8 * scale, 0, h)
  g.addColorStop(0, 'hsla(172, 40%, 58%, 0.16)')
  g.addColorStop(1, 'hsla(172, 35%, 52%, 0.22)')
  ctx.fillStyle = g
  ctx.fillRect(0, groundY, w, h - groundY)

  ctx.strokeStyle = 'hsla(172, 52%, 42%, 0.7)'
  ctx.lineWidth = Math.max(2, 3 * scale)
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(w, groundY)
  ctx.stroke()
}

const CITY_HUES = [198, 172, 38, 272, 18, 128]
const CITY_HEIGHTS = [
  [20, 30, 18],
  [18, 28, 22],
  [22, 26, 16],
  [16, 32, 20],
  [20, 24, 18],
  [18, 30, 16],
]

/** Same 3-building skyline for every city — no overlapping blocks. */
function drawCity(ctx: CanvasRenderingContext2D, city: City, groundY: number, scale: number) {
  const hue = CITY_HUES[city.id % CITY_HUES.length]
  const s = scale
  const heights = CITY_HEIGHTS[city.id % CITY_HEIGHTS.length]
  const blocks = [
    { x: -18, w: 10, h: heights[0] },
    { x: -5, w: 10, h: heights[1] },
    { x: 8, w: 10, h: heights[2] },
  ]

  if (!city.alive) {
    washBox(ctx, city.x - 16 * s, groundY - 5 * s, 32 * s, 5 * s, hue, s, 40)
    return
  }

  for (const b of blocks) {
    const bw = b.w * s
    const bh = b.h * s
    const bx = city.x + b.x * s
    const by = groundY - bh
    washBox(ctx, bx, by, bw, bh, hue, s)
  }
}

/** Draw a trail that stops at the circle's outer edge instead of running through it. */
function washMissile(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x: number,
  y: number,
  r: number,
  hue: number,
  scale: number,
) {
  const dx = x - x0
  const dy = y - y0
  const len = Math.hypot(dx, dy)
  const stop = r + Math.max(1.2, 1.5 * scale) * 0.5
  if (len > stop + 0.5) {
    const t = (len - stop) / len
    ctx.strokeStyle = `hsla(${hue}, 52%, 42%, 0.4)`
    ctx.lineWidth = 2 * scale
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x0 + dx * t, y0 + dy * t)
    ctx.stroke()
  }
  washCircle(ctx, x, y, r, hue, scale)
}

function drawBattery(ctx: CanvasRenderingContext2D, bat: Battery, groundY: number, scale: number) {
  const s = scale
  const x = bat.x
  const y = groundY

  if (!bat.alive) {
    washBox(ctx, x - 16 * s, y - 6 * s, 32 * s, 6 * s, 198, s, 40)
    return
  }

  washPoly(
    ctx,
    [
      { x: x - 16 * s, y },
      { x: x - 16 * s, y: y - 10 * s },
      { x: x - 6 * s, y: y - 10 * s },
      { x: x - 6 * s, y: y - 26 * s },
      { x: x - 2.5 * s, y: y - 26 * s },
      { x: x - 2.5 * s, y: y - 36 * s },
      { x: x + 2.5 * s, y: y - 36 * s },
      { x: x + 2.5 * s, y: y - 26 * s },
      { x: x + 6 * s, y: y - 26 * s },
      { x: x + 6 * s, y: y - 10 * s },
      { x: x + 16 * s, y: y - 10 * s },
      { x: x + 16 * s, y },
    ],
    198,
    s,
  )

  for (let i = 0; i < bat.ammo; i++) {
    const col = i % 5
    const row = Math.floor(i / 5)
    washCircle(
      ctx,
      x - 12 * s + col * 6 * s,
      y + 8 * s + row * 6 * s,
      1.8 * s,
      38,
      s,
    )
  }
}

function drawPlane(ctx: CanvasRenderingContext2D, plane: Plane, scale: number) {
  const s = scale
  const dir = plane.vx >= 0 ? 1 : -1
  const x = plane.x
  const y = plane.y
  const rear = x - 16 * s * dir

  const trailFrom = x - 28 * s * dir
  const stop = Math.max(1.2, 1.5 * s) * 0.5
  if (Math.abs(rear - trailFrom) > stop + 0.5) {
    ctx.strokeStyle = 'hsla(198, 30%, 42%, 0.35)'
    ctx.lineWidth = 1.5 * s
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(trailFrom, y)
    ctx.lineTo(rear - stop * dir, y)
    ctx.stroke()
  }

  const body: { x: number; y: number }[] = [
    { x: -16, y: -3 },
    { x: -16, y: -10 },
    { x: -10, y: -10 },
    { x: -10, y: -3 },
    { x: -5, y: -3 },
    { x: -5, y: -11 },
    { x: 5, y: -11 },
    { x: 5, y: -3 },
    { x: 16, y: -3 },
    { x: 16, y: 3 },
    { x: 5, y: 3 },
    { x: 5, y: 11 },
    { x: -5, y: 11 },
    { x: -5, y: 3 },
    { x: -16, y: 3 },
  ]
  washPoly(
    ctx,
    body.map((p) => ({ x: x + p.x * s * dir, y: y + p.y * s })),
    198,
    s,
    40,
  )
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

  const scale = state.scale

  drawBackground(ctx, w, h)
  drawGround(ctx, w, state.groundY, h, scale)

  for (const city of state.cities) drawCity(ctx, city, state.groundY, scale)
  for (const bat of state.batteries) drawBattery(ctx, bat, state.groundY, scale)

  for (const m of state.incoming) {
    const split = m.kind === 'split'
    const hue = split ? 272 : 348
    washMissile(ctx, m.x0, m.y0, m.x, m.y, (split ? 4.4 : 3.5) * scale, hue, scale)
  }

  for (const plane of state.planes) drawPlane(ctx, plane, scale)

  for (const s of state.shots) {
    washMissile(ctx, s.x0, s.y0, s.x, s.y, 3 * scale, 198, scale)
  }

  for (const b of state.blasts) {
    const alpha = b.growing ? 0.28 : 0.16
    ctx.fillStyle = `hsla(38, 58%, 58%, ${alpha})`
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'hsla(172, 52%, 42%, 0.7)'
    ctx.lineWidth = 2 * scale
    ctx.stroke()
  }

  for (const f of state.floaters) {
    const alpha = Math.min(1, f.life * 2) * Math.min(1, f.life * 1.4)
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = `600 ${18 * scale}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#c98a12'
    ctx.shadowColor = 'rgba(255,255,255,0.85)'
    ctx.shadowBlur = 8 * scale
    ctx.fillText(f.text, f.x, f.y)
    ctx.restore()
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.35})`
    ctx.fillRect(0, 0, w, h)
  }
}
