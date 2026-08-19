import { Footer } from '../components/Footer'
import { GameGrid } from '../components/GameGrid'
import { HomeBar } from '../components/HomeBar'

export function HomePage() {
  return (
    <>
      <main>
        <div className="home-stage home-stage--bare">
          <HomeBar />
          <GameGrid />
        </div>
      </main>
      <Footer />
    </>
  )
}
