import * as THREE from 'three'
import type { Course, Theme } from '../engine/types.ts'
import { bake, merge } from './geo.ts'
import type { Fx } from './fx.ts'
import { mix, type Painter, type SkyLook, type Tints } from './look.ts'

/*
 * Everything round the course: the sky (an afternoon in light, dusk with stars in dark, Neon Night's night in
 * either), the sun or the moon, the goo the course floats over, and the day's scenery (design-final §4.5):
 * instanced, 12–40 m off the track, standing in the goo or floating over it, a draw call or two a kind. Set
 * dressing only: nothing out here is ever within reach of the track.
 */

type Placement = 'goo' | 'air' | 'sky'
type Motion = 'bob' | 'drift' | 'rise' | 'spin' | 'sway' | 'none'
type Part = { geo: THREE.BufferGeometry; tint: boolean; opacity?: number; additive?: boolean }
type Kind = {
  parts: Part[]
  place: Placement
  size: [number, number]
  /** Items a side every 10 m of course. */
  density: number
  motion: Motion
  /** Off the track's middle, m. */
  off?: [number, number]
  /** Colours to tint the tinted parts by, in turn. */
  colours?: readonly string[]
  /** Only this many in all (a lighthouse). */
  most?: number
  /** Laid by a rule of its own rather than scattered: Neon Night's light strings, Big Show's stands. */
  fill?: 'strings' | 'stands'
  /** How far it reaches out from its middle, a unit of size: its near edge is kept 12 m or more off the track. */
  reach?: number
}
type Item = { x: number; y: number; z: number; s: number; yaw: number; tilt: number; ph: number; c: number; sy?: number }
type Built = { kind: Kind; meshes: THREE.InstancedMesh[]; items: Item[] }

const M = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const V = new THREE.Vector3()
const S = new THREE.Vector3()
const C = new THREE.Color()

/** A colour for `bake`. */
const col = (hex: string) => new THREE.Color(hex)

function daisy(): Part[] {
  const parts: THREE.BufferGeometry[] = []
  const stem = new THREE.CylinderGeometry(0.05, 0.07, 1, 6)
  stem.translate(0, -0.5, 0)
  parts.push(bake(stem, col('#6cbf6a')))
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2
    const petal = new THREE.SphereGeometry(0.1, 8, 4)
    petal.scale(0.75, 2.1, 0.25)
    petal.translate(0, 0.27, 0)
    petal.rotateZ(a)
    parts.push(bake(petal, col('#ffffff'), [1, 1], 0.1))
  }
  const middle = new THREE.SphereGeometry(0.13, 10, 6)
  middle.scale(1, 1, 0.5)
  middle.translate(0, 0, -0.03)
  parts.push(bake(middle, col('#ffcf3e')))
  const g = merge(parts)
  g.translate(0, 1, 0)
  return [{ geo: g, tint: false }]
}

function kite(): Part[] {
  const parts: THREE.BufferGeometry[] = []
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.7)
  shape.lineTo(0.42, 0)
  shape.lineTo(0, -0.9)
  shape.lineTo(-0.42, 0)
  shape.closePath()
  parts.push(bake(new THREE.ShapeGeometry(shape), col('#ffffff')))
  for (let i = 0; i < 4; i++) {
    const bow = new THREE.SphereGeometry(0.07, 6, 4)
    bow.scale(1.6, 0.6, 0.6)
    bow.translate(Math.sin(i * 1.3) * 0.12, -1.05 - i * 0.32, 0)
    parts.push(bake(bow, col('#ffffff')))
  }
  return [{ geo: merge(parts), tint: true }]
}

function cloud(): Part[] {
  const parts: THREE.BufferGeometry[] = []
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 1],
    [0.9, -0.15, 0.1, 0.75],
    [-0.95, -0.2, 0, 0.7],
    [0.45, 0.45, -0.1, 0.65],
    [-0.4, 0.38, 0.15, 0.6],
    [1.6, -0.35, 0, 0.45],
  ]
  for (const [x, y, z, r] of puffs) {
    const p = new THREE.IcosahedronGeometry(r, 1)
    p.translate(x, y, z)
    parts.push(bake(p, col('#ffffff'), [1, 1], 0.12))
  }
  return [{ geo: merge(parts), tint: false }]
}

function bubble(): Part[] {
  const b = new THREE.SphereGeometry(0.5, 14, 10)
  const shine = new THREE.SphereGeometry(0.09, 6, 4)
  shine.translate(-0.2, 0.22, -0.4)
  return [
    { geo: bake(b, col('#ffd6ec'), [1, 1], 0.2), tint: false, opacity: 0.35 },
    { geo: bake(shine, col('#ffffff')), tint: false },
  ]
}

function lighthouse(): Part[] {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.CylinderGeometry(0.62 - i * 0.04, 0.66 - i * 0.04, 1, 14)
    ring.translate(0, 0.5 + i, 0)
    parts.push(bake(ring, col(i % 2 ? '#ffffff' : '#f08cb8')))
  }
  const deck = new THREE.CylinderGeometry(0.62, 0.55, 0.2, 14)
  deck.translate(0, 6.1, 0)
  parts.push(bake(deck, col('#6f5aa8')))
  const lamp = new THREE.CylinderGeometry(0.34, 0.34, 0.6, 12)
  lamp.translate(0, 6.5, 0)
  parts.push(bake(lamp, col('#fff2b0'), [1, 1], 0.3))
  const cap = new THREE.ConeGeometry(0.5, 0.6, 12)
  cap.translate(0, 7.1, 0)
  parts.push(bake(cap, col('#e85d9a')))
  return [{ geo: merge(parts), tint: false }]
}

function lemon(): Part[] {
  const rind = new THREE.CylinderGeometry(1, 1, 0.22, 24)
  rind.rotateX(Math.PI / 2)
  const face = new THREE.CircleGeometry(0.86, 24)
  face.translate(0, 0, -0.115)
  face.rotateY(Math.PI)
  const back = new THREE.CircleGeometry(0.86, 24)
  back.translate(0, 0, 0.115)
  const flesh = (x: number, y: number) => {
    const a = Math.atan2(y, x)
    const seg = Math.abs(Math.sin(a * 4.5))
    return col(seg < 0.12 || Math.hypot(x, y) < 0.1 ? '#fffbe6' : '#ffe680')
  }
  return [
    {
      geo: merge([bake(rind, col('#f7c932')), bake(face, (x, y) => flesh(x, y)), bake(back, (x, y) => flesh(x, y))]),
      tint: false,
    },
  ]
}

function beachBall(): Part[] {
  const gores = ['#ff6f91', '#ffffff', '#3ec8cf', '#ffd23f', '#ffffff', '#f2813a']
  const b = new THREE.SphereGeometry(1, 18, 12)
  return [{ geo: bake(b, (x, _y, z) => col(gores[Math.floor((((Math.atan2(z, x) / Math.PI + 1) / 2) * 6) % 6)]!), [1, 1], 0.1), tint: false }]
}

function gumdrop(): Part[] {
  const g = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  g.scale(1, 1.05, 1)
  const base = new THREE.CylinderGeometry(1, 1.05, 0.6, 18, 1, true)
  base.translate(0, -0.3, 0)
  return [{ geo: merge([bake(g, col('#ffffff'), [1, 1], 0.05), bake(base, col('#e9e2ff'))]), tint: true }]
}

function jellyCube(): Part[] {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1)
  return [{ geo: bake(g, col('#ffffff'), [1, 1], 0.15), tint: true, opacity: 0.62 }]
}

function iceCream(): Part[] {
  const cone = new THREE.ConeGeometry(0.42, 1.4, 12, 3)
  cone.rotateX(Math.PI)
  cone.translate(0, 0.7, 0)
  const scoop = new THREE.SphereGeometry(0.5, 14, 10)
  scoop.translate(0, 1.55, 0)
  const drip = new THREE.TorusGeometry(0.43, 0.09, 6, 16)
  drip.rotateX(Math.PI / 2)
  drip.translate(0, 1.38, 0)
  return [
    { geo: bake(cone, (x, y, z) => col(Math.sin((x + z) * 14 + y * 6) > 0.6 ? '#c98d55' : '#e7b57c')), tint: false },
    { geo: merge([bake(scoop, col('#ffffff'), [1, 1], 0.1), bake(drip, col('#ffffff'))]), tint: true },
  ]
}

function post(): Part[] {
  const p = new THREE.CylinderGeometry(0.08, 0.1, 1, 6)
  p.translate(0, 0.5, 0)
  return [{ geo: bake(p, col('#d9d2ff')), tint: false }]
}

function spectator(): Part[] {
  const body = new THREE.CapsuleGeometry(0.3, 0.45, 4, 8)
  body.translate(0, 0.55, 0)
  const visor = new THREE.SphereGeometry(0.2, 8, 6)
  visor.scale(1, 0.8, 0.5)
  visor.translate(0, 0.78, -0.25)
  return [
    { geo: bake(body, col('#ffffff')), tint: true },
    { geo: bake(visor, col('#fff4f8')), tint: false },
  ]
}

function stand(): Part[] {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i++) {
    const step = new THREE.BoxGeometry(1, 0.6, 1)
    step.translate(0, 0.3 + i * 0.6, i * 0.8)
    step.scale(1, 1, 1)
    parts.push(bake(step, col(i % 2 ? '#f6f1ff' : '#e5dcff')))
  }
  return [{ geo: merge(parts), tint: false }]
}

/** The scenery a theme names, as its kinds. Unknown names are left out (a season's could add its own here). */
function kindsFor(theme: Theme): Kind[] {
  const out: Kind[] = []
  for (const name of theme.scenery) {
    switch (name) {
      case 'daisies':
        out.push({ parts: daisy(), place: 'goo', size: [3.5, 6.5], density: 1.1, motion: 'sway', reach: 0.4 })
        break
      case 'kites':
        out.push({ parts: kite(), place: 'sky', size: [2, 3.2], density: 0.35, motion: 'sway', colours: ['#ff6f91', '#ffd23f', '#9b7bff', '#3ec8cf'] })
        break
      case 'clouds':
        out.push({ parts: cloud(), place: 'sky', size: [3, 6], density: 0.4, motion: 'drift', off: [18, 40], reach: 1.8 })
        break
      case 'bubbles':
        out.push({ parts: bubble(), place: 'air', size: [0.8, 2.4], density: 1.2, motion: 'rise' })
        break
      case 'lighthouse':
        out.push({ parts: lighthouse(), place: 'goo', size: [3.2, 3.2], density: 0.05, motion: 'none', off: [34, 40], most: 2 })
        break
      case 'lemon slices':
        out.push({ parts: lemon(), place: 'goo', size: [2, 3.6], density: 0.8, motion: 'bob', reach: 1 })
        break
      case 'beach balls':
        out.push({ parts: beachBall(), place: 'goo', size: [1.2, 2.2], density: 0.7, motion: 'bob', reach: 1 })
        break
      case 'gumdrop hills':
        out.push({ parts: gumdrop(), place: 'goo', size: [3.5, 7.5], density: 0.7, motion: 'none', colours: ['#b9a6ff', '#f3a6e6', '#8f7fe8', '#ffb3d9'], reach: 1 })
        break
      case 'jelly cubes':
        out.push({ parts: jellyCube(), place: 'air', size: [1.2, 2.6], density: 0.6, motion: 'spin', colours: ['#c58cff', '#ff8fd0', '#9d86ff'], reach: 0.9 })
        break
      case 'ice-cream cones':
        out.push({ parts: iceCream(), place: 'goo', size: [2.6, 4.6], density: 0.9, motion: 'none', colours: ['#ffb3cf', '#c9f5df', '#fff0a8', '#e2d4ff'], reach: 0.5 })
        break
      case 'light strings':
        out.push({ parts: post(), place: 'goo', size: [1, 1], density: 0, motion: 'none', fill: 'strings' })
        break
      case 'spectator stands':
        out.push({ parts: spectator(), place: 'goo', size: [1, 1], density: 0, motion: 'bob', colours: theme.bodies, fill: 'stands' })
        break
      default:
        break
    }
  }
  return out
}

/** The x of the course's middle at z (the round or piece there; before the start, 0; past the crown, the last). */
export function centreAt(course: Course, z: number): number {
  for (const r of course.rounds) if (z >= r.z0 && z < r.z1) return r.x
  for (const p of course.pieces) if (z >= p.z0 && z < p.z1) return p.x
  const last = course.rounds[course.rounds.length - 1]
  return z <= 0 || !last ? 0 : last.x
}

/** The base height at z, the same way. */
function baseAt(course: Course, z: number): number {
  for (const r of course.rounds) if (z >= r.z0 && z < r.z1) return r.y
  for (const p of course.pieces) if (z >= p.z0 && z < p.z1) return p.y
  return 0
}

export class World {
  readonly group = new THREE.Group()
  private readonly course: Course
  private readonly sky: THREE.Mesh
  private readonly stars: THREE.Points
  private readonly starMat: THREE.PointsMaterial
  private readonly sun: THREE.Sprite
  private readonly glow: THREE.Sprite
  private readonly gooMesh: THREE.Mesh
  private readonly gooMat: THREE.MeshBasicMaterial
  private readonly sheen: THREE.Mesh
  private readonly sheenMat: THREE.MeshBasicMaterial
  private readonly gooTex: THREE.Texture
  private readonly sheenTex: THREE.Texture
  private readonly built: Built[] = []
  private bulbs: THREE.Points | null = null
  private bulbMat: THREE.PointsMaterial | null = null
  private readonly lowSun: boolean
  private readonly fireworks: boolean
  private readonly fireworkColours: readonly string[]
  private fireworkIn = 1.5
  private readonly rnd: () => number
  private look: SkyLook | null = null
  private gooColour = '#ff62c8'

  constructor(course: Course, painter: Painter, tints: Tints, dot: THREE.Texture, gooTex: THREE.Texture, rnd: () => number) {
    this.course = course
    this.rnd = rnd
    const theme = course.theme
    this.lowSun = theme.scenery.includes('low sun')
    this.fireworks = theme.scenery.includes('fireworks')
    this.fireworkColours = ['#ffd23f', '#ff6f91', '#3ec8cf', '#9b7bff', '#ffffff']

    // The sky: a dome coloured top to horizon, following the camera so it never comes near.
    const skyGeo = new THREE.SphereGeometry(900, 32, 16)
    skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position!.count * 3), 3))
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }))
    this.sky.renderOrder = -10
    this.sky.frustumCulled = false
    this.group.add(this.sky)
    const starPos: number[] = []
    const many = theme.night ? 1100 : 650
    for (let i = 0; i < many; i++) {
      const a = rnd() * Math.PI * 2
      const up = 0.06 + Math.pow(rnd(), 0.7) * 0.94
      const flat = Math.sqrt(1 - up * up)
      starPos.push(Math.cos(a) * flat * 800, up * 800, Math.sin(a) * flat * 800)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    this.starMat = new THREE.PointsMaterial({ color: '#e6deff', size: 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false })
    this.stars = new THREE.Points(sg, this.starMat)
    this.stars.renderOrder = -9
    this.stars.frustumCulled = false
    this.group.add(this.stars)
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#fff6d8', fog: false, depthWrite: false, transparent: true }))
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#ffe7a8', fog: false, depthWrite: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }))
    this.sun.renderOrder = this.glow.renderOrder = -8
    this.group.add(this.glow, this.sun)

    // The goo: a wide sheet under everything, with a sheen drifting over it (glowing at dusk).
    const zA = -90
    const zB = course.length + 160
    const W = 320
    const plane = new THREE.PlaneGeometry(W, zB - zA)
    plane.rotateX(-Math.PI / 2)
    this.gooTex = gooTex
    gooTex.repeat.set(W / 14, (zB - zA) / 14)
    this.gooMat = new THREE.MeshBasicMaterial({ map: gooTex, color: theme.goo })
    this.gooMesh = new THREE.Mesh(plane, this.gooMat)
    this.gooMesh.position.set(0, course.gooY, (zA + zB) / 2)
    this.group.add(this.gooMesh)
    this.sheenTex = painter.keep(gooTex.clone())
    this.sheenTex.repeat.set(W / 23, (zB - zA) / 23)
    this.sheenMat = new THREE.MeshBasicMaterial({ map: this.sheenTex, color: '#ffffff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    this.sheen = new THREE.Mesh(plane.clone(), this.sheenMat)
    this.sheen.position.set(0, course.gooY + 0.04, (zA + zB) / 2)
    this.sheen.renderOrder = 1
    this.group.add(this.sheen)

    this.buildScenery(theme, tints)
  }

  private buildScenery(theme: Theme, tints: Tints) {
    const course = this.course
    const rnd = this.rnd
    const kinds = kindsFor(theme)
    for (const kind of kinds) {
      const items: Item[] = []
      const z0 = -30
      const z1 = course.length + 50
      if (kind.density > 0) {
        for (let z = z0; z < z1; z += 10) {
          for (const side of [-1, 1]) {
            let n = kind.density
            while (n > 0) {
              if (rnd() < Math.min(1, n)) {
                const zz = z + rnd() * 10
                const off = kind.off ?? (kind.place === 'sky' ? [20, 40] : [12, 40])
                const s = kind.size[0] + rnd() * (kind.size[1] - kind.size[0])
                const dx = off[0] + (kind.reach ?? 0.5) * s + rnd() * (off[1] - off[0])
                const y =
                  kind.place === 'goo'
                    ? course.gooY - 0.3
                    : kind.place === 'air'
                      ? course.gooY + 2 + rnd() * (course.maxY - course.gooY + 10)
                      : Math.max(course.maxY, baseAt(course, zz)) + 14 + rnd() * 18
                items.push({ x: centreAt(course, zz) + side * dx, y, z: zz, s, yaw: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 0.5, ph: rnd() * 10, c: Math.floor(rnd() * 8) })
              }
              n -= 1
            }
          }
        }
      }
      if (kind.most && items.length > kind.most) items.length = kind.most
      if (kind.fill === 'strings') this.lightStrings(items, tints)
      if (kind.fill === 'stands') this.stands(items, tints)
      if (!items.length) continue
      const meshes: THREE.InstancedMesh[] = []
      for (const part of kind.parts) {
        const mat = tints.onWorld(
          new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: part.opacity != null,
            opacity: part.opacity ?? 1,
            depthWrite: part.opacity == null,
          }),
        )
        const mesh = new THREE.InstancedMesh(part.geo, mat, items.length)
        mesh.frustumCulled = false
        if (part.tint && kind.colours) {
          for (let i = 0; i < items.length; i++) mesh.setColorAt(i, C.set(kind.colours[items[i]!.c % kind.colours.length]!))
        }
        meshes.push(mesh)
        this.group.add(mesh)
      }
      const b = { kind, meshes, items }
      this.built.push(b)
      this.pose(b, 0, true)
    }
  }

  /** Neon Night's strings of lights: posts 13 m off either side, bulbs strung between them. */
  private lightStrings(posts: Item[], tints: Tints) {
    const course = this.course
    const bulbs: number[] = []
    const cols: number[] = []
    const hues = ['#ff5ce1', '#ffd23f', '#46e4ff', '#9b7bff', '#3ecf8e', '#ff8a5c']
    for (const side of [-1, 1]) {
      let prev: [number, number, number] | null = null
      for (let z = -10; z < course.length + 20; z += 12) {
        const x = centreAt(course, z) + side * 13
        const top = baseAt(course, z) + 3.4
        posts.push({ x, y: course.gooY - 0.3, z, s: 1, yaw: 0, tilt: 0, ph: 0, c: 0, sy: top + 0.2 - course.gooY })
        if (prev) {
          for (let k = 1; k < 10; k++) {
            const u = k / 10
            const sag = Math.sin(u * Math.PI) * 1.1
            bulbs.push(prev[0] + (x - prev[0]) * u, prev[1] + (top - prev[1]) * u - sag, prev[2] + (z - prev[2]) * u)
            C.set(hues[(k + Math.round(z)) % hues.length]!)
            cols.push(C.r, C.g, C.b)
          }
        }
        prev = [x, top, z]
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    this.bulbMat = tints.onTrim(new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 2)
    this.bulbs = new THREE.Points(geo, this.bulbMat)
    this.bulbs.frustumCulled = false
    this.group.add(this.bulbs)
  }

  /** Big Show's stands of spectator beans beside each checkpoint pad and the finale. */
  private stands(beans: Item[], tints: Tints) {
    const course = this.course
    const spots = course.spawns.filter((s) => s.kind === 'check').map((s) => ({ x: s.x, y: s.y, z: s.z }))
    const fin = course.rounds[course.rounds.length - 1]
    if (fin) spots.push({ x: fin.x, y: fin.y, z: fin.z0 + 8 })
    const blocks: Item[] = []
    for (const spot of spots) {
      for (const side of [-1, 1]) {
        const x0 = spot.x + side * 14
        blocks.push({ x: x0, y: spot.y - 0.6, z: spot.z, s: 1, yaw: 0, tilt: 0, ph: 0, c: side })
        // Three rows of beans on the steps, facing the track.
        for (let row = 0; row < 3; row++) {
          for (let k = 0; k < 6; k++) {
            if (this.rnd() < 0.2) continue
            beans.push({ x: x0 + side * row * 1.76, y: spot.y + row * 0.6, z: spot.z - 4 + k * 1.6, s: 1, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, tilt: 0, ph: this.rnd() * 10, c: Math.floor(this.rnd() * 6) })
          }
        }
      }
    }
    if (!blocks.length) return
    const part = stand()[0]!
    const mesh = new THREE.InstancedMesh(part.geo, tints.onWorld(new THREE.MeshBasicMaterial({ vertexColors: true })), blocks.length)
    mesh.frustumCulled = false
    blocks.forEach((b, i) => {
      // The stand faces the track: its steps rise away from it.
      Q.setFromEuler(E.set(0, b.c > 0 ? Math.PI / 2 : -Math.PI / 2, 0))
      M.compose(V.set(b.x, b.y, b.z), Q, S.set(10, 1, 2.2))
      mesh.setMatrixAt(i, M)
    })
    this.group.add(mesh)
  }

  /** The items' places now (the animated kinds move a little each frame). */
  private pose(b: Built, t: number, first: boolean) {
    const motion = b.kind.motion
    if (!first && motion === 'none') return
    const course = this.course
    const top = course.maxY + 16
    b.items.forEach((it, i) => {
      let x = it.x
      let y = it.y
      const z = it.z
      let yaw = it.yaw
      let tiltX = 0
      let tiltZ = it.tilt * 0.3
      if (motion === 'bob') {
        y += Math.sin(t * 1.6 + it.ph) * 0.25
        tiltZ = Math.sin(t * 1.1 + it.ph) * 0.12
        tiltX = Math.cos(t * 1.3 + it.ph) * 0.1
      } else if (motion === 'drift') {
        x += Math.sin(t * 0.05 + it.ph) * 4
      } else if (motion === 'rise') {
        const span = top - course.gooY
        y = course.gooY + ((it.y - course.gooY + t * (0.6 + (it.ph % 1) * 0.6)) % span)
        x += Math.sin(t * 0.8 + it.ph) * 0.6
      } else if (motion === 'spin') {
        yaw += t * 0.3
        tiltX = Math.sin(t * 0.4 + it.ph) * 0.4
        y += Math.sin(t * 0.9 + it.ph) * 0.5
      } else if (motion === 'sway') {
        tiltZ = Math.sin(t * 0.9 + it.ph) * 0.12
        y += Math.sin(t * 0.7 + it.ph) * (b.kind.place === 'sky' ? 1.2 : 0)
      }
      // Daisies and kites face the camera (down −z, toward it), give or take; the rest turn as they lie.
      if (b.kind.motion === 'sway') yaw = Math.PI + (it.yaw - Math.PI) * 0.08
      Q.setFromEuler(E.set(tiltX, yaw, tiltZ, 'YXZ'))
      M.compose(V.set(x, y, z), Q, S.set(it.s, it.sy ?? it.s, it.s))
      for (const m of b.meshes) m.setMatrixAt(i, M)
    })
    for (const m of b.meshes) m.instanceMatrix.needsUpdate = true
  }

  /** The look: the sky's colours, the sun or the moon, the stars, the goo's colour and glow. */
  applyLook(look: SkyLook, night: boolean) {
    this.look = look
    const theme = this.course.theme
    const geo = this.sky.geometry
    const pos = geo.attributes.position!
    const colours = geo.attributes.color!
    const top = new THREE.Color(look.skyTop)
    const midC = new THREE.Color(look.skyMid)
    const hor = new THREE.Color(this.lowSun && !look.dark ? mix(look.horizon, '#ffc59a', 0.5) : look.horizon)
    // At and below the horizon the sky is the fog's colour, so the far goo melts into it with no band between.
    const fog = new THREE.Color(look.fog)
    for (let i = 0; i < pos.count; i++) {
      const up = pos.getY(i) / 900
      if (up <= 0) C.copy(fog)
      else if (up < 0.07) C.copy(fog).lerp(hor, up / 0.07)
      else {
        // The blue comes in low, as an afternoon's does; the top deepens overhead.
        const k = Math.pow(up, 0.5)
        C.copy(hor).lerp(midC, Math.min(1, (k - 0.26) * 3.2))
        if (k > 0.6) C.lerp(top, (k - 0.6) / 0.4)
      }
      colours.setXYZ(i, C.r, C.g, C.b)
    }
    colours.needsUpdate = true
    this.starMat.opacity = look.stars * (night ? 1 : 0.85)
    this.stars.visible = look.stars > 0
    const sunMat = this.sun.material as THREE.SpriteMaterial
    const glowMat = this.glow.material as THREE.SpriteMaterial
    if (look.dark) {
      sunMat.color.set('#f1ecff')
      glowMat.color.set('#8f7ad8')
      glowMat.opacity = 0.35
    } else {
      sunMat.color.set(this.lowSun ? '#ffd29a' : look.sun)
      glowMat.color.set(this.lowSun ? '#ff9f6b' : look.sunGlow)
      glowMat.opacity = this.lowSun ? 0.32 : 0.55
    }
    // The goo: the day's colour, lifted in the afternoon; at dusk glowing, its sheen brighter.
    this.gooColour = theme.goo
    this.gooMat.color.set(look.dark ? mix(theme.goo, '#000000', 0.12) : mix(theme.goo, '#ffffff', look.gooLift))
    this.sheenMat.color.set(mix(theme.goo, '#ffffff', 0.5))
    this.sheenMat.opacity = look.gooSheen * (night ? 1.3 : 1)
  }

  /** The goo's colour today, for the splashes and the ring. */
  goo(): string {
    return this.gooColour
  }

  /**
   * Each frame: the sky and the stars round the camera, the sun ahead of it, the goo drifting, the moving
   * scenery, and Big Show's fireworks.
   */
  update(t: number, cam: THREE.Vector3, dt: number, fx: Fx, calm: boolean) {
    this.sky.position.copy(cam)
    this.stars.position.copy(cam)
    const dark = this.look?.dark ?? true
    const low = this.lowSun && !dark
    // The sun ahead and to the left, high in the afternoon, low and big at Sherbet Sunset; the moon at dusk.
    V.set(low ? 0.25 : 0.42, low ? 0.07 : dark ? 0.42 : 0.5, 1).normalize().multiplyScalar(700)
    this.sun.position.copy(cam).add(V)
    this.glow.position.copy(this.sun.position)
    const r = low ? 110 : dark ? 46 : 70
    this.sun.scale.setScalar(r)
    this.glow.scale.setScalar(r * (low ? 2.2 : 3.4))
    this.gooTex.offset.set(Math.sin(t * 0.05) * 0.3, t * 0.012)
    this.sheenTex.offset.set(t * 0.02, -t * 0.017)
    for (const b of this.built) if (!calm || b.kind.motion === 'none') this.pose(b, t, false)
    if (this.fireworks && !calm && dt > 0) {
      this.fireworkIn -= dt
      if (this.fireworkIn <= 0) {
        this.fireworkIn = 1.2 + this.rnd() * 1.6
        fx.firework(cam.x + (this.rnd() - 0.5) * 40, cam.y + 14 + this.rnd() * 12, cam.z + 45 + this.rnd() * 30, this.fireworkColours)
      }
    }
  }
}
