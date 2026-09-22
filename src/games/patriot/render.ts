import type { Battery, Bomber, City, Drone, GameState, Plane } from './game'
import { POWER_HUE, shieldRadius } from './game'
import { PATRIOT_CITY_DRAW, PATRIOT_CITY_HUES, patriotCityRects } from './cityArt'
import {
  PATRIOT_TURRET_HALF_WIDTH,
  PATRIOT_TURRET_HUE,
  patriotTurretPoints,
} from './turretArt'
import {
  isDarkTheme,
  isFlatTheme,
  playfieldColor,
  softFillAlpha,
  strokeOutlined,
} from '../../lib/theme'

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
  ctx.fillStyle = `hsla(${hue}, ${sat}%, 58%, ${softFillAlpha(0.22)})`
  ctx.fillRect(x, y, w, h)
  if (!isFlatTheme()) {
    ctx.strokeStyle = `hsla(${hue}, ${sat}%, 42%, 0.95)`
    ctx.lineWidth = Math.max(1.2, 1.5 * scale)
    ctx.lineJoin = 'round'
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1))
  }
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
  ctx.fillStyle = `hsla(${hue}, ${sat}%, 58%, ${softFillAlpha(0.22)})`
  ctx.fill()
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, 42%, 0.95)`
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  strokeOutlined(ctx)
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
  ctx.fillStyle = `hsla(${hue}, ${sat}%, 58%, ${softFillAlpha(0.22)})`
  ctx.fill()
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, 42%, 0.95)`
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  ctx.lineJoin = 'round'
  strokeOutlined(ctx)
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
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

/** Same 3-building skyline for every city — no overlapping blocks. */
function drawCity(ctx: CanvasRenderingContext2D, city: City, groundY: number, scale: number) {
  const hue = PATRIOT_CITY_HUES[city.id % PATRIOT_CITY_HUES.length]
  const s = scale * PATRIOT_CITY_DRAW

  if (!city.alive) {
    washBox(ctx, city.x - 16 * s, groundY - 5 * s, 32 * s, 5 * s, hue, scale, 40)
    return
  }

  for (const block of patriotCityRects(city.x, groundY, scale, city.id)) {
    washBox(ctx, block.x, block.y, block.width, block.height, block.hue, scale)
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
    washBox(
      ctx,
      x - PATRIOT_TURRET_HALF_WIDTH * s,
      y - 5 * s,
      PATRIOT_TURRET_HALF_WIDTH * 2 * s,
      5 * s,
      PATRIOT_TURRET_HUE,
      s,
      40,
    )
    return
  }

  washPoly(ctx, patriotTurretPoints(x, y, s), PATRIOT_TURRET_HUE, s)

  for (let i = 0; i < bat.ammo; i++) {
    const col = i % 5
    const row = Math.floor(i / 5)
    const gap = 10.2 * s
    washCircle(
      ctx,
      x - gap * 2 + col * gap,
      y + 14 * s + row * gap,
      4.2 * s,
      38,
      s,
    )
  }
}

function craftLocal(
  x: number,
  y: number,
  dir: number,
  s: number,
  pts: { x: number; y: number }[],
) {
  return pts.map((p) => ({ x: x + p.x * s * dir, y: y + p.y * s }))
}

function craftTrail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  s: number,
  rear: number,
  length: number,
  hue: number,
  width: number,
) {
  const rearX = x - rear * s * dir
  const fromX = x - (rear + length) * s * dir
  const stop = Math.max(1.2, 1.5 * s) * 0.5
  if (Math.abs(rearX - fromX) <= stop + 0.5) return
  ctx.strokeStyle = `hsla(${hue}, 35%, 40%, 0.38)`
  ctx.lineWidth = width * s
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(fromX, y)
  ctx.lineTo(rearX - stop * dir, y)
  ctx.stroke()
}

/*
 * One outline per craft.
 *
 * These were each built from four or five overlapping polygons — wings, then a
 * fuselage over them, then a tailplane, then pods, then a nose — and every one
 * of those carries its own stroke. At the size they actually fly at that is a
 * knot of lines with a shape somewhere inside it. A single silhouette per
 * craft reads as the thing from across the field, and the three stay apart by
 * shape rather than by detail: the plane is a swept dart, the bomber is blunt
 * with straight wings and a double tail, the drone hangs under a rotor.
 */

/** Swept dart, notched tail. */
const PLANE_BODY = [
  { x: 21, y: 0 },
  { x: -9, y: -15 },
  { x: -17, y: -15 },
  { x: -21, y: -6 },
  { x: -13, y: 0 },
  { x: -21, y: 6 },
  { x: -17, y: 15 },
  { x: -9, y: 15 },
] as const

/** Blunt nose, straight wings, wide tailplane — heavier than the plane. */
const BOMBER_BODY = [
  { x: 30, y: -4 },
  { x: 33, y: 0 },
  { x: 30, y: 4 },
  { x: 6, y: 6 },
  { x: 2, y: 22 },
  { x: -9, y: 22 },
  { x: -7, y: 6 },
  { x: -25, y: 6 },
  { x: -30, y: 17 },
  { x: -36, y: 17 },
  { x: -33, y: 0 },
  { x: -36, y: -17 },
  { x: -30, y: -17 },
  { x: -25, y: -6 },
  { x: -7, y: -6 },
  { x: -9, y: -22 },
  { x: 2, y: -22 },
  { x: 6, y: -6 },
] as const

/** Cabin slung under the rotor bar. */
const DRONE_BODY = [
  { x: -10, y: -5 },
  { x: 7, y: -5 },
  { x: 12, y: 0 },
  { x: 7, y: 6 },
  { x: -10, y: 6 },
] as const

function drawPlane(ctx: CanvasRenderingContext2D, plane: Plane, scale: number) {
  const s = scale
  const dir = plane.vx >= 0 ? 1 : -1
  const hue = 198

  craftTrail(ctx, plane.x, plane.y, dir, s, 20, 16, hue, 1.6)
  washPoly(ctx, craftLocal(plane.x, plane.y, dir, s, [...PLANE_BODY]), hue, s, 46)
  // The one mark that says which way it is pointing.
  washCircle(ctx, plane.x + 9 * s * dir, plane.y, 2.6 * s, hue, s, 62)
}

function drawBomber(ctx: CanvasRenderingContext2D, bomber: Bomber, scale: number) {
  const s = scale
  const dir = bomber.vx >= 0 ? 1 : -1
  const x = bomber.x
  const y = bomber.y
  const hue = 18

  craftTrail(ctx, x, y - 4 * s, dir, s, 34, 22, hue, 2.2)
  craftTrail(ctx, x, y + 4 * s, dir, s, 34, 22, hue, 2.2)
  washPoly(ctx, craftLocal(x, y, dir, s, [...BOMBER_BODY]), hue, s, 50)
  washCircle(ctx, x + 18 * s * dir, y, 3.4 * s, hue, s, 60)


  // Health bar — segmented so each hit reads clearly
  const maxHp = Math.max(1, bomber.maxHp)
  const hp = Math.max(0, bomber.hp)
  const segGap = 2.2 * s
  const segW = 10 * s
  const segH = 6.5 * s
  const barW = maxHp * segW + (maxHp - 1) * segGap
  const barX = x - barW / 2
  const barY = y + 30 * s
  const pad = 3.2 * s

  ctx.fillStyle = 'hsla(18, 20%, 18%, 0.55)'
  ctx.fillRect(barX - pad, barY - pad * 0.55, barW + pad * 2, segH + pad * 1.1)
  if (!isFlatTheme()) {
    ctx.strokeStyle = 'hsla(18, 45%, 36%, 0.9)'
    ctx.lineWidth = Math.max(1.2, 1.4 * s)
    ctx.strokeRect(
      barX - pad + 0.5,
      barY - pad * 0.55 + 0.5,
      barW + pad * 2 - 1,
      segH + pad * 1.1 - 1,
    )
  }

  for (let i = 0; i < maxHp; i++) {
    const sx = barX + i * (segW + segGap)
    const filled = i < hp
    const t = hp / maxHp
    ctx.fillStyle = filled
      ? t > 0.55
        ? 'hsla(128, 52%, 48%, 0.95)'
        : t > 0.3
          ? 'hsla(38, 72%, 52%, 0.95)'
          : 'hsla(8, 74%, 54%, 0.95)'
      : 'hsla(0, 0%, 100%, 0.12)'
    ctx.fillRect(sx, barY, segW, segH)
    if (!isFlatTheme()) {
      ctx.strokeStyle = filled
        ? 'hsla(18, 40%, 28%, 0.75)'
        : 'hsla(18, 25%, 40%, 0.45)'
      ctx.lineWidth = Math.max(1, 1.1 * s)
      ctx.strokeRect(sx + 0.5, barY + 0.5, segW - 1, segH - 1)
    }
  }
}

function drawDrone(ctx: CanvasRenderingContext2D, drone: Drone, scale: number) {
  const s = scale
  const dir = drone.vx >= 0 ? 1 : -1
  const x = drone.x
  const y = drone.y
  const hue = POWER_HUE[drone.kind]
  // The cabin hangs below the bar, so the rotor reads as holding it up.
  const body = y + 5 * s

  craftTrail(ctx, x, body, dir, s, 13, 14, hue, 1.4)

  // Rotor: one bar and the mast, instead of a cross plus a pair of skids.
  washBox(ctx, x - 15 * s, y - 7.6 * s, 30 * s, 2.2 * s, hue, s, 48)
  washBox(ctx, x - 1.1 * s, y - 6 * s, 2.2 * s, 5 * s, hue, s, 48)

  washPoly(ctx, craftLocal(x, body, dir, s, [...DRONE_BODY]), hue, s, 58)

  // What it is carrying — the one detail that has to survive the shrink.
  if (drone.kind === 'ammo') {
    const arm = 2.4 * s
    washBox(ctx, x - arm * 1.8, body - arm * 0.4, arm * 3.6, arm * 0.8, hue, s, 74)
    washBox(ctx, x - arm * 0.4, body - arm * 1.8, arm * 0.8, arm * 3.6, hue, s, 74)
  } else if (drone.kind === 'shield') {
    washCircle(ctx, x, body, 3.4 * s, hue, s, 74)
  } else if (drone.kind === 'slow') {
    washBox(ctx, x - 3.4 * s, body - 1.2 * s, 6.8 * s, 2.4 * s, hue, s, 74)
  } else {
    washCircle(ctx, x, body, 4 * s, hue, s, 74)
    washCircle(ctx, x, body, 1.7 * s, hue, s, 80)
  }
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

  if (state.slowT > 0) {
    ctx.fillStyle = 'rgba(74, 168, 232, 0.08)'
    ctx.fillRect(0, 0, w, state.groundY)
  }

  for (const city of state.cities) drawCity(ctx, city, state.groundY, scale)
  for (const bat of state.batteries) drawBattery(ctx, bat, state.groundY, scale)

  for (const city of state.cities) {
    if (!city.alive || !city.shielded) continue
    const r = shieldRadius(scale)
    const pulse = softFillAlpha(0.28)
    ctx.beginPath()
    ctx.arc(city.x, state.groundY, r, Math.PI, 0)
    ctx.fillStyle = `hsla(172, 52%, 48%, ${pulse})`
    ctx.fill()
    ctx.strokeStyle = 'hsla(172, 52%, 42%, 0.9)'
    ctx.lineWidth = 2.4 * scale
    strokeOutlined(ctx)
  }

  for (const m of state.incoming) {
    const split = m.kind === 'split'
    const hue = split ? 272 : 348
    washMissile(ctx, m.x0, m.y0, m.x, m.y, (split ? 5.6 : 4.6) * scale, hue, scale)
  }

  for (const plane of state.planes) drawPlane(ctx, plane, scale)
  for (const bomber of state.bombers ?? []) drawBomber(ctx, bomber, scale)
  for (const drone of state.drones ?? []) drawDrone(ctx, drone, scale)

  for (const s of state.shots) {
    washMissile(ctx, s.x0, s.y0, s.x, s.y, (s.burst ? 5.4 : 4) * scale, s.burst ? 272 : 198, scale)
  }

  for (const b of state.blasts) {
    if ((b.wait ?? 0) > 0 || b.r < 2) continue
    const hue = b.burst ? 272 : 38
    const alpha = softFillAlpha(b.growing ? 0.28 : 0.16)
    ctx.fillStyle = `hsla(${hue}, 58%, 58%, ${alpha})`
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = b.burst ? 'hsla(272, 52%, 42%, 0.75)' : 'hsla(172, 52%, 42%, 0.7)'
    ctx.lineWidth = (b.burst ? 3 : 2) * scale
    strokeOutlined(ctx)
  }

  // Gold either way, but a gold that carries against the field behind it: the
  // one shade was tuned on the dark playfield and sat near 2.5:1 on the light
  // one. The halo is the playfield, so it separates the text in both.
  const dark = isDarkTheme()
  const floaterInk = dark ? '#f0b429' : '#8a5a06'
  for (const f of state.floaters) {
    const alpha = Math.min(1, f.life * 2) * Math.min(1, f.life * 1.4)
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = `600 ${18 * scale}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = floaterInk
    ctx.shadowColor = playfieldColor()
    ctx.shadowBlur = 8 * scale
    ctx.fillText(f.text, f.x, f.y)
    ctx.restore()
  }

  // White over a near-white playfield moved it about three points and read as
  // nothing, so the light theme flashes dark instead.
  if (state.flash > 0) {
    ctx.fillStyle = dark
      ? `rgba(255,255,255,${state.flash * 0.35})`
      : `rgba(26,43,60,${state.flash * 0.24})`
    ctx.fillRect(0, 0, w, h)
  }
}
