/*
 * The screen saver's path (components/BlipSaver.tsx). The blip crosses the screen at a steady speed and
 * bounces off its edges, like an old DVD player's logo, and it's aimed to land exactly in a corner some
 * seconds on, which is the moment everyone waits for. Positions come from the time alone: along an
 * unfolded line the blip only ever moves forward, and folding that line back and forth across the room
 * it has is the bouncing.
 */

export type SaverPlan = {
  /** Room to move in: the screen less the logo's own size. */
  w: number
  h: number
  /** Where it starts on the unfolded lines, and how fast it goes along them (px, px/s, both positive). */
  x0: number
  y0: number
  vx: number
  vy: number
  /** Seconds from the plan's start to the corner. */
  cornerIn: number
}

/** A point on an unfolded line, folded back and forth into [0, span]. */
function fold(u: number, span: number): number {
  if (span <= 0) return 0
  const p = ((u % (2 * span)) + 2 * span) % (2 * span)
  return p <= span ? p : 2 * span - p
}

/** The unfolded point for a place and a heading: heading back is the second half of each fold. */
function unfold(at: number, span: number, dir: 1 | -1): number {
  const x = Math.min(Math.max(at, 0), span)
  return dir > 0 ? x : 2 * span - x
}

/**
 * A speed along one line that reaches a whole number of spans, a wall, exactly `seconds` on, as near
 * as can be to the speed wanted.
 */
function aimLine(u0: number, span: number, want: number, seconds: number): number {
  if (span <= 0) return want
  const steps = Math.max(Math.floor(u0 / span) + 1, Math.round((u0 + want * seconds) / span))
  return (steps * span - u0) / seconds
}

/**
 * The path from (x, y), heading (dirX, dirY), at about `speed` px/s and `angle` radians off level, that
 * lands in a corner `cornerIn` seconds on.
 */
export function aimSaver(opts: {
  w: number
  h: number
  x: number
  y: number
  dirX: 1 | -1
  dirY: 1 | -1
  speed: number
  angle: number
  cornerIn: number
}): SaverPlan {
  const { w, h, speed, angle, cornerIn } = opts
  const x0 = unfold(opts.x, w, opts.dirX)
  const y0 = unfold(opts.y, h, opts.dirY)
  return {
    w,
    h,
    x0,
    y0,
    vx: aimLine(x0, w, speed * Math.cos(angle), cornerIn),
    vy: aimLine(y0, h, speed * Math.sin(angle), cornerIn),
    cornerIn,
  }
}

/** Where the blip is `t` seconds into a plan, and how many walls it has met on each line since its start. */
export function saverAt(plan: SaverPlan, t: number): { x: number; y: number; wallsX: number; wallsY: number } {
  const ux = plan.x0 + plan.vx * t
  const uy = plan.y0 + plan.vy * t
  return {
    x: fold(ux, plan.w),
    y: fold(uy, plan.h),
    wallsX: plan.w > 0 ? Math.floor(ux / plan.w) : 0,
    wallsY: plan.h > 0 ? Math.floor(uy / plan.h) : 0,
  }
}

/** Which way the blip is heading `t` seconds in: along each line, toward the far wall or back. */
export function saverHeading(plan: SaverPlan, t: number): { dirX: 1 | -1; dirY: 1 | -1 } {
  const side = (u: number, span: number): 1 | -1 => {
    if (span <= 0) return 1
    const p = ((u % (2 * span)) + 2 * span) % (2 * span)
    return p < span ? 1 : -1
  }
  return { dirX: side(plan.x0 + plan.vx * t, plan.w), dirY: side(plan.y0 + plan.vy * t, plan.h) }
}
