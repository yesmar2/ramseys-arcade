/*
 * Small drawing helpers for the seasons' looks: Space Race's seeded
 * star field as a CSS background tile, Cold Snap's snow and frost, and the four-point sparkle the patches
 * and confetti use. Seeded, so a page draws the same sky every time.
 */

/** Season 1's colours, for its pictures and the few places a style needs one. */
export const SPACE = {
  night: '#101634',
  panel: '#1a2252',
  line: '#2e3a78',
  violet: '#8a6ad4',
  orange: '#f2813a',
  red: '#e8564f',
  amber: '#f5b942',
  brass: '#c98a1c',
  star: '#f4f0ff',
  muted: '#a5abd6',
  indigo: '#6b74e8',
} as const

/**
 * Season 2's colours (Cold Snap: Ramsey picked A, Northern Lights, 2026-10-06): a polar night, aurora green in
 * Space Race's orange's place, teal and violet beside it, snow, and a cabin's warm light.
 */
export const FROST = {
  night: '#0b1830',
  panel: '#13284a',
  line: '#24426e',
  green: '#5cf2b0',
  teal: '#33c6d6',
  violet: '#9b7bff',
  snow: '#eef7ff',
  ice: '#bfe6ff',
  amber: '#ffc35a',
  muted: '#9fb4d6',
  text: '#d4e3f5',
} as const

export function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a * 9301 + 49297) % 233280
    return a / 233280
  }
}

/** A four-point sparkle centred on x, y, s from the centre to a tip. */
export function sparklePath(x: number, y: number, s: number): string {
  const k = s * 0.18
  return `M${x} ${y - s}Q${x + k} ${y - k} ${x + s} ${y}Q${x + k} ${y + k} ${x} ${y + s}Q${x - k} ${y + k} ${x - s} ${y}Q${x - k} ${y - k} ${x} ${y - s}z`
}

type TileOptions = { size?: number; height?: number; stars?: number; sparks?: number; biggest?: number; faintest?: number }

const tiles = new Map<string, string>()

/** A repeating tile of stars in `color`, as a CSS `url(...)` for background-image. */
export function starTile(color: string, seed: number, options: TileOptions = {}): string {
  const { size = 420, height = size, stars = 46, sparks = 2, biggest = 1.5, faintest = 0.35 } = options
  const key = `${color}|${seed}|${size}|${height}|${stars}|${sparks}|${biggest}|${faintest}`
  const known = tiles.get(key)
  if (known) return known
  const r = seeded(seed)
  let body = ''
  for (let i = 0; i < stars; i++) {
    body += `<circle cx="${(r() * size).toFixed(1)}" cy="${(r() * height).toFixed(1)}" r="${(0.5 + r() * biggest).toFixed(2)}" fill="${color}" opacity="${(faintest + r() * (1 - faintest)).toFixed(2)}"/>`
  }
  for (let i = 0; i < sparks; i++) {
    body += `<path d="${sparklePath(10 + r() * (size - 20), 10 + r() * (height - 20), 3 + r() * 3)}" fill="${color}" opacity="0.8"/>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}">${body}</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  tiles.set(key, url)
  return url
}

/**
 * A repeating tile of snow in `color`, Cold Snap's in place of stars: soft dots and a few little six-armed flakes.
 * Seeded the way frostCorners is, so the sky is the one Ramsey picked on the canvas.
 */
export function snowTile(color: string, seed: number, { size = 420, flakes = 6, dots = 26 } = {}): string {
  const key = `snow|${color}|${seed}|${size}|${flakes}|${dots}`
  const known = tiles.get(key)
  if (known) return known
  const r = parkMiller(seed)
  let body = ''
  for (let i = 0; i < dots; i++) {
    body += `<circle cx="${(r() * size).toFixed(1)}" cy="${(r() * size).toFixed(1)}" r="${(0.8 + r() * 1.8).toFixed(2)}" fill="${color}" opacity="${(0.25 + r() * 0.5).toFixed(2)}"/>`
  }
  for (let i = 0; i < flakes; i++) {
    const x = r() * size
    const y = r() * size
    const s = 3 + r() * 6
    const opacity = (0.35 + r() * 0.5).toFixed(2)
    let arms = ''
    for (let a = 0; a < 6; a++) {
      const t = (a * Math.PI) / 3
      arms += `M${x.toFixed(1)} ${y.toFixed(1)}L${(x + Math.cos(t) * s).toFixed(1)} ${(y + Math.sin(t) * s).toFixed(1)}`
      const mx = x + Math.cos(t) * s * 0.55
      const my = y + Math.sin(t) * s * 0.55
      for (const d of [-0.7, 0.7]) arms += `M${mx.toFixed(1)} ${my.toFixed(1)}L${(mx + Math.cos(t + d) * s * 0.35).toFixed(1)} ${(my + Math.sin(t + d) * s * 0.35).toFixed(1)}`
    }
    body += `<path d="${arms}" stroke="${color}" stroke-width="1.1" stroke-linecap="round" fill="none" opacity="${opacity}"/>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  tiles.set(key, url)
  return url
}

/**
 * Frost creeping in from the four corners of the page, Cold Snap's sky (Ramsey picked C, Frosted glass, 2026-10-07):
 * branching fern lines in `color`, drawn for a 1600 × 900 page and stretched to the window's.
 */
export function frostCorners(color: string): string {
  const key = `frost|${color}`
  const known = tiles.get(key)
  if (known) return known
  const r = parkMiller(21)
  let d = ''
  const branch = (x: number, y: number, a: number, len: number, depth: number) => {
    // Three branchings deep: deeper, the picture runs to megabytes, too much for a page's background to paint.
    if (depth > 3 || len < 6) return
    const ex = x + Math.cos(a) * len
    const ey = y + Math.sin(a) * len
    d += `M${x.toFixed(0)} ${y.toFixed(0)}L${ex.toFixed(0)} ${ey.toFixed(0)}`
    for (let i = 1; i <= 3; i++) {
      const t = i / 4
      const bx = x + (ex - x) * t
      const by = y + (ey - y) * t
      branch(bx, by, a + 0.75 + (r() - 0.5) * 0.3, len * 0.42, depth + 1)
      branch(bx, by, a - 0.75 + (r() - 0.5) * 0.3, len * 0.42, depth + 1)
    }
    branch(ex, ey, a + (r() - 0.5) * 0.5, len * 0.7, depth + 1)
  }
  for (let i = 0; i < 7; i++) branch(0, 0, 0.1 + i * 0.22 + (r() - 0.5) * 0.1, 120 + r() * 120, 0)
  // One corner's frost, drawn once and turned into each of the four.
  const corner = (turn: string) => `<use href="#f" transform="${turn}"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" preserveAspectRatio="none"><defs><path id="f" d="${d}" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/></defs>${corner('')}${corner('translate(1600 0) scale(-1 1)')}${corner('translate(0 900) scale(1 -1)')}${corner('translate(1600 900) scale(-1 -1)')}</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  tiles.set(key, url)
  return url
}

/** The seeded randomness the snow and frost were drawn with on the canvas Ramsey picked from. */
function parkMiller(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
