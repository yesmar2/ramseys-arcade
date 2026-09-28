import { useEffect, useReducer, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import {
  bugDay,
  DAY_SCENES,
  dayNumber as wantedNumber,
  dayRun,
  sceneMark,
  subscribeBugDay,
  wantedNames,
  dayWanted,
} from '../games/findbug/daily'
import { findbugBoardScore, formatFindbugMs } from '../games/findbug/score'
import { dayDone as pourDone, dayRun as pourRun, dayTag as pourTag, pourDay, subscribePourDay } from '../games/halffull/daily'
import { dayPlan, ROUNDS } from '../games/halffull/plan'
import { glassNames } from '../games/halffull/planSvg'
import { formatBoard, judgeLevels, markFor, tierFor } from '../games/halffull/score'
import { dailyTrack, trackDay } from '../games/hotlap/daily'
import { keptLap } from '../games/hotlap/lap'
import { formatLap } from '../games/hotlap/score'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { focusFromUrl, gameBoardHref, gamePlayHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { capitalName, huntDay, huntPick, huntStats, openBugHunt, subscribeHunt } from '../lib/bugHunt'
import { dailyDay, dayProgress, subscribeDaily, syncDaily, todaysHole } from '../lib/dailyHole'
import type { Viewer } from '../lib/deviceRuns'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { normalizePlayerName } from '../lib/leaderboard'
import { numberWord } from '../lib/numberWord'
import { ordinal } from '../lib/profileMath'
import {
  dayMarks,
  daysToGo,
  fetchRivals,
  liveDailies,
  rivalResult,
  rivalsScope,
  rivalStanding,
  rivalWords,
  setRivalsScope,
  subscribeToday,
  TODAY_ANCHOR,
  TODAY_KEEP,
  TODAY_MILESTONES,
  todayRule,
  todayServer,
  todayShareText,
  type TodayDaily,
  type TodayKey,
  type TodayRivals as Rivals,
  type TodayServer,
} from '../lib/today'
import type { TournamentSummary } from '../lib/tournaments'
import { resolveGameAccent } from '../lib/theme'
import { BugPortrait } from './BugHunt'
import { GameArt } from './GameArt'
import { GameThumbArt } from './GameThumbArt'
import { FlameIcon, StarIcon } from './TodayChip'
import { TodayRivals } from './TodayRivals'
import '../styles/today.css'

/*
 * Today's ticket, on the home page (lib/today.ts): the day's live dailies as punches, all across on a
 * desktop, and on a phone a strip with one of them shown big (the next to play, or the one picked), the
 * streak on its stub with the week under
 * it, the day's share, the bonus punches (the Daily, the One Shot and the bug hunt, which don't count),
 * and the streak's rewards. What this device has done punches at once; the streak is the API's, for a
 * signed-in account. It comes in a chunk of its own, with the dailies' plans.
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
  slug: TodayDaily['slug']
  /** The short name a phone's punch shows: Hole, Track, Bugs, Pour. */
  label: string
  kicker: string
  game: string
  /** The day's own: the hole's name, the track's, the bugs wanted, the glasses. */
  title: string
  done: boolean
  /** Your result, in words, once there is one. */
  mine: string | null
  /** The result on the punch itself, short: "3 tries", "58.41s", "91.2%". */
  short: string | null
  /** Left halfway, and where to carry on from ("Carry on, glass 3 of 5"); null if not started. */
  carry: string | null
  /** The day's line for the share. */
  share: string | null
  go: string
  /** In its first week on the ticket. */
  fresh: boolean
}

/** A daily's punch, apart from what every punch has from TODAY_DAILIES (its key, game and label, and whether it's new). */
type PunchDay = Omit<Punch, 'key' | 'slug' | 'label' | 'game' | 'fresh'>

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** How long a daily is new on the ticket, in days. */
const FRESH_DAYS = 7

function dayParts(day: string): { weekday: number; date: Date } {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
  return { weekday: date.getUTCDay(), date }
}

function longDate(day: string): string {
  return dayParts(day).date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function daysBetween(from: string, to: string): number {
  return Math.round((dayParts(to).date.getTime() - dayParts(from).date.getTime()) / 86_400_000)
}

const triesWords = (n: number) => `${n} ${n === 1 ? 'try' : 'tries'}`

/*
 * Each daily's punch, for the viewer (lib/deviceRuns.ts). The account's own results (the API's) come
 * first. What this device did counts only when it's the viewer's own run: the device may hold another
 * player's, or a run played signed out that only its game can take up, and neither is ever shown as the
 * viewer's. Their own run adds to their result (each square, or a punch before the API has it), and only
 * their own half-played run says Carry on.
 */

function holePunch(day: string, server: TodayServer | null, viewer: Viewer): PunchDay {
  const hole = todaysHole(day)
  // The viewer's own run on this device only (lib/dailyHole.ts): never another account's, nor, signed in, one played signed out.
  const progress = dayProgress(day, viewer)
  const tries = server?.results.hole?.tries ?? progress?.solved?.tries ?? null
  const done = tries != null || Boolean(server?.done.hole)
  const tried = done ? 0 : (progress?.tries ?? 0)
  return {
    kicker: `Today’s Hole #${hole.n}`,
    title: hole.def.name,
    done,
    mine: tries != null ? (tries === 1 ? 'Bullseye, first try' : `Bullseye in ${tries}`) : done ? 'Done' : null,
    short: tries != null ? triesWords(tries) : null,
    carry: tried > 0 ? `Carry on, ${triesWords(tried)} in` : null,
    share: tries != null ? `${hole.def.name} in ${tries}` : null,
    go: 'Play the hole',
  }
}

function trackPunch(server: TodayServer | null, viewer: Viewer): PunchDay {
  const tday = trackDay()
  const track = dailyTrack(tday)
  const serverLap = server?.results.track?.score ?? null
  // The viewer's own best lap on this device (never another player's, nor one driven signed out while they're signed in).
  const lapTime = keptLap(tday, viewer)?.time ?? null
  const lapWords = serverLap != null ? formatLeaderboardScore('hotlap', serverLap) : lapTime != null ? formatLap(lapTime) : null
  const done = lapWords != null || Boolean(server?.done.track)
  return {
    kicker: `Today’s Track #${track.n}`,
    title: track.name,
    done,
    mine: lapWords ? `${lapWords} lap` : done ? 'Done' : null,
    short: lapWords,
    carry: null,
    share: lapWords ? `${track.name} ${lapWords}` : null,
    go: 'Race the track',
  }
}

function wantedPunch(server: TodayServer | null, viewer: Viewer): PunchDay {
  const bday = bugDay()
  const serverRun = server?.results.wanted?.score ?? null
  const device = dayRun(bday, viewer)
  const deviceRun = device?.result ?? null
  // The device's run tells more (what was found, each scene's square), when it's the same run as the API's.
  const run = deviceRun && (serverRun == null || findbugBoardScore(deviceRun.ms) === serverRun) ? deviceRun : null
  const runTime = serverRun != null ? formatLeaderboardScore('findbug', serverRun) : run ? formatFindbugMs(run.ms) : null
  const found = run?.found
  const wanted = dayWanted(bday)
  const marks = run?.times?.length ? `${run.times.map(sceneMark).join('')} ` : ''
  const done = runTime != null || Boolean(server?.done.wanted)
  // A run begun here and left before its end.
  const started = !done && device != null && deviceRun == null
  const at = started ? device?.at : undefined
  return {
    kicker: `Today’s Wanted #${wantedNumber(bday)}`,
    title: wantedNames(wanted),
    done,
    mine: runTime ? `${runTime}${found != null ? ` · found ${found} of ${wanted.length}` : ''}` : done ? 'Done' : null,
    short: runTime,
    carry: started ? (at ? `Carry on, scene ${Math.min(DAY_SCENES, at.index + 1)} of ${DAY_SCENES}` : 'Carry on') : null,
    share: runTime ? `${marks}${runTime}` : null,
    go: 'Find them',
  }
}

function pourPunch(server: TodayServer | null, viewer: Viewer): PunchDay {
  const pday = pourDay()
  // Its title names the day's glasses, so the day's plan is built (once a page) whenever the pour is on the ticket.
  const plan = dayPlan(pday)
  const serverPour = server?.results.pour?.score ?? null
  // The viewer's own pour here, if any: never another account's, nor one poured signed out (only the game takes that up).
  const run = pourRun(pday, viewer)
  const levels = run?.levels ?? []
  const judged = levels.length >= ROUNDS ? judgeLevels(plan, levels.slice(0, ROUNDS)) : null
  // The device's pours tell more (each glass's square, the tier), when they're the same pour as the API's.
  const same = judged && (serverPour == null || judged.board === serverPour) ? judged : null
  const score = serverPour ?? same?.board ?? run?.board ?? null
  const done = score != null || Boolean(server?.done.pour) || pourDone(run)
  return {
    kicker: `Today’s Pour ${pourTag(pday)}`,
    title: glassNames(plan),
    done,
    mine: score != null ? `${formatBoard(score)}${same ? `, ${tierFor(same.day)}` : ''}` : done ? 'Done' : null,
    short: score != null ? formatBoard(score) : null,
    carry: !done && levels.length > 0 ? `Carry on, glass ${Math.min(ROUNDS, levels.length + 1)} of ${ROUNDS}` : null,
    share: score != null ? `${same ? `${same.scores.map(markFor).join('')} ` : ''}${formatBoard(score)}` : null,
    go: 'Pour',
  }
}

function punchDay(key: TodayKey, day: string, server: TodayServer | null, viewer: Viewer): PunchDay {
  if (key === 'hole') return holePunch(day, server, viewer)
  if (key === 'track') return trackPunch(server, viewer)
  if (key === 'wanted') return wantedPunch(server, viewer)
  return pourPunch(server, viewer)
}

/**
 * The day's live dailies, as this device and the API have them for the viewer, kept fresh and rolled over
 * at midnight.
 */
function useTicket(viewer: Viewer): { day: string; punches: Punch[]; server: TodayServer | null; live: TodayDaily[] } {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [day, setDay] = useState(dailyDay)
  useEffect(() => subscribeDaily(refresh), [])
  useEffect(() => subscribeBugDay(refresh), [])
  useEffect(() => subscribePourDay(refresh), [])
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
  const live = liveDailies(day, server)
  const punches = live.map((d) => ({
    key: d.key,
    slug: d.slug,
    label: d.label,
    game: getGame(d.slug)?.name ?? d.label,
    fresh: d.from ? daysBetween(d.from, day) < FRESH_DAYS : false,
    ...punchDay(d.key, day, server, viewer),
  }))
  return { day, punches, server, live }
}

/** The bug hunt, for its bonus punch: who's loose today, and whether you've caught it. */
function useHuntPunch(): { name: string; bugId: string; found: boolean } {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeHunt(refresh), [])
  const pick = huntPick(huntDay())
  return { name: capitalName(pick.bug), bugId: pick.bug.id, found: huntStats().foundToday }
}

/**
 * Friends', or a group's, day on the dailies: asked again when the player's own day moves, when the tab
 * comes back, when another account signs in, and every two minutes. The pick of friends or a group is
 * this device's.
 */
function useRivals(signedIn: boolean, viewer: Viewer): { data: Rivals | null; group: string | null; pick: (group: string | null) => void } {
  const [group, setGroup] = useState<string | null>(rivalsScope)
  // The table, with the account it was asked for: another account's is never shown, even while theirs is asked.
  const [held, setHeld] = useState<{ for: Viewer; data: Rivals | null }>({ for: null, data: null })
  const [tick, bump] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeToday(bump), [])
  useEffect(() => {
    const t = window.setInterval(bump, 120_000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (!signedIn) {
      setHeld({ for: viewer, data: null })
      return
    }
    let cancelled = false
    void fetchRivals(group, tick > 0).then((next) => {
      if (!cancelled) setHeld({ for: viewer, data: next })
    })
    return () => {
      cancelled = true
    }
  }, [signedIn, viewer, group, tick])
  const data = held.for === viewer ? held.data : null
  const pick = (next: string | null) => {
    setRivalsScope(next)
    setGroup(next)
  }
  return { data, group: data?.scope.kind === 'group' ? data.scope.id : null, pick }
}

/** A punch's line on the rivals: where you stand among them, or who leads while you haven't. */
function rivalLine(data: Rivals | null, key: TodayKey): string | null {
  if (!data) return null
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
function ShareDay({ text, day, all, className }: { text: string; day: string; all: boolean; className: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(t)
  }, [copied])
  // The day's own page: it lands on today's ticket, and unfurls with the day's card.
  const url = `${window.location.origin}/today/${day}`
  const share = async () => {
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

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** What the streak needs next, from the streak before today: the day kept, then (with more than three live) a Full ticket. */
function streakLine(before: number, done: number, rule: { need: number; count: number }): string {
  const n = before + 1
  if (done < rule.need) {
    const left = rule.need - done
    return left === 1 ? `One more to make it ${n}` : `${capital(numberWord(left))} to go to make it ${n}`
  }
  if (rule.count > TODAY_KEEP && done < rule.count) return `Kept. ${capital(numberWord(rule.count - done))} more for a Full ticket`
  return `Back tomorrow for Day ${n + 1}`
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
              <b className="today-slot__game">{p.game}</b>
              <span className="today-slot__title">{p.title}</span>
              {p.done && p.mine ? <span className="today-slot__mine">You: {p.mine}</span> : null}
              {!p.done && p.carry ? <span className="today-slot__mine">{p.carry}</span> : null}
              {line ? <span className="today-slot__rival">{line}</span> : null}
            </div>
            {p.done ? null : (
              <a className="today-slot__go" href={href}>
                <PlayIcon />
                {p.go}
              </a>
            )}
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
        <b className="today-feature__game">{punch.game}</b>
        <span className="today-feature__title">{punch.title}</span>
        {punch.done && punch.mine ? <span className="today-feature__mine">You: {punch.mine}</span> : null}
        {!punch.done && punch.carry ? <span className="today-feature__mine">{punch.carry}</span> : null}
        {rival ? <span className="today-feature__rival">{rival}</span> : null}
        <div className="today-feature__row">
          {punch.done ? (
            <a className="today-feature__board" href={gameBoardHref(punch.slug, 'daily')}>
              Today’s board
            </a>
          ) : (
            <a className="today-feature__go" href={href}>
              <PlayIcon />
              {punch.go}
            </a>
          )}
          {then ? <span className="today-feature__then">Then {then.game}</span> : null}
        </div>
      </div>
    </div>
  )
}

export function TodayCard() {
  const { signedIn } = useAuth()
  // Who's looking: each punch is theirs, and never another account's that played on this device.
  const viewer = useAccountId()
  const { day, punches, server, live } = useTicket(viewer)
  const rivals = useRivals(signedIn, viewer)
  // The punch the player picked to see big; until then, the first still to do.
  const [picked, setPicked] = useState<TodayKey | null>(null)
  // Said aloud only when the player picks a punch, never when the panel changes on its own.
  const [said, setSaid] = useState('')
  const doneN = punches.filter((p) => p.done).length
  const total = punches.length
  const all = total > 0 && doneN === total
  const rule = todayRule(total)
  const marks = dayMarks(doneN, rule)
  // The API counts today once it's in; until then this device's punches say where today stands.
  const streak = server?.streak ?? { current: 0, best: 0 }
  const before = server?.week.at(-1)?.kept ? streak.current - 1 : streak.current
  const current = before + (marks.kept ? 1 : 0)
  const week = server?.week ?? []
  const todayIndex = dayParts(day).weekday
  const left = Math.max(0, rule.need - doneN)
  const more = rule.count > TODAY_KEEP

  // Asked for by address (the header's chip): brought into view once it's drawn.
  useEffect(() => {
    if (focusFromUrl() !== TODAY_ANCHOR) return
    const t = window.setTimeout(() => document.getElementById(TODAY_ANCHOR)?.scrollIntoView({ block: 'start' }), 60)
    return () => window.clearTimeout(t)
  }, [])

  const featured = punches.find((p) => p.key === picked) ?? punches.find((p) => !p.done) ?? punches[0]
  if (!featured) return null
  // For one still to do, the next still to do after it, round the ticket.
  const at = punches.indexOf(featured)
  const then = featured.done ? null : ([...punches.slice(at + 1), ...punches.slice(0, at)].find((p) => !p.done) ?? null)
  const shareText = todayShareText({
    day,
    lines: punches.map((p) => ({ key: p.key, text: p.share })),
    streak: current,
    full: marks.full,
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
                  {current === 1 ? 'day' : 'days'} in a row. {streakLine(before, doneN, rule)}.
                </span>
              </div>
              <ol className="today-week" aria-label="The last seven days">
                {week.map((d, i) => {
                  const isToday = i === week.length - 1
                  const full = Boolean(d.full) || (isToday && marks.full)
                  const kept = d.kept || (isToday && marks.kept)
                  const weekday = (todayIndex - (week.length - 1 - i) + 7) % 7
                  return (
                    <li
                      key={d.day}
                      className={`today-week__day${full ? ' today-week__day--full' : kept ? ' today-week__day--kept' : ''}${isToday && !kept ? ' today-week__day--today' : ''}`}
                      aria-label={`${WEEKDAY_NAMES[weekday]}: ${full ? 'Full ticket' : kept ? 'kept' : isToday ? `${left} to go` : 'missed'}`}
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
              <p className="today-card__date">
                {longDate(day)} · {doneN} of {total} done
              </p>
            </div>
            <span className="today-card__progress">
              {doneN} of {total} done
            </span>
            {doneN > 0 ? <ShareDay text={shareText} day={day} all={all} className="today-card__share" /> : null}
          </div>
          <PunchRow punches={punches} rival={(key) => rivalLine(rivals.data, key)} />
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
                  <span className="today-punch__art" aria-hidden="true">
                    <GameArt slug={p.slug} className="today-punch__scene" />
                    {p.done ? (
                      <span className="today-punch__check">
                        <CheckIcon />
                      </span>
                    ) : null}
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
          <Featured punch={featured} then={then} rival={rivalLine(rivals.data, featured.key)} />
          {doneN > 0 ? <ShareDay text={shareText} day={day} all={all} className="today-card__share today-card__share--foot" /> : null}
          <BonusPunches />
        </div>
      </div>
      {signedIn ? <TodayRivals data={rivals.data} dailies={live} group={rivals.group} onPick={rivals.pick} /> : null}
      {signedIn ? <Rewards current={current} best={Math.max(streak.best, current)} /> : null}
    </section>
  )
}
