import { SimonGame } from '../games/simon/SimonGame'

export function SimonPage() {
  return (
    <main className="game-page game-page--fullscreen">
      <a className="game-page__back game-page__back--overlay" href="#/">
        ← Games
      </a>
      <SimonGame />
    </main>
  )
}
