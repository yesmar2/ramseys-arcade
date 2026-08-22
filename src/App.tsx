import { useEffect } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { getGame } from './data/games'
import { useHashRoute } from './hooks/useHashRoute'
import {
  getClaimToken,
  getLastPlayerName,
  migrateLocalScoresToName,
  PLAYER_NAME_EVENT,
} from './lib/leaderboard'
import { refreshGlobalRank } from './lib/globalRank'
import { refreshPersonalBests } from './lib/personalBest'
import { silenceMusic, unlockSound } from './lib/sound'
import { AsteroidsPage } from './pages/AsteroidsPage'
import { AuthVerifyPage } from './pages/AuthVerifyPage'
import { DeadCenterPage } from './pages/DeadCenterPage'
import { GameHubPage } from './pages/GameHubPage'
import { HomePage } from './pages/HomePage'
import { RankPage } from './pages/RankPage'
import { LeaderboardsPage } from './pages/LeaderboardsPage'
import { RecordsPage } from './pages/RecordsPage'
import { PatriotPage } from './pages/PatriotPage'
import { SimonPage } from './pages/SimonPage'
import { SnakePage } from './pages/SnakePage'
import { StackerPage } from './pages/StackerPage'
import { WhackPage } from './pages/WhackPage'
import { TournamentDetailPage, TournamentsPage } from './pages/TournamentsPage'
import { TournamentPlayPage } from './pages/TournamentPlayPage'

async function syncPlayerIdentity() {
  const name = getLastPlayerName()
  const token = name ? getClaimToken(name) : null
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
      <Header />
      <main className="game-page">
        <div className="game-page__inner game-page__inner--narrow">
          <a className="game-page__back" href="#/">
            ← Games
          </a>
          <h1 className="game-page__title">{game?.name ?? 'Game'}</h1>
          <p className="game-page__blurb">That game isn’t on the board.</p>
          <a className="game-page__cta" href="#/">
            See available games
          </a>
        </div>
      </main>
      <Footer />
    </>
  )
}

function isGameScreen(route: ReturnType<typeof useHashRoute>) {
  return route.name === 'gamePlay' || route.name === 'tournamentPlay'
}

/** Scroll on real navigation — not period-only changes on the same board/record. */
function routeScrollKey(route: ReturnType<typeof useHashRoute>): string {
  const key = { ...route } as Record<string, unknown>
  delete key.period
  return JSON.stringify(key)
}

function App() {
  const route = useHashRoute()
  const onGameScreen = isGameScreen(route)
  const scrollKey = routeScrollKey(route)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [scrollKey])

  useEffect(() => {
    void syncPlayerIdentity()
    const sync = () => {
      void syncPlayerIdentity()
    }
    const unlock = () => unlockSound()
    window.addEventListener(PLAYER_NAME_EVENT, sync)
    window.addEventListener('focus', sync)
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return () => {
      window.removeEventListener(PLAYER_NAME_EVENT, sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
  }, [])

  useEffect(() => {
    if (!onGameScreen) silenceMusic()
  }, [onGameScreen])

  if (route.name === 'home') return <HomePage />
  if (route.name === 'authVerify') return <AuthVerifyPage token={route.token} />
  if (route.name === 'rank') return <RankPage player={route.player} />
  if (route.name === 'leaderboards') {
    return <LeaderboardsPage global={route.global} />
  }
  if (route.name === 'records') {
    return (
      <RecordsPage
        game={route.game}
        recordId={route.recordId}
        period={route.period}
      />
    )
  }
  if (route.name === 'tournaments') return <TournamentsPage />
  if (route.name === 'tournamentPlay') {
    return <TournamentPlayPage tournamentId={route.id} gameSlug={route.game} />
  }
  if (route.name === 'tournament') return <TournamentDetailPage id={route.id} />
  if (route.name === 'game') {
    return <GameHubPage slug={route.slug} period={route.period} />
  }
  if (route.name === 'gamePlay' && route.slug === 'stacker') return <StackerPage />
  if (route.name === 'gamePlay' && route.slug === 'patriot') return <PatriotPage />
  if (route.name === 'gamePlay' && route.slug === 'snake') return <SnakePage />
  if (route.name === 'gamePlay' && route.slug === 'pop') return <WhackPage />
  if (route.name === 'gamePlay' && route.slug === 'simon') return <SimonPage />
  if (route.name === 'gamePlay' && route.slug === 'dead-center') return <DeadCenterPage />
  if (route.name === 'gamePlay' && route.slug === 'asteroids') return <AsteroidsPage />
  if (route.name === 'gamePlay') return <ComingSoonPage slug={route.slug} />
  return <HomePage />
}

export default App
