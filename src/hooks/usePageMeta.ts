import { useEffect } from 'react'
import type { Route } from './useHashRoute'
import { pageMeta, siteOrigin, type PageMeta } from '../lib/pageMeta'

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

/** Keep the document's title, description and share tags in step with the route. */
export function usePageMeta(route: Route) {
  useEffect(() => {
    applyPageMeta(pageMeta(route))
  }, [route])
}
