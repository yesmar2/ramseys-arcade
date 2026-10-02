import { seasonHref } from '../../hooks/useHashRoute'
import { isSpotlight, liveSeason, useSeason } from '../../lib/season'
import { useTickets } from '../../lib/tickets'
import { RewardArt } from './RewardArt'
import { MissionPatch } from './SeasonArt'
import '../../styles/season.css'

/*
 * A season's spotlight on one of its games' pages: a tag beside the game's kind, and a card under Play
 * with the skin the pass has for it and the level it's at.
 */

export function SpotlightCard({ slug, name }: { slug: string; name: string }) {
  const store = useSeason()
  const { owned } = useTickets()
  const season = liveSeason(store)
  if (!season || !isSpotlight(season, slug)) return null
  const skin = store.rewards.find((r) => r.kind === 'skin' && r.game === slug) ?? null
  const yours = skin != null && (owned.includes(skin.id) || (store.you?.level ?? 0) >= skin.level)
  return (
    <a className="season-spotcard" href={seasonHref()}>
      <span className="season-spotcard__art" aria-hidden="true">
        {skin ? <RewardArt reward={skin} size={48} /> : <MissionPatch size={44} />}
      </span>
      <span className="season-spotcard__text">
        <b>
          Season {season.id} · {season.name}
        </b>
        {skin
          ? yours
            ? `The ${skin.name} is yours, for ${name}.`
            : `The ${skin.name}, a ${skin.what.toLowerCase()}, is at Level ${skin.level} of the pass.`
          : `${name} is in this season’s spotlight.`}
      </span>
      <span className="season-spotcard__go">See the pass</span>
    </a>
  )
}
