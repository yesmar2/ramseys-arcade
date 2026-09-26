import { api, getLastPlayerName, normalizePlayerName } from './leaderboard'

/*
 * Telling the arcade something: an idea or a game you'd like, or something
 * that broke. Any page can open the Tell us panel (openFeedback); the site
 * header holds it (FeedbackHost). What's sent goes to the API, which keeps it
 * for the admin page, with the page it came from.
 */

export type FeedbackKind = 'idea' | 'problem'

const OPEN_EVENT = 'arcade-feedback'

export function openFeedback(kind: FeedbackKind = 'idea') {
  window.dispatchEvent(new CustomEvent<FeedbackKind>(OPEN_EVENT, { detail: kind }))
}

export function onOpenFeedback(listener: (kind: FeedbackKind) => void) {
  const handler = (e: Event) => listener((e as CustomEvent<FeedbackKind>).detail ?? 'idea')
  window.addEventListener(OPEN_EVENT, handler)
  return () => window.removeEventListener(OPEN_EVENT, handler)
}

export async function sendFeedback(kind: FeedbackKind, message: string): Promise<void> {
  const name = normalizePlayerName(getLastPlayerName())
  await api<{ kept: true }>('/feedback', {
    method: 'POST',
    body: JSON.stringify({ kind, message, path: window.location.pathname, ...(name ? { name } : {}) }),
  })
}
