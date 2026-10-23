/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { APP_NAME } from './lib/brand'

/**
 * Custom service worker.
 *
 * Everything below `precache` is what the generated worker used to do for us;
 * it is written out by hand now because a generated worker cannot receive a
 * `push` event, and bracket match clocks are the one thing worth pushing.
 */

declare const self: ServiceWorkerGlobalScope

/*
 * The list is every file the release built. The app's shell (index.html and what it loads to start) is installed
 * with the worker. The rest is marked LATER (vite.config.ts shellOnly) and kept below as it's used.
 */
const LATER = 'later'
const listed = self.__WB_MANIFEST
const isLater = (entry: string | PrecacheEntry): entry is PrecacheEntry =>
  typeof entry !== 'string' && entry.revision === LATER
precacheAndRoute(listed.filter((entry) => !isLater(entry)))
cleanupOutdatedCaches()

/*
 * Every other file a release builds (a page, a game, its pictures and sounds) is kept the first time it's used, so
 * it plays offline from then on. A new visitor's phone downloads the pages it opens, not every game. Their names
 * change whenever what's in them does, so a kept copy never needs checking. The page hands over what it loaded before
 * this worker took charge (lib/offlineCopy.ts), which Workbox's router keeps through these same routes.
 */
const KEPT = 'blipka-kept'
/** This release's files outside the shell, as paths ("/assets/…"). */
const LATER_FILES = new Set(listed.filter(isLater).map((entry) => `/${entry.url}`))
/** A built file's name without its hash, which stays the same from one release to the next. */
const nameOf = (path: string) => path.replace(/-[\w-]{8,}(\.\w+)$/, '$1')

const ownFolder = (folder: string) => ({ url }: { url: URL }) =>
  url.origin === self.location.origin && url.pathname.startsWith(folder)

registerRoute(ownFolder('/assets/'), async ({ request, event }) => {
  const cache = await caches.open(KEPT)
  const kept = await cache.match(request)
  if (kept) return kept
  const response = await fetch(request)
  if (response.status === 200) event.waitUntil(cache.put(request, response.clone()).catch(() => {}))
  return response
})

// The font keeps its name when it changes, so the kept copy is served while a fresh one is fetched for next time.
const FONTS = 'blipka-fonts'
registerRoute(ownFolder('/fonts/'), async ({ request, event }) => {
  const cache = await caches.open(FONTS)
  const kept = await cache.match(request)
  const fresh = fetch(request).then(async (response) => {
    if (response.status === 200) await cache.put(request, response.clone()).catch(() => {})
    return response
  })
  if (!kept) return fresh
  event.waitUntil(fresh.then(() => undefined, () => undefined))
  return kept
})

/*
 * A release renames the files whose insides changed. What this device kept and this release renamed (in a game
 * it has played) comes again under its new name before this worker takes over, so the game still plays offline.
 * A name several files share (each game's preview.js) brings each of them this device hasn't kept: a few small
 * files more.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(KEPT).then(async (cache) => {
      const kept = new Set((await cache.keys()).map((request) => new URL(request.url).pathname))
      const renamed = new Set([...kept].filter((path) => !LATER_FILES.has(path)).map(nameOf))
      const wanted = [...LATER_FILES].filter((path) => !kept.has(path) && renamed.has(nameOf(path)))
      for (let i = 0; i < wanted.length; i += 6) {
        await Promise.all(wanted.slice(i, i + 6).map((path) => cache.add(path).catch(() => {})))
      }
    }),
  )
})

// Once this worker is in charge, what past releases built and this one didn't goes.
self.addEventListener('activate', (event) => {
  if (!LATER_FILES.size) return
  event.waitUntil(
    caches.open(KEPT).then(async (cache) => {
      for (const request of await cache.keys()) {
        if (!LATER_FILES.has(new URL(request.url).pathname)) await cache.delete(request)
      }
    }),
  )
})

/*
 * A page opened by address (or reloaded) asks the server first, and opens the installed shell only offline, on a
 * server error, or when the server takes longer than SHELL_WAIT. Opening the installed shell first opened the
 * release before the last one until this worker's successor had installed itself: its pages' files are gone from
 * the server, so a page not opened before broke on every reload until then (Ramsey, 2026-10-23: "pressed it like
 * 5 times and it finally loaded"). The server's answer starts while this worker wakes (navigation preload).
 * Not the pages the server answers itself, the coming-soon page and the gate's /__gate (middleware.js), which
 * always go to the server.
 */
const SHELL_WAIT = 3000
const installedShell = createHandlerBoundToURL('/index.html')
registerRoute(
  new NavigationRoute(
    async (options) => {
      const event = options.event as FetchEvent
      const preloaded = Promise.resolve(event.preloadResponse).catch(() => undefined)
      event.waitUntil(preloaded)
      try {
        const fresh = await Promise.race([
          preloaded.then((response) => (response as Response | undefined) ?? fetch(options.request)),
          new Promise<undefined>((done) => setTimeout(done, SHELL_WAIT)),
        ])
        // A redirect (to the site's own address) comes back opaque, status 0, and the browser follows it.
        if (fresh && fresh.status < 500) return fresh
      } catch {
        /* offline */
      }
      return installedShell(options)
    },
    { denylist: [/^\/soon\.html(?:\?|$)/, /^\/__gate(?:\?|$)/] },
  ),
)

self.addEventListener('activate', (event) => {
  if (self.registration.navigationPreload) event.waitUntil(self.registration.navigationPreload.enable())
})

// Matches the old `registerType: 'autoUpdate'` behaviour.
self.skipWaiting()
clientsClaim()

type PushBody = {
  title?: string
  body?: string
  href?: string
  kind?: string
  /** One per alert: the same match again replaces its card, a different one gets its own. */
  tag?: string
}

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload: PushBody = {}
  try {
    payload = event.data.json() as PushBody
  } catch {
    payload = { title: event.data.text() }
  }

  const title = payload.title?.trim() || APP_NAME
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || undefined,
      icon: '/pwa-192.png',
      // Android draws the badge from its shape alone: the blip and its ring, not the square around them.
      badge: '/badge-96.png',
      // Collapse repeats of the same alert rather than stacking them; a tag by
      // kind alone let a second match's alert replace the first.
      tag: payload.tag ?? payload.kind ?? 'skermix',
      // Shipped everywhere push is, but not yet in TS's NotificationOptions.
      renotify: true,
      data: { href: payload.href ?? '/' },
    } as NotificationOptions),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = (event.notification.data as { href?: string } | undefined)?.href ?? '/'
  const target = new URL(href, self.location.origin).href

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      // Reuse a tab that is already open rather than piling up windows.
      for (const client of clientList) {
        if (new URL(client.url).origin !== self.location.origin) continue
        await client.focus()
        if ('navigate' in client) await client.navigate(target)
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
