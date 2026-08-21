import { useEffect, useState } from 'react'
import {
  ATTENDANT_DELAY_MS,
  markAttendantShown,
  pickAttendantLine,
  shouldSummonAttendant,
} from '../lib/attendant'

type Phase = 'hidden' | 'in' | 'out'

export function ArcadeAttendant() {
  const [phase, setPhase] = useState<Phase>('hidden')
  const [line, setLine] = useState('')

  useEffect(() => {
    if (!shouldSummonAttendant()) return

    const showTimer = window.setTimeout(() => {
      setLine(pickAttendantLine())
      markAttendantShown()
      setPhase('in')
    }, ATTENDANT_DELAY_MS)

    return () => window.clearTimeout(showTimer)
  }, [])

  useEffect(() => {
    if (phase !== 'in') return
    const hideTimer = window.setTimeout(() => setPhase('out'), 9000)
    return () => window.clearTimeout(hideTimer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'out') return
    const done = window.setTimeout(() => setPhase('hidden'), 420)
    return () => window.clearTimeout(done)
  }, [phase])

  if (phase === 'hidden') return null

  return (
    <div
      className={`arcade-attendant arcade-attendant--${phase}`}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className="arcade-attendant__dismiss"
        aria-label="Dismiss attendant"
        onClick={() => setPhase('out')}
      >
        ×
      </button>

      <div className="arcade-attendant__bubble">
        <p>{line}</p>
      </div>

      <div className="arcade-attendant__figure" aria-hidden="true">
        <svg viewBox="0 0 64 72" className="arcade-attendant__svg">
          <circle cx="32" cy="22" r="16" fill="var(--accent-sky)" />
          <circle cx="26" cy="20" r="2.4" fill="var(--ink)" />
          <circle cx="38" cy="20" r="2.4" fill="var(--ink)" />
          <path
            d="M26 28c2.5 3 9.5 3 12 0"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="14" y="38" width="36" height="30" rx="12" fill="var(--accent)" />
          <circle cx="32" cy="52" r="4" fill="var(--accent-2)" />
        </svg>
      </div>
    </div>
  )
}
