import { useEffect, useId, useRef, useState } from 'react'
import { getGame } from '../data/games'
import { gameBoardHref, leaderboardHref } from '../hooks/useHashRoute'
import {
  LEADERBOARD_GAMES,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

type BoardTrailProps = {
  game: LeaderboardGame
  period: LeaderboardPeriod
}

/** Boards › [current game ▾] — switch games without leaving the board chrome. */
export function BoardTrail({ game, period }: BoardTrailProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const listId = useId()
  const current = getGame(game)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [game, period])

  return (
    <nav className="board-trail" aria-label="Boards" ref={rootRef}>
      <a className="board-trail__parent" href={leaderboardHref()}>
        Boards
      </a>
      <span className="board-trail__sep" aria-hidden="true">
        /
      </span>
      <div className="board-trail__game">
        <button
          type="button"
          className="board-trail__trigger"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{current?.name ?? game}</span>
          <span className="board-trail__caret" aria-hidden="true">
            ▾
          </span>
        </button>
        {open ? (
          <ul
            id={listId}
            className="board-trail__menu"
            role="listbox"
            aria-label="Switch game board"
          >
            {LEADERBOARD_GAMES.map((slug) => {
              const meta = getGame(slug)
              const selected = slug === game
              return (
                <li key={slug} role="presentation">
                  <a
                    role="option"
                    aria-selected={selected}
                    className={`board-trail__option${selected ? ' board-trail__option--active' : ''}`}
                    href={gameBoardHref(slug, period)}
                    onClick={() => setOpen(false)}
                  >
                    {meta?.name ?? slug}
                  </a>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </nav>
  )
}
