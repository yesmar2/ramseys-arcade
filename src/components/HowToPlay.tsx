import { useEffect, useState } from 'react'
import { isDailyGame, isRankedGame } from '../data/games'
import { howToPlayFor } from '../data/howToPlay'
import { scoreText } from '../lib/gameBoard'
import { useTicketLadder } from '../lib/tickets'
import '../styles/howto.css'

const TOUCH_ONLY = '(hover: none) and (pointer: coarse)'

/** A phone or tablet with nothing but a finger to play with. */
function useTouchOnly(): boolean {
  const [touch, setTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(TOUCH_ONLY).matches === true,
  )
  useEffect(() => {
    const query = window.matchMedia?.(TOUCH_ONLY)
    if (!query) return
    const update = () => setTouch(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return touch
}

/**
 * How to play a game, the same on its page and in its panel: the goal, the
 * controls, what scores, what ends a run, and a tip where there is one. A
 * phone shows each control's touch gesture alone; anything with a keyboard
 * shows the key beside it.
 */
/** What a run pays in tickets, step by step: the game's ladder, from the API. */
function TicketsPart({ slug }: { slug: string }) {
  const ladder = useTicketLadder(slug)
  if (!ladder) return null
  const up = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const rows = [
    { what: ladder.baseLabel ? up(ladder.baseLabel) : 'Any run', tickets: ladder.base },
    ...ladder.steps.map((step) => ({ what: step.label ? up(step.label) : `${scoreText(slug, step.at)} or better`, tickets: step.tickets })),
  ]
  return (
    <section className="htp__part">
      <h3 className="htp__label">Tickets</h3>
      <ul className="htp__rows">
        {rows.map((row) => (
          <li key={row.what} className="htp__row htp__row--score">
            <span className="htp__what">{row.what}</span>
            <span className="htp__pts">
              <b>{row.tickets}</b>
            </span>
          </li>
        ))}
      </ul>
      <p className="htp__note">
        {isDailyGame(slug)
          ? isRankedGame(slug)
            ? 'Your best of the day pays once. Finish in the day’s top three for bonus tickets after midnight.'
            : 'Your result of the day pays once, by how it went.'
          : 'Every saved run pays, up to 200 tickets a day. A new best pays 5 more.'}
      </p>
    </section>
  )
}

export function HowToPlay({ slug }: { slug: string }) {
  const how = howToPlayFor(slug)
  const touchOnly = useTouchOnly()
  if (!how) return null

  return (
    <div className="htp">
      <p className="htp__goal">{how.goal}</p>
      <section className="htp__part">
        <h3 className="htp__label">Controls</h3>
        <ul className="htp__rows">
          {how.controls.map((control) => (
            <li key={control.does} className="htp__row">
              <span className="htp__what">{control.does}</span>
              <span className="htp__inputs">
                <span className="htp__touch">{control.touch}</span>
                {touchOnly ? null : <kbd className="htp__key">{control.keys}</kbd>}
              </span>
            </li>
          ))}
        </ul>
        {how.auto ? <p className="htp__note">{how.auto}</p> : null}
      </section>
      <section className="htp__part">
        <h3 className="htp__label">What scores</h3>
        <ul className="htp__rows">
          {how.scores.map((score) => (
            <li key={score.what} className="htp__row htp__row--score">
              <span className="htp__what">{score.what}</span>
              <span className="htp__pts">
                <b>{score.pts}</b>
                {score.sub ? <span className="htp__sub">{score.sub}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <TicketsPart slug={slug} />
      <div className="htp__end">
        <section className="htp__part">
          <h3 className="htp__label">Ends when</h3>
          <p className="htp__ends">{how.ends}</p>
        </section>
        {how.tip ? (
          <p className="htp__tip">
            <b>Tip</b> {how.tip}
          </p>
        ) : null}
      </div>
    </div>
  )
}
