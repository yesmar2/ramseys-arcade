import { SWIFT_BEAK, SWIFT_BEAT, SWIFT_BODY, SWIFT_EYE, SWIFT_WING_FOLDED, SWIFT_WING_ROOT, SWIFT_WING_UP } from './birdShape'

/*
 * The birds Swoop's look on test can fly (swiftPaint.ts paints whichever is chosen: vista.ts BIRD_DESIGN). The
 * swift is the bird Ramsey picked on 2026-10-06, repainted; the others are here to choose between, since he asked
 * of the repainted swift, 2026-11-17: "i'd like to see other options for bird redesign too".
 *
 * Every one is drawn in the swift's unit frame (birdShape.ts): facing right, the body's middle at the origin,
 * about three and a half units from tail to beak, its belly a little over half a unit under the middle, so any of
 * them sits on a hill, flies and lands where the swift does. A bird is its outline, the patches of colour laid
 * over it (each in one of the bird's tones: swiftPaint.ts SwiftColours), a beak in two halves, a wing raised
 * (which beats about its root) and the same wing folded, and an eye.
 */

/** A patch of colour: its shape, which of the bird's tones fills it, how strongly, and whether it's too fine for a bird of the flock. */
export type Patch = { d: string; tone: Tone; alpha?: number; fine?: boolean }

export type Tone = 'body' | 'lit' | 'belly' | 'under' | 'wing' | 'wingLit' | 'wingFar' | 'beak' | 'beakLow'

export type BirdDesign = {
  key: string
  /** What's drawn behind the body and outlined with it: a crest. */
  behind: readonly Patch[]
  body: string
  /** Over the body, under its outline, in order. */
  patches: readonly Patch[]
  beak: string
  beakTop: string
  beakLow: string
  /** The wing raised, the patches on it, and where it turns about and how far a beat takes it down. */
  wing: string
  wingPatches: readonly Patch[]
  wingRoot: readonly [number, number]
  beat: number
  /** The wing folded, in a dive and on the hill, and the patches on it. */
  folded: string
  foldedPatches: readonly Patch[]
  /** The eye's middle and size, and its pupil's; `dot` for an eye that's only a dot. */
  eye: { x: number; y: number; r: number; px: number; pr: number; dot?: boolean }
  /** Folded from paper: it's always drawn as a cut-out, with a shadow and no outline, whatever the others have. */
  paper?: boolean
}

/** The swift: sleek, with long scythe wings and a forked tail (birdShape.ts). */
export const SWIFT: BirdDesign = {
  key: 'swift',
  behind: [],
  body: SWIFT_BODY,
  patches: [
    // The forked tail, from where it leaves the body, a tone deeper.
    { d: 'M-0.8 -0.3 L-1.75 -0.62 L-1.28 -0.04 L-1.8 0.34 L-0.8 0.21 C-0.96 0.06 -0.96 -0.14 -0.8 -0.3 Z', tone: 'wing' },
    // The pale throat and belly: under a line from the beak back to the vent, down to the body's own edge.
    { d: 'M1.22 -0.03 C0.95 0.12 0.55 0.16 0.15 0.14 C-0.2 0.12 -0.55 0.16 -0.82 0.2 C-0.3 0.58 0.85 0.52 1.25 -0.05 Z', tone: 'belly' },
    // The shade under the belly, and the light along the back from the nape to the rump.
    { d: 'M1.02 0.2 C0.6 0.5 -0.25 0.52 -0.76 0.24 C-0.25 0.4 0.5 0.4 1.02 0.2 Z', tone: 'under', alpha: 0.3, fine: true },
    { d: 'M0.98 -0.36 C0.7 -0.64 -0.15 -0.68 -0.76 -0.31 C-0.2 -0.5 0.55 -0.5 0.98 -0.36 Z', tone: 'lit', fine: true },
  ],
  beak: SWIFT_BEAK,
  beakTop: 'M1.2 -0.14 L1.62 -0.02 L1.2 -0.01 Z',
  beakLow: 'M1.2 -0.01 L1.62 -0.02 L1.2 0.07 Z',
  wing: SWIFT_WING_UP,
  wingPatches: [
    // The shoulder, in the body's own colour, and the leading edge, where the light catches it.
    { d: 'M0.22 -0.3 C0.0 -0.62 -0.3 -0.8 -0.62 -0.86 C-0.5 -0.6 -0.42 -0.36 -0.36 -0.14 Z', tone: 'body', fine: true },
    { d: 'M0.25 -0.32 C-0.15 -1.0 -0.85 -1.5 -1.65 -1.6 C-0.92 -1.36 -0.3 -0.94 0.0 -0.3 Z', tone: 'wingLit' },
  ],
  wingRoot: SWIFT_WING_ROOT,
  beat: SWIFT_BEAT,
  folded: SWIFT_WING_FOLDED,
  foldedPatches: [{ d: 'M0.35 -0.24 C-0.25 -0.48 -1.1 -0.5 -2.0 -0.22 C-1.1 -0.38 -0.3 -0.36 0.3 -0.17 Z', tone: 'wingLit' }],
  eye: { x: SWIFT_EYE.x, y: SWIFT_EYE.y, r: SWIFT_EYE.r * 1.14, px: SWIFT_EYE.px + 0.01, pr: SWIFT_EYE.pr * 1.25 },
}

/** The swallow: rounder and friendlier, a big head and eye, a blush on its cheek, and two long streamers for a tail. */
export const SWALLOW: BirdDesign = {
  key: 'swallow',
  behind: [],
  body: 'M1.1 -0.02 C1.06 -0.5 0.6 -0.76 0.12 -0.72 C-0.38 -0.68 -0.76 -0.5 -1.0 -0.22 L-2.05 -0.6 L-1.4 -0.03 L-2.1 0.42 L-1.0 0.25 C-0.62 0.52 -0.02 0.6 0.44 0.54 C0.86 0.48 1.12 0.28 1.1 -0.02 Z',
  patches: [
    { d: 'M-0.94 -0.26 L-2.05 -0.6 L-1.4 -0.03 L-2.1 0.42 L-0.94 0.26 C-1.1 0.09 -1.1 -0.1 -0.94 -0.26 Z', tone: 'wing' },
    { d: 'M1.1 0.0 C0.9 0.0 0.62 0.07 0.36 0.17 C0.0 0.3 -0.52 0.28 -0.98 0.25 C-0.62 0.52 -0.02 0.6 0.44 0.54 C0.86 0.48 1.12 0.28 1.1 0.0 Z', tone: 'belly' },
    { d: 'M0.95 0.28 C0.6 0.52 -0.2 0.56 -0.8 0.3 C-0.25 0.44 0.5 0.42 0.95 0.28 Z', tone: 'under', alpha: 0.3, fine: true },
    { d: 'M0.92 -0.44 C0.6 -0.72 -0.12 -0.72 -0.82 -0.36 C-0.25 -0.56 0.5 -0.58 0.92 -0.44 Z', tone: 'lit', fine: true },
    // A blush on its cheek.
    { d: 'M0.58 0.06 A0.14 0.11 0 1 1 0.3 0.06 A0.14 0.11 0 1 1 0.58 0.06 Z', tone: 'lit', alpha: 0.75, fine: true },
  ],
  beak: 'M1.06 -0.13 L1.44 -0.02 L1.07 0.1 Z',
  beakTop: 'M1.06 -0.13 L1.44 -0.02 L1.06 -0.01 Z',
  beakLow: 'M1.06 -0.01 L1.44 -0.02 L1.07 0.1 Z',
  wing: 'M0.32 -0.36 C0.08 -0.98 -0.48 -1.42 -1.25 -1.52 C-0.9 -1.08 -0.62 -0.62 -0.42 -0.1 Z',
  wingPatches: [
    { d: 'M0.3 -0.34 C0.12 -0.66 -0.12 -0.84 -0.42 -0.9 C-0.36 -0.62 -0.34 -0.38 -0.36 -0.14 Z', tone: 'body', fine: true },
    { d: 'M0.32 -0.36 C0.08 -0.98 -0.48 -1.42 -1.25 -1.52 C-0.7 -1.26 -0.2 -0.92 0.08 -0.34 Z', tone: 'wingLit' },
  ],
  wingRoot: [0.14, -0.28],
  beat: 1.0,
  folded: 'M0.4 -0.24 C-0.2 -0.48 -0.95 -0.48 -1.72 -0.24 C-0.95 -0.03 -0.3 0.02 0.4 -0.03 Z',
  foldedPatches: [{ d: 'M0.4 -0.24 C-0.2 -0.48 -0.95 -0.48 -1.72 -0.24 C-0.95 -0.36 -0.28 -0.36 0.34 -0.16 Z', tone: 'wingLit' }],
  eye: { x: 0.62, y: -0.2, r: 0.22, px: 0.68, pr: 0.12 },
}

/** The kingfisher: a diver, all head: a crest, a long dagger of a beak, a dark cap, a pale collar, and a stub of a tail. */
export const KINGFISHER: BirdDesign = {
  key: 'kingfisher',
  behind: [{ d: 'M0.64 -0.68 L0.4 -1.08 L0.38 -0.76 L0.08 -1.06 L0.12 -0.76 L-0.28 -0.96 L-0.14 -0.66 Z', tone: 'wing' }],
  body: 'M0.98 -0.06 C0.98 -0.52 0.62 -0.8 0.16 -0.76 C-0.34 -0.72 -0.8 -0.52 -1.06 -0.22 L-1.62 -0.34 L-1.56 0.2 L-1.04 0.24 C-0.7 0.52 -0.1 0.58 0.36 0.53 C0.76 0.47 0.98 0.28 0.98 -0.06 Z',
  patches: [
    { d: 'M-1.0 -0.26 L-1.62 -0.34 L-1.56 0.2 L-1.0 0.25 C-1.12 0.08 -1.12 -0.1 -1.0 -0.26 Z', tone: 'wing' },
    { d: 'M0.98 0.0 C0.8 0.04 0.55 0.12 0.3 0.2 C-0.05 0.3 -0.55 0.28 -1.02 0.24 C-0.7 0.52 -0.1 0.58 0.36 0.53 C0.76 0.47 0.98 0.28 0.98 0.0 Z', tone: 'belly' },
    // The dark cap, from the beak over the crown to the nape, and the pale collar behind the eye.
    { d: 'M0.98 -0.14 C0.96 -0.54 0.62 -0.8 0.16 -0.76 C-0.12 -0.74 -0.34 -0.66 -0.54 -0.56 C-0.1 -0.52 0.52 -0.44 0.98 -0.14 Z', tone: 'wing' },
    { d: 'M0.3 -0.18 C0.12 -0.3 -0.14 -0.3 -0.32 -0.14 C-0.14 0.02 0.14 0.04 0.3 -0.18 Z', tone: 'belly' },
    { d: 'M0.86 0.28 C0.55 0.5 -0.2 0.54 -0.8 0.3 C-0.25 0.42 0.45 0.42 0.86 0.28 Z', tone: 'under', alpha: 0.3, fine: true },
  ],
  beak: 'M0.94 -0.22 L2.0 -0.04 L0.94 0.1 Z',
  beakTop: 'M0.94 -0.22 L2.0 -0.04 L0.94 -0.05 Z',
  beakLow: 'M0.94 -0.05 L2.0 -0.04 L0.94 0.1 Z',
  wing: 'M0.22 -0.32 C0.02 -0.9 -0.42 -1.24 -1.02 -1.3 C-0.78 -0.96 -0.6 -0.56 -0.46 -0.1 Z',
  wingPatches: [
    { d: 'M0.2 -0.3 C0.06 -0.58 -0.14 -0.74 -0.4 -0.8 C-0.36 -0.56 -0.36 -0.34 -0.38 -0.14 Z', tone: 'body', fine: true },
    { d: 'M0.22 -0.32 C0.02 -0.9 -0.42 -1.24 -1.02 -1.3 C-0.56 -1.08 -0.18 -0.8 0.0 -0.3 Z', tone: 'wingLit' },
  ],
  wingRoot: [0.08, -0.26],
  beat: 1.05,
  folded: 'M0.32 -0.22 C-0.2 -0.46 -0.8 -0.46 -1.36 -0.24 C-0.8 -0.03 -0.3 0.02 0.32 -0.02 Z',
  foldedPatches: [{ d: 'M0.32 -0.22 C-0.2 -0.46 -0.8 -0.46 -1.36 -0.24 C-0.8 -0.36 -0.26 -0.34 0.26 -0.15 Z', tone: 'wingLit' }],
  eye: { x: 0.58, y: -0.3, r: 0.19, px: 0.64, pr: 0.105 },
}

/** The paper bird: folded, not grown: straight edges, flat faces that catch the light or don't, and a dot for an eye. */
export const PAPER: BirdDesign = {
  key: 'paper',
  behind: [],
  body: 'M1.7 0.0 L0.85 -0.44 L-0.6 -0.38 L-1.85 -0.68 L-1.3 -0.06 L-1.8 0.34 L-0.55 0.42 L0.7 0.38 Z',
  patches: [
    // The back's two faces: the lit one from the head, the plain one behind the fold.
    { d: 'M1.7 0.0 L0.85 -0.44 L-0.1 -0.4 L0.2 0.02 Z', tone: 'lit' },
    // The tail's two folds.
    { d: 'M-0.6 -0.38 L-1.85 -0.68 L-1.3 -0.06 Z', tone: 'wing' },
    { d: 'M-1.3 -0.06 L-1.8 0.34 L-0.55 0.42 Z', tone: 'wingFar' },
    // The underside, under the fold that runs from the beak to the tail: its front face pale, as paper is on its
    // other side, and the face behind it in the bird's own colour, a tone deeper.
    { d: 'M1.7 0.0 L0.2 0.02 L-0.55 0.42 L0.7 0.38 Z', tone: 'belly' },
    { d: 'M0.2 0.02 L-1.3 -0.06 L-0.55 0.42 Z', tone: 'wing' },
  ],
  beak: 'M1.7 0.0 L1.3 -0.21 L1.28 0.16 Z',
  beakTop: 'M1.7 0.0 L1.3 -0.21 L1.29 0.0 Z',
  beakLow: 'M1.7 0.0 L1.29 0.0 L1.28 0.16 Z',
  wing: 'M0.38 -0.34 L-1.55 -1.62 L-0.45 -0.1 Z',
  wingPatches: [{ d: 'M0.38 -0.34 L-1.55 -1.62 L-0.16 -0.66 Z', tone: 'wingLit' }],
  wingRoot: [0.1, -0.25],
  beat: 0.95,
  folded: 'M0.42 -0.28 L-1.92 -0.32 L-0.4 0.02 Z',
  foldedPatches: [{ d: 'M0.42 -0.28 L-1.92 -0.32 L-0.5 -0.17 Z', tone: 'wingLit' }],
  eye: { x: 0.9, y: -0.17, r: 0.1, px: 0.9, pr: 0.085, dot: true },
  paper: true,
}

export const BIRD_DESIGNS = { swift: SWIFT, swallow: SWALLOW, kingfisher: KINGFISHER, paper: PAPER } as const
export type BirdDesignKey = keyof typeof BIRD_DESIGNS
