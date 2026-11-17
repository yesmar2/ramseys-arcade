import { mixColor } from '../../lib/color'
import { keptEpoch, watchKept } from '../keptPictures'
import { heightAt, mulberry32, type Hills } from './sim'

/*
 * What grows along the day's hills in Swoop's look on test (vista.ts): trees, bushes, rocks, tufts of grass and
 * flowers, each in its own place for the day, the same on every device. They stand just behind the hills'
 * edge, their feet under it, so the line the bird lands on is never covered: the ground is drawn over their
 * feet. Each is a little picture, painted once for its size on the screen and stamped where it stands, which
 * costs a frame next to nothing (scene.ts stamps its row of blips the same way). They're there to be flown
 * past: the faster they go by, the faster it feels.
 */

const TAU = Math.PI * 2

/** What stands at a spot: a kind, one of its two shapes, how big, and where its foot is on the hills. */
export type Deco = { x: number; y: number; kind: DecoKind; shape: 0 | 1; size: number; seed: number }

export const DECO = { Tree: 0, Pine: 1, Bush: 2, Rock: 3, Grass: 4, Daisy: 5, Tulip: 6, Reed: 7, Pebbles: 8, Shell: 9 } as const
export type DecoKind = (typeof DECO)[keyof typeof DECO]

/** Each kind's box, in metres at size 1: how wide and how tall, and how far its foot goes under the hill's edge. */
const BOX: Record<DecoKind, { w: number; h: number; sink: number }> = {
  [DECO.Tree]: { w: 5.4, h: 7.6, sink: 1.1 },
  [DECO.Pine]: { w: 3.8, h: 8.4, sink: 1.1 },
  [DECO.Bush]: { w: 3.0, h: 1.7, sink: 0.45 },
  [DECO.Rock]: { w: 2.0, h: 1.1, sink: 0.3 },
  [DECO.Grass]: { w: 1.5, h: 0.95, sink: 0.14 },
  [DECO.Daisy]: { w: 1.7, h: 1.0, sink: 0.12 },
  [DECO.Tulip]: { w: 1.5, h: 1.1, sink: 0.12 },
  [DECO.Reed]: { w: 1.3, h: 1.8, sink: 0.14 },
  // Under the ground, not on it: their box stands on its foot like the rest, and nothing is sunk.
  [DECO.Pebbles]: { w: 3.2, h: 1.6, sink: 0 },
  [DECO.Shell]: { w: 2.2, h: 2.2, sink: 0 },
}

export const decoBox = (kind: DecoKind) => BOX[kind]

/** Whether a kind is small enough to be kept a size you can see when the camera is far out: the grass and flowers. */
export const isSprig = (kind: DecoKind) => kind >= DECO.Grass && kind <= DECO.Reed

/**
 * Where everything stands on the day's hills, in order along the way: a tree or a pine now and then, bushes
 * and rocks between, and tufts and flowers most of all. None at the start, round a flag, or past the line.
 */
export function layDecos(hills: Hills): Deco[] {
  const rnd = mulberry32((Math.imul(hills.n + 31, 2246822519) ^ 0x5f1ab) >>> 0)
  const decos: Deco[] = []
  const clear = [...hills.flags, hills.finish]
  let x = 9
  while (x < hills.finish + 90) {
    x += 2.8 + rnd() * 4.2
    const r = rnd()
    const shape = rnd() < 0.5 ? 0 : 1
    const seed = rnd()
    if (clear.some((c) => Math.abs(x - c) < 4.5)) continue
    let kind: DecoKind
    let size: number
    if (r < 0.09) {
      kind = DECO.Tree
      size = 0.7 + rnd() * 0.45
    } else if (r < 0.17) {
      kind = DECO.Pine
      size = 0.65 + rnd() * 0.45
    } else if (r < 0.3) {
      kind = DECO.Bush
      size = 0.75 + rnd() * 0.5
    } else if (r < 0.37) {
      kind = DECO.Rock
      size = 0.7 + rnd() * 0.7
    } else if (r < 0.62) {
      kind = DECO.Grass
      size = 0.8 + rnd() * 0.5
    } else if (r < 0.78) {
      kind = DECO.Daisy
      size = 0.85 + rnd() * 0.35
    } else if (r < 0.9) {
      kind = DECO.Tulip
      size = 0.85 + rnd() * 0.35
    } else {
      kind = DECO.Reed
      size = 0.8 + rnd() * 0.4
    }
    decos.push({ x, y: heightAt(hills, x), kind, shape, size, seed })
    // A tree gets some room after it.
    if (kind <= DECO.Pine) x += 3
  }
  return decos
}

/**
 * What lies in the ground under the hills: stones here and there, and now and then an old shell, each at its own
 * depth, clear of the seams and the row of blips. They're only there to be something to see in all that earth.
 */
export function layBuried(hills: Hills): Deco[] {
  const rnd = mulberry32((Math.imul(hills.n + 53, 2654435761) ^ 0x2b7e1) >>> 0)
  const buried: Deco[] = []
  let x = -40
  while (x < hills.finish + 380) {
    x += 7 + rnd() * 9
    const deep = [2.4 + rnd() * 0.9, 5.6 + rnd() * 1.8, 10.2 + rnd() * 2.2, 15.5 + rnd() * 9][Math.floor(rnd() * 4)]!
    const shell = rnd() < 0.1
    buried.push({ x, y: heightAt(hills, x) - deep, kind: shell ? DECO.Shell : DECO.Pebbles, shape: rnd() < 0.5 ? 0 : 1, size: shell ? 0.8 + rnd() * 0.5 : 0.6 + rnd() * 0.7, seed: rnd() })
  }
  return buried
}

/** The colours things are painted in: the day's own, darker than the hill they stand behind, and the flowers'. */
export type DecoLook = {
  leaf: string
  leafLit: string
  leafDeep: string
  trunk: string
  blade: string
  bladeLit: string
  rock: string
  rockLit: string
  petals: readonly string[]
  heart: string
  seed: string
  /** A stone in the ground, and its lighter side: the earth's own colour, a shade each way. */
  stone: string
  stoneLit: string
}

export function decoLook(hue: string, dark: boolean): DecoLook {
  const night = '#0e1230'
  const ink = '#1a2b3c'
  // Flowers keep their colours by day; by night they're the same ones with the dusk in them.
  const flower = (c: string) => (dark ? mixColor(c, night, 0.3) : c)
  return {
    leaf: dark ? mixColor(hue, night, 0.62) : mixColor(hue, ink, 0.3),
    leafLit: dark ? mixColor(hue, night, 0.38) : mixColor(hue, '#ffffff', 0.12),
    leafDeep: dark ? mixColor(hue, night, 0.78) : mixColor(hue, ink, 0.46),
    trunk: dark ? mixColor(hue, night, 0.86) : mixColor(hue, ink, 0.66),
    blade: dark ? mixColor(hue, night, 0.42) : mixColor(hue, ink, 0.2),
    bladeLit: dark ? mixColor(hue, '#ffffff', 0.16) : mixColor(hue, '#ffffff', 0.38),
    rock: dark ? '#39446b' : '#aebbc8',
    rockLit: dark ? '#56628c' : '#d4dee8',
    petals: ['#ffffff', '#ffd76a', '#ff9ec0', '#b79bff'].map(flower),
    heart: flower('#f5b942'),
    seed: flower('#c98a4a'),
    stone: dark ? mixColor(hue, night, 0.82) : mixColor(hue, ink, 0.34),
    stoneLit: dark ? mixColor(hue, night, 0.5) : mixColor(hue, '#ffffff', 0.32),
  }
}

type Paint = (g: CanvasRenderingContext2D, L: DecoLook, shape: 0 | 1) => void

/* Each is painted in metres, its foot at the origin, growing up (y down the canvas, so up is negative). */

const tree: Paint = (g, L, shape) => {
  g.fillStyle = L.trunk
  g.beginPath()
  g.moveTo(-0.34, 0)
  g.lineTo(-0.2, -3.6)
  g.lineTo(0.2, -3.6)
  g.lineTo(0.34, 0)
  g.closePath()
  g.fill()
  const puffs: readonly (readonly [number, number, number])[] =
    shape === 0
      ? [
          [-1.2, -4.0, 1.35],
          [1.15, -4.1, 1.3],
          [0, -5.3, 1.75],
          [-0.2, -3.7, 1.3],
        ]
      : [
          [-0.9, -3.8, 1.25],
          [0.9, -3.9, 1.2],
          [-0.35, -5.0, 1.45],
          [0.6, -5.6, 1.3],
        ]
  g.fillStyle = L.leafDeep
  g.beginPath()
  for (const [x, y, r] of puffs) {
    g.moveTo(x + r, y + 0.22)
    g.arc(x, y + 0.22, r, 0, TAU)
  }
  g.fill()
  g.fillStyle = L.leaf
  g.beginPath()
  for (const [x, y, r] of puffs) {
    g.moveTo(x + r * 0.95, y)
    g.arc(x, y, r * 0.95, 0, TAU)
  }
  g.fill()
  // The light's from the right: the crown's sunward side.
  g.fillStyle = L.leafLit
  g.beginPath()
  for (const [x, y, r] of puffs) {
    g.moveTo(x + r * 0.3 + r * 0.56, y - r * 0.32)
    g.arc(x + r * 0.3, y - r * 0.32, r * 0.56, 0, TAU)
  }
  g.fill()
}

const pine: Paint = (g, L, shape) => {
  g.fillStyle = L.trunk
  g.fillRect(-0.2, -1.6, 0.4, 1.6)
  const tiers = shape === 0 ? 4 : 3
  const top = shape === 0 ? -8.1 : -7.2
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers
    const y0 = -1.1 - (t * (-top - 1.1) * tiers) / (tiers + 0.6)
    const y1 = i === tiers - 1 ? top : y0 - (-top - 1.1) / (tiers - 0.2) - 0.5
    const half = 1.75 * (1 - t * 0.62)
    g.fillStyle = L.leaf
    g.beginPath()
    g.moveTo(-half, y0)
    g.lineTo(0, y1)
    g.lineTo(half, y0)
    g.closePath()
    g.fill()
    // Its sunward half.
    g.fillStyle = L.leafLit
    g.beginPath()
    g.moveTo(0.1, y0)
    g.lineTo(0, y1)
    g.lineTo(half, y0)
    g.closePath()
    g.fill()
    g.fillStyle = L.leafDeep
    g.beginPath()
    g.moveTo(-half, y0)
    g.lineTo(-half * 0.3, y0 - 0.34)
    g.lineTo(half * 0.5, y0)
    g.closePath()
    g.fill()
  }
}

const bush: Paint = (g, L, shape) => {
  const puffs: readonly (readonly [number, number, number])[] =
    shape === 0
      ? [
          [-0.85, -0.55, 0.62],
          [0.0, -0.85, 0.82],
          [0.85, -0.5, 0.6],
        ]
      : [
          [-0.6, -0.6, 0.7],
          [0.5, -0.72, 0.78],
        ]
  g.fillStyle = L.leaf
  g.beginPath()
  for (const [x, y, r] of puffs) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, TAU)
  }
  g.rect(-1.25, -0.6, 2.5, 0.6)
  g.fill()
  g.fillStyle = L.leafLit
  g.beginPath()
  for (const [x, y, r] of puffs) {
    g.moveTo(x + r * 0.28 + r * 0.5, y - r * 0.3)
    g.arc(x + r * 0.28, y - r * 0.3, r * 0.5, 0, TAU)
  }
  g.fill()
  // A few berries, or blossom.
  g.fillStyle = L.petals[shape === 0 ? 2 : 1]!
  for (const [x, y] of [
    [-0.7, -0.5],
    [0.15, -1.0],
    [0.75, -0.42],
    [-0.15, -0.5],
  ] as const) {
    g.beginPath()
    g.arc(x, y, 0.11, 0, TAU)
    g.fill()
  }
}

const rock: Paint = (g, L, shape) => {
  const pts: readonly (readonly [number, number])[] =
    shape === 0
      ? [
          [-0.9, 0],
          [-0.72, -0.62],
          [-0.2, -1.0],
          [0.5, -0.86],
          [0.92, -0.3],
          [0.95, 0],
        ]
      : [
          [-0.8, 0],
          [-0.55, -0.5],
          [0.1, -0.74],
          [0.7, -0.44],
          [0.86, 0],
        ]
  g.fillStyle = L.rock
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
  g.fill()
  // Its sunward face.
  g.fillStyle = L.rockLit
  g.beginPath()
  const lit = pts.slice(2)
  g.moveTo(lit[0]![0], lit[0]![1])
  for (const [x, y] of lit.slice(1)) g.lineTo(x, y)
  g.lineTo(0.25, -0.3)
  g.closePath()
  g.fill()
}

/** A blade of grass from `x`, `h` tall, leaning `lean`. */
function blade(g: CanvasRenderingContext2D, x: number, h: number, lean: number, w: number) {
  g.beginPath()
  g.moveTo(x - w, 0.1)
  g.quadraticCurveTo(x - w * 0.5 + lean * 0.4, -h * 0.6, x + lean, -h)
  g.quadraticCurveTo(x + w * 0.6 + lean * 0.4, -h * 0.55, x + w, 0.1)
  g.closePath()
  g.fill()
}

const grass: Paint = (g, L, shape) => {
  const blades: readonly (readonly [number, number, number])[] =
    shape === 0
      ? [
          [-0.42, 0.55, -0.2],
          [-0.2, 0.82, -0.06],
          [0.02, 0.66, 0.12],
          [0.24, 0.86, 0.22],
          [0.46, 0.5, 0.26],
        ]
      : [
          [-0.34, 0.7, -0.22],
          [-0.08, 0.5, 0.02],
          [0.16, 0.8, 0.14],
          [0.4, 0.6, 0.28],
        ]
  blades.forEach(([x, h, lean], i) => {
    g.fillStyle = i % 2 ? L.bladeLit : L.blade
    blade(g, x, h, lean, 0.09)
  })
}

/** A flower's stem, from the ground at `x` up to (`tx`, −`h`). */
function stem(g: CanvasRenderingContext2D, x: number, tx: number, h: number) {
  g.beginPath()
  g.moveTo(x - 0.035, 0.1)
  g.quadraticCurveTo(x, -h * 0.5, tx - 0.03, -h)
  g.lineTo(tx + 0.03, -h)
  g.quadraticCurveTo(x + 0.07, -h * 0.5, x + 0.035, 0.1)
  g.closePath()
  g.fill()
}

const daisy: Paint = (g, L, shape) => {
  const heads: readonly (readonly [number, number, number, number])[] =
    shape === 0
      ? [
          [-0.4, -0.5, 0.62, 0],
          [0.05, 0.1, 0.84, 0],
          [0.45, 0.55, 0.52, 1],
        ]
      : [
          [-0.3, -0.36, 0.78, 1],
          [0.3, 0.38, 0.6, 0],
        ]
  for (const [x, tx, h, colour] of heads) {
    g.fillStyle = L.blade
    stem(g, x, tx, h)
    g.fillStyle = L.petals[colour]!
    g.beginPath()
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * TAU
      const px = tx + Math.cos(a) * 0.115
      const py = -h + Math.sin(a) * 0.115
      g.moveTo(px + 0.085, py)
      g.arc(px, py, 0.085, 0, TAU)
    }
    g.fill()
    g.fillStyle = L.heart
    g.beginPath()
    g.arc(tx, -h, 0.075, 0, TAU)
    g.fill()
  }
  g.fillStyle = L.bladeLit
  blade(g, -0.08, 0.4, -0.1, 0.07)
  blade(g, 0.2, 0.34, 0.12, 0.07)
}

const tulip: Paint = (g, L, shape) => {
  const heads: readonly (readonly [number, number, number, number])[] =
    shape === 0
      ? [
          [-0.34, -0.4, 0.7, 2],
          [0.06, 0.08, 0.95, 3],
          [0.4, 0.46, 0.62, 2],
        ]
      : [
          [-0.26, -0.3, 0.88, 1],
          [0.26, 0.32, 0.68, 2],
        ]
  for (const [x, tx, h, colour] of heads) {
    g.fillStyle = L.blade
    stem(g, x, tx, h)
    // The cup: three petals closed.
    g.fillStyle = L.petals[colour]!
    g.beginPath()
    g.moveTo(tx - 0.13, -h + 0.02)
    g.quadraticCurveTo(tx - 0.17, -h - 0.2, tx - 0.1, -h - 0.27)
    g.lineTo(tx - 0.04, -h - 0.17)
    g.lineTo(tx, -h - 0.3)
    g.lineTo(tx + 0.04, -h - 0.17)
    g.lineTo(tx + 0.1, -h - 0.27)
    g.quadraticCurveTo(tx + 0.17, -h - 0.2, tx + 0.13, -h + 0.02)
    g.quadraticCurveTo(tx, -h + 0.1, tx - 0.13, -h + 0.02)
    g.closePath()
    g.fill()
  }
  g.fillStyle = L.bladeLit
  blade(g, -0.1, 0.46, -0.14, 0.08)
  blade(g, 0.18, 0.4, 0.16, 0.08)
}

const reed: Paint = (g, L, shape) => {
  const stalks: readonly (readonly [number, number, number])[] =
    shape === 0
      ? [
          [-0.3, 1.25, -0.16],
          [-0.05, 1.62, 0.02],
          [0.2, 1.4, 0.2],
          [0.38, 1.0, 0.3],
        ]
      : [
          [-0.2, 1.5, -0.1],
          [0.08, 1.2, 0.12],
          [0.3, 1.58, 0.24],
        ]
  for (const [x, h, lean] of stalks) {
    g.fillStyle = L.blade
    blade(g, x, h, lean, 0.045)
    // The seed head, at its tip.
    g.fillStyle = L.seed
    g.beginPath()
    g.ellipse(x + lean * 0.94, -h * 0.94, 0.075, 0.24, lean * 0.4, 0, TAU)
    g.fill()
  }
  g.fillStyle = L.bladeLit
  blade(g, 0.0, 0.6, -0.12, 0.07)
}

/** Stones in the ground: a few, each with a lighter side. Painted in a box whose foot is its bottom middle. */
const pebbles: Paint = (g, L, shape) => {
  const stones: readonly (readonly [number, number, number, number, number])[] =
    shape === 0
      ? [
          [-0.8, -0.5, 0.62, 0.4, -0.2],
          [0.35, -0.85, 0.5, 0.34, 0.3],
          [0.95, -0.35, 0.36, 0.26, 0.1],
        ]
      : [
          [-0.4, -0.75, 0.7, 0.44, 0.15],
          [0.7, -0.45, 0.44, 0.3, -0.25],
        ]
  for (const [x, y, rx, ry, turn] of stones) {
    g.fillStyle = L.stone
    g.beginPath()
    g.ellipse(x, y, rx, ry, turn, 0, TAU)
    g.fill()
    g.fillStyle = L.stoneLit
    g.beginPath()
    g.ellipse(x + rx * 0.16, y - ry * 0.22, rx * 0.62, ry * 0.5, turn, 0, TAU)
    g.fill()
  }
}

/** An old shell in the ground: a coil, wound in from its mouth. */
const shell: Paint = (g, L) => {
  g.fillStyle = L.stone
  g.beginPath()
  g.arc(0, -1.1, 0.95, 0, TAU)
  g.fill()
  g.strokeStyle = L.stoneLit
  g.lineWidth = 0.17
  g.lineCap = 'round'
  g.beginPath()
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * TAU * 2.6
    const r = 0.78 * (1 - i / 66)
    const x = Math.cos(a) * r
    const y = -1.1 + Math.sin(a) * r
    if (i) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.stroke()
}

const PAINTS: Record<DecoKind, Paint> = {
  [DECO.Tree]: tree,
  [DECO.Pine]: pine,
  [DECO.Bush]: bush,
  [DECO.Rock]: rock,
  [DECO.Grass]: grass,
  [DECO.Daisy]: daisy,
  [DECO.Tulip]: tulip,
  [DECO.Reed]: reed,
  [DECO.Pebbles]: pebbles,
  [DECO.Shell]: shell,
}

/**
 * How finely the pictures are painted, in canvas pixels a metre: the first that's fine enough for the camera's
 * zoom is used, so one is never stretched, and seldom shrunk by more than half.
 */
const FINENESS = [9, 16, 28, 48] as const
/** Clear canvas round each picture on its sheet, so a neighbour never shows at its edge when it's drawn smaller. */
const PAD = 2

const KINDS = Object.values(DECO) as DecoKind[]

/** A picture's place on its sheet, in the sheet's own pixels. */
export type DecoCell = { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }

type Sheet = { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D | null; cells: Map<number, DecoCell>; painted: Set<number> }

/**
 * The pictures of everything that grows on the hills or lies under them: for each fineness one sheet, every
 * kind's two shapes side by side on it, each painted the first time it's wanted. One sheet, not a canvas a
 * picture, because of what a frame is charged for: thirty stamps off one canvas cost the graphics chip next to
 * nothing, and thirty off twenty canvases cost most of a millisecond on Ramsey's laptop (measured 2026-11-17:
 * the stones underground, off four canvases, were free; the plants, off twenty, were 0.9 ms). `key` names the
 * colours (the theme and the day's), and with the kept pictures' epoch (games/keptPictures.ts) decides when
 * they're all painted again.
 */
export class DecoPictures {
  private sheets = new Map<number, Sheet>()
  private key = ''
  private look: DecoLook

  constructor(look: DecoLook, key: string) {
    this.look = look
    this.key = `${key}|${keptEpoch()}`
  }

  /** New colours: a new theme. */
  relook(look: DecoLook, key: string) {
    this.look = look
    this.key = ''
    this.fresh(key)
  }

  private fresh(key: string) {
    const now = `${key}|${keptEpoch()}`
    if (now === this.key) return
    this.key = now
    this.sheets.clear()
  }

  /** The fineness for a frame whose biggest thing is drawn `px` canvas pixels to the metre: all of it comes off that one sheet. */
  level(px: number): number {
    let level = 0
    while (level < FINENESS.length - 1 && FINENESS[level]! < px) level++
    return level
  }

  private sheet(level: number): Sheet {
    let sheet = this.sheets.get(level)
    if (sheet) return sheet
    const res = FINENESS[level]!
    const canvas = document.createElement('canvas')
    watchKept(canvas)
    const cells = new Map<number, DecoCell>()
    let x = 0
    let tall = 0
    for (const kind of KINDS) {
      const box = BOX[kind]
      const w = Math.ceil(box.w * res)
      const h = Math.ceil((box.h + 0.2) * res)
      for (const shape of [0, 1]) {
        cells.set(kind * 2 + shape, { canvas, x: x + PAD, y: PAD, w, h })
        x += w + PAD * 2
      }
      tall = Math.max(tall, h)
    }
    canvas.width = x
    canvas.height = tall + PAD * 2
    sheet = { canvas, g: canvas.getContext('2d'), cells, painted: new Set() }
    this.sheets.set(level, sheet)
    return sheet
  }

  /** A kind's shape on the sheet of a fineness, painted now if this is the first time it's wanted. */
  cell(kind: DecoKind, shape: 0 | 1, level: number, key: string): DecoCell {
    this.fresh(key)
    const sheet = this.sheet(level)
    const id = kind * 2 + shape
    const cell = sheet.cells.get(id)!
    if (!sheet.painted.has(id)) {
      sheet.painted.add(id)
      const g = sheet.g
      if (g) {
        const box = BOX[kind]
        const res = FINENESS[level]!
        g.save()
        g.beginPath()
        g.rect(cell.x, cell.y, cell.w, cell.h)
        g.clip()
        // The foot's in the middle of the bottom edge, a little above it for what curls under.
        g.translate(cell.x + (box.w * res) / 2, cell.y + box.h * res)
        g.scale(res, res)
        PAINTS[kind](g, this.look, shape)
        g.restore()
      }
    }
    return cell
  }

  clear() {
    this.sheets.clear()
  }
}
