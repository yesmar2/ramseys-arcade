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
    <div className="install-prompt" role="dialog" aria-labelledby="install-prompt-title">
      <img className="install-prompt__icon" src="/pwa-192.png" alt="" width={48} height={48} />
      <div className="install-prompt__copy">
        <strong id="install-prompt-title">{APP_NAME} on your home screen</strong>
        {mode === 'android' ? (
          <span>One tap to play, full screen, no browser bars.</span>
        ) : (
          <span>
            Tap Share, then <em>Add to Home Screen</em>.
          </span>
        )}
      </div>
      <div className="install-prompt__actions">
        {mode === 'android' ? (
          <button type="button" className="panel__btn" onClick={onInstall}>
            Install
          </button>
        ) : null}
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}
