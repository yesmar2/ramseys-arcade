import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { BlipPoll } from '../components/BlipPoll'
import { PageShell } from '../components/PageShell'
import { openSiteMenu } from '../components/siteNav'
import { useAuth } from '../hooks/useAuth'
import { archiveDayWords } from '../lib/archive'
import { answerPastPoll, blipSet, fetchPastPolls, share, type PastPoll } from '../lib/poll'
import '../styles/blipPoll.css'
import '../styles/blipQuestions.css'

/*
 * Blip's questions (/blip): today's beside the page's head, as the home page asks it, and every one before it
 * under them, newest first, with how everyone answered and your answer lit. Ramsey, 2026-10-20: "we need a page
 * to see past polls/questions". A page of them at a time, from the API's GET /poll/past. One you missed can still
 * be answered (2026-10-21: "we should let people still vote on older ones too"), for no tickets: its answers
 * show once you've given yours, as today's do.
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

  // A late answer's question, as the API now has it, in place of the one on show.
  const answered = (poll: PastPoll) => setLoad((s) => ({ ...s, polls: s.polls.map((p) => (p.n === poll.n ? poll : p)) }))

  const answers = signedIn ? load.answers : null
  const toward = answers != null ? blipSet(answers) : null

  return (
    <PageShell innerClassName="lb-page__inner bq-page">
      <div className="bq-top">
        <section className="bq-head" aria-labelledby="bq-title">
          <h1 className="bq-title" id="bq-title">
            Blip’s questions
          </h1>
          <p className="bq-lede">
            One a day, about anything. Missed one? You can still answer it: the tickets are for the day’s question.
          </p>
          {/* Nothing to say at none: today's card says how near the next of his set is. */}
          {answers ? (
            <p className="bq-count">
              You’ve answered <b>{answers.toLocaleString()}</b> on the day
              {toward?.next ? `, ${toward.more} more to the ${toward.next.name}` : ''}.
            </p>
          ) : null}
        </section>
        <div className="bq-today">
          <BlipPoll onPastPage />
        </div>
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
              <PastCard key={poll.n} poll={poll} signedIn={signedIn} onAnswered={answered} />
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

/**
 * A past question: its day, the question, and everyone's answers as bars with the most picked marked and yours
 * lit. One a signed-in player missed is its answers to pick from instead, until they pick; a visitor sees the bars.
 */
function PastCard({ poll, signedIn, onAnswered }: { poll: PastPoll; signedIn: boolean; onAnswered: (poll: PastPoll) => void }) {
  const [sending, setSending] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  // Answered here, just now: the bars grow in from nothing, as today's card's do.
  const [fresh, setFresh] = useState(false)
  const asking = signedIn && poll.pick == null
  const most = poll.total ? Math.max(...poll.counts) : -1

  const pickAnswer = (i: number) => {
    if (sending != null) return
    setSending(i)
    setFailed(false)
    answerPastPoll(poll.n, i)
      .then((next) => {
        setFresh(true)
        onAnswered(next)
      })
      .catch(() => setFailed(true))
      .finally(() => setSending(null))
  }

  return (
    <li
      className={`bq-card${asking ? ' bq-card--ask' : ''}${fresh ? ' blip-poll--fresh' : ''}${sending != null ? ' blip-poll--sending' : ''}`}
    >
      <p className="bq-card__day">
        #{poll.n} · {archiveDayWords(poll.day)}
      </p>
      <h3 className="bq-card__q">{poll.q}</h3>
      {asking ? (
        <ul className="blip-poll__opts" aria-busy={sending != null}>
          {poll.options.map((option, i) => (
            <li key={option}>
              <button type="button" className="blip-poll__opt" onClick={() => pickAnswer(i)} disabled={sending != null} aria-busy={sending === i}>
                {option}
                {sending === i ? <span className="blip-poll__spin" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
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
      )}
      <p className="bq-card__foot">
        {asking
          ? sending != null && !failed
            ? 'Counting your answer…'
            : failed
              ? 'That didn’t go through: try again.'
              : 'You missed this one. Answer to see how everyone did.'
          : poll.total === 0
            ? 'No answers'
            : poll.total === 1
              ? '1 answer'
              : `${poll.total.toLocaleString()} answers`}
      </p>
    </li>
  )
}
