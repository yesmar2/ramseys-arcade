import { prizesHref } from '../../hooks/useHashRoute'
import { chooseSkin, skinsFor, useChosenSkin } from '../../lib/skins'
import { useTickets } from '../../lib/tickets'
import { RewardArt } from './RewardArt'
import '../../styles/season.css'

/*
 * On a game's page: the usual look or a skin the player owns, chosen here and kept on this device
 * (lib/skins.ts); and the game's Hangar skins they don't own yet, with their price, a way to their bay at the
 * prize counter. Nothing shows for a game with no skins of either.
 */

/** "Use it" for one skin the player owns: on the Season page's skins and a level-up that gave it. */
export function UseSkin({ game, id }: { game: string; id: string }) {
  const { owned } = useTickets()
  const chosen = useChosenSkin(game)
  if (!owned.includes(id)) return null
  const on = chosen === id
  return (
    <button type="button" className={`skin-use${on ? ' skin-use--on' : ''}`} aria-pressed={on} onClick={() => chooseSkin(game, on ? null : id)}>
      {on ? 'In use' : 'Use it'}
    </button>
  )
}

export function SkinPicker({ game }: { game: string }) {
  const { owned } = useTickets()
  const chosen = useChosenSkin(game)
  const mine = skinsFor(game).filter((s) => owned.includes(s.id))
  // The Hangar's for this game, still to trade for: a season's skins not won stay on its pass, unsaid here.
  const forSale = skinsFor(game).filter((s) => s.price != null && !owned.includes(s.id))
  if (!mine.length && !forSale.length) return null
  return (
    <div className="skin-pick" role="radiogroup" aria-label="Your look in this game">
      <span className="skin-pick__label">Skin</span>
      <button type="button" role="radio" aria-checked={!chosen} className={`skin-pick__opt${!chosen ? ' skin-pick__opt--on' : ''}`} onClick={() => chooseSkin(game, null)}>
        Usual
      </button>
      {mine.map((skin) => {
        const on = chosen === skin.id
        return (
          <button key={skin.id} type="button" role="radio" aria-checked={on} className={`skin-pick__opt${on ? ' skin-pick__opt--on' : ''}`} onClick={() => chooseSkin(game, skin.id)}>
            <span className="skin-pick__art" aria-hidden="true">
              <RewardArt reward={{ kind: 'skin', id: skin.id, name: skin.name }} size={24} />
            </span>
            {skin.name}
          </button>
        )
      })}
      {forSale.map((skin) => (
        <a key={skin.id} className="skin-pick__opt skin-pick__opt--shop" href={`${prizesHref()}#hangar-${skin.id}`}>
          <span className="skin-pick__art" aria-hidden="true">
            <RewardArt reward={{ kind: 'skin', id: skin.id, name: skin.name }} size={24} />
          </span>
          {skin.name}
          <span className="skin-pick__price">{(skin.price ?? 0).toLocaleString()} tickets</span>
        </a>
      ))}
    </div>
  )
}
