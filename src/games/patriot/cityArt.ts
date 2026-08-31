/** Patriot city skyline — matches the three-building blocks drawn in-game. */
export const PATRIOT_CITY_DRAW = 1.85

/** Rose red — Patriot accent for all cities. */
export const PATRIOT_CITY_HUE = 348

export const PATRIOT_CITY_HEIGHTS = [
  [20, 30, 18],
  [18, 28, 22],
  [22, 26, 16],
  [16, 32, 20],
  [20, 24, 18],
  [18, 30, 16],
] as const

const PATRIOT_CITY_BLOCKS = [
  { x: -18, w: 10 },
  { x: -5, w: 10 },
  { x: 8, w: 10 },
] as const

export type PatriotCityRect = {
  x: number
  y: number
  width: number
  height: number
  hue: number
}

export function patriotCityRects(
  centerX: number,
  groundY: number,
  scale: number,
  cityId = 0,
): PatriotCityRect[] {
  const s = scale * PATRIOT_CITY_DRAW
  const hue = PATRIOT_CITY_HUES[cityId % PATRIOT_CITY_HUES.length]
  const heights = PATRIOT_CITY_HEIGHTS[cityId % PATRIOT_CITY_HEIGHTS.length]

  return PATRIOT_CITY_BLOCKS.map((block, i) => {
    const width = block.w * s
    const height = heights[i] * s
    return {
      x: centerX + block.x * s,
      y: groundY - height,
      width,
      height,
      hue,
    }
  })
}
