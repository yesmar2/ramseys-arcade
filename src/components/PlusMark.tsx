import type { CSSProperties } from 'react'
import { usePlusMember } from '../lib/plus'
import '../styles/plusMark.css'

/*
 * The small mark beside a Plus member's tag, wherever it shows (PlayerName): a member is seen to be one, the
 * way subscriber badges are, and it's the quietest way Plus is offered. Paying or given members only, not a
 * free week (the API's memberNames). A plain mark, not a link: names sit inside rows that are links already.
 *
 * A gold four-point star, a plus with soft points and no box (B, Sparkle, of the "Plus page redesign" canvas's
 * marks, Ramsey's pick on 2026-10-07): the plus in a gold box it was could read as an Add button beside a name.
 */
export function PlusMark({ name }: { name: string }) {
  const member = usePlusMember(name)
  if (!member) return null
  return (
    <span className="plus-mark" title="Plus member" aria-label="Plus member" role="img">
      <PlusSparkle />
    </span>
  )
}

function PlusSparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0.8C12.9 7.6 16.4 11.1 23.2 12C16.4 12.9 12.9 16.4 12 23.2C11.1 16.4 7.6 12.9 0.8 12C7.6 11.1 11.1 7.6 12 0.8Z" />
    </svg>
  )
}

/** The mark on its own, as an icon: the menu's Plus row, and the Plus page at any `size` (a CSS length). */
export function PlusGlyph({ size }: { size?: string }) {
  return (
    <span className="plus-mark plus-mark--icon" aria-hidden="true" style={size ? ({ '--plus-mark-size': size } as CSSProperties) : undefined}>
      <PlusSparkle />
    </span>
  )
}
