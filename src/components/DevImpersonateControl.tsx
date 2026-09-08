import { useState } from 'react'
import { useImpersonation } from '../hooks/useImpersonation'
import {
  impersonateRecents,
  isDevImpersonateEnabled,
  startImpersonation,
  stopImpersonation,
} from '../lib/impersonate'
import { ApiError, PLAYER_NAME_MAX, normalizePlayerName } from '../lib/leaderboard'

type DevImpersonateControlProps = {
  variant?: 'menu' | 'drawer'
}

/** Local-only switch to act as another gamer tag without claiming it onto your account. */
export function DevImpersonateControl({ variant = 'menu' }: DevImpersonateControlProps) {
  const impersonation = useImpersonation()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recents = impersonateRecents()

  if (!isDevImpersonateEnabled()) return null

  const actAs = async (raw: string) => {
    const cleaned = normalizePlayerName(raw)
    if (!cleaned || busy) return
    setBusy(true)
    setError(null)
    try {
      await startImpersonation(cleaned)
      setDraft('')
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError(err instanceof Error ? err.message : 'Could not impersonate')
    } finally {
      setBusy(false)
    }
  }

  const rootClass =
    variant === 'drawer' ? 'dev-impersonate dev-impersonate--drawer' : 'dev-impersonate'

  return (
    <div className={rootClass} onClick={(e) => e.stopPropagation()}>
      <p className="dev-impersonate__label">Dev · act as</p>
      {impersonation ? (
        <p className="dev-impersonate__status">
          Acting as <strong>{impersonation.name}</strong>
          {impersonation.previousName ? ` · yours is ${impersonation.previousName}` : ''}
        </p>
      ) : (
        <p className="dev-impersonate__hint">Borrow a tag for testing. Does not rename yours.</p>
      )}
      <div className="dev-impersonate__row">
        <label className="dev-impersonate__field">
          <span className="visually-hidden">Gamer tag to act as</span>
          <input
            value={draft}
            maxLength={PLAYER_NAME_MAX}
            disabled={busy}
            placeholder="DOT"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setDraft(e.target.value.toUpperCase().slice(0, PLAYER_NAME_MAX))
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              void actAs(draft)
            }}
          />
        </label>
        <button
          type="button"
          className="dev-impersonate__btn"
          disabled={busy || !normalizePlayerName(draft)}
          onClick={() => void actAs(draft)}
        >
          {busy ? '…' : 'Go'}
        </button>
        {impersonation ? (
          <button
            type="button"
            className="dev-impersonate__btn dev-impersonate__btn--ghost"
            disabled={busy}
            onClick={() => {
              stopImpersonation()
              setError(null)
            }}
          >
            Stop
          </button>
        ) : null}
      </div>
      {recents.length > 0 ? (
        <div className="dev-impersonate__recents" aria-label="Recent tags">
          {recents.map((name) => {
            const active = impersonation?.name === name
            return (
              <button
                key={name}
                type="button"
                className={`dev-impersonate__chip${active ? ' dev-impersonate__chip--on' : ''}`}
                disabled={busy || active}
                onClick={() => void actAs(name)}
              >
                {name}
              </button>
            )
          })}
        </div>
      ) : null}
      {error ? <p className="dev-impersonate__error">{error}</p> : null}
    </div>
  )
}
