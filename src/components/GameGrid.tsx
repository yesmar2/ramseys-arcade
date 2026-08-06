import { comingSoonGames, playableGames } from '../data/games'
import { GameTile } from './GameTile'

export function GameGrid() {
  const playable = playableGames()
  const soon = comingSoonGames()

  return (
    <>
      <section className="games" id="games" aria-labelledby="games-heading">
        <div className="games__intro">
          <h2 id="games-heading">Games</h2>
          <p>Pick a tile and jump in.</p>
        </div>
        <ul className="game-grid">
          {playable.map((game, index) => (
            <GameTile key={game.slug} game={game} index={index} />
          ))}
        </ul>
      </section>

      <section
        className="games games--soon"
        id="coming-soon"
        aria-labelledby="soon-heading"
      >
        <div className="games__intro">
          <h2 id="soon-heading">Coming soon</h2>
          <p>More simple games on the way.</p>
        </div>
        <ul className="game-grid game-grid--soon">
          {soon.map((game, index) => (
            <GameTile key={game.slug} game={game} index={index} soon />
          ))}
        </ul>
      </section>
    </>
  )
}
