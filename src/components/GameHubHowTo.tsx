import type { Game } from '../data/games'
import { howToPlayFor } from '../data/howToPlay'
import { HowToPlay } from './HowToPlay'

/** How to play, on the page rather than only inside the game: the same parts as the game's own panel. */
export function GameHubHowTo({ game }: { game: Game }) {
  if (!howToPlayFor(game.slug)) return null
  return (
    <section className="gh-card gh-how" aria-labelledby="gh-how-title" data-hunt={`g-howto-${game.slug}`}>
      <h2 id="gh-how-title" className="gh-card__title">
        How to play
      </h2>
      <HowToPlay slug={game.slug} />
    </section>
  )
}
