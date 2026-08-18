import { DeadCenterGame } from '../games/dead-center/DeadCenterGame'

export function DeadCenterPage() {
  return (
    <main className="game-page game-page--fullscreen">
      <a className="game-page__back game-page__back--overlay" href="#/">
        ← Games
      </a>
      <DeadCenterGame />
    </main>
  )
}
