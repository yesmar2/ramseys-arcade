import { LANDER_ART, type ArtShape, type SkinArt } from '../../lib/skinArt'
import { keptEpoch, watchKept } from '../keptPictures'
import type { GhostPose } from './runs'
import { CaveScene, type CaveShape, type SceneFrame } from './scene'
import { inAir, liftAt, mulberry32, type Cave } from './sim'

/*
 * Lander by lamplight: the cave painted as a place, on test (newLook.ts). Ramsey's pick of three looks shown
 * drawn on real caves beside the game as it is (2026-11-25, "ok, let's do A actually"): warm rock in layers,
 * lit from the tunnel so it's brightest at the wall, dark blue air with the cave's far columns standing in
 * it, things growing from the rock, a rope of lamps across each gate that lights as you pass, timber pads,
 * and a little lander with a lamp on its nose in place of the arrow, the lamp warming what's near it. Moths
 * gather to the lamp while you fly clean (LanderGame.tsx counts them) and scatter when you crash.
 *
 * Only the pictures: the cave, the flying, the camera and the ghost are scene.ts's, and so is the easter egg's
 * way out. What can be hit is still exactly the rock's edge: what grows is small and sits on the wall's line.
 *
 * Drawn to the same budget scene.ts keeps (a laptop's graphics chip charges by a shape's box and by the draw):
 * the rock's layers and the air's far columns are tiling pictures, the light in the rock is flat bands along
 * the walls as scene.ts's glow is, and everything small is a stamp off one sheet. The lamp is one stamp, added
 * to the frame as light.
 */

type RGB = readonly [number, number, number]

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgb = (c: RGB) => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`
const rgba = (c: RGB, a: number) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const TAU = Math.PI * 2

/** The rock, near the top of the cave and at its bottom; and what the tunnel's light makes of it at the wall. */
const ROCK: readonly [RGB, RGB] = [
  [66, 45, 38],
  [50, 33, 44],
]
const LIT: RGB = [186, 128, 78]
/** The light in the rock, as bands out from the wall, widest first: how far (m), and how much of LIT. */
const BANDS = [
  [3.3, 0.14],
  [2.0, 0.32],
  [0.95, 0.56],
] as const
/** The wall's lit edge, near the top and deep down, and how thick it is (m). */
const RIM: readonly [RGB, RGB] = [
  [244, 200, 128],
  [250, 172, 122],
]
const RIM_W = 0.24
const AIR: readonly [RGB, RGB] = [
  [23, 27, 48],
  [15, 13, 33],
]
/** The far columns in the air, and the rock's shade on the air beside it: how far in (m), and how dark. */
const FAR: RGB = [44, 46, 78]
const SHADE = [
  [0.62, 0.2],
  [0.28, 0.4],
] as const
const DARK: RGB = [4, 4, 14]
const INK: RGB = [38, 22, 22]
const PALE: RGB = [236, 190, 130]
const STONE: RGB = [150, 106, 72]

/* ------------------------------------------------------------------ the ship --- */

type PodColours = { body: string; shade: string; line: string; glass: string; glint: string; trim: string; metal: string; lamp: string; foot: string }

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`

/**
 * The pod, his pick of three shapes ("A" came with ship 1 unless he named another, and he named none): an egg
 * of a cabin on two legs, a lamp on its nose. Drawn on a season skin's board (lib/skinArt.ts: 100 wide, feet
 * 52 apart on y 86), so it sits on the hull as a skin does: its lamp is the hull's nose, its feet the hull's.
 */
const pod = (P: PodColours): SkinArt => ({
  flame: [],
  body: [
    { d: 'M40 60L25 84M60 60L75 84', stroke: P.metal, width: 3.6, cap: 'round' },
    { d: 'M19 86h12M69 86h12', stroke: P.foot, width: 4, cap: 'round' },
    { d: 'M44 63h12l3 8h-18z', fill: P.metal },
    { d: 'M50 20C61 20 65 36 65 48C65 58 59 65 50 65C41 65 35 58 35 48C35 36 39 20 50 20z', fill: P.body, stroke: P.line, width: 2, join: 'round' },
    { d: 'M50 21C60 22 64 37 64 48C64 57 58.5 64 50 64C56 58 58 50 58 44C58 34 55 25 50 21z', fill: P.shade },
    { d: 'M35.8 52C41 55.5 59 55.5 64.2 52', stroke: P.trim, width: 3 },
    { d: circle(50, 40, 7.5), fill: P.glass, stroke: P.line, width: 1.8 },
    { d: 'M46 37.5a5 5 0 0 1 5 -2.6', stroke: P.glint, width: 1.6, cap: 'round' },
    { d: circle(50, 21.5, 2.7), fill: P.lamp, stroke: P.line, width: 1 },
  ] satisfies ArtShape[],
})

const POD = pod({ body: '#fff3e4', shade: '#e6cfbb', line: '#2a2140', glass: '#2b3a67', glint: '#cfeaff', trim: '#8a5cff', metal: '#514a66', lamp: '#ffd166', foot: '#3a3150' })
/** The blue ship's, and your own best's: the same pod in the ghost's colour. */
const POD_BLUE = pod({ body: '#9fe0ff', shade: '#6cbdf0', line: '#1b4a7a', glass: '#1d477e', glint: '#e4f7ff', trim: '#46e4ff', metal: '#3a7fb8', lamp: '#e4f7ff', foot: '#2e6fa8' })
const POD_AMBER = pod({ body: '#ffe1a0', shade: '#f2bd62', line: '#6b4310', glass: '#7a4f14', glint: '#fff4d6', trim: '#f5b942', metal: '#b98632', lamp: '#fff4d6', foot: '#9a6a1e' })

/* ------------------------------------------------------------------ the kept pictures --- */

/** The rock's layers: a tile of this many metres, painted this fine, that lies on itself at every edge. */
const ROCK_F = 32
const ROCK_W = 36
const ROCK_H = 16
/** The far columns: a tile of the cave's back wall, the air's colour under it. */
const AIR_F = 16
const AIR_W = 32
const AIR_H = 24
/** How much less the back wall moves than the cave does, and so how much smaller it's drawn. */
const FAR_BACK = 0.6
/** The air darkens with depth in this many steps: its tile is painted again at each. */
const AIR_STEPS = 10

function paintRockTile(g: CanvasRenderingContext2D) {
  const W = ROCK_W * ROCK_F
  const H = ROCK_H * ROCK_F
  g.clearRect(0, 0, W, H)
  const rnd = mulberry32(4107)
  const layers = 8
  for (let j = 0; j < layers; j++) {
    const tone = rnd() * 2 - 1
    const thick = (0.5 + rnd() * 1.1) * ROCK_F
    const p1 = rnd() * TAU
    const p2 = rnd() * TAU
    const m1 = 1 + Math.floor(rnd() * 2)
    const m2 = 3 + Math.floor(rnd() * 2)
    // Whole waves across the tile, long and low, so a layer meets itself at the tile's sides.
    const edge = (x: number) => (j * H) / layers + (0.5 * Math.sin((x / W) * TAU * m1 + p1) + 0.2 * Math.sin((x / W) * TAU * m2 + p2)) * ROCK_F
    for (const dy of [-H, 0, H]) {
      g.beginPath()
      for (let x = 0; x <= W; x += 8) g.lineTo(x, edge(x) + dy)
      for (let x = W; x >= 0; x -= 8) g.lineTo(x, edge(x) + thick + dy)
      g.closePath()
      g.fillStyle = tone > 0 ? rgba(PALE, 0.04 + 0.075 * tone) : rgba(INK, 0.06 + 0.13 * -tone)
      g.fill()
      g.beginPath()
      for (let x = 0; x <= W; x += 8) g.lineTo(x, edge(x) + dy)
      g.strokeStyle = rgba(INK, 0.16)
      g.lineWidth = 1.2
      g.stroke()
    }
  }
  // Pebbles in it, each drawn again past an edge it lies across.
  for (let i = 0; i < 110; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const s = (0.1 + rnd() * 0.26) * ROCK_F
    const turn = rnd() * 3
    g.fillStyle = rnd() < 0.5 ? rgba(PALE, 0.22) : rgba(INK, 0.26)
    for (const dx of [-W, 0, W]) {
      for (const dy of [-H, 0, H]) {
        if (x + dx < -24 || x + dx > W + 24 || y + dy < -24 || y + dy > H + 24) continue
        g.beginPath()
        g.ellipse(x + dx, y + dy, s * 1.4, s, turn, 0, TAU)
        g.fill()
      }
    }
  }
}

function paintAirTile(g: CanvasRenderingContext2D, air: RGB) {
  const W = AIR_W * AIR_F
  const H = AIR_H * AIR_F
  g.fillStyle = rgb(air)
  g.fillRect(0, 0, W, H)
  const rnd = mulberry32(977)
  g.fillStyle = rgba(FAR, 0.5)
  const n = 6
  for (let i = 0; i < n; i++) {
    const x = (i + 0.15 + rnd() * 0.7) * (W / n)
    const wide = (1.3 + rnd() * 2.6) * AIR_F
    const p1 = rnd() * TAU
    const p2 = rnd() * TAU
    const m1 = 1 + Math.floor(rnd() * 2)
    const m2 = 1 + Math.floor(rnd() * 2)
    for (const dx of [-W, 0, W]) {
      g.beginPath()
      for (let y = 0; y <= H; y += 12) g.lineTo(x + dx - (wide / 2) * (1 + 0.28 * Math.sin((y / H) * TAU * m1 + p1)), y)
      for (let y = H; y >= 0; y -= 12) g.lineTo(x + dx + (wide / 2) * (1 + 0.28 * Math.sin((y / H) * TAU * m2 + p2)), y)
      g.closePath()
      g.fill()
    }
  }
}

/** A stamp on the sheet: where it is, how fine it's painted (pixels a metre), and where its own middle is. */
type Cell = { x: number; y: number; w: number; h: number; f: number; ax: number; ay: number }

/** What grows from the rock, by which way the rock faces: the stamps to choose from. */
const GROWS = {
  ceiling: ['stal', 'stal', 'root'],
  floor: ['stal', 'peb', 'stal', 'amber'],
  side: ['peb', 'amber'],
} as const
type Grown = 'stal' | 'peb' | 'root' | 'amber'
const VARIANTS: Record<Grown, number> = { stal: 6, peb: 3, root: 3, amber: 3 }
const PROP_F = 44
const PROP_W = 64
const PROP_H = 72
/** A grown thing's foot, on the wall's line: this far up its cell, so its root is in the rock. */
const PROP_FOOT = 62

type StampName = 'lampOn' | 'lampOff' | 'padOn' | 'moth0' | 'moth1' | 'lamp'

function paintProp(g: CanvasRenderingContext2D, kind: Grown, rnd: () => number) {
  // The wall's line is y = 0 here, and up (−y) is out into the air; a metre is PROP_F.
  const s = PROP_F
  const stone = () => {
    g.fillStyle = rgb(STONE)
    g.fill()
    g.strokeStyle = rgba(INK, 0.55)
    g.lineWidth = Math.max(1, 0.05 * s)
    g.stroke()
  }
  if (kind === 'stal') {
    const len = (0.4 + rnd() * 0.62) * s
    const w = (0.17 + rnd() * 0.15) * s
    g.beginPath()
    g.moveTo(-w, 0.12 * s)
    g.quadraticCurveTo(-w * 0.25, -len * 0.45, 0, -len)
    g.quadraticCurveTo(w * 0.25, -len * 0.45, w, 0.12 * s)
    g.closePath()
    stone()
    g.beginPath()
    g.moveTo(-w * 0.45, 0.05 * s)
    g.quadraticCurveTo(-w * 0.15, -len * 0.4, -0.02 * s, -len * 0.85)
    g.strokeStyle = rgba(PALE, 0.55)
    g.lineWidth = Math.max(1, 0.05 * s)
    g.stroke()
  } else if (kind === 'peb') {
    const w = (0.15 + rnd() * 0.2) * s
    g.beginPath()
    g.ellipse(0, -w * 0.25, w, w * 0.6, 0, 0, TAU)
    stone()
  } else if (kind === 'root') {
    g.strokeStyle = 'rgba(120, 88, 64, 0.9)'
    g.lineCap = 'round'
    for (let q = 0; q < 3; q++) {
      const len = (0.4 + rnd() * 0.7) * s
      const x = (q - 1) * 0.16 * s + (rnd() - 0.5) * 0.1 * s
      g.lineWidth = Math.max(1, (0.07 - q * 0.012) * s)
      g.beginPath()
      g.moveTo(x, 0.1 * s)
      g.bezierCurveTo(x + 0.14 * s, -len * 0.3, x - 0.16 * s, -len * 0.7, x + (rnd() - 0.5) * 0.2 * s, -len)
      g.stroke()
    }
  } else {
    // Amber, in shards: a lit face and a dark one.
    const n = 2 + Math.floor(rnd() * 3)
    for (let q = 0; q < n; q++) {
      const lean = (q - (n - 1) / 2) * 0.42 + (rnd() - 0.5) * 0.2
      const len = (0.26 + rnd() * 0.38) * s
      const w = (0.065 + rnd() * 0.045) * s
      g.save()
      g.rotate(lean)
      g.beginPath()
      g.moveTo(-w, 0.1 * s)
      g.lineTo(-w, -len * 0.72)
      g.lineTo(0, -len)
      g.lineTo(w, -len * 0.72)
      g.lineTo(w, 0.1 * s)
      g.closePath()
      g.fillStyle = 'rgb(214, 120, 50)'
      g.fill()
      g.beginPath()
      g.moveTo(-w, 0.1 * s)
      g.lineTo(-w, -len * 0.72)
      g.lineTo(0, -len)
      g.lineTo(0, 0.1 * s)
      g.closePath()
      g.fillStyle = 'rgb(255, 196, 96)'
      g.fill()
      g.restore()
    }
  }
}

function halo(g: CanvasRenderingContext2D, x: number, y: number, r: number, colour: RGB, alpha: number) {
  const light = g.createRadialGradient(x, y, 0, x, y, r)
  light.addColorStop(0, rgba(colour, alpha))
  light.addColorStop(0.45, rgba(colour, alpha * 0.42))
  light.addColorStop(1, rgba(colour, 0))
  g.fillStyle = light
  g.fillRect(x - r, y - r, 2 * r, 2 * r)
}

/** A gate's lamp, hanging from its rope at the cell's `ax, ay`: lit, with its light round it, or dark. */
function paintGateLamp(g: CanvasRenderingContext2D, f: number, lit: boolean) {
  if (lit) halo(g, 0, 0.3 * f, 1.45 * f, [255, 200, 110], 0.32)
  g.fillStyle = '#6b4a2e'
  g.fillRect(-0.12 * f, 0, 0.24 * f, 0.16 * f)
  g.beginPath()
  g.arc(0, 0.36 * f, 0.24 * f, 0, TAU)
  g.fillStyle = lit ? '#ffe2a0' : 'rgba(64, 50, 56, 0.95)'
  g.fill()
  g.strokeStyle = lit ? '#ffb347' : 'rgba(214, 170, 110, 0.9)'
  g.lineWidth = Math.max(1, 0.06 * f)
  g.stroke()
}

function paintMoth(g: CanvasRenderingContext2D, f: number, open: number) {
  halo(g, 0, 0, 1.15 * f, [255, 200, 120], 0.5)
  const s = 0.34 * f
  g.fillStyle = 'rgba(255, 236, 190, 0.96)'
  for (const side of [-1, 1]) {
    g.beginPath()
    g.ellipse(side * s * 0.7, -s * 0.2, s * 0.75, s * (0.3 + 0.42 * open), side * -0.5, 0, TAU)
    g.fill()
  }
  g.fillStyle = '#fffdf2'
  g.beginPath()
  g.ellipse(0, 0, s * 0.2, s * 0.5, 0, 0, TAU)
  g.fill()
}

/** The sheet every stamp comes off: what grows from the rock, the gates' lamps, a pad's light, the moths, the lamp's light. */
class Sheet {
  readonly canvas = document.createElement('canvas')
  readonly cells = {} as Record<StampName, Cell>
  readonly grown = {} as Record<Grown, Cell[]>
  private key = ''

  constructor() {
    watchKept(this.canvas)
  }

  /** Painted, the first time and whenever the browser may have dropped it (games/keptPictures.ts). */
  ready() {
    const key = `${keptEpoch()}`
    if (key === this.key) return
    this.key = key
    const count = Object.values(VARIANTS).reduce((a, b) => a + b, 0)
    this.canvas.width = Math.max(count * PROP_W, 700)
    this.canvas.height = PROP_H + 256
    const g = this.canvas.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, this.canvas.width, this.canvas.height)
    let x = 0
    const rnd = mulberry32(61)
    for (const kind of Object.keys(VARIANTS) as Grown[]) {
      this.grown[kind] = []
      for (let v = 0; v < VARIANTS[kind]; v++) {
        g.save()
        g.beginPath()
        g.rect(x, 0, PROP_W, PROP_H)
        g.clip()
        g.translate(x + PROP_W / 2, PROP_FOOT)
        paintProp(g, kind, rnd)
        g.restore()
        this.grown[kind].push({ x, y: 0, w: PROP_W, h: PROP_H, f: PROP_F, ax: PROP_W / 2, ay: PROP_FOOT })
        x += PROP_W
      }
    }
    // The second row: the lights.
    const row = PROP_H
    let at = 0
    const put = (name: StampName, w: number, h: number, f: number, ax: number, ay: number, paint: () => void) => {
      g.save()
      g.beginPath()
      g.rect(at, row, w, h)
      g.clip()
      g.translate(at + ax, row + ay)
      paint()
      g.restore()
      this.cells[name] = { x: at, y: row, w, h, f, ax, ay }
      at += w
    }
    put('lampOn', 120, 120, 40, 60, 48, () => paintGateLamp(g, 40, true))
    put('lampOff', 32, 32, 40, 16, 4, () => paintGateLamp(g, 40, false))
    put('padOn', 64, 64, 40, 32, 32, () => {
      halo(g, 0, 0, 0.78 * 40, [255, 210, 130], 0.42)
      g.beginPath()
      g.arc(0, 0, 0.14 * 40, 0, TAU)
      g.fillStyle = '#fff4d6'
      g.fill()
    })
    put('moth0', 96, 96, 40, 48, 48, () => paintMoth(g, 40, 1))
    put('moth1', 96, 96, 40, 48, 48, () => paintMoth(g, 40, 0.25))
    // The ship's lamp: warm light, 10.5 m out, laid over the frame as light.
    put('lamp', 252, 252, 12, 126, 126, () => halo(g, 0, 0, 126, [255, 186, 104], 0.36))
  }
}

/** A thing grown from the rock, laid once for the cave: where, which way up, which stamp, how big, which way round. */
type Laid = { x: number; y: number; turn: number; kind: Grown; pick: number; size: number; flip: boolean }

/** How often a wall's point grows something. */
const LUSH = 0.4

function layProps(cave: Cave): Laid[] {
  const laid: Laid[] = []
  const lab = cave.lab
  const tryAt = (x: number, y: number, ux: number, uy: number, hint: number, seed: number) => {
    const rnd = mulberry32(seed)
    if (rnd() > LUSH) return
    // Really a wall: rock behind it, air in front (a tunnel's wall runs on through a room's air).
    if (inAir(cave, x + ux * 0.35, y + uy * 0.35, hint) || !inAir(cave, x - ux * 0.35, y - uy * 0.35, hint)) return
    // Nothing grows on a pad, where a gate's line meets the wall, by a vent, or out of lava.
    if (cave.pads.some((p) => x > p.x0 - 0.6 && x < p.x1 + 0.6 && Math.abs(y - p.y) < 1.2)) return
    if (cave.gates.some((g) => Math.hypot(x - g.x0, y - g.y0) < 1.3 || Math.hypot(x - g.x1, y - g.y1) < 1.3)) return
    if (lab?.vents.some((v) => Math.hypot(x - v.x, y - v.y) < 1.8)) return
    if (lab?.lava.some((l) => x > l.x0 - 0.4 && x < l.x1 + 0.4 && y > l.y0 - 0.6 && y < l.y1 + 0.8)) return
    const face = uy > 0.55 ? 'ceiling' : uy < -0.55 ? 'floor' : 'side'
    const kinds = GROWS[face]
    const kind = kinds[Math.floor(rnd() * kinds.length)]!
    laid.push({ x, y, turn: Math.atan2(-ux, -uy), kind, pick: Math.floor(rnd() * VARIANTS[kind]), size: 1.05 + rnd() * 0.3, flip: rnd() < 0.5 })
  }
  const N = cave.nodes
  for (let i = 0; i < N.length; i++) {
    const a = N[Math.max(0, i - 1)]!
    const b = N[Math.min(N.length - 1, i + 1)]!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    const p = N[i]!
    tryAt(p.x + nx * p.r, p.y + ny * p.r, nx, ny, i, (i * 2 + 1) * 7919)
    tryAt(p.x - nx * p.r, p.y - ny * p.r, -nx, -ny, i, (i * 2 + 2) * 7919)
  }
  cave.rooms.forEach((room, q) => {
    const hint = q === 0 ? 0 : N.length - 1
    for (let x = room.x0 + 0.8; x < room.x1 - 0.4; x += 1.5) {
      tryAt(x, room.y0, 0, -1, hint, Math.round(x * 10) * 31 + 91 + q)
      tryAt(x, room.y1, 0, 1, hint, Math.round(x * 10) * 31 + 92 + q)
    }
    for (let y = room.y0 + 0.8; y < room.y1 - 0.4; y += 1.5) {
      tryAt(room.x0, y, -1, 0, hint, Math.round(y * 10) * 31 + 93 + q)
      tryAt(room.x1, y, 1, 0, hint, Math.round(y * 10) * 31 + 94 + q)
    }
  })
  return laid
}

/* ------------------------------------------------------------------ the moths --- */

/** No more than this many are drawn, however clean the run. */
export const MOTHS_SHOWN = 12

type Moth = { x: number; y: number; born: number; phase: number; placed: boolean }
type Stray = { x: number; y: number; vx: number; vy: number; life: number; phase: number }

/* ------------------------------------------------------------------ the scene --- */

export class LamplightScene extends CaveScene {
  private readonly sheet = new Sheet()
  private readonly laid: Laid[]
  private readonly rockTile = document.createElement('canvas')
  private readonly airTile = document.createElement('canvas')
  private rockPattern: CanvasPattern | null = null
  private airPattern: CanvasPattern | null = null
  private rockKey = ''
  private airKey = ''
  private moths: Moth[] = []
  private strays: Stray[] = []
  /** Where the ship has been, lately: x, y and the moment, three numbers a frame, for the moths to follow. */
  private trail: number[] = []

  constructor(canvas: HTMLCanvasElement, cave: Cave) {
    super(canvas, cave)
    this.laid = layProps(cave)
    watchKept(this.rockTile)
    watchKept(this.airTile)
    this.tone = {
      rock: rgb(ROCK[0]),
      air: rgb(AIR[0]),
      block: '#6b5647',
      stripe: '#f2b24a',
      blockEdge: '#2c1c1a',
      bar: '#5a2f2a',
      barEdge: '#f08a5a',
      barLight: '#ffd166',
      barDot: '#f08a5a',
      hub: '#2c1c1a',
      nozzle: '#3a2a26',
      nozzleCold: 'rgba(150, 130, 150, 0.6)',
      piston: ['#3a2c2a', '#8a6a52'],
      pistonRing: 'rgba(255, 179, 71, 0.45)',
      slab: '#3a2c2a',
    }
  }

  snap() {
    super.snap()
    this.trail.length = 0
    for (const m of this.moths) m.placed = false
  }

  dispose() {
    super.dispose()
    this.moths.length = 0
    this.strays.length = 0
    this.trail.length = 0
  }

  /** How deep a height is in the cave, 0 at its top to 1 at its bottom. */
  private depth(y: number) {
    const box = this.cave.box
    return clamp((box[3] - y) / (box[3] - box[2]), 0, 1)
  }

  /** The wall's lit edge by depth: what the way out's cracks and sides are drawn in too. */
  protected wallRgb(y: number) {
    return mix(RIM[0], RIM[1], this.depth(y)).map((v) => Math.round(v))
  }

  /* ---------- the kept pictures ---------- */

  private tiles(step: number) {
    const epoch = keptEpoch()
    const rockKey = `${epoch}`
    if (rockKey !== this.rockKey) {
      this.rockKey = rockKey
      this.rockTile.width = ROCK_W * ROCK_F
      this.rockTile.height = ROCK_H * ROCK_F
      const g = this.rockTile.getContext('2d')
      if (g) paintRockTile(g)
      this.rockPattern = this.ctx.createPattern(this.rockTile, 'repeat')
    }
    const airKey = `${epoch}|${step}`
    if (airKey !== this.airKey) {
      this.airKey = airKey
      this.airTile.width = AIR_W * AIR_F
      this.airTile.height = AIR_H * AIR_F
      const g = this.airTile.getContext('2d')
      if (g) paintAirTile(g, mix(AIR[0], AIR[1], step / AIR_STEPS))
      this.airPattern = this.ctx.createPattern(this.airTile, 'repeat')
    }
    this.sheet.ready()
  }

  /** A stamp off the sheet, its own middle at a place on the screen, a metre of it a metre of the cave times `size`. */
  private stamp(name: StampName, x: number, y: number, size = 1) {
    const c = this.sheet.cells[name]
    if (!c) return
    const s = (this.cam.k / c.f) * size
    this.ctx.drawImage(this.sheet.canvas, c.x, c.y, c.w, c.h, x - c.ax * s, y - c.ay * s, c.w * s, c.h * s)
  }

  /* ---------- the cave ---------- */

  /** Every wall's band, from the air's side of its line out `d` metres into the rock, in the fill already set. */
  private bands(shape: CaveShape, d: number) {
    const { ctx, cam } = this
    for (const [left, right] of shape.tunnels) {
      this.band(left, -0.3, d)
      this.band(right, -0.3, d)
    }
    const o = d * cam.k
    for (const e of shape.ends) {
      if (!e.lit) continue
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.r + o, 0, TAU)
      ctx.fill()
    }
    for (const m of shape.rooms) {
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect(m.x - o, m.y - o, m.w + 2 * o, m.h + 2 * o, o)
      else ctx.rect(m.x - o, m.y - o, m.w + 2 * o, m.h + 2 * o)
      ctx.fill()
    }
  }

  protected drawCave(f: SceneFrame) {
    const { ctx, cam, W, H, cave } = this
    const here = this.depth(cam.y)
    const step = Math.round(here * AIR_STEPS)
    this.tiles(step)
    const base = mix(ROCK[0], ROCK[1], here)
    const air = mix(AIR[0], AIR[1], step / AIR_STEPS)
    this.tone.rock = rgb(base)
    this.tone.air = rgb(air)

    // The rock, and its layers: a picture that tiles, lying still on the rock as the camera moves and pulls back.
    ctx.fillStyle = this.tone.rock
    ctx.fillRect(0, 0, W, H)
    if (this.rockPattern) {
      const s = cam.k / ROCK_F
      this.rockPattern.setTransform(new DOMMatrix([s, 0, 0, s, W / 2 - cam.x * cam.k, H / 2 + cam.y * cam.k]))
      ctx.fillStyle = this.rockPattern
      ctx.fillRect(0, 0, W, H)
    }

    const span = this.spanInView()
    const shape = this.caveShape(span)
    // The tunnel's light in the rock, brightest at the wall: each band solid, as scene.ts lays its glow, then
    // the lit edge. The air covers their inner ends.
    for (const [d, w] of BANDS) {
      ctx.fillStyle = rgb(mix(base, LIT, w))
      this.bands(shape, d)
    }
    ctx.fillStyle = rgb(mix(RIM[0], RIM[1], here))
    this.bands(shape, RIM_W)

    // The air: the cave's back wall far off, its columns moving less than the walls do. The rock's shade lies
    // on the tunnel's air beside each wall, and the rooms' and ends' air covers it where they open out.
    if (this.airPattern) {
      const s = (cam.k * FAR_BACK) / AIR_F
      this.airPattern.setTransform(new DOMMatrix([s, 0, 0, s, W / 2 - cam.x * cam.k * FAR_BACK, H / 2 + cam.y * cam.k * FAR_BACK]))
      ctx.fillStyle = this.airPattern
    } else ctx.fillStyle = this.tone.air
    const airFill = ctx.fillStyle
    for (const t of shape.tunnels) this.tunnelAir(t)
    for (const [inside, dark] of SHADE) {
      ctx.fillStyle = rgb(mix(air, DARK, dark))
      for (const [left, right] of shape.tunnels) {
        this.band(left, -inside, 0)
        this.band(right, -inside, 0)
      }
    }
    ctx.fillStyle = airFill
    for (const e of shape.ends) {
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.r, 0, TAU)
      ctx.fill()
    }
    for (const m of shape.rooms) ctx.fillRect(m.x, m.y, m.w, m.h)

    if (cave.lab) {
      // Made only when something's in view to be cut to it.
      let path: Path2D | null = null
      const cut = () => (path ??= this.airPath(shape))
      this.drawLava(cut)
      this.drawLabAir(cut)
    }

    // Pillars: rock standing in the air, lit round the edge as the walls are, from the outside in.
    const hw = W / 2 / cam.k + 6
    const hh = H / 2 / cam.k + 6
    for (const p of cave.pillars) {
      if (Math.abs(p.x - cam.x) > hw || Math.abs(p.y - cam.y) > hh) continue
      const x = this.sx(p.x)
      const y = this.sy(p.y)
      const rings: [number, RGB][] = [
        [p.r, mix(RIM[0], RIM[1], here)],
        [p.r - RIM_W, mix(base, LIT, BANDS[2][1])],
        [p.r - 0.75, mix(base, LIT, BANDS[1][1])],
        [p.r - 1.5, mix(base, LIT, BANDS[0][1])],
        [p.r - 2.4, base],
      ]
      for (const [r, colour] of rings) {
        if (r <= 0) continue
        ctx.beginPath()
        ctx.arc(x, y, r * cam.k, 0, TAU)
        ctx.fillStyle = rgb(colour)
        ctx.fill()
      }
    }

    this.drawProps()
    // The line the things drawn next have always had from the walls (scene.ts): the turning bar's hub is ringed in it.
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 0.44 * cam.k
    this.drawLabSolids()
    this.drawGates(f)
    this.drawPads()
  }

  /** What grows from the rock, in view: stamps, each turned to stand out from its wall. */
  private drawProps() {
    const { ctx, cam, W, H, dpr } = this
    const hw = W / 2 / cam.k + 2
    const hh = H / 2 / cam.k + 2
    const sheet = this.sheet.canvas
    for (const p of this.laid) {
      if (Math.abs(p.x - cam.x) > hw || Math.abs(p.y - cam.y) > hh) continue
      const c = this.sheet.grown[p.kind]?.[p.pick]
      if (!c) continue
      const q = (cam.k / c.f) * p.size * dpr
      const cos = Math.cos(p.turn) * q
      const sin = Math.sin(p.turn) * q
      ctx.setTransform(p.flip ? -cos : cos, p.flip ? -sin : sin, -sin, cos, this.sx(p.x) * dpr, this.sy(p.y) * dpr)
      ctx.drawImage(sheet, c.x, c.y, c.w, c.h, -c.ax, -c.ay, c.w, c.h)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** A gate: a rope of lamps across the cave, dark until you're through it, then lit; its number on a tag. */
  protected drawGates(f: SceneFrame) {
    const { ctx, cam, W, H, cave } = this
    const k = cam.k
    ctx.save()
    ctx.lineCap = 'round'
    cave.gates.forEach((g, i) => {
      const x0 = this.sx(g.x0)
      const y0 = this.sy(g.y0)
      const x1 = this.sx(g.x1)
      const y1 = this.sy(g.y1)
      if (Math.max(x0, x1) < -60 || Math.min(x0, x1) > W + 60 || Math.max(y0, y1) < -60 || Math.min(y0, y1) > H + 60) return
      const passed = f.mode !== 'menu' && f.gate >= i
      const next = f.mode !== 'menu' && f.gate + 1 === i
      const len = Math.hypot(x1 - x0, y1 - y0)
      // The rope hangs toward the bottom of the screen, whichever way the gate lies.
      const mx = (x0 + x1) / 2
      const my = (y0 + y1) / 2 + 0.14 * len
      ctx.strokeStyle = 'rgba(206, 170, 120, 0.85)'
      ctx.lineWidth = Math.max(1.2, 0.07 * k)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.quadraticCurveTo(mx, my, x1, y1)
      ctx.stroke()
      const n = Math.max(4, Math.round(len / (1.5 * k)))
      ctx.globalAlpha = passed || next ? 1 : 0.8
      for (let q = 1; q < n; q++) {
        const u = q / n
        const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1
        const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1
        this.stamp(passed ? 'lampOn' : 'lampOff', x, y)
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = '#8a6240'
      for (const [x, y] of [
        [x0, y0],
        [x1, y1],
      ] as const) {
        ctx.beginPath()
        ctx.arc(x, y, Math.max(2.5, 0.24 * k), 0, TAU)
        ctx.fill()
      }
      // Its number, on a tag over its middle.
      const size = Math.round(Math.max(11, 0.75 * k))
      const label = i === cave.gates.length - 1 ? 'ROOM' : `${i + 1}`
      ctx.font = `700 ${size}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const tx = (x0 + x1) / 2
      const ty = (y0 + y1) / 2 - 1.05 * k
      const tw = ctx.measureText(label).width + size * 0.9
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect(tx - tw / 2, ty - size * 0.72, tw, size * 1.44, size * 0.4)
      else ctx.rect(tx - tw / 2, ty - size * 0.72, tw, size * 1.44)
      ctx.fillStyle = passed ? 'rgba(255, 196, 110, 0.95)' : 'rgba(12, 10, 26, 0.72)'
      ctx.fill()
      if (!passed) {
        ctx.strokeStyle = 'rgba(255, 196, 110, 0.9)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      ctx.fillStyle = passed ? '#1c1226' : '#ffd9a0'
      ctx.fillText(label, tx, ty + 1)
    })
    ctx.restore()
  }

  /** The pads: planks on trestles, lights along them (running to the middle of the one to land on), a sign under each. */
  protected drawPads() {
    const { ctx, cam, W, H } = this
    const k = cam.k
    const lift = this.cave.lab?.lift
    for (const pad of this.cave.pads) {
      const x0 = this.sx(pad.x0)
      const x1 = this.sx(pad.x1)
      const top = pad.end && lift ? liftAt(lift, this.now).y : pad.y
      const y = this.sy(top)
      if (x1 < -40 || x0 > W + 40 || y < -140 || y > H + 140) continue
      if (pad.end && lift) this.drawPiston(pad.x0, pad.x1, top, lift.y0)
      const h = Math.max(3, 0.3 * k)
      if (pad.end) {
        // Light rising off the landing pad.
        const wash = ctx.createLinearGradient(0, y, 0, y - 3.4 * k)
        wash.addColorStop(0, 'rgba(255, 179, 71, 0.24)')
        wash.addColorStop(1, 'rgba(255, 179, 71, 0)')
        ctx.fillStyle = wash
        ctx.fillRect(x0, y - 3.4 * k, x1 - x0, 3.4 * k)
      }
      if (!(pad.end && lift)) {
        ctx.fillStyle = '#7a5230'
        for (const u of [0.1, 0.5, 0.9]) ctx.fillRect(lerp(x0, x1, u) - 0.14 * k, y - h * 0.2, 0.28 * k, 0.7 * k)
      }
      ctx.fillStyle = '#b9814a'
      ctx.fillRect(x0 - 0.15 * k, y - h, x1 - x0 + 0.3 * k, h)
      ctx.fillStyle = '#2c1a14'
      const line = Math.max(1, Math.round(0.05 * k))
      ctx.fillRect(x0 - 0.15 * k, y - line, x1 - x0 + 0.3 * k, line)
      for (let x = x0 + 0.9 * k; x < x1; x += 0.9 * k) ctx.fillRect(x, y - h, line, h)
      // Lights along it, running toward the middle on the landing pad.
      const n = 6
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n
        const on = pad.end ? ((Math.floor(this.time * 6 - Math.abs(u - 0.5) * 6) % 3) + 3) % 3 === 0 : i % 2 === 0
        const lx = lerp(x0, x1, u)
        const ly = y - h - Math.max(2, 0.2 * k)
        if (on) this.stamp('padOn', lx, ly)
        else {
          ctx.beginPath()
          ctx.arc(lx, ly, Math.max(1.6, 0.14 * k), 0, TAU)
          ctx.fillStyle = 'rgba(255, 179, 71, 0.4)'
          ctx.fill()
        }
      }
      // Its sign, on a board: the rock under a pad is lit here, and the words wouldn't show on it.
      const size = Math.round(Math.max(11, 0.8 * k))
      const words = pad.end ? 'LAND HERE' : 'START'
      ctx.font = `800 ${size}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const ly = y + Math.max(15, 1.25 * k) + (pad.end && lift ? 0.5 * k : 0)
      const tw = ctx.measureText(words).width + size * 1.1
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect((x0 + x1) / 2 - tw / 2, ly - size * 0.78, tw, size * 1.56, size * 0.36)
      else ctx.rect((x0 + x1) / 2 - tw / 2, ly - size * 0.78, tw, size * 1.56)
      ctx.fillStyle = 'rgba(36, 22, 18, 0.86)'
      ctx.fill()
      ctx.fillStyle = '#ffd696'
      ctx.fillText(words, (x0 + x1) / 2, ly + 1)
    }
  }

  /* ---------- the lamp, the moths, the ships ---------- */

  /** The ship's lamp on the cave, and the moths that follow it, under the ships. */
  protected underShips(f: SceneFrame, dt: number) {
    const { ctx } = this
    const flying = f.mode === 'play' || f.mode === 'done'
    const sx = f.mode === 'menu' ? this.cave.spawn.x : f.ship.x
    const sy = f.mode === 'menu' ? this.cave.spawn.y : f.ship.y
    if (f.mode !== 'wreck') {
      // A flame's flicker in it, a little.
      const size = 1 + 0.025 * Math.sin(this.time * 7.3) + 0.015 * Math.sin(this.time * 12.1)
      ctx.globalCompositeOperation = 'lighter'
      this.stamp('lamp', this.sx(sx), this.sy(sy + 0.6), size)
      ctx.globalCompositeOperation = 'source-over'
    }
    // Dust in the lamplight: specks hanging in the air near the ship, each where it always is.
    const reach = 8
    const cell = 2.4
    for (let ix = Math.floor((sx - reach) / cell); ix <= Math.floor((sx + reach) / cell); ix++) {
      for (let iy = Math.floor((sy - reach) / cell); iy <= Math.floor((sy + reach) / cell); iy++) {
        const h = (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663)) >>> 0
        const mx = (ix + (h & 255) / 255) * cell + Math.sin(this.time * 0.4 + (h & 63)) * 0.25
        const my = (iy + ((h >>> 8) & 255) / 255) * cell + Math.cos(this.time * 0.3 + ((h >>> 6) & 63)) * 0.2
        const near = 1 - Math.hypot(mx - sx, my - sy) / reach
        if (near <= 0.05 || f.mode === 'wreck') continue
        ctx.fillStyle = `rgba(255, 226, 170, ${(near * 0.5).toFixed(3)})`
        const s = 1 + ((h >>> 16) & 3) * 0.4
        ctx.fillRect(this.sx(mx), this.sy(my), s, s)
      }
    }

    // The moths: each a beat behind the one before, along the way the ship came; round the lamp when it's slow.
    const want = f.mode === 'menu' ? 0 : Math.min(MOTHS_SHOWN, f.moths ?? 0)
    if (flying && dt > 0) {
      this.trail.push(f.ship.x, f.ship.y, this.time)
      while (this.trail.length > 3 && this.trail[2]! < this.time - 3.2) this.trail.splice(0, 3)
    }
    while (this.moths.length > want) {
      // Scattered: off they go, every way, and fade.
      const m = this.moths.pop()!
      const away = Math.random() * TAU
      const speed = 5 + Math.random() * 6
      this.strays.push({ x: m.x, y: m.y, vx: Math.cos(away) * speed, vy: Math.sin(away) * speed + 2, life: 0.9, phase: m.phase })
    }
    while (this.moths.length < want) this.moths.push({ x: sx, y: sy, born: this.time, phase: Math.random() * TAU, placed: false })
    const speed = Math.hypot(f.ship.vx, f.ship.vy)
    const round = clamp(1 - (speed - 1) / 3, 0, 1)
    this.moths.forEach((m, i) => {
      const [tx, ty] = this.cameBy(this.time - (0.26 + i * 0.13), sx, sy)
      const turn = m.phase + this.time * (0.9 + (i % 3) * 0.25)
      const ox = sx + Math.cos(turn) * (1.3 + (i % 4) * 0.42)
      const oy = sy + 0.9 + Math.sin(turn) * (0.8 + (i % 3) * 0.3)
      const fx = lerp(tx + Math.sin(this.time * 3.1 + m.phase) * 0.32, ox, round)
      const fy = lerp(ty + Math.cos(this.time * 2.6 + m.phase * 1.7) * 0.26, oy, round)
      if (!m.placed) {
        m.x = fx
        m.y = fy
        m.placed = true
      } else {
        const ease = 1 - Math.exp(-dt * 7)
        m.x += (fx - m.x) * ease
        m.y += (fy - m.y) * ease
      }
      ctx.globalAlpha = clamp((this.time - m.born) / 0.4, 0, 1)
      this.stamp(Math.sin(this.time * 34 + m.phase * 5) > 0 ? 'moth0' : 'moth1', this.sx(m.x), this.sy(m.y), 1.25 - i * 0.02)
    })
    for (let i = this.strays.length - 1; i >= 0; i--) {
      const s = this.strays[i]!
      s.life -= dt
      if (s.life <= 0) {
        this.strays.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vx *= 1 - dt * 1.2
      s.vy *= 1 - dt * 1.2
      ctx.globalAlpha = clamp(s.life / 0.6, 0, 1)
      this.stamp(Math.sin(this.time * 34 + s.phase * 5) > 0 ? 'moth0' : 'moth1', this.sx(s.x), this.sy(s.y), 1.15)
    }
    ctx.globalAlpha = 1
  }

  /** Where the ship was at a moment lately, from its trail; where it is, with no trail that far back. */
  private cameBy(at: number, x: number, y: number): [number, number] {
    const t = this.trail
    for (let i = t.length - 3; i >= 3; i -= 3) {
      if (t[i - 1]! <= at) {
        const a = t[i - 1]!
        const b = t[i + 2]!
        const u = b > a ? clamp((at - a) / (b - a), 0, 1) : 0
        return [lerp(t[i - 3]!, t[i]!, u), lerp(t[i - 2]!, t[i + 1]!, u)]
      }
    }
    return t.length >= 3 ? [t[0]!, t[1]!] : [x, y]
  }

  protected drawShip(x: number, y: number, a: number, level: number, skin: string | null) {
    // A season's ship paints itself, as it always has.
    if (skin && LANDER_ART[skin]) {
      super.drawShip(x, y, a, level, skin)
      return
    }
    this.drawFlame(x, y, a, level, ['rgba(255, 140, 50, 0.92)', 'rgba(255, 236, 170, 0.95)'])
    this.drawPod(x, y, a, POD, 1)
  }

  /** A ghost flown in no skin: the pod, in the ghost's colour, faded as a ghost is. */
  protected plainGhost(g: GhostPose, mine: boolean) {
    this.drawPod(g.x, g.y, g.a, mine ? POD_AMBER : POD_BLUE, 0.62)
  }

  /** The pod on the hull, as a season skin sits on it (scene.ts drawSkinShip). */
  private drawPod(x: number, y: number, a: number, art: SkinArt, alpha: number) {
    this.drawSkinShip(x, y, a, art, alpha)
  }
}
