import { seasonHref } from '../hooks/useHashRoute'
import { daysLeftLabel, liveSeason, seasonProgress, useSeason } from '../lib/season'

/**
 * The season on the simple home's rail (2 on the "Home: one games grid" canvas, 2026-11-04): its name, your level
 * with a bar to the next and the tickets it takes, and the way to the pass. Deep space in both themes, as the
 * season's own panels are. On a phone it's one slim line over the Standings (home.css .hsn).
 */
export function HomeSeasonCard() {
  const store = useSeason()
  const season = liveSeason(store)
  if (!season) return null
  const you = store.you
  const p = seasonProgress(season, you)
  const into = p.level > 0 ? Math.round(p.fraction * season.perLevel) : 0
  const line = !you
    ? 'Every game wins you tickets, and they climb the pass.'
    : p.level <= 0
      ? 'Win a ticket in any game to start the pass.'
      : p.toNext != null
        ? `${into} / ${season.perLevel} tickets to Level ${p.level + 1}`
        : 'You’ve reached the top of the pass.'
  return (
    <a className="hsn" href={seasonHref()} aria-label={`${season.name}: ${you && p.level > 0 ? `level ${p.level}. ` : ''}${line}`} data-hunt="home-onnow">
      <span className="hsn__kick">
        Season {season.id} · {daysLeftLabel(season)}
      </span>
      <span className="hsn__name">{season.name}</span>
      <span className="hsn__level">
        {you && p.level > 0 ? <b>Level {p.level}</b> : null}
        <span className="hsn__bar" aria-hidden="true">
          <span style={{ width: `${Math.round((p.level > 0 ? p.fraction : 0) * 100)}%` }} />
        </span>
      </span>
      <span className="hsn__line">{line}</span>
      <span className="hsn__more" aria-hidden="true">
        See the pass ›
      </span>
    </a>
  )
}
