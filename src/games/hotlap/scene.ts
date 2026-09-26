/*
 * Hot Lap in 3D: the track and its grounds, the car and its ghost, the rubber a lap leaves behind, and
 * the camera that follows. The simulation's (x, y) is the ground plane, drawn on three's x and −z.
 */
import * as THREE from 'three'
import type { GhostPose } from './lap'
import { CAR, HALF_WIDTH as TW, nearest, type Run, type Track } from './sim'

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

type CarModel = { group: THREE.Group; body: THREE.Group; wheels: THREE.Mesh[]; steer: THREE.Group[]; see: THREE.Material[] }

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
/** Each wheel as [forward, left] of the car's middle, front pair first. */
const WHEEL_AT: [number, number][] = [
  [1.45, 0.95],
  [1.45, -0.95],
  [-1.4, 0.95],
  [-1.4, -0.95],
]

export class HotLapScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.4, 4000)
  private readonly track: Track
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

  constructor(canvas: HTMLCanvasElement, track: Track) {
    this.track = track
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
    const decal = this.buildDecal()
    this.car = this.makeCar('#f2813a', false, decal)
    this.ghostCar = this.makeCar('#4aa8e8', true, decal)
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
    tex.repeat.set(4000 / 24, 4000 / 24)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map: tex }))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(180, -0.02, -110)
    this.scene.add(ground)
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
      const a = W(track.x[i]! + nx * inner, track.y[i]! + ny * inner, lift)
      const b = W(track.x[i]! + nx * outer, track.y[i]! + ny * outer, lift)
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
    const steel = new THREE.MeshLambertMaterial({ color: '#2b313a' })
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 0.7), steel)
      post.position.copy(W(track.x[i]! + nx * (TW + 2) * side, track.y[i]! + ny * (TW + 2) * side, 4))
      scene.add(post)
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, 2 * TW + 5), steel)
    beam.position.copy(W(track.x[i]!, track.y[i]!, 8))
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
    sign.position.copy(W(track.x[i]! - Math.cos(h) * 0.55, track.y[i]! - Math.sin(h) * 0.55, 8))
    sign.rotation.y = h - Math.PI / 2
    scene.add(sign)

    // Rows of the arcade's colours stepping back on the outside of the straight.
    const rows = ['#e8564f', '#f5b942', '#3ec8cf', '#4aa8e8', '#8a6ad4']
    const along = 190
    const cx = track.x[i]! + Math.cos(h) * 110
    const cy = track.y[i]! + Math.sin(h) * 110
    rows.forEach((col, r) => {
      const d = TW + 16 + r * 2.4
      const tier = new THREE.Mesh(new THREE.BoxGeometry(along, 1 + r * 1.1, 2.4), new THREE.MeshLambertMaterial({ color: col }))
      tier.position.copy(W(cx - nx * d, cy - ny * d, (1 + r * 1.1) / 2))
      tier.rotation.y = h
      scene.add(tier)
    })
    const roof = new THREE.Mesh(new THREE.BoxGeometry(along + 6, 0.5, 15), new THREE.MeshLambertMaterial({ color: '#eef2f6' }))
    roof.position.copy(W(cx - nx * (TW + 21), cy - ny * (TW + 21), 11))
    roof.rotation.y = h
    scene.add(roof)
  }

  /** Braking boards before the hairpin: 150, 100, 50 metres to go. */
  private buildBoards() {
    const track = this.track
    const hairpin = track.corners.find((c) => c.name === 'Hairpin')
    if (!hairpin) return
    const postMat = new THREE.MeshLambertMaterial({ color: '#8b939e' })
    for (const to of [150, 100, 50]) {
      const i = hairpin.from - to
      const h = track.h[i]!
      const side = -(TW + 4)
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
      board.position.copy(W(track.x[i]! - Math.sin(h) * side, track.y[i]! + Math.cos(h) * side, 2.4))
      board.rotation.y = h - Math.PI / 2
      this.scene.add(board)
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), postMat)
      post.position.copy(W(track.x[i]! - Math.sin(h) * side, track.y[i]! + Math.cos(h) * side, 0.8))
      this.scene.add(post)
    }
  }

  /** Tyre walls where the fence is, on the outside of the slow corners that face open ground. */
  private buildTyreWalls() {
    const track = this.track
    const spots: [number, number][] = []
    for (const c of track.corners) {
      if (!['Hairpin', 'Top Turn', 'Chicane'].includes(c.name)) continue
      const outside = -Math.sign(c.turn) * (CAR.barrier - 1)
      for (let i = c.from - 10; i <= c.to + 10; i += 2) {
        const k = ((i % track.n) + track.n) % track.n
        spots.push([track.x[k]! - Math.sin(track.h[k]!) * outside, track.y[k]! + Math.cos(track.h[k]!) * outside])
      }
    }
    const walls = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 10), new THREE.MeshLambertMaterial({ color: '#23262b' }), spots.length)
    const bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.57, 0.57, 0.3, 10), new THREE.MeshLambertMaterial({ color: '#f6f4ee' }), spots.length)
    const m = new THREE.Matrix4()
    spots.forEach(([x, y], k) => {
      m.makeTranslation(x, 0.55, -y)
      walls.setMatrixAt(k, m)
      m.makeTranslation(x, 0.85, -y)
      bands.setMatrixAt(k, m)
    })
    this.scene.add(walls, bands)
  }

  /** Trees well back from the road, and hills in the haze. */
  private buildTrees() {
    const track = this.track
    const r = rng(29)
    const spots: [number, number, number, number][] = []
    for (let tries = 0; tries < 2600 && spots.length < 420; tries++) {
      const x = -420 + r() * 1100
      const y = -320 + r() * 760
      const near = nearest(track, x, y, -1)
      const clear = Math.hypot(x - track.x[near.index]!, y - track.y[near.index]!)
      if (clear < 46) continue
      if (y < -8 && y > -60 && x > 60 && x < 300) continue
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
      m.compose(new THREE.Vector3(x, 1.5 * s, -y), q, scale.set(s, s, s))
      trunks.setMatrixAt(k, m)
    })
    for (const [mesh, list] of [
      [leavesA, light],
      [leavesB, dark],
    ] as const) {
      list.forEach(([x, y, s], k) => {
        m.compose(new THREE.Vector3(x, 7.5 * s, -y), q, scale.set(s, s, s))
        mesh.setMatrixAt(k, m)
      })
    }
    this.scene.add(trunks, leavesA, leavesB)

    const hillMat = new THREE.MeshLambertMaterial({ color: '#86b6a4', fog: false })
    const hr = rng(41)
    for (let k = 0; k < 34; k++) {
      const a = (k / 34) * Math.PI * 2 + hr() * 0.1
      const d = 1300 + hr() * 350
      const hill = new THREE.Mesh(new THREE.ConeGeometry(160 + hr() * 180, 70 + hr() * 120, 9), hillMat)
      hill.position.set(180 + Math.cos(a) * d, 20, -110 + Math.sin(a) * d)
      this.scene.add(hill)
    }
  }

  /** What the paint reflects: the sky over the grass, with the sun in it. Only the car's materials use it. */
  private buildReflections() {
    const sky = this.paint(512, 256, (g, w, h) => {
      const up = g.createLinearGradient(0, 0, 0, h / 2)
      up.addColorStop(0, '#3f8fd6')
      up.addColorStop(1, '#e2f4fb')
      g.fillStyle = up
      g.fillRect(0, 0, w, h / 2)
      const down = g.createLinearGradient(0, h / 2, 0, h)
      down.addColorStop(0, '#86b47a')
      down.addColorStop(1, '#2c4a2a')
      g.fillStyle = down
      g.fillRect(0, h / 2, w, h / 2)
      const sun = g.createRadialGradient(w * 0.3, h * 0.2, 1, w * 0.3, h * 0.2, 46)
      sun.addColorStop(0, 'rgba(255,253,240,1)')
      sun.addColorStop(1, 'rgba(255,253,240,0)')
      g.fillStyle = sun
      g.fillRect(0, 0, w, h / 2)
    })
    sky.mapping = THREE.EquirectangularReflectionMapping
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromEquirectangular(sky).texture
    pmrem.dispose()
  }

  /** Blipka's name for each side of the car: the lowercase mark with its teal dot on the i. */
  private buildDecal() {
    return this.paint(
      512,
      128,
      (g, w) => {
        g.clearRect(0, 0, w, 128)
        g.font = `700 92px ${FONT}`
        g.textBaseline = 'alphabetic'
        g.textAlign = 'left'
        const x0 = (w - g.measureText('blipka').width) / 2
        g.fillStyle = '#ffffff'
        g.fillText('blipka', x0, 96)
        g.fillStyle = '#2eb8a0'
        g.beginPath()
        g.arc(x0 + g.measureText('bl').width + g.measureText('i').width / 2, 30, 11, 0, Math.PI * 2)
        g.fill()
      },
      true,
    )
  }

  /* ---------- the car, and its ghost ---------- */

  /*
   * A prototype racer: a low wedge that narrows to its nose, a bubble canopy, wheel arches standing proud
   * of the body, a splitter under the nose, a two-element wing on swept pylons, a fin down its spine, and
   * light strips front and back. Hot Lap's orange in clear-coated paint, graphite aero, twin white
   * stripes, lights in Blipka's teal, gold on the wheels. The ghost is the same car in sky blue, seen through.
   */
  private makeCar(color: string, ghost: boolean, decal: THREE.Texture): CarModel {
    const group = new THREE.Group()
    const body = new THREE.Group()
    group.add(body)
    const see: THREE.Material[] = []
    const mat = (c: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.4,
        metalness: 0.15,
        ...extra,
        // Seen through, and a hair behind your car where the two meet, so it never tints yours.
        ...(ghost ? { transparent: true, opacity: GHOST_SEE, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 } : {}),
      })
      if (ghost) see.push(m)
      return m
    }
    const skin = ghost
      ? mat(color)
      : new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, metalness: 0.04, clearcoat: 0.8, clearcoatRoughness: 0.06, envMapIntensity: 0.6 })
    const graphite = mat('#1c2630', { roughness: 0.5, metalness: 0.35 })
    const white = mat('#f7f9fc', { roughness: 0.3 })
    const glass = mat('#0a1520', { roughness: 0.05, metalness: 0.3 })
    const teal = mat('#8ff2df', { emissive: '#2eb8a0', emissiveIntensity: ghost ? 0.5 : 2.2 })
    const tail = mat('#ff8a80', { emissive: '#e8564f', emissiveIntensity: ghost ? 0.5 : 1.8 })
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
      const mesh = new THREE.Mesh(geo, m)
      mesh.position.set(x, y, z)
      parent.add(mesh)
      return mesh
    }
    const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
    const round = new THREE.SphereGeometry(1, 24, 16)
    const ball = () => round

    add(bodyGeometry(), skin, 0, 0, 0)
    // Wheel arches, standing proud of the body.
    for (const s of [1, -1]) {
      add(ball(), skin, 1.45, 0.42, 0.86 * s).scale.set(0.74, 0.36, 0.3)
      add(ball(), skin, -1.4, 0.46, 0.88 * s).scale.set(0.84, 0.42, 0.34)
    }
    add(ball(), glass, -0.15, 0.7, 0).scale.set(1.25, 0.36, 0.56)
    add(finGeometry(), skin, 0, 0.7, 0)
    // A scoop over the cockpit, and a mirror on a stalk each side of it.
    add(box(0.55, 0.1, 0.26), graphite, -0.8, 1.04, 0)
    for (const s of [1, -1]) {
      add(box(0.04, 0.14, 0.04), graphite, 0.55, 0.72, 0.74 * s)
      add(ball(), skin, 0.55, 0.82, 0.76 * s).scale.set(0.13, 0.06, 0.1)
    }
    // Twin stripes over the hood and the engine cover (either side of the fin), and vents in the hood.
    if (!ghost) {
      for (const s of [1, -1]) {
        add(box(0.7, 0.012, 0.12), white, 1.55, 0.512, 0.2 * s).rotation.z = -0.104
        add(box(0.55, 0.012, 0.12), white, -1.78, 0.81, 0.2 * s).rotation.z = -0.093
        add(box(0.35, 0.012, 0.16), graphite, 1.25, 0.545, 0.46 * s).rotation.z = -0.12
      }
    }
    // Splitter and its end plates under the nose.
    add(box(0.55, 0.04, 2.0), graphite, 2.12, 0.13, 0)
    for (const s of [1, -1]) add(box(0.5, 0.2, 0.04), graphite, 2.12, 0.2, 1.0 * s)
    // The wing: a graphite main plane, a steeper flap behind it lit along its edge, body-colour end plates, swept pylons.
    add(box(0.6, 0.05, 2.05), graphite, -2.18, 1.24, 0).rotation.z = 0.1
    add(box(0.3, 0.04, 2.05), graphite, -2.48, 1.32, 0).rotation.z = 0.35
    add(box(0.025, 0.025, 1.98), teal, -2.62, 1.37, 0)
    for (const s of [1, -1]) {
      add(box(0.9, 0.5, 0.04), skin, -2.3, 1.14, 1.04 * s)
      add(box(0.14, 0.52, 0.05), graphite, -2.05, 0.96, 0.35 * s).rotation.z = -0.3
    }
    // Skirts, an intake ahead of each rear arch, and the diffuser's fins.
    for (const s of [1, -1]) {
      add(box(2.6, 0.08, 0.06), graphite, 0, 0.16, 0.99 * s)
      add(box(0.3, 0.2, 0.04), graphite, -0.45, 0.44, 0.975 * s)
    }
    for (const z of [-0.5, 0, 0.5]) add(box(0.4, 0.2, 0.03), graphite, -2.25, 0.25, z)
    // Blipka's name on each side, between the arches.
    if (!ghost) {
      const plate = new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false })
      for (const s of [1, -1]) {
        const side = add(new THREE.PlaneGeometry(0.9, 0.225), plate, 0.25, 0.4, 0.968 * s)
        if (s < 0) side.rotation.y = Math.PI
      }
    }
    // Lights: a bar across the nose with two slim eyes; a bar across the tail with a fin of light at each
    // corner (set just proud of the bodywork, which the bevel grows by 5 cm); a line down each side.
    add(box(0.03, 0.045, 1.05), teal, 2.36, 0.3, 0)
    for (const s of [1, -1]) add(box(0.22, 0.05, 0.28), teal, 2.02, 0.46, 0.5 * s).rotation.y = 0.35 * s
    add(box(0.03, 0.07, 1.5), tail, -2.47, 0.62, 0)
    for (const s of [1, -1]) add(box(0.03, 0.24, 0.07), tail, -2.46, 0.6, 0.76 * s)
    for (const s of [1, -1]) add(box(1.7, 0.025, 0.02), teal, 0.2, 0.26, 1.0 * s)

    // Wheels, with graphite aero covers whose gold stripe shows them turn.
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.34, 20)
    wheelGeo.rotateX(Math.PI / 2)
    const coverGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20)
    coverGeo.rotateX(Math.PI / 2)
    const tyre = mat('#121417', { roughness: 0.9, metalness: 0 })
    const cover = mat('#1c2630', { roughness: 0.3, metalness: 0.6 })
    const gold = mat('#f5b942', { roughness: 0.35, metalness: 0.4 })
    const wheels: THREE.Mesh[] = []
    const steer: THREE.Group[] = []
    for (const [x, z, front] of [
      [1.45, 0.95, true],
      [1.45, -0.95, true],
      [-1.4, 0.95, false],
      [-1.4, -0.95, false],
    ] as const) {
      const pivot = new THREE.Group()
      pivot.position.set(x, 0.4, z)
      group.add(pivot)
      const wheel = new THREE.Mesh(wheelGeo, tyre)
      pivot.add(wheel)
      const out = Math.sign(z)
      const disc = new THREE.Mesh(coverGeo, cover)
      disc.position.z = out * 0.175
      wheel.add(disc)
      const stripe = new THREE.Mesh(box(0.5, 0.06, 0.02), gold)
      stripe.position.z = out * 0.188
      wheel.add(stripe)
      wheels.push(wheel)
      if (front) steer.push(pivot)
    }
    if (!ghost) {
      // A soft teal glow on the road under the car, and a shadow.
      const glow = this.paint(128, 64, (g, w, h) => {
        const grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
        grad.addColorStop(0, 'rgba(46,184,160,0.55)')
        grad.addColorStop(1, 'rgba(46,184,160,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, w, h)
      })
      const under = new THREE.Mesh(
        new THREE.PlaneGeometry(4.6, 2.4),
        new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      )
      under.rotation.x = -Math.PI / 2
      under.position.y = 0.06
      group.add(under)
      const shadow = this.paint(128, 64, (g, w, h) => {
        const grad = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2)
        grad.addColorStop(0, 'rgba(0,0,0,0.5)')
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, w, h)
      })
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }))
      blob.rotation.x = -Math.PI / 2
      blob.position.y = 0.05
      group.add(blob)
    }
    this.scene.add(group)
    return { group, body, wheels, steer, see }
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
    let laid = false
    WHEEL_AT.forEach(([f, l], w) => {
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
      corners.forEach(([px, py], k) => this.skidPos.set([px!, 0.025, -py!], this.skidNext * 18 + k * 3))
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
    car.group.position.set(run.x, 0, -run.y)
    car.group.rotation.y = run.h
    const roll = Math.max(-0.055, Math.min(0.055, run.ay * 0.004))
    const pitch = Math.max(-0.04, Math.min(0.04, run.ax * 0.003))
    car.body.rotation.x += (roll - car.body.rotation.x) * Math.min(1, dt * 8)
    car.body.rotation.z += (pitch - car.body.rotation.z) * Math.min(1, dt * 8)
    for (const w of car.wheels) w.rotation.z -= (run.u * dt) / 0.4
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
    ghost.group.position.set(pose.x, 0, -pose.y)
    ghost.group.rotation.y = pose.h
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
    if (f.showroom) {
      this.showroomAngle += dt * 0.22
      const portrait = camera.aspect < 1
      const aside = !portrait && f.cardAside
      const away = portrait ? 10.5 : 8.2
      const cx = run.x + Math.cos(this.showroomAngle) * away
      const cz = -run.y + Math.sin(this.showroomAngle) * away
      camera.position.set(cx, 2.8, cz)
      // With the card at the right, look past the car's right and it sits at the left.
      const fx = (run.x - cx) / away
      const fz = (-run.y - cz) / away
      const side = aside ? 2.4 : 0
      camera.lookAt(run.x - fz * side, portrait ? -4.1 : aside ? -0.6 : -2.8, -run.y + fx * side)
      this.fov(62, 1)
      this.snap = true
      return
    }
    const travel = run.h + (run.u > 3 ? Math.atan2(run.vy, run.u) * 0.35 : 0)
    if (this.snap) {
      this.camHeading = travel
      this.snap = false
    } else {
      const d = Math.atan2(Math.sin(travel - this.camHeading), Math.cos(travel - this.camHeading))
      this.camHeading += d * (1 - Math.exp(-dt * 5))
    }
    const fx = Math.cos(this.camHeading)
    const fz = -Math.sin(this.camHeading)
    camera.position.set(run.x - fx * 7.8, 2.8, -run.y - fz * 7.8)
    if (this.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * this.shake
      camera.position.y += (Math.random() - 0.5) * this.shake
      this.shake = Math.max(0, this.shake - dt * 2)
    }
    camera.lookAt(run.x + fx * 6, 1.2, -run.y + fz * 6)
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

/* The body: a side profile pushed out to the car's width, rounded at its edges and narrowed toward the nose. */
function bodyGeometry() {
  const side = new THREE.Shape()
  side.moveTo(2.36, 0.2)
  side.quadraticCurveTo(2.3, 0.36, 1.9, 0.42)
  side.quadraticCurveTo(1.0, 0.5, 0.55, 0.6)
  side.lineTo(-0.9, 0.66)
  side.quadraticCurveTo(-1.6, 0.74, -2.1, 0.78)
  side.lineTo(-2.38, 0.72)
  side.lineTo(-2.4, 0.42)
  side.quadraticCurveTo(-2.3, 0.22, -2.05, 0.18)
  side.lineTo(2.1, 0.14)
  side.quadraticCurveTo(2.3, 0.14, 2.36, 0.2)
  const width = 1.7
  // The bevel rounds the edges; it also grows the outline by its size, so it's kept slim.
  const geo = new THREE.ExtrudeGeometry(side, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.05,
    bevelSegments: 4,
    curveSegments: 14,
  })
  geo.translate(0, 0, -width / 2)
  // Seen from above, the nose narrows to a point and the tail a little.
  const pos = geo.attributes.position!
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    let squeeze = 1
    if (x > 0.6) squeeze = 1 - 0.4 * ((x - 0.6) / 1.76) ** 2
    else if (x < -1.6) squeeze = 1 - 0.14 * ((-1.6 - x) / 0.8)
    pos.setZ(i, pos.getZ(i) * squeeze)
  }
  geo.computeVertexNormals()
  return geo
}

function finGeometry() {
  const fin = new THREE.Shape()
  fin.moveTo(-0.5, 0)
  fin.lineTo(-2.2, 0)
  fin.lineTo(-2.2, 0.44)
  fin.quadraticCurveTo(-1.3, 0.2, -0.5, 0)
  const geo = new THREE.ExtrudeGeometry(fin, { depth: 0.035, bevelEnabled: false })
  geo.translate(0, 0, -0.0175)
  return geo
}
