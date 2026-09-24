import { useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import {
  HUNT_BUGS,
  HUNT_CAUGHT_EVENT,
  HUNT_OPEN_EVENT,
  capitalName,
  openBugHunt,
  huntDay,
  huntLog,
  huntPick,
  huntStats,
  msUntilNextBug,
  recordFind,
  subscribeHunt,
  type HuntPick,
  type HuntPose,
  type HuntStats,
} from '../lib/bugHunt'
import { THEME_EVENT } from '../lib/theme'
import { Panel, PanelHead } from './Panel'
import { openSiteMenu } from './siteNav'
import '../styles/bughunt.css'

/*
 * The daily bug hunt, on the page: the bug itself wherever today's spot is,
 * the strip on the home page with today's clue, and the panels for a find
 * and for the hunt so far. See lib/bugHunt.ts for how the day is picked.
 */

type PortraitPose = 'sit' | 'wave' | 'stand' | 'cheer'
type PortraitMood = 'smile' | 'sleepy' | 'o' | 'open'

/**
 * One of Find the Bug's wanted bugs, drawn by the game's own critter code.
 * The drawing is loaded when a portrait first needs it, so the site's first
 * page doesn't carry the game's art.
 */
export function BugPortrait({
  bugId,
  size,
  pose = 'wave',
  mood = 'smile',
  silhouette = false,
  className,
}: {
  bugId: string
  /** Drawn at this many CSS pixels; the stylesheet may show it at another size. */
  size: number
  pose?: PortraitPose
  mood?: PortraitMood
  /** A bug not caught yet: its shape in one flat colour, the canvas's CSS `color`. */
  silhouette?: boolean
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  // An outline takes its colour from the theme, so it's drawn again when that changes.
  const [themeTick, setThemeTick] = useState(0)
  useEffect(() => {
    if (!silhouette) return
    const redraw = () => setThemeTick((n) => n + 1)
    window.addEventListener(THEME_EVENT, redraw)
    return () => window.removeEventListener(THEME_EVENT, redraw)
  }, [silhouette])
  useEffect(() => {
    let live = true
    void Promise.all([import('../games/findbug/critters'), import('../games/findbug/wanted')]).then(
      ([critters, wanted]) => {
        const canvas = ref.current
        if (!live || !canvas) return
        const look = (wanted.WANTED.find((w) => w.id === bugId) ?? wanted.CLASSIC).look
        const px = Math.round(size * Math.min(3, window.devicePixelRatio || 1))
        canvas.width = px
        canvas.height = px
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, px, px)
        critters.drawPortraitFitted(ctx, look, px, { pose, mood })
        if (silhouette) {
          ctx.globalCompositeOperation = 'source-in'
          ctx.fillStyle = getComputedStyle(canvas).color
          ctx.fillRect(0, 0, px, px)
          ctx.globalCompositeOperation = 'source-over'
        }
      },
    )
    return () => {
      live = false
    }
  }, [bugId, size, pose, mood, silhouette, themeTick])
  return <canvas ref={ref} className={className} width={size} height={size} aria-hidden="true" />
}

/* ------------------------------------------------------------ the hunt --- */

/** Today's pick and your finds, kept current: a find anywhere, and midnight on the boards' clock. */
function useHunt(): { pick: HuntPick; stats: HuntStats; msLeft: number } {
  const log = useSyncExternalStore(subscribeHunt, huntLog, huntLog)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  const day = huntDay(now)
  return { pick: huntPick(day), stats: huntStats(day, log), msLeft: msUntilNextBug(now) }
}

function nextBugWords(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000))
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
}

function streakWords(stats: HuntStats): string | null {
  if (stats.foundToday) return stats.streak >= 2 ? `${stats.streak} days in a row` : 'Day one of a streak'
  if (stats.streak >= 1) return `${stats.streak}-day streak: catch today’s to keep it going`
  return null
}

/**
 * Today's bug, if today's spot is here. It sits, hangs or peeks in the
 * words around it, twitches now and then, and is caught with a tap.
 */
export function HiddenBug({
  spot,
  pose = 'perch',
  onCaught,
}: {
  spot: string
  pose?: HuntPose
  /** Called as the find is shown: the menu closes, for one. */
  onCaught?: () => void
}) {
  const { pick, stats } = useHunt()
  const [phase, setPhase] = useState<'hiding' | 'caught' | 'gone'>('hiding')
  if (pick.spot.id !== spot || phase === 'gone' || (stats.foundToday && phase === 'hiding')) return null

  const name = capitalName(pick.bug)
  const catchIt = (e: MouseEvent) => {
    // It may be sitting inside a link: the catch is the only thing a tap on it does.
    e.preventDefault()
    e.stopPropagation()
    if (phase !== 'hiding') return
    setPhase('caught')
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(
      () => {
        recordFind(pick)
        setPhase('gone')
        onCaught?.()
        window.dispatchEvent(new Event(HUNT_CAUGHT_EVENT))
      },
      still ? 0 : 450,
    )
  }
  const portraitPose: PortraitPose = phase === 'caught' ? 'cheer' : pose === 'peek' ? 'wave' : pose === 'hang' ? 'stand' : 'sit'
  return (
    <span className={`hunt-spot hunt-spot--${pose}`}>
      <button
        type="button"
        className={`hunt-bug${phase === 'caught' ? ' hunt-bug--caught' : ''}`}
        onClick={catchIt}
        aria-label={`${name} is hiding here. Catch!`}
      >
        <BugPortrait bugId={pick.bug.id} size={72} pose={portraitPose} mood={phase === 'caught' ? 'open' : pick.mood} className="hunt-bug__art" />
      </button>
    </span>
  )
}

/* ---------------------------------------------------------- the bugs --- */

function Collection({ stats, today }: { stats: HuntStats; today?: string }) {
  return (
    <ul className="hunt-grid" aria-label={`${stats.caught.size} of ${HUNT_BUGS.length} bugs caught`}>
      {HUNT_BUGS.map((bug) => {
        const got = stats.caught.has(bug.id)
        return (
          <li key={bug.id} className={`hunt-grid__cell${got ? ' hunt-grid__cell--got' : ''}${bug.id === today ? ' hunt-grid__cell--today' : ''}`}>
            <BugPortrait bugId={bug.id} size={52} silhouette={!got} className="hunt-grid__art" />
            <span className="hunt-grid__name">{got ? capitalName(bug) : '?'}</span>
          </li>
        )
      })}
    </ul>
  )
}

function Stats({ stats }: { stats: HuntStats }) {
  const streak = streakWords(stats)
  return (
    <p className="hunt-stats">
      {streak ? <span>{streak}</span> : null}
      <span>
        {stats.caught.size} of {HUNT_BUGS.length} caught
      </span>
      {stats.total > 0 ? <span>{stats.total === 1 ? '1 find' : `${stats.total} finds`}</span> : null}
    </p>
  )
}

/** The hint: the page, and a way there. */
function Hint({ pick, onGo }: { pick: HuntPick; onGo: () => void }) {
  const [shown, setShown] = useState(false)
  if (!shown) {
    return (
      <button type="button" className="hunt-btn hunt-btn--ghost" onClick={() => setShown(true)}>
        Hint
      </button>
    )
  }
  const href = pick.spot.href()
  return (
    <span className="hunt-hint">
      It’s somewhere in {pick.spot.page}.{' '}
      {href ? (
        <a href={href} onClick={onGo}>
          Go look
        </a>
      ) : (
        <button
          type="button"
          className="hunt-hint__open"
          onClick={() => {
            onGo()
            openSiteMenu()
          }}
        >
          Open the menu
        </button>
      )}
    </span>
  )
}

/** The front page's line on today's hunt: who's loose, the clue, and a hint. */
export function BugHuntStrip() {
  const { pick, stats, msLeft } = useHunt()
  const name = capitalName(pick.bug)
  return (
    <section className={`hunt-strip${stats.foundToday ? ' hunt-strip--found' : ''}`} aria-label="Daily bug hunt">
      <button type="button" className="hunt-strip__mark" onClick={openBugHunt} aria-label="Your bugs">
        <BugPortrait bugId={pick.bug.id} size={56} pose={stats.foundToday ? 'cheer' : 'wave'} mood={stats.foundToday ? 'smile' : pick.mood} className="hunt-strip__art" />
      </button>
      <div className="hunt-strip__text">
        <p className="hunt-strip__kicker">Daily bug hunt</p>
        {stats.foundToday ? (
          <>
            <p className="hunt-strip__title">You caught {pick.bug.name} today</p>
            <p className="hunt-strip__clue">The next one gets loose in {nextBugWords(msLeft)}.</p>
          </>
        ) : (
          <>
            <p className="hunt-strip__title">{name} got loose on the site</p>
            <p className="hunt-strip__clue">“{pick.spot.clue}”</p>
          </>
        )}
      </div>
      <div className="hunt-strip__side">
        {stats.foundToday ? null : <Hint pick={pick} onGo={() => undefined} />}
        <button type="button" className="hunt-btn" onClick={openBugHunt}>
          Your bugs <span className="hunt-btn__count">{stats.caught.size}/{HUNT_BUGS.length}</span>
        </button>
      </div>
    </section>
  )
}

/** The menu's row for the hunt: who's loose, or that today's is caught. */
export function BugHuntMenuRow({ onOpen }: { onOpen: () => void }) {
  const { pick, stats } = useHunt()
  return (
    <button
      type="button"
      className="site-menu__row"
      onClick={() => {
        onOpen()
        openBugHunt()
      }}
    >
      {/* A glass, not the bug: on a day it hides in the menu, there's only the one to find. */}
      <span className="site-menu__row-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="M15 15l5 5" />
        </svg>
      </span>
      <span className="site-menu__row-text">
        <span className="site-menu__row-label">Bug hunt</span>
        <span className="site-menu__row-sub">
          {stats.foundToday
            ? `Caught ${pick.bug.name} today · ${stats.caught.size} of ${HUNT_BUGS.length}`
            : `${capitalName(pick.bug)} is loose somewhere on the site`}
        </span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------ panels --- */

function HuntPanel({ onClose }: { onClose: () => void }) {
  const { pick, stats, msLeft } = useHunt()
  const titleId = useId()
  const name = capitalName(pick.bug)
  return (
    <Panel onClose={onClose} labelledBy={titleId} className="hunt-panel">
      <PanelHead
        titleId={titleId}
        kicker="Daily bug hunt"
        title={stats.foundToday ? `You caught ${pick.bug.name} today` : `${name} got loose`}
        onClose={onClose}
      />
      <div className="panel__body hunt-panel__body">
        <div className="hunt-wanted">
          <BugPortrait bugId={pick.bug.id} size={104} pose={stats.foundToday ? 'cheer' : 'wave'} mood="smile" className="hunt-wanted__art" />
          <div className="hunt-wanted__text">
            {stats.foundToday ? (
              <>
                <p className="hunt-wanted__line">
                  {name} was hiding {pick.spot.where}.
                </p>
                <p className="hunt-wanted__small">The next bug gets loose in {nextBugWords(msLeft)}.</p>
              </>
            ) : (
              <>
                <p className="hunt-wanted__line">
                  {name} is hiding somewhere on the site today. Find {pick.bug.name} and tap to catch.
                </p>
                <p className="hunt-wanted__clue">“{pick.spot.clue}”</p>
                <div className="hunt-wanted__acts">
                  <Hint pick={pick} onGo={onClose} />
                </div>
              </>
            )}
          </div>
        </div>
        <Stats stats={stats} />
        <Collection stats={stats} today={pick.bug.id} />
        <p className="hunt-panel__foot">
          A new bug gets loose every day at midnight Eastern, somewhere else. Your finds are kept on this device.
        </p>
      </div>
      <div className="panel__actions">
        <button type="button" className="panel__btn" onClick={onClose}>
          {stats.foundToday ? 'Done' : 'Go hunting'}
        </button>
      </div>
    </Panel>
  )
}

function FoundPanel({ onClose }: { onClose: () => void }) {
  const { pick, stats, msLeft } = useHunt()
  const titleId = useId()
  const name = capitalName(pick.bug)
  const first = stats.total === 1
  const all = stats.caught.size === HUNT_BUGS.length
  return (
    <Panel onClose={onClose} labelledBy={titleId} className="hunt-panel hunt-panel--found">
      <PanelHead titleId={titleId} kicker="Daily bug hunt" title={`You found ${pick.bug.name}!`} onClose={onClose} />
      <div className="panel__body hunt-panel__body">
        <div className="hunt-wanted hunt-wanted--found">
          <span className="hunt-burst" aria-hidden="true" />
          <BugPortrait bugId={pick.bug.id} size={112} pose="cheer" mood="open" className="hunt-wanted__art" />
          <div className="hunt-wanted__text">
            <p className="hunt-wanted__line">
              {name} was hiding {pick.spot.where}.
            </p>
            <p className="hunt-wanted__lesson">{pick.spot.lesson}</p>
          </div>
        </div>
        {first ? <p className="hunt-panel__note">Your first bug. There are twelve to catch.</p> : null}
        {all ? <p className="hunt-panel__note">All twelve caught. The hunt goes on: they keep getting loose.</p> : null}
        <Stats stats={stats} />
        <Collection stats={stats} today={pick.bug.id} />
        <p className="hunt-panel__foot">The next bug gets loose in {nextBugWords(msLeft)}, somewhere else.</p>
      </div>
      <div className="panel__actions">
        <button type="button" className="panel__btn" onClick={onClose}>
          Back to it
        </button>
      </div>
    </Panel>
  )
}

/** Mounted once, with the header: shows a find, and opens the hunt when asked. */
export function BugHuntHost() {
  const [open, setOpen] = useState<'hunt' | 'found' | null>(null)
  useEffect(() => {
    const onOpen = () => setOpen('hunt')
    const onCaught = () => setOpen('found')
    window.addEventListener(HUNT_OPEN_EVENT, onOpen)
    window.addEventListener(HUNT_CAUGHT_EVENT, onCaught)
    return () => {
      window.removeEventListener(HUNT_OPEN_EVENT, onOpen)
      window.removeEventListener(HUNT_CAUGHT_EVENT, onCaught)
    }
  }, [])
  if (!open) return null
  const close = () => setOpen(null)
  return open === 'found' ? <FoundPanel onClose={close} /> : <HuntPanel onClose={close} />
}
