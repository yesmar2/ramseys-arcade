import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getGame } from '../../data/games'
import { prizeById } from '../../data/prizes'
import { prizesHref } from '../../hooks/useHashRoute'
import { scoreText } from '../../lib/gameBoard'
import { formatLeaderboardScore, isPercentBoard, isTimeBoard } from '../../lib/leaderboardFormat'
import { sparkle, ticketPath } from '../../lib/prizeArt'
import { sfx } from '../../lib/sound'
import { useTickets, type LadderStep, type RunTickets } from '../../lib/tickets'
import { TicketGlyph, TicketStub } from './Ticket'

/*
 * What a run paid in tickets, at the foot of its report: the ticket, what
 * made it up, the new total, and how far that goes toward the prize being
 * saved for. Signed out, the same place says a saved run pays them.
 *
 * The tickets come out as an arcade's do, as Ramsey asked (2026-10-01): a
 * strip fed out of a slot, a click a ticket, counted as it comes, then torn
 * off into the run's ticket while the total rolls up. A tap skips to the end,
 * and with reduced motion the box is simply there.
 */

/** A ticket of the strip on screen, wide and high: the strip is this picture over and over. */
const PITCH = 46
const STRIP_HIGH = 29
/** The longest a payout feeds for, however big; past 40 tickets each step feeds more than one. */
const FEED_MS = 1500
const MOST_STEPS = 40

const STRIP_TICKET = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 60'><path d='${ticketPath(0, 0, 96, 60, 7, 6)}' fill='#ff8a55'/>` +
    `<path d='M24 7V53' stroke='#3a1406' stroke-width='2.4' stroke-dasharray='4 4' opacity='0.4'/>` +
    `<path d='${sparkle(12, 30, 5.5)}' fill='#3a1406' opacity='0.5'/></svg>`,
)}")`

const motionOk = () => typeof matchMedia !== 'function' || !matchMedia('(prefers-reduced-motion: reduce)').matches

/** A step as the ladder says it: a daily's in words, the rest by the score it takes. */
function stepWords(step: LadderStep, game: string): string {
  return step.label ?? `${scoreText(game, step.at)} or better`
}

/** The next step up, to aim for: Hot Lap's with the time it takes, Half Full's with the figure (Steady Hand, 92.0%). */
function nextWords(next: LadderStep, game: string): string {
  if (!next.label) return `${next.tickets} at ${scoreText(game, next.at)}`
  const figure = isTimeBoard(game) || isPercentBoard(game)
  return `${next.tickets} for ${next.label}${figure ? ` (${formatLeaderboardScore(game, next.at)})` : ''}`
}

/** What the tickets were for; `withNext`, and the next step's, unless the run's medal already says it. */
function why(paid: RunTickets, game: string, withNext = true): string {
  const parts: string[] = []
  for (const line of paid.lines) {
    switch (line.reason) {
      case 'run': {
        const what = paid.reached ? stepWords(paid.reached, game) : (paid.baseLabel ?? 'the run')
        // A daily pays its best step of the day once, a climb only the difference: said as what it reached.
        parts.push(`${line.amount} for ${what}`)
        break
      }
      case 'best':
        parts.push(`${line.amount} for a new best`)
        break
      case 'pickup':
        parts.push(`${line.amount} picked up`)
        break
      case 'first':
        parts.push(`${line.amount} for your first go at ${getGame(game)?.name ?? 'this game'}`)
        break
      case 'streak':
        parts.push(`${line.amount} for another day on your streak`)
        break
      default:
        parts.push(`${line.amount} more`)
    }
  }
  if (paid.capped > 0) parts.push('today’s run tickets are all in')
  else if (paid.next && withNext) parts.push(`next: ${nextWords(paid.next, game)}`)
  return parts.join(' · ')
}

/**
 * The run's tickets, once the save has answered. A racing daily's `medal` (RaceMedal RunMedalLine) goes in the
 * same box and says what's next, from the day's best; the tickets then don't say it again, so the two never
 * disagree. A run that paid nothing is a quiet line, not a box (Ramsey, 2026-10-05: the report was "a lot").
 */
export function RunTicketsLine({ paid, game, medal = null }: { paid: RunTickets; game: string; medal?: ReactNode }) {
  const { goal: goalId, balance } = useTickets()
  const goal = prizeById(goalId)
  // The store may not have caught up with this save yet; the save's own answer is the newer.
  const total = Math.max(balance, paid.balance)
  const toGo = goal ? Math.max(0, goal.price - total) : 0
  const payout = usePayout(paid.earned, total, goal?.price ?? null)
  if (paid.earned <= 0) {
    // A daily's best step of the day is paid once; a run that didn't climb one pays nothing more.
    const said =
      paid.capped > 0 || paid.paidBefore <= 0
        ? 'Today’s run tickets are all in. Tomorrow’s runs pay again.'
        : medal
          ? 'Today’s best already got them.'
          : paid.next
            ? `Today’s best already got them. Next: ${nextWords(paid.next, game)}.`
            : 'You’ve got every ticket today’s best can pay.'
    return (
      <div className="run-tix-quiet">
        {medal}
        <p className="run-tix-quiet__line">
          <span className="run-tix-quiet__icon">
            <TicketGlyph size={16} dim />
          </span>
          <span>
            <b>No new tickets.</b> {said}
          </span>
        </p>
      </div>
    )
  }
  const { stage } = payout
  return (
    <div
      className={`run-tix${stage === 'feeding' ? ' run-tix--feeding' : stage === 'out' ? ' run-tix--out' : ''}`}
      onClick={stage === 'feeding' ? payout.skip : undefined}
    >
      <TicketStub amount={paid.earned} fan={paid.earned >= 15 ? 2 : paid.earned >= 8 ? 1 : 0} width={84} />
      <div className="run-tix__body">
        <div className="run-tix__top">
          <span className="run-tix__n">{paid.earned === 1 ? '1 ticket' : `${paid.earned} tickets`}</span>
          <span className="run-tix__total" aria-label={`${total.toLocaleString()} tickets in all`}>
            <TicketGlyph size={16} />
            <span ref={payout.sumRef}>{total.toLocaleString()}</span>
          </span>
        </div>
        <span className="run-tix__why">{why(paid, game, !medal)}</span>
        {medal}
        {goal ? (
          <a className="run-tix__goal" href={prizesHref()}>
            <span className="tix-meter" aria-hidden="true">
              <i ref={payout.meterRef} style={{ width: `${Math.min(100, (100 * total) / goal.price)}%` }} />
            </span>
            {toGo > 0 ? `${toGo.toLocaleString()} to ${goal.name}` : `${goal.name} is yours to trade for`}
          </a>
        ) : (
          <a className="run-tix__goal" href={prizesHref()}>
            Spend them at the prize counter ›
          </a>
        )}
      </div>
      {stage === 'feeding' ? (
        <div className="run-tix__feed" aria-hidden="true">
          <span className="run-tix__mouth">
            <span
              ref={payout.stripRef}
              className="run-tix__strip"
              style={{ width: paid.earned * PITCH, height: STRIP_HIGH, backgroundImage: STRIP_TICKET, backgroundSize: `${PITCH}px ${STRIP_HIGH}px` }}
            />
          </span>
          <span ref={payout.slotRef} className="run-tix__slot" />
          <b ref={payout.countRef} className="run-tix__count">
            +0
          </b>
        </div>
      ) : null}
    </div>
  )
}

type Stage = 'feeding' | 'out' | 'still'

/**
 * The payout: the strip fed out of the slot a step at a time, each step a quick shove that stops short, as
 * a dispenser's motor does, the count going up with it; then the strip torn off, the run's ticket and its
 * words shown, and the total rolled up from what it was. Runs once, when the box first shows.
 */
function usePayout(earned: number, total: number, price: number | null) {
  const [stage, setStage] = useState<Stage>(() => (earned > 0 && motionOk() ? 'feeding' : 'still'))
  const stripRef = useRef<HTMLSpanElement>(null)
  const slotRef = useRef<HTMLSpanElement>(null)
  const countRef = useRef<HTMLElement>(null)
  const sumRef = useRef<HTMLSpanElement>(null)
  const meterRef = useRef<HTMLElement>(null)
  // The total and the prize's price as they are when the roll ends: the store may catch up meanwhile.
  const latest = useRef({ total, price })
  latest.current = { total, price }
  const skipRef = useRef(() => {})

  useEffect(() => {
    if (stage !== 'feeding') return
    const timers: number[] = []
    let frame = 0
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))
    const showSum = (value: number) => {
      const { price: p } = latest.current
      if (sumRef.current) sumRef.current.textContent = value.toLocaleString()
      if (meterRef.current && p) meterRef.current.style.width = `${Math.min(100, (100 * value) / p)}%`
    }
    const steps = Math.min(earned, MOST_STEPS)
    const dt = Math.max(38, Math.min(150, FEED_MS / steps))
    const outAfter = (k: number) => Math.round((earned * k) / steps)
    let step = 0
    let clicked = 0

    const feed = () => {
      const strip = stripRef.current
      const count = countRef.current
      if (!strip || !count) return
      step += 1
      const from = outAfter(step - 1)
      const to = outAfter(step)
      strip.animate([{ transform: `translate(${from * PITCH}px, -50%)` }, { transform: `translate(${to * PITCH}px, -50%)` }], {
        duration: dt * 0.72,
        easing: 'cubic-bezier(0.25, 0.9, 0.3, 1)',
        fill: 'forwards',
      })
      slotRef.current?.animate([{ filter: 'brightness(1.9)' }, { filter: 'none' }], { duration: Math.max(90, dt) })
      count.textContent = `+${to}`
      count.animate([{ transform: 'scale(1.16)' }, { transform: 'none' }], { duration: 150 })
      // A click a ticket, but no closer than a fifteenth of a second: a big payout chatters rather than buzzes.
      const now = performance.now()
      if (now - clicked > 66 || step === steps) {
        sfx('click', 1)
        clicked = now
      }
      if (step < steps) later(feed, dt)
      else later(tear, 320)
    }
    // Torn off: the strip pulled away out of the box, and the run's ticket and words in its place.
    const tear = () => {
      stripRef.current?.animate(
        [
          { transform: `translate(${earned * PITCH}px, -50%)`, opacity: 1 },
          { transform: `translate(${earned * PITCH + 70}px, -50%)`, opacity: 0 },
        ],
        { duration: 280, easing: 'ease-in', fill: 'forwards' },
      )
      later(roll, 260)
    }
    const roll = () => {
      setStage('out')
      const start = latest.current.total - earned
      showSum(start)
      const t0 = performance.now()
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / 650)
        showSum(Math.round(start + (latest.current.total - start) * (1 - (1 - k) ** 3)))
        if (k < 1) frame = requestAnimationFrame(tick)
        else sfx('good')
      }
      frame = requestAnimationFrame(tick)
    }
    skipRef.current = () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(frame)
      showSum(latest.current.total)
      setStage('still')
    }
    later(feed, 450)
    return () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(frame)
    }
    // Once, as the box first shows: the payout doesn't run again for a later look at the same report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { stage, stripRef, slotRef, countRef, sumRef, meterRef, skip: () => skipRef.current() }
}

/**
 * Signed out: a saved run pays tickets too, and so does each run kept on the device for the sign-in
 * (lib/pendingRuns.ts). A racing daily's `medal` goes in the same box.
 */
export function RunTicketsWaiting({ runs = 1, medal = null }: { runs?: number; medal?: ReactNode }) {
  return (
    <div className="run-tix run-tix--dim">
      <TicketStub label="?" dim width={78} />
      <div className="run-tix__body">
        <span className="run-tix__n">Tickets waiting</span>
        <span className="run-tix__why">
          Sign in and {runs > 1 ? `these ${runs} runs pay` : 'this run pays'} tickets for the prize counter. They’re kept on your account.
        </span>
        {medal}
      </div>
    </div>
  )
}
