import { isGameListed } from '../data/games'
import { TODAY_FROM as CAVE_FROM } from '../games/lander/daily'
import { TODAY_FROM as COURSE_FROM } from '../games/marblerun/daily'
import { API_BASE, authHeaders } from './auth'

/**
 * Notification settings: for each kind of note, whether it also alerts your devices (push), only waits in
 * the inbox, or isn't filed at all. The API keeps them per account and follows them when it files a note
 * or pushes one (its notificationSettings.ts). A topic you never touched follows the API's default: what
 * you can act on is pushed, and the rest waits in the inbox.
 */

export type NotificationLevel = 'push' | 'inbox' | 'off'

/**
 * A kind of note, except that a friend beating your lap on Today's Track, or your run on Today's Course or
 * Today's Cave, is apart from the hole, the Wanted and the pour: those you can still take back.
 */
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
  | 'streak-risk'
  | 'podium-lost'
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

/** Today's Course and Today's Cave are on the ticket, so their "beat you" notes come with the lap's: a run can be had again too. */
const COURSE_ON_TICKET = COURSE_FROM != null && isGameListed('marblerun')
const CAVE_ON_TICKET = CAVE_FROM != null && isGameListed('lander')
/** Where a lap or a run can be beaten and taken back: "Today’s Track or Today’s Course", and so on. */
const RUN_DAILIES = ['Today’s Track', ...(COURSE_ON_TICKET ? ['Today’s Course'] : []), ...(CAVE_ON_TICKET ? ['Today’s Cave'] : [])]
const runDailies = RUN_DAILIES.length > 2 ? `${RUN_DAILIES.slice(0, -1).join(', ')} or ${RUN_DAILIES.at(-1)}` : RUN_DAILIES.join(' or ')

export const TOPIC_GROUPS: readonly { title: string; topics: readonly TopicInfo[] }[] = [
  {
    title: 'Dailies',
    topics: [
      {
        topic: 'streak-risk',
        label: 'Your streak is about to end',
        hint: 'Once, before the day ends, on a day you haven’t kept yet. Never at night.',
        offWarning: 'A day you miss ends your streak, so keep an eye on the Dailies.',
      },
      COURSE_ON_TICKET || CAVE_ON_TICKET
        ? {
            topic: 'today-lap',
            label: 'A friend beats your lap or your run',
            hint: `On ${runDailies}, while there’s still time to take it back.`,
          }
        : {
            topic: 'today-lap',
            label: 'A friend beats your lap',
            hint: 'On Today’s Track, while there’s still time to take it back.',
          },
      {
        topic: 'podium-lost',
        label: 'You’re knocked off the podium',
        hint: `Out of the top three on ${runDailies}, while there’s still time to win it back, and its tickets.`,
      },
      // No row for the hole, the Wanted or the pour: those dailies are just for fun (data/games.ts Game.ranked),
      // so nobody is told they were beaten on them. The 'today-beaten' topic stays for notes already sent.
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
        hint: 'A trophy for your shelf, a secret found, a Dailies streak reward.',
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
