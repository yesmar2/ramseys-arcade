import type { ReactNode } from 'react'
import { getGame } from '../data/games'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { useActiveChallenge } from '../lib/challenges'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { ChallengeTarget } from './ChallengeTarget'
import { GamePanelBody } from './PauseControls'

/**
 * The first screen of a game: the game's name and what it is, your best and
 * the record, the sound and the rules, and Start. It is the pause card's
 * twin (the same card in the panel kit, in the game's colour), so stopping
 * a run lands where the run began.
 *
 * A tap anywhere starts the run, and so does Space or Enter. Start is a real
 * button for the eye and the keyboard; it passes its press on to the
 * playfield like any other tap, so it starts the run the same way.
 */
export function GameStartCard({
  title,
  slug,
  extraMeta,
  tools,
}: {
  title: string
  slug: string
  /** Extra rows under Your best / All time, same slot the pause panel uses. */
  extraMeta?: ReactNode
  /** Admin stage picker, same slot the pause panel puts it in. */
  tools?: ReactNode
}) {
  const personalBest = usePersonalBest(slug)
  const blurb = getGame(slug)?.description
  const challenge = useActiveChallenge(slug)

  return (
    <div className="game-card game-card--start" style={gameAccentStyle(slug)}>
      <div className="game-card__head">
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        {blurb ? <p className="game-card__blurb">{blurb}</p> : null}
      </div>
      <ChallengeTarget slug={slug} />
      <GamePanelBody slug={slug} personalBest={personalBest} extraMeta={extraMeta} tools={tools} />
      <button type="button" className="panel__btn game-card__start">
        {challenge ? 'Take it on' : 'Start'}
      </button>
    </div>
  )
}
