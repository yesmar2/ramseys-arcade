import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { rankHref } from '../hooks/useHashRoute'
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  listFriends,
  removeFriend,
  sendFriendRequest,
  type Friend,
  type FriendRequest,
} from '../lib/friends'
import { normalizePlayerName, PLAYER_NAME_MAX, ApiError } from '../lib/leaderboard'
import { PlayerAvatar } from './PlayerAvatar'

export function FriendsPanel() {
  const { signedIn } = useAuth()
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addNote, setAddNote] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    listFriends()
      .then((data) => {
        setFriends(data.friends)
        setRequests(data.requests)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load friends'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!signedIn) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn])

  if (!signedIn) return null

  const incoming = requests.filter((r) => r.direction === 'incoming')
  const outgoing = requests.filter((r) => r.direction === 'outgoing')

  const sendRequest = async () => {
    const name = normalizePlayerName(draft)
    if (!name || addBusy) return
    setAddBusy(true)
    setAddError(null)
    setAddNote(null)
    try {
      const result = await sendFriendRequest(name)
      setDraft('')
      setAddNote(result.status === 'accepted' ? `You and ${name} are now friends.` : `Request sent to ${name}.`)
      load()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NOT_A_PLAYER') {
        setAddError(`Huh — ${name} doesn’t exist in this arcade`)
      } else if (err instanceof Error && /hasn't signed in yet/i.test(err.message)) {
        setAddError(`Huh — ${name} doesn’t exist in this arcade`)
      } else {
        setAddError(err instanceof Error ? err.message : 'Could not send request')
      }
    } finally {
      setAddBusy(false)
    }
  }

  const accept = async (id: string) => {
    setBusyId(id)
    try {
      await acceptFriendRequest(id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept request')
    } finally {
      setBusyId(null)
    }
  }

  const decline = async (id: string) => {
    setBusyId(id)
    try {
      await declineFriendRequest(id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline request')
    } finally {
      setBusyId(null)
    }
  }

  const cancel = async (id: string) => {
    setBusyId(id)
    try {
      await cancelFriendRequest(id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel request')
    } finally {
      setBusyId(null)
    }
  }

  const unfriend = async (accountId: string) => {
    setBusyId(accountId)
    try {
      await removeFriend(accountId)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove friend')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="friends-panel" aria-label="Friends">
      <h3 className="site-drawer__section-title">Friends</h3>

      <div className="friends-panel__add">
        <label className="friends-panel__add-field">
          <span className="visually-hidden">Gamer tag to add</span>
          <input
            value={draft}
            maxLength={PLAYER_NAME_MAX}
            placeholder="Add by gamer tag"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setDraft(e.target.value.toUpperCase().slice(0, PLAYER_NAME_MAX))
              setAddError(null)
              setAddNote(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void sendRequest()
              }
            }}
          />
        </label>
        <button
          type="button"
          className="friends-panel__add-btn"
          disabled={addBusy || !normalizePlayerName(draft)}
          onClick={() => void sendRequest()}
        >
          {addBusy ? '…' : 'Add'}
        </button>
      </div>
      {addError ? <p className="friends-panel__note friends-panel__note--error">{addError}</p> : null}
      {addNote ? <p className="friends-panel__note">{addNote}</p> : null}

      {loading ? (
        <p className="friends-panel__note">Loading…</p>
      ) : error ? (
        <p className="friends-panel__note friends-panel__note--error">{error}</p>
      ) : (
        <>
          {incoming.length > 0 ? (
            <ul className="pending-invites__list friends-panel__requests">
              {incoming.map((r) => (
                <li key={r.id} className="pending-invites__row">
                  <div className="pending-invites__copy">
                    <strong className="pending-invites__name">{r.name}</strong>
                    <span className="pending-invites__meta">wants to be friends</span>
                  </div>
                  <div className="pending-invites__actions">
                    <button
                      type="button"
                      className="event-list__create"
                      disabled={busyId === r.id}
                      onClick={() => void accept(r.id)}
                    >
                      {busyId === r.id ? '…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="group-text-btn"
                      disabled={busyId === r.id}
                      onClick={() => void decline(r.id)}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {outgoing.length > 0 ? (
            <ul className="pending-invites__list friends-panel__requests">
              {outgoing.map((r) => (
                <li key={r.id} className="pending-invites__row">
                  <div className="pending-invites__copy">
                    <strong className="pending-invites__name">{r.name}</strong>
                    <span className="pending-invites__meta">Request sent</span>
                  </div>
                  <div className="pending-invites__actions">
                    <button
                      type="button"
                      className="group-text-btn"
                      disabled={busyId === r.id}
                      onClick={() => void cancel(r.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {friends.length === 0 ? (
            <p className="friends-panel__note">No friends yet — add one by gamer tag.</p>
          ) : (
            <ul className="friends-panel__list">
              {friends.map((f) => (
                <li key={f.accountId} className="friends-panel__row">
                  <a className="friends-panel__who" href={rankHref(f.name)}>
                    <PlayerAvatar avatarId={f.avatarId} name={f.name} size="sm" />
                    <span className="friends-panel__name">{f.name}</span>
                  </a>
                  <button
                    type="button"
                    className="group-text-btn"
                    disabled={busyId === f.accountId}
                    onClick={() => void unfriend(f.accountId)}
                  >
                    {busyId === f.accountId ? '…' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
