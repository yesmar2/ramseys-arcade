/*
 * Hot Lap in 3D: the track and its grounds, the car and its ghost, the rubber a lap leaves behind, and
 * the camera that follows. The simulation's (x, y) is the ground plane, drawn on three's x and −z; on a
 * hilly track the road's heights lift it (three's y) and the ground rolls with it (terrain.ts).
 */
import * as THREE from 'three'
import { buildCar, WHEEL_RADIUS, WHEELS, type CarModel } from './car'
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
  private readonly ghostCar: CarModel
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
  /** The grass, for the banks down from the road's edges on a hilly track. */
  private bankGrass: THREE.Material | null = null

  constructor(canvas: HTMLCanvasElement, track: Track) {
    this.track = track
    this.box = bounds(track)
    this.terrain = track.z ? new Terrain(track, this.box) : null
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer = renderer

    const haze = new THREE.Color('#cbe9f7')
    this.scene.fog = new THREE.Fog(haze, 240, 1100)
    this.buildSky(haze)
    this.buildGround()
    this.buildRoad()
    this.buildStart()
    this.buildBoards()
    this.buildTyreWalls()
    this.buildTrees()
    this.buildReflections()
    const paint = this.paint.bind(this)
    this.car = buildCar(paint, false)
    this.ghostCar = buildCar(paint, true)
    this.scene.add(this.car.group, this.ghostCar.group)
    this.buildSkids()

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

  /** A dome from deep blue overhead to haze at the horizon, clouds low over the hills, a sky light, and the sun. */
  private buildSky(haze: THREE.Color) {
    const box = this.box
    const geo = new THREE.SphereGeometry(3000, 32, 16)
    const top = new THREE.Color('#4f9fe0')
    const colors: number[] = []
    for (let i = 0; i < geo.attributes.position!.count; i++) {
      const up = Math.max(0, geo.attributes.position!.getY(i) / 3000)
      const c = haze.clone().lerp(top, Math.pow(up, 0.55))
      colors.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }))
    dome.position.set(box.cx, 0, -box.cy)
    this.scene.add(dome)
    this.scene.add(new THREE.HemisphereLight(0xe4f3ff, 0x4d7a43, 1.15))
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.9)
    sun.position.set(-320, 520, 180)
    this.scene.add(sun)

    // Fair-weather clouds: soft white heaps, flat underneath, a little grey where they're thick.
    const cloud = this.paint(256, 128, (g, w, h) => {
      const r = rng(53)
      for (let i = 0; i < 16; i++) {
        const x = w * (0.18 + r() * 0.64)
        const y = h * (0.42 + r() * 0.3) - Math.sin(((x / w) * Math.PI)) * h * 0.18
        const rad = h * (0.18 + r() * 0.2)
        const puff = g.createRadialGradient(x, y, 0, x, y, rad)
        puff.addColorStop(0, 'rgba(255,255,255,0.95)')
        puff.addColorStop(0.55, 'rgba(250,252,255,0.7)')
        puff.addColorStop(1, 'rgba(250,252,255,0)')
        g.fillStyle = puff
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
      }
      const shade = g.createLinearGradient(0, h * 0.45, 0, h)
      shade.addColorStop(0, 'rgba(120,140,170,0)')
      shade.addColorStop(1, 'rgba(120,140,170,0.35)')
      g.globalCompositeOperation = 'source-atop'
      g.fillStyle = shade
      g.fillRect(0, 0, w, h)
      g.globalCompositeOperation = 'source-over'
    })
    const cr = rng(59)
    for (let k = 0; k < 16; k++) {
      const a = cr() * Math.PI * 2
      const up = (4 + cr() * 16) * (Math.PI / 180)
      const far = 2500
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloud, fog: false, depthWrite: false, transparent: true, opacity: 0.78 + cr() * 0.2 }))
      const width = 560 + cr() * 620
      puff.scale.set(width, width * (0.3 + cr() * 0.12), 1)
      puff.position.set(box.cx + Math.cos(a) * Math.cos(up) * far, Math.sin(up) * far, -box.cy + Math.sin(a) * Math.cos(up) * far)
      this.scene.add(puff)
    }
  }

  /** Grass, mown in stripes, with clumps and blades so it isn't flat paint up close. */
  private buildGround() {
    const tex = this.paint(256, 256, (g, w, h) => {
      g.fillStyle = '#5aae52'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#67bb5e'
      g.fillRect(0, 0, w / 2, h)
      const r = rng(3)
      // Clumps, lighter and darker, drawn across the edges too so the tiles meet without a seam.
      for (let i = 0; i < 70; i++) {
        const x = r() * w
        const y = r() * h
        const rad = 8 + r() * 20
        const dark = r() > 0.5
        for (const dx of [-w, 0, w])
          for (const dy of [-h, 0, h]) {
            const clump = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad)
            clump.addColorStop(0, dark ? 'rgba(36,88,38,0.16)' : 'rgba(170,220,130,0.12)')
            clump.addColorStop(1, 'rgba(0,0,0,0)')
            g.fillStyle = clump
            g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2)
          }
      }
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(34,84,34,0.22)' : 'rgba(178,228,148,0.16)'
        g.fillRect(r() * w, r() * h, 1, 1 + r() * 2)
      }
    })
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    const grass = new THREE.MeshLambertMaterial({ map: tex })
    // On a hilly track, the rolling ground round it; past that (and under a flat track), a plain.
    if (this.terrain) {
      this.scene.add(this.terrain.mesh(grass))
      this.bankGrass = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })
    }
    const plainTex = tex.clone()
    plainTex.repeat.set(4000 / 24, 4000 / 24)
    this.textures.push(plainTex)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map: plainTex }))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(this.box.cx, this.terrain ? this.terrain.base - 0.4 : -0.02, -this.box.cy)
    this.scene.add(ground)
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
   * Asphalt with its grain, patches where it was laid at different times and rubber down the middle, white
   * edges; kerbs, red and white, round every corner; gravel on the outside of the slow ones; and the fence.
   */
  private buildRoad() {
    const track = this.track
    const tarmac = this.paint(512, 512, (g, w, h) => {
      g.fillStyle = '#474b53'
      g.fillRect(0, 0, w, h)
      const r = rng(11)
      // Patches, faint, carried over the top and bottom so the road repeats without a seam.
      for (let i = 0; i < 16; i++) {
        const x = r() * w
        const y = r() * h
        const rad = 40 + r() * 90
        const light = r() > 0.5
        for (const dy of [-h, 0, h]) {
          const patch = g.createRadialGradient(x, y + dy, 0, x, y + dy, rad)
          patch.addColorStop(0, light ? 'rgba(120,124,132,0.1)' : 'rgba(22,24,28,0.12)')
          patch.addColorStop(1, 'rgba(0,0,0,0)')
          g.fillStyle = patch
          g.fillRect(x - rad, y + dy - rad, rad * 2, rad * 2)
        }
      }
      for (let i = 0; i < 16000; i++) {
        const v = 42 + Math.floor(r() * 60)
        g.fillStyle = `rgba(${v},${v + 2},${v + 7},0.5)`
        const size = 1 + r() * 1.5
        g.fillRect(r() * w, r() * h, size, size)
      }
      // Rubber laid down where the cars run, darkest in the middle.
      const rubber = g.createLinearGradient(0, 0, w, 0)
      rubber.addColorStop(0.14, 'rgba(22,24,28,0)')
      rubber.addColorStop(0.5, 'rgba(22,24,28,0.36)')
      rubber.addColorStop(0.86, 'rgba(22,24,28,0)')
      g.fillStyle = rubber
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#f2f1ea'
      g.fillRect(w * 0.035, 0, w * 0.03, h)
      g.fillRect(w * 0.935, 0, w * 0.03, h)
    })
    tarmac.wrapT = THREE.RepeatWrapping
    this.strip(0, track.n, -TW, TW, 0.01, 14, new THREE.MeshLambertMaterial({ map: tarmac, side: THREE.DoubleSide }))
    this.bank(0, track.n, TW)
    this.bank(0, track.n, -TW)

    const kerbTex = this.paint(8, 64, (g, w, h) => {
      g.fillStyle = '#e2362f'
      g.fillRect(0, 0, w, h / 2)
      g.fillStyle = '#f6f4ee'
      g.fillRect(0, h / 2, w, h / 2)
    })
    kerbTex.wrapT = THREE.RepeatWrapping
    kerbTex.magFilter = THREE.NearestFilter
    const kerb = new THREE.MeshLambertMaterial({ map: kerbTex, side: THREE.DoubleSide })
    for (const c of track.corners) {
      this.strip(c.from - 8, c.to + 8, TW, TW + 1.4, 0.04, 4, kerb)
      this.strip(c.from - 8, c.to + 8, -TW - 1.4, -TW, 0.04, 4, kerb)
      this.bank(c.from - 8, c.to + 8, TW + 1.4)
      this.bank(c.from - 8, c.to + 8, -TW - 1.4)
    }
    this.buildGravel()
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
   * A strip lying on the ground beside the road, between two offsets (left positive), `across` pieces
   * wide so it follows the ground's shape; its texture repeats every `metres` both ways.
   */
  private groundStrip(rows: number[], inner: number, outer: number, across: number, lift: number, metres: number, material: THREE.Material) {
    const t = this.track
    const cols = across + 1
    const pos = new Float32Array(rows.length * cols * 3)
    const uv = new Float32Array(rows.length * cols * 2)
    const index: number[] = []
    rows.forEach((j, r) => {
      const i = ((j % t.n) + t.n) % t.n
      const nx = -Math.sin(t.h[i]!)
      const ny = Math.cos(t.h[i]!)
      const along = t.s[i]! + Math.floor(j / t.n) * t.length
      for (let c = 0; c < cols; c++) {
        const o = inner + ((outer - inner) * c) / across
        const x = t.x[i]! + nx * o
        const y = t.y[i]! + ny * o
        pos.set([x, this.groundZ(x, y) + lift, -y], (r * cols + c) * 3)
        uv.set([(o - inner) / metres, along / metres], (r * cols + c) * 2)
        if (r > 0 && c > 0) {
          const a = (r - 1) * cols + c - 1
          const b = r * cols + c - 1
          index.push(a, b, a + 1, a + 1, b, b + 1)
        }
      }
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(index)
    geo.computeVertexNormals()
    this.scene.add(new THREE.Mesh(geo, material))
  }

  /**
   * On a hilly track, a bank of grass down from an edge of the road (or of a kerb, left positive), leaning
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

  /** Gravel on the outside of every slow corner, from the kerb out, where a car that runs wide ends up. */
  private buildGravel() {
    const gravel = this.paint(128, 128, (g, w, h) => {
      g.fillStyle = '#cdbd97'
      g.fillRect(0, 0, w, h)
      const r = rng(71)
      for (let i = 0; i < 2600; i++) {
        const v = r()
        g.fillStyle = v > 0.66 ? 'rgba(245,236,212,0.7)' : v > 0.33 ? 'rgba(150,132,98,0.55)' : 'rgba(112,98,74,0.45)'
        g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5)
      }
    })
    gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping
    const material = new THREE.MeshLambertMaterial({ map: gravel, side: THREE.DoubleSide })
    const depth = 20
    for (const c of this.track.corners) {
      if (c.r > 50) continue
      const side = -Math.sign(c.turn)
      const inner = side * (TW + 1.4)
      const outer = side * (TW + 1.4 + depth)
      for (const run of this.clearRuns(c.from - 6, c.to + 14, 2, [inner, outer, (inner + outer) / 2])) {
        this.groundStrip(run, inner, outer, 5, 0.09, 5, material)
      }
    }
  }

  /** The fence at the barrier, both sides, all the way round: a steel rail on posts, standing on the ground. */
  private buildFence() {
    const t = this.track
    const steel = this.paint(128, 64, (g, w, h) => {
      g.fillStyle = '#aeb6bf'
      g.fillRect(0, 0, w, h)
      for (const y of [0.16, 0.5]) {
        g.fillStyle = '#d9dee4'
        g.fillRect(0, h * y, w, h * 0.12)
        g.fillStyle = '#7f8893'
        g.fillRect(0, h * (y + 0.12), w, h * 0.06)
      }
      g.fillStyle = '#5d6570'
      g.fillRect(0, 0, w * 0.06, h)
      g.fillStyle = 'rgba(40,46,54,0.25)'
      g.fillRect(0, h * 0.84, w, h * 0.16)
    })
    steel.wrapS = THREE.RepeatWrapping
    const material = new THREE.MeshLambertMaterial({ map: steel, side: THREE.DoubleSide })
    const height = 0.95
    for (const side of [1, -1]) {
      const o = side * CAR.barrier
      for (const run of this.clearRuns(0, t.n, 3, [o])) {
        const pos = new Float32Array(run.length * 6)
        const uv = new Float32Array(run.length * 4)
        const index: number[] = []
        run.forEach((j, r) => {
          const i = ((j % t.n) + t.n) % t.n
          const x = t.x[i]! - Math.sin(t.h[i]!) * o
          const y = t.y[i]! + Math.cos(t.h[i]!) * o
          const foot = this.groundZ(x, y) - 0.1
          const along = (t.s[i]! + Math.floor(j / t.n) * t.length) / 4
          pos.set([x, foot, -y, x, foot + height, -y], r * 6)
          uv.set([along, 0, along, 1], r * 4)
          if (r > 0) {
            const k = (r - 1) * 2
            index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
          }
        })
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
        geo.setIndex(index)
        geo.computeVertexNormals()
        this.scene.add(new THREE.Mesh(geo, material))
      }
    }
  }

  /** The start line, the gantry over it, and a grandstand beside the straight. */
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
    const steel = new THREE.MeshLambertMaterial({ color: '#2b313a' })
    for (const side of [1, -1]) {
      const px = track.x[i]! + nx * (TW + 2) * side
      const py = track.y[i]! + ny * (TW + 2) * side
      // Down to the ground, wherever it is, and up to the beam.
      const foot = Math.min(this.groundZ(px, py), lineZ)
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, lineZ + 8 - foot, 0.7), steel)
      post.position.copy(W(px, py, (foot + lineZ + 8) / 2))
      scene.add(post)
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, 2 * TW + 5), steel)
    beam.position.copy(W(track.x[i]!, track.y[i]!, lineZ + 8))
    beam.rotation.y = h
    scene.add(beam)
    // The gantry's banner in Hot Lap's orange, the site's dark ink on it, and Blipka's mark at the end.
    const banner = this.paint(
      512,
      96,
      (g, w, hh) => {
        g.fillStyle = '#f2813a'
        g.fillRect(0, 0, w, hh)
        g.fillStyle = '#1a2b3c'
        g.font = `800 60px ${FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('Hot Lap', w / 2 - 30, hh / 2 + 2)
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
    this.buildStand()
  }

  /**
   * The grandstand on the outside of the start straight, as long as the straight has room for: a crowd in
   * the arcade's colours on a raked deck, walls of concrete, a roof on posts at the back, and the site's name
   * along the front. On a hill it leans down it with the road.
   */
  private buildStand() {
    const track = this.track
    const i = track.startIndex
    const h = track.h[i]!
    const nx = -Math.sin(h)
    const ny = Math.cos(h)
    const along = standLength(track)
    const cx = track.x[i]! + Math.cos(h) * (20 + along / 2)
    const cy = track.y[i]! + Math.sin(h) * (20 + along / 2)
    const out = standSide(track)
    const from = this.groundZ(cx - Math.cos(h) * (along / 2) + out * nx * (TW + 20), cy - Math.sin(h) * (along / 2) + out * ny * (TW + 20))
    const to = this.groundZ(cx + Math.cos(h) * (along / 2) + out * nx * (TW + 20), cy + Math.sin(h) * (along / 2) + out * ny * (TW + 20))
    const standZ = (from + to) / 2
    const lean = Math.atan2(to - from, along)

    // Built along x (the straight), up y, and out from the road along −z × the side it's on.
    const stand = new THREE.Group()
    stand.position.copy(W(cx, cy, standZ - (this.terrain ? 0.3 : 0)))
    stand.rotation.order = 'YZX'
    stand.rotation.set(0, h, lean)
    const z = (d: number) => -out * d
    const front = TW + 15
    const deckFrom = front + 0.4
    const deckTo = front + 13
    const low = 1.7
    const high = low + (deckTo - deckFrom) * 0.56

    // Eight rows of seats, a person to most of them: shoulders in a shirt and a head, at the size they'd be.
    const crowd = this.paint(1024, 128, (g, w, hh) => {
      g.fillStyle = '#4a525e'
      g.fillRect(0, 0, w, hh)
      const r = rng(17)
      // Mostly the dark and plain things people wear, with the arcade's colours dotted through.
      const shirts = ['#2e3440', '#3b4a63', '#5a6270', '#1f2530', '#8b8f96', '#d9d7cf', '#4f7fb0', '#b85a55', '#c9a24f', '#4e9aa0', '#c4733f', '#7462a8']
      const skin = ['#f1c7a3', '#d9a47c', '#a86f4c', '#6f4630']
      for (let row = 0; row < 8; row++) {
        const y = row * 16
        g.fillStyle = '#343a44'
        g.fillRect(0, y + 13, w, 3)
        for (let x = 4 + r() * 6; x < w - 16; x += 17 + r() * 5) {
          if (r() < 0.16) continue
          g.fillStyle = shirts[Math.floor(r() * shirts.length)]!
          g.fillRect(x, y + 7.5, 13, 6.5)
          g.fillStyle = skin[Math.floor(r() * skin.length)]!
          g.beginPath()
          g.arc(x + 6.5, y + 5, 3.4, 0, Math.PI * 2)
          g.fill()
        }
      }
    })
    crowd.wrapS = THREE.RepeatWrapping
    const deckGeo = new THREE.BufferGeometry()
    deckGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-along / 2, low, z(deckFrom), along / 2, low, z(deckFrom), -along / 2, high, z(deckTo), along / 2, high, z(deckTo)], 3),
    )
    deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, along / 26, 0, 0, 1, along / 26, 1], 2))
    deckGeo.setIndex([0, 1, 2, 2, 1, 3])
    deckGeo.computeVertexNormals()
    stand.add(new THREE.Mesh(deckGeo, new THREE.MeshLambertMaterial({ map: crowd, side: THREE.DoubleSide })))

    const banner = this.paint(
      1024,
      64,
      (g, w, hh) => {
        g.fillStyle = '#1a2b3c'
        g.fillRect(0, 0, w, hh)
        g.textBaseline = 'middle'
        for (let k = 0; k < 3; k++) {
          const x = (k * w) / 3
          g.fillStyle = '#f2813a'
          g.fillRect(x, 0, 6, hh)
          g.textAlign = 'left'
          g.font = `800 34px ${FONT}`
          g.fillText('HOT LAP', x + 28, hh / 2 + 2)
          const gap = g.measureText('HOT LAP').width + 44
          g.font = `700 30px ${FONT}`
          g.fillStyle = '#f6f4ee'
          g.fillText('blipka', x + gap, hh / 2 + 2)
        }
      },
      true,
    )
    banner.wrapS = THREE.RepeatWrapping
    banner.repeat.set(Math.max(1, Math.round(along / 48)), 1)
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(along, low), new THREE.MeshLambertMaterial({ map: banner, side: THREE.DoubleSide }))
    wall.position.set(0, low / 2, z(front))
    // Its face to the road, whichever side the stand is on, so the name reads the right way round.
    wall.rotation.y = out > 0 ? 0 : Math.PI
    stand.add(wall)

    const concrete = new THREE.MeshLambertMaterial({ color: '#c8cdd4' })
    const back = new THREE.Mesh(new THREE.BoxGeometry(along + 0.8, high + 1, 0.5), concrete)
    back.position.set(0, (high + 1) / 2, z(deckTo + 0.25))
    stand.add(back)
    for (const end of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, high + 1, deckTo - front + 0.5), concrete)
      side.position.set((end * (along + 0.3)) / 2, (high + 1) / 2, z((front + deckTo) / 2))
      stand.add(side)
    }
    const roofY = high + 4
    // White on top; underneath, the grey of its girders in shade, not the green the grass light would give it.
    const roofTop = new THREE.MeshLambertMaterial({ color: '#eef2f6' })
    const underneath = new THREE.MeshBasicMaterial({ color: '#8e97a3' })
    const roof = new THREE.Mesh(new THREE.BoxGeometry(along + 6, 0.5, 16), [roofTop, roofTop, roofTop, underneath, roofTop, roofTop])
    roof.position.set(0, roofY, z(front + 7.5))
    stand.add(roof)
    const posts = Math.max(2, Math.round(along / 26) + 1)
    const steel = new THREE.MeshLambertMaterial({ color: '#2b313a' })
    for (let k = 0; k < posts; k++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, roofY - high, 0.5), steel)
      post.position.set(-along / 2 + (along * k) / (posts - 1), (roofY + high) / 2, z(deckTo - 0.2))
      stand.add(post)
    }
    this.scene.add(stand)
  }

  /**
   * Braking boards before each slow corner that ends a long straight: 150, 100, 50 metres to go, on the
   * outside. A board that would stand on another stretch of road is left out.
   */
  private buildBoards() {
    const track = this.track
    const { n } = track
    const postMat = new THREE.MeshLambertMaterial({ color: '#8b939e' })
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
            g.fillStyle = '#ffffff'
            g.fillRect(0, 0, w, hh)
            g.strokeStyle = '#1b1f26'
            g.lineWidth = 8
            g.strokeRect(4, 4, w - 8, hh - 8)
            g.fillStyle = '#1a2b3c'
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

  /** Tyre walls where the fence is, on the outside of the slow corners, wherever they'd stand clear of the road. */
  private buildTyreWalls() {
    const track = this.track
    const spots: [number, number][] = []
    for (const c of track.corners) {
      if (c.r > 50) continue
      const outside = -Math.sign(c.turn) * (CAR.barrier - 1)
      for (let i = c.from - 10; i <= c.to + 10; i += 2) {
        const k = ((i % track.n) + track.n) % track.n
        const x = track.x[k]! - Math.sin(track.h[k]!) * outside
        const y = track.y[k]! + Math.cos(track.h[k]!) * outside
        if (offRoad(track, x, y) >= TW + 6) spots.push([x, y])
      }
    }
    if (!spots.length) return
    const walls = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 10), new THREE.MeshLambertMaterial({ color: '#23262b' }), spots.length)
    const bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.57, 0.57, 0.3, 10), new THREE.MeshLambertMaterial({ color: '#f6f4ee' }), spots.length)
    const m = new THREE.Matrix4()
    spots.forEach(([x, y], k) => {
      const foot = this.groundZ(x, y)
      m.makeTranslation(x, foot + 0.55, -y)
      walls.setMatrixAt(k, m)
      m.makeTranslation(x, foot + 0.85, -y)
      bands.setMatrixAt(k, m)
    })
    this.scene.add(walls, bands)
  }

  /**
   * Trees well back from the road and clear of the grandstand, over the ground round the track: pines and
   * round-headed broadleaves, no two quite the same shade, each with its shadow on the ground. Then rolling
   * hills in the haze, and mountains behind them.
   */
  private buildTrees() {
    const track = this.track
    const box = this.box
    const r = rng(29)
    const spots: [number, number, number, number][] = []
    const x0 = box.minX - 320
    const y0 = box.minY - 320
    const w = box.width + 640
    const d = box.height + 640
    // About one tree to every 4,000 m² of the ground round the track, as the classic track had.
    const want = Math.min(700, Math.round((w * d) / 3900))
    const i0 = track.startIndex
    const h0 = track.h[i0]!
    const standEnd = 20 + standLength(track) + 25
    for (let tries = 0; tries < want * 6 && spots.length < want; tries++) {
      const x = x0 + r() * w
      const y = y0 + r() * d
      if (offRoad(track, x, y) < 46) continue
      const dx = x - track.x[i0]!
      const dy = y - track.y[i0]!
      const ahead = dx * Math.cos(h0) + dy * Math.sin(h0)
      const out = (-dx * Math.sin(h0) + dy * Math.cos(h0)) * standSide(track)
      if (ahead > -40 && ahead < standEnd && out > 0 && out < TW + 48) continue
      spots.push([x, y, 0.7 + r() * 0.8, r()])
    }
    const pines = spots.filter((s) => s[3] < 0.62)
    const broad = spots.filter((s) => s[3] >= 0.62)

    // A pine in three tiers, turned on a lathe; a broadleaf's head, faceted.
    const pineGeo = new THREE.LatheGeometry(
      [
        [0, 2.2],
        [3.4, 2.7],
        [1.7, 5.3],
        [2.8, 5.5],
        [1.2, 8.3],
        [2, 8.5],
        [0, 11.8],
      ].map(([rad, y]) => new THREE.Vector2(rad, y)),
      7,
    )
    const headGeo = new THREE.IcosahedronGeometry(3.3, 0)
    headGeo.scale(1, 0.86, 1)
    const leaves = (count: number, geo: THREE.BufferGeometry) =>
      new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), count)
    const pineMesh = leaves(pines.length, pineGeo)
    const headMesh = leaves(broad.length, headGeo)
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.46, 3.4, 6), new THREE.MeshLambertMaterial({ color: '#6b4a32' }), spots.length)

    // Each tree's shadow, a soft dark patch lying on the ground under it, pushed away from the sun.
    const blob = this.paint(64, 64, (g, bw, bh) => {
      const shade = g.createRadialGradient(bw / 2, bh / 2, 0, bw / 2, bh / 2, bw / 2)
      shade.addColorStop(0, 'rgba(18,40,22,0.5)')
      shade.addColorStop(0.6, 'rgba(18,40,22,0.26)')
      shade.addColorStop(1, 'rgba(18,40,22,0)')
      g.fillStyle = shade
      g.fillRect(0, 0, bw, bh)
    })
    const shadowGeo = new THREE.PlaneGeometry(1, 1)
    shadowGeo.rotateX(-Math.PI / 2)
    const shadows = new THREE.InstancedMesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      spots.length,
    )
    shadows.renderOrder = 1

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const upright = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const colour = new THREE.Color()
    const upAxis = new THREE.Vector3(0, 1, 0)
    const normal = new THREE.Vector3()
    const pineCount = { n: 0 }
    const headCount = { n: 0 }
    spots.forEach(([x, y, s, kind], k) => {
      const foot = this.groundZ(x, y)
      const pine = kind < 0.62
      q.setFromAxisAngle(upAxis, kind * 40)
      m.compose(new THREE.Vector3(x, foot + 1.7 * s - 0.2, -y), upright, scale.set(s, pine ? s : s * 1.25, s))
      trunks.setMatrixAt(k, m)
      if (pine) {
        m.compose(new THREE.Vector3(x, foot - 0.2, -y), q, scale.set(s, s, s))
        pineMesh.setMatrixAt(pineCount.n, m)
        colour.setHSL(0.36 + (kind - 0.31) * 0.08, 0.42 + kind * 0.1, 0.25 + ((kind * 7.3) % 1) * 0.08)
        pineMesh.setColorAt(pineCount.n++, colour)
      } else {
        m.compose(new THREE.Vector3(x, foot + 6.2 * s - 0.2, -y), q, scale.set(s, s, s))
        headMesh.setMatrixAt(headCount.n, m)
        colour.setHSL(0.26 + (kind - 0.62) * 0.2, 0.45 + (kind - 0.62) * 0.3, 0.33 + ((kind * 11.7) % 1) * 0.08)
        headMesh.setColorAt(headCount.n++, colour)
      }
      // Lying on the slope it's on, as the ground's own normal has it.
      const sx = x + 0.9 * s * 1.6
      const sy = y + 0.5 * s * 1.6
      const e = 1.5
      const gx = (this.groundZ(sx + e, sy) - this.groundZ(sx - e, sy)) / (2 * e)
      const gy = (this.groundZ(sx, sy + e) - this.groundZ(sx, sy - e)) / (2 * e)
      normal.set(-gx, 1, gy).normalize()
      q.setFromUnitVectors(upAxis, normal)
      const spread = (pine ? 7 : 8.4) * s
      m.compose(new THREE.Vector3(sx, this.groundZ(sx, sy) + 0.12, -sy), q, scale.set(spread, 1, spread))
      shadows.setMatrixAt(k, m)
    })
    this.scene.add(shadows, trunks, pineMesh, headMesh)

    const base = this.terrain?.base ?? 0
    const ring = Math.max(box.width, box.height) / 2 + 900

    // Rolling hills in the haze: domes, darker at the foot, paler up top, as far things are.
    const domeGeo = new THREE.SphereGeometry(1, 22, 9, 0, Math.PI * 2, 0, Math.PI / 2)
    shadeByHeight(domeGeo, '#5f8e79', '#a9cbbd')
    const hills = new THREE.InstancedMesh(domeGeo, new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }), 34)
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

    // Mountains far behind them, low on the horizon, blue with distance and pale at the top.
    const peakGeo = new THREE.ConeGeometry(1, 1, 7, 3)
    peakGeo.translate(0, 0.5, 0)
    shadeByHeight(peakGeo, '#a3b9c8', '#e8eff4')
    const peaks = new THREE.InstancedMesh(peakGeo, new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, flatShading: true }), 26)
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
   * What the paint reflects: the sky, the grass at the horizon and the dark road under the car, which
   * give the pearl its shape, and above them the sun and soft light panels like a studio's. It's worked
   * out in floating point with the sun and the panels several times brighter than the sky, as real
   * lights are, so the clear coat shows them as bright streaks. Only the car's materials use it.
   */
  private buildReflections() {
    const w = 512
    const h = 256
    const sky = document.createElement('canvas')
    sky.width = w
    sky.height = h
    const g = sky.getContext('2d', { willReadFrequently: true })!
    const up = g.createLinearGradient(0, 0, 0, h / 2)
    up.addColorStop(0, '#3f8fd6')
    up.addColorStop(1, '#e2f4fb')
    g.fillStyle = up
    g.fillRect(0, 0, w, h / 2)
    const down = g.createLinearGradient(0, h / 2, 0, h)
    down.addColorStop(0, '#7d9c70')
    down.addColorStop(0.12, '#3c4a3a')
    down.addColorStop(0.4, '#23272c')
    down.addColorStop(1, '#141619')
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
        color: 0x16171a,
        transparent: true,
        opacity: 0.42,
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

  /* ---------- each frame ---------- */

  /** A new lap: the camera drops in behind the car, and the tyres start fresh marks. */
  startLap() {
    this.lastMark.fill(null)
    this.snap = true
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
    this.poseCar(f.run, dt)
    if (f.driving) this.layRubber(f.run)
    this.tagGhost(f.ghostTag ?? null)
    this.poseGhost(f.ghost, f.run, dt)
    this.frameCamera(f, dt)
    this.renderer.render(this.scene, this.camera)
  }

  /** The body leans out of corners and dips its nose under braking, as the weight moves: a racer's stiff springs, so not much. */
  private poseCar(run: Run, dt: number) {
    const car = this.car
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
    // Its name fades as it comes alongside, so it never sits in front of your own car.
    if (this.ghostTag) (this.ghostTag.material as THREE.SpriteMaterial).opacity = 0.95 * Math.min(1, Math.max(0, (apart - 4) / 6))
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
    if (this.snap) {
      this.camHeading = travel
      this.camNear = -1
      this.lookNear = -1
    } else {
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

/** Colours a shape's points from `foot` at its lowest to `top` at its highest, for things seen far off. */
function shadeByHeight(geo: THREE.BufferGeometry, foot: string, top: string) {
  const position = geo.attributes.position!
  geo.computeBoundingBox()
  const lo = geo.boundingBox!.min.y
  const hi = geo.boundingBox!.max.y
  const a = new THREE.Color(foot)
  const b = new THREE.Color(top)
  const colours: number[] = []
  for (let i = 0; i < position.count; i++) {
    const c = a.clone().lerp(b, Math.pow((position.getY(i) - lo) / (hi - lo || 1), 0.8))
    colours.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3))
}

/** How far a point is from the middle of the road, anywhere along the track. */
function offRoad(track: Track, x: number, y: number) {
  const near = nearest(track, x, y, -1)
  return Math.hypot(x - track.x[near.index]!, y - track.y[near.index]!)
}

/** The grandstand's length: 190 m, or what the start straight has room for past the line and short of the braking. */
function standLength(track: Track) {
  return Math.max(80, Math.min(190, track.straights.A - 70 - 20 - 60))
}

/** Which side of the start straight the grandstand stands, the outside: right (−1), or left (+1) on a clockwise track. */
function standSide(track: Track) {
  return track.clockwise ? 1 : -1
}
