import { useEffect, useState } from 'react'
import { howToPlayFor } from '../data/howToPlay'
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
