import { API_BASE } from './auth'

/*
 * Where a player came from, for paid ads and any other link worth counting (Ramsey, 2026-11-17: "why are we not
 * looking into the route of putting an ad out"). A link carries a tag: blipka.com/games/lander/play?src=rd-lander.
 * The device keeps the first tag it came in on, and the tag comes out of the address, so a link copied from here
 * doesn't count as the ad again. Then the device tells the API (its sources.ts), once each:
 *   arrive  the first visit on the tag
 *   stay    that first day, the page stayed open a minute: a fair sign they played
 *   back    the first later day they came back
 *   day     each later day they came back
 * Only the tag and which of the four, never an account, address or device id. The admin page's "Where players
 * came from" card counts them.
 */

const KEY = 'skermix-src'
/** A tag as links carry it (the API's sources.ts TAG). */
const TAG = /^[a-z0-9][a-z0-9-]{0,23}$/
const STAY_MS = 60_000

type SourceKind = 'arrive' | 'stay' | 'back' | 'day'
/** The tag this device came in on, the day it did (YYYY-MM-DD), and what it has said since. */
type Kept = { src: string; first: string; stay?: boolean; back?: boolean; last?: string }

/** Today on the boards (New York), YYYY-MM-DD. */
function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function read(): Kept | null {
  try {
    const raw = localStorage.getItem(KEY)
    const kept = raw ? (JSON.parse(raw) as Kept) : null
    return kept && TAG.test(kept.src) && typeof kept.first === 'string' ? kept : null
  } catch {
    return null
  }
}

function write(kept: Kept) {
  try {
    localStorage.setItem(KEY, JSON.stringify(kept))
  } catch {
    /* storage off: this visit counts, later ones can't be told apart */
  }
}

/** Sent and forgotten, as a share's count is (lib/share.ts noteShare). */
function note(src: string, kind: SourceKind) {
  try {
    void fetch(`${API_BASE}/sources`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src, kind }),
    }).catch(() => {})
  } catch {
    /* a count must never get in the site's way */
  }
}

/** The address's ?src= taken out of it, the rest kept: its tag, when it's a good one. */
function takeTag(): string | null {
  const url = new URL(window.location.href)
  const raw = url.searchParams.get('src')
  if (raw == null) return null
  url.searchParams.delete('src')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  const tag = raw.trim().toLowerCase()
  return TAG.test(tag) ? tag : null
}

/** Call once, before the router reads the address: keep a tagged link's tag, and say where this visit stands. */
export function bootSource() {
  if (typeof window === 'undefined') return
  try {
    const tag = takeTag()
    const day = today()
    let kept = read()
    if (!kept && tag) {
      kept = { src: tag, first: day }
      write(kept)
      note(tag, 'arrive')
    }
    if (!kept) return
    if (kept.first === day) {
      if (kept.stay) return
      const src = kept.src
      window.setTimeout(() => {
        const now = read()
        if (!now || now.stay || now.src !== src) return
        write({ ...now, stay: true })
        note(src, 'stay')
      }, STAY_MS)
      return
    }
    if (kept.last === day) return
    write({ ...kept, back: true, last: day })
    if (!kept.back) note(kept.src, 'back')
    note(kept.src, 'day')
  } catch {
    /* a count must never get in the site's way */
  }
}
