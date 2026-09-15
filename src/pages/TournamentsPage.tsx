import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { BracketWinCelebration } from '../components/BracketWinCelebration'
import { EventBracket } from '../components/EventBracket'
import { EventCountdown } from '../components/EventCountdown'
import {
  EventArt,
  EventKicker,
  EventLiveCard,
  EventResultRow,
  eventAccent,
  eventDay,
  eventPhase,
  ordinal,
} from '../components/EventCard'
import { GameThumbArt } from '../components/GameThumbArt'
import { BackChevronIcon } from '../components/PageBackLink'
import { InviteByTagForm } from '../components/InviteByTagForm'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { PodiumMedal, medalKind } from '../components/PodiumMedal'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  rankHref,
  tournamentCreateHref,
  tournamentHref,
  tournamentPlayHref,
  tournamentsHref,
  useHashRoute,
} from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import {
  attemptsPerGameMax,
  eventKind,
  finalBracketMatch,
  formatEventCountdown,
  formatRulesSummary,
  getJoinedTournamentIds,
  getTournament,
  getTournamentInvite,
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

/**
 * One game in a player's breakdown: a small card with the game, a caption
 * saying how they did in it, and what it earned them on the right.
 *
 * In a place-points event the headline is the points — that is what adds
 * up to the total above — and the caption spells out where the score came
 * from ("1st of 4 · scored 3,015"). A bare number on the right was read as
 * the points when it was the score.
 */
function GameBreakdownRow({
  game,
  cell,
  usePoints,
  ended,
  field,
}: {
  game: string
  cell: { score: number | null; place: number | null; points: number } | undefined
  usePoints: boolean
  ended: boolean
  /** How many players posted a score in this game. */
  field: number
}) {
  const label = getGame(game)?.name ?? game
  const accent = resolveGameAccent(game, getGame(game)?.accent ?? '#2eb8a0')
  const played = cell?.score != null
  const score = played ? cell.score!.toLocaleString() : null

  let sub: string
  let value: string
  let muted = false
  if (!played) {
    sub = ended ? 'Not played' : 'Not played yet'
    value = usePoints ? '0 pts' : '—'
    muted = true
  } else if (usePoints) {
    sub =
      cell.place != null
        ? `${ordinal(cell.place)} of ${field} · scored ${score}`
        : `Scored ${score}`
    value = `+${cell.points} pts`
  } else {
    sub = 'Counts toward the total'
    value = score!
  }

  return (
    <li className="ev-row__game">
      <GameThumbArt slug={game} accent={accent} />
      <span className="ev-row__game-text">
        <span className="ev-row__game-name">{label}</span>
        <span className="ev-row__game-sub">{sub}</span>
      </span>
      <span className={`ev-row__game-val${muted ? ' ev-row__game-val--muted' : ''}`}>
        {value}
      </span>
    </li>
  )
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
    const idx = scoredStandings(detail).findIndex(
      ({ row }) => normalizePlayerName(row.name) === youName,
    )
    return idx >= 0 ? idx + 1 : null
  }

  const idx = detail.standings.findIndex((row) => normalizePlayerName(row.name) === youName)
  return idx >= 0 ? idx + 1 : null
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
/* Hero                                                                    */
/* ====================================================================== */

type HeroClock = { label: string; value: ReactNode; live?: boolean; winner?: boolean }

/**
 * The one big figure on the page. A running event counts down; a finished
 * one names its winner, which is the only thing left worth saying.
 */
function heroClock(detail: TournamentDetail): HeroClock {
  const bracket = eventKind(detail) === 'bracket'
  if (detail.status === 'ended') {
    const winner = eventWinner(detail)
    if (winner) {
      return {
        label: 'Winner',
        winner: true,
        value: (
          <>
            <PodiumMedal kind="gold" size="md" />
            <span className="hero-stat__name">{winner}</span>
          </>
        ),
      }
    }
    return { label: 'Ended', value: eventDay(detail) || 'Over' }
  }
  if (bracket) {
    if (detail.status === 'upcoming') return { label: 'Starts', value: 'When full' }
    if (detail.nextDeadlineAt != null && detail.nextDeadlineAt > 0) {
      return {
        label: 'Round ends in',
        live: true,
        value: <EventCountdown endsAt={detail.nextDeadlineAt} precise />,
      }
    }
    return { label: 'Rounds', value: 'In play', live: true }
  }
  if (detail.status === 'upcoming') {
    return { label: 'Starts in', value: <EventCountdown endsAt={detail.startsAt} precise /> }
  }
  if (isUnlimitedDuration(detail.rules)) {
    return { label: 'Runs', value: 'Until all done', live: true }
  }
  return { label: 'Ends in', live: true, value: <EventCountdown endsAt={detail.endsAt} precise /> }
}

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
      return {
        kind: 'link',
        label: `Play vs ${opp.name}`,
        href: tournamentPlayHref(detail.id, detail.games[0] ?? '', playInvite),
        sub: [remaining === 1 ? '1 try' : `${remaining} tries left`, roundLeft ? `round ends in ${roundLeft}` : null]
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

function EventHero({
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
  shareUrl: string
  copyInvite: (() => void) | null
  copiedInvite: boolean
}) {
  const bracket = eventKind(detail) === 'bracket'
  const clock = heroClock(detail)
  const action = heroAction(detail, joined, displayName, playInvite)
  const open = detail.status !== 'ended'

  const sub = [
    detail.games.length > 1 ? detail.games.map((g) => getGame(g)?.name ?? g).join(', ') : null,
    formatRulesSummary(detail).replace(/\.$/, ''),
    bracket
      ? null
      : detail.playerCount === 0
        ? 'Nobody in yet'
        : `${detail.playerCount} ${detail.playerCount === 1 ? 'player' : 'players'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  // Where you stand, for anyone with something on the board.
  const place = joined && !bracket ? yourStandingPlace(detail, displayName) : null
  const score = place != null ? yourStandingScore(detail, displayName) : null
  const you: ReactNode =
    joined && !bracket ? (
      place != null ? (
        <>
          <span className="hero__foot-lead">
            {detail.status === 'ended' && place === 1 ? 'You won' : `You’re ${ordinal(place)}`}
          </span>
          {score ? <span className="hero__foot-value">{score}</span> : null}
        </>
      ) : detail.status === 'ended' ? null : (
        <span className="hero__foot-note">You’re in — no score yet</span>
      )
    ) : null

  const wantsJoinGhost =
    open && !joined && !bracket && !eventFull && Boolean(displayName) && action?.kind !== 'join'
  const needsTag = open && !joined && !displayName

  return (
    <section className="hero" aria-label="Event">
      <div className="hero__bar">
        <a className="hero__back" href={tournamentsHref()}>
          <BackChevronIcon size={18} />
          Events
        </a>
        <div className="hero__tools">
          <ShareBoardButton
            label={`You're invited: ${detail.title} on ${APP_NAME}. Don't ghost the lobby.`}
            url={shareUrl}
          />
          {copyInvite ? (
            <button type="button" className="hero__tool" onClick={copyInvite}>
              {copiedInvite ? 'Copied!' : 'Copy invite'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="hero__main">
        <EventArt games={detail.games} className="hero__art" />

        <div className="hero__text">
          <EventKicker t={detail} joined={joined} className="hero__kicker" />
          <h1 className="hero__title">{detail.title}</h1>
          <p className="hero__sub">{sub}</p>
        </div>

        <div
          className={`hero__aside hero-stat${clock.live ? ' hero-stat--live' : ''}${
            clock.winner ? ' hero-stat--winner' : ''
          }`}
        >
          <span className="hero-stat__label">{clock.label}</span>
          <span className="hero-stat__value">{clock.value}</span>
        </div>

        {action || wantsJoinGhost || needsTag || joinNote ? (
          <div className="hero__actions">
            {action?.kind === 'link' ? (
              <a className="hero__cta" href={action.href}>
                {action.label}
              </a>
            ) : action?.kind === 'join' ? (
              eventFull ? (
                <span className="hero__state">This event is full</span>
              ) : displayName ? (
                <button type="button" className="hero__cta" disabled={busy} onClick={onJoin}>
                  {busy ? 'Joining…' : `Join as ${displayName}`}
                </button>
              ) : null
            ) : action?.kind === 'text' ? (
              <span className="hero__state">{action.label}</span>
            ) : null}

            {wantsJoinGhost ? (
              <button type="button" className="hero__ghost" disabled={busy} onClick={onJoin}>
                {busy ? 'Joining…' : `Join as ${displayName}`}
              </button>
            ) : null}

            {action && action.kind !== 'join' && action.sub ? (
              <span className="hero__hint">{action.sub}</span>
            ) : null}
            {needsTag ? (
              <span className="hero__hint">Set your gamer tag in the header to join.</span>
            ) : null}
            {joinNote ? <span className="hero__hint hero__hint--error">{joinNote}</span> : null}
          </div>
        ) : null}
      </div>

      {you ? <p className="hero__foot">{you}</p> : null}
    </section>
  )
}

/* ====================================================================== */
/* Board                                                                   */
/* ====================================================================== */

function EventBoard({
  detail,
  displayName,
}: {
  detail: TournamentDetail
  displayName: string
}) {
  if (eventKind(detail) === 'bracket') {
    return (
      <>
        <EventBracket detail={detail} displayName={displayName} className="ev-card ev-card--bracket" />
        <BracketWinCelebration detail={detail} displayName={displayName} />
      </>
    )
  }
  return <EventStandings detail={detail} displayName={displayName} />
}

function EventStandings({
  detail,
  displayName,
}: {
  detail: TournamentDetail
  displayName: string
}) {
  const single = detail.games.length === 1
  const ended = detail.status === 'ended'
  const title = single ? (ended ? 'Final scores' : 'Leaders') : ended ? 'Final standings' : 'Standings'
  const rows = single ? scoredStandings(detail).length : detail.standings.length
  return (
    <section className="ev-card" aria-label={title}>
      <div className="ev-card__head">
        <h2 className="ev-card__title">{title}</h2>
        {rows > 0 ? (
          <p className="ev-card__note">
            {rows} {rows === 1 ? 'player' : 'players'}
          </p>
        ) : null}
      </div>
      {rows === 0 ? (
        <p className="ev-empty">
          {ended
            ? 'No scores were posted.'
            : single
              ? 'No scores yet — be the first on the board.'
              : 'No players yet.'}
        </p>
      ) : (
        <StandingsList detail={detail} displayName={displayName} />
      )}
    </section>
  )
}

/** One standings row. Single- and multi-game events share this so the two
 *  boards look identical; multi-game rows add a per-game breakdown. */
function StandingRow({
  rank,
  name,
  avatarId,
  score,
  unit,
  mine,
  breakdown,
}: {
  rank: number
  name: string
  avatarId?: string
  score: string
  unit?: string
  mine: boolean
  breakdown?: ReactNode
}) {
  const medal = medalKind(rank)
  const rowClass = `ev-row${rank <= 3 ? ` ev-row--${rank}` : ''}${mine ? ' ev-row--you' : ''}`

  const cells = (
    <>
      <span className="ev-row__rank" aria-label={`Place ${rank}`}>
        {medal ? <PodiumMedal kind={medal} size="sm" /> : rank}
      </span>
      <a className="ev-row__who" href={rankHref(name)} title={name}>
        <PlayerAvatar avatarId={avatarId} name={name} size="sm" />
        <span className="ev-row__name">{name}</span>
        {mine ? <span className="ev-row__you-tag">You</span> : null}
      </a>
      <span className="ev-row__score">
        {score}
        {unit ? <span className="ev-row__score-unit">{unit}</span> : null}
      </span>
    </>
  )

  if (!breakdown) {
    return (
      <li className={rowClass} aria-current={mine ? 'true' : undefined}>
        <div className="ev-row__main">{cells}</div>
      </li>
    )
  }

  return (
    <li className={rowClass} aria-current={mine ? 'true' : undefined}>
      <details className="ev-row__details">
        <summary className="ev-row__main ev-row__main--expandable ev-row__toggle">
          {cells}
          <span className="ev-row__chev" aria-hidden="true" />
        </summary>
        {breakdown}
      </details>
    </li>
  )
}

function StandingsList({
  detail,
  displayName,
}: {
  detail: TournamentDetail
  displayName: string
}) {
  const usePoints = detail.format === 'place-points'
  const youName = normalizePlayerName(displayName)
  const single = detail.games.length === 1

  const singleRows = useMemo(
    () => (single ? scoredStandings(detail) : []),
    [detail, single],
  )
  // Players with a score in each game, for "1st of 4".
  const fieldByGame = useMemo(() => {
    const out: Record<string, number> = {}
    for (const game of detail.games) {
      out[game] = detail.standings.filter((r) => r.byGame[game]?.score != null).length
    }
    return out
  }, [detail])

  if (single) {
    return (
      <ol className="ev-board">
        {singleRows.map(({ row, score }, index) => {
          const name = normalizePlayerName(row.name)
          return (
            <StandingRow
              key={row.playerId}
              rank={index + 1}
              name={name}
              avatarId={row.avatarId}
              score={score.toLocaleString()}
              mine={Boolean(youName) && name === youName}
            />
          )
        })}
      </ol>
    )
  }

  return (
    <ol className="ev-board">
      {detail.standings.map((row, index) => {
        const name = normalizePlayerName(row.name)
        const totalScore = detail.games.reduce(
          (sum, game) => sum + (row.byGame[game]?.score ?? 0),
          0,
        )
        return (
          <StandingRow
            key={row.playerId}
            rank={index + 1}
            name={name}
            avatarId={row.avatarId}
            score={usePoints ? String(row.totalPoints) : totalScore.toLocaleString()}
            unit={usePoints ? 'pts' : 'total'}
            mine={Boolean(youName) && name === youName}
            breakdown={
              <ul className="ev-row__games">
                {detail.games.map((game) => (
                  <GameBreakdownRow
                    key={game}
                    game={game}
                    cell={row.byGame[game]}
                    usePoints={usePoints}
                    ended={detail.status === 'ended'}
                    field={fieldByGame[game] ?? 0}
                  />
                ))}
              </ul>
            }
          />
        )
      })}
    </ol>
  )
}

/* ====================================================================== */
/* Line-up (multi-game events)                                             */
/* ====================================================================== */

/** One tile per game, each with its own way in. */
function EventLineup({
  detail,
  joined,
  playInvite,
  displayName,
}: {
  detail: TournamentDetail
  joined: boolean
  playInvite?: string
  displayName: string
}) {
  const ended = detail.status === 'ended'
  const notStarted = detail.status === 'upcoming'

  return (
    <section className="ev-card" aria-label="Games">
      <div className="ev-card__head">
        <h2 className="ev-card__title">{detail.games.length} games</h2>
        <p className="ev-card__note">{ended ? 'Event over' : 'Every game counts'}</p>
      </div>
      <ul className="ev-lineup">
        {detail.games.map((slug) => {
          const g = getGame(slug)
          const name = g?.name ?? slug
          const gameAccent = resolveGameAccent(slug, g?.accent ?? eventAccent(detail.games))
          const attemptLabel = playAttemptsLabel(detail, slug, joined, displayName)
          const locked = ended || notStarted || (joined && attemptLabel === 'No tries left')
          const style = { '--row-accent': gameAccent } as CSSProperties
          const status = ended ? 'Event ended' : notStarted ? 'Not started' : attemptLabel

          const inner = (
            <>
              <span className="ev-lineup__art">
                <GameThumbArt slug={slug} accent={gameAccent} />
              </span>
              <span className="ev-lineup__text">
                <span className="ev-lineup__name">{name}</span>
                <span className="ev-lineup__status">{status}</span>
              </span>
              {!locked ? <span className="ev-lineup__go">Play</span> : null}
            </>
          )

          return (
            <li key={slug}>
              {locked ? (
                <div
                  className="ev-lineup__tile ev-lineup__tile--locked"
                  style={style}
                  aria-label={`${name}, ${status}`}
                >
                  {inner}
                </div>
              ) : (
                <a
                  className="ev-lineup__tile"
                  href={tournamentPlayHref(detail.id, slug, playInvite)}
                  style={style}
                  aria-label={`Play ${name}, ${attemptLabel}`}
                >
                  {inner}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ====================================================================== */
/* List page                                                               */
/* ====================================================================== */

export function TournamentsPage() {
  const { account } = useAuth()
  const playerName = usePlayerName()
  const [items, setItems] = useState<TournamentSummary[]>([])
  const [filter, setFilter] = useState<'all' | 'official' | 'joined' | 'mine'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const name = normalizePlayerName(playerName || getLastPlayerName())
    listTournaments(filter, name || undefined)
      .then((list) => {
        if (!cancelled) setItems(list)
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
  }, [filter, playerName])

  // Which of these you are in: what this device remembers joining, plus
  // anything the API already ranks you in.
  const joinedIds = new Set(getJoinedTournamentIds())
  const isJoined = (t: TournamentSummary) => joinedIds.has(t.id) || t.yourPlace != null
  const linkFor = (t: TournamentSummary) =>
    t.private ? tournamentHref(t.id, getTournamentInvite(t.id) ?? undefined) : undefined

  const open = items.filter((t) => t.status !== 'ended')
  const ended = items.filter((t) => t.status === 'ended')
  const anyLive = open.some((t) => eventPhase(t) === 'live')

  const keys = ['all', 'official', 'joined', ...(account ? (['mine'] as const) : [])] as const
  const labels = { all: 'All', official: 'Official', joined: 'Joined', mine: 'Hosted' } as const

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <header className="lb-page__header lb-page__header--compact">
        <div className="lb-page__heading-row">
          <span className="lb-page__heading-slot" aria-hidden="true" />
          <h1 className="lb-page__title">Events</h1>
          <div className="lb-game-board__trailing">
            {account ? (
              <a className="event-list__create" href={tournamentCreateHref()}>
                Create event
              </a>
            ) : null}
          </div>
        </div>
        <div
          className="lb-periods lb-periods--segment"
          role="tablist"
          aria-label="Event filters"
          style={{ '--period-count': keys.length } as CSSProperties}
        >
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`lb-period${filter === key ? ' lb-period--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {labels[key]}
            </button>
          ))}
        </div>
      </header>

      <PendingInvitesStrip kind="tournament" />

      {loading ? (
        <p className="lb-empty">Loading…</p>
      ) : error ? (
        <p className="lb-empty">Couldn’t load events.</p>
      ) : items.length === 0 ? (
        <p className="lb-empty">
          {filter === 'mine'
            ? 'You have no hosted events yet.'
            : filter === 'joined'
              ? 'You have not joined any private events yet.'
              : 'No events yet.'}
        </p>
      ) : (
        <div className="ev ev--list">
          {open.length > 0 ? (
            <section className="evl" aria-label={anyLive ? 'Live now' : 'Open now'}>
              <h2 className="evl__title">
                {anyLive ? <span className="ev-live-dot" aria-hidden="true" /> : null}
                {anyLive ? 'Live now' : 'Open now'}
              </h2>
              <ul className="evl__grid">
                {open.map((t) => (
                  <li key={t.id}>
                    <EventLiveCard t={t} href={linkFor(t)} joined={isJoined(t)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {ended.length > 0 ? (
            <section className="evl" aria-label="Results">
              <h2 className="evl__title">Results</h2>
              <ul className="evl__results">
                {ended.map((t) => (
                  <li key={t.id}>
                    <EventResultRow t={t} href={linkFor(t)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </PageShell>
  )
}

/* ====================================================================== */
/* Event page                                                              */
/* ====================================================================== */

function PlainHeader({ title }: { title: string }) {
  return (
    <header className="lb-page__header lb-page__header--compact lb-game-board__head">
      <div className="lb-page__heading-row">
        <a className="page-back" href={tournamentsHref()} aria-label="Back to Events" title="Back to Events">
          <BackChevronIcon size={18} />
        </a>
        <h1 className="lb-page__title">{title}</h1>
        <span className="lb-page__heading-slot" aria-hidden="true" />
      </div>
    </header>
  )
}

export function TournamentDetailPage({ id, invite }: { id: string; invite?: string }) {
  const route = useHashRoute()
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
      ? `${window.location.origin}${window.location.pathname}${tournamentHref(id, detail.inviteCode)}`
      : playInvite
        ? `${window.location.origin}${window.location.pathname}${tournamentHref(id, playInvite)}`
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

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      {loading ? (
        <p className="lb-empty">Loading…</p>
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
        <div
          className="ev"
          style={
            {
              '--event-accent': accent,
              '--board-accent': accent,
              '--tile-accent': accent,
              '--thumb-accent': accent,
            } as CSSProperties
          }
        >
          <EventHero
            detail={detail}
            joined={joined}
            displayName={displayName}
            playInvite={playInvite}
            eventFull={eventFull}
            busy={busy}
            joinNote={joinNote}
            onJoin={() => void onJoin()}
            shareUrl={
              invitesOpen && inviteLink
                ? inviteLink
                : `${window.location.origin}${window.location.pathname}${tournamentHref(detail.id)}`
            }
            copyInvite={detail.isHost && invitesOpen ? () => void copyInviteLink() : null}
            copiedInvite={copiedInvite}
          />

          {detail.isHost && invitesOpen ? (
            <section className="ev-card" aria-label="Invite players">
              <div className="ev-card__head">
                <h2 className="ev-card__title">Invite players</h2>
                <p className="ev-card__note">
                  {(() => {
                    const left = seatsLeft(detail)
                    return left != null
                      ? `${left} ${left === 1 ? 'seat' : 'seats'} left`
                      : 'Invite only'
                  })()}
                </p>
              </div>
              <InviteByTagForm kind="tournament" targetId={id} disabled={busy} />
            </section>
          ) : null}

          <EventBoard detail={detail} displayName={displayName} />

          {eventKind(detail) !== 'bracket' &&
          detail.games.length > 1 &&
          detail.status !== 'ended' ? (
            <EventLineup
              detail={detail}
              joined={joined}
              playInvite={playInvite}
              displayName={displayName}
            />
          ) : null}
        </div>
      )}
    </PageShell>
  )
}
