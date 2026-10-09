import * as THREE from 'three'
import type { Role } from '../engine/types.ts'

/*
 * Wobble Run's colours and painted textures: the colour code (design-final §1.5, the same in every theme and every
 * day), the two skies the world follows the site's theme with (an afternoon in light, dusk with stars in dark),
 * and the canvases the scene paints its patterns, glows and lettering on. Here so the scene's other parts read
 * one table, and a theme change only re-reads it (WobbleScene.ts applyLook): nothing is built again.
 */

/** The colour code: what a thing means, in the site's PALETTE, with its pattern for colour-blind players. */
export const CODE = {
  jump: '#f2813a',
  dive: '#8a6ad4',
  dodge: '#e8564f',
  bouncy: '#3ec8cf',
  helps: '#3ecf8e',
  pushes: '#6b74e8',
  warn: '#f5b942',
  gold: '#f4c53e',
  check: '#ffffff',
} as const

/**
 * Blip, the runner: the site's blip grown feet (the Blipka mark's dot). A mint body with a deeper band round its
 * foot, dark feet, and the glowing spark over its head; never blue, cyan or amber (the ghosts' colours).
 */
export const BLIP = { body: '#34c6a8', shade: '#1f9b84', feet: '#167a69', glow: '#9ff7e2', spark: '#f2fffb', ink: '#0f2f2a', cheek: '#ff8fb3' } as const

/**
 * The soda sea under every course: teal, fizzing, its surface `top`, `deep` where it's deeper, a light `rim` on its
 * wave crests and bubbles of `fizz`. Each weekday's theme leans it a touch (greener in the meadow, bluer in the bay),
 * never far enough to stop reading as teal soda.
 */
export type Soda = { top: string; deep: string; rim: string; fizz: string }
const SODA_BASE: Soda = { top: '#1fa6a0', deep: '#178a86', rim: '#bff7ee', fizz: '#dffbf6' }
const SODA_LEAN: Record<string, [string, string]> = {
  mint: ['#21ab97', '#178c80'],
  bubblegum: ['#1fa3a8', '#16878e'],
  lemon: ['#26b2a6', '#1a918a'],
  grape: ['#1f9ba8', '#16808e'],
  sherbet: ['#27a99c', '#1b8c82'],
  neon: ['#18a3a6', '#0f8288'],
}
export function sodaOf(themeId: string): Soda {
  const lean = SODA_LEAN[themeId]
  return lean ? { ...SODA_BASE, top: lean[0], deep: lean[1] } : SODA_BASE
}
/** A tile about to drop: pastel, then amber, then red. */
export const CRACK_AMBER = '#f5b942'
export const CRACK_RED = '#e8564f'
/** A door's lamp: open, closing soon (blinking), shut. */
export const LAMP = { open: '#3ecf8e', warn: '#f5b942', shut: '#e8564f' } as const

/** The roles drawn with a pattern of their own (a painted texture in the role's colour). */
export type PatternRole = 'jump' | 'dive' | 'dodge' | 'bouncy' | 'helps' | 'pushes' | 'gold'
export const PATTERN_ROLES: readonly PatternRole[] = ['jump', 'dive', 'dodge', 'bouncy', 'helps', 'pushes', 'gold']
export function patternOf(role: Role): PatternRole | null {
  return (PATTERN_ROLES as readonly string[]).includes(role) ? (role as PatternRole) : null
}

/**
 * One of the world's two looks. Colours are '#rrggbb'. `world` and `code` multiply every material (the vertex
 * colours carry the hue and the baked light), so dusk dims the pastels toward lavender while the colour code stays
 * nearly as strong; `trims` is how strongly the lit edges glow (the emissive trims of dusk).
 */
export type SkyLook = {
  dark: boolean
  skyTop: string
  skyMid: string
  horizon: string
  below: string
  fog: string
  fogNear: number
  fogFar: number
  world: string
  code: string
  trims: number
  stars: number
  sun: string
  sunGlow: string
  /** The soda sea: its painted colours multiplied by `sea` (dimmer and bluer at dusk), its fizz glinting this strong. */
  sea: string
  seaFizz: number
  shadow: number
  blue: string
  ghost: string
  mine: string
  flag: string
  passed: string
  tagFill: string
}

export const LOOKS: Record<'day' | 'dusk', SkyLook> = {
  day: {
    dark: false,
    skyTop: '#4fa9ea',
    skyMid: '#93d2f6',
    horizon: '#f6f0ea',
    below: '#e2ebf6',
    fog: '#e2ebf6',
    fogNear: 70,
    fogFar: 190,
    world: '#ffffff',
    code: '#ffffff',
    trims: 0.16,
    stars: 0,
    sun: '#fff6d8',
    sunGlow: '#ffe7a8',
    sea: '#ffffff',
    seaFizz: 0.3,
    shadow: 0.34,
    blue: '#2f8fd6',
    ghost: '#0f8fb0',
    mine: '#c98a10',
    flag: '#e0951a',
    passed: '#198a58',
    tagFill: 'rgba(26,43,60,0.72)',
  },
  dusk: {
    dark: true,
    skyTop: '#090b2a',
    skyMid: '#261d58',
    horizon: '#d97fa4',
    below: '#2c1946',
    fog: '#3b2a5e',
    fogNear: 45,
    fogFar: 135,
    world: '#b6afdc',
    code: '#e2dcf5',
    trims: 0.42,
    stars: 0.9,
    sun: '#f3ecd2',
    sunGlow: '#c9a9ff',
    sea: '#9fb2d4',
    seaFizz: 0.42,
    shadow: 0.42,
    blue: '#4cb8f0',
    ghost: '#46e4ff',
    mine: '#f5b942',
    flag: '#f5b942',
    passed: '#3ecf8e',
    tagFill: 'rgba(7,5,15,0.78)',
  },
}

type Tintable = THREE.Material & { color: THREE.Color }

/**
 * The materials a theme change touches, and how: the world's multiply by the look's `world`, the colour code's by
 * its `code` (dimmed less, so hazards stay saturated at dusk), the lit trims' strength by `trims` × their own.
 * A theme change only re-reads these; nothing is built again.
 */
export class Tints {
  readonly world: Tintable[] = []
  readonly code: Tintable[] = []
  readonly trims: { m: THREE.Material; k: number }[] = []
  onWorld<T extends Tintable>(m: T): T {
    this.world.push(m)
    return m
  }
  onCode<T extends Tintable>(m: T): T {
    this.code.push(m)
    return m
  }
  onTrim<T extends THREE.Material>(m: T, k = 1): T {
    this.trims.push({ m, k })
    return m
  }
  apply(look: SkyLook, night: boolean) {
    for (const m of this.world) m.color.set(look.world)
    for (const m of this.code) m.color.set(look.code)
    for (const { m, k } of this.trims) {
      m.opacity = Math.min(1, look.trims * k * (night ? 1.5 : 1))
      m.visible = m.opacity > 0.01
    }
  }
}

/** a toward b by k, as '#rrggbb' (in sRGB, as the site's mixColor). */
export function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (p: number, s: number) => (p >> s) & 255
  const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * k))
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('')
}

export type Paint = (g: CanvasRenderingContext2D, w: number, h: number) => void

/** Every canvas the scene paints, kept to let go of together, and the lettered ones to paint again once Outfit has come. */
export class Painter {
  readonly textures: THREE.Texture[] = []
  readonly lettered: [THREE.CanvasTexture, Paint][] = []
  private readonly anisotropy: number
  constructor(anisotropy: number) {
    this.anisotropy = anisotropy
  }

  paint(w: number, h: number, draw: Paint, opts: { repeat?: boolean; text?: boolean; srgb?: boolean } = {}): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d')!, w, h)
    const tex = new THREE.CanvasTexture(c)
    if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.anisotropy
    if (opts.repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    this.textures.push(tex)
    if (opts.text) this.lettered.push([tex, draw])
    return tex
  }

  /** Paint a lettered texture again (its text changed, or the font came). */
  repaint(tex: THREE.CanvasTexture) {
    const found = this.lettered.find(([t]) => t === tex)
    if (!found) return
    const c = tex.image as HTMLCanvasElement
    found[1](c.getContext('2d')!, c.width, c.height)
    tex.needsUpdate = true
  }

  /** A texture already painted, kept for disposing with the rest (a clone for a belt of its own). */
  keep<T extends THREE.Texture>(tex: T): T {
    this.textures.push(tex)
    return tex
  }

  dispose() {
    for (const t of this.textures) t.dispose()
    this.textures.length = 0
  }
}

/** Older iPhones have no roundRect. */
export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  if (g.roundRect) g.roundRect(x, y, w, h, r)
  else g.rect(x, y, w, h)
}

/** A chevron at (cx, cy), `s` across, pointing up (dir −1) or down (dir 1) on the canvas. */
function chevron(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, dir: number) {
  g.beginPath()
  g.moveTo(cx - s / 2, cy - (dir * s) / 4)
  g.lineTo(cx, cy + (dir * s) / 4)
  g.lineTo(cx + s / 2, cy - (dir * s) / 4)
  g.stroke()
}

/**
 * The colour code's patterns, each its colour with its marks in white, tiling. A texture's v runs up a side and
 * forward along a top (the scene lays its UVs so), so "up" chevrons point up a wall and on along a floor.
 */
export function paintPattern(p: Painter, role: PatternRole): THREE.CanvasTexture {
  const base = CODE[role]
  return p.paint(
    128,
    128,
    (g, w, h) => {
      g.fillStyle = base
      g.fillRect(0, 0, w, h)
      g.strokeStyle = 'rgba(255,255,255,0.92)'
      g.fillStyle = 'rgba(255,255,255,0.92)'
      g.lineCap = 'round'
      g.lineJoin = 'round'
      if (role === 'jump' || role === 'dive' || role === 'helps') {
        // Up-chevrons for jump it, down for dive under it; forward for helps (v forward along a floor).
        g.lineWidth = 13
        const dir = role === 'dive' ? 1 : -1
        for (const cy of [h * 0.27, h * 0.77]) chevron(g, w / 2, cy, w * 0.58, dir)
      } else if (role === 'dodge') {
        // White bands.
        g.fillRect(0, h * 0.18, w, h * 0.16)
        g.fillRect(0, h * 0.68, w, h * 0.16)
      } else if (role === 'bouncy') {
        // Dots.
        for (const [x, y] of [
          [0.25, 0.25],
          [0.75, 0.75],
        ]) {
          g.beginPath()
          g.arc(x! * w, y! * h, w * 0.13, 0, Math.PI * 2)
          g.fill()
        }
        g.globalAlpha = 0.55
        for (const [x, y] of [
          [0.75, 0.25],
          [0.25, 0.75],
        ]) {
          g.beginPath()
          g.arc(x! * w, y! * h, w * 0.07, 0, Math.PI * 2)
          g.fill()
        }
        g.globalAlpha = 1
      } else if (role === 'pushes') {
        // Arrows, pointing along v.
        g.lineWidth = 10
        for (const cx of [w * 0.25, w * 0.75]) {
          const cy = cx === w * 0.25 ? h * 0.3 : h * 0.8
          g.beginPath()
          g.moveTo(cx, cy + h * 0.16)
          g.lineTo(cx, cy - h * 0.12)
          g.stroke()
          chevron(g, cx, cy - h * 0.1, w * 0.28, -1)
        }
      } else if (role === 'gold') {
        // Gold with a glint here and there.
        const grad = g.createLinearGradient(0, 0, w, h)
        grad.addColorStop(0, 'rgba(255,255,255,0.0)')
        grad.addColorStop(0.5, 'rgba(255,255,255,0.28)')
        grad.addColorStop(1, 'rgba(255,255,255,0.0)')
        g.fillStyle = grad
        g.fillRect(0, 0, w, h)
        g.fillStyle = 'rgba(255,255,255,0.95)'
        for (const [x, y, s] of [
          [0.3, 0.3, 10],
          [0.75, 0.68, 7],
        ]) {
          g.beginPath()
          g.moveTo(x! * w, y! * h - s!)
          g.lineTo(x! * w + s! * 0.3, y! * h)
          g.lineTo(x! * w, y! * h + s!)
          g.lineTo(x! * w - s! * 0.3, y! * h)
          g.closePath()
          g.fill()
          g.beginPath()
          g.moveTo(x! * w - s!, y! * h)
          g.lineTo(x! * w, y! * h + s! * 0.3)
          g.lineTo(x! * w + s!, y! * h)
          g.lineTo(x! * w, y! * h - s! * 0.3)
          g.closePath()
          g.fill()
        }
      }
    },
    { repeat: true },
  )
}

/** The floors' candy tiles: near-white, with soft seams every half texture (the vertex colours carry the hue). */
export function paintFloor(p: Painter): THREE.CanvasTexture {
  return p.paint(
    128,
    128,
    (g, w, h) => {
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, w, h)
      g.fillStyle = 'rgba(255,255,255,1)'
      // A faint sheen in each tile, and the seams round them.
      for (const [x, y] of [
        [0, 0],
        [w / 2, h / 2],
      ]) {
        g.fillStyle = 'rgba(0,0,0,0.035)'
        g.fillRect(x!, y!, w / 2, h / 2)
      }
      g.strokeStyle = 'rgba(0,0,0,0.09)'
      g.lineWidth = 3
      for (const v of [1.5, w / 2]) {
        g.beginPath()
        g.moveTo(v, 0)
        g.lineTo(v, h)
        g.moveTo(0, v)
        g.lineTo(w, v)
        g.stroke()
      }
    },
    { repeat: true },
  )
}

/** The white pads' faint checker (start and checkpoint pads, star tiles). */
export function paintCheck(p: Painter): THREE.CanvasTexture {
  return p.paint(
    64,
    64,
    (g, w, h) => {
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#ecebf7'
      g.fillRect(0, 0, w / 2, h / 2)
      g.fillRect(w / 2, h / 2, w / 2, h / 2)
    },
    { repeat: true },
  )
}

/** A slide's gloss: stripes down the fall line (along v), white on near-white. */
export function paintSlide(p: Painter): THREE.CanvasTexture {
  return p.paint(
    64,
    64,
    (g, w, h) => {
      g.fillStyle = '#f2f2f2'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#ffffff'
      g.fillRect(w * 0.1, 0, w * 0.3, h)
      g.fillStyle = 'rgba(255,255,255,0.6)'
      g.fillRect(w * 0.62, 0, w * 0.08, h)
    },
    { repeat: true },
  )
}

/** A seeded random for the painted textures (the same every time). */
function seeded(seed: number): () => number {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

/** Draws `f` at (x, y) and at its copies a tile over, so a mark crossing an edge carries on over the other side. */
function wrapped(w: number, h: number, x: number, y: number, f: (x: number, y: number) => void) {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) f(x + ox, y + oy)
}

/**
 * The soda's surface, tiling: teal with deeper swirls, short light crests and little rings of fizz, in the day's
 * colours (the material only dims it at dusk).
 */
export function paintSoda(p: Painter, soda: Soda): THREE.CanvasTexture {
  return p.paint(
    256,
    256,
    (g, w, h) => {
      const rnd = seeded(7)
      g.fillStyle = soda.top
      g.fillRect(0, 0, w, h)
      const deep = parseInt(soda.deep.slice(1), 16)
      const rgb = `${(deep >> 16) & 255},${(deep >> 8) & 255},${deep & 255}`
      for (let i = 0; i < 12; i++) {
        const r = 34 + rnd() * 44
        const a = 0.35 + rnd() * 0.3
        wrapped(w, h, rnd() * w, rnd() * h, (x, y) => {
          const grad = g.createRadialGradient(x, y, 0, x, y, r)
          grad.addColorStop(0, `rgba(${rgb},${a})`)
          grad.addColorStop(1, `rgba(${rgb},0)`)
          g.fillStyle = grad
          g.fillRect(x - r, y - r, r * 2, r * 2)
        })
      }
      // The crests: short wavy lines of the light rim.
      g.lineCap = 'round'
      g.strokeStyle = soda.rim
      for (let i = 0; i < 12; i++) {
        const len = 24 + rnd() * 34
        const amp = 2 + rnd() * 2.5
        g.globalAlpha = 0.35 + rnd() * 0.3
        g.lineWidth = 1.6 + rnd() * 1.4
        wrapped(w, h, rnd() * w, rnd() * h, (x, y) => {
          g.beginPath()
          for (let k = 0; k <= 12; k++) {
            const u = k / 12
            const px = x + u * len
            const py = y + Math.sin(u * Math.PI * 2) * amp
            if (k === 0) g.moveTo(px, py)
            else g.lineTo(px, py)
          }
          g.stroke()
        })
      }
      // The fizz: little rings, and a few dots.
      g.strokeStyle = soda.fizz
      g.fillStyle = soda.fizz
      g.lineWidth = 1.2
      for (let i = 0; i < 22; i++) {
        const r = 2.2 + Math.pow(rnd(), 1.4) * 5
        g.globalAlpha = 0.4 + rnd() * 0.35
        wrapped(w, h, rnd() * w, rnd() * h, (x, y) => {
          g.beginPath()
          g.arc(x, y, r, 0, Math.PI * 2)
          g.stroke()
        })
      }
      for (let i = 0; i < 8; i++) {
        const r = 1 + rnd() * 0.8
        g.globalAlpha = 0.4 + rnd() * 0.3
        wrapped(w, h, rnd() * w, rnd() * h, (x, y) => {
          g.beginPath()
          g.arc(x, y, r, 0, Math.PI * 2)
          g.fill()
        })
      }
      g.globalAlpha = 1
    },
    { repeat: true },
  )
}

/** The soda's glints, drifting over it (added, so black is nothing): soft sparkles, rings and a crest or two. */
export function paintFizz(p: Painter): THREE.CanvasTexture {
  return p.paint(
    256,
    256,
    (g, w, h) => {
      const rnd = seeded(31)
      g.fillStyle = '#000000'
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 12; i++) {
        const r = 4 + rnd() * 9
        const a = 0.3 + rnd() * 0.3
        wrapped(w, h, rnd() * w, rnd() * h, (x, y) => {
          const grad = g.createRadialGradient(x, y, 0, x, y, r)
          grad.addColorStop(0, `rgba(255,255,255,${a})`)
          grad.addColorStop(1, 'rgba(255,255,255,0)')
          g.fillStyle = grad
          g.fillRect(x - r, y - r, r * 2, r * 2)
        })
      }
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1.3
      for (let i = 0; i < 10; i++) {
        const r = 2 + rnd() * 4
        g.globalAlpha = 0.4 + rnd() * 0.4
        wrapped(w, h, rnd() * w, rnd() * h, (x, y) => {
          g.beginPath()
          g.arc(x, y, r, 0, Math.PI * 2)
          g.stroke()
        })
      }
      g.lineCap = 'round'
      g.lineWidth = 2
      for (let i = 0; i < 6; i++) {
        const len = 18 + rnd() * 26
        g.globalAlpha = 0.35 + rnd() * 0.3
        wrapped(w, h, rnd() * w, rnd() * h, (x, y) => {
          g.beginPath()
          g.moveTo(x, y)
          g.quadraticCurveTo(x + len / 2, y - 4, x + len, y)
          g.stroke()
        })
      }
      g.globalAlpha = 1
    },
    { repeat: true },
  )
}

/** A bubble: a light ring with a glint, see-through in the middle (the soda's rising fizz). */
export function paintBubble(p: Painter): THREE.CanvasTexture {
  return p.paint(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    const r = w * 0.36
    g.fillStyle = 'rgba(255,255,255,0.16)'
    g.beginPath()
    g.arc(w / 2, h / 2, r, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.95)'
    g.lineWidth = w * 0.085
    g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.95)'
    g.beginPath()
    g.arc(w * 0.39, h * 0.37, w * 0.075, 0, Math.PI * 2)
    g.fill()
  })
}

/** A soft round dot, white in the middle: glows, blob shadows (drawn dark), particles. */
export function paintDot(p: Painter): THREE.CanvasTexture {
  return p.paint(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
}

/** A bright ring: the mark on the soda under Blip when it's over nothing (the most important landing aid). */
export function paintRing(p: Painter): THREE.CanvasTexture {
  return p.paint(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    const grad = g.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.15)')
    grad.addColorStop(0.75, 'rgba(255,255,255,1)')
    grad.addColorStop(0.88, 'rgba(255,255,255,0.35)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
}

/** A fan's blur: a disc of soft streaks, for blades turning too fast to see. */
export function paintBlur(p: Painter): THREE.CanvasTexture {
  return p.paint(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.translate(w / 2, h / 2)
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2)
      const grad = g.createRadialGradient(0, 0, w * 0.08, 0, 0, w * 0.5)
      grad.addColorStop(0, 'rgba(255,255,255,0.75)')
      grad.addColorStop(1, 'rgba(255,255,255,0.05)')
      g.fillStyle = grad
      g.beginPath()
      g.moveTo(0, 0)
      g.arc(0, 0, w * 0.48, -0.15, 0.85)
      g.closePath()
      g.fill()
    }
    g.setTransform(1, 0, 0, 1, 0, 0)
  })
}

/**
 * A painted light for a matcap: lit from the upper left, a hot highlight, a soft rim. Grey, so the material's own
 * colour tints it (Blip's mint, a skin's colours, the star).
 */
export function paintMatcap(p: Painter, opts: { base?: string; light?: string; dark?: string; spec?: number } = {}): THREE.CanvasTexture {
  return p.paint(256, 256, (g, w, h) => {
    const base = opts.base ?? '#c8c8c8'
    const light = opts.light ?? '#ffffff'
    const dark = opts.dark ?? '#6c6c78'
    const grad = g.createRadialGradient(w * 0.38, h * 0.34, w * 0.04, w * 0.5, h * 0.5, w * 0.52)
    grad.addColorStop(0, light)
    grad.addColorStop(0.45, base)
    grad.addColorStop(0.92, dark)
    grad.addColorStop(1, dark)
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    // A soft bounce of light along the bottom rim, and the shine.
    const rim = g.createRadialGradient(w * 0.5, h * 0.95, w * 0.05, w * 0.5, h * 0.9, w * 0.45)
    rim.addColorStop(0, 'rgba(255,255,255,0.28)')
    rim.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rim
    g.fillRect(0, 0, w, h)
    const spec = g.createRadialGradient(w * 0.33, h * 0.27, 0, w * 0.33, h * 0.27, w * 0.14)
    spec.addColorStop(0, `rgba(255,255,255,${opts.spec ?? 0.95})`)
    spec.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = spec
    g.fillRect(0, 0, w, h)
  })
}

/** A pill of lettering (an arch's sign, a ghost's name), painted at `w`×`h` with `text()` read at paint time. */
export function signPaint(text: () => string, colours: { fill: string; ink: string; edge?: string }, weight = 800): Paint {
  return (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = colours.fill
    roundRect(g, 4, 6, w - 8, h - 12, (h - 12) / 2)
    g.fill()
    if (colours.edge) {
      g.strokeStyle = colours.edge
      g.lineWidth = Math.max(3, h * 0.06)
      g.stroke()
    }
    g.fillStyle = colours.ink
    g.font = `${weight} ${Math.round(h * 0.5)}px "Outfit", system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text(), w / 2, h / 2 + 1, w - h)
  }
}
