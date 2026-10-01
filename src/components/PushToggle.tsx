import { useEffect, useId, useRef, useState } from 'react'
import { notificationSettingsHref } from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import {
  disablePush,
  enablePush,
  fetchPushStatus,
  needsHomeScreen,
  pushPermission,
  pushSupported,
  type PushStatus,
} from '../lib/push'
import { noteAlertsTurnedOff, noteAlertsTurnedOn } from '../lib/pushAsk'

const REASONS: Record<string, string> = {
  'home-screen': `On iPhone, add ${APP_NAME} to your home screen first. Safari only allows alerts there.`,
  denied: 'Your browser is blocking notifications. Allow them in site settings, then try again.',
  unavailable: 'Push is not set up on this server yet.',
  unsupported: 'This browser cannot do push notifications.',
  'no-worker':
    'No service worker is running on this page, so there is nothing to receive alerts. On a dev server this is expected.',
  failed: 'Could not turn alerts on. Try again in a moment.',
}

/**
 * Alerts on this device, stated plainly.
 *
 * What they carry is the player's choice, kind by kind, on the Notifications
 * settings page. By default it's what they can act on: a match they could
 * lose by not playing, a friend beating their challenge or their lap on
 * Today's Track. Never at night. The inbox shows this under its list, and the
 * settings page at its top (`where`).
 */
export function PushToggle({
  where = 'inbox',
  onStatus,
  onNavigate,
}: {
  where?: 'inbox' | 'settings'
  /** Told what the server says about push, when it first answers and after every change. */
  onStatus?: (status: PushStatus | null) => void
  /** Leaving for the settings page from the inbox: whatever the inbox sits in closes. */
  onNavigate?: () => void
} = {}) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelId = useId()
  const tell = useRef(onStatus)
  tell.current = onStatus

  const update = (next: PushStatus | null) => {
    setStatus(next)
    tell.current?.(next)
  }

  useEffect(() => {
    let cancelled = false
    void fetchPushStatus()
      .then((s) => {
        if (cancelled) return
        setStatus(s)
        tell.current?.(s)
      })
      .catch(() => {
        if (!cancelled) tell.current?.(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!status?.available) return null

  const supported = pushSupported()
  const blocked = pushPermission() === 'denied'
  const install = needsHomeScreen()
  const on = status.enabled

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      if (on) {
        update(await disablePush())
        // Turned off by hand: the arcade's cards stop asking on this device (lib/pushAsk.ts).
        noteAlertsTurnedOff()
      } else {
        const result = await enablePush()
        if (result.ok) {
          update(result.status)
          noteAlertsTurnedOn()
        } else setError(REASONS[result.reason] ?? REASONS.failed!)
      }
    } catch {
      setError(REASONS.failed!)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`inbox-alerts${where === 'settings' ? ' inbox-alerts--settings' : ''}`}>
      <div className="inbox-alerts__row">
        <span className="inbox-alerts__mark" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            <path d="M10 2.4a4.6 4.6 0 0 0-4.6 4.6v2.6L4 12.3h12l-1.4-2.7V7A4.6 4.6 0 0 0 10 2.4Z" />
            <path d="M8.2 14.2a1.9 1.9 0 0 0 3.6 0" />
          </svg>
        </span>
        <span className="inbox-alerts__text">
          <span className="inbox-alerts__label" id={labelId}>
            Alerts on this device
          </span>
          {where === 'settings' ? (
            <span className="inbox-alerts__hint">
              Anything set to Push below comes here too. Nothing between 10pm and 8am, and no more than 8 a day.
            </span>
          ) : (
            <span className="inbox-alerts__hint">
              For what you pick in{' '}
              <a className="inbox-alerts__link" href={notificationSettingsHref()} onClick={onNavigate}>
                settings
              </a>
              . Nothing between 10pm and 8am.
            </span>
          )}
        </span>
        <button
          type="button"
          role="switch"
          className={`inbox-switch${on ? ' inbox-switch--on' : ''}`}
          disabled={busy || (!supported && !install)}
          onClick={() => void toggle()}
          aria-checked={on}
          aria-labelledby={labelId}
        >
          <span className="inbox-switch__knob" />
        </button>
      </div>
      {install ? (
        <p className="inbox-alerts__note">{REASONS['home-screen']}</p>
      ) : blocked && !on ? (
        <p className="inbox-alerts__note">{REASONS.denied}</p>
      ) : null}
      {error ? <p className="inbox-alerts__note inbox-alerts__note--err">{error}</p> : null}
    </div>
  )
}
