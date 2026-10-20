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

/**
 * The fill for a button in this colour, with inkOn's ink on it.
 *
 * The middle of the range (indigo, violet, red, pink, magenta) holds neither
 * ink at 4.5:1, so there the colour moves the least it must for its ink to
 * read: darker under white, lighter under the dark ink. Every other colour
 * comes back as it is.
 */
export function readableFill(background: string, dark = '#1a2b3c', light = '#ffffff'): string {
  const ink = inkOn(background, dark, light)
  const away = ink === light ? '#000000' : '#ffffff'
  let fill = background
  for (let t = 0.02; contrastRatio(fill, ink) < 4.5 && t <= 0.5; t += 0.02) fill = mixColor(background, away, t)
  return fill
}

/**
 * Words in a colour on a given background: the colour as it is where it reads
 * there (4.5:1), else the nearest shade of it that does, darker on a light
 * background and lighter on a dark one. It moves toward black or white, which
 * keeps the colour's hue (toward the ink, the warm ones turn khaki), and only
 * as far as it must. `toward` fixes the way: the dark theme's words only ever
 * go lighter, whatever the colour under them.
 */
export function readableText(color: string, background: string, toward?: '#000000' | '#ffffff'): string {
  const away = toward ?? (contrastRatio(background, '#000000') >= contrastRatio(background, '#ffffff') ? '#000000' : '#ffffff')
  let text = color
  for (let t = 0.02; contrastRatio(text, background) < 4.5 && t <= 1; t += 0.02) text = mixColor(color, away, t)
  return text
}

/** A banner's words in its own colour on the light theme, read against its deepest wash (38% over white, home.css). */
export function bannerText(accent: string): string {
  return readableText(accent, mixColor(accent, '#ffffff', 0.62))
}

/**
 * A game tile's words in its colour on the light theme (home.css --wall-accent-ink): the tile's mix of it with the
 * ink (62%), deepened only where it must be to read on the tile and on its scores, which lie on a 94% scrim over the
 * game's picture (read where the picture is darkest). The yellows, greens and cyans held 3.6 to 3.9:1 on the tile.
 */
export function tileText(accent: string): string {
  return readableText(mixColor(accent, '#1a2b3c', 0.38), mixColor('#f6f9fb', '#000000', 0.06))
}

/** The dark banner's own light mix of a colour for its words (55% with white, home.css). */
const darkBannerWords = (accent: string) => mixColor(accent, '#ffffff', 0.45)

/**
 * The same on the dark theme: the dark banner's mix, lightened (never darkened) only where it must be to read
 * (4.5:1) on the banner's wash at its brightest, half the colour into the night. Most colours come back as the mix.
 */
export function bannerTextDark(accent: string): string {
  return readableText(darkBannerWords(accent), mixColor(accent, '#0b1620', 0.5), '#ffffff')
}

/**
 * A player card's See all links on the dark theme (PlayerCard.tsx): the same mix, lightened only as far as it must
 * be to read on a shelf, whose panel (profile.css) lies over the card's wash mid-card or toward its teal end
 * (home.css), whichever is lighter. The card's other words sit on the wash, where the mix reads as it is.
 */
export function shelfTextDark(accent: string): string {
  const night = '#0b1620'
  const shelf = (wash: string) => mixColor(wash, '#ffffff', 0.084)
  const mid = shelf(mixColor(accent, night, 0.66))
  const end = shelf(mixColor(accent, mixColor('#2eb8a0', night, 0.65), 0.76))
  return readableText(darkBannerWords(accent), contrastRatio(mid, '#000000') > contrastRatio(end, '#000000') ? mid : end, '#ffffff')
}
