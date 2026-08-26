import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ShareBoardButtonProps = {
  /** Short line for share sheet / clipboard, e.g. "Play Asteroids on Fordriva" */
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

function copyText(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.setAttribute('aria-hidden', 'true')
    ta.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;'
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
  const titleId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const labelRef = useRef(label)
  const urlRef = useRef(url)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [href, setHref] = useState('')
  const timer = useRef<number | null>(null)

  labelRef.current = label
  urlRef.current = url

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Native listener so Android Chrome keeps the user-gesture for navigator.share.
  // (A second share() in a .catch() after a failed payload loses that gesture.)
  useEffect(() => {
    const btn = buttonRef.current
    if (!btn) return

    const onClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const link = absoluteShareUrl(urlRef.current)
      const shareLabel = labelRef.current
      setHref(link)

      if (typeof navigator.share !== 'function') {
        setOpen(true)
        return
      }

      // One call only — matches CrazyGames-style "Sharing link" on Android.
      void navigator
        .share({
          title: shareLabel,
          url: link,
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setOpen(true)
        })
    }

    btn.addEventListener('click', onClick)
    return () => btn.removeEventListener('click', onClick)
  }, [])

  const markCopied = () => {
    setCopied(true)
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  const doCopy = (link: string) => {
    const text = `${label}\n${link}`
    if (copyText(text)) {
      markCopied()
      return
    }
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(markCopied).catch(() => {})
    }
  }

  const encoded = encodeURIComponent(href)
  const encodedLabel = encodeURIComponent(label)
  const encodedBody = encodeURIComponent(`${label}\n${href}`)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`lb-share${className ? ` ${className}` : ''}`}
        aria-label={copied ? 'Link copied' : `Share: ${label}`}
        title={copied ? 'Copied' : 'Share'}
      >
        <ShareIcon copied={copied} />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="share-sheet__backdrop"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                className="share-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="share-sheet__head">
                  <h2 id={titleId} className="share-sheet__title">
                    Share
                  </h2>
                  <button
                    type="button"
                    className="share-sheet__close"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <p className="share-sheet__label">{label}</p>
                <p className="share-sheet__url">{href}</p>
                <p className="share-sheet__hint">
                  System share wasn’t available. Pick an app below, or copy the
                  link.
                </p>

                <div className="share-sheet__actions">
                  <a className="share-sheet__btn" href={`sms:?&body=${encodedBody}`}>
                    Messages
                  </a>
                  <a
                    className="share-sheet__btn"
                    href={`mailto:?subject=${encodedLabel}&body=${encodedBody}`}
                  >
                    Email
                  </a>
                  <a
                    className="share-sheet__btn"
                    href={`https://twitter.com/intent/tweet?text=${encodedLabel}&url=${encoded}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    X / Twitter
                  </a>
                  <a
                    className="share-sheet__btn"
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Facebook
                  </a>
                  <a
                    className="share-sheet__btn"
                    href={`https://www.reddit.com/submit?url=${encoded}&title=${encodedLabel}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Reddit
                  </a>
                  <button
                    type="button"
                    className="share-sheet__btn share-sheet__btn--primary"
                    onClick={() => doCopy(href)}
                  >
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
