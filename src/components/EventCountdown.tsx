import { useEffect, useState } from 'react'
import { formatEventCountdown } from '../lib/tournaments'

type EventCountdownProps = {
  endsAt: number
  unlimitedDuration?: boolean
  className?: string
}

/** Live countdown that refreshes every 30s. */
export function EventCountdown({ endsAt, unlimitedDuration = false, className }: EventCountdownProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (unlimitedDuration) return
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [unlimitedDuration])

  return (
    <span className={className}>{formatEventCountdown(endsAt, now, unlimitedDuration)}</span>
  )
}
