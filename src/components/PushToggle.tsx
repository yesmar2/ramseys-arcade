import { useEffect, useState } from 'react'
import {
  disablePush,
  enablePush,
  fetchPushStatus,
  needsHomeScreen,
  pushPermission,
  pushSupported,
  type PushStatus,
} from '../lib/push'

const REASONS: Record<string, string> = {
  'home-screen': 'On iPhone, add Skermix to your home screen first — Safari only allows alerts there.',
  denied: 'Your browser is blocking notifications. Allow them in site settings, then try again.',
  unavailable: 'Push is not set up on this server yet.',
  unsupported: 'This browser cannot do push notifications.',
  'no-worker':
    'No service worker is running on this page, so there is nothing to receive alerts. On a dev server this is expected.',
  failed: 'Could not turn alerts on. Try again in a moment.',
}

/**
 * The one opt-in, stated plainly.
 *
 * Every other notification in the arcade stays in the inbox above this, so the
 * promise here is narrow enough to keep: we will only ever buzz you about a
 * match you could lose by not showing up.
 */
export function PushToggle() {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchPushStatus()
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => undefined)
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
        setStatus(await disablePush())
      } else {
        const result = await enablePush()
        if (result.ok) setStatus(result.status)
        else setError(REASONS[result.reason] ?? REASONS.failed!)
      }
    } catch {
      setError(REASONS.failed!)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="notif-push">
      <div className="notif-push__row">
        <span className="notif-push__text">
          <span className="notif-push__label">Match alerts</span>
          <span className="notif-push__hint">
            The only thing we&rsquo;ll buzz you about: a bracket match you could lose by
            not showing up.
          </span>
        </span>
        <button
          type="button"
          className={`notif-push__btn${on ? ' notif-push__btn--on' : ''}`}
          disabled={busy || (!supported && !install)}
          onClick={() => void toggle()}
          aria-pressed={on}
        >
          {busy ? '…' : on ? 'On' : 'Turn on'}
        </button>
      </div>
      {install ? (
        <p className="notif-push__note">{REASONS['home-screen']}</p>
      ) : blocked && !on ? (
        <p className="notif-push__note">{REASONS.denied}</p>
      ) : null}
      {error ? <p className="notif-push__note notif-push__note--err">{error}</p> : null}
    </div>
  )
}
