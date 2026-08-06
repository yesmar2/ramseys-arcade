import { PatriotGame } from '../games/patriot/PatriotGame'

export function PatriotPage() {
  return (
    <main className="game-page game-page--fullscreen">
      <a className="game-page__back game-page__back--overlay" href="#/">
        ← Games
      </a>
      <PatriotGame />
    </main>
  )
}
