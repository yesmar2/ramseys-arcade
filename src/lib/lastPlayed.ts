import { useSyncExternalStore } from 'react'

/**
 * Which games this device has actually opened, most recent first.
 *
 * Kept on the device rather than the account: it answers "what were you just
 * doing", which is a property of the seat in front of the screen, and it has to
 * work before anyone signs in.
 */

const KEY = 'skermix-recent-games'
const EVENT = 'arcade-recent-games'
const MAX = 8

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((slug): slug is string => typeof slug === 'string').slice(0, MAX)
  } catch {
    // Private mode, cleared storage, or something else wrote here.
    return []
  }
}

export function recentGames(): string[] {
  if (typeof window === 'undefined') return []
  return read()
}

export function rememberPlayed(slug: string) {
  if (typeof window === 'undefined' || !slug) return
  const next = [slug, ...read().filter((s) => s !== slug)].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Nothing to do — the list is a convenience, not state we can't lose.
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onStoreChange: () => void) {
  const onChange = () => onStoreChange()
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

const EMPTY: string[] = []
let cached: string[] = EMPTY
let cachedRaw = ''

/** Stable array identity so useSyncExternalStore doesn't loop on a fresh parse. */
function snapshot(): string[] {
  if (typeof window === 'undefined') return EMPTY
  let raw = ''
  try {
    raw = localStorage.getItem(KEY) ?? ''
  } catch {
    raw = ''
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cached = read()
  }
  return cached
}

export function useRecentGames(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY)
}
