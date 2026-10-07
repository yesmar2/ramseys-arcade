import { useEffect, useRef } from 'react'
import { useShare } from './SharePanel'

type ShareBoardButtonProps = {
  /** Clever line for share sheet / clipboard / Messages / email — not link-only. */
  label: string
  /**
   * In-app path (`/games/asteroids`), absolute URL, or omit for the current page.
   * Paths become full links so they work when pasted outside the app.
   */
  url?: string
  className?: string
  /** Optional visible label beside the icon, for a pill rather than a round button. */
  text?: string
}

/** Build a pasteable absolute URL for an in-app path (or pass-through https URLs). */
export function absoluteShareUrl(url?: string): string {
  if (typeof window === 'undefined') return url ?? ''
  if (!url) return window.location.href
  if (/^https?:\/\//i.test(url)) return url
  // Old `#/…` hrefs mean the same path.
  const path = url.replace(/^#/, '')
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`
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

/** A page's Share: the share sheet on a phone or a tablet, copied on a computer (useShare). */
export function ShareBoardButton({ label, url, className = '', text }: ShareBoardButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const labelRef = useRef(label)
  const urlRef = useRef(url)
  const { share, copied, panel } = useShare()

  labelRef.current = label
  urlRef.current = url

  // A native listener, so the button's own tap is what opens the share sheet even inside a link or a card.
  useEffect(() => {
    const btn = buttonRef.current
    if (!btn) return
    const onClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      share({ text: labelRef.current, url: absoluteShareUrl(urlRef.current) })
    }
    btn.addEventListener('click', onClick)
    return () => btn.removeEventListener('click', onClick)
  }, [share])

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
        {text ? <span className="lb-share__text">{copied ? 'Copied' : text}</span> : null}
      </button>
      {panel}
    </>
  )
}
