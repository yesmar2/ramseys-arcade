import type { Course } from '../engine/types.ts'

/*
 * Piano Steps' tune: the note each key plays. Shared by the scene (a note pops up off a key Blip lands on) and the
 * sound (audio.ts plays it), so the two always agree. No three.js here: the sound imports it too.
 */

/** A C-major scale's steps up from C. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11]

const cache = new WeakMap<Course, Map<number, number>>()

/**
 * The note each piano key plays, by solid index: semitones up from its round's lowest C (0). A key's own
 * `params.note` when the round gives one; otherwise the next note of a C-major scale by its place up the keyboard
 * (by z, then height), a black key the semitone over the white key before it, so the climb plays a scale either way.
 */
export function keyNotes(course: Course): Map<number, number> {
  const got = cache.get(course)
  if (got) return got
  const notes = new Map<number, number>()
  const byRound = new Map<number, { i: number; x: number; y: number; z: number; black: boolean; note?: number }[]>()
  course.solids.forEach((s, i) => {
    if (s.look !== 'key-white' && s.look !== 'key-black') return
    const p = (s as { params?: Record<string, unknown> }).params?.note
    let list = byRound.get(s.round)
    if (!list) byRound.set(s.round, (list = []))
    list.push({ i, x: s.x, y: s.y, z: s.z, black: s.look === 'key-black', note: typeof p === 'number' && Number.isFinite(p) ? p : undefined })
  })
  for (const list of byRound.values()) {
    list.sort((a, b) => a.z - b.z || a.y - b.y || b.x - a.x)
    let step = 0
    let last = -1
    for (const k of list) {
      if (k.note !== undefined) {
        notes.set(k.i, k.note)
        if (!k.black) last = k.note
        continue
      }
      if (k.black) notes.set(k.i, last + 1)
      else {
        last = 12 * Math.floor(step / 7) + MAJOR[step % 7]!
        notes.set(k.i, last)
        step++
      }
    }
  }
  cache.set(course, notes)
  return notes
}
