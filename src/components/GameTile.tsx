import type { CSSProperties } from 'react'
import type { Game } from '../data/games'

type GameTileProps = {
  game: Game
  index: number
}

export function GameTile({ game, index }: GameTileProps) {
  const style = {
    '--tile-accent': game.accent,
    borderTopColor: game.accent,
    animationDelay: `${0.05 + index * 0.05}s`,
  } as CSSProperties

  return (
    <li>
      <a className="game-tile" href={`#/games/${game.slug}`} style={style}>
        <div className="game-tile__swatch" aria-hidden="true" />
        <h3 className="game-tile__title">{game.name}</h3>
        <p className="game-tile__blurb">{game.description}</p>
        <span className="game-tile__play">Play</span>
      </a>
    </li>
  )
}
