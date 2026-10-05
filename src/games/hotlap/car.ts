/*
 * Hot Lap's car: an open-wheel racer, Indy style, as Ramsey picked (2026-09-29). A slim needle of a body on
 * four open wheels ringed in orange light, a pod along each side, a wing at each end and a glass bubble over
 * the driver, in dark gunmetal, lit along its edges.
 *
 * A car is a design (CarDesign): its body's section along its length, its canopy, its parts and its wheels.
 * More cars can come later as more designs, looks only: every car drives the same (sim.ts), so times stay fair.
 *
 * Built hard-edged from flat panels: the body is a loft of a few-sided section along the car, and each panel
 * is its own strip, so an edge stays sharp across and smooth along. Everything that shares a material is
 * merged into one mesh, so the whole car draws in a few calls. x forward, y up, z across, as the scene poses
 * it. The ghost is the same car seen through, in cyan, with lines of light along its edges.
 */
import * as THREE from 'three'

export type CarModel = {
  group: THREE.Group
  /** Everything that leans with the springs: all but the wheels. */
  body: THREE.Group
  wheels: THREE.Object3D[]
  /** The front wheels' pivots, turned with the steering. */
  steer: THREE.Group[]
  /** The ghost's materials, whose opacity the scene sets. */
  see: THREE.Material[]
  /** The ghost's outlines, whose opacity the scene sets too. */
  lines: THREE.Material[]
  /** A rocket's flame out of its tail, which the scene stretches as the car pulls (the Rocket car's). */
  flame?: THREE.Object3D
}

/** Each wheel as [forward, left] of the car's middle, front pair first. */
export const WHEELS: [number, number][] = [
  [1.45, 0.78],
  [1.45, -0.78],
  [-1.4, 0.78],
  [-1.4, -0.78],
]

/**
 * Half the body's section at a point along it, as [across, up] points from the middle of the floor round to
 * the middle of the top: the floor out to the side, up the side to the crease, in along the chamfer to the
 * top's edge, and across to the middle.
 */
type Section = {
  floor: number
  wSide: number
  wBelt: number
  belt: number
  wShoulder: number
  shoulder: number
  wTop: number
  top: number
  crown: number
}

/** A bubble of glass: from and to along the car, widest and highest at `peak`, sloping away behind it (`back` near 1 is straight). */
type Canopy = { from: number; to: number; width: number; rise: number; peak: number; back: number; sink: number }

type Part =
  /** A slab: a wing, a plate, a pylon. `light` lights its front or back edge. */
  | { kind: 'box'; size: [number, number, number]; at: [number, number, number]; light?: 'front' | 'back' }
  /** A pod along each side, `across` out from the middle. */
  | { kind: 'pods'; from: number; to: number; across: number; width: number; top: number; floor: number }
  /** Arms from the body out to each wheel. */
  | { kind: 'arms' }

/** The body's edges that can be lit, as their place in the section. */
const EDGES = { foot: 1, belt: 2, shoulder: 3, top: 4 } as const

export type CarDesign = {
  wheel: { r: number; width: number }
  /** Where the body ends, behind and ahead. */
  tail: number
  nose: number
  section: (x: number) => Section
  canopy: Canopy
  /** The body's edges lit down each side. */
  edges: (keyof typeof EDGES)[]
  /** How high the bar of light across the tail is. */
  tailBar: number
  parts: Part[]
  /** Where the maker's name lies, face up: along and how high. */
  name: [number, number]
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** The Indy car. */
export const FORMULA: CarDesign = {
  wheel: { r: 0.37, width: 0.32 },
  tail: -2.3,
  nose: 2.9,
  section(x) {
    const n = smooth(1.2, 2.9, x) // 0 along the body, 1 at the tip of the nose
    const t = smooth(-1.6, -2.3, x) // and at the tail
    const half = lerp(lerp(0.42, 0.14, n ** 0.8), 0.24, t)
    const top = lerp(lerp(0.66, 0.3, n ** 0.9), 0.52, t)
    return {
      floor: 0.16 + 0.04 * n,
      wSide: half,
      wBelt: half,
      belt: lerp(0.42, 0.24, n),
      wShoulder: half * 0.86,
      shoulder: top - 0.06,
      wTop: half * 0.5,
      top,
      crown: 0.02,
    }
  },
  canopy: { from: -1.05, to: 0.95, width: 0.3, rise: 0.36, peak: 0.2, back: 1.4, sink: 0.02 },
  edges: ['shoulder'],
  tailBar: 0.4,
  parts: [
    { kind: 'pods', from: -1.0, to: 0.9, across: 0.62, width: 0.26, top: 0.52, floor: 0.18 },
    // The front wing low across the nose, a plate at each end.
    { kind: 'box', size: [0.36, 0.03, 2.02], at: [2.66, 0.2, 0], light: 'front' },
    { kind: 'box', size: [0.4, 0.2, 0.03], at: [2.66, 0.26, 1.0] },
    { kind: 'box', size: [0.4, 0.2, 0.03], at: [2.66, 0.26, -1.0] },
    // The rear wing high over the tail on a pylon, a tall plate at each end.
    { kind: 'box', size: [0.4, 0.035, 1.7], at: [-2.12, 1.0, 0], light: 'back' },
    { kind: 'box', size: [0.46, 0.46, 0.03], at: [-2.12, 0.86, 0.85] },
    { kind: 'box', size: [0.46, 0.46, 0.03], at: [-2.12, 0.86, -0.85] },
    { kind: 'box', size: [0.26, 0.5, 0.04], at: [-2.08, 0.75, 0] },
    { kind: 'arms' },
  ],
  name: [-2.12, 1.018],
}

/** The wheels' size, for the scene to turn them by. */
export const WHEEL_RADIUS = FORMULA.wheel.r

/* ---------- building ---------- */

type Point = [number, number, number]

/** A surface from rings of points, each band between two neighbouring ring points its own strip. */
function strips(rings: Point[][], closed: boolean) {
  const count = rings[0]!.length
  const bands = closed ? count : count - 1
  const pos: number[] = []
  const idx: number[] = []
  let base = 0
  for (let k = 0; k < bands; k++) {
    const k2 = (k + 1) % count
    for (const ring of rings) pos.push(...ring[k]!, ...ring[k2]!)
    for (let i = 0; i < rings.length - 1; i++) {
      const a = base + i * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    base += rings.length * 2
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** A flat cap over one ring: a fan from its middle. */
function cap(ring: Point[]) {
  const mid = ring.reduce<Point>((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length, s[2] + p[2] / ring.length], [0, 0, 0])
  const pos = [...mid, ...ring.flat()]
  const idx: number[] = []
  for (let k = 0; k < ring.length; k++) idx.push(0, 1 + k, 1 + ((k + 1) % ring.length))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** One mesh's worth from many shapes: their positions, normals and faces. */
function merge(parts: THREE.BufferGeometry[]) {
  let vertices = 0
  let indices = 0
  for (const g of parts) {
    vertices += g.attributes.position!.count
    indices += g.index ? g.index.count : g.attributes.position!.count
  }
  const pos = new Float32Array(vertices * 3)
  const nor = new Float32Array(vertices * 3)
  const idx = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)
  let at = 0
  let i = 0
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals()
    const count = g.attributes.position!.count
    pos.set(g.attributes.position!.array as Float32Array, at * 3)
    nor.set(g.attributes.normal!.array as Float32Array, at * 3)
    if (g.index) {
      const src = g.index.array
      for (let k = 0; k < src.length; k++) idx[i + k] = src[k]! + at
      i += src.length
    } else {
      for (let k = 0; k < count; k++) idx[i + k] = at + k
      i += count
    }
    at += count
    g.dispose()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  return geo
}

/** The body's rings from tail to nose: each section's right half, then its left, round the car. */
function hullRings(d: CarDesign): Point[][] {
  const rings: Point[][] = []
  const stations = 160
  for (let i = 0; i <= stations; i++) {
    const x = d.tail + ((d.nose - d.tail) * i) / stations
    const p = d.section(x)
    const half: [number, number][] = [
      [0, p.floor],
      [p.wSide, p.floor],
      [p.wBelt, p.belt],
      [p.wShoulder, p.shoulder],
      [p.wTop, p.top],
      [0, p.top + p.crown],
    ]
    const right = half.map(([z, y]): Point => [x, y, z])
    const left = half
      .slice(1, -1)
      .reverse()
      .map(([z, y]): Point => [x, y, -z])
    rings.push([...right, ...left])
  }
  return rings
}

function canopyRings(c: Canopy, topAt: (x: number) => number): Point[][] {
  const rings: Point[][] = []
  const stations = 60
  for (let i = 0; i <= stations; i++) {
    const x = c.from + ((c.to - c.from) * i) / stations
    // Round to the windscreen ahead of the peak; behind it, a long slope down to the body.
    const front = x >= c.peak
    const u = Math.abs(front ? (x - c.peak) / (c.to - c.peak) : (x - c.peak) / (c.peak - c.from))
    const e = front ? Math.sqrt(clamp01(1 - u * u)) : clamp01(1 - u ** c.back)
    const ew = front ? Math.sqrt(clamp01(1 - u * u)) : Math.sqrt(clamp01(1 - u ** 3))
    const w = c.width * ew ** 0.7
    const base = topAt(x) - c.sink
    const h = c.rise * e ** 0.6
    const half: [number, number][] = [
      [w, base],
      [w * 0.86, base + h * 0.62],
      [w * 0.5, base + h * 0.94],
      [0, base + h],
    ]
    const right = half.map(([z, y]): Point => [x, y, z])
    const left = half
      .slice(0, -1)
      .reverse()
      .map(([z, y]): Point => [x, y, -z])
    rings.push([...right, ...left])
  }
  return rings
}

const tube = (points: Point[], radius: number) =>
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal'),
    Math.max(24, points.length * 2),
    radius,
    8,
    false,
  )

type Shapes = {
  skin: THREE.BufferGeometry
  dark: THREE.BufferGeometry
  canopy: THREE.BufferGeometry
  /** The lines of light: their cores, and their halos. */
  core: THREE.BufferGeometry
  halo: THREE.BufferGeometry
  arms: THREE.BufferGeometry
  seat: THREE.BufferGeometry
  tyre: THREE.BufferGeometry
  disc: THREE.BufferGeometry
  rings: THREE.BufferGeometry
  hub: THREE.BufferGeometry
}

const made = new Map<CarDesign, Shapes>()

/** A design's shapes, worked out once for the car and its ghost both. */
function shapesOf(d: CarDesign): Shapes {
  let shapes = made.get(d)
  if (shapes) return shapes
  const skin: THREE.BufferGeometry[] = []
  const dark: THREE.BufferGeometry[] = []
  const lights: [Point[], number][] = []
  const arms: THREE.BufferGeometry[] = []

  const rings = hullRings(d)
  skin.push(strips(rings, true))
  dark.push(cap(rings[0]!), cap(rings[rings.length - 1]!))
  const topAt = (x: number) => {
    const p = d.section(x)
    return p.top + p.crown
  }

  // Light along the chosen edges, down each side.
  const count = rings[0]!.length
  for (const name of d.edges) {
    const k = EDGES[name]
    for (const [at, out] of [
      [k, 1],
      [count - k, -1],
    ] as const) {
      const points: Point[] = []
      for (let i = 2; i < rings.length - 1; i += 2) {
        const [x, y, z] = rings[i]![at]!
        points.push([x, y, z + out * 0.006])
      }
      lights.push([points, 0.012])
    }
  }
  // A bar of light across the tail.
  const tailHalf = Math.abs(rings[0]![EDGES.belt]![2]) - 0.06
  lights.push([
    [
      [d.tail - 0.008, d.tailBar, -tailHalf],
      [d.tail - 0.008, d.tailBar, 0],
      [d.tail - 0.008, d.tailBar, tailHalf],
    ],
    0.022,
  ])

  for (const part of d.parts) {
    if (part.kind === 'box') {
      const box = new THREE.BoxGeometry(...part.size)
      box.translate(...part.at)
      skin.push(box)
      if (part.light) {
        const [lx, , lz] = part.size
        const x = part.at[0] + (part.light === 'back' ? -lx / 2 : lx / 2)
        lights.push([
          [
            [x, part.at[1], -lz / 2],
            [x, part.at[1], 0],
            [x, part.at[1], lz / 2],
          ],
          0.012,
        ])
      }
    } else if (part.kind === 'pods') {
      for (const s of [1, -1]) {
        const pod: Point[][] = []
        for (let i = 0; i <= 30; i++) {
          const x = part.from + ((part.to - part.from) * i) / 30
          const u = (x - part.from) / (part.to - part.from)
          const taper = Math.min(1, u * 6, (1 - u) * 3)
          const h = part.floor + (part.top - part.floor) * (0.4 + 0.6 * taper)
          const w = part.width / 2
          const c = part.across * s
          pod.push([
            [x, part.floor, c - w],
            [x, part.floor, c + w],
            [x, h - 0.04, c + w],
            [x, h, c + w * 0.6],
            [x, h, c - w * 0.6],
            [x, h - 0.04, c - w],
          ])
        }
        skin.push(strips(pod, true))
        dark.push(cap(pod[0]!), cap(pod[pod.length - 1]!))
        // Light along the pod's top outside edge.
        lights.push([pod.filter((_, i) => i % 2 === 0).map((r) => {
          const [x, y, z] = r[s > 0 ? 3 : 4]!
          return [x, y + 0.006, z] as Point
        }), 0.012])
      }
    } else {
      // Two arms to each wheel, from the side of the body out to its hub.
      for (const [wx, wz] of WHEELS) {
        for (const dy of [-0.06, 0.08]) {
          const from = new THREE.Vector3(wx + (wx > 0 ? -0.1 : 0.1), d.wheel.r + dy, Math.sign(wz) * 0.3)
          const to = new THREE.Vector3(wx, d.wheel.r + dy * 0.5, wz * 0.82)
          const arm = new THREE.CylinderGeometry(0.018, 0.018, from.distanceTo(to), 8)
          arm.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()))
          arm.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2)
          arms.push(arm)
        }
      }
    }
  }

  // The driver's seat under the glass, and the lit dash ahead of it.
  const c = d.canopy
  const seatX = c.from + (c.to - c.from) * 0.3
  const seatY = topAt(seatX) - 0.1
  const seat = new THREE.BoxGeometry(0.1, 0.34, 0.3)
  seat.rotateZ(0.3)
  seat.translate(seatX, seatY + 0.12, 0)
  const dashX = c.to - 0.45
  lights.push([
    [
      [dashX, topAt(dashX) + 0.06, -0.14],
      [dashX, topAt(dashX) + 0.07, 0],
      [dashX, topAt(dashX) + 0.06, 0.14],
    ],
    0.014,
  ])

  const r = d.wheel.r
  const tyre = new THREE.CylinderGeometry(r, r, d.wheel.width, 36)
  tyre.rotateX(Math.PI / 2)
  const hub = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20)
  hub.rotateX(Math.PI / 2)
  hub.translate(0, 0, 0.03)
  const outer = new THREE.TorusGeometry(r * 0.86, 0.02, 8, 48)
  outer.translate(0, 0, 0.02)
  const inner = new THREE.TorusGeometry(r * 0.58, 0.014, 8, 32)
  inner.translate(0, 0, 0.025)
  const disc = new THREE.CircleGeometry(r * 0.85, 36)
  disc.translate(0, 0, 0.002)

  shapes = {
    skin: merge(skin),
    dark: merge(dark),
    canopy: strips(canopyRings(c, topAt), false),
    core: merge(lights.map(([points, radius]) => tube(points, radius))),
    halo: merge(lights.map(([points, radius]) => tube(points, radius * 2.8))),
    arms: merge(arms),
    seat,
    tyre,
    disc,
    rings: merge([outer, inner]),
    hub,
  }
  made.set(d, shapes)
  return shapes
}

type Paint = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, hasText?: boolean) => THREE.Texture

/**
 * The car, or with `ghost` its ghost: the same shape seen through in `ghostColor`. `paint` makes the
 * scene's canvas textures (the glows, the shadow, the name), so the scene can let them go with it.
 */
/** A livery on the Indy car (a Hangar skin): its body's colour and its lights'. */
export type Livery = { body: string; glow: string }

/** Hot Lap's Hangar skins: the everyday car in a livery of its own (lib/skins.ts). */
export const INDY_LIVERIES: Record<string, Livery> = {
  // British racing green, with gold lights.
  'hotlap-green-flash': { body: '#1d5a3a', glow: '#ffc94d' },
}

export function buildCar(paint: Paint, ghost: boolean, ghostColor = '#46e4ff', design: CarDesign = FORMULA, livery?: Livery): CarModel {
  const shapes = shapesOf(design)
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const see: THREE.Material[] = []
  // Seen through, and a hair behind your car where the two meet, so it never tints yours.
  const through = ghost ? { transparent: true, opacity: 0.36, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 } : {}
  const std = (params: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...params, ...through })
    if (ghost) see.push(m)
    return m
  }
  const glow = ghost ? '#aaf6ff' : (livery?.glow ?? '#ff5a0a')

  // Dark gunmetal under a clear coat, so the night's glow runs along its panels.
  const skin = ghost
    ? std({ color: ghostColor, roughness: 0.3, metalness: 0.2 })
    : new THREE.MeshPhysicalMaterial({ color: livery?.body ?? '#262d36', roughness: 0.32, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide })
  body.add(new THREE.Mesh(shapes.skin, skin))
  const dark = ghost ? null : std({ color: '#0b0e12', roughness: 0.6, metalness: 0.3 })
  const arms = ghost ? null : std({ color: '#1b2129', roughness: 0.4, metalness: 0.5 })
  body.add(new THREE.Mesh(shapes.dark, dark ?? skin))
  body.add(new THREE.Mesh(shapes.arms, arms ?? skin))
  // The ghost's outline: lines of light where its shape turns, over its faint body.
  const lines: THREE.Material[] = []
  const outline = ghost ? new THREE.LineBasicMaterial({ color: '#8ff8ff', transparent: true, opacity: 0.9, depthWrite: false }) : null
  if (outline) {
    lines.push(outline)
    body.add(new THREE.LineSegments(new THREE.EdgesGeometry(shapes.skin, 28), outline))
    body.add(new THREE.LineSegments(new THREE.EdgesGeometry(shapes.canopy, 28), outline))
  }

  // Smoked glass, reflecting the sky.
  const glass = ghost
    ? std({ color: ghostColor, roughness: 0.1, metalness: 0.4 })
    : new THREE.MeshPhysicalMaterial({
        color: '#0b1219',
        roughness: 0.05,
        metalness: 0.6,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 1.6,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
  const canopy = new THREE.Mesh(shapes.canopy, glass)
  canopy.renderOrder = 1
  body.add(canopy)
  if (!ghost) body.add(new THREE.Mesh(shapes.seat, std({ color: '#1d242c', roughness: 0.6 })))

  // The lines of light: a core lit from within (dark under the light, so the orange stays deep) and a soft halo.
  const core = std({ color: ghost ? ghostColor : '#2a1004', emissive: glow, emissiveIntensity: ghost ? 0.9 : 1.25, roughness: 0.4 })
  body.add(new THREE.Mesh(shapes.core, core))
  body.add(
    new THREE.Mesh(
      shapes.halo,
      new THREE.MeshBasicMaterial({
        color: ghost ? '#6fe9ff' : '#ff5a0a',
        transparent: true,
        opacity: ghost ? 0.12 : 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  )

  if (!ghost) {
    // Blipka's name on top of the rear wing, read from behind: the lowercase mark with its teal dot on the i.
    const name = paint(
      512,
      128,
      (g, w) => {
        g.clearRect(0, 0, w, 128)
        g.font = '700 92px "Outfit", system-ui, sans-serif'
        g.textBaseline = 'alphabetic'
        g.textAlign = 'left'
        const x0 = (w - g.measureText('blipka').width) / 2
        g.fillStyle = '#3a4550'
        g.fillText('blipka', x0, 96)
        g.fillStyle = '#2eb8a0'
        g.beginPath()
        g.arc(x0 + g.measureText('bl').width + g.measureText('i').width / 2, 30, 11, 0, Math.PI * 2)
        g.fill()
      },
      true,
    )
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshBasicMaterial({ map: name, transparent: true, depthWrite: false }))
    plate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)))
    plate.position.set(design.name[0], design.name[1], 0)
    body.add(plate)
  }

  const { wheels, steer } = addWheels(group, shapes, design, std, ghost ? ghostColor : null, glow, outline)
  if (!ghost) addUnderGlow(group, paint)
  return { group, body, wheels, steer, see, lines }
}

type Std = (params: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial

/** The wheels: dark tyres, their faces ringed in light. A ghost's are all in its colour. */
function addWheels(group: THREE.Group, shapes: Shapes, design: CarDesign, std: Std, ghostColor: string | null, glow: string, outline: THREE.LineBasicMaterial | null) {
  const tyre = std({ color: ghostColor ?? '#14171b', roughness: 0.85, metalness: 0 })
  const well = std({ color: ghostColor ?? '#0c1014', roughness: 0.5, metalness: 0.3 })
  const rimRing = std({ color: ghostColor ?? '#2a1004', emissive: glow, emissiveIntensity: ghostColor ? 0.8 : 1.4, roughness: 0.3 })
  const hub = std({ color: ghostColor ?? '#1b2129', roughness: 0.25, metalness: 0.45 })
  const wheels: THREE.Object3D[] = []
  const steer: THREE.Group[] = []
  WHEELS.forEach(([x, z], k) => {
    const pivot = new THREE.Group()
    pivot.position.set(x, design.wheel.r, z)
    group.add(pivot)
    const wheel = new THREE.Group()
    pivot.add(wheel)
    wheel.add(new THREE.Mesh(shapes.tyre, tyre))
    if (outline) wheel.add(new THREE.LineSegments(new THREE.EdgesGeometry(shapes.tyre, 28), outline))
    const out = Math.sign(z)
    const face = new THREE.Group()
    face.position.z = out * (design.wheel.width / 2)
    if (out < 0) face.rotation.y = Math.PI
    wheel.add(face)
    face.add(new THREE.Mesh(shapes.disc, well), new THREE.Mesh(shapes.rings, rimRing), new THREE.Mesh(shapes.hub, hub))
    wheels.push(wheel)
    if (k < 2) steer.push(pivot)
  })
  return { wheels, steer }
}

/** Orange light on the road under the car, and a soft shadow. */
function addUnderGlow(group: THREE.Group, paint: Paint) {
  const under = paint(128, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(255,110,20,0.5)')
    grad.addColorStop(1, 'rgba(255,110,20,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
  const light = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 2.9),
    new THREE.MeshBasicMaterial({ map: under, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
  light.rotation.x = -Math.PI / 2
  light.position.y = 0.06
  group.add(light)
  const shade = paint(128, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(0,0,0,0.55)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 3), new THREE.MeshBasicMaterial({ map: shade, transparent: true, depthWrite: false }))
  blob.rotation.x = -Math.PI / 2
  blob.position.y = 0.05
  group.add(blob)
}

/* ---------- the Rocket car ---------- */

/** Catmull-Rom through [x, value] keys in order of x, for a smooth profile. */
function through(keys: readonly (readonly [number, number])[], x: number) {
  if (x <= keys[0]![0]) return keys[0]![1]
  const last = keys[keys.length - 1]!
  if (x >= last[0]) return last[1]
  let i = 0
  while (keys[i + 1]![0] < x) i++
  const p0 = keys[Math.max(0, i - 1)]!
  const p1 = keys[i]!
  const p2 = keys[i + 1]!
  const p3 = keys[Math.min(keys.length - 1, i + 2)]!
  const t = (x - p1[0]) / (p2[0] - p1[0])
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * (p2[0] - p1[0])
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * (p2[0] - p1[0])
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2
}

/** The Rocket car's body, tail to nose, as half its width: the fat of the rocket behind the driver, then a needle of a nose between the front wheels. */
const ROCKET_WIDTH: readonly (readonly [number, number])[] = [
  [-2.36, 0.34],
  [-2.2, 0.42],
  [-1.8, 0.5],
  [-1.2, 0.53],
  [-0.5, 0.51],
  [0, 0.45],
  [0.5, 0.35],
  [1.0, 0.26],
  [1.6, 0.22],
  [2.2, 0.19],
  [2.6, 0.14],
  [2.85, 0.08],
  [3.0, 0.0],
]
/** Its ends, how flat its section is (height over width), and how high its middle sits behind and at the nose. */
const ROCKET = { tail: -2.36, nose: 3.0, flat: 0.74, low: 0.56, nosed: 0.42 }

/** Half the body's width, its half height and the height of its middle, at x along it. */
function rocketAt(x: number) {
  const w = Math.max(0, through(ROCKET_WIDTH, x))
  const n = clamp01((x - 0.4) / 1.9)
  const cy = lerp(ROCKET.low, ROCKET.nosed, n * n * (3 - 2 * n))
  return { w, h: w * ROCKET.flat, cy }
}

/** A smooth skin over rings of points, each ring the same count round: shared corners, so it shades round. */
function smoothRings(rings: Point[][], closed: boolean) {
  const count = rings[0]!.length
  const pos: number[] = []
  const idx: number[] = []
  for (const ring of rings) for (const p of ring) pos.push(...p)
  const around = closed ? count : count - 1
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < around; k++) {
      const a = i * count + k
      const b = i * count + ((k + 1) % count)
      idx.push(a, a + count, b, b, a + count, b + count)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** A flat fin in the x-y plane: a trapezoid from its root chord (y 0) out to its tip chord (y `span`), `thick` through. */
function fin(root: [number, number], tip: [number, number], span: number, thick: number) {
  const shape = new THREE.Shape()
  shape.moveTo(root[0], 0)
  shape.lineTo(root[1], 0)
  shape.lineTo(tip[1], span)
  shape.lineTo(tip[0], span)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false })
  geo.translate(0, 0, -thick / 2)
  return geo
}

/** A Rocket car's colours: its body, its stripe and fin tip, its wings and fins, and its nozzle's light. */
export type RocketColors = { body: string; stripe: string; trim: string; glow: string; flame: readonly [string, string] }

/** The Rocket car's own, as the pass draws it: white, a red stripe, navy wings, an orange flame. */
export const ROCKET_COLORS: RocketColors = { body: '#ece9f7', stripe: '#e8564f', trim: '#101634', glow: '#ff7a1a', flame: ['#f2813a', '#ffe7a3'] }

/** The Midnight rocket (Season 1's Pass+): navy, an amber stripe, orange wings and a violet flame. */
export const MIDNIGHT_COLORS: RocketColors = { body: '#141a4a', stripe: '#f5b942', trim: '#f2813a', glow: '#9a7bff', flame: ['#8a6ad4', '#e2d9ff'] }

/** The Sunracer (Season 1's Pass+): sun-orange, a cream stripe, navy wings and a white-hot flame. */
export const SUNRACER_COLORS: RocketColors = { body: '#f07c16', stripe: '#fff3d6', trim: '#101634', glow: '#ffd27a', flame: ['#ffcf5a', '#fff3c4'] }

/** Hot Lap's skins (lib/skins.ts): each a Rocket car in its colours. */
export const ROCKET_SKINS: Record<string, RocketColors> = {
  'hotlap-rocket': ROCKET_COLORS,
  'hotlap-midnight': MIDNIGHT_COLORS,
  'hotlap-sunracer': SUNRACER_COLORS,
}

/**
 * The Rocket car, Season 1's Hot Lap skin (lib/skins.ts), as the pass draws it: a white rocket on four open
 * wheels, a red stripe nose to tail, navy wings, a dark bubble over the driver, fins at the tail and a flame
 * out of it. Ramsey asked for a car of its own (2026-10-02: "a totally redesigned car would be fine"). It
 * stands on the Indy car's wheels and drives the same (sim.ts), so a lap in it counts the same.
 *
 * With `ghost`, the same car seen through in `ghostColor` with lines of light where its shape turns: the
 * #1's ghost, when their lap was driven in it. `colors` paints it otherwise (a Pass+ skin's).
 */
export function buildRocketCar(paint: Paint, opts: { ghost?: boolean; ghostColor?: string; colors?: RocketColors } = {}): CarModel {
  const ghost = opts.ghost === true
  const ghostColor = opts.ghostColor ?? '#46e4ff'
  const c = opts.colors ?? ROCKET_COLORS
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const see: THREE.Material[] = []
  const lines: THREE.Material[] = []
  // Seen through, and a hair behind your car where the two meet, as the Indy car's ghost is.
  const through = ghost ? { transparent: true, opacity: 0.36, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 } : {}
  const std: Std = (params) => {
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...params, ...through })
    if (ghost) see.push(m)
    return m
  }
  const outline = ghost ? new THREE.LineBasicMaterial({ color: '#8ff8ff', transparent: true, opacity: 0.9, depthWrite: false }) : null
  if (outline) lines.push(outline)
  const seeThrough = ghost ? std({ color: ghostColor, roughness: 0.3, metalness: 0.2 }) : null
  const white =
    seeThrough ??
    new THREE.MeshPhysicalMaterial({ color: c.body, roughness: 0.28, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide })
  const navy = seeThrough ?? std({ color: c.trim, roughness: 0.45, metalness: 0.35 })
  const red = seeThrough ?? std({ color: c.stripe, roughness: 0.4, metalness: 0.1 })
  /** A part of the car, and on the ghost its edges in light. */
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, edges = true) => {
    body.add(new THREE.Mesh(geo, material))
    if (outline && edges) body.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), outline))
  }

  // The body: rings round it, tail to nose.
  const around = 40
  const stations = 140
  const xAt = (i: number) => ROCKET.tail + ((ROCKET.nose - ROCKET.tail) * i) / stations
  const rings: Point[][] = []
  for (let i = 0; i <= stations; i++) {
    const x = xAt(i)
    const { w, h, cy } = rocketAt(x)
    const ring: Point[] = []
    for (let k = 0; k < around; k++) {
      const a = (k / around) * Math.PI * 2
      ring.push([x, cy + Math.sin(a) * h, Math.cos(a) * w])
    }
    rings.push(ring)
  }
  add(smoothRings(rings, true), white, false)
  if (outline) {
    // The body is smooth all over, so its outline is drawn: along its top and down each side.
    for (const k of [Math.round(around / 4), 0, Math.round(around / 2)]) {
      const points = rings.filter((_, i) => i % 4 === 0).map((ring) => new THREE.Vector3(...ring[k]!))
      body.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), outline))
    }
  }

  // The stripe along the top, a hair over the body.
  if (!ghost) {
    const stripe: Point[][] = []
    for (let i = 2; i < stations; i++) {
      const x = xAt(i)
      const { w, h, cy } = rocketAt(x)
      const half = Math.min(0.085, w * 0.42)
      const row: Point[] = []
      for (let k = 0; k <= 6; k++) {
        const z = -half + (2 * half * k) / 6
        row.push([x, cy + h * Math.sqrt(clamp01(1 - (z / w) ** 2)) + 0.006, z])
      }
      stripe.push(row)
    }
    add(smoothRings(stripe, false), red, false)
  }

  // The tail: a face, a nozzle, its glowing throat, and the flame out of it.
  const tail = rocketAt(ROCKET.tail)
  const face = new THREE.CircleGeometry(1, 40)
  face.scale(tail.w, tail.h, 1)
  face.rotateY(-Math.PI / 2)
  face.translate(ROCKET.tail, tail.cy, 0)
  add(face, navy, false)
  const nozzle = new THREE.CylinderGeometry(0.2, 0.27, 0.22, 32, 1, true)
  nozzle.rotateZ(-Math.PI / 2)
  nozzle.translate(ROCKET.tail - 0.1, tail.cy, 0)
  add(nozzle, navy)
  const throat = new THREE.CircleGeometry(0.2, 32)
  throat.rotateY(-Math.PI / 2)
  throat.translate(ROCKET.tail - 0.02, tail.cy, 0)
  add(throat, std({ color: ghost ? ghostColor : '#2a1004', emissive: ghost ? '#aaf6ff' : c.glow, emissiveIntensity: ghost ? 0.9 : 1.6 }), false)

  const flame = new THREE.Group()
  flame.position.set(ROCKET.tail - 0.18, tail.cy, 0)
  for (const [r, len, color, opacity] of [
    [0.22, 1, ghost ? '#46e4ff' : c.flame[0], ghost ? 0.25 : 0.7],
    [0.12, 0.62, ghost ? '#c8f8ff' : c.flame[1], ghost ? 0.35 : 0.9],
  ] as const) {
    const cone = new THREE.ConeGeometry(r, len, 24, 1, true)
    // Its base at the nozzle and its point out behind, along -x, so stretching the group stretches it back.
    cone.translate(0, len / 2, 0)
    cone.rotateZ(Math.PI / 2)
    flame.add(
      new THREE.Mesh(
        cone,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      ),
    )
  }
  // A ghost's burns steady and short; your own car's stretches as it pulls (the scene's poseCar).
  if (ghost) flame.scale.set(0.6, 0.9, 0.9)
  body.add(flame)

  // Fins at the tail: one up, tipped in the stripe's colour; and one out each side, behind the rear wheels.
  const top = rocketAt(-1.9)
  const finBase = top.cy + top.h - 0.04
  const upFin = fin([-1.45, -2.3], [-2.05, -2.42], 0.42, 0.035)
  upFin.translate(0, finBase, 0)
  add(upFin, white)
  const tipCap = new THREE.BoxGeometry(0.38, 0.05, 0.045)
  tipCap.translate(-2.235, finBase + 0.42, 0)
  add(tipCap, red)
  for (const side of [1, -1]) {
    const tailFin = fin([-1.86, -2.34], [-2.18, -2.5], 0.62, 0.04)
    // Laid out flat to this side from the body's flank, dipping a little toward its tip.
    tailFin.rotateX(side * (Math.PI / 2 + 0.12))
    tailFin.translate(0, tail.cy - 0.06, side * 0.36)
    add(tailFin, navy)
  }

  // The front wing low across the nose, a plate at each end, and a lip in the stripe's colour along its front.
  const wing = new THREE.BoxGeometry(0.34, 0.035, 1.92)
  wing.translate(2.55, 0.2, 0)
  add(wing, navy)
  for (const side of [1, -1]) {
    const plate = new THREE.BoxGeometry(0.38, 0.18, 0.03)
    plate.translate(2.55, 0.26, side * 0.96)
    add(plate, navy)
  }
  if (!ghost) {
    const lip = new THREE.BoxGeometry(0.03, 0.04, 1.86)
    lip.translate(2.73, 0.2, 0)
    add(lip, red)
  }

  // The arms out to the wheels.
  const arms: THREE.BufferGeometry[] = []
  for (const [wx, wz] of WHEELS) {
    const at = rocketAt(wx)
    for (const dy of [-0.06, 0.08]) {
      const from = new THREE.Vector3(wx + (wx > 0 ? -0.1 : 0.1), FORMULA.wheel.r + dy, Math.sign(wz) * Math.max(0.12, at.w - 0.04))
      const to = new THREE.Vector3(wx, FORMULA.wheel.r + dy * 0.5, wz * 0.82)
      const arm = new THREE.CylinderGeometry(0.02, 0.02, from.distanceTo(to), 8)
      arm.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()))
      arm.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2)
      arms.push(arm)
    }
  }
  add(merge(arms), navy, false)

  // The bubble over the driver, dark glass, on the fat of the rocket.
  const glass = ghost
    ? std({ color: ghostColor, roughness: 0.1, metalness: 0.4 })
    : new THREE.MeshPhysicalMaterial({
        color: '#0b1219',
        roughness: 0.05,
        metalness: 0.6,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 1.6,
        side: THREE.DoubleSide,
      })
  const bubble = strips(
    canopyRings({ from: -1.15, to: 0.3, width: 0.27, rise: 0.25, peak: -0.35, back: 1.6, sink: 0.05 }, (x) => {
      const p = rocketAt(x)
      return p.cy + p.h
    }),
    false,
  )
  const canopy = new THREE.Mesh(bubble, glass)
  canopy.renderOrder = 1
  body.add(canopy)
  if (outline) body.add(new THREE.LineSegments(new THREE.EdgesGeometry(bubble, 28), outline))

  const { wheels, steer } = addWheels(group, shapesOf(FORMULA), FORMULA, std, ghost ? ghostColor : null, ghost ? '#aaf6ff' : '#ff5a0a', outline)
  if (!ghost) addUnderGlow(group, paint)
  return { group, body, wheels, steer, see, lines, ...(ghost ? {} : { flame }) }
}
