import { useState, type CSSProperties } from 'react'
import { useAuth } from '../hooks/useAuth'
import { blipQuestionsHref } from '../hooks/useHashRoute'
import { answerPoll, blipSet, share, usePoll } from '../lib/poll'
import { BlipFigure } from './BlipFigure'
import { BlipSet } from './BlipSet'
import { TicketGlyph } from './prizes/Ticket'
import { openSiteMenu } from './siteNav'
import '../styles/blipPoll.css'

const skel = (w: string) => ({ '--skel-w': w }) as CSSProperties

/** Your answer, on a card's results. */
const MineMark = () => (
  <svg className="blip-poll__mine" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
)

/** A shimmer's line more where the card is narrow, beside the races on a desk (homeToday.css): its words take more. */
function SkelMore({ w }: { w: string }) {
  return (
    <span className="blip-poll__skel-more">
      <br />
      <span className="skel-line" style={skel(w)} />
    </span>
  )
}

/*
 * Blip's question of the day on the home page, beside the day's races (A on the "Blip's daily poll" canvas,
 * 2026-10-09): Blip perched on the card, the question, its answers. A signed-in player answers once, for a few
 * tickets, and then sees how everyone answered with theirs lit; a visitor sees the question and the way to sign
 * in. Yesterday's result under it, and once you've answered, a hint of tomorrow's. Every 7 answers win the next
 * skin of Blip's set (BlipSet.tsx): before answering, the card says how near the next is; after, it shows the set.
 * `inSheet`: the same card in Blip's hello (BlipHello.tsx), answered where you are rather than on the home page.
 * `look="card"`: a card of the home page's Up next for you row (HomeUpNext.tsx), as tall answered as not, so the
 * row beside it doesn't stretch when you answer: the answers and the results two by two, yesterday's in a box, and
 * Blip's set as a line under them (the set itself shows only when an answer wins one of it).
 * `onPastPage`: on Blip's questions page (BlipQuestionsPage.tsx), where yesterday's is the first card under it.
 */
export function BlipPoll({ inSheet = false, look, onPastPage = false }: { inSheet?: boolean; look?: 'card'; onPastPage?: boolean }) {
  const card = look === 'card'
  const { signedIn, signedOut } = useAuth()
  const { view, status, earned, won } = usePoll(signedIn)
  const [sending, setSending] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  // Answered here, just now: the results' bars grow in from nothing, rather than appearing already filled.
  const [fresh, setFresh] = useState(false)

  // No question (before the first day), or the API couldn't say: no card, rather than a broken one.
  if (status === 'error' || (status === 'ready' && !view?.today)) return null
  const today = view?.today ?? null
  const voted = today != null && today.pick != null && today.counts != null
  const yesterday = view?.yesterday ?? null

  const pickAnswer = (i: number) => {
    // A session whose account isn't known yet answers anyway: the API knows whose it is.
    if (signedOut) {
      openSiteMenu()
      return
    }
    if (sending != null) return
    setSending(i)
    setFailed(false)
    answerPoll(i)
      .then(() => setFresh(true))
      .catch(() => setFailed(true))
      .finally(() => setSending(null))
  }

  // Its own heading id in the sheet, which can open over the home page's card.
  const headingId = inSheet ? 'blip-sheet-q' : 'blip-poll-q'
  const top = yesterday && yesterday.total ? yesterday.counts.indexOf(Math.max(...yesterday.counts)) : -1
  const answers = signedIn ? (view?.answers ?? null) : null
  const toward = answers != null ? blipSet(answers) : null

  return (
    <section
      id={inSheet ? undefined : 'blip-poll'}
      className={`blip-poll${voted ? ' blip-poll--voted' : ''}${voted && fresh ? ' blip-poll--fresh' : ''}${sending != null ? ' blip-poll--sending' : ''}${inSheet ? ' blip-poll--sheet' : ''}${card ? ' blip-poll--card' : ''}`}
      aria-labelledby={headingId}
    >
      <BlipFigure className="blip-poll__blip" mood={voted ? 'happy' : 'hi'} />
      <p className="blip-poll__who">{today ? `Blip asks · #${today.n}` : 'Blip asks'}</p>
      <h3 id={headingId} className="blip-poll__q">
        {today ? (
          today.q
        ) : (
          <span aria-hidden="true">
            <span className="skel-line" style={skel('80%')} />
            <SkelMore w="45%" />
          </span>
        )}
      </h3>
      {!today ? (
        // While the question comes, the card as it will be: its answers, its foot and yesterday's, each a shimmer.
        <>
          <ul className="blip-poll__opts" aria-hidden="true">
            {(card ? [0, 1, 2, 3] : [0, 1, 2]).map((i) => (
              <li key={i}>
                <span className="blip-poll__opt blip-poll__opt--skel" />
              </li>
            ))}
          </ul>
          {card ? (
            <div className="blip-poll__ago" aria-hidden="true">
              <span className="skel-line" style={skel('85%')} />
            </div>
          ) : null}
          <p className="blip-poll__foot" aria-hidden="true">
            <span className="skel-line" style={skel('75%')} />
            {card ? null : <SkelMore w="40%" />}
          </p>
          {card ? null : (
            <p className="blip-poll__then" aria-hidden="true">
              <span className="skel-line" style={skel('95%')} />
              <br />
              <span className="skel-line" style={skel('60%')} />
              <SkelMore w="45%" />
            </p>
          )}
        </>
      ) : voted ? (
        <ul className="blip-poll__res" aria-label="How everyone answered">
          {today.options.map((option, i) => {
            const mine = i === today.pick
            const pct = share(today.counts![i] ?? 0, today.total ?? 0)
            return (
              <li key={option} className={`blip-poll__bar${mine ? ' blip-poll__bar--mine' : ''}`}>
                <span className="blip-poll__fill" style={{ width: pct }} />
                <span className="blip-poll__label">
                  {/* Two by two on a card, a narrow bar cuts "· you" off: there, a tick before the answer says it. */}
                  {mine && card ? <MineMark /> : null}
                  {option}
                  {mine ? card ? <span className="visually-hidden"> (your answer)</span> : <span className="blip-poll__you"> · you</span> : null}
                </span>
                <span className="blip-poll__pct">{pct}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="blip-poll__opts" aria-busy={sending != null}>
          {today.options.map((option, i) => (
            <li key={option}>
              <button type="button" className="blip-poll__opt" onClick={() => pickAnswer(i)} disabled={sending != null} aria-busy={sending === i}>
                {option}
                {/* The answer on its way: a turning ring on it while the others fade, as the counts come. */}
                {sending === i ? <span className="blip-poll__spin" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {/*
       * On the home page's card, yesterday's answer before the foot, in a box with its share as a bar, leading to
       * Blip's questions. A day nobody answered is still there (on a quiet day it was the only way to the page),
       * asking for an answer: past ones can be answered late.
       */}
      {card && today && yesterday ? (
        <a
          className="blip-poll__ago"
          href={blipQuestionsHref()}
          aria-label={
            top >= 0
              ? `Yesterday: ${yesterday.q} ${yesterday.options[top]}, ${share(yesterday.counts[top]!, yesterday.total)}. See all of Blip’s questions`
              : `Yesterday: ${yesterday.q} Nobody answered it yet: answer it on Blip’s questions`
          }
        >
          <span className="blip-poll__ago-row">
            <span className="blip-poll__ago-q">Yesterday: {yesterday.q}</span>
            <b>{top >= 0 ? `${yesterday.options[top]} ${share(yesterday.counts[top]!, yesterday.total)}` : 'Answer it ›'}</b>
          </span>
          <span className="blip-poll__ago-bar" aria-hidden="true">
            <span style={{ width: top >= 0 ? share(yesterday.counts[top]!, yesterday.total) : '0%' }} />
          </span>
        </a>
      ) : null}
      {today && !voted ? (
        <p className="blip-poll__foot">
          {card ? <TicketGlyph size={18} className="blip-poll__ticket" /> : null}
          {sending != null && !failed ? (
            'Counting your answer…'
          ) : failed ? (
            'That didn’t go through: try again.'
          ) : signedOut ? (
            <button type="button" className="blip-poll__signin" onClick={openSiteMenu}>
              Sign in to answer, for {view?.tickets ?? 5} tickets
            </button>
          ) : (
            <>
              Answer for <b>{view?.tickets ?? 5} tickets</b>
              {toward?.next ? (
                <>
                  {' '}· {toward.more} more to the {toward.next.name}
                </>
              ) : null}
            </>
          )}
        </p>
      ) : null}
      {voted ? (
        <p className="blip-poll__foot">
          {card ? <TicketGlyph size={18} className="blip-poll__ticket" /> : null}
          {today.total === 1 ? 'The first answer' : `${(today.total ?? 0).toLocaleString()} answers`}
          {earned > 0 ? <b> · +{earned} tickets</b> : null}
          {/* The card's set, as a line: how far to the next of it. */}
          {card && !won && toward?.next ? (
            <>
              {' '}· {toward.more} more to the {toward.next.name}
            </>
          ) : null}
        </p>
      ) : null}
      {voted && answers != null && (!card || won) ? <BlipSet answers={answers} won={won} /> : null}
      {!card && !onPastPage && yesterday ? (
        <p className="blip-poll__then">
          <b>Yesterday:</b> {yesterday.q}{' '}
          {top >= 0 ? `${yesterday.options[top]}, ${share(yesterday.counts[top]!, yesterday.total)}. ` : 'Nobody answered it yet. '}
          <a className="blip-poll__past" href={blipQuestionsHref()}>
            {top >= 0 ? 'Past questions' : 'Answer it'}
          </a>
        </p>
      ) : null}
      {!card && voted && view?.tomorrow ? <p className="blip-poll__next">Tomorrow: {view.tomorrow}</p> : null}
    </section>
  )
}
