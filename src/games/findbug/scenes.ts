/**
 * Scene generators — the arcade clutter the bug hides in.
 *
 * Geometry is normalized (0–1 across the stage) so a scene survives resizing
 * without being rebuilt. Nothing in a scene animates: the bug sits still, so
 * anything that moved would be a free tell.
 */

export type SceneKind = 'arcade' | 'cabinets' | 'board' | 'loom' | 'tokens' | 'carpet'

/**
 * A perch, and the colour of whatever it is a perch on. The bug takes that
 * colour rather than a scene-wide grey, which is what lets a scene be as
 * saturated as it likes without giving the bug away — it hides against the one
 * cable or rim or bezel it is sitting on, not against a washed-out room.
 */
export type Anchor = { x: number; y: number; on: string }

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
  /** Marquee and screen glow. */
  accent: string
  /** Enamel the cabinet body is painted. */
  body: string
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
  /** Sheath colour. Looms are colour coded, so each run looks different. */
  colour: string
  tone: number
}

/** A zip tie strapping neighbouring cables together. */
export type Tie = { x: number; y: number; w: number }

/** A connector block spliced into the loom. */
export type Block = { x: number; y: number; w: number; h: number; pins: number }

export type Token = { x: number; y: number; r: number; colour: string; tone: number }

/**
 * The arcade floor: a drawn scene rather than a generated pattern. Everything
 * below describes one thing in it — a machine, somebody standing at one, a cup
 * left on the carpet — and the renderer paints them back to front, so people
 * stand behind the cabinets they are playing.
 */
export type MachineKind = 'upright' | 'claw' | 'change' | 'pinball'

export type Machine = {
  x: number
  /** Floor line the cabinet stands on. */
  y: number
  w: number
  h: number
  cab: string
  accent: string
  /** Which of the little fake games is on the screen. */
  screen: number
  kind: MachineKind
}

export type Poster = {
  x: number
  y: number
  w: number
  h: number
  colour: string
  kind: number
}

export type PersonPose = 'play' | 'stand' | 'cheer' | 'walk' | 'point'

export type Person = {
  /** Feet position, centred between the shoes. */
  x: number
  y: number
  /** Head to toe. */
  h: number
  skin: string
  hair: string
  hairStyle: number
  shirt: string
  legs: string
  shoes: string
  /** 0 none, 1 cap, 2 beanie. */
  hat: number
  pose: PersonPose
  flip: boolean
}

export type PropKind =
  | 'cup'
  | 'popcorn'
  | 'token'
  | 'balloon'
  | 'plush'
  | 'cone'
  | 'skate'
  | 'cat'
  | 'bag'
  | 'crumb'

export type Prop = { x: number; y: number; s: number; kind: PropKind; colour: string }

export type Sign = { x: number; y: number; w: number; h: number; colour: string; kind: number }

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
    | {
        kind: 'arcade'
        machines: Machine[]
        people: Person[]
        props: Prop[]
        signs: Sign[]
        posters: Poster[]
      }
    | { kind: 'cabinets'; cabinets: Cabinet[] }
    | { kind: 'board'; rows: BoardRow[] }
    | { kind: 'loom'; cables: Cable[]; ties: Tie[]; blocks: Block[] }
    | { kind: 'tokens'; tokens: Token[] }
    | { kind: 'carpet'; motifs: Motif[] }
  )

/**
 * Scene geometry stays normalised to the field (x and y both 0–1), so a grid
 * only has to decide how many cells to cut it into. `aspect` is the field's
 * height over its width: 4/3 upright on a phone, 3/4 on its side on a desktop.
 *
 * Solving for square cells at a fixed item count gives cols = sqrt(n / aspect)
 * and rows = aspect * cols. A cabinet stays a cabinet in either orientation,
 * and there is the same amount of clutter to search either way — which is what
 * keeps a landscape run and an upright run the same hunt.
 */
function squareGrid(items: number, aspect: number) {
  // Square cells of side c over a 1 x aspect field hold aspect / c^2 of them,
  // so c = sqrt(aspect / items). Both counts round off that directly — deriving
  // rows from the already-rounded cols compounds the error badly on tall fields.
  const cell = Math.sqrt(aspect / items)
  return {
    cols: Math.max(2, Math.round(1 / cell)),
    rows: Math.max(2, Math.round(aspect / cell)),
  }
}

type Rng = () => number

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]
}

function range(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

/** Scene palettes lean on the same accents so the whole game reads as one arcade. */
const ACCENTS = ['#2eb87a', '#e85d75', '#4aa8e8', '#f5b942', '#7a6cf0', '#3ecf8e'] as const

/** Cabinet bodies: dark enamel, the colour a real cabinet side is painted. */
const CABINET_BODY = ['#2b3550', '#34304d', '#26404a', '#3a2f3d', '#2d3a3f'] as const
/** Sheathed looms are colour coded, which is the whole reason they are fun to search. */
const CABLE_COLOURS = ['#e0574f', '#3f8fd8', '#e8b13c', '#4cb377', '#b9bfc9', '#9a6fd0'] as const
/** Brass and nickel, warm against the counter felt. */
const TOKEN_COLOURS = ['#d9a441', '#c8912f', '#e0b45a', '#b9bfc9', '#caa64d'] as const
export const COUNTER_FELT = '#1f4a3d'
export const CARPET_GROUND = '#211a3d'
export const BOARD_GROUND = '#131a2b'

// ----------------------------------------------------------- arcade floor

export const ARCADE_WALL = '#241a3a'
export const ARCADE_FLOOR = '#2b1f47'

const SKIN = ['#f2c9a4', '#dda06f', '#b0774a', '#8a5433', '#f7dcc0', '#c98a5e', '#6d3f26'] as const
const HAIR = [
  '#241c16',
  '#241c16',
  '#4a2c1a',
  '#4a2c1a',
  '#8a5a2b',
  '#d9a441',
  '#a83f3f',
  '#33334a',
  '#5c3fa8',
  '#c9c2cf',
] as const
const SHIRT = [
  '#e0574f',
  '#3f8fd8',
  '#4cb377',
  '#e8b13c',
  '#9a6fd0',
  '#e07ab0',
  '#3fb8c0',
  '#f07a3f',
  '#d8d8e2',
] as const
const LEGS = ['#2f3a56', '#3d3350', '#4a4a58', '#2c4a45', '#553344', '#6a5a4a'] as const
const SHOES = ['#1d1a26', '#2b2436', '#8a3f3f', '#d8d8e2'] as const
const CAB_BODY = ['#3a2f5c', '#2f4a5c', '#4a2f45', '#33405c', '#3f3a52', '#452f52'] as const

/** One row of machines with the crowd standing at it. */
type Rank = { y: number; h: number; count: number }

function addPerson(
  rng: Rng,
  x: number,
  y: number,
  h: number,
  pose: PersonPose,
): Person {
  return {
    x,
    y,
    h,
    skin: pick(rng, SKIN),
    hair: pick(rng, HAIR),
    hairStyle: Math.floor(rng() * 4),
    shirt: pick(rng, SHIRT),
    legs: pick(rng, LEGS),
    shoes: pick(rng, SHOES),
    hat: rng() < 0.22 ? (rng() < 0.6 ? 1 : 2) : 0,
    pose,
    flip: rng() < 0.5,
  }
}

/**
 * An arcade hall seen face on. Three ranks of machines run back into the room
 * with the crowd at them, people cross the aisles between, and the floor
 * carries the debris of a busy evening. Ranks further back sit higher and are
 * drawn smaller, which is all the perspective a flat scene needs.
 */
function buildArcadeScene(rng: Rng, clutter: number, aspect: number): Scene {
  const machines: Machine[] = []
  const people: Person[] = []
  const props: Prop[] = []
  const signs: Sign[] = []
  const posters: Poster[] = []
  const anchors: Anchor[] = []
  const decoys: Decoy[] = []

  const wallBottom = 0.24

  // Neon over the back wall, and framed art between it.
  for (let i = 0; i < 3; i++) {
    const w = range(rng, 0.11, 0.16)
    signs.push({
      x: 0.09 + i * 0.3 + range(rng, -0.02, 0.02),
      y: range(rng, 0.03, 0.07),
      w,
      h: w * range(rng, 0.42, 0.58),
      colour: pick(rng, SHIRT),
      kind: Math.floor(rng() * 3),
    })
  }
  for (let i = 0; i < 5; i++) {
    const w = range(rng, 0.06, 0.1)
    posters.push({
      x: 0.04 + i * 0.19 + range(rng, -0.015, 0.015),
      y: range(rng, 0.12, 0.155),
      w,
      h: w * range(rng, 1.15, 1.5),
      colour: pick(rng, SHIRT),
      kind: Math.floor(rng() * 4),
    })
  }

  const ranks: Rank[] = [
    { y: wallBottom + 0.16, h: 0.14, count: 7 },
    { y: wallBottom + 0.37, h: 0.185, count: 6 },
    { y: wallBottom + 0.62, h: 0.235, count: 5 },
  ]

  ranks.forEach((rank, rankIndex) => {
    const span = 0.96 / rank.count
    for (let i = 0; i < rank.count; i++) {
      const w = span * range(rng, 0.6, 0.74)
      const x = 0.02 + span * i + (span - w) / 2
      const cab = pick(rng, CAB_BODY)
      const accent = pick(rng, SHIRT)

      // Mostly uprights, with the odd claw, change booth or pinball table to
      // break the rhythm of the row.
      const roll = rng()
      const kind: MachineKind =
        roll < 0.12 ? 'claw' : roll < 0.18 ? 'change' : roll < 0.28 ? 'pinball' : 'upright'
      const h = kind === 'pinball' ? rank.h * 0.72 : kind === 'claw' ? rank.h * 1.12 : rank.h

      machines.push({
        x,
        y: rank.y,
        w,
        h,
        cab,
        accent,
        screen: Math.floor(rng() * 4),
        kind,
      })

      // A bug on a cabinet side, or along its top edge.
      anchors.push({ x: x + w * range(rng, 0.08, 0.92), y: rank.y - h + 0.006, on: cab })
      anchors.push({ x: x + w * range(rng, 0.04, 0.96), y: rank.y - range(rng, 0.02, 0.07), on: cab })

      // Somebody at most machines, standing behind it so we see them over the
      // top of the cabinet.
      if (kind !== 'change' && rng() < 0.6) {
        people.push(
          addPerson(
            rng,
            x + w * range(rng, 0.3, 0.7),
            rank.y - h * 0.24,
            h * range(rng, 0.98, 1.1),
            rng() < 0.22 ? 'cheer' : 'play',
          ),
        )
      }

      // Somebody watching over a shoulder on the deeper ranks.
      if (rankIndex > 0 && rng() < 0.2) {
        people.push(
          addPerson(
            rng,
            x + w * range(rng, -0.1, 1.1),
            rank.y + rank.h * 0.08,
            rank.h * range(rng, 0.92, 1.04),
            rng() < 0.4 ? 'point' : 'stand',
          ),
        )
      }
    }
  })

  // People crossing the floor in front of everything.
  for (let i = 0; i < 6; i++) {
    const kid = rng() < 0.35
    people.push(
      addPerson(
        rng,
        range(rng, 0.05, 0.95),
        range(rng, 0.88, 1),
        kid ? range(rng, 0.115, 0.145) : range(rng, 0.175, 0.215),
        rng() < 0.55 ? 'walk' : 'stand',
      ),
    )
  }

  // A bug on somebody's shirt is the best hiding place in the room.
  for (const person of people) {
    anchors.push({
      x: person.x + person.h * range(rng, -0.07, 0.07),
      y: person.y - person.h * range(rng, 0.48, 0.66),
      on: person.shirt,
    })
  }

  // Debris on the carpet.
  const kinds: PropKind[] = ['cup', 'popcorn', 'token', 'plush', 'cone', 'skate', 'bag', 'cat']
  const propCount = Math.round(range(rng, 10, 14) * clutter)
  for (let i = 0; i < propCount; i++) {
    const colour = pick(rng, SHIRT)
    const prop: Prop = {
      x: range(rng, 0.04, 0.96),
      y: range(rng, wallBottom + 0.5, 0.99),
      s: range(rng, 0.028, 0.05),
      kind: pick(rng, kinds),
      colour,
    }
    props.push(prop)
    anchors.push({ x: prop.x + prop.s * 0.45, y: prop.y - prop.s * 0.25, on: colour })
  }

  for (let i = 0; i < 3; i++) {
    props.push({
      x: range(rng, 0.08, 0.92),
      y: range(rng, wallBottom + 0.04, wallBottom + 0.26),
      s: range(rng, 0.032, 0.046),
      kind: 'balloon',
      colour: pick(rng, SHIRT),
    })
  }

  // Crumbs and dropped tokens: the false positives.
  const grit = Math.round(range(rng, 30, 44) * clutter)
  for (let i = 0; i < grit; i++) {
    decoys.push({
      x: range(rng, 0.02, 0.98),
      y: range(rng, wallBottom + 0.04, 0.99),
      r: range(rng, 0.0035, 0.0075),
      kind: rng() < 0.4 ? 'screw' : 'speck',
    })
  }

  void aspect
  return {
    kind: 'arcade',
    camoTone: 0.6,
    decoys,
    anchors,
    machines,
    people,
    props,
    signs,
    posters,
  }
}

// ---------------------------------------------------------------- cabinets

const CABINET_COUNT = 20

function buildCabinetScene(rng: Rng, clutter: number, aspect: number): Scene {
  const { cols: CABINET_COLS, rows: CABINET_ROWS } = squareGrid(CABINET_COUNT, aspect)
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
      const body = pick(rng, CABINET_BODY)
      cabinets.push({ x, y, w, h, accent: pick(rng, ACCENTS), body, tone: range(rng, 0.5, 1) })

      // Bezel edges are where something small would actually sit.
      anchors.push({ x: x + w * range(rng, 0.18, 0.82), y: y + h * 0.93, on: body })
      anchors.push({ x: x + w * range(rng, 0.18, 0.82), y: y + h * 0.08, on: body })

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
const BOARD_TOP = 0.14
const BOARD_BOTTOM = 0.94
/** Rows at the upright aspect; a shorter field simply fits fewer of them. */
const BOARD_ROWS_UPRIGHT = 12

export function boardRowCount(aspect: number): number {
  return Math.max(5, Math.round((BOARD_ROWS_UPRIGHT * aspect) / (4 / 3)))
}

export function boardRowY(index: number, rows: number): number {
  const span = BOARD_BOTTOM - BOARD_TOP
  return BOARD_TOP + (span * index) / Math.max(1, rows - 1)
}

function buildBoardScene(rng: Rng, clutter: number, aspect: number): Scene {
  const BOARD_ROW_COUNT = boardRowCount(aspect)
  const rows: BoardRow[] = []
  const anchors: Anchor[] = []
  const decoys: Decoy[] = []

  let score = 90_000 + Math.floor(rng() * 20_000)
  for (let i = 0; i < BOARD_ROW_COUNT; i++) {
    rows.push({ rank: i + 1, name: pick(rng, BOARD_NAMES), score })
    score = Math.max(500, score - Math.floor(rng() * 9000) - 800)

    const y = boardRowY(i, BOARD_ROW_COUNT)
    // The dead space between name and score is the natural perch.
    const pill = i % 2 === 0 ? '#1d2740' : '#222c47'
    anchors.push({ x: range(rng, 0.42, 0.64), y, on: pill })
    if (rng() < 0.5) anchors.push({ x: range(rng, 0.2, 0.28), y, on: pill })

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
      colour: pick(rng, CABLE_COLOURS),
      tone: range(rng, 0.68, 0.86),
    })
  }

  for (const c of cables) {
    // Three perches per cable — a body lying along a cable is the whole trick.
    for (let i = 0; i < 3; i++) {
      const t = range(rng, 0.08, 0.92)
      anchors.push({ x: cableX(c, t), y: cableY(t), on: c.colour })
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
    anchors.push({ x: x + w * range(rng, 0.1, 0.9), y: y + h + 0.012, on: '#4a5468' })
    anchors.push({ x: x + w * range(rng, 0.1, 0.9), y: y - 0.012, on: '#4a5468' })
  }

  return { kind: 'loom', camoTone: 0.78, decoys, anchors, cables, ties, blocks }
}

// ------------------------------------------------------------------ tokens

const TOKEN_COUNT = 48

function buildTokenScene(rng: Rng, clutter: number, aspect: number): Scene {
  const { cols: TOKEN_COLS, rows: TOKEN_ROWS } = squareGrid(TOKEN_COUNT, aspect)
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
      const colour = pick(rng, TOKEN_COLOURS)
      tokens.push({ x, y, r: radius, colour, tone: range(rng, 0.55, 0.85) })

      // A body tucked against a rim disappears into the token's own shadow.
      const a = rng() * Math.PI * 2
      anchors.push({
        x: x + Math.cos(a) * radius * 0.92,
        y: y + Math.sin(a) * radius * 0.92,
        on: colour,
      })
      if (rng() < 0.4) {
        anchors.push({
          x: x + range(rng, -0.5, 0.5) * cellW,
          y: y + cellH * 0.62,
          on: COUNTER_FELT,
        })
      }

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

const CARPET_COUNT = 35
const MOTIF_KINDS: readonly MotifKind[] = ['star', 'tri', 'dot', 'zig']

function buildCarpetScene(rng: Rng, clutter: number, aspect: number): Scene {
  const { cols: CARPET_COLS, rows: CARPET_ROWS } = squareGrid(CARPET_COUNT, aspect)
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
      anchors.push({
        x: x + cellW * range(rng, 0.34, 0.5),
        y: y + cellH * range(rng, 0.3, 0.46),
        on: CARPET_GROUND,
      })

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
export const SCENE_ORDER: readonly SceneKind[] = ['arcade', 'board', 'loom', 'tokens', 'carpet']

export function buildScene(
  kind: SceneKind,
  rng: Rng,
  clutter: number,
  aspect: number,
): Scene {
  if (kind === 'arcade') return buildArcadeScene(rng, clutter, aspect)
  if (kind === 'cabinets') return buildCabinetScene(rng, clutter, aspect)
  if (kind === 'board') return buildBoardScene(rng, clutter, aspect)
  if (kind === 'loom') return buildLoomScene(rng, clutter)
  if (kind === 'tokens') return buildTokenScene(rng, clutter, aspect)
  return buildCarpetScene(rng, clutter, aspect)
}

/** Keep every perch far enough inside the stage to be swattable. */
export function clampAnchor(a: Anchor): Anchor {
  return {
    x: Math.max(0.05, Math.min(0.95, a.x)),
    y: Math.max(0.04, Math.min(0.96, a.y)),
    on: a.on,
  }
}
