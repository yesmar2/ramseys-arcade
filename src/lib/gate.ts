import { ROUTE_EVENT } from '../hooks/useHashRoute'

/*
 * The coming-soon gate (middleware.js) stands in front of every page the server sends, but the app doesn't ask
 * the server for pages: a browser whose service worker kept it opens it from that copy, and an app already open
 * moves from page to page by itself. So the app asks (GET /__gate) whether it may run here: when it starts, and
 * again when it moves to another page or its tab comes back into view, at most every RECHECK_MS. It may not
 * while the site is closed to this browser (no pass, or one past its 30 days), nor on an old address once the
 * site has its own (CANONICAL_HOST on Vercel). Either way the kept copy is let go and the page comes fresh from
 * the server: the coming-soon page, or the app at its new address. Where nothing answers (the dev server, a
 * deploy before the gate), nothing happens.
 *
 * Ramsey closed the gate with the app open (2026-10-13) and could still go from page to page: that's why the
 * app asks again, and doesn't only ask when it starts.
 */

type GateAnswer = { ok?: boolean; go?: string }

const RELOAD_KEY = 'skermix-gate-reload'

/** How often an open app asks again: a click after the gate closes finds it within half a minute. */
const RECHECK_MS = 30_000

/**
 * The pages anyone may read with the gate closed, as the server lets them through (middleware.js OPEN): the
 * Privacy Policy and Terms, for Google's sign-in branding check and the payments sign-up (Ramsey, 2026-10-16).
 * There the app runs for a browser without a pass, and it hands any other page back to the server.
 */
const OPEN_PAGES = new Set(['/privacy', '/terms'])

const onOpenPage = () => OPEN_PAGES.has(window.location.pathname.replace(/\/+$/, ''))

let askedAt = 0

/** The gate said no on an open page: any other page this app moves to is the server's to answer. */
let closedHere = false

export function bootGate() {
  if (import.meta.env.DEV) return
  askGate()
  const again = () => {
    if (Date.now() - askedAt >= RECHECK_MS) askGate()
  }
  const moved = () => {
    // A whole load of the page it moved to, so the server sends the coming-soon page in its place.
    if (closedHere && !onOpenPage()) window.location.reload()
    else again()
  }
  window.addEventListener(ROUTE_EVENT, moved)
  window.addEventListener('popstate', moved)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') again()
  })
}

function askGate() {
  askedAt = Date.now()
  void fetch('/__gate', { cache: 'no-store', headers: { accept: 'application/json' } })
    .then((res) => (res.ok && res.headers.get('content-type')?.includes('application/json') ? (res.json() as Promise<GateAnswer>) : null))
    .then((answer) => {
      if (!answer || answer.ok !== false) return
      const { pathname, search, hash } = window.location
      if (answer.go && /^https:\/\/[a-z0-9.-]+$/i.test(answer.go)) {
        void leave(`${answer.go}${pathname}${search}${hash}`)
        return
      }
      // The Privacy Policy and Terms are for anyone: stay, and leave when the app moves off them.
      if (onOpenPage()) {
        closedHere = true
        return
      }
      // A server that says no while it serves the app would otherwise reload it forever.
      if (reloadedLately()) return
      void leave(null)
    })
    .catch(() => {})
}

function reloadedLately() {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) < 60_000) return true
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    /* storage off: reload once anyway */
  }
  return false
}

/** Lets the kept copy go (the worker and its caches), then loads `to`, or this page again, from the server. */
async function leave(to: string | null) {
  try {
    const workers = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(workers.map((worker) => worker.unregister()))
    if ('caches' in window) await Promise.all((await caches.keys()).map((name) => caches.delete(name)))
  } catch {
    /* nothing kept, or no way to look: go on */
  }
  if (to) window.location.replace(to)
  else window.location.reload()
}
