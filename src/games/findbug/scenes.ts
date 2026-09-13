/**
 * Scene generators — the arcade clutter the bug hides in.
 *
 * Geometry is normalized (0–1 across the stage) so a scene survives resizing
 * without being rebuilt. Nothing in a scene animates: the bug sits still, so
 * anything that moved would be a free tell.
 */

export type SceneKind = 'cabinets' | 'board' | 'loom' | 'tokens' | 'carpet'

export type Anchor = { x: number; y: number }

export type Decoy = {
  x: number
  y: number
  /** Radius as a fraction of stage width. */
  r: number
  /** `screw` draws as a disc, `speck` as a body-shaped ellipse. */
  kind: 'screw' | 'speck'
}

export type Cabinet = {
  x: number
  y: number
  w: number
  h: number
  accent: string
  /** Marquee stripe brightness, purely decorative variation. */
  tone: number
}

export type BoardRow = {
  rank: number
  name: string
  score: number
}

/**
 * One cable in the loom. `x` is a cubic in the run from top to bottom, so the
 * renderer's bezier and the anchors sampled off `cableX` trace the same line.
 */
export type Cable = {
  x0: number
  x1: number
  x2: number
  x3: number
  /** Stroke width as a fraction of stage width. */
  width: number
  tone: number
}

/** A zip tie strapping neighbouring cables together. */
export type Tie = { x: number; y: number; w: number }

/** A connector block spliced into the loom. */
export type Block = { x: number; y: number; w: number; h: number; pins: number }

export type Token = { x: number; y: number; r: number; tone: number }

export type MotifKind = 'star' | 'tri' | 'dot' | 'zig'
export type Motif = {
  x: number
  y: number
  size: number
  rot: number
  kind: MotifKind
  accent: string
}

type SceneBase = {
  /**
   * Fade level of the surface the bug actually perches on — the tone its
   * camouflage sinks toward. Kept as a level rather than a hex so it tracks
   * whichever theme is on.
   */
  camoTone: number
  /**
   * Fade level for a full-stage surface under the scene. Scenes whose clutter
   * floats on bare playfield need one, or a mid-tone bug lights up in the gaps.
   */
  ground?: number
  decoys: Decoy[]
  anchors: Anchor[]
}

export type Scene = SceneBase &
  (
    | { kind: 'cabinets'; cabinets: Cabinet[] }
    | { kind: 'board'; rows: BoardRow[] }
    | { kind: 'loom'; cables: Cable[]; ties: Tie[]; blocks: Block[] }
    | { kind: 'tokens'; tokens: Token[] }
    | { kind: 'carpet'; motifs: Motif[] }
  )

type Rng = () => number

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]
}

function range(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

/** Scene palettes lean on the same accents so the whole game reads as one arcade. */
const ACCENTS = ['#2eb87a', '#e85d75', '#4aa8e8', '#f5b942', '#7a6cf0', '#3ecf8e'] as const

// ---------------------------------------------------------------- cabinets

const CABINET_COLS = 4
const CABINET_ROWS = 5

function buildCabinetScene(rng: Rng, clutter: number): Scene {
  const cabinets: Cabinet[] = []
  const anchors: Anchor[] = []
  const decoys: Decoy[] = []

  const padX = 0.06
  const padY = 0.06
  const cellW = (1 - padX * 2) / CABINET_COLS
  const cellH = (1 - padY * 2) / CABINET_ROWS
  const w = cellW * 0.82
  const h = cellH * 0.84

  for (let r = 0; r < CABINET_ROWS; r++) {
    for (let c = 0; c < CABINET_COLS; c++) {
      const x = padX + cellW * c + (cellW - w) / 2
      const y = padY + cellH * r + (cellH - h) / 2
      cabinets.push({ x, y, w, h, accent: pick(rng, ACCENTS), tone: range(rng, 0.5, 1) })

      // Bezel edges are where something small would actually sit.
      anchors.push({ x: x + w * range(rng, 0.18, 0.82), y: y + h * 0.93 })
      anchors.push({ x: x + w * range(rng, 0.18, 0.82), y: y + h * 0.08 })

      const screws: [number, number][] = [
        [0.09, 0.09],
        [0.91, 0.09],
        [0.09, 0.91],
        [0.91, 0.91],
      ]
      for (const [sx, sy] of screws) {
        decoys.push({ x: x + w * sx, y: y + h * sy, r: 0.0075, kind: 'screw' })
      }
      // Later rounds grime up the bezels with flecks that read like a body.
      const flecks = Math.round(range(rng, 0, 1.6) * clutter)
      for (let i = 0; i < flecks; i++) {
        decoys.push({
          x: x + w * range(rng, 0.12, 0.88),
          y: y + h * range(rng, 0.75, 0.97),
          r: range(rng, 0.005, 0.008),
          kind: 'speck',
        })
      }
    }
  }

  // Bezel gray is what a bug on a cabinet edge has to disappear into.
  return { kind: 'cabinets', camoTone: 0.72, decoys, anchors, cabinets }
}

// ------------------------------------------------------------------- board

const BOARD_NAMES = [
  'RMB',
  'ACE',
  'DOT',
  'PIX',
  'ZAP',
  'JYN',
  'ORB',
  'KAT',
  'VEX',
  'NIL',
  'RAY',
  'TAU',
  'MOX',
  'FIZ',
  'QUA',
  'LUX',
] as const
export const BOARD_ROW_COUNT = 12
const BOARD_TOP = 0.14
const BOARD_BOTTOM = 0.94

export function boardRowY(index: number): number {
  const span = BOARD_BOTTOM - BOARD_TOP
  return BOARD_TOP + (span * index) / (BOARD_ROW_COUNT - 1)
}

function buildBoardScene(rng: Rng, clutter: number): Scene {
  const rows: BoardRow[] = []
  const anchors: Anchor[] = []
  const decoys: Decoy[] = []

  let score = 90_000 + Math.floor(rng() * 20_000)
  for (let i = 0; i < BOARD_ROW_COUNT; i++) {
    rows.push({ rank: i + 1, name: pick(rng, BOARD_NAMES), score })
    score = Math.max(500, score - Math.floor(rng() * 9000) - 800)

    const y = boardRowY(i)
    // The dead space between name and score is the natural perch.
    anchors.push({ x: range(rng, 0.42, 0.64), y })
    if (rng() < 0.5) anchors.push({ x: range(rng, 0.2, 0.28), y })

    if (rng() < 0.7 * clutter) {
      decoys.push({ x: range(rng, 0.38, 0.72), y: y + 0.004, r: range(rng, 0.006, 0.009), kind: 'speck' })
    }
  }

  return { kind: 'board', camoTone: 0.82, decoys, anchors, rows }
}

// -------------------------------------------------------------------- loom

const LOOM_TOP = 0.03
const LOOM_BOTTOM = 0.97
const CABLE_COUNT = 7

/** Where a cable sits at `t` (0 at the top of its run, 1 at the bottom). */
function cableX(c: Cable, t: number): number {
  const u = 1 - t
  return u * u * u * c.x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x3
}

export function cableY(t: number): number {
  return LOOM_TOP + t * (LOOM_BOTTOM - LOOM_TOP)
}

function buildLoomScene(rng: Rng, clutter: number): Scene {
  const cables: Cable[] = []
  const ties: Tie[] = []
  const blocks: Block[] = []
  const anchors: Anchor[] = []
  const decoys: Decoy[] = []

  for (let i = 0; i < CABLE_COUNT; i++) {
    const base = 0.09 + (0.82 * i) / (CABLE_COUNT - 1)
    const swing = range(rng, 0.03, 0.11)
    cables.push({
      x0: base + range(rng, -0.02, 0.02),
      x1: base + swing,
      x2: base - swing,
      x3: base + range(rng, -0.02, 0.02),
      width: range(rng, 0.016, 0.03),
      tone: range(rng, 0.68, 0.86),
    })
  }

  for (const c of cables) {
    // Three perches per cable — a body lying along a cable is the whole trick.
    for (let i = 0; i < 3; i++) {
      const t = range(rng, 0.08, 0.92)
      anchors.push({ x: cableX(c, t), y: cableY(t) })
    }
    // Tie heads and cable nubs: the same silhouette, on the same line.
    const nubs = Math.round(range(rng, 1, 3) * clutter)
    for (let i = 0; i < nubs; i++) {
      const t = range(rng, 0.06, 0.94)
      decoys.push({ x: cableX(c, t), y: cableY(t), r: range(rng, 0.007, 0.011), kind: 'speck' })
    }
  }

  // Zip ties strap a neighbouring pair together wherever they run close.
  for (let i = 0; i < CABLE_COUNT - 1; i++) {
    if (rng() < 0.55) continue
    const t = range(rng, 0.12, 0.88)
    const a = cableX(cables[i], t)
    const b = cableX(cables[i + 1], t)
    const left = Math.min(a, b)
    const width = Math.abs(b - a)
    ties.push({ x: left - 0.012, y: cableY(t), w: width + 0.024 })
    decoys.push({ x: left - 0.012, y: cableY(t), r: 0.008, kind: 'screw' })
  }

  const blockCount = 2 + Math.floor(rng() * 2)
  for (let i = 0; i < blockCount; i++) {
    const t = range(rng, 0.12, 0.86)
    const c = cables[Math.floor(rng() * cables.length) % cables.length]
    const cx = cableX(c, t)
    const w = range(rng, 0.1, 0.16)
    const h = range(rng, 0.05, 0.08)
    const x = Math.max(0.02, Math.min(0.98 - w, cx - w / 2))
    const y = Math.max(0.02, Math.min(0.98 - h, cableY(t) - h / 2))
    blocks.push({ x, y, w, h, pins: 3 + Math.floor(rng() * 4) })
    anchors.push({ x: x + w * range(rng, 0.1, 0.9), y: y + h + 0.012 })
    anchors.push({ x: x + w * range(rng, 0.1, 0.9), y: y - 0.012 })
  }

  return { kind: 'loom', camoTone: 0.78, decoys, anchors, cables, ties, blocks }
}

// ------------------------------------------------------------------ tokens

const TOKEN_COLS = 6
const TOKEN_ROWS = 8

function buildTokenScene(rng: Rng, clutter: number): Scene {
  const tokens: Token[] = []
  const anchors: Anchor[] = []
  const decoys: Decoy[] = []

  const cellW = 1 / TOKEN_COLS
  const cellH = 1 / TOKEN_ROWS

  for (let r = 0; r < TOKEN_ROWS; r++) {
    for (let c = 0; c < TOKEN_COLS; c++) {
      // Jitter past the cell edge so the spill overlaps instead of gridding up.
      const x = cellW * (c + 0.5) + range(rng, -0.35, 0.35) * cellW
      const y = cellH * (r + 0.5) + range(rng, -0.35, 0.35) * cellH
      const radius = range(rng, 0.042, 0.058)
      tokens.push({ x, y, r: radius, tone: range(rng, 0.55, 0.85) })

      // A body tucked against a rim disappears into the token's own shadow.
      const a = rng() * Math.PI * 2
      anchors.push({ x: x + Math.cos(a) * radius * 0.92, y: y + Math.sin(a) * radius * 0.92 })
      if (rng() < 0.4) anchors.push({ x: x + range(rng, -0.5, 0.5) * cellW, y: y + cellH * 0.62 })

      const chips = Math.round(range(rng, 0, 1.4) * clutter)
      for (let i = 0; i < chips; i++) {
        const ca = rng() * Math.PI * 2
        const cr = radius * range(rng, 0.95, 1.25)
        decoys.push({
          x: x + Math.cos(ca) * cr,
          y: y + Math.sin(ca) * cr,
          r: range(rng, 0.006, 0.01),
          kind: 'speck',
        })
      }
    }
  }

  return { kind: 'tokens', camoTone: 0.72, ground: 0.9, decoys, anchors, tokens }
}

// ------------------------------------------------------------------ carpet

const CARPET_COLS = 5
const CARPET_ROWS = 7
const MOTIF_KINDS: readonly MotifKind[] = ['star', 'tri', 'dot', 'zig']

function buildCarpetScene(rng: Rng, clutter: number): Scene {
  const motifs: Motif[] = []
  const anchors: Anchor[] = []
  const decoys: Decoy[] = []

  const cellW = 1 / CARPET_COLS
  const cellH = 1 / CARPET_ROWS

  for (let r = 0; r < CARPET_ROWS; r++) {
    for (let c = 0; c < CARPET_COLS; c++) {
      // Offset every other row, the way real arcade carpet tiles.
      const offset = r % 2 === 0 ? 0 : cellW * 0.5
      const x = cellW * (c + 0.5) + offset + range(rng, -0.12, 0.12) * cellW
      const y = cellH * (r + 0.5) + range(rng, -0.12, 0.12) * cellH
      motifs.push({
        x,
        y,
        size: range(rng, 0.055, 0.085),
        rot: rng() * Math.PI * 2,
        kind: pick(rng, MOTIF_KINDS),
        accent: pick(rng, ACCENTS),
      })

      // The pattern's own gaps are the only quiet ground on this scene.
      anchors.push({ x: x + cellW * range(rng, 0.34, 0.5), y: y + cellH * range(rng, 0.3, 0.46) })

      const crumbs = Math.round(range(rng, 0.6, 2.2) * clutter)
      for (let i = 0; i < crumbs; i++) {
        decoys.push({
          x: x + range(rng, -0.6, 0.6) * cellW,
          y: y + range(rng, -0.6, 0.6) * cellH,
          r: range(rng, 0.005, 0.009),
          kind: 'speck',
        })
      }
    }
  }

  return { kind: 'carpet', camoTone: 0.88, ground: 0.9, decoys, anchors, motifs }
}

// ------------------------------------------------------------------- build

/**
 * Scene order is fixed so every run faces the same shape of challenge; only the
 * contents are seeded. A random order would make leaderboard times unfair. It
 * runs sparse-and-regular to dense-and-patterned, which stacks with the size
 * and camouflage ramp in `roundConfig`.
 */
export const SCENE_ORDER: readonly SceneKind[] = ['cabinets', 'board', 'loom', 'tokens', 'carpet']

export function buildScene(kind: SceneKind, rng: Rng, clutter: number): Scene {
  if (kind === 'cabinets') return buildCabinetScene(rng, clutter)
  if (kind === 'board') return buildBoardScene(rng, clutter)
  if (kind === 'loom') return buildLoomScene(rng, clutter)
  if (kind === 'tokens') return buildTokenScene(rng, clutter)
  return buildCarpetScene(rng, clutter)
}

/** Keep every perch far enough inside the stage to be swattable. */
export function clampAnchor(a: Anchor): Anchor {
  return { x: Math.max(0.05, Math.min(0.95, a.x)), y: Math.max(0.04, Math.min(0.96, a.y)) }
}
