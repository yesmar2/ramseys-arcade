import { useEffect, useState } from 'react'
import { useIsAdmin } from '../lib/admin'

export type AdminStageUnit = 'wave' | 'level' | 'row' | 'height' | 'length'

type AdminWaveSkipProps = {
  /** Current stage shown in the pause menu (1-based for wave/level/height/length). */
  wave: number
  onSkipNext: () => void
  onJump: (wave: number) => void
  /** Label noun — defaults to wave for Asteroids/Patriot. */
  unit?: AdminStageUnit
}

const UNIT_LABEL: Record<AdminStageUnit, string> = {
  wave: 'wave',
  level: 'level',
  row: 'row',
  height: 'height',
  length: 'length',
}

const NEXT_LABEL: Record<AdminStageUnit, string> = {
  wave: 'Next wave',
  level: 'Next level',
  row: 'Skip +25',
  height: '+5 height',
  length: '+5 length',
}

/** Pause-menu tools to jump stages while testing later rounds (DEV / admin). */
export function AdminWaveSkip({
  wave,
  onSkipNext,
  onJump,
  unit = 'wave',
}: AdminWaveSkipProps) {
  const admin = useIsAdmin()
  const noun = UNIT_LABEL[unit]
  const [draft, setDraft] = useState(String(Math.max(1, wave + 1)))

  useEffect(() => {
    setDraft(String(Math.max(1, wave + 1)))
  }, [wave])

  if (!admin) return null

  const parsed = Math.floor(Number(draft))
  const canJump = Number.isFinite(parsed) && parsed >= 1

  return (
    <div className="admin-wave-skip">
      <p className="admin-wave-skip__label">
        Admin · {noun} {wave}
      </p>
      <div className="admin-wave-skip__row">
        <button type="button" className="admin-wave-skip__btn" onClick={onSkipNext}>
          {NEXT_LABEL[unit]}
        </button>
        <label className="admin-wave-skip__jump">
          <span className="visually-hidden">Jump to {noun}</span>
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
