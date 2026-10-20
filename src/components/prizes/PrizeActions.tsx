import { useState, type ReactNode } from 'react'
import { TICKETS_A_DAY, type Prize } from '../../data/prizes'
import { useAuth } from '../../hooks/useAuth'
import { encodeAvatar, isWearing, setLocalAvatarId, wearPrize, type Avatar } from '../../lib/avatars'
import { setPlayerAvatar } from '../../lib/leaderboard'
import { setTicketGoal, tradePrize, useTickets } from '../../lib/tickets'
import { openSiteMenu } from '../siteNav'
import { TicketGlyph } from './Ticket'

/*
 * What can be done with one prize, and where the player stands with it: trade for it (once they've said yes),
 * save for it, wear it or take it off. The prize's sheet (PrizePanel) and the counter's fitting room both use
 * it; key it by the prize's id, so a pick of another starts afresh.
 */

function errorText(err: unknown): string {
  const code = (err as { code?: string }).code
  const status = (err as { status?: number }).status
  if (code === 'NOT_ENOUGH_TICKETS') return 'Not enough tickets for that yet.'
  if (code === 'ALREADY_OWNED') return 'That one’s yours already.'
  if (code === 'PRIZE_NOT_OWNED') return 'That’s a prize you haven’t traded for yet.'
  if (code === 'RETIRED') return 'That one isn’t at the prize counter any more.'
  if (status === 401) return 'Sign in first.'
  if (status === 403 || status === 409) return 'Only the owner of this tag can change how it looks. Sign in first.'
  return err instanceof Error ? err.message : 'That didn’t go through. Try again.'
}

export function PrizeActions({
  prize,
  avatar,
  name,
  onTraded,
  fallback,
}: {
  prize: Prize
  /** The player's avatar as it is now. */
  avatar: Avatar
  /** Their tag, or '' before they have one. */
  name: string
  /** Once it's theirs: confetti lets itself go. */
  onTraded?: () => void
  /** The second button when there's nothing else for it to do: back to the counter, or take it off again. */
  fallback: ReactNode
}) {
  const { signedIn, signedOut, loading: authLoading } = useAuth()
  const tickets = useTickets()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null)

  const owned = tickets.owned.includes(prize.id)
  const worn = isWearing(avatar, prize.id)
  const balance = signedIn ? tickets.balance : 0
  const afford = balance >= prize.price
  const saving = tickets.goal === prize.id
  // Earned by a streak, a season or Plus, or off the counter for good: nothing to trade for.
  const offCounter = !owned && (!!prize.earned || !!prize.retired)

  const putOn = async (id: string | null) => {
    const saved = await setPlayerAvatar(name, encodeAvatar(wearPrize(avatar, prize.kind, id)))
    setLocalAvatarId(name, saved)
  }

  const act = async (run: () => Promise<void>, done?: string) => {
    setBusy(true)
    setNote(null)
    try {
      await run()
      if (done) setNote({ text: done, ok: true })
    } catch (err) {
      setNote({ text: errorText(err), ok: false })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  const trade = () =>
    act(
      async () => {
        await tradePrize(prize.id)
        if (name) await putOn(prize.id)
        onTraded?.()
      },
      name ? 'It’s yours, and you’re wearing it.' : 'It’s yours. Pick a tag to wear it.',
    )

  const toGo = prize.price - balance
  const days = Math.max(1, Math.ceil(toGo / TICKETS_A_DAY))

  let status: string
  if (offCounter) status = prize.earned ? `Earned, never traded for. ${prize.earned.by}.` :'No longer at the prize counter.'
  else if (signedOut) status = 'Sign in to collect tickets. Every saved run pays some.'
  // A session whose account isn't known yet: never Sign in.
  else if (!signedIn) status = authLoading ? 'Checking your tickets…' : 'Couldn’t reach your account just now.'
  else if (owned) status = worn ? 'Yours, and you’re wearing it.' : 'Yours for good. Wear it any time.'
  else if (afford) status = `You have ${balance.toLocaleString()} tickets, so ${(balance - prize.price).toLocaleString()} left after.`
  else status = `You have ${balance.toLocaleString()}. ${toGo.toLocaleString()} to go, about ${days === 1 ? 'a day' : `${days} days`} of play.`

  const primary = (() => {
    if (offCounter) return null
    if (signedOut) return <button type="button" className="panel__btn" onClick={openSiteMenu}>Sign in</button>
    if (!signedIn) {
      return (
        <span className="panel__btn skel-btn" aria-hidden="true">
          Save for it
        </span>
      )
    }
    if (owned) {
      if (!name) return <button type="button" className="panel__btn" onClick={openSiteMenu}>Pick a tag to wear it</button>
      if (worn) return <button type="button" className="panel__btn" disabled>Wearing it</button>
      return (
        <button type="button" className="panel__btn" disabled={busy} onClick={() => void act(() => putOn(prize.id), 'You’re wearing it.')}>
          {busy ? 'Putting it on…' : 'Wear it'}
        </button>
      )
    }
    if (afford) {
      return (
        <button type="button" className="panel__btn" disabled={busy} onClick={() => setConfirming(true)}>
          <TicketGlyph size={18} />
          Trade {prize.price.toLocaleString()} tickets
        </button>
      )
    }
    if (saving) return <button type="button" className="panel__btn" disabled>Saving for it</button>
    return (
      <button type="button" className="panel__btn" disabled={busy} onClick={() => void act(() => setTicketGoal(prize.id), 'Saving for it. Every run shows how close you are.')}>
        Save for it
      </button>
    )
  })()

  const secondary = (() => {
    if (owned && worn && name) {
      return (
        <button type="button" className="panel__btn panel__btn--ghost" disabled={busy} onClick={() => void act(() => putOn(null), 'Taken off. It’s still yours.')}>
          Take it off
        </button>
      )
    }
    if (!owned && saving && !afford) {
      return (
        <button type="button" className="panel__btn panel__btn--ghost" disabled={busy} onClick={() => void act(() => setTicketGoal(null))}>
          Stop saving
        </button>
      )
    }
    return fallback
  })()

  return (
    <>
      {note?.ok ? null : (
        <p className={`prize-info__status${owned ? ' prize-info__status--ok' : signedIn && !afford && !offCounter ? ' prize-info__status--go' : ''}`}>{status}</p>
      )}
      {/* On a phone the sheet scrolls, the prizes' grid and all: these stay pinned at its foot (counter.css), with
          what a press of them said. */}
      <div className="prize-info__foot">
        {note ? (
          <p className={`prize-info__note${note.ok ? ' prize-info__note--ok' : ''}`} role={note.ok ? 'status' : 'alert'}>
            {note.text}
          </p>
        ) : null}
        {confirming ? (
          <div className="prize-confirm">
            <p className="prize-confirm__q">
              Trade {prize.price.toLocaleString()} tickets for {prize.name}?
            </p>
            <div className="panel__actions prize-confirm__acts">
              <button type="button" className="panel__btn" disabled={busy} onClick={() => void trade()}>
                {busy ? 'Trading…' : 'Yes, trade'}
              </button>
              <button type="button" className="panel__btn panel__btn--ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Not now
              </button>
            </div>
          </div>
        ) : (
          <div className="panel__actions prize-info__acts">
            {primary}
            {secondary}
          </div>
        )}
      </div>
    </>
  )
}
