type PauseButtonProps = {
  paused: boolean
  onToggle: () => void
}

export function PauseButton({ paused, onToggle }: PauseButtonProps) {
  return (
    <button
      type="button"
      className="game-pause-btn"
      aria-label={paused ? 'Resume' : 'Pause'}
      aria-pressed={paused}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {paused ? (
        <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 6.5v11L18 12 8 6.5z" fill="currentColor" />
        </svg>
      ) : (
        <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="7" y="6" width="3.2" height="12" rx="0.8" fill="currentColor" />
          <rect x="13.8" y="6" width="3.2" height="12" rx="0.8" fill="currentColor" />
        </svg>
      )}
    </button>
  )
}

type PauseOverlayProps = {
  paused: boolean
  onResume: () => void
}

export function PauseOverlay({ paused, onResume }: PauseOverlayProps) {
  if (!paused) return null
  return (
    <div
      className="game-pause-overlay"
      role="dialog"
      aria-label="Paused"
      onPointerDown={(e) => {
        e.stopPropagation()
        onResume()
      }}
    >
      <div className="game-pause-card">
        <h2>Paused</h2>
        <p>Tap to resume</p>
      </div>
    </div>
  )
}
