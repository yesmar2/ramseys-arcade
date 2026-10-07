import * as THREE from 'three'
import {
  ARM_R,
  BALL_R,
  ease,
  HAMMER_HALF,
  HAMMER_R,
  halfWidth,
  hashString,
  headingAt,
  heightAt,
  HUB_H,
  HUB_R,
  local,
  loopHalfWidth,
  loopTheta,
  moverAngle,
  mulberry32,
  platformPose,
  point,
  RAIL_H,
  supportAt,
  surfaceAt,
  type Ball,
  type Course,
  type Mover,
  type Piece,
  type Platform,
  type Tilt,
  type Zone,
} from './sim'
import { marbleLook, marbleMaps } from './marbleLook'

/*
 * Marble Run in 3D: a course of dark glass drawn in light, hanging over a floor of light far below, and
 * the marble rolling down it. The whole course is built once, into a handful of meshes; each frame moves
 * the marble, its ghost and the camera, and leans the world the way it's tilted.
 */

/** The colours of the dark. Marble Run's own is the arcade's magenta, lifted to glow; the ghost, unskinned, is Hot Lap's cyan. */
const NEON = {
  night: '#06040e',
  fog: '#120a22',
  skyTop: '#050311',
  horizon: '#2a0e45',
  track: '#191233',
  edge: '#ff5ce1',
  skirtTop: '#a33ad6',
  skirtLow: '#07040f',
  rail: '#46e4ff',
  post: '#ffb347',
  gate: '#f5b942',
  passed: '#3ecf8e',
  goal: '#ff5ce1',
  kicker: '#ffb347',
  floor: '#3a2270',
  peaks: '#4b2585',
  ghost: '#46e4ff',
  // The new pieces (sim.ts labCourse): boost chevrons in hot lime, mud a dark matte plum-brown, ice a pale sheen;
  // bumpers ringed in cyan light that flashes white; hammers and arms in danger red; slabs edged in cyan.
  boost: '#b6ff3c',
  mud: '#2b1a25',
  ice: '#d8f2ff',
  bumper: '#22123c',
  bumperRing: '#7ff6ff',
  bumperBand: '#ff5ce1',
  danger: '#ff3b5c',
  dangerDark: '#3a0c1a',
  steel: '#2a2247',
  slab: '#46e4ff',
} as const

/** What a frame shows. */
export type SceneFrame = {
  ball: Ball
  /** How the world is tilted this moment (sim.ts Tilt), for the lean the camera shows. */
  tilt: Tilt
  /** The start card's view of the whole course; a run; the ball falling; the run over. */
  mode: 'menu' | 'play' | 'fallen' | 'done'
  /** Seconds since the run ended, for the camera's pull back. */
  doneFor: number
  ghost: { x: number; y: number; z: number } | null
  ghostTag: string
  /** Lines crossed so far (checkpoints, then the goal): their gates turn green. */
  passed: number
  /** The player's chosen skin (lib/skins.ts), on their own marble. */
  skin?: string | null
  /** The skin the ghost's run was rolled in, which it wears faded; null, the cyan wire (always the blue ball's). */
  ghostSkin?: string | null
}

type Paint = (g: CanvasRenderingContext2D, w: number, h: number) => void

/** One growing mesh per look, so the whole course draws in a handful of calls. */
class Layer {
  pos: number[] = []
  col: number[] = []
  uv: number[] = []
  idx: number[] = []
  vert(x: number, y: number, z: number, c: THREE.Color, u = 0, v = 0) {
    this.pos.push(x, y, z)
    this.col.push(c.r, c.g, c.b)
    this.uv.push(u, v)
    return this.pos.length / 3 - 1
  }
  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c)
  }
  get empty() {
    return this.idx.length === 0
  }
  mesh(material: THREE.Material) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    geo.setIndex(this.idx)
    geo.computeBoundingSphere()
    return new THREE.Mesh(geo, material)
  }
}

const WHITE = new THREE.Color(1, 1, 1)
const LIGHT = new THREE.Vector3(0.35, 1, 0.55).normalize()
const UP = new THREE.Vector3(0, 1, 0)
/** The pool of light under the ball is a grid this many cells a side, laid on the track. */
const POOL_GRID = 6
/**
 * A ghost in a skin is that skin's marble, lighter: a veil of white over its paint, then seen through at this
 * strength. No wire round it (Ramsey, 2026-10-07: "it still has the outlines ... you see the skin, just lighter"),
 * as Lander's ghost is its skin's ship at half strength.
 */
const GHOST_SKIN_SHOWS = 0.62
const GHOST_SKIN_VEIL = 'rgba(255,255,255,0.28)'
const angleTo = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

type At = (u: number, j: number) => [number, number, number, THREE.Color, number?, number?]

/** Rows along a piece, `cols` across: `at(u, j)` gives [x, y, z, colour, uvU, uvV]. */
function sheet(layer: Layer, p: Piece, cols: number, at: At, step = 0.5) {
  strip(layer, 0, p.len, cols, at, step)
}

/** Rows along part of a piece, from `u0` to `u1`, `cols` across, as `sheet` lays a whole one. */
function strip(layer: Layer, u0: number, u1: number, cols: number, at: At, step = 0.5) {
  const rows = Math.max(2, Math.ceil((u1 - u0) / step) + 1)
  const first = layer.pos.length / 3
  for (let i = 0; i < rows; i++) {
    const u = u0 + ((u1 - u0) * i) / (rows - 1)
    for (let j = 0; j < cols; j++) {
      const [x, y, z, c, a, b] = at(u, j)
      layer.vert(x, y, z, c, a, b)
    }
  }
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = first + i * cols + j
      const c = a + cols
      layer.tri(a, c, a + 1)
      layer.tri(a + 1, c, c + 1)
    }
}

/** How lit a spot of track is, from which way its slope faces. */
function shadeAt(p: Piece, u: number, v: number) {
  const e = 0.05
  const dyu = (heightAt(p, u + e, v) - heightAt(p, u - e, v)) / (2 * e)
  const dyv = (heightAt(p, u, v + e) - heightAt(p, u, v - e)) / (2 * e)
  const h = headingAt(p, u)
  const gx = dyu * Math.cos(h) - dyv * Math.sin(h)
  const gz = dyu * Math.sin(h) + dyv * Math.cos(h)
  const n = new THREE.Vector3(-gx, 1, -gz).normalize()
  return Math.max(0.35, Math.min(1.15, 0.2 + 0.95 * n.dot(LIGHT)))
}

type Gate = { mat: THREE.MeshBasicMaterial; curtain: THREE.MeshBasicMaterial; goal: boolean }

export class MarbleScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4000)
  private readonly course: Course
  private readonly textures: THREE.Texture[] = []
  private readonly lettered: [THREE.CanvasTexture, Paint][] = []
  private readonly gates: Gate[] = []
  private readonly ball: THREE.Mesh
  private readonly glow: THREE.Sprite
  private readonly pool: THREE.Mesh
  /** The pool's grid as made: a 1 m square, flat, round the origin. */
  private readonly poolAt: Float32Array
  /** The skin the marble is in now (lib/skins.ts); null, Marble Run's own glass. */
  private skinShown: string | null = null
  private readonly ghost = new THREE.Group()
  /** The ghost's ball, which rolls; its tag stays upright over it. */
  private readonly ghostBall = new THREE.Group()
  /** Whether the ghost was shown last frame, so its roll is the way it went since. */
  private ghostShown = false
  /** The ghost as Marble Run's own: a ball of cyan wire. */
  private readonly ghostPlain = new THREE.Group()
  private readonly ghostWire: THREE.LineBasicMaterial
  /** The ghost in each skin it has been in (dressGhost), made on first use. */
  private readonly ghostSkinned = new Map<string, { group: THREE.Group; shell: THREE.MeshMatcapMaterial }>()
  /** The skin the ghost is in now; null, the cyan wire. */
  private ghostSkinShown: string | null = null
  private readonly ghostTag: THREE.Sprite
  private readonly ghostTagTex: THREE.CanvasTexture
  private ghostTagText = ''
  private readonly calm: boolean
  private width = 0
  private height = 0
  private passedShown = -1
  private menuAngle = 0
  private snapNext = true
  private yaw = -Math.PI / 2
  private followY = 0
  /**
   * The marble's spin: its axis, at its length in radians a second. On the track it's the roll; in the air
   * nothing turns the marble, so it keeps the spin it left the ground with.
   */
  private readonly omega = new THREE.Vector3()
  /** Seconds since the marble last came down on the track, while its spin catches up with its roll. */
  private landedFor = 0
  private readonly shownTilt = new THREE.Vector2()
  private readonly wantTilt = new THREE.Vector2()
  private disposed = false
  // Scratch, so a frame makes no garbage.
  private readonly spin = new THREE.Quaternion()
  private readonly lean = new THREE.Quaternion()
  private readonly focus = new THREE.Vector3()
  private readonly eye = new THREE.Vector3()
  private readonly look = new THREE.Vector3()
  private readonly camUp = new THREE.Vector3()
  private readonly axis = new THREE.Vector3()
  private readonly roll = new THREE.Vector3()

  /*
   * The new pieces (sim.ts labCourse), moved each frame to where the run's clock has them, the clock the ball's
   * own physics keeps (Ball t), so what's seen is what hits.
   */
  private readonly hammers: { m: Mover; swing: THREE.Object3D }[] = []
  private readonly arms: { m: Mover; turn: THREE.Object3D }[] = []
  private readonly slabs: { pl: Platform; slab: THREE.Object3D }[] = []
  /** Each bumper's lights, and when it was last hit on the run's clock. */
  private readonly bumpers: { body: THREE.Object3D; ring: THREE.MeshBasicMaterial; glow: THREE.MeshBasicMaterial; base: THREE.Color; at: number }[] = []
  private boostMap: THREE.Texture | null = null
  /** The clock the moving pieces keep on the start card, where no run is rolling. */
  private idle = 0
  /** How far the camera has gone over to watching the loop the ball is riding, 0 to 1, and which loop that is. */
  private loopView = 0
  private loopSeen: Piece | null = null
  private readonly loopEye = new THREE.Vector3()
  private readonly loopLook = new THREE.Vector3()

  constructor(canvas: HTMLCanvasElement, course: Course) {
    this.course = course
    this.calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer = renderer
    this.scene.background = new THREE.Color(NEON.night)
    this.scene.fog = new THREE.Fog(NEON.fog, 70, 330)
    this.menuAngle = (hashString(course.key) % 628) / 100

    this.buildSky()
    this.buildCourse()
    this.buildFloor()

    // The marble: white glass with a swirl, lit by a painted light so it shines without lamps, or the player's
    // skin (marbleLook.ts); it's dressed in its look below (wear).
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), new THREE.MeshMatcapMaterial())
    const dot = this.dotTexture()
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }))
    this.glow.scale.setScalar(BALL_R * 4.2)
    // A pool of light on the track under the ball: where it'll come down, when it's flying. It's laid on the
    // track's own shape each frame (frame), so it lies flush in a bowl or over a roller.
    const poolGeo = new THREE.PlaneGeometry(1, 1, POOL_GRID, POOL_GRID)
    poolGeo.rotateX(-Math.PI / 2)
    this.poolAt = Float32Array.from(poolGeo.attributes.position!.array)
    this.pool = new THREE.Mesh(
      poolGeo,
      new THREE.MeshBasicMaterial({ map: dot, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    this.pool.frustumCulled = false
    this.pool.renderOrder = 3
    this.scene.add(this.ball, this.glow, this.pool)
    this.wear(null)

    // The ghost: a ball of cyan wire, or a run's skin seen through (dressGhost), with whose run it is over it.
    const shell = new THREE.IcosahedronGeometry(BALL_R, 1)
    this.ghostWire = new THREE.LineBasicMaterial({ color: NEON.ghost, transparent: true, opacity: 0.9 })
    const fill = new THREE.Mesh(shell, new THREE.MeshBasicMaterial({ color: NEON.ghost, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }))
    this.ghostPlain.add(new THREE.LineSegments(new THREE.EdgesGeometry(shell), this.ghostWire), fill)
    this.ghostBall.add(this.ghostPlain)
    this.ghost.add(this.ghostBall)
    const tagDraw: Paint = (g, w, h) => {
      g.clearRect(0, 0, w, h)
      g.fillStyle = 'rgba(7,5,15,0.78)'
      g.beginPath()
      if (g.roundRect) g.roundRect(4, 8, w - 8, h - 16, (h - 16) / 2)
      else g.rect(4, 8, w - 8, h - 16)
      g.fill()
      g.strokeStyle = NEON.ghost
      g.lineWidth = 3
      g.stroke()
      g.fillStyle = NEON.ghost
      g.font = '700 30px "Outfit", system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(this.ghostTagText, w / 2, h / 2 + 1)
    }
    this.ghostTagTex = this.paint(256, 64, tagDraw, true)
    this.ghostTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ghostTagTex, transparent: true, depthWrite: false, sizeAttenuation: false }))
    this.ghostTag.position.set(0, 1.25, 0)
    this.ghost.add(this.ghostTag)
    this.ghost.visible = false
    this.scene.add(this.ghost)

    // Signs are painted before the display face has arrived; paint them again once it has.
    if (typeof document !== 'undefined' && document.fonts) {
      Promise.all([document.fonts.load('800 60px "Outfit"'), document.fonts.load('700 30px "Outfit"')])
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
  }

  private paint(w: number, h: number, draw: Paint, hasText = false): THREE.CanvasTexture {
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

  /**
   * Dress the marble in a skin's look (marbleLook.ts), or Marble Run's own for null: its painted light, its pattern,
   * and the colour of its glow and the pool of light under it. The textures it had are let go.
   */
  private wear(skin: string | null) {
    this.skinShown = skin
    const look = marbleLook(skin)
    const { matcap, map } = marbleMaps(look, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()))
    const mat = this.ball.material as THREE.MeshMatcapMaterial
    mat.matcap?.dispose()
    mat.map?.dispose()
    mat.matcap = matcap
    mat.map = map
    mat.needsUpdate = true
    ;(this.glow.material as THREE.SpriteMaterial).color.set(look.glow)
    ;(this.pool.material as THREE.MeshBasicMaterial).color.set(look.glow)
  }

  /**
   * Dress the ghost in the skin its run was rolled in: the skin's marble, lighter and seen through, its pattern
   * turning as it rolls, with no wire round it. None, or a skin this game doesn't know, is the cyan wire, as the
   * blue ball always is.
   */
  private dressGhost(skin: string | null) {
    const known = skin != null && marbleLook(skin) !== marbleLook(null) ? skin : null
    if (known === this.ghostSkinShown) return
    this.ghostSkinShown = known
    this.ghostPlain.visible = known == null
    for (const [id, dressed] of this.ghostSkinned) dressed.group.visible = id === known
    if (known == null || this.ghostSkinned.has(known)) return
    const look = marbleLook(known)
    const { matcap, map } = marbleMaps(look, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()))
    // Lighter: a veil of white over the skin's light and its pattern.
    for (const tex of [matcap, map]) {
      const c = tex.image as HTMLCanvasElement
      const g = c.getContext('2d')!
      g.fillStyle = GHOST_SKIN_VEIL
      g.fillRect(0, 0, c.width, c.height)
      tex.needsUpdate = true
    }
    this.textures.push(matcap, map)
    const shell = new THREE.MeshMatcapMaterial({ matcap, map, transparent: true, opacity: GHOST_SKIN_SHOWS, depthWrite: false })
    const group = new THREE.Group()
    group.add(new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 40, 28), shell))
    this.ghostSkinned.set(known, { group, shell })
    this.ghostBall.add(group)
  }

  private dotTexture() {
    return this.paint(128, 128, (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.25, 'rgba(255,255,255,0.55)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, w, h)
    })
  }

  private buildSky() {
    const geo = new THREE.SphereGeometry(1800, 32, 16)
    const top = new THREE.Color(NEON.skyTop)
    const mid = new THREE.Color(NEON.horizon)
    const low = new THREE.Color(NEON.fog)
    const colors: number[] = []
    for (let i = 0; i < geo.attributes.position!.count; i++) {
      const up = geo.attributes.position!.getY(i) / 1800
      const c = up > 0 ? mid.clone().lerp(top, Math.pow(up, 0.45)) : low.clone()
      colors.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })))
    const r = mulberry32(7)
    const pos: number[] = []
    for (let i = 0; i < 700; i++) {
      const a = r() * Math.PI * 2
      const up = 0.08 + Math.pow(r(), 0.7) * 0.92
      const flat = Math.sqrt(1 - up * up)
      pos.push(Math.cos(a) * flat * 1600, up * 1600, Math.sin(a) * flat * 1600)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#d9ccff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.75, depthWrite: false })))
  }

  private buildCourse() {
    const course = this.course
    const surface = new Layer()
    const skirts = new Layer()
    const edges = new Layer()
    const halos = new Layer()
    const railWalls = new Layer()
    const railTops = new Layer()
    const edgeColor = new THREE.Color(NEON.edge)
    const railColor = new THREE.Color(NEON.rail)
    const skirtTop = new THREE.Color(NEON.skirtTop)
    const skirtLow = new THREE.Color(NEON.skirtLow)
    const kick = new THREE.Color(NEON.kicker)
    const DEPTH = 0.9

    for (const p of course.solid) {
      const hw = (u: number) => halfWidth(p, u)
      const cols = p.pipe || p.rollers || p.bank ? 13 : 7
      const narrow = p.w1 < 3.4 || p.w0 < 3.4
      // The top: shaded by its slopes, its grid running on from piece to piece; a kicker glows amber.
      const top = (u: number, v: number): ReturnType<At> => {
        const [x, z] = point(p, u, v)
        let c = WHITE.clone().multiplyScalar(shadeAt(p, u, v))
        if (p.kicker) c = c.lerp(kick, 0.45 * ease(p, u) + 0.35 * (u / p.len))
        else if (narrow) c = c.lerp(edgeColor, 0.12)
        return [x, heightAt(p, u, v), z, c, v / 2, (p.d0 + u) / 2]
      }
      const across = (u: number, j: number) => -hw(u) + (2 * hw(u) * j) / (cols - 1)
      const hole = p.hole
      if (!hole) sheet(surface, p, cols, (u, j) => top(u, across(u, j)))
      else {
        // A fork: the track whole before the hole and after it, and either side of it, with nothing between.
        strip(surface, 0, hole.u0, cols, (u, j) => top(u, across(u, j)))
        strip(surface, hole.u1, p.len, cols, (u, j) => top(u, across(u, j)))
        strip(surface, hole.u0, hole.u1, 5, (u, j) => top(u, -hw(u) + ((hole.v0 + hw(u)) * j) / 4))
        strip(surface, hole.u0, hole.u1, 9, (u, j) => top(u, hole.v1 + ((hw(u) - hole.v1) * j) / 8))
        this.holeEdges(p, { edges, halos, skirts, railWalls, railTops }, DEPTH)
      }
      for (const zone of p.zones ?? []) this.zonePatch(p, zone)
      for (const side of [-1, 1]) {
        // The edge: a line of light and a glow falling off inward, and a skirt hanging below.
        sheet(edges, p, 2, (u, j) => {
          const v = side * (hw(u) - j * 0.09)
          const [x, z] = point(p, u, v)
          return [x, heightAt(p, u, v) + 0.015, z, edgeColor]
        })
        sheet(halos, p, 2, (u, j) => {
          const v = side * (hw(u) - j * 0.9)
          const [x, z] = point(p, u, v)
          return [x, heightAt(p, u, v) + 0.01, z, edgeColor, j, 0]
        })
        sheet(skirts, p, 2, (u, j) => {
          const v = side * hw(u)
          const [x, z] = point(p, u, v)
          return [x, heightAt(p, u, v) - j * DEPTH, z, j ? skirtLow : skirtTop]
        })
        if (side < 0 ? p.railL : p.railR) {
          sheet(railWalls, p, 2, (u, j) => {
            const v = side * hw(u)
            const [x, z] = point(p, u, v)
            return [x, heightAt(p, u, v) + j * RAIL_H, z, railColor, j, 0]
          })
          sheet(railTops, p, 2, (u, j) => {
            const v = side * (hw(u) - j * 0.08)
            const [x, z] = point(p, u, v)
            return [x, heightAt(p, u, side * hw(u)) + RAIL_H, z, railColor]
          })
        }
      }
      // Where the track ends, at the start, the goal and either side of a gap, a face across it and a lip of light.
      const prev = course.pieces[p.index - 1]
      const next = course.pieces[p.index + 1]
      const ends: number[] = []
      if (!prev || prev.gap) ends.push(0)
      if (!next || next.gap) ends.push(p.len)
      for (const u of ends) {
        const n = 9
        const face = skirts.pos.length / 3
        const lip = edges.pos.length / 3
        const back = u + (u === 0 ? 0.09 : -0.09)
        for (let j = 0; j < n; j++) {
          const v = -hw(u) + (2 * hw(u) * j) / (n - 1)
          const [x, z] = point(p, u, v)
          const y = heightAt(p, u, v)
          skirts.vert(x, y, z, skirtTop)
          skirts.vert(x, y - DEPTH, z, skirtLow)
          const [bx, bz] = point(p, back, v)
          edges.vert(x, y + 0.015, z, p.kicker ? kick : edgeColor)
          edges.vert(bx, heightAt(p, back, v) + 0.015, bz, p.kicker ? kick : edgeColor)
        }
        for (let j = 0; j < n - 1; j++) {
          const a = face + j * 2
          skirts.tri(a, a + 1, a + 2)
          skirts.tri(a + 1, a + 3, a + 2)
          const b = lip + j * 2
          edges.tri(b, b + 1, b + 2)
          edges.tri(b + 1, b + 3, b + 2)
        }
      }
    }
    for (const p of course.extras?.loops ?? []) this.loopRibbon(p, { surface, edges, halos, skirts, railWalls, railTops })

    // The wall behind the start and the one past the goal: glass, like the rails.
    for (const w of course.walls) {
      const p = w.p
      const hw = halfWidth(p, w.u)
      const n = 9
      const wall = railWalls.pos.length / 3
      const top = railTops.pos.length / 3
      for (let j = 0; j < n; j++) {
        const v = -hw + (2 * hw * j) / (n - 1)
        const [x, z] = point(p, w.u, v)
        const y = heightAt(p, w.u, v)
        railWalls.vert(x, y, z, railColor)
        railWalls.vert(x, y + RAIL_H, z, railColor)
        const [bx, bz] = point(p, w.u + w.dir * 0.08, v)
        railTops.vert(x, y + RAIL_H, z, railColor)
        railTops.vert(bx, y + RAIL_H, bz, railColor)
      }
      for (let j = 0; j < n - 1; j++) {
        const a = wall + j * 2
        railWalls.tri(a, a + 1, a + 2)
        railWalls.tri(a + 1, a + 3, a + 2)
        const c = top + j * 2
        railTops.tri(c, c + 1, c + 2)
        railTops.tri(c + 1, c + 3, c + 2)
      }
    }

    // The track's glass: dark, with a violet grid, a cell every 2 m.
    const grid = this.paint(256, 256, (g, w, h) => {
      g.fillStyle = NEON.track
      g.fillRect(0, 0, w, h)
      const glow = g.createLinearGradient(0, 0, 0, h)
      glow.addColorStop(0, 'rgba(138, 92, 255, 0.10)')
      glow.addColorStop(0.5, 'rgba(138, 92, 255, 0.02)')
      glow.addColorStop(1, 'rgba(138, 92, 255, 0.10)')
      g.fillStyle = glow
      g.fillRect(0, 0, w, h)
      g.strokeStyle = 'rgba(160, 120, 255, 0.55)'
      g.lineWidth = 3
      g.strokeRect(1.5, 1.5, w - 3, h - 3)
    })
    grid.wrapS = grid.wrapT = THREE.RepeatWrapping
    const fade = this.paint(64, 8, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, w, 0)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.35, 'rgba(255,255,255,0.35)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, w, h)
    })
    const group = this.scene
    group.add(surface.mesh(new THREE.MeshBasicMaterial({ map: grid, vertexColors: true, side: THREE.DoubleSide })))
    group.add(skirts.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })))
    group.add(edges.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })))
    const halo = halos.mesh(new THREE.MeshBasicMaterial({ map: fade, vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
    halo.renderOrder = 1
    group.add(halo)
    if (!railWalls.empty) {
      const walls = railWalls.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
      walls.renderOrder = 2
      group.add(walls)
      group.add(railTops.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })))
    }

    // Posts to weave round.
    const postMat = new THREE.MeshBasicMaterial({ color: NEON.post })
    const postGlow = new THREE.MeshBasicMaterial({ color: NEON.post, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    for (const k of course.posts) {
      const core = new THREE.Mesh(new THREE.CylinderGeometry(k.r, k.r, k.h, 20), postMat)
      core.position.set(k.x, k.y + k.h / 2, k.z)
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(k.r * 1.45, k.r * 1.45, k.h * 1.04, 20, 1, true), postGlow)
      glow.position.copy(core.position)
      group.add(core, glow)
    }

    // Boost pads, mud and ice; bumpers, hammers, arms and slabs (only a course with them has any).
    this.buildZones()
    if (course.extras) this.buildMovers(grid)

    // Gates: the start's, one at every checkpoint, and the goal's.
    const start = course.pieces[0]!
    this.gate(start, start.len - 0.2, NEON.gate, false, fade, `${course.name.toUpperCase()}`)
    for (const L of course.lines) this.gates.push(this.gate(L.p, L.u, L.goal ? NEON.goal : NEON.gate, !!L.goal, fade, L.goal ? 'GOAL' : null))
  }

  /* ------------------------------------------------------------ the new pieces --- */

  /** Boost pads, mud and ice, a layer of each, laid over the track as zonePatch finds them. */
  private readonly zones: Record<Zone['kind'], Layer> = { boost: new Layer(), mud: new Layer(), ice: new Layer() }

  /** A zone laid on its piece's track, just over it, following its banks and bowls. */
  private zonePatch(p: Piece, zone: Zone) {
    const layer = this.zones[zone.kind]
    const lo = (u: number) => Math.max(zone.v0 ?? -Infinity, -halfWidth(p, u))
    const hi = (u: number) => Math.min(zone.v1 ?? Infinity, halfWidth(p, u))
    const n = 7
    // A pad's chevrons stretch across it, one every 1.6 m; mud and ice are the same patch wherever they lie.
    strip(
      layer,
      zone.u0,
      zone.u1,
      n,
      (u, j) => {
        const v = lo(u) + ((hi(u) - lo(u)) * j) / (n - 1)
        const [x, z] = point(p, u, v)
        return [x, heightAt(p, u, v) + 0.02, z, WHITE, zone.kind === 'boost' ? j / (n - 1) : v / 4, zone.kind === 'boost' ? (u - zone.u0) / 1.6 : (p.d0 + u) / 4]
      },
      0.25,
    )
  }

  private buildZones() {
    // Lifted off the track by depth as well as by height, so it never flickers through it from far away.
    const lift = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide } as const
    if (!this.zones.boost.empty) {
      // Chevrons pointing down the track, bright on a faint glow; they run forward (frame).
      const map = this.paint(128, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h)
        g.fillStyle = 'rgba(255,255,255,0.13)'
        g.fillRect(0, 0, w, h)
        g.strokeStyle = '#ffffff'
        g.lineWidth = 17
        g.lineJoin = 'round'
        g.lineCap = 'round'
        g.shadowColor = '#ffffff'
        g.shadowBlur = 14
        g.beginPath()
        g.moveTo(w * 0.14, h * 0.78)
        g.lineTo(w * 0.5, h * 0.3)
        g.lineTo(w * 0.86, h * 0.78)
        g.stroke()
      })
      map.wrapS = map.wrapT = THREE.RepeatWrapping
      this.boostMap = map
      const pad = this.zones.boost.mesh(new THREE.MeshBasicMaterial({ map, color: NEON.boost, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...lift }))
      pad.renderOrder = 2
      this.scene.add(pad)
    }
    if (!this.zones.mud.empty) {
      // Dark, matte and blotched, as wet mud is.
      const map = this.paint(256, 256, (g, w, h) => {
        g.fillStyle = NEON.mud
        g.fillRect(0, 0, w, h)
        const r = mulberry32(11)
        for (let i = 0; i < 70; i++) {
          const x = r() * w
          const y = r() * h
          const s = 6 + r() * 26
          g.fillStyle = r() < 0.55 ? 'rgba(14, 7, 12, 0.55)' : 'rgba(77, 47, 62, 0.5)'
          for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
            g.beginPath()
            g.ellipse(x + ox!, y + oy!, s, s * (0.5 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2)
            g.fill()
          }
        }
        g.fillStyle = 'rgba(255, 210, 235, 0.06)'
        for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h, 2, 2)
      })
      map.wrapS = map.wrapT = THREE.RepeatWrapping
      this.scene.add(this.zones.mud.mesh(new THREE.MeshBasicMaterial({ map, color: '#ffffff', ...lift })))
    }
    if (!this.zones.ice.empty) {
      // A pale sheen with streaks of shine across it.
      const map = this.paint(256, 256, (g, w, h) => {
        g.fillStyle = 'rgba(190, 228, 255, 0.42)'
        g.fillRect(0, 0, w, h)
        const r = mulberry32(5)
        g.lineCap = 'round'
        for (let i = 0; i < 26; i++) {
          const x = r() * w
          const y = r() * h
          const len = 20 + r() * 70
          g.strokeStyle = `rgba(255, 255, 255, ${0.25 + r() * 0.5})`
          g.lineWidth = 1 + r() * 2.5
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x + len, y - len * 0.45)
          g.stroke()
        }
        for (let i = 0; i < 60; i++) {
          g.fillStyle = `rgba(255, 255, 255, ${0.4 + r() * 0.6})`
          g.fillRect(r() * w, r() * h, 1.5, 1.5)
        }
      })
      map.wrapS = map.wrapT = THREE.RepeatWrapping
      const ice = this.zones.ice.mesh(new THREE.MeshBasicMaterial({ map, color: NEON.ice, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, ...lift }))
      ice.renderOrder = 2
      this.scene.add(ice)
    }
  }

  /** A fork's hole: a line of light round it, its glow falling off onto the track, a skirt down into it, and its rails. */
  private holeEdges(p: Piece, at: { edges: Layer; halos: Layer; skirts: Layer; railWalls: Layer; railTops: Layer }, depth: number) {
    const h = p.hole!
    const edge = new THREE.Color(NEON.edge)
    const rail = new THREE.Color(NEON.rail)
    const skirtTop = new THREE.Color(NEON.skirtTop)
    const skirtLow = new THREE.Color(NEON.skirtLow)
    const xyz = (u: number, v: number, dy = 0): [number, number, number] => {
      const [x, z] = point(p, u, v)
      return [x, heightAt(p, u, v) + dy, z]
    }
    // Along each side, the track's side of the hole being away from it: below v0, above v1.
    for (const [v, away, railed] of [
      [h.v0, -1, h.railV0],
      [h.v1, 1, h.railV1],
    ] as const) {
      strip(at.edges, h.u0, h.u1, 2, (u, j) => [...xyz(u, v + away * j * 0.09, 0.015), edge])
      strip(at.halos, h.u0, h.u1, 2, (u, j) => [...xyz(u, v + away * j * 0.9, 0.01), edge, j, 0])
      strip(at.skirts, h.u0, h.u1, 2, (u, j) => [...xyz(u, v, -j * depth), j ? skirtLow : skirtTop])
      if (railed) {
        strip(at.railWalls, h.u0, h.u1, 2, (u, j) => [...xyz(u, v, j * RAIL_H), rail, j, 0])
        strip(at.railTops, h.u0, h.u1, 2, (u, j) => {
          const [x, z] = point(p, u, v + away * j * 0.08)
          return [x, heightAt(p, u, v) + RAIL_H, z, rail]
        })
      }
    }
    // Across each end of it.
    for (const [u, away] of [
      [h.u0, -1],
      [h.u1, 1],
    ] as const) {
      const n = 7
      const lip = at.edges.pos.length / 3
      const face = at.skirts.pos.length / 3
      for (let k = 0; k < n; k++) {
        const v = h.v0 + ((h.v1 - h.v0) * k) / (n - 1)
        at.edges.vert(...xyz(u, v, 0.015), edge)
        at.edges.vert(...xyz(u + away * 0.09, v, 0.015), edge)
        at.skirts.vert(...xyz(u, v), skirtTop)
        at.skirts.vert(...xyz(u, v, -depth), skirtLow)
      }
      for (let k = 0; k < n - 1; k++) {
        const a = lip + k * 2
        at.edges.tri(a, a + 1, a + 2)
        at.edges.tri(a + 1, a + 3, a + 2)
        const b = face + k * 2
        at.skirts.tri(b, b + 1, b + 2)
        at.skirts.tri(b + 1, b + 3, b + 2)
      }
    }
  }

  /**
   * A loop's track: a ribbon up and over and down again, its grid running on from the track's, edged in light,
   * walled low on both sides, its skirt on the outside.
   */
  private loopRibbon(p: Piece, at: { surface: Layer; edges: Layer; halos: Layer; skirts: Layer; railWalls: Layer; railTops: Layer }) {
    const edge = new THREE.Color(NEON.edge)
    const rail = new THREE.Color(NEON.rail)
    const skirtTop = new THREE.Color(NEON.skirtTop)
    const skirtLow = new THREE.Color(NEON.skirtLow)
    const c = Math.cos(p.h0)
    const s = Math.sin(p.h0)
    // `u` round it and `v` across, lifted `off` toward the loop's middle (less than 0: away from it).
    const xyz = (u: number, v: number, off = 0): [number, number, number] => {
      const th = loopTheta(p, u)
      const [x, z] = point(p, u, v)
      const st = Math.sin(th)
      return [x - st * c * off, heightAt(p, u, v) + Math.cos(th) * off, z - st * s * off]
    }
    const lit = (u: number) => {
      const th = loopTheta(p, u)
      const n = new THREE.Vector3(-Math.sin(th) * c, Math.cos(th), -Math.sin(th) * s)
      return WHITE.clone().multiplyScalar(0.55 + 0.45 * Math.abs(n.dot(LIGHT)))
    }
    const step = 0.25
    sheet(
      at.surface,
      p,
      9,
      (u, j) => {
        const hw = loopHalfWidth(p, u)
        const v = -hw + (2 * hw * j) / 8
        return [...xyz(u, v), lit(u), v / 2, (p.d0 + u) / 2]
      },
      step,
    )
    for (const side of [-1, 1]) {
      sheet(at.edges, p, 2, (u, j) => [...xyz(u, side * (loopHalfWidth(p, u) - j * 0.09), 0.015), edge], step)
      sheet(at.halos, p, 2, (u, j) => [...xyz(u, side * (loopHalfWidth(p, u) - j * 0.9), 0.01), edge, j, 0], step)
      sheet(at.skirts, p, 2, (u, j) => [...xyz(u, side * loopHalfWidth(p, u), -j * 0.6), j ? skirtLow : skirtTop], step)
      sheet(at.railWalls, p, 2, (u, j) => [...xyz(u, side * loopHalfWidth(p, u), j * 0.45), rail, j, 0], step)
      sheet(at.railTops, p, 2, (u, j) => [...xyz(u, side * (loopHalfWidth(p, u) - j * 0.08), 0.45), rail], step)
    }
  }

  /** Bumpers, hammers, arms and slabs: each its own meshes, which `frame` moves. */
  private buildMovers(grid: THREE.Texture) {
    const x = this.course.extras!
    const glowBits = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } as const
    // Danger, in stripes: the hammers' heads and the arms' bars.
    const stripes = this.paint(128, 32, (g, w, h) => {
      g.fillStyle = NEON.dangerDark
      g.fillRect(0, 0, w, h)
      g.fillStyle = NEON.danger
      for (let i = -2; i < 8; i++) {
        g.beginPath()
        g.moveTo(i * 24, h)
        g.lineTo(i * 24 + 12, h)
        g.lineTo(i * 24 + 12 + h, 0)
        g.lineTo(i * 24 + h, 0)
        g.closePath()
        g.fill()
      }
    })
    stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping
    const danger = new THREE.MeshBasicMaterial({ map: stripes })
    const hot = new THREE.MeshBasicMaterial({ color: NEON.danger })
    const hotGlow = new THREE.MeshBasicMaterial({ color: NEON.danger, opacity: 0.2, ...glowBits })
    const steel = new THREE.MeshBasicMaterial({ color: NEON.steel })
    const steelEdge = new THREE.MeshBasicMaterial({ color: NEON.rail })

    // Bumpers: a dark drum with a ring of light round its top and a band round its middle; the ring and its
    // glow flash white and it swells a moment when it kicks (frame).
    for (const k of x.bumpers) {
      const body = new THREE.Group()
      body.position.set(k.x, k.y, k.z)
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(k.r, k.r * 1.06, k.h, 28), new THREE.MeshBasicMaterial({ color: NEON.bumper }))
      drum.position.y = k.h / 2
      const base = new THREE.Color(NEON.bumperRing)
      const ringMat = new THREE.MeshBasicMaterial({ color: base.clone() })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(k.r * 0.86, 0.08, 10, 40), ringMat)
      ring.rotation.x = Math.PI / 2
      ring.position.y = k.h + 0.02
      const cap = new THREE.Mesh(new THREE.CircleGeometry(k.r * 0.78, 28), new THREE.MeshBasicMaterial({ color: NEON.bumper, side: THREE.DoubleSide }))
      cap.rotation.x = -Math.PI / 2
      cap.position.y = k.h + 0.005
      const band = new THREE.Mesh(new THREE.TorusGeometry(k.r * 1.04, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: NEON.bumperBand }))
      band.rotation.x = Math.PI / 2
      band.position.y = k.h * 0.45
      const glowMat = new THREE.MeshBasicMaterial({ color: NEON.bumperRing, opacity: 0.18, ...glowBits })
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(k.r * 1.5, k.r * 1.5, k.h * 1.1, 28, 1, true), glowMat)
      glow.position.y = k.h / 2
      body.add(drum, ring, cap, band, glow)
      this.scene.add(body)
      this.bumpers.push({ body, ring: ringMat, glow: glowMat, base, at: -Infinity })
    }

    for (const m of x.movers) {
      if (m.kind === 'hammer') {
        // A gantry over the track: a pylon either side, clear of the head's swing, a beam across, the axle under
        // its middle. The arm and the head swing from the axle, across the track.
        const frame = new THREE.Group()
        frame.position.set(m.x, m.y, m.z)
        frame.rotation.y = -m.h
        const wide = m.arm * Math.sin(m.swing) + HAMMER_R + 0.7
        const drop = m.y - m.ground + 2.5
        for (const side of [-1, 1]) {
          const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.26, drop + 0.5, 0.26), steel)
          pylon.position.set(0, 0.25 - drop / 2, side * wide)
          const trim = new THREE.Mesh(new THREE.BoxGeometry(0.05, drop + 0.5, 0.3), steelEdge)
          trim.position.set(0.14, 0.25 - drop / 2, side * wide)
          frame.add(pylon, trim)
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 2 * wide + 0.26), steel)
        beam.position.y = 0.42
        const beamTrim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 2 * wide + 0.3), steelEdge)
        beamTrim.position.y = 0.6
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 14).rotateZ(Math.PI / 2), hot)
        frame.add(beam, beamTrim, axle)
        const swing = new THREE.Group()
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, m.arm, 0.16), steel)
        arm.position.y = -m.arm / 2
        const head = new THREE.Mesh(new THREE.CylinderGeometry(HAMMER_R, HAMMER_R, 2 * HAMMER_HALF, 28).rotateZ(Math.PI / 2), danger)
        head.position.y = -m.arm
        const halo = new THREE.Mesh(new THREE.CylinderGeometry(HAMMER_R * 1.35, HAMMER_R * 1.35, 2 * HAMMER_HALF * 1.1, 24, 1, true).rotateZ(Math.PI / 2), hotGlow)
        halo.position.y = -m.arm
        swing.add(arm, head, halo)
        for (const end of [-1, 1]) {
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(HAMMER_R * 1.03, HAMMER_R * 1.03, 0.08, 28).rotateZ(Math.PI / 2), hot)
          rim.position.set(end * HAMMER_HALF, -m.arm, 0)
          swing.add(rim)
        }
        frame.add(swing)
        this.scene.add(frame)
        this.hammers.push({ m, swing })
      } else {
        // A post that stands still, and the bar through it that turns.
        const post = new THREE.Mesh(new THREE.CylinderGeometry(HUB_R, HUB_R * 1.1, HUB_H, 24), steel)
        post.position.set(m.x, m.ground + HUB_H / 2, m.z)
        const cap = new THREE.Mesh(new THREE.TorusGeometry(HUB_R * 0.95, 0.06, 8, 32), hot)
        cap.rotation.x = Math.PI / 2
        cap.position.set(m.x, m.ground + HUB_H, m.z)
        this.scene.add(post, cap)
        const turn = new THREE.Group()
        turn.position.set(m.x, m.y, m.z)
        const long = m.reach + m.back
        const bar = new THREE.Mesh(new THREE.BoxGeometry(long, 2 * ARM_R, 2 * ARM_R), danger)
        bar.position.x = (m.reach - m.back) / 2
        const halo = new THREE.Mesh(new THREE.BoxGeometry(long + 0.2, 2 * ARM_R + 0.22, 2 * ARM_R + 0.22), hotGlow)
        halo.position.x = bar.position.x
        turn.add(bar, halo)
        for (const tip of [m.reach, -m.back]) {
          if (tip === 0) continue
          const end = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2 * ARM_R + 0.04, 2 * ARM_R + 0.04), hot)
          end.position.x = tip - Math.sign(tip) * 0.05
          turn.add(end)
        }
        this.scene.add(turn)
        this.arms.push({ m, turn })
      }
    }

    // Slabs: a block of the track's own glass, its top edged in cyan light.
    for (const pl of x.platforms) {
      const slab = new THREE.Group()
      const T = 0.5
      const top = new THREE.PlaneGeometry(2 * pl.hl, 2 * pl.hw)
      top.rotateX(-Math.PI / 2)
      const uv = top.attributes.uv!
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * pl.hl, uv.getY(i) * pl.hw)
      slab.add(new THREE.Mesh(top, new THREE.MeshBasicMaterial({ map: grid, color: '#d9d2ff' })))
      const block = new THREE.Mesh(new THREE.BoxGeometry(2 * pl.hl, T, 2 * pl.hw), new THREE.MeshBasicMaterial({ color: NEON.skirtTop }))
      block.position.y = -T / 2 - 0.01
      const under = new THREE.Mesh(new THREE.BoxGeometry(2 * pl.hl - 0.3, 0.6, 2 * pl.hw - 0.3), new THREE.MeshBasicMaterial({ color: NEON.skirtLow }))
      under.position.y = -T - 0.3
      slab.add(block, under)
      const lit = new THREE.MeshBasicMaterial({ color: NEON.slab })
      for (const side of [-1, 1]) {
        const long = new THREE.Mesh(new THREE.BoxGeometry(2 * pl.hl, 0.05, 0.12), lit)
        long.position.set(0, 0.02, side * (pl.hw - 0.06))
        const short = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 2 * pl.hw), lit)
        short.position.set(side * (pl.hl - 0.06), 0.02, 0)
        slab.add(long, short)
      }
      const glow = new THREE.Mesh(new THREE.BoxGeometry(2 * pl.hl + 0.4, T + 0.3, 2 * pl.hw + 0.4), new THREE.MeshBasicMaterial({ color: NEON.slab, opacity: 0.1, ...glowBits }))
      glow.position.y = -T / 2
      slab.add(glow)
      slab.rotation.y = -pl.h
      this.scene.add(slab)
      this.slabs.push({ pl, slab })
    }
  }

  /** A bumper kicked the ball at `t` seconds into the run: its lights flash. */
  bumped(index: number, t: number) {
    const k = this.bumpers[index]
    if (k) k.at = t
  }

  /** The moving pieces where the run's clock has them, and bumpers flashing a moment after a kick. */
  private moveExtras(clock: number) {
    for (const { m, swing } of this.hammers) swing.rotation.x = -moverAngle(m, clock)[0]
    for (const { m, turn } of this.arms) turn.rotation.y = -(m.h + moverAngle(m, clock)[0])
    for (const { pl, slab } of this.slabs) {
      const at = platformPose(pl, clock)
      slab.position.set(at.x, pl.y, at.z)
    }
    for (const k of this.bumpers) {
      const since = clock - k.at
      const flash = since >= 0 && since < 0.9 ? Math.exp(-since / 0.14) : 0
      k.ring.color.copy(k.base).lerp(WHITE, flash)
      k.glow.opacity = 0.18 + 0.6 * flash
      k.body.scale.setScalar(1 + 0.16 * flash)
    }
    if (this.boostMap) this.boostMap.offset.y = -((clock * 1.5) % 1)
  }

  private gate(p: Piece, u: number, color: string, goal: boolean, fade: THREE.Texture, label: string | null): Gate {
    const hw = halfWidth(p, u) + 0.2
    const [x, z] = point(p, u, 0)
    const y = heightAt(p, u, 0)
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = -headingAt(p, u)
    const mat = new THREE.MeshBasicMaterial({ color })
    const H = 2.7
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, H, 0.16), mat)
      post.position.set(0, H / 2 + heightAt(p, u, s * hw) - y, s * hw)
      g.add(post)
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2 * hw + 0.16), mat)
    bar.position.set(0, H, 0)
    g.add(bar)
    const curtain = new THREE.MeshBasicMaterial({ color, map: fade, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const sheetGeo = new THREE.PlaneGeometry(2 * hw, H)
    // The fade runs up the curtain: bright at the track, gone at the bar.
    const uv = sheetGeo.attributes.uv!
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), 0)
    const drape = new THREE.Mesh(sheetGeo, curtain)
    drape.rotation.y = Math.PI / 2
    drape.position.set(0, H / 2, 0)
    g.add(drape)
    if (label) {
      const tex = this.paint(
        512,
        96,
        (c, w, hh) => {
          c.clearRect(0, 0, w, hh)
          c.fillStyle = 'rgba(7,5,15,0.85)'
          c.fillRect(0, 0, w, hh)
          c.strokeStyle = color
          c.lineWidth = 6
          c.strokeRect(3, 3, w - 6, hh - 6)
          c.fillStyle = '#ffffff'
          c.font = '800 54px "Outfit", system-ui, sans-serif'
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.fillText(label, w / 2, hh / 2 + 2, w - 40)
        },
        true,
      )
      const width = Math.min(2 * hw, 5)
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (96 / 512)), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))
      sign.rotation.y = -Math.PI / 2
      sign.position.set(0, H + 0.62, 0)
      g.add(sign)
    }
    this.scene.add(g)
    return { mat, curtain, goal }
  }

  /** Far below, a floor of light, and peaks of wire standing on it. */
  private buildFloor() {
    const course = this.course
    const floorY = course.minY - 42
    const tex = this.paint(128, 128, (g, w, h) => {
      g.fillStyle = NEON.night
      g.fillRect(0, 0, w, h)
      g.strokeStyle = NEON.floor
      g.lineWidth = 2
      g.strokeRect(1, 1, w - 2, h - 2)
    })
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(3000 / 14, 3000 / 14)
    const cx = (course.box[0] + course.box[1]) / 2
    const cz = (course.box[2] + course.box[3]) / 2
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ map: tex }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx, floorY, cz)
    this.scene.add(floor)
    const peakMat = new THREE.LineBasicMaterial({ color: NEON.peaks })
    const r = mulberry32(hashString(`peaks:${course.key}`))
    const span = Math.max(course.box[1] - course.box[0], course.box[3] - course.box[2]) / 2
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2
      const d = span + 40 + r() * 260
      const height = 25 + r() * 70
      const cone = new THREE.ConeGeometry(height * (0.35 + r() * 0.25), height, 4, 1)
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(cone), peakMat)
      cone.dispose()
      lines.position.set(cx + Math.cos(a) * d, floorY + height / 2, cz + Math.sin(a) * d)
      lines.rotation.y = r() * Math.PI
      this.scene.add(lines)
    }
  }

  /** Whose run the ghost is. */
  private setGhostTag(text: string) {
    if (text === this.ghostTagText) return
    this.ghostTagText = text
    const found = this.lettered.find(([t]) => t === this.ghostTagTex)
    if (found) {
      const c = this.ghostTagTex.image as HTMLCanvasElement
      found[1](c.getContext('2d')!, c.width, c.height)
      this.ghostTagTex.needsUpdate = true
    }
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return
    if (width <= 0 || height <= 0) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    // A tall screen sees little either side, so it looks wider, and from further back (frame).
    this.camera.fov = this.camera.aspect < 1 ? 62 + (1 - this.camera.aspect) * 34 : 62
    this.camera.updateProjectionMatrix()
    const k = this.camera.aspect < 1 ? 0.78 : 1
    this.ghostTag.scale.set(0.2 * k, 0.05 * k, 1)
  }

  /** The next frame puts the camera straight behind the ball: a run begins, or starts again at a checkpoint. */
  snap() {
    this.snapNext = true
    this.omega.set(0, 0, 0)
    this.loopView = 0
    this.loopSeen = null
    // A new run's clock starts again: last run's kicks aren't this one's.
    for (const k of this.bumpers) k.at = -Infinity
  }

  /** The way the camera looks, across the ground: a tilt forward on the keys or the stick leans the world that way. */
  heading(): number {
    return this.yaw
  }

  frame(f: SceneFrame, dt: number) {
    const b = f.ball
    // The moving pieces keep the run's clock, the one the ball's physics keeps; on the start card, one of their own.
    if (f.mode === 'menu') this.idle += dt
    const clock = f.mode === 'menu' ? this.idle : b.t
    this.moveExtras(clock)
    this.placeCamera(f, dt)
    if ((f.skin ?? null) !== this.skinShown) this.wear(f.skin ?? null)

    // The marble, rolling: on the track it turns about the line across the way it's going, as fast as it goes.
    // In the air it keeps the spin it left the ground with, through a jump or a bounce (Ramsey: "it's just
    // stationary" in the air); back down, its spin catches up with its roll over a moment, as a ball skids,
    // rather than all at once.
    this.ball.position.set(b.x, b.y, b.z)
    this.glow.position.copy(this.ball.position)
    if (dt > 0) {
      if (b.loop) {
        // Round a loop it rolls on the loop's track, about the line across it: the way in toward the loop's middle,
        // crossed with the way it's going.
        const th = loopTheta(b.loop.p, b.loop.u)
        const nx = -Math.sin(th) * Math.cos(b.loop.p.h0)
        const ny = Math.cos(th)
        const nz = -Math.sin(th) * Math.sin(b.loop.p.h0)
        this.roll.set(ny * b.vz - nz * b.vy, nz * b.vx - nx * b.vz, nx * b.vy - ny * b.vx).divideScalar(BALL_R)
        this.landedFor += dt
        this.omega.copy(this.roll)
      } else if (!b.air) {
        const sp = Math.hypot(b.vx, b.vy, b.vz)
        const across = Math.hypot(b.vx, b.vz)
        if (across > 1e-4) this.roll.set(b.vz / across, 0, -b.vx / across).multiplyScalar(sp / BALL_R)
        else this.roll.set(0, 0, 0)
        this.landedFor += dt
        if (this.landedFor < 0.2) this.omega.lerp(this.roll, 1 - Math.exp(-dt * 25))
        else this.omega.copy(this.roll)
      } else this.landedFor = 0
      const rate = this.omega.length()
      if (rate > 1e-4) {
        this.axis.copy(this.omega).divideScalar(rate)
        this.spin.setFromAxisAngle(this.axis, rate * dt)
        this.ball.quaternion.premultiply(this.spin)
      }
    }
    // The pool of light on the track below it, laid on the track's own shape, wider and fainter the higher it flies.
    // On a slab it's on the slab; round a loop there's none.
    const under =
      f.mode === 'menu' || b.loop ? null : this.slabs.length ? supportAt(this.course, b.x, b.z, b.y, clock) : surfaceAt(this.course, b.x, b.z, b.y)
    if (under) {
      const high = b.y - BALL_R - under.y
      const size = 1.6 + Math.min(4, high) * 0.35
      const p = under.p
      const pos = this.pool.geometry.attributes.position!
      const at = this.poolAt
      for (let i = 0; i < pos.count; i++) {
        const x = b.x + at[i * 3]! * size
        const z = b.z + at[i * 3 + 2]! * size
        const l = local(p, x, z)
        pos.setXYZ(i, x, heightAt(p, l.u, l.v) + 0.04, z)
      }
      pos.needsUpdate = true
      this.pool.visible = true
      ;(this.pool.material as THREE.MeshBasicMaterial).opacity = 0.65 / (1 + high * 0.6)
    } else this.pool.visible = false

    // The ghost, where the run to beat was at this moment, rolling by how far it went across the ground since
    // the last frame, as a ball would (it used to only turn on the spot); a jump to a new run or a checkpoint
    // doesn't turn it, nor does a rise or a drop on its own. Its tag stays upright over it. Fainter while it's
    // on top of you.
    if (f.ghost) {
      this.dressGhost(f.ghostSkin ?? null)
      const at = this.ghost.position
      const dx = f.ghost.x - at.x
      const dz = f.ghost.z - at.z
      const across = Math.hypot(dx, dz)
      if (this.ghostShown && across > 1e-4 && across < 3) {
        this.axis.set(dz / across, 0, -dx / across)
        this.spin.setFromAxisAngle(this.axis, across / BALL_R)
        this.ghostBall.quaternion.premultiply(this.spin)
      }
      at.set(f.ghost.x, f.ghost.y, f.ghost.z)
      this.ghostShown = true
      this.ghost.visible = true
      const shows = Math.min(0.9, 0.2 + this.ghost.position.distanceTo(this.ball.position) * 0.18)
      this.ghostWire.opacity = shows
      const dressed = this.ghostSkinShown ? this.ghostSkinned.get(this.ghostSkinShown) : undefined
      if (dressed) dressed.shell.opacity = (GHOST_SKIN_SHOWS * shows) / 0.9
      this.setGhostTag(f.ghostTag)
    } else {
      this.ghost.visible = false
      this.ghostShown = false
    }

    // Gates crossed turn green.
    if (f.passed !== this.passedShown) {
      this.passedShown = f.passed
      this.gates.forEach((g, i) => {
        const c = i < f.passed ? NEON.passed : g.goal ? NEON.goal : NEON.gate
        g.mat.color.set(c)
        g.curtain.color.set(c)
      })
    }
    this.renderer.render(this.scene, this.camera)
  }

  private placeCamera(f: SceneFrame, dt: number) {
    const course = this.course
    const cam = this.camera
    if (f.mode === 'menu') {
      // Circle high over the whole course.
      this.menuAngle += dt * (this.calm ? 0.02 : 0.06)
      const cx = (course.box[0] + course.box[1]) / 2
      const cz = (course.box[2] + course.box[3]) / 2
      const span = Math.max(course.box[1] - course.box[0], course.box[3] - course.box[2])
      const d = span * (cam.aspect < 1 ? 0.95 : 0.72) + 30
      cam.position.set(cx + Math.cos(this.menuAngle) * d, course.maxY + span * 0.42 + 18, cz + Math.sin(this.menuAngle) * d)
      cam.up.set(0, 1, 0)
      cam.lookAt(cx, (course.minY + course.maxY) / 2 - 4, cz)
      this.snapNext = true
      return
    }
    const b = f.ball
    const sp = Math.hypot(b.vx, b.vz)
    // Look the way the track goes here, leaning toward the way the ball is going. Round a loop, only the way
    // the loop goes: the ball comes back over the top the other way.
    let target = this.yaw
    const s = b.support
    if (s) target = headingAt(s.p, Math.max(0, Math.min(s.p.len, s.u)))
    if (sp > 2 && !b.loop) target += Math.max(-0.9, Math.min(0.9, angleTo(target, Math.atan2(b.vz, b.vx)))) * 0.55
    if (this.snapNext) {
      this.yaw = target
      this.followY = b.y
      this.shownTilt.set(0, 0)
      this.snapNext = false
    }
    const falling = f.mode === 'fallen'
    if (!falling) {
      if (f.mode === 'done') this.yaw += dt * (this.calm ? 0.08 : 0.3)
      else this.yaw += angleTo(this.yaw, target) * (1 - Math.exp(-dt * 3.2))
      // The height follows a little behind, so hops don't shake the view; round a loop it stays at the bottom.
      if (!b.loop) this.followY += (b.y - this.followY) * (1 - Math.exp(-dt * 9))
    }
    const fx = Math.cos(this.yaw)
    const fz = Math.sin(this.yaw)
    const tall = cam.aspect < 1 ? 1.2 : 1
    const dist = (6.2 + Math.min(sp, 16) * 0.13) * tall
    const height = (2.5 + Math.min(sp, 16) * 0.05) * tall
    const focus = this.focus.set(b.x, this.followY, b.z)
    const eye = this.eye.set(b.x - fx * dist, this.followY + height, b.z - fz * dist)
    const look = this.look.set(b.x + fx * 3.2, this.followY + 0.35, b.z + fz * 3.2)
    // The world leans the way it's tilted: turn the camera the other way round the ball. Side to side it
    // leans half as far as the tilt; forward and back much less, so the track ahead stays in view.
    this.shownTilt.lerp(this.wantTilt.set(f.tilt.x, f.tilt.z), 1 - Math.exp(-dt * 10))
    const t = this.shownTilt
    const along = (t.x * fx + t.y * fz) * 0.4
    const across = t.x * -fz + t.y * fx
    const sx = along * fx - across * fz
    const sz = along * fz + across * fx
    const tl = Math.hypot(sx, sz)
    this.camUp.copy(UP)
    if (tl > 1e-4) {
      this.axis.set(-sz, 0, sx).normalize()
      this.lean.setFromAxisAngle(this.axis, Math.asin(Math.min(1, tl)) * (this.calm ? 0.25 : 0.5))
      eye.sub(focus).applyQuaternion(this.lean).add(focus)
      look.sub(focus).applyQuaternion(this.lean).add(focus)
      this.camUp.applyQuaternion(this.lean)
    }
    // Round a loop, the camera goes over to a place behind it and off to its left, where the ball is seen going
    // all the way round, and comes back behind the ball once it's out.
    if (!falling) {
      const ride = b.loop
      if (ride) this.loopSeen = ride.p
      this.loopView += ((ride ? 1 : 0) - this.loopView) * (1 - Math.exp(-dt * (ride ? 5 : 2.4)))
    }
    const q = this.loopSeen
    if (q && this.loopView > 1e-3) {
      const c = Math.cos(q.h0)
      const sn = Math.sin(q.h0)
      const R = q.R!
      const mid = (q.shift ?? 0) / 2
      this.loopLook.set(q.x0 - mid * sn, q.y0 + R * 0.95, q.z0 + mid * c)
      this.loopEye.set(q.x0 - c * R * 1.2 + sn * R * 2.4, q.y0 + R * 1.15, q.z0 - sn * R * 1.2 - c * R * 2.4)
      const k = this.loopView * this.loopView * (3 - 2 * this.loopView)
      eye.lerp(this.loopEye, k)
      look.lerp(this.loopLook, k)
      this.camUp.lerp(UP, k).normalize()
      if (this.loopView < 0.01 && !b.loop) this.loopSeen = null
    }
    if (f.mode === 'done') {
      // Pull back and look down on it; on a tall screen, keep it above the card.
      const k = Math.min(1, f.doneFor / 1.2)
      this.axis.copy(eye).sub(focus)
      eye.addScaledVector(this.axis, 0.5 * k)
      eye.y += 2.5 * k
      if (cam.aspect < 1) look.y -= 3.2 * k
    }
    if (falling) {
      // Watch it go: the camera stays where it was.
      cam.up.copy(this.camUp)
      cam.lookAt(b.x, b.y, b.z)
      return
    }
    cam.position.copy(eye)
    cam.up.copy(this.camUp)
    cam.lookAt(look)
  }

  dispose() {
    this.disposed = true
    const marble = this.ball.material as THREE.MeshMatcapMaterial
    marble.matcap?.dispose()
    marble.map?.dispose()
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mats = mesh.material
      for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) m.dispose()
    })
    for (const t of this.textures) t.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
