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
  return {
    fill: `color-mix(in srgb, hsla(${hue}, ${sat}%, 56%, 1) ${mix}%, var(--playfield))`,
    stroke: `hsla(${hue}, ${sat}%, 38%, 0.95)`,
  }
}
