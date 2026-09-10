import {
  GOOGLE_BLUE,
  GOOGLE_GREEN,
  GOOGLE_RED,
  GOOGLE_YELLOW,
  isFlatTheme,
  isGoogleTheme,
} from '../lib/theme'

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

/** Map any illustration hue onto a classic Google primary hex. */
function googleHexForHue(hue: number): string {
  const targets: [number, string][] = [
    [217, GOOGLE_BLUE],
    [198, GOOGLE_BLUE],
    [4, GOOGLE_RED],
    [348, GOOGLE_RED],
    [272, GOOGLE_RED],
    [18, GOOGLE_RED],
    [45, GOOGLE_YELLOW],
    [38, GOOGLE_YELLOW],
    [141, GOOGLE_GREEN],
    [128, GOOGLE_GREEN],
    [172, GOOGLE_GREEN],
  ]
  let best = GOOGLE_BLUE
  let bestDist = 999
  for (const [t, hex] of targets) {
    const d = Math.min(Math.abs(hue - t), 360 - Math.abs(hue - t))
    if (d < bestDist) {
      bestDist = d
      best = hex
    }
  }
  return best
}

export function pastel(hue: number, sat = 56, mix = 48) {
  const flat = isFlatTheme()
  const google = isGoogleTheme()
  if (google) {
    const hex = googleHexForHue(hue)
    const m = Math.max(mix, 90)
    return {
      fill: `color-mix(in srgb, ${hex} ${m}%, var(--playfield))`,
      stroke: 'none',
    }
  }
  const light = 56
  const m = flat ? Math.max(mix, 70) : mix
  return {
    fill: `color-mix(in srgb, hsla(${hue}, ${sat}%, ${light}%, 1) ${m}%, var(--playfield))`,
    stroke: flat ? 'none' : `hsla(${hue}, ${sat}%, 38%, 0.95)`,
  }
}

/** Pastel fill/stroke derived from a game's accent hex (buttons, tiles, etc.). */
export function accentPastel(accent: string, mix = 48) {
  const flat = isFlatTheme()
  const google = isGoogleTheme()
  const m = flat ? Math.max(mix, google ? 92 : 70) : mix
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
