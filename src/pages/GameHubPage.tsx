import { type CSSProperties } from 'react'
import { SiteHeader } from '../components/SiteHeader'
import { Footer } from '../components/Footer'
import { GameLobbyArt } from '../components/GameLobbyArt'
import {
  deviceRequirementLabel,
  getGame,
  gamePlayableOn,
} from '../data/games'
import { scoringFor } from '../data/scoring'
import { useBoardRecord } from '../hooks/useBoardRecord'
import {
  gameBoardHref,
  gamePlayHref,
  globalRankingsHref,
  recordsHref,
} from '../hooks/useHashRoute'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { useDeviceType } from '../lib/device'
import { gameHasRecords } from '../lib/records'
import {
  LEADERBOARD_GAMES,
  type LeaderboardGame,
} from '../lib/leaderboard'

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

type GameHubPageProps = {
  slug: string
}

export function GameHubPage({ slug }: GameHubPageProps) {
  const game = getGame(slug)
  const device = useDeviceType()
  const personalBest = usePersonalBest(slug)
  const allTime = useBoardRecord(slug)

  const canPlay = game ? gamePlayableOn(game, device) : false
  const comingSoon = Boolean(game?.comingSoon)
  const scoring = scoringFor(slug)
  const boardSlug: LeaderboardGame | null = isBoardGame(slug) ? slug : null
  const accent = game?.accent ?? '#2eb8a0'

  if (!game) {
    return (
      <>
        <main className="lb-page">
          <SiteHeader />
          <div className="lb-page__inner">
            <p className="lb-empty">That game isn’t on the board.</p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const playHref = gamePlayHref(slug)
  const deviceNote = deviceRequirementLabel(game)

  return (
    <>
      <main className="lb-page">
        <SiteHeader />
        <div
          className="lb-page__inner game-lobby"
          style={
            {
              '--board-accent': accent,
              '--period-accent': accent,
            } as CSSProperties
          }
        >
          <a className="rank-page__back" href="#/">
            ← Games
          </a>

          <GameLobbyArt slug={game.slug} accent={game.accent} />

          <header className="game-lobby__header">
            <h1 className="game-lobby__title">{game.name}</h1>
            <p className="game-lobby__blurb">{game.description}</p>
          </header>

          <div className="game-lobby__stats">
            <div className="lb-stat">
              <span className="lb-stat__label">Your best</span>
              <strong>{personalBest > 0 ? personalBest : '—'}</strong>
            </div>
            <div className="lb-stat">
              <span className="lb-stat__label">All time</span>
              <strong>{allTime > 0 ? allTime : '—'}</strong>
            </div>
          </div>

          {comingSoon ? (
            <p className="game-lobby__unavailable">Coming soon — tile preview only.</p>
          ) : canPlay ? (
            <a
              className="lb-play game-lobby__play"
              href={playHref}
              style={{ background: game.accent }}
            >
              Play {game.name}
            </a>
          ) : (
            <p className="game-lobby__unavailable">
              {deviceNote ?? `${game.name} isn’t available on this device.`}
            </p>
          )}

          {boardSlug ? (
            <>
              <a
                className="game-lobby__board-link"
                href={gameBoardHref(boardSlug, 'daily')}
                style={{ '--board-accent': accent } as CSSProperties}
              >
                Leaderboard →
              </a>

              {gameHasRecords(boardSlug) ? (
                <a
                  className="lb-records-cta"
                  href={recordsHref(boardSlug)}
                  style={{ '--board-accent': accent } as CSSProperties}
                >
                  {game.name} record books
                </a>
              ) : null}

              <a className="game-lobby__all-boards" href={globalRankingsHref()}>
                Global rankings
              </a>
            </>
          ) : null}

          <details className="rank-page__how game-lobby__how-panel">
            <summary className="rank-page__how-summary">
              <span className="rank-page__h" id="game-how-heading">
                How to play
              </span>
            </summary>
            <div className="rank-page__how-body">
              <p>{game.how}</p>
              {scoring && scoring.length > 0 ? (
                <ul className="game-lobby__scoring">
                  {scoring.map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        </div>
      </main>
      <Footer />
    </>
  )
}
