import { useEffect, useState, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { SiteHeader } from '../components/SiteHeader'
import { Footer } from '../components/Footer'
import { GameThumbArt } from '../components/GameThumbArt'
import { HowToPlayAccordion } from '../components/ScoreGuide'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { TopScorePodium } from '../components/TopScorePodium'
import {
  deviceRequirementLabel,
  getGame,
  gamePlayableOn,
  homeGames,
  type Game,
} from '../data/games'
import { scoringFor } from '../data/scoring'
import { useBoardRecord } from '../hooks/useBoardRecord'
import {
  applySitePeriod,
  gameBoardHref,
  gameHref,
  gameHubHref,
  gamePlayHref,
  recordsHref,
  useHashRoute,
  type Route,
} from '../hooks/useHashRoute'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import { APP_NAME } from '../lib/brand'
import { formatLeaderboardScore } from '../games/spotter/score'
import { gameHasRecords } from '../lib/records'
import {
  getLeaderboard,
  LEADERBOARD_GAMES,
  normalizePlayerName,
  PERIOD_LABELS,
  type LeaderboardGame,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

const TOP_ROWS = 3

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

type GameHubPageProps = {
  slug: string
  board?: 'scores' | 'records'
  period: LeaderboardPeriod
}

export function GameHubPage({ slug, board: boardFromRoute, period }: GameHubPageProps) {
  const route = useHashRoute()
  const game = getGame(slug)
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const personalBest = usePersonalBest(slug)
  const allTime = useBoardRecord(slug)
  const [topEntries, setTopEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canPlay = game ? gamePlayableOn(game, device) : false
  const comingSoon = Boolean(game?.comingSoon)
  const inDevelopment = Boolean(game?.inDevelopment)
  const scoring = scoringFor(slug)
  const boardSlug: LeaderboardGame | null = isBoardGame(slug) ? slug : null
  const accent = game?.accent ?? '#2eb8a0'
  const playHref = gamePlayHref(slug)
  const deviceNote = game ? deviceRequirementLabel(game) : null
  const others = homeGames(device).filter((g) => g.slug !== slug)
  const hasRecords = game ? gameHasRecords(game.slug) : false
  const boardHref = boardSlug ? gameBoardHref(boardSlug, period) : null
  const recordsLink = game ? recordsHref(game.slug, period) : null

  useEffect(() => {
    if (boardFromRoute !== 'records' || !game) return
    const next = recordsHref(game.slug, period)
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
  }, [boardFromRoute, game, period])

  useEffect(() => {
    if (!boardSlug) {
      setTopEntries([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void getLeaderboard(boardSlug, period, playerName || undefined)
      .then((board) => {
        if (cancelled) return
        setTopEntries(board.entries.slice(0, TOP_ROWS))
      })
      .catch((err) => {
        if (cancelled) return
        setTopEntries([])
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [boardSlug, playerName, period])

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

  const playProps = {
    game,
    canPlay,
    comingSoon,
    playHref,
    deviceNote,
  }

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
              '--tile-accent': accent,
              '--thumb-accent': accent,
            } as CSSProperties
          }
        >
          <header className="game-lobby__hero">
            <div className="game-lobby__hero-art">
              <GameThumbArt slug={game.slug} accent={game.accent} />
            </div>
            <div className="game-lobby__hero-main">
              <div className="game-lobby__hero-head">
                <h1 className="lb-page__title game-lobby__title">{game.name}</h1>
                <div className="game-lobby__hero-tools">
                  {boardHref ? (
                    <a className="game-lobby__tool-link" href={boardHref}>
                      Board
                    </a>
                  ) : null}
                  {hasRecords && recordsLink ? (
                    <a className="game-lobby__tool-link" href={recordsLink}>
                      Records
                    </a>
                  ) : null}
                  <ShareBoardButton
                    className="game-lobby__share"
                    label={`Play ${game.name} on ${APP_NAME}`}
                    url={gameHref(slug)}
                  />
                </div>
              </div>

              {inDevelopment && canPlay ? (
                <p className="game-lobby__dev-note">In development — expect rough edges.</p>
              ) : null}

              <div className="game-lobby__hero-row">
                <PlayCta className="game-lobby__play--hero" {...playProps} />
                {boardSlug ? (
                  <div className="game-lobby__stats">
                    <div className="lb-stat">
                      <span className="lb-stat__label">Your best</span>
                      <strong>
                        {personalBest > 0
                          ? formatLeaderboardScore(slug, personalBest)
                          : '—'}
                      </strong>
                    </div>
                    <div className="lb-stat">
                      <span className="lb-stat__label">All time</span>
                      <strong>
                        {allTime > 0 ? formatLeaderboardScore(slug, allTime) : '—'}
                      </strong>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {boardSlug ? (
            <HubScoresSection
              slug={slug}
              boardSlug={boardSlug}
              period={period}
              route={route}
              loading={loading}
              error={error}
              topEntries={topEntries}
              playerName={playerName}
              accent={accent}
            />
          ) : null}

          <HowToPlayAccordion
            how={game.how}
            rows={canPlay ? scoring : null}
          />

          {others.length > 0 ? (
            <section className="game-lobby__others" aria-label="More games">
              <h2 className="game-lobby__section-title">More games</h2>
              <ul className="game-lobby__others-list">
                {others.map((g) => (
                  <li key={g.slug}>
                    <a
                      className="game-lobby__other"
                      href={gameHref(g.slug)}
                      style={{ '--tile-accent': g.accent } as CSSProperties}
                      aria-label={
                        g.comingSoon
                          ? `${g.name}, coming soon`
                          : g.inDevelopment
                            ? `${g.name}, in development`
                            : g.name
                      }
                    >
                      <GameThumbArt slug={g.slug} accent={g.accent} />
                      <span className="game-lobby__other-name">{g.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  )
}

function PlayCta({
  className,
  game,
  canPlay,
  comingSoon,
  playHref,
  deviceNote,
}: {
  className: string
  game: Game
  canPlay: boolean
  comingSoon: boolean
  playHref: string
  deviceNote: string | null
}) {
  if (comingSoon) {
    return (
      <p className={`game-lobby__unavailable ${className}`}>
        Coming soon — tile preview only.
      </p>
    )
  }
  if (canPlay) {
    return (
      <a
        className={`lb-play game-lobby__play ${className}`}
        href={playHref}
        style={{ background: game.accent }}
      >
        {`Play ${game.name}`}
      </a>
    )
  }
  return (
    <p className={`game-lobby__unavailable ${className}`}>
      {deviceNote ?? `${game.name} isn’t available on this device.`}
    </p>
  )
}

function HubScoresSection({
  slug,
  boardSlug,
  period,
  route,
  loading,
  error,
  topEntries,
  playerName,
  accent,
}: {
  slug: string
  boardSlug: LeaderboardGame
  period: LeaderboardPeriod
  route: Route
  loading: boolean
  error: string | null
  topEntries: LeaderboardEntry[]
  playerName: string
  accent: string
}) {
  const periodLabel = PERIOD_LABELS[period]

  return (
    <section className="game-lobby__scores" aria-label={`${periodLabel} top scores`}>
      <h2 className="game-lobby__section-title">{periodLabel} top</h2>

      <PeriodSwitcher
        period={period}
        accent={accent}
        hrefFor={(p) => gameHubHref(slug, p)}
        onSelect={(p) => {
          applySitePeriod(p, route.name === 'game' ? route : { name: 'game', slug, period })
        }}
      />

      <div
        key={`${boardSlug}-${period}`}
        className="lb-board lb-board--fade game-lobby__scores-board"
      >
        {loading ? (
          <BoardSkeleton rows={TOP_ROWS} />
        ) : error ? (
          <BoardEmpty
            title="Couldn’t load scores"
            detail="Check your connection and try again."
          />
        ) : (
          <TopScorePodium
            entries={topEntries}
            playerName={playerName}
            accent={accent}
            slug={boardSlug}
          />
        )}
      </div>
    </section>
  )
}
