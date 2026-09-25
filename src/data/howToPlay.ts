/*
 * How to play each game, in the same parts wherever it shows (the game's page
 * and the How to play panel in the game): what you're after, the controls,
 * what scores, what ends a run, and one tip where a game has a trap you would
 * otherwise miss. Only what a player needs before a first run; the rest they
 * learn by playing.
 *
 * A control names what it does, then how on a touch screen and how on a
 * keyboard. A phone shows only the touch one.
 *
 * Numbers here have to match the games. Frenzy scales every award down 100×,
 * so its fish pay a tenth of their number, and Asteroids fires by itself.
 */

export type HowToControl = {
  /** What it does: Turn, Drop the block. */
  does: string
  /** The gesture or on-screen button. */
  touch: string
  /** The key, or the mouse where that is the way. */
  keys: string
}

export type HowToScore = {
  what: string
  /** What it pays, as it reads beside the row: +10, up to ×3. */
  pts: string
  /** A second line under the points, when they need one. */
  sub?: string
}

export type HowToPlay = {
  /** One line: what a run is for. */
  goal: string
  controls: HowToControl[]
  /** Something the game does for you, said under the controls. */
  auto?: string
  /** Four rows at most. */
  scores: HowToScore[]
  /** What ends a run. */
  ends: string
  tip?: string
}

export const HOW_TO_PLAY: Record<string, HowToPlay> = {
  asteroids: {
    goal: 'Clear every rock, wave after wave.',
    controls: [
      { does: 'Turn', touch: '◀ ▶', keys: '← →' },
      { does: 'Thrust', touch: '▲', keys: '↑' },
      { does: 'Hyperspace', touch: '✦', keys: '↓' },
    ],
    auto: 'Your ship fires by itself.',
    scores: [
      { what: 'Rock', pts: '20 · 50 · 100', sub: 'big to small' },
      { what: 'Hits in quick succession', pts: 'up to ×2' },
      { what: 'Wave cleared', pts: '+100 and up' },
      { what: 'Under the wave’s par time', pts: '+20 a second' },
    ],
    ends: 'All three ships are lost.',
    tip: 'A new ship every third wave. Saucers join from wave 3.',
  },
  patriot: {
    goal: 'Keep your six cities standing.',
    controls: [
      { does: 'Fire where you aim', touch: 'Tap', keys: 'Click' },
      { does: 'Use a power', touch: 'Badges', keys: '1–4' },
    ],
    scores: [
      { what: 'Missile destroyed', pts: '+25' },
      { what: 'Each kill in a chain', pts: '×2, ×3 … up to ×8' },
      { what: 'Direct hit', pts: '+100' },
      { what: 'City standing at wave end', pts: '+100' },
    ],
    ends: 'The last city falls.',
    tip: 'Burst where trails cross to chain them. Each turret has 10 shells a wave.',
  },
  snake: {
    goal: 'Eat, grow, don’t crash.',
    controls: [
      { does: 'Turn', touch: 'Swipe', keys: 'Arrows' },
      { does: 'Boost', touch: 'Hold the bolt', keys: 'Hold Space' },
    ],
    scores: [
      { what: 'Fruit', pts: '+10' },
      { what: 'Reached before its ring closes', pts: '+2 more each', sub: 'up to +30' },
      { what: 'Golden apple · mouse', pts: '+50' },
    ],
    ends: 'You hit a wall, a stone or yourself.',
    tip: 'Dashed outlines show where the next level’s stones will land.',
  },
  crosswalk: {
    goal: 'Hop as far as you can.',
    controls: [
      { does: 'Hop', touch: 'Tap · swipe', keys: 'Arrows' },
    ],
    scores: [
      { what: 'Every new row', pts: '+1' },
    ],
    ends: 'Traffic, a train, the water, or 10 seconds without a new row.',
    tip: 'Coins and chains are records of their own. They don’t add to your score.',
  },
  stacker: {
    goal: 'Stack as high as you can.',
    controls: [
      { does: 'Drop the block', touch: 'Tap', keys: 'Space' },
    ],
    scores: [
      { what: 'Block placed', pts: '+1' },
    ],
    ends: 'A block misses the stack.',
    tip: 'A perfect drop keeps its full width. Five in a row make it grow.',
  },
  centroid: {
    goal: 'Pin each plate at its balance point.',
    controls: [
      { does: 'Set the pin', touch: 'Tap', keys: 'Arrows, then Space' },
    ],
    scores: [
      { what: 'Balanced', pts: '+20 to +100', sub: 'closer pays more' },
      { what: 'Dead center', pts: '+30' },
      { what: 'Quick', pts: 'up to +20' },
      { what: 'Balanced in a row', pts: 'up to ×1.4' },
    ],
    ends: 'Your pins run out. A fallen plate costs one.',
    tip: 'Ten balanced in a row win a pin back.',
  },
  pop: {
    goal: 'Pop bubbles before they fade.',
    controls: [
      { does: 'Pop', touch: 'Tap', keys: 'Click' },
    ],
    scores: [
      { what: 'Bubble', pts: '+10' },
      { what: 'Its bright center', pts: '+30' },
      { what: 'Gold bubble', pts: '+25', sub: 'center +70' },
      { what: 'Pops in a row', pts: 'up to +20 more' },
    ],
    ends: 'After 45 seconds.',
    tip: 'Let a bubble fade and your streak resets.',
  },
  pellets: {
    goal: 'Clear the maze, level after level.',
    controls: [
      { does: 'Steer', touch: 'Swipe', keys: 'Arrows' },
      { does: 'Surge, when charged', touch: 'Tap', keys: 'Space' },
    ],
    scores: [
      { what: 'Crumb', pts: '+10 × streak' },
      { what: 'Fresh crumbs in a row', pts: '×2 at 10', sub: 'up to ×8' },
      { what: 'Blue chaser', pts: '+200', sub: 'doubling to +1,600' },
      { what: 'Fruit', pts: '+100 and up' },
    ],
    ends: 'Caught three times.',
    tip: 'Doubling back over eaten ground resets the streak.',
  },
  findbug: {
    goal: 'Find the bug on the card, five times, fast.',
    controls: [
      { does: 'Pick a bug', touch: 'Tap', keys: 'Arrows, then Space' },
      { does: 'Zoom and look around', touch: 'Pinch · drag', keys: '+ −' },
    ],
    scores: [
      { what: 'Your score', pts: 'total time', sub: 'fastest wins' },
      { what: 'Wrong tap', pts: '1.5s dazed' },
    ],
    ends: 'After the fifth bug.',
    tip: 'Only one bug matches all four clues: colours, hat, glasses and what it holds.',
  },
  barrage: {
    goal: 'Dodge the bullets. Break the ships.',
    controls: [
      { does: 'Fly (Shift to slow)', touch: 'Drag', keys: 'Arrows' },
      { does: 'Let a Barrage go', touch: 'Double-tap · 2nd finger', keys: 'Space' },
    ],
    auto: 'Your ship fires by itself.',
    scores: [
      { what: 'Ship broken', pts: '7 to 100 × heat' },
      { what: 'Bullet grazed', pts: '+3 × heat', sub: 'and it charges your Barrage' },
      { what: 'Barrage', pts: '1 a bullet', sub: '5 if grazed, × heat' },
      { what: 'Wave cleared', pts: '100 × the wave' },
    ],
    ends: 'All your ships are lost.',
    tip: 'Only the white dot at your ship’s heart can be hit. Catch the gold diamonds ships drop: each is a third of a Barrage.',
  },
  crumbtrail: {
    goal: 'Climb the endless maze.',
    controls: [
      { does: 'Steer', touch: 'Swipe', keys: 'Arrows' },
      { does: 'Surge, when charged', touch: 'Tap', keys: 'Space' },
    ],
    scores: [
      { what: 'Row climbed', pts: '+5' },
      { what: 'Crumb', pts: '+10 × streak' },
      { what: 'Blue chaser', pts: '+200', sub: 'doubling to +1,600' },
    ],
    ends: 'Caught, or the tide catches you. One life.',
    tip: 'Stop climbing and the tide rises.',
  },
  bop: {
    goal: 'Do what the toy calls, fast.',
    controls: [
      { does: 'Bop', touch: 'Tap the button', keys: 'Space' },
      { does: 'Twist', touch: 'Drag the knob', keys: '← →' },
      { does: 'Pull', touch: 'Pull the lever', keys: '↓' },
      { does: 'Flick', touch: 'Flick the switch', keys: '↑' },
      { does: 'Spin', touch: 'Spin the wheel', keys: 'S' },
    ],
    scores: [
      { what: 'Right move', pts: '+1' },
      { what: 'Inside half the ring', pts: '+1 more' },
    ],
    ends: 'A wrong move, or too slow.',
  },
  putt: {
    goal: 'Seven holes of mini golf: two short, five long.',
    controls: [
      { does: 'Shoot', touch: 'Pull back, let go', keys: 'Arrows, hold Space' },
      { does: 'Look ahead', touch: 'Drag the map', keys: '↑ ↓' },
    ],
    scores: [
      { what: 'Each hole', pts: 'par 200', sub: 'birdie 300 · eagle 400' },
      { what: 'Bogey', pts: '100' },
      { what: 'Hole in one', pts: '+200 more' },
    ],
    ends: 'After seven holes. Par is 39.',
    tip: 'Water, or rolling off an edge, costs a stroke.',
  },
  frenzy: {
    goal: 'Eat smaller fish. Don’t get eaten.',
    controls: [
      { does: 'Swim', touch: 'Drag', keys: 'Mouse or arrows' },
      { does: 'Dash', touch: 'Tap', keys: 'Space' },
    ],
    scores: [
      { what: 'Fish with a green number', pts: 'its number ÷ 10', sub: 'at least 1' },
      { what: 'Bites in quick succession', pts: 'up to ×3' },
      { what: 'Eight in a row', pts: 'Frenzy ×2' },
      { what: 'Deeper water', pts: '×2 · ×3 · ×5' },
    ],
    ends: 'A red number eats you. One life.',
    tip: 'Red numbers flash ! before they lunge. Dash past.',
  },
  fireflies: {
    goal: 'Sing their tunes back. Light five lanterns a night.',
    controls: [
      { does: 'Pick a firefly', touch: 'Tap', keys: '1–6' },
    ],
    scores: [
      { what: 'Note sung back', pts: '+1' },
      { what: 'Firefly caught in a Catch', pts: '+1' },
      { what: 'The one you followed', pts: '+3' },
      { what: 'All five lanterns lit', pts: '+5' },
    ],
    ends: 'One wrong note in a tune.',
    tip: 'A lost Catch or Follow only leaves its lantern dark.',
  },
}

export function howToPlayFor(slug: string): HowToPlay | null {
  return HOW_TO_PLAY[slug] ?? null
}

/** The same as plain sentences, for a page's text where there is no layout: what search engines read. */
export function howToPlaySentences(slug: string): string[] {
  const how = howToPlayFor(slug)
  if (!how) return []
  const scores = how.scores.map((s) => `${s.what}: ${s.pts}${s.sub ? ` (${s.sub})` : ''}`).join('. ')
  const ends = how.ends.charAt(0).toLowerCase() + how.ends.slice(1)
  return [how.goal, `What scores. ${scores}.`, `How a run ends: ${ends}`]
}
