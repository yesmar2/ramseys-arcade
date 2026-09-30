import { useId, useState } from 'react'
import type { Game } from '../data/games'
import { howToPlayFor } from '../data/howToPlay'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { HowToPlay } from './HowToPlay'
import { Panel, PanelHead } from './Panel'
import { WhatCounts } from './WhatCounts'

/**
 * How to play, from a game's page: a button beside Play, opening a panel with the same parts as the game's
 * own (ScoreGuide) and, on a daily, what counts: today's course toward your rank, a past one on its own board
 * or as practice. It was a section of the page until Ramsey found it "ugly and hard to read" there and asked
 * for it in a modal, opened when wanted (2026-09-30).
 */
export function GameHubHowTo({ game, className }: { game: Game; className?: string }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  if (!howToPlayFor(game.slug)) return null
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        How to play
      </button>
      {open ? (
        <Panel wide labelledBy={titleId} onClose={() => setOpen(false)} style={gameAccentStyle(game.slug)}>
          <PanelHead titleId={titleId} title="How to play" kicker={game.name} onClose={() => setOpen(false)} closeLabel="Close how to play" />
          <div className="panel__body panel__body--last">
            <HowToPlay slug={game.slug} />
            <WhatCounts slug={game.slug} />
          </div>
        </Panel>
      ) : null}
    </>
  )
}
