import type { Swatch } from '../../data/games'
import type { Battery, Blast, City, GameState, Incoming, Shot } from './game'
import { SLOW_TIME, shieldRadius } from './game'
import { PATRIOT_CITY_DRAW } from './cityArt'
import { drawBomber, drawCarrier, drawPickups, drawPlane } from './craft'
import {
  clamp01,
  css,
  hash,
  hsla,
  hue,
  mix,
  mulberry32,
  outline,
  skin,
  soft,
  toneColor,
  type Skin,
} from './paint'

/*
 * Night watch, drawn back to front: the sky and its stars (or dawn and its
 * clouds), the hills, the ground, the cities and the launchers, then what is
 * in the air — incoming trails, your shots and where they will burst, the
 * craft — then the fire, sparks and smoke, and last the words and the sight.
 *
 * Everything keeps the arcade's grammar: a soft fill of a palette colour
 * inside a clean outline of the same colour. What changes is how much of the
 * world there is. The cities are skylines with lit windows; a city that falls
 * leaves rubble that smokes. The launchers turn to follow the sight and kick
 * when they fire. A missile's trail thickens toward its warhead and a mark on
 * the ground says where it will land; a shot marks its burst point with an X.
 */

const FONT = '"Outfit", system-ui, sans-serif'

// Sky, hills and ground -------------------------------------------------------------

type Layer = { key: string; canvas: HTMLCanvasElement | OffscreenCanvas | null }
const backdrop: Layer = { key: '', canvas: null }

function hillY(x: number, w: number, base: number, amp: number, seed: number) {
  const t = x / w
  return (
    base -
    amp *
      (0.55 +
        0.25 * Math.sin(t * 7.1 + seed) +
        0.14 * Math.sin(t * 17.3 + seed * 2.3) +
        0.06 * Math.sin(t * 41 + seed * 4.1))
  )
}

function hillPath(g: CanvasRenderingContext2D, w: number, base: number, amp: number, seed: number, bottom: number) {
  g.beginPath()
  g.moveTo(0, bottom)
  for (let x = 0; x <= w + 8; x += 8) g.lineTo(x, hillY(x, w, base, amp, seed))
  g.lineTo(w, bottom)
  g.closePath()
}

function hillEdge(g: CanvasRenderingContext2D, w: number, base: number, amp: number, seed: number) {
  g.beginPath()
  for (let x = 0; x <= w + 8; x += 8) {
    const y = hillY(x, w, base, amp, seed)
    if (x === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
}

/** Sky, moon or sun, hills and ground: the same every frame, painted once. */
function paintBackdrop(ctx: CanvasRenderingContext2D, sk: Skin, s: GameState, w: number, h: number, dpr: number) {
  const key = `${sk.key}|${w}|${h}|${dpr}|${s.groundY}|${s.scale}`
  if (backdrop.key !== key || !backdrop.canvas) {
    const cw = Math.max(1, Math.floor(w * dpr))
    const ch = Math.max(1, Math.floor(h * dpr))
    const layer =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(cw, ch)
        : Object.assign(document.createElement('canvas'), { width: cw, height: ch })
    const g = layer.getContext('2d') as CanvasRenderingContext2D | null
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const gy = s.groundY
    const u = s.scale

    const sky = g.createLinearGradient(0, 0, 0, gy)
    sky.addColorStop(0, css(sk.skyTop))
    sky.addColorStop(0.62, css(mix(sk.skyTop, sk.skyLow, 0.35)))
    sky.addColorStop(1, css(sk.skyLow))
    g.fillStyle = sky
    g.fillRect(0, 0, w, gy)

    if (sk.dark) {
      // A crescent moon, high on the right.
      const mx = w * 0.86
      const my = h * 0.16
      const mr = 17 * u
      g.beginPath()
      g.arc(mx, my, mr, 0, Math.PI * 2)
      g.fillStyle = css(mix(sk.skyTop, [236, 232, 214], 0.85))
      g.fill()
      g.beginPath()
      g.arc(mx + mr * 0.42, my - mr * 0.22, mr * 0.86, 0, Math.PI * 2)
      g.fillStyle = css(sk.skyTop)
      g.fill()
      g.beginPath()
      g.arc(mx, my, mr, 0, Math.PI * 2)
      g.strokeStyle = 'rgba(236, 232, 214, 0.18)'
      g.lineWidth = 1
      g.stroke()
    } else {
      // The sun coming up behind the hills.
      const sx = w * 0.78
      const sy = gy - 26 * u
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, 120 * u)
      glow.addColorStop(0, hsla(hue('amber'), 90, 70, 0.35))
      glow.addColorStop(1, hsla(hue('amber'), 90, 70, 0))
      g.fillStyle = glow
      g.fillRect(sx - 130 * u, sy - 130 * u, 260 * u, 260 * u)
      g.beginPath()
      g.arc(sx, sy, 30 * u, 0, Math.PI * 2)
      g.fillStyle = soft(sk.skyLow, 'amber', 0.55)
      g.fill()
      g.strokeStyle = outline(sk, 'amber', 0.8)
      g.lineWidth = Math.max(1.2, 1.6 * u)
      g.stroke()
    }

    // Two rows of hills behind the cities, the far one paler.
    const lw = Math.max(1.2, 1.5 * u)
    hillPath(g, w, gy - 16 * u, 26 * u, 1.3, gy + 1)
    g.fillStyle = css(sk.hillFar)
    g.fill()
    hillEdge(g, w, gy - 16 * u, 26 * u, 1.3)
    g.strokeStyle = outline(sk, 'teal', sk.dark ? 0.28 : 0.45, 40)
    g.lineWidth = lw
    g.stroke()
    hillPath(g, w, gy - 4 * u, 16 * u, 4.2, gy + 1)
    g.fillStyle = css(sk.hillNear)
    g.fill()
    hillEdge(g, w, gy - 4 * u, 16 * u, 4.2)
    g.strokeStyle = outline(sk, 'teal', sk.dark ? 0.4 : 0.55, 44)
    g.stroke()

    // The ground, where the launchers stand and their racks are kept.
    g.fillStyle = css(sk.ground)
    g.fillRect(0, gy, w, h - gy)
    g.beginPath()
    g.moveTo(0, gy)
    g.lineTo(w, gy)
    g.strokeStyle = outline(sk, 'green', sk.dark ? 0.65 : 0.8, 46)
    g.lineWidth = Math.max(1.6, 2.2 * u)
    g.stroke()

    backdrop.key = key
    backdrop.canvas = layer as HTMLCanvasElement | OffscreenCanvas
  }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(backdrop.canvas as CanvasImageSource, 0, 0)
  ctx.restore()
}

/** Stars that twinkle by night; clouds that drift by day. */
function drawSkyLife(ctx: CanvasRenderingContext2D, sk: Skin, s: GameState, w: number) {
  const gy = s.groundY
  const u = s.scale
  if (sk.dark) {
    for (let i = 0; i < 90; i++) {
      const x = hash(i, 1) * w
      const y = hash(i, 2) * gy * 0.78
      const tw = 0.55 + 0.45 * Math.sin(s.time * (0.8 + hash(i, 3) * 2.2) + i)
      const size = (0.6 + hash(i, 4) * 1.1) * Math.max(0.8, u)
      ctx.globalAlpha = (0.25 + 0.55 * hash(i, 5)) * tw * (1 - (y / gy) * 0.6)
      ctx.fillStyle = hash(i, 6) < 0.15 ? 'rgb(255, 226, 170)' : 'rgb(236, 242, 255)'
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    return
  }
  // Clouds: three soft lobes on a flat base, drifting slowly across.
  for (let i = 0; i < 5; i++) {
    const speed = (6 + hash(i, 7) * 8) * u
    const span = w + 260 * u
    const x = ((hash(i, 8) * span + s.time * speed) % span) - 130 * u
    const y = gy * (0.14 + hash(i, 9) * 0.4)
    const k = (0.7 + hash(i, 10) * 0.6) * u
    ctx.beginPath()
    ctx.moveTo(x - 46 * k, y)
    ctx.arc(x - 26 * k, y - 4 * k, 18 * k, Math.PI * 0.95, Math.PI * 1.75)
    ctx.arc(x + 2 * k, y - 12 * k, 24 * k, Math.PI * 1.15, Math.PI * 1.9)
    ctx.arc(x + 30 * k, y - 4 * k, 17 * k, Math.PI * 1.3, Math.PI * 0.05)
    ctx.lineTo(x - 46 * k, y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
    ctx.fill()
    ctx.strokeStyle = outline(sk, 'sky', 0.3, 50)
    ctx.lineWidth = Math.max(1, 1.2 * u)
    ctx.stroke()
  }
}

// Cities ----------------------------------------------------------------------------

type Roof = 'flat' | 'peak' | 'dome' | 'spire' | 'step'
type Building = { x: number; w: number; h: number; back: boolean; roof: Roof }

const CITY_SWATCH: Swatch[] = ['sky', 'teal', 'amber', 'violet', 'orange', 'green']

const skylines = new Map<number, Building[]>()

/**
 * A city's buildings, in city units (the old three-block city spanned -18 to
 * 18 and stood up to 32 tall, and its hit range is set against that). Each city
 * keeps the same skyline for good, so it can be known by its shape.
 */
function skyline(id: number): Building[] {
  let out = skylines.get(id)
  if (out) return out
  const r = mulberry32(id * 7919 + 101)
  const roofs: Roof[] = ['flat', 'peak', 'dome', 'spire', 'step']
  out = []
  // A back row of two tall towers, then a front row of three or four.
  let x = -15
  for (let i = 0; i < 2; i++) {
    const w = 9 + r() * 5
    out.push({ x: x + r() * 3, w, h: 26 + r() * 10, back: true, roof: roofs[Math.floor(r() * roofs.length)]! })
    x += w + 5 + r() * 4
  }
  const front = r() < 0.5 ? 3 : 4
  const span = 38
  let fx = -19
  for (let i = 0; i < front; i++) {
    const w = span / front - 1.2 - r() * 1.5
    out.push({ x: fx + 0.6, w, h: 11 + r() * 12, back: false, roof: roofs[Math.floor(r() * roofs.length)]! })
    fx += span / front
  }
  skylines.set(id, out)
  return out
}

function buildingPath(ctx: CanvasRenderingContext2D, b: Building, cx: number, gy: number, k: number) {
  const x0 = cx + b.x * k
  const x1 = x0 + b.w * k
  const top = gy - b.h * k
  ctx.beginPath()
  ctx.moveTo(x0, gy)
  ctx.lineTo(x0, top)
  if (b.roof === 'peak') {
    ctx.lineTo((x0 + x1) / 2, top - b.w * 0.42 * k)
    ctx.lineTo(x1, top)
  } else if (b.roof === 'dome') {
    ctx.arc((x0 + x1) / 2, top, (x1 - x0) / 2, Math.PI, 0)
  } else if (b.roof === 'step') {
    const inset = b.w * 0.24 * k
    ctx.lineTo(x0 + inset, top)
    ctx.lineTo(x0 + inset, top - 4 * k)
    ctx.lineTo(x1 - inset, top - 4 * k)
    ctx.lineTo(x1 - inset, top)
    ctx.lineTo(x1, top)
  } else {
    ctx.lineTo(x1, top)
  }
  ctx.lineTo(x1, gy)
  ctx.closePath()
}

function drawCity(ctx: CanvasRenderingContext2D, sk: Skin, city: City, s: GameState) {
  const gy = s.groundY
  const u = s.scale
  const k = u * PATRIOT_CITY_DRAW
  const sw = CITY_SWATCH[city.id % CITY_SWATCH.length]!
  const h = hue(sw)
  const lw = Math.max(1.1, 1.4 * u)

  if (!city.alive) {
    drawRubble(ctx, sk, city, s, h)
    return
  }

  const under = mix(sk.skyLow, sk.hillNear, 0.5)
  for (const [bi, b] of skyline(city.id).entries()) {
    buildingPath(ctx, b, city.x, gy, k)
    ctx.fillStyle = soft(under, h, b.back ? (sk.dark ? 0.26 : 0.3) : sk.dark ? 0.4 : 0.44)
    ctx.fill()
    ctx.strokeStyle = outline(sk, h, b.back ? 0.7 : 0.95)
    ctx.lineWidth = lw
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Windows: a lit grid by night that changes a light at a time; by day, dark panes.
    const x0 = city.x + b.x * k
    const cols = Math.max(1, Math.floor((b.w - 2) / 3.4))
    const rows = Math.max(1, Math.floor((b.h - 4) / 4.4))
    const ww = 1.5 * k
    const wh = 1.9 * k
    const gapX = (b.w * k - cols * ww) / (cols + 1)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const wx = x0 + gapX + col * (ww + gapX)
        const wy = gy - b.h * k + 3.4 * k + row * 4.4 * k
        if (wy + wh > gy - 1.5 * k) continue
        const seed = hash(city.id, bi, row, col)
        const lit = hash(seed, Math.floor(s.time / 6 + seed * 12)) < (sk.dark ? 0.55 : 0.2)
        ctx.fillStyle = sk.dark
          ? lit
            ? 'rgba(255, 214, 120, 0.9)'
            : css(mix(sk.skyTop, [0, 0, 0], 0.2), 0.55)
          : lit
            ? hsla(hue('amber'), 90, 62, 0.8)
            : outline(sk, h, 0.32)
        ctx.fillRect(wx, wy, ww, wh)
      }
    }

    // A spire carries a light that blinks.
    if (b.roof === 'spire') {
      const mx = x0 + (b.w * k) / 2
      const top = gy - b.h * k
      ctx.beginPath()
      ctx.moveTo(mx, top)
      ctx.lineTo(mx, top - 7 * k)
      ctx.strokeStyle = outline(sk, h, 0.9)
      ctx.lineWidth = lw
      ctx.stroke()
      const on = Math.sin(s.time * 3 + city.id * 1.7 + bi) > 0.2
      ctx.beginPath()
      ctx.arc(mx, top - 7 * k, 1.3 * k, 0, Math.PI * 2)
      ctx.fillStyle = on ? hsla(hue('red'), 90, sk.dark ? 66 : 54) : outline(sk, h, 0.5)
      ctx.fill()
    }
  }

  if (city.shielded) {
    // Domes rise when the power is used, over-reaching a little before settling.
    const t = clamp01((s.shieldAge ?? 99) / 0.45)
    const rise = t >= 1 ? 1 : 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
    drawShield(ctx, sk, city.x, gy, shieldRadius(u) * Math.max(0.05, rise), s.time, u)
  }
}

function drawShield(ctx: CanvasRenderingContext2D, sk: Skin, x: number, gy: number, r: number, time: number, u: number) {
  const h = hue('teal')
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, gy, r, Math.PI, 0)
  ctx.closePath()
  ctx.fillStyle = hsla(h, 70, 58, sk.dark ? 0.12 : 0.16)
  ctx.fill()
  ctx.clip()
  // A band of light sweeping over the dome.
  const sweep = ((time * 0.7) % 1.6) - 0.3
  const bx = x - r + sweep * 2 * r
  const band = ctx.createLinearGradient(bx - r * 0.3, 0, bx + r * 0.3, 0)
  band.addColorStop(0, hsla(h, 80, 70, 0))
  band.addColorStop(0.5, hsla(h, 80, 70, sk.dark ? 0.2 : 0.3))
  band.addColorStop(1, hsla(h, 80, 70, 0))
  ctx.fillStyle = band
  ctx.fillRect(x - r, gy - r, r * 2, r)
  ctx.restore()
  ctx.beginPath()
  ctx.arc(x, gy, r, Math.PI, 0)
  ctx.strokeStyle = outline(sk, 'teal', 0.9)
  ctx.lineWidth = Math.max(1.4, 2 * u)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, gy, r * 0.84, Math.PI * 1.15, Math.PI * 1.4)
  ctx.strokeStyle = outline(sk, 'teal', 0.45)
  ctx.lineWidth = Math.max(1, 1.4 * u)
  ctx.lineCap = 'round'
  ctx.stroke()
}

function smokePlume(ctx: CanvasRenderingContext2D, sk: Skin, x: number, gy: number, u: number, time: number, seed: number, reach: number) {
  for (let k = 0; k < 6; k++) {
    const t = (time * 0.22 + k / 6 + seed * 0.37) % 1
    const px = x + Math.sin(t * 3.2 + seed * 5) * 6 * u * t + t * 10 * u
    const py = gy - (4 + t * reach) * u
    const r = (3 + t * 11) * u
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fillStyle = sk.dark ? `rgba(150, 160, 170, ${0.2 * (1 - t)})` : `rgba(90, 100, 112, ${0.16 * (1 - t)})`
    ctx.fill()
  }
}

function drawRubble(ctx: CanvasRenderingContext2D, sk: Skin, city: City, s: GameState, h: number) {
  const gy = s.groundY
  const u = s.scale
  const k = u * PATRIOT_CITY_DRAW
  const r = mulberry32(city.id * 131 + 7)
  ctx.beginPath()
  ctx.moveTo(city.x - 19 * k, gy)
  let x = -19
  while (x < 19) {
    const step = 2.5 + r() * 4
    x = Math.min(19, x + step)
    ctx.lineTo(city.x + x * k, gy - (1.5 + r() * 6) * k)
  }
  ctx.lineTo(city.x + 19 * k, gy)
  ctx.closePath()
  ctx.fillStyle = css(mix(sk.hillNear, [110, 116, 124], sk.dark ? 0.22 : 0.3))
  ctx.fill()
  ctx.strokeStyle = hsla(h, 18, sk.lineL, 0.7)
  ctx.lineWidth = Math.max(1.1, 1.4 * u)
  ctx.lineJoin = 'round'
  ctx.stroke()
  // A broken beam standing up out of it.
  ctx.beginPath()
  ctx.moveTo(city.x - 4 * k, gy - 2 * k)
  ctx.lineTo(city.x - 1 * k, gy - 13 * k)
  ctx.lineTo(city.x + 1.5 * k, gy - 11 * k)
  ctx.strokeStyle = hsla(h, 18, sk.lineL, 0.7)
  ctx.stroke()
  smokePlume(ctx, sk, city.x - 6 * k, gy, u, s.time, city.id, 60)
  smokePlume(ctx, sk, city.x + 7 * k, gy, u, s.time, city.id + 0.5, 46)
  if (sk.dark) {
    for (let i = 0; i < 5; i++) {
      const flick = 0.4 + 0.6 * Math.abs(Math.sin(s.time * (3 + i) + city.id + i))
      ctx.fillStyle = `rgba(255, 150, 70, ${0.7 * flick})`
      ctx.beginPath()
      ctx.arc(city.x + (hash(city.id, i) - 0.5) * 30 * k, gy - (1 + hash(i, city.id) * 3) * k, 1.1 * u, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// Launchers -------------------------------------------------------------------------

/** The launcher that will answer a click: the nearest one with shells left. */
function readyBattery(s: GameState): Battery | null {
  let best: Battery | null = null
  for (const b of s.batteries) {
    if (!b.alive || b.ammo <= 0) continue
    if (!best || Math.abs(b.x - s.cursor.x) < Math.abs(best.x - s.cursor.x)) best = b
  }
  return best
}

function drawBattery(ctx: CanvasRenderingContext2D, sk: Skin, bat: Battery, s: GameState, ready: boolean) {
  const u = s.scale
  const gy = s.groundY
  const x = bat.x
  const lw = Math.max(1.2, 1.5 * u)
  const under = sk.ground
  const red = hue('red')

  // The rack: ten shells in two rows, spent ones left as outlines. An ammo
  // power lights the rack while it fills.
  const reload = bat.alive ? (s.reloadT ?? 0) : 0
  if (reload > 0) {
    ctx.save()
    ctx.globalAlpha = reload * (sk.dark ? 0.5 : 0.4)
    ctx.fillStyle = hsla(hue('amber'), 90, sk.dark ? 60 : 70, 1)
    ctx.beginPath()
    ctx.roundRect(x - 21 * u, gy + 6 * u, 42 * u, 28 * u, 6 * u)
    ctx.fill()
    ctx.restore()
  }
  for (let i = 0; i < 10; i++) {
    const col = i % 5
    const row = Math.floor(i / 5)
    const mx = x + (col - 2) * 7.4 * u
    const my = gy + 9 * u + row * 13 * u
    const full = bat.alive && i < bat.ammo
    const k = full && reload > 0 ? 1 + 0.3 * reload * Math.max(0, Math.sin((1 - reload) * 12 - i * 0.6)) : 1
    ctx.beginPath()
    ctx.moveTo(mx, my + 4.5 * u - 4.5 * u * k)
    ctx.lineTo(mx + 2 * u * k, my + 4.5 * u - 1.5 * u * k)
    ctx.lineTo(mx + 2 * u * k, my + 4.5 * u + 4.5 * u * k)
    ctx.lineTo(mx - 2 * u * k, my + 4.5 * u + 4.5 * u * k)
    ctx.lineTo(mx - 2 * u * k, my + 4.5 * u - 1.5 * u * k)
    ctx.closePath()
    ctx.fillStyle = full ? soft(under, 'amber', sk.dark ? 0.7 : 0.6) : 'rgba(0, 0, 0, 0)'
    ctx.fill()
    ctx.strokeStyle = full ? outline(sk, 'amber', 0.95) : outline(sk, 'amber', 0.25)
    ctx.lineWidth = Math.max(0.9, 1.1 * u)
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  if (!bat.alive) {
    // Knocked flat: a broken bunker with its barrel lying beside it.
    ctx.beginPath()
    ctx.moveTo(x - 16 * u, gy)
    ctx.lineTo(x - 12 * u, gy - 5 * u)
    ctx.lineTo(x - 4 * u, gy - 3 * u)
    ctx.lineTo(x + 3 * u, gy - 6 * u)
    ctx.lineTo(x + 11 * u, gy - 4 * u)
    ctx.lineTo(x + 16 * u, gy)
    ctx.closePath()
    ctx.fillStyle = css(mix(under, [110, 116, 124], 0.3))
    ctx.fill()
    ctx.strokeStyle = hsla(red, 18, sk.lineL, 0.7)
    ctx.lineWidth = lw
    ctx.stroke()
    ctx.save()
    ctx.translate(x + 14 * u, gy - 2 * u)
    ctx.rotate(0.18)
    ctx.beginPath()
    ctx.roundRect(-18 * u, -3 * u, 18 * u, 6 * u, 3 * u)
    ctx.fillStyle = css(mix(under, [110, 116, 124], 0.3))
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    smokePlume(ctx, sk, x, gy, u, s.time, bat.id + 3, 40)
    return
  }

  // Barrel, turned to the sight and kicked back by the last shot.
  const pivotY = gy - 11 * u
  const aim = Math.max(-Math.PI + 0.22, Math.min(-0.22, Math.atan2(s.cursor.y - pivotY, s.cursor.x - x)))
  const kick = bat.kick ?? 0
  ctx.save()
  ctx.translate(x, pivotY)
  ctx.rotate(aim)
  const back = kick * 5 * u
  ctx.beginPath()
  ctx.roundRect(-3 * u - back, -3.4 * u, 23 * u, 6.8 * u, 3 * u)
  ctx.fillStyle = soft(under, 'red', ready ? 0.62 : 0.48)
  ctx.fill()
  ctx.strokeStyle = outline(sk, 'red', ready ? 1 : 0.85)
  ctx.lineWidth = lw
  ctx.stroke()
  // A band near the muzzle.
  ctx.beginPath()
  ctx.moveTo(15 * u - back, -3.4 * u)
  ctx.lineTo(15 * u - back, 3.4 * u)
  ctx.strokeStyle = outline(sk, 'red', 0.6)
  ctx.stroke()
  if (kick > 0.45) {
    const f = (kick - 0.45) / 0.55
    const tip = 21 * u - back
    ctx.fillStyle = sk.dark ? `rgba(255, 236, 170, ${0.95 * f})` : hsla(hue('amber'), 95, 55, 0.95 * f)
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const rr = i % 2 === 0 ? 7 * u * f : 2.6 * u * f
      const px = tip + 3 * u + Math.cos(a) * rr
      const py = Math.sin(a) * rr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // The bunker, over the barrel's heel.
  ctx.beginPath()
  ctx.moveTo(x - 17 * u, gy)
  ctx.lineTo(x - 12 * u, gy - 12 * u)
  ctx.lineTo(x + 12 * u, gy - 12 * u)
  ctx.lineTo(x + 17 * u, gy)
  ctx.closePath()
  ctx.fillStyle = soft(under, 'red', sk.dark ? 0.44 : 0.4)
  ctx.fill()
  ctx.strokeStyle = outline(sk, 'red', 0.95)
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.stroke()
  // Pivot hub and a ready light.
  ctx.beginPath()
  ctx.arc(x, pivotY, 4.4 * u, 0, Math.PI * 2)
  ctx.fillStyle = soft(under, 'red', 0.62)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, gy - 5.5 * u, 1.6 * u, 0, Math.PI * 2)
  ctx.fillStyle = bat.ammo > 0 ? hsla(hue('green'), 80, sk.dark ? 62 : 44) : hsla(red, 80, sk.dark ? 62 : 48)
  ctx.fill()
}

// In the air --------------------------------------------------------------------------

function trail(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x: number,
  y: number,
  color: (a: number) => string,
  width: number,
  strength: number,
) {
  if (Math.hypot(x - x0, y - y0) < 1) return
  const g = ctx.createLinearGradient(x0, y0, x, y)
  g.addColorStop(0, color(0))
  g.addColorStop(0.55, color(0.18 * strength))
  g.addColorStop(1, color(0.75 * strength))
  ctx.strokeStyle = g
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x, y)
  ctx.stroke()
}

function drawIncoming(ctx: CanvasRenderingContext2D, sk: Skin, m: Incoming, s: GameState) {
  const u = s.scale
  const split = m.kind === 'split'
  const h = split ? hue('violet') : hue('red')
  const L = sk.dark ? 64 : 48
  trail(ctx, m.x0, m.y0, m.x, m.y, (a) => hsla(h, 70, L, a), Math.max(1.4, 2 * u), 1)

  const a = Math.atan2(m.y1 - m.y0, m.x1 - m.x0)
  ctx.save()
  ctx.translate(m.x, m.y)
  if (sk.dark) {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 11 * u)
    glow.addColorStop(0, hsla(h, 90, 70, 0.55))
    glow.addColorStop(1, hsla(h, 90, 70, 0))
    ctx.fillStyle = glow
    ctx.fillRect(-11 * u, -11 * u, 22 * u, 22 * u)
  }
  if (split) {
    // Ringed, and the ring beats faster as it nears the split.
    const drop = clamp01((m.y - m.y0) / Math.max(8, m.y1 - m.y0) / 0.5)
    const beat = 0.5 + 0.5 * Math.sin(s.time * (6 + drop * 18))
    ctx.beginPath()
    ctx.arc(0, 0, (7 + beat * 2.5) * u, 0, Math.PI * 2)
    ctx.strokeStyle = hsla(h, 70, L, 0.35 + 0.4 * drop)
    ctx.lineWidth = Math.max(1, 1.2 * u)
    ctx.stroke()
  }
  ctx.rotate(a)
  const len = (split ? 8 : 7) * u
  const half = (split ? 3.2 : 2.6) * u
  ctx.beginPath()
  ctx.moveTo(len * 0.6, 0)
  ctx.quadraticCurveTo(len * 0.1, -half, -len * 0.4, -half * 0.8)
  ctx.lineTo(-len * 0.4, half * 0.8)
  ctx.quadraticCurveTo(len * 0.1, half, len * 0.6, 0)
  ctx.closePath()
  ctx.fillStyle = sk.dark ? hsla(h, 80, 80, 1) : hsla(h, 75, 68, 1)
  ctx.fill()
  ctx.strokeStyle = hsla(h, 70, sk.dark ? 58 : 42, 1)
  ctx.lineWidth = Math.max(1, 1.2 * u)
  ctx.stroke()
  ctx.restore()
}

/**
 * Where each missile will come down, marked on the ground and louder the
 * nearer it is. The trail already says it; this says it where the eye is when
 * it is choosing what to shoot first.
 */
function drawGroundWarnings(ctx: CanvasRenderingContext2D, sk: Skin, s: GameState) {
  const u = s.scale
  const gy = s.groundY
  for (const m of s.incoming) {
    const left = Math.hypot(m.x1 - m.x, m.y1 - m.y) / Math.max(1, m.speed * (s.slowT > 0 ? 0.32 : 1))
    if (left > 4) continue
    const urgency = 1 - left / 4
    const guarded = s.cities.some((c) => c.alive && c.shielded && Math.abs(c.x - m.x1) < 30 * u * PATRIOT_CITY_DRAW)
    const h = guarded ? hue('teal') : m.kind === 'split' ? hue('violet') : hue('red')
    const beat = 0.6 + 0.4 * Math.sin(s.time * (5 + urgency * 12))
    const a = (0.25 + 0.65 * urgency) * beat
    const col = hsla(h, 78, sk.dark ? 64 : 48, a)
    ctx.strokeStyle = col
    ctx.lineWidth = Math.max(1.2, 1.6 * u)
    ctx.beginPath()
    ctx.ellipse(m.x1, gy, (8 + 5 * urgency) * u, 2.6 * u, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = col
    const cy = gy - (7 + 3 * beat) * u
    ctx.beginPath()
    ctx.moveTo(m.x1, cy + 4 * u)
    ctx.lineTo(m.x1 - 3.4 * u, cy - 1.5 * u)
    ctx.lineTo(m.x1 + 3.4 * u, cy - 1.5 * u)
    ctx.closePath()
    ctx.fill()
  }
}

function drawShot(ctx: CanvasRenderingContext2D, sk: Skin, shot: Shot, s: GameState) {
  const u = s.scale
  const h = shot.burst ? hue('violet') : hue('sky')
  const L = sk.dark ? 70 : 46
  trail(ctx, shot.x0, shot.y0, shot.x, shot.y, (a) => hsla(h, 80, L, a), Math.max(1.2, 1.7 * u), 1.2)
  if (sk.dark) {
    const glow = ctx.createRadialGradient(shot.x, shot.y, 0, shot.x, shot.y, 8 * u)
    glow.addColorStop(0, hsla(h, 90, 75, 0.6))
    glow.addColorStop(1, hsla(h, 90, 75, 0))
    ctx.fillStyle = glow
    ctx.fillRect(shot.x - 8 * u, shot.y - 8 * u, 16 * u, 16 * u)
  }
  ctx.beginPath()
  ctx.arc(shot.x, shot.y, 2.6 * u, 0, Math.PI * 2)
  ctx.fillStyle = sk.dark ? '#ffffff' : hsla(h, 80, 60)
  ctx.fill()
  ctx.strokeStyle = hsla(h, 80, sk.dark ? 70 : 40)
  ctx.lineWidth = Math.max(1, 1.1 * u)
  ctx.stroke()

  // The burst point, marked with an X until the shot gets there.
  const r = 5.5 * u
  const spin = s.time * 2.2
  ctx.save()
  ctx.translate(shot.x1, shot.y1)
  ctx.rotate(spin * 0.25)
  ctx.strokeStyle = hsla(h, 80, sk.dark ? 70 : 42, 0.9)
  ctx.lineWidth = Math.max(1.3, 1.8 * u)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-r, -r)
  ctx.lineTo(r, r)
  ctx.moveTo(r, -r)
  ctx.lineTo(-r, r)
  ctx.stroke()
  ctx.restore()
}

function drawBlast(ctx: CanvasRenderingContext2D, sk: Skin, b: Blast, s: GameState) {
  if ((b.wait ?? 0) > 0 || b.r < 2) return
  const u = s.scale
  const h = b.hue ?? (b.burst ? hue('violet') : 34)
  const heat = b.growing ? 1 : clamp01(b.r / Math.max(1, b.maxR))
  const R = b.r
  if (sk.dark) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const glow = ctx.createRadialGradient(b.x, b.y, R * 0.3, b.x, b.y, R * 1.45)
    glow.addColorStop(0, hsla(h, 95, 60, 0.3 * heat))
    glow.addColorStop(1, hsla(h, 95, 60, 0))
    ctx.fillStyle = glow
    ctx.fillRect(b.x - R * 1.5, b.y - R * 1.5, R * 3, R * 3)
    ctx.restore()
  }
  const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R)
  if (sk.dark) {
    g.addColorStop(0, `rgba(255, 248, 225, ${0.92 * heat})`)
    g.addColorStop(0.35, hsla(h, 95, 66, 0.78 * heat + 0.05))
    g.addColorStop(0.8, hsla(h - 16, 90, 54, 0.5 * heat + 0.08))
    g.addColorStop(1, hsla(h - 24, 85, 48, 0.3 * heat + 0.06))
  } else {
    g.addColorStop(0, hsla(h + 10, 100, 72, 0.9 * heat + 0.05))
    g.addColorStop(0.45, hsla(h, 95, 62, 0.62 * heat + 0.06))
    g.addColorStop(1, hsla(h - 18, 88, 54, 0.3 * heat + 0.08))
  }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(b.x, b.y, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = hsla(h, 80, sk.dark ? 66 : 44, 0.35 + 0.6 * heat)
  ctx.lineWidth = Math.max(1.2, (b.burst ? 2.4 : 1.8) * u)
  ctx.stroke()
  // A thinner ring just inside the edge while it grows.
  if (b.growing) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, R * 0.8, 0, Math.PI * 2)
    ctx.strokeStyle = hsla(h, 90, sk.dark ? 80 : 60, 0.35)
    ctx.lineWidth = Math.max(1, 1.2 * u)
    ctx.stroke()
  }
}

// Fire, smoke and words ---------------------------------------------------------------

function drawParticles(ctx: CanvasRenderingContext2D, sk: Skin, s: GameState) {
  for (const p of s.particles ?? []) {
    const a = clamp01(p.life * 1.25)
    if (p.kind === 'smoke') {
      const r = p.size * (1.6 - p.life * 0.8)
      ctx.globalAlpha = a * (sk.dark ? 0.22 : 0.18)
      ctx.fillStyle = sk.dark ? 'rgb(160, 170, 180)' : 'rgb(96, 106, 118)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
    } else if (p.kind === 'debris') {
      ctx.globalAlpha = a
      ctx.fillStyle = css(sk.dark ? [150, 158, 168] : [70, 80, 92], 0.9)
      const r = p.size
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((1 - p.life) * 8 + p.maxLife * 10)
      ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.2)
      ctx.restore()
    } else if (p.kind === 'ember') {
      ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(s.time * 12 + p.maxLife * 40))
      ctx.fillStyle = sk.dark ? 'rgb(255, 160, 80)' : hsla(hue('orange'), 90, 50)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // A spark: a short streak along its flight, cooling from white to its colour.
      const color =
        p.hue != null
          ? hsla(p.hue, 90, sk.dark ? 70 : 50, 1)
          : p.tone === 'hot'
            ? p.life > 0.6
              ? sk.dark
                ? 'rgb(255, 244, 210)'
                : hsla(hue('amber'), 95, 52)
              : hsla(hue('orange') - (1 - p.life) * 20, 95, sk.dark ? 62 : 48)
            : toneColor(sk, p.tone)
      ctx.globalAlpha = a
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1, p.size)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

/** Text stands on a halo of the sky, as the other games' floaters do. */
function halo(ctx: CanvasRenderingContext2D, sk: Skin, size: number) {
  const color = css(mix(sk.skyTop, sk.dark ? [0, 0, 0] : [255, 255, 255], 0.5), 0.9)
  ctx.shadowColor = color
  ctx.shadowBlur = Math.max(5, size * 0.35)
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(3, size * 0.2)
  ctx.lineJoin = 'round'
}

function drawFloaters(ctx: CanvasRenderingContext2D, sk: Skin, s: GameState) {
  const u = s.scale
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of s.floaters) {
    const alpha = Math.min(1, f.life * 2) * Math.min(1, f.life * 1.4)
    const age = 1.2 - f.life
    const pop = age < 0.12 ? 1 + (0.12 - age) * 2 : 1
    const size = Math.round((f.big ? 21 : 17) * Math.max(0.75, u) * pop)
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = `600 ${size}px ${FONT}`
    halo(ctx, sk, size)
    ctx.fillStyle = toneColor(sk, f.tone)
    ctx.strokeText(f.text, f.x, f.y)
    ctx.fillText(f.text, f.x, f.y)
    if (f.sub) {
      const sub = Math.round(size * 0.6)
      ctx.font = `600 ${sub}px ${FONT}`
      halo(ctx, sk, sub)
      ctx.fillStyle = css(sk.ink, 0.88)
      ctx.strokeText(f.sub, f.x, f.y + size * 0.78)
      ctx.fillText(f.sub, f.x, f.y + size * 0.78)
    }
  }
  ctx.restore()
}

function drawBanner(ctx: CanvasRenderingContext2D, sk: Skin, s: GameState, w: number, h: number) {
  const b = s.banner
  if (!b) return
  const t = 1 - b.life / b.maxLife
  const alpha = t < 0.1 ? t / 0.1 : t > 0.72 ? Math.max(0, (1 - t) / 0.28) : 1
  const pop = 1 + Math.max(0, 0.12 - t) * 2
  const size = Math.round(Math.max(24, Math.min(48, w * 0.05)) * pop)
  const y = h * 0.3
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${size}px ${FONT}`
  halo(ctx, sk, size)
  ctx.fillStyle = toneColor(sk, b.tone)
  ctx.strokeText(b.text, w / 2, y)
  ctx.fillText(b.text, w / 2, y)
  if (b.sub) {
    const sub = Math.round(Math.max(13, size * 0.38))
    ctx.font = `600 ${sub}px ${FONT}`
    halo(ctx, sk, sub)
    ctx.fillStyle = css(sk.ink, 0.92)
    ctx.strokeText(b.sub, w / 2, y + size * 0.8)
    ctx.fillText(b.sub, w / 2, y + size * 0.8)
  }
  ctx.restore()
}

let finePointer: boolean | null = null
function hasFinePointer() {
  if (finePointer === null) {
    finePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true
  }
  return finePointer
}

/** The sight, for a mouse: the system crosshair is hidden while it is drawn. */
function drawSight(ctx: CanvasRenderingContext2D, sk: Skin, s: GameState, ready: Battery | null) {
  if (s.phase !== 'playing' || !hasFinePointer()) return
  const u = Math.max(0.8, s.scale)
  const { x, y } = s.cursor
  const dry = !ready
  const color = dry ? hsla(hue('red'), 80, sk.dark ? 66 : 48, 0.95) : s.burstArmed ? toneColor(sk, 'violet') : css(sk.ink, 0.9)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6 * u
  ctx.lineCap = 'round'
  const r = 10 * u
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    ctx.moveTo(x + dx * r * 0.55, y + dy * r * 0.55)
    ctx.lineTo(x + dx * r * 1.45, y + dy * r * 1.45)
  }
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y, 1.4 * u, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

// Frame -----------------------------------------------------------------------------

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const s = state
  const sk = skin()
  const shake = (s.shake ?? 0) > 0 ? (s.shake ?? 0) ** 2 * 7 * Math.max(0.6, s.scale) : 0

  ctx.save()
  if (shake) ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2)
  paintBackdrop(ctx, sk, s, w, h, dpr)
  drawSkyLife(ctx, sk, s, w)

  if (s.slowT > 0) {
    // Slowed: the sky takes a cold tint that thins as the power runs out, and
    // the moment it starts a ring of it sweeps out across the sky.
    ctx.fillStyle = hsla(hue('sky'), 80, 60, 0.1 * Math.min(1, s.slowT))
    ctx.fillRect(0, 0, w, s.groundY)
    const since = SLOW_TIME - s.slowT
    if (since < 0.9) {
      const t = since / 0.9
      ctx.beginPath()
      ctx.arc(w / 2, s.groundY * 0.55, Math.hypot(w, h) * 0.6 * (1 - (1 - t) ** 2), 0, Math.PI * 2)
      ctx.strokeStyle = hsla(hue('sky'), 80, sk.dark ? 70 : 50, 0.55 * (1 - t))
      ctx.lineWidth = Math.max(2, 10 * s.scale * (1 - t))
      ctx.stroke()
    }
  }

  const ready = s.phase === 'playing' ? readyBattery(s) : null
  for (const city of s.cities) drawCity(ctx, sk, city, s)
  for (const bat of s.batteries) drawBattery(ctx, sk, bat, s, ready?.id === bat.id)
  if (s.phase === 'playing') drawGroundWarnings(ctx, sk, s)

  for (const m of s.incoming) drawIncoming(ctx, sk, m, s)
  for (const plane of s.planes) drawPlane(ctx, sk, plane, s)
  for (const bomber of s.bombers ?? []) drawBomber(ctx, sk, bomber, s)
  for (const drone of s.drones ?? []) drawCarrier(ctx, sk, drone, s)
  for (const shot of s.shots) drawShot(ctx, sk, shot, s)
  for (const b of s.blasts) drawBlast(ctx, sk, b, s)
  drawParticles(ctx, sk, s)
  ctx.restore()

  // Off the shaking layer: these are headed for the buttons, which hold still.
  drawPickups(ctx, sk, s)
  drawFloaters(ctx, sk, s)
  drawBanner(ctx, sk, s, w, h)
  drawSight(ctx, sk, s, ready)

  // White over a near-white playfield moved it about three points and read as
  // nothing, so the light theme flashes dark instead.
  if (s.flash > 0) {
    ctx.fillStyle = sk.dark ? `rgba(255,255,255,${s.flash * 0.3})` : `rgba(26,43,60,${s.flash * 0.2})`
    ctx.fillRect(0, 0, w, h)
  }
}
