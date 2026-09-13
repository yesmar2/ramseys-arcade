/**
 * Scene generators — the clutter the bug hides in.
 *
 * Geometry is normalized (0–1 across the stage) so a scene survives resizing
 * without being rebuilt. The stage aspect is fixed at 3:4, which lets the code
 * scene pin text anchors to a constant character width.
 */

export type SceneKind = 'code' | 'cabinets' | 'board'

export type Anchor = {
  x: number
  y: number
  /** Code scene only: the line whose semicolon this anchor sits on. */
  lineIndex?: number
}

export type Decoy = {
  x: number
  y: number
  /** Radius as a fraction of stage width. */
  r: number
  kind: 'speck' | 'screw' | 'comma'
  /** Later rounds let a few decoys drift, so motion alone stops being a tell. */
  driftAmp: number
  driftPhase: number
  driftRate: number
}

export type CodeToken = {
  text: string
  kind: 'keyword' | 'name' | 'number' | 'string' | 'punct'
}

export type CodeLine = {
  indent: number
  tokens: CodeToken[]
  /** Line ends in a semicolon the bug can perch on — and eat. */
  hasSemi: boolean
  /** Character column the trailing semicolon occupies. */
  semiCol: number
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

export type Scene = {
  kind: SceneKind
  /** The color the bug's camouflage sinks toward in this scene. */
  camoColor: string
  decoys: Decoy[]
  anchors: Anchor[]
  codeLines: CodeLine[]
  cabinets: Cabinet[]
  rows: BoardRow[]
}

/** Monospace metrics for the code scene, in normalized stage-width units. */
export const CODE_FONT_H = 0.0265
export const CODE_CHAR_W = 0.0212
export const CODE_LINE_COUNT = 26
export const CODE_LEFT = 0.07
const CODE_TOP = 0.075
const CODE_BOTTOM = 0.95

const KEYWORDS = ['const', 'let', 'return', 'for', 'while', 'export'] as const
const NAMES = [
  'score',
  'wave',
  'player',
  'board',
  'tick',
  'spawn',
  'rocks',
  'lives',
  'streak',
  'combo',
  'frame',
  'speed',
  'level',
  'hits',
  'best',
  'rank',
] as const
const CALLS = ['clamp', 'reset', 'render', 'update', 'submit', 'sample', 'wrap', 'seed'] as const

type Rng = () => number

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]
}

/** Width of the tokens alone — the indent is added by the caller. */
function tokenChars(line: CodeLine): number {
  let n = 0
  for (const t of line.tokens) n += t.text.length
  return n
}

/**
 * Column the trailing semicolon lands on, indent included. Must match how the
 * renderer walks tokens, or the bug perches beside the semicolon it is meant
 * to be sitting on.
 */
function semicolonColumn(line: CodeLine): number {
  return line.indent * 2 + tokenChars(line) - 1
}

function buildCodeLine(rng: Rng, indent: number): CodeLine {
  const shape = rng()
  const tokens: CodeToken[] = []
  let hasSemi = true

  if (shape < 0.2) {
    tokens.push({ text: 'function ', kind: 'keyword' })
    tokens.push({ text: pick(rng, CALLS), kind: 'name' })
    tokens.push({ text: '(dt) {', kind: 'punct' })
    hasSemi = false
  } else if (shape < 0.32) {
    tokens.push({ text: '}', kind: 'punct' })
    hasSemi = false
  } else if (shape < 0.5) {
    tokens.push({ text: 'const ', kind: 'keyword' })
    tokens.push({ text: pick(rng, NAMES), kind: 'name' })
    tokens.push({ text: ' = ', kind: 'punct' })
    tokens.push({ text: String(Math.floor(rng() * 900) + 10), kind: 'number' })
  } else if (shape < 0.64) {
    tokens.push({ text: 'if (', kind: 'keyword' })
    tokens.push({ text: pick(rng, NAMES), kind: 'name' })
    tokens.push({ text: ' > ', kind: 'punct' })
    tokens.push({ text: String(Math.floor(rng() * 40) + 2), kind: 'number' })
    tokens.push({ text: ') ', kind: 'punct' })
    tokens.push({ text: pick(rng, CALLS), kind: 'name' })
    tokens.push({ text: '()', kind: 'punct' })
  } else if (shape < 0.78) {
    tokens.push({ text: pick(rng, NAMES), kind: 'name' })
    tokens.push({ text: '.', kind: 'punct' })
    tokens.push({ text: pick(rng, CALLS), kind: 'name' })
    tokens.push({ text: '(', kind: 'punct' })
    tokens.push({ text: `'${pick(rng, NAMES)}'`, kind: 'string' })
    tokens.push({ text: ')', kind: 'punct' })
  } else if (shape < 0.9) {
    tokens.push({ text: 'return ', kind: 'keyword' })
    tokens.push({ text: pick(rng, NAMES), kind: 'name' })
    tokens.push({ text: ' * ', kind: 'punct' })
    tokens.push({ text: (rng() * 2).toFixed(2), kind: 'number' })
  } else {
    tokens.push({ text: pick(rng, KEYWORDS), kind: 'keyword' })
    tokens.push({ text: ' ', kind: 'punct' })
    tokens.push({ text: pick(rng, NAMES), kind: 'name' })
    tokens.push({ text: ' += ', kind: 'punct' })
    tokens.push({ text: pick(rng, NAMES), kind: 'name' })
  }

  const line: CodeLine = { indent, tokens, hasSemi, semiCol: 0 }
  if (hasSemi) tokens.push({ text: ';', kind: 'punct' })
  return line
}

function codeLineY(index: number): number {
  const span = CODE_BOTTOM - CODE_TOP
  return CODE_TOP + (span * index) / (CODE_LINE_COUNT - 1)
}

function buildCodeScene(rng: Rng): Scene {
  const codeLines: CodeLine[] = []
  let indent = 0
  for (let i = 0; i < CODE_LINE_COUNT; i++) {
    const line = buildCodeLine(rng, indent)
    const opensBlock = line.tokens.some((t) => t.text.endsWith('{'))
    const closesBlock = line.tokens[0]?.text === '}'
    if (closesBlock && indent > 0) {
      line.indent = indent - 1
      indent -= 1
    }
    if (opensBlock) indent = Math.min(2, indent + 1)
    // Only now is the indent final, so the semicolon column is too.
    line.semiCol = semicolonColumn(line)
    codeLines.push(line)
  }

  // The bug perches at the end of a line, over the semicolon.
  const anchors: Anchor[] = []
  codeLines.forEach((line, i) => {
    if (!line.hasSemi) return
    anchors.push({ x: CODE_LEFT + line.semiCol * CODE_CHAR_W, y: codeLineY(i), lineIndex: i })
  })

  const decoys: Decoy[] = []
  codeLines.forEach((line, i) => {
    // Punctuation left lying around reads exactly like a resting bug.
    if (rng() < 0.45) {
      const col = line.indent * 2 + Math.floor(rng() * Math.max(4, tokenChars(line)))
      decoys.push({
        x: CODE_LEFT + col * CODE_CHAR_W,
        y: codeLineY(i) + CODE_FONT_H * 0.16,
        r: 0.006 + rng() * 0.004,
        kind: 'comma',
        driftAmp: 0,
        driftPhase: rng() * Math.PI * 2,
        driftRate: 0.4 + rng() * 0.5,
      })
    }
  })

  return {
    kind: 'code',
    camoColor: '#7d8ea0',
    decoys,
    anchors,
    codeLines,
    cabinets: [],
    rows: [],
  }
}

const CABINET_COLS = 4
const CABINET_ROWS = 5
const CABINET_ACCENTS = ['#2eb87a', '#e85d75', '#4aa8e8', '#f5b942', '#7a6cf0', '#3ecf8e'] as const

function buildCabinetScene(rng: Rng): Scene {
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
      cabinets.push({
        x,
        y,
        w,
        h,
        accent: pick(rng, CABINET_ACCENTS),
        tone: 0.5 + rng() * 0.5,
      })

      // Bezel edges are where something small would actually sit.
      anchors.push({ x: x + w * (0.18 + rng() * 0.64), y: y + h * 0.93 })
      anchors.push({ x: x + w * (0.18 + rng() * 0.64), y: y + h * 0.08 })

      const screws: [number, number][] = [
        [0.09, 0.09],
        [0.91, 0.09],
        [0.09, 0.91],
        [0.91, 0.91],
      ]
      for (const [sx, sy] of screws) {
        decoys.push({
          x: x + w * sx,
          y: y + h * sy,
          r: 0.0075,
          kind: 'screw',
          driftAmp: 0,
          driftPhase: rng() * Math.PI * 2,
          driftRate: 0.4 + rng() * 0.5,
        })
      }
    }
  }

  return {
    kind: 'cabinets',
    camoColor: '#55626f',
    decoys,
    anchors,
    codeLines: [],
    cabinets,
    rows: [],
  }
}

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

function buildBoardScene(rng: Rng): Scene {
  const rows: BoardRow[] = []
  const anchors: Anchor[] = []
  const decoys: Decoy[] = []

  let score = 90_000 + Math.floor(rng() * 20_000)
  for (let i = 0; i < BOARD_ROW_COUNT; i++) {
    rows.push({ rank: i + 1, name: pick(rng, BOARD_NAMES), score })
    score = Math.max(500, score - Math.floor(rng() * 9000) - 800)

    const y = boardRowY(i)
    // The dead space between name and score is the natural perch.
    anchors.push({ x: 0.42 + rng() * 0.22, y })
    if (rng() < 0.5) anchors.push({ x: 0.2 + rng() * 0.08, y })

    if (rng() < 0.7) {
      decoys.push({
        x: 0.38 + rng() * 0.34,
        y: y + 0.004,
        r: 0.006 + rng() * 0.003,
        kind: 'speck',
        driftAmp: 0,
        driftPhase: rng() * Math.PI * 2,
        driftRate: 0.4 + rng() * 0.5,
      })
    }
  }

  return {
    kind: 'board',
    camoColor: '#5f6b78',
    decoys,
    anchors,
    codeLines: [],
    cabinets: [],
    rows,
  }
}

/**
 * Scene order is fixed so every run faces the same shape of challenge; only the
 * contents are seeded. A random order would make leaderboard times unfair.
 */
export const SCENE_ORDER: readonly SceneKind[] = ['code', 'cabinets', 'board', 'code', 'cabinets']

export function buildScene(kind: SceneKind, rng: Rng, driftCount: number): Scene {
  const scene =
    kind === 'code'
      ? buildCodeScene(rng)
      : kind === 'cabinets'
        ? buildCabinetScene(rng)
        : buildBoardScene(rng)

  // Waking a handful of decoys removes "the only thing moving is the bug".
  for (let i = 0; i < driftCount && scene.decoys.length > 0; i++) {
    const d = scene.decoys[Math.floor(rng() * scene.decoys.length) % scene.decoys.length]
    d.driftAmp = 0.002 + rng() * 0.0035
  }

  return scene
}

export function codeLineAt(index: number) {
  return codeLineY(index)
}
