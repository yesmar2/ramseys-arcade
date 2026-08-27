import type { CSSProperties, ReactNode } from 'react'
import { GameThumbArt } from './GameThumbArt'

type GameLobbyArtProps = {
  slug: string
  accent?: string
  /** Overlay control (e.g. share), top-right of the art. */
  action?: ReactNode
}

/** Large framed thumb — same language as home / Events cards. */
export function GameLobbyArt({ slug, accent, action }: GameLobbyArtProps) {
  return (
    <div
      className="game-lobby__art"
      style={
        accent
          ? ({ '--tile-accent': accent, '--thumb-accent': accent } as CSSProperties)
          : undefined
      }
    >
      <GameThumbArt slug={slug} accent={accent} className="game-lobby__thumb" />
      {action}
    </div>
  )
}
