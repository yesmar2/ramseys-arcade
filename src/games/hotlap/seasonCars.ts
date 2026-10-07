/*
 * The season cars with bodies of their own (lib/skins.ts): Ramsey, 2026-10-06, "the race cars shouldn't just be
 * rockets again with different colors, they need to be unique to the season". He picked them from the "Hot Lap
 * season cars" canvas: Space Race's Moon buggy and Shuttle car beside its Rocket car (car.ts), and Cold Snap's
 * Bobsled, Crystal car and Aurora glider.
 *
 * Each stands on the Indy car's wheels (car.ts WHEELS, FORMULA) and drives the same (sim.ts), so a lap in one counts
 * the same. Built from plain shapes, each set to its place, then everything sharing a material merged into one
 * mesh, so a car draws in a few calls. x forward, y up, z across, as the scene poses it.
 *
 * With `ghost`, the same car seen through in its own colours, its edges in lines of its glow: the ghost of a lap
 * driven in it, as a Rocket car's ghost is.
 */
import * as THREE from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'
import { addUnderGlow, addWheels, FORMULA, merge, shapesOf, SKIN_GHOST_MORE, WHEELS, type CarModel, type Paint } from './car'

type V3 = [number, number, number]
type Section = { w: number; h: number; hb?: number; cy: number; e?: number }

const R = FORMULA.wheel.r
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}
const signedPow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e

/** Sets a shape in its place: turned by `rot` (x, y, z), then moved to `at`. */
function place(geo: THREE.BufferGeometry, at: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) {
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)))
  return geo
}

const box = (size: V3, at: V3, rot?: V3) => place(new THREE.BoxGeometry(...size), at, rot)

/** A side profile, [x, y] points, made solid `depth` through, centred on `z`. */
function side(points: [number, number][], depth: number, z = 0) {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: false })
  return geo.translate(0, 0, z - depth / 2)
}

/** A plan, [x, z] points, stood `h` up from `y`. */
function plan(points: [number, number][], y: number, h: number) {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: h, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)
  return geo.translate(0, y, 0)
}

/** A rod from a to b. */
function rod(a: V3, b: V3, r: number) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const geo = new THREE.CylinderGeometry(r, r, A.distanceTo(B), 10)
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()))
  return geo.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2)
}

/**
 * A smooth body along x: at each x, `f` gives half its width, its half height over (`h`) and under (`hb`) its middle
 * `cy`, and `e` (1 round, under 1 squarer). `arc` keeps only the angles round it between two (an open shell); without
 * it the ends are closed.
 */
function loft(x0: number, x1: number, f: (x: number) => Section, opts: { arc?: [number, number]; n?: number; around?: number } = {}) {
  const n = opts.n ?? 110
  const around = opts.around ?? 44
  const arc = opts.arc
  const count = arc ? around + 1 : around
  const rows: V3[][] = []
  const ring = (x: number, s: number) => {
    const p = f(x)
    const e = p.e ?? 1
    const out: V3[] = []
    for (let k = 0; k < count; k++) {
      const a = arc ? arc[0] + ((arc[1] - arc[0]) * k) / around : (k / around) * Math.PI * 2
      const sy = Math.sin(a)
      const hh = sy >= 0 ? p.h : (p.hb ?? p.h)
      out.push([x, p.cy + signedPow(sy, e) * hh * s, signedPow(Math.cos(a), e) * p.w * s])
    }
    return out
  }
  if (!arc) rows.push(ring(x0, 0))
  for (let i = 0; i <= n; i++) rows.push(ring(x0 + ((x1 - x0) * i) / n, 1))
  if (!arc) rows.push(ring(x1, 0))
  const pos: number[] = []
  const idx: number[] = []
  for (const r of rows) for (const p of r) pos.push(...p)
  const span = arc ? count - 1 : count
  for (let i = 0; i < rows.length - 1; i++)
    for (let k = 0; k < span; k++) {
      const a = i * count + k
      const b = i * count + ((k + 1) % count)
      idx.push(a, a + count, b, b, a + count, b + count)
    }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** Half an ellipsoid, flat side down: a bubble over a driver. */
function bubble(at: V3, size: V3) {
  const geo = new THREE.SphereGeometry(1, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2)
  geo.scale(...size)
  return geo.translate(...at)
}

/** One line mesh's worth of many edge sets. */
function mergeLines(parts: THREE.BufferGeometry[]) {
  const count = parts.reduce((s, g) => s + g.attributes.position!.count, 0)
  const pos = new Float32Array(count * 3)
  let at = 0
  for (const g of parts) {
    pos.set(g.attributes.position!.array as Float32Array, at * 3)
    at += g.attributes.position!.count
    g.dispose()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return geo
}

/**
 * What a car is built with: its materials (seen through on a ghost), and its shapes gathered by material, merged
 * into one mesh each when it's done. A ghost's shapes leave their edges as lines of its glow.
 */
class Kit {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  readonly see: THREE.Material[] = []
  readonly lines: THREE.Material[] = []
  readonly outline: THREE.LineBasicMaterial | null
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>()
  private readonly edges: THREE.BufferGeometry[] = []
  private readonly through: THREE.MaterialParameters
  readonly ghost: boolean

  constructor(ghost: boolean, glow: string) {
    this.ghost = ghost
    this.group.add(this.body)
    // Seen through, and a hair behind your car where the two meet, as the other ghosts are.
    this.through = ghost ? { transparent: true, opacity: 0.36, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 } : {}
    this.outline = ghost ? new THREE.LineBasicMaterial({ color: glow, transparent: true, opacity: 0.9, depthWrite: false }) : null
    if (this.outline) this.lines.push(this.outline)
  }

  /** A plain material; on a ghost, seen through. */
  std = (params: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...params, ...this.through })
    if (this.ghost) this.see.push(m)
    return m
  }
  paint = (color: string, roughness = 0.45, metalness = 0.1) => this.std({ color, roughness, metalness })
  metal = (color: string, roughness = 0.3) => this.std({ color, roughness, metalness: 0.85 })
  /** A clear-coated paint; a ghost's is plain. */
  gloss = (color: string, metalness = 0.08) =>
    this.ghost ? this.std({ color, roughness: 0.3, metalness }) : new THREE.MeshPhysicalMaterial({ color, roughness: 0.26, metalness, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide })
  glow = (color: string, k = 1.6) => this.std({ color: '#111111', emissive: color, emissiveIntensity: k })
  glass = () =>
    this.ghost
      ? this.std({ color: '#0b1219', roughness: 0.1, metalness: 0.4 })
      : new THREE.MeshPhysicalMaterial({ color: '#0b1219', roughness: 0.05, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, side: THREE.DoubleSide })

  /** A shape, in place, in a material; on a ghost its edges in light unless `edges` is false. */
  add(geo: THREE.BufferGeometry, m: THREE.Material, edges = true) {
    if (this.outline && edges) this.edges.push(new THREE.EdgesGeometry(geo, 28))
    const list = this.parts.get(m)
    if (list) list.push(geo)
    else this.parts.set(m, [geo])
  }

  /** A mesh of its own, not merged (one with a texture). */
  mesh(geo: THREE.BufferGeometry, m: THREE.Material) {
    const o = new THREE.Mesh(geo, m)
    this.body.add(o)
    return o
  }

  /** The car, done: its shapes merged, its wheels on, the light under it. */
  done(paint: Paint, rim: string, under: string, flame?: THREE.Object3D, wheelDress?: THREE.BufferGeometry, wheelDressMat?: THREE.Material): CarModel {
    for (const [m, geos] of this.parts) this.body.add(new THREE.Mesh(merge(geos), m))
    if (this.outline && this.edges.length) this.body.add(new THREE.LineSegments(mergeLines(this.edges), this.outline))
    const { wheels, steer } = addWheels(this.group, shapesOf(FORMULA), FORMULA, this.std, null, rim, this.outline)
    if (wheelDress && wheelDressMat) for (const w of wheels) w.add(new THREE.Mesh(wheelDress, wheelDressMat))
    if (!this.ghost) addUnderGlow(this.group, paint, under)
    if (flame) this.body.add(flame)
    return { group: this.group, body: this.body, wheels, steer, see: this.see, lines: this.lines, ...(this.ghost ? { seeMore: SKIN_GHOST_MORE } : { ...(flame ? { flame } : {}) }) }
  }
}

/** Arms from the body out to each wheel, as the Indy and Rocket cars have. */
function arms(k: Kit, half: number, m: THREE.Material) {
  for (const [x, z] of WHEELS)
    for (const dy of [-0.06, 0.08]) k.add(rod([x + (x > 0 ? -0.1 : 0.1), R + dy, Math.sign(z) * half], [x, R + dy * 0.5, z * 0.82], 0.022), m, false)
}

/** A nozzle pointing back from (x, y, z), its throat lit. */
function nozzle(k: Kit, at: V3, r: number, trim: THREE.Material, light: THREE.Material) {
  const n = new THREE.CylinderGeometry(r * 0.75, r, 0.24, 24, 1, true)
  n.rotateZ(-Math.PI / 2)
  k.add(n.translate(...at), trim)
  const t = new THREE.CircleGeometry(r * 0.74, 24)
  t.rotateY(-Math.PI / 2)
  k.add(t.translate(at[0] + 0.06, at[1], at[2]), light, false)
}

/**
 * Flames out of nozzles, in one group the scene stretches as the car pulls (CarModel.flame): `at` is where the group
 * sits, `spots` each flame's place from there (y, z). Pointing back along -x, so stretching it stretches them back.
 */
function flames(at: V3, spots: [number, number][], colors: readonly [string, string], r: number) {
  const group = new THREE.Group()
  group.position.set(...at)
  for (const [y, z] of spots)
    for (const [rr, len, color, opacity] of [
      [r, 1, colors[0], 0.7],
      [r * 0.55, 0.62, colors[1], 0.9],
    ] as const) {
      const cone = new THREE.ConeGeometry(rr, len, 20, 1, true)
      cone.translate(0, len / 2, 0)
      cone.rotateZ(Math.PI / 2)
      const mesh = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
      mesh.position.set(0, y, z)
      group.add(mesh)
    }
  return group
}

/* ---------- Season 1 · Space Race ---------- */

/** Moon buggy (Space Race's Pass+): an open lunar rover: flat fenders, two seats under a roll hoop, a gold-foil box, a dish. */
function moonBuggy(paint: Paint, ghost: boolean): CarModel {
  const k = new Kit(ghost, '#f5b942')
  const navy = k.gloss('#141a4a')
  const amber = k.paint('#f5b942')
  const seat = k.paint('#2a2f6e')
  const frame = k.metal('#c9ced6')
  const foil = k.std({ color: '#f2c14e', roughness: 0.38, metalness: 0.65 })
  const dish = k.metal('#e8ebef', 0.25)
  // The deck and its rails.
  k.add(box([3.9, 0.07, 1.08], [-0.05, 0.52, 0]), navy)
  for (const z of [0.56, -0.56]) k.add(rod([-2.0, 0.6, z], [2.05, 0.6, z], 0.035), frame)
  // Flat fenders over the wheels, a top and a slope each way: no humps.
  for (const [x, z] of WHEELS) {
    k.add(box([0.46, 0.03, 0.4], [x, 0.86, z]), amber)
    for (const s of [-1, 1]) k.add(box([0.3, 0.03, 0.4], [x + s * 0.34, 0.77, z], [0, 0, -s * 0.62]), amber)
    k.add(rod([x, 0.6, Math.sign(z) * 0.56], [x, 0.86, z * 0.86], 0.025), frame, false)
  }
  // Two seats, the roll hoop over them, the console between the seats and the front.
  for (const z of [0.26, -0.26]) {
    k.add(box([0.42, 0.08, 0.38], [-0.15, 0.6, z]), seat)
    k.add(box([0.08, 0.5, 0.38], [-0.38, 0.84, z], [0, 0, 0.18]), seat)
  }
  for (const z of [0.52, -0.52]) {
    k.add(rod([-0.55, 0.56, z], [-0.55, 1.3, z * 0.85], 0.03), frame, false)
    k.add(rod([0.45, 0.56, z], [0.25, 1.15, z * 0.85], 0.03), frame, false)
  }
  k.add(rod([-0.55, 1.3, 0.44], [-0.55, 1.3, -0.44], 0.03), frame, false)
  k.add(box([0.32, 0.36, 0.5], [0.35, 0.73, 0]), navy)
  k.add(box([0.33, 0.06, 0.52], [0.35, 0.9, 0]), amber)
  // The gold-foil box behind, the battery box ahead.
  k.add(box([0.95, 0.44, 0.98], [-1.55, 0.78, 0]), foil)
  k.add(box([0.75, 0.3, 0.86], [1.62, 0.7, 0]), navy)
  k.add(box([0.77, 0.05, 0.88], [1.62, 0.86, 0]), amber)
  // The dish on its mast, tipped back; a camera on a mast at the front, its eye lit.
  k.add(rod([-1.25, 1.0, -0.3], [-1.25, 1.78, -0.3], 0.025), frame, false)
  const bowl: THREE.Vector2[] = []
  for (let i = 0; i <= 10; i++) {
    const r = (i / 10) * 0.42
    bowl.push(new THREE.Vector2(r, r * r * 0.9))
  }
  k.add(place(new THREE.LatheGeometry(bowl, 32), [-1.25, 1.78, -0.3], [0, 0, 0.75]), dish)
  k.add(rod([-1.25, 1.78, -0.3], [-1.05, 1.98, -0.3], 0.015), frame, false)
  k.add(rod([1.75, 0.86, 0.3], [1.75, 1.32, 0.3], 0.025), frame, false)
  k.add(box([0.2, 0.14, 0.26], [1.78, 1.38, 0.3]), navy)
  k.add(place(new THREE.CircleGeometry(0.05, 16), [1.885, 1.38, 0.3], [0, Math.PI / 2, 0]), k.glow('#9a7bff', 2), false)
  // A violet pennant on a whip.
  k.add(rod([-1.95, 0.6, 0.45], [-1.95, 1.7, 0.45], 0.012), frame, false)
  k.add(side([[-1.95, 1.7], [-1.95, 1.48], [-2.4, 1.6]], 0.01, 0.45), k.paint('#9a7bff'))
  // Silver cleats round each tyre: a rover's wire wheels.
  const cleats: THREE.BufferGeometry[] = []
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    cleats.push(box([0.05, 0.03, FORMULA.wheel.width * 0.92], [Math.cos(a) * (R + 0.01), Math.sin(a) * (R + 0.01), 0], [0, 0, a]))
  }
  return k.done(paint, '#f5b942', '245,185,66', undefined, merge(cleats), k.metal('#b8bfc8', 0.4))
}

/** Shuttle car (Space Race's Pass+): a space shuttle on wheels: delta wings, black belly and nose, a tall tail, three engines. */
function shuttleCar(paint: Paint, ghost: boolean): CarModel {
  const k = new Kit(ghost, '#ffd27a')
  const white = k.gloss('#f3f1ea')
  const black = k.paint('#16171d', 0.7)
  const orange = k.gloss('#f07c16')
  const f = (x: number): Section => {
    const n = smooth((x - 1.3) / 1.35)
    const t = smooth((-x - 2.0) / 0.25)
    return { w: lerp(0.44, 0.02, n * n) - t * 0.02, h: lerp(0.42, 0.06, n), hb: lerp(0.36, 0.1, n), cy: lerp(0.78, 0.72, n), e: 0.82 }
  }
  // White over, black under, and a black nose cap.
  k.add(loft(-2.25, 2.65, f, { arc: [-0.12, Math.PI + 0.12] }), white, false)
  k.add(loft(-2.25, 2.65, (x) => ({ ...f(x), w: f(x).w * 0.995 }), { arc: [Math.PI + 0.1, 2 * Math.PI - 0.1] }), black, false)
  k.add(loft(2.2, 2.66, (x) => ({ ...f(x), w: f(x).w * 1.01, h: f(x).h * 1.01, hb: (f(x).hb ?? 0) * 1.01 }), { n: 20 }), black, false)
  // Delta wings, black under and white over, edged in orange.
  const wing: [number, number][] = [[1.3, 0.38], [-1.75, 1.32], [-2.18, 1.32], [-2.18, -1.32], [-1.75, -1.32], [1.3, -0.38]]
  k.add(plan(wing, 0.76, 0.05), black)
  k.add(plan(wing.map(([x, z]) => [x - 0.04, z * 0.97]), 0.81, 0.012), white, false)
  for (const s of [1, -1]) k.add(rod([1.3, 0.81, s * 0.38], [-1.75, 0.81, s * 1.32], 0.018), orange, false)
  // The tail and its orange cap.
  k.add(side([[-1.35, 1.12], [-2.2, 1.12], [-2.38, 2.0], [-2.08, 2.0]], 0.06), white)
  k.add(side([[-2.08, 2.0], [-2.38, 2.0], [-2.36, 1.9], [-2.1, 1.9]], 0.07), orange, false)
  // The payload bay's seams in orange; the cockpit's windows.
  for (const s of [1, -1]) k.add(rod([-1.9, 1.17, s * 0.2], [1.0, 1.17, s * 0.2], 0.015), orange, false)
  const glass = k.glass()
  for (let i = -2; i <= 2; i++) k.add(box([0.12, 0.08, 0.13], [1.72, 1.07 - Math.abs(i) * 0.03, i * 0.14], [0, 0, -0.5]), glass, false)
  // Three engines, one high and two low, and their flames.
  const trim = k.metal('#3a3d44')
  const light = k.glow('#ffd27a', 1.8)
  const spots: [number, number][] = [
    [0.98, 0],
    [0.62, 0.22],
    [0.62, -0.22],
  ]
  for (const [y, z] of spots) nozzle(k, [-2.38, y, z], 0.15, trim, light)
  const flame = ghost ? undefined : flames([-2.46, 0.78, 0], spots.map(([y, z]) => [y - 0.78, z]), ['#ffcf5a', '#fff3c4'], 0.14)
  return k.done(paint, '#ffd27a', '255,190,90', flame)
}

/* ---------- Season 2 · Cold Snap ---------- */

/** Bobsled (Cold Snap's free car): a low sled shell, an open seat with a helmet in it, steel runners and push bars. */
function bobsled(paint: Paint, ghost: boolean): CarModel {
  const k = new Kit(ghost, '#5cf2b0')
  const shell = k.gloss('#eef7ff')
  const teal = k.gloss('#33c6d6')
  const navy = k.gloss('#13284a')
  const steel = k.metal('#d8dde5')
  const f = (x: number): Section => {
    const n = smooth((x - 1.0) / 1.85)
    return { w: lerp(0.56, 0.08, n * n), h: lerp(0.3, 0.07, n), hb: lerp(0.24, 0.1, n), cy: lerp(0.6, 0.5, n), e: 0.7 }
  }
  // Closed ahead of the seat, open-topped behind it, a navy floor in the open part.
  k.add(loft(-0.15, 2.85, f), shell, false)
  k.add(loft(-2.25, -0.15, f, { arc: [0.34 * Math.PI, 2.66 * Math.PI], n: 40 }), shell, false)
  k.add(plan([[-2.2, 0.48], [-0.2, 0.48], [-0.2, -0.48], [-2.2, -0.48]], 0.52, 0.02), navy, false)
  // The tail's wall, the teal band round the nose, a stripe down each side.
  k.add(side([[-2.25, 0.36], [-2.2, 0.36], [-2.2, 0.86], [-2.25, 0.86]], 1.08), navy)
  k.add(loft(1.35, 1.55, (x) => ({ ...f(x), w: f(x).w * 1.015, h: f(x).h * 1.015, hb: (f(x).hb ?? 0) * 1.015 }), { n: 8 }), teal, false)
  for (const s of [1, -1]) k.add(rod([-2.2, 0.62, s * 0.565], [1.2, 0.62, s * 0.5], 0.025), teal, false)
  // The driver's helmet and visor.
  k.add(new THREE.SphereGeometry(0.19, 28, 14).translate(-0.55, 0.92, 0), teal, false)
  const visor = new THREE.SphereGeometry(0.195, 28, 14, -0.9, 1.8, 1.1, 0.6)
  visor.rotateY(Math.PI / 2)
  k.add(visor.translate(-0.55, 0.92, 0), k.glass(), false)
  // A push bar each side at the back, steel runners under it turned up at the front.
  for (const s of [1, -1]) {
    k.add(rod([-2.0, 0.8, s * 0.5], [-2.55, 0.95, s * 0.5], 0.025), steel, false)
    k.add(rod([-2.55, 0.95, s * 0.5], [-2.55, 0.95, s * 0.36], 0.025), steel, false)
    k.add(side([[-2.0, 0.27], [1.9, 0.27], [2.25, 0.4], [2.2, 0.43], [1.88, 0.31], [-2.0, 0.31]], 0.035, s * 0.36), steel)
  }
  // Its number, 2, on each flank.
  if (!ghost) {
    const number = paint(128, 128, (g, w, h) => {
      g.fillStyle = '#eef7ff'
      g.beginPath()
      g.arc(w / 2, h / 2, 60, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#13284a'
      g.font = 'bold 84px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('2', w / 2, h / 2 + 4)
    }, true)
    const plate = new THREE.MeshStandardMaterial({ map: number, transparent: true, side: THREE.DoubleSide })
    for (const s of [1, -1]) k.mesh(place(new THREE.CircleGeometry(0.15, 28), [0.6, 0.6, s * 0.572], [0, s < 0 ? Math.PI : 0, 0]), plate)
  }
  arms(k, 0.4, navy)
  return k.done(paint, '#5cf2b0', '92,242,176')
}

/** Crystal car (Cold Snap's Pass+): a car cut from ice, see-through, its facets edged in light, a green glow at its heart. */
function crystalCar(paint: Paint, ghost: boolean): CarModel {
  const k = new Kit(ghost, '#9fe8ff')
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const ice = ghost
    ? k.std({ color: '#cdeeff', roughness: 0.1, metalness: 0.05 })
    : new THREE.MeshPhysicalMaterial({ color: '#cdeeff', roughness: 0.06, metalness: 0.05, transparent: true, opacity: 0.62, flatShading: true, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2 })
  // Its facets' edges in light: part of the look, not just a ghost's.
  const rim = new THREE.LineBasicMaterial({ color: '#f2fdff', transparent: true, opacity: ghost ? 0.9 : 0.95, depthWrite: false })
  if (ghost) k.lines.push(rim)
  const facets: THREE.BufferGeometry[] = []
  const shards: THREE.BufferGeometry[] = []
  const shard = (points: THREE.Vector3[]) => {
    const geo = new ConvexGeometry(points)
    facets.push(new THREE.EdgesGeometry(geo, 10))
    shards.push(geo)
  }
  shard([
    v(2.9, 0.42, 0), v(2.2, 0.62, 0.22), v(2.2, 0.62, -0.22), v(2.2, 0.32, 0.3), v(2.2, 0.32, -0.3),
    v(0.6, 0.98, 0), v(0.9, 0.74, 0.56), v(0.9, 0.74, -0.56), v(0.6, 0.3, 0.6), v(0.6, 0.3, -0.6),
    v(-0.8, 1.12, 0.15), v(-0.8, 1.12, -0.15), v(-1.0, 0.86, 0.62), v(-1.0, 0.86, -0.62), v(-1.0, 0.3, 0.6), v(-1.0, 0.3, -0.6),
    v(-2.3, 0.95, 0.32), v(-2.3, 0.95, -0.32), v(-2.4, 0.4, 0.44), v(-2.4, 0.4, -0.44),
  ])
  // Crystals growing out of its back, and one off each flank.
  shard([v(-1.0, 1.0, 0.1), v(-1.6, 1.0, 0.1), v(-1.3, 1.0, -0.2), v(-1.7, 1.85, -0.05)])
  shard([v(-1.6, 0.95, 0.25), v(-2.2, 0.95, 0.25), v(-1.9, 0.95, 0.0), v(-2.3, 1.55, 0.18)])
  shard([v(-1.6, 0.95, -0.25), v(-2.2, 0.95, -0.25), v(-1.9, 0.95, 0.0), v(-2.25, 1.45, -0.22)])
  for (const s of [1, -1]) shard([v(0.4, 0.55, s * 0.55), v(-0.4, 0.55, s * 0.55), v(0.0, 0.8, s * 0.5), v(-0.5, 0.75, s * 0.95)])
  // Its heart first, so it shows through the ice.
  const heart = new ConvexGeometry([v(1.6, 0.55, 0), v(0.2, 0.8, 0), v(0.2, 0.45, 0.25), v(0.2, 0.45, -0.25), v(-1.6, 0.7, 0), v(-0.6, 0.5, 0.25), v(-0.6, 0.5, -0.25), v(-0.4, 0.95, 0)])
  k.add(heart, k.glow('#5cf2b0', 1.3), false)
  const body = k.mesh(merge(shards), ice)
  body.renderOrder = 1
  k.body.add(new THREE.LineSegments(mergeLines(facets), rim))
  arms(k, 0.5, k.metal('#c9ced6'))
  return k.done(paint, '#46e4ff', '70,228,255')
}

/** Aurora glider (Cold Snap's Pass+): a slim dark dart, two ribbons of aurora streaming off its back, green into violet. */
function auroraGlider(paint: Paint, ghost: boolean): CarModel {
  const k = new Kit(ghost, '#5cf2b0')
  const navy = k.gloss('#0f2a44', 0.3)
  const violet = k.gloss('#9b7bff')
  const f = (x: number): Section => {
    const n = smooth((x + 0.6) / 3.5)
    const t = smooth((-x - 1.4) / 0.95)
    return { w: lerp(0.46, 0.04, n) - t * 0.14, h: lerp(0.27, 0.06, n) - t * 0.06, hb: lerp(0.2, 0.09, n), cy: lerp(0.58, 0.46, n), e: 0.75 }
  }
  k.add(loft(-2.35, 2.95, f), navy, false)
  // A green line nose to tail, the bubble over the driver.
  k.add(loft(-2.3, 2.7, (x) => {
    const p = f(x)
    return { w: Math.min(0.05, p.w * 0.4), h: 0.012, cy: p.cy + p.h - 0.005 }
  }, { around: 12 }), k.glow('#5cf2b0', 1.4), false)
  k.add(bubble([-0.3, 0.83, 0], [0.78, 0.28, 0.29]), k.glass(), false)
  // The ribbons: strips that rise and wave, green at the root into violet, fading at the top.
  const sheen = paint(256, 64, (g, w, h) => {
    const along = g.createLinearGradient(0, 0, w, 0)
    along.addColorStop(0, '#5cf2b0')
    along.addColorStop(0.55, '#46e4ff')
    along.addColorStop(1, '#9b7bff')
    g.fillStyle = along
    g.fillRect(0, 0, w, h)
    const fade = g.createLinearGradient(0, 0, 0, h)
    fade.addColorStop(0, 'rgba(0,0,0,0)')
    fade.addColorStop(0.15, 'rgba(0,0,0,0)')
    fade.addColorStop(1, 'rgba(0,0,0,1)')
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = fade
    g.fillRect(0, 0, w, h)
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = 'rgba(255,255,255,0.18)'
    for (let i = 0; i < 18; i++) g.fillRect(i * 14, h * 0.5, 2, h * 0.5)
  })
  const ribbon = new THREE.MeshBasicMaterial({ map: sheen, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, opacity: ghost ? 0.36 : 1 })
  if (ghost) k.see.push(ribbon)
  for (const s of [1, -1]) {
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const N = 36
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const x = lerp(-0.2, -3.0, t)
      const base = 0.62 + t * 0.55
      const z = s * (0.24 + t * 0.5 + Math.sin(t * Math.PI * 2.2) * 0.12)
      const tall = lerp(0.18, 0.7, Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.5))
      pos.push(x, base, z, x, base + tall, z + s * 0.08)
      uv.push(t, 1, t, 0)
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    geo.setIndex(idx)
    k.mesh(geo, ribbon).renderOrder = 2
    // Its root: a violet fin on the body.
    k.add(side([[-0.1, 0.7], [-1.0, 0.7], [-1.4, 1.05], [-1.0, 1.05]], 0.03, s * 0.24), violet)
  }
  // A violet wing low across the nose, a plate at each end.
  k.add(box([0.32, 0.035, 1.9], [2.55, 0.2, 0]), violet)
  for (const s of [1, -1]) k.add(box([0.36, 0.16, 0.03], [2.55, 0.26, s * 0.95]), violet)
  nozzle(k, [-2.42, 0.5, 0], 0.17, k.metal('#9b7bff'), k.glow('#5cf2b0', 1.8))
  arms(k, 0.36, navy)
  const flame = ghost ? undefined : flames([-2.5, 0.5, 0], [[0, 0]], ['#9b7bff', '#d8fff2'], 0.16)
  return k.done(paint, '#5cf2b0', '92,242,176', flame)
}

/** Hot Lap's skins with bodies of their own, by skin id (lib/skins.ts). */
export const SEASON_CARS: Record<string, (paint: Paint, ghost: boolean) => CarModel> = {
  'hotlap-midnight': moonBuggy,
  'hotlap-sunracer': shuttleCar,
  'hotlap-ice-rocket': bobsled,
  'hotlap-whiteout': crystalCar,
  'hotlap-borealis': auroraGlider,
}
