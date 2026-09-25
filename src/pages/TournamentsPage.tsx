import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { BracketWinCelebration } from '../components/BracketWinCelebration'
import { EventBracket } from '../components/EventBracket'
import { EventArt, EventKicker, EventLiveCard, eventAccent, eventPhase } from '../components/EventCard'
import { EventClock } from '../components/EventClock'
import {
  EventGames,
  EventPodium,
  GameBests,
  HowItScores,
  NextEventCard,
  StandingsEmpty,
  StandingsTable,
  WinnerCard,
  type GameCardState,
} from '../components/EventDetail'
import {
  DailyCard,
  HowEventsWork,
  LastWeekCard,
  OwnEventsCard,
  ResultsList,
  WeeklyHero,
} from '../components/EventsHome'
import { InviteByTagForm } from '../components/InviteByTagForm'
import { ListRow, ListSplit } from '../components/ListRow'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { openSiteMenu } from '../components/siteNav'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  rankHref,
  tournamentCreateHref,
  tournamentHref,
  tournamentPlayHref,
  tournamentsHref,
  useRoute,
} from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import {
  endsWords,
  eventSpan,
  eventsLineup,
  gameName,
  ordinal,
  playedAll,
  resultLines,
  skipLesson,
  standingsCount,
  standingsTable,
} from '../lib/eventPages'
import { listEventInvites, type PublicInvite } from '../lib/invites'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import {
  attemptsPerGameMax,
  bracketGameForRound,
  bracketRoundLabel,
  eventKind,
  finalBracketMatch,
  formatEventCountdown,
  formatRulesSummary,
  getJoinedTournamentIds,
  getTournament,
  getTournamentInvite,
  hasPerRoundGames,
  isPlayerInTournament,
  isRosterFull,
  isUnlimitedDuration,
  joinTournament,
  listTournaments,
  matchOpponent,
  rememberTournamentInvite,
  seatsLeft,
  syncJoinedTournamentRosters,
  yourOpenMatch,
  type StandingRow,
  type TournamentDetail,
  type TournamentSummary,
} from '../lib/tournaments'
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

/** Rank of the current player in the same order the event standings show. */
function yourStandingPlace(detail: TournamentDetail, displayName: string): number | null {
  const youName = normalizePlayerName(displayName)
  if (!youName) return null

  if (detail.games.length === 1) {
    const scored = scoredStandings(detail)
    const idx = scored.findIndex(({ row }) => normalizePlayerName(row.name) === youName)
    return idx >= 0 ? (scored[idx]!.row.place ?? idx + 1) : null
  }

  const idx = detail.standings.findIndex((row) => normalizePlayerName(row.name) === youName)
  return idx >= 0 ? (detail.standings[idx]!.place ?? idx + 1) : null
}

/** The current player's headline number, formatted the way the board shows it. */
function yourStandingScore(detail: TournamentDetail, displayName: string): string | null {
  const youName = normalizePlayerName(displayName)
  if (!youName) return null
  if (detail.games.length === 1) {
    const hit = scoredStandings(detail).find(
      ({ row }) => normalizePlayerName(row.name) === youName,
    )
    return hit ? hit.score.toLocaleString() : null
  }
  const row = detail.standings.find((r) => normalizePlayerName(r.name) === youName)
  if (!row) return null
  if (detail.format === 'place-points') return `${row.totalPoints} pts`
  const total = detail.games.reduce((sum, g) => sum + (row.byGame[g]?.score ?? 0), 0)
  return total.toLocaleString()
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

/** The line under an event's name: its games, when it runs, and who's in. */
function eventSub(detail: TournamentDetail): string {
  const bracket = eventKind(detail) === 'bracket'
  return [
    detail.games.map(gameName).join(' · '),
    detail.official ? eventSpan(detail) : formatRulesSummary(detail).replace(/\.$/, ''),
    bracket
      ? null
      : detail.playerCount === 0
        ? detail.status === 'ended'
          ? 'Nobody played'
          : 'Nobody in yet'
        : `${detail.playerCount} ${detail.playerCount === 1 ? 'player' : 'players'}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** "Semifinals": the winners-bracket round still being played, or null once the losers bracket is in play too. */
function currentRoundName(detail: TournamentDetail): string | null {
  const matches = detail.bracket?.matches ?? []
  const open = matches.filter((m) => !m.winnerId && m.players.some(Boolean))
  if (!open.length || open.some((m) => (m.bracket ?? 'wb') !== 'wb')) return null
  const maxRound = Math.max(...matches.filter((m) => (m.bracket ?? 'wb') === 'wb').map((m) => m.round))
  return bracketRoundLabel(Math.min(...open.map((m) => m.round)), maxRound)
}

/** The right side of the banner: the clock while it runs, the winner once it's over. */
function BannerSide({ detail, displayName }: { detail: TournamentDetail; displayName: string }) {
  const bracket = eventKind(detail) === 'bracket'
  if (detail.status === 'ended') {
    const winner = eventWinner(detail)
    if (!winner) {
      return (
        <div className="evp-banner__side">
          <p className="evp-cap">Ended</p>
          <p className="evp-banner__state">{bracket ? 'No winner: the rounds went unplayed' : 'No winner: nobody played'}</p>
        </div>
      )
    }
    const rows = bracket ? [] : standingsTable(detail, displayName)
    const top = rows[0]
    const usePoints = detail.format === 'place-points'
    const runnersUp = rows
      .slice(1, 3)
      .map((r) => `${r.name} on ${usePoints ? r.total : r.total.toLocaleString()}`)
      .join(' and ')
    const single = detail.games.length === 1 && !bracket ? scoredStandings(detail)[0] : null
    return (
      <div className="evp-banner__side">
        <WinnerCard
          winner={normalizePlayerName(winner)}
          avatarId={top?.avatarId ?? single?.row.avatarId}
          total={single ? single.score : top ? top.total : null}
          usePoints={usePoints && !single}
          mine={normalizePlayerName(winner) === normalizePlayerName(displayName)}
          runnersUp={runnersUp ? `Ahead of ${runnersUp}` : null}
        />
      </div>
    )
  }
  if (bracket) {
    // Until the last seat fills there is no draw, only seats.
    if (detail.status === 'upcoming' || !detail.bracket?.lockedAt) {
      const left = seatsLeft(detail)
      const cap = detail.rules.maxPlayers
      return (
        <div className="evp-banner__side">
          <p className="evp-cap">The draw</p>
          <p className="evp-banner__state">{left ? `When ${left} more ${left === 1 ? 'joins' : 'join'}` : 'When the roster fills'}</p>
          {cap ? (
            <p className="evp-banner__side-note">
              {detail.playerCount} of {cap} seats taken
            </p>
          ) : null}
        </div>
      )
    }
    const round = currentRoundName(detail)
    return detail.nextDeadlineAt ? (
      <div className="evp-banner__side">
        <p className="evp-cap">{round ? `${round} ${/finals$/.test(round) ? 'end' : 'ends'} in` : 'This round ends in'}</p>
        <EventClock endsAt={detail.nextDeadlineAt} />
      </div>
    ) : (
      <div className="evp-banner__side">
        <p className="evp-cap">Now playing</p>
        <p className="evp-banner__state">{round ?? 'The next round'}</p>
      </div>
    )
  }
  if (detail.status === 'upcoming') {
    return (
      <div className="evp-banner__side">
        <p className="evp-cap">Starts in</p>
        <EventClock endsAt={detail.startsAt} />
      </div>
    )
  }
  if (isUnlimitedDuration(detail.rules)) {
    return (
      <div className="evp-banner__side">
        <p className="evp-cap">Runs</p>
        <p className="evp-banner__state">Until everyone has played</p>
      </div>
    )
  }
  return (
    <div className="evp-banner__side">
      <p className="evp-cap">{endsWords(detail.endsAt)}</p>
      <EventClock endsAt={detail.endsAt} />
    </div>
  )
}

function EventBanner({
  detail,
  joined,
  displayName,
  playInvite,
  eventFull,
  busy,
  joinNote,
  onJoin,
  shareUrl,
  copyInvite,
  copiedInvite,
}: {
  detail: TournamentDetail
  joined: boolean
  displayName: string
  playInvite?: string
  eventFull: boolean
  busy: boolean
  joinNote: string | null
  onJoin: () => void
  /** Null where a shared link would let nobody in. */
  shareUrl: string | null
  copyInvite: (() => void) | null
  copiedInvite: boolean
}) {
  const bracket = eventKind(detail) === 'bracket'
  const action = heroAction(detail, joined, displayName, playInvite)
  const open = detail.status !== 'ended'
  const place = joined && !bracket ? yourStandingPlace(detail, displayName) : null
  const score = place != null ? yourStandingScore(detail, displayName) : null
  const joinLabel = `Join${detail.cadence === 'weekly' ? ' the Triple' : ''} as ${displayName}`

  const wantsJoinGhost =
    open && !joined && !bracket && !eventFull && Boolean(displayName) && action?.kind !== 'join'
  const needsTag = open && !joined && !displayName

  return (
    <section className="evp-banner evp-wash" aria-labelledby="evp-event-title">
      <div className="evp-banner__bar">
        <nav className="evp-crumbs" aria-label="Breadcrumb">
          <a href={tournamentsHref()}>Events</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{detail.official && detail.status === 'ended' ? `${detail.title}, ${eventSpan(detail).split(' to ')[0]}` : detail.title}</span>
        </nav>
        <span className="evp-banner__tools">
          {copyInvite ? (
            <button type="button" className="evp-btn evp-btn--ghost evp-btn--small" onClick={copyInvite}>
              {copiedInvite ? 'Copied' : 'Copy invite'}
            </button>
          ) : null}
          {shareUrl ? (
            <ShareBoardButton
              className="evp-share"
              label={`You're invited: ${detail.title} on ${APP_NAME}. Don't ghost the lobby.`}
              url={shareUrl}
            />
          ) : null}
        </span>
      </div>
      <div className="evp-banner__main">
        <p className="evp-kick evp-kick--event">
          <EventKicker t={detail} joined={joined} bare />
        </p>
        <h1 id="evp-event-title" className="evp-banner__title">
          {detail.title}
        </h1>
        <p className="evp-banner__sub">{eventSub(detail)}</p>
        {place != null && !(place === 1 && !open) ? (
          <p className="evp-banner__you">
            {open ? 'You’re' : 'You finished'} <b>{ordinal(place)}</b>
            {score ? ` · ${score}` : ''}
          </p>
        ) : joined && !bracket && open ? (
          <p className="evp-banner__you">You’re in, with nothing posted yet.</p>
        ) : null}
        {action || wantsJoinGhost || needsTag || joinNote ? (
          <div className="evp-acts">
            {action?.kind === 'link' ? (
              <a className="evp-btn evp-btn--big" href={action.href}>
                {action.label}
              </a>
            ) : action?.kind === 'join' ? (
              eventFull ? (
                <span className="evp-banner__state">This event is full</span>
              ) : displayName ? (
                <button type="button" className="evp-btn evp-btn--big" disabled={busy} onClick={onJoin}>
                  {busy ? 'Joining…' : joinLabel}
                </button>
              ) : null
            ) : action?.kind === 'text' ? (
              <span className="evp-banner__state">{action.label}</span>
            ) : null}
            {wantsJoinGhost ? (
              <button type="button" className="evp-btn evp-btn--ghost" disabled={busy} onClick={onJoin}>
                {busy ? 'Joining…' : joinLabel}
              </button>
            ) : null}
            {needsTag ? (
              <button type="button" className="evp-btn evp-btn--big" onClick={openSiteMenu}>
                Pick a gamer tag to join
              </button>
            ) : null}
            {action && action.kind !== 'join' && action.sub ? <span className="evp-banner__hint">{action.sub}</span> : null}
            {joinNote ? <span className="evp-banner__hint evp-banner__hint--error">{joinNote}</span> : null}
          </div>
        ) : null}
        {needsTag ? (
          <p className="evp-banner__hint">Sign in and pick a tag: it’s how the standings know your runs.</p>
        ) : null}
      </div>
      <BannerSide detail={detail} displayName={displayName} />
    </section>
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
              <PlayerAvatar name={invite.toName} size="sm" />
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
  const open = seatsLeft(detail) ?? 0
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
                <PlayerAvatar name={p.name} size="sm" />
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
        href={rankHref(name)}
        avatarId={row.avatarId}
        score={score.toLocaleString()}
        mine={Boolean(youName) && name === youName}
        pinned={pin}
      />
    )
  }
  return (
    <section className="evp-card evp-single" aria-labelledby="evp-single-title">
      <div className="evp-card__head">
        <h2 id="evp-single-title" className="evp-card__title">
          {ended ? 'Final scores' : 'Leaders'}
          <span className="evp-card__count">
            {count.toLocaleString()} {count === 1 ? 'player' : 'players'}
          </span>
        </h2>
      </div>
      <ol className="lst">
        {pinned ? (
          <>
            {item(pinned, true)}
            <ListSplit>Top {top.length}</ListSplit>
          </>
        ) : null}
        {top.map((entry) => item(entry))}
      </ol>
      {below > 0 ? (
        <p className="evp-card__copy">
          {below.toLocaleString()} more {below === 1 ? 'player' : 'players'} below them.
        </p>
      ) : null}
    </section>
  )
}

/* ====================================================================== */
/* List page                                                               */
/* ====================================================================== */

/**
 * The events page. This week's Triple leads, its games ready to play; then
 * today's daily, last week's winner and the lesson that week left, and your
 * own events; how events work; and the results, with the ones nobody played
 * gathered into a line.
 */
export function TournamentsPage() {
  const { account, limits } = useAuth()
  const playerName = usePlayerName()
  const me = normalizePlayerName(playerName || getLastPlayerName())
  const [items, setItems] = useState<TournamentSummary[]>([])
  const [mine, setMine] = useState<TournamentSummary[]>([])
  const [lastDetail, setLastDetail] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  const lastId = lineup.lastWeekly?.id ?? null

  // Last week's standings, for the podium's faces and the lesson the week left.
  useEffect(() => {
    if (!lastId) return
    let cancelled = false
    getTournament(lastId)
      .then((d) => {
        if (!cancelled) setLastDetail(d)
      })
      .catch(() => {
        /* the card reads fine without it */
      })
    return () => {
      cancelled = true
    }
  }, [lastId])

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
  const others = lineup.others.filter((t) => !mine.some((m) => m.id === t.id))
  const lesson = lastDetail && lastDetail.id === lastId ? skipLesson(lastDetail) : null

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="evp">
        {loading ? (
          <div className="evp-loading" aria-busy="true">
            <span className="evp-loading__hero" />
            <span className="evp-loading__row">
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : error ? (
          <>
            <PageBanner ariaLabel="Events" title="Events" blurb="The daily, the Weekly Triple and your own." />
            <p className="lb-empty">Couldn’t load events. Check your connection and try again.</p>
          </>
        ) : (
          <>
            {lineup.weekly ? (
              <WeeklyHero t={lineup.weekly} joined={isJoined(lineup.weekly)} />
            ) : (
              <PageBanner
                ariaLabel="Events"
                title="Events"
                blurb="A daily game, a Weekly Triple, and events you make for your friends. Join one, post a score, and see where you land."
                actions={
                  account ? (
                    <a className="home-banner__cta" href={tournamentCreateHref()}>
                      Create an event
                    </a>
                  ) : undefined
                }
                art={<EventArt games={[...new Set(items.flatMap((t) => t.games))].slice(0, 4)} />}
              />
            )}

            <PendingInvitesStrip kind="tournament" />

            <div className="evp-trio">
              {lineup.daily ? <DailyCard t={lineup.daily} /> : null}
              {lineup.lastWeekly ? (
                <LastWeekCard t={lineup.lastWeekly} detail={lastDetail} lesson={lesson} me={me} />
              ) : null}
              <OwnEventsCard signedIn={Boolean(account)} mine={mine} limits={limits} linkFor={linkFor} />
            </div>

            {others.length > 0 ? (
              <section className="evl evp-others" aria-labelledby="evp-others-title">
                <h2 id="evp-others-title" className="evp-section-title">
                  {others.some((t) => eventPhase(t) === 'live') ? 'Also on' : 'Coming up'}
                </h2>
                <ul className="evl__grid">
                  {others.map((t) => (
                    <li key={t.id}>
                      <EventLiveCard t={t} href={linkFor(t)} joined={isJoined(t)} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <HowEventsWork />

            {results.length > 0 ? <ResultsList lines={results} me={me} linkFor={linkFor} /> : null}
          </>
        )}
      </div>
    </PageShell>
  )
}

/* ====================================================================== */
/* Event page                                                              */
/* ====================================================================== */

/** The event page before it has an event to show: a gate, a not-found, a wait. */
function PlainHeader({ title }: { title: string }) {
  return (
    <PageBanner
      size="compact"
      crumbs={[{ href: tournamentsHref(), label: 'Events' }, { label: title }]}
      kicker="Events"
      title={title}
    />
  )
}

export function TournamentDetailPage({ id, invite }: { id: string; invite?: string }) {
  const route = useRoute()
  const playerName = usePlayerName()
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsInvite, setNeedsInvite] = useState(false)
  const [inviteDraft, setInviteDraft] = useState(invite ?? '')
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joinNote, setJoinNote] = useState<string | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [previous, setPrevious] = useState<TournamentDetail | null>(null)

  const displayName = normalizePlayerName(playerName)
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
          setError(err instanceof Error ? err.message : 'Failed to load')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, invite, route])

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
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopiedInvite(true)
      window.setTimeout(() => setCopiedInvite(false), 2000)
    } catch {
      /* ignore */
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
    const games: GameCardState[] =
      bracket || ended
        ? []
        : detail.games.map((slug) => {
            const status =
              detail.status === 'upcoming' ? 'Not started yet' : playAttemptsLabel(detail, slug, joined, displayName)
            const locked = detail.status === 'upcoming' || (joined && status === 'No tries left')
            return { slug, href: locked ? null : tournamentPlayHref(detail.id, slug, playInvite), status }
          })
    const ownLesson = ended ? skipLesson(detail) : null
    const priorLesson = !ended && previous ? skipLesson(previous) : null
    const lesson = ownLesson
      ? { lesson: ownLesson, all: playedAll(detail), field: standingsCount(detail) }
      : priorLesson && previous
        ? { lesson: priorLesson, all: playedAll(previous), field: standingsCount(previous) }
        : null
    const next = ended
      ? (live.official.find((t) => t.id !== detail.id && t.cadence != null && t.cadence === detail.cadence) ?? null)
      : null
    const hostInvites = detail.isHost && invitesOpen
    /*
     * Who can hand the event out. Anyone, for an open event. A private one only
     * lets in someone holding its code, which only the host has: from anyone
     * else, a share was an invite that ended at "enter the code from your host".
     */
    const shareUrl = !detail.private
      ? `${window.location.origin}${tournamentHref(detail.id)}`
      : hostInvites && inviteLink
        ? inviteLink
        : null
    const filling = bracket && !detail.bracket?.lockedAt

    body = (
      <div
        className="evp evp--event"
        style={
          {
            '--e': accent,
            '--e-ink': inkOn(accent),
            '--event-accent': accent,
            '--event-ink': inkOn(accent),
            '--board-accent': accent,
            '--tile-accent': accent,
            '--thumb-accent': accent,
          } as CSSProperties
        }
      >
        <EventBanner
          detail={detail}
          joined={joined}
          displayName={displayName}
          playInvite={playInvite}
          eventFull={eventFull}
          busy={busy}
          joinNote={joinNote}
          onJoin={() => void onJoin()}
          shareUrl={shareUrl}
          copyInvite={hostInvites ? () => void copyInviteLink() : null}
          copiedInvite={copiedInvite}
        />

        {/* Several games get a row of their own; one sits beside the standings, where it doesn't leave a row mostly empty. */}
        {games.length > 1 ? <EventGames games={games} /> : null}

        <div className="evp-split">
          <div className="evp-split__main">
            {bracket ? (
              <EventBracket detail={detail} displayName={displayName} className="ev-card ev-card--bracket" />
            ) : multi ? (
              rows.length ? (
                <>
                  {ended ? <EventPodium rows={rows} detail={detail} /> : null}
                  <StandingsTable detail={detail} rows={rows} limit={ended ? 10 : 25} />
                </>
              ) : (
                <StandingsEmpty detail={detail} />
              )
            ) : singleCount ? (
              <SingleStandings detail={detail} displayName={displayName} />
            ) : (
              <StandingsEmpty detail={detail} />
            )}
            {/*
             * The win moment, a portal shown once per win: a bracket's as its
             * matches are won, any other event's once it has a winner, so
             * nobody "wins" an event that ended with no runs in it.
             */}
            {bracket || eventWinner(detail) ? <BracketWinCelebration detail={detail} displayName={displayName} /> : null}
          </div>

          <aside className="evp-split__side" aria-label="About this event">
            {games.length === 1 ? <EventGames games={games} /> : null}
            {hostInvites ? (
              <section className="ev-card evp-side-card" aria-label="Invite players">
                <div className="ev-card__head">
                  <h2 className="ev-card__title">Invite players</h2>
                  <p className="ev-card__note">
                    {(() => {
                      const left = seatsLeft(detail)
                      return left != null ? `${left} ${left === 1 ? 'seat' : 'seats'} left` : 'Invite only'
                    })()}
                  </p>
                </div>
                <InviteByTagForm
                  kind="tournament"
                  targetId={id}
                  disabled={busy}
                  excludeNames={detail.players.map((p) => p.name)}
                />
                <SentInvites tournamentId={id} roster={detail.playerCount} />
              </section>
            ) : null}
            {filling ? <EventRoster detail={detail} displayName={displayName} /> : null}
            {!bracket && ended && multi ? <GameBests detail={detail} /> : null}
            {bracket || !ended || !multi ? <HowItScores detail={detail} lesson={lesson} me={displayName} /> : null}
            {next ? <NextEventCard t={next} /> : null}
          </aside>
        </div>
      </div>
    )
  }

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      {loading ? (
        <div className="evp-loading" aria-busy="true">
          <span className="evp-loading__hero" />
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
        <>
          <PlainHeader title="Event" />
          <p className="lb-empty">{error ?? 'Event not found'}</p>
        </>
      ) : (
        body
      )}
    </PageShell>
  )
}
