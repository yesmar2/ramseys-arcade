import type { CSSProperties } from 'react'
import { GameThumbArt } from './GameThumbArt'

type GamePageHeaderProps = {
  slug: string
  accent: string
  title: string
}

/** Compact game title: thumb + name (leaderboards, records). */
export function GamePageHeader({ slug, accent, title }: GamePageHeaderProps) {
  return (
    <header
      className="lb-page__header lb-page__header--compact lb-game-board__head"
      style={{ '--board-accent': accent } as CSSProperties}
    >
      <div className="lb-game-board__title-row">
        <span className="lb-game-board__thumb" aria-hidden="true">
          <GameThumbArt slug={slug} accent={accent} />
        </span>
        <h1 className="lb-game-board__title">{title}</h1>
      </div>
    </header>
  )
}
