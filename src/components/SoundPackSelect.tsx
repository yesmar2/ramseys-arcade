import { useEffect, useState } from 'react'
import {
  cycleSoundPack,
  getSoundPack,
  SOUND_PACK_EVENT,
  SOUND_PACK_LABELS,
  sfx,
  unlockSound,
  type SoundPackId,
} from '../lib/sound'

type SoundPackSelectProps = {
  /** Compact cycle button for pause toolbar. */
  variant?: 'cycle' | 'menu'
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
