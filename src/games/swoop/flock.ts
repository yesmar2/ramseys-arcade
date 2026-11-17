import { mixColor } from '../../lib/color'
import { keptEpoch, watchKept } from '../keptPictures'
import { SWIFT_BEAK, SWIFT_BEAT, SWIFT_BELLY, SWIFT_BODY, SWIFT_EYE, SWIFT_WING_FOLDED, SWIFT_WING_ROOT, SWIFT_WING_UP } from './birdShape'

/*
 * The flock: Swoop's streak, as something you can see and can lose. Every clean landing in a row, another
 * little swift comes down out of the sky and falls in behind your bird; they follow its every swoop and tuck
 * their wings a moment after it does, a wave down the line. From three, the wind lets a bird on a streak go
 * faster (sim.ts capFor): the flock is that streak, so the more of them behind you, the faster you're let fly.
 * Land one badly and they scatter.
 *
 * Nothing here changes how the game plays or how a run is timed: the flock is as big as the streak the sim
 * already keeps (Bird.streak), and it's drawn only. Ramsey, 2026-11-17, of Swoop: "it's fun already in my
 * opinion and there are other games out there like it, just need something to set it apart".
 *
 * Each follower is a picture, painted once for its colour, wingbeat and size, turned and stamped where it
 * flies. They're all on one sheet, a colour a row and a beat of the wing a column, because a frame is charged
 * for each canvas it copies from more than for each copy: eight birds off eight canvases cost a third of a
 * millisecond on Ramsey's laptop, and off one sheet next to nothing (measured 2026-11-17).
 */

const TAU = Math.PI * 2

/** The followers' colours, in the order they join: the arcade's own, never the blue bird's blue. */
export const FLOCK_HUES = ['#f5b942', '#e85d9a', '#3ecf8e', '#8a6ad4', '#f2813a', '#fff6e6'] as const

/** How big a follower is, to your bird. */
export const FOLLOWER_SIZE = 0.6
/** The wingbeat's frames a picture is kept for, and one more for a tuck. */
const BEATS = 6
const TUCK = BEATS
/**
 * Where a follower flies behind your bird, in bird sizes (your bird's on the screen, which is bigger than life
 * when the camera is far out, so they keep their distance on a phone too). In the air they're a wedge: this many
 * lines across, the first row this far back, each row after it and each line apart. Low over a hill they close
 * up into files along it, one over another, each rank this far behind the last: close enough that a phone, with
 * only a third of its width behind the bird, still shows a flock of a dozen and more.
 */
const LANES = [0, 1, -1, 2, -2] as const
const FIRST_ROW = 3.1
const ROW = 2.3
const LANE = 1.1
const FILES = 3
const RANK = 1.55
const FILE = 0.62
/** How high your bird has to be, in bird sizes, for the line to have opened right out into the wedge. */
const WEDGE_AT = 3
/** How long one takes to fall in, in seconds, and to fly off when the flock scatters. */
const JOIN = 0.6
const SCATTER = 1.15

type Follower = {
  x: number
  y: number
  /** Which way it's headed, radians, up positive. */
  a: number
  hue: number
  /** 0 as it comes down out of the sky, 1 once it's in its place. */
  joined: number
  /** Where it comes in from, from its place: behind and above. */
  fromX: number
  fromY: number
  beat: number
  tuck: boolean
  /** Whether it has been put anywhere yet. */
  placed: boolean
}

type Stray = { x: number; y: number; vx: number; vy: number; hue: number; life: number; beat: number }

/** Where the leader was, each frame: how far it had come along its own path by then. */
type Step = { s: number; x: number; y: number; hold: boolean }

let paths: { body: Path2D; belly: Path2D; beak: Path2D; up: Path2D; folded: Path2D } | null = null
const PATHS = () =>
  (paths ??= {
    body: new Path2D(SWIFT_BODY),
    belly: new Path2D(SWIFT_BELLY),
    beak: new Path2D(SWIFT_BEAK),
    up: new Path2D(SWIFT_WING_UP),
    folded: new Path2D(SWIFT_WING_FOLDED),
  })

/** A follower's picture: half its side in the swift's units, so a wing at any beat stays inside. */
const HALF = 2.7
/**
 * The sizes the sheet is painted at, in canvas pixels to the swift's unit: the first big enough is used and
 * drawn down to size, so the camera pulling in and out doesn't paint them all afresh.
 */
const UNITS = [5, 6.5, 8, 10, 12.5, 16, 20, 25, 32, 40, 52] as const

type Sheet = { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D | null; side: number; unit: number; painted: Set<number> }

export class Flock {
  private followers: Follower[] = []
  private strays: Stray[] = []
  private steps: Step[] = []
  private joinedEver = 0
  /** How much of a wedge they are, 0 a line along the hill, 1 the whole wedge; and how far back the last one flies, in metres. */
  private wedge = 0
  private reach = 30
  /** The sheets painted so far, by size and theme: the last few are kept, for a camera going in and out. */
  private sheets = new Map<string, Sheet>()

  get size() {
    return this.followers.length
  }

  /** A new run: nobody behind you yet. */
  reset() {
    this.followers.length = 0
    this.strays.length = 0
    this.steps.length = 0
    this.joinedEver = 0
    this.wedge = 0
  }

  /** Where your bird is this frame. */
  lead(x: number, y: number, hold: boolean) {
    const last = this.steps[this.steps.length - 1]
    const s = last ? last.s + Math.hypot(x - last.x, y - last.y) : 0
    // Standing still lays nothing: a step is somewhere new.
    if (last && s - last.s < 0.001) {
      last.hold = hold
      return
    }
    this.steps.push({ s, x, y, hold })
    // Only as far back as the last of them flies.
    const keep = this.reach + 12
    let drop = 0
    while (drop < this.steps.length - 2 && s - this.steps[drop + 1]!.s > keep) drop++
    if (drop > 64) this.steps.splice(0, drop)
  }

  /** The leader's path `back` metres behind it: where, which way it was headed, and whether it was diving. */
  private behind(back: number): { x: number; y: number; a: number; hold: boolean } {
    const steps = this.steps
    const n = steps.length
    if (n === 0) return { x: 0, y: 0, a: 0, hold: false }
    const head = steps[n - 1]!
    const want = head.s - back
    let lo = 0
    let hi = n - 1
    if (want <= steps[0]!.s) {
      // Further back than the path goes: straight back from its first step.
      const first = steps[0]!
      return { x: first.x - (first.s - want), y: first.y, a: 0, hold: first.hold }
    }
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (steps[mid]!.s <= want) lo = mid
      else hi = mid
    }
    const p = steps[lo]!
    const q = steps[hi]!
    const f = q.s > p.s ? (want - p.s) / (q.s - p.s) : 0
    // Which way: over a stretch of the path, so it doesn't twitch with every step.
    const from = steps[Math.max(0, lo - 2)]!
    const to = steps[Math.min(n - 1, hi + 2)]!
    return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, a: Math.atan2(to.y - from.y, Math.max(0.001, to.x - from.x)), hold: p.hold }
  }

  /**
   * The flock is kept as big as the streak: one more clean landing and another joins; a streak lost and they all
   * scatter, off the way your bird was going (`vx`, `vy`).
   */
  keep(streak: number, vx: number, vy: number) {
    const have = this.followers.length
    if (streak < have) {
      for (const f of this.followers) {
        // One that hadn't come in yet has nowhere to scatter from.
        if (!f.placed) continue
        // Up and back, each its own way.
        const a = Math.PI * (0.32 + Math.random() * 0.56)
        const sp = 9 + Math.random() * 12
        this.strays.push({ x: f.x, y: f.y, vx: vx * 0.45 + Math.cos(a) * sp, vy: Math.max(0, vy) * 0.3 + Math.sin(a) * sp, hue: f.hue, life: 1, beat: f.beat })
      }
      this.followers.length = 0
    }
    while (this.followers.length < streak) {
      this.followers.push({
        x: 0,
        y: 0,
        a: 0,
        hue: this.joinedEver++ % FLOCK_HUES.length,
        joined: 0,
        fromX: -(4.5 + Math.random() * 5.5),
        fromY: 4.5 + Math.random() * 5.5,
        beat: Math.random() * TAU,
        tuck: false,
        placed: false,
      })
    }
  }

  /**
   * Everyone a frame on: each follower toward its place behind the leader, never under the hill; the strays
   * away. `size` is your bird's on the screen, in metres of the hills, and `up` how high it is over them.
   */
  update(dt: number, speed: number, groundAt: (x: number) => number, size: number, up: number) {
    // Strung out the faster they go, as a real flock is.
    const fast = Math.min(1, speed / 60)
    const t = Math.min(1, Math.max(0, up / (WEDGE_AT * size)))
    this.wedge += (t * t * (3 - 2 * t) - this.wedge) * (1 - Math.exp(-dt * 7))
    const w = this.wedge
    const ease = 1 - Math.exp(-dt * 20)
    let reach = 0
    this.followers.forEach((f, i) => {
      const lane = LANES[i % LANES.length]!
      const row = Math.floor(i / LANES.length)
      const inWedge = (FIRST_ROW + row * ROW + Math.abs(lane) * 0.45) * (1 + fast * 0.8)
      const file = i % FILES
      const inLine = (FIRST_ROW + Math.floor(i / FILES) * RANK + file * 0.5) * (1 + fast * 0.3)
      const back = (inLine + (inWedge - inLine) * w) * size
      if (back > reach) reach = back
      const at = this.behind(back)
      // Out to its side of the wedge, across the way it's headed.
      const out = lane * LANE * (1 + row * 0.1) * size * w
      let tx = at.x - Math.sin(at.a) * out
      let ty = at.y + Math.cos(at.a) * out
      // Nobody flies through the ground: low over it, each file above the last; coming down in the wedge, the
      // ones under it come up and over.
      const order = lane === 0 ? 0 : lane > 0 ? lane * 2 - 1 : -lane * 2
      const floor = groundAt(tx) + (0.42 + file * FILE * (1 - w) + order * 0.5 * w) * size
      if (ty < floor) ty = floor
      if (f.joined < 1) {
        f.joined = Math.min(1, f.joined + dt / JOIN)
        const left = (1 - f.joined) ** 2.4
        tx += f.fromX * left * size
        ty += f.fromY * left * size
      }
      if (!f.placed) {
        f.x = tx
        f.y = ty
        f.a = at.a
        f.placed = true
      } else {
        const nx = f.x + (tx - f.x) * ease
        const ny = f.y + (ty - f.y) * ease
        const moved = Math.hypot(nx - f.x, ny - f.y)
        // Headed the way it's going; in its place, the way the leader went through here.
        const want = moved > 0.02 && f.joined < 1 ? Math.atan2(ny - f.y, Math.max(0.001, nx - f.x)) : at.a
        f.a += (want - f.a) * (1 - Math.exp(-dt * 14))
        f.x = nx
        f.y = ny
      }
      f.tuck = at.hold && f.joined >= 1
    })
    this.reach = reach
    for (let i = this.strays.length - 1; i >= 0; i--) {
      const s = this.strays[i]!
      s.life -= dt / SCATTER
      if (s.life <= 0) {
        this.strays.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vx *= 1 - dt * 0.9
      s.vy += 5 * dt
    }
  }

  /** The sheet for birds drawn `want` canvas pixels to the swift's unit, on this theme. */
  private sheetFor(want: number, dark: boolean): Sheet {
    let unit: number = UNITS[UNITS.length - 1]!
    for (const u of UNITS) {
      if (u >= want) {
        unit = u
        break
      }
    }
    const key = `${unit}|${dark}|${keptEpoch()}`
    let sheet = this.sheets.get(key)
    if (sheet) return sheet
    const side = Math.ceil(HALF * 2 * unit)
    const canvas = document.createElement('canvas')
    canvas.width = side * (BEATS + 1)
    canvas.height = side * FLOCK_HUES.length
    watchKept(canvas)
    sheet = { canvas, g: canvas.getContext('2d'), side, unit, painted: new Set() }
    // The oldest goes once there are more than a few.
    if (this.sheets.size >= 4) this.sheets.delete(this.sheets.keys().next().value!)
    this.sheets.set(key, sheet)
    return sheet
  }

  /** Paints a follower on its sheet the first time it's wanted: its colour, at one beat of its wing, or tucked. */
  private paint(sheet: Sheet, hue: number, frame: number, dark: boolean) {
    const id = hue * (BEATS + 1) + frame
    if (sheet.painted.has(id)) return
    sheet.painted.add(id)
    const g = sheet.g
    if (!g) return
    const { side, unit } = sheet
    const P = PATHS()
    const colour = FLOCK_HUES[hue]!
    const tucked = frame === TUCK
    g.save()
    g.beginPath()
    g.rect(frame * side, hue * side, side, side)
    g.clip()
    g.translate(frame * side + side / 2, hue * side + side / 2)
    const stretch = tucked ? 1.12 : 1
    g.scale(unit * stretch, unit / stretch)
    g.lineJoin = 'round'
    g.strokeStyle = dark ? mixColor(colour, '#0b1030', 0.72) : '#1a2b3c'
    g.lineWidth = Math.max(1.6 / unit, 0.13)
    g.fillStyle = colour
    g.fill(P.body)
    g.stroke(P.body)
    g.fillStyle = 'rgba(255, 255, 255, 0.5)'
    g.fill(P.belly)
    g.fillStyle = hue === 0 ? '#f2813a' : '#f5b942'
    g.fill(P.beak)
    g.save()
    if (!tucked) {
      const [rx, ry] = SWIFT_WING_ROOT
      g.translate(rx, ry)
      g.rotate((0.5 - 0.5 * Math.sin((frame / BEATS) * TAU)) * SWIFT_BEAT)
      g.translate(-rx, -ry)
    }
    const wing = tucked ? P.folded : P.up
    g.fillStyle = mixColor(colour, '#000000', 0.2)
    g.fill(wing)
    g.stroke(wing)
    g.restore()
    const e = SWIFT_EYE
    g.fillStyle = '#1a2b3c'
    g.beginPath()
    g.arc(e.px - 0.02, e.y, e.pr * 1.25, 0, TAU)
    g.fill()
    g.restore()
  }

  /**
   * Draws them: `size` is your bird's on the screen, `px` and `py` put a spot on the hills on the screen, `dpr`
   * the canvas's pixels to the screen's, and `scale` how the swift is drawn bigger than its size (scene.ts
   * SWIFT_SCALE).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    px: (x: number) => number,
    py: (y: number) => number,
    size: number,
    scale: number,
    dpr: number,
    time: number,
    dark: boolean,
  ) {
    if (!this.followers.length && !this.strays.length) return
    // The sheet is painted for a size a few steps apart, and its birds drawn at the size they truly are.
    const unitNow = size * FOLLOWER_SIZE * scale
    const sheet = this.sheetFor(unitNow * dpr, dark)
    const { side } = sheet
    const half = HALF * unitNow
    const stamp = (x: number, y: number, a: number, hue: number, beat: number, tuck: boolean, alpha: number) => {
      const frame = tuck ? TUCK : Math.floor((((time * 3.4 + beat / TAU) % 1) + 1) * BEATS) % BEATS
      this.paint(sheet, hue, frame, dark)
      const c = Math.cos(a)
      const s = Math.sin(a)
      ctx.setTransform(dpr * c, -dpr * s, dpr * s, dpr * c, dpr * px(x), dpr * py(y))
      ctx.globalAlpha = alpha
      ctx.drawImage(sheet.canvas, frame * side, hue * side, side, side, -half, -half, half * 2, half * 2)
    }
    for (const s of this.strays) stamp(s.x, s.y, Math.atan2(s.vy, s.vx), s.hue, s.beat + time * 9, false, Math.min(1, s.life * 1.6))
    // The last to join are drawn first, so the ones nearest your bird are on top.
    for (let i = this.followers.length - 1; i >= 0; i--) {
      const f = this.followers[i]!
      stamp(f.x, f.y, f.a, f.hue, f.beat, f.tuck, Math.min(1, 0.25 + f.joined * 1.5))
    }
    ctx.globalAlpha = 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  dispose() {
    this.reset()
    this.sheets.clear()
  }
}
