import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { GameThumbArt } from '../components/GameThumbArt'
import { WallTile } from '../components/GameWall'
import { LeaderboardList } from '../components/LeaderboardList'
import { PageShell } from '../components/PageShell'
import { ShareBoardButton } from '../components/ShareBoardButton'
import {
  deviceRequirementLabel,
  getGame,
  gamePlayableOn,
  homeGames,
  TAG_LABELS,
  type Game,
} from '../data/games'
import { useBoardRecord } from '../hooks/useBoardRecord'
import {
  currentHref,
  gameBoardHref,
  gameHref,
  gameHubHref,
  gamePlayHref,
  homeHref,
  navigate,
  periodFromRoute,
  recordsHref,
  useRoute,
} from '../hooks/useHashRoute'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import { APP_NAME } from '../lib/brand'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { gameHasRecords } from '../lib/records'
import { resolveGameAccent, THEME_EVENT } from '../lib/theme'
import { inkOn } from '../lib/color'
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

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

type GameHubPageProps = {
  slug: string
  board?: 'scores' | 'records'
}

/**
 * A game's page, at the width of the home page but not dressed as it: the
 * home page sells one game with a poster, this page is that game's own
 * page. A breadcrumb says where you are, the header sets the mark in a
 * square card beside the name, the blurb, Play and the two links, with your
 * three numbers in a strip at its end. Below it the board stands on the
 * right on a wide screen and the rest of the shelf, as wall tiles, on the
 * left. The rules live in the game itself, not here.
 */
export function GameHubPage({ slug, board: boardFromRoute }: GameHubPageProps) {
  const route = useRoute()
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

  useEffect(() => {
    const sync = () => setThemeTick((n) => n + 1)
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  const canPlay = game ? gamePlayableOn(game, device) : false
  const comingSoon = Boolean(game?.comingSoon)
  const inDevelopment = Boolean(game?.inDevelopment)
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
    if (currentHref() !== next) navigate(next, { replace: true })
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
  const yourBest = you?.score ?? 0
  const firstTag = game.tags?.[0]
  const kicker = inDevelopment
    ? 'In development'
    : comingSoon
      ? 'Coming soon'
      : firstTag
        ? TAG_LABELS[firstTag]
        : 'Game'
  const share = (
    <ShareBoardButton
      label={`Think you can beat me at ${game.name}? Prove it on ${APP_NAME}.`}
      url={gameHref(slug)}
    />
  )

  return (
    <PageShell innerClassName="hub-rail">
      <div
        className="hub"
        style={
          {
            '--event-accent': accent,
            '--event-ink': inkOn(accent),
            '--hero-accent': accent,
            '--hero-ink': inkOn(accent),
            '--board-accent': accent,
            '--period-accent': accent,
            '--tile-accent': accent,
            '--thumb-accent': accent,
          } as CSSProperties
        }
      >
        <nav className="hub__crumbs" aria-label="Breadcrumb">
          <a href={homeHref()}>Games</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{game.name}</span>
        </nav>

        <header className="hub-head" aria-label={game.name}>
          <div className="hub-head__mark" aria-hidden="true">
            <GameThumbArt slug={game.slug} accent={accent} />
          </div>
          <div className="hub-head__text">
            <p className="hub-head__kicker">{kicker}</p>
            <h1 className="hub-head__name">{game.name}</h1>
            <p className="hub-head__blurb">{game.description}</p>
            <div className="hub-head__acts">
              <PlayCta
                game={game}
                canPlay={canPlay}
                comingSoon={comingSoon}
                inDevelopment={inDevelopment}
                playHref={playHref}
                deviceNote={deviceNote}
              />
              {boardHref ? (
                <a className="hub-head__ghost" href={boardHref}>
                  Full board
                </a>
              ) : null}
              {recordsLink ? (
                <a className="hub-head__ghost" href={recordsLink}>
                  Record books
                </a>
              ) : null}
              {share}
            </div>
          </div>
          {boardSlug ? (
            <dl className="hub-head__figures" aria-label="Your numbers">
              <Figure
                label="Your best"
                value={loading ? '…' : yourBest > 0 ? formatLeaderboardScore(slug, yourBest) : '—'}
                sub={PERIOD_LABELS[period]}
              />
              <Figure
                label="Your rank"
                value={loading ? '…' : yourRank != null ? `#${yourRank}` : '—'}
                sub={PERIOD_LABELS[period]}
              />
              <Figure
                label="Record"
                value={allTime > 0 ? formatLeaderboardScore(slug, allTime) : '—'}
                sub="All time"
              />
            </dl>
          ) : null}
        </header>

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
                      navigate(gameHubHref(slug, p))
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
            {others.length > 0 ? (
              <section className="hub__more" aria-label="More games">
                <div className="lst-block__head">
                  <h2 className="lst-block__title">More games</h2>
                  <p className="lst-block__note">{others.length} on the shelf</p>
                </div>
                <ul className="wall__grid">
                  {others.map((g, i) => (
                    <WallTile key={g.slug} game={g} index={i} size="one" best={null} daily={false} />
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

/** One of your numbers in the header: the label, the figure, and what period it is for. */
function Figure({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  return (
    <div className="hub-head__figure">
      <dt>{label}</dt>
      <dd>
        {value}
        <small>{sub}</small>
      </dd>
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
    return <p className="hub__hint">Coming soon — tile preview only.</p>
  }
  if (canPlay) {
    return (
      <>
        <a className="hub-head__cta" href={playHref}>
          {`Play ${game.name}`}
        </a>
        {inDevelopment ? <p className="hub__hint">In development — expect rough edges.</p> : null}
      </>
    )
  }
  return <p className="hub__hint">{deviceNote ?? `${game.name} isn’t available on this device.`}</p>
}
