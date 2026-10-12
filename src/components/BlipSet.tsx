import { getGame } from '../data/games'
import { BLIP_SKIN_PICTURES } from '../lib/blipSkinPictures'
import { blipSet } from '../lib/poll'
import { BLIP_SKINS, chooseSkin, skinById, useChosenSkin } from '../lib/skins'
import { useTickets } from '../lib/tickets'

/*
 * Blip's set, under his answered question (A on the "Blip in other games" canvas, Ramsey 2026-10-11: "i like A,
 * daily question 7 times"): the four skins his answers win, one every 7 (lib/skins.ts BLIP_SKINS), the ones won lit
 * with a tick, the next with how far along it is, and a line saying how many answers more. The answer that wins one
 * says so, with the way to wear it.
 */

const RING = 2 * Math.PI * 31

/** "Wear it" for a skin just won, once the player's tickets say they own it; "Wearing it" once they do. */
function WearIt({ game, id }: { game: string; id: string }) {
  const { owned } = useTickets()
  const chosen = useChosenSkin(game)
  if (!owned.includes(id)) return null
  const on = chosen === id
  return (
    <button type="button" className={`blip-set__wear${on ? ' blip-set__wear--on' : ''}`} aria-pressed={on} onClick={() => chooseSkin(game, on ? null : id)}>
      {on ? 'Wearing it' : 'Wear it'}
    </button>
  )
}

export function BlipSet({ answers, won }: { answers: number; won: string | null }) {
  const { won: count, next, more } = blipSet(answers)
  const just = won ? skinById(won) : null
  return (
    <div className="blip-set">
      <div className="blip-set__head">
        <span className="blip-set__title">Blip’s set</span>
        <span className="blip-set__count">
          {count} of {BLIP_SKINS.length}
        </span>
      </div>
      <ul className="blip-set__row">
        {BLIP_SKINS.map((skin, i) => {
          const at = skin.poll ?? 0
          const got = answers >= at
          const isNext = skin === next
          // The next one's ring fills from the answer that won the one before it.
          const from = BLIP_SKINS[i - 1]?.poll ?? 0
          const along = isNext ? Math.max(0, Math.min(1, (answers - from) / (at - from))) : 0
          const game = getGame(skin.game)?.name ?? skin.game
          return (
            <li
              key={skin.id}
              className={`blip-set__skin${got ? ' blip-set__skin--won' : isNext ? ' blip-set__skin--next' : ''}`}
              title={`${skin.name} · ${game}`}
            >
              <span className="blip-set__art">
                <img src={BLIP_SKIN_PICTURES[skin.id]} alt="" width={48} height={48} />
                {got ? (
                  <span className="blip-set__tick" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M5 12.5l4.2 4.2L19 7" />
                    </svg>
                  </span>
                ) : isNext ? (
                  <svg className="blip-set__ring" viewBox="0 0 70 70" aria-hidden="true">
                    <circle cx="35" cy="35" r="31" />
                    <circle className="blip-set__ring-on" cx="35" cy="35" r="31" strokeDasharray={`${along * RING} ${RING}`} />
                  </svg>
                ) : null}
              </span>
              <span className="blip-set__game">{game}</span>
              <span className="visually-hidden">{got ? `${skin.name}, won` : isNext ? `${skin.name}, next` : `${skin.name}, still to win`}</span>
            </li>
          )
        })}
      </ul>
      <p className="blip-set__line" role="status">
        {just ? (
          <>
            <span>
              You won the <b>{just.name}</b> for {getGame(just.game)?.name ?? just.game}!
            </span>
            <WearIt game={just.game} id={just.id} />
          </>
        ) : next ? (
          <span>
            {more} more {more === 1 ? 'answer' : 'answers'} to the <b>{next.name}</b>
          </span>
        ) : (
          <span>Blip’s whole set is yours.</span>
        )}
      </p>
    </div>
  )
}
