import type { ArtShape, SkinArt } from '../../lib/skinArt'
import { inAir, mulberry32, type Cave } from './sim'

/*
 * What Lander's new look is made of, kept apart from what paints it: its colours, the pod, and what grows
 * from the rock and where. The game's painter (lamplight.ts) and the still pictures (lampPicture.ts) both
 * draw from here, so a picture can't drift from the game; and a page that shows a picture needn't carry the
 * game's painter to do it.
 */

export type RGB = readonly [number, number, number]

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const rgb = (c: RGB) => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`

/** The rock, near the top of the cave and at its bottom; and what the tunnel's light makes of it at the wall. */
export const ROCK: readonly [RGB, RGB] = [
  [66, 45, 38],
  [50, 33, 44],
]
export const LIT: RGB = [186, 128, 78]
/** The light in the rock, as bands out from the wall, widest first: how far (m), and how much of LIT. */
export const BANDS = [
  [3.3, 0.14],
  [2.0, 0.32],
  [0.95, 0.56],
] as const
/** The wall's lit edge, near the top and deep down, and how thick it is (m). */
export const RIM: readonly [RGB, RGB] = [
  [244, 200, 128],
  [250, 172, 122],
]
export const RIM_W = 0.24
export const AIR: readonly [RGB, RGB] = [
  [23, 27, 48],
  [15, 13, 33],
]
/** The far columns in the air; the rock's dark and pale, for its layers; and the stone of what grows from it. */
export const FAR: RGB = [44, 46, 78]
export const INK: RGB = [38, 22, 22]
export const PALE: RGB = [236, 190, 130]
export const STONE: RGB = [150, 106, 72]

/* ------------------------------------------------------------------ the ship --- */

type PodColours = { body: string; shade: string; line: string; glass: string; glint: string; trim: string; metal: string; lamp: string; foot: string }

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`

/**
 * The pod, his pick of three shapes ("A" came with ship 1 unless he named another, and he named none): an egg
 * of a cabin on two legs, a lamp on its nose. Drawn on a season skin's board (lib/skinArt.ts: 100 wide, feet
 * 52 apart on y 86), so it sits on the hull as a skin does: its lamp is the hull's nose, its feet the hull's.
 */
const pod = (P: PodColours): SkinArt => ({
  flame: [],
  body: [
    { d: 'M40 60L25 84M60 60L75 84', stroke: P.metal, width: 3.6, cap: 'round' },
    { d: 'M19 86h12M69 86h12', stroke: P.foot, width: 4, cap: 'round' },
    { d: 'M44 63h12l3 8h-18z', fill: P.metal },
    { d: 'M50 20C61 20 65 36 65 48C65 58 59 65 50 65C41 65 35 58 35 48C35 36 39 20 50 20z', fill: P.body, stroke: P.line, width: 2, join: 'round' },
    { d: 'M50 21C60 22 64 37 64 48C64 57 58.5 64 50 64C56 58 58 50 58 44C58 34 55 25 50 21z', fill: P.shade },
    { d: 'M35.8 52C41 55.5 59 55.5 64.2 52', stroke: P.trim, width: 3 },
    { d: circle(50, 40, 7.5), fill: P.glass, stroke: P.line, width: 1.8 },
    { d: 'M46 37.5a5 5 0 0 1 5 -2.6', stroke: P.glint, width: 1.6, cap: 'round' },
    { d: circle(50, 21.5, 2.7), fill: P.lamp, stroke: P.line, width: 1 },
  ] satisfies ArtShape[],
})

export const POD = pod({ body: '#fff3e4', shade: '#e6cfbb', line: '#2a2140', glass: '#2b3a67', glint: '#cfeaff', trim: '#8a5cff', metal: '#514a66', lamp: '#ffd166', foot: '#3a3150' })
/** The blue ship's, and your own best's: the same pod in the ghost's colour. */
export const POD_BLUE = pod({ body: '#9fe0ff', shade: '#6cbdf0', line: '#1b4a7a', glass: '#1d477e', glint: '#e4f7ff', trim: '#46e4ff', metal: '#3a7fb8', lamp: '#e4f7ff', foot: '#2e6fa8' })
export const POD_AMBER = pod({ body: '#ffe1a0', shade: '#f2bd62', line: '#6b4310', glass: '#7a4f14', glint: '#fff4d6', trim: '#f5b942', metal: '#b98632', lamp: '#fff4d6', foot: '#9a6a1e' })

/* ------------------------------------------------------------------ what grows from the rock --- */

/** What grows from the rock, by which way the rock faces. */
export const GROWS = {
  ceiling: ['stal', 'stal', 'root'],
  floor: ['stal', 'peb', 'stal', 'amber'],
  side: ['peb', 'amber'],
} as const
export type Grown = 'stal' | 'peb' | 'root' | 'amber'
/** How many shapes of each there are to choose from. */
export const VARIANTS: Record<Grown, number> = { stal: 6, peb: 3, root: 3, amber: 3 }

/** A thing grown from the rock, laid once for the cave: where, which way up, which shape, how big, which way round. */
export type Laid = { x: number; y: number; turn: number; kind: Grown; pick: number; size: number; flip: boolean }

/** How often a wall's point grows something. */
const LUSH = 0.4

export function layProps(cave: Cave): Laid[] {
  const laid: Laid[] = []
  const lab = cave.lab
  const tryAt = (x: number, y: number, ux: number, uy: number, hint: number, seed: number) => {
    const rnd = mulberry32(seed)
    if (rnd() > LUSH) return
    // Really a wall: rock behind it, air in front (a tunnel's wall runs on through a room's air).
    if (inAir(cave, x + ux * 0.35, y + uy * 0.35, hint) || !inAir(cave, x - ux * 0.35, y - uy * 0.35, hint)) return
    // Nothing grows on a pad, where a gate's line meets the wall, by a vent, or out of lava.
    if (cave.pads.some((p) => x > p.x0 - 0.6 && x < p.x1 + 0.6 && Math.abs(y - p.y) < 1.2)) return
    if (cave.gates.some((g) => Math.hypot(x - g.x0, y - g.y0) < 1.3 || Math.hypot(x - g.x1, y - g.y1) < 1.3)) return
    if (lab?.vents.some((v) => Math.hypot(x - v.x, y - v.y) < 1.8)) return
    if (lab?.lava.some((l) => x > l.x0 - 0.4 && x < l.x1 + 0.4 && y > l.y0 - 0.6 && y < l.y1 + 0.8)) return
    const face = uy > 0.55 ? 'ceiling' : uy < -0.55 ? 'floor' : 'side'
    const kinds = GROWS[face]
    const kind = kinds[Math.floor(rnd() * kinds.length)]!
    laid.push({ x, y, turn: Math.atan2(-ux, -uy), kind, pick: Math.floor(rnd() * VARIANTS[kind]), size: 1.05 + rnd() * 0.3, flip: rnd() < 0.5 })
  }
  const N = cave.nodes
  for (let i = 0; i < N.length; i++) {
    const a = N[Math.max(0, i - 1)]!
    const b = N[Math.min(N.length - 1, i + 1)]!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    const p = N[i]!
    tryAt(p.x + nx * p.r, p.y + ny * p.r, nx, ny, i, (i * 2 + 1) * 7919)
    tryAt(p.x - nx * p.r, p.y - ny * p.r, -nx, -ny, i, (i * 2 + 2) * 7919)
  }
  cave.rooms.forEach((room, q) => {
    const hint = q === 0 ? 0 : N.length - 1
    for (let x = room.x0 + 0.8; x < room.x1 - 0.4; x += 1.5) {
      tryAt(x, room.y0, 0, -1, hint, Math.round(x * 10) * 31 + 91 + q)
      tryAt(x, room.y1, 0, 1, hint, Math.round(x * 10) * 31 + 92 + q)
    }
    for (let y = room.y0 + 0.8; y < room.y1 - 0.4; y += 1.5) {
      tryAt(room.x0, y, -1, 0, hint, Math.round(y * 10) * 31 + 93 + q)
      tryAt(room.x1, y, 1, 0, hint, Math.round(y * 10) * 31 + 94 + q)
    }
  })
  return laid
}
