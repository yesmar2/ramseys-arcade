import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ScoreRow } from '../data/scoring'

type HowToPlayContentProps = {
  how: string
  rows?: ScoreRow[] | null
  /** Scoring list style — lobby accordion vs in-game modal. */
  listClassName?: string
}

/** Shared how-to + scoring rows for lobby accordion and in-game modal. */
export function HowToPlayContent({
  how,
  rows,
  listClassName = 'game-lobby__scoring',
}: HowToPlayContentProps) {
  const scoring = rows?.length ? rows : null
  return (
    <>
      <p className="how-to-play__copy">{how}</p>
      {scoring ? (
        <ul className={listClassName}>
          {scoring.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

type HowToPlayAccordionProps = {
  how: string
  rows?: ScoreRow[] | null
}

/** Collapsible How to play on the game hub. */
export function HowToPlayAccordion({ how, rows }: HowToPlayAccordionProps) {
  return (
    <details className="rank-page__how game-lobby__how-panel">
      <summary className="rank-page__how-summary">
        <span className="rank-page__h" id="game-how-heading">
          How to play
        </span>
      </summary>
      <div className="rank-page__how-body">
        <HowToPlayContent how={how} rows={rows} />
      </div>
    </details>
  )
}

type ScoreGuideProps = {
  how: string
  rows?: ScoreRow[] | null
}

/** In-game How to play modal (pause / HUD info). */
export function ScoreGuide({ how, rows }: ScoreGuideProps) {
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
              <HowToPlayContent how={how} rows={rows} listClassName="patriot__info-list" />
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
        aria-label="How to play"
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
