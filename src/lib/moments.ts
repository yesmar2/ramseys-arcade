/*
 * The whole-screen moments shown once (a Dailies streak milestone, a week won among friends): which ones this
 * device has shown, so another page or a reload doesn't show one again. Each is kept by a key that names the
 * account and the moment; only the newest few dozen are kept. With storage off, once a visit.
 */

const SEEN_KEY = 'skermix-moments-seen'
const KEEP = 40

/** Shown this visit: what's remembered when storage is off. */
const seenNow = new Set<string>()

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((key): key is string => typeof key === 'string') : []
  } catch {
    return []
  }
}

export function momentSeen(key: string): boolean {
  return seenNow.has(key) || readSeen().includes(key)
}

export function markMomentsSeen(keys: readonly string[]) {
  for (const key of keys) seenNow.add(key)
  try {
    const kept = readSeen().filter((key) => !keys.includes(key))
    localStorage.setItem(SEEN_KEY, JSON.stringify([...kept, ...keys].slice(-KEEP)))
  } catch {
    /* storage may be off: once a visit */
  }
}

/** Whether a panel is up now: a moment waits for it to close rather than land on top of it. */
export function panelOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('.panel-layer') != null
}

/** The moment on screen now, if any. */
let holder: string | null = null

/** One moment at a time: the first to claim the screen shows, and the others wait for it to close. */
export function claimMoment(id: string): boolean {
  if (holder && holder !== id) return false
  holder = id
  return true
}

export function releaseMoment(id: string) {
  if (holder === id) holder = null
}
