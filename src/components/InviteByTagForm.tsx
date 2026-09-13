import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { sendInvite, type InviteKind } from '../lib/invites'
import { listFriends, type Friend } from '../lib/friends'
import { ApiError, normalizePlayerName, PLAYER_NAME_MAX } from '../lib/leaderboard'
import { useAuth } from '../hooks/useAuth'
import { PlayerAvatar } from './PlayerAvatar'

type InviteByTagFormProps = {
  kind: InviteKind
  targetId: string
  disabled?: boolean
}

/** Host/owner control: send a directed invite to a gamer tag. */
export function InviteByTagForm({ kind, targetId, disabled }: InviteByTagFormProps) {
  const { signedIn } = useAuth()
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [invitedNames, setInvitedNames] = useState<Set<string>>(new Set())
  const [friendBusy, setFriendBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!signedIn) return
    listFriends()
      .then((data) => setFriends(data.friends))
      .catch(() => {})
  }, [signedIn])

  const invite = async (toName: string) => {
    await sendInvite({ kind, targetId, toName })
  }

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
      await invite(toName)
      setNote(`Invite sent to ${toName}`)
      setInvitedNames((prev) => new Set(prev).add(toName))
      setTag('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send invite')
    } finally {
      setBusy(false)
    }
  }

  const inviteFriend = async (name: string) => {
    if (friendBusy) return
    setFriendBusy(name)
    setError(null)
    setNote(null)
    try {
      await invite(name)
      setNote(`Invite sent to ${name}`)
      setInvitedNames((prev) => new Set(prev).add(name))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send invite')
    } finally {
      setFriendBusy(null)
    }
  }

  return (
    <form className="invite-by-tag" onSubmit={(e) => void onSubmit(e)}>
      <label className="invite-by-tag__label">
        <span className="invite-by-tag__title">Invite by tag</span>
        <span className="invite-by-tag__hint">They’ll see it in the app and can accept.</span>
      </label>
      {friends.length > 0 ? (
        <ul className="invite-by-tag__friends" aria-label="Invite a friend">
          {friends.map((f) => {
            const invited = invitedNames.has(f.name)
            return (
              <li key={f.accountId}>
                <button
                  type="button"
                  className="invite-by-tag__friend"
                  disabled={disabled || Boolean(friendBusy) || invited}
                  onClick={() => void inviteFriend(f.name)}
                >
                  <PlayerAvatar avatarId={f.avatarId} name={f.name} size="sm" />
                  <span>{invited ? 'Invited' : friendBusy === f.name ? '…' : f.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
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
