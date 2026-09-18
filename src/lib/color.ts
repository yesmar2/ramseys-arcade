/**
 * Canvas colour helpers.
 *
 * Games mix theme colours (which arrive as hex), the output of earlier mixes
 * (`rgb(...)`), and literal accents (often `hsl(...)`). Parsing has to cover all
 * three: a parser that quietly falls back on the ones it does not know produces
 * colours that are wrong but plausible, which is close to impossible to spot.
 */

type Rgb = { r: number; g: number; b: number }

/** Mid slate — only reached if a caller passes something genuinely unparseable. */
const FALLBACK: Rgb = { r: 26, g: 43, b: 60 }

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((h % 360) + 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = l - c / 2

  let rgb: [number, number, number]
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  }
}

export function parseColor(value: string): Rgb {
  const raw = value.trim()

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(raw)
  if (rgb) {
    const parts = rgb[1].split(',').map((p) => Number.parseFloat(p))
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return FALLBACK
    return { r: parts[0], g: parts[1], b: parts[2] }
  }

  const hsl = /^hsla?\(([^)]+)\)$/i.exec(raw)
  if (hsl) {
    const parts = hsl[1].split(',').map((p) => Number.parseFloat(p))
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return FALLBACK
    return hslToRgb(parts[0], parts[1] / 100, parts[2] / 100)
  }

  const hex = raw.replace('#', '')
  const full =
    hex.length === 3 ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] : hex
  if (full.length !== 6 || !/^[0-9a-f]{6}$/i.test(full)) return FALLBACK
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

/** Blend two colours. Returns `rgb(...)`, so results can be mixed again. */
export function mixColor(from: string, to: string, t: number): string {
  const a = parseColor(from)
  const b = parseColor(to)
  const k = Math.max(0, Math.min(1, t))
  const ch = (x: number, y: number) => Math.round(x + (y - x) * k)
  return `rgb(${ch(a.r, b.r)}, ${ch(a.g, b.g)}, ${ch(a.b, b.b)})`
}

/** Perceived brightness, 0–255. Used to check one colour reads against another. */
export function luminance(color: string): number {
  const { r, g, b } = parseColor(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Restate a colour at a given alpha, whatever form it arrived in. */
export function withAlpha(color: string, a: number): string {
  const { r, g, b } = parseColor(color)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`
}

/* ---------- readable text on a coloured fill ---------- */

function toLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0–1. Not the same thing as perceived brightness. */
function relativeLuminance(color: string): number {
  const { r, g, b } = parseColor(color)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/** WCAG contrast ratio between two colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Text that can be read on a given fill.
 *
 * Game accents run from deep violet to butter yellow, so a button painted in
 * one cannot always take white — on the yellows it comes out at under 2:1.
 * Whichever of the two inks holds up better wins.
 */
export function inkOn(background: string, dark = '#1a2b3c', light = '#ffffff'): string {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light
}
