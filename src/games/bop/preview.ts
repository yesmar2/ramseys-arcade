import { runPreview, type Sim } from '../previewKit'
import { CONTROLS, act, createInitialState, startGame, tick, type Control, type GameState } from './game'
import { renderGame } from './render'

/*
 * Bop playing itself, for its cabinet on the home page: the game's own toy,
 * engine and renderer, and a pilot that answers each call the way a person
 * does, a beat after it comes up on the screen. While the window is wide it
 * is quick and sure; as the window closes its answers spread out, and sooner
 * or later one comes too late, or the hand goes to the wrong control.
 */

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

/**
 * The toy's own side margin, kept above it too. On the game's page the top
 * leaves room for the score and buttons; a cabinet's screen has neither.
 */
function topFor(w: number, h: number) {
  return Math.max(12, Math.min(w, h) * 0.035)
}

/**
 * How likely the hand is to go to the wrong control, with this many
 * answered: never early on, then a little more with every answer.
 */
function slipChance(answered: number) {
  return Math.max(0, answered - 25) * 0.00025
}

export function makeSim(): Sim<GameState> {
  // The call the pilot has read, known by how many it had answered when it came up.
  let readFor = -1
  // What it will do about that call, and how long until it does.
  let answer: Control = 'bop'
  let waitFor = 0
  // The control its hand went to last, which is where a slip tends to go.
  let lastUsed: Control | null = null

  const read = (s: GameState, call: Control) => {
    readFor = s.streak
    // Settled while the window is wide; the longer the run goes on, the more the answers spread.
    const strain = s.streak / 40
    let reaction = rand(0.3, 0.42) - Math.log(1 - Math.random()) * (0.015 + 0.03 * strain)
    answer = call
    if (Math.random() < slipChance(s.streak)) {
      // A hasty slip, most often back to the control it just used.
      const others = CONTROLS.filter((c) => c !== call)
      answer =
        lastUsed && lastUsed !== call && Math.random() < 0.6
          ? lastUsed
          : others[Math.floor(Math.random() * others.length)]!
      reaction *= 0.85
    }
    waitFor = reaction
  }

  return {
    start: (w, h) => {
      readFor = -1
      waitFor = 0
      lastUsed = null
      return startGame(createInitialState(w, h))
    },
    step: (s, dt) => {
      let next = s
      if (s.phase === 'call' && s.call && s.gap <= 0) {
        if (readFor !== s.streak) read(s, s.call)
        waitFor -= dt
        if (waitFor <= 0) {
          lastUsed = answer
          next = act(s, answer)
        }
      }
      return tick(next, dt)
    },
    over: (s) => s.phase === 'gameover',
    // The whole toy on the screen, centred, with nothing kept clear over it.
    render: (ctx, s, w, h) => renderGame(ctx, { ...s, stageTop: topFor(w, h) }, w, h),
    // The run itself has no size; only where the toy is drawn does, and that is worked out as it is drawn.
    resize: (s) => s,
    // The still: the toy calling Bop it, its clock full round the rim.
    poster: { seed: 1, at: 21.53 },
    // Its renderer times its twinkles and pulses by the page's clock; the run's own keeps the still the same.
    runClock: true,
    // Long enough to read the ending on the toy: which control it wanted, and which was pressed.
    hold: 2,
    // The toy scales with its canvas, but its names, keys and score pops have
    // floors in pixels, set for a phone. On a cabinet's small screen those
    // floors make them outgrow the controls and run into each other, so it is
    // drawn half as big again and shrunk to fit, which brings them back in
    // proportion. A screen the size of the banner's needs none of that.
    stage: (w) => Math.min(1.5, Math.max(1, 324 / w)),
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
