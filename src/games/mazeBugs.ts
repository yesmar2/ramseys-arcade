/*
 * Glowberry's bugs (and Crumbtrail's), the maze games' chasers: four bad bugs
 * from Find the Bug's crowd, drawn front on the way that game draws its crowd.
 * Each has a big round head with the face, a hat, a body under it, four arms
 * and legs. Ramsey picked "B" from the "Look-alikes to fix" canvas
 * (2026-10-14, "we could try B"), after asking for whole bugs: "it's hard to
 * tell they are bugs with just their heads".
 *
 * - Snatch, who heads straight for you: a red spotted beetle in a bobble hat,
 *   scowling, with a fang.
 * - Sly, who cuts you off ahead: a violet ant in a beanie and a bandit's mask.
 * - Shady, who works with Snatch: a sky-blue spider in a cap and sunglasses.
 *   He was teal on the canvas; sky keeps him clear of Blip's mint.
 * - Grumble, who wanders, then lunges: an amber wasp in a hard hat.
 *
 * Every part is in a box 100 units tall centred on the bug, feet near y 48
 * and antenna tips near y -50, as a list of shapes, so the game draws them on
 * its canvas (paintBug) and the card art in SVG (GameArt.tsx) from the same
 * drawing. Outlines are Find the Bug's ink; legs and arms are a shade of the
 * bug's own colour inside the ink, so they still show on the dark ground.
 */

export type BugName = 'snatch' | 'sly' | 'shady' | 'grumble'

export type BugPose = {
  /**
   * normal; scared (a glowberry: pale and wide-eyed, or in its own colours
   * with `own` as the fright runs out); dazed (caught, on its way home).
   */
  state: 'normal' | 'scared' | 'dazed'
  own?: boolean
  /** Which way its eyes look, as a step in x and y. */
  look: readonly [number, number]
  /** Which foot is forward: 0 or 1. */
  step: number
  /** Seconds, for the stars round a dazed bug. */
  t?: number
}

export type BugPart =
  | { k: 'path'; d: string; fill: string; line?: number; alpha?: number }
  | { k: 'stroke'; d: string; colour: string; w: number; alpha?: number }
  | { k: 'ell'; x: number; y: number; rx: number; ry: number; fill: string; line?: number; rot?: number; alpha?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; r: number; fill: string; line?: number; alpha?: number }

/** Find the Bug's ink (findbug/critters.ts INK). */
export const BUG_INK = '#1a2b3c'
const CREAM = '#f5dcab'
const BAND = '#f2eadb'
const WINGS = 'rgba(203, 230, 249, 0.8)'
const SHADE = 'rgba(39, 24, 73, 0.18)'
/** Outline weight, in units. */
const O = 3

type Colours = { body: string; dark: string; light: string }

export const BUG_COLOURS: Record<BugName, Colours> = {
  snatch: { body: '#e24139', dark: '#a8322b', light: '#f3897e' },
  sly: { body: '#8a6ad4', dark: '#6a50b8', light: '#b9a5ea' },
  shady: { body: '#4aa8e8', dark: '#2f82c0', light: '#a6d5f5' },
  grumble: { body: '#f5b942', dark: '#cf931f', light: '#fbd88f' },
}

/** A glowberry's fright: every bug pale, still in its own shape and hat. */
const PALE: Colours = { body: '#d6def3', dark: '#a3b1d9', light: '#f1f4fc' }
const MASK = '#3a2a6e'

const n = (v: number) => Math.round(v * 100) / 100
type Pt = readonly [number, number]
const pts = (list: readonly Pt[]) => list.map(([x, y]) => `${n(x)} ${n(y)}`)

/** Parts of one bug, front on, in its 100-unit box. */
export function bugParts(name: BugName, pose: BugPose): BugPart[] {
  const out: BugPart[] = []
  const scared = pose.state === 'scared'
  const dazed = pose.state === 'dazed'
  const c = (scared && !pose.own) || dazed ? PALE : BUG_COLOURS[name]
  const limbC = c.dark
  const [lx, ly] = pose.look

  const limb = (list: readonly Pt[], colour: string, w: number) => {
    const d = `M ${pts(list).join(' L ')}`
    out.push({ k: 'stroke', d, colour: BUG_INK, w: w + O * 1.6 })
    out.push({ k: 'stroke', d, colour, w })
  }
  const arch = (list: readonly Pt[], colour: string, w: number, alpha?: number) => {
    const [a, b, e] = pts(list)
    const d = `M ${a} Q ${b} ${e}`
    out.push({ k: 'stroke', d, colour: BUG_INK, w: w + O * 1.6, alpha })
    out.push({ k: 'stroke', d, colour, w, alpha })
  }
  const shape = (d: string, fill: string, line = O) => out.push({ k: 'path', d, fill, line })
  const ell = (x: number, y: number, rx: number, ry: number, fill: string, line = O, rot?: number) =>
    out.push({ k: 'ell', x, y, rx, ry, fill, line, rot })
  const gloss = (x: number, y: number, rx: number, ry: number, rot: number) =>
    out.push({ k: 'ell', x, y, rx, ry, fill: '#ffffff', line: 0, rot, alpha: 0.55 })
  const antennae = (x0: number, y0: number, bend: Pt, tip: Pt, colour: string) => {
    for (const s of [-1, 1]) {
      out.push({ k: 'stroke', d: `M ${n(s * x0)} ${n(y0)} Q ${n(s * bend[0])} ${n(bend[1])} ${n(s * tip[0])} ${n(tip[1])}`, colour: BUG_INK, w: 2.8 })
      ell(s * tip[0], tip[1], 3.6, 3.6, colour, 2.2)
    }
  }
  const sweat = (x: number, y: number, r: number) =>
    shape(`M ${n(x)} ${n(y - r * 1.6)} Q ${n(x + r)} ${n(y)} ${n(x)} ${n(y + r * 0.6)} Q ${n(x - r)} ${n(y)} ${n(x)} ${n(y - r * 1.6)} Z`, '#9fd8ff', 1.4)

  type Mood = 'angry' | 'sly' | 'shades' | 'grumpy' | 'scared' | 'dizzy'
  const eyes = (y: number, spread: number, r: number, mood: Mood, skin: string) => {
    if (mood === 'shades') {
      const w = r * 2.3
      const h = r * 1.55
      out.push({ k: 'stroke', d: `M ${n(-spread + w * 0.5)} ${n(y - h * 0.25)} Q 0 ${n(y - h * 0.55)} ${n(spread - w * 0.5)} ${n(y - h * 0.25)}`, colour: BUG_INK, w: r * 0.42 })
      for (const s of [-1, 1]) {
        const cx = s * spread
        out.push({ k: 'rect', x: cx - w / 2, y: y - h / 2, w, h, r: h * 0.42, fill: '#202636', line: r * 0.36 })
        out.push({ k: 'stroke', d: `M ${n(cx - w * 0.28)} ${n(y - h * 0.12)} L ${n(cx - w * 0.06)} ${n(y - h * 0.3)}`, colour: '#ffffff', w: r * 0.3, alpha: 0.6 })
      }
      return
    }
    for (const s of [-1, 1]) {
      const cx = s * spread
      if (mood === 'dizzy') {
        const k = r * 0.7
        out.push({ k: 'stroke', d: `M ${n(cx - k)} ${n(y - k)} L ${n(cx + k)} ${n(y + k)} M ${n(cx + k)} ${n(y - k)} L ${n(cx - k)} ${n(y + k)}`, colour: BUG_INK, w: r * 0.45 })
        continue
      }
      const wide = mood === 'scared'
      const rr = wide ? r * 1.12 : r
      ell(cx, y, rr, rr * 1.08, '#ffffff', Math.max(1.6, r * 0.32))
      const pr = wide ? r * 0.28 : r * 0.5
      const px = cx + lx * r * (wide ? 0.15 : 0.38)
      const py = y + ly * r * (wide ? 0.15 : 0.36)
      ell(px, py, pr, pr, BUG_INK, 0)
      if (!wide) ell(px - pr * 0.35, py - pr * 0.35, pr * 0.32, pr * 0.32, '#ffffff', 0)
      if (mood === 'sly' || mood === 'grumpy') {
        // A lid down over the top of the eye, in the skin's colour, its edge inked.
        const ly0 = y + rr * (mood === 'sly' ? 0.12 : -0.05)
        const tilt = mood === 'sly' ? s * -rr * 0.18 : 0
        shape(
          `M ${n(cx - rr * 1.15)} ${n(ly0 - tilt)} L ${n(cx + rr * 1.15)} ${n(ly0 + tilt)} L ${n(cx + rr * 1.15)} ${n(y - rr * 1.3)} L ${n(cx - rr * 1.15)} ${n(y - rr * 1.3)} Z`,
          skin,
          0,
        )
        out.push({ k: 'stroke', d: `M ${n(cx - rr * 1.05)} ${n(ly0 - tilt)} L ${n(cx + rr * 1.05)} ${n(ly0 + tilt)}`, colour: BUG_INK, w: r * 0.42 })
      }
    }
    // Brows: down to the middle in a scowl, flat and heavy in a grump, up in a fright.
    for (const s of [-1, 1]) {
      const cx = s * spread
      if (mood === 'angry') out.push({ k: 'stroke', d: `M ${n(cx + s * r * 1.15)} ${n(y - r * 1.45)} L ${n(cx - s * r * 0.75)} ${n(y - r * 0.55)}`, colour: BUG_INK, w: r * 0.55 })
      if (mood === 'grumpy') out.push({ k: 'stroke', d: `M ${n(cx + s * r * 1.1)} ${n(y - r * 1.05)} L ${n(cx - s * r * 0.85)} ${n(y - r * 1.25)}`, colour: BUG_INK, w: r * 0.5 })
      if (mood === 'scared') out.push({ k: 'stroke', d: `M ${n(cx + s * r * 1.05)} ${n(y - r * 1.35)} L ${n(cx - s * r * 0.7)} ${n(y - r * 1.9)}`, colour: BUG_INK, w: r * 0.42 })
    }
  }
  const mood: Mood = dazed ? 'dizzy' : scared ? 'scared' : ({ snatch: 'angry', sly: 'sly', shady: 'shades', grumble: 'grumpy' } as const)[name]
  const wobble = (x0: number, x1: number, y: number) => {
    const list: Pt[] = []
    for (let i = 0; i <= 6; i++) list.push([x0 + ((x1 - x0) * i) / 6, y + (i % 2 === 0 ? 0 : -2.5)])
    out.push({ k: 'stroke', d: `M ${pts(list).join(' L ')}`, colour: BUG_INK, w: 2.2 })
  }

  // Legs, then the back arms, then wings, then the body, then the front arms, the head and its hat.
  const legL = pose.step ? -2 : 2
  if (name !== 'shady') {
    limb([[-7, 32], [-9, 40], [-10, 46 + legL]], limbC, 5.5)
    ell(-12, 47.5 + legL, 6, 3.4, limbC, 2.4)
    limb([[7, 32], [9, 40], [10, 46 - legL]], limbC, 5.5)
    ell(12, 47.5 - legL, 6, 3.4, limbC, 2.4)
  }
  if (name === 'sly') {
    // An ant's back arms, reaching out low.
    for (const s of [-1, 1]) limb([[s * 8, 16], [s * 24, 24], [s * 30, 34]], limbC, 4.2)
  } else if (name !== 'shady') {
    for (const s of [-1, 1]) limb([[s * 14, 18], [s * 30, 22], [s * 35, 32]], limbC, 4.6)
  }
  if (name === 'grumble') {
    for (const s of [-1, 1]) ell(s * 25, 0, 17, 10, WINGS, 2.4, s * -30)
  }

  if (name === 'snatch') {
    shape('M 0 5 C 17 5 26 15 26 27 C 26 40 15 47 0 47 C -15 47 -26 40 -26 27 C -26 15 -17 5 0 5 Z', c.body)
    out.push({ k: 'stroke', d: 'M 0 6 L 0 46', colour: BUG_INK, w: 2.4 })
    for (const [x, y, r] of [
      [-13, 18, 4],
      [13, 18, 4],
      [-16, 33, 4.4],
      [16, 33, 4.4],
      [-6, 40, 3],
      [6, 40, 3],
    ] as const) {
      ell(x, y, r, r, c === PALE ? PALE.dark : BUG_INK, 0)
    }
    out.push({ k: 'path', d: 'M 26 27 C 26 40 15 47 0 47 L 0 45 C 12 44 21 37 22 26 C 22 18 18 11 12 8 C 21 10 26 18 26 27 Z', fill: SHADE })
    gloss(-14, 13, 3.5, 6, 30)
  } else if (name === 'sly') {
    ell(0, 12, 9, 7.5, c.body)
    ell(0, 31, 16, 15, c.body)
    out.push({ k: 'stroke', d: 'M -14 26 Q 0 31 14 26 M -15 34 Q 0 39 15 34', colour: c.dark, w: 2.4 })
    gloss(-8, 24, 3, 5, 30)
  } else if (name === 'shady') {
    // A spider: the face is on the body, eight legs arching out round it to the ground.
    const knees: Pt[] = [
      [36, -38],
      [45, -26],
      [50, -10],
      [50, 6],
    ]
    const feet = [36, 44, 50, 54]
    for (const s of [-1, 1]) {
      // The back pair first, a shade darker, so the front ones cross over them.
      for (const k of [3, 1, 2, 0]) {
        const swing = (k % 2 === 0 ? 1 : -1) * (pose.step ? 2 : -2)
        const leg: Pt[] = [
          [s * 20, -6 + k * 7],
          [s * knees[k]![0], knees[k]![1]],
          [s * (feet[k]! + swing), 46],
        ]
        if (k % 2 === 1) arch(leg, c === PALE ? '#8794bd' : c.dark, 3.4, 0.8)
        else arch(leg, limbC, 3.8)
      }
    }
  } else {
    shape('M 0 5 C 16 5 22 15 22 27 C 22 40 13 47 0 47 C -13 47 -22 40 -22 27 C -22 15 -16 5 0 5 Z', c.body)
    for (const y of [16, 28, 39]) {
      out.push({ k: 'path', d: `M -21 ${y} Q 0 ${y + 4} 21 ${y} L 20 ${y + 5} Q 0 ${y + 9} -20 ${y + 5} Z`, fill: BUG_INK })
    }
    shape('M -2.4 46 L 0 53 L 2.4 46 Z', BUG_INK, 1.4)
    gloss(-11, 12, 3, 5, 30)
  }

  // Front arms: hands on hips for the bosses, reaching for the sneak.
  if (name !== 'shady') {
    const reach = name === 'sly'
    for (const s of [-1, 1]) {
      const arm: Pt[] = reach
        ? [
            [s * 10, 8],
            [s * 22, 4],
            [s * 30, -4],
          ]
        : [
            [s * 12, 8],
            [s * 25, 12],
            [s * 17, 21],
          ]
      limb(arm, limbC, 4.6)
      ell(arm[2]![0], arm[2]![1], 3.6, 3.6, limbC, 2.2)
    }
  }

  if (name === 'shady') {
    // The spider is all body: a big round one carrying the face, his cap on top.
    ell(0, 10, 30, 30, c.body)
    gloss(-15, -6, 5, 8, 35)
    out.push({ k: 'path', d: 'M 30 10 C 30 27 16 40 0 40 C 13 34 23 24 24 9 C 24 -2 19 -11 10 -17 C 22 -14 30 -3 30 10 Z', fill: SHADE })
    out.push({ k: 'rect', x: -25, y: -21, w: 50, h: 9, r: 4.5, fill: c === PALE ? PALE.light : BAND, line: 2.6 })
    shape('M -24 -17 Q -24 -36 0 -36 Q 24 -36 24 -17 Z', c.body)
    shape('M 14 -21 Q 30 -24 36 -18 Q 30 -15 14 -15 Z', c.body, 2.6)
    ell(-5, -4, 1.6, 1.6, BUG_INK, 0)
    ell(5, -4, 1.6, 1.6, BUG_INK, 0)
    eyes(4, 9, 6.2, mood, c.body)
    if (scared || dazed) wobble(-8, 8, 22)
    else out.push({ k: 'stroke', d: 'M -8 19 Q 2 24 10 16', colour: BUG_INK, w: 2.6 })
    if (scared) sweat(24, -6, 3.4)
    if (dazed) stars(out, 0, -40, 26, pose.t ?? 0)
    return out
  }

  // The head.
  const head = { y: -12, r: 21 }
  antennae(9, head.y - 18, [15, head.y - 32], [20, head.y - 37], c.body)
  ell(0, head.y, head.r, head.r, CREAM)
  out.push({
    k: 'path',
    d: `M ${head.r} ${head.y} A ${head.r} ${head.r} 0 0 1 ${n(-head.r * 0.2)} ${n(head.y + head.r * 0.98)} A ${n(head.r * 1.05)} ${n(head.r * 0.95)} 0 0 0 ${n(head.r * 0.92)} ${n(head.y - head.r * 0.25)} Z`,
    fill: 'rgba(39, 24, 73, 0.12)',
  })
  const fy = head.y + 3
  const mask = c === PALE ? PALE.dark : MASK
  if (name === 'sly') {
    // His mask.
    out.push({
      k: 'path',
      d: `M -21 ${fy - 7} Q 0 ${fy - 11} 21 ${fy - 7} L 22 ${fy + 4} Q 11 ${fy + 8} 0 ${fy + 3} Q -11 ${fy + 8} -22 ${fy + 4} Z`,
      fill: mask,
      line: 2.4,
    })
  }
  eyes(fy - 1, 8.2, 5.6, mood, name === 'sly' ? mask : CREAM)
  const my = head.y + 13
  if (scared || dazed) {
    wobble(-7, 8, my)
    if (scared) sweat(18, head.y - 4, 3.2)
  } else if (name === 'snatch') {
    out.push({ k: 'stroke', d: `M -8 ${my + 1} Q 1 ${my + 5} 9 ${my - 2}`, colour: BUG_INK, w: 2.6 })
    shape(`M 3 ${my + 2.4} L 4.8 ${my + 6.6} L 6.6 ${my + 1.4} Z`, '#ffffff', 1.3)
  } else if (name === 'sly') {
    out.push({ k: 'stroke', d: `M -7 ${my} Q 2 ${my + 5} 10 ${my - 1}`, colour: BUG_INK, w: 2.4 })
  } else {
    out.push({ k: 'stroke', d: `M -7 ${my + 2} Q 0 ${my - 3} 7 ${my + 2}`, colour: BUG_INK, w: 2.6 })
  }

  // Hats.
  const top = head.y - head.r
  if (name === 'snatch') {
    shape(`M -20 ${top + 12} Q -20 ${top - 7} 0 ${top - 7} Q 20 ${top - 7} 20 ${top + 12} Z`, c.body)
    out.push({ k: 'rect', x: -22, y: top + 8, w: 44, h: 8, r: 4, fill: c === PALE ? PALE.light : BAND, line: 2.4 })
    ell(0, top - 9, 5, 5, c.body, 2.4)
  } else if (name === 'sly') {
    shape(`M -20 ${top + 12} Q -20 ${top - 6} 0 ${top - 6} Q 20 ${top - 6} 20 ${top + 12} Z`, c.body)
    out.push({ k: 'stroke', d: `M -8 ${top - 4} L -8 ${top + 11} M 0 ${top - 5} L 0 ${top + 11} M 8 ${top - 4} L 8 ${top + 11}`, colour: c.dark, w: 2 })
    out.push({ k: 'rect', x: -22, y: top + 8, w: 44, h: 7, r: 3.5, fill: c.dark, line: 2.4 })
  } else {
    // A hard hat, for the one who works.
    shape(`M -19 ${top + 11} Q -19 ${top - 8} 0 ${top - 8} Q 19 ${top - 8} 19 ${top + 11} Z`, c.body)
    out.push({ k: 'stroke', d: `M 0 ${top - 8} L 0 ${top + 10}`, colour: BUG_INK, w: 2.2 })
    out.push({ k: 'rect', x: -25, y: top + 8, w: 50, h: 6, r: 3, fill: c.body, line: 2.4 })
  }
  if (dazed) stars(out, 0, top - 4, 24, pose.t ?? 0)
  return out
}

/** Two little stars going round a dazed bug's head. */
function stars(out: BugPart[], cx: number, cy: number, r: number, t: number) {
  for (let i = 0; i < 2; i++) {
    const a = t * 5 + i * Math.PI
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r * 0.32
    const s = 4.6
    const k = s * 0.3
    out.push({
      k: 'path',
      d: `M ${n(x)} ${n(y - s)} L ${n(x + k)} ${n(y - k)} L ${n(x + s)} ${n(y)} L ${n(x + k)} ${n(y + k)} L ${n(x)} ${n(y + s)} L ${n(x - k)} ${n(y + k)} L ${n(x - s)} ${n(y)} L ${n(x - k)} ${n(y - k)} Z`,
      fill: '#ffe27a',
      line: 1.4,
    })
  }
}

// ——————————————————————————————————————————————————————— on a canvas

const path2d = new Map<string, Path2D>()

function pathOf(d: string) {
  let p = path2d.get(d)
  if (!p) {
    if (path2d.size > 800) path2d.clear()
    p = new Path2D(d)
    path2d.set(d, p)
  }
  return p
}

/**
 * A bug on a canvas, `size` pixels tall, centred on (x, y). Lines never go
 * thinner than about a device pixel, so the smallest maze keeps its outlines.
 */
export function paintBug(ctx: CanvasRenderingContext2D, name: BugName, x: number, y: number, size: number, pose: BugPose, alpha = 1) {
  const u = size / 100
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(u, u)
  const m = ctx.getTransform()
  const devicePerUnit = Math.hypot(m.a, m.b) || 1
  const thinnest = 1 / devicePerUnit
  const base = ctx.globalAlpha * alpha
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const p of bugParts(name, pose)) {
    ctx.globalAlpha = base * (p.alpha ?? 1)
    if (p.k === 'stroke') {
      ctx.strokeStyle = p.colour
      ctx.lineWidth = Math.max(p.w, thinnest)
      ctx.stroke(pathOf(p.d))
      continue
    }
    let shape: Path2D
    if (p.k === 'path') {
      shape = pathOf(p.d)
    } else if (p.k === 'ell') {
      shape = new Path2D()
      shape.ellipse(p.x, p.y, p.rx, p.ry, ((p.rot ?? 0) * Math.PI) / 180, 0, Math.PI * 2)
    } else {
      shape = new Path2D()
      shape.roundRect(p.x, p.y, p.w, p.h, p.r)
    }
    ctx.fillStyle = p.fill
    ctx.fill(shape)
    if (p.line) {
      ctx.strokeStyle = BUG_INK
      ctx.lineWidth = Math.max(p.line, thinnest)
      ctx.stroke(shape)
    }
  }
  ctx.restore()
}
