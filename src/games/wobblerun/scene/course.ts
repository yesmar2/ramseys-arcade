import * as THREE from 'three'
import { crownAt, hazardBodies, newBody, newPose, solidPose, teleOf } from '../engine/sim.ts'
import type { Body, Course, Deco, Hazard, Role, Solid, Tele, Volume, World } from '../engine/types.ts'
import { blipStarGeometry } from './bean.ts'
import { bake, boxSlab, discSlab, IDENT, Layer, merge, outline, setPoseMatrix, strip, xfOf, type SlabPaint, type Xf } from './geo.ts'
import { CODE, CRACK_AMBER, CRACK_RED, LAMP, mix, patternOf, signPaint, type Painter, type PatternRole, type Tints } from './look.ts'
import type { Tide } from './world.ts'

/*
 * The course in 3D, from the engine's flat arrays (types.ts Course) by each thing's `look` (engine/README.md's
 * table), and by its shape and role for a look this doesn't know yet, so a round can use a new look before the
 * scene has one. Built once:
 *
 *   - Everything that never moves is merged into a few meshes a 24 m chunk of course, one a material (floors,
 *     the white pads, slides, walls, the colour code's patterns, gold edges, dusk's lit trims), and only the
 *     chunks near the camera are drawn.
 *   - Things that move (pads, doors, discs, planks, the start barrier) are a mesh each, built in their own frame
 *     and posed each frame from solidPose (with the run's world, for the touch things); hex tiles are one
 *     instanced mesh, coloured by how cracked they are.
 *   - Hazards are posed from hazardBodies each frame: a mesh each for bars, posts, pendulums and gloves; an
 *     instanced mesh a look for the ones on paths (fruit, boulders, gumballs, Block Party's walls).
 *   - Telegraphs come from teleOf: door lamps, a glove's face flashing in its wind-up, a cannon's swell, a chute's
 *     light, a fan's blur, a pendulum's floor stripe; all the lamps are one instanced mesh and their glows another.
 *   - The finish is the Blip star (the engine's `crown` volume), turning over its pedestal in a mint beacon; Tide
 *     Tower's rising sea (the engine's `slime`) is the soda sea risen, with a light rim.
 *
 * Draw what's near: everything has the z it can reach, and what's out of the camera's stretch isn't drawn.
 */

type MatKey = 'floor' | 'check' | 'slide' | 'plain' | 'ink' | 'jelly' | 'glow' | 'trim' | PatternRole

/** The stretch of course drawn: this far behind the camera and ahead of it, m. */
const BEHIND = 8
const AHEAD = 112
const CHUNK = 24

const WHITE = new THREE.Color(1, 1, 1)
const colours = new Map<string, THREE.Color>()
/** A shared colour for a '#rrggbb' (never changed once made). */
function cc(hex: string): THREE.Color {
  let c = colours.get(hex)
  if (!c) colours.set(hex, (c = new THREE.Color(hex)))
  return c
}
const grey = (k: number) => new THREE.Color(k, k, k)

const FLOORISH = new Set(['floor', 'pad', 'terrace', 'island', 'summit', 'basement', 'drum', 'disc', 'pad-lily', 'pad-gold', 'plank', 'tile'])
const WALLISH = new Set(['rail', 'fence', 'divider'])

/** A light: a lamp's bulb and its glow, one slot each in the two instanced meshes. */
type Light = { x: number; y: number; z: number; size: number; colour: THREE.Color; on: number }

type Mover = {
  i: number
  s: Solid
  mesh: THREE.Mesh
  /** A belt's own texture, scrolled along its run. */
  belt?: { tex: THREE.Texture; speed: number }
  /** A launch pad's material, green while it's lit. */
  lit?: THREE.MeshBasicMaterial
  /** A plank's glow strips, low side lit amber past 8°. */
  glow?: [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial]
  /** Jelly, its own material so it can fade when it's between the camera and Blip; and its frame's. */
  jelly?: THREE.MeshBasicMaterial
  frame?: THREE.MeshBasicMaterial
  pulse: number
}

type HazardView = {
  h: Hazard
  i: number
  obj: THREE.Object3D
  /** The glove's face, flashed white in the wind-up; the arm reaching back to its wall. */
  face?: THREE.MeshBasicMaterial
  arm?: THREE.Object3D
  /** A pendulum's arm from its pivot, and its floor stripe. */
  rod?: THREE.Object3D
  stripe?: THREE.MeshBasicMaterial
  /** The glove's rest, and which way it punches. */
  rest?: THREE.Vector3
  dir?: number
  pulse: number
}

type PathGroup = { mesh: THREE.InstancedMesh; frame?: THREE.InstancedMesh; shape: Hazard['shape']; members: { h: Hazard; axis: THREE.Vector3 }[]; jelly: boolean }

type DecoView = {
  d: Deco
  obj: THREE.Object3D
  kind: 'flag' | 'stripe' | 'cannon' | 'fan'
  mat?: THREE.MeshBasicMaterial
  blades?: THREE.Object3D
  blur?: THREE.MeshBasicMaterial
  light?: number
  spin: number
}

type Occluder = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; z0: number; z1: number; top: number; shown: number }

/** What the course needs to know each frame. */
export type CourseFrame = {
  t: number
  world: World | null
  /** Splits so far (checkpoint flags turn green), and whether GO has come (the start flags). */
  splits: number
  started: boolean
  slime: number
  cam: THREE.Vector3
  bean: THREE.Vector3
  dt: number
  calm: boolean
}

const P = newPose()
const B: Body[] = [newBody()]
const M = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const V = new THREE.Vector3()
const V2 = new THREE.Vector3()
const S = new THREE.Vector3()
const C = new THREE.Color()
const UP = new THREE.Vector3(0, 1, 0)
const CROWN_V = { x: 0, y: 0, z: 0 }
/** The Blip star's mint: its glow, its pedestal's band, its beacon. */
const STAR_GLOW = '#6ff0d2'

export class CourseView {
  readonly group = new THREE.Group()
  private readonly course: Course
  private readonly painter: Painter
  private readonly tints: Tints
  private readonly mats: Record<MatKey, THREE.MeshBasicMaterial>
  private readonly patterns: Record<PatternRole, THREE.Texture>
  private readonly chunks: { mesh: THREE.Mesh; z0: number; z1: number }[] = []
  private readonly occluders: Occluder[] = []
  private readonly movers: Mover[] = []
  private readonly moverOf = new Map<number, Mover>()
  private tiles: { mesh: THREE.InstancedMesh; list: { i: number; s: Solid; base: THREE.Color }[] } | null = null
  private readonly hazards: HazardView[] = []
  private readonly hazardOf = new Map<number, HazardView>()
  private readonly paths: PathGroup[] = []
  private readonly decos: DecoView[] = []
  private readonly hoops: { v: Volume & { kind: 'hoop' }; i: number; obj: THREE.Object3D; glow: THREE.MeshBasicMaterial; pulse: number }[] = []
  private readonly winds: { v: Volume & { kind: 'wind' }; lines: THREE.LineSegments; mat: THREE.LineBasicMaterial; seeds: Float32Array }[] = []
  private crown: { v: Volume & { kind: 'crown' }; obj: THREE.Object3D; glow: THREE.SpriteMaterial; taken: boolean } | null = null
  /** The pedestals' beacons, gone once the star is taken. */
  private readonly beacons: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; z: number; stand: THREE.Mesh; y: number; h: number; sink: number }[] = []
  private slime: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; tex: THREE.Texture; v: Volume & { kind: 'slime' } } | null = null
  private readonly lights: Light[] = []
  private lampMesh: THREE.InstancedMesh | null = null
  private glowMesh: THREE.InstancedMesh | null = null
  /** Lamps by the solid or hazard their telegraph is read from. */
  private readonly lampRefs: { light: number; kind: 'solid' | 'hazard' | 'volume'; i: number; look: string }[] = []
  private readonly signs: { mesh: THREE.Mesh; z: number; top: number; mat: THREE.MeshBasicMaterial; shown: number }[] = []
  private readonly goldSpots: { x: number; y: number; z: number }[] = []
  private readonly jellyColour: string
  private readonly striped = new Set<number>()
  private readonly rnd: () => number
  private flagGreen = { amber: '#f5b942', green: '#3ecf8e' }

  constructor(
    course: Course,
    painter: Painter,
    tints: Tints,
    tex: { floor: THREE.Texture; check: THREE.Texture; slide: THREE.Texture; dot: THREE.Texture; blur: THREE.Texture; shine: THREE.Texture; soda: THREE.Texture; sodaRim: string; patterns: Record<PatternRole, THREE.Texture> },
    rnd: () => number,
  ) {
    this.course = course
    this.painter = painter
    this.tints = tints
    this.rnd = rnd
    this.patterns = tex.patterns
    // Jelly in the day's second mid-tone, so it stands out from the floors it crosses (sky on pink, magenta on indigo).
    const bodies = course.theme.bodies
    this.jellyColour = mix(bodies[1 % bodies.length] ?? '#f08cb8', '#ffffff', 0.12)
    const basic = (o: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ vertexColors: true, ...o })
    this.mats = {
      floor: tints.onWorld(basic({ map: tex.floor })),
      check: tints.onWorld(basic({ map: tex.check })),
      slide: tints.onWorld(basic({ map: tex.slide })),
      plain: tints.onWorld(basic({})),
      ink: tints.onCode(basic({})),
      jelly: tints.onCode(basic({ transparent: true, opacity: 0.6, depthWrite: false })),
      glow: basic({ transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      trim: tints.onTrim(basic({ transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })),
      jump: tints.onCode(basic({ map: tex.patterns.jump })),
      dive: tints.onCode(basic({ map: tex.patterns.dive })),
      dodge: tints.onCode(basic({ map: tex.patterns.dodge })),
      bouncy: tints.onCode(basic({ map: tex.patterns.bouncy })),
      helps: tints.onCode(basic({ map: tex.patterns.helps })),
      pushes: tints.onCode(basic({ map: tex.patterns.pushes })),
      gold: tints.onCode(basic({ map: tex.patterns.gold })),
    }
    // Hazards whose floor stripe the round lays itself (a deco with a ref), so the scene doesn't add another.
    for (const d of course.decos) if (d.look === 'stripe' && d.ref?.kind === 'hazard') this.striped.add(d.ref.i)
    this.buildSolids()
    this.buildHazards()
    this.buildVolumes(tex.shine, tex.dot, tex.soda, tex.sodaRim)
    this.buildDecos(tex.blur)
    this.buildLights(tex.dot)
  }

  /* ------------------------------------------------------------ colours --- */

  /** The theme's floor hue for a solid: its tint, the round's on Big Show days, the round's when it has none. */
  private floorOf(s: { tint: number; round: number }): { top: THREE.Color; body: THREE.Color; hex: string; bodyHex: string } {
    const th = this.course.theme
    const n = th.floors.length
    const k = th.perRound ? Math.max(0, s.round) : s.tint >= 0 ? s.tint : Math.max(0, s.round)
    const hex = th.floors[k % n]!
    const bodyHex = th.bodies[k % th.bodies.length]!
    return { top: cc(hex), body: cc(bodyHex), hex, bodyHex }
  }

  /** How a solid is drawn: which material, and its slab's colours. */
  private paintOf(s: Solid): { mat: MatKey; paint: SlabPaint; trim?: string } {
    const look = s.look
    const pat = patternOf(s.role)
    if (look === 'start-pad' || look === 'check-pad' || look === 'tile-star' || (s.role === 'check' && !FLOORISH.has(look))) {
      return { mat: 'check', paint: { top: WHITE, band: cc('#f1eefa'), body: cc('#cfc7ea'), uvk: 1 / 1.5 }, trim: '#ffffff' }
    }
    if (look === 'slide') {
      const f = this.floorOf(s)
      return { mat: 'slide', paint: { top: cc(mix(f.hex, '#ffffff', 0.2)), body: f.body, uvk: 1 / 2 }, trim: mix(f.hex, '#ffffff', 0.5) }
    }
    if (WALLISH.has(look) || look === 'frame' || look === 'header') {
      if (s.gold) return { mat: 'gold', paint: { top: WHITE, band: WHITE, body: grey(0.86), uvk: 1, sideUv: true } }
      const f = this.floorOf(s)
      return { mat: 'plain', paint: { top: cc('#ffffff'), band: cc('#fff7fc'), body: cc(mix(f.bodyHex, '#ffffff', 0.45)), bandH: 0.18 } }
    }
    if (s.role === 'jelly' || look === 'door' || look === 'barrier' || look === 'tooth-tall') {
      return { mat: 'jelly', paint: { top: cc(mix(this.jellyColour, '#ffffff', 0.6)), band: cc(mix(this.jellyColour, '#ffffff', 0.45)), body: cc(this.jellyColour), bandH: 0.12, foot: 1, noBottom: false } }
    }
    if (look === 'launch-pad') return { mat: 'helps', paint: { top: WHITE, body: grey(0.8), uvk: 1 / 1.2, sideUv: false } }
    if (pat && !FLOORISH.has(look)) return { mat: pat, paint: { top: WHITE, band: grey(0.96), body: grey(0.8), uvk: 1 / 1.2, sideUv: true } }
    if (look === 'turntable' || look === 'belt') return { mat: 'pushes', paint: { top: WHITE, body: grey(0.78), uvk: 1 / 1.2 } }
    // A floor, a pad, a lily pad, a terrace: the day's pastel on its mid-tone body.
    const f = this.floorOf(s)
    const rim = look === 'pad-lily' || look === 'pad-gold' ? cc(mix(f.hex, f.bodyHex, 0.55)) : f.top
    return { mat: 'floor', paint: { top: f.top, band: rim, body: f.body, uvk: 1 / 3 }, trim: mix(f.hex, '#ffffff', 0.45) }
  }

  /* ------------------------------------------------------------- solids --- */

  private chunkLayers = new Map<string, Layer>()
  /** Things over or across the track (door frames, chutes, arches), merged a row at a time so a row can fade. */
  private occLayers = new Map<string, { L: Layer; top: number }>()

  private occLayer(z: number, round: number, top: number): Layer {
    // The row within 0.8 m of z (a door's lamp hangs 0.3 m before its frame), or a new one.
    let o: { L: Layer; top: number } | undefined
    for (const [key, row] of this.occLayers) {
      const [kz, kr] = key.split(':').map(Number)
      if (kr === round && Math.abs(kz! - z) < 0.8) o = row
    }
    if (!o) this.occLayers.set(`${z}:${round}`, (o = { L: new Layer(), top: -Infinity }))
    o.top = Math.max(o.top, top)
    return o.L
  }

  private buildOccluders() {
    for (const { L, top } of this.occLayers.values()) {
      if (L.empty) continue
      const mat = this.tints.onWorld(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1 }))
      const mesh = new THREE.Mesh(L.geometry(), mat)
      mesh.matrixAutoUpdate = false
      this.group.add(mesh)
      this.occluders.push({ mesh, mat, z0: L.z0, z1: L.z1, top, shown: 1 })
    }
    this.occLayers.clear()
  }

  private layer(z: number, mat: MatKey): Layer {
    const key = `${Math.floor(z / CHUNK)}:${mat}`
    let L = this.chunkLayers.get(key)
    if (!L) this.chunkLayers.set(key, (L = new Layer()))
    return L
  }

  private slabInto(L: Layer, xf: Xf, s: Solid, depth: number, paint: SlabPaint) {
    if (s.shape === 'box') boxSlab(L, xf, s.hx, s.hz, depth, paint)
    else discSlab(L, xf, s.r, s.sides ?? (s.r > 1.6 ? 32 : 22), depth, paint)
  }

  /**
   * The gold edge round a gold piece's top, and dusk's lit trim round a floor's. With `open`, only the edges
   * nothing continues past (a floor's seam with the next floor isn't an edge).
   */
  private edges(L: Layer, xf: Xf, s: Solid, colour: string, w: number, open = false) {
    const ring = outline(s.shape, s.hx, s.hz, s.r, s.sides ?? (s.r > 1.6 ? 32 : 22))
    const c = cc(colour)
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k]!
      const b = ring[(k + 1) % ring.length]!
      if (open) {
        // A step out past the edge's middle: is something else's top there, at about this height?
        const mx = (a[0] + b[0]) / 2
        const mz = (a[1] + b[1]) / 2
        const l = Math.hypot(mx, mz) || 1
        const ox = mx + (mx / l) * 0.3
        const oz = mz + (mz / l) * 0.3
        const wx = xf.x + xf.c * ox + xf.s * oz
        const wz = xf.z - xf.s * ox + xf.c * oz
        const wy = xf.y + xf.tr * mx + xf.tp * mz
        const under = this.surfaceBelow(wx, wz, wy + 0.3, 0, null)
        if (under && under.y > wy - 0.3) continue
      }
      strip(L, xf, a[0], a[1], b[0], b[1], w, c, 0.025)
    }
  }

  private buildSolids() {
    const course = this.course
    const tileList: { i: number; s: Solid; base: THREE.Color }[] = []
    course.solids.forEach((s, i) => {
      const dropTile = s.touch?.kind === 'tile' && !s.touch.star
      const moving = !!s.move || (!!s.touch && !dropTile && s.touch.kind !== 'tile')
      const { mat, paint, trim } = this.paintOf(s)
      const depth = Math.max(0.2, 2 * s.hy)
      if (dropTile) {
        tileList.push({ i, s, base: this.floorOf(s).top })
        return
      }
      if (!moving && !s.belt && !s.bounce?.lit && (s.look === 'frame' || s.look === 'header')) {
        // Door frames and headers: over the track, so they fade when they're between the camera and Blip.
        this.slabInto(this.occLayer(s.z, s.round, s.y), xfOf(s.x, s.y, s.z, s.yaw, s.pitch, s.roll), s, depth, paint)
        if (s.gold) this.goldSpots.push({ x: s.x, y: s.y, z: s.z })
        return
      }
      if (moving || s.belt || s.bounce?.lit) {
        this.buildMover(i, s, mat, paint, depth)
        return
      }
      const xf = xfOf(s.x, s.y, s.z, s.yaw, s.pitch, s.roll)
      this.slabInto(this.layer(s.z, mat), xf, s, depth, paint)
      if (s.gold) {
        this.edges(this.layer(s.z, 'glow'), xf, s, CODE.gold, 0.16)
        this.goldSpots.push({ x: s.x, y: s.y, z: s.z })
      } else if (trim && !s.noGround) this.edges(this.layer(s.z, 'trim'), xf, s, trim, 0.1, true)
      if (s.look === 'tile-star') this.star(this.layer(s.z, 'ink'), xf, Math.min(s.r, 1.4) * 0.55)
    })
    for (const [key, L] of this.chunkLayers) {
      if (L.empty) continue
      const mat = key.split(':')[1] as MatKey
      const mesh = new THREE.Mesh(L.geometry(), this.mats[mat])
      mesh.matrixAutoUpdate = false
      if (mat === 'glow' || mat === 'trim') mesh.renderOrder = 1
      if (mat === 'jelly') mesh.renderOrder = 3
      this.group.add(mesh)
      this.chunks.push({ mesh, z0: L.z0, z1: L.z1 })
    }
    this.chunkLayers.clear()
    if (tileList.length) this.buildTiles(tileList)
  }

  /** A gold star painted on a star tile. */
  private star(L: Layer, xf: Xf, r: number) {
    const c = cc(CODE.gold)
    const P2: number[] = []
    const pts: number[] = []
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + Math.PI / 2
      const rr = k % 2 ? r * 0.45 : r
      P2.push(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    const mid = L.vert(xf.x, xf.y + 0.03, xf.z, c, 1, 0, 0)
    for (let k = 0; k < 10; k++) {
      const lx = P2[k * 2]!
      const lz = P2[k * 2 + 1]!
      pts.push(L.vert(xf.x + xf.c * lx + xf.s * lz, xf.y + xf.tr * lx + 0.03 + xf.tp * lz, xf.z - xf.s * lx + xf.c * lz, c, 1, 0, 0))
    }
    for (let k = 0; k < 10; k++) L.tri(mid, pts[k]!, pts[(k + 1) % 10]!, 0, 1, 0)
  }

  private buildMover(i: number, s: Solid, mat: MatKey, paint: SlabPaint, depth: number) {
    const L = new Layer()
    let p = paint
    let material: THREE.MeshBasicMaterial = this.mats[mat]
    const m: Partial<Mover> = { i, s, pulse: 0 }
    if (s.belt) {
      // The belt's arrows run its way: v along the belt, scrolled by its speed.
      const sp = Math.hypot(s.belt.x, s.belt.z)
      const dx = sp > 1e-6 ? s.belt.x / sp : 0
      const dz = sp > 1e-6 ? s.belt.z / sp : 1
      const k = 1 / 1.2
      p = { ...paint, topUv: (lx, lz) => [(lx * dz - lz * dx) * k, (lx * dx + lz * dz) * k] }
      const tex = this.painter.keep(this.patterns.pushes.clone())
      tex.needsUpdate = true
      material = this.tints.onCode(new THREE.MeshBasicMaterial({ vertexColors: true, map: tex }))
      m.belt = { tex, speed: sp * k }
    }
    if (s.bounce?.lit) {
      material = new THREE.MeshBasicMaterial({ vertexColors: true, map: this.patterns.helps })
      m.lit = material
    }
    if (mat === 'jelly') {
      material = this.tints.onCode(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false }))
      m.jelly = material
    }
    this.slabInto(L, IDENT, s, depth, p)
    // A plank's bright stripe down its pivot line, painted in its own mesh.
    if (s.touch?.kind === 'plank') strip(L, IDENT, -0.12, -s.hz, -0.12, s.hz, 0.24, cc('#ffffff'), 0.02, 1, true)
    const mesh = new THREE.Mesh(L.geometry(), material)
    mesh.matrixAutoUpdate = false
    if (mat === 'jelly') {
      // Jelly on a solid frame (design-final §1.5): white edges round it, so it reads however faint it is. A door's
      // frame is its posts and header.
      mesh.renderOrder = 3
      if (s.shape === 'box' && !s.door) {
        m.frame = this.tints.onCode(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1 }))
        mesh.add(new THREE.Mesh(frameGeometry(s.hx, s.hz, 0, -depth, 0.06), m.frame))
      }
    }
    if (s.gold) {
      const gl = new Layer()
      this.edges(gl, IDENT, s, CODE.gold, 0.16)
      const edge = new THREE.Mesh(gl.geometry(), this.mats.glow)
      edge.renderOrder = 1
      mesh.add(edge)
    }
    if (s.touch?.kind === 'plank') {
      // A strip along each long edge of a plank that glows amber as that side goes down past 8°.
      const glows: THREE.MeshBasicMaterial[] = []
      for (const side of [-1, 1]) {
        const gl = new Layer()
        strip(gl, IDENT, side * s.hx, -s.hz, side * s.hx, s.hz, 0.5, cc(CODE.warn), 0.03)
        const gm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
        const g = new THREE.Mesh(gl.geometry(), gm)
        g.renderOrder = 1
        mesh.add(g)
        glows.push(gm)
      }
      m.glow = glows as [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial]
    }
    m.mesh = mesh
    this.group.add(mesh)
    const mover = m as Mover
    this.movers.push(mover)
    this.moverOf.set(i, mover)
  }

  private buildTiles(list: { i: number; s: Solid; base: THREE.Color }[]) {
    // A unit hex tile (radius 1, 1 deep), white, so each one's colour is its own (pastel, amber, red).
    const L = new Layer()
    discSlab(L, IDENT, 1, 6, 1, { top: WHITE, band: grey(0.94), body: grey(0.74), uvk: 1 / 1.5, bandH: 0.2 })
    const mesh = new THREE.InstancedMesh(L.geometry(), this.mats.floor, list.length)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (let k = 0; k < list.length; k++) mesh.setColorAt(k, list[k]!.base)
    mesh.frustumCulled = false
    this.group.add(mesh)
    this.tiles = { mesh, list }
  }

  /* ------------------------------------------------------------ hazards --- */

  /** The material for a hazard part in its role's pattern (or the plain ink when it has none). */
  private codeMat(role: Role): THREE.MeshBasicMaterial {
    const pat = patternOf(role)
    return pat ? this.mats[pat] : this.mats.ink
  }

  /** A bar: a cylinder along local x, its pattern's "up" going round it, so up-chevrons point up on its front. */
  private barGeometry(len: number, r: number): THREE.BufferGeometry {
    const g = new THREE.CylinderGeometry(r, r, 2 * len, 14, 1, true)
    g.rotateZ(-Math.PI / 2)
    const uv = g.attributes.uv!
    const k = 1 / 1.2
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * 2 * len * k, uv.getX(i) * 2 * Math.PI * r * k)
    return bake(g, WHITE)
  }

  private buildHazards() {
    const course = this.course
    const pathGroups = new Map<string, PathGroup>()
    course.hazards.forEach((h, i) => {
      if (h.path) {
        const key = `${h.look}:${h.shape}`
        let g = pathGroups.get(key)
        if (!g) pathGroups.set(key, (g = { mesh: null as unknown as THREE.InstancedMesh, shape: h.shape, members: [], jelly: h.role === 'jelly' || h.look === 'wall-jelly' }))
        // Which way its bodies roll: across the way they go.
        const a = newBody()
        const b = newBody()
        h.path.at(0, 0, clearOff(a))
        const o0 = { x: a.x, z: a.z }
        h.path.at(Math.min(0.4, h.path.life), 0, clearOff(b))
        const dx = b.x - o0.x
        const dz = b.z - o0.z
        const l = Math.hypot(dx, dz)
        g.members.push({ h, axis: l > 1e-4 ? new THREE.Vector3(dz / l, 0, -dx / l) : new THREE.Vector3(1, 0, 0) })
        return
      }
      const view = this.buildHazard(h, i)
      this.hazards.push(view)
      this.hazardOf.set(i, view)
      this.group.add(view.obj)
    })
    for (const g of pathGroups.values()) {
      // Room for every body each can have alive at once.
      let most = 0
      for (const m of g.members) most += Math.ceil(m.h.path!.life / m.h.path!.P) + 1
      const first = g.members[0]!.h
      let geo: THREE.BufferGeometry
      let mat: THREE.MeshBasicMaterial
      if (g.jelly) {
        // Block Party's walls: jelly in the day's jelly colour, seen through, on a white frame.
        geo = bake(new THREE.BoxGeometry(2, 2, 2), cc(this.jellyColour), [1, 1], 0.05)
        mat = this.tints.onCode(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false }))
      } else if (g.shape === 'box') {
        geo = bake(new THREE.BoxGeometry(2, 2, 2), WHITE)
        mat = this.codeMat(first.role)
      } else if (g.shape === 'bar') {
        geo = first.look === 'banana' ? this.bananaGeometry() : this.barGeometry(1, 1)
        mat = this.codeMat(first.role)
      } else {
        // Fruit, boulders and gumballs: a gumball's colours are its own; the rest wear their role's pattern.
        geo = this.ballGeometry(first.look)
        mat = first.look === 'gumball' ? this.mats.ink : this.codeMat(first.role)
      }
      const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, most))
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.count = 0
      mesh.frustumCulled = false
      if (g.jelly) {
        mesh.renderOrder = 3
        // Its frame: white edges, sharing the walls' places.
        const frame = new THREE.InstancedMesh(frameGeometry(1, 1, 1, -1, 0.035), this.mats.ink, Math.max(1, most))
        frame.instanceMatrix = mesh.instanceMatrix
        frame.count = 0
        frame.frustumCulled = false
        g.frame = frame
        this.group.add(frame)
      }
      g.mesh = mesh
      this.group.add(mesh)
      this.paths.push(g)
    }
  }

  /** A ball for a path: banded for fruit and boulders (the dodge red's white bands), a gumball's gloss. */
  private ballGeometry(look: string): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = []
    const ball = new THREE.SphereGeometry(1, 20, 14)
    if (look === 'gumball') {
      parts.push(bake(ball, (x, _y, z) => cc(['#ff6f91', '#ffd23f', '#9b7bff', '#3ec8cf'][Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 4) % 4]!), [1, 1], 0.1))
    } else {
      // Bands round it: the uvs' v runs pole to pole, so two bands a ball.
      parts.push(bake(ball, WHITE, [3, 1]))
    }
    return merge(parts)
  }

  /** A banana: a bar bent a little, in the jump orange. */
  private bananaGeometry(): THREE.BufferGeometry {
    const g = this.barGeometry(1, 1)
    const pos = g.attributes.position!
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      pos.setY(i, pos.getY(i) + (1 - x * x) * 0.6)
    }
    return g
  }

  private buildHazard(h: Hazard, i: number): HazardView {
    const obj = new THREE.Group()
    const view: HazardView = { h, i, obj, pulse: 0 }
    const mat = this.codeMat(h.role)
    if (h.shape === 'bar') {
      obj.add(new THREE.Mesh(this.barGeometry(h.len, h.r), mat))
      const caps = merge(
        [-1, 1].map((side) => {
          const cap = new THREE.SphereGeometry(h.r * 1.04, 12, 8)
          cap.translate(side * h.len, 0, 0)
          return bake(cap, cc('#ffffff'), [1, 1], 0.1)
        }),
      )
      obj.add(new THREE.Mesh(caps, this.mats.ink))
      // The sweep's floor arc: a faint ring of its colour on the floor under it, to read its reach by.
      if (h.move) {
        const floorY = this.surfaceBelow(h.x, h.z, h.y, 0, null)?.y ?? h.y - 0.4
        const ring = new THREE.RingGeometry(Math.max(0.2, h.len - 0.15), h.len + h.r, 56)
        ring.rotateX(-Math.PI / 2)
        const rm = new THREE.MeshBasicMaterial({ color: CODE[h.role === 'dive' ? 'dive' : h.role === 'jump' ? 'jump' : 'dodge'], transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
        const arc = new THREE.Mesh(ring, rm)
        arc.position.set(h.x, floorY + 0.02, h.z)
        arc.renderOrder = 1
        this.group.add(arc)
        view.rod = arc
      }
    } else if (h.shape === 'post') {
      if (h.look === 'bumper') {
        // A mushroom: a stem, and a teal cap with dots.
        const stem = new THREE.CylinderGeometry(h.r * 0.55, h.r * 0.62, h.h * 0.7, 16)
        stem.translate(0, h.h * 0.35, 0)
        obj.add(new THREE.Mesh(bake(stem, cc('#fff4e8')), this.mats.ink))
        const cap = new THREE.SphereGeometry(h.r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
        cap.scale(1, 0.75, 1)
        cap.translate(0, h.h * 0.55, 0)
        const rim = new THREE.CylinderGeometry(h.r, h.r, h.h * 0.12, 20, 1, true)
        rim.translate(0, h.h * 0.52, 0)
        obj.add(new THREE.Mesh(merge([bake(cap, WHITE, [3, 2]), bake(rim, WHITE, [3, 0.3])]), this.mats.bouncy))
      } else {
        // A hub: a teal drum with dots, a yellow ring round its top.
        const drum = new THREE.CylinderGeometry(h.r, h.r * 1.05, h.h, 20)
        drum.translate(0, h.h / 2, 0)
        obj.add(new THREE.Mesh(bake(drum, WHITE, [3, 1.5]), this.codeMat(h.role)))
        const ring = new THREE.TorusGeometry(h.r * 0.92, 0.07, 8, 28)
        ring.rotateX(Math.PI / 2)
        ring.translate(0, h.h + 0.01, 0)
        const cap = new THREE.CircleGeometry(h.r * 0.9, 20)
        cap.rotateX(-Math.PI / 2)
        cap.translate(0, h.h + 0.005, 0)
        obj.add(new THREE.Mesh(merge([bake(ring, cc('#ffd23f'), [1, 1], 0.1), bake(cap, cc('#fff6d6'))]), this.mats.ink))
      }
    } else if (h.shape === 'sphere') {
      const ball = new THREE.SphereGeometry(h.r, 22, 16)
      obj.add(new THREE.Mesh(bake(ball, WHITE, [3, 1]), mat))
      if (h.look === 'pendulum') {
        // The arm from the pivot to the ball (posed each frame), a hub at the pivot.
        const rod = new THREE.Mesh(bake(new THREE.CylinderGeometry(0.07, 0.07, 1, 8), cc('#d8d2ef')), this.mats.ink)
        this.group.add(rod)
        view.rod = rod
        const hub = new THREE.Mesh(bake(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 12).rotateX(Math.PI / 2), cc('#ffd23f')), this.mats.ink)
        hub.position.set(h.x, h.y, h.z)
        this.group.add(hub)
        // Its stripe on the floor under the swing: faint at rest, amber as the ball comes down, red while it's low
        // (unless the round lays its own, a stripe deco with this hazard as its ref).
        const floorY = this.striped.has(i) ? undefined : this.surfaceBelow(h.x, h.z, h.y - 0.5, 0, null)?.y
        if (floorY !== undefined) {
          const sg = new THREE.PlaneGeometry(9, 0.7)
          sg.rotateX(-Math.PI / 2)
          const sm = new THREE.MeshBasicMaterial({ color: CODE.dodge, transparent: true, opacity: 0.15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
          const stripe = new THREE.Mesh(sg, sm)
          stripe.position.set(h.x, floorY + 0.02, h.z)
          stripe.rotation.y = h.yaw
          stripe.renderOrder = 1
          this.group.add(stripe)
          view.stripe = sm
        }
      }
    } else {
      // A box: a boxing glove (a pillowy block, a white cuff, its face flashing in the wind-up) or a plain block.
      const glove = h.look.startsWith('glove')
      if (glove) {
        const body = new THREE.SphereGeometry(1, 18, 12)
        body.scale(h.hx, h.hy, h.hz)
        obj.add(new THREE.Mesh(bake(body, WHITE, [2, 1]), mat))
        // Which way it punches: the way its motion takes it out.
        let most = 0
        for (let t = 0; t < 8; t += 0.05) {
          hazardBodies(h, t, B)
          const d = B[0]!.x - h.x
          if (Math.abs(d) > Math.abs(most)) most = d
        }
        const dir = most >= 0 ? 1 : -1
        view.dir = dir
        view.rest = new THREE.Vector3(h.x, h.y, h.z)
        const face = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
        const fg = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42)
        fg.rotateZ(-dir * (Math.PI / 2))
        fg.scale(h.hx * 1.04, h.hy * 1.04, h.hz * 1.04)
        const faceMesh = new THREE.Mesh(fg, face)
        faceMesh.renderOrder = 2
        obj.add(faceMesh)
        view.face = face
        const cuff = new THREE.CylinderGeometry(h.hy * 0.62, h.hy * 0.62, 0.22, 14)
        cuff.rotateZ(Math.PI / 2)
        cuff.translate(-dir * h.hx * 0.95, 0, 0)
        obj.add(new THREE.Mesh(bake(cuff, cc('#ffffff'), [1, 1], 0.1), this.mats.ink))
        // The arm back to its wall: a piston stretched as it punches.
        const arm = new THREE.Mesh(bake(new THREE.BoxGeometry(1, 0.3, 0.3).translate(-0.5, 0, 0), cc('#d8d2ef')), this.mats.ink)
        this.group.add(arm)
        view.arm = arm
      } else {
        const box = new THREE.BoxGeometry(2 * h.hx, 2 * h.hy, 2 * h.hz)
        obj.add(new THREE.Mesh(bake(box, WHITE, [Math.max(1, h.hx), Math.max(1, h.hy)]), mat))
      }
    }
    obj.position.set(h.x, h.y, h.z)
    obj.rotation.y = h.yaw
    return view
  }

  /* ------------------------------------------------------------ volumes --- */

  private buildVolumes(shine: THREE.Texture, dot: THREE.Texture, soda: THREE.Texture, sodaRim: string) {
    this.course.volumes.forEach((v, i) => {
      if (v.kind === 'hoop') {
        const obj = new THREE.Group()
        obj.position.set(v.x, v.y, v.z)
        obj.rotation.y = Math.atan2(v.dir.x, v.dir.z)
        const ring = new THREE.TorusGeometry(v.r, 0.12, 10, 44)
        const uv = ring.attributes.uv!
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 10, uv.getY(k))
        obj.add(new THREE.Mesh(bake(ring, WHITE, [1, 1], 0.1), this.mats.helps))
        const glow = new THREE.MeshBasicMaterial({ color: CODE.helps, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        const disc = new THREE.Mesh(new THREE.RingGeometry(v.r * 0.55, v.r * 1.18, 40), glow)
        disc.renderOrder = 2
        obj.add(disc)
        this.group.add(obj)
        this.hoops.push({ v, i, obj, glow, pulse: 0 })
      } else if (v.kind === 'wind') {
        const n = 26
        const pos = new Float32Array(n * 6)
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
        const mat = new THREE.LineBasicMaterial({ color: '#c3c8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
        const lines = new THREE.LineSegments(geo, mat)
        lines.frustumCulled = false
        const seeds = new Float32Array(n * 3)
        for (let k = 0; k < seeds.length; k++) seeds[k] = this.rnd()
        this.group.add(lines)
        this.winds.push({ v, lines, mat, seeds })
      } else if (v.kind === 'crown') {
        // The Blip star: turning slowly as it bobs, a soft mint glow round it.
        const obj = new THREE.Group()
        obj.add(new THREE.Mesh(blipStarGeometry(Math.max(0.6, v.r)), new THREE.MeshMatcapMaterial({ matcap: shine, vertexColors: true })))
        const glow = new THREE.SpriteMaterial({ map: dot, color: STAR_GLOW, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
        const halo = new THREE.Sprite(glow)
        halo.scale.setScalar(Math.max(0.6, v.r) * 4)
        halo.renderOrder = 2
        obj.add(halo)
        this.group.add(obj)
        this.crown = { v, obj, glow, taken: false }
      } else if (v.kind === 'slime') {
        // Tide Tower's rising sea: the soda risen up the tower, a light rim round its edges.
        const w = 2 * v.hx + 2
        const len = v.z1 - v.z0 + 4
        const g = new THREE.PlaneGeometry(w, len)
        g.rotateX(-Math.PI / 2)
        const tex = this.painter.keep(soda.clone())
        tex.repeat.set(w / 14, len / 14)
        tex.needsUpdate = true
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false })
        const mesh = new THREE.Mesh(g, mat)
        mesh.position.set(v.x, 0, (v.z0 + v.z1) / 2)
        mesh.visible = false
        mesh.renderOrder = 3
        const rim: THREE.BufferGeometry[] = []
        const band = 0.32
        for (const [cx, cz, sx, sz] of [
          [-w / 2 + band / 2, 0, band, len],
          [w / 2 - band / 2, 0, band, len],
          [0, -len / 2 + band / 2, w, band],
          [0, len / 2 - band / 2, w, band],
        ] as const) {
          const strip = new THREE.PlaneGeometry(sx, sz)
          strip.rotateX(-Math.PI / 2)
          strip.translate(cx, 0.02, cz)
          rim.push(bake(strip, cc('#ffffff')))
        }
        const edge = new THREE.Mesh(merge(rim), new THREE.MeshBasicMaterial({ color: sodaRim, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }))
        edge.renderOrder = 3
        mesh.add(edge)
        this.group.add(mesh)
        this.slime = { mesh, mat, tex, v }
      }
    })
  }

  /* -------------------------------------------------------------- decos --- */

  private addLight(x: number, y: number, z: number, size: number): number {
    this.lights.push({ x, y, z, size, colour: new THREE.Color(LAMP.open), on: 0 })
    return this.lights.length - 1
  }

  private buildDecos(blurTex: THREE.Texture) {
    for (const d of this.course.decos) {
      const look = d.look
      const plain = (z: number) => this.layer(z, 'plain')
      if (look === 'flag' || look === 'gold-flag') {
        // A pole (merged), and its pennant (posed: it flutters, and a checkpoint's turns green).
        const poleH = d.sy || 2.6
        const pole = new THREE.CylinderGeometry(0.05, 0.06, poleH, 8)
        pole.translate(d.x, d.y + poleH / 2, d.z)
        this.mergeInto(plain(d.z), bake(pole, cc('#ffffff')))
        const gold = look === 'gold-flag'
        const shape = new THREE.Shape()
        shape.moveTo(0, 0)
        shape.lineTo(gold ? 0.6 : 0.9, -0.28)
        shape.lineTo(0, -0.56)
        shape.closePath()
        const mat = new THREE.MeshBasicMaterial({ color: gold ? CODE.gold : this.flagGreen.amber, side: THREE.DoubleSide })
        const pennant = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat)
        // Pointing in toward the track's middle, so a pair reads as a gate.
        const toMid = d.x > this.centreOf(d) ? Math.PI : 0
        pennant.position.set(d.x, d.y + poleH - 0.04, d.z)
        pennant.rotation.y = toMid
        this.group.add(pennant)
        this.decos.push({ d, obj: pennant, kind: 'flag', mat, spin: toMid })
      } else if (look === 'stripe') {
        // A painted line: a checkpoint's flag line (amber, then green), a pendulum's warning stripe (its telegraph's
        // colour), or plain white.
        const g = new THREE.PlaneGeometry(d.sx, Math.max(0.1, d.sz))
        g.rotateX(-Math.PI / 2)
        const tele = d.ref?.kind === 'hazard'
        const mat = new THREE.MeshBasicMaterial({
          color: d.params?.checkpoint ? this.flagGreen.amber : tele ? CODE[patternOf(d.role) === 'dodge' ? 'dodge' : 'warn'] : '#ffffff',
          transparent: tele,
          opacity: tele ? 0.15 : 1,
          depthWrite: !tele,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -3,
        })
        const m = new THREE.Mesh(g, mat)
        m.position.set(d.x, d.y + 0.01, d.z)
        m.rotation.y = d.yaw
        this.group.add(m)
        this.decos.push({ d, obj: m, kind: 'stripe', mat, spin: 0 })
      } else if (look === 'lamp') {
        // The lamp's housing (merged); its bulb and glow are lights, coloured from its door's telegraph.
        const box = new THREE.BoxGeometry(Math.max(0.3, d.sx), Math.max(0.2, d.sy), Math.max(0.1, d.sz) + 0.12)
        box.translate(d.x, d.y, d.z + 0.06)
        this.mergeInto(this.occLayer(d.z, d.round, d.y + d.sy / 2), bake(box, cc('#5d4f86')))
        const light = this.addLight(d.x, d.y, d.z - 0.05, Math.max(0.3, d.sx) * 0.42)
        if (d.ref) this.lampRefs.push({ light, kind: d.ref.kind, i: d.ref.i, look: 'lamp' })
      } else if (look === 'chute') {
        // A boulder chute: an arch in the dodge red and white over a dim mouth, its light amber before each
        // release. Over the track, so it fades when it's between the camera and Blip.
        const w = d.sx || 2.4
        const hgt = d.sy || 2.4
        const dep = d.sz || 1.4
        const L = this.occLayer(d.z, d.round, d.y + hgt)
        const red = cc(CODE.dodge)
        const paint: SlabPaint = { top: cc('#ffffff'), band: cc('#ffffff'), body: red, bandH: 0.25 }
        for (const side of [-1, 1]) boxSlab(L, xfOf(d.x + side * (w / 2 - 0.2), d.y + hgt - 0.3, d.z, 0), 0.2, dep / 2, hgt + 0.3, paint)
        boxSlab(L, xfOf(d.x, d.y + hgt, d.z, 0), w / 2, dep / 2, 0.5, paint)
        boxSlab(L, xfOf(d.x, d.y + hgt - 0.5, d.z + dep / 2 - 0.1, 0), w / 2 - 0.4, 0.1, hgt - 0.6, { top: cc('#4a3a72'), body: cc('#3a2c5e'), band: cc('#4a3a72') })
        const light = this.addLight(d.x, d.y + hgt + 0.18, d.z - dep / 2 + 0.2, 0.42)
        if (d.ref) this.lampRefs.push({ light, kind: d.ref.kind, i: d.ref.i, look: 'chute' })
      } else if (look === 'cannon') {
        // A fruit cannon: a barrel on a base, aimed the way its fruit go, swelling and glowing before each shot.
        const obj = new THREE.Group()
        obj.position.set(d.x, d.y, d.z)
        const r = Math.max(0.35, (d.sx || 1) / 2)
        const len = Math.max(0.8, d.sz || 1.4)
        const barrel = new THREE.CylinderGeometry(r * 0.85, r, len, 16, 1, true)
        barrel.rotateX(Math.PI / 2)
        const rim = new THREE.TorusGeometry(r * 0.88, 0.08, 6, 18)
        rim.translate(0, 0, len / 2)
        obj.add(new THREE.Mesh(merge([bake(barrel, cc('#5d4f86')), bake(rim, cc('#ffd23f'), [1, 1], 0.1)]), this.mats.ink))
        const ref = d.ref?.kind === 'hazard' ? this.course.hazards[d.ref.i] : undefined
        let yaw = d.yaw
        if (ref?.path) {
          const a = newBody()
          const b = newBody()
          ref.path.at(0, 0, clearOff(a))
          ref.path.at(Math.min(0.3, ref.path.life), 0, clearOff(b))
          if (Math.hypot(b.x - a.x, b.z - a.z) > 1e-3) yaw = Math.atan2(b.x - a.x, b.z - a.z)
        }
        obj.rotation.y = yaw
        this.group.add(obj)
        const light = this.addLight(d.x, d.y + r + 0.2, d.z, 0.5)
        this.decos.push({ d, obj, kind: 'cannon', light, spin: 0 })
        if (d.ref) this.lampRefs.push({ light, kind: d.ref.kind, i: d.ref.i, look: 'cannon' })
      } else if (look === 'fan') {
        // A fan on a pylon: housing ring, blades turning, a blur disc as they spin up; facing where it blows.
        const obj = new THREE.Group()
        obj.position.set(d.x, d.y, d.z)
        const r = Math.max(0.8, (d.sx || 2.4) / 2)
        const wind = d.ref?.kind === 'volume' ? this.course.volumes[d.ref.i] : undefined
        obj.rotation.y = wind?.kind === 'wind' && Math.hypot(wind.carry.x, wind.carry.z) > 1e-3 && !d.yaw ? Math.atan2(wind.carry.x, wind.carry.z) : d.yaw
        const ring = new THREE.TorusGeometry(r, 0.14, 8, 32)
        const hub = new THREE.SphereGeometry(r * 0.18, 10, 8)
        const pylon = new THREE.BoxGeometry(0.3, Math.max(1, d.sy || 2), 0.3)
        pylon.translate(0, -Math.max(1, d.sy || 2) / 2 - r, 0)
        obj.add(new THREE.Mesh(merge([bake(ring, cc('#e9e4ff')), bake(hub, cc('#ffd23f')), bake(pylon, cc('#bdb3e6'))]), this.mats.ink))
        const blades = new THREE.Group()
        const bl: THREE.BufferGeometry[] = []
        for (let k = 0; k < 4; k++) {
          const b = new THREE.BoxGeometry(r * 0.32, r * 0.92, 0.05)
          b.translate(0, r * 0.5, 0)
          b.rotateZ((k / 4) * Math.PI * 2)
          bl.push(bake(b, cc('#ffffff')))
        }
        blades.add(new THREE.Mesh(merge(bl), this.mats.pushes))
        obj.add(blades)
        const blur = new THREE.MeshBasicMaterial({ map: blurTex, color: '#dfe2ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
        const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 28), blur)
        disc.position.z = 0.04
        disc.renderOrder = 2
        obj.add(disc)
        this.group.add(obj)
        this.decos.push({ d, obj, kind: 'fan', blades, blur, spin: 0 })
      } else if (look === 'arch' || look === 'gantry') {
        // Over the track: two pillars and a beam, a sign on an arch (a stand-in round's name, or the gauntlet's).
        const w = d.sx || 10
        const hgt = d.sy || 4
        const dep = Math.max(0.4, d.sz || 0.6)
        const L = new Layer()
        const f = this.floorOf(d)
        const paint: SlabPaint = { top: cc('#ffffff'), band: cc('#ffffff'), body: cc(mix(f.bodyHex, '#ffffff', 0.25)), bandH: 0.3 }
        for (const side of [-1, 1]) boxSlab(L, xfOf(d.x + side * (w / 2 - 0.3), d.y + hgt, d.z, 0), 0.3, dep / 2, hgt + 0.4, paint)
        boxSlab(L, xfOf(d.x, d.y + hgt + 0.55, d.z, 0), w / 2, dep / 2, 0.6, paint)
        const rowL = this.occLayer(d.z, d.round, d.y + hgt + 0.55)
        this.mergeInto(rowL, L.geometry())
        const text = typeof d.params?.text === 'string' ? d.params.text : look === 'arch' && d.z < 20 ? this.course.name : ''
        if (text) {
          const tex = this.painter.paint(512, 96, signPaint(() => text.toUpperCase(), { fill: '#ffffff', ink: '#3a2a66', edge: CODE.gold }), { text: true })
          const sw = Math.min(w - 1.2, 4.6)
          const sm = new THREE.MeshBasicMaterial({ map: tex, transparent: true })
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * (96 / 512)), sm)
          // Facing the camera, which looks down +z.
          sign.rotation.y = Math.PI
          sign.position.set(d.x, d.y + hgt + 0.3, d.z - dep / 2 - 0.03)
          this.group.add(sign)
          this.signs.push({ mesh: sign, z: d.z, top: d.y + hgt + 0.8, mat: sm, shown: 1 })
        }
      } else if (look === 'gold-edge') {
        const g = new THREE.BoxGeometry(Math.max(0.12, d.sx), 0.05, Math.max(0.12, d.sz))
        g.translate(d.x, d.y + 0.03, d.z)
        this.mergeInto(this.layer(d.z, 'glow'), bake(g, cc(CODE.gold), [1, 1], 0.3))
      } else if (look === 'arrow') {
        // A painted arrow on the floor, pointing params.dir (radians, yaw sense) or the deco's yaw.
        const dir = typeof d.params?.dir === 'number' ? d.params.dir : d.yaw
        const shape = new THREE.Shape()
        const s = Math.max(0.6, d.sx || 1.4)
        shape.moveTo(-s * 0.18, -s * 0.5)
        shape.lineTo(s * 0.18, -s * 0.5)
        shape.lineTo(s * 0.18, 0)
        shape.lineTo(s * 0.42, 0)
        shape.lineTo(0, s * 0.5)
        shape.lineTo(-s * 0.42, 0)
        shape.lineTo(-s * 0.18, 0)
        shape.closePath()
        const g = new THREE.ShapeGeometry(shape)
        g.rotateX(-Math.PI / 2)
        g.rotateY(Math.PI + dir)
        g.translate(d.x, d.y + 0.03, d.z)
        this.mergeInto(this.layer(d.z, 'ink'), bake(g, cc(CODE.pushes)))
      } else if (look === 'pivot') {
        // A see-saw's fulcrum: a wedge under its plank, along its length.
        const w = Math.max(0.3, d.sx)
        const hgt = Math.max(0.3, d.sy)
        const len = Math.max(0.3, d.sz)
        const shape = new THREE.Shape()
        shape.moveTo(-w, 0)
        shape.lineTo(w, 0)
        shape.lineTo(0, hgt)
        shape.closePath()
        const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false })
        g.translate(0, 0, -len / 2)
        g.rotateY(d.yaw)
        g.translate(d.x, d.y, d.z)
        this.mergeInto(this.layer(d.z, 'ink'), bake(g, cc('#ffd23f')))
      } else if (look === 'pedestal') {
        // The Blip star's pedestal: white, a mint band round its top, and a mint beacon rising from it. A mesh of its
        // own, so it can sink away once the star's taken (it would stand between Blip and the camera at the finish).
        const r = Math.max(0.4, (d.sx || 1.2) / 2)
        const h = Math.max(0.2, d.sy || 0.5)
        const g = new THREE.CylinderGeometry(r, r * 1.15, h, 20)
        g.translate(0, h / 2, 0)
        const band = new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.08, 20, 1, true)
        band.translate(0, h - 0.06, 0)
        const stand = new THREE.Mesh(merge([bake(g, cc('#ffffff')), bake(band, cc(STAR_GLOW), [1, 1], 0.3)]), this.mats.plain)
        stand.position.set(d.x, d.y, d.z)
        this.group.add(stand)
        const tall = 7
        const beam = new THREE.CylinderGeometry(r * 0.62, r * 0.8, tall, 20, 6, true)
        const glow = cc(STAR_GLOW)
        const pos = beam.attributes.position!
        const cols = new Float32Array(pos.count * 3)
        for (let k = 0; k < pos.count; k++) {
          const f = Math.pow(Math.max(0, 0.5 - pos.getY(k) / tall), 1.6)
          cols[k * 3] = glow.r * f
          cols[k * 3 + 1] = glow.g * f
          cols[k * 3 + 2] = glow.b * f
        }
        beam.setAttribute('color', new THREE.BufferAttribute(cols, 3))
        beam.translate(d.x, d.y + h + tall / 2, d.z)
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
        const mesh = new THREE.Mesh(beam, mat)
        mesh.renderOrder = 2
        this.group.add(mesh)
        this.beacons.push({ mesh, mat, z: d.z, stand, y: d.y, h, sink: 0 })
      } else {
        // Pillars, pylons, the slide's lip and anything new: a block of its size standing at its place.
        const g = new THREE.BoxGeometry(Math.max(0.05, d.sx), Math.max(0.05, d.sy), Math.max(0.05, d.sz))
        g.rotateY(d.yaw)
        g.translate(d.x, d.y + Math.max(0.05, d.sy) / 2, d.z)
        const pat = patternOf(d.role)
        this.mergeInto(pat ? this.layer(d.z, pat) : plain(d.z), bake(g, pat ? WHITE : cc(look === 'lip' ? '#ffffff' : '#ece6ff')))
      }
    }
    this.buildOccluders()
    // The deco layers built after the solids' chunks: give them meshes too.
    for (const [key, L] of this.chunkLayers) {
      if (L.empty) continue
      const mat = key.split(':')[1] as MatKey
      const mesh = new THREE.Mesh(L.geometry(), this.mats[mat])
      mesh.matrixAutoUpdate = false
      if (mat === 'glow') mesh.renderOrder = 1
      this.group.add(mesh)
      this.chunks.push({ mesh, z0: L.z0, z1: L.z1 })
    }
    this.chunkLayers.clear()
  }

  /** A baked three shape's triangles into a layer (merged dressing). */
  private mergeInto(L: Layer, g: THREE.BufferGeometry) {
    const pos = g.attributes.position!
    const col = g.attributes.color!
    const uv = g.attributes.uv!
    const base = L.pos.length / 3
    for (let k = 0; k < pos.count; k++) {
      C.setRGB(col.getX(k), col.getY(k), col.getZ(k))
      L.vert(pos.getX(k), pos.getY(k), pos.getZ(k), C, 1, uv.getX(k), uv.getY(k))
    }
    const idx = g.index!
    for (let k = 0; k < idx.count; k++) L.idx.push(idx.getX(k) + base)
    g.dispose()
  }

  private centreOf(d: Deco): number {
    for (const r of this.course.rounds) if (d.z >= r.z0 && d.z < r.z1) return r.x
    for (const p of this.course.pieces) if (d.z >= p.z0 && d.z < p.z1) return p.x
    return 0
  }

  private buildLights(dot: THREE.Texture) {
    if (!this.lights.length) return
    const n = this.lights.length
    this.lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), n)
    const quad = new THREE.PlaneGeometry(1, 1)
    quad.rotateY(Math.PI)
    this.glowMesh = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), n)
    for (const m of [this.lampMesh, this.glowMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.frustumCulled = false
      for (let k = 0; k < n; k++) m.setColorAt(k, WHITE)
      this.group.add(m)
    }
    this.glowMesh.renderOrder = 4
  }

  /** Flag colours for the theme (the site's: amber flags turning green). */
  setFlagColours(amber: string, green: string) {
    this.flagGreen = { amber, green }
  }

  /* ----------------------------------------------------- what's near you --- */

  /**
   * The highest top under (x, z) no higher than `top` (+5 cm), of anything stood on, at clock t (the run's world
   * for the touch things, or null): its height and its slope. Null over nothing.
   */
  surfaceBelow(x: number, z: number, top: number, t: number, world: World | null): { y: number; gx: number; gz: number } | null {
    const course = this.course
    const g = course.grid
    const cell = Math.max(0, Math.min(g.solids.length - 1, Math.floor((z - g.z0) / g.cell)))
    const list = g.solids[cell]!
    let best = -Infinity
    let gx = 0
    let gz = 0
    for (let n = 0; n < list.length; n++) {
      const i = list[n]!
      const s = course.solids[i]!
      if (s.noGround || s.door) continue
      solidPose(course, world, i, t, P)
      if (!P.on) continue
      const dx = x - P.x
      const dz = z - P.z
      const c = Math.cos(P.yaw)
      const sn = Math.sin(P.yaw)
      const lx = dx * c - dz * sn
      const lz = dx * sn + dz * c
      if (s.shape === 'box' ? Math.abs(lx) > s.hx || Math.abs(lz) > s.hz : Math.hypot(lx, lz) > s.r) continue
      const tp = Math.tan(P.pitch)
      const tr = Math.tan(P.roll)
      const y = P.y + lz * tp + lx * tr
      if (y > top + 0.05 || y <= best) continue
      best = y
      gx = tr * c + tp * sn
      gz = -tr * sn + tp * c
    }
    return best > -Infinity ? { y: best, gx, gz } : null
  }

  /** The nearest hazard body within `within` m of (x, y, z) at clock t, into `out`; false if none. */
  nearestHazard(x: number, y: number, z: number, t: number, within: number, out: THREE.Vector3): boolean {
    const course = this.course
    const g = course.grid
    const cell = Math.max(0, Math.min(g.hazards.length - 1, Math.floor((z - g.z0) / g.cell)))
    const list = g.hazards[cell]!
    let bd = within * within
    let found = false
    for (let n = 0; n < list.length; n++) {
      const h = course.hazards[list[n]!]!
      const count = hazardBodies(h, t, B)
      for (let k = 0; k < count; k++) {
        const b = B[k]!
        if (!b.on) continue
        const d = (b.x - x) ** 2 + (b.y - y) ** 2 + (b.z - z) ** 2
        if (d < bd) {
          bd = d
          out.set(b.x, b.y, b.z)
          found = true
        }
      }
    }
    return found
  }

  /** Where checkpoint k's flags are (for its confetti). */
  flagsOf(k: number): THREE.Vector3[] {
    return this.decos.filter((d) => d.kind === 'flag' && d.d.params?.checkpoint === k).map((d) => new THREE.Vector3(d.d.x, d.d.y + (d.d.sy || 2.6), d.d.z))
  }

  /** The star's place now (the engine's crown), and whether it's still there to take. */
  crownAt(t: number, out: THREE.Vector3): boolean {
    if (!this.crown) return false
    crownAt(this.crown.v, t, CROWN_V)
    out.set(CROWN_V.x, CROWN_V.y, CROWN_V.z)
    return !this.crown.taken
  }

  /* ------------------------------------------------------------ moments --- */

  /** A pad threw Blip: it squashes and springs back. A hazard bonked Blip: it swells a moment. */
  pulseSolid(i: number) {
    const m = this.moverOf.get(i)
    if (m) m.pulse = 1
  }
  pulseHazard(i: number) {
    const h = this.hazardOf.get(i)
    if (h) h.pulse = 1
  }
  pulseHoop(i: number) {
    const h = this.hoops.find((o) => o.i === i)
    if (h) h.pulse = 1
  }
  takeCrown(taken: boolean) {
    if (this.crown) this.crown.taken = taken
  }

  /** The risen tide now, if it's up and near (for its bubbles). */
  tideAt(out: Tide): boolean {
    const sl = this.slime
    if (!sl || !sl.mesh.visible) return false
    out.x = sl.v.x
    out.hx = sl.v.hx
    out.z0 = sl.v.z0
    out.z1 = sl.v.z1
    out.y = sl.mesh.position.y
    return true
  }

  /** The look's shade for the soda (the risen tide's; the sea's own is the world's). */
  setSea(shade: string) {
    this.slime?.mat.color.set(shade)
  }

  /* -------------------------------------------------------------- frame --- */

  private seen(z0: number, z1: number, cz: number) {
    return z1 > cz - BEHIND && z0 < cz + AHEAD
  }

  /** How much something between the camera and Blip shows: 35% when it's in the way, else all. */
  private fadeFor(z0: number, z1: number, top: number, f: CourseFrame): number {
    const cam = f.cam
    const bean = f.bean
    if (z1 < cam.z - 1 || z0 > bean.z - 0.35) return 1
    // Right over the camera: nearly gone, so it doesn't sweep across the screen as a haze.
    if (z0 < cam.z + 2.5) return 0.1
    const z = Math.max(z0, cam.z)
    const k = (z - cam.z) / Math.max(0.5, bean.z - cam.z)
    const sight = cam.y + (bean.y + 0.8 - cam.y) * k
    return top > sight - 0.2 ? 0.35 : 1
  }

  update(f: CourseFrame) {
    const t = f.t
    const cz = f.cam.z
    const ease = 1 - Math.exp(-f.dt * 10)
    for (const c of this.chunks) c.mesh.visible = this.seen(c.z0, c.z1, cz)
    for (const o of this.occluders) {
      o.mesh.visible = this.seen(o.z0, o.z1, cz)
      if (!o.mesh.visible) continue
      o.shown += (this.fadeFor(o.z0, o.z1, o.top, f) - o.shown) * ease
      o.mat.opacity = o.shown
      o.mat.depthWrite = o.shown > 0.95
    }
    for (const s of this.signs) {
      s.mesh.visible = this.seen(s.z - 1, s.z + 1, cz)
      s.shown += (this.fadeFor(s.z - 0.5, s.z + 0.5, s.top, f) - s.shown) * ease
      s.mat.opacity = s.shown
    }

    // Moving solids, posed where the clock (and the run's touch things) have them.
    for (const m of this.movers) {
      const s = m.s
      const vis = this.seen(s.z0, s.z1, cz)
      m.mesh.visible = vis
      if (!vis) continue
      solidPose(this.course, f.world, m.i, t, P)
      if (!P.on && s.look === 'barrier') {
        m.mesh.visible = false
        continue
      }
      setPoseMatrix(m.mesh.matrix, P.x, P.y, P.z, P.yaw, P.pitch, P.roll)
      if (m.pulse > 0) {
        // A bounce pad's squash: down and wider, springing back.
        const k = Math.sin(m.pulse * Math.PI * 3) * m.pulse * 0.22
        M.makeScale(1 + k * 0.5, 1 - k, 1 + k * 0.5)
        m.mesh.matrix.multiply(M)
        m.pulse = Math.max(0, m.pulse - f.dt * 2.6)
      }
      m.mesh.matrixWorldNeedsUpdate = true
      if (m.belt) m.belt.tex.offset.y = -((t * m.belt.speed) % 1)
      if (m.lit) m.lit.color.set(s.bounce?.lit?.(t) ? '#ffffff' : '#8d8a9e')
      if (m.glow) {
        // Past 8° the low side glows amber, brighter the further it's tipped.
        const tip = P.roll
        const k = Math.max(0, Math.min(1, (Math.abs(tip) - (8 * Math.PI) / 180) / ((8 * Math.PI) / 180)))
        m.glow[0].opacity = tip > 0 ? 0 : k * 0.85
        m.glow[1].opacity = tip > 0 ? k * 0.85 : 0
        // Unlit, they're not drawn at all.
        m.glow[0].visible = m.glow[0].opacity > 0.01
        m.glow[1].visible = m.glow[1].opacity > 0.01
      }
      if (m.jelly) {
        const top = P.y
        const shown = this.fadeFor(P.z - s.hz, P.z + s.hz, top, f)
        m.jelly.opacity += (0.6 * shown - m.jelly.opacity) * ease
        if (m.frame) {
          m.frame.opacity = m.jelly.opacity / 0.6
          m.frame.depthWrite = m.frame.opacity > 0.95
        }
      }
    }

    // Hex tiles: pastel, then amber, then red as they crack, shaking; a dropped one falls away.
    if (this.tiles) {
      const { mesh, list } = this.tiles
      let n = 0
      for (let k = 0; k < list.length; k++) {
        const { i, s, base } = list[k]!
        if (!this.seen(s.z0, s.z1, cz)) {
          M.makeScale(0, 0, 0)
          mesh.setMatrixAt(k, M)
          continue
        }
        solidPose(this.course, f.world, i, t, P)
        const shake = P.crack > 0 && P.on && !f.calm ? Math.sin(t * 47 + k) * 0.04 * P.crack : 0
        const gone = !P.on && P.y < s.y - 12
        Q.setFromEuler(E.set(0, P.yaw, 0))
        M.compose(V.set(P.x + shake, P.y, P.z + shake * 0.6), Q, S.set(gone ? 0 : s.r, gone ? 0 : 2 * s.hy, gone ? 0 : s.r))
        mesh.setMatrixAt(k, M)
        if (P.crack <= 0) C.copy(base)
        else if (P.crack < 0.5) C.copy(base).lerp(cc(CRACK_AMBER), P.crack * 2)
        else C.copy(cc(CRACK_AMBER)).lerp(cc(CRACK_RED), (P.crack - 0.5) * 2)
        mesh.setColorAt(k, C)
        n++
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.visible = n > 0
    }

    // Hazards.
    for (const v of this.hazards) {
      const h = v.h
      const vis = this.seen(h.z0, h.z1, cz)
      v.obj.visible = vis
      if (v.rod) v.rod.visible = vis
      if (v.arm) v.arm.visible = vis
      if (!vis) continue
      hazardBodies(h, t, B)
      const b = B[0]!
      v.obj.visible = b.on
      if (h.shape === 'bar') {
        v.obj.position.set(b.x, b.y, b.z)
        v.obj.rotation.y = b.yaw
      } else if (h.shape === 'sphere') {
        v.obj.position.set(b.x, b.y, b.z)
        if (v.rod && h.look === 'pendulum') {
          // The arm from the pivot (the anchor) to the ball.
          V.set(h.x, h.y, h.z)
          V2.set(b.x, b.y, b.z)
          const len = V.distanceTo(V2)
          v.rod.position.copy(V).add(V2).multiplyScalar(0.5)
          v.rod.scale.set(1, Math.max(0.01, len - h.r * 0.5), 1)
          v.rod.quaternion.setFromUnitVectors(UP, V2.sub(V).normalize().negate())
        }
        if (v.stripe) {
          const tele = teleOf(h, t)
          const target = tele.state === 'act' ? 0.55 : tele.state === 'warn' ? 0.25 + 0.2 * Math.sin(t * 30) : 0.12
          v.stripe.opacity += (target - v.stripe.opacity) * ease
          v.stripe.color.set(tele.state === 'warn' ? CODE.warn : CODE.dodge)
        }
      } else if (h.shape === 'post') {
        v.obj.position.set(b.x, b.y, b.z)
        v.obj.rotation.y = b.yaw
      } else {
        v.obj.position.set(b.x, b.y, b.z)
        v.obj.rotation.y = b.yaw
        if (v.face) {
          // The glove's face flashes white through its wind-up, quicker as it comes; it swells as it pulls back.
          const tele = teleOf(h, t)
          const warn = tele.state === 'warn'
          v.face.opacity = warn ? (Math.sin(tele.u * tele.u * 40) > 0 ? 0.75 : 0.15) : tele.state === 'act' ? 0.4 : 0
          const swell = warn ? 1 + 0.08 * tele.u : 1
          v.obj.scale.setScalar(swell)
        }
        if (v.arm && v.rest && v.dir) {
          // The piston from behind its rest to the glove's back.
          const back = h.x - v.dir * (h.hx + 1.2)
          const front = b.x - v.dir * h.hx * 0.9
          const len = Math.max(0.05, (front - back) * v.dir)
          v.arm.position.set(front, b.y, b.z)
          v.arm.rotation.y = v.dir > 0 ? 0 : Math.PI
          v.arm.scale.set(len, 1, 1)
        }
      }
      if (v.pulse > 0) {
        const k = 1 + Math.sin(v.pulse * Math.PI) * 0.18
        v.obj.scale.setScalar(k)
        v.pulse = Math.max(0, v.pulse - f.dt * 4)
      }
    }

    // Hazards on paths: every live body, one instance each.
    for (const g of this.paths) {
      let n = 0
      for (const { h, axis } of g.members) {
        if (!this.seen(h.z0, h.z1, cz)) continue
        const count = hazardBodies(h, t, B)
        for (let k = 0; k < count; k++) {
          const b = B[k]!
          if (!b.on) continue
          if (g.shape === 'sphere') {
            Q.setFromAxisAngle(axis, b.yaw - h.yaw)
            S.setScalar(h.r)
          } else if (g.shape === 'bar') {
            Q.setFromEuler(E.set(0, b.yaw, 0))
            S.set(h.len, h.r, h.r)
          } else {
            Q.setFromEuler(E.set(0, b.yaw, 0))
            S.set(h.hx, b.hy >= 0 ? b.hy : h.hy, h.hz)
          }
          M.compose(V.set(b.x, b.y, b.z), Q, S)
          if (n < g.mesh.instanceMatrix.count) g.mesh.setMatrixAt(n++, M)
        }
      }
      g.mesh.count = n
      g.mesh.instanceMatrix.needsUpdate = true
      // An instanced mesh with nothing in it still costs a draw call: hide it.
      g.mesh.visible = n > 0
      if (g.frame) {
        g.frame.count = n
        g.frame.visible = n > 0
      }
    }

    // Volumes: hoops pulsing when passed, wind streaking while it blows, the star bobbing, the tide rising.
    for (const o of this.hoops) {
      o.obj.visible = this.seen(o.v.z0, o.v.z1, cz)
      if (!o.obj.visible) continue
      const beat = 1 + 0.04 * Math.sin(t * 5 + o.i)
      const k = o.pulse > 0 ? 1 + Math.sin(o.pulse * Math.PI) * 0.35 : beat
      o.obj.scale.setScalar(k)
      o.glow.opacity = 0.2 + o.pulse * 0.6
      o.pulse = Math.max(0, o.pulse - f.dt * 3)
    }
    for (const w of this.winds) {
      const v = w.v
      w.lines.visible = this.seen(v.z0, v.z1, cz)
      if (!w.lines.visible) continue
      const duty = v.duty(t)
      w.mat.opacity = duty * 0.55
      if (duty <= 0.01) continue
      const sp = Math.hypot(v.carry.x, v.carry.z) || 1
      const dx = v.carry.x / sp
      const dz = v.carry.z / sp
      const span = Math.abs(dx) * 2 * v.hx + Math.abs(dz) * 2 * v.hz || 1
      const pos = w.lines.geometry.attributes.position as THREE.BufferAttribute
      const n = w.seeds.length / 3
      for (let k = 0; k < n; k++) {
        const a = w.seeds[k * 3]!
        const b = w.seeds[k * 3 + 1]!
        const c = w.seeds[k * 3 + 2]!
        const along = ((t * (sp * 2.2 + 3) + a * span) % span) - span / 2
        const across = (b - 0.5) * 2
        const x0 = v.x + dx * along - dz * across * v.hx
        const z0 = v.z + dz * along + dx * across * v.hz
        const y0 = v.y + (c - 0.5) * 2 * v.hy * 0.8
        const len = 0.8 + c * 0.8
        pos.setXYZ(k * 2, x0, y0, z0)
        pos.setXYZ(k * 2 + 1, x0 + dx * len, y0, z0 + dz * len)
      }
      pos.needsUpdate = true
    }
    if (this.crown) {
      const c = this.crown
      c.obj.visible = !c.taken && this.seen(c.v.z0, c.v.z1, cz)
      if (c.obj.visible) {
        crownAt(c.v, t, CROWN_V)
        c.obj.position.set(CROWN_V.x, CROWN_V.y, CROWN_V.z)
        c.obj.rotation.y = t * 0.9
        c.glow.opacity = 0.42 + 0.14 * Math.sin(t * 3.1)
      }
    }
    const taken = this.crown?.taken ?? false
    for (const b of this.beacons) {
      const seen = this.seen(b.z - 3, b.z + 3, cz)
      b.mesh.visible = !taken && seen
      if (b.mesh.visible) b.mat.opacity = 0.5 + 0.1 * Math.sin(t * 2.2)
      // The pedestal sinks into the summit once the star's taken (and is back up for a new run).
      b.sink = taken ? Math.min(1, b.sink + f.dt * 2.2) : 0
      b.stand.position.y = b.y - b.sink * b.sink * (b.h + 0.02)
      b.stand.visible = seen && b.sink < 1
    }
    if (this.slime) {
      const sl = this.slime
      const y = f.slime
      sl.mesh.visible = y === y && this.seen(sl.v.z0, sl.v.z1, cz)
      if (sl.mesh.visible) {
        sl.mesh.position.y = y
        sl.tex.offset.set(Math.sin(t * 0.07) * 0.2, t * 0.02)
      }
    }

    // Decos: flags, stripes, cannons, fans.
    for (const d of this.decos) {
      const vis = this.seen(d.d.z - 3, d.d.z + 3, cz)
      d.obj.visible = vis
      if (!vis) continue
      if (d.kind === 'flag' && d.mat) {
        const k = d.d.params?.checkpoint
        const green = typeof k === 'number' ? f.splits >= k : d.d.params?.start ? f.started : false
        if (d.d.look !== 'gold-flag') d.mat.color.set(green ? this.flagGreen.green : this.flagGreen.amber)
        d.obj.rotation.y = d.spin + (f.calm ? 0 : Math.sin(t * 4.2 + d.d.x) * 0.22)
      } else if (d.kind === 'stripe' && d.mat && typeof d.d.params?.checkpoint === 'number') {
        d.mat.color.set(f.splits >= d.d.params.checkpoint ? this.flagGreen.green : this.flagGreen.amber)
      } else if (d.kind === 'stripe' && d.mat && d.d.ref?.kind === 'hazard') {
        const tele = teleOf(this.thing('hazard', d.d.ref.i), t)
        const target = tele.state === 'act' ? 0.6 : tele.state === 'warn' ? 0.3 + 0.2 * Math.sin(t * 30) : 0.14
        d.mat.opacity += (target - d.mat.opacity) * ease
        d.mat.color.set(tele.state === 'warn' ? CODE.warn : CODE.dodge)
      } else if (d.kind === 'cannon' && d.d.ref) {
        const tele = teleOf(this.thing(d.d.ref.kind, d.d.ref.i), t)
        const k = tele.state === 'warn' ? 1 + 0.16 * tele.u * tele.u : tele.state === 'act' ? 1.1 - 0.4 * tele.u * 0.25 : 1
        d.obj.scale.set(k, k, tele.state === 'act' ? 0.9 + 0.1 * tele.u : 1)
      } else if (d.kind === 'fan' && d.blades && d.blur) {
        const tele = d.d.ref ? teleOf(this.thing(d.d.ref.kind, d.d.ref.i), t) : ({ state: 'act', u: 0 } as Tele)
        // Blade speed: slow at rest, winding up in the warn, a blur while it blows, slowing after.
        const speed = tele.state === 'rest' ? 1.2 : tele.state === 'warn' ? 2 + tele.u * 22 : tele.state === 'act' ? 26 : 26 * (1 - tele.u) + 1.2
        d.spin += speed * f.dt
        d.blades.rotation.z = d.spin
        d.blur.opacity = Math.min(0.75, Math.max(0, (speed - 6) / 20))
      }
    }

    // Lights: door lamps, chute and cannon lights, from their things' telegraphs.
    if (this.lampMesh && this.glowMesh) {
      // Passed lights go dark: they warn of what's ahead, and a bulb by the camera would fill the screen.
      const lit = (L: Light) => this.seen(L.z - 1, L.z + 1, cz) && L.z > f.bean.z - 0.6
      for (const r of this.lampRefs) {
        const L = this.lights[r.light]!
        if (lit(L)) this.lightFor(r.look, teleOf(this.thing(r.kind, r.i), t), t, L)
      }
      let shown = 0
      for (let k = 0; k < this.lights.length; k++) {
        const L = this.lights[k]!
        const vis = lit(L)
        if (vis) shown++
        const s = vis ? L.size : 0
        M.compose(V.set(L.x, L.y, L.z), Q.identity(), S.setScalar(s * (0.55 + 0.45 * L.on)))
        this.lampMesh.setMatrixAt(k, M)
        this.lampMesh.setColorAt(k, C.copy(L.colour).multiplyScalar(0.45 + 0.55 * L.on))
        M.compose(V.set(L.x, L.y, L.z - 0.05), Q, S.setScalar(vis ? s * 2.6 * (0.5 + 0.5 * L.on) : 0))
        this.glowMesh.setMatrixAt(k, M)
        this.glowMesh.setColorAt(k, C.copy(L.colour).multiplyScalar(0.12 + 0.5 * L.on))
      }
      for (const m of [this.lampMesh, this.glowMesh]) {
        m.visible = shown > 0
        m.instanceMatrix.needsUpdate = true
        if (m.instanceColor) m.instanceColor.needsUpdate = true
      }
    }
  }

  /** Gold sparkles: now and then a glint off a gold piece near the camera. */
  goldGlint(cz: number, out: THREE.Vector3): boolean {
    const near = this.goldSpots.filter((g) => g.z > cz + 4 && g.z < cz + 40)
    if (!near.length) return false
    const g = near[Math.floor(this.rnd() * near.length)]!
    out.set(g.x + (this.rnd() - 0.5) * 2, g.y + 0.2, g.z + (this.rnd() - 0.5) * 2)
    return true
  }

  private thing(kind: 'solid' | 'hazard' | 'volume', i: number): { tele?: (t: number) => Tele } {
    if (kind === 'solid') return this.course.solids[i] ?? {}
    if (kind === 'hazard') return this.course.hazards[i] ?? {}
    const v = this.course.volumes[i]
    return v?.kind === 'wind' ? v : {}
  }

  /** A lamp's colour from its thing's telegraph: a door's green, blinking amber, red; a chute's or cannon's amber before it goes. */
  private lightFor(look: string, tele: Tele, t: number, L: Light) {
    if (look === 'lamp') {
      if (tele.state === 'rest') {
        L.colour.set(LAMP.open)
        L.on = 0.8
      } else if (tele.state === 'warn') {
        L.colour.set(LAMP.warn)
        L.on = Math.sin(t * Math.PI * 2 * 6) > 0 ? 1 : 0.15
      } else if (tele.state === 'back') {
        L.colour.set(LAMP.warn)
        L.on = 0.6
      } else {
        L.colour.set(LAMP.shut)
        L.on = 1
      }
    } else {
      if (tele.state === 'warn') {
        L.colour.set(LAMP.warn)
        L.on = Math.sin(t * Math.PI * 2 * (3 + tele.u * 6)) > 0 ? 1 : 0.2
      } else if (tele.state === 'act') {
        L.colour.set(LAMP.shut)
        L.on = 1
      } else {
        L.colour.set('#8f86b8')
        L.on = 0
      }
    }
  }
}

/**
 * A box's twelve edges as thin white bars: hx × hz across, from y `top` down to `bottom` (a slab's top is at 0 and
 * its foot −depth; a centred box's −1 to 1, top 1), each bar `t` thick.
 */
function frameGeometry(hx: number, hz: number, top: number, bottom: number, t: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const h = top - bottom
  const my = (top + bottom) / 2
  const white = cc('#ffffff')
  for (const sy of [top, bottom]) {
    for (const sz of [-1, 1]) {
      const bar = new THREE.BoxGeometry(2 * hx + t, t, t)
      bar.translate(0, sy, sz * hz)
      parts.push(bake(bar, white, [1, 1], 0.2))
    }
    for (const sx of [-1, 1]) {
      const bar = new THREE.BoxGeometry(t, t, 2 * hz + t)
      bar.translate(sx * hx, sy, 0)
      parts.push(bake(bar, white, [1, 1], 0.2))
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bar = new THREE.BoxGeometry(t, h, t)
      bar.translate(sx * hx, my, sz * hz)
      parts.push(bake(bar, white, [1, 1], 0.2))
    }
  }
  return merge(parts)
}

/** An offset zeroed, for calling a path's `at` outside the engine (which zeroes its own). */
function clearOff(b: Body): { x: number; y: number; z: number; yaw: number; on: boolean; hy: number } {
  b.x = b.y = b.z = b.yaw = 0
  b.on = true
  b.hy = -1
  return b
}

