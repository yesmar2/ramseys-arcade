import type { ReactNode } from 'react'
import { useBoardRecord } from '../hooks/useBoardRecord'
import { SoundToggle } from './SoundToggle'

export function GameHudStat({
  label,
  children,
  hot,
  urgent,
  className,
}: {
  label: string
  children: ReactNode
  hot?: boolean
  urgent?: boolean
  className?: string
}) {
  return (
    <div
      className={`game-hud__stat${hot ? ' game-stat--beat' : ''}${urgent ? ' game-hud__stat--urgent' : ''}${className ? ` ${className}` : ''}`}
    >
      <span className="game-hud__label">{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

export function GameHud({
  slug,
  personalBest,
  children,
  extra,
}: {
  slug: string
  personalBest: number
  children?: ReactNode
  extra?: ReactNode
}) {
  const allTime = useBoardRecord(slug)

  return (
    <div
      className="game-hud"
      aria-live="polite"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="game-hud__stats">
        {children}
        <GameHudStat className="game-hud__stat--best" label="Your best">
          {personalBest > 0 ? personalBest : '—'}
        </GameHudStat>
        <GameHudStat className="game-hud__stat--alltime" label="All time">
          {allTime > 0 ? allTime : '—'}
        </GameHudStat>
      </div>
      <div className="game-hud__extra">
        <SoundToggle />
        {extra}
      </div>
    </div>
  )
}
