import { useEffect, useRef, useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import {
  formatNotificationTime,
  isUrgent,
  notificationIcon,
  type AppNotification,
} from '../lib/notifications'
import { PushToggle } from './PushToggle'

function NotificationRow({ item }: { item: AppNotification }) {
  const className = [
    'notif',
    item.readAt ? '' : 'notif--unread',
    isUrgent(item.kind) ? 'notif--urgent' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const inner = (
    <>
      <span className="notif__icon" aria-hidden="true">
        {notificationIcon(item.kind)}
      </span>
      <span className="notif__body">
        <span className="notif__title">
          {item.title}
          {item.count > 1 ? <span className="notif__count">×{item.count}</span> : null}
        </span>
        {item.body ? <span className="notif__sub">{item.body}</span> : null}
        <span className="notif__when">{formatNotificationTime(item.updatedAt)}</span>
      </span>
    </>
  )

  if (!item.href) {
    return <li className={className}>{inner}</li>
  }
  return (
    <li>
      <a className={className} href={item.href}>
        {inner}
      </a>
    </li>
  )
}

/**
 * The inbox, in the header.
 *
 * Opening the panel marks everything read — the badge is there to say "there
 * is something new", not to be a task list the player has to clear.
 */
export function NotificationBell({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const { items, unread, loading, markAllRead } = useNotifications(enabled)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!enabled) return null

  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'

  return (
    <div className="site-header__notifs" ref={wrapRef}>
      <button
        type="button"
        className={`notif-bell${unread > 0 ? ' notif-bell--alert' : ''}`}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) void markAllRead()
        }}
      >
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
          <path
            className="notif-bell__shape"
            d="M10 2.4a4.6 4.6 0 0 0-4.6 4.6v2.6L4 12.3h12l-1.4-2.7V7A4.6 4.6 0 0 0 10 2.4Z"
          />
          <path className="notif-bell__clapper" d="M8.2 14.2a1.9 1.9 0 0 0 3.6 0" />
        </svg>
        {unread > 0 ? (
          <span className="notif-bell__count">{unread > 9 ? '9+' : unread}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <header className="notif-panel__head">
            <h2 className="notif-panel__title">Notifications</h2>
          </header>

          {loading && items.length === 0 ? (
            <p className="notif-panel__empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="notif-panel__empty">
              Nothing yet. Match clocks, record changes and friend requests land here.
            </p>
          ) : (
            <ul className="notif-panel__list">
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} />
              ))}
            </ul>
          )}

          <PushToggle />
        </div>
      ) : null}
    </div>
  )
}
