import { useEffect, useState, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
} from '../components/BoardChrome'
import { SiteHeader } from '../components/SiteHeader'
import { Footer } from '../components/Footer'
import { GameThumbArt } from '../components/GameThumbArt'
import { HowToPlayAccordion } from '../components/ScoreGuide'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { PodiumMedal, medalKind } from '../components/PodiumMedal'
import { PlayerAvatar } from '../components/PlayerAvatar'
import {
  deviceRequirementLabel,
  getGame,
  gamePlayableOn,
  homeGames,
} from '../data/games'
import { scoringFor } from '../data/scoring'
import { useBoardRecord } from '../hooks/useBoardRecord'
import {
  gameBoardHref,
  gameHref,
  gamePlayHref,
  recordsHref,
} from '../hooks/useHashRoute'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import { APP_NAME } from '../lib/brand'
import { gameHasRecords } from '../lib/records'
import {
  getLeaderboard,
  LEADERBOARD_GAMES,
  normalizePlayerName,
  type LeaderboardGame,
  type LeaderboardEntry,
} from '../lib/leaderboard'

const TOP_ROWS = 3

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

type GameHubPageProps = {
  slug: string
  board?: 'scores' | 'records'
}

export function GameHubPage({ slug, board: boardFromRoute }: GameHubPageProps) {
  const game = getGame(slug)
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const personalBest = usePersonalBest(slug)
  const allTime = useBoardRecord(slug)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
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

  // Old hub records tab → dedicated record books page.
  useEffect(() => {
    if (boardFromRoute !== 'records' || !game) return
    const next = recordsHref(game.slug)
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
  }, [boardFromRoute, game])

  useEffect(() => {
    if (!boardSlug) {
      setEntries([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getLeaderboard(boardSlug, 'daily', playerName || undefined)
      .then((board) => {
        if (cancelled) return
        setEntries(board.entries)
      })
      .catch((err) => {
        if (cancelled) return
        setEntries([])
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [boardSlug, playerName])

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

  const topEntries = entries.slice(0, TOP_ROWS)
  const boardHref = boardSlug ? gameBoardHref(boardSlug, 'daily') : null

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
          <div className="game-lobby__hero">
            <div className="game-lobby__art">
              <GameThumbArt
                slug={game.slug}
                accent={game.accent}
                className="game-lobby__thumb"
              />
              <ShareBoardButton
                className="game-lobby__share"
                label={`Play ${game.name} on ${APP_NAME}`}
                url={gameHref(slug)}
              />
              <h1 className="game-lobby__title">{game.name}</h1>
            </div>

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
          </div>

          {inDevelopment ? (
            <p className="game-lobby__unavailable">In development — not ready to play yet.</p>
          ) : comingSoon ? (
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
            <section className="game-lobby__tops" aria-label={`${game.name} today’s top scores`}>
              <div className="game-lobby__tops-head">
                <h2 className="game-lobby__section-title">Today’s top</h2>
                <div className="game-lobby__tops-links">
                  {boardHref ? (
                    <a className="game-lobby__board-link" href={boardHref}>
                      Full board
                    </a>
                  ) : null}
                  {hasRecords ? (
                    <a className="game-lobby__board-link" href={recordsHref(game.slug)}>
                      Records
                    </a>
                  ) : null}
                </div>
              </div>

              <div
                key={boardSlug}
                className="lb-board lb-board--fade game-lobby__tops-board"
              >
                {loading ? (
                  <BoardSkeleton rows={TOP_ROWS} />
                ) : error ? (
                  <BoardEmpty
                    title="Couldn’t load scores"
                    detail="Check your connection and try again."
                  />
                ) : (
                  <TopScoreCards
                    entries={topEntries}
                    playerName={playerName}
                    accent={accent}
                  />
                )}
              </div>
            </section>
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

/** Today’s top 3 as medal cards (empty slots stay open). */
function TopScoreCards({
  entries,
  playerName,
  accent,
}: {
  entries: LeaderboardEntry[]
  playerName: string
  accent: string
}) {
  const slots = Array.from({ length: TOP_ROWS }, (_, index) => entries[index] ?? null)

  return (
    <ol
      className="game-lobby__podium"
      style={{ '--board-accent': accent, '--lb-you-accent': accent } as CSSProperties}
    >
      {slots.map((entry, index) => {
        const rank = index + 1
        const medal = medalKind(rank)
        if (!entry) {
          return (
            <li
              key={`open-${rank}`}
              className={`game-lobby__podium-card game-lobby__podium-card--open${medal ? ` game-lobby__podium-card--${medal}` : ''}`}
            >
              {medal ? <PodiumMedal kind={medal} /> : (
                <span className="game-lobby__podium-rank">#{rank}</span>
              )}
              <span className="game-lobby__podium-name game-lobby__podium-name--muted">Open</span>
              <strong className="game-lobby__podium-score game-lobby__podium-score--muted">—</strong>
            </li>
          )
        }
        const name = normalizePlayerName(entry.name ?? '')
        const isYou = Boolean(playerName) && name === playerName
        return (
          <li
            key={entry.id ?? `${rank}-${name}`}
            className={`game-lobby__podium-card${isYou ? ' game-lobby__podium-card--you' : ''}${medal ? ` game-lobby__podium-card--${medal}` : ''}`}
            aria-current={isYou ? 'true' : undefined}
          >
            {medal ? <PodiumMedal kind={medal} /> : (
              <span className="game-lobby__podium-rank">#{rank}</span>
            )}
            <PlayerAvatar avatarId={entry.avatarId} name={name} size="sm" />
            <span className="game-lobby__podium-name" title={name}>
              {name}
              {isYou ? <span className="lb-row__you-tag">You</span> : null}
            </span>
            <strong className="game-lobby__podium-score">
              {entry.score.toLocaleString()}
            </strong>
          </li>
        )
      })}
    </ol>
  )
}
