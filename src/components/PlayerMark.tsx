import type { ReactNode } from 'react'
import { AVATARS_ENABLED } from '../lib/avatars'
import { PlayerAvatar } from './PlayerAvatar'

/**
 * A player's mark: their avatar when avatars are on, otherwise the first
 * letter of their tag on a tinted tile — the same tile the profile hero and
 * the drawer use, so a player looks the same everywhere they appear.
 */
export function PlayerMark({
  name,
  avatarId,
  badge,
  className = '',
}: {
  name: string
  avatarId?: string | null
  /** Something to pin to the corner, e.g. a medal. */
  badge?: ReactNode
  className?: string
}) {
  return (
    <span className={`pmark${className ? ` ${className}` : ''}`} aria-hidden="true">
      {AVATARS_ENABLED ? (
        <PlayerAvatar avatarId={avatarId} name={name} size="md" />
      ) : (
        name.charAt(0)
      )}
      {badge ? <span className="pmark__badge">{badge}</span> : null}
    </span>
  )
}
