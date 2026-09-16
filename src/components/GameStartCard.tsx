import { getGame } from '../data/games'
import { scoringFor } from '../data/scoring'
import { PersonalBestHint } from './PersonalBestHint'
import { ScoreGuide } from './ScoreGuide'

/**
 * Shared play-field title card: name, best, start cue, and the rules behind an
 * icon. The tagline used to sit under the name, which made the first thing you
 * saw on every game a sentence explaining it — the rules are one tap away now
 * for anyone who wants them, and out of the way of everyone who does not.
 */
export function GameStartCard({ title, slug }: { title: string; slug: string }) {
  const how = getGame(slug)?.how
  const scoring = scoringFor(slug)

  return (
    <div className="game-start-card">
      <h2>{title}</h2>
      <PersonalBestHint slug={slug} />
      <span className="game-start-card__cue">Tap to start</span>
      {how ? (
        <div className="game-start-card__how">
          <ScoreGuide how={how} rows={scoring} />
        </div>
      ) : null}
    </div>
  )
}
