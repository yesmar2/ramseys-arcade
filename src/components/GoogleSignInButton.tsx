import { useEffect, useRef, useState } from 'react'
import { fetchAuthConfig, signInWithGoogleIdToken } from '../lib/auth'

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      width?: number
      logo_alignment?: 'left' | 'center'
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google script failed')))
      if (window.google?.accounts?.id) resolve()
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google script failed'))
    document.head.appendChild(script)
  })
}

type GoogleSignInButtonProps = {
  disabled?: boolean
  onBusy?: (busy: boolean) => void
  onError?: (message: string) => void
  onSignedIn?: () => void
}

export function GoogleSignInButton({
  disabled,
  onBusy,
  onError,
  onSignedIn,
}: GoogleSignInButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [missing, setMissing] = useState(false)
  const handlersRef = useRef({ onBusy, onError, onSignedIn })
  handlersRef.current = { onBusy, onError, onSignedIn }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
      let clientId = envId || null
      if (!clientId) {
        const config = await fetchAuthConfig()
        clientId = config.googleClientId
      }
      if (cancelled) return
      if (!clientId) {
        setMissing(true)
        return
      }
      try {
        await loadGisScript()
        if (cancelled || !hostRef.current || !window.google?.accounts?.id) return
        hostRef.current.innerHTML = ''
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            const idToken = response.credential
            if (!idToken) {
              handlersRef.current.onError?.('Google sign-in returned no credential')
              return
            }
            handlersRef.current.onBusy?.(true)
            try {
              await signInWithGoogleIdToken(idToken)
              handlersRef.current.onSignedIn?.()
            } catch (err) {
              handlersRef.current.onError?.(
                err instanceof Error ? err.message : 'Google sign-in failed',
              )
            } finally {
              handlersRef.current.onBusy?.(false)
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        const width = Math.min(320, Math.max(220, hostRef.current.clientWidth || 280))
        window.google.accounts.id.renderButton(hostRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width,
          logo_alignment: 'left',
        })
        setReady(true)
      } catch (err) {
        if (!cancelled) {
          setMissing(true)
          handlersRef.current.onError?.(
            err instanceof Error ? err.message : 'Could not load Google sign-in',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (missing) return null

  return (
    <div
      className={`google-signin${disabled ? ' google-signin--disabled' : ''}${ready ? ' google-signin--ready' : ''}`}
      ref={hostRef}
      aria-busy={!ready}
    />
  )
}
