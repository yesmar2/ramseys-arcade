import { authHeaders } from './auth'

/**
 * The inbox.
 *
 * Everything the arcade wants to tell you lands here. Only bracket match
 * clocks and a friend beating your challenge are ever also pushed to a
 * device — see `push.ts`.
 */
export type NotificationKind =
  | 'match-open'
  | 'match-closing'
  | 'record-lost'
  | 'friend-request'
  | 'friend-accepted'
  | 'trophy'
  | 'event-result'
  | 'challenge-beaten'
  | 'challenge-taken'

/** Who and what a notification is about, for drawing its row. Every field is optional. */
export type NotificationMeta = {
  /** The other player, and their avatar. */
  actor?: string
  actorAvatarId?: string
  /** The game it's about. */
  game?: string
  /** Where its main button goes, when that isn't its own link. */
  playHref?: string
  /** A bracket match's deadline. */
  endsAt?: number
  eventId?: string
  matchId?: string
  trophy?: { period: 'weekly' | 'monthly' | 'event'; rank: number }
  /** Flair the trophy unlocked. */
  ring?: string
  pin?: string
  /** An event finished below first. */
  place?: number
  field?: number
  /** A friend request still waiting for an answer. */
  requestId?: string
}

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  href: string | null
  /** How many times it has been told; the inbox doesn't show it. */
  count: number
  createdAt: number
  updatedAt: number
  readAt: number | null
  /** Set once there's nothing left to do about it: a request answered. */
  resolvedAt: number | null
  meta: NotificationMeta
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
  const body = await call<{ notifications: AppNotification[]; unread: number }>('/notifications')
  return {
    unread: body.unread,
    notifications: body.notifications.map((n) => ({ ...n, resolvedAt: n.resolvedAt ?? null, meta: n.meta ?? {} })),
  }
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

/* ------------------------------------------------------------ reading --- */

const MATCH_KINDS: ReadonlySet<NotificationKind> = new Set(['match-open', 'match-closing'])

export function isMatch(n: AppNotification): boolean {
  return MATCH_KINDS.has(n.kind)
}

/** Waiting on you: a match on the clock, or a request to answer. It stays on top until it's done. */
export function needsYou(n: AppNotification, now = Date.now()): boolean {
  if (n.resolvedAt) return false
  if (n.kind === 'friend-request') return Boolean(n.meta.requestId)
  if (isMatch(n)) return (n.meta.endsAt ?? 0) > now
  return false
}

/** Under three hours to go: said in the hot colour. */
export function isClosing(n: AppNotification, now = Date.now()): boolean {
  const endsAt = n.meta.endsAt
  return isMatch(n) && endsAt != null && endsAt > now && endsAt - now <= 3 * 3_600_000
}

/** Time left, the way a person says it: 2 hours, 45 minutes. */
export function timeLeftWords(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  if (minutes < 60) return minutes === 1 ? '1 minute' : `${minutes} minutes`
  const hours = Math.round(minutes / 60)
  return hours === 1 ? '1 hour' : `${hours} hours`
}

/** A match alert's title as of now: the time left moves, the words filed with it don't. */
export function liveTitle(n: AppNotification, now = Date.now()): string {
  const { endsAt, actor } = n.meta
  if (isMatch(n) && endsAt != null && actor && endsAt > now && (n.kind === 'match-closing' || isClosing(n, now))) {
    return `${timeLeftWords(endsAt - now)} left against ${actor}`
  }
  return n.title
}

/** The clock on a match row: 1:58:12, or 2d 4h when it's days away. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86_400)
  const h = Math.floor((total % 86_400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (days > 0) return `${days}d ${h}h`
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export type InboxGroups = {
  needs: AppNotification[]
  fresh: AppNotification[]
  today: AppNotification[]
  earlier: AppNotification[]
}

function startOfToday(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * The inbox in the order it's read: what needs you (soonest clock first),
 * what's new since you last looked, then the rest by day.
 */
export function groupInbox(items: AppNotification[], isFresh: (n: AppNotification) => boolean, now = Date.now()): InboxGroups {
  const groups: InboxGroups = { needs: [], fresh: [], today: [], earlier: [] }
  const today = startOfToday(now)
  for (const n of items) {
    if (needsYou(n, now)) groups.needs.push(n)
    else if (isFresh(n)) groups.fresh.push(n)
    else if (n.updatedAt >= today) groups.today.push(n)
    else groups.earlier.push(n)
  }
  const deadline = (n: AppNotification) => n.meta.endsAt ?? Number.POSITIVE_INFINITY
  groups.needs.sort((a, b) => deadline(a) - deadline(b) || b.updatedAt - a.updatedAt)
  return groups
}

/**
 * The menu row's line: the most pressing thing, then the next and a count.
 * "2 hours left against PANDA" / "ETTA wants to be friends, and 3 more".
 */
export function inboxSummary(items: AppNotification[], now = Date.now()): { lead: string; hot: boolean; rest: string | null } | null {
  const { needs } = groupInbox(items, () => false, now)
  const unread = items.filter((n) => !n.readAt && !needs.includes(n))
  const queue = [...needs, ...unread]
  const first = queue[0]
  if (!first) return null
  const second = queue[1]
  const more = queue.length - 2
  return {
    lead: liveTitle(first, now),
    hot: isClosing(first, now),
    rest: second ? `${liveTitle(second, now)}${more > 0 ? `, and ${more} more` : ''}` : null,
  }
}

export function formatNotificationTime(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return new Date(at).toLocaleDateString('en-US', { weekday: 'short' })
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
