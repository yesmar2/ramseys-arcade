import { useEffect, useReducer, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameHref, gamePlayHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { capitalName, huntDay, huntPick, huntStats, openBugHunt, subscribeHunt } from '../lib/bugHunt'
import { dailyWords } from '../lib/dailyWords'
import { normalizePlayerName } from '../lib/leaderboard'
import { numberWord } from '../lib/numberWord'
import { TODAY_KEEP } from '../lib/today'
import type { TournamentSummary } from '../lib/tournaments'
import { DailyKindTag } from './DailyKindTag'
import { GameArt } from './GameArt'
import { FlameIcon } from './TodayChip'
import { streakLine, todayShareUrl, type Punch, type Ticket } from './todayPunches'
import '../styles/today.css'

/*
 * Today's ticket, on the Dailies page (lib/today.ts, pages/TodayPage.tsx): a stub with the streak, then the
 * day's live dailies as tiles, all across on a desktop and three a row on a phone. Each tile is its game's
 * picture and name, which open its page, then how it went or the way in; the day's own course is their tip.
 * Under them, the bonus punches (today's event, the One Shot and the bug hunt, which don't count). What this
 * device has done punches at once; the streak is the API's, for a signed-in account. The punches themselves
 * are todayPunches.ts's, which the home page's Today row draws from too. Ramsey picked the tiles on
 * 2026-10-01, over a ticket of six columns of words ("lot of text, plus we have six games in there now").
 */

export const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
)
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13l10.5-6.5z" />
  </svg>
)
const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V3" />
    <path d="M7.5 7.5L12 3l4.5 4.5" />
    <path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
  </svg>
)

/** The bug hunt, for its bonus punch: who's loose today, and whether you've caught it. */
function useHuntPunch(): { name: string; found: boolean } {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeHunt(refresh), [])
  return { name: capitalName(huntPick(huntDay()).bug), found: huntStats().foundToday }
}

function eventGame(t: TournamentSummary): string {
  const slug = t.games[0]
  return t.games.length === 1 && slug ? (getGame(slug)?.name ?? slug) : `${t.games.length} games`
}

/** The day's other things, which don't count: a chip each. */
function BonusPunches() {
  const name = normalizePlayerName(usePlayerName())
  const { official } = useLiveEvents(name)
  const hunt = useHuntPunch()
  const daily = official.find((t) => t.cadence === 'daily') ?? null
  const oneShot = official.find((t) => t.cadence === 'oneshot') ?? null
  const chip = (t: TournamentSummary, word: string) => (
    <li key={t.id}>
      <a className="today-bonus" href={tournamentHref(t.id)}>
        {word} · {eventGame(t)}
      </a>
    </li>
  )
  return (
    <div className="today-card__bonus">
      <span className="today-card__label" id="today-bonus-label">
        Bonus
      </span>
      <ul aria-labelledby="today-bonus-label">
        {daily ? chip(daily, 'Today’s event') : null}
        {oneShot ? chip(oneShot, 'One Shot') : null}
        <li>
          <button type="button" className={`today-bonus${hunt.found ? ' today-bonus--done' : ''}`} onClick={openBugHunt}>
            {hunt.found ? <CheckIcon /> : null}
            {hunt.found ? `Caught ${hunt.name}` : `Bug hunt · ${hunt.name}`}
          </button>
        </li>
      </ul>
    </div>
  )
}

/** The share: the phone's share sheet where there is one, else copied. `short`, it says only "Share". */
export function ShareDay({ text, day, all, short = false, className }: { text: string; day: string; all: boolean; short?: boolean; className: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(t)
  }, [copied])
  const share = async () => {
    const url = todayShareUrl(day)
    const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    if (touch && navigator.share) {
      try {
        await navigator.share({ text: `${text}\n${url}` })
        return
      } catch {
        /* closed, or not allowed: copy instead */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setCopied(true)
    } catch {
      /* nothing to copy to */
    }
  }
  return (
    <button type="button" className={className} onClick={() => void share()}>
      <ShareIcon />
      {copied ? 'Copied' : short ? 'Share' : all ? 'Share your day' : 'Share so far'}
    </button>
  )
}

/** The day's own course, for a tile's tip: "Hole #7 · Meadow Flipper". */
const courseOf = (p: Punch) => `${p.kicker.replace(/^Today’s\s+/, '')} · ${p.title}`

/**
 * A daily's tile: its picture and name, which open its page, then how it went or the way in, by the game's
 * own verb (Race, Pour, Fly). Whether it's ranked or just for fun is a mark on the picture's top corner, with
 * a tip of its own, so it sits beside the picture's link rather than in it; punched is a check on the other.
 */
function Tile({ punch: p }: { punch: Punch }) {
  const page = gameHref(p.slug)
  const course = courseOf(p)
  // Left halfway: the same way in, which carries on where it was left.
  const carried = p.carry?.replace(/^Carry on,?\s*/, '') ?? ''
  return (
    <li className={`today-tile${p.done ? ' today-tile--done' : ''}`}>
      <div className="today-tile__pic">
        <a className="today-tile__art" href={page} title={course} tabIndex={-1} aria-hidden="true">
          <GameArt slug={p.slug} className="today-tile__scene" />
        </a>
        <DailyKindTag slug={p.slug} look="badge" className="today-tile__kind" />
        {p.done ? (
          <span className="today-tile__check" aria-hidden="true">
            <CheckIcon />
          </span>
        ) : null}
      </div>
      <a className="today-tile__game today-game" href={page} title={course}>
        {p.game}
      </a>
      {p.done ? (
        <span className="today-tile__result">
          <CheckIcon />
          <span className="visually-hidden">Punched: </span>
          {p.short ?? 'Done'}
        </span>
      ) : (
        <a
          className="today-tile__go"
          href={gamePlayHref(p.slug)}
          title={p.carry ?? undefined}
          aria-label={p.carry ? `Carry on ${p.game}${carried ? `, ${carried}` : ''}` : `${dailyWords(p.slug).verb} ${p.game}`}
        >
          <PlayIcon />
          {p.carry ? 'Carry on' : dailyWords(p.slug).verb}
        </a>
      )}
    </li>
  )
}

/** The ticket, for the viewer the page drew it for (todayPunches.ts's useTicket). */
export function TodayCard({ ticket, signedIn }: { ticket: Ticket; signedIn: boolean }) {
  const { day, punches, done: doneN, total, all, rule, marks, current, shareText } = ticket
  const more = rule.count > TODAY_KEEP
  if (!punches.length) return null

  return (
    <section className="today" aria-labelledby="today-title">
      <div className="today-card today-card--tiles">
        <div className="today-card__stub">
          <span className="today-card__notch today-card__notch--a" aria-hidden="true" />
          <span className="today-card__notch today-card__notch--b" aria-hidden="true" />
          <span className="today-card__label today-card__kicker">Your streak</span>
          {signedIn ? (
            <p className="today-streak">
              <span className="today-streak__n">{current}</span>
              <FlameIcon />
              <span className="today-streak__line">
                <span className="visually-hidden">{current === 1 ? 'day' : 'days'} in a row. </span>
                {streakLine(ticket)}.
              </span>
            </p>
          ) : (
            <p className="today-streak__line">Sign in to keep a streak: {more ? 'any three' : `all ${numberWord(total)}`} a day.</p>
          )}
          {/* The day's punches, done first; gold once it's a Full ticket. The head says the count aloud. */}
          <span className={`today-pips${marks.full ? ' today-pips--full' : ''}`} aria-hidden="true">
            {punches.map((p, i) => (
              <span key={p.key} className={`today-pips__pip${i < doneN ? ' today-pips__pip--on' : ''}`} />
            ))}
            <span className="today-pips__count">
              {doneN} of {total}
            </span>
          </span>
        </div>

        <div className="today-card__body">
          <div className="today-card__head">
            <h2 id="today-title" className="today-card__title">
              Today’s ticket
            </h2>
            {/* The page's own heading names the day. */}
            <p className="today-card__count">
              {doneN} of {total}
              <span className="today-card__count-word"> done</span>
            </p>
            {doneN > 0 ? <ShareDay text={shareText} day={day} all={all} short className="today-card__share" /> : null}
          </div>
          <ul className={`today-tiles${total > 4 ? ' today-tiles--many' : ''}`} style={{ '--n': total } as CSSProperties}>
            {punches.map((p) => (
              <Tile key={p.key} punch={p} />
            ))}
          </ul>
          <BonusPunches />
        </div>
      </div>
    </section>
  )
}
