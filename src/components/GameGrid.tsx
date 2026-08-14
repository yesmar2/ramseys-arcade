import { comingSoonGames, playableGames } from '../data/games'
import { GameTile } from './GameTile'

export function GameGrid() {
  return <PlayableGrid />
}

export function ComingSoonGrid() {
  const soon = comingSoonGames()

  return (
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
  )
}

function PlayableGrid() {
  const playable = playableGames()

  return (
    <section className="games games--playable" id="games" aria-labelledby="games-heading">
      <h2 id="games-heading" className="visually-hidden">
        Games
      </h2>
      <ul className="game-grid game-grid--playable">
        {playable.map((game, index) => (
          <GameTile key={game.slug} game={game} index={index} />
        ))}
      </ul>
    </section>
  )
}
