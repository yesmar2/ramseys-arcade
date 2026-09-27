import { wornPrizeOf } from '../lib/avatars'
import { nameStyleClass } from '../lib/nameStyle'

/*
 * A tag as it shows on a board, in the name style its owner wears from the
 * prize counter (Outline, Retro, Pixel, Glitch, Candy, Neon or Ember), read
 * off the avatar string every row already carries. Styles are in
 * styles/prizes.css.
 */

export function PlayerName({
  name,
  avatarId,
  style,
  className,
}: {
  name: string
  /** The row's avatar string, which carries the name style worn. */
  avatarId?: string | null
  /** A style to show instead, for a preview (null for none). */
  style?: string | null
  className?: string
}) {
  const worn = style !== undefined ? style : wornPrizeOf(avatarId, 'name')
  const cls = [className, nameStyleClass(worn)].filter(Boolean).join(' ')
  return <span className={cls || undefined}>{name}</span>
}
