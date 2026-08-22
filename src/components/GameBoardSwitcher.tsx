import type { CSSProperties } from 'react'
import { gameHasRecords } from '../lib/records'

export type BoardTab = 'scores' | 'records'

type GameBoardSwitcherProps = {
  slug: string
  accent: string
  active: BoardTab
  onSelect: (tab: BoardTab) => void
}

/** In-page tabs: Scores vs Record books (only when the game has records). */
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
      style={{ '--board-accent': accent } as CSSProperties}
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
      <span className="lb-board-switcher__sep" aria-hidden="true">
        |
      </span>
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
