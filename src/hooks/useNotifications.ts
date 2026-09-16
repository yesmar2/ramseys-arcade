import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchNotifications,
  markNotificationsRead,
  type AppNotification,
} from '../lib/notifications'

/** How often the badge re-checks while the tab is in front. */
const POLL_MS = 60_000

/**
 * The inbox, kept roughly current.
 *
 * Polling is deliberately lazy: a hidden tab stops entirely, and the one alert
 * that is actually time-critical arrives by push instead of by poll.
 */
export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const loaded = useRef(false)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const body = await fetchNotifications()
      setItems(body.notifications)
      setUnread(body.unread)
      loaded.current = true
    } catch {
      // A missing inbox is not worth an error state in the header.
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setItems([])
      setUnread(0)
      loaded.current = false
      return
    }
    let cancelled = false
    const tick = () => {
      if (cancelled || document.hidden) return
      void refresh()
    }

    setLoading(!loaded.current)
    void refresh().finally(() => {
      if (!cancelled) setLoading(false)
    })

    const timer = window.setInterval(tick, POLL_MS)
    // Coming back to the tab is the moment a stale badge is most obvious.
    document.addEventListener('visibilitychange', tick)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [enabled, refresh])

  const markAllRead = useCallback(async () => {
    if (unread === 0) return
    // Optimistic: the badge should clear the instant the panel opens.
    const now = Date.now()
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })))
    setUnread(0)
    try {
      await markNotificationsRead()
    } catch {
      void refresh()
    }
  }, [unread, refresh])

  return { items, unread, loading, refresh, markAllRead }
}
