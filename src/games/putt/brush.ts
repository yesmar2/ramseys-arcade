import { mulberry32 } from '../../lib/seededRandom'
import type { Vec } from './terrain'

/*
 * The few things every part of Putt's drawing leans on: the light, the
 * shadow it casts, paths through traced outlines, and the shapes trees and
 * stones are cut from. Everything here draws in field units through
 * whatever transform the canvas has.
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** The way shadows fall, per unit of height: away from a light up and to the left. */
export const LIGHT = { x: 0.62, y: 0.85 }

/** One path through closed loops, for filling with 'evenodd' so a hole in the ground stays a hole. */
export function loopsPath(g: Ctx, loops: readonly Vec[][]) {
  g.beginPath()
  for (const line of loops) {
    line.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
    g.closePath()
  }
}

/**
 * Paint only the shadow of what `draw` paints: cast `h` units high, away from
 * the light, softened by `blur` units. The shape itself is drawn far off to
 * the side and only its shadow is brought back.
 */
export function castShadow(g: Ctx, h: number, blur: number, color: string, draw: () => void) {
  const m = g.getTransform()
  const FAR = 3000
  const sx = LIGHT.x * h
  const sy = LIGHT.y * h
  g.save()
  g.shadowColor = color
  g.shadowBlur = blur * Math.hypot(m.a, m.b)
  g.shadowOffsetX = m.a * (FAR + sx) + m.c * sy
  g.shadowOffsetY = m.b * (FAR + sx) + m.d * sy
  g.translate(-FAR, 0)
  draw()
  g.restore()
}

/** A random stream that is the same for a spot on the ground every time it is asked. */
export function spotRandom(i: number, j: number, salt: number) {
  return mulberry32(((Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ salt) >>> 0) + 1)
}

/** A random stream for a thing from its own seed, 0 to 1. */
export function seeded(seed: number, salt = 7) {
  return mulberry32(Math.floor(seed * 4294967295) + salt)
}

/** A round crown with scalloped edges, the way a tree or a bush looks from above. */
export function crownPath(g: Ctx, x: number, y: number, r: number, seed: number, lumps: number, depth: number) {
  const phase = seed * Math.PI * 2 * 7
  const n = Math.max(24, Math.round(r * 6))
  g.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (1 - depth + depth * 2 * Math.abs(Math.sin((lumps * a + phase) / 2)))
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}

/** A star: a pine from above, a palm's fronds, a crab's legs. */
export function starPath(g: Ctx, x: number, y: number, r: number, points: number, inner: number, spin: number) {
  g.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const a = spin + (i / (points * 2)) * Math.PI * 2
    const rr = i % 2 === 0 ? r : r * inner
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}

/** A rectangle `len` long along `angle` from (x, y), `half` either side of its line. */
export function barPath(g: Ctx, x: number, y: number, angle: number, len: number, half: number) {
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const nx = -uy * half
  const ny = ux * half
  g.beginPath()
  g.moveTo(x + nx, y + ny)
  g.lineTo(x + ux * len + nx, y + uy * len + ny)
  g.lineTo(x + ux * len - nx, y + uy * len - ny)
  g.lineTo(x - nx, y - ny)
  g.closePath()
}
