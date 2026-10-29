import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { useActiveChallenge } from '../lib/challenges'
import { canChase, clearChase, setChase, useChase, type Chase } from '../lib/chase'
import { chaseReading, type ChaseLap } from '../lib/chaseReading'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { getLeaderboard, type LeaderboardEntry } from '../lib/leaderboard'
import {
  ASTEROIDS_HIGHEST_COMBO_ID,
  CROSSWALK_LONGEST_CHAIN_ID,
  CROSSWALK_MOST_COINS_ID,
  CROSSWALK_NEAR_MISSES_ID,
  fetchGameRecords,
  formatRecordMs,
  FRENZY_CHAIN_ID,
  FRENZY_FISH_ID,
  FRENZY_FRENZIES_ID,
  FRENZY_LEVIATHAN_ID,
  LONGEST_CHAIN_ID,
  parseAsteroidsWaveFromRecordId,
  parseCrosswalkRowFromRecordId,
  parseSnakeLengthFromRecordId,
  SNAKE_LONGEST_ID,
  type RecordSummary,
} from '../lib/records'
import { Panel, PanelHead } from './Panel'

/*
 * Chasing a record (lib/chase.ts): the sheet that picks one, the box on the
 * start card that names it, and the pace bar during the run.
 */

/** Frenzy's growth from Fry to Leviathan, the bar's units (games/frenzy GROW_NEED, summed). */
const FRENZY_GROWTH = 125

/**
 * What each game offers to chase. A race is a "fastest to" book: `from` is where its clock's count starts
 * (Snake's length when it sets off, games/snake START_SEGMENTS) and `step` names one step of it for the pace
 * words. The numbers to beat are the game's board and the books named in `counts`.
 */
const SETUP: Record<string, { from: number; step: string | null; race: (r: RecordSummary) => Partial<Chase> | null; counts: string[] }> = {
  snake: {
    from: 3,
    step: 'a bite',
    race: (r) => {
      const goal = parseSnakeLengthFromRecordId(r.id)
      return goal == null ? null : { short: `Length ${goal}`, goal }
    },
    counts: [SNAKE_LONGEST_ID, LONGEST_CHAIN_ID],
  },
  crosswalk: {
    from: 0,
    step: 'a row',
    race: (r) => {
      const goal = parseCrosswalkRowFromRecordId(r.id)
      return goal == null ? null : { short: `Row ${goal}`, goal }
    },
    counts: [CROSSWALK_MOST_COINS_ID, CROSSWALK_LONGEST_CHAIN_ID, CROSSWALK_NEAR_MISSES_ID],
  },
  // A wave's book is its clear, timed from the wave's start: a lap, not a race from the run's start.
  asteroids: {
    from: 0,
    step: null,
    race: (r) => {
      const goal = parseAsteroidsWaveFromRecordId(r.id)
      return goal == null ? null : { short: `Wave ${goal}`, goal, kind: 'lap' }
    },
    counts: [ASTEROIDS_HIGHEST_COMBO_ID],
  },
  frenzy: {
    from: 0,
    step: null,
    race: (r) => (r.id === FRENZY_LEVIATHAN_ID ? { short: 'Leviathan', goal: FRENZY_GROWTH } : null),
    counts: [FRENZY_FISH_ID, FRENZY_CHAIN_ID, FRENZY_FRENZIES_ID],
  },
}

/** The names Snake's books had in the sheet first; every other book goes by its own, less "in a run". */
const COUNT_NAMES: Record<string, string> = { [`snake:${SNAKE_LONGEST_ID}`]: 'Longest snake' }

function raceFrom(slug: string): number {
  return SETUP[slug]?.from ?? 0
}

/** "2.27s a bite": the record's even pace, which the bar measures a run against. */
function paceWords(slug: string, chase: Chase): string | null {
  const step = SETUP[slug]?.step
  if (!step || chase.kind === 'lap' || chase.unit !== 'ms' || chase.target == null || chase.goal == null) return null
  const steps = chase.goal - raceFrom(slug)
  if (steps <= 0) return null
  return `${(chase.target / steps / 1000).toFixed(2)}s ${step}`
}

/** A game's records worth chasing, in the sheet's two groups. */
function chaseOptions(
  slug: string,
  records: RecordSummary[],
  top: LeaderboardEntry | null,
): { races: Chase[]; counts: Chase[] } {
  const setup = SETUP[slug]
  if (!setup) return { races: [], counts: [] }
  const races: Chase[] = []
  for (const r of records) {
    const race = setup.race(r)
    if (race) races.push({ game: slug, recordId: r.id, short: r.label, unit: 'ms', target: r.top?.score ?? null, name: r.top?.name, ...race })
  }
  races.sort((a, b) => (a.goal ?? 0) - (b.goal ?? 0))
  const counts: Chase[] = []
  if (top) counts.push({ game: slug, recordId: 'score', short: 'Best score', unit: 'count', target: top.score, name: top.name })
  for (const id of setup.counts) {
    const r = records.find((x) => x.id === id)
    if (!r?.top) continue
    const short = COUNT_NAMES[`${slug}:${id}`] ?? r.label.replace(/ in a run$/, '')
    counts.push({ game: slug, recordId: id, short, unit: 'count', target: r.top.score, name: r.top.name })
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
 * The pace bar through the run (A of the canvas). A race puts your mark beside
 * the record's even pace and says how far ahead or behind you were at your
 * last step; a lap counts the record's time down through its wave; a number to
 * beat fills toward it.
 *
 * `value` is the run's figure in the record's terms (a length, a row, a score);
 * `elapsedMs` the record's own clock, null till the run sets off; `runKey`
 * changes with each new run. Snake shows it whole under its board; the other
 * games, `compact`, on one line under the score, where a challenge's chip goes.
 */
export function ChaseBar({
  slug,
  value,
  elapsedMs,
  runKey,
  lap,
  compact = false,
}: {
  slug: string
  value: number
  elapsedMs: number | null
  runKey: number
  lap?: ChaseLap
  compact?: boolean
}) {
  const chase = useChase(slug)
  const challenged = useActiveChallenge(slug) != null
  const from = raceFrom(slug)
  // The last step and when it came, and when the goal was reached: the run's splits.
  const run = useRef(runKey)
  const last = useRef<{ value: number; at: number } | null>(null)
  const reached = useRef<number | null>(null)
  if (run.current !== runKey || elapsedMs == null) {
    run.current = runKey
    last.current = null
    reached.current = null
  }
  if (elapsedMs != null && value !== (last.current?.value ?? from)) {
    last.current = { value, at: elapsedMs }
    if (chase?.goal != null && value >= chase.goal && reached.current == null) reached.current = elapsedMs
  }
  if (!chase) return null
  const { head, brief, status, tone, you, pace, end } = chaseReading(chase, {
    from,
    value,
    elapsedMs,
    last: last.current,
    reached: reached.current,
    paceWords: paceWords(slug, chase),
    lap,
  })

  return (
    <div
      className={`chase-bar chase-bar--${tone}${compact ? ' chase-bar--compact' : ''}${challenged ? ' chase-bar--low' : ''}`}
      style={{ '--chase-you': you, '--chase-pace': pace ?? 0 } as CSSProperties}
      aria-hidden="true"
    >
      <span className="chase-bar__top">
        <span className="chase-bar__head">{compact ? brief : head}</span>
        <b className="chase-bar__status">{status}</b>
      </span>
      <span className="chase-bar__track">
        <span className="chase-bar__fill" />
        {pace != null ? <span className="chase-bar__pace" /> : null}
        <span className="chase-bar__you" />
        {compact || !end ? null : <span className="chase-bar__end">{end}</span>}
      </span>
    </div>
  )
}
