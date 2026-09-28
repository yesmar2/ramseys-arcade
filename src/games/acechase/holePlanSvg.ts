import {
  boundsOf,
  css,
  fit,
  PALETTES,
  propsOf,
  railsOf,
  SAMPLES,
  shadePixels,
  STONE,
  toPx,
} from './holePlan'
import { RINGS, type HoleDef, type Spot, type Style } from './physics'

/*
 * A hole from above as SVG, drawn the way holePlan.ts draws one on a canvas, part for part: the ground
 * and its trees or craters, the green on its banks with its shaded slopes, the target, the rails and posts,
 * and the ball on the tee. The build draws each day's hole this way for the card its share link unfurls
 * into (scripts/today-cards.mjs), where there's no canvas.
 *
 * It comes in three layers, laid one over the next: what's under the green's ground, the ground itself
 * (a picture, already cut to the green), and what's over it. The card's drawer won't show a picture
 * inside an SVG, so the ground can't be one of the SVG's own parts.
 */

/** Pixels (RGBA, a row at a time) as a PNG `data:` URL: the build's, which has zlib. */
export type PngEncoder = (width: number, height: number, rgba: Uint8ClampedArray) => string

export type HolePlanLayers = {
  /** The ground round the course, its trees or craters, the course's shadow, and the green's own colour. */
  under: string
  /** The green's shaded ground, cut to its outline, and where it lies in the picture. */
  ground: { url: string; x: number; y: number; width: number; height: number }
  /** The target, the rails and posts, and the ball on the tee. */
  over: string
}

/** A number for an attribute: two places at most. */
const n = (v: number) => String(Math.round(v * 100) / 100)

function circle(cx: number, cy: number, r: number, fill: string, extra = ''): string {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${extra}/>`
}

const svg = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`

/** Draw a hole from above, `width` by `height` pixels, its target at `spot`, as three layers. */
export function holePlanLayers(def: HoleDef, spot: Spot, width: number, height: number, png: PngEncoder): HolePlanLayers {
  const style: Style = def.style ?? 'garden'
  const pal = PALETTES[style]
  const view = fit(def, width, height)

  const under: string[] = [`<rect width="${width}" height="${height}" fill="${css(pal.off)}"/>`]
  for (const { kind, px, py, rad, leaf } of propsOf(view, def, pal, width, height)) {
    if (kind === 'tree') {
      under.push(circle(px + rad * 0.3, py + rad * 0.35, rad, 'rgba(12, 32, 14, 0.32)'))
      under.push(circle(px, py, rad, css(leaf)))
      under.push(circle(px - rad * 0.28, py - rad * 0.3, rad * 0.55, 'rgba(160, 210, 120, 0.22)'))
    } else {
      under.push(circle(px, py, rad, 'rgba(20, 21, 24, 0.35)'))
      under.push(circle(px + rad * 0.22, py + rad * 0.22, rad * 0.78, 'rgba(190, 193, 198, 0.22)'))
      under.push(circle(px, py, rad * 1.05, 'none', ` stroke="rgba(200, 203, 208, 0.3)" stroke-width="${n(Math.max(1, rad * 0.14))}"`))
    }
  }
  // The course on its banks, its shadow thrown down and to the right, and the green's colour under its ground.
  const points = def.green.map(([x, z]) => toPx(view, x, z).map(n).join(',')).join(' ')
  const blur = Math.max(2, view.s * 0.5) / 2
  under.push(`<defs><filter id="bank" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${n(blur)}"/></filter></defs>`)
  under.push(`<polygon points="${points}" fill="rgba(0, 0, 0, 0.35)" transform="translate(${n(view.s * 0.18)} ${n(view.s * 0.22)})" filter="url(#bank)"/>`)
  under.push(`<polygon points="${points}" fill="${css(pal.stripes[1])}"/>`)

  // The ground, a pixel a sample, cut to the green: each pixel as much of it as lies inside, sampled 3 by 3,
  // a line at a time. Along a line across the picture (x fixed), the green's edges cross it at a few places
  // down the hole, and a point is inside where an odd number of them lie beyond it.
  const b = boundsOf(def.green)
  const step = 1 / SAMPLES
  const shaded = shadePixels(def, spot, pal)
  const u0 = -b.z1 - step
  const v0 = b.x0 - step
  const g = def.green
  const hits = new Uint8Array(shaded.cols)
  for (let j = 0; j < shaded.rows; j++) {
    hits.fill(0)
    for (let sj = 0; sj < 3; sj++) {
      const x = v0 + (j + (sj + 0.5) / 3) * step
      // Where the edges cross this line, as distances down the hole (u = −z), in order.
      const cross: number[] = []
      for (let a = 0, k = g.length - 1; a < g.length; k = a++) {
        const [xa, za] = g[a]!
        const [xk, zk] = g[k]!
        if (xa > x !== xk > x) cross.push(-(za + ((x - xa) * (zk - za)) / (xk - xa)))
      }
      cross.sort((p, q) => p - q)
      for (let i = 0; i < shaded.cols; i++) {
        for (let si = 0; si < 3; si++) {
          const u = u0 + (i + (si + 0.5) / 3) * step
          let before = 0
          while (before < cross.length && cross[before]! <= u) before++
          if (before % 2 === 1) hits[i]!++
        }
      }
    }
    for (let i = 0; i < shaded.cols; i++) shaded.data[(j * shaded.cols + i) * 4 + 3] = Math.round((hits[i]! / 9) * 255)
  }
  const [left, top] = toPx(view, b.x0 - step, b.z1 + step)
  const ground = {
    url: png(shaded.cols, shaded.rows, shaded.data),
    x: left,
    y: top,
    width: shaded.cols * step * view.s,
    height: shaded.rows * step * view.s,
  }

  // The target, painted on the ground: the outer ring, the ring, the bull, and the lines between.
  const over: string[] = []
  const [tx, ty] = toPx(view, spot.x, spot.z)
  const rings: [number, number][] = [
    [RINGS[2], pal.target.outer],
    [RINGS[1], pal.target.ring],
    [RINGS[0], pal.target.bull],
  ]
  for (const [r, colour] of rings) {
    over.push(circle(tx, ty, r * view.s, css(colour), ` stroke="${css(pal.target.line, 0.8)}" stroke-width="${n(Math.max(0.75, 0.05 * view.s))}"`))
  }
  // Rails: every body first, then every cap along their tops, so the joins run clean.
  const rails = railsOf(def, pal)
  for (const pass of ['body', 'cap'] as const) {
    for (const r of rails) {
      const [x1, y1] = toPx(view, r.a[0], r.a[1])
      const [x2, y2] = toPx(view, r.b[0], r.b[1])
      const wide = pass === 'body' ? Math.max(1.5, r.wide * view.s) : Math.max(0.8, r.wide * 0.42 * view.s)
      over.push(
        `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${pass === 'body' ? r.body : r.cap}" ` +
          `stroke-width="${n(wide)}" stroke-linecap="round"/>`,
      )
    }
  }
  for (const p of def.bumpers ?? []) {
    const [px, py] = toPx(view, p.x, p.z)
    over.push(circle(px + view.s * 0.08, py + view.s * 0.1, p.r * view.s, 'rgba(0, 0, 0, 0.3)'))
    over.push(circle(px, py, p.r * view.s, css(p.rock ? STONE : pal.rubber)))
    over.push(circle(px - p.r * 0.25 * view.s, py - p.r * 0.25 * view.s, p.r * 0.45 * view.s, 'rgba(255, 255, 255, 0.2)'))
  }
  // The ball on the tee.
  const [bx, by] = toPx(view, def.tee.x, def.tee.z)
  const ball = Math.max(2.5, 0.2 * view.s)
  over.push(circle(bx + ball * 0.3, by + ball * 0.35, ball, 'rgba(0, 0, 0, 0.3)'))
  over.push(circle(bx, by, ball, '#ffffff', ' stroke="rgba(20, 30, 40, 0.55)" stroke-width="1"'))

  return { under: svg(width, height, under.join('')), ground, over: svg(width, height, over.join('')) }
}
