import { useEffect } from 'react'
import { askForOrbitronFont, askForRussoOneFont } from '../../lib/nameStyle'
import { liveSeason, useSeason } from '../../lib/season'
import { starTile } from '../../lib/seasonArt'
import '../../styles/season.css'

/*
 * The site dressed for a live season (Ramsey's pick, B, 2026-10-02): faint stars and a ringed planet behind
 * every page, stars in the header's bar, and the season's lettering. Light and dark stay as the player
 * chose: the sky has a light version and a dark one (styles/season.css), and only the season's own panels
 * are always deep space. Drawn once into custom properties on the page's root, and gone when no season is.
 *
 * Each season dresses it its own way: Space Race's stars and ringed planet, Cold Snap's snow-light stars and
 * the northern lights across the top of the sky (its tokens are in season.css under .season-cold-snap).
 */

function planet(fill: string, ring: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640"><circle cx="450" cy="320" r="250" fill="${fill}"/><ellipse cx="450" cy="320" rx="420" ry="58" fill="none" stroke="${ring}" stroke-width="5" transform="rotate(-14 450 320)"/><circle cx="90" cy="560" r="70" fill="${fill}"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** The northern lights as a soft band, drawn where Space Race's planet hangs (the same 900 × 640 box). */
function aurora(green: string, teal: string, violet: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640"><defs><filter id="b" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="26"/></filter></defs><g filter="url(#b)" fill="none" stroke-linecap="round"><path d="M40 300C200 160 360 360 560 220S820 140 880 200" stroke="${green}" stroke-width="90"/><path d="M60 380C240 280 400 430 600 320S820 260 880 300" stroke="${teal}" stroke-width="60"/><path d="M80 220C240 100 420 260 600 140S800 80 880 120" stroke="${violet}" stroke-width="56"/></g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function dressingFor(slug: string): Record<string, string> {
  if (slug === 'cold-snap') {
    return {
      '--season-stars-dark': starTile('#eef7ff', 7),
      '--season-stars-light': starTile('#4aa8e8', 7, { stars: 40, faintest: 0.25 }),
      '--season-bar-dark': starTile('#eef7ff', 3, { size: 260, height: 62, stars: 14, sparks: 0, biggest: 0.8 }),
      '--season-bar-light': starTile('#33c6d6', 3, { size: 260, height: 62, stars: 12, sparks: 0, biggest: 0.7 }),
      '--season-planet-dark': aurora('rgba(92,242,176,0.2)', 'rgba(51,198,214,0.16)', 'rgba(155,123,255,0.16)'),
      '--season-planet-light': aurora('rgba(92,242,176,0.2)', 'rgba(51,198,214,0.14)', 'rgba(155,123,255,0.13)'),
    }
  }
  return {
    '--season-stars-dark': starTile('#f4f0ff', 7),
    '--season-stars-light': starTile('#6b74e8', 7, { stars: 40, faintest: 0.25 }),
    '--season-bar-dark': starTile('#f4f0ff', 3, { size: 260, height: 62, stars: 14, sparks: 0, biggest: 0.8 }),
    '--season-bar-light': starTile('#8a6ad4', 3, { size: 260, height: 62, stars: 12, sparks: 0, biggest: 0.7 }),
    '--season-planet-dark': planet('rgba(138,106,212,0.17)', 'rgba(245,185,66,0.24)'),
    '--season-planet-light': planet('rgba(138,106,212,0.12)', 'rgba(242,129,58,0.26)'),
  }
}

/** The season's lettering, from Google Fonts like Outfit, asked for only while it's live. */
export function askForSeasonFont(slug: string | null | undefined) {
  if (slug === 'cold-snap') askForRussoOneFont()
  else if (slug) askForOrbitronFont()
}

export function SeasonDressing() {
  const season = liveSeason(useSeason())
  const slug = season?.slug ?? null
  useEffect(() => {
    if (!slug) return
    askForSeasonFont(slug)
    const root = document.documentElement
    const vars = dressingFor(slug)
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)
    root.classList.add('season-on', `season-${slug}`)
    return () => {
      root.classList.remove('season-on', `season-${slug}`)
      for (const key of Object.keys(vars)) root.style.removeProperty(key)
    }
  }, [slug])
  return null
}
