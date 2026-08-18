import type { CSSProperties } from 'react'
import type { Game } from '../data/games'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { GameTileArt } from './GameTileArt'

type GameTileProps = {
  game: Game
  index: number
}

export function GameTile({ game, index }: GameTileProps) {
  const best = usePersonalBest(game.slug)
  const style = {
    '--tile-accent': game.accent,
    borderTopColor: game.accent,
    animationDelay: `${0.05 + index * 0.05}s`,
  } as CSSProperties

  return (
    <li>
      <a className="game-tile game-tile--art" href={`#/games/${game.slug}`} style={style}>
        <GameTileArt slug={game.slug} />
        <h3 className="game-tile__title">{game.name}</h3>
        <p className="game-tile__blurb">{game.description}</p>
        <span className="game-tile__footer">
          <span className="game-tile__play">Play</span>
          {best > 0 ? <span className="game-tile__best">Best {best}</span> : null}
        </span>
      </a>
    </li>
  )
}
