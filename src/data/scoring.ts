export type ScoreRow = {
  label: string
  value: string
}

const SCORING: Record<string, ScoreRow[]> = {
  stacker: [
    { label: 'Place a block', value: '+1' },
    { label: 'Perfect drop', value: 'keeps full size' },
    { label: 'Five perfects', value: 'platform grows' },
  ],
  patriot: [
    { label: 'Splash hit', value: '+25' },
    { label: 'Direct hit', value: '+100' },
    { label: 'City saved (wave clear)', value: '+100' },
    { label: 'Perfect wave', value: 'all 6 cities' },
    { label: 'Unused ammo (wave clear)', value: '+5 each' },
    { label: 'Clean wave', value: 'rebuild a city' },
    { label: 'Plane shot down', value: '+200' },
    { label: 'Power drone', value: 'set waves, some send two' },
    { label: 'Hold', value: 'up to 3 of each' },
    { label: 'Ammo (1)', value: '+10 per turret' },
    { label: 'Shield (2)', value: 'cities safe 5s' },
    { label: 'Slow (3)', value: 'sky crawls 5s' },
    { label: 'Seeker (4)', value: 'locks nearest missile, chains on hit' },
    { label: 'Violet missile', value: 'splits halfway' },
  ],
  snake: [
    { label: 'Food', value: '+10' },
    { label: 'Crash', value: 'game over' },
  ],
  pop: [
    { label: 'Hit', value: '+10' },
    { label: 'Center hit', value: '+30' },
    { label: 'Gold', value: '+25' },
    { label: 'Gold center', value: '+70' },
    { label: 'Streak bonus', value: '+5 each, cap +20' },
    { label: 'Round', value: '45 seconds' },
  ],
  simon: [
    { label: 'Score', value: 'rounds completed' },
    { label: 'Wrong pad', value: 'game over' },
  ],
  'centroid': [
    { label: 'Closer to center', value: 'more points' },
    { label: 'Dead-on', value: 'up to 1100' },
    { label: 'Time left (if close)', value: 'small bonus' },
    { label: 'Round', value: '10 shapes · 5s each' },
  ],
  crosswalk: [
    { label: 'Score', value: 'rows forward' },
    { label: 'Traffic', value: 'one hit ends the run' },
    { label: 'Fall behind', value: 'screen catches you' },
    { label: 'Trees', value: 'block your hop' },
  ],
  spotter: [
    { label: 'Daily hunt', value: 'same puzzle for everyone' },
    { label: 'Wrong tap', value: '+3 seconds' },
    { label: 'Hint (poster wall)', value: '+15 seconds' },
    { label: 'Board ranks', value: 'fastest adjusted time' },
  ],
  asteroids: [
    { label: 'Large rock', value: '+20' },
    { label: 'Medium rock', value: '+50' },
    { label: 'Small rock', value: '+100' },
    { label: 'Combo (hits within 0.75s)', value: 'score up to 2×' },
    { label: 'Wave 1 / 2 / 3 clear', value: '+100 / +150 / +200' },
    { label: 'Time under par', value: '+20 / sec' },
    { label: 'Par', value: '48s, −2s each wave' },
    { label: 'Extra life', value: 'every 3 waves' },
    { label: 'Saucers', value: 'from wave 3' },
    { label: 'Small saucer missile', value: 'seek · shoot down +150' },
    { label: 'Rapid (pickup)', value: 'faster fire' },
    { label: 'Spread (pickup)', value: 'triple shot' },
    { label: 'Shield (pickup)', value: 'brief invulnerability' },
    { label: 'Slow (pickup)', value: 'rocks crawl' },
    { label: 'Powerup on field', value: 'vanishes after 6s' },
  ],
  pellets: [
    { label: 'Crumb', value: '+10 × streak' },
    { label: 'Streak (fresh crumbs in a row)', value: '×2 at 10 · ×3 at 20 · ×4 at 30' },
    { label: 'Doubling back over cleared ground', value: 'streak resets' },
    { label: 'Power crumb', value: '+50 · chasers turn blue' },
    { label: 'Blue chaser (1st / 2nd / 3rd / 4th)', value: '+200 / +400 / +800 / +1600' },
    { label: 'Surge (tap or space when charged)', value: 'double crumbs · bounce chasers' },
    { label: 'Surge bounce (1st / 2nd / 3rd / 4th)', value: '+150 / +300 / +600 / +1200' },
    { label: 'Clear the maze', value: 'next level · curated maze, a bit tougher' },
    { label: 'Lives', value: '3' },
  ],
}

export function scoringFor(slug: string): ScoreRow[] | null {
  return SCORING[slug] ?? null
}
