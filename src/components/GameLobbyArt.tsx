import type { CSSProperties, ReactNode } from 'react'
import { GameTileArt } from './GameTileArt'

type GameLobbyArtProps = {
  slug: string
  accent?: string
  /** Overlay control (e.g. share), top-right of the art. */
  action?: ReactNode
}

/** Same art block as the individual game preview / lobby page. */
export function GameLobbyArt({ slug, accent, action }: GameLobbyArtProps) {
  return (
    <div
      className="game-lobby__art"
      style={
        accent
          ? ({ '--tile-accent': accent } as CSSProperties)
          : undefined
      }
    >
      {action}
      <div className="game-lobby__stage">
        <GameTileArt slug={slug} />
      </div>
    </div>
  )
}
