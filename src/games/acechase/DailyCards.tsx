import { useEffect, useState, type ReactNode } from 'react'
import { GoogleSignInButton } from '../../components/GoogleSignInButton'
import { copyText } from '../../components/ShareBoardButton'
import { useAuth } from '../../hooks/useAuth'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { PLACE_NAME, msUntilNextHole, shareText, type DailyServer, type DayProgress, type TodaysHole } from '../../lib/dailyHole'

/*
 * Today's Hole's two cards, in the panel kit like every game's start and score cards: the one it opens
 * on, and the one a bullseye brings up. Their buttons are the only way on; a tap elsewhere on them does
 * nothing, since there's more than one thing to do.
 */

const SLUG = 'acechase'

function untilNext(ms: number): string {
  const mins = Math.max(1, Math.floor(ms / 60_000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`
}

/** When the next hole comes, kept fresh. */
function NextHole() {
  const [ms, setMs] = useState(() => msUntilNextHole())
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilNextHole()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return <p className="game-card__hint acechase-daily__next">Next hole in {untilNext(ms)}</p>
}

const ORDINAL = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

const END_NAME: Record<string, string> = { b: 'bullseye', i: 'inner ring', o: 'outer ring', x: 'off the rings', l: 'lost' }

/** The day's tries as marks, one a try: where each ended. */
function Pattern({ pattern }: { pattern: string }) {
  const marks = [...pattern]
  const shown = marks.length > 30 ? [...marks.slice(0, 29), '…', marks[marks.length - 1]!] : marks
  return (
    <div className="acechase-daily__pattern" aria-label={marks.map((c) => END_NAME[c] ?? '').join(', ')}>
      {shown.map((c, i) => (
        <span key={i} className={`acechase-daily__mark acechase-daily__mark--${c === '…' ? 'more' : c}`} aria-hidden="true">
          {c === '…' ? '…' : null}
        </span>
      ))}
    </div>
  )
}

/** How everyone did today: how many took one try, two, and so on, yours marked. */
function Spread({ spread, mine }: { spread: number[]; mine: number | null }) {
  const most = Math.max(1, ...spread)
  const at = mine == null ? -1 : Math.min(spread.length, mine) - 1
  return (
    <div className="acechase-daily__spread" role="img" aria-label={spread.map((n, i) => `${n} in ${i + 1 === spread.length ? `${i + 1} or more` : i + 1}`).join(', ')}>
      {spread.map((n, i) => (
        <div key={i} className={`acechase-daily__bar${i === at ? ' is-mine' : ''}`}>
          <span className="acechase-daily__track">
            <span className="acechase-daily__fill" style={{ height: `${Math.max(5, (n / most) * 100)}%` }} />
          </span>
          <span className="acechase-daily__tries">{i + 1 === spread.length ? `${i + 1}+` : i + 1}</span>
        </div>
      ))}
    </div>
  )
}

/** Send the day on: the phone's own share sheet, or copied to paste anywhere. */
export function ShareButton({
  hole,
  tries,
  pattern,
  className = 'panel__btn',
}: {
  hole: TodaysHole
  tries: number
  pattern: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const share = () => {
    const url = `${window.location.origin}/games/acechase/daily`
    const text = `${shareText(hole, tries, pattern)}\n${url}`
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (touch && typeof navigator.share === 'function') {
      navigator.share({ text }).catch(() => {})
      return
    }
    const done = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => copyText(text) && done())
    else if (copyText(text)) done()
  }
  return (
    <button type="button" className={className} onClick={share}>
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}

function Card({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="game-card acechase-daily"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

/** Where today stands for everyone: how many got it, in how many on average. */
function Everyone({ server }: { server: DailyServer | null }) {
  if (!server) return null
  return (
    <div className="game-pause-meta__row">
      <span>Everyone today</span>
      <strong>
        {server.solved === 0 ? 'Nobody yet' : `${server.solved} got it`}
        {server.average != null && server.solved > 0 ? ` · ${server.average} tries on average` : ''}
      </strong>
    </div>
  )
}

/** The card Today's Hole opens on. */
export function DailyStartCard({
  hole,
  progress,
  server,
  onStart,
  onPractice,
}: {
  hole: TodaysHole
  progress: DayProgress | null
  server: DailyServer | null
  onStart: () => void
  onPractice: () => void
}) {
  const solved = progress?.solved
  const tries = progress?.tries ?? 0
  return (
    <Card label={`Today's Hole #${hole.n}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">Today&rsquo;s Hole #{hole.n}</span>
        <h2 className="game-card__title game-card__title--big">{hole.def.name}</h2>
        <p className="game-card__blurb">
          On {PLACE_NAME[hole.pick.style]}. {hole.def.note}
        </p>
      </div>
      <p className="acechase-daily__rules">
        Everyone plays this hole today. Every try counts, even if you leave and come back; your first bullseye is your result.
      </p>
      <div className="game-pause-meta">
        <div className="game-pause-meta__row">
          <span>You</span>
          <strong>{solved ? `Bullseye in ${solved.tries}` : tries > 0 ? `${tries} ${tries === 1 ? 'try' : 'tries'} so far` : 'Not played yet'}</strong>
        </div>
        <Everyone server={server} />
      </div>
      {solved ? <Pattern pattern={solved.pattern} /> : null}
      <div className="game-card__actions">
        {solved ? (
          <>
            <ShareButton hole={hole} tries={solved.tries} pattern={solved.pattern} />
            <button type="button" className="panel__btn panel__btn--ghost" onClick={onPractice}>
              Play it again · doesn&rsquo;t count
            </button>
          </>
        ) : (
          <button type="button" className="panel__btn" onClick={onStart}>
            {tries > 0 ? 'Carry on' : 'Start'}
          </button>
        )}
      </div>
      <NextHole />
    </Card>
  )
}

/** The card a bullseye brings up: the day's result, where it came in, and passing it on. */
export function DailyResultCard({
  hole,
  progress,
  server,
  practice,
  onPractice,
  onLeave,
}: {
  hole: TodaysHole
  progress: DayProgress | null
  server: DailyServer | null
  practice: boolean
  onPractice: () => void
  onLeave: () => void
}) {
  const { signedIn } = useAuth()
  const solved = progress?.solved
  if (!solved) return null
  const you = server?.you
  const title = practice ? 'That one didn’t count' : solved.tries === 1 ? 'First try!' : `Bullseye in ${solved.tries}`
  return (
    <Card label={`Today's Hole #${hole.n}: ${title}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">Today&rsquo;s Hole #{hole.n}</span>
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        <p className="game-card__blurb">
          {practice ? `Your result today stands: bullseye in ${solved.tries}.` : `${hole.def.name}, on ${PLACE_NAME[hole.pick.style]}.`}
        </p>
      </div>
      <Pattern pattern={solved.pattern} />
      <div className="game-pause-meta">
        {you?.place != null && server ? (
          <div className="game-pause-meta__row">
            <span>Today</span>
            <strong>
              {ORDINAL(you.place)} of {server.solved}
            </strong>
          </div>
        ) : (
          <Everyone server={server} />
        )}
        {you && you.streak > 1 ? (
          <div className="game-pause-meta__row">
            <span>Streak</span>
            <strong>{you.streak} days in a row</strong>
          </div>
        ) : null}
      </div>
      {server && server.solved > 0 ? <Spread spread={server.spread} mine={solved.tries} /> : null}
      {!signedIn ? (
        <div className="acechase-daily__signin">
          <p>Sign in to have today&rsquo;s result counted, and to keep a streak going.</p>
          <GoogleSignInButton />
        </div>
      ) : null}
      <div className="game-card__actions">
        <ShareButton hole={hole} tries={solved.tries} pattern={solved.pattern} />
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onPractice}>
          Play it again · doesn&rsquo;t count
        </button>
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onLeave}>
          Back to Ace Chase
        </button>
      </div>
      <NextHole />
    </Card>
  )
}
