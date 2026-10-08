import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../../data/games'
import { TICKETS_A_DAY } from '../../data/prizes'
import { useAuth } from '../../hooks/useAuth'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { chooseSkin, HANGAR_SKINS, useChosenSkin, type Skin } from '../../lib/skins'
import { tradePrize, useTickets } from '../../lib/tickets'
import { useConfirm } from '../ConfirmPanel'
import { RewardArt } from '../season/RewardArt'
import { openSiteMenu } from '../siteNav'
import { TicketGlyph } from './Ticket'
import '../../styles/hangarBays.css'

/*
 * The Hangar, at the prize counter: skins for good, not a season's, each a game's ship, car or tail in a lit
 * bay, traded for tickets (the API's prizes.ts has the prices, lib/skins.ts HANGAR_SKINS the skins). Roll one
 * out and it's worn at once; your ghost, your row on the boards and your challenge links wear it too. A
 * season's skins stay its pass's: the Hangar never has them.
 */

function errorText(err: unknown): string {
  const code = (err as { code?: string }).code
  if (code === 'NOT_ENOUGH_TICKETS') return 'Not enough tickets for that yet.'
  if (code === 'ALREADY_OWNED') return 'That one’s yours already.'
  if ((err as { status?: number }).status === 401) return 'Sign in first.'
  return err instanceof Error && err.message ? err.message : 'That didn’t go through. Try again.'
}

function Bay({ skin, onTrade, busy }: { skin: Skin; onTrade: (skin: Skin) => void; busy: boolean }) {
  const { signedIn } = useAuth()
  const { owned, balance, loaded } = useTickets()
  const chosen = useChosenSkin(skin.game)
  const game = getGame(skin.game)
  const mine = owned.includes(skin.id)
  const wearing = chosen === skin.id
  const price = skin.price ?? 0
  const short = signedIn ? Math.max(0, price - balance) : 0
  const accent = game?.accent ?? '#ff8552'
  // Sent here for this skin, from its card on a board or a game's skin picker: its bay is lit.
  const sought = typeof window !== 'undefined' && window.location.hash === `#hangar-${skin.id}`
  return (
    <li
      className={`hbay${mine ? ' hbay--mine' : ''}${sought ? ' hbay--sought' : ''}`}
      id={`hangar-${skin.id}`}
      style={{ '--hbay': accent } as CSSProperties}
    >
      <span className="hbay__light" aria-hidden="true" />
      <span className="hbay__art" aria-hidden="true">
        <RewardArt reward={{ kind: 'skin', id: skin.id, name: skin.name }} size={112} />
      </span>
      <span className="hbay__floor" aria-hidden="true" />
      <b className="hbay__name">{skin.name}</b>
      <span className="hbay__what">
        {game?.name ?? skin.game} · {skin.what.replace(/^.*\s/, '')}
      </span>
      {mine ? (
        <>
          <span className="hbay__tag hbay__tag--mine">{wearing ? 'Yours · wearing it' : 'Yours'}</span>
          <div className="hbay__acts">
            <button type="button" className="hbay__btn hbay__btn--ghost" aria-pressed={wearing} onClick={() => chooseSkin(skin.game, wearing ? null : skin.id)}>
              {wearing ? 'Take it off' : 'Wear it'}
            </button>
            <a className="hbay__btn hbay__btn--ghost" href={gamePlayHref(skin.game)}>
              Play {game?.name ?? 'it'}
            </a>
          </div>
        </>
      ) : (
        <>
          <span className="hbay__tag">
            <TicketGlyph size={16} />
            {price.toLocaleString()} tickets
          </span>
          {!signedIn ? (
            <button type="button" className="hbay__btn" onClick={openSiteMenu}>
              Sign in to trade
            </button>
          ) : !loaded ? (
            // Your tickets not in yet: the button's room, so the bay doesn't change shape when they come.
            <span className="hbay__btn skel-btn" aria-hidden="true">
              Roll it out
            </span>
          ) : short > 0 ? (
            <div className="hbay__progress">
              <span className="hbay__bar" aria-hidden="true">
                <i style={{ width: `${Math.round((balance / price) * 100)}%` }} />
              </span>
              <span className="hbay__short">
                {short.toLocaleString()} more · about {Math.max(1, Math.ceil(short / TICKETS_A_DAY))} days of play
              </span>
            </div>
          ) : (
            <button type="button" className="hbay__btn" disabled={busy} onClick={() => onTrade(skin)}>
              Roll it out
            </button>
          )}
        </>
      )}
    </li>
  )
}

export function HangarBays() {
  const [confirm, confirmPanel] = useConfirm()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null)

  // From a game's skin picker (season/SkinPicker.tsx): its skin's bay, brought into view.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#hangar')) return
    const bay = document.getElementById(hash.slice(1))
    bay?.scrollIntoView({ block: 'center' })
  }, [])

  const trade = async (skin: Skin) => {
    const game = getGame(skin.game)?.name ?? skin.game
    const yes = await confirm({
      title: `Roll out the ${skin.name}?`,
      body: `${(skin.price ?? 0).toLocaleString()} tickets, for good. It’s your ${skin.what.toLowerCase()} in ${game} from now on, and your ghost wears it too. Looks only: it never changes a score.`,
      confirm: `Trade ${(skin.price ?? 0).toLocaleString()} tickets`,
    })
    if (!yes) return
    setBusy(true)
    setNote(null)
    try {
      await tradePrize(skin.id)
      chooseSkin(skin.game, skin.id)
      setNote({ text: `The ${skin.name} is yours, and you’re wearing it in ${game}.`, ok: true })
    } catch (err) {
      setNote({ text: errorText(err), ok: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="hangar-bays" id="hangar" aria-labelledby="hangar-bays-title">
      <div className="hangar-bays__head">
        <h2 id="hangar-bays-title" className="hangar-bays__title">
          The Hangar
        </h2>
        <p className="hangar-bays__sub">Skins for good, not just for a season. Wear one and your ghost, your row on the boards and your challenge links wear it too.</p>
      </div>
      {note ? (
        <p className={`hangar-bays__note${note.ok ? ' hangar-bays__note--ok' : ''}`} role="status">
          {note.text}
        </p>
      ) : null}
      <ul className="hangar-bays__grid">
        {HANGAR_SKINS.map((skin) => (
          <Bay key={skin.id} skin={skin} onTrade={(s) => void trade(s)} busy={busy} />
        ))}
        <li className="hbay hbay--soon" aria-label="More to come">
          <svg className="hbay__soon-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 7.5v4.5l3 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <b className="hbay__name">More bays soon</b>
          <span className="hbay__what">New skins roll in from time to time. A season’s own are on its pass.</span>
        </li>
      </ul>
      {confirmPanel}
    </section>
  )
}
