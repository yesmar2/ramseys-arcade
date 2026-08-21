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
      className={`rank-page__summary rank-page__summary--bar you-strip${sticky ? ' you-strip--sticky' : ''}${findMe ? ' you-strip--find' : ''}`}
      style={style}
      role="status"
      aria-label={`Your standing: rank ${rank}, ${valueLabel} ${String(value)}`}
    >
      <div className="rank-page__bar-stat">
        <span className="rank-page__bar-label">Rank</span>
        <strong>#{rank}</strong>
      </div>
      <div className="rank-page__bar-stat">
        <span className="rank-page__bar-label">{valueLabel}</span>
        <strong>{value}</strong>
      </div>
      {findMe && onFindMe ? (
        <div className="rank-page__bar-stat you-strip__find-stat">
          <button type="button" className="you-strip__find" onClick={onFindMe}>
            Find me
          </button>
        </div>
      ) : null}
      {gap ? <p className="rank-page__gap">{gap}</p> : null}
    </div>
  )
}
