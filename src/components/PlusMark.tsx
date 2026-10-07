import type { CSSProperties } from 'react'
import { usePlusMember } from '../lib/plus'
import '../styles/plusMark.css'

/*
 * The small mark beside a Plus member's tag, wherever it shows (PlayerName): a member is seen to be one, the
 * way subscriber badges are, and it's the quietest way Plus is offered. Paying or given members only, not a
 * free week (the API's memberNames). A plain mark, not a link: names sit inside rows that are links already.
 */
export function PlusMark({ name }: { name: string }) {
  const member = usePlusMember(name)
  if (!member) return null
  return (
    <span className="plus-mark" title="Plus member" aria-label="Plus member" role="img">
      <PlusCross />
    </span>
  )
}

function PlusCross() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 2.2v7.6M2.2 6h7.6" />
    </svg>
  )
}

/** The mark on its own, as an icon: the menu's Plus row, and the Plus page at any `size` (a CSS length). */
export function PlusGlyph({ size }: { size?: string }) {
  return (
    <span className="plus-mark plus-mark--icon" aria-hidden="true" style={size ? ({ '--plus-mark-size': size } as CSSProperties) : undefined}>
      <PlusCross />
    </span>
  )
}
