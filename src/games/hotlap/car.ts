/*
 * Hot Lap's car: a concept racer after the one Ramsey picked (2026-09-26). It has a long pearl-white
 * body that flows like a pebble, closed like an egg at both ends. High crowns over the wheels and a
 * low hood run between them, with a big smoked-glass canopy framed in white. A dark scoop sweeps
 * along each side. Orange light runs along the fender crests, the scoop, the nose and the tail, and
 * the wheels are orange turbines that glow.
 *
 * The body is one surface built section by section, x forward, y up, z across, so the scene can pose
 * it like any other model. The ghost is the same car, seen through, in its own colour.
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
}

export const WHEEL_RADIUS = 0.4
const WHEEL_WIDTH = 0.24
/** Each wheel as [forward, left] of the car's middle, front pair first. */
export const WHEELS: [number, number][] = [
  [1.45, 0.78],
  [1.45, -0.78],
  [-1.4, 0.78],
  [-1.4, -0.78],
]

const NOSE = 2.62
const TAIL = -2.6
/** Where the ends start to close: the nose over its last 70 cm, long and low; the tail over 45. */
const NOSE_ROUND = 1.92
const TAIL_ROUND = -2.15
/** How square the body's sides are, and how round its top and flat its floor. */
const SIDES = 2.6
const TOP = 2.2
const FLOOR = 3.5

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const spow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p)
/** A smooth hump between a and b, 1 at its peak. */
const hump = (a: number, peak: number, b: number, v: number) =>
  v <= a || v >= b ? 0 : v < peak ? Math.sin(((v - a) / (peak - a)) * (Math.PI / 2)) ** 2 : Math.sin(((b - v) / (b - peak)) * (Math.PI / 2)) ** 2

/** A smooth curve through the keys that never overshoots them (monotone cubic). */
function curve(keys: [number, number][]) {
  const n = keys.length
  const xs = keys.map((k) => k[0])
  const ys = keys.map((k) => k[1])
  const h: number[] = []
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1]! - xs[i]!)
    d.push((ys[i + 1]! - ys[i]!) / h[i]!)
  }
  const m = new Array<number>(n).fill(0)
  m[0] = d[0]!
  m[n - 1] = d[n - 2]!
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1]! * d[i]! <= 0) continue
    const w1 = 2 * h[i]! + h[i - 1]!
    const w2 = h[i]! + 2 * h[i - 1]!
    m[i] = (w1 + w2) / (w1 / d[i - 1]! + w2 / d[i]!)
  }
  return (x: number) => {
    if (x <= xs[0]!) return ys[0]!
    if (x >= xs[n - 1]!) return ys[n - 1]!
    let i = 0
    while (x > xs[i + 1]!) i++
    const t = (x - xs[i]!) / h[i]!
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * h[i]! * m[i + 1]!
  }
}

/* ---------- the body's shape ---------- */

/** The top of each section: high crowns over the wheels, a low waist at the cockpit. */
const shoulder = curve([
  [-2.15, 0.74],
  [-1.8, 0.92],
  [-1.4, 1.0],
  [-0.9, 0.9],
  [-0.3, 0.8],
  [0.4, 0.78],
  [0.95, 0.88],
  [1.45, 0.97],
  [1.92, 0.78],
])
const floorLine = curve([
  [-2.15, 0.3],
  [-1.9, 0.22],
  [-1.4, 0.2],
  [0, 0.18],
  [1.45, 0.19],
  [1.92, 0.21],
])
const halfWidth = curve([
  [-2.15, 0.84],
  [-1.8, 0.98],
  [-1.4, 1.03],
  [-0.9, 0.98],
  [-0.3, 0.92],
  [0.4, 0.91],
  [0.95, 0.96],
  [1.45, 0.99],
  [1.92, 0.9],
])

/** How far the ends have closed: 1 along the middle, 0 at the tip of the nose and the tail. */
function closing(x: number) {
  if (x > NOSE_ROUND) return Math.sqrt(clamp01(1 - ((x - NOSE_ROUND) / (NOSE - NOSE_ROUND)) ** 2))
  if (x < TAIL_ROUND) return Math.sqrt(clamp01(1 - ((TAIL_ROUND - x) / (TAIL_ROUND - TAIL)) ** 2))
  return 1
}

/** One section: its half-width, the height of its middle, and its half-height. */
function section(x: number) {
  const e = closing(x)
  const xc = Math.min(NOSE_ROUND, Math.max(TAIL_ROUND, x))
  const top = shoulder(xc)
  const bottom = floorLine(xc)
  // The nose closes low, like a wedge; the tail closes where it is.
  const drop = x > NOSE_ROUND ? 0.14 * (1 - e) : 0
  return { w: halfWidth(xc) * e, yc: (top + bottom) / 2 - drop, hh: ((top - bottom) / 2) * e }
}

/** How far in from the side the dips reach, 1 down the middle. */
const inboard = (across: number) => Math.max(0, 1 - (across / 0.6) ** 2) ** 2
/** The cockpit under the canopy: a shallow tub for the seats. */
const cockpit = (x: number) => hump(-1.35, -0.35, 0.95, x)

/** The dips between the crowns: a hood between the front fenders, the cockpit, a deck between the rear haunches. */
function valley(x: number, across: number) {
  const depth = 0.035 * hump(0.9, 1.6, 2.45, x) + 0.2 * cockpit(x) + 0.08 * hump(-2.3, -1.75, -1.1, x)
  return depth * inboard(across)
}

/** A point of the smooth body, before the arches and the scoops are cut: `theta` goes round from the right side (+z). */
function basePoint(x: number, theta: number) {
  const { w, yc, hh } = section(x)
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const z = w * spow(c, 2 / SIDES)
  let y = yc + hh * spow(s, 2 / (s >= 0 ? TOP : FLOOR))
  if (s > 0 && w > 1e-6) y -= valley(x, z / w) * ((y - yc) / Math.max(hh, 1e-6))
  return { x, y, z, yc, hh, w }
}

/** The angle round the section at which the body's side is at height y (on the right side). */
function thetaAt(x: number, y: number) {
  const { yc, hh } = section(x)
  const t = Math.max(-1, Math.min(1, (y - yc) / Math.max(hh, 1e-6)))
  return Math.asin(spow(t, (t >= 0 ? TOP : FLOOR) / 2))
}

/** The top of the side scoop along its length: higher at the front. */
const scoopTop = (x: number) => 0.5 + ((x + 0.88) / 1.81) * 0.2

/**
 * The finished surface: the wheel arches cut in to show the wheels, the side scoops and the intakes
 * set in, and how dark each point is (0 pearl, 1 dark: the arches, the scoops, the intakes, the band
 * across the tail, the diffuser and the floor).
 */
function surfacePoint(x: number, theta: number) {
  const p = basePoint(x, theta)
  let { y, z } = p
  const side = Math.abs(z)
  const sign = Math.sign(z) || 1
  let dark = 0
  // Wheel arches: an opening round each wheel, up to the lip under the crown.
  for (const [wx] of [WHEELS[0]!, WHEELS[2]!]) {
    const d = Math.hypot(x - wx, y - WHEEL_RADIUS)
    const inside = (1 - smooth(0.45, 0.54, d)) * (1 - smooth(0.74, 0.87, y))
    if (inside > 0 && side > 0.62) z = sign * (side + (0.62 - side) * inside)
    dark = Math.max(dark, inside)
  }
  // The side scoop between the arches, set in 9 cm.
  const along = smooth(-0.9, -0.72, x) * (1 - smooth(0.78, 0.96, x))
  const scoop = along * smooth(0.24, 0.3, y) * (1 - smooth(scoopTop(x) - 0.02, scoopTop(x) + 0.03, y))
  if (scoop > 0 && Math.abs(z) > 0.5) z = sign * (Math.abs(z) - 0.09 * scoop)
  dark = Math.max(dark, scoop)
  // Behind the rear wheels the body tucks in low down, so the tyres and their glow show from behind.
  const tuck = (1 - smooth(-2.0, -1.84, x)) * (1 - smooth(0.4, 0.52, y))
  if (tuck > 0 && Math.abs(z) > 0.6) z = sign * (Math.abs(z) + (0.6 - Math.abs(z)) * tuck)
  dark = Math.max(dark, tuck)
  // An intake at each corner of the nose.
  const q = ((x - 2.16) / 0.25) ** 2 + ((y - 0.4) / 0.1) ** 2
  const intake = (1 - smooth(0.75, 1.05, q)) * smooth(0.2, 0.3, Math.abs(z))
  if (intake > 0) z = sign * (Math.abs(z) - 0.03 * intake)
  dark = Math.max(dark, intake)
  // A dark band across the tail for the light, a diffuser under it, and the floor.
  dark = Math.max(dark, (1 - smooth(-2.34, -2.1, x)) * smooth(0.42, 0.46, y) * (1 - smooth(0.58, 0.62, y)))
  dark = Math.max(dark, (1 - smooth(-2.02, -1.82, x)) * (1 - smooth(0.3, 0.36, y)))
  dark = Math.max(dark, smooth(-0.45, -0.75, Math.sin(theta)))
  // The cockpit's floor, seen through the glass.
  if (Math.sin(theta) > 0 && p.w > 1e-6) dark = Math.max(dark, smooth(0.15, 0.5, cockpit(x) * inboard(p.z / p.w)))
  return { x, y, z, dark }
}

/** The top of the body at a distance across from the middle. */
function topAt(x: number, across: number) {
  const { w } = section(x)
  const c = Math.min(1, Math.abs(across) / Math.max(w, 1e-6)) ** (SIDES / 2)
  return basePoint(x, Math.acos(c)).y
}

/** A point just off the body (lifted `lift` along the section's outward direction), for the lights and the trim. */
function onBody(x: number, theta: number, lift: number) {
  const p = basePoint(x, theta)
  const ny = (p.y - p.yc) / Math.max(p.hh, 1e-3)
  const nz = p.z / Math.max(p.w, 1e-3)
  const n = Math.hypot(ny, nz) || 1
  return new THREE.Vector3(x, p.y + (ny / n) * lift, p.z + (nz / n) * lift)
}

/** The body as one surface: sections closest at the ends, where it curves most, and close enough between for clean arches. */
function bodyGeometry() {
  const stations = 220
  const around = 144
  const pearl = new THREE.Color('#ebe7e1')
  const dark = new THREE.Color('#161b21')
  const pos = new Float32Array((stations + 1) * around * 3)
  const col = new Float32Array((stations + 1) * around * 3)
  const index: number[] = []
  for (let i = 0; i <= stations; i++) {
    const s = i / stations
    const x = TAIL + (NOSE - TAIL) * (0.35 * s + (0.65 * (1 - Math.cos(Math.PI * s))) / 2)
    for (let j = 0; j < around; j++) {
      const p = surfacePoint(x, (j / around) * Math.PI * 2)
      const k = (i * around + j) * 3
      pos[k] = p.x
      pos[k + 1] = p.y
      pos[k + 2] = p.z
      col[k] = pearl.r + (dark.r - pearl.r) * p.dark
      col[k + 1] = pearl.g + (dark.g - pearl.g) * p.dark
      col[k + 2] = pearl.b + (dark.b - pearl.b) * p.dark
    }
  }
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j
      const b = i * around + ((j + 1) % around)
      const c = a + around
      const d = b + around
      index.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  // The two tips are single points: they face straight back and straight ahead.
  const normals = geo.attributes.normal!
  for (let j = 0; j < around; j++) {
    normals.setXYZ(j, -1, 0, 0)
    normals.setXYZ(stations * around + j, 1, 0, 0)
  }
  return geo
}

/* ---------- the canopy ---------- */

const CANOPY_BACK = -1.8
const CANOPY_FRONT = 1.3
const canopyWidth = curve([
  [-1.8, 0.2],
  [-1.3, 0.5],
  [-0.6, 0.63],
  [0.2, 0.63],
  [0.8, 0.54],
  [1.3, 0.25],
])
const canopyApex = curve([
  [-1.8, 0.86],
  [-1.3, 1.06],
  [-0.6, 1.18],
  [0.0, 1.19],
  [0.7, 1.06],
  [1.3, 0.86],
])

function canopyClosing(x: number) {
  const back = CANOPY_BACK + 0.4
  const front = CANOPY_FRONT - 0.35
  if (x < back) return Math.sqrt(clamp01(1 - ((back - x) / (back - CANOPY_BACK)) ** 2))
  if (x > front) return Math.sqrt(clamp01(1 - ((x - front) / (CANOPY_FRONT - front)) ** 2))
  return 1
}

/** The canopy at x: its half-width, where its rim sits (sunk into the body) and how high its crown is. */
function canopySection(x: number) {
  const e = canopyClosing(x)
  const w = canopyWidth(x)
  const base = topAt(x, w) - 0.05
  return { w: w * e, base, apex: base + (canopyApex(x) - base) * e }
}

function canopyPoint(x: number, theta: number, lift = 0) {
  const { w, base, apex } = canopySection(x)
  const z = w * spow(Math.cos(theta), 2 / 2.2)
  const y = base + (apex - base) * Math.pow(Math.max(0, Math.sin(theta)), 2 / 1.8)
  return new THREE.Vector3(x, y + lift * Math.sin(theta), z + lift * Math.cos(theta))
}

/** A dome from just behind the front wheels to the rear deck, its rim sunk into the body. */
function canopyGeometry() {
  const stations = 90
  const around = 48
  const pos: number[] = []
  const index: number[] = []
  for (let i = 0; i <= stations; i++) {
    const x = CANOPY_BACK + ((CANOPY_FRONT - CANOPY_BACK) * (1 - Math.cos((Math.PI * i) / stations))) / 2
    for (let j = 0; j <= around; j++) {
      const p = canopyPoint(x, (j / around) * Math.PI)
      pos.push(p.x, p.y, p.z)
    }
  }
  const row = around + 1
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * row + j
      const b = a + 1
      const c = a + row
      const d = c + 1
      index.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
}

/* ---------- the lights and the trim ---------- */

const tube = (points: THREE.Vector3[], radius: number, closed = false) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'centripetal'), Math.max(24, points.length * 3), radius, 8, closed)

/** Along a crown: the fender's or the haunch's, a set way round the section. */
function crest(from: number, to: number, theta: number) {
  const points: THREE.Vector3[] = []
  const steps = 28
  for (let k = 0; k <= steps; k++) points.push(onBody(from + ((to - from) * k) / steps, theta, 0.012))
  return points
}

/** The light lines, each as points: the fender crests, the haunch crests, the scoop edges, the intakes and the tail. */
function lightLines() {
  const lines: { points: THREE.Vector3[]; closed: boolean; radius: number }[] = []
  // About where the crowns are, three fifths of the way out.
  const crown = 0.9
  for (const theta of [crown, Math.PI - crown]) {
    lines.push({ points: crest(2.46, 0.72, theta), closed: false, radius: 0.012 })
    lines.push({ points: crest(-0.95, -2.3, theta), closed: false, radius: 0.012 })
  }
  for (const side of [1, -1]) {
    // Along the top of the scoop, just above its edge.
    const scoop: THREE.Vector3[] = []
    for (let k = 0; k <= 24; k++) {
      const x = 0.9 - (1.76 * k) / 24
      const theta = thetaAt(x, scoopTop(x) + 0.03)
      const p = onBody(x, side > 0 ? theta : Math.PI - theta, 0.008)
      scoop.push(p)
    }
    lines.push({ points: scoop, closed: false, radius: 0.014 })
    // Round each intake.
    const ring: THREE.Vector3[] = []
    for (let k = 0; k < 28; k++) {
      const phi = (k / 28) * Math.PI * 2
      const x = 2.16 + 0.28 * Math.cos(phi)
      const theta = thetaAt(x, 0.4 + 0.12 * Math.sin(phi))
      ring.push(onBody(x, side > 0 ? theta : Math.PI - theta, 0.006))
    }
    lines.push({ points: ring, closed: true, radius: 0.012 })
  }
  // Across the tail, wrapping round it a little above its middle.
  const bar: THREE.Vector3[] = []
  const band = 0.24
  for (let k = 0; k <= 20; k++) bar.push(onBody(-2.0 - (0.59 * k) / 20, band, 0.008))
  for (let k = 19; k >= 0; k--) bar.push(onBody(-2.0 - (0.59 * k) / 20, Math.PI - band, 0.008))
  lines.push({ points: bar, closed: false, radius: 0.024 })
  return lines
}

/* ---------- the wheels ---------- */

/** A turbine: fourteen thin vanes swept round the hub, all one shape. */
function vanesGeometry() {
  const vanes: THREE.BufferGeometry[] = []
  const count = 14
  for (let k = 0; k < count; k++) {
    const vane = new THREE.BoxGeometry(0.2, 0.04, 0.03)
    vane.rotateX(0.6)
    vane.rotateZ(-0.45)
    vane.translate(0.21, 0, 0)
    vane.rotateZ((k / count) * Math.PI * 2)
    vanes.push(vane)
  }
  // One shape from the fourteen, so a wheel draws its turbine at once. Done here rather than with three's
  // BufferGeometryUtils, which would pull that module into the engine chunk the two 3D games share and
  // rename it out from under the offline cache's rule (vite.config.ts).
  let vertices = 0
  let indices = 0
  for (const v of vanes) {
    vertices += v.attributes.position!.count
    indices += v.index!.count
  }
  const pos = new Float32Array(vertices * 3)
  const nor = new Float32Array(vertices * 3)
  const idx = new Uint16Array(indices)
  let at = 0
  let i = 0
  for (const v of vanes) {
    pos.set(v.attributes.position!.array as Float32Array, at * 3)
    nor.set(v.attributes.normal!.array as Float32Array, at * 3)
    const src = v.index!.array
    for (let k = 0; k < src.length; k++) idx[i + k] = src[k]! + at
    at += v.attributes.position!.count
    i += src.length
    v.dispose()
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  merged.setIndex(new THREE.BufferAttribute(idx, 1))
  return merged
}

/* ---------- the whole car ---------- */

type Parts = {
  body: THREE.BufferGeometry
  canopy: THREE.BufferGeometry
  lights: { core: THREE.BufferGeometry; halo: THREE.BufferGeometry }[]
  vanes: THREE.BufferGeometry
}

let parts: Parts | null = null

/** The shapes both cars share, worked out once. */
function shared(): Parts {
  if (!parts) {
    parts = {
      body: bodyGeometry(),
      canopy: canopyGeometry(),
      lights: lightLines().map((l) => ({ core: tube(l.points, l.radius, l.closed), halo: tube(l.points, l.radius * 2.8, l.closed) })),
      vanes: vanesGeometry(),
    }
  }
  return parts
}

type Paint = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, hasText?: boolean) => THREE.Texture

/**
 * The car, or with `ghost` its ghost: the same shape seen through in `ghostColor`. `paint` makes the
 * scene's canvas textures (the glows, the shadow, the name), so the scene can let them go with it.
 */
export function buildCar(paint: Paint, ghost: boolean, ghostColor = '#4aa8e8'): CarModel {
  const { body: bodyGeo, canopy: canopyGeo, lights, vanes } = shared()
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const see: THREE.Material[] = []
  // Seen through, and a hair behind your car where the two meet, so it never tints yours.
  const through = ghost ? { transparent: true, opacity: 0.36, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 } : {}
  const std = (params: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ ...params, ...through })
    if (ghost) see.push(m)
    return m
  }
  const glow = ghost ? '#8fd0ff' : '#ff5a0a'

  // Pearl white under a clear coat; the scoops, arches and floor darken it where the body says so.
  const skin = ghost
    ? std({ color: ghostColor, roughness: 0.3, metalness: 0.2 })
    : new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        vertexColors: true,
        roughness: 0.25,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 0.75,
        iridescence: 0.12,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [120, 380],
      })
  body.add(new THREE.Mesh(bodyGeo, skin))

  // Smoked glass, reflecting the sky.
  const glass = ghost
    ? std({ color: ghostColor, roughness: 0.1, metalness: 0.4 })
    : new THREE.MeshPhysicalMaterial({
        color: '#0b1219',
        roughness: 0.04,
        metalness: 0.55,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 1.5,
        transparent: true,
        opacity: 0.72,
      })
  const canopy = new THREE.Mesh(canopyGeo, glass)
  canopy.renderOrder = 1
  body.add(canopy)

  // The light lines: a core lit from within (dark under the light, so the orange stays deep) and a soft halo.
  const core = std({ color: ghost ? ghostColor : '#2a1004', emissive: glow, emissiveIntensity: ghost ? 0.9 : 1.25, roughness: 0.4 })
  const halo = new THREE.MeshBasicMaterial({
    color: ghost ? '#6fbcf2' : '#ff5a0a',
    transparent: true,
    opacity: ghost ? 0.12 : 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  for (const l of lights) {
    body.add(new THREE.Mesh(l.core, core))
    body.add(new THREE.Mesh(l.halo, halo))
  }

  if (!ghost) {
    // The canopy's white frame: a spine over the top and a hoop behind the seats.
    const frame = new THREE.MeshPhysicalMaterial({ color: '#f1ede7', roughness: 0.25, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 })
    const spine: THREE.Vector3[] = []
    for (let k = 0; k <= 30; k++) spine.push(canopyPoint(1.1 - (2.7 * k) / 30, Math.PI / 2, 0.012))
    body.add(new THREE.Mesh(tube(spine, 0.045), frame))
    const hoop: THREE.Vector3[] = []
    for (let k = 0; k <= 24; k++) hoop.push(canopyPoint(-0.95, 0.1 * Math.PI + (0.8 * Math.PI * k) / 24, 0.01))
    body.add(new THREE.Mesh(tube(hoop, 0.04), frame))

    // Inside, seen through the glass: two seats trimmed in orange light, and a lit dash.
    const seat = new THREE.MeshStandardMaterial({ color: '#1d242c', roughness: 0.6 })
    for (const s of [1, -1]) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.34), seat)
      back.position.set(-0.5, 0.8, 0.25 * s)
      back.rotation.z = 0.28
      body.add(back)
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), core)
      edge.position.set(-0.45, 0.98, 0.25 * s)
      body.add(edge)
    }
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.8), core)
    dash.position.set(0.5, 0.78, 0)
    body.add(dash)

    // Blipka's name on the rear deck, read from behind: the lowercase mark with its teal dot on the i.
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
    const at = -2.0
    const slope = Math.atan2(topAt(at + 0.05, 0) - topAt(at - 0.05, 0), 0.1)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.11), new THREE.MeshBasicMaterial({ map: name, transparent: true, depthWrite: false }))
    plate.quaternion
      .setFromAxisAngle(new THREE.Vector3(0, 0, 1), slope)
      .multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0))))
    plate.position.set(at, topAt(at, 0) + 0.006, 0)
    body.add(plate)
  }

  // The wheels: dark tyres with orange turbines for faces, glowing.
  const tyreGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 36)
  tyreGeo.rotateX(Math.PI / 2)
  const tyre = std({ color: ghost ? ghostColor : '#14171b', roughness: 0.85, metalness: 0 })
  const well = std({ color: ghost ? ghostColor : '#0c1014', roughness: 0.5, metalness: 0.3 })
  const vane = std({ color: ghost ? ghostColor : '#3a1606', emissive: glow, emissiveIntensity: ghost ? 0.5 : 0.7, roughness: 0.35, metalness: 0.5 })
  const rimRing = std({ color: ghost ? ghostColor : '#2a1004', emissive: glow, emissiveIntensity: ghost ? 0.8 : 1.4, roughness: 0.3 })
  const hub = std({ color: ghost ? ghostColor : '#f1ede7', roughness: 0.25, metalness: 0.3 })
  const discGeo = new THREE.CircleGeometry(0.34, 36)
  const ringGeo = new THREE.TorusGeometry(0.345, 0.022, 8, 48)
  const innerGeo = new THREE.TorusGeometry(0.115, 0.016, 8, 32)
  const hubGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20)
  hubGeo.rotateX(Math.PI / 2)
  const shine = ghost
    ? null
    : paint(128, 128, (g, w, h) => {
        // A ring of light round the rim, clear in the middle so the turbine shows.
        const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
        grad.addColorStop(0, 'rgba(255,90,10,0)')
        grad.addColorStop(0.5, 'rgba(255,90,10,0.04)')
        grad.addColorStop(0.64, 'rgba(255,90,10,0.34)')
        grad.addColorStop(0.78, 'rgba(255,90,10,0.12)')
        grad.addColorStop(1, 'rgba(255,90,10,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, w, h)
      })
  const shineGeo = new THREE.CircleGeometry(0.56, 32)
  const shineMat = shine ? new THREE.MeshBasicMaterial({ map: shine, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }) : null
  const wheels: THREE.Object3D[] = []
  const steer: THREE.Group[] = []
  WHEELS.forEach(([x, z], k) => {
    const pivot = new THREE.Group()
    pivot.position.set(x, WHEEL_RADIUS, z)
    group.add(pivot)
    const wheel = new THREE.Group()
    pivot.add(wheel)
    wheel.add(new THREE.Mesh(tyreGeo, tyre))
    const out = Math.sign(z)
    const face = new THREE.Group()
    face.position.z = out * (WHEEL_WIDTH / 2)
    if (out < 0) face.rotation.y = Math.PI
    wheel.add(face)
    const disc = new THREE.Mesh(discGeo, well)
    disc.position.z = 0.002
    face.add(disc)
    const turbine = new THREE.Mesh(vanes, vane)
    turbine.position.z = 0.02
    face.add(turbine)
    const ring = new THREE.Mesh(ringGeo, rimRing)
    ring.position.z = 0.02
    face.add(ring)
    const inner = new THREE.Mesh(innerGeo, rimRing)
    inner.position.z = 0.025
    face.add(inner)
    const cap = new THREE.Mesh(hubGeo, hub)
    cap.position.z = 0.03
    face.add(cap)
    if (shineMat) {
      // The glow round the turbine, on the face and not turning with it.
      const glowDisc = new THREE.Mesh(shineGeo, shineMat)
      glowDisc.position.set(x, WHEEL_RADIUS, z + out * (WHEEL_WIDTH / 2 + 0.05))
      if (out < 0) glowDisc.rotation.y = Math.PI
      glowDisc.renderOrder = 2
      group.add(glowDisc)
    }
    wheels.push(wheel)
    if (k < 2) steer.push(pivot)
  })

  if (!ghost) {
    // Orange light on the road under the car, and a soft shadow.
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
  return { group, body, wheels, steer, see }
}
