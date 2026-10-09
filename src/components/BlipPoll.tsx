import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { answerPoll, share, usePoll } from '../lib/poll'
import { BlipFigure } from './BlipFigure'
import { openSiteMenu } from './siteNav'
import '../styles/blipPoll.css'

/*
 * Blip's question of the day on the home page, beside the day's races (A on the "Blip's daily poll" canvas,
 * 2026-10-09): Blip perched on the card, the question, its answers. A signed-in player answers once, for a few
 * tickets, and then sees how everyone answered with theirs lit; a visitor sees the question and the way to sign
 * in. Yesterday's result under it, and once you've answered, a hint of tomorrow's.
 */
export function BlipPoll() {
  const { signedIn } = useAuth()
  const { view, status, earned } = usePoll(signedIn)
  const [sending, setSending] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  // No question (before the first day), or the API couldn't say: no card, rather than a broken one.
  if (status === 'error' || (status === 'ready' && !view?.today)) return null
  const today = view?.today ?? null
  const voted = today != null && today.pick != null && today.counts != null
  const yesterday = view?.yesterday ?? null

  const pickAnswer = (i: number) => {
    if (!signedIn) {
      openSiteMenu()
      return
    }
    if (sending != null) return
    setSending(i)
    setFailed(false)
    answerPoll(i)
      .catch(() => setFailed(true))
      .finally(() => setSending(null))
  }

  const top = yesterday && yesterday.total ? yesterday.counts.indexOf(Math.max(...yesterday.counts)) : -1

  return (
    <section id="blip-poll" className={`blip-poll${voted ? ' blip-poll--voted' : ''}`} aria-labelledby="blip-poll-q">
      <BlipFigure className="blip-poll__blip" mood={voted ? 'happy' : 'hi'} />
      <p className="blip-poll__who">{today ? `Blip asks · #${today.n}` : 'Blip asks'}</p>
      <h3 id="blip-poll-q" className="blip-poll__q">
        {today ? today.q : <span className="skel-line" style={{ '--skel-w': '80%' } as React.CSSProperties} aria-hidden="true" />}
      </h3>
      {!today ? (
        <ul className="blip-poll__opts" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <span className="blip-poll__opt blip-poll__opt--skel" />
            </li>
          ))}
        </ul>
      ) : voted ? (
        <ul className="blip-poll__res" aria-label="How everyone answered">
          {today.options.map((option, i) => {
            const mine = i === today.pick
            const pct = share(today.counts![i] ?? 0, today.total ?? 0)
            return (
              <li key={option} className={`blip-poll__bar${mine ? ' blip-poll__bar--mine' : ''}`}>
                <span className="blip-poll__fill" style={{ width: pct }} />
                <span className="blip-poll__label">
                  {option}
                  {mine ? <span className="blip-poll__you"> · you</span> : null}
                </span>
                <span className="blip-poll__pct">{pct}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="blip-poll__opts">
          {today.options.map((option, i) => (
            <li key={option}>
              <button type="button" className="blip-poll__opt" onClick={() => pickAnswer(i)} disabled={sending != null} aria-busy={sending === i}>
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
      {today && !voted ? (
        <p className="blip-poll__foot">
          {failed ? (
            'That didn’t go through: try again.'
          ) : signedIn ? (
            <>Answer for <b>{view?.tickets ?? 5} tickets</b></>
          ) : (
            <button type="button" className="blip-poll__signin" onClick={openSiteMenu}>
              Sign in to answer, for {view?.tickets ?? 5} tickets
            </button>
          )}
        </p>
      ) : null}
      {voted ? (
        <p className="blip-poll__foot">
          {today.total === 1 ? 'The first answer' : `${(today.total ?? 0).toLocaleString()} answers`}
          {earned > 0 ? <b> · +{earned} tickets</b> : null}
        </p>
      ) : null}
      {yesterday && top >= 0 ? (
        <p className="blip-poll__then">
          <b>Yesterday:</b> {yesterday.q} {yesterday.options[top]}, {share(yesterday.counts[top]!, yesterday.total)}.
        </p>
      ) : null}
      {voted && view?.tomorrow ? <p className="blip-poll__next">Tomorrow: {view.tomorrow}</p> : null}
    </section>
  )
}
