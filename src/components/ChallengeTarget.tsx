import { challengeWhen, clearActiveChallenge, playingSlug, useActiveChallenge } from '../lib/challenges'
import { scoreUnit } from '../lib/gameBoard'
import { getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore, isTimeBoard } from '../lib/leaderboardFormat'
import { PlayerAvatar } from './PlayerAvatar'

/*
 * A friend's challenge, where a run meets it: on the start card before the
 * run (whose it is, the score to beat, when it was set), and in a chip under
 * the score during it (how far there is to go, gold once it's passed).
 */

/** The challenge on the start card, with a way to play without it. */
export function ChallengeTarget({ slug }: { slug: string }) {
  const challenge = useActiveChallenge(slug)
  if (!challenge) return null
  const own = normalizePlayerName(challenge.name) === normalizePlayerName(getLastPlayerName())
  const figure = formatLeaderboardScore(slug, challenge.score)
  const unit = scoreUnit(slug, challenge.score)
  const beaten = challenge.best != null && challenge.best > challenge.score
  return (
    <div className="game-card__challenge">
      <button
        type="button"
        className="game-card__challenge-x"
        aria-label="Play without the challenge"
        title="Play without the challenge"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          clearActiveChallenge(slug)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span className="game-card__challenger">
        <PlayerAvatar avatarId={challenge.avatarId} name={challenge.name} size="sm" />
        {own ? 'Your challenge' : `${challenge.name} challenges you`}
      </span>
      <span className="game-card__target">
        <strong>{figure}</strong>
        {unit ? ` ${unit}` : ''} to beat
      </span>
      <span className="game-card__when">
        {beaten && challenge.best != null
          ? `You beat it with ${formatLeaderboardScore(slug, challenge.best)}`
          : `Set ${challengeWhen(challenge.createdAt)}`}
      </span>
    </div>
  )
}

/**
 * The target under the score during a run. The figure comes from the
 * readout; boards kept as a clock show only the target, since the live clock
 * isn't in the board's terms.
 */
export function ChallengeChip({ value }: { value: number | null }) {
  const slug = playingSlug()
  const challenge = useActiveChallenge(slug)
  if (!slug || !challenge) return null
  const figure = formatLeaderboardScore(slug, challenge.score)
  const time = isTimeBoard(slug)
  const live = !time && value != null
  const passed = live && value > challenge.score
  const share = live && challenge.score > 0 ? Math.max(0, Math.min(1, value / challenge.score)) : 0
  return (
    <span className={`challenge-chip${passed ? ' challenge-chip--passed' : ''}`} aria-hidden="true">
      <PlayerAvatar avatarId={challenge.avatarId} name={challenge.name} size="sm" />
      {passed ? (
        <>
          Past {challenge.name}’s {figure}
          <svg className="challenge-chip__tick" viewBox="0 0 24 24">
            <path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>
      ) : (
        <>
          <span>
            {challenge.name} {figure}
          </span>
          {live ? (
            <>
              <span className="challenge-chip__bar">
                <span style={{ width: `${Math.round(share * 100)}%` }} />
              </span>
              <span className="challenge-chip__togo">{(challenge.score - value).toLocaleString()} to go</span>
            </>
          ) : null}
        </>
      )}
    </span>
  )
}
