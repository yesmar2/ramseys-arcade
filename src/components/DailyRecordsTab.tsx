import { useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { getGame, isGameListed } from '../data/games'
import { dailyTrack, trackDay } from '../games/hotlap/daily'
import { buildTrack } from '../games/hotlap/sim'
import { trackPlan } from '../games/hotlap/trackPlan'
import { useAccountId } from '../hooks/useAccountId'
import { dailyTabHref, gameBoardHref, rankHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { archiveDayWords } from '../lib/archive'
import { dailyDay, todaysHole } from '../lib/dailyHole'
import {
  courseResult,
  coursesHeldCard,
  daysWonCard,
  holeRecordRows,
  recordsIntro,
  streakCard,
  trackRecordRows,
  useDailyRecords,
  useStreakBook,
  type CourseRecordRow,
  type RecordCard,
} from '../lib/dailyRecords'
import { BOARD_NAMES, dailyWords } from '../lib/dailyWords'
import { LEADERBOARD_GAMES, normalizePlayerName, type LeaderboardGame } from '../lib/leaderboard'
import { useHoleRecordsAsked } from '../lib/pastHoles'
import { ordinal } from '../lib/scoreboard'
import { useTrackRecordsAsked } from '../lib/trackBoards'
import { ChevronRightIcon, FlameIcon } from './chromeIcons'
import { PlayerMark } from './PlayerMark'
import { RunLabel } from './RunLabel'
import { HolePlan } from './TodaysHoleCard'
import '../styles/dailyRecords.css'
import '../styles/todaysTrack.css'

/*
 * A daily's Records tab: only the records its boards don't already show. Days played in a row, the most
 * days won, and on Hot Lap and Ace Chase the most track or hole records held, each with its holder (or
 * everyone tied for it), the first five and you; then each track's or hole's record, which is just the #1
 * on its All time board, a row apiece that opens that course's row on the past tab. What each card says is
 * worked out in lib/dailyRecords.ts.
 */

/** Course rows before "Show all". */
const FIRST_COURSES = 10

type Viewer = { name: string; signedIn: boolean }

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

/** How near you are, in steps up to the holder's number; past ten steps, a bar. */
function Meter({ have, of }: { have: number; of: number }) {
  if (of > 10) {
    return (
      <span className="drt-meter drt-meter--bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (have / Math.max(1, of)) * 100)}%` }} />
      </span>
    )
  }
  const steps = Math.max(of, 3)
  return (
    <span className="drt-meter" aria-hidden="true">
      {Array.from({ length: steps }, (_, i) => (
        <i key={i} className={i < have ? 'drt-meter__on' : i === have && have < of ? 'drt-meter__next' : undefined} />
      ))}
    </span>
  )
}

/** The courses' records wear the flag of the board label (RunLabel), since each is a board's #1. */
const CARD_ICONS: Record<RecordCard['key'], ComponentType> = {
  streak: FlameIcon,
  'days-won': CrownIcon,
  'courses-held': FlagIcon,
}

function CardShell({ title, icon, children }: { title: string; icon: RecordCard['key']; children: ReactNode }) {
  const Icon = CARD_ICONS[icon]
  return (
    <section className="gh-card drt-card" aria-label={title}>
      <div className="drt-card__top">
        <span className="drt-card__icon">
          <Icon />
        </span>
        <h3 className="drt-card__title">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function CardWaiting({ title, icon, failed }: { title: string; icon: RecordCard['key']; failed: boolean }) {
  return (
    <CardShell title={title} icon={icon}>
      {failed ? (
        <p className="drt-holder drt-holder--empty">Couldn’t load this one. Check your connection and try again.</p>
      ) : (
        <div className="drt-holder drt-holder--skel" aria-busy="true">
          <span className="skel-line" style={{ '--skel-w': '9rem' } as CSSProperties} />
          <span className="skel-line" style={{ '--skel-w': '6rem' } as CSSProperties} />
        </div>
      )}
    </CardShell>
  )
}

function RecordCardView({ card, slug, me }: { card: RecordCard; slug: string; me: string }) {
  const { holder, rows, you } = card
  return (
    <CardShell title={card.title} icon={card.key}>
      {holder ? (
        <div className={`drt-holder${holder.marks.length > 1 ? ' drt-holder--tied' : ''}`}>
          <span className={`drt-holder__marks${holder.marks.length > 1 ? ' drt-holder__marks--stack' : ''}`}>
            {holder.marks.map((m) => (
              <PlayerMark key={m.name} name={m.name} avatarId={m.avatarId} className="drt-holder__mark" />
            ))}
          </span>
          <p className="drt-holder__who">
            <b>{holder.line}</b>
            {holder.sub ? <span>{holder.sub}</span> : null}
          </p>
          <p className="drt-holder__value">
            {holder.value.toLocaleString()}
            <small> {holder.unit}</small>
          </p>
        </div>
      ) : (
        <p className="drt-holder drt-holder--empty">{card.empty}</p>
      )}

      {rows.length > 1 ? (
        <ol className="drt-top" aria-label={`${card.title}: the first ${rows.length}`}>
          {rows.map((r) => (
            <li key={r.name}>
              <a className={`drt-top__row${r.you ? ' drt-top__row--you' : ''}`} href={rankHref(r.name)}>
                <span className="drt-top__place">{ordinal(r.place)}</span>
                <PlayerMark name={r.name} avatarId={r.avatarId} className="drt-top__mark" />
                <span className="drt-top__name">
                  {r.name}
                  {r.you ? <span className="drt-top__you">You</span> : null}
                </span>
                <span className="drt-top__value">
                  {r.value.toLocaleString()} {r.value === 1 ? card.unit[0] : card.unit[1]}
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : null}

      {you ? (
        <div className="drt-you">
          <p className="drt-you__head">
            <PlayerMark name={me} className="drt-you__mark" />
            <b>You: {you.value}</b>
            {you.aside ? <span className="drt-you__aside">{you.aside}</span> : null}
          </p>
          <Meter have={you.have} of={you.of} />
          <p className="drt-you__line">{you.line}</p>
        </div>
      ) : card.signIn ? (
        <p className="drt-you__line drt-you__line--quiet">{card.signIn}</p>
      ) : null}

      <p className="drt-card__foot">
        <RunLabel kind={card.foot.label} slug={slug} short />
        <span>{card.foot.text}</span>
      </p>
    </CardShell>
  )
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

/** "raced", "played", "flown": the verb on a start button, done ("Not flown yet"). */
function done(verb: string): string {
  const v = verb.toLowerCase()
  if (v === 'fly') return 'flown'
  return v.endsWith('e') ? `${v}d` : `${v}ed`
}

/**
 * Each track's or hole's record, newest first: its #1, when its day was, and your best and place on its
 * board. Today's #1 is only 1st today. Each row opens that course on the past tab (today's, the Today tab).
 * Signed out (`me` is '') the last column is how many are on each board instead.
 */
function CourseRecords({
  slug,
  rows,
  failed,
  me,
}: {
  slug: string
  rows: CourseRecordRow[] | null
  failed: boolean
  me: string
}) {
  const [all, setAll] = useState(false)
  const words = dailyWords(slug)
  const course = words.course
  const shown = rows ? (all ? rows : rows.slice(0, FIRST_COURSES)) : []
  const title = `${course.charAt(0).toUpperCase()}${course.slice(1)} records`
  return (
    <section className="gh-card drt-courses" aria-labelledby="drt-courses-title">
      <div className="drt-courses__head">
        <h3 id="drt-courses-title" className="drt-courses__title">
          {title}
        </h3>
        {rows ? (
          <span className="drt-courses__count">
            {rows.length} {rows.length === 1 ? course : `${course}s`}
          </span>
        ) : null}
        <a className="gh-more drt-courses__all" href={dailyTabHref(slug, 'past')}>
          All {words.pastTab.toLowerCase()}
          <ChevronRightIcon />
        </a>
      </div>
      <div className="drt-row drt-row--head" aria-hidden="true">
        <span>{course}</span>
        <span>Its day</span>
        <span>Record</span>
        <span>{me ? 'Your best' : BOARD_NAMES.allTime}</span>
        <span />
      </div>
      {rows === null ? (
        failed ? (
          <p className="drt-courses__empty">Couldn’t load the {course} records. Check your connection and try again.</p>
        ) : (
          <div className="drt-courses__skel" aria-busy="true">
            <span className="skel-line" />
            <span className="skel-line" />
            <span className="skel-line" />
          </div>
        )
      ) : rows.length === 0 ? (
        <p className="drt-courses__empty">The first {course} is still to come.</p>
      ) : (
        <ol className="drt-rows">
          {shown.map((row) => {
            const mine = Boolean(me) && row.holder?.name === me
            return (
              <li key={row.n}>
                <a
                  className={`drt-row${row.today ? ' drt-row--today' : ''}`}
                  href={row.today ? dailyTabHref(slug) : dailyTabHref(slug, 'past', row.n)}
                >
                  <span className="drt-row__course">
                    <span className="drt-row__art">
                      {slug === 'hotlap' ? <TrackMap day={row.day} /> : <HoleMap day={row.day} />}
                    </span>
                    <b>
                      #{row.n} {row.name}
                    </b>
                  </span>
                  <span className="drt-row__day">
                    {archiveDayWords(row.day)}
                    {row.today ? <span className="drt-row__today">Today</span> : null}
                  </span>
                  <span className="drt-row__rec">
                    {/* The table's heads are gone on a phone, so each figure says what it is. */}
                    <span className="drt-row__cap">{row.today ? 'Today' : 'Record'}</span>
                    {row.holder ? (
                      <>
                        <PlayerMark name={row.holder.name} avatarId={row.holder.avatarId} className="drt-row__mark" />
                        <b className={mine ? 'drt-row__me' : undefined}>{row.holder.name}</b>
                        {row.today ? <span className="drt-row__first">1st today</span> : null}
                        <b className="drt-row__result">{courseResult(slug, row.holder.value)}</b>
                        {row.holder.set && !row.today ? <span className="drt-row__set">{row.holder.set}</span> : null}
                      </>
                    ) : (
                      <span className="drt-row__quiet">{row.today ? 'Nobody yet today' : 'Nobody on its board yet'}</span>
                    )}
                  </span>
                  <span className="drt-row__you">
                    <span className="drt-row__cap">{me ? 'You' : BOARD_NAMES.allTime}</span>
                    {row.you ? (
                      <>
                        <b>{courseResult(slug, row.you.value)}</b>
                        <span>
                          {' '}
                          · {ordinal(row.you.place)} of {row.players.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="drt-row__quiet">
                        {/* Signed out there's no "you" to have played it, only how many are on it: the head and cap say "All time". */}
                        {me
                          ? `Not ${done(words.verb)} yet${row.players ? ` · ${counted(row.players, 'player')}` : ''}`
                          : row.players
                            ? counted(row.players, 'player')
                            : 'Nobody on it yet'}
                      </span>
                    )}
                  </span>
                  <span className={`drt-row__go${row.today ? ' drt-row__go--today' : ''}`}>
                    <span className="drt-row__go-text">{row.today ? words.today : words.pastTab}</span>
                    <ChevronRightIcon />
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      )}
      {rows && rows.length > FIRST_COURSES && !all ? (
        <button type="button" className="drt-courses__more" onClick={() => setAll(true)}>
          Show all {rows.length}
        </button>
      ) : null}
      <p className="drt-courses__note">
        Each is that {course}’s {BOARD_NAMES.allTime} #1.
      </p>
    </section>
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
  /** The course list couldn't be had: its table and the held card say so, not "no tracks". */
  coursesFailed?: boolean
}) {
  const records = useDailyRecords(slug, viewer.name)
  const streak = useStreakBook(slug, viewer.name)
  const words = dailyWords(slug)
  const intro = recordsIntro(slug)
  const hasCourses = courses !== undefined
  const name = getGame(slug)?.name ?? slug
  const boards = (LEADERBOARD_GAMES as readonly string[]).includes(slug) && isGameListed(slug)
  const heldTitle = `Most ${words.course} records held`

  return (
    <div className="drt">
      <div className="drt-intro" data-hunt={`r-head-${slug}`}>
        <div className="drt-intro__text">
          <h2 className="drt-intro__title">Records that span the days</h2>
          <p className="drt-intro__lede">{intro.lede}</p>
        </div>
        <a className="gh-more drt-intro__link" href={dailyTabHref(slug, 'past')}>
          {intro.link}
          <ChevronRightIcon />
        </a>
      </div>

      <div className={`drt-cards${hasCourses ? ' drt-cards--three' : ''}`}>
        {streak.data ? (
          <RecordCardView card={streakCard(slug, streak.data, viewer)} slug={slug} me={viewer.name} />
        ) : (
          <CardWaiting title="Days played in a row" icon="streak" failed={streak.failed} />
        )}
        {records.data ? (
          <RecordCardView card={daysWonCard(slug, records.data.daysWon, viewer)} slug={slug} me={viewer.name} />
        ) : (
          <CardWaiting title="Most days won" icon="days-won" failed={records.failed} />
        )}
        {hasCourses ? (
          records.data && courses !== null ? (
            <RecordCardView
              card={coursesHeldCard(slug, records.data.courseRecords, courses, viewer)}
              slug={slug}
              me={viewer.name}
            />
          ) : (
            <CardWaiting title={heldTitle} icon="courses-held" failed={records.failed || coursesFailed} />
          )
        ) : null}
      </div>

      {hasCourses ? <CourseRecords slug={slug} rows={courses} failed={coursesFailed} me={viewer.name} /> : null}

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
