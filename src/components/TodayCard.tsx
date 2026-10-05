import { useEffect, useReducer, useState } from 'react'
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
import { CheckIcon, DayTicket, DoneCount, type TicketTile } from './DayTicket'
import { MedalIcon } from './RaceMedal'
import { MEDAL_NAMES } from '../lib/raceMedals'
import { streakLine, todayShareUrl, type Punch, type Ticket } from './todayPunches'

/*
 * Today's ticket, on the Dailies page (lib/today.ts, pages/TodayPage.tsx), in the frame every day's ticket
 * has (DayTicket.tsx): the streak on its stub, the day's live dailies as tiles, and under them the bonus
 * punches (today's event, the One Shot and the bug hunt, which don't count). A tile's picture and name open
 * its game's page, and its button plays today's. What this device has done punches at once; the streak is
 * the API's, for a signed-in account. The punches themselves are todayPunches.ts's, which the home page's
 * Today row draws from too.
 */

// The ticket's check, for the Dailies bar, the strip of days and the page, which have always taken it from here.
export { CheckIcon }

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
/**
 * Today's medals on the racing dailies (lib/raceMedals.ts), and the day's goal: gold or better on all of them.
 * Ramsey picked medals to give every visit a goal (2026-10-05). Each opens its game, to go after the next one.
 */
function MedalGoal({ punches }: { punches: Punch[] }) {
  const racing = punches.filter((p) => p.key === 'track' || p.key === 'course' || p.key === 'cave')
  if (!racing.length) return null
  const golds = racing.filter((p) => p.medal === 'gold' || p.medal === 'platinum').length
  const all = numberWord(racing.length)
  return (
    <div className="today-card__bonus today-card__medals">
      <span className="today-card__label" id="today-medals-label">
        Medals
      </span>
      <ul aria-labelledby="today-medals-label">
        {racing.map((p) => (
          <li key={p.key}>
            <a className="today-bonus" href={gamePlayHref(p.slug)} title={p.medal ? `${MEDAL_NAMES[p.medal]} medal` : 'No medal yet'}>
              <MedalIcon medal={p.medal ?? 'bronze'} dim={!p.medal} size={18} />
              {p.game}
              <span className="visually-hidden">: {p.medal ? `${MEDAL_NAMES[p.medal]} medal` : 'no medal yet'}</span>
            </a>
          </li>
        ))}
        <li className="today-medals__goal">{golds >= racing.length ? `Gold on all ${all} today!` : `Gold on all ${all}: ${golds} of ${racing.length}`}</li>
      </ul>
    </div>
  )
}

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

/**
 * A punch's tile: its picture and name open its game's page; done, how it went; still to play, the game's
 * own verb (Race, Pour, Fly), or Carry on for one left halfway, which the game takes up where it was left.
 */
function tileOf(p: Punch): TicketTile {
  const verb = dailyWords(p.slug).verb
  const carried = p.carry?.replace(/^Carry on,?\s*/, '') ?? ''
  return {
    key: p.key,
    slug: p.slug,
    game: p.game,
    course: `${p.kicker.replace(/^Today’s\s+/, '')} · ${p.title}`,
    page: gameHref(p.slug),
    done: p.done,
    result: p.done ? (p.short ?? 'Done') : null,
    note: null,
    medal: p.done ? (p.medal ?? null) : null,
    play: gamePlayHref(p.slug),
    go: p.carry ? 'Carry on' : verb,
    goLabel: p.carry ? `Carry on ${p.game}${carried ? `, ${carried}` : ''}` : `${verb} ${p.game}`,
    goTip: p.carry,
  }
}

/** The ticket, for the viewer the page drew it for (todayPunches.ts's useTicket). */
export function TodayCard({ ticket, signedIn }: { ticket: Ticket; signedIn: boolean }) {
  const { day, punches, server, done, total, all, rule, marks, current, shareText } = ticket
  if (!punches.length) return null
  const more = rule.count > TODAY_KEEP
  // The streak is the API's: until it answers, nothing rather than a streak of none.
  const known = signedIn && server != null
  return (
    <DayTicket
      labelId="today-title"
      title="Today’s ticket"
      count={<DoneCount done={done} total={total} />}
      action={done > 0 ? <ShareDay text={shareText} day={day} all={all} short className="today-card__share" /> : null}
      kicker="Your streak"
      streak={known ? current : null}
      full={marks.full}
      line={known ? `${streakLine(ticket)}.` : signedIn ? null : `Sign in to keep a streak: ${more ? 'any three' : `all ${numberWord(total)}`} a day.`}
      freezes={known ? server?.freezes : null}
      punched={{ done, total }}
      tiles={punches.map(tileOf)}
    >
      <MedalGoal punches={punches} />
      <BonusPunches />
    </DayTicket>
  )
}
