/*
 * The service worker keeps each page's and game's files for offline play the first time they're used (src/sw.ts).
 * On a first visit it isn't in charge until this page has loaded, so what the page fetched went past it. Once it
 * takes over, it's handed those addresses and keeps them, from the browser's own copies rather than the network.
 *
 * Only on a first visit: a page a worker was already in charge of fetched everything through it, and when a release's
 * worker takes over from the last one, this page's files are the last release's, which the new worker has already
 * brought under their new names.
 */

export function bootOfflineCopy() {
  const workers = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker
  if (!workers || workers.controller) return
  try {
    // Room for a long first visit's files (250 by default), so none are missing when the worker takes over.
    performance.setResourceTimingBufferSize(1000)
  } catch {
    /* the default still holds a first page */
  }
  workers.addEventListener(
    'controllerchange',
    () => {
      const urls = loadedHere()
      // Workbox's router answers CACHE_URLS by fetching each one through its route.
      if (urls.length) workers.controller?.postMessage({ type: 'CACHE_URLS', payload: { urlsToCache: urls } })
    },
    { once: true },
  )
}

/** The site's own built files and fonts this page has fetched. */
function loadedHere(): string[] {
  const urls = new Set<string>()
  for (const entry of performance.getEntriesByType('resource')) {
    try {
      const url = new URL(entry.name)
      if (url.origin !== location.origin) continue
      if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) urls.add(url.href)
    } catch {
      /* not an address */
    }
  }
  return [...urls]
}
