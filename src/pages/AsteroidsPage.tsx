import { AsteroidsGame } from '../games/asteroids/AsteroidsGame'

export function AsteroidsPage() {
  return (
    <main className="game-page game-page--fullscreen">
      <a className="game-page__back game-page__back--overlay" href="#/">
        ← Games
      </a>
      <AsteroidsGame />
    </main>
  )
}
