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
import { AddFriendCard, FriendsGroupCard } from '../components/FriendsCircle'
import { GroupCard, GroupsPitch, HowGroupsWork, LinkCard, StartGroupCard } from '../components/GroupsHome'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { openSiteMenu } from '../components/siteNav'
import { navigate, useRoute } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { usePageName } from '../hooks/usePageMeta'
import { useFriends } from '../hooks/useFriends'
import { useGroupBoard } from '../hooks/useGroupBoard'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { groupAccent, groupStyle, leadLine, youLine, type GroupPeriod } from '../lib/groupPages'
import {
  createGroup,
  deleteGroup,
  fetchGroupDetail,
  FRIENDS_SCOPE,
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
  setGroupMembersInvite,
  storedActiveGroup,
  transferGroup,
  useActiveGroup,
  type GroupPublic,
} from '../lib/groups'
import { ApiError, normalizePlayerName } from '../lib/leaderboard'
import { isPlanLimitError } from '../lib/plans'
import { COPIED_MS, copyToClipboard } from '../lib/share'

function inviteUrl(id: string, code: string) {
  return `${window.location.origin}${groupHref(id, code)}`
}

/**
 * The Friends & groups page: your friends first, as a group made from who you've added, then each of your
 * groups as a card with its month so far and its records; adding a friend, starting a group, and opening
 * one from a link. With no group yet, what a group is.
 */
export function GroupsPage() {
  const { account, signedOut, loading: authLoading, limits, isPlus } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const activeId = useActiveGroup()
  const { friends, loaded: friendsLoaded } = useFriends()
  const [groups, setGroups] = useState<GroupPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [planError, setPlanError] = useState<unknown>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listMyGroups()
      .then((list) => {
        if (!cancelled) setGroups(list)
      })
      .catch(() => {
        // In the site's words, where the Start card shows it: the browser's ("Failed to fetch") isn't how the site talks.
        if (!cancelled) setError('Your groups couldn’t load. Check your connection and reload the page.')
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
    // A session whose account couldn't be asked for starts one all the same: the API knows whose it is.
    if (busy || signedOut) return
    setBusy(true)
    setError(null)
    setPlanError(null)
    try {
      const group = await createGroup(name)
      if (group.inviteCode) rememberGroupInvite(group.id, group.inviteCode)
      navigate(groupHref(group.id, group.inviteCode ?? undefined))
    } catch (err) {
      // A plan's refusal (402) gets its own notice, with the way to Plus; anything else is a plain error.
      setError(isPlanLimitError(err) ? null : err instanceof Error ? err.message : 'Could not start the group')
      setPlanError(isPlanLimitError(err) ? err : null)
      setBusy(false)
    }
  }

  // While a session's account is first asked for, the page waits rather than ask it to sign in. Not reached
  // (anything but a 401), its groups are the session's all the same: only its friends' card waits for the account.
  const waiting = loading || (authLoading && !account)

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="grp">
        <header className="grp-head">
          <div>
            <h1 className="grp-head__title">Friends &amp; groups</h1>
            <p className="grp-head__lede">The same boards, with just your people on them.</p>
          </div>
          {/* No "of 5": joining is never capped, only hosting (the Start card says how many). */}
          {account && friendsLoaded ? (
            <p className="grp-cap">
              {friends.length} {friends.length === 1 ? 'friend' : 'friends'} · {groups.length} {groups.length === 1 ? 'group' : 'groups'}
            </p>
          ) : null}
        </header>

        {waiting ? (
          <div className="grp-wait grp-wait--page" aria-busy="true" />
        ) : (
          <>
            <PendingInvitesStrip kind="group" />
            <div className="grp-index frd-index">
              <div className="grp-index__main">
                {account ? (
                  <FriendsGroupCard
                    me={playerName}
                    onBoards={activeId === FRIENDS_SCOPE}
                    onToggleBoards={() => setActiveGroup(activeId === FRIENDS_SCOPE ? null : FRIENDS_SCOPE)}
                  />
                ) : null}
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
                <AddFriendCard me={playerName} />
                <StartGroupCard
                  signedIn={!signedOut}
                  hosting={groups.filter((g) => g.isOwner).length}
                  limits={limits}
                  isPlus={isPlus}
                  name={name}
                  setName={setName}
                  busy={busy}
                  error={error}
                  planError={planError}
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
  const { account, signedOut } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const activeId = useActiveGroup()
  const [group, setGroup] = useState<GroupPublic | null>(null)
  const [loading, setLoading] = useState(true)
  /** Why there's no group to show: none at this address (a 404), or the API wasn't reached. The page says it in its own words. */
  const [error, setError] = useState<'missing' | 'failed' | null>(null)
  /** Try again, after a load that failed. */
  const [attempt, setAttempt] = useState(0)
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
  // The tab says which group, once it's here (and only this one: another's stays up while this one loads).
  usePageName(group?.id === id ? group.name : null)
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
    setNote(null)
    const code = invite ?? storedInvite
    void load(code)
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'INVITE_REQUIRED') {
          setNeedsInvite(true)
          setError(null)
          // A code that came with the link, or was kept from one, and no longer opens it: the gate says why.
          setNote(code ? 'That invite link has stopped working: the host may have made a new one.' : null)
        } else {
          setError(err instanceof ApiError && err.status === 404 ? 'missing' : 'failed')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, invite, route, playerName, account?.id, attempt])

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
    if (!code || !(await copyToClipboard(inviteUrl(id, code)))) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), COPIED_MS)
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

  /** The host lets everyone in the group invite, or keeps it to themselves. */
  const onMembersInvite = async (on: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      setGroup(await setGroupMembersInvite(id, on))
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Couldn’t change who can invite')
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
    // The site's own words, never the API's: no group at this address, or none reached.
    const missing = error === 'missing'
    return (
      <PageShell innerClassName="lb-page__inner lb-page__inner--events">
        <div className="grp" style={style}>
          <section className="grp-banner grp-banner--plain">
            <h1 className="grp-banner__title">{missing ? 'This group isn’t here' : 'Couldn’t open this group'}</h1>
            <p className="grp-copy">
              {missing ? 'It may have been deleted, or the link is missing a letter.' : 'Check your connection and try again.'}
            </p>
            <div className="grp-acts">
              {missing ? null : (
                <button type="button" className="grp-btn" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </button>
              )}
              <a className={missing ? 'grp-btn' : 'grp-btn grp-btn--ghost'} href={groupsIndexHref()}>
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
  // Joining takes a gamer tag, and a new tag takes an account (the API's names.ts): signed out, signing in comes first.
  const join = playerName ? (
    <button type="button" className="grp-btn" disabled={busy} onClick={() => void onJoin()}>
      {busy ? 'Joining…' : `Join as ${playerName}`}
    </button>
  ) : (
    <>
      <button type="button" className="grp-btn" onClick={openSiteMenu}>
        {signedOut ? 'Sign in to join' : 'Pick a gamer tag to join'}
      </button>
      <span className="grp-hint">{signedOut ? 'Sign in and pick a gamer tag to join.' : 'Pick one in the menu.'}</span>
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
              {/* The host's card, and everyone's once the host lets them: the API only sends the code to those. */}
              {url ? (
                <GroupInvite
                  group={group}
                  inviteUrl={url}
                  copied={copied}
                  busy={busy}
                  onCopy={() => void copyInvite()}
                  onRotate={() => void onRotate()}
                  onMembersInvite={(on) => void onMembersInvite(on)}
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
