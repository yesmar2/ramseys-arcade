import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { navigate, tournamentCreateHref } from '../hooks/useHashRoute'
import { usePendingInvites } from '../hooks/usePendingInvites'
import { eventSpan, ordinal, type ResultLine } from '../lib/eventPages'
import { inviteTargetHref } from '../lib/invites'
import { normalizePlayerName } from '../lib/leaderboard'
import {
  eventKind,
  formatEventCountdown,
  hasNoEnd,
  joinedRosterLabel,
  lobbyClosed,
  type TournamentSummary,
} from '../lib/tournaments'
import { CloseIcon, InviteIcon } from './chromeIcons'
import { EventArt } from './EventCard'
import { Panel, PanelHead } from './Panel'
import { InfoIcon } from './pastIcons'
import { openSiteMenu } from './siteNav'

/*
 * The events page as one list (Ramsey's pick A from the "Events page, calmer" canvas, 2026-11-17: "Build A",
 * after "less wording ... the site is just too busy"): a heading with an ⓘ and New event, invites as rows,
 * what's live, then what's done. How events work lives behind the ⓘ, not on the page.
 */

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

/** New event: the maker, or, with no session at all, the way in (a session whose account isn't known yet gets the maker). */
function NewEvent({ signedOut }: { signedOut: boolean }) {
  const inner = (
    <>
      <PlusIcon />
      New<span className="evh-new__more"> event</span>
    </>
  )
  return signedOut ? (
    <button type="button" className="evp-btn evh-new" aria-label="New event" onClick={openSiteMenu}>
      {inner}
    </button>
  ) : (
    <a className="evp-btn evh-new" aria-label="New event" href={tournamentCreateHref()}>
      {inner}
    </a>
  )
}

/** The page's heading: its name, the ⓘ for how events work, and New event. Also the day's Blip's hiding place here (bugHunt.ts events-how). */
export function EventsHead({ signedOut, onHow }: { signedOut: boolean; onHow: () => void }) {
  return (
    <div className="evh-head" data-hunt="events-how">
      <h1 className="evh-title">Events</h1>
      <button type="button" className="evh-info" aria-label="How events work" onClick={onHow}>
        <InfoIcon />
      </button>
      <NewEvent signedOut={signedOut} />
    </div>
  )
}

/** Event invites waiting for you, a row each: what it is, who asked, Join or no. */
export function EventInvites() {
  const { invites, error, busyId, accept, decline } = usePendingInvites()
  const rows = invites.filter((i) => i.kind === 'tournament')
  if (rows.length === 0 && !error) return null
  return (
    <section className="evh-invites" aria-label="Event invites">
      {error ? <p className="tour-note tour-note--error">{error}</p> : null}
      {rows.length > 0 ? (
        <ul className="evh-invites__list">
          {rows.map((invite) => {
            const busy = busyId === invite.id
            return (
              <li key={invite.id} className="evh-invite">
                <span className="evh-invite__mark" aria-hidden="true">
                  <InviteIcon />
                </span>
                <span className="evh-invite__text">
                  <b>{invite.targetName}</b>
                  {invite.fromName ? <span>from {invite.fromName}</span> : null}
                </span>
                <button
                  type="button"
                  className="evp-btn evp-btn--small"
                  disabled={busy}
                  onClick={() => {
                    void accept(invite.id).then((result) => {
                      if (result) navigate(inviteTargetHref(invite))
                    })
                  }}
                >
                  {busy ? '…' : 'Join'}
                </button>
                <button
                  type="button"
                  className="evh-invite__no"
                  aria-label={`Decline ${invite.targetName}`}
                  disabled={busy}
                  onClick={() => void decline(invite.id)}
                >
                  <CloseIcon />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

type Lead = { text: string; tone: 'p1' | 'p2' | 'p3' | 'place' | 'go' | 'quiet' }

function clockWords(t: TournamentSummary): string {
  return hasNoEnd(t) ? 'Until everyone finishes' : formatEventCountdown(t.endsAt)
}

/** A live event's one line: where you stand (or what's yours to do) first, then the clock. */
function liveLine(t: TournamentSummary, me: string, joined: boolean): { lead: Lead | null; rest: string } {
  if (eventKind(t) === 'bracket') {
    if (t.status === 'upcoming') return { lead: { text: 'Filling', tone: 'quiet' }, rest: `${joinedRosterLabel(t)} in` }
    const round = t.nextDeadlineAt != null && t.nextDeadlineAt > 0 ? formatEventCountdown(t.nextDeadlineAt) : ''
    const match = me ? (t.openMatches ?? []).find((m) => normalizePlayerName(m.a) === me || normalizePlayerName(m.b) === me) : null
    if (match) {
      const other = normalizePlayerName(match.a) === me ? match.b : match.a
      return { lead: { text: `vs ${other}`, tone: 'go' }, rest: round }
    }
    return { lead: null, rest: round ? `Bracket · ${round}` : 'Bracket' }
  }
  if (t.status === 'upcoming') return { lead: null, rest: `Starts in ${formatEventCountdown(t.startsAt).replace(/ left$/, '')}` }
  const place = t.yourPlace
  if (place != null) {
    const tone = place === 1 ? 'p1' : place === 2 ? 'p2' : place === 3 ? 'p3' : 'place'
    return { lead: { text: ordinal(place), tone }, rest: clockWords(t) }
  }
  if (joined) return { lead: { text: 'Not played', tone: 'go' }, rest: clockWords(t) }
  return { lead: null, rest: `${t.playerCount} in · ${clockWords(t)}` }
}

/** What's on: a row each, its art, its name, and one line. */
export function LiveList({
  events,
  me,
  isJoined,
  linkFor,
}: {
  events: TournamentSummary[]
  me: string
  isJoined: (t: TournamentSummary) => boolean
  linkFor: (t: TournamentSummary) => string
}) {
  return (
    <section className="evh-section" aria-labelledby="evh-live">
      <h2 id="evh-live" className="evh-label">
        Live <span className="evh-count">{events.length}</span>
      </h2>
      <ul className="evp-card evh-rows">
        {events.map((t) => {
          const { lead, rest } = liveLine(t, me, isJoined(t))
          return (
            <li key={t.id}>
              <a className="evh-row" href={linkFor(t)}>
                <EventArtBox games={t.games} size="3.4rem" />
                <span className="evh-row__text">
                  <span className="evh-row__name">{t.title}</span>
                  <span className="evh-row__sub">
                    {lead ? <b className={`evh-lead evh-lead--${lead.tone}`}>{lead.text}</b> : null}
                    {lead && rest ? ' · ' : null}
                    {rest}
                  </span>
                </span>
                <ChevronIcon />
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** How many finished events show before "Show more". */
const DONE_SHOWN = 5

/** Finished events: a row each with who won; the ones nobody played gathered into one quiet row. */
export function DoneList({
  lines,
  me,
  linkFor,
}: {
  lines: ResultLine[]
  me: string
  linkFor: (t: TournamentSummary) => string
}) {
  const [all, setAll] = useState(false)
  const you = normalizePlayerName(me)
  const shown = all ? lines : lines.slice(0, DONE_SHOWN)
  const more = lines.length - shown.length
  return (
    <section className="evh-section" aria-labelledby="evh-done">
      <h2 id="evh-done" className="evh-label">
        Done
      </h2>
      <ul className="evp-card evh-rows evh-rows--done">
        {shown.map((line) => {
          if (line.kind === 'quiet') {
            const games = [...new Set(line.events.flatMap((t) => t.games))].slice(0, 3)
            return (
              <li key="quiet" className="evh-row evh-row--quiet">
                <EventArtBox games={games} size="3.4rem" />
                <span className="evh-row__text">
                  <span className="evh-row__name">
                    {line.events.length === 1 ? line.events[0].title : `${line.events.length} events`}
                  </span>
                  <span className="evh-row__sub">Nobody played</span>
                </span>
              </li>
            )
          }
          const t = line.t
          const winner = t.winner ?? t.podium?.[0]?.name ?? null
          const mine = Boolean(you) && winner != null && normalizePlayerName(winner) === you
          return (
            <li key={t.id}>
              <a className="evh-row" href={linkFor(t)}>
                <EventArtBox games={t.games} size="3.4rem" />
                <span className="evh-row__text">
                  <span className="evh-row__name">{t.title}</span>
                  <span className="evh-row__sub">{eventSpan(t)}</span>
                </span>
                {lobbyClosed(t) ? (
                  <span className="evh-row__end">Didn’t fill</span>
                ) : mine ? (
                  <span className="evh-won">
                    <TrophyIcon />
                    You won
                  </span>
                ) : winner ? (
                  <span className="evh-winner">
                    <TrophyIcon />
                    {winner}
                  </span>
                ) : (
                  <span className="evh-row__end">No winner</span>
                )}
                <ChevronIcon />
              </a>
            </li>
          )
        })}
      </ul>
      {more > 0 ? (
        <button type="button" className="evh-more" onClick={() => setAll(true)}>
          Show {more} more
        </button>
      ) : null}
    </section>
  )
}

/** Nothing on for you: three games fanned out, three words, and the way to make one. */
export function EventsEmpty({ signedOut }: { signedOut: boolean }) {
  return (
    <section className="evp-card evh-empty" aria-labelledby="evh-empty-title">
      <span className="evh-fan" aria-hidden="true">
        <span className="evh-fan__card evh-fan__card--l">
          <EventArtBox games={['snake']} size="6.5rem" />
        </span>
        <span className="evh-fan__card evh-fan__card--r">
          <EventArtBox games={['frenzy']} size="6.5rem" />
        </span>
        <span className="evh-fan__card evh-fan__card--m">
          <EventArtBox games={['pop']} size="7rem" />
        </span>
      </span>
      <h2 id="evh-empty-title" className="evh-empty__title">
        Play your friends
      </h2>
      <NewEvent signedOut={signedOut} />
    </section>
  )
}

/*
 * How events work, from the ⓘ: a line each, a few words apiece. The arcade's own events join in while they run
 * (the API's siteEvents.ts), and a trophy needs a field to beat (the API's TROPHY_FIELD_OFFICIAL and
 * TROPHY_FIELD_HOSTED: 5 and 3 players).
 */
export function HowEventsModal({ siteEvents, onClose }: { siteEvents: boolean; onClose: () => void }) {
  const titleId = useId()
  const lines: [string, ReactNode, string][] = [
    ...(siteEvents
      ? ([
          ['Today’s event', <SunIcon key="sun" />, 'One game, all day'],
          ['One Shot', <OneIcon key="one" />, 'One try each'],
          ['Weekly Triple', <ThreeIcon key="three" />, 'Three games, all week'],
        ] as [string, ReactNode, string][])
      : []),
    ['Top scores', <ListIcon key="list" />, 'Best run wins'],
    ['Bracket', <BracketIcon key="bracket" />, 'Head to head, round by round'],
    ['Invite only', <LockIcon key="lock" />, 'Only people you invite see it'],
    ['Trophy', <TrophyIcon key="trophy" />, siteEvents ? 'Beat 2 or more in yours, 4 or more in the arcade’s' : 'Beat 2 or more players'],
  ]
  return (
    <Panel labelledBy={titleId} onClose={onClose} className="evh-how">
      <PanelHead titleId={titleId} title="How events work" icon={<InfoIcon />} onClose={onClose} />
      <div className="panel__body">
        <ul className="evh-how__lines">
          {lines.map(([title, icon, text]) => (
            <li key={title} className="evh-how__line">
              <span className={`evh-how__mark${title === 'Trophy' ? ' evh-how__mark--gold' : ''}`}>{icon}</span>
              <span className="evh-how__text">
                <b>{title}</b>
                <span>{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel__actions">
        <button type="button" className="panel__btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </Panel>
  )
}
