import { useEffect, useState, type CSSProperties } from 'react'
import { HiddenBug } from '../components/BugHunt'
import { ChevronRightIcon } from '../components/chromeIcons'
import { GameHubBoard } from '../components/GameHubBoard'
import { GameHubEvents } from '../components/GameHubEvents'
import { GameHubHero } from '../components/GameHubHero'
import { GameHubHowTo } from '../components/GameHubHowTo'
import { GameHubRecords } from '../components/GameHubRecords'
import { GameHubStanding } from '../components/GameHubStanding'
import { WallTile } from '../components/GameWall'
import { PageShell } from '../components/PageShell'
import { gamePlayableOn, getGame, homeGames } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { useBoardLeaders } from '../hooks/useBoardLeaders'
import { useHubBoard, useHubEvents, useHubHighScore, useHubRecords } from '../hooks/useGameHub'
import { currentHref, homeHref, navigate, periodFromRoute, recordsHref, useRoute } from '../hooks/useHashRoute'
import { usePlayerBests } from '../hooks/usePlayerBests'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { moreLike } from '../lib/gameHub'
import { useGlobalRank } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
import { LEADERBOARD_GAMES, normalizePlayerName, type LeaderboardGame } from '../lib/leaderboard'
import { gameHasRecords } from '../lib/records'
import { resolveGameAccent, THEME_EVENT } from '../lib/theme'
import { preloadGamePage } from './gamePages'

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

type GameHubPageProps = {
  slug: string
  board?: 'scores' | 'records'
}

/**
 * A game's page. Up top, its name and Play beside its screen, where it plays
 * itself under the high score, and next to them the period's board. Then
 * where you stand on it and the one run that moves you, your side of its
 * record book, and any event it is in; how to play it and what scores; and
 * the games most like it.
 */
export function GameHubPage({ slug, board: boardFromRoute }: GameHubPageProps) {
  const route = useRoute()
  const storedPeriod = useDefaultPeriod()
  const period = periodFromRoute(route) ?? storedPeriod
  const game = getGame(slug)
  const device = useDeviceType()
  const { signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const boardSlug = isBoardGame(slug) ? slug : null
  const board = useHubBoard(boardSlug, period, playerName, groupId)
  const highScore = useHubHighScore(boardSlug, groupId)
  const records = useHubRecords(slug, playerName, groupId)
  const events = useHubEvents(slug)
  // For the games below: your best on each, your place on its board, and who leads it, as the wall shows them.
  const bests = usePlayerBests(playerName, period)
  const { byGame } = useGlobalRank()
  const leaders = useBoardLeaders(period)
  const [, setThemeTick] = useState(0)

  // The game's colour is picked for the theme, so a theme change repaints the page.
  useEffect(() => {
    const sync = () => setThemeTick((n) => n + 1)
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  const canPlay = game ? gamePlayableOn(game, device) : false

  // The game is fetched while its page is on screen, so Play opens it without a wait.
  useEffect(() => {
    if (canPlay) preloadGamePage(slug)
  }, [slug, canPlay])

  // An old link to the game's records tab goes to its record book.
  useEffect(() => {
    if (boardFromRoute !== 'records' || !game) return
    const next = recordsHref(game.slug, period)
    if (currentHref() !== next) navigate(next, { replace: true })
  }, [boardFromRoute, game, period])

  if (!game) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  const accent = resolveGameAccent(slug, game.accent)
  const hasRecords = gameHasRecords(game.slug)
  const shelf = homeGames(device)
  const more = moreLike(game, shelf)
  const style = {
    '--gh-accent': accent,
    '--gh-ink': inkOn(accent),
    '--board-accent': accent,
    '--period-accent': accent,
    '--thumb-accent': accent,
  } as CSSProperties

  return (
    <PageShell innerClassName="gh-rail">
      <div className="gh" style={style}>
        <div className={`gh-top${boardSlug ? '' : ' gh-top--solo'}`}>
          <GameHubHero
            game={game}
            accent={accent}
            canPlay={canPlay}
            hasRecords={hasRecords}
            period={period}
            highScore={highScore}
          />
          {boardSlug ? (
            <GameHubBoard slug={boardSlug} gameName={game.name} period={period} board={board} me={playerName} />
          ) : null}
        </div>

        <div className="gh-band">
          {boardSlug ? (
            <GameHubStanding
              slug={boardSlug}
              gameName={game.name}
              period={period}
              board={board}
              me={playerName}
              signedIn={signedIn}
            />
          ) : null}
          {hasRecords ? <GameHubRecords slug={game.slug} gameName={game.name} records={records} me={playerName} /> : null}
          {events.length > 0 ? <GameHubEvents gameName={game.name} events={events} /> : null}
        </div>

        <GameHubHowTo game={game} />

        {more.length > 0 ? (
          <section className="gh-shelf" aria-labelledby="gh-shelf-title">
            <div className="gh-shelf__head">
              <h2 id="gh-shelf-title" className="gh-shelf__title">
                More like {game.name}
                <HiddenBug spot={`shelf-${game.slug}`} pose="peek" />
              </h2>
              <a className="gh-more" href={`${homeHref()}#games`}>
                All {shelf.length} games
                <ChevronRightIcon />
              </a>
            </div>
            <ul className="wall__grid gh-shelf__grid">
              {more.map((g, i) => (
                <WallTile
                  key={g.slug}
                  game={g}
                  index={i}
                  best={bests?.[g.slug] ?? null}
                  standing={byGame[g.slug] ?? null}
                  top={leaders?.[g.slug] ?? null}
                  newFlag={false}
                  preview
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PageShell>
  )
}
