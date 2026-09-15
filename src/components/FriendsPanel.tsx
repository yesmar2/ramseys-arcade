import { useState } from 'react'
import { useFriends } from '../hooks/useFriends'
import { rankHref } from '../hooks/useHashRoute'
import { AVATARS_ENABLED } from '../lib/avatars'
import { ApiError, normalizePlayerName, PLAYER_NAME_MAX } from '../lib/leaderboard'
import { PlayerAvatar } from './PlayerAvatar'

function sinceLabel(ts: number): string {
  try {
    return `Since ${new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  } catch {
    return ''
  }
}

/** An initial on a small tinted tile, the way the profile hero marks a player. */
function Mark({ name, avatarId }: { name: string; avatarId?: string }) {
  if (AVATARS_ENABLED) return <PlayerAvatar avatarId={avatarId} name={name} size="md" />
  return (
    <span className="pff__mark" aria-hidden="true">
      {name.charAt(0)}
    </span>
  )
}

/**
 * The friends card on your own profile: add by tag, answer requests, and
 * the list itself, each name opening that player's profile.
 */
export function FriendsCard() {
  const {
    signedIn,
    friends,
    incoming,
    outgoing,
    loaded,
    error,
    busyId,
    send,
    accept,
    decline,
    cancel,
    remove,
  } = useFriends()
  const [draft, setDraft] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addNote, setAddNote] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (!signedIn) return null

  const sendRequest = async () => {
    const name = normalizePlayerName(draft)
    if (!name || addBusy) return
    setAddBusy(true)
    setAddError(null)
    setAddNote(null)
    try {
      const result = await send(name)
      setDraft('')
      setAddNote(
        result.status === 'accepted'
          ? `You and ${name} are now friends.`
          : `Request sent to ${name}.`,
      )
    } catch (err) {
      if (
        (err instanceof ApiError && err.code === 'NOT_A_PLAYER') ||
        (err instanceof Error && /hasn't signed in yet/i.test(err.message))
      ) {
        setAddError(`Huh — ${name} doesn’t exist in this arcade`)
      } else {
        setAddError(err instanceof Error ? err.message : 'Could not send request')
      }
    } finally {
      setAddBusy(false)
    }
  }

  const count = friends.length

  return (
    <section className="ev-card pff" aria-label="Friends">
      <div className="ev-card__head">
        <h2 className="ev-card__title">
          Friends
          {count > 0 ? <span className="pft__count">{count}</span> : null}
        </h2>
        {incoming.length > 0 ? (
          <p className="ev-card__note pff__alert">
            {incoming.length} {incoming.length === 1 ? 'request' : 'requests'}
          </p>
        ) : null}
      </div>

      <form
        className="pff__add"
        onSubmit={(e) => {
          e.preventDefault()
          void sendRequest()
        }}
      >
        <label className="pff__field">
          <span className="visually-hidden">Gamer tag to add</span>
          <input
            className="pff__input"
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
          />
        </label>
        <button
          type="submit"
          className="pff__add-btn"
          disabled={addBusy || !normalizePlayerName(draft)}
        >
          {addBusy ? '…' : 'Add'}
        </button>
      </form>
      {addError ? <p className="pff__msg pff__msg--error">{addError}</p> : null}
      {addNote ? <p className="pff__msg">{addNote}</p> : null}
      {error ? <p className="pff__msg pff__msg--error">{error}</p> : null}

      {incoming.length > 0 ? (
        <ul className="pff__requests" aria-label="Friend requests">
          {incoming.map((r) => {
            const busy = busyId === r.id
            return (
              <li key={r.id} className="pff__request">
                <Mark name={r.name} />
                <span className="pff__text">
                  <a className="pff__name" href={rankHref(r.name)}>
                    {r.name}
                  </a>
                  <span className="pff__sub">wants to be friends</span>
                </span>
                <span className="pff__actions">
                  <button
                    type="button"
                    className="pff__btn pff__btn--primary"
                    disabled={busy}
                    onClick={() => void accept(r.id)}
                  >
                    {busy ? '…' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="pff__btn"
                    disabled={busy}
                    onClick={() => void decline(r.id)}
                  >
                    Decline
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      {!loaded ? (
        <p className="ev-empty">Loading…</p>
      ) : count === 0 && outgoing.length === 0 ? (
        <p className="ev-empty">No friends yet — add someone by their gamer tag.</p>
      ) : (
        <ul className="pff__list">
          {friends.map((f) => {
            const busy = busyId === f.accountId
            const confirming = confirmId === f.accountId
            return (
              <li key={f.accountId} className="pff__row">
                <a className="pff__who" href={rankHref(f.name)}>
                  <Mark name={f.name} avatarId={f.avatarId} />
                  <span className="pff__text">
                    <span className="pff__name">{f.name}</span>
                    <span className="pff__sub">{sinceLabel(f.since)}</span>
                  </span>
                </a>
                <span className="pff__actions">
                  {confirming ? (
                    <>
                      <button
                        type="button"
                        className="pff__btn pff__btn--danger"
                        disabled={busy}
                        onClick={() => {
                          setConfirmId(null)
                          void remove(f.accountId)
                        }}
                      >
                        {busy ? '…' : 'Remove'}
                      </button>
                      <button
                        type="button"
                        className="pff__btn"
                        disabled={busy}
                        onClick={() => setConfirmId(null)}
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="pff__btn pff__btn--quiet"
                      disabled={busy}
                      onClick={() => setConfirmId(f.accountId)}
                    >
                      Remove
                    </button>
                  )}
                </span>
              </li>
            )
          })}
          {outgoing.map((r) => {
            const busy = busyId === r.id
            return (
              <li key={r.id} className="pff__row pff__row--pending">
                <a className="pff__who" href={rankHref(r.name)}>
                  <Mark name={r.name} />
                  <span className="pff__text">
                    <span className="pff__name">{r.name}</span>
                    <span className="pff__sub">Request sent</span>
                  </span>
                </a>
                <span className="pff__actions">
                  <button
                    type="button"
                    className="pff__btn pff__btn--quiet"
                    disabled={busy}
                    onClick={() => void cancel(r.id)}
                  >
                    {busy ? '…' : 'Cancel'}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
