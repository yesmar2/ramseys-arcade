import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { tournamentHref, tournamentsHref } from '../hooks/useHashRoute'
import { inkOn } from '../lib/color'
import { ordinal } from '../lib/profileMath'
import {
  formatEventCountdown,
  getJoinedTournamentIds,
  getTournamentInvite,
  howItWins,
  isUnlimitedDuration,
  type TournamentSummary,
} from '../lib/tournaments'
import { ChevronRightIcon, TimerIcon } from './chromeIcons'
import { EventArt, eventAccent } from './EventCard'
import { EventCountdown } from './EventCountdown'

/** When an event ends, as a day and a time: the minute before midnight, not the midnight after. */
function endsLine(t: TournamentSummary): string {
  if (isUnlimitedDuration(t.rules)) return 'No end set'
  try {
    const at = new Date(t.endsAt - 60_000)
    const day = at.toLocaleDateString(undefined, { weekday: 'long' })
    const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `Ends ${day} at ${time}`
  } catch {
    return ''
  }
}

/**
 * The events a game is in, from its page: each with its games, how long it has
 * left, how it's won and who's in, and a way into it.
 */
export function GameHubEvents({ gameName, events }: { gameName: string; events: TournamentSummary[] }) {
  const joined = new Set(getJoinedTournamentIds())
  const shown = events.slice(0, 2)
  return (
    <section className="gh-card gh-events" aria-labelledby="gh-events-title">
      <div className="gh-card__head">
        <h2 id="gh-events-title" className="gh-cap">
          {gameName} is in {events.length === 1 ? 'an event' : `${events.length} events`}
        </h2>
        <a className="gh-more" href={tournamentsHref()}>
          All events
          <ChevronRightIcon />
        </a>
      </div>
      {shown.map((t) => (
        <EventBlock key={t.id} t={t} joined={Boolean(t.joined) || joined.has(t.id) || t.yourPlace != null} />
      ))}
    </section>
  )
}

function EventBlock({ t, joined }: { t: TournamentSummary; joined: boolean }) {
  const href = tournamentHref(t.id, t.private ? (getTournamentInvite(t.id) ?? undefined) : undefined)
  const accent = eventAccent(t.games)
  const games = t.games.map((slug) => getGame(slug)?.name ?? slug).join(' · ')
  const upcoming = t.status === 'upcoming'
  const who =
    t.yourPlace != null
      ? `You’re ${ordinal(t.yourPlace)}${t.yourPoints ? ` with ${t.yourPoints} points` : ''}, of ${t.playerCount}.`
      : t.playerCount === 0
        ? 'Nobody has joined yet.'
        : `${t.playerCount} ${t.playerCount === 1 ? 'player is' : 'players are'} in.`
  return (
    <div className="gh-event" style={{ '--event-accent': accent, '--event-ink': inkOn(accent) } as CSSProperties}>
      <a className="gh-event__head" href={href}>
        {/* The art's padding is a share of its box, so it sits in a box of its own size. */}
        <span className="gh-event__art">
          <EventArt games={t.games} />
        </span>
        <span className="gh-event__text">
          <span className="gh-event__title">{t.title}</span>
          <span className="gh-event__games">{games}</span>
        </span>
      </a>
      <div className="gh-event__clock">
        <span className="gh-event__clock-mark" aria-hidden="true">
          <TimerIcon />
        </span>
        <span className="gh-event__clock-text">
          <b>
            {upcoming ? (
              `Starts in ${formatEventCountdown(t.startsAt).replace(/ left$/, '')}`
            ) : (
              <EventCountdown endsAt={t.endsAt} unlimitedDuration={isUnlimitedDuration(t.rules)} />
            )}
          </b>
          {!upcoming ? <small>{endsLine(t)}</small> : null}
        </span>
      </div>
      <p className="gh-event__how">
        {howItWins(t)}. {who}
      </p>
      <a className="gh-event__go" href={href}>
        {joined ? 'Open the event' : upcoming ? 'See the event' : `Join the ${t.title}`}
      </a>
    </div>
  )
}
