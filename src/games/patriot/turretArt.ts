/** Patriot battery silhouette — origin at bottom center, y negative = up. */
export const PATRIOT_TURRET_SILHOUETTE = [
  { x: -15, y: 0 },
  { x: -15, y: -9 },
  { x: -6, y: -9 },
  { x: -4, y: -28 },
  { x: 4, y: -28 },
  { x: 6, y: -9 },
  { x: 15, y: -9 },
  { x: 15, y: 0 },
] as const

/** Matches Patriot game accent (rose). */
export const PATRIOT_TURRET_HUE = 348

export const PATRIOT_TURRET_HALF_WIDTH = 15

export function patriotTurretPoints(
  centerX: number,
  groundY: number,
  scale: number,
): { x: number; y: number }[] {
  return PATRIOT_TURRET_SILHOUETTE.map((p) => ({
    x: centerX + p.x * scale,
    y: groundY + p.y * scale,
  }))
}

export function patriotTurretSvgPath(
  centerX: number,
  groundY: number,
  scale: number,
): string {
  const pts = patriotTurretPoints(centerX, groundY, scale)
  if (pts.length === 0) return ''
  const [first, ...rest] = pts
  return (
    `M ${first.x} ${first.y} ` +
    rest.map((p) => `L ${p.x} ${p.y}`).join(' ') +
    ' Z'
  )
}
