import { useEffect, useState, type FormEvent } from 'react'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { leaderboardHref, useHashRoute } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { ApiError, normalizePlayerName } from '../lib/leaderboard'
import {
  createGroup,
  deleteGroup,
  fetchGroupDetail,
  getGroupInvite,
  appendGroupQuery,
  groupHref,
  groupsIndexHref,
  joinGroup,
  kickGroupMember,
  leaveGroup,
  listMyGroups,
  rememberGroupInvite,
  renameGroup,
  rotateGroupInvite,
  setActiveGroup,
  storedActiveGroup,
  type GroupPublic,
} from '../lib/groups'

function inviteUrl(id: string, code: string) {
  return `${window.location.origin}${window.location.pathname}${groupHref(id, code)}`
}

export function GroupsPage() {
  const { account, loading: authLoading } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const [groups, setGroups] = useState<GroupPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listMyGroups()
      .then((list) => {
        if (!cancelled) setGroups(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [account?.id, playerName])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !account) return
    setBusy(true)
    setError(null)
    try {
      const group = await createGroup(name)
      if (group.inviteCode) rememberGroupInvite(group.id, group.inviteCode)
      setActiveGroup(group.id)
      window.location.hash = groupHref(group.id, group.inviteCode ?? undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group')
      setBusy(false)
    }
  }

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <header className="lb-page__header lb-page__header--compact">
        <div className="lb-page__heading-row">
          <span className="lb-page__heading-slot" aria-hidden="true" />
          <h1 className="lb-page__title">Groups</h1>
          <span className="lb-page__heading-slot" aria-hidden="true" />
        </div>
        <p className="tour-note tour-note--compact">
          Compare the same weekly, monthly, and all-time boards with a family roster.
        </p>
      </header>

      {loading ? (
        <p className="lb-empty">Loading…</p>
      ) : (
        <>
          {groups.length === 0 ? (
            <p className="lb-empty">You are not in any groups yet.</p>
          ) : (
            <ul className="group-list">
              {groups.map((group) => (
                <li key={group.id} className="group-card">
                  <a className="group-card__link" href={groupHref(group.id)}>
                    <span className="group-card__name">{group.name}</span>
                    <span className="group-card__meta">
                      {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
                      {group.isOwner ? ' · Owner' : ''}
                    </span>
                  </a>
                  <button
                    type="button"
                    className="game-lobby__board-link"
                    onClick={() => {
                      setActiveGroup(group.id)
                      window.location.hash = appendGroupQuery(leaderboardHref())
                    }}
                  >
                    View boards
                  </button>
                </li>
              ))}
            </ul>
          )}

          {authLoading && !account ? (
            <p className="lb-empty">Loading…</p>
          ) : !account ? (
            <div className="event-create-gate">
              <p className="tour-note">Sign in to create a group and send an invite link.</p>
            </div>
          ) : (
            <form className="event-create group-create" onSubmit={(e) => void onCreate(e)}>
              <section className="event-create__card">
                <h2 className="event-create__section-title">Create group</h2>
                <p className="event-create__hint">
                  Up to 5 groups per account, 20 members each. You can copy an invite after you
                  create it.
                </p>
                <label className="event-create__field">
                  <span className="event-create__label">Name</span>
                  <input
                    className="event-create__input"
                    value={name}
                    maxLength={32}
                    placeholder="Bland Family"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                {error ? <p className="event-create__error">{error}</p> : null}
                <button
                  type="submit"
                  className="lb-play event-create__submit"
                  disabled={busy || name.trim().length < 2}
                >
                  {busy ? 'Creating…' : 'Create group'}
                </button>
              </section>
            </form>
          )}
        </>
      )}
    </PageShell>
  )
}

export function GroupDetailPage({ id, invite }: { id: string; invite?: string }) {
  const route = useHashRoute()
  const { account } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const [group, setGroup] = useState<GroupPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsInvite, setNeedsInvite] = useState(false)
  const [inviteDraft, setInviteDraft] = useState(invite ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')

  const storedInvite = invite ?? getGroupInvite(id) ?? undefined

  const load = async (inviteCode?: string) => {
    const data = await fetchGroupDetail(id, inviteCode ?? storedInvite)
    setGroup(data)
    setRenameDraft(data.name)
    setNeedsInvite(false)
    setError(null)
    if (data.inviteCode) rememberGroupInvite(id, data.inviteCode)
  }

  useEffect(() => {
    if (route.name !== 'group' || route.id !== id) return
    if (invite) rememberGroupInvite(id, invite)
    let cancelled = false
    setLoading(true)
    setError(null)
    setNeedsInvite(false)
    void load(invite ?? storedInvite)
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'INVITE_REQUIRED') {
          setNeedsInvite(true)
          setError(null)
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, invite, route, playerName, account?.id])

  const onJoin = async (code = storedInvite ?? inviteDraft) => {
    if (busy) return
    const inviteCode = code.trim().toUpperCase()
    if (!inviteCode) {
      setNote('Enter the invite code from your host.')
      return
    }
    if (!playerName) {
      setNote('Set your gamer tag in the header first.')
      return
    }
    setBusy(true)
    setNote(null)
    try {
      rememberGroupInvite(id, inviteCode)
      const next = await joinGroup(id, inviteCode)
      setGroup(next)
      setNeedsInvite(false)
      setActiveGroup(next.id)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not join')
    } finally {
      setBusy(false)
    }
  }

  const submitInvite = async () => {
    const code = inviteDraft.trim().toUpperCase()
    if (!code) return
    rememberGroupInvite(id, code)
    setBusy(true)
    setNote(null)
    try {
      await load(code)
      window.history.replaceState(null, '', groupHref(id, code))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVITE_REQUIRED') {
        setNote('That invite code is not valid.')
      } else {
        setNote(err instanceof Error ? err.message : 'Could not open group')
      }
    } finally {
      setBusy(false)
    }
  }

  const copyInvite = async () => {
    const code = group?.inviteCode
    if (!code) return
    try {
      await navigator.clipboard.writeText(inviteUrl(id, code))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const onLeave = async () => {
    if (busy || !window.confirm('Leave this group?')) return
    setBusy(true)
    try {
      await leaveGroup(id)
      if (storedActiveGroup() === id) setActiveGroup(null)
      window.location.hash = groupsIndexHref()
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not leave')
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (busy || !window.confirm('Delete this group for everyone?')) return
    setBusy(true)
    try {
      await deleteGroup(id)
      if (storedActiveGroup() === id) setActiveGroup(null)
      window.location.hash = groupsIndexHref()
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not delete')
      setBusy(false)
    }
  }

  const onRename = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !group) return
    setBusy(true)
    setNote(null)
    try {
      const next = await renameGroup(id, renameDraft)
      setGroup(next)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not rename')
    } finally {
      setBusy(false)
    }
  }

  const onRotate = async () => {
    if (busy || !window.confirm('Old invite links will stop working. Rotate anyway?')) return
    setBusy(true)
    try {
      const next = await rotateGroupInvite(id)
      setGroup(next)
      if (next.inviteCode) rememberGroupInvite(id, next.inviteCode)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not rotate invite')
    } finally {
      setBusy(false)
    }
  }

  const onKick = async (name: string) => {
    if (busy || !window.confirm(`Remove ${name} from the group?`)) return
    setBusy(true)
    try {
      const next = await kickGroupMember(id, name)
      setGroup(next)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not remove member')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      {loading ? (
        <p className="lb-empty">Loading…</p>
      ) : needsInvite ? (
        <>
          <header className="lb-page__header lb-page__header--compact lb-game-board__head">
            <div className="lb-page__heading-row">
              <PageBackLink href={groupsIndexHref()} label="Back to Groups" />
              <h1 className="lb-page__title">Private group</h1>
              <span className="lb-page__heading-slot" aria-hidden="true" />
            </div>
          </header>
          <div className="event-invite-gate">
            <p className="event-invite-gate__lead">
              This group is invite-only. Enter the code from your host to join.
            </p>
            <label className="event-create__field">
              <span className="event-create__label">Invite code</span>
              <input
                className="event-create__input"
                value={inviteDraft}
                maxLength={16}
                placeholder="ABCD1234"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setInviteDraft(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void submitInvite()
                  }
                }}
              />
            </label>
            {note ? <p className="event-create__error">{note}</p> : null}
            <button
              type="button"
              className="lb-play event-create__submit"
              disabled={busy || !inviteDraft.trim()}
              onClick={() => void submitInvite()}
            >
              {busy ? 'Checking…' : 'Open group'}
            </button>
          </div>
        </>
      ) : error || !group ? (
        <>
          <header className="lb-page__header lb-page__header--compact lb-game-board__head">
            <div className="lb-page__heading-row">
              <PageBackLink href={groupsIndexHref()} label="Back to Groups" />
              <h1 className="lb-page__title">Group</h1>
              <span className="lb-page__heading-slot" aria-hidden="true" />
            </div>
          </header>
          <p className="lb-empty">{error ?? 'Group not found'}</p>
        </>
      ) : (
        <>
          <header className="lb-page__header lb-page__header--compact lb-game-board__head">
            <div className="lb-page__heading-row">
              <PageBackLink href={groupsIndexHref()} label="Back to Groups" />
              <h1 className="lb-page__title">{group.name}</h1>
              <div className="lb-game-board__trailing">
                <button
                  type="button"
                  className="game-lobby__board-link"
                  onClick={() => {
                    setActiveGroup(group.id)
                    window.location.hash = appendGroupQuery(leaderboardHref())
                  }}
                >
                  View boards
                </button>
                {group.isOwner && group.inviteCode ? (
                  <button
                    type="button"
                    className="game-lobby__board-link"
                    onClick={() => void copyInvite()}
                  >
                    {copied ? 'Copied!' : 'Copy invite'}
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          {!group.isMember ? (
            <div className="event-detail__join">
              {playerName ? (
                <button
                  type="button"
                  className="lb-play game-lobby__play game-lobby__play--wide event-detail__join-btn"
                  disabled={busy || !(storedInvite || inviteDraft)}
                  onClick={() => void onJoin()}
                >
                  {busy ? 'Joining…' : `Join as ${playerName}`}
                </button>
              ) : (
                <p className="tour-note tour-note--compact">
                  Set your gamer tag in the header first.
                </p>
              )}
            </div>
          ) : null}

          {group.isOwner ? (
            <form className="event-create group-manage" onSubmit={(e) => void onRename(e)}>
              <section className="event-create__card">
                <h2 className="event-create__section-title">Manage</h2>
                <label className="event-create__field">
                  <span className="event-create__label">Name</span>
                  <input
                    className="event-create__input"
                    value={renameDraft}
                    maxLength={32}
                    onChange={(e) => setRenameDraft(e.target.value)}
                  />
                </label>
                <div className="group-manage__actions">
                  <button
                    type="submit"
                    className="game-lobby__board-link"
                    disabled={busy || renameDraft.trim().length < 2}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="game-lobby__board-link"
                    disabled={busy}
                    onClick={() => void onRotate()}
                  >
                    New invite code
                  </button>
                  <button
                    type="button"
                    className="game-lobby__board-link"
                    disabled={busy}
                    onClick={() => void onDelete()}
                  >
                    Delete group
                  </button>
                </div>
              </section>
            </form>
          ) : group.isMember ? (
            <div className="group-manage__actions">
              <button
                type="button"
                className="game-lobby__board-link"
                disabled={busy}
                onClick={() => void onLeave()}
              >
                Leave group
              </button>
            </div>
          ) : null}

          {note ? <p className="tour-note tour-note--error">{note}</p> : null}

          <section aria-label="Roster">
            <h2 className="event-detail__section-title">
              Roster · {group.memberCount}/20
            </h2>
            {group.members.length === 0 ? (
              <p className="lb-empty">No members yet. Join to add your tag.</p>
            ) : (
              <ul className="group-roster">
                {group.members.map((member) => {
                  const you = playerName && member.name === playerName
                  return (
                    <li key={member.name} className="group-roster__row">
                      <PlayerAvatar name={member.name} avatarId={member.avatarId} size="sm" />
                      <span className="group-roster__name">
                        {member.name}
                        {you ? ' · You' : ''}
                      </span>
                      {group.isOwner && !you ? (
                        <button
                          type="button"
                          className="game-lobby__board-link"
                          disabled={busy}
                          onClick={() => void onKick(member.name)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </PageShell>
  )
}
