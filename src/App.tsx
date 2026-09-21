import { Suspense, useEffect } from 'react'
import { defaultPeriod } from './lib/defaultPeriod'
import { BoardSkeleton } from './components/BoardChrome'
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
import { silenceMusic, unlockSound } from './lib/sound'
import { rememberPlayed } from './lib/lastPlayed'
import { isImpersonating } from './lib/impersonate'
import { pruneOrphanTournamentIds } from './lib/tournaments'
import { GameHubPage } from './pages/GameHubPage'
import { GameLeaderboardPage } from './pages/GameLeaderboardPage'
import { HomePage } from './pages/HomePage'
import { LeaderboardsPage } from './pages/LeaderboardsPage'
import { RecordsIndexPage } from './pages/RecordsIndexPage'
import { RecordsPage } from './pages/RecordsPage'

import { GAME_PAGES, preloadGameFromHref } from './pages/gamePages'
import { lazyPage } from './lib/lazyPage'

/*
 * A page arrives with its route. The first load carries the shell, the home
 * page and the pages a visitor browses from it (a game's hub, the boards, the
 * record books); every game (gamePages.ts) and every heavier page below is
 * its own chunk, so opening one game does not download fifteen.
 */

const AboutPage = lazyPage(() => import('./pages/AboutPage').then((m) => m.AboutPage))
const AuthVerifyPage = lazyPage(() => import('./pages/AuthVerifyPage').then((m) => m.AuthVerifyPage))
const CreateTournamentPage = lazyPage(() =>
  import('./pages/CreateTournamentPage').then((m) => m.CreateTournamentPage),
)
const DevCelebratePage = lazyPage(() => import('./pages/DevCelebratePage').then((m) => m.DevCelebratePage))
const GroupDetailPage = lazyPage(() => import('./pages/GroupsPage').then((m) => m.GroupDetailPage))
const GroupsPage = lazyPage(() => import('./pages/GroupsPage').then((m) => m.GroupsPage))
const PlusPage = lazyPage(() => import('./pages/PlusPage').then((m) => m.PlusPage))
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage').then((m) => m.PrivacyPage))
const RankPage = lazyPage(() => import('./pages/RankPage').then((m) => m.RankPage))
const StatsPage = lazyPage(() => import('./pages/StatsPage').then((m) => m.StatsPage))
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

function isGameScreen(route: ReturnType<typeof useRoute>) {
  return route.name === 'gamePlay' || route.name === 'tournamentPlay'
}

/** Scroll on real navigation — not period-only changes on the same board/record. */
function routeScrollKey(route: ReturnType<typeof useRoute>): string {
  const key = { ...route } as Record<string, unknown>
  delete key.period
  delete key.board
  return JSON.stringify(key)
}

function App() {
  const route = useRoute()
  const onGameScreen = isGameScreen(route)
  const scrollKey = routeScrollKey(route)
  usePageMeta(route)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [scrollKey])

  // Opening a game is what "recently played" means — the home page offers the
  // most recent one back rather than making you find it in the grid again.
  const playingSlug = route.name === 'gamePlay' ? route.slug : null
  useEffect(() => {
    if (playingSlug) rememberPlayed(playingSlug)
  }, [playingSlug])

  useEffect(() => {
    void bootstrapApp()
    const onName = () => {
      void onPlayerNameChanged()
    }
    const unlock = () => unlockSound()
    // A Play link pointed at or focused fetches its game, so the tap lands on a game that is already here.
    const warm = (e: Event) => {
      const link = (e.target as Element | null)?.closest?.('a[href]')
      if (link) preloadGameFromHref(link.getAttribute('href') ?? '')
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

  useEffect(() => {
    if (!onGameScreen) silenceMusic()
  }, [onGameScreen])

  return (
    <Suspense fallback={<RouteFallback game={onGameScreen} />}>
      <Screen route={route} />
    </Suspense>
  )
}

/** While a page's chunk is on its way: a game gets its dark stage, anything else the shell. */
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
      <BoardSkeleton rows={4} />
    </PageShell>
  )
}

function Screen({ route }: { route: ReturnType<typeof useRoute> }) {
  if (route.name === 'groups') return <GroupsPage />
  if (route.name === 'group') {
    return <GroupDetailPage id={route.id} invite={route.invite} />
  }

  if (route.name === 'home') return <HomePage />
  if (route.name === 'about') return <AboutPage />
  if (route.name === 'plus') return <PlusPage />
  if (route.name === 'stats') return <StatsPage />
  if (route.name === 'devCelebrate') return <DevCelebratePage />
  if (route.name === 'privacy') return <PrivacyPage />
  if (route.name === 'terms') return <TermsPage />
  if (route.name === 'authVerify') return <AuthVerifyPage token={route.token} />
  if (route.name === 'rank') {
    return <RankPage player={route.player} period={route.period ?? defaultPeriod()} />
  }
  if (route.name === 'leaderboards') {
    return (
      <LeaderboardsPage
        global={route.global}
        period={route.period ?? defaultPeriod()}
      />
    )
  }
  if (route.name === 'gameLeaderboard') {
    if (isGameHidden(route.game)) {
      return <ComingSoonPage slug={route.game} />
    }
    return (
      <GameLeaderboardPage game={route.game} period={route.period ?? defaultPeriod()} />
    )
  }
  if (route.name === 'recordsIndex') return <RecordsIndexPage />
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
    return <GameHubPage slug={route.slug} board={route.board} />
  }
  if (route.name === 'gamePlay' && isGameHidden(route.slug)) {
    return <ComingSoonPage slug={route.slug} />
  }
  if (route.name === 'gamePlay') {
    const GamePage = GAME_PAGES[route.slug]
    return GamePage ? <GamePage /> : <ComingSoonPage slug={route.slug} />
  }
  return <HomePage />
}

export default App
