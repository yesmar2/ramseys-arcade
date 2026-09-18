/** Shared palette for tile and thumb illustrations. */
export const HUE = {
  sky: 198,
  teal: 172,
  gold: 38,
  rose: 348,
  violet: 272,
  orange: 18,
  green: 128,
  /** Crumbtrail's own green — clear of every chaser and fruit hue in that game. */
  crumb: 152,
} as const

/** A pastel fill from a hue, with the outline that goes with it. */
export function pastel(hue: number, sat = 56, mix = 48) {
  return {
    fill: `color-mix(in srgb, hsla(${hue}, ${sat}%, 56%, 1) ${mix}%, var(--playfield))`,
    stroke: `hsla(${hue}, ${sat}%, 38%, 0.95)`,
  }
}

/** Pastel fill/stroke derived from a game's accent hex (buttons, tiles, etc.). */
export function accentPastel(accent: string, mix = 48) {
  return {
    fill: `color-mix(in srgb, ${accent} ${mix}%, var(--playfield))`,
    stroke: `color-mix(in srgb, ${accent} 78%, #1a1a1a)`,
  }
}

/** Outline props for filled SVG shapes. */
export function outlineStroke(color: string, width: number | string) {
  return { stroke: color, strokeWidth: width }
}
