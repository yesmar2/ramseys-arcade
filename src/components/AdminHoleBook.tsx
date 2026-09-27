import { useEffect, useMemo, useRef, useState } from 'react'
import { DAILY_EPOCH, dailyHoleDef, KIND_NAME, KINDS, STYLES, type DailyPick, type Kind } from '../games/acechase/daily'
import { DAILY_CHECKS, type DayCheck } from '../games/acechase/dailyChecks'
import { DAILY_PLAN } from '../games/acechase/dailyPlan'
import { drawHolePlan } from '../games/acechase/holePlan'
import type { HoleDef, Style } from '../games/acechase/physics'
import { gamePlayHref } from '../hooks/useHashRoute'
import { dailyDay } from '../lib/dailyHole'
import '../styles/adminBooks.css'

/*
 * The admin's Hole Book: every day of Ace Chase's Today's Hole that's planned (dailyPlan.ts), drawn from
 * above, with what the planner's check found (dailyChecks.ts): how easy it is next to the rest, and the
 * way in, hidden until asked for. Any day can be tried ahead as a hole on trial, which keeps nothing.
 */

const SLUG = 'acechase'
const PLACE: Record<Style, string> = { garden: 'Garden', ice: 'Ice rink', moon: 'The Moon' }
/** A count of days in a place: "142 garden", "20 Moon". */
const PLACE_DAYS: Record<Style, string> = { garden: 'garden', ice: 'ice rink', moon: 'Moon' }

type Grade = 'easier' | 'middling' | 'harder'
const GRADE: Record<Grade, string> = { easier: 'Easier', middling: 'Middling', harder: 'Harder' }

type PlannedHole = { n: number; day: string; pick: DailyPick; def: HoleDef; check: DayCheck | undefined; grade: Grade }

type Filters = { range: 'ahead' | 'all'; place: Style | 'all'; kind: Kind | 'all' }
const FILTERS_KEY = 'skermix-admin-holes'

function holeDay(n: number): string {
  const [y, m, d] = DAILY_EPOCH.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n - 1)).toISOString().slice(0, 10)
}

const dateOf = (day: string) => new Date(`${day}T12:00:00Z`)
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const longFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** Every planned day, built, and how easy each is: its widest way in, in thirds of the plan. */
function plannedHoles(): PlannedHole[] {
  const holes = DAILY_PLAN.map((pick, i) => {
    const n = i + 1
    const day = holeDay(n)
    return { n, day, pick, def: dailyHoleDef(pick, day), check: DAILY_CHECKS[i], grade: 'middling' as Grade }
  })
  const widths = holes.map((h) => h.check?.windows[0]?.cells ?? 0).sort((a, b) => a - b)
  const low = widths[Math.floor(widths.length / 3)] ?? 0
  const high = widths[Math.floor((widths.length * 2) / 3)] ?? 0
  for (const h of holes) {
    const w = h.check?.windows[0]?.cells ?? 0
    h.grade = w >= high ? 'easier' : w >= low ? 'middling' : 'harder'
  }
  return holes
}

function savedFilters(): Filters {
  const fallback: Filters = { range: 'ahead', place: 'all', kind: 'all' }
  try {
    const saved = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? 'null') as Partial<Filters> | null
    return {
      range: saved?.range === 'all' ? 'all' : 'ahead',
      place: saved?.place && (STYLES as readonly string[]).includes(saved.place) ? saved.place : 'all',
      kind: saved?.kind && (KINDS as readonly string[]).includes(saved.kind) ? saved.kind : 'all',
    }
  } catch {
    return fallback
  }
}

function fits(hole: PlannedHole, filters: Filters, today: string) {
  return (
    (filters.range === 'all' || hole.day >= today) &&
    (filters.place === 'all' || hole.pick.style === filters.place) &&
    (filters.kind === 'all' || hole.pick.kind === filters.kind)
  )
}

/** A hole on trial: the day's hole, played ahead, keeping nothing. */
const tryHref = (day: string) => `${gamePlayHref(SLUG)}?hole=${encodeURIComponent(`day:${day}`)}`

export function AdminHoleBook() {
  const today = dailyDay()
  const holes = useMemo(plannedHoles, [])
  const [filters, setFilters] = useState(savedFilters)
  const [target, setTarget] = useState<number | null>(null)
  const [flash, setFlash] = useState<number | null>(null)

  const change = (next: Partial<Filters>) => {
    setFilters((was) => {
      const now = { ...was, ...next }
      try {
        localStorage.setItem(FILTERS_KEY, JSON.stringify(now))
      } catch {
        /* storage may be off */
      }
      return now
    })
  }

  // To a day from the season: shown whatever the filters said, scrolled to and lit up.
  const goTo = (hole: PlannedHole) => {
    if (!fits(hole, filters, today)) change({ range: hole.day < today ? 'all' : filters.range, place: 'all', kind: 'all' })
    setTarget(hole.n)
  }
  useEffect(() => {
    if (target === null) return
    const el = document.getElementById(`hole-${target}`)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' })
    setFlash(target)
    setTarget(null)
  }, [target])
  useEffect(() => {
    if (flash === null) return
    const id = window.setTimeout(() => setFlash(null), 1600)
    return () => window.clearTimeout(id)
  }, [flash])

  const shown = holes.filter((h) => fits(h, filters, today))
  const first = holes[0]
  const last = holes[holes.length - 1]
  const todays = holes.find((h) => h.day === today)
  const count = (style: Style) => holes.filter((h) => h.pick.style === style).length

  return (
    <div className="hb">
      <section className="adm-card" aria-labelledby="hb-title">
        <h2 className="adm-card__title" id="hb-title">
          Ace Chase · Today’s Hole
        </h2>
        {first && last ? (
          <p className="adm-card__sub">
            Every hole planned, one a day from #1 on {longFormat.format(dateOf(first.day))} to #{last.n} on{' '}
            {longFormat.format(dateOf(last.day))}, each a different kind of green from the day before. Every one was
            played at every power and angle before it went in, and kept only if a player following the misses can
            find the bullseye, about as hard as the rest, without the hole giving it away. Try any of them ahead: a
            hole on trial keeps nothing.
          </p>
        ) : null}
        <ul className="hb-tally">
          <li>
            <b>{holes.length}</b> days
          </li>
          {STYLES.map((style) => (
            <li key={style}>
              <span className={`hb-dot hb-dot--${style}`} aria-hidden="true" />
              <b>{count(style)}</b> {PLACE_DAYS[style]}
            </li>
          ))}
          {todays ? (
            <li>
              Today is <b>#{todays.n}</b>
            </li>
          ) : null}
        </ul>
        <Season holes={holes} today={today} onPick={goTo} />
      </section>

      <div className="hb-tools">
        <div className="chips" role="group" aria-label="Which days">
          {(['ahead', 'all'] as const).map((range) => (
            <button
              key={range}
              type="button"
              className={`chips__item${filters.range === range ? ' chips__item--active' : ''}`}
              aria-pressed={filters.range === range}
              onClick={() => change({ range })}
            >
              {range === 'ahead' ? 'From today' : 'All days'}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Place">
          {(['all', ...STYLES] as const).map((place) => (
            <button
              key={place}
              type="button"
              className={`chips__item${filters.place === place ? ' chips__item--active' : ''}`}
              aria-pressed={filters.place === place}
              onClick={() => change({ place })}
            >
              {place === 'all' ? 'Every place' : PLACE[place]}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Kind of green">
          {(['all', ...KINDS] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`chips__item${filters.kind === kind ? ' chips__item--active' : ''}`}
              aria-pressed={filters.kind === kind}
              onClick={() => change({ kind })}
            >
              {kind === 'all' ? 'Every kind' : KIND_NAME[kind]}
            </button>
          ))}
        </div>
        <p className="hb-count" aria-live="polite">
          {shown.length} {shown.length === 1 ? 'hole' : 'holes'}
        </p>
      </div>

      {shown.length ? (
        <div className="hb-grid">
          {shown.map((hole) => (
            <HoleCard key={hole.n} hole={hole} today={today} flash={flash === hole.n} />
          ))}
        </div>
      ) : (
        <p className="adm-note">No hole in the plan is all of those. Try every place or every kind.</p>
      )}
    </div>
  )
}

/** The plan's months, a row each, a square a day in the colour of its place: one to go to it. */
function Season({ holes, today, onPick }: { holes: PlannedHole[]; today: string; onPick: (hole: PlannedHole) => void }) {
  const months = useMemo(() => {
    const out: { key: string; holes: PlannedHole[] }[] = []
    for (const hole of holes) {
      const key = hole.day.slice(0, 7)
      const month = out[out.length - 1]
      if (month?.key === key) month.holes.push(hole)
      else out.push({ key, holes: [hole] })
    }
    return out
  }, [holes])
  return (
    <div className="hb-season" aria-label="Where each day is played">
      {months.map((month) => (
        <div key={month.key} className="hb-season__month">
          <span className="hb-season__name">
            {monthFormat.format(dateOf(month.holes[0]!.day))} ’{month.key.slice(2, 4)}
          </span>
          <div className="hb-season__days">
            {month.holes.map((hole) => {
              const words = `#${hole.n} · ${dayFormat.format(dateOf(hole.day))} · ${hole.def.name} (${PLACE[hole.pick.style]}, ${KIND_NAME[hole.pick.kind].toLowerCase()})`
              return (
                <button
                  key={hole.n}
                  type="button"
                  className={`hb-day hb-day--${hole.pick.style}${hole.day < today ? ' hb-day--past' : ''}${hole.day === today ? ' hb-day--today' : ''}`}
                  style={{ gridColumn: Number(hole.day.slice(8, 10)) }}
                  title={words}
                  aria-label={words}
                  onClick={() => onPick(hole)}
                />
              )
            })}
          </div>
        </div>
      ))}
      <p className="hb-season__key">
        {STYLES.map((style) => (
          <span key={style}>
            <span className={`hb-dot hb-dot--${style}`} aria-hidden="true" />
            {PLACE[style]}
          </span>
        ))}
        <span>Faded days are past. Pick a day to go to its hole.</span>
      </p>
    </div>
  )
}

const signed = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)}°`
const power = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
const span = (a: number, b: number, words: (v: number) => string) => (a === b ? words(a) : `${words(a)} to ${words(b)}`)

/** One day's hole: drawn from above when it comes near the screen, and again if its box changes size. */
function HoleCard({ hole, today, flash }: { hole: PlannedHole; today: string; flash: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    let drawn = ''
    let near = false
    const draw = () => {
      const box = el.getBoundingClientRect()
      const width = Math.round(box.width)
      const height = Math.round(box.height)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const key = `${width}x${height}@${dpr}`
      if (width < 2 || height < 2 || key === drawn) return
      drawn = key
      drawHolePlan(el, hole.def, hole.def.spots[0]!, width, height, dpr)
    }
    const coming = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        near = true
        draw()
      },
      { rootMargin: '600px 0px' },
    )
    const sized = new ResizeObserver(() => {
      if (near) draw()
    })
    coming.observe(el)
    sized.observe(el)
    return () => {
      coming.disconnect()
      sized.disconnect()
    }
  }, [hole])

  const best = hole.check?.windows[0]
  const isToday = hole.day === today
  return (
    <article id={`hole-${hole.n}`} className={`hb-hole${isToday ? ' hb-hole--today' : ''}${flash ? ' hb-hole--flash' : ''}`}>
      <div className="hb-hole__top">
        <span className="hb-hole__n">#{hole.n}</span>
        <span>{dayFormat.format(dateOf(hole.day))}</span>
        {isToday ? <span className="hb-badge">Today</span> : null}
        <span className="hb-hole__place">
          <span className={`hb-dot hb-dot--${hole.pick.style}`} aria-hidden="true" />
          {PLACE[hole.pick.style]}
        </span>
        <span className="hb-hole__kind">{KIND_NAME[hole.pick.kind]}</span>
      </div>
      <div className="hb-plan" role="img" aria-label={`${hole.def.name} from above: the tee on the left, the target on the right`}>
        <canvas ref={canvas} />
      </div>
      <div className="hb-hole__text">
        <h3 className="hb-hole__name">{hole.def.name}</h3>
        <p className="hb-hole__note">{hole.def.note}</p>
      </div>
      <div className="hb-hole__foot">
        <span className={`hb-grade hb-grade--${hole.grade}`}>{GRADE[hole.grade]}</span>
        {hole.check && best ? (
          <span className="hb-ways">
            <b>{hole.check.cells}</b> bullseye settings, the widest run <b>{best.cells}</b>
          </span>
        ) : null}
        <span className="hb-hole__acts">
          {best ? (
            <button type="button" className="hb-link" aria-expanded={open} onClick={() => setOpen((was) => !was)}>
              {open ? 'Hide the answer' : 'Show the answer'}
            </button>
          ) : null}
          <a className="hb-link hb-link--go" href={tryHref(hole.day)}>
            Try it
          </a>
        </span>
      </div>
      {open && best && hole.check ? (
        <p className="hb-answer">
          Widest run: power <b>{span(best.p0, best.p1, power)}</b>, angle <b>{span(best.a0, best.a1, signed)}</b>. One that works:{' '}
          <b>{power(best.sample[0])}</b> at <b>{signed(best.sample[1])}</b>.
          {hole.check.windows.length > 1 ? ' There are narrower runs elsewhere too.' : ''}
        </p>
      ) : null}
    </article>
  )
}
