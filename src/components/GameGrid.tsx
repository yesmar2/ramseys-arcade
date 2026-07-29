import { games } from '../data/games'
import { GameTile } from './GameTile'

export function GameGrid() {
  return (
    <section className="games" id="games" aria-labelledby="games-heading">
      <div className="games__intro">
        <h2 id="games-heading">Games</h2>
        <p>Pick a tile and jump in. More coming soon.</p>
      </div>
      <ul className="game-grid">
        {games.map((game, index) => (
          <GameTile key={game.slug} game={game} index={index} />
        ))}
      </ul>
    </section>
  )
}
