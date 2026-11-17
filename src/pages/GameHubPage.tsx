import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronRightIcon } from '../components/chromeIcons'
import { DailiesBar } from '../components/DailiesBar'
import { DailyRecordsPeek } from '../components/DailyRecordsPeek'
import { BoardPeek, GamePageBoard } from '../components/GameBoard'
import { GameHubEvents } from '../components/GameHubEvents'
import { GameHubHero } from '../components/GameHubHero'
import { WallTile } from '../components/GameWall'
import { PageShell } from '../components/PageShell'
import { RecordBookView, RecordsPeek } from '../components/RecordBookView'
import { gamePlayableOn, getGame, isRankedGame, wallGames } from '../data/games'
import { useBoardLeaders } from '../hooks/useBoardLeaders'
import { useHubEvents, useHubHighScore } from '../hooks/useGameHub'
import { BOARD_PLACE, dailyTabHref, gameHref, homeHref, navigate, periodFromRoute, RECORDS_PLACE, useRoute } from '../hooks/useHashRoute'
import { scrollToPlace, stillComing } from '../lib/scrollToPlace'
import { boardPeriodFor } from '../lib/allTime'
import { usePlayerBests } from '../hooks/usePlayerBests'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn, mixColor, readableFill, readableText } from '../lib/color'
import { dailyWords, type DailyTab } from '../lib/dailyWords'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { moreLike } from '../lib/gameHub'
import { useGlobalRank } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
import { lazyPage, type LazyPage } from '../lib/lazyPage'
import { possessive } from '../lib/possessive'
import { coerceVisiblePeriod, LEADERBOARD_GAMES, normalizePlayerName, type LeaderboardGame, type LeaderboardPeriod } from '../lib/leaderboard'
import { gameHasRecords } from '../lib/records'
import { resolveGameAccent, THEME_EVENT } from '../lib/theme'
import { preloadGamePage } from './gamePages'

/**
 * Each daily's today over its screen (GameHubHero), where its Today card was till B of the "Game page, simpler"
 * canvas (2026-11-17): "Today's Track #33 · Glacier Circuit". Each in its Today card's chunk, with the plan it reads.
 */
const TODAY_NAMES = {
  acechase: lazyPage(() => import('../components/TodaysHoleCard').then((m) => m.TodayName)),
  hotlap: lazyPage(() => import('../components/TodaysTrackCard').then((m) => m.TodayName)),
  findbug: lazyPage(() => import('../components/TodaysWantedCard').then((m) => m.TodayName)),
  halffull: lazyPage(() => import('../components/TodaysPourCard').then((m) => m.TodayName)),
  centroid: lazyPage(() => import('../components/TodaysPlatesCard').then((m) => m.TodayName)),
  marblerun: lazyPage(() => import('../components/TodaysCourseCard').then((m) => m.TodayName)),
  lander: lazyPage(() => import('../components/TodaysCaveCard').then((m) => m.TodayName)),
  swoop: lazyPage(() => import('../components/TodaysHillsCard').then((m) => m.TodayName)),
  wobblerun: lazyPage(() => import('../components/TodaysGauntletCard').then((m) => m.TodayName)),
  sling: lazyPage(() => import('../components/TodaysTowerCard').then((m) => m.TodayName)),
} as Partial<Record<string, LazyPage<object>>>

/** A racing daily's run kept on this device signed out, under Play on its screen, as its Today card said it. */
const TODAY_KEPT = {
  hotlap: lazyPage(() => import('../components/TodaysTrackCard').then((m) => m.TodayKept)),
  marblerun: lazyPage(() => import('../components/TodaysCourseCard').then((m) => m.TodayKept)),
  lander: lazyPage(() => import('../components/TodaysCaveCard').then((m) => m.TodayKept)),
  swoop: lazyPage(() => import('../components/TodaysHillsCard').then((m) => m.TodayKept)),
  wobblerun: lazyPage(() => import('../components/TodaysGauntletCard').then((m) => m.TodayKept)),
  sling: lazyPage(() => import('../components/TodaysTowerCard').then((m) => m.TodayKept)),
} as Partial<Record<string, LazyPage<object>>>

/** A daily just for fun's own cards under its screen (data/games.ts Game.ranked): your days on it, and today part by part. */
const YourDaysCard = lazyPage(() => import('../components/YourDays').then((m) => m.YourDaysCard))
const TodaysHoleByTry = lazyPage(() => import('../components/TodaysHoleCard').then((m) => m.TodaysHoleByTry))
const TODAY_PARTS: Partial<Record<string, typeof TodaysHoleByTry>> = {
  acechase: TodaysHoleByTry,
  findbug: lazyPage(() => import('../components/TodaysWantedCard').then((m) => m.TodaysWantedByScene)),
  halffull: lazyPage(() => import('../components/TodaysPourCard').then((m) => m.TodaysPourByGlass)),
  centroid: lazyPage(() => import('../components/TodaysPlatesCard').then((m) => m.TodaysPlatesByPlate)),
}

/** A daily's other two tabs, each in a chunk of its own with the plans it reads. */
const DailyPastTab = lazyPage(() => import('../components/DailyPastTab').then((m) => m.DailyPastTab))
const DailyRecordsTab = lazyPage(() => import('../components/DailyRecordsTab').then((m) => m.DailyRecordsTab))

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

/** A past course's row, as dailyTabHref's anchor names it (`#course-3`): the Past tab lands on it itself. */
const COURSE_ANCHOR = '#course-'

type GameHubPageProps = {
  slug: string
  board?: 'scores' | 'records'
  /** A daily's tab: its past courses or its records. Its page itself is the Today tab. */
  tab?: 'past' | 'records'
}

/**
 * A game's page, and its only one (Ramsey picked B of the "Game page: board and records" canvas, 2026-10-11: no
 * board page and no record book of its own). Up top and across the page, its screen, where it plays itself under
 * the high score, with its name and Play on it. Since B of the "Game page, simpler" canvas (Ramsey, 2026-11-17:
 * "it's too much text and i want it simplified", then "Build B"), no tabs: the top of the board and a few records
 * side by side, then any event it is in, then the games most like it. Each opens in full in their place, at the
 * addresses the tabs had: the board at its period's (`/games/<slug>/<period>`), the records at theirs
 * (`/games/<slug>/records`), each with a way back. A game with no records has just its board, in full.
 *
 * A daily's page is today's, and since "Yes, do dailies" (2026-11-17) it has no tabs either: today's course is
 * named on its screen, with the clock to the next and its past courses beside Play, where its Today card and tabs
 * were. Under it, the top of today's board (its week and month in the menu) beside its records; each opens in full
 * with a way back, today's board at `/games/<daily>/today`, its records at `/records`, its past courses at
 * `/past`. One just for fun (data/games.ts Game.ranked) places nobody: under its screen are your days and today
 * part by part, and it has no records.
 */
export function GameHubPage({ slug, board: boardFromRoute, tab: tabFromRoute }: GameHubPageProps) {
  const route = useRoute()
  const storedPeriod = useDefaultPeriod()
  const game = getGame(slug)
  const daily = Boolean(game?.daily)
  const ranked = isRankedGame(slug)
  // A daily just for fun has no records tab: an old link to it is its Today tab.
  const tab: DailyTab = daily ? (tabFromRoute === 'records' && !ranked ? 'today' : (tabFromRoute ?? 'today')) : 'today'
  const boardSlug = isBoardGame(slug) ? slug : null
  const routePeriod = periodFromRoute(route)
  // Another game, when it keeps records: its board and records side by side, each a tap from in full.
  const withRecords = !daily && boardSlug !== null && gameHasRecords(slug)
  // What the page shows under its screen: the two side by side (its own address), the board in full (a period's),
  // or the records in full (theirs). A game with no records has its board in full at either.
  const gameView: 'both' | 'board' | 'records' = !withRecords
    ? 'board'
    : boardFromRoute === 'records'
      ? 'records'
      : routePeriod
        ? 'board'
        : 'both'
  // The board's period: the site's, or the address's on the full board. A daily's board is today's on its page,
  // its week or month when the address says (gameBoardHref), whatever the site's period.
  const boardPeriod: LeaderboardPeriod = daily
    ? routePeriod && routePeriod !== 'daily'
      ? boardPeriodFor(slug, routePeriod)
      : 'daily'
    : gameView === 'records'
      ? storedPeriod
      : (routePeriod ?? storedPeriod)
  // The records' period is their own: all time unless the address asks (recordsHref).
  const recordsPeriod: LeaderboardPeriod = gameView === 'records' && routePeriod ? coerceVisiblePeriod(routePeriod) : 'all'
  // A daily's the same way: today's under its screen (its own address), or its past courses, its records, or a
  // board (today's, its week's or month's) in full.
  const dailyView: 'today' | 'past' | 'records' | 'board' = tab === 'past' ? 'past' : tab === 'records' ? 'records' : routePeriod ? 'board' : 'today'
  // The board under a daily's screen keeps its own period, today unless picked: a daily has no site period.
  const [dailyPeek, setDailyPeek] = useState<LeaderboardPeriod>('daily')
  // The games below show their bests and leaders for the day on a daily's page, else for the board's period.
  const period: LeaderboardPeriod = daily ? 'daily' : boardPeriod
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  // The board's Try again asks again for the high score too: they come from the same boards.
  const [scoreAsks, setScoreAsks] = useState(0)
  const highScore = useHubHighScore(ranked ? boardSlug : null, groupId, scoreAsks)
  const askScoreAgain = () => setScoreAsks((n) => n + 1)
  const events = useHubEvents(slug)
  // For the games below: your best on each, your place on its board, and who leads it, as the wall shows them.
  const bests = usePlayerBests(playerName, period)
  const { byGame } = useGlobalRank()
  const { leaders, failed: leadersFailed } = useBoardLeaders(period)
  const [, setThemeTick] = useState(0)
  // What the page shows under its screen: brought into view when it changes (below).
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabKey = daily ? dailyView : gameView
  const shownTab = useRef(tabKey)

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

  // A daily's past courses and records are fetched while its page is up, so they open without a wait.
  useEffect(() => {
    if (!daily) return
    void DailyPastTab.preload()
    if (ranked) void DailyRecordsTab.preload()
    else {
      void YourDaysCard.preload()
      void TODAY_PARTS[slug]?.preload()
    }
  }, [daily, ranked, slug])

  // An old link to the records tab of a daily just for fun lands on its Today tab.
  useEffect(() => {
    if (!daily || ranked || tabFromRoute !== 'records') return
    navigate(dailyTabHref(slug, 'today'), { replace: true })
  }, [daily, ranked, tabFromRoute, slug])

  // A new tab, or the board or records opened in full (or closed again), keeps the screen and brings what changed up
  // to the top, unless it's already in the top half of the screen. A past course's row, when one is named, lands
  // itself. So does the board or the records when a link on this page names them (#board, #records: "its board" on
  // a daily's Records tab): the app's own landing on a link's place is for a new page, and a tab is the same page.
  useEffect(() => {
    if (shownTab.current === tabKey) return
    shownTab.current = tabKey
    const hash = window.location.hash.slice(1)
    if (hash === BOARD_PLACE || hash === RECORDS_PLACE) {
      // Its rows still coming, the tabs come up first, as for any tab, and the place once the rows are in (stillComing).
      if (stillComing(document.getElementById(hash))) tabsRef.current?.scrollIntoView({ block: 'start' })
      return scrollToPlace(() => document.getElementById(hash))
    }
    const bar = tabsRef.current
    if (!bar || window.location.hash.startsWith(COURSE_ANCHOR)) return
    const top = bar.getBoundingClientRect().top
    if (top < 0 || top > window.innerHeight * 0.5) bar.scrollIntoView({ block: 'start' })
  }, [tabKey])

  // A game the site doesn't have never gets here: its address is Game Over (useHashRoute parseUrl).
  if (!game) return null

  const accent = resolveGameAccent(slug, game.accent)
  const shelf = wallGames(device)
  const { games: more, alike } = moreLike(game, shelf)
  const style = {
    '--gh-accent': accent,
    '--gh-ink': inkOn(accent),
    '--gh-fill': readableFill(accent),
    // The game's colour for small words (hub.css): on the light page as it reads on a tag over the hero (its
    // deepest tint), on the dark one the usual light mix, lighter only where it has to be.
    '--gh-text': readableText(accent, mixColor(accent, '#ffffff', 0.71)),
    '--gh-text-dark': readableText(mixColor(accent, '#e7eef3', 0.3), mixColor(accent, '#18242e', 0.67), '#ffffff'),
    '--board-accent': accent,
    '--period-accent': accent,
    '--period-text': readableText(accent, mixColor(accent, '#ffffff', 0.86)),
    '--thumb-accent': accent,
  } as CSSProperties

  // A daily's today on its screen: its course's name (a line held while its chunk comes), the run this device keeps
  // signed out, the clock to the next and its past courses.
  const TodayName = daily ? TODAY_NAMES[game.slug] : undefined
  const TodayKept = daily ? TODAY_KEPT[game.slug] : undefined
  const today = daily
    ? {
        name: TodayName ? (
          <Suspense fallback={<span className="skel-line" style={{ '--skel-w': '14em' } as CSSProperties} />}>
            <TodayName />
          </Suspense>
        ) : null,
        kept: TodayKept ? (
          <Suspense fallback={null}>
            <TodayKept />
          </Suspense>
        ) : null,
        pastHref: dailyTabHref(game.slug, 'past'),
        pastLabel: dailyWords(game.slug).pastTab,
        // A daily just for fun's clock is a blip hunt hiding place, where its Today card was (lib/bugHunt.ts).
        clockHunt: ranked ? undefined : `b-head-${game.slug}`,
      }
    : undefined
  const hero = <GameHubHero game={game} accent={accent} canPlay={canPlay} highScore={highScore} today={today} />
  const eventsCard = events.length > 0 ? <GameHubEvents gameName={game.name} events={events} /> : null
  // Back from the board, records or past courses in full to the page's own view.
  const backLink = (
    <a className="gh-back" href={gameHref(game.slug)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 6-6 6 6 6" />
      </svg>
      Back<span className="visually-hidden"> to {possessive(game.name)} page</span>
    </a>
  )
  // Blip hunt hiding places (lib/bugHunt.ts): with records, the records beside the board hold one and the games like
  // it the other; with none, the games like it hold the first and the line over the board the other. A daily just for
  // fun's games like it are where its tabs' was.
  const shelfHunt = daily
    ? ranked
      ? `g-stand-${game.slug}`
      : `b-board-${game.slug}`
    : withRecords
      ? `g-stand-${game.slug}`
      : `g-board-${game.slug}`
  const shelfSection =
    more.length > 0 ? (
      <section className="gh-shelf" aria-labelledby="gh-shelf-title" data-hunt={shelfHunt}>
        <div className="gh-shelf__head">
          <h2 id="gh-shelf-title" className="gh-shelf__title">
            {alike ? `More like ${game.name}` : 'More games'}
          </h2>
          <a className="gh-more" href={`${homeHref()}#games`}>
            All {shelf.length} games
            <ChevronRightIcon />
          </a>
        </div>
        <ul className="wall__grid gh-shelf__grid">
          {/* Each its picture and name (plain), as on the home page: its scores are a tap away, on its page. */}
          {more.map((g, i) => (
            <WallTile
              key={g.slug}
              game={g}
              index={i}
              best={bests?.[g.slug] ?? null}
              standing={byGame[g.slug] ?? null}
              top={leaders ? (leaders[g.slug] ?? null) : undefined}
              asking={!leadersFailed}
              newFlag={false}
              preview
              plain
            />
          ))}
        </ul>
      </section>
    ) : null

  if (daily) {
    const TodayParts = ranked ? null : TODAY_PARTS[game.slug]
    return (
      <PageShell innerClassName="gh-rail">
        <div className="gh gh--daily" style={style}>
          {/* The day's dailies over its page: the Dailies page, and each daily, this one marked. */}
          <DailiesBar slug={game.slug} />
          {hero}

          {dailyView === 'today' ? (
            ranked && boardSlug ? (
              // The top of today's board beside the records made over the days; a link to the board lands here.
              <div className="gh-peeks" ref={tabsRef}>
                <BoardPeek slug={boardSlug} period={dailyPeek} onPeriod={setDailyPeek} place={BOARD_PLACE} />
                <DailyRecordsPeek slug={game.slug} />
              </div>
            ) : (
              // Just for fun: your days, then today part by part (YourDays.tsx), side by side.
              <div className="gh-today__below" ref={tabsRef}>
                <Suspense fallback={<div className="gh-tab-wait" aria-busy="true" />}>
                  <YourDaysCard slug={game.slug as 'acechase' | 'findbug' | 'halffull' | 'centroid'} />
                  {TodayParts ? <TodayParts /> : null}
                </Suspense>
              </div>
            )
          ) : (
            // In full, with a way back; it's where a link to the board or the records lands.
            <div
              className="gh-full"
              ref={tabsRef}
              id={dailyView === 'records' ? RECORDS_PLACE : dailyView === 'board' ? BOARD_PLACE : undefined}
            >
              {backLink}
              {dailyView === 'past' ? (
                <Suspense fallback={<div className="gh-tab-wait" aria-busy="true" />}>
                  <DailyPastTab slug={game.slug} />
                </Suspense>
              ) : dailyView === 'records' ? (
                <Suspense fallback={<div className="gh-tab-wait" aria-busy="true" />}>
                  <DailyRecordsTab slug={game.slug} />
                </Suspense>
              ) : boardSlug ? (
                <GamePageBoard slug={boardSlug} period={boardPeriod} onRetry={askScoreAgain} />
              ) : null}
            </div>
          )}
          {dailyView === 'today' || dailyView === 'board' ? eventsCard : null}
          {shelfSection}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell innerClassName="gh-rail">
      <div className="gh" style={style}>
        {/* The screen across the page, as a daily's is; then the board and the records, side by side or one in full. */}
        {hero}
        {gameView === 'both' && boardSlug ? (
          <div className="gh-peeks" ref={tabsRef}>
            <BoardPeek slug={boardSlug} period={boardPeriod} />
            <RecordsPeek game={game.slug} />
          </div>
        ) : (
          // In full, with a way back to the two side by side; it's where a link to the board or the records lands.
          <div
            className="gh-full"
            ref={tabsRef}
            id={withRecords ? (gameView === 'records' ? RECORDS_PLACE : BOARD_PLACE) : undefined}
          >
            {withRecords ? backLink : null}
            {gameView === 'records' ? (
              <RecordBookView game={game.slug} period={recordsPeriod} />
            ) : boardSlug ? (
              <GamePageBoard
                slug={boardSlug}
                period={boardPeriod}
                noteHunt={withRecords ? undefined : `g-stand-${game.slug}`}
                // With records, the full view is where a link to the board lands; with none, the board itself.
                place={withRecords ? undefined : BOARD_PLACE}
                onRetry={askScoreAgain}
              />
            ) : null}
          </div>
        )}
        {gameView !== 'records' ? eventsCard : null}

        {shelfSection}
      </div>
    </PageShell>
  )
}
