import { makeKit, type Track } from './musicTracks'
import type { Fx } from './soundPacks/voices'

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
 * the clock. Nothing is written while the page is hidden, and a clock that ran
 * on without it (a background tab, a phone that stalled) is picked up on the
 * next step rather than caught up in a burst.
 *
 * `fx` are the music's own ways into the room and the echo, so its tails turn
 * down with it. They open fully while the dry sound opens to the track's
 * level: the balance of dry to tail the tracks were written with.
 */
export function startTrack(audio: AudioContext, track: Track, out: AudioNode, fx: Fx): Playing {
  const now0 = audio.currentTime
  const fader = (to: AudioNode, level: number) => {
    const g = audio.createGain()
    g.gain.value = 0.0001
    g.gain.setValueAtTime(0.0001, now0)
    g.gain.exponentialRampToValueAtTime(level, now0 + FADE_IN)
    g.connect(to)
    return g
  }
  const dry = fader(out, track.level)
  const verb = fader(fx.verb, 1)
  const echo = fader(fx.echo, 1)
  const faders = [dry, verb, echo]

  const kit = makeKit(audio, dry, { verb, echo })
  const sixteenth = 60 / track.bpm / 4
  const t0 = now0 + 0.1
  const cleanup = track.setup?.(audio, dry, t0)
  let next = t0
  let step = 0
  let timer = 0

  const tick = () => {
    const now = audio.currentTime
    if (next < now) {
      const behind = Math.ceil((now - next) / sixteenth)
      next += behind * sixteenth
      step += behind
    }
    if (!document.hidden) {
      while (next < now + LOOKAHEAD) {
        const bar = Math.floor(step / 16) % track.bars
        const i = step % 16
        const t = next + (track.swing && i % 2 === 1 ? sixteenth * track.swing : 0)
        track.step(kit, bar, i, t, sixteenth)
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
      for (const g of faders) {
        g.gain.cancelScheduledValues(now)
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now)
        g.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT)
      }
      window.setTimeout(() => {
        cleanup?.()
        for (const g of faders) g.disconnect()
      }, (FADE_OUT + 0.2) * 1000)
    },
  }
}
