import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { useDeliberatePress } from '../hooks/useDeliberatePress'
import { PLAYER_NAME_MAX } from '../lib/leaderboard'
import type {
  ReportIcon,
  ReportLine,
  ReportRace,
  ReportRibbon,
  ReportTier,
  ReportTone,
} from '../lib/runReport'
import { GoogleSignInButton } from './GoogleSignInButton'
import { Panel } from './Panel'
import { PlayerAvatar } from './PlayerAvatar'

/*
 * The run report: the one card a run ends on. The score under a kicker (the
 * run's own words, or a ribbon for what it won), then what it did in lines
 * (your best, the board, the standings, the record books), the race when it took
 * first, whatever the moment asks (sign in, a tag), and Play again, which
 * never moves. It lights up as much as the run earned: quiet, lit in the
 * game's colour, or big in gold with confetti, once.
 */

const ICON_PATHS: Record<ReportIcon, string> = {
  up: 'M12 19V5M5 12l7-7 7 7',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M9 7h6',
  board: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  sum: 'M18 4H6l6 8-6 8h12',
  flag: 'M4 21V4M4 4h13l-2 4 2 4H4',
}

export function ReportIconSvg({ icon }: { icon: ReportIcon }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[icon]} />
    </svg>
  )
}

export type ReportAction = {
  label: string
  /** What it says where the full words don't fit: a phone's row beside Play again. */
  shortLabel?: string
  icon?: ReportIcon
  onClick?: () => void
  /** A link out instead of a button. */
  href?: string
  disabled?: boolean
  /** Waiting on something (the save): says so in its label and ignores presses, but keeps focus. */
  busy?: boolean
  buttonRef?: RefObject<HTMLButtonElement | null>
}

function ActionLabel({ action }: { action: ReportAction }) {
  return (
    <>
      {action.icon ? <ReportIconSvg icon={action.icon} /> : null}
      {action.shortLabel ? (
        <>
          <span className="report__label-long">{action.label}</span>
          <span className="report__label-short">{action.shortLabel}</span>
        </>
      ) : (
        action.label
      )}
    </>
  )
}

export type ReportLink = { label: string; onClick: () => void }

export type RunReportBodyProps = {
  titleId: string
  tier: ReportTier
  ribbon: ReportRibbon | null
  /** The run's own words over the score when it won nothing: Run over, Ship down. */
  eyebrow: string
  score: string
  unit: string
  sub: string | null
  scoreTone: ReportTone
  /** What the run did; null while it is still being worked out. */
  lines: ReportLine[] | null
  race?: ReportRace | null
  /** What this moment asks: signing in, a tag, a word about the save. */
  children?: ReactNode
  primary: ReportAction
  secondary?: ReportAction | null
  /** Bottom left: whose name the run went under. */
  who?: ReactNode
  links?: ReportLink[]
  /** Top left: out of the game altogether, where the play screen's own back control goes. */
  leave?: ReportLink | null
}

function Action({
  action,
  className,
  allow,
}: {
  action: ReportAction
  className: string
  allow: (e: ReactMouseEvent) => boolean
}) {
  if (action.href) {
    return (
      <a
        className={className}
        href={action.href}
        onClick={(e) => {
          if (!allow(e)) e.preventDefault()
        }}
      >
        <ActionLabel action={action} />
      </a>
    )
  }
  return (
    <button
      ref={action.buttonRef}
      type="button"
      className={action.busy ? `${className} panel__btn--busy` : className}
      disabled={action.disabled}
      aria-disabled={action.busy || undefined}
      onClick={(e) => {
        if (action.busy || !allow(e)) return
        action.onClick?.()
      }}
    >
      <ActionLabel action={action} />
    </button>
  )
}

function Lines({ lines, tier }: { lines: ReportLine[]; tier: ReportTier }) {
  return (
    <ul className={`report__lines report__lines--${tier}`} aria-label="What this run did">
      {lines.map((line, i) => (
        <li
          key={line.id}
          className={`report__line report__line--${line.tone}`}
          style={{ '--i': i } as CSSProperties}
        >
          <span className="report__line-icon">
            <ReportIconSvg icon={line.icon} />
          </span>
          <span className="report__line-text">
            <span className="report__line-label">{line.label}</span>
            {line.detail ? <span className="report__line-detail">{line.detail}</span> : null}
          </span>
          <span className="report__line-value">{line.value}</span>
        </li>
      ))}
    </ul>
  )
}

function LinesLoading() {
  return (
    <div className="report__lines report__lines--loading">
      <p className="visually-hidden" role="status">
        Saving your run
      </p>
      {[0, 1, 2].map((i) => (
        <span key={i} className="report__line report__line--ghost" aria-hidden="true">
          <span className="report__line-icon" />
          <span className="report__line-text">
            <span className="report__ghost report__ghost--label" />
            <span className="report__ghost report__ghost--detail" />
          </span>
          <span className="report__ghost report__ghost--value" />
        </span>
      ))}
    </div>
  )
}

/** The race the run won: the top three, with your row come up past the name it beat. */
function Race({ race }: { race: ReportRace }) {
  const mineAt = race.rows.findIndex((r) => r.mine)
  const was = race.rows[mineAt]?.from
  // The row it rose from, or from under the three when it came from further down.
  const from = was != null ? Math.min(was, race.rows.length + 1) - 1 : race.rows.length
  return (
    <div className="report__race">
      <span className="report__race-title">{race.title}</span>
      <ol className="report__race-rows">
        {race.rows.map((row, i) => {
          // Your row rises from where it stood; the rows it passed step down one.
          const shift = row.mine ? from - i : i > mineAt && i <= from ? -1 : 0
          return (
            <li
              key={row.name}
              className={`report__race-row${row.mine ? ' report__race-row--mine' : ''}`}
              style={shift ? ({ '--shift': shift } as CSSProperties) : undefined}
            >
              <span className="report__race-place">{row.place}</span>
              <PlayerAvatar avatarId={row.avatarId} name={row.name} size="sm" />
              <span className="report__race-name">
                {row.name}
                {row.note ? <span className="report__race-note">{row.note}</span> : null}
              </span>
              <span className="report__race-score">{row.score}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function RunReportBody({
  titleId,
  tier,
  ribbon,
  eyebrow,
  score,
  unit,
  sub,
  scoreTone,
  lines,
  race,
  children,
  primary,
  secondary,
  who,
  links,
  leave,
}: RunReportBodyProps) {
  // A run's last presses don't reach the buttons (useDeliberatePress).
  const allow = useDeliberatePress()
  return (
    <>
      <header className="report__head">
        {leave ? (
          <button
            type="button"
            className="report__leave"
            onClick={(e) => {
              if (allow(e)) leave.onClick()
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M14.5 5.5L8 12l6.5 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {leave.label}
          </button>
        ) : null}
        {ribbon ? (
          <span className={`report__ribbon report__ribbon--${ribbon.tone}`}>
            <ReportIconSvg icon={ribbon.icon} />
            {ribbon.text}
          </span>
        ) : (
          <span className="report__eyebrow">{eyebrow}</span>
        )}
        <h2 id={titleId} className={`report__score report__score--${scoreTone}`}>
          <span className="report__figure">{score}</span>
          {unit ? <span className="report__unit">{unit}</span> : null}
        </h2>
        {sub ? <p className="report__sub">{sub}</p> : null}
      </header>
      {/* The score's band stays on top and Play again at the bottom; only what's between scrolls, when it must. */}
      <div className="report__body">
        {lines === null ? <LinesLoading /> : lines.length ? <Lines lines={lines} tier={tier} /> : null}
        {race ? <Race race={race} /> : null}
        {children ? <div className="report__block">{children}</div> : null}
      </div>
      <div className="report__foot">
        <div className="report__actions">
          <Action action={primary} className="panel__btn" allow={allow} />
          {secondary ? <Action action={secondary} className="panel__btn panel__btn--ghost" allow={allow} /> : null}
        </div>
        {who || links?.length ? (
          <div className="report__meta">
            {who ? <span className="report__who">{who}</span> : <span />}
            {links?.length ? (
              <span className="report__links">
                {links.map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    className="report__link"
                    onClick={(e) => {
                      if (allow(e)) link.onClick()
                    }}
                  >
                    {link.label}
                  </button>
                ))}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}

/** Whose name the run went under, with their character. */
export function ReportWho({ name, avatarId, text }: { name?: string | null; avatarId?: string; text: string }) {
  return (
    <>
      {name ? (
        <PlayerAvatar avatarId={avatarId} name={name} size="sm" />
      ) : (
        <span className="report__who-mark" aria-hidden="true">
          ?
        </span>
      )}
      {text}
    </>
  )
}

/* ---------- confetti ---------- */

type Piece = {
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  angle: number
  w: number
  h: number
  color: string
  delay: number
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** One burst from either side of the card, in the game's colours and the gold, then gone. */
export function ReportConfetti({ accent }: { accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || reducedMotion()) return
    const colors = [accent, '#f5b942', '#45d3ba', '#e85d75', '#7ab8e8', '#fff3cc']
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pieces: Piece[] = []
    const count = w < 640 ? 70 : 110
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1
      const x = w / 2 + side * (w * 0.12 + Math.random() * w * 0.2)
      pieces.push({
        x,
        y: h * (0.18 + Math.random() * 0.2),
        vx: side * (1.5 + Math.random() * 4.5),
        vy: -(5 + Math.random() * 7),
        spin: (Math.random() - 0.5) * 0.35,
        angle: Math.random() * Math.PI,
        w: 5 + Math.random() * 5,
        h: 9 + Math.random() * 7,
        color: colors[i % colors.length]!,
        delay: Math.random() * 180,
      })
    }

    const start = performance.now()
    const life = 2800
    let last = start
    let raf = 0
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000) * 60
      last = now
      const t = now - start
      ctx.clearRect(0, 0, w, h)
      const fade = Math.max(0, Math.min(1, (life - t) / 700))
      for (const p of pieces) {
        if (t < p.delay) continue
        p.vy += 0.22 * dt
        p.vx *= 0.985
        p.vy *= 0.99
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.angle += p.spin * dt
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        // A flat piece turning over: its width swings through zero.
        ctx.scale(Math.cos(p.angle * 1.7), 1)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      if (t < life) raf = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, w, h)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [accent])

  return <canvas ref={ref} className="report-confetti" aria-hidden="true" />
}

/* ---------- the modal ---------- */

export type RunReportProps = RunReportBodyProps & {
  /** Read out when the report opens: what it won, and the score. */
  label: string
  style?: CSSProperties
  /** The game's colour, for the confetti. */
  accent: string
  /** Esc: the way out this moment allows; nothing when it wants an answer. */
  onEscape?: () => void
  initialFocus?: RefObject<HTMLElement | null>
}

export function RunReport({ label, style, accent, onEscape, initialFocus, ...body }: RunReportProps) {
  const [burst, setBurst] = useState(false)
  // Confetti once, the first time the report goes big.
  useEffect(() => {
    if (body.tier === 'big') setBurst(true)
  }, [body.tier])

  return (
    <Panel
      label={label}
      onClose={() => onEscape?.()}
      scrimCloses={false}
      initialFocus={initialFocus}
      className={`report report--${body.tier}`}
      style={style}
      backdrop={burst ? <ReportConfetti accent={accent} /> : null}
    >
      <RunReportBody {...body} />
    </Panel>
  )
}

/* ---------- what a moment asks ---------- */

/** Signed out: what the run would win, and the one button that wins it. */
export function ReportSignIn({
  lead,
  error,
  onSignedIn,
}: {
  lead: ReactNode
  error?: string | null
  onSignedIn: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const shown = localError || error
  return (
    <div className="report__ask">
      <p className="report__ask-text">{lead}</p>
      <GoogleSignInButton
        disabled={busy}
        onBusy={setBusy}
        onError={(message) => setLocalError(message)}
        onSignedIn={() => {
          setLocalError(null)
          onSignedIn()
        }}
      />
      {shown ? <p className="panel__error">{shown}</p> : null}
    </div>
  )
}

/** A tag in slots, the way a cabinet's high-score screen takes one. The input is real, under the slots. */
export function TagSlots({
  id,
  value,
  onChange,
  onSubmit,
  inputRef,
  lead,
  error,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  inputRef?: RefObject<HTMLInputElement | null>
  lead?: ReactNode
  error?: string | null
}) {
  const [focused, setFocused] = useState(false)
  const count = Math.min(PLAYER_NAME_MAX, Math.max(6, value.length + 1))
  const caret = Math.min(value.length, PLAYER_NAME_MAX - 1)
  return (
    <div className="report__ask report__tag">
      {lead ? <p className="report__ask-text">{lead}</p> : null}
      <label htmlFor={id} className="report__tag-label">
        Enter your tag
      </label>
      <div className="report__slots" style={{ '--slots': count } as CSSProperties}>
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`report__slot${value[i] ? ' report__slot--filled' : ''}${focused && i === caret ? ' report__slot--caret' : ''}`}
          >
            {value[i] ?? ''}
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          className="report__tag-input"
          value={value}
          maxLength={PLAYER_NAME_MAX}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="done"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, PLAYER_NAME_MAX))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit()
            }
          }}
        />
      </div>
      {error ? <p className="panel__error">{error}</p> : null}
      <p className="report__tag-note">The name on every board, up to {PLAYER_NAME_MAX} letters and numbers.</p>
    </div>
  )
}
