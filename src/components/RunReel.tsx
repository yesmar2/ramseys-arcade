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
import type { ReportFriend, ReportIcon, ReportLine, ReportMetal, ReportRace, ReportRibbon, ReportTier, ReportTone } from '../lib/runReport'
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
 * on the boards, the tickets it paid, a level it reached on the season's pass; then what next: the run's figure and
 * what it won as round badges, over a dock at the foot of the screen with Play again (Ramsey picked C, "Badges and
 * a dock", from the "What next screen" canvas). Signed out, the step after the run asks for the sign-in; signed
 * in without a tag, for the tag. Skip, top right, goes straight to the last step, and Esc back to the game as Play
 * again does.
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
  /** The last step's dock, held at the foot of the screen in place of the way on: Play again and the rest. */
  dock?: ReactNode
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
  const dockRef = useRef<HTMLDivElement>(null)
  const allow: Press = (e) => deliberate(e) && performance.now() - changedAt.current > 350
  const goTo = (i: number) => {
    const next = steps[i]
    if (!next || i === index) return
    changedAt.current = performance.now()
    setAt({ key: next.key, index: i })
  }

  // Focus follows the steps: the way on, a step's own field, and on the last step, Play again (or the link that
  // stands in for it, an event's standings once its tries are spent). A step opens at its top.
  useEffect(() => {
    if (stageRef.current) stageRef.current.scrollTop = 0
    const target =
      step.focus?.current ??
      (last
        ? (primaryRef?.current ??
          dockRef.current?.querySelector<HTMLElement>('.reel-btn') ??
          stageRef.current?.querySelector<HTMLElement>('.reel-btn'))
        : goRef.current)
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
        {last ? (
          step.dock ? (
            <div ref={dockRef} className="reel__dock">
              {step.dock}
            </div>
          ) : null
        ) : (
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
      </ReelPress.Provider>
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

/**
 * Where the run landed: its place on the board as big as the score was (the board's line, or what else it did
 * when it has no board), the podium when it climbed onto it, the friend it went past face to face, and the rest of
 * what it did in rows. An event's run makes much of its own line instead: its place in the event, or its match.
 */
export function ReelLanded({
  lines,
  race = null,
  friend = null,
  hero: heroId = 'board',
  onBoard,
  boardLabel = 'See the board',
}: {
  lines: ReportLine[]
  race?: ReportRace | null
  friend?: ReportFriend | null
  /** The line to make much of, by its id. */
  hero?: string
  onBoard?: () => void
  boardLabel?: string
}) {
  const allow = useContext(ReelPress)
  const hero = lines.find((l) => l.id === heroId) ?? lines[0] ?? null
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
          {boardLabel} ›
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

/**
 * A badge on the last step (Ramsey picked C, "Badges and a dock", from the "What next screen" canvas): one thing
 * the run won, round, with what it is under it.
 */
export type ReelBadge = {
  key: string
  kind: 'medal' | 'place' | 'best' | 'book' | 'tickets' | 'season' | 'tries' | 'won'
  value: string
  label: string
  /** A medal badge's metal. */
  medal?: Medal
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
    case 'medal':
      return badge.medal ? <MedalIcon medal={badge.medal} size={44} /> : null
    case 'place':
      return <ReportIconSvg icon={badge.value === '1st' ? 'crown' : 'board'} />
    case 'won':
      return <ReportIconSvg icon="crown" />
    case 'best':
      return <ReportIconSvg icon="up" />
    case 'book':
      return <ReportIconSvg icon="book" />
    case 'tickets':
      return <TicketGlyph size={36} />
    case 'season':
      return <StrokeIcon d={HEX_PATH} />
    case 'tries':
      return <StrokeIcon d={AGAIN_PATH} />
  }
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

/** The run's figure on the last step, as big as there's room for, under its own words (Run over, Today's Cave #2). */
export type ReelScore = { kicker: string; value: string; unit: string; note?: string | null }

/**
 * What next, over the dock: the run's figure, what it won as round badges, a friend it went past, and what the
 * moment asks (the next daily, an alert, a sign-in).
 */
export function ReelNext({ score, badges, callout, block }: { score: ReelScore; badges: ReelBadge[]; callout?: ReactNode; block?: ReactNode }) {
  return (
    <div className="reel-next">
      <div className="reel-next__score">
        <p className="reel__kick">{score.kicker}</p>
        <p className="reel-next__figure">
          {score.value}
          {score.unit ? <span className="reel-next__unit">{score.unit}</span> : null}
        </p>
        {score.note ? <p className="reel-next__note">{score.note}</p> : null}
      </div>
      {badges.length ? (
        <ul className={`reel-badges reel-badges--${badges.length}`} aria-label="That run">
          {badges.map((badge, i) => (
            <li
              key={badge.key}
              className={`reel-badge reel-badge--${badge.kind}${badge.medal ? ` reel-badge--${badge.medal}` : ''}`}
              style={{ '--i': i } as CSSProperties}
            >
              <span className="reel-badge__disc">
                <BadgeIcon badge={badge} />
              </span>
              <span className="reel-badge__value">{badge.value}</span>
              <span className="reel-badge__label">{badge.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {callout}
      {block ? <div className="reel-next__block">{block}</div> : null}
    </div>
  )
}

/** A friend the run went past: who, by how much, and the way to send them the run to take it back. */
export function ReelFriend({ friend, action }: { friend: ReportFriend; action: ReportAction }) {
  const allow = useContext(ReelPress)
  const { them, gap } = friend
  return (
    <div className="reel-friend">
      <PlayerAvatar name={them.name} avatarId={them.avatarId} size="md" className="reel-friend__face" />
      <span className="reel-friend__text">
        <span className="reel-friend__kick">You passed {them.name}</span>
        <span className="reel-friend__gap">You’re {gap} ahead</span>
      </span>
      <button
        type="button"
        className="reel-friend__send"
        disabled={action.disabled}
        onClick={(e) => {
          if (allow(e)) action.onClick?.()
        }}
      >
        {action.label}
      </button>
    </div>
  )
}

/** One of the dock's ways on, under Play again: its icon over its words. */
export type ReelTile = { key: string; label: string; icon: ReportIcon; onClick?: () => void; href?: string; disabled?: boolean }

/** The dock at the foot of the last step: who it's saved as, Play again, and the other ways on as tiles. */
export function ReelDock({ primary, tiles, who }: { primary: ReportAction; tiles: ReelTile[]; who?: ReactNode }) {
  const allow = useContext(ReelPress)
  return (
    <div className="reel-dock">
      {who ? (
        <p className="reel-dock__who">
          <span className="report__who">{who}</span>
        </p>
      ) : null}
      <ReelButton action={primary} />
      {tiles.length ? (
        <div className={`reel-tiles reel-tiles--${tiles.length}`}>
          {tiles.map((tile) =>
            tile.href ? (
              <a
                key={tile.key}
                className="reel-tile"
                href={tile.href}
                onClick={(e) => {
                  if (!allow(e)) e.preventDefault()
                }}
              >
                <ReportIconSvg icon={tile.icon} />
                {tile.label}
              </a>
            ) : (
              <button
                key={tile.key}
                type="button"
                className="reel-tile"
                disabled={tile.disabled}
                onClick={(e) => {
                  if (allow(e)) tile.onClick?.()
                }}
              >
                <ReportIconSvg icon={tile.icon} />
                {tile.label}
              </button>
            ),
          )}
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
  /** How the wait says it, when it isn't a save: an event's post. */
  wait?: ReelWaitWords
  run: ReelRunProps
  /** What the run did on the boards and in the books, once it's saved. */
  lines: ReportLine[]
  /** The line Where it landed makes much of, by its id: the board's, unless said. */
  landedHero?: string
  race?: ReportRace | null
  friend?: ReportFriend | null
  onBoard?: () => void
  /** What the way to the board says: "See the standings" for an event. */
  boardLabel?: string
  /** The tickets step's body (ReelTickets), when the run paid some. */
  tickets?: ReactNode
  /** The season's pass, when the run moved it. */
  season?: SeasonRun | null
  /** The step after the run when the save waits on something: the sign-in, or a tag. */
  ask?: ReactNode
  askGoLabel?: string
  askFocus?: RefObject<HTMLElement | null>
  /** The last step's badges: what the run won, most telling first, four at most. */
  badges: ReelBadge[]
  /** Under the score on the last step, when the run won nothing louder: how far it was off the best. */
  note?: string | null
  /** Under the badges: a friend the run went past, with the way to send them the run (ReelFriend). */
  callout?: ReactNode
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
  if (phase === 'pending') steps.push({ key: 'wait', tone: 'run', body: <ReelWait slow={Boolean(input.slow)} words={input.wait} /> })
  if (phase === 'ask' && input.ask) {
    steps.push({ key: 'ask', tone: 'ask', body: <div className="reel-ask">{input.ask}</div>, goLabel: input.askGoLabel, focus: input.askFocus })
  }
  if (phase === 'saved') {
    const moment = run.tier !== 'quiet' || Boolean(input.friend) || Boolean(input.race)
    if (moment && (input.lines.length || input.race || input.friend)) {
      steps.push({
        key: 'landed',
        tone: 'boards',
        body: (
          <ReelLanded
            lines={input.lines}
            race={input.race}
            friend={input.friend}
            hero={input.landedHero}
            onBoard={input.onBoard}
            boardLabel={input.boardLabel}
          />
        ),
      })
    }
    if (input.tickets) steps.push({ key: 'tickets', tone: 'tickets', body: input.tickets })
    if (input.season && input.season.levelUp.length) steps.push({ key: 'season', tone: 'season', body: <ReelSeason run={input.season} /> })
  }
  // The dock's tiles: the way to send the run on, then the board, the records, a share.
  const secondary = input.secondary ?? null
  const tiles: ReelTile[] = [
    ...(secondary
      ? [
          {
            key: 'secondary',
            label: secondary.shortLabel ?? secondary.label,
            icon: secondary.icon ?? 'share',
            onClick: secondary.onClick,
            href: secondary.href,
            disabled: secondary.disabled,
          },
        ]
      : []),
    ...(input.links ?? []).map((link, i) => ({ key: `link-${i}`, label: link.label, icon: link.icon ?? 'board', onClick: link.onClick })),
  ].slice(0, 4)
  steps.push({
    key: 'next',
    tone: 'next',
    body: (
      <ReelNext
        score={{ kicker: run.eyebrow, value: run.score, unit: run.unit, note: input.note }}
        badges={input.badges}
        callout={input.callout}
        block={input.block}
      />
    ),
    dock: <ReelDock primary={input.primary} tiles={tiles} who={input.who} />,
  })
  return steps
}

/** "Lv 31": a season's level, as a badge. */
export function levelBadge(run: SeasonRun): ReelBadge {
  return { key: 'season', kind: 'season', value: `Lv ${Math.max(1, run.level)}`, label: 'season pass' }
}

/** The run's place on a board, as a badge: the board's words without the game's name, which is over the reel. */
export function placeBadge(line: ReportLine, game: string, key = 'place'): ReelBadge {
  const label = line.label.startsWith(`${game} `) ? line.label.slice(game.length + 1) : line.label
  return { key, kind: 'place', value: placeWords(line.value), label }
}

/** A record book's line, as a badge: the run's place in the book, and which book it is. */
export function bookBadge(line: ReportLine): ReelBadge {
  return { key: 'book', kind: 'book', value: line.rank === 1 ? 'Record' : line.rank != null ? ordinal(line.rank) : 'In it', label: line.label }
}

/** The order badges read in, whichever four a run shows. */
const BADGE_ORDER: ReelBadge['kind'][] = ['won', 'medal', 'best', 'place', 'book', 'tickets', 'tries', 'season']

/**
 * A saved run's badges, from its report: a racing daily's medal, a new best, its place on the board, the record book
 * its stamp spoke of, the tickets it paid, and the pass. The four that say most, then in reading order. Each is
 * said once: the stamp's "1st today" isn't said again beside the place's 1st.
 */
export function runBadges({
  lines,
  lead = null,
  game,
  medal = null,
  tickets = 0,
  season = null,
  race = false,
}: {
  lines: ReportLine[]
  lead?: string | null
  game: string
  medal?: Medal | null
  tickets?: number
  season?: SeasonRun | null
  race?: boolean
}): ReelBadge[] {
  const board = lines.find((line) => line.id === 'board') ?? null
  const book = lines.find((line) => line.id.startsWith('book-') && (line.id === lead || line.tone === 'gold')) ?? null
  const best = lines.find((line) => line.id === 'best' && line.tone === 'accent') ?? null
  const picked: ReelBadge[] = []
  if (medal) picked.push({ key: 'medal', kind: 'medal', medal, value: MEDAL_NAMES[medal], label: 'today’s medal' })
  if (board) picked.push(placeBadge(board, game))
  if (book) picked.push(bookBadge(book))
  if (tickets > 0) picked.push({ key: 'tickets', kind: 'tickets', value: `+${tickets}`, label: tickets === 1 ? 'ticket' : 'tickets' })
  // A racing daily's best is its medal's and its time's to say.
  if (best && !race) picked.push({ key: 'best', kind: 'best', value: 'Best', label: (best.detail ?? '').replace(/ (on|than) .*$/, '') || 'new best' })
  if (season) picked.push(levelBadge(season))
  return picked.slice(0, 4).sort((a, b) => BADGE_ORDER.indexOf(a.kind) - BADGE_ORDER.indexOf(b.kind))
}
