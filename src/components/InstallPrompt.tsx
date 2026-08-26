import { useEffect, useState } from 'react'
import {
  dismissInstallPrompt,
  getDeferredInstallPrompt,
  isIosSafari,
  isPwaInstalled,
  promptPwaInstall,
  subscribePwaInstall,
  wasInstallDismissed,
} from '../lib/pwaInstall'
import { APP_NAME } from '../lib/brand'

type Mode = 'hidden' | 'android' | 'ios'

function resolveMode(): Mode {
  if (isPwaInstalled() || wasInstallDismissed()) return 'hidden'
  if (getDeferredInstallPrompt()) return 'android'
  if (isIosSafari()) return 'ios'
  return 'hidden'
}

/** Bottom install tip when the browser allows Add to Home Screen / install. */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(() => resolveMode())

  useEffect(() => {
    const sync = () => setMode(resolveMode())
    sync()
    return subscribePwaInstall(sync)
  }, [])

  if (mode === 'hidden') return null

  const onDismiss = () => {
    dismissInstallPrompt()
    setMode('hidden')
  }

  const onInstall = () => {
    void (async () => {
      await promptPwaInstall()
      setMode(resolveMode())
    })()
  }

  return (
    <div className="install-prompt" role="dialog" aria-label={`Install ${APP_NAME}`}>
      <div className="install-prompt__copy">
        <strong>Install {APP_NAME}</strong>
        {mode === 'android' ? (
          <span>Add it to your home screen for quick play.</span>
        ) : (
          <span>
            Tap Share, then <em>Add to Home Screen</em>.
          </span>
        )}
      </div>
      <div className="install-prompt__actions">
        {mode === 'android' ? (
          <button type="button" className="install-prompt__btn" onClick={onInstall}>
            Install
          </button>
        ) : null}
        <button
          type="button"
          className="install-prompt__dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
