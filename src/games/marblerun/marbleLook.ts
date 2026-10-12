import * as THREE from 'three'
import { mulberry32 } from './sim'

/*
 * How the player's marble looks: the painted light it shines by (a matcap), the pattern on it that turns as it
 * rolls, and the colour of its glow and the pool of light under it. Marble Run's own is white glass with a
 * magenta swirl; a skin (lib/skins.ts) swaps all three, and may add light over the marble, a face it turns to
 * you, and a spark floating over it (Blip's). Skins are looks only: the marble's size and its roll
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
  /**
   * Light added over the marble, painted as the matcap is (256 square, the middle facing the camera), black adding
   * nothing: a glint that shows over a coloured pattern, which the painted light, multiplying the pattern, can't.
   */
  shine?: Paint
  /**
   * The pattern has a face in its middle, the right way up (on the marble, the half round its own +x, the top of
   * the face toward its +y). The marble turns it to the camera as a run starts (scene.ts), so it looks back at you
   * before it rolls, and as it rolls straight on it comes round the right way up.
   */
  face?: boolean
  /** A spark floating over the marble, which doesn't roll with it: its core and its glow. */
  spark?: { core: string; glow: string }
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

/** Blip, the site's mascot, in his own colours (components/BlipFigure.tsx). */
const BLIP_COLOURS = { body: '#34c6a8', glow: '#9ff7e2', spark: '#f2fffb', ink: '#0f2f2a', cheek: '#ff8fb3' } as const

/**
 * A drawing of the marble seen straight on from one side, made `n` pixels square with the marble's edge the circle
 * round it (x across, y down, each -1 to 1), its colours kept multiplied by how solid they are, to look spots up in.
 */
function view(n: number, draw: (g: CanvasRenderingContext2D) => void): Float32Array {
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.setTransform(n / 2, 0, 0, n / 2, n / 2, n / 2)
  draw(g)
  const px = g.getImageData(0, 0, n, n).data
  const out = new Float32Array(px.length)
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3]! / 255
    out[i] = (px[i]! / 255) * a
    out[i + 1] = (px[i + 1]! / 255) * a
    out[i + 2] = (px[i + 2]! / 255) * a
    out[i + 3] = a
  }
  return out
}

/** The colour at (x, y) on a view `n` square, blended from the four pixels round it, over what's in `under`. */
function over(px: Float32Array, n: number, x: number, y: number, under: Float32Array) {
  const fx = Math.min(n - 1.001, Math.max(0, ((x + 1) * n) / 2 - 0.5))
  const fy = Math.min(n - 1.001, Math.max(0, ((y + 1) * n) / 2 - 0.5))
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy
  const a = (iy * n + ix) * 4
  const c = a + n * 4
  const wa = (1 - tx) * (1 - ty)
  const wb = tx * (1 - ty)
  const wc = (1 - tx) * ty
  const wd = tx * ty
  const alpha = px[a + 3]! * wa + px[a + 7]! * wb + px[c + 3]! * wc + px[c + 7]! * wd
  if (alpha <= 0) return
  for (let k = 0; k < 3; k++) {
    under[k] = px[a + k]! * wa + px[a + 4 + k]! * wb + px[c + k]! * wc + px[c + 4 + k]! * wd + under[k]! * (1 - alpha)
  }
}

/**
 * Blip curled up into the marble: his mint all over, and on one half his face as his figure has it (BlipFigure.tsx),
 * so the marble seen from straight in front is his figure, its edge his body's. The face is drawn flat, as the
 * marble looks from in front, then laid on by finding every texel's spot on the ball in it, so nothing stretches
 * toward the top or bottom. (His belly's deeper mint and his feet were tried, tucked in under him: as the marble
 * rolled, the belly's edge came round as a second, wider mouth, and the feet as a second pair of eyes over it.
 * The painted light rounds him, as the belly does on the page.)
 */
function blipMap(g: CanvasRenderingContext2D, w: number, h: number) {
  const B = BLIP_COLOURS
  const n = 512
  const face = view(n, (c) => {
    // His figure's own units: his body a circle 7.35 round (0, 1.26), its edge the marble's.
    c.scale(1 / 7.35, 1 / 7.35)
    c.translate(0, -1.26)
    c.fillStyle = B.ink
    for (const x of [-1.89, 1.89]) {
      c.beginPath()
      c.ellipse(x, 1.05, 0.95, 1.58, 0, 0, TAU)
      c.fill()
    }
    c.fillStyle = '#ffffff'
    for (const x of [-1.58, 2.2]) {
      c.beginPath()
      c.arc(x, 0.32, 0.36, 0, TAU)
      c.fill()
    }
    c.strokeStyle = B.ink
    c.lineWidth = 0.47
    c.lineCap = 'round'
    c.stroke(new Path2D('M-1.26 3.57 Q0 4.73 1.26 3.57'))
    c.globalAlpha = 0.7
    c.fillStyle = B.cheek
    for (const x of [-3.57, 3.57]) {
      c.beginPath()
      c.ellipse(x, 3.15, 0.95, 0.53, 0, 0, TAU)
      c.fill()
    }
  })
  // Each texel: the way out from the marble's middle there (three.js SphereGeometry's, so the map's middle faces
  // +x and its top +y), seen from in front. Most of the marble is his plain mint; only a texel near his face is
  // looked up, from four spots in it.
  const S = 2
  const cosRound = new Float32Array(w * S)
  const sinRound = new Float32Array(w * S)
  const cosDown = new Float32Array(h * S)
  const sinDown = new Float32Array(h * S)
  for (let i = 0; i < w * S; i++) {
    const phi = ((i + 0.5) / (w * S)) * TAU
    cosRound[i] = Math.cos(phi)
    sinRound[i] = Math.sin(phi)
  }
  for (let j = 0; j < h * S; j++) {
    const theta = ((j + 0.5) / (h * S)) * Math.PI
    cosDown[j] = Math.cos(theta)
    sinDown[j] = Math.sin(theta)
  }
  const hex = parseInt(B.body.slice(1), 16)
  const body = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255] as const
  const img = g.createImageData(w, h)
  const out = img.data
  const spot = new Float32Array(3)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const k = (py * w + px) * 4
      out[k + 3] = 255
      // Where the texel is, near enough: his face lies within 0.62 across the marble's front, from 0.25 up to 0.51 down.
      const dx = -cosRound[px * S]! * sinDown[py * S]!
      const dy = cosDown[py * S]!
      const dz = sinRound[px * S]! * sinDown[py * S]!
      if (!(dx > 0 && dz > -0.66 && dz < 0.66 && dy > -0.55 && dy < 0.29)) {
        out[k] = body[0] * 255
        out[k + 1] = body[1] * 255
        out[k + 2] = body[2] * 255
        continue
      }
      let r = 0
      let gr = 0
      let b = 0
      for (let sy = 0; sy < S; sy++) {
        const j = py * S + sy
        for (let sx = 0; sx < S; sx++) {
          const i = px * S + sx
          spot[0] = body[0]
          spot[1] = body[1]
          spot[2] = body[2]
          if (-cosRound[i]! * sinDown[j]! > 0) over(face, n, -sinRound[i]! * sinDown[j]!, -cosDown[j]!, spot)
          r += spot[0]!
          gr += spot[1]!
          b += spot[2]!
        }
      }
      out[k] = (r / (S * S)) * 255
      out[k + 1] = (gr / (S * S)) * 255
      out[k + 2] = (b / (S * S)) * 255
    }
  }
  g.putImageData(img, 0, 0)
}

/**
 * Blip's highlight as his figure has it, white at 35% over his mint up and to his left, as light added to the
 * marble: the matcap's circle is the marble's edge (0.495 of it across from its middle), as his body's is his.
 */
function blipShine(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#000000'
  g.fillRect(0, 0, w, h)
  g.translate(w / 2, h / 2)
  g.scale((0.495 * w) / 7.35, (0.495 * h) / 7.35)
  g.translate(0, -1.26)
  // About what white at 35% adds to his mint (#34c6a8 to #7bdac6), a little greyer, so an eye rolling under it
  // lightens rather than going brown.
  g.fillStyle = 'rgb(66,30,38)'
  g.beginPath()
  g.ellipse(-2.52, -2.94, 2.52, 1.26, (-24 * Math.PI) / 180, 0, TAU)
  g.fill()
}

/**
 * Blip (the site's mascot, as a skin): Blip curled up into the marble, his face tumbling round as it rolls, his
 * highlight, a soft mint glow, and his spark floating over it. A light that's near white, so his colours show as
 * they are.
 */
const BLIP: MarbleLook = {
  matcap: lit(
    [
      [0, '#ffffff'],
      [0.6, '#fbfefd'],
      [0.88, '#cde1dc'],
      [1, '#86a9a1'],
    ],
    '159,247,226',
    0.85,
  ),
  map: blipMap,
  glow: BLIP_COLOURS.glow,
  shine: blipShine,
  face: true,
  spark: { core: BLIP_COLOURS.spark, glow: BLIP_COLOURS.glow },
}

const LOOKS: Record<string, MarbleLook> = {
  'marblerun-snowball': SNOWBALL,
  'marblerun-ice-marble': ICE,
  'marblerun-polar-night': POLAR,
  'marblerun-blip': BLIP,
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

/** A look's added light, painted fresh (null for a look without one): whoever takes it disposes of it. */
export function shineMap(look: MarbleLook, anisotropy = 1) {
  return look.shine ? paint(256, 256, look.shine, anisotropy) : null
}

/** A colour such as #34c6a8 at alpha `a`, as CSS. */
function rgba(hex: string, a: number) {
  const v = parseInt(hex.slice(1), 16)
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`
}

/**
 * A look's spark, painted fresh, 64 square, as Blip's is drawn: a glow fading out to the edge, and the core in the
 * middle, 0.85 of the glow's 2.7 across. Whoever takes it disposes of it.
 */
export function sparkMap(spark: NonNullable<MarbleLook['spark']>) {
  return paint(
    64,
    64,
    (g, w, h) => {
      const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      glow.addColorStop(0, rgba(spark.glow, 0.9))
      glow.addColorStop(1, rgba(spark.glow, 0))
      g.fillStyle = glow
      g.fillRect(0, 0, w, h)
      g.fillStyle = spark.core
      g.beginPath()
      g.arc(w / 2, h / 2, (w / 2) * (0.85 / 2.7), 0, TAU)
      g.fill()
    },
    1,
  )
}
