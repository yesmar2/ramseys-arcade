import { useEffect, useState } from 'react'
import { isMusicOn, MUSIC_EVENT, setMusicOn, unlockSound } from '../lib/sound'

type MusicToggleProps = {
  /** A round button for a game's panel, On/Off for the menu, a row for the drawer. */
  variant?: 'button' | 'seg' | 'drawer'
  className?: string
}

function useMusicOn() {
  const [on, setOn] = useState(isMusicOn)
  useEffect(() => {
    const sync = () => setOn(isMusicOn())
    window.addEventListener(MUSIC_EVENT, sync)
    return () => window.removeEventListener(MUSIC_EVENT, sync)
  }, [])
  return on
}

function NoteIcon({ off }: { off: boolean }) {
  return (
    <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 17.5V6.2l10-2v11.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="6.8" cy="17.5" r="2.3" fill="currentColor" />
      <circle cx="16.8" cy="15.5" r="2.3" fill="currentColor" />
      {off ? <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : null}
    </svg>
  )
}

/** The music under the games, on or off; the sounds are the mute button's. */
export function MusicToggle({ variant = 'button', className = '' }: MusicToggleProps) {
  const on = useMusicOn()
  const set = (next: boolean) => {
    unlockSound()
    setMusicOn(next)
  }

  if (variant === 'seg') {
    return (
      <div className={className} role="group" aria-label="Music">
        <button type="button" aria-pressed={on} onClick={() => set(true)}>
          On
        </button>
        <button type="button" aria-pressed={!on} onClick={() => set(false)}>
          Off
        </button>
      </div>
    )
  }

  if (variant === 'drawer') {
    return (
      <button type="button" className={`site-drawer__pref${className ? ` ${className}` : ''}`} onClick={() => set(!on)}>
        <span className="site-drawer__pref-label">Music</span>
        <span className="site-drawer__pref-value">{on ? 'On' : 'Off'}</span>
      </button>
    )
  }

  return (
    <div className={`game-sound${className ? ` ${className}` : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="game-pause-btn"
        aria-label={on ? 'Turn the music off' : 'Turn the music on'}
        aria-pressed={on}
        title={on ? 'Music on' : 'Music off'}
        onClick={(e) => {
          e.stopPropagation()
          set(!on)
        }}
      >
        <NoteIcon off={!on} />
      </button>
    </div>
  )
}
