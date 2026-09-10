import { isFlatTheme } from '../lib/theme'

/** Shared palette for tile and thumb illustrations. */
export const HUE = {
  sky: 198,
  teal: 172,
  gold: 38,
  rose: 348,
  violet: 272,
  orange: 18,
  green: 128,
} as const

export function pastel(hue: number, sat = 56, mix = 48) {
  const flat = isFlatTheme()
  const m = flat ? Math.max(mix, 70) : mix
  return {
    fill: `color-mix(in srgb, hsla(${hue}, ${sat}%, 56%, 1) ${m}%, var(--playfield))`,
    stroke: flat ? 'none' : `hsla(${hue}, ${sat}%, 38%, 0.95)`,
  }
}

/** Pastel fill/stroke derived from a game's accent hex (buttons, tiles, etc.). */
export function accentPastel(accent: string, mix = 48) {
  const flat = isFlatTheme()
  const m = flat ? Math.max(mix, 70) : mix
  return {
    fill: `color-mix(in srgb, ${accent} ${m}%, var(--playfield))`,
    stroke: flat ? 'none' : `color-mix(in srgb, ${accent} 78%, #1a1a1a)`,
  }
}

/** Outline props for filled SVG shapes — omitted in flat theme. */
export function outlineStroke(color: string, width: number | string) {
  if (isFlatTheme()) {
    return { stroke: 'none' as const, strokeWidth: 0 as const }
  }
  return { stroke: color, strokeWidth: width }
}
