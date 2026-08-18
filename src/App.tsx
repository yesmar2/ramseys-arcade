import { useEffect } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { getGame } from './data/games'
import { useHashRoute } from './hooks/useHashRoute'
import { PLAYER_NAME_EVENT } from './lib/leaderboard'
import { refreshPersonalBests } from './lib/personalBest'
import { unlockSound } from './lib/sound'
import { AsteroidsPage } from './pages/AsteroidsPage'
import { DeadCenterPage } from './pages/DeadCenterPage'
import { HomePage } from './pages/HomePage'
import { LeaderboardsPage } from './pages/LeaderboardsPage'
import { PatriotPage } from './pages/PatriotPage'
import { SimonPage } from './pages/SimonPage'
import { SnakePage } from './pages/SnakePage'
import { StackerPage } from './pages/StackerPage'
import { WhackPage } from './pages/WhackPage'
import { TournamentDetailPage, TournamentsPage } from './pages/TournamentsPage'
import { TournamentPlayPage } from './pages/TournamentPlayPage'

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

function App() {
  const route = useHashRoute()

  useEffect(() => {
    void refreshPersonalBests()
    const sync = () => {
      void refreshPersonalBests()
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

  if (route.name === 'home') return <HomePage />
  if (route.name === 'leaderboards') {
    return <LeaderboardsPage game={route.game} period={route.period} />
  }
  if (route.name === 'tournaments') return <TournamentsPage />
  if (route.name === 'tournamentPlay') {
    return <TournamentPlayPage tournamentId={route.id} gameSlug={route.game} />
  }
  if (route.name === 'tournament') return <TournamentDetailPage id={route.id} />
  if (route.name === 'game' && route.slug === 'stacker') return <StackerPage />
  if (route.name === 'game' && route.slug === 'patriot') return <PatriotPage />
  if (route.name === 'game' && route.slug === 'snake') return <SnakePage />
  if (route.name === 'game' && route.slug === 'pop') return <WhackPage />
  if (route.name === 'game' && route.slug === 'simon') return <SimonPage />
  if (route.name === 'game' && route.slug === 'dead-center') return <DeadCenterPage />
  if (route.name === 'game' && route.slug === 'asteroids') return <AsteroidsPage />
  if (route.name === 'game') return <ComingSoonPage slug={route.slug} />
  return <HomePage />
}

export default App
