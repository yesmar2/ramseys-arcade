import { inviteTargetHref, type PublicInvite } from '../lib/invites'
import { usePendingInvites } from '../hooks/usePendingInvites'

type PendingInvitesStripProps = {
  /** Limit to one kind on a list page, or show all in the header panel. */
  kind?: 'group' | 'tournament'
  compact?: boolean
  className?: string
}

function kindLabel(invite: PublicInvite) {
  return invite.kind === 'group' ? 'Group' : 'Event'
}

export function PendingInvitesStrip({
  kind,
  compact = false,
  className = '',
}: PendingInvitesStripProps) {
  const { invites, error, busyId, accept, decline, playerName } = usePendingInvites()
  const rows = kind ? invites.filter((i) => i.kind === kind) : invites

  if (!playerName || rows.length === 0) return null

  return (
    <section
      className={`pending-invites${compact ? ' pending-invites--compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Pending invites"
    >
      {!compact ? <h2 className="pending-invites__title">Invites for you</h2> : null}
      {error ? <p className="tour-note tour-note--error">{error}</p> : null}
      <ul className="pending-invites__list">
        {rows.map((invite) => {
          const busy = busyId === invite.id
          return (
            <li key={invite.id} className="pending-invites__row">
              <div className="pending-invites__copy">
                <strong className="pending-invites__name">{invite.targetName}</strong>
                <span className="pending-invites__meta">
                  {kindLabel(invite)}
                  {invite.fromName ? ` · from ${invite.fromName}` : ''}
                </span>
              </div>
              <div className="pending-invites__actions">
                <button
                  type="button"
                  className="event-list__create"
                  disabled={busy}
                  onClick={() => {
                    void accept(invite.id).then((result) => {
                      if (!result) return
                      window.location.hash = inviteTargetHref(invite)
                    })
                  }}
                >
                  {busy ? '…' : 'Accept'}
                </button>
                <button
                  type="button"
                  className="group-text-btn"
                  disabled={busy}
                  onClick={() => void decline(invite.id)}
                >
                  Decline
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
