import { BOARD_NAMES } from '../lib/dailyWords'

/*
 * How to play each game, in the same parts wherever it shows (the game's page
 * and the How to play panel in the game): what you're after, the controls,
 * what scores, what ends a run, and one tip where a game has a trap you would
 * otherwise miss. Only what a player needs before a first run; the rest they
 * learn by playing. A daily adds what counts: today's course toward your rank,
 * a past one on its All time board or as practice.
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

/**
 * What a daily's run counts toward: today's course, then a past one. `kind` is the label it wears, the
 * same words everywhere (components/RunLabel.tsx): counts toward your rank, its All time board and not
 * your rank, or practice that saves nothing.
 */
export type HowToCount = {
  /** Today’s track, A past track. */
  what: string
  kind: 'counts' | 'fun' | 'board' | 'practice'
  /** What becomes of the result, in a line. */
  sub: string
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
  /** A daily's: what today's run counts toward, and what a past course's does (components/WhatCounts.tsx). */
  counts?: HowToCount[]
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
    tip: 'Hop onto tickets to spend at the prize counter. They don’t add to your score.',
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
    goal: 'Find the bug on each card, in today’s five scenes, fast. New scenes come every day at midnight, New York time.',
    controls: [
      { does: 'Pick a bug', touch: 'Tap', keys: 'Arrows, then Space' },
      { does: 'Zoom and look around', touch: 'Pinch · drag', keys: '+ −' },
    ],
    scores: [
      { what: 'Your score', pts: 'total time', sub: 'the faster the better' },
      { what: 'Wrong tap', pts: '1.5s dazed' },
      { what: 'Not found', pts: 'the whole minute' },
    ],
    ends: 'After the fifth scene. Your first run of the day is your result; after that, play it again for practice.',
    tip: 'Only one bug matches all four clues: colours, hat, glasses and what it holds.',
    counts: [
      {
        what: 'Today’s Wanted',
        kind: 'fun',
        sub: 'Your first run today is your result: it punches today’s Dailies and keeps your days in a row. Just for fun: nobody is ranked on it. Runs after it are practice.',
      },
      { what: 'A past day', kind: 'practice', sub: 'Play any past day. Nothing is saved.' },
    ],
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
    tip: 'Turn the sound up: the toy says each call out loud.',
  },
  putt: {
    goal: 'Five holes of mini golf, each with a trick to it.',
    controls: [
      { does: 'Shoot', touch: 'Pull back, let go', keys: 'Arrows, hold Space' },
      { does: 'Look ahead', touch: 'Drag the map', keys: '↑ ↓' },
    ],
    scores: [
      { what: 'Each hole', pts: 'par 200', sub: 'birdie 300 · eagle 400' },
      { what: 'Bogey', pts: '100' },
      { what: 'Hole in one', pts: '+200 more' },
    ],
    ends: 'After five holes. Par is 10.',
    tip: 'Water, lava, or flying off the course costs a stroke.',
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
  acechase: {
    goal: 'Stop the ball on today’s bullseye in as few tries as you can. A new hole comes every day at midnight, New York time.',
    controls: [
      { does: 'Set the shot', touch: 'Tap − and +, or type', keys: '↑ ↓ power · ← → angle' },
      { does: 'Putt', touch: 'Tap Putt', keys: 'Space' },
      { does: 'Look around', touch: 'Drag · pinch · two fingers', keys: 'Drag · scroll · right-drag' },
      { does: 'Read the green', touch: 'Double-tap a spot · Slopes', keys: 'Double-click a spot · Slopes' },
    ],
    scores: [
      { what: 'Your score', pts: 'the tries your first bullseye took', sub: 'the fewer the better' },
      { what: 'Every try', pts: 'counts', sub: 'even if you leave and come back' },
    ],
    ends: 'At your first bullseye. After that, play it again for practice; that doesn’t count.',
    tip: 'Each miss says how far off it was. Double-tap the green, or turn on Slopes, to see which way it runs.',
    // Ace Chase is just for fun (data/games.ts Game.ranked): a past hole keeps no board, so it's practice.
    counts: [
      {
        what: 'Today’s hole',
        kind: 'fun',
        sub: 'Your first bullseye today is your result: it punches today’s Dailies and keeps your days in a row. Just for fun: nobody is ranked on it.',
      },
      { what: 'A past hole', kind: 'practice', sub: 'Play any past hole as often as you like. Nothing is saved.' },
    ],
  },
  hotlap: {
    goal: 'The fastest lap of today’s track. A new one comes every day at midnight, New York time.',
    controls: [
      { does: 'Gas', touch: 'Gas, right thumb', keys: '↑ or W' },
      { does: 'Brake', touch: 'Brake, right thumb', keys: '↓, S or Space' },
      { does: 'Steer', touch: '◀ ▶, left thumb', keys: '← → or A D' },
      { does: 'Start the lap again', touch: '↻', keys: 'R' },
    ],
    scores: [
      { what: 'Your score', pts: 'your best lap today', sub: 'fastest wins the day' },
      { what: 'A cut across the grass', pts: 'no time', sub: 'the lap can’t count' },
    ],
    ends: 'At the line, one lap from the start. Drive it as often as you like.',
    tip: 'The call under the clock names the next corner and counts down to it: orange means brake hard. Brake in a straight line, then squeeze back on the gas as the corner opens out. The ghost is the lap to beat.',
    counts: [
      {
        what: 'Today’s track',
        kind: 'counts',
        sub: 'Your best lap today goes on today’s board, your week and your rank.',
      },
      {
        what: 'A past track',
        kind: 'board',
        sub: `Your best lap goes on that track’s ${BOARD_NAMES.allTime} board, not your rank. Taking its record pays 15 tickets, once.`,
      },
    ],
  },
  halffull: {
    goal: 'Fill each of today’s glasses exactly half full: by what it holds, not how tall it is. New glasses every day at midnight, New York time.',
    controls: [
      { does: 'Pour · take back', touch: 'Drag up or down · ▲ ▼', keys: '↑ ↓ (Shift for a hair)' },
      { does: 'Share the last glass', touch: 'Drag up on a glass, or sideways · ◀ ▶', keys: '← →' },
      { does: 'Done', touch: 'That’s half · That’s fair', keys: 'Enter or Space' },
    ],
    scores: [
      { what: 'Each glass', pts: 'up to 100', sub: 'less 2 for every point off half: 45% full scores 90' },
      { what: 'The last glass', pts: 'up to 100', sub: 'a fair share: 58 to 42 scores 84' },
      { what: 'Your day', pts: 'the average of the five' },
    ],
    ends: 'After the fifth glass. Your first pour of the day is your result; after that, pour it again for practice.',
    tip: 'Wide at the top? Half is higher than it looks. Narrow at the top? Lower. And some glasses are just what they look like.',
    counts: [
      {
        what: 'Today’s Pour',
        kind: 'fun',
        sub: 'Your first pour today is your result: it punches today’s Dailies and keeps your days in a row. Just for fun: nobody is ranked on it. Pours after it are practice.',
      },
      { what: 'A past day', kind: 'practice', sub: 'Pour any past day. Nothing is saved.' },
    ],
  },
  marblerun: {
    goal: 'The fastest run down today’s course. A new one comes every day at midnight, New York time.',
    controls: [
      { does: 'Tilt the world', touch: 'Drag anywhere', keys: '← → ↑ ↓ or WASD' },
      { does: 'Start the run again', touch: '↻', keys: 'R' },
    ],
    scores: [
      { what: 'Your score', pts: 'your best run today', sub: 'fastest wins the day' },
      { what: 'Off the edge', pts: 'the time it takes', sub: 'back to the last checkpoint, clock running' },
    ],
    ends: 'At the goal. Roll it as often as you like.',
    tip: 'The marble keeps its speed until you lean the other way: ease off before a curve, a narrow or a jump, and let it run down the straights. The ghost is the run to beat.',
    counts: [
      {
        what: 'Today’s course',
        kind: 'counts',
        sub: 'Your best run today goes on today’s board, your week and your rank.',
      },
      { what: 'A past course', kind: 'practice', sub: 'Roll any past course. Nothing is saved: no board, no tickets, no rank.' },
    ],
  },
  lander: {
    goal: 'Fly down today’s cave and land on the pad at the bottom, fastest. A new cave comes every day at midnight, New York time.',
    controls: [
      { does: 'Turn', touch: 'Drag anywhere: the nose points the way you drag', keys: '← → or A D' },
      { does: 'Engine', touch: 'Drag further for more', keys: '↑, W or Space' },
      { does: 'Start the run again', touch: '↻', keys: 'R' },
    ],
    scores: [
      { what: 'Your score', pts: 'your best run today', sub: 'fastest wins the day' },
      { what: 'Bump the rock', pts: 'nothing', sub: 'a gentle knock bounces you off' },
      { what: 'Hit the rock hard', pts: 'the time it takes', sub: 'back to the last gate, clock running' },
    ],
    ends: 'Down on the landing pad, slowly and level. Fly it as often as you like.',
    tip: 'Gravity is free speed: let the ship fall down the shafts, then turn the nose up and brake before the bottom. Let go of everything and the ship rights itself. Come down onto the pad slowly and level: the speed by your ship turns green when it’s slow enough.',
    counts: [
      {
        what: 'Today’s cave',
        kind: 'counts',
        sub: 'Your best run today goes on today’s board, your week and your rank.',
      },
      { what: 'A past cave', kind: 'practice', sub: 'Fly any past cave. Nothing is saved: no board, no tickets, no rank.' },
    ],
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
  const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
  const ends = lower(how.ends)
  const sentences = [how.goal, `What scores. ${scores}.`, `How a run ends: ${ends}`]
  if (how.counts?.length) sentences.push(`What counts. ${how.counts.map((c) => `${c.what}: ${lower(c.sub)}`).join(' ')}`)
  return sentences
}
