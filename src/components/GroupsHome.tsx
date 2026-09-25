import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { rankHref } from '../hooks/useHashRoute'
import { useGroupBoard } from '../hooks/useGroupBoard'
import {
  gameName,
  GROUP_LIMIT,
  groupStyle,
  MEMBER_LIMIT,
  parseGroupLink,
  newestRecords,
  openRecords,
  recordHolders,
  whenSet,
  youLine,
} from '../lib/groupPages'
import { groupHref, type GroupPublic } from '../lib/groups'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { normalizePlayerName, type GlobalBoardEntry } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { getGame } from '../data/games'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'
import { openSiteMenu } from './siteNav'

/* The groups page's pieces: each of your groups as a card, starting one, opening one from a code, and what a group is. */

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

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
)
export const TicketIcon = () => (
  <Icon>
    <path d="M3 9V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V9a3 3 0 0 0 0 6v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V15a3 3 0 0 0 0-6Z" />
    <path d="M14 5v14" strokeDasharray="2 2.5" />
  </Icon>
)
export const CheckIcon = () => (
  <Icon size={16}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
)
export const ChevronIcon = () => (
  <Icon size={16}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
)
export const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 4.8a3.2 3.2 0 0 1 0 6.4" />
    <path d="M18 14.7c1.9.7 3 2.5 3 5.3" />
  </Icon>
)
const TableIcon = () => (
  <Icon>
    <path d="M4 20V11" />
    <path d="M10 20V5" />
    <path d="M16 20v-6" />
    <path d="M22 20H2" />
  </Icon>
)
const BookIcon = () => (
  <Icon>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" />
    <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" />
    <path d="M9 7h6" />
  </Icon>
)

/** A group's letter on a tile of its colour. */
export function GroupMark({ group, size = 'md' }: { group: GroupPublic; size?: 'md' | 'lg' }) {
  return (
    <span className={`grp-mark grp-mark--${size}`} aria-hidden="true">
      {group.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

/** Members' faces, overlapping, with the rest as a count. */
export function GroupFaces({ group, shown = 6, size = 'md' }: { group: GroupPublic; shown?: number; size?: 'md' | 'lg' }) {
  const faces = group.members.slice(0, shown)
  const extra = group.memberCount - faces.length
  return (
    <span className={`grp-faces grp-faces--${size}`} aria-hidden="true">
      {faces.map((m, i) => (
        <span key={m.name} className="grp-faces__face" style={{ zIndex: faces.length - i } as CSSProperties}>
          <PlayerAvatar name={m.name} avatarId={m.avatarId} size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      ))}
      {extra > 0 ? <span className="grp-faces__more">+{extra}</span> : null}
    </span>
  )
}

function MiniRow({ entry, you }: { entry: GlobalBoardEntry; you: boolean }) {
  return (
    <li className={`grp-mini__row${you ? ' grp-mini__row--you' : ''}`}>
      <span className={`grp-place${entry.rank <= 3 ? ` grp-place--${entry.rank}` : ''}`}>{entry.rank}</span>
      <a className="grp-mini__who" href={rankHref(entry.name)}>
        <PlayerAvatar name={entry.name} avatarId={entry.avatarId} size="sm" />
        <span className="grp-name">{entry.name}</span>
        {you ? <span className="grp-tag grp-tag--you">You</span> : null}
      </a>
      <span className="grp-pts">
        {entry.score}
        <small> pts</small>
      </span>
    </li>
  )
}

function gameAccent(slug: string) {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

/**
 * One of your groups: its month so far (the top three, and you), who holds
 * its records and which games have none yet, and the way in. The switch puts
 * the group on every board on the site.
 */
export function GroupCard({
  group,
  me,
  onBoards,
  onToggleBoards,
}: {
  group: GroupPublic
  me: string
  onBoards: boolean
  onToggleBoards: () => void
}) {
  const { table, records } = useGroupBoard(group.id, 'monthly')
  const you = normalizePlayerName(me)
  const entries = table?.entries ?? []
  const top = entries.slice(0, 3)
  const mine = entries.find((e) => normalizePlayerName(e.name) === you)
  const holders = records ? recordHolders(records) : []
  const open = records ? openRecords(records) : []
  const newest = records ? newestRecords(records, 1)[0] : undefined
  const set = records ? records.length - open.length : 0

  return (
    <article className="grp-card grp-gcard" style={groupStyle(group.id)} aria-labelledby={`grp-${group.id}`}>
      <div className="grp-gcard__head">
        <GroupMark group={group} />
        <div className="grp-gcard__title">
          <h2 id={`grp-${group.id}`} className="grp-gcard__name">
            <a href={groupHref(group.id)}>{group.name}</a>
          </h2>
          <p className="grp-sub">
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
            {group.ownerName ? ` · ${group.isOwner ? 'you host' : `${normalizePlayerName(group.ownerName)} hosts`}` : ''}
          </p>
        </div>
        <GroupFaces group={group} />
      </div>

      <div className="grp-gcard__body">
        <div className="grp-gcard__table">
          <p className="grp-cap">This month</p>
          {table === null ? (
            <div className="grp-wait grp-wait--rows" aria-busy="true" />
          ) : entries.length === 0 ? (
            <p className="grp-copy">Nobody in {group.name} has played this month yet. The first run takes the top.</p>
          ) : (
            <>
              <ol className="grp-mini">
                {top.map((e) => (
                  <MiniRow key={e.name} entry={e} you={normalizePlayerName(e.name) === you} />
                ))}
                {mine && !top.includes(mine) ? (
                  <>
                    <li className="grp-mini__gap" aria-hidden="true">
                      ···
                    </li>
                    <MiniRow entry={mine} you />
                  </>
                ) : null}
              </ol>
              {you ? <p className="grp-note">{youLine(entries, me, 'monthly')}</p> : null}
            </>
          )}
        </div>

        <div className="grp-gcard__records">
          <p className="grp-cap">
            The group’s records{records ? ` · ${set} of ${records.length} set` : ''}
          </p>
          {records === null ? (
            <div className="grp-wait grp-wait--chips" aria-busy="true" />
          ) : (
            <>
              {holders.length ? (
                <ul className="grp-holders">
                  {holders.slice(0, 4).map((h) => (
                    <li key={h.name} className={`grp-holder${h.name === you ? ' grp-holder--you' : ''}`}>
                      <PlayerAvatar name={h.name} avatarId={h.avatarId} size="sm" />
                      <b>{h.name === you ? 'You' : h.name}</b>
                      <span>{h.count}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {open.length ? (
                <div className="grp-open">
                  <span>Nobody’s yet:</span>
                  <span className="grp-open__games">
                    {open.map((slug) => (
                      <span key={slug} className="grp-open__game" title={gameName(slug)}>
                        <GameThumbArt slug={slug} accent={gameAccent(slug)} />
                      </span>
                    ))}
                  </span>
                </div>
              ) : null}
              {newest ? (
                <p className="grp-newest">
                  <PlayerAvatar name={newest.best.name} avatarId={newest.best.avatarId} size="sm" />
                  <span>
                    <b>{normalizePlayerName(newest.best.name)}</b> set the {gameName(newest.slug)} record,{' '}
                    {formatLeaderboardScore(newest.slug, newest.best.score)}, {whenSet(newest.best.at)}
                  </span>
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="grp-acts">
        <a className="grp-btn grp-btn--small" href={groupHref(group.id)}>
          Open {group.name}
          <ChevronIcon />
        </a>
        <button
          type="button"
          className={`grp-btn grp-btn--small ${onBoards ? 'grp-btn--on' : 'grp-btn--ghost'}`}
          aria-pressed={onBoards}
          onClick={onToggleBoards}
        >
          {onBoards ? (
            <>
              <CheckIcon />
              On the boards
            </>
          ) : (
            'Show on the boards'
          )}
        </button>
      </div>
    </article>
  )
}

/** Start a group: a name, and it exists. Signed out, the way to sign in instead. */
export function StartGroupCard({
  signedIn,
  full,
  name,
  setName,
  busy,
  error,
  onCreate,
  focusOnMount = false,
}: {
  signedIn: boolean
  full: boolean
  name: string
  setName: (v: string) => void
  busy: boolean
  error: string | null
  onCreate: (e: FormEvent) => void
  focusOnMount?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (focusOnMount) input.current?.focus()
  }, [focusOnMount])
  return (
    <section className="grp-card grp-side" aria-labelledby="grp-start" data-hunt="groups-start">
      <div className="grp-side__head">
        <span className="grp-side__mark">
          <PlusIcon />
        </span>
        <h2 id="grp-start" className="grp-h2">
          Start a group
        </h2>
      </div>
      <p className="grp-copy">
        Name it and send the link. Everyone keeps playing where they are; the group gets standings and records of its own.
      </p>
      {!signedIn ? (
        <button type="button" className="grp-btn" onClick={openSiteMenu}>
          Sign in to start one
        </button>
      ) : full ? (
        <p className="grp-copy">You’re in {GROUP_LIMIT} groups, the most there can be. Leave one to start another.</p>
      ) : (
        <form className="grp-field" onSubmit={onCreate}>
          <label className="visually-hidden" htmlFor="grp-new-name">
            Group name
          </label>
          <input
            id="grp-new-name"
            ref={input}
            value={name}
            maxLength={32}
            placeholder="Friday Night Crew"
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="grp-btn grp-btn--small" disabled={busy || name.trim().length < 2}>
            {busy ? 'Starting…' : 'Start it'}
          </button>
        </form>
      )}
      {error ? <p className="grp-error">{error}</p> : null}
      <p className="grp-fine">
        Up to {MEMBER_LIMIT} people in a group. You can be in {GROUP_LIMIT}.
      </p>
    </section>
  )
}

/** A link from a friend opens their group, even pasted here instead of followed. */
export function LinkCard({ onOpen }: { onOpen: (id: string, invite: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <section className="grp-card grp-side" aria-labelledby="grp-link" data-hunt="groups-link">
      <div className="grp-side__head">
        <span className="grp-side__mark grp-side__mark--code">
          <TicketIcon />
        </span>
        <h2 id="grp-link" className="grp-h2">
          Got an invite link?
        </h2>
      </div>
      <form
        className="grp-field"
        onSubmit={(e) => {
          e.preventDefault()
          const found = parseGroupLink(input.current?.value ?? '')
          if (!found) {
            setError('That isn’t a group’s link. It looks like …/groups/… with an invite on the end.')
            return
          }
          setError(null)
          onOpen(found.id, found.invite)
        }}
      >
        <label className="visually-hidden" htmlFor="grp-link-input">
          Invite link
        </label>
        <input
          id="grp-link-input"
          ref={input}
          placeholder="Paste it here"
          autoComplete="off"
          spellCheck={false}
          onChange={() => setError(null)}
        />
        <button type="submit" className="grp-btn grp-btn--small grp-btn--quiet">
          Open
        </button>
      </form>
      {error ? <p className="grp-error">{error}</p> : null}
      <p className="grp-fine">Following the link opens the group by itself. You need a gamer tag to join, not an account.</p>
    </section>
  )
}

const STEPS: { icon: ReactNode; title: string; copy: string }[] = [
  { icon: <UsersIcon />, title: 'Start one, send the link', copy: 'Or invite gamer tags; they get a badge in the header.' },
  {
    icon: <TableIcon />,
    title: 'Your own standings and records',
    copy: 'Every game ranks just the group and pays points by place, like the boards.',
  },
  { icon: <BookIcon />, title: 'Show it on every board', copy: 'Switch the boards to the group and the whole site counts only you lot.' },
]

export function HowGroupsWork() {
  return (
    <section className="grp-card grp-side" aria-labelledby="grp-how">
      <h2 id="grp-how" className="grp-h2">
        How groups work
      </h2>
      <ol className="grp-steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="grp-steps__n" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <b>{s.title}</b>
              <span className="grp-copy">{s.copy}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Signed out, or in no group yet: what a group is. Starting one is the card beside it. */
export function GroupsPitch() {
  return (
    <section className="grp-card grp-pitch" aria-labelledby="grp-pitch">
      <p className="grp-kick">Groups</p>
      <h2 id="grp-pitch" className="grp-pitch__title">
        Your people, on the same boards
      </h2>
      <p className="grp-pitch__lede">
        A group is the arcade with just your family, your crew or your office in it: its own standings every week and month, its
        own record on every game, and a link to send.
      </p>
      <ol className="grp-pitch__points">
        {STEPS.map((s) => (
          <li key={s.title}>
            <span className="grp-pitch__icon" aria-hidden="true">
              {s.icon}
            </span>
            <b>{s.title}</b>
            <span className="grp-copy">{s.copy}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
