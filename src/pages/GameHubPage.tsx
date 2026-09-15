import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { GameThumbArt } from '../components/GameThumbArt'
import { GameTile } from '../components/GameTile'
import { HowToPlayContent } from '../components/ScoreGuide'
import { LeaderboardList } from '../components/LeaderboardList'
import { PageShell } from '../components/PageShell'
import { ShareBoardButton } from '../components/ShareBoardButton'
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
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import { APP_NAME } from '../lib/brand'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { gameHasRecords } from '../lib/records'
import { resolveGameAccent, THEME_EVENT } from '../lib/theme'
import {
  getLeaderboard,
  LEADERBOARD_GAMES,
  normalizePlayerName,
  PERIOD_LABELS,
  type LeaderboardGame,
  type LeaderboardEntry,
  type YouEntry,
} from '../lib/leaderboard'

const BOARD_ROWS = 10
const RULES_SHOWN = 6

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

type GameHubPageProps = {
  slug: string
  board?: 'scores' | 'records'
}

/**
 * A game's page: the hero with its art, blurb and play button, your numbers
 * beside it, then the board on one side and how to play plus the rest of
 * the shelf on the other.
 */
export function GameHubPage({ slug, board: boardFromRoute }: GameHubPageProps) {
  const route = useHashRoute()
  const storedPeriod = useDefaultPeriod()
  const period = periodFromRoute(route) ?? storedPeriod
  const game = getGame(slug)
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const allTime = useBoardRecord(slug)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setThemeTick] = useState(0)
  const [allRules, setAllRules] = useState(false)

  useEffect(() => {
    const sync = () => setThemeTick((n) => n + 1)
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  const canPlay = game ? gamePlayableOn(game, device) : false
  const comingSoon = Boolean(game?.comingSoon)
  const inDevelopment = Boolean(game?.inDevelopment)
  const scoring = scoringFor(slug)
  const boardSlug: LeaderboardGame | null = isBoardGame(slug) ? slug : null
  const accent = resolveGameAccent(slug, game?.accent ?? '#2eb8a0')
  const playHref = gamePlayHref(slug)
  const deviceNote = game ? deviceRequirementLabel(game) : null
  const others = homeGames(device).filter((g) => g.slug !== slug)
  const hasRecords = game ? gameHasRecords(game.slug) : false
  const boardHref = boardSlug ? gameBoardHref(boardSlug, period) : null
  const recordsLink = game && hasRecords ? recordsHref(game.slug, period) : null

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
  }, [boardSlug, playerName, period, groupId])

  if (!game) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  const players = entries.length
  const yourRank = you?.rank ?? null
  const share = (
    <ShareBoardButton
      label={`Think you can beat me at ${game.name}? Prove it on ${APP_NAME}.`}
      url={gameHref(slug)}
    />
  )
  const rules = canPlay && scoring?.length ? scoring : null
  const shownRules = rules && !allRules && rules.length > RULES_SHOWN + 1 ? rules.slice(0, RULES_SHOWN) : rules
  const yourBest = you?.score ?? 0

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div
        className="ev hub"
        style={
          {
            '--event-accent': accent,
            '--hero-accent': accent,
            '--board-accent': accent,
            '--period-accent': accent,
            '--tile-accent': accent,
            '--thumb-accent': accent,
          } as CSSProperties
        }
      >
        <section className="hero" aria-label={game.name}>
          {!boardSlug ? (
            <div className="hero__corner">{share}</div>
          ) : null}
          <div className={`hero__main${boardSlug ? '' : ' hero__main--bare'}`}>
            <GameThumbArt slug={game.slug} accent={accent} className="hero__art hub__art" />
            <div className="hero__text">
              <p className="ev-kicker hero__kicker">
                <span className="ev-kicker__bit">Game</span>
                {inDevelopment ? (
                  <span className="ev-kicker__bit">In development</span>
                ) : comingSoon ? (
                  <span className="ev-kicker__bit">Coming soon</span>
                ) : null}
                {boardSlug && !loading && !error && players > 0 ? (
                  <span className="ev-kicker__bit">
                    {players} {players === 1 ? 'player' : 'players'} · {PERIOD_LABELS[period]}
                  </span>
                ) : null}
              </p>
              <h1 className="hero__title">{game.name}</h1>
              <p className="hero__sub">{game.description}</p>
            </div>

            <div className="hero__actions hub__actions">
              <PlayCta
                game={game}
                canPlay={canPlay}
                comingSoon={comingSoon}
                inDevelopment={inDevelopment}
                playHref={playHref}
                deviceNote={deviceNote}
              />
              {boardHref ? (
                <a className="hero__ghost" href={boardHref}>
                  Full board
                </a>
              ) : null}
              {recordsLink ? (
                <a className="hero__ghost" href={recordsLink}>
                  Record books
                </a>
              ) : null}
            </div>

            {boardSlug ? (
              <div className="hero__aside hub__aside">
                <div className="hub__corner">{share}</div>
                <div className="hub__stats" aria-label="Your numbers">
                <HubStat
                  label="Your best"
                  value={
                    loading
                      ? '…'
                      : yourBest > 0
                        ? formatLeaderboardScore(slug, yourBest)
                        : '—'
                  }
                  sub={PERIOD_LABELS[period]}
                  empty={!loading && yourBest <= 0}
                />
                <HubStat
                  label="Your rank"
                  value={loading ? '…' : yourRank != null ? `#${yourRank}` : '—'}
                  sub={PERIOD_LABELS[period]}
                  empty={!loading && yourRank == null}
                />
                <HubStat
                  label="Record"
                  value={allTime > 0 ? formatLeaderboardScore(slug, allTime) : '—'}
                  sub="All time"
                  empty={allTime <= 0}
                />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div className={`hub__layout${boardSlug ? ' hub__layout--split' : ''}`}>
          {boardSlug ? (
            <section className="lst-block hub__board" aria-label={`${PERIOD_LABELS[period]} top scores`}>
              <div className="lst-block__head">
                <h2 className="lst-block__title">Top scores</h2>
                {!loading && !error && players > 0 ? (
                  <p className="lst-block__note">
                    {players} {players === 1 ? 'player' : 'players'}
                  </p>
                ) : null}
                <div className="lst-block__tools">
                  <PeriodSwitcher
                    period={period}
                    accent={accent}
                    hrefFor={(p) => gameHubHref(slug, p)}
                    onSelect={(p) => {
                      window.location.hash = gameHubHref(slug, p)
                    }}
                  />
                </div>
              </div>
              <div key={`${boardSlug}-${period}`} className="lb-board--fade">
                {loading ? (
                  <BoardSkeleton rows={BOARD_ROWS} />
                ) : error ? (
                  <BoardEmpty
                    title="Couldn’t load scores"
                    detail="Check your connection and try again."
                  />
                ) : entries.length === 0 && !you ? (
                  <BoardEmpty title={groupBoardEmptyTitle('No scores yet')} />
                ) : (
                  <LeaderboardList
                    entries={entries}
                    you={you}
                    playerName={playerName}
                    accent={accent}
                    shown={BOARD_ROWS}
                    fillEmptySlots
                    period={period}
                    formatScore={(score) => formatLeaderboardScore(boardSlug, score)}
                  />
                )}
              </div>
              {boardHref && !loading && !error && players > BOARD_ROWS ? (
                <a className="lst__more" href={boardHref}>
                  Full board · {players}
                </a>
              ) : null}
            </section>
          ) : null}

          <div className="hub__side">
            <section className="ev-card hub__how" aria-labelledby="game-how-heading">
              <div className="ev-card__head">
                <h2 className="ev-card__title" id="game-how-heading">
                  How to play
                </h2>
                {rules ? (
                  <p className="ev-card__note">
                    {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
                  </p>
                ) : null}
              </div>
              <div className="ev-card__body">
                <HowToPlayContent
                  how={game.how}
                  rows={shownRules}
                  listClassName="hub__scoring"
                />
                {rules && shownRules && shownRules.length < rules.length ? (
                  <div className="hub__rules-more">
                    <button type="button" className="lst__more" onClick={() => setAllRules(true)}>
                      All {rules.length} rules
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            {others.length > 0 ? (
              <section className="hub__more" aria-label="More games">
                <div className="lst-block__head">
                  <h2 className="lst-block__title">More games</h2>
                  <p className="lst-block__note">{others.length} on the shelf</p>
                </div>
                <ul className="hub__grid">
                  {others.map((g, i) => (
                    <GameTile key={g.slug} game={g} index={i} showOnAllDevices />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function HubStat({
  label,
  value,
  sub,
  empty = false,
}: {
  label: string
  value: ReactNode
  sub: string
  empty?: boolean
}) {
  return (
    <div className={`hub__stat${empty ? ' hub__stat--empty' : ''}`}>
      <span className="hub__stat-label">{label}</span>
      <span className="hub__stat-value">{value}</span>
      <span className="hub__stat-sub">{sub}</span>
    </div>
  )
}

function PlayCta({
  game,
  canPlay,
  comingSoon,
  inDevelopment,
  playHref,
  deviceNote,
}: {
  game: Game
  canPlay: boolean
  comingSoon: boolean
  inDevelopment: boolean
  playHref: string
  deviceNote: string | null
}) {
  if (comingSoon) {
    return <span className="hero__hint">Coming soon — tile preview only.</span>
  }
  if (canPlay) {
    return (
      <>
        <a className="hero__cta" href={playHref}>
          {`Play ${game.name}`}
        </a>
        {inDevelopment ? (
          <span className="hero__hint">In development — expect rough edges.</span>
        ) : null}
      </>
    )
  }
  return (
    <span className="hero__hint">
      {deviceNote ?? `${game.name} isn’t available on this device.`}
    </span>
  )
}
