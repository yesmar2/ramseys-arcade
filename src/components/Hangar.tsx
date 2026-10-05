import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameHref, seasonHref } from '../hooks/useHashRoute'
import { api } from '../lib/leaderboard'
import { liveSeason, useSeason } from '../lib/season'
import { useTickets } from '../lib/tickets'
import { starTile } from '../lib/seasonArt'
import { SKINS, useChosenSkin, type Skin } from '../lib/skins'
import { RewardArt } from './season/RewardArt'
import '../styles/hangar.css'

/*
 * A player's hangar, on their player card: the skins they've won, each in its own lit bay, so skins are
 * something others see as well as something you fly. On your own card, while a season is live, the ones
 * its pass still has for you wait in dark bays with the level they're at; on anyone else's, only what
 * they've won shows, and a player with no skins shows no hangar.
 */

function Bay({ skin, mine }: { skin: Skin; mine: boolean }) {
  const game = getGame(skin.game)
  const inUse = useChosenSkin(skin.game) === skin.id
  return (
    <li className="hangar__bay">
      <a className="hangar__nook" href={gameHref(skin.game)} title={game ? `Play ${game.name}` : undefined}>
        <RewardArt reward={{ kind: 'skin', id: skin.id, name: skin.name }} size={76} />
        {mine && inUse ? <span className="hangar__tag">In use</span> : null}
      </a>
      <span className="hangar__name">{skin.name}</span>
      <span className="hangar__what">
        {game?.name ?? skin.what} · {skin.season ? `Season ${skin.season}` : 'Hangar'}
        {skin.plus ? ' Pass+' : ''}
      </span>
    </li>
  )
}

function Waiting({ skin, level }: { skin: Skin; level: number }) {
  const game = getGame(skin.game)
  return (
    <li className="hangar__bay hangar__bay--waiting">
      <a className="hangar__nook" href={seasonHref()} title="On the season pass">
        <span className="hangar__ghost" aria-hidden="true">
          <RewardArt reward={{ kind: 'skin', id: skin.id, name: skin.name }} size={76} />
        </span>
        <span className="hangar__lv">Lv {level}</span>
      </a>
      <span className="hangar__name">{skin.name}</span>
      <span className="hangar__what">{game?.name ?? skin.what} · on the pass</span>
    </li>
  )
}

/**
 * The skins a player has won: your own from what you own (lib/tickets.ts), anyone else's from the API.
 * Null while they're asked for.
 */
function useHangarSkins(name: string, isSelf: boolean): string[] | null {
  const { owned, loaded } = useTickets()
  const [theirs, setTheirs] = useState<{ name: string; skins: string[] } | null>(null)
  useEffect(() => {
    if (isSelf || !name) return
    let live = true
    api<{ skins?: string[] }>(`/names/${encodeURIComponent(name)}/skins`)
      .then((r) => {
        if (live) setTheirs({ name, skins: r.skins ?? [] })
      })
      .catch(() => {
        if (live) setTheirs({ name, skins: [] })
      })
    return () => {
      live = false
    }
  }, [name, isSelf])
  if (isSelf) return loaded ? owned.filter((id) => SKINS.some((s) => s.id === id)) : null
  return theirs?.name === name ? theirs.skins : null
}

/** A player card's hangar: theirs, asked for as the card opens. */
export function PlayerHangar({ name, isSelf }: { name: string; isSelf: boolean }) {
  return <Hangar skins={useHangarSkins(name, isSelf)} isSelf={isSelf} name={name} />
}

export function Hangar({ skins, isSelf, name }: { skins: readonly string[] | null; isSelf: boolean; name: string }) {
  const store = useSeason()
  const season = liveSeason(store)
  if (skins == null) return null
  const owned = SKINS.filter((s) => skins.includes(s.id))
  // The live pass's skins you haven't won yet, on your own card only.
  const waiting = isSelf && season
    ? store.rewards
        .filter((r) => r.kind === 'skin' && r.ready && !skins.includes(r.id))
        .map((r) => ({ skin: SKINS.find((s) => s.id === r.id), level: r.level }))
        .filter((w): w is { skin: Skin; level: number } => w.skin != null)
    : []
  if (!owned.length && !waiting.length) return null
  const sky = { backgroundImage: starTile('#f4f0ff', 11, { size: 320, stars: 36 }) } as CSSProperties
  return (
    <article className="hangar pcard-panel" id="hangar" aria-labelledby="hangar-title">
      <div className="hangar__head">
        <h2 className="hangar__title" id="hangar-title">
          Hangar
        </h2>
        <span className="hangar__note">
          {owned.length === 0
            ? 'No skins yet'
            : `${owned.length} ${owned.length === 1 ? 'skin' : 'skins'}${isSelf ? '' : ` ${name} has won`}`}
        </span>
        {isSelf && season ? (
          <a className="hangar__link" href={seasonHref()}>
            Season pass ›
          </a>
        ) : null}
      </div>
      <div className="hangar__deck" style={sky}>
        <ol className="hangar__bays">
          {owned.map((skin) => (
            <Bay key={skin.id} skin={skin} mine={isSelf} />
          ))}
          {waiting.map(({ skin, level }) => (
            <Waiting key={skin.id} skin={skin} level={level} />
          ))}
        </ol>
      </div>
      {isSelf && owned.length ? <p className="hangar__foot">Everyone who opens your card sees your hangar. Pick the skin you play in on each game’s page.</p> : null}
    </article>
  )
}
