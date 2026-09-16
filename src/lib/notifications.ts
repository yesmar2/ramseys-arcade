import { authHeaders } from './auth'

/**
 * The inbox.
 *
 * Everything the arcade wants to tell you lands here. Only bracket match
 * clocks are ever also pushed to a device — see `push.ts`.
 */
export type NotificationKind =
  | 'match-open'
  | 'match-closing'
  | 'record-lost'
  | 'board-passed'
  | 'friend-request'
  | 'friend-accepted'
  | 'trophy'
  | 'event-result'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  href: string | null
  /** Repeats fold into one row; this is how many times it happened. */
  count: number
  createdAt: number
  updatedAt: number
  readAt: number | null
}

function resolveApiBase() {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (fromEnv && !fromEnv.includes('localhost')) return fromEnv
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:8787`
    }
  }
  return fromEnv || 'http://localhost:8787'
}

const API_BASE = resolveApiBase()

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return (await res.json()) as T
}

export async function fetchNotifications(): Promise<{
  notifications: AppNotification[]
  unread: number
}> {
  return call('/notifications')
}

export async function fetchUnreadCount(): Promise<number> {
  const body = await call<{ unread?: number }>('/notifications/unread')
  return body.unread ?? 0
}

/** Mark specific rows read, or the whole inbox when `ids` is omitted. */
export async function markNotificationsRead(ids?: string[]): Promise<number> {
  const body = await call<{ unread?: number }>('/notifications/read', {
    method: 'POST',
    body: JSON.stringify(ids?.length ? { ids } : {}),
  })
  return body.unread ?? 0
}

const ICONS: Record<NotificationKind, string> = {
  'match-open': '⚔️',
  'match-closing': '⏳',
  'record-lost': '📉',
  'board-passed': '📉',
  'friend-request': '👋',
  'friend-accepted': '🤝',
  trophy: '🏆',
  'event-result': '🎏',
}

export function notificationIcon(kind: NotificationKind): string {
  return ICONS[kind] ?? '•'
}

/** The two kinds that carry a clock, and so get more visual weight. */
export function isUrgent(kind: NotificationKind): boolean {
  return kind === 'match-open' || kind === 'match-closing'
}

export function formatNotificationTime(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
