import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { BoardEmpty, BoardSkeleton } from '../components/BoardChrome'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { leaderboardHref, useHashRoute } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { ApiError, normalizePlayerName } from '../lib/leaderboard'
import {
  appendGroupQuery,
  createGroup,
  deleteGroup,
  fetchGroupDetail,
  getGroupInvite,
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
  useActiveGroup,
  type GroupMember,
  type GroupPublic,
} from '../lib/groups'

const GROUP_ACCENTS = ['#2eb8a0', '#e85d4c', '#5b7cfa', '#e2a12b', '#9b6bff'] as const

function groupAccent(id: string) {
  let n = 0
  for (const ch of id) n = (n + ch.charCodeAt(0)) % GROUP_ACCENTS.length
  return GROUP_ACCENTS[n] ?? GROUP_ACCENTS[0]
}

function inviteUrl(id: string, code: string) {
  return `${window.location.origin}${window.location.pathname}${groupHref(id, code)}`
}

function memberLabel(count: number) {
  return `${count} member${count === 1 ? '' : 's'}`
}

function openBoards(id: string) {
  setActiveGroup(id)
  window.location.hash = appendGroupQuery(leaderboardHref())
}

function GroupFaces({ members }: { members: GroupMember[] }) {
  const shown = members.slice(0, 4)
  const extra = members.length - shown.length
  return (
    <div className="group-faces" aria-hidden="true">
      {shown.map((member, index) => (
        <span
          key={member.name}
          className="group-faces__item"
          style={{ zIndex: shown.length - index }}
        >
          {member.name.slice(0, 1)}
        </span>
      ))}
      {shown.length === 0 ? <span className="group-faces__empty">+</span> : null}
      {extra > 0 ? <span className="group-faces__more">+{extra}</span> : null}
    </div>
  )
}

function CreateGroupForm({
  name,
  setName,
  busy,
  error,
  onCreate,
  onCancel,
}: {
  name: string
  setName: (value: string) => void
  busy: boolean
  error: string | null
  onCreate: (e: FormEvent) => void
  onCancel?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <form className="group-create" onSubmit={onCreate}>
      <div className="group-create__head">
        <h2 className="event-detail__section-title">Create group</h2>
        {onCancel ? (
          <button type="button" className="group-text-btn" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      <p className="event-create__hint">
        Invite family or friends to the same weekly, monthly, and all-time boards. 5 groups per
        account, 20 people each.
      </p>
      <label className="event-create__field">
        <span className="event-create__label">Group name</span>
        <input
          ref={inputRef}
          className="event-create__input"
          value={name}
          maxLength={32}
          placeholder="Bland Family"
          autoComplete="off"
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
    </form>
  )
}

export function GroupsPage() {
  const { account, loading: authLoading } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const activeId = useActiveGroup()
  const [groups, setGroups] = useState<GroupPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listMyGroups()
      .then((list) => {
        if (!cancelled) {
          setGroups(list)
          if (list.length === 0 && account) setCreating(true)
        }
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
          <div className="lb-game-board__trailing">
            {account ? (
              <button
                type="button"
                className="event-list__create"
                onClick={() => setCreating((open) => !open)}
              >
                {creating ? 'Close' : 'Create group'}
              </button>
            ) : null}
          </div>
        </div>
        <p className="event-detail__blurb">
          Filter the boards to a roster — same scores, just your people.
        </p>
      </header>

      {loading || (authLoading && !account && groups.length === 0) ? (
        <BoardSkeleton rows={3} />
      ) : (
        <>
          {creating && account ? (
            <CreateGroupForm
              name={name}
              setName={setName}
              busy={busy}
              error={error}
              onCreate={(e) => void onCreate(e)}
              onCancel={groups.length > 0 ? () => setCreating(false) : undefined}
            />
          ) : null}

          {groups.length === 0 ? (
            <BoardEmpty
              title="No groups yet"
              detail={
                account
                  ? 'Name a group and send the invite link. Everyone keeps playing on the same boards.'
                  : 'Sign in from the header to create a group and send an invite link.'
              }
            />
          ) : (
            <ul className="group-list">
              {groups.map((group) => {
                const accent = groupAccent(group.id)
                const watching = group.id === activeId
                return (
                  <li key={group.id}>
                    <article
                      className={`group-card${watching ? ' group-card--active' : ''}`}
                      style={{ '--event-accent': accent } as CSSProperties}
                    >
                      <a className="group-card__main" href={groupHref(group.id)}>
                        <GroupFaces members={group.members} />
                        <div className="group-card__body">
                          <div className="group-card__top">
                            <h2 className="group-card__name">{group.name}</h2>
                            <div className="event-chips">
                              {watching ? (
                                <span className="tour-pill tour-pill--cadence">Watching</span>
                              ) : null}
                              <span
                                className={`tour-pill${group.isOwner ? ' tour-pill--official' : ' tour-pill--joined'}`}
                              >
                                {group.isOwner ? 'Owner' : 'Member'}
                              </span>
                            </div>
                          </div>
                          <p className="group-card__meta">{memberLabel(group.memberCount)}</p>
                        </div>
                      </a>
                      <button
                        type="button"
                        className="group-card__boards"
                        onClick={() => openBoards(group.id)}
                      >
                        View boards
                      </button>
                    </article>
                  </li>
                )
              })}
            </ul>
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
  const accent = groupAccent(id)

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
        <>
          <header className="lb-page__header lb-page__header--compact lb-game-board__head">
            <div className="lb-page__heading-row">
              <PageBackLink href={groupsIndexHref()} label="Back to Groups" />
              <h1 className="lb-page__title">Group</h1>
              <span className="lb-page__heading-slot" aria-hidden="true" />
            </div>
          </header>
          <BoardSkeleton rows={4} />
        </>
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
              This group is invite-only. Enter the code from your host to join the roster.
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
          <BoardEmpty title="Group not found" detail={error ?? 'That invite may have been rotated.'} />
        </>
      ) : (
        <div
          className="group-detail"
          style={{ '--event-accent': accent, '--board-accent': accent } as CSSProperties}
        >
          <header className="lb-page__header lb-page__header--compact lb-game-board__head">
            <div className="lb-page__heading-row">
              <PageBackLink href={groupsIndexHref()} label="Back to Groups" />
              <h1 className="lb-page__title">{group.name}</h1>
              <div className="lb-game-board__trailing">
                <button
                  type="button"
                  className="event-list__create"
                  onClick={() => openBoards(group.id)}
                >
                  View boards
                </button>
              </div>
            </div>
            <p className="group-detail__lede">
              {memberLabel(group.memberCount)}
              {group.isOwner ? ' · You’re the owner' : group.isMember ? ' · You’re in' : ''}
            </p>
          </header>

          {!group.isMember ? (
            <div className="group-join">
              {playerName ? (
                <button
                  type="button"
                  className="lb-play game-lobby__play game-lobby__play--wide event-detail__join-btn"
                  style={{ background: accent }}
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

          {note ? <p className="tour-note tour-note--error">{note}</p> : null}

          <div className="group-detail__grid">
            {group.isOwner && group.inviteCode ? (
              <section className="group-panel" aria-label="Invite">
                <h2 className="event-detail__section-title">Invite</h2>
                <p className="group-panel__hint">
                  Share this link. They join with their gamer tag and then show up on the boards.
                </p>
                <p className="group-invite-code">{group.inviteCode}</p>
                <div className="group-panel__actions">
                  <ShareBoardButton
                    label={`Join ${group.name} on ${APP_NAME} and compare scores with the family.`}
                    url={inviteUrl(id, group.inviteCode)}
                  />
                  <button
                    type="button"
                    className="event-list__create"
                    onClick={() => void copyInvite()}
                  >
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                  <button
                    type="button"
                    className="group-text-btn"
                    disabled={busy}
                    onClick={() => void onRotate()}
                  >
                    New code
                  </button>
                </div>
              </section>
            ) : null}

            <section className="group-panel" aria-label="Roster">
              <h2 className="event-detail__section-title">
                Roster · {group.memberCount}/20
              </h2>
              {group.members.length === 0 ? (
                <p className="tour-note tour-note--compact">
                  No tags yet. Join to add yours to the roster.
                </p>
              ) : (
                <ol className="group-roster">
                  {group.members.map((member, index) => {
                    const you = Boolean(playerName && member.name === playerName)
                    return (
                      <li
                        key={member.name}
                        className={`group-roster__row${you ? ' group-roster__row--you' : ''}`}
                      >
                        <span className="group-roster__rank">{index + 1}</span>
                        <PlayerAvatar name={member.name} avatarId={member.avatarId} size="sm" />
                        <span className="group-roster__name">
                          {member.name}
                          {you ? <span className="group-roster__you">You</span> : null}
                        </span>
                        {group.isOwner && !you ? (
                          <button
                            type="button"
                            className="group-text-btn"
                            disabled={busy}
                            onClick={() => void onKick(member.name)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>

          {group.isOwner ? (
            <details className="group-manage">
              <summary>Manage group</summary>
              <form className="group-manage__form" onSubmit={(e) => void onRename(e)}>
                <label className="event-create__field">
                  <span className="event-create__label">Name</span>
                  <input
                    className="event-create__input"
                    value={renameDraft}
                    maxLength={32}
                    onChange={(e) => setRenameDraft(e.target.value)}
                  />
                </label>
                <div className="group-panel__actions">
                  <button
                    type="submit"
                    className="event-list__create"
                    disabled={busy || renameDraft.trim().length < 2 || renameDraft.trim() === group.name}
                  >
                    Save name
                  </button>
                  <button
                    type="button"
                    className="group-text-btn group-text-btn--danger"
                    disabled={busy}
                    onClick={() => void onDelete()}
                  >
                    Delete group
                  </button>
                </div>
              </form>
            </details>
          ) : group.isMember ? (
            <div className="group-manage group-manage--member">
              <button
                type="button"
                className="group-text-btn group-text-btn--danger"
                disabled={busy}
                onClick={() => void onLeave()}
              >
                Leave group
              </button>
            </div>
          ) : null}
        </div>
      )}
    </PageShell>
  )
}
