import type { CSSProperties, ReactNode } from 'react'
import { GameThumbArt } from './GameThumbArt'
import { PageBackLink } from './PageBackLink'

type GamePageHeaderProps = {
  slug: string
  accent: string
  title: string
  /** Optional: when set, title (and thumb) link here. Prefer a Play CTA instead. */
  href?: string
  /** Icon back control on the left of the centered heading. */
  backHref?: string
  backLabel?: string
  /** Optional trailing control (e.g. Record books link). */
  action?: ReactNode
}

/** Centered game title: thumb + name, optional back + side action. */
export function GamePageHeader({
  slug,
  accent,
  title,
  href,
  backHref,
  backLabel = 'Back',
  action,
}: GamePageHeaderProps) {
  const identity = (
    <>
      <span className="lb-game-board__thumb" aria-hidden="true">
        <GameThumbArt slug={slug} accent={accent} />
      </span>
      <h1 className="lb-page__title lb-game-board__title">{title}</h1>
    </>
  )

  return (
    <header
      className="lb-page__header lb-page__header--compact lb-game-board__head"
      style={{ '--board-accent': accent } as CSSProperties}
    >
      <div className="lb-page__heading-row">
        {backHref ? (
          <PageBackLink href={backHref} label={backLabel} />
        ) : (
          <span className="lb-page__heading-slot" aria-hidden="true" />
        )}
        {href ? (
          <a className="lb-game-board__identity" href={href}>
            {identity}
          </a>
        ) : (
          <div className="lb-game-board__identity lb-game-board__identity--static">
            {identity}
          </div>
        )}
        {action ? (
          <div className="lb-game-board__action">{action}</div>
        ) : (
          <span className="lb-page__heading-slot" aria-hidden="true" />
        )}
      </div>
    </header>
  )
}
