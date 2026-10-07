import { seasonHref } from '../../hooks/useHashRoute'
import { isSpotlight, liveSeason, useSeason, type SeasonInfo } from '../../lib/season'
import { useTickets } from '../../lib/tickets'
import { RewardArt } from './RewardArt'
import { SeasonPatch } from './SeasonLook'
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
        {skin ? <RewardArt reward={skin} size={48} /> : <SeasonPatch size={44} slug={season.slug} />}
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

/**
 * The season on the home page's welcome banner, a first visit's (HomeHero.tsx): the welcome stays what the
 * arcade is, with Play first, and this says there's a season on and where its free pass is.
 */
export function SeasonWelcomeCard({ season }: { season: SeasonInfo }) {
  return (
    <a className="season-spotcard season-spotcard--welcome" href={seasonHref()}>
      <span className="season-spotcard__art" aria-hidden="true">
        <SeasonPatch size={44} slug={season.slug} />
      </span>
      <span className="season-spotcard__text">
        <b>
          Season {season.id} · {season.name}
        </b>
        Win tickets in any game to climb a free pass of {season.levels} levels.
      </span>
      <span className="season-spotcard__go">See the pass</span>
    </a>
  )
}
