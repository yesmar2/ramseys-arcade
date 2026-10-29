import type { ReactNode } from 'react'
import { getGame } from '../data/games'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { fitCardToSpace } from '../lib/cardFit'
import { useActiveChallenge } from '../lib/challenges'
import { useChase } from '../lib/chase'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { ChallengeTarget } from './ChallengeTarget'
import { ChaseTarget } from './Chase'
import { GamePanelBody } from './PauseControls'

/**
 * The first screen of a game: the game's name and what it is, your best and
 * the record, Start, then the rules, the board and the sound. It is the pause card's
 * twin (the same card in the panel kit, in the game's colour), so stopping
 * a run lands where the run began.
 *
 * A tap anywhere starts the run, and so does Space or Enter, but not on the
 * card's other buttons and links: those keys are theirs (games/keys.ts).
 * Start is a real button for the eye and the keyboard; it passes its press on
 * to the playfield like any other tap, so it starts the run the same way. A
 * card too tall for its space scrolls instead (lib/cardFit): a tap on it is
 * then its own, and Start's goes on once it's a tap rather than a scroll.
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
  const chase = useChase(slug)

  return (
    <div ref={fitCardToSpace} className="game-card game-card--start" style={gameAccentStyle(slug)}>
      <div className="game-card__head">
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        {blurb ? <p className="game-card__blurb">{blurb}</p> : null}
      </div>
      <ChallengeTarget slug={slug} />
      {/* A record picked with Chase a record, beside Play on the game's page (lib/chase.ts). */}
      <ChaseTarget slug={slug} />
      {/* Start under the figures, then How to play, the board and Sound (A of "Launch UX picks", 2026-10-20). */}
      <GamePanelBody
        slug={slug}
        personalBest={personalBest}
        extraMeta={extraMeta}
        tools={tools}
        primary={
          <button type="button" className="panel__btn game-card__start">
            {challenge ? 'Take it on' : chase ? 'Chase it' : 'Start'}
          </button>
        }
      />
    </div>
  )
}
