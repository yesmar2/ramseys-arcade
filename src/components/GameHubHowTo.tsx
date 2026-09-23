import { useId, useState } from 'react'
import type { Game } from '../data/games'
import { scoringFor } from '../data/scoring'
import { scoreBits } from '../lib/gameHub'

/** Scoring rows shown before "All the rules". */
const RULES_SHOWN = 7

/**
 * How to play, on the page rather than only inside the game: the game's own
 * how-to beside what scores, the numbers in bold. A long list shows its first
 * rows and opens the rest in place.
 */
export function GameHubHowTo({ game }: { game: Game }) {
  const rules = scoringFor(game.slug) ?? []
  const [all, setAll] = useState(false)
  const listId = useId()
  const shown = all ? rules : rules.slice(0, RULES_SHOWN)

  return (
    <section className={`gh-card gh-how${rules.length ? '' : ' gh-how--single'}`} aria-labelledby="gh-how-title">
      <div className="gh-how__play">
        <h2 id="gh-how-title" className="gh-card__title">
          How to play
        </h2>
        <p className="gh-how__text">{game.how}</p>
      </div>
      {rules.length ? (
        <div className="gh-how__score">
          <h2 className="gh-card__title">What scores</h2>
          <ul id={listId} className="gh-rules">
            {shown.map((row) => (
              <li key={row.label} className="gh-rule">
                <span className="gh-rule__label">{row.label}</span>
                <span className="gh-rule__value">
                  {scoreBits(row.value).map((bit, i) => (bit.strong ? <b key={i}>{bit.text}</b> : <span key={i}>{bit.text}</span>))}
                </span>
              </li>
            ))}
          </ul>
          {rules.length > RULES_SHOWN ? (
            <button type="button" className="gh-more gh-how__all" aria-expanded={all} aria-controls={listId} onClick={() => setAll((open) => !open)}>
              {all ? 'Fewer rules' : `All ${rules.length} rules`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
