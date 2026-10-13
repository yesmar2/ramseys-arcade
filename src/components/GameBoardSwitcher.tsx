import type { CSSProperties } from 'react'
import { moveChoice } from '../lib/choiceKeys'
import { mixColor, readableText } from '../lib/color'
import { gameHasRecords } from '../lib/records'

export type BoardTab = 'scores' | 'records'

type GameBoardSwitcherProps = {
  slug: string
  accent: string
  active: BoardTab
  onSelect: (tab: BoardTab) => void
}

/** Segmented pill: Scores vs Record books (hub only; games with records). */
export function GameBoardSwitcher({
  slug,
  accent,
  active,
  onSelect,
}: GameBoardSwitcherProps) {
  if (!gameHasRecords(slug)) return null

  return (
    <div
      className="seg"
      role="tablist"
      aria-label="Board type"
      onKeyDown={moveChoice}
      style={
        {
          '--board-accent': accent,
          '--period-accent': accent,
          '--period-text': readableText(accent, mixColor(accent, '#ffffff', 0.86)),
        } as CSSProperties
      }
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === 'scores'}
        tabIndex={active === 'scores' ? 0 : -1}
        className={`seg__item${active === 'scores' ? ' seg__item--active' : ''}`}
        onClick={() => onSelect('scores')}
      >
        Scores
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'records'}
        tabIndex={active === 'records' ? 0 : -1}
        className={`seg__item${active === 'records' ? ' seg__item--active' : ''}`}
        onClick={() => onSelect('records')}
      >
        Record books
      </button>
    </div>
  )
}
