import { API_BASE, authHeaders } from './auth'

/**
 * Notification settings: for each kind of note, whether it also alerts your devices (push), only waits in
 * the inbox, or isn't filed at all. The API keeps them per account and follows them when it files a note
 * or pushes one (its notificationSettings.ts). A topic you never touched follows the API's default: what
 * you can act on is pushed, and the rest waits in the inbox.
 */

export type NotificationLevel = 'push' | 'inbox' | 'off'

/** A kind of note, except that a friend beating your lap on Today's Track is apart from the hole and the Wanted. */
export type NotificationTopic =
  | 'match-open'
  | 'match-closing'
  | 'event-result'
  | 'friend-request'
  | 'friend-accepted'
  | 'challenge-beaten'
  | 'challenge-taken'
  | 'today-lap'
  | 'today-beaten'
  | 'record-lost'
  | 'trophy'

export type NotificationLevels = Record<NotificationTopic, NotificationLevel>

export type TopicInfo = {
  topic: NotificationTopic
  label: string
  hint: string
  /** Said under the row while it's off, when turning it off can cost you something. */
  offWarning?: string
}

export const TOPIC_GROUPS: readonly { title: string; topics: readonly TopicInfo[] }[] = [
  {
    title: 'Today',
    topics: [
      {
        topic: 'today-lap',
        label: 'A friend beats your lap',
        hint: 'On Today’s Track, while there’s still time to take it back.',
      },
      {
        topic: 'today-beaten',
        label: 'A friend beats you on the hole or the Wanted',
        hint: 'Today’s Hole and Today’s Wanted count once a day, so this is just to know.',
      },
    ],
  },
  {
    title: 'Friends',
    topics: [
      {
        topic: 'challenge-beaten',
        label: 'A friend beats your challenge',
        hint: 'Their run comes back to you to beat.',
      },
      {
        topic: 'challenge-taken',
        label: 'A friend tries your challenge',
        hint: 'They fell short, and by how much.',
      },
      { topic: 'friend-request', label: 'Friend requests', hint: 'Someone wants to add you.' },
      { topic: 'friend-accepted', label: 'A request accepted', hint: 'Someone said yes to yours.' },
    ],
  },
  {
    title: 'Events',
    topics: [
      {
        topic: 'match-open',
        label: 'Your match opens',
        hint: 'A bracket match to play before its clock runs out.',
        offWarning: 'A match you don’t play is lost, so keep an eye on your events.',
      },
      {
        topic: 'match-closing',
        label: 'Your match is closing',
        hint: 'Time is running out on a match you haven’t played.',
        offWarning: 'A match you don’t play is lost, so keep an eye on your events.',
      },
      { topic: 'event-result', label: 'How an event ended', hint: 'Your place, once an event you played is over.' },
    ],
  },
  {
    title: 'Records and trophies',
    topics: [
      {
        topic: 'record-lost',
        label: 'Someone takes your record',
        hint: 'Who took it, by how much, and how long you held it.',
      },
      {
        topic: 'trophy',
        label: 'Trophies and rewards',
        hint: 'A trophy for your shelf, a secret found, a Today streak reward.',
      },
    ],
  },
]

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

/** Every topic's level: your choice, or the default where you haven't made one. */
export async function fetchNotificationLevels(): Promise<NotificationLevels> {
  return (await call<{ levels: NotificationLevels }>('/notifications/settings')).levels
}

/** Change some topics; the rest stay as they are. Answers with every topic's level after the change. */
export async function saveNotificationLevels(changes: Partial<NotificationLevels>): Promise<NotificationLevels> {
  const body = await call<{ levels: NotificationLevels }>('/notifications/settings', {
    method: 'PUT',
    body: JSON.stringify({ levels: changes }),
  })
  return body.levels
}
