import { useEffect, useState } from 'react'
import { formatEventCountdown } from '../lib/tournaments'

type EventCountdownProps = {
  endsAt: number
  className?: string
}

/** Live countdown that refreshes every 30s. */
export function EventCountdown({ endsAt, className }: EventCountdownProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  return <span className={className}>{formatEventCountdown(endsAt, now)}</span>
}
