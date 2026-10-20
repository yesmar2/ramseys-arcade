import { useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { getGame, isGameListed } from '../data/games'
import { dailyTrack, trackDay } from '../games/hotlap/daily'
import { buildTrack } from '../games/hotlap/sim'
import { trackPlan } from '../games/hotlap/trackPlan'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { boardPlaceHref, dailyTabHref, rankHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { archiveDayWords } from '../lib/archive'
import { inkOn } from '../lib/color'
import { dailyDay, todaysHole } from '../lib/dailyHole'
import {
  courseResult,
  coursesHeldRecord,
  dayRecordsHead,
  daysWonRecord,
  goldStreakRecord,
  holeRecordRows,
  nearestCourse,
  podiumDaysRecord,
  recordsIntro,
  streakRecord,
  trackRecordRows,
  useDailyRecords,
  useStreakBook,
  type CourseRecordRow,
  type DayRecord,
} from '../lib/dailyRecords'
import { BOARD_NAMES, dailyWords } from '../lib/dailyWords'
import { useHeldHeight } from '../lib/heldShape'
import { LEADERBOARD_GAMES, normalizePlayerName, type LeaderboardGame } from '../lib/leaderboard'
import { useHoleRecordsAsked } from '../lib/pastHoles'
import { isRaceGame } from '../lib/raceMedals'
import { ordinal } from '../lib/scoreboard'
import { resolveGameAccent } from '../lib/theme'
import { useTrackRecordsAsked } from '../lib/trackBoards'
import { ChevronRightIcon, FlameIcon } from './chromeIcons'
import { PlayerMark } from './PlayerMark'
import { PlayerName } from './PlayerName'
import { openSiteMenu, openTagPicker } from './siteNav'
import { HolePlan } from './TodaysHoleCard'
import { BoardsAmong } from './BoardsAmong'
import '../styles/dailyRecords.css'
import '../styles/todaysTrack.css'

/*
 * A daily's Records tab: only the records its boards don't already show. Since Ramsey said "yes match" (to the
 * game Records tab's one list, the "Records, more ideas" canvas's A, 2026-10-12) it's that list: who holds the
 * most and how you stand, in a line; then the records made over many days (Days played in a row, the most days
 * won, the most days on the podium, a racing daily's longest run of gold medals, and on Hot Lap and Ace Chase the
 * most track or hole records held), a row apiece that opens its first five; then each track's or hole's record,
 * which is just the #1 on its All time board, a row apiece that opens that course's row on the past tab. What
 * each row says is worked out in lib/dailyRecords.ts.
 *
 * Since Ramsey said "yes do bars on dailies too" (2026-10-13), a player it knows gets the game Records tab's
 * bars (C of the "Board and records, new looks" canvas): each record a bar of how close their best is to it.
 * Signed out it's the list, with no You column.
 */

/** Course rows before "Show all". */
const FIRST_COURSES = 10

type Viewer = { name: string; signedIn: boolean }

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 18.5h16M5 16l-1.2-9 5 4 3.2-6 3.2 6 5-4-1.2 9z" />
    </svg>
  )
}

/** Three steps, the middle one tallest. */
function PodiumIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 20V8h7v12M3 20v-7h5.5M15.5 20v-5H21v5M2 20h20" />
    </svg>
  )
}

/** A medal on its ribbon. */
function MedalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3l2.5 6M16 3l-2.5 6" />
      <circle cx="12" cy="15" r="5.5" />
      <path d="M12 12.5v5" />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 21V4M6 4h11l-2 4 2 4H6" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

const RECORD_ICONS: Record<DayRecord['key'], ComponentType> = {
  streak: FlameIcon,
  'days-won': CrownIcon,
  'podium-days': PodiumIcon,
  'gold-streak': MedalIcon,
  'courses-held': FlagIcon,
}

/** A track from above, as its row on the past tab draws it. */
function TrackMap({ day }: { day: string }) {
  const plan = useMemo(() => {
    const track = dailyTrack(day)
    return trackPlan(buildTrack(track.pieces, { heading: track.shape.heading }))
  }, [day])
  return (
    <span className="ttc-art">
      <svg className="ttc-plan" viewBox={plan.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path className="ttc-plan__glow" d={plan.d} strokeWidth={plan.road * 2.4} />
        <path className="ttc-plan__edge" d={plan.d} strokeWidth={plan.road * 1.3} />
        <path className="ttc-plan__road" d={plan.d} strokeWidth={plan.road} />
        <circle className="ttc-plan__car" cx={plan.car.x} cy={plan.car.y} r={plan.car.r} />
      </svg>
    </span>
  )
}

function HoleMap({ day }: { day: string }) {
  const hole = useMemo(() => todaysHole(day), [day])
  return <HolePlan hole={hole} />
}

/** A count with its word: 1 player, 36 players. */
function counted(n: number, one: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : `${one}s`}`
}

/** "raced", "played", "flown", "run": the verb on a start button, done ("Not flown yet", "Not run yet"). */
function done(verb: string): string {
  const v = verb.toLowerCase()
  if (v === 'fly') return 'flown'
  if (v === 'run') return 'run'
  return v.endsWith('e') ? `${v}d` : `${v}ed`
}

/** Yours: the gold pill a game's Records tab gives a record you hold, and how your run stands under it. */
function Yours({ note }: { note?: string }) {
  return (
    <>
      <span className="rbl-yours">
        <CrownIcon />
        Yours
      </span>
      {note ? <span className="rbc-end__note">{note}</span> : null}
    </>
  )
}

/** How close a number is to a record's, from nothing to all of it: more is better, or less on a course (`less`). */
function closeness(yours: number, top: number, less = false): number {
  if (yours <= 0 || top <= 0) return 0
  return Math.min(1, less ? top / yours : yours / top)
}

/** A record's bar (records.css .rbc-bar): as long as your share of it, your number at its end. */
function Bar({ share, value }: { share: number; value?: string }) {
  return (
    <span className="rbc-bar">
      <span className="rbc-bar__track" aria-hidden="true">
        {share > 0 ? <span className="rbc-bar__fill" style={{ '--rbc-share': `${(share * 100).toFixed(1)}%` } as CSSProperties} /> : null}
      </span>
      <span className="rbc-bar__you">
        {value ? (
          <>
            <span className="visually-hidden">You: </span>
            {value}
          </>
        ) : null}
      </span>
    </span>
  )
}

/**
 * One of the records made over many days: a row, like a game Records tab's, that opens its first five in place
 * (these have no page of their own). `failed`: it couldn't be had, and the row says so. `bars`: a player it
 * knows, whose row is a bar of how close they are.
 */
function DayRow({ record, bars, failed }: { record: DayRecord; bars: boolean; failed: boolean }) {
  const [open, setOpen] = useState(false)
  const Icon = RECORD_ICONS[record.key]
  const you = record.you
  const mine = you?.kind === 'mine'
  const listId = `drt-top-${record.key}`
  const held = !failed && Boolean(record.holders)
  const canOpen = held && record.top.length > 1
  const tie = (record.holders?.marks.length ?? 0) > 1
  const lead = record.holders?.marks[0]
  const label = (
    <span className="rbl-row__label drt-label">
      <span className="drt-label__icon">
        <Icon />
      </span>
      {record.title}
      {/* With no last column for the chevron (a phone, or the bars), it sits by the name. */}
      {canOpen ? (
        <span className={`drt-label__more${open ? ' drt-toggle--open' : ''}`} aria-hidden="true">
          <ChevronRightIcon />
        </span>
      ) : null}
    </span>
  )
  let cells: ReactNode
  if (bars) {
    const best = record.top[0]?.value ?? 0
    const share = !held ? 0 : mine ? 1 : you?.kind === 'on' ? closeness(you.n, best) : 0
    let end: ReactNode = null
    if (held && you?.kind === 'mine') end = <Yours note={you.note} />
    else if (held && you?.kind === 'on') {
      end = (
        <>
          {/* Tied for it: the holders' names already say you're among them. The dot keeps to the line it ends. */}
          {you.place || you.gap ? [you.place, you.gap].filter(Boolean).join('\u00a0· ') : 'Tied for it'}
          {you.live ? <span className="rbc-end__note">{you.live}</span> : null}
        </>
      )
    } else if (held && you?.kind === 'none') end = you.text
    cells = (
      <>
        <span className="rbc-what">
          {label}
          <span className="rbc-held">
            {failed ? (
              'Couldn’t load this one. Check your connection and try again.'
            ) : !record.holders || !lead ? (
              record.empty
            ) : (
              <>
                <b className="rbc-held__best">{record.value}</b>
                <span>by</span>
                <PlayerMark name={lead.name} avatarId={lead.avatarId} className="rbc-held__mark" />
                <span className="rbc-held__tag">{tie ? record.holders.names : <PlayerName name={lead.name} avatarId={lead.avatarId} />}</span>
                {/* Tied; who got there first, or what's held: a line of its own under who holds it. */}
                {record.holders.sub ? <span className="rbc-held__sub">{record.holders.sub}</span> : null}
              </>
            )}
          </span>
        </span>
        <Bar share={share} value={!held ? undefined : mine ? best.toLocaleString() : you?.kind === 'on' ? you.n.toLocaleString() : undefined} />
        <span className="rbc-end">{end}</span>
      </>
    )
  } else {
    cells = (
      <>
        {label}
        {failed ? (
          <span className="rbl-open">Couldn’t load this one. Check your connection and try again.</span>
        ) : !record.holders ? (
          <span className="rbl-open">{record.empty}</span>
        ) : (
          <>
            <span className="rbl-row__best">{record.value}</span>
            <span className="rbl-who">
              {record.holders.marks.length > 1 ? (
                <span className={`rbl-who__marks drt-marks drt-marks--${record.holders.marks.length}`}>
                  {record.holders.marks
                    .slice()
                    .reverse()
                    .map((m, i) => (
                      <PlayerMark
                        key={m.name}
                        name={m.name}
                        avatarId={m.avatarId}
                        className={`rbl-who__mark${i < record.holders!.marks.length - 1 ? ' rbl-who__mark--back' : ''}`}
                        style={{ left: `${(record.holders!.marks.length - 1 - i) * 1.2}rem` } as CSSProperties}
                      />
                    ))}
                </span>
              ) : (
                <PlayerMark name={record.holders.marks[0]!.name} avatarId={record.holders.marks[0]!.avatarId} className="rbl-who__mark" />
              )}
              <span className="rbl-who__text">
                <span className="rbl-who__name">
                  <span className={`rbl-who__tag${record.holders.marks.length > 1 ? ' drt-names' : ''}`}>
                    {record.holders.marks.length > 1 ? (
                      record.holders.names
                    ) : (
                      <PlayerName name={record.holders.marks[0]!.name} avatarId={record.holders.marks[0]!.avatarId} />
                    )}
                  </span>
                </span>
                {record.holders.sub ? <span className="rbl-who__sub">{record.holders.sub}</span> : null}
              </span>
            </span>
          </>
        )}
        {/* An open row's words run to its end: no last column to push to a line of its own. */}
        {held ? (
          <span className={`rbl-row__go drt-toggle${open ? ' drt-toggle--open' : ''}`} aria-hidden="true">
            {canOpen ? <ChevronRightIcon /> : null}
          </span>
        ) : null}
      </>
    )
  }
  return (
    <li
      className={`rbl-row${bars ? ' rbc-row drt-day' : ''}${mine ? ' rbl-row--mine' : ''}${held ? '' : ' rbl-row--open'}${tie && !bars ? ' drt-row--tie' : ''}`}
    >
      {canOpen ? (
        <button
          type="button"
          className="rbl-row__link drt-row-btn"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {cells}
        </button>
      ) : (
        <div className="rbl-row__link">{cells}</div>
      )}
      {canOpen && open ? (
        <ol id={listId} className="drt-top" aria-label={`${record.title}: the first ${record.top.length}`}>
          {record.top.map((r) => (
            <li key={r.name}>
              <a className={`drt-top__row${r.you ? ' drt-top__row--you' : ''}`} href={rankHref(r.name)}>
                <span className="drt-top__place">{ordinal(r.place)}</span>
                <PlayerMark name={r.name} avatarId={r.avatarId} className="drt-top__mark" />
                <span className="drt-top__name">
                  {r.name}
                  {r.you ? <span className="drt-top__you">You</span> : null}
                </span>
                <span className="drt-top__value">
                  {r.value.toLocaleString()} {r.value === 1 ? record.unit[0] : record.unit[1]}
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  )
}

/**
 * A track's or hole's record as a bar: its map, name and #1, then your best along a bar as long as the share of
 * the record it makes (less is better: a lap's time, a hole's tries), and your place on its board and how far off.
 * Today's #1 is only 1st today, so it's never Yours.
 */
function CourseBarRow({ slug, row, me, nearest }: { slug: string; row: CourseRecordRow; me: string; nearest: boolean }) {
  const holder = row.holder
  const mine = Boolean(me) && holder?.name === me
  const you = row.you
  const share = holder && you ? (mine ? 1 : closeness(you.value, holder.value, true)) : 0
  let end: ReactNode
  if (mine && !row.today) end = <Yours />
  else if (mine) end = '1st today'
  else if (you) {
    const off = holder && you.value > holder.value ? `\u00a0· ${courseResult(slug, you.value - holder.value)} off` : ''
    end = `${ordinal(you.place)} of ${row.players.toLocaleString()}${off}`
  } else end = `Not ${done(dailyWords(slug).verb)} yet`
  return (
    <li
      className={`rbl-row rbc-row drt-course${mine && !row.today ? ' rbl-row--mine' : ''}${nearest ? ' rbc-row--near' : ''}${row.today ? ' drt-course--today' : ''}`}
    >
      <a className="rbl-row__link" href={row.today ? dailyTabHref(slug) : dailyTabHref(slug, 'past', row.n)}>
        <span className="rbc-what drt-course__what">
          <span className="drt-course__art">{slug === 'hotlap' ? <TrackMap day={row.day} /> : <HoleMap day={row.day} />}</span>
          <span className="drt-course__text">
            <span className="rbl-row__label">
              <span className="drt-course__name">
                #{row.n} {row.name}
              </span>
              {row.today ? <span className="drt-course__today">Today</span> : <span className="drt-course__when">{archiveDayWords(row.day)}</span>}
              {nearest ? <span className="rbc-near">Your nearest</span> : null}
            </span>
            <span className="rbc-held">
              {holder ? (
                <>
                  <b className="rbc-held__best">{courseResult(slug, holder.value)}</b>
                  <span>by</span>
                  <PlayerMark name={holder.name} avatarId={holder.avatarId} className="rbc-held__mark" />
                  <span className="rbc-held__tag">
                    <PlayerName name={holder.name} avatarId={holder.avatarId} />
                  </span>
                  {row.today || holder.set ? <span className="rbc-held__tied">· {row.today ? '1st today' : holder.set}</span> : null}
                </>
              ) : row.today ? (
                'Nobody yet today'
              ) : (
                'Nobody on its board yet'
              )}
            </span>
          </span>
        </span>
        <Bar share={share} value={you ? courseResult(slug, you.value) : undefined} />
        <span className="rbc-end">{end}</span>
      </a>
    </li>
  )
}

/**
 * Each track's or hole's record, newest first: its #1, when its day was, and your best and place on its
 * board. Today's #1 is only 1st today. Each row opens that course on the past tab (today's, the Today tab).
 */
function CourseGroup({
  slug,
  rows,
  failed,
  me,
  bars,
}: {
  slug: string
  rows: CourseRecordRow[] | null
  failed: boolean
  me: string
  bars: boolean
}) {
  const [all, setAll] = useState(false)
  const listRef = useRef<HTMLOListElement | null>(null)
  // "Show all" goes as it's pressed: keyboard focus moves to the first course it shows, not to the page.
  const showAll = () => {
    setAll(true)
    requestAnimationFrame(() => listRef.current?.querySelectorAll<HTMLAnchorElement>('a.rbl-row__link')[FIRST_COURSES]?.focus())
  }
  const words = dailyWords(slug)
  const course = words.course
  const shown = rows ? (all ? rows : rows.slice(0, FIRST_COURSES)) : []
  const title = `${course.charAt(0).toUpperCase()}${course.slice(1)} records`
  const near = nearestCourse(slug, rows, me)
  return (
    <section className="rbl-group" aria-labelledby="drt-courses-title">
      <h3 id="drt-courses-title" className="rbl-group__head">
        <span className="rbl-group__title">{title}</span>
        <span className="rbl-group__aside">
          each {course}’s {BOARD_NAMES.allTime} #1{rows ? ` · ${counted(rows.length, course)}` : ''}
        </span>
      </h3>
      {rows === null ? (
        <p className="drt-empty">
          {failed ? `Couldn’t load the ${course} records. Check your connection and try again.` : null}
        </p>
      ) : rows.length === 0 ? (
        <p className="drt-empty">The first {course} is still to come.</p>
      ) : (
        <ol ref={listRef} className="rbl-rows">
          {shown.map((row) => {
            if (bars) return <CourseBarRow key={row.n} slug={slug} row={row} me={me} nearest={row.n === near} />
            const holder = row.holder
            return (
              <li key={row.n} className={`rbl-row drt-course${row.today ? ' drt-course--today' : ''}`}>
                <a className="rbl-row__link" href={row.today ? dailyTabHref(slug) : dailyTabHref(slug, 'past', row.n)}>
                  <span className="rbl-row__label drt-course__label">
                    <span className="drt-course__art">{slug === 'hotlap' ? <TrackMap day={row.day} /> : <HoleMap day={row.day} />}</span>
                    <span className="drt-course__text">
                      <span className="drt-course__name">
                        #{row.n} {row.name}
                      </span>
                      <span className="drt-course__day">
                        {archiveDayWords(row.day)}
                        {row.today ? <span className="drt-course__today">Today</span> : null}
                      </span>
                    </span>
                  </span>
                  <span className="rbl-row__best">{holder ? courseResult(slug, holder.value) : '—'}</span>
                  {holder ? (
                    <span className="rbl-who">
                      <PlayerMark name={holder.name} avatarId={holder.avatarId} className="rbl-who__mark" />
                      <span className="rbl-who__text">
                        <span className="rbl-who__name">
                          <span className="rbl-who__tag">
                            <PlayerName name={holder.name} avatarId={holder.avatarId} />
                          </span>
                        </span>
                        {row.today || holder.set ? (
                          <span className="rbl-who__sub">{row.today ? '1st today' : holder.set}</span>
                        ) : null}
                      </span>
                    </span>
                  ) : (
                    <span className="rbl-who rbl-who--none">
                      {row.today ? 'Nobody yet today' : 'Nobody on its board yet'}
                    </span>
                  )}
                  <span className="rbl-row__go" aria-hidden="true">
                    <ChevronRightIcon />
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      )}
      {rows && rows.length > FIRST_COURSES && !all ? (
        <button type="button" className="drt-more" onClick={showAll}>
          Show all {rows.length}
        </button>
      ) : null}
    </section>
  )
}

/** The list while it loads: its own rows, empty, as many as it had (the tab also holds its height, useHeldHeight). */
function ListSkeleton({ rows, anon }: { rows: number[]; anon: boolean }) {
  const line = (w: string) => <span className="skel-line" style={{ '--skel-w': w } as CSSProperties} />
  // A space with no width: a line as tall as its words will be.
  const held = (
    <span className="rbc-held">
      {line('3rem')}
      <span className="pmark pmark--empty rbc-held__mark" />
      {line('4rem')}
    </span>
  )
  const bar = (
    <span className="rbc-bar">
      <span className="rbc-bar__track" />
      <span className="rbc-bar__you">{line('3.5rem')}</span>
    </span>
  )
  return (
    <div className={`sb-card rbl rbl--skel${anon ? ' rbl--anon' : ' rbl--bars'}`} aria-busy="true" aria-label="Loading records">
      {anon ? (
        <div className="rbl-cols" aria-hidden="true">
          <span>Record</span>
          <span>Best</span>
          <span>Held by</span>
          <span />
        </div>
      ) : null}
      {/* The first group is the records made over many days; the second, the tracks' or holes', has words by its name. */}
      {rows.map((n, g) => (
        <div key={g} className="rbl-group" aria-hidden="true">
          <div className="rbl-group__head">
            <span className="rbl-group__title">
              {line('7rem')}
              {'\u200b'}
            </span>
            {g === 1 ? <span className="rbl-group__aside">{line('12rem')}</span> : null}
          </div>
          <ol className="rbl-rows">
            {Array.from({ length: n }, (_, i) =>
              anon ? (
                <li key={i} className="rbl-row">
                  <div className="rbl-row__link">
                    <span className="rbl-row__label">{line('9rem')}</span>
                    <span className="rbl-row__best">{line('4rem')}</span>
                    <span className="rbl-who">
                      <span className="pmark pmark--empty rbl-who__mark" />
                      {line('5rem')}
                    </span>
                    <span />
                  </div>
                </li>
              ) : g === 0 ? (
                <li key={i} className="rbl-row rbc-row drt-day">
                  <div className="rbl-row__link">
                    <span className="rbc-what">
                      <span className="rbl-row__label drt-label">
                        <span className="drt-label__icon" />
                        {line('8rem')}
                        {'\u200b'}
                      </span>
                      <span className="rbc-held">
                        {line('3rem')}
                        <span className="pmark pmark--empty rbc-held__mark" />
                        {line('4rem')}
                        <span className="rbc-held__sub">
                          {line('6rem')}
                          {'\u200b'}
                        </span>
                      </span>
                    </span>
                    {bar}
                    <span className="rbc-end">{line('6rem')}</span>
                  </div>
                </li>
              ) : (
                <li key={i} className="rbl-row rbc-row drt-course">
                  <div className="rbl-row__link">
                    <span className="rbc-what drt-course__what">
                      <span className="drt-course__art" />
                      <span className="drt-course__text">
                        <span className="rbl-row__label">
                          {line('8rem')}
                          {'\u200b'}
                        </span>
                        {held}
                      </span>
                    </span>
                    {bar}
                    <span className="rbc-end">{line('6rem')}</span>
                  </div>
                </li>
              ),
            )}
          </ol>
          {/* A daily that's run more than the first tracks' worth of days shows them all a press away. */}
          {g === 1 ? (
            <button type="button" className="drt-more skel-btn" disabled tabIndex={-1}>
              Show all
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function RecordsBody({
  slug,
  viewer,
  courses,
  coursesFailed = false,
}: {
  slug: string
  viewer: Viewer
  courses?: CourseRecordRow[] | null
  /** The course list couldn't be had: its group says so, not "no tracks". */
  coursesFailed?: boolean
}) {
  const records = useDailyRecords(slug, viewer.name)
  const streak = useStreakBook(slug, viewer.name)
  const { signedIn, signedOut } = useAuth()
  const words = dailyWords(slug)
  const intro = recordsIntro(slug)
  const game = getGame(slug)
  const name = game?.name ?? slug
  const accent = resolveGameAccent(slug, game?.accent ?? '#2eb8a0')
  const hasCourses = courses !== undefined
  const boards = (LEADERBOARD_GAMES as readonly string[]).includes(slug) && isGameListed(slug)
  const knowsYou = viewer.signedIn && Boolean(viewer.name)
  const loading =
    (!streak.data && !streak.failed) || (!records.data && !records.failed) || (hasCourses && courses === null && !coursesFailed)
  const held = useHeldHeight<HTMLDivElement>(`daily-records-${slug}-${knowsYou ? 'in' : 'out'}`, loading)

  const rows: DayRecord[] = [
    streakRecord(slug, streak.data, viewer),
    daysWonRecord(records.data?.daysWon ?? null, viewer),
    // Not from an API before them, which sends neither: while the records come, a racing daily's wait for them.
    ...(records.data?.podiumDays !== null ? [podiumDaysRecord(records.data?.podiumDays ?? null, viewer)] : []),
    ...(isRaceGame(slug) && records.data?.goldStreak !== null ? [goldStreakRecord(records.data?.goldStreak ?? null, viewer)] : []),
    ...(hasCourses ? [coursesHeldRecord(slug, records.data?.courseRecords ?? null, viewer)] : []),
  ]
  const failedRow = (key: DayRecord['key']) => (key === 'streak' ? streak.failed : records.failed)
  const head = dayRecordsHead(slug, rows, courses ?? null, viewer)
  const anyFailed = streak.failed || records.failed || coursesFailed
  const coursesShown = courses ? Math.min(courses.length, FIRST_COURSES) : FIRST_COURSES

  return (
    <div
      ref={held.ref}
      className="sb gb rbk rbk--tab drt"
      style={{ '--gb-accent': accent, '--gb-accent-ink': inkOn(accent), ...held.style } as CSSProperties}
    >
      {/* Who holds the most of them: a bug hunt hiding place (lib/bugHunt.ts). */}
      <div className="rbk-tabhead" data-hunt={`r-head-${slug}`}>
        <div className="rbk-tabhead__text">
          {loading ? (
            <>
              <h2 className="rbk-tabhead__title rbk-tabhead__title--skel">
                <span className="skel-line" style={{ '--skel-w': '16em' } as CSSProperties} />
              </h2>
              {/* Signed in, the line says how close you are as well: two lines on a phone (records.css). */}
              <p className={`rbk-tabhead__line${knowsYou ? ' rbk-tabhead__line--two' : ''}`}>
                <span className="skel-line" style={{ '--skel-w': '14em' } as CSSProperties} />
              </p>
            </>
          ) : anyFailed ? (
            <h2 className="rbk-tabhead__title">{name} records</h2>
          ) : (
            <>
              <h2 className="rbk-tabhead__title">
                {head.name ? <span className="gb-title__lead">{head.name}</span> : null}
                {head.rest}
              </h2>
              {head.line.length || knowsYou ? (
                <p className="rbk-tabhead__line">
                  {head.line.join(' · ')}
                  {knowsYou ? `${head.line.length ? '. ' : ''}Each bar is how close you are.` : null}
                </p>
              ) : signedOut ? (
                <p className="rbk-tabhead__line">
                  <button type="button" className="rbk-tabhead__signin" onClick={openSiteMenu}>
                    Sign in
                  </button>{' '}
                  to see how close you are
                </p>
              ) : signedIn && !viewer.name ? (
                <p className="rbk-tabhead__line">
                  <button type="button" className="rbk-tabhead__signin" onClick={openTagPicker}>
                    Pick a gamer tag
                  </button>{' '}
                  to see how close you are
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="rbk-tabhead__picks">
          <a className="gh-more drt-head__link" href={dailyTabHref(slug, 'past')}>
            {intro.link}
            <ChevronRightIcon />
          </a>
          <BoardsAmong />
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={hasCourses ? [3, coursesShown] : [2]} anon={!knowsYou} />
      ) : (
        <div className={`sb-card rbl${knowsYou ? ' rbl--bars' : ' rbl--anon'}`}>
          {knowsYou ? null : (
            <div className="rbl-cols" aria-hidden="true">
              <span>Record</span>
              <span>Best</span>
              <span>Held by</span>
              <span />
            </div>
          )}
          <section className="rbl-group" aria-labelledby="drt-days-title">
            <h3 id="drt-days-title" className="rbl-group__head">
              <span className="rbl-group__title">Across the days</span>
            </h3>
            <ol className="rbl-rows">
              {rows.map((record) => (
                <DayRow key={record.key} record={record} bars={knowsYou} failed={failedRow(record.key)} />
              ))}
            </ol>
          </section>
          {hasCourses ? (
            <CourseGroup slug={slug} rows={courses} failed={coursesFailed} me={viewer.name} bars={knowsYou} />
          ) : null}
        </div>
      )}

      <p className="drt-aside">
        <InfoIcon />
        <span>
          Looking for 1st today, a past day’s places or this week’s? Those are boards, not records:{' '}
          <a href={dailyTabHref(slug)}>today’s board is on the Today tab</a>
          {boards ? ', ' : ' and '}
          <a href={dailyTabHref(slug, 'past')}>
            each past day’s {BOARD_NAMES.ranked} board is on {words.pastTab}
          </a>
          {boards ? (
            <>
              , and {name}’s week is on <a href={boardPlaceHref(slug as LeaderboardGame, 'weekly')}>its board</a>
            </>
          ) : null}
          .
        </span>
      </p>
    </div>
  )
}

function HotLapRecords({ viewer }: { viewer: Viewer }) {
  const today = trackDay()
  const { rows, failed } = useTrackRecordsAsked('hotlap', viewer.name)
  const courses = useMemo(() => (rows ? trackRecordRows(rows, today) : null), [rows, today])
  return <RecordsBody slug="hotlap" viewer={viewer} courses={courses} coursesFailed={failed} />
}

function AceChaseRecords({ viewer }: { viewer: Viewer }) {
  const today = dailyDay()
  const { rows, failed } = useHoleRecordsAsked(viewer.name)
  const courses = useMemo(() => (rows ? holeRecordRows(rows, today) : null), [rows, today])
  return <RecordsBody slug="acechase" viewer={viewer} courses={courses} coursesFailed={failed} />
}

/** A daily's Records tab, below its page's hero and tabs. */
export function DailyRecordsTab({ slug }: { slug: string }) {
  const account = useAccountId()
  const tag = normalizePlayerName(usePlayerName())
  // Signed out, nothing is saved, so there's no "you" to show: the tag on this device may be anyone's.
  const viewer: Viewer = { name: account === null ? '' : tag, signedIn: account !== null }
  if (slug === 'hotlap') return <HotLapRecords viewer={viewer} />
  if (slug === 'acechase') return <AceChaseRecords viewer={viewer} />
  return <RecordsBody slug={slug} viewer={viewer} />
}
