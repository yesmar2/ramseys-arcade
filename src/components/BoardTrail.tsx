import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { gameBoardHref, leaderboardHref } from '../hooks/useHashRoute'
import {
  LEADERBOARD_GAMES,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

type TrailSwitcher = {
  game: LeaderboardGame
  period: LeaderboardPeriod
}

type PageTrailProps = {
  parentHref: string
  parentLabel: string
  /** Current crumb label (also used as the page h1). */
  currentLabel: string
  /** When set, current crumb opens a game-board switcher. */
  switcher?: TrailSwitcher
  ariaLabel?: string
}

/** Large parent / current trail — replaces a separate page heading. */
export function PageTrail({
  parentHref,
  parentLabel,
  currentLabel,
  switcher,
  ariaLabel = 'Breadcrumb',
}: PageTrailProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const listId = useId()

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
  }, [currentLabel, switcher?.game, switcher?.period])

  let current: ReactNode
  if (switcher) {
    current = (
      <div className="page-trail__switch">
        <button
          type="button"
          className="page-trail__trigger"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{currentLabel}</span>
          <span className="page-trail__caret" aria-hidden="true">
            ▾
          </span>
        </button>
        {open ? (
          <ul
            id={listId}
            className="page-trail__menu"
            role="listbox"
            aria-label="Switch game board"
          >
            {LEADERBOARD_GAMES.map((slug) => {
              const meta = getGame(slug)
              const selected = slug === switcher.game
              return (
                <li key={slug} role="presentation">
                  <a
                    role="option"
                    aria-selected={selected}
                    className={`page-trail__option${selected ? ' page-trail__option--active' : ''}`}
                    href={gameBoardHref(slug, switcher.period)}
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
    )
  } else {
    current = <span className="page-trail__current-text">{currentLabel}</span>
  }

  return (
    <nav className="page-trail" aria-label={ariaLabel} ref={rootRef}>
      <a className="page-trail__parent" href={parentHref}>
        {parentLabel}
      </a>
      <span className="page-trail__sep" aria-hidden="true">
        /
      </span>
      <h1 className="page-trail__current">{current}</h1>
    </nav>
  )
}

/** Boards / [game ▾] on dedicated score boards. */
export function BoardTrail({
  game,
  period,
}: {
  game: LeaderboardGame
  period: LeaderboardPeriod
}) {
  const name = getGame(game)?.name ?? game
  return (
    <PageTrail
      parentHref={leaderboardHref()}
      parentLabel="Boards"
      currentLabel={name}
      switcher={{ game, period }}
      ariaLabel="Boards"
    />
  )
}
