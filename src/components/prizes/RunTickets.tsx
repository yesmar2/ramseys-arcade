import { getGame } from '../../data/games'
import { prizeById } from '../../data/prizes'
import { prizesHref } from '../../hooks/useHashRoute'
import { scoreText } from '../../lib/gameBoard'
import { formatLeaderboardScore, isPercentBoard, isTimeBoard } from '../../lib/leaderboardFormat'
import { useTickets, type LadderStep, type RunTickets } from '../../lib/tickets'
import { TicketGlyph, TicketStub } from './Ticket'

/*
 * What a run paid in tickets, at the foot of its report: the ticket, what
 * made it up, the new total, and how far that goes toward the prize being
 * saved for. Signed out, the same place says a saved run pays them.
 */

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

function why(paid: RunTickets, game: string): string {
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
  else if (paid.next) parts.push(`next: ${nextWords(paid.next, game)}`)
  return parts.join(' · ')
}

/** The run's tickets, once the save has answered. */
export function RunTicketsLine({ paid, game }: { paid: RunTickets; game: string }) {
  const { goal: goalId, balance } = useTickets()
  const goal = prizeById(goalId)
  // The store may not have caught up with this save yet; the save's own answer is the newer.
  const total = Math.max(balance, paid.balance)
  const toGo = goal ? Math.max(0, goal.price - total) : 0
  if (paid.earned <= 0) {
    // A daily's best step of the day is paid once; a run that didn't climb one pays nothing more.
    const said =
      paid.capped > 0 || paid.paidBefore <= 0
        ? 'Today’s run tickets are all in. Tomorrow’s runs pay again.'
        : paid.next
          ? `Today’s best already got its tickets. Next: ${nextWords(paid.next, game)}.`
          : 'You’ve got every ticket today’s best can pay.'
    return (
      <div className="run-tix run-tix--dim">
        <TicketStub label="0" dim width={78} />
        <div className="run-tix__body">
          <span className="run-tix__n">No new tickets</span>
          <span className="run-tix__why">{said}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="run-tix">
      <TicketStub amount={paid.earned} fan={paid.earned >= 15 ? 2 : paid.earned >= 8 ? 1 : 0} width={84} />
      <div className="run-tix__body">
        <div className="run-tix__top">
          <span className="run-tix__n">{paid.earned === 1 ? '1 ticket' : `${paid.earned} tickets`}</span>
          <span className="run-tix__total" aria-label={`${total.toLocaleString()} tickets in all`}>
            <TicketGlyph size={16} />
            {total.toLocaleString()}
          </span>
        </div>
        <span className="run-tix__why">{why(paid, game)}</span>
        {goal ? (
          <a className="run-tix__goal" href={prizesHref()}>
            <span className="tix-meter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (100 * total) / goal.price)}%` }} />
            </span>
            {toGo > 0 ? `${toGo.toLocaleString()} to ${goal.name}` : `${goal.name} is yours to trade for`}
          </a>
        ) : (
          <a className="run-tix__goal" href={prizesHref()}>
            Spend them at the prize counter ›
          </a>
        )}
      </div>
    </div>
  )
}

/** Signed out: a saved run pays tickets too, and so does each run kept on the device for the sign-in (lib/pendingRuns.ts). */
export function RunTicketsWaiting({ runs = 1 }: { runs?: number }) {
  return (
    <div className="run-tix run-tix--dim">
      <TicketStub label="?" dim width={78} />
      <div className="run-tix__body">
        <span className="run-tix__n">Tickets waiting</span>
        <span className="run-tix__why">
          Sign in and {runs > 1 ? `these ${runs} runs pay` : 'this run pays'} tickets for the prize counter. They’re kept on your account.
        </span>
      </div>
    </div>
  )
}
