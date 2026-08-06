import { SnakeGame } from '../games/snake/SnakeGame'

export function SnakePage() {
  return (
    <main className="game-page game-page--fullscreen">
      <a className="game-page__back game-page__back--overlay" href="#/">
        ← Games
      </a>
      <SnakeGame />
    </main>
  )
}
