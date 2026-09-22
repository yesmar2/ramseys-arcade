import type { CSSProperties } from 'react'
import { EventArt } from '../components/EventCard'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { recordsHref, siteRecordsHref } from '../hooks/useHashRoute'
import { GAMES_WITH_RECORDS, type RecordGame } from '../lib/records'
import { resolveGameAccent } from '../lib/theme'

/** The house book belongs to no cabinet, so it borrows the site's own colour. */
const HOUSE_ACCENT = 'var(--accent)'

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
  crumbtrail: 'Longest climbs and the crumb runs that paid for them',
}

/** Catalog of games that have record books. */
export function RecordsIndexPage() {
  const games = GAMES_WITH_RECORDS.map((slug) => {
    const game = getGame(slug)
    if (!game) return null
    return { ...game, slug: slug as RecordGame }
  }).filter((game): game is NonNullable<typeof game> => Boolean(game))

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev rb">
        <PageBanner
          ariaLabel="Record books"
          kicker={
            <>
              <span className="ev-kicker__bit">Hall of fame</span>
              <span className="ev-kicker__bit">
                {games.length} {games.length === 1 ? 'book' : 'books'} open
              </span>
            </>
          }
          title="Record books"
          blurb="Not the high-score boards — the specialty ledgers. Fastest clears, longest streaks, milestone times. Somebody’s name is in ink."
          art={<EventArt games={games.slice(0, 4).map((g) => g.slug)} />}
        />

        {/*
          First, and not in the grid: it is the only book that is not about a
          cabinet, so putting it among them would read as one more game.
        */}
        <ul className="rb__grid rb__grid--house">
          <li>
            <a
              className="rb-book rb-book--house"
              href={siteRecordsHref()}
              style={{ '--book-accent': HOUSE_ACCENT } as CSSProperties}
            >
              <span className="ev-art ev-art--solo" aria-hidden="true">
                <EventArt games={['snake', 'asteroids', 'pellets', 'putt']} />
              </span>
              <span className="rb-book__text">
                <span className="rb-book__name">House records</span>
                <span className="rb-book__focus">
                  Streaks, busiest days, and who has played the widest
                </span>
              </span>
              <span className="rb-book__go">Open</span>
            </a>
          </li>
        </ul>

        {games.length === 0 ? (
          <p className="lb-empty">No record books yet.</p>
        ) : (
          <ul className="rb__grid">
            {games.map((game) => {
              const accent = resolveGameAccent(game.slug, game.accent)
              return (
                <li key={game.slug}>
                  <a
                    className="rb-book"
                    href={recordsHref(game.slug)}
                    style={{ '--book-accent': accent } as CSSProperties}
                  >
                    <span className="ev-art ev-art--solo" aria-hidden="true">
                      <GameThumbArt slug={game.slug} accent={accent} />
                    </span>
                    <span className="rb-book__text">
                      <span className="rb-book__name">{game.name}</span>
                      <span className="rb-book__focus">{BOOK_FOCUS[game.slug]}</span>
                    </span>
                    <span className="rb-book__go">Open</span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PageShell>
  )
}
