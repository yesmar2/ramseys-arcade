import { makeChip } from './chip'
import { makeKit, makeKitBus } from './kit'
import type { KitTrack } from './kitSongs'
import type { ChipTrack, Track } from './musicTracks'

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

/** A song on its instrument: how long each step is, and writing one step's notes. */
type Song = {
  stepSeconds: (step: number) => number
  write: (step: number, t: number, seconds: number) => void
  hush: (t: number) => void
}

/** A Game Boy song (chip.ts), sixteenths at a time; one that speeds up is asked its tempo each time round. */
function chipSong(audio: BaseAudioContext, track: ChipTrack, dest: AudioNode): Song {
  const chip = makeChip(audio, dest)
  const perBar = track.steps ?? 16
  return {
    stepSeconds: (step) => {
      const loop = Math.floor(step / (perBar * track.bars))
      return 60 / (track.bpmAt ? track.bpmAt(loop) : track.bpm) / 4
    },
    write: (step, next, sixteenth) => {
      const bar = Math.floor(step / perBar) % track.bars
      const i = step % perBar
      const t = next + (track.swing && i % 2 === 1 ? sixteenth * track.swing : 0)
      track.step(chip, bar, i, t, sixteenth)
    },
    hush: (t) => chip.hush(t),
  }
}

/**
 * A song on the band (kit.ts), through its own mixer. Its level follows the energy of each part of the
 * song, eased in as each bar starts; its notes end on their own once the fader is let go.
 */
function kitSong(audio: BaseAudioContext, track: KitTrack, dest: AudioNode): Song {
  const bus = makeKitBus(audio, dest, track.echo)
  const kit = makeKit(bus)
  const perBar = track.steps ?? 16
  const perBeat = track.perBeat ?? 4
  const barOf = (step: number) => Math.floor(step / perBar) % track.bars
  let gain = track.gainAt(0)
  bus.level.gain.value = gain
  return {
    stepSeconds: (step) => 60 / (track.tempoAt ? track.tempoAt(barOf(step)) : track.bpm) / perBeat,
    write: (step, next, seconds) => {
      const bar = barOf(step)
      const s = step % perBar
      if (s === 0) {
        const g = track.gainAt(bar)
        if (g !== gain) {
          bus.level.gain.setTargetAtTime(g, next, 0.15)
          gain = g
        }
      }
      const t = next + (track.swing && s % 2 === 1 ? seconds * track.swing : 0)
      track.play(kit, bar, s, t, seconds)
    },
    hush: () => {},
  }
}

/**
 * Play a track into `out` until stopped, a step at a time, a little ahead of the clock. Nothing is
 * written while the page is hidden, and a clock that ran on without it (a background tab, a phone that
 * stalled) is picked up on the next step rather than caught up in a burst. A bad note is skipped, not
 * allowed to stop the music.
 */
export function startTrack(audio: AudioContext, track: Track, out: AudioNode): Playing {
  const now0 = audio.currentTime
  const fader = audio.createGain()
  fader.gain.value = 0.0001
  fader.gain.setValueAtTime(0.0001, now0)
  fader.gain.exponentialRampToValueAtTime(track.level, now0 + FADE_IN)
  fader.connect(out)

  const song = track.engine === 'kit' ? kitSong(audio, track, fader) : chipSong(audio, track, fader)
  let next = now0 + 0.1
  let step = 0
  let timer = 0

  const tick = () => {
    const now = audio.currentTime
    while (next < now) {
      next += song.stepSeconds(step)
      step += 1
    }
    if (!document.hidden) {
      while (next < now + LOOKAHEAD) {
        const seconds = song.stepSeconds(step)
        try {
          song.write(step, next, seconds)
        } catch (err) {
          console.error(err)
        }
        next += seconds
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
        song.hush(audio.currentTime)
        fader.disconnect()
      }, (FADE_OUT + 0.2) * 1000)
    },
  }
}
