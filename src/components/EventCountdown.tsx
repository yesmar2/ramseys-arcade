import { useEffect, useState } from 'react'
import { formatEventCountdown, formatEventTicker } from '../lib/tournaments'

type EventCountdownProps = {
  endsAt: number
  unlimitedDuration?: boolean
  className?: string
  /** Tick every second and show HH:MM:SS. */
  precise?: boolean
}

/** Live countdown. Coarse by default; precise mode is a second-by-second ticker. */
export function EventCountdown({
  endsAt,
  unlimitedDuration = false,
  className,
  precise = false,
}: EventCountdownProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (unlimitedDuration) return
    if (endsAt - Date.now() <= 0) return
    const tick = () => setNow(Date.now())
    const intervalMs = precise ? 1_000 : 30_000
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [endsAt, unlimitedDuration, precise])

  const text = precise
    ? formatEventTicker(endsAt, now, unlimitedDuration)
    : formatEventCountdown(endsAt, now, unlimitedDuration)

  return <span className={className}>{text}</span>
}
