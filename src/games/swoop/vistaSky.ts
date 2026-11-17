import { mixColor } from '../../lib/color'
import { watchKept } from '../keptPictures'

/*
 * What's behind the hills in Swoop's look on test (vista.ts): a sky for the day, clouds, and three ranges of
 * far country, each painted once as a picture and slid past every frame after. A picture is the cheapest thing
 * this game can draw (a frame copies it in one go, where a shape the width of the screen is filled slowly:
 * see scene.ts drawGround's notes), so the far country can have mountains with snow on them, lines of trees
 * and mist in the valleys, and cost a frame about what the two plain rows of hills it stands in for did.
 *
 * A copy is charged by its size, though, and by how many canvases a frame copies from, so nothing here is
 * bigger than what shows: the far clouds are painted into the sky itself, the near ones are stamps off one
 * sheet, and each range's picture ends where the next one covers it. Timed on Ramsey's laptop (Iris Xe, 2x,
 * 2026-11-17), the same frames through both scenes in turns: by day the same as scene.ts to within a tenth of
 * a millisecond, by night about three quarters of one more (its own night sky has no clouds to draw).
 *
 * The sky follows the site's theme, as it always has: by day in light, by night in dark. Within each a day's
 * hills get one of three skies, by their number, so a day looks like itself: a golden late afternoon, a clear
 * noon or a misty morning; dusk, a full moon or the northern lights. The hills' own colour is still the day
 * of the week's (sim.ts HILL_HUES), and the far country is washed in it, fainter the further off.
 */

const TAU = Math.PI * 2

export type MoodKey = 'gold' | 'noon' | 'mist' | 'dusk' | 'moon' | 'aurora'

export type Mood = {
  key: MoodKey
  dark: boolean
  /** The sky from the top of the screen to the bottom: how far down, and the colour there. */
  sky: readonly (readonly [number, string])[]
  /** What far things fade into at their feet: the mist. */
  haze: string
  /** The three far ranges' own colours, back to front, before the day's colour is washed in. */
  ranges: readonly [string, string, string]
  /**
   * The sun or the moon: where (shares of the screen), how big (a share of its shorter side), and which: a sun
   * with rays, a pale sun behind mist, a full moon, or a crescent.
   */
  orb: { x: number; y: number; r: number; kind: 'sun' | 'soft' | 'full' | 'crescent'; core: string; rim: string; halo: string }
  /** How many stars. */
  stars: number
  aurora: boolean
  /** The clouds: their body, their lit edge and their shaded one, and how see-through each row of them is. */
  cloud: { body: string; lit: string; shade: string; far: number; near: number; fog: boolean }
  /** The light on a slope that faces the sun, and the shade on one turned from it. */
  light: string
  shade: string
  /** What drifts in the air close to the eye: pollen by day, fireflies by night. */
  mote: { colour: string; glow: boolean }
  /** The streaks of rushing air across the screen when the bird is really moving. */
  wind: string
}

const MOODS: Record<MoodKey, Mood> = {
  gold: {
    key: 'gold',
    dark: false,
    sky: [
      [0, '#6c9fe2'],
      [0.36, '#c4b7e2'],
      [0.6, '#ffc9a6'],
      [0.8, '#ffdf9f'],
      [1, '#fff1c8'],
    ],
    haze: '#ffe6b6',
    ranges: ['#d8b6d2', '#e2b2ae', '#dcaa90'],
    orb: { x: 0.7, y: 0.45, r: 0.085, kind: 'sun', core: '#fffdf2', rim: '#ffe9a2', halo: 'rgba(255, 196, 112, 0.72)' },
    stars: 0,
    aurora: false,
    cloud: { body: '#fff3e4', lit: '#ffffff', shade: '#f2b79e', far: 0.8, near: 0.95, fog: false },
    light: 'rgba(255, 240, 180, 0.46)',
    shade: 'rgba(86, 40, 84, 0.2)',
    mote: { colour: '#fff3c4', glow: false },
    wind: 'rgba(255, 255, 255, 0.85)',
  },
  noon: {
    key: 'noon',
    dark: false,
    sky: [
      [0, '#4aa5ee'],
      [0.5, '#93d0f8'],
      [0.8, '#d8f0ff'],
      [1, '#f3faff'],
    ],
    haze: '#e4f3fc',
    ranges: ['#bcd9f2', '#a9cfe9', '#95c6dc'],
    orb: { x: 0.8, y: 0.17, r: 0.058, kind: 'sun', core: '#fffbe0', rim: '#ffd766', halo: 'rgba(255, 228, 140, 0.6)' },
    stars: 0,
    aurora: false,
    cloud: { body: '#ffffff', lit: '#ffffff', shade: '#cbe2f4', far: 0.82, near: 0.96, fog: false },
    light: 'rgba(255, 255, 255, 0.36)',
    shade: 'rgba(20, 50, 96, 0.17)',
    mote: { colour: '#ffffff', glow: false },
    wind: 'rgba(255, 255, 255, 0.85)',
  },
  mist: {
    key: 'mist',
    dark: false,
    sky: [
      [0, '#8bbdd3'],
      [0.5, '#c2dee2'],
      [0.84, '#eef0e0'],
      [1, '#f8f4e6'],
    ],
    haze: '#eff2e8',
    ranges: ['#c6dbdc', '#b2cfd0', '#9dc3c1'],
    orb: { x: 0.68, y: 0.22, r: 0.07, kind: 'soft', core: '#ffffff', rim: '#fffdf0', halo: 'rgba(255, 255, 255, 0.75)' },
    stars: 0,
    aurora: false,
    cloud: { body: '#f7fbfa', lit: '#ffffff', shade: '#d3e3e2', far: 0.7, near: 0.8, fog: true },
    light: 'rgba(255, 255, 255, 0.3)',
    shade: 'rgba(30, 70, 84, 0.15)',
    mote: { colour: '#ffffff', glow: false },
    wind: 'rgba(255, 255, 255, 0.9)',
  },
  dusk: {
    key: 'dusk',
    dark: true,
    sky: [
      [0, '#0a0e29'],
      [0.42, '#2a2158'],
      [0.68, '#6a3a7c'],
      [0.86, '#c2607c'],
      [1, '#f0976a'],
    ],
    haze: '#99507f',
    ranges: ['#5b3e88', '#472f76', '#352462'],
    orb: { x: 0.8, y: 0.16, r: 0.044, kind: 'crescent', core: '#fff6dc', rim: '#fff6dc', halo: 'rgba(255, 238, 206, 0.22)' },
    stars: 90,
    aurora: false,
    cloud: { body: '#3b2b69', lit: '#f3a57c', shade: '#241b4d', far: 0.7, near: 0.9, fog: false },
    light: 'rgba(255, 190, 150, 0.24)',
    shade: 'rgba(8, 6, 30, 0.3)',
    mote: { colour: '#ffe27a', glow: true },
    wind: 'rgba(255, 255, 255, 0.36)',
  },
  moon: {
    key: 'moon',
    dark: true,
    sky: [
      [0, '#050a22'],
      [0.55, '#0f2c58'],
      [0.85, '#235282'],
      [1, '#2f6690'],
    ],
    haze: '#2e6490',
    ranges: ['#1f4878', '#183a68', '#122c56'],
    orb: { x: 0.77, y: 0.2, r: 0.075, kind: 'full', core: '#f6f0d8', rim: '#e6dcbc', halo: 'rgba(196, 218, 255, 0.3)' },
    stars: 150,
    aurora: false,
    cloud: { body: '#17325e', lit: '#b9cef2', shade: '#0c1c3f', far: 0.75, near: 0.92, fog: false },
    light: 'rgba(190, 215, 255, 0.25)',
    shade: 'rgba(2, 6, 24, 0.32)',
    mote: { colour: '#fff0a0', glow: true },
    wind: 'rgba(255, 255, 255, 0.34)',
  },
  aurora: {
    key: 'aurora',
    dark: true,
    sky: [
      [0, '#030d1c'],
      [0.6, '#0a2836'],
      [1, '#12474e'],
    ],
    haze: '#1c6062',
    ranges: ['#124450', '#0e3842', '#0a2c36'],
    orb: { x: 0.85, y: 0.13, r: 0.038, kind: 'crescent', core: '#effff6', rim: '#effff6', halo: 'rgba(170, 255, 220, 0.2)' },
    stars: 170,
    aurora: true,
    cloud: { body: '#0e2c3c', lit: '#4fb89a', shade: '#071a26', far: 0.5, near: 0.72, fog: false },
    light: 'rgba(130, 255, 205, 0.2)',
    shade: 'rgba(0, 8, 16, 0.34)',
    mote: { colour: '#9dffd0', glow: true },
    wind: 'rgba(200, 255, 235, 0.34)',
  },
}

/** By day and by night, the skies in the order the days take them. */
const BY_DAY: readonly MoodKey[] = ['gold', 'noon', 'mist']
const BY_NIGHT: readonly MoodKey[] = ['dusk', 'moon', 'aurora']

/** The sky of hills `n` on the theme: each day its own, round the three in turn. */
export function moodFor(n: number, dark: boolean): Mood {
  const set = dark ? BY_NIGHT : BY_DAY
  return MOODS[set[(((n - 1) % set.length) + set.length) % set.length]!]
}

/** A picture kept to copy in: its canvas, and the size on the screen it stands for, in CSS pixels. */
export type Picture = { canvas: HTMLCanvasElement; w: number; h: number }

/**
 * A picture `w` by `h` on the screen, painted `res` canvas pixels to each of them by `paint`, which draws in
 * the screen's own pixels. Kept on the graphics chip, like the screen it's copied into, and watched: when the
 * chip drops its pictures (games/keptPictures.ts), the scene paints them again.
 */
export function picture(w: number, h: number, res: number, paint: (g: CanvasRenderingContext2D) => void): Picture {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(w * res))
  canvas.height = Math.max(1, Math.ceil(h * res))
  watchKept(canvas)
  const g = canvas.getContext('2d')
  if (g) {
    g.scale(canvas.width / w, canvas.height / h)
    paint(g)
  }
  return { canvas, w, h }
}

/* -------------------------------------------------------------------- the sky --- */

function crescent(r: number, colour: string, res: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  const size = Math.ceil(r * 2 * res) + 4
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return c
  const mid = size / 2
  g.fillStyle = colour
  g.beginPath()
  g.arc(mid, mid, r * res, 0, TAU)
  g.fill()
  // The bite out of it, from the upper left: what's left is lit from the lower right, where the sun went down.
  g.globalCompositeOperation = 'destination-out'
  g.beginPath()
  g.arc(mid - r * res * 0.42, mid - r * res * 0.26, r * res * 0.92, 0, TAU)
  g.fill()
  return c
}

/** The whole sky, the size of the screen: its colours, its stars, the northern lights, and the sun or the moon. */
export function skyPicture(W: number, H: number, res: number, mood: Mood, rnd: () => number): Picture {
  return picture(W, H, res, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, H)
    for (const [at, colour] of mood.sky) grad.addColorStop(at, colour)
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    const short = Math.min(W, H)

    if (mood.stars) {
      g.fillStyle = '#ffffff'
      for (let i = 0; i < mood.stars; i++) {
        // Thicker toward the top of the sky, none down in the glow at its foot.
        const y = rnd() ** 1.6 * H * 0.66
        const x = rnd() * W
        const big = rnd() < 0.08
        const r = big ? 1.5 + rnd() * 0.8 : 0.5 + rnd() * 0.9
        g.globalAlpha = (0.3 + rnd() * 0.6) * (1 - y / (H * 0.75))
        g.beginPath()
        g.arc(x, y, r, 0, TAU)
        g.fill()
        if (big) {
          // The brightest few glint: a thin cross through them.
          g.globalAlpha *= 0.55
          g.fillRect(x - r * 3.2, y - 0.4, r * 6.4, 0.8)
          g.fillRect(x - 0.4, y - r * 3.2, 0.8, r * 6.4)
        }
      }
      g.globalAlpha = 1
    }

    if (mood.aurora) {
      // Three curtains of light, each a row of thin strips: green at its hem, violet higher, gone at the top.
      for (let c = 0; c < 3; c++) {
        const p1 = rnd() * TAU
        const p2 = rnd() * TAU
        const hem = H * (0.3 + c * 0.085)
        const tall = H * (0.26 - c * 0.03)
        const step = 4
        for (let x = -step; x < W + step; x += step) {
          const u = x / W
          const y1 = hem + Math.sin(u * (2.2 + c * 0.9) * Math.PI + p1) * H * 0.045 + Math.sin(u * 7.3 + p2) * H * 0.012
          const h = tall * (0.75 + 0.25 * Math.sin(u * 5.1 + p2 * 1.7))
          const strength = (0.5 + 0.5 * Math.sin(x * 0.043 + Math.sin(x * 0.0117 + p1) * 3.1)) * (0.55 + 0.45 * Math.sin(u * Math.PI))
          const fade = g.createLinearGradient(0, y1 - h, 0, y1)
          fade.addColorStop(0, 'rgba(155, 123, 255, 0)')
          fade.addColorStop(0.45, `rgba(140, 150, 255, ${0.1 * strength})`)
          fade.addColorStop(0.86, `rgba(92, 242, 176, ${0.3 * strength})`)
          fade.addColorStop(1, 'rgba(92, 242, 176, 0)')
          g.fillStyle = fade
          g.fillRect(x, y1 - h, step + 0.5, h)
        }
      }
    }

    const { orb } = mood
    const cx = W * orb.x
    const cy = H * orb.y
    const r = short * orb.r
    // Its glow, widest round a low sun.
    const reach = r * (orb.kind === 'sun' && orb.y > 0.3 ? 6.5 : orb.kind === 'soft' ? 5 : 4)
    const halo = g.createRadialGradient(cx, cy, r * 0.4, cx, cy, reach)
    halo.addColorStop(0, orb.halo)
    halo.addColorStop(1, orb.halo.replace(/[\d.]+\)$/, '0)'))
    g.fillStyle = halo
    g.fillRect(cx - reach, cy - reach, reach * 2, reach * 2)
    if (orb.kind === 'sun' && orb.y < 0.3) {
      // A high sun's rays: thin wedges, hardly there.
      g.fillStyle = 'rgba(255, 255, 255, 0.05)'
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + 0.21
        const len = r * (i % 2 ? 5.4 : 3.8)
        const w = 0.034
        g.beginPath()
        g.moveTo(cx, cy)
        g.lineTo(cx + Math.cos(a - w) * len, cy + Math.sin(a - w) * len)
        g.lineTo(cx + Math.cos(a + w) * len, cy + Math.sin(a + w) * len)
        g.closePath()
        g.fill()
      }
    }
    if (orb.kind === 'crescent') {
      const moon = crescent(r, orb.core, res)
      const size = moon.width / res
      g.drawImage(moon, cx - size / 2, cy - size / 2, size, size)
    } else {
      g.fillStyle = orb.rim
      g.beginPath()
      g.arc(cx, cy, r, 0, TAU)
      g.fill()
      const face = g.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r)
      face.addColorStop(0, orb.core)
      face.addColorStop(1, orb.rim)
      g.fillStyle = face
      g.beginPath()
      g.arc(cx, cy, r * 0.94, 0, TAU)
      g.fill()
      if (orb.kind === 'full') {
        // The moon's seas.
        g.fillStyle = 'rgba(120, 130, 150, 0.16)'
        for (const [ox, oy, s] of [
          [-0.3, -0.25, 0.26],
          [0.22, -0.38, 0.16],
          [0.3, 0.2, 0.3],
          [-0.2, 0.36, 0.17],
          [-0.52, 0.12, 0.11],
        ] as const) {
          g.beginPath()
          g.arc(cx + ox * r, cy + oy * r, s * r, 0, TAU)
          g.fill()
        }
      }
    }
  })
}

/* ------------------------------------------------------------------ the clouds --- */

/** A cloud as puffs, [x, y, r], on a flat bottom at y = 0.42, in units of its size. */
const PUFFS = [
  [
    [-1.7, 0.08, 0.62],
    [-0.9, -0.3, 0.86],
    [0.05, -0.56, 1.08],
    [1.0, -0.24, 0.84],
    [1.75, 0.1, 0.58],
  ],
  [
    [-1.3, 0.06, 0.6],
    [-0.5, -0.36, 0.9],
    [0.55, -0.2, 0.78],
    [1.3, 0.12, 0.52],
  ],
  [
    [-2.1, 0.14, 0.52],
    [-1.3, -0.16, 0.76],
    [-0.35, -0.5, 1.0],
    [0.7, -0.62, 1.12],
    [1.65, -0.2, 0.8],
    [2.3, 0.14, 0.5],
  ],
] as const

function puffCloud(g: CanvasRenderingContext2D, x: number, y: number, s: number, kind: number, mood: Mood) {
  const puffs = PUFFS[kind % PUFFS.length]!
  const first = puffs[0]!
  const last = puffs[puffs.length - 1]!
  g.save()
  // Nothing under its flat bottom.
  g.beginPath()
  g.rect(x - s * 3.4, y - s * 2.4, s * 6.8, s * 2.4 + s * 0.42)
  g.clip()
  // The whole cloud as one shape, set over by (dx, dy): its puffs, and the slab they stand on between the end ones.
  const shape = (colour: string, dx: number, dy: number) => {
    g.fillStyle = colour
    g.beginPath()
    for (const [px, py, pr] of puffs) {
      g.moveTo(x + px * s + dx + pr * s, y + py * s + dy)
      g.arc(x + px * s + dx, y + py * s + dy, pr * s, 0, TAU)
    }
    g.rect(x + first[0] * s + dx, y - s * 0.1 + dy, (last[0] - first[0]) * s, s * 0.7)
    g.fill()
  }
  if (mood.dark) {
    // By night: a dark cloud with the moon's light along its upper edge, on the moon's side.
    shape(mood.cloud.lit, 0, 0)
    shape(mood.cloud.body, -s * 0.06, s * 0.09)
  } else {
    // By day: a bright cloud, shaded along its flat bottom.
    shape(mood.cloud.shade, 0, 0)
    shape(mood.cloud.body, 0, -s * 0.14)
  }
  g.restore()
}

/**
 * The far row of clouds, `wide` across: little ones, painted into the sky's own picture (vista.ts), since
 * they're too far off to be seen to move. Fewer by night, so the stars show; fewest under the northern lights.
 * On a misty morning, long banks of fog.
 */
export function farClouds(wide: number, tall: number, res: number, mood: Mood, rnd: () => number, V: number): Picture {
  return picture(wide, tall, res, (g) => {
    g.globalAlpha = mood.cloud.far
    const count = Math.max(2, Math.round((wide / 420) * 1.7 * (mood.key === 'aurora' ? 0.4 : mood.dark ? 0.65 : 1)))
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.15 + rnd() * 0.7) / count) * wide
      const s = (0.014 + rnd() * 0.014) * V
      const y = tall * (0.3 + rnd() * 0.6)
      const kind = Math.floor(rnd() * PUFFS.length)
      if (!mood.cloud.fog) {
        puffCloud(g, x, y, s, kind, mood)
        continue
      }
      // A bank of fog: long, low and soft-edged.
      const w = s * FOG.w * 0.8
      const h = s * FOG.h
      const fade = g.createLinearGradient(0, y - h, 0, y + h)
      fade.addColorStop(0, 'rgba(255, 255, 255, 0)')
      fade.addColorStop(0.5, mood.cloud.body)
      fade.addColorStop(1, 'rgba(255, 255, 255, 0)')
      g.fillStyle = fade
      g.beginPath()
      g.ellipse(x, y, w, h, 0, 0, TAU)
      g.fill()
    }
  })
}

/** A bank of fog's half width and half height, in units of its size. */
const FOG = { w: 9, h: 0.9 }

/** A cloud of the near row: where along the row and how far down the screen its flat bottom is, how big, and which shape. */
export type Cloud = { x: number; y: number; s: number; kind: number }

/** The near row's clouds on their sheet: each shape's place on it, in the sheet's own pixels, and where its bottom middle is. */
export type CloudSheet = {
  canvas: HTMLCanvasElement
  /** Canvas pixels to a screen pixel, and the size (`s`) the shapes are painted at, in screen pixels. */
  res: number
  unit: number
  cells: { x: number; y: number; w: number; h: number; ax: number; ay: number }[]
}

/**
 * The near row's clouds, each shape once on one sheet at the biggest size the row has, to be stamped where each
 * cloud is and drawn down to its size. A row painted whole, as the far one is into the sky, would be half a
 * screen of mostly clear canvas to copy every frame, and a copy is charged by its size: a handful of stamps the
 * size of a cloud each cost a tenth of that.
 */
export function cloudSheet(mood: Mood, unit: number, res: number): CloudSheet {
  const canvas = document.createElement('canvas')
  watchKept(canvas)
  const pad = 2
  const boxes = mood.cloud.fog ? [{ w: FOG.w * 2, h: FOG.h * 2, ax: FOG.w, ay: FOG.h }] : PUFFS.map(() => ({ w: 6.8, h: 2.84, ax: 3.4, ay: 2.4 }))
  const cells: CloudSheet['cells'] = []
  let x = 0
  let tall = 0
  for (const box of boxes) {
    const w = Math.ceil(box.w * unit * res)
    const h = Math.ceil(box.h * unit * res)
    cells.push({ x: x + pad, y: pad, w, h, ax: box.ax * unit, ay: box.ay * unit })
    x += w + pad * 2
    tall = Math.max(tall, h)
  }
  canvas.width = x
  canvas.height = tall + pad * 2
  const g = canvas.getContext('2d')
  if (g) {
    cells.forEach((cell, kind) => {
      g.save()
      g.translate(cell.x, cell.y)
      g.scale(res, res)
      if (mood.cloud.fog) {
        const w = FOG.w * unit
        const h = FOG.h * unit
        const fade = g.createLinearGradient(0, 0, 0, h * 2)
        fade.addColorStop(0, 'rgba(255, 255, 255, 0)')
        fade.addColorStop(0.5, mood.cloud.body)
        fade.addColorStop(1, 'rgba(255, 255, 255, 0)')
        g.fillStyle = fade
        g.beginPath()
        g.ellipse(w, h, w, h, 0, 0, TAU)
        g.fill()
      } else puffCloud(g, cell.ax, cell.ay, unit, kind, mood)
      g.restore()
    })
  }
  return { canvas, res, unit, cells }
}

/** The near row's clouds along `P` of sky: fewer by night, so the stars show; fewest under the northern lights. */
export function layClouds(P: number, tall: number, mood: Mood, rnd: () => number): Cloud[] {
  const count = Math.max(2, Math.round((P / 420) * (mood.key === 'aurora' ? 0.4 : mood.dark ? 0.65 : 1)))
  const clouds: Cloud[] = []
  for (let i = 0; i < count; i++) {
    clouds.push({ x: ((i + 0.15 + rnd() * 0.7) / count) * P, y: tall * (0.17 + rnd() * 0.25), s: 0.53 + rnd() * 0.47, kind: Math.floor(rnd() * PUFFS.length) })
  }
  return clouds
}

/** The biggest a cloud of the near row is, as a share of the screen's shorter side (vista.ts gives `V`). */
export const CLOUD_SIZE = 0.064

/* ------------------------------------------------------------- the far country --- */

/** A far range's colours: at its ridge, down in the mist at its foot, where the light falls and where it doesn't. */
export type RangeLook = { top: string; foot: string; lit: string; shade: string; detail: string }

/** How much of the day's colour each far range takes, back to front. */
const WASH = [0.12, 0.25, 0.42] as const

/** The three far ranges' colours on a day of colour `hue`. */
export function rangeLooks(mood: Mood, hue: string): [RangeLook, RangeLook, RangeLook] {
  const wash = mood.dark ? mixColor(hue, '#0e1230', 0.52) : hue
  const look = (i: 0 | 1 | 2): RangeLook => {
    const top = mixColor(mood.ranges[i], wash, WASH[i])
    return {
      top,
      foot: mixColor(top, mood.haze, mood.dark ? 0.5 - i * 0.1 : 0.72 - i * 0.12),
      lit: mixColor(top, mood.dark ? mood.cloud.lit : '#ffffff', mood.dark ? 0.22 : 0.42),
      shade: mixColor(top, mood.dark ? '#02040f' : mood.ranges[2], mood.dark ? 0.32 : 0.5),
      detail: mixColor(top, mood.dark ? '#02040f' : '#1a2b3c', mood.dark ? 0.3 : 0.16),
    }
  }
  return [look(0), look(1), look(2)]
}

/** A wave `n` times across the row: it meets itself at the ends. */
const wave = (x: number, P: number, n: number, phase: number) => Math.sin((x / P) * n * TAU + phase)
/** The same, as peaks: sharp tops and round valleys. */
const peaks = (x: number, P: number, n: number, phase: number) => 1 - Math.abs(Math.sin((x / P) * n * Math.PI + phase))

type Ridge = (x: number) => number

/**
 * How much wider than its row a range's picture is painted, in screen pixels: the start of the row again, past
 * its end. Copies laid a row apart then overlap by this much, and where two meet there's no hairline of sky
 * between them (two soft edges side by side each cover half a pixel, and a quarter of what's behind shows).
 */
export const LAP = 2

function fillRidge(g: CanvasRenderingContext2D, P: number, tall: number, ridge: Ridge, top: number, look: RangeLook) {
  const grad = g.createLinearGradient(0, top, 0, tall)
  grad.addColorStop(0, look.top)
  grad.addColorStop(1, look.foot)
  g.fillStyle = grad
  g.beginPath()
  g.moveTo(0, tall)
  for (let x = 0; x <= P; x += 2) g.lineTo(x, ridge(x))
  g.lineTo(P, tall)
  g.closePath()
  g.fill()
}

/**
 * Light along the ridge's sunward slopes and shade along the others: a band under the ridge line, thicker the
 * steeper the slope. The sun's to the right, as it is for the day's own hills (vista.ts).
 */
function shadeRidge(g: CanvasRenderingContext2D, P: number, ridge: Ridge, thick: number, look: RangeLook) {
  for (const lit of [true, false]) {
    g.fillStyle = lit ? look.lit : look.shade
    g.globalAlpha = lit ? 0.55 : 0.5
    g.beginPath()
    const low: [number, number][] = []
    for (let x = 0; x <= P; x += 2) {
      const y = ridge(x)
      const slope = (ridge(x + 2) - ridge(x - 2)) / 4
      // Down to the right faces the sun.
      const face = Math.max(0, Math.min(1, (lit ? slope : -slope) / 0.55))
      if (x === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
      low.push([x, y + thick * face])
    }
    for (let i = low.length - 1; i >= 0; i--) g.lineTo(low[i]![0], low[i]![1])
    g.closePath()
    g.fill()
  }
  g.globalAlpha = 1
}

/**
 * One of the far ranges, `P` wide, meeting itself at its ends: 0 the mountains at the back, snow on their
 * tops; 1 the wooded hills before them; 2 the nearest, with trees you can tell apart. `amp` is how tall its
 * ridge stands, and the picture goes on down below it into the mist.
 */
export function rangePicture(P: number, tall: number, res: number, tier: 0 | 1 | 2, look: RangeLook, mood: Mood, rnd: () => number, amp: number): Picture {
  const p = [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU]
  const pad = 3
  // Every wave below goes round in P, so painting on past P paints the row's start again.
  const wide = P + LAP
  return picture(wide, tall, res, (g) => {
    if (tier === 0) {
      // Two rows of peaks: the far one tall, with snow; a lower one before it.
      const m = (x: number) => 0.56 * peaks(x, P, 3, p[0]!) + 0.29 * peaks(x, P, 7, p[1]!) + 0.15 * peaks(x, P, 15, p[2]!)
      const back: Ridge = (x) => pad + amp * (1 - m(x)) * 0.96
      fillRidge(g, wide, tall, back, pad, look)
      shadeRidge(g, wide, back, amp * 0.2, look)
      // Snow, down from each top as far as it's high, its hem ragged.
      g.fillStyle = mood.dark ? mixColor(look.top, mood.cloud.lit, 0.42) : mixColor(look.top, '#ffffff', 0.82)
      const line = 0.6
      let open = false
      const hem: [number, number][] = []
      const close = () => {
        for (let i = hem.length - 1; i >= 0; i--) g.lineTo(hem[i]![0], hem[i]![1])
        g.closePath()
        g.fill()
        hem.length = 0
        open = false
      }
      for (let x = 0; x <= wide; x += 2) {
        const over = m(x) - line
        if (over > 0) {
          const y = back(x)
          if (!open) {
            g.beginPath()
            g.moveTo(x, y)
            open = true
          } else g.lineTo(x, y)
          hem.push([x, y + over * amp * 0.62 + (Math.floor(x / 6) % 2 ? amp * 0.012 : -amp * 0.012)])
        } else if (open) close()
      }
      if (open) close()
      const front: Ridge = (x) => pad + amp * (0.5 + 0.5 * (1 - (0.6 * peaks(x, P, 4, p[3]!) + 0.4 * peaks(x, P, 9, p[4]!))))
      fillRidge(g, wide, tall, front, pad + amp * 0.5, { ...look, top: mixColor(look.top, look.shade, 0.3) })
      shadeRidge(g, wide, front, amp * 0.1, look)
      return
    }
    const ridge: Ridge =
      tier === 1
        ? (x) => pad + amp * (0.5 - 0.5 * (0.58 * wave(x, P, 2, p[0]!) + 0.3 * wave(x, P, 5, p[1]!) + 0.12 * wave(x, P, 11, p[2]!)))
        : (x) => pad + amp * (0.5 - 0.5 * (0.6 * wave(x, P, 1, p[0]!) + 0.3 * wave(x, P, 3, p[1]!) + 0.1 * wave(x, P, 8, p[2]!)))
    // Trees along the ridge, standing behind it: in woods with gaps between.
    const unit = amp * (tier === 1 ? 0.11 : 0.2)
    g.fillStyle = look.detail
    for (let x = 0; x < P; ) {
      const wood = wave(x, P, tier === 1 ? 5 : 3, p[3]!) + 0.35 * wave(x, P, 13, p[4]!)
      const gap = unit * (tier === 1 ? 0.9 : 1.5) * (0.7 + rnd() * 0.9)
      if (wood > -0.25) {
        const y = ridge(x) + unit * 0.25
        const s = unit * (0.7 + rnd() * 0.7)
        const pine = rnd() < (tier === 1 ? 0.6 : 0.45)
        // Once where it stands, and again a row along for one that hangs over the row's end, so it isn't cut in two.
        for (const at of x < s * 2 ? [x, x + P] : [x]) {
          g.beginPath()
          if (pine) {
            g.moveTo(at - s * 0.5, y)
            g.lineTo(at, y - s * 2.1)
            g.lineTo(at + s * 0.5, y)
            g.closePath()
          } else {
            // A round tree: its crown, two puffs of it.
            g.arc(at, y - s * 0.85, s * 0.7, 0, TAU)
            g.arc(at + s * 0.42, y - s * 0.5, s * 0.5, 0, TAU)
          }
          g.fill()
          if (!pine && tier === 2) g.fillRect(at - s * 0.08, y - s * 0.3, s * 0.16, s * 0.4)
        }
      }
      x += gap
    }
    fillRidge(g, wide, tall, ridge, pad, look)
    shadeRidge(g, wide, ridge, amp * (tier === 1 ? 0.22 : 0.3), look)
  })
}
