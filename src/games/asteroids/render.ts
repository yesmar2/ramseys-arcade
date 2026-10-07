import {
  COMBO_WINDOW,
  POWER_HUE,
  POWER_LIFE,
  WAVE_INTRO,
  shipRadius,
  type EnemyBullet,
  type GameState,
  type Particle,
  type Point,
  type Powerup,
  type Ring,
  type Rock,
  type Saucer,
} from './game'
import { getGame } from '../../data/games'
import { ASTEROIDS_ART, burnColor, drawSkinArt } from '../../lib/skinArt'
import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'

/*
 * Drawn the house way: soft fills inside clean outlines, in the site's own
 * colours, on the site's own ground. Outlines are brighter over the dark
 * theme's ground and deeper over the light one, the way the other games do it.
 */

/** The ship wears the game's colour from the shelf, so the tile and the play agree. */
const ACCENT = getGame('asteroids')?.accent ?? '#6b74e8'
const SHIP_HUE = 236
const SKY_HUE = 204
const GOLD = '#f5b942'
const GOLD_DEEP = '#b7791f'
const SAUCER_HUE = 0
/** Seconds before a saucer's shot that its pod starts to glow: the tell. */
const SAUCER_TELL = 0.35
const TAU = Math.PI * 2
const FONT = 'Outfit, system-ui, sans-serif'

function hsla(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

/** Outline lightness: bright over the dark theme's ground, deeper over the light one. */
const lineL = (dark: boolean) => (dark ? 64 : 42)

/**
 * A quiet field of stars. Positions are hashed from the index, so nothing
 * crawls; a few of the brighter ones breathe, slowly.
 */
function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, dark: boolean, t: number) {
  const count = Math.round((w * h) / 5200)
  ctx.fillStyle = inkColor()
  for (let i = 1; i <= count; i++) {
    const a = Math.sin(i * 12.9898) * 43758.5453
    const b = Math.sin(i * 78.233) * 12345.6789
    const c = Math.sin(i * 3.7137) * 9973.113
    const x = (a - Math.floor(a)) * w
    const y = (b - Math.floor(b)) * h
    const f = c - Math.floor(c)
    const breathe = f > 0.88 ? 0.55 + 0.45 * Math.sin(t * (0.8 + f) + i) : 1
    ctx.globalAlpha = (dark ? 0.07 + f * 0.17 : 0.05 + f * 0.1) * breathe
    ctx.beginPath()
    ctx.arc(x, y, 0.5 + f * 1.1, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function traceRock(ctx: CanvasRenderingContext2D, rock: Rock) {
  const v = rock.verts
  ctx.beginPath()
  ctx.moveTo(v[0]!.x, v[0]!.y)
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i]!.x, v[i]!.y)
  ctx.closePath()
}

function drawRock(ctx: CanvasRenderingContext2D, rock: Rock, scale: number, dark: boolean) {
  const sat = rock.sat ?? 50
  ctx.save()
  ctx.translate(rock.x, rock.y)
  ctx.rotate(rock.angle)
  traceRock(ctx, rock)
  ctx.fillStyle = hsla(rock.hue, sat, 58, dark ? 0.2 : 0.24)
  ctx.fill()

  // Craters turn with the rock: a shadowed bowl and its rim.
  if (rock.craters?.length) {
    ctx.save()
    ctx.clip()
    ctx.lineWidth = Math.max(1, 1.1 * scale)
    for (const c of rock.craters) {
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.r, 0, TAU)
      ctx.fillStyle = hsla(rock.hue, sat, dark ? 20 : 46, 0.3)
      ctx.fill()
      ctx.strokeStyle = hsla(rock.hue, sat, lineL(dark), 0.5)
      ctx.stroke()
    }
    ctx.restore()
  }

  traceRock(ctx, rock)
  ctx.strokeStyle = hsla(rock.hue, sat, lineL(dark), 0.95)
  ctx.lineWidth = Math.max(1.4, 1.9 * scale)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()

  // Light from the top left, fixed on screen while the rock turns under it.
  ctx.beginPath()
  ctx.arc(rock.x, rock.y, rock.radius * 0.7, Math.PI * 1.06, Math.PI * 1.44)
  ctx.strokeStyle = hsla(rock.hue, sat, dark ? 84 : 97, dark ? 0.32 : 0.6)
  ctx.lineWidth = Math.max(1.2, 1.7 * scale)
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.lineCap = 'butt'
}

function drawPowerupGlyph(ctx: CanvasRenderingContext2D, kind: Powerup['kind'], r: number, scale: number, color: string) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(2.2, 2.6 * scale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (kind === 'rapid') {
    // A lightning bolt.
    const s = r * 0.55
    ctx.beginPath()
    ctx.moveTo(s * 0.15, -s)
    ctx.lineTo(-s * 0.25, s * 0.05)
    ctx.lineTo(s * 0.05, s * 0.05)
    ctx.lineTo(-s * 0.15, s)
    ctx.lineTo(s * 0.35, -s * 0.05)
    ctx.lineTo(s * 0.05, -s * 0.05)
    ctx.closePath()
    ctx.fill()
    return
  }

  if (kind === 'spread') {
    // Three shots fanning out, the fan centred on the ring.
    const s = r * 0.48
    const oy = s * 0.42
    for (const ang of [-0.55, 0, 0.55]) {
      const tx = Math.cos(ang - Math.PI / 2) * s
      const ty = Math.sin(ang - Math.PI / 2) * s + oy
      ctx.beginPath()
      ctx.moveTo(0, oy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(tx * 0.92, oy + (ty - oy) * 0.92, Math.max(1.6, 2.1 * scale), 0, TAU)
      ctx.fill()
    }
    return
  }

  if (kind === 'shield') {
    // A hex with a boss in the middle.
    const s = r * 0.48
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2
      if (i === 0) ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s)
      else ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.28, 0, TAU)
    ctx.fill()
    return
  }

  // Slow: a clock.
  const s = r * 0.48
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -s * 0.55)
  ctx.moveTo(0, 0)
  ctx.lineTo(s * 0.42, s * 0.1)
  ctx.stroke()
}

function drawPowerup(ctx: CanvasRenderingContext2D, p: Powerup, scale: number, dark: boolean, t: number) {
  const hue = POWER_HUE[p.kind]
  const fade = p.life < 2 ? Math.max(0.25, p.life / 2) : 1
  const pulse = 0.92 + Math.sin(t * 5.5 + p.id) * 0.08
  const r = p.radius * pulse
  const line = hsla(hue, 58, lineL(dark), 0.98)
  ctx.save()
  ctx.globalAlpha = fade
  ctx.translate(p.x, p.y)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.fillStyle = hsla(hue, 62, 58, dark ? 0.26 : 0.34)
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = Math.max(2.4, 2.8 * scale)
  ctx.stroke()
  // Time left on the field, as a ring that empties.
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.3, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, p.life / POWER_LIFE)))
  ctx.strokeStyle = hsla(hue, 58, lineL(dark), 0.5)
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  ctx.lineCap = 'round'
  ctx.stroke()
  drawPowerupGlyph(ctx, p.kind, r, scale, line)
  ctx.restore()
}

/** The notched arrowhead from the home tile and the lives, nose along +x. */
function traceShip(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  ctx.moveTo(r * 1.08, 0)
  ctx.lineTo(-r * 0.74, r * 0.74)
  ctx.lineTo(-r * 0.3, 0)
  ctx.lineTo(-r * 0.74, -r * 0.74)
  ctx.closePath()
}

/** The shield round the ship, held till it takes a hit (game.ts breakShield), so it never blinks out. */
function drawShield(ctx: CanvasRenderingContext2D, state: GameState, r: number, scale: number, dark: boolean, t: number) {
  const hue = POWER_HUE.shield
  const R = r * 1.5
  const { x, y } = state.ship
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, R, 0, TAU)
  ctx.fillStyle = hsla(hue, 62, 58, dark ? 0.1 : 0.14)
  ctx.fill()
  ctx.strokeStyle = hsla(hue, 62, lineL(dark), 0.9)
  ctx.lineWidth = Math.max(1.6, 2.1 * scale)
  ctx.stroke()
  ctx.setLineDash([R * 0.26, R * 0.2])
  ctx.lineDashOffset = -t * R * 0.9
  ctx.beginPath()
  ctx.arc(x, y, R * 0.84, 0, TAU)
  ctx.strokeStyle = hsla(hue, 62, lineL(dark), 0.45)
  ctx.lineWidth = Math.max(1, 1.3 * scale)
  ctx.stroke()
  ctx.restore()
}

/**
 * The Comet (Season 1's skin, lib/skins.ts): the same arrowhead, so the same size and hitbox, in amber
 * with a dark notch, and a tail of fading sparks behind it, longer under thrust.
 */
function drawCometTail(ctx: CanvasRenderingContext2D, r: number, thrusting: boolean, t: number) {
  const count = thrusting ? 7 : 4
  for (let i = 1; i <= count; i++) {
    const k = i / count
    const wobble = Math.sin(t * 9 + i * 1.7) * r * 0.08
    ctx.beginPath()
    ctx.arc(-r * (0.55 + i * (thrusting ? 0.36 : 0.26)), wobble, Math.max(0.8, r * (0.2 - k * 0.14)), 0, TAU)
    ctx.fillStyle = k < 0.5 ? `rgba(245, 185, 66, ${0.75 - k * 0.6})` : `rgba(138, 106, 212, ${0.6 - k * 0.45})`
    ctx.fill()
  }
}

function drawShip(ctx: CanvasRenderingContext2D, state: GameState, scale: number, dark: boolean, t: number, skin: string | null) {
  const { ship } = state
  const shielded = (state.buffShield ?? 0) > 0
  // Blink only after a respawn: under a shield the hull stays solid.
  if (!shielded && ship.invuln > 0 && Math.floor(ship.invuln * 12) % 2 === 0) return

  const r = shipRadius(scale)
  const comet = skin === 'asteroids-comet'
  ctx.save()
  ctx.translate(ship.x, ship.y)
  ctx.rotate(ship.angle)
  if (comet) drawCometTail(ctx, r, ship.thrusting, t)

  if (ship.thrusting) {
    // Flame from the notch: an outer tongue and a hotter core, flickering; in a skin's own burn when it has one.
    const f = 0.75 + Math.random() * 0.45
    const root = -r * 0.34
    const burn = skin ? ASTEROIDS_ART[skin]?.art.burn : undefined
    for (const [len, half, colour] of [
      [r * (0.8 + 0.5 * f), r * 0.3, burn ? burnColor(burn.outer, 0.92) : hsla(40, 92, dark ? 60 : 54, 0.92)],
      [r * (0.45 + 0.3 * f), r * 0.16, burn ? burnColor(burn.core, 0.95) : hsla(48, 100, dark ? 84 : 72, 0.95)],
    ] as const) {
      ctx.beginPath()
      ctx.moveTo(root, -half)
      ctx.quadraticCurveTo(root - len * 0.55, -half * 0.7, root - len, 0)
      ctx.quadraticCurveTo(root - len * 0.55, half * 0.7, root, half)
      ctx.closePath()
      ctx.fillStyle = colour
      ctx.fill()
    }
  }

  const drawn = skin ? ASTEROIDS_ART[skin] : undefined
  if (drawn) {
    // A skin, drawn from the pass's own picture (lib/skinArt.ts): its nose on the hull's nose and as long
    // as the hull, which is still what's measured.
    const k = (r * 1.82) / (drawn.tail - drawn.nose)
    ctx.rotate(Math.PI / 2)
    ctx.scale(k, k)
    ctx.translate(-50, -drawn.nose - (r * 1.08) / k)
    drawSkinArt(ctx, drawn.art.body, Math.max(2.2, 2.8 * scale) / k)
    ctx.restore()
    if (shielded) drawShield(ctx, state, r, scale, dark, t)
    return
  }

  traceShip(ctx, r)
  ctx.fillStyle = hsla(SHIP_HUE, 72, 66, dark ? 0.26 : 0.3)
  ctx.fill()
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = Math.max(2.2, 2.8 * scale)
  ctx.lineJoin = 'round'
  ctx.stroke()

  // Cockpit.
  ctx.beginPath()
  ctx.arc(r * 0.26, 0, Math.max(1.8, r * 0.13), 0, TAU)
  ctx.fillStyle = dark ? '#e7eef3' : '#ffffff'
  ctx.fill()
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  ctx.stroke()
  ctx.restore()

  if (shielded) drawShield(ctx, state, r, scale, dark, t)
}

/**
 * A saucer with someone flying it: on the big one a little green pilot in a glass dome, watching the
 * ship; on the small one a red light, glaring. It leans into its weave (game.ts easeBank), its rim
 * lights chase the way it flies, and the pod underneath, where its shots come from, heats up just
 * before it fires (SAUCER_TELL).
 */
function drawSaucer(ctx: CanvasRenderingContext2D, saucer: Saucer, scale: number, dark: boolean, t: number, aim: Point) {
  const r = saucer.radius
  const big = saucer.size === 'large'
  const line = hsla(SAUCER_HUE, 58, lineL(dark), 0.95)
  const lw = Math.max(1.8, 2.2 * scale)
  const charge = Math.max(0, Math.min(1, 1 - saucer.fireCooldown / SAUCER_TELL))
  const heat = 42 - 34 * charge
  const traceTop = () => {
    ctx.moveTo(-r, 0)
    ctx.bezierCurveTo(-r * 0.7, -r * 0.35, r * 0.7, -r * 0.35, r, 0)
  }
  ctx.save()
  ctx.translate(saucer.x, saucer.y + Math.sin(t * 2.4 + saucer.id) * r * 0.04)
  ctx.rotate(saucer.bank ?? 0)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // A warm glow under the belly, flaring as it's about to fire.
  ctx.save()
  ctx.translate(0, r * 0.44)
  ctx.scale(1, 0.42)
  const glowR = r * (0.85 + 0.3 * charge)
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR)
  const glowA = (dark ? 0.3 : 0.22) * (0.8 + 0.2 * Math.sin(t * 6 + saucer.id)) + 0.45 * charge
  glow.addColorStop(0, hsla(heat, 100, dark ? 62 : 55, glowA))
  glow.addColorStop(1, hsla(heat, 100, dark ? 62 : 55, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(0, 0, glowR, 0, TAU)
  ctx.fill()
  ctx.restore()

  // The pod underneath.
  ctx.beginPath()
  ctx.ellipse(0, r * 0.26, r * 0.24, r * 0.18, 0, 0, Math.PI)
  ctx.closePath()
  ctx.fillStyle = hsla(heat, 100, (dark ? 56 : 52) + 24 * charge, (dark ? 0.35 : 0.4) + 0.6 * charge)
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = lw * 0.8
  ctx.stroke()

  // Belly.
  ctx.beginPath()
  ctx.moveTo(-r, 0)
  ctx.bezierCurveTo(-r * 0.6, r * 0.42, r * 0.6, r * 0.42, r, 0)
  ctx.closePath()
  ctx.fillStyle = hsla(SAUCER_HUE, 58, dark ? 42 : 54, dark ? 0.4 : 0.34)
  ctx.fill()
  ctx.lineWidth = lw
  ctx.stroke()

  // The glass dome and who's flying it, clipped to above the hull's top so none of it shows through.
  const domeY = -r * 0.14
  const glass = big ? 188 : 350
  ctx.save()
  ctx.beginPath()
  traceTop()
  ctx.lineTo(r, -r)
  ctx.lineTo(-r, -r)
  ctx.closePath()
  ctx.clip()
  ctx.beginPath()
  ctx.ellipse(0, domeY, r * 0.46, r * 0.46, 0, Math.PI, 0)
  ctx.closePath()
  ctx.fillStyle = hsla(glass, 70, dark ? 66 : 60, dark ? 0.16 : 0.22)
  ctx.fill()
  ctx.save()
  ctx.clip()
  if (big) {
    // The pilot turns its head and eyes toward the ship.
    const lookX = Math.max(-1, Math.min(1, (aim.x - saucer.x) / (r * 5)))
    const lookY = Math.max(-1, Math.min(1, (aim.y - saucer.y) / (r * 5)))
    const hx = lookX * r * 0.05
    const hy = domeY - r * 0.2
    // Shoulders.
    ctx.beginPath()
    ctx.ellipse(hx * 0.5, domeY + r * 0.02, r * 0.28, r * 0.16, 0, Math.PI, 0)
    ctx.closePath()
    ctx.fillStyle = hsla(110, 45, dark ? 42 : 44)
    ctx.fill()
    // Head: a big brow and a small chin.
    ctx.beginPath()
    ctx.moveTo(hx, hy + r * 0.2)
    ctx.bezierCurveTo(hx - r * 0.1, hy + r * 0.18, hx - r * 0.22, hy + r * 0.04, hx - r * 0.21, hy - r * 0.06)
    ctx.bezierCurveTo(hx - r * 0.2, hy - r * 0.24, hx + r * 0.2, hy - r * 0.24, hx + r * 0.21, hy - r * 0.06)
    ctx.bezierCurveTo(hx + r * 0.22, hy + r * 0.04, hx + r * 0.1, hy + r * 0.18, hx, hy + r * 0.2)
    ctx.closePath()
    ctx.fillStyle = hsla(110, 55, dark ? 58 : 54)
    ctx.fill()
    ctx.strokeStyle = hsla(110, 50, dark ? 26 : 28, 0.9)
    ctx.lineWidth = Math.max(0.9, 1.1 * scale)
    ctx.stroke()
    // Eyes: big, dark and slanted.
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(hx + side * r * 0.09 + lookX * r * 0.025, hy + r * 0.01 + lookY * r * 0.015, r * 0.075, r * 0.045, -side * 0.5, 0, TAU)
      ctx.fillStyle = '#0d1418'
      ctx.fill()
    }
  } else {
    // The small one's pilot is too small to see: just a light that glares.
    const pulse = 0.7 + 0.3 * Math.sin(t * 7 + saucer.id)
    ctx.beginPath()
    ctx.arc(0, domeY - r * 0.16, r * 0.15, 0, TAU)
    ctx.fillStyle = hsla(SAUCER_HUE, 95, dark ? 62 : 54, 0.55 + 0.45 * pulse)
    ctx.fill()
  }
  ctx.restore()
  ctx.beginPath()
  ctx.ellipse(0, domeY, r * 0.46, r * 0.46, 0, Math.PI, 0)
  ctx.strokeStyle = hsla(glass, 50, lineL(dark), 0.9)
  ctx.lineWidth = lw * 0.85
  ctx.stroke()
  // A glint on the glass.
  ctx.beginPath()
  ctx.ellipse(0, domeY, r * 0.32, r * 0.32, 0, Math.PI * 1.14, Math.PI * 1.42)
  ctx.strokeStyle = `rgba(255, 255, 255, ${dark ? 0.6 : 0.95})`
  ctx.lineWidth = Math.max(1.1, 1.5 * scale)
  ctx.stroke()
  ctx.restore()

  // Top of the disc.
  ctx.beginPath()
  traceTop()
  ctx.closePath()
  ctx.fillStyle = hsla(SAUCER_HUE, 58, 60, dark ? 0.26 : 0.3)
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = lw
  ctx.stroke()

  // Lights round the rim, chasing the way it flies.
  const count = big ? 7 : 4
  const way = saucer.vx < 0 ? 1 : -1
  for (let i = 0; i < count; i++) {
    const k = -0.72 + (1.44 * i) / (count - 1)
    const lit = 0.5 + 0.5 * Math.sin(t * 9 + i * 1.2 * way)
    ctx.beginPath()
    ctx.arc(r * k, r * 0.07, Math.max(1.2, 1.5 * scale) * (0.85 + 0.25 * lit), 0, TAU)
    ctx.fillStyle = hsla(44, 100, dark ? 48 + 26 * lit : 42 + 14 * lit, 0.4 + 0.6 * lit)
    ctx.fill()
  }
  ctx.restore()
}

function drawMissile(ctx: CanvasRenderingContext2D, b: EnemyBullet, scale: number, dark: boolean) {
  const ang = Math.atan2(b.vy, b.vx)
  const len = Math.max(11, 14 * scale)
  const half = Math.max(3.2, 4.2 * scale)
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(ang)
  // Exhaust.
  ctx.beginPath()
  ctx.moveTo(-len * 0.55, 0)
  ctx.lineTo(-len * (0.9 + Math.random() * 0.25), half * 0.55)
  ctx.lineTo(-len * (0.9 + Math.random() * 0.25), -half * 0.55)
  ctx.closePath()
  ctx.fillStyle = hsla(28, 90, 58, 0.75)
  ctx.fill()
  // Body.
  ctx.beginPath()
  ctx.moveTo(len * 0.55, 0)
  ctx.lineTo(-len * 0.4, half)
  ctx.lineTo(-len * 0.4, -half)
  ctx.closePath()
  ctx.fillStyle = hsla(12, 70, 60, 0.9)
  ctx.fill()
  ctx.strokeStyle = hsla(12, 60, dark ? 72 : 34, 0.95)
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
}

/** Your shots: short streaks with a bright head, pointing the way they fly. */
function drawBullets(ctx: CanvasRenderingContext2D, state: GameState, scale: number, dark: boolean) {
  const len = Math.max(7, 10 * scale)
  const width = Math.max(2.4, 3 * scale)
  ctx.lineCap = 'round'
  for (const b of state.bullets) {
    const sp = Math.hypot(b.vx, b.vy) || 1
    ctx.beginPath()
    ctx.moveTo(b.x - (b.vx / sp) * len, b.y - (b.vy / sp) * len)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = hsla(SKY_HUE, 78, dark ? 62 : 50, 0.9)
    ctx.lineWidth = width
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(b.x, b.y, width * 0.5, 0, TAU)
    ctx.fillStyle = hsla(SKY_HUE, 90, dark ? 88 : 72)
    ctx.fill()
  }
  ctx.lineCap = 'butt'
}

function drawEnemyShot(ctx: CanvasRenderingContext2D, b: EnemyBullet, scale: number, dark: boolean) {
  const r = Math.max(2.2, b.radius || 2.6 * scale)
  ctx.beginPath()
  ctx.arc(b.x, b.y, r * 2.1, 0, TAU)
  ctx.fillStyle = hsla(SAUCER_HUE, 70, 58, 0.18)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(b.x, b.y, r, 0, TAU)
  ctx.fillStyle = hsla(SAUCER_HUE, 70, dark ? 66 : 50)
  ctx.fill()
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, scale: number, dark: boolean) {
  const a = Math.max(0, p.life / p.maxLife)
  if (p.shard) {
    // A chip of rock: a little outlined wedge, turning as it goes.
    const s = p.shard.size
    ctx.save()
    ctx.globalAlpha = Math.min(1, a * 1.5)
    ctx.translate(p.x, p.y)
    ctx.rotate(p.shard.angle)
    ctx.beginPath()
    ctx.moveTo(s, 0)
    ctx.lineTo(-s * 0.6, s * 0.72)
    ctx.lineTo(-s * 0.42, -s * 0.62)
    ctx.closePath()
    ctx.fillStyle = hsla(p.hue, 55, 58, dark ? 0.26 : 0.3)
    ctx.fill()
    ctx.strokeStyle = hsla(p.hue, 55, lineL(dark), 0.95)
    ctx.lineWidth = Math.max(1, 1.3 * scale)
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
    return
  }
  ctx.globalAlpha = a
  ctx.beginPath()
  ctx.arc(p.x, p.y, Math.max(1.2, 2 * scale * a), 0, TAU)
  ctx.fillStyle = hsla(p.hue, 72, dark ? 64 : 50)
  ctx.fill()
  ctx.globalAlpha = 1
}

/** A shock ring: out fast, then slowing, thinning and fading as it goes. */
function drawRing(ctx: CanvasRenderingContext2D, g: Ring, scale: number, dark: boolean) {
  const t = 1 - g.life / g.maxLife
  const ease = 1 - (1 - t) ** 3
  const r = g.r0 + (g.r1 - g.r0) * ease
  ctx.globalAlpha = (1 - t) * 0.85
  ctx.strokeStyle = hsla(g.hue, 62, dark ? 70 : 46)
  ctx.lineWidth = Math.max(1, 3.2 * scale * (1 - t) + 0.6)
  ctx.beginPath()
  ctx.arc(g.x, g.y, Math.max(0.5, r), 0, TAU)
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** Text on a halo of the ground behind it, so it reads over rocks and stars alike. */
function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, colour: string, weight = 600) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const ground = playfieldColor()
  ctx.strokeStyle = ground
  ctx.lineWidth = Math.max(3, size * 0.22)
  ctx.shadowColor = ground
  ctx.shadowBlur = size * 0.45
  ctx.strokeText(text, x, y)
  ctx.shadowBlur = 0
  ctx.fillStyle = colour
  ctx.fillText(text, x, y)
}

function drawFloaters(ctx: CanvasRenderingContext2D, state: GameState, scale: number, dark: boolean) {
  for (const f of state.floaters) {
    const a = Math.max(0, Math.min(1, f.life / f.maxLife))
    const combo = f.text.includes('×')
    ctx.save()
    ctx.globalAlpha = Math.min(1, a * 1.6)
    haloText(ctx, f.text, f.x, f.y, (combo ? 17 : 15) * scale, combo ? (dark ? GOLD : GOLD_DEEP) : inkColor())
    ctx.restore()
  }
}

/** The run of hits, with the time left to keep it going draining underneath. */
function drawCombo(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, scale: number, dark: boolean) {
  if (state.phase !== 'playing' || state.combo <= 1) return
  const gold = dark ? GOLD : GOLD_DEEP
  const y = h - 34 * scale
  ctx.save()
  haloText(ctx, `×${state.combo}`, w / 2, y, 26 * scale, gold, 700)
  const barW = 72 * scale
  const barH = Math.max(3, 4 * scale)
  const left = Math.max(0, Math.min(1, state.comboTimer / COMBO_WINDOW))
  ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.14)' : 'rgba(26, 43, 60, 0.14)'
  ctx.beginPath()
  ctx.roundRect(w / 2 - barW / 2, y + 17 * scale, barW, barH, barH / 2)
  ctx.fill()
  ctx.fillStyle = gold
  ctx.beginPath()
  ctx.roundRect(w / 2 - barW / 2, y + 17 * scale, barW * left, barH, barH / 2)
  ctx.fill()
  ctx.restore()
}

/** What a wave has in store that the last one didn't. */
function waveNote(wave: number) {
  if (wave === 3) return 'Saucers from here on'
  if (wave === 4) return 'Small saucers fire homing missiles · shoot them down'
  if (wave % 3 === 0) return 'Clear it for an extra life'
  return ''
}

/** "Wave N" as a wave begins: in, hold, out, over the play rather than a card in front of it. */
function drawWaveIntro(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, scale: number) {
  const left = state.waveIntro ?? 0
  if (state.phase !== 'playing' || left <= 0) return
  const t = 1 - left / WAVE_INTRO
  const alpha = t < 0.12 ? t / 0.12 : left < 0.45 ? left / 0.45 : 1
  const grow = 1 + Math.max(0, 0.12 - t) * 0.8
  ctx.save()
  ctx.globalAlpha = alpha
  haloText(ctx, `Wave ${state.wave}`, w / 2, h * 0.32, 44 * scale * grow, inkColor(), 700)
  const note = waveNote(state.wave)
  if (note) haloText(ctx, note, w / 2, h * 0.32 + 38 * scale, 15 * scale, inkColor())
  // The time to beat for this wave, so a record is something to go for rather than a surprise at the end.
  const record = state.waveRecordNote
  if (record) {
    const y = h * 0.32 + (note ? 62 : 38) * scale
    haloText(ctx, record, w / 2, y, 15 * scale, isDarkTheme() ? GOLD : GOLD_DEEP, 700)
  }
  ctx.restore()
}

/** Draw a frame. `skin`: the player's chosen skin (lib/skins.ts), drawn on their own ship only; previews pass none. */
export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, skin: string | null = null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const scale = state.scale
  const dark = isDarkTheme()
  const t = performance.now() / 1000

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
  drawStars(ctx, w, h, dark, t)

  // Everything in the field shakes with a big hit; the ground and the HUD don't.
  ctx.save()
  const shake = state.shake ?? 0
  if (shake > 0.01) {
    const m = shake * shake * 16 * scale
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
  }

  for (const rock of state.rocks) drawRock(ctx, rock, scale, dark)
  for (const p of state.powerups ?? []) drawPowerup(ctx, p, scale, dark, t)
  if (state.saucer) drawSaucer(ctx, state.saucer, scale, dark, t, state.ship)
  drawBullets(ctx, state, scale, dark)
  for (const b of state.enemyBullets ?? []) {
    if (b.kind === 'missile') drawMissile(ctx, b, scale, dark)
    else drawEnemyShot(ctx, b, scale, dark)
  }
  for (const g of state.rings ?? []) drawRing(ctx, g, scale, dark)
  for (const p of state.particles) drawParticle(ctx, p, scale, dark)
  if (state.phase === 'playing' || state.phase === 'waveClear') drawShip(ctx, state, scale, dark, t, skin)
  drawFloaters(ctx, state, scale, dark)
  ctx.restore()

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.35})`
    ctx.fillRect(0, 0, w, h)
  }

  drawCombo(ctx, state, w, h, scale, dark)
  drawWaveIntro(ctx, state, w, h, scale)
}
