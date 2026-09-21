import { useState } from 'react'
import { hapticsOff, hapticsSupported, setHapticsOff } from '../lib/haptics'

/**
 * Sits beside the sound toggle, and only where there is something to toggle:
 * on a device with no vibration motor exposed — every iPhone, and any desktop —
 * this renders nothing rather than offering a switch that does nothing.
 */
export function HapticsToggle({ className = '' }: { className?: string } = {}) {
  const [supported] = useState(hapticsSupported)
  const [quiet, setQuiet] = useState(hapticsOff)

  if (!supported) return null

  return (
    <button
      type="button"
      className={`game-pause-btn${className ? ` ${className}` : ''}`}
      aria-label={quiet ? 'Turn vibration on' : 'Turn vibration off'}
      aria-pressed={!quiet}
      title={quiet ? 'Vibration off' : 'Vibration on'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        const next = !quiet
        setHapticsOff(next)
        setQuiet(next)
      }}
    >
      {quiet ? (
        <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8.5 5.5h7a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17V7a1.5 1.5 0 0 1 1.5-1.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M4 4l16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8.5 5.5h7a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17V7a1.5 1.5 0 0 1 1.5-1.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M3.5 9.5v5M20.5 9.5v5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
