import * as THREE from 'three'
import { H, R } from '../engine/sim.ts'
import { bake, merge } from './geo.ts'
import { BEAN_PINK, CODE, mix } from './look.ts'

/*
 * The bean: a pink jelly bean on two little feet, with a visor and two eyes, drawn with a matcap (a painted light,
 * so it shines without lamps). The engine's bean is a capsule that never turns over; everything here is looks
 * only (design-final §6): it stretches as it jumps and squashes as it lands, leans into its speed on a spring
 * with its visor a beat behind, flails its arms in the air, tumbles head over heels when something knocks it,
 * lies flat in a dive and a belly slide, follows the nearest hazard with its eyes, drops in inside a bubble, and
 * wears the crown once it has it.
 *
 * Ghosts are the same bean, simpler and seen through: the blue bean, someone else's run (cyan), your own best
 * (amber), or a run's skin, lighter (none yet).
 */

/** What a skin dresses the bean in. Skins are costumes, never a speed or a size; none exist yet. */
export type BeanLook = { body: string; visor: string; feet: string }

const PINK_LOOK: BeanLook = { body: BEAN_PINK, visor: '#fff1f6', feet: mix(BEAN_PINK, '#5a1d3a', 0.25) }
/** 'wobblerun-<id>': its look, added per skin (never blue: the blue bean is the one you race). */
const LOOKS: Record<string, BeanLook> = {}

/** A skin's look; the pink bean for none, or for a skin this game doesn't know (an old device copy, the API). */
export function beanLook(skin: string | null | undefined): BeanLook {
  return (skin && LOOKS[skin]) || PINK_LOOK
}

/** The bean's middle, where it turns about (it's H tall, its feet at its y). */
const MID = H / 2
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

/** The capsule, a little fuller at its foot, as a jelly bean is. */
function bodyGeometry(segments = 20): THREE.BufferGeometry {
  const geo = new THREE.CapsuleGeometry(R, H - 2 * R, 8, segments)
  const pos = geo.attributes.position!
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const k = 1 + 0.07 * Math.max(0, -y / MID)
    pos.setX(i, pos.getX(i) * k)
    pos.setZ(i, pos.getZ(i) * k)
  }
  geo.computeVertexNormals()
  return geo
}

/** The visor: an oval plate on the front of the head. */
function visorGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.3, 22, 14)
  geo.scale(1.02, 0.8, 0.52)
  geo.translate(0, 0, R - 0.1)
  return geo
}

/** The crown: a gold band with five points and jewels, its foot at y 0, for the course's crown and your head. */
export function crownGeometry(size = 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const gold = new THREE.Color('#ffffff')
  const r = 0.42 * size
  const band = new THREE.CylinderGeometry(r, r * 0.92, 0.26 * size, 24, 1, true)
  band.translate(0, 0.13 * size, 0)
  parts.push(bake(band, gold, [1, 1], 0.1))
  const inner = new THREE.CylinderGeometry(r * 0.97, r * 0.9, 0.25 * size, 24, 1, true)
  inner.scale(-1, 1, 1)
  inner.translate(0, 0.13 * size, 0)
  parts.push(bake(inner, new THREE.Color('#c99a2e')))
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const spike = new THREE.ConeGeometry(0.11 * size, 0.3 * size, 8)
    spike.translate(Math.sin(a) * r * 0.95, 0.4 * size, Math.cos(a) * r * 0.95)
    parts.push(bake(spike, gold, [1, 1], 0.08))
    const ball = new THREE.SphereGeometry(0.05 * size, 8, 6)
    ball.translate(Math.sin(a) * r * 0.95, 0.57 * size, Math.cos(a) * r * 0.95)
    parts.push(bake(ball, gold, [1, 1], 0.15))
    const jewel = new THREE.SphereGeometry(0.06 * size, 10, 8)
    jewel.scale(1, 1, 0.5)
    jewel.translate(Math.sin(a + 0.63) * r, 0.13 * size, Math.cos(a + 0.63) * r)
    parts.push(bake(jewel, new THREE.Color(i % 2 ? CODE.dodge : CODE.bouncy), [1, 1], 0.2))
  }
  return merge(parts)
}

/** A five-pointed star, flat, for the dizzy stars. */
function starGeometry(r: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  return new THREE.ShapeGeometry(shape)
}

/** What the rig needs of the bean each frame (from run.bean, at the drawn place). */
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

/** Your bean, with the juice. */
export class BeanRig {
  readonly root = new THREE.Group()
  private readonly squash = new THREE.Group()
  private readonly pivot = new THREE.Group()
  private readonly visor = new THREE.Group()
  private readonly eyes: THREE.Mesh
  private readonly arms: THREE.Object3D[] = []
  private readonly feet: THREE.Object3D[] = []
  private readonly bodyMat: THREE.MeshMatcapMaterial
  private readonly visorMat: THREE.MeshMatcapMaterial
  private readonly feetMat: THREE.MeshMatcapMaterial
  private readonly crown: THREE.Mesh
  private readonly bubble: THREE.Mesh
  private readonly dizzy = new THREE.Group()
  private lookShown: BeanLook | null = null

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
  private readonly rnd: () => number
  // Scratch.
  private readonly qa = new THREE.Quaternion()
  private readonly va = new THREE.Vector3()
  private readonly e = new THREE.Euler()

  constructor(matcap: THREE.Texture, goldMatcap: THREE.Texture, rnd: () => number) {
    this.rnd = rnd
    this.bodyMat = new THREE.MeshMatcapMaterial({ matcap })
    this.visorMat = new THREE.MeshMatcapMaterial({ matcap })
    this.feetMat = new THREE.MeshMatcapMaterial({ matcap })
    this.root.add(this.squash)
    this.squash.add(this.pivot)
    this.pivot.position.y = MID
    const body = new THREE.Mesh(bodyGeometry(), this.bodyMat)
    this.pivot.add(body)
    // The visor and the eyes, which lag a beat behind the body's lean.
    this.visor.position.y = 0.3
    this.pivot.add(this.visor)
    this.visor.add(new THREE.Mesh(visorGeometry(), this.visorMat))
    const eyeParts: THREE.BufferGeometry[] = []
    for (const side of [-1, 1]) {
      const eye = new THREE.SphereGeometry(0.062, 12, 10)
      eye.scale(0.9, 1.25, 0.55)
      eye.translate(side * 0.105, 0.02, R + 0.045)
      eyeParts.push(bake(eye, new THREE.Color('#1c1430')))
      const shine = new THREE.SphereGeometry(0.019, 8, 6)
      shine.translate(side * 0.105 + 0.018, 0.05, R + 0.075)
      eyeParts.push(bake(shine, new THREE.Color('#ffffff'), [1, 1], 0.3))
    }
    this.eyes = new THREE.Mesh(merge(eyeParts), new THREE.MeshBasicMaterial({ vertexColors: true }))
    this.visor.add(this.eyes)
    // Arms from the shoulders, feet under the body.
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group()
      shoulder.position.set(side * (R - 0.02), 0.08, 0)
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), this.feetMat)
      arm.position.set(side * 0.08, -0.16, 0)
      arm.rotation.z = side * 0.35
      shoulder.add(arm)
      this.pivot.add(shoulder)
      this.arms.push(shoulder)
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), this.feetMat)
      foot.scale.set(0.95, 0.55, 1.35)
      foot.position.set(side * 0.17, 0.06 - MID, 0.05)
      this.pivot.add(foot)
      this.feet.push(foot)
    }
    // The crown it wears at the finish, the bubble it drops in with, the stars a yeet leaves it seeing.
    this.crown = new THREE.Mesh(crownGeometry(0.78), new THREE.MeshMatcapMaterial({ matcap: goldMatcap, color: CODE.gold, vertexColors: true }))
    this.crown.position.set(0, MID - 0.06, -0.02)
    this.crown.rotation.x = -0.12
    this.crown.visible = false
    this.pivot.add(this.crown)
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }),
    )
    this.bubble.scale.setScalar(0.95)
    this.bubble.position.y = MID
    this.bubble.visible = false
    this.root.add(this.bubble)
    const starMat = new THREE.MeshBasicMaterial({ color: CODE.gold, side: THREE.DoubleSide })
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(starGeometry(0.09), starMat)
      const a = (i / 3) * Math.PI * 2
      star.position.set(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38)
      this.dizzy.add(star)
    }
    this.dizzy.position.y = MID + 0.32
    this.dizzy.visible = false
    this.pivot.add(this.dizzy)
    this.wear(null)
  }

  /** Dress it in a skin's look (none yet: the pink bean). */
  wear(skin: string | null) {
    const look = beanLook(skin)
    if (look === this.lookShown) return
    this.lookShown = look
    this.bodyMat.color.set(look.body)
    this.visorMat.color.set(look.visor)
    this.feetMat.color.set(look.feet)
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
    this.crown.visible = false
    this.dive = 0
  }

  jumped() {
    this.sq.x = 0.15
    this.sq.v = 0
  }

  landed(v: number) {
    const peak = Math.min(0.3, Math.max(0, v - 1.5) * 0.024)
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

  crowned() {
    this.crownFor = 0
    this.crown.visible = true
  }

  /** Where the head is (world), for the eyes' aim and the confetti. */
  head(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.root.position.x, this.root.position.y + H * 0.85, this.root.position.z)
  }

  /**
   * This frame's pose: the bean's state, a point its eyes follow (the nearest hazard, or null), and whether it's
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
    this.sq.step(dt)

    // Squash and stretch about the feet; a slow breath when it's still.
    const breath = speed < 0.4 && s.grounded ? 0.012 * Math.sin(this.clock * 2.4) : 0
    const q = Math.max(-0.35, Math.min(0.3, this.sq.x)) + breath
    this.squash.scale.set(1 - q * 0.55, 1 + q, 1 - q * 0.55)

    // Diving or belly sliding: flat on its front, its middle down at the prone height.
    this.dive += ((s.prone ? 1 : 0) - this.dive) * (1 - Math.exp(-dt * 16))
    this.pivot.position.y = MID - 0.31 * this.dive + (s.grounded && speed > 1 ? Math.abs(Math.sin(this.stride)) * 0.05 : 0)

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
    // Lean, then the dive's tip forward, then the tumble (its axis taken into the bean's own frame).
    this.e.set(this.leanF.x + this.dive * Math.PI * 0.47, 0, this.leanS.x, 'YXZ')
    this.pivot.quaternion.setFromEuler(this.e)
    if (tumble > 0) {
      this.va.copy(this.tumbleAxis).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -s.yaw)
      this.qa.setFromAxisAngle(this.va, tumble)
      this.pivot.quaternion.premultiply(this.qa)
    }
    // The visor a beat behind the lean.
    this.e.set((this.lagF - this.leanF.x) * 0.9, 0, (this.lagS - this.leanS.x) * 0.9)
    this.visor.quaternion.setFromEuler(this.e)

    // Running: feet stepping, arms swinging; in the air, arms up and flailing with its speed up or down.
    const run = s.grounded && !s.prone ? Math.min(1, speed / 6) : 0
    if (s.grounded) this.stride += speed * dt * 2.3
    const air = !s.grounded && !s.prone && !s.ledge ? 1 : 0
    const flail = Math.min(1, Math.abs(s.vy) / 9)
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      const ph = this.stride + (i ? Math.PI : 0)
      const arm = this.arms[i]!
      const up = air * (1.6 + 0.5 * flail * Math.sin(this.clock * 19 + i * 2)) + (s.ledge ? 2.6 : 0) + (s.stunned || tumble > 0 ? 1.8 : 0)
      arm.rotation.set(-Math.sin(ph) * 0.8 * run - this.dive * 2.7, 0, side * (0.15 + up * 0.55))
      const foot = this.feet[i]!
      foot.position.z = 0.05 + Math.sin(ph) * 0.15 * run - this.dive * 0.1
      foot.position.y = 0.06 - MID + Math.max(0, Math.cos(ph)) * 0.09 * run + air * (i ? 0.05 : -0.02) * Math.sin(this.clock * 15)
      foot.rotation.x = this.dive * -1.1
    }

    // The eyes: on the nearest hazard if there is one, else where it's going; a blink now and then.
    this.eyeAim.set(0, 0)
    if (look) {
      this.va.set(look.x - s.x, look.y - (s.y + H * 0.8), look.z - s.z)
      const lx = this.va.x * c - this.va.z * sn
      const lz = this.va.x * sn + this.va.z * c
      const l = Math.hypot(lx, this.va.y, lz) || 1
      this.eyeAim.set(Math.max(-1, Math.min(1, (-lx / l) * 1.6)), Math.max(-1, Math.min(1, (this.va.y / l) * 1.6)))
    }
    this.eyeShown.lerp(this.eyeAim, 1 - Math.exp(-dt * 12))
    this.blinkAt -= dt
    if (this.blinkAt <= 0) {
      this.blink = 0.12
      this.blinkAt = 2 + this.rnd() * 3.5
    }
    this.blink = Math.max(0, this.blink - dt)
    this.eyes.position.set(-this.eyeShown.x * 0.035, this.eyeShown.y * 0.03, 0)
    this.eyes.scale.set(1, this.blink > 0 || s.stunned ? 0.18 : 1, 1)

    // Dizzy stars after a yeet; the crown popping on; the drop-in bubble.
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
      const pop = k < 1 ? Math.sin(k * Math.PI) * 0.35 + k : 1
      this.crown.scale.setScalar(pop)
      this.crown.position.y = MID - 0.06 + (1 - k) * 0.9
      this.crown.rotation.y = this.crownFor < 0.6 ? (1 - k) * 4 : 0
    }
    if (this.bubbleFor > 0) {
      this.bubbleFor += dt
      const popped = (s.grounded && !this.wasGrounded) || this.bubbleFor > 0.9
      if (popped) this.bubbleFor = -0.14
      const m = this.bubble.material as THREE.MeshBasicMaterial
      m.opacity = 0.22
      this.bubble.scale.setScalar(0.95 + 0.04 * Math.sin(this.clock * 14))
      this.bubble.visible = true
    } else if (this.bubbleFor < 0) {
      // Popping: swelling as it fades.
      this.bubbleFor = Math.min(0, this.bubbleFor + dt)
      const k = 1 + this.bubbleFor / 0.14
      this.bubble.scale.setScalar(0.95 + k * 0.5)
      ;(this.bubble.material as THREE.MeshBasicMaterial).opacity = 0.22 * (1 - k)
      this.bubble.visible = this.bubbleFor < 0
    } else this.bubble.visible = false
    this.wasGrounded = s.grounded
  }
}

/** The ghosts' colours: the blue bean, someone else's run, your own best. */
export type GhostKind = 'blue' | 'rival' | 'mine'

/** A ghost: the bean seen through, in its colour (or a run's skin, lighter), its name over it when it's the one chased. */
export class GhostBean {
  readonly root = new THREE.Group()
  private readonly pivot = new THREE.Group()
  readonly body: THREE.MeshMatcapMaterial
  readonly visor: THREE.MeshMatcapMaterial
  private prevX = NaN
  private prevY = NaN
  private prevZ = NaN
  private yaw = 0
  private clock = 0
  private spin = 0
  private sq = new Spring()

  constructor(matcap: THREE.Texture, body: THREE.BufferGeometry, visor: THREE.BufferGeometry) {
    const seeThrough = { matcap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 } as const
    this.body = new THREE.MeshMatcapMaterial({ ...seeThrough, opacity: 0.45 })
    this.visor = new THREE.MeshMatcapMaterial({ ...seeThrough, opacity: 0.45 })
    this.root.add(this.pivot)
    this.pivot.position.y = MID
    const b = new THREE.Mesh(body, this.body)
    b.renderOrder = 4
    const v = new THREE.Mesh(visor, this.visor)
    v.position.y = 0.3
    v.renderOrder = 5
    this.pivot.add(b, v)
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
      this.sq.step(dt, state === 1 ? Math.max(-0.1, Math.min(0.12, vy * 0.012)) : 0)
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

/** The geometries every ghost shares (made once). */
export function ghostGeometries(): { body: THREE.BufferGeometry; visor: THREE.BufferGeometry } {
  const visor = visorGeometry()
  return { body: bodyGeometry(16), visor }
}
