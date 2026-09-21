import type { ReactNode } from 'react'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { GamePanelBody } from './PauseControls'

/**
 * The first screen of a game: the pause panel with the game's name at the top
 * and a start cue instead of the resume hint. Before this the two screens were
 * built separately and slowly drifted apart, which made stopping a run feel
 * like landing somewhere else. Same panel, two moments.
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

  return (
    <div className="game-pause-card game-start-card">
      <h2>{title}</h2>
      <GamePanelBody
        slug={slug}
        personalBest={personalBest}
        extraMeta={extraMeta}
        tools={tools}
      />
      <span className="game-start-card__cue">Tap to start</span>
    </div>
  )
}
