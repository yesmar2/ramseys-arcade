import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type InfoTipProps = {
  label: string
  children: ReactNode
}

const VIEW_PAD = 10
const GAP = 8

/** Compact “i” control — details on hover/focus, tap to pin open on touch. */
export function InfoTip({ label, children }: InfoTipProps) {
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const visible = open || hover

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

  useLayoutEffect(() => {
    const panel = panelRef.current
    const btn = btnRef.current
    if (!panel || !btn) return
    if (!visible) {
      panel.style.removeProperty('--arrow-x')
      panel.classList.remove('info-tip__panel--below', 'info-tip__panel--placed')
      return
    }

    const place = () => {
      const br = btn.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const maxW = Math.min(panel.offsetWidth || 288, vw - VIEW_PAD * 2)
      panel.style.maxWidth = `${maxW}px`

      const pr = panel.getBoundingClientRect()
      const pw = Math.min(pr.width || maxW, vw - VIEW_PAD * 2)
      const ph = pr.height || panel.offsetHeight
      const spaceAbove = br.top - VIEW_PAD
      const spaceBelow = vh - br.bottom - VIEW_PAD
      const below = spaceAbove < ph + GAP && spaceBelow >= spaceAbove

      let left = br.left + br.width / 2 - pw / 2
      left = Math.max(VIEW_PAD, Math.min(left, vw - VIEW_PAD - pw))
      let top = below ? br.bottom + GAP : br.top - GAP - ph
      top = Math.max(VIEW_PAD, Math.min(top, vh - VIEW_PAD - ph))

      panel.style.left = `${Math.round(left)}px`
      panel.style.top = `${Math.round(top)}px`
      panel.style.setProperty('--arrow-x', `${Math.round(br.left + br.width / 2 - left)}px`)
      panel.classList.toggle('info-tip__panel--below', below)
      panel.classList.add('info-tip__panel--placed')
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [visible, children])

  return (
    <span
      ref={rootRef}
      className={`info-tip${visible ? ' info-tip--open' : ''}`}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setHover(true)
      }}
      onPointerLeave={() => setHover(false)}
    >
      <button
        ref={btnRef}
        type="button"
        className="info-tip__btn"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={visible}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
          setHover(false)
        }}
      >
        i
      </button>
      <span className="info-tip__panel" id={id} role="tooltip" ref={panelRef}>
        {children}
      </span>
    </span>
  )
}
