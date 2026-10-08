import { useEffect, useId, useRef, useState } from 'react'
import { prizesHref, seasonHref } from '../../hooks/useHashRoute'
import { liveSeason, useSeason } from '../../lib/season'
import { SEASON_CALENDAR } from '../../lib/seasonCalendar'
import { chooseSkin, skinsFor, useChosenSkin, type Skin } from '../../lib/skins'
import { useTickets } from '../../lib/tickets'
import { GameThumbArt } from '../GameThumbArt'
import { Panel, PanelHead } from '../Panel'
import { RewardArt } from './RewardArt'
import '../../styles/season.css'

/*
 * On a game's page: "Your car" (or bird, ship, snake…), a row of pictures to choose from, as Ramsey picked (A,
 * Garage row, 2026-10-07: "there needs to be a better way of selecting skins"). The usual look and the skins the
 * player owns, newest season first, chosen here and kept on this device (lib/skins.ts); then a few still to win,
 * dimmed, saying where: the live season's pass, at its level, or the Hangar, at its price. The row stays one line
 * however many there are (he expects "a ton of skins"), scrolling sideways; See all opens the whole garage.
 */

/** How many still-to-win skins the row shows after the player's own; the rest wait in the garage. */
const ROW_TO_WIN = 5

type Tile =
  | { kind: 'usual' }
  | { kind: 'mine'; skin: Skin }
  | { kind: 'pass'; skin: Skin; note: string }
  | { kind: 'shop'; skin: Skin; note: string }

/** "car", "bird", "ship": what a game's skins are, from their own description ("Hot Lap car"). */
function nounOf(skins: Skin[]): string {
  const word = skins[0]?.what.split(' ').pop() ?? 'look'
  return word === 'skin' ? 'snake' : word
}

function seasonName(id: number | undefined): string {
  return SEASON_CALENDAR.find((s) => s.id === id)?.name ?? 'Season'
}

/** The game's skins as tiles: the usual look, the player's own, then those to win on the live pass and in the Hangar. */
function useTiles(game: string) {
  const { owned } = useTickets()
  const store = useSeason()
  const season = liveSeason(store)
  const all = skinsFor(game)
  const mine = all.filter((s) => owned.includes(s.id)).sort((a, b) => (b.season ?? 0) - (a.season ?? 0))
  // Only the live season's are still to win: a past season's pass is over, so its skins aren't offered.
  const onPass = season
    ? [...store.rewards, ...(store.plus?.rewards ?? [])]
        .filter((r) => r.kind === 'skin' && r.game === game && !owned.includes(r.id))
        .sort((a, b) => a.level - b.level)
        .flatMap((r): Tile[] => {
          const skin = all.find((s) => s.id === r.id)
          return skin ? [{ kind: 'pass', skin, note: skin.plus ? `Pass+ · Lv ${r.level}` : `Level ${r.level}` }] : []
        })
    : []
  const inShop = all
    .filter((s) => s.price != null && !owned.includes(s.id))
    .map((skin): Tile => ({ kind: 'shop', skin, note: `${(skin.price ?? 0).toLocaleString()} tickets` }))
  const yours: Tile[] = [{ kind: 'usual' }, ...mine.map((skin): Tile => ({ kind: 'mine', skin }))]
  return { yours, onPass, inShop, season, noun: nounOf(all), any: all.length > 0 }
}

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

/** One choice: a picture and its name, and under it whose it is, or how to get it. */
function SkinTile({ game, tile, chosen, big = false }: { game: string; tile: Tile; chosen: string | null; big?: boolean }) {
  const size = big ? 84 : 72
  if (tile.kind === 'usual' || tile.kind === 'mine') {
    const id = tile.kind === 'mine' ? tile.skin.id : null
    const on = chosen === id
    return (
      <button type="button" aria-pressed={on} className={`skin-tile${on ? ' skin-tile--on' : ''}`} onClick={() => chooseSkin(game, id)}>
        <span className="skin-tile__art" aria-hidden="true">
          {tile.kind === 'mine' ? <RewardArt reward={{ kind: 'skin', id: tile.skin.id, name: tile.skin.name }} size={size} /> : <GameThumbArt slug={game} />}
        </span>
        <span className="skin-tile__name">{tile.kind === 'mine' ? tile.skin.name : 'Usual'}</span>
        <span className="skin-tile__note">{on ? 'In use' : tile.kind === 'mine' ? (tile.skin.season ? seasonName(tile.skin.season) : 'Hangar') : 'Everyone’s'}</span>
      </button>
    )
  }
  const href = tile.kind === 'pass' ? seasonHref() : `${prizesHref()}#hangar-${tile.skin.id}`
  return (
    <a className={`skin-tile skin-tile--locked${tile.kind === 'shop' ? ' skin-tile--shop' : ''}`} href={href}>
      <span className="skin-tile__art" aria-hidden="true">
        <RewardArt reward={{ kind: 'skin', id: tile.skin.id, name: tile.skin.name }} size={size} />
      </span>
      <span className="skin-tile__name">{tile.skin.name}</span>
      <span className={`skin-tile__note${tile.kind === 'shop' ? ' skin-tile__note--price' : ''}`}>{tile.note}</span>
    </a>
  )
}

export function SkinPicker({ game }: { game: string }) {
  const chosen = useChosenSkin(game)
  const { yours, onPass, inShop, season, noun, any } = useTiles(game)
  const [open, setOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const labelId = useId()
  const toWin = [...onPass, ...inShop]
  const row = [...yours, ...toWin.slice(0, ROW_TO_WIN)]
  const total = yours.length + toWin.length

  // The one in use in view, and the arrow only while there's more of the row off to the right.
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const on = el.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (on && on.offsetLeft + on.offsetWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - 8
    const sync = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      el.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [row.length])

  // Nothing to show for a game with no skins, or with only the usual look and none to win.
  if (!any || (yours.length === 1 && !toWin.length)) return null
  const title = `Your ${noun}`
  return (
    <div className="skin-pick">
      <div className="skin-pick__head">
        <span className="skin-pick__label" id={labelId}>
          {title}
        </span>
        {total > row.length || toWin.length > 0 ? (
          <button type="button" className="skin-pick__all" onClick={() => setOpen(true)}>
            See all {total}
          </button>
        ) : null}
      </div>
      <div className={`skin-pick__wrap${more ? ' skin-pick__wrap--more' : ''}`}>
        <div className="skin-pick__row" ref={rowRef} role="group" aria-labelledby={labelId}>
          {row.map((tile) => (
            <SkinTile key={tile.kind === 'usual' ? 'usual' : tile.skin.id} game={game} tile={tile} chosen={chosen} />
          ))}
        </div>
        {more ? (
          <button type="button" className="skin-pick__more" aria-label={`More ${noun}s`} onClick={() => rowRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}>
            ›
          </button>
        ) : null}
      </div>
      {open ? (
        <Garage game={game} title={title} yours={yours} onPass={onPass} inShop={inShop} seasonName={season?.name ?? null} chosen={chosen} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  )
}

/** The whole garage: every look the player has, then every one still to win, in groups. */
function Garage({
  game,
  title,
  yours,
  onPass,
  inShop,
  seasonName: live,
  chosen,
  onClose,
}: {
  game: string
  title: string
  yours: Tile[]
  onPass: Tile[]
  inShop: Tile[]
  seasonName: string | null
  chosen: string | null
  onClose: () => void
}) {
  const titleId = useId()
  const groups: [string, Tile[]][] = [
    ['Yours', yours],
    [`On the ${live ?? 'season'}’s pass`, onPass],
    ['In the Hangar', inShop],
  ]
  return (
    <Panel wide labelledBy={titleId} onClose={onClose} className="skin-garage">
      <PanelHead titleId={titleId} title={title} kicker="Looks only" onClose={onClose} />
      <div className="panel__body">
        {groups
          .filter(([, tiles]) => tiles.length)
          .map(([name, tiles]) => (
            <section key={name} className="skin-garage__group" aria-label={name}>
              <h3 className="skin-garage__name">{name}</h3>
              <div className="skin-garage__grid">
                {tiles.map((tile) => (
                  <SkinTile key={tile.kind === 'usual' ? 'usual' : tile.skin.id} game={game} tile={tile} chosen={chosen} big />
                ))}
              </div>
            </section>
          ))}
      </div>
    </Panel>
  )
}
