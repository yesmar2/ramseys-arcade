import { API_BASE } from './auth'

/*
 * The API can run as more than one server, each with its own copy of the
 * boards and events, told of the others' changes half a second later. The
 * answer to a change says where it sits in the servers' shared feed
 * (X-Feed-Id), and for a few seconds after, every request to the API says it
 * back (X-Feed-After): a server that hasn't read that far reads the feed
 * before it answers, so a player always sees what they just did, whichever
 * server answers. With one server nothing comes back, so nothing is sent.
 *
 * Every API call goes through fetch, so this wraps it once rather than each
 * of the lib files' own request helpers. Kept for the tab (sessionStorage), so
 * a reload straight after a save still says it.
 */
const HOLD_MS = 15_000
const KEY = 'skermix-feed-after'

let after = 0
let heardAt = 0

function remember() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ id: after, at: heardAt }))
  } catch {
    /* private mode or storage off: this tab still has it */
  }
}

function recall() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { id?: number; at?: number } | null
    if (saved && Number(saved.id) > 0 && Date.now() - Number(saved.at) < HOLD_MS) {
      after = Number(saved.id)
      heardAt = Number(saved.at)
    }
  } catch {
    /* nothing kept */
  }
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

export function bootFeedSync() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return
  recall()
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!urlOf(input).startsWith(API_BASE)) return original(input, init)
    let sent = init
    if (after && Date.now() - heardAt < HOLD_MS) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      headers.set('X-Feed-After', String(after))
      sent = { ...init, headers }
    }
    const res = await original(input, sent)
    const id = Number(res.headers.get('X-Feed-Id'))
    if (id > after) {
      after = id
      heardAt = Date.now()
      remember()
    }
    return res
  }
}
