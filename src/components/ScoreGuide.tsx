import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ScoreRow } from '../data/scoring'

export function ScoreGuide({ rows }: { rows: ScoreRow[] }) {
  const [open, setOpen] = useState(false)

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
              aria-label="How scoring works"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="patriot__info-head">
                <span className="patriot__label">Scoring</span>
                <button
                  type="button"
                  className="patriot__info-close"
                  aria-label="Close scoring info"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              <ul className="patriot__info-list">
                {rows.map((row) => (
                  <li key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        className="patriot__info"
        aria-label="Scoring info"
        aria-expanded={open}
        onPointerDown={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        i
      </button>
      {panel}
    </>
  )
}
