import { useEffect, useState } from 'react'
import {
  cycleSoundPack,
  getSoundPack,
  setSoundPack,
  SOUND_PACK_EVENT,
  SOUND_PACK_IDS,
  SOUND_PACK_LABELS,
  sfx,
  unlockSound,
  type SoundPackId,
} from '../lib/sound'

type SoundPackSelectProps = {
  /** Compact cycle button for pause toolbar; chips lay every pack out to pick from. */
  variant?: 'cycle' | 'menu' | 'drawer' | 'chips'
  className?: string
  onPicked?: (pack: SoundPackId) => void
}

export function SoundPackSelect({
  variant = 'cycle',
  className = '',
  onPicked,
}: SoundPackSelectProps) {
  const [pack, setPack] = useState<SoundPackId>(getSoundPack)

  useEffect(() => {
    const sync = () => setPack(getSoundPack())
    window.addEventListener(SOUND_PACK_EVENT, sync)
    return () => window.removeEventListener(SOUND_PACK_EVENT, sync)
  }, [])

  const pick = () => {
    unlockSound()
    const next = cycleSoundPack()
    setPack(next)
    sfx('good')
    onPicked?.(next)
  }

  const label = SOUND_PACK_LABELS[pack]

  if (variant === 'chips') {
    const choose = (next: SoundPackId) => {
      if (next === pack) return
      unlockSound()
      setSoundPack(next)
      setPack(next)
      sfx('good')
      onPicked?.(next)
    }
    return (
      <div className={`chips${className ? ` ${className}` : ''}`} role="group" aria-label="Sounds">
        {SOUND_PACK_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`chips__item${pack === id ? ' chips__item--active' : ''}`}
            aria-pressed={pack === id}
            onClick={() => choose(id)}
          >
            {SOUND_PACK_LABELS[id]}
          </button>
        ))}
      </div>
    )
  }

  if (variant === 'drawer') {
    return (
      <button
        type="button"
        className={`site-drawer__pref${className ? ` ${className}` : ''}`}
        onClick={() => {
          pick()
        }}
      >
        <span className="site-drawer__pref-label">Sounds</span>
        <span className="site-drawer__pref-value">{label}</span>
      </button>
    )
  }

  if (variant === 'menu') {
    return (
      <button
        type="button"
        role="menuitem"
        className={className}
        onClick={() => {
          pick()
        }}
      >
        Sounds · {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`game-pause-btn sound-pack-btn${className ? ` ${className}` : ''}`}
      aria-label={`Sound pack: ${label}. Click to change.`}
      title={`Sounds: ${label}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        pick()
      }}
    >
      <span className="sound-pack-btn__label">{label}</span>
    </button>
  )
}
