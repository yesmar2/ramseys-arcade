import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { sendInvite, type InviteKind } from '../lib/invites'
import { listFriends, type Friend } from '../lib/friends'
import { ApiError, normalizePlayerName, PLAYER_NAME_MAX } from '../lib/leaderboard'
import { useAuth } from '../hooks/useAuth'

type InviteByTagFormProps = {
  kind: InviteKind
  targetId: string
  disabled?: boolean
}

/**
 * Host/owner control: send a directed invite to a gamer tag.
 *
 * Friends come first as one-tap chips, then a field for anyone else. Same
 * pill field and filled button as the profile's friends card.
 */
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
    <form className="inv" onSubmit={(e) => void onSubmit(e)}>
      {friends.length > 0 ? (
        <div className="inv__friends">
          <span className="inv__label">Friends</span>
          <ul className="inv__chips" aria-label="Invite a friend">
            {friends.map((f) => {
              const invited = invitedNames.has(f.name)
              return (
                <li key={f.accountId}>
                  <button
                    type="button"
                    className={`inv__chip${invited ? ' inv__chip--sent' : ''}`}
                    disabled={disabled || Boolean(friendBusy) || invited}
                    onClick={() => void inviteFriend(f.name)}
                  >
                    <span className="inv__chip-mark" aria-hidden="true">
                      {f.name.charAt(0)}
                    </span>
                    <span>{invited ? `${f.name} · sent` : friendBusy === f.name ? '…' : f.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      <div className="inv__row">
        <label className="inv__field">
          <span className="visually-hidden">Gamer tag to invite</span>
          <input
            className="inv__input"
            value={tag}
            maxLength={PLAYER_NAME_MAX}
            placeholder="Invite by gamer tag"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            disabled={busy || disabled}
            onChange={(e) => {
              setTag(e.target.value.toUpperCase())
              setError(null)
              setNote(null)
            }}
          />
        </label>
        <button type="submit" className="inv__btn" disabled={busy || disabled || !tag.trim()}>
          {busy ? 'Sending…' : 'Invite'}
        </button>
      </div>
      <p className={`inv__msg${error ? ' inv__msg--error' : ''}`}>
        {error ?? note ?? 'They’ll see it in the app and can accept.'}
      </p>
    </form>
  )
}
