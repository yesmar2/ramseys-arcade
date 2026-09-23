/**
 * Painting a scene, and putting it on screen.
 *
 * A scene is two hundred critters and a set of props, all drawn in vector —
 * far too much to repaint every frame. So it is painted once into a layer the
 * size of the field, and each frame only copies that layer to the canvas and
 * draws the few things that move on top: the found ring, a miss, the hint.
 *
 * Zoomed in, the copy is magnified and goes soft, so once the view stops
 * moving the part in view is repainted at the new size into a second layer.
 * A map app does the same: blurry while you drag, sharp when you let go.
 */

import { isDarkTheme, playfieldColor } from '../../lib/theme'
import { drawCritter, INK } from './critters'
import { drawProp } from './props'
import {
  pxPerUnit,
  sameCamera,
  viewRect,
  worldToScreen,
  type Camera,
  type Field,
  type WorldRect,
} from './camera'
import { itemBounds, type Decal, type Scene } from './scenes'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** Painting done a piece at a time: every `yield` is a place a frame may end. */
type Steps = Generator<void, void, void>

const TAU = Math.PI * 2

function overlaps(a: WorldRect, b: WorldRect) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
}

function ep(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU)
}

// ------------------------------------------------------------------ ground

/**
 * The daytime scenes sink to dusk in the dark theme, so a sunlit lawn doesn't
 * glare out of the site's dark screens: deeper grass, sand and water, and the
 * marks on them go down with them. In the light theme they stay in daylight.
 * Critters and props are the same in both, so every clue reads the same.
 */
function atDusk(scene: Scene) {
  return isDarkTheme() && (scene.kind === 'picnic' || scene.kind === 'garden' || scene.kind === 'pond')
}

const DUSK = {
  picnicGrass: ['#387157', '#2f604a'],
  gardenGrass: ['#366d54', '#2d5c47'],
  lilyPad: '#37815f',
  sand: ['#b29c70', '#a88f5d'],
  wetSand: '#8f794d',
  water: ['#295d70', '#1b3950'],
  /** Sunlight, faint, on grass the sun has left. */
  sunPatch: 'rgba(248, 232, 200, 0.04)',
} as const

const sunkCache = new Map<string, string>()

/** A mark on the ground gone down with the ground under it: same hue, much darker. */
function sunk(colour: string): string {
  let out = sunkCache.get(colour)
  if (out === undefined) {
    out = colour
    const m = /^#([0-9a-f]{6})$/i.exec(colour)
    if (m) {
      const n = Number.parseInt(m[1]!, 16)
      const k = 0.58
      out = `rgb(${Math.round(((n >> 16) & 255) * k)}, ${Math.round(((n >> 8) & 255) * k)}, ${Math.round((n & 255) * k)})`
    }
    sunkCache.set(colour, out)
  }
  return out
}

/** The colour round the edge of a scene, for anything the scene does not cover. */
export function edgeColour(scene: Scene): string {
  const dusk = atDusk(scene)
  switch (scene.kind) {
    case 'picnic':
      return dusk ? DUSK.picnicGrass[1] : '#4ab485'
    case 'garden':
      return dusk ? DUSK.gardenGrass[1] : '#46ad7f'
    case 'pond':
      return dusk ? DUSK.water[1] : '#3f8bbf'
    case 'arcade':
      return '#23183b'
    default:
      return '#1b1e44'
  }
}

function* paintPicnic(ctx: Ctx, scene: Scene): Steps {
  if (scene.ground.kind !== 'picnic') return
  const { w, h } = scene
  const dusk = atDusk(scene)
  const grass = ctx.createLinearGradient(0, 0, 0, h)
  grass.addColorStop(0, dusk ? DUSK.picnicGrass[0] : '#68d3a3')
  grass.addColorStop(1, dusk ? DUSK.picnicGrass[1] : '#58bf91')
  ctx.fillStyle = grass
  ctx.fillRect(0, 0, w, h)
  yield
  yield* sunPatches(ctx, scene, dusk ? DUSK.sunPatch : 'rgba(248, 232, 200, 0.12)')
  yield

  const b = scene.ground.blanket
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(b.rot)
  ctx.fillStyle = 'rgba(26, 77, 54, 0.28)'
  ctx.beginPath()
  ctx.roundRect(-b.w / 2 + scene.unit * 0.12, -b.h / 2 + scene.unit * 0.18, b.w, b.h, scene.unit * 0.2)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, scene.unit * 0.16)
  ctx.fillStyle = '#f1f3f4'
  ctx.fill()
  ctx.save()
  ctx.clip()
  // Gingham: red bands both ways, darker where they cross.
  const cell = scene.unit * 0.58
  ctx.fillStyle = 'rgba(214, 59, 51, 0.46)'
  for (let x = -b.w / 2; x < b.w / 2; x += cell * 2) ctx.fillRect(x, -b.h / 2, cell, b.h)
  for (let y = -b.h / 2; y < b.h / 2; y += cell * 2) ctx.fillRect(-b.w / 2, y, b.w, cell)
  // Folds in the cloth.
  ctx.strokeStyle = 'rgba(119, 43, 40, 0.12)'
  ctx.lineWidth = scene.unit * 0.12
  for (const t of [-0.18, 0.22]) {
    ctx.beginPath()
    ctx.moveTo(-b.w / 2, t * b.h)
    ctx.bezierCurveTo(-b.w * 0.2, t * b.h - scene.unit * 0.3, b.w * 0.2, t * b.h + scene.unit * 0.3, b.w / 2, t * b.h)
    ctx.stroke()
  }
  ctx.restore()
  // Hem stitching.
  ctx.setLineDash([scene.unit * 0.12, scene.unit * 0.1])
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.lineWidth = scene.unit * 0.04
  ctx.beginPath()
  ctx.roundRect(-b.w / 2 + scene.unit * 0.16, -b.h / 2 + scene.unit * 0.16, b.w - scene.unit * 0.32, b.h - scene.unit * 0.32, scene.unit * 0.1)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, scene.unit * 0.16)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.restore()

  yield
  for (const p of scene.ground.plates) {
    ep(ctx, p.x + scene.unit * 0.06, p.y + scene.unit * 0.1, p.r, p.r * 0.55)
    ctx.fillStyle = 'rgba(69, 34, 49, 0.2)'
    ctx.fill()
    ep(ctx, p.x, p.y, p.r, p.r * 0.55)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.stroke()
    ep(ctx, p.x, p.y, p.r * 0.72, p.r * 0.38)
    ctx.strokeStyle = 'rgba(116, 122, 198, 0.5)'
    ctx.lineWidth = 1.2
    ctx.stroke()
    // Biscuits.
    for (const [dx, dy] of [[-0.3, -0.05], [0.12, -0.1], [0.32, 0.08], [-0.08, 0.14]] as const) {
      ep(ctx, p.x + dx * p.r, p.y + dy * p.r, p.r * 0.2, p.r * 0.12)
      ctx.fillStyle = '#d8ac56'
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.1
      ctx.stroke()
      ctx.fillStyle = '#623b23'
      ep(ctx, p.x + dx * p.r - p.r * 0.05, p.y + dy * p.r, p.r * 0.03, p.r * 0.02)
      ctx.fill()
      ep(ctx, p.x + dx * p.r + p.r * 0.06, p.y + dy * p.r - p.r * 0.03, p.r * 0.03, p.r * 0.02)
      ctx.fill()
    }
  }
}

/** Big soft pools of sunlight, so a field of grass is not one flat colour. */
function* sunPatches(ctx: Ctx, scene: Scene, colour: string): Steps {
  const { w, h } = scene
  const spots = [
    [0.2, 0.25, 0.35],
    [0.75, 0.6, 0.4],
    [0.35, 0.85, 0.3],
  ] as const
  for (const [fx, fy, fr] of spots) {
    const r = Math.max(w, h) * fr
    const cx = fx * w
    const cy = fy * h
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, colour)
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    // Only the square the pool reaches: a gradient costs every pixel it covers.
    const x0 = Math.max(0, cx - r)
    const y0 = Math.max(0, cy - r)
    ctx.fillRect(x0, y0, Math.min(w, cx + r) - x0, Math.min(h, cy + r) - y0)
    yield
  }
}

function* paintGarden(ctx: Ctx, scene: Scene): Steps {
  if (scene.ground.kind !== 'garden') return
  const { w, h } = scene
  const u = scene.unit
  const dusk = atDusk(scene)
  const grass = ctx.createLinearGradient(0, 0, 0, h)
  grass.addColorStop(0, dusk ? DUSK.gardenGrass[0] : '#63ce9e')
  grass.addColorStop(1, dusk ? DUSK.gardenGrass[1] : '#56bd8e')
  ctx.fillStyle = grass
  ctx.fillRect(0, 0, w, h)
  yield
  yield* sunPatches(ctx, scene, dusk ? DUSK.sunPatch : 'rgba(248, 232, 200, 0.1)')
  yield

  for (const s of scene.ground.stones) {
    ep(ctx, s.x, s.y, s.r, s.r * 0.6)
    ctx.fillStyle = '#b9c2c8'
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.2
    ctx.stroke()
    ep(ctx, s.x - s.r * 0.2, s.y - s.r * 0.15, s.r * 0.4, s.r * 0.18)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.fill()
  }

  yield
  for (const bed of scene.ground.beds) {
    const bw = bed.x1 - bed.x0
    const bh = bed.y1 - bed.y0
    ctx.fillStyle = 'rgba(24, 61, 44, 0.25)'
    ctx.beginPath()
    ctx.roundRect(bed.x0 + u * 0.08, bed.y0 + u * 0.14, bw, bh, u * 0.3)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(bed.x0, bed.y0, bw, bh, u * 0.3)
    ctx.fillStyle = '#7e5338'
    ctx.fill()
    ctx.save()
    ctx.clip()
    // Furrows.
    ctx.strokeStyle = 'rgba(59, 35, 20, 0.35)'
    ctx.lineWidth = u * 0.1
    for (let y = bed.y0 + u * 0.4; y < bed.y1; y += u * 0.7) {
      ctx.beginPath()
      ctx.moveTo(bed.x0, y)
      for (let x = bed.x0; x <= bed.x1; x += u * 0.5) ctx.lineTo(x, y + Math.sin(x * 0.05) * u * 0.06)
      ctx.stroke()
    }
    ctx.restore()
    // Timber edging.
    ctx.beginPath()
    ctx.roundRect(bed.x0, bed.y0, bw, bh, u * 0.3)
    ctx.strokeStyle = INK
    ctx.lineWidth = u * 0.2
    ctx.stroke()
    ctx.strokeStyle = '#c27c51'
    ctx.lineWidth = u * 0.13
    ctx.stroke()
  }
}

function* paintPond(ctx: Ctx, scene: Scene): Steps {
  if (scene.ground.kind !== 'pond') return
  const { w, h } = scene
  const u = scene.unit
  const shore = scene.ground.shore
  const dusk = atDusk(scene)
  const sand = ctx.createLinearGradient(0, 0, 0, h * 0.5)
  sand.addColorStop(0, dusk ? DUSK.sand[0] : '#f4d9a3')
  sand.addColorStop(1, dusk ? DUSK.sand[1] : '#eaca89')
  ctx.fillStyle = sand
  ctx.fillRect(0, 0, w, h)

  const shoreline = (offset: number) => {
    ctx.moveTo(0, shore[0] + offset)
    for (let k = 1; k < shore.length; k++) {
      const x0 = ((k - 1) / (shore.length - 1)) * w
      const x1 = (k / (shore.length - 1)) * w
      ctx.quadraticCurveTo(x0, shore[k - 1] + offset, (x0 + x1) / 2, (shore[k - 1] + shore[k]) / 2 + offset)
    }
    ctx.lineTo(w, shore[shore.length - 1] + offset)
  }

  yield
  // Wet sand, then the water.
  ctx.beginPath()
  shoreline(-u * 0.5)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = dusk ? DUSK.wetSand : '#d8b672'
  ctx.fill()

  const water = ctx.createLinearGradient(0, h * 0.35, 0, h)
  water.addColorStop(0, dusk ? DUSK.water[0] : '#66b2e5')
  water.addColorStop(1, dusk ? DUSK.water[1] : '#3b8dc4')
  ctx.beginPath()
  shoreline(0)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = water
  ctx.fill()
  ctx.save()
  ctx.clip()
  // Light on the water.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.lineWidth = u * 0.1
  for (let y = 0; y < h; y += u * 1.1) {
    ctx.beginPath()
    for (let x = 0; x <= w; x += u * 0.6) {
      const yy = y + Math.sin(x * 0.03 + y) * u * 0.12
      if (x === 0) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  ctx.restore()
  yield
  // Foam along the edge.
  ctx.beginPath()
  shoreline(0)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.beginPath()
  shoreline(u * 0.14)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = u * 0.1
  ctx.setLineDash([u * 0.5, u * 0.25])
  ctx.stroke()
  ctx.setLineDash([])

  yield
  for (const pad of scene.ground.pads) {
    ctx.save()
    ctx.translate(pad.x, pad.y)
    ctx.scale(1, 0.55)
    ctx.fillStyle = 'rgba(30, 67, 91, 0.3)'
    ep(ctx, u * 0.1, u * 0.2, pad.r, pad.r)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, pad.r, pad.rot + 0.35, pad.rot + TAU - 0.35)
    ctx.closePath()
    ctx.fillStyle = dusk ? DUSK.lilyPad : '#49b283'
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5 / 0.75
    ctx.stroke()
    ctx.strokeStyle = 'rgba(28, 84, 59, 0.35)'
    ctx.lineWidth = u * 0.05
    for (let k = 1; k < 7; k++) {
      const a = pad.rot + 0.35 + (k / 7) * (TAU - 0.7)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * pad.r * 0.85, Math.sin(a) * pad.r * 0.85)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function paintArcade(ctx: Ctx, scene: Scene) {
  if (scene.ground.kind !== 'arcade') return
  const { w, h } = scene
  const u = scene.unit
  const wall = scene.ground.wall
  ctx.fillStyle = '#2c1e4d'
  ctx.fillRect(0, 0, w, h)
  // Wall with a stripe, skirting board below it.
  const wallFill = ctx.createLinearGradient(0, 0, 0, wall)
  wallFill.addColorStop(0, '#241841')
  wallFill.addColorStop(1, '#392761')
  ctx.fillStyle = wallFill
  ctx.fillRect(0, 0, w, wall)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
  for (let x = 0; x < w; x += u * 0.8) ctx.fillRect(x, 0, u * 0.35, wall)
  ctx.fillStyle = '#1c1232'
  ctx.fillRect(0, wall - u * 0.16, w, u * 0.24)
  ctx.fillStyle = '#ee77ab'
  ctx.fillRect(0, wall - u * 0.2, w, u * 0.05)
  // A glow on the floor under the wall.
  const glow = ctx.createLinearGradient(0, wall, 0, wall + u * 3)
  glow.addColorStop(0, 'rgba(238, 119, 171, 0.18)')
  glow.addColorStop(1, 'rgba(238, 119, 171, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, wall, w, u * 3)
}

function* paintNight(ctx: Ctx, scene: Scene): Steps {
  if (scene.ground.kind !== 'night') return
  const { w, h } = scene
  const u = scene.unit
  const horizon = scene.ground.horizon
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#191d4c')
  sky.addColorStop(1, '#43326c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, horizon)
  // The moon.
  const mx = w * 0.82
  const my = horizon * 0.42
  const moonGlow = ctx.createRadialGradient(mx, my, 0, mx, my, u * 2.4)
  moonGlow.addColorStop(0, 'rgba(247, 229, 192, 0.45)')
  moonGlow.addColorStop(1, 'rgba(247, 229, 192, 0)')
  ctx.fillStyle = moonGlow
  ctx.fillRect(mx - u * 2.4, my - u * 2.4, u * 4.8, u * 4.8)
  ep(ctx, mx, my, u * 0.62, u * 0.62)
  ctx.fillStyle = '#f7e5c0'
  ctx.fill()
  ep(ctx, mx + u * 0.18, my - u * 0.08, u * 0.1, u * 0.1)
  ctx.fillStyle = 'rgba(198, 171, 116, 0.4)'
  ctx.fill()

  yield
  // Hills on the horizon.
  ctx.beginPath()
  ctx.moveTo(0, horizon)
  for (let x = 0; x <= w; x += u) ctx.lineTo(x, horizon - u * 0.5 - Math.sin(x * 0.01) * u * 0.5 - Math.sin(x * 0.037) * u * 0.25)
  ctx.lineTo(w, horizon)
  ctx.closePath()
  ctx.fillStyle = '#243643'
  ctx.fill()

  yield
  const ground = ctx.createLinearGradient(0, horizon, 0, h)
  ground.addColorStop(0, '#284b3b')
  ground.addColorStop(1, '#325c4a')
  ctx.fillStyle = ground
  ctx.fillRect(0, horizon, w, h - horizon)

  // The path winding through, kept off the sky.
  const path = scene.ground.path
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, horizon, w, h - horizon)
  ctx.clip()
  ctx.beginPath()
  for (let k = 0; k < path.length; k++) {
    const y = horizon + ((h - horizon) * k) / (path.length - 1)
    if (k === 0) ctx.moveTo(path[k], y)
    else ctx.lineTo(path[k], y)
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#544338'
  ctx.lineWidth = w * 0.17
  ctx.stroke()
  ctx.strokeStyle = '#6e584a'
  ctx.lineWidth = w * 0.14
  ctx.stroke()
  ctx.restore()
}

function paintDecal(ctx: Ctx, d: Decal, dusk: boolean) {
  const s = d.s
  const colour = dusk ? sunk(d.colour) : d.colour
  switch (d.kind) {
    case 'blade': {
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      ctx.quadraticCurveTo(d.x + d.rot * s * 0.3, d.y - s * 0.6, d.x + d.rot * s, d.y - s)
      ctx.strokeStyle = colour
      ctx.lineWidth = s * 0.22
      ctx.lineCap = 'round'
      ctx.stroke()
      return
    }
    case 'clover': {
      ctx.fillStyle = colour
      for (let k = 0; k < 3; k++) {
        const a = d.rot + (k / 3) * TAU
        ep(ctx, d.x + Math.cos(a) * s * 0.3, d.y + Math.sin(a) * s * 0.3 * 0.6, s * 0.3, s * 0.22, a)
        ctx.fill()
      }
      return
    }
    case 'bloom': {
      ctx.fillStyle = colour
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU
        ep(ctx, d.x + Math.cos(a) * s * 0.55, d.y + Math.sin(a) * s * 0.4, s * 0.4, s * 0.3)
        ctx.fill()
      }
      ctx.fillStyle = dusk ? sunk('#e6ac39') : '#e6ac39'
      ep(ctx, d.x, d.y, s * 0.3, s * 0.25)
      ctx.fill()
      return
    }
    case 'speck':
      ctx.fillStyle = colour
      ep(ctx, d.x, d.y, s, s * 0.7)
      ctx.fill()
      return
    case 'crumb':
      ctx.fillStyle = colour
      ctx.beginPath()
      ctx.moveTo(d.x - s, d.y)
      ctx.lineTo(d.x - s * 0.3, d.y - s * 0.8)
      ctx.lineTo(d.x + s, d.y - s * 0.3)
      ctx.lineTo(d.x + s * 0.4, d.y + s * 0.6)
      ctx.closePath()
      ctx.fill()
      return
    case 'confetti': {
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.fillStyle = colour
      ctx.strokeStyle = colour
      ctx.lineWidth = s * 0.25
      ctx.lineCap = 'round'
      const kind = Math.floor(d.rot * 10) % 3
      if (kind === 0) {
        ctx.beginPath()
        ctx.moveTo(d.x, d.y - s * 0.6)
        ctx.lineTo(d.x + s * 0.55, d.y + s * 0.4)
        ctx.lineTo(d.x - s * 0.55, d.y + s * 0.4)
        ctx.closePath()
        ctx.fill()
      } else if (kind === 1) {
        ctx.beginPath()
        ctx.moveTo(d.x - s * 0.7, d.y)
        ctx.quadraticCurveTo(d.x - s * 0.35, d.y - s * 0.6, d.x, d.y)
        ctx.quadraticCurveTo(d.x + s * 0.35, d.y + s * 0.6, d.x + s * 0.7, d.y)
        ctx.stroke()
      } else {
        ep(ctx, d.x, d.y, s * 0.35, s * 0.35)
        ctx.fill()
      }
      ctx.restore()
      return
    }
    case 'shell':
      ctx.fillStyle = colour
      ctx.beginPath()
      ctx.moveTo(d.x, d.y + s * 0.3)
      ctx.arc(d.x, d.y + s * 0.3, s * 0.6, Math.PI * 1.1, Math.PI * 1.9)
      ctx.closePath()
      ctx.fill()
      return
    case 'ripple':
      ctx.strokeStyle = colour
      ctx.lineWidth = s * 0.08
      ctx.beginPath()
      ctx.ellipse(d.x, d.y, s, s * 0.3, 0, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
      return
    case 'star': {
      ctx.fillStyle = colour
      ctx.beginPath()
      ctx.moveTo(d.x, d.y - s)
      ctx.lineTo(d.x + s * 0.25, d.y - s * 0.25)
      ctx.lineTo(d.x + s, d.y)
      ctx.lineTo(d.x + s * 0.25, d.y + s * 0.25)
      ctx.lineTo(d.x, d.y + s)
      ctx.lineTo(d.x - s * 0.25, d.y + s * 0.25)
      ctx.lineTo(d.x - s, d.y)
      ctx.lineTo(d.x - s * 0.25, d.y - s * 0.25)
      ctx.closePath()
      ctx.fill()
      return
    }
  }
}

function* paintGarlands(ctx: Ctx, scene: Scene, view?: WorldRect): Steps {
  const u = scene.unit
  for (const g of scene.garlands) {
    yield
    const pts = g.points
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1]
      const [x1, y1] = pts[k]
      ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
    }
    ctx.strokeStyle = '#1e172f'
    ctx.lineWidth = 1.6
    ctx.stroke()
    let n = 0
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1]
      const [x1, y1] = pts[k]
      for (let t = 0; t < 1; t += 0.34) {
        const x = x0 + (x1 - x0) * t
        const y = y0 + (y1 - y0) * t + u * 0.12
        n++
        if (view && (x < view.x0 - u || x > view.x1 + u || y < view.y0 - u || y > view.y1 + u)) continue
        const colour = g.colours[n % g.colours.length]
        ctx.globalCompositeOperation = 'lighter'
        const halo = ctx.createRadialGradient(x, y, 0, x, y, u * 0.7)
        halo.addColorStop(0, hexGlow(colour, 0.45))
        halo.addColorStop(1, hexGlow(colour, 0))
        ctx.fillStyle = halo
        ctx.fillRect(x - u * 0.7, y - u * 0.7, u * 1.4, u * 1.4)
        ctx.globalCompositeOperation = 'source-over'
        ep(ctx, x, y, u * 0.1, u * 0.13)
        ctx.fillStyle = colour
        ctx.fill()
        ctx.strokeStyle = INK
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }
}

function hexGlow(hex: string, alpha: number): string {
  const v = hex.replace('#', '')
  const r = Number.parseInt(v.slice(0, 2), 16)
  const g = Number.parseInt(v.slice(2, 4), 16)
  const b = Number.parseInt(v.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Night: darken everything, then lift the dark where there is a light. Done in
 * a scratch layer so the lights cut holes in the dark rather than painting
 * yellow over it.
 */
function* paintLighting(ctx: Ctx, scene: Scene, crowd: boolean): Steps {
  if (scene.dusk <= 0) return
  // Light is all soft edges, so it is painted at a quarter of the size and
  // stretched over the scene: a sixteenth of the pixels for the same look.
  const canvas = ctx.canvas
  const w = Math.max(1, Math.ceil(canvas.width / 4))
  const h = Math.max(1, Math.ceil(canvas.height / 4))
  const m = ctx.getTransform()
  const small = (): CanvasRenderingContext2D | null => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const s = c.getContext('2d', { willReadFrequently: true })
    s?.setTransform(m.a / 4, m.b / 4, m.c / 4, m.d / 4, m.e / 4, m.f / 4)
    return s
  }
  const lights = [...scene.lights, ...lanternLights(scene, crowd)]

  const dark = small()
  const warm = small()
  if (!dark || !warm) return
  dark.fillStyle = `rgba(18, 20, 53, ${scene.dusk})`
  dark.fillRect(0, 0, scene.w, scene.h)
  dark.globalCompositeOperation = 'destination-out'
  for (const l of lights) {
    const g = dark.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r)
    g.addColorStop(0, 'rgba(0, 0, 0, 0.95)')
    g.addColorStop(0.55, 'rgba(0, 0, 0, 0.5)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    dark.fillStyle = g
    dark.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2)
    // A warm tint where the light falls.
    const t = warm.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.8)
    t.addColorStop(0, 'rgba(235, 148, 94, 0.14)')
    t.addColorStop(1, 'rgba(235, 148, 94, 0)')
    warm.fillStyle = t
    warm.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2)
  }
  dark.getImageData(0, 0, 1, 1)
  warm.getImageData(0, 0, 1, 1)
  yield
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(dark.canvas, 0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(warm.canvas, 0, 0, canvas.width, canvas.height)
  ctx.restore()
}

function lanternLights(scene: Scene, crowd: boolean) {
  const out: { x: number; y: number; r: number }[] = []
  if (!crowd) return out
  for (const c of scene.critters) {
    if (c.look.held !== 'lantern') continue
    out.push({ x: c.x + (c.flip ? -1 : 1) * c.size * 0.35, y: c.y - c.size * (0.75 + c.lift), r: c.size * 1.5 })
  }
  return out
}

/**
 * Paint the scene in world units, one small piece per step, so the work can
 * be spread over several frames. The caller sets the transform.
 *
 * Without the crowd (`crowd` false) it is the place as it was before anybody
 * came: the ground, the props, the lights, and none of the critters or the
 * lanterns they carry.
 */
export function* paintSteps(ctx: Ctx, scene: Scene, view?: WorldRect, crowd = true): Steps {
  switch (scene.kind) {
    case 'picnic':
      yield* paintPicnic(ctx, scene)
      break
    case 'garden':
      yield* paintGarden(ctx, scene)
      break
    case 'pond':
      yield* paintPond(ctx, scene)
      break
    case 'arcade':
      paintArcade(ctx, scene)
      break
    case 'night':
      yield* paintNight(ctx, scene)
      break
  }
  yield
  const pad = scene.unit
  const dusk = atDusk(scene)
  let n = 0
  for (const d of scene.decals) {
    if (view && (d.x < view.x0 - pad || d.x > view.x1 + pad || d.y < view.y0 - pad || d.y > view.y1 + pad)) continue
    paintDecal(ctx, d, dusk)
    if (++n % 120 === 0) yield
  }
  yield
  for (const item of scene.items) {
    if (item.critter && !crowd) continue
    if (view && !overlaps(itemBounds(item), view)) continue
    if (item.critter) drawCritter(ctx, item.critter)
    else if (item.prop) drawProp(ctx, item.prop)
    yield
  }
  yield* paintGarlands(ctx, scene, view)
  yield
  yield* paintLighting(ctx, scene, crowd)
}

/** Paint the whole scene in one go. */
export function paintScene(ctx: Ctx, scene: Scene, view?: WorldRect) {
  const steps = paintSteps(ctx, scene, view)
  while (!steps.next().done) {
    /* keep going */
  }
}

// ----------------------------------------------------------------- overlays

export type Overlays = {
  /** Hide the scene: paused, or waiting behind the scene card. */
  cover: boolean
  /** Full-field dim, 0–1: the daze after a wrong tap. */
  dim: number
  /** Everything outside this circle dims — the hint, or the spotlight on a find. */
  veil: { x: number; y: number; r: number; alpha: number } | null
  /** A ring round the Bug when he is found, or shown when time runs out. */
  ring: { x: number; y: number; r: number; alpha: number; colour: string } | null
  /** Where the wrong taps landed, with how old each one is (0–1). */
  misses: { x: number; y: number; age: number }[]
  /** Keyboard cursor. */
  reticle: { x: number; y: number } | null
}

function paintOverlays(ctx: Ctx, scene: Scene, cam: Camera, field: Field, o: Overlays, now: number) {
  const k = pxPerUnit(cam, field)
  if (o.veil) {
    const c = worldToScreen(o.veil.x, o.veil.y, cam, field)
    const r = o.veil.r * k
    ctx.save()
    ctx.beginPath()
    ctx.rect(field.x, field.y, field.w, field.h)
    ctx.arc(c.x, c.y, r, 0, TAU, true)
    ctx.fillStyle = `rgba(14, 16, 18, ${o.veil.alpha})`
    ctx.fill()
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, TAU)
    ctx.strokeStyle = `rgba(255, 255, 255, ${o.veil.alpha * 0.9})`
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  if (o.ring) {
    const c = worldToScreen(o.ring.x, o.ring.y, cam, field)
    const r = o.ring.r * k
    ctx.save()
    ctx.globalAlpha = o.ring.alpha
    ctx.strokeStyle = o.ring.colour
    ctx.lineWidth = Math.max(3, r * 0.1)
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, TAU)
    ctx.stroke()
    // Sparkles round the ring.
    ctx.fillStyle = '#f7e5c0'
    for (let n = 0; n < 8; n++) {
      const a = (n / 8) * TAU + now * 0.0015
      const d = r * 1.28
      const sx = c.x + Math.cos(a) * d
      const sy = c.y + Math.sin(a) * d
      const s = Math.max(3, r * 0.1)
      ctx.beginPath()
      ctx.moveTo(sx, sy - s)
      ctx.lineTo(sx + s * 0.3, sy - s * 0.3)
      ctx.lineTo(sx + s, sy)
      ctx.lineTo(sx + s * 0.3, sy + s * 0.3)
      ctx.lineTo(sx, sy + s)
      ctx.lineTo(sx - s * 0.3, sy + s * 0.3)
      ctx.lineTo(sx - s, sy)
      ctx.lineTo(sx - s * 0.3, sy - s * 0.3)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  for (const m of o.misses) {
    const c = worldToScreen(m.x, m.y, cam, field)
    const fade = 1 - m.age
    const s = 11 + m.age * 6
    ctx.save()
    ctx.globalAlpha = Math.max(0, fade)
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(c.x - s, c.y - s)
    ctx.lineTo(c.x + s, c.y + s)
    ctx.moveTo(c.x + s, c.y - s)
    ctx.lineTo(c.x - s, c.y + s)
    ctx.stroke()
    ctx.strokeStyle = '#e24139'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.restore()
  }

  if (o.dim > 0) {
    ctx.fillStyle = `rgba(14, 16, 18, ${Math.min(0.6, o.dim)})`
    ctx.fillRect(field.x, field.y, field.w, field.h)
  }

  if (o.reticle) {
    const c = worldToScreen(o.reticle.x, o.reticle.y, cam, field)
    const r = Math.max(14, scene.unit * 0.55 * k)
    ctx.save()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, TAU)
    ctx.stroke()
    ctx.strokeStyle = '#3dc8cf'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.beginPath()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      ctx.moveTo(c.x + dx * r * 0.45, c.y + dy * r * 0.45)
      ctx.lineTo(c.x + dx * r * 1.35, c.y + dy * r * 1.35)
    }
    ctx.stroke()
    ctx.restore()
  }
}

// ------------------------------------------------------------------ layers

/** One pass of a 3×3 box blur, in place. Only ever run on a thumbnail. */
function boxBlur(px: Uint8ClampedArray, w: number, h: number) {
  const src = new Uint8ClampedArray(px)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= h) continue
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            if (xx < 0 || xx >= w) continue
            sum += src[(yy * w + xx) * 4 + c]
            n++
          }
        }
        px[(y * w + x) * 4 + c] = sum / n
      }
    }
  }
}

/**
 * A painted picture of the scene: the whole of it at the field's size (the
 * base), or the part in view at the current zoom (a detail).
 */
type Layer = {
  canvas: HTMLCanvasElement
  scene: Scene
  w: number
  h: number
  /** The view a detail was painted for; null for the base. */
  cam: Camera | null
  /** Painted at dusk (the dark theme): a theme switch repaints the scene. */
  dusk: boolean
}

type Job = Layer & { steps: Steps; ctx: CanvasRenderingContext2D }

/** The frost behind the cards is painted per scene, at the size and in the theme of the scene's base. */
type FrostSpec = { scene: Scene; w: number; h: number; dusk: boolean }

function frostLook(f: FrostSpec): string {
  return `${f.w}x${f.h}:${f.dusk ? 'dusk' : 'day'}`
}

/**
 * A canvas to paint a layer into. Software backed on purpose: a scene is
 * thousands of small paths, which the CPU rasteriser gets through about twice
 * as fast as the GPU one — and it paints as it goes, so spreading the work
 * over frames really does spread it, rather than piling it all up for one
 * flush at the end.
 */
function layerCanvas(w: number, h: number, reuse?: HTMLCanvasElement) {
  const canvas = reuse ?? document.createElement('canvas')
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return { canvas, ctx }
}

/**
 * Holds the painted layers for one scene and puts them on screen.
 *
 * Painting happens a slice at a time inside `frame`, within the budget it is
 * given, so a new scene or a sharp repaint after a zoom never stalls a frame.
 * The base must be complete before a scene is shown at all — `ready` says
 * when — so nobody ever searches a picture that is still arriving.
 */
export class SceneView {
  private base: Layer | null = null
  private baseJob: Job | null = null
  private detail: Layer | null = null
  private detailJob: Job | null = null
  /** The canvas the last detail was painted into, kept to paint the next one. */
  private spare: HTMLCanvasElement | null = null
  private frost = document.createElement('canvas')
  private frostFor: Scene | null = null
  private frostDone = ''
  /** What the frost should be painted for: the scene, and the size and theme of its base. */
  private frostWant: FrostSpec | null = null
  private lastCam: Camera | null = null
  private stillSince = 0

  /** Whether a complete painting of this scene exists to show. */
  ready(scene: Scene): boolean {
    return this.base?.scene === scene
  }

  private ensureBase(scene: Scene, field: Field, dpr: number) {
    const w = Math.max(1, Math.round(field.w * dpr))
    const h = Math.max(1, Math.round(field.h * dpr))
    const dusk = atDusk(scene)
    this.frostWant = { scene, w, h, dusk }
    const b = this.base
    if (b && b.scene === scene && b.w === w && b.h === h && b.dusk === dusk) return
    const j = this.baseJob
    if (j && j.scene === scene && j.w === w && j.h === h && j.dusk === dusk) return
    // A different scene: drop everything painted for the last one. The same
    // scene at a new size, or in the other theme, keeps its old base on screen
    // until the new one is done; a detail in the old theme is no use to anyone.
    if (b && b.scene !== scene) this.base = null
    if (this.detail && (this.detail.scene !== scene || this.detail.dusk !== dusk)) this.detail = null
    if (this.detailJob && (this.detailJob.scene !== scene || this.detailJob.dusk !== dusk)) this.detailJob = null
    const { canvas, ctx } = layerCanvas(w, h)
    if (!ctx) return
    ctx.setTransform(w / scene.w, 0, 0, h / scene.h, 0, 0)
    this.baseJob = { canvas, ctx, scene, w, h, cam: null, dusk, steps: paintSteps(ctx, scene) }
  }

  private startDetail(scene: Scene, field: Field, cam: Camera, dpr: number) {
    const w = Math.max(1, Math.round(field.w * dpr))
    const h = Math.max(1, Math.round(field.h * dpr))
    const reuse = this.detailJob?.canvas ?? this.spare ?? undefined
    this.spare = null
    const { canvas, ctx } = layerCanvas(w, h, reuse)
    if (!ctx) return
    const k = pxPerUnit(cam, field) * dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.setTransform(k, 0, 0, k, w / 2 - cam.cx * k, h / 2 - cam.cy * k)
    this.detailJob = {
      canvas,
      ctx,
      scene,
      w,
      h,
      cam: { ...cam },
      dusk: atDusk(scene),
      steps: paintSteps(ctx, scene, viewRect(cam, field)),
    }
  }

  /**
   * Paint for up to `budgetMs`: the base first, then any detail.
   *
   * The canvas only records what it is told until something reads it back, and
   * then rasterises the lot at once — so each step is followed by a one-pixel
   * read, which makes the step pay for itself inside the budget instead of the
   * whole layer landing on whichever frame first shows it.
   */
  private pump(budgetMs: number) {
    const start = performance.now()
    while (performance.now() - start < budgetMs) {
      // The frost goes first, as a piece of work of its own: it is quick, and
      // it is what shows behind the scene card while the rest is painted.
      const want = this.frostWant
      if (want && (want.scene !== this.frostFor || frostLook(want) !== this.frostDone)) {
        this.paintFrost(want)
        continue
      }
      const job = this.baseJob ?? this.detailJob
      if (!job) return
      const done = job.steps.next().done
      job.ctx.getImageData(0, 0, 1, 1)
      if (!done) continue
      if (job === this.baseJob) {
        this.base = job
        this.baseJob = null
        return
      } else {
        if (this.detail) this.spare = this.detail.canvas
        this.detail = job
        this.detailJob = null
      }
    }
  }

  /**
   * Frosted glass for behind the cards: the place with nobody in it, painted
   * at an eighth of the size, blurred, and stretched back out. It is plainly
   * the next place, and there is nobody in it to find.
   *
   * It used to be the scene itself, blurred. The cards stop the clock, and
   * the pause does, so a player could sit behind one for as long as they
   * liked picking the wanted bug's colours out of the blur.
   */
  private paintFrost(want: FrostSpec) {
    const w = Math.max(1, Math.round(want.w / 8))
    const h = Math.max(1, Math.round(want.h / 8))
    this.frost.width = w
    this.frost.height = h
    const f = this.frost.getContext('2d', { willReadFrequently: true })
    if (!f) return
    f.setTransform(w / want.scene.w, 0, 0, h / want.scene.h, 0, 0)
    const steps = paintSteps(f, want.scene, undefined, false)
    while (!steps.next().done) {
      /* all of it: at this size it is quick */
    }
    f.setTransform(1, 0, 0, 1, 0, 0)
    const img = f.getImageData(0, 0, w, h)
    for (let pass = 0; pass < 3; pass++) boxBlur(img.data, w, h)
    f.putImageData(img, 0, 0)
    this.frostFor = want.scene
    this.frostDone = frostLook(want)
  }

  /**
   * Draw one frame, after spending up to `budgetMs` on painting. `moving`
   * holds back the sharp repaint while a finger or the wheel is still
   * changing the view.
   */
  frame(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    scene: Scene | null,
    field: Field | null,
    cam: Camera,
    dpr: number,
    overlays: Overlays,
    moving: boolean,
    now: number,
    budgetMs: number,
  ) {
    ctx.fillStyle = playfieldColor()
    ctx.fillRect(0, 0, canvasW, canvasH)
    if (!scene || !field) return

    this.ensureBase(scene, field, dpr)

    if (!sameCamera(cam, this.lastCam, 0.001)) {
      this.lastCam = { ...cam }
      this.stillSince = now
    }
    const zoomed = cam.zoom > 1.001
    const settled = !moving && now - this.stillSince > 110
    if (zoomed && settled && this.ready(scene)) {
      const want = !sameCamera(cam, this.detail?.cam ?? null) && !sameCamera(cam, this.detailJob?.cam ?? null)
      if (want) this.startDetail(scene, field, cam, dpr)
    } else if (!zoomed && this.detailJob) {
      this.spare = this.detailJob.canvas
      this.detailJob = null
    }

    this.pump(budgetMs)

    ctx.save()
    ctx.beginPath()
    ctx.roundRect(field.x, field.y, field.w, field.h, field.x > 1 ? 10 : 0)
    ctx.clip()
    ctx.fillStyle = edgeColour(scene)
    ctx.fillRect(field.x, field.y, field.w, field.h)

    const base = this.base && this.base.scene === scene ? this.base : null
    if (overlays.cover || !base) {
      if (this.frostFor === scene) {
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(this.frost, field.x, field.y, field.w, field.h)
      }
      ctx.fillStyle = 'rgba(18, 20, 22, 0.35)'
      ctx.fillRect(field.x, field.y, field.w, field.h)
      ctx.restore()
      return
    }

    ctx.imageSmoothingEnabled = true
    if (!zoomed) {
      ctx.drawImage(base.canvas, field.x, field.y, field.w, field.h)
    } else {
      const k = pxPerUnit(cam, field)
      const origin = worldToScreen(0, 0, cam, field)
      ctx.drawImage(base.canvas, origin.x, origin.y, scene.w * k, scene.h * k)
      const d = this.detail
      if (d && d.scene === scene && d.cam && Math.abs(d.cam.zoom - cam.zoom) < 0.001) {
        const dk = pxPerUnit(d.cam, field)
        const view = viewRect(d.cam, field)
        const at = worldToScreen(view.x0, view.y0, cam, field)
        const scale = k / dk
        ctx.drawImage(d.canvas, at.x, at.y, field.w * scale, field.h * scale)
      }
    }

    paintOverlays(ctx, scene, cam, field, overlays, now)
    ctx.restore()
  }
}
