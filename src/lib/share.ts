import { detectDeviceType } from './device'

/*
 * Sending something on, one way on every page. On a phone or a tablet the
 * device's own share sheet opens, which is where people's chats are. On a
 * computer it goes straight to the clipboard and the button says "Copied":
 * a computer's own sheet (Windows', a Mac's) mostly offers apps nobody chats
 * in, and Windows drops the words when a link goes with them. When neither
 * works, useShare (SharePanel.tsx) opens the kit's panel: the words, the
 * link with Copy, and the usual places.
 */

/** What goes out: the words, and the link on its own line after them, unless the words already end with it. */
export type ShareMessage = { text: string; url?: string }

/** How long a button says "Copied". */
export const COPIED_MS = 2000

/** The words and the link as one, for the clipboard and the places that take a single body. */
export function shareBody({ text, url }: ShareMessage): string {
  return url ? `${text}\n${url}` : text
}

/** Whether this device sends things on through its own share sheet: a phone or a tablet that has one. */
export function usesShareSheet(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && detectDeviceType() !== 'desktop'
}

/** Copy text the old way, which works inside the tap that asked on every browser. Focus goes back where it was. */
export function copyText(text: string): boolean {
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.setAttribute('aria-hidden', 'true')
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;'
    document.body.appendChild(ta)
    ta.focus({ preventScroll: true })
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  } finally {
    before?.focus({ preventScroll: true })
  }
}

/** Copy text: the old way first, then the clipboard's own, which can still work once the tap has run out. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (copyText(text)) return true
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'failed'

/**
 * Send a message on: the share sheet on a phone or a tablet, the clipboard on
 * a computer, or the clipboard when the sheet won't open (it needs the tap
 * that asked for it, and a slow network can outlast that). 'failed' when
 * nothing worked, for the caller's panel. Call it straight from the tap.
 */
export async function shareOrCopy(message: ShareMessage): Promise<ShareOutcome> {
  if (usesShareSheet()) {
    try {
      await navigator.share(message.url ? { title: message.text, text: message.text, url: message.url } : { text: message.text })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }
  return (await copyToClipboard(shareBody(message))) ? 'copied' : 'failed'
}
