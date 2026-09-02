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
import { LeaderboardList } from '../components/LeaderboardList'
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
  gameBoardHref,
  gameHref,
  gameHubHref,
  gamePlayHref,
  periodFromRoute,
  recordsHref,
  useHashRoute,
} from '../hooks/useHashRoute'
import { useDefaultPeriod } from '../lib/defaultPeriod'
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
  type YouEntry,
} from '../lib/leaderboard'

const DESKTOP_ROWS = 10
const MOBILE_PODIUM_ROWS = 3

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

type GameHubPageProps = {
  slug: string
  board?: 'scores' | 'records'
}

export function GameHubPage({ slug, board: boardFromRoute }: GameHubPageProps) {
  const route = useHashRoute()
  const storedPeriod = useDefaultPeriod()
  const period = periodFromRoute(route) ?? storedPeriod
  const game = getGame(slug)
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const personalBest = usePersonalBest(slug)
  const allTime = useBoardRecord(slug)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
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
      setEntries([])
      setYou(null)
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
        setEntries(board.entries)
        setYou(board.you)
      })
      .catch((err) => {
        if (cancelled) return
        setEntries([])
        setYou(null)
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

  const scoresProps = boardSlug
    ? {
        slug,
        boardSlug,
        period,
        loading,
        error,
        entries,
        you,
        playerName,
        accent,
      }
    : null

  return (
    <>
      <main className="lb-page">
        <SiteHeader />
        <div className="lb-page__inner">
          <div
            className={`game-lobby${boardSlug ? ' game-lobby--split' : ''}`}
          style={
            {
              '--board-accent': accent,
              '--period-accent': accent,
              '--tile-accent': accent,
              '--thumb-accent': accent,
            } as CSSProperties
          }
        >
          <div className="game-lobby__layout">
            <div className="game-lobby__main">
              <h1 className="visually-hidden">{game.name}</h1>

              <div className="game-lobby__identity game-lobby__intro">
                <div className="game-lobby__intro-art">
                  <div className="game-lobby__art">
                    <GameThumbArt
                      slug={game.slug}
                      accent={game.accent}
                      className="game-lobby__thumb"
                    />
                  </div>
                </div>

                <div className="game-lobby__intro-body">
                  <div className="game-lobby__intro-links">
                    <ShareBoardButton
                      className="game-lobby__share"
                      label={`Play ${game.name} on ${APP_NAME}`}
                      url={gameHref(slug)}
                    />
                    {boardHref ? (
                      <a className="game-lobby__board-link" href={boardHref}>
                        Full board
                      </a>
                    ) : null}
                    {hasRecords && recordsLink ? (
                      <a className="game-lobby__board-link" href={recordsLink}>
                        Records
                      </a>
                    ) : null}
                  </div>

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
                </div>
              </div>

              <PlayCta
                className={
                  boardSlug ? 'game-lobby__play--mobile' : 'game-lobby__play--wide'
                }
                game={game}
                canPlay={canPlay}
                comingSoon={comingSoon}
                inDevelopment={inDevelopment}
                playHref={playHref}
                deviceNote={deviceNote}
              />

              {scoresProps ? (
                <HubScoresSection
                  {...scoresProps}
                  className="game-lobby__tops game-lobby__tops--mobile"
                  variant="mobile"
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

            {scoresProps ? (
              <HubScoresSection
                {...scoresProps}
                className="game-lobby__aside"
                variant="desktop"
              />
            ) : null}
          </div>
        </div>
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
  inDevelopment,
  playHref,
  deviceNote,
}: {
  className: string
  game: Game
  canPlay: boolean
  comingSoon: boolean
  inDevelopment: boolean
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
      <>
        {inDevelopment ? (
          <p className={`game-lobby__dev-note ${className}`}>
            In development — expect rough edges.
          </p>
        ) : null}
        <a
          className={`lb-play game-lobby__play ${className}`}
          href={playHref}
          style={{ background: game.accent }}
        >
          {`Play ${game.name}`}
        </a>
      </>
    )
  }
  return (
    <p className={`game-lobby__unavailable ${className}`}>
      {deviceNote ?? `${game.name} isn’t available on this device.`}
    </p>
  )
}

function HubScoresSection({
  className,
  variant,
  slug,
  boardSlug,
  period,
  loading,
  error,
  entries,
  you,
  playerName,
  accent,
}: {
  className: string
  variant: 'desktop' | 'mobile'
  slug: string
  boardSlug: LeaderboardGame
  period: LeaderboardPeriod
  loading: boolean
  error: string | null
  entries: LeaderboardEntry[]
  you: YouEntry | null
  playerName: string
  accent: string
}) {
  const periodLabel = PERIOD_LABELS[period]
  const isDesktop = variant === 'desktop'
  const podiumEntries = entries.slice(0, MOBILE_PODIUM_ROWS)

  const onSelectPeriod = (p: LeaderboardPeriod) => {
    window.location.hash = gameHubHref(slug, p)
  }

  return (
    <section className={className} aria-label={`${periodLabel} top scores`}>
      <h2 className="game-lobby__section-title">{periodLabel} top</h2>

      <PeriodSwitcher
        period={period}
        accent={accent}
        hrefFor={(p) => gameHubHref(slug, p)}
        onSelect={onSelectPeriod}
      />

      <div
        key={`${boardSlug}-${period}-${variant}`}
        className="lb-board lb-board--fade game-lobby__scores-board"
      >
        {loading ? (
          <BoardSkeleton rows={isDesktop ? DESKTOP_ROWS : MOBILE_PODIUM_ROWS} />
        ) : error ? (
          <BoardEmpty
            title="Couldn’t load scores"
            detail="Check your connection and try again."
          />
        ) : isDesktop ? (
          <LeaderboardList
            entries={entries}
            you={you}
            playerName={playerName}
            accent={accent}
            shown={DESKTOP_ROWS}
            fillEmptySlots
            formatScore={(score) => formatLeaderboardScore(boardSlug, score)}
          />
        ) : (
          <TopScorePodium
            entries={podiumEntries}
            playerName={playerName}
            accent={accent}
            slug={boardSlug}
          />
        )}
      </div>
    </section>
  )
}
