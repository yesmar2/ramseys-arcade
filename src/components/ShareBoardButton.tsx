import { useEffect, useRef, useState } from 'react'

type ShareBoardButtonProps = {
  /** Short line for share sheet / clipboard, e.g. "Play Asteroids on Acralia" */
  label: string
  /**
   * Hash path (`#/games/asteroids`), absolute URL, or omit for the current page.
   * Hash paths become full links so they work when pasted outside the app.
   */
  url?: string
  className?: string
}

/** Build a pasteable absolute URL for a hash route (or pass-through https URLs). */
export function absoluteShareUrl(url?: string): string {
  if (typeof window === 'undefined') return url ?? ''
  if (!url) return window.location.href
  if (/^https?:\/\//i.test(url)) return url
  const hash = url.startsWith('#') ? url : `#/${url.replace(/^\//, '')}`
  return `${window.location.origin}${window.location.pathname}${hash}`
}

function ShareIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg className="lb-share__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M9.55 17.65 4.9 13l1.4-1.4 3.25 3.25L17.7 6.7l1.4 1.4z"
        />
      </svg>
    )
  }
  return (
    <svg className="lb-share__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11A2.99 2.99 0 0 0 18 7.91c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81A2.99 2.99 0 0 0 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"
      />
    </svg>
  )
}

/** Clipboard fallback that still works when the async Clipboard API is blocked. */
function copyText(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.setAttribute('aria-hidden', 'true')
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function ShareBoardButton({ label, url, className = '' }: ShareBoardButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [])

  const markCopied = () => {
    setCopied(true)
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  const fallbackCopy = (href: string) => {
    const text = `${label}\n${href}`
    // Prefer sync copy first so we still have the user-gesture on iOS after a
    // failed navigator.share() await.
    if (copyText(text)) {
      markCopied()
      return
    }
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(text)
        .then(markCopied)
        .catch(() => {
          /* ignore */
        })
    }
  }

  const share = async () => {
    const href = absoluteShareUrl(url)
    // iOS/Android: title + url only. Including the same string as `text` can
    // make canShare fail or share throw on some browsers.
    const data: ShareData = { title: label, url: href }

    if (typeof navigator.share === 'function') {
      try {
        if (typeof navigator.canShare !== 'function' || navigator.canShare(data)) {
          await navigator.share(data)
          return
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Fall through to copy if share is unavailable/denied.
      }
    }

    fallbackCopy(href)
  }

  return (
    <button
      type="button"
      className={`lb-share${className ? ` ${className}` : ''}`}
      aria-label={copied ? 'Link copied' : `Share: ${label}`}
      title={copied ? 'Copied' : 'Share'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void share()
      }}
      onPointerUp={(e) => {
        // Keep the control from being swallowed by parent gesture handlers.
        e.stopPropagation()
      }}
    >
      <ShareIcon copied={copied} />
    </button>
  )
}
