/*
 * The Swoop bird's shape: a swift, sleek, with long scythe wings and a forked tail. Ramsey picked A from the
 * "Pellets + Swoop pictures" canvas, 2026-10-06 ("I like A"), over the round bird it was. In a unit frame,
 * facing right, the body's middle at the origin, as SVG path data, so the game's renderer (scene.ts drawBird,
 * through Path2D) and the pictures (BirdMark.tsx) draw the same bird.
 */

/** The body, with the forked tail behind it. */
export const SWIFT_BODY =
  'M1.25 -0.05 C0.95 -0.62 -0.15 -0.72 -0.85 -0.28 L-1.75 -0.62 L-1.28 -0.04 L-1.8 0.34 L-0.85 0.2 C-0.3 0.58 0.85 0.52 1.25 -0.05 Z'

/** The pale throat and belly. */
export const SWIFT_BELLY = 'M1.1 0.08 C0.7 0.42 -0.1 0.46 -0.6 0.22 C-0.05 0.3 0.6 0.22 1.1 0.08 Z'

export const SWIFT_BEAK = 'M1.2 -0.14 L1.62 -0.02 L1.2 0.07 Z'

/** The wing raised, swept up and back: it beats from here, turning about its root. */
export const SWIFT_WING_UP = 'M0.25 -0.32 C-0.15 -1.0 -0.85 -1.5 -1.65 -1.6 C-1.05 -1.1 -0.65 -0.6 -0.4 -0.12 Z'

/** The wing folded along the body: in a dive and on the hill. */
export const SWIFT_WING_FOLDED = 'M0.35 -0.24 C-0.25 -0.48 -1.1 -0.5 -2.0 -0.22 C-1.1 -0.04 -0.4 0.0 0.35 -0.04 Z'

/** Where the wing meets the body, which it turns about as it beats. */
export const SWIFT_WING_ROOT: readonly [number, number] = [0.1, -0.25]

/** How far the wing turns down from raised at the bottom of a beat, in radians. */
export const SWIFT_BEAT = 0.95

/** The eye's middle and size, and its pupil's. */
export const SWIFT_EYE = { x: 0.74, y: -0.2, r: 0.17, px: 0.8, pr: 0.09 }

/** How high the body's middle sits over the ground, sitting on a hill. */
export const SWIFT_LIFT = 0.55
