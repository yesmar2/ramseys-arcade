import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { plateTier, PRIZE_KINDS, PRIZES, prizeById, TICKETS_A_DAY, type Prize } from '../../data/prizes'
import { useAuth } from '../../hooks/useAuth'
import {
  avatarWashColor,
  encodeAvatar,
  isWearing,
  setLocalAvatarId,
  wearPrize,
  wornPrize,
  type Avatar,
} from '../../lib/avatars'
import { useGlobalRank } from '../../lib/globalRank'
import { setPlayerAvatar } from '../../lib/leaderboard'
import { setTicketGoal, tradePrize, useTickets } from '../../lib/tickets'
import { Panel, PanelHead } from '../Panel'
import { AvatarArt, PlayerAvatar } from '../PlayerAvatar'
import { PlayerName } from '../PlayerName'
import { ReportConfetti } from '../RunReport'
import { openSiteMenu } from '../siteNav'
import { CardBackdrop, PrizeArt } from './PrizeArt'
import { SignArt } from './SignArt'
import { TicketGlyph } from './Ticket'

/*
 * One prize, up close: tried on the player's own badge, tag or card before
 * they trade for it, then traded for, worn and taken off. The others of its
 * kind are a tap away. Anything they can't afford yet they can save for, and
 * every run's report then shows how close it is.
 */

type View = 'badge' | 'board' | 'card'

const VIEW_LABELS: Record<View, string> = { badge: 'Badge', board: 'On a board', card: 'On your card' }

function viewsFor(prize: Prize): View[] {
  switch (prize.kind) {
    case 'finish':
      return ['badge', 'board', 'card']
    case 'name':
      return ['board', 'card']
    case 'confetti':
      return []
    default:
      return ['card']
  }
}

function errorText(err: unknown): string {
  const code = (err as { code?: string }).code
  const status = (err as { status?: number }).status
  if (code === 'NOT_ENOUGH_TICKETS') return 'Not enough tickets for that yet.'
  if (code === 'ALREADY_OWNED') return 'That one’s yours already.'
  if (code === 'PRIZE_NOT_OWNED') return 'That’s a prize you haven’t traded for yet.'
  if (status === 401) return 'Sign in first.'
  if (status === 403 || status === 409) return 'Only the owner of this tag can change how it looks. Sign in first.'
  return err instanceof Error ? err.message : 'That didn’t go through. Try again.'
}

/** A player card, small: the theme behind it, the badge, the tag (or its neon sign) and the title under it. */
export function PlayerCardMini({ avatar, name, line }: { avatar: Avatar; name: string; line?: string }) {
  const card = wornPrize(avatar, 'card')
  const title = prizeById(wornPrize(avatar, 'title'))
  const sign = wornPrize(avatar, 'sign')
  const wash = avatarWashColor(avatar)
  return (
    <div className="prize-card" style={{ '--wash': wash } as CSSProperties}>
      {card ? <CardBackdrop className="prize-card__theme" theme={card} width={380} height={236} scale={1.05} /> : null}
      <span className={`prize-card__shade${card ? ' prize-card__shade--theme' : ''}`} aria-hidden="true" />
      <span className="prize-card__tile">
        <svg viewBox="0 0 64 64" width="92" height="92" aria-hidden="true" focusable="false">
          <AvatarArt avatar={avatar} name={name} />
        </svg>
      </span>
      <span className="prize-card__text">
        <span className="prize-card__kicker">Player card</span>
        {sign ? (
          <SignArt sign={sign} name={name} width={190} wires={false} />
        ) : (
          <PlayerName className="prize-card__name" name={name} style={wornPrize(avatar, 'name')} />
        )}
        {title ? <span className={`prize-plate prize-plate--${plateTier(title)}`}>{title.name}</span> : null}
        {line ? <span className="prize-card__line">{line}</span> : null}
      </span>
    </div>
  )
}

export function PrizePanel({
  prize,
  avatar,
  name,
  onPick,
  onClose,
}: {
  prize: Prize
  /** The player's avatar as it is now. */
  avatar: Avatar
  /** Their tag, or '' before they have one. */
  name: string
  onPick: (id: string) => void
  onClose: () => void
}) {
  const titleId = useId()
  const { signedIn } = useAuth()
  const tickets = useTickets()
  const standing = useGlobalRank()
  const views = viewsFor(prize)
  const [view, setView] = useState<View>(views[0] ?? 'badge')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null)
  const [burst, setBurst] = useState(0)

  const tag = name || 'YOU'
  const owned = tickets.owned.includes(prize.id)
  const worn = isWearing(avatar, prize.id)
  const balance = signedIn ? tickets.balance : 0
  const afford = balance >= prize.price
  const saving = tickets.goal === prize.id
  const tryOn = wearPrize(avatar, prize.kind, prize.id)
  const shownView = views.includes(view) ? view : views[0]
  const siblings = PRIZES.filter((p) => p.kind === prize.kind)
  // A long list (there are two dozen titles) scrolls in its own box, kept on the one picked.
  const variantsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = variantsRef.current
    const on = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!box || !on) return
    // The box is positioned, so a button's offsetTop is already measured from it.
    const top = on.offsetTop
    if (top < box.scrollTop || top + on.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top - 8
  }, [prize.id])
  const standingLine = standing.rank != null ? `#${standing.rank} in the standings · ${standing.score.toLocaleString()} pts` : undefined

  const pick = (id: string) => {
    setConfirming(false)
    setNote(null)
    onPick(id)
  }

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
        if (prize.kind === 'confetti') setBurst((b) => b + 1)
      },
      name ? 'It’s yours, and you’re wearing it.' : 'It’s yours. Pick a tag to wear it.',
    )

  const toGo = prize.price - balance
  const days = Math.max(1, Math.ceil(toGo / TICKETS_A_DAY))

  let status: string
  if (!signedIn) status = 'Sign in to collect tickets. Every saved run pays some.'
  else if (owned) status = worn ? 'Yours, and you’re wearing it.' : 'Yours for good. Wear it any time.'
  else if (afford) status = `You have ${balance.toLocaleString()} tickets, so ${(balance - prize.price).toLocaleString()} left after.`
  else status = `You have ${balance.toLocaleString()}. ${toGo.toLocaleString()} to go, about ${days === 1 ? 'a day' : `${days} days`} of play.`

  const primary = (() => {
    if (!signedIn) return <button type="button" className="panel__btn" onClick={openSiteMenu}>Sign in</button>
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
    return (
      <button type="button" className="panel__btn panel__btn--ghost" onClick={onClose}>
        Back to the counter
      </button>
    )
  })()

  return (
    <Panel
      wide
      className="prize-panel"
      labelledBy={titleId}
      onClose={onClose}
      scrimCloses={!busy}
      style={{ '--celeb-accent': '#ff8552', '--hero-ink': '#3a1406' } as CSSProperties}
      backdrop={burst ? <ReportConfetti key={burst} accent="#ff8552" kind={prize.kind === 'confetti' ? prize.id : null} /> : null}
    >
      <PanelHead titleId={titleId} kicker={PRIZE_KINDS[prize.kind].one} title={prize.name} onClose={onClose} />
      <div className="panel__body prize-panel__body">
        <div className="prize-stage-wrap">
          {views.length > 1 ? (
            <div className="prize-views" role="tablist" aria-label="Try it on">
              {views.map((v) => (
                <button key={v} type="button" role="tab" aria-selected={shownView === v} className="prize-views__btn" onClick={() => setView(v)}>
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          ) : null}
          <div className="prize-stage">
            {saving && !owned ? <span className="prize-stage__goal">Saving for this</span> : null}
            {prize.kind === 'confetti' ? (
              <div className="prize-stage__confetti">
                <PrizeArt prize={prize} avatar={avatar} name={tag} width={230} />
                <button type="button" className="prize-stage__burst" onClick={() => setBurst((b) => b + 1)}>
                  Let it go
                </button>
              </div>
            ) : shownView === 'badge' ? (
              <div className="prize-stage__badge">
                <svg viewBox="0 0 64 64" width="190" height="190" aria-hidden="true" focusable="false">
                  <AvatarArt avatar={tryOn} name={tag} />
                </svg>
                <PlayerName className="prize-stage__tag" name={tag} style={wornPrize(tryOn, 'name')} />
              </div>
            ) : shownView === 'board' ? (
              <div className="prize-board">
                <div className="prize-board__row prize-board__row--ghost" aria-hidden="true">
                  <span />
                  <i />
                  <b />
                </div>
                <div className="prize-board__row prize-board__row--me">
                  <span className="prize-board__rank">{standing.rank ?? '–'}</span>
                  <PlayerAvatar avatar={tryOn} name={tag} size="md" />
                  <PlayerName className="prize-board__name" name={tag} style={wornPrize(tryOn, 'name')} />
                  <span className="prize-board__pts">{standing.rank != null ? `${standing.score.toLocaleString()} pts` : ''}</span>
                </div>
                <div className="prize-board__row prize-board__row--ghost" aria-hidden="true">
                  <span />
                  <i />
                  <b />
                </div>
              </div>
            ) : (
              <PlayerCardMini avatar={tryOn} name={tag} line={standingLine} />
            )}
          </div>
        </div>

        <div className="prize-info">
          {siblings.length > 1 ? (
            <div ref={variantsRef} className="prize-variants" role="group" aria-label={PRIZE_KINDS[prize.kind].many}>
              {siblings.map((p) => {
                const mine = tickets.owned.includes(p.id)
                return (
                  <button key={p.id} type="button" className="prize-variant" aria-pressed={p.id === prize.id} onClick={() => pick(p.id)}>
                    <PrizeArt prize={p} avatar={avatar} name={tag} width={66} />
                    <span className="prize-variant__name">{p.name}</span>
                    <span className="prize-variant__price">{mine ? (isWearing(avatar, p.id) ? 'Wearing' : 'Yours') : p.price.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
          <p className="prize-info__blurb">{prize.blurb}</p>
          {owned ? (
            <p className="prize-info__price prize-info__price--yours">Yours</p>
          ) : (
            <p className="prize-info__price">
              <TicketGlyph size={34} />
              <b>{prize.price.toLocaleString()}</b> tickets
            </p>
          )}
          {note?.ok ? null : (
            <p className={`prize-info__status${owned ? ' prize-info__status--ok' : signedIn && !afford ? ' prize-info__status--go' : ''}`}>{status}</p>
          )}
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
          <p className="prize-info__fine">Looks only: it never changes a score. Once it’s traded it’s yours for good.</p>
        </div>
      </div>
    </Panel>
  )
}
