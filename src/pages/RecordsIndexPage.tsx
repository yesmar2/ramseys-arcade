import type { CSSProperties } from 'react'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { recordsHref } from '../hooks/useHashRoute'
import { GAMES_WITH_RECORDS, type RecordGame } from '../lib/records'
import { resolveGameAccent } from '../lib/theme'

/** Short lines describing what each book tracks — not full scoring rules. */
const BOOK_FOCUS: Record<RecordGame, string> = {
  asteroids: 'Wave clears, combos, and long play streaks',
  snake: 'Length milestones, days played, strong runs',
  patriot: 'Direct-hit streaks and day-to-day grind',
  crosswalk: 'Row milestones, coin hauls, distance streaks',
  pop: 'Perfect centers and consecutive strong scores',
  stacker: 'Perfect stacks and climbing day streaks',
  centroid: 'Dead-on runs and return-visit streaks',
  simon: 'Sequence climbs and daily play',
  spotter: 'Fast clears and sub-45s streaks',
  pellets: 'High chomps and consecutive strong boards',
}

/** Catalog of games that have record books. */
export function RecordsIndexPage() {
  const games = GAMES_WITH_RECORDS.map((slug) => {
    const game = getGame(slug)
    if (!game) return null
    return { ...game, slug: slug as RecordGame }
  }).filter((game): game is NonNullable<typeof game> => Boolean(game))

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--summary records-index-page">
      <header className="records-index-hero">
        <p className="lb-page__eyebrow">Hall of fame</p>
        <h1 className="lb-page__title">Record books</h1>
        <p className="records-index-hero__blurb">
          Not the high-score boards — the specialty ledgers. Fastest clears, longest streaks,
          milestone times. Somebody’s name is in ink.
        </p>
        <p className="records-index-hero__count" aria-hidden="true">
          {games.length} books open
        </p>
      </header>

      {games.length === 0 ? (
        <p className="lb-empty">No record books yet.</p>
      ) : (
        <ul className="records-index">
          {games.map((game, i) => {
            const accent = resolveGameAccent(game.slug, game.accent)
            return (
              <li
                key={game.slug}
                className="records-index__item"
                style={{ '--i': i, '--book-accent': accent } as CSSProperties}
              >
                <a className="records-index__card" href={recordsHref(game.slug)}>
                  <span className="records-index__spine" aria-hidden="true" />
                  <span className="records-index__thumb" aria-hidden="true">
                    <GameThumbArt slug={game.slug} accent={accent} />
                  </span>
                  <span className="records-index__copy">
                    <span className="records-index__name">{game.name}</span>
                    <span className="records-index__focus">
                      {BOOK_FOCUS[game.slug]}
                    </span>
                  </span>
                  <span className="records-index__go" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                      <path
                        d="M9 5l7 7-7 7"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </PageShell>
  )
}
