import { Suspense, useEffect } from 'react'
import { EasterEggs } from './components/EasterEggs'
import { PendingRunsSaver } from './components/PendingRunsSaver'
import { SeasonDressing } from './components/season/SeasonDressing'
import { LevelUpMoment } from './components/season/LevelUpMoment'
import { defaultPeriod } from './lib/defaultPeriod'
import { EarlyGate } from './components/EarlyGate'
import { Footer } from './components/Footer'
import { PageShell } from './components/PageShell'
import { SiteHeader } from './components/SiteHeader'
import { getGame, isGameHidden } from './data/games'
import { homeHref, useRoute } from './hooks/useHashRoute'
import { usePageMeta } from './hooks/usePageMeta'
import {
  getClaimToken,
  getLastPlayerName,
  migrateLocalScoresToName,
  PLAYER_NAME_EVENT,
  pruneOrphanClaims,
} from './lib/leaderboard'
import { refreshGlobalRank } from './lib/globalRank'
import { refreshPersonalBests } from './lib/personalBest'
import { playMusicFor, silenceMusic, unlockSound } from './lib/sound'
import { isImpersonating } from './lib/impersonate'
import { pruneOrphanTournamentIds } from './lib/tournaments'
import { scrollToPlace } from './lib/scrollToPlace'
import { GameHubPage } from './pages/GameHubPage'
import { GameLeaderboardPage } from './pages/GameLeaderboardPage'
import { HomePage } from './pages/HomePage'
import { LeaderboardsPage } from './pages/LeaderboardsPage'
import { RecordsIndexPage } from './pages/RecordsIndexPage'
import { RecordsPage } from './pages/RecordsPage'

import { GAME_PAGES, preloadGameFromHref } from './pages/gamePages'
import { lazyPage } from './lib/lazyPage'
import { FRIENDS_SCOPE } from './lib/groups'

/*
 * A page arrives with its route. The first load carries the shell, the home
 * page and the pages a visitor browses from it (a game's hub, the boards, the
 * record books); every game (gamePages.ts) and every heavier page below is
 * its own chunk, so opening one game does not download fifteen.
 */

const AboutPage = lazyPage(() => import('./pages/AboutPage').then((m) => m.AboutPage))
const SiteRecordsPage = lazyPage(() =>
  import('./pages/SiteRecordsPage').then((m) => m.SiteRecordsPage),
)
const AuthVerifyPage = lazyPage(() => import('./pages/AuthVerifyPage').then((m) => m.AuthVerifyPage))
const DiscordReturnPage = lazyPage(() => import('./pages/DiscordReturnPage').then((m) => m.DiscordReturnPage))
const CreateTournamentPage = lazyPage(() =>
  import('./pages/CreateTournamentPage').then((m) => m.CreateTournamentPage),
)
const DevCelebratePage = lazyPage(() => import('./pages/DevCelebratePage').then((m) => m.DevCelebratePage))
const GameOverPage = lazyPage(() => import('./pages/GameOverPage').then((m) => m.GameOverPage))
const ChallengeLandingPage = lazyPage(() =>
  import('./pages/ChallengeLandingPage').then((m) => m.ChallengeLandingPage),
)
const GroupDetailPage = lazyPage(() => import('./pages/GroupsPage').then((m) => m.GroupDetailPage))
const GroupsPage = lazyPage(() => import('./pages/GroupsPage').then((m) => m.GroupsPage))
const FriendsGroupPage = lazyPage(() => import('./pages/FriendsGroupPage').then((m) => m.FriendsGroupPage))
const PlusPage = lazyPage(() => import('./pages/PlusPage').then((m) => m.PlusPage))
const AdminPage = lazyPage(() => import('./pages/AdminPage').then((m) => m.AdminPage))
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage').then((m) => m.PrivacyPage))
const RankPage = lazyPage(() => import('./pages/RankPage').then((m) => m.RankPage))
const RankHowPage = lazyPage(() => import('./pages/RankHowPage').then((m) => m.RankHowPage))
const StatsPage = lazyPage(() => import('./pages/StatsPage').then((m) => m.StatsPage))
const PrizeCounterPage = lazyPage(() => import('./pages/PrizeCounterPage').then((m) => m.PrizeCounterPage))
const TicketHistoryPage = lazyPage(() => import('./pages/TicketHistoryPage').then((m) => m.TicketHistoryPage))
const SeasonPage = lazyPage(() => import('./pages/SeasonPage').then((m) => m.SeasonPage))
/** The Today page, in a chunk of its own with the dailies' plans. */
const TodayPage = lazyPage(() => import('./pages/TodayPage').then((m) => m.TodayPage))
const NotificationSettingsPage = lazyPage(() =>
  import('./pages/NotificationSettingsPage').then((m) => m.NotificationSettingsPage),
)
const TermsPage = lazyPage(() => import('./pages/TermsPage').then((m) => m.TermsPage))
const TournamentDetailPage = lazyPage(() =>
  import('./pages/TournamentsPage').then((m) => m.TournamentDetailPage),
)
const TournamentsPage = lazyPage(() => import('./pages/TournamentsPage').then((m) => m.TournamentsPage))
const TournamentPlayPage = lazyPage(() =>
  import('./pages/TournamentPlayPage').then((m) => m.TournamentPlayPage),
)

async function bootstrapApp() {
  pruneOrphanTournamentIds()
  pruneOrphanClaims()
  await refreshPersonalBests()
}

async function onPlayerNameChanged() {
  const name = getLastPlayerName()
  const token = name ? getClaimToken(name) : null
  /*
   * Borrowing a tag is not changing yours.
   *
   * This fires the moment impersonation sets the active tag, and the two
   * things it does next both assume the new tag is yours: pruning drops the
   * claim tokens of every other tag — your own included — and the migration
   * asks the server to move that tag's scores onto the borrowed one. The
   * server refuses when the borrowed tag belongs to another account, so this
   * has been landing as a failed request rather than lost scores, but a tag
   * nobody has claimed would have taken them.
   */
  if (isImpersonating()) {
    await refreshPersonalBests()
    await refreshGlobalRank()
    return
  }
  pruneOrphanClaims()
  if (name && token) {
    await migrateLocalScoresToName(name, token)
  }
  await refreshPersonalBests()
  await refreshGlobalRank()
}

function ComingSoonPage({ slug }: { slug: string }) {
  const game = getGame(slug)

  return (
    <>
      <SiteHeader />
      <main className="game-page">
        <div className="game-page__inner game-page__inner--narrow">
          <a className="game-page__back" href={homeHref()}>
            ← Games
          </a>
          <h1 className="game-page__title">{game?.name ?? 'Game'}</h1>
          <p className="game-page__blurb">That game isn’t on the board.</p>
          <a className="game-page__cta" href={homeHref()}>
            See available games
          </a>
        </div>
      </main>
      <Footer />
    </>
  )
}

/** The id the address's `#anchor` names, if it names one: a `#/…` is an old-style route, not a place. */
function anchorId(): string | null {
  const anchor = window.location.hash.slice(1)
  if (!anchor || anchor.startsWith('/')) return null
  try {
    return decodeURIComponent(anchor)
  } catch {
    return null
  }
}

/** The element the address's `#anchor` names, when it's on the page. */
function anchorTarget(): HTMLElement | null {
  const id = anchorId()
  return id ? document.getElementById(id) : null
}

function isGameScreen(route: ReturnType<typeof useRoute>) {
  return route.name === 'gamePlay' || route.name === 'tournamentPlay'
}

/**
 * Scroll on real navigation — not period-only changes on the same board/record, nor a daily's page
 * changing tab, which keeps its hero and brings the tabs up itself (GameHubPage).
 */
function routeScrollKey(route: ReturnType<typeof useRoute>): string {
  const key = { ...route } as Record<string, unknown>
  delete key.period
  delete key.board
  delete key.tab
  return JSON.stringify(key)
}

function App() {
  const route = useRoute()
  const onGameScreen = isGameScreen(route)
  const scrollKey = routeScrollKey(route)
  usePageMeta(route)

  // A new page starts at its top, or at the place its link names (a past course's row, the home page's games, a
  // day board's All time board). A lazy page draws that place once its data comes, so it's waited for, and kept in
  // view while the page fills in above it (lib/scrollToPlace.ts).
  // The jump to the top is instant: the site's smooth scrolling made it a glide, still running when a page's own
  // place (a board's section, a profile's trophies) was drawn, and it carried the page past it.
  useEffect(() => {
    if (!anchorTarget()) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    return anchorId() ? scrollToPlace(anchorTarget) : undefined
  }, [scrollKey])

  useEffect(() => {
    void bootstrapApp()
    const onName = () => {
      void onPlayerNameChanged()
    }
    const unlock = () => unlockSound()
    // A link pointed at or focused fetches its game or its page, so the tap lands on one that is already here.
    const warm = (e: Event) => {
      const link = (e.target as Element | null)?.closest?.('a[href]')
      if (!link) return
      const href = link.getAttribute('href') ?? ''
      preloadGameFromHref(href)
      preloadPageFromHref(href)
    }
    window.addEventListener(PLAYER_NAME_EVENT, onName)
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    window.addEventListener('pointerover', warm, true)
    window.addEventListener('focusin', warm, true)
    return () => {
      window.removeEventListener(PLAYER_NAME_EVENT, onName)
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      window.removeEventListener('pointerover', warm, true)
      window.removeEventListener('focusin', warm, true)
    }
  }, [])

  // Each game plays its own music the whole time it's on screen, in an event too.
  const musicSlug = route.name === 'gamePlay' ? route.slug : route.name === 'tournamentPlay' ? route.game : null
  useEffect(() => {
    if (musicSlug) playMusicFor(musicSlug)
    else silenceMusic()
  }, [musicSlug])

  return (
    <>
      <Suspense fallback={<RouteFallback game={onGameScreen} />}>
        <Screen route={route} />
      </Suspense>
      <EasterEggs />
      <PendingRunsSaver />
      <SeasonDressing />
      <LevelUpMoment />
    </>
  )
}

/**
 * While a page's chunk is on its way: a game gets its dark stage, anything
 * else the shell with an empty body. The page then draws its own skeleton,
 * so the shell shows nothing of its own here rather than a second, smaller
 * skeleton that the real one replaces a moment later.
 */
function RouteFallback({ game }: { game: boolean }) {
  if (game) {
    return (
      <main className="game-page game-page--fullscreen tour-play" aria-busy="true">
        <p className="tour-play__message">Loading…</p>
      </main>
    )
  }
  return (
    <PageShell>
      <div className="route-fallback" aria-busy="true" />
    </PageShell>
  )
}

/*
 * The chunked pages a link can lead to, so pointing at a nav link fetches
 * the page before the tap, the way Play links fetch their game. The browse
 * pages are in the first load already and need no entry here.
 */
const PAGE_PRELOADS: { test: RegExp; page: { preload: () => Promise<void> } }[] = [
  { test: /^\/tournaments\/create(?:[/?#]|$)/, page: CreateTournamentPage },
  { test: /^\/tournaments\/[^/?#]+\/play\//, page: TournamentPlayPage },
  { test: /^\/tournaments\/[^/?#]+/, page: TournamentDetailPage },
  { test: /^\/tournaments(?:[/?#]|$)/, page: TournamentsPage },
  { test: /^\/groups\/[^/?#]+/, page: GroupDetailPage },
  { test: /^\/groups(?:[/?#]|$)/, page: GroupsPage },
  { test: /^\/rank(?:[/?#]|$)/, page: RankPage },
  { test: /^\/how-ranks-work(?:[/?#]|$)/, page: RankHowPage },
  { test: /^\/stats(?:[/?#]|$)/, page: StatsPage },
  { test: /^\/prizes\/tickets(?:[/?#]|$)/, page: TicketHistoryPage },
  { test: /^\/prizes(?:[/?#]|$)/, page: PrizeCounterPage },
  { test: /^\/season(?:[/?#]|$)/, page: SeasonPage },
  // The Dailies page, and its old address that inbox notes and day shares still use.
  { test: /^\/(?:dailies|today)(?:[/?#]|$)/, page: TodayPage },
  { test: /^\/settings(?:[/?#]|$)/, page: NotificationSettingsPage },
  { test: /^\/plus(?:[/?#]|$)/, page: PlusPage },
  { test: /^\/about(?:[/?#]|$)/, page: AboutPage },
  { test: /^\/privacy(?:[/?#]|$)/, page: PrivacyPage },
  { test: /^\/terms(?:[/?#]|$)/, page: TermsPage },
]

function preloadPageFromHref(href: string) {
  const hit = PAGE_PRELOADS.find((entry) => entry.test.test(href))
  if (hit) void hit.page.preload()
}

/** A friend's challenge link, `/c/<game>/<id>`, read from the address itself. */
function challengeLink(): { slug: string; id: string } | null {
  if (typeof window === 'undefined') return null
  const match = /^\/c\/([^/]+)\/([^/]+)\/?$/.exec(window.location.pathname)
  return match ? { slug: decodeURIComponent(match[1]!), id: decodeURIComponent(match[2]!) } : null
}

function Screen({ route }: { route: ReturnType<typeof useRoute> }) {
  const challenge = challengeLink()
  if (challenge) return <ChallengeLandingPage slug={challenge.slug} id={challenge.id} />
  if (route.name === 'groups') return <GroupsPage />
  if (route.name === 'group') {
    // Your friends are a group made from who you've added, with a page of their own.
    if (route.id === FRIENDS_SCOPE) return <FriendsGroupPage />
    return <GroupDetailPage id={route.id} invite={route.invite} />
  }

  if (route.name === 'home') return <HomePage />
  if (route.name === 'about') return <AboutPage />
  if (route.name === 'plus') return <PlusPage />
  if (route.name === 'admin') return <AdminPage section={route.section} />
  if (route.name === 'stats') return <StatsPage />
  if (route.name === 'prizes') return <PrizeCounterPage />
  if (route.name === 'tickets') return <TicketHistoryPage />
  if (route.name === 'season') return <SeasonPage />
  if (route.name === 'today') return <TodayPage />
  if (route.name === 'notificationSettings') return <NotificationSettingsPage />
  if (route.name === 'devCelebrate') return <DevCelebratePage />
  if (route.name === 'notFound') return <GameOverPage killScreen={route.killScreen} />
  if (route.name === 'privacy') return <PrivacyPage />
  if (route.name === 'terms') return <TermsPage />
  if (route.name === 'authVerify') return <AuthVerifyPage token={route.token} />
  if (route.name === 'authDiscord') return <DiscordReturnPage />
  if (route.name === 'rank') {
    return <RankPage player={route.player} period={route.period ?? defaultPeriod()} />
  }
  if (route.name === 'rankHow') {
    return <RankHowPage player={route.player} period={route.period ?? defaultPeriod()} />
  }
  if (route.name === 'leaderboards') {
    return <LeaderboardsPage period={route.period ?? defaultPeriod()} season={route.season} />
  }
  if (route.name === 'gameLeaderboard') {
    if (isGameHidden(route.game)) {
      return <ComingSoonPage slug={route.game} />
    }
    return (
      <GameLeaderboardPage game={route.game} period={route.period ?? defaultPeriod()} day={route.day} />
    )
  }
  if (route.name === 'recordsIndex') return <RecordsIndexPage />
  if (route.name === 'siteRecords') return <SiteRecordsPage />
  if (route.name === 'records') {
    return (
      <RecordsPage
        game={route.game}
        recordId={route.recordId}
        period={route.period ?? 'all'}
      />
    )
  }
  if (route.name === 'tournaments') return <TournamentsPage />
  if (route.name === 'tournamentCreate') return <CreateTournamentPage />
  if (route.name === 'tournamentPlay') {
    return (
      <TournamentPlayPage
        tournamentId={route.id}
        gameSlug={route.game}
        invite={route.invite}
      />
    )
  }
  if (route.name === 'tournament') {
    return <TournamentDetailPage id={route.id} invite={route.invite} />
  }
  if (route.name === 'game') {
    if (isGameHidden(route.slug)) return <ComingSoonPage slug={route.slug} />
    return <GameHubPage slug={route.slug} board={route.board} tab={route.tab} />
  }
  if (route.name === 'gamePlay' && isGameHidden(route.slug)) {
    return <ComingSoonPage slug={route.slug} />
  }
  if (route.name === 'gamePlay') {
    const GamePage = GAME_PAGES[route.slug]
    return GamePage ? (
      <EarlyGate slug={route.slug}>
        <GamePage />
      </EarlyGate>
    ) : (
      <ComingSoonPage slug={route.slug} />
    )
  }
  return <HomePage />
}

export default App
