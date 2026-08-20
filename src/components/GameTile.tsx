import type { CSSProperties } from 'react'
import type { Game } from '../data/games'
import { GameTileArt } from './GameTileArt'

type GameTileProps = {
  game: Game
  index: number
}

export function GameTile({ game, index }: GameTileProps) {
  const style = {
    '--tile-accent': game.accent,
    animationDelay: `${0.05 + index * 0.05}s`,
  } as CSSProperties

  const hideOnPhone = Boolean(game.devices && !game.devices.includes('phone'))

  return (
    <li className={hideOnPhone ? 'game-grid__item--no-phone' : undefined}>
      <a
        className="game-tile"
        href={`#/games/${game.slug}`}
        style={style}
        aria-label={game.name}
      >
        <div className="game-tile__art">
          <div className="game-tile__stage">
            <GameTileArt slug={game.slug} />
          </div>
          <h3 className="game-tile__title">{game.name}</h3>
        </div>
      </a>
    </li>
  )
}
