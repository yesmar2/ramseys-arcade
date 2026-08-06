/** Fit a fixed aspect rectangle inside an outer box (letterbox / pillarbox). */
export function fitStage(
  outerW: number,
  outerH: number,
  aspectW: number,
  aspectH: number,
): { w: number; h: number } {
  if (outerW <= 0 || outerH <= 0 || aspectW <= 0 || aspectH <= 0) {
    return { w: 0, h: 0 }
  }
  const target = aspectW / aspectH
  const outer = outerW / outerH
  if (outer > target) {
    const h = outerH
    return { w: h * target, h }
  }
  const w = outerW
  return { w, h: w / target }
}

/** Logical stage ratios — keep playfields fair across devices. */
export const STAGE_ASPECT = {
  stacker: { w: 3, h: 4 },
  patriot: { w: 16, h: 9 },
  /** Matches Snake grid 21×15 */
  snake: { w: 7, h: 5 },
} as const
