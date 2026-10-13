/*
 * The coming-soon gate (middleware.js) stands in front of every page the server sends, but a browser whose
 * service worker kept the app opens it from that copy without asking the server. So once a visit the app asks
 * (GET /__gate) whether it may run here. It may not while the site is closed to this browser (no pass, or one
 * past its 30 days), nor on an old address once the site has its own (CANONICAL_HOST on Vercel). Either way
 * the kept copy is let go and the page comes fresh from the server: the coming-soon page, or the app at its
 * new address. Where nothing answers (the dev server, a deploy before the gate), nothing happens.
 */

type GateAnswer = { ok?: boolean; go?: string }

const RELOAD_KEY = 'skermix-gate-reload'

export function bootGate() {
  if (import.meta.env.DEV) return
  void fetch('/__gate', { cache: 'no-store', headers: { accept: 'application/json' } })
    .then((res) => (res.ok && res.headers.get('content-type')?.includes('application/json') ? (res.json() as Promise<GateAnswer>) : null))
    .then((answer) => {
      if (!answer || answer.ok !== false) return
      const { pathname, search, hash } = window.location
      if (answer.go && /^https:\/\/[a-z0-9.-]+$/i.test(answer.go)) {
        void leave(`${answer.go}${pathname}${search}${hash}`)
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
