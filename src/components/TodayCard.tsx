import { useEffect, useReducer, useState } from 'react'
import { getGame, isGameListed } from '../data/games'
import { bugDay, dayNumber as wantedNumber, dayRun, sceneMark, subscribeBugDay, wantedNames, dayWanted } from '../games/findbug/daily'
import { findbugBoardScore, formatFindbugMs } from '../games/findbug/score'
import { dailyTrack, trackDay } from '../games/hotlap/daily'
import { keptLap } from '../games/hotlap/lap'
import { formatLap } from '../games/hotlap/score'
import { useAuth } from '../hooks/useAuth'
import { focusFromUrl, gamePlayHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { capitalName, huntDay, huntPick, huntStats, openBugHunt, subscribeHunt } from '../lib/bugHunt'
import { dailyDay, dayProgress, subscribeDaily, syncDaily, todaysHole } from '../lib/dailyHole'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { normalizePlayerName } from '../lib/leaderboard'
import {
  daysToGo,
  subscribeToday,
  TODAY_ANCHOR,
  TODAY_MILESTONES,
  todayServer,
  todayShareText,
  type TodayKey,
  type TodayServer,
} from '../lib/today'
import type { TournamentSummary } from '../lib/tournaments'
import { resolveGameAccent } from '../lib/theme'
import { BugPortrait } from './BugHunt'
import { GameArt } from './GameArt'
import { GameThumbArt } from './GameThumbArt'
import { FlameIcon } from './TodayChip'
import '../styles/today.css'

/*
 * Today's ticket, on the home page (lib/today.ts): the day's three dailies as punches on a ticket, the
 * streak on its stub with the week under it, the day's share, the bonus punches (the Daily, the One Shot
 * and the bug hunt, which don't count), and the streak's rewards. What this device has done punches at
 * once; the streak is the API's, for a signed-in account. It comes in a chunk of its own, with the
 * dailies' plans.
 */

const CheckIcon = () => (
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
const GiftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="9" width="16" height="11.5" rx="2" />
    <path d="M4 13h16M12 9v11.5" />
    <path d="M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zM12 9c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z" />
  </svg>
)
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9.5" rx="2.2" />
    <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
  </svg>
)

type Punch = {
  key: TodayKey
  slug: string
  kicker: string
  game: string
  /** The day's own: the hole's name, the track's, the bugs wanted. */
  title: string
  done: boolean
  /** Your result, in words, once there is one. */
  mine: string | null
  /** The day's line for the share. */
  share: string | null
  go: string
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dayParts(day: string): { weekday: number; date: Date } {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
  return { weekday: date.getUTCDay(), date }
}

function longDate(day: string): string {
  return dayParts(day).date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** The three, as this device and the API have them, kept fresh and rolled over at midnight. */
function useTicket(): { day: string; punches: Punch[]; server: TodayServer | null } {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [day, setDay] = useState(dailyDay)
  useEffect(() => subscribeDaily(refresh), [])
  useEffect(() => subscribeBugDay(refresh), [])
  useEffect(() => subscribeToday(refresh), [])
  useEffect(() => {
    void syncDaily()
  }, [day])
  useEffect(() => {
    const t = window.setInterval(() => {
      setDay(dailyDay())
      refresh()
    }, 30_000)
    return () => window.clearInterval(t)
  }, [])

  const raw = todayServer()
  const server = raw?.day === day ? raw : null

  // Signed in, the account's own results (the API's) come first: this device may hold someone else's.
  // Until the API has today's, what this device did stands in.
  const hole = todaysHole(day)
  const holeTries = server?.results.hole?.tries ?? dayProgress(day)?.solved?.tries ?? null
  const holeDone = holeTries != null || Boolean(server?.done.hole)

  const tday = trackDay()
  const track = dailyTrack(tday)
  const serverLap = server?.results.track?.score ?? null
  const lapTime = keptLap(tday)?.time ?? null
  const lapWords = serverLap != null ? formatLeaderboardScore('hotlap', serverLap) : lapTime != null ? formatLap(lapTime) : null
  const trackDone = lapWords != null || Boolean(server?.done.track)

  const bday = bugDay()
  const serverRun = server?.results.wanted?.score ?? null
  const deviceRun = dayRun(bday)?.result ?? null
  // The device's run tells more (what was found, each scene's square), when it's the same run as the API's.
  const run = deviceRun && (serverRun == null || findbugBoardScore(deviceRun.ms) === serverRun) ? deviceRun : null
  const runTime = serverRun != null ? formatLeaderboardScore('findbug', serverRun) : run ? formatFindbugMs(run.ms) : null
  const found = run?.found
  const wanted = dayWanted(bday)
  const wantedCount = wanted.length
  const marks = run?.times?.length ? `${run.times.map(sceneMark).join('')} ` : ''
  const wantedDone = runTime != null || Boolean(server?.done.wanted)

  const punches: Punch[] = [
    {
      key: 'hole',
      slug: 'acechase',
      kicker: `Today’s Hole #${hole.n}`,
      game: getGame('acechase')?.name ?? 'Ace Chase',
      title: hole.def.name,
      done: holeDone,
      mine: holeTries != null ? (holeTries === 1 ? 'Bullseye, first try' : `Bullseye in ${holeTries}`) : holeDone ? 'Done' : null,
      share: holeTries != null ? `${hole.def.name} in ${holeTries}` : null,
      go: 'Play the hole',
    },
    {
      key: 'track',
      slug: 'hotlap',
      kicker: `Today’s Track #${track.n}`,
      game: getGame('hotlap')?.name ?? 'Hot Lap',
      title: track.name,
      done: trackDone,
      mine: lapWords ? `${lapWords} lap` : trackDone ? 'Done' : null,
      share: lapWords ? `${track.name} ${lapWords}` : null,
      go: 'Race the track',
    },
    {
      key: 'wanted',
      slug: 'findbug',
      kicker: `Today’s Wanted #${wantedNumber(bday)}`,
      game: getGame('findbug')?.name ?? 'Find the Bug',
      title: wantedNames(wanted),
      done: wantedDone,
      mine: runTime ? `${runTime}${found != null ? ` · found ${found} of ${wantedCount}` : ''}` : wantedDone ? 'Done' : null,
      share: runTime ? `${marks}${runTime}` : null,
      go: 'Find them',
    },
  ]
  return { day, punches: punches.filter((p) => isGameListed(p.slug)), server }
}

/** The bug hunt, for its bonus punch: who's loose today, and whether you've caught it. */
function useHuntPunch(): { name: string; bugId: string; found: boolean } {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeHunt(refresh), [])
  const pick = huntPick(huntDay())
  return { name: capitalName(pick.bug), bugId: pick.bug.id, found: huntStats().foundToday }
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
        {daily ? chip(daily, 'Daily') : null}
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
function ShareDay({ text, all, className }: { text: string; all: boolean; className: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(t)
  }, [copied])
  const share = async () => {
    const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    if (touch && navigator.share) {
      try {
        await navigator.share({ text: `${text}\n${window.location.origin}/` })
        return
      } catch {
        /* closed, or not allowed: copy instead */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${window.location.origin}/`)
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

/** What the streak needs next, from the streak before today. */
function streakLine(before: number, doneN: number, total: number): string {
  if (doneN >= total) return `Back tomorrow for Day ${before + 2}`
  if (doneN === 0) return `Finish today’s ${total} to make it ${before + 1}`
  const left = total - doneN
  return `${left === 1 ? 'One' : 'Two'} to go to make it ${before + 1}`
}

function Rewards({ current, best }: { current: number; best: number }) {
  const next = TODAY_MILESTONES.find((m) => m.day > best)
  return (
    <section className="today-rewards" aria-labelledby="today-rewards-title">
      <div className="today-rewards__head">
        <h3 id="today-rewards-title">Streak rewards</h3>
        <p>Looks for your badge, never score. Only a streak earns them.</p>
      </div>
      <ol className="today-rewards__list">
        {TODAY_MILESTONES.map((m) => {
          const got = best >= m.day
          const isNext = m === next
          return (
            <li key={m.day} className={`today-reward${got ? ' today-reward--got' : isNext ? ' today-reward--next' : ''}`}>
              <span className="today-reward__mark">{got ? <CheckIcon /> : isNext ? <GiftIcon /> : <LockIcon />}</span>
              <b className="today-reward__day">Day {m.day}</b>
              <span className="today-reward__prize">{m.prize}</span>
              {isNext ? <span className="today-reward__togo">{daysToGo(m.day - current)}</span> : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function TodayCard() {
  const { signedIn } = useAuth()
  const { day, punches, server } = useTicket()
  const doneN = punches.filter((p) => p.done).length
  const total = punches.length
  const all = total > 0 && doneN === total
  // The API counts today once it's in; until then this device's punches say where today stands.
  const streak = server?.streak ?? { current: 0, best: 0 }
  const before = server?.week.at(-1)?.kept ? streak.current - 1 : streak.current
  const current = before + (all ? 1 : 0)
  const week = server?.week ?? []
  const todayIndex = dayParts(day).weekday

  // Asked for by address (the header's chip): brought into view once it's drawn.
  useEffect(() => {
    if (focusFromUrl() !== TODAY_ANCHOR) return
    const t = window.setTimeout(() => document.getElementById(TODAY_ANCHOR)?.scrollIntoView({ block: 'start' }), 60)
    return () => window.clearTimeout(t)
  }, [])

  if (!total) return null
  const shareText = todayShareText({
    day,
    hole: punches.find((p) => p.key === 'hole')?.share ?? null,
    track: punches.find((p) => p.key === 'track')?.share ?? null,
    wanted: punches.find((p) => p.key === 'wanted')?.share ?? null,
    streak: current,
  })

  return (
    <section className="today" id={TODAY_ANCHOR} aria-labelledby="today-title">
      <div className="today-card">
        <div className="today-card__stub">
          <span className="today-card__notch today-card__notch--a" aria-hidden="true" />
          <span className="today-card__notch today-card__notch--b" aria-hidden="true" />
          <div className="today-card__stub-top">
            <span className="today-card__label">Your streak</span>
            <span className="today-card__date-short">{dayParts(day).date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
          </div>
          {signedIn ? (
            <>
              <div className="today-card__streak">
                <span className="today-card__streak-n">{current}</span>
                <FlameIcon />
                <span className="today-card__streak-line">
                  {current === 1 ? 'day' : 'days'} in a row. {streakLine(before, doneN, total)}.
                </span>
              </div>
              <ol className="today-week" aria-label="The last seven days">
                {week.map((d, i) => {
                  const isToday = i === week.length - 1
                  const kept = d.kept || (isToday && all)
                  const weekday = (todayIndex - (week.length - 1 - i) + 7) % 7
                  return (
                    <li
                      key={d.day}
                      className={`today-week__day${kept ? ' today-week__day--kept' : ''}${isToday && !kept ? ' today-week__day--today' : ''}`}
                      aria-label={`${WEEKDAY_NAMES[weekday]}: ${kept ? 'all three done' : isToday ? `${total - doneN} to go` : 'missed'}`}
                    >
                      <span className="today-week__mark" aria-hidden="true">
                        {kept ? <CheckIcon /> : isToday ? total - doneN : null}
                      </span>
                      <span className="today-week__name" aria-hidden="true">
                        {WEEKDAYS[weekday]}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </>
          ) : (
            <p className="today-card__signin">Sign in, and every day you punch all three keeps a streak going.</p>
          )}
          <p className="today-card__rule">A day counts once all three are punched.</p>
        </div>

        <div className="today-card__body">
          <div className="today-card__head">
            <div>
              <h2 id="today-title" className="today-card__title">
                Today’s ticket
              </h2>
              <p className="today-card__date">
                {longDate(day)} · {doneN} of {total} done
              </p>
            </div>
            <span className="today-card__progress">
              {doneN} of {total} done
            </span>
            {doneN > 0 ? <ShareDay text={shareText} all={all} className="today-card__share" /> : null}
          </div>
          <ul className="today-card__punches">
            {punches.map((p) => (
              <li key={p.key} className={`today-punch${p.done ? ' today-punch--done' : ''}`}>
                <a className="today-punch__art" href={gamePlayHref(p.slug)} tabIndex={-1} aria-hidden="true">
                  <GameArt slug={p.slug} className="today-punch__scene" />
                  {p.done ? <span className="today-punch__stamp">Punched</span> : null}
                </a>
                <div className="today-punch__text">
                  <span className="today-punch__kicker">{p.kicker}</span>
                  <b className="today-punch__game">{p.game}</b>
                  <span className="today-punch__title">{p.title}</span>
                  {p.done && p.mine ? <span className="today-punch__mine">You: {p.mine}</span> : null}
                </div>
                {p.done ? null : (
                  <a className="today-punch__go" href={gamePlayHref(p.slug)}>
                    <PlayIcon />
                    <span className="today-punch__go-long">{p.go}</span>
                    <span className="today-punch__go-short">Play</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          {doneN > 0 ? <ShareDay text={shareText} all={all} className="today-card__share today-card__share--foot" /> : null}
          <BonusPunches />
        </div>
      </div>
      {signedIn ? <Rewards current={current} best={Math.max(streak.best, current)} /> : null}
    </section>
  )
}
