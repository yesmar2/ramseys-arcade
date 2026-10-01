import { saveNotificationLevels, type NotificationTopic } from './notificationSettings'
import { enablePush, fetchPushStatus, needsHomeScreen, pushPermission, pushSupported, type EnableResult, type PushStatus } from './push'

/*
 * Asking for alerts, the soft way.
 *
 * The browser's own question ("show notifications?") is asked once: a Block is for good, and a site that
 * asks on arrival is mostly blocked. So nothing asks on a page load. The arcade asks with its own card, at
 * the moment an alert is plainly worth having, and only a yes there brings up the browser's question:
 *   - 'streak': a Dailies day just kept. An alert before the day ends, on a day not kept yet.
 *   - 'challenge': a challenge just sent. An alert when the friend beats it.
 *   - 'match': a bracket event just joined. An alert when a match opens and before it closes.
 *
 * Not now holds every ask back on this device for a week, except that a streak reaching three days brings
 * the streak's ask back once: there's more to lose by then. Alerts turned off with the inbox's switch stop
 * the asks for good; the switch is still there. On an iPhone, alerts need the site on the Home Screen
 * first, so the card says how instead.
 */

export type AskReason = 'streak' | 'challenge' | 'match'

/** What a yes turns to Push, on top of turning alerts on for this device (the API's notificationSettings.ts). */
const TOPICS: Record<AskReason, NotificationTopic[]> = {
  streak: ['streak-risk'],
  challenge: ['challenge-beaten'],
  match: ['match-open', 'match-closing'],
}

const KEY = 'skermix-push-ask'
/** Not now holds the asks back this long. */
const SNOOZE_MS = 7 * 86_400_000
/** A streak this long brings the streak's ask back early, once, after a Not now said before it. */
export const STREAK_ASK_AGAIN = 3

type Stored = {
  /** When Not now was last said, and the streak then. */
  at?: number
  streak?: number
  /** Alerts were turned off here by hand. */
  off?: boolean
}

function read(): Stored {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Stored) : {}
  } catch {
    return {}
  }
}

function write(next: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: it asks again another time */
  }
}

/** Not now: no asks on this device for a week. */
export function snoozeAsks(streak = 0, now = Date.now()) {
  write({ ...read(), at: now, streak })
}

/** Alerts turned off with the switch: the cards stop asking on this device. */
export function noteAlertsTurnedOff() {
  write({ ...read(), off: true })
}

/** Turned back on with the switch: the cards may ask again for what's new (a challenge's alert, say). */
export function noteAlertsTurnedOn() {
  const { off: _off, ...rest } = read()
  write(rest)
}

export function asksHeldBack(reason: AskReason, streak = 0, now = Date.now()): boolean {
  const s = read()
  if (s.off) return true
  if (s.at == null || now - s.at >= SNOOZE_MS) return false
  // A Not now said before day three doesn't hold once the streak gets there.
  if (reason === 'streak' && streak >= STREAK_ASK_AGAIN && (s.streak ?? 0) < STREAK_ASK_AGAIN) return false
  return true
}

/** Whether this browser already sends alerts here: allowed, and subscribed. */
async function alertsOnHere(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return Boolean(await registration?.pushManager.getSubscription())
  } catch {
    return false
  }
}

/** Whether the server can push at all, asked once a page. */
let serverStatus: Promise<PushStatus | null> | null = null
function serverCanPush(): Promise<boolean> {
  serverStatus ??= fetchPushStatus().catch(() => {
    serverStatus = null
    return null
  })
  return serverStatus.then((s) => Boolean(s?.available))
}

/** How to ask here: the card with Remind me, or (an iPhone in Safari) how to put the site on the Home Screen. */
export type AskMode = 'ask' | 'home-screen'

/** Whether to ask on this device now, and how; null not to. For a signed-in player only: alerts are an account's. */
export async function askMode(reason: AskReason, streak = 0): Promise<AskMode | null> {
  if (asksHeldBack(reason, streak)) return null
  const install = needsHomeScreen()
  if (!install && (!pushSupported() || pushPermission() === 'denied')) return null
  if (await alertsOnHere()) return null
  if (!(await serverCanPush())) return null
  return install ? 'home-screen' : 'ask'
}

/**
 * Yes: the browser's own question first (it must follow the tap at once), then the reason's alerts set to
 * Push. A player who had them in the inbox only has just asked for them here.
 */
export async function acceptAsk(reason: AskReason): Promise<EnableResult> {
  const result = await enablePush()
  if (result.ok) {
    noteAlertsTurnedOn()
    const levels = Object.fromEntries(TOPICS[reason].map((topic) => [topic, 'push'])) as Partial<Record<NotificationTopic, 'push'>>
    await saveNotificationLevels(levels).catch(() => undefined)
  }
  return result
}
