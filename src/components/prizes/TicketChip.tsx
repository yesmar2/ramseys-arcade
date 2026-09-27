import { prizesHref } from '../../hooks/useHashRoute'
import { useTickets } from '../../lib/tickets'
import { TicketGlyph } from './Ticket'

/** Your tickets in the header, and the way to the prize counter. */
export function TicketChip({ here }: { here: boolean }) {
  const { balance, loaded } = useTickets()
  const label = loaded ? `${balance.toLocaleString()} ${balance === 1 ? 'ticket' : 'tickets'}: the prize counter` : 'Your tickets: the prize counter'
  return (
    <a
      className={`tix-chip${here ? ' tix-chip--here' : ''}`}
      href={prizesHref()}
      aria-current={here ? 'page' : undefined}
      aria-label={label}
      title={label}
    >
      <TicketGlyph size={20} />
      <span className="tix-chip__n">{loaded ? balance.toLocaleString() : '…'}</span>
    </a>
  )
}
