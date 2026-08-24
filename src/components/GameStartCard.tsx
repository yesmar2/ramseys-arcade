import { PersonalBestHint } from './PersonalBestHint'

/** Shared play-field title card: name, one line, best, start cue. */
export function GameStartCard({
  title,
  tagline,
  slug,
}: {
  title: string
  tagline: string
  slug: string
}) {
  return (
    <div className="game-start-card" aria-hidden="true">
      <h2>{title}</h2>
      <p>{tagline}</p>
      <PersonalBestHint slug={slug} />
      <span className="game-start-card__cue">Tap to start</span>
    </div>
  )
}
