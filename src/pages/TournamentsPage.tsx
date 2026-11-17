import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { BracketWinCelebration } from '../components/BracketWinCelebration'
import { EventBracket } from '../components/EventBracket'
import { eventAccent } from '../components/EventCard'
import { EventCountdown } from '../components/EventCountdown'
import {
  EventGameTiles,
  EventWinner,
  HowEventModal,
  LobbyClosedCard,
  NextEventCard,
  PlaceTable,
  StandingsEmpty,
  type GameCardState,
} from '../components/EventDetail'
import {
  ClockIcon,
  DoneList,
  EventInvites,
  EventsEmpty,
  EventsHead,
  HowEventsModal,
  LiveList,
  PeopleIcon,
} from '../components/EventsHome'
import { Panel, PanelHead } from '../components/Panel'
import { InfoIcon } from '../components/pastIcons'
import { InviteByTagForm } from '../components/InviteByTagForm'
import { ListRow, ListSplit } from '../components/ListRow'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { PushAsk } from '../components/PushAsk'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { openSiteMenu } from '../components/siteNav'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { usePageName } from '../hooks/usePageMeta'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  rankHref,
  tournamentHref,
  tournamentPlayHref,
  tournamentsHref,
  useRoute,
} from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import {
  eventDay,
  eventsLineup,
  resultLines,
  skipLesson,
  standingsTable,
  trophyField,
  trophyGiven,
} from '../lib/eventPages'
import { listEventInvites, type PublicInvite } from '../lib/invites'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import { COPIED_MS, copyToClipboard } from '../lib/share'
import {
  attemptsPerGameMax,
  bracketGameForRound,
  bracketRoundLabel,
  eventKind,
  finalBracketMatch,
  formatEventCountdown,
  getJoinedTournamentIds,
  getTournament,
  getTournamentInvite,
  hasNoEnd,
  hasPerRoundGames,
  isPlayerInTournament,
  isRosterFull,
  isUnlimitedDuration,
  joinTournament,
  listTournaments,
  lobbyClosed,
  matchOpponent,
  rememberTournamentInvite,
  seatsLeft,
  setTournamentMembersInvite,
  syncJoinedTournamentRosters,
  yourOpenMatch,
  type StandingRow,
  type TournamentDetail,
  type TournamentSummary,
  eventScoreText,
} from '../lib/tournaments'
import { eventCourseTitle } from '../lib/eventCourses'
import '../styles/evp.css'

async function fetchTournamentDetail(
  id: string,
  opts: { playerName?: string; invite?: string } = {},
): Promise<TournamentDetail> {
  const base = await getTournament(id, {
    playerName: opts.playerName,
    invite: opts.invite,
  })
  const game = base.games[0]
  if (!opts.playerName || !game) return base
  return getTournament(id, {
    playerName: opts.playerName,
    game,
    invite: opts.invite,
  })
}

function scoredStandings(
  detail: TournamentDetail,
): { row: StandingRow; score: number }[] {
  const gameSlug = detail.games[0]
  if (!gameSlug) return []
  return detail.standings
    .map((row) => ({
      row,
      score: row.byGame[gameSlug]?.score ?? null,
    }))
    .filter((entry): entry is { row: StandingRow; score: number } => entry.score != null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        normalizePlayerName(a.row.name).localeCompare(normalizePlayerName(b.row.name)),
    )
}

/** Who won, once it is over: the API's word first, else the top of the board. */
function eventWinner(detail: TournamentDetail): string | null {
  if (detail.winner) return detail.winner
  if (eventKind(detail) === 'bracket') {
    const final = finalBracketMatch(detail.bracket?.matches ?? [])
    const champ = final?.players.find((p) => p && p.id === final.winnerId)
    return champ?.name ?? null
  }
  if (detail.games.length === 1) return scoredStandings(detail)[0]?.row.name ?? null
  const top = detail.standings[0]
  if (!top) return null
  const played = top.totalPoints > 0 || detail.games.some((g) => top.byGame[g]?.score != null)
  return played ? top.name : null
}

function bracketPlayLabel(detail: TournamentDetail, joined: boolean, displayName: string) {
  if (!detail.bracket?.lockedAt) {
    return 'Locked until the bracket draws'
  }
  if (!joined) return 'Join to play'
  const match = yourOpenMatch(detail, displayName)
  if (match) {
    const opp = matchOpponent(match, displayName)
    const max = attemptsPerGameMax(detail) ?? 1
    const you = normalizePlayerName(displayName)
    const me = match.players.find((p) => p && normalizePlayerName(p.name) === you)
    const used = me?.attemptsUsed ?? 0
    const remaining = Math.max(0, max - used)
    const roundLeft =
      match.playEndsAt != null && match.playEndsAt > Date.now()
        ? formatEventCountdown(match.playEndsAt)
        : null
    if (!opp) return 'Waiting on your match'
    if (remaining === 0) {
      return roundLeft ? `Waiting on ${opp.name} · ${roundLeft}` : `Waiting on ${opp.name}`
    }
    const tries =
      remaining === 1 ? `vs ${opp.name} · 1 try` : `vs ${opp.name} · ${remaining} left`
    return roundLeft ? `${tries} · ${roundLeft}` : tries
  }
  const you = normalizePlayerName(displayName)
  const final = finalBracketMatch(detail.bracket.matches)
  if (final?.winnerId && final.players.some((p) => p && normalizePlayerName(p.name) === you && p.id === final.winnerId)) {
    return 'Champion'
  }
  if (
    detail.bracket.matches.some(
      (m) =>
        m.winnerId &&
        m.players.some((p) => p && normalizePlayerName(p.name) === you && p.id !== m.winnerId),
    )
  ) {
    return 'Eliminated'
  }
  return 'Waiting on your match'
}

function playAttemptsLabel(
  detail: TournamentDetail,
  slug: string,
  joined: boolean,
  displayName: string,
): string {
  if (eventKind(detail) === 'bracket') {
    return bracketPlayLabel(detail, joined, displayName)
  }
  const max = attemptsPerGameMax(detail)
  if (max == null) return 'Unlimited tries'
  if (!joined) return max === 1 ? '1 try' : `${max} tries`
  const youName = normalizePlayerName(displayName)
  const you = youName
    ? detail.standings.find((row) => normalizePlayerName(row.name) === youName)
    : undefined
  const used = you?.byGame[slug]?.attemptsUsed ?? 0
  const left = Math.max(0, max - used)
  if (left === 0) return 'No tries left'
  return `${left} of ${max} left`
}

/** First game the player can still put a score into. */
function nextPlayableGame(
  detail: TournamentDetail,
  joined: boolean,
  displayName: string,
): string | null {
  for (const slug of detail.games) {
    if (playAttemptsLabel(detail, slug, joined, displayName) !== 'No tries left') return slug
  }
  return null
}

/* ====================================================================== */
/* The event's banner                                                      */
/* ====================================================================== */

type HeroAction =
  | { kind: 'link'; label: string; href: string; sub?: string }
  | { kind: 'join' }
  | { kind: 'text'; label: string; sub?: string }
  | null

function heroAction(
  detail: TournamentDetail,
  joined: boolean,
  displayName: string,
  playInvite: string | undefined,
): HeroAction {
  if (detail.status === 'ended') return null
  const bracket = eventKind(detail) === 'bracket'

  if (bracket) {
    if (!detail.bracket?.lockedAt) {
      if (!joined) return { kind: 'join' }
      const left = seatsLeft(detail)
      return {
        kind: 'text',
        label: 'You’re in',
        sub:
          left != null && left > 0
            ? `The bracket draws when ${left} more ${left === 1 ? 'joins' : 'join'}`
            : 'Drawing the bracket',
      }
    }
    if (!joined) return { kind: 'text', label: 'Bracket drawn', sub: 'The roster is locked' }
    const match = yourOpenMatch(detail, displayName)
    if (match) {
      const opp = matchOpponent(match, displayName)
      const max = attemptsPerGameMax(detail) ?? 1
      const you = normalizePlayerName(displayName)
      const me = match.players.find((p) => p && normalizePlayerName(p.name) === you)
      const remaining = Math.max(0, max - (me?.attemptsUsed ?? 0))
      const roundLeft =
        match.playEndsAt != null && match.playEndsAt > Date.now()
          ? formatEventCountdown(match.playEndsAt).replace(/ left$/, '')
          : null
      if (!opp) {
        return { kind: 'text', label: 'Waiting on your match', sub: 'Your opponent is still being decided' }
      }
      if (remaining === 0) {
        return {
          kind: 'text',
          label: `Waiting on ${opp.name}`,
          sub: roundLeft ? `Round ends in ${roundLeft}` : 'Your tries are in',
        }
      }
      /*
       * The round decides the game, not the event. Sending everyone to
       * games[0] was fine while a bracket was one game the whole way through;
       * with a plan per round it would drop you into the wrong one, and the
       * server would refuse the score.
       */
      const roundGame = bracketGameForRound(detail, match.round)
      const roundGameName = getGame(roundGame)?.name ?? roundGame
      return {
        kind: 'link',
        label: `Play vs ${opp.name}`,
        href: tournamentPlayHref(detail.id, roundGame, playInvite),
        sub: [
          hasPerRoundGames(detail) ? roundGameName : null,
          remaining === 1 ? '1 try' : `${remaining} tries left`,
          roundLeft ? `round ends in ${roundLeft}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      }
    }
    return { kind: 'text', label: bracketPlayLabel(detail, true, displayName) }
  }

  if (detail.status === 'upcoming') {
    return joined ? { kind: 'text', label: 'Starts soon' } : { kind: 'join' }
  }
  const slug = nextPlayableGame(detail, joined, displayName)
  if (!slug) return { kind: 'text', label: 'No tries left', sub: 'Every attempt is in' }
  return {
    kind: 'link',
    label: `Play ${getGame(slug)?.name ?? slug}`,
    href: tournamentPlayHref(detail.id, slug, playInvite),
    sub: playAttemptsLabel(detail, slug, joined, displayName),
  }
}

/** "Semifinals": the winners-bracket round still being played, or null once the losers bracket is in play too. */
function currentRoundName(detail: TournamentDetail): string | null {
  const matches = detail.bracket?.matches ?? []
  const open = matches.filter((m) => !m.winnerId && m.players.some(Boolean))
  if (!open.length || open.some((m) => (m.bracket ?? 'wb') !== 'wb')) return null
  const maxRound = Math.max(...matches.filter((m) => (m.bracket ?? 'wb') === 'wb').map((m) => m.round))
  return bracketRoundLabel(Math.min(...open.map((m) => m.round)), maxRound)
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}
const BackIcon = () => (
  <Svg>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)
const FlagIcon = () => (
  <Svg>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Svg>
)
const RoundIcon = () => (
  <Svg>
    <path d="M3 5h5v5H3M3 14h5v5H3M8 7.5h4v9H8M12 12h6" />
  </Svg>
)
const InvitePlayerIcon = () => (
  <Svg>
    <circle cx="10" cy="8" r="3.4" />
    <path d="M3.5 20c0-3.4 2.9-5.7 6.5-5.7 1.5 0 2.9.4 4 1.1M18 13v7M14.5 16.5h7" />
  </Svg>
)
const LinkIcon = () => (
  <Svg>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
  </Svg>
)

function playersWords(n: number): string {
  return `${n} ${n === 1 ? 'player' : 'players'}`
}

/** The event in two chips: how long it has (or when it ended, or its round), and who's in. */
function EventChips({ detail }: { detail: TournamentDetail }) {
  const bracket = eventKind(detail) === 'bracket'
  const cap = detail.rules.maxPlayers
  const chips: { key: string; icon: ReactNode; text: ReactNode }[] = []
  if (lobbyClosed(detail)) {
    chips.push({ key: 'end', icon: <FlagIcon />, text: 'Didn’t fill' })
    chips.push({ key: 'who', icon: <PeopleIcon />, text: cap ? `${detail.playerCount} of ${cap} joined` : playersWords(detail.playerCount) })
  } else if (detail.status === 'ended') {
    // The day it ended, on the arcade's clock: eventDay reads a start, so it's handed the last minute.
    chips.push({ key: 'end', icon: <FlagIcon />, text: `Ended ${eventDay({ startsAt: detail.endsAt - 60_000 })}` })
    chips.push({ key: 'who', icon: <PeopleIcon />, text: detail.playerCount ? playersWords(detail.playerCount) : 'Nobody played' })
  } else if (bracket && (detail.status === 'upcoming' || !detail.bracket?.lockedAt)) {
    // Until the last seat fills there is no draw, only seats, and a week for them to fill (the API closes it then).
    chips.push({ key: 'who', icon: <PeopleIcon />, text: cap ? `${detail.playerCount} of ${cap} in` : playersWords(detail.playerCount) })
    if (detail.lobbyClosesAt != null && seatsLeft(detail)) {
      chips.push({ key: 'clock', icon: <ClockIcon />, text: <EventCountdown endsAt={detail.lobbyClosesAt} /> })
    }
  } else if (bracket) {
    chips.push({ key: 'round', icon: <RoundIcon />, text: currentRoundName(detail) ?? 'Now playing' })
    if (detail.nextDeadlineAt) chips.push({ key: 'clock', icon: <ClockIcon />, text: <EventCountdown endsAt={detail.nextDeadlineAt} /> })
  } else {
    chips.push({
      key: 'clock',
      icon: <ClockIcon />,
      text:
        detail.status === 'upcoming' ? (
          `Starts in ${formatEventCountdown(detail.startsAt).replace(/ left$/, '')}`
        ) : isUnlimitedDuration(detail.rules) ? (
          'Until everyone finishes'
        ) : (
          <EventCountdown endsAt={detail.endsAt} />
        ),
    })
    chips.push({ key: 'who', icon: <PeopleIcon />, text: detail.playerCount ? playersWords(detail.playerCount) : 'Nobody in yet' })
  }
  return (
    <ul className="evx-chips" aria-label="About this event">
      {chips.map((c) => (
        <li key={c.key} className="evx-chip">
          {c.icon}
          {c.text}
        </li>
      ))}
    </ul>
  )
}

/** The heading: back to Events, the event's name, its ⓘ, Share, and Invite for whoever may invite. */
function EventHead({
  detail,
  shareUrl,
  onHow,
  onInvite,
}: {
  detail: TournamentDetail
  /** Null where a shared link would let nobody in. */
  shareUrl: string | null
  onHow: () => void
  onInvite: (() => void) | null
}) {
  return (
    <div className="evx-top">
      <a className="evx-back" href={tournamentsHref()}>
        <BackIcon />
        Events
      </a>
      <div className="evh-head evx-head">
        <h1 id="evp-event-title" className="evh-title">
          {detail.title}
        </h1>
        <button type="button" className="evh-info" aria-label="How it works" onClick={onHow}>
          <InfoIcon />
        </button>
        {shareUrl ? (
          <ShareBoardButton
            className="evx-share"
            label={`You're invited: ${detail.title} on ${APP_NAME}. Don't ghost the lobby.`}
            url={shareUrl}
          />
        ) : null}
        {onInvite ? (
          <button type="button" className="evp-btn evp-btn--ghost evx-invite" aria-label="Invite players" onClick={onInvite}>
            <InvitePlayerIcon />
            <span className="evx-invite__word">Invite</span>
          </button>
        ) : null}
      </div>
      <EventChips detail={detail} />
    </div>
  )
}

/**
 * What's yours to do that the games' tiles don't say: join, Play a bracket's match, a bracket's word on where
 * you are, or why you can't. A scores event's Play is its tiles (EventGameTiles), and its place your row.
 */
function EventActions({
  detail,
  joined,
  displayName,
  playInvite,
  eventFull,
  busy,
  joinNote,
  onJoin,
  justJoined,
}: {
  detail: TournamentDetail
  joined: boolean
  displayName: string
  playInvite?: string
  eventFull: boolean
  busy: boolean
  joinNote: string | null
  onJoin: () => void
  /** Joined with the button just now: a bracket's matches run on a clock, so alerts are offered. */
  justJoined: boolean
}) {
  if (detail.status === 'ended') return null
  const bracket = eventKind(detail) === 'bracket'
  const action = heroAction(detail, joined, displayName, playInvite)
  const link = bracket && action?.kind === 'link' ? action : null
  const text = bracket && action?.kind === 'text' ? action : null
  const full = !joined && eventFull
  // A bracket takes a seat to play; a scores event can be played straight from a tile, so joining is the lesser button there.
  const join = !joined && !full && Boolean(displayName) && (action?.kind === 'join' || !bracket)
  const needsTag = !joined && !displayName
  // Before the draw the bracket's own card says how many it waits for; the row needn't say it again.
  const sub = link?.sub ?? (detail.bracket?.lockedAt ? text?.sub : null) ?? null
  const alerts = bracket && joined && justJoined
  if (!link && !text && !join && !full && !needsTag && !joinNote && !alerts) return null
  const joinLabel = `Join${detail.cadence === 'weekly' ? ' the Triple' : ''} as ${displayName}`
  return (
    <div className="evx-acts">
      {link ? (
        <a className="evp-btn evp-btn--big" href={link.href}>
          {link.label}
        </a>
      ) : null}
      {text ? <span className="evx-state">{text.label}</span> : null}
      {join ? (
        <button
          type="button"
          className={`evp-btn${action?.kind === 'join' ? ' evp-btn--big' : ' evp-btn--ghost'}`}
          disabled={busy}
          onClick={onJoin}
        >
          {busy ? 'Joining…' : joinLabel}
        </button>
      ) : null}
      {full ? <span className="evx-state">This event is full</span> : null}
      {needsTag ? (
        <button type="button" className="evp-btn evp-btn--big" onClick={openSiteMenu}>
          Pick a gamer tag to join
        </button>
      ) : null}
      {sub ? <span className="evx-hint">{sub}</span> : null}
      {joinNote ? <span className="evx-hint evx-hint--error">{joinNote}</span> : null}
      {alerts ? <PushAsk reason="match" className="push-ask--in-banner" /> : null}
    </div>
  )
}

/**
 * Invite players, from the heading's Invite: by tag, by link, who's still to answer, and for the host, who may
 * invite. A Panel is drawn outside the page, so it carries the event's colours itself.
 */
function InviteSheet({
  detail,
  busy,
  note,
  copied,
  onCopy,
  onMembersInvite,
  onClose,
  style,
}: {
  detail: TournamentDetail
  busy: boolean
  /** Why the last change didn't take. */
  note: string | null
  copied: boolean
  onCopy: () => void
  onMembersInvite: (on: boolean) => void
  onClose: () => void
  style: CSSProperties
}) {
  const titleId = useId()
  const left = seatsLeft(detail)
  return (
    <Panel
      labelledBy={titleId}
      onClose={onClose}
      scrimCloses={false}
      // The older invite pieces (events.css .inv, .ev-people) read these, which .evp sets on the page.
      style={
        {
          ...style,
          '--ev-pad': '0rem',
          '--ev-line': 'rgba(var(--ink-rgb), 0.09)',
          '--ev-card': 'var(--surface)',
          '--ev-radius': '1.2rem',
        } as CSSProperties
      }
      className="evx-sheet"
    >
      <PanelHead
        titleId={titleId}
        title="Invite players"
        kicker={left != null ? `${left} ${left === 1 ? 'seat' : 'seats'} left` : undefined}
        icon={<InvitePlayerIcon />}
        onClose={onClose}
      />
      <div className="panel__body">
        <InviteByTagForm kind="tournament" targetId={detail.id} disabled={busy} excludeNames={detail.players.map((p) => p.name)} />
        <button type="button" className="evp-btn evp-btn--ghost evx-copy" onClick={onCopy}>
          <LinkIcon />
          {copied ? 'Copied' : 'Copy invite link'}
        </button>
        <SentInvites tournamentId={detail.id} roster={detail.playerCount} />
        {detail.isHost ? (
          <div className="evp-who-invites">
            <span className="evp-cap">Who can invite</span>
            <div className="site-seg" role="group" aria-label="Who can invite">
              <button type="button" aria-pressed={!detail.membersInvite} disabled={busy} onClick={() => onMembersInvite(false)}>
                Just me
              </button>
              <button type="button" aria-pressed={Boolean(detail.membersInvite)} disabled={busy} onClick={() => onMembersInvite(true)}>
                Everyone in it
              </button>
            </div>
          </div>
        ) : (
          <p className="evp-who-invites__note">The host has let everyone in the event invite.</p>
        )}
        {note ? <p className="evx-hint evx-hint--error">{note}</p> : null}
      </div>
      <div className="panel__actions">
        <button type="button" className="panel__btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Panel>
  )
}


/* ====================================================================== */
/* Invites and roster                                                      */
/* ====================================================================== */

/**
 * Who the host has invited and not heard back from.
 *
 * Sending an invite used to leave no trace the host could see, so there was no
 * telling a name you had already chased from one you never got round to —
 * particularly once a few had gone out over a few days. Joined and expired
 * invites drop off, so what is left is exactly who you are still waiting on.
 */
function SentInvites({ tournamentId, roster }: { tournamentId: string; roster: number }) {
  const [invites, setInvites] = useState<PublicInvite[]>([])

  useEffect(() => {
    let cancelled = false
    listEventInvites(tournamentId)
      .then((rows) => {
        if (!cancelled) setInvites(rows)
      })
      .catch(() => {
        if (!cancelled) setInvites([])
      })
    return () => {
      cancelled = true
    }
    // Roster changes mean someone accepted — their invite should drop off.
  }, [tournamentId, roster])

  if (!invites.length) return null

  return (
    <div className="ev-people ev-people--divided">
      <p className="ev-people__title">
        Waiting on {invites.length} {invites.length === 1 ? 'invite' : 'invites'}
      </p>
      <ul className="ev-people__list">
        {invites.map((invite) => (
          <li key={invite.id} className="ev-people__row ev-people__row--pending">
            <span className="pmark" aria-hidden="true">
              <PlayerAvatar name={invite.toName} avatarId={invite.toAvatarId} size="sm" />
            </span>
            <span className="ev-people__name">{invite.toName}</span>
            <span className="ev-people__note">{inviteAge(invite.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Who has taken a seat so far.
 *
 * A bracket keeps its draw hidden until the roster fills, so until then the
 * page was a wall of TBD: no way to tell whether the people you invited had
 * actually turned up. The seats were never the secret — only the pairings
 * are — so they are worth showing, open ones included.
 */
function EventRoster({ detail, displayName }: { detail: TournamentDetail; displayName: string }) {
  const you = normalizePlayerName(displayName)
  const seated = [...detail.players].sort((a, b) => a.joinedAt - b.joinedAt)
  // Over (a bracket's lobby closes unfilled a week on), there are no seats left to take.
  const open = detail.status === 'ended' ? 0 : (seatsLeft(detail) ?? 0)
  const cap = detail.rules.maxPlayers

  return (
    <section className="ev-card evp-side-card" aria-label="Who's in">
      <div className="ev-card__head">
        <h2 className="ev-card__title">Who's in</h2>
        <p className="ev-card__note">
          {cap && cap > 0
            ? `${seated.length} of ${cap} seats`
            : `${seated.length} ${seated.length === 1 ? 'player' : 'players'}`}
        </p>
      </div>
      <div className="ev-people">
        <ul className="ev-people__list">
          {seated.map((p) => (
            <li key={p.id} className="ev-people__row">
              <span className="pmark" aria-hidden="true">
                <PlayerAvatar name={p.name} avatarId={p.avatarId} size="sm" />
              </span>
              <span className="ev-people__name">{p.name}</span>
              {normalizePlayerName(p.name) === you ? (
                <span className="ev-people__tag">{detail.isHost ? 'You · host' : 'You'}</span>
              ) : null}
            </li>
          ))}
          {/* Open seats, so the wait has a shape rather than just a number. */}
          {Array.from({ length: open }, (_, i) => (
            <li key={`open-${i}`} className="ev-people__row ev-people__row--open">
              <span className="ev-people__seat" aria-hidden="true" />
              <span className="ev-people__name">Open seat</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** "2h ago" / "3d ago" — enough to tell a fresh invite from a stale one. */
function inviteAge(at: number): string {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/* ====================================================================== */
/* Standings                                                               */
/* ====================================================================== */

/** A one-game event's board: its scores, best first. */
function SingleStandings({ detail, displayName }: { detail: TournamentDetail; displayName: string }) {
  const ended = detail.status === 'ended'
  const youName = normalizePlayerName(displayName)
  // A player's card opens at the period you picked.
  const period = useDefaultPeriod()
  const rows = useMemo(
    () => scoredStandings(detail).map((entry, index) => ({ ...entry, rank: entry.row.place ?? index + 1 })),
    [detail],
  )
  const game = detail.games[0]
  const count = (game ? detail.fieldByGame?.[game] : undefined) ?? rows.length
  // The unbroken run from first: every row on a small event's page, the top hundred on a big one's.
  const top = rows.filter((entry, index) => entry.rank === index + 1)
  const mine = youName ? rows.find((entry) => normalizePlayerName(entry.row.name) === youName) : undefined
  const pinned = mine && !top.includes(mine) ? mine : null
  const below = count - top.length - (pinned ? 1 : 0)
  const item = ({ row, score, rank }: (typeof rows)[number], pin = false) => {
    const name = normalizePlayerName(row.name)
    return (
      <ListRow
        key={`${row.playerId}${pin ? '-pin' : ''}`}
        rank={rank}
        name={name}
        href={rankHref(name, period)}
        avatarId={row.avatarId}
        score={eventScoreText(detail.games, score)}
        mine={Boolean(youName) && name === youName}
        pinned={pin}
      />
    )
  }
  return (
    <section className="evh-section" aria-labelledby="evx-standings">
      <h2 id="evx-standings" className="evh-label">
        {ended ? 'Final' : 'Standings'} <span className="evh-count">{count.toLocaleString()}</span>
      </h2>
      <div className="evp-card evx-single">
        <ol className="lst">
          {pinned ? (
            <>
              {item(pinned, true)}
              <ListSplit>Top {top.length}</ListSplit>
            </>
          ) : null}
          {top.map((entry) => item(entry))}
        </ol>
        {below > 0 ? <p className="evx-below">+{below.toLocaleString()} more</p> : null}
      </div>
    </section>
  )
}

/* ====================================================================== */
/* List page                                                               */
/* ====================================================================== */

/** When a live event next wants something: a bracket's round, else its end; one still filling or yet to start goes last. */
function liveOrder(t: TournamentSummary): number {
  if (t.status === 'upcoming') return Number.MAX_SAFE_INTEGER
  if (eventKind(t) === 'bracket' && t.nextDeadlineAt != null && t.nextDeadlineAt > 0) return t.nextDeadlineAt
  return hasNoEnd(t) ? Number.MAX_SAFE_INTEGER - 1 : t.endsAt
}

/**
 * The events page, as one list (EventsHome.tsx): the heading with its ⓘ and New event, invites, what's live
 * (the arcade's own events while they run, then yours), and what's done. With nothing live, a card to make one.
 */
export function TournamentsPage() {
  const { account, signedOut } = useAuth()
  const playerName = usePlayerName()
  const me = normalizePlayerName(playerName || getLastPlayerName())
  const [items, setItems] = useState<TournamentSummary[]>([])
  const [mine, setMine] = useState<TournamentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [how, setHow] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      listTournaments('all', me || undefined),
      me ? listTournaments('joined', me).catch(() => [] as TournamentSummary[]) : Promise.resolve([] as TournamentSummary[]),
      account ? listTournaments('mine', me || undefined).catch(() => [] as TournamentSummary[]) : Promise.resolve([] as TournamentSummary[]),
    ])
      .then(([all, joined, hosted]) => {
        if (cancelled) return
        setItems(all)
        const own = new Map<string, TournamentSummary>()
        for (const t of [...hosted, ...joined]) if (!t.official) own.set(t.id, t)
        setMine([...own.values()].sort((a, b) => Number(a.status === 'ended') - Number(b.status === 'ended') || b.startsAt - a.startsAt))
        setError(null)
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
  }, [me, account])

  const lineup = useMemo(() => eventsLineup(items), [items])
  // The arcade's own events are listed only while they run (the API's siteEvents.ts): none listed, they're paused.
  const siteEvents = items.some((t) => t.official)

  // Server roster membership first; local join memory / score place as fallback.
  const joinedIds = new Set(getJoinedTournamentIds())
  const isJoined = (t: TournamentSummary) =>
    Boolean(t.joined) || joinedIds.has(t.id) || t.yourPlace != null
  const linkFor = (t: TournamentSummary) =>
    tournamentHref(t.id, t.private ? (getTournamentInvite(t.id) ?? undefined) : undefined)
  const results = resultLines(
    [...lineup.ended, ...mine.filter((t) => t.status === 'ended' && !lineup.ended.some((e) => e.id === t.id))].sort(
      (a, b) => b.endsAt - a.endsAt,
    ),
  )
  // The arcade's own first while they run, then the rest, each once, soonest due first.
  const live = [
    ...new Map(
      [lineup.weekly, lineup.daily, lineup.oneShot, ...lineup.others, ...mine.filter((t) => t.status !== 'ended')]
        .filter((t): t is TournamentSummary => t != null)
        .map((t) => [t.id, t]),
    ).values(),
  ].sort((a, b) => Number(b.official) - Number(a.official) || liveOrder(a) - liveOrder(b))

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="evp evh">
        <EventsHead signedOut={signedOut} onHow={() => setHow(true)} />
        {loading ? (
          <div className="evp-card evh-skel" aria-busy="true" aria-label="Loading events">
            <span />
            <span />
            <span />
          </div>
        ) : error ? (
          <p className="lb-empty">Couldn’t load events. Check your connection and try again.</p>
        ) : (
          <>
            <EventInvites />
            {live.length > 0 ? (
              <LiveList events={live} me={me} isJoined={isJoined} linkFor={linkFor} />
            ) : (
              <EventsEmpty signedOut={signedOut} />
            )}
            {results.length > 0 ? <DoneList lines={results} me={me} linkFor={linkFor} /> : null}
          </>
        )}
        {how ? <HowEventsModal siteEvents={siteEvents} onClose={() => setHow(false)} /> : null}
      </div>
    </PageShell>
  )
}

/* ====================================================================== */
/* Event page                                                              */
/* ====================================================================== */

/** The event page before it has an event to show: a gate, a not-found, a wait. */
function PlainHeader({
  title,
  crumb = title,
  blurb,
  actions,
}: {
  title: string
  /** The breadcrumb's last step, when the title is a sentence. */
  crumb?: string
  blurb?: ReactNode
  actions?: ReactNode
}) {
  return (
    <PageBanner
      size="compact"
      crumbs={[{ href: tournamentsHref(), label: 'Events' }, { label: crumb }]}
      kicker="Events"
      title={title}
      blurb={blurb}
      actions={actions}
    />
  )
}

export function TournamentDetailPage({ id, invite }: { id: string; invite?: string }) {
  const route = useRoute()
  const playerName = usePlayerName()
  const { account, loading: authLoading } = useAuth()
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  /** Why there's no event to show: none at this address (a 404), or the API wasn't reached. Said in the site's words. */
  const [error, setError] = useState<'missing' | 'failed' | null>(null)
  /** Try again, after a load that failed. */
  const [attempt, setAttempt] = useState(0)
  const [needsInvite, setNeedsInvite] = useState(false)
  const [inviteDraft, setInviteDraft] = useState(invite ?? '')
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  /** Joined with the button just now: the moment to offer alerts for a bracket's matches. */
  const [justJoined, setJustJoined] = useState(false)
  const [joinNote, setJoinNote] = useState<string | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [previous, setPrevious] = useState<TournamentDetail | null>(null)
  /** The ⓘ's How it works, and the heading's Invite sheet. */
  const [how, setHow] = useState(false)
  const [inviting, setInviting] = useState(false)

  const displayName = normalizePlayerName(playerName)
  // The tab says which event, once it's here (and only this one: another's stays up while this one loads).
  usePageName(detail?.id === id ? detail.title : null)
  const storedInvite = invite ?? getTournamentInvite(id) ?? undefined
  const playInvite = detail?.inviteCode ?? storedInvite
  const rosterCap = detail?.rules.maxPlayers ?? 0
  const eventFull =
    detail != null && rosterCap > 0 && detail.playerCount >= rosterCap && !joined
  const invitesOpen =
    detail != null &&
    detail.status !== 'ended' &&
    !isRosterFull(detail) &&
    Boolean(detail.inviteCode)
  // The official line: what is on now (for a finished event's "next"), and last week's (for a running weekly's lesson).
  const live = useLiveEvents(displayName)

  const syncJoined = (data: TournamentDetail, who: string) => {
    setJoined(isPlayerInTournament(data, who, id))
  }

  const loadDetail = async (inviteCode?: string) => {
    await syncJoinedTournamentRosters()
    const name = getLastPlayerName()
    const data = await fetchTournamentDetail(id, {
      playerName: name || undefined,
      invite: inviteCode ?? storedInvite,
    })
    setDetail(data)
    syncJoined(data, name)
    setNeedsInvite(false)
    setError(null)
    if (data.inviteCode) rememberTournamentInvite(id, data.inviteCode)
  }

  useEffect(() => {
    if (route.name !== 'tournament') return
    if (route.id !== id) return
    if (invite) rememberTournamentInvite(id, invite)
    let cancelled = false
    setLoading(true)
    setError(null)
    setNeedsInvite(false)
    ;(async () => {
      try {
        await loadDetail(invite ?? storedInvite)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'INVITE_REQUIRED') {
          setNeedsInvite(true)
          setError(null)
        } else {
          setError(err instanceof ApiError && err.status === 404 ? 'missing' : 'failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, invite, route, attempt])

  /*
   * Signing in, out or as someone else changes what this page may show: the
   * host's tools, the invite code, your seat. Read it again for whoever is here
   * now, in place, so nobody else's view lingers.
   */
  const viewer = authLoading ? null : `${account?.id ?? ''}|${displayName}`
  const lastViewer = useRef<string | null>(null)
  useEffect(() => {
    if (viewer == null) return
    const before = lastViewer.current
    lastViewer.current = viewer
    if (before == null || before === viewer) return
    let cancelled = false
    loadDetail(storedInvite).catch((err: unknown) => {
      if (cancelled) return
      if (err instanceof ApiError && err.code === 'INVITE_REQUIRED') {
        setDetail(null)
        setNeedsInvite(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [viewer])

  useEffect(() => {
    if (!detail) return
    const mine = normalizePlayerName(playerName)
    if (mine && isPlayerInTournament(detail, mine, id)) {
      if (!detail.players.some((p) => normalizePlayerName(p.name) === mine)) {
        void joinTournament(id, mine)
          .then(async () => {
            const data = await fetchTournamentDetail(id, {
              playerName: mine,
              invite: playInvite,
            })
            setDetail(data)
            setJoined(true)
          })
          .catch(() => setJoined(true))
        return
      }
      setJoined(true)
      return
    }
    syncJoined(detail, playerName)
  }, [playerName, detail, id])

  // A weekly still running learns from the last one: who won, and who skipped a game.
  const previousId =
    detail && detail.status !== 'ended' && detail.cadence === 'weekly' && live.lastWeekly && live.lastWeekly.id !== detail.id
      ? live.lastWeekly.id
      : null
  useEffect(() => {
    if (!previousId) return
    let cancelled = false
    getTournament(previousId)
      .then((d) => {
        if (!cancelled) setPrevious(d)
      })
      .catch(() => {
        /* the scoring card reads fine without it */
      })
    return () => {
      cancelled = true
    }
  }, [previousId])

  const onJoin = async () => {
    if (busy || !displayName) return
    setBusy(true)
    setJoinNote(null)
    try {
      await joinTournament(id, displayName)
      const data = await fetchTournamentDetail(id, {
        playerName: displayName,
        invite: playInvite,
      })
      setDetail(data)
      setJoined(true)
      setJustJoined(true)
      setJoinNote(null)
    } catch (err) {
      setJoinNote(err instanceof Error ? err.message : 'Could not join')
    } finally {
      setBusy(false)
    }
  }

  const accent = detail ? eventAccent(detail.games) : '#2eb8a0'

  const inviteLink =
    detail?.inviteCode != null
      ? `${window.location.origin}${tournamentHref(id, detail.inviteCode)}`
      : playInvite
        ? `${window.location.origin}${tournamentHref(id, playInvite)}`
        : null

  const copyInviteLink = async () => {
    if (!inviteLink || !(await copyToClipboard(inviteLink))) return
    setCopiedInvite(true)
    window.setTimeout(() => setCopiedInvite(false), COPIED_MS)
  }

  /** The host lets everyone in the event invite, or keeps it to themselves. */
  const onMembersInvite = async (on: boolean) => {
    if (busy) return
    setBusy(true)
    setJoinNote(null)
    try {
      await setTournamentMembersInvite(id, on)
      await loadDetail()
    } catch (err) {
      setJoinNote(err instanceof Error ? err.message : 'Couldn’t change who can invite')
    } finally {
      setBusy(false)
    }
  }

  const submitInvite = async () => {
    const code = inviteDraft.trim().toUpperCase()
    if (!code) return
    rememberTournamentInvite(id, code)
    setBusy(true)
    setJoinNote(null)
    try {
      await loadDetail(code)
      window.history.replaceState(null, '', tournamentHref(id, code))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVITE_REQUIRED') {
        setJoinNote('That invite code is not valid.')
      } else {
        setJoinNote(err instanceof Error ? err.message : 'Could not open event')
      }
    } finally {
      setBusy(false)
    }
  }

  let body: ReactNode = null
  if (detail) {
    const bracket = eventKind(detail) === 'bracket'
    const ended = detail.status === 'ended'
    const multi = detail.games.length > 1
    const rows = bracket || !multi ? [] : standingsTable(detail, displayName)
    const singleCount = bracket || multi ? 0 : scoredStandings(detail).length
    const max = attemptsPerGameMax(detail)
    const youRow = joined ? detail.standings.find((row) => normalizePlayerName(row.name) === displayName) : undefined
    const games: GameCardState[] =
      bracket || ended
        ? []
        : detail.games.map((slug) => {
            const status =
              detail.status === 'upcoming' ? 'Not started yet' : playAttemptsLabel(detail, slug, joined, displayName)
            const locked = detail.status === 'upcoming' || (joined && status === 'No tries left')
            const course = detail.course != null ? eventCourseTitle(slug, detail.course) : undefined
            const left = max == null ? null : Math.max(0, max - (youRow?.byGame[slug]?.attemptsUsed ?? 0))
            return { slug, href: locked ? null : tournamentPlayHref(detail.id, slug, playInvite), status, course, max, left }
          })
    const lesson = ended ? skipLesson(detail) : previous ? skipLesson(previous) : null
    const next = ended
      ? (live.official.find((t) => t.id !== detail.id && t.cadence != null && t.cadence === detail.cadence) ?? null)
      : null
    // The host, and every player once the host has let them; the API sends the code to just those.
    const canInvite = invitesOpen && Boolean(detail.isHost || detail.canInvite)
    /*
     * Who can hand the event out. Anyone, for an open event. A private one only
     * lets in someone holding its code: from anyone without it, a share was an
     * invite that ended at "enter the code from your host".
     */
    const shareUrl = !detail.private
      ? `${window.location.origin}${tournamentHref(detail.id)}`
      : canInvite && inviteLink
        ? inviteLink
        : null
    const filling = bracket && !detail.bracket?.lockedAt

    // Who won, once it's over: their score when a score decided it (an all-round win and a bracket's are the name).
    const winnerName = ended && !lobbyClosed(detail) ? eventWinner(detail) : null
    let winner: ReactNode = null
    if (winnerName) {
      const single = detail.games.length === 1 && !bracket ? scoredStandings(detail)[0] : null
      const top = rows[0]
      const allRound = detail.format === 'place-points' && !single
      const total = bracket ? null : single ? single.score : top && !allRound ? top.total : null
      const name = normalizePlayerName(winnerName)
      const avatarId =
        single?.row.avatarId ?? top?.avatarId ?? detail.players.find((p) => normalizePlayerName(p.name) === name)?.avatarId
      winner = (
        <EventWinner
          winner={name}
          avatarId={avatarId}
          score={total == null ? null : eventScoreText(detail.games, total)}
          mine={name === normalizePlayerName(displayName)}
          trophy={trophyGiven(detail)}
          trophyAt={trophyField(detail)}
        />
      )
    }
    const accentStyle = {
      '--e': accent,
      '--e-ink': inkOn(accent),
      '--event-accent': accent,
      '--event-ink': inkOn(accent),
      '--board-accent': accent,
      '--tile-accent': accent,
      '--thumb-accent': accent,
    } as CSSProperties

    body = (
      <div className="evp evp--event evh evx" style={accentStyle}>
        <EventHead
          detail={detail}
          shareUrl={shareUrl}
          onHow={() => setHow(true)}
          onInvite={canInvite ? () => setInviting(true) : null}
        />
        <EventActions
          detail={detail}
          joined={joined}
          displayName={displayName}
          playInvite={playInvite}
          eventFull={eventFull}
          busy={busy}
          joinNote={joinNote}
          onJoin={() => void onJoin()}
          justJoined={justJoined}
        />
        {winner}
        {games.length ? <EventGameTiles games={games} /> : null}
        {/* A bracket keeps its own drawing (Ramsey, 2026-11-17: "i don't want brackets to really change"). */}
        {bracket && lobbyClosed(detail) ? (
          <LobbyClosedCard detail={detail} />
        ) : bracket ? (
          <EventBracket detail={detail} displayName={displayName} className="ev-card ev-card--bracket" />
        ) : multi ? (
          rows.length ? (
            <PlaceTable detail={detail} rows={rows} limit={ended ? 10 : 25} />
          ) : (
            <StandingsEmpty detail={detail} />
          )
        ) : singleCount ? (
          <SingleStandings detail={detail} displayName={displayName} />
        ) : (
          <StandingsEmpty detail={detail} />
        )}
        {filling ? <EventRoster detail={detail} displayName={displayName} /> : null}
        {/*
         * The win moment, a portal shown once per win: a bracket's as its
         * matches are won, any other event's once it has a winner, so
         * nobody "wins" an event that ended with no runs in it.
         */}
        {bracket || eventWinner(detail) ? <BracketWinCelebration detail={detail} displayName={displayName} /> : null}
        {next ? <NextEventCard t={next} /> : null}
        {how ? <HowEventModal detail={detail} lesson={lesson} me={displayName} onClose={() => setHow(false)} /> : null}
        {inviting && canInvite ? (
          <InviteSheet
            detail={detail}
            busy={busy}
            note={joinNote}
            copied={copiedInvite}
            onCopy={() => void copyInviteLink()}
            onMembersInvite={(on) => void onMembersInvite(on)}
            onClose={() => setInviting(false)}
            style={accentStyle}
          />
        ) : null}
      </div>
    )
  }

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      {loading ? (
        <div className="evp evh evx" aria-busy="true" aria-label="Loading the event">
          <span className="evx-skel-title" />
          <div className="evp-card evh-skel">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : needsInvite ? (
        <>
          <PlainHeader title="Private event" />
          <div className="event-invite-gate">
            <p className="event-invite-gate__lead">
              This event is invite-only. Enter the code from your host to join.
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
            {joinNote ? <p className="event-create__error">{joinNote}</p> : null}
            <button
              type="button"
              className="lb-play event-create__submit"
              disabled={busy || !inviteDraft.trim()}
              onClick={() => void submitInvite()}
            >
              {busy ? 'Checking…' : 'Open event'}
            </button>
          </div>
        </>
      ) : error || !detail ? (
        // The site's own words, never the API's: no event at this address, or none reached. Either way, a way on.
        error === 'missing' ? (
          <PlainHeader
            title="This event isn’t here"
            crumb="Not found"
            blurb="It may be an old link, or one missing a letter."
            actions={
              <a className="home-banner__cta" href={tournamentsHref()}>
                See events
              </a>
            }
          />
        ) : (
          <PlainHeader
            title="Couldn’t open this event"
            crumb="Event"
            blurb="Check your connection and try again."
            actions={
              <>
                <button type="button" className="home-banner__cta" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </button>
                <a className="home-banner__ghost" href={tournamentsHref()}>
                  See events
                </a>
              </>
            }
          />
        )
      ) : (
        body
      )}
    </PageShell>
  )
}
