import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getGame, isDailyGame } from '../data/games'
import { useFriends } from '../hooks/useFriends'
import { dailyTabHref, gamePlayHref, notificationSettingsHref } from '../hooks/useHashRoute'
import { useInboxLook, type NotificationsState } from '../hooks/useNotifications'
import { AVATAR_PINS, AVATAR_RINGS, type AvatarPin, type AvatarRing } from '../lib/avatars'
import { inkOn } from '../lib/color'
import { dailyWords } from '../lib/dailyWords'
import {
  countdown,
  formatNotificationTime,
  groupInbox,
  isClosing,
  isMatch,
  liveTitle,
  needsYou,
  type AppNotification,
} from '../lib/notifications'
import { coursePlayHref, dailyRecordHref, isCourseRecord, recordShut } from '../lib/recordBook'
import type { AvatarWear } from './AvatarStudio'
import { GameThumbGlyph } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'
import { SlidersIcon } from './chromeIcons'
import { PushToggle } from './PushToggle'
import { EventCup, HuntSetJar, MonthlyTrophyCup, SecretArt, TopTenRibbon, WeeklyMedal } from './TrophyArt'
import '../styles/inbox.css'

export type { NotificationsState }

/** What the inbox can hand back to the header: put on flair a trophy unlocked. */
export type InboxHandlers = {
  /** Leaving for a link: the header closes whatever the inbox sits in. */
  onNavigate?: () => void
  /** Absent when there's no tag to dress, so the row offers nothing. */
  onWear?: (wear: AvatarWear) => void
}

/* ------------------------------------------------------------- glyphs --- */

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

const ClockGlyph = () => (
  <Glyph>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Glyph>
)

const FriendGlyph = () => (
  <Glyph>
    <circle cx="9.5" cy="8" r="3.5" />
    <path d="M3.5 20a6 6 0 0 1 12 0M19 8v6M16 11h6" />
  </Glyph>
)

const CheckGlyph = () => (
  <Glyph>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Glyph>
)

function BellMark() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10 2.4a4.6 4.6 0 0 0-4.6 4.6v2.6L4 12.3h12l-1.4-2.7V7A4.6 4.6 0 0 0 10 2.4Z" />
      <path d="M8.2 14.2a1.9 1.9 0 0 0 3.6 0" />
    </svg>
  )
}

/* -------------------------------------------------------------- faces --- */

/** The game a row is about, in the corner of a face: its glyph on its colour, like an avatar's pin. */
function GameCorner({ slug }: { slug: string }) {
  const color = getGame(slug)?.accent ?? '#4aa8e8'
  return (
    <span className="inbox-face__corner" style={{ background: color }}>
      <svg viewBox="0 0 32 32" width="15" height="15" fill="none" aria-hidden="true" focusable="false">
        <GameThumbGlyph slug={slug} color={inkOn(color, '#10202c')} />
      </svg>
    </span>
  )
}

function TrophyTile({ trophy }: { trophy: NonNullable<AppNotification['meta']['trophy']> }) {
  const { period, rank } = trophy
  // The tile takes the trophy's colour, as the shelf's plinth does.
  if (period === 'secret') {
    return (
      <span className="inbox-face__tile inbox-face__tile--trophy trophy-tone--secret">
        <SecretArt n={trophy.n ?? 0} size="sm" />
      </span>
    )
  }
  if (period === 'hunt') {
    return (
      <span className="inbox-face__tile inbox-face__tile--trophy trophy-tone--hunt">
        <HuntSetJar size="sm" />
      </span>
    )
  }
  const tone = period === 'event' ? 'gold' : rank <= 3 ? (['gold', 'silver', 'bronze'] as const)[rank - 1] : period === 'weekly' ? 'week' : 'month'
  const art =
    period === 'event' ? (
      <EventCup size="sm" />
    ) : rank <= 3 ? (
      period === 'monthly' ? (
        <MonthlyTrophyCup tone={(['gold', 'silver', 'bronze'] as const)[rank - 1]!} size="sm" />
      ) : (
        <WeeklyMedal rank={rank} size="sm" />
      )
    ) : (
      <TopTenRibbon tone={period} rank={rank} size="sm" />
    )
  return <span className={`inbox-face__tile inbox-face__tile--trophy trophy-tone--${tone}`}>{art}</span>
}

function Face({ n, now }: { n: AppNotification; now: number }) {
  const { actor, actorAvatarId, game, trophy, place } = n.meta
  if (n.kind === 'trophy' && trophy) {
    return (
      <span className="inbox-face" aria-hidden="true">
        <TrophyTile trophy={trophy} />
      </span>
    )
  }
  if (n.kind === 'event-result') {
    return (
      <span className="inbox-face" aria-hidden="true">
        {place ? (
          <span className="inbox-face__tile inbox-face__tile--place">
            <b>{place}</b>
            <i>{ordinalSuffix(place)}</i>
          </span>
        ) : (
          <span className="inbox-face__tile inbox-face__tile--plain">
            <EventCup size="sm" />
          </span>
        )}
      </span>
    )
  }
  if (!actor) {
    return (
      <span className="inbox-face" aria-hidden="true">
        <span className="inbox-face__tile inbox-face__tile--plain">
          <BellMark />
        </span>
      </span>
    )
  }
  let corner: ReactNode = null
  if (isMatch(n)) {
    corner = (
      <span className={`inbox-face__corner inbox-face__corner--${isClosing(n, now) ? 'hot' : 'brand'}`}>
        <ClockGlyph />
      </span>
    )
  } else if (n.kind === 'friend-request' && !n.resolvedAt) {
    corner = (
      <span className="inbox-face__corner inbox-face__corner--brand">
        <FriendGlyph />
      </span>
    )
  } else if (n.kind === 'friend-request' || n.kind === 'friend-accepted') {
    corner = (
      <span className="inbox-face__corner inbox-face__corner--brand">
        <CheckGlyph />
      </span>
    )
  } else if (game) {
    corner = <GameCorner slug={game} />
  }
  return (
    <span className="inbox-face" aria-hidden="true">
      <PlayerAvatar avatarId={actorAvatarId} name={actor} size="md" />
      {corner}
    </span>
  )
}

function ordinalSuffix(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return 'th'
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
}

/* ------------------------------------------------------------ actions --- */

/** A record's page in its book, /records/<game>/<id>/…, where record-lost notes led before a daily's courses left the books. */
const RECORD_LINK = /^\/records\/[^/?#]+\/([^/?#]+)/

/** Where a record-lost note about a daily leads, whether it's a course's, and where a run can win it back. */
type DailyRecordNote = { href: string; course: boolean; winBack: string | null }

/**
 * Where a record-lost note about a daily leads: a track's, hole's or day's record to that course's row on
 * the game's past tab (lib/recordBook dailyRecordHref), never today's play, and one like Days played in a
 * row to the game's Records tab. Notes sent now lead to the course's row already, or to the game's Today
 * tab while that course is still today's (it has no past row yet: its board is the Today tab), with a play
 * link only where a run can still win it back. A Hot Lap track's is worked out as the note is read (it
 * carries meta.recordId, 'track-N'): today's play while the track is today's, ?track=N once its day has
 * passed. Older ones name the record in their meta or their link, and sent "Win it back" to today's play,
 * whatever the course. Null for any other note.
 */
function dailyRecordNote(n: AppNotification): DailyRecordNote | null {
  const game = n.meta.game
  if (n.kind !== 'record-lost' || !game || !isDailyGame(game)) return null
  const named = n.meta.recordId
  if (n.href?.startsWith(dailyTabHref(game, 'past'))) {
    // While the course is still today's it has no past row yet: its board is the Today tab.
    const stillToday =
      typeof named === 'string' && isCourseRecord({ id: named }) && dailyRecordHref(game, named) === dailyTabHref(game)
    // A Hot Lap track takes any lap, any day, worked out as the note is read: while it's today's track, today's
    // play (where the lap counts; ?track= would be an admin's unsaved test drive); once its day is gone, its own board.
    const winBack =
      game === 'hotlap' && typeof named === 'string' ? coursePlayHref(game, { id: named }) : (n.meta.playHref ?? null)
    return { href: stillToday ? dailyTabHref(game) : n.href, course: true, winBack }
  }
  const fromLink = n.href ? RECORD_LINK.exec(n.href)?.[1] : undefined
  const recordId = typeof named === 'string' ? named : fromLink ? decodeURIComponent(fromLink) : null
  if (!recordId) {
    // Nothing says which record it was: the game's past days, rather than today's play.
    const own = n.href && !n.href.startsWith(gamePlayHref(game)) ? n.href : dailyTabHref(game, 'past')
    return { href: own, course: false, winBack: null }
  }
  const href = dailyRecordHref(game, recordId) ?? dailyTabHref(game, 'records')
  if (!isCourseRecord({ id: recordId })) return { href, course: false, winBack: n.meta.playHref ?? gamePlayHref(game) }
  // A Hot Lap track takes any lap, any day. A hole's or a day's holder has their one result on it already.
  const winBack = recordShut(game, { id: recordId }, true) ? null : coursePlayHref(game, { id: recordId })
  return { href, course: true, winBack }
}

function isRing(id: string | undefined): id is AvatarRing {
  return Boolean(id && (AVATAR_RINGS as readonly string[]).includes(id))
}

function isPin(id: string | undefined): id is AvatarPin {
  return Boolean(id && (AVATAR_PINS as readonly string[]).includes(id))
}

/** A friend request answered where it's asked. */
function AnswerRequest({ requestId, notes }: { requestId: string; notes: NotificationsState }) {
  const { accept, decline, busyId } = useFriends()
  const [error, setError] = useState(false)
  const busy = busyId === requestId
  const answer = async (yes: boolean) => {
    setError(false)
    const ok = await (yes ? accept(requestId) : decline(requestId))
    if (!ok) setError(true)
    await notes.refresh()
  }
  return (
    <>
      <button type="button" className="inbox-act inbox-act--go" disabled={busy} onClick={() => void answer(true)}>
        {busy ? '…' : 'Accept'}
      </button>
      <button type="button" className="inbox-act" disabled={busy} onClick={() => void answer(false)}>
        Decline
      </button>
      {error ? <span className="inbox-row__error">That didn’t go through. Try again.</span> : null}
    </>
  )
}

function Actions({
  n,
  now,
  notes,
  onNavigate,
  onWear,
}: { n: AppNotification; now: number; notes: NotificationsState } & InboxHandlers) {
  const link = (href: string | null | undefined, label: string, main = false, hot = false) =>
    href ? (
      <a
        className={main ? `inbox-act ${hot ? 'inbox-act--hot' : 'inbox-act--go'}` : 'inbox-more'}
        href={href}
        onClick={onNavigate}
      >
        {label}
      </a>
    ) : null
  const plain = (href: string | null | undefined, label: string) =>
    href ? (
      <a className="inbox-act" href={href} onClick={onNavigate}>
        {label}
      </a>
    ) : null
  const { actor, playHref, ring, pin, requestId } = n.meta

  let out: ReactNode = null
  switch (n.kind) {
    case 'match-open':
    case 'match-closing':
      if (!needsYou(n, now)) break
      out = (
        <>
          {link(playHref ?? n.href, 'Play your run', true, isClosing(n, now))}
          {playHref ? link(n.href, 'See the draw') : null}
        </>
      )
      break
    case 'friend-request':
      if (requestId && !n.resolvedAt) out = <AnswerRequest requestId={requestId} notes={notes} />
      else if (actor) out = link(n.href, `See ${actor}’s card ›`)
      break
    case 'friend-accepted':
      if (actor) out = link(n.href, `See ${actor}’s card ›`)
      break
    case 'challenge-beaten':
      out = link(n.href, 'Take it back', true)
      break
    case 'today-beaten':
      // A lap can be driven again today; the hole and the bugs count once, so there's only today's ticket to see.
      out = playHref ? (
        <>
          {link(playHref, 'Take it back', true)}
          {link(n.href, 'See today ›')}
        </>
      ) : (
        link(n.href, 'See today ›')
      )
      break
    case 'record-lost': {
      // A daily's course is won back on that course or not at all, and seen on its row of the past tab.
      const daily = dailyRecordNote(n)
      out = daily ? (
        <>
          {plain(daily.winBack, 'Win it back')}
          {link(daily.href, daily.course ? `See the ${dailyWords(n.meta.game ?? '').course} ›` : 'See the record ›')}
        </>
      ) : (
        <>
          {plain(playHref, 'Win it back')}
          {link(n.href, 'See the record ›')}
        </>
      )
      break
    }
    case 'trophy': {
      const wear: AvatarWear | null = isRing(ring) ? { ring } : isPin(pin) ? { pin } : null
      const label =
        wear?.ring === 'laurel' ? 'Wear the laurel' : wear?.pin === 'crown' ? 'Wear the crown' : wear?.pin ? 'Wear the pin' : 'Wear the ring'
      out = (
        <>
          {wear && onWear ? (
            <button type="button" className="inbox-act" onClick={() => onWear(wear)}>
              {label}
            </button>
          ) : null}
          {link(n.href, 'See your shelf ›')}
        </>
      )
      break
    }
    case 'event-result':
      out = link(n.href, 'Final board ›')
      break
    default:
      break
  }
  return out ? <div className="inbox-row__acts">{out}</div> : null
}

/* ---------------------------------------------------------------- rows --- */

function Row({
  n,
  now,
  fresh,
  notes,
  onNavigate,
  onWear,
}: { n: AppNotification; now: number; fresh: boolean; notes: NotificationsState } & InboxHandlers) {
  const needs = needsYou(n, now)
  const hot = needs && isClosing(n, now)
  const title = liveTitle(n, now)
  const href = dailyRecordNote(n)?.href ?? n.href
  const endsAt = n.meta.endsAt
  const clock = needs && isMatch(n) && endsAt != null ? countdown(endsAt - now) : null
  const cls = ['inbox-row', needs ? 'inbox-row--needs' : '', hot ? 'inbox-row--hot' : ''].filter(Boolean).join(' ')
  return (
    <li className={cls}>
      {fresh ? <span className="inbox-row__dot" aria-hidden="true" /> : null}
      <Face n={n} now={now} />
      <div className="inbox-row__main">
        <div className="inbox-row__top">
          <p className="inbox-row__title">
            {fresh ? <span className="inbox-sr">New: </span> : null}
            {href ? (
              <a href={href} onClick={onNavigate}>
                {title}
              </a>
            ) : (
              title
            )}
          </p>
          {clock ? (
            <span className="inbox-row__clock" aria-label={`${clock} left`}>
              <ClockGlyph />
              {clock}
            </span>
          ) : (
            <time className="inbox-row__when" dateTime={new Date(n.updatedAt).toISOString()}>
              {formatNotificationTime(n.updatedAt, now)}
            </time>
          )}
        </div>
        {n.body ? <p className="inbox-row__body">{n.body}</p> : null}
        <Actions n={n} now={now} notes={notes} onNavigate={onNavigate} onWear={onWear} />
      </div>
    </li>
  )
}

/** Re-render on a beat while a clock is showing. */
function useNow(active: boolean, everyMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(id)
  }, [active, everyMs])
  return now
}

/**
 * The inbox's contents: what needs you on top, what's new since you last
 * looked, then the rest by day, and whether to be told when the phone is
 * locked. The header's panel and the phone's sheet both draw this.
 */
export function Inbox({
  notes,
  isFresh,
  onNavigate,
  onWear,
}: { notes: NotificationsState; isFresh: (n: AppNotification) => boolean } & InboxHandlers) {
  const { items, loading } = notes
  const ticking = items.some((n) => isMatch(n) && (n.meta.endsAt ?? 0) > Date.now())
  const now = useNow(ticking, 1000)
  const groups = groupInbox(items, isFresh, now)
  const section = (key: string, label: string, list: AppNotification[], hot = false) =>
    list.length ? (
      <section className="inbox__group" key={key} aria-label={label}>
        <h3 className={`inbox__cap${hot ? ' inbox__cap--hot' : ''}`}>{label}</h3>
        <ul className="inbox__list">
          {list.map((n) => (
            <Row key={n.id} n={n} now={now} fresh={isFresh(n)} notes={notes} onNavigate={onNavigate} onWear={onWear} />
          ))}
        </ul>
      </section>
    ) : null

  return (
    <>
      <div className="inbox__scroll">
        {loading && items.length === 0 ? (
          <p className="inbox__empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="inbox__empty">
            Nothing yet. Match clocks, challenges, records, trophies and friend requests show up here.
          </p>
        ) : (
          <>
            {section('needs', 'Needs you', groups.needs, true)}
            {section('new', 'New', groups.fresh)}
            {section('today', 'Today', groups.today)}
            {section('earlier', 'Earlier', groups.earlier)}
          </>
        )}
      </div>
      <PushToggle onNavigate={onNavigate} />
    </>
  )
}

/** The way to the settings page, beside the inbox's title: what tells you, and how. */
export function InboxSettingsLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <a className="inbox__settings" href={notificationSettingsHref()} onClick={onNavigate} aria-label="Notification settings" title="Notification settings">
      <SlidersIcon />
    </a>
  )
}

/**
 * The inbox, in the header.
 *
 * Opening the panel clears the badge; what was new stays marked until it
 * closes, so the player can see what came in.
 */
export function NotificationBell({ notes, onWear }: { notes: NotificationsState; onWear?: (wear: AvatarWear) => void }) {
  const [open, setOpen] = useState(false)
  const { unread } = notes
  const isFresh = useInboxLook(notes, open)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
  const freshCount = notes.items.filter(isFresh).length

  return (
    <div className="site-header__notifs" ref={wrapRef}>
      <button
        type="button"
        className={`notif-bell${unread > 0 ? ' notif-bell--alert' : ''}${open ? ' notif-bell--open' : ''}`}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
          <path
            className="notif-bell__shape"
            d="M10 2.4a4.6 4.6 0 0 0-4.6 4.6v2.6L4 12.3h12l-1.4-2.7V7A4.6 4.6 0 0 0 10 2.4Z"
          />
          <path className="notif-bell__clapper" d="M8.2 14.2a1.9 1.9 0 0 0 3.6 0" />
        </svg>
        {unread > 0 ? (
          <span className="notif-bell__count">{unread > 9 ? '9+' : unread}</span>
        ) : null}
      </button>

      {open ? (
        <div className="inbox inbox--panel" role="dialog" aria-label="Notifications">
          <header className="inbox__head">
            <h2 className="inbox__title">Notifications</h2>
            {freshCount > 0 ? <span className="inbox__new">{freshCount} new</span> : null}
            <InboxSettingsLink onNavigate={() => setOpen(false)} />
          </header>
          <Inbox
            notes={notes}
            isFresh={isFresh}
            onNavigate={() => setOpen(false)}
            onWear={
              onWear
                ? (wear) => {
                    setOpen(false)
                    onWear(wear)
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  )
}
