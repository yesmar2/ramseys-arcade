import { useMemo, useState } from 'react'
import { CourseDrawing } from '../games/marblerun/CourseDrawing'
import { courseDay, dayOfCourse, PLANNED_COURSES } from '../games/marblerun/daily'
import { DAILY_COURSES, type PlannedCourse } from '../games/marblerun/dailyPlan'
import { formatRun } from '../games/marblerun/score'
import { LAB_PIECES_IN_WORDS, plannedCourse, type Course, type Feature } from '../games/marblerun/sim'
import { courseRunHref, LAB_HREF } from '../games/marblerun/links'
import { gamePlayHref } from '../hooks/useHashRoute'
import '../styles/adminBooks.css'
import '../styles/courseBook.css'

/*
 * The admin's Course Book: every day of Marble Run's course of the day that's planned (dailyPlan.ts), drawn
 * from above, with its blue ball's run, its length, its checkpoints and its stretches. Today's and any
 * still to come can be test run ahead of its day (TestCards.tsx), a past one rolled as practice; neither
 * keeps a run.
 */

const SLUG = 'marblerun'

type BookCourse = {
  n: number
  day: string
  name: string
  /** The blue ball's run, in seconds. */
  pace: number
  course: Course
  metres: number
  /** How far it falls from the start to its lowest point, in metres. */
  drop: number
  checkpoints: number
}

const FEATURE_WORDS: Record<Feature, string> = {
  sweeper: 'sweeper',
  hairpin: 'hairpin',
  esses: 'esses',
  narrow: 'narrow',
  drop: 'drop',
  rollers: 'rollers',
  posts: 'posts',
  chute: 'chute',
  jump: 'jump',
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const dateOf = (day: string) => new Date(`${day}T12:00:00Z`)
const dayWords = (day: string) => dayFormat.format(dateOf(day))

function bookCourse(entry: PlannedCourse, i: number): BookCourse {
  const n = i + 1
  const course = plannedCourse(n, entry.a)
  return {
    n,
    day: dayOfCourse(n),
    name: entry.name,
    pace: entry.pace / 1000,
    course,
    metres: Math.round(course.length),
    drop: Math.round(course.maxY - course.minY),
    checkpoints: course.lines.length - 1,
  }
}

export function AdminCourseBook() {
  const today = courseDay()
  const courses = useMemo(() => DAILY_COURSES.map(bookCourse), [])
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState<string>('all')

  const todays = courses.find((c) => c.day === today)
  const next = todays ? courses[todays.n] : undefined
  const months = useMemo(() => [...new Set(courses.map((c) => c.day.slice(0, 7)))], [courses])
  const q = query.trim().toLowerCase().replace(/^#/, '')
  const shown = courses.filter((c) => (month === 'all' || c.day.startsWith(month)) && (!q || c.name.toLowerCase().includes(q) || String(c.n) === q))
  const groups = months.map((key) => ({ key, courses: shown.filter((c) => c.day.startsWith(key)) })).filter((g) => g.courses.length)
  const last = courses[courses.length - 1]

  return (
    <div className="tb cb">
      <section className="adm-card" aria-labelledby="cb-title">
        <h2 className="adm-card__title" id="cb-title">
          Marble Run · Today’s Course
        </h2>
        <p className="adm-card__sub">
          Every course planned, a new one each day at midnight New York time, the same for everyone. Each was kept
          only once the blue ball got all the way down it without falling off. Test run today’s or any still to
          come, ahead of its day: a test run’s runs go on no board. A past one plays as practice.
          {last ? ` The plan runs to #${last.n} on ${dayWords(last.day)}, ${last.day.slice(0, 4)}; after that the days go round again from #1.` : ''}
        </p>
        <div className="tb-feature__acts" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
          <a className="panel__btn panel__btn--ghost adm-small" href={LAB_HREF}>
            Test track: new pieces →
          </a>
          <p className="tb-feature__next">
            {LAB_PIECES_IN_WORDS.charAt(0).toUpperCase() + LAB_PIECES_IN_WORDS.slice(1)}, all on one course to try. None is in a day’s course yet.
          </p>
        </div>
        {todays ? (
          <div className="tb-feature">
            <CourseDrawing course={todays.course} className="cb-map" />
            <div className="tb-feature__text">
              <span className="hb-badge">Today · #{todays.n}</span>
              <h3 className="tb-feature__name">{todays.name}</h3>
              <p className="tb-feature__facts">
                {dayWords(todays.day)} · blue ball {formatRun(todays.pace)} · {todays.metres} m · {todays.checkpoints} checkpoints ·{' '}
                {todays.drop} m down
              </p>
              <p className="cb-stretches">{todays.course.order.map((f) => FEATURE_WORDS[f]).join(' → ')}</p>
              <div className="tb-feature__acts">
                <a className="panel__btn adm-small" href={courseRunHref(todays.day)}>
                  Test run
                </a>
                <a className="panel__btn panel__btn--ghost adm-small" href={gamePlayHref(SLUG)}>
                  Roll it for real
                </a>
              </div>
              {next ? (
                <p className="tb-feature__next">
                  Tomorrow:{' '}
                  <a href={courseRunHref(next.day)}>
                    #{next.n} {next.name}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <div className="hb-tools">
        <input
          className="panel__input adm-input tb-search"
          type="search"
          value={query}
          placeholder="Find a course by name or number"
          aria-label="Find a course"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="chips" role="group" aria-label="Month">
          {['all', ...months].map((key) => (
            <button
              key={key}
              type="button"
              className={`chips__item${month === key ? ' chips__item--active' : ''}`}
              aria-pressed={month === key}
              onClick={() => setMonth(key)}
            >
              {key === 'all' ? 'Every month' : `${monthShort.format(dateOf(`${key}-15`))} ’${key.slice(2, 4)}`}
            </button>
          ))}
        </div>
        <p className="hb-count" aria-live="polite">
          {shown.length} {shown.length === 1 ? 'course' : 'courses'}
        </p>
      </div>

      {groups.length ? (
        groups.map((group) => (
          <section key={group.key} className="tb-month" aria-labelledby={`cb-${group.key}`}>
            <h3 className="tb-month__name" id={`cb-${group.key}`}>
              {monthFormat.format(dateOf(`${group.key}-15`))}
              <span>
                {group.courses.length} {group.courses.length === 1 ? 'course' : 'courses'}
              </span>
            </h3>
            <div className="tb-grid">
              {group.courses.map((course) => (
                <CourseTile key={course.n} course={course} today={today} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="adm-note">No course in the plan goes by that.</p>
      )}
      <p className="adm-note cb-note">
        {PLANNED_COURSES} courses planned. Longer courses (two more stretches) from #3: courses #1 and #2 are as they were played.
      </p>
    </div>
  )
}

function CourseTile({ course, today }: { course: BookCourse; today: string }) {
  const isToday = course.day === today
  const past = course.day < today
  return (
    <a
      className={`tb-tile${isToday ? ' tb-tile--today' : ''}${past ? ' tb-tile--past' : ''}`}
      href={courseRunHref(course.day)}
      aria-label={`#${course.n} ${course.name}, ${dayWords(course.day)}: ${past ? 'roll it as practice' : 'test run it'}`}
    >
      <div className="tb-tile__map">
        <CourseDrawing course={course.course} className="cb-map" />
        <span className="tb-tag">{isToday ? `Today · #${course.n}` : `#${course.n}`}</span>
      </div>
      <div className="tb-tile__body">
        <span className="tb-tile__date">{dayWords(course.day)}</span>
        <h4 className="tb-tile__name">{course.name}</h4>
        <dl className="tb-figs">
          <div>
            <dt>Blue ball</dt>
            <dd>{formatRun(course.pace)}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{course.metres} m</dd>
          </div>
          <div>
            <dt>Checkpoints</dt>
            <dd>{course.checkpoints}</dd>
          </div>
        </dl>
        <span className="tb-tile__go">{past ? 'Practice →' : 'Test run →'}</span>
      </div>
    </a>
  )
}
