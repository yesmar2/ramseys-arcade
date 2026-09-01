import { useEffect, useRef, useState } from 'react'
import { applySitePeriod, useHashRoute } from '../hooks/useHashRoute'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import {
  LEADERBOARD_PERIODS,
  PERIOD_LABELS,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

type SitePeriodControlProps = {
  variant: 'header' | 'drawer' | 'menu'
  onSelect?: () => void
}

export function SitePeriodControl({ variant, onSelect }: SitePeriodControlProps) {
  const period = useDefaultPeriod()
  const route = useHashRoute()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (variant !== 'header' || !open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
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
  }, [open, variant])

  const select = (next: LeaderboardPeriod) => {
    applySitePeriod(next, route)
    setOpen(false)
    onSelect?.()
  }

  if (variant === 'drawer') {
    return (
      <div className="site-drawer__period" aria-label="Time frame">
        <span className="site-drawer__period-label">Time frame</span>
        <div className="site-drawer__period-tabs" role="group">
          {LEADERBOARD_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`site-drawer__period-tab${period === p ? ' site-drawer__period-tab--active' : ''}`}
              aria-pressed={period === p}
              onClick={() => select(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'menu') {
    return (
      <div className="site-header__menu-period" role="group" aria-label="Time frame">
        <span className="site-header__menu-period-label">Time frame</span>
        {LEADERBOARD_PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="menuitemradio"
            aria-checked={period === p}
            className={`site-header__menu-period-btn${period === p ? ' site-header__menu-period-btn--active' : ''}`}
            onClick={() => select(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="site-header__period site-header__period--desktop" ref={ref}>
      <button
        type="button"
        className="site-header__period-btn"
        aria-label={`Time frame: ${PERIOD_LABELS[period]}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{PERIOD_LABELS[period]}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true" width="10" height="10">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            d="M2.5 4.5 6 8l3.5-3.5"
          />
        </svg>
      </button>
      {open ? (
        <div className="site-header__period-popover" role="listbox" aria-label="Time frame">
          {LEADERBOARD_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="option"
              aria-selected={period === p}
              className={`site-header__period-option${period === p ? ' site-header__period-option--active' : ''}`}
              onClick={() => select(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
