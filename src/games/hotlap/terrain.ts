import * as THREE from 'three'
import { HALF_WIDTH as TW, type Track } from './sim'

/*
 * The ground under a hilly track (a flat one sits on a plain). Heights on a grid: under the road and at
 * its edges, a hand's width below it; between stretches of road at different heights, a slope from one to
 * the other; further out, rolling away into hills. heightAt gives the drawn surface's height anywhere, so
 * trees, boards and the car off the road stand on the grass rather than in it or above it.
 */

/** Metres between the grid's points, how far the grid reaches past the track, and how wide its edge is. */
const CELL = 8
const REACH = 640
const EDGE = 260
/** Samples of the road this far from a point shape the ground there. */
const NEAR = 64
const BUCKET = 32

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export class Terrain {
  /** The height beyond the grid, where a plain carries on to the horizon. */
  readonly base: number
  private readonly x0: number
  private readonly y0: number
  private readonly cols: number
  private readonly rows: number
  private readonly heights: Float32Array

  constructor(track: Track, box: { minX: number; maxX: number; minY: number; maxY: number }) {
    const z = track.z!
    // The road, every 2 m, in buckets to find what's near a point quickly.
    const sx: number[] = []
    const sy: number[] = []
    const sz: number[] = []
    for (let i = 0; i < track.n; i += 2) {
      sx.push(track.x[i]!)
      sy.push(track.y[i]!)
      sz.push(z[i]!)
    }
    const buckets = new Map<number, number[]>()
    const key = (bx: number, by: number) => bx * 100_003 + by
    sx.forEach((x, k) => {
      const id = key(Math.floor(x / BUCKET), Math.floor(sy[k]! / BUCKET))
      const list = buckets.get(id)
      if (list) list.push(k)
      else buckets.set(id, [k])
    })
    // The plain lies below the lowest of the road, so it never shows through; the grid's edge falls to it.
    let lowest = Infinity
    for (const v of sz) lowest = Math.min(lowest, v)
    this.base = lowest - 2

    this.x0 = box.minX - REACH
    this.y0 = box.minY - REACH
    this.cols = Math.ceil((box.maxX - box.minX + 2 * REACH) / CELL) + 1
    this.rows = Math.ceil((box.maxY - box.minY + 2 * REACH) / CELL) + 1

    // Far off, the ground follows the road's heights broadly: a coarse grid of them, weighed by nearness.
    const FAR = 40
    const fc = Math.ceil(((this.cols - 1) * CELL) / FAR) + 1
    const fr = Math.ceil(((this.rows - 1) * CELL) / FAR) + 1
    const farZ = new Float32Array(fc * fr)
    const farD = new Float32Array(fc * fr)
    for (let j = 0; j < fr; j++) {
      for (let i = 0; i < fc; i++) {
        const px = this.x0 + i * FAR
        const py = this.y0 + j * FAR
        let sum = 0
        let wsum = 0
        let least = Infinity
        for (let k = 0; k < sx.length; k += 10) {
          const d2 = (sx[k]! - px) ** 2 + (sy[k]! - py) ** 2
          least = Math.min(least, d2)
          const w = 1 / (d2 + 400)
          sum += w * sz[k]!
          wsum += w
        }
        farZ[j * fc + i] = sum / wsum
        farD[j * fc + i] = Math.sqrt(least)
      }
    }
    const farAt = (x: number, y: number) => {
      const u = Math.min(fc - 1.001, Math.max(0, (x - this.x0) / FAR))
      const v = Math.min(fr - 1.001, Math.max(0, (y - this.y0) / FAR))
      const i = Math.floor(u)
      const j = Math.floor(v)
      const fu = u - i
      const fv = v - j
      const at = (a: Float32Array, ii: number, jj: number) => a[jj * fc + ii]!
      const mix = (a: Float32Array) =>
        (at(a, i, j) * (1 - fu) + at(a, i + 1, j) * fu) * (1 - fv) + (at(a, i, j + 1) * (1 - fu) + at(a, i + 1, j + 1) * fu) * fv
      return { z: mix(farZ), d: mix(farD) }
    }

    // Hills that roll away from the track: a few long waves, the same every time for a track.
    const waves = [
      [640, 9, 0.3, 1.1],
      [390, 6, 2.1, 4.2],
      [240, 3.5, 3.9, 0.7],
      [150, 1.6, 5.3, 2.9],
    ] as const
    const roll = (x: number, y: number) => {
      let h = 0
      for (const [len, amp, dir, phase] of waves) h += amp * Math.sin(((x * Math.cos(dir) + y * Math.sin(dir)) / len) * Math.PI * 2 + phase)
      return h
    }

    const width = (this.cols - 1) * CELL
    const depth = (this.rows - 1) * CELL
    this.heights = new Float32Array(this.cols * this.rows)
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const px = this.x0 + i * CELL
        const py = this.y0 + j * CELL
        const far = farAt(px, py)
        let h = far.z + roll(px, py) * smoothstep(70, 380, far.d)
        // Out at the edge of the grid, down to the plain.
        const edge = Math.min(i * CELL, j * CELL, width - i * CELL, depth - j * CELL)
        const fall = smoothstep(0, EDGE, edge)
        // Well away from the road (the coarse grid's distance is good to half a cell), that's all.
        if (far.d > NEAR + 40) {
          this.heights[j * this.cols + i] = this.base + (h - this.base) * fall
          continue
        }
        // Near the road: its own heights, the nearest counting by far the most.
        let sum = 0
        let wsum = 0
        let least = Infinity
        let nearestZ = 0
        const bx = Math.floor(px / BUCKET)
        const by = Math.floor(py / BUCKET)
        const span = Math.ceil(NEAR / BUCKET)
        for (let dj = -span; dj <= span; dj++) {
          for (let di = -span; di <= span; di++) {
            const list = buckets.get(key(bx + di, by + dj))
            if (!list) continue
            for (const k of list) {
              const d2 = (sx[k]! - px) ** 2 + (sy[k]! - py) ** 2
              if (d2 > NEAR * NEAR) continue
              if (d2 < least) {
                least = d2
                nearestZ = sz[k]!
              }
              const w = 1 / (d2 + 9) ** 2
              sum += w * sz[k]!
              wsum += w
            }
          }
        }
        if (wsum > 0) {
          const d = Math.sqrt(least)
          // A hand's width below the road, so the road always shows, rising to meet the grass beside it.
          const road = sum / wsum - 0.15 * (1 - smoothstep(TW + 1, TW + 6, d))
          h = road + (h - road) * smoothstep(TW + 4, NEAR, d)
          // And never above the road beside it: in a dip, or inside a tight corner, the slopes round about
          // would lift the ground over the road's edge. Past 20 m out it may climb away, a bank at most 3 in 5.
          h = Math.min(h, nearestZ - 0.15 + Math.max(0, d - (TW + 12)) * 0.6)
        }
        this.heights[j * this.cols + i] = this.base + (h - this.base) * fall
      }
    }
  }

  /** The drawn ground's height at a point: the triangle it's in, as the mesh has it. */
  heightAt(x: number, y: number): number {
    const u = (x - this.x0) / CELL
    const v = (y - this.y0) / CELL
    if (u < 0 || v < 0 || u >= this.cols - 1 || v >= this.rows - 1) return this.base
    const i = Math.floor(u)
    const j = Math.floor(v)
    const fu = u - i
    const fv = v - j
    const H = this.heights
    const a = H[j * this.cols + i]!
    const b = H[j * this.cols + i + 1]!
    const c = H[(j + 1) * this.cols + i]!
    const d = H[(j + 1) * this.cols + i + 1]!
    // Each cell is two triangles, split from its east corner to its north one.
    return fu + fv <= 1 ? a + fu * (b - a) + fv * (c - a) : d + (1 - fu) * (c - d) + (1 - fv) * (b - d)
  }

  /** The ground as a mesh, on three's axes (x east, y up, −z north). */
  mesh(material: THREE.Material): THREE.Mesh {
    const { cols, rows } = this
    const pos = new Float32Array(cols * rows * 3)
    const uv = new Float32Array(cols * rows * 2)
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i
        const x = this.x0 + i * CELL
        const y = this.y0 + j * CELL
        pos[k * 3] = x
        pos[k * 3 + 1] = this.heights[k]!
        pos[k * 3 + 2] = -y
        uv[k * 2] = x / 24
        uv[k * 2 + 1] = y / 24
      }
    }
    const index = new Uint32Array((cols - 1) * (rows - 1) * 6)
    let n = 0
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = j * cols + i
        const b = a + 1
        const c = a + cols
        const d = c + 1
        index.set([a, b, c, b, d, c], n)
        n += 6
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(new THREE.BufferAttribute(index, 1))
    geo.computeVertexNormals()
    return new THREE.Mesh(geo, material)
  }
}
