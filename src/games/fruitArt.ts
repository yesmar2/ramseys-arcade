/**
 * The bonus fruit, shared by the maze games: Pellets offers one under its den
 * and Crumbtrail one a few rows up the climb, and they are the same fruit.
 *
 * Seven kinds, drawn to read at a glance at a phone's tile size: a silhouette
 * you know, in its own colour, with an outline a little deeper than its fill.
 */

export type FruitArt = 'cherry' | 'berry' | 'orange' | 'apple' | 'melon' | 'bell' | 'key'

const TAU = Math.PI * 2

function hsla(hue: number, sat: number, light: number, alpha = 1) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

/** Paint one fruit centred on (cx, cy); `u` is about half its height. */
export function paintFruit(
  ctx: CanvasRenderingContext2D,
  kind: FruitArt,
  cx: number,
  cy: number,
  u: number,
  dark: boolean,
) {
  const line = (h: number, s = 70) => hsla(h, s, dark ? 72 : 34, 0.95)
  const fill = (h: number, s = 80, l = 56) => hsla(h, s, l, 0.95)
  const lw = Math.max(1, u * 0.12)
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const shine = (x: number, y: number, r: number) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.fill()
  }
  const leaf = (x: number, y: number, a: number, len: number) => {
    ctx.beginPath()
    ctx.ellipse(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, len * 0.5, len * 0.22, a, 0, TAU)
    ctx.fillStyle = fill(120, 55, 46)
    ctx.fill()
    ctx.strokeStyle = line(120, 50)
    ctx.stroke()
  }

  if (kind === 'cherry') {
    ctx.strokeStyle = line(110, 50)
    ctx.beginPath()
    ctx.moveTo(cx - u * 0.36, cy + u * 0.1)
    ctx.quadraticCurveTo(cx - u * 0.2, cy - u * 0.5, cx + u * 0.3, cy - u * 0.8)
    ctx.moveTo(cx + u * 0.34, cy + u * 0.22)
    ctx.quadraticCurveTo(cx + u * 0.4, cy - u * 0.4, cx + u * 0.3, cy - u * 0.8)
    ctx.stroke()
    leaf(cx + u * 0.3, cy - u * 0.8, -0.4, u * 0.55)
    for (const [bx, by] of [
      [-0.38, 0.38],
      [0.34, 0.5],
    ] as const) {
      ctx.beginPath()
      ctx.arc(cx + bx * u, cy + by * u, u * 0.36, 0, TAU)
      ctx.fillStyle = fill(356, 78, 54)
      ctx.fill()
      ctx.strokeStyle = line(356)
      ctx.stroke()
      shine(cx + (bx - 0.12) * u, cy + (by - 0.12) * u, u * 0.08)
    }
    return
  }

  if (kind === 'berry') {
    ctx.beginPath()
    ctx.moveTo(cx, cy + u * 0.92)
    ctx.bezierCurveTo(cx - u * 0.95, cy + u * 0.25, cx - u * 0.82, cy - u * 0.62, cx, cy - u * 0.46)
    ctx.bezierCurveTo(cx + u * 0.82, cy - u * 0.62, cx + u * 0.95, cy + u * 0.25, cx, cy + u * 0.92)
    ctx.closePath()
    ctx.fillStyle = fill(352, 76, 54)
    ctx.fill()
    ctx.strokeStyle = line(352)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 236, 170, 0.95)'
    for (const [sx, sy] of [
      [-0.3, -0.05],
      [0.3, -0.05],
      [0, 0.18],
      [-0.2, 0.42],
      [0.2, 0.42],
    ] as const) {
      ctx.beginPath()
      ctx.arc(cx + sx * u, cy + sy * u, Math.max(0.8, u * 0.06), 0, TAU)
      ctx.fill()
    }
    for (const a of [-2.4, -1.57, -0.74]) leaf(cx, cy - u * 0.5, a, u * 0.45)
    return
  }

  if (kind === 'orange' || kind === 'apple' || kind === 'melon') {
    const hue = kind === 'orange' ? 30 : kind === 'apple' ? 358 : 118
    const l = kind === 'melon' ? 44 : 55
    ctx.beginPath()
    if (kind === 'apple') {
      ctx.moveTo(cx, cy - u * 0.5)
      ctx.bezierCurveTo(cx + u * 0.5, cy - u * 0.9, cx + u * 1.02, cy - u * 0.2, cx + u * 0.6, cy + u * 0.52)
      ctx.bezierCurveTo(cx + u * 0.4, cy + u * 0.9, cx + u * 0.1, cy + u * 0.8, cx, cy + u * 0.72)
      ctx.bezierCurveTo(cx - u * 0.1, cy + u * 0.8, cx - u * 0.4, cy + u * 0.9, cx - u * 0.6, cy + u * 0.52)
      ctx.bezierCurveTo(cx - u * 1.02, cy - u * 0.2, cx - u * 0.5, cy - u * 0.9, cx, cy - u * 0.5)
    } else {
      ctx.arc(cx, cy + u * 0.08, u * 0.74, 0, TAU)
    }
    ctx.fillStyle = fill(hue, kind === 'melon' ? 55 : 80, l)
    ctx.fill()
    ctx.strokeStyle = line(hue)
    ctx.stroke()
    if (kind === 'melon') {
      ctx.save()
      ctx.clip()
      ctx.strokeStyle = hsla(118, 50, dark ? 28 : 30, 0.8)
      ctx.lineWidth = Math.max(1, u * 0.1)
      for (const k of [-0.5, 0, 0.5]) {
        ctx.beginPath()
        ctx.ellipse(cx + k * u * 0.9, cy + u * 0.08, u * 0.22, u * 0.8, 0, 0, TAU)
        ctx.stroke()
      }
      ctx.restore()
      ctx.strokeStyle = line(hue)
      ctx.lineWidth = lw
    }
    // Stem and a leaf.
    ctx.strokeStyle = line(28, 45)
    ctx.beginPath()
    ctx.moveTo(cx, cy - u * 0.52)
    ctx.quadraticCurveTo(cx + u * 0.04, cy - u * 0.8, cx + u * 0.18, cy - u * 0.92)
    ctx.stroke()
    leaf(cx + u * 0.06, cy - u * 0.7, -0.3, u * 0.5)
    shine(cx - u * 0.3, cy - u * 0.14, u * 0.12)
    return
  }

  if (kind === 'bell') {
    ctx.beginPath()
    ctx.moveTo(cx - u * 0.78, cy + u * 0.55)
    ctx.quadraticCurveTo(cx - u * 0.6, cy + u * 0.3, cx - u * 0.56, cy - u * 0.1)
    ctx.bezierCurveTo(cx - u * 0.52, cy - u * 0.9, cx + u * 0.52, cy - u * 0.9, cx + u * 0.56, cy - u * 0.1)
    ctx.quadraticCurveTo(cx + u * 0.6, cy + u * 0.3, cx + u * 0.78, cy + u * 0.55)
    ctx.closePath()
    ctx.fillStyle = fill(46, 90, 56)
    ctx.fill()
    ctx.strokeStyle = line(40)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy + u * 0.68, u * 0.16, 0, TAU)
    ctx.fillStyle = fill(40, 80, 44)
    ctx.fill()
    ctx.stroke()
    shine(cx - u * 0.24, cy - u * 0.3, u * 0.1)
    return
  }

  // The key: a ring, a shaft, two teeth.
  ctx.strokeStyle = line(196, 40)
  ctx.fillStyle = fill(196, 34, dark ? 74 : 70)
  ctx.beginPath()
  ctx.arc(cx, cy - u * 0.42, u * 0.38, 0, TAU)
  ctx.moveTo(cx + u * 0.16, cy - u * 0.42)
  ctx.arc(cx, cy - u * 0.42, u * 0.16, 0, TAU, true)
  ctx.fill('evenodd')
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(cx - u * 0.1, cy - u * 0.08, u * 0.2, u * 0.98, u * 0.06)
  ctx.rect(cx + u * 0.08, cy + u * 0.46, u * 0.28, u * 0.14)
  ctx.rect(cx + u * 0.08, cy + u * 0.72, u * 0.22, u * 0.14)
  ctx.fill()
  ctx.stroke()
}
