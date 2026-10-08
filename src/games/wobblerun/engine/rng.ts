/**
 * Seeded randomness for laying courses: the same seed lays the same course on every device. Seeds are strings,
 * one per round of a day's try ('wobble:' + day + ':' + attempt + ':' + slot), so changing one round never
 * reshuffles another. Physics never uses any of this (a run is the same however often it's run).
 */
import type { Rng } from './types.ts'

/** A string's 32-bit hash (FNV-1a, the prototype's). */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A seeded rng with the helpers a round builder wants. */
export function makeRng(seed: string | number): Rng {
  const next = mulberry32(typeof seed === 'string' ? hashString(seed) : seed)
  const rng = (() => next()) as Rng
  rng.between = (a, b) => a + next() * (b - a)
  rng.int = (a, b) => a + Math.floor(next() * (b - a + 1))
  rng.pick = (list) => list[Math.floor(next() * list.length)]!
  rng.chance = (p) => next() < p
  rng.sign = () => (next() < 0.5 ? -1 : 1)
  rng.shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      const swap = list[i]!
      list[i] = list[j]!
      list[j] = swap
    }
    return list
  }
  return rng
}
