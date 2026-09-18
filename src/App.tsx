import { useEffect } from 'react'
import { defaultPeriod } from './lib/defaultPeriod'
import { Footer } from './components/Footer'
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
import { AsteroidsPage } from './pages/AsteroidsPage'
import { BarragePage } from './pages/BarragePage'
import { AuthVerifyPage } from './pages/AuthVerifyPage'
import { CrosswalkPage } from './pages/CrosswalkPage'
import { BopPage } from './pages/BopPage'
import { PuttPage } from './pages/PuttPage'
import { FrenzyPage } from './pages/FrenzyPage'
import { CrumbtrailPage } from './pages/CrumbtrailPage'
import { DeadCenterPage } from './pages/DeadCenterPage'
import { DevCelebratePage } from './pages/DevCelebratePage'
import { GameHubPage } from './pages/GameHubPage'
import { GameLeaderboardPage } from './pages/GameLeaderboardPage'
import { rememberPlayed } from './lib/lastPlayed'
import { AboutPage } from './pages/AboutPage'
import { PlusPage } from './pages/PlusPage'
import { StatsPage } from './pages/StatsPage'
import { HomePage } from './pages/HomePage'
import { RankPage } from './pages/RankPage'
import { LeaderboardsPage } from './pages/LeaderboardsPage'
import { RecordsIndexPage } from './pages/RecordsIndexPage'
import { RecordsPage } from './pages/RecordsPage'
import { PatriotPage } from './pages/PatriotPage'
import { SimonPage } from './pages/SimonPage'
import { SnakePage } from './pages/SnakePage'
import { FindBugPage } from './pages/FindBugPage'
import { PelletsPage } from './pages/PelletsPage'
import { StackerPage } from './pages/StackerPage'
import { WhackPage } from './pages/WhackPage'
import { CreateTournamentPage } from './pages/CreateTournamentPage'
import { GroupDetailPage, GroupsPage } from './pages/GroupsPage'
import { isImpersonating } from './lib/impersonate'
import { pruneOrphanTournamentIds } from './lib/tournaments'
import { TournamentDetailPage, TournamentsPage } from './pages/TournamentsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { TournamentPlayPage } from './pages/TournamentPlayPage'

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
    window.addEventListener(PLAYER_NAME_EVENT, onName)
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return () => {
      window.removeEventListener(PLAYER_NAME_EVENT, onName)
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
  }, [])

  useEffect(() => {
    if (!onGameScreen) silenceMusic()
  }, [onGameScreen])

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
        period={route.period ?? defaultPeriod()}
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
  if (route.name === 'gamePlay' && route.slug === 'stacker') return <StackerPage />
  if (route.name === 'gamePlay' && route.slug === 'patriot') return <PatriotPage />
  if (route.name === 'gamePlay' && route.slug === 'snake') return <SnakePage />
  if (route.name === 'gamePlay' && route.slug === 'pop') return <WhackPage />
  if (route.name === 'gamePlay' && route.slug === 'simon') return <SimonPage />
  if (route.name === 'gamePlay' && route.slug === 'centroid') return <DeadCenterPage />
  if (route.name === 'gamePlay' && route.slug === 'asteroids') return <AsteroidsPage />
  if (route.name === 'gamePlay' && route.slug === 'crosswalk') return <CrosswalkPage />
  if (route.name === 'gamePlay' && route.slug === 'pellets') return <PelletsPage />
  if (route.name === 'gamePlay' && route.slug === 'findbug') return <FindBugPage />
  if (route.name === 'gamePlay' && route.slug === 'barrage') return <BarragePage />
  if (route.name === 'gamePlay' && route.slug === 'crumbtrail') return <CrumbtrailPage />
  if (route.name === 'gamePlay' && route.slug === 'bop') return <BopPage />
  if (route.name === 'gamePlay' && route.slug === 'putt') return <PuttPage />
  if (route.name === 'gamePlay' && route.slug === 'frenzy') return <FrenzyPage />
  if (route.name === 'gamePlay') return <ComingSoonPage slug={route.slug} />
  return <HomePage />
}

export default App
