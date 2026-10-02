/*
 * Small drawing helpers for the season's look (Season 1, Space Race): a seeded
 * star field as a CSS background tile, and the four-point sparkle the patches
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
