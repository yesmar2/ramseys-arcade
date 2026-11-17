import { withAlpha } from '../../lib/color'
import { keptEpoch } from '../keptPictures'
import { SWIFT_LIFT } from './birdShape'
import { AURORA_PHOENIX, BLIP, blipSparkOffset, PENGUIN, skinPainter, SNOW_SWIFT } from './birdSkins'
import { Flock, FLOCK_HUES, GOLD } from './flock'
import type { GoldenHill } from './golden'
import { BEAK, BLIP_EVERY, BLIPS_AT, clamp, HillsScene, LINE_NARROWEST, LINE_RUN, LINE_TURN, LINE_WIDEST, RED, SEAMS, SWIFT_SCALE, textSize, type SceneFrame } from './scene'
import { heightAt, mulberry32, slopeAt, STREAK_ON, streakLift, type Hills } from './sim'
import { BIRD_DESIGNS, type BirdDesignKey } from './birdDesigns'
import { paintBird, swiftColours, type SwiftColours, type SwiftStyle } from './swiftPaint'
import { DECO, decoBox, decoLook, DecoPictures, isSprig, layBuried, layDecos, type Deco } from './vistaProps'
import {
  CLOUD_SIZE,
  LAP,
  cloudSheet,
  farClouds,
  layClouds,
  moodFor,
  picture,
  rangeLooks,
  rangePicture,
  skyPicture,
  type Cloud,
  type CloudSheet,
  type Mood,
  type Picture,
  type RangeLook,
} from './vistaSky'

/*
 * Swoop's look on test: the same hills, the same bird and the same run, drawn as a place. Ramsey, 2026-11-17:
 * "can you try redesigning the swoop game with better graphics and maybe somethign to make it a little more
 * addicting/fun? it's fun already in my opinion and there are other games out there like it, just need
 * something to set it apart". It's on only where it's been asked for (newLook.ts); everywhere else Swoop is
 * drawn by scene.ts, as it was.
 *
 * What's new to look at:
 * - A sky of the day's own (vistaSky.ts): a golden afternoon, a clear noon or a misty morning in the light
 *   theme; dusk, a full moon or the northern lights in the dark one. Clouds in two rows, and three ranges of
 *   far country, mountains to wooded hills, sliding by slower the further off.
 * - The day's hills lit from the sun's side: the slopes that run down ahead of the bird, the ones to dive on
 *   and to land on, are in the light, and the climbs are in shade, so the hill itself says which is which.
 *   Trees, bushes, grass and flowers stand along them (vistaProps.ts) and bend as the bird goes by.
 * - The bird's shadow on the hill under it, which shows how high it is and where it's coming down.
 * - A ribbon behind a bird in the air in place of the dots, dust and petals where it lands, a ring of light
 *   under a clean landing, flags that fly, bunting at the line and confetti over it.
 *
 * And what's new to play for: the flock (flock.ts). Every clean landing in a row, another little swift falls
 * in behind yours; a bad one scatters them. It's the streak the game always had, and the speed it always gave,
 * made into something you can see growing and can lose. And the day's three golden birds (golden.ts), each
 * sitting on a hill of its own, its slope edged in gold: land clean on that hill and it flies with you to the
 * line, whatever becomes of the rest.
 *
 * It's this scene's parent with its drawing swapped: the camera, the birds, their skins and the ghost are
 * scene.ts's own. Like it, nothing here uses shadowBlur, and what would be a wide shape to fill every frame is
 * a picture painted once instead (scene.ts drawGround's notes on what a laptop's graphics chip charges for).
 */

const TAU = Math.PI * 2

/** The near row of clouds: how much slower than the hills it slides, and how fast it drifts by itself, pixels a second. */
const CLOUDS_NEAR = { depth: 0.07, drift: 6 }
const RANGE_DEPTH = [0.045, 0.11, 0.24] as const
/** Each range's ridge: how tall it stands, and how far down the screen its valleys lie. */
const RANGE_AMP = [0.27, 0.09, 0.085] as const
const RANGE_FOOT = [0.5, 0.585, 0.665] as const
/**
 * How far under its valleys a range's picture goes on, as a share of the screen's height: the two far ones only
 * until the next one covers them, and the nearest further, with the rest filled plain under it. Every picture a
 * frame copies is charged by its size, so none is taller than what shows.
 */
const RANGE_UNDER = [0.15, 0.145, 0.1] as const
/**
 * How far down the screen the sky is drawn: under that the far ranges always cover it (the second one's valleys
 * lie above it, and it never sinks further than SINK_MOST), so a third of the sky's picture is never copied.
 */
const SKY_DOWN = 0.7
const SINK_MOST = 0.04
/** How finely each is painted, in canvas pixels to a screen pixel at most: far things are soft, and big pictures are dear to keep. */
const RANGE_RES = [1, 1.25, 1.5] as const
/** A slope this steep on the screen is fully in the light, or the shade. */
const FULL_SLOPE = 0.45
/** How deep the light and the shade lie on a slope, in metres. */
const LIGHT_DEEP = 3
/** How long the ribbon behind a bird in the air is, in seconds of its flight, and how wide at the bird, in metres. */
const RIBBON = 0.5
const RIBBON_WIDE = 0.42
/** How much bigger than life the grass and the flowers are drawn: storybook size, so they're seen from the air. */
const SPRIG = 1.5
/**
 * How the birds are outlined (swiftPaint.ts has the three ways): in a deeper shade of their own colour. Nothing
 * else in this look has the site's dark line round it, and at the bird's size in a run a line of its own colour
 * still marks it off from the hills, by day and by night, where no line at all leaves the flock as blobs. By
 * night the dark line turns pale, as scene.ts has it, and reads as a glow round the bird.
 */
const BIRD_STYLE: SwiftStyle = 'soft'
/** Which bird is flown (birdDesigns.ts): the swift he picked, until he picks another. */
const BIRD_DESIGN: BirdDesignKey = 'swift'
/** How a bird is posed and shown, as scene.ts drawBird takes it. */
type BirdShown = {
  flap?: number
  dive?: boolean
  folded?: boolean
  squish?: number
  alpha?: number
  ghost?: boolean
  skin?: string | null
  mood?: 'happy' | 'ouch' | null
}
/** How long a thump shakes the view, in seconds, and how far, in metres. */
const SHAKE = 0.3
const SHAKE_FAR = 0.42

type Backdrop = {
  key: string
  /** The sky, with the far row of clouds painted into it: they're too far off to be seen to move. */
  sky: Picture
  /** The near row of clouds: their shapes on a sheet, where each is along a row `cloudsLong` long, to be stamped. */
  cloudSheet: CloudSheet
  clouds: Cloud[]
  cloudsLong: number
  ranges: [Picture, Picture, Picture]
  /** The colour at the foot of the nearest range's picture: what's filled under it, down to the bottom. */
  foot: string
  /** A soft dot, for what glows: a firefly, the light round a bird on a streak. */
  glow: Picture
  mote: Picture
}

/** A bit of something thrown up by a landing, or over the line. In metres and metres a second, y up. */
type Spark = {
  kind: 'spark' | 'dust' | 'petal' | 'ring' | 'confetti'
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  colour: string
  turn: number
  spin: number
}

/** A word over a landing, as a picture, so it can pop without its letters being drawn afresh every frame. */
type Label = { x: number; y: number; pic: Picture; life: number; row: number }

/** Where the bird was, for the ribbon: when, and how much it was in the air. */
type Trace = { x: number; y: number; t: number; air: boolean }

export class VistaScene extends HillsScene {
  private sight: Mood
  private far: [RangeLook, RangeLook, RangeLook]
  private readonly decos: Deco[]
  private readonly buried: Deco[]
  private readonly decoPics: DecoPictures
  /** The sheet of pictures this frame's plants and stones come off (vistaProps.ts DecoPictures): one for them all. */
  private decoLevel = 0
  private lookKey: string
  private readonly flock = new Flock()
  /** The day's golden birds' hills (golden.ts), and which of them this run has caught. */
  private golden: GoldenHill[] = []
  private caught: boolean[] = []
  /** How the birds are outlined, and which bird they are: as chosen above, unless a picture of the choices sets another to show it. */
  birdStyle: SwiftStyle = BIRD_STYLE
  birdDesign: BirdDesignKey = BIRD_DESIGN
  private swifts = new Map<string, SwiftColours>()
  private back: Backdrop | null = null
  /** When the canvas last changed size, by the page's clock: the backdrop is painted again once it has stopped changing. */
  private sizedAt = -Infinity
  /** How far the camera has gone, in screen pixels at the zoom it had as it went: what the far country slides by. */
  private scroll = 0
  private lastCamX: number | null = null
  private readonly home: number
  private sparks: Spark[] = []
  private labels: Label[] = []
  private labelPics = new Map<string, Picture>()
  private trace: Trace[] = []
  private shake = 0
  private lastMode: SceneFrame['mode'] = 'menu'
  private lastBird = { x: 0, y: 0 }
  private readonly motes: { u: number; v: number; depth: number; phase: number; size: number }[]

  constructor(canvas: HTMLCanvasElement, hills: Hills) {
    super(canvas, hills)
    this.sight = moodFor(hills.n, this.C.dark)
    this.far = rangeLooks(this.sight, hills.hue)
    this.lookKey = `${hills.hue}|${this.C.dark}`
    this.decos = layDecos(hills)
    this.buried = layBuried(hills)
    this.decoPics = new DecoPictures(decoLook(hills.hue, this.C.dark), this.lookKey)
    this.home = heightAt(hills, 0)
    const rnd = mulberry32(977 + hills.n)
    this.motes = Array.from({ length: 10 }, () => ({ u: rnd(), v: 0.06 + rnd() * 0.5, depth: 1.25 + rnd() * 0.7, phase: rnd() * TAU, size: 0.6 + rnd() * 0.8 }))
  }

  resize(w: number, h: number) {
    const before = `${this.W}|${this.H}|${this.dpr}`
    super.resize(w, h)
    if (before !== `${this.W}|${this.H}|${this.dpr}`) this.sizedAt = performance.now()
  }

  retheme() {
    super.retheme()
    this.sight = moodFor(this.hills.n, this.C.dark)
    this.far = rangeLooks(this.sight, this.hills.hue)
    this.lookKey = `${this.hills.hue}|${this.C.dark}`
    this.decoPics.relook(decoLook(this.hills.hue, this.C.dark), this.lookKey)
    this.back = null
    this.labelPics.clear()
    this.swifts.clear()
  }

  snap() {
    super.snap()
    this.flock.reset()
    this.sparks.length = 0
    this.labels.length = 0
    this.trace.length = 0
    this.lastCamX = null
    this.shake = 0
    this.caught.fill(false)
  }

  dispose() {
    super.dispose()
    this.flock.dispose()
    this.decoPics.clear()
    this.back = null
    this.labelPics.clear()
    this.sparks.length = 0
    this.labels.length = 0
    this.trace.length = 0
  }

  /* ---------- what the game tells it ---------- */

  /**
   * Down on the hill. A clean landing lights a ring under the bird, throws up sparks and petals and says so
   * (`flush` for one that came down right along the slope: "Perfect"); a thump kicks up dust and turf and
   * shakes the view; any landing squashes the bird a little.
   */
  landed(kind: 'clean' | 'thump' | 'land', x: number, y: number, vx: number, streak: number, flush = false) {
    this.mood = kind === 'clean' ? { kind: 'happy', life: 0.8 } : kind === 'thump' ? { kind: 'ouch', life: 0.55 } : null
    const C = this.C
    if (kind === 'clean') {
      this.squash = 1
      const word = flush ? 'Perfect' : 'Clean'
      const text = streak === STREAK_ON ? `${word} ×${streak} · faster` : streak > 1 ? `${word} ×${streak}` : `${word}!`
      this.say(x, y, text, true)
      this.sparks.push({ kind: 'ring', x, y: y + 0.3, vx: vx * 0.25, vy: 0, life: 0.45, max: 0.45, size: flush ? 4.4 : 3.2, colour: flush ? '#ffffff' : BEAK, turn: 0, spin: 0 })
      for (let i = 0, n = (streak >= STREAK_ON ? 12 : 8) + (flush ? 5 : 0); i < n; i++) {
        const a = Math.random() * Math.PI
        const sp = 4 + Math.random() * 9
        this.sparks.push({
          kind: 'spark',
          x,
          y: y + 0.6,
          vx: Math.cos(a) * sp + vx * 0.32,
          vy: Math.sin(a) * sp,
          life: 0.5 + Math.random() * 0.4,
          max: 0.9,
          size: 0.2 + Math.random() * 0.14,
          colour: flush && i % 3 === 0 ? '#ffffff' : BEAK,
          turn: 0,
          spin: 0,
        })
      }
      // Petals off the flowers it came down among.
      const petals = ['#ffffff', '#ffd76a', '#ff9ec0', '#b79bff']
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.18 + Math.random() * 0.5)
        const sp = 3 + Math.random() * 7
        this.sparks.push({
          kind: 'petal',
          x: x + (Math.random() - 0.5) * 1.6,
          y: y + 0.4,
          vx: Math.cos(a) * sp + vx * 0.45,
          vy: Math.sin(a) * sp,
          life: 0.8 + Math.random() * 0.5,
          max: 1.3,
          size: 0.2 + Math.random() * 0.12,
          colour: petals[i % petals.length]!,
          turn: Math.random() * TAU,
          spin: (Math.random() - 0.5) * 14,
        })
      }
      return
    }
    this.squash = kind === 'thump' ? 1.4 : 0.6
    if (kind === 'thump') {
      this.say(x, y, 'Thump', false)
      this.shake = SHAKE
    }
    for (let i = 0, n = kind === 'thump' ? 9 : 4; i < n; i++) {
      const a = Math.PI * (0.5 + Math.random() * 0.45)
      const sp = 1.5 + Math.random() * 5
      this.sparks.push({
        kind: 'dust',
        x: x + (Math.random() - 0.5) * 1.2,
        y: y + 0.2,
        vx: Math.cos(a) * sp + vx * 0.25,
        vy: Math.sin(a) * sp,
        life: 0.45 + Math.random() * 0.35,
        max: 0.8,
        size: 0.5 + Math.random() * 0.5,
        colour: C.turf,
        turn: 0,
        spin: 0,
      })
    }
    if (kind !== 'thump') return
    // Turf, torn up.
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.3 + Math.random() * 0.5)
      const sp = 4 + Math.random() * 8
      this.sparks.push({
        kind: 'petal',
        x,
        y: y + 0.3,
        vx: Math.cos(a) * sp + vx * 0.3,
        vy: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.4,
        max: 1,
        size: 0.26 + Math.random() * 0.16,
        colour: i % 2 ? C.edge : C.turf,
        turn: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 18,
      })
    }
  }

  /** A streak ended: the flock goes (it sees that for itself, from the streak), and it says so. */
  streakOver(x: number, y: number) {
    this.say(x, y, 'Flock scattered', false, 1)
  }

  /** The day's golden birds: the hills they sit on. All are back on their hills at every start (snap). */
  setGolden(hills: GoldenHill[]) {
    this.golden = hills
    this.caught = hills.map(() => false)
  }

  /** A golden bird caught, by a clean landing on its hill: it leaves the hill for the front of the flock, and it says so. */
  goldenCaught(i: number) {
    const hill = this.golden[i]
    if (!hill || this.caught[i]) return
    this.caught[i] = true
    this.flock.gild(hill.x, hill.y + 0.8)
    const have = this.caught.filter(Boolean).length
    const all = this.golden.length
    this.say(this.lastBird.x, this.lastBird.y, have < all ? `Golden bird · ${have} of ${all}` : all === 3 ? 'All three golden birds!' : `All ${all} golden birds!`, true, 1)
    this.sparks.push({ kind: 'ring', x: hill.x, y: hill.y + 0.3, vx: 0, vy: 0, life: 0.6, max: 0.6, size: 5, colour: GOLD, turn: 0, spin: 0 })
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI
      const sp = 4 + Math.random() * 8
      this.sparks.push({ kind: 'spark', x: hill.x, y: hill.y + 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.5, max: 1.1, size: 0.22 + Math.random() * 0.14, colour: k % 3 ? GOLD : '#ffffff', turn: 0, spin: 0 })
    }
  }

  /** A word over your bird that isn't about a landing: it has gone by the run it's racing, or been gone by. */
  told(text: string, good: boolean) {
    this.say(this.lastBird.x, this.lastBird.y, text, good, 2)
  }

  /* ---------- a frame ---------- */

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
    if (this.lastCamX != null) this.scroll += (this.cam.x - this.lastCamX) * this.cam.k
    this.lastCamX = this.cam.x

    const flying = f.mode !== 'menu'
    const speed = Math.hypot(f.bird.vx, f.bird.vy)
    const lift = flying ? streakLift(f.streak ?? 0) : 0
    // Over the line: confetti, once.
    if (f.mode === 'done' && this.lastMode === 'play') this.cheer()
    this.lastMode = f.mode
    if (flying) {
      this.lastBird = { x: f.bird.x, y: f.bird.y }
      this.flock.lead(f.bird.x, f.bird.y, f.hold)
      this.flock.keep(f.streak ?? 0, f.bird.vx, f.bird.vy)
      this.flock.update(dt, speed, (x) => heightAt(this.hills, x), this.birdSize() / this.cam.k, f.bird.y - heightAt(this.hills, f.bird.x))
      if (dt > 0) {
        this.trace.push({ x: f.bird.x, y: f.bird.y, t: this.time, air: f.mode === 'play' && !f.bird.ground })
        while (this.trace.length > 2 && this.time - this.trace[0]!.t > RIBBON) this.trace.shift()
      }
    } else {
      if (this.flock.size) this.flock.reset()
      this.trace.length = 0
    }

    // The snow swift's frost and Blip's glitter are their own (scene.ts drawTrail); every other bird has the ribbon.
    const ownTrail = f.skin === SNOW_SWIFT || f.skin === BLIP
    if (ownTrail && f.mode === 'play' && !f.bird.ground) {
      this.trailAt += dt
      const spark = f.skin === BLIP ? blipSparkOffset(Math.atan2(f.bird.vy, Math.max(0.01, f.bird.vx)), f.hold, this.time) : undefined
      while (this.trailAt > 1 / 40) {
        this.trailAt -= 1 / 40
        this.trail.push({ x: f.bird.x, y: f.bird.y, life: 1, gold: lift > 0, seed: Math.random(), spark })
      }
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.drawBackdrop(f.calm)

    // A thump shakes the hills and all that's on them, never the far country: the camera, moved for the frame.
    const camX = this.cam.x
    const camY = this.cam.y
    if (this.shake > 0 && !f.calm) {
      const left = (this.shake / SHAKE) ** 2
      this.cam.x += Math.sin(this.time * 83) * SHAKE_FAR * left
      this.cam.y += Math.abs(Math.sin(this.time * 61)) * SHAKE_FAR * left
    }
    this.shake = Math.max(0, this.shake - dt)

    this.drawDecos(f, flying ? speed : 0)
    this.drawCourse()
    this.drawBanners(f)
    this.drawGolden(f.calm)

    const showBird = f.mode !== 'menu' || f.calm || !g
    const b = f.mode === 'menu' ? { x: 0, y: heightAt(this.hills, 0), vx: 7, vy: 0, ground: true } : f.bird
    if (showBird) this.drawShadow(b.x, b.y)
    // At the start card a run to beat that's over the line waits unseen; in a run, one over the line has gone on.
    if (g && !g.done) this.drawGhost(g, f)
    if (ownTrail) this.drawTrail(dt, f.skin)
    else this.drawRibbon(f.skin, lift)
    this.flock.draw(
      ctx,
      (x) => this.sx(x),
      (y) => this.sy(y),
      this.birdSize(),
      SWIFT_SCALE,
      this.dpr,
      this.time,
      this.C.dark,
      this.styleOf(),
      BIRD_DESIGNS[this.birdDesign],
    )
    if (showBird) {
      const angle = Math.atan2(b.vy, Math.max(0.01, b.vx))
      if (lift > 0) this.drawHalo(b.x, b.y, angle, lift)
      this.drawBird(b.x, b.y, angle, this.birdSize(), RED, {
        flap: this.time * 20,
        folded: b.ground,
        dive: f.mode === 'play' && f.hold,
        squish: this.squash,
        skin: f.skin,
        mood: this.mood?.kind ?? null,
      })
    }
    this.squash = Math.max(0, this.squash - dt * 5)
    if (this.mood && (this.mood.life -= dt) <= 0) this.mood = null
    this.drawSparks(dt)
    this.cam.x = camX
    this.cam.y = camY

    if (f.mode === 'play' && !f.calm) this.drawWind(f.bird.vx, f.bird.vy, lift)
    if (!f.calm) this.drawMotes()
    this.drawLabels(dt)
  }

  /* ---------- the sky and the far country ---------- */

  /** The pictures behind the hills, painted when they're first wanted and again when the canvas, the theme or the chip's memory has changed. */
  private backdrop(): Backdrop {
    const { W, H, dpr, sight } = this
    const key = `${W}|${H}|${dpr}|${sight.key}|${this.hills.hue}|${keptEpoch()}`
    // While the window is being dragged to a new size, the old pictures do: painting them afresh every frame would stall it.
    if (this.back && (this.back.key === key || performance.now() - this.sizedAt < 250)) return this.back
    const rnd = mulberry32(4129 + this.hills.n * 7)
    const V = Math.min(H, W * 1.1)
    // Each row a little longer than the screen is wide, and no two the same length, so they never line up twice.
    const P = Math.max(900, Math.ceil(W * 1.45))
    const res = (most: number) => Math.min(dpr, most)
    const ranges = [0, 1, 2].map((tier) => {
      const amp = RANGE_AMP[tier]! * V
      return rangePicture(Math.round(P * (1 + tier * 0.17)), Math.ceil(amp + H * RANGE_UNDER[tier]!), res(RANGE_RES[tier]!), tier as 0 | 1 | 2, this.far[tier]!, sight, rnd, amp)
    }) as [Picture, Picture, Picture]
    const glowAt = (colour: string, size: number) =>
      picture(size, size, dpr, (g) => {
        const fade = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
        fade.addColorStop(0, withAlpha(colour, 0.95))
        fade.addColorStop(0.35, withAlpha(colour, 0.4))
        fade.addColorStop(1, withAlpha(colour, 0))
        g.fillStyle = fade
        g.fillRect(0, 0, size, size)
      })
    const sky = skyPicture(W, H, dpr, sight, rnd)
    const far = farClouds(W, Math.ceil(H * 0.44), res(1), sight, rnd, V)
    sky.canvas.getContext('2d')?.drawImage(far.canvas, 0, H * 0.03, far.w, far.h)
    this.back = {
      key,
      sky,
      cloudSheet: cloudSheet(sight, CLOUD_SIZE * V, res(1.25)),
      clouds: layClouds(Math.round(P * 1.27), H, sight, rnd),
      cloudsLong: Math.round(P * 1.27),
      ranges,
      foot: this.far[2].foot,
      glow: glowAt(BEAK, 64),
      mote: glowAt(sight.mote.colour, 32),
    }
    return this.back
  }

  /**
   * A range slid to where the camera has it, as many times across as the screen is wide, each copy lapping the
   * next (vistaSky.ts LAP); `foot` fills under it to the bottom.
   */
  private slide(pic: Picture, depth: number, top: number, foot?: string) {
    const { ctx, W, H } = this
    const P = pic.w - LAP
    const along = this.scroll * depth
    for (let x = -(((along % P) + P) % P); x < W; x += P) ctx.drawImage(pic.canvas, x, top, pic.w, pic.h)
    if (foot && top + pic.h < H) {
      ctx.fillStyle = foot
      ctx.fillRect(0, top + pic.h - 1, W, H - top - pic.h + 1)
    }
  }

  private drawBackdrop(calm: boolean) {
    const { ctx, W, H, cam } = this
    const B = this.backdrop()
    // The sky, as far down as it's ever seen.
    const sky = B.sky.canvas
    const down = Math.ceil(sky.height * SKY_DOWN)
    ctx.drawImage(sky, 0, 0, sky.width, down, 0, 0, W, (down / sky.height) * H)
    const V = Math.min(H, W * 1.1)
    // As the camera climbs with a high flight the far country sinks a little, the nearer the more.
    const sink = (depth: number) => clamp((cam.y - this.home) * cam.k * depth * 0.4, -H * SINK_MOST, H * SINK_MOST)
    const drift = calm ? 0 : 1
    for (let tier = 0; tier < 3; tier++) {
      if (tier === 1) this.stampClouds(B, drift)
      const top = H * RANGE_FOOT[tier]! - RANGE_AMP[tier]! * V - 3 + sink(RANGE_DEPTH[tier]!)
      // Only the nearest is filled under: the others end behind the one before them.
      this.slide(B.ranges[tier]!, RANGE_DEPTH[tier]!, top, tier === 2 ? B.foot : undefined)
    }
  }

  /** The near row of clouds, before the mountains and behind the wooded hills: each stamped where it has slid and drifted to. */
  private stampClouds(B: Backdrop, drift: number) {
    const { ctx, W, sight } = this
    const { cloudSheet: sheet, cloudsLong: P } = B
    const along = this.scroll * CLOUDS_NEAR.depth + this.time * CLOUDS_NEAR.drift * drift
    ctx.globalAlpha = sight.cloud.near
    for (const cloud of B.clouds) {
      const cell = sheet.cells[cloud.kind % sheet.cells.length]!
      const w = (cell.w / sheet.res) * cloud.s
      const h = (cell.h / sheet.res) * cloud.s
      const ax = cell.ax * cloud.s
      // Round the row: the first time it comes on from the right, and again every row's length after.
      const x = ((((cloud.x - along) % P) + P) % P) - ax
      for (let at = x - P; at < W; at += P) {
        if (at + w > 0) ctx.drawImage(sheet.canvas, cell.x, cell.y, cell.w, cell.h, at, cloud.y - cell.ay * cloud.s, w, h)
      }
    }
    ctx.globalAlpha = 1
  }

  /* ---------- what stands on the hills ---------- */

  /**
   * The trees, bushes, grass and flowers in view, each stamped where it stands, its foot under the hill's edge
   * (the ground is drawn after, over their feet). They sway a little, and lean with the rush of air as the bird
   * goes by low: the faster, the further.
   */
  private drawDecos(f: SceneFrame, speed: number) {
    const { ctx, W, cam, dpr, decos } = this
    const k = cam.k
    const left = this.wx(-90)
    const right = this.wx(W + 90)
    let lo = 0
    let hi = decos.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (decos[mid]!.x < left) lo = mid + 1
      else hi = mid
    }
    // Grass and flowers keep a size you can see when the camera's far out, as the bird does.
    const sprigK = Math.max(k, 6.5 * this.fit) * SPRIG
    // Fine enough for the biggest of them, and the same sheet for all.
    const level = (this.decoLevel = this.decoPics.level(Math.max(sprigK, k) * 1.3 * dpr))
    const push = f.calm ? 0 : Math.min(1, speed / 45)
    for (let i = lo; i < decos.length; i++) {
      const d = decos[i]!
      if (d.x > right) break
      const box = decoBox(d.kind)
      const sprig = isSprig(d.kind)
      const m = (sprig ? sprigK : k) * d.size
      const cell = this.decoPics.cell(d.kind, d.shape, level, this.lookKey)
      const w = box.w * m
      const h = (box.h + 0.2) * m
      const px = this.sx(d.x)
      const py = this.sy(d.y) + box.sink * m
      const soft = sprig ? 1 : d.kind === DECO.Bush ? 0.4 : d.kind === DECO.Rock ? 0 : 0.14
      let lean = 0
      if (!f.calm && soft) {
        lean = Math.sin(this.time * 1.7 + d.seed * 40) * 0.07 * soft
        const dx = d.x - f.bird.x
        const up = f.bird.y - d.y
        if (push && Math.abs(dx) < 7 && up < 5) lean += (1 - Math.abs(dx) / 7) ** 2 * push * 0.55 * soft * (1 - Math.max(0, up) / 5)
      }
      if (lean) {
        const c = Math.cos(lean)
        const s = Math.sin(lean)
        ctx.setTransform(dpr * c, dpr * s, -dpr * s, dpr * c, dpr * px, dpr * py)
        ctx.drawImage(cell.canvas, cell.x, cell.y, cell.w, cell.h, -w / 2, -box.h * m, w, h)
      } else {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.drawImage(cell.canvas, cell.x, cell.y, cell.w, cell.h, px - w / 2, py - box.h * m, w, h)
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /* ---------- the day's hills ---------- */

  /**
   * The ground, as scene.ts draws it (filled in pieces, its lines as bands cut in columns and filled in runs: see
   * its drawGround), with the light on it: over the turf, the seams and the blips, a sheet of light down every
   * slope that faces the sun and of shade down every one turned from it, deeper the steeper the slope.
   */
  private drawCourse() {
    const { ctx, C, W, H, cam, dpr, sight } = this
    const k = cam.k
    const xs: number[] = []
    const ys: number[] = []
    for (let px = -10; px <= W + 10; px += 5) {
      xs.push(px)
      ys.push(this.sy(heightAt(this.hills, this.wx(px))))
    }
    let top = H
    for (const y of ys) top = Math.min(top, y)
    const grad = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, top + 40 * k))
    grad.addColorStop(0, C.body)
    grad.addColorStop(1, C.deep)
    ctx.fillStyle = grad
    for (const p of this.piecesOf(xs, ys)) this.fillUnder(p.xs, p.ys)
    this.drawBuried()

    const at = (x: number) => {
      const i = clamp(Math.floor((x - xs[0]!) / 5), 0, xs.length - 2)
      return ys[i]! + ((ys[i + 1]! - ys[i]!) * (x - xs[i]!)) / 5
    }
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
    // The columns: where each is, the line's height there, half how tall a band a pixel thick stands, and how much
    // of the light or the shade the slope there takes.
    const cols: number[] = []
    const mid: number[] = []
    const across: number[] = []
    const lit: number[] = []
    const dim: number[] = []
    const mark = (d: number) => {
      const x = d / dpr
      const slope = (at(x + 2.5) - at(x - 2.5)) / 5
      cols.push(x)
      mid.push(at(x))
      across.push(Math.sqrt(1 + slope * slope) / 2)
      // Down the screen to the right is downhill ahead of the bird, facing the sun. Eased at both ends, so the
      // light comes on and goes off round a top or a hollow without a corner.
      const t = clamp(Math.abs(slope) / FULL_SLOPE, 0, 1)
      const share = t * t * (3 - 2 * t)
      lit.push(slope > 0 ? share : 0)
      dim.push(slope < 0 ? share : 0)
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
    // A band between two lines along the hills, `up` over `down`, filled in runs; where it's off the screen or has
    // no thickness, nothing is drawn and the run before ends.
    const band = (colour: string, up: (c: number) => number, down: (c: number) => number) => {
      ctx.fillStyle = colour
      const run = (from: number, to: number) => {
        ctx.beginPath()
        ctx.moveTo(cols[from]!, up(from))
        for (let c = from + 1; c <= to; c++) ctx.lineTo(cols[c]!, up(c))
        for (let c = to; c >= from; c--) ctx.lineTo(cols[c]!, down(c))
        ctx.closePath()
        ctx.fill()
      }
      let start = -1
      for (let c = 0; c + 1 < cols.length; c++) {
        const u0 = up(c)
        const u1 = up(c + 1)
        const d0 = down(c)
        const d1 = down(c + 1)
        if (Math.max(d0, d1) < 0 || Math.min(u0, u1) > tall || (d0 - u0 < 0.06 && d1 - u1 < 0.06)) {
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
    const line = (dy: number, colour: string, width: number) =>
      band(
        colour,
        (c) => mid[c]! + dy - across[c]! * width,
        (c) => mid[c]! + dy + across[c]! * width,
      )
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
    // The light and the shade, over all of that: a sheet of each, as deep as the slope is steep.
    const sheet = (colour: string, weight: number[]) =>
      band(
        colour,
        (c) => mid[c]!,
        (c) => mid[c]! + across[c]! * 2 * LIGHT_DEEP * k * weight[c]!,
      )
    sheet(sight.shade, dim)
    sheet(sight.light, lit)
    // A golden bird's hill, while the bird's still on it: its slope edged in gold, from its top to its foot, so
    // it's plain which slope to land on.
    for (let i = 0; i < this.golden.length; i++) {
      const hill = this.golden[i]!
      if (this.caught[i] || this.sx(hill.to) < -20 || this.sx(hill.from) > W + 20) continue
      const share = cols.map((x) => {
        const f = (this.wx(x) - hill.from) / (hill.to - hill.from)
        return f <= 0 || f >= 1 ? 0 : Math.min(1, f / 0.12, (1 - f) / 0.12)
      })
      band(
        withAlpha(GOLD, 0.55 + 0.2 * Math.sin(this.time * 3 + i)),
        (c) => mid[c]!,
        (c) => mid[c]! + across[c]! * 2 * 1.3 * k * share[c]!,
      )
    }
    // The edge along the top, and a line of light just under it where the sun is on the slope: it thins away
    // round a top and is gone on a climb.
    line(0, C.edge, Math.max(2.5, 0.42 * k))
    const glint = Math.max(1.5, 0.26 * k)
    const under = Math.max(3, 0.55 * k)
    band(
      C.shine,
      (c) => mid[c]! + under - across[c]! * glint * lit[c]!,
      (c) => mid[c]! + under + across[c]! * glint * lit[c]!,
    )
  }

  /** The stones and old shells in the ground under the hills, in view: stamped, like what stands on them. */
  private drawBuried() {
    const { ctx, W, H, cam, buried } = this
    const left = this.wx(-60)
    const right = this.wx(W + 60)
    let lo = 0
    let hi = buried.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (buried[mid]!.x < left) lo = mid + 1
      else hi = mid
    }
    const k = Math.max(cam.k, 5 * this.fit)
    for (let i = lo; i < buried.length; i++) {
      const d = buried[i]!
      if (d.x > right) break
      const py = this.sy(d.y)
      if (py > H + 40) continue
      const m = k * d.size
      const box = decoBox(d.kind)
      const cell = this.decoPics.cell(d.kind, d.shape, this.decoLevel, this.lookKey)
      const w = box.w * m
      ctx.drawImage(cell.canvas, cell.x, cell.y, cell.w, cell.h, this.sx(d.x) - w / 2, py - box.h * m, w, (box.h + 0.2) * m)
    }
  }

  /* ---------- flags and the line ---------- */

  /** The flags that split the run, flying, and the finish: a tall pole with a chequered flag, bunting down to the ground either side. */
  private drawBanners(f: SceneFrame) {
    const { ctx, C, W, cam } = this
    const wind = f.calm ? 0 : 1
    this.hills.flags.forEach((x, i) => {
      const px = this.sx(x)
      if (px < -60 || px > W + 60) return
      const passed = f.mode !== 'menu' && f.flag >= i
      const y = this.sy(heightAt(this.hills, x))
      const pole = Math.max(36 * this.fit, 5.5 * cam.k)
      const thick = Math.max(2 * this.fit, 0.2 * cam.k)
      ctx.fillStyle = withAlpha(C.ink, 0.75)
      ctx.fillRect(px - thick / 2, y - pole, thick, pole)
      // A pennant, rippling from the pole out to its point.
      const long = pole * 0.62
      const deep = pole * 0.36
      const N = 6
      const ripple = (u: number) => Math.sin(this.time * 7 * wind - u * 4.6 + i * 1.3) * pole * 0.035 * u * wind
      ctx.fillStyle = passed ? C.passed : C.flag
      ctx.beginPath()
      ctx.moveTo(px, y - pole)
      for (let s = 1; s <= N; s++) {
        const u = s / N
        ctx.lineTo(px + long * u, y - pole + (deep / 2) * u + ripple(u))
      }
      for (let s = N - 1; s >= 0; s--) {
        const u = s / N
        ctx.lineTo(px + long * u, y - pole + deep - (deep / 2) * u + ripple(u))
      }
      ctx.closePath()
      ctx.fill()
      ctx.font = `800 ${textSize(Math.max(11 * this.fit, pole * 0.2))}px ${this.font}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = C.paper
      ctx.fillText(String(i + 1), px + pole * 0.08, y - pole + deep / 2 + ripple(0.2))
    })
    const finish = this.hills.finish
    const fx = this.sx(finish)
    const tall = Math.max(60 * this.fit, 9 * cam.k)
    if (fx < -tall * 1.4 || fx > W + tall * 1.4) return
    const y = this.sy(heightAt(this.hills, finish))
    const thick = Math.max(3 * this.fit, 0.3 * cam.k)
    // Bunting, from the pole's top down to the ground before and behind it: a string that sags, and its pennants.
    for (const side of [-1, 1]) {
      const reach = tall * 1.15 * side
      const at = (u: number): [number, number] => [fx + reach * u, y - tall * (1 - u) + Math.sin(u * Math.PI) * tall * 0.09]
      ctx.fillStyle = withAlpha(C.ink, 0.55)
      ctx.beginPath()
      for (let s = 0; s <= 10; s++) ctx.lineTo(...at(s / 10))
      for (let s = 10; s >= 0; s--) {
        const [bx, by] = at(s / 10)
        ctx.lineTo(bx, by + Math.max(1, tall * 0.012))
      }
      ctx.closePath()
      ctx.fill()
      for (let s = 1; s <= 8; s++) {
        const [bx, by] = at(s / 9)
        const size = tall * 0.11
        ctx.fillStyle = FLOCK_HUES[(s + (side > 0 ? 2 : 0)) % 5]!
        ctx.beginPath()
        ctx.moveTo(bx - size * 0.5, by)
        ctx.lineTo(bx + size * 0.5, by)
        ctx.lineTo(bx + Math.sin(this.time * 5 * wind + s) * size * 0.3 * wind, by + size * 1.2)
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.fillStyle = withAlpha(C.ink, 0.85)
    ctx.fillRect(fx - thick / 2, y - tall, thick, tall)
    // The chequered flag, rippling.
    const cell = tall * 0.105
    const cols = 5
    const rows = 3
    const ripple = (u: number) => Math.sin(this.time * 6 * wind - u * 3.6) * cell * 0.5 * u * wind
    for (let q = 0; q < cols; q++) {
      const u0 = q / cols
      const u1 = (q + 1) / cols
      const x0 = fx + thick / 2 + q * cell
      const x1 = x0 + cell + 0.4
      for (let row = 0; row < rows; row++) {
        ctx.fillStyle = (row + q) % 2 === 0 ? C.ink : C.paper
        const y0 = y - tall + row * cell
        ctx.beginPath()
        ctx.moveTo(x0, y0 + ripple(u0))
        ctx.lineTo(x1, y0 + ripple(u1))
        ctx.lineTo(x1, y0 + cell + 0.4 + ripple(u1))
        ctx.lineTo(x0, y0 + cell + 0.4 + ripple(u0))
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.font = `800 ${textSize(Math.max(12 * this.fit, tall * 0.13))}px ${this.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(3, tall * 0.035)
    ctx.strokeStyle = withAlpha(C.paper, 0.7)
    ctx.strokeText('FINISH', fx, y - tall - 8)
    ctx.fillStyle = C.ink
    ctx.fillText('FINISH', fx, y - tall - 8)
  }

  /** Over the line: confetti off the top of the pole, in the flock's colours, and how many golden birds came home. */
  private cheer() {
    const x = this.hills.finish
    const y = heightAt(this.hills, x) + 7
    if (this.golden.length) {
      const have = this.caught.filter(Boolean).length
      this.say(this.lastBird.x, this.lastBird.y, `${have} of ${this.golden.length} golden birds`, have > 0, 1)
    }
    for (let i = 0; i < 44; i++) {
      const a = Math.PI * (0.12 + Math.random() * 0.76)
      const sp = 6 + Math.random() * 13
      this.sparks.push({
        kind: 'confetti',
        x: x + (Math.random() - 0.5) * 2,
        y: y + Math.random() * 2,
        vx: Math.cos(a) * sp + 9,
        vy: Math.sin(a) * sp,
        life: 1.4 + Math.random() * 0.8,
        max: 2.2,
        size: 0.3 + Math.random() * 0.2,
        colour: FLOCK_HUES[i % 5]!,
        turn: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 22,
      })
    }
  }

  /* ---------- the birds ---------- */

  /**
   * A bird, painted for this look (swiftPaint.ts): yours, and the blue bird. Placed, turned, stretched in a dive
   * and squashed on a landing just as scene.ts places its own, so it's the same bird in the same spot. A skin
   * paints itself and a ghost with no skin is its outline, both as scene.ts draws them.
   */
  protected drawBird(x: number, y: number, angle: number, size: number, colour: string, shown: BirdShown = {}) {
    if (shown.ghost || skinPainter(shown.skin)) {
      super.drawBird(x, y, angle, size, colour, shown)
      return
    }
    const { ctx } = this
    const { flap = 0, dive = false, folded = false, squish = 0, alpha = 1, mood = null } = shown
    size *= SWIFT_SCALE
    const px = this.sx(x) - Math.sin(angle) * size * SWIFT_LIFT
    const py = this.sy(y) - Math.cos(angle) * size * SWIFT_LIFT
    const style = this.styleOf()
    const key = `${colour}|${style}`
    let look = this.swifts.get(key)
    if (!look) {
      look = swiftColours(colour, this.C.dark, style)
      this.swifts.set(key, look)
    }
    // It blinks now and then: each bird in its own time.
    const t = this.time + colour.length * 0.53
    const blink = t % 3.3 < 0.11 || (t + 1.4) % 5.9 < 0.1
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(px, py)
    ctx.rotate(-angle)
    const stretch = dive ? 1.12 : 1
    const sq = 1 - squish * 0.22
    ctx.scale((size * stretch) / Math.sqrt(sq), (size * sq) / stretch)
    paintBird(ctx, BIRD_DESIGNS[this.birdDesign], look, { flap, dive, ground: folded, px1: 1 / size, mood, blink })
    ctx.restore()
  }

  /** How the bird in use is outlined: a bird folded from paper is always a cut-out. */
  private styleOf(): SwiftStyle {
    return BIRD_DESIGNS[this.birdDesign].paper ? 'paper' : this.birdStyle
  }

  /**
   * The golden birds still on their hills: each sitting on its slope in a glow, hopping, with a few stars turning
   * round it. One that's been caught is with the flock (flock.ts gild).
   */
  private drawGolden(calm: boolean) {
    const { ctx, W } = this
    if (!this.golden.length) return
    const glow = this.backdrop().glow.canvas
    for (let i = 0; i < this.golden.length; i++) {
      if (this.caught[i]) continue
      const hill = this.golden[i]!
      const px = this.sx(hill.x)
      if (px < -90 || px > W + 90) continue
      const size = this.birdSize() * 1.08
      const hop = calm ? 0 : Math.abs(Math.sin(this.time * 2.6 + i * 1.7)) * 0.26
      const angle = Math.atan(slopeAt(this.hills, hill.x))
      const py = this.sy(hill.y + hop) - size * SWIFT_SCALE * SWIFT_LIFT
      const r = size * 3.8
      ctx.globalAlpha = 0.78 + (calm ? 0 : 0.2 * Math.sin(this.time * 3 + i))
      ctx.drawImage(glow, px - r, py - r, r * 2, r * 2)
      ctx.globalAlpha = 1
      this.drawBird(hill.x, hill.y + hop, angle, size, GOLD, { folded: true })
      if (calm) continue
      ctx.fillStyle = '#fff6cf'
      for (let k = 0; k < 4; k++) {
        const a = this.time * 1.1 + k * 1.571 + i
        const s = size * (0.26 + 0.12 * Math.sin(this.time * 6 + k * 1.7))
        const tx = px + Math.cos(a) * size * 2.5
        const ty = py + Math.sin(a) * size * 1.7
        ctx.beginPath()
        ctx.moveTo(tx, ty - s * 1.6)
        ctx.lineTo(tx + s * 0.45, ty)
        ctx.lineTo(tx, ty + s * 1.6)
        ctx.lineTo(tx - s * 0.45, ty)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  /* ---------- the bird's company ---------- */

  /** The bird's shadow on the hill straight under it: smaller and fainter the higher it flies. */
  private drawShadow(x: number, y: number) {
    const { ctx, C, cam } = this
    const floor = heightAt(this.hills, x)
    const up = Math.max(0, y - floor)
    const fade = 1 / (1 + up / 9)
    const size = this.birdSize() * (0.75 + 0.6 * fade)
    const slope = slopeAt(this.hills, x)
    ctx.fillStyle = C.dark ? `rgba(2, 4, 16, ${0.38 * fade})` : `rgba(20, 40, 60, ${0.26 * fade})`
    ctx.beginPath()
    ctx.ellipse(this.sx(x), this.sy(floor) + Math.max(1, 0.12 * cam.k), size, size * 0.26, -Math.atan(slope), 0, TAU)
    ctx.fill()
  }

  /** The light round a bird on a streak: a soft glow of the beak's gold, breathing, brighter the further the streak has lifted the wind. */
  private drawHalo(x: number, y: number, angle: number, lift: number) {
    const { ctx } = this
    const size = this.birdSize()
    const px = this.sx(x) - Math.sin(angle) * size * SWIFT_LIFT
    const py = this.sy(y) - Math.cos(angle) * size * SWIFT_LIFT
    const breath = 0.5 + 0.5 * Math.sin(this.time * 8)
    const r = size * (2.6 + 1.2 * lift + 0.3 * breath)
    ctx.globalAlpha = (0.5 + 0.3 * lift) * (0.8 + 0.2 * breath)
    ctx.drawImage(this.backdrop().glow.canvas, px - r, py - r, r * 2, r * 2)
    ctx.globalAlpha = 1
  }

  /**
   * A ribbon behind a bird in the air, in its own colour, widest at the bird and fading out along where it's
   * been: gold, and wider, on a streak. It thins away where the bird was on the hill.
   */
  private drawRibbon(skin: string | null | undefined, lift: number) {
    const { ctx, cam, trace } = this
    if (trace.length < 3) return
    const colour = lift > 0 ? BEAK : skin === AURORA_PHOENIX ? '#5cf2b0' : skin === PENGUIN ? '#e8564f' : this.C.dark ? '#ffffff' : RED
    const wide = RIBBON_WIDE * (1 + 0.7 * lift) * Math.max(cam.k, 7 * this.fit)
    const rise = this.birdSize() * SWIFT_LIFT
    const n = trace.length
    const upper: [number, number][] = []
    const lower: [number, number][] = []
    for (let i = 0; i < n; i++) {
      const p = trace[i]!
      const age = (this.time - p.t) / RIBBON
      if (age > 1) continue
      const a = trace[Math.max(0, i - 1)]!
      const b = trace[Math.min(n - 1, i + 1)]!
      const dx = this.sx(b.x) - this.sx(a.x)
      const dy = this.sy(b.y) - this.sy(a.y)
      const len = Math.hypot(dx, dy) || 1
      // Nothing where it was on the hill; full a few steps into the air.
      const w = p.air ? wide * (1 - age) ** 0.85 * Math.min(1, (n - 1 - i) / 2 + 0.35) : 0
      const px = this.sx(p.x)
      const py = this.sy(p.y) - rise
      upper.push([px - (dy / len) * w, py + (dx / len) * w])
      lower.push([px + (dy / len) * w, py - (dx / len) * w])
    }
    if (upper.length < 3) return
    const head = upper[upper.length - 1]!
    const tail = upper[0]!
    const fade = ctx.createLinearGradient(head[0], head[1], tail[0], tail[1])
    fade.addColorStop(0, withAlpha(colour, lift > 0 ? 0.9 : 0.7))
    fade.addColorStop(1, withAlpha(colour, 0))
    ctx.fillStyle = fade
    ctx.beginPath()
    ctx.moveTo(upper[0]![0], upper[0]![1])
    for (let i = 1; i < upper.length; i++) ctx.lineTo(upper[i]![0], upper[i]![1])
    for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i]![0], lower[i]![1])
    ctx.closePath()
    ctx.fill()
  }

  /* ---------- sparks, air, words ---------- */

  private drawSparks(dt: number) {
    const { ctx, cam, sparks } = this
    const k = Math.max(cam.k, 6 * this.fit)
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!
      s.life -= dt
      if (s.life <= 0) {
        sparks.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.turn += s.spin * dt
      if (s.kind === 'spark') s.vy -= 22 * dt
      else if (s.kind === 'dust') {
        s.vx *= 1 - Math.min(1, dt * 2.6)
        s.vy *= 1 - Math.min(1, dt * 2.6)
      } else if (s.kind === 'petal') {
        s.vy -= 9 * dt
        s.vx *= 1 - Math.min(1, dt * 1.3)
      } else if (s.kind === 'confetti') {
        s.vy -= 12 * dt
        s.vx *= 1 - Math.min(1, dt * 0.9)
        // It flutters down, not falls.
        if (s.vy < -5) s.vy = -5
      }
      const left = clamp(s.life / s.max, 0, 1)
      const px = this.sx(s.x)
      const py = this.sy(s.y)
      ctx.fillStyle = s.colour
      if (s.kind === 'ring') {
        // A ring of light on the hill, opening: its band between two circles.
        const r = s.size * k * (1 - left * 0.8)
        ctx.globalAlpha = left * 0.7
        ctx.beginPath()
        ctx.ellipse(px, py, r, r * 0.36, 0, 0, TAU)
        ctx.ellipse(px, py, Math.max(0.1, r - Math.max(1.5, 0.3 * k * left)), Math.max(0.1, r * 0.36 - Math.max(1, 0.2 * k * left)), 0, 0, TAU, true)
        ctx.fill()
        continue
      }
      if (s.kind === 'dust') {
        ctx.globalAlpha = left * 0.5
        ctx.beginPath()
        ctx.arc(px, py, s.size * k * (0.5 + (1 - left) * 0.9), 0, TAU)
        ctx.fill()
        continue
      }
      ctx.globalAlpha = Math.min(1, left * 2.2)
      const r = Math.max(1.5, s.size * k)
      ctx.beginPath()
      if (s.kind === 'spark') {
        ctx.moveTo(px, py - r * 1.6)
        ctx.lineTo(px + r * 0.5, py)
        ctx.lineTo(px, py + r * 1.6)
        ctx.lineTo(px - r * 0.5, py)
      } else ctx.ellipse(px, py, r, r * (0.3 + 0.5 * Math.abs(Math.sin(s.turn * 0.7))), s.turn, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /** Streaks of rushing air across the screen once the bird is really moving, along the way it's flying: gold on a streak. */
  private drawWind(vx: number, vy: number, lift: number) {
    const { ctx, W, H, sight } = this
    const speed = Math.hypot(vx, vy)
    if (speed < 40) return
    const f = clamp((speed - 40) / 26, 0, 1)
    // Along the flight, though never steeper than a gentle slant: the hills go by sideways.
    const tilt = clamp(-vy / Math.max(1, vx), -0.35, 0.35) * 0.6
    ctx.fillStyle = lift > 0 ? withAlpha(BEAK, 0.75) : sight.wind
    for (let i = 0; i < 8; i++) {
      const len = (50 + f * 120) * (0.7 + ((i * 37) % 10) / 16)
      const span = W + len * 2
      const x = W + len - ((this.time * (820 + i * 140) + i * 263) % span)
      const y = H * ((i * 0.131 + 0.07) % 0.82) + tilt * (x - W / 2)
      // In the air, never across the ground: a streak whose middle is under the hills isn't drawn.
      if (y > this.sy(heightAt(this.hills, this.wx(x + len / 2))) - 12) continue
      const thick = 1 + (i % 3) * 0.6
      ctx.globalAlpha = f * (0.35 + 0.3 * ((i * 7) % 3) * 0.5)
      // Thin at both ends: a long kite.
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + len * 0.3, y + tilt * len * 0.3 - thick)
      ctx.lineTo(x + len, y + tilt * len)
      ctx.lineTo(x + len * 0.3, y + tilt * len * 0.3 + thick)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /** What drifts in the air close to the eye, going by faster than the hills: pollen by day, fireflies by night, blinking. */
  private drawMotes() {
    const { ctx, W, H, sight } = this
    const pic = this.backdrop().mote
    const count = Math.round(this.motes.length * clamp(this.fit, 0.4, 1))
    const span = W + 80
    for (let i = 0; i < count; i++) {
      const m = this.motes[i]!
      const x = ((((m.u * span - this.scroll * m.depth * 0.5 - this.time * 9) % span) + span) % span) - 40
      const y = H * m.v + Math.sin(this.time * 0.9 + m.phase) * 14
      const blink = sight.mote.glow ? 0.25 + 0.75 * Math.max(0, Math.sin(this.time * 2.1 + m.phase * 3)) : 0.75
      const r = (sight.mote.glow ? 9 : 3.6) * m.size * clamp(this.fit, 0.6, 1)
      ctx.globalAlpha = blink
      ctx.drawImage(pic.canvas, x - r, y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1
  }

  /** A word over a spot on the hills: on `row` 1 or 2 it sits a line or two above another said at once. */
  private say(x: number, y: number, text: string, good: boolean, row = 0) {
    const { C, cam } = this
    const size = textSize(clamp(1.7 * cam.k, 17 * this.fit, 34))
    const colour = good ? C.good : C.bad
    const key = `${text}|${colour}|${size}|${keptEpoch()}`
    let pic = this.labelPics.get(key)
    if (!pic) {
      const font = `800 ${size}px ${this.font}`
      this.ctx.font = font
      const w = Math.ceil(this.ctx.measureText(text).width + size * 0.7)
      const h = Math.ceil(size * 1.5)
      pic = picture(w, h, this.dpr, (g) => {
        g.font = font
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.lineJoin = 'round'
        g.lineWidth = size * 0.3
        g.strokeStyle = C.paper
        g.strokeText(text, w / 2, h / 2)
        g.fillStyle = colour
        g.fillText(text, w / 2, h / 2)
      })
      if (this.labelPics.size > 40) this.labelPics.clear()
      this.labelPics.set(key, pic)
    }
    this.labels.push({ x, y, pic, life: 1, row })
  }

  private drawLabels(dt: number) {
    const { ctx, labels } = this
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i]!
      l.life -= dt * 1.05
      if (l.life <= 0) {
        labels.splice(i, 1)
        continue
      }
      const t = 1 - l.life
      // It pops: up from small, a little past its size, and back.
      const pop = t < 0.1 ? 0.55 + (t / 0.1) * 0.62 : t < 0.2 ? 1.17 - ((t - 0.1) / 0.1) * 0.17 : 1
      const w = l.pic.w * pop
      const h = l.pic.h * pop
      const px = this.sx(l.x)
      const py = this.sy(l.y) - this.birdSize() * 2.7 - t * 42 - l.row * l.pic.h * 0.82
      ctx.globalAlpha = clamp(l.life * 2.4, 0, 1)
      ctx.drawImage(l.pic.canvas, px - w / 2, py - h / 2, w, h)
    }
    ctx.globalAlpha = 1
  }
}
