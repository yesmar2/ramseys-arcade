import { useEffect, useState } from 'react'
import { useIsAdmin } from '../lib/admin'
import { markRunAssisted } from '../lib/runAchievements'

export type AdminStageUnit = 'wave' | 'level' | 'row' | 'height' | 'length'

type AdminStageBase = {
  onJump: (stage: number) => void
  /** Label noun — defaults to wave for Asteroids/Patriot. */
  unit?: AdminStageUnit
}

/**
 * `jump` moves a run that is already going, so it needs to know where it is.
 * `start` begins a fresh one at a chosen stage, so there is nothing to show.
 */
type AdminWaveSkipProps = AdminStageBase &
  (
    | {
        mode?: 'jump'
        /** Current stage shown in the pause menu (1-based for wave/level/height/length). */
        wave: number
        onSkipNext: () => void
      }
    | { mode: 'start'; wave?: never; onSkipNext?: never }
  )

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

/**
 * Tools to reach a later stage while testing (DEV / admin). On the pause menu
 * it moves the run you are in; on the start screen it opens a new one already
 * at the stage you asked for, which beats playing nine levels to see level ten.
 *
 * Either way the run is marked assisted, which stops its score reaching the
 * leaderboards or the record books — a skipped run did not earn it.
 */
export function AdminWaveSkip(props: AdminWaveSkipProps) {
  const { onJump, unit = 'wave' } = props
  const starting = props.mode === 'start'
  const wave = props.mode === 'start' ? 0 : props.wave
  const skipNext = props.mode === 'start' ? null : props.onSkipNext

  const admin = useIsAdmin()
  const noun = UNIT_LABEL[unit]
  const [draft, setDraft] = useState(starting ? '1' : String(Math.max(1, wave + 1)))

  useEffect(() => {
    if (starting) return
    setDraft(String(Math.max(1, wave + 1)))
  }, [wave, starting])

  if (!admin) return null

  const parsed = Math.floor(Number(draft))
  const canJump = Number.isFinite(parsed) && parsed >= 1

  const go = () => {
    if (!canJump) return
    if (starting) {
      // Starting a run clears the run's achievements, the assisted flag
      // included, so here the flag goes on after the jump rather than before.
      onJump(parsed)
      markRunAssisted()
      return
    }
    markRunAssisted()
    onJump(parsed)
  }

  return (
    <div
      className="admin-wave-skip"
      // On the start screen a tap anywhere starts the game. Reaching for these
      // controls is not that tap.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="admin-wave-skip__label">
        {starting ? `Admin · start at ${noun}` : `Admin · ${noun} ${wave}`}
      </p>
      <div className="admin-wave-skip__row">
        {skipNext ? (
          <button
            type="button"
            className="admin-wave-skip__btn"
            onClick={() => {
              markRunAssisted()
              skipNext()
            }}
          >
            {NEXT_LABEL[unit]}
          </button>
        ) : null}
        <label className="admin-wave-skip__jump">
          <span className="visually-hidden">
            {starting ? `Start at ${noun}` : `Jump to ${noun}`}
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Keep typing out of the game's own key handlers, which on the
              // start screen would read a keystroke as "begin".
              e.stopPropagation()
              if (e.key !== 'Enter' || !canJump) return
              e.preventDefault()
              go()
            }}
          />
          <button
            type="button"
            className="admin-wave-skip__btn"
            disabled={!canJump}
            onClick={go}
          >
            {starting ? 'Start' : 'Go'}
          </button>
        </label>
      </div>
    </div>
  )
}
