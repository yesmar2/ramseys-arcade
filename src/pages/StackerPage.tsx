import { StackerGame } from '../games/stacker/StackerGame'

export function StackerPage() {
  return (
    <main className="game-page game-page--fullscreen">
      <a className="game-page__back game-page__back--overlay" href="#/">
        ← Games
      </a>
      <StackerGame />
    </main>
  )
}
