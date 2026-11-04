import { seasonHref } from '../hooks/useHashRoute'
import { daysLeftLabel, liveSeason, seasonProgress, useSeason } from '../lib/season'
import { SPACE } from '../lib/seasonArt'

/*
 * The card's sky, behind its words: a ringed planet in the top corner over the season's stars (Ramsey, 2026-11-04:
 * "can the space race card be jazzed up a little, like have a space like background", then "ringed planet works",
 * A of three tried: the planet, a nebula, a moon with a rocket).
 */
function HsnSky() {
  return (
    <svg className="hsn__planet" viewBox="0 0 200 160" aria-hidden="true">
      <circle cx="120" cy="70" r="46" fill={SPACE.violet} />
      <path d="M80 52 Q120 38 162 58" stroke="#a48be0" strokeWidth="7" fill="none" opacity="0.55" />
      <path d="M86 86 Q120 96 160 82" stroke="#6a4fb8" strokeWidth="6" fill="none" opacity="0.6" />
      <ellipse cx="120" cy="70" rx="88" ry="17" fill="none" stroke={SPACE.amber} strokeWidth="4" transform="rotate(-16 120 70)" opacity="0.9" />
      <circle cx="120" cy="70" r="46" fill="url(#hsn-shade)" />
      <defs>
        <radialGradient id="hsn-shade" cx="0.32" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>
    </svg>
  )
}

/**
 * The season on the simple home's rail (2 on the "Home: one games grid" canvas, 2026-11-04): its name, your level
 * with a bar to the next and the tickets it takes, and the way to the pass. Deep space in both themes, as the
 * season's own panels are, with a ringed planet over its stars. On a phone it's one slim line over the Standings (home.css .hsn).
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
      <HsnSky />
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
