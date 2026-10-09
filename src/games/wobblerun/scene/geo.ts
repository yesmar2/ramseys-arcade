import * as THREE from 'three'

/*
 * The scene's geometry kit: growing meshes (Layer) the static course is merged into, the engine's solids as boxes
 * and discs (sheared as the engine slopes them, so what's drawn is exactly what's stood on), and the small pieces
 * of hazards and dressing as three's own shapes with the light baked into their vertex colours. Everything is
 * drawn with MeshBasic materials: there are no lamps, so the light is painted on here.
 *
 * Merging is by hand (merge below), never three's BufferGeometryUtils: importing that example module renamed the
 * shared three.js chunk once and put 525 KB into the PWA precache (memory hot-lap-prototype.md).
 */

/** Toward the light: from over the camera's left shoulder (screen left is +x; the camera looks +z). */
export const LIGHT = new THREE.Vector3(0.4, 1, -0.45).normalize()

/** How lit a face is that faces `n` (world, unit): tops full, faces toward the camera a little less, the far sides least. */
export function shadeOf(nx: number, ny: number, nz: number): number {
  const d = nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z
  return Math.min(1, 0.66 + 0.4 * Math.max(0, d) + 0.06 * ny)
}

/**
 * A pose's frame as the engine has it (types.ts): turned by yaw, its top sheared up by tan(roll) a metre across
 * and tan(pitch) a metre along. Local (lx, ly, lz) goes to x + c·lx + s·lz, y + tr·lx + ly + tp·lz, z − s·lx + c·lz.
 */
export type Xf = { x: number; y: number; z: number; c: number; s: number; tr: number; tp: number }

export const IDENT: Xf = { x: 0, y: 0, z: 0, c: 1, s: 0, tr: 0, tp: 0 }

export function xfOf(x: number, y: number, z: number, yaw: number, pitch = 0, roll = 0): Xf {
  return { x, y, z, c: Math.cos(yaw), s: Math.sin(yaw), tr: Math.tan(roll), tp: Math.tan(pitch) }
}

/** The matrix of a pose's frame, for a mesh built in its own frame (matrixAutoUpdate off). */
export function setPoseMatrix(m: THREE.Matrix4, x: number, y: number, z: number, yaw: number, pitch: number, roll: number) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  m.set(c, 0, s, x, Math.tan(roll), 1, Math.tan(pitch), y, -s, 0, c, z, 0, 0, 0, 1)
}

/** One growing mesh: positions, vertex colours (hue × baked light), uvs and indices; and the z it spans. */
export class Layer {
  pos: number[] = []
  col: number[] = []
  uv: number[] = []
  idx: number[] = []
  z0 = Infinity
  z1 = -Infinity
  y1 = -Infinity

  vert(x: number, y: number, z: number, c: THREE.Color, k: number, u: number, v: number): number {
    this.pos.push(x, y, z)
    this.col.push(c.r * k, c.g * k, c.b * k)
    this.uv.push(u, v)
    if (z < this.z0) this.z0 = z
    if (z > this.z1) this.z1 = z
    if (y > this.y1) this.y1 = y
    return this.pos.length / 3 - 1
  }

  /** A triangle, turned so it faces along (nx, ny, nz) (front faces are counter-clockwise from outside). */
  tri(a: number, b: number, c: number, nx: number, ny: number, nz: number) {
    const p = this.pos
    const ax = p[a * 3]!
    const ay = p[a * 3 + 1]!
    const az = p[a * 3 + 2]!
    const ux = p[b * 3]! - ax
    const uy = p[b * 3 + 1]! - ay
    const uz = p[b * 3 + 2]! - az
    const vx = p[c * 3]! - ax
    const vy = p[c * 3 + 1]! - ay
    const vz = p[c * 3 + 2]! - az
    const cx = uy * vz - uz * vy
    const cy = uz * vx - ux * vz
    const cz = ux * vy - uy * vx
    if (cx * nx + cy * ny + cz * nz >= 0) this.idx.push(a, b, c)
    else this.idx.push(a, c, b)
  }

  quad(a: number, b: number, c: number, d: number, nx: number, ny: number, nz: number) {
    this.tri(a, b, c, nx, ny, nz)
    this.tri(a, c, d, nx, ny, nz)
  }

  get empty() {
    return this.idx.length === 0
  }

  geometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    geo.setIndex(this.idx)
    geo.computeBoundingSphere()
    return geo
  }
}

/** How a box or disc is coloured: its top, the band of pastel round its top edge, the body under it. */
export type SlabPaint = {
  top: THREE.Color
  band?: THREE.Color
  body: THREE.Color
  /** The top band's depth, m (0.22). */
  bandH?: number
  /** Texture repeats a metre. */
  uvk?: number
  /** Patterned sides (the colour code's materials); otherwise the sides sample one plain spot of the texture. */
  sideUv?: boolean
  /** The top's uv at local (lx, lz), in place of (−lx, lz)·uvk (a belt's arrows run its way). */
  topUv?: (lx: number, lz: number) => [number, number]
  /** Leave the bottom off (most things are only seen from above). */
  noBottom?: boolean
  /** How much darker the body is at its foot. */
  foot?: number
}

/** A plain spot of every tiling texture: the middle of a tile, away from its marks. */
const PLAIN_U = 0.27
const PLAIN_V = 0.06

function worldPoint(xf: Xf, lx: number, ly: number, lz: number, out: number[]) {
  out[0] = xf.x + xf.c * lx + xf.s * lz
  out[1] = xf.y + xf.tr * lx + ly + xf.tp * lz
  out[2] = xf.z - xf.s * lx + xf.c * lz
}

const P: number[] = [0, 0, 0]

/** A local horizontal normal turned to the world. */
function turnN(xf: Xf, nx: number, nz: number): [number, number] {
  return [xf.c * nx + xf.s * nz, -xf.s * nx + xf.c * nz]
}

/** The top's world normal under the pose's shear. */
function topNormal(xf: Xf): [number, number, number] {
  const gx = xf.tr * xf.c + xf.tp * xf.s
  const gz = -xf.tr * xf.s + xf.tp * xf.c
  const l = Math.hypot(gx, 1, gz)
  return [-gx / l, 1 / l, -gz / l]
}

/**
 * The outline of a slab's top, as points round it (box: four corners; disc: `sides` points), and the slab: its top
 * at local y 0, its body `depth` down, banded and shaded, written into `L` through `xf`.
 */
function slab(L: Layer, xf: Xf, ring: [number, number][], depth: number, p: SlabPaint, centre: boolean) {
  const k = p.uvk ?? 0.5
  const band = Math.min(p.bandH ?? 0.22, depth * 0.6)
  const bandC = p.band ?? p.top
  const [tnx, tny, tnz] = topNormal(xf)
  const topK = shadeOf(tnx, tny, tnz)
  const uvAt = (lx: number, lz: number): [number, number] => (p.topUv ? p.topUv(lx, lz) : [-lx * k, lz * k])
  // The top: a fan from the middle for a disc, two triangles for a box.
  const top: number[] = []
  for (const [lx, lz] of ring) {
    worldPoint(xf, lx, 0, lz, P)
    const [u, v] = uvAt(lx, lz)
    top.push(L.vert(P[0]!, P[1]!, P[2]!, p.top, topK, u, v))
  }
  if (centre) {
    worldPoint(xf, 0, 0, 0, P)
    const [u, v] = uvAt(0, 0)
    const mid = L.vert(P[0]!, P[1]!, P[2]!, p.top, topK, u, v)
    for (let i = 0; i < top.length; i++) L.tri(mid, top[i]!, top[(i + 1) % top.length]!, tnx, tny, tnz)
  } else L.quad(top[0]!, top[1]!, top[2]!, top[3]!, tnx, tny, tnz)
  // The sides, each in two bands: pastel round the top edge, the body below, darker toward its foot.
  const foot = p.foot ?? 0.8
  let along = 0
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!
    const [bx, bz] = ring[(i + 1) % ring.length]!
    const ex = bx - ax
    const ez = bz - az
    const len = Math.hypot(ex, ez)
    if (len < 1e-6) continue
    // Outward: the edge's right-hand normal, whichever way round the ring goes.
    let nx = ez / len
    let nz = -ex / len
    const mx = (ax + bx) / 2
    const mz = (az + bz) / 2
    if (nx * mx + nz * mz < 0) {
      nx = -nx
      nz = -nz
    }
    const [wx, wz] = turnN(xf, nx, nz)
    const sk = shadeOf(wx, 0, wz)
    const rows: [number, THREE.Color, number][] = [
      [0, bandC, sk],
      [-band, bandC, sk * 0.97],
      [-band, p.body, sk],
      [-depth, p.body, sk * foot],
    ]
    const ids: number[] = []
    for (const [ly, c, kk] of rows) {
      for (const [lx, lz, a] of [
        [ax, az, along],
        [bx, bz, along + len],
      ] as const) {
        worldPoint(xf, lx, ly, lz, P)
        const u = p.sideUv ? a * k : PLAIN_U
        const v = p.sideUv ? ly * k : PLAIN_V
        ids.push(L.vert(P[0]!, P[1]!, P[2]!, c, kk, u, v))
      }
    }
    L.quad(ids[0]!, ids[1]!, ids[3]!, ids[2]!, wx, 0, wz)
    L.quad(ids[4]!, ids[5]!, ids[7]!, ids[6]!, wx, 0, wz)
    along += len
  }
  if (!p.noBottom) {
    const bottom: number[] = []
    for (const [lx, lz] of ring) {
      worldPoint(xf, lx, -depth, lz, P)
      bottom.push(L.vert(P[0]!, P[1]!, P[2]!, p.body, 0.55, PLAIN_U, PLAIN_V))
    }
    for (let i = 1; i < bottom.length - 1; i++) L.tri(bottom[0]!, bottom[i]!, bottom[i + 1]!, 0, -1, 0)
  }
}

/** A box solid: hx × hz, its top at local y 0, `depth` deep. */
export function boxSlab(L: Layer, xf: Xf, hx: number, hz: number, depth: number, p: SlabPaint) {
  slab(
    L,
    xf,
    [
      [-hx, -hz],
      [-hx, hz],
      [hx, hz],
      [hx, -hz],
    ],
    depth,
    p,
    false,
  )
}

/** A disc solid: radius r drawn with `sides` sides (6, a hex tile), its top at local y 0, `depth` deep. */
export function discSlab(L: Layer, xf: Xf, r: number, sides: number, depth: number, p: SlabPaint) {
  const ring: [number, number][] = []
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2
    ring.push([r * Math.cos(a), r * Math.sin(a)])
  }
  slab(L, xf, ring, depth, p, true)
}

/**
 * A flat strip on top of a solid (a gold edge, a lit trim): a quad from a to b, `w` wide inward, `lift` up. With
 * `plain`, its uvs are the textures' plain spot (a stripe painted in a floor's own mesh).
 */
export function strip(L: Layer, xf: Xf, ax: number, az: number, bx: number, bz: number, w: number, c: THREE.Color, lift = 0.02, k = 1, plain = false) {
  const ex = bx - ax
  const ez = bz - az
  const len = Math.hypot(ex, ez)
  if (len < 1e-6) return
  // Inward: toward the solid's middle.
  let nx = -ez / len
  let nz = ex / len
  if (nx * (ax + bx) + nz * (az + bz) > 0) {
    nx = -nx
    nz = -nz
  }
  const ids: number[] = []
  for (const [lx, lz, u, v] of [
    [ax, az, 0, 1],
    [bx, bz, len, 1],
    [bx + nx * w, bz + nz * w, len, 0],
    [ax + nx * w, az + nz * w, 0, 0],
  ] as const) {
    worldPoint(xf, lx, lift, lz, P)
    ids.push(L.vert(P[0]!, P[1]!, P[2]!, c, k, plain ? PLAIN_U : u, plain ? PLAIN_V : v))
  }
  L.quad(ids[0]!, ids[1]!, ids[2]!, ids[3]!, 0, 1, 0)
}

/** The points round a box's top or a disc's, for trims along its edge. */
export function outline(shape: 'box' | 'cyl', hx: number, hz: number, r: number, sides: number): [number, number][] {
  if (shape === 'box')
    return [
      [-hx, -hz],
      [-hx, hz],
      [hx, hz],
      [hx, -hz],
    ]
  const ring: [number, number][] = []
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2
    ring.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return ring
}

/* ----------------------------------------------------------- small pieces --- */

const TMP_C = new THREE.Color()

/**
 * Bakes the light into a three shape's vertex colours (its normals, then dropped), in `colour` or per vertex by
 * `colourAt(x, y, z)`, and keeps its uvs (scaled by `uv`) for a pattern.
 */
export function bake(geo: THREE.BufferGeometry, colour: string | THREE.Color | ((x: number, y: number, z: number) => THREE.Color), uv: [number, number] = [1, 1], lift = 0): THREE.BufferGeometry {
  const pos = geo.attributes.position!
  const nor = geo.attributes.normal
  const cols = new Float32Array(pos.count * 3)
  const fixed = typeof colour === 'function' ? null : colour instanceof THREE.Color ? colour : new THREE.Color(colour)
  for (let i = 0; i < pos.count; i++) {
    const c = fixed ?? (colour as (x: number, y: number, z: number) => THREE.Color)(pos.getX(i), pos.getY(i), pos.getZ(i))
    const k = nor ? Math.min(1.05, shadeOf(nor.getX(i), nor.getY(i), nor.getZ(i)) + lift) : 1
    TMP_C.copy(c)
    cols[i * 3] = TMP_C.r * k
    cols[i * 3 + 1] = TMP_C.g * k
    cols[i * 3 + 2] = TMP_C.b * k
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2))
  else if (uv[0] !== 1 || uv[1] !== 1) {
    const a = geo.attributes.uv
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uv[0], a.getY(i) * uv[1])
  }
  geo.deleteAttribute('normal')
  if (!geo.index) {
    const idx: number[] = []
    for (let i = 0; i < pos.count; i++) idx.push(i)
    geo.setIndex(idx)
  }
  return geo
}

/** Shapes baked with `bake` into one (position, colour, uv, index), the parts let go. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let verts = 0
  let tris = 0
  for (const g of parts) {
    verts += g.attributes.position!.count
    tris += g.index ? g.index.count : g.attributes.position!.count
  }
  const pos = new Float32Array(verts * 3)
  const col = new Float32Array(verts * 3)
  const uv = new Float32Array(verts * 2)
  const idx = new Uint32Array(tris)
  let v = 0
  let t = 0
  for (const g of parts) {
    const n = g.attributes.position!.count
    pos.set((g.attributes.position as THREE.BufferAttribute).array as Float32Array, v * 3)
    if (g.attributes.color) col.set((g.attributes.color as THREE.BufferAttribute).array as Float32Array, v * 3)
    else col.fill(1, v * 3, (v + n) * 3)
    if (g.attributes.uv) uv.set((g.attributes.uv as THREE.BufferAttribute).array as Float32Array, v * 2)
    if (g.index) {
      const src = g.index.array
      for (let i = 0; i < src.length; i++) idx[t + i] = src[i]! + v
      t += src.length
    } else {
      for (let i = 0; i < n; i++) idx[t + i] = v + i
      t += n
    }
    v += n
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('color', new THREE.BufferAttribute(col, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setIndex(new THREE.BufferAttribute(idx, 1))
  out.computeBoundingSphere()
  return out
}

/** A Layer's contents as a baked part, to merge with three's shapes. */
export function layerPart(L: Layer): THREE.BufferGeometry {
  return L.geometry()
}
