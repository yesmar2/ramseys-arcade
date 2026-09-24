import { useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import {
  HUNT_BUGS,
  HUNT_CAUGHT_EVENT,
  HUNT_OPEN_EVENT,
  SET_SIZE,
  capitalName,
  openBugHunt,
  huntDay,
  huntPick,
  huntSnapshot,
  huntStats,
  msUntilNextBug,
  recordFind,
  subscribeHunt,
  syncHunt,
  type HuntPick,
  type HuntPose,
  type HuntServer,
  type HuntStats,
} from '../lib/bugHunt'
import { ordinal } from '../lib/profileMath'
import { getSessionToken } from '../lib/auth'
import { THEME_EVENT } from '../lib/theme'
import type { AvatarWear } from './AvatarStudio'
import { Panel, PanelHead } from './Panel'
import { HuntSetJar } from './TrophyArt'
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

/** Today's pick and your finds, kept current: a find anywhere, what the API says, and midnight on the boards' clock. */
function useHunt(): { pick: HuntPick; stats: HuntStats; server: HuntServer | null; msLeft: number } {
  const snap = useSyncExternalStore(subscribeHunt, huntSnapshot, huntSnapshot)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    void syncHunt()
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  const day = huntDay(now)
  const server = snap.server.day === day ? snap.server : null
  // The set is the month's, so the API's word on it holds past midnight until it next says.
  return { pick: huntPick(day), stats: huntStats(day, snap.log, snap.server), server, msLeft: msUntilNextBug(now) }
}

/** How many have caught today's bug, in a line: "Nobody has caught Buzz yet today." */
function countWords(server: HuntServer | null, name: string, stats: HuntStats): string | null {
  if (!server || server.count == null) return null
  if (stats.foundToday && server.place != null) {
    return server.place === 1 ? `You were the first to catch ${name} today.` : `You were ${ordinal(server.place)} to catch ${name} today.`
  }
  const n = server.count
  if (n === 0) return `Nobody has caught ${name} yet today.`
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'player has' : 'players have'} caught ${name} so far today.`
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

/**
 * The month's set: a bug caught in colour, one still loose as its outline.
 * Signed in, a bug this device caught that the API doesn't count, because it
 * was caught signed out, keeps its colour in a dashed ring.
 */
function Collection({ stats, today, note = true }: { stats: HuntStats; today?: string; note?: boolean }) {
  const { set } = stats
  const titleId = useId()
  const signedIn = Boolean(getSessionToken())
  const uncounted = HUNT_BUGS.some((b) => set.caught.has(b.id) && !set.have.has(b.id))
  return (
    <section className="hunt-set" aria-labelledby={titleId}>
      <div className="hunt-set__head">
        <h3 className="hunt-set__title" id={titleId}>
          {set.month}’s set
        </h3>
        <span className="hunt-set__count">
          {set.have.size} of {SET_SIZE}
        </span>
      </div>
      <p className="hunt-set__when">
        {set.early ? `The hunt’s first set, from Sept 24 to ${set.ends}.` : `Until ${set.ends}. A new set starts on the 1st.`}
      </p>
      <ul className="hunt-grid">
        {HUNT_BUGS.map((bug) => {
          const got = set.have.has(bug.id)
          const kept = !got && set.caught.has(bug.id)
          const name = capitalName(bug)
          const cls = `hunt-grid__cell${got ? ' hunt-grid__cell--got' : ''}${kept ? ' hunt-grid__cell--kept' : ''}${bug.id === today ? ' hunt-grid__cell--today' : ''}`
          return (
            <li key={bug.id} className={cls} title={kept ? `${name} was caught signed out, so it doesn’t count toward the set` : undefined}>
              <BugPortrait bugId={bug.id} size={52} silhouette={!got && !kept} className="hunt-grid__art" />
              <span className="hunt-grid__name">{got || kept ? name : '?'}</span>
              <span className="visually-hidden">{got ? ', caught' : kept ? ', caught signed out, doesn’t count' : 'Not caught yet'}</span>
            </li>
          )
        })}
      </ul>
      {!note ? null : !signedIn ? (
        <p className="hunt-set__note">Sign in to put a full set on your shelf: only finds made signed in count toward it.</p>
      ) : uncounted ? (
        <p className="hunt-set__note">
          Bugs in a dashed ring were caught signed out, so they don’t count. Every bug comes round two or three times
          a month.
        </p>
      ) : null}
    </section>
  )
}

function Stats({ stats }: { stats: HuntStats }) {
  const streak = streakWords(stats)
  if (!streak && stats.total === 0) return null
  return (
    <p className="hunt-stats">
      {streak ? <span>{streak}</span> : null}
      {stats.total > 0 ? <span>{stats.total === 1 ? '1 find all time' : `${stats.total} finds all time`}</span> : null}
    </p>
  )
}

/** The hint: the page it's on. Finding the way there is part of the hunt. */
function Hint({ pick }: { pick: HuntPick }) {
  const [shown, setShown] = useState(false)
  if (!shown) {
    return (
      <button type="button" className="hunt-btn hunt-btn--ghost" onClick={() => setShown(true)}>
        Hint
      </button>
    )
  }
  return <span className="hunt-hint">It’s somewhere {pick.spot.page}.</span>
}

/** The front page's line on today's hunt: who's loose, the clue, and a hint. */
export function BugHuntStrip() {
  const { pick, stats, server, msLeft } = useHunt()
  const name = capitalName(pick.bug)
  const count = countWords(server, pick.bug.name, stats)
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
            <p className="hunt-strip__clue">
              {count ? `${count} ` : ''}The next one gets loose in {nextBugWords(msLeft)}.
            </p>
          </>
        ) : (
          <>
            <p className="hunt-strip__title">{name} got loose on the site</p>
            <p className="hunt-strip__clue">“{pick.spot.clue}”</p>
            {count ? <p className="hunt-strip__count">{count}</p> : null}
          </>
        )}
      </div>
      <div className="hunt-strip__side">
        {stats.foundToday ? null : <Hint pick={pick} />}
        <button type="button" className="hunt-btn" onClick={openBugHunt}>
          Your bugs{' '}
          <span className="hunt-btn__count">
            {stats.set.have.size}/{SET_SIZE}
          </span>
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
            ? `Caught ${pick.bug.name} today · ${stats.set.have.size} of ${SET_SIZE} for ${stats.set.month}`
            : `${capitalName(pick.bug)} is loose somewhere on the site`}
        </span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------ panels --- */

function HuntPanel({ onClose }: { onClose: () => void }) {
  const { pick, stats, server, msLeft } = useHunt()
  const count = countWords(server, pick.bug.name, stats)
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
                {count ? <p className="hunt-wanted__small">{count}</p> : null}
                <p className="hunt-wanted__small">The next bug gets loose in {nextBugWords(msLeft)}.</p>
              </>
            ) : (
              <>
                <p className="hunt-wanted__line">
                  {name} is hiding somewhere on the site today. Find {pick.bug.name} and tap to catch.
                </p>
                <p className="hunt-wanted__clue">“{pick.spot.clue}”</p>
                {count ? <p className="hunt-wanted__small">{count}</p> : null}
                <div className="hunt-wanted__acts">
                  <Hint pick={pick} />
                </div>
              </>
            )}
          </div>
        </div>
        <Stats stats={stats} />
        <Collection stats={stats} today={pick.bug.id} />
        <p className="hunt-panel__foot">
          A new bug gets loose every day at midnight Eastern, somewhere else.{' '}
          {getSessionToken()
            ? 'Catch all twelve in a month and the set goes on your shelf.'
            : 'Sign in and your finds follow you to any device.'}
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

/** The find that completed a set: the trophy, and the pin with the first. */
function FullSet({ stats, server, onClose, onWear }: { stats: HuntStats; server: HuntServer } & FoundProps) {
  const done = server.completed
  if (!done) return null
  const month = stats.set.month
  return (
    <div className="hunt-full">
      <span className="hunt-full__jar trophy-tone--hunt" aria-hidden="true">
        <HuntSetJar size="md" />
      </span>
      <div className="hunt-full__text">
        <p className="hunt-full__line">
          That’s all twelve!{' '}
          {done.shelved ? `${month}’s full set is on your shelf.` : `Pick a tag and ${month}’s full set goes on your shelf.`}
        </p>
        {done.pin ? <p className="hunt-full__small">It’s your first, so it comes with a pin: the bug net.</p> : null}
        {done.pin && onWear ? (
          <button
            type="button"
            className="hunt-btn hunt-full__wear"
            onClick={() => {
              onClose()
              onWear({ pin: 'bugnet' })
            }}
          >
            Wear the pin
          </button>
        ) : null}
      </div>
    </div>
  )
}

type FoundProps = { onClose: () => void; onWear?: (wear: AvatarWear) => void }

function FoundPanel({ onClose, onWear }: FoundProps) {
  const { pick, stats, server, msLeft } = useHunt()
  const signedIn = Boolean(getSessionToken())
  const titleId = useId()
  const name = capitalName(pick.bug)
  // Signed in, the API says which find completed a set; signed out, this device does.
  const done = signedIn && server?.completed?.day === pick.day && server.completed.key === stats.set.key ? server : null
  const doneHere = !signedIn && stats.completedHere
  const first = stats.total === 1 && !done && !doneHere
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
        {signedIn && server?.place != null ? (
          <p className="hunt-panel__place">
            {server.place === 1 ? 'You’re the first to find ' : `You’re the ${ordinal(server.place)} to find `}
            {pick.bug.name} today{server.count && server.count > server.place ? `, out of ${server.count} so far` : ''}.
          </p>
        ) : !signedIn ? (
          <p className="hunt-panel__place">
            {server?.count
              ? `${server.count} signed-in ${server.count === 1 ? 'player has' : 'players have'} found ${pick.bug.name} today. `
              : ''}
            Sign in and your finds count too, and follow you to any device.
          </p>
        ) : null}
        {done ? <FullSet stats={stats} server={done} onClose={onClose} onWear={onWear} /> : null}
        {doneHere ? (
          <div className="hunt-full">
            <span className="hunt-full__jar trophy-tone--hunt" aria-hidden="true">
              <HuntSetJar size="md" />
            </span>
            <div className="hunt-full__text">
              <p className="hunt-full__line">That’s all twelve of {stats.set.month}’s bugs on this device!</p>
              <p className="hunt-full__small">
                A set goes on your shelf when it’s caught signed in. Sign in, and your next full set is a trophy.
              </p>
            </div>
          </div>
        ) : null}
        {first ? <p className="hunt-panel__note">Your first bug. There are twelve in {stats.set.month}’s set.</p> : null}
        <Stats stats={stats} />
        {/* A set just caught in full on this device has said its piece about signing in. */}
        <Collection stats={stats} today={pick.bug.id} note={!doneHere} />
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
export function BugHuntHost({ onWear }: { onWear?: (wear: AvatarWear) => void }) {
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
  return open === 'found' ? <FoundPanel onClose={close} onWear={onWear} /> : <HuntPanel onClose={close} />
}
