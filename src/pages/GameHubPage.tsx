import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useHeldHeight } from '../lib/heldShape'
import { ChevronRightIcon } from '../components/chromeIcons'
import { DailiesBar } from '../components/DailiesBar'
import { DailyTabs } from '../components/DailyTabs'
import { GameHubBoard } from '../components/GameHubBoard'
import { GameHubEvents } from '../components/GameHubEvents'
import { GameHubHero } from '../components/GameHubHero'
import { GameHubRecords } from '../components/GameHubRecords'
import { GameHubStanding } from '../components/GameHubStanding'
import { WallTile } from '../components/GameWall'
import { PageShell } from '../components/PageShell'
import { gamePlayableOn, getGame, isRankedGame, wallGames } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { useBoardLeaders } from '../hooks/useBoardLeaders'
import { useDailyBeyond, useHubBoard, useHubEvents, useHubHighScore, useHubRecords } from '../hooks/useGameHub'
import { currentHref, dailyTabHref, homeHref, navigate, periodFromRoute, recordsHref, useRoute } from '../hooks/useHashRoute'
import { usePlayerBests } from '../hooks/usePlayerBests'
import { usePlayerName } from '../hooks/usePlayerName'
import { boardPeriodFor } from '../lib/allTime'
import { inkOn } from '../lib/color'
import type { DailyTab } from '../lib/dailyWords'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { moreLike } from '../lib/gameHub'
import { useGlobalRank } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
import { lazyPage } from '../lib/lazyPage'
import { LEADERBOARD_GAMES, normalizePlayerName, type LeaderboardGame, type LeaderboardPeriod } from '../lib/leaderboard'
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
 * A game's page. Up top and across the page, its name and Play beside its
 * screen, where it plays itself under the high score. Then, side by side,
 * where you stand on it and the one run that moves you, the period's board,
 * your side of its record book, and any event it is in; how to play it and
 * what scores; and the games most like it.
 *
 * A daily's page is today's, with tabs under its hero: Today (today's card
 * across the page, then where you stand and its board), its past courses,
 * and its records. One just for fun (data/games.ts Game.ranked) places
 * nobody: under its Today card are your days and today part by part, and it
 * has no records tab.
 */
export function GameHubPage({ slug, board: boardFromRoute, tab: tabFromRoute }: GameHubPageProps) {
  const route = useRoute()
  const storedPeriod = useDefaultPeriod()
  const game = getGame(slug)
  const daily = Boolean(game?.daily)
  const ranked = isRankedGame(slug)
  // A daily just for fun has no records tab: an old link to it is its Today tab.
  const tab: DailyTab = daily ? (tabFromRoute === 'records' && !ranked ? 'today' : (tabFromRoute ?? 'today')) : 'today'
  // A daily's board is the day's whatever period is picked (the API keeps it so): its page says today.
  const period: LeaderboardPeriod = daily ? 'daily' : (periodFromRoute(route) ?? storedPeriod)
  const device = useDeviceType()
  const { signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const boardSlug = isBoardGame(slug) ? slug : null
  // A daily just for fun has no board to ask for.
  const board = useHubBoard(ranked ? boardSlug : null, period, playerName, groupId)
  // A daily's board is today's; where you stand beyond it follows the header's period, with its month for all
  // time, which leaves the dailies out (lib/allTime.ts).
  const beyond = useDailyBeyond(daily && ranked ? boardSlug : null, playerName, groupId, boardPeriodFor(slug, storedPeriod))
  const highScore = useHubHighScore(ranked ? boardSlug : null, groupId)
  // A daily's records are its Records tab, not a card of the book.
  const records = useHubRecords(daily ? '' : slug, playerName, groupId)
  // While the board and the records load, the cards under the hero (where you stand, the board, its records) hold
  // the height they had last time this device was here (lib/heldShape.ts).
  const settling = board.loading || (gameHasRecords(slug) && !daily && records === null)
  const bandHeld = useHeldHeight<HTMLDivElement>(`gh-cards-${slug}`, settling)
  const events = useHubEvents(slug)
  // For the games below: your best on each, your place on its board, and who leads it, as the wall shows them.
  const bests = usePlayerBests(playerName, period)
  const { byGame } = useGlobalRank()
  const leaders = useBoardLeaders(period)
  const [, setThemeTick] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)
  const shownTab = useRef(tab)

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

  // An old link to the records tab of a daily just for fun lands on its Today tab.
  useEffect(() => {
    if (!daily || ranked || tabFromRoute !== 'records') return
    navigate(dailyTabHref(slug, 'today'), { replace: true })
  }, [daily, ranked, tabFromRoute, slug])

  // An old link to the game's records tab goes to its record book.
  useEffect(() => {
    if (boardFromRoute !== 'records' || !game || daily) return
    const next = recordsHref(game.slug, period)
    if (currentHref() !== next) navigate(next, { replace: true })
  }, [boardFromRoute, game, daily, period])

  // A new tab keeps the hero and brings the tabs up to the top, unless they're already in the top half
  // of the screen with the tab under them in view. A past course's row, when one is named, lands itself.
  useEffect(() => {
    if (shownTab.current === tab) return
    shownTab.current = tab
    const bar = tabsRef.current
    if (!bar || window.location.hash.startsWith(COURSE_ANCHOR)) return
    const top = bar.getBoundingClientRect().top
    if (top < 0 || top > window.innerHeight * 0.5) bar.scrollIntoView({ block: 'start' })
  }, [tab])

  if (!game) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  const accent = resolveGameAccent(slug, game.accent)
  const hasRecords = gameHasRecords(game.slug)
  const shelf = wallGames(device)
  const more = moreLike(game, shelf)
  const style = {
    '--gh-accent': accent,
    '--gh-ink': inkOn(accent),
    '--board-accent': accent,
    '--period-accent': accent,
    '--thumb-accent': accent,
  } as CSSProperties

  const hero = (
    <GameHubHero
      game={game}
      accent={accent}
      canPlay={canPlay}
      hasRecords={hasRecords}
      period={period}
      highScore={highScore}
    />
  )
  const boardCard = boardSlug ? (
    <GameHubBoard slug={boardSlug} gameName={game.name} period={period} board={board} me={playerName} />
  ) : null
  const standing = boardSlug ? (
    <GameHubStanding
      slug={boardSlug}
      gameName={game.name}
      period={period}
      board={board}
      beyond={beyond}
      me={playerName}
      signedIn={signedIn}
    />
  ) : null
  const eventsCard = events.length > 0 ? <GameHubEvents gameName={game.name} events={events} /> : null
  const shelfSection =
    more.length > 0 ? (
      <section className="gh-shelf" aria-labelledby="gh-shelf-title">
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
              {/* Today's card across the page, then where you stand and the board side by side under it (hub.css). */}
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
                <div className="gh-today__below">
                  {ranked ? (
                    <>
                      {standing}
                      {boardCard}
                    </>
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

  const recordsCard = hasRecords ? <GameHubRecords slug={game.slug} gameName={game.name} records={records} me={playerName} /> : null
  return (
    <PageShell innerClassName="gh-rail">
      <div className="gh" style={style}>
        {/* The hero across the page, as a daily's is; then the cards side by side under it (hub.css .gh-band). */}
        {hero}

        {standing || boardCard || recordsCard || eventsCard ? (
          <div className="gh-band" ref={bandHeld.ref} style={bandHeld.style}>
            {standing}
            {boardCard}
            {recordsCard}
            {eventsCard}
          </div>
        ) : null}

        {shelfSection}
      </div>
    </PageShell>
  )
}
