/*
 * A stand-in ghost's clock (each racing daily's boardGhost.ts standIn: a player whose own run isn't known,
 * shown on the blue's line at their time). It launches as the blue did, then eases onto a pace of its own
 * that makes up (or loses) the whole difference by the line. Played evenly faster from the start, a ghost
 * 15% under the blue launched about 1.4 times harder than any car can (Ramsey, 2026-10-06: "how did nova
 * get such a good jump start though?").
 */

/** Seconds the stand-in runs exactly as the blue did, off the start. */
const LAUNCH_S = 1.5
/** Seconds it then takes to ease onto its own pace. */
const EASE_S = 3

export type GhostWarp = {
  /** Where on the blue's own clock the stand-in is, `t` seconds into its run. */
  lineAt: (t: number) => number
  /** When the stand-in reaches the blue's moment `s` (a sector's end, say), on its own clock. */
  ghostAt: (s: number) => number
}

/** The clock of a stand-in that runs in `time` seconds along a line that took `lineTime`. */
export function launchWarp(lineTime: number, time: number): GhostWarp {
  // Where its own pace is fully on, its clock is this far behind the blue's.
  const settle = LAUNCH_S + EASE_S / 2
  // A run too short to launch and then make its time up: in step all the way, as stand-ins always were.
  if (!(lineTime > settle + 1) || !(time > settle + 1)) {
    const scale = time / lineTime
    return { lineAt: (t) => t / scale, ghostAt: (s) => s * scale }
  }
  // The blue's seconds to each of the stand-in's once its pace is on: over 1 when it's faster.
  const rate = 1 + (lineTime - time) / (time - settle)
  const lineAt = (t: number): number => {
    if (t <= LAUNCH_S) return t
    if (t >= LAUNCH_S + EASE_S) return t + (rate - 1) * (t - settle)
    // The pace eases from the blue's to its own along a smoothstep, 3x² − 2x³, whose sum to x is x³ − x⁴/2.
    const x = (t - LAUNCH_S) / EASE_S
    return t + (rate - 1) * EASE_S * (x ** 3 - x ** 4 / 2)
  }
  const ghostAt = (s: number): number => {
    // lineAt only ever grows, so halve the stand-in's clock down to the moment.
    let lo = 0
    let hi = time
    for (let n = 0; n < 40; n++) {
      const mid = (lo + hi) / 2
      if (lineAt(mid) < s) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  return { lineAt, ghostAt }
}
