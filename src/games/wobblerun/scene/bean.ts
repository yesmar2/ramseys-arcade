import * as THREE from 'three'
import { bake, merge, paint } from './geo.ts'
import { BLIP, CODE, mix } from './look.ts'

/*
 * Blip, the runner: the site's blip grown feet. A round mint body with a deeper band round its foot, two tall dark
 * eyes with glints, pink cheeks and a small smile on its front, two round feet, no arms, and its spark (the blip)
 * glowing over its head; drawn with a matcap (a painted light, so it shines without lamps). The engine's runner is a
 * capsule that never turns over; everything here is looks only (design-final §6), and Blip is drawn over the
 * capsule's footprint: as wide as the old runner with its arms out, as tall with its spark. It hops as it runs,
 * stretches tall as it jumps and squashes as it lands, leans into its speed on a spring with its face a beat behind,
 * paddles its feet in the air, tumbles head over heels when something knocks it, goes belly first in a dive and a
 * belly slide, slides its face round its body to watch the nearest hazard, drops in inside a bubble, and holds the
 * Blip star over its head once it has it (the spark at the star's heart).
 *
 * Ghosts are the same Blip, simpler and seen through: the blue blip, someone else's run (cyan), your own best
 * (amber), or a run's skin, lighter (none yet).
 *
 * (Inside the code the runner is still "the bean" and the star "the crown": the engine's names.)
 */

/** What a skin dresses Blip in. Skins are costumes, never a speed or a size; none exist yet. */
export type BeanLook = { body: string; shade: string; feet: string; glow: string }

const MINT_LOOK: BeanLook = { body: BLIP.body, shade: BLIP.shade, feet: BLIP.feet, glow: BLIP.glow }
/** 'wobblerun-<id>': its look, added per skin (never blue: the blue blip is the one you race). */
const LOOKS: Record<string, BeanLook> = {}

/** A skin's look; mint Blip for none, or for a skin this game doesn't know (an old device copy, the API). */
export function beanLook(skin: string | null | undefined): BeanLook {
  return (skin && LOOKS[skin]) || MINT_LOOK
}

/** Blip's body: an ellipsoid this far across (radius) and up (radius), m. */
const BR = 0.54
const BRY = 0.52
/** Its feet: half sizes across, up and along, and how far out from its middle. */
const FX = 0.13
const FY = 0.075
const FZ = 0.17
const FOOT_OUT = 0.18
/** Its middle, where it turns about: its body's foot passes through its feet's middles, as on the canvas. */
const MID = FY + BRY
/** The spark, this far over its middle (the canvas: 1.26 of its radius). */
const SPARK_UP = 1.26 * BR
/** The band's top edge, this far down from its middle (a fraction of its height). */
const BAND = 0.45
/** A dive's tip forward, radians: belly first, near flat. */
const DIVE_TIP = 1.3

const K = 140
/** Damping for a damping ratio of 0.35 at k 140: wobbly, settling in about half a second. */
const C = 2 * 0.35 * Math.sqrt(K)

/** A damped spring toward 0 (or a target), stepped in small pieces so a long frame can't blow it up. */
class Spring {
  x = 0
  v = 0
  step(dt: number, target = 0) {
    let left = Math.min(dt, 0.1)
    while (left > 1e-6) {
      const h = Math.min(left, 1 / 120)
      const a = -K * (this.x - target) - C * this.v
      this.v += a * h
      this.x += this.v * h
      left -= h
    }
  }
}

const Z_AXIS = new THREE.Vector3(0, 0, 1)
const PT = new THREE.Vector3()
const NR = new THREE.Vector3()
const QT = new THREE.Quaternion()

/** The point on the front of Blip's body at (x, y) from its middle, and the way out of it there. */
function onBody(x: number, y: number, out: THREE.Vector3, n: THREE.Vector3) {
  const z = BR * Math.sqrt(Math.max(0, 1 - (x / BR) ** 2 - (y / BRY) ** 2))
  out.set(x, y, z)
  n.set(x / (BR * BR), y / (BRY * BRY), z / (BR * BR)).normalize()
}

/** A shape made facing +z, laid on the body at (x, y), `lift` out from its surface. */
function decal(geo: THREE.BufferGeometry, x: number, y: number, lift: number): THREE.BufferGeometry {
  onBody(x, y, PT, NR)
  geo.applyQuaternion(QT.setFromUnitVectors(Z_AXIS, NR))
  geo.translate(PT.x + NR.x * lift, PT.y + NR.y * lift, PT.z + NR.z * lift)
  return geo
}

/** The canvas's face, in units of its body's radius (70 there), across and up from the middle. */
const EYE_X = 18 / 70
const EYE_Y = 2 / 70
const CHEEK_X = 34 / 70
const CHEEK_Y = -18 / 70

/** Blip's body, the part over its band and the band round its foot (the canvas's deeper crescent). */
function bodyGeometries(seg = 32): { top: THREE.BufferGeometry; band: THREE.BufferGeometry } {
  const edge = Math.acos(-BAND)
  const top = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.45), 0, Math.PI * 2, 0, edge)
  const band = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.22), 0, Math.PI * 2, edge, Math.PI - edge)
  top.scale(BR, BRY, BR)
  band.scale(BR, BRY, BR)
  return { top, band }
}

/** One foot, its middle at 0. */
function footGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 14, 10)
  g.scale(FX, FY, FZ)
  return g
}

/**
 * Blip's face, one mesh: its cheeks first (recoloured per look), the smile, then the eyes and their glints, with a
 * second set of places for the eyes shut (a blink: each eye squashed to a line, its glint gone).
 */
function faceGeometry(): { geo: THREE.BufferGeometry; cheeks: number; eyes: number; shut: Float32Array } {
  const ink = new THREE.Color(BLIP.ink)
  const parts: THREE.BufferGeometry[] = []
  // The cheeks, baked white (their shading only); the look's colour multiplies it in.
  for (const side of [-1, 1]) {
    const cheek = new THREE.SphereGeometry(1, 14, 8)
    cheek.scale(0.072, 0.04, 0.012)
    parts.push(bake(decal(cheek, side * CHEEK_X * BR, CHEEK_Y * BRY, -0.002), '#ffffff', [1, 1], 0.2))
  }
  const cheeks = parts.reduce((n, g) => n + g.attributes.position!.count, 0)
  // The smile: the canvas's curve (M88 144 Q100 155 112 144), a thin tube on the body, its ends rounded.
  const pts: THREE.Vector3[] = []
  for (let k = 0; k <= 10; k++) {
    const t = k / 10
    const x = ((1 - t) * (1 - t) * -12 + t * t * 12) / 70
    const y = -((1 - t) * (1 - t) * 22 + 2 * t * (1 - t) * 33 + t * t * 22) / 70
    onBody(x * BR, y * BRY, PT, NR)
    pts.push(PT.clone().addScaledVector(NR, 0.006))
  }
  const smile = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.017, 6, false)
  parts.push(bake(smile, ink, [1, 1], 0.1))
  for (const p of [pts[0]!, pts[pts.length - 1]!]) {
    const cap = new THREE.SphereGeometry(0.017, 6, 4)
    cap.translate(p.x, p.y, p.z)
    parts.push(bake(cap, ink, [1, 1], 0.1))
  }
  // The eyes: tall dark ovals, and a glint up and to the right of each (as you look at Blip).
  const before = parts.reduce((n, g) => n + g.attributes.position!.count, 0)
  const centres: { y: number; n: number; glint: boolean; at: THREE.Vector3 }[] = []
  for (const side of [-1, 1]) {
    const eye = new THREE.SphereGeometry(1, 16, 12)
    eye.scale(0.07, 0.115, 0.034)
    const ex = side * EYE_X * BR
    const ey = EYE_Y * BRY
    parts.push(bake(decal(eye, ex, ey, -0.008), ink, [1, 1], 0.15))
    onBody(ex, ey, PT, NR)
    centres.push({ y: PT.y, n: parts[parts.length - 1]!.attributes.position!.count, glint: false, at: PT.clone() })
    const glint = new THREE.SphereGeometry(0.026, 8, 6)
    glint.scale(1, 1, 0.45)
    const gx = ex + (3 / 70) * BR
    const gy = ey + (7 / 70) * BRY
    parts.push(bake(decal(glint, gx, gy, 0.021), '#ffffff', [1, 1], 0.3))
    onBody(gx, gy, PT, NR)
    centres.push({ y: PT.y, n: parts[parts.length - 1]!.attributes.position!.count, glint: true, at: PT.clone().addScaledVector(NR, -0.02) })
  }
  const geo = merge(parts)
  // The shut eyes: every eye vertex squashed toward its eye's middle line, every glint sunk to a point inside.
  const pos = geo.attributes.position as THREE.BufferAttribute
  const shut = new Float32Array(pos.array as Float32Array)
  let v = before
  for (const c of centres) {
    for (let k = 0; k < c.n; k++, v++) {
      if (c.glint) {
        shut[v * 3] = c.at.x
        shut[v * 3 + 1] = c.at.y
        shut[v * 3 + 2] = c.at.z
      } else shut[v * 3 + 1] = c.y + (pos.getY(v) - c.y) * 0.16 - 0.012
    }
  }
  return { geo, cheeks, eyes: before, shut }
}

/** A rounded five-pointed star, its points `ro` out and its inner corners `ri`, a point up (+y), in the xy plane. */
function starShape(ro: number, ri: number, round = 0.22): THREE.Shape {
  const P: THREE.Vector2[] = []
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2
    const r = i % 2 ? ri : ro
    P.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r))
  }
  const lerp = (a: THREE.Vector2, b: THREE.Vector2, k: number) => new THREE.Vector2(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)
  const s = new THREE.Shape()
  const start = lerp(P[9]!, P[0]!, 1 - round)
  s.moveTo(start.x, start.y)
  for (let i = 0; i < 10; i += 2) {
    const tip = P[i]!
    const inner = P[i + 1]!
    const next = P[(i + 2) % 10]!
    const out = lerp(tip, inner, round)
    s.quadraticCurveTo(tip.x, tip.y, out.x, out.y)
    s.lineTo(inner.x, inner.y)
    const back = lerp(inner, next, 1 - round)
    s.lineTo(back.x, back.y)
  }
  return s
}

/**
 * The Blip star (what Blip grabs at the top of Star Peak): a puffy mint five-pointed star, a lighter star on each
 * face, a white blip at its heart, `r` from its middle to a point, facing ±z. Coloured flat with its normals kept,
 * for a matcap.
 */
export function blipStarGeometry(r: number): THREE.BufferGeometry {
  const bevel = 0.09 * r
  const depth = 0.16 * r
  const body = new THREE.ExtrudeGeometry(starShape(r - bevel, (r - bevel) * 0.47), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.13 * r,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 4,
  })
  body.translate(0, 0, -depth / 2)
  const face = depth / 2 + 0.13 * r
  const parts: THREE.BufferGeometry[] = [paint(body, '#34c6a8')]
  for (const side of [-1, 1]) {
    const inner = new THREE.ShapeGeometry(starShape(0.66 * r, 0.66 * r * 0.47), 4)
    if (side < 0) inner.rotateY(Math.PI)
    inner.translate(0, 0, side * (face + 0.004 * r))
    parts.push(paint(inner, '#7ff0d6'))
    const blip = new THREE.SphereGeometry(0.19 * r, 16, 10)
    blip.scale(1, 1, 0.5)
    blip.translate(0, 0, side * face)
    parts.push(paint(blip, BLIP.spark))
  }
  return merge(parts, true)
}

/** A flat five-pointed star, for the dizzy stars. */
function dizzyStarGeometry(r: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  return new THREE.ShapeGeometry(shape)
}

/** What the rig needs of the runner each frame (from run.bean, at the drawn place). */
export type BeanState = {
  x: number
  y: number
  z: number
  yaw: number
  vy: number
  grounded: boolean
  prone: boolean
  stunned: boolean
  dead: boolean
  ledge: boolean
}

/** Your Blip, with the juice. */
export class BeanRig {
  readonly root = new THREE.Group()
  private readonly squash = new THREE.Group()
  private readonly pivot = new THREE.Group()
  private readonly face = new THREE.Group()
  private readonly faceGeo: THREE.BufferGeometry
  private readonly cheekShade: Float32Array
  private readonly eyesOpen: Float32Array
  private readonly eyesShut: Float32Array
  private readonly eyesFrom: number
  private eyesAreShut = false
  private readonly feet: THREE.Object3D[] = []
  private readonly bodyMat: THREE.MeshMatcapMaterial
  private readonly bandMat: THREE.MeshMatcapMaterial
  private readonly feetMat: THREE.MeshMatcapMaterial
  private readonly spark = new THREE.Group()
  private readonly sparkCore: THREE.Mesh
  private readonly glow: THREE.Sprite
  private readonly glowMat: THREE.SpriteMaterial
  private readonly star: THREE.Mesh
  private readonly bubble: THREE.Mesh
  private readonly dizzy = new THREE.Group()
  private lookShown: BeanLook | null = null
  private dark = true

  private readonly sq = new Spring()
  private readonly leanF = new Spring()
  private readonly leanS = new Spring()
  private lagF = 0
  private lagS = 0
  private prevX = NaN
  private prevZ = NaN
  private velX = 0
  private velZ = 0
  private stride = 0
  private dive = 0
  private clock = 0
  private blinkAt = 2
  private blink = 0
  /** A tumble: its axis (world), how far round it has to go, how far it's gone, how fast. */
  private readonly tumbleAxis = new THREE.Vector3(1, 0, 0)
  private tumbleTo = 0
  private tumbleAt = 0
  private tumbleRate = 12
  private dizzyFor = 0
  private bubbleFor = 0
  private crownFor = -1
  private wasGrounded = true
  private readonly eyeAim = new THREE.Vector2()
  private readonly eyeShown = new THREE.Vector2()
  /** The spark's place (the root's frame) and speed: it floats after the head on a spring of its own. */
  private readonly sparkAt = new THREE.Vector3()
  private readonly sparkV = new THREE.Vector3()
  private sparkSnap = true
  private readonly rnd: () => number
  // Scratch.
  private readonly qa = new THREE.Quaternion()
  private readonly va = new THREE.Vector3()
  private readonly e = new THREE.Euler()

  constructor(matcap: THREE.Texture, dot: THREE.Texture, rnd: () => number) {
    this.rnd = rnd
    this.bodyMat = new THREE.MeshMatcapMaterial({ matcap })
    this.bandMat = new THREE.MeshMatcapMaterial({ matcap })
    this.feetMat = new THREE.MeshMatcapMaterial({ matcap })
    this.root.add(this.squash)
    this.squash.add(this.pivot)
    this.pivot.position.y = MID
    const body = bodyGeometries()
    this.pivot.add(new THREE.Mesh(body.top, this.bodyMat), new THREE.Mesh(body.band, this.bandMat))
    // The face, which slides round the body a beat behind its lean and toward what it's watching.
    const face = faceGeometry()
    this.faceGeo = face.geo
    const cols = face.geo.attributes.color as THREE.BufferAttribute
    this.cheekShade = new Float32Array((cols.array as Float32Array).subarray(0, face.cheeks * 3))
    this.eyesFrom = face.eyes * 3
    this.eyesOpen = new Float32Array((face.geo.attributes.position!.array as Float32Array).subarray(this.eyesFrom))
    this.eyesShut = face.shut.subarray(this.eyesFrom)
    this.face.add(new THREE.Mesh(face.geo, new THREE.MeshBasicMaterial({ vertexColors: true })))
    this.pivot.add(this.face)
    // The feet, under the body.
    const footGeo = footGeometry()
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(footGeo, this.feetMat)
      foot.position.set(side * FOOT_OUT, FY - MID, 0.03)
      this.pivot.add(foot)
      this.feet.push(foot)
    }
    // The spark: a white core and its mint glow, floating over the head (the root's, so it never squashes).
    this.sparkCore = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 8), new THREE.MeshBasicMaterial({ color: BLIP.spark, fog: false }))
    this.glowMat = new THREE.SpriteMaterial({ map: dot, color: BLIP.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
    this.glow = new THREE.Sprite(this.glowMat)
    this.glow.scale.setScalar(0.5)
    this.spark.add(this.glow, this.sparkCore)
    this.root.add(this.spark)
    // The Blip star it holds over its head at the finish, the bubble it drops in with, the stars a yeet leaves it seeing.
    this.star = new THREE.Mesh(blipStarGeometry(0.36), new THREE.MeshMatcapMaterial({ matcap, vertexColors: true }))
    this.star.visible = false
    this.spark.add(this.star)
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }),
    )
    this.bubble.scale.setScalar(0.86)
    this.bubble.position.y = MID + 0.12
    this.bubble.visible = false
    this.root.add(this.bubble)
    const starMat = new THREE.MeshBasicMaterial({ color: CODE.gold, side: THREE.DoubleSide })
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(dizzyStarGeometry(0.09), starMat)
      const a = (i / 3) * Math.PI * 2
      star.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42)
      this.dizzy.add(star)
    }
    this.dizzy.position.y = BRY + 0.16
    this.dizzy.visible = false
    this.pivot.add(this.dizzy)
    this.wear(null)
  }

  /** Dress it in a skin's look (none yet: mint Blip). */
  wear(skin: string | null) {
    const look = beanLook(skin)
    if (look === this.lookShown) return
    this.lookShown = look
    this.bodyMat.color.set(look.body)
    this.bandMat.color.set(look.shade)
    this.feetMat.color.set(look.feet)
    this.glowLook()
    // The cheeks: pink over the body's colour, as the canvas's 70% pink.
    const cheek = new THREE.Color(mix(look.body, BLIP.cheek, 0.72))
    const cols = this.faceGeo.attributes.color as THREE.BufferAttribute
    const arr = cols.array as Float32Array
    for (let i = 0; i < this.cheekShade.length; i += 3) {
      arr[i] = cheek.r * this.cheekShade[i]!
      arr[i + 1] = cheek.g * this.cheekShade[i + 1]!
      arr[i + 2] = cheek.b * this.cheekShade[i + 2]!
    }
    cols.needsUpdate = true
  }

  /** The site's theme: the spark glows (added light) at dusk, and is a deeper mint halo in the afternoon (so it shows on pale floors). */
  setDark(dark: boolean) {
    if (dark === this.dark) return
    this.dark = dark
    this.glowMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending
    this.glowMat.needsUpdate = true
    this.glowLook()
  }

  private glowLook() {
    const look = this.lookShown ?? MINT_LOOK
    this.glowMat.color.set(this.dark ? look.glow : mix(look.glow, look.body, 0.55))
    this.glowMat.opacity = this.dark ? 0.8 : 0.9
  }

  /** A new run, or back at a checkpoint far away: no spring carries over. */
  reset() {
    this.sq.x = this.sq.v = 0
    this.leanF.x = this.leanF.v = this.leanS.x = this.leanS.v = 0
    this.lagF = this.lagS = 0
    this.prevX = this.prevZ = NaN
    this.velX = this.velZ = 0
    this.tumbleTo = this.tumbleAt = 0
    this.dizzyFor = 0
    this.bubbleFor = 0
    this.crownFor = -1
    this.star.visible = false
    this.sparkCore.visible = true
    this.dive = 0
    this.sparkSnap = true
  }

  jumped() {
    this.sq.x = 0.17
    this.sq.v = 0
  }

  landed(v: number) {
    const peak = Math.min(0.3, Math.max(0, v - 1.5) * 0.026)
    this.sq.v -= peak * 19.7
    if (this.tumbleTo > 0 && this.tumbleAt < this.tumbleTo) this.tumbleRate = 30
  }

  /** Knocked (or yeeted, more turns): head over heels the way it's flung, `dx, dz`. */
  knocked(dx: number, dz: number, turns: number) {
    const l = Math.hypot(dx, dz)
    if (l < 1e-3) this.tumbleAxis.set(1, 0, 0)
    else this.tumbleAxis.set(dz / l, 0, -dx / l)
    this.tumbleTo = turns * Math.PI * 2
    this.tumbleAt = 0
    this.tumbleRate = 9 + this.rnd() * 5
    if (turns > 2) this.dizzyFor = -1
  }

  /** Bonked: no tumble, just a wobble the way it was pushed. */
  bonked() {
    this.sq.v += 3
    this.leanF.v -= 6
  }

  respawned() {
    this.reset()
    this.bubbleFor = 0.001
  }

  /** It has the star: the star pops on over its head, round its spark. */
  crowned() {
    this.crownFor = 0
    this.star.visible = true
    this.sparkCore.visible = false
  }

  /** Where the head is (world), for the eyes' aim and the confetti. */
  head(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.root.position.x, this.root.position.y + MID + BRY * 0.8, this.root.position.z)
  }

  /**
   * This frame's pose: the runner's state, a point its eyes follow (the nearest hazard, or null), and whether it's
   * idling on a start card.
   */
  update(s: BeanState, look: THREE.Vector3 | null, dt: number, calm: boolean) {
    this.clock += dt
    const root = this.root
    root.position.set(s.x, s.y, s.z)
    root.rotation.y = s.yaw
    root.visible = true
    if (dt <= 0) return
    // Velocity across the ground as drawn (carries and all), and from it how it's speeding up, in its own frame.
    let ax = 0
    let az = 0
    if (this.prevX === this.prevX && Math.hypot(s.x - this.prevX, s.z - this.prevZ) < 3) {
      const vx = (s.x - this.prevX) / dt
      const vz = (s.z - this.prevZ) / dt
      const k = 1 - Math.exp(-dt * 18)
      const nx = this.velX + (vx - this.velX) * k
      const nz = this.velZ + (vz - this.velZ) * k
      ax = (nx - this.velX) / dt
      az = (nz - this.velZ) / dt
      this.velX = nx
      this.velZ = nz
    }
    this.prevX = s.x
    this.prevZ = s.z
    const speed = Math.hypot(this.velX, this.velZ)
    const c = Math.cos(s.yaw)
    const sn = Math.sin(s.yaw)
    const aF = ax * sn + az * c
    const aS = ax * c - az * sn
    const lean = calm ? 0.009 : 0.016
    this.leanF.step(dt, Math.max(-0.32, Math.min(0.32, aF * lean)))
    this.leanS.step(dt, Math.max(-0.3, Math.min(0.3, -aS * lean)))
    this.lagF += (this.leanF.x - this.lagF) * (1 - Math.exp(-dt * 9))
    this.lagS += (this.leanS.x - this.lagS) * (1 - Math.exp(-dt * 9))
    // In the air it stretches with its speed up or down; on the ground the spring settles it round.
    const air = !s.grounded && !s.prone && !s.ledge ? 1 : 0
    this.sq.step(dt, air * Math.min(0.12, Math.abs(s.vy) * 0.012))

    // Running, it hops: up off its feet each step, a touch tall at the top and squashed as it comes down.
    const run = s.grounded && !s.prone ? Math.min(1, speed / 6) : 0
    if (s.grounded) this.stride += speed * dt * 2.3
    const hop = Math.abs(Math.sin(this.stride)) * run
    // Squash and stretch about the feet; a slow breath when it's still.
    const breath = speed < 0.4 && s.grounded ? 0.014 * Math.sin(this.clock * 2.4) : 0
    const q = Math.max(-0.35, Math.min(0.3, this.sq.x)) + breath + (hop - 0.5 * run) * 0.07
    // Diving or belly sliding: belly first and near flat, its middle down at the prone height, long and low.
    this.dive += ((s.prone ? 1 : 0) - this.dive) * (1 - Math.exp(-dt * 16))
    const d = this.dive
    this.squash.scale.set((1 - q * 0.55) * (1 + 0.04 * d), (1 + q) * (1 - 0.2 * d), (1 - q * 0.55) * (1 + 0.16 * d))
    this.pivot.position.y = MID - 0.05 * d + hop * 0.07

    // The tumble, about the axis across the knock, finishing quickly once it's down.
    let tumble = 0
    if (this.tumbleTo > 0) {
      this.tumbleAt = Math.min(this.tumbleTo, this.tumbleAt + dt * (s.grounded && !s.stunned ? Math.max(this.tumbleRate, 26) : this.tumbleRate))
      tumble = this.tumbleAt
      if (this.tumbleAt >= this.tumbleTo) {
        this.tumbleTo = this.tumbleAt = 0
        tumble = 0
        if (this.dizzyFor < 0) this.dizzyFor = 0.6
        this.sq.v -= 2.5
      }
    }
    // Lean, then the dive's tip forward, then the tumble (its axis taken into the runner's own frame).
    this.e.set(this.leanF.x + d * DIVE_TIP, 0, this.leanS.x, 'YXZ')
    this.pivot.quaternion.setFromEuler(this.e)
    if (tumble > 0) {
      this.va.copy(this.tumbleAxis).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -s.yaw)
      this.qa.setFromAxisAngle(this.va, tumble)
      this.pivot.quaternion.premultiply(this.qa)
    }

    // The feet: pattering as it runs; paddling in the air; scrambling at a ledge; splayed in a tumble.
    const flail = Math.min(1, Math.abs(s.vy) / 9)
    const reeling = s.stunned || tumble > 0 ? 1 : 0
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      const ph = this.stride + (i ? Math.PI : 0)
      const paddle = this.clock * (15 + 6 * flail) + (i ? Math.PI : 0)
      const scramble = this.clock * 26 + (i ? Math.PI : 0)
      const foot = this.feet[i]!
      const ledge = s.ledge ? 1 : 0
      foot.position.x = side * (FOOT_OUT + 0.06 * reeling)
      foot.position.z = 0.03 + Math.sin(ph) * 0.14 * run + air * Math.sin(paddle) * 0.08 + ledge * (0.12 + Math.sin(scramble) * 0.1) - d * 0.06
      foot.position.y = FY - MID + Math.max(0, Math.cos(ph)) * 0.08 * run + air * (0.03 + 0.03 * Math.cos(paddle)) + ledge * (0.1 + Math.max(0, Math.cos(scramble)) * 0.08) + reeling * 0.04
      foot.rotation.x = air * Math.sin(paddle) * 0.35 - d * 0.5
    }

    // The face: a beat behind the lean, slid round toward the nearest hazard if there is one; a blink now and then.
    this.eyeAim.set(0, 0)
    if (look) {
      this.va.set(look.x - s.x, look.y - (s.y + MID), look.z - s.z)
      const lx = this.va.x * c - this.va.z * sn
      const lz = this.va.x * sn + this.va.z * c
      const l = Math.hypot(lx, this.va.y, lz) || 1
      this.eyeAim.set(Math.max(-1, Math.min(1, (-lx / l) * 1.6)), Math.max(-1, Math.min(1, (this.va.y / l) * 1.6)))
    }
    this.eyeShown.lerp(this.eyeAim, 1 - Math.exp(-dt * 12))
    this.e.set((this.lagF - this.leanF.x) * 0.9 - this.eyeShown.y * 0.18, -this.eyeShown.x * 0.26, (this.lagS - this.leanS.x) * 0.9, 'YXZ')
    this.face.quaternion.setFromEuler(this.e)
    this.blinkAt -= dt
    if (this.blinkAt <= 0) {
      this.blink = 0.12
      this.blinkAt = 2 + this.rnd() * 3.5
    }
    this.blink = Math.max(0, this.blink - dt)
    this.shutEyes(this.blink > 0 || s.stunned || tumble > 0)

    // The spark over its head (the star round it once it has it), floating after the head on a spring.
    this.floatSpark(dt, calm)

    // Dizzy stars after a yeet; the star popping on; the drop-in bubble.
    if (this.dizzyFor > 0) {
      this.dizzyFor -= dt
      this.dizzy.visible = true
      this.dizzy.rotation.y += dt * 7
      // Each star turned to face the camera (which always looks down +z) as they go round.
      for (const star of this.dizzy.children) star.rotation.y = -this.dizzy.rotation.y - s.yaw
    } else this.dizzy.visible = false
    if (this.crownFor >= 0) {
      this.crownFor += dt
      const k = Math.min(1, this.crownFor / 0.35)
      const pop = k < 1 ? Math.sin(k * Math.PI) * 0.4 + k : 1
      this.star.scale.setScalar(pop)
      this.star.position.y = 0.06 + (1 - k) * 0.8
      this.star.rotation.y = this.crownFor < 0.6 ? (1 - k) * 5 - s.yaw : -s.yaw + Math.sin((this.crownFor - 0.6) * 1.4) * 0.5
      this.glow.scale.setScalar(0.5 + 0.55 * k)
    } else this.glow.scale.setScalar(0.5 * (1 + 0.08 * Math.sin(this.clock * 5.3)))
    if (this.bubbleFor > 0) {
      this.bubbleFor += dt
      const popped = (s.grounded && !this.wasGrounded) || this.bubbleFor > 0.9
      if (popped) this.bubbleFor = -0.14
      const m = this.bubble.material as THREE.MeshBasicMaterial
      m.opacity = 0.22
      this.bubble.scale.setScalar(0.86 + 0.04 * Math.sin(this.clock * 14))
      this.bubble.visible = true
    } else if (this.bubbleFor < 0) {
      // Popping: swelling as it fades.
      this.bubbleFor = Math.min(0, this.bubbleFor + dt)
      const k = 1 + this.bubbleFor / 0.14
      this.bubble.scale.setScalar(0.86 + k * 0.5)
      ;(this.bubble.material as THREE.MeshBasicMaterial).opacity = 0.22 * (1 - k)
      this.bubble.visible = this.bubbleFor < 0
    } else this.bubble.visible = false
    this.wasGrounded = s.grounded
  }

  /** Eyes open or shut (a blink, a daze): the face's eye places swapped for the other set. */
  private shutEyes(shut: boolean) {
    if (shut === this.eyesAreShut) return
    this.eyesAreShut = shut
    const pos = this.faceGeo.attributes.position as THREE.BufferAttribute
    ;(pos.array as Float32Array).set(shut ? this.eyesShut : this.eyesOpen, this.eyesFrom)
    pos.needsUpdate = true
  }

  /** The spark's place: over the head as drawn (leaning, tipped and tumbling with it), reached on a soft spring. */
  private floatSpark(dt: number, calm: boolean) {
    const up = this.crownFor >= 0 ? SPARK_UP + 0.3 : SPARK_UP
    const want = this.va.set(0, up, 0).applyQuaternion(this.pivot.quaternion)
    want.y += this.pivot.position.y
    want.multiply(this.squash.scale)
    want.y += calm ? 0 : Math.sin(this.clock * 2.6) * 0.035
    if (this.sparkSnap) {
      this.sparkAt.copy(want)
      this.sparkV.set(0, 0, 0)
      this.sparkSnap = false
    } else {
      let left = Math.min(dt, 0.1)
      const k = 170
      const damp = 2 * 0.5 * Math.sqrt(k)
      while (left > 1e-6) {
        const h = Math.min(left, 1 / 120)
        this.sparkV.x += (-k * (this.sparkAt.x - want.x) - damp * this.sparkV.x) * h
        this.sparkV.y += (-k * (this.sparkAt.y - want.y) - damp * this.sparkV.y) * h
        this.sparkV.z += (-k * (this.sparkAt.z - want.z) - damp * this.sparkV.z) * h
        this.sparkAt.addScaledVector(this.sparkV, h)
        left -= h
      }
    }
    this.spark.position.copy(this.sparkAt)
  }
}

/** The ghosts' colours: the blue blip, someone else's run, your own best. */
export type GhostKind = 'blue' | 'rival' | 'mine'

/** A ghost: Blip seen through, in its colour (or a run's skin, lighter), its name over it when it's the one chased. */
export class GhostBean {
  readonly root = new THREE.Group()
  private readonly pivot = new THREE.Group()
  readonly body: THREE.MeshMatcapMaterial
  /** The face and spark: the eyes darker, the spark lighter, in this material's colour. */
  readonly face: THREE.MeshBasicMaterial
  private prevX = NaN
  private prevY = NaN
  private prevZ = NaN
  private yaw = 0
  private clock = 0
  private spin = 0
  private sq = new Spring()

  constructor(matcap: THREE.Texture, body: THREE.BufferGeometry, face: THREE.BufferGeometry) {
    const seeThrough = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 } as const
    this.body = new THREE.MeshMatcapMaterial({ ...seeThrough, matcap, vertexColors: true, opacity: 0.45 })
    this.face = new THREE.MeshBasicMaterial({ ...seeThrough, vertexColors: true, opacity: 0.45 })
    this.root.add(this.pivot)
    this.pivot.position.y = MID
    const b = new THREE.Mesh(body, this.body)
    b.renderOrder = 4
    const f = new THREE.Mesh(face, this.face)
    f.renderOrder = 5
    this.pivot.add(b, f)
    this.root.visible = false
  }

  /** Where it is, and the ghost path's state (0 grounded, 1 air or dive, 2 respawning, 3 stunned). Teleports don't spin it. */
  place(x: number, y: number, z: number, state: number, dt: number) {
    this.clock += dt
    const jumped = this.prevX === this.prevX ? Math.hypot(x - this.prevX, y - this.prevY, z - this.prevZ) : Infinity
    if (jumped < 3 && dt > 0) {
      const dx = x - this.prevX
      const dz = z - this.prevZ
      if (Math.hypot(dx, dz) > dt * 0.6) {
        const want = Math.atan2(dx, dz)
        const d = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw))
        this.yaw += d * (1 - Math.exp(-dt * 12))
      }
      const vy = (y - this.prevY) / dt
      if (state === 0 && vy > -0.5 && this.prevY - y > 0.25) this.sq.v -= 3
      this.sq.step(dt, state === 1 ? Math.min(0.12, Math.abs(vy) * 0.012) : 0)
    } else if (jumped >= 3) this.sq.x = this.sq.v = 0
    this.prevX = x
    this.prevY = y
    this.prevZ = z
    this.spin = state === 3 ? this.spin + dt * 14 : this.spin * Math.exp(-dt * 10)
    this.root.position.set(x, y, z)
    this.root.rotation.y = this.yaw + this.spin
    const q = this.sq.x
    this.pivot.scale.set(1 - q * 0.5, 1 + q, 1 - q * 0.5)
    this.root.visible = true
  }

  hide() {
    this.root.visible = false
    this.prevX = NaN
  }
}

/**
 * The geometries every ghost shares (made once): the body with its band a shade darker and its feet darker still
 * (vertex colours under the ghost's colour, normals kept for the matcap); the face, flat eyes (so they never show
 * through from behind) and the spark.
 */
export function ghostGeometries(): { body: THREE.BufferGeometry; face: THREE.BufferGeometry } {
  const body = new THREE.SphereGeometry(1, 24, 16)
  body.scale(BR, BRY, BR)
  paint(body, '#ffffff')
  const pos = body.attributes.position!
  const col = body.attributes.color as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < -BAND * BRY) col.setXYZ(i, 0.74, 0.74, 0.74)
  }
  const parts: THREE.BufferGeometry[] = [body]
  for (const side of [-1, 1]) {
    const foot = footGeometry()
    foot.translate(side * FOOT_OUT, FY - MID, 0.03)
    parts.push(paint(foot, new THREE.Color(0.66, 0.66, 0.66)))
  }
  const faceParts: THREE.BufferGeometry[] = []
  for (const side of [-1, 1]) {
    const eye = new THREE.CircleGeometry(1, 18)
    eye.scale(0.07, 0.115, 1)
    faceParts.push(bake(decal(eye, side * EYE_X * BR, EYE_Y * BRY, 0.004), new THREE.Color(0.14, 0.14, 0.14)))
  }
  const spark = new THREE.SphereGeometry(0.075, 10, 8)
  spark.translate(0, SPARK_UP, 0)
  faceParts.push(bake(spark, '#ffffff', [1, 1], 0.4))
  return { body: merge(parts, true), face: merge(faceParts) }
}
