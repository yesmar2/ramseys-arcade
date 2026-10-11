import * as THREE from 'three'
import { hazardBodies, newBody, newPose, solidPose, teleOf } from '../engine/sim.ts'
import type { Body, Course, Hazard, Role, Solid, Tele, TeleFn, TeleState, Volume, World } from '../engine/types.ts'
import type { Fx } from './fx.ts'
import { bake, boxSlab, discSlab, Layer, merge, paint, strip, xfOf, type SlabPaint } from './geo.ts'
import { CODE, LAMP, mix, roundRect, type Painter, type Tints } from './look.ts'
import { keyNotes } from './notes.ts'

/*
 * Gen 2's looks (the gen-2 looks contract, scratchpad wobble/gen2/new-looks.md): Bonk Alley's whack mallets and
 * pinball plungers, and the six rounds of our own: Fizz Geysers' vents and soda columns, Piano Steps' keys, Pinball
 * Table's playfield, flippers, steel balls and lit bumpers, Candy Lifts' lifts, Blip Bounce's trampolines, and
 * Sprinkle Drop's sprinkles with the red rings that say where each will land. The course view (course.ts) hands
 * these looks over and draws everything else.
 *
 * Cheap by design: everything that moves on the clock (keys, lifts, flippers, mallets, plungers, trampoline mats) is
 * a part of one of a few "morph" meshes, a draw call each for all of them, re-posed on the CPU each frame; steel
 * balls, sprinkles, rings, shadows and note pops are instanced; the lights are the course's own instanced lamps; what
 * never moves is merged into the course's chunks. A geyser's column and its foam crown are the only things drawn on
 * their own, and a pinball table's painted playfield.
 *
 * Every pose is a function of the clock, read from the engine (solidPose, hazardBodies, teleOf), so what's drawn is
 * where it is: a wind-up's tremble, a mat's dip and a head's squash are flourishes on top, never somewhere else.
 */

/**
 * A light in the course's instanced lamps (course.ts): its place, size, colour and how lit (0–1), set each frame;
 * `keep` for one set in the floor, still lit once Blip has passed it.
 */
export type Lamp = { x: number; y: number; z: number; size: number; colour: THREE.Color; on: number; keep?: boolean }

/** What the course view lends: its course, group, painter, materials, static layers, lamps and ground. */
export type Gen2Host = {
  course: Course
  group: THREE.Group
  painter: Painter
  tints: Tints
  rnd: () => number
  /** Vertex colours (tinted as the colour code is), the dotted bouncy teal, the floors' candy tiles. */
  mats: { ink: THREE.MeshBasicMaterial; bouncy: THREE.MeshBasicMaterial; floor: THREE.MeshBasicMaterial }
  tex: { dot: THREE.Texture; soda: THREE.Texture }
  /** A static layer merged into the course's chunk meshes (drawn when its chunk is near). */
  layer(z: number, mat: 'ink' | 'glow' | 'floor'): Layer
  lamp(x: number, y: number, z: number, size: number): Lamp
  surfaceBelow(x: number, z: number, top: number, t: number, world: World | null): { y: number; gx: number; gz: number } | null
  floorOf(s: { tint: number; round: number }): { top: THREE.Color; body: THREE.Color; hex: string; bodyHex: string }
  seen(z0: number, z1: number, cz: number): boolean
}

/** What gen2 needs each frame. */
export type Gen2Frame = { t: number; world: World | null; cam: THREE.Vector3; bean: THREE.Vector3; dt: number; calm: boolean; fx?: Fx | null }

const SOLID_LOOKS = new Set(['key-white', 'key-black', 'table', 'flipper', 'lift', 'trampoline', 'geyser-vent', 'deck-tile'])
/** A `mallet-handle` is a hit body only: the handle is drawn with its mallet. */
const HAZARD_LOOKS = new Set(['mallet', 'mallet-handle', 'plunger', 'plunger-low', 'plunger-high', 'pinball', 'sprinkle'])
const DECO_LOOKS = new Set(['geyser', 'mallet-shadow', 'drain'])

/** The candy colours sprinkles come in (pink, yellow, blue, green, orange): bright, a step off the colour code's. */
const SPRINKLE_HUES = ['#ff7ab6', '#ffd84d', '#6fd6ff', '#7be08f', '#ffa24c']
const HUE_NAMES: Record<string, string> = { pink: '#ff7ab6', yellow: '#ffd84d', blue: '#6fd6ff', green: '#7be08f', orange: '#ffa24c', violet: '#b79bff', purple: '#b79bff', white: '#ffffff', red: '#ff6b6b' }

const P = newPose()
const P2 = newPose()
const B: Body[] = [newBody()]
const B2: Body[] = [newBody()]
const M = new THREE.Matrix4()
const M2 = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const V = new THREE.Vector3()
const V2 = new THREE.Vector3()
const V3 = new THREE.Vector3()
const S = new THREE.Vector3()
const C = new THREE.Color()
const UP = new THREE.Vector3(0, 1, 0)

const colours = new Map<string, THREE.Color>()
/** A shared colour for a '#rrggbb' (never changed once made). */
function cc(hex: string): THREE.Color {
  let c = colours.get(hex)
  if (!c) colours.set(hex, (c = new THREE.Color(hex)))
  return c
}
const ease = (x: number) => x * x * (3 - 2 * x)
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** A thing's `params` (the contract asks for them on solids and hazards too; read defensively until they're there). */
function paramOf(o: object, key: string): number | string | boolean | undefined {
  return (o as { params?: Record<string, number | string | boolean> }).params?.[key]
}
function numParam(o: object, key: string): number | undefined {
  const v = paramOf(o, key)
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** How long each phase of a telegraph lasts, s (the first whole run of each within 30 s): for flourishes timed by one. */
function phaseLengths(tele: TeleFn | undefined): Partial<Record<TeleState, number>> {
  const out: Partial<Record<TeleState, number>> = {}
  if (!tele) return out
  const dt = 1 / 240
  let st = tele(0).state
  let since = 0
  let first = true
  for (let t = dt; t < 30; t += dt) {
    const s = tele(t).state
    if (s === st) continue
    if (!first && out[st] === undefined) out[st] = t - since
    first = false
    st = s
    since = t
  }
  return out
}

/** The role's colour for a hazard part: the colour code's, or `fallback` for a role that has none. */
function roleHex(role: Role, fallback: string): string {
  if (role === 'jump' || role === 'dive' || role === 'dodge' || role === 'bouncy' || role === 'helps' || role === 'pushes' || role === 'gold') return CODE[role]
  return fallback
}

/**
 * A material that takes an alpha per instance (an `ia` attribute on its instanced geometry): the landing rings,
 * shadows and note pops fade one by one in a single draw call.
 */
function alphaPerInstance<T extends THREE.MeshBasicMaterial>(mat: T): T {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float ia;\nvarying float vIa;').replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvIa = ia;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vIa;').replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.a *= vIa;')
  }
  mat.customProgramCacheKey = () => 'wobble-ia'
  return mat
}

type Quads = { mesh: THREE.InstancedMesh; alpha: THREE.InstancedBufferAttribute }

/** An instanced flat quad (lying on the ground, or facing the camera, which always looks +z) with an alpha each. */
function quads(n: number, mat: THREE.MeshBasicMaterial, facing: 'up' | 'camera'): Quads {
  const g = new THREE.PlaneGeometry(1, 1)
  if (facing === 'up') g.rotateX(-Math.PI / 2)
  else g.rotateY(Math.PI)
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1)
  alpha.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('ia', alpha)
  const mesh = new THREE.InstancedMesh(g, alphaPerInstance(mat), Math.max(1, n))
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.visible = false
  return { mesh, alpha }
}

/* ------------------------------------------------------------------ morph --- */

type MorphPart = { start: number; count: number; e: Float32Array; hidden: boolean; tc: number; tk: number }

/**
 * Many moving things drawn as one mesh (one draw call): each part keeps its vertices in its own frame, and each frame
 * they're moved to its pose on the CPU (a few thousand vertices at most) and tinted when it says. A part that isn't
 * near is folded away to nothing.
 */
class Morph {
  mesh: THREE.Mesh | null = null
  private readonly parts: MorphPart[] = []
  private build: { pos: number[]; col: number[]; uv: number[]; idx: number[] } | null = { pos: [], col: [], uv: [], idx: [] }
  private local = new Float32Array(0)
  private base = new Float32Array(0)
  private pos: THREE.BufferAttribute | null = null
  private col: THREE.BufferAttribute | null = null
  private moved = false
  private tinted = false
  /** Whether any part was posed this frame. */
  private shown = false

  /** A part, from a baked shape (positions, colours, uvs, indices) in its own frame; returns its index. */
  add(geo: THREE.BufferGeometry): number {
    const b = this.build!
    const pos = geo.attributes.position!
    const col = geo.attributes.color
    const uv = geo.attributes.uv
    const start = b.pos.length / 3
    for (let k = 0; k < pos.count; k++) {
      b.pos.push(pos.getX(k), pos.getY(k), pos.getZ(k))
      if (col) b.col.push(col.getX(k), col.getY(k), col.getZ(k))
      else b.col.push(1, 1, 1)
      if (uv) b.uv.push(uv.getX(k), uv.getY(k))
      else b.uv.push(0, 0)
    }
    if (geo.index) for (let k = 0; k < geo.index.count; k++) b.idx.push(geo.index.getX(k) + start)
    else for (let k = 0; k < pos.count; k++) b.idx.push(start + k)
    geo.dispose()
    this.parts.push({ start, count: pos.count, e: new Float32Array(16).fill(NaN), hidden: false, tc: -1, tk: 0 })
    return this.parts.length - 1
  }

  /** The mesh, once every part is in. */
  finish(mat: THREE.Material, group: THREE.Group, order = 0) {
    const b = this.build!
    this.build = null
    if (!b.idx.length) return
    this.local = new Float32Array(b.pos)
    this.base = new Float32Array(b.col)
    const geo = new THREE.BufferGeometry()
    this.pos = new THREE.BufferAttribute(new Float32Array(b.pos), 3).setUsage(THREE.DynamicDrawUsage)
    this.col = new THREE.BufferAttribute(new Float32Array(b.col), 3).setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', this.pos)
    geo.setAttribute('color', this.col)
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2))
    geo.setIndex(b.idx)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.matrixAutoUpdate = false
    mesh.renderOrder = order
    mesh.visible = false
    group.add(mesh)
    this.mesh = mesh
    // Everything starts folded away until it's posed.
    for (let i = 0; i < this.parts.length; i++) this.hide(i)
  }

  /** Part i to the pose `m` (from its own frame). */
  pose(i: number, m: THREE.Matrix4) {
    const part = this.parts[i]!
    const e = m.elements
    this.shown = true
    if (!this.pos) return
    let same = !part.hidden
    if (same)
      for (let k = 0; k < 16; k++)
        if (part.e[k] !== e[k]) {
          same = false
          break
        }
    if (same) return
    part.e.set(e)
    part.hidden = false
    const L = this.local
    const out = this.pos.array as Float32Array
    for (let v = part.start; v < part.start + part.count; v++) {
      const x = L[v * 3]!
      const y = L[v * 3 + 1]!
      const z = L[v * 3 + 2]!
      out[v * 3] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!
      out[v * 3 + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!
      out[v * 3 + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!
    }
    this.moved = true
  }

  /** Part i folded away (not near, or not there). */
  hide(i: number) {
    const part = this.parts[i]!
    if (part.hidden || !this.pos) return
    part.hidden = true
    part.e.fill(NaN)
    const out = this.pos.array as Float32Array
    for (let v = part.start; v < part.start + part.count; v++) {
      out[v * 3] = 0
      out[v * 3 + 1] = -1e4
      out[v * 3 + 2] = 0
    }
    this.moved = true
  }

  /**
   * Part i's colours `k` of the way to `hex`, keeping its baked light (a dark part, `glow`, goes to the colour itself:
   * a black key lights up amber rather than browning); null for its own.
   */
  tint(i: number, hex: string | null, k: number, glow = false) {
    const part = this.parts[i]!
    const key = hex && k > 0.002 ? parseInt(hex.slice(1), 16) : -1
    const kk = key < 0 ? 0 : Math.round(k * 200) / 200
    if (part.tc === key && part.tk === kk) return
    part.tc = key
    part.tk = kk
    if (!this.col) return
    const out = this.col.array as Float32Array
    const bs = this.base
    if (key >= 0) C.set(hex!)
    for (let v = part.start; v < part.start + part.count; v++) {
      const r = bs[v * 3]!
      const g = bs[v * 3 + 1]!
      const b = bs[v * 3 + 2]!
      if (key < 0) {
        out[v * 3] = r
        out[v * 3 + 1] = g
        out[v * 3 + 2] = b
        continue
      }
      const lit = glow ? 0.72 + 0.28 * Math.min(1, Math.max(r, g, b) * 3) : Math.max(r, g, b)
      out[v * 3] = r + (C.r * lit - r) * kk
      out[v * 3 + 1] = g + (C.g * lit - g) * kk
      out[v * 3 + 2] = b + (C.b * lit - b) * kk
    }
    this.tinted = true
  }

  /** After a frame's poses: send what changed, and draw it only if something was near. */
  flush() {
    if (!this.mesh) return
    if (this.moved && this.pos) this.pos.needsUpdate = true
    if (this.tinted && this.col) this.col.needsUpdate = true
    this.moved = this.tinted = false
    this.mesh.visible = this.shown
    this.shown = false
  }
}

/* ------------------------------------------------------------- the views --- */

/** A moving part: its morph (one a round and kind, so a round's parts are drawn only near it) and its index there. */
type Part = { m: Morph; i: number }
/** The morphs' materials: vertex colours, the lifts' candy stripes, the trampolines' dotted teal, the floors' tiles. */
type MorphKind = 'ink' | 'candy' | 'mats' | 'floor'

/** A mallet: its head hazards (two make a long head), its swing's pivot and axis, its parts, its head's size, where its landing spot is painted (its `mallet-shadow` deco, if the round lays one), and the telegraph phase it was in last frame. */
type MalletView = { hs: Hazard[]; pivot: THREE.Vector3; axis: THREE.Vector3; handle: Part; head: Part; R: number; hh: number; spot: { x: number; y: number; z: number; s: number } | null; was: TeleState; z0: number; z1: number }

type PlungerView = { h: Hazard; dir: 1 | -1; cap: Part; spring: Part; T: number; mouth: number; lamp: Lamp }

type KeyView = { i: number; s: Solid; part: Part; black: boolean }

/**
 * A lift: its slab, its rim and its two arrows (▲, ▼: the one for the way it's about to go blinks), its poles when they
 * ride across with it (a lift that slides as well), its lamps and where they stand at its rest, its travel.
 */
type LiftView = { i: number; s: Solid; slab: Part; rim: Part; up: Part; down: Part; poles: Part | null; lamps: Lamp[]; at: [number, number][]; lo: number; hi: number }

type FlipperView = { i: number; s: Solid; part: Part; px: number; pz: number; rest: number; sign: number; lamp: Lamp; act: number; z0: number; z1: number }

type TrampolineView = { i: number; s: Solid; mat: Part; frame: Part | null; age: number; deep: number }

type TableView = { mesh: THREE.Mesh; z0: number; z1: number; lamps: { lamp: Lamp; lane: number; row: number }[] }

type TileView = { i: number; s: Solid; part: Part }

type BumperRing = { i: number; h: Hazard; lamps: Lamp[]; pulse: number }

type VentView = { i: number; s: Solid; r: number; bubble: number }

/**
 * A geyser's column: its meshes, its foot and how tall it can stand, its radii across and along, how it leans (a spray:
 * the way across, unit, and how far, rad), where a column out of the sea rises to in its warning (just under where
 * its lift starts; null for one on a vent, which bubbles up a mound), and what drives it.
 */
type ColumnView = {
  mesh: THREE.Mesh
  crown: THREE.Mesh
  x: number
  z: number
  base: number
  tall: number
  rx: number
  rz: number
  lx: number
  lz: number
  lean: number
  rise: number | null
  vol: (Volume & { kind: 'wind' }) | null
  vent: Solid | null
  spray: number
  z0: number
  z1: number
}

/** `ghost` draws the sprinkles between the camera and Blip at 30%, as the course fades anything in the way. */
type SprinkleGroup = { hs: Hazard[]; mesh: THREE.InstancedMesh; ghost: THREE.InstancedMesh; r: number; len: number; hues: string[] }

type PinballGroup = { members: { h: Hazard; axis: THREE.Vector3 }[]; mesh: THREE.InstancedMesh }

/** One landing ring, shadow or note pop to draw this frame. */
type Spot = { x: number; y: number; z: number; s: number; a: number }

export class Gen2View {
  private readonly host: Gen2Host
  private readonly course: Course
  /** Moving parts, a morph a round and kind: vertex-coloured, the lifts' candy stripes, the trampolines' dotted teal. */
  private readonly morphs = new Map<string, { kind: MorphKind; m: Morph }>()
  private readonly claimed = { solid: new Set<number>(), hazard: new Set<number>(), volume: new Set<number>(), deco: new Set<number>() }
  private readonly mallets: MalletView[] = []
  private readonly plungers: PlungerView[] = []
  private readonly keys: KeyView[] = []
  private notesOf = new Map<number, number>()
  private readonly lifts: LiftView[] = []
  private readonly flippers: FlipperView[] = []
  private readonly trampolines: TrampolineView[] = []
  private readonly trampolineOf = new Map<number, TrampolineView>()
  private readonly tables: TableView[] = []
  private readonly tiles: TileView[] = []
  private readonly bumpers: BumperRing[] = []
  private readonly bumperOf = new Map<number, BumperRing>()
  private readonly vents: VentView[] = []
  private readonly poolParts: THREE.BufferGeometry[] = []
  private poolMesh: THREE.Mesh | null = null
  private poolMat: THREE.MeshBasicMaterial | null = null
  private readonly columns: ColumnView[] = []
  private columnMat: THREE.MeshBasicMaterial | null = null
  private readonly sprinkles: SprinkleGroup[] = []
  private readonly pinballs: PinballGroup[] = []
  private rings: { ring: Quads; fill: Quads } | null = null
  private blobs: Quads | null = null
  private notes: Quads | null = null
  private readonly pops: { x: number; y: number; z: number; age: number; side: number }[] = []
  private readonly ringSpots: Spot[] = []
  private readonly fillSpots: Spot[] = []
  private readonly blobSpots: Spot[] = []
  private clock = 0

  constructor(host: Gen2Host) {
    this.host = host
    this.course = host.course
    const c = this.course
    c.solids.forEach((s, i) => {
      if (SOLID_LOOKS.has(s.look)) this.claimed.solid.add(i)
    })
    c.hazards.forEach((h, i) => {
      if (HAZARD_LOOKS.has(h.look)) this.claimed.hazard.add(i)
    })
    c.volumes.forEach((v, i) => {
      if (v.kind === 'wind' && v.look === 'geyser') this.claimed.volume.add(i)
    })
    c.decos.forEach((d, i) => {
      if (DECO_LOOKS.has(d.look)) this.claimed.deco.add(i)
    })
    // A course without any of these (every gen-1 day) gets nothing from here.
    if (!this.claimed.solid.size && !this.claimed.hazard.size && !this.claimed.volume.size && !this.claimed.deco.size) return
    this.buildMallets()
    this.buildPlungers()
    this.buildKeys()
    this.buildLifts()
    this.buildTables()
    this.buildFlippers()
    this.buildTrampolines()
    this.buildBumperRings()
    this.buildGeysers()
    this.buildSprinkles()
    this.buildPinballs()
    this.buildDrains()
    this.buildTiles()
    this.buildSpots()
    let candy: THREE.MeshBasicMaterial | null = null
    let mats: THREE.MeshBasicMaterial | null = null
    for (const { kind, m } of this.morphs.values()) {
      if (kind === 'ink') m.finish(host.mats.ink, host.group)
      else if (kind === 'floor') m.finish(host.mats.floor, host.group)
      else if (kind === 'candy') m.finish((candy ??= this.candyMaterial()), host.group)
      // The mats bulge up as they spring back (mirrored in y), so they're seen from either side.
      else m.finish((mats ??= host.tints.onCode(new THREE.MeshBasicMaterial({ vertexColors: true, map: host.mats.bouncy.map, side: THREE.DoubleSide }))), host.group)
    }
  }

  /** Whether this draws thing i (the course view then leaves it alone). */
  claims(kind: 'solid' | 'hazard' | 'volume' | 'deco', i: number): boolean {
    return this.claimed[kind].has(i)
  }

  /** A moving part from a baked shape in its own frame, in round `round`'s morph of `kind`. */
  private part(kind: MorphKind, round: number, geo: THREE.BufferGeometry): Part {
    const key = `${kind}:${round}`
    let entry = this.morphs.get(key)
    if (!entry) this.morphs.set(key, (entry = { kind, m: new Morph() }))
    return { m: entry.m, i: entry.m.add(geo) }
  }

  /* ------------------------------------------------------------- mallets --- */

  /**
   * Whack mallets: a candy post at the walkway's side up to the pivot (the hazard's anchor), a wooden handle out to
   * the head, and the head, a red barrel with two yellow bands lying across the handle in the swing's plane, so its
   * flat end strikes the floor. Two `mallet` hazards on one anchor are one mallet with a long head; `mallet-handle`
   * hit bodies on it thicken its handle to match them. Its landing spot (a `mallet-shadow` deco) darkens as it comes.
   */
  private buildMallets() {
    const c = this.course
    const keyOf = (h: Hazard) => `${h.x.toFixed(2)}:${h.y.toFixed(2)}:${h.z.toFixed(2)}`
    const groups = new Map<string, Hazard[]>()
    const handles = new Map<string, number>()
    for (const h of c.hazards) {
      if (h.look === 'mallet-handle') handles.set(keyOf(h), Math.max(handles.get(keyOf(h)) ?? 0, h.r))
      if (h.look !== 'mallet') continue
      let g = groups.get(keyOf(h))
      if (!g) groups.set(keyOf(h), (g = []))
      g.push(h)
    }
    // Landing spots, by the head they're tied to.
    const spots = new Map<Hazard, { x: number; y: number; z: number; s: number }>()
    for (const d of c.decos) {
      if (d.look !== 'mallet-shadow' || d.ref?.kind !== 'hazard') continue
      const h = c.hazards[d.ref.i]
      if (h) spots.set(h, { x: d.x, y: d.y, z: d.z, s: Math.max(1.2, Math.max(d.sx, d.sz) * 1.3) })
    }
    for (const hs of groups.values()) {
      const h = hs[0]!
      const pivot = new THREE.Vector3(h.x, h.y, h.z)
      const axis = new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw))
      const r = h.shape === 'sphere' ? h.r : Math.max(0.3, Math.min(h.hx, h.hy, h.hz))
      let R = r * 0.84
      let hh = r * 0.95
      if (hs.length > 1) {
        hazardBodies(hs[0]!, 0, B)
        hazardBodies(hs[1]!, 0, B2)
        const d = Math.hypot(B2[0]!.x - B[0]!.x, B2[0]!.y - B[0]!.y, B2[0]!.z - B[0]!.z)
        R = r * 0.86
        hh = d / 2 + r * 0.9
      }
      const body = roleHex(h.role, CODE.dodge)
      const head = this.part('ink', h.round, malletHead(R, hh, body, body === CODE.dodge ? '#f5c542' : '#ffffff'))
      const thick = handles.get(keyOf(h))
      const handle = this.part('ink', h.round, malletHandle(thick ? Math.max(0.11, thick * 0.72) : 0.085))
      // The post, from the floor (or the sea) up to the pivot, unless the round stands a pillar there; the hub on it.
      const own = c.decos.some((d) => (d.look === 'pillar' || d.look === 'post') && Math.abs(d.x - h.x) < 0.8 && Math.abs(d.z - h.z) < 0.8)
      const L = this.host.layer(h.z, 'ink')
      if (!own) {
        const under = this.host.surfaceBelow(h.x, h.z, h.y - 0.3, 0, null)
        const foot = under && h.y - under.y < 14 ? under.y : c.gooY
        mergeInto(L, malletPost(h.x, foot, h.z, h.y))
      }
      const hub = new THREE.CylinderGeometry(0.27, 0.27, 0.58, 16)
      hub.rotateX(Math.PI / 2)
      hub.rotateY(h.yaw)
      hub.translate(h.x, h.y, h.z)
      mergeInto(L, bake(hub, cc('#ffd23f'), [1, 1], 0.08))
      for (const side of [-1, 1]) {
        const cap = new THREE.SphereGeometry(0.15, 10, 8)
        cap.translate(h.x + axis.x * 0.31 * side, h.y, h.z + axis.z * 0.31 * side)
        mergeInto(L, bake(cap, cc('#ffffff')))
      }
      let z0 = Infinity
      let z1 = -Infinity
      for (const x of hs) {
        z0 = Math.min(z0, x.z0)
        z1 = Math.max(z1, x.z1)
      }
      this.mallets.push({ hs, pivot, axis, handle, head, R, hh, spot: spots.get(h) ?? null, was: 'rest', z0, z1 })
    }
  }

  /** How long a thing has been in its telegraph's `state` at t, s (looking back up to `most`). */
  private inState(tele: TeleFn, t: number, state: TeleState, most: number): number {
    let a = 0
    while (a < most && tele(t - a - 1 / 120).state === state) a += 1 / 120
    return a
  }

  private updateMallets(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    for (const m of this.mallets) {
      const h = m.hs[0]!
      if (!this.host.seen(m.z0, m.z1, cz)) {
        m.head.m.hide(m.head.i)
        m.handle.m.hide(m.handle.i)
        continue
      }
      hazardBodies(h, t, B)
      const b = B[0]!
      if (!b.on) {
        m.head.m.hide(m.head.i)
        m.handle.m.hide(m.handle.i)
        continue
      }
      const centre = V.set(b.x, b.y, b.z)
      if (m.hs.length > 1) {
        hazardBodies(m.hs[1]!, t, B2)
        centre.add(V2.set(B2[0]!.x, B2[0]!.y, B2[0]!.z)).multiplyScalar(0.5)
      }
      // Drawn exactly where its hit body is (the round's motion has the wind-up's creak back and shake in it).
      const d = V2.copy(centre).sub(m.pivot)
      const len = d.length()
      if (len < 1e-4) continue
      d.divideScalar(len)
      const tele = teleOf(h, t)
      // The head's axis lies across the handle in the swing's plane: X = d × n, Y = d, Z = n.
      const X = V3.crossVectors(d, m.axis).normalize()
      const e = M.elements
      M.makeBasis(X, d, m.axis)
      e[4]! *= len
      e[5]! *= len
      e[6]! *= len
      M.setPosition(m.pivot)
      m.handle.m.pose(m.handle.i, M)
      // The smash: squashed flat as it lands and springing back, with a puff of dust and stars.
      const age = tele.state === 'hold' && h.tele ? this.inState(h.tele, t, 'hold', 0.6) : 99
      const k = f.calm ? 0 : 0.22 * Math.exp(-age * 8) * Math.cos(age * 30)
      M.makeBasis(X, d, m.axis)
      const ax = 1 - k
      const rad = 1 + k * 0.55
      for (const j of [0, 1, 2]) e[j]! *= ax
      for (const j of [4, 5, 6, 8, 9, 10]) e[j]! *= rad
      M.setPosition(centre)
      m.head.m.pose(m.head.i, M)
      if (tele.state === 'hold' && m.was !== 'hold' && f.dt > 0 && f.fx && Math.abs(centre.z - f.bean.z) < 40) {
        const under = this.host.surfaceBelow(centre.x, centre.z, centre.y, t, f.world)
        const y = under ? under.y : centre.y - m.hh
        f.fx.dust(centre.x, y, centre.z, 14, '#ffffff', 2.8)
        f.fx.sparkle(centre.x, y + 0.5, centre.z, CODE.gold, 7, 3.2)
        f.fx.sparkle(centre.x, y + 0.4, centre.z, '#ffffff', 5, 2.4)
      }
      m.was = tele.state
      if (m.spot) {
        // Its landing spot: faint while it's up, darkening through the wind-up and the smash, dark while it lies there.
        const u = tele.u
        const a = tele.state === 'warn' ? 0.16 + 0.22 * u + (f.calm ? 0 : 0.06 * Math.sin(t * 30)) : tele.state === 'act' ? 0.4 + 0.25 * u : tele.state === 'hold' ? 0.62 : tele.state === 'back' ? 0.62 - 0.46 * u : 0.16
        this.blobSpots.push({ x: m.spot.x, y: m.spot.y + 0.025, z: m.spot.z, s: m.spot.s * (tele.state === 'warn' ? 0.9 + 0.1 * u : 1), a })
      } else {
        // Its shadow on the path, darker as the head comes down.
        const under = this.host.surfaceBelow(centre.x, centre.z, centre.y - 0.1, t, f.world)
        if (under) {
          const high = centre.y - under.y
          if (high < 8) this.blobSpots.push({ x: centre.x, y: under.y + 0.035, z: centre.z, s: (m.R + m.hh) * 1.5 + high * 0.22, a: 0.5 * (1 - high / 8) })
        }
      }
    }
  }

  /* ------------------------------------------------------------ plungers --- */

  /**
   * Pinball plungers: a silver spring from a housing on the pillar to a round cap in the role's colour (red to dodge,
   * orange with up chevrons to hop, violet with down chevrons to dive under) that punches out; an amber lamp over
   * the pillar blinks through the wind-up.
   */
  private buildPlungers() {
    const c = this.course
    for (const h of c.hazards) {
      if (!h.look.startsWith('plunger')) continue
      // Which way it punches: the way its motion takes it out.
      const ex = Math.cos(h.yaw)
      const ez = -Math.sin(h.yaw)
      const along = (x: number, z: number) => (x - h.x) * ex + (z - h.z) * ez
      let most = 0
      for (let t = 0; t < 10; t += 0.05) {
        hazardBodies(h, t, B)
        const o = along(B[0]!.x, B[0]!.z)
        if (Math.abs(o) > Math.abs(most)) most = o
      }
      const dir: 1 | -1 = most >= 0 ? 1 : -1
      const hx = h.shape === 'box' ? h.hx : h.r
      const R = Math.max(0.25, h.shape === 'box' ? Math.min(h.hy, h.hz) * 0.98 : h.r * 0.9)
      const T = Math.min(0.45, hx * 0.6)
      const role: Role = h.role === 'jump' || h.role === 'dive' || h.role === 'dodge' ? h.role : h.look === 'plunger-low' ? 'jump' : h.look === 'plunger-high' ? 'dive' : 'dodge'
      const cap = this.part('ink', h.round, plungerCap(R, T, role))
      const spring = this.part('ink', h.round, springGeometry(R * 0.62, 0.034 * Math.max(1, R / 0.5)))
      // The spring's mouth: the face of its pillar toward the track (a deco tied to it: the cap rests flush in it and
      // punches out of it, the spring stretching behind), or with no pillar a housing it shows 2.5 cap radii out of.
      const pillar = c.decos.find((d) => d.ref?.kind === 'hazard' && c.hazards[d.ref.i] === h)
      const show = Math.min(2.5 * R, Math.max(0.35, 2 * hx - T))
      const mouth = pillar ? along(pillar.x, pillar.z) + (dir * (pillar.sx || 1)) / 2 : dir * (hx - T) - dir * show
      const back = pillar ? mouth : mouth - dir * 0.6
      const L = this.host.layer(h.z, 'ink')
      const tube = Math.abs(mouth - back)
      if (tube > 0.05) {
        const mid = (mouth + back) / 2
        const housing = new THREE.CylinderGeometry(R * 0.78, R * 0.78, tube, 18)
        housing.rotateZ(Math.PI / 2)
        housing.rotateY(h.yaw)
        housing.translate(h.x + ex * mid, h.y, h.z + ez * mid)
        mergeInto(L, bake(housing, cc('#c9ccd8'), [1, 1], 0.08))
        const lip = new THREE.TorusGeometry(R * 0.8, 0.06, 6, 20)
        lip.rotateY(Math.PI / 2 + h.yaw)
        lip.translate(h.x + ex * mouth, h.y, h.z + ez * mouth)
        mergeInto(L, bake(lip, cc('#ffffff'), [1, 1], 0.1))
      }
      // Its lamp, on a stalk over the pillar.
      const foot = pillar ? pillar.y + (pillar.sy || 2.4) : h.y + R
      const top = foot + 0.42
      const lx = pillar ? pillar.x : h.x + ex * back
      const lz = pillar ? pillar.z : h.z + ez * back
      const stem = new THREE.CylinderGeometry(0.05, 0.05, top - 0.1 - foot, 6)
      stem.translate(lx, (top - 0.1 + foot) / 2, lz)
      mergeInto(L, bake(stem, cc('#8f86b8')))
      const lamp = this.host.lamp(lx, top, lz, 0.21)
      this.plungers.push({ h, dir, cap, spring, T, mouth, lamp })
    }
  }

  private updatePlungers(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    for (const p of this.plungers) {
      const h = p.h
      if (!this.host.seen(h.z0, h.z1, cz)) {
        p.cap.m.hide(p.cap.i)
        p.spring.m.hide(p.spring.i)
        continue
      }
      hazardBodies(h, t, B)
      const b = B[0]!
      if (!b.on) {
        p.cap.m.hide(p.cap.i)
        p.spring.m.hide(p.spring.i)
        continue
      }
      const hx = h.shape === 'box' ? h.hx : h.r
      const ex = Math.cos(h.yaw)
      const ez = -Math.sin(h.yaw)
      const out = (b.x - h.x) * ex + (b.z - h.z) * ez
      Q.setFromAxisAngle(UP, h.yaw + (p.dir < 0 ? Math.PI : 0))
      // The cap fills the box's front (a hair proud, so it never flickers against its pillar's face); the spring runs
      // from the mouth to the cap's back, folded away while the cap is home.
      const capAt = out + p.dir * (hx - p.T / 2 + 0.015)
      M.compose(V.set(h.x + ex * capAt, b.y, h.z + ez * capAt), Q, S.set(1, 1, 1))
      p.cap.m.pose(p.cap.i, M)
      const len = (out + p.dir * (hx - p.T) - p.mouth) * p.dir
      if (len < 0.06) p.spring.m.hide(p.spring.i)
      else {
        M.compose(V.set(h.x + ex * p.mouth, b.y, h.z + ez * p.mouth), Q, S.set(len, 1, 1))
        p.spring.m.pose(p.spring.i, M)
      }
      lampByTele(p.lamp, teleOf(h, t), t, f.calm)
    }
  }

  /* ---------------------------------------------------------------- keys --- */

  /**
   * Piano keys: glossy white keys and narrower, taller black ones, a thin dark gap round each top; amber blinking
   * before a key sinks, grey while it's down. Each plays its note when Blip lands on it (audio.ts), and a note pops
   * up off it.
   */
  private buildKeys() {
    const c = this.course
    this.notesOf = keyNotes(c)
    // A key laid as two boxes (a white key notched round its black keys: the same `params.key`) is one key: no gap
    // line where its boxes meet.
    const boxes = c.solids.filter((s) => (s.look === 'key-white' || s.look === 'key-black') && s.shape === 'box')
    const joined = (s: Solid, side: 'x-' | 'x+' | 'z-' | 'z+') => {
      const id = paramOf(s, 'key')
      if (id === undefined) return false
      return boxes.some((o) => {
        if (o === s || paramOf(o, 'key') !== id) return false
        const overlapZ = o.z - o.hz < s.z + s.hz - 0.01 && o.z + o.hz > s.z - s.hz + 0.01
        const overlapX = o.x - o.hx < s.x + s.hx - 0.01 && o.x + o.hx > s.x - s.hx + 0.01
        if (side === 'x+') return overlapZ && Math.abs(o.x - o.hx - (s.x + s.hx)) < 0.02
        if (side === 'x-') return overlapZ && Math.abs(o.x + o.hx - (s.x - s.hx)) < 0.02
        if (side === 'z+') return overlapX && Math.abs(o.z - o.hz - (s.z + s.hz)) < 0.02
        return overlapX && Math.abs(o.z + o.hz - (s.z - s.hz)) < 0.02
      })
    }
    c.solids.forEach((s, i) => {
      if (s.look !== 'key-white' && s.look !== 'key-black') return
      const black = s.look === 'key-black'
      const Lk = new Layer()
      const xf = xfOf(s.x, s.y, s.z, s.yaw, s.pitch, s.roll)
      const depth = Math.max(0.2, 2 * s.hy)
      const hx = s.shape === 'box' ? s.hx : s.r
      const hz = s.shape === 'box' ? s.hz : s.r
      const paintK: SlabPaint = black ? { top: cc('#2f3248'), band: cc('#3a3d57'), body: cc('#1f2133'), bandH: 0.12, foot: 0.7 } : { top: cc('#f7f5ff'), band: cc('#ffffff'), body: cc('#d8d3ec'), bandH: 0.1, foot: 0.78 }
      boxSlab(Lk, xf, hx, hz, depth, paintK)
      // The gap round its top (a thin dark line, so neighbours read as separate keys), and a gloss stripe.
      const gap = cc(black ? '#141522' : '#4a4466')
      const g = Math.min(0.07, Math.min(hx, hz) * 0.12)
      if (!joined(s, 'x-')) strip(Lk, xf, -hx, -hz, -hx, hz, g, gap, 0.012)
      if (!joined(s, 'x+')) strip(Lk, xf, hx, -hz, hx, hz, g, gap, 0.012)
      if (!joined(s, 'z-')) strip(Lk, xf, -hx, -hz, hx, -hz, g, gap, 0.012)
      if (!joined(s, 'z+')) strip(Lk, xf, -hx, hz, hx, hz, g, gap, 0.012)
      const long = hx >= hz
      const shine = cc(black ? '#6d7396' : '#ffffff')
      if (long) {
        // Across the key (the whole key's, when it's two boxes), a gloss stripe toward its far edge and a soft lilac
        // shade toward its near one, so the white reads as gloss rather than paper.
        let z0 = s.z - hz
        let z1 = s.z + hz
        const id = paramOf(s, 'key')
        if (id !== undefined)
          for (const o of boxes)
            if (paramOf(o, 'key') === id) {
              z0 = Math.min(z0, o.z - o.hz)
              z1 = Math.max(z1, o.z + o.hz)
            }
        const at = (f: number) => Math.max(-hz * 0.95, Math.min(hz * 0.95, (z0 + z1) / 2 + ((z1 - z0) / 2) * f - s.z))
        const w = (z1 - z0) / 2
        strip(Lk, xf, -hx * 0.9, at(0.62), hx * 0.9, at(0.62), Math.min(w * 0.22, Math.max(0.02, at(0.62) + hz * 0.95)), shine, 0.016)
        if (!black) strip(Lk, xf, -hx * 0.94, at(-0.55), hx * 0.94, at(-0.55), Math.min(w * 0.3, Math.max(0.02, hz * 0.95 - at(-0.55))), cc('#e7e2f8'), 0.014)
      } else {
        strip(Lk, xf, -hx * 0.62, -hz * 0.9, -hx * 0.62, hz * 0.9, hx * 0.22, shine, 0.016)
        if (!black) strip(Lk, xf, hx * 0.55, -hz * 0.94, hx * 0.55, hz * 0.94, hx * 0.3, cc('#e7e2f8'), 0.014)
      }
      this.keys.push({ i, s, part: this.part('ink', s.round, Lk.geometry()), black })
    })
  }

  private updateKeys(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    for (const k of this.keys) {
      const s = k.s
      if (!this.host.seen(s.z0, s.z1, cz)) {
        k.part.m.hide(k.part.i)
        continue
      }
      solidPose(this.course, f.world, k.i, t, P)
      if (!P.on) {
        k.part.m.hide(k.part.i)
        continue
      }
      poseDelta(M, s, P)
      k.part.m.pose(k.part.i, M)
      // Amber blinking quicker as it's about to sink (a black key lights up), grey-lilac while it's down.
      const tele = teleOf(s, t)
      const p = k.part
      const down = k.black ? '#57527a' : '#b0a6d8'
      const amber = k.black ? '#ffcf5a' : CODE.warn
      if (tele.state === 'warn') p.m.tint(p.i, amber, f.calm ? 0.45 + 0.3 * Math.sin(t * 9) : Math.sin(t * Math.PI * 2 * (2.5 + 4 * tele.u)) > 0 ? 0.95 : 0, k.black)
      // Sinking: a white key's amber fades; a black key goes straight to its grey (amber on black browns as it fades).
      else if (tele.state === 'act') p.m.tint(p.i, k.black ? down : amber, k.black ? 0.65 * tele.u : 0.7 * (1 - tele.u), k.black)
      else if (tele.state === 'hold') p.m.tint(p.i, down, 0.65, k.black)
      else if (tele.state === 'back') p.m.tint(p.i, down, 0.65 * (1 - tele.u), k.black)
      else p.m.tint(p.i, null, 0)
    }
  }

  /* --------------------------------------------------------------- lifts --- */

  /**
   * Candy lifts: caramel platforms with white candy stripes, an indigo ▲ and ▼ painted on top and a cream rim (gold on a
   * gold line), between two slim guide poles as tall as the lift's travel (read from its motion; riding across with
   * it when it slides as well), lamps on the poles chasing the way it's going. In its warning the arrow for the way
   * it's about to go blinks amber, and its poles' lamps; while it moves, that way's arrow is lit.
   */
  private buildLifts() {
    const c = this.course
    c.solids.forEach((s, i) => {
      if (s.look !== 'lift') return
      const xf = xfOf(s.x, s.y, s.z, s.yaw, s.pitch, s.roll)
      const depth = Math.max(0.2, 2 * s.hy)
      const hx = s.shape === 'box' ? s.hx : s.r
      const hz = s.shape === 'box' ? s.hz : s.r
      const L = new Layer()
      const paintL: SlabPaint = { top: cc('#ffffff'), band: cc('#ffffff'), body: cc('#ece4d2'), uvk: 1 / 1.3, sideUv: true, bandH: 0.14 }
      if (s.shape === 'box') boxSlab(L, xf, hx, hz, depth, paintL)
      else discSlab(L, xf, s.r, 28, depth, paintL)
      const slab = this.part('candy', s.round, L.geometry())
      // Its sign: ▲ (far) over ▼ (near), each its own part so either can light.
      const w = Math.min(hx, hz)
      const a = w * 0.26
      const arrow = (dir: number) => {
        const La = new Layer()
        const cz = dir * w * 0.42
        const pts: [number, number][] = [
          [0, cz + dir * a * 0.75],
          [-a, cz - dir * a * 0.55],
          [a, cz - dir * a * 0.55],
        ]
        flat(La, xf, pts, cc('#ffffff'), 0.018, 1.18)
        flat(La, xf, pts, cc(CODE.pushes), 0.022, 1)
        return this.part('ink', s.round, La.geometry())
      }
      const up = arrow(1)
      const down = arrow(-1)
      const Lr = new Layer()
      const rimC = cc(s.gold ? CODE.gold : '#fff3d6')
      const rw = s.gold ? 0.14 : 0.08
      if (s.shape === 'box') {
        strip(Lr, xf, -hx, -hz, -hx, hz, rw, rimC, 0.018)
        strip(Lr, xf, hx, -hz, hx, hz, rw, rimC, 0.018)
        strip(Lr, xf, -hx, -hz, hx, -hz, rw, rimC, 0.018)
        strip(Lr, xf, -hx, hz, hx, hz, rw, rimC, 0.018)
      } else {
        const ring = new THREE.TorusGeometry(s.r * 0.97, rw * 0.5, 6, 30)
        ring.rotateX(Math.PI / 2)
        ring.translate(s.x, s.y + 0.02, s.z)
        mergeInto(Lr, bake(ring, rimC, [1, 1], 0.1))
      }
      const rim = this.part('ink', s.round, Lr.geometry())
      // Its travel, from its motion: up and down (the poles stand from its lowest foot to over its highest top), and
      // across (a lift that slides as well takes its poles with it).
      let lo = Infinity
      let hi = -Infinity
      let across = 0
      for (let t = 0; t < 24; t += 1 / 30) {
        solidPose(c, null, i, t, P)
        lo = Math.min(lo, P.y)
        hi = Math.max(hi, P.y)
        across = Math.max(across, Math.hypot(P.x - s.x, P.z - s.z))
      }
      const slides = across > 0.05
      const lamps: Lamp[] = []
      const at: [number, number][] = []
      const Ls = slides ? new Layer() : this.host.layer(s.z, 'ink')
      const ox = hx + 0.22
      const foot = lo - depth
      const top = hi + 1.5
      // A wall already guides it where one stands beside it (the twin lifts' shaft): no pole there.
      const walled = (px: number, pz: number) =>
        c.solids.some((o) => o.noGround && o.shape === 'box' && Math.abs(px - o.x) <= o.hx + 0.35 && Math.abs(pz - o.z) <= o.hz + 0.35 && o.y + 0.5 > lo)
      for (const side of [-1, 1]) {
        const px = s.x + Math.cos(s.yaw) * side * ox
        const pz = s.z - Math.sin(s.yaw) * side * ox
        if (!slides && walled(px, pz)) continue
        const pole = new THREE.CylinderGeometry(0.07, 0.08, top - foot, 8)
        pole.translate(px, (top + foot) / 2, pz)
        mergeInto(Ls, bake(pole, cc('#f4efff')))
        const ball = new THREE.SphereGeometry(0.15, 10, 8)
        ball.translate(px, top + 0.08, pz)
        mergeInto(Ls, bake(ball, cc('#ffd23f'), [1, 1], 0.1))
        for (let j = 0; j < 3; j++) {
          lamps.push(this.host.lamp(px, lo + 0.3 + ((hi - lo + 0.9) * (j + 0.5)) / 3, pz, 0.13))
          at.push([px, pz])
        }
      }
      const poles = slides && !Ls.empty ? this.part('ink', s.round, Ls.geometry()) : null
      this.lifts.push({ i, s, slab, rim, up, down, poles, lamps, at, lo, hi })
    })
  }

  private updateLifts(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    for (const l of this.lifts) {
      const s = l.s
      const parts = [l.slab, l.rim, l.up, l.down]
      if (!this.host.seen(s.z0, s.z1, cz)) {
        for (const p of parts) p.m.hide(p.i)
        if (l.poles) l.poles.m.hide(l.poles.i)
        continue
      }
      solidPose(this.course, f.world, l.i, t, P)
      if (!P.on) {
        for (const p of parts) p.m.hide(p.i)
        continue
      }
      poseDelta(M, s, P)
      for (const p of parts) p.m.pose(p.i, M)
      // Poles that ride across with it: moved across, never up.
      if (l.poles) {
        M2.makeTranslation(P.x - s.x, 0, P.z - s.z)
        l.poles.m.pose(l.poles.i, M2)
        l.lamps.forEach((L, k) => {
          L.x = l.at[k]![0] + P.x - s.x
          L.z = l.at[k]![1] + P.z - s.z
        })
      }
      solidPose(this.course, f.world, l.i, t - 0.05, P2)
      const vy = (P.y - P2.y) / 0.05
      const tele = teleOf(s, t)
      // Which way it's going, or about to go: up from the bottom half of its travel, down from the top.
      const rising = Math.abs(vy) > 0.08 ? vy > 0 : P.y < (l.lo + l.hi) / 2
      const coming = rising ? l.up : l.down
      const other = rising ? l.down : l.up
      const blink = f.calm ? 0.55 + 0.35 * Math.sin(t * 9) : Math.sin(t * Math.PI * 2 * 5) > 0 ? 1 : 0
      if (tele.state === 'warn') {
        coming.m.tint(coming.i, CODE.warn, blink, true)
        l.slab.m.tint(l.slab.i, '#ffb05a', 0.3 * blink)
      } else if (Math.abs(vy) > 0.08) {
        coming.m.tint(coming.i, '#b9bfff', 0.75, true)
        l.slab.m.tint(l.slab.i, null, 0)
      } else {
        coming.m.tint(coming.i, null, 0)
        l.slab.m.tint(l.slab.i, null, 0)
      }
      other.m.tint(other.i, null, 0)
      const n = 3
      for (let k = 0; k < l.lamps.length; k++) {
        const L = l.lamps[k]!
        const j = k % n
        if (tele.state === 'warn') {
          L.colour.set(LAMP.warn)
          L.on = f.calm ? 0.7 : blink ? 1 : 0.2
        } else if (Math.abs(vy) > 0.08) {
          // Chasing the way it goes: up the poles as it rises, down as it sinks.
          L.colour.set('#fff0c4')
          L.on = f.calm ? 0.6 : 0.15 + 0.85 * Math.max(0, Math.cos((j / n) * Math.PI * 2 - t * 7 * Math.sign(vy)))
        } else {
          L.colour.set('#fff0c4')
          L.on = 0.25
        }
      }
    }
  }

  /** The lifts' candy stripes: caramel with white stripes (the vertex colours carry only the light). */
  private candyMaterial(): THREE.MeshBasicMaterial {
    const tex = this.host.painter.paint(
      128,
      128,
      (g, w, h) => {
        g.fillStyle = '#f0a43a'
        g.fillRect(0, 0, w, h)
        // Soft diagonal candy stripes, seamless when tiled.
        g.fillStyle = '#ffd38a'
        for (let k = -2; k < 3; k++) {
          const x = k * (w / 2)
          g.beginPath()
          g.moveTo(x, h)
          g.lineTo(x + w * 0.24, h)
          g.lineTo(x + w * 0.24 + w, 0)
          g.lineTo(x + w, 0)
          g.closePath()
          g.fill()
        }
        const grad = g.createLinearGradient(0, 0, w, h)
        grad.addColorStop(0, 'rgba(255,255,255,0.12)')
        grad.addColorStop(0.5, 'rgba(255,255,255,0)')
        grad.addColorStop(1, 'rgba(120,60,0,0.08)')
        g.fillStyle = grad
        g.fillRect(0, 0, w, h)
      },
      { repeat: true },
    )
    return this.host.tints.onWorld(new THREE.MeshBasicMaterial({ vertexColors: true, map: tex }))
  }

  /* -------------------------------------------------------------- tables --- */

  /**
   * The pinball table: a deep-violet glossy playfield, neon rails along its open edges, lamps in its lanes chasing up
   * it. A round may lay its table in strips (Pinball Table: a middle strip and side strips cut by drain holes, tilted
   * below and above a flat landing): they're one playfield, painted once for the whole table (lanes, chevrons up them,
   * the rims of the lamps, a green target at the top) and mapped across every strip by where it lies, so it runs on
   * seamless from strip to strip; the neon only where nothing carries on past an edge (the table's sides, round the
   * drain holes), the lamps only where a strip is under them and clear of the bumpers.
   */
  private buildTables() {
    const c = this.course
    const byRound = new Map<number, Solid[]>()
    for (const s of c.solids) {
      if (s.look !== 'table') continue
      let list = byRound.get(s.round)
      if (!list) byRound.set(s.round, (list = []))
      list.push(s)
    }
    const half = (s: Solid) => (s.shape === 'box' ? [s.hx, s.hz] : [s.r, s.r]) as [number, number]
    /** The strip of `list` that (x, z) lies on (a strip's yaw is taken as the round lays it: none), and its top there. */
    const onStrip = (list: Solid[], x: number, z: number, pad = 0): { s: Solid; y: number } | null => {
      for (const s of list) {
        const [hx, hz] = half(s)
        if (Math.abs(x - s.x) > hx + pad || Math.abs(z - s.z) > hz + pad) continue
        return { s, y: s.y + (x - s.x) * Math.tan(s.roll) + (z - s.z) * Math.tan(s.pitch) }
      }
      return null
    }
    for (const list of byRound.values()) {
      let X0 = Infinity
      let X1 = -Infinity
      let Z0 = Infinity
      let Z1 = -Infinity
      for (const s of list) {
        const [hx, hz] = half(s)
        X0 = Math.min(X0, s.x - hx)
        X1 = Math.max(X1, s.x + hx)
        Z0 = Math.min(Z0, s.z - hz)
        Z1 = Math.max(Z1, s.z + hz)
      }
      const W = X1 - X0
      const D = Z1 - Z0
      let lanes = 3
      for (const s of list) lanes = numParam(s, 'lanes') ?? lanes
      lanes = Math.max(1, Math.min(6, Math.round(lanes)))
      const rows = Math.max(3, Math.min(12, Math.round(D / 3.2)))
      const bumpers = c.hazards.filter((h) => h.look === 'bumper' && h.x > X0 - 1 && h.x < X1 + 1 && h.z > Z0 - 1 && h.z < Z1 + 1)
      // The lamps: lanes × rows, kept where a strip is under them and no bumper stands.
      const lamps: TableView['lamps'] = []
      const rims: [number, number][] = []
      for (let lane = 0; lane < lanes; lane++) {
        const x = X1 - ((lane + 0.5) * W) / lanes
        for (let row = 0; row < rows; row++) {
          const z = Z0 + D * (0.07 + ((row + 0.5) * 0.83) / rows)
          const on = onStrip(list, x, z)
          if (!on || bumpers.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + 0.55)) continue
          const lamp = this.host.lamp(x, on.y + 0.03, z, 0.15)
          lamp.keep = true
          lamps.push({ lamp, lane, row })
          rims.push([(X1 - x) / W, (z - Z0) / D])
        }
      }
      const tex = paintTable(this.host.painter, W, D, lanes, rims)
      const mat = this.host.tints.onWorld(new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }))
      // Every strip's top, one mesh, its uvs by where it lies on the whole table; the bodies (violet) in the chunks.
      const pos: number[] = []
      const uv: number[] = []
      const idx: number[] = []
      const G = this.host.layer(list[0]!.z, 'glow')
      for (const s of list) {
        const [hx, hz] = half(s)
        const xf = xfOf(s.x, s.y, s.z, s.yaw, s.pitch, s.roll)
        const body: SlabPaint = { top: cc('#33276a'), band: cc('#7a63c9'), body: cc('#3b2d70'), bandH: 0.16 }
        if (s.shape === 'box') boxSlab(this.host.layer(s.z, 'ink'), xf, hx, hz, Math.max(0.2, 2 * s.hy), body)
        else discSlab(this.host.layer(s.z, 'ink'), xf, s.r, 32, Math.max(0.2, 2 * s.hy), body)
        const base = pos.length / 3
        for (const [lx, lz] of [
          [-hx, -hz],
          [hx, -hz],
          [hx, hz],
          [-hx, hz],
        ] as const) {
          const wx = xf.x + xf.c * lx + xf.s * lz
          const wz = xf.z - xf.s * lx + xf.c * lz
          pos.push(wx, xf.y + xf.tr * lx + xf.tp * lz, wz)
          uv.push((X1 - wx) / W, (wz - Z0) / D)
        }
        idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
        // Neon along each edge nothing carries on past (a step out from its middle finds no strip).
        for (const [ax, az, bx, bz, ox, oz] of [
          [-hx, -hz, -hx, hz, -1, 0],
          [hx, -hz, hx, hz, 1, 0],
          [-hx, hz, hx, hz, 0, 1],
          [-hx, -hz, hx, -hz, 0, -1],
        ] as const) {
          const mx = s.x + ((ax + bx) / 2 + ox * 0.3)
          const mz = s.z + ((az + bz) / 2 + oz * 0.3)
          if (onStrip(list, mx, mz, -0.05)) continue
          strip(G, xf, ax, az, bx, bz, 0.15, cc(ox ? '#ff9be0' : '#9fe8ff'), 0.03)
        }
      }
      const top = new THREE.BufferGeometry()
      top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      top.setIndex(idx)
      top.computeBoundingSphere()
      const mesh = new THREE.Mesh(top, mat)
      mesh.matrixAutoUpdate = false
      this.host.group.add(mesh)
      this.tables.push({ mesh, z0: Z0 - 2, z1: Z1 + 2, lamps })
    }
  }

  private updateTables(f: Gen2Frame) {
    const cz = f.cam.z
    const LANE = ['#ff7ab6', '#ffd84d', '#6ff0d2', '#9fb7ff', '#ffa24c', '#c9a8ff']
    for (const tb of this.tables) {
      tb.mesh.visible = this.host.seen(tb.z0, tb.z1, cz)
      for (const { lamp, lane, row } of tb.lamps) {
        lamp.colour.set(LANE[lane % LANE.length]!)
        // A wave rolling up each lane: go up the table.
        lamp.on = f.calm ? 0.55 : 0.12 + 0.88 * Math.pow(Math.max(0, Math.cos(row * 0.95 - f.t * 6 + lane * 0.6)), 3)
      }
    }
  }

  /* ------------------------------------------------------------ flippers --- */

  /**
   * Flippers: an orange bar tapering from a yellow pivot cap, a white rubber band round its edge, lying on the table;
   * it snaps up the table while it fires (lit, or its telegraph's act) and settles back, and a lamp on the cap
   * blinks amber before it does.
   */
  private buildFlippers() {
    const c = this.course
    c.solids.forEach((s, i) => {
      if (s.look !== 'flipper') return
      const long = s.shape === 'box' ? Math.max(s.hx, s.hz) : s.r
      const short = s.shape === 'box' ? Math.min(s.hx, s.hz) : s.r * 0.4
      const alongX = s.shape !== 'box' || s.hx >= s.hz
      const len = numParam(s, 'len') ?? 2 * long
      // The pivot: the end on the side it says ('left' is screen left, +x), else the end nearer the table's edge.
      const ends: [number, number][] = alongX
        ? [
            [-long + short, 0],
            [long - short, 0],
          ]
        : [
            [0, -long + short],
            [0, long - short],
          ]
      const worldX = (e: [number, number]) => s.x + Math.cos(s.yaw) * e[0] + Math.sin(s.yaw) * e[1]
      const side = paramOf(s, 'side')
      const mid = this.centreAt(s.z)
      let pick: number
      if (side === 'left') pick = worldX(ends[0]!) > worldX(ends[1]!) ? 0 : 1
      else if (side === 'right') pick = worldX(ends[0]!) < worldX(ends[1]!) ? 0 : 1
      else pick = Math.abs(worldX(ends[0]!) - mid) > Math.abs(worldX(ends[1]!) - mid) ? 0 : 1
      const [px, pz] = ends[pick]!
      const [qx, qz] = ends[1 - pick]!
      const rest = Math.atan2(-(qz - pz), qx - px)
      const r1 = short * 0.98
      const r2 = r1 * 0.55
      const part = this.part('ink', s.round, flipperGeometry(Math.max(0.3, len - r1 - r2), r1, r2, !!s.gold))
      // Which way is up the table: the swing that moves its tip toward +z.
      const tip = (a: number) => {
        const lx = px + Math.cos(rest + a) * len
        const lz = pz - Math.sin(rest + a) * len
        return s.z - Math.sin(s.yaw) * lx + Math.cos(s.yaw) * lz
      }
      const sign = tip(0.6) > tip(-0.6) ? 1 : -1
      const wx = s.x + Math.cos(s.yaw) * px + Math.sin(s.yaw) * pz
      const wz = s.z - Math.sin(s.yaw) * px + Math.cos(s.yaw) * pz
      const wy = s.y + Math.tan(s.roll) * px + Math.tan(s.pitch) * pz + 0.2
      const lamp = this.host.lamp(wx, wy, wz, 0.16)
      this.flippers.push({ i, s, part, px, pz, rest, sign, lamp, act: phaseLengths(s.tele).act ?? 0.1, z0: s.z0 - len, z1: s.z1 + len })
    })
  }

  /** The track's middle at z (a round's or piece's centreline). */
  private centreAt(z: number): number {
    for (const r of this.course.rounds) if (z >= r.z0 && z < r.z1) return r.x
    for (const p of this.course.pieces) if (z >= p.z0 && z < p.z1) return p.x
    return 0
  }

  /** How far up a flipper is swung, 0 (rest) to 1 (fired), at t. */
  private swing(fl: FlipperView, t: number): number {
    const s = fl.s
    if (s.tele) {
      const tele = s.tele(t)
      if (tele.state === 'act') return Math.min(1, (tele.u * fl.act) / 0.06)
      if (tele.state === 'hold') return 1
      if (tele.state === 'back') return 1 - ease(tele.u)
      return 0
    }
    const lit = s.bounce?.lit
    if (!lit) return 0
    if (lit(t)) {
      let a = 0
      while (a < 0.06 && lit(t - a - 0.01)) a += 0.01
      return Math.min(1, (a + 0.01) / 0.06)
    }
    for (let a = 0.01; a <= 0.25; a += 0.01) if (lit(t - a)) return 1 - ease(a / 0.25)
    return 0
  }

  private updateFlippers(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    for (const fl of this.flippers) {
      if (!this.host.seen(fl.z0, fl.z1, cz)) {
        fl.part.m.hide(fl.part.i)
        continue
      }
      solidPose(this.course, f.world, fl.i, t, P)
      const up = this.swing(fl, t)
      // The solid's own frame (sheared up the table's tilt), then turned about the pivot in the table's plane.
      setPose(M, P)
      M2.makeRotationY(fl.rest + fl.sign * 0.8 * up)
      M2.setPosition(fl.px, 0, fl.pz)
      M.multiply(M2)
      fl.part.m.pose(fl.part.i, M)
      const tele = teleOf(fl.s, t)
      if (tele.state === 'warn') {
        fl.lamp.colour.set(LAMP.warn)
        fl.lamp.on = f.calm ? 0.8 : Math.sin(t * Math.PI * 2 * (4 + 6 * tele.u)) > 0 ? 1 : 0.2
      } else if (up > 0.05) {
        fl.lamp.colour.set(CODE.helps)
        fl.lamp.on = 1
      } else {
        fl.lamp.colour.set('#fff0c4')
        fl.lamp.on = 0.2
      }
    }
  }

  /* --------------------------------------------------------- trampolines --- */

  /**
   * Trampolines: a dotted teal mat on a white frame, springs all round it, a striped skirt down to its foot (its body,
   * so what can be bumped is seen) and legs on down to the floor or into the sea. The mat dips when Blip bounces and
   * springs back.
   */
  private buildTrampolines() {
    const c = this.course
    c.solids.forEach((s, i) => {
      if (s.look !== 'trampoline') return
      const round = s.shape === 'cyl'
      const hx = round ? s.r : s.hx
      const hz = round ? s.r : s.hz
      const depth = Math.max(0.3, 2 * s.hy)
      const mat = this.part('mats', s.round, trampolineMat(round, hx * 0.84, hz * 0.84))
      // The frame, springs and skirt: static, in the course's chunks (or riding with it, for one that moves: its legs
      // too, down into the sea, deep enough that they never come out of it as it bobs).
      const local = trampolineFrame(round, hx, hz, depth)
      let frame: Part | null = null
      if (s.move) {
        const legs: THREE.BufferGeometry[] = [local]
        const bottom = c.gooY - 3 - s.y
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + 0.5
          const leg = new THREE.CylinderGeometry(0.075, 0.09, -depth - bottom, 8)
          leg.translate(Math.cos(a) * hx * 0.8, (-depth + bottom) / 2, Math.sin(a) * hz * 0.8)
          legs.push(bake(leg, cc('#f6f3ff')))
        }
        frame = this.part('ink', s.round, merge(legs))
      } else {
        local.applyMatrix4(setPose(M, s))
        const L = this.host.layer(s.z, 'ink')
        mergeInto(L, local)
        // Legs on down to the floor under each, or into the sea.
        const feet: [number, number][] = round
          ? [0, 1, 2, 3, 4, 5].map((k) => [Math.cos((k / 6) * Math.PI * 2 + 0.5) * hx * 0.8, Math.sin((k / 6) * Math.PI * 2 + 0.5) * hz * 0.8])
          : [
              [-hx * 0.86, -hz * 0.86],
              [hx * 0.86, -hz * 0.86],
              [hx * 0.86, hz * 0.86],
              [-hx * 0.86, hz * 0.86],
            ]
        const top = s.y - depth
        for (const [lx, lz] of feet) {
          const wx = s.x + Math.cos(s.yaw) * lx + Math.sin(s.yaw) * lz
          const wz = s.z - Math.sin(s.yaw) * lx + Math.cos(s.yaw) * lz
          const under = this.host.surfaceBelow(wx, wz, top - 0.05, 0, null)
          const foot = under && top - under.y < 16 ? under.y : c.gooY - 0.5
          if (top - foot < 0.05) continue
          const leg = new THREE.CylinderGeometry(0.075, 0.09, top - foot, 8)
          leg.translate(wx, (top + foot) / 2, wz)
          mergeInto(L, bake(leg, cc('#f6f3ff')))
          const shoe = new THREE.CylinderGeometry(0.16, 0.18, 0.1, 10)
          shoe.translate(wx, foot + 0.05, wz)
          mergeInto(L, bake(shoe, cc('#c9c0ea')))
        }
      }
      const view: TrampolineView = { i, s, mat, frame, age: 9, deep: 0 }
      this.trampolines.push(view)
      this.trampolineOf.set(i, view)
    })
  }

  private updateTrampolines(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    for (const tr of this.trampolines) {
      tr.age += f.dt
      const s = tr.s
      if (!this.host.seen(s.z0, s.z1, cz)) {
        tr.mat.m.hide(tr.mat.i)
        if (tr.frame) tr.frame.m.hide(tr.frame.i)
        continue
      }
      solidPose(this.course, f.world, tr.i, t, P)
      // The dip: down at once as Blip goes off it, then a springy bulge or two (one plain dip with reduced motion).
      const a = tr.age
      let d = 0
      if (a < 0.1) d = tr.deep * Math.sin((a / 0.1) * (Math.PI / 2))
      else if (a < 1.3) d = f.calm ? tr.deep * Math.max(0, 1 - (a - 0.1) * 3.5) : tr.deep * Math.exp(-(a - 0.1) * 4.5) * Math.cos((a - 0.1) * 14)
      setPose(M, P)
      M2.makeScale(1, Math.max(-0.25, d), 1)
      M.multiply(M2)
      tr.mat.m.pose(tr.mat.i, M)
      if (tr.frame) tr.frame.m.pose(tr.frame.i, setPose(M, P))
    }
  }

  /* ------------------------------------------------------- bumper lamps --- */

  /** The pinball table's bumpers: a ring of lamps round each cap, chasing, flashing white when one bonks you. */
  private buildBumperRings() {
    const c = this.course
    const tables = c.solids.filter((s) => s.look === 'table')
    if (!tables.length) return
    const onTable = (x: number, z: number) =>
      tables.some((s) => {
        const dx = x - s.x
        const dz = z - s.z
        const lx = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw)
        const lz = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw)
        return s.shape === 'box' ? Math.abs(lx) <= s.hx + 0.5 && Math.abs(lz) <= s.hz + 0.5 : Math.hypot(lx, lz) <= s.r + 0.5
      })
    c.hazards.forEach((h, i) => {
      if (h.look !== 'bumper' || h.move || h.path || !onTable(h.x, h.z)) return
      const lamps: Lamp[] = []
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        const lamp = this.host.lamp(h.x + Math.cos(a) * h.r * 1.04, h.y + h.h * 0.55, h.z + Math.sin(a) * h.r * 1.04, 0.11)
        lamp.keep = true
        lamps.push(lamp)
      }
      const ring: BumperRing = { i, h, lamps, pulse: 0 }
      this.bumpers.push(ring)
      this.bumperOf.set(i, ring)
    })
  }

  private updateBumperRings(f: Gen2Frame) {
    for (const b of this.bumpers) {
      b.pulse = Math.max(0, b.pulse - f.dt * 3)
      for (let k = 0; k < b.lamps.length; k++) {
        const L = b.lamps[k]!
        if (b.pulse > 0) {
          L.colour.set('#ffffff')
          L.on = 0.4 + 0.6 * b.pulse
        } else {
          L.colour.set('#ffd84d')
          L.on = f.calm ? 0.5 : 0.18 + 0.82 * Math.pow(Math.max(0, Math.cos((k / 8) * Math.PI * 2 - f.t * 5)), 4)
        }
      }
    }
  }

  /* ------------------------------------------------------------- geysers --- */

  /**
   * Fizz geysers: each vent a little soda pool on its ledge (teal, a lumpy foam rim, the dark vent at its middle),
   * bubbling, and harder in the warning; the column a fizzing teal-white jet with a foam crown, from the vent up to
   * its height while it erupts, a low bubbling mound in the warning, spray and bubbles thrown off it.
   */
  private buildGeysers() {
    const c = this.course
    c.solids.forEach((s, i) => {
      if (s.look !== 'geyser-vent') return
      const xf = xfOf(s.x, s.y, s.z, s.yaw, s.pitch, s.roll)
      const fl = this.host.floorOf(s)
      const paintV: SlabPaint = { top: fl.top, band: fl.top, body: fl.body, uvk: 1 / 3 }
      const depth = Math.max(0.2, 2 * s.hy)
      if (s.shape === 'box') boxSlab(this.host.layer(s.z, 'floor'), xf, s.hx, s.hz, depth, paintV)
      else discSlab(this.host.layer(s.z, 'floor'), xf, s.r, 28, depth, paintV)
      const r = (s.shape === 'box' ? Math.min(s.hx, s.hz) : s.r) * 0.86
      // The pool (its soda scrolls), its foam rim, the vent.
      const pool = new THREE.CircleGeometry(r, 28)
      pool.rotateX(-Math.PI / 2)
      pool.translate(s.x, s.y + 0.025, s.z)
      const uv = pool.attributes.uv!
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * 2 * r) / 3.5, (uv.getY(k) * 2 * r) / 3.5)
      this.poolParts.push(bake(pool, cc('#ffffff')))
      const L = this.host.layer(s.z, 'ink')
      mergeInto(L, foamRing(s.x, s.y + 0.04, s.z, r, 0.13, this.host.rnd))
      const hole = new THREE.CircleGeometry(r * 0.34, 20)
      hole.rotateX(-Math.PI / 2)
      hole.translate(s.x, s.y + 0.035, s.z)
      mergeInto(L, bake(hole, cc('#0f5f5c')))
      const lip = new THREE.TorusGeometry(r * 0.36, 0.05, 6, 22)
      lip.rotateX(Math.PI / 2)
      lip.translate(s.x, s.y + 0.04, s.z)
      mergeInto(L, bake(lip, cc('#bff7ee'), [1, 1], 0.1))
      if (s.gold) {
        // A gold line's vent: a gold rim round its pool.
        const rim = new THREE.TorusGeometry(r * 1.06, 0.07, 6, 30)
        rim.rotateX(Math.PI / 2)
        rim.translate(s.x, s.y + 0.05, s.z)
        mergeInto(L, bake(rim, cc(CODE.gold), [1, 1], 0.15))
      }
      this.vents.push({ i, s, r, bubble: 0 })
    })
    if (this.poolParts.length) {
      const tex = this.host.painter.keep(this.host.tex.soda.clone())
      tex.needsUpdate = true
      this.poolMat = this.host.tints.onCode(new THREE.MeshBasicMaterial({ vertexColors: true, map: tex }))
      const mesh = new THREE.Mesh(merge(this.poolParts), this.poolMat)
      mesh.matrixAutoUpdate = false
      this.host.group.add(mesh)
      this.poolMesh = mesh
      this.poolParts.length = 0
    }
    // Columns: from a wind volume (its box) or a deco tied to its vent (params h, r). A volume over a vent rises from
    // the vent; one pushing across is a spray leaning over its gap from just under it; any other rises out of the sea
    // in its gap (a fizz column), as wide and deep as its lift.
    const ventNear = (x: number, z: number): VentView | undefined => {
      let best: VentView | undefined
      let bd = 1.2
      for (const v of this.vents) {
        const d = Math.hypot(v.s.x - x, v.s.z - z)
        if (d < bd) {
          bd = d
          best = v
        }
      }
      return best
    }
    for (const v of c.volumes) {
      if (v.kind !== 'wind' || v.look !== 'geyser') continue
      const vent = ventNear(v.x, v.z)
      const push = Math.hypot(v.carry.x, v.carry.z)
      const top = v.y + v.hy
      if (vent) {
        const r = Math.min(v.hx, v.hz, vent.r) * 0.8
        this.addColumn({ x: v.x, z: v.z, base: vent.s.y, tall: Math.max(1, top - vent.s.y), rx: r, rz: r, lx: 0, lz: 0, lean: 0, rise: null, vol: v, vent: vent.s, z0: v.z0, z1: v.z1 })
      } else if (push > 0.5) {
        const lx = v.carry.x / push
        const lz = v.carry.z / push
        const lean = Math.min(0.55, Math.atan2(push, 7))
        const base = v.y - v.hy
        // Its foot on the side it comes from, so it crosses the middle of its lift at half height.
        const back = Math.tan(lean) * v.hy
        this.addColumn({ x: v.x - lx * back, z: v.z - lz * back, base, tall: (top - base) / Math.cos(lean), rx: Math.min(1.0, v.hx * 0.4), rz: Math.min(1.6, v.hz * 0.7), lx, lz, lean, rise: null, vol: v, vent: null, z0: v.z0, z1: v.z1 })
      } else {
        const base = c.gooY
        this.addColumn({ x: v.x, z: v.z, base, tall: Math.max(1, top - base), rx: v.hx * 0.72, rz: v.hz * 0.72, lx: 0, lz: 0, lean: 0, rise: v.y - v.hy - base, vol: v, vent: null, z0: v.z0, z1: v.z1 })
      }
    }
    for (const d of c.decos) {
      if (d.look !== 'geyser') continue
      const ref = d.ref?.kind === 'solid' ? c.solids[d.ref.i] : undefined
      const vent = ref ?? ventNear(d.x, d.z)?.s ?? null
      const r = numParam(d, 'r') ?? (vent ? (vent.shape === 'box' ? Math.min(vent.hx, vent.hz) : vent.r) * 0.62 : Math.max(0.4, d.sx / 2))
      const tall = numParam(d, 'h') ?? Math.max(1.5, d.sy)
      this.addColumn({ x: vent ? vent.x : d.x, z: vent ? vent.z : d.z, base: vent ? vent.y : d.y, tall, rx: r, rz: r, lx: 0, lz: 0, lean: 0, rise: null, vol: null, vent, z0: d.z - 3, z1: d.z + 3 })
    }
  }

  private addColumn(o: Omit<ColumnView, 'mesh' | 'crown' | 'spray'>) {
    if (!this.columnMat) this.columnMat = this.host.tints.onCode(new THREE.MeshBasicMaterial({ map: paintFizzColumn(this.host.painter), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
    const mesh = new THREE.Mesh(columnGeometry(), this.columnMat)
    mesh.position.set(o.x, o.base, o.z)
    if (o.lean > 0) mesh.quaternion.setFromAxisAngle(V.set(o.lz, 0, -o.lx), o.lean)
    mesh.renderOrder = 3
    mesh.visible = false
    const crown = new THREE.Mesh(crownGeometry(this.host.rnd), this.host.mats.ink)
    crown.visible = false
    this.host.group.add(mesh, crown)
    this.columns.push({ ...o, mesh, crown, spray: 0 })
  }

  /** How far a geyser is erupting (0–1), and whether it's about to, at t. */
  private erupting(col: ColumnView, t: number): { e: number; warn: boolean; u: number; sputter: boolean } {
    const v = col.vol
    if (v) {
      const tele = v.tele ? v.tele(t) : null
      const e = v.duty(t)
      return { e, warn: tele ? tele.state === 'warn' : e <= 0.001 && v.duty(t + 0.6) > 0.001, u: tele?.u ?? 0.5, sputter: tele?.state === 'hold' }
    }
    const s = col.vent
    if (!s) return { e: 0, warn: false, u: 0, sputter: false }
    const tele = s.tele ? s.tele(t) : null
    const lit = s.bounce?.lit
    if (!lit) return { e: tele && (tele.state === 'act' || tele.state === 'hold') ? 1 : 0, warn: tele?.state === 'warn', u: tele?.u ?? 0.5, sputter: tele?.state === 'hold' }
    let e = 0
    if (lit(t)) {
      // Shooting up over 0.18 s from when it lit.
      let a = 0
      while (a < 0.18 && lit(t - a - 0.02)) a += 0.02
      e = ease(Math.min(1, (a + 0.02) / 0.18))
    } else {
      // Falling away over 0.3 s after it stops.
      for (let a = 0.02; a <= 0.3; a += 0.02)
        if (lit(t - a)) {
          e = 1 - ease(a / 0.3)
          break
        }
    }
    return { e, warn: tele ? tele.state === 'warn' : !lit(t) && e === 0 && lit(t + 0.6), u: tele?.u ?? 0.5, sputter: tele?.state === 'hold' }
  }

  private updateGeysers(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    const fx = f.fx
    const rnd = this.host.rnd
    if (this.poolMesh) {
      this.poolMesh.visible = this.vents.some((v) => this.host.seen(v.s.z - 2, v.s.z + 2, cz))
      const tex = this.poolMat?.map
      if (tex && !f.calm) tex.offset.set(Math.sin(this.clock * 0.3) * 0.05, this.clock * 0.08)
    }
    if (this.columnMat?.map) this.columnMat.map.offset.y = -((this.clock * (f.calm ? 0.6 : 1.8)) % 1)
    const warnAt = new Map<Solid, boolean>()
    for (const col of this.columns) {
      if (!this.host.seen(col.z0, col.z1, cz)) {
        col.mesh.visible = col.crown.visible = false
        continue
      }
      const { e, warn, u, sputter } = this.erupting(col, t)
      if (col.vent) warnAt.set(col.vent, warn)
      let h = 0
      let k = 1
      if (e > 0.001) {
        // Up (sputtering, about to stop: flickering lower).
        h = col.tall * (0.15 + 0.85 * e) * (sputter && !f.calm ? 0.9 + 0.1 * Math.sin(t * 38) : 1)
        k = 0.75 + 0.25 * e
      } else if (warn) {
        // About to go: a column out of the sea comes up its gap to just under where it lifts you; one on a vent
        // bubbles up a low mound with a foam cap.
        if (col.rise !== null) h = Math.max(0.5, col.rise - 0.5 + 0.45 * u + (f.calm ? 0 : 0.12 * Math.sin(t * 15)))
        else h = 0.62 + (f.calm ? 0 : 0.14 * Math.sin(t * 15))
        k = col.rise !== null ? 0.8 : 1.15
      }
      col.mesh.visible = h > 0.02
      col.crown.visible = h > 0.45
      if (!col.mesh.visible) continue
      const wob = f.calm ? 0 : sputter ? 0.1 : 0.05
      col.mesh.scale.set(col.rx * k * (1 + wob * Math.sin(t * 13 + col.x)), h, col.rz * k * (1 + wob * Math.cos(t * 11 + col.z)))
      // Its top (along its lean, for a spray).
      const tx = col.x + col.lx * Math.sin(col.lean) * h
      const ty = col.base + Math.cos(col.lean) * h
      const tz = col.z + col.lz * Math.sin(col.lean) * h
      const r = Math.min(col.rx, col.rz) * k
      // A column Blip has passed would stand its crown in the camera's way.
      if (col.z < f.bean.z - 1.5 && ty > f.bean.y + 0.5) col.crown.visible = false
      if (col.crown.visible) {
        col.crown.position.set(tx, ty, tz)
        const c = Math.min(Math.max(col.rx, col.rz), 1.3) * k * (0.75 + 0.25 * e) * (1 + (f.calm ? 0 : 0.07 * Math.sin(t * 17)))
        col.crown.scale.set(c * (col.rx > col.rz * 1.3 ? Math.min(1.6, col.rx / col.rz) : 1), c * 0.8, c * (col.rz > col.rx * 1.3 ? Math.min(1.6, col.rz / col.rx) : 1))
        col.crown.rotation.y = f.calm || col.rx !== col.rz ? 0 : t * 1.3
      }
      // Spray off the top and bubbles up the sides, near enough to see.
      if (fx && f.dt > 0 && e > 0.5 && col.z > f.cam.z && col.z < f.cam.z + 45) {
        col.spray += f.dt * 22
        const n = Math.floor(col.spray)
        if (n > 0) {
          col.spray -= n
          fx.spray(tx, ty, tz, n, '#e9fffb', 4.5, 1.8 * Math.max(r, 0.8))
          if (rnd() < 0.5) {
            const up = rnd() * h
            fx.seaBubble(col.x + col.lx * Math.sin(col.lean) * up + (rnd() - 0.5) * col.rx * 2, col.base + Math.cos(col.lean) * up, col.z + col.lz * Math.sin(col.lean) * up + (rnd() - 0.5) * col.rz * 2, '#dffbf6')
          }
        }
      }
    }
    // The pools: a bubble now and then, many more in the warning.
    if (fx && f.dt > 0) {
      for (const v of this.vents) {
        const s = v.s
        if (s.z < f.cam.z - 2 || s.z > f.cam.z + 40) continue
        const warn = warnAt.get(s) ?? (s.tele ? s.tele(t).state === 'warn' : false)
        v.bubble += f.dt * (warn ? 16 : 2.2)
        while (v.bubble >= 1) {
          v.bubble -= 1
          const a = rnd() * Math.PI * 2
          const rr = Math.sqrt(rnd()) * v.r * 0.9
          fx.seaBubble(s.x + Math.cos(a) * rr, s.y + 0.08, s.z + Math.sin(a) * rr, '#dffbf6')
        }
      }
    }
  }

  /* ----------------------------------------------------------- sprinkles --- */

  /**
   * Sprinkles: giant candy rods in bright colours, tumbling end over end as they fall straight down, lying flat once
   * down, shrinking away at the end of their life; under every one still falling, a red dashed ring on the deck,
   * growing and filling in as it comes.
   */
  private buildSprinkles() {
    const c = this.course
    const groups = new Map<string, { hs: Hazard[]; geo: THREE.BufferGeometry; r: number; len: number; hues: string[] }>()
    for (const h of c.hazards) {
      if (h.look !== 'sprinkle' || !h.path) continue
      const r = h.shape === 'bar' ? h.r : h.r * 0.42
      const len = h.shape === 'bar' ? h.len : h.r * 0.6
      const key = `${r.toFixed(3)}:${len.toFixed(3)}`
      let g = groups.get(key)
      if (!g) {
        const capsule = new THREE.CapsuleGeometry(r, 2 * len, 6, 14)
        capsule.rotateZ(Math.PI / 2)
        // A candy gloss: lighter along its top.
        const geo = bake(capsule, (_x, y) => (y > r * 0.55 ? cc('#ffffff') : cc('#e9e7f0')), [1, 1], 0.06)
        groups.set(key, (g = { hs: [], geo, r, len, hues: [] }))
      }
      g.hs.push(h)
      const hues = paramOf(h, 'hues')
      if (typeof hues === 'string' && !g.hues.length) g.hues = hues.split(/[,\s]+/).map((x) => HUE_NAMES[x.toLowerCase()] ?? (/^#[0-9a-f]{6}$/i.test(x) ? x : '')).filter((x) => !!x)
    }
    const see = this.host.tints.onCode(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false }))
    for (const g of groups.values()) {
      let most = 0
      for (const h of g.hs) most += Math.ceil(h.path!.life / h.path!.P) + 1
      const made = (mat: THREE.Material) => {
        const mesh = new THREE.InstancedMesh(g.geo, mat, Math.max(1, most))
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, most) * 3), 3)
        mesh.count = 0
        mesh.frustumCulled = false
        mesh.visible = false
        this.host.group.add(mesh)
        return mesh
      }
      this.sprinkles.push({ hs: g.hs, mesh: made(this.host.mats.ink), ghost: made(see), r: g.r, len: g.len, hues: g.hues.length ? g.hues : SPRINKLE_HUES })
    }
  }

  private updateSprinkles(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    const o = { x: 0, y: 0, z: 0, yaw: 0, on: true, hy: -1 }
    /** Its path's height (from the anchor) for release k, tau s after its release. */
    const yOf = (p: NonNullable<Hazard['path']>, tau: number, k: number) => {
      o.x = o.y = o.z = o.yaw = 0
      o.on = true
      p.at(tau, k, o)
      return o.y
    }
    const cam = f.cam
    const bean = f.bean
    /**
     * Whether a sprinkle at (x, y, z), reaching `reach` m each way, is between the camera and Blip: drawn see-through,
     * as course.ts fades anything over the track in the way (it lands behind Blip, so it can't hit it anyway).
     */
    const inWay = (x: number, y: number, z: number, reach: number) => {
      if (z + reach < cam.z - 1 || z - reach > bean.z - 0.35) return false
      const k = Math.max(0, Math.min(1, (z - cam.z) / Math.max(0.5, bean.z - cam.z)))
      if (Math.abs(x - (cam.x + (bean.x - cam.x) * k)) > reach + 1.2) return false
      if (z - reach < cam.z + 2.5) return true
      return y + reach > cam.y + (bean.y + 0.8 - cam.y) * k - 0.2
    }
    for (const g of this.sprinkles) {
      let n = 0
      let ng = 0
      for (const h of g.hs) {
        if (!this.host.seen(h.z0, h.z1, cz)) continue
        const p = h.path!
        const count = hazardBodies(h, t, B)
        for (let k = 0; k < count; k++) {
          const b = B[k]!
          if (!b.on) continue
          // How fast it's falling, from its own path a moment before (or after, just released): a round may hand a
          // sprinkle from one hazard (falling) to another (hopping and lying) at the deck, so it's read from the motion.
          const back = b.tau >= 0.02
          const y2 = h.y + yOf(p, back ? b.tau - 0.02 : b.tau + 0.02, b.k)
          const vy = back ? (b.y - y2) / 0.02 : (y2 - b.y) / 0.02
          const under = this.host.surfaceBelow(b.x, b.z, b.y + 0.05, t, f.world)
          const deck = under ? under.y : b.y - g.r
          const high = Math.max(0, b.y - deck - g.r)
          const born = h.y + yOf(p, 0, b.k) - deck - g.r
          const coming = vy < -0.5
          // End over end while it falls, running out as it reaches the deck; flat once it's down.
          const tumble = coming ? high * 0.8 : 0
          // Grown in when it appears high up; shrunk away at the end of a life that ends lying (not one that ends still
          // falling: the deck's body carries on from there).
          const grow = born > 2 ? ease(clamp01(b.tau / 0.12)) : 1
          const shrink = vy > -1.5 ? ease(clamp01((p.life - b.tau) / 0.35)) : 1
          const s = Math.min(grow, shrink)
          Q.setFromEuler(E.set(0, b.yaw, tumble, 'YXZ'))
          M.compose(V.set(b.x, b.y, b.z), Q, S.setScalar(Math.max(0.001, s)))
          const hue = cc(g.hues[(((b.k * 7 + Math.round(h.x * 3 + h.z)) % g.hues.length) + g.hues.length) % g.hues.length]!)
          if (inWay(b.x, b.y, b.z, g.len + g.r)) {
            if (ng < g.ghost.instanceMatrix.count) {
              g.ghost.setMatrixAt(ng, M)
              g.ghost.setColorAt(ng, hue)
              ng++
            }
          } else if (n < g.mesh.instanceMatrix.count) {
            g.mesh.setMatrixAt(n, M)
            g.mesh.setColorAt(n, hue)
            n++
          }
          // Its ring on the deck while it's still coming: growing and filling in as it nears.
          if (coming && high > 0.6 && under) {
            const near = clamp01(1 - high / Math.max(1, born))
            const R = (g.len + g.r) * 1.18 + 0.25
            const blink = !f.calm && near > 0.85 ? 0.75 + 0.25 * Math.sin(t * 40) : 1
            this.ringSpots.push({ x: b.x, y: deck + 0.03, z: b.z, s: 2 * R * (0.62 + 0.38 * near), a: (0.62 + 0.38 * near) * blink })
            this.fillSpots.push({ x: b.x, y: deck + 0.025, z: b.z, s: 2 * R * (0.25 + 0.75 * near), a: 0.16 + 0.42 * near * near })
          }
          // Its shadow, sharper as it nears (and under it while it lies there).
          if (under && high < 14) this.blobSpots.push({ x: b.x, y: deck + 0.035, z: b.z, s: (g.len + g.r) * 2.2 * (1 + high * 0.05), a: 0.42 * (1 - high / 14) * s })
        }
      }
      g.mesh.count = n
      g.mesh.visible = n > 0
      g.mesh.instanceMatrix.needsUpdate = true
      if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true
      g.ghost.count = ng
      g.ghost.visible = ng > 0
      g.ghost.instanceMatrix.needsUpdate = true
      if (g.ghost.instanceColor) g.ghost.instanceColor.needsUpdate = true
    }
  }

  /* ------------------------------------------------------------ pinballs --- */

  /** Steel balls: chrome, rolling as they go (body.yaw), each with a soft shadow on the table under it. */
  private buildPinballs() {
    const c = this.course
    const list = c.hazards.filter((h) => h.look === 'pinball')
    if (!list.length) return
    let most = 0
    for (const h of list) most += h.path ? Math.ceil(h.path.life / h.path.P) + 1 : 1
    const ball = paint(new THREE.SphereGeometry(1, 24, 18), '#ffffff')
    // A faint band round it, so the roll shows on the chrome.
    const col = ball.attributes.color!
    const pos = ball.attributes.position!
    for (let k = 0; k < pos.count; k++) {
      const band = Math.abs(pos.getY(k)) < 0.12 ? 0.72 : 1
      col.setXYZ(k, band, band, band)
    }
    const mat = this.host.tints.onCode(new THREE.MeshMatcapMaterial({ matcap: paintChrome(this.host.painter), vertexColors: true }))
    const mesh = new THREE.InstancedMesh(ball, mat, Math.max(1, most))
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.visible = false
    this.host.group.add(mesh)
    const g: PinballGroup = { members: [], mesh }
    for (const h of list) {
      // Which way it rolls: across the way it goes.
      let axis = new THREE.Vector3(1, 0, 0)
      if (h.path) {
        const a = { x: 0, y: 0, z: 0, yaw: 0, on: true, hy: -1 }
        const b = { x: 0, y: 0, z: 0, yaw: 0, on: true, hy: -1 }
        h.path.at(0, 0, a)
        h.path.at(Math.min(0.4, h.path.life), 0, b)
        const dx = b.x - a.x
        const dz = b.z - a.z
        const l = Math.hypot(dx, dz)
        if (l > 1e-4) axis = new THREE.Vector3(dz / l, 0, -dx / l)
      }
      g.members.push({ h, axis })
    }
    this.pinballs.push(g)
  }

  private updatePinballs(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    for (const g of this.pinballs) {
      let n = 0
      for (const { h, axis } of g.members) {
        if (!this.host.seen(h.z0, h.z1, cz)) continue
        const count = hazardBodies(h, t, B)
        for (let k = 0; k < count; k++) {
          const b = B[k]!
          if (!b.on) continue
          // It rolls as far as it's come from where it was released (a round may give it no rolling angle: its yaw
          // turns a path body's push).
          let roll = b.yaw - h.yaw
          if (h.path) {
            const o = { x: 0, y: 0, z: 0, yaw: 0, on: true, hy: -1 }
            h.path.at(0, b.k, o)
            roll += Math.hypot(b.x - h.x - o.x, b.y - h.y - o.y, b.z - h.z - o.z) / Math.max(0.1, h.r)
          }
          Q.setFromAxisAngle(axis, roll)
          M.compose(V.set(b.x, b.y, b.z), Q, S.setScalar(h.r))
          if (n < g.mesh.instanceMatrix.count) g.mesh.setMatrixAt(n++, M)
          const under = this.host.surfaceBelow(b.x, b.z, b.y, t, f.world)
          if (under && b.y - under.y < 6) this.blobSpots.push({ x: b.x, y: under.y + 0.035, z: b.z, s: h.r * 2.6, a: 0.5 * clamp01(1 - (b.y - under.y - h.r) / 6) })
        }
      }
      g.mesh.count = n
      g.mesh.visible = n > 0
      g.mesh.instanceMatrix.needsUpdate = true
    }
  }

  /* ----------------------------------------------------- drains and tiles --- */

  /**
   * A pinball table's drains (`drain` decos): a hole cut in the table (its open edges already lit) or, with
   * `params.saucer`, a covered saucer a ball sinks into: a dark dish with a chrome ring, lying on the table's slope.
   */
  private buildDrains() {
    const c = this.course
    for (const d of c.decos) {
      if (d.look !== 'drain' || !paramOf(d, 'saucer')) continue
      const w = numParam(d, 'w') ?? 1.9
      // The table's slope under it.
      let pitch = 0
      let roll = 0
      for (const s of c.solids) {
        if (s.look !== 'table' || Math.abs(d.x - s.x) > s.hx || Math.abs(d.z - s.z) > s.hz) continue
        pitch = s.pitch
        roll = s.roll
        break
      }
      const L = this.host.layer(d.z, 'ink')
      const xf = xfOf(d.x, d.y, d.z, 0, pitch, roll)
      const dish = new Layer()
      discSlab(dish, xf, w / 2, 26, 0.05, { top: cc('#120c2c'), band: cc('#2a2150'), body: cc('#2a2150'), bandH: 0.03, noBottom: true })
      mergeInto(L, dish.geometry())
      const ring = new THREE.TorusGeometry(w / 2, 0.07, 6, 30)
      ring.rotateX(Math.PI / 2)
      ring.applyMatrix4(setPose(M, { x: d.x, y: d.y + 0.05, z: d.z, yaw: 0, pitch, roll }))
      mergeInto(L, bake(ring, cc('#dfe3ee'), [1, 1], 0.12))
    }
  }

  /**
   * Cracking deck tiles (`deck-tile`: Sprinkle Drop's T3 row): a piece of the deck that goes amber then red as it
   * cracks (its telegraph's warn), shaking, falls away (hold) and rises back (back), red fading as it comes.
   */
  private buildTiles() {
    const c = this.course
    c.solids.forEach((s, i) => {
      if (s.look !== 'deck-tile') return
      const L = new Layer()
      const f = this.host.floorOf(s)
      const paintT: SlabPaint = { top: f.top, band: f.top, body: f.body, uvk: 1 / 3 }
      const xf = xfOf(s.x, s.y, s.z, s.yaw, s.pitch, s.roll)
      if (s.shape === 'box') boxSlab(L, xf, s.hx - 0.03, s.hz - 0.03, Math.max(0.2, 2 * s.hy), paintT)
      else discSlab(L, xf, s.r - 0.03, s.sides ?? 22, Math.max(0.2, 2 * s.hy), paintT)
      this.tiles.push({ i, s, part: this.part('floor', s.round, L.geometry()) })
    })
  }

  private updateTiles(f: Gen2Frame) {
    const t = f.t
    const cz = f.cam.z
    for (const tl of this.tiles) {
      const s = tl.s
      if (!this.host.seen(s.z0, s.z1, cz)) {
        tl.part.m.hide(tl.part.i)
        continue
      }
      solidPose(this.course, f.world, tl.i, t, P)
      const tele = teleOf(s, t)
      const shake = tele.state === 'warn' && !f.calm ? Math.sin(t * 47 + s.x) * 0.05 * tele.u : 0
      P.x += shake
      P.z += shake * 0.6
      poseDelta(M, s, P)
      tl.part.m.pose(tl.part.i, M)
      if (tele.state === 'warn') tl.part.m.tint(tl.part.i, tele.u < 0.5 ? CODE.warn : CODE.dodge, 0.45 + 0.4 * tele.u)
      else if (tele.state === 'hold') tl.part.m.tint(tl.part.i, CODE.dodge, 0.85)
      else if (tele.state === 'back') tl.part.m.tint(tl.part.i, CODE.dodge, 0.85 * (1 - tele.u))
      else tl.part.m.tint(tl.part.i, null, 0)
    }
  }

  /* --------------------------------------------- rings, shadows, note pops --- */

  private buildSpots() {
    let ringMost = 0
    for (const g of this.sprinkles) for (const h of g.hs) ringMost += Math.ceil(h.path!.life / h.path!.P) + 1
    if (ringMost) {
      const ring = quads(ringMost, new THREE.MeshBasicMaterial({ map: paintDashedRing(this.host.painter), color: CODE.dodge, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), 'up')
      const fill = quads(ringMost, new THREE.MeshBasicMaterial({ map: this.host.tex.dot, color: CODE.dodge, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }), 'up')
      ring.mesh.renderOrder = 2
      fill.mesh.renderOrder = 1
      this.host.group.add(fill.mesh, ring.mesh)
      this.rings = { ring, fill }
    }
    let blobMost = this.mallets.length + ringMost
    for (const g of this.pinballs) for (const { h } of g.members) blobMost += h.path ? Math.ceil(h.path.life / h.path.P) + 1 : 1
    if (blobMost) {
      this.blobs = quads(blobMost, new THREE.MeshBasicMaterial({ map: this.host.tex.dot, color: '#1a1030', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), 'up')
      this.blobs.mesh.renderOrder = 1
      this.host.group.add(this.blobs.mesh)
    }
    if (this.keys.length) {
      this.notes = quads(10, new THREE.MeshBasicMaterial({ map: paintNote(this.host.painter), color: '#ffd23f', transparent: true, depthWrite: false }), 'camera')
      this.notes.mesh.renderOrder = 5
      this.host.group.add(this.notes.mesh)
    }
  }

  private writeSpots(target: Quads | null, spots: Spot[]) {
    if (target) {
      const { mesh, alpha } = target
      const n = Math.min(spots.length, mesh.instanceMatrix.count)
      for (let k = 0; k < n; k++) {
        const s = spots[k]!
        M.makeScale(s.s, 1, s.s)
        M.setPosition(s.x, s.y, s.z)
        mesh.setMatrixAt(k, M)
        alpha.setX(k, s.a)
      }
      mesh.count = n
      mesh.visible = n > 0
      mesh.instanceMatrix.needsUpdate = true
      alpha.needsUpdate = true
    }
    spots.length = 0
  }

  private updateNotes(f: Gen2Frame) {
    if (!this.notes) return
    const { mesh, alpha } = this.notes
    let n = 0
    for (let k = this.pops.length - 1; k >= 0; k--) {
      const p = this.pops[k]!
      p.age += f.dt
      if (p.age >= 1) {
        this.pops.splice(k, 1)
        continue
      }
      if (n >= mesh.instanceMatrix.count) continue
      const u = p.age
      const s = 0.55 * (u < 0.12 ? ease(u / 0.12) : 1)
      M.makeScale(s, s * 1.15, s)
      M.setPosition(p.x + (f.calm ? 0 : Math.sin(u * 7) * 0.12 * p.side), p.y + 1.6 + u * 1.3, p.z)
      mesh.setMatrixAt(n, M)
      alpha.setX(n, u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4)
      n++
    }
    mesh.count = n
    mesh.visible = n > 0
    mesh.instanceMatrix.needsUpdate = true
    alpha.needsUpdate = true
  }

  /* -------------------------------------------------------------- moments --- */

  /** Blip landed on solid i: a key sends up its note. */
  landed(i: number, x: number, y: number, z: number) {
    if (!this.notes || !this.notesOf.has(i)) return
    if (this.pops.length >= 8) this.pops.shift()
    this.pops.push({ x, y, z, age: 0, side: this.host.rnd() < 0.5 ? -1 : 1 })
  }

  /** Something threw Blip from solid i: a trampoline's mat dips (deeper for a perfect bounce). Whether it's drawn here. */
  pulseSolid(i: number, strength = 1): boolean {
    const tr = this.trampolineOf.get(i)
    if (tr) {
      tr.age = 0
      tr.deep = 0.32 * strength
    }
    return this.claimed.solid.has(i)
  }

  /** A hazard bonked Blip: a table bumper's lamps flash. */
  pulseHazard(i: number) {
    const b = this.bumperOf.get(i)
    if (b) b.pulse = 1
  }

  /* ---------------------------------------------------------------- frame --- */

  update(f: Gen2Frame) {
    if (f.dt > 0) this.clock += f.dt
    this.updateMallets(f)
    this.updatePlungers(f)
    this.updateKeys(f)
    this.updateLifts(f)
    this.updateTables(f)
    this.updateFlippers(f)
    this.updateTrampolines(f)
    this.updateBumperRings(f)
    this.updateGeysers(f)
    this.updateSprinkles(f)
    this.updatePinballs(f)
    this.updateTiles(f)
    this.updateNotes(f)
    this.writeSpots(this.rings?.ring ?? null, this.ringSpots)
    this.writeSpots(this.rings?.fill ?? null, this.fillSpots)
    this.writeSpots(this.blobs, this.blobSpots)
    for (const { m } of this.morphs.values()) m.flush()
  }
}

/* --------------------------------------------------------------- helpers --- */

/** A thing's lamp: amber blinking quicker through its warning, red as it goes, dim otherwise. */
function lampByTele(L: Lamp, tele: Tele, t: number, calm: boolean) {
  if (tele.state === 'warn') {
    L.colour.set(LAMP.warn)
    L.on = calm ? 0.55 + 0.45 * tele.u : Math.sin(t * Math.PI * 2 * (3 + tele.u * 6)) > 0 ? 1 : 0.2
  } else if (tele.state === 'act') {
    L.colour.set(LAMP.shut)
    L.on = 1
  } else {
    L.colour.set('#8f86b8')
    L.on = 0.05
  }
}

/** A pose as the engine has it (turned by yaw, sheared by pitch and roll), as a matrix. */
function setPose(m: THREE.Matrix4, p: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number }): THREE.Matrix4 {
  const c = Math.cos(p.yaw)
  const s = Math.sin(p.yaw)
  m.set(c, 0, s, p.x, Math.tan(p.roll), 1, Math.tan(p.pitch), p.y, -s, 0, c, p.z, 0, 0, 0, 1)
  return m
}

/** The move from a solid's laid pose to its pose now, for a part built where it was laid. */
function poseDelta(m: THREE.Matrix4, s: Solid, p: { x: number; y: number; z: number; yaw: number }) {
  const dy = p.yaw - s.yaw
  if (Math.abs(dy) < 1e-9) {
    m.makeTranslation(p.x - s.x, p.y - s.y, p.z - s.z)
    return
  }
  // Turned about where it was laid, then moved.
  m.makeTranslation(-s.x, -s.y, -s.z)
  M2.makeRotationY(dy)
  m.premultiply(M2)
  M2.makeTranslation(p.x, p.y, p.z)
  m.premultiply(M2)
}

/** A flat filled shape painted on a top (points in its local frame, a fan from the first), `lift` up, grown by `grow` from its middle. */
function flat(L: Layer, xf: { x: number; y: number; z: number; c: number; s: number; tr: number; tp: number }, pts: [number, number][], c: THREE.Color, lift: number, grow = 1) {
  let mx = 0
  let mz = 0
  for (const [x, z] of pts) {
    mx += x / pts.length
    mz += z / pts.length
  }
  const ids = pts.map(([px, pz]) => {
    const lx = mx + (px - mx) * grow
    const lz = mz + (pz - mz) * grow
    return L.vert(xf.x + xf.c * lx + xf.s * lz, xf.y + xf.tr * lx + lift + xf.tp * lz, xf.z - xf.s * lx + xf.c * lz, c, 1, 0.27, 0.06)
  })
  for (let k = 1; k < ids.length - 1; k++) L.tri(ids[0]!, ids[k]!, ids[k + 1]!, 0, 1, 0)
}

/** A baked shape's triangles into a layer (the course's merged dressing). */
function mergeInto(L: Layer, g: THREE.BufferGeometry) {
  const pos = g.attributes.position!
  const col = g.attributes.color
  const uv = g.attributes.uv
  const base = L.pos.length / 3
  for (let k = 0; k < pos.count; k++) {
    if (col) C.setRGB(col.getX(k), col.getY(k), col.getZ(k))
    else C.setRGB(1, 1, 1)
    L.vert(pos.getX(k), pos.getY(k), pos.getZ(k), C, 1, uv ? uv.getX(k) : 0.27, uv ? uv.getY(k) : 0.06)
  }
  const idx = g.index
  if (idx) for (let k = 0; k < idx.count; k++) L.idx.push(idx.getX(k) + base)
  else for (let k = 0; k < pos.count; k++) L.idx.push(base + k)
  g.dispose()
}

/**
 * A mallet's head: a barrel of radius R, 2·hh long, along local x, its ends rounded, two bands standing a hair proud
 * round it. Turned from a lathe (round y), lit as it lies on the floor at the smash.
 */
function malletHead(R: number, hh: number, body: string, band: string): THREE.BufferGeometry {
  const bev = Math.min(R * 0.28, hh * 0.3)
  const at = hh * 0.5
  const bw = hh * 0.12
  const proud = R * 1.04
  const prof: THREE.Vector2[] = [new THREE.Vector2(0, -hh)]
  for (let k = 0; k <= 4; k++) {
    const a = (k / 4) * (Math.PI / 2)
    prof.push(new THREE.Vector2(R - bev + Math.sin(a) * bev, -hh + bev - Math.cos(a) * bev))
  }
  for (const y0 of [-at - bw, at - bw]) {
    prof.push(new THREE.Vector2(R, y0), new THREE.Vector2(proud, y0), new THREE.Vector2(proud, y0 + 2 * bw), new THREE.Vector2(R, y0 + 2 * bw))
  }
  for (let k = 0; k <= 4; k++) {
    const a = (k / 4) * (Math.PI / 2)
    prof.push(new THREE.Vector2(R - bev + Math.cos(a) * bev, hh - bev + Math.sin(a) * bev))
  }
  prof.push(new THREE.Vector2(0, hh))
  const lathe = new THREE.LatheGeometry(prof, 28)
  const bandC = cc(band)
  const bodyC = cc(body)
  const faceC = cc(mix(body, '#ffffff', 0.14))
  const g = bake(
    lathe,
    (x, y, z) => {
      const rr = Math.hypot(x, z)
      if (rr > R * 1.01) return bandC
      if (Math.abs(y) > hh - bev * 0.5 && rr < R - bev * 0.6) return faceC
      return bodyC
    },
    [1, 1],
    0.04,
  )
  g.rotateZ(-Math.PI / 2)
  return g
}

/** A mallet's handle: wood `r` thick from its pivot (0) to its head (1), along local y, with a darker grip by the pivot. */
function malletHandle(r: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r * 0.85, 1, 12, 4)
  g.translate(0, 0.5, 0)
  return bake(g, (_x, y) => cc(y < 0.26 ? '#8b5a2f' : '#c9935a'), [1, 1], 0.06)
}

/** A candy post from the floor to the pivot: lilac and white stripes winding up it, on a foot plate. */
function malletPost(x: number, foot: number, z: number, top: number): THREE.BufferGeometry {
  const h = Math.max(0.2, top - foot)
  const g = new THREE.CylinderGeometry(0.2, 0.24, h, 16, Math.max(2, Math.round(h * 5)))
  const white = cc('#ffffff')
  const lilac = cc('#cbbcf2')
  const post = bake(g, (px, py, pz) => {
    const a = Math.atan2(pz, px) / (Math.PI * 2) + 0.5
    return (a + (py + h / 2) * 0.55) % 0.5 < 0.25 ? white : lilac
  })
  post.translate(x, foot + h / 2, z)
  const plate = new THREE.CylinderGeometry(0.42, 0.48, 0.14, 18)
  plate.translate(x, foot + 0.07, z)
  return merge([post, bake(plate, cc('#e2dbf7'))])
}

/** A helix along local x from 0 to 1: a spring's coil. */
class Helix extends THREE.Curve<THREE.Vector3> {
  private readonly turns: number
  private readonly r: number
  constructor(turns: number, r: number) {
    super()
    this.turns = turns
    this.r = r
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = t * this.turns * Math.PI * 2
    return target.set(t, Math.cos(a) * this.r, Math.sin(a) * this.r)
  }
}

/** A plunger's spring: a silver coil of radius r, wire w, along local x from 0 to 1 (stretched to its length). */
function springGeometry(r: number, w: number): THREE.BufferGeometry {
  const turns = 9
  const coil = new THREE.TubeGeometry(new Helix(turns, r), turns * 12, w, 5, false)
  const rod = new THREE.CylinderGeometry(r * 0.22, r * 0.22, 1, 8)
  rod.rotateZ(Math.PI / 2)
  rod.translate(0.5, 0, 0)
  return merge([bake(coil, cc('#e3e6ef'), [1, 1], 0.12), bake(rod, cc('#a9adbd'))])
}

/**
 * A plunger's cap: a disc of radius R, T thick, facing local +x, in the role's colour with its mark on the face (a
 * white ring for red, up chevrons for orange, down chevrons for violet) and a white rim.
 */
function plungerCap(R: number, T: number, role: Role): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.CylinderGeometry(R, R, T, 28)
  body.rotateZ(-Math.PI / 2)
  parts.push(bake(body, cc(roleHex(role, CODE.dodge)), [1, 1], 0.05))
  const rim = new THREE.TorusGeometry(R * 0.98, Math.min(0.07, T * 0.18), 6, 28)
  rim.rotateY(Math.PI / 2)
  rim.translate(T / 2, 0, 0)
  parts.push(bake(rim, cc('#ffffff'), [1, 1], 0.1))
  const face = T / 2 + 0.012
  const white = cc('#ffffff')
  if (role === 'dodge') {
    const ring = new THREE.RingGeometry(R * 0.36, R * 0.56, 26)
    ring.rotateY(Math.PI / 2)
    ring.translate(face, 0, 0)
    parts.push(bake(ring, white))
  } else {
    // Chevrons on the face: up to hop it, down to dive under.
    const dir = role === 'dive' ? -1 : 1
    const w = R * 0.5
    const th = R * 0.16
    for (const oy of [-0.26, 0.2]) {
      const cy = oy * R
      const sh = new THREE.Shape()
      sh.moveTo(-w, cy - dir * w * 0.45)
      sh.lineTo(0, cy + dir * w * 0.45)
      sh.lineTo(w, cy - dir * w * 0.45)
      sh.lineTo(w, cy - dir * w * 0.45 - dir * th)
      sh.lineTo(0, cy + dir * w * 0.45 - dir * th)
      sh.lineTo(-w, cy - dir * w * 0.45 - dir * th)
      sh.closePath()
      const g = new THREE.ShapeGeometry(sh)
      g.rotateY(Math.PI / 2)
      g.translate(face, 0, 0)
      parts.push(bake(g, white))
    }
  }
  return merge(parts)
}

/**
 * A flipper: a bar from its pivot (the origin) along local +x, its round ends `d` apart, tapering from r1 to r2,
 * its top at y 0 and 0.3 deep, orange with a white rubber band round its edge (gold, on a gold line) and a yellow cap
 * on its pivot.
 */
function flipperGeometry(d: number, r1: number, r2: number, gold: boolean): THREE.BufferGeometry {
  // The outline: round the pivot's end, along the tangent, round the tip and back (external tangents touch each
  // circle at ±(π/2 − a) from the line between them).
  const a = Math.asin(Math.max(-1, Math.min(1, (r1 - r2) / d)))
  const sh = new THREE.Shape()
  sh.absarc(0, 0, r1, Math.PI / 2 - a, Math.PI * 1.5 + a, false)
  sh.absarc(d, 0, r2, -Math.PI / 2 + a, Math.PI / 2 - a, false)
  sh.closePath()
  const depth = 0.3
  const g = new THREE.ExtrudeGeometry(sh, { depth, steps: 3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 })
  // Shape space into the table's plane, extruded down from its top at y 0.
  g.rotateX(Math.PI / 2)
  const orange = cc(CODE.jump)
  const band = cc(gold ? CODE.gold : '#ffffff')
  const top = cc(mix(CODE.jump, '#ffffff', 0.12))
  // Its top, the bevel round it (gold on a gold line, so the edge shows from above), its sides with the band.
  const body = bake(g, (_x, y) => (y > 0.022 ? top : y > -0.012 ? (gold ? band : top) : y < -depth * 0.3 && y > -depth * 0.72 ? band : orange), [1, 1], 0.04)
  const cap = new THREE.CylinderGeometry(r1 * 0.55, r1 * 0.6, 0.12, 18)
  cap.translate(0, 0.06, 0)
  const dot = new THREE.CylinderGeometry(r1 * 0.22, r1 * 0.22, 0.13, 12)
  dot.translate(0, 0.07, 0)
  return merge([body, bake(cap, cc('#ffd23f'), [1, 1], 0.08), bake(dot, cc('#ffffff'))])
}

/** A trampoline's mat: a dish of depth 1 under its rim at y 0 (scaled to nothing at rest), round or square. */
function trampolineMat(round: boolean, ax: number, az: number): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const k = 1 / 1.1
  if (round) {
    const rings = 7
    const segs = 32
    pos.push(0, -1, 0)
    uv.push(0, 0)
    for (let r = 1; r <= rings; r++) {
      const f = r / rings
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2
        const x = Math.cos(a) * ax * f
        const z = Math.sin(a) * az * f
        pos.push(x, -(1 - f * f), z)
        uv.push(-x * k, z * k)
      }
    }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s)
    for (let r = 1; r < rings; r++) {
      const a0 = 1 + (r - 1) * segs
      const a1 = 1 + r * segs
      for (let s = 0; s < segs; s++) {
        const s1 = (s + 1) % segs
        idx.push(a0 + s, a0 + s1, a1 + s1, a0 + s, a1 + s1, a1 + s)
      }
    }
  } else {
    const n = 10
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * 2 - 1
        const v = (j / n) * 2 - 1
        const x = u * ax
        const z = v * az
        pos.push(x, -(1 - u * u) * (1 - v * v), z)
        uv.push(-x * k, z * k)
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i
        const b = a + n + 1
        idx.push(a, b + 1, a + 1, a, b, b + 1)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  // The light as it lies flat, a touch darker toward the rim.
  const col: number[] = []
  for (let v = 0; v < pos.length / 3; v++) {
    const rr = round ? Math.hypot(pos[v * 3]! / ax, pos[v * 3 + 2]! / az) : Math.max(Math.abs(pos[v * 3]! / ax), Math.abs(pos[v * 3 + 2]! / az))
    const kk = 1 - 0.12 * rr * rr
    col.push(kk, kk, kk)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

/** A trampoline's frame (white steel at its rim), its springs (silver, mat to frame) and a striped skirt down `depth`. */
function trampolineFrame(round: boolean, hx: number, hz: number, depth: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const white = cc('#fbfaff')
  const steel = cc('#d9dbe6')
  const teal = cc('#3ec8cf')
  const spring = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 0.02) return
    const sp = new THREE.CylinderGeometry(0.035, 0.035, len, 5)
    sp.rotateZ(Math.PI / 2)
    sp.rotateY(-Math.atan2(bz - az, bx - ax))
    sp.translate((ax + bx) / 2, -0.015, (az + bz) / 2)
    parts.push(bake(sp, steel, [1, 1], 0.1))
  }
  const skirtH = depth - 0.08
  if (round) {
    const ring = new THREE.TorusGeometry(hx * 0.96, 0.085, 8, 40)
    ring.rotateX(Math.PI / 2)
    ring.translate(0, -0.03, 0)
    parts.push(bake(ring, white, [1, 1], 0.08))
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2
      spring(Math.cos(a) * hx * 0.84, Math.sin(a) * hz * 0.84, Math.cos(a) * hx * 0.95, Math.sin(a) * hz * 0.95)
    }
    // The skirt: teal and white panels down to its foot.
    const skirt = new THREE.CylinderGeometry(hx * 0.95, hx * 0.95, skirtH, 36, 1, true)
    skirt.translate(0, -0.08 - skirtH / 2, 0)
    parts.push(bake(skirt, (x, _y, z) => (Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12) % 2 ? white : teal)))
  } else {
    for (const [cx, cz, sx, sz] of [
      [0, -hz * 0.96, hx * 2, 0.17],
      [0, hz * 0.96, hx * 2, 0.17],
      [-hx * 0.96, 0, 0.17, hz * 2],
      [hx * 0.96, 0, 0.17, hz * 2],
    ] as const) {
      const bar = new THREE.BoxGeometry(sx, 0.15, sz)
      bar.translate(cx, -0.04, cz)
      parts.push(bake(bar, white, [1, 1], 0.08))
    }
    // Springs along each edge, about every 0.45 m.
    const nx = Math.max(3, Math.round((hx * 1.68) / 0.45))
    const nz = Math.max(3, Math.round((hz * 1.68) / 0.45))
    for (let k = 0; k <= nx; k++) {
      const x = -hx * 0.84 + (k / nx) * hx * 1.68
      spring(x, -hz * 0.84, x, -hz * 0.95)
      spring(x, hz * 0.84, x, hz * 0.95)
    }
    for (let k = 1; k < nz; k++) {
      const z = -hz * 0.84 + (k / nz) * hz * 1.68
      spring(-hx * 0.84, z, -hx * 0.95, z)
      spring(hx * 0.84, z, hx * 0.95, z)
    }
    // The skirt's four sides (open on top, so the mat can dip into it).
    for (const [cx, cz, w, yaw] of [
      [0, -hz * 0.95, hx * 1.9, Math.PI],
      [0, hz * 0.95, hx * 1.9, 0],
      [-hx * 0.95, 0, hz * 1.9, -Math.PI / 2],
      [hx * 0.95, 0, hz * 1.9, Math.PI / 2],
    ] as const) {
      const side = new THREE.PlaneGeometry(w, skirtH, Math.max(2, Math.round(w / 0.6)), 1)
      side.rotateY(yaw)
      side.translate(cx, -0.08 - skirtH / 2, cz)
      parts.push(bake(side, (x, _y, z) => (Math.floor((x + z + 50) / 0.6) % 2 ? white : teal)))
    }
  }
  return merge(parts)
}

/** A lumpy ring of foam round a pool's edge, at (x, y, z), radius r, puffs about t big. */
function foamRing(x: number, y: number, z: number, r: number, t: number, rnd: () => number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const n = Math.max(10, Math.round(r * 14))
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.2
    const s = t * (0.8 + rnd() * 0.6)
    const g = new THREE.IcosahedronGeometry(s, 1)
    g.scale(1.3, 0.7, 1.3)
    g.translate(x + Math.cos(a) * r, y + s * 0.2, z + Math.sin(a) * r)
    parts.push(bake(g, cc(rnd() < 0.3 ? '#dffbf6' : '#ffffff'), [1, 1], 0.12))
  }
  return merge(parts)
}

/**
 * A geyser's column (unit radius and height, from y 0 to 1): an outer jet of teal fizz flaring to the top and a white
 * core, seen through each other (the texture's streaks and bubbles carry the alpha).
 */
function columnGeometry(): THREE.BufferGeometry {
  const outer = new THREE.CylinderGeometry(1, 0.78, 1, 20, 6, true)
  outer.translate(0, 0.5, 0)
  const core = new THREE.CylinderGeometry(0.55, 0.48, 1, 14, 6, true)
  core.translate(0, 0.5, 0)
  const scale = (g: THREE.BufferGeometry, u: number, v: number) => {
    const a = g.attributes.uv!
    for (let k = 0; k < a.count; k++) a.setXY(k, a.getX(k) * u, a.getY(k) * v)
  }
  scale(outer, 3, 1.6)
  scale(core, 2, 2.2)
  return merge([paint(outer, '#8ff0e4'), paint(core, '#ffffff')])
}

/** A foam crown for a column's top: puffs in a ring and one on top, unit size. */
function crownGeometry(rnd: () => number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    const g = new THREE.IcosahedronGeometry(0.34 + rnd() * 0.14, 1)
    g.translate(Math.cos(a) * 0.82, (rnd() - 0.5) * 0.2, Math.sin(a) * 0.82)
    parts.push(bake(g, cc(k % 3 === 0 ? '#c8f7ef' : '#ffffff'), [1, 1], 0.15))
  }
  const top = new THREE.IcosahedronGeometry(0.62, 1)
  top.translate(0, 0.32, 0)
  parts.push(bake(top, cc('#ffffff'), [1, 1], 0.18))
  return merge(parts)
}

/** A column's fizz: white streaks rising and rings of bubbles, alpha only where the fizz is (tiling). */
function paintFizzColumn(p: Painter): THREE.CanvasTexture {
  return p.paint(
    128,
    256,
    (g, w, h) => {
      g.clearRect(0, 0, w, h)
      let seed = 11
      const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
      g.fillStyle = 'rgba(255,255,255,0.32)'
      g.fillRect(0, 0, w, h)
      for (let k = 0; k < 16; k++) {
        const x = rnd() * w
        const sw = 3 + rnd() * 9
        const grad = g.createLinearGradient(x - sw, 0, x + sw, 0)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(0.5, `rgba(255,255,255,${0.35 + rnd() * 0.45})`)
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        for (const ox of [-w, 0, w]) g.fillRect(x - sw + ox, 0, sw * 2, h)
      }
      g.strokeStyle = 'rgba(255,255,255,0.95)'
      g.lineWidth = 2
      for (let k = 0; k < 26; k++) {
        const r = 2 + rnd() * 5
        const x = rnd() * w
        const y = rnd() * h
        for (const ox of [-w, 0, w])
          for (const oy of [-h, 0, h]) {
            g.beginPath()
            g.arc(x + ox, y + oy, r, 0, Math.PI * 2)
            g.stroke()
          }
      }
    },
    { repeat: true },
  )
}

/** A dashed ring on clear (the material colours it red): where a sprinkle will land. */
function paintDashedRing(p: Painter): THREE.CanvasTexture {
  return p.paint(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    // A soft halo just inside it, so it reads on any floor.
    const grad = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.41)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(1, 'rgba(255,255,255,0.35)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(w / 2, h / 2, w * 0.41, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#ffffff'
    g.lineWidth = w * 0.1
    g.lineCap = 'round'
    const n = 10
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2
      g.beginPath()
      g.arc(w / 2, h / 2, w * 0.42, a0, a0 + (Math.PI * 2) / n - 0.26)
      g.stroke()
    }
  })
}

/** A music note (♪), white with a soft dark edge on clear, drawn with paths (no font needed). */
function paintNote(p: Painter): THREE.CanvasTexture {
  return p.paint(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    const draw = (fill: string, grow: number) => {
      g.fillStyle = fill
      g.strokeStyle = fill
      g.lineWidth = 5 + grow * 2
      g.lineCap = 'round'
      g.beginPath()
      g.ellipse(w * 0.36, h * 0.74, w * 0.15 + grow, h * 0.11 + grow, -0.45, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.moveTo(w * 0.49, h * 0.72)
      g.lineTo(w * 0.49, h * 0.14)
      g.quadraticCurveTo(w * 0.62, h * 0.3, w * 0.76, h * 0.34)
      g.stroke()
    }
    draw('rgba(90,40,0,0.55)', 2.5)
    draw('#ffffff', 0)
  })
}

/** A chrome matcap: sky above, a dark horizon band, the floor's glow below, a hot highlight. */
function paintChrome(p: Painter): THREE.CanvasTexture {
  return p.paint(256, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#f4f8ff')
    sky.addColorStop(0.38, '#b9c6e2')
    sky.addColorStop(0.5, '#474d63')
    sky.addColorStop(0.56, '#8a8fa8')
    sky.addColorStop(0.8, '#d9cfe8')
    sky.addColorStop(1, '#7b7393')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    // Darker toward the rim, as a sphere's edge turns away.
    const rim = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.52)
    rim.addColorStop(0, 'rgba(0,0,0,0)')
    rim.addColorStop(1, 'rgba(20,16,40,0.55)')
    g.fillStyle = rim
    g.fillRect(0, 0, w, h)
    const spec = g.createRadialGradient(w * 0.34, h * 0.28, 0, w * 0.34, h * 0.28, w * 0.13)
    spec.addColorStop(0, 'rgba(255,255,255,1)')
    spec.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = spec
    g.fillRect(0, 0, w, h)
  })
}

/**
 * A pinball table's playfield, W × D m: deep violet, lighter up the table, a gloss, star dust, lane lines, the rims of
 * the lamps at `rims` (u across, v up) with chevrons up the lane between each and the next, a green target at the top,
 * a violet border. Canvas left is screen left (+x) and its top is the far end, up the table.
 */
function paintTable(p: Painter, W: number, D: number, lanes: number, rims: [number, number][]): THREE.CanvasTexture {
  const w0 = 512
  const h0 = Math.round(Math.min(1536, Math.max(256, (w0 * D) / W)))
  return p.paint(w0, h0, (g, w, h) => {
    let seed = 5
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const base = g.createLinearGradient(0, h, 0, 0)
    base.addColorStop(0, '#241b4e')
    base.addColorStop(1, '#3b2d77')
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    // Gloss: soft diagonal sheens down the table.
    for (let k = 0; k < Math.max(2, Math.round(h / w) * 2); k++) {
      const y0 = (k / Math.max(2, Math.round(h / w) * 2)) * h
      const sheen = g.createLinearGradient(w * 0.15, y0, w * 0.45, y0 + w * 0.3)
      sheen.addColorStop(0, 'rgba(255,255,255,0)')
      sheen.addColorStop(0.5, `rgba(255,255,255,${k % 2 ? 0.05 : 0.08})`)
      sheen.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = sheen
      g.fillRect(0, y0, w, w * 0.4)
    }
    // Star dust.
    g.fillStyle = 'rgba(255,255,255,0.5)'
    for (let k = 0; k < (90 * h) / w; k++) {
      g.beginPath()
      g.arc(rnd() * w, rnd() * h, 0.6 + rnd() * 1.3, 0, Math.PI * 2)
      g.fill()
    }
    const laneW = w / lanes
    // Lane lines between the lanes, up the middle of the table.
    g.strokeStyle = '#6a5ab8'
    g.lineWidth = 5
    for (let l = 1; l < lanes; l++) {
      g.beginPath()
      g.moveTo(l * laneW, h * 0.05)
      g.lineTo(l * laneW, h * 0.95)
      g.stroke()
    }
    // The lamps' rims, and chevrons up the lane to the next rim.
    const rr = Math.min(laneW * 0.16, 15)
    const byLane = new Map<number, [number, number][]>()
    for (const [u, v] of rims) {
      const lane = Math.min(lanes - 1, Math.floor(u * lanes))
      let list = byLane.get(lane)
      if (!list) byLane.set(lane, (list = []))
      list.push([u * w, (1 - v) * h])
    }
    for (const list of byLane.values()) {
      list.sort((a, b) => b[1] - a[1])
      list.forEach(([cx, cy], n) => {
        g.fillStyle = 'rgba(10,6,30,0.85)'
        g.beginPath()
        g.arc(cx, cy, rr, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = 'rgba(255,255,255,0.75)'
        g.lineWidth = 2.5
        g.stroke()
        const next = list[n + 1]
        if (!next || cy - next[1] > h * 0.25) return
        const my = (cy + next[1]) / 2
        g.strokeStyle = 'rgba(255,255,255,0.22)'
        g.lineWidth = 6
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(cx - laneW * 0.16, my + laneW * 0.08)
        g.lineTo(cx, my - laneW * 0.06)
        g.lineTo(cx + laneW * 0.16, my + laneW * 0.08)
        g.stroke()
      })
    }
    // The target at the top: a green pad with an arrow up.
    const tw = Math.min(w * 0.3, 150)
    const th = Math.min(h * 0.05, 60) + 12
    const ty = Math.min(h * 0.03, 24)
    g.fillStyle = '#3ecf8e'
    roundRect(g, w / 2 - tw / 2, ty, tw, th, 10)
    g.fill()
    g.fillStyle = '#12352a'
    g.beginPath()
    g.moveTo(w / 2, ty + 6)
    g.lineTo(w / 2 - 16, ty + th - 8)
    g.lineTo(w / 2 + 16, ty + th - 8)
    g.closePath()
    g.fill()
    // The border.
    g.strokeStyle = '#8a6ad4'
    g.lineWidth = 10
    g.strokeRect(5, 5, w - 10, h - 10)
  })
}
