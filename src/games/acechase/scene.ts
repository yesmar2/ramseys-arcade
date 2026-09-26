/**
 * Ace Chase in 3D: the course, the ball and the camera, drawn with three.js from the game's state.
 *
 * The camera does what the phase asks. Behind the start card it circles the hole. Each hole opens with a
 * flyover, in over the target and back down the hole to the tee. At the tee it is yours: drag to turn,
 * right-drag or two fingers to move over the ground, scroll or pinch to zoom, or one of the set views
 * (the tee, the target, the whole hole from above). A putt is followed, a miss is watched and then the
 * camera goes back to the tee with the ball, and a bullseye is circled.
 *
 * The site's light theme is a summer day here and its dark theme dusk, with the target lit up.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { isDarkTheme, THEME_EVENT } from '../../lib/theme'
import { INTRO_TIME, type GameState, type Phase, type PathPoint } from './game'
import { BALL_R, BULL_R, RINGS, WALL_H, WALL_T, onGreen, slope, type Hole, type Style, type Wall } from './physics'

export type View = 'tee' | 'target' | 'top'
/** The clear part of the screen between the panels, in CSS pixels from the top of the canvas. */
export type Band = { top: number; bottom: number }

type Look = {
  top: number
  horizon: number
  glow: number
  disc: number
  sunColor: number
  sunPower: number
  sunDir: [number, number, number]
  hemiSky: number
  hemiGround: number
  hemiPower: number
  exposure: number
  meadow: number
  water: number
  hill: [number, number, number]
  trees: [number, number, number]
  glowBull: number
  beam: number
  env: number
}

const LOOKS: Record<'day' | 'dusk', Look> = {
  day: {
    top: 0x5aa7da,
    horizon: 0xe3f1ea,
    glow: 0xfff3d6,
    disc: 1.1,
    sunColor: 0xfff0d6,
    sunPower: 2.6,
    sunDir: [-0.45, 0.78, 0.43],
    hemiSky: 0xdcefff,
    hemiGround: 0x3c5a38,
    hemiPower: 0.95,
    exposure: 1.05,
    meadow: 0x5c8f47,
    water: 0x2f7ea3,
    hill: [0.28, 0.28, 0.42],
    trees: [0.28, 0.5, 0.3],
    glowBull: 0.22,
    beam: 0.3,
    env: 1,
  },
  dusk: {
    top: 0x0d1a2b,
    horizon: 0x56657a,
    glow: 0xf29a5a,
    disc: 0.9,
    sunColor: 0xffb57d,
    sunPower: 1.9,
    sunDir: [-0.62, 0.3, 0.72],
    hemiSky: 0x5a7aa0,
    hemiGround: 0x16221a,
    hemiPower: 0.65,
    exposure: 1.0,
    meadow: 0x3a5a33,
    water: 0x1f5577,
    hill: [0.6, 0.16, 0.24],
    trees: [0.3, 0.35, 0.2],
    glowBull: 1.1,
    beam: 0.55,
    env: 0.3,
  },
}

/** An ice rink under a winter sky: white with the blue of evening in the dark theme. */
const ICE: Record<'day' | 'dusk', Look> = {
  day: {
    top: 0x7fb7e3,
    horizon: 0xeef5fa,
    glow: 0xffffff,
    disc: 1,
    sunColor: 0xfff7ee,
    sunPower: 2.2,
    sunDir: [-0.35, 0.7, 0.55],
    hemiSky: 0xeaf4ff,
    hemiGround: 0xb9c9d6,
    hemiPower: 1.1,
    exposure: 1,
    meadow: 0xf1f5f8,
    water: 0x1c4a70,
    hill: [0.58, 0.16, 0.86],
    trees: [0.38, 0.12, 0.8],
    glowBull: 0.18,
    beam: 0.28,
    env: 0.9,
  },
  dusk: {
    top: 0x121a3a,
    horizon: 0x7b76a6,
    glow: 0xff9eb0,
    disc: 0.8,
    sunColor: 0xffc2c8,
    sunPower: 1.5,
    sunDir: [-0.6, 0.25, 0.75],
    hemiSky: 0x7b8fc4,
    hemiGround: 0x2a3050,
    hemiPower: 0.75,
    exposure: 1,
    meadow: 0x9aa6c8,
    water: 0x13304f,
    hill: [0.64, 0.2, 0.55],
    trees: [0.6, 0.1, 0.58],
    glowBull: 0.9,
    beam: 0.5,
    env: 0.35,
  },
}

/** The Moon: a black sky whatever the site's theme, a hard white sun, and long shadows. */
const MOON: Look = {
  top: 0x020309,
  horizon: 0x0a0e18,
  glow: 0x000000,
  disc: 1.3,
  sunColor: 0xffffff,
  sunPower: 3.2,
  sunDir: [-0.55, 0.45, 0.7],
  hemiSky: 0x9aa6c8,
  hemiGround: 0x1a1a1f,
  hemiPower: 0.3,
  exposure: 1.05,
  meadow: 0x5b5d61,
  water: 0x000000,
  hill: [0.6, 0.03, 0.34],
  trees: [0.6, 0.03, 0.44],
  glowBull: 1,
  beam: 0.5,
  env: 0.35,
}

/** Everything about a place that isn't the light: its ground, rails, target and surroundings. */
type Place = {
  day: Look
  dusk: Look
  /** The playing surface: its stripes, where it is sheer, and the ground off it. */
  ground: { stripes: [number, number]; steep: number; off: number; roughness: number }
  /** The rails: timber or a colour, metal or not, and the colour of their cap. */
  rails: { body: number | 'wood'; metal: boolean; cap: number; capGlow: number }
  /** The banks the course stands on: the earth texture tinted, or a plain colour. */
  bank: { tint: number; soil: boolean }
  /** The mat at the tee. */
  mat: number
  cushion: number
  /** The target's colours: the bull, the ring round it, the outer ring, and the lines between. */
  target: { bull: number; ring: number; outer: number; line: number }
  props: 'trees' | 'rocks'
  /** Stars and the Earth in the sky, and no haze. */
  space: boolean
}

const PLACES: Record<Style, Place> = {
  garden: {
    day: LOOKS.day,
    dusk: LOOKS.dusk,
    ground: { stripes: [0x3f9f55, 0x359149], steep: 0x857462, off: 0x4b7d3d, roughness: 0.95 },
    rails: { body: 'wood', metal: false, cap: 0xf2eee4, capGlow: 0 },
    bank: { tint: 0xffffff, soil: true },
    mat: 0x2c7a40,
    cushion: 0xffffff,
    target: { bull: 0x2eb8a0, ring: 0xf7f5ee, outer: 0x22364a, line: 0x22364a },
    props: 'trees',
    space: false,
  },
  // A curling sheet: pale ice, white boards capped in blue, and the house for a target.
  ice: {
    day: ICE.day,
    dusk: ICE.dusk,
    ground: { stripes: [0xe3f0f9, 0xd8e8f4], steep: 0xbfd3e3, off: 0xe9f0f6, roughness: 0.32 },
    rails: { body: 0xf3f6f9, metal: false, cap: 0x2b6cb0, capGlow: 0 },
    bank: { tint: 0xe1ebf3, soil: false },
    // The rubber hack a curler pushes off from.
    mat: 0x2b3440,
    cushion: 0xffffff,
    target: { bull: 0xd6333a, ring: 0xf8f8f6, outer: 0x2f68c7, line: 0x1a2b3c },
    props: 'trees',
    space: false,
  },
  moon: {
    day: MOON,
    dusk: MOON,
    ground: { stripes: [0x9c9ea2, 0x95979b], steep: 0x6f7176, off: 0x57595d, roughness: 1 },
    rails: { body: 0x8d96a1, metal: true, cap: 0x2eb8a0, capGlow: 0.35 },
    // Grey dust all the way down: no earth under the Moon's courses.
    bank: { tint: 0x74777c, soil: false },
    mat: 0x454a52,
    cushion: 0x9aa8bf,
    target: { bull: 0x2eb8a0, ring: 0xe8edf2, outer: 0x22364a, line: 0x22364a },
    props: 'rocks',
    space: true,
  },
}

const GOLD = 0xf5b942
const CHALK = 0xf3f6ee
const TREES = 150
/** Behind the start card the camera circles the hole this far out and this high, in hole lengths: over the trees. */
const MENU_OUT = 0.62
const MENU_UP = 0.72
const DOTS = 30

/** A plain seeded generator, so the trees stand in the same places every time a hole is laid. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

type Bounds = { x0: number; x1: number; z0: number; z1: number }

function boundsOf(hole: Hole): Bounds {
  const xs = hole.green.map((p) => p[0])
  const zs = hole.green.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export class AceScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.05, 400)
  private readonly controls: OrbitControls
  private readonly pmrem: THREE.PMREMGenerator
  private readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>
  private readonly hemi: THREE.HemisphereLight
  private readonly sun: THREE.DirectionalLight
  private readonly sunDir = new THREE.Vector3(0, 1, 0)
  private readonly textures: THREE.Texture[] = []
  private readonly tex: Record<'felt' | 'meadow' | 'wood' | 'soil' | 'pad' | 'ripple' | 'ball' | 'dimple' | 'beam', THREE.CanvasTexture>
  private readonly meadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>
  private readonly hills = new THREE.Group()
  private readonly hillMats: THREE.MeshStandardMaterial[] = []
  private readonly trunks: THREE.InstancedMesh
  private readonly crowns: THREE.InstancedMesh
  private crownShades: [number, number, number][] = []
  private readonly ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>
  private readonly dots: THREE.InstancedMesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>
  private readonly tip: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>
  private look: Look = LOOKS.dusk
  private place: Place = PLACES.garden
  private readonly stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  private readonly earth: THREE.Sprite
  private readonly themeWatch: MutationObserver

  private course: THREE.Group | null = null
  private protractor: THREE.Group | null = null
  private beacon: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> | null = null
  private water: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial> | null = null
  private greenUniforms: Record<string, THREE.IUniform> | null = null
  private ghostLines: THREE.Line[] = []
  private ghostsShown: GameState['ghosts'] | null = null

  private hole: Hole | null = null
  private holeKey = -1
  private bulls = -1
  private phase: Phase | null = null
  private bounds: Bounds = { x0: 0, x1: 0, z0: 0, z1: 0 }
  private width = 1
  private height = 1
  private band: Band = { top: 0, bottom: 1 }
  private readonly touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  private readonly still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  /** The set view showing, or null once the camera has been moved by hand. */
  view: View | null = 'tee'
  /** Called when a drag, pinch or scroll takes the camera off a set view. */
  onUserMove: (() => void) | null = null
  private readonly glide = {
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    fromT: new THREE.Vector3(),
    toT: new THREE.Vector3(),
    k: 1,
  }
  private readonly follow = { dir: new THREE.Vector3(0, 0, -1), target: new THREE.Vector3() }
  private fly: { pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3 } | null = null
  private orbit = 0
  private readonly last = new THREE.Vector3()
  private readonly tmp = new THREE.Vector3()
  private readonly tmp2 = new THREE.Vector3()
  private readonly axis = new THREE.Vector3()
  private readonly spin = new THREE.Quaternion()
  private readonly m4 = new THREE.Matrix4()
  private readonly flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
  private readonly up = new THREE.Vector3(0, 1, 0)
  private readonly one = new THREE.Vector3(1, 1, 1)
  private readonly clockStart = performance.now()

  constructor(canvas: HTMLCanvasElement) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer = renderer

    const scene = this.scene
    scene.fog = new THREE.Fog(0xdcecdf, 45, 150)
    this.pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const controls = new OrbitControls(this.camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI * 0.49
    controls.minDistance = 0.8
    controls.maxDistance = 80
    controls.enablePan = true
    controls.screenSpacePanning = false
    controls.panSpeed = 1.2
    controls.enabled = false
    controls.addEventListener('start', () => {
      this.view = null
      this.onUserMove?.()
    })
    this.controls = controls

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          glow: { value: new THREE.Color() },
          sun: { value: new THREE.Vector3(0, 1, 0) },
          disc: { value: 1 },
        },
        vertexShader:
          'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sun; uniform float disc; varying vec3 vDir; void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.55)); float s = max(dot(d, sun), 0.0); c += glow * (pow(s, 6.0) * 0.6 * (1.0 - h)); c += vec3(1.0, 0.93, 0.8) * pow(s, 900.0) * disc; gl_FragColor = vec4(c, 1.0); }',
      }),
    )
    this.sky.renderOrder = -1
    scene.add(this.sky)

    // For the Moon: stars, and the Earth hanging over the far end. They ride with the sky, round the camera.
    const starRand = seeded(3)
    const starPos: number[] = []
    for (let i = 0; i < 1400; i++) {
      const u = starRand() * 2 - 1
      const a = starRand() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      if (u < -0.05) continue
      starPos.push(Math.cos(a) * r * 280, u * 280, Math.sin(a) * r * 280)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }))
    this.stars.visible = false
    this.sky.add(this.stars)
    this.earth = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.paintEarth(), fog: false, depthWrite: false }))
    this.earth.scale.set(34, 34, 1)
    this.earth.position.set(0.35, 0.34, -0.87).normalize().multiplyScalar(250)
    this.earth.visible = false
    this.sky.add(this.earth)

    this.hemi = new THREE.HemisphereLight(0xdcefff, 0x3c5a38, 0.95)
    scene.add(this.hemi)
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.6)
    sun.castShadow = true
    const map = this.touch ? 1024 : 2048
    sun.shadow.mapSize.set(map, map)
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 90 })
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.035
    scene.add(sun, sun.target)
    this.sun = sun

    this.tex = this.paintTextures()

    // The world round the course: a meadow, low hills on the skyline, and a wood.
    this.meadow = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: this.tex.meadow, roughness: 1, color: 0x5c8f47 }))
    this.meadow.rotation.x = -Math.PI / 2
    this.meadow.receiveShadow = true
    scene.add(this.meadow)
    const rand = seeded(7)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand() * 0.3
      const r = 110 + rand() * 40
      const mat = new THREE.MeshStandardMaterial({ color: 0x6f8f5f, roughness: 1 })
      mat.userData.shade = rand()
      this.hillMats.push(mat)
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), mat)
      m.scale.set(26 + rand() * 30, 8 + rand() * 12, 20 + rand() * 20)
      m.position.set(Math.cos(a) * r, -3, Math.sin(a) * r)
      this.hills.add(m)
    }
    scene.add(this.hills)
    this.trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 7), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 }), TREES)
    this.crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), TREES)
    this.trunks.castShadow = this.crowns.castShadow = true
    this.crowns.receiveShadow = true
    scene.add(this.trunks, this.crowns)

    // The ball: dimpled, with a teal line round it so it can be seen rolling; and the aim, a line of dots.
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 40, 24),
      new THREE.MeshPhysicalMaterial({
        map: this.tex.ball,
        normalMap: this.tex.dimple,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: 0.32,
        clearcoat: 0.8,
        clearcoatRoughness: 0.25,
      }),
    )
    this.ball.castShadow = true
    scene.add(this.ball)
    this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.035, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), DOTS)
    this.dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(this.dots)
    this.tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    scene.add(this.tip)

    this.themeWatch = new MutationObserver(() => this.applyLook())
    this.themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener(THEME_EVENT, this.onTheme)
    this.applyLook()
  }

  private readonly onTheme = () => this.applyLook()

  // ---------- textures, drawn here ----------

  private paint(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    if (g) draw(g, w, h)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    this.textures.push(t)
    return t
  }

  private paintTextures() {
    const rand = seeded(11)
    const normals = (w: number, h: number, bump: (x: number, y: number) => [number, number]) =>
      this.paint(
        w,
        h,
        (g) => {
          const img = g.createImageData(w, h)
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const [nx, ny] = bump(x, y)
              const i = (y * w + x) * 4
              img.data[i] = 128 + nx
              img.data[i + 1] = 128 + ny
              img.data[i + 2] = 255
              img.data[i + 3] = 255
            }
          g.putImageData(img, 0, 0)
        },
        false,
      )
    const felt = this.paint(256, 256, (g, w, h) => {
      g.fillStyle = '#d4d4d4'
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 9000; i++) {
        const v = 175 + Math.floor(rand() * 80)
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(rand() * w, rand() * h, 1 + rand(), 1 + rand() * 2)
      }
    })
    const meadow = this.paint(256, 256, (g, w, h) => {
      g.fillStyle = '#9a9a9a'
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 5000; i++) {
        const x = rand() * w
        const y = rand() * h
        const v = 110 + Math.floor(rand() * 110)
        g.strokeStyle = `rgb(${v},${v},${v})`
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + (rand() - 0.5) * 3, y - 3 - rand() * 6)
        g.stroke()
      }
    })
    meadow.repeat.set(140, 140)
    const wood = this.paint(512, 64, (g, w, h) => {
      g.fillStyle = '#9a6a3f'
      g.fillRect(0, 0, w, h)
      for (let y = 0; y < h; y += 1) {
        const v = Math.sin(y * 0.9 + Math.sin(y * 0.13) * 4) * 0.5 + 0.5
        g.fillStyle = `rgba(60, 34, 14, ${0.08 + v * 0.14})`
        g.fillRect(0, y, w, 1)
      }
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = `rgba(55, 30, 12, ${0.15 + rand() * 0.2})`
        g.beginPath()
        const y0 = rand() * h
        g.moveTo(0, y0)
        for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 3)
        g.stroke()
      }
      g.fillStyle = 'rgba(40, 22, 8, 0.55)'
      for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 2, h)
    })
    // The banks the course is built up on: earth in layers, with stones.
    const soil = this.paint(256, 256, (g, w, h) => {
      for (let y = 0; y < h; y += 4) {
        const v = Math.sin(y * 0.07) * 0.5 + Math.sin(y * 0.23 + 1) * 0.3
        g.fillStyle = `hsl(${28 + v * 6}, ${22 + v * 6}%, ${34 + v * 7}%)`
        g.fillRect(0, y, w, 4)
      }
      for (let i = 0; i < 150; i++) {
        const r = 1 + rand() * 3.5
        g.fillStyle = `hsla(30, 12%, ${26 + rand() * 16}%, 0.75)`
        g.beginPath()
        g.ellipse(rand() * w, rand() * h, r * 1.4, r, 0, 0, Math.PI * 2)
        g.fill()
      }
    })
    // The cushions behind the targets: quilted, so they read as soft.
    const pad = this.paint(128, 128, (g, w, h) => {
      g.fillStyle = '#4aa8e8'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = 'rgba(255, 255, 255, 0.45)'
      g.lineWidth = 2
      for (let k = -w; k < w * 2; k += 32) {
        g.beginPath()
        g.moveTo(k, 0)
        g.lineTo(k + h, h)
        g.moveTo(k + h, 0)
        g.lineTo(k, h)
        g.stroke()
      }
    })
    const H = (x: number, y: number) => Math.sin(x * 0.19 + Math.sin(y * 0.07) * 2) * 0.5 + Math.sin(y * 0.23 + x * 0.05) * 0.5 + Math.sin((x + y) * 0.11) * 0.3
    const ripple = normals(256, 256, (x, y) => [(H(x + 1, y) - H(x - 1, y)) * 60, (H(x, y + 1) - H(x, y - 1)) * 60])
    ripple.repeat.set(6, 6)
    const ball = this.paint(256, 128, (g, w, h) => {
      g.fillStyle = '#fbfbf7'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#2eb8a0'
      g.fillRect(0, h / 2 - 5, w, 10)
    })
    const dimple = normals(256, 128, (x, y) => {
      const row = Math.floor(y / 8)
      const cx = (Math.floor((x + (row % 2) * 4) / 8) * 8 + 4 - (row % 2) * 4 + 256) % 256
      const cy = row * 8 + 4
      let dx = x - cx
      const dy = y - cy
      if (dx > 128) dx -= 256
      const k = Math.hypot(dx, dy) < 3.4 ? 0.55 : 0
      return [-(dx / 3.4) * 127 * k, (dy / 3.4) * 127 * k]
    })
    // The beacon's fade: solid at the foot, gone at the top.
    const beam = this.paint(
      4,
      128,
      (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h)
        grad.addColorStop(0, '#000')
        grad.addColorStop(0.55, '#333')
        grad.addColorStop(1, '#fff')
        g.fillStyle = grad
        g.fillRect(0, 0, w, h)
      },
      false,
    )
    return { felt, meadow, wood, soil, pad, ripple, ball, dimple, beam }
  }

  /** The Earth from the Moon: blue sea, a little land, white cloud, lit from one side. */
  private paintEarth() {
    const rand = seeded(41)
    return this.paint(
      256,
      256,
      (g, w, h) => {
        const c = w / 2
        const glow = g.createRadialGradient(c, c, w * 0.36, c, c, w * 0.5)
        glow.addColorStop(0, 'rgba(120, 170, 255, 0.35)')
        glow.addColorStop(1, 'rgba(120, 170, 255, 0)')
        g.fillStyle = glow
        g.fillRect(0, 0, w, h)
        g.save()
        g.beginPath()
        g.arc(c, c, w * 0.37, 0, Math.PI * 2)
        g.clip()
        g.fillStyle = '#2f6fc7'
        g.fillRect(0, 0, w, h)
        for (let i = 0; i < 9; i++) {
          g.fillStyle = i % 3 === 0 ? '#c9b27a' : '#4f9a57'
          g.beginPath()
          g.ellipse(c + (rand() - 0.5) * w * 0.6, c + (rand() - 0.5) * w * 0.6, 8 + rand() * 26, 6 + rand() * 18, rand() * 3, 0, Math.PI * 2)
          g.fill()
        }
        g.strokeStyle = 'rgba(255, 255, 255, 0.8)'
        g.lineCap = 'round'
        for (let i = 0; i < 14; i++) {
          g.lineWidth = 3 + rand() * 6
          g.beginPath()
          const x = c + (rand() - 0.5) * w * 0.7
          const y = c + (rand() - 0.5) * w * 0.7
          g.moveTo(x, y)
          g.quadraticCurveTo(x + 20 * rand(), y - 10, x + 30 + rand() * 30, y + (rand() - 0.5) * 16)
          g.stroke()
        }
        // Night on the side away from the sun.
        const shade = g.createLinearGradient(c - w * 0.37, 0, c + w * 0.37, 0)
        shade.addColorStop(0, 'rgba(0, 0, 10, 0.8)')
        shade.addColorStop(0.55, 'rgba(0, 0, 10, 0)')
        g.fillStyle = shade
        g.fillRect(0, 0, w, h)
        g.restore()
      },
    )
  }

  // ---------- day and dusk ----------

  private tintTrees() {
    const [hBase, sBase, lBase] = this.look.trees
    const c = new THREE.Color()
    this.crownShades.forEach(([a, b, d], i) => this.crowns.setColorAt(i, c.setHSL(hBase - 0.04 + a * 0.1, sBase - 0.08 + b * 0.15, lBase - 0.06 + d * 0.12)))
    if (this.crowns.instanceColor) this.crowns.instanceColor.needsUpdate = true
  }

  private applyLook() {
    const place = this.place
    const look = (this.look = isDarkTheme() ? place.dusk : place.day)
    this.stars.visible = this.earth.visible = place.space
    this.trunks.visible = place.props === 'trees'
    const u = this.sky.material.uniforms
    ;(u.top!.value as THREE.Color).set(look.top)
    ;(u.horizon!.value as THREE.Color).set(look.horizon)
    ;(u.glow!.value as THREE.Color).set(look.glow)
    u.disc!.value = look.disc
    this.sunDir.set(...look.sunDir).normalize()
    ;(u.sun!.value as THREE.Vector3).copy(this.sunDir)
    this.sun.color.set(look.sunColor)
    this.sun.intensity = look.sunPower
    this.hemi.color.set(look.hemiSky)
    this.hemi.groundColor.set(look.hemiGround)
    this.hemi.intensity = look.hemiPower
    this.renderer.toneMappingExposure = look.exposure
    const fog = this.scene.fog as THREE.Fog
    fog.color.set(look.horizon)
    // No air on the Moon: nothing fades with distance.
    fog.near = place.space ? 500 : 45
    fog.far = place.space ? 1500 : 150
    this.meadow.material.color.set(look.meadow)
    this.hillMats.forEach((m) => m.color.setHSL(look.hill[0] + (m.userData.shade as number) * 0.04, look.hill[1], look.hill[2] + (m.userData.shade as number) * 0.06))
    this.tintTrees()
    if (this.greenUniforms) this.greenUniforms.glow!.value = look.glowBull
    // The bright room the reflections come from is too much at dusk.
    this.scene.traverse((o) => {
      const mats = (o as THREE.Mesh).material
      for (const m of Array.isArray(mats) ? mats : mats ? [mats] : [])
        if ('envMapIntensity' in m) (m as THREE.MeshStandardMaterial).envMapIntensity = look.env
    })
    if (this.water) {
      this.water.material.color.set(look.water)
      this.water.material.envMapIntensity = look.env * 0.15
    }
  }

  // ---------- the hole ----------

  private disposeObject(o: THREE.Object3D) {
    o.traverse((m) => {
      const mesh = m as THREE.Mesh
      mesh.geometry?.dispose()
      const mats = mesh.material
      for (const mat of Array.isArray(mats) ? mats : mats ? [mats] : []) mat.dispose()
    })
  }

  private plantTrees(b: Bounds, base: number) {
    const rand = seeded(29)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const yAxis = new THREE.Vector3(0, 1, 0)
    let placed = 0
    let tries = 0
    this.crownShades = []
    const rocks = this.place.props === 'rocks'
    while (placed < TREES && tries < 5000) {
      tries++
      const x = b.x0 - 26 + rand() * (b.x1 - b.x0 + 52)
      const z = b.z0 - 26 + rand() * (b.z1 - b.z0 + 52)
      if (Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1) < 3.2) continue
      const s = 0.9 + rand() * 1.1
      q.identity()
      m.compose(new THREE.Vector3(x, base + 0.8 * s, z), q, new THREE.Vector3(s, s, s))
      this.trunks.setMatrixAt(placed, m)
      const cs = s * (1.2 + rand() * 0.6)
      q.setFromAxisAngle(yAxis, rand() * 6)
      // On the Moon the same shapes, squat and half buried, are boulders.
      if (rocks) m.compose(new THREE.Vector3(x, base + cs * 0.15, z), q, new THREE.Vector3(cs, cs * (0.45 + rand() * 0.25), cs * (0.8 + rand() * 0.4)))
      else m.compose(new THREE.Vector3(x, base + 1.6 * s + cs * 0.8, z), q, new THREE.Vector3(cs, cs * (1.1 + rand() * 0.3), cs))
      this.crowns.setMatrixAt(placed, m)
      this.crownShades.push([rand(), rand(), rand()])
      placed++
    }
    this.trunks.count = this.crowns.count = placed
    this.trunks.instanceMatrix.needsUpdate = this.crowns.instanceMatrix.needsUpdate = true
    this.tintTrees()
  }

  /** A rail along a wall: its two faces and a cap; a rail round the edge also stands on an earth bank. */
  private railGeometry(h: Hole, w: Wall, base: number) {
    const len = Math.hypot(w.bx - w.ax, w.bz - w.az)
    const ux = (w.bx - w.ax) / len
    const uz = (w.bz - w.az) / len
    let nx = -uz
    let nz = ux
    if (!onGreen(h, (w.ax + w.bx) / 2 + nx * 0.3, (w.az + w.bz) / 2 + nz * 0.3)) {
      nx = -nx
      nz = -nz
    }
    const n = Math.max(2, Math.ceil(len / 0.2))
    // Rails round water stand clear of it, so the water sits inside them.
    const over = h.water === undefined ? -Infinity : h.water + 0.12
    const pos: number[] = []
    const uv: number[] = []
    const cap: number[] = []
    const bank: number[] = []
    const bankUv: number[] = []
    const at = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const ext = i === 0 ? -0.04 : i === n ? 0.04 : 0
      const px = w.ax + (w.bx - w.ax) * t + ux * ext
      const pz = w.az + (w.bz - w.az) * t + uz * ext
      const y = h.height(px, pz)
      at.push({ ix: px + nx * WALL_T, iz: pz + nz * WALL_T, ox: px - nx * WALL_T, oz: pz - nz * WALL_T, y, top: Math.max(y + WALL_H, over), u: t * len })
    }
    const quad = (a: number[], b: number[], c: number[], d: number[], ua: number, ub: number) => {
      pos.push(...a, ...b, ...c, ...a, ...c, ...d)
      uv.push(ua, 0, ub, 0, ub, 0.5, ua, 0, ub, 0.5, ua, 0.5)
    }
    for (let i = 0; i < n; i++) {
      const s = at[i]!
      const t = at[i + 1]!
      quad([s.ix, s.y - 0.08, s.iz], [t.ix, t.y - 0.08, t.iz], [t.ix, t.top, t.iz], [s.ix, s.top, s.iz], s.u / 1.4, t.u / 1.4)
      quad([s.ox, s.y - 0.08, s.oz], [s.ox, s.top, s.oz], [t.ox, t.top, t.oz], [t.ox, t.y - 0.08, t.oz], s.u / 1.4, t.u / 1.4)
      if (w.edge) {
        bank.push(s.ox, base, s.oz, s.ox, s.y - 0.08, s.oz, t.ox, t.y - 0.08, t.oz, s.ox, base, s.oz, t.ox, t.y - 0.08, t.oz, t.ox, base, t.oz)
        const a = (s.y - 0.08) / 1.5
        const b = (t.y - 0.08) / 1.5
        bankUv.push(s.u / 2, base / 1.5, s.u / 2, a, t.u / 2, b, s.u / 2, base / 1.5, t.u / 2, b, t.u / 2, base / 1.5)
      }
      const cy0 = s.top + 0.035
      const cy1 = t.top + 0.035
      const o = 0.02
      const S = [s.ix + nx * o, s.iz + nz * o, s.ox - nx * o, s.oz - nz * o] as const
      const U = [t.ix + nx * o, t.iz + nz * o, t.ox - nx * o, t.oz - nz * o] as const
      cap.push(S[0], cy0, S[1], U[0], cy1, U[1], U[2], cy1, U[3], S[0], cy0, S[1], U[2], cy1, U[3], S[2], cy0, S[3])
      cap.push(S[0], s.top, S[1], U[0], t.top, U[1], U[0], cy1, U[1], S[0], s.top, S[1], U[0], cy1, U[1], S[0], cy0, S[1])
      cap.push(S[2], s.top, S[3], S[2], cy0, S[3], U[2], cy1, U[3], S[2], s.top, S[3], U[2], cy1, U[3], U[2], t.top, U[3])
    }
    const geo = (p: number[], u?: number[]) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
      if (u) g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2))
      g.computeVertexNormals()
      return g
    }
    return { body: geo(pos, uv), cap: geo(cap), bank: bank.length ? geo(bank, bankUv) : null }
  }

  private buildHole(h: Hole) {
    if (this.course) {
      this.scene.remove(this.course)
      this.disposeObject(this.course)
    }
    const course = new THREE.Group()
    const place = (this.place = PLACES[h.style])
    const b = boundsOf(h)
    this.bounds = b
    let lowest = Infinity
    for (let x = b.x0; x <= b.x1; x += 0.3)
      for (let z = b.z0; z <= b.z1; z += 0.3) if (onGreen(h, x, z)) lowest = Math.min(lowest, h.height(x, z))
    const base = Math.min(lowest - 0.3, (h.water ?? 0) - 0.3)
    this.meadow.position.set((b.x0 + b.x1) / 2, base - 0.01, (b.z0 + b.z1) / 2)
    this.hills.position.set((b.x0 + b.x1) / 2, base, (b.z0 + b.z1) / 2)
    this.plantTrees(b, base)

    // The green: a fine grid over the hole, on the height map where it is green; mown in stripes across
    // the way you play it, darker in the hollows, rock where it is sheer.
    const pad = 0.6
    const X0 = b.x0 - pad
    const Z0 = b.z0 - pad
    const W = b.x1 - b.x0 + pad * 2
    const L = b.z1 - b.z0 + pad * 2
    const cell = 0.09
    const geo = new THREE.PlaneGeometry(W, L, Math.ceil(W / cell), Math.ceil(L / cell))
    geo.rotateX(-Math.PI / 2)
    geo.translate(X0 + W / 2, 0, Z0 + L / 2)
    const pos = geo.attributes.position!
    const uv = geo.attributes.uv!
    const col = new Float32Array(pos.count * 3)
    const inGreen = new Float32Array(pos.count)
    const f1 = new THREE.Color(place.ground.stripes[0])
    const f2 = new THREE.Color(place.ground.stripes[1])
    const rock = new THREE.Color(place.ground.steep)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      uv.setXY(i, x * 1.3, z * 1.3)
      if (onGreen(h, x, z)) {
        const y = h.height(x, z)
        pos.setY(i, y)
        inGreen[i] = 1
        const [gx, gz] = slope(h, x, z)
        const steep = Math.hypot(gx, gz)
        c.copy(Math.floor((z + 100) / 0.75) % 2 ? f1 : f2)
        c.offsetHSL(0, 0, Math.max(-0.06, Math.min(0.05, y * 0.05)))
        if (steep > 0.9) c.lerp(rock, Math.min(1, (steep - 0.9) / 0.8))
      } else {
        pos.setY(i, base)
        c.set(place.ground.off)
      }
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('inGreen', new THREE.BufferAttribute(inGreen, 1))
    geo.computeVertexNormals()
    const felt = new THREE.MeshStandardMaterial({ vertexColors: true, map: this.tex.felt, roughness: place.ground.roughness })
    const uniforms: Record<string, THREE.IUniform> = {
      target: { value: new THREE.Vector2(h.target.x, h.target.z) },
      rings: { value: new THREE.Vector3(...RINGS) },
      accent: { value: new THREE.Color(place.target.bull) },
      paint: { value: new THREE.Color(place.target.ring) },
      outer: { value: new THREE.Color(place.target.outer) },
      edge: { value: new THREE.Color(place.target.line) },
      glow: { value: this.look.glowBull },
      flash: { value: 0 },
      time: { value: 0 },
    }
    this.greenUniforms = uniforms
    // The target, painted on the ground so it follows every bump, and only on the green: the bull in Blipka
    // teal with a white blip in the middle, a white ring, a navy ring, a thin white border, and a pulse
    // running out across it. Nothing of the green shows outside its rails.
    felt.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;\nattribute float inGreen;\nvarying float vIn;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvIn = inGreen;')
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vWorld;\nvarying float vIn;\nuniform vec2 target; uniform vec3 rings; uniform vec3 accent; uniform vec3 paint; uniform vec3 outer; uniform vec3 edge; uniform float glow; uniform float flash; uniform float time;\nfloat ringLine(float d, float r, float w) { return 1.0 - smoothstep(0.0, w, abs(d - r)); }',
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          if (vIn < 0.5) discard;
          float td = distance(vWorld.xz, target);
          float blip = 1.0 - smoothstep(0.075, 0.095, td);
          if (td < rings.z + 0.03 && vIn > 0.999) {
            vec3 rc = td < rings.x ? accent : (td < rings.y ? paint : outer);
            rc = mix(rc, edge, ringLine(td, rings.x, 0.02) * 0.8);
            rc = mix(rc, paint, 1.0 - smoothstep(0.0, 0.02, abs(td - rings.z + 0.03)));
            rc = mix(rc, vec3(1.0), blip);
            diffuseColor.rgb = rc * (0.86 + 0.14 * sampledDiffuseColor.g);
          }`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float pr = fract(time / 1.9);
          float inside = step(td, rings.z + 0.02) * step(0.999, vIn);
          float pulse = ringLine(td, rings.x + pr * (rings.z - rings.x), 0.07) * (1.0 - pr) * inside;
          totalEmissiveRadiance += accent * (pulse * (0.3 + glow * 0.5) + (td < rings.x ? glow * 0.3 : 0.0) + flash * inside * 0.9);
          totalEmissiveRadiance += vec3(1.0) * blip * (0.2 + glow * 0.5);`,
        )
    }
    const green = new THREE.Mesh(geo, felt)
    green.receiveShadow = true
    course.add(green)

    // A beacon over the bull, so the target can be picked out from the tee.
    const beam = new THREE.CylinderGeometry(0.08, BULL_R * 0.7, 7, 32, 1, true)
    beam.translate(0, 3.5, 0)
    this.beacon = new THREE.Mesh(
      beam,
      new THREE.MeshBasicMaterial({
        color: place.target.bull,
        alphaMap: this.tex.beam,
        transparent: true,
        opacity: this.look.beam,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    )
    this.beacon.position.set(h.target.x, h.height(h.target.x, h.target.z), h.target.z)
    course.add(this.beacon)

    // Rails: timber, capped in white; the rubber banks black with a gold top; the cushions quilted blue.
    const timber =
      place.rails.body === 'wood'
        ? new THREE.MeshStandardMaterial({ map: this.tex.wood, roughness: 0.78, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({
            color: place.rails.body,
            roughness: place.rails.metal ? 0.35 : 0.5,
            metalness: place.rails.metal ? 0.75 : 0,
            side: THREE.DoubleSide,
          })
    const capWood = new THREE.MeshStandardMaterial({
      color: place.rails.cap,
      emissive: place.rails.cap,
      emissiveIntensity: place.rails.capGlow,
      roughness: 0.6,
      side: THREE.DoubleSide,
    })
    const rubber = new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.35, side: THREE.DoubleSide })
    const rubberTop = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.45, side: THREE.DoubleSide })
    const cushion = new THREE.MeshStandardMaterial({ map: this.tex.pad, color: place.cushion, roughness: 0.9, side: THREE.DoubleSide })
    const cushionTop = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.8, side: THREE.DoubleSide })
    const earth = new THREE.MeshStandardMaterial({ map: place.bank.soil ? this.tex.soil : null, color: place.bank.tint, roughness: 1, side: THREE.DoubleSide })
    for (const w of h.walls) {
      if (Math.hypot(w.bx - w.ax, w.bz - w.az) < 1e-6) continue
      const g = this.railGeometry(h, w, base)
      const body = new THREE.Mesh(g.body, w.soft ? cushion : w.rubber ? rubber : timber)
      body.castShadow = body.receiveShadow = true
      const cap = new THREE.Mesh(g.cap, w.soft ? cushionTop : w.rubber ? rubberTop : capWood)
      cap.castShadow = true
      course.add(body, cap)
      if (g.bank) {
        const bank = new THREE.Mesh(g.bank, earth)
        bank.receiveShadow = true
        course.add(bank)
      }
    }
    for (const k of h.bumpers) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(k.r, k.r, 0.3, 36), rubber)
      post.position.set(k.x, h.height(k.x, k.z) + 0.12, k.z)
      post.castShadow = true
      course.add(post)
    }

    // Water, only where the ground is under it.
    this.water = null
    // A crater on the Moon is only a deep hole: nothing in it to draw.
    if (h.water !== undefined && h.lost !== 'crater') {
      const wet = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
      for (let x = b.x0; x <= b.x1; x += 0.1)
        for (let z = b.z0; z <= b.z1; z += 0.1)
          if (onGreen(h, x, z) && h.height(x, z) < h.water) {
            wet.x0 = Math.min(wet.x0, x)
            wet.x1 = Math.max(wet.x1, x)
            wet.z0 = Math.min(wet.z0, z)
            wet.z1 = Math.max(wet.z1, z)
          }
      if (wet.x0 < wet.x1) {
        this.water = new THREE.Mesh(
          new THREE.PlaneGeometry(wet.x1 - wet.x0 + 0.1, wet.z1 - wet.z0 + 0.2),
          new THREE.MeshPhysicalMaterial({
            color: this.look.water,
            roughness: 0.12,
            metalness: 0.05,
            normalMap: this.tex.ripple,
            normalScale: new THREE.Vector2(0.35, 0.35),
            transparent: true,
            opacity: 0.88,
            clearcoat: 0.6,
          }),
        )
        this.water.rotation.x = -Math.PI / 2
        this.water.position.set((wet.x0 + wet.x1) / 2, h.water, (wet.z0 + wet.z1) / 2)
        course.add(this.water)
      }
    }

    // The tee: a mat and two markers.
    const ty = h.height(h.tee.x, h.tee.z)
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), new THREE.MeshStandardMaterial({ color: place.mat, roughness: 1 }))
    mat.rotation.x = -Math.PI / 2
    mat.position.set(h.tee.x, ty + 0.004, h.tee.z)
    mat.receiveShadow = true
    course.add(mat)
    for (const side of [-1, 1]) {
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), new THREE.MeshStandardMaterial({ color: place.target.bull, roughness: 0.4 }))
      mk.position.set(h.tee.x + side * 0.55, ty + 0.05, h.tee.z)
      mk.castShadow = true
      course.add(mk)
    }

    // A protractor at the tee: a tick every 5°, the 0° line in gold.
    const protractor = new THREE.Group()
    const R = 0.8
    const arc: THREE.Vector3[] = []
    for (let a = -60; a <= 60; a += 2) {
      const r = (a * Math.PI) / 180
      const x = h.tee.x + Math.sin(r) * R
      const z = h.tee.z - Math.cos(r) * R
      arc.push(new THREE.Vector3(x, h.height(x, z) + 0.012, z))
    }
    protractor.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc), new THREE.LineBasicMaterial({ color: CHALK, transparent: true, opacity: 0.75 })))
    const ticks: THREE.Vector3[] = []
    const zero: THREE.Vector3[] = []
    for (let a = -60; a <= 60; a += 5) {
      const r = (a * Math.PI) / 180
      const long = a % 15 === 0
      for (const rr of [R - (long ? 0.1 : 0.05), R + (long ? 0.05 : 0.02)]) {
        const x = h.tee.x + Math.sin(r) * rr
        const z = h.tee.z - Math.cos(r) * rr
        ;(a === 0 ? zero : ticks).push(new THREE.Vector3(x, h.height(x, z) + 0.013, z))
      }
    }
    protractor.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), new THREE.LineBasicMaterial({ color: CHALK, transparent: true, opacity: 0.8 })))
    protractor.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(zero), new THREE.LineBasicMaterial({ color: GOLD })))
    course.add(protractor)
    this.protractor = protractor

    this.scene.add(course)
    this.course = course
    this.applyLook()
  }

  // ---------- ghosts: the last few tries' paths ----------

  private showGhosts(ghosts: GameState['ghosts']) {
    for (const l of this.ghostLines) {
      this.scene.remove(l)
      this.disposeObject(l)
    }
    this.ghostLines = ghosts.map((path, i) => {
      const age = ghosts.length - 1 - i
      const pts = path.map(([x, y, z]: PathPoint) => new THREE.Vector3(x, y - BALL_R * 0.55, z))
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: age === 0 ? GOLD : CHALK, transparent: true, opacity: [1, 0.45, 0.22][age] ?? 0.2, fog: false }),
      )
      line.renderOrder = 2
      this.scene.add(line)
      return line
    })
    this.ghostsShown = ghosts
  }

  // ---------- the camera ----------

  /** Frame the scene in the clear band between the panels, not behind them. */
  private centreOnBand() {
    const { width: W, height: H, band } = this
    const clear = band.bottom - band.top > H * 0.25 ? band : { top: 0, bottom: H }
    this.camera.setViewOffset(W, H, 0, H / 2 - (clear.top + clear.bottom) / 2, W, H)
    this.camera.updateProjectionMatrix()
    return clear
  }

  private teePoint(h: Hole) {
    return new THREE.Vector3(h.tee.x, h.height(h.tee.x, h.tee.z), h.tee.z)
  }

  private targetPoint(h: Hole) {
    return new THREE.Vector3(h.target.x, h.height(h.target.x, h.target.z), h.target.z)
  }

  /** Behind the tee, looking up the hole, with the ball low in the clear band. */
  private teeFraming(h: Hole) {
    const band = this.centreOnBand()
    const t = this.teePoint(h)
    const narrow = this.camera.aspect < 0.8
    const pos = t.clone().add(new THREE.Vector3(0, narrow ? 3.1 : 2.6, narrow ? 6.4 : 5.6))
    const want = band.top + (band.bottom - band.top) * 0.74
    const saved = { p: this.camera.position.clone(), q: this.camera.quaternion.clone() }
    let best = { d: 6, err: Infinity }
    for (let d = 1; d <= 16; d += 0.25) {
      this.camera.position.copy(pos)
      this.camera.lookAt(t.x, t.y, t.z - d)
      this.camera.updateMatrixWorld()
      const p = t.clone().project(this.camera)
      const err = Math.abs(((1 - p.y) / 2) * this.height - want)
      if (err < best.err) best = { d, err }
    }
    this.camera.position.copy(saved.p)
    this.camera.quaternion.copy(saved.q)
    return { pos, target: t.clone().add(new THREE.Vector3(0, 0, -best.d)) }
  }

  private framing(kind: View, h: Hole) {
    const b = this.bounds
    if (kind === 'top') {
      const band = this.centreOnBand()
      const c = new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2)
      const full = (this.camera.fov * Math.PI) / 180
      const vf = 2 * Math.atan(Math.tan(full / 2) * ((band.bottom - band.top) / this.height))
      const hf = 2 * Math.atan(Math.tan(full / 2) * this.camera.aspect)
      const long = b.z1 - b.z0 + 1.6
      const wide = b.x1 - b.x0 + 1.6
      // Laid across a wide screen, tee on the left; up a narrow one, tee at the bottom.
      const across = this.camera.aspect > 1.1
      const needV = (across ? wide : long) / 2 / Math.tan(vf / 2)
      const needH = (across ? long : wide) / 2 / Math.tan(hf / 2)
      const height = Math.max(needV, needH)
      return { pos: c.clone().add(across ? new THREE.Vector3(0.01, height, 0) : new THREE.Vector3(0, height, 0.01)), target: c }
    }
    if (kind === 'target') {
      this.centreOnBand()
      const t = this.targetPoint(h)
      const narrow = this.camera.aspect < 0.8
      return { pos: t.clone().add(narrow ? new THREE.Vector3(1.6, 4.2, 6.4) : new THREE.Vector3(1.8, 3.2, 5)), target: t }
    }
    return this.teeFraming(h)
  }

  /** Glide to a set view, or jump there. */
  setView(kind: View, instant = false) {
    this.view = kind
    if (!this.hole) return
    const f = this.framing(kind, this.hole)
    const g = this.glide
    g.from.copy(this.camera.position)
    g.fromT.copy(this.controls.target)
    g.to.copy(f.pos)
    g.toT.copy(f.target)
    g.k = instant || this.still ? 1 : 0
    if (g.k === 1) {
      this.camera.position.copy(f.pos)
      this.controls.target.copy(f.target)
    }
  }

  /** In over the target, back down the hole, and onto the tee. */
  private planFlyover(h: Hole) {
    const b = this.bounds
    const tee = this.teeFraming(h)
    const tgt = this.targetPoint(h)
    const mid = new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2)
    const k = this.camera.aspect < 0.8 ? 1.7 : 1
    this.fly = {
      pos: new THREE.CatmullRomCurve3([
        tgt.clone().add(new THREE.Vector3(-2.5, 6, -6).multiplyScalar(k)),
        tgt.clone().add(new THREE.Vector3(3.5, 3.6, 3.2).multiplyScalar(k)),
        mid.clone().add(new THREE.Vector3(7, 10, 3).multiplyScalar(k)),
        tee.pos.clone().add(new THREE.Vector3(0, 3, 5)),
        tee.pos.clone(),
      ]),
      look: new THREE.CatmullRomCurve3([tgt.clone(), tgt.clone(), mid.clone(), tee.target.clone(), tee.target.clone()]),
    }
  }

  private startFollow(state: GameState) {
    const a = (state.angle * Math.PI) / 180
    this.follow.dir.set(Math.sin(a), 0, -Math.cos(a))
    this.follow.target.copy(this.ball.position)
    // Putting from somewhere far off: cut to the tee first, as a camera would.
    if (this.camera.position.distanceTo(this.ball.position) > 7) {
      const f = this.teeFraming(state.hole)
      this.camera.position.copy(f.pos)
      this.follow.target.copy(f.target)
      this.camera.lookAt(f.target)
    }
  }

  private followBall(state: GameState, dt: number) {
    const b = state.ball
    const v = this.tmp.set(b.vx, 0, b.vz)
    if (v.length() > 0.4) this.follow.dir.lerp(v.normalize(), 1 - Math.exp(-dt * 2.2)).normalize()
    const narrow = this.camera.aspect < 0.8
    const want = this.tmp2
      .copy(this.ball.position)
      .addScaledVector(this.follow.dir, narrow ? -4.2 : -3.6)
      .add(new THREE.Vector3(0, narrow ? 2.6 : 1.9, 0))
    this.camera.position.lerp(want, 1 - Math.exp(-dt * 3))
    this.follow.target.lerp(this.ball.position.clone().addScaledVector(this.follow.dir, 1.8), 1 - Math.exp(-dt * 5))
    this.camera.lookAt(this.follow.target)
  }

  /** Round and round a point: the hole behind the start card, the bull after a bullseye. */
  private circle(centre: THREE.Vector3, radius: number, rise: number, speed: number, dt: number) {
    this.orbit += dt * speed
    const want = this.tmp.set(centre.x + Math.sin(this.orbit) * radius, centre.y + rise, centre.z + Math.cos(this.orbit) * radius)
    this.camera.position.lerp(want, 1 - Math.exp(-dt * 2))
    this.controls.target.lerp(centre, 1 - Math.exp(-dt * 3))
    this.camera.lookAt(this.controls.target)
  }

  private enterPhase(state: GameState) {
    const h = state.hole
    switch (state.phase) {
      case 'intro':
        this.planFlyover(h)
        break
      case 'aim':
        this.setView('tee', this.phase === null || this.phase === 'menu')
        break
      case 'roll':
        this.startFollow(state)
        break
      case 'return':
        this.setView('tee')
        break
      case 'holed':
        this.orbit = Math.atan2(this.camera.position.x - h.target.x, this.camera.position.z - h.target.z)
        break
      case 'menu': {
        // Straight onto the circle round the hole, rather than swooping in from nowhere.
        this.centreOnBand()
        const b = this.bounds
        const long = b.z1 - b.z0
        this.controls.target.set((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2)
        this.camera.position.set(this.controls.target.x + Math.sin(this.orbit) * long * MENU_OUT, long * MENU_UP, this.controls.target.z + Math.cos(this.orbit) * long * MENU_OUT)
        this.camera.lookAt(this.controls.target)
        break
      }
    }
    this.controls.enabled = state.phase === 'aim'
  }

  // ---------- each frame ----------

  resize(width: number, height: number, band: Band) {
    const changed = width !== this.width || height !== this.height || band.top !== this.band.top || band.bottom !== this.band.bottom
    if (!changed) return
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.band = band
    this.renderer.setSize(this.width, this.height, false)
    this.camera.aspect = this.width / this.height
    // A wider lens on a tall phone.
    this.camera.fov = this.camera.aspect < 0.8 ? 58 : 46
    this.camera.updateProjectionMatrix()
    this.centreOnBand()
    if (this.phase === 'aim' && this.view) this.setView(this.view, true)
  }

  frame(state: GameState, dt: number) {
    const h = state.hole
    if (state.holeKey !== this.holeKey) {
      this.holeKey = state.holeKey
      this.hole = h
      this.buildHole(h)
      this.showGhosts([])
      this.last.set(state.ball.x, state.ball.y, state.ball.z)
      this.ball.position.copy(this.last)
      // A new hole starts its phase afresh, even one that has the same name as the last hole's.
      this.phase = null
    }
    if (state.phase !== this.phase) {
      this.enterPhase(state)
      this.phase = state.phase
    }
    if (state.ghosts !== this.ghostsShown) this.showGhosts(state.ghosts)
    if (state.bulls !== this.bulls) {
      if (this.bulls >= 0 && this.greenUniforms) this.greenUniforms.flash!.value = 1
      this.bulls = state.bulls
    }

    // The ball, rolling forward as it goes: turned about up × its path, so its top goes the way it goes.
    const b = state.ball
    const dx = b.x - this.last.x
    const dz = b.z - this.last.z
    const d = Math.hypot(dx, dz)
    if (state.phase === 'roll' && !b.air && d > 1e-7 && d < 2) {
      this.axis.set(dz, 0, -dx).normalize()
      this.spin.setFromAxisAngle(this.axis, d / BALL_R)
      this.ball.quaternion.premultiply(this.spin)
    }
    this.last.set(b.x, b.y, b.z)
    this.ball.position.copy(this.last)

    const now = (performance.now() - this.clockStart) / 1000
    if (this.greenUniforms) {
      this.greenUniforms.time!.value = now
      this.greenUniforms.flash!.value = Math.max(0, (this.greenUniforms.flash!.value as number) - dt * 0.45)
    }
    if (this.beacon) {
      const s = 1 + Math.sin(now * 2.2) * 0.06
      this.beacon.scale.set(s, 1, s)
      const far = this.camera.position.distanceTo(this.beacon.position)
      this.beacon.material.opacity = this.look.beam * Math.min(1, Math.max(0, (far - 5) / 9))
    }
    if (this.water) {
      this.tex.ripple.offset.x = now * 0.02
      this.tex.ripple.offset.y = now * 0.013
    }
    this.drawAim(state)

    switch (state.phase) {
      case 'menu': {
        const bd = this.bounds
        const long = bd.z1 - bd.z0
        this.circle(new THREE.Vector3((bd.x0 + bd.x1) / 2, 0, (bd.z0 + bd.z1) / 2), long * MENU_OUT, long * MENU_UP, 0.06, dt)
        break
      }
      case 'intro':
        if (this.fly) {
          const e = ease(Math.min(1, state.phaseTime / INTRO_TIME))
          this.camera.position.copy(this.fly.pos.getPointAt(e))
          this.controls.target.copy(this.fly.look.getPointAt(e))
          this.camera.lookAt(this.controls.target)
        }
        break
      case 'roll':
      case 'missed':
        this.followBall(state, dt)
        break
      case 'holed':
      case 'gameover':
        this.circle(this.targetPoint(h), 3.4, 2.2, 0.35, dt)
        break
      default: {
        const g = this.glide
        if (g.k < 1) {
          g.k = Math.min(1, g.k + dt / 0.7)
          const e = 1 - (1 - g.k) ** 3
          this.camera.position.lerpVectors(g.from, g.to, e)
          this.controls.target.lerpVectors(g.fromT, g.toT, e)
        }
        this.controls.update()
      }
    }

    // Keep the shadows sharp where the eye is.
    const focus = state.phase === 'roll' || state.phase === 'missed' ? this.ball.position : this.controls.target
    this.sun.target.position.copy(focus)
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 30)
    this.sky.position.copy(this.camera.position)
    this.renderer.render(this.scene, this.camera)
  }

  private drawAim(state: GameState) {
    const show = state.phase === 'aim'
    this.dots.visible = this.tip.visible = show
    if (this.protractor) this.protractor.visible = show || state.phase === 'intro' || state.phase === 'return'
    if (!show) return
    const h = state.hole
    const a = (state.angle * Math.PI) / 180
    const dx = Math.sin(a)
    const dz = -Math.cos(a)
    const reach = 0.5 + (state.power / 100) * 3
    const n = Math.min(DOTS, Math.max(3, Math.round(reach / 0.12)))
    const colour = new THREE.Color().setHSL((46 - (state.power / 100) * 42) / 360, 0.95, 0.6)
    this.dots.material.color.copy(colour)
    this.tip.material.color.copy(colour)
    for (let i = 0; i < DOTS; i++) {
      const d = 0.24 + i * 0.12
      if (i >= n || d > reach) {
        this.m4.makeScale(0, 0, 0)
        this.dots.setMatrixAt(i, this.m4)
        continue
      }
      const x = this.ball.position.x + dx * d
      const z = this.ball.position.z + dz * d
      this.m4.compose(this.tmp.set(x, h.height(x, z) + 0.014, z), this.flat, this.one)
      this.dots.setMatrixAt(i, this.m4)
    }
    this.dots.instanceMatrix.needsUpdate = true
    const tx = this.ball.position.x + dx * (reach + 0.1)
    const tz = this.ball.position.z + dz * (reach + 0.1)
    this.tip.position.set(tx, h.height(tx, tz) + 0.04, tz)
    this.tip.quaternion.setFromUnitVectors(this.up, this.tmp.set(dx, 0, dz))
  }

  dispose() {
    this.themeWatch.disconnect()
    window.removeEventListener(THEME_EVENT, this.onTheme)
    this.controls.dispose()
    this.disposeObject(this.scene)
    for (const t of this.textures) t.dispose()
    this.scene.environment?.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
