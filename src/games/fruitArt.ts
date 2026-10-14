/**
 * The bonus treats, shared by the maze games: Glowberry offers one under the
 * bugs' nest and Crumbtrail one a few rows up the climb, and they are the same
 * garden. Lowest first: a radish, a carrot, a cob of corn, a tomato, a pear, a
 * pumpkin, and a sunflower at the top. They were Pac-Man's fruit, in its
 * order, down to the bell and the key, which are that game's own; Ramsey
 * asked for the games to be ours (2026-10-14, "fix these issues please").
 *
 * Seven kinds, drawn to read at a glance at a phone's tile size: a silhouette
 * you know, in its own colour, with an outline a little deeper than its fill.
 */

export type FruitArt = 'radish' | 'carrot' | 'corn' | 'tomato' | 'pear' | 'pumpkin' | 'sunflower'

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

  if (kind === 'radish') {
    // A round pink root with its tail, and three leaves up top.
    for (const a of [-2.3, -1.57, -0.84]) leaf(cx, cy - u * 0.42, a, u * 0.62)
    ctx.beginPath()
    ctx.moveTo(cx - u * 0.06, cy + u * 0.66)
    ctx.quadraticCurveTo(cx + u * 0.02, cy + u * 0.86, cx + u * 0.12, cy + u * 0.98)
    ctx.strokeStyle = line(330)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(cx, cy + u * 0.14, u * 0.62, u * 0.58, 0, 0, TAU)
    ctx.fillStyle = fill(332, 72, 58)
    ctx.fill()
    ctx.strokeStyle = line(332)
    ctx.stroke()
    shine(cx - u * 0.26, cy - u * 0.06, u * 0.11)
    return
  }

  if (kind === 'carrot') {
    // A long orange cone, tip down, a few ridges across it, and its fronds.
    for (const a of [-2.1, -1.57, -1.04]) leaf(cx - u * 0.04, cy - u * 0.5, a, u * 0.5)
    ctx.beginPath()
    ctx.moveTo(cx - u * 0.36, cy - u * 0.46)
    ctx.quadraticCurveTo(cx - u * 0.04, cy - u * 0.62, cx + u * 0.32, cy - u * 0.44)
    ctx.quadraticCurveTo(cx + u * 0.26, cy + u * 0.3, cx + u * 0.04, cy + u * 0.98)
    ctx.quadraticCurveTo(cx - u * 0.3, cy + u * 0.3, cx - u * 0.36, cy - u * 0.46)
    ctx.closePath()
    ctx.fillStyle = fill(26, 88, 56)
    ctx.fill()
    ctx.strokeStyle = line(24)
    ctx.stroke()
    ctx.beginPath()
    for (const [y, w] of [
      [-0.12, 0.14],
      [0.18, 0.12],
      [0.46, 0.09],
    ] as const) {
      ctx.moveTo(cx - w * u, cy + y * u)
      ctx.lineTo(cx + w * u * 0.6, cy + (y + 0.04) * u)
    }
    ctx.strokeStyle = hsla(24, 70, dark ? 36 : 40, 0.8)
    ctx.stroke()
    shine(cx - u * 0.14, cy - u * 0.24, u * 0.08)
    return
  }

  if (kind === 'corn') {
    // A yellow cob, its kernels in rows, wrapped in two green husks.
    ctx.beginPath()
    ctx.ellipse(cx, cy - u * 0.04, u * 0.34, u * 0.8, 0, 0, TAU)
    ctx.fillStyle = fill(48, 90, 60)
    ctx.fill()
    ctx.strokeStyle = line(42)
    ctx.stroke()
    ctx.fillStyle = hsla(44, 85, dark ? 44 : 46, 0.75)
    for (let row = 0; row < 5; row++) {
      for (const col of [-1, 0, 1]) {
        ctx.beginPath()
        ctx.arc(cx + col * u * 0.14, cy - u * 0.5 + row * u * 0.22, Math.max(0.7, u * 0.045), 0, TAU)
        ctx.fill()
      }
    }
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx, cy + u * 0.92)
      ctx.quadraticCurveTo(cx + side * u * 0.62, cy + u * 0.5, cx + side * u * 0.42, cy - u * 0.42)
      ctx.quadraticCurveTo(cx + side * u * 0.3, cy + u * 0.36, cx, cy + u * 0.92)
      ctx.closePath()
      ctx.fillStyle = fill(110, 55, 44)
      ctx.fill()
      ctx.strokeStyle = line(110, 50)
      ctx.stroke()
    }
    return
  }

  if (kind === 'tomato') {
    // Round and red, a green star of leaves on top.
    ctx.beginPath()
    ctx.ellipse(cx, cy + u * 0.14, u * 0.74, u * 0.62, 0, 0, TAU)
    ctx.fillStyle = fill(4, 78, 54)
    ctx.fill()
    ctx.strokeStyle = line(4)
    ctx.stroke()
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5
      const b = a + TAU / 10
      ctx.lineTo(cx + Math.cos(a) * u * 0.34, cy - u * 0.42 + Math.sin(a) * u * 0.2)
      ctx.lineTo(cx + Math.cos(b) * u * 0.1, cy - u * 0.42 + Math.sin(b) * u * 0.06)
    }
    ctx.closePath()
    ctx.fillStyle = fill(120, 55, 42)
    ctx.fill()
    ctx.strokeStyle = line(120, 50)
    ctx.stroke()
    shine(cx - u * 0.36, cy - u * 0.02, u * 0.12)
    return
  }

  if (kind === 'pear') {
    // Narrow at the top, round at the foot, a stem and a leaf.
    ctx.beginPath()
    ctx.moveTo(cx, cy - u * 0.62)
    ctx.bezierCurveTo(cx + u * 0.3, cy - u * 0.62, cx + u * 0.28, cy - u * 0.2, cx + u * 0.46, cy + u * 0.08)
    ctx.bezierCurveTo(cx + u * 0.82, cy + u * 0.6, cx + u * 0.5, cy + u * 0.94, cx, cy + u * 0.94)
    ctx.bezierCurveTo(cx - u * 0.5, cy + u * 0.94, cx - u * 0.82, cy + u * 0.6, cx - u * 0.46, cy + u * 0.08)
    ctx.bezierCurveTo(cx - u * 0.28, cy - u * 0.2, cx - u * 0.3, cy - u * 0.62, cx, cy - u * 0.62)
    ctx.closePath()
    ctx.fillStyle = fill(70, 70, 54)
    ctx.fill()
    ctx.strokeStyle = line(68)
    ctx.stroke()
    ctx.strokeStyle = line(28, 45)
    ctx.beginPath()
    ctx.moveTo(cx, cy - u * 0.62)
    ctx.quadraticCurveTo(cx + u * 0.04, cy - u * 0.84, cx + u * 0.14, cy - u * 0.94)
    ctx.stroke()
    leaf(cx + u * 0.06, cy - u * 0.76, -0.4, u * 0.42)
    shine(cx - u * 0.26, cy + u * 0.3, u * 0.12)
    return
  }

  if (kind === 'pumpkin') {
    // Wide and ribbed, deep orange, its stem curling off the top.
    ctx.strokeStyle = line(22)
    for (const [dx, rx] of [
      [-0.42, 0.42],
      [0.42, 0.42],
      [0, 0.44],
    ] as const) {
      ctx.beginPath()
      ctx.ellipse(cx + dx * u, cy + u * 0.18, rx * u, u * 0.6, 0, 0, TAU)
      ctx.fillStyle = fill(24, 82, 52)
      ctx.fill()
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.roundRect(cx - u * 0.1, cy - u * 0.6, u * 0.2, u * 0.26, u * 0.06)
    ctx.fillStyle = fill(30, 45, 36)
    ctx.fill()
    ctx.strokeStyle = line(30, 45)
    ctx.stroke()
    leaf(cx + u * 0.08, cy - u * 0.5, -0.5, u * 0.42)
    shine(cx - u * 0.12, cy - u * 0.04, u * 0.1)
    return
  }

  // The sunflower: ten yellow petals round a brown middle full of seeds.
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10
    ctx.beginPath()
    ctx.ellipse(cx + Math.cos(a) * u * 0.56, cy + Math.sin(a) * u * 0.56, u * 0.3, u * 0.14, a, 0, TAU)
    ctx.fillStyle = fill(48, 92, 58)
    ctx.fill()
    ctx.strokeStyle = line(42)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(cx, cy, u * 0.36, 0, TAU)
  ctx.fillStyle = fill(26, 55, 32)
  ctx.fill()
  ctx.strokeStyle = line(26, 50)
  ctx.stroke()
  ctx.fillStyle = hsla(30, 50, dark ? 56 : 62, 0.8)
  for (const [sx, sy] of [
    [-0.14, -0.1],
    [0.12, -0.14],
    [0, 0.06],
    [-0.12, 0.16],
    [0.16, 0.12],
  ] as const) {
    ctx.beginPath()
    ctx.arc(cx + sx * u, cy + sy * u, Math.max(0.7, u * 0.045), 0, TAU)
    ctx.fill()
  }
}
