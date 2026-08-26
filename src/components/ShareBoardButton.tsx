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

export function ShareBoardButton({ label, url, className = '' }: ShareBoardButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [])

  const share = async () => {
    const href = absoluteShareUrl(url)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: label, text: label, url: href })
        return
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${label}\n${href}`)
      setCopied(true)
      if (timer.current != null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className={`lb-share${className ? ` ${className}` : ''}`}
      onClick={() => void share()}
    >
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}
