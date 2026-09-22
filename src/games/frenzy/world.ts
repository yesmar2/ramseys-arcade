/*
 * The ocean: a surface at y = 0 and depth going down forever, split into four
 * zones. Deeper pays more per fish and is more dangerous, so how deep to swim
 * is the run's standing decision.
 *
 * Rocks are laid down from a seed, a chunk at a time, so a reef you swam past
 * is still there when you come back, and a new run gets a new reef.
 */

export type ZoneId = 'shallows' | 'twilight' | 'midnight' | 'abyss'

export type Zone = {
  id: ZoneId
  name: string
  /** World y where the zone begins. */
  top: number
  /** Points multiplier for anything eaten here. */
  mult: number
  /** Share of spawns that are bigger than you, rising by `dangerRamp` over a few minutes. */
  danger: number
  dangerRamp: number
  /** Share of predators that will actually hunt you rather than cruise. */
  aggressive: number
  /** Predators reach up to this multiple of your level. */
  reach: number
  /** How many of each are kept around the screen. */
  jellies: number
  mines: number
  schools: number
  rockChance: number
  rockMin: number
  rockMax: number
}

export const ZONES: readonly Zone[] = [
  {
    id: 'shallows',
    name: 'Sunlit shallows',
    top: 0,
    mult: 1,
    danger: 0.14,
    dangerRamp: 0.1,
    aggressive: 0.35,
    reach: 2.0,
    jellies: 0,
    mines: 0,
    schools: 2,
    rockChance: 0.62,
    rockMin: 60,
    rockMax: 170,
  },
  {
    id: 'twilight',
    name: 'Twilight zone',
    top: 1400,
    mult: 2,
    danger: 0.22,
    dangerRamp: 0.1,
    aggressive: 0.48,
    reach: 2.6,
    jellies: 5,
    mines: 1,
    schools: 1,
    rockChance: 0.48,
    rockMin: 90,
    rockMax: 260,
  },
  {
    id: 'midnight',
    name: 'Midnight zone',
    top: 3600,
    mult: 3,
    danger: 0.28,
    dangerRamp: 0.1,
    aggressive: 0.55,
    reach: 3.2,
    jellies: 3,
    mines: 4,
    schools: 2,
    rockChance: 0.5,
    rockMin: 140,
    rockMax: 400,
  },
  {
    id: 'abyss',
    name: 'The abyss',
    top: 7000,
    mult: 5,
    danger: 0.34,
    dangerRamp: 0.1,
    aggressive: 0.62,
    reach: 4.0,
    jellies: 2,
    mines: 5,
    schools: 1,
    rockChance: 0.55,
    rockMin: 200,
    rockMax: 560,
  },
]

export function zoneIndexAt(y: number): number {
  for (let i = ZONES.length - 1; i > 0; i--) {
    if (y >= ZONES[i]!.top) return i
  }
  return 0
}

export function zoneAt(y: number): Zone {
  return ZONES[zoneIndexAt(y)]!
}

/** Metres for the gauge — a readable number, not a physical one. */
export function depthMeters(y: number) {
  return Math.max(0, Math.round(y / 4))
}

/** 0 at the surface, 1 in the deep abyss: how dark the water is. */
export function darknessAt(y: number) {
  return Math.max(0, Math.min(1, (y - 900) / 9000))
}

export type Rock = {
  id: string
  x: number
  y: number
  r: number
  seed: number
  zone: ZoneId
  /** The big rock of a formation carries the coral; the ones around it are plain. */
  main: boolean
}

const CHUNK = 1100
/** Where a run begins — kept clear so nobody spawns in a wall. */
export const START_X = 0
export const START_Y = 240

export function mulberry32(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash3(a: number, b: number, c: number) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) | 0
}

let cacheSeed = Number.NaN
const chunkCache = new Map<string, Rock[]>()

function generateChunk(seed: number, cx: number, cy: number): Rock[] {
  const top = cy * CHUNK
  if (top + CHUNK < 320) return []
  const zone = zoneAt(top + CHUNK / 2)
  const rand = mulberry32(hash3(seed, cx, cy))
  const rocks: Rock[] = []
  let formations = rand() < zone.rockChance ? 1 : 0
  if (rand() < zone.rockChance * 0.35) formations += 1

  for (let f = 0; f < formations; f++) {
    const x = cx * CHUNK + 160 + rand() * (CHUNK - 320)
    const y = top + 160 + rand() * (CHUNK - 320)
    const size = zone.rockMin + rand() * (zone.rockMax - zone.rockMin)
    if (y - size < 300) continue
    if (Math.hypot(x - START_X, y - START_Y) < size + 460) continue
    rocks.push({ id: `${cx},${cy},${f},0`, x, y, r: size, seed: hash3(seed, cx * 7 + f, cy), zone: zone.id, main: true })
    const satellites = Math.floor(rand() * 3.2)
    for (let k = 0; k < satellites; k++) {
      const ang = rand() * Math.PI * 2
      const r = size * (0.32 + rand() * 0.34)
      const d = size * (0.72 + rand() * 0.42)
      rocks.push({
        id: `${cx},${cy},${f},${k + 1}`,
        x: x + Math.cos(ang) * d,
        y: Math.max(300 + r, y + Math.sin(ang) * d),
        r,
        seed: hash3(seed, cx * 13 + f * 3 + k, cy * 5 + 1),
        zone: zone.id,
        main: false,
      })
    }
  }
  return rocks
}

function chunk(seed: number, cx: number, cy: number): Rock[] {
  if (seed !== cacheSeed || chunkCache.size > 600) {
    chunkCache.clear()
    cacheSeed = seed
  }
  const key = `${cx},${cy}`
  let rocks = chunkCache.get(key)
  if (!rocks) {
    rocks = generateChunk(seed, cx, cy)
    chunkCache.set(key, rocks)
  }
  return rocks
}

/**
 * Every rock whose chunk touches the box around (x, y) — callers do the exact
 * test. The chunk-sized pad covers formations that spill over their chunk's edge.
 */
export function rocksNear(seed: number, x: number, y: number, radius: number): Rock[] {
  const x0 = Math.floor((x - radius - CHUNK) / CHUNK)
  const x1 = Math.floor((x + radius + CHUNK) / CHUNK)
  const y0 = Math.max(0, Math.floor((y - radius - CHUNK) / CHUNK))
  const y1 = Math.floor((y + radius + CHUNK) / CHUNK)
  if (y1 < y0) return []
  const out: Rock[] = []
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      for (const rock of chunk(seed, cx, cy)) out.push(rock)
    }
  }
  return out
}

/** Is a circle clear of every rock (with a margin)? */
export function clearOfRocks(seed: number, x: number, y: number, r: number, margin = 0) {
  for (const rock of rocksNear(seed, x, y, r + margin)) {
    if (Math.hypot(rock.x - x, rock.y - y) < rock.r + r + margin) return false
  }
  return true
}
