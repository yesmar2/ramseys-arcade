/*
 * A day's gauntlet as a picture: its rounds in order as a trail of round badges at dusk, each badge with the
 * round's own small drawing in the game's colour code (jump the orange, dive under the purple, red bonks,
 * teal bounces, green helps, indigo pushes), its tier as pips under it, and the trail ending in the gold crown.
 * Your pink bean waits at the start. It needs only the plan's row (dailyPlan.ts: the round code `k`), no
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
  /** Two or three words on what you do in it, for a chip: "Lily Leapers · hop the pads". Never an answer. */
  hint: string
  finale: boolean
}

export const ROUNDS: Record<RoundLetter, RoundInfo> = {
  g: { name: 'Gate Crash', hint: 'time the doors', finale: false },
  b: { name: 'Block Party', hint: 'beat the walls', finale: false },
  s: { name: 'Spin Club', hint: 'jump the sweep', finale: false },
  h: { name: 'Hit Parade', hint: 'dodge the swings', finale: false },
  f: { name: 'Fruit Chute', hint: 'dodge the fruit', finale: false },
  w: { name: 'See-Saw', hint: 'keep your balance', finale: false },
  x: { name: 'Hex Drop', hint: 'keep moving', finale: false },
  l: { name: 'Lily Leapers', hint: 'hop the pads', finale: false },
  r: { name: 'Roll On', hint: 'ride the drums', finale: false },
  n: { name: 'Big Fans', hint: 'ride the wind', finale: false },
  C: { name: 'Crown Peak', hint: 'climb to the crown', finale: true },
  S: { name: 'Slime Climb', hint: 'outrun the slime', finale: true },
}

export type GauntletRound = RoundInfo & { letter: RoundLetter; tier: number }

/** A round code's rounds in course order, finale last: "g1w2h2l2C2" → Gate Crash T1, See-Saw T2, … */
export function gauntletRounds(k: string): GauntletRound[] {
  const rounds: GauntletRound[] = []
  for (const [, letter, tier] of k.matchAll(/([a-zA-Z])(\d)/g)) {
    const info = ROUNDS[letter as RoundLetter]
    if (info) rounds.push({ ...info, letter: letter as RoundLetter, tier: Number(tier) })
  }
  return rounds
}

/** "Gate Crash · See-Saw · Hit Parade · Lily Leapers · Crown Peak". */
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

/** The colour code, the same in every theme and every day (design-final §1.5), and the bean's own. */
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
  bean: '#e85d9a',
  beanEdge: '#ffb3d6',
  blue: '#4cb8f0',
  /** Floors: the candy pastels. */
  pink: '#ffd3ea',
  lemon: '#fff1b8',
  mint: '#c8f3e1',
  jelly: '#ff9ccc',
  goo: '#ff5fae',
  ink: '#1a1033',
}
const K = GAUNTLET_COLOURS

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
 * in its colours. The finales too, and the crown at the end.
 */
const ICONS: Record<RoundLetter | 'crown', () => Mark[]> = {
  // Gate Crash: a white door frame, its pink jelly door slid up into the header, the lamp over it green, and a
  // green chevron through it: the way is open.
  g: () => [
    circle(0, -9.4, 3.2, { fill: K.helps, 'fill-opacity': 0.25 }),
    path('M-8 9 V-6.6 H8 V9', stroke(K.white, 1.8)),
    rect(-6.2, -5.2, 12.4, 4.6, { ...wash(K.jelly, 0.55, 1.1), rx: 1 }),
    circle(0, -9.4, 1.8, solid(K.helps)),
    path(chevron(0, 4.2, -90, 4.6), stroke(K.helps, 1.7)),
  ],
  // Block Party: a jelly wall coming at you with a gold-edged cut-out, an orange hurdle across it to jump.
  b: () => [
    rect(-9, -8.4, 18, 16.8, { ...wash(K.jelly, 0.42, 1.2), rx: 2 }),
    rect(-4.2, -2.2, 8.4, 10.6, { fill: '#22164a', stroke: K.gold, 'stroke-width': 1.1, rx: 1 }),
    rect(-5.4, 3.4, 10.8, 2.8, { ...solid(K.jump, '#ffd0ad', 0.6), rx: 1.4 }),
    path(chevron(0, 0.6, -90, 3.2), stroke(K.jump, 1.2)),
    path(chevron(-6.6, -4.4, 90, 2.4), stroke(K.white, 0.9, 0.7)),
    path(chevron(6.6, -4.4, 90, 2.4), stroke(K.white, 0.9, 0.7)),
  ],
  // Spin Club: a candy stage, a teal hub and its long orange bar sweeping round, the way it turns in indigo.
  s: () => [
    ellipse(0, 5.2, 9.4, 3.6, wash(K.pink, 0.8, 1.1)),
    rect(-1.6, -3.4, 3.2, 8.6, { ...wash(K.bouncy, 0.6, 1), rx: 1.6 }),
    group({ transform: 'rotate(-12 0 0)' }, [rect(-10, -1.5, 20, 3, { ...solid(K.jump, '#ffd0ad', 0.6), rx: 1.5 })]),
    path('M-6.4 -6.4 Q0 -10.4 6.4 -6.4', stroke(K.pushes, 1.4)),
    path(chevron(6.2, -6.6, 30, 2.8), stroke(K.pushes, 1.4)),
  ],
  // Hit Parade: a wrecking ball swinging from its gantry, red with white bands: keep away.
  h: () => [
    path('M-8.4 -8.8 H8.4', stroke(K.white, 1.8)),
    path('M-0.6 -8.8 L3.4 -0.4', stroke(K.white, 1)),
    path('M-8.6 -1.6 Q-7.2 2 -4 4.4 M-9.2 2.6 Q-7.8 5.4 -5.4 6.8', stroke(K.white, 0.9, 0.55)),
    circle(4.2, 3.4, 5.4, solid(K.dodge, '#ffb0ab', 0.8)),
    path('M-0.4 1.6 Q4.2 3 8.8 1.6 M-0.4 5.4 Q4.2 6.8 8.8 5.4', stroke('#ffffff', 1)),
  ],
  // Fruit Chute: the belt running down at you in indigo, and a big red melon rolling down it.
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
  // See-Saw: a long mint plank tipped on its pivot, the bright stripe on the pivot line, over pink goo.
  w: () => [
    path('M-10 9.4 Q-5 7.8 0 9.4 T10 9.4', stroke(K.goo, 1.4)),
    path('M-3.2 8.4 L0 2.4 L3.2 8.4 Z', wash(K.white, 0.8, 1)),
    group({ transform: 'rotate(-16 0 1.6)' }, [
      rect(-10, 0, 20, 3.2, { ...wash(K.mint, 0.85, 1.2), rx: 1.4 }),
      rect(-0.8, 0, 1.6, 3.2, solid(K.amber)),
    ]),
    path('M5.2 -6.6 Q8 -5 8.4 -2', stroke(K.pushes, 1.2)),
    path(chevron(8.3, -2.6, 95, 2.4), stroke(K.pushes, 1.2)),
  ],
  // Hex Drop: pastel tiles, a white star tile that never drops, and one gone red, dropping, shaking.
  x: () => [
    path(hex(-4.8, -3, 4.4), wash(K.lemon, 0.85, 1.1)),
    path(hex(4.8, -3, 4.4), wash(K.white, 0.85, 1.1)),
    path('M4.8 -5.4 L5.5 -3.7 L7.2 -3.6 L5.9 -2.5 L6.3 -0.8 L4.8 -1.7 L3.3 -0.8 L3.7 -2.5 L2.4 -3.6 L4.1 -3.7 Z', solid(K.gold)),
    path(hex(0, 6, 4.4), solid(K.dodge, '#ffb0ab', 1)),
    path('M-6.4 4.4 L-5.4 5.6 M-6.6 7.6 L-5.4 7.8 M6.4 4.4 L5.4 5.6 M6.6 7.6 L5.4 7.8', stroke(K.white, 0.9, 0.8)),
  ],
  // Lily Leapers: lily pads on the goo and the hop between them, a little gold-rimmed pad of the Lily Line.
  l: () => [
    path('M-10 9.2 Q-7 8.2 -4 9.2 M3 9.4 Q6 8.4 9.6 9.4', stroke(K.goo, 1.1, 0.8)),
    path('M-9.6 5.4 A4.6 2.3 0 1 0 -5 3.1 L-5 5.4 Z', wash(K.helps, 0.6, 1.1)),
    path('M1.4 0.8 A4.2 2.1 0 1 0 5.6 -1.3 L5.6 0.8 Z', wash(K.helps, 0.6, 1.1)),
    ellipse(1.4, 7.6, 2, 0.9, { fill: K.helps, 'fill-opacity': 0.5, stroke: K.gold, 'stroke-width': 0.9 }),
    path('M-4.6 2.2 Q-0.6 -9.6 4.8 -2.4', { ...stroke(K.white, 1.1), 'stroke-dasharray': '1.2 1.5' }),
  ],
  // Roll On: a striped drum lying across the way, turning, the way it turns in indigo.
  r: () => [
    path('M-7 -4.6 H7 A2.4 4.6 0 0 1 7 4.6 H-7 Z', wash(K.pushes, 0.5, 1.1)),
    ellipse(-7, 0, 2.4, 4.6, wash(K.white, 0.4, 1.1)),
    path('M-2.4 -4.6 V4.6 M2.4 -4.6 V4.6', stroke('#ffffff', 0.9, 0.6)),
    path('M-5 -7.6 Q1 -10.4 6.4 -7', stroke(K.pushes, 1.3)),
    path(chevron(6.2, -7.2, 40, 2.6), stroke(K.pushes, 1.3)),
    path('M-9.6 8.6 H9.6', stroke(K.jump, 1.6)),
  ],
  // Big Fans: a fan on its pylon, its indigo blades, and the wind it blows across the gap.
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
  // Crown Peak: the candy mountain, a red striped boulder rolling down it, the gold flag on the summit pad.
  C: () => [
    path('M-10 9.2 L-1.4 -6.6 H1.4 L10 9.2 Z', wash(K.pink, 0.8, 1.2)),
    path('M-5.4 3 H5.4', stroke(K.white, 0.8, 0.6)),
    ellipse(0, -6.6, 2.4, 0.8, solid(K.bouncy)),
    path('M0 -6.8 V-10.4', stroke(K.white, 0.8)),
    path('M0 -10.4 L3 -9.5 L0 -8.6 Z', solid(K.gold)),
    circle(-3.6, 5.6, 2.8, solid(K.dodge, '#ffb0ab', 0.6)),
    path('M-6 5.2 Q-3.6 6.3 -1.2 5.2', stroke('#ffffff', 0.8)),
  ],
  // Slime Climb: the tower of candy steps, pink slime rising up it behind you.
  S: () => [
    path('M-9.6 9.4 V4.6 H-4.8 V0.4 H0 V-3.8 H4.8 V-8 H9.6 V9.4 Z', wash(K.mint, 0.85, 1.1)),
    path('M-10 9.6 V5.8 Q-7.2 4.2 -4.4 5.8 T1.2 5.6 T6.4 6.2 Q8.4 5 10 5.6 V9.6 Z', solid(K.goo, '#ff9dd0', 0.7)),
    path('M7.2 -8 V-10.6', stroke(K.white, 0.8)),
    path('M7.2 -10.6 L9.8 -9.8 L7.2 -9 Z', solid(K.gold)),
  ],
  // The crown, gold with its jewels.
  crown: () => [
    path('M-8 5 L-9.2 -4.6 L-4.2 -0.4 L0 -7.6 L4.2 -0.4 L9.2 -4.6 L8 5 Z', solid(K.gold, '#fff1b0', 1)),
    rect(-8.2, 4.4, 16.4, 3.2, { ...solid('#e0a92a', '#fff1b0', 0.8), rx: 1 }),
    circle(0, 1.6, 1.4, solid(K.bean)),
    circle(-4.6, 2.4, 0.9, solid(K.bouncy)),
    circle(4.6, 2.4, 0.9, solid(K.bouncy)),
    circle(-9.2, -4.6, 1.1, solid(K.gold)),
    circle(0, -7.6, 1.2, solid(K.gold)),
    circle(9.2, -4.6, 1.1, solid(K.gold)),
  ],
}

/** A round's drawing alone, in its 20-across box centred on 0, for a chip. */
export function roundMarks(letter: RoundLetter | 'crown'): Mark[] {
  return ICONS[letter]()
}

/**
 * Your bean, 20 tall centred on 0 (y down): the pink jelly bean, its visor and eyes, arms up mid-hop. `fill`
 * and `edge` draw another bean: the blue bean, lighter.
 */
export function beanMarks(fill = K.bean, edge = K.beanEdge): Mark[] {
  return [
    path('M-4.6 -0.6 L-8.2 -4.8 M4.6 -0.6 L8.2 -4.8', stroke(fill, 2)),
    path('M-2.4 7 L-3 9.6 M2.4 7 L3 9.6', stroke(fill, 2.4)),
    rect(-5.4, -9.6, 10.8, 17.6, { ...solid(fill, edge, 1), rx: 5.4 }),
    ellipse(-2.6, -2.4, 1.2, 3, { fill: '#ffffff', 'fill-opacity': 0.28 }),
    ellipse(1.2, -4.8, 3.7, 2.6, solid('#fff0f6')),
    circle(-0.1, -4.8, 0.85, solid(K.ink)),
    circle(2.5, -4.8, 0.85, solid(K.ink)),
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
 * at the right, the second coming back to the crown, so a 4:3 card, a 2:1 strip and the share card's near
 * square all show every round big enough to read.
 */
export function gauntletMarks(g: GauntletLike, w: number, h: number, uid = 'wr'): { defs: Mark[]; marks: Mark[] } {
  const rounds = gauntletRounds(g.k)
  const items: Array<RoundLetter | 'crown'> = [...rounds.map((r) => r.letter), 'crown']
  const count = items.length
  // Gaps between neighbours: four rounds, a finale and the crown make five.
  const gaps = Math.max(1, count - 1)
  const wide = w / h >= 2.4
  let R: number
  const at: Array<[number, number]> = []
  let start: [number, number]
  const way: Array<[number, number]> = []
  if (wide) {
    const x0 = w * 0.2
    R = Math.min(((w * 0.74) / gaps) * 0.4, h * 0.22)
    // The crown's badge is a little bigger, with its glow: room for it at the right.
    const step = (w - R * 1.45 - x0) / gaps
    for (let i = 0; i < count; i++) at.push([x0 + step * i, h * 0.5 + (i % 2 === 0 ? 1 : -1) * h * 0.07])
    start = [w * 0.07, h * 0.56]
    way.push([-w * 0.02, h * 0.58], start, ...at)
  } else {
    // Two rows: three across the top (half the badges, rounded up), then back along the bottom to the crown.
    const top = Math.ceil(count / 2)
    // Small enough that the first row's pips clear the crown's glow under them.
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
  const gooY = h * 0.92
  const goo = `M0 ${n2(gooY)} Q${n2(w * 0.125)} ${n2(gooY - h * 0.02)} ${n2(w * 0.25)} ${n2(gooY)} T${n2(w * 0.5)} ${n2(gooY)} T${n2(w * 0.75)} ${n2(gooY)} T${n2(w)} ${n2(gooY)}`
  const icon = R * 0.064
  const marks: Mark[] = [
    rect(0, 0, w, h, { fill: `url(#${uid}-sky)` }),
    ...stars,
    path(`${goo} V${n2(h)} H0 Z`, { fill: K.goo, 'fill-opacity': 0.28 }),
    path(goo, stroke('#ff9dd0', Math.max(1, h * 0.006), 0.7)),
    // The trail: its candy body, its pastel top and the dashes down its middle.
    path(track, { ...stroke('#6a3384', R * 0.62), transform: `translate(0 ${n2(R * 0.16)})` }),
    path(track, stroke(K.pink, R * 0.5)),
    path(track, { ...stroke('#ffffff', Math.max(0.8, R * 0.05), 0.8), 'stroke-dasharray': `${n2(R * 0.14)} ${n2(R * 0.18)}` }),
  ]
  // Your bean at the start, on the trail.
  const bean = R * 1.2
  marks.push(
    ellipse(start[0], start[1] + R * 0.1, bean * 0.3, bean * 0.08, { fill: '#000000', 'fill-opacity': 0.25 }),
    group({ transform: `translate(${n2(start[0])} ${n2(start[1] - bean * 0.48)}) rotate(-8) scale(${n2(bean / 20)})` }, beanMarks()),
  )
  items.forEach((letter, i) => {
    const [x, y] = at[i]!
    const crown = letter === 'crown'
    const r = crown ? R * 1.12 : R
    marks.push(
      circle(x, y, r * 1.22, { fill: crown ? `url(#${uid}-crown)` : `url(#${uid}-halo)` }),
      circle(x, y, r, { fill: crown ? '#3a2350' : '#22164a', stroke: crown ? K.gold : '#ffe1f0', 'stroke-width': n2(r * 0.1) }),
      group({ transform: `translate(${n2(x)} ${n2(y)}) scale(${n2(crown ? icon * 1.12 : icon)})` }, ICONS[letter]()),
    )
    if (crown) {
      const s = r * 0.16
      for (const [dx, dy, k] of [
        [-1.05, -0.95, 1],
        [1.08, -0.7, 0.8],
        [0.95, 1.0, 0.6],
      ] as const) {
        const cx = x + dx * r
        const cy = y + dy * r
        const q = s * k
        marks.push(path(`M${n2(cx)} ${n2(cy - q)} Q${n2(cx)} ${n2(cy)} ${n2(cx + q)} ${n2(cy)} Q${n2(cx)} ${n2(cy)} ${n2(cx)} ${n2(cy + q)} Q${n2(cx)} ${n2(cy)} ${n2(cx - q)} ${n2(cy)} Q${n2(cx)} ${n2(cy)} ${n2(cx)} ${n2(cy - q)} Z`, solid('#fff6cf')))
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
      a: { id: `${uid}-crown` },
      c: [
        { t: 'stop', a: { offset: 0.6, 'stop-color': K.gold, 'stop-opacity': 0.55 } },
        { t: 'stop', a: { offset: 1, 'stop-color': K.gold, 'stop-opacity': 0 } },
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
