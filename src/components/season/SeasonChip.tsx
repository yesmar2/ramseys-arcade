import { liveSeason, seasonProgress, seasonTop, useSeason } from '../../lib/season'
import '../../styles/season.css'

/*
 * The season on the You button: your level as a word, "Lv 33", with a thin bar under it for how close the next
 * level is, beside your rank. Ramsey picked it (A on the "Header You button, tidied" canvas, 2026-10-09) over
 * the ring round your avatar with a level tag on it, which with the alert dot made the avatar busy. The phone's
 * tab bar shows just your avatar: the level is on the Season page and in your menu. Shown only while a season
 * is live, and to a player with a tag.
 */

/** Your season level and the way to the next, for the You button. */
export function SeasonYouLevel() {
  const store = useSeason()
  const season = liveSeason(store)
  if (!season) return null
  const p = seasonProgress(season, store.you, seasonTop(store))
  return (
    <span className="site-you__lv" aria-hidden="true">
      <span className="site-you__lv-n">Lv {p.level}</span>
      <span className="site-you__lv-bar">
        <span style={{ width: `${Math.round(p.fraction * 100)}%` }} />
      </span>
    </span>
  )
}
