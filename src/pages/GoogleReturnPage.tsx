import { useEffect, useRef, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader'
import { Footer } from '../components/Footer'
import { homeHref, navigate } from '../hooks/useHashRoute'
import { finishGoogleReturn } from '../lib/signInWays'

/*
 * /auth/google: where Google's sign-in comes back to when it went by this tab rather than a popup (an iPhone,
 * the installed app). The API sends it here with Google's token after the #; it signs in and goes back to the
 * page it left (lib/signInWays).
 */
export function GoogleReturnPage() {
  const [state, setState] = useState<{ kind: 'working' } | { kind: 'stale' } | { kind: 'failed'; message: string }>({
    kind: 'working',
  })
  // Once: a second look would find the trip already taken.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const hash = window.location.hash
    // Off the address bar and out of history: it's a sign-in token.
    window.history.replaceState(window.history.state, '', window.location.pathname)
    finishGoogleReturn(hash).then(
      (result) => {
        if (result.kind === 'stale') setState({ kind: 'stale' })
        else navigate(result.back || homeHref(), { replace: true })
      },
      (err: unknown) =>
        setState({
          kind: 'failed',
          message: err instanceof Error ? err.message : 'Google didn’t sign you in. Try again.',
        }),
    )
  }, [])

  const title = state.kind === 'working' ? 'Signing in' : 'Sign-in didn’t finish'
  const line =
    state.kind === 'working'
      ? 'Signing you in with Google…'
      : state.kind === 'stale'
        ? 'This sign-in has run out, or began in another browser. Start again from the Sign in button.'
        : state.message

  return (
    <>
      <SiteHeader />
      <main className="game-page">
        <div className="game-page__inner game-page__inner--narrow">
          <h1 className="game-page__title">{title}</h1>
          <p className="game-page__blurb" role="status">
            {line}
          </p>
          {state.kind === 'working' ? null : (
            <a className="game-page__cta" href={homeHref()}>
              Back to games
            </a>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
