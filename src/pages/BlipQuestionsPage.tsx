import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { BlipPoll } from '../components/BlipPoll'
import { PageShell } from '../components/PageShell'
import { openSiteMenu } from '../components/siteNav'
import { useAuth } from '../hooks/useAuth'
import { archiveDayWords } from '../lib/archive'
import { blipSet, fetchPastPolls, share, type PastPoll } from '../lib/poll'
import '../styles/blipPoll.css'
import '../styles/blipQuestions.css'

/*
 * Blip's questions (/blip): today's on top, as the home page asks it, and every one before it under it, newest
 * first, with how everyone answered and your answer lit. Ramsey, 2026-10-20: "we need a page to see past
 * polls/questions". A page of them at a time, from the API's GET /poll/past.
 */

type Load = { polls: PastPoll[]; next: number | null; answers: number | null; status: 'loading' | 'ready' | 'error'; more: 'idle' | 'loading' | 'error' }

const LOADING: Load = { polls: [], next: null, answers: null, status: 'loading', more: 'idle' }

const skel = (w: string) => ({ '--skel-w': w }) as CSSProperties

export function BlipQuestionsPage() {
  const { signedIn, signedOut } = useAuth()
  const [load, setLoad] = useState<Load>(LOADING)
  const [attempt, setAttempt] = useState(0)
  // A page asked for before signing in or out, or before a retry, is dropped when it comes.
  const asked = useRef(0)

  useEffect(() => {
    const ask = ++asked.current
    setLoad(LOADING)
    fetchPastPolls()
      .then((page) => {
        if (ask === asked.current) setLoad({ polls: page.polls, next: page.next, answers: page.answers, status: 'ready', more: 'idle' })
      })
      .catch(() => {
        if (ask === asked.current) setLoad({ ...LOADING, status: 'error' })
      })
  }, [signedIn, attempt])

  const showOlder = () => {
    if (!load.next || load.more === 'loading') return
    const ask = asked.current
    setLoad((s) => ({ ...s, more: 'loading' }))
    fetchPastPolls(load.next)
      .then((page) => {
        if (ask === asked.current) setLoad((s) => ({ ...s, polls: [...s.polls, ...page.polls], next: page.next, more: 'idle' }))
      })
      .catch(() => {
        if (ask === asked.current) setLoad((s) => ({ ...s, more: 'error' }))
      })
  }

  const answers = signedIn ? load.answers : null
  const toward = answers != null ? blipSet(answers) : null

  return (
    <PageShell innerClassName="lb-page__inner bq-page">
      <section className="bq-head" aria-labelledby="bq-title">
        <div className="bq-head__text">
          <h1 className="bq-title" id="bq-title">
            Blip’s questions
          </h1>
          <p className="bq-lede">
            One a day, about anything. Here’s how everyone answered.
            {answers != null ? (
              <>
                {' '}
                You’ve answered <b>{answers.toLocaleString()}</b>
                {toward?.next ? `, ${toward.more} more to the ${toward.next.name}` : ''}.
              </>
            ) : null}
          </p>
        </div>
      </section>

      <div className="bq-today">
        <BlipPoll onPastPage />
      </div>

      <h2 className="bq-sub">Before today</h2>

      {load.status === 'loading' ? (
        <ul className="bq-list" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="bq-card">
              <span className="skel-line" style={skel('35%')} />
              <span className="skel-line bq-card__skel-q" style={skel('80%')} />
              {[0, 1, 2].map((j) => (
                <span key={j} className="bq-card__skel-bar" />
              ))}
            </li>
          ))}
        </ul>
      ) : load.status === 'error' ? (
        <section className="bq-note" role="alert">
          <p>Blip’s questions didn’t load.</p>
          <button type="button" className="bq-btn" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </section>
      ) : load.polls.length === 0 ? (
        <section className="bq-note">
          <p>Today’s is Blip’s first question. Come back tomorrow to see how everyone answered it.</p>
        </section>
      ) : (
        <>
          <ul className="bq-list">
            {load.polls.map((poll) => (
              <PastCard key={poll.n} poll={poll} signedIn={signedIn} />
            ))}
          </ul>
          {load.next ? (
            <div className="bq-more">
              <button type="button" className="bq-btn" onClick={showOlder} disabled={load.more === 'loading'}>
                {load.more === 'loading' ? 'Loading…' : 'Show older questions'}
              </button>
              {load.more === 'error' ? <p role="alert">Those didn’t load. Try again.</p> : null}
            </div>
          ) : (
            <p className="bq-end">That’s every question since Blip’s first.</p>
          )}
        </>
      )}

      {signedOut ? (
        <p className="bq-signin">
          <button type="button" className="bq-btn" onClick={openSiteMenu}>
            Sign in
          </button>{' '}
          to answer Blip and see your answers here.
        </p>
      ) : null}
    </PageShell>
  )
}

/** A past question: its day, the question, everyone's answers as bars with the most picked marked and yours lit. */
function PastCard({ poll, signedIn }: { poll: PastPoll; signedIn: boolean }) {
  const most = poll.total ? Math.max(...poll.counts) : -1
  return (
    <li className="bq-card">
      <p className="bq-card__day">
        #{poll.n} · {archiveDayWords(poll.day)}
      </p>
      <h3 className="bq-card__q">{poll.q}</h3>
      <ul className="blip-poll__res bq-card__res" aria-label="How everyone answered">
        {poll.options.map((option, i) => {
          const mine = i === poll.pick
          const top = poll.counts[i] === most
          const pct = share(poll.counts[i] ?? 0, poll.total)
          return (
            <li key={option} className={`blip-poll__bar${mine ? ' blip-poll__bar--mine' : ''}${top ? ' bq-card__bar--top' : ''}`}>
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
      <p className="bq-card__foot">
        {poll.total === 0 ? 'No answers' : poll.total === 1 ? '1 answer' : `${poll.total.toLocaleString()} answers`}
        {signedIn && poll.pick == null ? ' · you missed this one' : ''}
      </p>
    </li>
  )
}
