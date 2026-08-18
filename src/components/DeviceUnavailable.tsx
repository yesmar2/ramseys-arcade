import { Footer } from './Footer'
import { Header } from './Header'
import type { Game } from '../data/games'
import { deviceRequirementLabel } from '../data/games'

export function DeviceUnavailable({ game }: { game: Game }) {
  const detail = deviceRequirementLabel(game) ?? `${game.name} isn’t available on this device.`

  return (
    <>
      <Header />
      <main className="game-page">
        <div className="game-page__inner game-page__inner--narrow">
          <a className="game-page__back" href="#/">
            ← Games
          </a>
          <h1 className="game-page__title">{game.name}</h1>
          <p className="game-page__blurb">{detail}</p>
          <a className="game-page__cta" href="#/">
            See available games
          </a>
        </div>
      </main>
      <Footer />
    </>
  )
}
