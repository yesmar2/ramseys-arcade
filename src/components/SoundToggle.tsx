import { useEffect, useState } from 'react'
import {
  acquireMusic,
  isMuted,
  releaseMusic,
  setMuted,
  unlockSound,
} from '../lib/sound'

export function SoundToggle() {
  const [mute, setMute] = useState(isMuted)

  useEffect(() => {
    acquireMusic()
    return () => releaseMusic()
  }, [])

  return (
    <div
      className="game-sound"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="game-pause-btn"
        aria-label={mute ? 'Unmute music and sounds' : 'Mute music and sounds'}
        aria-pressed={mute}
        title={mute ? 'Unmute' : 'Mute'}
        onClick={(e) => {
          e.stopPropagation()
          unlockSound()
          const next = !mute
          setMuted(next)
          setMute(next)
        }}
      >
        {mute ? (
          <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 10v4h3.2L12 18.5V5.5L7.2 10H4z"
              fill="currentColor"
            />
            <path
              d="M15.2 9.2l5.6 5.6M20.8 9.2l-5.6 5.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 10v4h3.2L12 18.5V5.5L7.2 10H4z"
              fill="currentColor"
            />
            <path
              d="M15.2 9.4a3.4 3.4 0 0 1 0 5.2M17.6 7.2a6.4 6.4 0 0 1 0 9.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </div>
  )
}
