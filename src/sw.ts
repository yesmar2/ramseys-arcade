/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

/**
 * Custom service worker.
 *
 * Everything below `precache` is what the generated worker used to do for us;
 * it is written out by hand now because a generated worker cannot receive a
 * `push` event, and bracket match clocks are the one thing worth pushing.
 */

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Single-page app: anything not precached falls back to the shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Matches the old `registerType: 'autoUpdate'` behaviour.
self.skipWaiting()
clientsClaim()

type PushBody = {
  title?: string
  body?: string
  href?: string
  kind?: string
}

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload: PushBody = {}
  try {
    payload = event.data.json() as PushBody
  } catch {
    payload = { title: event.data.text() }
  }

  const title = payload.title?.trim() || 'Skermix'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || undefined,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      // Collapse repeats of the same match rather than stacking them.
      tag: payload.kind ?? 'skermix',
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
