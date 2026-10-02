/*
 * Hot Lap in 3D: the track and its grounds, the car and its ghost, the rubber a lap leaves behind, and
 * the camera that follows. The simulation's (x, y) is the ground plane, drawn on three's x and −z; on a
 * hilly track the road's heights lift it (three's y) and the ground rolls with it (terrain.ts).
 *
 * The look is a dark world drawn in light (NEON, below), as Ramsey picked it from three on 2026-09-28.
 */
import * as THREE from 'three'
import { buildCar, buildRocketCar, ROCKET_SKINS, WHEEL_RADIUS, WHEELS, type CarModel } from './car'
import { bounds } from './courses'
import type { GhostPose } from './lap'
import { CAR, HALF_WIDTH as TW, nearest, type Run, type Track } from './sim'
import { Terrain } from './terrain'

/** What the scene draws this frame. */
export type SceneFrame = {
  run: Run
  /** Before a lap: the camera circles the car. */
  showroom: boolean
  /** The car on the road, leaving rubber where it slides. */
  driving: boolean
  /** The ghost's car, where it is now; none, and it isn't drawn. */
  ghost: GhostPose | null
  /** The name over the ghost car: whose lap it drives. */
  ghostTag?: string | null
  /** The card stands at the right of a wide screen: the showroom keeps the car to its left. */
  cardAside: boolean
  /** The donuts egg's clue (donuts.ts): old donut marks on the road just past the line. */
  donutHint?: boolean
  /** The player's chosen skin (lib/skins.ts), on their own car. */
  skin?: string | null
  /** The skin the ghost's lap was driven in: whoever races it sees it in that. */
  ghostSkin?: string | null
}

const W = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y)

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Paint = (g: CanvasRenderingContext2D, w: number, h: number) => void

const FONT = '"Outfit", system-ui, sans-serif'
/** How faint the ghost is, and how much fainter while it's right on top of your car. */
const GHOST_SEE = 0.36
const GHOST_OVERLAP = 0.2
/** Past 1,400 stripes of rubber the oldest go. */
const SKIDS = 1400
/** How far a bank drops from the road's edge (and leans out), deep enough for any gap the ground leaves. */
const BANK_DROP = 2.5
/** The donuts egg's clue: old donut marks this many metres past the line, and how faint (the skid marks are 0.5). */
const DONUT_MARKS_AHEAD = 14
const DONUT_MARKS_SEE = 0.22
/** The egg's smoke: puffs kept, a pair off the rear tyres this often (s), for this long, each lasting this long. */
const PUFFS = 56
const PUFF_EVERY = 0.05
const SMOKE_TIME = 1.4
const PUFF_LIFE = 1.3

/** A puff of tyre smoke, drifting up and out from where it left a tyre. */
type Puff = { sprite: THREE.Sprite; age: number; vx: number; vy: number }

/**
 * The look, "A · Grid" of the three Ramsey was shown (2026-09-28): black ground ruled in cyan light, the
 * road's edges lit, orange rails at the fence, hills far off drawn in lines, and the car dark under its own
 * orange light. Nearly everything is unlit colour, cheaper to draw than the daylight world it replaced; the
 * glow round a line is a soft strip laid over it, not a bloom pass, so phones keep their speed.
 */
const NEON = {
  night: '#010308',
  high: '#03101c',
  horizon: '#0b3a4d',
  haze: '#16d8ff',
  fog: '#020812',
  ground: '#01040a',
  grid: '#14c8ec',
  road: '#04070c',
  centre: 'rgba(20, 200, 236, 0.18)',
  edge: '#3ff0ff',
  kerbDark: '#062a36',
  rail: '#ff8b2e',
  hills: '#0f7fa0',
  steel: '#0b0f15',
} as const
/** A line of the ground's grid every 8 m. */
const GRID_EVERY = 8

export class HotLapScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.4, 4000)
  private readonly track: Track
  /** The ground the track covers: the grounds, trees and hills are laid out round it. */
  private readonly box: ReturnType<typeof bounds>
  /** A hilly track's ground; a flat track's is a plain at height 0. */
  private readonly terrain: Terrain | null
  private readonly textures: THREE.Texture[] = []
  private readonly lettered: [THREE.CanvasTexture, Paint][] = []
  private readonly car: CarModel
  /** The ghost as it's drawn now: the Indy car's, or a skin's when the #1 drove in one. */
  private ghostCar: CarModel
  private readonly ghostIndy: CarModel
  /** The Rocket car's ghost, made the first time a ghost drives one. */
  private ghostRocket: CarModel | null = null
  private ghostSkinShown: string | null = null
  /** The Rocket car (Season 1's skin), made the first time you drive in it. */
  private readonly skinned = new Map<string, CarModel>()
  /** The car you drive now: the Indy car, or the one in your skin. */
  private driven: CarModel
  /** The skin your car is in now (lib/skins.ts); null, the Indy car. */
  private skinShown: string | null = null
  private readonly skidPos = new Float32Array(SKIDS * 18)
  private readonly skidGeo = new THREE.BufferGeometry()
  private skidNext = 0
  private skidCount = 0
  private readonly lastMark: ([number, number] | null)[] = [null, null, null, null]
  private width = 0
  private height = 0
  private camHeading = 0
  private snap = true
  private shake = 0
  private showroomAngle = -2.2
  private disposed = false
  /** The name over the ghost car, and what it says. */
  private ghostTag: THREE.Sprite | null = null
  private ghostTagText = ''
  /** Where the ghost and the camera were last found on the track, to find them again quickly. */
  private ghostNear = -1
  private camNear = -1
  private lookNear = -1
  /** The camera's height and where it looks, eased so a bump in the road doesn't jolt them. */
  private camY = 0
  private lookY = 0
  /** The ground, for the banks down from the road's edges on a hilly track. */
  private bankGrass: THREE.Material | null = null
  /** The soft falloff every glow strip shares. */
  private glowTex: THREE.CanvasTexture | null = null
  /** The donuts egg: its clue's old marks, its smoke (made the first time it's needed), and how much longer the smoke pours. */
  private donutMarks: THREE.Mesh | null = null
  private readonly puffs: Puff[] = []
  private puffNext = 0
  private puffClock = 0
  private smoking = 0

  constructor(canvas: HTMLCanvasElement, track: Track) {
    this.track = track
    this.box = bounds(track)
    this.terrain = track.z ? new Terrain(track, this.box) : null
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer = renderer

    this.scene.fog = new THREE.Fog(NEON.fog, 90, 1000)
    this.buildSky()
    this.buildGround()
    this.buildRoad()
    this.buildStart()
    this.buildBoards()
    this.buildHorizon()
    this.buildReflections()
    const paint = this.paint.bind(this)
    this.car = buildCar(paint, false)
    this.ghostIndy = buildCar(paint, true)
    this.ghostCar = this.ghostIndy
    this.driven = this.car
    this.scene.add(this.car.group, this.ghostCar.group)
    this.buildSkids()
    this.buildDonutMarks()

    // Signs are painted before the display face may have arrived; paint them again once it has.
    void Promise.all([document.fonts.load(`800 60px ${FONT}`), document.fonts.load(`700 40px ${FONT}`)])
      .then(() => {
        if (this.disposed) return
        for (const [tex, draw] of this.lettered) {
          const c = tex.image as HTMLCanvasElement
          draw(c.getContext('2d')!, c.width, c.height)
          tex.needsUpdate = true
        }
      })
      .catch(() => {})
  }

  /* ---------- the world ---------- */

  private paint(w: number, h: number, draw: Paint, hasText = false) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d')!, w, h)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    this.textures.push(tex)
    if (hasText) this.lettered.push([tex, draw])
    return tex
  }

  /** The night: a dome dark overhead and glowing low at the horizon, a faint sky light, and a pale moon's light. */
  private buildSky() {
    const box = this.box
    const geo = new THREE.SphereGeometry(3000, 32, 48)
    const glow = new THREE.Color(NEON.haze)
    const low = new THREE.Color(NEON.horizon)
    const high = new THREE.Color(NEON.high)
    const night = new THREE.Color(NEON.night)
    const colors: number[] = []
    for (let i = 0; i < geo.attributes.position!.count; i++) {
      const up = Math.max(0, geo.attributes.position!.getY(i) / 3000)
      // A band of light at the horizon, then up through deep blue into the dark within a few degrees.
      const c =
        up < 0.03
          ? glow.clone().lerp(low, up / 0.03)
          : up < 0.12
            ? low.clone().lerp(high, (up - 0.03) / 0.09)
            : up < 0.45
              ? high.clone().lerp(night, (up - 0.12) / 0.33)
              : night.clone()
      colors.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }))
    dome.position.set(box.cx, 0, -box.cy)
    this.scene.add(dome)
    this.scene.add(new THREE.HemisphereLight(0x9fdfff, 0x020a12, 0.35))
    const moon = new THREE.DirectionalLight(0xbfe9ff, 0.55)
    moon.position.set(-320, 520, 180)
    this.scene.add(moon)
  }

  /** The ground: black, ruled in lines of light every 8 m, over its own hills and out across the plain. */
  private buildGround() {
    // A line down two edges of a tile, half at each side of the seam, so tiles meet in whole lines with their glow.
    const tex = this.paint(256, 256, (g, w, h) => {
      g.fillStyle = NEON.ground
      g.fillRect(0, 0, w, h)
      g.shadowColor = NEON.grid
      g.shadowBlur = 10
      g.strokeStyle = NEON.grid
      g.lineWidth = 3
      g.beginPath()
      for (const at of [0, h]) {
        g.moveTo(0, at)
        g.lineTo(w, at)
      }
      for (const at of [0, w]) {
        g.moveTo(at, 0)
        g.lineTo(at, h)
      }
      g.stroke()
    })
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    // The ground's own texture runs 24 m a tile (terrain.ts, and the banks): a line every 8 m of it.
    tex.repeat.set(24 / GRID_EVERY, 24 / GRID_EVERY)
    if (this.terrain) {
      this.scene.add(this.terrain.mesh(new THREE.MeshBasicMaterial({ map: tex })))
      this.bankGrass = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    }
    const plainTex = tex.clone()
    plainTex.repeat.set(4000 / GRID_EVERY, 4000 / GRID_EVERY)
    this.textures.push(plainTex)
    const plain = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ map: plainTex }))
    plain.rotation.x = -Math.PI / 2
    plain.position.set(this.box.cx, this.terrain ? this.terrain.base - 0.4 : -0.02, -this.box.cy)
    this.scene.add(plain)
  }

  /** A soft glow for a line of light: a strip bright down its middle and fading to nothing at both sides, added on. */
  private glowMaterial(color: string) {
    this.glowTex ??= this.paint(128, 4, (g, w, h) => {
      const across = g.createLinearGradient(0, 0, w, 0)
      across.addColorStop(0, 'rgba(255,255,255,0)')
      across.addColorStop(0.5, 'rgba(255,255,255,0.55)')
      across.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = across
      g.fillRect(0, 0, w, h)
    })
    return new THREE.MeshBasicMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  }

  /** The height of the middle of the road at a point of the track: 0 on a flat track. */
  private roadZ(i: number) {
    return this.track.z ? this.track.z[i]! : 0
  }

  /**
   * The road's height and how steeply it climbs, abreast of a spot near point `index` of the track: between
   * that point and the next one along, a metre apart. A car goes up a hill smoothly, rather than a step at
   * each point, which on a steep one shook it.
   */
  private roadAt(x: number, y: number, index: number) {
    const t = this.track
    if (!t.z || !t.grade) return { z: 0, grade: 0 }
    const along = (x - t.x[index]!) * Math.cos(t.h[index]!) + (y - t.y[index]!) * Math.sin(t.h[index]!)
    const j = along >= 0 ? (index + 1) % t.n : (index - 1 + t.n) % t.n
    const gap = Math.hypot(t.x[j]! - t.x[index]!, t.y[j]! - t.y[index]!) || 1
    const f = Math.min(1, Math.abs(along) / gap)
    return { z: t.z[index]! + (t.z[j]! - t.z[index]!) * f, grade: t.grade[index]! + (t.grade[j]! - t.grade[index]!) * f }
  }

  /** The ground's height off the road. */
  private groundZ(x: number, y: number) {
    return this.terrain ? this.terrain.heightAt(x, y) : 0
  }

  /**
   * Where a car stands: on the road, the road's height (it's level across); off it, easing down onto the
   * grass over three metres. `index` and `side` are where it is on the track, as nearest() gives them.
   */
  private surfaceZ(x: number, y: number, index: number, side: number) {
    if (!this.terrain) return 0
    const road = this.roadAt(x, y, index).z
    const off = Math.abs(side) - (TW + 0.6)
    if (off <= 0) return road
    return road + (this.terrain.heightAt(x, y) - road) * Math.min(1, off / 3)
  }

  /** How a car at a spot, pointing `heading`, tips on the hill it's on: nose up (+) and leaning right (+), in radians. */
  private tilt(x: number, y: number, index: number, heading: number) {
    const grade = this.roadAt(x, y, index).grade
    const across = this.track.h[index]! - heading
    return { pitch: Math.atan(grade * Math.cos(across)), roll: Math.atan(grade * Math.sin(across)) }
  }

  /** A strip laid along the track between two offsets from its middle (left is positive). */
  private strip(from: number, to: number, inner: number, outer: number, lift: number, metresPerRepeat: number, material: THREE.Material) {
    const track = this.track
    const { n } = track
    const count = to - from + 1
    const pos = new Float32Array(count * 6)
    const uv = new Float32Array(count * 4)
    const index: number[] = []
    for (let j = 0; j < count; j++) {
      const i = (((from + j) % n) + n) % n
      const nx = -Math.sin(track.h[i]!)
      const ny = Math.cos(track.h[i]!)
      const along = from + j >= n ? track.s[i]! + track.length : from + j < 0 ? track.s[i]! - track.length : track.s[i]!
      const up = this.roadZ(i) + lift
      const a = W(track.x[i]! + nx * inner, track.y[i]! + ny * inner, up)
      const b = W(track.x[i]! + nx * outer, track.y[i]! + ny * outer, up)
      pos.set([a.x, a.y, a.z, b.x, b.y, b.z], j * 6)
      uv.set([0, along / metresPerRepeat, 1, along / metresPerRepeat], j * 4)
      if (j < count - 1) {
        const k = j * 2
        index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(index)
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, material)
    this.scene.add(mesh)
    return mesh
  }

  /**
   * The road: dark, a faint dashed line down its middle, and a line of light down each edge with its glow;
   * kerbs in light round every corner; banks of the ground's grid down from the edges on a hill; and at the
   * fence, a rail of orange light.
   */
  private buildRoad() {
    const track = this.track
    const surface = this.paint(64, 512, (g, w, h) => {
      g.fillStyle = NEON.road
      g.fillRect(0, 0, w, h)
      g.fillStyle = NEON.centre
      g.fillRect(w / 2 - 0.5, 0, 1, h * 0.45)
    })
    surface.wrapT = THREE.RepeatWrapping
    this.strip(0, track.n, -TW, TW, 0.01, 12, new THREE.MeshBasicMaterial({ map: surface, side: THREE.DoubleSide }))
    const edge = new THREE.MeshBasicMaterial({ color: NEON.edge, side: THREE.DoubleSide })
    this.strip(0, track.n, TW - 0.42, TW - 0.12, 0.03, 12, edge)
    this.strip(0, track.n, -TW + 0.12, -TW + 0.42, 0.03, 12, edge)
    const glow = this.glowMaterial(NEON.edge)
    this.strip(0, track.n, TW - 1.9, TW + 1.3, 0.035, 12, glow)
    this.strip(0, track.n, -TW - 1.3, -TW + 1.9, 0.035, 12, glow)
    this.bank(0, track.n, TW)
    this.bank(0, track.n, -TW)

    const kerbTex = this.paint(8, 64, (g, w, h) => {
      g.fillStyle = NEON.edge
      g.fillRect(0, 0, w, h / 2)
      g.fillStyle = NEON.kerbDark
      g.fillRect(0, h / 2, w, h / 2)
    })
    kerbTex.wrapT = THREE.RepeatWrapping
    kerbTex.magFilter = THREE.NearestFilter
    const kerb = new THREE.MeshBasicMaterial({ map: kerbTex, side: THREE.DoubleSide })
    for (const c of track.corners) {
      this.strip(c.from - 8, c.to + 8, TW, TW + 1.4, 0.04, 4, kerb)
      this.strip(c.from - 8, c.to + 8, -TW - 1.4, -TW, 0.04, 4, kerb)
      this.bank(c.from - 8, c.to + 8, TW + 1.4)
      this.bank(c.from - 8, c.to + 8, -TW - 1.4)
    }
    this.buildFence()
  }

  /** Road points in buckets, to say quickly how far a spot on the grounds is from the nearest road. */
  private roadBuckets: Map<number, number[]> | null = null

  /** How far a spot is from the middle of the nearest road, looking no further than `within` metres. */
  private roadDistance(x: number, y: number, within: number) {
    const t = this.track
    const cell = 32
    if (!this.roadBuckets) {
      const buckets = new Map<number, number[]>()
      for (let i = 0; i < t.n; i++) {
        const key = Math.floor(t.x[i]! / cell) * 100_003 + Math.floor(t.y[i]! / cell)
        const list = buckets.get(key)
        if (list) list.push(i)
        else buckets.set(key, [i])
      }
      this.roadBuckets = buckets
    }
    const reach = Math.ceil(within / cell)
    const bx = Math.floor(x / cell)
    const by = Math.floor(y / cell)
    let best = Infinity
    for (let dx = -reach; dx <= reach; dx++)
      for (let dy = -reach; dy <= reach; dy++) {
        for (const i of this.roadBuckets.get((bx + dx) * 100_003 + (by + dy)) ?? []) {
          const d = Math.hypot(x - t.x[i]!, y - t.y[i]!)
          if (d < best) best = d
        }
      }
    return best
  }

  /**
   * The runs of the track, from `from` to `to` every `step` points, along which every offset given (left
   * positive) is on this stretch's own grounds: no other stretch of road is nearer. Where roads come close,
   * whatever would stand on the other's grounds is left out.
   */
  private clearRuns(from: number, to: number, step: number, offsets: number[]) {
    const t = this.track
    const runs: number[][] = []
    let run: number[] = []
    for (let j = from; j <= to; j += step) {
      const i = ((j % t.n) + t.n) % t.n
      const nx = -Math.sin(t.h[i]!)
      const ny = Math.cos(t.h[i]!)
      const clear = offsets.every((o) => this.roadDistance(t.x[i]! + nx * o, t.y[i]! + ny * o, Math.abs(o) + 2) >= Math.abs(o) - 1)
      if (clear) run.push(j)
      else {
        if (run.length > 1) runs.push(run)
        run = []
      }
    }
    if (run.length > 1) runs.push(run)
    return runs
  }

  /**
   * On a hilly track, a bank of the ground down from an edge of the road (or of a kerb, left positive), leaning
   * out at 45° into the ground. The ground is a grid of heights 8 m apart, which can't follow the road metre
   * by metre: where it falls away from the edge, the bank shows and the road sits on it rather than over a
   * gap; wherever the ground is up to the edge, it hides the bank.
   */
  private bank(from: number, to: number, edge: number) {
    const material = this.bankGrass
    if (!material) return
    const t = this.track
    const out = Math.sign(edge) * BANK_DROP
    const count = to - from + 1
    const pos = new Float32Array(count * 6)
    const uv = new Float32Array(count * 4)
    const index: number[] = []
    for (let j = 0; j < count; j++) {
      const i = (((from + j) % t.n) + t.n) % t.n
      const nx = -Math.sin(t.h[i]!)
      const ny = Math.cos(t.h[i]!)
      const top = this.roadZ(i)
      const ax = t.x[i]! + nx * edge
      const ay = t.y[i]! + ny * edge
      const bx = ax + nx * out
      const by = ay + ny * out
      pos.set([ax, top, -ay, bx, top - BANK_DROP, -by], j * 6)
      // The ground's own texture, laid the same way (24 m a tile, from above), so the two meet unseen.
      uv.set([ax / 24, ay / 24, bx / 24, by / 24], j * 4)
      if (j < count - 1) {
        const k = j * 2
        index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(index)
    geo.computeVertexNormals()
    this.scene.add(new THREE.Mesh(geo, material))
  }

  /** The fence at the barrier, both sides, all the way round: a rail of orange light standing on the ground, and its glow. */
  private buildFence() {
    const t = this.track
    const rail = new THREE.MeshBasicMaterial({ color: NEON.rail, side: THREE.DoubleSide })
    const glow = this.glowMaterial(NEON.rail)
    for (const side of [1, -1]) {
      const o = side * CAR.barrier
      for (const run of this.clearRuns(0, t.n, 3, [o])) {
        // The rail, and a taller glow round it whose falloff runs up it (the glow's u, bottom to top).
        for (const [material, low, high] of [
          [rail, 0.62, 0.78],
          [glow, 0.25, 1.15],
        ] as const) {
          const pos = new Float32Array(run.length * 6)
          const uv = new Float32Array(run.length * 4)
          const index: number[] = []
          run.forEach((j, r) => {
            const i = ((j % t.n) + t.n) % t.n
            const x = t.x[i]! - Math.sin(t.h[i]!) * o
            const y = t.y[i]! + Math.cos(t.h[i]!) * o
            const foot = this.groundZ(x, y)
            const along = (t.s[i]! + Math.floor(j / t.n) * t.length) / 4
            pos.set([x, foot + low, -y, x, foot + high, -y], r * 6)
            uv.set([0, along, 1, along], r * 4)
            if (r > 0) {
              const k = (r - 1) * 2
              index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
            }
          })
          const geo = new THREE.BufferGeometry()
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
          geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
          geo.setIndex(index)
          this.scene.add(new THREE.Mesh(geo, material))
        }
      }
    }
  }

  /** The start line, and the gantry over it. */
  private buildStart() {
    const track = this.track
    const scene = this.scene
    const i = track.startIndex
    const checker = this.paint(64, 16, (g, w, h) => {
      for (let x = 0; x < 8; x++)
        for (let y = 0; y < 2; y++) {
          g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5'
          g.fillRect((x * w) / 8, (y * h) / 2, w / 8, h / 2)
        }
    })
    checker.magFilter = THREE.NearestFilter
    checker.wrapS = THREE.RepeatWrapping
    checker.repeat.set(2, 1)
    const line = this.strip(i - 1, i + 1, -TW, TW, 0.03, 2, new THREE.MeshBasicMaterial({ map: checker, side: THREE.DoubleSide }))
    line.renderOrder = 1

    const h = track.h[i]!
    const nx = -Math.sin(h)
    const ny = Math.cos(h)
    const lineZ = this.roadZ(i)
    // Dark steel, its edges drawn in orange light.
    const steel = new THREE.MeshBasicMaterial({ color: NEON.steel })
    const edges = new THREE.LineBasicMaterial({ color: NEON.rail })
    const girder = (geo: THREE.BufferGeometry) => {
      const mesh = new THREE.Mesh(geo, steel)
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edges))
      return mesh
    }
    for (const side of [1, -1]) {
      const px = track.x[i]! + nx * (TW + 2) * side
      const py = track.y[i]! + ny * (TW + 2) * side
      // Down to the ground, wherever it is, and up to the beam.
      const foot = Math.min(this.groundZ(px, py), lineZ)
      const post = girder(new THREE.BoxGeometry(0.7, lineZ + 8 - foot, 0.7))
      post.position.copy(W(px, py, (foot + lineZ + 8) / 2))
      scene.add(post)
    }
    const beam = girder(new THREE.BoxGeometry(1, 1.6, 2 * TW + 5))
    beam.position.copy(W(track.x[i]!, track.y[i]!, lineZ + 8))
    beam.rotation.y = h
    scene.add(beam)
    // The gantry's banner, dark, with Hot Lap lit in its orange, Blipka's name in light, and its mark's dot.
    const banner = this.paint(
      512,
      96,
      (g, w, hh) => {
        g.fillStyle = '#05080d'
        g.fillRect(0, 0, w, hh)
        g.shadowColor = NEON.rail
        g.shadowBlur = 14
        g.strokeStyle = NEON.rail
        g.lineWidth = 4
        g.strokeRect(4, 4, w - 8, hh - 8)
        g.fillStyle = NEON.rail
        g.font = `800 60px ${FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('Hot Lap', w / 2 - 30, hh / 2 + 2)
        g.shadowColor = NEON.edge
        g.fillStyle = NEON.edge
        g.font = `700 26px ${FONT}`
        g.textAlign = 'right'
        g.fillText('blipka', w - 22, hh / 2 + 2)
        g.fillStyle = '#2eb8a0'
        g.beginPath()
        g.arc(w - 22 - g.measureText('pka').width - g.measureText('i').width / 2, hh / 2 - 13, 3.2, 0, Math.PI * 2)
        g.fill()
      },
      true,
    )
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2 * TW + 4, 1.5), new THREE.MeshBasicMaterial({ map: banner, side: THREE.DoubleSide }))
    sign.position.copy(W(track.x[i]! - Math.cos(h) * 0.55, track.y[i]! - Math.sin(h) * 0.55, lineZ + 8))
    sign.rotation.y = h - Math.PI / 2
    scene.add(sign)
  }

  /**
   * Braking boards before each slow corner that ends a long straight: 150, 100, 50 metres to go, on the
   * outside, dark with their number and frame in light. A board that would stand on another stretch of
   * road is left out.
   */
  private buildBoards() {
    const track = this.track
    const { n } = track
    const postMat = new THREE.MeshBasicMaterial({ color: NEON.steel })
    for (const c of track.corners) {
      if (c.r > 40 || Math.abs(c.turn) < 60) continue
      let straight = true
      for (let j = 1; j <= 160 && straight; j++) straight = track.k[(((c.from - j) % n) + n) % n] === 0
      if (!straight) continue
      const side = -Math.sign(c.turn) * (TW + 4)
      for (const to of [150, 100, 50]) {
        const i = (((c.from - to) % n) + n) % n
        const h = track.h[i]!
        const bx = track.x[i]! - Math.sin(h) * side
        const by = track.y[i]! + Math.cos(h) * side
        if (offRoad(track, bx, by) < TW + 3) continue
        const tex = this.paint(
          128,
          96,
          (g, w, hh) => {
            g.fillStyle = '#03070c'
            g.fillRect(0, 0, w, hh)
            g.shadowColor = NEON.edge
            g.shadowBlur = 8
            g.strokeStyle = NEON.edge
            g.lineWidth = 5
            g.strokeRect(6, 6, w - 12, hh - 12)
            g.fillStyle = '#e9fcff'
            g.font = `800 54px ${FONT}`
            g.textAlign = 'center'
            g.textBaseline = 'middle'
            g.fillText(String(to), w / 2, hh / 2 + 3)
          },
          true,
        )
        const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.65), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))
        const foot = this.groundZ(bx, by)
        board.position.copy(W(bx, by, foot + 2.4))
        board.rotation.y = h - Math.PI / 2
        this.scene.add(board)
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), postMat)
        post.position.copy(W(bx, by, foot + 0.8))
        this.scene.add(post)
      }
    }
  }

  /** Far off all round, hills and mountains drawn in lines of light. */
  private buildHorizon() {
    const box = this.box
    const base = this.terrain?.base ?? 0
    const ring = Math.max(box.width, box.height) / 2 + 900
    // In the night's fog, as far things are: the nearest clear, the rest fading into the dark.
    const lines = new THREE.MeshBasicMaterial({ color: NEON.hills, wireframe: true, transparent: true, opacity: 0.55 })
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const upAxis = new THREE.Vector3(0, 1, 0)

    // Rolling hills: domes.
    const hills = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 22, 9, 0, Math.PI * 2, 0, Math.PI / 2), lines, 34)
    const hr = rng(41)
    for (let k = 0; k < 34; k++) {
      const a = (k / 34) * Math.PI * 2 + hr() * 0.1
      const far = ring + hr() * 350
      const radius = 180 + hr() * 220
      q.setFromAxisAngle(upAxis, hr() * Math.PI)
      m.compose(new THREE.Vector3(box.cx + Math.cos(a) * far, base - 6, -box.cy + Math.sin(a) * far), q, scale.set(radius, 60 + hr() * 110, radius * (0.6 + hr() * 0.5)))
      hills.setMatrixAt(k, m)
    }
    this.scene.add(hills)

    // Mountains far behind them.
    const peakGeo = new THREE.ConeGeometry(1, 1, 7, 3)
    peakGeo.translate(0, 0.5, 0)
    const peaks = new THREE.InstancedMesh(peakGeo, lines, 26)
    const pr = rng(47)
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2 + pr() * 0.2
      const far = ring + 800 + pr() * 450
      const radius = 300 + pr() * 280
      q.setFromAxisAngle(upAxis, pr() * Math.PI)
      m.compose(new THREE.Vector3(box.cx + Math.cos(a) * far, base - 10, -box.cy + Math.sin(a) * far), q, scale.set(radius, 110 + pr() * 170, radius * (0.7 + pr() * 0.4)))
      peaks.setMatrixAt(k, m)
    }
    this.scene.add(peaks)
  }

  /*
   * What the paint reflects: the night sky, the glow at its horizon and the dark ground under the car,
   * which give the body its shape, and above them a moon and soft light panels like a studio's. It's
   * worked out in floating point with the moon and the panels several times brighter than the sky, as
   * real lights are, so the clear coat shows them as bright streaks. Only the car's materials use it.
   */
  private buildReflections() {
    const w = 512
    const h = 256
    const sky = document.createElement('canvas')
    sky.width = w
    sky.height = h
    const g = sky.getContext('2d', { willReadFrequently: true })!
    const up = g.createLinearGradient(0, 0, 0, h / 2)
    up.addColorStop(0, NEON.night)
    up.addColorStop(0.7, NEON.high)
    up.addColorStop(0.94, NEON.horizon)
    up.addColorStop(1, NEON.haze)
    g.fillStyle = up
    g.fillRect(0, 0, w, h / 2)
    const down = g.createLinearGradient(0, h / 2, 0, h)
    down.addColorStop(0, NEON.horizon)
    down.addColorStop(0.1, NEON.fog)
    down.addColorStop(1, '#010206')
    g.fillStyle = down
    g.fillRect(0, h / 2, w, h / 2)
    // Where the lights are, drawn on a canvas of their own: how much brighter than the sky each pixel is.
    const lights = document.createElement('canvas')
    lights.width = w
    lights.height = h
    const l = lights.getContext('2d', { willReadFrequently: true })!
    const panel = (x: number, y: number, pw: number, ph: number, alpha: number) => {
      const band = l.createLinearGradient(0, y, 0, y + ph)
      band.addColorStop(0, 'rgba(255,255,255,0)')
      band.addColorStop(0.5, `rgba(255,255,255,${alpha})`)
      band.addColorStop(1, 'rgba(255,255,255,0)')
      l.fillStyle = band
      l.fillRect(x, y, pw, ph)
    }
    panel(0, h * 0.12, w, h * 0.06, 1)
    panel(w * 0.16, h * 0.26, w * 0.18, h * 0.07, 1)
    panel(w * 0.6, h * 0.26, w * 0.18, h * 0.07, 1)
    panel(w * 0.4, h * 0.04, w * 0.22, h * 0.05, 0.9)
    const sun = l.createRadialGradient(w * 0.3, h * 0.2, 1, w * 0.3, h * 0.2, 18)
    sun.addColorStop(0, 'rgba(255,255,255,1)')
    sun.addColorStop(1, 'rgba(255,255,255,0)')
    l.fillStyle = sun
    l.fillRect(0, 0, w, h / 2)
    const base = g.getImageData(0, 0, w, h).data
    const glow = l.getImageData(0, 0, w, h).data
    const linear = (v: number) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    // Half floats, which every WebGL 2 device can filter (full floats need an extension phones lack).
    // A canvas's rows run down from the top; a data texture's run up from the bottom.
    const data = new Uint16Array(w * h * 4)
    const one = THREE.DataUtils.toHalfFloat(1)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const from = ((h - 1 - y) * w + x) * 4
        const to = (y * w + x) * 4
        const bright = (glow[from + 3]! / 255) * 7
        for (let c = 0; c < 3; c++) data[to + c] = THREE.DataUtils.toHalfFloat(linear(base[from + c]!) + bright)
        data[to + 3] = one
      }
    }
    const env = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType)
    env.mapping = THREE.EquirectangularReflectionMapping
    env.colorSpace = THREE.LinearSRGBColorSpace
    env.magFilter = THREE.LinearFilter
    env.minFilter = THREE.LinearFilter
    env.needsUpdate = true
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromEquirectangular(env).texture
    pmrem.dispose()
    env.dispose()
  }

  /* ---------- skid marks ---------- */

  /* Rubber left where a tyre slid or braked at its limit. It stays from lap to lap, so your lines build up on the road. */
  private buildSkids() {
    this.skidGeo.setAttribute('position', new THREE.BufferAttribute(this.skidPos, 3))
    this.skidGeo.setDrawRange(0, 0)
    const mesh = new THREE.Mesh(
      this.skidGeo,
      new THREE.MeshBasicMaterial({
        color: 0x1d3440,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    )
    mesh.frustumCulled = false
    mesh.renderOrder = 2
    this.scene.add(mesh)
  }

  private layRubber(run: Run) {
    const braking = run.abs && run.u > 6
    const c = Math.cos(run.h)
    const s = Math.sin(run.h)
    // The road's height under the car, and how it climbs, so a mark lies on a hill as on the flat.
    const i = run.index
    const under = this.roadAt(run.x, run.y, i)
    const tx = Math.cos(this.track.h[i]!)
    const ty = Math.sin(this.track.h[i]!)
    const lift = (px: number, py: number) => under.z + under.grade * ((px - run.x) * tx + (py - run.y) * ty) + 0.025
    let laid = false
    WHEELS.forEach(([f, l], w) => {
      const front = w < 2
      const marking = !run.onGrass && (braking || run.work > (front ? 1.2 : 1.02))
      const x = run.x + f * c - l * s
      const y = run.y + f * s + l * c
      if (!marking) {
        this.lastMark[w] = null
        return
      }
      const from = this.lastMark[w]
      if (!from) {
        this.lastMark[w] = [x, y]
        return
      }
      const len = Math.hypot(x - from[0], y - from[1])
      if (len < 0.35) return
      const nx = (-(y - from[1]) / len) * 0.13
      const ny = ((x - from[0]) / len) * 0.13
      const corners = [
        [from[0] + nx, from[1] + ny],
        [from[0] - nx, from[1] - ny],
        [x + nx, y + ny],
        [from[0] - nx, from[1] - ny],
        [x - nx, y - ny],
        [x + nx, y + ny],
      ]
      corners.forEach(([px, py], k) => this.skidPos.set([px!, lift(px!, py!), -py!], this.skidNext * 18 + k * 3))
      this.skidNext = (this.skidNext + 1) % SKIDS
      this.skidCount = Math.min(SKIDS, this.skidCount + 1)
      this.lastMark[w] = [x, y]
      laid = true
    })
    if (laid) {
      this.skidGeo.attributes.position!.needsUpdate = true
      this.skidGeo.setDrawRange(0, this.skidCount * 6)
    }
  }

  /* ---------- the donuts egg ---------- */

  /**
   * The egg's clue (donuts.ts): old rubber from three donuts on the road a little past the line, as if
   * someone had spun there before. Each is the two rear tyres' tracks round the circles the car's own
   * donuts make (about 5 m across), a little off the last and a little out of round, as a donut wanders.
   * Fainter than the skid marks, and shown only while the page asks, till the device has spun its own.
   */
  private buildDonutMarks() {
    const track = this.track
    const at = (track.startIndex + DONUT_MARKS_AHEAD) % track.n
    const h = track.h[at]!
    // A little left of the middle; the widest loop keeps inside the edge lines.
    const cx = track.x[at]! - Math.sin(h) * 0.8
    const cy = track.y[at]! + Math.cos(h) * 0.8
    const pos: number[] = []
    const index: number[] = []
    let near = at
    const segments = 96
    for (let loop = 0; loop < 3; loop++) {
      // Each loop well off the last, so they cross one another as a wandering donut's do, not ripples.
      const ox = cx + Math.cos(h + loop * 2.1) * 1.1
      const oy = cy + Math.sin(h + loop * 2.1) * 1.1
      // The inner and outer rear tyre, 2.3 and 2.85 m from where a donut turns about (sim.ts donutStep).
      for (const radius of [2.3, 2.85]) {
        const first = pos.length / 3
        for (let s = 0; s <= segments; s++) {
          const a = (s / segments) * Math.PI * 2
          const r = radius + 0.3 * Math.sin(2 * a + loop * 1.7)
          for (const w of [-0.13, 0.13]) {
            const x = ox + Math.cos(a) * (r + w)
            const y = oy + Math.sin(a) * (r + w)
            const spot = nearest(track, x, y, near)
            near = spot.index
            pos.push(x, this.surfaceZ(x, y, spot.index, spot.side) + 0.02, -y)
          }
          if (s < segments) {
            const k = first + s * 2
            index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex(index)
    const marks = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0x1d3440,
        transparent: true,
        opacity: DONUT_MARKS_SEE,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    )
    marks.renderOrder = 2
    marks.visible = false
    this.scene.add(marks)
    this.donutMarks = marks
  }

  /** The egg: smoke pours off the rear tyres for a moment. */
  smoke() {
    if (!this.puffs.length) {
      const tex = this.paint(64, 64, (g, w, h) => {
        const soft = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
        soft.addColorStop(0, 'rgba(255,255,255,0.9)')
        soft.addColorStop(0.5, 'rgba(255,255,255,0.35)')
        soft.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = soft
        g.fillRect(0, 0, w, h)
      })
      for (let k = 0; k < PUFFS; k++) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xa9c2cf, transparent: true, depthWrite: false, opacity: 0 }))
        sprite.visible = false
        this.scene.add(sprite)
        this.puffs.push({ sprite, age: 0, vx: 0, vy: 0 })
      }
    }
    this.smoking = SMOKE_TIME
  }

  /** While the smoke pours, a puff off each rear tyre; every puff rises, swells and thins away. */
  private tickSmoke(run: Run, dt: number) {
    if (this.smoking > 0) {
      this.smoking -= dt
      this.puffClock += dt
      const c = Math.cos(run.h)
      const s = Math.sin(run.h)
      while (this.puffClock >= PUFF_EVERY) {
        this.puffClock -= PUFF_EVERY
        for (const [f, l] of [WHEELS[2]!, WHEELS[3]!]) {
          const puff = this.puffs[this.puffNext]!
          this.puffNext = (this.puffNext + 1) % this.puffs.length
          const x = run.x + f * c - l * s
          const y = run.y + f * s + l * c
          // Blown out from its tyre's side and back off the car, each a little differently (golden-ratio steps, not chance).
          const wander = ((this.puffNext * 0.618) % 1) - 0.5
          const out = Math.sign(l) * (0.7 + wander * 0.5)
          puff.vx = -s * out - c * (0.5 + wander * 0.4)
          puff.vy = c * out - s * (0.5 + wander * 0.4)
          puff.age = 0
          puff.sprite.position.set(x, this.surfaceZ(x, y, run.index, run.side) + 0.4, -y)
          puff.sprite.visible = true
        }
      }
    }
    for (const puff of this.puffs) {
      if (!puff.sprite.visible) continue
      puff.age += dt
      const life = puff.age / PUFF_LIFE
      if (life >= 1) {
        puff.sprite.visible = false
        continue
      }
      puff.sprite.position.x += puff.vx * dt
      puff.sprite.position.y += 0.7 * dt
      puff.sprite.position.z -= puff.vy * dt
      const size = 1 + 2.4 * life
      puff.sprite.scale.set(size, size, 1)
      puff.sprite.material.opacity = 0.5 * Math.min(1, puff.age / 0.1) * (1 - life) ** 2
    }
  }

  /* ---------- each frame ---------- */

  /** A new lap: the camera drops in behind the car, and the tyres start fresh marks (and stop smoking). */
  startLap() {
    this.lastMark.fill(null)
    this.snap = true
    this.smoking = 0
  }

  /** The car hit the fence. */
  bump() {
    this.shake = 0.6
  }

  resize(width: number, height: number) {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    if (w === this.width && h === this.height) return
    this.width = w
    this.height = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  frame(f: SceneFrame, dt: number) {
    if ((f.skin ?? null) !== this.skinShown) {
      this.skinShown = f.skin ?? null
      // Your car in your skin, made the first time you drive in it.
      const skin = this.skinShown
      const colors = skin ? ROCKET_SKINS[skin] : undefined
      let car = this.car
      if (skin && colors) {
        car = this.skinned.get(skin) ?? buildRocketCar(this.paint.bind(this), { colors })
        if (!this.skinned.has(skin)) {
          this.skinned.set(skin, car)
          this.scene.add(car.group)
        }
      }
      this.car.group.visible = car === this.car
      for (const model of this.skinned.values()) model.group.visible = model === car
      this.driven = car
    }
    this.poseCar(f.run, dt)
    if (f.driving) this.layRubber(f.run)
    // A donut smokes the whole time it spins, and a moment after.
    if (f.driving && f.run.donut !== 0) this.smoke()
    if (this.puffs.length) this.tickSmoke(f.run, dt)
    if (this.donutMarks) this.donutMarks.visible = f.donutHint === true
    this.dressGhost(f.ghostSkin ?? null)
    this.tagGhost(f.ghostTag ?? null)
    this.poseGhost(f.ghost, f.run, dt)
    this.frameCamera(f, dt)
    this.renderer.render(this.scene, this.camera)
  }

  /** The body leans out of corners and dips its nose under braking, as the weight moves: a racer's stiff springs, so not much. */
  private poseCar(run: Run, dt: number) {
    const car = this.driven
    car.group.position.set(run.x, this.surfaceZ(run.x, run.y, run.index, run.side), -run.y)
    // Standing on the hill: nose up a climb, leaning with the slope across it.
    const hill = this.tilt(run.x, run.y, run.index, run.h)
    car.group.rotation.order = 'YZX'
    car.group.rotation.set(hill.roll, run.h, hill.pitch)
    const roll = Math.max(-0.055, Math.min(0.055, run.ay * 0.004))
    const pitch = Math.max(-0.04, Math.min(0.04, run.ax * 0.003))
    car.body.rotation.x += (roll - car.body.rotation.x) * Math.min(1, dt * 8)
    car.body.rotation.z += (pitch - car.body.rotation.z) * Math.min(1, dt * 8)
    for (const w of car.wheels) w.rotation.z -= (run.u * dt) / WHEEL_RADIUS
    for (const p of car.steer) p.rotation.y = run.steer * 1.6
    if (car.flame) {
      // A rocket's flame: a flicker at rest, longer as the car pulls.
      const pull = Math.max(0, Math.min(1, run.ax / 8))
      const flicker = 0.85 + Math.random() * 0.3
      car.flame.scale.set((0.35 + 1.25 * pull) * flicker, 0.8 + 0.4 * pull, 0.8 + 0.4 * pull)
    }
  }

  /**
   * The ghost shows the whole lap, and waits where it finished once its lap is done. Right on top of
   * your car it fades further, so it's still there without hiding yours.
   */
  private poseGhost(pose: GhostPose | null, run: Run, dt: number) {
    const ghost = this.ghostCar
    ghost.group.visible = pose != null
    if (!pose) return
    let up = 0
    if (this.terrain) {
      const near = nearest(this.track, pose.x, pose.y, this.ghostNear)
      this.ghostNear = near.index
      up = this.surfaceZ(pose.x, pose.y, near.index, near.side)
      const { pitch, roll } = this.tilt(pose.x, pose.y, near.index, pose.h)
      ghost.group.rotation.order = 'YZX'
      ghost.group.rotation.set(roll, pose.h, pitch)
    } else {
      ghost.group.rotation.y = pose.h
    }
    ghost.group.position.set(pose.x, up, -pose.y)
    if (!pose.done) for (const w of ghost.wheels) w.rotation.z -= dt * 12
    const apart = Math.hypot(pose.x - run.x, pose.y - run.y)
    const opacity = GHOST_OVERLAP + (GHOST_SEE - GHOST_OVERLAP) * Math.min(1, Math.max(0, (apart - 0.5) / 2.5))
    for (const m of ghost.see) m.opacity = opacity
    // Its lines of light stay crisp, fading with it as it comes alongside.
    for (const m of ghost.lines) m.opacity = Math.min(1, opacity * 2.6)
    // Its name fades as it comes alongside, so it never sits in front of your own car.
    if (this.ghostTag) (this.ghostTag.material as THREE.SpriteMaterial).opacity = 0.95 * Math.min(1, Math.max(0, (apart - 4) / 6))
  }

  /** The ghost in the skin its lap was driven in: a Rocket car's, seen through, or the Indy car's. */
  private dressGhost(skin: string | null) {
    if (skin === this.ghostSkinShown) return
    this.ghostSkinShown = skin
    let next = this.ghostIndy
    if (skin && ROCKET_SKINS[skin]) {
      if (!this.ghostRocket) {
        this.ghostRocket = buildRocketCar(this.paint.bind(this), { ghost: true })
        this.scene.add(this.ghostRocket.group)
      }
      next = this.ghostRocket
    }
    if (next === this.ghostCar) return
    const was = this.ghostCar
    was.group.visible = false
    // The name rides with whichever car is the ghost.
    if (this.ghostTag) {
      was.group.remove(this.ghostTag)
      next.group.add(this.ghostTag)
    }
    this.ghostCar = next
  }

  /** The name over the ghost car, painted again only when it changes. */
  private tagGhost(text: string | null) {
    const want = text ?? ''
    if (want === this.ghostTagText) return
    this.ghostTagText = want
    const old = this.ghostTag
    if (old) {
      this.ghostCar.group.remove(old)
      const material = old.material as THREE.SpriteMaterial
      const map = material.map
      material.dispose()
      if (map) {
        map.dispose()
        const at = this.textures.indexOf(map)
        if (at >= 0) this.textures.splice(at, 1)
        const lettered = this.lettered.findIndex(([tex]) => tex === map)
        if (lettered >= 0) this.lettered.splice(lettered, 1)
      }
      this.ghostTag = null
    }
    if (!want) return
    // A dark pill with the name in white, the site's display face, over the car's roof.
    const tex = this.paint(
      512,
      128,
      (g, w, h) => {
        g.clearRect(0, 0, w, h)
        g.font = `800 58px ${FONT}`
        const width = Math.min(w - 8, g.measureText(want).width + 64)
        const x = (w - width) / 2
        const r = 40
        g.fillStyle = 'rgba(12, 22, 34, 0.62)'
        g.beginPath()
        g.moveTo(x + r, 24)
        g.lineTo(x + width - r, 24)
        g.arc(x + width - r, 24 + r, r, -Math.PI / 2, Math.PI / 2)
        g.lineTo(x + r, 24 + 2 * r)
        g.arc(x + r, 24 + r, r, Math.PI / 2, (3 * Math.PI) / 2)
        g.closePath()
        g.fill()
        g.fillStyle = '#ffffff'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(want, w / 2, 24 + r + 3)
      },
      true,
    )
    // The same size on the screen near or far, as a racing game's name plates are: far ahead, it's how you find the ghost.
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false }))
    tag.scale.set(0.22, 0.055, 1)
    tag.position.set(0, 2.3, 0)
    this.ghostCar.group.add(tag)
    this.ghostTag = tag
  }

  /*
   * Behind the car, the camera keeps its distance at any speed; only its angle trails, so corners swing
   * round. It looks mostly along the way the car is going, so a slide shows the car angled across the
   * road. Before a lap it circles the car slowly, low and close, clear of the start card.
   */
  private frameCamera(f: SceneFrame, dt: number) {
    const { run } = f
    const camera = this.camera
    const carZ = this.surfaceZ(run.x, run.y, run.index, run.side)
    if (f.showroom) {
      this.showroomAngle += dt * 0.22
      const portrait = camera.aspect < 1
      const aside = !portrait && f.cardAside
      const away = portrait ? 10.5 : 8.2
      const cx = run.x + Math.cos(this.showroomAngle) * away
      const cz = -run.y + Math.sin(this.showroomAngle) * away
      // Level with the car, or above the ground where the camera is, if that's higher.
      const cy = Math.max(carZ + 2.8, this.groundZ(cx, -cz) + 1.6)
      camera.position.set(cx, cy, cz)
      // With the card at the right, look past the car's right and it sits at the left.
      const fx = (run.x - cx) / away
      const fz = (-run.y - cz) / away
      const side = aside ? 2.4 : 0
      camera.lookAt(run.x - fz * side, carZ + (portrait ? -4.1 : aside ? -0.6 : -2.8), -run.y + fx * side)
      this.fov(62, 1)
      this.snap = true
      return
    }
    const travel = run.h + (run.u > 3 ? Math.atan2(run.vy, run.u) * 0.35 : 0)
    // In a donut the camera holds where it was looking, and the car spins in front of it; after, it swings
    // back round behind.
    if (this.snap) {
      this.camHeading = travel
      this.camNear = -1
      this.lookNear = -1
    } else if (run.donut === 0) {
      const d = Math.atan2(Math.sin(travel - this.camHeading), Math.cos(travel - this.camHeading))
      this.camHeading += d * (1 - Math.exp(-dt * 5))
    }
    const fx = Math.cos(this.camHeading)
    const fz = -Math.sin(this.camHeading)
    // On a hill, the camera stays 2.8 m over the road behind the car and looks at the road ahead of it,
    // so a climb rises in front of you and a drop falls away. Eased, so bumps don't jolt it.
    let camY = 2.8
    let lookY = 1.2
    if (this.terrain) {
      const bx = run.x - fx * 7.8
      const by = run.y + fz * 7.8
      const back = nearest(this.track, bx, by, this.camNear < 0 ? run.index : this.camNear)
      this.camNear = back.index
      const ax = run.x + fx * 6
      const ay = run.y - fz * 6
      const ahead = nearest(this.track, ax, ay, this.lookNear < 0 ? run.index : this.lookNear)
      this.lookNear = ahead.index
      const wantCam = Math.max(this.surfaceZ(bx, by, back.index, back.side) + 2.8, carZ + 1.4)
      const wantLook = this.surfaceZ(ax, ay, ahead.index, ahead.side) + 1.2
      const ease = this.snap ? 1 : 1 - Math.exp(-dt * 7)
      this.camY += (wantCam - this.camY) * ease
      this.lookY += (wantLook - this.lookY) * ease
      camY = this.camY
      lookY = this.lookY
    }
    if (this.snap) this.snap = false
    camera.position.set(run.x - fx * 7.8, camY, -run.y - fz * 7.8)
    if (this.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * this.shake
      camera.position.y += (Math.random() - 0.5) * this.shake
      this.shake = Math.max(0, this.shake - dt * 2)
    }
    camera.lookAt(run.x + fx * 6, lookY, -run.y + fz * 6)
    const aspect = camera.aspect
    const base = aspect >= 1 ? 60 : Math.min(88, 60 + (1 - aspect) * 46)
    this.fov(base + Math.min(8, run.v * 0.16), Math.min(1, dt * 4))
  }

  private fov(target: number, ease: number) {
    const camera = this.camera
    if (Math.abs(camera.fov - target) <= 0.05) return
    camera.fov += (target - camera.fov) * ease
    camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mats = mesh.material
      for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) m.dispose()
    })
    for (const t of this.textures) t.dispose()
    this.scene.environment?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}

/** How far a point is from the middle of the road, anywhere along the track. */
function offRoad(track: Track, x: number, y: number) {
  const near = nearest(track, x, y, -1)
  return Math.hypot(x - track.x[near.index]!, y - track.y[near.index]!)
}
