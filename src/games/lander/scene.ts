import type { GhostPose } from './runs'
import { drawSkinArt, LANDER_ART, type SkinArt } from '../../lib/skinArt'
import {
  crusherAt,
  FOOT,
  G,
  inAir,
  KNOCKS,
  LAND_ANGLE,
  LAND_SPEED,
  liftAt,
  mulberry32,
  SHIP,
  spinnerAngle,
  toWorld,
  ventBlow,
  type Breach,
  type Cave,
  type CaveNode,
} from './sim'

/*
 * Lander on a 2D canvas: the cave from the side, following the ship. Rock is near-black with flecks; the air
 * is a deep violet with a grid every 4 m; the walls are lit edges, violet near the top and magenta deeper
 * down. Gates are dashed amber lines that turn green once passed; the pads are amber, the landing pad's lights
 * running toward its middle. The ship is Asteroids' arrow in white with an amber flame; the ghost is cyan
 * (or amber, your own best) with whose run it is over it. A patch of side wall about a third of the way down
 * is cracked, with starlight showing through (breakout.ts): broken through, it opens on open space, stars and
 * a little moon with a pad on top, where a flag goes up when your ship sets down.
 *
 * The test cave's new things (sim.ts LabCave) are drawn where they are at the run's moment: steam puffing
 * from vents, crushers in hazard stripes, a turning bar, water with a moving surface, a bubble of low gravity,
 * a molten pool along a floor, the shortcut's tunnel, and the landing pad riding its lift.
 *
 * It draws only with fills and strokes, never shadowBlur or overlapping circle fills, so a phone's canvas
 * keeps up. The cave is always dark, whatever the site's theme: it's underground.
 */

/** The colours underground. */
const C = {
  rock: '#0b0716',
  fleck: 'rgba(120, 90, 200, 0.16)',
  air: '#150d29',
  grid: 'rgba(138, 92, 255, 0.11)',
  wallTop: [138, 92, 255],
  wallDeep: [255, 79, 216],
  pad: '#ffb347',
  gate: '#f5b942',
  passed: '#3ecf8e',
  ship: '#fff3e4',
  ghost: '#46e4ff',
  mine: '#f5b942',
  bad: '#f07a8a',
  space: '#04030b',
  star: '#dfe7ff',
  face: [196, 206, 255],
  moon: '#d4d0e2',
  moonDark: '#8f89a6',
  crater: '#a7a1bc',
  flag: '#ffb347',
  earth: '#3b7be0',
  land: '#4fbf7a',
} as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const ease = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3

/** What a frame shows: where the ship is, and the run to beat beside it. */
export type SceneFrame = {
  /** At the start card, flying, in pieces after a crash, or down on the pad. */
  mode: 'menu' | 'play' | 'wreck' | 'done'
  ship: { x: number; y: number; a: number; vx: number; vy: number }
  /** The engine, 0 to 1, for the flame. */
  engine: number
  /** The last gate passed, −1 before the first. */
  gate: number
  ghost: GhostPose | null
  ghostTag: string
  /** The ghost is your own best: amber, not the others' cyan. */
  ghostMine: boolean
  /** Before a run the camera rides with the run to beat; with less motion asked for, it stays on the start pad. */
  calm: boolean
  /** The easter egg this run (sim.ts Breach): knocks on the cracked patch, broken through, down on the moon. */
  out: { knocks: number; broke: boolean; planted: boolean } | null
  /** The player's chosen skin (lib/skins.ts), drawn on their own ship. */
  skin?: string | null
  /** The run's clock, where the test cave's moving things are (sim.ts LabCave); at the start card, any moment. */
  t?: number
  /** The skin the ghost's run was flown in: everyone who races it sees it in that. */
  ghostSkin?: string | null
}

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; hot: boolean }
type Shard = { x: number; y: number; vx: number; vy: number; a: number; spin: number; half: number }
/** A chunk of the broken patch, tumbling. */
type Rubble = { x: number; y: number; vx: number; vy: number; a: number; spin: number; size: number; life: number }
/** A star past the broken patch, in the breach's own frame: how far out through the wall, and along it. */
type Star = { out: number; along: number; size: number; phase: number }

/** A Lander skin's board to the ship: its feet, 52 apart on the board, on the hull's feet. */
const HOPPER_SCALE = FOOT / 26


/** The hull's outline as Asteroids drew it: nose, wing, notch, wing. */
const OUTLINE = [SHIP.nose, SHIP.wing, SHIP.notch, [-SHIP.wing[0], SHIP.wing[1]]] as const

export class CaveScene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly cave: Cave
  private readonly fleck: CanvasPattern | null
  private readonly font: string
  private W = 0
  private H = 0
  private dpr = 1
  private cam = { x: 0, y: 0, k: 20, snap: true }
  private sparks: Spark[] = []
  private shards: Shard[] = []
  private wreckFor = 0
  private time = 0
  /** The easter egg's breach, once the cave's is known (breakout.ts breachOf), with its stars and its cracks. */
  private breach: Breach | null = null
  private stars: Star[] = []
  /** Each crack, from the wall into the rock, as points in the breach's frame (out, along). */
  private cracks: [number, number][][] = []
  private rubble: Rubble[] = []
  /** When your ship set down on the moon this run, for its flag going up. */
  private planted = false
  private plantedAt = -1
  /** The moment the test cave's moving things are drawn at: the run's clock (SceneFrame t). */
  private now = 0

  constructor(canvas: HTMLCanvasElement, cave: Cave) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Lander: no 2D canvas')
    this.canvas = canvas
    this.ctx = ctx
    this.cave = cave
    // Flecks in the rock, as a tile that stays put with the rock.
    const tile = document.createElement('canvas')
    tile.width = tile.height = 96
    const g = tile.getContext('2d')
    if (g) {
      const rnd = mulberry32(99)
      g.fillStyle = C.fleck
      for (let i = 0; i < 26; i++) {
        const s = 1 + rnd() * 2.2
        g.fillRect(rnd() * 96, rnd() * 96, s, s)
      }
    }
    this.fleck = ctx.createPattern(tile, 'repeat')
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
  }

  /**
   * The cave's breach, to draw from now on: it waits on the blue ship's flight to know where it is. Its stars
   * and cracks are the same every time, from where it is.
   */
  meet(breach: Breach | null) {
    this.breach = breach
    this.stars = []
    this.cracks = []
    if (!breach) return
    const rnd = mulberry32((Math.round(breach.x * 97) ^ Math.round(breach.y * 31)) >>> 0)
    const R = breach.far + 3
    while (this.stars.length < 170) {
      const out = rnd() * R
      const along = (rnd() * 2 - 1) * R
      if (out * out + along * along <= R * R) this.stars.push({ out: breach.deep + out, along, size: 0.05 + rnd() ** 3 * 0.17, phase: rnd() * Math.PI * 2 })
    }
    // From the wall, jagged, into the rock: spread across the patch, the first few shown in its middle and at
    // either side, each starting where the rock does, since the wall may bend a little across it.
    const N = this.cave.nodes
    let hint = 0
    N.forEach((p, i) => {
      if ((p.x - breach.x) ** 2 + (p.y - breach.y) ** 2 < (N[hint]!.x - breach.x) ** 2 + (N[hint]!.y - breach.y) ** 2) hint = i
    })
    for (const slot of [3, 1, 5, 0, 6, 2, 4]) {
      let along = (((slot + 0.5) / 7) * 2 - 1) * (breach.wide / 2 - 0.3) + (rnd() - 0.5) * 0.25
      let out = -0.8
      while (out < 0.6 && inAir(this.cave, breach.x + breach.ux * out - breach.uy * along, breach.y + breach.uy * out + breach.ux * along, hint)) out += 0.05
      const line: [number, number][] = [[out, along]]
      const reach = out + 0.7 + rnd() * 1.3
      while (out < reach) {
        out += 0.18 + rnd() * 0.24
        along = clamp(along + (rnd() - 0.5) * 0.5, -breach.wide / 2, breach.wide / 2)
        line.push([out, along])
      }
      this.cracks.push(line)
    }
  }

  /** The patch gives: chunks of it tumble out through the hole. */
  breakOut() {
    const b = this.breach
    if (!b) return
    for (let k = 0; k < 18; k++) {
      const out = Math.random() * b.deep
      const along = (Math.random() * 2 - 1) * (b.wide / 2)
      const sp = 2 + Math.random() * 5
      this.rubble.push({
        x: b.x + b.ux * out - b.uy * along,
        y: b.y + b.uy * out + b.ux * along,
        vx: b.ux * sp + (Math.random() - 0.5) * 3,
        vy: b.uy * sp + (Math.random() - 0.3) * 3,
        a: Math.random() * 6,
        spin: (Math.random() - 0.5) * 8,
        size: 0.15 + Math.random() * 0.35,
        life: 1.2 + Math.random() * 0.8,
      })
    }
  }

  /** The camera jumps to the ship at the next frame, rather than gliding there: a new run, or back at a gate. */
  snap() {
    this.cam.snap = true
    this.sparks.length = 0
  }

  /** The ship comes apart: its four edges fly off, in a cloud of sparks. */
  crash(ship: { x: number; y: number; a: number; vx: number; vy: number }, wreckFor: number) {
    this.shards = []
    this.wreckFor = wreckFor
    for (let i = 0; i < 4; i++) {
      const p = OUTLINE[i]!
      const q = OUTLINE[(i + 1) % 4]!
      const a = toWorld(ship, p[0], p[1])
      const b = toWorld(ship, q[0], q[1])
      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      const out = Math.atan2(my - ship.y, mx - ship.x)
      this.shards.push({
        x: mx,
        y: my,
        vx: ship.vx * 0.3 + Math.cos(out) * (3 + Math.random() * 4),
        vy: ship.vy * 0.3 + Math.sin(out) * (3 + Math.random() * 4),
        a: Math.atan2(b[1] - a[1], b[0] - a[0]),
        spin: (Math.random() - 0.5) * 12,
        half: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2,
      })
    }
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 9
      this.sparks.push({ x: ship.x, y: ship.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.5 + Math.random() * 0.6, max: 1.1, hot: true })
    }
  }

  frame(f: SceneFrame, dt: number) {
    const { ctx, W, H } = this
    if (W <= 0 || H <= 0) return
    this.time += dt
    this.now = f.t ?? this.time
    if (f.mode === 'menu') {
      const g = f.ghost
      if (f.calm || !g) this.follow(this.cave.spawn.x, this.cave.spawn.y + 4, 0, 0, dt)
      else this.follow(g.x, g.y, 0, 0, dt)
    } else this.follow(f.ship.x, f.ship.y, f.ship.vx, f.ship.vy, dt)

    // Engine sparks, some 65 to 115 a second, more the harder the engine's pushing.
    if (f.mode === 'play' && f.engine > 0.05) {
      const n = dt * 120 * (0.55 + f.engine * 0.4)
      let count = Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0)
      while (count-- > 0) this.spark(f.ship)
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.drawCave(f)
    if (f.out?.planted && !this.planted) this.plantedAt = this.time
    this.planted = Boolean(f.out?.planted)
    this.drawBreach(f)
    this.drawRubble(dt)
    // At the start card a ghost that isn't flying (one whose path isn't known yet) would sit on your ship: it waits unseen.
    const ghostShown = f.ghost && !f.ghost.wrecked && !(f.mode === 'menu' && f.ghost.done)
    if (f.ghost && ghostShown) this.drawGhost(f.ghost, f.ghostTag, f.ghostMine, f.mode !== 'done' && !f.ghost.done, f.ghostSkin ?? null)
    if (f.mode === 'wreck') this.drawShards(dt)
    else if (f.mode === 'menu') this.drawShip(this.cave.spawn.x, this.cave.spawn.y, 0, 0, f.skin ?? null)
    else this.drawShip(f.ship.x, f.ship.y, f.ship.a, f.mode === 'play' ? f.engine : 0, f.skin ?? null)
    this.drawSparks(dt)
    if (f.mode === 'play') this.drawLandingGuide(f.ship)
  }

  dispose() {
    this.sparks.length = 0
    this.shards.length = 0
    this.rubble.length = 0
  }

  /* ---------- the camera ---------- */

  private follow(x: number, y: number, vx: number, vy: number, dt: number) {
    const { cam, W, H } = this
    const tx = x + clamp(vx * 0.35, -9, 9)
    const ty = y + clamp(vy * 0.35, -9, 9)
    // Portrait screens see further up and down; wide ones further across. Faster, the view pulls back.
    const k = Math.min(W, H) / 27 / (1 + Math.hypot(vx, vy) / 45)
    if (cam.snap) {
      cam.x = tx
      cam.y = ty
      cam.k = k
      cam.snap = false
      return
    }
    const f = 1 - Math.exp(-dt * 4.5)
    cam.x += (tx - cam.x) * f
    cam.y += (ty - cam.y) * f
    cam.k += (k - cam.k) * (1 - Math.exp(-dt * 1.5))
  }

  private sx(x: number) {
    return (x - this.cam.x) * this.cam.k + this.W / 2
  }

  private sy(y: number) {
    return this.H / 2 - (y - this.cam.y) * this.cam.k
  }

  /* ---------- the cave ---------- */

  private wallColor(y: number, alpha: number) {
    const box = this.cave.box
    const f = clamp((box[3] - y) / (box[3] - box[2]), 0, 1)
    const c = C.wallTop.map((v, i) => Math.round(lerp(v, C.wallDeep[i]!, f)))
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`
  }

  /** The nodes whose circles reach into view, as one span of indices (the cave never folds back into view far off). */
  private spanInView(): [number, number] {
    const { cam, W, H } = this
    const hw = W / 2 / cam.k + 14
    const hh = H / 2 / cam.k + 14
    const N = this.cave.nodes
    let lo = -1
    let hi = -1
    for (let i = 0; i < N.length; i++) {
      const a = N[i]!
      if (Math.abs(a.x - cam.x) < hw + a.r && Math.abs(a.y - cam.y) < hh + a.r) {
        if (lo < 0) lo = i
        hi = i
      }
    }
    if (lo < 0) return [0, -1]
    return [Math.max(0, lo - 1), Math.min(N.length - 1, hi + 1)]
  }

  /**
   * The cave in view as two walls: a line down each side, `r` out from the middle. `air` is the space between
   * them, with the round ends of the tunnel and the two rooms; `edge` is every wall line, to stroke.
   */
  private caveShapes(span: [number, number]) {
    const { cave, cam, W, H } = this
    const N = cave.nodes
    const left: [number, number][] = []
    const right: [number, number][] = []
    for (let i = span[0]; i <= span[1]; i++) {
      const a = N[Math.max(0, i - 1)]!
      const b = N[Math.min(N.length - 1, i + 1)]!
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const nx = -(b.y - a.y) / L
      const ny = (b.x - a.x) / L
      const p = N[i]!
      left.push([this.sx(p.x + nx * p.r), this.sy(p.y + ny * p.r)])
      right.push([this.sx(p.x - nx * p.r), this.sy(p.y - ny * p.r)])
    }
    const air = new Path2D()
    const edge = new Path2D()
    if (left.length) {
      air.moveTo(left[0]![0], left[0]![1])
      for (const q of left) air.lineTo(q[0], q[1])
      for (let i = right.length - 1; i >= 0; i--) air.lineTo(right[i]![0], right[i]![1])
      air.closePath()
      edge.moveTo(left[0]![0], left[0]![1])
      for (const q of left) edge.lineTo(q[0], q[1])
      edge.moveTo(right[0]![0], right[0]![1])
      for (const q of right) edge.lineTo(q[0], q[1])
    }
    // The tunnel's two ends are round, where they open into the rooms.
    for (const i of [0, N.length - 1]) {
      if (i < span[0] || i > span[1]) continue
      const p = N[i]!
      air.moveTo(this.sx(p.x) + p.r * cam.k, this.sy(p.y))
      air.arc(this.sx(p.x), this.sy(p.y), p.r * cam.k, 0, Math.PI * 2)
      edge.moveTo(this.sx(p.x) + p.r * cam.k, this.sy(p.y))
      edge.arc(this.sx(p.x), this.sy(p.y), p.r * cam.k, 0, Math.PI * 2)
    }
    for (const m of cave.rooms) {
      if (m.x1 < cam.x - W / 2 / cam.k - 4 || m.x0 > cam.x + W / 2 / cam.k + 4) continue
      if (m.y1 < cam.y - H / 2 / cam.k - 4 || m.y0 > cam.y + H / 2 / cam.k + 4) continue
      air.rect(this.sx(m.x0), this.sy(m.y1), (m.x1 - m.x0) * cam.k, (m.y1 - m.y0) * cam.k)
      edge.rect(this.sx(m.x0), this.sy(m.y1), (m.x1 - m.x0) * cam.k, (m.y1 - m.y0) * cam.k)
    }
    // The test cave's shortcut: a tunnel of its own, traced the same way round so its air joins the cave's.
    for (const B of cave.lab?.branches ?? []) this.tunnelShape(B, air, edge)
    return { air, edge }
  }

  /** A whole tunnel's two walls and round ends, added to the cave's air and edges. */
  private tunnelShape(N: readonly CaveNode[], air: Path2D, edge: Path2D) {
    const { cam } = this
    const left: [number, number][] = []
    const right: [number, number][] = []
    for (let i = 0; i < N.length; i++) {
      const a = N[Math.max(0, i - 1)]!
      const b = N[Math.min(N.length - 1, i + 1)]!
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const nx = -(b.y - a.y) / L
      const ny = (b.x - a.x) / L
      const p = N[i]!
      left.push([this.sx(p.x + nx * p.r), this.sy(p.y + ny * p.r)])
      right.push([this.sx(p.x - nx * p.r), this.sy(p.y - ny * p.r)])
    }
    if (!left.length) return
    air.moveTo(left[0]![0], left[0]![1])
    for (const q of left) air.lineTo(q[0], q[1])
    for (let i = right.length - 1; i >= 0; i--) air.lineTo(right[i]![0], right[i]![1])
    air.closePath()
    edge.moveTo(left[0]![0], left[0]![1])
    for (const q of left) edge.lineTo(q[0], q[1])
    edge.moveTo(right[0]![0], right[0]![1])
    for (const q of right) edge.lineTo(q[0], q[1])
    for (const p of [N[0]!, N[N.length - 1]!]) {
      air.moveTo(this.sx(p.x) + p.r * cam.k, this.sy(p.y))
      air.arc(this.sx(p.x), this.sy(p.y), p.r * cam.k, 0, Math.PI * 2)
    }
  }

  private drawCave(f: SceneFrame) {
    const { ctx, cam, W, H, cave } = this
    // The rock.
    ctx.fillStyle = C.rock
    ctx.fillRect(0, 0, W, H)
    if (this.fleck) {
      ctx.save()
      const ox = (-cam.x * cam.k) % 96
      const oy = (cam.y * cam.k) % 96
      ctx.translate(ox, oy)
      ctx.fillStyle = this.fleck
      ctx.fillRect(-ox - 96, -oy - 96, W + 192, H + 192)
      ctx.restore()
    }

    const span = this.spanInView()
    const wall = this.wallColor(cam.y, 1)
    const { air, edge } = this.caveShapes(span)
    // Light spilling off the walls into the rock, then the lit edge; the air then covers the inner halves.
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const [width, alpha] of [
      [4.4, 0.035],
      [3.3, 0.04],
      [2.3, 0.05],
      [1.4, 0.07],
      [0.44, 1],
    ] as const) {
      ctx.lineWidth = width * cam.k
      ctx.strokeStyle = alpha === 1 ? wall : this.wallColor(cam.y, alpha)
      ctx.stroke(edge)
    }
    ctx.fillStyle = C.air
    ctx.fill(air)

    // A grid in the air, every 4 m, fixed to the cave.
    ctx.save()
    ctx.clip(air)
    ctx.strokeStyle = C.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    const step = 4
    const x0 = Math.floor((cam.x - W / 2 / cam.k) / step) * step
    const x1 = cam.x + W / 2 / cam.k
    const y0 = Math.floor((cam.y - H / 2 / cam.k) / step) * step
    const y1 = cam.y + H / 2 / cam.k
    for (let x = x0; x <= x1; x += step) {
      ctx.moveTo(Math.round(this.sx(x)) + 0.5, 0)
      ctx.lineTo(Math.round(this.sx(x)) + 0.5, H)
    }
    for (let y = y0; y <= y1 + step; y += step) {
      ctx.moveTo(0, Math.round(this.sy(y)) + 0.5)
      ctx.lineTo(W, Math.round(this.sy(y)) + 0.5)
    }
    ctx.stroke()
    ctx.restore()
    this.drawLava(air)
    this.drawLabAir(air)

    // Pillars: rock, lit round the edge.
    for (const p of cave.pillars) {
      if (Math.abs(p.x - cam.x) > W / 2 / cam.k + 6 || Math.abs(p.y - cam.y) > H / 2 / cam.k + 6) continue
      ctx.beginPath()
      ctx.arc(this.sx(p.x), this.sy(p.y), p.r * cam.k, 0, Math.PI * 2)
      ctx.fillStyle = wall
      ctx.fill()
      ctx.beginPath()
      ctx.arc(this.sx(p.x), this.sy(p.y), Math.max(0, p.r - 0.22) * cam.k, 0, Math.PI * 2)
      ctx.fillStyle = C.rock
      ctx.fill()
      ctx.fillStyle = this.wallColor(p.y, 0.13)
      ctx.fill()
    }

    this.drawLabSolids()
    this.drawGates(f)
    this.drawPads()
  }

  private drawGates(f: SceneFrame) {
    const { ctx, cam, cave } = this
    ctx.save()
    ctx.lineCap = 'round'
    cave.gates.forEach((g, i) => {
      const passed = f.mode !== 'menu' && f.gate >= i
      const next = f.mode !== 'menu' && f.gate + 1 === i
      const color = passed ? C.passed : C.gate
      ctx.strokeStyle = color
      ctx.globalAlpha = passed ? 0.75 : next ? 1 : 0.6
      ctx.lineWidth = Math.max(1.5, 0.16 * cam.k)
      ctx.setLineDash([0.9 * cam.k, 0.7 * cam.k])
      ctx.beginPath()
      ctx.moveTo(this.sx(g.x0), this.sy(g.y0))
      ctx.lineTo(this.sx(g.x1), this.sy(g.y1))
      ctx.stroke()
      ctx.setLineDash([])
      // Posts at the ends.
      ctx.fillStyle = color
      for (const [x, y] of [
        [g.x0, g.y0],
        [g.x1, g.y1],
      ] as const) {
        ctx.beginPath()
        ctx.arc(this.sx(x), this.sy(y), Math.max(2.5, 0.28 * cam.k), 0, Math.PI * 2)
        ctx.fill()
      }
      // Its number, over its middle.
      ctx.globalAlpha = passed ? 0.6 : 0.9
      ctx.font = `700 ${Math.max(11, 0.75 * cam.k)}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const label = i === cave.gates.length - 1 ? 'ROOM' : `${i + 1}`
      ctx.fillText(label, this.sx((g.x0 + g.x1) / 2), this.sy((g.y0 + g.y1) / 2) - 0.9 * cam.k)
    })
    ctx.restore()
  }

  private drawPads() {
    const { ctx, cam } = this
    const lift = this.cave.lab?.lift
    for (const pad of this.cave.pads) {
      const x0 = this.sx(pad.x0)
      const x1 = this.sx(pad.x1)
      const top = pad.end && lift ? liftAt(lift, this.now).y : pad.y
      const y = this.sy(top)
      if (pad.end && lift) this.drawPiston(pad.x0, pad.x1, top, lift.y0)
      const h = Math.max(3, 0.3 * cam.k)
      if (pad.end) {
        // Light rising off the landing pad.
        const wash = ctx.createLinearGradient(0, y, 0, y - 3 * cam.k)
        wash.addColorStop(0, 'rgba(255, 179, 71, 0.2)')
        wash.addColorStop(1, 'rgba(255, 179, 71, 0)')
        ctx.fillStyle = wash
        ctx.fillRect(x0, y - 3 * cam.k, x1 - x0, 3 * cam.k)
      }
      ctx.fillStyle = pad.end ? C.pad : 'rgba(255, 179, 71, 0.65)'
      ctx.fillRect(x0, y - h, x1 - x0, h)
      // Lights along it, running toward the middle on the landing pad.
      const n = 6
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n
        const on = pad.end ? ((Math.floor(this.time * 6 - Math.abs(f - 0.5) * 6) % 3) + 3) % 3 === 0 : i % 2 === 0
        ctx.beginPath()
        ctx.arc(lerp(x0, x1, f), y - h - Math.max(2, 0.18 * cam.k), Math.max(1.6, 0.13 * cam.k), 0, Math.PI * 2)
        ctx.fillStyle = on ? '#fff4d6' : 'rgba(255, 179, 71, 0.35)'
        ctx.fill()
      }
      ctx.font = `800 ${Math.max(11, 0.8 * cam.k)}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = pad.end ? C.pad : 'rgba(255, 179, 71, 0.6)'
      ctx.fillText(pad.end ? 'LAND HERE' : 'START', (x0 + x1) / 2, y + Math.max(16, 1.4 * cam.k))
    }
  }

  /* ---------- the way out (breakout.ts) ---------- */

  /** A point in the breach's frame (how far out through the wall, how far along it), on the screen. */
  private atBreach(b: Breach, out: number, along: number): [number, number] {
    return [this.sx(b.x + b.ux * out - b.uy * along), this.sy(b.y + b.uy * out + b.ux * along)]
  }

  /** The breach, when it's in view: the cracked patch, or, broken through, the way out and the space past it. */
  private drawBreach(f: SceneFrame) {
    const b = this.breach
    if (!b) return
    const { cam, W, H } = this
    const reach = b.far + 6
    const mx = b.x + b.ux * b.deep
    const my = b.y + b.uy * b.deep
    if (Math.abs(mx - cam.x) > W / 2 / cam.k + reach || Math.abs(my - cam.y) > H / 2 / cam.k + reach) return
    if (f.out?.broke) this.drawSpace(b)
    else this.drawCracks(b, f.out?.knocks ?? 0)
  }

  /**
   * The patch, whole: cracks running from the wall into the rock, with starlight showing in them, faint, the
   * egg's clue. Every knock opens more of them.
   */
  private drawCracks(b: Breach, knocks: number) {
    const { ctx, cam } = this
    const shown = Math.min(this.cracks.length, 3 + Math.round((knocks / KNOCKS) * 4))
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = this.wallColor(b.y, 0.5 + knocks * 0.12)
    ctx.lineWidth = Math.max(1, (0.05 + knocks * 0.02) * cam.k)
    ctx.beginPath()
    for (const line of this.cracks.slice(0, shown)) {
      line.forEach(([out, along], i) => {
        const [px, py] = this.atBreach(b, out, along)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
    }
    ctx.stroke()
    // Starlight through them: a speck at each crack's deep end, twinkling, a little cross of light at its brightest.
    ctx.fillStyle = C.star
    this.cracks.slice(0, shown).forEach((line, i) => {
      const [out, along] = line[line.length - 1]!
      const [px, py] = this.atBreach(b, out, along)
      const tw = 0.5 + 0.5 * Math.sin(this.time * 2.3 + i * 1.7)
      const s = Math.max(1.6, 0.09 * cam.k)
      ctx.globalAlpha = 0.35 + 0.6 * tw
      ctx.fillRect(px - s / 2, py - s / 2, s, s)
      const arm = s * (0.8 + 1.4 * tw)
      ctx.globalAlpha = 0.3 * tw
      ctx.fillRect(px - arm, py - s * 0.2, arm * 2, s * 0.4)
      ctx.fillRect(px - s * 0.2, py - arm, s * 0.4, arm * 2)
    })
    ctx.restore()
  }

  /**
   * Broken through: the way out through the wall, lit at its sides, and the space past it, stars to its edge,
   * where it fades into the dark, the Earth far off, the rock face of the cave behind, and the moon.
   */
  private drawSpace(b: Breach) {
    const { ctx, cam } = this
    const R = b.far + 3
    const space = new Path2D()
    for (let k = 0; k <= 48; k++) {
      const t = -Math.PI / 2 + (Math.PI * k) / 48
      const [px, py] = this.atBreach(b, b.deep + R * Math.cos(t), R * Math.sin(t))
      if (k === 0) space.moveTo(px, py)
      else space.lineTo(px, py)
    }
    space.closePath()
    const [cx, cy] = this.atBreach(b, b.deep, 0)
    const deep = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * cam.k)
    deep.addColorStop(0, C.space)
    deep.addColorStop(0.72, C.space)
    deep.addColorStop(1, C.rock)
    ctx.fillStyle = deep
    ctx.fill(space)

    ctx.save()
    ctx.clip(space)
    ctx.fillStyle = C.star
    for (const s of this.stars) {
      const fade = clamp((1 - Math.hypot(s.out - b.deep, s.along) / R) * 3.5, 0, 1)
      ctx.globalAlpha = fade * (0.55 + 0.45 * Math.sin(this.time * 1.7 + s.phase))
      const [px, py] = this.atBreach(b, s.out, s.along)
      const size = Math.max(1, s.size * cam.k)
      ctx.fillRect(px - size / 2, py - size / 2, size, size)
    }
    ctx.globalAlpha = 1
    // The Earth, far off and up: it's one small step from there.
    const ex = this.sx(b.x + b.ux * (b.deep + b.far * 0.6))
    const ey = this.sy(b.y + b.uy * (b.deep + b.far * 0.6) + b.far * 0.42)
    const er = 1.15 * cam.k
    ctx.beginPath()
    ctx.arc(ex, ey, er, 0, Math.PI * 2)
    ctx.fillStyle = C.earth
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.fillStyle = C.land
    ctx.beginPath()
    ctx.ellipse(ex - er * 0.25, ey - er * 0.1, er * 0.42, er * 0.3, 0.6, 0, Math.PI * 2)
    ctx.ellipse(ex + er * 0.45, ey + er * 0.45, er * 0.3, er * 0.18, -0.4, 0, Math.PI * 2)
    ctx.fill()
    // Its night side.
    ctx.fillStyle = 'rgba(4, 3, 11, 0.55)'
    ctx.beginPath()
    ctx.arc(ex + er * 0.55, ey + er * 0.2, er * 1.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.restore()

    // The rock face the way out comes through, lit faintly by the stars, fading off either way.
    const [ax, ay] = this.atBreach(b, b.deep, -R)
    const [bx, by] = this.atBreach(b, b.deep, R)
    const faceLine = ctx.createLinearGradient(ax, ay, bx, by)
    const [fr, fg, fb] = C.face
    faceLine.addColorStop(0, `rgba(${fr}, ${fg}, ${fb}, 0)`)
    faceLine.addColorStop(0.35, `rgba(${fr}, ${fg}, ${fb}, 0.5)`)
    faceLine.addColorStop(0.65, `rgba(${fr}, ${fg}, ${fb}, 0.5)`)
    faceLine.addColorStop(1, `rgba(${fr}, ${fg}, ${fb}, 0)`)
    ctx.strokeStyle = faceLine
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(1.5, 0.12 * cam.k)
    ctx.beginPath()
    for (const [from, to] of [
      [-R, -b.wide / 2],
      [b.wide / 2, R],
    ] as const) {
      const [px, py] = this.atBreach(b, b.deep, from)
      const [qx, qy] = this.atBreach(b, b.deep, to)
      ctx.moveTo(px, py)
      ctx.lineTo(qx, qy)
    }
    ctx.stroke()

    // The way out: the cave's air turning to the space's, its sides lit like the walls.
    const corners = [
      this.atBreach(b, -0.6, -b.wide / 2),
      this.atBreach(b, b.deep + 0.05, -b.wide / 2),
      this.atBreach(b, b.deep + 0.05, b.wide / 2),
      this.atBreach(b, -0.6, b.wide / 2),
    ]
    const [ix, iy] = this.atBreach(b, 0, 0)
    const through = ctx.createLinearGradient(ix, iy, cx, cy)
    through.addColorStop(0, C.air)
    through.addColorStop(1, C.space)
    ctx.fillStyle = through
    ctx.beginPath()
    corners.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)))
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = this.wallColor(b.y, 1)
    ctx.lineWidth = 0.44 * cam.k
    ctx.beginPath()
    for (const side of [-1, 1]) {
      const [px, py] = this.atBreach(b, 0, (side * b.wide) / 2)
      const [qx, qy] = this.atBreach(b, b.deep, (side * b.wide) / 2)
      ctx.moveTo(px, py)
      ctx.lineTo(qx, qy)
    }
    ctx.stroke()

    this.drawMoon(b)
  }

  /** The moon: grey, cratered, its top cut flat with a pad on it, and a flag on it once your ship's been down. */
  private drawMoon(b: Breach) {
    const { ctx, cam } = this
    const mx = this.sx(b.moon.x)
    const my = this.sy(b.moon.y)
    const r = b.moon.r * cam.k
    const top = this.sy(b.pad.y)
    ctx.save()
    ctx.beginPath()
    ctx.rect(mx - r - 2, top, r * 2 + 4, r * 2 + 4)
    ctx.clip()
    const lit = ctx.createRadialGradient(mx - r * 0.4, my - r * 0.5, r * 0.2, mx, my, r)
    lit.addColorStop(0, C.moon)
    lit.addColorStop(1, C.moonDark)
    ctx.fillStyle = lit
    ctx.beginPath()
    ctx.arc(mx, my, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = C.crater
    for (const [dx, dy, cr] of [
      [-0.35, 0.25, 0.22],
      [0.3, 0.5, 0.16],
      [0.05, 0.02, 0.12],
    ] as const) {
      ctx.beginPath()
      ctx.arc(mx + dx * r, my + dy * r, cr * r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    // Its flat top, and the pad on it: lights blinking till it's been landed on, then lit.
    const x0 = this.sx(b.pad.x0)
    const x1 = this.sx(b.pad.x1)
    const h = Math.max(2.5, 0.22 * cam.k)
    ctx.fillStyle = 'rgba(255, 179, 71, 0.8)'
    ctx.fillRect(x0, top - h, x1 - x0, h)
    for (let i = 0; i < 4; i++) {
      const f = (i + 0.5) / 4
      const on = this.planted || ((Math.floor(this.time * 2.5) + i) & 1) === 0
      ctx.beginPath()
      ctx.arc(lerp(x0, x1, f), top - h - Math.max(2, 0.16 * cam.k), Math.max(1.4, 0.11 * cam.k), 0, Math.PI * 2)
      ctx.fillStyle = on ? '#fff4d6' : 'rgba(255, 179, 71, 0.35)'
      ctx.fill()
    }
    if (!this.planted) return
    // The flag, going up by the ship, waving; and what it means, for a moment over it.
    const since = this.time - this.plantedAt
    const rise = ease(since / 0.6)
    const px = this.sx(b.pad.x1 - 0.3)
    const pole = 1.7 * cam.k * rise
    ctx.strokeStyle = '#ece8f6'
    ctx.lineWidth = Math.max(1.5, 0.07 * cam.k)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(px, top - h)
    ctx.lineTo(px, top - h - pole)
    ctx.stroke()
    if (rise > 0.9) {
      const fw = 0.85 * cam.k
      const fh = 0.5 * cam.k
      const y0 = top - h - pole
      ctx.fillStyle = C.flag
      ctx.beginPath()
      ctx.moveTo(px, y0)
      for (let k = 0; k <= 8; k++) {
        const t = k / 8
        ctx.lineTo(px + fw * t, y0 + Math.sin(this.time * 6 - t * 4) * 0.06 * cam.k * t)
      }
      for (let k = 8; k >= 0; k--) {
        const t = k / 8
        ctx.lineTo(px + fw * t, y0 + fh + Math.sin(this.time * 6 - t * 4) * 0.06 * cam.k * t)
      }
      ctx.closePath()
      ctx.fill()
    }
    const words = clamp(Math.min(since / 0.4, (4 - since) / 0.6), 0, 1)
    if (words > 0) {
      ctx.save()
      ctx.globalAlpha = words
      ctx.font = `800 ${Math.max(12, 0.85 * cam.k)}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = C.star
      ctx.fillText('ONE SMALL STEP', mx, top - h - 2.8 * cam.k)
      ctx.restore()
    }
  }

  /** The broken patch's chunks, tumbling and falling, fading as they go. */
  private drawRubble(dt: number) {
    const { ctx, cam, rubble } = this
    if (!rubble.length) return
    ctx.save()
    for (let i = rubble.length - 1; i >= 0; i--) {
      const p = rubble[i]!
      p.life -= dt
      if (p.life <= 0) {
        rubble.splice(i, 1)
        continue
      }
      p.vy -= G * 0.8 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.a += p.spin * dt
      ctx.globalAlpha = clamp(p.life / 0.6, 0, 1)
      ctx.save()
      ctx.translate(this.sx(p.x), this.sy(p.y))
      ctx.rotate(p.a)
      const s = p.size * cam.k
      ctx.fillStyle = C.rock
      ctx.strokeStyle = this.wallColor(p.y, 0.8)
      ctx.lineWidth = Math.max(1, 0.04 * cam.k)
      ctx.beginPath()
      ctx.moveTo(-s, -s * 0.6)
      ctx.lineTo(s * 0.7, -s)
      ctx.lineTo(s, s * 0.5)
      ctx.lineTo(-s * 0.4, s)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()
  }

  /* ---------- the ships ---------- */

  private traceShip(x: number, y: number, a: number) {
    const { ctx } = this
    ctx.beginPath()
    OUTLINE.forEach(([px, py], i) => {
      const [wx, wy] = toWorld({ x, y, a }, px, py)
      if (i === 0) ctx.moveTo(this.sx(wx), this.sy(wy))
      else ctx.lineTo(this.sx(wx), this.sy(wy))
    })
    ctx.closePath()
  }

  private drawFlame(x: number, y: number, a: number, level: number, colors: readonly [string, string]) {
    if (level <= 0.02) return
    const { ctx } = this
    const f = 0.75 + Math.random() * 0.45
    const len = (0.9 + 1.5 * level) * f
    const root = SHIP.notch[1]
    for (const [L, half, col] of [
      [len, 0.42, colors[0]],
      [len * 0.55, 0.22, colors[1]],
    ] as const) {
      ctx.beginPath()
      const pts = [
        [-half, root],
        [0, root - L],
        [half, root],
      ] as const
      pts.forEach(([px, py], i) => {
        const [wx, wy] = toWorld({ x, y, a }, px, py)
        if (i === 0) ctx.moveTo(this.sx(wx), this.sy(wy))
        else ctx.lineTo(this.sx(wx), this.sy(wy))
      })
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
    }
  }

  private drawShip(x: number, y: number, a: number, level: number, skin: string | null) {
    const { ctx, cam } = this
    const art = skin ? LANDER_ART[skin] : undefined
    if (art) {
      this.drawFlame(x, y, a, level, ['rgba(242, 129, 58, 0.92)', 'rgba(245, 185, 66, 0.95)'])
      this.drawSkinShip(x, y, a, art)
      return
    }
    this.drawFlame(x, y, a, level, ['rgba(255, 140, 50, 0.92)', 'rgba(255, 236, 170, 0.95)'])
    ctx.save()
    this.traceShip(x, y, a)
    ctx.lineJoin = 'round'
    // A soft halo of engine light round the hull, then the hull.
    ctx.lineWidth = Math.max(6, 0.7 * cam.k)
    ctx.strokeStyle = 'rgba(255, 159, 69, 0.16)'
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 159, 69, 0.22)'
    ctx.fill()
    ctx.lineWidth = Math.max(2, 0.17 * cam.k)
    ctx.strokeStyle = C.ship
    ctx.stroke()
    ctx.restore()
    // The cockpit.
    const [cx, cy] = toWorld({ x, y, a }, 0, 0.35)
    ctx.beginPath()
    ctx.arc(this.sx(cx), this.sy(cy), Math.max(2, 0.17 * cam.k), 0, Math.PI * 2)
    ctx.fillStyle = C.ship
    ctx.fill()
  }

  /**
   * A skin's ship (Season 1's Moonhopper and the rest, lib/skins.ts), drawn from the pass's own picture
   * (lib/skinArt.ts): its feet on the hull's feet, its dome over the nose. The hull is still what meets the
   * rock, and every point of it is on the drawing, so it lands and crashes as the usual ship does.
   */
  private drawSkinShip(x: number, y: number, a: number, art: SkinArt, alpha = 1) {
    const { ctx, cam } = this
    const k = cam.k * HOPPER_SCALE
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(this.sx(x), this.sy(y))
    ctx.rotate(a)
    ctx.scale(k, k)
    // The board's feet (y 86) on the hull's feet, its middle on the ship's.
    ctx.translate(-50, -86 + FOOT / HOPPER_SCALE)
    drawSkinArt(ctx, art.body, 1.2 / k)
    ctx.restore()
  }

  private drawGhost(g: GhostPose, name: string, mine: boolean, flying: boolean, skin: string | null) {
    const { ctx, cam } = this
    const color = mine ? C.mine : C.ghost
    if (flying && g.engine) this.drawFlame(g.x, g.y, g.a, 0.8, ['rgba(70, 228, 255, 0.35)', 'rgba(200, 248, 255, 0.45)'])
    ctx.save()
    const art = skin ? LANDER_ART[skin] : undefined
    if (art) {
      // In the skin it was flown in, faded as a ghost is, so it never reads as a second ship of yours.
      this.drawSkinShip(g.x, g.y, g.a, art, 0.5)
    } else {
      this.traceShip(g.x, g.y, g.a)
      ctx.fillStyle = mine ? 'rgba(245, 185, 66, 0.12)' : 'rgba(70, 228, 255, 0.12)'
      ctx.fill()
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(1.5, 0.12 * cam.k)
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.9
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    // Whose run it is, on a dark pill over it.
    ctx.font = `700 ${Math.max(11, 0.62 * cam.k)}px ${this.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const tx = this.sx(g.x)
    const ty = this.sy(g.y + 2.1)
    const h = Math.max(17, 0.95 * cam.k)
    const w = ctx.measureText(name).width + 14
    ctx.fillStyle = 'rgba(7, 5, 15, 0.75)'
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(tx - w / 2, ty - h, w, h, h / 2)
    else ctx.rect(tx - w / 2, ty - h, w, h)
    ctx.fill()
    ctx.fillStyle = color
    ctx.fillText(name, tx, ty - Math.max(2, 0.1 * cam.k))
    ctx.restore()
  }

  /* ---------- sparks, the wreck, the landing guide ---------- */

  private spark(ship: SceneFrame['ship']) {
    const [nx, ny] = toWorld(ship, 0, -0.55)
    const back = ship.a + Math.PI + (Math.random() - 0.5) * 0.5
    const sp = 6 + Math.random() * 6
    this.sparks.push({
      x: nx,
      y: ny,
      vx: ship.vx + Math.sin(back) * sp,
      vy: ship.vy + Math.cos(back) * sp,
      life: 0.25 + Math.random() * 0.3,
      max: 0.55,
      hot: false,
    })
  }

  private drawSparks(dt: number) {
    const { ctx, cam, sparks } = this
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]!
      p.life -= dt
      if (p.life <= 0) {
        sparks.splice(i, 1)
        continue
      }
      p.vy -= G * 0.6 * dt
      p.vx *= 1 - dt * 1.5
      p.vy *= 1 - dt * 1.5
      p.x += p.vx * dt
      p.y += p.vy * dt
      const f = p.life / p.max
      ctx.fillStyle = p.hot ? `rgba(255, ${Math.round(150 + 100 * f)}, ${Math.round(80 * f)}, ${f})` : `rgba(255, ${Math.round(120 + 110 * f)}, 60, ${f * 0.9})`
      const s = Math.max(1.5, 0.12 * cam.k) * (0.6 + f)
      ctx.fillRect(this.sx(p.x) - s / 2, this.sy(p.y) - s / 2, s, s)
    }
  }

  private drawShards(dt: number) {
    const { ctx, cam } = this
    this.wreckFor = Math.max(0, this.wreckFor - dt)
    ctx.save()
    ctx.strokeStyle = C.ship
    ctx.lineWidth = Math.max(2, 0.15 * cam.k)
    ctx.lineCap = 'round'
    ctx.globalAlpha = clamp(this.wreckFor / 0.9, 0, 1)
    for (const s of this.shards) {
      s.vy -= G * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.a += s.spin * dt
      const dx = Math.cos(s.a) * s.half
      const dy = Math.sin(s.a) * s.half
      ctx.beginPath()
      ctx.moveTo(this.sx(s.x - dx), this.sy(s.y - dy))
      ctx.lineTo(this.sx(s.x + dx), this.sy(s.y + dy))
      ctx.stroke()
    }
    ctx.restore()
  }

  /* ---------- the test cave's things (sim.ts LabCave) ---------- */

  /**
   * Lava, Ramsey's pick of four looks (2026-10-06; a slab of hot rock "didn't blend well with the cave"): a
   * molten layer lying along the floor, its top rolling a little, glowing up into the air with embers rising
   * off it. It's drawn over the air, and only where there's air: the rock under it stays rock.
   */
  private drawLava(air: Path2D) {
    const { ctx, cam } = this
    const lava = this.cave.lab?.lava
    if (!lava?.length) return
    for (const l of lava) {
      const x0 = this.sx(l.x0)
      const x1 = this.sx(l.x1)
      const top = this.sy(l.y1)
      if (x1 < 0 || x0 > this.W || top - 4 * cam.k > this.H || top + cam.k < 0) continue
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 1.7)
      ctx.save()
      ctx.clip(air)
      const surface = (x: number) => top + Math.sin(((x - this.W / 2) / cam.k + this.cam.x) * 1.3 + this.time * 1.6) * 0.07 * cam.k
      const body = new Path2D()
      body.moveTo(x0, this.sy(l.y1 - 1.6))
      for (let x = x0; x < x1; x += 5) body.lineTo(x, surface(x))
      body.lineTo(x1, surface(x1))
      body.lineTo(x1, this.sy(l.y1 - 1.6))
      body.closePath()
      const melt = ctx.createLinearGradient(0, top, 0, this.sy(l.y1 - 1))
      melt.addColorStop(0, '#ffe08a')
      melt.addColorStop(0.35, '#ff8a2a')
      melt.addColorStop(1, '#a8124f')
      ctx.fillStyle = melt
      ctx.fill(body)
      // Heat rising off it.
      const heat = ctx.createLinearGradient(0, top, 0, this.sy(l.y1 + 2.8))
      heat.addColorStop(0, `rgba(255, 110, 40, ${(0.22 * pulse).toFixed(3)})`)
      heat.addColorStop(1, 'rgba(255, 110, 40, 0)')
      ctx.fillStyle = heat
      ctx.fillRect(x0, this.sy(l.y1 + 2.8), x1 - x0, 2.8 * cam.k)
      ctx.restore()
      this.embers(l.x0, l.x1, l.y1)
    }
  }

  /** Embers rising off the lava from x0 to x1, flickering out as they go. */
  private embers(x0: number, x1: number, surface: number) {
    const { ctx, cam } = this
    const rnd = mulberry32(Math.round(Math.abs(x0) * 31) >>> 0)
    for (let i = 0; i < 26; i++) {
      const x = lerp(x0, x1, rnd())
      const speed = 0.35 + rnd() * 0.5
      const up = (rnd() + this.time * speed * 0.4) % 1
      const sway = Math.sin(this.time * 2 + i * 1.7) * 0.25
      const a = (1 - up) * (0.55 + 0.45 * Math.sin(this.time * 9 + i))
      if (a <= 0.02) continue
      ctx.beginPath()
      ctx.arc(this.sx(x + sway), this.sy(surface + 0.2 + up * 3.4), Math.max(1.2, 0.09 * cam.k), 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 200, 100, ${a.toFixed(3)})`
      ctx.fill()
    }
  }

  /** In the air: water with a moving surface and bubbles, the low-gravity bubble's shimmer, and the vents' steam. */
  private drawLabAir(air: Path2D) {
    const lab = this.cave.lab
    if (!lab) return
    const { ctx, cam, W, H } = this
    ctx.save()
    ctx.clip(air)
    for (const p of lab.pools) {
      const x0 = this.sx(p.x0)
      const x1 = this.sx(p.x1)
      const top = this.sy(p.y)
      if (x1 < 0 || x0 > W || top > H) continue
      // The surface rolls, a little.
      const wave = (x: number) => top + Math.sin(((x - W / 2) / cam.k + cam.x) * 0.9 + this.time * 2.2) * 0.12 * cam.k
      const body = new Path2D()
      body.moveTo(x0, H + 10)
      for (let x = x0; x < x1; x += 6) body.lineTo(x, wave(x))
      body.lineTo(x1, wave(x1))
      body.lineTo(x1, H + 10)
      body.closePath()
      const deep = ctx.createLinearGradient(0, top, 0, top + 14 * cam.k)
      deep.addColorStop(0, 'rgba(70, 160, 255, 0.42)')
      deep.addColorStop(1, 'rgba(20, 60, 160, 0.62)')
      ctx.fillStyle = deep
      ctx.fill(body)
      ctx.strokeStyle = 'rgba(170, 225, 255, 0.85)'
      ctx.lineWidth = Math.max(1.5, 0.12 * cam.k)
      ctx.beginPath()
      ctx.moveTo(x0, wave(x0))
      for (let x = x0 + 6; x < x1; x += 6) ctx.lineTo(x, wave(x))
      ctx.lineTo(x1, wave(x1))
      ctx.stroke()
      // Bubbles rising to the surface.
      const rnd = mulberry32(Math.round(Math.abs(p.x0) * 7) >>> 0)
      ctx.fillStyle = 'rgba(200, 235, 255, 0.5)'
      for (let i = 0; i < 26; i++) {
        const bx = lerp(p.x0, p.x1, rnd())
        const rise = (rnd() * 14 + this.time * (0.8 + rnd() * 0.8)) % 14
        ctx.beginPath()
        ctx.arc(this.sx(bx + Math.sin(this.time * 2 + i) * 0.2), this.sy(p.y - 14 + rise), Math.max(1.2, (0.08 + rnd() * 0.1) * cam.k), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    for (const b of lab.bubbles) {
      const cx = this.sx(b.x)
      const cy = this.sy(b.y)
      const r = b.r * cam.k
      if (cx + r < 0 || cx - r > W || cy + r < 0 || cy - r > H) continue
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r)
      glow.addColorStop(0, 'rgba(120, 230, 255, 0.10)')
      glow.addColorStop(1, 'rgba(120, 230, 255, 0.02)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.setLineDash([0.6 * cam.k, 0.5 * cam.k])
      ctx.lineDashOffset = -this.time * 0.6 * cam.k
      ctx.strokeStyle = 'rgba(160, 235, 255, 0.45)'
      ctx.lineWidth = Math.max(1, 0.08 * cam.k)
      ctx.stroke()
      ctx.setLineDash([])
      // Motes drifting up, slowly: there's hardly any weight here.
      const rnd = mulberry32(Math.round(Math.abs(b.x * 11 + b.y)) >>> 0)
      ctx.fillStyle = 'rgba(200, 245, 255, 0.7)'
      for (let i = 0; i < 30; i++) {
        const a = rnd() * Math.PI * 2
        const d = Math.sqrt(rnd()) * b.r * 0.92
        const up = ((rnd() * 2 + this.time * 0.15) % 2) - 1
        const x = b.x + Math.cos(a) * d + Math.sin(this.time * 0.7 + i) * 0.3
        const y = b.y + Math.sin(a) * d * 0.6 + up * b.r * 0.35
        if ((x - b.x) ** 2 + (y - b.y) ** 2 > b.r * b.r) continue
        ctx.beginPath()
        ctx.arc(this.sx(x), this.sy(y), Math.max(1, 0.07 * cam.k), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.font = `700 ${Math.max(10, 0.6 * cam.k)}px ${this.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(160, 235, 255, 0.55)'
      // Its name, under the hall's ceiling: the bubble's own top is up in the rock.
      ctx.fillText('LOW GRAVITY', cx, this.sy(b.y + Math.min(b.r - 1.5, 7)))
    }
    for (const v of lab.vents) {
      const blow = ventBlow(v, this.now)
      const ux = Math.cos(v.dir)
      const uy = Math.sin(v.dir)
      const ox = this.sx(v.x)
      const oy = this.sy(v.y)
      if (Math.hypot(ox - W / 2, oy - H / 2) > Math.hypot(W, H) / 2 + v.reach * cam.k) continue
      // Its nozzle: a grate in the rock, warm while it blows.
      ctx.save()
      ctx.translate(ox, oy)
      ctx.rotate(-v.dir + Math.PI / 2)
      ctx.fillStyle = '#2a2140'
      ctx.fillRect(-v.wide * 0.275 * cam.k, -0.15 * cam.k, v.wide * 0.55 * cam.k, 0.5 * cam.k)
      ctx.fillStyle = blow > 0 ? `rgba(255, 190, 120, ${(0.4 + 0.5 * blow).toFixed(3)})` : 'rgba(140, 120, 190, 0.5)'
      for (let i = -2; i <= 2; i++) ctx.fillRect((i * 0.5 - 0.1) * cam.k, -0.1 * cam.k, 0.2 * cam.k, 0.38 * cam.k)
      ctx.restore()
      // Steam: puffs rising along the jet, thick while it blows, wisps between.
      const rnd = mulberry32(Math.round(Math.abs(v.x * 17 + v.y * 3)) >>> 0)
      const strength = blow > 0 ? blow : 0.12
      for (let i = 0; i < 46; i++) {
        const lane = (rnd() - 0.5) * v.wide * 0.8
        const speed = 7 + rnd() * 6
        const off = rnd()
        const along = ((off + (this.time * speed) / v.reach) % 1) * v.reach
        const share = along / v.reach
        const spread = 0.6 + 0.6 * share
        const r = (0.35 + share * 1.2 + rnd() * 0.3) * cam.k
        const x = v.x + ux * along - uy * lane * spread
        const y = v.y + uy * along + ux * lane * spread
        ctx.beginPath()
        ctx.arc(this.sx(x), this.sy(y), r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(235, 240, 255, ${(0.16 * strength * (1 - share)).toFixed(3)})`
        ctx.fill()
      }
    }
    ctx.restore()
  }

  /** The things that move and crash a ship: the crushers, in hazard stripes, and the turning bar. */
  private drawLabSolids() {
    const lab = this.cave.lab
    if (!lab) return
    const { ctx, cam, W, H } = this
    for (const c of lab.crushers) {
      const b = crusherAt(c, this.now)
      const x0 = this.sx(b.x - c.hw)
      const y0 = this.sy(b.y + c.hh)
      const w = 2 * c.hw * cam.k
      const h = 2 * c.hh * cam.k
      if (x0 > W || x0 + w < 0 || y0 > H || y0 + h < 0) continue
      ctx.save()
      ctx.beginPath()
      ctx.rect(x0, y0, w, h)
      ctx.fillStyle = '#3a3150'
      ctx.fill()
      ctx.clip()
      // Hazard stripes across its business end, the end that shuts.
      const down = c.by < c.ay
      const endY = down ? y0 + h : y0
      const toward = down ? 1 : -1
      ctx.fillStyle = '#f5b942'
      for (let i = -6; i < 14; i++) {
        const sx = x0 + i * 0.9 * cam.k
        ctx.beginPath()
        ctx.moveTo(sx, endY)
        ctx.lineTo(sx + 0.45 * cam.k, endY)
        ctx.lineTo(sx + 2.05 * cam.k, endY - toward * 1.6 * cam.k)
        ctx.lineTo(sx + 1.6 * cam.k, endY - toward * 1.6 * cam.k)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
      ctx.strokeStyle = '#f5b942'
      ctx.lineWidth = Math.max(1.5, 0.12 * cam.k)
      ctx.strokeRect(x0, y0, w, h)
    }
    for (const sp of lab.spinners) {
      const a = spinnerAngle(sp, this.now)
      const cx = this.sx(sp.x)
      const cy = this.sy(sp.y)
      const L = sp.half * cam.k
      if (cx + L < 0 || cx - L > W || cy + L < 0 || cy - L > H) continue
      const T = sp.thick * cam.k
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-a)
      ctx.beginPath()
      ctx.roundRect(-L, -T / 2, 2 * L, T, T / 2)
      ctx.fillStyle = '#4a1d3a'
      ctx.fill()
      ctx.strokeStyle = '#f07a8a'
      ctx.lineWidth = Math.max(1.5, 0.12 * cam.k)
      ctx.stroke()
      // Lights along it, so its turning reads at a glance.
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue
        ctx.beginPath()
        ctx.arc((i / 3.4) * L, 0, Math.max(1.5, 0.12 * cam.k), 0, Math.PI * 2)
        ctx.fillStyle = Math.abs(i) === 3 ? '#ffd166' : 'rgba(240, 122, 138, 0.8)'
        ctx.fill()
      }
      ctx.restore()
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(4, 0.7 * cam.k), 0, Math.PI * 2)
      ctx.fillStyle = '#2a2140'
      ctx.fill()
      ctx.strokeStyle = '#f07a8a'
      ctx.stroke()
    }
  }

  /** The lift under the landing pad: a piston from the room's floor up to the pad's slab. */
  private drawPiston(x0: number, x1: number, top: number, floor: number) {
    const { ctx, cam } = this
    const px0 = this.sx(x0 + 1.2)
    const px1 = this.sx(x1 - 1.2)
    const y0 = this.sy(top - 0.5)
    const y1 = this.sy(floor)
    if (y1 > y0) {
      const metal = ctx.createLinearGradient(px0, 0, px1, 0)
      metal.addColorStop(0, '#2a2140')
      metal.addColorStop(0.5, '#5a4d7a')
      metal.addColorStop(1, '#2a2140')
      ctx.fillStyle = metal
      ctx.fillRect(px0, y0, px1 - px0, y1 - y0)
      ctx.strokeStyle = 'rgba(255, 179, 71, 0.5)'
      ctx.lineWidth = Math.max(1, 0.06 * cam.k)
      for (let y = y0 + 0.6 * cam.k; y < y1; y += 0.8 * cam.k) {
        ctx.beginPath()
        ctx.moveTo(px0, y)
        ctx.lineTo(px1, y)
        ctx.stroke()
      }
    }
    // The slab the pad sits on.
    ctx.fillStyle = '#3a3150'
    ctx.fillRect(this.sx(x0), this.sy(top), (x1 - x0) * cam.k, 0.5 * cam.k)
  }

  /** Near the pad: how fast you're coming down, green once it's slow enough and level enough to land. */
  private drawLandingGuide(ship: SceneFrame['ship']) {
    const { ctx, cam } = this
    const pad = this.cave.pads[1]
    const lift = this.cave.lab?.lift ? liftAt(this.cave.lab.lift, this.now) : null
    const dx = Math.abs(ship.x - (pad.x0 + pad.x1) / 2)
    const dy = ship.y - (lift ? lift.y : pad.y)
    if (dy > 14 || dy < 0 || dx > 16) return
    // On the lift, how fast against the pad: what the landing goes by.
    const speed = Math.hypot(ship.vx, ship.vy - (lift ? lift.vy : 0))
    const tilt = Math.abs(ship.a)
    const ok = speed <= LAND_SPEED && tilt <= LAND_ANGLE
    ctx.save()
    ctx.font = `700 ${Math.max(12, 0.7 * cam.k)}px ${this.font}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = ok ? C.passed : C.bad
    ctx.fillText(`${speed.toFixed(1)} m/s${tilt > LAND_ANGLE ? ' · level off' : ''}`, this.sx(ship.x + 1.8), this.sy(ship.y - 0.2))
    ctx.restore()
  }
}
