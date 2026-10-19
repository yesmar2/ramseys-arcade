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
import type {
  ReportBoardCard,
  ReportBoardRow,
  ReportChase,
  ReportFriend,
  ReportIcon,
  ReportLine,
  ReportMetal,
  ReportRibbon,
  ReportStandings,
  ReportTier,
  ReportTone,
} from '../lib/runReport'
import { loudLevelUp, type SeasonRun } from '../lib/season'
import { sfx } from '../lib/sound'
import { useTickets, type RunTickets } from '../lib/tickets'
import { BlipFigure } from './BlipFigure'
import { Panel } from './Panel'
import { PlayerAvatar } from './PlayerAvatar'
import { lineLabel, nextWords } from './prizes/RunTickets'
import { TicketGlyph, TicketStub } from './prizes/Ticket'
import { MedalIcon } from './RaceMedal'
import { FriendDuel, ReportConfetti, ReportIconSvg, type ReportAction, type ReportLink } from './RunReport'
import { SeasonPatch } from './season/SeasonLook'
import { SeasonRunLine } from './season/SeasonRun'
import '../styles/runReel.css'

/*
 * The end of a run as a show (Ramsey picked A, "Show reel", from the "Game over screens" canvas, 2026-10-14,
 * after "full screen multi step game over screens ... similar to how fall guys might do it"): the whole screen,
 * a page at a time, each with one thing to say, and a tap anywhere goes on. In the order he set out on the "What
 * next screen" canvas ("the first game over page just the score and where it lands on the board, then ...
 * standings ..., record books, ... tickets"): the run and where it landed on its board; then, only when there's
 * news, the standings it moved, the record books it got into, the tickets it paid, a level on the pass; then what
 * next, as B: the next move as a poster (the next daily, or the place to beat) with Play again. On a computer each
 * page lays its two halves side by side (Desktop 2, "Wide"). Signed out, the page after the run asks for the
 * sign-in; signed in without a tag, for the tag. Skip, top right, goes straight to the last page, and Esc back to
 * the game as Play again does.
 */

/** A press the reel will act on: one meant for it (useDeliberatePress), and not the tail of the last step's tap. */
type Press = (e: ReactMouseEvent) => boolean
const ReelPress = createContext<Press>(() => true)

export type ReelTone = 'run' | 'friends' | 'standings' | 'books' | 'tickets' | 'season' | 'ask' | 'next'

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

  // Focus follows the steps: the way on, a step's own field, and on the last step, Play again (or what stands in
  // for it: the next daily's own button, an event's standings once its tries are spent). A step opens at its top.
  useEffect(() => {
    if (stageRef.current) stageRef.current.scrollTop = 0
    const target = step.focus?.current ?? (last ? (primaryRef?.current ?? stageRef.current?.querySelector<HTMLElement>('.reel-btn')) : goRef.current)
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
          <span className="reel__hint" aria-hidden="true">
            or press Space
          </span>
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

/* ---------- the pieces of a page ---------- */

const motionOk = () => typeof matchMedia !== 'function' || !matchMedia('(prefers-reduced-motion: reduce)').matches

/** "#2" as a place on its own: 2nd. Anything else as it is. */
function placeWords(value: string): string {
  const m = /^#(\d+)$/.exec(value.trim())
  return m ? ordinal(Number(m[1])) : value
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A page's two halves: stacked on a phone, side by side on a computer (Desktop 2, "Wide"). */
function ReelSplit({ main, side, className = '' }: { main: ReactNode; side?: ReactNode; className?: string }) {
  return (
    <div className={`reel-split${side ? '' : ' reel-split--solo'}${className ? ` ${className}` : ''}`}>
      <div className="reel-split__main">{main}</div>
      {side ? <div className="reel-split__side">{side}</div> : null}
    </div>
  )
}

/**
 * A few rows of a board around you: where you are, who's above to pass, who you went past; and the run just
 * played, where its score falls, when it came in under your best.
 */
function ReelBoardRows({ rows, label }: { rows: ReportBoardRow[]; label: string }) {
  return (
    <ol className="reel-board" aria-label={label}>
      {rows.map((row, i) =>
        row.run ? (
          <li key="run" className="reel-board__row reel-board__row--run" style={{ '--i': i } as CSSProperties}>
            <span className="reel-board__place" />
            <span className="reel-board__face reel-board__run-mark">
              <ReportIconSvg icon="target" />
            </span>
            <span className="reel-board__name">{row.name}</span>
            <span className="reel-board__score">{row.score}</span>
          </li>
        ) : (
        <li
          key={`${row.place}-${row.name}`}
          className={`reel-board__row${row.you ? ' reel-board__row--you' : ''}${row.mark ? ` reel-board__row--${row.mark}` : ''}`}
          style={{ '--i': i } as CSSProperties}
        >
          <span className="reel-board__place">{row.place}</span>
          <PlayerAvatar name={row.name} avatarId={row.avatarId} size="sm" className="reel-board__face" />
          <span className="reel-board__name">
            {row.you ? 'You' : row.name}
            {row.note ? <span className="reel-board__note">{row.note}</span> : null}
            {row.mark === 'passed' ? <span className="reel-board__tag">passed</span> : null}
          </span>
          <span className="reel-board__score">{row.score}</span>
        </li>
        ),
      )}
    </ol>
  )
}

/** How far a place came: up from 71st. */
function ReelMove({ words }: { words: string }) {
  return (
    <span className="reel-move">
      <ReportIconSvg icon="up" />
      {words}
    </span>
  )
}

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
  /** Beside it, with the board: a racing daily's medal ladder. */
  ladder?: ReactNode
}

/** The run: what it won as a stamp (or its own words), the score as big as it goes, and how it ended. */
export function ReelRun({ titleId, tier, metal = null, ribbon, eyebrow, score, unit, sub, scoreTone, medal = null }: Omit<ReelRunProps, 'ladder'>) {
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
    </div>
  )
}

/**
 * Where the run landed on its board, beside its score: the place, how far it came, and the board around it (the
 * podium when it's on it). A racing daily's goes compact on a phone, under its medal ladder.
 */
export function ReelPlace({ card, compact = false, arrived = false }: { card: ReportBoardCard; compact?: boolean; arrived?: boolean }) {
  return (
    <section
      className={`reel-place${compact ? ' reel-place--compact' : ''}${card.gold ? ' reel-place--gold' : ''}${arrived ? ' reel-place--arrived' : ''}`}
      aria-label={card.label}
    >
      <div className="reel-place__head">
        <span className="reel-place__label">{card.label}</span>
        {card.move ? <ReelMove words={card.move} /> : null}
      </div>
      <p className="reel-place__value">{card.value}</p>
      {card.detail ? <p className="reel-place__detail">{capital(card.detail)}</p> : null}
      {card.rows.length ? <ReelBoardRows rows={card.rows} label={card.label} /> : null}
    </section>
  )
}

/**
 * The board's card while the save is out: its shape, quietly shimmering, so the score has its place beside it from
 * the start and nothing moves when the board lands (Ramsey: "it pops to the left when it loads the board").
 */
function ReelPlaceSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`reel-place reel-place--loading${compact ? ' reel-place--compact' : ''}`} aria-busy="true" aria-label="Finding your place on the board">
      <div className="reel-place__head">
        <span className="reel-skel reel-skel--label" />
      </div>
      <span className="reel-place__value reel-skel reel-skel--value" />
      <span className="reel-place__detail reel-skel reel-skel--line" />
      <ol className="reel-board" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="reel-board__row reel-board__row--skel">
            <span className="reel-skel reel-skel--place" />
            <span className="reel-skel reel-skel--face" />
            <span className="reel-skel reel-skel--name" />
            <span className="reel-skel reel-skel--score" />
          </li>
        ))}
      </ol>
    </section>
  )
}

/** How the wait says it: a run being saved, or posted to an event. */
export type ReelWaitWords = { said: string; slow: string }

const SAVING: ReelWaitWords = { said: 'Saving your run…', slow: 'Still saving. It finishes even if you play on.' }

/** While the save answers: Blip, and the word that it's on its way. */
export function ReelWait({ slow, words = SAVING }: { slow: boolean; words?: ReelWaitWords }) {
  return (
    <div className="reel-wait">
      <BlipFigure className="reel-wait__blip" size={96} />
      <p className="reel-wait__said" role="status">
        {slow ? words.slow : words.said}
      </p>
      <span className="reel-wait__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}

/** A friend the run went past on the friends' board: a page of its own, face to face, and who's next up. */
export function ReelFriends({ friend }: { friend: ReportFriend }) {
  return (
    <div className="reel-friends">
      <p className="reel__kick">Your friends</p>
      <p className="reel-friends__head">You passed {friend.them.name}</p>
      <FriendDuel friend={friend} />
    </div>
  )
}

/** The standings, when the run moved you up them: your place as big as the score was, and who's around you. */
export function ReelStandings({ card, onSee }: { card: ReportStandings; onSee?: () => void }) {
  const allow = useContext(ReelPress)
  return (
    <ReelSplit
      main={
        <div className="reel-big">
          <p className="reel__kick">{card.label}</p>
          <p className={`reel-big__figure${card.place === 1 ? ' reel-big__figure--gold' : ''}`}>{ordinal(card.place)}</p>
          <ReelMove words={capital(card.move)} />
          <p className="reel-big__line">{card.line}</p>
        </div>
      }
      side={
        <div className="reel-big__side">
          {card.rows.length ? <ReelBoardRows rows={card.rows} label={card.label} /> : null}
          {onSee ? (
            <button
              type="button"
              className="reel-link"
              onClick={(e) => {
                if (allow(e)) onSee()
              }}
            >
              See the standings ›
            </button>
          ) : null}
        </div>
      }
    />
  )
}

/** A record book's place said short: Record for a 1st, else 2nd. */
const bookPlace = (line: ReportLine) => (line.rank === 1 ? 'Record' : line.rank != null ? ordinal(line.rank) : 'In it')

/** The record books the run got into: the best of them as big as the score was, then each as a brass plaque. */
export function ReelBooks({ lines, onSee }: { lines: ReportLine[]; onSee?: () => void }) {
  const allow = useContext(ReelPress)
  const lead = lines[0]!
  return (
    <ReelSplit
      main={
        <div className="reel-big">
          <p className="reel__kick">{lines.length > 1 ? 'Record books' : 'Record book'}</p>
          <p className="reel-big__figure reel-big__figure--brass">{lead.rank === 1 ? 'Record!' : bookPlace(lead)}</p>
          <p className="reel-big__line">
            {lead.label}, with {lead.value}
          </p>
        </div>
      }
      side={
        <div className="reel-big__side">
          <ul className="reel-plaques" aria-label="Record books">
            {lines.map((line, i) => (
              <li key={line.id} className={`reel-plaque${i === 0 ? ' reel-plaque--lead' : ''}`} style={{ '--i': i } as CSSProperties}>
                <span className="reel-plaque__icon">
                  <ReportIconSvg icon="book" />
                </span>
                <span className="reel-plaque__text">
                  <span className="reel-plaque__label">{line.label}</span>
                  <span className="reel-plaque__value">{line.value}</span>
                </span>
                <span className="reel-plaque__place">
                  <b>{bookPlace(line)}</b>
                  {line.aside ? <small>{capital(line.aside)}</small> : null}
                </span>
              </li>
            ))}
          </ul>
          {onSee ? (
            <button
              type="button"
              className="reel-link"
              onClick={(e) => {
                if (allow(e)) onSee()
              }}
            >
              See the records ›
            </button>
          ) : null}
        </div>
      }
    />
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
    <ReelSplit
      className="reel-tix"
      main={
        <div className="reel-tix__top">
          <p className="reel__kick">Tickets</p>
          <div className="reel-tix__stub">
            <TicketStub amount={paid.earned} width={208} fan={paid.earned >= 15 ? 2 : paid.earned >= 8 ? 1 : 0} />
          </div>
        </div>
      }
      side={
        <div className="reel-tix__body">
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
      }
    />
  )
}

/** A level reached on the season's pass: the level as big as the score was, and what it gave. */
export function ReelSeason({ run }: { run: SeasonRun }) {
  const loud = loudLevelUp(run.levelUp)
  return (
    <ReelSplit
      className={`reel-season${loud ? ' reel-season--loud' : ''}`}
      main={
        <div className="reel-season__top">
          <p className="reel__kick">{run.name}</p>
          <p className="reel-season__up">Level up!</p>
          {loud ? null : (
            <span className="reel-season__patch">
              <SeasonPatch label={String(run.level)} size={128} />
            </span>
          )}
        </div>
      }
      side={<SeasonRunLine run={run} />}
    />
  )
}

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

/* ---------- what next (B): the next move as a poster, the run in a strip ---------- */

/** One thing in the run's recap on the last page: a strip of figures on a phone, a list on a computer. */
export type ReelBadge = {
  key: string
  kind: 'score' | 'medal' | 'best' | 'place' | 'standings' | 'book' | 'tickets' | 'season' | 'tries' | 'won'
  value: string
  label: string
  /** A medal's metal. */
  medal?: Medal
  /** Its icon, where the kind's own won't do: the score's arrow for a new best. */
  icon?: ReportIcon
}

const HEX_PATH = 'M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z'
const AGAIN_PATH = 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.5H8'

function StrokeIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  )
}

function BadgeIcon({ badge }: { badge: ReelBadge }) {
  switch (badge.kind) {
    case 'score':
      return <ReportIconSvg icon={badge.icon ?? 'target'} />
    case 'medal':
      return badge.medal ? <MedalIcon medal={badge.medal} size={30} /> : null
    case 'place':
      return <ReportIconSvg icon={badge.value === '1st' ? 'crown' : 'board'} />
    case 'standings':
      return <ReportIconSvg icon="sum" />
    case 'won':
      return <ReportIconSvg icon="crown" />
    case 'best':
      return <ReportIconSvg icon="up" />
    case 'book':
      return <ReportIconSvg icon="book" />
    case 'tickets':
      return <TicketGlyph size={24} />
    case 'season':
      return <StrokeIcon d={HEX_PATH} />
    case 'tries':
      return <StrokeIcon d={AGAIN_PATH} />
  }
}

/** The run in a few figures: a strip of four over the poster on a phone, every one in a list beside it on a computer. */
function ReelRecap({ items, variant }: { items: ReelBadge[]; variant: 'strip' | 'list' }) {
  const shown = variant === 'strip' ? items.slice(0, 4) : items
  if (!shown.length) return null
  return (
    <div className={`reel-recap reel-recap--${variant}`}>
      {variant === 'list' ? <p className="reel__kick">That run</p> : null}
      <ul aria-label="That run">
        {shown.map((item, i) => (
          <li
            key={item.key}
            className={`reel-recap__item reel-recap__item--${item.kind}${item.medal ? ` reel-recap__item--${item.medal}` : ''}`}
            style={{ '--i': i } as CSSProperties}
          >
            <span className="reel-recap__icon">
              <BadgeIcon badge={item} />
            </span>
            <span className="reel-recap__text">
              <b className="reel-recap__value">{item.value}</b>
              <span className="reel-recap__label">{item.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * What next's place to beat, on a game with a board: the figure it takes as big as the score was, the board around
 * you with the one to pass marked, and Play again. On top of the board, the lead to hold.
 */
export function ReelChase({ chase, primary }: { chase: ReportChase; primary: ReportAction }) {
  return (
    <section className="reel-chase" aria-label={chase.top ? `On top: ${chase.label}` : `To beat: ${chase.target}`}>
      <p className="reel__kick">{chase.top ? `On top · ${chase.label}` : 'To beat'}</p>
      <p className={`reel-chase__figure${chase.top ? ' reel-chase__figure--gold' : ''}`}>
        {chase.figure}
        {chase.unit ? <span className="reel-chase__unit">{chase.unit}</span> : null}
      </p>
      <p className="reel-chase__words">{chase.words}</p>
      {chase.rows.length ? <ReelBoardRows rows={chase.rows} label={chase.label} /> : null}
      <ReelButton action={primary} />
    </section>
  )
}

/**
 * What next, as B: the run in a strip, then the next move as a poster (the next daily, or the place to beat) with
 * its own buttons; with neither, what the moment asks and Play again. Then the way to send the run on, who it's
 * saved as, and the ways out.
 */
export function ReelNext({
  recap,
  poster,
  block,
  blockFirst = false,
  primary,
  secondary = null,
  who,
  links,
}: {
  recap: ReelBadge[]
  poster?: ReactNode
  block?: ReactNode
  /** What the moment asks goes over the poster: a run not saved yet asks for the sign-in first. */
  blockFirst?: boolean
  primary: ReportAction
  secondary?: ReportAction | null
  who?: ReactNode
  links?: ReportLink[]
}) {
  const allow = useContext(ReelPress)
  const asked = block ? <div className="reel-next__block">{block}</div> : null
  return (
    <ReelSplit
      className="reel-split--next"
      main={
        <>
          <ReelRecap items={recap} variant="strip" />
          {poster ? (
            <>
              {blockFirst ? asked : null}
              {poster}
            </>
          ) : (
            <div className="reel-next__plain">
              {asked}
              <ReelButton action={primary} />
            </div>
          )}
        </>
      }
      side={
        <>
          <ReelRecap items={recap} variant="list" />
          {poster && !blockFirst ? asked : null}
          {secondary ? <ReelButton action={secondary} variant="ghost" /> : null}
          {who || links?.length ? (
            <div className="reel-next__meta">
              {who ? <span className="report__who">{who}</span> : <span />}
              {links?.length ? (
                <span className="reel-next__links">
                  {links.map((link, i) => (
                    <button
                      key={`link-${i}`}
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
        </>
      }
    />
  )
}

/* ---------- which pages a run gets ---------- */

export type ReelInput = {
  /**
   * Where the save is: still going out (`pending`), waiting on a sign-in or a tag (`ask`), saved, or `done`
   * without a save to wait for (a stage skip, practice, another account's run, a failed save).
   */
  phase: 'pending' | 'ask' | 'saved' | 'done'
  /** The save has gone on a while. */
  slow?: boolean
  /** How the wait says it, when it isn't a save: an event's post. */
  wait?: ReelWaitWords
  run: ReelRunProps
  /** Beside the score once the run is saved: where it landed on its board. */
  board?: ReportBoardCard | null
  /** A racing daily's board, compact on a phone under its medal ladder. */
  boardCompact?: boolean
  /** A board is on its way while the save is out: its card's shape holds the place beside the score. */
  boardLoading?: boolean
  /** The board came in after its shape stood in: it fades in where that was, without an entrance of its own. */
  boardWaited?: boolean
  /** A friend the run went past on the friends' board: a page of its own, face to face. */
  friend?: ReportFriend | null
  /** The standings, when the run moved you up them: a page of their own. */
  standings?: ReportStandings | null
  onStandings?: () => void
  /** The record books the run got into, best first: a page of their own. */
  books?: ReportLine[]
  onBooks?: () => void
  /** The tickets page's body (ReelTickets), when the run paid some. */
  tickets?: ReactNode
  /** The season's pass, when the run moved it: a page when it reached a level. */
  season?: SeasonRun | null
  /** The page after the run when the save waits on something: the sign-in, or a tag. */
  ask?: ReactNode
  askGoLabel?: string
  askFocus?: RefObject<HTMLElement | null>
  /** The last page's recap of the run. */
  recap: ReelBadge[]
  /** The last page's poster: the next daily, or the place to beat, with its own buttons. */
  poster?: ReactNode
  /** What the last page asks or says: an alert, a note on the save, the sign-in. */
  block?: ReactNode
  /** The block goes over the poster: the sign-in, for a run not saved yet. */
  blockFirst?: boolean
  primary: ReportAction
  secondary?: ReportAction | null
  who?: ReactNode
  links?: ReportLink[]
}

/**
 * The pages a run gets, in order: the run and where it landed on its board first, and what next last; between
 * them only what has news: the standings it moved, the record books it got into, the tickets it paid, a level.
 */
export function reelSteps(input: ReelInput): ReelStep[] {
  const { phase } = input
  const { ladder, ...run } = input.run
  const saved = phase === 'saved'
  const board =
    saved && input.board ? (
      <ReelPlace card={input.board} compact={input.boardCompact} arrived={input.boardWaited} />
    ) : phase === 'pending' && input.boardLoading ? (
      <ReelPlaceSkeleton compact={input.boardCompact} />
    ) : null
  const side = ladder || board ? (
    <div className="reel-run__side">
      {ladder}
      {board}
    </div>
  ) : null
  const steps: ReelStep[] = [{ key: 'run', tone: 'run', body: <ReelSplit className="reel-split--run" main={<ReelRun {...run} />} side={side} /> }]
  if (phase === 'pending') steps.push({ key: 'wait', tone: 'run', body: <ReelWait slow={Boolean(input.slow)} words={input.wait} /> })
  if (phase === 'ask' && input.ask) {
    steps.push({ key: 'ask', tone: 'ask', body: <div className="reel-ask">{input.ask}</div>, goLabel: input.askGoLabel, focus: input.askFocus })
  }
  if (saved) {
    if (input.friend) steps.push({ key: 'friends', tone: 'friends', body: <ReelFriends friend={input.friend} /> })
    if (input.standings) steps.push({ key: 'standings', tone: 'standings', body: <ReelStandings card={input.standings} onSee={input.onStandings} /> })
    if (input.books?.length) steps.push({ key: 'books', tone: 'books', body: <ReelBooks lines={input.books} onSee={input.onBooks} /> })
    if (input.tickets) steps.push({ key: 'tickets', tone: 'tickets', body: input.tickets })
    if (input.season && input.season.levelUp.length) steps.push({ key: 'season', tone: 'season', body: <ReelSeason run={input.season} /> })
  }
  steps.push({
    key: 'next',
    tone: 'next',
    body: (
      <ReelNext
        recap={input.recap}
        poster={input.poster}
        block={input.block}
        blockFirst={input.blockFirst}
        primary={input.primary}
        secondary={input.secondary}
        who={input.who}
        links={input.links}
      />
    ),
  })
  return steps
}

/* ---------- the recap's figures ---------- */

/** "Lv 31": a season's level, for the recap. */
export function levelBadge(run: SeasonRun): ReelBadge {
  return { key: 'season', kind: 'season', value: `Lv ${Math.max(1, run.level)}`, label: run.added > 0 ? `Season pass +${run.added}` : 'Season pass' }
}

/** The run's place on a board, for the recap. */
export function placeBadge(line: ReportLine, key = 'place'): ReelBadge {
  return { key, kind: 'place', value: placeWords(line.value), label: line.label }
}

/** A record book's line, for the recap: the run's place in the book, and which book it is. */
export function bookBadge(line: ReportLine): ReelBadge {
  return { key: 'book', kind: 'book', value: bookPlace(line), label: line.label }
}

/**
 * A saved run's recap, from its report: its score first, then a racing daily's medal, its place on the board, the
 * record book its stamp spoke of, the tickets it paid, the standings it moved, and the pass. A phone's strip shows
 * the first four; a computer's list, all of them.
 */
export function runRecap({
  score,
  lines,
  lead = null,
  medal = null,
  tickets = 0,
  standings = null,
  season = null,
}: {
  score: { value: string; label: string; best?: boolean }
  lines: ReportLine[]
  lead?: string | null
  medal?: Medal | null
  tickets?: number
  standings?: ReportStandings | null
  season?: SeasonRun | null
}): ReelBadge[] {
  const board = lines.find((line) => line.id === 'board') ?? null
  const books = lines.filter((line) => line.id.startsWith('book-'))
  const book = books.find((line) => line.id === lead || line.tone === 'gold') ?? books[0] ?? null
  const items: ReelBadge[] = [{ key: 'score', kind: 'score', value: score.value, label: score.label, icon: score.best ? 'up' : 'target' }]
  if (medal) items.push({ key: 'medal', kind: 'medal', medal, value: MEDAL_NAMES[medal], label: 'Today’s medal' })
  if (board) items.push(placeBadge(board))
  if (book) items.push(bookBadge(book))
  if (tickets > 0) items.push({ key: 'tickets', kind: 'tickets', value: `+${tickets}`, label: tickets === 1 ? 'Ticket' : 'Tickets' })
  if (standings) items.push({ key: 'standings', kind: 'standings', value: ordinal(standings.place), label: standings.label })
  if (season) items.push(levelBadge(season))
  return items
}
