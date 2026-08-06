import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { getGame } from './data/games'
import { useHashRoute } from './hooks/useHashRoute'
import { HomePage } from './pages/HomePage'
import { LeaderboardsPage } from './pages/LeaderboardsPage'
import { PatriotPage } from './pages/PatriotPage'
import { SnakePage } from './pages/SnakePage'
import { StackerPage } from './pages/StackerPage'
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
          <p className="game-page__blurb">
            {game
              ? 'This one’s still in the workshop. Try Stacker, Patriot, or Snake for now.'
              : 'That game isn’t on the board yet.'}
          </p>
          <a className="game-page__cta" href="#/games/snake">
            Play Snake
          </a>
        </div>
      </main>
      <Footer />
    </>
  )
}

function App() {
  const route = useHashRoute()

  if (route.name === 'home') return <HomePage />
  if (route.name === 'leaderboards') return <LeaderboardsPage />
  if (route.name === 'tournaments') return <TournamentsPage />
  if (route.name === 'tournamentPlay') {
    return <TournamentPlayPage tournamentId={route.id} gameSlug={route.game} />
  }
  if (route.name === 'tournament') return <TournamentDetailPage id={route.id} />
  if (route.name === 'game' && route.slug === 'stacker') return <StackerPage />
  if (route.name === 'game' && route.slug === 'patriot') return <PatriotPage />
  if (route.name === 'game' && route.slug === 'snake') return <SnakePage />
  if (route.name === 'game') return <ComingSoonPage slug={route.slug} />
  return <HomePage />
}

export default App
