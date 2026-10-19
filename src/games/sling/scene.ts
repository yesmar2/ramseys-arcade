import { mixColor } from '../../lib/color'
import { isDarkTheme } from '../../lib/theme'
import type { GhostPose } from './runs'
import { bugAt, CLAY_FOR, HANG, mulberry32, pegAt, sweeperAt, TW, type Tower } from './sim'

/*
 * Sling on a 2D canvas: the day's tower from the front, the camera climbing with Blip. The sky follows the site's
 * theme (an afternoon in light, dusk with stars in dark), with far towers in the day's colour behind. The shaft's
 * two walls are washed in the day's colour (sim.ts TOWER_HUES), as Swoop's hills are: a lit inner edge, a band
 * of the colour, and a seam down each with a row of blips in it. Pegs are round knobs; sliders run on a rail,
 * carousel pegs round a hub, clay pegs are terracotta and shake as they go, boost pegs are gold with a chevron.
 * Brambles are thorny bars with a gap, bugs buzz side to side, sweepers turn on a hub, updrafts are a fan with
 * air rising. The flags split the run on the walls; the top is a chequered band. Blip is the site's mint Blip;
 * the blue blip is the racing dailies' blue, and anyone else's run is a ghost's outline, cyan (or amber, your own
 * best), with whose run it is over it.
 *
 * Only fills and strokes, never shadowBlur, so a phone's canvas keeps up.
 */

const TAU = Math.PI * 2
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** Blip's colours: the site's mascot (components/BlipFigure.tsx). */
const BLIP = { body: '#34c6a8', shade: '#1f9b84', feet: '#167a69', ink: '#0f2f2a', cheek: 'rgba(255, 143, 179, 0.75)', spark: '#f2fffb' }
const CLAY = '#d98a5f'
const GOLD = '#f5b942'

type Palette = {
  dark: boolean
  skyTop: string
  skyLow: string
  sun: string
  ink: string
  paper: string
  far: string
  mid: string
  wall: string
  wallDeep: string
  edge: string
  seam: string
  blip: string
  shaft: string
  peg: string
  pegLine: string
  rail: string
  thorn: string
  thornDeep: string
  bug: string
  sweep: string
  air: string
  blue: string
  ghost: string
  mine: string
  flag: string
  passed: string
  good: string
  bad: string
}

function paletteFor(hue: string): Palette {
  const dark = isDarkTheme()
  const ground = dark ? '#0e1230' : '#ffffff'
  return {
    dark,
    skyTop: dark ? '#0a0e29' : '#8fcdf7',
    skyLow: dark ? '#47306b' : '#fff2d6',
    sun: dark ? '#f3ecd2' : '#ffd76a',
    ink: dark ? '#e7eef3' : '#1a2b3c',
    paper: dark ? '#0e1230' : '#ffffff',
    far: dark ? mixColor(hue, '#1b1745', 0.78) : mixColor(hue, '#d9eefb', 0.72),
    mid: dark ? mixColor(hue, '#141238', 0.62) : mixColor(hue, '#eaf6ee', 0.5),
    wall: dark ? mixColor(hue, ground, 0.45) : mixColor(hue, ground, 0.18),
    wallDeep: dark ? mixColor(hue, ground, 0.68) : mixColor(hue, '#1a2b3c', 0.32),
    edge: dark ? mixColor(hue, '#ffffff', 0.5) : mixColor(hue, '#1a2b3c', 0.45),
    seam: dark ? mixColor(hue, ground, 0.62) : mixColor(hue, '#1a2b3c', 0.22),
    blip: dark ? mixColor(hue, '#ffffff', 0.3) : mixColor(hue, '#ffffff', 0.55),
    shaft: dark ? 'rgba(14, 18, 48, 0.42)' : 'rgba(255, 255, 255, 0.34)',
    peg: dark ? '#dfe6f2' : '#4a5a6e',
    pegLine: dark ? '#8794ad' : '#26354a',
    rail: dark ? 'rgba(223, 230, 242, 0.35)' : 'rgba(26, 43, 60, 0.28)',
    thorn: dark ? '#e0637a' : '#c23b5a',
    thornDeep: dark ? '#7a2a45' : '#8a2340',
    bug: dark ? '#f07a8a' : '#d94a5a',
    sweep: dark ? '#f5b942' : '#e0951a',
    air: dark ? 'rgba(159, 247, 226, 0.5)' : 'rgba(31, 155, 132, 0.45)',
    blue: dark ? '#4cb8f0' : '#2f8fd6',
    ghost: dark ? '#46e4ff' : '#0f8fb0',
    mine: dark ? '#f5b942' : '#c98a10',
    flag: dark ? '#f5b942' : '#e0951a',
    passed: dark ? '#3ecf8e' : '#198a58',
    good: dark ? '#f5b942' : '#b77f0c',
    bad: dark ? '#f07a8a' : '#c93d47',
  }
}

/** The aim, while a fling is being lined up: where the finger went down and is now (screen px), the flight's start, and its power. */
export type Aim = { fromX: number; fromY: number; toX: number; toY: number; dots: number[]; pw: number }

/** What a frame shows. */
export type SceneFrame = {
  /** At the start card (the camera rides with the run to beat), climbing, or at the top. */
  mode: 'menu' | 'play' | 'done'
  /** The run's clock: what moves on the tower moves with it. */
  t: number
  blip: { x: number; y: number; vx: number; vy: number; on: boolean; floating: boolean; peg: number; held: number }
  /** The highest peg had, and the last flag passed (−1 before the first). */
  best: number
  flag: number
  aim: Aim | null
  ghost: GhostPose | null
  ghostTag: string
  ghostMine: boolean
  ghostBlue: boolean
  /** A clay peg that's crumbled away for now. */
  gone: number
  calm: boolean
}

type Bit = { x: number; y: number; vx: number; vy: number; life: number; color: string }
type Floater = { x: number; y: number; text: string; life: number; good: boolean }

/** The shaft fills this much of the screen's width at most, with room either side for the walls and the view. */
const VIEW_W = TW + 110
const VIEW_H = 700

export class TowerScene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly tower: Tower
  private readonly font: string
  private W = 0
  private H = 0
  private dpr = 1
  private cam = { y: 0, snap: true }
  private C: Palette
  private sky: HTMLCanvasElement | null = null
  private time = 0
  private bits: Bit[] = []
  private floaters: Floater[] = []
  private trail: { x: number; y: number; life: number }[] = []
  private squash = 0
  private stars: { x: number; y: number; s: number }[]
  private farTowers: { x: number; w: number; h: number; far: boolean }[]

  constructor(canvas: HTMLCanvasElement, tower: Tower) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Sling: no 2D canvas')
    this.canvas = canvas
    this.ctx = ctx
    this.tower = tower
    this.C = paletteFor(tower.hue)
    const face = getComputedStyle(canvas).getPropertyValue('--font-display').trim()
    this.font = face || 'system-ui, sans-serif'
    const r = mulberry32(tower.n * 31 + 7)
    this.stars = Array.from({ length: 90 }, () => ({ x: r(), y: r(), s: 0.6 + r() * 1.2 }))
    this.farTowers = Array.from({ length: 14 }, (_, i) => ({ x: r() * 1.4 - 0.2, w: 0.05 + r() * 0.07, h: 0.25 + r() * 0.5, far: i % 2 === 0 }))
  }

  resize(w: number, h: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (Math.round(w) === this.W && Math.round(h) === this.H && dpr === this.dpr) return
    this.W = Math.round(w)
    this.H = Math.round(h)
    this.dpr = dpr
    this.canvas.width = Math.max(1, Math.round(this.W * dpr))
    this.canvas.height = Math.max(1, Math.round(this.H * dpr))
    this.sky = null
  }

  retheme() {
    this.C = paletteFor(this.tower.hue)
    this.sky = null
  }

  snap() {
    this.cam.snap = true
    this.bits.length = 0
    this.floaters.length = 0
    this.trail.length = 0
  }

  /** Pixels to a world unit, and where the shaft's left wall is on the screen. */
  private get k() {
    return Math.min(this.W / VIEW_W, this.H / VIEW_H)
  }
  private get ox() {
    return (this.W - TW * this.k) / 2
  }
  sx(x: number) {
    return this.ox + x * this.k
  }
  sy(y: number) {
    return this.H * 0.64 - (y - this.cam.y) * this.k
  }
  /** Screen pixels to the world: for the aim's dots, and to tell where a finger is. */
  toWorld(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.ox) / this.k, y: this.cam.y - (py - this.H * 0.64) / this.k }
  }
  /** World units a screen pixel is. */
  get unitsPerPixel() {
    return 1 / Math.max(0.01, this.k)
  }

  /** Something happened at (x, y): a grab, a skip, a miss, a prick, a bump, a sweep, a crumble. */
  event(kind: 'grab' | 'skip' | 'miss' | 'prick' | 'bump' | 'swept' | 'crumble' | 'fling' | 'boost', x: number, y: number) {
    const C = this.C
    if (kind === 'grab' || kind === 'skip') {
      this.squash = 1
      for (let i = 0; i < (kind === 'skip' ? 14 : 6); i++) {
        const a = Math.random() * TAU
        const sp = 40 + Math.random() * 120
        this.bits.push({ x, y: y + HANG, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, color: kind === 'skip' ? C.good : C.edge })
      }
      if (kind === 'skip') this.floaters.push({ x, y: y + 30, text: 'Skip!', life: 1, good: true })
    } else if (kind === 'fling' || kind === 'boost') {
      if (kind === 'boost') this.floaters.push({ x, y: y + 20, text: 'Boost!', life: 0.8, good: true })
    } else {
      const words = { miss: 'Missed', prick: 'Prickly!', bump: 'Bonk!', swept: 'Swept!', crumble: 'Crumbled!' } as const
      this.floaters.push({ x, y: y + 24, text: words[kind], life: 1, good: false })
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * TAU
        const sp = 50 + Math.random() * 120
        this.bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color: kind === 'crumble' ? CLAY : C.bad })
      }
    }
  }

  frame(f: SceneFrame, dt: number) {
    const { ctx, W, H } = this
    if (W <= 0 || H <= 0) return
    this.time += dt
    // The camera: a little over Blip on a peg, looking up at what's next; on Blip in the air.
    const focus = f.mode === 'menu' && f.ghost && !f.calm ? f.ghost.y : f.blip.y
    const want = focus + (f.blip.on || f.mode === 'menu' ? 120 : 60)
    if (this.cam.snap) {
      this.cam.y = want
      this.cam.snap = false
    } else this.cam.y += (want - this.cam.y) * (1 - Math.exp(-4 * dt))

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (!this.sky) this.paintSky()
    if (this.sky) ctx.drawImage(this.sky, 0, 0, W, H)
    this.drawStars()
    this.drawFar()
    this.drawShaft(f)
    this.drawFans(f.t)
    this.drawPegs(f)
    this.drawHazards(f.t)
    this.drawFlags(f)
    this.drawTop()

    if (f.ghost && !f.ghost.done) this.drawGhost(f)
    if (f.aim && f.mode === 'play') this.drawAim(f.aim)
    // A dotted trail behind Blip in the air.
    if (f.mode === 'play' && !f.blip.on && !f.blip.floating) this.trail.push({ x: f.blip.x, y: f.blip.y, life: 1 })
    this.drawTrail(dt)
    if (f.mode !== 'menu' || f.calm || !f.ghost) {
      const b = f.mode === 'menu' ? { ...f.blip } : f.blip
      this.drawBlip(b.x, b.y, b.on, b.floating, b.vx, b.vy)
    }
    this.squash = Math.max(0, this.squash - dt * 5)
    this.drawBits(dt)
    this.drawFloaters(dt)
  }

  dispose() {
    this.bits.length = 0
    this.floaters.length = 0
    this.trail.length = 0
    this.sky = null
  }

  /* ---------- the sky and what's behind ---------- */

  private paintSky() {
    const { W, H, C } = this
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(W * this.dpr))
    c.height = Math.max(1, Math.round(H * this.dpr))
    const g = c.getContext('2d')
    if (!g) return
    g.scale(this.dpr, this.dpr)
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, C.skyTop)
    grad.addColorStop(1, C.skyLow)
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    // The sun, or the moon, low on one side.
    g.fillStyle = C.sun
    g.globalAlpha = C.dark ? 0.85 : 0.9
    g.beginPath()
    g.arc(W * 0.84, H * 0.2, Math.min(W, H) * 0.06, 0, TAU)
    g.fill()
    g.globalAlpha = 1
    this.sky = c
  }

  private drawStars() {
    const { ctx, W, H, C } = this
    if (!C.dark) return
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    for (const s of this.stars) {
      const y = (((s.y * H + this.cam.y * this.k * 0.05) % H) + H) % H
      ctx.fillRect(s.x * W, y, s.s, s.s)
    }
  }

  /**
   * Far towers in the day's colour, a town at the foot of the tower: they stand on the ground and slide down slower
   * than the shaft as you climb, so halfway up there's only sky.
   */
  private drawFar() {
    const { ctx, W, H, C } = this
    for (const pass of [true, false]) {
      const rate = pass ? 0.18 : 0.32
      ctx.fillStyle = pass ? C.far : C.mid
      const ground = this.H * 0.64 + this.cam.y * this.k * rate + 40
      for (const t of this.farTowers) {
        if (t.far !== pass) continue
        const w = t.w * W
        const x = t.x * W
        const top = ground - (pass ? 900 : 600) * t.h * this.k * rate * 2.4
        if (top > H) continue
        ctx.fillRect(x, top, w, H - top + 2)
        ctx.beginPath()
        ctx.moveTo(x - w * 0.12, top)
        ctx.lineTo(x + w / 2, top - w * 0.7)
        ctx.lineTo(x + w * 1.12, top)
        ctx.fill()
      }
    }
  }

  /* ---------- the shaft ---------- */

  private drawShaft(f: SceneFrame) {
    const { ctx, H, C } = this
    const k = this.k
    const x0 = this.sx(0)
    const x1 = this.sx(TW)
    ctx.fillStyle = C.shaft
    ctx.fillRect(x0, 0, x1 - x0, H)
    const wall = 22 * k
    const bottom = Math.min(H, this.sy(-30))
    for (const side of [0, 1]) {
      const inner = side ? x1 : x0
      const outer = side ? x1 + wall : x0 - wall
      const left = Math.min(inner, outer)
      ctx.fillStyle = C.wall
      ctx.fillRect(left, 0, wall, bottom)
      // the band of the day's colour, deeper toward the outside
      ctx.fillStyle = C.wallDeep
      ctx.fillRect(side ? inner + wall * 0.62 : outer, 0, wall * 0.38, bottom)
      // the lit inner edge
      ctx.fillStyle = C.edge
      ctx.fillRect(side ? inner : inner - 3 * k, 0, 3 * k, bottom)
      // a seam down it with a row of blips, as Swoop's hills have
      const seamX = side ? inner + wall * 0.36 : inner - wall * 0.36
      ctx.fillStyle = C.seam
      ctx.fillRect(seamX - 1.5 * k, 0, 3 * k, bottom)
      ctx.fillStyle = C.blip
      const every = 46
      const first = Math.floor((this.cam.y - H / k) / every) * every
      for (let y = first; y < this.cam.y + H / k; y += every) {
        const py = this.sy(y + (side ? every / 2 : 0))
        if (py > bottom) continue
        ctx.beginPath()
        ctx.arc(seamX, py, 2.8 * k, 0, TAU)
        ctx.fill()
      }
    }
    // The floor at the foot of the tower.
    if (bottom < H) {
      ctx.fillStyle = C.wallDeep
      ctx.fillRect(x0 - wall, bottom, x1 - x0 + wall * 2, H - bottom)
      ctx.fillStyle = C.edge
      ctx.fillRect(x0 - wall, bottom, x1 - x0 + wall * 2, 3 * k)
    }
    void f
  }

  private onScreen(y: number, pad = 80) {
    const py = this.sy(y)
    return py > -pad && py < this.H + pad
  }

  private drawFans(t: number) {
    const { ctx, C } = this
    const k = this.k
    for (const fan of this.tower.fans) {
      if (!this.onScreen(fan.y0, 2000) && !this.onScreen(fan.y1, 2000)) continue
      const x0 = this.sx(fan.x0)
      const x1 = this.sx(fan.x1)
      const yt = this.sy(fan.y1)
      const yb = this.sy(fan.y0)
      ctx.fillStyle = C.dark ? 'rgba(159, 247, 226, 0.07)' : 'rgba(31, 155, 132, 0.07)'
      ctx.fillRect(x0, yt, x1 - x0, yb - yt)
      // air rising: short strokes climbing the column
      ctx.strokeStyle = C.air
      ctx.lineWidth = 2 * k
      ctx.lineCap = 'round'
      const span = fan.y1 - fan.y0
      for (let i = 0; i < 9; i++) {
        const lane = fan.x0 + ((i + 0.5) / 9) * (fan.x1 - fan.x0)
        const y = fan.y0 + ((t * 260 + i * 97) % span)
        const py = this.sy(y)
        ctx.beginPath()
        ctx.moveTo(this.sx(lane), py)
        ctx.lineTo(this.sx(lane), py - 26 * k)
        ctx.stroke()
      }
      // the fan at its foot
      ctx.fillStyle = C.pegLine
      ctx.fillRect(x0, yb - 8 * k, x1 - x0, 8 * k)
      ctx.strokeStyle = C.peg
      ctx.lineWidth = 1.5 * k
      for (let i = 1; i < 6; i++) {
        const x = x0 + ((x1 - x0) * i) / 6
        ctx.beginPath()
        ctx.moveTo(x, yb - 8 * k)
        ctx.lineTo(x, yb)
        ctx.stroke()
      }
    }
  }

  private drawPegs(f: SceneFrame) {
    const { ctx, C } = this
    const k = this.k
    const t = f.t
    const pegs = this.tower.pegs
    const next = f.blip.on ? f.blip.peg + 1 : -1
    for (let i = 0; i < pegs.length; i++) {
      const pg = pegs[i]!
      if (!this.onScreen(pg.y, 160)) continue
      if (pg.slide) {
        ctx.strokeStyle = C.rail
        ctx.lineWidth = 4 * k
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(this.sx(pg.x - pg.slide.amp), this.sy(pg.y))
        ctx.lineTo(this.sx(pg.x + pg.slide.amp), this.sy(pg.y))
        ctx.stroke()
      }
      if (pg.orbit) {
        ctx.strokeStyle = C.rail
        ctx.lineWidth = 1.5 * k
        ctx.setLineDash([3 * k, 5 * k])
        ctx.beginPath()
        ctx.arc(this.sx(pg.x), this.sy(pg.y), pg.orbit.r * k, 0, TAU)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = C.rail
        ctx.beginPath()
        ctx.arc(this.sx(pg.x), this.sy(pg.y), 4 * k, 0, TAU)
        ctx.fill()
      }
      if (i === f.gone) continue
      const at = pegAt(pg, t)
      let px = this.sx(at.x)
      const py = this.sy(at.y)
      const R = (pg.kind === 'top' ? 12 : 9) * k
      if (pg.kind === 'clay' && f.blip.on && f.blip.peg === i) px += Math.sin(this.time * 60) * Math.min(1, f.blip.held / CLAY_FOR) * 2.2 * k
      if (i === next && f.mode === 'play') {
        // The next peg: a faint ring, how near you need to get.
        ctx.strokeStyle = C.dark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(26, 43, 60, 0.25)'
        ctx.lineWidth = 1.5 * k
        ctx.setLineDash([2 * k, 4 * k])
        ctx.beginPath()
        ctx.arc(px, py - HANG * 0.5 * k, 24 * k, 0, TAU)
        ctx.stroke()
        ctx.setLineDash([])
      }
      const fill = pg.kind === 'clay' ? CLAY : pg.kind === 'boost' || pg.kind === 'top' ? GOLD : C.peg
      ctx.fillStyle = C.pegLine
      ctx.beginPath()
      ctx.arc(px, py, R + 1.6 * k, 0, TAU)
      ctx.fill()
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.arc(px, py, R, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.beginPath()
      ctx.arc(px - R * 0.3, py - R * 0.32, R * 0.36, 0, TAU)
      ctx.fill()
      if (pg.kind === 'clay') {
        ctx.strokeStyle = 'rgba(70, 30, 15, 0.6)'
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        ctx.moveTo(px - R * 0.5, py - R * 0.1)
        ctx.lineTo(px, py + R * 0.15)
        ctx.lineTo(px + R * 0.25, py + R * 0.6)
        ctx.stroke()
      } else if (pg.kind === 'boost') {
        ctx.strokeStyle = '#7a4a05'
        ctx.lineWidth = 2 * k
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(px - R * 0.45, py + R * 0.25)
        ctx.lineTo(px, py - R * 0.3)
        ctx.lineTo(px + R * 0.45, py + R * 0.25)
        ctx.stroke()
      }
    }
  }

  private drawHazards(t: number) {
    const { ctx, C } = this
    const k = this.k
    for (const br of this.tower.brambles) {
      if (!this.onScreen(br.y)) continue
      const y = this.sy(br.y)
      for (const [a, b] of [[0, br.gx0], [br.gx1, TW]] as const) {
        if (b - a < 2) continue
        const x0 = this.sx(a)
        const x1 = this.sx(b)
        ctx.fillStyle = C.thornDeep
        ctx.fillRect(x0, y - 4 * k, x1 - x0, 8 * k)
        ctx.fillStyle = C.thorn
        ctx.fillRect(x0, y - 4 * k, x1 - x0, 3.5 * k)
        // thorns, up and down
        for (let x = a + 6; x < b - 3; x += 12) {
          const px = this.sx(x)
          ctx.beginPath()
          ctx.moveTo(px - 3 * k, y - 3 * k)
          ctx.lineTo(px, y - 10 * k)
          ctx.lineTo(px + 3 * k, y - 3 * k)
          ctx.moveTo(px + 3 * k, y + 3 * k)
          ctx.lineTo(px + 6 * k, y + 10 * k)
          ctx.lineTo(px + 9 * k, y + 3 * k)
          ctx.fill()
        }
      }
    }
    for (const bug of this.tower.bugs) {
      if (!this.onScreen(bug.y)) continue
      const x = bugAt(bug, t)
      const goingRight = Math.cos(bug.w * t + bug.ph) * bug.w > 0
      this.drawBug(this.sx(x), this.sy(bug.y), goingRight)
    }
    for (const s of this.tower.sweepers) {
      if (!this.onScreen(s.y, 120)) continue
      const a = sweeperAt(s, t)
      const cx = this.sx(s.x)
      const cy = this.sy(s.y)
      const dx = Math.cos(a) * s.len * k
      const dy = -Math.sin(a) * s.len * k
      ctx.strokeStyle = C.thornDeep
      ctx.lineWidth = 11 * k
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx - dx, cy - dy)
      ctx.lineTo(cx + dx, cy + dy)
      ctx.stroke()
      ctx.strokeStyle = C.sweep
      ctx.lineWidth = 7 * k
      ctx.beginPath()
      ctx.moveTo(cx - dx, cy - dy)
      ctx.lineTo(cx + dx, cy + dy)
      ctx.stroke()
      ctx.fillStyle = C.pegLine
      ctx.beginPath()
      ctx.arc(cx, cy, 6 * k, 0, TAU)
      ctx.fill()
    }
  }

  /** A bug from Find the Bug's crowd, small: a round red back, a dark head, wings a blur. */
  private drawBug(x: number, y: number, right: boolean) {
    const { ctx, C } = this
    const k = this.k
    const flap = Math.sin(this.time * 40) * 0.5 + 0.5
    ctx.fillStyle = C.dark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.7)'
    ctx.beginPath()
    ctx.ellipse(x - 4 * k, y - 9 * k, 7 * k, (3 + flap * 3) * k, -0.5, 0, TAU)
    ctx.ellipse(x + 4 * k, y - 9 * k, 7 * k, (3 + flap * 3) * k, 0.5, 0, TAU)
    ctx.fill()
    ctx.fillStyle = C.bug
    ctx.beginPath()
    ctx.arc(x, y, 11 * k, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#2a1a2a'
    ctx.beginPath()
    ctx.arc(x + (right ? 9 : -9) * k, y - 1 * k, 6 * k, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x + (right ? 11 : -11) * k, y - 3 * k, 1.8 * k, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    for (const [ox, oy] of [[-4, -3], [2, 4], [-3, 5]] as const) {
      ctx.beginPath()
      ctx.arc(x + ox * k, y + oy * k, 2 * k, 0, TAU)
      ctx.fill()
    }
  }

  private drawFlags(f: SceneFrame) {
    const { ctx, C } = this
    const k = this.k
    this.tower.flags.forEach((p, i) => {
      const y = this.tower.pegs[p]!.y
      if (!this.onScreen(y)) return
      const py = this.sy(y)
      const x = this.sx(0) - 3 * k
      ctx.strokeStyle = C.ink
      ctx.lineWidth = 2 * k
      ctx.beginPath()
      ctx.moveTo(x, py)
      ctx.lineTo(x, py - 36 * k)
      ctx.stroke()
      ctx.fillStyle = i <= f.flag ? C.passed : C.flag
      ctx.beginPath()
      ctx.moveTo(x, py - 36 * k)
      ctx.lineTo(x + 20 * k, py - 30 * k)
      ctx.lineTo(x, py - 24 * k)
      ctx.fill()
      ctx.fillStyle = C.paper
      ctx.font = `700 ${Math.round(9 * k)}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), x + 7 * k, py - 30 * k)
    })
  }

  /** A chequered band across the shaft over the top peg. */
  private drawTop() {
    const { ctx } = this
    const k = this.k
    const top = this.tower.pegs[this.tower.pegs.length - 1]!
    const y = top.y + 70
    if (!this.onScreen(y)) return
    const py = this.sy(y)
    const cell = 12
    for (let i = 0; i * cell < TW; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#1a2b3c' : '#ffffff'
        ctx.fillRect(this.sx(i * cell), py + j * cell * k, cell * k + 0.5, cell * k + 0.5)
      }
    }
  }

  /* ---------- Blip, the ghost and the aim ---------- */

  /** Blip, the site's mint mascot: hanging by his arms from a peg, or tucked in the air. */
  private blipAt(x: number, y: number, on: boolean, vx: number, vy: number, look: 'blip' | 'blue' | 'ghost' | 'mine', alpha: number) {
    const { ctx, C } = this
    const k = this.k * 1.05
    const px = this.sx(x)
    const py = this.sy(y)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(px, py)
    if (!on) ctx.rotate(clamp(vx / 2400, -0.4, 0.4))
    const sq = look === 'blip' ? 1 + this.squash * 0.12 : 1
    ctx.scale(k * sq, (k / sq) * (on ? 1 : 1 + clamp(vy / 6000, -0.08, 0.08)))
    const body = look === 'blue' ? C.blue : BLIP.body
    const deep = look === 'blue' ? mixColor(C.blue, '#0a1a3a', 0.35) : BLIP.feet
    if (look === 'ghost' || look === 'mine') {
      ctx.strokeStyle = look === 'mine' ? C.mine : C.ghost
      ctx.lineWidth = 2 / k
      ctx.beginPath()
      ctx.arc(0, 0, 10, 0, TAU)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-5, -8)
      ctx.lineTo(-3, on ? -17 : -12)
      ctx.moveTo(5, -8)
      ctx.lineTo(3, on ? -17 : -12)
      ctx.stroke()
      ctx.restore()
      return
    }
    // arms up to the peg, or out
    ctx.strokeStyle = deep
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    if (on) {
      ctx.moveTo(-5, -6)
      ctx.lineTo(-2, -16)
      ctx.moveTo(5, -6)
      ctx.lineTo(2, -16)
    } else {
      ctx.moveTo(-7, -3)
      ctx.lineTo(-12, -9)
      ctx.moveTo(7, -3)
      ctx.lineTo(12, -9)
    }
    ctx.stroke()
    // feet
    ctx.fillStyle = deep
    ctx.beginPath()
    ctx.ellipse(-3.6, 9.4, 3.2, 1.9, 0, 0, TAU)
    ctx.ellipse(3.6, 9.4, 3.2, 1.9, 0, 0, TAU)
    ctx.fill()
    // outline, body, belly shade, shine
    ctx.fillStyle = C.dark ? 'hsla(164, 80%, 76%, 0.9)' : 'hsla(170, 70%, 27%, 0.9)'
    ctx.beginPath()
    ctx.arc(0, 0, 10.6, 0, TAU)
    ctx.fill()
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, 9.6, 0, TAU)
    ctx.fill()
    ctx.fillStyle = look === 'blue' ? mixColor(C.blue, '#0a1a3a', 0.2) : BLIP.shade
    ctx.beginPath()
    ctx.arc(0, 0, 9.6, 0.25, Math.PI - 0.25)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.beginPath()
    ctx.ellipse(-3.4, -5.2, 3.2, 1.6, -0.42, 0, TAU)
    ctx.fill()
    // face
    ctx.fillStyle = BLIP.ink
    const blink = this.time % 3.7 < 0.12
    for (const ex of [-2.6, 2.6]) {
      ctx.beginPath()
      if (blink) ctx.ellipse(ex, 0, 1.4, 0.4, 0, 0, TAU)
      else ctx.ellipse(ex, 0, 1.35, 2.2, 0, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = BLIP.cheek
    ctx.beginPath()
    ctx.ellipse(-5.2, 3.2, 1.5, 0.9, 0, 0, TAU)
    ctx.ellipse(5.2, 3.2, 1.5, 0.9, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = BLIP.ink
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(-1.6, 3.6)
    ctx.quadraticCurveTo(0, 5, 1.6, 3.6)
    ctx.stroke()
    ctx.restore()
    // the spark over his head, upright whatever he's doing
    if (look === 'blip') {
      const sy = py - 17 * k
      const glow = ctx.createRadialGradient(px, sy, 0, px, sy, 6 * k)
      glow.addColorStop(0, C.dark ? 'rgba(159, 247, 226, 0.9)' : 'rgba(52, 198, 168, 0.85)')
      glow.addColorStop(1, 'rgba(52, 198, 168, 0)')
      ctx.globalAlpha = alpha
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(px, sy, 6 * k, 0, TAU)
      ctx.fill()
      ctx.fillStyle = BLIP.spark
      ctx.beginPath()
      ctx.arc(px, sy, 1.8 * k, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  private drawBlip(x: number, y: number, on: boolean, floating: boolean, vx: number, vy: number) {
    this.blipAt(x, y, on, vx, vy, 'blip', floating ? 0.55 : 1)
  }

  private drawGhost(f: SceneFrame) {
    const g = f.ghost!
    const look = f.ghostBlue ? 'blue' : f.ghostMine ? 'mine' : 'ghost'
    this.blipAt(g.x, g.y, !g.flying && !g.floating, 0, 0, look, f.ghostBlue ? 0.5 : 0.85)
    if (f.mode !== 'menu' && f.ghostTag) {
      const { ctx, C } = this
      ctx.font = `700 ${Math.round(10 * this.k)}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = f.ghostBlue ? C.blue : f.ghostMine ? C.mine : C.ghost
      ctx.fillText(f.ghostTag, this.sx(g.x), this.sy(g.y) - 26 * this.k)
    }
  }

  private drawAim(aim: Aim) {
    const { ctx, C } = this
    const k = this.k
    // The flight's start, dotted, fading.
    const n = aim.dots.length / 2
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 1 - i / n
      ctx.fillStyle = aim.pw >= 1 ? C.bad : C.good
      ctx.beginPath()
      ctx.arc(this.sx(aim.dots[i * 2]!), this.sy(aim.dots[i * 2 + 1]!), 2.8 * k, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    // The pull, from where the finger went down to where it is.
    ctx.strokeStyle = C.dark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(26, 43, 60, 0.35)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 5])
    ctx.beginPath()
    ctx.moveTo(aim.fromX, aim.fromY)
    ctx.lineTo(aim.toX, aim.toY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = `700 ${Math.round(Math.max(12, 12 * k))}px ${this.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = aim.pw >= 1 ? C.bad : C.ink
    ctx.fillText(`${Math.round(aim.pw * 100)}%`, aim.toX, aim.toY + 18)
  }

  private drawTrail(dt: number) {
    const { ctx, C } = this
    for (const d of this.trail) d.life -= dt * 2.2
    this.trail = this.trail.filter((d) => d.life > 0).slice(-26)
    for (const d of this.trail) {
      ctx.fillStyle = C.dark ? `rgba(159, 247, 226, ${d.life * 0.45})` : `rgba(31, 155, 132, ${d.life * 0.4})`
      ctx.beginPath()
      ctx.arc(this.sx(d.x), this.sy(d.y), 2.6 * this.k * d.life, 0, TAU)
      ctx.fill()
    }
  }

  private drawBits(dt: number) {
    const { ctx } = this
    for (const b of this.bits) {
      b.life -= dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.vy -= 400 * dt
      ctx.globalAlpha = clamp(b.life * 2, 0, 1)
      ctx.fillStyle = b.color
      ctx.fillRect(this.sx(b.x) - 2, this.sy(b.y) - 2, 4, 4)
    }
    ctx.globalAlpha = 1
    this.bits = this.bits.filter((b) => b.life > 0)
  }

  private drawFloaters(dt: number) {
    const { ctx, C } = this
    for (const f of this.floaters) {
      f.life -= dt * 1.1
      f.y += dt * 40
      ctx.globalAlpha = clamp(f.life * 2, 0, 1)
      ctx.font = `800 ${Math.round(14 * this.k)}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 4
      ctx.strokeStyle = C.paper
      ctx.strokeText(f.text, this.sx(f.x), this.sy(f.y))
      ctx.fillStyle = f.good ? C.good : C.bad
      ctx.fillText(f.text, this.sx(f.x), this.sy(f.y))
    }
    ctx.globalAlpha = 1
    this.floaters = this.floaters.filter((f) => f.life > 0)
  }
}
