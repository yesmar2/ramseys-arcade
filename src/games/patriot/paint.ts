import { PALETTE, type Swatch } from '../../data/games'
import { isDarkTheme, playfieldColor } from '../../lib/theme'
import type { Tone } from './game'

/*
 * Colour for Patriot's canvas: the theme's sky and ground, and every palette
 * colour as the outline, soft fill or effect shade it takes against them.
 * Shared by the scene and the craft, so both draw from one set of rules.
 */

export type RGB = [number, number, number]

export function css(c: RGB, a = 1) {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function hexRgb(hex: string): RGB {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function hslRgb(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function hueOfRgb([r, g, b]: RGB) {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  if (max === min) return 0
  const d = max - min
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return h * 60
}

const swatchHues = new Map<Swatch, number>()

/** A palette colour's hue, so every outline and fill stays inside the site's ten colours. */
export function hue(s: Swatch) {
  let h = swatchHues.get(s)
  if (h === undefined) {
    h = Math.round(hueOfRgb(hexRgb(PALETTE[s])))
    swatchHues.set(s, h)
  }
  return h
}

export function hsla(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

export function clamp01(t: number) {
  return Math.max(0, Math.min(1, t))
}

export function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function hash(a: number, b = 0, c = 0, d = 0) {
  const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + d * 191.3) * 43758.5453
  return n - Math.floor(n)
}

export type Skin = {
  key: string
  dark: boolean
  field: RGB
  skyTop: RGB
  skyLow: RGB
  hillFar: RGB
  hillNear: RGB
  ground: RGB
  ink: RGB
  /** Outline lightness, %. */
  lineL: number
}

let cachedSkin: Skin | null = null

export function skin(): Skin {
  const field = playfieldColor()
  const dark = isDarkTheme()
  const key = `${field}|${dark}`
  if (cachedSkin?.key === key) return cachedSkin
  const f = field.startsWith('#') ? hexRgb(field) : ([18, 28, 36] as RGB)
  const teal = hslRgb(hue('teal'), 0.6, 0.5)
  const green = hslRgb(hue('green'), 0.55, 0.5)
  const amber = hslRgb(hue('amber'), 0.9, 0.6)
  cachedSkin = dark
    ? {
        key,
        dark,
        field: f,
        skyTop: mix(f, [3, 6, 12], 0.45),
        // The glow a city throws up into the night.
        skyLow: mix(mix(f, teal, 0.1), amber, 0.07),
        hillFar: mix(mix(f, [3, 6, 12], 0.15), teal, 0.1),
        hillNear: mix(mix(f, [3, 6, 12], 0.25), teal, 0.14),
        ground: mix(mix(f, [3, 6, 12], 0.3), green, 0.12),
        ink: [231, 238, 243],
        lineL: 64,
      }
    : {
        key,
        dark,
        field: f,
        skyTop: mix(f, [214, 236, 248], 0.55),
        // Dawn along the horizon.
        skyLow: mix(f, amber, 0.2),
        hillFar: mix(f, teal, 0.16),
        hillNear: mix(f, teal, 0.24),
        ground: mix(f, green, 0.3),
        ink: [26, 43, 60],
        lineL: 42,
      }
  return cachedSkin
}

/** A palette colour's outline on this sky. */
export function outline(sk: Skin, s: Swatch | number, a = 0.95, sat = 64) {
  const h = typeof s === 'number' ? s : hue(s)
  return hsla(h, sat, sk.lineL, a)
}

/** A soft fill, opaque, mixed over `under`. */
export function soft(under: RGB, s: Swatch | number, amount: number, sat = 0.64) {
  const h = typeof s === 'number' ? s : hue(s)
  return css(mix(under, hslRgb(h, sat, 0.58), amount))
}

/** Small marks inside a shape: light on a dark sky, deep on a pale one. */
export function markColor(sk: Skin, s: Swatch | number, a = 0.9) {
  const h = typeof s === 'number' ? s : hue(s)
  return hsla(h, 60, sk.dark ? 86 : 30, a)
}

export function toneColor(sk: Skin, tone: Tone | undefined, a = 1): string {
  switch (tone) {
    case 'red':
      return hsla(hue('red'), 80, sk.dark ? 66 : 46, a)
    case 'teal':
      return hsla(hue('teal'), 70, sk.dark ? 62 : 36, a)
    case 'sky':
      return hsla(hue('sky'), 76, sk.dark ? 66 : 42, a)
    case 'violet':
      return hsla(hue('violet'), 70, sk.dark ? 72 : 48, a)
    case 'ink':
      return css(sk.ink, a)
    case 'orange':
      return hsla(hue('orange'), 86, sk.dark ? 62 : 46, a)
    case 'green':
      return hsla(hue('green'), 70, sk.dark ? 60 : 36, a)
    case 'pink':
      return hsla(hue('pink'), 76, sk.dark ? 68 : 46, a)
    case 'hot':
      return hsla(hue('orange'), 92, sk.dark ? 64 : 48, a)
    default:
      return sk.dark ? `rgba(245, 190, 72, ${a})` : hsla(hue('amber'), 80, 34, a)
  }
}
