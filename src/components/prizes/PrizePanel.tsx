import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { PRIZE_KINDS, PRIZES, type Prize } from '../../data/prizes'
import { avatarWashColor, isWearing, wearPrize, wornPrize, type Avatar } from '../../lib/avatars'
import { moveChoice } from '../../lib/choiceKeys'
import { useGlobalRank } from '../../lib/globalRank'
import { useTickets } from '../../lib/tickets'
import { Panel, PanelHead } from '../Panel'
import { AvatarArt, PlayerAvatar } from '../PlayerAvatar'
import { PlayerName } from '../PlayerName'
import { ReportConfetti } from '../RunReport'
import { FullArtCard } from '../FullArtCard'
import { PrizeArt } from './PrizeArt'
import { PrizeActions } from './PrizeActions'
import { TicketGlyph } from './Ticket'

/*
 * One prize, up close: tried on the player's own badge, tag or card before
 * they trade for it, then traded for, worn and taken off. The others of its
 * kind are a tap away. Anything they can't afford yet they can save for, and
 * every run's report then shows how close it is.
 */

type View = 'badge' | 'board' | 'card'

const VIEW_LABELS: Record<View, string> = { badge: 'Avatar', board: 'On a board', card: 'On your card' }

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

/**
 * The player's trading card, small, as their profile shows it (FullArtCard): the background behind it, the
 * avatar and the tag in its style, trying on whatever's picked.
 */
export function PlayerCardMini({ avatar, name, line }: { avatar: Avatar; name: string; line?: string }) {
  return (
    <FullArtCard
      className="prize-fac"
      theme={wornPrize(avatar, 'card')}
      game={null}
      style={{ '--hero-accent': avatarWashColor(avatar) } as CSSProperties}
      avatar={<PlayerAvatar avatar={avatar} name={name} size="xl" />}
      chip={line}
      name={<PlayerName className="prize-fac__name" name={name} style={wornPrize(avatar, 'name')} />}
    />
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
  const tickets = useTickets()
  const standing = useGlobalRank()
  const views = viewsFor(prize)
  const [view, setView] = useState<View>(views[0] ?? 'badge')
  const [burst, setBurst] = useState(0)

  const tag = name || 'YOU'
  const owned = tickets.owned.includes(prize.id)
  const saving = tickets.goal === prize.id
  const tryOn = wearPrize(avatar, prize.kind, prize.id)
  const shownView = views.includes(view) ? view : views[0]
  // What's earned, or retired, isn't on the counter, so it isn't among the ones to flick through.
  const siblings = PRIZES.filter((p) => p.kind === prize.kind && ((!p.earned && !p.retired) || p.id === prize.id))
  // A long list scrolls in its own box, kept on the one picked.
  const variantsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = variantsRef.current
    const on = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!box || !on) return
    // The box is positioned, so a button's offsetTop is already measured from it.
    const top = on.offsetTop
    if (top < box.scrollTop || top + on.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top - 8
  }, [prize.id])
  const standingLine = standing.rank != null ? `#${standing.rank} in the standings` : undefined

  return (
    <Panel
      wide
      className="prize-panel"
      labelledBy={titleId}
      onClose={onClose}
      style={{ '--celeb-accent': '#ff8552', '--hero-ink': '#3a1406' } as CSSProperties}
      backdrop={burst ? <ReportConfetti key={burst} accent="#ff8552" kind={prize.kind === 'confetti' ? prize.id : null} /> : null}
    >
      <PanelHead titleId={titleId} kicker={PRIZE_KINDS[prize.kind].one} title={prize.name} onClose={onClose} />
      <div className="panel__body prize-panel__body">
        <div className="prize-stage-wrap">
          {views.length > 1 ? (
            <div className="prize-views" role="tablist" aria-label="Try it on" onKeyDown={moveChoice}>
              {views.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={shownView === v}
                  tabIndex={shownView === v ? 0 : -1}
                  className="prize-views__btn"
                  onClick={() => setView(v)}
                >
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
                  <button key={p.id} type="button" className="prize-variant" aria-pressed={p.id === prize.id} onClick={() => onPick(p.id)}>
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
          ) : prize.earned || prize.retired ? null : (
            <p className="prize-info__price">
              <TicketGlyph size={34} />
              <b>{prize.price.toLocaleString()}</b> tickets
            </p>
          )}
          <PrizeActions
            key={prize.id}
            prize={prize}
            avatar={avatar}
            name={name}
            onTraded={prize.kind === 'confetti' ? () => setBurst((b) => b + 1) : undefined}
            fallback={
              <button type="button" className="panel__btn panel__btn--ghost" onClick={onClose}>
                Back to the counter
              </button>
            }
          />
          <p className="prize-info__fine">Looks only: it never changes a score. Once it’s traded it’s yours for good.</p>
        </div>
      </div>
    </Panel>
  )
}
