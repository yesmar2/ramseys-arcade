import { useSeasonSlug } from '../../lib/season'
import { AuroraScene, FrostPatch } from './ColdSnapArt'
import { MissionPatch, MoonScene } from './SeasonArt'

/*
 * The live season's own pictures, wherever the site shows "the season" without naming one: its patch (the level
 * badge on the pass, the run report, the menu) and its banner's scene. Space Race's mission patch and moon,
 * Cold Snap's aurora patch and frozen lake; a season with no pictures of its own yet shows Space Race's.
 */

type PatchProps = { label?: string; size: number; className?: string }

export function SeasonPatch({ slug: pick, ...props }: PatchProps & { slug?: string | null }) {
  const live = useSeasonSlug()
  const slug = pick === undefined ? live : pick
  return slug === 'cold-snap' ? <FrostPatch {...props} /> : <MissionPatch {...props} />
}

export function SeasonScene({ slug }: { slug: string }) {
  return slug === 'cold-snap' ? <AuroraScene /> : <MoonScene />
}
