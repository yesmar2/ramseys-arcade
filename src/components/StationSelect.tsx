import { useEffect, useState } from 'react'
import { cycleStation, getStation, setStation, STATION_EVENT, STATION_IDS, STATION_LABELS, type StationId } from '../lib/musicStations'
import { unlockSound } from '../lib/sound'
import '../styles/nowPlaying.css'

type StationSelectProps = {
  /** Every station to pick from (the menu, the music sheet), or a row that steps through them (the drawer). */
  variant?: 'chips' | 'drawer'
  className?: string
}

/** The music's station, for every game at once: Arcade, 8-bit, Chill or Piano. */
export function StationSelect({ variant = 'chips', className = '' }: StationSelectProps) {
  const [station, setLocal] = useState<StationId>(getStation)

  useEffect(() => {
    const sync = () => setLocal(getStation())
    window.addEventListener(STATION_EVENT, sync)
    return () => window.removeEventListener(STATION_EVENT, sync)
  }, [])

  if (variant === 'drawer') {
    return (
      <button
        type="button"
        className={`site-drawer__pref${className ? ` ${className}` : ''}`}
        onClick={() => {
          unlockSound()
          cycleStation()
        }}
      >
        <span className="site-drawer__pref-label">Station</span>
        <span className="site-drawer__pref-value">{STATION_LABELS[station]}</span>
      </button>
    )
  }

  return (
    <div className={`chips${className ? ` ${className}` : ''}`} role="group" aria-label="Music station">
      {STATION_IDS.map((id) => (
        <button
          key={id}
          type="button"
          className={`chips__item${station === id ? ' chips__item--active' : ''}`}
          aria-pressed={station === id}
          onClick={() => {
            if (id === station) return
            unlockSound()
            setStation(id)
          }}
        >
          {STATION_LABELS[id]}
        </button>
      ))}
    </div>
  )
}
