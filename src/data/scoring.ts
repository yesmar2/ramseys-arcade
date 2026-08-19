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
    { label: 'Two clean waves', value: 'rebuild a city' },
    { label: 'Plane shot down', value: '+200' },
    { label: 'Power drone', value: 'set waves, some send two' },
    { label: 'Hold', value: 'up to 3 of each' },
    { label: 'Ammo (1)', value: '+10 per turret' },
    { label: 'Shield (2)', value: 'cities safe 5s' },
    { label: 'Slow (3)', value: 'sky crawls 5s' },
    { label: 'Burst (4)', value: 'blast chains on hits' },
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
  'dead-center': [
    { label: 'Closer to center', value: 'more points' },
    { label: 'Dead-on', value: 'up to 1100' },
    { label: 'Time left (if close)', value: 'small bonus' },
    { label: 'Round', value: '5 shapes · 5s each' },
  ],
  asteroids: [
    { label: 'Large rock', value: '+20' },
    { label: 'Medium rock', value: '+50' },
    { label: 'Small rock', value: '+100' },
    { label: 'Combo (hits within 0.75s)', value: 'score up to 2×' },
    { label: 'Wave 1 / 2 / 3 clear', value: '+100 / +150 / +200' },
    { label: 'Time under par', value: '+20 / sec' },
    { label: 'Par', value: '48s, −2s each wave' },
  ],
}

export function scoringFor(slug: string): ScoreRow[] | null {
  return SCORING[slug] ?? null
}
