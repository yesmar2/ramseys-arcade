const DISMISS_KEY = 'acralia-pwa-install-dismissed'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

/** Call once at app boot so we don't miss the browser event. */
export function bootPwaInstall() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', ((e: Event) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  }) as EventListener)
  window.addEventListener('appinstalled', () => {
    deferred = null
    try {
      localStorage.removeItem(DISMISS_KEY)
    } catch {
      /* ignore */
    }
    notify()
  })
}

export function subscribePwaInstall(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function getDeferredInstallPrompt() {
  return deferred
}

export function isPwaInstalled() {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)')
  if (mq.matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return Boolean(nav.standalone)
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const chromeOrCriOS = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return iOS && webkit && !chromeOrCriOS
}

export function wasInstallDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissInstallPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
  notify()
}

export async function promptPwaInstall() {
  const event = deferred
  if (!event) return false
  deferred = null
  notify()
  await event.prompt()
  const choice = await event.userChoice
  return choice.outcome === 'accepted'
}
