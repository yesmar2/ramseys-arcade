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
  /** Where the ghost and the camera were last found on the track, to find them again quickly. */
  private ghostNear = -1
  private camNear = -1
  private lookNear = -1
  /** The camera's height and where it looks, eased so a bump in the road doesn't jolt them. */
  private camY = 0
  private lookY = 0

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

  /** A dome from deep blue overhead to haze at the horizon, a sky light, and the sun. */
  private buildSky(haze: THREE.Color) {
    const geo = new THREE.SphereGeometry(3000, 32, 16)
    const top = new THREE.Color('#4f9fe0')
    const colors: number[] = []
    for (let i = 0; i < geo.attributes.position!.count; i++) {
      const up = Math.max(0, geo.attributes.position!.getY(i) / 3000)
      const c = haze.clone().lerp(top, Math.pow(up, 0.55))
      colors.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })))
    this.scene.add(new THREE.HemisphereLight(0xe4f3ff, 0x4d7a43, 1.15))
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.9)
    sun.position.set(-320, 520, 180)
    this.scene.add(sun)
  }

  /** Grass, mown in stripes. */
  private buildGround() {
    const tex = this.paint(64, 64, (g, w, h) => {
      g.fillStyle = '#5fb257'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#6bbd62'
      g.fillRect(0, 0, w / 2, h)
      const r = rng(3)
      for (let i = 0; i < 260; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(40,90,40,0.18)' : 'rgba(170,220,140,0.14)'
        g.fillRect(r() * w, r() * h, 1, 1)
      }
    })
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    const grass = new THREE.MeshLambertMaterial({ map: tex })
    // On a hilly track, the rolling ground round it; past that (and under a flat track), a plain.
    if (this.terrain) this.scene.add(this.terrain.mesh(grass))
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
    const road = this.roadZ(index)
    const off = Math.abs(side) - (TW + 0.6)
    if (off <= 0) return road
    return road + (this.terrain.heightAt(x, y) - road) * Math.min(1, off / 3)
  }

  /** How a car pointing `heading` tips on the hill it's on: nose up (+) and leaning right (+), in radians. */
  private tilt(index: number, heading: number) {
    const grade = this.track.grade ? this.track.grade[index]! : 0
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

  /** Speckled asphalt with white edges, and kerbs, red and white, round every corner. */
  private buildRoad() {
    const track = this.track
    const tarmac = this.paint(256, 256, (g, w, h) => {
      g.fillStyle = '#464a52'
      g.fillRect(0, 0, w, h)
      const r = rng(11)
      for (let i = 0; i < 3200; i++) {
        const v = 50 + Math.floor(r() * 46)
        g.fillStyle = `rgba(${v},${v + 2},${v + 7},0.55)`
        g.fillRect(r() * w, r() * h, 1.6, 1.6)
      }
      g.fillStyle = 'rgba(30,32,36,0.35)'
      g.fillRect(w * 0.3, 0, w * 0.4, h)
      g.fillStyle = '#f2f1ea'
      g.fillRect(w * 0.035, 0, w * 0.03, h)
      g.fillRect(w * 0.935, 0, w * 0.03, h)
    })
    tarmac.wrapT = THREE.RepeatWrapping
    this.strip(0, track.n, -TW, TW, 0.01, 14, new THREE.MeshLambertMaterial({ map: tarmac, side: THREE.DoubleSide }))

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

    // Rows of the arcade's colours stepping back on the outside of the straight, as long as it has room for.
    // On a hill they step down it with the road.
    const rows = ['#e8564f', '#f5b942', '#3ec8cf', '#4aa8e8', '#8a6ad4']
    const along = standLength(track)
    const cx = track.x[i]! + Math.cos(h) * (20 + along / 2)
    const cy = track.y[i]! + Math.sin(h) * (20 + along / 2)
    const out = standSide(track)
    const from = this.groundZ(cx - Math.cos(h) * (along / 2) + out * nx * (TW + 20), cy - Math.sin(h) * (along / 2) + out * ny * (TW + 20))
    const to = this.groundZ(cx + Math.cos(h) * (along / 2) + out * nx * (TW + 20), cy + Math.sin(h) * (along / 2) + out * ny * (TW + 20))
    const standZ = (from + to) / 2
    const lean = Math.atan2(to - from, along)
    rows.forEach((col, r) => {
      const d = TW + 16 + r * 2.4
      const tier = new THREE.Mesh(new THREE.BoxGeometry(along, 1 + r * 1.1, 2.4), new THREE.MeshLambertMaterial({ color: col }))
      tier.position.copy(W(cx + out * nx * d, cy + out * ny * d, standZ + (1 + r * 1.1) / 2 - (this.terrain ? 0.3 : 0)))
      tier.rotation.order = 'YZX'
      tier.rotation.set(0, h, lean)
      scene.add(tier)
    })
    const roof = new THREE.Mesh(new THREE.BoxGeometry(along + 6, 0.5, 15), new THREE.MeshLambertMaterial({ color: '#eef2f6' }))
    roof.position.copy(W(cx + out * nx * (TW + 21), cy + out * ny * (TW + 21), standZ + 11))
    roof.rotation.order = 'YZX'
    roof.rotation.set(0, h, lean)
    scene.add(roof)
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

  /** Trees well back from the road and clear of the grandstand, over the ground round the track, and hills in the haze. */
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
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 6), new THREE.MeshLambertMaterial({ color: '#6b4a32' }), spots.length)
    const light = spots.filter((s) => s[3] > 0.5)
    const dark = spots.filter((s) => s[3] <= 0.5)
    const cone = new THREE.ConeGeometry(3.2, 9, 7)
    const leavesA = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ color: '#3f8f46' }), light.length)
    const leavesB = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ color: '#2f7a44' }), dark.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    spots.forEach(([x, y, s], k) => {
      m.compose(new THREE.Vector3(x, this.groundZ(x, y) + 1.5 * s - 0.2, -y), q, scale.set(s, s, s))
      trunks.setMatrixAt(k, m)
    })
    for (const [mesh, list] of [
      [leavesA, light],
      [leavesB, dark],
    ] as const) {
      list.forEach(([x, y, s], k) => {
        m.compose(new THREE.Vector3(x, this.groundZ(x, y) + 7.5 * s - 0.2, -y), q, scale.set(s, s, s))
        mesh.setMatrixAt(k, m)
      })
    }
    this.scene.add(trunks, leavesA, leavesB)

    const hillMat = new THREE.MeshLambertMaterial({ color: '#86b6a4', fog: false })
    const hr = rng(41)
    const ring = Math.max(box.width, box.height) / 2 + 900
    for (let k = 0; k < 34; k++) {
      const a = (k / 34) * Math.PI * 2 + hr() * 0.1
      const far = ring + hr() * 350
      const hill = new THREE.Mesh(new THREE.ConeGeometry(160 + hr() * 180, 70 + hr() * 120, 9), hillMat)
      hill.position.set(box.cx + Math.cos(a) * far, (this.terrain?.base ?? 0) + 20, -box.cy + Math.sin(a) * far)
      this.scene.add(hill)
    }
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
    const roadAt = this.roadZ(i)
    const grade = this.track.grade ? this.track.grade[i]! : 0
    const tx = Math.cos(this.track.h[i]!)
    const ty = Math.sin(this.track.h[i]!)
    const lift = (px: number, py: number) => roadAt + grade * ((px - run.x) * tx + (py - run.y) * ty) + 0.025
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
    this.poseGhost(f.ghost, f.run, dt)
    this.frameCamera(f, dt)
    this.renderer.render(this.scene, this.camera)
  }

  /** The body leans out of corners and dips its nose under braking, as the weight moves: a racer's stiff springs, so not much. */
  private poseCar(run: Run, dt: number) {
    const car = this.car
    car.group.position.set(run.x, this.surfaceZ(run.x, run.y, run.index, run.side), -run.y)
    // Standing on the hill: nose up a climb, leaning with the slope across it.
    const hill = this.tilt(run.index, run.h)
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
      const { pitch, roll } = this.tilt(near.index, pose.h)
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
