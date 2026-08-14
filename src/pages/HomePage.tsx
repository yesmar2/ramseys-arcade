import { Footer } from '../components/Footer'
import { ComingSoonGrid, GameGrid } from '../components/GameGrid'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'

export function HomePage() {
  return (
    <>
      <Header />
      <main>
        <div className="home-stage">
          <Hero />
          <GameGrid />
        </div>
        <ComingSoonGrid />
      </main>
      <Footer />
    </>
  )
}
