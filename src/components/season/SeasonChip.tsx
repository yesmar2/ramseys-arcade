import { seasonHref } from '../../hooks/useHashRoute'
import { liveSeason, seasonProgress, seasonTop, useSeason } from '../../lib/season'
import { SeasonRing } from './SeasonArt'
import '../../styles/season.css'

/*
 * The season in the header: a ring that fills toward the next level, the level in the middle, beside the
 * tickets (desk); and on a phone, where the header has no room, the same ring round the You button in the
 * tab bar, its level on a little tag. Shown only while a season is live, and to a player with a tag.
 */

export function SeasonChip({ here }: { here: boolean }) {
  const store = useSeason()
  const season = liveSeason(store)
  if (!season) return null
  const p = seasonProgress(season, store.you, seasonTop(store))
  const label =
    p.level > 0
      ? `Season ${season.id}, ${season.name}: level ${p.level} of ${seasonTop(store)}`
      : `Season ${season.id}, ${season.name}: win a ticket to start the pass`
  return (
    <a className={`season-chip${here ? ' season-chip--here' : ''}`} href={seasonHref()} aria-label={label} title={label}>
      <SeasonRing level={p.level} progress={p.fraction} size={34} track="var(--season-ring-track)" ink="currentColor" showLevel={p.level > 0} />
    </a>
  )
}

/** The ring round the You button's avatar, and its level, for the phone's tab bar. */
export function SeasonTabRing() {
  const store = useSeason()
  const season = liveSeason(store)
  if (!season) return null
  const p = seasonProgress(season, store.you, seasonTop(store))
  return (
    <>
      <span className="season-tabring" aria-hidden="true">
        <SeasonRing level={p.level} progress={p.fraction} size={40} track="var(--season-ring-track)" ink="currentColor" showLevel={false} />
      </span>
      {p.level > 0 ? (
        <span className="season-tablv" aria-hidden="true">
          {p.level}
        </span>
      ) : null}
    </>
  )
}
