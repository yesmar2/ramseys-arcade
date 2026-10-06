import { blueOf, MEDAL_NAMES, MEDAL_TICKETS, MEDALS, medalBeats, medalFor, medalTimes, nextMedal, raceGapWords, type Medal, type RaceGame } from '../lib/raceMedals'
import { TicketGlyph } from './prizes/Ticket'
import '../styles/raceMedals.css'

/*
 * A racing daily's medal (lib/raceMedals.ts): a disc on a ribbon, in its metal. Platinum has a sparkle on it,
 * so the four differ in more than their colour. Unwon, it's an outline only.
 */

const METAL: Record<Medal, { face: string; rim: string }> = {
  bronze: { face: '#d08a4c', rim: '#8f5426' },
  silver: { face: '#d3dbe2', rim: '#8794a0' },
  gold: { face: '#f4c53e', rim: '#a87c0c' },
  platinum: { face: '#b9f1fb', rim: '#3e9fb3' },
}

export function MedalIcon({ medal, size = 18, dim = false, className }: { medal: Medal; size?: number; dim?: boolean; className?: string }) {
  const m = METAL[medal]
  return (
    <svg
      className={`race-medal${dim ? ' race-medal--dim' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.2 1h4.1l3 8.6H9.2z" fill={dim ? 'none' : '#3d63b8'} stroke={dim ? 'currentColor' : 'none'} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M17.8 1h-4.1l-3 8.6h4.1z" fill={dim ? 'none' : '#2b4687'} stroke={dim ? 'currentColor' : 'none'} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="12" cy="15.6" r="6.6" fill={dim ? 'none' : m.face} stroke={dim ? 'currentColor' : m.rim} strokeWidth="1.4" />
      <circle cx="12" cy="15.6" r="4.3" fill="none" stroke={dim ? 'currentColor' : m.rim} strokeWidth="1" opacity={dim ? 0.6 : 0.55} />
      {medal === 'platinum' ? (
        <path d="M12 12.4c.3 2.1 1 2.8 3.1 3.2-2.1.3-2.8 1-3.1 3.1-.3-2.1-1-2.8-3.1-3.1 2.1-.4 2.8-1.1 3.1-3.2z" fill={dim ? 'currentColor' : '#ffffff'} />
      ) : null}
    </svg>
  )
}

/**
 * A racing daily's medals on its start card: the four, those won today lit, and the time the next one takes.
 * `format` says a time (in seconds) the way the game does.
 */
export function MedalRow({
  game,
  paceMs,
  bestMs,
  format,
}: {
  game: RaceGame
  paceMs: number
  bestMs: number | null
  format: (seconds: number) => string
}) {
  const held = medalFor(game, paceMs, bestMs)
  const next = nextMedal(game, paceMs, held)
  const won = held ? MEDALS.indexOf(held) : -1
  const said = `${held ? `${MEDAL_NAMES[held]} won today. ` : ''}${next ? `Next, ${MEDAL_NAMES[next.medal]}: ${format(next.ms / 1000)}` : 'That’s the top medal'}`
  // A tile on the start card: what's next in its label, the time it takes as its figure, the four under it.
  return (
    <div className="game-pause-meta__row race-medals-row" title={medalTitle(game, paceMs, format)}>
      <span aria-hidden="true">{next ? `Next medal · ${MEDAL_NAMES[next.medal]}` : 'Top medal won'}</span>
      <strong aria-label={said}>{next ? format(next.ms / 1000) : 'Platinum'}</strong>
      <div className="race-medals__icons" aria-hidden="true">
        {MEDALS.map((m, i) => (
          <MedalIcon key={m} medal={m} dim={i > won} size={17} />
        ))}
      </div>
    </div>
  )
}

/**
 * A racing daily's run on its report: the day's four medals as a ladder, each with the time it takes and the
 * tickets it pays, those the day's best holds lit, a new one marked, the next one waiting; and a line on how
 * far the next one is. Ramsey picked it (2026-10-05, "B · Medal ladder") once the report's one medal line
 * left him asking what the medals were. `previousMs` is the day's best before this run.
 */
export function MedalLadder({
  game,
  paceMs,
  ms,
  previousMs,
  format,
}: {
  game: RaceGame
  paceMs: number
  ms: number
  previousMs: number | null
  format: (seconds: number) => string
}) {
  const before = medalFor(game, paceMs, previousMs)
  const bestMs = previousMs != null && previousMs > 0 ? Math.min(ms, previousMs) : ms
  const held = medalFor(game, paceMs, bestMs)
  const fresh = held != null && medalBeats(held, before)
  const next = nextMedal(game, paceMs, held)
  const times = medalTimes(game, paceMs)
  const won = held ? MEDALS.indexOf(held) : -1
  const blue = blueOf(game)
  const then = next ? `${MEDAL_NAMES[next.medal]} is ` : ''
  const gap = next ? raceGapWords(bestMs - next.ms) : ''
  const at = next ? format(next.ms / 1000) : ''
  return (
    <section className="medal-ladder" aria-label="Today’s medals">
      <div className="medal-ladder__head">
        <span className="medal-ladder__title">Today’s medals</span>
        <span className="medal-ladder__blue">
          {blue.charAt(0).toUpperCase() + blue.slice(1)} {format(paceMs / 1000)}
        </span>
      </div>
      <ol className="medal-ladder__steps">
        {MEDALS.map((medal, i) => {
          const state = i <= won ? 'won' : next?.medal === medal ? 'next' : 'later'
          const tag = fresh && medal === held ? 'New' : state === 'next' ? 'Next' : null
          return (
            <li key={medal} className={`medal-ladder__step medal-ladder__step--${state} medal-ladder__step--${medal}`}>
              {tag ? <span className={`medal-ladder__tag medal-ladder__tag--${tag.toLowerCase()}`}>{tag}</span> : null}
              <MedalIcon medal={medal} dim={state !== 'won'} size={30} />
              <span className="medal-ladder__name">{MEDAL_NAMES[medal]}</span>
              <span className="medal-ladder__time">{format(times[medal] / 1000)}</span>
              <span className="medal-ladder__tix">
                <TicketGlyph size={16} dim={state === 'later'} />
                {MEDAL_TICKETS[medal]}
                <span className="visually-hidden"> tickets{state === 'won' ? ', won today' : state === 'next' ? ', next' : ''}</span>
              </span>
            </li>
          )
        })}
      </ol>
      <p className="medal-ladder__said">
        {!held ? 'No medal yet. ' : fresh ? `${MEDAL_NAMES[held]}! ` : `Your best has ${MEDAL_NAMES[held]}. `}
        {next ? (
          <>
            {then}
            <span className="medal-ladder__gap">{gap}</span> faster, at {at}.
          </>
        ) : (
          'That’s the top medal.'
        )}
      </p>
    </section>
  )
}

/** Every medal's time, for the row's tip: "Bronze 57.75s · Silver 54.28s · Gold 50.82s · Platinum 47.35s". */
function medalTitle(game: RaceGame, paceMs: number, format: (seconds: number) => string): string {
  const times = medalTimes(game, paceMs)
  return MEDALS.map((m) => `${MEDAL_NAMES[m]} ${format(times[m] / 1000)}`).join(' · ')
}
