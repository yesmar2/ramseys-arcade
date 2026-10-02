import { useEffect, useRef, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader'
import { Footer } from '../components/Footer'
import { homeHref, navigate } from '../hooks/useHashRoute'
import { finishDiscordReturn } from '../lib/signInWays'

/*
 * /auth/discord: where Discord sends a player back, with a one-time code. Most of the time this is the
 * popup, which hands the code to the page that opened it and closes before anyone reads it. Otherwise it
 * signs in here and goes back to the page they left (lib/signInWays).
 */
export function DiscordReturnPage() {
  const [state, setState] = useState<{ kind: 'working' } | { kind: 'done' } | { kind: 'stale' } | { kind: 'failed'; message: string }>({
    kind: 'working',
  })
  // Once: the code works once, and a second look would spend it again.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const search = window.location.search
    // Off the address bar: the code is spent either way.
    window.history.replaceState(window.history.state, '', window.location.pathname)
    finishDiscordReturn(search).then(
      (result) => {
        if (result.kind === 'handed-back') {
          setState({ kind: 'done' })
          window.close()
        } else if (result.kind === 'stale') {
          setState({ kind: 'stale' })
        } else {
          navigate(result.back || homeHref(), { replace: true })
        }
      },
      (err: unknown) =>
        setState({
          kind: 'failed',
          message: err instanceof Error ? err.message : 'Discord didn’t sign you in. Try again.',
        }),
    )
  }, [])

  const title =
    state.kind === 'done' ? 'Signed in' : state.kind === 'working' ? 'Signing in' : 'Sign-in didn’t finish'
  const line =
    state.kind === 'working'
      ? 'Signing you in with Discord…'
      : state.kind === 'done'
        ? 'You’re signed in. You can close this window.'
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
          {state.kind === 'stale' || state.kind === 'failed' ? (
            <a className="game-page__cta" href={homeHref()}>
              Back to games
            </a>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  )
}
