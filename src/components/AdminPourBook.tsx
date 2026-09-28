import { useEffect, useMemo, useState } from 'react'
import { dayNumber, FIRST_DAY, pourDay } from '../games/halffull/daily'
import { K, LEVELS, radiusAt, type Glass } from '../games/halffull/glasses'
import { liquidFor } from '../games/halffull/looks'
import { dayPlan, HALF_ROUNDS, splitLevelB, type DayPlan } from '../games/halffull/plan'
import { gamePlayHref } from '../hooks/useHashRoute'
import '../styles/adminBooks.css'

/*
 * The admin's Pour Book: Half Full's Today's Pour, a day at a time from #1 on. Nothing is planned ahead
 * or stored: each day grows from its date (plan.ts), and the API builds the same day to judge a pour, so
 * the book builds them here the same way. Each day shows its five glasses filled to their true half (the
 * split to a fair share), how far the modelled pourer misses on each, and what the day came out at next
 * to its weekday's band. A day that never got into its band is flagged: it wants a salt in OVERRIDES.
 * A past day can be poured again from here, as practice, which keeps nothing.
 */

const SLUG = 'halffull'
/** Days shown past today to start with, and how many more a press of "Later days" adds. */
const AHEAD = 56
const MORE = 28
/** Milliseconds a slice of building may take: a day can take tens of them to find its glasses. */
const SLICE_MS = 12

type Filters = { range: 'ahead' | 'all'; offOnly: boolean }
const FILTERS_KEY = 'skermix-admin-pours'

const dateOf = (day: string) => new Date(`${day}T12:00:00Z`)
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const longFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function addDays(day: string, n: number): string {
  return new Date(dateOf(day).getTime() + n * 86_400_000).toISOString().slice(0, 10)
}

/** "+3.1", "−0.4": a miss in points, over or under. */
const signed = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)}`

function savedFilters(): Filters {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? 'null') as Partial<Filters> | null
    return { range: saved?.range === 'all' ? 'all' : 'ahead', offOnly: saved?.offOnly === true }
  } catch {
    return { range: 'ahead', offOnly: false }
  }
}

/**
 * The days' glasses, built a slice at a time so a long run of days never holds the page up. dayPlan
 * keeps every day it builds, so going back over days already built is quick.
 */
function usePlans(days: readonly string[]): ReadonlyMap<string, DayPlan> {
  const [plans, setPlans] = useState<ReadonlyMap<string, DayPlan>>(() => new Map())
  useEffect(() => {
    const made = new Map<string, DayPlan>()
    let i = 0
    let timer = 0
    const slice = () => {
      const until = performance.now() + SLICE_MS
      while (i < days.length && performance.now() < until) {
        const day = days[i++]!
        made.set(day, dayPlan(day))
      }
      setPlans(new Map(made))
      if (i < days.length) timer = window.setTimeout(slice, 0)
    }
    timer = window.setTimeout(slice, 0)
    return () => window.clearTimeout(timer)
  }, [days])
  return plans
}

export function AdminPourBook() {
  const today = pourDay()
  const from = today > FIRST_DAY ? today : FIRST_DAY
  const [filters, setFilters] = useState(savedFilters)
  const [ahead, setAhead] = useState(AHEAD)

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

  // Every day from #1 to the last one asked for; the filters pick from these.
  const days = useMemo(() => {
    const out: string[] = []
    const last = addDays(from, ahead)
    for (let day = FIRST_DAY; day <= last; day = addDays(day, 1)) out.push(day)
    return out
  }, [from, ahead])
  const plans = usePlans(days)
  const built = days.filter((day) => plans.has(day))
  const off = built.filter((day) => !plans.get(day)!.inBand)
  const shown = built.filter((day) => (filters.range === 'all' || day >= today) && (!filters.offOnly || !plans.get(day)!.inBand))
  const months = [...new Set(shown.map((day) => day.slice(0, 7)))]
  const building = built.length < days.length

  return (
    <div className="pb">
      <section className="adm-card" aria-labelledby="pb-title">
        <h2 className="adm-card__title" id="pb-title">
          Half Full · Today’s Pour
        </h2>
        <p className="adm-card__sub">
          Every day’s five glasses, from #1 on {longFormat.format(dateOf(FIRST_DAY))}: four to fill half full, easy to
          hard, then a fair share between two. A day isn’t planned ahead: it grows from its date, the same on the site
          and the API. It keeps drawing glasses until a modelled pourer, who judges partly by height, misses by the
          weekday’s band on average (Monday easy, Sunday brutal) without leaning all one way. Each glass here is filled to
          its true half, the pourer’s miss under it. A day that never got into its band is flagged: give it a salt in
          plan.ts’s OVERRIDES, in the site’s copy and the API’s, before its day. Pour any past day again: it’s practice,
          and keeps nothing.
        </p>
        <ul className="hb-tally">
          <li>
            <b>{built.length}</b> {built.length === 1 ? 'day' : 'days'}
            {building ? ' so far' : ''}
          </li>
          <li>
            {off.length ? (
              <>
                <span className="hb-dot pb-dot--off" aria-hidden="true" />
                <b>{off.length}</b> off band
              </>
            ) : (
              'All in band'
            )}
          </li>
          {today >= FIRST_DAY ? (
            <li>
              Today is <b>#{dayNumber(today)}</b>
            </li>
          ) : null}
        </ul>
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
              {range === 'ahead' ? 'From today' : 'From #1'}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Band">
          <button
            type="button"
            className={`chips__item${filters.offOnly ? ' chips__item--active' : ''}`}
            aria-pressed={filters.offOnly}
            onClick={() => change({ offOnly: !filters.offOnly })}
          >
            Off band only
          </button>
        </div>
        <p className="hb-count" aria-live="polite">
          {shown.length} {shown.length === 1 ? 'day' : 'days'}
        </p>
      </div>

      {months.map((key) => {
        const inMonth = shown.filter((day) => day.startsWith(key))
        return (
          <section key={key} className="tb-month" aria-labelledby={`pb-${key}`}>
            <h3 className="tb-month__name" id={`pb-${key}`}>
              {monthFormat.format(dateOf(`${key}-15`))}
              <span>
                {inMonth.length} {inMonth.length === 1 ? 'day' : 'days'}
              </span>
            </h3>
            <div className="pb-grid">
              {inMonth.map((day) => (
                <BookDay key={day} plan={plans.get(day)!} today={today} />
              ))}
            </div>
          </section>
        )
      })}
      {!shown.length && !building ? (
        <p className="adm-note">{filters.offOnly ? 'Every day here is in its band.' : 'No days to show.'}</p>
      ) : null}
      {building ? <p className="adm-note">Building the days’ glasses…</p> : null}
      <button type="button" className="panel__btn panel__btn--ghost adm-small pb-more" disabled={building} onClick={() => setAhead((n) => n + MORE)}>
        Later days
      </button>
    </div>
  )
}

/** A past day's glasses poured again: practice, which keeps nothing. Today's is the real one. */
function pourHref(day: string, today: string): string | null {
  if (day === today) return gamePlayHref(SLUG)
  return day < today ? `${gamePlayHref(SLUG)}?day=${day}` : null
}

function BookDay({ plan, today }: { plan: DayPlan; today: string }) {
  const isToday = plan.day === today
  const href = pourHref(plan.day, today)
  const [lo, hi] = plan.band
  return (
    <article className={`pb-day${isToday ? ' pb-day--today' : ''}${plan.day < today ? ' pb-day--past' : ''}${plan.inBand ? '' : ' pb-day--off'}`}>
      <div className="hb-hole__top">
        <span className="hb-hole__n">#{dayNumber(plan.day)}</span>
        <span>{dayFormat.format(dateOf(plan.day))}</span>
        {isToday ? <span className="hb-badge">Today</span> : null}
        {plan.inBand ? null : <span className="pb-flag">Off band</span>}
        <span className="hb-hole__kind">{plan.label}</span>
      </div>
      <Glasses plan={plan} />
      <dl className="tb-figs pb-figs">
        <div>
          <dt>Band</dt>
          <dd>
            {lo.toFixed(1)}–{hi.toFixed(1)}
          </dd>
        </div>
        <div>
          <dt>Avg miss</dt>
          <dd className={plan.mean < lo || plan.mean > hi ? 'pb-bad' : undefined}>{plan.mean.toFixed(1)}</dd>
        </div>
        <div>
          {/* 0 when the half glasses' misses cancel, 1 when all lean one way; over 0.25 keeps a day drawing (plan.ts). */}
          <dt>Balance</dt>
          <dd className={plan.balance > 0.25 ? 'pb-bad' : undefined}>{plan.balance.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Draws</dt>
          <dd>{plan.attempts.toLocaleString()}</dd>
        </div>
      </dl>
      {href ? (
        <a className="hb-link hb-link--go pb-go" href={href}>
          {isToday ? 'Pour it for real' : 'Pour it again'}
        </a>
      ) : null}
    </article>
  )
}

/* ---------- the day's glasses, drawn from their knots ---------- */

/** Each half glass's box, and the split's, in the drawing's own units. */
const CELL_W = 36
const CELL_H = 56
const GAP = 5
const SPLIT_W = 80
const SPLIT_GAP = 12
const CAPTION = 13
const VIEW_W = HALF_ROUNDS * CELL_W + (HALF_ROUNDS - 1) * GAP + SPLIT_GAP + SPLIT_W
const VIEW_H = CELL_H + CAPTION

type Placed = { g: Glass; cx: number; bottom: number; R: number; H: number }

/** A wall's points, from the level `to` down to the bottom (the left) or from the bottom up to it (the right). */
function wall(p: Placed, side: -1 | 1, to: number): string[] {
  const pts: string[] = []
  const at = (L: number) => `${(p.cx + side * (radiusAt(p.g, L) / 1000) * p.R).toFixed(2)},${(p.bottom - (L / LEVELS) * p.H).toFixed(2)}`
  const knots: number[] = [to]
  for (let k = K; k >= 0; k--) {
    const L = (k / K) * LEVELS
    if (L < to) knots.push(L)
  }
  if (side === 1) knots.reverse()
  for (const L of knots) pts.push(at(L))
  return pts
}

/** The glass's inside, open at the rim. */
const outline = (p: Placed) => `M${[...wall(p, -1, LEVELS), ...wall(p, 1, LEVELS)].join('L')}`
/** Its drink up to a level, as a closed shape. */
const drink = (p: Placed, level: number) => `M${[...wall(p, -1, level), ...wall(p, 1, level)].join('L')}Z`

function GlassShape({ p, level, colour, caption, title }: { p: Placed; level: number; colour: string; caption?: string; title: string }) {
  return (
    <g>
      <title>{title}</title>
      <path className="pb-glass__inside" d={`${outline(p)}Z`} />
      <path d={drink(p, level)} fill={colour} />
      <path className="pb-glass__wall" d={outline(p)} />
      {caption ? (
        <text className="pb-glass__miss" x={p.cx} y={CELL_H + CAPTION - 2}>
          {caption}
        </text>
      ) : null}
    </g>
  )
}

/** Where half is, as the eye sees it: "half is 58% of the way up". */
const halfWords = (g: Glass) => `half is ${Math.round((g.half / LEVELS) * 100)}% of the way up`

/**
 * The four half glasses, each as big as its box allows, filled to the true half in its drink; then the
 * split's two on one scale, the tall one on the day's side, shared fairly.
 */
function Glasses({ plan }: { plan: DayPlan }) {
  const bottom = CELL_H - 1
  const halves = plan.pours.map((g, round) => {
    const cx = round * (CELL_W + GAP) + CELL_W / 2
    const R = Math.min((CELL_W / 2) * 0.92, (CELL_H - 3) / g.aspect)
    return { p: { g, cx, bottom, R, H: g.aspect * R }, round }
  })
  const sp = plan.split
  const x0 = HALF_ROUNDS * (CELL_W + GAP) - GAP + SPLIT_GAP
  const between = 6
  const k = Math.min((CELL_H - 3) / Math.max(sp.A.aspect * sp.sizeA, sp.B.aspect * sp.sizeB), (SPLIT_W - between) / (2 * sp.sizeA + 2 * sp.sizeB))
  const wA = 2 * sp.sizeA * k
  const wB = 2 * sp.sizeB * k
  const left = x0 + (SPLIT_W - wA - wB - between) / 2
  const [first, second] = plan.looks.tallLeft ? (['a', 'b'] as const) : (['b', 'a'] as const)
  const widthOf = (which: 'a' | 'b') => (which === 'a' ? wA : wB)
  const cxOf = (which: 'a' | 'b') => (which === first ? left + widthOf(first) / 2 : left + widthOf(first) + between + widthOf(second) / 2)
  const a: Placed = { g: sp.A, cx: cxOf('a'), bottom, R: sp.sizeA * k, H: sp.A.aspect * sp.sizeA * k }
  const b: Placed = { g: sp.B, cx: cxOf('b'), bottom, R: sp.sizeB * k, H: sp.B.aspect * sp.sizeB * k }
  const splitColour = liquidFor(plan, HALF_ROUNDS).body
  const names = plan.pours.map((g) => g.name)
  return (
    <svg
      className="pb-glasses"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={`${names.join(', ')}, then a ${sp.A.name} and a ${sp.B.name} to share between`}
    >
      {halves.map(({ p, round }) => (
        <GlassShape
          key={round}
          p={p}
          level={p.g.half}
          colour={liquidFor(plan, round).body}
          caption={signed(plan.refs[round]!)}
          title={`${p.g.name} (${p.g.family}): ${halfWords(p.g)}; the pourer misses by ${signed(plan.refs[round]!)}`}
        />
      ))}
      <GlassShape p={a} level={sp.fairA} colour={splitColour} title={`${sp.A.name} (${sp.A.family}), the tall one, at a fair share`} />
      <GlassShape p={b} level={splitLevelB(sp, sp.fairA)} colour={splitColour} title={`${sp.B.name} (${sp.B.family}), the wide one, at a fair share`} />
      <text className="pb-glass__miss" x={x0 + SPLIT_W / 2} y={CELL_H + CAPTION - 2}>
        {signed(sp.ref)}
      </text>
    </svg>
  )
}
