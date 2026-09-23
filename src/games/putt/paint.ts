import { PALETTE, type Swatch } from '../../data/games'
import { hashString, mulberry32 } from '../../lib/seededRandom'
import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'
import type { Decor, Hole, Theme } from './course'
import { unionSdf, type Vec } from './terrain'

/*
 * The colours a hole is painted in, and the garden it sits in. Everything is
 * the arcade's own way of drawing: a soft fill, the palette colour mixed into
 * the ground, inside a clean line of the same colour, lighter on the dark
 * theme and darker on the light. The dark theme is the garden at dusk: the
 * grass round the course falls into shade and the green is the lit part.
 */

export type RGB = [number, number, number]

export function css(c: RGB, a = 1) {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function hexRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return [18, 28, 36]
  const n = Number.parseInt(clean, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hslRgb(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

const hues = new Map<Swatch, number>()

/** A palette colour's hue. */
export function hueOf(swatch: Swatch) {
  let hue = hues.get(swatch)
  if (hue === undefined) {
    const [r, g, b] = hexRgb(PALETTE[swatch]).map((v) => v / 255) as RGB
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min
    hue = d === 0 ? 0 : max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60
    hue = Math.round(hue)
    hues.set(swatch, hue)
  }
  return hue
}

export function hsla(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

export type Skin = {
  key: string
  dark: boolean
  field: RGB
  ink: RGB
  /** The garden's grass, round the course, and the two shades its tufts come in. */
  rough: RGB
  roughHi: RGB
  roughLo: RGB
  /** The green: its two mowing stripes, and the shades of its blades. */
  green: RGB
  stripe: RGB
  greenHi: RGB
  greenLo: RGB
  /** The rail round the green: timber, its lit face, and its line. */
  rail: RGB
  railLit: RGB
  railLine: string
  /** Shadows the course and everything standing on it cast. */
  shadow: string
  water: RGB
  waterEdge: RGB
  waterLine: string
  waterGlint: string
  sand: RGB
  sandLine: string
  sandMark: string
  stone: RGB
  stoneLit: RGB
  stoneLine: string
  /** Lighter timber, for bridges, ramps and sails. */
  wood: RGB
  woodLit: RGB
  woodLine: string
  roof: RGB
  roofLit: RGB
  roofShade: RGB
  roofLine: string
  sail: RGB
  sailLine: string
  leaf: RGB
  leafLit: RGB
  leafLine: string
  pine: RGB
  pineLit: RGB
  pineLine: string
  blossom: RGB
  blossomLit: RGB
  blossomLine: string
  /** Petals, in palette hues. */
  petals: string[]
  /** The tee mat. */
  mat: RGB
  matLine: string
  /** Outlines for anything else, in a palette hue at the theme's line lightness. */
  line: (swatch: Swatch, alpha?: number, sat?: number) => string
}

let cached: Skin | null = null

export function skin(): Skin {
  const fieldHex = playfieldColor()
  const dark = isDarkTheme()
  const key = `${fieldHex}|${dark}`
  if (cached && cached.key === key) return cached

  const f = hexRgb(fieldHex)
  const ink = hexRgb(inkColor())
  const lineL = dark ? 64 : 42
  const line = (swatch: Swatch, alpha = 0.9, sat = 60) => hsla(hueOf(swatch), sat, lineL, alpha)
  const tone = (swatch: Swatch, s = 0.64, l = 0.58) => hslRgb(hueOf(swatch), s, l)
  const black: RGB = [0, 0, 0]
  const white: RGB = [255, 255, 255]

  const G = tone('green')
  const O = tone('orange', 0.7, 0.6)
  const S = tone('sky', 0.7, 0.6)
  const A = tone('amber', 0.8, 0.62)
  const W = tone('amber', 0.5, 0.56)
  const R = tone('red', 0.62, 0.58)
  const T = tone('teal')
  const P = tone('pink')
  const St = tone('sky', 0.14, dark ? 0.62 : 0.55)

  const rough = dark ? mix(mix(f, [4, 10, 14], 0.22), G, 0.1) : mix(mix(f, G, 0.24), [96, 128, 112], 0.1)
  const green = dark ? mix(f, G, 0.33) : mix(f, G, 0.52)
  const petalL = dark ? 68 : 58

  cached = {
    key,
    dark,
    field: f,
    ink,
    rough,
    roughHi: dark ? mix(rough, G, 0.12) : mix(rough, white, 0.4),
    roughLo: dark ? mix(rough, black, 0.35) : mix(rough, [10, 70, 50], 0.14),
    green,
    stripe: dark ? mix(f, G, 0.38) : mix(f, G, 0.59),
    greenHi: dark ? mix(green, G, 0.25) : mix(green, white, 0.35),
    greenLo: dark ? mix(green, black, 0.3) : mix(green, [10, 80, 50], 0.18),
    rail: dark ? mix(f, O, 0.36) : mix(f, O, 0.46),
    railLit: dark ? mix(f, O, 0.52) : mix(f, O, 0.3),
    railLine: line('orange', 0.95),
    shadow: dark ? 'rgba(0, 4, 8, 0.55)' : 'rgba(18, 52, 44, 0.24)',
    water: dark ? mix(f, S, 0.34) : mix(f, S, 0.46),
    waterEdge: dark ? mix(f, S, 0.5) : mix(f, S, 0.3),
    waterLine: line('sky', 0.9),
    waterGlint: dark ? 'rgba(200, 235, 255, 0.55)' : 'rgba(255, 255, 255, 0.85)',
    sand: dark ? mix(f, A, 0.4) : mix(f, A, 0.46),
    sandLine: line('amber', 0.9),
    sandMark: dark ? css(mix(mix(f, A, 0.4), black, 0.35), 0.55) : css(mix(mix(f, A, 0.46), [140, 90, 20], 0.3), 0.5),
    stone: dark ? mix(f, St, 0.42) : mix(f, St, 0.42),
    stoneLit: dark ? mix(f, St, 0.58) : mix(f, St, 0.22),
    stoneLine: hsla(hueOf('sky'), 16, lineL, 0.9),
    wood: dark ? mix(f, W, 0.46) : mix(f, W, 0.4),
    woodLit: dark ? mix(f, W, 0.62) : mix(f, W, 0.24),
    woodLine: line('amber', 0.95, 45),
    roof: dark ? mix(f, R, 0.5) : mix(f, R, 0.56),
    roofLit: dark ? mix(f, R, 0.66) : mix(f, R, 0.36),
    roofShade: dark ? mix(f, R, 0.36) : mix(f, R, 0.74),
    roofLine: line('red', 0.95),
    sail: dark ? mix(f, [236, 228, 210], 0.62) : mix(f, [255, 252, 244], 0.95),
    sailLine: line('amber', 0.95, 35),
    leaf: dark ? mix(f, G, 0.2) : mix(f, G, 0.62),
    leafLit: dark ? mix(f, G, 0.3) : mix(f, G, 0.46),
    leafLine: line('green', 0.85),
    pine: dark ? mix(f, T, 0.2) : mix(mix(f, T, 0.5), [40, 90, 100], 0.12),
    pineLit: dark ? mix(f, T, 0.3) : mix(f, T, 0.32),
    pineLine: line('teal', 0.85),
    blossom: dark ? mix(f, P, 0.34) : mix(f, P, 0.4),
    blossomLit: dark ? mix(f, P, 0.5) : mix(f, P, 0.22),
    blossomLine: line('pink', 0.9),
    petals: (['pink', 'amber', 'violet', 'red', 'magenta', 'sky'] as Swatch[]).map((sw) => hsla(hueOf(sw), 75, petalL, 0.95)),
    mat: dark ? mix(f, G, 0.2) : mix(f, G, 0.6),
    matLine: line('green', 0.8),
    line,
  }
  return cached
}

/* ---------- places ---------- */

/** The ground round a course, and what its rails are made of: the part of the look that changes from hole to hole. */
export type Place = {
  rough: RGB
  roughHi: RGB
  roughLo: RGB
  /** What the ground round the course is: grass with tufts, raked gravel, sand, or high meadow and rock. */
  grain: 'grass' | 'gravel' | 'sand' | 'alpine'
  rail: RGB
  railLit: RGB
  railLine: string
  railStyle: 'timber' | 'hedge' | 'stone' | 'boardwalk' | 'rock'
  /** How far the rail stands out past the edge of the green. */
  railW: number
}

const places = new Map<string, Place>()

export function placeOf(sk: Skin, theme: Theme): Place {
  const key = `${sk.key}|${theme}`
  const known = places.get(key)
  if (known) return known
  const { dark, field: f } = sk
  const tone = (swatch: Swatch, s: number, l: number) => hslRgb(hueOf(swatch), s, l)
  const G = tone('green', 0.64, 0.58)
  const black: RGB = [0, 0, 0]
  const white: RGB = [255, 255, 255]
  let place: Place
  switch (theme) {
    case 'formal': {
      // Raked gravel between clipped hedges.
      const gravel = tone('amber', 0.18, dark ? 0.6 : 0.62)
      const rough = dark ? mix(mix(f, [4, 10, 14], 0.15), gravel, 0.16) : mix(f, gravel, 0.34)
      place = {
        rough,
        roughHi: dark ? mix(rough, white, 0.1) : mix(rough, white, 0.45),
        roughLo: dark ? mix(rough, black, 0.35) : mix(rough, [90, 70, 40], 0.16),
        grain: 'gravel',
        rail: dark ? mix(f, G, 0.24) : mix(mix(f, G, 0.8), [20, 90, 60], 0.12),
        railLit: dark ? mix(f, G, 0.36) : mix(f, G, 0.6),
        railLine: sk.line('green', 0.9),
        railStyle: 'hedge',
        railW: 2.9,
      }
      break
    }
    case 'castle': {
      const rough = dark ? mix(mix(f, [4, 10, 14], 0.26), G, 0.08) : mix(mix(f, G, 0.22), [90, 110, 120], 0.12)
      place = {
        rough,
        roughHi: dark ? mix(rough, G, 0.1) : mix(rough, white, 0.4),
        roughLo: dark ? mix(rough, black, 0.35) : mix(rough, [10, 60, 50], 0.14),
        grain: 'grass',
        rail: sk.stone,
        railLit: sk.stoneLit,
        railLine: sk.stoneLine,
        railStyle: 'stone',
        railW: 2.6,
      }
      break
    }
    case 'coast': {
      const beach = tone('amber', 0.55, 0.66)
      const rough = dark ? mix(mix(f, [4, 10, 14], 0.1), beach, 0.2) : mix(f, beach, 0.34)
      const drift = tone('amber', 0.22, 0.6)
      place = {
        rough,
        roughHi: dark ? mix(rough, white, 0.1) : mix(rough, white, 0.5),
        roughLo: dark ? mix(rough, black, 0.3) : mix(rough, [150, 110, 50], 0.2),
        grain: 'sand',
        rail: dark ? mix(f, drift, 0.42) : mix(f, drift, 0.52),
        railLit: dark ? mix(f, drift, 0.6) : mix(f, drift, 0.3),
        railLine: sk.line('amber', 0.9, 30),
        railStyle: 'boardwalk',
        railW: 2.3,
      }
      break
    }
    case 'summit': {
      const T = tone('teal', 0.5, 0.56)
      const rough = dark ? mix(mix(f, [4, 10, 14], 0.22), T, 0.1) : mix(mix(f, T, 0.2), [100, 120, 120], 0.08)
      const rock = mix(tone('sky', 0.1, dark ? 0.6 : 0.52), tone('amber', 0.3, 0.55), 0.25)
      place = {
        rough,
        roughHi: dark ? mix(rough, T, 0.14) : mix(rough, white, 0.42),
        roughLo: dark ? mix(rough, black, 0.35) : mix(rough, [20, 70, 70], 0.14),
        grain: 'alpine',
        rail: dark ? mix(f, rock, 0.42) : mix(f, rock, 0.46),
        railLit: dark ? mix(f, rock, 0.6) : mix(f, rock, 0.26),
        railLine: hsla(hueOf('sky'), 12, dark ? 64 : 42, 0.9),
        railStyle: 'rock',
        railW: 2.6,
      }
      break
    }
    default:
      place = {
        rough: sk.rough,
        roughHi: sk.roughHi,
        roughLo: sk.roughLo,
        grain: 'grass',
        rail: sk.rail,
        railLit: sk.railLit,
        railLine: sk.railLine,
        railStyle: 'timber',
        railW: 2.3,
      }
  }
  places.set(key, place)
  return place
}

/* ---------- the garden ---------- */

/** Something that grows or stands round the course, with a seed of its own for its details. */
export type Prop = Decor & { seed: number }

/** The big things with a crown, that crowd each other and everything under them. */
const TREES: ReadonlySet<Decor['kind']> = new Set(['tree', 'blossom', 'pine', 'palm'])

/** Things that lie flat on the ground, drawn before anything that stands. */
const FLAT: ReadonlySet<Decor['kind']> = new Set(['snow', 'bed', 'shell', 'flowers', 'lily', 'reeds'])

/** Which trees grow where, as shares that add to one. */
const WOODS: Record<Theme, [Decor['kind'], number][]> = {
  garden: [
    ['tree', 0.58],
    ['pine', 0.24],
    ['blossom', 0.18],
  ],
  formal: [
    ['tree', 0.62],
    ['blossom', 0.38],
  ],
  castle: [
    ['pine', 0.5],
    ['tree', 0.42],
    ['blossom', 0.08],
  ],
  coast: [['palm', 1]],
  summit: [
    ['pine', 0.82],
    ['tree', 0.18],
  ],
}

/** What fills the strip along the rails, by share. */
const VERGE: Record<Theme, [Decor['kind'], number][]> = {
  garden: [
    ['bush', 0.34],
    ['flowers', 0.48],
    ['stone', 0.18],
  ],
  formal: [
    ['flowers', 0.6],
    ['urn', 0.4],
  ],
  castle: [
    ['bush', 0.4],
    ['stone', 0.36],
    ['flowers', 0.24],
  ],
  coast: [
    ['shell', 0.34],
    ['stone', 0.3],
    ['reeds', 0.36],
  ],
  summit: [
    ['stone', 0.52],
    ['bush', 0.24],
    ['flowers', 0.24],
  ],
}

function pick(table: [Decor['kind'], number][], u: number): Decor['kind'] {
  let acc = 0
  for (const [kind, share] of table) {
    acc += share
    if (u < acc) return kind
  }
  return table[table.length - 1]![0]
}

const gardens = new WeakMap<Hole, Prop[]>()

/**
 * The garden round a hole: what was placed by hand, then trees wherever
 * there is room for one, whatever grows along the rails, and lilies and
 * reeds in and along the water. A formal garden has its hedges' rhythm: a
 * cone and a clipped ball in turn all along the rails. Up a mountain the
 * snow lies in the high ground. Seeded by the hole's name, so it is the same
 * every visit, and worked out once. `edges` is the traced edge of the green.
 */
export function gardenOf(hole: Hole, edges: readonly Vec[][]): Prop[] {
  const known = gardens.get(hole)
  if (known) return known
  const rnd = mulberry32(hashString(`garden:${hole.name}`))
  const props: Prop[] = hole.decor.map((d) => ({ ...d, seed: rnd() }))
  const theme = hole.theme
  const course = (p: Vec) => unionSdf(hole.green, p, hole.blend)
  const water = (p: Vec) => (hole.water.length ? unionSdf(hole.water, p) : Infinity)
  const pit = (p: Vec) => (hole.pits.length ? unionSdf(hole.pits, p) : Infinity)
  const clearOfMills = (p: Vec, r: number) => hole.mills.every((m) => Math.hypot(p.x - m.x, p.y - m.y) > m.reach + r + 1.5)
  // Anything big placed by hand (a tower, a keep, a lighthouse, a wall, a bed) keeps the scatter off it. A
  // wall runs from its point; a bed is centred on it.
  const big = hole.decor.filter((d) => !TREES.has(d.kind) && (d.r >= 4 || d.len !== undefined))
  const clearOfBig = (p: Vec, r: number) =>
    big.every((d) => {
      if (d.len !== undefined) {
        const a = d.angle ?? 0
        const len = d.len
        const ux = Math.cos(a)
        const uy = Math.sin(a)
        const x0 = d.kind === 'wall' ? d.x : d.x - (ux * len) / 2
        const y0 = d.kind === 'wall' ? d.y : d.y - (uy * len) / 2
        const along = Math.max(0, Math.min(len, (p.x - x0) * ux + (p.y - y0) * uy))
        return Math.hypot(p.x - (x0 + ux * along), p.y - (y0 + uy * along)) > d.r + r + 1
      }
      return Math.hypot(p.x - d.x, p.y - d.y) > d.r + r + 1.5
    })
  const crowded = (p: Vec, r: number, k: number) =>
    props.some((q) => TREES.has(q.kind) && Math.hypot(q.x - p.x, q.y - p.y) < (q.r + r) * k)
  const near = (p: Vec, r: number) => props.some((q) => !TREES.has(q.kind) && Math.hypot(q.x - p.x, q.y - p.y) < q.r + r + 1)
  const dry = (p: Vec, r: number) => water(p) > r * 0.55 && pit(p) > r + 1

  // Up a mountain, snow lies in the high ground first, and everything else grows round it.
  if (theme === 'summit') {
    for (let i = 0; i < 70; i++) {
      const p = { x: -6 + rnd() * 112, y: rnd() * hole.h * 0.4 }
      const r = 3.5 + rnd() * 5
      if (course(p) < r * 0.6 + 3 || !dry(p, r) || !clearOfBig(p, r)) continue
      if (props.some((q) => q.kind === 'snow' && Math.hypot(q.x - p.x, q.y - p.y) < (q.r + r) * 0.9)) continue
      props.push({ kind: 'snow', x: p.x, y: p.y, r, seed: rnd() })
    }
  }

  // A formal garden's rhythm: a cone and a clipped ball in turn, a set distance out from the rails.
  if (theme === 'formal') {
    let k = 0
    for (const line of edges) {
      let run = 0
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1]!
        const b = line[i]!
        const seg = Math.hypot(b.x - a.x, b.y - a.y)
        if (seg < 1e-6) continue
        const tx = (b.x - a.x) / seg
        const ty = (b.y - a.y) / seg
        for (let u = (10 - run) % 10; u < seg; u += 10) {
          const c = { x: a.x + tx * u, y: a.y + ty * u }
          let n = { x: -ty, y: tx }
          if (course({ x: c.x + n.x * 2, y: c.y + n.y * 2 }) < 0) n = { x: ty, y: -tx }
          const cone = k++ % 2 === 0
          const r = cone ? 2.3 : 2.7
          const p = { x: c.x + n.x * 6.6, y: c.y + n.y * 6.6 }
          if (course(p) < r + 3.2 || !dry(p, r) || !clearOfMills(p, r) || !clearOfBig(p, r)) continue
          if (near(p, r)) continue
          props.push({ kind: cone ? 'cone' : 'topiary', x: p.x, y: p.y, r, seed: rnd() })
        }
        run = (run + seg) % 10
      }
    }
  }

  // Trees, wherever one fits clear of the rails, the water and the drops.
  const woods = WOODS[theme]
  const cell = theme === 'coast' ? 15 : theme === 'formal' ? 14 : 12
  for (let gy = -6; gy < hole.h + 6; gy += cell) {
    for (let gx = -10; gx < 110; gx += cell) {
      const p = { x: gx + rnd() * cell, y: gy + rnd() * cell }
      const r = 6.5 + rnd() * 5
      if (course(p) < r + 3 || !dry(p, r) || !clearOfMills(p, r) || !clearOfBig(p, r)) continue
      if (crowded(p, r, 0.82)) continue
      if (props.some((q) => !TREES.has(q.kind) && q.kind !== 'snow' && Math.hypot(q.x - p.x, q.y - p.y) < q.r + r * 0.8)) continue
      props.push({ kind: pick(woods, rnd()), x: p.x, y: p.y, r, seed: rnd() })
    }
  }
  // Whatever grows or lies along the rails, in the strip the trees leave.
  const verge = VERGE[theme]
  for (let i = 0; i < hole.h * 0.9; i++) {
    const p = { x: -4 + rnd() * 108, y: rnd() * hole.h }
    const d = course(p)
    if (d < 4 || d > 13) continue
    if (!dry(p, 2.5) || water(p) < 2.5 || !clearOfMills(p, 2) || !clearOfBig(p, 2)) continue
    if (crowded(p, 2.5, 0.95)) continue
    if (props.some((q) => !TREES.has(q.kind) && q.kind !== 'snow' && Math.hypot(q.x - p.x, q.y - p.y) < q.r + 3.2)) continue
    const kind = pick(verge, rnd())
    const r =
      kind === 'bush'
        ? 2.4 + rnd() * 2
        : kind === 'stone'
          ? 1.3 + rnd() * (theme === 'summit' ? 2.6 : 1.3)
          : kind === 'urn'
            ? 1.8
            : kind === 'shell'
              ? 0.9 + rnd() * 0.5
              : 2.2 + rnd() * 1.6
    props.push({ kind, x: p.x, y: p.y, r, seed: rnd() })
  }
  // Lilies out on the water and reeds along its banks, off the course; not on the sea.
  for (let i = 0; i < hole.h * 1.2 && hole.water.length && hole.waterLook !== 'sea'; i++) {
    const p = { x: -2 + rnd() * 104, y: rnd() * hole.h }
    const w = water(p)
    if (w < -2.4 && w > -9 && course(p) > 4 && rnd() < 0.5) {
      if (props.some((q) => q.kind === 'lily' && Math.hypot(q.x - p.x, q.y - p.y) < q.r + 3)) continue
      if (!clearOfBig(p, 1.5)) continue
      props.push({ kind: 'lily', x: p.x, y: p.y, r: 1.4 + rnd() * 1.1, seed: rnd() })
    } else if (w > -0.6 && w < 1.2 && course(p) > 5) {
      if (props.some((q) => q.kind === 'reeds' && Math.hypot(q.x - p.x, q.y - p.y) < 5)) continue
      if (!clearOfBig(p, 2)) continue
      props.push({ kind: 'reeds', x: p.x, y: p.y, r: 2 + rnd() * 1.2, seed: rnd() })
    }
  }
  // Drawn from the far end of the hole down, so a tree lower on the screen stands in front.
  props.sort((a, b) => a.y - b.y)
  gardens.set(hole, props)
  return props
}

/** Whether a prop lies flat on the ground, to be drawn before anything standing. */
export function isFlat(p: Prop) {
  return FLAT.has(p.kind)
}

export function isTree(p: Prop) {
  return TREES.has(p.kind)
}
