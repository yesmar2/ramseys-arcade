import { useId } from 'react'
import { sparkle, ticketPath } from '../../lib/prizeArt'

/*
 * The prize ticket, the arcade's own: a short orange strip with a notch cut in
 * each end, a tear line and a star. Small for the header's chip and prices,
 * big with "+n" on it for what a run paid. Kept apart from the counter's
 * other drawings so the header doesn't carry them.
 */

const FONT = 'Outfit, system-ui, sans-serif'

/** The prize ticket, small: for the header's chip, prices and counts. */
export function TicketGlyph({ size = 18, className, dim = false }: { size?: number; className?: string; dim?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 16" width={size} height={(size * 16) / 24} aria-hidden="true" focusable="false">
      <path d={ticketPath(0.5, 0.5, 23, 15, 2.6, 2.2)} fill={dim ? '#6b7a88' : '#ff8552'} />
      <path d="M7.5 3.2V12.8" stroke="#3a1406" strokeWidth="1.3" strokeDasharray="1.5 1.6" opacity="0.5" />
      <path d={sparkle(15.6, 8, 3.3)} fill="#3a1406" opacity="0.55" />
    </svg>
  )
}

/** The ticket a run pays out, with "+n" on it (or `label`); a big payout comes out in a strip of them. */
export function TicketStub({
  amount = 0,
  label,
  fan = 0,
  dim = false,
  width = 104,
}: {
  amount?: number
  label?: string
  fan?: number
  dim?: boolean
  width?: number
}) {
  const id = `stub${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const ink = dim ? '#1d2833' : '#3a1406'
  const behind = Array.from({ length: fan }, (_, i) => fan - i)
  return (
    <svg viewBox="0 0 120 84" width={width} height={(width * 84) / 120} aria-hidden="true" focusable="false" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dim ? '#6b7a88' : '#ffa477'} />
          <stop offset="1" stopColor={dim ? '#566572' : '#ff7a45'} />
        </linearGradient>
      </defs>
      {behind.map((k) => (
        <g key={k} transform={`translate(${12 - 5 * k} ${12 - 3 * k}) rotate(${-9 * k} 48 30)`} opacity={1 - 0.22 * k}>
          <path d={ticketPath(0, 0, 96, 60, 7, 6)} fill="#e0602e" />
        </g>
      ))}
      <g transform="translate(12 12)">
        <path d={ticketPath(0, 0, 96, 60, 7, 6)} fill={`url(#${id})`} />
        <path d="M24 7V53" stroke={ink} strokeWidth="1.6" strokeDasharray="3 3" opacity="0.4" />
        <path d={sparkle(12, 30, 5)} fill={ink} opacity="0.5" />
        <text x="60" y="36" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="25" fill={ink}>
          {label ?? `+${amount}`}
        </text>
        <text x="60" y="50" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="8.5" letterSpacing="1.6" fill={ink} opacity="0.75">
          TICKETS
        </text>
      </g>
    </svg>
  )
}
