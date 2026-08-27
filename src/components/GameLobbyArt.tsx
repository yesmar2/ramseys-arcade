import type { CSSProperties } from 'react'
import { GameThumbArt } from './GameThumbArt'

type GameLobbyArtProps = {
  slug: string
  accent?: string
}

/** Large framed thumb — same language as home / Events cards. */
export function GameLobbyArt({ slug, accent }: GameLobbyArtProps) {
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
    </div>
  )
}
