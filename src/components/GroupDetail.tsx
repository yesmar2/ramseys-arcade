import { useState, type FormEvent, type ReactNode } from 'react'
import { gameHref, rankHref, tournamentCreateHref } from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import {
  gameName,
  gamesLed,
  GROUP_PERIODS,
  MEMBER_LIMIT,
  membersInOrder,
  nameList,
  newestRecords,
  openRecords,
  periodWords,
  recordHolders,
  whenSet,
  type GroupPeriod,
  type GroupRecord,
  type GroupTable,
} from '../lib/groupPages'
import { groupsIndexHref, type GroupPublic } from '../lib/groups'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { normalizePlayerName, type GlobalBoardEntry } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { getGame } from '../data/games'
import { GameThumbArt } from './GameThumbArt'
import { GroupFaces, TicketIcon } from './GroupsHome'
import { InviteByTagForm } from './InviteByTagForm'
import { PlayerAvatar } from './PlayerAvatar'
import { ShareBoardButton } from './ShareBoardButton'

/* One group's page: its banner, its standings, its record on every game, what's new, who's in, and the host's tools. */

function gameAccent(slug: string) {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const LinkIcon = () => (
  <Icon size={18}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </Icon>
)
const LockIcon = () => (
  <Icon size={24}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icon>
)
const TrophyIcon = () => (
  <Icon size={24}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3" />
  </Icon>
)
const DotsIcon = () => (
  <Icon size={16}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </Icon>
)
const DownIcon = () => (
  <Icon size={15}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
)

/* ---------- the banner ---------- */

export type BannerViewer = 'member' | 'host' | 'visitor'

/**
 * Who the group is and how its month stands, and the one thing to do next:
 * make an event for everyone, invite (the host), or join (a visitor). Inside
 * the group, a switch puts it on every board on the site.
 */
export function GroupBanner({
  group,
  viewer,
  lead,
  you,
  inviteUrl,
  copied,
  onCopyInvite,
  join,
  onBoards,
  onSetBoards,
}: {
  group: GroupPublic
  viewer: BannerViewer
  lead: string | null
  you: string | null
  inviteUrl: string | null
  copied: boolean
  onCopyInvite: () => void
  /** The visitor's way in: a Join button, or how to get a tag first. */
  join: ReactNode
  onBoards: boolean
  onSetBoards: (on: boolean) => void
}) {
  const inside = viewer !== 'visitor'
  const host = group.ownerName ? normalizePlayerName(group.ownerName) : null
  const hostWords = viewer === 'host' ? 'you host' : host ? `${host} hosts` : null
  const eventHref = tournamentCreateHref(group.id)
  return (
    <section className="grp-banner" aria-labelledby="grp-title">
      <div className="grp-banner__bar">
        <nav className="grp-crumbs" aria-label="Breadcrumb">
          <a href={groupsIndexHref()}>Groups</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{group.name}</span>
        </nav>
        {inviteUrl ? (
          <ShareBoardButton
            className="grp-share"
            label={`Join ${group.name} on ${APP_NAME}: the same boards, with just us on them.`}
            url={inviteUrl}
          />
        ) : null}
      </div>
      <div className="grp-banner__main">
        <p className="grp-kick">
          {inside ? 'Your group · ' : ''}
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          {hostWords ? ` · ${hostWords}` : ''}
        </p>
        <div className="grp-banner__name">
          <h1 id="grp-title" className="grp-banner__title">
            {group.name}
          </h1>
          <GroupFaces group={group} shown={10} size="lg" />
        </div>
        {inside ? (
          lead || you ? (
            <p className="grp-banner__line">
              {lead}
              {you ? <b> {you}</b> : null}
            </p>
          ) : null
        ) : (
          <p className="grp-banner__line">
            You have an invite. {group.memberCount} {group.memberCount === 1 ? 'person plays' : 'people play'} here
            {host ? `, and ${host} hosts` : ''}.
          </p>
        )}
        <div className="grp-acts">
          {viewer === 'host' ? (
            <>
              <button type="button" className="grp-btn" onClick={onCopyInvite} disabled={!inviteUrl}>
                <LinkIcon />
                {copied ? 'Copied' : 'Copy invite link'}
              </button>
              <a className="grp-btn grp-btn--ghost" href={eventHref}>
                Make an event for the group
              </a>
            </>
          ) : viewer === 'member' ? (
            <>
              <a className="grp-btn" href={eventHref}>
                Make an event for the group
              </a>
              <span className="grp-hint">
                Pick the games, and {group.memberCount === 2 ? 'both' : `all ${group.memberCount}`} of you get the invite.
              </span>
            </>
          ) : (
            join
          )}
        </div>
      </div>
      {inside ? (
        <div className="grp-banner__side">
          <p className="grp-cap">The site’s boards show</p>
          <div className="grp-seg" role="group" aria-label="What the site’s boards show">
            <button type="button" aria-pressed={!onBoards} onClick={() => onSetBoards(false)}>
              Everyone
            </button>
            <button type="button" aria-pressed={onBoards} onClick={() => onSetBoards(true)}>
              {group.name}
            </button>
          </div>
          <p className="grp-banner__note">
            {onBoards
              ? `Every board, record book and rank on the site counts just the ${group.memberCount} of you, until you switch back.`
              : `Pick ${group.name} and every board, record book and rank on the site counts just the ${group.memberCount} of you.`}
          </p>
        </div>
      ) : null}
    </section>
  )
}

/* ---------- the standings ---------- */

function StandingRow({ entry, top, me, host }: { entry: GlobalBoardEntry; top: number; me: string; host: string | null }) {
  const name = normalizePlayerName(entry.name)
  const you = Boolean(me) && name === me
  const led = gamesLed(entry)
  return (
    <li className={`grp-row${you ? ' grp-row--you' : ''}`}>
      <span className={`grp-place${entry.rank <= 3 ? ` grp-place--${entry.rank}` : ''}`}>{entry.rank}</span>
      <a className="grp-row__who" href={rankHref(name)}>
        <PlayerAvatar name={name} avatarId={entry.avatarId} size="md" />
        <span className="grp-name">{name}</span>
        {you ? <span className="grp-tag grp-tag--you">You</span> : null}
        {host === name ? <span className="grp-tag grp-tag--host">Host</span> : null}
      </a>
      <span className="grp-row__led" title={led.length ? `1st on ${nameList(led.map(gameName))}` : undefined}>
        {led.slice(0, 4).map((slug) => (
          <span key={slug} className="grp-row__game">
            <GameThumbArt slug={slug} accent={gameAccent(slug)} />
          </span>
        ))}
      </span>
      <span className="grp-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(4, Math.round((100 * entry.score) / Math.max(1, top)))}%` }} />
      </span>
      <span className="grp-pts">
        {entry.score}
        <small> pts</small>
      </span>
      <span className="grp-row__games">
        {entry.games} {entry.games === 1 ? 'game' : 'games'}
      </span>
    </li>
  )
}

const SHOWN = 10

/**
 * The group's table, by the boards' own points: each game pays the group by
 * place and a player's games add up. A quiet week says what the first run
 * does rather than showing an empty table.
 */
export function GroupStandings({
  group,
  me,
  period,
  onPeriod,
  table,
}: {
  group: GroupPublic
  me: string
  period: GroupPeriod
  onPeriod: (p: GroupPeriod) => void
  table: GroupTable | null
}) {
  const entries = table?.entries ?? []
  const you = normalizePlayerName(me)
  const host = group.ownerName ? normalizePlayerName(group.ownerName) : null
  const top = entries[0]?.score ?? 1
  const shown = entries.slice(0, SHOWN)
  const mine = entries.find((e) => normalizePlayerName(e.name) === you)
  const count = entries.length
  const sub =
    count === 0
      ? period === 'weekly'
        ? 'Monday to Sunday'
        : `Nobody yet`
      : period === 'monthly'
        ? `${count} of ${group.memberCount} have played in ${periodWords('monthly')}`
        : period === 'weekly'
          ? `${count} of ${group.memberCount} have played this week`
          : `${count} ${count === 1 ? 'player' : 'players'} since the group began`
  return (
    <section className="grp-card grp-table" aria-labelledby="grp-table-title">
      <div className="grp-card__head">
        <div>
          <h2 id="grp-table-title" className="grp-h2">
            Standings
          </h2>
          <p className="grp-sub">{table ? sub : ' '}</p>
        </div>
        <div className="grp-seg" role="group" aria-label="Period">
          {GROUP_PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={p.id === period} onClick={() => onPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {table === null ? (
        <div className="grp-wait grp-wait--table" aria-busy="true" />
      ) : count === 0 ? (
        <div className="grp-empty">
          <span className="grp-empty__mark" aria-hidden="true">
            <TrophyIcon />
          </span>
          <p className="grp-empty__title">Nobody’s played {period === 'weekly' ? 'this week' : `in ${periodWords(period)}`} yet</p>
          <p className="grp-copy">
            Any run on any game puts you top of the {group.name} table, and the first on each game takes all 100 points.
          </p>
        </div>
      ) : (
        <>
          <ol className="grp-rows">
            {shown.map((e) => (
              <StandingRow key={e.name} entry={e} top={top} me={you} host={host} />
            ))}
            {mine && !shown.includes(mine) ? <StandingRow entry={mine} top={top} me={you} host={host} /> : null}
          </ol>
          {count > SHOWN ? (
            <details className="grp-more">
              <summary>
                All {count} players
                <DownIcon />
              </summary>
              <ol className="grp-rows">
                {entries.slice(SHOWN).map((e) => (
                  <StandingRow key={e.name} entry={e} top={top} me={you} host={host} />
                ))}
              </ol>
            </details>
          ) : null}
        </>
      )}
      <p className="grp-fine">
        Points as on the boards: each game pays the {group.memberCount} of you by place, 100 for 1st, and your games add up.
      </p>
    </section>
  )
}

/* ---------- the records ---------- */

/** The best anyone in the group has done on each game, yours lit, and the games nobody has a record on yet. */
export function GroupRecords({ group, me, records }: { group: GroupPublic; me: string; records: GroupRecord[] | null }) {
  const you = normalizePlayerName(me)
  const holders = records ? recordHolders(records) : []
  const open = records ? openRecords(records) : []
  return (
    <section className="grp-card grp-records" aria-labelledby="grp-records-title">
      <div>
        <h2 id="grp-records-title" className="grp-h2">
          {group.name}’s records
        </h2>
        <p className="grp-copy">
          The best anyone in the group has done on each game.
          {open.length
            ? ` ${nameList(open.map(gameName))} ${open.length === 1 ? 'is' : 'are'} still open: one run takes ${open.length === 1 ? 'it' : 'each'}.`
            : ''}
        </p>
      </div>
      {records === null ? (
        <div className="grp-wait grp-wait--grid" aria-busy="true" />
      ) : (
        <>
          {holders.length ? (
            <ul className="grp-holders" aria-label="Who holds how many">
              {holders.map((h) => (
                <li key={h.name} className={`grp-holder${h.name === you ? ' grp-holder--you' : ''}`}>
                  <PlayerAvatar name={h.name} avatarId={h.avatarId} size="sm" />
                  <b>{h.name === you ? 'You' : h.name}</b>
                  <span>{h.count}</span>
                </li>
              ))}
              {open.length ? <li className="grp-holder grp-holder--open">{open.length} open</li> : null}
            </ul>
          ) : null}
          <ul className="grp-recs">
            {records.map((r) => {
              const game = (
                <span className="grp-rec__game">
                  <span className="grp-rec__icon">
                    <GameThumbArt slug={r.slug} accent={gameAccent(r.slug)} />
                  </span>
                  <b>{gameName(r.slug)}</b>
                </span>
              )
              if (!r.best) {
                return (
                  <li key={r.slug} className="grp-rec grp-rec--open">
                    {game}
                    <span className="grp-rec__none">No record yet</span>
                    <a className="grp-link" href={gameHref(r.slug)}>
                      Take it ›
                    </a>
                  </li>
                )
              }
              const holder = normalizePlayerName(r.best.name)
              const mine = holder === you
              return (
                <li key={r.slug} className={`grp-rec${mine ? ' grp-rec--you' : ''}`}>
                  {game}
                  {mine ? <span className="grp-tag grp-tag--you grp-rec__yours">Yours</span> : null}
                  <a className="grp-rec__who" href={rankHref(holder)}>
                    <PlayerAvatar name={holder} avatarId={r.best.avatarId} size="sm" />
                    <span className="grp-name">{holder}</span>
                  </a>
                  <span className="grp-rec__score">{formatLeaderboardScore(r.slug, r.best.score)}</span>
                  <span className="grp-rec__when">{whenSet(r.best.at)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

/** The records set most lately. */
export function NewestRecords({ records }: { records: GroupRecord[] | null }) {
  const newest = records ? newestRecords(records, 5) : []
  if (records && newest.length === 0) return null
  return (
    <section className="grp-card grp-side" aria-labelledby="grp-new-title">
      <h2 id="grp-new-title" className="grp-h2">
        Newest records
      </h2>
      {records === null ? (
        <div className="grp-wait grp-wait--list" aria-busy="true" />
      ) : (
        <ol className="grp-feed">
          {newest.map((r) => {
            const name = normalizePlayerName(r.best.name)
            return (
              <li key={r.slug}>
                <PlayerAvatar name={name} avatarId={r.best.avatarId} size="md" />
                <span>
                  <span className="grp-feed__what">
                    <b>{name}</b> set the {gameName(r.slug)} record: <b>{formatLeaderboardScore(r.slug, r.best.score)}</b>
                  </span>
                  <span className="grp-fine">{whenSet(r.best.at)}</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/* ---------- who's in ---------- */

const MEMBERS_SHOWN = 7

function MemberRow({
  member,
  host,
  me,
  canManage,
  busy,
  onTransfer,
  onKick,
}: {
  member: GroupPublic['members'][number]
  host: string | null
  me: string
  canManage: boolean
  busy: boolean
  onTransfer: (name: string) => void
  onKick: (name: string) => void
}) {
  const name = normalizePlayerName(member.name)
  const you = Boolean(me) && name === me
  const since = new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <li className="grp-member">
      <PlayerAvatar name={name} avatarId={member.avatarId} size="md" />
      <span className="grp-member__text">
        <span className="grp-member__name">
          <a className="grp-name" href={rankHref(name)}>
            {name}
          </a>
          {host === name ? <span className="grp-tag grp-tag--host">Host</span> : null}
          {you ? <span className="grp-tag grp-tag--you">You</span> : null}
        </span>
        <span className="grp-fine">Since {since}</span>
      </span>
      {canManage && !you ? (
        <details className="grp-menu">
          <summary aria-label={`${name}: make host or remove`}>
            <DotsIcon />
          </summary>
          <div className="grp-menu__pop">
            <button type="button" disabled={busy} onClick={() => onTransfer(name)}>
              Make {name} the host
            </button>
            <button type="button" className="grp-menu__danger" disabled={busy} onClick={() => onKick(name)}>
              Remove {name}
            </button>
          </div>
        </details>
      ) : null}
    </li>
  )
}

/** The roster: the host first, then in the order they joined. The host can hand the group over or remove someone. */
export function GroupMembers({
  group,
  me,
  canManage,
  canLeave,
  busy,
  onTransfer,
  onKick,
  onLeave,
}: {
  group: GroupPublic
  me: string
  canManage: boolean
  canLeave: boolean
  busy: boolean
  onTransfer: (name: string) => void
  onKick: (name: string) => void
  onLeave: () => void
}) {
  const members = membersInOrder(group)
  const host = group.ownerName ? normalizePlayerName(group.ownerName) : null
  const you = normalizePlayerName(me)
  const row = (m: GroupPublic['members'][number]) => (
    <MemberRow
      key={m.name}
      member={m}
      host={host}
      me={you}
      canManage={canManage}
      busy={busy}
      onTransfer={onTransfer}
      onKick={onKick}
    />
  )
  return (
    <section className="grp-card grp-side" aria-labelledby="grp-members-title">
      <div className="grp-card__head">
        <h2 id="grp-members-title" className="grp-h2">
          Who’s in
        </h2>
        <span className="grp-sub">
          {group.memberCount} of {MEMBER_LIMIT}
        </span>
      </div>
      <ul className="grp-members">{members.slice(0, MEMBERS_SHOWN).map(row)}</ul>
      {members.length > MEMBERS_SHOWN ? (
        <details className="grp-more">
          <summary>
            All {members.length} members
            <DownIcon />
          </summary>
          <ul className="grp-members">{members.slice(MEMBERS_SHOWN).map(row)}</ul>
        </details>
      ) : null}
      {canLeave ? (
        <button type="button" className="grp-quiet-link" disabled={busy} onClick={onLeave}>
          Leave the group
        </button>
      ) : null}
    </section>
  )
}

/* ---------- the host's tools ---------- */

/**
 * The invite: the link to send, its code, and invites by gamer tag. The host
 * also chooses who can invite and can make a fresh code; anyone else sees it
 * once the host has let everyone invite.
 */
export function GroupInvite({
  group,
  inviteUrl,
  copied,
  busy,
  onCopy,
  onRotate,
  onMembersInvite,
}: {
  group: GroupPublic
  inviteUrl: string
  copied: boolean
  busy: boolean
  onCopy: () => void
  onRotate: () => void
  onMembersInvite: (on: boolean) => void
}) {
  const seats = Math.max(0, MEMBER_LIMIT - group.memberCount)
  const host = group.isOwner
  return (
    <section className="grp-card grp-side grp-invite" aria-labelledby="grp-invite-title">
      <div className="grp-card__head">
        <h2 id="grp-invite-title" className="grp-h2">
          Invite people
        </h2>
        <span className="grp-sub">{seats === 0 ? 'Full' : `${seats} ${seats === 1 ? 'seat' : 'seats'} left`}</span>
      </div>
      {host ? (
        <div className="grp-invite__who">
          <span className="grp-cap">Who can invite</span>
          <div className="grp-seg" role="group" aria-label="Who can invite">
            <button type="button" aria-pressed={!group.membersInvite} disabled={busy} onClick={() => onMembersInvite(false)}>
              Just me
            </button>
            <button type="button" aria-pressed={Boolean(group.membersInvite)} disabled={busy} onClick={() => onMembersInvite(true)}>
              Everyone in it
            </button>
          </div>
        </div>
      ) : (
        <p className="grp-fine">The host has let everyone in the group invite.</p>
      )}
      <div className="grp-invite__link">
        <LinkIcon />
        <span className="grp-invite__url">{inviteUrl.replace(/^https?:\/\//, '')}</span>
        <button type="button" className="grp-btn grp-btn--small" onClick={onCopy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <p className="grp-fine">
        Code <b className="grp-invite__code">{group.inviteCode}</b>
        {host ? (
          <>
            {' '}·{' '}
            <button type="button" className="grp-quiet-link grp-quiet-link--inline" disabled={busy} onClick={onRotate}>
              Make a new code
            </button>
          </>
        ) : null}
      </p>
      <InviteByTagForm kind="group" targetId={group.id} disabled={busy} excludeNames={group.members.map((m) => m.name)} />
    </section>
  )
}

/** Renaming and deleting, kept out of the way at the bottom of the side. */
export function GroupHosting({
  group,
  busy,
  renameNote,
  onRename,
  onDelete,
}: {
  group: GroupPublic
  busy: boolean
  renameNote: string | null
  onRename: (name: string) => Promise<boolean>
  onDelete: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(group.name)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (await onRename(draft)) setRenaming(false)
  }
  return (
    <section className="grp-card grp-side" aria-labelledby="grp-hosting-title">
      <h2 id="grp-hosting-title" className="grp-h2">
        Hosting
      </h2>
      {renaming ? (
        <form className="grp-field" onSubmit={(e) => void submit(e)}>
          <label className="visually-hidden" htmlFor="grp-rename">
            Group name
          </label>
          <input id="grp-rename" value={draft} maxLength={32} disabled={busy} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="grp-btn grp-btn--small" disabled={busy || draft.trim().length < 2}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      ) : null}
      {renameNote ? <p className={renameNote === 'Name saved.' ? 'grp-fine' : 'grp-error'}>{renameNote}</p> : null}
      <div className="grp-acts">
        {renaming ? (
          <button type="button" className="grp-btn grp-btn--small grp-btn--quiet" onClick={() => setRenaming(false)}>
            Keep the name
          </button>
        ) : (
          <button
            type="button"
            className="grp-btn grp-btn--small grp-btn--quiet"
            onClick={() => {
              setDraft(group.name)
              setRenaming(true)
            }}
          >
            Rename
          </button>
        )}
        <button type="button" className="grp-btn grp-btn--small grp-btn--danger" disabled={busy} onClick={onDelete}>
          Delete the group
        </button>
      </div>
      <p className="grp-fine">To hand the group over, open the menu beside a member.</p>
    </section>
  )
}

/* ---------- from outside ---------- */

/** What a visitor with an invite is missing: group boards are members only. */
export function GroupLocked({ group, records }: { group: GroupPublic; records?: number }) {
  return (
    <section className="grp-card grp-locked" aria-labelledby="grp-locked-title">
      <span className="grp-locked__mark" aria-hidden="true">
        <LockIcon />
      </span>
      <h2 id="grp-locked-title" className="grp-h2">
        Members see the standings and records
      </h2>
      <p className="grp-copy">
        {group.name}’s table this month, who holds each of its records{records ? ` (${records} games)` : ''}, and the games nobody
        has a record on yet. Join and your best runs so far count here straight away.
      </p>
    </section>
  )
}

/** No code, no way in: the group is invite only. */
export function GroupGate({
  draft,
  onDraft,
  busy,
  note,
  onSubmit,
}: {
  draft: string
  onDraft: (v: string) => void
  busy: boolean
  note: string | null
  onSubmit: () => void
}) {
  return (
    <>
      <section className="grp-banner grp-banner--plain" aria-labelledby="grp-gate-title">
        <nav className="grp-crumbs" aria-label="Breadcrumb">
          <a href={groupsIndexHref()}>Groups</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Private group</span>
        </nav>
        <h1 id="grp-gate-title" className="grp-banner__title">
          Private group
        </h1>
      </section>
      <section className="grp-card grp-gate" aria-label="Invite code">
        <span className="grp-locked__mark" aria-hidden="true">
          <TicketIcon />
        </span>
        <h2 className="grp-h2">This group is invite only</h2>
        <p className="grp-copy">Ask the host for the link, or type the code from it.</p>
        <form
          className="grp-field"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <label className="visually-hidden" htmlFor="grp-gate-code">
            Invite code
          </label>
          <input
            id="grp-gate-code"
            className="grp-field__code"
            value={draft}
            maxLength={16}
            placeholder="ABCD1234"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onDraft(e.target.value.toUpperCase())}
          />
          <button type="submit" className="grp-btn grp-btn--small" disabled={busy || !draft.trim()}>
            {busy ? 'Checking…' : 'Open'}
          </button>
        </form>
        {note ? <p className="grp-error">{note}</p> : null}
      </section>
    </>
  )
}

