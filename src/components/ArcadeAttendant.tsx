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
        <svg viewBox="0 0 96 112" className="arcade-attendant__svg">
          {/* Cap */}
          <ellipse cx="48" cy="22" rx="28" ry="10" fill="#2a3a4a" />
          <rect x="20" y="14" width="56" height="14" rx="4" fill="#3d5166" />
          <rect x="36" y="8" width="24" height="10" rx="3" fill="#4aa8e8" />
          {/* Head */}
          <circle cx="48" cy="40" r="22" fill="#f0d2b0" />
          {/* Eyes */}
          <circle cx="40" cy="38" r="3.2" fill="#1a2b3c" />
          <circle cx="56" cy="38" r="3.2" fill="#1a2b3c" />
          <circle cx="41" cy="37" r="1" fill="#fff" />
          <circle cx="57" cy="37" r="1" fill="#fff" />
          {/* Brow raise */}
          <path
            d="M34 32c3-2 7-2 10 0"
            fill="none"
            stroke="#1a2b3c"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M52 32c3-2 7-2 10 0"
            fill="none"
            stroke="#1a2b3c"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Smile */}
          <path
            d="M40 48c3 4 13 4 16 0"
            fill="none"
            stroke="#1a2b3c"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Body / jacket */}
          <path
            d="M24 66c4-10 16-14 24-14s20 4 24 14v36H24V66z"
            fill="#2eb8a0"
          />
          <path d="M48 52v50" stroke="#1a8f7a" strokeWidth="3" />
          {/* Badge */}
          <circle cx="62" cy="72" r="6" fill="#ffe9b8" />
          <text
            x="62"
            y="75"
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            fill="#1a2b3c"
          >
            A
          </text>
          {/* Arm wave */}
          <g className="arcade-attendant__wave">
            <path
              d="M72 70c10 2 14 12 10 18"
              fill="none"
              stroke="#f0d2b0"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>
    </div>
  )
}
