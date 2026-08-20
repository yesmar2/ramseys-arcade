import { useEffect, useState } from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { completeSignIn } from '../lib/auth'

export function AuthVerifyPage({ token }: { token: string }) {
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working')
  const [message, setMessage] = useState('Signing you in…')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await completeSignIn(token)
        if (cancelled) return
        setStatus('ok')
        setMessage(
          result.account
            ? `Signed in as ${result.account.email}`
            : 'Signed in',
        )
        window.setTimeout(() => {
          window.location.hash = '#/'
        }, 900)
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Could not verify link')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <>
      <Header />
      <main className="game-page">
        <div className="game-page__inner game-page__inner--narrow">
          <h1 className="game-page__title">
            {status === 'ok' ? 'Welcome back' : status === 'error' ? 'Sign-in failed' : 'Signing in'}
          </h1>
          <p className="game-page__blurb">{message}</p>
          {status === 'error' ? (
            <a className="game-page__cta" href="#/">
              Back to games
            </a>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  )
}
