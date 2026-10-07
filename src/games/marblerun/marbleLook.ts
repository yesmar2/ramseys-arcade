import * as THREE from 'three'
import { mulberry32 } from './sim'

/*
 * How the player's marble looks: the painted light it shines by (a matcap), the pattern on it that turns as it
 * rolls, and the colour of its glow and the pool of light under it. Marble Run's own is white glass with a
 * magenta swirl; a skin (lib/skins.ts) swaps all three. Skins are looks only: the marble's size and its roll
 * are the same in every one. A ghost wears the skin its run was rolled in, lighter (scene.ts dressGhost); the
 * blue ball, the previews and the course pictures always show Marble Run's own.
 */

type Paint = (g: CanvasRenderingContext2D, w: number, h: number) => void

export type MarbleLook = {
  /** The painted light, 256 square: the middle faces the camera, the edge is the rim. */
  matcap: Paint
  /** The pattern round the marble, 512 by 256, laid all the way round it. */
  map: Paint
  /** The glow round the marble and the pool of light under it. */
  glow: string
}

const TAU = Math.PI * 2

/** A painted light: a ball lit from up and to the left, a rim of colour round its edge, and a glint. */
function lit(stops: [number, string][], rim: string, glint: number): Paint {
  return (g, w, h) => {
    const base = g.createRadialGradient(w * 0.4, h * 0.35, 4, w / 2, h / 2, w / 2)
    for (const [at, c] of stops) base.addColorStop(at, c)
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    const edge = g.createRadialGradient(w / 2, h / 2, w * 0.36, w / 2, h / 2, w / 2)
    edge.addColorStop(0, `rgba(${rim},0)`)
    edge.addColorStop(1, `rgba(${rim},0.65)`)
    g.fillStyle = edge
    g.fillRect(0, 0, w, h)
    g.fillStyle = `rgba(255,255,255,${glint})`
    g.beginPath()
    g.ellipse(w * 0.36, h * 0.3, w * 0.07, h * 0.045, -0.6, 0, TAU)
    g.fill()
  }
}

/** A wavy band once round the marble, twice up and down. */
function band(g: CanvasRenderingContext2D, w: number, color: string, phase: number, y: number, amp: number, thick: number) {
  g.strokeStyle = color
  g.lineWidth = thick
  g.lineCap = 'round'
  g.beginPath()
  for (let x = -10; x <= w + 10; x += 6) {
    const yy = y + Math.sin((x / w) * Math.PI * 4 + phase) * amp
    if (x === -10) g.moveTo(x, yy)
    else g.lineTo(x, yy)
  }
  g.stroke()
}

/**
 * How much wider than tall a spot at height `y` of a pattern `h` tall is drawn, to look round on the marble: the
 * pattern's rows shrink toward the marble's top and bottom, so a spot there is drawn wider to make up for it.
 */
function wide(y: number, h: number) {
  return 1 / Math.max(0.2, Math.sin((Math.PI * y) / h))
}

/** A height on a pattern `h` tall, picked so spots fall evenly over the marble, not crowded at its top and bottom. */
function evenY(rand: () => number, h: number) {
  return (h * Math.acos(1 - 2 * rand())) / Math.PI
}

/** A soft round spot of colour (round on the marble), fading out to nothing at its edge, drawn again a width either side so it runs on round the back. */
function puff(g: CanvasRenderingContext2D, w: number, h: number, x: number, y: number, r: number, rgb: string, a: number) {
  const s = g.createRadialGradient(0, 0, 0, 0, 0, r)
  s.addColorStop(0, `rgba(${rgb},${a})`)
  s.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = s
  for (const dx of [-w, 0, w]) {
    g.save()
    g.translate(x + dx, y)
    g.scale(wide(y, h), 1)
    g.fillRect(-r, -r, r * 2, r * 2)
    g.restore()
  }
}

/** A snowflake of six arms, each with a pair of twigs. */
function snowflake(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, turn: number) {
  g.beginPath()
  for (let a = 0; a < 6; a++) {
    const ang = turn + (a * Math.PI) / 3
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    g.moveTo(cx, cy)
    g.lineTo(cx + c * r, cy + s * r)
    for (const at of [0.45, 0.72]) {
      const twig = r * (at < 0.5 ? 0.3 : 0.2)
      for (const side of [-1, 1]) {
        g.moveTo(cx + c * r * at, cy + s * r * at)
        g.lineTo(cx + c * r * at + Math.cos(ang + side * 0.8) * twig, cy + s * r * at + Math.sin(ang + side * 0.8) * twig)
      }
    }
  }
  g.stroke()
}

/** Marble Run's own: white glass with a swirl of magenta, cyan and violet, lit by a painted light so it shines without lamps. */
const GLASS: MarbleLook = {
  matcap: (g, w, h) => {
    const base = g.createRadialGradient(w * 0.42, h * 0.38, 4, w / 2, h / 2, w / 2)
    base.addColorStop(0, '#ffffff')
    base.addColorStop(0.45, '#d9d0ee')
    base.addColorStop(0.85, '#5b3f8c')
    base.addColorStop(1, '#2a1650')
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    const rim = g.createRadialGradient(w / 2, h / 2, w * 0.36, w / 2, h / 2, w / 2)
    rim.addColorStop(0, 'rgba(255,92,225,0)')
    rim.addColorStop(1, 'rgba(255,92,225,0.65)')
    g.fillStyle = rim
    g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(255,255,255,0.95)'
    g.beginPath()
    g.ellipse(w * 0.36, h * 0.3, w * 0.07, h * 0.045, -0.6, 0, Math.PI * 2)
    g.fill()
  },
  map: (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    band(g, w, '#ff4fd8', 0, h * 0.42, h * 0.1, 26)
    band(g, w, '#46e4ff', 1.9, h * 0.62, h * 0.08, 14)
    band(g, w, '#8a5cff', 3.4, h * 0.26, h * 0.06, 8)
  },
  glow: '#ff8cf0',
}

/** Snowball (Cold Snap, free): packed snow, soft and grainy, white going to a cool blue-grey, with a soft glint. */
const SNOWBALL: MarbleLook = {
  matcap: lit(
    [
      [0, '#ffffff'],
      [0.5, '#e6eef8'],
      [0.82, '#a9bbd4'],
      [1, '#5f7598'],
    ],
    '200,230,255',
    0.4,
  ),
  map: (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    const rand = mulberry32(0x5e0b)
    // Soft clumps where the snow packed, a little shadowed.
    for (let i = 0; i < 70; i++) puff(g, w, h, rand() * w, evenY(rand, h), 10 + rand() * 26, '140,164,200', 0.2 + rand() * 0.14)
    // Brighter crust between them.
    for (let i = 0; i < 40; i++) puff(g, w, h, rand() * w, evenY(rand, h), 6 + rand() * 14, '255,255,255', 0.7)
    // And the grain: fine specks, mostly shade, some sparkle.
    for (let i = 0; i < 2600; i++) {
      const x = rand() * w
      const y = evenY(rand, h)
      const r = 0.4 + rand() * 1.1
      g.fillStyle = rand() < 0.8 ? `rgba(120,145,182,${0.1 + rand() * 0.18})` : 'rgba(255,255,255,0.9)'
      g.beginPath()
      g.ellipse(x, y, r * wide(y, h), r, 0, 0, TAU)
      g.fill()
    }
  },
  glow: '#cfe8ff',
}

/** Ice marble (Cold Snap, Pass+): clear pale-blue ice with a snowflake frozen inside it and a few white cracks. */
const ICE: MarbleLook = {
  matcap: lit(
    [
      [0, '#f2fdff'],
      [0.45, '#8fd6f2'],
      [1, '#0f3a5c'],
    ],
    '160,240,255',
    0.95,
  ),
  map: (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    // Faint streaks of frost in the ice.
    const rand = mulberry32(0x1ce)
    for (let i = 0; i < 26; i++) {
      const x = rand() * w
      const y = evenY(rand, h)
      puff(g, w, h, x, y, 14 + rand() * 30, '200,236,250', 0.35)
    }
    // A snowflake frozen inside, seen through the ice: twice round, so one's always in view. A wide faint stroke
    // under a narrow one blurs it, as though it's deep in.
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (const [cx, turn] of [
      [w * 0.25, 0],
      [w * 0.75, 0.5],
    ] as const) {
      g.strokeStyle = 'rgba(79,182,221,0.35)'
      g.lineWidth = 15
      snowflake(g, cx, h / 2, 74, turn)
      g.strokeStyle = '#3fa6d2'
      g.lineWidth = 6
      snowflake(g, cx, h / 2, 72, turn)
      g.strokeStyle = 'rgba(225,248,255,0.85)'
      g.lineWidth = 1.6
      snowflake(g, cx - 1.5, h / 2 - 1.5, 70, turn)
    }
    // Cracks in the ice, white, forking.
    g.strokeStyle = 'rgba(255,255,255,0.95)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(12, 34)
    g.lineTo(58, 58)
    g.lineTo(92, 82)
    g.lineTo(140, 62)
    g.moveTo(58, 58)
    g.lineTo(66, 22)
    g.moveTo(300, 206)
    g.lineTo(344, 188)
    g.lineTo(382, 172)
    g.lineTo(440, 230)
    g.moveTo(382, 172)
    g.lineTo(404, 140)
    g.moveTo(196, 230)
    g.lineTo(236, 214)
    g.lineTo(262, 236)
    g.stroke()
  },
  glow: '#9fe8ff',
}

/** Polar night (Cold Snap, Pass+): dark navy glass with bands of aurora through it and a scatter of stars. */
const POLAR: MarbleLook = {
  matcap: lit(
    [
      [0, '#effffa'],
      [0.35, '#a9c6ee'],
      [0.75, '#4a6cb0'],
      [1, '#0a1428'],
    ],
    '92,242,176',
    0.85,
  ),
  map: (g, w, h) => {
    g.fillStyle = '#1f3566'
    g.fillRect(0, 0, w, h)
    // The aurora: each band drawn wide and faint, then narrow and bright, so it glows.
    const bands: [string, number, number, number, number][] = [
      ['#5cf2b0', 0, 0.45, 0.12, 36],
      ['#46e4ff', 1.7, 0.62, 0.1, 14],
      ['#9b7bff', 3.1, 0.3, 0.08, 18],
    ]
    for (const [color, phase, y, amp, thick] of bands) {
      g.globalAlpha = 0.3
      band(g, w, color, phase, h * y, h * amp, thick * 1.9)
      g.globalAlpha = 0.9
      band(g, w, color, phase, h * y, h * amp, thick)
    }
    g.globalAlpha = 1
    // Stars: most small, a few brighter with a soft halo.
    const rand = mulberry32(0x5a7)
    for (let i = 0; i < 70; i++) {
      const x = rand() * w
      const y = evenY(rand, h)
      const big = rand() < 0.15
      if (big) puff(g, w, h, x, y, 6, '220,240,255', 0.6)
      g.fillStyle = '#ffffff'
      g.beginPath()
      const r = big ? 1.8 : 0.8 + rand() * 0.8
      g.ellipse(x, y, r * wide(y, h), r, 0, 0, TAU)
      g.fill()
    }
  },
  glow: '#5cf2b0',
}

const LOOKS: Record<string, MarbleLook> = {
  'marblerun-snowball': SNOWBALL,
  'marblerun-ice-marble': ICE,
  'marblerun-polar-night': POLAR,
}

/** The marble's look in a skin; Marble Run's own for none, or a skin it doesn't know. */
export function marbleLook(skin: string | null | undefined): MarbleLook {
  return (skin && LOOKS[skin]) || GLASS
}

function paint(w: number, h: number, draw: Paint, anisotropy: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  return tex
}

/** The marble's two textures in a look, painted fresh: whoever takes them disposes of them. */
export function marbleMaps(look: MarbleLook, anisotropy = 1) {
  return { matcap: paint(256, 256, look.matcap, anisotropy), map: paint(512, 256, look.map, anisotropy) }
}
