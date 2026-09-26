import { API_BASE } from './auth'
import { ApiError } from './leaderboard'

/*
 * When something breaks in a player's browser, the API hears about it
 * (POST /client-errors) and an admin reads it on /admin. What goes: the
 * error's message and the top of its stack, the page's path (without the
 * query or hash, which can carry invite codes) and the build. Nothing about
 * who.
 *
 * Production builds only, at most five a page load, each error once. Left
 * out is what isn't ours to fix: browser extensions, other sites' scripts, a
 * dropped connection, a chunk from before a release (that one reloads,
 * main.tsx), and API refusals, which the API logs itself.
 */

const MAX_PER_LOAD = 5

/** The commit the build came from; Vercel hands it to Vite builds. */
const RELEASE = String(import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7)

const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Failed to fetch|NetworkError|Load failed|network connection was lost/i,
  /dynamically imported module|Importing a module script failed/i,
  /AbortError|operation was aborted|signal is aborted/i,
]

const NOT_OURS = /(chrome|moz|safari(-web)?)-extension:\/\/|\/_vercel\/insights\//

let sent = 0
const seen = new Set<string>()

/** Tell the API what broke. Never throws. */
export function reportError(error: unknown, source?: string) {
  if (!import.meta.env.PROD || sent >= MAX_PER_LOAD) return
  if (error instanceof ApiError) return
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '')).slice(0, 500)
  const stack = error instanceof Error ? String(error.stack ?? '').slice(0, 4000) : ''
  if (!message.trim() || NOISE.some((re) => re.test(message))) return
  if (NOT_OURS.test(`${source ?? ''}\n${stack}`)) return
  if (seen.has(message)) return
  seen.add(message)
  sent += 1
  try {
    void fetch(`${API_BASE}/client-errors`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stack, path: window.location.pathname, release: RELEASE }),
    }).catch(() => {})
  } catch {
    /* a report must never break the page it's reporting on */
  }
}

/** Uncaught errors and unhandled rejections, from here on. */
export function bootErrorReports() {
  if (!import.meta.env.PROD) return
  window.addEventListener('error', (event) => reportError(event.error ?? event.message, event.filename))
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason))
}
