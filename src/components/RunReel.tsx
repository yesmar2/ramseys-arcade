import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { prizeById } from '../data/prizes'
import { useDeliberatePress } from '../hooks/useDeliberatePress'
import { prizesHref } from '../hooks/useHashRoute'
import { ordinal } from '../lib/profileMath'
import { MEDAL_NAMES, type Medal } from '../lib/raceMedals'
import type { ReportFriend, ReportLine, ReportMetal, ReportRace, ReportRibbon, ReportTier, ReportTone } from '../lib/runReport'
import { loudLevelUp, type SeasonRun } from '../lib/season'
import { sfx } from '../lib/sound'
import { useTickets, type RunTickets } from '../lib/tickets'
import { BlipFigure } from './BlipFigure'
import { Panel } from './Panel'
import { PlayerAvatar } from './PlayerAvatar'
import { lineLabel, nextWords } from './prizes/RunTickets'
import { TicketGlyph, TicketStub } from './prizes/Ticket'
import { MedalIcon } from './RaceMedal'
import { FriendDuel, RacePodium, ReportConfetti, ReportIconSvg, type ReportAction, type ReportLink } from './RunReport'
import { SeasonPatch } from './season/SeasonLook'
import { SeasonRunLine } from './season/SeasonRun'
import '../styles/runReel.css'

/*
 * The end of a run as a show (Ramsey picked A, "Show reel", from the "Game over screens" canvas, 2026-10-14,
 * after "full screen multi step game over screens ... similar to how fall guys might do it"): the whole screen,
 * a step at a time, each with one thing to say, and a tap anywhere goes on. The run itself first, the moment the
 * game ends, while the save goes out underneath; then only the steps the run has something for: where it landed
 * on the boards, the tickets it paid, a level it reached on the season's pass; then what next, with Play again.
 * Signed out, the step after the run asks for the sign-in; signed in without a tag, for the tag. Skip, top right,
 * goes straight to the last step, and Esc back to the game as Play again does.
 */

/** A press the reel will act on: one meant for it (useDeliberatePress), and not the tail of the last step's tap. */
type Press = (e: ReactMouseEvent) => boolean
const ReelPress = createContext<Press>(() => true)

export type ReelTone = 'run' | 'boards' | 'tickets' | 'season' | 'ask' | 'next'

export type ReelStep = {
  key: string
  tone: ReelTone
  body: ReactNode
  /** What the way on says on this step: "Not now" past the sign-in, "Skip" past a tag. */
  goLabel?: string
  /** Where focus goes when the step comes up: a tag's own field. */
  focus?: RefObject<HTMLElement | null>
}

export type RunReelProps = {
  /** Read out as the reel opens: what the run won, and its score. */
  label: string
  /** The game's colour tokens (gameAccentStyle). */
  style?: CSSProperties
  accent: string
  /** The game's name, over every step. */
  game: string
  tier: ReportTier
  metal?: ReportMetal | null
  steps: ReelStep[]
  /** The last step's way on: focus goes to it when that step comes up. */
  primaryRef?: RefObject<HTMLButtonElement | null>
  /** Out of the game altogether, on the last step. */
  leave?: ReportLink | null
  /** Esc: the way out this moment allows; nothing when it wants an answer. */
  onEscape?: () => void
}

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M9 5l7 7-7 7" />
  </svg>
)

export function RunReel({ label, style, accent, game, tier, metal = null, steps, primaryRef, leave, onEscape }: RunReelProps) {
  const [at, setAt] = useState(() => ({ key: steps[0]?.key ?? 'run', index: 0 }))
  // The step by its name, so steps coming in once the save answers don't move you; a step whose moment has
  // passed (the sign-in, once signed in) gives way to whichever is in its place.
  const found = steps.findIndex((s) => s.key === at.key)
  const index = found >= 0 ? found : Math.min(at.index, steps.length - 1)
  const step = steps[index]!
  const last = index === steps.length - 1
  const deliberate = useDeliberatePress()
  const changedAt = useRef(0)
  const goRef = useRef<HTMLButtonElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const allow: Press = (e) => deliberate(e) && performance.now() - changedAt.current > 350
  const goTo = (i: number) => {
    const next = steps[i]
    if (!next || i === index) return
    changedAt.current = performance.now()
    setAt({ key: next.key, index: i })
  }

  // Focus follows the steps: the way on, a step's own field, and on the last step, Play again. A step opens at its top.
  useEffect(() => {
    if (stageRef.current) stageRef.current.scrollTop = 0
    const target = step.focus?.current ?? (last ? primaryRef?.current : goRef.current)
    target?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.key, last])

  // Confetti once, the first time the run goes big.
  const [burst, setBurst] = useState(false)
  useEffect(() => {
    if (tier === 'big') setBurst(true)
  }, [tier])

  // A tap anywhere on a step, but on something of its own, goes on, as a show's screens do.
  const tapOn = (e: ReactMouseEvent) => {
    if (last || (e.target as Element).closest('a, button, input, label, select, textarea, summary, [role="button"]')) return
    if (allow(e)) goTo(index + 1)
  }

  const lit = step.tone === 'run' && tier !== 'quiet' ? ` reel--${tier}` : ''
  return (
    <Panel
      label={label}
      onClose={() => onEscape?.()}
      scrimCloses={false}
      initialFocus={goRef}
      className={`reel reel--${step.tone}${lit}${metal && lit ? ` reel--${metal}` : ''}`}
      layerClassName="reel-layer"
      style={style}
    >
      <div className="reel__bg" aria-hidden="true">
        <span className="reel__rays" />
      </div>
      <div className="reel__top">
        <ol className="reel__pips" aria-label={`Step ${index + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <li key={s.key} className={i <= index ? 'reel__pip reel__pip--on' : 'reel__pip'} />
          ))}
        </ol>
        <div className="reel__bar">
          <span className="reel__game">{game}</span>
          {last ? (
            leave ? (
              <button
                type="button"
                className="reel__skip"
                onClick={(e) => {
                  if (allow(e)) leave.onClick()
                }}
              >
                {leave.label}
              </button>
            ) : null
          ) : (
            <button
              type="button"
              className="reel__skip"
              onClick={(e) => {
                if (allow(e)) goTo(steps.length - 1)
              }}
            >
              Skip
            </button>
          )}
        </div>
      </div>
      <ReelPress.Provider value={allow}>
        {/* Each step is read out as it comes; the step itself is new each time, so its entrance plays. */}
        <div ref={stageRef} className="reel__stage" onClick={tapOn} aria-live="polite">
          <div key={step.key} className="reel__step">
            {step.body}
          </div>
        </div>
      </ReelPress.Provider>
      {last ? null : (
        <div className="reel__on">
          <button
            ref={goRef}
            type="button"
            className="reel__go"
            onClick={(e) => {
              if (allow(e)) goTo(index + 1)
            }}
          >
            {step.goLabel ?? 'Tap to go on'}
            <ChevronIcon />
          </button>
        </div>
      )}
      {burst ? (
        <div className="reel__confetti" aria-hidden="true">
          <ReportConfetti accent={accent} metal={metal} />
        </div>
      ) : null}
    </Panel>
  )
}

/* ---------- the steps ---------- */

const motionOk = () => typeof matchMedia !== 'function' || !matchMedia('(prefers-reduced-motion: reduce)').matches

/** "#2" as a place on its own: 2nd. Anything else as it is. */
function placeWords(value: string): string {
  const m = /^#(\d+)$/.exec(value.trim())
  return m ? ordinal(Number(m[1])) : value
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export type ReelRunProps = {
  titleId: string
  tier: ReportTier
  metal?: ReportMetal | null
  ribbon: ReportRibbon | null
  /** The run's own words over the score when it won nothing: Run over, Today's Cave #2. */
  eyebrow: string
  score: string
  unit: string
  sub: string | null
  scoreTone: ReportTone
  /** A racing daily's medal, newly won: shown big under its time. */
  medal?: Medal | null
  /** Under it all: a racing daily's medal ladder. */
  children?: ReactNode
}

/** The run: what it won as a stamp (or its own words), the score as big as it goes, and how it ended. */
export function ReelRun({ titleId, tier, metal = null, ribbon, eyebrow, score, unit, sub, scoreTone, medal = null, children }: ReelRunProps) {
  const stamp = ribbon ? (tier === 'big' && metal ? metal : ribbon.tone) : null
  // The figure as big as its length allows: 436 fills the screen, 1:02.00 doesn't fit at that size.
  const size = score.length <= 3 ? 'xl' : score.length <= 5 ? 'lg' : score.length <= 7 ? 'md' : 'sm'
  return (
    <div className="reel-run">
      {ribbon ? (
        <span className={`reel-stamp reel-stamp--${stamp}`}>
          {ribbon.face ? (
            <PlayerAvatar name={ribbon.face.name} avatarId={ribbon.face.avatarId} size="sm" className="reel-stamp__face" />
          ) : (
            <ReportIconSvg icon={ribbon.icon} />
          )}
          {ribbon.text}
        </span>
      ) : (
        <p className="reel__kick">{eyebrow}</p>
      )}
      <h2 id={titleId} className={`reel-run__score reel-run__score--${scoreTone}`}>
        <span className={`reel-run__figure reel-run__figure--${size}`}>{score}</span>
        {unit ? <span className="reel-run__unit">{unit}</span> : null}
      </h2>
      {sub ? <p className="reel-run__sub">{sub}</p> : null}
      {medal ? (
        <div className="reel-run__medal">
          <MedalIcon medal={medal} size={104} />
          <span className={`reel-stamp reel-stamp--${medal}`}>{MEDAL_NAMES[medal]}!</span>
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** While the save answers: Blip, and the word that it's on its way. */
export function ReelWait({ slow }: { slow: boolean }) {
  return (
    <div className="reel-wait">
      <BlipFigure className="reel-wait__blip" size={96} />
      <p className="reel-wait__said" role="status">
        {slow ? 'Still saving. It finishes even if you play on.' : 'Saving your run…'}
      </p>
      <span className="reel-wait__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}

/**
 * Where the run landed: its place on the board as big as the score was (the board's line, or what else it did
 * when it has no board), the podium when it climbed onto it, the friend it went past face to face, and the rest of
 * what it did in rows.
 */
export function ReelLanded({
  lines,
  race = null,
  friend = null,
  onBoard,
}: {
  lines: ReportLine[]
  race?: ReportRace | null
  friend?: ReportFriend | null
  onBoard?: () => void
}) {
  const allow = useContext(ReelPress)
  const hero = lines.find((l) => l.id === 'board') ?? lines[0] ?? null
  const rest = lines.filter((l) => l !== hero)
  return (
    <div className="reel-land">
      {hero ? (
        <div className={`reel-land__hero reel-land__hero--${hero.tone}`}>
          <p className="reel__kick">{hero.label}</p>
          <p className="reel-land__place">{placeWords(hero.value)}</p>
          {hero.detail ? <p className="reel-land__detail">{capital(hero.detail)}</p> : null}
        </div>
      ) : null}
      {race ? <RacePodium race={race} /> : null}
      {friend ? <FriendDuel friend={friend} /> : null}
      {rest.length ? (
        <ul className="reel-rows" aria-label="What else the run did">
          {rest.map((line, i) => (
            <li key={line.id} className={`reel-row reel-row--${line.tone}`} style={{ '--i': i } as CSSProperties}>
              <span className="reel-row__icon">
                <ReportIconSvg icon={line.icon} />
              </span>
              <span className="reel-row__text">
                <span className="reel-row__label">{line.label}</span>
                {line.detail ? <span className="reel-row__detail">{line.detail}</span> : null}
              </span>
              <span className="reel-row__value">{line.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {onBoard ? (
        <button
          type="button"
          className="reel-link"
          onClick={(e) => {
            if (allow(e)) onBoard()
          }}
        >
          See the board ›
        </button>
      ) : null}
    </div>
  )
}

/** A figure rolled up from `from` to `to` once `delay` has gone by, with a chime when it lands. */
function useRollUp(from: number, to: number, delay: number): number {
  const [value, setValue] = useState(() => (motionOk() ? from : to))
  useEffect(() => {
    if (!motionOk() || from === to) {
      setValue(to)
      return undefined
    }
    let raf = 0
    const timer = window.setTimeout(() => {
      const t0 = performance.now()
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / 650)
        setValue(Math.round(from + (to - from) * (1 - (1 - k) ** 3)))
        if (k < 1) raf = requestAnimationFrame(tick)
        else sfx('good')
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [from, to, delay])
  return value
}

/**
 * The tickets the run paid: the ticket itself, big, then what made it up a line at a time, each with a click, and
 * the new total rolling up. Under it, the next step of the ladder or the day's cap, the prize being saved for,
 * and the season's pass when the run moved it without reaching a level (a level gets a step of its own).
 */
export function ReelTickets({ paid, game, medal = null, season = null }: { paid: RunTickets; game: string; medal?: Medal | null; season?: SeasonRun | null }) {
  const { goal: goalId, balance } = useTickets()
  const goal = prizeById(goalId)
  // The store may not have caught up with this save yet; the save's own answer is the newer.
  const total = Math.max(balance, paid.balance)
  const rows = paid.lines.map((line) => ({ label: lineLabel(paid, line, game, medal), amount: line.amount }))
  const shown = useRollUp(total - paid.earned, total, 700 + rows.length * 260)
  useEffect(() => {
    if (!motionOk()) return undefined
    const timers = rows.map((_, i) => window.setTimeout(() => sfx('click', 1), 620 + i * 260))
    return () => timers.forEach((t) => window.clearTimeout(t))
    // Once, as the step comes up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toGo = goal ? Math.max(0, goal.price - total) : 0
  return (
    <div className="reel-tix">
      <p className="reel__kick">Tickets</p>
      <div className="reel-tix__stub">
        <TicketStub amount={paid.earned} width={208} fan={paid.earned >= 15 ? 2 : paid.earned >= 8 ? 1 : 0} />
      </div>
      <ul className="reel-tix__rows" aria-label={`${paid.earned} tickets`}>
        {rows.map((row, i) => (
          <li key={`${row.label}-${i}`} className="reel-tix__row" style={{ '--i': i } as CSSProperties}>
            <span>{row.label}</span>
            <b>+{row.amount}</b>
          </li>
        ))}
        <li className="reel-tix__row reel-tix__row--total" style={{ '--i': rows.length } as CSSProperties}>
          <span>Your tickets</span>
          <b>
            <TicketGlyph size={22} />
            <span aria-hidden="true">{shown.toLocaleString()}</span>
            <span className="visually-hidden">{total.toLocaleString()}</span>
          </b>
        </li>
      </ul>
      {paid.capped > 0 ? (
        <p className="reel-tix__note">Today’s run tickets are all in. Tomorrow’s runs pay again.</p>
      ) : paid.next && !medal ? (
        <p className="reel-tix__note">Next: {nextWords(paid.next, game)}</p>
      ) : null}
      {goal ? (
        <a className="reel-tix__goal" href={prizesHref()}>
          <span className="tix-meter" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (100 * total) / goal.price)}%` }} />
          </span>
          {toGo > 0 ? `${toGo.toLocaleString()} to ${goal.name}` : `${goal.name} is yours to trade for`}
        </a>
      ) : (
        <a className="reel-link" href={prizesHref()}>
          Spend them at the prize counter ›
        </a>
      )}
      {season ? <SeasonRunLine run={season} /> : null}
    </div>
  )
}

/** A level reached on the season's pass: the level as big as the score was, and what it gave. */
export function ReelSeason({ run }: { run: SeasonRun }) {
  const loud = loudLevelUp(run.levelUp)
  return (
    <div className={`reel-season${loud ? ' reel-season--loud' : ''}`}>
      <p className="reel__kick">{run.name}</p>
      <p className="reel-season__up">Level up!</p>
      {loud ? null : (
        <span className="reel-season__patch">
          <SeasonPatch label={String(run.level)} size={128} />
        </span>
      )}
      <SeasonRunLine run={run} />
    </div>
  )
}

/** A tile of the last step's recap: one figure of the run and what it is. */
export type ReelRecap = { key: string; value: string; label: string; tone: 'run' | 'boards' | 'tickets' | 'season' }

/** A reel's button: the run's last presses don't reach it (useDeliberatePress), nor the tail of a step's tap. */
export function ReelButton({ action, variant = 'play' }: { action: ReportAction; variant?: 'play' | 'ghost' }) {
  const allow = useContext(ReelPress)
  const className = `reel-btn reel-btn--${variant}`
  const label = (
    <>
      {action.icon ? <ReportIconSvg icon={action.icon} /> : null}
      {action.label}
    </>
  )
  if (action.href) {
    return (
      <a
        className={className}
        href={action.href}
        onClick={(e) => {
          if (!allow(e)) e.preventDefault()
        }}
      >
        {label}
      </a>
    )
  }
  return (
    <button
      ref={action.buttonRef}
      type="button"
      className={action.busy ? `${className} reel-btn--busy` : className}
      disabled={action.disabled}
      aria-disabled={action.busy || undefined}
      onClick={(e) => {
        if (action.busy || !allow(e)) return
        action.onClick?.()
      }}
    >
      {label}
    </button>
  )
}

/** What next: the run in a few tiles, what the moment asks, then Play again and the way to send the run on. */
export function ReelNext({
  recap,
  block,
  primary,
  secondary = null,
  who,
  links,
}: {
  recap: ReelRecap[]
  block?: ReactNode
  primary: ReportAction
  secondary?: ReportAction | null
  who?: ReactNode
  links?: ReportLink[]
}) {
  const allow = useContext(ReelPress)
  return (
    <div className="reel-next">
      {recap.length ? (
        <>
          <p className="reel__kick reel-next__kick">That run</p>
          <ul className={`reel-recap reel-recap--${recap.length}`} aria-label="That run">
            {recap.map((tile, i) => (
              <li key={tile.key} className={`reel-recap__tile reel-recap__tile--${tile.tone}`} style={{ '--i': i } as CSSProperties}>
                <span className="reel-recap__value">{tile.value}</span>
                <span className="reel-recap__label">{tile.label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {block ? <div className="reel-next__block">{block}</div> : null}
      <div className="reel-next__actions">
        <ReelButton action={primary} />
        {secondary ? <ReelButton action={secondary} variant="ghost" /> : null}
      </div>
      {who || links?.length ? (
        <div className="reel-next__meta">
          {who ? <span className="report__who">{who}</span> : <span />}
          {links?.length ? (
            <span className="reel-next__links">
              {links.map((link) => (
                <button
                  key={link.label}
                  type="button"
                  className="reel-next__link"
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
  )
}

/* ---------- which steps a run gets ---------- */

export type ReelInput = {
  /**
   * Where the save is: still going out (`pending`), waiting on a sign-in or a tag (`ask`), saved, or `done`
   * without a save to wait for (a stage skip, practice, another account's run, a failed save).
   */
  phase: 'pending' | 'ask' | 'saved' | 'done'
  /** The save has gone on a while. */
  slow?: boolean
  run: ReelRunProps
  /** What the run did on the boards and in the books, once it's saved. */
  lines: ReportLine[]
  race?: ReportRace | null
  friend?: ReportFriend | null
  onBoard?: () => void
  /** The tickets step's body (ReelTickets), when the run paid some. */
  tickets?: ReactNode
  /** The season's pass, when the run moved it. */
  season?: SeasonRun | null
  /** The step after the run when the save waits on something: the sign-in, or a tag. */
  ask?: ReactNode
  askGoLabel?: string
  askFocus?: RefObject<HTMLElement | null>
  recap: ReelRecap[]
  /** What the last step asks or says: the way on to the next daily, an alert, a note on the save. */
  block?: ReactNode
  primary: ReportAction
  secondary?: ReportAction | null
  who?: ReactNode
  links?: ReportLink[]
}

/**
 * The steps a run gets, in order: always the run first and what next last; between them only what the run has
 * something for. A run that lit nothing on the boards (quiet) doesn't get the boards step: its place is in the
 * last step's recap. A level reached on the pass gets a step; points only, a line under the tickets.
 */
export function reelSteps(input: ReelInput): ReelStep[] {
  const { phase, run } = input
  const steps: ReelStep[] = [{ key: 'run', tone: 'run', body: <ReelRun {...run} /> }]
  if (phase === 'pending') steps.push({ key: 'wait', tone: 'run', body: <ReelWait slow={Boolean(input.slow)} /> })
  if (phase === 'ask' && input.ask) {
    steps.push({ key: 'ask', tone: 'ask', body: <div className="reel-ask">{input.ask}</div>, goLabel: input.askGoLabel, focus: input.askFocus })
  }
  if (phase === 'saved') {
    const moment = run.tier !== 'quiet' || Boolean(input.friend) || Boolean(input.race)
    if (moment && (input.lines.length || input.race || input.friend)) {
      steps.push({
        key: 'landed',
        tone: 'boards',
        body: <ReelLanded lines={input.lines} race={input.race} friend={input.friend} onBoard={input.onBoard} />,
      })
    }
    if (input.tickets) steps.push({ key: 'tickets', tone: 'tickets', body: input.tickets })
    if (input.season && input.season.levelUp.length) steps.push({ key: 'season', tone: 'season', body: <ReelSeason run={input.season} /> })
  }
  steps.push({
    key: 'next',
    tone: 'next',
    body: (
      <ReelNext recap={input.recap} block={input.block} primary={input.primary} secondary={input.secondary} who={input.who} links={input.links} />
    ),
  })
  return steps
}

/** "Lv 31": a season's level, said short for a recap tile. */
export function levelTile(run: SeasonRun): ReelRecap {
  return { key: 'season', value: `Lv ${Math.max(1, run.level)}`, label: run.added > 0 ? `Season pass +${run.added}` : 'Season pass', tone: 'season' }
}

/** The run's place on its board, said short for a recap tile. */
export function placeTile(line: ReportLine): ReelRecap {
  return { key: 'place', value: placeWords(line.value), label: line.label, tone: 'boards' }
}
