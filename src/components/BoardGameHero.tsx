import type { CSSProperties } from 'react'
import { GameTileArt } from './GameTileArt'

type BoardGameHeroProps = {
  slug: string
  accent?: string
}

/** Wide, low banner — game art as a soft backdrop on board / record pages. */
export function BoardGameHero({ slug, accent }: BoardGameHeroProps) {
  return (
    <div
      className="board-hero"
      style={
        accent
          ? ({ '--tile-accent': accent } as CSSProperties)
          : undefined
      }
      aria-hidden="true"
    >
      <div className="board-hero__art">
        <GameTileArt slug={slug} />
      </div>
      <div className="board-hero__veil" />
    </div>
  )
}
