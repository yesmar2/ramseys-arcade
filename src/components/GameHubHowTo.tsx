import { useEffect, useId, useState } from 'react'
import type { Game } from '../data/games'
import { howToPlayFor } from '../data/howToPlay'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { preloadTicketLadders } from '../lib/tickets'
import { HowToPlay } from './HowToPlay'
import { Panel, PanelHead } from './Panel'
import { WhatCounts } from './WhatCounts'

/**
 * How to play, from a game's page: a button beside Play, opening a panel with the same parts as the game's
 * own (ScoreGuide) and, on a daily, what counts: today's course toward your rank, a past one on its own board
 * or as practice. It was a section of the page until Ramsey found it "ugly and hard to read" there and asked
 * for it in a modal, opened when wanted (2026-09-30).
 */
export function GameHubHowTo({
  game,
  className,
  iconOnly = false,
}: {
  game: Game
  className?: string
  /** A round "?" with the words as its name: on a game's screen. */
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  // Its Tickets part is the API's: asked for with the page, so the panel opens whole.
  useEffect(() => {
    preloadTicketLadders()
  }, [])
  if (!howToPlayFor(game.slug)) return null
  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={iconOnly ? 'How to play' : undefined}
        title={iconOnly ? 'How to play' : undefined}
        onClick={() => setOpen(true)}
      >
        {iconOnly ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M9.5 9.2a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 3.8" />
            <path d="M12 17.2h.01" />
          </svg>
        ) : (
          'How to play'
        )}
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
