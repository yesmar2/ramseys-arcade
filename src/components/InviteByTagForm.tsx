import type { FormEvent } from 'react'
import { useState } from 'react'
import { sendInvite, type InviteKind } from '../lib/invites'
import { ApiError, normalizePlayerName, PLAYER_NAME_MAX } from '../lib/leaderboard'

type InviteByTagFormProps = {
  kind: InviteKind
  targetId: string
  disabled?: boolean
}

/** Host/owner control: send a directed invite to a gamer tag. */
export function InviteByTagForm({ kind, targetId, disabled }: InviteByTagFormProps) {
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || disabled) return
    const toName = normalizePlayerName(tag)
    if (!toName) {
      setError('Enter a gamer tag')
      return
    }
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await sendInvite({ kind, targetId, toName })
      setNote(`Invite sent to ${toName}`)
      setTag('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="invite-by-tag" onSubmit={(e) => void onSubmit(e)}>
      <label className="invite-by-tag__label">
        <span className="invite-by-tag__title">Invite by tag</span>
        <span className="invite-by-tag__hint">They’ll see it in the app and can accept.</span>
      </label>
      <div className="invite-by-tag__row">
        <input
          className="invite-by-tag__input"
          value={tag}
          maxLength={PLAYER_NAME_MAX}
          placeholder="GAMER TAG"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy || disabled}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
        />
        <button
          type="submit"
          className="event-list__create"
          disabled={busy || disabled || !tag.trim()}
        >
          {busy ? 'Sending…' : 'Invite'}
        </button>
      </div>
      {note ? <p className="tour-note tour-note--compact">{note}</p> : null}
      {error ? <p className="tour-note tour-note--error">{error}</p> : null}
    </form>
  )
}
