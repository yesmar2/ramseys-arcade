import '../styles/trophies.css'

export type TrophyMarkProps = {
  count: number
  podium?: number
  size?: 'sm' | 'md'
  className?: string
}

/** How many trophies a player has, beside their name: the trophies' own cup, small, and the count. */
export function TrophyMark({
  count,
  podium = 0,
  size = 'md',
  className = '',
}: TrophyMarkProps) {
  if (count <= 0) return null

  const label =
    podium > 0
      ? `${count} ${count === 1 ? 'trophy' : 'trophies'} · ${podium} podium`
      : `${count} ${count === 1 ? 'trophy' : 'trophies'}`
  const px = size === 'sm' ? 13 : 15

  return (
    <span
      className={`trophy-mark trophy-mark--${size}${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
    >
      <svg viewBox="4 4 40 40" width={px} height={px} aria-hidden="true">
        <path className="trophy-mark__fill" d="M15 8h18v9a9 9 0 0 1-18 0Z" />
        <path d="M15 11H9v3a6 6 0 0 0 6 6M33 11h6v3a6 6 0 0 1-6 6" />
        <path d="M24 26v7M17 40h14M19 40l1.5-7h7l1.5 7" />
      </svg>
      <span className="trophy-mark__count">{count}</span>
    </span>
  )
}
