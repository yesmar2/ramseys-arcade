import { K, type Family, type Glass } from './glasses'
import type { DayPlan } from './plan'

/*
 * A day of Half Full as a picture: its four glasses on a kitchen shelf and the split's two on the counter
 * under it, all empty, each drawn from its knots the way the game draws it (render.ts). There's no drink
 * in them, no level and no half line, so the picture gives nothing away: it only shows the day's glasses.
 *
 * Today's Pour, the archive and the day's card (scripts/today-cards.mjs, which has no canvas) all draw
 * from it. It's arithmetic and strings, with no DOM, so the build can run it too. The picture comes as
 * layers, one part each, drawn in order: the app colours them from its stylesheet (styles/todaysPour.css,
 * lighter or darker with the theme), and pourPlanSvg colours them from POUR_COLOURS for the build.
 */

/** How squashed the ellipses are, as the game has it: we look down on the counter a little. */
const E = 0.16

/** How far below a glass its stem and foot reach, in the glass's heights, as the game stands them. */
const STEM: Partial<Record<Family, number>> = { bowl: 0.36, flute: 0.2, tulip: 0.24, cone: 0.16 }

export type PourPart =
  | 'wall'
  | 'tiles'
  | 'grout'
  | 'shelf'
  | 'ledge'
  | 'counter'
  | 'front'
  | 'shadow'
  | 'foot'
  | 'glass'
  | 'ink'
  | 'edge'
  | 'glint'

/** The parts drawn as lines; the rest are filled. */
export const POUR_LINES: ReadonlySet<PourPart> = new Set<PourPart>(['grout', 'ink', 'edge', 'glint'])

/** One part of the picture: its path, and a line's width. */
export type PourLayer = { part: PourPart; d: string; width?: number }

export type PourPicture = { width: number; height: number; layers: PourLayer[] }

/** The game's kitchen (render.ts), and a dimmer one for a dark page. styles/todaysPour.css keeps the same pair. */
export const POUR_COLOURS: Record<'light' | 'dark', Record<PourPart, string>> = {
  light: {
    wall: '#fde9d2',
    tiles: 'rgba(255, 255, 255, 0.34)',
    grout: 'rgba(190, 120, 80, 0.2)',
    shelf: '#fffaf3',
    ledge: '#e9c6a2',
    counter: '#48b3a6',
    front: '#2f8b82',
    shadow: 'rgba(90, 40, 20, 0.16)',
    foot: 'rgba(225, 242, 250, 0.85)',
    glass: 'rgba(255, 255, 255, 0.4)',
    ink: '#1a2b3c',
    edge: '#f4fbff',
    glint: 'rgba(255, 255, 255, 0.7)',
  },
  dark: {
    wall: '#4a382c',
    tiles: 'rgba(255, 255, 255, 0.06)',
    grout: 'rgba(0, 0, 0, 0.22)',
    shelf: '#6e5646',
    ledge: '#56412f',
    counter: '#2d7d74',
    front: '#1d5751',
    shadow: 'rgba(0, 0, 0, 0.3)',
    foot: 'rgba(225, 242, 250, 0.6)',
    glass: 'rgba(255, 255, 255, 0.12)',
    ink: '#0d1720',
    edge: 'rgba(236, 246, 252, 0.92)',
    glint: 'rgba(255, 255, 255, 0.5)',
  },
}

/** A number for a path: two places at most. */
const n = (v: number) => String(Math.round(v * 100) / 100)
const pt = (x: number, y: number) => `${n(x)} ${n(y)}`

/** An ellipse as a path: over its far half, then back round its near one. */
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${pt(cx - rx, cy)}A${n(rx)} ${n(ry)} 0 0 1 ${pt(cx + rx, cy)}A${n(rx)} ${n(ry)} 0 0 1 ${pt(cx - rx, cy)}Z`
}

/** How tall a glass stands, rim to foot, in its widest radii (the rim's ellipse above it counted twice, for room). */
function standsTall(g: Glass): number {
  const stem = STEM[g.family] ?? 0
  return g.aspect * (1 + stem + (stem ? 0.025 : 0.05)) + 2 * E
}

/** A glass stood on the counter: its middle, its inside bottom, its widest radius R and inside height H. */
type Placed = { g: Glass; cx: number; yb: number; R: number; H: number; stem: number; base: number; t: number }

function stand(g: Glass, R: number, cx: number, foot: number): Placed {
  const H = g.aspect * R
  const stemF = STEM[g.family] ?? 0
  const stem = stemF * H
  const base = Math.max(0.8, (stemF ? 0.025 : 0.05) * H)
  return { g, cx, yb: foot - stem - base, R, H, stem, base, t: Math.min(2.2, Math.max(0.7, R * 0.05)) }
}

/** An empty glass, as the game draws one: its shadow, its foot or stem, its clear inside, its walls and rim, a glint. */
function glassLayers(p: Placed): PourLayer[] {
  const { g, cx, yb, R, H, stem, base, t } = p
  const radius = (k: number) => (g.r[k]! / 1000) * R
  const at = (k: number) => yb - (k / K) * H
  const left: string[] = []
  const right: string[] = []
  for (let k = 0; k <= K; k++) {
    left.push(pt(cx - radius(k), at(k)))
    right.push(pt(cx + radius(k), at(k)))
  }
  right.reverse()
  const top = radius(K)
  const r0 = radius(0)
  const foot = yb + stem + base
  // Up the left wall, over the far rim, down the right, round the near bottom: what a drink would fill.
  const inside =
    `M${left[0]}${left
      .slice(1)
      .map((q) => `L${q}`)
      .join('')}` +
    `A${n(top)} ${n(E * top)} 0 0 1 ${right[0]}${right
      .slice(1)
      .map((q) => `L${q}`)
      .join('')}` +
    `A${n(r0)} ${n(E * r0)} 0 0 1 ${left[0]}Z`
  // The outline is the inside's, with the rim's near half: empty, the whole rim shows.
  const outline = `${inside}M${right[0]}A${n(top)} ${n(E * top)} 0 0 1 ${left[K]}`

  let footPath: string
  let spread: number
  if (stem > 0) {
    const fr = Math.max(R * 0.58, r0 + t)
    const sw = Math.max(0.8, R * 0.09)
    const low = foot - E * fr * 0.5
    footPath =
      `M${pt(cx - sw / 2, yb + E * r0)}L${pt(cx - sw / 2, low)}L${pt(cx + sw / 2, low)}L${pt(cx + sw / 2, yb + E * r0)}Z` +
      ellipse(cx, foot - E * fr * 0.4, fr, E * fr)
    spread = fr
  } else {
    const rb = r0 + t / 2
    footPath = `M${pt(cx - rb, yb)}L${pt(cx - rb, foot - E * rb)}A${n(rb)} ${n(E * rb)} 0 0 0 ${pt(cx + rb, foot - E * rb)}L${pt(cx + rb, yb)}Z`
    spread = rb
  }
  const shadow = spread * 1.12
  // A glint down the left, following the glass's shape.
  const glint: string[] = []
  for (let k = 8; k <= 42; k++) glint.push(pt(cx - radius(k) * 0.72, at(k)))

  return [
    { part: 'shadow', d: ellipse(cx + shadow * 0.05, foot, shadow, Math.max(0.8, E * shadow * 1.1)) },
    { part: 'foot', d: footPath },
    { part: 'ink', d: footPath, width: Math.max(0.6, t * 0.7) },
    { part: 'glass', d: inside },
    { part: 'ink', d: outline, width: t + 1.4 },
    { part: 'edge', d: outline, width: t },
    { part: 'glint', d: `M${glint.join('L')}`, width: Math.max(0.6, R * 0.05) },
  ]
}

/** How wide a glass stands at widest radius R, a little over, for its shadow. */
const across = (R: number) => 2 * R * 1.08

/** Glasses side by side, `gap` apart and centred on `mid`, their feet at `foot`: no wider than `span`. */
function standRow(row: readonly { g: Glass; R: number }[], gap: number, mid: number, span: number, foot: number): PourLayer[] {
  const long = row.reduce((sum, { R }) => sum + across(R), 0) + gap * (row.length - 1)
  const k = Math.min(1, span / long)
  const layers: PourLayer[] = []
  let x = mid - (long * k) / 2
  for (const { g, R } of row) {
    const w = across(R * k)
    layers.push(...glassLayers(stand(g, R * k, x + w / 2, foot)))
    x += w + gap * k
  }
  return layers
}

/**
 * The day's glasses in a kitchen, in a box `width` by `height`: the four half glasses along a shelf, as
 * tall as the room over it allows (a wide one kept from taking the shelf), and the split's two on the
 * counter below, on one scale, so what they hold compares, the tall one on the day's side.
 */
export function pourPlan(plan: DayPlan, width: number, height: number): PourPicture {
  const counter = height * 0.83
  const lip = (height - counter) * 0.3
  const shelf = height * 0.49
  const ledge = height * 0.022
  // Clear of the tag in the picture's top corner.
  const high = height * 0.18

  const onShelf = shelf + ledge * 0.55
  const room = onShelf - high
  const halves = plan.pours.map((g) => ({ g, R: Math.min(room / standsTall(g), room * 0.36) }))

  const onCounter = counter + lip * 0.55
  const pairRoom = onCounter - (shelf + ledge * 2 + height * 0.045)
  const { A, B, sizeA, sizeB } = plan.split
  const scale = pairRoom / Math.max(standsTall(A) * sizeA, standsTall(B) * sizeB)
  const a = { g: A, R: sizeA * scale }
  const b = { g: B, R: sizeB * scale }

  const tile = height * 0.1
  const tileTop = counter - tile * 2.5
  const grout: string[] = []
  for (let y = counter; y > tileTop; y -= tile) grout.push(`M0 ${n(y)}H${n(width)}`)
  for (let x = (width / 2) % tile; x < width; x += tile) grout.push(`M${n(x)} ${n(tileTop)}V${n(counter)}`)
  const band = (part: PourPart, y0: number, y1: number): PourLayer => ({ part, d: `M0 ${n(y0)}H${n(width)}V${n(y1)}H0Z` })
  return {
    width,
    height,
    layers: [
      band('wall', 0, counter),
      band('tiles', tileTop, counter),
      { part: 'grout', d: grout.join(''), width: Math.max(0.5, height * 0.004) },
      band('shadow', shelf + ledge, shelf + ledge * 1.9),
      band('shelf', shelf, shelf + ledge * 0.55),
      band('ledge', shelf + ledge * 0.55, shelf + ledge),
      band('counter', counter, counter + lip),
      band('front', counter + lip, height),
      ...standRow(halves, room * 0.2, width / 2, width * 0.88, onShelf),
      ...standRow(plan.looks.tallLeft ? [a, b] : [b, a], pairRoom * 0.12, width / 2, width * 0.6, onCounter),
    ],
  }
}

/** The day's glasses as an SVG of its own, `width` by `height` pixels, in the colours given: for the build's cards. */
export function pourPlanSvg(plan: DayPlan, width: number, height: number, colours = POUR_COLOURS.light): string {
  const { layers } = pourPlan(plan, width, height)
  const body = layers
    .map(({ part, d, width: line }) =>
      POUR_LINES.has(part)
        ? `<path d="${d}" fill="none" stroke="${colours[part]}" stroke-width="${n(line ?? 1)}" stroke-linejoin="round" stroke-linecap="round"/>`
        : `<path d="${d}" fill="${colours[part]}"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
}

/** The four half glasses by name, for a day's title: "Party cup, jam jar, fishbowl and sundae glass". */
export function glassNames(plan: DayPlan): string {
  const names = plan.pours.map((g) => g.name)
  const first = names[0] ?? ''
  const lead = first.charAt(0).toUpperCase() + first.slice(1)
  if (names.length < 2) return lead
  return `${[lead, ...names.slice(1, -1)].join(', ')} and ${names[names.length - 1]}`
}

/** "a jam jar", "an hourglass". */
const withA = (name: string) => `${/^(?:[aeiou]|hour)/i.test(name) ? 'an' : 'a'} ${name}`

/** The day's glasses in words, for a picture's label: the four, then the split's two. */
export function glassesWords(plan: DayPlan): string {
  const { A, B } = plan.split
  return `${glassNames(plan)}, then ${withA(A.name)} and ${withA(B.name)} to share a jug between`
}
