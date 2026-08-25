import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ScoreRow } from '../data/scoring'

type ScoreGuideProps = {
  how: string
  rows?: ScoreRow[] | null
  /** Icon for pause / chrome; summary matches the lobby How to play control. */
  trigger?: 'icon' | 'summary'
}

/** Shared How to play panel — lobby summary and in-game info button. */
export function ScoreGuide({
  how,
  rows,
  trigger = 'icon',
}: ScoreGuideProps) {
  const [open, setOpen] = useState(false)
  const scoring = rows?.length ? rows : null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="score-guide__backdrop"
            onPointerDown={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          >
            <div
              className="patriot__info-panel"
              role="dialog"
              aria-label="How to play"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="patriot__info-head">
                <span className="patriot__label">How to play</span>
                <button
                  type="button"
                  className="patriot__info-close"
                  aria-label="Close how to play"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              <p className="how-to-play__copy">{how}</p>
              {scoring ? (
                <ul className="patriot__info-list">
                  {scoring.map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null

  const openBtn =
    trigger === 'summary' ? (
      <button
        type="button"
        className="how-to-play__summary"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="how-to-play__summary-label">How to play</span>
      </button>
    ) : (
      <button
        type="button"
        className="patriot__info"
        aria-label="How to play"
        aria-expanded={open}
        onPointerDown={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        i
      </button>
    )

  return (
    <>
      {openBtn}
      {panel}
    </>
  )
}
