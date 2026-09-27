/*
 * A Hot Lap track from above, as an SVG draws it: the road's line, how wide to draw it, the start line
 * across it and a dot for the car on the grid. Today's Track card and the admin's Track Book both draw
 * from it; each brings its own colours.
 */
import { HALF_WIDTH, type Track } from './sim.ts'

export type TrackPlanShape = {
  viewBox: string
  /** The road's middle, round the lap and closed. */
  d: string
  /** The road's drawn width, a little wider than it is, so a big track still reads as a road. */
  road: number
  start: { x1: number; y1: number; x2: number; y2: number }
  car: { x: number; y: number; r: number }
}

/** A built track (as it lies on the map: pass its heading to buildTrack) laid out on the screen, y down. */
export function trackPlan(track: Track): TrackPlanShape {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < track.n; i++) {
    minX = Math.min(minX, track.x[i]!)
    maxX = Math.max(maxX, track.x[i]!)
    minY = Math.min(minY, -track.y[i]!)
    maxY = Math.max(maxY, -track.y[i]!)
  }
  const size = Math.max(maxX - minX, maxY - minY)
  const pad = size * 0.16
  const stride = Math.max(1, Math.round(track.n / 420))
  const points: string[] = []
  for (let i = 0; i < track.n; i += stride) points.push(`${track.x[i]!.toFixed(1)} ${(-track.y[i]!).toFixed(1)}`)
  const road = Math.max(HALF_WIDTH * 2, size / 70)
  const s = track.startIndex
  const sx = track.x[s]!
  const sy = -track.y[s]!
  const h = track.h[s]!
  // Across the road at the start, on the screen's y (down).
  const nx = -Math.sin(-h)
  const ny = Math.cos(-h)
  const half = road * 0.62
  return {
    viewBox: `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + pad * 2).toFixed(1)} ${(maxY - minY + pad * 2).toFixed(1)}`,
    d: `M${points.join('L')}Z`,
    road,
    start: { x1: sx - nx * half, y1: sy - ny * half, x2: sx + nx * half, y2: sy + ny * half },
    car: { x: sx - Math.cos(-h) * road * 1.1, y: sy - Math.sin(-h) * road * 1.1, r: road * 0.42 },
  }
}
