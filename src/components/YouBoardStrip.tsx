import type { CSSProperties, ReactNode } from 'react'

type YouBoardStripProps = {
  rank: number
  value: ReactNode
  valueLabel?: string
  gap: string | null
  accent?: string
  sticky?: boolean
  findMe?: boolean
  onFindMe?: () => void
}

export function YouBoardStrip({
  rank,
  value,
  valueLabel = 'Score',
  gap,
  accent,
  sticky = true,
  findMe = false,
  onFindMe,
}: YouBoardStripProps) {
  const style = accent
    ? ({ '--lb-you-accent': accent } as CSSProperties)
    : undefined

  return (
    <div
      className={`you-strip${sticky ? ' you-strip--sticky' : ''}`}
      style={style}
      role="status"
      aria-label={`Your standing: rank ${rank}`}
    >
      <div className="you-strip__main">
        <div className="you-strip__stat">
          <span className="you-strip__label">Rank</span>
          <strong>#{rank}</strong>
        </div>
        <div className="you-strip__stat">
          <span className="you-strip__label">{valueLabel}</span>
          <strong>{value}</strong>
        </div>
        {gap ? <p className="you-strip__gap">{gap}</p> : null}
      </div>
      {findMe && onFindMe ? (
        <button type="button" className="you-strip__find" onClick={onFindMe}>
          Find me
        </button>
      ) : null}
    </div>
  )
}
