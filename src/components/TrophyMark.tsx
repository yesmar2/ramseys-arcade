export type TrophyMarkProps = {
  count: number
  podium?: number
  size?: 'sm' | 'md'
  className?: string
}

export function TrophyMark({
  count,
  podium = 0,
  size = 'md',
  className = '',
}: TrophyMarkProps) {
  if (count <= 0) return null

  const label =
    podium > 0
      ? `${count} trophy${count === 1 ? '' : 'ies'} · ${podium} podium`
      : `${count} trophy${count === 1 ? '' : 'ies'}`

  return (
    <span
      className={`trophy-mark trophy-mark--${size}${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 16 18" width={size === 'sm' ? 12 : 14} height={size === 'sm' ? 14 : 16} aria-hidden="true">
        <path
          className="trophy-mark__cup"
          d="M3.5 1.5h9v4.5c0 2.4-1.6 4.5-4 5.2-2.4-.7-4-2.8-4-5.2V1.5Z"
        />
        <path className="trophy-mark__handle" d="M3.5 2.8H2.2a1.4 1.4 0 0 0 0 2.8H3.5" />
        <path className="trophy-mark__handle" d="M12.5 2.8h1.3a1.4 1.4 0 0 1 0 2.8h-1.3" />
        <path className="trophy-mark__stem" d="M7 11.2h2v2.2H6.4l-.5 2.3h4.1l-.5-2.3H7z" />
      </svg>
      <span className="trophy-mark__count">{count}</span>
    </span>
  )
}
