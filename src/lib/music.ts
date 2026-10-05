import { makeChip } from './chip'
import type { Track } from './musicTracks'

/** Notes are written this far ahead of the clock. */
const LOOKAHEAD = 0.2
const TICK_MS = 30
const FADE_IN = 0.8
const FADE_OUT = 0.5

export type Playing = {
  track: Track
  /** Fades the track out and lets it go. */
  stop: () => void
}

/**
 * Play a track into `out` until stopped, a step at a time, a little ahead of
 * the clock, on the Game Boy chip (chip.ts). Nothing is written while the page
 * is hidden, and a clock that ran on without it (a background tab, a phone
 * that stalled) is picked up on the next step rather than caught up in a burst.
 * A song that speeds up (Mountain King) is asked its tempo each time round.
 */
export function startTrack(audio: AudioContext, track: Track, out: AudioNode): Playing {
  const now0 = audio.currentTime
  const fader = audio.createGain()
  fader.gain.value = 0.0001
  fader.gain.setValueAtTime(0.0001, now0)
  fader.gain.exponentialRampToValueAtTime(track.level, now0 + FADE_IN)
  fader.connect(out)

  const chip = makeChip(audio, fader)
  const perBar = track.steps ?? 16
  const sixteenthAt = (step: number) => {
    const loop = Math.floor(step / (perBar * track.bars))
    return 60 / (track.bpmAt ? track.bpmAt(loop) : track.bpm) / 4
  }
  let next = now0 + 0.1
  let step = 0
  let timer = 0

  const tick = () => {
    const now = audio.currentTime
    while (next < now) {
      next += sixteenthAt(step)
      step += 1
    }
    if (!document.hidden) {
      while (next < now + LOOKAHEAD) {
        const sixteenth = sixteenthAt(step)
        const bar = Math.floor(step / perBar) % track.bars
        const i = step % perBar
        const t = next + (track.swing && i % 2 === 1 ? sixteenth * track.swing : 0)
        track.step(chip, bar, i, t, sixteenth)
        next += sixteenth
        step += 1
      }
    }
    timer = window.setTimeout(tick, TICK_MS)
  }
  tick()

  return {
    track,
    stop: () => {
      window.clearTimeout(timer)
      const now = audio.currentTime
      fader.gain.cancelScheduledValues(now)
      fader.gain.setValueAtTime(Math.max(0.0001, fader.gain.value), now)
      fader.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT)
      window.setTimeout(() => {
        chip.hush(audio.currentTime)
        fader.disconnect()
      }, (FADE_OUT + 0.2) * 1000)
    },
  }
}
