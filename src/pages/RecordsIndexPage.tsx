import { PeriodSwitcher } from '../components/BoardChrome'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { recordsHref, recordsIndexHref } from '../hooks/useHashRoute'
import { defaultPeriod } from '../lib/defaultPeriod'
import { type LeaderboardPeriod } from '../lib/leaderboard'
import { GAMES_WITH_RECORDS } from '../lib/records'

/** Catalog of games that have record books. */
export function RecordsIndexPage({
  period: periodFromRoute,
}: {
  period?: LeaderboardPeriod
}) {
  const period = periodFromRoute ?? defaultPeriod()
  const games = GAMES_WITH_RECORDS.map((slug) => getGame(slug)).filter(
    (game): game is NonNullable<typeof game> => Boolean(game),
  )

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--summary">
      <header className="lb-page__header lb-page__header--compact">
        <h1 className="lb-page__title">Record books</h1>
      </header>

      <PeriodSwitcher
        period={period}
        hrefFor={recordsIndexHref}
        onSelect={(p) => {
          window.location.hash = recordsIndexHref(p)
        }}
      />

      {games.length === 0 ? (
        <p className="lb-empty">No record books yet.</p>
      ) : (
        <ul className="records-index">
          {games.map((game) => (
            <li key={game.slug}>
              <a className="records-index__card" href={recordsHref(game.slug, period)}>
                <GameThumbArt slug={game.slug} accent={game.accent} />
                <span className="records-index__copy">
                  <span className="records-index__name">{game.name}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
