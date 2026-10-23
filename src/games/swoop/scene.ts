import { mixColor, withAlpha } from '../../lib/color'
import { isDarkTheme } from '../../lib/theme'
import type { GhostPose } from './runs'
import { SWIFT_BEAK, SWIFT_BELLY, SWIFT_BODY, SWIFT_EYE, SWIFT_LIFT, SWIFT_WING_FOLDED, SWIFT_WING_ROOT, SWIFT_WING_UP, SWIFT_BEAT } from './birdShape'
import { BLIP, BLIP_SPARK_R, blipGlitter, blipSparkOffset, frostColour, frostSparkle, SNOW_SWIFT, skinPainter } from './birdSkins'
import { heightAt, mulberry32, STREAK_ON, streakLift, type Hills } from './sim'

/** How much bigger than the bird's size the swift is drawn in a run. */
const SWIFT_SCALE = 1.2

/** The swift's parts as paths, made once the first bird is drawn (Path2D needs a browser). */
let shape: { body: Path2D; belly: Path2D; beak: Path2D; up: Path2D; folded: Path2D } | null = null
const SHAPE_OF = () =>
  (shape ??= {
    body: new Path2D(SWIFT_BODY),
    belly: new Path2D(SWIFT_BELLY),
    beak: new Path2D(SWIFT_BEAK),
    up: new Path2D(SWIFT_WING_UP),
    folded: new Path2D(SWIFT_WING_FOLDED),
  })

/*
 * Swoop on a 2D canvas: the day's hills from the side, following the bird. The sky follows the site's theme,
 * an afternoon in light and dusk with stars in dark, with two rows of far hills rolling by slower than the
 * near ones. The near hills are washed in the day's colour (sim.ts HILL_HUES): a lit edge along the top, a
 * band of turf under it, and seams of earth further down, one of them a row of dots, the arcade's blips (no
 * stripes: those are Tiny Wings'). The flags split the run; the finish is a chequered banner. Your bird is
 * Swoop's red, or the season skin you chose (birdSkins.ts); the blue bird is the racing dailies' blue, and
 * anyone else's run is a ghost in the skin it was flown in, lighter, or else a ghost's outline, cyan (or amber,
 * your own best), with whose run it is over it.
 *
 * It draws only with fills and strokes, never shadowBlur, so a phone's canvas keeps up.
 */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/**
 * A size for words, in whole pixels. The sizes follow the camera's zoom, which moves a little every frame, and
 * a canvas draws the letters of each new size afresh: at whole pixels it draws them once and reuses them.
 */
const textSize = (px: number) => Math.round(px)

/** Swoop's red, the bird's: the game's accent (data/games.ts). */
const RED = '#e8564f'
const BEAK = '#f5b942'

/** The colours of a frame: the theme's, and the day's hills in their colour. */
type Palette = {
  dark: boolean
  skyTop: string
  skyLow: string
  sun: string
  ink: string
  /** The page behind the ink: text's outline, the flags' numbers. */
  paper: string
  birdLine: string
  blue: string
  ghost: string
  mine: string
  far: string
  mid: string
  body: string
  deep: string
  turf: string
  seam: string
  blip: string
  edge: string
  shine: string
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
    birdLine: dark ? mixColor(RED, '#ffffff', 0.4) : '#1a2b3c',
    blue: dark ? '#4cb8f0' : '#2f8fd6',
    ghost: dark ? '#46e4ff' : '#0f8fb0',
    mine: dark ? '#f5b942' : '#c98a10',
    far: dark ? mixColor(hue, '#1b1745', 0.78) : mixColor(hue, '#d9eefb', 0.72),
    mid: dark ? mixColor(hue, '#141238', 0.62) : mixColor(hue, '#eaf6ee', 0.5),
    body: dark ? mixColor(hue, ground, 0.45) : mixColor(hue, ground, 0.18),
    deep: dark ? mixColor(hue, ground, 0.72) : mixColor(hue, '#1a2b3c', 0.38),
    turf: dark ? mixColor(hue, '#ffffff', 0.12) : mixColor(hue, '#ffffff', 0.42),
    seam: dark ? mixColor(hue, ground, 0.62) : mixColor(hue, '#1a2b3c', 0.22),
    blip: dark ? mixColor(hue, '#ffffff', 0.3) : mixColor(hue, '#ffffff', 0.55),
    edge: dark ? mixColor(hue, '#ffffff', 0.5) : mixColor(hue, '#1a2b3c', 0.45),
    shine: dark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.6)',
    flag: dark ? '#f5b942' : '#e0951a',
    passed: dark ? '#3ecf8e' : '#198a58',
    good: dark ? '#f5b942' : '#b77f0c',
    bad: dark ? '#f07a8a' : '#c93d47',
  }
}

/** What a frame shows: your bird, the run to beat beside it, and the flags passed. */
export type SceneFrame = {
  /** At the start card (the camera rides with the run to beat), flying, or over the line and gliding on. */
  mode: 'menu' | 'play' | 'done'
  bird: { x: number; y: number; vx: number; vy: number; ground: boolean }
  /** Held: the bird's diving, its wings folded. */
  hold: boolean
  /** The last flag passed, −1 before the first. */
  flag: number
  ghost: GhostPose | null
  ghostTag: string
  /** The ghost is your own best: amber, not the others' cyan. */
  ghostMine: boolean
  /** The ghost is the blue bird's run: a blue bird, not a ghost's outline. */
  ghostBlue: boolean
  /** Less motion asked for: no rushing air, and before a run the camera stays at the start. */
  calm: boolean
  /** Your bird's clean landings in a row: from sim.ts STREAK_ON it's on a streak, and glows. */
  streak?: number
  /** The skin your bird wears (birdSkins.ts), if you chose one. */
  skin?: string | null
  /** The skin the ghost's run was flown in: it flies in that, lighter, not as an outline. Never the blue bird's. */
  ghostSkin?: string | null
}

type Bit = { x: number; y: number; vx: number; vy: number; life: number; max: number; spark: boolean }
/** A word over a landing; `row` 1 sits a line above another said at once. */
type Floater = { x: number; y: number; text: string; life: number; good: boolean; row?: number }
/**
 * A dot of the trail behind a bird in the air: gold, laid on a streak; `seed` scatters a snow swift's frost.
 * Blip's carry where his spark was, from the bird's point, in its drawn size (birdSkins.ts blipSparkOffset).
 */
type Dot = { x: number; y: number; life: number; gold: boolean; seed: number; spark?: readonly [number, number] }

/** Where the camera keeps the bird across the screen, and down it. */
const LEAD = 0.32
const LOW = 0.6
/** The seams under the turf: how deep, in metres, and the one that's a row of blips. */
const SEAMS = [4.2, 13.5] as const
/** About how wide a piece of the ground under the hills is filled, in the canvas's own pixels (drawGround). */
const HILL_PIECE = 240
/**
 * The columns the lines along the hills are cut in (drawGround), in the canvas's own pixels: from LINE_NARROWEST
 * to LINE_WIDEST wide, in steps of 4, each piece turning at most LINE_TURN (radians) from the last.
 */
const LINE_NARROWEST = 8
const LINE_WIDEST = 32
const LINE_TURN = 0.07
/**
 * A line's pieces are filled together in runs about this wide, in the canvas's own pixels: one shape a run, the
 * same outline. Each fill costs the graphics process a little, and on a 2x screen a frame had 500 to 1,000 pieces,
 * 6 to 7 ms of an 18 ms frame on Ramsey's laptop. Runs this wide cost about a quarter of that; much wider ones cost
 * more again, as a shape costs by the size of its box.
 */
const LINE_RUN = 256
const BLIPS_AT = 8.6
const BLIP_EVERY = 3.2

export class HillsScene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly hills: Hills
  private readonly font: string
  private W = 0
  private H = 0
  private dpr = 1
  private cam = { x: 0, y: 0, k: 8, snap: true }
  private C: Palette
  private sky: HTMLCanvasElement | null = null
  /** A blip, painted once for its size and colour and stamped along the row (blipStamp). */
  private blip: { key: string; canvas: HTMLCanvasElement; r: number; half: number } | null = null
  private time = 0
  private squash = 0
  private bits: Bit[] = []
  private floaters: Floater[] = []
  private trail: Dot[] = []
  private trailAt = 0
  /** How your bird's last landing went, for a skin whose face shows it (Blip's grin, his wince), for a moment. */
  private mood: { kind: 'happy' | 'ouch'; life: number } | null = null
  /** The run to beat a frame ago, for which way it's headed when the camera rides with it. */
  private lastGhost: { x: number; y: number } | null = null

  constructor(canvas: HTMLCanvasElement, hills: Hills) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Swoop: no 2D canvas')
    this.canvas = canvas
    this.ctx = ctx
    this.hills = hills
    this.C = paletteFor(hills.hue)
    const face = getComputedStyle(canvas).getPropertyValue('--font-display').trim()
    this.font = face || 'system-ui, sans-serif'
  }

  /** The canvas fitted to its box, in CSS pixels. */
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

  /** The theme changed: the sky and the hills' colours follow it. */
  retheme() {
    this.C = paletteFor(this.hills.hue)
    this.sky = null
  }

  /** The camera jumps to the bird at the next frame, rather than gliding there: a new run, or the run to beat round again. */
  snap() {
    this.cam.snap = true
    this.lastGhost = null
    this.bits.length = 0
    this.floaters.length = 0
    this.trail.length = 0
    this.mood = null
  }

  /**
   * Down on the hill: a clean landing sparkles and says so (the one that starts a streak says it's faster now),
   * a thump kicks up dirt, any landing squashes the bird a little.
   */
  landed(kind: 'clean' | 'thump' | 'land', x: number, y: number, vx: number, streak: number) {
    this.mood = kind === 'clean' ? { kind: 'happy', life: 0.8 } : kind === 'thump' ? { kind: 'ouch', life: 0.55 } : null
    if (kind === 'clean') {
      this.squash = 1
      const text = streak === STREAK_ON ? `Clean ×${streak} · faster` : streak > 1 ? `Clean ×${streak}` : 'Clean!'
      this.floaters.push({ x, y, text, life: 1, good: true })
      for (let i = 0, n = streak >= STREAK_ON ? 16 : 10; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 3 + Math.random() * 8
        this.bits.push({ x, y: y + 1, vx: Math.cos(a) * sp + vx * 0.3, vy: Math.abs(Math.sin(a)) * sp, life: 0.6 + Math.random() * 0.4, max: 1, spark: true })
      }
    } else {
      this.squash = kind === 'thump' ? 1.4 : 0.6
      if (kind === 'thump') this.floaters.push({ x, y, text: 'Thump', life: 0.8, good: false })
      for (let i = 0, n = kind === 'thump' ? 12 : 5; i < n; i++) {
        const a = Math.PI * (0.55 + Math.random() * 0.4)
        const sp = 2 + Math.random() * 6
        this.bits.push({ x, y, vx: Math.cos(a) * sp + vx * 0.2, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.3, max: 0.7, spark: false })
      }
    }
  }

  /** A streak ended: the glow goes, and it says so, over the landing's own word if it had one. */
  streakOver(x: number, y: number) {
    this.floaters.push({ x, y, text: 'Streak over', life: 1, good: false, row: 1 })
  }

  frame(f: SceneFrame, dt: number) {
    const { ctx, W, H } = this
    if (W <= 0 || H <= 0) return
    this.time += dt
    const g = f.ghost
    if (f.mode === 'menu') {
      if (f.calm || !g) this.follow(this.hills.xs[1]! + 6, heightAt(this.hills, 6), 8, 0, dt)
      else {
        const last = this.lastGhost
        const vx = last && dt > 0 ? (g.x - last.x) / dt : 8
        const vy = last && dt > 0 ? (g.y - last.y) / dt : 0
        this.follow(g.x, g.y, g.done ? 8 : vx, g.done ? 0 : vy, dt)
      }
    } else this.follow(f.bird.x, f.bird.y, f.bird.vx, f.bird.vy, dt)
    this.lastGhost = g ? { x: g.x, y: g.y } : null

    // A dotted line behind a bird in the air, fading: gold on a streak.
    const lift = f.mode === 'play' ? streakLift(f.streak ?? 0) : 0
    if (f.mode === 'play' && !f.bird.ground) {
      this.trailAt += dt
      // Blip's glitter comes off his spark: where it is this frame, from the bird's point.
      const spark = f.skin === BLIP ? blipSparkOffset(Math.atan2(f.bird.vy, Math.max(0.01, f.bird.vx)), f.hold, this.time) : undefined
      while (this.trailAt > 1 / 40) {
        this.trailAt -= 1 / 40
        this.trail.push({ x: f.bird.x, y: f.bird.y, life: 1, gold: lift > 0, seed: Math.random(), spark })
      }
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (!this.sky) this.paintSky()
    if (this.sky) ctx.drawImage(this.sky, 0, 0, W, H)
    this.drawClouds()
    this.drawFarHills(0.12, this.C.far, 240, 0.55)
    this.drawFarHills(0.3, this.C.mid, 150, 0.68)
    this.drawGround()
    this.drawFlags(f)

    // At the start card a run to beat that's over the line waits unseen; in a run, one over the line has gone on.
    if (g && !g.done) this.drawGhost(g, f)
    this.drawTrail(dt, f.skin)
    if (f.mode !== 'menu' || f.calm || !g) {
      const b = f.mode === 'menu' ? { x: 0, y: heightAt(this.hills, 0), vx: 7, vy: 0, ground: true } : f.bird
      const angle = Math.atan2(b.vy, Math.max(0.01, b.vx))
      if (lift > 0) this.drawGlow(b.x, b.y, angle, this.birdSize(), lift)
      this.drawBird(b.x, b.y, angle, this.birdSize(), RED, {
        flap: this.time * 20,
        folded: b.ground,
        dive: f.mode === 'play' && f.hold,
        squish: this.squash,
        skin: f.skin,
        mood: this.mood?.kind ?? null,
      })
      if (f.mode !== 'menu' && !f.calm) this.drawSpeedLines(Math.hypot(b.vx, b.vy))
    }
    this.squash = Math.max(0, this.squash - dt * 5)
    if (this.mood && (this.mood.life -= dt) <= 0) this.mood = null
    this.drawBits(dt)
    this.drawFloaters(dt)
  }

  dispose() {
    this.bits.length = 0
    this.floaters.length = 0
    this.trail.length = 0
    this.sky = null
    this.blip = null
  }

  /* ---------- the camera ---------- */

  /** Further out the faster the bird goes and the higher it flies, so the next hills are always in view. */
  private follow(x: number, y: number, vx: number, vy: number, dt: number) {
    const { cam, W, H } = this
    const speed = Math.hypot(vx, vy)
    const floor = heightAt(this.hills, x)
    const alt = Math.max(0, y - floor)
    // A tall phone sees less ahead, so it starts closer in and pulls out with speed.
    const tall = H > W
    const wantW = tall ? clamp(44 + speed * 0.95, 44, 110) : clamp(70 + speed * 1.15, 70, 150)
    const wantH = clamp(42 + alt * 1.7 + speed * 0.35, 46, 130)
    const k = Math.min(W / wantW, H / wantH)
    const ty = (y + floor) / 2 + alt * 0.1
    const tx = x + clamp(vx * 0.05, 0, 4)
    if (cam.snap) {
      cam.x = tx
      cam.y = ty
      cam.k = k
      cam.snap = false
      return
    }
    cam.x += (tx - cam.x) * (1 - Math.exp(-dt * 12))
    cam.y += (ty - cam.y) * (1 - Math.exp(-dt * 3.5))
    cam.k += (k - cam.k) * (1 - Math.exp(-dt * 1.6))
  }

  private sx(x: number) {
    return (x - this.cam.x) * this.cam.k + this.W * LEAD
  }

  private sy(y: number) {
    return this.H * LOW - (y - this.cam.y) * this.cam.k
  }

  private wx(px: number) {
    return (px - this.W * LEAD) / this.cam.k + this.cam.x
  }

  /**
   * True to the hills (1.2 m) where it's big enough to see, never under a floor. A tall phone's camera is out so far
   * that 13 px drew the bird twice its size against the hills; 10 px there keeps it about one and a half times.
   */
  private birdSize() {
    return Math.max(this.H > this.W ? 10 : 13, 1.2 * this.cam.k)
  }

  /* ---------- the sky ---------- */

  private paintSky() {
    const { W, H, dpr, C } = this
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(W * dpr))
    c.height = Math.max(1, Math.round(H * dpr))
    const g = c.getContext('2d')
    if (!g) return
    const grad = g.createLinearGradient(0, 0, 0, c.height)
    grad.addColorStop(0, C.skyTop)
    grad.addColorStop(0.75, C.skyLow)
    grad.addColorStop(1, C.skyLow)
    g.fillStyle = grad
    g.fillRect(0, 0, c.width, c.height)
    // Stars at dusk.
    if (C.dark) {
      const rnd = mulberry32(41)
      g.fillStyle = '#ffffff'
      for (let i = 0; i < 140; i++) {
        g.globalAlpha = 0.25 + rnd() * 0.6
        const r = (0.4 + rnd() * 1.2) * dpr
        g.beginPath()
        g.arc(rnd() * c.width, rnd() * c.height * 0.7, r, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
    }
    // The sun, or the moon, with its glow.
    const cx = c.width * 0.78
    const cy = c.height * 0.2
    const r = Math.min(c.width, c.height) * 0.07
    const halo = g.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 3.2)
    halo.addColorStop(0, C.dark ? 'rgba(243, 236, 210, 0.22)' : 'rgba(255, 220, 120, 0.45)')
    halo.addColorStop(1, 'rgba(255, 220, 120, 0)')
    g.fillStyle = halo
    g.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8)
    g.fillStyle = C.sun
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.fill()
    this.sky = c
  }

  /** A few clouds by day, drifting, and sliding by a little with the camera. */
  private drawClouds() {
    const { ctx, C, W, H, cam } = this
    if (C.dark) return
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    for (let i = 0; i < 5; i++) {
      const span = W + 300
      const x = ((((i * 337 - cam.x * cam.k * 0.08 - this.time * 6) % span) + span) % span) - 150
      const y = H * (0.12 + ((i * 53) % 30) / 100)
      const r = 18 + ((i * 29) % 22)
      ctx.beginPath()
      for (const [ox, oy, rx, ry] of [
        [0, 0, 2.2, 0.75],
        [-1.2, 0.15, 1.1, 0.6],
        [1.3, 0.2, 1.2, 0.55],
      ] as const) {
        ctx.moveTo(x + ox * r + rx * r, y + oy * r)
        ctx.ellipse(x + ox * r, y + oy * r, rx * r, ry * r, 0, 0, Math.PI * 2)
      }
      ctx.fill()
    }
  }

  /** Hills far off, rolling past slower than the near ones. */
  private drawFarHills(depth: number, colour: string, scale: number, lift: number) {
    const { ctx, W, H, cam } = this
    ctx.fillStyle = colour
    const shift = cam.x * cam.k * depth
    const xs: number[] = []
    const ys: number[] = []
    for (let px = 0; px <= W + 8; px += 8) {
      const u = (px + shift) / scale
      const h = Math.sin(u) * 0.5 + Math.sin(u * 0.43 + 1.7) * 0.35 + Math.sin(u * 2.1 + 0.4) * 0.12
      xs.push(px)
      ys.push(H * lift - h * H * 0.06 - (cam.y - 40) * cam.k * depth * 0.4)
    }
    this.fillUnder(xs, ys)
  }

  /* ---------- the day's hills ---------- */

  /*
   * Drawn so a laptop's graphics chip keeps up. It fills a shape the slower the more of the screen the shape's box
   * covers: a line along the hills across the whole screen, or the ground under them, was slow, about 13 ms of a
   * 20 ms frame. Now the lines are bands cut in four-cornered pieces (below), and the ground is filled in pieces a
   * few hundred pixels wide, each only down to the lowest point of its line, with a plain block under it.
   */
  private drawGround() {
    const { ctx, C, W, H, cam } = this
    const k = cam.k
    // The surface across the screen, every few pixels.
    const xs: number[] = []
    const ys: number[] = []
    for (let px = -10; px <= W + 10; px += 5) {
      xs.push(px)
      ys.push(this.sy(heightAt(this.hills, this.wx(px))))
    }
    let top = H
    for (const y of ys) top = Math.min(top, y)
    const pieces = this.piecesOf(xs, ys)
    // The body: the day's colour, deepening further down.
    const grad = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, top + 40 * k))
    grad.addColorStop(0, C.body)
    grad.addColorStop(1, C.deep)
    ctx.fillStyle = grad
    for (const p of pieces) this.fillUnder(p.xs, p.ys)
    // The lines along the hills, each a band as thick across the line as a stroke would be, cut in four-cornered
    // pieces a column of the canvas wide. A column is as wide as the hill lets it be, narrow over a tight crest and
    // wide down a slope, turning no more than LINE_TURN from the one before so the bend never shows. The columns
    // meet on whole pixels, and the pieces are filled together in runs about LINE_RUN wide: one shape a run, along
    // its top and back along its bottom, a few dozen fills a frame where each piece was one.
    const { dpr } = this
    const at = (x: number) => {
      const i = clamp(Math.floor((x - xs[0]!) / 5), 0, xs.length - 2)
      return ys[i]! + ((ys[i + 1]! - ys[i]!) * (x - xs[i]!)) / 5
    }
    // How sharply the line bends at sample i, per canvas pixel along it.
    const bend: number[] = ys.map((y, i) => {
      if (i === 0 || i === ys.length - 1) return 0
      const slope = (ys[i + 1]! - ys[i - 1]!) / 10
      return Math.abs(ys[i + 1]! - 2 * y + ys[i - 1]!) / 25 / dpr / (1 + slope * slope) ** 1.5
    })
    const bendOver = (a: number, b: number) => {
      let most = 0
      const i0 = clamp(Math.floor((a - xs[0]!) / 5), 0, xs.length - 1)
      const i1 = clamp(Math.ceil((b - xs[0]!) / 5), 0, xs.length - 1)
      for (let i = i0; i <= i1; i++) most = Math.max(most, bend[i]!)
      return most
    }
    const cols: number[] = []
    const mid: number[] = []
    const across: number[] = []
    const mark = (d: number) => {
      const x = d / dpr
      const slope = (at(x + 2.5) - at(x - 2.5)) / 5
      cols.push(x)
      mid.push(at(x))
      across.push(Math.sqrt(1 + slope * slope) / 2)
    }
    const end = this.canvas.width + LINE_WIDEST
    for (let d = -LINE_WIDEST; ; ) {
      mark(d)
      if (d >= end) break
      let wide = LINE_WIDEST
      while (wide > LINE_NARROWEST && wide * bendOver(d / dpr, (d + wide) / dpr) > LINE_TURN) wide -= 4
      d += wide
    }
    const tall = this.canvas.height / dpr
    const line = (dy: number, colour: string, width: number) => {
      ctx.fillStyle = colour
      // The pieces from column `from` to column `to`, as one shape.
      const run = (from: number, to: number) => {
        ctx.beginPath()
        ctx.moveTo(cols[from]!, mid[from]! + dy - across[from]! * width)
        for (let c = from + 1; c <= to; c++) ctx.lineTo(cols[c]!, mid[c]! + dy - across[c]! * width)
        for (let c = to; c >= from; c--) ctx.lineTo(cols[c]!, mid[c]! + dy + across[c]! * width)
        ctx.closePath()
        ctx.fill()
      }
      let start = -1
      for (let c = 0; c + 1 < cols.length; c++) {
        const a0 = across[c]! * width
        const a1 = across[c + 1]! * width
        const y0 = mid[c]! + dy
        const y1 = mid[c + 1]! + dy
        // A piece off the screen isn't drawn: the run before it ends there.
        if (Math.max(y0 + a0, y1 + a1) < 0 || Math.min(y0 - a0, y1 - a1) > tall) {
          if (start >= 0) run(start, c)
          start = -1
          continue
        }
        if (start < 0) start = c
        if ((cols[c + 1]! - cols[start]!) * dpr >= LINE_RUN) {
          run(start, c + 1)
          start = -1
        }
      }
      if (start >= 0) run(start, cols.length - 1)
    }
    // The turf: a lighter band just under the surface.
    line(Math.max(2, 0.55 * k), C.turf, Math.max(3, 1.1 * k))
    // The seams of earth further down, and between them a row of blips.
    for (const depth of SEAMS) line(depth * k, C.seam, Math.max(1.5, 0.32 * k))
    const r = Math.max(1.4, 0.36 * k)
    const stamp = this.blipStamp(r)
    const half = (stamp.half * r) / stamp.r
    const left = this.wx(-20)
    const right = this.wx(W + 20)
    for (let x = Math.ceil(left / BLIP_EVERY) * BLIP_EVERY; x <= right; x += BLIP_EVERY) {
      ctx.drawImage(stamp.canvas, this.sx(x) - half, this.sy(heightAt(this.hills, x) - BLIPS_AT) - half, half * 2, half * 2)
    }
    // The lit edge along the top, and a line of light just under it.
    line(0, C.edge, Math.max(2.5, 0.42 * k))
    line(Math.max(3, 0.55 * k), C.shine, Math.max(1.5, 0.22 * k))
  }

  /**
   * A line across the screen (points evenly spaced) in pieces about HILL_PIECE pixels wide. They meet at whole
   * pixels, at points on the line itself, so the pieces of ground filled under them fit together without a seam.
   */
  private piecesOf(xs: number[], ys: number[]) {
    const { dpr } = this
    const wide = this.canvas.width
    const count = Math.max(1, Math.round(wide / HILL_PIECE))
    const step = xs[1]! - xs[0]!
    const at = (x: number) => {
      const i = clamp(Math.floor((x - xs[0]!) / step), 0, xs.length - 2)
      return ys[i]! + ((ys[i + 1]! - ys[i]!) * (x - xs[i]!)) / step
    }
    const cuts = [xs[0]!]
    for (let j = 1; j < count; j++) cuts.push(Math.round((j * wide) / count) / dpr)
    cuts.push(xs[xs.length - 1]!)
    const pieces: { xs: number[]; ys: number[] }[] = []
    for (let j = 0; j < count; j++) {
      const a = cuts[j]!
      const b = cuts[j + 1]!
      const px = [a]
      const py = [at(a)]
      for (let i = 0; i < xs.length; i++) {
        if (xs[i]! <= a || xs[i]! >= b) continue
        px.push(xs[i]!)
        py.push(ys[i]!)
      }
      px.push(b)
      py.push(at(b))
      pieces.push({ xs: px, ys: py })
    }
    return pieces
  }

  /**
   * Fills from a line down to the bottom of the canvas: the shape between the line and a whole pixel under its
   * lowest point, then a plain block from there down, which costs next to nothing to fill.
   */
  private fillUnder(xs: number[], ys: number[]) {
    const { ctx, dpr } = this
    const tall = this.canvas.height / dpr
    let low = -Infinity
    for (const y of ys) low = Math.max(low, y)
    const cut = Math.min(tall, Math.ceil(low * dpr) / dpr)
    const a = xs[0]!
    const b = xs[xs.length - 1]!
    ctx.beginPath()
    ctx.moveTo(a, cut)
    for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i]!, ys[i]!)
    ctx.lineTo(b, cut)
    ctx.closePath()
    ctx.fill()
    if (cut < tall) ctx.fillRect(a, cut, b - a, tall - cut)
  }

  /** A blip as a picture, painted again only when its size moves by a quarter of a pixel, and drawn to size between. */
  private blipStamp(r: number) {
    const { dpr, C } = this
    const rs = Math.max(0.25, Math.round(r * dpr * 4) / 4) / dpr
    const key = `${rs}:${dpr}:${C.blip}`
    if (this.blip?.key === key) return this.blip
    const size = Math.ceil((rs + 1) * dpr) * 2
    const canvas = this.blip?.canvas ?? document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const half = size / 2 / dpr
    const g = canvas.getContext('2d')
    if (g) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = C.blip
      g.beginPath()
      g.arc(half, half, rs, 0, Math.PI * 2)
      g.fill()
    }
    this.blip = { key, canvas, r: rs, half }
    return this.blip
  }

  private drawFlags(f: SceneFrame) {
    const { ctx, C, W, cam } = this
    this.hills.flags.forEach((x, i) => {
      const px = this.sx(x)
      if (px < -40 || px > W + 40) return
      const passed = f.mode !== 'menu' && f.flag >= i
      const y = this.sy(heightAt(this.hills, x))
      const pole = Math.max(36, 5.5 * cam.k)
      ctx.strokeStyle = C.ink
      ctx.globalAlpha = 0.7
      ctx.lineWidth = Math.max(2, 0.18 * cam.k)
      ctx.beginPath()
      ctx.moveTo(px, y)
      ctx.lineTo(px, y - pole)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = passed ? C.passed : C.flag
      ctx.beginPath()
      ctx.moveTo(px, y - pole)
      ctx.lineTo(px + pole * 0.5, y - pole * 0.82)
      ctx.lineTo(px, y - pole * 0.64)
      ctx.closePath()
      ctx.fill()
      ctx.font = `800 ${textSize(Math.max(11, pole * 0.22))}px ${this.font}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = C.paper
      ctx.fillText(String(i + 1), px + pole * 0.08, y - pole * 0.82)
    })
    // The finish: a chequered banner on a pole.
    const finish = this.hills.finish
    const fx = this.sx(finish)
    if (fx > -80 && fx < W + 80) {
      const y = this.sy(heightAt(this.hills, finish))
      const tall = Math.max(60, 9 * cam.k)
      const wide = Math.max(10, 1.2 * cam.k)
      ctx.fillStyle = C.ink
      ctx.globalAlpha = 0.8
      ctx.fillRect(fx - wide * 0.15, y - tall, wide * 0.3, tall)
      ctx.globalAlpha = 1
      const cell = tall * 0.12
      for (let r = 0; r < 3; r++) {
        for (let q = 0; q < 2; q++) {
          ctx.fillStyle = (r + q) % 2 === 0 ? C.ink : C.paper
          ctx.fillRect(fx + wide * 0.15 + q * cell, y - tall + r * cell, cell, cell)
        }
      }
      ctx.font = `800 ${textSize(Math.max(12, tall * 0.13))}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = C.ink
      ctx.fillText('FINISH', fx, y - tall - 8)
    }
  }

  /* ---------- birds ---------- */

  /**
   * A bird: a round body leaning along its flight, a tuft on top, a wing that beats in the air and folds in a
   * dive, a beak, an eye that looks where it's going. `ghost` draws the outline only, for a run you race in no skin.
   */
  private drawBird(
    x: number,
    y: number,
    angle: number,
    size: number,
    colour: string,
    {
      flap = 0,
      dive = false,
      folded = false,
      squish = 0,
      alpha = 1,
      ghost = false,
      skin = null,
      mood = null,
    }: {
      flap?: number
      dive?: boolean
      folded?: boolean
      squish?: number
      alpha?: number
      ghost?: boolean
      skin?: string | null
      mood?: 'happy' | 'ouch' | null
    } = {},
  ) {
    const { ctx, C } = this
    const SHAPE = SHAPE_OF()
    // The swift is slimmer than the round bird it took over from, so it's drawn a little bigger to read as big.
    size *= SWIFT_SCALE
    // Sitting on the hill: lifted off the ground along the slope's own up, not straight up the screen.
    const px = this.sx(x) - Math.sin(angle) * size * SWIFT_LIFT
    const py = this.sy(y) - Math.cos(angle) * size * SWIFT_LIFT
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(px, py)
    ctx.rotate(-angle)
    const stretch = dive ? 1.12 : 1
    const sq = 1 - squish * 0.22
    // The swift (birdShape.ts) is drawn in its own unit frame, a unit to the bird's size.
    ctx.scale((size * stretch) / Math.sqrt(sq), (size * sq) / stretch)
    // A skin draws the whole bird itself, in the same frame (birdSkins.ts).
    const paint = ghost ? null : skinPainter(skin)
    if (paint) {
      paint(ctx, { flap, dive, ground: folded, time: this.time, px1: 1 / size, dark: C.dark, mood })
      ctx.restore()
      return
    }
    const line = ghost ? colour : colour === RED ? C.birdLine : C.dark ? mixColor(colour, '#ffffff', 0.4) : '#1a2b3c'
    const px1 = 1 / size
    ctx.lineJoin = 'round'
    ctx.strokeStyle = line
    // Body and tail.
    ctx.lineWidth = Math.max(1.5 * px1, 0.1)
    ctx.fillStyle = ghost ? withAlpha(colour, 0.1) : colour
    ctx.fill(SHAPE.body)
    ctx.stroke(SHAPE.body)
    if (!ghost) {
      // The pale throat and belly.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
      ctx.fill(SHAPE.belly)
    }
    // Beak.
    if (!ghost) {
      ctx.fillStyle = BEAK
      ctx.fill(SHAPE.beak)
    }
    ctx.lineWidth = Math.max(1.2 * px1, 0.07)
    ctx.stroke(SHAPE.beak)
    // Wing: folded along the body in a dive and on the hill, else beating about its root.
    ctx.save()
    if (!dive && !folded) {
      const [rx, ry] = SWIFT_WING_ROOT
      ctx.translate(rx, ry)
      ctx.rotate((0.5 - 0.5 * Math.sin(flap)) * SWIFT_BEAT)
      ctx.translate(-rx, -ry)
    }
    const wing = dive || folded ? SHAPE.folded : SHAPE.up
    ctx.fillStyle = ghost ? withAlpha(colour, 0.08) : mixColor(colour, '#000000', 0.18)
    ctx.lineWidth = Math.max(1.5 * px1, 0.1)
    ctx.fill(wing)
    ctx.stroke(wing)
    ctx.restore()
    // Eye: white with a dark pupil, looking ahead, or down in a dive.
    const e = SWIFT_EYE
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
    ctx.fillStyle = ghost ? withAlpha('#ffffff', 0.5) : '#ffffff'
    ctx.fill()
    ctx.lineWidth = Math.max(px1, 0.05)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(e.px, e.y + (dive ? e.r * 0.35 : 0), e.pr, 0, Math.PI * 2)
    ctx.fillStyle = ghost ? colour : '#1a2b3c'
    ctx.fill()
    ctx.restore()
  }

  /**
   * The run to beat: the blue bird; a ghost in the skin its run was flown in, lighter, as Lander's ghost is its
   * skin's ship at half strength; or a ghost's outline. With whose run it is over it.
   */
  private drawGhost(g: GhostPose, f: SceneFrame) {
    const { ctx, C, cam } = this
    const size = this.birdSize() * 0.92
    const onHill = Math.abs(g.y - heightAt(this.hills, g.x)) < 0.08
    const colour = f.ghostBlue ? C.blue : f.ghostMine ? C.mine : C.ghost
    const menuBird = f.mode === 'menu'
    const skin = !f.ghostBlue && f.ghostSkin && skinPainter(f.ghostSkin) ? f.ghostSkin : null
    this.drawBird(g.x, g.y, g.a, size, colour, {
      flap: this.time * 18,
      folded: onHill,
      dive: g.dive,
      alpha: skin ? (menuBird ? 0.6 : 0.5) : f.ghostBlue ? (menuBird ? 0.9 : 0.6) : menuBird ? 0.95 : 0.85,
      ghost: !f.ghostBlue && !skin,
      skin,
    })
    // Whose run it is, on a dark pill over it.
    const name = f.ghostTag
    if (!name) return
    ctx.save()
    ctx.font = `700 ${textSize(Math.max(11, 0.62 * cam.k))}px ${this.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const tx = this.sx(g.x)
    const ty = this.sy(g.y) - size * 2.5
    const h = Math.max(17, 0.95 * cam.k)
    const w = ctx.measureText(name).width + 14
    ctx.fillStyle = C.dark ? 'rgba(7, 5, 15, 0.75)' : 'rgba(255, 255, 255, 0.85)'
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(tx - w / 2, ty - h, w, h, h / 2)
    else ctx.rect(tx - w / 2, ty - h, w, h)
    ctx.fill()
    ctx.fillStyle = colour
    ctx.fillText(name, tx, ty - Math.max(2, 0.1 * cam.k))
    ctx.restore()
  }

  /* ---------- trails, bits, words, rushing air ---------- */

  /**
   * The dots behind your bird; a snow swift leaves frost instead, twinkling, scattered a little; Blip's spark a
   * short wake of glitter, tiny blips that twinkle, drift down and go.
   */
  private drawTrail(dt: number, skin: string | null | undefined) {
    const { ctx, C, cam, trail } = this
    const frost = skin === SNOW_SWIFT
    const blip = skin === BLIP
    if (!trail.length) return
    const lift = this.birdSize() * SWIFT_LIFT
    const plain = C.dark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(26, 43, 60, 0.35)'
    const r = Math.max(1.2, 0.18 * cam.k)
    // The bird as drawBird draws it, for where Blip's spark was.
    const size = this.birdSize() * SWIFT_SCALE
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i]!
      p.life -= dt * 0.9
      if (p.life <= 0) {
        trail.splice(i, 1)
        continue
      }
      if (blip && p.spark && !p.gold) {
        // Most of the dots, each gone in a little over half a second: a short wake, not a line.
        const young = (p.life - 0.4) / 0.6
        if (young <= 0 || p.seed < 0.3) continue
        const twinkle = 0.7 + 0.3 * Math.sin(this.time * 13 + p.seed * 40)
        const scatter = ((p.seed * 9.7) % 1) - 0.5
        ctx.globalAlpha = Math.min(1, young * 1.4)
        blipGlitter(
          ctx,
          this.sx(p.x) + p.spark[0] * size + (p.seed - 0.65) * 0.5 * size,
          this.sy(p.y) + p.spark[1] * size + scatter * 0.5 * size + (1 - young) * 0.35 * size,
          BLIP_SPARK_R * size * (0.45 + 0.55 * p.seed) * twinkle * (0.6 + 0.4 * young),
          C.dark,
        )
        continue
      }
      if (frost && !p.gold) {
        // About half the dots, so it reads as sparkles, not a line.
        if (p.seed < 0.5) continue
        const twinkle = 0.65 + 0.35 * Math.sin(this.time * 14 + p.seed * 40)
        ctx.globalAlpha = p.life * 0.95
        ctx.fillStyle = frostColour(C.dark)
        const s = r * (1.4 + p.seed * 1.6) * twinkle * (0.6 + 0.4 * p.life)
        frostSparkle(ctx, this.sx(p.x), this.sy(p.y) - lift + (p.seed - 0.75) * 4 * r, s)
        continue
      }
      ctx.globalAlpha = p.life * (p.gold ? 0.95 : 0.8)
      ctx.fillStyle = p.gold ? BEAK : plain
      ctx.beginPath()
      ctx.arc(this.sx(p.x), this.sy(p.y) - lift, p.gold ? r * 1.4 : r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /**
   * A bird on a streak glows: rings of the beak's gold behind it, breathing, brighter the further the streak
   * has moved the wall of wind up (`lift`, 0 to 1). Fills only, like everything here.
   */
  private drawGlow(x: number, y: number, angle: number, size: number, lift: number) {
    const { ctx } = this
    const px = this.sx(x) - Math.sin(angle) * size * SWIFT_LIFT
    const py = this.sy(y) - Math.cos(angle) * size * SWIFT_LIFT
    const breath = 0.5 + 0.5 * Math.sin(this.time * 8)
    ctx.fillStyle = BEAK
    for (let i = 3; i >= 1; i--) {
      ctx.globalAlpha = (0.17 + 0.13 * lift) * (1.2 - i * 0.3) * (0.75 + 0.25 * breath)
      ctx.beginPath()
      ctx.arc(px, py, size * (1.15 + i * (0.35 + 0.15 * lift) + 0.12 * breath), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawBits(dt: number) {
    const { ctx, C, cam, bits } = this
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]!
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.vy -= 22 * dt
      b.life -= dt
      if (b.life <= 0) {
        bits.splice(i, 1)
        continue
      }
      ctx.globalAlpha = clamp(b.life / b.max, 0, 1)
      ctx.fillStyle = b.spark ? BEAK : C.turf
      const r = Math.max(1.5, (b.spark ? 0.22 : 0.32) * cam.k)
      const px = this.sx(b.x)
      const py = this.sy(b.y)
      ctx.beginPath()
      if (b.spark) {
        ctx.moveTo(px, py - r * 1.6)
        ctx.lineTo(px + r * 0.5, py)
        ctx.lineTo(px, py + r * 1.6)
        ctx.lineTo(px - r * 0.5, py)
      } else ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawFloaters(dt: number) {
    const { ctx, C, cam, floaters } = this
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]!
      f.life -= dt * 1.1
      if (f.life <= 0) {
        floaters.splice(i, 1)
        continue
      }
      const t = 1 - f.life
      ctx.globalAlpha = clamp(f.life * 2, 0, 1)
      const size = textSize(Math.max(16, 1.6 * cam.k))
      ctx.font = `800 ${size}px ${this.font}`
      ctx.lineWidth = size * 0.28
      ctx.strokeStyle = C.paper
      const px = this.sx(f.x)
      const py = this.sy(f.y) - this.birdSize() * 2.6 - t * 40 - (f.row ?? 0) * size * 1.15
      ctx.strokeText(f.text, px, py)
      ctx.fillStyle = f.good ? C.good : C.bad
      ctx.fillText(f.text, px, py)
    }
    ctx.globalAlpha = 1
  }

  /** Lines of rushing air across the screen once the bird is really moving. */
  private drawSpeedLines(speed: number) {
    const { ctx, C, W, H } = this
    if (speed < 42) return
    const f = clamp((speed - 42) / 25, 0, 1)
    ctx.strokeStyle = C.dark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 2
    for (let i = 0; i < 7; i++) {
      const y = H * ((i * 0.137 + 0.08) % 0.85)
      const len = 40 + f * 90
      const x = W - ((this.time * (900 + i * 130) + i * 211) % (W + len * 2))
      ctx.globalAlpha = f * 0.6
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + len, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}
