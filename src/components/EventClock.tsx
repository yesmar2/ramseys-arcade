import { useEffect, useState } from 'react'
import { formatEventCountdown } from '../lib/tournaments'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The time an event has left, as big figures with their units under them:
 * days, hours, minutes and seconds, ticking. Under a day it drops the days.
 */
export function EventClock({ endsAt, className }: { endsAt: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (endsAt <= Date.now()) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [endsAt])

  const secsLeft = Math.max(0, Math.floor((endsAt - now) / 1000))
  const days = Math.floor(secsLeft / 86_400)
  const units: [string, string][] = [
    ...(days > 0 ? [[String(days), days === 1 ? 'day' : 'days'] as [string, string]] : []),
    [pad(Math.floor((secsLeft % 86_400) / 3600)), 'hours'],
    [pad(Math.floor((secsLeft % 3600) / 60)), 'min'],
    [pad(secsLeft % 60), 'sec'],
  ]

  return (
    <div className={`evp-clock${className ? ` ${className}` : ''}`} role="timer" aria-label={formatEventCountdown(endsAt, now)}>
      {units.map(([value, unit]) => (
        <span key={unit} className="evp-clock__unit" aria-hidden="true">
          <b>{value}</b>
          <span>{unit}</span>
        </span>
      ))}
    </div>
  )
}
