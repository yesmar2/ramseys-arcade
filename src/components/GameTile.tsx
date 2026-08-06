import type { CSSProperties } from 'react'
import type { Game } from '../data/games'
import { GameTileArt } from './GameTileArt'

type GameTileProps = {
  game: Game
  index: number
  soon?: boolean
}

export function GameTile({ game, index, soon = false }: GameTileProps) {
  const style = {
    '--tile-accent': game.accent,
    borderTopColor: game.accent,
    animationDelay: `${0.05 + index * 0.05}s`,
  } as CSSProperties

  const hasArt = Boolean(game.playable)

  if (soon) {
    return (
      <li>
        <div
          className="game-tile game-tile--soon"
          style={style}
          aria-label={`${game.name}, coming soon`}
        >
          <div className="game-tile__swatch" aria-hidden="true" />
          <h3 className="game-tile__title">{game.name}</h3>
          <p className="game-tile__blurb">{game.description}</p>
          <span className="game-tile__play">Soon</span>
        </div>
      </li>
    )
  }

  return (
    <li>
      <a
        className={`game-tile${hasArt ? ' game-tile--art' : ''}`}
        href={`#/games/${game.slug}`}
        style={style}
      >
        <GameTileArt slug={game.slug} />
        <h3 className="game-tile__title">{game.name}</h3>
        <p className="game-tile__blurb">{game.description}</p>
        <span className="game-tile__play">Play</span>
      </a>
    </li>
  )
}
