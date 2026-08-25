import { useEffect, useState } from 'react'
import { useIsAdmin } from '../lib/admin'

type AdminWaveSkipProps = {
  wave: number
  onSkipNext: () => void
  onJump: (wave: number) => void
}

/** Pause-menu tools to jump waves while testing later rounds. */
export function AdminWaveSkip({ wave, onSkipNext, onJump }: AdminWaveSkipProps) {
  const admin = useIsAdmin()
  const [draft, setDraft] = useState(String(Math.max(1, wave + 1)))

  useEffect(() => {
    setDraft(String(Math.max(1, wave + 1)))
  }, [wave])

  if (!admin) return null

  const parsed = Math.floor(Number(draft))
  const canJump = Number.isFinite(parsed) && parsed >= 1

  return (
    <div className="admin-wave-skip">
      <p className="admin-wave-skip__label">Admin · wave {wave}</p>
      <div className="admin-wave-skip__row">
        <button
          type="button"
          className="admin-wave-skip__btn"
          onClick={onSkipNext}
        >
          Next wave
        </button>
        <label className="admin-wave-skip__jump">
          <span className="visually-hidden">Jump to wave</span>
          <input
            type="number"
            min={1}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !canJump) return
              e.preventDefault()
              onJump(parsed)
            }}
          />
          <button
            type="button"
            className="admin-wave-skip__btn"
            disabled={!canJump}
            onClick={() => {
              if (canJump) onJump(parsed)
            }}
          >
            Go
          </button>
        </label>
      </div>
    </div>
  )
}
