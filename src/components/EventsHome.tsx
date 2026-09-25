import type { CSSProperties, ReactNode } from 'react'
import { rankHref, tournamentCreateHref, tournamentHref, tournamentPlayHref } from '../hooks/useHashRoute'
import { inkOn } from '../lib/color'
import {
  eventDay,
  eventSpan,
  gameList,
  gameName,
  ordinal,
  standingsTable,
  type ResultLine,
  type SkipLesson,
} from '../lib/eventPages'
import { normalizePlayerName } from '../lib/leaderboard'
import type { PlanLimits } from '../lib/plans'
import {
  eventKind,
  formatEventCountdown,
  isUnlimitedDuration,
  type TournamentDetail,
  type TournamentSummary,
} from '../lib/tournaments'
import { EventArt, eventAccent } from './EventCard'
import { EventScreen } from './EventScreen'
import { PlayerAvatar } from './PlayerAvatar'
import { openSiteMenu } from './siteNav'

/* The events page's pieces: this week's Triple up top, today's daily, last week's winner, your own, how it all works, and what has finished. */

function accentStyle(games: string[]): CSSProperties {
  const accent = eventAccent(games)
  return { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)
export const PeopleIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 4.8a3.2 3.2 0 0 1 0 6.4" />
    <path d="M18 14.7c1.9.7 3 2.5 3 5.3" />
  </Icon>
)
export const RepeatIcon = () => (
  <Icon>
    <path d="M17 2l3 3-3 3" />
    <path d="M4 11V9a4 4 0 0 1 4-4h12" />
    <path d="M7 22l-3-3 3-3" />
    <path d="M20 13v2a4 4 0 0 1-4 4H4" />
  </Icon>
)
export const TrophyIcon = () => (
  <Icon>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3" />
  </Icon>
)
const ListIcon = () => (
  <Icon>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </Icon>
)
const BracketIcon = () => (
  <Icon>
    <path d="M3 5h5v5H3" />
    <path d="M3 14h5v5H3" />
    <path d="M8 7.5h4v9H8" />
    <path d="M12 12h6" />
  </Icon>
)
const LockIcon = () => (
  <Icon>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icon>
)
const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)
const OneIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M10.4 9.2l2-1.4v8.4" />
  </Icon>
)
const ThreeIcon = () => (
  <Icon>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="9.5" y="4" width="5" height="16" rx="1.5" />
    <rect x="16" y="4" width="5" height="16" rx="1.5" />
  </Icon>
)
const MedalIcon = () => (
  <Icon>
    <path d="M8 3l4 6.2L16 3" />
    <circle cx="12" cy="15" r="5.6" />
    <path d="M10.9 13.6l1.3-1v5" />
  </Icon>
)
const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
)
const ChevronIcon = () => (
  <Icon>
    <path d="M9 6l6 6-6 6" />
  </Icon>
)

/**
 * An event's art in a box of its own size. The art pads itself in percentages,
 * which resolve against its container's width, so on its own in a wide row it
 * swells to fill it; a fixed box keeps it the size asked for.
 */
export function EventArtBox({ games, size }: { games: string[]; size: string }) {
  return (
    <span className="evp-art" style={{ '--ev-art-size': size } as CSSProperties} aria-hidden="true">
      <EventArt games={games} />
    </span>
  )
}

function triesWords(t: TournamentSummary): string {
  const n = t.rules.maxAttempts
  if (!n) return 'Unlimited tries'
  return n === 1 ? 'One try a game' : `${n} tries a game`
}

function playersWords(t: TournamentSummary): string {
  if (t.playerCount === 0) return 'Nobody’s in yet'
  return `${t.playerCount} ${t.playerCount === 1 ? 'player' : 'players'} in`
}

/** This week's Triple, with its games on their screens, ready to play. */
export function WeeklyHero({ t, joined }: { t: TournamentSummary; joined: boolean }) {
  const you = joined && t.yourPlace != null
  return (
    <section className="evp-hero evp-wash" style={accentStyle(t.games)} aria-labelledby="evp-weekly-title">
      <div className="evp-hero__text">
        <p className="evp-kick evp-kick--live">
          <span className="evp-dot" aria-hidden="true" />
          Live · The Weekly Triple · {eventSpan(t)}
        </p>
        <h1 id="evp-weekly-title" className="evp-hero__title">
          {gameList(t.games)}
        </h1>
        <p className="evp-hero__lede">
          Place on all {t.games.length === 3 ? 'three' : t.games.length} by Sunday night. Every place pays points, 1st the
          most, and the highest total takes the week and its trophy.
        </p>
        <p className="evp-metas">
          <span className="evp-meta">
            <ClockIcon />
            {formatEventCountdown(t.endsAt)}
          </span>
          <span className="evp-meta">
            <PeopleIcon />
            {playersWords(t)}
          </span>
          <span className="evp-meta">
            <RepeatIcon />
            {triesWords(t)}
          </span>
        </p>
        {you ? (
          <p className="evp-hero__you">
            You’re <b>{ordinal(t.yourPlace!)}</b>
            {t.yourPoints != null ? ` with ${t.yourPoints} ${t.yourPoints === 1 ? 'point' : 'points'}` : ''}.
          </p>
        ) : null}
        <div className="evp-acts">
          <a className="evp-btn" href={tournamentHref(t.id)}>
            {joined ? 'Keep playing' : 'Join the Triple'}
          </a>
          <a className="evp-btn evp-btn--ghost" href={`${tournamentHref(t.id)}#evp-how`}>
            How it scores
          </a>
        </div>
      </div>
      <ul className="evp-hero__games" aria-label={`This week’s ${t.games.length} games`}>
        {t.games.map((slug) => (
          <li key={slug} className="evp-hero__game">
            <EventScreen slug={slug} href={tournamentPlayHref(t.id, slug)} label={`Play ${gameName(slug)} for the Triple`} />
            <span className="evp-hero__game-name">{gameName(slug)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Today's daily: the game on a screen, the clock, and who leads. */
export function DailyCard({ t }: { t: TournamentSummary }) {
  const slug = t.games[0] ?? ''
  const leader = t.podium?.[0]
  return (
    <section className="evp-card evp-daily" style={accentStyle(t.games)} aria-labelledby="evp-daily-title">
      <div className="evp-daily__screen">
        <EventScreen slug={slug} href={tournamentPlayHref(t.id, slug)} label={`Play today’s ${gameName(slug)}`} />
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          Today
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="evp-daily-title" className="evp-card__title">
          {t.title}
        </h2>
        <p className="evp-card__copy">
          The best score by midnight takes the day, and a trophy.{' '}
          {leader
            ? `${leader.name} leads${leader.score != null ? ` with ${leader.score.toLocaleString()}` : ''}.`
            : 'Nobody has played yet, so any run leads.'}
        </p>
      </div>
      <div className="evp-daily__foot">
        <span className="evp-meta">
          <ClockIcon />
          {formatEventCountdown(t.endsAt)}
        </span>
        <a className="evp-btn evp-btn--small" href={tournamentPlayHref(t.id, slug)}>
          Play {gameName(slug)}
        </a>
      </div>
    </section>
  )
}

/** Today's One Shot: its game on a screen, one try each, the clock, and who leads. */
export function OneShotCard({ t }: { t: TournamentSummary }) {
  const slug = t.games[0] ?? ''
  const leader = t.podium?.[0]
  // Placed means the try is taken: the standings are where to go next.
  const placed = t.yourPlace != null
  const href = placed ? tournamentHref(t.id) : tournamentPlayHref(t.id, slug)
  return (
    <section className="evp-card evp-daily evp-oneshot" style={accentStyle(t.games)} aria-labelledby="evp-oneshot-title">
      <div className="evp-daily__screen">
        <EventScreen slug={slug} href={href} label={placed ? `The One Shot’s standings` : `Take your One Shot at ${gameName(slug)}`} />
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          One try
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="evp-oneshot-title" className="evp-card__title">
          {t.title}
        </h2>
        <p className="evp-card__copy">
          One try each, and it counts the moment you start.{' '}
          {placed
            ? `Yours placed ${ordinal(t.yourPlace!)}.`
            : leader
              ? `${leader.name} leads${leader.score != null ? ` with ${leader.score.toLocaleString()}` : ''}.`
              : 'Nobody has taken theirs yet.'}
        </p>
      </div>
      <div className="evp-daily__foot">
        <span className="evp-meta">
          <ClockIcon />
          {formatEventCountdown(t.endsAt)}
        </span>
        <a className="evp-btn evp-btn--small" href={href}>
          {placed ? 'Standings' : 'Take your shot'}
        </a>
      </div>
    </section>
  )
}

/** Last week's Triple: who won it, the podium, and the lesson it left. */
export function LastWeekCard({
  t,
  detail,
  lesson,
  me,
}: {
  t: TournamentSummary
  detail: TournamentDetail | null
  lesson: SkipLesson | null
  me: string
}) {
  const winner = t.winner ?? t.podium?.[0]?.name ?? ''
  const mine = Boolean(me) && normalizePlayerName(winner) === normalizePlayerName(me)
  const top = t.podium?.[0]
  const avatars = new Map((detail ? standingsTable(detail, '') : []).map((r) => [r.name, r.avatarId]))
  const podium = (t.podium ?? []).slice(0, 3)
  const order = [podium[1], podium[0], podium[2]].filter(Boolean)
  return (
    <section className="evp-card evp-last" style={accentStyle(t.games)} aria-labelledby="evp-last-title">
      <div className="evp-last__head">
        <span className="evp-trophy" aria-hidden="true">
          <TrophyIcon />
        </span>
        <div>
          <h2 id="evp-last-title" className="evp-card__title">
            {mine ? 'You won last week’s Triple' : `${winner} won last week’s Triple`}
          </h2>
          <p className="evp-card__copy">
            {top?.points ? `${top.points} points over ` : ''}
            {gameList(t.games)}
            {mine ? '. The trophy is on your player card.' : `, from ${t.playerCount} players.`}
          </p>
        </div>
      </div>
      {order.length ? (
        <ol className="evp-podium evp-podium--small" aria-label="Podium">
          {order.map((p) => (
            <li key={p!.name} className={`evp-podium__step evp-podium__step--${p!.place}`}>
              <a className="evp-podium__who" href={rankHref(p!.name)}>
                <PlayerAvatar name={p!.name} avatarId={avatars.get(normalizePlayerName(p!.name))} size="md" />
                <span className="evp-podium__name">{p!.name}</span>
                <span className="evp-podium__pts">{p!.points} pts</span>
              </a>
              <span className="evp-podium__block">{ordinal(p!.place)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {lesson ? (
        <p className="evp-lesson">
          <b>Every game counts.</b> {lesson.name} won {lesson.won.length === 1 ? gameName(lesson.won[0]) : `${lesson.won.length} of the ${t.games.length} games`}{' '}
          and finished {ordinal(lesson.place)}, with nothing from {gameList(lesson.skipped)}.
        </p>
      ) : null}
      <a className="evp-more" href={tournamentHref(t.id)}>
        Final standings
        <ChevronIcon />
      </a>
    </section>
  )
}

/** Making your own: what it is, a way to start one, and the ones you already have. */
export function OwnEventsCard({
  signedIn,
  mine,
  limits,
  linkFor,
}: {
  signedIn: boolean
  mine: TournamentSummary[]
  limits: PlanLimits
  linkFor: (t: TournamentSummary) => string
}) {
  return (
    <section className="evp-card evp-own" aria-labelledby="evp-own-title">
      <span className="evp-own__mark" aria-hidden="true">
        <PeopleIcon />
      </span>
      <div className="evp-own__text">
        <h2 id="evp-own-title" className="evp-card__title">
          Run your own
        </h2>
        <p className="evp-card__copy">
          Pick up to five games, top scores or a bracket, and invite friends by their tag. Only the people you invite can
          see it.
        </p>
      </div>
      <ul className="evp-own__list">
        <li>
          <ListIcon />
          Top scores: everyone posts runs, places pay points
        </li>
        <li>
          <BracketIcon />
          Bracket: head to head, a round at a time
        </li>
        <li>
          <LockIcon />
          Invite only, for an hour or a week
        </li>
      </ul>
      {signedIn ? (
        <a className="evp-btn evp-btn--ink" href={tournamentCreateHref()}>
          <PlusIcon />
          Create an event
        </a>
      ) : (
        <button type="button" className="evp-btn evp-btn--ink" onClick={openSiteMenu}>
          Sign in to make one
        </button>
      )}
      {signedIn ? (
        <div className="evp-own__yours">
          <p className="evp-cap">Yours</p>
          {mine.length ? (
            <ul className="evp-own__events">
              {mine.slice(0, 4).map((t) => (
                <li key={t.id}>
                  <a className="evp-own__event" href={linkFor(t)}>
                    <EventArtBox games={t.games} size="2.4rem" />
                    <span className="evp-own__event-text">
                      <span className="evp-own__event-title">{t.title}</span>
                      <span className="evp-own__event-sub">{ownStatus(t)}</span>
                    </span>
                    <ChevronIcon />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="evp-card__copy">
              Nothing running. Free accounts run {limits.activeEvents === 1 ? 'one event' : `${limits.activeEvents} events`} at a
              time, for up to {limits.maxDraw} players.
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function ownStatus(t: TournamentSummary): string {
  if (t.status === 'ended') return t.winner ? `${t.winner} won` : 'Ended'
  if (eventKind(t) === 'bracket' && t.status === 'upcoming') {
    const cap = t.rules.maxPlayers ?? 0
    return cap ? `${t.playerCount} of ${cap} seats taken` : 'Filling'
  }
  if (isUnlimitedDuration(t.rules)) return `${t.playerCount} in · until everyone finishes`
  return `${t.playerCount} in · ${formatEventCountdown(t.endsAt)}`
}

const HOW: [() => ReactNode, string, string][] = [
  [SunIcon, 'The daily', 'One game, all day. The best score by midnight takes it.'],
  [OneIcon, 'The One Shot', 'Another game, one try each, all day. It counts the moment you start.'],
  [ThreeIcon, 'The Weekly Triple', 'Three games, Monday to Sunday. Every place pays points, and the total wins.'],
  [LockIcon, 'Your own', 'Invite only. Top scores or a bracket, for an hour or a week.'],
  [MedalIcon, 'Trophies', 'Win any event and its trophy goes on your player card.'],
]

export function HowEventsWork() {
  return (
    <section className="evp-card evp-how-all" aria-labelledby="evp-how-all-title" data-hunt="events-how">
      <h2 id="evp-how-all-title" className="evp-card__title">
        How events work
      </h2>
      <ul className="evp-how-all__list">
        {HOW.map(([IconFor, title, text]) => (
          <li key={title}>
            <span className="evp-how-all__mark" aria-hidden="true">
              <IconFor />
            </span>
            <span className="evp-how-all__text">
              <b>{title}</b>
              <span>{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Finished events: the ones people played, a row each; the ones nobody did, together. */
export function ResultsList({
  lines,
  me,
  linkFor,
}: {
  lines: ResultLine[]
  me: string
  linkFor: (t: TournamentSummary) => string
}) {
  const you = normalizePlayerName(me)
  return (
    <section className="evp-results" aria-labelledby="evp-results-title">
      <h2 id="evp-results-title" className="evp-section-title">
        Results
      </h2>
      <ul className="evp-card evp-results__list">
        {lines.map((line) => {
          if (line.kind === 'quiet') {
            const games = [...new Set(line.events.flatMap((t) => t.games))].slice(0, 3)
            return (
              <li key="quiet" className="evp-result evp-result--quiet">
                <EventArtBox games={games} size="2.6rem" />
                <span className="evp-result__text">
                  <span className="evp-result__title">
                    {line.events.length === 1
                      ? `${line.events[0].title}: nobody played`
                      : `${line.events.length} ${line.events.every((t) => t.cadence === 'daily') ? 'dailies' : 'events'} nobody played`}
                  </span>
                  <span className="evp-result__sub">
                    {line.events
                      .slice(0, 4)
                      .map((t) => `${t.games.map(gameName).join(', ')} on ${eventDay(t)}`)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            )
          }
          const t = line.t
          const winner = t.winner ?? t.podium?.[0]?.name ?? null
          const top = t.podium?.[0]
          const mine = Boolean(you) && winner != null && normalizePlayerName(winner) === you
          const placed = !mine && t.yourPlace != null ? `You ${ordinal(t.yourPlace)}` : null
          return (
            <li key={t.id}>
              <a className="evp-result" href={linkFor(t)}>
                <EventArtBox games={t.games} size="2.6rem" />
                <span className="evp-result__text">
                  <span className="evp-result__title">{t.title}</span>
                  <span className="evp-result__sub">
                    {eventSpan(t)} · {t.playerCount} played
                    {placed ? ` · ${placed}` : ''}
                  </span>
                </span>
                {mine ? <span className="evp-won">You won</span> : null}
                {winner ? (
                  <span className="evp-result__winner">
                    <TrophyIcon />
                    <b>{winner}</b>
                    {top ? (
                      <span className="evp-result__score">
                        {top.score != null && t.format !== 'place-points' ? top.score.toLocaleString() : `${top.points} pts`}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
