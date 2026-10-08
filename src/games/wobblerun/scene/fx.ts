import * as THREE from 'three'

/*
 * The puffs and sparkles (design-final §6): dust off the feet, goo splashing up at a splat, sparkles for a close
 * call or a perfect bounce, confetti at the checkpoints and the crown, a firework now and then on Big Show days.
 * Three pools, 300 at most in all (the phone cut list), each drawn in one call. And the landing aids: a soft
 * shadow on whatever is under the bean (wider and fainter the higher it is) and, when nothing is, a bright ring on
 * the goo below.
 */

type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; age: number; r: number; g: number; b: number; drag: number; grav: number; spin: number; sx: number; sy: number }

const SOFT_MOST = 120
const SPARK_MOST = 100
const CONFETTI_MOST = 80

const TMP_C = new THREE.Color()
const M = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const V = new THREE.Vector3()
const S = new THREE.Vector3()

/** One pool of points: positions and colours rewritten each frame for the live ones only. */
class Pool {
  readonly list: P[] = []
  readonly points: THREE.Points
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly additive: boolean
  private readonly most: number
  constructor(most: number, dot: THREE.Texture, size: number, additive: boolean) {
    this.most = most
    this.additive = additive
    this.pos = new Float32Array(most * 3)
    this.col = new Float32Array(most * 4)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage))
    geo.setDrawRange(0, 0)
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: dot,
        size,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    )
    this.points.frustumCulled = false
    this.points.renderOrder = 6
  }

  add(p: Omit<P, 'age'>) {
    if (this.list.length >= this.most) this.list.shift()
    this.list.push({ ...p, age: 0 })
  }

  update(dt: number) {
    const L = this.list
    let n = 0
    for (let i = 0; i < L.length; i++) {
      const p = L[i]!
      p.age += dt
      if (p.age >= p.life) continue
      const d = Math.exp(-p.drag * dt)
      p.vx *= d
      p.vz *= d
      p.vy = p.vy * d - p.grav * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      L[n++] = p
    }
    L.length = n
    for (let i = 0; i < n; i++) {
      const p = L[i]!
      const k = 1 - p.age / p.life
      this.pos[i * 3] = p.x
      this.pos[i * 3 + 1] = p.y
      this.pos[i * 3 + 2] = p.z
      const fade = this.additive ? k : 1
      this.col[i * 4] = p.r * fade
      this.col[i * 4 + 1] = p.g * fade
      this.col[i * 4 + 2] = p.b * fade
      this.col[i * 4 + 3] = this.additive ? 1 : Math.min(1, k * 1.6)
    }
    const geo = this.points.geometry
    geo.setDrawRange(0, n)
    geo.attributes.position!.needsUpdate = true
    geo.attributes.color!.needsUpdate = true
  }
}

export class Fx {
  readonly group = new THREE.Group()
  private readonly soft: Pool
  private readonly spark: Pool
  private readonly confetti: THREE.InstancedMesh
  private readonly bits: P[] = []
  private readonly rnd: () => number
  private calm = false

  constructor(dot: THREE.Texture, rnd: () => number) {
    this.rnd = rnd
    this.soft = new Pool(SOFT_MOST, dot, 0.42, false)
    this.spark = new Pool(SPARK_MOST, dot, 0.34, true)
    this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONFETTI_MOST)
    this.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.confetti.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CONFETTI_MOST * 3), 3)
    this.confetti.count = 0
    this.confetti.frustumCulled = false
    this.group.add(this.soft.points, this.spark.points, this.confetti)
  }

  /** Reduced motion: fewer, gentler bits. */
  setCalm(calm: boolean) {
    this.calm = calm
  }

  private many(n: number) {
    return this.calm ? Math.ceil(n * 0.4) : n
  }

  /** Dust off the ground: a puff of `n` round where it lands or kicks off. */
  dust(x: number, y: number, z: number, n: number, colour: string, spread = 1.6) {
    TMP_C.set(colour)
    for (let i = 0; i < this.many(n); i++) {
      const a = this.rnd() * Math.PI * 2
      const s = spread * (0.5 + this.rnd() * 0.7)
      this.soft.add({ x: x + Math.cos(a) * 0.2, y: y + 0.08, z: z + Math.sin(a) * 0.2, vx: Math.cos(a) * s, vy: 0.6 + this.rnd() * 1.2, vz: Math.sin(a) * s, life: 0.35 + this.rnd() * 0.3, r: TMP_C.r, g: TMP_C.g, b: TMP_C.b, drag: 5, grav: 1.5, spin: 0, sx: 1, sy: 1 })
    }
  }

  /** Goo thrown up where the bean went in. */
  splash(x: number, y: number, z: number, colour: string) {
    TMP_C.set(colour)
    for (let i = 0; i < this.many(34); i++) {
      const a = this.rnd() * Math.PI * 2
      const s = 1 + this.rnd() * 3.2
      const up = 4 + this.rnd() * 6
      const l = 0.75 + this.rnd() * 0.25
      this.soft.add({ x, y, z, vx: Math.cos(a) * s, vy: up, vz: Math.sin(a) * s, life: 0.7 + this.rnd() * 0.5, r: TMP_C.r * l, g: TMP_C.g * l, b: TMP_C.b * l, drag: 0.6, grav: 18, spin: 0, sx: 1, sy: 1 })
    }
  }

  /** A burst of sparkles (a close call, a perfect bounce, a hoop, the crown). */
  sparkle(x: number, y: number, z: number, colour: string, n = 14, speed = 2.6) {
    TMP_C.set(colour)
    for (let i = 0; i < this.many(n); i++) {
      const a = this.rnd() * Math.PI * 2
      const b = (this.rnd() - 0.3) * Math.PI
      const s = speed * (0.4 + this.rnd() * 0.8)
      this.spark.add({ x, y, z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + 0.6, vz: Math.sin(a) * Math.cos(b) * s, life: 0.4 + this.rnd() * 0.4, r: TMP_C.r, g: TMP_C.g, b: TMP_C.b, drag: 3, grav: 1, spin: 0, sx: 1, sy: 1 })
    }
  }

  /** A firework high up: a ring of sparks in one of `colours`. */
  firework(x: number, y: number, z: number, colours: readonly string[]) {
    TMP_C.set(colours[Math.floor(this.rnd() * colours.length)]!)
    const n = this.many(30)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const b = (this.rnd() - 0.5) * 1.6
      const s = 7 + this.rnd() * 2
      this.spark.add({ x, y, z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s, vz: Math.sin(a) * Math.cos(b) * s * 0.4, life: 1.1 + this.rnd() * 0.4, r: TMP_C.r, g: TMP_C.g, b: TMP_C.b, drag: 1.8, grav: 3, spin: 0, sx: 1, sy: 1 })
    }
  }

  /** Confetti thrown up from (x, y, z), toward `dx` across a little, in the party colours. */
  confettiAt(x: number, y: number, z: number, n: number, colours: readonly string[], dx = 0) {
    for (let i = 0; i < this.many(n); i++) {
      if (this.bits.length >= CONFETTI_MOST) this.bits.shift()
      TMP_C.set(colours[Math.floor(this.rnd() * colours.length)]!)
      const a = this.rnd() * Math.PI * 2
      const s = 1 + this.rnd() * 2.4
      this.bits.push({
        x,
        y,
        z,
        vx: Math.cos(a) * s + dx * (2 + this.rnd() * 2),
        vy: 6 + this.rnd() * 5,
        vz: Math.sin(a) * s,
        life: 1.6 + this.rnd() * 0.9,
        age: 0,
        r: TMP_C.r,
        g: TMP_C.g,
        b: TMP_C.b,
        drag: 2.2,
        grav: 9,
        spin: (this.rnd() - 0.5) * 16,
        sx: this.rnd() * 6,
        sy: this.rnd() * 6,
      })
    }
  }

  update(dt: number) {
    if (dt <= 0) return
    this.soft.update(dt)
    this.spark.update(dt)
    // Confetti flutters down: falling slower than it would, turning over.
    const L = this.bits
    let n = 0
    for (let i = 0; i < L.length; i++) {
      const p = L[i]!
      p.age += dt
      if (p.age >= p.life) continue
      const d = Math.exp(-p.drag * dt)
      p.vx *= d
      p.vz *= d
      p.vy = Math.max(-2.2, p.vy * d - p.grav * dt)
      p.x += p.vx * dt + Math.sin(p.age * 5 + p.sx) * 0.4 * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.sx += p.spin * dt
      p.sy += p.spin * 0.7 * dt
      L[n++] = p
    }
    L.length = n
    const k = this.confetti
    for (let i = 0; i < n; i++) {
      const p = L[i]!
      E.set(p.sx, p.sy, p.sx * 0.5)
      Q.setFromEuler(E)
      const s = Math.min(1, (p.life - p.age) * 3)
      S.set(s, s, s)
      M.compose(V.set(p.x, p.y, p.z), Q, S)
      k.setMatrixAt(i, M)
      k.setColorAt(i, TMP_C.setRGB(p.r, p.g, p.b))
    }
    k.count = n
    k.visible = n > 0
    k.instanceMatrix.needsUpdate = true
    if (k.instanceColor) k.instanceColor.needsUpdate = true
  }

  clear() {
    this.soft.list.length = 0
    this.spark.list.length = 0
    this.bits.length = 0
    this.soft.update(1e-6)
    this.spark.update(1e-6)
    this.confetti.count = 0
    this.confetti.visible = false
  }
}

/**
 * The landing aids: a soft dark blob on the surface under the bean, tipped to its slope, wider and fainter the
 * higher the bean is; and a bright ring on the goo when there's nothing under it at all.
 */
export class Shadow {
  readonly blob: THREE.Mesh
  readonly ring: THREE.Mesh
  private readonly blobMat: THREE.MeshBasicMaterial
  private readonly ringMat: THREE.MeshBasicMaterial
  private strength = 0.34
  private readonly n = new THREE.Vector3()

  constructor(dot: THREE.Texture, ring: THREE.Texture) {
    const plane = new THREE.PlaneGeometry(1, 1)
    plane.rotateX(-Math.PI / 2)
    this.blobMat = new THREE.MeshBasicMaterial({ map: dot, color: '#1a1030', transparent: true, opacity: 0.34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })
    this.blob = new THREE.Mesh(plane, this.blobMat)
    this.blob.renderOrder = 2
    this.ringMat = new THREE.MeshBasicMaterial({ map: ring, color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })
    this.ring = new THREE.Mesh(plane.clone(), this.ringMat)
    this.ring.renderOrder = 2
    this.blob.visible = this.ring.visible = false
  }

  setStrength(opacity: number) {
    this.strength = opacity
  }

  /** On a surface at `y` sloping `gx`, `gz` (rise a metre), the bean `high` m above it. */
  onSurface(x: number, y: number, z: number, gx: number, gz: number, high: number) {
    const h = Math.max(0, high)
    const size = 1.15 + Math.min(4, h) * 0.24
    this.blob.position.set(x, y + 0.03, z)
    this.n.set(-gx, 1, -gz).normalize()
    this.blob.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, this.n)
    this.blob.scale.set(size, 1, size)
    this.blobMat.opacity = this.strength / (1 + h * 0.45)
    this.blob.visible = true
    this.ring.visible = false
  }

  /** Over nothing: the ring on the goo at `gooY`, the bean `high` above it. */
  overGoo(x: number, gooY: number, z: number, high: number, colour: string, clock: number) {
    this.blob.visible = false
    const size = 1.3 + Math.min(10, Math.max(0, high)) * 0.08
    const pulse = 1 + 0.06 * Math.sin(clock * 9)
    this.ring.position.set(x, gooY + 0.05, z)
    this.ring.scale.set(size * pulse, 1, size * pulse)
    this.ringMat.color.set(colour)
    this.ringMat.opacity = 0.95
    this.ring.visible = true
  }

  hide() {
    this.blob.visible = this.ring.visible = false
  }
}
