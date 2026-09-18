import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { BoardEmpty, BoardSkeleton } from '../components/BoardChrome'
import { BackChevronIcon } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { PlayerMark } from '../components/PlayerMark'
import { InviteByTagForm } from '../components/InviteByTagForm'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { leaderboardHref, navigate, useRoute } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { ApiError, normalizePlayerName } from '../lib/leaderboard'
import { inkOn } from '../lib/color'
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
  transferGroup,
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
const GROUP_LIMIT = 5
const MEMBER_LIMIT = 20

function groupAccent(id: string) {
  let n = 0
  for (const ch of id) n = (n + ch.charCodeAt(0)) % GROUP_ACCENTS.length
  return GROUP_ACCENTS[n] ?? GROUP_ACCENTS[0]
}

function inviteUrl(id: string, code: string) {
  return `${window.location.origin}${groupHref(id, code)}`
}

function memberLabel(count: number) {
  return `${count} member${count === 1 ? '' : 's'}`
}

function openBoards(id: string) {
  setActiveGroup(id)
  navigate(appendGroupQuery(leaderboardHref()))
}

/** Two heads, for the groups index hero. */
function GroupsGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="44" height="44">
      <circle cx="9" cy="8.5" r="3.4" fill="currentColor" />
      <circle cx="16.5" cy="9.5" r="2.6" fill="currentColor" opacity="0.65" />
      <path
        d="M3.2 18.6c.5-3.3 3-5.1 5.8-5.1s5.3 1.8 5.8 5.1c.1.5-.3.9-.8.9H4c-.5 0-.9-.4-.8-.9Z"
        fill="currentColor"
      />
      <path
        d="M15.4 19.5c-.1-1.9-.8-3.5-1.9-4.7.9-.5 1.9-.8 3-.8 2.3 0 4.2 1.5 4.6 4.6.1.5-.3.9-.8.9h-4.9Z"
        fill="currentColor"
        opacity="0.65"
      />
    </svg>
  )
}

/** A stack of member marks, four deep, with the overflow as a count. */
function GroupFaces({ members }: { members: GroupMember[] }) {
  const shown = members.slice(0, 4)
  const extra = members.length - shown.length
  return (
    <span className="grp__faces" aria-hidden="true">
      {shown.map((member, index) => (
        <PlayerMark
          key={member.name}
          name={member.name}
          avatarId={member.avatarId}
          className="grp__face"
          style={{ zIndex: shown.length - index } as CSSProperties}
        />
      ))}
      {shown.length === 0 ? <span className="pmark pmark--empty grp__face" /> : null}
      {extra > 0 ? <span className="grp__face grp__face--more">+{extra}</span> : null}
    </span>
  )
}

/** The page opens the way every other page does; the body is whatever the state calls for. */
function GroupsHero({
  accent,
  back,
  tools,
  mark,
  kicker,
  title,
  sub,
  actions,
}: {
  accent?: string
  back?: boolean
  tools?: ReactNode
  mark: ReactNode
  kicker: ReactNode
  title: string
  sub: string
  actions?: ReactNode
}) {
  return (
    <section
      className="hero"
      aria-label={title}
      style={accent ? ({ '--hero-accent': accent, '--hero-ink': inkOn(accent) } as CSSProperties) : undefined}
    >
      {back || tools ? (
        <div className="hero__bar">
          {back ? (
            <a className="hero__back" href={groupsIndexHref()}>
              <BackChevronIcon size={18} />
              Groups
            </a>
          ) : (
            <span />
          )}
          {tools ? <div className="hero__tools">{tools}</div> : null}
        </div>
      ) : null}
      <div className="hero__main hero__main--bare">
        <span className="hero__mark grp__mark" aria-hidden="true">
          {mark}
        </span>
        <div className="hero__text">
          <p className="ev-kicker hero__kicker">{kicker}</p>
          <h1 className="hero__title">{title}</h1>
          <p className="hero__sub">{sub}</p>
          {actions ? <div className="hero__actions hero__actions--inline">{actions}</div> : null}
        </div>
      </div>
    </section>
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
  const canSubmit = name.trim().length >= 2

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <form className="ev-form ev-form--inline" onSubmit={onCreate}>
      <section className="ev-card">
        <div className="ev-card__head">
          <h2 className="ev-card__title">Create a group</h2>
          <p className="ev-card__note">{name.length}/32</p>
        </div>
        <div className="ev-card__body">
          <label className="ev-field">
            <span className="visually-hidden">Group name</span>
            <input
              ref={inputRef}
              className="ev-field__input"
              value={name}
              maxLength={32}
              placeholder="Bland Family"
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="ev-field__hint">
            Same boards, just your people. Share an invite link and filter weekly, monthly,
            and all-time scores down to the roster.
          </p>

          <ul className="ev-facts">
            <li>Filter any board to this roster</li>
            <li>Up to {MEMBER_LIMIT} people per group</li>
            <li>{GROUP_LIMIT} groups per account</li>
          </ul>

          {error ? <p className="ev-note ev-note--error">{error}</p> : null}

          <div className="ev-form__actions">
            <button type="submit" className="ev-join__btn" disabled={busy || !canSubmit}>
              {busy ? 'Creating…' : 'Create group'}
            </button>
            {onCancel ? (
              <button type="button" className="ev-form__cancel" onClick={onCancel}>
                Not now
              </button>
            ) : null}
          </div>
        </div>
      </section>
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
      navigate(groupHref(group.id, group.inviteCode ?? undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group')
      setBusy(false)
    }
  }

  const waiting = loading || (authLoading && !account && groups.length === 0)

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev grp">
        <GroupsHero
          mark={<GroupsGlyph />}
          kicker={
            <>
              <span className="ev-kicker__bit">Groups</span>
              {!waiting && groups.length > 0 ? (
                <span className="ev-kicker__bit">
                  {groups.length} of {GROUP_LIMIT}
                </span>
              ) : null}
            </>
          }
          title="Groups"
          sub="Filter the boards to a roster — same scores, just your people."
          actions={
            account ? (
              <button
                type="button"
                className={creating ? 'hero__ghost' : 'hero__cta'}
                onClick={() => setCreating((open) => !open)}
              >
                {creating ? 'Close' : 'Create group'}
              </button>
            ) : (
              <span className="hero__hint">Sign in from the header to create a group.</span>
            )
          }
        />

        {waiting ? (
          <BoardSkeleton rows={3} />
        ) : (
          <>
            <PendingInvitesStrip kind="group" />

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
              <section className="lst-block" aria-label="Your groups">
                <div className="lst-block__head">
                  <h2 className="lst-block__title">Your groups</h2>
                  <p className="lst-block__note">
                    {groups.length} of {GROUP_LIMIT}
                  </p>
                </div>
                <ol className="lst">
                  {groups.map((group) => {
                    const accent = groupAccent(group.id)
                    const watching = group.id === activeId
                    return (
                      <li
                        key={group.id}
                        className={`lst__row${watching ? ' lst__row--you' : ''}`}
                        style={{ '--event-accent': accent } as CSSProperties}
                      >
                        <div className="lst__main lst__main--norank">
                          <GroupFaces members={group.members} />
                          <span className="lst__text">
                            <a className="lst__name" href={groupHref(group.id)}>
                              <span className="lst__name-text">{group.name}</span>
                              {watching ? <span className="lst__you">Watching</span> : null}
                            </a>
                            <span className="lst__sub">
                              {memberLabel(group.memberCount)} · {group.isOwner ? 'Owner' : 'Member'}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="grp__boards"
                            onClick={() => openBoards(group.id)}
                          >
                            Boards
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}
          </>
        )}
      </div>
    </PageShell>
  )
}

export function GroupDetailPage({ id, invite }: { id: string; invite?: string }) {
  const route = useRoute()
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
  const [renameNote, setRenameNote] = useState<string | null>(null)

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
      navigate(groupsIndexHref())
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
      navigate(groupsIndexHref())
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not delete')
      setBusy(false)
    }
  }

  const onRename = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !group) return
    const nextName = renameDraft.trim()
    if (nextName.length < 2) {
      setRenameNote('Name must be at least 2 characters.')
      return
    }
    if (nextName === group.name) {
      setRenameNote('That’s already the name.')
      return
    }
    setBusy(true)
    setRenameNote(null)
    try {
      const next = await renameGroup(id, nextName)
      if (!next?.name) throw new Error('Could not rename')
      setGroup(next)
      setRenameDraft(next.name)
      setRenameNote('Name saved.')
    } catch (err) {
      setRenameNote(err instanceof Error ? err.message : 'Could not rename')
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

  /*
   * Handing over is one-way and takes the invite controls with it, so it
   * asks first and says exactly what it costs.
   */
  const onTransfer = async (name: string) => {
    if (busy) return
    const ok = window.confirm(
      `Make ${name} the host? They get the invite code and the roster controls, and you won’t be able to undo it yourself.`,
    )
    if (!ok) return
    setBusy(true)
    setNote(null)
    try {
      const next = await transferGroup(id, name)
      setGroup(next)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not hand the group over')
    } finally {
      setBusy(false)
    }
  }

  const style = {
    '--event-accent': accent,
    '--event-ink': inkOn(accent),
    '--board-accent': accent,
  } as CSSProperties

  if (loading) {
    return (
      <PageShell innerClassName="lb-page__inner lb-page__inner--events">
        <div className="ev grp" style={style}>
          <GroupsHero
            accent={accent}
            back
            mark={<span className="grp__mark-dots" />}
            kicker={<span className="ev-kicker__bit">Group</span>}
            title="Group"
            sub="Loading the roster…"
          />
          <BoardSkeleton rows={4} />
        </div>
      </PageShell>
    )
  }

  if (needsInvite) {
    return (
      <PageShell innerClassName="lb-page__inner lb-page__inner--events">
        <div className="ev grp" style={style}>
          <GroupsHero
            accent={accent}
            back
            mark={<span className="grp__mark-lock">?</span>}
            kicker={<span className="ev-kicker__bit">Private group</span>}
            title="Invite only"
            sub="Enter the code from your host to see the roster and join."
          />
          <section className="ev-card grp__gate" aria-label="Invite code">
            <div className="ev-card__head">
              <h2 className="ev-card__title">Invite code</h2>
            </div>
            <div className="ev-card__body">
              <label className="ev-field">
                <span className="visually-hidden">Invite code</span>
                <input
                  className="ev-field__input grp__code-input"
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
              {note ? <p className="ev-note ev-note--error">{note}</p> : null}
              <div className="ev-form__actions">
                <button
                  type="button"
                  className="ev-join__btn"
                  disabled={busy || !inviteDraft.trim()}
                  onClick={() => void submitInvite()}
                >
                  {busy ? 'Checking…' : 'Open group'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </PageShell>
    )
  }

  if (error || !group) {
    return (
      <PageShell innerClassName="lb-page__inner lb-page__inner--events">
        <div className="ev grp" style={style}>
          <GroupsHero
            accent={accent}
            back
            mark={<span className="grp__mark-lock">!</span>}
            kicker={<span className="ev-kicker__bit">Group</span>}
            title="Not found"
            sub={error ?? 'That invite may have been rotated.'}
          />
        </div>
      </PageShell>
    )
  }

  const canInvite = group.isOwner && Boolean(group.inviteCode)
  const roster = group.members
  const ownerTag = normalizePlayerName(group.ownerName ?? '')
  const isHost = (name: string) => {
    const tag = normalizePlayerName(name)
    // An older API sends no owner: better to label nobody than the wrong one.
    if (ownerTag) return tag === ownerTag
    return group.isOwner && Boolean(playerName) && tag === playerName
  }

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev grp" style={style}>
        <GroupsHero
          accent={accent}
          back
          tools={
            canInvite ? (
              <ShareBoardButton
                label={`Join ${group.name} on ${APP_NAME} and compare scores with the family.`}
                url={inviteUrl(id, group.inviteCode!)}
              />
            ) : null
          }
          mark={group.name.trim().charAt(0).toUpperCase() || '?'}
          kicker={
            <>
              <span className="ev-kicker__bit">Group</span>
              <span className="ev-kicker__bit">{memberLabel(group.memberCount)}</span>
              {group.isOwner ? (
                <span className="ev-kicker__bit">You host</span>
              ) : group.isMember ? (
                <span className="ev-kicker__bit">You’re in</span>
              ) : null}
            </>
          }
          title={group.name}
          sub="Same boards, filtered down to this roster."
          actions={
            <>
              {group.isMember ? (
                <button type="button" className="hero__cta" onClick={() => openBoards(group.id)}>
                  View boards
                </button>
              ) : playerName ? (
                <button
                  type="button"
                  className="hero__cta"
                  disabled={busy || !(storedInvite || inviteDraft)}
                  onClick={() => void onJoin()}
                >
                  {busy ? 'Joining…' : `Join as ${playerName}`}
                </button>
              ) : (
                <span className="hero__hint">Set your gamer tag in the header to join.</span>
              )}
              {!group.isMember ? (
                <button type="button" className="hero__ghost" onClick={() => openBoards(group.id)}>
                  Peek at the boards
                </button>
              ) : null}
            </>
          }
        />

        {note ? <p className="ev-note ev-note--error">{note}</p> : null}

        <div className={`grp__layout${canInvite ? ' grp__layout--two' : ''}`}>
          {canInvite ? (
            <section className="ev-card grp__invite" aria-label="Invite players">
              <div className="ev-card__head">
                <h2 className="ev-card__title">Invite players</h2>
                <p className="ev-card__note">
                  Code <span className="grp__code">{group.inviteCode}</span>
                </p>
              </div>
              <div className="ev-card__body">
                <div className="grp__invite-actions">
                  <button type="button" className="hero__ghost" onClick={() => void copyInvite()}>
                    {copied ? 'Copied!' : 'Copy invite link'}
                  </button>
                  <button
                    type="button"
                    className="ev-form__cancel"
                    disabled={busy}
                    onClick={() => void onRotate()}
                  >
                    New code
                  </button>
                </div>
                <p className="ev-field__hint">
                  Anyone with the link can join. Or invite a gamer tag — they’ll get a header
                  badge and can accept from Home or Events.
                </p>
                <InviteByTagForm
                  kind="group"
                  targetId={id}
                  disabled={busy}
                  excludeNames={roster.map((m) => m.name)}
                />
              </div>
            </section>
          ) : null}

          <section className="lst-block grp__roster" aria-label="Roster">
            <div className="lst-block__head">
              <h2 className="lst-block__title">Roster</h2>
              <p className="lst-block__note">
                {group.memberCount} of {MEMBER_LIMIT}
              </p>
            </div>
            {roster.length === 0 ? (
              <p className="ev-empty">No tags yet. Join to add yours to the roster.</p>
            ) : (
              <ol className="lst">
                {roster.map((member, index) => {
                  const you = Boolean(playerName && member.name === playerName)
                  return (
                    <li
                      key={member.name}
                      className={`lst__row${you ? ' lst__row--you' : ''}`}
                      aria-current={you ? 'true' : undefined}
                    >
                      <div className="lst__main">
                        <span className="lst__rank">{index + 1}</span>
                        <PlayerMark
                          name={member.name}
                          avatarId={member.avatarId}
                          className="lst__mark"
                        />
                        <span className="lst__text">
                          <span className="lst__name">
                            <span className="lst__name-text">{member.name}</span>
                            {you ? <span className="lst__you">You</span> : null}
                          </span>
                          {/*
                            * Who holds the group, not who turned up first.
                            * These had been the same guess, which labelled
                            * the earliest member Host while the invite
                            * controls — correctly — stayed with the owner.
                            */}
                          <span className="lst__sub">{isHost(member.name) ? 'Host' : 'Member'}</span>
                        </span>
                        {group.isOwner && !you ? (
                          <div className="grp__row-actions">
                            <button
                              type="button"
                              className="ev-form__cancel grp__hand"
                              disabled={busy}
                              onClick={() => void onTransfer(member.name)}
                            >
                              Make host
                            </button>
                            <button
                              type="button"
                              className="ev-form__cancel grp__kick"
                              disabled={busy}
                              onClick={() => void onKick(member.name)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>

        {group.isOwner ? (
          <details className="ev-card grp__manage">
            <summary className="ev-card__head grp__manage-summary">
              <h2 className="ev-card__title">Manage group</h2>
              <span className="ev-card__note">Rename · delete</span>
            </summary>
            <form className="ev-card__body ev-form" onSubmit={(e) => void onRename(e)}>
              <label className="ev-field">
                <span className="visually-hidden">Group name</span>
                <input
                  className="ev-field__input"
                  value={renameDraft}
                  maxLength={32}
                  disabled={busy}
                  onChange={(e) => {
                    setRenameDraft(e.target.value)
                    setRenameNote(null)
                  }}
                />
              </label>
              {renameNote ? (
                <p
                  className={`ev-note${renameNote === 'Name saved.' ? '' : ' ev-note--error'}`}
                >
                  {renameNote}
                </p>
              ) : null}
              <div className="ev-form__actions">
                <button
                  type="submit"
                  className="ev-join__btn"
                  disabled={busy || renameDraft.trim().length < 2}
                >
                  {busy ? 'Saving…' : 'Save name'}
                </button>
                <button
                  type="button"
                  className="ev-form__cancel grp__danger"
                  disabled={busy}
                  onClick={() => void onDelete()}
                >
                  Delete group
                </button>
              </div>
            </form>
          </details>
        ) : group.isMember ? (
          <div className="grp__leave">
            <button
              type="button"
              className="ev-form__cancel grp__danger"
              disabled={busy}
              onClick={() => void onLeave()}
            >
              Leave group
            </button>
          </div>
        ) : null}
      </div>
    </PageShell>
  )
}
