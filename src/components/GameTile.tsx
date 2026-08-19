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

  return (
    <li>
      <a
        className="game-tile"
        href={`#/games/${game.slug}`}
        style={style}
        aria-label={game.name}
      >
        <GameTileArt slug={game.slug} />
        <h3 className="game-tile__title">{game.name}</h3>
      </a>
    </li>
  )
}
