import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

type InfoTipProps = {
  label: string
  children: ReactNode
}

/** Compact “i” control — details on hover/focus, tap to pin open on touch. */
export function InfoTip({ label, children }: InfoTipProps) {
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span
      ref={rootRef}
      className={`info-tip${open ? ' info-tip--open' : ''}`}
    >
      <button
        type="button"
        className="info-tip__btn"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        i
      </button>
      <span className="info-tip__panel" id={id} role="tooltip">
        {children}
      </span>
    </span>
  )
}
