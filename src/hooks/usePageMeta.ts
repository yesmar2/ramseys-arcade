import { useEffect } from 'react'
import { currentRoute, type Route } from './useHashRoute'
import { pageMeta, siteOrigin, titled, type PageMeta } from '../lib/pageMeta'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove()
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function applyPageMeta(meta: PageMeta) {
  const origin = siteOrigin()
  const url = `${origin}${meta.path}`
  document.title = meta.title
  upsertMeta('name', 'description', meta.description)
  upsertMeta('property', 'og:title', meta.title)
  upsertMeta('property', 'og:description', meta.description)
  upsertMeta('property', 'og:url', url)
  upsertMeta('property', 'og:image', `${origin}${meta.image}`)
  upsertLink('canonical', url)
  if (meta.noindex) upsertMeta('name', 'robots', 'noindex')
  else removeMeta('name', 'robots')
}

/**
 * The names pages have given themselves once what they're about has come (a group's, an event's), by the path
 * each is known by. The route alone knows only "Group" or "Event", so two open side by side had the same tab.
 */
const ownNames = new Map<string, string>()

/** The route's tags, titled with the page's own name where it has given one. */
function metaFor(route: Route): PageMeta {
  const meta = pageMeta(route)
  const name = ownNames.get(meta.path)
  return name ? { ...meta, title: titled(name) } : meta
}

/** Keep the document's title, description and share tags in step with the route. */
export function usePageMeta(route: Route) {
  useEffect(() => {
    applyPageMeta(metaFor(route))
  }, [route])
}

/**
 * A page's own name in its tab, once it has loaded: "OFFICE · Blipka" where the route alone gave "Group · Blipka".
 * It stays through the page's own changes of address (a period picked on it) and goes with the page.
 */
export function usePageName(name: string | null | undefined) {
  useEffect(() => {
    if (!name) return
    const route = currentRoute()
    const path = pageMeta(route).path
    ownNames.set(path, name)
    applyPageMeta(metaFor(route))
    return () => {
      if (ownNames.get(path) === name) ownNames.delete(path)
    }
  }, [name])
}
