import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronRightIcon } from '../components/chromeIcons'
import { DailiesBar } from '../components/DailiesBar'
import { DailyTabs, GameTabs } from '../components/DailyTabs'
import { GamePageBoard } from '../components/GameBoard'
import { GameHubEvents } from '../components/GameHubEvents'
import { GameHubHero } from '../components/GameHubHero'
import { WallTile } from '../components/GameWall'
import { PageShell } from '../components/PageShell'
import { gamePlayableOn, getGame, isRankedGame, wallGames } from '../data/games'
import { useBoardLeaders } from '../hooks/useBoardLeaders'
import { useHubEvents, useHubHighScore } from '../hooks/useGameHub'
import { dailyTabHref, homeHref, navigate, periodFromRoute, useRoute } from '../hooks/useHashRoute'
import { boardPeriodFor } from '../lib/allTime'
import { usePlayerBests } from '../hooks/usePlayerBests'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import type { DailyTab } from '../lib/dailyWords'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { moreLike } from '../lib/gameHub'
import { useGlobalRank } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
import { lazyPage } from '../lib/lazyPage'
import { coerceVisiblePeriod, LEADERBOARD_GAMES, normalizePlayerName, type LeaderboardGame, type LeaderboardPeriod } from '../lib/leaderboard'
import { gameHasRecords } from '../lib/records'
import { resolveGameAccent, THEME_EVENT } from '../lib/theme'
import { preloadGamePage } from './gamePages'

/** Ace Chase's Today's Hole, in a chunk of its own, since only its page shows it here. */
const TodaysHoleCard = lazyPage(() => import('../components/TodaysHoleCard').then((m) => m.TodaysHoleCard))
/** Hot Lap's Today's Track, the same way. */
const TodaysTrackCard = lazyPage(() => import('../components/TodaysTrackCard').then((m) => m.TodaysTrackCard))
/** Find the Bug's Today's Wanted, the same way. */
const TodaysWantedCard = lazyPage(() => import('../components/TodaysWantedCard').then((m) => m.TodaysWantedCard))
/** Half Full's Today's Pour, the same way. */
const TodaysPourCard = lazyPage(() => import('../components/TodaysPourCard').then((m) => m.TodaysPourCard))
const TodaysCourseCard = lazyPage(() => import('../components/TodaysCourseCard').then((m) => m.TodaysCourseCard))
const TodaysCaveCard = lazyPage(() => import('../components/TodaysCaveCard').then((m) => m.TodaysCaveCard))
const TodaysHillsCard = lazyPage(() => import('../components/TodaysHillsCard').then((m) => m.TodaysHillsCard))
const TodaysGauntletCard = lazyPage(() => import('../components/TodaysGauntletCard').then((m) => m.TodaysGauntletCard))
/** Centroid's Today's Plates, the same way. */
const TodaysPlatesCard = lazyPage(() => import('../components/TodaysPlatesCard').then((m) => m.TodaysPlatesCard))

/** Each daily's Today card, the run that counts, at the top of its Today tab. */
const TODAY_CARDS: Partial<Record<string, typeof TodaysHoleCard>> = {
  acechase: TodaysHoleCard,
  hotlap: TodaysTrackCard,
  findbug: TodaysWantedCard,
  halffull: TodaysPourCard,
  centroid: TodaysPlatesCard,
  marblerun: TodaysCourseCard,
  lander: TodaysCaveCard,
  swoop: TodaysHillsCard,
  wobblerun: TodaysGauntletCard,
}

/**
 * A daily just for fun's own cards under its Today card (data/games.ts Game.ranked): your days on it, and
 * today part by part, the second in its Today card's chunk.
 */
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
/** Another game's Records tab, its record book, the same way. */
const RecordsTab = lazyPage(() => import('../components/RecordBookView').then((m) => m.RecordBookView))

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
 * board page and no record book of its own). Up top and across the page, its name and Play beside its screen,
 * where it plays itself under the high score. Then its tabs, Board and Records: the period's board in full, and
 * any event it is in; or its records, each a brass plaque. Then the games most like it. A game with no records
 * has no tabs, just its board.
 *
 * A daily's page is today's, with tabs under its hero: Today (today's card
 * across the page, then its board in full, its week and month a tap away),
 * its past courses, and its records. One just for fun (data/games.ts
 * Game.ranked) places nobody: under its Today card are your days and today
 * part by part, and it has no records tab.
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
  // Another game's tabs, Board and Records, when it keeps records.
  const gameTabs = !daily && boardSlug !== null && gameHasRecords(slug)
  const gameTab: 'board' | 'records' = gameTabs && boardFromRoute === 'records' ? 'records' : 'board'
  const routePeriod = periodFromRoute(route)
  // The board's period: the site's, or the address's on the Board tab. A daily's board is today's on its page,
  // its week or month when the address says (gameBoardHref), whatever the site's period.
  const boardPeriod: LeaderboardPeriod = daily
    ? routePeriod && routePeriod !== 'daily'
      ? boardPeriodFor(slug, routePeriod)
      : 'daily'
    : gameTab === 'board'
      ? (routePeriod ?? storedPeriod)
      : storedPeriod
  // The Records tab's period is its own: all time unless the address asks (recordsHref).
  const recordsPeriod: LeaderboardPeriod = gameTab === 'records' && routePeriod ? coerceVisiblePeriod(routePeriod) : 'all'
  // The games below show their bests and leaders for the day on a daily's page, else for the board's period.
  const period: LeaderboardPeriod = daily ? 'daily' : boardPeriod
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const highScore = useHubHighScore(ranked ? boardSlug : null, groupId)
  const events = useHubEvents(slug)
  // For the games below: your best on each, your place on its board, and who leads it, as the wall shows them.
  const bests = usePlayerBests(playerName, period)
  const { byGame } = useGlobalRank()
  const leaders = useBoardLeaders(period)
  const [, setThemeTick] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabKey = daily ? tab : gameTab
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

  // A daily's other tabs are fetched while its page is up, so a tab opens without a wait.
  useEffect(() => {
    if (!daily) return
    void DailyPastTab.preload()
    if (ranked) void DailyRecordsTab.preload()
    else {
      void YourDaysCard.preload()
      void TODAY_PARTS[slug]?.preload()
    }
  }, [daily, ranked, slug])

  // So is another game's Records tab, so it opens on its own loading rows rather than a blank that it then
  // pushes the games under it down from (pages load in place).
  useEffect(() => {
    if (gameTabs) void RecordsTab.preload()
  }, [gameTabs])

  // An old link to the records tab of a daily just for fun lands on its Today tab.
  useEffect(() => {
    if (!daily || ranked || tabFromRoute !== 'records') return
    navigate(dailyTabHref(slug, 'today'), { replace: true })
  }, [daily, ranked, tabFromRoute, slug])

  // A new tab keeps the hero and brings the tabs up to the top, unless they're already in the top half
  // of the screen with the tab under them in view. A past course's row, when one is named, lands itself.
  useEffect(() => {
    if (shownTab.current === tabKey) return
    shownTab.current = tabKey
    const bar = tabsRef.current
    if (!bar || window.location.hash.startsWith(COURSE_ANCHOR)) return
    const top = bar.getBoundingClientRect().top
    if (top < 0 || top > window.innerHeight * 0.5) bar.scrollIntoView({ block: 'start' })
  }, [tabKey])

  if (!game) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  const accent = resolveGameAccent(slug, game.accent)
  const shelf = wallGames(device)
  const more = moreLike(game, shelf)
  const style = {
    '--gh-accent': accent,
    '--gh-ink': inkOn(accent),
    '--board-accent': accent,
    '--period-accent': accent,
    '--thumb-accent': accent,
  } as CSSProperties

  const hero = <GameHubHero game={game} accent={accent} canPlay={canPlay} highScore={highScore} />
  const eventsCard = events.length > 0 ? <GameHubEvents gameName={game.name} events={events} /> : null
  // Bug hunt hiding places (lib/bugHunt.ts): with tabs, they hold "its page's tabs" and the games like it hold
  // the other; with none, the games like it hold the first and the line over the board the other.
  const shelfHunt = daily ? (ranked ? `g-stand-${game.slug}` : undefined) : gameTabs ? `g-stand-${game.slug}` : `g-board-${game.slug}`
  const shelfSection =
    more.length > 0 ? (
      <section className="gh-shelf" aria-labelledby="gh-shelf-title" data-hunt={shelfHunt}>
        <div className="gh-shelf__head">
          <h2 id="gh-shelf-title" className="gh-shelf__title">
            More like {game.name}
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
    ) : null

  if (daily) {
    const TodayCard = TODAY_CARDS[game.slug]
    const TodayParts = ranked ? null : TODAY_PARTS[game.slug]
    return (
      <PageShell innerClassName="gh-rail">
        <div className="gh gh--daily" style={style}>
          {/* The day's dailies over its page: the Dailies page, and each daily, this one marked. */}
          <DailiesBar slug={game.slug} />
          {hero}
          <DailyTabs slug={game.slug} gameName={game.name} tab={tab} ref={tabsRef} />

          {tab === 'past' ? (
            <Suspense fallback={<div className="gh-tab-wait" aria-busy="true" />}>
              <DailyPastTab slug={game.slug} />
            </Suspense>
          ) : tab === 'records' ? (
            <Suspense fallback={<div className="gh-tab-wait" aria-busy="true" />}>
              <DailyRecordsTab slug={game.slug} />
            </Suspense>
          ) : (
            <>
              {/* Today's card across the page, then the board across under it (hub.css). */}
              <div className="gh-today">
                {/* A daily just for fun's card is a bug hunt hiding place, where a ranked one's board panel was (lib/bugHunt.ts). */}
                <div className="gh-today__main" data-hunt={ranked ? undefined : `b-head-${game.slug}`}>
                  {TodayCard ? (
                    <Suspense fallback={<div className="gh-tab-wait" aria-busy="true" />}>
                      {/* Its board reads the picked group when it loads: a new group is a new card. */}
                      <TodayCard key={groupId ?? 'everyone'} />
                    </Suspense>
                  ) : null}
                </div>
                <div className={`gh-today__below${ranked ? ' gh-today__below--board' : ''}`}>
                  {ranked && boardSlug ? (
                    <GamePageBoard slug={boardSlug} period={boardPeriod} title="The board" />
                  ) : (
                    // Just for fun: your days, then today part by part (YourDays.tsx).
                    <Suspense fallback={<div className="gh-tab-wait" aria-busy="true" />}>
                      <YourDaysCard slug={game.slug as 'acechase' | 'findbug' | 'halffull' | 'centroid'} />
                      {TodayParts ? <TodayParts /> : null}
                    </Suspense>
                  )}
                  {eventsCard}
                </div>
              </div>
              {shelfSection}
            </>
          )}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell innerClassName="gh-rail">
      <div className="gh" style={style}>
        {/* The hero across the page, as a daily's is; then the tabs, Board and Records, and the one that's open. */}
        {hero}
        {gameTabs && boardSlug ? (
          <GameTabs slug={boardSlug} gameName={game.name} tab={gameTab} boardPeriod={boardPeriod} recordsPeriod={recordsPeriod} ref={tabsRef} />
        ) : null}

        {gameTab === 'records' ? (
          <Suspense fallback={<div className="gh-tab-wait" aria-busy="true" />}>
            <RecordsTab game={game.slug} period={recordsPeriod} />
          </Suspense>
        ) : (
          <>
            {boardSlug ? (
              <GamePageBoard slug={boardSlug} period={boardPeriod} noteHunt={gameTabs ? undefined : `g-stand-${game.slug}`} />
            ) : null}
            {eventsCard}
          </>
        )}

        {shelfSection}
      </div>
    </PageShell>
  )
}
