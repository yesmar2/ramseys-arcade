import { useEffect, useRef, useState } from 'react'
import { usePlayerName } from '../hooks/usePlayerName'
import { ApiError, rememberPlayerName } from '../lib/leaderboard'

type PlayerBadgeProps = {
  /** Compact chip for tight headers / game overlays */
  compact?: boolean
}

export function PlayerBadge({ compact = false }: PlayerBadgeProps) {
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

  return (
    <div className="player-badge-wrap" ref={rootRef}>
      {name ? (
        <button
          type="button"
          className={`player-badge${compact ? ' player-badge--compact' : ''}`}
          onClick={startEdit}
          aria-expanded={editing}
          aria-haspopup="dialog"
          title="Change player name"
        >
          <strong className="player-badge__name">{name}</strong>
        </button>
      ) : (
        <button
          type="button"
          className={`player-badge player-badge--empty${compact ? ' player-badge--compact' : ''}`}
          onClick={startEdit}
          aria-expanded={editing}
          aria-haspopup="dialog"
        >
          Set player name
        </button>
      )}

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
