import { useEffect, useReducer, useState, type CSSProperties } from 'react'
import { getGame, isRankedGame } from '../data/games'
import { gameBoardHref, gameHref, gamePlayHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { capitalName, huntDay, huntPick, huntStats, openBugHunt, subscribeHunt } from '../lib/bugHunt'
import { normalizePlayerName } from '../lib/leaderboard'
import { numberWord } from '../lib/numberWord'
import { ordinal } from '../lib/profileMath'
import {
  rivalResult,
  rivalStanding,
  rivalWords,
  TODAY_DAILIES,
  TODAY_KEEP,
  type TodayKey,
  type TodayRivals as Rivals,
} from '../lib/today'
import type { TournamentSummary } from '../lib/tournaments'
import { resolveGameAccent } from '../lib/theme'
import { BugPortrait } from './BugHunt'
import { DailyKindMark, DailyKindTag } from './DailyKindTag'
import { GameArt } from './GameArt'
import { GameThumbArt } from './GameThumbArt'
import { FlameIcon, StarIcon } from './TodayChip'
import { dayParts, shortDate, streakLine, todayShareUrl, WEEKDAY_NAMES, type Punch, type Ticket } from './todayPunches'
import '../styles/runLabel.css'
import '../styles/today.css'

/*
 * Today's ticket, on the Dailies page (lib/today.ts, pages/TodayPage.tsx): the day's live dailies as punches,
 * all across on a desktop, and on a phone a strip with one of them shown big (the next to play, or the one
 * picked), the streak on its stub with the week under it, the day's share, and the bonus punches (today's
 * event, the One Shot and the bug hunt, which don't count). What this device has done punches at once;
 * the streak is the API's, for a signed-in account. The punches themselves are todayPunches.ts's, which
 * the home page's Today row draws from too.
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
/** The practice label's loop (RunLabel.tsx), beside a punched daily's word that playing it again is practice. */
const LoopIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7" />
  </svg>
)
const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V3" />
    <path d="M7.5 7.5L12 3l4.5 4.5" />
    <path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
  </svg>
)

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** A punched daily whose first result counts: playing today's again is practice, in the practice label's colour. */
function Again({ punch }: { punch: Punch }) {
  if (!punch.again) return null
  return (
    <span className="today-again run-label--practice">
      <LoopIcon />
      {punch.again}
    </span>
  )
}

/** The way to a punch's game's past courses: its page's Past tab. Named with the game, for a list of links read aloud. */
function PastLink({ punch, className }: { punch: Punch; className: string }) {
  return (
    <a className={`today-past ${className}`} href={punch.pastHref} aria-label={`${punch.game}: ${punch.pastTab}`}>
      {punch.pastTab} ›
    </a>
  )
}

/** The bug hunt, for its bonus punch: who's loose today, and whether you've caught it. */
function useHuntPunch(): { name: string; bugId: string; found: boolean } {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeHunt(refresh), [])
  const pick = huntPick(huntDay())
  return { name: capitalName(pick.bug), bugId: pick.bug.id, found: huntStats().foundToday }
}

/**
 * A punch's line on the rivals: where you stand among them, or who leads while you haven't. None on a daily
 * just for fun (data/games.ts Game.ranked): nobody leads it.
 */
function rivalLine(data: Rivals | null, key: TodayKey): string | null {
  if (!data) return null
  const slug = TODAY_DAILIES.find((d) => d.key === key)?.slug
  if (slug && !isRankedGame(slug)) return null
  const standing = rivalStanding(data.rivals, key)
  if (!standing) return null
  if ('leader' in standing) return `${standing.leader.name} leads, ${rivalWords(key, rivalResult(standing.leader, key)!)}`
  if (standing.place === 1) return data.scope.kind === 'group' ? `Best in ${data.scope.name}` : 'Best of your friends'
  return `${ordinal(standing.place)} of ${standing.field} today`
}

function eventGame(t: TournamentSummary): string {
  const slug = t.games[0]
  return t.games.length === 1 && slug ? (getGame(slug)?.name ?? slug) : `${t.games.length} games`
}

function BonusPunches() {
  const name = normalizePlayerName(usePlayerName())
  const { official } = useLiveEvents(name)
  const hunt = useHuntPunch()
  const daily = official.find((t) => t.cadence === 'daily') ?? null
  const oneShot = official.find((t) => t.cadence === 'oneshot') ?? null
  const chip = (t: TournamentSummary, word: string) => {
    const slug = t.games[0] ?? ''
    return (
      <li key={t.id}>
        <a className="today-bonus" href={tournamentHref(t.id)}>
          <GameThumbArt slug={slug} accent={resolveGameAccent(slug, getGame(slug)?.accent ?? 'var(--accent)')} className="today-bonus__art" />
          <span>
            {word} · {eventGame(t)}
          </span>
        </a>
      </li>
    )
  }
  return (
    <div className="today-card__bonus">
      <span className="today-card__label">Bonus punches</span>
      <ul>
        {daily ? chip(daily, 'Today’s event') : null}
        {oneShot ? chip(oneShot, 'One Shot') : null}
        <li>
          <button type="button" className={`today-bonus${hunt.found ? ' today-bonus--done' : ''}`} onClick={openBugHunt}>
            <BugPortrait bugId={hunt.bugId} size={30} pose={hunt.found ? 'cheer' : 'wave'} mood="smile" className="today-bonus__bug" />
            <span>{hunt.found ? `Caught ${hunt.name}` : `Bug hunt · ${hunt.name}`}</span>
            {hunt.found ? (
              <span className="today-bonus__check">
                <CheckIcon />
              </span>
            ) : null}
          </button>
        </li>
      </ul>
    </div>
  )
}

/** The share: the phone's share sheet where there is one, else copied. */
export function ShareDay({ text, day, all, className }: { text: string; day: string; all: boolean; className: string }) {
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
      {copied ? 'Copied' : all ? 'Share your day' : 'Share so far'}
    </button>
  )
}

/**
 * The ticket on a desktop: every daily across, each with its picture, the day's own, how it went or where it
 * stands, and its way in. A phone has the strip and the punch shown big instead (the stylesheet picks).
 */
function PunchRow({ punches, rival }: { punches: Punch[]; rival: (key: TodayKey) => string | null }) {
  return (
    <ul
      className={`today-row${punches.length > 3 ? ' today-row--wide' : ''}${punches.length > 4 ? ' today-row--many' : ''}`}
      style={{ '--n': punches.length } as CSSProperties}
    >
      {punches.map((p) => {
        const href = gamePlayHref(p.slug)
        const line = rival(p.key)
        return (
          <li key={p.key} className={`today-slot${p.done ? ' today-slot--done' : ''}`}>
            <a className="today-slot__art" href={href} tabIndex={-1} aria-hidden="true">
              <GameArt slug={p.slug} className="today-slot__scene" />
              {p.done ? <span className="today-slot__stamp">Punched</span> : null}
            </a>
            <div className="today-slot__text">
              <span className="today-slot__kicker">
                {p.kicker}
                {p.fresh && !p.done ? <span className="today-feature__new">New</span> : null}
              </span>
              {/* The game's name opens its page: the way back to a daily's own from here. */}
              <a className="today-slot__game today-game" href={gameHref(p.slug)}>
                {p.game}
                <span aria-hidden="true"> ›</span>
              </a>
              <DailyKindTag slug={p.slug} className="today-slot__kind" />
              <span className="today-slot__title">{p.title}</span>
              {p.done && p.mine ? <span className="today-slot__mine">You: {p.mine}</span> : null}
              {!p.done && p.carry ? <span className="today-slot__mine">{p.carry}</span> : null}
              {line ? <span className="today-slot__rival">{line}</span> : null}
              <Again punch={p} />
            </div>
            {p.done ? null : (
              <a className="today-slot__go" href={href}>
                <PlayIcon />
                {p.go}
              </a>
            )}
            <PastLink punch={p} className="today-slot__past" />
          </li>
        )
      })}
    </ul>
  )
}

/** The punch shown big: its whole picture, the day's own, how it went or where it stands, and the way in. */
function Featured({ punch, then, rival }: { punch: Punch; then: Punch | null; rival: string | null }) {
  const href = gamePlayHref(punch.slug)
  return (
    <div className="today-feature" id="today-feature">
      <a className="today-feature__art" href={href} tabIndex={-1} aria-hidden="true">
        <GameArt slug={punch.slug} shape="card" className="today-feature__scene" />
      </a>
      <div className="today-feature__text">
        <span className="today-feature__kicker">
          {punch.done ? 'Punched' : 'Up next'} · {punch.kicker}
          {punch.fresh && !punch.done ? <span className="today-feature__new">New</span> : null}
        </span>
        <a className="today-feature__game today-game" href={gameHref(punch.slug)}>
          {punch.game}
          <span aria-hidden="true"> ›</span>
        </a>
        <DailyKindTag slug={punch.slug} className="today-feature__kind" />
        <span className="today-feature__title">{punch.title}</span>
        {punch.done && punch.mine ? <span className="today-feature__mine">You: {punch.mine}</span> : null}
        {!punch.done && punch.carry ? <span className="today-feature__mine">{punch.carry}</span> : null}
        {rival ? <span className="today-feature__rival">{rival}</span> : null}
        <Again punch={punch} />
        <div className="today-feature__row">
          {punch.done ? (
            // A daily just for fun has no board: its page keeps your days instead.
            isRankedGame(punch.slug) ? (
              <a className="today-feature__board" href={gameBoardHref(punch.slug, 'daily')}>
                Today’s board
              </a>
            ) : (
              <a className="today-feature__board" href={gameHref(punch.slug)}>
                Your days
              </a>
            )
          ) : (
            <a className="today-feature__go" href={href}>
              <PlayIcon />
              {punch.go}
            </a>
          )}
          {then ? <span className="today-feature__then">Then {then.game}</span> : null}
        </div>
        <PastLink punch={punch} className="today-feature__past" />
      </div>
    </div>
  )
}

/**
 * The ticket, for the viewer the page drew it for (todayPunches.ts's useTicket), with each punch's line on
 * the rivals the page asked for.
 */
export function TodayCard({ ticket, rivals, signedIn }: { ticket: Ticket; rivals: Rivals | null; signedIn: boolean }) {
  const { day, punches, server, done: doneN, total, all, rule, marks, current, left } = ticket
  // The punch the player picked to see big; until then, the first still to do.
  const [picked, setPicked] = useState<TodayKey | null>(null)
  // Said aloud only when the player picks a punch, never when the panel changes on its own.
  const [said, setSaid] = useState('')
  const week = server?.week ?? []
  const todayIndex = dayParts(day).weekday
  const more = rule.count > TODAY_KEEP

  const featured = punches.find((p) => p.key === picked) ?? punches.find((p) => !p.done) ?? punches[0]
  if (!featured) return null
  // For one still to do, the next still to do after it, round the ticket.
  const at = punches.indexOf(featured)
  const then = featured.done ? null : ([...punches.slice(at + 1), ...punches.slice(0, at)].find((p) => !p.done) ?? null)
  const shareText = ticket.shareText

  return (
    <section className="today" aria-labelledby="today-title">
      <div className="today-card">
        <div className="today-card__stub">
          <span className="today-card__notch today-card__notch--a" aria-hidden="true" />
          <span className="today-card__notch today-card__notch--b" aria-hidden="true" />
          <div className="today-card__stub-top">
            <span className="today-card__label">Your streak</span>
            <span className="today-card__date-short">{shortDate(day)}</span>
          </div>
          {signedIn ? (
            <>
              <div className="today-card__streak">
                <span className="today-card__streak-n">{current}</span>
                <FlameIcon />
                <span className="today-card__streak-line">
                  {current === 1 ? 'day' : 'days'} in a row. {streakLine(ticket)}.
                </span>
              </div>
              <ol className="today-week" aria-label="The last seven days">
                {week.map((d, i) => {
                  const isToday = i === week.length - 1
                  const full = Boolean(d.full) || (isToday && marks.full)
                  const kept = d.kept || (isToday && marks.kept)
                  const weekday = (todayIndex - (week.length - 1 - i) + 7) % 7
                  // Before the Today set began there was nothing to keep: blank, as the Today page's calendar has it.
                  const before = !isToday && Boolean(server?.since) && d.day < server!.since!
                  return (
                    <li
                      key={d.day}
                      className={`today-week__day${full ? ' today-week__day--full' : kept ? ' today-week__day--kept' : ''}${isToday && !kept ? ' today-week__day--today' : ''}${before ? ' today-week__day--before' : ''}`}
                      aria-label={`${WEEKDAY_NAMES[weekday]}: ${before ? 'before the Dailies began' : full ? 'Full ticket' : kept ? 'kept' : isToday ? `${left} to go` : 'missed'}`}
                    >
                      <span className="today-week__mark" aria-hidden="true">
                        {full ? <StarIcon /> : kept ? <CheckIcon /> : isToday ? left : null}
                      </span>
                      <span className="today-week__name" aria-hidden="true">
                        {WEEKDAYS[weekday]}
                      </span>
                    </li>
                  )
                })}
              </ol>
              {more ? (
                <p className="today-week__key" aria-hidden="true">
                  <span className="today-week__key-kept">Kept</span>
                  <span className="today-week__key-full">Full ticket</span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="today-card__signin">
              {more
                ? 'Sign in, and every day you punch any three keeps a streak going.'
                : `Sign in, and every day you punch all ${numberWord(total)} keeps a streak going.`}
            </p>
          )}
          <p className="today-card__rule">
            {more
              ? `Any three punched keeps your streak. All ${numberWord(total)} is a Full ticket.`
              : `A day counts once all ${numberWord(total)} are punched.`}
          </p>
        </div>

        <div className="today-card__body">
          <div className="today-card__head">
            <div>
              <h2 id="today-title" className="today-card__title">
                Today’s ticket
              </h2>
              {/* The page's own heading names the day. */}
              <p className="today-card__date">
                {doneN} of {total} done
              </p>
            </div>
            <span className="today-card__progress">
              {doneN} of {total} done
            </span>
            {doneN > 0 ? <ShareDay text={shareText} day={day} all={all} className="today-card__share" /> : null}
          </div>
          <PunchRow punches={punches} rival={(key) => rivalLine(rivals, key)} />
          <ul
            className={`today-card__punches${total > 4 ? ' today-card__punches--many' : ''}`}
            style={{ '--n': total } as CSSProperties}
          >
            {punches.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  className={`today-punch${p.done ? ' today-punch--done' : ''}`}
                  aria-pressed={p === featured}
                  aria-controls="today-feature"
                  onClick={() => {
                    setPicked(p.key)
                    setSaid(`${p.game}, ${p.done ? 'punched' : 'up next'}`)
                  }}
                >
                  <span className="today-punch__pic">
                    <span className="today-punch__art" aria-hidden="true">
                      <GameArt slug={p.slug} className="today-punch__scene" />
                      {p.done ? (
                        <span className="today-punch__check">
                          <CheckIcon />
                        </span>
                      ) : null}
                    </span>
                    {/* Ranked or just for fun, on the picture's corner; pressed, the punch shows its tag and tip big. */}
                    <DailyKindMark slug={p.slug} look="badge" className="today-punch__kind" />
                  </span>
                  <span className="today-punch__game">{p.game}</span>
                  <span className="today-punch__label">{p.label}</span>
                  <span className="today-punch__state">
                    {p.done ? <span className="visually-hidden">Punched, </span> : null}
                    {p.done ? (p.short ?? 'Done') : p.carry ? 'Carry on' : 'To play'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <span className="today-card__said" aria-live="polite">
            {said}
          </span>
          <Featured punch={featured} then={then} rival={rivalLine(rivals, featured.key)} />
          {doneN > 0 ? <ShareDay text={shareText} day={day} all={all} className="today-card__share today-card__share--foot" /> : null}
          <BonusPunches />
        </div>
      </div>
    </section>
  )
}
