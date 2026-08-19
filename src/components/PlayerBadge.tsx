import { useEffect, useRef, useState } from 'react'
import { usePlayerName } from '../hooks/usePlayerName'
import { ApiError, rememberPlayerName } from '../lib/leaderboard'

type PlayerBadgeProps = {
  /** Compact chip for tight headers / game overlays */
  compact?: boolean
  /** Round icon button instead of the name chip */
  icon?: boolean
}

export function PlayerBadge({ compact = false, icon = false }: PlayerBadgeProps) {
  const name = usePlayerName()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setDraft(name || '')
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    const cleaned = draft.trim().slice(0, 12).toUpperCase()
    if (!cleaned || busy) return
    setBusy(true)
    setError(null)
    try {
      await rememberPlayerName(cleaned)
      setEditing(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
        setError('That name is taken')
      } else {
        setError(err instanceof Error ? err.message : 'Could not save name')
      }
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    if (busy) return
    setEditing(false)
    setError(null)
  }

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()

    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) cancel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [editing, busy])

  const triggerClass = icon
    ? `player-badge player-badge--icon${name ? ' player-badge--named' : ''}`
    : `player-badge${compact ? ' player-badge--compact' : ''}${name ? '' : ' player-badge--empty'}`
  const triggerLabel = name ? `Player ${name}` : 'Set player name'

  return (
    <div className="player-badge-wrap" ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        onClick={startEdit}
        aria-expanded={editing}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        title={triggerLabel}
      >
        {icon ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle
              cx="12"
              cy="8.2"
              r="3.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M6.2 18.6c.7-3.2 3-4.8 5.8-4.8s5.1 1.6 5.8 4.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : name ? (
          <strong className="player-badge__name">{name}</strong>
        ) : (
          'Set player name'
        )}
      </button>

      {editing && (
        <div className="player-badge__panel" role="dialog" aria-label="Change player name">
          <p className="player-badge__panel-title">Player name</p>
          <label className="player-badge__field">
            <span className="player-badge__label">Name</span>
            <input
              ref={inputRef}
              className="player-badge__input"
              value={draft}
              maxLength={12}
              disabled={busy}
              onChange={(e) => {
                setDraft(e.target.value.toUpperCase())
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void save()
                }
              }}
            />
          </label>
          {error && <p className="player-badge__error">{error}</p>}
          <div className="player-badge__panel-actions">
            <button type="button" className="player-badge__btn" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="player-badge__btn player-badge__btn--ghost"
              disabled={busy}
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
