import type { CSSProperties } from 'react'
import { GameTileArt } from './GameTileArt'

type BoardGameThumbProps = {
  slug: string
  accent?: string
}

export function BoardGameThumb({ slug, accent }: BoardGameThumbProps) {
  return (
    <div
      className="board-thumb"
      style={
        accent
          ? ({ '--tile-accent': accent } as CSSProperties)
          : undefined
      }
      aria-hidden="true"
    >
      <div className="board-thumb__stage">
        <GameTileArt slug={slug} />
      </div>
    </div>
  )
}
