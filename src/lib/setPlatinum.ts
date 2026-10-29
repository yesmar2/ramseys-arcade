import { useSyncExternalStore } from 'react'

/*
 * Platinum set by an admin's own lap (the API's setLaps.ts; Ramsey, 2026-10-29: "i drive upcoming days and my best
 * + 0.5s becomes platinum"). An admin test-drives a race's course from the admin page's Set platinum section, the
 * test run's card sends the time (SetPlatinumRow), and the course's platinum is the best of them and half a second
 * more. Every medal on the site goes by it (raceMedals.ts medalTimes), and the API's tickets and medal counts too.
 * A course nobody has driven keeps its worked-out platinum.
 *
 * The courses come from the API once a page loads, and again when it comes back into view; the last list is kept
 * so a medal on the next load needn't wait for it. A course is known here by its game and its blue's time in ms,
 * which every medal already has to hand: two courses of a game don't share one.
 */

export type SetLapRow = { game: string; course: number; paceMs: number | null; lapMs: number; platinumMs: number | null; at: number }

const CACHE_KEY = 'skermix-set-platinums'

let rows: SetLapRow[] = []
let byPace = new Map<string, number>()
let version = 0
const listeners = new Set<() => void>()

function take(next: SetLapRow[]) {
  rows = next
  byPace = new Map()
  for (const r of next) if (r.paceMs != null && r.platinumMs != null) byPace.set(`${r.game}:${r.paceMs}`, r.platinumMs)
  version += 1
  for (const l of listeners) l()
}

/** A course's platinum from an admin's set lap, by its game and its blue's time; null when nobody has set one. */
export function setPlatinumFor(game: string, paceMs: number): number | null {
  return byPace.get(`${game}:${Math.round(paceMs)}`) ?? null
}

/** Every course with a set lap. */
export function setLapRows(): readonly SetLapRow[] {
  return rows
}

/** A count that moves when the set laps do: a component that shows medals reads it to be drawn again. */
export function useSetPlatinums(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
    () => version,
  )
}

/** The list again from the API. */
export async function loadSetPlatinums(): Promise<void> {
  const { api } = await import('./leaderboard')
  const body = await api<{ laps: SetLapRow[] }>('/tracks/platinums')
  take(body.laps)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(body.laps))
  } catch {
    /* private mode */
  }
}

let lastLoad = 0

/** At page load: the kept list at once, then the API's, and again when the page comes back after a minute away. */
export function bootSetPlatinums(): void {
  try {
    const kept = localStorage.getItem(CACHE_KEY)
    if (kept) take(JSON.parse(kept) as SetLapRow[])
  } catch {
    /* none kept */
  }
  const load = () => {
    lastLoad = Date.now()
    loadSetPlatinums().catch(() => {})
  }
  load()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastLoad > 60_000) load()
  })
}

/**
 * An admin's finished test run on a race's course (its day's number) as a set lap: kept by the API if it's their
 * best there. Says the set lap after it, whether this run is it now, and the course's platinum.
 */
export async function sendSetLap(game: string, course: number, ms: number): Promise<{ lapMs: number; improved: boolean; platinumMs: number | null }> {
  const { api } = await import('./leaderboard')
  const result = await api<{ lapMs: number; improved: boolean; platinumMs: number | null }>('/admin/set-laps', {
    method: 'POST',
    body: JSON.stringify({ game, course, ms: Math.round(ms) }),
  })
  await loadSetPlatinums().catch(() => {})
  return result
}

/** A course's set lap gone, so its platinum is worked out again. */
export async function clearSetLap(game: string, course: number): Promise<void> {
  const { api } = await import('./leaderboard')
  await api(`/admin/set-laps/${encodeURIComponent(game)}/${course}`, { method: 'DELETE' })
  await loadSetPlatinums().catch(() => {})
}
