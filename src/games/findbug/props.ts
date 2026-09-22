/**
 * Scenery: the things the crowd stands among, climbs on and hides behind.
 *
 * Drawn in the same ink and the same shading as the critters, so a scene reads
 * as one illustration. Each prop is authored in its own units — `s` is how big
 * it is in the world, the base of it sits on (x, y) — and stands in the same
 * back-to-front order as the crowd, so a critter behind a cupcake is hidden by
 * it and one in front covers it.
 */

import { mixColor } from '../../lib/color'
import { INK, RED, WHITE } from './critters'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const TAU = Math.PI * 2
/** Outline weight in world units at a prop's own scale is too thin on big props; keep it fixed. */
export const PROP_INK = 1.5

export type PropKind =
  | 'watermelon'
  | 'sandwich'
  | 'cupcake'
  | 'cheese'
  | 'strawberry'
  | 'teacup'
  | 'juicebox'
  | 'grapes'
  | 'basket'
  | 'anthill'
  | 'daisy'
  | 'tulip'
  | 'sunflower'
  | 'dandelion'
  | 'toadstool'
  | 'pebble'
  | 'tuft'
  | 'reeds'
  | 'lilypad'
  | 'sandcastle'
  | 'bucket'
  | 'umbrella'
  | 'lifeguard'
  | 'boat'
  | 'cabinet'
  | 'claw'
  | 'counter'
  | 'changer'
  | 'neon'
  | 'stall'
  | 'tent'
  | 'lamp'
  | 'campfire'
  | 'wateringcan'
  | 'flowerpot'
  | 'fence'
  | 'sign'
  | 'bench'
  | 'log'

export type Prop = {
  kind: PropKind
  x: number
  y: number
  /** Nominal size in world units — usually the width. */
  s: number
  colour: string
  colour2: string
  variant: number
  flip: boolean
  /** Draw order; the base line unless something says otherwise. */
  z: number
}

// ------------------------------------------------------------------ helpers

function ep(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU)
}

function inked(ctx: Ctx, fill: string, w = PROP_INK) {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = w
  ctx.strokeStyle = INK
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
}

function stroke(ctx: Ctx, colour: string, w: number) {
  ctx.strokeStyle = colour
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

const shadeCache = new Map<string, string>()
function shade(colour: string, t = 0.28): string {
  const key = `${colour}|${t}`
  let hit = shadeCache.get(key)
  if (!hit) {
    hit = mixColor(colour, '#291b4a', t)
    shadeCache.set(key, hit)
  }
  return hit
}

const lightCache = new Map<string, string>()
function light(colour: string, t = 0.35): string {
  const key = `${colour}|${t}`
  let hit = lightCache.get(key)
  if (!hit) {
    hit = mixColor(colour, '#ffffff', t)
    lightCache.set(key, hit)
  }
  return hit
}

function shine(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = -0.5, alpha = 0.5) {
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
  ep(ctx, x, y, rx, ry, rot)
  ctx.fill()
}

/** A soft contact shadow for anything standing on the ground. */
function contact(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.2) {
  ctx.fillStyle = `rgba(22, 26, 28, ${alpha})`
  ep(ctx, x, y, rx, ry)
  ctx.fill()
}

// ------------------------------------------------------------------ picnic

function watermelon(ctx: Ctx, p: Prop) {
  const r = p.s / 2
  const cy = -r * 0.9
  contact(ctx, 0, 0, r * 0.9, r * 0.14)
  // Standing on its rind, cut face towards us.
  ctx.beginPath()
  ctx.arc(0, cy, r, 0, Math.PI)
  ctx.closePath()
  inked(ctx, '#409c73')
  ctx.beginPath()
  ctx.arc(0, cy, r * 0.9, 0, Math.PI)
  ctx.closePath()
  ctx.fillStyle = '#baf0d8'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, cy, r * 0.8, 0, Math.PI)
  ctx.closePath()
  ctx.fillStyle = '#ea5a53'
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(165, 21, 84, 0.18)'
  ep(ctx, r * 0.25, cy + r * 0.6, r * 0.8, r * 0.5)
  ctx.fill()
  ctx.restore()
  // Rind stripes.
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, cy, r, 0, Math.PI)
  ctx.arc(0, cy, r * 0.9, Math.PI, 0, true)
  ctx.closePath()
  ctx.clip()
  ctx.strokeStyle = '#2f7f5b'
  ctx.lineWidth = r * 0.05
  for (let k = 0; k < 9; k++) {
    const a = (k / 8) * Math.PI
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85)
    ctx.lineTo(Math.cos(a + 0.08) * r * 1.05, cy + Math.sin(a + 0.08) * r * 1.05)
    ctx.stroke()
  }
  ctx.restore()
  // The top of the slice, seen a little from above.
  ep(ctx, 0, cy, r, r * 0.09)
  inked(ctx, '#ee7c77')
  // Seeds.
  ctx.fillStyle = '#332028'
  const seeds: [number, number][] = [
    [-0.45, 0.25], [-0.15, 0.32], [0.18, 0.3], [0.46, 0.22], [-0.28, 0.52], [0.05, 0.56], [0.32, 0.48], [-0.05, 0.14],
  ]
  for (const [sx, sy] of seeds) {
    ep(ctx, sx * r, cy + sy * r, r * 0.028, r * 0.05, sx * 0.8)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, cy, r, 0, Math.PI)
  ctx.closePath()
  ctx.lineWidth = PROP_INK
  ctx.strokeStyle = INK
  ctx.stroke()
}

function sandwich(ctx: Ctx, p: Prop) {
  const w = p.s
  const h = w * 0.5
  contact(ctx, 0, 0, w * 0.52, w * 0.07)
  const layer = (y: number, hh: number, colour: string, wave = 0) => {
    ctx.beginPath()
    if (wave) {
      ctx.moveTo(-w * 0.52, y)
      for (let k = 0; k <= 10; k++) {
        const x = -w * 0.52 + (w * 1.04 * k) / 10
        ctx.lineTo(x, y - hh + (k % 2 ? wave : -wave))
      }
      ctx.lineTo(w * 0.52, y)
      ctx.closePath()
    } else {
      ctx.roundRect(-w * 0.5, y - hh, w, hh, hh * 0.35)
    }
    inked(ctx, colour)
  }
  layer(0, h * 0.24, '#e5bb66')
  layer(-h * 0.2, h * 0.14, '#49c08b', h * 0.05)
  layer(-h * 0.33, h * 0.12, '#e84c45')
  // Cheese with its corners hanging over.
  ctx.beginPath()
  ctx.moveTo(-w * 0.55, -h * 0.42)
  ctx.lineTo(w * 0.55, -h * 0.42)
  ctx.lineTo(w * 0.5, -h * 0.3)
  ctx.lineTo(w * 0.36, -h * 0.46)
  ctx.lineTo(-w * 0.4, -h * 0.46)
  ctx.lineTo(-w * 0.5, -h * 0.28)
  ctx.closePath()
  inked(ctx, '#e9b54d')
  // Top slice, domed, with a crust.
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, -h * 0.46)
  ctx.quadraticCurveTo(-w * 0.52, -h * 1.02, 0, -h * 1.0)
  ctx.quadraticCurveTo(w * 0.52, -h * 1.02, w * 0.5, -h * 0.46)
  ctx.closePath()
  inked(ctx, '#c9713a')
  ctx.beginPath()
  ctx.moveTo(-w * 0.44, -h * 0.5)
  ctx.quadraticCurveTo(-w * 0.44, -h * 0.9, 0, -h * 0.9)
  ctx.quadraticCurveTo(w * 0.44, -h * 0.9, w * 0.44, -h * 0.5)
  ctx.closePath()
  ctx.fillStyle = '#efca81'
  ctx.fill()
  ctx.fillStyle = 'rgba(155, 79, 31, 0.35)'
  for (const [sx, sy] of [[-0.2, -0.7], [0.1, -0.78], [0.25, -0.62], [-0.05, -0.6]] as const) {
    ep(ctx, sx * w, sy * h, w * 0.015, w * 0.01, 0.4)
    ctx.fill()
  }
  // A cocktail stick with a flag holding it together.
  ctx.beginPath()
  ctx.moveTo(w * 0.08, -h * 0.6)
  ctx.lineTo(w * 0.08, -h * 1.45)
  stroke(ctx, '#b89651', w * 0.022)
  ctx.beginPath()
  ctx.moveTo(w * 0.08, -h * 1.45)
  ctx.lineTo(w * 0.28, -h * 1.33)
  ctx.lineTo(w * 0.08, -h * 1.2)
  ctx.closePath()
  inked(ctx, p.colour)
}

function cupcake(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.45, w * 0.08)
  // Paper case with pleats.
  ctx.beginPath()
  ctx.moveTo(-w * 0.4, -w * 0.5)
  ctx.lineTo(w * 0.4, -w * 0.5)
  ctx.lineTo(w * 0.3, 0)
  ctx.lineTo(-w * 0.3, 0)
  ctx.closePath()
  inked(ctx, p.colour2)
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = shade(p.colour2, 0.25)
  ctx.lineWidth = w * 0.03
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath()
    ctx.moveTo(k * w * 0.11, -w * 0.5)
    ctx.lineTo(k * w * 0.085, 0)
    ctx.stroke()
  }
  ctx.restore()
  // Icing in three swirls, then a cherry.
  const icing = p.colour
  const swirl = (y: number, rx: number, ry: number) => {
    ep(ctx, 0, y, rx, ry)
    inked(ctx, icing)
    ctx.save()
    ep(ctx, 0, y, rx, ry)
    ctx.clip()
    ctx.fillStyle = 'rgba(39, 24, 73, 0.16)'
    ep(ctx, rx * 0.3, y + ry * 0.5, rx, ry * 0.7)
    ctx.fill()
    ctx.restore()
    ep(ctx, 0, y, rx, ry)
    ctx.lineWidth = PROP_INK
    ctx.strokeStyle = INK
    ctx.stroke()
  }
  swirl(-w * 0.55, w * 0.46, w * 0.15)
  swirl(-w * 0.72, w * 0.34, w * 0.13)
  swirl(-w * 0.86, w * 0.2, w * 0.1)
  shine(ctx, -w * 0.2, -w * 0.62, w * 0.1, w * 0.035, -0.2, 0.6)
  // Sprinkles.
  const sprinkles = ['#3d99d8', '#e6ac39', '#54bf8f', '#ffffff']
  for (let k = 0; k < 9; k++) {
    const a = k * 2.2
    ctx.beginPath()
    const sx = Math.cos(a) * w * (0.12 + (k % 3) * 0.1)
    const sy = -w * (0.58 + (k % 3) * 0.12) + Math.sin(a) * w * 0.03
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + w * 0.035, sy + w * 0.01)
    stroke(ctx, sprinkles[k % sprinkles.length], w * 0.022)
  }
  ep(ctx, w * 0.02, -w * 1.02, w * 0.09, w * 0.09)
  inked(ctx, RED)
  shine(ctx, -w * 0.01, -w * 1.05, w * 0.03, w * 0.02)
  ctx.beginPath()
  ctx.moveTo(w * 0.04, -w * 1.1)
  ctx.quadraticCurveTo(w * 0.08, -w * 1.25, w * 0.2, -w * 1.28)
  stroke(ctx, '#2c7f5a', w * 0.025)
}

function cheese(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.52, w * 0.07)
  // Front face, then the sloping top.
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, 0)
  ctx.lineTo(w * 0.5, 0)
  ctx.lineTo(w * 0.5, -w * 0.3)
  ctx.lineTo(-w * 0.5, -w * 0.3)
  ctx.closePath()
  inked(ctx, '#e8b041')
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, -w * 0.3)
  ctx.lineTo(w * 0.5, -w * 0.3)
  ctx.lineTo(w * 0.2, -w * 0.52)
  ctx.closePath()
  inked(ctx, '#edc370')
  ctx.fillStyle = '#d99d26'
  const holes: [number, number, number][] = [
    [-0.3, -0.16, 0.07], [0.02, -0.1, 0.05], [0.3, -0.18, 0.08], [-0.08, -0.22, 0.035], [0.18, -0.36, 0.05],
  ]
  for (const [hx, hy, hr] of holes) {
    ep(ctx, hx * w, hy * w, hr * w, hr * w * 0.8)
    ctx.fill()
    ctx.lineWidth = PROP_INK * 0.7
    ctx.strokeStyle = 'rgba(44, 37, 58, 0.45)'
    ctx.stroke()
  }
}

function strawberry(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.35, w * 0.07)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-w * 0.55, -w * 0.3, -w * 0.5, -w * 0.9, 0, -w * 0.82)
  ctx.bezierCurveTo(w * 0.5, -w * 0.9, w * 0.55, -w * 0.3, 0, 0)
  ctx.closePath()
  inked(ctx, '#e7463e')
  ctx.fillStyle = '#efca80'
  for (let k = 0; k < 12; k++) {
    const sx = ((k * 37) % 7) / 7 - 0.45
    const sy = -0.2 - ((k * 53) % 9) / 14
    ep(ctx, sx * w * 0.7, sy * w, w * 0.02, w * 0.03)
    ctx.fill()
  }
  shine(ctx, -w * 0.18, -w * 0.6, w * 0.07, w * 0.12, 0.3, 0.45)
  ctx.beginPath()
  for (let k = 0; k < 5; k++) {
    const a = Math.PI + (k / 4) * Math.PI
    ctx.moveTo(0, -w * 0.82)
    ctx.quadraticCurveTo(Math.cos(a) * w * 0.12, -w * 0.84 + Math.sin(a) * w * 0.05, Math.cos(a) * w * 0.26, -w * 0.8 + Math.sin(a) * w * 0.08)
  }
  stroke(ctx, INK, w * 0.08)
  ctx.beginPath()
  for (let k = 0; k < 5; k++) {
    const a = Math.PI + (k / 4) * Math.PI
    ctx.moveTo(0, -w * 0.82)
    ctx.quadraticCurveTo(Math.cos(a) * w * 0.12, -w * 0.84 + Math.sin(a) * w * 0.05, Math.cos(a) * w * 0.26, -w * 0.8 + Math.sin(a) * w * 0.08)
  }
  stroke(ctx, '#3faf7d', w * 0.05)
}

function teacup(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.55, w * 0.08)
  ep(ctx, 0, -w * 0.04, w * 0.55, w * 0.1)
  inked(ctx, WHITE)
  ctx.beginPath()
  ctx.moveTo(w * 0.34, -w * 0.46)
  ctx.bezierCurveTo(w * 0.62, -w * 0.5, w * 0.62, -w * 0.16, w * 0.3, -w * 0.18)
  stroke(ctx, INK, w * 0.1)
  ctx.beginPath()
  ctx.moveTo(w * 0.34, -w * 0.46)
  ctx.bezierCurveTo(w * 0.62, -w * 0.5, w * 0.62, -w * 0.16, w * 0.3, -w * 0.18)
  stroke(ctx, WHITE, w * 0.06)
  ctx.beginPath()
  ctx.moveTo(-w * 0.4, -w * 0.52)
  ctx.lineTo(w * 0.4, -w * 0.52)
  ctx.quadraticCurveTo(w * 0.36, -w * 0.08, 0, -w * 0.08)
  ctx.quadraticCurveTo(-w * 0.36, -w * 0.08, -w * 0.4, -w * 0.52)
  ctx.closePath()
  inked(ctx, WHITE)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = p.colour
  ctx.fillRect(-w * 0.5, -w * 0.4, w, w * 0.08)
  for (let k = -2; k <= 2; k++) {
    ep(ctx, k * w * 0.16, -w * 0.25, w * 0.04, w * 0.04)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(39, 24, 73, 0.14)'
  ep(ctx, w * 0.3, -w * 0.2, w * 0.3, w * 0.35)
  ctx.fill()
  ctx.restore()
  ep(ctx, 0, -w * 0.52, w * 0.4, w * 0.07)
  inked(ctx, '#a86438')
  ctx.beginPath()
  ctx.moveTo(-w * 0.08, -w * 0.64)
  ctx.bezierCurveTo(-w * 0.18, -w * 0.78, w * 0.02, -w * 0.84, -w * 0.08, -w * 1.0)
  ctx.moveTo(w * 0.12, -w * 0.62)
  ctx.bezierCurveTo(w * 0.02, -w * 0.76, w * 0.22, -w * 0.82, w * 0.12, -w * 0.96)
  stroke(ctx, 'rgba(255, 255, 255, 0.75)', w * 0.035)
}

function juicebox(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.4, w * 0.07)
  ctx.beginPath()
  ctx.roundRect(-w * 0.32, -w * 0.95, w * 0.64, w * 0.95, w * 0.05)
  inked(ctx, p.colour)
  ctx.fillStyle = shade(p.colour, 0.18)
  ctx.fillRect(w * 0.14, -w * 0.94, w * 0.17, w * 0.93)
  ctx.beginPath()
  ctx.roundRect(-w * 0.32, -w * 0.95, w * 0.64, w * 0.95, w * 0.05)
  ctx.lineWidth = PROP_INK
  ctx.strokeStyle = INK
  ctx.stroke()
  ep(ctx, -w * 0.04, -w * 0.48, w * 0.2, w * 0.2)
  inked(ctx, WHITE)
  ep(ctx, -w * 0.04, -w * 0.48, w * 0.12, w * 0.12)
  inked(ctx, p.colour2)
  shine(ctx, -w * 0.08, -w * 0.52, w * 0.04, w * 0.03)
  ctx.beginPath()
  ctx.moveTo(w * 0.12, -w * 0.95)
  ctx.lineTo(w * 0.12, -w * 1.2)
  ctx.lineTo(w * 0.28, -w * 1.34)
  stroke(ctx, INK, w * 0.08)
  ctx.beginPath()
  ctx.moveTo(w * 0.12, -w * 0.95)
  ctx.lineTo(w * 0.12, -w * 1.2)
  ctx.lineTo(w * 0.28, -w * 1.34)
  stroke(ctx, '#f2eadb', w * 0.045)
}

function grapes(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.35, w * 0.07)
  const rows = [4, 3, 3, 2, 1]
  const r = w * 0.12
  for (let row = rows.length - 1; row >= 0; row--) {
    const n = rows[row]
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * r * 1.7
      const y = -r - (rows.length - 1 - row) * r * 1.45
      ep(ctx, x, y, r, r)
      inked(ctx, p.colour)
      shine(ctx, x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.16, -0.6, 0.45)
    }
  }
  ctx.beginPath()
  ctx.moveTo(0, -r * 1.8 - 4 * r * 1.45)
  ctx.quadraticCurveTo(w * 0.05, -w * 1.02, w * 0.12, -w * 1.08)
  stroke(ctx, '#70472c', w * 0.04)
  ctx.beginPath()
  ctx.moveTo(w * 0.04, -w * 0.94)
  ctx.quadraticCurveTo(w * 0.3, -w * 1.1, w * 0.38, -w * 0.88)
  ctx.quadraticCurveTo(w * 0.2, -w * 0.84, w * 0.04, -w * 0.94)
  inked(ctx, '#49b283')
}

function basket(ctx: Ctx, p: Prop) {
  const w = p.s
  const h = w * 0.62
  contact(ctx, 0, 0, w * 0.56, w * 0.09)
  // Handle behind the lid.
  ctx.beginPath()
  ctx.arc(0, -h * 0.9, w * 0.34, Math.PI * 1.05, Math.PI * 1.95)
  stroke(ctx, INK, w * 0.07)
  ctx.beginPath()
  ctx.arc(0, -h * 0.9, w * 0.34, Math.PI * 1.05, Math.PI * 1.95)
  stroke(ctx, '#c99e49', w * 0.045)
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, -h * 0.9)
  ctx.lineTo(w * 0.5, -h * 0.9)
  ctx.lineTo(w * 0.42, 0)
  ctx.lineTo(-w * 0.42, 0)
  ctx.closePath()
  inked(ctx, '#d8ad58')
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = '#b18938'
  ctx.lineWidth = w * 0.025
  for (let row = 0; row < 6; row++) {
    const y = -h * 0.9 + (row + 0.5) * (h * 0.9 / 6)
    for (let k = -6; k <= 6; k++) {
      const x = k * w * 0.09 + (row % 2) * w * 0.045
      ctx.beginPath()
      ctx.moveTo(x - w * 0.03, y - h * 0.05)
      ctx.lineTo(x + w * 0.03, y + h * 0.05)
      ctx.stroke()
    }
  }
  ctx.restore()
  // A checked cloth poking out of the lid.
  ctx.beginPath()
  ctx.moveTo(-w * 0.3, -h * 0.9)
  ctx.quadraticCurveTo(-w * 0.18, -h * 1.2, 0, -h * 1.05)
  ctx.quadraticCurveTo(w * 0.1, -h * 1.22, w * 0.28, -h * 0.9)
  ctx.closePath()
  inked(ctx, WHITE)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(226, 65, 57, 0.75)'
  for (let k = -4; k <= 4; k++) ctx.fillRect(k * w * 0.08, -h * 1.3, w * 0.04, h * 0.5)
  ctx.restore()
  ctx.beginPath()
  ctx.roundRect(-w * 0.53, -h * 0.98, w * 1.06, h * 0.14, h * 0.05)
  inked(ctx, '#c99e49')
}

function anthill(ctx: Ctx, p: Prop) {
  const w = p.s
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, 0)
  ctx.quadraticCurveTo(-w * 0.28, -w * 0.4, -w * 0.08, -w * 0.4)
  ctx.lineTo(w * 0.08, -w * 0.4)
  ctx.quadraticCurveTo(w * 0.28, -w * 0.4, w * 0.5, 0)
  ctx.closePath()
  inked(ctx, '#b07048')
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(84, 50, 28, 0.28)'
  for (let k = 0; k < 26; k++) {
    const x = (((k * 71) % 97) / 97 - 0.5) * w * 0.9
    const y = -(((k * 53) % 89) / 89) * w * 0.38
    ep(ctx, x, y, w * 0.012, w * 0.008)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(39, 24, 73, 0.18)'
  ep(ctx, w * 0.22, -w * 0.05, w * 0.3, w * 0.22)
  ctx.fill()
  ctx.restore()
  ep(ctx, 0, -w * 0.4, w * 0.1, w * 0.035)
  ctx.fillStyle = '#352114'
  ctx.fill()
}

// ------------------------------------------------------------------ flowers

function stem(ctx: Ctx, h: number, lean: number, w: number, colour = '#3da074') {
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(lean * 0.2, -h * 0.5, lean, -h)
  stroke(ctx, INK, w + PROP_INK * 1.6)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(lean * 0.2, -h * 0.5, lean, -h)
  stroke(ctx, colour, w)
}

function leafAt(ctx: Ctx, x: number, y: number, len: number, angle: number, colour = '#45b382') {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.5, -len * 0.3, len, 0)
  ctx.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0)
  ctx.closePath()
  inked(ctx, colour)
  ctx.beginPath()
  ctx.moveTo(len * 0.1, 0)
  ctx.lineTo(len * 0.8, 0)
  stroke(ctx, 'rgba(26, 77, 54, 0.4)', PROP_INK * 0.7)
  ctx.restore()
}

function daisy(ctx: Ctx, p: Prop) {
  const h = p.s
  const lean = h * 0.08
  contact(ctx, 0, 0, h * 0.12, h * 0.03)
  stem(ctx, h * 0.78, lean, h * 0.04)
  leafAt(ctx, lean * 0.1, -h * 0.25, h * 0.22, -0.5)
  leafAt(ctx, lean * 0.15, -h * 0.4, h * 0.2, Math.PI + 0.5)
  const cx = lean
  const cy = -h * 0.8
  const pr = h * 0.2
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU
    ep(ctx, cx + Math.cos(a) * pr * 0.62, cy + Math.sin(a) * pr * 0.62, pr * 0.42, pr * 0.2, a)
    inked(ctx, p.colour)
  }
  ep(ctx, cx, cy, pr * 0.38, pr * 0.38)
  inked(ctx, p.colour2)
  shine(ctx, cx - pr * 0.12, cy - pr * 0.14, pr * 0.12, pr * 0.08)
}

function tulip(ctx: Ctx, p: Prop) {
  const h = p.s
  const lean = h * 0.06
  contact(ctx, 0, 0, h * 0.1, h * 0.03)
  stem(ctx, h * 0.72, lean, h * 0.045)
  leafAt(ctx, 0, -h * 0.12, h * 0.4, -1.2, '#45b382')
  leafAt(ctx, 0, -h * 0.1, h * 0.36, Math.PI + 1.25, '#3ba575')
  const cx = lean
  const cy = -h * 0.8
  const r = h * 0.15
  ctx.beginPath()
  ctx.moveTo(cx - r, cy - r * 0.8)
  ctx.lineTo(cx - r * 0.5, cy - r * 0.2)
  ctx.lineTo(cx, cy - r * 1.1)
  ctx.lineTo(cx + r * 0.5, cy - r * 0.2)
  ctx.lineTo(cx + r, cy - r * 0.8)
  ctx.quadraticCurveTo(cx + r * 1.05, cy + r * 0.9, cx, cy + r * 0.9)
  ctx.quadraticCurveTo(cx - r * 1.05, cy + r * 0.9, cx - r, cy - r * 0.8)
  ctx.closePath()
  inked(ctx, p.colour)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(39, 24, 73, 0.18)'
  ep(ctx, cx + r * 0.5, cy + r * 0.4, r * 0.7, r)
  ctx.fill()
  ctx.restore()
  shine(ctx, cx - r * 0.45, cy - r * 0.1, r * 0.14, r * 0.3, 0.1)
}

function sunflower(ctx: Ctx, p: Prop) {
  const h = p.s
  const lean = h * 0.05
  contact(ctx, 0, 0, h * 0.1, h * 0.03)
  stem(ctx, h * 0.72, lean, h * 0.05)
  leafAt(ctx, lean * 0.1, -h * 0.3, h * 0.28, -0.35, '#3ba575')
  leafAt(ctx, lean * 0.2, -h * 0.48, h * 0.26, Math.PI + 0.4, '#45b382')
  const cx = lean
  const cy = -h * 0.78
  const pr = h * 0.22
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU
    ep(ctx, cx + Math.cos(a) * pr * 0.72, cy + Math.sin(a) * pr * 0.72, pr * 0.36, pr * 0.14, a)
    inked(ctx, '#e7ae3e')
  }
  ep(ctx, cx, cy, pr * 0.5, pr * 0.5)
  inked(ctx, '#7c4929')
  ctx.fillStyle = '#53311c'
  for (let k = 0; k < 16; k++) {
    const a = k * 2.39996
    const d = Math.sqrt((k + 0.5) / 16) * pr * 0.42
    ep(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, pr * 0.04, pr * 0.04)
    ctx.fill()
  }
}

function dandelion(ctx: Ctx, p: Prop) {
  const h = p.s
  const lean = h * 0.1
  stem(ctx, h * 0.72, lean, h * 0.03, '#45af7f')
  const cx = lean
  const cy = -h * 0.78
  const r = h * 0.17
  if (p.variant % 2 === 0) {
    // Gone to seed: a white clock of fluff.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = h * 0.012
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      ctx.stroke()
      ep(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, h * 0.022, h * 0.022)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.fill()
    }
    ep(ctx, cx, cy, r * 1.08, r * 1.08)
    ctx.lineWidth = PROP_INK * 0.6
    ctx.strokeStyle = 'rgba(44, 37, 58, 0.35)'
    ctx.stroke()
  } else {
    for (let ring = 0; ring < 2; ring++) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU + ring * 0.26
        const d = r * (ring ? 0.45 : 0.72)
        ep(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.3, r * 0.11, a)
        inked(ctx, ring ? '#eaba59' : '#e7ae3e', PROP_INK * 0.7)
      }
    }
  }
}

function toadstool(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.3, w * 0.06)
  ctx.beginPath()
  ctx.moveTo(-w * 0.14, 0)
  ctx.quadraticCurveTo(-w * 0.18, -w * 0.3, -w * 0.12, -w * 0.5)
  ctx.lineTo(w * 0.12, -w * 0.5)
  ctx.quadraticCurveTo(w * 0.18, -w * 0.3, w * 0.14, 0)
  ctx.closePath()
  inked(ctx, '#f0e5cf')
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, -w * 0.45)
  ctx.quadraticCurveTo(-w * 0.48, -w * 0.95, 0, -w * 0.96)
  ctx.quadraticCurveTo(w * 0.48, -w * 0.95, w * 0.5, -w * 0.45)
  ctx.quadraticCurveTo(0, -w * 0.36, -w * 0.5, -w * 0.45)
  ctx.closePath()
  inked(ctx, p.colour)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(39, 24, 73, 0.2)'
  ep(ctx, w * 0.25, -w * 0.45, w * 0.5, w * 0.25)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = WHITE
  for (const [sx, sy, sr] of [[-0.25, -0.7, 0.08], [0.08, -0.82, 0.07], [0.3, -0.6, 0.06], [-0.05, -0.58, 0.05]] as const) {
    ep(ctx, sx * w, sy * w, sr * w, sr * w * 0.8)
    ctx.fill()
  }
}

function pebble(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.52, w * 0.1)
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, 0)
  ctx.bezierCurveTo(-w * 0.55, -w * 0.4, -w * 0.1, -w * 0.52, w * 0.12, -w * 0.46)
  ctx.bezierCurveTo(w * 0.45, -w * 0.4, w * 0.56, -w * 0.12, w * 0.48, 0)
  ctx.closePath()
  inked(ctx, p.colour)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(39, 24, 73, 0.2)'
  ep(ctx, w * 0.25, -w * 0.02, w * 0.5, w * 0.22)
  ctx.fill()
  ctx.restore()
  shine(ctx, -w * 0.16, -w * 0.34, w * 0.14, w * 0.05, -0.2, 0.35)
}

function tuft(ctx: Ctx, p: Prop) {
  const h = p.s
  const blades = 5 + (p.variant % 3)
  for (let k = 0; k < blades; k++) {
    const t = k / (blades - 1) - 0.5
    const x = t * h * 0.5
    const tipX = x + t * h * 0.5 + (k % 2 ? 0.08 : -0.05) * h
    const tipY = -h * (0.7 + ((k * 37) % 5) * 0.07)
    ctx.beginPath()
    ctx.moveTo(x - h * 0.05, 0)
    ctx.quadraticCurveTo(x, tipY * 0.5, tipX, tipY)
    ctx.quadraticCurveTo(x + h * 0.02, tipY * 0.45, x + h * 0.06, 0)
    ctx.closePath()
    inked(ctx, k % 2 ? p.colour : p.colour2, PROP_INK * 0.8)
  }
}

// ------------------------------------------------------------------ garden

function wateringcan(ctx: Ctx, p: Prop) {
  const w = p.s
  const dir = p.flip ? -1 : 1
  ctx.save()
  ctx.scale(dir, 1)
  contact(ctx, 0, 0, w * 0.5, w * 0.08)
  // Spout.
  ctx.beginPath()
  ctx.moveTo(w * 0.28, -w * 0.2)
  ctx.lineTo(w * 0.7, -w * 0.62)
  stroke(ctx, INK, w * 0.1)
  ctx.beginPath()
  ctx.moveTo(w * 0.28, -w * 0.2)
  ctx.lineTo(w * 0.7, -w * 0.62)
  stroke(ctx, p.colour, w * 0.065)
  ep(ctx, w * 0.72, -w * 0.64, w * 0.08, w * 0.06, -0.8)
  inked(ctx, light(p.colour, 0.2))
  // Handle.
  ctx.beginPath()
  ctx.arc(-w * 0.05, -w * 0.62, w * 0.24, Math.PI * 1.05, Math.PI * 1.95)
  stroke(ctx, INK, w * 0.08)
  ctx.beginPath()
  ctx.arc(-w * 0.05, -w * 0.62, w * 0.24, Math.PI * 1.05, Math.PI * 1.95)
  stroke(ctx, p.colour, w * 0.05)
  ctx.beginPath()
  ctx.roundRect(-w * 0.34, -w * 0.62, w * 0.62, w * 0.62, w * 0.08)
  inked(ctx, p.colour)
  ctx.fillStyle = 'rgba(39, 24, 73, 0.16)'
  ctx.fillRect(w * 0.1, -w * 0.6, w * 0.16, w * 0.58)
  ctx.beginPath()
  ctx.roundRect(-w * 0.34, -w * 0.62, w * 0.62, w * 0.62, w * 0.08)
  ctx.lineWidth = PROP_INK
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(-w * 0.36, -w * 0.66, w * 0.66, w * 0.08, w * 0.03)
  inked(ctx, shade(p.colour, 0.12))
  shine(ctx, -w * 0.2, -w * 0.46, w * 0.05, w * 0.12, 0)
  ctx.restore()
}

function flowerpot(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.4, w * 0.08)
  // A little plant in it.
  for (const a of [-0.5, 0, 0.5]) {
    leafAt(ctx, 0, -w * 0.72, w * 0.36, -Math.PI / 2 + a, '#45b382')
  }
  ctx.beginPath()
  ctx.moveTo(-w * 0.36, -w * 0.62)
  ctx.lineTo(w * 0.36, -w * 0.62)
  ctx.lineTo(w * 0.26, 0)
  ctx.lineTo(-w * 0.26, 0)
  ctx.closePath()
  inked(ctx, '#d0763d')
  ctx.fillStyle = 'rgba(39, 24, 73, 0.15)'
  ctx.fillRect(w * 0.1, -w * 0.6, w * 0.2, w * 0.6)
  ctx.beginPath()
  ctx.roundRect(-w * 0.42, -w * 0.78, w * 0.84, w * 0.18, w * 0.04)
  inked(ctx, '#df844b')
}

function fence(ctx: Ctx, p: Prop) {
  const w = p.s
  const posts = 6
  ctx.beginPath()
  ctx.roundRect(-w * 0.5, -w * 0.3, w, w * 0.05, w * 0.01)
  inked(ctx, p.colour)
  ctx.beginPath()
  ctx.roundRect(-w * 0.5, -w * 0.16, w, w * 0.05, w * 0.01)
  inked(ctx, p.colour)
  for (let k = 0; k < posts; k++) {
    const x = -w * 0.46 + (k * w * 0.92) / (posts - 1)
    ctx.beginPath()
    ctx.moveTo(x - w * 0.035, 0)
    ctx.lineTo(x - w * 0.035, -w * 0.36)
    ctx.lineTo(x, -w * 0.42)
    ctx.lineTo(x + w * 0.035, -w * 0.36)
    ctx.lineTo(x + w * 0.035, 0)
    ctx.closePath()
    inked(ctx, p.colour)
  }
}

function sign(ctx: Ctx, p: Prop) {
  const w = p.s
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -w * 0.6)
  stroke(ctx, INK, w * 0.09)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -w * 0.6)
  stroke(ctx, '#aa6c45', w * 0.055)
  ctx.beginPath()
  ctx.roundRect(-w * 0.4, -w * 0.92, w * 0.8, w * 0.38, w * 0.05)
  inked(ctx, '#e4c483')
  ctx.strokeStyle = 'rgba(91, 54, 30, 0.5)'
  ctx.lineWidth = w * 0.035
  for (const [a, b] of [[-0.8, -0.3], [-0.72, 0.16], [-0.64, -0.1]] as const) {
    ctx.beginPath()
    ctx.moveTo(-w * 0.28, w * a)
    ctx.lineTo(w * b, w * a)
    ctx.stroke()
  }
}

// -------------------------------------------------------------------- pond

function reeds(ctx: Ctx, p: Prop) {
  const h = p.s
  const n = 4 + (p.variant % 3)
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1) - 0.5
    const x = t * h * 0.3
    const tip = -h * (0.72 + ((k * 29) % 7) * 0.04)
    const lean = t * h * 0.25
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.quadraticCurveTo(x + lean * 0.3, tip * 0.5, x + lean, tip)
    stroke(ctx, INK, h * 0.03 + PROP_INK * 1.5)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.quadraticCurveTo(x + lean * 0.3, tip * 0.5, x + lean, tip)
    stroke(ctx, k % 2 ? '#3f9c72' : '#47af80', h * 0.03)
    if (k % 2 === 0) {
      ctx.beginPath()
      ctx.roundRect(x + lean * 0.8 - h * 0.035, tip * 0.8 - h * 0.1, h * 0.07, h * 0.2, h * 0.035)
      inked(ctx, '#7f4c2c')
    }
  }
}

function sandcastle(ctx: Ctx, p: Prop) {
  const w = p.s
  const sand = '#e7c073'
  contact(ctx, 0, 0, w * 0.56, w * 0.08)
  const tower = (x: number, tw: number, th: number) => {
    ctx.beginPath()
    ctx.moveTo(x - tw / 2, 0)
    ctx.lineTo(x - tw / 2, -th)
    for (let k = 0; k < 4; k++) {
      const cx = x - tw / 2 + (tw * (k + 0.5)) / 4
      ctx.lineTo(cx - tw / 8, -th)
      ctx.lineTo(cx - tw / 8, -th - (k % 2 ? 0 : tw * 0.14))
      ctx.lineTo(cx + tw / 8, -th - (k % 2 ? 0 : tw * 0.14))
      ctx.lineTo(cx + tw / 8, -th)
    }
    ctx.lineTo(x + tw / 2, -th)
    ctx.lineTo(x + tw / 2, 0)
    ctx.closePath()
    inked(ctx, sand)
  }
  tower(-w * 0.3, w * 0.3, w * 0.5)
  tower(w * 0.3, w * 0.3, w * 0.46)
  tower(0, w * 0.44, w * 0.7)
  ctx.beginPath()
  ctx.roundRect(-w * 0.06, -w * 0.2, w * 0.12, w * 0.2, [w * 0.06, w * 0.06, 0, 0])
  ctx.fillStyle = '#8e5531'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, -w * 0.84)
  ctx.lineTo(0, -w * 1.08)
  stroke(ctx, INK, w * 0.025)
  ctx.beginPath()
  ctx.moveTo(0, -w * 1.08)
  ctx.lineTo(w * 0.16, -w * 1.02)
  ctx.lineTo(0, -w * 0.96)
  ctx.closePath()
  inked(ctx, p.colour)
  ctx.fillStyle = 'rgba(133, 78, 44, 0.35)'
  for (let k = 0; k < 14; k++) {
    ep(ctx, (((k * 41) % 23) / 23 - 0.5) * w * 0.8, -(((k * 17) % 13) / 13) * w * 0.5, w * 0.012, w * 0.012)
    ctx.fill()
  }
}

function bucket(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.42, w * 0.08)
  ctx.beginPath()
  ctx.arc(0, -w * 0.72, w * 0.3, Math.PI * 1.1, Math.PI * 1.9)
  stroke(ctx, INK, w * 0.05)
  ctx.beginPath()
  ctx.moveTo(-w * 0.36, -w * 0.72)
  ctx.lineTo(w * 0.36, -w * 0.72)
  ctx.lineTo(w * 0.28, 0)
  ctx.lineTo(-w * 0.28, 0)
  ctx.closePath()
  inked(ctx, p.colour)
  ctx.fillStyle = 'rgba(39, 24, 73, 0.14)'
  ctx.fillRect(w * 0.1, -w * 0.7, w * 0.2, w * 0.7)
  ep(ctx, 0, -w * 0.72, w * 0.36, w * 0.07)
  inked(ctx, shade(p.colour, 0.35))
  ctx.beginPath()
  ctx.roundRect(-w * 0.34, -w * 0.46, w * 0.68, w * 0.08, w * 0.03)
  ctx.fillStyle = WHITE
  ctx.fill()
}

function umbrella(ctx: Ctx, p: Prop) {
  const w = p.s
  const tilt = (p.flip ? -1 : 1) * 0.12
  contact(ctx, 0, 0, w * 0.5, w * 0.1, 0.16)
  ctx.save()
  ctx.rotate(tilt)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -w * 0.95)
  stroke(ctx, INK, w * 0.04)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -w * 0.95)
  stroke(ctx, WHITE, w * 0.022)
  const top = -w * 1.0
  const segs = 6
  for (let k = 0; k < segs; k++) {
    const a0 = Math.PI + (k / segs) * Math.PI
    const a1 = Math.PI + ((k + 1) / segs) * Math.PI
    ctx.beginPath()
    ctx.moveTo(0, top)
    ctx.lineTo(Math.cos(a0) * w * 0.55, top + w * 0.36 + Math.sin(a0) * w * 0.02)
    ctx.quadraticCurveTo(
      Math.cos((a0 + a1) / 2) * w * 0.5,
      top + w * 0.28,
      Math.cos(a1) * w * 0.55,
      top + w * 0.36 + Math.sin(a1) * w * 0.02,
    )
    ctx.closePath()
    inked(ctx, k % 2 ? p.colour2 : p.colour)
  }
  ep(ctx, 0, top, w * 0.03, w * 0.03)
  inked(ctx, p.colour)
  ctx.restore()
}

function lifeguard(ctx: Ctx, p: Prop) {
  const w = p.s
  const wood = '#d8ad58'
  contact(ctx, 0, 0, w * 0.45, w * 0.08)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * w * 0.36, 0)
    ctx.lineTo(side * w * 0.2, -w * 1.1)
    stroke(ctx, INK, w * 0.09)
    ctx.beginPath()
    ctx.moveTo(side * w * 0.36, 0)
    ctx.lineTo(side * w * 0.2, -w * 1.1)
    stroke(ctx, wood, w * 0.06)
  }
  for (const y of [-0.3, -0.6]) {
    ctx.beginPath()
    ctx.roundRect(-w * 0.32, w * y - w * 0.03, w * 0.64, w * 0.06, w * 0.02)
    inked(ctx, wood)
  }
  ctx.beginPath()
  ctx.roundRect(-w * 0.3, -w * 1.14, w * 0.6, w * 0.08, w * 0.02)
  inked(ctx, RED)
  ctx.beginPath()
  ctx.roundRect(-w * 0.26, -w * 1.5, w * 0.08, w * 0.4, w * 0.02)
  inked(ctx, RED)
  ctx.beginPath()
  ctx.roundRect(w * 0.18, -w * 1.5, w * 0.08, w * 0.4, w * 0.02)
  inked(ctx, RED)
  ctx.beginPath()
  ctx.roundRect(-w * 0.26, -w * 1.5, w * 0.52, w * 0.08, w * 0.02)
  inked(ctx, WHITE)
}

function boat(ctx: Ctx, p: Prop) {
  const w = p.s
  // A leaf boat with a twig mast and a petal sail.
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, -w * 0.12)
  ctx.quadraticCurveTo(0, w * 0.1, w * 0.5, -w * 0.12)
  ctx.quadraticCurveTo(w * 0.2, -w * 0.02, 0, -w * 0.02)
  ctx.quadraticCurveTo(-w * 0.2, -w * 0.02, -w * 0.5, -w * 0.12)
  ctx.closePath()
  inked(ctx, p.colour)
  ctx.beginPath()
  ctx.moveTo(-w * 0.42, -w * 0.1)
  ctx.lineTo(w * 0.42, -w * 0.1)
  stroke(ctx, 'rgba(26, 77, 54, 0.45)', PROP_INK * 0.8)
  ctx.beginPath()
  ctx.moveTo(0, -w * 0.04)
  ctx.lineTo(0, -w * 0.7)
  stroke(ctx, INK, w * 0.035)
  ctx.beginPath()
  ctx.moveTo(w * 0.02, -w * 0.66)
  ctx.quadraticCurveTo(w * 0.34, -w * 0.4, w * 0.02, -w * 0.16)
  ctx.closePath()
  inked(ctx, p.colour2)
}

// ------------------------------------------------------------------ arcade

const SCREEN_ART = ['#5eebac', '#eaba59', '#ee77ab', '#77beee'] as const

function cabinet(ctx: Ctx, p: Prop) {
  const w = p.s
  const h = w * 1.7
  const body = p.colour
  contact(ctx, 0, 0, w * 0.62, w * 0.1, 0.28)
  // Side panel, then the front face over it.
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, 0)
  ctx.lineTo(-w * 0.5, -h)
  ctx.lineTo(w * 0.5, -h)
  ctx.lineTo(w * 0.5, 0)
  ctx.closePath()
  inked(ctx, shade(body, 0.25))
  ctx.beginPath()
  ctx.moveTo(-w * 0.42, 0)
  ctx.lineTo(-w * 0.42, -h * 0.5)
  ctx.lineTo(-w * 0.46, -h * 0.58)
  ctx.lineTo(-w * 0.42, -h * 0.97)
  ctx.lineTo(w * 0.42, -h * 0.97)
  ctx.lineTo(w * 0.46, -h * 0.58)
  ctx.lineTo(w * 0.42, -h * 0.5)
  ctx.lineTo(w * 0.42, 0)
  ctx.closePath()
  inked(ctx, body)
  // Marquee, glowing.
  ctx.beginPath()
  ctx.roundRect(-w * 0.38, -h * 0.94, w * 0.76, h * 0.12, w * 0.04)
  inked(ctx, p.colour2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.fillRect(-w * 0.28, -h * 0.9, w * 0.56, h * 0.03)
  // Screen, with a little game on it.
  ctx.beginPath()
  ctx.roundRect(-w * 0.34, -h * 0.79, w * 0.68, h * 0.26, w * 0.05)
  inked(ctx, '#14171a')
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(-w * 0.3, -h * 0.76, w * 0.6, h * 0.2, w * 0.03)
  ctx.clip()
  const art = SCREEN_ART[p.variant % SCREEN_ART.length]
  ctx.fillStyle = art
  if (p.variant % 3 === 0) {
    for (let k = 0; k < 4; k++) ctx.fillRect(-w * 0.24 + k * w * 0.13, -h * 0.72, w * 0.07, h * 0.035)
    ctx.fillRect(-w * 0.04, -h * 0.6, w * 0.08, h * 0.03)
  } else if (p.variant % 3 === 1) {
    ctx.beginPath()
    ctx.arc(0, -h * 0.66, h * 0.06, 0.5, TAU - 0.5)
    ctx.lineTo(0, -h * 0.66)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    for (let k = 1; k <= 3; k++) ctx.fillRect(k * w * 0.07, -h * 0.665, w * 0.02, w * 0.02)
  } else {
    for (let k = 0; k < 4; k++) ctx.fillRect(-w * 0.24 + k * w * 0.14, -h * (0.6 + k * 0.03), w * 0.08, h * (0.05 + k * 0.03))
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  for (let k = 0; k < 6; k++) ctx.fillRect(-w * 0.3, -h * 0.76 + k * h * 0.035, w * 0.6, h * 0.01)
  ctx.restore()
  // Control deck.
  ctx.beginPath()
  ctx.moveTo(-w * 0.46, -h * 0.5)
  ctx.lineTo(w * 0.46, -h * 0.5)
  ctx.lineTo(w * 0.5, -h * 0.4)
  ctx.lineTo(-w * 0.5, -h * 0.4)
  ctx.closePath()
  inked(ctx, shade(body, 0.12))
  ctx.beginPath()
  ctx.moveTo(-w * 0.2, -h * 0.46)
  ctx.lineTo(-w * 0.2, -h * 0.53)
  stroke(ctx, INK, w * 0.04)
  ep(ctx, -w * 0.2, -h * 0.54, w * 0.05, w * 0.05)
  inked(ctx, RED, PROP_INK * 0.8)
  for (const bx of [0.08, 0.2]) {
    ep(ctx, w * bx, -h * 0.45, w * 0.04, w * 0.025)
    inked(ctx, bx < 0.1 ? '#e6ac39' : '#3d99d8', PROP_INK * 0.7)
  }
  // Coin slot.
  ctx.beginPath()
  ctx.roundRect(-w * 0.08, -h * 0.26, w * 0.16, h * 0.08, w * 0.02)
  inked(ctx, '#302940', PROP_INK * 0.8)
  ctx.fillStyle = '#ec6c66'
  ctx.fillRect(-w * 0.015, -h * 0.245, w * 0.03, h * 0.05)
}

function claw(ctx: Ctx, p: Prop) {
  const w = p.s
  const h = w * 1.6
  contact(ctx, 0, 0, w * 0.62, w * 0.1, 0.28)
  ctx.beginPath()
  ctx.roundRect(-w * 0.5, -h * 0.4, w, h * 0.4, w * 0.04)
  inked(ctx, p.colour)
  ctx.beginPath()
  ctx.roundRect(-w * 0.5, -h, w, h * 0.12, w * 0.04)
  inked(ctx, p.colour)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.fillRect(-w * 0.36, -h * 0.955, w * 0.72, h * 0.03)
  // Glass box.
  ctx.beginPath()
  ctx.rect(-w * 0.46, -h * 0.88, w * 0.92, h * 0.48)
  ctx.fillStyle = 'rgba(184, 221, 246, 0.28)'
  ctx.fill()
  // Prizes heaped in the bottom.
  const prizes = ['#f191bb', '#eaba59', '#78dfb1', '#84c4f0', '#b59bf3']
  for (let k = 0; k < 7; k++) {
    const px = -w * 0.36 + (k % 4) * w * 0.24 + (k > 3 ? w * 0.12 : 0)
    const py = -h * 0.44 - (k > 3 ? h * 0.07 : 0)
    ep(ctx, px, py, w * 0.11, w * 0.1)
    inked(ctx, prizes[k % prizes.length], PROP_INK * 0.8)
    ctx.fillStyle = INK
    ep(ctx, px - w * 0.03, py - w * 0.01, w * 0.012, w * 0.012)
    ctx.fill()
    ep(ctx, px + w * 0.03, py - w * 0.01, w * 0.012, w * 0.012)
    ctx.fill()
  }
  // The claw on its cable.
  ctx.beginPath()
  ctx.moveTo(w * 0.05, -h * 0.88)
  ctx.lineTo(w * 0.05, -h * 0.68)
  stroke(ctx, '#a6c5db', w * 0.02)
  ctx.beginPath()
  ctx.moveTo(w * 0.05 - w * 0.08, -h * 0.6)
  ctx.lineTo(w * 0.05, -h * 0.68)
  ctx.lineTo(w * 0.05 + w * 0.08, -h * 0.6)
  stroke(ctx, INK, w * 0.035)
  ctx.beginPath()
  ctx.rect(-w * 0.46, -h * 0.88, w * 0.92, h * 0.48)
  ctx.lineWidth = PROP_INK
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = w * 0.02
  ctx.beginPath()
  ctx.moveTo(-w * 0.38, -h * 0.84)
  ctx.lineTo(-w * 0.26, -h * 0.72)
  ctx.stroke()
  ctx.fillStyle = '#302940'
  ctx.beginPath()
  ctx.roundRect(-w * 0.2, -h * 0.3, w * 0.4, h * 0.14, w * 0.03)
  ctx.fill()
}

function counter(ctx: Ctx, p: Prop) {
  const w = p.s
  const h = w * 0.45
  contact(ctx, 0, 0, w * 0.54, w * 0.06, 0.28)
  // Shelf of prizes behind the counter.
  ctx.beginPath()
  ctx.roundRect(-w * 0.46, -h * 2.1, w * 0.92, h * 1.2, w * 0.02)
  inked(ctx, '#3d2e5f')
  const prizes = ['#f191bb', '#eaba59', '#78dfb1', '#84c4f0', '#b59bf3', '#ec9a66']
  for (let row = 0; row < 2; row++) {
    ctx.fillStyle = '#543a8f'
    ctx.fillRect(-w * 0.44, -h * (1.5 - row * 0.55), w * 0.88, h * 0.05)
    for (let k = 0; k < 6; k++) {
      const px = -w * 0.36 + k * w * 0.145
      const py = -h * (1.62 - row * 0.55)
      ep(ctx, px, py, w * 0.05, w * 0.045)
      inked(ctx, prizes[(k + row * 2) % prizes.length], PROP_INK * 0.7)
    }
  }
  ctx.beginPath()
  ctx.roundRect(-w * 0.5, -h, w, h, w * 0.02)
  inked(ctx, p.colour)
  ctx.beginPath()
  ctx.roundRect(-w * 0.52, -h * 1.08, w * 1.04, h * 0.14, w * 0.02)
  inked(ctx, p.colour2)
  // Ticket stripes on the front.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
  for (let k = 0; k < 5; k++) ctx.fillRect(-w * 0.44 + k * w * 0.2, -h * 0.8, w * 0.1, h * 0.6)
}

function changer(ctx: Ctx, p: Prop) {
  const w = p.s
  const h = w * 1.5
  contact(ctx, 0, 0, w * 0.55, w * 0.09, 0.28)
  ctx.beginPath()
  ctx.roundRect(-w * 0.45, -h, w * 0.9, h, w * 0.08)
  inked(ctx, p.colour)
  ctx.beginPath()
  ctx.roundRect(-w * 0.34, -h * 0.9, w * 0.68, h * 0.2, w * 0.05)
  inked(ctx, '#14171a')
  ctx.fillStyle = '#eaba59'
  ctx.font = `800 ${w * 0.16}px Outfit, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TOKENS', 0, -h * 0.8)
  ep(ctx, 0, -h * 0.48, w * 0.2, w * 0.2)
  inked(ctx, '#e7af40')
  ep(ctx, 0, -h * 0.48, w * 0.1, w * 0.1)
  ctx.strokeStyle = '#b98318'
  ctx.lineWidth = PROP_INK
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(-w * 0.22, -h * 0.2, w * 0.44, h * 0.1, w * 0.03)
  inked(ctx, '#302940')
}

function neon(ctx: Ctx, p: Prop) {
  const w = p.s
  const colour = p.colour
  ctx.save()
  ctx.shadowColor = colour
  ctx.shadowBlur = w * 0.12
  ctx.strokeStyle = colour
  ctx.lineWidth = w * 0.045
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (p.variant % 4 === 0) {
    // A star.
    for (let k = 0; k <= 10; k++) {
      const a = (k / 10) * TAU - Math.PI / 2
      const r = k % 2 ? w * 0.18 : w * 0.42
      const x = Math.cos(a) * r
      const y = -w * 0.45 + Math.sin(a) * r
      if (k === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  } else if (p.variant % 4 === 1) {
    // A joystick.
    ctx.roundRect(-w * 0.4, -w * 0.3, w * 0.8, w * 0.25, w * 0.06)
    ctx.moveTo(0, -w * 0.3)
    ctx.lineTo(0, -w * 0.62)
    ctx.moveTo(w * 0.12, -w * 0.72)
    ctx.arc(0, -w * 0.72, w * 0.12, 0, TAU)
  } else if (p.variant % 4 === 2) {
    // A lightning zig.
    ctx.moveTo(-w * 0.45, -w * 0.2)
    ctx.lineTo(-w * 0.15, -w * 0.7)
    ctx.lineTo(w * 0.05, -w * 0.3)
    ctx.lineTo(w * 0.25, -w * 0.72)
    ctx.lineTo(w * 0.45, -w * 0.25)
  } else {
    // A heart.
    ctx.moveTo(0, -w * 0.12)
    ctx.bezierCurveTo(-w * 0.55, -w * 0.45, -w * 0.3, -w * 0.9, 0, -w * 0.62)
    ctx.bezierCurveTo(w * 0.3, -w * 0.9, w * 0.55, -w * 0.45, 0, -w * 0.12)
  }
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.lineWidth = w * 0.015
  ctx.stroke()
  ctx.restore()
}

// ------------------------------------------------------------------- night

function stall(ctx: Ctx, p: Prop) {
  const w = p.s
  const h = w * 0.95
  contact(ctx, 0, 0, w * 0.56, w * 0.07, 0.3)
  // Posts, counter, then the striped awning.
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * w * 0.44, 0)
    ctx.lineTo(side * w * 0.44, -h)
    stroke(ctx, INK, w * 0.05)
    ctx.beginPath()
    ctx.moveTo(side * w * 0.44, 0)
    ctx.lineTo(side * w * 0.44, -h)
    stroke(ctx, '#aa6c45', w * 0.03)
  }
  ctx.beginPath()
  ctx.roundRect(-w * 0.48, -h * 0.42, w * 0.96, h * 0.42, w * 0.02)
  inked(ctx, '#b97951')
  ctx.strokeStyle = 'rgba(77, 46, 26, 0.35)'
  ctx.lineWidth = w * 0.01
  for (let k = 1; k < 4; k++) {
    ctx.beginPath()
    ctx.moveTo(-w * 0.46, -h * 0.42 + k * h * 0.1)
    ctx.lineTo(w * 0.46, -h * 0.42 + k * h * 0.1)
    ctx.stroke()
  }
  // Goods on the counter.
  const goods = ['#eea273', '#eaba59', '#78dfb1', '#ee77ab', '#b59bf3']
  for (let k = 0; k < 5; k++) {
    ep(ctx, -w * 0.34 + k * w * 0.17, -h * 0.47, w * 0.055, w * 0.05)
    inked(ctx, goods[(k + p.variant) % goods.length], PROP_INK * 0.7)
  }
  const top = -h
  const n = 7
  ctx.beginPath()
  ctx.moveTo(-w * 0.52, top + h * 0.12)
  ctx.lineTo(-w * 0.4, top - h * 0.12)
  ctx.lineTo(w * 0.4, top - h * 0.12)
  ctx.lineTo(w * 0.52, top + h * 0.12)
  ctx.closePath()
  inked(ctx, p.colour2)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = p.colour
  for (let k = 0; k < n; k += 2) {
    const x0 = -w * 0.52 + (k * w * 1.04) / n
    ctx.beginPath()
    ctx.moveTo(x0, top + h * 0.12)
    ctx.lineTo(x0 + w * 0.04, top - h * 0.12)
    ctx.lineTo(x0 + w * 0.04 + (w * 1.04) / n, top - h * 0.12)
    ctx.lineTo(x0 + (w * 1.04) / n, top + h * 0.12)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  // Scalloped valance.
  for (let k = 0; k < n; k++) {
    const x0 = -w * 0.52 + (k * w * 1.04) / n
    ctx.beginPath()
    ctx.moveTo(x0, top + h * 0.12)
    ctx.arc(x0 + (w * 0.52) / n, top + h * 0.12, (w * 0.52) / n, Math.PI, 0, true)
    ctx.closePath()
    inked(ctx, k % 2 ? p.colour2 : p.colour, PROP_INK * 0.8)
  }
  ctx.beginPath()
  ctx.moveTo(-w * 0.52, top + h * 0.12)
  ctx.lineTo(-w * 0.4, top - h * 0.12)
  ctx.lineTo(w * 0.4, top - h * 0.12)
  ctx.lineTo(w * 0.52, top + h * 0.12)
  ctx.lineWidth = PROP_INK
  ctx.strokeStyle = INK
  ctx.stroke()
}

function tent(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.55, w * 0.07, 0.3)
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, 0)
  ctx.lineTo(0, -w * 0.75)
  ctx.lineTo(w * 0.5, 0)
  ctx.closePath()
  inked(ctx, p.colour)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = p.colour2
  for (let k = -3; k <= 3; k += 2) {
    ctx.beginPath()
    ctx.moveTo(0, -w * 0.75)
    ctx.lineTo(k * w * 0.1, 0)
    ctx.lineTo((k + 1) * w * 0.1, 0)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  ctx.beginPath()
  ctx.moveTo(-w * 0.14, 0)
  ctx.lineTo(0, -w * 0.4)
  ctx.lineTo(w * 0.14, 0)
  ctx.closePath()
  inked(ctx, '#2d2443')
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, 0)
  ctx.lineTo(0, -w * 0.75)
  ctx.lineTo(w * 0.5, 0)
  ctx.closePath()
  ctx.lineWidth = PROP_INK
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, -w * 0.75)
  ctx.lineTo(0, -w * 0.92)
  stroke(ctx, INK, w * 0.02)
  ctx.beginPath()
  ctx.moveTo(0, -w * 0.92)
  ctx.lineTo(w * 0.14, -w * 0.87)
  ctx.lineTo(0, -w * 0.82)
  ctx.closePath()
  inked(ctx, p.colour2)
}

function lamp(ctx: Ctx, p: Prop) {
  const w = p.s
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -w * 1.5)
  stroke(ctx, INK, w * 0.08)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -w * 1.5)
  stroke(ctx, '#4b435d', w * 0.05)
  ctx.beginPath()
  ctx.moveTo(-w * 0.14, -w * 1.5)
  ctx.lineTo(w * 0.14, -w * 1.5)
  ctx.lineTo(w * 0.1, -w * 1.78)
  ctx.lineTo(-w * 0.1, -w * 1.78)
  ctx.closePath()
  inked(ctx, '#f3d59a')
  ctx.beginPath()
  ctx.moveTo(-w * 0.18, -w * 1.78)
  ctx.lineTo(w * 0.18, -w * 1.78)
  ctx.lineTo(0, -w * 1.92)
  ctx.closePath()
  inked(ctx, '#4b435d')
}

function campfire(ctx: Ctx, p: Prop) {
  const w = p.s
  for (const a of [-0.4, 0.4]) {
    ctx.save()
    ctx.rotate(a)
    ctx.beginPath()
    ctx.roundRect(-w * 0.4, -w * 0.07, w * 0.8, w * 0.14, w * 0.07)
    inked(ctx, '#8e5835')
    ctx.restore()
  }
  ctx.beginPath()
  ctx.moveTo(-w * 0.26, -w * 0.05)
  ctx.bezierCurveTo(-w * 0.36, -w * 0.4, -w * 0.08, -w * 0.5, 0, -w * 0.8)
  ctx.bezierCurveTo(w * 0.1, -w * 0.5, w * 0.36, -w * 0.42, w * 0.26, -w * 0.05)
  ctx.closePath()
  inked(ctx, '#e9884c')
  ctx.beginPath()
  ctx.moveTo(-w * 0.13, -w * 0.08)
  ctx.bezierCurveTo(-w * 0.2, -w * 0.3, -w * 0.02, -w * 0.36, 0, -w * 0.55)
  ctx.bezierCurveTo(w * 0.06, -w * 0.34, w * 0.2, -w * 0.3, w * 0.13, -w * 0.08)
  ctx.closePath()
  ctx.fillStyle = '#efca80'
  ctx.fill()
}

function bench(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.52, w * 0.06)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.roundRect(side * w * 0.38 - w * 0.03, -w * 0.2, w * 0.06, w * 0.2, w * 0.01)
    inked(ctx, '#704a33')
  }
  ctx.beginPath()
  ctx.roundRect(-w * 0.5, -w * 0.24, w, w * 0.07, w * 0.02)
  inked(ctx, p.colour)
  ctx.beginPath()
  ctx.roundRect(-w * 0.48, -w * 0.46, w * 0.96, w * 0.07, w * 0.02)
  inked(ctx, p.colour)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * w * 0.36, -w * 0.24)
    ctx.lineTo(side * w * 0.36, -w * 0.46)
    stroke(ctx, INK, w * 0.04)
  }
}

function log(ctx: Ctx, p: Prop) {
  const w = p.s
  contact(ctx, 0, 0, w * 0.54, w * 0.07)
  ctx.beginPath()
  ctx.roundRect(-w * 0.5, -w * 0.3, w, w * 0.3, w * 0.15)
  inked(ctx, '#8e5835')
  ctx.strokeStyle = 'rgba(64, 38, 21, 0.4)'
  ctx.lineWidth = w * 0.015
  for (const y of [-0.2, -0.12]) {
    ctx.beginPath()
    ctx.moveTo(-w * 0.3, w * y)
    ctx.lineTo(w * 0.25, w * y)
    ctx.stroke()
  }
  ep(ctx, w * 0.42, -w * 0.15, w * 0.1, w * 0.15)
  inked(ctx, '#d8b266')
  ep(ctx, w * 0.42, -w * 0.15, w * 0.05, w * 0.08)
  ctx.strokeStyle = 'rgba(119, 70, 40, 0.6)'
  ctx.lineWidth = PROP_INK * 0.7
  ctx.stroke()
}

const DRAW: Record<PropKind, (ctx: Ctx, p: Prop) => void> = {
  watermelon,
  sandwich,
  cupcake,
  cheese,
  strawberry,
  teacup,
  juicebox,
  grapes,
  basket,
  anthill,
  daisy,
  tulip,
  sunflower,
  dandelion,
  toadstool,
  pebble,
  tuft,
  reeds,
  lilypad: () => {},
  sandcastle,
  bucket,
  umbrella,
  lifeguard,
  boat,
  cabinet,
  claw,
  counter,
  changer,
  neon,
  stall,
  tent,
  lamp,
  campfire,
  wateringcan,
  flowerpot,
  fence,
  sign,
  bench,
  log,
}

export function drawProp(ctx: Ctx, p: Prop) {
  ctx.save()
  ctx.translate(p.x, p.y)
  if (p.flip && p.kind !== 'wateringcan') ctx.scale(-1, 1)
  DRAW[p.kind](ctx, p)
  ctx.restore()
}

/**
 * How far a prop reaches from its base, as fractions of `s`: half-width,
 * height above the base. Used to cull, to keep the crowd out of solid things,
 * and to decide what stands in front of what.
 */
const EXTENT: Record<PropKind, [number, number]> = {
  watermelon: [0.52, 0.55],
  sandwich: [0.56, 0.75],
  cupcake: [0.48, 1.3],
  cheese: [0.54, 0.55],
  strawberry: [0.4, 0.9],
  teacup: [0.62, 1.0],
  juicebox: [0.36, 1.36],
  grapes: [0.4, 1.1],
  basket: [0.58, 0.94],
  anthill: [0.52, 0.42],
  daisy: [0.3, 1.05],
  tulip: [0.3, 1.0],
  sunflower: [0.36, 1.05],
  dandelion: [0.26, 0.98],
  toadstool: [0.52, 0.98],
  pebble: [0.54, 0.52],
  tuft: [0.45, 1.0],
  reeds: [0.4, 1.0],
  lilypad: [0.5, 0.2],
  sandcastle: [0.6, 1.1],
  bucket: [0.44, 1.05],
  umbrella: [0.6, 1.05],
  lifeguard: [0.45, 1.55],
  boat: [0.52, 0.72],
  cabinet: [0.52, 1.7],
  claw: [0.52, 1.6],
  counter: [0.54, 0.95],
  changer: [0.47, 1.5],
  neon: [0.5, 0.95],
  stall: [0.56, 1.1],
  tent: [0.54, 0.95],
  lamp: [0.2, 1.95],
  campfire: [0.44, 0.82],
  wateringcan: [0.78, 0.9],
  flowerpot: [0.45, 1.1],
  fence: [0.52, 0.44],
  sign: [0.42, 0.94],
  bench: [0.52, 0.5],
  log: [0.55, 0.32],
}

export function propBounds(p: Prop): { x0: number; y0: number; x1: number; y1: number } {
  const [hw, h] = EXTENT[p.kind]
  return { x0: p.x - hw * p.s, y0: p.y - h * p.s, x1: p.x + hw * p.s, y1: p.y + 0.12 * p.s }
}

/** Props low enough that a critter standing on the far side still shows over them. */
export function isLowProp(kind: PropKind): boolean {
  return kind === 'pebble' || kind === 'tuft' || kind === 'log' || kind === 'anthill' || kind === 'fence' || kind === 'cheese' || kind === 'bench'
}

type Box = { x0: number; y0: number; x1: number; y1: number }

/**
 * The parts of a prop that really hide what is behind them, as boxes in world
 * units. Most props are solid all the way up; a flower hides only behind its
 * head, an umbrella behind its canopy, a sign behind its board, and blades of
 * grass and reeds hide nothing worth counting.
 */
export function propOccluders(p: Prop): Box[] {
  const s = p.s
  // Flowers lean off their stem, the way `drawProp` mirrors them.
  const head = (lean: number, r: number, rise: number): Box[] => {
    const cx = p.x + (p.flip ? -1 : 1) * s * lean
    const cy = p.y - s * rise
    return [{ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }]
  }
  switch (p.kind) {
    case 'tuft':
    case 'neon':
      return []
    // Thin, but a clump of them across a face hides enough of it to count.
    case 'reeds':
      return [{ x0: p.x - s * 0.24, y0: p.y - s * 0.95, x1: p.x + s * 0.24, y1: p.y }]
    case 'daisy':
      return head(0.08, s * 0.3, 0.8)
    case 'dandelion':
      return head(0.1, s * 0.24, 0.78)
    case 'tulip':
      return head(0.06, s * 0.2, 0.8)
    case 'sunflower':
      return head(0.05, s * 0.36, 0.78)
    case 'umbrella':
      return [{ x0: p.x - s * 0.62, y0: p.y - s * 1.08, x1: p.x + s * 0.62, y1: p.y - s * 0.6 }]
    case 'sign':
      return [{ x0: p.x - s * 0.4, y0: p.y - s * 0.94, x1: p.x + s * 0.4, y1: p.y - s * 0.52 }]
    case 'lamp':
      return [{ x0: p.x - s * 0.2, y0: p.y - s * 1.95, x1: p.x + s * 0.2, y1: p.y - s * 1.45 }]
    default: {
      const b = propBounds(p)
      const inset = (b.x1 - b.x0) * 0.06
      return [{ x0: b.x0 + inset, y0: b.y0, x1: b.x1 - inset, y1: p.y }]
    }
  }
}
