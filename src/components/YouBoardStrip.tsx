import type { CSSProperties, ReactNode } from 'react'

type YouBoardStripProps = {
  rank: number
  value: ReactNode
  valueLabel?: string
  gap: string | null
  accent?: string
  sticky?: boolean
}

export function YouBoardStrip({
  rank,
  value,
  valueLabel = 'Score',
  gap,
  accent,
  sticky = true,
}: YouBoardStripProps) {
  const style = accent
    ? ({ '--lb-you-accent': accent } as CSSProperties)
    : undefined

  return (
    <section
      className={`lb-scorecard lb-scorecard--two${sticky ? '' : ' lb-scorecard--static'}`}
      style={style}
      aria-label={`Your standing: rank ${rank}, ${valueLabel} ${String(value)}`}
    >
      <div className="lb-stat">
        <span className="lb-stat__label">Rank</span>
        <strong>#{rank}</strong>
      </div>
      <div className="lb-stat">
        <span className="lb-stat__label">{valueLabel}</span>
        <strong>{value}</strong>
      </div>
      {gap ? <p className="lb-scorecard__gap">{gap}</p> : null}
    </section>
  )
}
