import { Footer } from './components/Footer'
import { GameGrid } from './components/GameGrid'
import { Header } from './components/Header'
import { Hero } from './components/Hero'

function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <GameGrid />
        <div id="leaderboards" hidden aria-hidden="true" />
      </main>
      <Footer />
    </>
  )
}

export default App
