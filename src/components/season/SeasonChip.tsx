import { liveSeason, seasonProgress, seasonTop, useSeason } from '../../lib/season'
import { SeasonRing } from './SeasonArt'
import '../../styles/season.css'

/*
 * The season round You: a ring that fills toward the next level, round your avatar, its level on a little
 * tag; on the phone's tab bar and the desk's header alike. The header had a chip of its own for it, beside
 * the tickets, until Ramsey picked the lighter bar (2026-10-06). Shown only while a season is live, and to a
 * player with a tag; the pass itself is a row in your menu.
 */

/** The ring round the You button's avatar, and its level. */
export function SeasonYouRing() {
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
