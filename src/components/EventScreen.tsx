import { getGame } from '../data/games'
import { hasGamePreview } from '../lib/gamePreviews'
import { resolveGameAccent } from '../lib/theme'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z" fill="currentColor" />
    </svg>
  )
}

/**
 * One of an event's games on a small screen: its thumb, then the game playing
 * itself once a pointer rests on it (or, on a phone, once it is the one
 * nearest the middle of the screen), with Play on it when there is a way in.
 */
export function EventScreen({
  slug,
  href,
  label,
  className,
}: {
  slug: string
  /** Where Play goes; none when the game can't be played for this event now. */
  href: string | null
  label?: string
  className?: string
}) {
  const game = getGame(slug)
  const accent = resolveGameAccent(slug, game?.accent ?? '#2eb8a0')
  const inner = (
    <>
      <span className="evp-screen__thumb" aria-hidden="true">
        <GameThumbArt slug={slug} accent={accent} />
      </span>
      {hasGamePreview(slug) ? <GamePreview slug={slug} className="evp-screen__game" /> : null}
      {href ? (
        <span className="evp-screen__play" aria-hidden="true">
          <PlayMark />
          Play
        </span>
      ) : null}
    </>
  )
  const cls = `evp-screen${className ? ` ${className}` : ''}`
  return href ? (
    <a className={cls} href={href} aria-label={label ?? `Play ${game?.name ?? slug}`}>
      {inner}
    </a>
  ) : (
    <span className={cls} aria-hidden="true">
      {inner}
    </span>
  )
}
