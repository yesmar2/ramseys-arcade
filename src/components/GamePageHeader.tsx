import type { CSSProperties, ReactNode } from 'react'
import { GameThumbArt } from './GameThumbArt'

type GamePageHeaderProps = {
  slug: string
  accent: string
  title: string
  /** When set, thumb + title link here (e.g. game hub). */
  href?: string
  /** Optional trailing control (e.g. Record books link). */
  action?: ReactNode
}

/** Compact game title: thumb + name, optional side action. */
export function GamePageHeader({
  slug,
  accent,
  title,
  href,
  action,
}: GamePageHeaderProps) {
  const identity = (
    <>
      <span className="lb-game-board__thumb" aria-hidden="true">
        <GameThumbArt slug={slug} accent={accent} />
      </span>
      <h1 className="lb-game-board__title">{title}</h1>
    </>
  )

  return (
    <header
      className="lb-page__header lb-page__header--compact lb-game-board__head"
      style={{ '--board-accent': accent } as CSSProperties}
    >
      <div className="lb-game-board__title-row">
        {href ? (
          <a className="lb-game-board__identity" href={href}>
            {identity}
          </a>
        ) : (
          identity
        )}
        {action ? (
          <div className="lb-game-board__action">{action}</div>
        ) : null}
      </div>
    </header>
  )
}
