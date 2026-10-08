import { useState, type FormEvent, type ReactNode } from 'react'
import { useFriends } from '../hooks/useFriends'
import { useGroupBoard } from '../hooks/useGroupBoard'
import { rankHref, tournamentCreateHref } from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import type { Friend, FriendRequest } from '../lib/friends'
import {
  gameName,
  groupStyle,
  newestRecords,
  openRecords,
  recordHolders,
  whenSet,
  youLine,
} from '../lib/groupPages'
import { FRIENDS_SCOPE, friendsGroup, friendsHref, groupsIndexHref, type GroupPublic } from '../lib/groups'
import { formatBoardScore } from '../lib/leaderboardFormat'
import { ApiError, normalizePlayerName, PLAYER_NAME_MAX } from '../lib/leaderboard'
import { usesShareSheet } from '../lib/share'
import { resolveGameAccent } from '../lib/theme'
import { getGame } from '../data/games'
import { GameThumbArt } from './GameThumbArt'
import { useConfirm } from './ConfirmPanel'
import { CheckIcon, ChevronIcon, GroupFaces, MiniRow, UsersIcon } from './GroupsHome'
import { PlayerAvatar } from './PlayerAvatar'
import { absoluteShareUrl } from './ShareBoardButton'
import { useShare } from './SharePanel'
import { openSiteMenu } from './siteNav'

/*
 * Your friends, as your first group (Ramsey picked B on the "Friends redesign" canvas, 2026-10-08): the
 * Friends & groups page gives them a group's card, their page is a group's page, and the boards can show
 * just them, the way they can a group (the API's friendsBoardScope makes the scope from who you've added).
 * Adding, answering and removing live here too, where the old card at the foot of your player card had them.
 */

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

export const AddFriendIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M19 8v6" />
    <path d="M16 11h6" />
  </Icon>
)
const LinkIcon = () => (
  <Icon size={18}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </Icon>
)
const DotsIcon = () => (
  <Icon size={16}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </Icon>
)

function gameAccent(slug: string) {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

/** Just your friends' faces, newest friend first, for a card's head or the page's banner. */
function friendFaces(friends: readonly Friend[]): GroupPublic {
  const group = friendsGroup('', friends)
  return { ...group, members: [...group.members].reverse() }
}

/** Your friends' mark: two people, on a tile of their sky blue, where a group has its letter. */
export function FriendsMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`grp-mark grp-mark--${size} frd-mark`} aria-hidden="true">
      <UsersIcon />
    </span>
  )
}

/** People who've asked to be friends: yes, or not now (which says no, quietly). */
export function FriendRequests({ requests }: { requests: readonly FriendRequest[] }) {
  const { accept, decline, busyId } = useFriends()
  return (
    <ul className="frd-requests" aria-label="Friend requests">
      {requests.map((r) => {
        const busy = busyId === r.id
        return (
          <li key={r.id} className="frd-request">
            <PlayerAvatar name={r.name} size="md" />
            <span className="frd-request__text">
              <a className="grp-name" href={rankHref(r.name)}>
                {r.name}
              </a>{' '}
              wants to be friends
            </span>
            <span className="frd-request__acts">
              <button type="button" className="grp-btn grp-btn--small" disabled={busy} onClick={() => void accept(r.id)}>
                {busy ? '…' : 'Accept'}
              </button>
              <button
                type="button"
                className="grp-btn grp-btn--small grp-btn--ghost"
                disabled={busy}
                onClick={() => void decline(r.id)}
              >
                Not now
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Your friends on the Friends & groups page, first of your groups and built like one: who's ahead this
 * month among you, who holds your records, the newest of them, and the way in. Requests wait on it.
 */
export function FriendsGroupCard({ me, onBoards, onToggleBoards }: { me: string; onBoards: boolean; onToggleBoards: () => void }) {
  const { friends, incoming, loaded } = useFriends()
  const some = friends.length > 0
  const { table, records } = useGroupBoard(FRIENDS_SCOPE, 'monthly', some)
  const you = normalizePlayerName(me)
  const entries = table?.entries ?? []
  const top = entries.slice(0, 3)
  const mine = entries.find((e) => normalizePlayerName(e.name) === you)
  const holders = records ? recordHolders(records) : []
  const open = records ? openRecords(records) : []
  const newest = records ? newestRecords(records, 1)[0] : undefined
  const set = records ? records.length - open.length : 0

  return (
    <article className="grp-card grp-gcard frd-card" style={groupStyle(FRIENDS_SCOPE)} aria-labelledby="frd-card-title">
      <div className="grp-gcard__head">
        <FriendsMark />
        <div className="grp-gcard__title">
          <h2 id="frd-card-title" className="grp-gcard__name">
            <a href={friendsHref()}>Friends</a>
          </h2>
          <p className="grp-sub">
            {loaded ? count(friends.length, 'friend') : ' '}
            {incoming.length ? <b className="frd-alert"> · {count(incoming.length, 'request')}</b> : null}
          </p>
        </div>
        {some ? <GroupFaces group={friendFaces(friends)} /> : null}
      </div>

      {incoming.length ? <FriendRequests requests={incoming} /> : null}

      {!loaded ? (
        <div className="grp-wait grp-wait--rows" aria-busy="true" />
      ) : !some ? (
        <p className="grp-copy">
          Add a friend by their gamer tag, or send them your link. Then this is your own table: who’s ahead each week and
          month, and who holds each record among you.
        </p>
      ) : (
        <div className="grp-gcard__body">
          <div className="grp-gcard__table">
            <p className="grp-cap">This month</p>
            {table === null ? (
              <div className="grp-wait grp-wait--rows" aria-busy="true" />
            ) : entries.length === 0 ? (
              <p className="grp-copy">Nobody’s played this month yet. The first run takes the top.</p>
            ) : (
              <>
                <ol className="grp-mini">
                  {top.map((e) => (
                    <MiniRow key={e.name} entry={e} you={normalizePlayerName(e.name) === you} />
                  ))}
                  {mine && !top.includes(mine) ? (
                    <>
                      {/* A gap only where places are skipped: 4th follows 3rd straight on. */}
                      {mine.rank > top.length + 1 ? (
                        <li className="grp-mini__gap" aria-hidden="true">
                          ···
                        </li>
                      ) : null}
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
              Records among you{records ? ` · ${set} of ${records.length} set` : ''}
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
                      {formatBoardScore(newest.slug, newest.best.score, 'all')}, {whenSet(newest.best.at)}
                    </span>
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      <div className="grp-acts">
        <a className="grp-btn grp-btn--small" href={friendsHref()}>
          Open Friends
          <ChevronIcon />
        </a>
        {some ? (
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
        ) : null}
      </div>
    </article>
  )
}

/**
 * Adding a friend: their gamer tag, or your link for them to open (your card, with Add friend on it).
 * Signed out, the way to sign in instead.
 */
export function AddFriendCard({ me }: { me: string }) {
  const { signedIn, send } = useFriends()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const { share, copied, panel } = useShare()
  const you = normalizePlayerName(me)

  const onAdd = async (e: FormEvent) => {
    e.preventDefault()
    const name = normalizePlayerName(draft)
    if (!name || busy) return
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const result = await send(name)
      setDraft('')
      setNote(result.status === 'accepted' ? `You and ${name} are friends now.` : `Asked ${name}. They’ll see it in their menu.`)
    } catch (err) {
      if (
        (err instanceof ApiError && err.code === 'NOT_A_PLAYER') ||
        (err instanceof Error && /hasn't signed in yet/i.test(err.message))
      ) {
        setError(`Huh — ${name} doesn’t exist in this arcade`)
      } else {
        setError(err instanceof Error ? err.message : 'Could not send the request')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grp-card grp-side frd-add" style={groupStyle(FRIENDS_SCOPE)} aria-labelledby="frd-add-title">
      <div className="grp-side__head">
        <span className="grp-side__mark frd-side-mark">
          <AddFriendIcon />
        </span>
        <h2 id="frd-add-title" className="grp-h2">
          Add a friend
        </h2>
      </div>
      <p className="grp-copy">By their gamer tag, or send your link: it opens your card, with Add friend on it.</p>
      {!signedIn ? (
        <button type="button" className="grp-btn" onClick={openSiteMenu}>
          Sign in to add friends
        </button>
      ) : (
        <>
          <form className="grp-field" onSubmit={(e) => void onAdd(e)}>
            <label className="visually-hidden" htmlFor="frd-add-tag">
              Gamer tag to add
            </label>
            <input
              id="frd-add-tag"
              value={draft}
              maxLength={PLAYER_NAME_MAX}
              placeholder="Their gamer tag"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setDraft(e.target.value.toUpperCase().slice(0, PLAYER_NAME_MAX))
                setError(null)
                setNote(null)
              }}
            />
            <button type="submit" className="grp-btn grp-btn--small" disabled={busy || !normalizePlayerName(draft)}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </form>
          {error ? <p className="grp-error">{error}</p> : null}
          {note ? <p className="grp-note">{note}</p> : null}
          {you ? (
            <button
              type="button"
              className="grp-btn grp-btn--small grp-btn--ghost frd-add__link"
              onClick={() =>
                share({
                  text: `Add me on ${APP_NAME}: I’m ${you}.`,
                  url: absoluteShareUrl(rankHref(you)),
                  title: 'Send your link',
                })
              }
            >
              <LinkIcon />
              {copied ? 'Copied' : usesShareSheet() ? 'Send your link' : 'Copy your link'}
            </button>
          ) : null}
        </>
      )}
      {panel}
    </section>
  )
}

/** "Sep 17". */
function sinceDay(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Who your friends are, from the newest, each to their card, with Remove in the menu beside them; then
 * the requests you've sent, which you can take back.
 */
export function FriendsList({ onRemove }: { onRemove: (friend: Friend) => void }) {
  const { friends, outgoing, loaded, busyId, cancel } = useFriends()
  return (
    <section className="grp-card grp-side frd-list" aria-labelledby="frd-list-title">
      <div className="grp-card__head">
        <h2 id="frd-list-title" className="grp-h2">
          Your friends
        </h2>
        {loaded ? <span className="grp-sub">{friends.length}</span> : null}
      </div>
      {!loaded ? (
        <div className="grp-wait grp-wait--list" aria-busy="true" />
      ) : friends.length ? (
        <ul className="grp-members">
          {friends.map((f) => {
            const name = normalizePlayerName(f.name)
            return (
              <li key={f.accountId} className="grp-member">
                <PlayerAvatar name={name} avatarId={f.avatarId} size="md" />
                <span className="grp-member__text">
                  <span className="grp-member__name">
                    <a className="grp-name" href={rankHref(name)}>
                      {name}
                    </a>
                  </span>
                  <span className="grp-fine">Friends since {sinceDay(f.since)}</span>
                </span>
                <details className="grp-menu">
                  <summary aria-label={`${name}: remove`}>
                    <DotsIcon />
                  </summary>
                  <div className="grp-menu__pop">
                    <button
                      type="button"
                      className="grp-menu__danger"
                      disabled={busyId === f.accountId}
                      onClick={(e) => {
                        e.currentTarget.closest('details')?.removeAttribute('open')
                        onRemove(f)
                      }}
                    >
                      Remove {name}
                    </button>
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="grp-copy">Nobody yet. Add someone by their gamer tag, or send them your link.</p>
      )}
      {outgoing.length ? (
        <>
          <p className="grp-cap">Asked</p>
          <ul className="grp-members">
            {outgoing.map((r) => (
              <li key={r.id} className="grp-member frd-asked">
                <PlayerAvatar name={r.name} size="md" />
                <span className="grp-member__text">
                  <span className="grp-member__name">
                    <a className="grp-name" href={rankHref(r.name)}>
                      {r.name}
                    </a>
                  </span>
                  <span className="grp-fine">Asked {whenSet(r.createdAt)}</span>
                </span>
                <button
                  type="button"
                  className="grp-btn grp-btn--small grp-btn--quiet"
                  disabled={busyId === r.id}
                  onClick={() => void cancel(r.id)}
                >
                  {busyId === r.id ? '…' : 'Cancel'}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

/**
 * The button on someone else's player card, which knows where you two stand: Add friend; Request sent,
 * which you can take back; Accept, when they asked you; or Friends, which says since when and offers
 * Remove in the site's panel (a menu under it would be cut off by the card's edge). It used to say Add
 * friend to a friend too, and pressing it said you already were.
 */
export function FriendButton({ name }: { name: string }) {
  const { friends, incoming, outgoing, loaded, send, accept, decline, cancel, remove, busyId } = useFriends()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ask, question] = useConfirm()
  const tag = normalizePlayerName(name)
  const friend = friends.find((f) => normalizePlayerName(f.name) === tag)
  const asking = incoming.find((r) => normalizePlayerName(r.name) === tag)
  const asked = outgoing.find((r) => normalizePlayerName(r.name) === tag)

  const add = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await send(tag)
    } catch (err) {
      if (
        (err instanceof ApiError && err.code === 'NOT_A_PLAYER') ||
        (err instanceof Error && /hasn't signed in yet/i.test(err.message))
      ) {
        setError(`Huh — ${tag} doesn’t exist in this arcade`)
      } else {
        setError(err instanceof Error ? err.message : 'Could not send the request')
      }
    } finally {
      setBusy(false)
    }
  }

  const unfriend = async (f: Friend) => {
    const yes = await ask({
      title: `You and ${tag} are friends`,
      body: `Since ${sinceDay(f.since)}. Removing ${tag} takes you off each other’s friends boards; either of you can ask again any time.`,
      confirm: 'Remove friend',
      cancel: 'Keep',
      destructive: true,
    })
    if (yes) await remove(f.accountId)
  }

  // Its place while your friends load: a button's shape, so the row is as it will be.
  if (!loaded) {
    return (
      <span className="home-banner__cta skel-btn" aria-hidden="true">
        Add friend
      </span>
    )
  }

  if (friend) {
    return (
      <span className="pfh__friend">
        <button
          type="button"
          className="home-banner__ghost pfh__friends"
          disabled={busyId === friend.accountId}
          aria-label={`You and ${tag} are friends. Remove?`}
          onClick={() => void unfriend(friend)}
        >
          <CheckIcon />
          Friends
        </button>
        {question}
      </span>
    )
  }

  if (asking) {
    const waiting = busyId === asking.id
    return (
      <span className="pfh__friend pfh__friend--row">
        <button type="button" className="home-banner__cta" disabled={waiting} onClick={() => void accept(asking.id)}>
          {waiting ? '…' : `Accept ${tag}`}
        </button>
        <button type="button" className="home-banner__ghost" disabled={waiting} onClick={() => void decline(asking.id)}>
          Not now
        </button>
      </span>
    )
  }

  if (asked) {
    return (
      <span className="pfh__friend pfh__friend--row">
        <span className="home-banner__ghost pfh__sent">
          <CheckIcon />
          Request sent
        </span>
        <button type="button" className="pfh__quiet" disabled={busyId === asked.id} onClick={() => void cancel(asked.id)}>
          Cancel
        </button>
      </span>
    )
  }

  return (
    <span className="pfh__friend">
      <button
        type="button"
        className="home-banner__cta"
        disabled={busy}
        onClick={() => void add()}
        aria-label={`Add ${tag} as a friend`}
      >
        {busy ? '…' : 'Add friend'}
      </button>
      {error ? <span className="pfh__friend-error">{error}</span> : null}
    </span>
  )
}

/**
 * Your friends' page's banner, as a group's is: who they are, how the month stands among you, making an
 * event for them, and the switch that puts them on every board on the site.
 */
export function FriendsBanner({
  friends,
  loaded,
  lead,
  you,
  onBoards,
  onSetBoards,
}: {
  friends: readonly Friend[]
  loaded: boolean
  lead: string | null
  you: string | null
  onBoards: boolean
  onSetBoards: (on: boolean) => void
}) {
  const n = friends.length
  return (
    <section className="grp-banner" aria-labelledby="grp-title">
      <div className="grp-banner__bar">
        <nav className="grp-crumbs" aria-label="Breadcrumb">
          <a href={groupsIndexHref()}>Friends &amp; groups</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Friends</span>
        </nav>
      </div>
      <div className="grp-banner__main">
        <p className="grp-kick">{loaded ? `You and ${count(n, 'friend')}` : ' '}</p>
        <div className="grp-banner__name">
          <FriendsMark size="lg" />
          <h1 id="grp-title" className="grp-banner__title">
            Friends
          </h1>
          {n ? <GroupFaces group={friendFaces(friends)} shown={10} size="lg" /> : null}
        </div>
        {lead || you ? (
          <p className="grp-banner__line">
            {lead}
            {you ? <b> {you}</b> : null}
          </p>
        ) : null}
        {n ? (
          <div className="grp-acts">
            <a className="grp-btn" href={tournamentCreateHref(FRIENDS_SCOPE)}>
              Make an event with your friends
            </a>
            <span className="grp-hint">Pick the games, and {n === 1 ? 'your friend gets' : `your ${n} friends get`} the invite.</span>
          </div>
        ) : null}
      </div>
      {n ? (
        <div className="grp-banner__side">
          <p className="grp-cap">The site’s boards show</p>
          <div className="grp-seg" role="group" aria-label="What the site’s boards show">
            <button type="button" aria-pressed={!onBoards} onClick={() => onSetBoards(false)}>
              Everyone
            </button>
            <button type="button" aria-pressed={onBoards} onClick={() => onSetBoards(true)}>
              Friends
            </button>
          </div>
          <p className="grp-banner__note">
            {onBoards
              ? 'Every board, record book and rank on the site counts just you and your friends, until you switch back.'
              : `Pick Friends and every board, record book and rank on the site counts ${n === 1 ? 'just the two of you' : `just you and your ${n} friends`}.`}
          </p>
        </div>
      ) : null}
    </section>
  )
}
