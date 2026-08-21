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
      aria-label={`Your standing: rank ${rank}, ${valueLabel} ${String(value)}`}
    >
      <div className="you-strip__rank" aria-hidden="true">
        <span className="you-strip__hash">#</span>
        <span className="you-strip__num">{rank}</span>
      </div>
      <div className="you-strip__meta">
        <div className="you-strip__score-line">
          <span className="you-strip__label">{valueLabel}</span>
          <strong className="you-strip__value">{value}</strong>
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
