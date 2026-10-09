/*
 * A day's gauntlet as a picture: its rounds in order as a trail of round badges at dusk, each badge with the
 * round's own small drawing in the game's colour code (jump the orange, dive under the purple, red bonks,
 * teal bounces, green helps, indigo pushes), its tier as pips under it, and the trail ending in the Blip star,
 * mint with the glowing blip at its centre, over the teal soda sea. Blip, your mint runner with its spark, waits
 * at the start. It needs only the plan's row (dailyPlan.ts: the round code `k`), no
 * engine, so the home row, Today's Gauntlet, the past gauntlets, the Gauntlet Book, the tomorrow tease and the
 * day's share card (scripts/today-cards.mjs, at build) all draw it from the same few letters.
 *
 * The picture is a list of plain SVG marks, so React draws it (GauntletDrawing.tsx) and the share card takes it
 * as text (gauntletSvg) from the one layout. Like every day picture on the site it's drawn in the dark look
 * whatever the theme.
 */

/** The plan's round letters (contract: dailyPlan.ts `k`): the rounds, then the finales in capitals. */
export type RoundLetter = 'g' | 'b' | 's' | 'h' | 'f' | 'w' | 'x' | 'l' | 'r' | 'n' | 'C' | 'S'

export type RoundInfo = {
  name: string
  /** Two or three words on what you do in it, for a chip: "Pad Hop · hop the pads". Never an answer. */
  hint: string
  finale: boolean
}

/** The names players see, the same as the engine's rounds (engine/rounds/*.ts ROUND name and hint). */
export const ROUNDS: Record<RoundLetter, RoundInfo> = {
  g: { name: 'Slam Doors', hint: 'time the doors', finale: false },
  b: { name: 'Wall Rush', hint: 'find the gap', finale: false },
  s: { name: 'Sweeper Spin', hint: 'hop the bars', finale: false },
  h: { name: 'Bonk Alley', hint: 'dodge the swings', finale: false },
  f: { name: 'Melon Hill', hint: 'climb the belt', finale: false },
  w: { name: 'Tippy Planks', hint: 'stay on the stripe', finale: false },
  x: { name: 'Crumble Tiles', hint: 'keep moving', finale: false },
  l: { name: 'Pad Hop', hint: 'hop the pads', finale: false },
  r: { name: 'Barrel Roll', hint: 'run the barrels', finale: false },
  n: { name: 'Gust Gaps', hint: 'wait out the wind', finale: false },
  C: { name: 'Star Peak', hint: 'grab the star', finale: true },
  S: { name: 'Tide Tower', hint: 'beat the rising sea', finale: true },
}

export type GauntletRound = RoundInfo & { letter: RoundLetter; tier: number }

/** A round code's rounds in course order, finale last: "g1w2h2l2C2" → Slam Doors T1, Tippy Planks T2, … */
export function gauntletRounds(k: string): GauntletRound[] {
  const rounds: GauntletRound[] = []
  for (const [, letter, tier] of k.matchAll(/([a-zA-Z])(\d)/g)) {
    const info = ROUNDS[letter as RoundLetter]
    if (info) rounds.push({ ...info, letter: letter as RoundLetter, tier: Number(tier) })
  }
  return rounds
}

/** "Slam Doors · Tippy Planks · Bonk Alley · Pad Hop · Star Peak". */
export const roundsWords = (k: string) =>
  gauntletRounds(k)
    .map((r) => r.name)
    .join(' · ')

/* ---------- marks ---------- */

type Attrs = Record<string, string | number>
/** One SVG element: its tag, its attributes as SVG spells them (stroke-width), and what's inside a group. */
export type Mark = { t: 'g' | 'path' | 'circle' | 'ellipse' | 'rect' | 'linearGradient' | 'radialGradient' | 'stop'; a: Attrs; c?: Mark[] }

const n2 = (v: number) => Math.round(v * 100) / 100
const path = (d: string, a: Attrs): Mark => ({ t: 'path', a: { d, ...a } })
const circle = (cx: number, cy: number, r: number, a: Attrs): Mark => ({ t: 'circle', a: { cx: n2(cx), cy: n2(cy), r: n2(r), ...a } })
const ellipse = (cx: number, cy: number, rx: number, ry: number, a: Attrs): Mark => ({ t: 'ellipse', a: { cx: n2(cx), cy: n2(cy), rx: n2(rx), ry: n2(ry), ...a } })
const rect = (x: number, y: number, w: number, h: number, a: Attrs): Mark => ({ t: 'rect', a: { x: n2(x), y: n2(y), width: n2(w), height: n2(h), ...a } })
const group = (a: Attrs, c: Mark[]): Mark => ({ t: 'g', a, c })

/** The site's look: a saturated outline over a soft wash of the same colour. */
const wash = (colour: string, alpha = 0.45, width = 1.2): Attrs => ({
  fill: colour,
  'fill-opacity': alpha,
  stroke: colour,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
})
const solid = (colour: string, edge?: string, width = 0.8): Attrs => (edge ? { fill: colour, stroke: edge, 'stroke-width': width, 'stroke-linejoin': 'round' } : { fill: colour })
const stroke = (colour: string, width: number, opacity = 1): Attrs => ({
  fill: 'none',
  stroke: colour,
  'stroke-width': width,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  ...(opacity < 1 ? { opacity } : {}),
})

/** The colour code, the same in every theme and every day (design-final §1.5), and Blip's, the star's and the sea's. */
export const GAUNTLET_COLOURS = {
  jump: '#f2813a',
  dive: '#8a6ad4',
  dodge: '#e8564f',
  bouncy: '#3ec8cf',
  helps: '#3ecf8e',
  pushes: '#6b74e8',
  amber: '#f5b942',
  gold: '#f4c53e',
  white: '#f6f1ff',
  blue: '#4cb8f0',
  /** Floors: the candy pastels. */
  pink: '#ffd3ea',
  lemon: '#fff1b8',
  mint: '#c8f3e1',
  jelly: '#ff9ccc',
  /** The Blip star at the top: mint, a lighter star inside, the glowing white blip at its centre. */
  star: '#34c6a8',
  starInner: '#7ff0d6',
  starEdge: '#bff7ee',
  starGlow: '#6ff0d2',
  spark: '#f2fffb',
  /** The soda sea below: teal, deeper further down, a light rim and its bubbles. */
  sea: '#1fa6a0',
  seaDeep: '#178a86',
  seaRim: '#bff7ee',
  bubble: '#dffbf6',
  ink: '#1a1033',
}
const K = GAUNTLET_COLOURS

/** Blip's colours: its body, the shade under its belly, its feet and its spark's glow. */
export type BlipColours = { body: string; shade: string; feet: string; glow: string }
export const BLIP: BlipColours = { body: '#34c6a8', shade: '#1f9b84', feet: '#167a69', glow: '#9ff7e2' }

/** A five-point star about (cx, cy), `r` to its points, as a path. */
function starPath(cx: number, cy: number, r: number, inner = 0.42): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI / 5) * i
    const at = i % 2 === 0 ? r : r * inner
    return `${n2(cx + at * Math.cos(a))} ${n2(cy + at * Math.sin(a))}`
  })
  return `M${pts.join(' L')} Z`
}

/** A small Blip star, for a finale's summit: its glow, the mint star and the blip at its centre. */
function smallStar(cx: number, cy: number, r: number): Mark[] {
  return [
    circle(cx, cy, r * 1.45, { fill: K.starGlow, 'fill-opacity': 0.16 }),
    path(starPath(cx, cy, r), solid(K.star, K.starEdge, Math.max(0.3, r * 0.22))),
    circle(cx, cy, r * 0.3, solid(K.spark)),
  ]
}

/** A pointy-topped hexagon. */
function hex(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return `${n2(cx + r * Math.cos(a))} ${n2(cy + r * Math.sin(a))}`
  })
  return `M${pts.join(' L')} Z`
}

/** A chevron at (x, y) pointing along the angle `deg` (0 is +x), `s` long. */
function chevron(x: number, y: number, deg: number, s: number): string {
  const a = (deg * Math.PI) / 180
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  const tip = [x + ux * s * 0.5, y + uy * s * 0.5]
  const back = [x - ux * s * 0.5, y - uy * s * 0.5]
  const wing = s * 0.7
  return `M${n2(back[0]! - uy * wing)} ${n2(back[1]! + ux * wing)} L${n2(tip[0]!)} ${n2(tip[1]!)} L${n2(back[0]! + uy * wing)} ${n2(back[1]! - ux * wing)}`
}

/**
 * Each round's drawing, in a box 20 across centred on 0 (y down): what you see first as it comes into view,
 * in its colours. The finales too, and the Blip star at the end.
 */
const ICONS: Record<RoundLetter | 'star', () => Mark[]> = {
  // Slam Doors: a white door frame, its pink jelly door slid up into the header, the lamp over it green, and a
  // green chevron through it: the way is open.
  g: () => [
    circle(0, -9.4, 3.2, { fill: K.helps, 'fill-opacity': 0.25 }),
    path('M-8 9 V-6.6 H8 V9', stroke(K.white, 1.8)),
    rect(-6.2, -5.2, 12.4, 4.6, { ...wash(K.jelly, 0.55, 1.1), rx: 1 }),
    circle(0, -9.4, 1.8, solid(K.helps)),
    path(chevron(0, 4.2, -90, 4.6), stroke(K.helps, 1.7)),
  ],
  // Wall Rush: a jelly wall coming at you with a gold-edged cut-out, an orange hurdle across it to jump.
  b: () => [
    rect(-9, -8.4, 18, 16.8, { ...wash(K.jelly, 0.42, 1.2), rx: 2 }),
    rect(-4.2, -2.2, 8.4, 10.6, { fill: '#22164a', stroke: K.gold, 'stroke-width': 1.1, rx: 1 }),
    rect(-5.4, 3.4, 10.8, 2.8, { ...solid(K.jump, '#ffd0ad', 0.6), rx: 1.4 }),
    path(chevron(0, 0.6, -90, 3.2), stroke(K.jump, 1.2)),
    path(chevron(-6.6, -4.4, 90, 2.4), stroke(K.white, 0.9, 0.7)),
    path(chevron(6.6, -4.4, 90, 2.4), stroke(K.white, 0.9, 0.7)),
  ],
  // Sweeper Spin: a candy stage, a teal hub and its long orange bar sweeping round, the way it turns in indigo.
  s: () => [
    ellipse(0, 5.2, 9.4, 3.6, wash(K.pink, 0.8, 1.1)),
    rect(-1.6, -3.4, 3.2, 8.6, { ...wash(K.bouncy, 0.6, 1), rx: 1.6 }),
    group({ transform: 'rotate(-12 0 0)' }, [rect(-10, -1.5, 20, 3, { ...solid(K.jump, '#ffd0ad', 0.6), rx: 1.5 })]),
    path('M-6.4 -6.4 Q0 -10.4 6.4 -6.4', stroke(K.pushes, 1.4)),
    path(chevron(6.2, -6.6, 30, 2.8), stroke(K.pushes, 1.4)),
  ],
  // Bonk Alley: a wrecking ball swinging from its gantry, red with white bands: keep away.
  h: () => [
    path('M-8.4 -8.8 H8.4', stroke(K.white, 1.8)),
    path('M-0.6 -8.8 L3.4 -0.4', stroke(K.white, 1)),
    path('M-8.6 -1.6 Q-7.2 2 -4 4.4 M-9.2 2.6 Q-7.8 5.4 -5.4 6.8', stroke(K.white, 0.9, 0.55)),
    circle(4.2, 3.4, 5.4, solid(K.dodge, '#ffb0ab', 0.8)),
    path('M-0.4 1.6 Q4.2 3 8.8 1.6 M-0.4 5.4 Q4.2 6.8 8.8 5.4', stroke('#ffffff', 1)),
  ],
  // Melon Hill: the belt running down at you in indigo, and a big red melon rolling down it.
  f: () => {
    // Down the belt, and a point on its middle line `u` of the way up it.
    const down = (Math.atan2(9.6, -19.2) * 180) / Math.PI
    const at = (u: number): [number, number] => [-9.6 + 19.2 * u, 8.5 - 9.6 * u]
    return [
      path('M-9.6 6.2 L9.6 -3.4 L9.6 1.2 L-9.6 10.8 Z', wash(K.pushes, 0.5, 1)),
      ...[0.18, 0.78].map((u) => path(chevron(at(u)[0], at(u)[1], down, 2.2), stroke('#ffffff', 0.9, 0.8))),
      circle(-0.6, -3.2, 4.6, solid(K.dodge, '#ffb0ab', 0.8)),
      path('M-4.6 -4.6 Q-0.6 -3.4 3.4 -4.6 M-4.8 -1.4 Q-0.6 -0.2 3.6 -1.4', stroke('#ffffff', 0.9)),
      path('M-0.4 -7.8 Q1.6 -10 3.6 -9', { ...stroke(K.helps, 1.2), fill: K.helps }),
    ]
  },
  // Tippy Planks: a long mint plank tipped on its pivot, the bright stripe on the pivot line, over the soda sea.
  w: () => [
    path('M-10 9.4 Q-5 7.8 0 9.4 T10 9.4', stroke(K.sea, 1.4)),
    circle(-6.4, 6.2, 0.8, stroke(K.bubble, 0.5, 0.8)),
    path('M-3.2 8.4 L0 2.4 L3.2 8.4 Z', wash(K.white, 0.8, 1)),
    group({ transform: 'rotate(-16 0 1.6)' }, [
      rect(-10, 0, 20, 3.2, { ...wash(K.mint, 0.85, 1.2), rx: 1.4 }),
      rect(-0.8, 0, 1.6, 3.2, solid(K.amber)),
    ]),
    path('M5.2 -6.6 Q8 -5 8.4 -2', stroke(K.pushes, 1.2)),
    path(chevron(8.3, -2.6, 95, 2.4), stroke(K.pushes, 1.2)),
  ],
  // Crumble Tiles: pastel tiles, a white star tile that never drops, and one gone red, dropping, shaking.
  x: () => [
    path(hex(-4.8, -3, 4.4), wash(K.lemon, 0.85, 1.1)),
    path(hex(4.8, -3, 4.4), wash(K.white, 0.85, 1.1)),
    path('M4.8 -5.4 L5.5 -3.7 L7.2 -3.6 L5.9 -2.5 L6.3 -0.8 L4.8 -1.7 L3.3 -0.8 L3.7 -2.5 L2.4 -3.6 L4.1 -3.7 Z', solid(K.gold)),
    path(hex(0, 6, 4.4), solid(K.dodge, '#ffb0ab', 1)),
    path('M-6.4 4.4 L-5.4 5.6 M-6.6 7.6 L-5.4 7.8 M6.4 4.4 L5.4 5.6 M6.6 7.6 L5.4 7.8', stroke(K.white, 0.9, 0.8)),
  ],
  // Pad Hop: lily pads on the soda sea and the hop between them, a little gold-rimmed pad of the gold line.
  l: () => [
    path('M-10 9.2 Q-7 8.2 -4 9.2 M3 9.4 Q6 8.4 9.6 9.4', stroke(K.sea, 1.1)),
    path('M-9.6 5.4 A4.6 2.3 0 1 0 -5 3.1 L-5 5.4 Z', wash(K.helps, 0.6, 1.1)),
    path('M1.4 0.8 A4.2 2.1 0 1 0 5.6 -1.3 L5.6 0.8 Z', wash(K.helps, 0.6, 1.1)),
    ellipse(1.4, 7.6, 2, 0.9, { fill: K.helps, 'fill-opacity': 0.5, stroke: K.gold, 'stroke-width': 0.9 }),
    path('M-4.6 2.2 Q-0.6 -9.6 4.8 -2.4', { ...stroke(K.white, 1.1), 'stroke-dasharray': '1.2 1.5' }),
  ],
  // Barrel Roll: a striped barrel lying across the way, turning, the way it turns in indigo.
  r: () => [
    path('M-7 -4.6 H7 A2.4 4.6 0 0 1 7 4.6 H-7 Z', wash(K.pushes, 0.5, 1.1)),
    ellipse(-7, 0, 2.4, 4.6, wash(K.white, 0.4, 1.1)),
    path('M-2.4 -4.6 V4.6 M2.4 -4.6 V4.6', stroke('#ffffff', 0.9, 0.6)),
    path('M-5 -7.6 Q1 -10.4 6.4 -7', stroke(K.pushes, 1.3)),
    path(chevron(6.2, -7.2, 40, 2.6), stroke(K.pushes, 1.3)),
    path('M-9.6 8.6 H9.6', stroke(K.jump, 1.6)),
  ],
  // Gust Gaps: a fan on its pylon, its indigo blades, and the wind it blows across the gap.
  n: () => [
    circle(-4.2, -1, 6.2, wash(K.white, 0.18, 1.2)),
    ...[0, 120, 240].map((deg) =>
      group({ transform: `translate(-4.2 -1) rotate(${deg})` }, [path('M0 0 Q2.4 -2 5 -0.6 Q2.6 1.4 0 0 Z', solid(K.pushes, '#b7bcff', 0.5))]),
    ),
    circle(-4.2, -1, 1.2, solid(K.white)),
    path('M-4.2 5.2 V9.4', stroke(K.white, 1.4)),
    path('M3.6 -5 H8.6 M4.4 -1 H9.8 M3.6 3 H8.2', stroke(K.pushes, 1.3)),
    path(chevron(8.9, -1, 0, 2.2), stroke(K.pushes, 1.3)),
  ],
  // Star Peak: the candy mountain, a red striped boulder rolling down it, the Blip star over the summit pad.
  C: () => [
    path('M-10 9.2 L-1.4 -6.6 H1.4 L10 9.2 Z', wash(K.pink, 0.8, 1.2)),
    path('M-5.4 3 H5.4', stroke(K.white, 0.8, 0.6)),
    ellipse(0, -6.6, 2.4, 0.8, solid(K.bouncy)),
    ...smallStar(0, -9.05, 1.95),
    circle(-3.6, 5.6, 2.8, solid(K.dodge, '#ffb0ab', 0.6)),
    path('M-6 5.2 Q-3.6 6.3 -1.2 5.2', stroke('#ffffff', 0.8)),
  ],
  // Tide Tower: the tower of candy steps, the soda sea rising up it behind you, fizzing, the Blip star at the top.
  S: () => [
    path('M-9.6 9.4 V5.2 H-4.8 V1.4 H0 V-2.4 H4.8 V-6.2 H9.6 V9.4 Z', wash(K.mint, 0.85, 1.1)),
    path('M-10 9.6 V5.8 Q-7.2 4.2 -4.4 5.8 T1.2 5.6 T6.4 6.2 Q8.4 5 10 5.6 V9.6 Z', solid(K.sea, K.seaRim, 0.7)),
    circle(-6, 7.8, 0.75, stroke(K.bubble, 0.45)),
    circle(1.8, 8, 0.55, stroke(K.bubble, 0.45)),
    circle(-1.6, 3.6, 0.5, stroke(K.bubble, 0.4, 0.8)),
    ...smallStar(7.2, -8.5, 1.9),
  ],
  // The Blip star: a mint five-point star, a lighter star inside, the glowing white blip at its centre, its glow.
  star: () => [
    circle(0, 0, 9.7, { fill: K.starGlow, 'fill-opacity': 0.18 }),
    path('M0 -8.58 L2.42 -2.42 L9.02 -2.2 L3.74 1.76 L5.72 8.36 L0 4.62 L-5.72 8.36 L-3.74 1.76 L-9.02 -2.2 L-2.42 -2.42 Z', solid(K.star, K.starEdge, 0.7)),
    path('M0 -5.94 L1.54 -1.98 L5.72 -1.76 L2.42 0.66 L3.52 4.84 L0 2.42 L-3.52 4.84 L-2.42 0.66 L-5.72 -1.76 L-1.54 -1.98 Z', solid(K.starInner)),
    circle(0, 0, 2.6, { fill: K.spark, 'fill-opacity': 0.35 }),
    circle(0, 0, 1.55, solid(K.spark)),
  ],
}

/** A round's drawing alone, in its 20-across box centred on 0, for a chip; `star`, the Blip star. */
export function roundMarks(letter: RoundLetter | 'star'): Mark[] {
  return ICONS[letter]()
}

/** Blip's eyes and smile. */
const BLIP_INK = '#0f2f2a'

/**
 * Blip, 20 tall centred on 0 (y down), from its spark to its feet: a round mint creature, the shade under its
 * belly, two tall dark eyes with their glints, pink cheeks and a small smile, two round feet, and the glowing
 * white spark (the blip) floating over its head. `c` draws another: the blue blip, lighter. `glow`, a radial
 * gradient's fill for the spark's glow where the picture has one (gauntletMarks' `-spark`); else two soft rings.
 */
export function blipMarks(c: BlipColours = BLIP, glow?: string): Mark[] {
  const cheek = { fill: '#ff8fb3', 'fill-opacity': 0.7 }
  return [
    ...(glow
      ? [circle(0, -7.98, 2.7, { fill: glow })]
      : [circle(0, -7.98, 1.9, { fill: c.glow, 'fill-opacity': 0.28 }), circle(0, -7.98, 1.3, { fill: c.glow, 'fill-opacity': 0.5 })]),
    circle(0, -7.98, 0.85, solid(K.spark)),
    ellipse(-2.31, 8.82, 1.79, 0.95, solid(c.feet)),
    ellipse(2.31, 8.82, 1.79, 0.95, solid(c.feet)),
    circle(0, 1.26, 7.35, solid(c.body)),
    path('M-5.88 4.2 A7.35 7.35 0 0 0 5.88 4.2 A8.4 6.3 0 0 1 -5.88 4.2 Z', solid(c.shade)),
    ellipse(-2.52, -2.94, 2.52, 1.26, { fill: '#ffffff', 'fill-opacity': 0.35, transform: 'rotate(-24 -2.52 -2.94)' }),
    ellipse(-1.89, 1.05, 0.95, 1.58, solid(BLIP_INK)),
    ellipse(1.89, 1.05, 0.95, 1.58, solid(BLIP_INK)),
    circle(-1.58, 0.32, 0.36, solid('#ffffff')),
    circle(2.2, 0.32, 0.36, solid('#ffffff')),
    ellipse(-3.57, 3.15, 0.95, 0.53, cheek),
    ellipse(3.57, 3.15, 0.95, 0.53, cheek),
    path('M-1.26 3.57 Q0 4.73 1.26 3.57', stroke(BLIP_INK, 0.47)),
  ]
}

/* ---------- the picture ---------- */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A smooth line through the points (Catmull-Rom as cubic curves). */
function smooth(pts: Array<[number, number]>): string {
  let d = `M${n2(pts[0]![0])} ${n2(pts[0]![1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${n2(c1[0]!)} ${n2(c1[1]!)} ${n2(c2[0]!)} ${n2(c2[1]!)} ${n2(p2[0])} ${n2(p2[1])}`
  }
  return d
}

/** Tier pips: green for a gentle round, amber for the usual, red for a spicy one. */
const TIER_COLOUR = ['', K.helps, K.amber, K.dodge]

export type GauntletLike = { n: number; k: string }

/**
 * The picture's marks in a `w` by `h` box: its gradients (`defs`, named from `uid` so two on a page don't
 * share) and what's drawn. It lays the badges in one row in a very wide box, otherwise in two rows that turn
 * at the right, the second coming back to the star, so a 4:3 card, a 2:1 strip and the share card's near
 * square all show every round big enough to read.
 */
export function gauntletMarks(g: GauntletLike, w: number, h: number, uid = 'wr'): { defs: Mark[]; marks: Mark[] } {
  const rounds = gauntletRounds(g.k)
  const items: Array<RoundLetter | 'star'> = [...rounds.map((r) => r.letter), 'star']
  const count = items.length
  // Gaps between neighbours: four rounds, a finale and the star make five.
  const gaps = Math.max(1, count - 1)
  const wide = w / h >= 2.4
  let R: number
  const at: Array<[number, number]> = []
  let start: [number, number]
  const way: Array<[number, number]> = []
  if (wide) {
    const x0 = w * 0.2
    R = Math.min(((w * 0.74) / gaps) * 0.4, h * 0.22)
    // The star's badge is a little bigger, with its glow: room for it at the right.
    const step = (w - R * 1.45 - x0) / gaps
    for (let i = 0; i < count; i++) at.push([x0 + step * i, h * 0.5 + (i % 2 === 0 ? 1 : -1) * h * 0.07])
    start = [w * 0.07, h * 0.56]
    way.push([-w * 0.02, h * 0.58], start, ...at)
  } else {
    // Two rows: three across the top (half the badges, rounded up), then back along the bottom to the star.
    const top = Math.ceil(count / 2)
    // Small enough that the first row's pips clear the star's glow under them.
    R = Math.min(h * 0.145, (w * 0.3) / top)
    const cols = Array.from({ length: top }, (_, c) => w * (0.34 + (top > 1 ? (0.48 * c) / (top - 1) : 0)))
    const y1 = h * 0.31
    const y2 = h * 0.72
    for (let i = 0; i < count; i++) {
      const row = i < top ? 0 : 1
      const col = row === 0 ? i : top - 1 - (i - top)
      at.push([cols[col]!, row === 0 ? y1 : y2])
    }
    start = [w * 0.11, y1 + R * 0.08]
    const turn: [number, number] = [cols[top - 1]! + R * 1.3, (y1 + y2) / 2]
    way.push([-w * 0.02, y1 + R * 0.1], start, ...at.slice(0, top), turn, ...at.slice(top))
  }
  const track = smooth(way)
  const rnd = mulberry32(g.n * 7919 + 31)
  const stars: Mark[] = []
  for (let i = 0; i < 26; i++) {
    stars.push(circle(rnd() * w, rnd() * h * 0.9, Math.max(0.6, h * 0.004) * (0.6 + rnd() * 0.9), { fill: '#ffffff', opacity: n2(0.2 + rnd() * 0.5) }))
  }
  // The soda sea along the bottom: teal, deeper lower down, its light rim, and bubbles rising in it.
  const seaY = h * 0.92
  const sea = `M0 ${n2(seaY)} Q${n2(w * 0.125)} ${n2(seaY - h * 0.02)} ${n2(w * 0.25)} ${n2(seaY)} T${n2(w * 0.5)} ${n2(seaY)} T${n2(w * 0.75)} ${n2(seaY)} T${n2(w)} ${n2(seaY)}`
  const bubbles: Mark[] = []
  for (let i = 0; i < 9; i++) {
    const r = Math.max(0.9, h * 0.007) * (0.6 + rnd() * 0.8)
    bubbles.push(circle(rnd() * w, seaY + r + 1 + rnd() * Math.max(0, h - seaY - r * 2 - 2), r, stroke(K.bubble, Math.max(0.6, h * 0.0028), 0.75)))
  }
  const icon = R * 0.064
  const marks: Mark[] = [
    rect(0, 0, w, h, { fill: `url(#${uid}-sky)` }),
    ...stars,
    path(`${sea} V${n2(h)} H0 Z`, { fill: K.sea }),
    rect(0, seaY + (h - seaY) * 0.55, w, (h - seaY) * 0.45, { fill: K.seaDeep }),
    ...bubbles,
    path(sea, stroke(K.seaRim, Math.max(1, h * 0.006), 0.7)),
    // The trail: its candy body, its pastel top and the dashes down its middle.
    path(track, { ...stroke('#6a3384', R * 0.62), transform: `translate(0 ${n2(R * 0.16)})` }),
    path(track, stroke(K.pink, R * 0.5)),
    path(track, { ...stroke('#ffffff', Math.max(0.8, R * 0.05), 0.8), 'stroke-dasharray': `${n2(R * 0.14)} ${n2(R * 0.18)}` }),
  ]
  // Blip at the start, on the trail.
  const blip = R * 1.25
  marks.push(
    ellipse(start[0], start[1] + R * 0.1, blip * 0.34, blip * 0.08, { fill: '#000000', 'fill-opacity': 0.25 }),
    group({ transform: `translate(${n2(start[0])} ${n2(start[1] - blip * 0.48)}) rotate(-6) scale(${n2(blip / 20)})` }, blipMarks(BLIP, `url(#${uid}-spark)`)),
  )
  items.forEach((letter, i) => {
    const [x, y] = at[i]!
    const star = letter === 'star'
    const r = star ? R * 1.12 : R
    marks.push(
      circle(x, y, r * 1.22, { fill: star ? `url(#${uid}-star)` : `url(#${uid}-halo)` }),
      circle(x, y, r, { fill: star ? '#163a3a' : '#22164a', stroke: star ? K.starGlow : '#ffe1f0', 'stroke-width': n2(r * 0.1) }),
      group({ transform: `translate(${n2(x)} ${n2(y)}) scale(${n2(star ? icon * 1.12 : icon)})` }, ICONS[letter]()),
    )
    if (star) {
      const s = r * 0.16
      for (const [dx, dy, k] of [
        [-1.05, -0.95, 1],
        [1.08, -0.7, 0.8],
        [0.95, 1.0, 0.6],
      ] as const) {
        const cx = x + dx * r
        const cy = y + dy * r
        const q = s * k
        marks.push(path(`M${n2(cx)} ${n2(cy - q)} Q${n2(cx)} ${n2(cy)} ${n2(cx + q)} ${n2(cy)} Q${n2(cx)} ${n2(cy)} ${n2(cx)} ${n2(cy + q)} Q${n2(cx)} ${n2(cy)} ${n2(cx - q)} ${n2(cy)} Q${n2(cx)} ${n2(cy)} ${n2(cx)} ${n2(cy - q)} Z`, solid(K.bubble)))
      }
    } else {
      const tier = rounds[i]!.tier
      const pip = Math.max(1.2, r * 0.085)
      for (let p = 0; p < tier; p++) {
        marks.push(circle(x + (p - (tier - 1) / 2) * pip * 2.8, y + r + pip * 2.4, pip, solid(TIER_COLOUR[Math.min(3, tier)]!)))
      }
    }
  })
  const defs: Mark[] = [
    {
      t: 'linearGradient',
      a: { id: `${uid}-sky`, x1: 0, y1: 0, x2: 0, y2: 1 },
      c: [
        { t: 'stop', a: { offset: 0, 'stop-color': '#140d38' } },
        { t: 'stop', a: { offset: 0.7, 'stop-color': '#4a2470' } },
        { t: 'stop', a: { offset: 1, 'stop-color': '#7a2f7e' } },
      ],
    },
    {
      t: 'radialGradient',
      a: { id: `${uid}-halo` },
      c: [
        { t: 'stop', a: { offset: 0.7, 'stop-color': '#ffb3d6', 'stop-opacity': 0.35 } },
        { t: 'stop', a: { offset: 1, 'stop-color': '#ffb3d6', 'stop-opacity': 0 } },
      ],
    },
    {
      t: 'radialGradient',
      a: { id: `${uid}-star` },
      c: [
        { t: 'stop', a: { offset: 0.6, 'stop-color': K.starGlow, 'stop-opacity': 0.55 } },
        { t: 'stop', a: { offset: 1, 'stop-color': K.starGlow, 'stop-opacity': 0 } },
      ],
    },
    // Blip's spark: a soft glow round the blip.
    {
      t: 'radialGradient',
      a: { id: `${uid}-spark` },
      c: [
        { t: 'stop', a: { offset: 0, 'stop-color': BLIP.glow, 'stop-opacity': 0.9 } },
        { t: 'stop', a: { offset: 0.45, 'stop-color': BLIP.glow, 'stop-opacity': 0.45 } },
        { t: 'stop', a: { offset: 1, 'stop-color': BLIP.glow, 'stop-opacity': 0 } },
      ],
    },
  ]
  return { defs, marks }
}

const escape = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** A mark as SVG text. */
export function markText(m: Mark): string {
  const attrs = Object.entries(m.a)
    .map(([k, v]) => ` ${k}="${escape(v)}"`)
    .join('')
  return m.c ? `<${m.t}${attrs}>${m.c.map(markText).join('')}</${m.t}>` : `<${m.t}${attrs}/>`
}

/** The picture as SVG text, `w` by `h`: the day's share card's (scripts/today-cards.mjs). */
export function gauntletSvg(g: GauntletLike, w: number, h: number): string {
  const { defs, marks } = gauntletMarks(g, w, h, 'g')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>${defs.map(markText).join('')}</defs>` +
    marks.map(markText).join('') +
    `</svg>`
  )
}
