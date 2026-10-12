import { useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { getGame, isGameListed } from '../data/games'
import { dailyTrack, trackDay } from '../games/hotlap/daily'
import { buildTrack } from '../games/hotlap/sim'
import { trackPlan } from '../games/hotlap/trackPlan'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { dailyTabHref, gameBoardHref, rankHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { archiveDayWords } from '../lib/archive'
import { inkOn } from '../lib/color'
import { dailyDay, todaysHole } from '../lib/dailyHole'
import {
  courseResult,
  coursesHeldRecord,
  dayRecordsHead,
  daysWonRecord,
  holeRecordRows,
  nearestCourse,
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
import { ordinal } from '../lib/scoreboard'
import { resolveGameAccent } from '../lib/theme'
import { useTrackRecordsAsked } from '../lib/trackBoards'
import { ChevronRightIcon, FlameIcon } from './chromeIcons'
import { PlayerMark } from './PlayerMark'
import { PlayerName } from './PlayerName'
import { openSiteMenu } from './siteNav'
import { HolePlan } from './TodaysHoleCard'
import '../styles/dailyRecords.css'
import '../styles/todaysTrack.css'

/*
 * A daily's Records tab: only the records its boards don't already show. Since Ramsey said "yes match" (to the
 * game Records tab's one list, the "Records, more ideas" canvas's A, 2026-10-12) it's that list: who holds the
 * most and how you stand, in a line; then the records made over many days (Days played in a row, the most days
 * won, and on Hot Lap and Ace Chase the most track or hole records held), a row apiece that opens its first
 * five; then each track's or hole's record, which is just the #1 on its All time board, a row apiece that
 * opens that course's row on the past tab. What each row says is worked out in lib/dailyRecords.ts.
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

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 21V4M6 4h11l-2 4 2 4H6" />
    </svg>
  )
}

/** Days on a calendar: the records made over many days. */
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M9 3v4M15 3v4" />
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

/** Yours: the gold pill a game's Records tab gives a record you hold. */
function Yours({ note }: { note?: string }) {
  return (
    <span className="rbl-you">
      <span className="rbl-yours">
        <CrownIcon />
        Yours
      </span>
      {note ? <span className="rbl-you__gap">{note}</span> : null}
    </span>
  )
}

/**
 * One of the records made over many days: a row, like a game Records tab's, that opens its first five in place
 * (these have no page of their own). `failed`: it couldn't be had, and the row says so.
 */
function DayRow({ record, knowsYou, failed }: { record: DayRecord; knowsYou: boolean; failed: boolean }) {
  const [open, setOpen] = useState(false)
  const Icon = RECORD_ICONS[record.key]
  const you = record.you
  const mine = you?.kind === 'mine'
  const listId = `drt-top-${record.key}`
  const held = !failed && Boolean(record.holders)
  const canOpen = held && record.top.length > 1
  const tie = (record.holders?.marks.length ?? 0) > 1
  const cells = (
    <>
      <span className="rbl-row__label drt-label">
        <span className="drt-label__icon">
          <Icon />
        </span>
        {record.title}
        {/* A phone has no last column for the chevron: it sits by the name. */}
        {canOpen ? (
          <span className={`drt-label__more${open ? ' drt-toggle--open' : ''}`} aria-hidden="true">
            <ChevronRightIcon />
          </span>
        ) : null}
      </span>
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
                {mine && !knowsYou ? <span className="sb-row__you">You</span> : null}
              </span>
              {record.holders.sub ? <span className="rbl-who__sub">{record.holders.sub}</span> : null}
            </span>
          </span>
          {knowsYou ? (
            mine ? (
              <Yours note={you.note} />
            ) : you?.kind === 'on' ? (
              <span className="rbl-you">
                <span className="rbl-you__best">
                  <span className="rbl-you__pre">You </span>
                  <b>{you.value}</b>
                  {you.place ? <span className="rbl-you__place"> · {you.place}</span> : null}
                </span>
                {you.note ? <span className="rbl-you__gap">{you.note}</span> : null}
              </span>
            ) : you?.kind === 'none' ? (
              <span className="rbl-you">
                <span className="rbl-you__none">{you.text}</span>
              </span>
            ) : null
          ) : null}
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
  return (
    <li className={`rbl-row${mine ? ' rbl-row--mine' : ''}${held ? '' : ' rbl-row--open'}${tie ? ' drt-row--tie' : ''}`}>
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
 * Each track's or hole's record, newest first: its #1, when its day was, and your best and place on its
 * board. Today's #1 is only 1st today. Each row opens that course on the past tab (today's, the Today tab).
 */
function CourseGroup({
  slug,
  rows,
  failed,
  me,
  knowsYou,
}: {
  slug: string
  rows: CourseRecordRow[] | null
  failed: boolean
  me: string
  knowsYou: boolean
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
        <span className="rbl-group__icon">
          <FlagIcon />
        </span>
        {title}
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
            const holder = row.holder
            const mine = Boolean(me) && holder?.name === me
            const nearest = row.n === near
            return (
              <li key={row.n} className={`rbl-row drt-course${mine ? ' rbl-row--mine' : ''}${row.today ? ' drt-course--today' : ''}`}>
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
                          {mine && !knowsYou ? <span className="sb-row__you">You</span> : null}
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
                  {knowsYou ? (
                    mine && !row.today ? (
                      <Yours />
                    ) : row.you ? (
                      <span className="rbl-you">
                        <span className="rbl-you__best">
                          <span className="rbl-you__pre">You </span>
                          <b>{courseResult(slug, row.you.value)}</b>
                          <span className="rbl-you__place">
                            {' '}
                            · {ordinal(row.you.place)} of {row.players.toLocaleString()}
                          </span>
                        </span>
                        {holder && !mine && row.you.value > holder.value ? (
                          <span className={`rbl-you__gap${nearest ? ' rbl-you__gap--near' : ''}`}>
                            {courseResult(slug, row.you.value - holder.value)} off{nearest ? ' · your nearest' : ''}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="rbl-you">
                        <span className="rbl-you__none">Not {done(words.verb)} yet</span>
                      </span>
                    )
                  ) : null}
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
  return (
    <div className={`sb-card rbl rbl--skel${anon ? ' rbl--anon' : ''}`} aria-busy="true" aria-label="Loading records">
      <div className="rbl-cols" aria-hidden="true">
        <span>Record</span>
        <span>Best</span>
        <span>Held by</span>
        {anon ? null : <span>You</span>}
        <span />
      </div>
      {rows.map((n, g) => (
        <div key={g} className="rbl-group" aria-hidden="true">
          <div className="rbl-group__head">
            <span className="rbl-group__icon" />
            <span className="skel-line" style={{ '--skel-w': '7rem' } as CSSProperties} />
          </div>
          <ol className="rbl-rows">
            {Array.from({ length: n }, (_, i) => (
              <li key={i} className="rbl-row">
                <div className="rbl-row__link">
                  <span className="rbl-row__label">
                    <span className="skel-line" style={{ '--skel-w': '9rem' } as CSSProperties} />
                  </span>
                  <span className="rbl-row__best">
                    <span className="skel-line" style={{ '--skel-w': '4rem' } as CSSProperties} />
                  </span>
                  <span className="rbl-who">
                    <span className="pmark pmark--empty rbl-who__mark" />
                    <span className="skel-line" style={{ '--skel-w': '5rem' } as CSSProperties} />
                  </span>
                  {anon ? null : (
                    <span className="rbl-you">
                      <span className="skel-line" style={{ '--skel-w': '5.5rem' } as CSSProperties} />
                    </span>
                  )}
                  <span />
                </div>
              </li>
            ))}
          </ol>
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
              <p className="rbk-tabhead__line">
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
              {head.line.length ? (
                <p className="rbk-tabhead__line">{head.line.join(' · ')}</p>
              ) : signedOut ? (
                <p className="rbk-tabhead__line">
                  <button type="button" className="rbk-tabhead__signin" onClick={openSiteMenu}>
                    Sign in
                  </button>{' '}
                  to see how close you are
                </p>
              ) : signedIn && !viewer.name ? (
                <p className="rbk-tabhead__line">
                  <button type="button" className="rbk-tabhead__signin" onClick={openSiteMenu}>
                    Pick a gamer tag
                  </button>{' '}
                  to see how close you are
                </p>
              ) : null}
            </>
          )}
        </div>
        <a className="gh-more drt-head__link" href={dailyTabHref(slug, 'past')}>
          {intro.link}
          <ChevronRightIcon />
        </a>
      </div>

      {loading ? (
        <ListSkeleton rows={hasCourses ? [3, coursesShown] : [2]} anon={!knowsYou} />
      ) : (
        <div className={`sb-card rbl${knowsYou ? '' : ' rbl--anon'}`}>
          <div className="rbl-cols" aria-hidden="true">
            <span>Record</span>
            <span>Best</span>
            <span>Held by</span>
            {knowsYou ? <span>You</span> : null}
            <span />
          </div>
          <section className="rbl-group" aria-labelledby="drt-days-title">
            <h3 id="drt-days-title" className="rbl-group__head">
              <span className="rbl-group__icon">
                <CalendarIcon />
              </span>
              Across the days
            </h3>
            <ol className="rbl-rows">
              {rows.map((record) => (
                <DayRow key={record.key} record={record} knowsYou={knowsYou} failed={failedRow(record.key)} />
              ))}
            </ol>
          </section>
          {hasCourses ? (
            <CourseGroup slug={slug} rows={courses} failed={coursesFailed} me={viewer.name} knowsYou={knowsYou} />
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
              , and {name}’s week is on <a href={gameBoardHref(slug as LeaderboardGame, 'weekly')}>its board</a>
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
