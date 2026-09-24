import { useEffect, useState } from 'react'
import { getMusicVolume, isMusicOn, MUSIC_EVENT, setMusicOn, setMusicVolume, unlockSound } from '../lib/sound'

type MusicToggleProps = {
  /** Round, in a game's panel; a row in the menu; a row in the player drawer. */
  variant?: 'button' | 'seg' | 'drawer'
  className?: string
}

function useMusic() {
  const read = () => ({ on: isMusicOn(), volume: getMusicVolume() })
  const [state, setState] = useState(read)
  useEffect(() => {
    const sync = () => setState(read())
    window.addEventListener(MUSIC_EVENT, sync)
    return () => window.removeEventListener(MUSIC_EVENT, sync)
  }, [])
  return state
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

/**
 * The music under the games: the note turns it off and on, and the slider sets
 * how loud it is, down to off. The sounds are the mute button's.
 */
export function MusicToggle({ variant = 'button', className = '' }: MusicToggleProps) {
  const { on, volume } = useMusic()
  const percent = on ? Math.round(volume * 100) : 0
  const toggle = () => {
    unlockSound()
    setMusicOn(!on)
  }

  const slider = (
    <input
      type="range"
      className="music-level__slider"
      min={0}
      max={100}
      step={5}
      value={percent}
      aria-label="Music volume"
      aria-valuetext={percent ? `${percent}%` : 'Off'}
      // The games listen for keys on the window: arrows here move the slider, not a ship.
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        unlockSound()
        setMusicVolume(Number(e.target.value) / 100)
      }}
    />
  )

  const note = (
    <button
      type="button"
      className={variant === 'button' ? 'game-pause-btn' : 'music-level__note'}
      aria-label={on ? 'Turn the music off' : 'Turn the music on'}
      aria-pressed={on}
      title={on ? 'Music on' : 'Music off'}
      onClick={(e) => {
        e.stopPropagation()
        toggle()
      }}
    >
      <NoteIcon off={!on} />
    </button>
  )

  if (variant === 'drawer') {
    return (
      <div className={`site-drawer__pref music-level music-level--drawer${className ? ` ${className}` : ''}`}>
        <span className="site-drawer__pref-label">Music</span>
        <span className="music-level__controls">
          {note}
          {slider}
        </span>
      </div>
    )
  }

  if (variant === 'seg') {
    return (
      <div className={`music-level music-level--menu${className ? ` ${className}` : ''}`}>
        {note}
        {slider}
        <span className="music-level__value" aria-hidden="true">
          {percent ? `${percent}%` : 'Off'}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`game-sound music-level music-level--panel${className ? ` ${className}` : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {note}
      {slider}
    </div>
  )
}
