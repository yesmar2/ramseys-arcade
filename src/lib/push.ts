import { authHeaders } from './auth'

/**
 * Opting a device in to bracket match alerts.
 *
 * Push is the only notification channel that can interrupt someone, so it
 * carries only the alerts that expire: your match opened, your match is about
 * to close. Everything else lives in the inbox.
 */

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

export type PushStatus = {
  /** Server has VAPID keys configured. */
  available: boolean
  enabled: boolean
  devices: number
}

/**
 * Whether this browser can receive push at all.
 *
 * iOS is the catch: Safari only grants push to a site the user has added to
 * their home screen, so a plain tab reports support and then fails at the
 * permission prompt. {@link needsHomeScreen} separates those two cases.
 */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports as a Mac, but with touch points.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

/** True when the only thing stopping push is that iOS wants an install first. */
export function needsHomeScreen(): boolean {
  return isIos() && !isStandalone()
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function fetchPushStatus(): Promise<PushStatus> {
  return api('/notifications/push')
}

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * The active service worker, or null.
 *
 * `navigator.serviceWorker.ready` never settles when nothing is registered —
 * it waits forever rather than rejecting — so a plain await on it leaves the
 * caller hanging with no way to report why. Notably true in `vite dev` unless
 * the PWA plugin's devOptions are on.
 */
async function readyRegistration(
  timeoutMs = 4000,
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration()
  if (!existing) return null
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

export type EnableResult =
  | { ok: true; status: PushStatus }
  | {
      ok: false
      reason:
        | 'unsupported'
        | 'home-screen'
        | 'denied'
        | 'unavailable'
        | 'no-worker'
        | 'failed'
    }

export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) {
    return { ok: false, reason: needsHomeScreen() ? 'home-screen' : 'unsupported' }
  }
  if (needsHomeScreen()) return { ok: false, reason: 'home-screen' }

  /*
   * Ask before doing anything asynchronous.
   *
   * requestPermission() is only honoured inside the brief user-activation
   * window that follows the click. Fetching first burns that window — and on a
   * cold-starting host the fetch alone can outlast it, so the prompt would
   * silently never appear. Nothing is lost by asking first: the toggle only
   * renders once the server has said it can do push.
   */
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  let key: string
  try {
    const body = await api<{ key?: string }>('/notifications/push/key')
    if (!body.key) return { ok: false, reason: 'unavailable' }
    key = body.key
  } catch {
    return { ok: false, reason: 'unavailable' }
  }

  try {
    const registration = await readyRegistration()
    if (!registration) return { ok: false, reason: 'no-worker' }
    const existing = await registration.pushManager.getSubscription()
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      }))

    const json = subscription.toJSON() as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
      return { ok: false, reason: 'failed' }
    }

    const status = await api<PushStatus>('/notifications/push', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        // Lets the server hold alerts out of the middle of this device's night.
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })
    return { ok: true, status }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

export async function disablePush(): Promise<PushStatus> {
  let endpoint: string | undefined
  try {
    const registration = await readyRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      endpoint = subscription.endpoint
      await subscription.unsubscribe()
    }
  } catch {
    // Dropping the server row still stops delivery, so keep going.
  }
  return api<PushStatus>('/notifications/push', {
    method: 'DELETE',
    body: JSON.stringify(endpoint ? { endpoint } : {}),
  })
}
