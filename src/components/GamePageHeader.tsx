import type { CSSProperties, ReactNode } from 'react'
import { GameThumbArt } from './GameThumbArt'
import { PageBackLink } from './PageBackLink'

type GamePageHeaderProps = {
  slug: string
  accent: string
  title: string
  /** Optional: when set, title (and thumb) link here. Prefer playHref instead. */
  href?: string
  /** Compact right-aligned Play control. */
  playHref?: string
  /** Icon back control on the left of the centered heading. */
  backHref?: string
  backLabel?: string
  /** Trailing control(s), shown before Play when both are set. */
  action?: ReactNode
}

/** Centered game title: thumb + name, optional back + Play. */
export function GamePageHeader({
  slug,
  accent,
  title,
  href,
  playHref,
  backHref,
  backLabel = 'Back',
  action,
}: GamePageHeaderProps) {
  const identity = (
    <>
      <GameThumbArt slug={slug} accent={accent} />
      <h1 className="lb-page__title lb-game-board__title">{title}</h1>
    </>
  )

  const trailing =
    playHref || action ? (
      <div className="lb-game-board__trailing">
        {action}
        {playHref ? (
          <a className="lb-game-board__play" href={playHref}>
            Play
          </a>
        ) : null}
      </div>
    ) : (
      <span className="lb-page__heading-slot" aria-hidden="true" />
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
        {trailing}
      </div>
    </header>
  )
}
