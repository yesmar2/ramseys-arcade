type MedalKind = 'gold' | 'silver' | 'bronze'

const LABELS: Record<MedalKind, string> = {
  gold: '1st',
  silver: '2nd',
  bronze: '3rd',
}

export function medalKind(rank: number): MedalKind | null {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return null
}

/** Compact podium medal — replaces row tinting for top 3. */
export function PodiumMedal({ kind }: { kind: MedalKind }) {
  return (
    <span
      className={`lb-medal lb-medal--${kind}`}
      title={LABELS[kind]}
      aria-hidden="true"
    >
      <svg viewBox="0 0 20 24" width="16" height="19" focusable="false">
        <path
          className="lb-medal__ribbon lb-medal__ribbon--left"
          d="M6.2 0.5 10 7.2 2.8 7.2Z"
        />
        <path
          className="lb-medal__ribbon lb-medal__ribbon--right"
          d="M13.8 0.5 17.2 7.2 10 7.2Z"
        />
        <circle className="lb-medal__disk" cx="10" cy="14.2" r="7.2" />
        <circle className="lb-medal__ring" cx="10" cy="14.2" r="5.35" />
        <text className="lb-medal__num" x="10" y="15.1" textAnchor="middle">
          {kind === 'gold' ? '1' : kind === 'silver' ? '2' : '3'}
        </text>
      </svg>
    </span>
  )
}
