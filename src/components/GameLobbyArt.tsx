import type { CSSProperties } from 'react'
import { GameTileArt } from './GameTileArt'

type GameLobbyArtProps = {
  slug: string
  accent?: string
}

/** Same art block as the individual game preview / lobby page. */
export function GameLobbyArt({ slug, accent }: GameLobbyArtProps) {
  return (
    <div
      className="game-lobby__art"
      style={
        accent
          ? ({ '--tile-accent': accent } as CSSProperties)
          : undefined
      }
    >
      <div className="game-lobby__stage">
        <GameTileArt slug={slug} />
      </div>
    </div>
  )
}
