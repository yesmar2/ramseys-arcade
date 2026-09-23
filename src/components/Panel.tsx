import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

/*
 * One way to float over the page: the panel every modal on the site is
 * drawn in. It sits on a dimmed, softly blurred scrim, keeps its close in
 * the same corner, and on a phone rises from the bottom edge as a sheet.
 * While it is open it has the keyboard to itself: Esc closes it, Tab goes
 * round its own buttons, and nothing it is pressed reaches a game behind
 * it. When it closes, focus goes back where it was.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type PanelProps = {
  onClose: () => void
  /** The id of the panel's title, or a label when it has none to show. */
  labelledBy?: string
  label?: string
  describedBy?: string
  /** A question that wants an answer: read out as one, and a press on the scrim does not dismiss it. */
  alert?: boolean
  /** Wider, for a studio with more to arrange. */
  wide?: boolean
  /** Whether a press outside closes it. Off for questions and anything with typing in it. */
  scrimCloses?: boolean
  /** Where focus lands when it opens; otherwise its first button. */
  initialFocus?: RefObject<HTMLElement | null>
  /** Colour tokens, usually a game's from gameAccentStyle. */
  style?: CSSProperties
  className?: string
  children: ReactNode
}

export function Panel({
  onClose,
  labelledBy,
  label,
  describedBy,
  alert = false,
  wide = false,
  scrimCloses = !alert,
  initialFocus,
  style,
  className,
  children,
}: PanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const root = ref.current
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = initialFocus?.current ?? root?.querySelector<HTMLElement>(FOCUSABLE) ?? root
    first?.focus({ preventScroll: true })

    // Esc and Tab are the panel's own, taken before anything else sees them.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !root) return
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) {
        e.preventDefault()
        return
      }
      const at = items.indexOf(document.activeElement as HTMLElement)
      const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === items.length - 1 || at < 0 ? 0 : at + 1
      e.preventDefault()
      items[next]!.focus()
    }
    // Every other key does what it does inside the panel, then goes no further: a game listening
    // on the window behind it never hears Space start a run or an arrow turn a ship.
    const hush = (e: KeyboardEvent) => e.stopPropagation()
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('keydown', hush)

    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('keydown', hush)
      document.body.style.overflow = overflow
      if (before?.isConnected) before.focus({ preventScroll: true })
    }
  }, [initialFocus])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="panel-layer" onPointerDown={(e) => e.stopPropagation()}>
      <div
        className="panel-scrim"
        aria-hidden="true"
        onClick={scrimCloses ? () => onCloseRef.current() : undefined}
      />
      <div
        ref={ref}
        className={`panel${wide ? ' panel--wide' : ''}${className ? ` ${className}` : ''}`}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-describedby={describedBy}
        tabIndex={-1}
        style={style}
      >
        <span className="panel__grab" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** The head every panel shares: an optional kicker and icon, the title, and the close in the corner. */
export function PanelHead({
  titleId,
  title,
  kicker,
  icon,
  onClose,
  closeLabel = 'Close',
}: {
  titleId: string
  title: ReactNode
  kicker?: ReactNode
  icon?: ReactNode
  onClose?: () => void
  closeLabel?: string
}) {
  return (
    <div className="panel__head">
      <div className="panel__heading">
        {icon ? <span className="panel__icon">{icon}</span> : null}
        {kicker ? <span className="panel__kicker">{kicker}</span> : null}
        <h2 id={titleId} className="panel__title">
          {title}
        </h2>
      </div>
      {onClose ? (
        <button type="button" className="panel__close" aria-label={closeLabel} onClick={onClose}>
          <CloseIcon />
        </button>
      ) : null}
    </div>
  )
}
