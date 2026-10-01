import type { GhostPose } from './runs'
import { G, LAND_ANGLE, LAND_SPEED, mulberry32, SHIP, toWorld, type Cave } from './sim'

/*
 * Lander on a 2D canvas: the cave from the side, following the ship. Rock is near-black with flecks; the air
 * is a deep violet with a grid every 4 m; the walls are lit edges, violet near the top and magenta deeper
 * down. Gates are dashed amber lines that turn green once passed; the pads are amber, the landing pad's lights
 * running toward its middle. The ship is Asteroids' arrow in white with an amber flame; the ghost is cyan
 * (or amber, your own best) with whose run it is over it.
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
} as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

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
}

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; hot: boolean }
type Shard = { x: number; y: number; vx: number; vy: number; a: number; spin: number; half: number }

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
    // At the start card a ghost that isn't flying (one whose path isn't known yet) would sit on your ship: it waits unseen.
    const ghostShown = f.ghost && !f.ghost.wrecked && !(f.mode === 'menu' && f.ghost.done)
    if (f.ghost && ghostShown) this.drawGhost(f.ghost, f.ghostTag, f.ghostMine, f.mode !== 'done' && !f.ghost.done)
    if (f.mode === 'wreck') this.drawShards(dt)
    else if (f.mode === 'menu') this.drawShip(this.cave.spawn.x, this.cave.spawn.y, 0, 0)
    else this.drawShip(f.ship.x, f.ship.y, f.ship.a, f.mode === 'play' ? f.engine : 0)
    this.drawSparks(dt)
    if (f.mode === 'play') this.drawLandingGuide(f.ship)
  }

  dispose() {
    this.sparks.length = 0
    this.shards.length = 0
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
    return { air, edge }
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
    for (const pad of this.cave.pads) {
      const x0 = this.sx(pad.x0)
      const x1 = this.sx(pad.x1)
      const y = this.sy(pad.y)
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

  private drawShip(x: number, y: number, a: number, level: number) {
    const { ctx, cam } = this
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

  private drawGhost(g: GhostPose, name: string, mine: boolean, flying: boolean) {
    const { ctx, cam } = this
    const color = mine ? C.mine : C.ghost
    if (flying && g.engine) this.drawFlame(g.x, g.y, g.a, 0.8, ['rgba(70, 228, 255, 0.35)', 'rgba(200, 248, 255, 0.45)'])
    ctx.save()
    this.traceShip(g.x, g.y, g.a)
    ctx.fillStyle = mine ? 'rgba(245, 185, 66, 0.12)' : 'rgba(70, 228, 255, 0.12)'
    ctx.fill()
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(1.5, 0.12 * cam.k)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.9
    ctx.stroke()
    ctx.globalAlpha = 1
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

  /** Near the pad: how fast you're coming down, green once it's slow enough and level enough to land. */
  private drawLandingGuide(ship: SceneFrame['ship']) {
    const { ctx, cam } = this
    const pad = this.cave.pads[1]
    const dx = Math.abs(ship.x - (pad.x0 + pad.x1) / 2)
    const dy = ship.y - pad.y
    if (dy > 14 || dy < 0 || dx > 16) return
    const speed = Math.hypot(ship.vx, ship.vy)
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
