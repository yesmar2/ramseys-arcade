import { ArcadeAttendant } from '../components/ArcadeAttendant'
import { Footer } from '../components/Footer'
import { GameGrid } from '../components/GameGrid'
import { HomeBar } from '../components/HomeBar'
import { ATTENDANT_ENABLED } from '../lib/attendant'

export function HomePage() {
  return (
    <>
      <main>
        <div className="home-stage home-stage--bare">
          <div className="home-ambient" aria-hidden="true">
            <span className="home-ambient__orb home-ambient__orb--a" />
            <span className="home-ambient__orb home-ambient__orb--b" />
            <span className="home-ambient__orb home-ambient__orb--c" />
          </div>
          <HomeBar />
          <GameGrid />
        </div>
      </main>
      <Footer />
      {ATTENDANT_ENABLED ? <ArcadeAttendant /> : null}
    </>
  )
}
