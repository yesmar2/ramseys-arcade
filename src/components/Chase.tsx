import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { useActiveChallenge } from '../lib/challenges'
import { canChase, clearChase, setChase, useChase, type Chase } from '../lib/chase'
import { chaseReading } from '../lib/chaseReading'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { getLeaderboard, type LeaderboardEntry } from '../lib/leaderboard'
import {
  fetchGameRecords,
  formatRecordMs,
  LONGEST_CHAIN_ID,
  parseSnakeLengthFromRecordId,
  SNAKE_LONGEST_ID,
  type RecordSummary,
} from '../lib/records'
import { Panel, PanelHead } from './Panel'

/*
 * Chasing a record (lib/chase.ts): the sheet that picks one, the box on the
 * start card that names it, and the pace bar under the score during the run.
 */

/** Where a race's clock starts counting from: Snake's length when it sets off (games/snake START_SEGMENTS). */
const RACE_FROM: Record<string, number> = { snake: 3 }

function raceFrom(slug: string): number {
  return RACE_FROM[slug] ?? 0
}

/** "2.27s a bite": the record's even pace, which the bar measures a run against. */
function paceWords(slug: string, chase: Chase): string | null {
  if (chase.unit !== 'ms' || chase.target == null || chase.goal == null) return null
  const steps = chase.goal - raceFrom(slug)
  if (steps <= 0) return null
  return `${(chase.target / steps / 1000).toFixed(2)}s a bite`
}

/** A game's records worth chasing, in the sheet's two groups. */
function chaseOptions(
  slug: string,
  records: RecordSummary[],
  top: LeaderboardEntry | null,
): { races: Chase[]; counts: Chase[] } {
  const races: Chase[] = []
  const counts: Chase[] = []
  if (slug === 'snake') {
    for (const r of records) {
      const goal = parseSnakeLengthFromRecordId(r.id)
      if (goal == null) continue
      races.push({ game: slug, recordId: r.id, short: `Length ${goal}`, unit: 'ms', target: r.top?.score ?? null, goal, name: r.top?.name })
    }
    races.sort((a, b) => (a.goal ?? 0) - (b.goal ?? 0))
    if (top) counts.push({ game: slug, recordId: 'score', short: 'Best score', unit: 'count', target: top.score, name: top.name })
    const named: [string, string][] = [
      [SNAKE_LONGEST_ID, 'Longest snake'],
      [LONGEST_CHAIN_ID, 'Longest chain'],
    ]
    for (const [id, short] of named) {
      const r = records.find((x) => x.id === id)
      if (r?.top) counts.push({ game: slug, recordId: id, short, unit: 'count', target: r.top.score, name: r.top.name })
    }
  }
  return { races, counts }
}

/** Pick a record to chase. With `href`, a pick goes on to the game (from its page); without, it stays put (the start card). */
export function ChaseSheet({ slug, href, onClose }: { slug: string; href?: string; onClose: () => void }) {
  const titleId = useId()
  const current = useChase(slug)
  const [options, setOptions] = useState<{ races: Chase[]; counts: Chase[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let live = true
    setFailed(false)
    Promise.all([fetchGameRecords(slug, 'all'), getLeaderboard(slug, 'all').catch(() => ({ entries: [] as LeaderboardEntry[] }))])
      .then(([{ records }, board]) => {
        if (live) setOptions(chaseOptions(slug, records, board.entries[0] ?? null))
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [slug, tries])

  const pick = (chase: Chase) => {
    setChase(chase)
    onClose()
  }

  const row = (chase: Chase) => {
    const on = current?.recordId === chase.recordId
    const figure = chase.target == null ? null : chase.unit === 'ms' ? formatRecordMs(chase.target) : chase.target.toLocaleString()
    const sub =
      chase.target == null
        ? 'Nobody yet. Get there to set it.'
        : [chase.name, paceWords(slug, chase)].filter(Boolean).join(' · ')
    const body = (
      <>
        <span className="chase-sheet__what">
          <b>{chase.short}</b>
          <span>{sub}</span>
        </span>
        {figure ? <strong className="chase-sheet__figure">{figure}</strong> : null}
      </>
    )
    const className = `chase-sheet__row${on ? ' chase-sheet__row--on' : ''}${chase.target == null ? ' chase-sheet__row--open' : ''}`
    return href ? (
      <a key={chase.recordId} className={className} href={href} aria-current={on ? 'true' : undefined} onClick={() => pick(chase)}>
        {body}
      </a>
    ) : (
      <button key={chase.recordId} type="button" className={className} aria-pressed={on} onClick={() => pick(chase)}>
        {body}
      </button>
    )
  }

  return (
    <Panel labelledBy={titleId} onClose={onClose} style={gameAccentStyle(slug)} className="chase-sheet">
      <PanelHead titleId={titleId} title="Chase a record" kicker={getGame(slug)?.name} onClose={onClose} />
      <div className="panel__body panel__body--last chase-sheet__body">
        <p className="chase-sheet__lede">Pick one. It stays on screen the whole run.</p>
        {failed ? (
          <p className="chase-sheet__note">
            Couldn’t load the records.{' '}
            <button type="button" className="chase-sheet__retry" onClick={() => setTries((n) => n + 1)}>
              Try again
            </button>
          </p>
        ) : !options ? (
          <p className="chase-sheet__note">Loading the records…</p>
        ) : (
          <>
            {options.races.length ? (
              <section className="chase-sheet__group" aria-label="Race the clock">
                <span className="chase-sheet__cap" aria-hidden="true">
                  Race the clock
                </span>
                {options.races.map(row)}
              </section>
            ) : null}
            {options.counts.length ? (
              <section className="chase-sheet__group" aria-label="Beat a number">
                <span className="chase-sheet__cap" aria-hidden="true">
                  Beat a number
                </span>
                {options.counts.map(row)}
              </section>
            ) : null}
            {current ? (
              <button
                type="button"
                className="chase-sheet__off"
                onClick={() => {
                  clearChase(slug)
                  onClose()
                }}
              >
                Stop chasing
              </button>
            ) : null}
          </>
        )}
      </div>
    </Panel>
  )
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 21V4m0 0h11l-2 4 2 4H5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Chase a record, beside Play on a game's page. */
export function ChaseButton({ slug, href, className }: { slug: string; href: string; className?: string }) {
  const [open, setOpen] = useState(false)
  if (!canChase(slug)) return null
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <FlagIcon />
        Chase a record
      </button>
      {open ? <ChaseSheet slug={slug} href={href} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/** The record being chased, on the start card: a way to change it, and one to play without it. */
export function ChaseTarget({ slug }: { slug: string }) {
  const chase = useChase(slug)
  const [open, setOpen] = useState(false)
  if (!chase) return null
  const own = (e: { stopPropagation: () => void }) => e.stopPropagation()
  const what =
    chase.unit === 'ms'
      ? chase.target == null
        ? `${chase.short}: nobody yet`
        : `${chase.short} in ${formatRecordMs(chase.target)}`
      : `${chase.short}: ${chase.target?.toLocaleString() ?? '–'}`
  const sub = chase.target == null ? 'Get there first to set it' : [chase.name, paceWords(slug, chase)].filter(Boolean).join(' · ')
  return (
    <div className="chase-target">
      <span className="chase-target__flag">
        <FlagIcon />
      </span>
      <span className="chase-target__words">
        <span className="chase-target__cap">Chasing</span>
        <b>{what}</b>
        {sub ? <span className="chase-target__sub">{sub}</span> : null}
        <button type="button" className="chase-target__change" onPointerDown={own} onClick={(e) => (own(e), setOpen(true))}>
          Change
        </button>
      </span>
      <button
        type="button"
        className="chase-target__x"
        aria-label="Stop chasing"
        title="Stop chasing"
        onPointerDown={own}
        onClick={(e) => (own(e), clearChase(slug))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
      {open ? <ChaseSheet slug={slug} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

/**
 * The pace bar under the score, through the run (A of the canvas). A race
 * puts your mark beside the record's even pace and says how far ahead or
 * behind you were at your last bite; a number to beat fills toward it.
 *
 * `value` is the run's figure in the record's terms (a length, a score, a
 * chain); `elapsedMs` is the record's own clock, null till the run sets off.
 */
export function ChaseBar({ slug, value, elapsedMs }: { slug: string; value: number; elapsedMs: number | null }) {
  const chase = useChase(slug)
  const challenged = useActiveChallenge(slug) != null
  const from = raceFrom(slug)
  // The last step forward and when it came, and when the goal was reached: the run's splits.
  const last = useRef<{ value: number; at: number } | null>(null)
  const reached = useRef<number | null>(null)
  if (elapsedMs == null || value < (last.current?.value ?? from)) {
    last.current = null
    reached.current = null
  } else if (value > (last.current?.value ?? from)) {
    last.current = { value, at: elapsedMs }
    if (chase?.goal != null && value >= chase.goal && reached.current == null) reached.current = elapsedMs
  }
  if (!chase) return null
  const { head, status, tone, you, pace, end } = chaseReading(chase, {
    from,
    value,
    elapsedMs,
    last: last.current,
    reached: reached.current,
    paceWords: paceWords(slug, chase),
  })

  return (
    <div
      className={`chase-bar chase-bar--${tone}${challenged ? ' chase-bar--low' : ''}`}
      style={{ '--chase-you': you, '--chase-pace': pace ?? 0 } as CSSProperties}
      aria-hidden="true"
    >
      <span className="chase-bar__top">
        <span className="chase-bar__head">{head}</span>
        <b className="chase-bar__status">{status}</b>
      </span>
      <span className="chase-bar__track">
        <span className="chase-bar__fill" />
        {pace != null ? <span className="chase-bar__pace" /> : null}
        <span className="chase-bar__you" />
        <span className="chase-bar__end">{end}</span>
      </span>
    </div>
  )
}
