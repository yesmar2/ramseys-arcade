import { useEffect, useState } from 'react'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { gameHref, gamePlayHref, navigate } from '../hooks/useHashRoute'
import { fetchChallenge, setActiveChallenge } from '../lib/challenges'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { ApiError } from '../lib/leaderboard'

/** How long before the wait gets a word: the arcade's server sleeps when nobody's about. */
const SLOW_MS = 3500

/**
 * A friend's challenge link. It reads the challenge, makes it this tab's for
 * the game, and goes straight on to the game's start card, which names it.
 * A link that no longer leads anywhere still leads to the game.
 */
export function ChallengeLandingPage({ slug, id }: { slug: string; id: string }) {
  const [state, setState] = useState<'loading' | 'missing' | 'failed'>('loading')
  const [slow, setSlow] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const game = getGame(slug)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    setSlow(false)
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS)
    fetchChallenge(id)
      .then((challenge) => {
        if (cancelled) return
        setActiveChallenge(challenge)
        navigate(gamePlayHref(challenge.game), { replace: true })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState(err instanceof ApiError && err.status === 404 ? 'missing' : 'failed')
      })
      .finally(() => window.clearTimeout(timer))
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [id, attempt])

  return (
    <PageShell>
      <section className="challenge-landing" style={game ? gameAccentStyle(slug) : undefined} aria-live="polite">
        <span className="challenge-landing__kicker">{game ? `A challenge on ${game.name}` : 'A challenge'}</span>
        {state === 'loading' ? (
          <>
            <h1 className="challenge-landing__title">Opening the challenge…</h1>
            {slow ? <p className="challenge-landing__text">The arcade is waking up. It takes a few seconds.</p> : null}
          </>
        ) : state === 'missing' ? (
          <>
            <h1 className="challenge-landing__title">This challenge link doesn’t lead anywhere any more.</h1>
            <p className="challenge-landing__text">The game’s still here, though.</p>
          </>
        ) : (
          <>
            <h1 className="challenge-landing__title">Couldn’t reach the arcade.</h1>
            <p className="challenge-landing__text">Check the connection and try the link again.</p>
            <button type="button" className="panel__btn challenge-landing__retry" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </>
        )}
        {game && state !== 'loading' ? (
          <div className="challenge-landing__actions">
            <a className="panel__btn" href={gamePlayHref(slug)}>
              Play {game.name}
            </a>
            <a className="panel__btn panel__btn--ghost" href={gameHref(slug)}>
              Its board
            </a>
          </div>
        ) : null}
      </section>
    </PageShell>
  )
}
