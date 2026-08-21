import { homeGames } from '../data/games'
import { useDeviceType } from '../lib/device'
import { GameTile } from './GameTile'

export function GameGrid() {
  const device = useDeviceType()
  const tiles = homeGames(device)

  return (
    <section className="games games--playable" id="games" aria-labelledby="games-heading">
      <h2 id="games-heading" className="visually-hidden">
        Games
      </h2>
      <ul className="game-grid game-grid--playable">
        {tiles.map((game, index) => (
          <GameTile key={game.slug} game={game} index={index} showOnAllDevices />
        ))}
      </ul>
    </section>
  )
}
