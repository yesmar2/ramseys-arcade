import { Footer } from '../components/Footer'
import { HomeBar } from '../components/HomeBar'
import { getGame } from '../data/games'
import { leaderboardHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useGlobalRank } from '../lib/globalRank'
import { LEADERBOARD_GAMES, normalizePlayerName } from '../lib/leaderboard'

export function RankPage() {
  const name = normalizePlayerName(usePlayerName())
  const { rank, score, totalPlayers, byGame } = useGlobalRank()

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner rank-page">
          <header className="lb-page__header">
            <h1 className="lb-page__title">Global rank</h1>
            <p className="lb-page__blurb">
              {name
                ? 'Your all-time standing across every game board.'
                : 'Set a gamer tag to earn a global rank.'}
            </p>
          </header>

          <section className="rank-page__summary" aria-label="Your rank">
            <div className="lb-stat">
              <span className="lb-stat__label">Rank</span>
              <strong>{rank != null ? `#${rank}` : '—'}</strong>
            </div>
            <div className="lb-stat">
              <span className="lb-stat__label">Points</span>
              <strong>{name && score > 0 ? score : '—'}</strong>
            </div>
            <div className="lb-stat">
              <span className="lb-stat__label">Players</span>
              <strong>{totalPlayers > 0 ? totalPlayers : '—'}</strong>
            </div>
          </section>

          <section className="rank-page__board" aria-labelledby="rank-games-heading">
            <h2 id="rank-games-heading" className="rank-page__h">
              By game
            </h2>
            <ul className="rank-page__list">
              {LEADERBOARD_GAMES.map((slug) => {
                const game = getGame(slug)
                const row = byGame[slug]
                return (
                  <li key={slug} className="rank-page__row">
                    <a className="rank-page__game" href={leaderboardHref(slug, 'all')}>
                      {game?.name ?? slug}
                    </a>
                    {row ? (
                      <>
                        <span className="rank-page__place">#{row.place}</span>
                        <span className="rank-page__pts">+{row.points}</span>
                      </>
                    ) : (
                      <>
                        <span className="rank-page__place rank-page__place--empty">—</span>
                        <span className="rank-page__pts rank-page__pts--empty">0</span>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="rank-page__how" aria-labelledby="rank-how-heading">
            <h2 id="rank-how-heading" className="rank-page__h">
              How it works
            </h2>
            <p>
              Your global rank uses <strong>all-time</strong> placements on each
              game’s leaderboard. Place higher on a board to earn more points:
            </p>
            <ul className="rank-page__rules">
              <li>
                <span>1st place</span>
                <strong>100 pts</strong>
              </li>
              <li>
                <span>2nd place</span>
                <strong>99 pts</strong>
              </li>
              <li>
                <span>3rd place</span>
                <strong>98 pts</strong>
              </li>
              <li>
                <span>100th place</span>
                <strong>1 pt</strong>
              </li>
            </ul>
            <p>
              Points from every game are added together. Climb any board to move
              up — playing more games helps too.
            </p>
          </section>

          <a className="rank-page__boards" href={leaderboardHref()}>
            Open leaderboards
          </a>
        </div>
      </main>
      <Footer />
    </>
  )
}
