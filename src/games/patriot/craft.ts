import type { Swatch } from '../../data/games'
import {
  PICKUP_FLIGHT,
  POWER_ORDER,
  POWER_SWATCH,
  type Bomber,
  type Drone,
  type GameState,
  type Plane,
  type PowerKind,
} from './game'
import { clamp01, css, hsla, hue, mix, outline, soft, type RGB, type Skin } from './paint'

/*
 * What flies over the cities, seen side on like everything else on the field.
 *
 * Each craft is one silhouette with one outline — wings, fin and canopy are
 * part of its edge or marks inside it, never shapes stacked on shapes, which at
 * flying size is a knot of lines. They stay apart by shape: the jet is a dart
 * with a swept fin and an afterburner, the bomber a long heavy hull with a tall
 * fin and engines slung underneath, and the carrier a blimp — round, slow-
 * looking, friendly — with what it carries painted big on its side.
 */

/** Draw in craft units: +x toward the nose, mirrored for a craft flying left. */
function pen(ctx: CanvasRenderingContext2D, ox: number, oy: number, dir: number, u: number) {
  const X = (x: number) => ox + x * u * dir
  const Y = (y: number) => oy + y * u
  return {
    m: (x: number, y: number) => ctx.moveTo(X(x), Y(y)),
    l: (x: number, y: number) => ctx.lineTo(X(x), Y(y)),
    q: (cx: number, cy: number, x: number, y: number) => ctx.quadraticCurveTo(X(cx), Y(cy), X(x), Y(y)),
    c: (ax: number, ay: number, bx: number, by: number, x: number, y: number) =>
      ctx.bezierCurveTo(X(ax), Y(ay), X(bx), Y(by), X(x), Y(y)),
    X,
    Y,
  }
}

function poly(ctx: CanvasRenderingContext2D, p: ReturnType<typeof pen>, pts: [number, number][]) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i === 0 ? p.m(x, y) : p.l(x, y)))
  ctx.closePath()
}

/** A vapour trail: widest and brightest at the craft, gone a little way back. */
function contrail(ctx: CanvasRenderingContext2D, sk: Skin, x: number, y: number, dir: number, len: number, width: number) {
  const g = ctx.createLinearGradient(x, y, x - len * dir, y)
  const col: RGB = sk.dark ? [226, 236, 255] : sk.ink
  g.addColorStop(0, css(col, sk.dark ? 0.32 : 0.16))
  g.addColorStop(1, css(col, 0))
  ctx.strokeStyle = g
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - len * dir, y)
  ctx.stroke()
}

function flame(ctx: CanvasRenderingContext2D, sk: Skin, p: ReturnType<typeof pen>, at: number, half: number, len: number) {
  ctx.beginPath()
  p.m(at, -half)
  p.q(at - len * 0.55, -half * 0.9, at - len, 0)
  p.q(at - len * 0.55, half * 0.9, at, half)
  ctx.closePath()
  ctx.fillStyle = sk.dark ? hsla(hue('orange'), 95, 62, 0.85) : hsla(hue('orange'), 90, 58, 0.8)
  ctx.fill()
  ctx.beginPath()
  p.m(at, -half * 0.55)
  p.q(at - len * 0.35, -half * 0.45, at - len * 0.6, 0)
  p.q(at - len * 0.35, half * 0.45, at, half * 0.55)
  ctx.closePath()
  ctx.fillStyle = sk.dark ? 'rgba(255, 246, 214, 0.95)' : hsla(hue('amber'), 95, 70, 0.95)
  ctx.fill()
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, h: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, hsla(h, 90, 64, a))
  g.addColorStop(1, hsla(h, 90, 64, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

// The jet --------------------------------------------------------------------------

/** Nose at +24, tail at -27.5; fin up to -14.5, wing down to +9.6. */
function jetPath(ctx: CanvasRenderingContext2D, p: ReturnType<typeof pen>) {
  ctx.beginPath()
  p.m(24, 0.6)
  p.q(21, -2.6, 15, -3.6)
  p.q(10, -8.4, 3, -5.2)
  p.l(-13, -4.4)
  p.l(-21, -14.5)
  p.l(-25.5, -14.5)
  p.l(-24, -4)
  p.l(-27.5, -2.6)
  p.l(-27.5, 2.4)
  p.l(-19, 3.4)
  p.l(-11, 3.4)
  p.l(-17.5, 9.6)
  p.l(-11.5, 9.6)
  p.l(2, 3.4)
  p.l(13, 3)
  p.q(20, 2.6, 24, 0.6)
  ctx.closePath()
}

export function drawPlane(ctx: CanvasRenderingContext2D, sk: Skin, plane: Plane, s: GameState) {
  const u = s.scale
  const dir = plane.vx >= 0 ? 1 : -1
  const y = plane.y + Math.sin(s.time * 3 + plane.id) * 0.8 * u
  const p = pen(ctx, plane.x, y, dir, u)
  const sw: Swatch = 'sky'
  const lw = Math.max(1.1, 1.4 * u)
  const under = sk.skyTop

  contrail(ctx, sk, p.X(-27), y + 0.2 * u, dir, 120 * u, Math.max(1.4, 2.4 * u))
  contrail(ctx, sk, p.X(-15), p.Y(9.4), dir, 70 * u, Math.max(1, 1.2 * u))
  const flick = 0.8 + 0.2 * Math.sin(s.time * 47 + plane.id * 3)
  if (sk.dark) glow(ctx, p.X(-30), y, 12 * u, hue('orange'), 0.4)
  flame(ctx, sk, p, -27.5, 2.1, 9 * flick)

  jetPath(ctx, p)
  ctx.fillStyle = soft(under, sw, sk.dark ? 0.52 : 0.44)
  ctx.fill()
  ctx.strokeStyle = outline(sk, sw)
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.stroke()

  // The wing a shade deeper, the tailplane, and a band of red on the fin.
  poly(ctx, p, [
    [-11, 3.4],
    [-17.5, 9.6],
    [-11.5, 9.6],
    [2, 3.4],
  ])
  ctx.fillStyle = soft(under, sw, sk.dark ? 0.7 : 0.62)
  ctx.fill()
  poly(ctx, p, [
    [-16.5, 0.1],
    [-27, 1.1],
    [-27, 2.1],
    [-15.5, 1.6],
  ])
  ctx.fill()
  poly(ctx, p, [
    [-18.2, -11],
    [-25, -11],
    [-24.6, -8.5],
    [-16.3, -8.5],
  ])
  ctx.fillStyle = soft(under, 'red', sk.dark ? 0.75 : 0.6)
  ctx.fill()
  // A panel line down the fuselage.
  ctx.beginPath()
  p.m(19, -0.9)
  p.l(-23, -1.2)
  ctx.strokeStyle = outline(sk, sw, 0.35)
  ctx.lineWidth = Math.max(0.8, 0.9 * u)
  ctx.stroke()

  // Canopy.
  ctx.beginPath()
  p.m(14.2, -3.7)
  p.q(10, -7.2, 4, -4.9)
  p.l(4.5, -4.1)
  ctx.closePath()
  ctx.fillStyle = sk.dark ? 'rgba(206, 232, 255, 0.9)' : hsla(hue('sky'), 80, 88, 1)
  ctx.fill()
  ctx.strokeStyle = outline(sk, sw, 0.8)
  ctx.lineWidth = Math.max(0.9, 1 * u)
  ctx.stroke()
  ctx.beginPath()
  p.m(11.5, -5.3)
  p.q(9.5, -6.3, 7, -5.6)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineCap = 'round'
  ctx.stroke()
}

// The bomber -----------------------------------------------------------------------

/** Nose at +37, tail at -45; fin up to -25. */
function bomberPath(ctx: CanvasRenderingContext2D, p: ReturnType<typeof pen>) {
  ctx.beginPath()
  p.m(37, 1.5)
  p.q(37.5, -3.6, 32, -5.3)
  p.q(27, -10, 19, -8.6)
  p.l(-29, -8.2)
  p.l(-36.5, -25)
  p.l(-43, -25)
  p.l(-42, -7)
  p.l(-45, -5)
  p.l(-45, 1)
  p.l(-33, 6.4)
  p.l(26, 7)
  p.q(35.5, 6.6, 37, 1.5)
  ctx.closePath()
}

const BOMB_BAY_OPEN = 0.45

export function drawBomber(ctx: CanvasRenderingContext2D, sk: Skin, bomber: Bomber, s: GameState) {
  const u = s.scale
  const dir = bomber.vx >= 0 ? 1 : -1
  const y = bomber.y + Math.sin(s.time * 1.6 + bomber.id) * 1.2 * u
  const p = pen(ctx, bomber.x, y, dir, u)
  const sw: Swatch = 'orange'
  const lw = Math.max(1.2, 1.5 * u)
  const under = sk.skyTop
  const pods: [number, number][] = [
    [11, 10.2],
    [-9, 10.8],
  ]

  for (const [px, py] of pods) {
    contrail(ctx, sk, p.X(px - 9), p.Y(py), dir, 90 * u, Math.max(1.2, 2 * u))
  }

  bomberPath(ctx, p)
  ctx.fillStyle = soft(under, sw, sk.dark ? 0.5 : 0.42)
  ctx.fill()
  ctx.strokeStyle = outline(sk, sw)
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.stroke()

  // The wing root along the shoulder, sweeping back.
  poly(ctx, p, [
    [17, -3.6],
    [-13, -3.6],
    [-20, 1.2],
    [11, 1.2],
  ])
  ctx.fillStyle = soft(under, sw, sk.dark ? 0.68 : 0.6)
  ctx.fill()
  // A dark band on the fin.
  poly(ctx, p, [
    [-33.4, -18],
    [-42.6, -18],
    [-42.4, -14.5],
    [-31.8, -14.5],
  ])
  ctx.fillStyle = soft(under, 'red', sk.dark ? 0.75 : 0.6)
  ctx.fill()

  // Bomb bay: the doors swing open just before something falls out of it.
  const open = clamp01(1 - bomber.dropTimer / BOMB_BAY_OPEN)
  ctx.beginPath()
  p.m(6, 6.8)
  p.l(-14, 6.6)
  ctx.strokeStyle = outline(sk, sw, 0.55)
  ctx.lineWidth = Math.max(0.9, 1 * u)
  ctx.stroke()
  if (open > 0) {
    poly(ctx, p, [
      [6, 6.8],
      [-14, 6.6],
      [-14, 6.6 + 3 * open],
      [6, 6.8 + 3 * open],
    ])
    ctx.fillStyle = css(mix(under, [0, 0, 0], 0.55), 0.9)
    ctx.fill()
    ctx.beginPath()
    p.m(6, 6.8)
    p.l(6 - 3 * open, 6.8 + 5 * open)
    p.m(-14, 6.6)
    p.l(-14 + 3 * open, 6.6 + 5 * open)
    ctx.strokeStyle = outline(sk, sw, 0.9)
    ctx.lineWidth = lw
    ctx.stroke()
  }

  // Cockpit glass and the glazed nose.
  ctx.beginPath()
  p.m(30.5, -5.4)
  p.q(26.5, -9.2, 20, -7.9)
  p.l(20.5, -6.4)
  ctx.closePath()
  ctx.fillStyle = sk.dark ? 'rgba(255, 238, 214, 0.9)' : hsla(hue('orange'), 80, 90, 1)
  ctx.fill()
  ctx.strokeStyle = outline(sk, sw, 0.8)
  ctx.lineWidth = Math.max(0.9, 1 * u)
  ctx.stroke()
  ctx.beginPath()
  p.m(35.4, -2.6)
  p.q(37, 0.5, 35.4, 3.2)
  ctx.strokeStyle = sk.dark ? 'rgba(255, 238, 214, 0.75)' : outline(sk, sw, 0.6)
  ctx.lineWidth = Math.max(1.2, 1.6 * u)
  ctx.stroke()

  // Engines, slung under the wing, glowing at the back.
  for (const [px, py] of pods) {
    ctx.beginPath()
    p.m(px + 2, py - 3)
    p.l(px + 4, 6.6)
    ctx.strokeStyle = outline(sk, sw, 0.8)
    ctx.lineWidth = Math.max(1.4, 2 * u)
    ctx.stroke()
    if (sk.dark) glow(ctx, p.X(px - 9.5), p.Y(py), 8 * u, hue('amber'), 0.45)
    ctx.beginPath()
    ctx.ellipse(p.X(px), p.Y(py), 9 * u, 3.3 * u, 0, 0, Math.PI * 2)
    ctx.fillStyle = soft(under, sw, sk.dark ? 0.62 : 0.52)
    ctx.fill()
    ctx.strokeStyle = outline(sk, sw)
    ctx.lineWidth = lw
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(p.X(px + 7.5), p.Y(py), 1.2 * u, 2.3 * u, 0, 0, Math.PI * 2)
    ctx.fillStyle = css(mix(under, [0, 0, 0], 0.5), 0.85)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(p.X(px - 8.6), p.Y(py), 1.1 * u, 2.1 * u, 0, 0, Math.PI * 2)
    ctx.fillStyle = hsla(hue('amber'), 95, sk.dark ? 70 : 55, 0.6 + 0.4 * Math.sin(s.time * 22 + px))
    ctx.fill()
  }

  // Health: one pip per hit it can still take.
  const maxHp = Math.max(1, bomber.maxHp)
  const hp = Math.max(0, bomber.hp)
  const pip = 6 * u
  const gap = 2.4 * u
  const barW = maxHp * pip + (maxHp - 1) * gap
  const bx = bomber.x - barW / 2
  const by = y + 21 * u
  for (let i = 0; i < maxHp; i++) {
    const px = bx + i * (pip + gap)
    ctx.beginPath()
    ctx.roundRect(px, by, pip, pip * 0.9, pip * 0.3)
    const t = hp / maxHp
    ctx.fillStyle =
      i < hp
        ? t > 0.55
          ? hsla(hue('green'), 70, sk.dark ? 56 : 44, 0.95)
          : t > 0.3
            ? hsla(hue('amber'), 85, sk.dark ? 58 : 48, 0.95)
            : hsla(hue('red'), 80, sk.dark ? 60 : 50, 0.95)
        : 'rgba(0, 0, 0, 0)'
    ctx.fill()
    ctx.strokeStyle = outline(sk, sw, i < hp ? 0.9 : 0.35)
    ctx.lineWidth = Math.max(1, 1.1 * u)
    ctx.stroke()
  }
}

// Powers ---------------------------------------------------------------------------

/**
 * A power's mark, filling a circle of radius `r`: two shells for ammo, a dome
 * for the shield, an hourglass for slow, a sight for the seeker. The buttons
 * under the score draw the same four, so a blimp and its button match.
 */
export function powerIcon(
  ctx: CanvasRenderingContext2D,
  kind: PowerKind,
  cx: number,
  cy: number,
  r: number,
  color: string,
  lw: number,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'ammo') {
    for (const side of [-1, 1]) {
      const x = cx + side * r * 0.4
      const w = r * 0.26
      ctx.beginPath()
      ctx.moveTo(x, cy - r * 0.86)
      ctx.lineTo(x + w, cy - r * 0.42)
      ctx.lineTo(x + w, cy + r * 0.78)
      ctx.lineTo(x - w, cy + r * 0.78)
      ctx.lineTo(x - w, cy - r * 0.42)
      ctx.closePath()
      ctx.fill()
    }
  } else if (kind === 'shield') {
    ctx.beginPath()
    ctx.arc(cx, cy + r * 0.42, r * 0.8, Math.PI, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.95, cy + r * 0.42)
    ctx.lineTo(cx + r * 0.95, cy + r * 0.42)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy + r * 0.42, r * 0.42, Math.PI * 1.15, Math.PI * 1.55)
    ctx.stroke()
  } else if (kind === 'slow') {
    const a = r * 0.55
    ctx.beginPath()
    ctx.moveTo(cx - a * 1.2, cy - r * 0.85)
    ctx.lineTo(cx + a * 1.2, cy - r * 0.85)
    ctx.moveTo(cx - a * 1.2, cy + r * 0.85)
    ctx.lineTo(cx + a * 1.2, cy + r * 0.85)
    ctx.moveTo(cx - a, cy - r * 0.85)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx - a, cy + r * 0.85)
    ctx.moveTo(cx + a, cy - r * 0.85)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + a, cy + r * 0.85)
    ctx.stroke()
    // The sand run through to the bottom.
    ctx.beginPath()
    ctx.moveTo(cx - a * 0.62, cy + r * 0.85)
    ctx.lineTo(cx, cy + r * 0.3)
    ctx.lineTo(cx + a * 0.62, cy + r * 0.85)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      ctx.moveTo(cx + dx * r * 0.36, cy + dy * r * 0.36)
      ctx.lineTo(cx + dx * r, cy + dy * r)
    }
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** A round badge with the power's mark in it, as painted on a blimp's side. */
export function powerBadge(ctx: CanvasRenderingContext2D, sk: Skin, kind: PowerKind, cx: number, cy: number, r: number, lw: number) {
  const sw = POWER_SWATCH[kind]
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = sk.dark ? 'rgba(248, 250, 252, 0.96)' : '#ffffff'
  ctx.fill()
  ctx.strokeStyle = outline(sk, sw)
  ctx.lineWidth = lw
  ctx.stroke()
  powerIcon(ctx, kind, cx, cy, r * 0.68, hsla(hue(sw), 72, sk.dark ? 40 : 36), Math.max(1.2, r * 0.17))
}

// The carrier ----------------------------------------------------------------------

/** How much larger than the old pod a blimp is drawn; its hit range was widened to match. */
const BLIMP = 1.18

export function drawCarrier(ctx: CanvasRenderingContext2D, sk: Skin, drone: Drone, s: GameState) {
  const u = s.scale * BLIMP
  const dir = drone.vx >= 0 ? 1 : -1
  const y = drone.y + Math.sin(s.time * 2.4 + drone.id) * 2.2 * s.scale
  const p = pen(ctx, drone.x, y, dir, u)
  const sw = POWER_SWATCH[drone.kind]
  const h = hue(sw)
  const lw = Math.max(1.1, 1.4 * s.scale)
  const under = sk.skyTop

  if (sk.dark) glow(ctx, drone.x, y, 30 * u, h, 0.24)

  // Fins and gondola first, so the envelope covers where they join it.
  for (const side of [-1, 1]) {
    poly(ctx, p, [
      [-12, side * 6.5],
      [-20.5, side * 15.5],
      [-25.5, side * 15.5],
      [-23.5, side * 2.5],
    ])
    ctx.fillStyle = soft(under, sw, sk.dark ? 0.62 : 0.54)
    ctx.fill()
    ctx.strokeStyle = outline(sk, sw)
    ctx.lineWidth = lw
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.roundRect(drone.x - 7 * u, p.Y(9.5), 14 * u, 5.4 * u, 2.4 * u)
  ctx.fillStyle = soft(under, sw, sk.dark ? 0.62 : 0.54)
  ctx.fill()
  ctx.strokeStyle = outline(sk, sw)
  ctx.lineWidth = lw
  ctx.stroke()
  // Its windows, lit at night.
  for (const wx of [-3.6, 0, 3.6]) {
    ctx.beginPath()
    ctx.roundRect(p.X(wx) - 1 * u, p.Y(11.3), 2 * u, 1.8 * u, 0.6 * u)
    ctx.fillStyle = sk.dark ? 'rgba(255, 220, 140, 0.95)' : outline(sk, sw, 0.55)
    ctx.fill()
  }
  // The propeller, a blur that never quite settles.
  const spin = Math.abs(Math.sin(s.time * 30 + drone.id))
  ctx.beginPath()
  ctx.ellipse(p.X(-8.4), p.Y(12.2), 0.9 * u, (2.2 + spin * 2.2) * u, 0, 0, Math.PI * 2)
  ctx.fillStyle = css(sk.ink, 0.28)
  ctx.fill()

  // The envelope.
  ctx.beginPath()
  p.m(21, 0)
  p.c(21, -8.6, 10, -11.6, -2, -11.2)
  p.c(-12, -10.9, -19.5, -7, -24, -2.2)
  p.l(-24, 2.2)
  p.c(-19.5, 7, -12, 10.9, -2, 11.2)
  p.c(10, 11.6, 21, 8.6, 21, 0)
  ctx.closePath()
  ctx.fillStyle = soft(under, sw, sk.dark ? 0.55 : 0.46)
  ctx.fill()
  ctx.strokeStyle = outline(sk, sw)
  ctx.lineWidth = lw
  ctx.stroke()
  // Seams along it, and light on its back.
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = outline(sk, sw, 0.3)
  ctx.lineWidth = Math.max(0.8, 0.9 * s.scale)
  for (const k of [-5.5, 5.5]) {
    ctx.beginPath()
    p.m(21, k * 0.15)
    p.c(12, k * 1.2, -12, k * 1.25, -24, k * 0.35)
    ctx.stroke()
  }
  ctx.restore()
  ctx.beginPath()
  p.m(13, -7.6)
  p.q(4, -10.6, -8, -9.6)
  ctx.strokeStyle = sk.dark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = Math.max(1.2, 1.7 * s.scale)
  ctx.lineCap = 'round'
  ctx.stroke()

  // What it carries, big on its side.
  powerBadge(ctx, sk, drone.kind, p.X(0.5), p.Y(0.2), 8.2 * u, lw)

  // A light on the top fin, blinking.
  const on = Math.sin(s.time * 5 + drone.id) > 0.3
  ctx.beginPath()
  ctx.arc(p.X(-24.5), p.Y(-15.5), 1.4 * u, 0, Math.PI * 2)
  ctx.fillStyle = on ? hsla(hue('red'), 90, sk.dark ? 66 : 52) : outline(sk, sw, 0.5)
  ctx.fill()
  if (on && sk.dark) glow(ctx, p.X(-24.5), p.Y(-15.5), 6 * u, hue('red'), 0.5)
}

/**
 * Where the column's button for a power sits on the stage, matching
 * `.patriot__powers` in styles.css: 0.55rem in from the left, its first button
 * 3.55rem down, each 2.6rem tall with a 0.4rem gap.
 */
function columnSlot(s: GameState, kind: PowerKind) {
  const held = POWER_ORDER.filter((k) => (s.pack[k] ?? 0) > 0)
  const i = Math.max(0, held.indexOf(kind))
  const rem = 16
  return { x: 0.55 * rem + 1.3 * rem, y: 3.55 * rem + 1.3 * rem + i * 3 * rem }
}

/** A power just taken, flying from the wreck to its button. */
export function drawPickups(ctx: CanvasRenderingContext2D, sk: Skin, s: GameState) {
  for (const pk of s.pickups ?? []) {
    const t = clamp01(pk.age / PICKUP_FLIGHT)
    const e = 1 - (1 - t) ** 3
    const to = columnSlot(s, pk.kind)
    const x = pk.x + (to.x - pk.x) * e
    const y = pk.y + (to.y - pk.y) * e - Math.sin(t * Math.PI) * 50 * s.scale
    const r = (10 - 3 * t) * Math.max(0.8, s.scale)
    ctx.save()
    ctx.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1
    if (sk.dark) glow(ctx, x, y, r * 2.6, hue(POWER_SWATCH[pk.kind]), 0.45)
    powerBadge(ctx, sk, pk.kind, x, y, r, Math.max(1, 1.4 * s.scale))
    ctx.restore()
  }
}
