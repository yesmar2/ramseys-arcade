import type { CSSProperties } from 'react'
import { gameHasRecords } from '../lib/records'

export type BoardTab = 'scores' | 'records'

type GameBoardSwitcherProps = {
  slug: string
  accent: string
  active: BoardTab
  onSelect: (tab: BoardTab) => void
}

/** Segment tabs: Scores vs Record books (hub only; games with records). */
export function GameBoardSwitcher({
  slug,
  accent,
  active,
  onSelect,
}: GameBoardSwitcherProps) {
  if (!gameHasRecords(slug)) return null

  return (
    <div
      className="lb-board-switcher"
      role="tablist"
      aria-label="Board type"
      style={
        {
          '--board-accent': accent,
          '--period-accent': accent,
        } as CSSProperties
      }
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === 'scores'}
        className={`lb-board-switcher__item${active === 'scores' ? ' lb-board-switcher__item--active' : ''}`}
        onClick={() => onSelect('scores')}
      >
        Scores
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'records'}
        className={`lb-board-switcher__item${active === 'records' ? ' lb-board-switcher__item--active' : ''}`}
        onClick={() => onSelect('records')}
      >
        Record books
      </button>
    </div>
  )
}
