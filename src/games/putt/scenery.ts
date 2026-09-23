import { barPath, crownPath, LIGHT, seeded, starPath, type Ctx } from './brush'
import { css, isTree, mix, type Prop, type RGB, type Skin } from './paint'

/*
 * What stands round the course, drawn from above the way the rest of the
 * arcade is drawn: a soft fill in a palette colour inside a clean line of
 * the same colour, a lighter face toward the light, and a shadow cast away
 * from it. The garden's trees and flowers, a formal garden's topiary, urns
 * and fountain, a castle's towers, keep and walls, a beach's palms,
 * umbrellas, shells and boats, a lighthouse, a mountain's snow and its
 * waterfall. Most of it is painted once with the ground; the parts that
 * move — the fountain's jets, the lighthouse's beam, the waterfall, the
 * flags — are drawn each frame by `drawLiveProp`.
 */

const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [0, 0, 0]

/** How tall a thing stands, in field units: its shadow falls this far. */
function propHeight(p: Prop) {
  if (isTree(p)) return 2.2 + p.r * 0.32
  switch (p.kind) {
    case 'bush':
      return 1.1
    case 'stone':
      return 0.7
    case 'topiary':
      return 1.8
    case 'cone':
      return 3
    case 'urn':
      return 1.3
    case 'tower':
      return p.r * 1.4
    case 'keep':
      return p.r * 1.2
    case 'wall':
      return 3.6
    case 'umbrella':
      return 2.6
    case 'boat':
      return 0.5
    case 'lighthouse':
      return p.r * 2.2
    default:
      return 0
  }
}

/**
 * A prop's shadow on the ground under it. Something tall throws a long
 * one: the shape swept from its foot out along the light, filled as one.
 */
export function paintPropShadow(g: Ctx, sk: Skin, p: Prop) {
  const h = propHeight(p)
  if (h <= 0) return
  g.fillStyle = sk.shadow
  const dx = LIGHT.x * h
  const dy = LIGHT.y * h
  const tall = p.kind === 'tower' || p.kind === 'keep' || p.kind === 'lighthouse' || p.kind === 'cone' || p.kind === 'wall'
  const steps = tall ? Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(0.6, p.r * 0.4))) : 0
  g.beginPath()
  for (let k = tall ? 0 : steps; k <= steps; k++) {
    const u = steps ? k / steps : 1
    const x = p.x + dx * u
    const y = p.y + dy * u
    switch (p.kind) {
      case 'pine':
        addStar(g, x, y, p.r, 10, 0.72, p.seed * 6)
        break
      case 'palm':
        addStar(g, x, y, p.r, 8, 0.35, p.seed * 6)
        break
      case 'keep':
        g.rect(x - p.r, y - p.r, p.r * 2, p.r * 2)
        break
      case 'wall':
        addBar(g, x, y, p.angle ?? 0, p.len ?? 0, p.r)
        break
      case 'boat':
        addHull(g, x, y, p.r, p.angle ?? 0)
        break
      case 'topiary':
      case 'cone':
      case 'urn':
      case 'tower':
      case 'umbrella':
      case 'lighthouse':
        g.moveTo(x + p.r, y)
        g.arc(x, y, p.r, 0, Math.PI * 2)
        break
      default:
        addCrown(g, x, y, p.r * (p.kind === 'stone' ? 0.95 : 1), p.seed, 8, 0.07)
    }
  }
  g.fill()
}

/** The same shapes as the brushes draw, added to the path already begun, so several fill as one. */
function addStar(g: Ctx, x: number, y: number, r: number, points: number, inner: number, spin: number) {
  for (let i = 0; i < points * 2; i++) {
    const a = spin + (i / (points * 2)) * Math.PI * 2
    const rr = i % 2 === 0 ? r : r * inner
    if (i === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
}

function addCrown(g: Ctx, x: number, y: number, r: number, seed: number, lumps: number, depth: number) {
  const phase = seed * Math.PI * 2 * 7
  const n = Math.max(24, Math.round(r * 6))
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (1 - depth + depth * 2 * Math.abs(Math.sin((lumps * a + phase) / 2)))
    if (i === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
}

function addBar(g: Ctx, x: number, y: number, angle: number, len: number, half: number) {
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const nx = -uy * half
  const ny = ux * half
  g.moveTo(x + nx, y + ny)
  g.lineTo(x + ux * len + nx, y + uy * len + ny)
  g.lineTo(x + ux * len - nx, y + uy * len - ny)
  g.lineTo(x - nx, y - ny)
  g.closePath()
}

function addHull(g: Ctx, x: number, y: number, r: number, angle: number) {
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const nx = -uy
  const ny = ux
  const w = r * 0.42
  const at = (k: number, m: number) => ({ x: x + ux * k * r + nx * m * w, y: y + uy * k * r + ny * m * w })
  const bow = at(1, 0)
  const s0 = at(-0.9, 0.8)
  const s1 = at(-0.9, -0.8)
  const c0 = at(0.3, 1.25)
  const c1 = at(-1.12, 0)
  const c2 = at(0.3, -1.25)
  g.moveTo(bow.x, bow.y)
  g.quadraticCurveTo(c0.x, c0.y, s0.x, s0.y)
  g.quadraticCurveTo(c1.x, c1.y, s1.x, s1.y)
  g.quadraticCurveTo(c2.x, c2.y, bow.x, bow.y)
  g.closePath()
}

/** A boat's hull from above: pointed at the bow, round at the stern. */
function hullPath(g: Ctx, x: number, y: number, r: number, angle: number) {
  g.beginPath()
  addHull(g, x, y, r, angle)
}

/** A rounded stone: grey from the palette's sky, a lit face and a clean line. */
export function paintStone(g: Ctx, sk: Skin, x: number, y: number, r: number, seed: number) {
  const rnd = seeded(seed, 3)
  const n = 7
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4
    const rr = r * (0.82 + rnd() * 0.22)
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.86 })
  }
  const smooth = () => {
    g.beginPath()
    for (let i = 0; i < n; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % n]!
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      if (i === 0) g.moveTo(mx, my)
      else g.quadraticCurveTo(a.x, a.y, mx, my)
    }
    const a = pts[0]!
    const b = pts[1]!
    g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
    g.closePath()
  }
  smooth()
  g.fillStyle = css(sk.stone)
  g.fill()
  g.save()
  g.clip()
  g.fillStyle = css(sk.stoneLit)
  g.beginPath()
  g.ellipse(x - r * 0.3, y - r * 0.32, r * 0.62, r * 0.48, -0.5, 0, Math.PI * 2)
  g.fill()
  g.restore()
  smooth()
  g.strokeStyle = sk.stoneLine
  g.lineWidth = 0.28
  g.stroke()
}

/** A disc lit from the upper left: the fill, a lighter face, and its line. */
function litDisc(g: Ctx, x: number, y: number, r: number, fill: RGB, lit: RGB, line: string, lineWidth = 0.28) {
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fillStyle = css(fill)
  g.fill()
  g.save()
  g.clip()
  g.beginPath()
  g.arc(x - r * 0.28, y - r * 0.32, r * 0.72, 0, Math.PI * 2)
  g.fillStyle = css(lit)
  g.fill()
  g.restore()
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.strokeStyle = line
  g.lineWidth = lineWidth
  g.stroke()
}

/** Merlons round a ring, the teeth along a castle's parapet. */
function merlonsRound(g: Ctx, x: number, y: number, r: number, n: number, fill: string, line: string) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    g.save()
    g.translate(x + Math.cos(a) * (r - 0.55), y + Math.sin(a) * (r - 0.55))
    g.rotate(a)
    g.beginPath()
    g.rect(-0.55, -0.62, 1.1, 1.24)
    g.fillStyle = fill
    g.fill()
    g.strokeStyle = line
    g.lineWidth = 0.14
    g.stroke()
    g.restore()
  }
}

export function paintProp(g: Ctx, sk: Skin, p: Prop) {
  const rnd = seeded(p.seed)
  switch (p.kind) {
    case 'tree':
    case 'blossom':
    case 'bush': {
      const blossom = p.kind === 'blossom'
      const fill = blossom ? sk.blossom : sk.leaf
      const lit = blossom ? sk.blossomLit : sk.leafLit
      const line = blossom ? sk.blossomLine : sk.leafLine
      const lumps = p.kind === 'bush' ? 6 : 8 + Math.floor(rnd() * 3)
      crownPath(g, p.x, p.y, p.r, p.seed, lumps, 0.075)
      g.fillStyle = css(fill)
      g.fill()
      g.save()
      g.clip()
      // The side toward the light: the same crown, smaller and lighter, drawn up and to the left.
      crownPath(g, p.x - p.r * 0.2, p.y - p.r * 0.26, p.r * 0.7, p.seed + 0.37, lumps - 1, 0.09)
      g.fillStyle = css(lit)
      g.fill()
      g.restore()
      crownPath(g, p.x, p.y, p.r, p.seed, lumps, 0.075)
      g.strokeStyle = line
      g.lineWidth = 0.3
      g.stroke()
      if (p.kind !== 'bush') {
        // Clumps of leaves inside the crown: short arcs of the line colour.
        g.lineWidth = 0.22
        g.strokeStyle = line
        g.globalAlpha = 0.5
        const clumps = 3 + Math.floor(rnd() * 3)
        for (let i = 0; i < clumps; i++) {
          const a = rnd() * Math.PI * 2
          const d = p.r * (0.25 + rnd() * 0.4)
          const cr = p.r * (0.22 + rnd() * 0.14)
          g.beginPath()
          g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, cr, Math.PI * 0.15, Math.PI * 0.95)
          g.stroke()
        }
        g.globalAlpha = 1
      }
      if (blossom) {
        g.fillStyle = css(mix(sk.blossomLit, WHITE, sk.dark ? 0.35 : 0.6), 0.95)
        const n = Math.round(p.r * 1.6)
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2
          const d = Math.sqrt(rnd()) * p.r * 0.85
          g.beginPath()
          g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.32 + rnd() * 0.25, 0, Math.PI * 2)
          g.fill()
        }
      }
      return
    }
    case 'pine': {
      const spin = p.seed * 6
      const points = 10 + Math.floor(rnd() * 3)
      starPath(g, p.x, p.y, p.r, points, 0.74, spin)
      g.fillStyle = css(sk.pine)
      g.fill()
      g.strokeStyle = sk.pineLine
      g.lineWidth = 0.3
      g.lineJoin = 'round'
      g.stroke()
      starPath(g, p.x - p.r * 0.08, p.y - p.r * 0.1, p.r * 0.62, points, 0.7, spin + 0.2)
      g.fillStyle = css(sk.pineLit)
      g.fill()
      starPath(g, p.x - p.r * 0.1, p.y - p.r * 0.12, p.r * 0.3, points - 3, 0.66, spin + 0.5)
      g.fillStyle = css(mix(sk.pineLit, WHITE, sk.dark ? 0.12 : 0.3))
      g.fill()
      return
    }
    case 'palm': {
      // Fronds from the crown, each a long leaf with a lighter rib, and nuts at the heart.
      const n = 7 + Math.floor(rnd() * 3)
      const spin = p.seed * 6
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.3
        const len = p.r * (0.82 + rnd() * 0.2)
        const bend = (rnd() - 0.5) * 0.5
        const ux = Math.cos(a)
        const uy = Math.sin(a)
        const nx = -uy
        const ny = ux
        const tip = { x: p.x + ux * len + nx * bend * len * 0.3, y: p.y + uy * len + ny * bend * len * 0.3 }
        const mid = { x: p.x + ux * len * 0.5 + nx * bend * len * 0.2, y: p.y + uy * len * 0.5 + ny * bend * len * 0.2 }
        const w = p.r * 0.2
        g.beginPath()
        g.moveTo(p.x, p.y)
        g.quadraticCurveTo(mid.x + nx * w * 1.6, mid.y + ny * w * 1.6, tip.x, tip.y)
        g.quadraticCurveTo(mid.x - nx * w * 1.6, mid.y - ny * w * 1.6, p.x, p.y)
        g.closePath()
        g.fillStyle = css(i % 2 ? sk.leaf : sk.leafLit)
        g.fill()
        g.strokeStyle = sk.leafLine
        g.lineWidth = 0.24
        g.stroke()
        g.strokeStyle = css(mix(sk.leafLit, WHITE, sk.dark ? 0.15 : 0.4), 0.8)
        g.lineWidth = 0.16
        g.beginPath()
        g.moveTo(p.x, p.y)
        g.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y)
        g.stroke()
      }
      g.fillStyle = css(mix(sk.wood, BLACK, 0.3))
      for (let i = 0; i < 3; i++) {
        const a = spin + i * 2.1
        g.beginPath()
        g.arc(p.x + Math.cos(a) * 0.7, p.y + Math.sin(a) * 0.7, 0.62, 0, Math.PI * 2)
        g.fill()
      }
      return
    }
    case 'flowers': {
      const n = 3 + Math.floor(rnd() * 4)
      const color = sk.petals[Math.floor(rnd() * sk.petals.length)]!
      // Leaves first, then the heads over them.
      g.fillStyle = css(sk.leafLit, 0.9)
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2
        const d = rnd() * p.r
        g.beginPath()
        g.ellipse(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.75, 0.42, a, 0, Math.PI * 2)
        g.fill()
      }
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2
        const d = Math.sqrt(rnd()) * p.r
        flower(g, sk, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.5 + rnd() * 0.25, rnd() < 0.8 ? color : sk.petals[Math.floor(rnd() * sk.petals.length)]!, rnd() * Math.PI)
      }
      return
    }
    case 'stone':
      paintStone(g, sk, p.x, p.y, p.r, p.seed)
      return
    case 'lily': {
      const notch = rnd() * Math.PI * 2
      g.beginPath()
      g.moveTo(p.x, p.y)
      g.arc(p.x, p.y, p.r, notch + 0.32, notch - 0.32 + Math.PI * 2)
      g.closePath()
      g.fillStyle = css(sk.leafLit, 0.95)
      g.fill()
      g.strokeStyle = sk.leafLine
      g.lineWidth = 0.2
      g.stroke()
      if (rnd() < 0.35) flower(g, sk, p.x, p.y, 0.45, sk.petals[0]!, 0, 6)
      return
    }
    case 'reeds': {
      const n = 4 + Math.floor(rnd() * 3)
      g.lineCap = 'round'
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 1.3
        const len = p.r * (0.7 + rnd() * 0.5)
        const bx = p.x + (rnd() - 0.5) * 1.2
        const by = p.y + (rnd() - 0.5) * 0.8
        g.strokeStyle = sk.leafLine
        g.lineWidth = 0.22
        g.beginPath()
        g.moveTo(bx, by)
        g.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len)
        g.stroke()
        if (rnd() < 0.5) {
          g.fillStyle = css(mix(sk.rail, BLACK, 0.15))
          g.beginPath()
          g.ellipse(bx + Math.cos(a) * len * 0.85, by + Math.sin(a) * len * 0.85, 0.22, 0.55, a + Math.PI / 2, 0, Math.PI * 2)
          g.fill()
        }
      }
      return
    }
    case 'topiary': {
      // A ball of box, clipped close: rounder and tighter than a bush.
      litDisc(g, p.x, p.y, p.r, sk.leaf, sk.leafLit, sk.leafLine)
      g.fillStyle = css(mix(sk.leafLit, WHITE, sk.dark ? 0.1 : 0.3), 0.8)
      for (let i = 0; i < 5; i++) {
        const a = rnd() * Math.PI * 2
        const d = rnd() * p.r * 0.6
        g.beginPath()
        g.arc(p.x - p.r * 0.2 + Math.cos(a) * d, p.y - p.r * 0.2 + Math.sin(a) * d, 0.22, 0, Math.PI * 2)
        g.fill()
      }
      return
    }
    case 'cone': {
      // A cone of yew from above: rings closing to its point, lit on the side toward the light.
      g.beginPath()
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      const grad = g.createLinearGradient(p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r)
      grad.addColorStop(0, css(sk.leafLit))
      grad.addColorStop(1, css(mix(sk.leaf, BLACK, 0.15)))
      g.fillStyle = grad
      g.fill()
      g.strokeStyle = sk.leafLine
      g.lineWidth = 0.28
      g.stroke()
      g.globalAlpha = 0.55
      g.lineWidth = 0.16
      // A spiral cut into it, round to the point.
      g.beginPath()
      for (let t = 0; t <= Math.PI * 5; t += 0.2) {
        const rr = p.r * (1 - t / (Math.PI * 5)) * 0.92
        const px = p.x + Math.cos(t + p.seed * 6) * rr
        const py = p.y + Math.sin(t + p.seed * 6) * rr
        if (t === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.stroke()
      g.globalAlpha = 1
      return
    }
    case 'urn': {
      // A stone urn: its lip, the soil in it, and something growing.
      litDisc(g, p.x, p.y, p.r, sk.stone, sk.stoneLit, sk.stoneLine, 0.24)
      g.beginPath()
      g.arc(p.x, p.y, p.r * 0.66, 0, Math.PI * 2)
      g.fillStyle = css(mix(sk.wood, BLACK, 0.45))
      g.fill()
      crownPath(g, p.x - 0.1, p.y - 0.1, p.r * 0.52, p.seed, 6, 0.1)
      g.fillStyle = css(sk.leafLit)
      g.fill()
      flower(g, sk, p.x - 0.2, p.y - 0.25, 0.32, sk.petals[Math.floor(rnd() * sk.petals.length)]!, 0)
      return
    }
    case 'bed': {
      // A bed of flowers in rows, edged in stone: `len` along `angle`, `r` either side.
      const a = p.angle ?? 0
      const len = p.len ?? p.r * 2
      const x0 = p.x - Math.cos(a) * len * 0.5
      const y0 = p.y - Math.sin(a) * len * 0.5
      barPath(g, x0, y0, a, len, p.r)
      g.fillStyle = css(mix(sk.wood, BLACK, sk.dark ? 0.45 : 0.3))
      g.fill()
      g.strokeStyle = css(sk.stoneLit)
      g.lineWidth = 0.7
      g.stroke()
      g.strokeStyle = sk.stoneLine
      g.lineWidth = 0.18
      g.stroke()
      const ux = Math.cos(a)
      const uy = Math.sin(a)
      const nx = -uy
      const ny = ux
      const rows = Math.max(1, Math.round((p.r * 2) / 1.6) - 1)
      for (let row = 0; row < rows; row++) {
        const m = -p.r + (p.r * 2 * (row + 1)) / (rows + 1)
        const color = sk.petals[(Math.floor(p.seed * 10) + row) % sk.petals.length]!
        for (let k = 0.9; k < len - 0.6; k += 1.5) {
          flower(g, sk, x0 + ux * k + nx * m, y0 + uy * k + ny * m, 0.42, color, k)
        }
      }
      return
    }
    case 'fountain': {
      // The basin's low stone lip; the pedestal and its bowls stand in the water. The jets are live.
      g.beginPath()
      g.arc(p.x, p.y, p.r + 0.35, 0, Math.PI * 2)
      g.strokeStyle = css(sk.stoneLit)
      g.lineWidth = 1.1
      g.stroke()
      g.strokeStyle = sk.stoneLine
      g.lineWidth = 0.18
      g.beginPath()
      g.arc(p.x, p.y, p.r + 0.9, 0, Math.PI * 2)
      g.stroke()
      g.beginPath()
      g.arc(p.x, p.y, p.r - 0.2, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = sk.shadow
      g.beginPath()
      g.arc(p.x + LIGHT.x * 2.4, p.y + LIGHT.y * 2.4, p.r * 0.36, 0, Math.PI * 2)
      g.fill()
      litDisc(g, p.x, p.y, p.r * 0.36, sk.stone, sk.stoneLit, sk.stoneLine, 0.22)
      g.beginPath()
      g.arc(p.x, p.y, p.r * 0.24, 0, Math.PI * 2)
      g.fillStyle = css(sk.water)
      g.fill()
      litDisc(g, p.x, p.y, p.r * 0.13, sk.stone, sk.stoneLit, sk.stoneLine, 0.18)
      return
    }
    case 'tower': {
      // A round tower from above: its parapet and the teeth along it, the roof of the stair, a flagpole.
      litDisc(g, p.x, p.y, p.r, sk.stone, sk.stoneLit, sk.stoneLine, 0.32)
      g.beginPath()
      g.arc(p.x, p.y, p.r - 1.3, 0, Math.PI * 2)
      g.fillStyle = css(mix(sk.stone, BLACK, 0.2))
      g.fill()
      g.strokeStyle = sk.stoneLine
      g.lineWidth = 0.18
      g.stroke()
      merlonsRound(g, p.x, p.y, p.r, Math.max(8, Math.round(p.r * 2.2)), css(sk.stoneLit), sk.stoneLine)
      g.beginPath()
      g.rect(p.x - p.r * 0.2, p.y + p.r * 0.1, p.r * 0.34, p.r * 0.3)
      g.fillStyle = css(mix(sk.wood, BLACK, 0.3))
      g.fill()
      return
    }
    case 'keep': {
      // A square keep: its walls' walk, the teeth, a red roof over the middle rising to a ridge.
      const r = p.r
      g.beginPath()
      g.rect(p.x - r, p.y - r, r * 2, r * 2)
      g.fillStyle = css(sk.stone)
      g.fill()
      g.strokeStyle = sk.stoneLine
      g.lineWidth = 0.32
      g.stroke()
      g.fillStyle = css(sk.stoneLit)
      for (let k = -r + 0.4; k < r - 0.6; k += 2.2) {
        for (const [dx, dy, w, h] of [
          [k, -r, 1.2, 1.1],
          [k, r - 1.1, 1.2, 1.1],
          [-r, k, 1.1, 1.2],
          [r - 1.1, k, 1.1, 1.2],
        ] as const) {
          g.beginPath()
          g.rect(p.x + dx, p.y + dy, w, h)
          g.fill()
          g.lineWidth = 0.12
          g.stroke()
        }
      }
      const inner = r - 2.4
      const grad = g.createLinearGradient(p.x - inner, p.y - inner, p.x + inner, p.y + inner)
      grad.addColorStop(0, css(sk.roofLit))
      grad.addColorStop(1, css(sk.roofShade))
      g.beginPath()
      g.rect(p.x - inner, p.y - inner, inner * 2, inner * 2)
      g.fillStyle = grad
      g.fill()
      g.strokeStyle = sk.roofLine
      g.lineWidth = 0.26
      g.stroke()
      // The hips of the roof, up to its ridge.
      g.beginPath()
      g.moveTo(p.x - inner, p.y - inner)
      g.lineTo(p.x - inner * 0.3, p.y)
      g.lineTo(p.x - inner, p.y + inner)
      g.moveTo(p.x + inner, p.y - inner)
      g.lineTo(p.x + inner * 0.3, p.y)
      g.lineTo(p.x + inner, p.y + inner)
      g.moveTo(p.x - inner * 0.3, p.y)
      g.lineTo(p.x + inner * 0.3, p.y)
      g.stroke()
      return
    }
    case 'wall': {
      // A curtain wall: its walk, and the teeth along the outer side.
      const a = p.angle ?? 0
      const len = p.len ?? 0
      barPath(g, p.x, p.y, a, len, p.r)
      g.fillStyle = css(sk.stone)
      g.fill()
      g.strokeStyle = sk.stoneLine
      g.lineWidth = 0.3
      g.stroke()
      barPath(g, p.x, p.y, a, len, p.r * 0.45)
      g.fillStyle = css(mix(sk.stone, BLACK, 0.12))
      g.fill()
      const ux = Math.cos(a)
      const uy = Math.sin(a)
      const nx = -uy
      const ny = ux
      g.fillStyle = css(sk.stoneLit)
      g.lineWidth = 0.12
      for (let k = 0.6; k < len - 0.6; k += 2.2) {
        for (const side of [-1, 1]) {
          const cx = p.x + ux * (k + 0.55) + nx * side * (p.r - 0.55)
          const cy = p.y + uy * (k + 0.55) + ny * side * (p.r - 0.55)
          g.save()
          g.translate(cx, cy)
          g.rotate(a)
          g.beginPath()
          g.rect(-0.55, -0.5, 1.1, 1)
          g.fill()
          g.stroke()
          g.restore()
        }
      }
      return
    }
    case 'umbrella': {
      // A beach umbrella: panels in turn, a colour and white, round a knob.
      const n = 8
      const hue = sk.petals[Math.floor(rnd() * sk.petals.length)]!
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + p.seed
        const a1 = ((i + 1) / n) * Math.PI * 2 + p.seed
        g.beginPath()
        g.moveTo(p.x, p.y)
        g.arc(p.x, p.y, p.r, a0, a1)
        g.closePath()
        g.fillStyle = i % 2 ? hue : sk.dark ? 'rgba(232, 236, 240, 0.95)' : 'rgba(255, 255, 255, 0.98)'
        g.fill()
      }
      g.beginPath()
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      g.strokeStyle = css(sk.ink, 0.35)
      g.lineWidth = 0.2
      g.stroke()
      g.beginPath()
      g.arc(p.x, p.y, 0.4, 0, Math.PI * 2)
      g.fillStyle = css(sk.ink, 0.6)
      g.fill()
      return
    }
    case 'shell': {
      if (rnd() < 0.4) {
        // A starfish.
        starPath(g, p.x, p.y, p.r * 1.3, 5, 0.42, p.seed * 6)
        g.fillStyle = sk.petals[1]!
        g.fill()
        g.strokeStyle = sk.line('orange', 0.9)
        g.lineWidth = 0.16
        g.stroke()
        return
      }
      // A scallop: a fan of ribs.
      const a = p.seed * 6
      g.beginPath()
      g.moveTo(p.x, p.y)
      g.arc(p.x, p.y, p.r, a - 1.1, a + 1.1)
      g.closePath()
      g.fillStyle = sk.dark ? 'rgba(236, 214, 206, 0.9)' : 'rgba(250, 232, 222, 1)'
      g.fill()
      g.strokeStyle = sk.line('pink', 0.8)
      g.lineWidth = 0.14
      g.stroke()
      for (let k = -2; k <= 2; k++) {
        g.beginPath()
        g.moveTo(p.x, p.y)
        g.lineTo(p.x + Math.cos(a + k * 0.42) * p.r, p.y + Math.sin(a + k * 0.42) * p.r)
        g.stroke()
      }
      return
    }
    case 'boat': {
      // A rowing boat at its mooring: planked hull, two thwarts, the oars shipped.
      const a = p.angle ?? 0
      hullPath(g, p.x, p.y, p.r, a)
      g.fillStyle = css(sk.wood)
      g.fill()
      g.strokeStyle = sk.woodLine
      g.lineWidth = 0.26
      g.stroke()
      hullPath(g, p.x - Math.cos(a) * 0.1, p.y - Math.sin(a) * 0.1, p.r * 0.8, a)
      g.fillStyle = css(mix(sk.wood, BLACK, 0.2))
      g.fill()
      const ux = Math.cos(a)
      const uy = Math.sin(a)
      const nx = -uy
      const ny = ux
      g.strokeStyle = css(sk.woodLit)
      g.lineWidth = 0.55
      for (const k of [-0.35, 0.2]) {
        g.beginPath()
        g.moveTo(p.x + ux * k * p.r + nx * p.r * 0.34, p.y + uy * k * p.r + ny * p.r * 0.34)
        g.lineTo(p.x + ux * k * p.r - nx * p.r * 0.34, p.y + uy * k * p.r - ny * p.r * 0.34)
        g.stroke()
      }
      g.strokeStyle = css(mix(sk.woodLit, WHITE, 0.2))
      g.lineWidth = 0.22
      g.beginPath()
      g.moveTo(p.x - ux * p.r * 0.6 + nx * p.r * 0.1, p.y - uy * p.r * 0.6 + ny * p.r * 0.1)
      g.lineTo(p.x + ux * p.r * 0.5 + nx * p.r * 0.2, p.y + uy * p.r * 0.5 + ny * p.r * 0.2)
      g.stroke()
      return
    }
    case 'lighthouse': {
      // From above: the white tower's top, the red band of its gallery with the rail round it, and the
      // glass lamp room in the middle. The beam is live.
      const r = p.r
      litDisc(g, p.x, p.y, r, mix(sk.field, WHITE, sk.dark ? 0.72 : 0.96), WHITE, sk.stoneLine, 0.3)
      g.beginPath()
      g.arc(p.x, p.y, r * 0.78, 0, Math.PI * 2)
      g.fillStyle = css(sk.roof)
      g.fill()
      g.strokeStyle = sk.roofLine
      g.lineWidth = 0.24
      g.stroke()
      g.strokeStyle = css(sk.ink, 0.55)
      g.lineWidth = 0.14
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2
        g.beginPath()
        g.moveTo(p.x + Math.cos(a) * r * 0.62, p.y + Math.sin(a) * r * 0.62)
        g.lineTo(p.x + Math.cos(a) * r * 0.76, p.y + Math.sin(a) * r * 0.76)
        g.stroke()
      }
      g.beginPath()
      g.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2)
      g.stroke()
      g.beginPath()
      g.arc(p.x, p.y, r * 0.46, 0, Math.PI * 2)
      g.fillStyle = sk.dark ? 'rgba(255, 226, 150, 0.95)' : 'rgba(255, 236, 170, 1)'
      g.fill()
      g.strokeStyle = sk.line('amber', 0.9)
      g.lineWidth = 0.2
      g.stroke()
      g.beginPath()
      g.arc(p.x, p.y, r * 0.2, 0, Math.PI * 2)
      g.fillStyle = css(sk.roofShade)
      g.fill()
      return
    }
    case 'snow': {
      crownPath(g, p.x, p.y, p.r, p.seed, 5, 0.12)
      g.fillStyle = sk.dark ? 'rgba(214, 228, 240, 0.8)' : 'rgba(255, 255, 255, 0.95)'
      g.fill()
      g.strokeStyle = sk.dark ? 'rgba(160, 190, 214, 0.5)' : 'rgba(150, 190, 220, 0.6)'
      g.lineWidth = 0.22
      g.stroke()
      crownPath(g, p.x + p.r * 0.2, p.y + p.r * 0.25, p.r * 0.5, p.seed + 0.5, 5, 0.12)
      g.fillStyle = sk.dark ? 'rgba(170, 196, 222, 0.35)' : 'rgba(200, 222, 240, 0.6)'
      g.fill()
      return
    }
    case 'waterfall': {
      // The lip the water pours over: a ledge of rock across it. The water is live.
      const a = p.angle ?? Math.PI / 2
      const nx = -Math.sin(a)
      const ny = Math.cos(a)
      for (let k = -p.r - 2; k <= p.r + 2; k += 1.6) {
        const s = 1 + rnd() * 0.9
        const x = p.x + nx * k + Math.cos(a) * (rnd() - 0.8) * 1.2
        const y = p.y + ny * k + Math.sin(a) * (rnd() - 0.8) * 1.2
        paintStone(g, sk, x, y, s, rnd())
      }
      return
    }
  }
}

/** A flower seen from above: petals round a yellow heart. */
function flower(g: Ctx, sk: Skin, x: number, y: number, size: number, color: string, turn: number, petals = 5) {
  g.fillStyle = color
  for (let k = 0; k < petals; k++) {
    const pa = turn + (k / petals) * Math.PI * 2
    g.beginPath()
    g.arc(x + Math.cos(pa) * size, y + Math.sin(pa) * size, size * 0.72, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = sk.dark ? 'rgba(255, 236, 170, 0.95)' : 'rgba(255, 244, 200, 1)'
  g.beginPath()
  g.arc(x, y, size * 0.5, 0, Math.PI * 2)
  g.fill()
}

/** Whether a prop has parts that move, to be drawn every frame. */
export function isLive(p: Prop) {
  return p.kind === 'fountain' || p.kind === 'lighthouse' || p.kind === 'waterfall' || p.kind === 'tower' || p.kind === 'keep' || p.kind === 'boat'
}

/** The parts of a prop that move: jets, a beam, falling water, flags, a boat's wake. */
export function drawLiveProp(g: Ctx, sk: Skin, p: Prop, clock: number) {
  switch (p.kind) {
    case 'fountain': {
      // Jets arching out from the top bowl and falling back into the basin, and rings where they land.
      const n = 8
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.2
        const reach = p.r * 0.72
        for (let k = 0; k < 7; k++) {
          const u = ((clock * 0.9 + k / 7 + i * 0.13) % 1 + 1) % 1
          const d = p.r * 0.14 + u * reach
          const lift = Math.sin(u * Math.PI) * 1.6
          const x = p.x + Math.cos(a) * d - LIGHT.x * lift * 0.4
          const y = p.y + Math.sin(a) * d - LIGHT.y * lift * 0.4
          g.fillStyle = sk.dark ? `rgba(210, 236, 255, ${0.75 * (1 - u * 0.5)})` : `rgba(255, 255, 255, ${0.9 * (1 - u * 0.5)})`
          g.beginPath()
          g.arc(x, y, 0.24 + lift * 0.08, 0, Math.PI * 2)
          g.fill()
        }
        const ring = (clock * 1.3 + i * 0.37) % 1
        g.strokeStyle = sk.dark ? `rgba(200, 235, 255, ${0.5 * (1 - ring)})` : `rgba(255, 255, 255, ${0.7 * (1 - ring)})`
        g.lineWidth = 0.16
        g.beginPath()
        g.arc(p.x + Math.cos(a) * (p.r * 0.86), p.y + Math.sin(a) * (p.r * 0.86), 0.3 + ring * 1.2, 0, Math.PI * 2)
        g.stroke()
      }
      // The plume rising from the top.
      for (let k = 0; k < 6; k++) {
        const u = ((clock * 1.4 + k / 6) % 1 + 1) % 1
        g.fillStyle = sk.dark ? `rgba(220, 240, 255, ${0.8 * (1 - u)})` : `rgba(255, 255, 255, ${0.95 * (1 - u)})`
        g.beginPath()
        g.arc(p.x - LIGHT.x * u * 1.2, p.y - LIGHT.y * u * 1.2, 0.3 + u * 0.4, 0, Math.PI * 2)
        g.fill()
      }
      return
    }
    case 'lighthouse': {
      // The beam turning: a long wedge of light, brighter near the lamp.
      const a = clock * 0.9
      const len = 70
      for (const turn of [0, Math.PI]) {
        const grad = g.createRadialGradient(p.x, p.y, p.r * 0.4, p.x, p.y, len)
        grad.addColorStop(0, sk.dark ? 'rgba(255, 232, 160, 0.4)' : 'rgba(255, 236, 170, 0.34)')
        grad.addColorStop(1, 'rgba(255, 232, 160, 0)')
        g.fillStyle = grad
        g.beginPath()
        g.moveTo(p.x, p.y)
        g.arc(p.x, p.y, len, a + turn - 0.16, a + turn + 0.16)
        g.closePath()
        g.fill()
      }
      g.beginPath()
      g.arc(p.x, p.y, p.r * 0.46, 0, Math.PI * 2)
      g.fillStyle = `rgba(255, 240, 190, ${0.35 + 0.25 * Math.sin(clock * 3)})`
      g.fill()
      return
    }
    case 'waterfall': {
      // White water streaming down past the lip, and foam where it lands.
      const a = p.angle ?? Math.PI / 2
      const ux = Math.cos(a)
      const uy = Math.sin(a)
      const nx = -uy
      const ny = ux
      g.lineCap = 'round'
      for (let i = 0; i < 12; i++) {
        const m = -p.r + (p.r * 2 * (i + 0.5)) / 12
        const u = ((clock * 1.6 + i * 0.37) % 1 + 1) % 1
        const k0 = 1 + u * p.r * 1.6
        g.strokeStyle = sk.dark ? `rgba(220, 240, 255, ${0.8 * (1 - u)})` : `rgba(255, 255, 255, ${0.95 * (1 - u)})`
        g.lineWidth = 0.4
        g.beginPath()
        g.moveTo(p.x + nx * m + ux * k0, p.y + ny * m + uy * k0)
        g.lineTo(p.x + nx * m + ux * (k0 + 2.4), p.y + ny * m + uy * (k0 + 2.4))
        g.stroke()
      }
      for (let i = 0; i < 9; i++) {
        const u = ((clock * 0.8 + i * 0.29) % 1 + 1) % 1
        const m = -p.r + (p.r * 2 * i) / 8
        g.fillStyle = sk.dark ? `rgba(230, 244, 255, ${0.5 * (1 - u)})` : `rgba(255, 255, 255, ${0.8 * (1 - u)})`
        g.beginPath()
        g.arc(p.x + nx * m + ux * (p.r * 1.7 + u * 3), p.y + ny * m + uy * (p.r * 1.7 + u * 3), 0.5 + u, 0, Math.PI * 2)
        g.fill()
      }
      return
    }
    case 'tower':
    case 'keep': {
      // A flag at the top, rippling. On a tower it flies from the stair roof, on a keep from the ridge.
      const fx = p.x + (p.kind === 'keep' ? p.r * 0.3 : -p.r * 0.05)
      const fy = p.y + (p.kind === 'keep' ? 0 : p.r * 0.2)
      if (p.seed > (p.kind === 'keep' ? 0 : 0.45)) return
      const w = p.kind === 'keep' ? 5 : 3.6
      const h = w * 0.55
      g.strokeStyle = css(sk.ink, 0.7)
      g.lineWidth = 0.2
      g.beginPath()
      g.arc(fx, fy, 0.3, 0, Math.PI * 2)
      g.stroke()
      g.beginPath()
      g.moveTo(fx, fy)
      for (let i = 1; i <= 6; i++) {
        const u = i / 6
        g.lineTo(fx + w * u, fy - h * 0.5 + Math.sin(clock * 5 - u * 4) * 0.35 * u)
      }
      for (let i = 6; i >= 0; i--) {
        const u = i / 6
        g.lineTo(fx + w * u, fy + h * 0.5 + Math.sin(clock * 5 - u * 4) * 0.35 * u)
      }
      g.closePath()
      g.fillStyle = sk.petals[p.kind === 'keep' ? 3 : 2]!
      g.fill()
      g.strokeStyle = css(sk.ink, 0.35)
      g.lineWidth = 0.14
      g.stroke()
      return
    }
    case 'boat': {
      // Rings of wake lapping round the hull as it rides at its mooring.
      const u = (clock * 0.5 + p.seed) % 1
      g.strokeStyle = sk.dark ? `rgba(200, 235, 255, ${0.4 * (1 - u)})` : `rgba(255, 255, 255, ${0.7 * (1 - u)})`
      g.lineWidth = 0.2
      g.beginPath()
      g.ellipse(p.x, p.y, p.r * (1.1 + u * 0.6), p.r * (0.55 + u * 0.4), p.angle ?? 0, 0, Math.PI * 2)
      g.stroke()
      return
    }
  }
}
