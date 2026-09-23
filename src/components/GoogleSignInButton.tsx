import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

/**
 * Google's script and our own config both sit on the far side of a network
 * that can stall without ever failing. Waiting forever looks identical to
 * being broken, so give up at some point and offer a retry instead.
 */
const LOAD_TIMEOUT_MS = 10_000

/*
 * Google draws its button 40px tall at the most. Scaled up evenly it stands as
 * tall as the panel kit's buttons beside it (3.25rem), so it is drawn a little
 * narrower than its slot and grows into it.
 */
const GOOGLE_HEIGHT = 40
const BUTTON_HEIGHT = 52
const SCALE = BUTTON_HEIGHT / GOOGLE_HEIGHT

/** Resolved once per page — a theme change re-renders the button, not this. */
let cachedClientId: string | null | undefined

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Google sign-in took too long to load')),
      ms,
    )
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error('Google sign-in failed'))
      },
    )
  })
}

/** `missing` is a deployment without Google configured — render nothing at all. */
type LoadState = 'loading' | 'ready' | 'failed' | 'missing'

type GoogleSignInButtonProps = {
  disabled?: boolean
  onBusy?: (busy: boolean) => void
  onError?: (message: string) => void
  onSignedIn?: () => void
}

/**
 * Google's own rendered button, with the two waits it leaves unexplained made
 * visible: a placeholder while the script loads, and a spinner while the token
 * we get back is exchanged for a session. Either can take seconds on a cold
 * backend or a slow phone, and an empty box reads as a broken page.
 */
export function GoogleSignInButton({
  disabled,
  onBusy,
  onError,
  onSignedIn,
}: GoogleSignInButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const handlersRef = useRef({ onBusy, onError, onSignedIn })
  handlersRef.current = { onBusy, onError, onSignedIn }

  useEffect(() => {
    let cancelled = false
    // A retry from `failed` goes back to loading.
    setState((prev) => (prev === 'ready' ? prev : 'loading'))
    ;(async () => {
      try {
        if (cachedClientId === undefined) {
          const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
          cachedClientId =
            envId || (await withTimeout(fetchAuthConfig(), LOAD_TIMEOUT_MS)).googleClientId
        }
        const clientId = cachedClientId
        if (cancelled) return
        if (!clientId) {
          setState('missing')
          return
        }

        await withTimeout(loadGisScript(), LOAD_TIMEOUT_MS)
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
            // The account picker closes here and the exchange begins, which is
            // the longest silence in the whole flow.
            setBusy(true)
            handlersRef.current.onBusy?.(true)
            try {
              await signInWithGoogleIdToken(idToken)
              handlersRef.current.onSignedIn?.()
            } catch (err) {
              handlersRef.current.onError?.(
                err instanceof Error ? err.message : 'Google sign-in failed',
              )
            } finally {
              setBusy(false)
              handlersRef.current.onBusy?.(false)
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        /*
         * Fill the slot it was given, once scaled. Google clamps the width at
         * 400, which is the only reason for a cap here: at 320 the button sat
         * visibly short of the drawer's edge while everything beside it ran
         * full width. White on either theme, the button Google's own pages
         * use, with its logo beside the words.
         */
        const slot = hostRef.current.parentElement?.clientWidth || 280
        const width = Math.min(400, Math.max(200, Math.floor(slot / SCALE)))
        window.google.accounts.id.renderButton(hostRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width,
          logo_alignment: 'center',
        })
        setState('ready')
      } catch {
        // Ad blockers routinely block Google's script. The retry below says so
        // where it happened, which beats a red line somewhere else on the card.
        if (!cancelled) {
          cachedClientId = undefined
          setState('failed')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (state === 'missing') return null

  const className = [
    'google-signin',
    disabled || busy ? 'google-signin--disabled' : '',
    state === 'ready' ? 'google-signin--ready' : '',
    busy ? 'google-signin--busy' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={className}
      aria-busy={busy || state === 'loading'}
      style={{ '--google-scale': SCALE } as CSSProperties}
    >
      <div className="google-signin__host" ref={hostRef} />

      {state === 'loading' ? (
        <span className="google-signin__skeleton" aria-hidden="true" />
      ) : null}

      {state === 'failed' ? (
        <p className="google-signin__failed" role="status">
          Couldn’t load Google sign-in.
          <button
            type="button"
            className="google-signin__retry"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </p>
      ) : null}

      {busy ? (
        <span className="google-signin__busy" role="status">
          <span className="google-signin__spinner" aria-hidden="true" />
          Signing you in…
        </span>
      ) : null}
    </div>
  )
}
