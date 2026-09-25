import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useConfirm } from '../components/ConfirmPanel'
import {
  GroupBanner,
  GroupGate,
  GroupHosting,
  GroupInvite,
  GroupLocked,
  GroupMembers,
  GroupRecords,
  GroupStandings,
  NewestRecords,
} from '../components/GroupDetail'
import { GroupCard, GroupsPitch, HowGroupsWork, LinkCard, StartGroupCard } from '../components/GroupsHome'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { openSiteMenu } from '../components/siteNav'
import { navigate, useRoute } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { useGroupBoard } from '../hooks/useGroupBoard'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { GROUP_LIMIT, groupAccent, groupStyle, leadLine, youLine, type GroupPeriod } from '../lib/groupPages'
import {
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
  transferGroup,
  useActiveGroup,
  type GroupPublic,
} from '../lib/groups'
import { ApiError, normalizePlayerName } from '../lib/leaderboard'

function inviteUrl(id: string, code: string) {
  return `${window.location.origin}${groupHref(id, code)}`
}

/**
 * The groups page: each of your groups as a card with its month so far and
 * its records, starting one, and opening one from a link. With no group yet,
 * what a group is.
 */
export function GroupsPage() {
  const { account, loading: authLoading } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const activeId = useActiveGroup()
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
      navigate(groupHref(group.id, group.inviteCode ?? undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the group')
      setBusy(false)
    }
  }

  const waiting = loading || (authLoading && !account && groups.length === 0)

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="grp">
        <header className="grp-head">
          <div>
            <h1 className="grp-head__title">Groups</h1>
            <p className="grp-head__lede">The same boards, with just your people on them.</p>
          </div>
          {groups.length ? (
            <p className="grp-cap">
              {groups.length} of {GROUP_LIMIT} groups
            </p>
          ) : null}
        </header>

        {waiting ? (
          <div className="grp-wait grp-wait--page" aria-busy="true" />
        ) : (
          <>
            <PendingInvitesStrip kind="group" />
            <div className="grp-index">
              <div className="grp-index__main">
                {groups.length ? (
                  groups.map((g) => (
                    <GroupCard
                      key={g.id}
                      group={g}
                      me={playerName}
                      onBoards={g.id === activeId}
                      onToggleBoards={() => setActiveGroup(g.id === activeId ? null : g.id)}
                    />
                  ))
                ) : (
                  <GroupsPitch />
                )}
              </div>
              <div className="grp-index__side">
                <StartGroupCard
                  signedIn={Boolean(account)}
                  full={groups.length >= GROUP_LIMIT}
                  name={name}
                  setName={setName}
                  busy={busy}
                  error={error}
                  onCreate={(e) => void onCreate(e)}
                />
                <LinkCard onOpen={(id, invite) => navigate(groupHref(id, invite ?? undefined))} />
                {groups.length ? <HowGroupsWork /> : null}
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}

/**
 * One group. Its members see its standings and its record on every game;
 * its host also invites, renames, hands it over or deletes it; someone with
 * an invite sees who is in and joins; someone without one types the code.
 */
export function GroupDetailPage({ id, invite }: { id: string; invite?: string }) {
  const route = useRoute()
  const { account } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const activeId = useActiveGroup()
  const [group, setGroup] = useState<GroupPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsInvite, setNeedsInvite] = useState(false)
  const [inviteDraft, setInviteDraft] = useState(invite ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [renameNote, setRenameNote] = useState<string | null>(null)
  const [period, setPeriod] = useState<GroupPeriod>('monthly')

  const storedInvite = invite ?? getGroupInvite(id) ?? undefined
  const accent = groupAccent(id)
  // Questions about the group ask in a panel in its colour, not the browser's grey box.
  const [ask, question] = useConfirm({ '--celeb-accent': accent, '--hero-ink': inkOn(accent) } as CSSProperties)

  const inside = Boolean(group && (group.isMember || group.isOwner))
  const board = useGroupBoard(group?.id ?? null, period, inside)
  const month = useGroupBoard(group?.id ?? null, 'monthly', inside)

  const load = async (inviteCode?: string) => {
    const data = await fetchGroupDetail(id, inviteCode ?? storedInvite)
    setGroup(data)
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
      setNote('Ask the host for the invite link.')
      return
    }
    if (!playerName) {
      setNote('Pick a gamer tag in the menu first.')
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
        setNote('That invite code isn’t right. Check it against the link.')
      } else {
        setNote(err instanceof Error ? err.message : 'Could not open the group')
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
    if (busy) return
    const yes = await ask({
      title: 'Leave this group?',
      body: 'Its board stops showing your runs, and you’ll need an invite to come back.',
      confirm: 'Leave group',
      destructive: true,
    })
    if (!yes) return
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
    if (busy) return
    const yes = await ask({
      title: 'Delete this group for everyone?',
      body: 'Its board, its invite links and its roster go for every member. There is no undo.',
      confirm: 'Delete group',
      destructive: true,
    })
    if (!yes) return
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

  const onRename = async (nextName: string): Promise<boolean> => {
    if (busy || !group) return false
    const trimmed = nextName.trim()
    if (trimmed.length < 2) {
      setRenameNote('A name needs at least 2 characters.')
      return false
    }
    if (trimmed === group.name) {
      setRenameNote(null)
      return true
    }
    setBusy(true)
    setRenameNote(null)
    try {
      const next = await renameGroup(id, trimmed)
      setGroup(next)
      setRenameNote('Name saved.')
      return true
    } catch (err) {
      setRenameNote(err instanceof Error ? err.message : 'Could not rename')
      return false
    } finally {
      setBusy(false)
    }
  }

  const onRotate = async () => {
    if (busy) return
    const yes = await ask({
      title: 'Make a new invite link?',
      body: 'Old invite links will stop working.',
      confirm: 'Make a new link',
    })
    if (!yes) return
    setBusy(true)
    try {
      const next = await rotateGroupInvite(id)
      setGroup(next)
      if (next.inviteCode) rememberGroupInvite(id, next.inviteCode)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not make a new link')
    } finally {
      setBusy(false)
    }
  }

  const onKick = async (name: string) => {
    if (busy) return
    const yes = await ask({
      title: `Remove ${name} from the group?`,
      body: 'They come off its board, and need an invite to come back.',
      confirm: 'Remove',
      destructive: true,
    })
    if (!yes) return
    setBusy(true)
    try {
      setGroup(await kickGroupMember(id, name))
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
    const ok = await ask({
      title: `Make ${name} the host?`,
      body: 'They get the invite link and the roster controls, and you won’t be able to undo it yourself.',
      confirm: `Make ${name} host`,
    })
    if (!ok) return
    setBusy(true)
    setNote(null)
    try {
      setGroup(await transferGroup(id, name))
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not hand the group over')
    } finally {
      setBusy(false)
    }
  }

  const style = groupStyle(id)

  if (loading) {
    return (
      <PageShell innerClassName="lb-page__inner lb-page__inner--events">
        <div className="grp" style={style}>
          <div className="grp-wait grp-wait--page" aria-busy="true" />
        </div>
      </PageShell>
    )
  }

  if (needsInvite) {
    return (
      <PageShell innerClassName="lb-page__inner lb-page__inner--events">
        <div className="grp" style={style}>
          <GroupGate draft={inviteDraft} onDraft={setInviteDraft} busy={busy} note={note} onSubmit={() => void submitInvite()} />
        </div>
      </PageShell>
    )
  }

  if (error || !group) {
    return (
      <PageShell innerClassName="lb-page__inner lb-page__inner--events">
        <div className="grp" style={style}>
          <section className="grp-banner grp-banner--plain">
            <h1 className="grp-banner__title">Group not found</h1>
            <p className="grp-copy">{error ?? 'Its invite link may have been replaced by a new one.'}</p>
            <div className="grp-acts">
              <a className="grp-btn grp-btn--ghost" href={groupsIndexHref()}>
                Your groups
              </a>
            </div>
          </section>
        </div>
      </PageShell>
    )
  }

  const viewer = group.isOwner ? 'host' : group.isMember ? 'member' : 'visitor'
  const url = group.inviteCode ? inviteUrl(id, group.inviteCode) : null
  const monthEntries = month.table?.entries ?? []
  const join = playerName ? (
    <button type="button" className="grp-btn" disabled={busy} onClick={() => void onJoin()}>
      {busy ? 'Joining…' : `Join as ${playerName}`}
    </button>
  ) : (
    <>
      <button type="button" className="grp-btn" onClick={openSiteMenu}>
        Pick a gamer tag to join
      </button>
      <span className="grp-hint">Sign in from the menu and pick a tag.</span>
    </>
  )
  const members = (
    <GroupMembers
      group={group}
      me={playerName}
      canManage={group.isOwner}
      canLeave={group.isMember && !group.isOwner}
      busy={busy}
      onTransfer={(n) => void onTransfer(n)}
      onKick={(n) => void onKick(n)}
      onLeave={() => void onLeave()}
    />
  )

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="grp" style={style}>
        <GroupBanner
          group={group}
          viewer={viewer}
          lead={month.table ? leadLine(monthEntries, 'monthly', playerName) : null}
          you={month.table && playerName ? youLine(monthEntries, playerName, 'monthly', true) : null}
          inviteUrl={url}
          copied={copied}
          onCopyInvite={() => void copyInvite()}
          join={join}
          onBoards={activeId === group.id}
          onSetBoards={(on) => setActiveGroup(on ? group.id : null)}
        />

        {note ? <p className="grp-error">{note}</p> : null}

        {inside ? (
          <div className="grp-split">
            <div className="grp-split__main">
              <GroupStandings group={group} me={playerName} period={period} onPeriod={setPeriod} table={board.table} />
              <GroupRecords group={group} me={playerName} records={board.records} />
            </div>
            <aside className="grp-split__side" aria-label={`About ${group.name}`}>
              {group.isOwner && url ? (
                <GroupInvite
                  group={group}
                  inviteUrl={url}
                  copied={copied}
                  busy={busy}
                  onCopy={() => void copyInvite()}
                  onRotate={() => void onRotate()}
                />
              ) : null}
              <NewestRecords records={board.records} />
              {members}
              {group.isOwner ? (
                <GroupHosting
                  key={group.name}
                  group={group}
                  busy={busy}
                  renameNote={renameNote}
                  onRename={onRename}
                  onDelete={() => void onDelete()}
                />
              ) : null}
            </aside>
          </div>
        ) : (
          <div className="grp-split">
            <div className="grp-split__main">
              <GroupLocked group={group} />
            </div>
            <aside className="grp-split__side" aria-label={`Who’s in ${group.name}`}>
              {members}
            </aside>
          </div>
        )}
        {question}
      </div>
    </PageShell>
  )
}
